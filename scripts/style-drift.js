#!/usr/bin/env node
'use strict';

/**
 * style-drift.js — 文风漂移检测（单本书，确定性指标）
 *
 * 逐章扫描 正文/第N章.md，计算文风指标：
 *   句长均      = 总字符 / 句子数（句末 。！？!?；;…）
 *   对话占比    = 引号内字符 / 总字符（「」『』“”""''）
 *   标点密度    = 标点字符数 / 总字符
 *   用词丰富度  = 不重复汉字 / 汉字总数
 *   段落数
 * 与全书均值比较，标记 |z-score| > 1.5 的章节为「漂移章」。
 *
 * 与 learn-bank（好写法沉淀）/ continuity-ledger（事实矛盾）互补：
 *   本脚本关注「文风是否前后一致」，辅助识别代笔/AI味突变/状态断档。
 *
 * 零依赖：fs/path。退出码：0=成功；1=参数错误；2=无正文/文件失败。
 *
 * 用法：
 *   node style-drift.js <项目目录> [--json] [--html out.html] [--z 1.5]
 */

const fs = require('fs');
const path = require('path');
const { readFile } = require('./fs-utils');

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RESET = '\x1b[0m', BOLD = '\x1b[1m';
const log = (m) => console.log(`${GREEN}[DRIFT]${RESET} ${m}`);
const err = (m) => console.error(`${RED}[ERROR]${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}[WARN]${RESET} ${m}`);

function listChapters(projectDir) {
  const dir = path.join(projectDir, '正文');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .map(f => { const m = f.match(/第\s*(\d+)\s*章/); return m ? { num: parseInt(m[1], 10), file: path.join(dir, f) } : null; })
    .filter(Boolean).sort((a, b) => a.num - b.num);
}

