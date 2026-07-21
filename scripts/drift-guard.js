#!/usr/bin/env node
/**
 * drift-guard.js — 写作实时风格护栏（单章触发封装）
 * 零依赖，接力 style-drift.js。写完一章跑一次，只聚焦"最新章"是否文风漂移，
 * 给一句话提示。advisory 性质，退出码恒 0（不阻断写作流程）。
 *
 * 接入方式（hook 集成点）：
 *   编辑器"保存章节"钩子 / CI 预提交钩子调用本脚本即可：
 *     node scripts/drift-guard.js <章节文件> [--project <项目目录>] [--z 1.5]
 *   前 2 章基线不足会自动跳过，第 3 章起生效。
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const esc = (n) => '\x1b[' + n + 'm';
const RED = esc(31), GREEN = esc(32), YELLOW = esc(33), DIM = esc(2), RESET = esc(0);
const log = (m) => console.log(`${GREEN}[GUARD]${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}[WARN]${RESET} ${m}`);
const info = (m) => console.log(`${DIM}·${RESET} ${m}`);
const err = (m) => console.error(`${RED}[ERROR]${RESET} ${m}`);

function getOpt(argv, k, def) {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}

function main() {
  const argv = process.argv.slice(2);
  const chapterFile = argv.find((a) => !a.startsWith('--'));
  if (!chapterFile) {
    err('用法：drift-guard.js <章节文件> [--project <项目目录>] [--z 1.5]');
    return 2;
  }
  if (!fs.existsSync(chapterFile)) {
    err('章节文件不存在: ' + chapterFile);
    return 2;
  }

  const zTh = parseFloat(getOpt(argv, '--z', '1.5')) || 1.5;
  let projectDir = getOpt(argv, '--project');
  if (!projectDir) projectDir = path.resolve(path.dirname(chapterFile), '..');

  // 调用 style-drift.js --json，仅取最新章 z-score
  let out = '';
  try {
    out = execFileSync(process.execPath, [path.join(__dirname, 'style-drift.js'), projectDir, '--json'],
      { encoding: 'utf-8', timeout: 20000 });
  } catch (e) {
    const msg = ((e.stdout || e.stderr || e.message || '').toString().trim().split('\n')[0] || '');
    if (/有效章节不足 3|无法计算可靠的漂移基线/.test(msg)) {
      info('文风基线不足 3 章，暂跳过漂移评估（继续写，第 3 章后可评估）。');
      return 0;
    }
    info('文风漂移评估暂不可用：' + msg);
    return 0;
  }

  let data;
  try { data = JSON.parse(out); } catch { info('文风漂移结果解析失败，跳过。'); return 0; }
  if (!data.chapters || !data.chapters.length) { info('无章节数据，跳过。'); return 0; }

  // 聚焦"传入章节"本身（而非全局最新章）
  const m = chapterFile.match(/第\s*(\d+)\s*章/);
  const targetNum = m ? parseInt(m[1], 10) : null;
  const target = targetNum != null ? data.chapters.find((c) => c.chapter === targetNum) : null;
  if (!target) {
    info(`传入章节（第${targetNum != null ? targetNum : '?'}章）内容过短或未被纳入基线，跳过该章评估；基线基于现有 ${data.chapters.length} 章。`);
    return 0;
  }
  const z = target.z || {};
  const driftKeys = Object.keys(z).filter((k) => Math.abs(z[k]) > zTh);
  if (driftKeys.length === 0) {
    log(`第${target.chapter}章文风一致（|z| ≤ ${zTh}），无漂移。`);
  } else {
    warn(`第${target.chapter}章文风漂移（|z| > ${zTh}）：${driftKeys.map((k) => `${k}=${z[k]}`).join('，')}`);
    info('建议：检查本节句长 / 对话比 / 用词是否与全书基调一致（可能代笔、AI味突变或状态断档）。');
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { main };
