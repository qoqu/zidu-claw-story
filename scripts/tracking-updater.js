#!/usr/bin/env node
'use strict';

/**
 * tracking-updater.js — WB 原生追踪文件更新器
 *
 * 追踪文件更新器（WB 原生实现），
 * 并补全早期实现 writeChapter 只调用了 updateContext、漏接
 * 伏笔/时间线/角色状态/物品/环境/重复语句 6 个追踪方法的缺口。
 *
 * 零依赖：仅 require fs / path。无任何宿主专有绑定（无 .workflow、
 * 无宿主配置路径引用），可直接在 WorkBuddy 项目中调用。
 *
 * 设计原则：
 *   - 机械可做的更新（上下文进度、目录初始化）全部自动做。
 *   - 需 AI 从正文语义提取的（伏笔、时间线、角色变化、物品、环境、重复）
 *     暴露为显式子命令，由 SKILL.md 规定「每章写完后依次调用」，
 *     避免 AI 凭记忆漏更。
 *
 * 追踪文件约定（共用项目根目录的 `追踪/` 目录）：
 *   追踪/伏笔.md        待回收 / 已回收
 *   追踪/时间线.md      关键事件时序表
 *   追踪/角色状态.md    角色状态快照（最简记忆包数据源）
 *   追踪/物品.md        关键物品位置/状态
 *   追踪/环境.md        当前环境（季节/天气/场景）
 *   追踪/物资.md        钱财/食物/工具状态
 *   追踪/重复语句.md    重复表达黑名单
 *   追踪/上下文.md      写作进度摘要
 *
 * 用法：
 *   node tracking-updater.js <project-dir> init
 *   node tracking-updater.js <project-dir> after-chapter --chapter N --summary "..."
 *   node tracking-updater.js <project-dir> add-foreshadow --chapter N --text "..." [--recover "..."]
 *   node tracking-updater.js <project-dir> add-timeline   --chapter N --time "..." --desc "..." --chars "..."
 *   node tracking-updater.js <project-dir> set-character  --name "..." --key "身份" --value "..."
 *   node tracking-updater.js <project-dir> add-item       --name "..." --loc "..." --status "..." --chapter N
 *   node tracking-updater.js <project-dir> set-env        --key "季节" --value "..."
 *   node tracking-updater.js <project-dir> add-repeat     --content "..." --location "..." [--count N] [--alt "..."]
 *   node tracking-updater.js <project-dir> set-material   --name "..." --status "..." [--chapter N]
 *
 * 退出码：0=成功，1=参数/用法错误，2=文件操作失败。
 */

const fs = require('fs');
const path = require('path');

const TRACK_DIR = '追踪';

const FILES = {
  foreshadow: '伏笔.md',
  timeline: '时间线.md',
  character: '角色状态.md',
  items: '物品.md',
  environment: '环境.md',
  materials: '物资.md',
  repeat: '重复语句.md',
  context: '上下文.md',
};

// 各追踪文件初始化模板
const TEMPLATES = {
  foreshadow: '# 伏笔\n\n## 待回收\n\n## 已回收\n',
  timeline: '# 时间线\n\n## 关键事件时序\n\n| 章节 | 故事时间 | 事件 | 涉及角色 |\n|------|---------|------|----------|\n',
  character: '# 角色状态追踪\n\n> 用途：最简记忆包的数据源。Phase 3 大纲完成后创建初始状态；Phase 4 每章写完后更新变化。\n',
  items: '# 物品追踪\n\n## 关键物品\n| 物品 | 当前位置 | 状态 | 最后出现章节 |\n|------|---------|------|-------------|\n',
  environment: '# 环境追踪\n\n## 当前环境\n',
  materials: '# 物资追踪\n\n## 关键物资\n| 物资 | 数量 | 状态 | 最后出现章节 |\n|------|------|------|-------------|\n',
  repeat: '# 重复语句黑名单\n\n## 黑名单列表\n\n| 序号 | 重复内容 | 出现位置 | 重复次数 | 建议替代 |\n|------|---------|---------|---------|----------|\n',
  context: '# 写作进度\n\n- 最后完成章节：第0章\n- 状态：已初始化\n',
};

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const log = (m) => console.log(`${GREEN}[TRACK]${RESET} ${m}`);
const warn = (m) => console.log(`${YELLOW}[WARN]${RESET} ${m}`);
const err = (m) => console.error(`${RED}[ERROR]${RESET} ${m}`);

