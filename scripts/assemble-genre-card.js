#!/usr/bin/env node
'use strict';
/*
 * assemble-genre-card.js — 题材正文提示卡自动组装
 *
 * 解决 SOP 最大手工瓶颈：把「题材定位 + genre-prose-cards 索引 + genres/{题材}.md 模板
 * + style-genre-modules 流派模块」四源手动合并成 设定/题材正文提示卡.md 的过程自动化。
 *
 * 零依赖纯 Node。不修改 references/，只读；只写项目目录下的 设定/题材正文提示卡.md。
 *
 * USAGE:
 *   node assemble-genre-card.js <项目目录> <题材> [--platform X] [--force] [--json]
 *   node assemble-genre-card.js <项目目录>            # 题材从 设定/题材定位.md 推断
 *
 * 退出码：0=已生成/已存在跳过  1=参数/解析错误  2=未找到题材模板
 */
const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = __dirname;
const SKILL = path.resolve(SCRIPT_DIR, '..');
const GENRES_DIR = path.join(SKILL, 'references', 'genres');
const INDEX_FILE = path.join(SKILL, 'references', 'genre-prose-cards.md');
const STYLE_FILE = path.join(SKILL, 'references', 'style-genre-modules.md');

const RED = '\x1b[31m', GREEN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', RESET = '\x1b[0m';
function log(s) { console.log(s); }
function info(s) { console.error(`${GREEN}·${RESET} ${s}`); }
function warn(s) { console.error(`${YEL}!${RESET} ${s}`); }
function err(s) { console.error(`${RED}✗${RESET} ${s}`); }

function getOpt(argv, k, def) {
  const i = argv.indexOf(k);
  if (i >= 0 && i + 1 < argv.length) return argv[i + 1];
  return def;
}

// 读取项目 设定/题材定位.md，尝试推断 主题材 / 平台 / 性向
function readPositioning(proj) {
  const f = path.join(proj, '设定', '题材定位.md');
  if (!fs.existsSync(f)) return {};
  const t = fs.readFileSync(f, 'utf-8');
  const out = {};
  const grab = (key) => {
    const m = t.match(new RegExp(`(?:主题材|题材|性向|平台)[：:\\s]*([^\\n]*${key}[^\\n]*)`, 'i'))
      || t.match(new RegExp(`${key}[：:]\\s*([^\\n]+)`, 'i'));
    return m ? m[1].trim() : null;
  };
  // 宽松抓：找含“题材”的行取冒号后内容
  const genreLine = t.split('\n').find(l => /题材/.test(l) && /[：:]/.test(l));
  if (genreLine) out.genre = genreLine.split(/[：:]/).pop().replace(/[*`]/g, '').trim();
  const platLine = t.split('\n').find(l => /平台/.test(l) && /[：:]/.test(l));
  if (platLine) out.platform = platLine.split(/[：:]/).pop().replace(/[*`]/g, '').trim();
  if (/双男主|BL|纯爱|耽美/i.test(t)) out.bl = true;
  return out;
}

// 解析 genres/{题材}.md 的编号小节 -> {标题: 内容}
function parseSections(file) {
  const text = fs.readFileSync(file, 'utf-8');
  const lines = text.split('\n');
  const secs = {};
  let cur = null, buf = [];
  const flush = () => { if (cur != null) secs[cur] = buf.join('\n').trim(); };
  for (const l of lines) {
    const m = l.match(/^##\s+(\d+)\.\s*(.+?)\s*$/);
    if (m) { flush(); cur = m[2].trim(); buf = []; }
    else if (cur != null) buf.push(l);
  }
  flush();
  return secs;
}

// 在索引里按题材名或别名解析真实 genres 模板路径
function resolveGenre(genre) {
  const exact = path.join(GENRES_DIR, genre + '.md');
  if (fs.existsSync(exact)) return exact;
  if (!fs.existsSync(INDEX_FILE)) return null;
  const idx = fs.readFileSync(INDEX_FILE, 'utf-8');
  const lower = genre.toLowerCase();
  for (const ln of idx.split('\n')) {
    if (!ln.includes('genres/')) continue;
    const m = ln.match(/genres\/([^)\s]+\.md)/);
    if (!m) continue;
    const fname = m[1];
    const base = fname.replace(/\.md$/, '');
    // 同名或别名列命中
    if (base.toLowerCase() === lower || ln.toLowerCase().includes(lower)) {
      const cp = path.join(GENRES_DIR, fname);
      if (fs.existsSync(cp)) return cp;
    }
  }
  return null;
}

// 从 style-genre-modules.md 抽取与题材最相关的流派模块（核心规则/章节操作）
function extractStyle(genre) {
  if (!fs.existsSync(STYLE_FILE)) return null;
  const text = fs.readFileSync(STYLE_FILE, 'utf-8');
  const map = [
    ['言情', '言情'], ['豪门', '言情'], ['总裁', '言情'], ['甜宠', '言情'], ['追妻', '言情'],
    ['悬疑', '悬疑'], ['推理', '推理'], ['探案', '推理'],
    ['怪谈', '恐怖'], ['恐怖', '恐怖'], ['灵异', '恐怖'],
    ['修仙', '奇幻/玄幻'], ['玄幻', '奇幻/玄幻'], ['仙侠', '奇幻/玄幻'], ['西幻', '奇幻/玄幻'], ['高武', '奇幻/玄幻'],
    ['现实', '现实/世情'], ['世情', '现实/世情'],
    ['升级', '升级流/爽文'], ['爽文', '升级流/爽文'],
    ['幽默', '幽默'], ['沙雕', '幽默'], ['搞笑', '幽默'],
  ];
  let mod = null;
  for (const [k, m] of map) if (genre.includes(k)) { mod = m; break; }
  if (!mod) return null;
  // 抓 ## mod 段到下一个 ## 之前
  const lines = text.split('\n');
  let capture = false, buf = [];
  for (const l of lines) {
    const h = l.match(/^##\s+(.+?)\s*$/);
    if (h) {
      if (capture) break;
      if (h[1].trim() === mod) capture = true;
    } else if (capture) buf.push(l);
  }
  return buf.join('\n').trim() || null;
}

function compact(s, max) {
  if (!s) return '';
  s = s.replace(/\n{2,}/g, '\n').trim();
  if (s.length > (max || 400)) s = s.slice(0, max) + '…';
  return s;
}
// 把小节正文（多为 - 列表）压成单行短句，去掉前缀 -/*，用 ；连接
function inline(s, max) {
  if (!s) return '';
  const items = s.split('\n')
    .map(l => l.replace(/^[\s>*+-]+\s*/, '').replace(/\*\*/g, '').trim())
    .filter(Boolean);
  let out = items.join('；');
  if (out.length > (max || 300)) out = out.slice(0, max) + '…';
  return out;
}
// 从 style 模块文本抽取某个 ### 子节的 bullet 内容
function subsectionBullets(moduleText, name) {
  if (!moduleText) return '';
  const lines = moduleText.split('\n');
  let cap = false, buf = [];
  for (const l of lines) {
    const h = l.match(/^###\s+(.+?)\s*$/);
    if (h) {
      if (cap) break;
      if (h[1].includes(name)) cap = true;
    } else if (cap) buf.push(l);
  }
  return buf.join('\n').trim();
}

function buildCard(opts) {
  const { genre, platform, bl, secs, style } = opts;
  const field = (label, val) => `- ${label}：${val || '（待据题材定位与对标补全）'}`;
  const lines = [];
  lines.push('## 题材正文提示卡');
  lines.push('');
  const tp = [genre, platform].filter(Boolean).join(' · ');
  lines.push(field('主题材 / 平台', tp + (bl ? ' · 双男主(BL)' : '')));
  lines.push(field('题材边界', inline(secs['核心流派/细分'] || secs['核心流派'] || '', 300)));
  lines.push(field('核心逻辑', inline(secs['世界观/设定要素'] || secs['世界观/生活逻辑'] || '', 400)));
  lines.push(field('读者期待', inline(secs['经典爽点套路'] || secs['核心爽点/情绪'] || '', 300)));
  lines.push(field('核心爽点 / 情绪', inline(secs['经典爽点套路'] || secs['常见情绪转化'] || '', 400)));
  lines.push(field('节奏密度', inline(secs['大纲节奏建议'] || secs['前中后期打法'] || '', 300)));
  lines.push(field('场景颗粒', inline((secs['世界观/设定要素'] || '') + '\n' + (secs['经典爽点套路'] || ''), 250)));
  const voice = [subsectionBullets(style, '核心规则'), subsectionBullets(style, '章节操作')].filter(Boolean).join('\n');
  lines.push(field('对话与人物声线', inline(voice, 300)));
  lines.push(field('禁止漂移', inline(secs['常见雷区/禁忌'] || secs['禁止漂移'] || '', 300)));
  lines.push('- 本章取舍：（写前从上面抽取 2-4 条执行，不全量套用；逐章更新）');
  lines.push('');
  lines.push('> 本书文风（句长/标点/潜台词/笔调）来自 `设定/文风.md`，不在此卡覆盖；写作前合并三件套。');
  lines.push(`> 自动生成自 genres/${genre}.md + style-genre-modules；如需微调，直接编辑本文件即可。`);
  return lines.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('USAGE: node assemble-genre-card.js <项目目录> [<题材>] [--platform X] [--force] [--json]');
    return 0;
  }
  const json = argv.includes('--json');
  const force = argv.includes('--force');
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { i++; continue; }
    positional.push(a);
  }
  const proj = positional[0];
  let genre = positional[1];
  if (!proj) { err('缺少项目目录'); return 1; }
  const projDir = path.resolve(proj);
  if (!fs.existsSync(projDir)) { err(`项目目录不存在：${projDir}`); return 1; }

  const pos = readPositioning(projDir);
  if (!genre) genre = pos.genre;
  if (!genre) { err('未提供题材，且 设定/题材定位.md 未发现主题材；请用 `node assemble-genre-card.js <项目目录> <题材>`'); return 1; }
  const platform = getOpt(argv, '--platform', pos.platform) || '待填';
  const bl = !!pos.bl;

  const tmpl = resolveGenre(genre);
  if (!tmpl) {
    err(`未找到题材模板 genres/${genre}.md（索引与 genres/ 均无匹配；可用别名见 genre-prose-cards.md）`);
    return 2;
  }
  const secs = parseSections(tmpl);
  const style = extractStyle(genre);

  const outDir = path.join(projDir, '设定');
  const outFile = path.join(outDir, '题材正文提示卡.md');
  if (fs.existsSync(outFile) && !force) {
    warn(`已存在 设定/题材正文提示卡.md，跳过（用 --force 覆盖）`);
    if (json) console.log(JSON.stringify({ status: 'exists', file: outFile }, null, 2));
    return 0;
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const card = buildCard({ genre, platform, bl, secs, style });
  fs.writeFileSync(outFile, card + '\n', 'utf-8');

  info(`已生成 ${path.relative(projDir, outFile)}`);
  info(`题材=${genre} 平台=${platform}${bl ? ' BL' : ''} 模板小节=${Object.keys(secs).length} 流派模块=${style ? '已抽' : '无'}`);
  if (!json) {
    console.log(DIM + '---- 预览 ----' + RESET);
    console.log(card);
  } else {
    console.log(JSON.stringify({ status: 'written', file: outFile, genre, platform, sections: Object.keys(secs) }, null, 2));
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { main, resolveGenre, parseSections, extractStyle };
