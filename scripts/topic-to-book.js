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
 *   node topic-to-book.js scan    --from-rank [--refresh] [--rank-dir data/rank]   # 实时蓝海指数（--refresh 自动刷热榜）
 *   node topic-to-book.js match   --topic "重生爽文"
 *   node topic-to-book.js scaffold --genre 修仙 --title "我的书" [--dir 项目路径] [--gender 男频] [--platform 起点] [--decision 选题决策.md]
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
    const rankDir = getOpt(argv, '--rank-dir', 'data/rank');
    if (argv.includes('--refresh')) {
      log('选题情报 · 刷新实时热榜（--refresh，需浏览器/CDP，失败自动回退本地缓存）');
      run('rank-dispatcher.js', ['refresh', '--dir', rankDir], { timeout: 600000 });
      info('热榜刷新流程结束（失败平台已隔离），开始蓝海分析');
    }
    return cmdScanBlueOcean(rankDir);
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
    warn('无榜单缓存：加 --refresh 自动刷热榜，或先运行 `node rank-dispatcher.js refresh --dir ' + rankDir + '`');
    info('也可手动把各平台榜单 MD 放到 ' + rankDir + '/<平台>/ 下，再 scan --from-rank');
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
  info('数据时间：' + (index.generatedAt ? index.generatedAt.slice(0, 19).replace('T', ' ') : '未知'));
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

