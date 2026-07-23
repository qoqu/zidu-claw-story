#!/usr/bin/env node
'use strict';

/**
 * zidu-claw-story · 题材方法论确定性检索（T3 增量）
 * 用途：references/genre-* 是「跨题材」的写法方法论（框架/核心梗/读者/趋势/公式/技巧/文风），
 *       与 references/genres/ 的「按题材模板」互补。本脚本把它们纳入确定性检索，
 *       按管线阶段(stage) + 篇幅(len) 过滤，供开书/大纲/写作阶段自动注入对口方法论。
 * 设计：零依赖（fs/path）。纯文件名 + 手维护映射，无 embedding、无网络。结果可复现。
 * 用法：
 *   node scripts/genre-methodology.js list
 *   node scripts/genre-methodology.js route --stage outline --len long [--json]
 *   node scripts/genre-methodology.js search --kw 爽点
 *   node scripts/genre-methodology.js stats
 * 接入：开书/大纲阶段运行 `route --stage <outline|character|writing> --len <long|short>`，
 *       读取输出的绝对路径文件，作为该阶段的写法方法论上下文。
 */

const fs = require('fs');
const path = require('path');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m', red: '\x1b[31m',
};

const REF_DIR = path.join(__dirname, '..', 'references');

// 各方法论文件的作用（用于注入说明）
const PURPOSE = {
  'genre-catalog': '题材框架速查与路由（选框架/结构比例/情绪节拍）',
  'genre-core-mechanics': '核心梗三层递进 + 微创新 + 金手指匹配',
  'genre-readers': '读者心理与期待管理',
  'genre-trends': '题材趋势 / 市场风向',
  'genre-writing-formulas': '各题材写作公式',
  'genre-writing-techniques': '写作技巧',
  'genre-prose-cards': '文风卡片',
};

// 管线阶段 → 需要的「通用方法论核心文件」
const STAGE_CORES = {
  outline: ['genre-catalog', 'genre-core-mechanics', 'genre-writing-formulas', 'genre-trends'],
  character: ['genre-readers', 'genre-core-mechanics'],
  writing: ['genre-writing-techniques', 'genre-prose-cards', 'genre-writing-formulas', 'genre-core-mechanics'],
};

const VARIANT_PREFIX = { long: 'long-write', short: 'short-analyze', setup: 'setup' };

function listMethodFiles() {
  if (!fs.existsSync(REF_DIR)) return [];
  return fs.readdirSync(REF_DIR)
    .filter((f) => /^(?:(?:long-write|short-analyze|setup)_)?genre-.*\.md$/.test(f))
    .map((f) => {
      let variant = 'general', core = f.replace(/\.md$/, '');
      for (const [v, p] of Object.entries(VARIANT_PREFIX)) {
        if (f.startsWith(p + '_')) { variant = v; core = f.slice(p.length + 1).replace(/\.md$/, ''); break; }
      }
      return { file: f, core, variant, abs: path.join(REF_DIR, f) };
    })
    .sort((a, b) => a.core.localeCompare(b.core, 'zh') || a.variant.localeCompare(b.variant));
}

function resolveRoute(stage, len) {
  const cores = STAGE_CORES[stage];
  if (!cores) return null;
  const out = [];
  const seen = new Set();
  for (const core of cores) {
    const gen = core + '.md';
    if (fs.existsSync(path.join(REF_DIR, gen)) && !seen.has(gen)) {
      seen.add(gen);
      out.push({ path: path.join(REF_DIR, gen), core, variant: 'general', purpose: PURPOSE[core] || '' });
    }
    const lens = len && len !== 'all' ? [len] : Object.keys(VARIANT_PREFIX);
    for (const l of lens) {
      const pf = VARIANT_PREFIX[l] + '_' + core + '.md';
      if (fs.existsSync(path.join(REF_DIR, pf)) && !seen.has(pf)) {
        seen.add(pf);
        out.push({ path: path.join(REF_DIR, pf), core, variant: l, purpose: PURPOSE[core] || '' });
      }
    }
  }
  return out;
}

