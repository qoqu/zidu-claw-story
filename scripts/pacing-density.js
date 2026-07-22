#!/usr/bin/env node
'use strict';

/**
 * pacing-density.js — 节奏密度曲线（复用 追踪/追读力.md 时间序列）
 *
 * 数据源：追踪/追读力.md 中每章累积的 `### 第N章` 块（由
 *   tracking-updater.js reading-power 子命令写入）。
 * 每章提取：钩子强度 / 爽点模式数 / 微兑现数 / 硬约束违规数 / 债务余额，
 * 合成「追读密度分」(0-100)，输出：
 *   - 终端 ASCII 曲线 + 水章标记
 *   - 表格（各章明细）
 *   - --json 结构化输出
 *   - --html <file> 自包含 SVG 折线图（水章标红）
 *
 * 设计：纯解析 Markdown，零依赖（fs/path）；不改动既有写入脚本，
 * 与 continuity-ledger / consistency-checker 互补（它们查「矛盾」，本查「节奏」）。
 *
 * 退出码：0=成功；1=参数错误；2=无数据/文件操作失败。
 *
 * 用法：
 *   node pacing-density.js <项目目录> [--json] [--html out.html] [--water N]
 *   （--water N 自定义水章阈值，默认 45）
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RESET = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m';
const log = (m) => console.log(`${GREEN}[PACING]${RESET} ${m}`);
const err = (m) => console.error(`${RED}[ERROR]${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}[WARN]${RESET} ${m}`);

function readFile(p) { try { return fs.readFileSync(p, 'utf-8'); } catch { return null; } }

// ===== 解析 追踪/追读力.md =====
function parseReadingPower(projectDir) {
  const fp = path.join(projectDir, '追踪', '追读力.md');
  const c = readFile(fp);
  if (!c) return null;
  const chapters = [];
  const re = /###\s*第\s*(\d+)\s*章([\s\S]*?)(?=\n###\s*第\s*\d+\s*章|\n##\s|$)/g;
  let m;
  while ((m = re.exec(c)) !== null) {
    const num = parseInt(m[1], 10);
    const body = m[2];
    const get = (label) => {
      const mm = body.match(new RegExp(label + '[：:]\\s*([^\\n]*)'));
      return mm ? mm[1].trim() : '';
    };
    // 钩子类型 / 强度 同行，分隔可能是全角空格或普通空格
    const hookLine = body.match(/钩子类型[：:]\s*([^\n]*)/);
    let hookType = '', hookStrength = '';
    if (hookLine) {
      const raw = hookLine[1].trim();
      const sp = raw.split(/强度[：:]/);
      hookType = (sp[0] || '').replace(/[　 ]+$/, '');
      hookStrength = (sp[1] || '').trim();
    }
    const splitList = (s) => s.split(/[、,，]/).map(x => x.trim()).filter(x => x && x !== '—' && x !== '-' && x !== '无');
    const coolpoints = splitList(get('爽点模式'));
    const micropayoffs = splitList(get('微兑现'));
    const hardViolations = splitList(get('硬约束违规'));
    const debtRaw = get('债务余额');
    const debt = debtRaw === '' ? 0 : (parseFloat(debtRaw) || 0);
    // 可选真实数据回填（方案①）：平台作家后台手抄；「—/-/空」视为未填
    const realRate = (() => { const r = get('真实追读率'); return (r === '' || r === '—' || r === '-') ? null : (parseFloat(r) || null); })();
    const realFinish = (() => { const r = get('真实完读率'); return (r === '' || r === '—' || r === '-') ? null : (parseFloat(r) || null); })();
    chapters.push({ chapter: num, hookType, hookStrength, coolpoints, micropayoffs, hardViolations, debt, realRate, realFinish });
  }
  return chapters.length ? chapters.sort((a, b) => a.chapter - b.chapter) : null;
}

const STRENGTH = { weak: 1, 弱: 1, medium: 2, 中: 2, strong: 3, 强: 3 };

function densityScore(ch) {
  const hook = STRENGTH[ch.hookStrength] || 2;
  const cool = ch.coolpoints.length;
  const micro = ch.micropayoffs.length;
  const hv = ch.hardViolations.length;
  const debtBonus = ch.debt > 0 ? 0.3 : 0;
  return hook * 1.0 + cool * 1.0 + micro * 1.5 - hv * 1.0 + debtBonus;
}

function renderCurve(series, waterTh) {
  const barW = 22;
  console.log(`\n${BOLD}追读密度曲线（有效密度 0-100，阈值 ${waterTh} 以下标记为水章；有真实率时 eff=真实率，否则=结构性归一分）${RESET}\n`);
  for (const s of series) {
    const filled = Math.round((s.eff / 100) * barW);
    const bar = '█'.repeat(filled) + '░'.repeat(barW - filled);
    const isWater = s.eff < waterTh;
    const tag = isWater ? `${RED}水${RESET}` : '  ';
    const real = s.realRate != null ? ` 真实${s.realRate}%` : '';
    const line = `第${String(s.chapter).padStart(3, '0')}章 │${isWater ? RED : ''}${bar}${RESET} ${String(s.eff).padStart(3)}${real} ${tag}`;
    console.log(line);
  }
}

function renderTable(series) {
  console.log(`\n${BOLD}明细${RESET}\n`);
  console.log('章\t强度\t爽点\t微兑现\t硬违规\t债务\t有效密度\t真实率');
  for (const s of series) {
    console.log(
      `第${s.chapter}章\t${s.hookStrength || '-'}\t${s.coolpoints.length}\t${s.micropayoffs.length}\t${s.hardViolations.length}\t${s.debt}\t${s.eff}\t${s.realRate != null ? s.realRate + '%' : '—'}`
    );
  }
}

function buildHtml(series, waterTh, projectName) {
  const W = 720, H = 320, padL = 48, padB = 40, padT = 28, padR = 16;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const n = series.length;
  const xs = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const ys = (v) => padT + (1 - v / 100) * plotH;
  let pts = '', ptsReal = '', dots = '', labels = '';
  const hasReal = series.some(s => s.realRate != null);
  series.forEach((s, i) => {
    const x = xs(i), y = ys(s.norm);
    const yDot = ys(s.eff);
    const col = s.eff < waterTh ? '#d23f3f' : '#2f7dd2';
    pts += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
    if (s.realRate != null) ptsReal += `${ptsReal ? 'L' : 'M'}${x.toFixed(1)},${ys(s.realRate).toFixed(1)} `;
    const tip = `第${s.chapter}章 有效${s.eff}${s.realRate != null ? ' 真实' + s.realRate + '%' : ''}`;
    dots += `<circle cx="${x.toFixed(1)}" cy="${yDot.toFixed(1)}" r="4" fill="${col}"><title>${tip}</title></circle>`;
    labels += `<text x="${x.toFixed(1)}" y="${(H - padB + 16)}" font-size="10" text-anchor="middle" fill="#666">${s.chapter}</text>`;
  });
  // 阈值线
  const ty = ys(waterTh);
  const grid = [0, 25, 50, 75, 100].map(v => {
    const y = ys(v);
    return `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#eee" stroke-width="1"/><text x="${padL - 6}" y="${y + 3}" font-size="9" text-anchor="end" fill="#999">${v}</text>`;
  }).join('');
  const legend = hasReal
    ? `<div class="sub"><span style="color:#2f7dd2">━ 结构性归一分</span>　<span style="color:#e08a00">━ 真实追读率（接管 pacing 信号）</span></div>`
    : `<div class="sub">结构性代理（未填真实率）</div>`;
  const realPath = hasReal ? `<path d="${ptsReal}" fill="none" stroke="#e08a00" stroke-width="2" stroke-dasharray="4 3"/>` : '';
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>追读密度曲线 - ${projectName}</title>
<style>body{font-family:system-ui,"Microsoft YaHei",sans-serif;background:#fff;color:#222;margin:24px} h2{margin:0 0 4px} .sub{color:#888;font-size:13px;margin-bottom:12px} .water{color:#d23f3f;font-weight:600}</style></head>
<body><h2>追读密度曲线 · ${projectName}</h2><div class="sub">数据源：追踪/追读力.md　|　阈值 ${waterTh} 以下为水章（红）${hasReal ? '　· 真实率已接管' : ''}</div>
${legend}
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<line x1="${padL}" y1="${ty}" x2="${W - padR}" y2="${ty}" stroke="#d23f3f" stroke-width="1" stroke-dasharray="5 4"/>
<text x="${W - padR}" y="${ty - 5}" font-size="9" text-anchor="end" fill="#d23f3f">水章阈值 ${waterTh}</text>
${grid}
<path d="${pts}" fill="none" stroke="#2f7dd2" stroke-width="2"/>
${realPath}
${dots}${labels}
</svg>
${(() => { const w = series.filter(s => s.eff < waterTh); return w.length ? `<p class="water">⚠ 疑似水章：${w.map(s => '第' + s.chapter + '章(' + s.eff + (s.realRate != null ? ' 真实' + s.realRate + '%' : '') + ')').join('、')}</p>` : '<p style="color:#2f9e44">✓ 本书节奏分布健康，无水章预警。</p>'; })()}
</body></html>`;
}

function main() {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const htmlIdx = argv.indexOf('--html');
  const htmlOut = htmlIdx >= 0 ? argv[htmlIdx + 1] : null;
  const waterIdx = argv.indexOf('--water');
  const waterTh = waterIdx >= 0 ? (parseInt(argv[waterIdx + 1], 10) || 45) : 45;
  const filtered = argv.filter(a => !a.startsWith('--'));
  if (filtered.length === 0) {
    err('用法: node pacing-density.js <项目目录> [--json] [--html out.html] [--water N]');
    return 1;
  }
  const projectDir = path.resolve(filtered[0]);
  if (!fs.existsSync(projectDir)) { err(`项目目录不存在: ${projectDir}`); return 1; }

  const chapters = parseReadingPower(projectDir);
  if (!chapters) { err('未找到 追踪/追读力.md 或其中无章节块。请先运行 tracking-updater.js reading-power。'); return 2; }

  const rawScores = chapters.map(densityScore);
  const maxRaw = Math.max(...rawScores, 0.0001);
  const series = chapters.map((ch, i) => {
    const norm = Math.round((rawScores[i] / maxRaw) * 100);
    // 有效密度 eff：填了真实追读率则用真实率（已是 0-100），否则回退结构性归一分
    const eff = (ch.realRate != null) ? ch.realRate : norm;
    return { ...ch, raw: rawScores[i], norm, eff };
  });

  const waterChapters = series.filter(s => s.eff < waterTh);

  if (jsonMode) {
    console.log(JSON.stringify({ project: path.basename(projectDir), waterThreshold: waterTh, chapters: series, waterChapters: waterChapters.map(s => s.chapter) }, null, 2));
    return 0;
  }

  console.log(`\n${BOLD}📈 节奏密度曲线${RESET} — ${path.basename(projectDir)}（共 ${series.length} 章）`);
  renderCurve(series, waterTh);
  renderTable(series);

  if (waterChapters.length === 0) console.log(`\n${GREEN}✓ 无水章预警，节奏分布健康。${RESET}`);
  else warn(`疑似水章（有效密度<${waterTh}）：${waterChapters.map(s => '第' + s.chapter + '章(' + s.eff + (s.realRate != null ? ' 真实' + s.realRate + '%' : '') + ')').join('、')}　→ 建议补钩子/爽点/微兑现。`);

  if (htmlOut) {
    const html = buildHtml(series, waterTh, path.basename(projectDir));
    fs.writeFileSync(path.resolve(htmlOut), html, 'utf-8');
    log(`HTML 曲线已写出：${htmlOut}`);
  }
  return 0;
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { err(`执行失败: ${e && e.message ? e.message : e}`); process.exit(2); }
}
module.exports = { parseReadingPower, densityScore, buildHtml };
