#!/usr/bin/env node
'use strict';

/**
 * selftest.js — zidu-claw-story 自测套件 / 回归护栏（v1.5.0 新增）
 *
 * 目的：40+ 脚本靠手动冒烟容易改坏一个带崩一串。本脚本给整包做冒烟：
 *   阶段1 语法检查   node --check 每个脚本（零副作用、最快）
 *   阶段2 启动冒烟   非网络/非浏览器脚本跑 `--help`（或空参），断言"不崩"
 *                    判过标准：exit 0/1/2 且首几行无未捕获异常堆栈
 *   阶段3 功能冒烟   在临时项目里跑 tracking-updater init + dashboard +
 *                    learn-bank stats + genre-library list + outline-pacer，
 *                    验证核心链路真的能走通
 *
 * 零依赖：fs/path/os/child_process。纯文本输出（不依赖 ANSI 转义）。
 * 退出码：0=全部通过；1=有失败。
 *
 * 用法：
 *   node scripts/selftest.js
 *   node scripts/selftest.js --quiet        # 只打印失败项
 *   node scripts/selftest.js --json         # 机器可读汇总
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PASS = '[PASS]';
const FAIL = '[FAIL]';
const NOTE = '[NOTE]';

const args = process.argv.slice(2);
const QUIET = args.includes('--quiet');
const JSONM = args.includes('--json');

// 需要浏览器 / 网络的脚本：阶段2 不启动（但仍做语法检查）
const SKIP_RUN = new Set([
  'fanqie-rank-scraper.js',
  'qidian-rank-scraper.js',
  'jjwxc-rank-scraper.js',
  'ciweimao-rank-scraper.js',
  'heiyan-booklist-scraper.js',
  'qimao-rank-scraper.js',
  'dz-browse-scraper.js',
  'cdp-utils.js',
  'setup-cdp-chrome.js',
  'selftest.js', // 自身无子命令，`--help` 会完整运行自己导致递归，仅阶段1 语法检查即可
]);

function listScripts(dir) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
}

function stackIn(text) {
  // 仅看前几行是否出现未捕获异常特征
  const head = text.split('\n').slice(0, 4).join('\n');
  return /(TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|Error:\s)/.test(head);
}

function phaseSyntax(dir, scripts) {
  const fails = [];
  for (const s of scripts) {
    try {
      execFileSync(process.execPath, ['--check', path.join(dir, s)], { stdio: 'pipe', timeout: 10000 });
    } catch (e) {
      fails.push(`${s} 语法错误：${(e.stderr || e.stdout || '').toString().trim().split('\n').slice(-2).join(' ')}`);
    }
  }
  return fails;
}

function phaseRun(dir, scripts) {
  const fails = [];
  for (const s of scripts) {
    if (SKIP_RUN.has(s)) continue;
    try {
      execFileSync(process.execPath, [path.join(dir, s), '--help'], { stdio: 'pipe', timeout: 8000 });
      // exit 0/1/2 都算"正常启动并自知用法"
    } catch (e) {
      const code = e.status;
      const out = ((e.stdout || '').toString() + (e.stderr || '').toString());
      const crashed = (code == null || code > 2) || stackIn(out);
      if (crashed) fails.push(`${s} 启动崩溃（exit=${code}）：${out.trim().split('\n')[0]}`);
    }
  }
  return fails;
}

function phaseFunctional(dir) {
  const fails = [];
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'zidu-selftest-'));
  const proj = path.join(tmp, 'demo-book'); // dashboard 只认子目录项目，故建子项目
  fs.mkdirSync(path.join(proj, '大纲'), { recursive: true });
  const node = process.execPath;
  const run = (cmdArgs, label) => {
    try {
      execFileSync(node, cmdArgs, { cwd: tmp, stdio: 'pipe', timeout: 12000 });
      return true;
    } catch (e) {
      fails.push(`${label} 失败：${((e.stderr || e.stdout || '').toString().trim().split('\n')[0] || e.message)}`);
      return false;
    }
  };

  // 1) tracking-updater init 在子项目内建追踪文件
  run([path.join(dir, 'tracking-updater.js'), proj, 'init'], 'tracking-updater init');

  // 2) dashboard 扫描该临时根（tmp 下应有 demo-book 1 个项目）
  let dashOut = '';
  try {
    dashOut = execFileSync(node, [path.join(dir, 'dashboard.js'), tmp], { stdio: 'pipe', timeout: 12000 }).toString();
  } catch (e) {
    fails.push('dashboard 失败：' + ((e.stderr || '').toString().trim().split('\n')[0] || e.message));
  }
  if (dashOut && !/仪表盘/.test(dashOut)) fails.push('dashboard 未输出预期表头');

  // 3) learn-bank stats（空库也应 exit 0）
  run([path.join(dir, 'learn-bank.js'), proj, 'stats'], 'learn-bank stats');

  // 4) genre-library list（纯离线检索）
  let glOut = '';
  try {
    glOut = execFileSync(node, [path.join(dir, 'genre-library.js'), 'list'], { stdio: 'pipe', timeout: 12000 }).toString();
  } catch (e) {
    fails.push('genre-library list 失败：' + ((e.stderr || '').toString().trim().split('\n')[0] || e.message));
  }
  if (glOut && !/修仙|题材|克苏鲁/.test(glOut)) fails.push('genre-library list 未列出题材');

  // 5) outline-pacer 对一份示例细纲
  try {
    fs.writeFileSync(path.join(proj, '大纲', '细纲.md'),
      '# 细纲\n\n## 第1章 开局\n- 开篇钩子\n- 事件展开\n\n## 第2章 发展\n- 冲突升级\n- 爽点释放\n', 'utf-8');
    execFileSync(node, [path.join(dir, 'outline-pacer.js'), path.join(proj, '大纲', '细纲.md'), '--json'],
      { cwd: tmp, stdio: 'pipe', timeout: 12000 });
  } catch (e) {
    fails.push('outline-pacer 失败：' + ((e.stderr || e.stdout || '').toString().trim().split('\n')[0] || e.message));
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* ignore */ }
  return fails;
}

