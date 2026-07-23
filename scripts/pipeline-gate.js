#!/usr/bin/env node
'use strict';

/**
 * pipeline-gate.js — WB 原生步骤闸门 + 质检调度
 *
 * 步骤闸门 + 质检调度（替代早期 15 个 step-guard.js 的预/后置校验）。
 * 去除了早期宿主专有契约（.workflow/ 目录 + 各 skill 私有 JSON 产物名），
 * 改用 WB 原生约定：
 *   - 状态存于项目目录下的 `.pipeline/state.json`
 *   - 步骤有序：每个步骤有 requires（前置步骤必须 done）与可选 artifact（后置产物路径）
 *   - 退出码：0=通过，1=阻断（前置不满足 / 产物缺失）
 *
 * 同时提供 `qa` 子命令，复用同目录的 quality-gate.js
 * 作为硬阻断质检（透传其 exit 2 / 3 门禁语义）。
 *
 * 适用场景：WorkBuddy 是 prompt 驱动的 AI agent，无自动 hook，因此本脚本
 * 由 AI / 用户在流程的明确时机**手动调用**，提供客观、可证伪的闸门判定，
 * 弥补「AI 凭记忆容易跳步 / 漏检」的问题。
 *
 * 用法：
 *   node pipeline-gate.js status <project-dir>
 *   node pipeline-gate.js gate pre  <step> <project-dir> [--chapter N]
 *   node pipeline-gate.js gate post <step> <project-dir> [--chapter N]
 *   node pipeline-gate.js qa <chapter-file> <project-dir> [--quality-gate PATH] [--genre ...] [--threshold N] [...]
 *
 * 内置 WB 长篇写作默认流水线步骤（对应长篇写作默认流程）：
 *   read  (读细纲/上一章)  requires: []            artifact: 大纲/细纲_第{{N}}章.md
 *   write (写正文)          requires: [read]        artifact: 正文/第{{N}}章.md
 *   qa    (质量门禁)        requires: [write]       artifact: none（由 quality-gate 判定）
 *   track  (更新追踪)        requires: [qa]          artifact: 追踪/上下文.md
 * 自定义流水线：在项目目录放 `.pipeline/steps.json`，覆盖 DEFAULT_STEPS。
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { readJson, writeJsonAtomic } = require('./fs-utils');

const PIPELINE_DIR = '.pipeline';
const STATE_FILE = 'state.json';
const STEPS_FILE = 'steps.json';

// 内置默认流水线（WB 长篇写作）
const DEFAULT_STEPS = {
  read:  { requires: [],                artifact: '大纲/细纲_第{{N}}章.md' },
  write: { requires: ['read'],         artifact: '正文/第{{N}}章.md' },
  qa:    { requires: ['write'],        artifact: null },
  track: { requires: ['qa'],           artifact: '追踪/上下文.md' },
};

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const log = (m) => console.log(`${GREEN}[GATE]${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}[WARN]${RESET} ${m}`);
const err = (m) => console.error(`${RED}[BLOCK]${RESET} ${m}`);

function fileExists(p) { return fs.existsSync(p); }

function pipelineDir(projectDir) { return path.join(projectDir, PIPELINE_DIR); }
function statePath(projectDir) { return path.join(pipelineDir(projectDir), STATE_FILE); }
function stepsPath(projectDir) { return path.join(pipelineDir(projectDir), STEPS_FILE); }

function loadSteps(projectDir) {
  const sp = stepsPath(projectDir);
  if (fileExists(sp)) {
    const custom = readJson(sp);
    if (custom && typeof custom === 'object') return custom;
  }
  return DEFAULT_STEPS;
}
function loadState(projectDir) {
  const sp = statePath(projectDir);
  const s = readJson(sp) || { steps: {}, currentChapter: 0 };
  if (!s.steps) s.steps = {};
  return s;
}
function saveState(projectDir, state) { writeJsonAtomic(statePath(projectDir), state); }

// 从 追踪/上下文.md 解析最新章节
function getContextChapter(projectDir) {
  const ctx = path.join(projectDir, '追踪', '上下文.md');
  if (!fileExists(ctx)) return 0;
  const t = fs.readFileSync(ctx, 'utf-8');
  const m = t.match(/最后完成章节[：:]\s*第\s*(\d+)\s*章/);
  return m ? parseInt(m[1], 10) : 0;
}
function resolveChapter(projectDir, argN) {
  if (argN) return parseInt(argN, 10);
  const st = loadState(projectDir);
  if (st.currentChapter) return st.currentChapter;
  return getContextChapter(projectDir);
}
function resolveChapterFromPath(chapterFile) {
  const m = path.basename(chapterFile, '.md').match(/第(\d+)章/);
  return m ? parseInt(m[1], 10) : 0;
}
function fillTpl(tpl, chapterNum) {
  const n3 = String(chapterNum).padStart(3, '0');
  return tpl.replace(/\{\{N\}\}/g, n3).replace(/\{\{n\}\}/g, String(chapterNum));
}

// ===== 自动备份 + 断点续跑（借鉴 webnovel-writer 思路，WB 原生纯 Node 重写） =====
const crypto = require('crypto');
const LEDGER_FILE = 'run_ledger.json';
function ledgerPath(projectDir) { return path.join(pipelineDir(projectDir), LEDGER_FILE); }
function loadLedger(projectDir) {
  const l = readJson(ledgerPath(projectDir));
  if (!l) return { schema_version: 'zidu-run-ledger/v1', write: {} };
  if (!l.write) l.write = {};
  return l;
}
function saveLedger(projectDir, ledger) { writeJsonAtomic(ledgerPath(projectDir), ledger); }
function chKey(n) { return `chapter_${String(n).padStart(3, '0')}`; }
function sha256File(p) {
  try { return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch { return null; }
}
// 在 gate post 成功时记录步骤（供断点续跑判断）
function recordStep(projectDir, chapterNum, step, artifactPath) {
  const ledger = loadLedger(projectDir);
  const key = chKey(chapterNum);
  if (!ledger.write[key]) ledger.write[key] = { steps: {} };
  if (!ledger.write[key].steps) ledger.write[key].steps = {};
  ledger.write[key].steps[step] = {
    status: 'completed',
    at: new Date().toISOString(),
    sig: artifactPath ? sha256File(path.join(projectDir, artifactPath)) : undefined,
  };
  saveLedger(projectDir, ledger);
}
// 返回第一个未完成的步骤名，或 'done'
function resumeFrom(projectDir, chapterNum) {
  const ledger = loadLedger(projectDir);
  const steps = (ledger.write[chKey(chapterNum)] || {}).steps || {};
  const order = Object.keys(loadSteps(projectDir));
  for (const s of order) {
    if (!steps[s] || steps[s].status !== 'completed') return s;
  }
  return 'done';
}
// 每章写完后自动备份（轮转保留最近 10 份）
function doBackup(projectDir, chapterNum) {
  const backupRoot = path.join(pipelineDir(projectDir), 'backups');
  fs.mkdirSync(backupRoot, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const name = `snapshot_ch${String(chapterNum).padStart(4, '0')}_${ts}`;
  const dest = path.join(backupRoot, name);
  fs.mkdirSync(dest, { recursive: true });
  for (const f of ['正文', '大纲', '设定']) {
    const src = path.join(projectDir, f);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dest, f), { recursive: true });
  }
  const stateSrc = statePath(projectDir);
  if (fs.existsSync(stateSrc)) fs.copyFileSync(stateSrc, path.join(dest, 'state.json'));
  const snaps = fs.readdirSync(backupRoot).filter(x => x.startsWith('snapshot_ch')).sort();
  for (const old of snaps.slice(0, -10)) {
    fs.rmSync(path.join(backupRoot, old), { recursive: true, force: true });
  }
  log(`自动备份：第${chapterNum}章 → .pipeline/backups/${name}（保留最近 ${Math.min(snaps.length, 10)} 份）`);
  return 0;
}
// 断点续跑：打印从哪步继续
function doResume(projectDir, chapterNum) {
  const from = resumeFrom(projectDir, chapterNum);
  const steps = (loadLedger(projectDir).write[chKey(chapterNum)] || {}).steps || {};
  log(`第${chapterNum}章续跑断点：${from === 'done' ? '已全部完成' : '从「' + from + '」步继续'}`);
  for (const s of Object.keys(loadSteps(projectDir))) {
    const ok = steps[s] && steps[s].status === 'completed';
    console.log(`  ${s.padEnd(6)} ${ok ? '[✓]' : '[ ]'}`);
  }
  if (from !== 'done') console.log(`\n> 请从 ${from} 步重新执行流水线（recordStep 会重记该步）。`);
  return 0;
}

// ===== status =====
function doStatus(projectDir) {
  const steps = loadSteps(projectDir);
  const state = loadState(projectDir);
  log('流水线状态：');
  const names = Object.keys(steps);
  for (const name of names) {
    const done = state.steps[name];
    const mark = done ? `${GREEN}✓ done${RESET}` : `${YELLOW}· pending${RESET}`;
    const req = (steps[name].requires || []).join(', ') || '—';
    console.log(`  ${name.padEnd(6)} ${mark}  前置: ${req}`);
  }
  const ctxCh = getContextChapter(projectDir);
  console.log(`  上下文进度：第${ctxCh}章`);
  if (!fileExists(pipelineDir(projectDir))) {
    warn('尚未初始化流水线状态（.pipeline/ 不存在）。首次 gate post 会自动创建。');
  }
  return 0;
}

// ===== gate =====
function doGate(action, step, projectDir, chapterArg) {
  const steps = loadSteps(projectDir);
  const state = loadState(projectDir);

  if (!steps[step]) {
    warn(`步骤 "${step}" 不在流水线定义中（已知：${Object.keys(steps).join(', ')}）。按无约束放行。`);
    return 0;
  }

  const def = steps[step];
  const requires = def.requires || [];

  // 校验前置步骤是否完成
  for (const r of requires) {
    if (!state.steps[r]) {
      err(`前置步骤未完成：${r}（需先 gate post ${r}）`);
      return 1;
    }
  }

  if (action === 'pre') {
    if (!fileExists(projectDir)) { err(`项目目录不存在: ${projectDir}`); return 1; }
    log(`前置验证通过：Step ${step}（可执行）`);
    return 0;
  }

  // post：校验后置产物到位
  if (def.artifact) {
    const chapterNum = resolveChapter(projectDir, chapterArg);
    const artifactPath = path.join(projectDir, fillTpl(def.artifact, chapterNum));
    if (!fileExists(artifactPath)) {
      err(`后置产物缺失：期望 ${artifactPath}`);
      return 1;
    }
    log(`后置产物到位：${def.artifact.replace('{{N}}', String(chapterNum))}`);
  }

  // 标记完成
  state.steps[step] = true;
  if (chapterArg) state.currentChapter = parseInt(chapterArg, 10);
  saveState(projectDir, state);
  // 同步记录到 run_ledger（断点续跑用）
  try {
    const chNum = chapterArg ? parseInt(chapterArg, 10) : (state.currentChapter || 0);
    const artPath = def.artifact ? fillTpl(def.artifact, chNum || 0) : null;
    if (chNum) recordStep(projectDir, chNum, step, artPath);
  } catch (_) { /* ledger 失败不影响主流程 */ }
  log(`Step ${step} 完成，已写入 .pipeline/state.json`);
  return 0;
}

