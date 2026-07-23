#!/usr/bin/env node
'use strict';

/**
 * dashboard.js — 多项目仪表盘（聚合所有书的健康与进度）
 *
 * 扫描根目录下属项目（含 正文/ 或 追踪/ 的子目录），为每本聚合：
 *   章节数 / 总字数 / 最新章 / 最新追读密度 / doctor 健康度 / 记忆条数 / 最近更新
 * 输出终端表格 + --json + --html 卡片视图。
 *
 * doctor 健康度用内联轻量检查（结构目录 + 流水线状态 + 必需追踪文件），
 * 不逐项目 spawn 子进程，避免多开书时开销爆炸。需要深度体检仍用 doctor.js。
 *
 * 零依赖：fs/path（+ require 本目录 pacing-density.js 复用追读力解析）。
 * 退出码：0=成功；1=参数错误；2=根目录异常。
 *
 * 用法：
 *   node dashboard.js <根目录> [--json] [--html out.html]
 */

const fs = require('fs');
const path = require('path');
const { readFile } = require('./fs-utils');

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RESET = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m';
const err = (m) => console.error(`${RED}[ERROR]${RESET} ${m}`);

let parseReadingPower, densityScore;
try {
  ({ parseReadingPower, densityScore } = require('./pacing-density.js'));
} catch (e) { parseReadingPower = null; densityScore = null; }

