#!/usr/bin/env node
'use strict';

/**
 * zidu-claw-story · 题材库检索与扩充（T3）
 * 用途：在 references/genres/ 的 37 篇题材模板之上，提供检索 / 筛选 / 查看 / 扩充能力。
 *       解决"37 篇看得眼花、不知道哪个适合自己赛道"的痛点。
 * 设计：零依赖。索引 = 内置审定种子(37) + 解析每篇 `> **核心卖点**：` 行；
 *       新用 add 创建的题材文件带 `<!-- meta: {...} -->` 注释，list/filter 优先读取，回退到种子。
 * 用法：
 *   node scripts/genre-library.js list                                  # 列出全部（带性别/平台/卖点）
 *   node scripts/genre-library.js search --kw 扮猪吃虎
 *   node scripts/genre-library.js filter --gender 女频 --platform 番茄 --tag 甜宠
 *   node scripts/genre-library.js show 修仙
 *   node scripts/genre-library.js stats
 *   node scripts/genre-library.js add 国运降维 --gender 男频 --platform 起点,番茄 --tags 国运,爽文,降维 --hook "全民穿越，国运绑定个人天赋"
 *   node scripts/genre-library.js scaffold 修仙 <项目目录>               # 把题材模板拷进项目设定基底
 */

const fs = require('fs');
const path = require('path');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m',
};

const GENRES_DIR = path.join(__dirname, '..', 'references', 'genres');

// —— 内置审定种子（37 篇现有题材的性别/平台/标签归类，供检索索引）——
const SEED = {
  '修仙': { gender: ['男频', '女频'], platforms: ['起点', '番茄', '纵横'], tags: ['爽文', '升级', '扮猪吃虎', '逆袭'] },
  '克苏鲁': { gender: ['男频'], platforms: ['起点', '豆瓣'], tags: ['恐怖', '未知', '诡秘', '脑洞'] },
  '历史古代': { gender: ['男频'], platforms: ['起点', '番茄'], tags: ['权谋', '争霸', '历史'] },
  '历史脑洞': { gender: ['男频'], platforms: ['起点', '番茄'], tags: ['脑洞', '历史', '爽文'] },
  '古言': { gender: ['女频'], platforms: ['晋江', '番茄'], tags: ['古装', '言情', '甜宠'] },
  '多子多福': { gender: ['女频'], platforms: ['番茄', '起点'], tags: ['种田', '温馨', '女频'] },
  '女频悬疑': { gender: ['女频'], platforms: ['晋江', '番茄'], tags: ['悬疑', '推理', '女频'] },
  '宫斗宅斗': { gender: ['女频'], platforms: ['晋江', '番茄'], tags: ['宫斗', '宅斗', '言情'] },
  '年代': { gender: ['女频'], platforms: ['番茄', '晋江'], tags: ['年代', '种田', '温馨'] },
  '幻想言情': { gender: ['女频'], platforms: ['晋江', '起点'], tags: ['奇幻', '言情', '甜'] },
  '悬疑灵异': { gender: ['女频', '男频'], platforms: ['番茄', '起点'], tags: ['悬疑', '灵异', '恐怖'] },
  '悬疑脑洞': { gender: ['男频', '女频'], platforms: ['起点', '番茄'], tags: ['悬疑', '脑洞', '反转'] },
  '抗战谍战': { gender: ['男频'], platforms: ['起点', '番茄'], tags: ['谍战', '抗战', '权谋'] },
  '无限流': { gender: ['男频'], platforms: ['起点', '番茄'], tags: ['无限', '爽文', '智斗'] },
  '替身文': { gender: ['女频'], platforms: ['晋江', '番茄'], tags: ['替身', '虐恋', '言情'] },
  '末世': { gender: ['男频', '女频'], platforms: ['起点', '番茄'], tags: ['末世', '生存', '爽文'] },
  '民国言情': { gender: ['女频'], platforms: ['晋江', '番茄'], tags: ['民国', '言情', '甜虐'] },
  '游戏体育': { gender: ['男频'], platforms: ['起点', '番茄'], tags: ['电竞', '体育', '热血'] },
  '狗血言情': { gender: ['女频'], platforms: ['番茄', '晋江'], tags: ['狗血', '虐', '言情'] },
  '现实题材': { gender: ['男频', '女频'], platforms: ['起点', '豆瓣'], tags: ['现实', '写实'] },
  '现言脑洞': { gender: ['女频'], platforms: ['晋江', '番茄'], tags: ['现言', '脑洞', '言情'] },
  '电竞': { gender: ['男频'], platforms: ['起点', '番茄'], tags: ['电竞', '热血', '爽文'] },
  '直播文': { gender: ['男频', '女频'], platforms: ['番茄', '起点'], tags: ['直播', '娱乐', '爽文'] },
  '知乎短篇': { gender: ['男频', '女频'], platforms: ['知乎'], tags: ['短篇', '反转', '盐言'] },
  '种田': { gender: ['女频', '男频'], platforms: ['番茄', '起点'], tags: ['种田', '温馨', '经营'] },
  '科幻': { gender: ['男频'], platforms: ['起点', '豆瓣'], tags: ['科幻', '硬核', '脑洞'] },
  '系统流': { gender: ['男频'], platforms: ['起点', '番茄'], tags: ['系统', '爽文', '金手指'] },
  '职场婚恋': { gender: ['女频'], platforms: ['晋江', '番茄'], tags: ['职场', '婚恋', '言情'] },
  '西幻': { gender: ['男频', '女频'], platforms: ['起点', '晋江'], tags: ['西幻', '魔法', '冒险'] },
  '规则怪谈': { gender: ['男频', '女频'], platforms: ['起点', '番茄'], tags: ['怪谈', '规则', '恐怖'] },
  '豪门总裁': { gender: ['女频'], platforms: ['番茄', '晋江'], tags: ['豪门', '总裁', '甜宠'] },
  '都市异能': { gender: ['男频', '女频'], platforms: ['起点', '番茄'], tags: ['都市', '异能', '爽文'] },
  '都市日常': { gender: ['女频', '男频'], platforms: ['番茄', '起点'], tags: ['日常', '温馨', '生活'] },
  '都市脑洞': { gender: ['男频'], platforms: ['起点', '番茄'], tags: ['都市', '脑洞', '爽文'] },
  '青春甜宠': { gender: ['女频'], platforms: ['晋江', '番茄'], tags: ['青春', '甜宠', '校园'] },
  '高武': { gender: ['男频'], platforms: ['起点', '番茄'], tags: ['高武', '战斗', '爽文'] },
  '黑暗题材': { gender: ['男频'], platforms: ['起点', '豆瓣'], tags: ['黑暗', '致郁', '深度'] },
};