function cmdList() {
  const all = listMethodFiles();
  const byVariant = {};
  for (const m of all) (byVariant[m.variant] = byVariant[m.variant] || []).push(m);
  console.log(C.bold + `题材方法论文件（共 ${all.length} 个）` + C.reset);
  for (const v of ['general', 'long', 'short', 'setup']) {
    const arr = byVariant[v] || [];
    if (!arr.length) continue;
    console.log(C.dim + `── ${v} ──` + C.reset);
    arr.forEach((m) => console.log('  ' + C.cyan + m.core + C.reset + C.dim + '  (' + m.file + ')' + C.reset));
  }
}

function cmdRoute(stage, len, json) {
  if (!stage || !STAGE_CORES[stage]) {
    console.error(C.red + 'route 需要 --stage（outline|character|writing）' + C.reset);
    process.exit(2);
  }
  const files = resolveRoute(stage, len || 'all');
  if (json) {
    console.log(JSON.stringify({ stage, len: len || 'all', files }, null, 2));
    return;
  }
  console.log(C.bold + `题材方法论检索（stage=${stage}, len=${len || 'all'}）` + C.reset);
  const groups = { general: [], long: [], short: [], setup: [] };
  for (const f of files) groups[f.variant].push(f);
  for (const v of ['general', 'long', 'short', 'setup']) {
    if (!groups[v].length) continue;
    console.log(C.dim + `── ${v === 'general' ? '通用方法论' : v + ' 专属变体'} ──` + C.reset);
    for (const f of groups[v]) {
      console.log('  ' + C.cyan + f.path + C.reset + (f.purpose ? C.dim + '   # ' + f.purpose : '') + C.reset);
    }
  }
  console.log(C.green + `\n共 ${files.length} 个文件待读取注入。` + C.reset);
}

function scanSections(kw) {
  const k = kw.toLowerCase();
  const files = listMethodFiles().map((m) => m.abs);
  const hits = [];
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf-8').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = text.split('\n');
    let cur = '';
    let count = 0;
    for (const ln of lines) {
      const h = ln.match(/^#{1,3}\s+(.+?)\s*$/);
      if (h) cur = h[1].trim();
      if (ln.toLowerCase().includes(k)) {
        hits.push({ file: f, heading: cur });
        if (++count >= 5) break; // 每文件至多 5 处，避免噪音
      }
    }
  }
  return hits;
}

function cmdSearch(kw) {
  if (!kw) { console.error(C.red + 'search 需要 --kw 关键词' + C.reset); process.exit(2); }
  const hits = scanSections(kw);
  if (!hits.length) { console.log(C.yellow + `未找到含 "${kw}" 的方法论文档。` + C.reset); return; }
  const byFile = {};
  for (const h of hits) (byFile[h.file] = byFile[h.file] || new Set()).add(h.heading);
  console.log(C.bold + `检索 "${kw}" → ${hits.length} 处（跨 ${Object.keys(byFile).length} 个文件）：` + C.reset);
  for (const [f, hs] of Object.entries(byFile)) {
    console.log('  ' + C.cyan + path.basename(f) + C.reset + C.dim + ' :: ' + C.reset + [...hs].join(' / '));
  }
}

function cmdStats() {
  const all = listMethodFiles();
  const byVariant = {};
  for (const m of all) byVariant[m.variant] = (byVariant[m.variant] || 0) + 1;
  console.log(C.bold + '题材方法论统计（共 ' + all.length + ' 个）' + C.reset);
  for (const v of ['general', 'long', 'short', 'setup']) {
    if (byVariant[v]) console.log(`  ${v}: ${byVariant[v]}`);
  }
}

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  const getOpt = (k) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
  const stage = getOpt('--stage');
  const len = getOpt('--len');
  const kw = getOpt('--kw');
  const json = args.includes('--json');
  switch (sub) {
    case 'list': return cmdList();
    case 'route': return cmdRoute(stage, len, json);
    case 'search': return cmdSearch(kw);
    case 'stats': return cmdStats();
    default:
      console.error(C.red + '未知子命令：' + (sub || '(空)') + C.reset);
      console.error('用法：list | route --stage <outline|character|writing> [--len long|short|setup|all] [--json] | search --kw X | stats');
      process.exit(2);
  }
}

module.exports = { listMethodFiles, resolveRoute, scanSections, STAGE_CORES, PURPOSE };
if (require.main === module) main();
