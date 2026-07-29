#!/usr/bin/env python3
"""
番茄小说字体反爬解码器 v3

策略：用 Pillow 渲染 PUA 字符和标准汉字为位图，通过像素对比识别真实字符。

用法：
  python fanqie-font-decoder.py --font-url <url> --output <path>
"""

import sys
import json
import argparse
import hashlib
from pathlib import Path

def download_font(url, output_path):
    import requests
    print(f"下载字体: {url}")
    resp = requests.get(url, timeout=30, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    })
    resp.raise_for_status()
    with open(output_path, "wb") as f:
        f.write(resp.content)
    print(f"  已保存: {output_path} ({len(resp.content)} bytes)")
    return output_path

def woff2_to_ttf(woff2_path, ttf_path):
    """将 woff2 转换为 TTF"""
    from fontTools.ttLib import TTFont
    font = TTFont(woff2_path)
    font.flavor = None  # 移除 woff2 标记
    font.save(ttf_path)
    font.close()
    print(f"  转换为 TTF: {ttf_path}")

def render_char_image(font, char, size=40):
    """用指定字体渲染单个字符为灰度位图"""
    from PIL import Image, ImageDraw
    img = Image.new("L", (size, size), 255)
    draw = ImageDraw.Draw(img)
    # 居中渲染
    bbox = font.getbbox(char)
    if not bbox or bbox[2] - bbox[0] == 0:
        return None
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (size - w) // 2 - bbox[0]
    y = (size - h) // 2 - bbox[1]
    draw.text((x, y), char, font=font, fill=0)
    return img

def image_hash(img, size=8):
    """计算图片的感知哈希 (aHash)"""
    small = img.resize((size, size))
    pixels = list(small.getdata())
    avg = sum(pixels) / len(pixels)
    bits = 0
    for p in pixels:
        bits = (bits << 1) | (1 if p < avg else 0)
    return bits

def hamming_distance(h1, h2, bits=64):
    """计算两个哈希的汉明距离"""
    xor = h1 ^ h2
    dist = 0
    for i in range(bits):
        dist += (xor >> i) & 1
    return dist

