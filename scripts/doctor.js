#!/usr/bin/env node
'use strict';

/**
 * doctor.js — zidu-claw-story 项目体检（统一健康入口）
 *
 * 检查项：
 *   1. 顶层结构：设定/大纲/正文/追踪/.pipeline 是否存在
 *   2. 追踪文件齐全度（必需/可选）
 *   3. 流水线状态 .pipeline/state.json（read/write/qa/track 覆盖）
 *   4. 自动备份新鲜度（.pipeline/backups 最新快照 mtime）
 *   5. （可选子检查，默认开）最新章一致性 consistency-check.js + 角色同步 character-sync.js
 *
 * 设计：结构性 / 流水线 / 备份 自检；最新章一致性与角色同步委托既有脚本，
 * 避免重复实现。零依赖（fs/path/child_process）。
 *
 * 退出码：0=健康；1=仅警告（可继续）；2=有阻断级错误。
 *
 * 用法：
 *   node doctor.js <项目目录> [--json] [--no-subchecks]
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RED = '\x1b[31m', GREEN = '\x1b[32m', YELLOW = '\x1b[33m', RESET = '\x1b[0m', BOLD = '\x1b[1m';
const ok = (m) => console.log(`${GREEN}✓${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}⚠${RESET} ${m}`);
const err = (m) => console.error(`${RED}✗${RESET} ${m}`);
const info = (m) => console.log(`  ${m}`);

function readFile(p) { try { return fs.readFileSync(p, 'utf-8'); } catch { return null; } }
function readJson(p) { try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { return null; } }
function exists(p) { return fs.existsSync(p); }
function isDir(p) { try { return fs.statSync(p).isDirectory(); } catch { return false; } }
function mtimeMs(p) { try { return fs.statSync(p).mtimeMs; } catch { return 0; } }

const TRACK_REQUIRED = ['伏笔.md', '时间线.md', '角色状态.md', '上下文.md'];
const TRACK_OPTIONAL = ['物品.md', '环境.md', '物资.md', '重复语句.md', '追读力.md'];

function findLatestChapter(projectDir) {
  const dir = path.join(projectDir, '正文');
  if (!isDir(dir)) return null;
  let max = 0, file = null;
  for (const f of fs.readdirSync(dir)) {
    const m = f.match(/第(\d+)章/);
    if (m) { const n = parseInt(m[1], 10); if (n > max) { max = n; file = path.join(dir, f); } }
  }
  return file ? { num: max, file } : null;
}

function checkStructure(projectDir, problems) {
  const required = ['设定', '正文', '追踪'];
  const optional = ['大纲', '.pipeline'];
  for (const d of required) {
    if (!isDir(path.join(projectDir, d))) problems.push({ level: 2, msg: `缺少必需目录：${d}/` });
    else ok(`目录存在：${d}/`);
  }
  for (const d of optional) {
    if (!isDir(path.join(projectDir, d))) problems.push({ level: 1, msg: `缺少可选目录：${d}/（可由 gate post 自动创建）` });
    else ok(`目录存在：${d}/`);
  }
}

function checkTracking(projectDir, problems) {
  const dir = path.join(projectDir, '追踪');
  if (!isDir(dir)) { problems.push({ level: 2, msg: '追踪/ 目录不存在' }); return; }
  for (const f of TRACK_REQUIRED) {
    const fp = path.join(dir, f);
    if (!exists(fp)) problems.push({ level: 1, msg: `追踪文件缺失（必需）：${f}` });
    else {
      const c = readFile(fp);
      if (!c || !c.trim()) problems.push({ level: 1, msg: `追踪文件为空：${f}` });
      else ok(`追踪文件存在：${f}`);
    }
  }
  for (const f of TRACK_OPTIONAL) {
    const fp = path.join(dir, f);
    if (!exists(fp)) problems.push({ level: 0, msg: `追踪文件缺失（可选）：${f}` });
  }
}

function checkPipeline(projectDir, problems) {
  const sp = path.join(projectDir, '.pipeline', 'state.json');
  if (!exists(sp)) { problems.push({ level: 1, msg: '.pipeline/state.json 不存在（流水线尚未初始化，首次 gate post 会创建）' }); return; }
  const s = readJson(sp);
  if (!s || !s.steps) { ok('.pipeline/state.json 存在（无步骤标记）'); return; }
  for (const st of ['read', 'write', 'qa', 'track']) {
    if (s.steps[st]) ok(`流水线步骤标记完成：${st}`);
    else problems.push({ level: 0, msg: `流水线步骤未标记完成：${st}` });
  }
}

function checkBackups(projectDir, problems) {
  const root = path.join(projectDir, '.pipeline', 'backups');
  if (!isDir(root)) { problems.push({ level: 1, msg: '.pipeline/backups/ 不存在（尚未产生任何备份）' }); return; }
  const snaps = fs.readdirSync(root).filter(x => x.startsWith('snapshot_ch') && isDir(path.join(root, x))).sort();
  if (snaps.length === 0) { problems.push({ level: 1, msg: '备份目录为空（尚未产生任何快照）' }); return; }
  const latest = snaps[snaps.length - 1];
  const ageMs = Date.now() - mtimeMs(path.join(root, latest));
  const ageDays = Math.floor(ageMs / 86400000);
  ok(`最新备份：${latest}（${ageDays} 天前，共 ${snaps.length} 份）`);
  if (ageDays > 14) problems.push({ level: 1, msg: `最新备份已 ${ageDays} 天未更新（建议写章后跑 pipeline-gate backup）` });
}

function runSubcheck(scriptRel, args, problems, label) {
  const script = path.join(__dirname, scriptRel);
  if (!exists(script)) { problems.push({ level: 1, msg: `子检查脚本缺失，跳过：${scriptRel}` }); return; }
  try {
    const out = execFileSync('node', [script, ...args], { encoding: 'utf-8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] });
    if (out && out.trim()) console.log(out.trim());
    ok(`子检查通过：${label}`);
  } catch (e) {
    const code = e.status;
    if (e.stdout && e.stdout.trim()) console.log(e.stdout.trim());
    if (e.stderr && e.stderr.trim()) console.error(e.stderr.trim());
    if (code === 2) problems.push({ level: 1, msg: `子检查发现需处理的问题：${label}` });
    else if (code) problems.push({ level: 1, msg: `子检查异常（exit ${code}）：${label}` });
  }
}

function main() {
  const argv = process.argv.slice(2);
  const jsonMode = argv.includes('--json');
  const noSub = argv.includes('--no-subchecks');
  const filtered = argv.filter(a => a !== '--json' && a !== '--no-subchecks');
  if (filtered.length === 0 || filtered[0] === '--help') {
    console.log('Usage: node doctor.js <项目目录> [--json] [--no-subchecks]');
    process.exit(0);
  }
  const projectDir = path.resolve(filtered[0]);
  if (!isDir(projectDir)) { err(`项目目录不存在: ${projectDir}`); process.exit(2); }

  const problems = [];
  console.log(`\n${BOLD}🩺 zidu-claw-story 项目体检${RESET} — ${projectDir}\n`);

  console.log(`${BOLD}1. 结构完整性${RESET}`);
  checkStructure(projectDir, problems);
  console.log(`\n${BOLD}2. 追踪文件齐全度${RESET}`);
  checkTracking(projectDir, problems);
  console.log(`\n${BOLD}3. 流水线状态${RESET}`);
  checkPipeline(projectDir, problems);
  console.log(`\n${BOLD}4. 自动备份新鲜度${RESET}`);
  checkBackups(projectDir, problems);

  if (!noSub) {
    console.log(`\n${BOLD}5. 子检查（委托既有脚本）${RESET}`);
    const latest = findLatestChapter(projectDir);
    if (latest) {
      info(`最新章：第${latest.num}章`);
      runSubcheck('consistency-check.js', [latest.file, projectDir, '--json'], problems, '最新章一致性(consistency-check)');
      runSubcheck('character-sync.js', [projectDir, '--json'], problems, '角色同步(character-sync)');
    } else {
      info('尚无正文章节，跳过最新章子检查');
    }
  }

  const errors = problems.filter(p => p.level === 2);
  const warns = problems.filter(p => p.level === 1);
  const notes = problems.filter(p => p.level === 0);

  console.log(`\n${BOLD}── 体检结论 ──${RESET}`);
  if (errors.length === 0 && warns.length === 0 && notes.length === 0) { ok('一切健康，无问题。'); }
  else {
    for (const p of errors) err(p.msg);
    for (const p of warns) warn(p.msg);
    for (const p of notes) info(p.msg);
  }
  console.log(`\n统计：${errors.length} 错误 / ${warns.length} 警告 / ${notes.length} 提示`);

  if (jsonMode) {
    console.log('\n' + JSON.stringify({ status: errors.length ? 'fail' : 'pass', errors: errors.length, warns: warns.length, problems }, null, 2));
  }

  process.exit(errors.length > 0 ? 2 : (warns.length > 0 ? 1 : 0));
}

if (require.main === module) {
  try { process.exit(main()); }
  catch (e) { err(`执行失败: ${e && e.message ? e.message : e}`); process.exit(2); }
}

module.exports = { findLatestChapter, checkStructure, checkTracking, checkPipeline, checkBackups };
