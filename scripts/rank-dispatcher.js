#!/usr/bin/env node
/**
 * rank-dispatcher.js — 排行榜爬虫统一调度 / 聚合底座
 * 零依赖。把 7 个平台 rank-scraper 的采集结果统一收拢为 rank-index.json，
 * 供 topic-to-book scan --from-rank 做选题情报分析。
 *
 * 设计原则：
 *   - scan   只聚合"已有缓存"，不联网，永远可跑（离线安全）
 *   - refresh 才逐个 spawn 爬虫刷新，失败隔离，不崩整体
 *   - 不重写 7 个爬虫主体，保留各平台 CDP 适配差异
 *
 * 用法：
 *   node scripts/rank-dispatcher.js scan    [--dir data/rank]   # 扫描已有缓存 → rank-index.json
 *   node scripts/rank-dispatcher.js refresh [--dir data/rank]   # 逐个 spawn 爬虫刷新(失败隔离) → 聚合
 *   node scripts/rank-dispatcher.js index   [--dir data/rank]   # 仅打印当前索引
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// 颜色助手：用数字转义拼接，规避整段 ANSI 序列被误写的风险
const esc = (n) => '\x1b[' + n + 'm';
const RED = esc(31), GREEN = esc(32), YELLOW = esc(33), DIM = esc(2), BOLD = esc(1), RESET = esc(0);

const log = (s) => console.log(s);
const info = (s) => console.log(DIM + s + RESET);
const ok = (s) => console.log(GREEN + '[OK] ' + RESET + s);
const warn = (s) => console.log(YELLOW + '[WARN] ' + RESET + s);
const err = (s) => console.log(RED + '[ERR] ' + RESET + s);

const SCRIPTS_DIR = __dirname;

// 平台中文名 → 爬虫脚本（统一调度映射表，爬虫主体不变）
const PLATFORMS = {
  '起点': 'qidian-rank-scraper.js',
  '番茄': 'fanqie-rank-scraper.js',
  '刺猬猫': 'ciweimao-rank-scraper.js',
  '黑岩': 'heiyan-booklist-scraper.js',
  '晋江': 'jjwxc-rank-scraper.js',
  '七猫': 'qimao-rank-scraper.js',
  '豆瓣': 'dz-browse-scraper.js',
};

function getOpt(args, k, def) {
  const i = args.indexOf(k);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

// 估算一个榜单 MD 的条目数：含书名号《 的行，或行首有数字排行号
function countEntries(content) {
  let n = 0;
  for (const ln of content.split('\n')) {
    if (/^\s*\d+[\.、)]\s/.test(ln) || /《.+?》/.test(ln)) n++;
  }
  return n;
}

// 从路径推断平台（优先父目录名，回退文件名前缀）
function detectPlatform(p) {
  const base = path.basename(p);
  const parent = path.basename(path.dirname(p));
  for (const name of Object.keys(PLATFORMS)) {
    if (parent.includes(name) || base.includes(name)) return name;
  }
  return parent || base;
}

// 扫描榜单目录，聚合为索引对象（不联网）
function scanRank(dir) {
  if (!fs.existsSync(dir)) {
    err('榜单目录不存在: ' + dir + '（先运行 refresh，或手动放置榜单 MD）');
    return null;
  }
  const files = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      for (const f of fs.readdirSync(full)) {
        if (f.endsWith('.md')) files.push(path.join(full, f));
      }
    } else if (ent.name.endsWith('.md')) {
      files.push(full);
    }
  }
  const platformsMap = {};
  let totalEntries = 0;
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf-8');
    const entries = countEntries(content);
    totalEntries += entries;
    const platform = detectPlatform(f);
    const m = path.basename(f).match(/(\d{8})/);
    const date = m ? m[1] : '';
    if (!platformsMap[platform]) platformsMap[platform] = { platform, files: [], totalEntries: 0 };
    platformsMap[platform].files.push({ name: path.basename(f), entries, size: content.length, date });
    platformsMap[platform].totalEntries += entries;
  }
  const platforms = Object.values(platformsMap).sort((a, b) => b.totalEntries - a.totalEntries);
  return {
    generatedAt: new Date().toISOString(),
    dir: path.resolve(dir),
    platformCount: platforms.length,
    totalEntries,
    platforms,
  };
}

function cmdScan(args) {
  const dir = getOpt(args, '--dir', 'data/rank');
  const index = scanRank(dir);
  if (!index) return 1;
  const out = path.join(dir, 'rank-index.json');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(out, JSON.stringify(index, null, 2), 'utf-8');
  ok('聚合 ' + index.platformCount + ' 平台 / ' + index.totalEntries + ' 条榜单 → ' + out);
  return 0;
}

function cmdRefresh(args) {
  const dir = getOpt(args, '--dir', 'data/rank');
  fs.mkdirSync(dir, { recursive: true });
  const node = process.execPath;
  let okCount = 0, failCount = 0;
  for (const [platform, script] of Object.entries(PLATFORMS)) {
    const outDir = path.join(dir, platform);
    info('刷新 ' + platform + ' ...');
    try {
      execFileSync(node, [path.join(SCRIPTS_DIR, script), '--outdir', outDir], {
        stdio: 'pipe', timeout: 90000,
      });
      okCount++;
      ok('  ' + platform + ' 完成');
    } catch (e) {
      failCount++;
      const msg = ((e.stderr || e.stdout || e.message || '').toString().trim().split('\n')[0] || 'unknown');
      warn('  ' + platform + ' 失败（已隔离）：' + msg);
    }
  }
  log(BOLD + '刷新完成：成功 ' + okCount + ' / 失败 ' + failCount + RESET);
  return cmdScan(args);
}

function cmdIndex(args) {
  const dir = getOpt(args, '--dir', 'data/rank');
  const index = scanRank(dir);
  if (!index) return 1;
  log(BOLD + '榜单索引（' + index.platformCount + ' 平台 / ' + index.totalEntries + ' 条）' + RESET);
  for (const p of index.platforms) {
    log('  ' + p.platform + '：' + p.files.length + ' 文件 / ' + p.totalEntries + ' 条');
    for (const f of p.files) log(DIM + '    - ' + f.name + ' (' + f.entries + ' 条, ' + f.date + ')' + RESET);
  }
  return 0;
}

function main() {
  const [, , cmd, ...args] = process.argv;
  const map = { scan: cmdScan, refresh: cmdRefresh, index: cmdIndex };
  if (!map[cmd]) {
    err('用法：node rank-dispatcher.js <scan|refresh|index> [--dir data/rank]');
    return 2;
  }
  return map[cmd](args);
}

if (require.main === module) process.exit(main());
module.exports = { scanRank, PLATFORMS, countEntries, detectPlatform };
