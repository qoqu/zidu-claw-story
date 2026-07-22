#!/usr/bin/env node
'use strict';

/**
 * continuity-ledger.js — 跨章事实账本（确定性快筛）
 *
 * 遍历全书正文，用轻量中文模式抽取「实体 → 属性 → 值 → 章节」事实，
 * 构建事实账本，标出：
 *   - 同一实体同一属性出现多个不一致取值（矛盾候选）
 *   - 实体被标记死亡后又出现活跃动作（死亡后活跃）
 *
 * 与下列既有能力互补（不重复）：
 *   - consistency-check.js      单章 vs 追踪文件 的设定冲突
 *   - setup_consistency-checker.md   LLM 推理子代理，S1–S4 分级、规则边界/因果链/代价一致性
 * 本脚本提供【无需 LLM】的全书事实矛盾快筛，结果作为候选交人工 / LLM 子代理裁决。
 *
 * 退出码：0=通过（无矛盾候选）；2=发现矛盾候选。
 *
 * 用法：
 *   node continuity-ledger.js <项目目录> [--json]
 */

const fs = require('fs');
const path = require('path');

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RESET = '\x1b[0m', BOLD = '\x1b[1m';
const ok = (m) => console.log(`${GREEN}✓${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}⚠${RESET} ${m}`);
const err = (m) => console.error(`${RED}✗${RESET} ${m}`);

function readFile(p) { try { return fs.readFileSync(p, 'utf-8'); } catch { return null; } }
function exists(p) { return fs.existsSync(p); }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }

// 实体合法性：2–5 个汉字，且不是代词 / 误捕的动词
function validEntity(e) {
  if (!e || e.length < 2 || e.length > 5) return false;
  if (/[他她它我你其]/u.test(e)) return false;
  if (/[说问道问答喊叫笑叹息走看转身出现睁开站握开口低声死亡陨阵牺牲断气闭眼]/u.test(e)) return false;
  return true;
}

function getChapterFiles(projectDir) {
  const dir = path.join(projectDir, '正文');
  if (!isDir(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f.match(/第(\d+)章/))
    .map(f => ({ num: parseInt(f.match(/第(\d+)章/)[1], 10), file: path.join(dir, f) }))
    .sort((a, b) => a.num - b.num);
}

// 抽取单章事实
function extractFacts(text, chapterNum) {
  const facts = [];
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    let m;
    // 身份 / 称号：X 是 Y / X：Y
    const re1 = /([一-龥]{2,5})[是为：:]\s*([^，。\n]{1,20})/gu;
    while ((m = re1.exec(line))) { const e = m[1], v = m[2].trim(); if (validEntity(e)) facts.push({ entity: e, attr: 'identity', value: v, chapter: chapterNum, line: idx + 1 }); }
    // 左右手
    const re2 = /([一-龥]{2,5})的(左|右)手/gu;
    while ((m = re2.exec(line))) { const e = m[1], v = m[2] + '手'; if (validEntity(e)) facts.push({ entity: e, attr: 'handedness', value: v, chapter: chapterNum, line: idx + 1 }); }
    // 数值属性：年龄/身高/体重/年岁
    const re3 = /([一-龥]{2,5})(年龄|身高|体重|年岁)[是为：: ]?(\d+)/gu;
    while ((m = re3.exec(line))) { const e = m[1], v = m[2] + m[3]; if (validEntity(e)) facts.push({ entity: e, attr: m[2], value: v, chapter: chapterNum, line: idx + 1 }); }
    // 死亡标记
    const re4 = /([一-龥]{2,5})(死|亡|陨落|阵亡|牺牲|断气|咽了气|闭眼|殒命|身死)/gu;
    while ((m = re4.exec(line))) { const e = m[1]; if (validEntity(e)) facts.push({ entity: e, attr: 'status', value: 'dead', chapter: chapterNum, line: idx + 1 }); }
    // 存活动作
    const re5 = /([一-龥]{2,5})(说|道|问|答|喊|叫|笑|叹|走|看|转身|出现|睁开|站起|握|开口|低声)/gu;
    while ((m = re5.exec(line))) { const e = m[1]; if (validEntity(e)) facts.push({ entity: e, attr: 'status', value: 'alive', chapter: chapterNum, line: idx + 1 }); }
  });
  return facts;
}

function main() {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const filtered = argv.filter(a => a !== '--json');
  if (filtered.length === 0 || filtered[0] === '--help') {
    console.log('Usage: node continuity-ledger.js <项目目录> [--json]');
    process.exit(0);
  }
  const projectDir = path.resolve(filtered[0]);
  if (!isDir(projectDir)) { err(`项目目录不存在: ${projectDir}`); process.exit(2); }

  const chapters = getChapterFiles(projectDir);
  if (chapters.length === 0) {
    if (jsonMode) console.log(JSON.stringify({ status: 'skip', reason: '无正文章节' }, null, 2));
    else console.log('⚠️  正文/ 下无章节，跳过跨章事实账本');
    process.exit(0);
  }

  const allFacts = [];
  for (const c of chapters) {
    const t = readFile(c.file);
    if (t) allFacts.push(...extractFacts(t, c.num));
  }

  // 构建账本：key = 实体|属性
  const ledger = {};
  for (const f of allFacts) {
    const k = f.entity + '|' + f.attr;
    (ledger[k] = ledger[k] || []).push(f);
  }

  const conflicts = [];
  for (const k of Object.keys(ledger)) {
    const [entity, attr] = k.split('|');
    const entries = ledger[k];
    if (attr === 'status') {
      const dead = entries.filter(e => e.value === 'dead').map(e => e.chapter);
      const alive = entries.filter(e => e.value === 'alive').map(e => e.chapter);
      for (const d of dead) for (const a of alive) {
        if (a > d) conflicts.push({ sev: 'S1', entity, attr, desc: `第${d}章标记死亡，但第${a}章又出现活跃动作`, chapters: [d, a] });
      }
    } else {
      const vals = [...new Set(entries.map(e => e.value))];
      if (vals.length > 1) {
        const sev = (attr === 'identity' || attr === 'handedness') ? 'S2' : 'S3';
        conflicts.push({ sev, entity, attr, desc: `同一属性出现多值：${vals.join(' / ')}`, chapters: [...new Set(entries.map(e => e.chapter))] });
      }
    }
  }

  conflicts.sort((a, b) => (a.sev < b.sev ? -1 : a.sev > b.sev ? 1 : 0));

  console.log(`\n${BOLD}📒 跨章事实账本${RESET} — ${projectDir}`);
  console.log(`   扫描 ${chapters.length} 章，抽取 ${allFacts.length} 条事实，发现 ${conflicts.length} 处矛盾候选`);

  if (conflicts.length === 0) {
    ok('未发现跨章事实矛盾候选');
    if (jsonMode) console.log('\n' + JSON.stringify({ status: 'pass', chapters: chapters.length, facts: allFacts.length, conflicts: 0 }, null, 2));
    process.exit(0);
  }

  for (const c of conflicts) {
    warn(`[${c.sev}] ${c.entity} · ${c.attr} — ${c.desc}（章节：${c.chapters.join(', ')}）`);
  }
  console.log(`\n提示：以上为确定性快筛候选，建议交 references/setup_consistency-checker.md（LLM 子代理）裁决 S1–S4。`);

  if (jsonMode) console.log('\n' + JSON.stringify({ status: 'fail', chapters: chapters.length, facts: allFacts.length, conflicts }, null, 2));
  process.exit(2);
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { err(`执行失败: ${e && e.message ? e.message : e}`); process.exit(2); }
}

module.exports = { getChapterFiles, extractFacts, validEntity };
