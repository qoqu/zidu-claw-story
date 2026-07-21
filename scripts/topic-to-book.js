#!/usr/bin/env node
'use strict';

/**
 * topic-to-book.js — 选题→成书 闭环编排（v1.5.0 新增 · T4 主线）
 *
 * 把零散能力串成一条可复用的写作流水线：
 *   扫榜/题材 → 选题匹配 → 开书骨架 → 日更配速 → 追读复盘 → 写法沉淀
 *
 * 不重复造轮子：通过 child_process 复用 genre-library / outline-pacer /
 * tracking-updater / pacing-density / learn-bank / dashboard，并 require
 * pacing-density 拿追读曲线。零依赖（fs/path/os/child_process）。
 *
 * 退出码：0=成功；1=参数错误；2=执行失败。
 *
 * 用法：
 *   node topic-to-book.js scan    [--kw 扮猪吃虎] [--platform 番茄] [--gender 男频]
 *   node topic-to-book.js match   --topic "重生爽文"
 *   node topic-to-book.js scaffold --genre 修仙 --title "我的书" [--dir 项目路径] [--gender 男频] [--platform 起点]
 *   node topic-to-book.js plan    --dir <项目目录> [--words 3000] [--chapter N]
 *   node topic-to-book.js review  --dir <项目目录>
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { SEED } = require('./genre-library');
const { scanRank } = require('./rank-dispatcher');

const RESET = '\x1b[0m', BOLD = '\x1b[1m', DIM = '\x1b[2m';
const GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m';
const log = (m) => console.log(`${GREEN}[FLOW]${RESET} ${m}`);
const err = (m) => console.error(`${RED}[ERROR]${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}[WARN]${RESET} ${m}`);
const info = (m) => console.log(`${DIM}·${RESET} ${m}`);

const SD = __dirname;
const node = process.execPath;
function run(script, args, opts = {}) {
  try {
    const out = execFileSync(node, [path.join(SD, script), ...args],
      { stdio: opts.silent ? 'pipe' : 'pipe', timeout: opts.timeout || 20000 });
    return { code: 0, out: out.toString(), err: '' };
  } catch (e) {
    return { code: e.status == null ? 2 : e.status, out: (e.stdout || '').toString(), err: (e.stderr || '').toString() };
  }
}

function getOpt(argv, k, def = '') {
  const i = argv.indexOf(k);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
}

// ===== scan：选题情报（离线 / 蓝海指数） =====
function cmdScan(argv) {
  if (argv.includes('--from-rank')) {
    return cmdScanBlueOcean(getOpt(argv, '--rank-dir', 'data/rank'));
  }
  const kw = getOpt(argv, '--kw');
  const platform = getOpt(argv, '--platform');
  const gender = getOpt(argv, '--gender');
  log('题材风向（离线，基于内置 37 题材种子）');
  info('提示：实时热榜需各平台 rank-scraper（依赖浏览器/CDP）。加 --from-rank 读取爬虫缓存做蓝海指数分析。');
  let res;
  if (kw) res = run('genre-library.js', ['search', '--kw', kw]);
  else if (platform || gender) res = run('genre-library.js', ['filter', ...(platform ? ['--platform', platform] : []), ...(gender ? ['--gender', gender] : [])]);
  else res = run('genre-library.js', ['list']);
  if (res.code !== 0) { err('genre-library 调用失败：' + res.err.trim().split('\n')[0]); return 2; }
  console.log(res.out);
  info('下一步：topic-to-book match --topic "<你中意的卖点>"，或 scaffold 直接开书。');
  return 0;
}

// 蓝海指数：读 rank-dispatcher 聚合的榜单 → 用题材标签匹配热榜书名 → 算需求/竞争
function cmdScanBlueOcean(rankDir) {
  const index = scanRank(rankDir);
  if (!index || !index.platforms.length) {
    warn('无榜单缓存：请先运行 `node rank-dispatcher.js refresh --dir ' + rankDir + '`');
    info('或手动把各平台榜单 MD 放到 ' + rankDir + '/<平台>/ 下，再 scan --from-rank');
    return 1;
  }
  const genreHeat = {};   // 题材 -> 累计热度
  const genreHit = {};    // 题材 -> 命中条目数
  const matchedMap = new Map();  // 证据（按 平台|书名 去重）
  for (const p of index.platforms) {
    for (const f of p.files) {
      let fp = path.join(rankDir, p.platform, f.name);
      if (!fs.existsSync(fp)) fp = path.join(rankDir, f.name);
      if (!fs.existsSync(fp)) continue;
      const content = fs.readFileSync(fp, 'utf-8');
      for (const ln of content.split('\n')) {
        let title = null, heat = 0;
        const m = ln.match(/^\s*\d+[\.、)]\s*《?([^》\n]{1,40})》?\s*[-—–]\s*([^\d\n]{1,30}?)\s*(\d[\d,]*)\s*$/);
        if (m) { title = m[1].trim(); heat = parseInt(m[3].replace(/,/g, ''), 10) || 0; }
        else {
          const bm = ln.match(/《([^》]+)》/);
          if (bm) { title = bm[1].trim(); const hm = ln.match(/(\d[\d,]*)\s*$/); heat = hm ? (parseInt(hm[1].replace(/,/g, ''), 10) || 0) : 0; }
        }
        if (!title) continue;
        for (const [g, meta] of Object.entries(SEED)) {
          const hit = title.includes(g) || (meta.tags && meta.tags.some((t) => title.includes(t)));
          if (!hit) continue;
          genreHeat[g] = (genreHeat[g] || 0) + heat;
          genreHit[g] = (genreHit[g] || 0) + 1;
          const mkey = p.platform + '|' + title;
          if (!matchedMap.has(mkey)) matchedMap.set(mkey, { title, genres: new Set(), platform: p.platform, heat });
          matchedMap.get(mkey).genres.add(g);
        }
      }
    }
  }
  const rows = Object.keys(SEED).map((g) => {
    const meta = SEED[g];
    const demand = genreHeat[g] || 0;
    const hit = genreHit[g] || 0;
    const platN = (meta.platforms || []).length;
    const tagN = (meta.tags || []).length;
    const competition = platN + tagN * 0.5;          // 平台越多/标签越多 = 越红海
    const blue = demand > 0 ? Math.round(demand / competition) : 0;
    return { genre: g, demand, hit, platN, tagN, competition: +competition.toFixed(1), blue };
  }).filter((r) => r.demand > 0).sort((a, b) => b.blue - a.blue);

  log('选题情报 · 蓝海指数榜（来源：' + index.platformCount + ' 平台 / ' + index.totalEntries + ' 条榜单）');
  info('蓝海指数 = 热榜命中热度 ÷ 竞争度(平台数 + 标签×0.5)；越高越值得写');
  console.log('');
  console.log(BOLD + '排名  题材        指数  热度  命中  平台×标签' + RESET);
  if (!rows.length) {
    warn('未从热榜解析出题材命中，可能榜单格式不匹配或样本为空。');
  } else {
    rows.slice(0, 15).forEach((r, i) => {
      const line = String(i + 1).padEnd(5) + (r.genre + '          ').slice(0, 10) +
        String(r.blue).padEnd(6) + String(r.demand).padEnd(6) + String(r.hit).padEnd(5) +
        r.platN + '×' + r.tagN;
      console.log(line);
    });
  }
  console.log('');
  info('证据（前 8 条命中）：');
  [...matchedMap.values()].slice(0, 8).forEach((b) => info('  《' + b.title + '》→ ' + [...b.genres].join('/') + '（' + b.platform + '，热度 ' + b.heat + '）'));
  info('下一步：topic-to-book scaffold --genre <榜首题材> --title "你的书名"');
  return 0;
}

// ===== match：选题匹配 =====
function cmdMatch(argv) {
  const topic = getOpt(argv, '--topic');
  if (!topic) { err('用法：match --topic "重生爽文"'); return 1; }
  log(`为选题「${topic}」匹配题材库`);
  const res = run('genre-library.js', ['search', '--kw', topic]);
  console.log(res.out || '(无匹配)');
  info(`若命中，执行：topic-to-book scaffold --genre <命中题材> --title "你的书名"`);
  return 0;
}

// ===== scaffold：开书骨架 =====
function cmdScaffold(argv) {
  const genre = getOpt(argv, '--genre');
  const title = getOpt(argv, '--title');
  const gender = getOpt(argv, '--gender', '男频');
  const platform = getOpt(argv, '--platform', '起点');
  if (!title) { err('用法：scaffold --genre 修仙 --title "我的书" [--dir 路径]'); return 1; }

  const dir = path.resolve(getOpt(argv, '--dir', './' + title.replace(/[\\/:*?"<>|]/g, '_')));
  if (fs.existsSync(dir)) { err(`目录已存在：${dir}`); return 1; }
  fs.mkdirSync(path.join(dir, '设定'), { recursive: true });
  fs.mkdirSync(path.join(dir, '正文'), { recursive: true });
  fs.mkdirSync(path.join(dir, '大纲'), { recursive: true });
  fs.mkdirSync(path.join(dir, '记忆'), { recursive: true });

  // 1) 若题材库有该题材，拷入设定基底
  if (genre) {
    const r = run('genre-library.js', ['scaffold', genre, dir], { silent: true });
    if (r.code === 0) info(`已从题材库拷入「${genre}」设定基底`);
    else warn(`题材库无「${genre}」或拷入失败，使用通用骨架`);
  }
  // 2) 书名（覆盖/新增）
  fs.writeFileSync(path.join(dir, '设定', '书名.md'), `# 《${title}》\n`, 'utf-8');
  // 3) 追踪文件初始化
  run('tracking-updater.js', [dir, 'init'], { silent: true });
  // 4) 追读力.md 表头
  fs.writeFileSync(path.join(dir, '追踪', '追读力.md'),
    `# 追读力追踪\n\n> 每章写完后由 tracking-updater reading-power 写入，pacing-density 读取绘图。\n`, 'utf-8');
  // 5) 大纲骨架（依题材标签给方向）
  const outline = buildOutline(title, genre, gender, platform);
  fs.writeFileSync(path.join(dir, '大纲', '大纲.md'), outline, 'utf-8');

  log(`已生成项目骨架：${dir}`);
  console.log('');
  console.log(`${BOLD}目录结构${RESET}`);
  ['设定', '正文', '大纲', '追踪', '记忆'].forEach((d) => info(`${path.basename(dir)}/${d}/`));
  console.log('');
  console.log(`${BOLD}推荐写作流水线（每章循环）${RESET}`);
  info('1. 写 正文/第N章.md');
  info('2. node tracking-updater.js <dir> after-chapter --chapter N --summary "..."');
  info('3. node tracking-updater.js <dir> reading-power --chapter N --hook-type 冲突 --strength 强  (写入追读力.md)');
  info('4. node quality-gate.js <dir> --chapter N');
  info('5. node pacing-density.js <dir>    # 看追读曲线，水章预警');
  info('6. node learn-bank.js <dir> add --type 爽点套路 --content "..."   # 沉淀好写法');
  return 0;
}

function buildOutline(title, genre, gender, platform) {
  const today = new Date().toISOString().slice(0, 10);
  return `# 《${title}》大纲

- 题材：${genre || '待定'}　性别：${gender}　主投平台：${platform}
- 创建日：${today}

## 一卷：铺垫与立人设（第1-10章）
- 第1章：强开局钩子，3 段内抛出核心冲突
- 第2-4章：金手指/异能亮相，第一次小爽点
- 第5-7章：第一个大事件，立住反派/对手
- 第8-10章：小高潮 + 卷尾钩子，把读者留在追更

## 二卷：升级与冲突升级（第11-30章）
- 主线推进，每 3-5 章一个爽点释放
- 埋设 2-3 个长线伏笔（记到 追踪/伏笔.md）
- 中段设置一个"伪失败"拉低再反弹，追读力最稳

## 三卷：高潮与收束（第31章+）
- 大反转 / 大揭秘
- 长线伏笔逐一回收
- 卷尾留新篇预告（如需续作）

> 配速：node outline-pacer.js 大纲/大纲.md --target-words 3000
> 复盘：node topic-to-book.js review --dir <本项目>
`;
}

// ===== plan：今日配速 =====
function cmdPlan(argv) {
  const dir = path.resolve(getOpt(argv, '--dir', '.'));
  if (!fs.existsSync(dir)) { err(`项目目录不存在：${dir}`); return 1; }
  const words = getOpt(argv, '--words', '3000');
  const outlineFile = path.join(dir, '大纲', '大纲.md');
  if (!fs.existsSync(outlineFile)) { warn('未找到 大纲/大纲.md，跳过配速，只给章节建议。'); }

  // 已写章节数
  let last = 0;
  const body = path.join(dir, '正文');
  if (fs.existsSync(body)) {
    for (const f of fs.readdirSync(body)) {
      const m = f.match(/第\s*(\d+)\s*章/);
      if (m) last = Math.max(last, parseInt(m[1], 10));
    }
  }
  const next = last + 1;
  log(`今日写作计划（${path.basename(dir)}）`);
  console.log(`下一章：第 ${next} 章　目标字数：约 ${words} 字`);

  if (fs.existsSync(outlineFile)) {
    const r = run('outline-pacer.js', [outlineFile, '--target-words', words, '--json'], { silent: true });
    if (r.code === 0) {
      try {
        const data = JSON.parse(r.out);
        const secs = data.sections || data.pacing || [];
        if (Array.isArray(secs) && secs.length) {
          console.log(`${BOLD}本章结构配比${RESET}`);
          secs.forEach((s) => {
            const name = s.name || s.section || '';
            const pct = s.pct != null ? s.pct : (s.percentage != null ? s.percentage : '');
            const wordsS = s.words != null ? s.words : (s.target_words != null ? s.target_words : '');
            info(`${name}　${pct}%　≈${wordsS}字`);
          });
        }
      } catch { /* ignore parse */ }
    }
  }
  info('写完后：tracking-updater after-chapter → quality-gate → pacing-density');
  return 0;
}

