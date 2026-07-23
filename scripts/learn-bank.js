#!/usr/bin/env node
'use strict';

/**
 * learn-bank.js — 长期记忆沉淀库（LLM 供给，脚本存读）
 *
 * 角色：持久化 + 检索「好用的写法」。实际「从正文抽取好写法」由 AI(LLM) 完成，
 * 本脚本只负责结构化存储（记忆/写法沉淀.json）与按 tag / 关键词 检索，
 * 供新章任务书注入（越写越香、不糊）。
 *
 * 零依赖：fs/path。
 * 退出码：0=成功；1=参数错误；2=文件操作失败。
 *
 * 用法：
 *   node learn-bank.js <项目目录> add   --type 爽点套路 --content "..." [--tags "a,b"] [--chapter N] [--source "第N章"]
 *   node learn-bank.js <项目目录> list  [--type X] [--limit N]
 *   node learn-bank.js <项目目录> query [--type X] [--tag T] [--kw "..."] [--limit N]
 *   node learn-bank.js <项目目录> export [--md]
 *   node learn-bank.js <项目目录> stats
 */

const fs = require('fs');
const path = require('path');
const { readFile, readJson, writeJsonAtomic } = require('./fs-utils');

const BANK_DIR = '记忆';
const BANK_FILE = '写法沉淀.json';

const RED = '\x1b[31m', GREEN = '\x1b[32m', RESET = '\x1b[0m', BOLD = '\x1b[1m';
const log = (m) => console.log(`${GREEN}[BANK]${RESET} ${m}`);
const err = (m) => console.error(`${RED}[ERROR]${RESET} ${m}`);

function bankPath(projectDir) { return path.join(projectDir, BANK_DIR, BANK_FILE); }
function loadBank(projectDir) {
  const o = readJson(bankPath(projectDir));
  if (!o || !o.entries) return { schema: 'zidu-learn-bank/v1', entries: [] };
  return o;
}
function saveBank(projectDir, bank) {
  writeJsonAtomic(bankPath(projectDir), bank);
}
let _seq = 0;
function genId() { return 'LB' + Date.now().toString(36) + (_seq++).toString(36); }

function getOpt(args, name) {
  const i = args.indexOf('--' + name);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return undefined;
}

// ===== add =====
function doAdd(projectDir, rest) {
  const type = getOpt(rest, 'type');
  const content = getOpt(rest, 'content');
  if (!type || !content) { err('需提供 --type 与 --content'); return 1; }
  const tags = (getOpt(rest, 'tags') || '').split(',').map(s => s.trim()).filter(Boolean);
  const chapter = parseInt(getOpt(rest, 'chapter') || '0', 10);
  const source = getOpt(rest, 'source') || '';
  const bank = loadBank(projectDir);
  const entry = { id: genId(), type, content, tags, chapter, source, createdAt: new Date().toISOString() };
  bank.entries.push(entry);
  saveBank(projectDir, bank);
  log(`已沉淀：${type} — ${content.slice(0, 40)}${content.length > 40 ? '…' : ''}`);
  return 0;
}

// ===== list =====
function doList(projectDir, rest) {
  const bank = loadBank(projectDir);
  let es = bank.entries;
  const type = getOpt(rest, 'type');
  if (type) es = es.filter(e => e.type === type);
  const limit = parseInt(getOpt(rest, 'limit') || '0', 10);
  if (limit > 0) es = es.slice(-limit);
  if (es.length === 0) { console.log('（记忆库为空）'); return 0; }
  for (const e of es) console.log(`[${e.type}] ${e.tags.length ? '#' + e.tags.join(' #') + ' ' : ''}(第${e.chapter || '?'}章) ${e.content}`);
  return 0;
}

// ===== query（供新章任务书注入） =====
function doQuery(projectDir, rest) {
  const bank = loadBank(projectDir);
  const type = getOpt(rest, 'type');
  const tag = getOpt(rest, 'tag');
  const kw = getOpt(rest, 'kw');
  let es = bank.entries;
  if (type) es = es.filter(e => e.type === type);
  if (tag) es = es.filter(e => e.tags.includes(tag));
  if (kw) es = es.filter(e => e.content.includes(kw));
  const limit = parseInt(getOpt(rest, 'limit') || '0', 10);
  if (limit > 0) es = es.slice(-limit);
  console.log(`${BOLD}# 记忆召回（${es.length} 条，供新章任务书注入）${RESET}`);
  if (es.length === 0) { console.log('（无匹配）'); return 0; }
  const byType = {};
  for (const e of es) (byType[e.type] = byType[e.type] || []).push(e);
  for (const t of Object.keys(byType)) {
    console.log(`\n## ${t}`);
    for (const e of byType[t]) console.log(`- ${e.content} ${e.tags.length ? '#' + e.tags.join(' #') : ''}（第${e.chapter || '?'}章）`);
  }
  return 0;
}

// ===== export =====
function doExport(projectDir, rest) {
  const bank = loadBank(projectDir);
  if (rest.includes('--md')) {
    let md = '# 写法沉淀库\n\n';
    const byType = {};
    for (const e of bank.entries) (byType[e.type] = byType[e.type] || []).push(e);
    for (const t of Object.keys(byType)) {
      md += `## ${t}\n`;
      for (const e of byType[t]) md += `- ${e.content} ${e.tags.length ? '#' + e.tags.join(' #') : ''}（第${e.chapter || '?'}章）\n`;
      md += '\n';
    }
    console.log(md);
  } else {
    console.log(JSON.stringify(bank, null, 2));
  }
  return 0;
}

// ===== stats =====
function doStats(projectDir) {
  const bank = loadBank(projectDir);
  const byType = {};
  for (const e of bank.entries) byType[e.type] = (byType[e.type] || 0) + 1;
  console.log(`记忆库共 ${bank.entries.length} 条：`);
  for (const t of Object.keys(byType)) console.log(`  ${t}：${byType[t]}`);
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2 || argv[1] === '--help') {
    err('用法: node learn-bank.js <项目目录> <add|list|query|export|stats> [options]');
    return 1;
  }
  const projectDir = argv[0];
  const command = argv[1];
  const rest = argv.slice(2);
  if (!fs.existsSync(projectDir)) { err(`项目目录不存在: ${projectDir}`); return 1; }

  switch (command) {
    case 'add': return doAdd(projectDir, rest);
    case 'list': return doList(projectDir, rest);
    case 'query': return doQuery(projectDir, rest);
    case 'export': return doExport(projectDir, rest);
    case 'stats': return doStats(projectDir);
    default: err(`未知命令: ${command}`); return 1;
  }
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { err(`执行失败: ${e && e.message ? e.message : e}`); process.exit(2); }
}

module.exports = { loadBank, doAdd, doList, doQuery, doExport, doStats };