function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function mtimeMs(p) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }
function countWords(text) { return text.replace(/[#*_`\[\](){}|\\~^>!-]/g, '').replace(/\s+/g, '').length; }

function listProjects(root) {
  if (!isDir(root)) return [];
  return fs.readdirSync(root)
    .map(name => path.join(root, name))
    .filter(p => isDir(p) && (isDir(path.join(p, '正文')) || isDir(path.join(p, '追踪'))))
    .sort();
}

function latestDensity(projectDir) {
  if (!parseReadingPower || !densityScore) return null;
  const chs = parseReadingPower(projectDir);
  if (!chs || !chs.length) return null;
  const last = chs[chs.length - 1];
  const raws = chs.map(densityScore);
  const maxRaw = Math.max(...raws, 0.0001);
  return Math.round((densityScore(last) / maxRaw) * 100);
}

// 每章追读密度序列（0-100 归一），供 HTML 火花线使用
function densitySeries(projectDir) {
  if (!parseReadingPower || !densityScore) return null;
  const chs = parseReadingPower(projectDir);
  if (!chs || !chs.length) return null;
  const raws = chs.map(densityScore);
  const maxRaw = Math.max(...raws, 0.0001);
  return raws.map((r) => Math.round((r / maxRaw) * 100));
}

function loadBankCount(projectDir) {
  const p = path.join(projectDir, '记忆', '写法沉淀.json');
  const c = readFile(p);
  if (!c) return 0;
  try { const o = JSON.parse(c); return (o.entries || []).length; } catch { return 0; }
}

function doctorHealth(projectDir) {
  let score = 0, total = 0;
  // 结构
  for (const d of ['设定', '正文', '追踪']) { total++; if (isDir(path.join(projectDir, d))) score++; }
  for (const d of ['大纲', '.pipeline']) { total++; if (isDir(path.join(projectDir, d))) score++; }
  // 必需追踪文件
  for (const f of ['伏笔.md', '时间线.md', '角色状态.md', '上下文.md']) { total++; if (fs.existsSync(path.join(projectDir, '追踪', f))) score++; }
  // 流水线
  total++;
  if (fs.existsSync(path.join(projectDir, '.pipeline', 'state.json'))) score++;
  return { ok: score, total, pct: Math.round((score / total) * 100) };
}

function aggregate(projectDir) {
  const name = path.basename(projectDir);
  const bodyDir = path.join(projectDir, '正文');
  let chapters = 0, totalWords = 0, lastChapter = 0;
  if (isDir(bodyDir)) {
    for (const f of fs.readdirSync(bodyDir)) {
      const m = f.match(/第\s*(\d+)\s*章/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      chapters++;
      if (n > lastChapter) lastChapter = n;
      const c = readFile(path.join(bodyDir, f));
      if (c) totalWords += countWords(c);
    }
  }
  const density = latestDensity(projectDir);
  const series = densitySeries(projectDir);
  const health = doctorHealth(projectDir);
  const bank = loadBankCount(projectDir);
  const ctxMtime = mtimeMs(path.join(projectDir, '追踪', '上下文.md'));
  const bodyMtime = bodyDir ? mtimeMs(bodyDir) : 0;
  const updated = Math.max(ctxMtime, bodyMtime);
  const updatedStr = updated ? new Date(updated).toISOString().slice(0, 10) : '—';
  return { name, chapters, totalWords, lastChapter, density, series, health, bank, updated: updatedStr };
}

function sparkline(series) {
  if (!series || series.length === 0) return '<span style="color:#999;font-size:12px">无数据</span>';
  const W = 250, H = 44, pad = 4;
  const n = series.length;
  const xy = (v, i) => {
    const x = n === 1 ? W / 2 : pad + (i / (n - 1)) * (W - pad * 2);
    const y = H - pad - (v / 100) * (H - pad * 2);
    return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  };
  const pts = series.map((v, i) => xy(v, i).join(',')).join(' ');
  const last = xy(series[n - 1][0], n - 1);
  const color = series[n - 1] < 45 ? '#d23f3f' : '#2f7dd2';
  return `<svg width="${W}" height="${H}" style="display:block;margin:4px 0">
  <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>
  <circle cx="${last[0]}" cy="${last[1]}" r="3" fill="${color}"/>
</svg>`;
}

function buildHtml(rows) {
  const cards = rows.map(r => {
    const hc = r.health.pct >= 80 ? '#2f9e44' : r.health.pct >= 50 ? '#b07d2b' : '#d23f3f';
    const dc = r.density === null ? '#999' : r.density < 45 ? '#d23f3f' : '#2f7dd2';
    const barW = Math.max(2, Math.round((r.health.pct / 100) * 200));
    return `<div style="border:1px solid #eee;border-radius:10px;padding:14px 16px;margin:8px;width:300px;display:inline-block;vertical-align:top;box-shadow:0 1px 3px rgba(0,0,0,.05)">
  <div style="font-size:16px;font-weight:700;margin-bottom:6px">${r.name}</div>
  <div style="font-size:13px;color:#555;line-height:1.7">
    章节：<b>${r.chapters}</b>　最新：第${r.lastChapter}章<br>
    总字数：<b>${r.totalWords.toLocaleString()}</b><br>
    追读密度：<b style="color:${dc}">${r.density === null ? '无数据' : r.density}</b><br>
    健康度：<b style="color:${hc}">${r.health.pct}%</b>
      <span style="display:inline-block;width:200px;height:8px;background:#eee;border-radius:4px;vertical-align:middle;overflow:hidden">
        <span style="display:block;height:100%;width:${barW}px;background:${hc}"></span>
      </span>
      <span style="color:#888">（${r.health.ok}/${r.health.total}）</span><br>
    记忆沉淀：<b>${r.bank}</b> 条　更新：<span style="color:#888">${r.updated}</span>
  </div>
  <div style="font-size:12px;color:#777;margin-top:2px">追读密度曲线</div>
  ${sparkline(r.series)}
</div>`;
  }).join('');
  return `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>写作仪表盘</title>
<style>body{font-family:system-ui,"Microsoft YaHei",sans-serif;background:#fafafa;color:#222;margin:24px}h2{margin:0 0 4px}.sub{color:#888;font-size:13px}</style></head>
<body><h2>多项目写作仪表盘</h2><div class="sub">聚合 ${rows.length} 个项目 · 数据源：doctor 健康度 + 追读力 + 记忆库</div>
<div style="margin-top:12px">${cards}</div></body></html>`;
}

function main() {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const htmlIdx = argv.indexOf('--html');
  const htmlOut = htmlIdx >= 0 ? argv[htmlIdx + 1] : null;
  const filtered = argv.filter(a => !a.startsWith('--'));
  if (filtered.length === 0) {
    err('用法: node dashboard.js <根目录> [--json] [--html out.html]');
    return 1;
  }
  const root = path.resolve(filtered[0]);
  if (!isDir(root)) { err(`根目录不存在: ${root}`); return 2; }

  const projects = listProjects(root);
  if (projects.length === 0) { err(`在 ${root} 下未找到任何项目（需含 正文/ 或 追踪/ 的子目录）。`); return 2; }
  const rows = projects.map(aggregate);

  if (jsonMode) {
    console.log(JSON.stringify({ root, projects: rows }, null, 2));
    return 0;
  }

  console.log(`\n${BOLD}📊 多项目写作仪表盘${RESET} — ${root}（${rows.length} 本）\n`);
  const head = '项目'.padEnd(20) + '章节\t最新\t总字数\t追读密度\t健康度\t记忆\t更新';
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const r of rows) {
    const dens = r.density === null ? '无' : String(r.density);
    const health = `${r.health.pct}%`;
    console.log(
      r.name.slice(0, 19).padEnd(20) +
      `${r.chapters}\t第${r.lastChapter}章\t${r.totalWords.toLocaleString()}\t${dens}\t${health}\t${r.bank}\t${r.updated}`
    );
  }
  const totWords = rows.reduce((s, r) => s + r.totalWords, 0);
  const totCh = rows.reduce((s, r) => s + r.chapters, 0);
  console.log('-'.repeat(head.length));
  console.log(`${'合计'.padEnd(20)}${totCh}\t\t${totWords.toLocaleString()}`);

  if (htmlOut) {
    fs.writeFileSync(path.resolve(htmlOut), buildHtml(rows), 'utf-8');
    console.log(`\n${GREEN}[DASH]${RESET} HTML 仪表盘已写出：${htmlOut}`);
  }
  return 0;
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { err(`执行失败: ${e && e.message ? e.message : e}`); process.exit(2); }
}
module.exports = { listProjects, aggregate, buildHtml };