function readGenres() {
  if (!fs.existsSync(GENRES_DIR)) return [];
  const files = fs.readdirSync(GENRES_DIR).filter((f) => f.endsWith('.md'));
  const out = [];
  for (const f of files) {
    const name = f.replace(/\.md$/, '');
    const full = fs.readFileSync(path.join(GENRES_DIR, f), 'utf-8');
    const meta = parseMeta(full);
    const hook = parseHook(full);
    out.push({ name, file: f, meta, hook, body: full });
  }
  out.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
  return out;
}

function parseMeta(full) {
  const m = full.match(/<!--\s*meta:\s*(\{[\s\S]*?\})\s*-->/);
  if (m) {
    try {
      const obj = JSON.parse(m[1]);
      return {
        gender: Array.isArray(obj.gender) ? obj.gender : (obj.gender ? [obj.gender] : []),
        platforms: Array.isArray(obj.platforms) ? obj.platforms : (obj.platforms ? [obj.platforms] : []),
        tags: Array.isArray(obj.tags) ? obj.tags : (obj.tags ? obj.tags.split(',') : []),
      };
    } catch (_) { /* fall through */ }
  }
  return null;
}

function parseHook(full) {
  const m = full.match(/>\s*\*\*`?核心卖点`?\*\*?\s*[:：]\s*(.+)/);
  if (m) return m[1].replace(/\*+/g, '').trim();
  const m2 = full.match(/核心卖点[:：]\s*(.+)/);
  return m2 ? m2[1].trim() : '';
}