def decode_font(font_path, ref_font_path, output_path):
    from fontTools.ttLib import TTFont
    from PIL import ImageFont
    import io
    
    # 转换 woff2 → ttf
    ttf_path = font_path.replace(".woff2", ".ttf")
    if font_path.endswith(".woff2"):
        woff2_to_ttf(font_path, ttf_path)
    else:
        ttf_path = font_path
    
    # 解析字体获取 PUA 码点列表
    fq_font = TTFont(ttf_path)
    fq_cmap = fq_font.getBestCmap()
    pua_codes = sorted([cp for cp in fq_cmap if 0xE000 <= cp <= 0xF8FF])
    fq_font.close()
    print(f"  PUA 码点数: {len(pua_codes)}")
    
    # 加载 Pillow 字体
    render_size = 40
    fq_pil_font = ImageFont.truetype(ttf_path, render_size)
    
    # 加载参考字体
    ref_ttf = ref_font_path
    if ref_font_path.endswith(".ttc"):
        # PIL 可以直接加载 TTC 的第一个字体
        ref_pil_font = ImageFont.truetype(ref_font_path, render_size)
    else:
        ref_pil_font = ImageFont.truetype(ref_font_path, render_size)
    
    # 渲染所有 PUA 字符并计算哈希
    print("  渲染 PUA 字符...")
    pua_hashes = {}
    pua_images = {}
    for i, cp in enumerate(pua_codes):
        char = chr(cp)
        img = render_char_image(fq_pil_font, char, render_size)
        if img:
            h = image_hash(img)
            pua_hashes[cp] = h
            pua_images[cp] = img
        if (i + 1) % 100 == 0:
            print(f"    {i+1}/{len(pua_codes)}")
    
    print(f"  PUA 渲染成功: {len(pua_hashes)}")
    
    # 渲染常用汉字并计算哈希
    print("  渲染参考汉字...")
    ref_hashes = {}
    
    # 常用 3500 字 + 次常用 3000 字
    for cp in range(0x4E00, 0x9FA6):
        char = chr(cp)
        img = render_char_image(ref_pil_font, char, render_size)
        if img:
            h = image_hash(img)
            ref_hashes[cp] = h
    
    print(f"  参考汉字渲染成功: {len(ref_hashes)}")
    
    # 对比哈希
    print("  对比哈希...")
    mapping = {}
    
    for pua_cp, pua_hash in pua_hashes.items():
        best_match = None
        best_dist = float('inf')
        
        for ref_cp, ref_hash in ref_hashes.items():
            dist = hamming_distance(pua_hash, ref_hash)
            if dist < best_dist:
                best_dist = dist
                best_match = ref_cp
        
        # 只接受距离足够小的匹配
        if best_match is not None and best_dist <= 5:
            mapping[pua_cp] = chr(best_match)
    
    # 对于哈希匹配不够好的，尝试像素级对比
    unmatched = [cp for cp in pua_codes if cp not in mapping]
    if unmatched:
        print(f"  哈希匹配: {len(mapping)}, 像素对比 {len(unmatched)} 个...")
        
        # 为参考字符缓存像素数据
        ref_pixel_cache = {}
        for cp in ref_hashes:
            char = chr(cp)
            img = render_char_image(ref_pil_font, char, render_size)
            if img:
                ref_pixel_cache[cp] = list(img.getdata())
        
        for pua_cp in unmatched:
            if pua_cp not in pua_images:
                continue
            pua_pixels = list(pua_images[pua_cp].getdata())
            
            best_match = None
            best_score = float('inf')
            
            for ref_cp, ref_pixels in ref_pixel_cache.items():
                if len(ref_pixels) != len(pua_pixels):
                    continue
                # 计算像素差异
                diff = sum(abs(a - b) for a, b in zip(pua_pixels, ref_pixels))
                if diff < best_score:
                    best_score = diff
                    best_match = ref_cp
            
            # 阈值：40x40=1600 像素，平均每像素差异 < 5
            if best_match is not None and best_score < 5000:
                mapping[pua_cp] = chr(best_match)
    
    return pua_codes, mapping

def main():
    parser = argparse.ArgumentParser(description="番茄小说字体反爬解码器 v3")
    parser.add_argument("--font-url", required=True, help="woff2 字体文件 URL")
    parser.add_argument("--output", required=True, help="输出映射表 JSON 路径")
    parser.add_argument("--ref-font", default="C:/Windows/Fonts/simsun.ttc",
                        help="参考字体路径")
    args = parser.parse_args()
    
    # 下载字体
    font_path = args.output.replace(".json", ".woff2")
    download_font(args.font_url, font_path)
    
    # 解码
    print("\n解码字体...")
    pua_codes, mapping = decode_font(font_path, args.ref_font, args.output)
    
    # 输出结果
    output_mapping = {f"0x{cp:x}": char for cp, char in mapping.items()}
    undecoded = [f"0x{cp:x}" for cp in pua_codes if cp not in mapping]
    
    result = {
        "font_url": args.font_url,
        "total_pua": len(pua_codes),
        "decoded": len(output_mapping),
        "undecoded": len(undecoded),
        "mapping": output_mapping,
        "undecoded_list": undecoded
    }
    
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"\n=== 解码结果 ===")
    print(f"总 PUA 字符: {len(pua_codes)}")
    print(f"已解码: {len(output_mapping)}")
    print(f"未解码: {len(undecoded)}")
    print(f"映射表: {args.output}")
    
    if output_mapping:
        print(f"\n解码示例:")
        for k, v in list(output_mapping.items())[:30]:
            print(f"  {k} → {v}")

if __name__ == "__main__":
    main()