function main() {
  const dir = __dirname;
  const scripts = listScripts(dir);
  const total = scripts.length;

  if (!JSONM) console.log(`zidu-claw-story 自测套件（共 ${total} 个脚本）\n`);

  const syntaxFails = phaseSyntax(dir, scripts);
  const runFails = phaseRun(dir, scripts);
  const funcFails = phaseFunctional(dir);

  const all = [...syntaxFails, ...runFails, ...funcFails];

  if (JSONM) {
    console.log(JSON.stringify({
      total, syntax: syntaxFails, run: runFails, functional: funcFails,
      pass: all.length === 0, failed: all.length,
    }, null, 2));
    process.exit(all.length ? 1 : 0);
  }

  if (!QUIET) {
    console.log(`${NOTE} 阶段1 语法检查：通过 ${total - syntaxFails.length}/${total}`);
    console.log(`${NOTE} 阶段2 启动冒烟：跳过网络/浏览器 ${SKIP_RUN.size} 个，失败 ${runFails.length}`);
    console.log(`${NOTE} 阶段3 功能冒烟：失败 ${funcFails.length}`);
  }
  if (syntaxFails.length) { console.log(''); syntaxFails.forEach((f) => console.log(`${FAIL} ${f}`)); }
  if (runFails.length) { console.log(''); runFails.forEach((f) => console.log(`${FAIL} ${f}`)); }
  if (funcFails.length) { console.log(''); funcFails.forEach((f) => console.log(`${FAIL} ${f}`)); }

  console.log('');
  if (all.length === 0) {
    console.log(`${PASS} 全部通过：${total} 脚本语法 OK，核心链路可用。`);
    process.exit(0);
  } else {
    console.log(`${FAIL} 有 ${all.length} 项失败，请修复后再改其他脚本。`);
    process.exit(1);
  }
}

if (require.main === module) main();