// ===== qa（复用 quality-gate.js） =====
function locateQualityGate(explicit) {
  if (explicit) return explicit;
  if (process.env.QUALITY_GATE_JS) return process.env.QUALITY_GATE_JS;
  // 整合版：quality-gate.js 与本脚本同目录 scripts/
  const sameDir = path.join(__dirname, 'quality-gate.js');
  if (fileExists(sameDir)) return sameDir;
  return null;
}

function doQa(chapterFile, projectDir, qualityGateArg, passthrough, chapterArg) {
  const qg = locateQualityGate(qualityGateArg);
  if (!qg) {
    err('找不到 quality-gate.js。请通过 --quality-gate PATH 指定，或设置环境变量 QUALITY_GATE_JS。');
    return 1;
  }
  if (!fileExists(qg)) { err(`quality-gate.js 不存在: ${qg}`); return 1; }
  const args = [qg, chapterFile, projectDir, '--json', ...(passthrough || [])];
  log(`调用质量门禁：${path.basename(qg)}`);
  try {
    const out = execFileSync('node', args, { encoding: 'utf-8', timeout: 120000, stdio: ['pipe', 'pipe', 'pipe'] });
    if (out && out.trim()) console.log(out.trim());
    // 质量通过 → 自动标记 qa 完成（门禁语义：不通过绝不放行）
    try {
      const chapterNum = resolveChapterFromPath(chapterFile) || (chapterArg ? parseInt(chapterArg, 10) : getContextChapter(projectDir));
      doGate('post', 'qa', projectDir, chapterNum ? String(chapterNum) : undefined);
    } catch (_) { /* 不影响主退出码 */ }
    return 0; // quality-gate 自身未阻断（exit 0）
  } catch (e) {
    const code = e.status;
    if (e.stdout && e.stdout.trim()) console.log(e.stdout.trim());
    if (e.stderr && e.stderr.trim()) console.error(e.stderr.trim());
    if (code === 2) { err('质量门禁：阻断（存在硬检查未过，必须先修复再继续）'); return 2; }
    if (code === 3) { err('质量门禁：评分低于阈值（建议回炉提质后重评）'); return 3; }
    err(`质量门禁执行异常（exit ${code === null ? 'timeout' : code}）`);
    return code || 1;
  }
}

