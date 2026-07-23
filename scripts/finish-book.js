#!/usr/bin/env node
'use strict';

/**
 * finish-book.js — 完结门禁（确定性编排器，零依赖）
 *
 * 收尾前一键检查全书是否"可完结"：伏笔回收 / 设定缺口 / 事实矛盾 / 收尾章质量门，
 * 输出完结报告（写入 追踪/完结报告.md）并做归档备份。
 *
 * 设计原则（对齐本包"零依赖 + 确定性"铁律）：
 *   - 不重复造轮子，复用 foreshadow-check / detect-story-gaps / continuity-ledger /
 *     quality-gate 的既有检查器（execFileSync 编排）。
 *   - 每个子检查独立 try/catch 降级：缺失文件 / 解析失败 → 转为 advisory，不整门崩。
 *   - 仅"阻断项"决定可否完结；advisory 仅为收尾提示，不阻断。
 *
 * 退出码：0 = 可完结（无阻断项）；2 = 有阻断项，需先收尾修复。
 *
 * 用法：
 *   node finish-book.js <项目目录> [--json] [--no-archive]
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const USAGE = `Usage: node finish-book.js <项目目录> [--json] [--no-archive]

完结门禁：收尾前检查全书是否可完结（伏笔回收 / 设定缺口 / 事实矛盾 / 收尾章质量门），
输出完结报告并做归档备份。

选项：
  --json          输出结构化 JSON（含 blockers / advisories / checks / archive）
  --no-archive    跳过归档备份（默认会复制 设定/正文/大纲/追踪/记忆/对标 到 完结归档_<时间戳>/）

退出码：
  0 = 可完结（无阻断项）
  2 = 有阻断项，需先收尾修复`;

const SD = __dirname;
const node = process.execPath;

// 跑一个子检查并尽量解析 JSON；崩溃/解析失败均降级返回（不抛出）
function runJson(script, args) {
  try {
    const out = execFileSync(node, [path.join(SD, script), ...args], {
      encoding: 'utf-8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'],
    });
    try { return { ok: true, data: JSON.parse(out) }; } catch { return { ok: false, raw: out }; }
  } catch (e) {
    const out = ((e.stdout || '') + (e.stderr || '')).toString();
    try { return { ok: true, data: JSON.parse(out) }; } catch { return { ok: false, raw: out }; }
  }
}

// 找最新一章（用于 伏笔回收 --full 与收尾章质量门）
function findLastChapter(proj) {
  const body = path.join(proj, '正文');
  if (!fs.existsSync(body)) return null;
  let last = 0, lastFile = null;
  for (const f of fs.readdirSync(body)) {
    const m = f.match(/第\s*(\d+)\s*章/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (n > last) { last = n; lastFile = f; }
  }
  return lastFile ? path.join(body, lastFile) : null;
}

// 找最早一章（用于 伏笔回收 --full 全本扫描，确保埋设靠前的伏笔也能被 overdue 规则覆盖）
function findFirstChapter(proj) {
  const body = path.join(proj, '正文');
  if (!fs.existsSync(body)) return null;
  let first = Infinity, firstFile = null;
  for (const f of fs.readdirSync(body)) {
    const m = f.match(/第\s*(\d+)\s*章/);
    if (!m) continue;
    const n = parseInt(m[1], 10);
    if (n < first) { first = n; firstFile = f; }
  }
  return firstFile ? path.join(body, firstFile) : null;
}

function main() {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const noArchive = argv.includes('--no-archive');
  const filtered = argv.filter(a => a !== '--json' && a !== '--no-archive');

  if (filtered.length === 0 || filtered[0] === '--help') {
    console.log(USAGE);
    process.exit(0);
  }

  const proj = path.resolve(filtered[0]);
  if (!fs.existsSync(proj)) {
    console.error(`Error: 项目目录不存在: ${proj}`);
    process.exit(1);
  }

  const blockers = [];
  const advisories = [];
  const checks = [];

  // 1) 伏笔回收（foreshadow-check --full，以最早章为锚点全本扫描）
  const firstCh = findFirstChapter(proj);
  const lastCh = findLastChapter(proj);
  if (firstCh) {
    const r = runJson('foreshadow-check.js', [firstCh, proj, '--json', '--full']);
    let pending = 0, overdue = 0, total = 0;
    if (r.ok && r.data && r.data.summary) {
      pending = r.data.summary.pending || 0;
      overdue = r.data.summary.overdue || 0;
      total = r.data.summary.total || 0;
    } else if (r.raw) {
      const pm = r.raw.match(/待回收\s*(\d+)/); if (pm) pending = parseInt(pm[1], 10);
    }
    checks.push({ name: '伏笔回收', total, pending, overdue });
    if (pending > 0) blockers.push(`伏笔回收：仍有 ${pending} 条伏笔未回收（含 ${overdue} 条逾期 >50 章），完结前必须全部收束`);
  } else {
    advisories.push('未找到 正文/ 章节，跳过伏笔回收检查');
  }

  // 2) 设定缺口（detect-story-gaps）
  const g = runJson('detect-story-gaps.js', [proj, '--json']);
  let tb = 0, tw = 0;
  if (g.ok && g.data && g.data.summary) { tb = g.data.summary.totalBlocking || 0; tw = g.data.summary.totalWarnings || 0; }
  checks.push({ name: '设定缺口', totalBlocking: tb, totalWarnings: tw });
  if (tb > 0) blockers.push(`设定缺口：${tb} 个阻断缺口未填`);
  if (tw > 0) advisories.push(`设定缺口：${tw} 个警告（建议完结前回填，避免世界观漏洞）`);

  // 3) 事实矛盾（continuity-ledger，确定性快筛）
  const c = runJson('continuity-ledger.js', [proj, '--json']);
  let conflicts = 0, skipped = false;
  if (c.ok && c.data) {
    if (c.data.status === 'skip') skipped = true;
    else if (Array.isArray(c.data.conflicts)) conflicts = c.data.conflicts.length;
  }
  checks.push({ name: '事实矛盾', conflicts: skipped ? 'skip' : conflicts });
  if (conflicts > 0) blockers.push(`事实矛盾：${conflicts} 处矛盾候选（确定性快筛，建议交 consistency-checker 子代理裁决）`);
  else if (skipped) advisories.push('无正文章节，跳过事实矛盾检查');

  // 4) 收尾章质量门（quality-gate 仅对最新章，去评分/去追读避免无数据误报）
  if (lastCh) {
    const q = runJson('quality-gate.js', [lastCh, proj, '--json', '--no-score', '--skip-pacing']);
    let status = 'unknown';
    if (q.ok && q.data && q.data.status) status = q.data.status;
    checks.push({ name: '收尾章质量门', status });
    if (status === 'blocked') blockers.push('收尾章质量门禁未过（收尾章仍有阻断项，需先修复再完结）');
    else if (status === 'error' || status === 'unknown') advisories.push('收尾章质量门禁运行异常，请手动确认收尾章质量');
  } else {
    advisories.push('无收尾章，跳过收尾章质量门');
  }

  // 5) 归档备份（默认开，--no-archive 可关）
  let archivePath = null;
  if (!noArchive) {
    try {
      const ts = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
      archivePath = path.join(proj, '完结归档_' + ts);
      const srcDirs = ['设定', '正文', '大纲', '追踪', '记忆', '对标'].filter(d => fs.existsSync(path.join(proj, d)));
      fs.mkdirSync(archivePath, { recursive: true });
      for (const d of srcDirs) fs.cpSync(path.join(proj, d), path.join(archivePath, d), { recursive: true });
    } catch (e) {
      advisories.push('归档备份失败：' + (e && e.message ? e.message : e));
    }
  }

  const pass = blockers.length === 0;

  // 写 追踪/完结报告.md
  try {
    const lines = [
      '# 完结门禁报告',
      '',
      `- 项目：${proj}`,
      `- 时间：${new Date().toISOString().slice(0, 19).replace('T', ' ')}`,
      `- 结论：${pass ? '✅ 可完结（无阻断项）' : '⛔ 不可完结（存在阻断项）'}`,
      '',
      '## 检查结果',
      ...checks.map(c => `- ${c.name}：${JSON.stringify(c)}`),
      '',
      '## 阻断项（完结前必须修复）',
      blockers.length ? blockers.map((b, i) => `${i + 1}. ${b}`).join('\n') : '（无）',
      '',
      '## 提示（非阻断）',
      advisories.length ? advisories.map((a, i) => `${i + 1}. ${a}`).join('\n') : '（无）',
      '',
      archivePath ? `## 归档备份\n${archivePath}` : '（未归档）',
    ];
    const trackDir = path.join(proj, '追踪');
    if (!fs.existsSync(trackDir)) fs.mkdirSync(trackDir, { recursive: true });
    fs.writeFileSync(path.join(trackDir, '完结报告.md'), lines.join('\n') + '\n', 'utf-8');
  } catch { /* 报告写入失败不阻断门禁 */ }

  if (jsonMode) {
    console.log(JSON.stringify({ status: pass ? 'ready' : 'blocked', blockers, advisories, checks, archive: archivePath }, null, 2));
    process.exit(pass ? 0 : 2);
  }

  console.log('📕 完结门禁报告');
  console.log('='.repeat(50));
  console.log(`项目：${proj}`);
  for (const c of checks) console.log(`  • ${c.name}：${JSON.stringify(c)}`);
  if (archivePath) console.log(`🗄 已归档备份：${archivePath}`);
  console.log('='.repeat(50));

  if (blockers.length > 0) {
    console.log('\n🚫 阻断项（完结前必须修复）：');
    blockers.forEach((b, i) => console.log(`  ${i + 1}. ${b}`));
  }
  if (advisories.length > 0) {
    console.log('\n⚠️ 提示（非阻断）：');
    advisories.forEach((a, i) => console.log(`  ${i + 1}. ${a}`));
  }

  if (pass) {
    console.log('\n✅ 无阻断项，可完结。');
    console.log('   收尾建议：人物结局 / 坑线回收 / 世界观闭合已在上方核对；完结后可用 `promo-pack.js` 做番外 / 完本运营物料。');
    console.log('   完结报告已写入 追踪/完结报告.md');
    process.exit(0);
  } else {
    console.log('\n⛔ 存在阻断项，先修复再完结。');
    process.exit(2);
  }
}

if (require.main === module) main();