const HANZI = /[\u4e00-\u9fff\u3400-\u4dbf]/;
const PUNCT = /[，。、！？；：""''「」『』（）《》…—·,.!?;:'"()<>…\-—]/;
const SENT_END = /[。！？!?；;…\n]/;
const QUOTE_PAIRS = [['「', '」'], ['『', '』'], ['“', '”'], ['"', '"'], ['\'', '\'']];

function measure(text) {
  const noSpace = text.replace(/\s+/g, '');
  const total = noSpace.length;
  if (total < 30) return null; // 太短，噪声大，跳过
  // 汉字
  let hanzi = 0; const seen = new Set();
  for (const ch of noSpace) { if (HANZI.test(ch)) { hanzi++; seen.add(ch); } }
  // 句子
  const sentences = noSpace.split(SENT_END).filter(s => s.trim().length > 0).length || 1;
  // 对话
  let dialogue = 0;
  for (const [l, r] of QUOTE_PAIRS) {
    const re = new RegExp('\\' + l + '[\\s\\S]*?\\' + r, 'g');
    let mm;
    while ((mm = re.exec(text)) !== null) dialogue += mm[0].replace(/\s+/g, '').length;
  }
  // 标点
  let punct = 0;
  for (const ch of noSpace) if (PUNCT.test(ch)) punct++;
  // 段落
  const paras = text.split(/\n\s*\n/).filter(s => s.trim().length > 0).length || 1;
  return {
    total,
    hanzi,
    avgSentence: +(total / sentences).toFixed(1),
    dialogueRatio: +(dialogue / total).toFixed(3),
    punctDensity: +(punct / total).toFixed(3),
    vocab: +(seen.size / Math.max(hanzi, 1)).toFixed(3),
    paras,
  };
}

function mean(a) { return a.reduce((x, y) => x + y, 0) / (a.length || 1); }
function std(a, m) { return Math.sqrt(mean(a.map(x => (x - m) ** 2))); }
function zscore(v, m, s) { return s < 1e-9 ? 0 : +((v - m) / s).toFixed(2); }

function buildHtml(rows, zTh, name) {
  const metrics = [
    { key: 'avgSentence', label: '句长均', color: '#2f7dd2' },
    { key: 'dialogueRatio', label: '对话占比', color: '#2fa05a' },
    { key: 'punctDensity', label: '标点密度', color: '#b07d2b' },
    { key: 'vocab', label: '用词丰富度', color: '#9b3fd2' },
  ];
  const W = 760, H = 200, padL = 46, padR = 14, padT = 18, padB = 26;
  let parts = '';
  metrics.forEach((mt, idx) => {
    const top = padT + idx * (H / metrics.length);
    const plotH = (H / metrics.length) - padB;
    const vals = rows.map(r => r.metrics[mt.key]);
    const mn = Math.min(...vals), mx = Math.max(...vals);
    const span = (mx - mn) || 1;
    const n = rows.length;
    const x = (i) => padL + (n <= 1 ? (W - padL - padR) / 2 : (i / (n - 1)) * (W - padL - padR));
    const y = (v) => top + plotH - ((v - mn) / span) * plotH;
    let path = '', dots = '';
    rows.forEach((r, i) => {
      const cx = x(i), cy = y(r.metrics[mt.key]);
      const drift = Math.abs(r.z[mt.key]) > zTh;
      path += `${i === 0 ? 'M' : 'L'}${cx.toFixed(1)},${cy.toFixed(1)} `;
      dots += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${drift ? 5 : 3}" fill="${drift ? '#d23f3f' : mt.color}"><title>第${r.chapter}章 ${mt.label}=${r.metrics[mt.key]} (z=${r.z[mt.key]})</title></circle>`;
    });
    parts += `<div style="font-size:12px;color:#555;margin:2px 0 0 46px">${mt.label}（红=漂移）</div>
<svg width="${W}" height="${H / metrics.length}" viewBox="0 0 ${W} ${H / metrics.length}" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:4px">
<path d="${path}" fill="none" stroke="${mt.color}" stroke-width="1.5"/>${dots}
</svg>`;
  });
  const driftCh = rows.filter(r => Object.values(r.z).some(z => Math.abs(z) > zTh)).map(r => r.chapter);
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>文风漂移 - ${name}</title>
<style>body{font-family:system-ui,"Microsoft YaHei",sans-serif;background:#fff;color:#222;margin:24px}h2{margin:0 0 4px}.sub{color:#888;font-size:13px}</style></head>
<body><h2>文风漂移检测 · ${name}</h2><div class="sub">阈值 |z| > ${zTh} 标记为漂移（红点）</div>${parts}
${driftCh.length ? `<p style="color:#d23f3f;font-weight:600">⚠ 漂移章：${driftCh.map(c => '第' + c + '章').join('、')}</p>` : '<p style="color:#2f9e44">✓ 文风一致，无显著漂移。</p>'}
</body></html>`;
}

function main() {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const htmlIdx = argv.indexOf('--html');
  const htmlOut = htmlIdx >= 0 ? argv[htmlIdx + 1] : null;
  const zIdx = argv.indexOf('--z');
  const zTh = zIdx >= 0 ? (parseFloat(argv[zIdx + 1]) || 1.5) : 1.5;
  const filtered = argv.filter(a => !a.startsWith('--'));
  if (filtered.length === 0) {
    err('用法: node style-drift.js <项目目录> [--json] [--html out.html] [--z 1.5]');
    return 1;
  }
  const projectDir = path.resolve(filtered[0]);
  if (!fs.existsSync(projectDir)) { err(`项目目录不存在: ${projectDir}`); return 1; }
  const chs = listChapters(projectDir);
  if (!chs.length) { err('未找到 正文/ 下的章节文件。'); return 2; }

  const rows = [];
  for (const c of chs) {
    const text = readFile(c.file);
    if (!text) continue;
    const m = measure(text);
    if (!m) continue;
    rows.push({ chapter: c.num, metrics: m });
  }
  if (rows.length < 3) { err(`有效章节不足 3 章（实测 ${rows.length}），无法计算可靠的漂移基线。`); return 2; }

  const keys = ['avgSentence', 'dialogueRatio', 'punctDensity', 'vocab'];
  const stat = {};
  for (const k of keys) { const arr = rows.map(r => r.metrics[k]); stat[k] = { mean: mean(arr), std: std(arr, mean(arr)) }; }
  for (const r of rows) {
    r.z = {};
    for (const k of keys) r.z[k] = zscore(r.metrics[k], stat[k].mean, stat[k].std);
  }

  if (jsonMode) {
    console.log(JSON.stringify({ project: path.basename(projectDir), zThreshold: zTh, chapters: rows.map(r => ({ chapter: r.chapter, ...r.metrics, z: r.z })) }, null, 2));
    return 0;
  }

  console.log(`\n${BOLD}🎨 文风漂移检测${RESET} — ${path.basename(projectDir)}（${rows.length} 章，阈值 |z|>${zTh}）\n`);
  console.log('章\t句长\t对话比\t标点密度\t丰富度\t段落\t漂移指标');
  const driftSet = new Set();
  for (const r of rows) {
    const driftKeys = keys.filter(k => Math.abs(r.z[k]) > zTh);
    driftKeys.forEach(k => driftSet.add(r.chapter));
    const flag = driftKeys.length ? `${RED}⚠${driftKeys.join(',')}${RESET}` : '—';
    console.log(`第${r.chapter}章\t${r.metrics.avgSentence}\t${r.metrics.dialogueRatio}\t${r.metrics.punctDensity}\t${r.metrics.vocab}\t${r.metrics.paras}\t${flag}`);
  }
  console.log(`\n基线（全书均值±标准差）：`);
  for (const k of keys) console.log(`  ${k}: ${stat[k].mean.toFixed(3)} ± ${stat[k].std.toFixed(3)}`);

  if (driftSet.size === 0) console.log(`\n${GREEN}✓ 文风一致，无显著漂移章。${RESET}`);
  else warn(`漂移章（|z|>${zTh}）：${[...driftSet].sort((a, b) => a - b).map(c => '第' + c + '章').join('、')}　→ 检查是否代笔/AI味突变/状态断档。`);

  if (htmlOut) {
    const html = buildHtml(rows, zTh, path.basename(projectDir));
    fs.writeFileSync(path.resolve(htmlOut), html, 'utf-8');
    log(`HTML 漂移图已写出：${htmlOut}`);
  }
  return 0;
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { err(`执行失败: ${e && e.message ? e.message : e}`); process.exit(2); }
}
module.exports = { measure, listChapters, buildHtml };