// ===== review：追读复盘 =====
function cmdReview(argv) {
  const dir = path.resolve(getOpt(argv, '--dir', '.'));
  if (!fs.existsSync(dir)) { err(`项目目录不存在：${dir}`); return 1; }
  log(`写作复盘（${path.basename(dir)}）`);

  // 字数 & 章节
  let chapters = 0, totalWords = 0, last = 0;
  const body = path.join(dir, '正文');
  if (fs.existsSync(body)) {
    for (const f of fs.readdirSync(body)) {
      const m = f.match(/第\s*(\d+)\s*章/);
      if (!m) continue;
      const n = parseInt(m[1], 10);
      chapters++; last = Math.max(last, n);
      const c = fs.readFileSync(path.join(body, f), 'utf-8');
      totalWords += c.replace(/[#*_`\[\](){}|\\~^>!-]/g, '').replace(/\s+/g, '').length;
    }
  }

  // 追读密度（require pacing-density）
  let latest = null, series = [], waterChapters = [];
  try {
    const pd = require('./pacing-density.js');
    const chs = pd.parseReadingPower(dir);
    if (chs && chs.length) {
      const raws = chs.map(pd.densityScore);
      const maxRaw = Math.max(...raws, 0.0001);
      series = raws.map((r) => Math.round((r / maxRaw) * 100));
      latest = series[series.length - 1];
      chs.forEach((c, i) => { if (series[i] < 45) waterChapters.push(c.num || i + 1); });
    }
  } catch (e) { warn('追读力解析失败（需先写 追踪/追读力.md）：' + e.message); }

  // 记忆沉淀
  const bank = run('learn-bank.js', [dir, 'stats'], { silent: true });

  console.log('');
  console.log(`${BOLD}📈 进度${RESET}　章节 ${chapters}（最新第${last}章）　总字数 ${totalWords.toLocaleString()}`);
  console.log(`${BOLD}📊 追读密度${RESET}　最新 ${latest == null ? '无数据' : latest + ' / 100'}` +
    (waterChapters.length ? `　${YELLOW}水章预警：第${waterChapters.join('、')}章${RESET}` : '　曲线健康'));
  if (series.length) console.log(`${DIM}密度序列：${series.join(' ')}${RESET}`);
  if (bank.out) console.log(bank.out.trim());

  console.log('');
  if (latest != null && latest < 45) warn('最新章追读密度偏低，建议下一章加强钩子/爽点，或回收一个长线伏笔拉回期待。');
  else if (latest == null) info('尚无追读数据，先按流水线写入 追踪/追读力.md。');
  else log('节奏稳定，保持更新频率即可。');
  info('全局视图：node dashboard.js <父目录> --html dashboard.html');
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  const map = { scan: cmdScan, match: cmdMatch, scaffold: cmdScaffold, plan: cmdPlan, review: cmdReview };
  if (!sub || !map[sub]) {
    console.error(`${RED}用法：${RESET}node topic-to-book.js <scan|match|scaffold|plan|review> [选项]`);
    console.error('  scan    题材风向（离线）');
    console.error('  match   --topic "..." 选题匹配');
    console.error('  scaffold --genre X --title Y [--dir D]');
    console.error('  plan    --dir D [--words 3000]');
    console.error('  review  --dir D');
    process.exit(1);
  }
  try { process.exit(map[sub](argv.slice(1))); }
  catch (e) { err('执行失败：' + (e && e.message ? e.message : e)); process.exit(2); }
}

if (require.main === module) main();