function readFile(p) {
  try { return fs.readFileSync(p, 'utf-8'); } catch { return null; }
}
function writeFile(p, c) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, c, 'utf-8');
}
function trackPath(projectDir, key) {
  return path.join(projectDir, TRACK_DIR, FILES[key]);
}
function countWords(text) {
  return text.replace(/[#*_`\[\](){}|\\~^>!-]/g, '').replace(/\s+/g, '').length;
}
// 从 追踪/上下文.md 解析「最后完成章节：第N章」
function getLastChapter(projectDir) {
  const c = readFile(trackPath(projectDir, 'context'));
  if (!c) return 0;
  const m = c.match(/最后完成章节[：:]\s*第\s*(\d+)\s*章/);
  return m ? parseInt(m[1], 10) : 0;
}

// ===== 初始化 =====
function doInit(projectDir) {
  const dirs = ['设定/角色', '设定/世界观', '大纲', '正文', TRACK_DIR];
  for (const d of dirs) {
    const full = path.join(projectDir, d);
    if (!fs.existsSync(full)) {
      fs.mkdirSync(full, { recursive: true });
      log(`创建目录：${d}`);
    }
  }
  for (const [k, tpl] of Object.entries(TEMPLATES)) {
    const fp = trackPath(projectDir, k);
    if (!fs.existsSync(fp)) {
      writeFile(fp, tpl);
      log(`创建追踪文件：${TRACK_DIR}/${FILES[k]}`);
    }
  }
  log('项目初始化完成');
  return 0;
}

// ===== 伏笔 =====
function addForeshadow(projectDir, chapterNum, texts, recovers) {
  const fp = trackPath(projectDir, 'foreshadow');
  let content = readFile(fp) || TEMPLATES.foreshadow;
  for (const t of texts) {
    const line = `- F${String(Date.now()).slice(-4)}: ${t}（第${chapterNum}章埋设）\n`;
    content = content.replace('## 待回收\n', `## 待回收\n${line}`);
    log(`埋设伏笔：第${chapterNum}章 — ${t}`);
  }
  for (const r of recovers) {
    if (content.includes(`- ${r}`)) {
      content = content.replace(`- ${r}`, `- ~~${r}~~`);
      log(`回收伏笔：${r}`);
    } else {
      warn(`未找到待回收伏笔：${r}`);
    }
  }
  writeFile(fp, content);
  return 0;
}

// ===== 时间线 =====
function addTimeline(projectDir, chapterNum, events) {
  const fp = trackPath(projectDir, 'timeline');
  let content = readFile(fp) || TEMPLATES.timeline;
  for (const e of events) {
    const line = `| 第${chapterNum}章 | ${e.time} | ${e.description} | ${e.characters} |\n`;
    // 追加到表格末尾（最后一个换行之前）
    if (content.endsWith('\n')) content = content.slice(0, -1);
    content += line;
    log(`记录时间线：第${chapterNum}章 — ${e.description}`);
  }
  content += '\n';
  writeFile(fp, content);
  return 0;
}

// ===== 角色状态 =====
function setCharacter(projectDir, name, updates) {
  const fp = trackPath(projectDir, 'character');
  let content = readFile(fp) || `# 角色状态追踪\n\n## ${name}\n`;
  // 确保有该角色段
  if (!content.includes(`## ${name}`)) {
    content += `\n## ${name}\n`;
  }
  const blockStart = content.indexOf(`## ${name}`);
  for (const [key, value] of Object.entries(updates)) {
    const re = new RegExp(`(^|\\n)([\\-*]?\\s*${escapeRe(key)}[：:]).*`, 'm');
    if (re.test(content.slice(blockStart))) {
      const local = content.slice(blockStart);
      const replaced = local.replace(re, `$1$2${value}`);
      content = content.slice(0, blockStart) + replaced;
      log(`更新角色[${name}] ${key}：${value}`);
    } else {
      // 在角色段末尾追加
      const insertAt = nextHeadingOrEnd(content, blockStart);
      const line = `- ${key}：${value}\n`;
      content = content.slice(0, insertAt) + line + content.slice(insertAt);
      log(`新增角色[${name}] ${key}：${value}`);
    }
  }
  writeFile(fp, content);
  return 0;
}
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function nextHeadingOrEnd(text, fromIdx) {
  const m = text.slice(fromIdx + 1).match(/\n##\s/);
  return m ? fromIdx + 1 + m.index : text.length;
}

// ===== 物品 =====
function addItem(projectDir, item) {
  const fp = trackPath(projectDir, 'items');
  let content = readFile(fp) || TEMPLATES.items;
  const line = `| ${item.name} | ${item.location} | ${item.status} | 第${item.chapter}章 |\n`;
  if (content.endsWith('\n')) content = content.slice(0, -1);
  content += line + '\n';
  writeFile(fp, content);
  log(`更新物品：${item.name} → ${item.location}（${item.status}）`);
  return 0;
}

// ===== 环境 =====
function setEnv(projectDir, env) {
  const fp = trackPath(projectDir, 'environment');
  let content = '# 环境追踪\n\n## 当前环境\n';
  for (const [k, v] of Object.entries(env)) {
    content += `- ${k}：${v}\n`;
    log(`更新环境 ${k}：${v}`);
  }
  writeFile(fp, content);
  return 0;
}

// ===== 重复语句黑名单 =====
function addRepeat(projectDir, repeats) {
  const fp = trackPath(projectDir, 'repeat');
  let content = readFile(fp) || TEMPLATES.repeat;
  let index = content.split('\n').filter((l) => l.match(/\|\s*\d+\s*\|/)).length;
  for (const r of repeats) {
    index++;
    const line = `| ${index} | ${r.content} | ${r.location} | ${r.count || 1} | ${r.alternative || ''} |\n`;
    if (content.endsWith('\n')) content = content.slice(0, -1);
    content += line + '\n';
    log(`记录重复语句：#${index} ${r.content}（${r.location}）`);
  }
  writeFile(fp, content);
  return 0;
}

// ===== 物资 =====
function setMaterial(projectDir, m) {
  const fp = trackPath(projectDir, 'materials');
  let content = readFile(fp) || TEMPLATES.materials;
  const line = `| ${m.name} | ${m.qty || ''} | ${m.status} | ${m.chapter ? '第' + m.chapter + '章' : ''} |\n`;
  if (content.endsWith('\n')) content = content.slice(0, -1);
  content += line + '\n';
  writeFile(fp, content);
  log(`更新物资：${m.name} → ${m.status}`);
  return 0;
}

// ===== 上下文（进度） =====
function updateContext(projectDir, chapterNum, summary) {
  const fp = trackPath(projectDir, 'context');
  const content = `# 写作进度

- 最后完成章节：第${chapterNum}章
- 更新时间：${new Date().toISOString().split('T')[0]}

## 当前状态

${summary}
`;
  writeFile(fp, content);
  log(`更新上下文：第${chapterNum}章完成`);
  return 0;
}

// ===== 写章后一键（机械可做的部分） =====
function afterChapter(projectDir, chapterNum, summary) {
  // 确保追踪结构存在
  for (const [k, tpl] of Object.entries(TEMPLATES)) {
    const fp = trackPath(projectDir, k);
    if (!fs.existsSync(fp)) writeFile(fp, tpl);
  }
  updateContext(projectDir, chapterNum, summary || `第${chapterNum}章完成`);

  // 统计正文字数
  const chapterFile = path.join(projectDir, '正文', `第${String(chapterNum).padStart(3, '0')}章.md`);
  let wc = 0;
  const c = readFile(chapterFile);
  if (c) wc = countWords(c);

  log(`正文字数：${wc}`);
  console.log('');
  console.log(`${YELLOW}提示：上下文已自动更新。请继续调用以下子命令补全语义类追踪（AI 从正文提取后传入）：${RESET}`);
  console.log('  add-foreshadow  埋设/回收伏笔');
  console.log('  add-timeline    记录时间线事件');
  console.log('  set-character   更新角色状态变化');
  console.log('  add-item        更新物品位置/状态');
  console.log('  set-env         更新环境（季节/天气/场景）');
  console.log('  add-repeat      追加重复语句黑名单');
  console.log('  set-material    更新物资（钱财/食物/工具）');
  console.log('');
  console.log('随后运行：node pipeline-gate.js gate post track <project-dir> --chapter ' + chapterNum);
  return 0;
}

// ===== 追读力（借鉴 webnovel-writer 设计思路，WB 原生纯 Markdown 重写） =====
const RP_FILE = '追读力.md';
function rpPath(projectDir) { return path.join(projectDir, TRACK_DIR, RP_FILE); }
const RP_TPL = '# 追读力追踪\n\n> 用途：量化「读者追读动力」。每章写完后由 AI 从正文提取钩子/爽点/微兑现后记录，\n> 用于下一章任务书注入（剩余≤5 或超期的钩子必须处理），维持读者追更欲望。\n> 可选真实数据回填（方案①）：从平台作家后台手抄「真实追读率/真实完读率」，填了则 pacing 信号改由真实率接管（结构性代理回退为参考）。\n> 支持多平台分别回填：起点（--qidian-rate/--qidian-finish）、番茄（--fanqie-rate/--fanqie-finish）；也可用 --real-rate/--real-finish 填通用值。\n\n## 章节追读力快照\n';

/**
 * 记录/更新某章的追读力快照。
 * @param {number} chapterNum
 * @param {object} opts { hookType, hookStrength, coolpoints:[], micropayoffs:[], hardViolations:[], debt }
 */
// 多平台真实数据回填（方案①）：起点 / 番茄；通用（--real-rate）向后兼容 v1.7.5
const RP_PLATFORMS = ['起点', '番茄'];
function buildRealRateLines(realRates, generic) {
  let out = '';
  for (const plat of RP_PLATFORMS) {
    const r = realRates && realRates[plat];
    if (r && (r.rate != null || r.finish != null)) {
      out += `- 真实追读率(${plat})：${r.rate != null ? r.rate : '—'}\n`;
      out += `- 真实完读率(${plat})：${r.finish != null ? r.finish : '—'}\n`;
    }
  }
  if (generic && (generic.rate != null || generic.finish != null)) {
    out += `- 真实追读率：${generic.rate != null ? generic.rate : '—'}\n`;
    out += `- 真实完读率：${generic.finish != null ? generic.finish : '—'}\n`;
  }
  if (!out) out = '- 真实数据：—（未回填，pacing 用结构性代理）\n';
  return out;
}

function doReadingPower(projectDir, chapterNum, opts) {
  const fp = rpPath(projectDir);
  let content = readFile(fp) || RP_TPL;
  const h = opts.hookType || '危机钩';
  const hs = opts.hookStrength || 'medium';
  const cps = (opts.coolpoints && opts.coolpoints.length) ? opts.coolpoints.join('、') : '—';
  const mps = (opts.micropayoffs && opts.micropayoffs.length) ? opts.micropayoffs.join('、') : '—';
  const hv = (opts.hardViolations && opts.hardViolations.length) ? opts.hardViolations.join('、') : '无';
  const debt = (opts.debt === undefined || opts.debt === null) ? 0 : opts.debt;
  // 可选真实数据回填（方案①）：从平台作家后台手抄；不填则为「—」，不影响结构性代理。
  // 支持多平台：起点/番茄（--qidian-* / --fanqie-*）及通用（--real-rate/--real-finish，向后兼容 v1.7.5）。
  const realRates = opts.realRates || {};
  const generic = (opts.realRate !== undefined && opts.realRate !== null)
    ? { rate: opts.realRate, finish: opts.realFinish }
    : null;
  const realLines = buildRealRateLines(realRates, generic);
  const block =
    `### 第${chapterNum}章\n` +
    `- 钩子类型：${h}　强度：${hs}\n` +
    `- 爽点模式：${cps}\n` +
    `- 微兑现：${mps}\n` +
    `- 硬约束违规：${hv}\n` +
    `- 债务余额：${debt}\n` +
    realLines;
  const re = new RegExp(`### 第${chapterNum}章[\\s\\S]*?(?=\\n### 第|$)`, 'm');
  if (re.test(content)) {
    content = content.replace(re, block.trimEnd());
    log(`更新追读力：第${chapterNum}章`);
  } else {
    if (!content.includes('## 章节追读力快照')) content += '\n## 章节追读力快照\n';
    content = content.replace('## 章节追读力快照\n', `## 章节追读力快照\n${block}`);
    log(`记录追读力：第${chapterNum}章`);
  }
  const realSummary = (() => {
    const parts = [];
    for (const p of RP_PLATFORMS) if (realRates[p] && realRates[p].rate != null) parts.push(`${p}${realRates[p].rate}%`);
    if (generic && generic.rate != null) parts.push(`通用${generic.rate}%`);
    return parts.length ? parts.join('/') : '—';
  })();
  log(`  钩子[${h}/${hs}] 爽点[${cps}] 微兑现[${mps}] 硬违规[${hv}] 债务[${debt}] 真实率[${realSummary}]`);
  writeFile(fp, content);
  return 0;
}

// ===== 极简 CLI 解析 =====
function getOpt(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return undefined;
}
// 支持多个同名 --flag（如 --coolpoint A --coolpoint B），可间隔出现
function getList(args, name) {
  const out = [];
  const flag = `--${name}`;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== flag) continue;
    let j = i + 1;
    while (j < args.length && !args[j].startsWith('--')) {
      out.push(args[j]);
      j++;
    }
    i = j - 1; // 跳过本组值，继续扫描后续同名 flag
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length < 2) {
    err('用法: node tracking-updater.js <project-dir> <command> [options]');
    return 1;
  }
  const projectDir = argv[0];
  const command = argv[1];
  const rest = argv.slice(2);

  if (!fs.existsSync(projectDir)) {
    err(`项目目录不存在: ${projectDir}`);
    return 1;
  }

  switch (command) {
    case 'init':
      return doInit(projectDir);

    case 'after-chapter': {
      const chapter = parseInt(getOpt(rest, 'chapter'), 10);
      if (!chapter) { err('缺少 --chapter N'); return 1; }
      return afterChapter(projectDir, chapter, getOpt(rest, 'summary'));
    }

    case 'add-foreshadow': {
      const chapter = parseInt(getOpt(rest, 'chapter'), 10) || getLastChapter(projectDir) || 0;
      const texts = getList(rest, 'text');
      const recovers = getList(rest, 'recover');
      if (!texts.length && !recovers.length) { err('需提供 --text "..." 或 --recover "..."'); return 1; }
      return addForeshadow(projectDir, chapter, texts, recovers);
    }

    case 'add-timeline': {
      const chapter = parseInt(getOpt(rest, 'chapter'), 10) || getLastChapter(projectDir) || 0;
      const ev = { time: getOpt(rest, 'time') || '—', description: getOpt(rest, 'desc') || '', characters: getOpt(rest, 'chars') || '—' };
      if (!ev.description) { err('缺少 --desc "..."'); return 1; }
      return addTimeline(projectDir, chapter, [ev]);
    }

    case 'set-character': {
      const name = getOpt(rest, 'name');
      const key = getOpt(rest, 'key');
      const value = getOpt(rest, 'value');
      if (!name || !key || !value) { err('需 --name --key --value'); return 1; }
      return setCharacter(projectDir, name, { [key]: value });
    }

    case 'add-item': {
      const item = {
        name: getOpt(rest, 'name'),
        location: getOpt(rest, 'loc') || '—',
        status: getOpt(rest, 'status') || '—',
        chapter: parseInt(getOpt(rest, 'chapter'), 10) || getLastChapter(projectDir) || 0,
      };
      if (!item.name) { err('缺少 --name "..."'); return 1; }
      return addItem(projectDir, item);
    }

    case 'set-env': {
      const key = getOpt(rest, 'key');
      const value = getOpt(rest, 'value');
      if (!key || !value) { err('需 --key --value'); return 1; }
      return setEnv(projectDir, { [key]: value });
    }

    case 'add-repeat': {
      const r = {
        content: getOpt(rest, 'content'),
        location: getOpt(rest, 'location') || '—',
        count: parseInt(getOpt(rest, 'count'), 10) || 1,
        alternative: getOpt(rest, 'alt') || '',
      };
      if (!r.content) { err('缺少 --content "..."'); return 1; }
      return addRepeat(projectDir, [r]);
    }

    case 'set-material': {
      const m = {
        name: getOpt(rest, 'name'),
        qty: getOpt(rest, 'qty'),
        status: getOpt(rest, 'status') || '—',
        chapter: parseInt(getOpt(rest, 'chapter'), 10) || getLastChapter(projectDir) || 0,
      };
      if (!m.name) { err('缺少 --name "..."'); return 1; }
      return setMaterial(projectDir, m);
    }

    case 'reading-power': {
      const rp = {
        hookType: getOpt(rest, 'hook-type'),
        hookStrength: getOpt(rest, 'hook-strength'),
        coolpoints: getList(rest, 'coolpoint'),
        micropayoffs: getList(rest, 'micropayoff'),
        hardViolations: getList(rest, 'hard-violation'),
        debt: (() => { const d = getOpt(rest, 'debt'); return d === undefined ? undefined : parseFloat(d); })(),
        realRate: getOpt(rest, 'real-rate'),
        realFinish: getOpt(rest, 'real-finish'),
        realRates: {
          起点: { rate: getOpt(rest, 'qidian-rate'), finish: getOpt(rest, 'qidian-finish') },
          番茄: { rate: getOpt(rest, 'fanqie-rate'), finish: getOpt(rest, 'fanqie-finish') },
        },
      };
      const ch = parseInt(getOpt(rest, 'chapter'), 10) || getLastChapter(projectDir) || 0;
      if (!ch) { err('缺少 --chapter N'); return 1; }
      return doReadingPower(projectDir, ch, rp);
    }

    default:
      err(`未知命令: ${command}`);
      return 1;
  }
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (e) {
    err(`执行失败: ${e && e.message ? e.message : e}`);
    process.exit(2);
  }
}

module.exports = {
  addForeshadow, addTimeline, setCharacter, addItem, setEnv, addRepeat,
  setMaterial, updateContext, afterChapter, doInit, getLastChapter, doReadingPower,
};