// ===== 解析 选题决策.md（long-scan Phase 4 产出） =====
// 取排在最前（可行性最高）的推荐选题作为开书起点；返回结构化字段供 scaffold / 下游消费
function parseDecision(file) {
  const c = fs.readFileSync(file, 'utf-8');
  const doc = { rootTitle: '', scanDate: '', gender: '', platform: '', topics: [] };
  const h0 = c.match(/^#\s*选题决策[:：]\s*(.+)$/m);
  if (h0) doc.rootTitle = h0[1].trim();
  const sd = c.match(/扫榜日期[:：]\s*(\S+)/);
  if (sd) doc.scanDate = sd[1].trim();
  const topicRe = /^###\s*选题\s*\d+\s*[:：]\s*(.+)$/;
  let cur = null;
  for (const ln of c.split('\n')) {
    const tm = ln.match(topicRe);
    if (tm) { cur = { heading: tm[1].trim(), platform: '', gender: '' }; doc.topics.push(cur); continue; }
    if (!cur) continue;
    let m;
    if ((m = ln.match(/^\s*-\s*题材组合[:：]\s*(.+)$/))) { cur.genreCombo = m[1].trim(); cur.genreMain = m[1].split(/[+、/]/)[0].trim(); }
    else if ((m = ln.match(/^\s*-\s*核心卖点[:：]\s*(.+)$/))) cur.sellPoint = m[1].trim();
    else if ((m = ln.match(/^\s*-\s*差异化定位[:：]\s*(.+)$/))) cur.diff = m[1].trim();
    else if ((m = ln.match(/^\s*-\s*目标读者[:：]\s*(.+)$/))) cur.audience = m[1].trim();
    else if ((m = ln.match(/^\s*-\s*可行性[:：]\s*(.+)$/))) cur.feas = m[1].trim();
    else if ((m = ln.match(/^\s*-\s*篇幅\/平台[:：]\s*(.+)$/))) { cur.lengthPlatform = m[1].trim(); const pm = m[1].match(/(起点|番茄|晋江|刺猬猫|飞卢|纵横|17K)/); if (pm) cur.platform = pm[1]; }
    else if ((m = ln.match(/^\s*-\s*性别[:：]\s*(男频|女频)/))) cur.gender = m[1];
  }
  // 文档级平台/性别取第一个有值的选题块（就近），避免跨选题串味
  for (const t of doc.topics) { if (t.platform) { doc.platform = t.platform; break; } }
  for (const t of doc.topics) { if (t.gender) { doc.gender = t.gender; break; } }
  return doc;
}

// ===== scaffold：开书骨架（可选消费 选题决策.md） =====
function cmdScaffold(argv) {
  const genreArg = getOpt(argv, '--genre');
  const titleArg = getOpt(argv, '--title');
  const decisionArg = getOpt(argv, '--decision');
  const genderGiven = argv.includes('--gender');
  const platformGiven = argv.includes('--platform');
  let gender = getOpt(argv, '--gender', '男频');
  let platform = getOpt(argv, '--platform', '起点');

  // 解析 选题决策.md（long-scan Phase 4 产出）；显式 --decision 优先，否则看 CWD
  let decision = null, decisionFile = null;
  const cand = [];
  if (decisionArg) cand.push(path.resolve(decisionArg));
  cand.push(path.resolve('选题决策.md'));
  for (const p of cand) {
    if (fs.existsSync(p)) { try { decision = parseDecision(p); decisionFile = p; } catch (e) { warn('选题决策.md 解析失败，忽略：' + e.message); } break; }
  }

  // CLI 未给标题时，从决策文件取排在最前（可行性最高）的推荐选题作为默认书名
  let title = titleArg;
  let genre = genreArg;
  if (decision) {
    if (!title && decision.topics.length) title = decision.topics[0].heading.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40);
    if (!genre && decision.topics[0] && decision.topics[0].genreMain) genre = decision.topics[0].genreMain;
    if (!genderGiven && decision.gender) gender = decision.gender;
    if (!platformGiven && decision.platform) platform = decision.platform;
  }
  if (!title) { err('用法：scaffold --genre 修仙 --title "我的书" [--dir 路径] [--decision 选题决策.md]'); return 1; }

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
  // 5) 大纲骨架（依题材标签 / 选题决策 给方向）
  const topTopic = (decision && decision.topics.length) ? decision.topics[0] : null;
  const outline = buildOutline(title, genre, gender, platform, topTopic);
  fs.writeFileSync(path.join(dir, '大纲', '大纲.md'), outline, 'utf-8');
  // 6) 消费 选题决策.md：拷入项目根，供 long-write Phase1 / long-analyze Stage5 下游读取
  if (decisionFile) {
    try { fs.copyFileSync(decisionFile, path.join(dir, '选题决策.md')); }
    catch (e) { warn('选题决策.md 拷入项目根失败：' + e.message); }
  }

  log(`已生成项目骨架：${dir}`);
  if (decision && topTopic) {
    log(`📋 已消费 选题决策.md（扫榜日期 ${decision.scanDate || '未知'}）：以「${topTopic.heading}」为开书起点`);
    info(`题材组合：${topTopic.genreCombo || genre}　核心卖点：${topTopic.sellPoint || '—'}`);
    info(`差异化：${topTopic.diff || '—'}　目标读者：${topTopic.audience || '—'}`);
  }
  console.log('');
  console.log(`${BOLD}目录结构${RESET}`);
  ['设定', '正文', '大纲', '追踪', '记忆'].forEach((d) => info(`${path.basename(dir)}/${d}/`));
  if (decisionFile) info(`${path.basename(dir)}/选题决策.md（已拷入，下游写作/拆文自动读取）`);
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

function buildOutline(title, genre, gender, platform, topic) {
  const today = new Date().toISOString().slice(0, 10);
  const genreLine = genre || (topic && topic.genreCombo) || '待定';
  let decisionBlock = '';
  if (topic) {
    decisionBlock = `
## 选题决策依据（来自 选题决策.md）
- 题材组合：${topic.genreCombo || '—'}
- 核心卖点：${topic.sellPoint || '—'}
- 差异化定位：${topic.diff || '—'}
- 目标读者：${topic.audience || '—'}
- 可行性：${topic.feas || '—'}
`;
  }
  return `# 《${title}》大纲

- 题材：${genreLine}　性别：${gender}　主投平台：${platform}
- 创建日：${today}
${decisionBlock}
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

// 逐平台复盘统计：对 起点/番茄/通用 分别汇总真实率（均值/最新/低于阈值的章节）
function perPlatformRecap(series, waterTh) {
  const out = [];
  for (const p of ['起点', '番茄', '通用']) {
    const filled = series.filter(s => s.realRates && s.realRates[p] && s.realRates[p].rate != null);
    if (!filled.length) continue;
    const vals = filled.map(s => s.realRates[p].rate);
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const latestReal = vals[vals.length - 1];
    const lowChs = filled.filter(s => s.realRates[p].rate < waterTh).map(s => s.chapter);
    const finishVals = filled.map(s => s.realRates[p].finish).filter(v => v != null);
    const avgFinish = finishVals.length ? Math.round(finishVals.reduce((a, b) => a + b, 0) / finishVals.length) : null;
    out.push({ platform: p, n: filled.length, avg, latestReal, lowChs, avgFinish, healthy: avg >= waterTh && lowChs.length === 0 });
  }
  return out;
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

  // 追读密度（复用 pacing-density.computeSeries：eff=多平台真实率均值，未填则结构性归一分）
  const waterTh = 45;
  let latest = null, series = [], waterChapters = [];
  try {
    const pd = require('./pacing-density.js');
    const comp = pd.computeSeries(dir, waterTh);
    if (comp) {
      series = comp.series;
      waterChapters = comp.waterChapters;
      latest = series.length ? series[series.length - 1].eff : null;
    }
  } catch (e) { warn('追读力解析失败（需先写 追踪/追读力.md）：' + e.message); }

  // 记忆沉淀
  const bank = run('learn-bank.js', [dir, 'stats'], { silent: true });

  const hasReal = series.some(s => s.realRates && Object.values(s.realRates).some(r => r.rate != null));

  console.log('');
  console.log(`${BOLD}📈 进度${RESET}　章节 ${chapters}（最新第${last}章）　总字数 ${totalWords.toLocaleString()}`);
  console.log(`${BOLD}📊 追读密度${RESET}　最新 ${latest == null ? '无数据' : latest + ' / 100'}` +
    (waterChapters.length ? `　${YELLOW}水章预警：第${waterChapters.map(s => s.chapter).join('、')}章${RESET}` : '　曲线健康') +
    (hasReal ? `　(${DIM}有效密度=多平台真实率均值${RESET})` : `　(${DIM}结构性代理${RESET})`));
  if (series.length) console.log(`${DIM}密度序列：${series.map(s => s.eff).join(' ')}${RESET}`);
  if (bank.out) console.log(bank.out.trim());

  // 平台逐平台复盘（起点/番茄分开给建议）
  if (hasReal) {
    console.log('');
    console.log(`${BOLD}📌 平台复盘${RESET}（真实率手抄，起点/番茄分别回填章节计入）`);
    const platLines = perPlatformRecap(series, waterTh);
    for (const pl of platLines) {
      const status = pl.healthy ? `${GREEN}✓ 健康${RESET}` : `${RED}⚠ 偏低${RESET}`;
      const low = pl.lowChs.length ? `　第${pl.lowChs.join('、')}章低于阈值` : '';
      const fin = pl.avgFinish != null ? ` · 完读均值 ${pl.avgFinish}%` : '';
      console.log(`  ${pl.platform}：回填 ${pl.n} 章，真实追读率均值 ${pl.avg}%（最新 ${pl.latestReal}%${fin}）　${status}${low}`);
    }
    const weak = platLines.filter(p => !p.healthy);
    if (weak.length) {
      console.log('');
      for (const p of weak) {
        warn(`${p.platform}真实追读率偏低（均值 ${p.avg}%），建议下一章加强钩子/爽点、回收长线伏笔拉回期待。`);
      }
    } else {
      console.log('');
      log('各平台真实追读率均达标，节奏稳定。');
    }
  }

  console.log('');
  if (latest != null && latest < waterTh && !hasReal) warn('最新章追读密度偏低（结构性代理），建议下一章加强钩子/爽点，或回收一个长线伏笔拉回期待。');
  else if (latest == null) info('尚无追读数据，先按流水线写入 追踪/追读力.md。');
  else if (!hasReal) log('节奏稳定，保持更新频率即可（当前为结构性代理，可在平台后台手抄真实率让数据更准）。');
  else info('全局视图：node dashboard.js <父目录> --html dashboard.html');
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  const sub = argv[0];
  const map = { scan: cmdScan, match: cmdMatch, scaffold: cmdScaffold, plan: cmdPlan, review: cmdReview };
  if (!sub || !map[sub]) {
    console.error(`${RED}用法：${RESET}node topic-to-book.js <scan|match|scaffold|plan|review> [选项]`);
    console.error('  scan    [--from-rank [--refresh] [--rank-dir D]] 选题情报');
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
