#!/usr/bin/env node
'use strict';

/**
 * retrieval.js — 跨 references 确定性召回（零依赖 BM25，⑥②(b) 检索增强）
 *
 * 把 references/ 下全部 .md 当作文档库，按 # 标题切分成 section，
 * 对查询做 CJK 友好的 BM25 打分，返回 Top-N 命中（文件 + 标题 + 摘要）。
 *
 * 与 learn-bank（记忆/写法沉淀.json）、genre-library（references/genres/ 37 模板）、
 * genre-methodology（references/genre-* 跨题材方法论路由）dataSource 互不重叠，
 * 共同构成「确定性 RAG 式召回」的统一底座 —— 全程无向量库、无外部 API、结果可复现，
 * 符合技能「零依赖 + 确定性」铁律（不引入 webnovel 的 RAG 向量嵌入方案）。
 *
 * 零依赖：fs/path。退出码：0=成功；1=参数错误；2=执行失败。
 *
 * 用法：
 *   node retrieval.js search "<query>" [--top N] [--ref-dir D] [--json]
 *   node retrieval.js stats  [--ref-dir D]
 *   node retrieval.js index  [--ref-dir D] [--json]
 */

const fs = require('fs');
const path = require('path');
const { readFile } = require('./fs-utils');

const SD = __dirname;
const DEFAULT_REF_DIR = path.join(SD, '..', 'references'); // scripts/../references

const RED = '\x1b[31m', GREEN = '\x1b[32m', RESET = '\x1b[0m', BOLD = '\x1b[1m';
const log = (m) => console.log(`${GREEN}[RET]${RESET} ${m}`);
const err = (m) => console.error(`${RED}[ERROR]${RESET} ${m}`);

// ===== 分词：ASCII 词 + CJK 字符/二元组（无分词库的合理近似） =====
function tokenize(text) {
  if (!text) return [];
  const norm = String(text).toLowerCase();
  const tokens = [];
  const ascii = norm.match(/[a-z0-9_]+/g);
  if (ascii) tokens.push(...ascii);
  const cjkRuns = norm.match(/[一-鿿]+/g);
  if (cjkRuns) {
    for (const run of cjkRuns) {
      for (let i = 0; i < run.length; i++) {
        tokens.push(run[i]);                         // unigram
        if (i + 1 < run.length) tokens.push(run.slice(i, i + 2)); // bigram
      }
    }
  }
  return tokens;
}

// ===== 把单文件按 # 标题切成 section =====
function splitSections(absFile, text) {
  const lines = text.split('\n');
  const sections = [];
  let cur = { heading: '(文档头)', level: 0, body: [] };
  const push = () => { if (cur.body.length || cur.heading !== '(文档头)') sections.push(cur); };
  for (const ln of lines) {
    const m = ln.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) {
      push();
      cur = { heading: m[2].trim(), level: m[1].length, body: [] };
    } else {
      cur.body.push(ln);
    }
  }
  push();
  const rel = path.relative(path.join(SD, '..'), absFile).replace(/\\/g, '/');
  return sections.map((s) => ({
    file: rel,
    heading: s.heading,
    level: s.level,
    text: s.body.join('\n'),
    tokens: tokenize(s.heading + '\n' + s.body.join('\n')),
  }));
}

// ===== 递归索引整个 references 目录的 .md =====
function indexReferences(refDir = DEFAULT_REF_DIR) {
  const out = [];
  if (!fs.existsSync(refDir)) return out;
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.isFile() && e.name.endsWith('.md')) {
        const raw = readFile(fp);
        if (!raw) continue;
        const text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
        out.push(...splitSections(fp, text));
      }
    }
  };
  walk(refDir);
  return out;
}

// ===== BM25 打分 =====
function bm25Search(query, sections, opts = {}) {
  const top = opts.top || 5;
  const qTokens = tokenize(query);
  if (!qTokens.length) return [];
  const N = sections.length;
  const df = {};
  for (const s of sections) {
    const uniq = new Set(s.tokens);
    for (const t of qTokens) if (uniq.has(t)) df[t] = (df[t] || 0) + 1;
  }
  const k1 = 1.5, b = 0.75;
  const avgdl = (sections.reduce((a, s) => a + s.tokens.length, 0) / (N || 1)) || 1;
  const results = [];
  for (const s of sections) {
    const tf = {};
    for (const t of s.tokens) tf[t] = (tf[t] || 0) + 1;
    let score = 0;
    for (const qt of qTokens) {
      const f = tf[qt] || 0;
      if (!f) continue;
      const dft = df[qt] || 0;
      const idf = Math.log((N - dft + 0.5) / (dft + 0.5) + 1);
      const denom = f + k1 * (1 - b + b * (s.tokens.length / avgdl));
      score += idf * (f * (k1 + 1)) / denom;
    }
    if (score > 0) {
      results.push({ file: s.file, heading: s.heading, score: +score.toFixed(4), snippet: makeSnippet(s.text, qTokens) });
    }
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, top);
}

function makeSnippet(text, qTokens) {
  const plain = text.replace(/\s+/g, ' ').trim();
  if (plain.length <= 120) return plain;
  let idx = -1;
  for (const qt of qTokens) {
    const i = plain.indexOf(qt);
    if (i >= 0 && (idx < 0 || i < idx)) idx = i;
  }
  if (idx < 0) return plain.slice(0, 120) + '…';
  const start = Math.max(0, idx - 40);
  return (start > 0 ? '…' : '') + plain.slice(start, start + 120) + '…';
}

// ===== CLI =====
function main() {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  const refDir = (() => {
    const i = argv.indexOf('--ref-dir');
    return i >= 0 && argv[i + 1] ? path.resolve(argv[i + 1]) : DEFAULT_REF_DIR;
  })();

  if (sub === 'search') {
    const q = argv[1];
    if (!q) { err('用法: node retrieval.js search "<query>" [--top N] [--ref-dir D] [--json]'); return 1; }
    const top = (() => { const i = argv.indexOf('--top'); return i >= 0 && argv[i + 1] ? parseInt(argv[i + 1], 10) : 5; })();
    const json = argv.includes('--json');
    const sections = indexReferences(refDir);
    const hits = bm25Search(q, sections, { top });
    if (json) { console.log(JSON.stringify({ query: q, total: sections.length, hits }, null, 2)); return 0; }
    console.log(`${BOLD}# 跨 references 召回（查询「${q}」，库 ${sections.length} 段）${RESET}`);
    if (!hits.length) { console.log('（无命中）'); return 0; }
    for (const h of hits) console.log(`\n## [${h.score}] ${h.heading}\n📄 ${h.file}\n${h.snippet}`);
    return 0;
  }
  if (sub === 'stats' || sub === 'index') {
    const sections = indexReferences(refDir);
    const files = new Set(sections.map((s) => s.file));
    const json = argv.includes('--json');
    console.log(json
      ? JSON.stringify({ files: [...files], sections: sections.length }, null, 2)
      : `references 索引：文件 ${files.size} 个，section ${sections.length} 段`);
    return 0;
  }
  err('用法: node retrieval.js <search|stats|index> [options]');
  return 1;
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { err(`执行失败: ${e && e.message ? e.message : e}`); process.exit(2); }
}

module.exports = { tokenize, splitSections, indexReferences, bm25Search };