function metaFor(name) {
  const g = readGenres().find((x) => x.name === name);
  if (g && g.meta) return g.meta;
  const seed = SEED[name];
  return seed || { gender: [], platforms: [], tags: [] };
}

function colorGender(g) {
  if (g.includes('女频') && g.includes('男频')) return C.cyan + '双频' + C.reset;
  if (g.includes('女频')) return C.magenta + '女频' + C.reset;
  if (g.includes('男频')) return C.blue + '男频' + C.reset;
  return C.dim + '—' + C.reset;
}

function cmdList() {
  const gs = readGenres();
  console.log(C.bold + `题材库（共 ${gs.length} 篇）` + C.reset);
  console.log(C.dim + '─'.repeat(72) + C.reset);
  gs.forEach((g, i) => {
    const hook = g.hook ? g.hook.slice(0, 34) + (g.hook.length > 34 ? '…' : '') : C.dim + '(无核心卖点)' + C.reset;
    console.log(
      String(i + 1).padStart(2, ' ') + '. ' +
      C.bold + g.name + C.reset + '  ' +
      colorGender(g.meta ? g.meta.gender : metaFor(g.name).gender) + '  ' +
      C.dim + '[' + (g.meta ? g.meta.platforms : metaFor(g.name).platforms).join('/') + ']' + C.reset
    );
    console.log('     ' + C.dim + '卖点：' + C.reset + hook);
  });
  console.log(C.dim + '─'.repeat(72) + C.reset);
  console.log(C.dim + '用 `show <题材>` 看详情，`search --kw` 检索，`filter` 按性别/平台/标签筛。' + C.reset);
}

function cmdSearch(kw) {
  if (!kw) { console.error(C.red + 'search 需要 --kw 关键词' + C.reset); process.exit(2); }
  const k = kw.toLowerCase();
  const gs = readGenres().filter((g) => {
    const m = g.meta || metaFor(g.name);
    const hay = [g.name, g.hook, (m.tags || []).join(' '), (m.platforms || []).join(' '), g.body].join(' ').toLowerCase();
    return hay.includes(k);
  });
  if (!gs.length) { console.log(C.yellow + `未找到含 "${kw}" 的题材。` + C.reset); return; }
  console.log(C.bold + `检索 "${kw}" → ${gs.length} 篇：` + C.reset);
  gs.forEach((g) => console.log('  • ' + C.bold + g.name + C.reset + ' — ' + (g.hook || '')));
}

function matchFlag(arr, val) {
  if (!val) return true;
  const v = val.split(',').map((s) => s.trim());
  return v.every((x) => (arr || []).includes(x));
}

function cmdFilter(opts) {
  const gs = readGenres().filter((g) => {
    const m = g.meta || metaFor(g.name);
    return matchFlag(m.gender, opts.gender) && matchFlag(m.platforms, opts.platform) && matchFlag(m.tags, opts.tag);
  });
  const cond = [
    opts.gender && `性别=${opts.gender}`,
    opts.platform && `平台=${opts.platform}`,
    opts.tag && `标签=${opts.tag}`,
  ].filter(Boolean).join(' & ');
  if (!gs.length) { console.log(C.yellow + `无符合 [${cond}] 的题材。` + C.reset); return; }
  console.log(C.bold + `筛选 [${cond}] → ${gs.length} 篇：` + C.reset);
  gs.forEach((g) => console.log('  • ' + C.bold + g.name + C.reset + '  ' + colorGender((g.meta || metaFor(g.name)).gender)));
}

function cmdShow(name) {
  const g = readGenres().find((x) => x.name === name);
  if (!g) { console.error(C.red + `未找到题材 "${name}"` + C.reset); process.exit(2); }
  console.log(g.body);
}

