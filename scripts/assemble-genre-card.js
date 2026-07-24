#!/usr/bin/env node
'use strict';
/*
 * assemble-genre-card.js — 题材正文提示卡自动组装
 *
 * 解决 SOP 最大手工瓶颈：把「题材定位 + genre-prose-cards 索引 + references/{题材}.md 根级长篇样本驱动提示卡
 * + genres/{题材}.md 题材模板 + style-genre-modules 流派模块」五源自动合并成 设定/题材正文提示卡.md。
 *
 * 根级卡（references/{题材}.md，带 YAML frontmatter，source=local_longform_sample_derived）侧重「写作实战」，
 * 优先消费；genres/{题材}.md 侧重「结构化分析」作为补充。两类资源关系见 references/genre-prose-cards.md 新增段。
 *
 * 零依赖纯 Node。不修改 references/，只读；只写项目目录下的 设定/题材正文提示卡.md。
 *
 * USAGE:
 *   node assemble-genre-card.js <项目目录> <题材> [--platform X] [--force] [--json]
 *   node assemble-genre-card.js <项目目录>            # 题材从 设定/题材定位.md 推断
 *
 * 退出码：0=已生成/已存在跳过  1=参数/解析错误  2=未找到题材资源（genres/ 与根级卡均无）
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

// 通用段名解析：兼容 `## N. 标题`（genres/）与 `## 标题`（根级长篇样本驱动卡）
function parseAnySections(file) {
  const text = fs.readFileSync(file, 'utf-8');
  const lines = text.split('\n');
  const secs = {};
  let cur = null, buf = [];
  const flush = () => { if (cur != null) secs[cur] = buf.join('\n').trim(); };
  for (const l of lines) {
    const m = l.match(/^##\s+(?:\d+\.\s*)?(.+?)\s*$/);
    if (m) { flush(); cur = m[1].trim(); buf = []; }
    else if (cur != null) buf.push(l);
  }
  flush();
  return secs;
}

// 解析根级卡 YAML frontmatter（genre/aliases/platform/confidence/source）
function parseFrontmatter(text) {
  const m = text.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
  if (!m) return {};
  const out = {};
  for (const ln of m[1].split('\n')) {
    const kv = ln.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (kv) {
      let v = kv[2].trim();
      if (v.startsWith('[') && v.endsWith(']')) {
        v = v.slice(1, -1).split(',').map(x => x.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
      }
      out[kv[1].trim()] = v;
    }
  }
  return out;
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
  const { genre, platform, bl, secs, style, rootSecs, rootFm } = opts;
  const field = (label, val) => `- ${label}：${val || '（待据题材定位与对标补全）'}`;
  // 优先消费根级长篇样本驱动卡（写作实战），无则回退 genres/ 模板（结构化分析）
  const pick = (rootK, genreK, max) => {
    const r = rootSecs && rootSecs[rootK];
    if (r) return inline(r, max);
    return inline(secs && (secs[genreK] || secs[altKey(genreK)] || ''), max);
  };
  const lines = [];
  lines.push('## 题材正文提示卡');
  lines.push('');
  const tp = [genre, platform].filter(Boolean).join(' · ');
  lines.push(field('主题材 / 平台', tp + (bl ? ' · 双男主(BL)' : '')));
  if (rootFm && (rootFm.source || rootFm.confidence)) {
    lines.push(field('来源 / 置信度', `${rootFm.source || 'local'} · ${rootFm.confidence || '?'}`));
  }
  lines.push(field('题材边界', pick('开场抓手', '核心流派/细分', 300)));
  lines.push(field('核心逻辑', pick('冲突发动机', '世界观/设定要素', 400)));
  lines.push(field('读者期待', pick('正文提示词', '经典爽点套路', 300)));
  lines.push(field('核心爽点 / 情绪', pick('爽点与情绪释放', '经典爽点套路', 400)));
  lines.push(field('节奏密度', pick('节奏密度', '大纲节奏建议', 300)));
  lines.push(field('场景颗粒', pick('场景颗粒', '世界观/设定要素', 250)));
  // 对话与人物声线：根级卡有「对话与声线」则优先，否则从 style 模块抽
  const voiceRoot = rootSecs && rootSecs['对话与声线'];
  const voice = voiceRoot
    ? inline(voiceRoot, 300)
    : inline([subsectionBullets(style, '核心规则'), subsectionBullets(style, '章节操作')].filter(Boolean).join('\n'), 300);
  lines.push(field('对话与人物声线', voice));
  lines.push(field('禁止漂移', pick('禁止漂移', '常见雷区/禁忌', 300)));
  lines.push('- 本章取舍：（写前从上面抽取 2-4 条执行，不全量套用；逐章更新）');
  lines.push('');
  lines.push('> 本书文风（句长/标点/潜台词/笔调）来自 `设定/文风.md`，不在此卡覆盖；写作前合并三件套。');
  const src = rootFm ? `references/${genre}.md（根级长篇样本驱动提示卡，source=${rootFm.source || '?'}）` : `genres/${genre}.md（结构化模板）`;
  lines.push(`> 自动生成自 ${src}${style ? ' + style-genre-modules' : ''}；如需微调，直接编辑本文件即可。`);
  return lines.join('\n');
}

// 别名兼容（genres/ 模板旧版段名）
function altKey(k) {
  const map = {
    '核心流派/细分': '核心流派',
    '世界观/设定要素': '世界观/生活逻辑',
    '经典爽点套路': '核心爽点/情绪',
    '大纲节奏建议': '前中后期打法',
    '常见雷区/禁忌': '禁止漂移',
  };
  return map[k] || k;
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
  const secs = tmpl ? parseAnySections(tmpl) : {};
  const style = extractStyle(genre);

  // 第 4 源（priority）：根级 references/{题材}.md（长篇样本驱动提示卡，写作实战；存在则优先消费）
  const rootFile = path.join(SKILL, 'references', genre + '.md');
  const rootExists = fs.existsSync(rootFile);
  if (!rootExists && !tmpl) {
    err(`未找到题材资源：genres/${genre}.md 与根级 references/${genre}.md 均不存在（索引与 genres/ 目录均无匹配；可用别名见 genre-prose-cards.md）`);
    return 2;
  }
  let rootSecs = null, rootFm = null;
  if (rootExists) {
    rootSecs = parseAnySections(rootFile);
    rootFm = parseFrontmatter(fs.readFileSync(rootFile, 'utf-8'));
  }

  const outDir = path.join(projDir, '设定');
  const outFile = path.join(outDir, '题材正文提示卡.md');
  if (fs.existsSync(outFile) && !force) {
    warn(`已存在 设定/题材正文提示卡.md，跳过（用 --force 覆盖）`);
    if (json) console.log(JSON.stringify({ status: 'exists', file: outFile }, null, 2));
    return 0;
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const card = buildCard({ genre, platform, bl, secs, style, rootSecs, rootFm });
  fs.writeFileSync(outFile, card + '\n', 'utf-8');

  info(`已生成 ${path.relative(projDir, outFile)}`);
  const sources = [rootExists ? `根级卡(${Object.keys(rootSecs || {}).length}段)` : null, tmpl ? `genres/(${Object.keys(secs).length}段)` : null, style ? 'style' : null].filter(Boolean).join('+');
  info(`题材=${genre} 平台=${platform}${bl ? ' BL' : ''} 来源=${sources}`);
  if (!json) {
    console.log(DIM + '---- 预览 ----' + RESET);
    console.log(card);
  } else {
    console.log(JSON.stringify({
      status: 'written', file: outFile, genre, platform,
      sources: {
        rootCard: rootExists ? { file: rootFile, fm: rootFm, sections: Object.keys(rootSecs) } : null,
        genres: tmpl ? { file: tmpl, sections: Object.keys(secs) } : null,
        style: !!style,
      },
    }, null, 2));
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { main, resolveGenre, parseSections, extractStyle };