// ===== CLI =====
function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 1) {
    err('用法: node pipeline-gate.js <status|gate|qa> ...');
    return 1;
  }
  const sub = argv[0];

  if (sub === 'status') {
    const projectDir = argv[1];
    if (!projectDir || !fileExists(projectDir)) { err('需提供有效的 <project-dir>'); return 1; }
    return doStatus(projectDir);
  }

  if (sub === 'gate') {
    const action = argv[1];
    const step = argv[2];
    const projectDir = argv[3];
    if (!action || !step || !projectDir) { err('用法: gate <pre|post> <step> <project-dir> [--chapter N]'); return 1; }
    if (!fileExists(projectDir)) { err(`项目目录不存在: ${projectDir}`); return 1; }
    const chapterArg = (() => { const i = argv.indexOf('--chapter'); return i >= 0 ? argv[i + 1] : undefined; })();
    if (action === 'pre' || action === 'post') {
      return doGate(action, step, projectDir, chapterArg);
    }
    err(`未知 gate 动作: ${action}（应为 pre 或 post）`);
    return 1;
  }

  if (sub === 'backup') {
    const projectDir = argv[1];
    const chIdx = argv.indexOf('--chapter');
    const chapterNum = chIdx >= 0 ? parseInt(argv[chIdx + 1], 10) : getContextChapter(projectDir);
    if (!projectDir || !fileExists(projectDir)) { err('需提供有效的 <project-dir>'); return 1; }
    if (!chapterNum) { err('缺少 --chapter N'); return 1; }
    return doBackup(projectDir, chapterNum);
  }

  if (sub === 'resume') {
    const projectDir = argv[1];
    const chIdx = argv.indexOf('--chapter');
    const chapterNum = chIdx >= 0 ? parseInt(argv[chIdx + 1], 10) : getContextChapter(projectDir);
    if (!projectDir || !fileExists(projectDir)) { err('需提供有效的 <project-dir>'); return 1; }
    if (!chapterNum) { err('缺少 --chapter N'); return 1; }
    return doResume(projectDir, chapterNum);
  }

  if (sub === 'qa') {
    const chapterFile = argv[1];
    const projectDir = argv[2];
    if (!chapterFile || !projectDir) { err('用法: qa <chapter-file> <project-dir> [--quality-gate PATH] [...]'); return 1; }
    if (!fileExists(chapterFile)) { err(`章节文件不存在: ${chapterFile}`); return 1; }
    if (!fileExists(projectDir)) { err(`项目目录不存在: ${projectDir}`); return 1; }
    const qgIdx = argv.indexOf('--quality-gate');
    const qgArg = qgIdx >= 0 ? argv[qgIdx + 1] : undefined;
    const passthrough = argv.filter((a, i) => i > 2 && a !== '--quality-gate' && a !== '--chapter' && (qgIdx < 0 || i !== qgIdx + 1));
    const chIdx = argv.indexOf('--chapter');
    const chapterArg = chIdx >= 0 ? argv[chIdx + 1] : undefined;
    return doQa(chapterFile, projectDir, qgArg, passthrough, chapterArg);
  }

  err(`未知子命令: ${sub}`);
  return 1;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (e) {
    err(`执行失败: ${e && e.message ? e.message : e}`);
    process.exit(1);
  }
}

module.exports = { loadSteps, loadState, doGate, doQa, doStatus, DEFAULT_STEPS, doBackup, doResume, loadLedger, resumeFrom };