function cmdStats() {
  const gs = readGenres();
  const byGender = {}, byPlatform = {};
  for (const g of gs) {
    const m = g.meta || metaFor(g.name);
    for (const x of (m.gender || [])) byGender[x] = (byGender[x] || 0) + 1;
    for (const x of (m.platforms || [])) byPlatform[x] = (byPlatform[x] || 0) + 1;
  }
  console.log(C.bold + '题材库统计（共 ' + gs.length + ' 篇）' + C.reset);
  console.log(C.dim + '— 按性别 —' + C.reset);
  Object.entries(byGender).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log(C.dim + '— 按平台 —' + C.reset);
  Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

function cmdAdd(name, opts) {
  if (!name) { console.error(C.red + 'add 需要题材名' + C.reset); process.exit(2); }
  if (fs.existsSync(path.join(GENRES_DIR, name + '.md'))) {
    console.error(C.red + `题材 "${name}" 已存在。` + C.reset); process.exit(2);
  }
  const gender = (opts.gender || '').split(',').map((s) => s.trim()).filter(Boolean);
  const platforms = (opts.platform || '').split(',').map((s) => s.trim()).filter(Boolean);
  const tags = (opts.tags || '').split(',').map((s) => s.trim()).filter(Boolean);
  const hook = opts.hook || '（待补充核心卖点）';
  const meta = { gender, platforms, tags };
  const tpl = [
    `<!-- meta: ${JSON.stringify(meta)} -->`,
    `# ${name}题材模板`,
    '',
    `> **核心卖点**：${hook}`,
    '',
    '## 1. 核心流派/细分',
    '- （待补充：本题材下常见细分写法）',
    '',
    '## 2. 世界观/设定要素',
    '- （待补充）',
    '',
    '## 3. 经典爽点套路',
    '- （待补充）',
    '',
    '## 4. 大纲节奏建议',
    '- （待补充）',
    '',
    '## 5. 常见雷区/禁忌',
    '- （待补充）',
    '',
  ].join('\n');
  fs.writeFileSync(path.join(GENRES_DIR, name + '.md'), tpl, 'utf-8');
  console.log(C.green + `已新增题材模板：` + C.reset + C.bold + name + C.reset);
  console.log('  性别：' + gender.join('/') + '  平台：' + platforms.join('/') + '  标签：' + tags.join('/'));
  console.log('  文件：references/genres/' + name + '.md');
}

function cmdScaffold(name, projectDir) {
  if (!name || !projectDir) { console.error(C.red + 'scaffold 需要 <题材> <项目目录>' + C.reset); process.exit(2); }
  const g = readGenres().find((x) => x.name === name);
  if (!g) { console.error(C.red + `未找到题材 "${name}"` + C.reset); process.exit(2); }
  if (!fs.existsSync(projectDir)) { console.error(C.red + `项目目录不存在：${projectDir}` + C.reset); process.exit(2); }
  const destDir = path.join(projectDir, '设定');
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, `题材基底_${name}.md`);
  let content = g.body.replace(/^# .+\n/, `# ${name}题材基底（开书设定参考）\n`);
  content += '\n\n> 本文件由 `genre-library.js scaffold` 生成，作为本书设定基底。请在此基础上补全本书独有设定。\n';
  fs.writeFileSync(dest, content, 'utf-8');
  console.log(C.green + `已把题材模板写入：` + C.reset + dest);
}

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  const getOpt = (k) => {
    const i = args.indexOf(k);
    return i >= 0 && args[i + 1] ? args[i + 1] : '';
  };
  const opts = {
    gender: getOpt('--gender'),
    platform: getOpt('--platform'),
    tag: getOpt('--tag'),
    tags: getOpt('--tags'),
    kw: getOpt('--kw'),
    hook: getOpt('--hook'),
  };
  switch (sub) {
    case 'list': return cmdList();
    case 'search': return cmdSearch(opts.kw);
    case 'filter': return cmdFilter(opts);
    case 'show': return cmdShow(args[1]);
    case 'stats': return cmdStats();
    case 'add': return cmdAdd(args[1], opts);
    case 'scaffold': return cmdScaffold(args[1], args[2]);
    default:
      console.error(C.red + '未知子命令或缺少参数：' + (sub || '(空)') + C.reset);
      console.error('用法：list | search --kw X | filter [--gender] [--platform] [--tag] | show <题材> | stats | add <题材> --gender --platform --tags --hook | scaffold <题材> <项目目录>');
      process.exit(2);
  }
}

module.exports = { readGenres, metaFor, SEED };
if (require.main === module) main();
