#!/usr/bin/env node
'use strict';

/**
 * zidu-claw-story · 自动生成本书设定卡（T3）
 * 用途：把散落的设定文件 consolidate 成一张「本书设定卡」，并在设定稀疏时从正文
 *       确定性抽取人物/地点/组织候选，产出供 LLM 补全的草稿（本脚本不调用 LLM）。
 * 设计：零依赖。三个子命令：
 *   build      合并 设定/ 下所有 .md 为 设定/本书设定卡.md
 *   extract    扫描 正文/ 确定性抽取候选实体（引号说话人 + 称谓头衔 + 姓氏名），标 ⚠️ 待补全
 *   llm-prompt 输出一段可直接粘贴给 LLM 的扩写/补全提示词
 * 用法：
 *   node scripts/setting-cards.js <项目目录> build
 *   node scripts/setting-cards.js <项目目录> extract [--json]
 *   node scripts/setting-cards.js <项目目录> llm-prompt
 */

const fs = require('fs');
const path = require('path');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜戚谢邹喻柏水窦章云苏潘葛奚范彭郎鲁韦昌马苗凤花方俞任袁柳';
const TITLES = ['将军', '元帅', '总裁', '少爷', '小姐', '公子', '公主', '殿下', '王爷', '陛下', '皇帝',
  '老板', '老师', '教授', '医生', '警官', '队长', '盟主', '宗主', '圣女', '太子', '夫人', '少夫人',
  '大人', '阁主', '城主', '府主', '长老', '掌门', '教主', '帝尊', '仙尊', '魔尊', '神王', '龙王'];

function readProject(projectDir) {
  if (!fs.existsSync(projectDir)) { console.error(C.red + `项目目录不存在：${projectDir}` + C.reset); process.exit(2); }
  return projectDir;
}

function collectMd(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (d) => {
    for (const e of fs.readdirSync(d)) {
      const p = path.join(d, e);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (e.endsWith('.md') && e !== '本书设定卡.md') out.push(p);
    }
  };
  walk(dir);
  return out;
}

function readChapters(projectDir) {
  const dir = path.join(projectDir, '正文');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b, 'zh'))
    .map((f) => ({ name: f, text: fs.readFileSync(path.join(dir, f), 'utf-8') }));
}

// ——— build：合并设定 ———
function cmdBuild(projectDir) {
  readProject(projectDir);
  const setDir = path.join(projectDir, '设定');
  const files = collectMd(setDir);
  const lines = [];
  lines.push('# 本书设定卡');
  lines.push('');
  lines.push('> 由 `setting-cards.js build` 自动合并 `设定/` 下所有文档生成。修改请以源文件为准。');
  lines.push('');
  if (!files.length) {
    lines.push(C.yellow + '（设定目录为空，未合并到任何内容。可用 `extract` 从正文抽取候选，或先补全设定。）' + C.reset);
  } else {
    // 按子目录分组
    const groups = {};
    for (const f of files) {
      const rel = path.relative(setDir, f);
      const top = rel.split(path.sep)[0].replace(/\.md$/, '');
      (groups[top] = groups[top] || []).push(f);
    }
    for (const g of Object.keys(groups).sort()) {
      lines.push('## ' + g);
      lines.push('');
      for (const f of groups[g]) {
        const body = fs.readFileSync(f, 'utf-8').replace(/^# .*\n/, '').trim();
        if (body) lines.push(body);
        lines.push('');
      }
    }
  }
  const dest = path.join(setDir, '本书设定卡.md');
  fs.mkdirSync(setDir, { recursive: true });
  fs.writeFileSync(dest, lines.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n', 'utf-8');
  console.log(C.green + `已生成设定卡：` + C.reset + dest);
  console.log(C.dim + `（合并 ${files.length} 个设定文件）` + C.reset);
}

// ——— extract：确定性抽取候选实体 ———
function extractEntities(chapters) {
  const persons = new Map();
  const orgs = new Set();
  const places = new Set();
  const pushPerson = (name) => {
    if (!name || name.length < 2 || name.length > 6) return;
    if (/[的了吗呢吧啊哟哇嗯哦]/u.test(name)) return; // 过滤语气/助词误抓
    persons.set(name, (persons.get(name) || 0) + 1);
  };
  const TITLE_RE = new RegExp('([' + SURNAMES + '][\\u4e00-\\u9fa5]{1,3})(' + TITLES.join('|') + ')', 'g');
  const SPEAK_RE = /[""「『]([^""「『]{1,8})[""』」]\s*(?:说|道|问|喊|骂|笑|答|冷声|低声|轻声|怒|叹|嘟囔|嘀咕)/g;
  const NAME_RE = new RegExp('([' + SURNAMES + '][\\u4e00-\\u9fa5]{1,2})(?=[\u4e00-\u9fa5])', 'g');

  for (const ch of chapters) {
    const t = ch.text;
    let m;
    while ((m = TITLE_RE.exec(t))) pushPerson(m[1] + m[2]);
    while ((m = SPEAK_RE.exec(t))) pushPerson(m[1].trim());
    while ((m = NAME_RE.exec(t))) {
      // 仅当该姓氏+名后接动词/称谓才更可信，这里作为弱候选
      const nm = m[1];
      if (!/[的了吗呢吧啊在是与被把给让]/u.test(nm)) pushPerson(nm);
    }
    // 组织/地点弱信号（含"宫/殿/门/宗/阁/府/城/国/界"等）
    const ORG_RE = /([\u4e00-\u9fa5]{1,4})(?:宗|门|阁|殿|宫|府|城|国|宗门|学院|联盟|集团|公司|部落|王朝)/g;
    while ((m = ORG_RE.exec(t))) orgs.add(m[0]);
    const PLACE_RE = /([\u4e00-\u9fa5]{1,5})(?:城|镇|村|山|河|海|林|谷|大陆|界域|秘境|平原|州|域)/g;
    while ((m = PLACE_RE.exec(t))) places.add(m[0]);
  }
  const personsArr = [...persons.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([n, c]) => ({ name: n, count: c }));
  return {
    persons: personsArr,
    orgs: [...orgs].slice(0, 20),
    places: [...places].slice(0, 20),
  };
}

function cmdExtract(projectDir, asJson) {
  readProject(projectDir);
  const chapters = readChapters(projectDir);
  if (!chapters.length) { console.error(C.red + '正文目录为空或无 .md 章节。' + C.reset); process.exit(2); }
  const data = extractEntities(chapters);
  if (asJson) { console.log(JSON.stringify(data, null, 2)); return; }
  console.log(C.bold + '从正文确定性抽取到的候选实体（⚠️ 待 LLM / 你人工补全核验）：' + C.reset);
  console.log(C.cyan + '\n【人物候选】' + C.reset + '（按出现频次，含误抓可能）');
  data.persons.forEach((p) => console.log(`  ${p.count.toString().padStart(3)}  ${p.name}  ⚠️`));
  console.log(C.cyan + '\n【组织/势力候选】' + C.reset);
  console.log('  ' + (data.orgs.join('、') || C.dim + '(无)' + C.reset));
  console.log(C.cyan + '\n【地点候选】' + C.reset);
  console.log('  ' + (data.places.join('、') || C.dim + '(无)' + C.reset));
  console.log(C.dim + '\n提示：运行 `llm-prompt` 获取补全提示词，把上面候选喂给 LLM 生成正式设定卡。' + C.reset);
}

// ——— llm-prompt：产出补全提示词 ———
function getTitle(projectDir) {
  for (const rel of ['设定/书名.md', '大纲/书名.md', '书名.md']) {
    const p = path.join(projectDir, rel);
    if (fs.existsSync(p)) {
      const line = fs.readFileSync(p, 'utf-8').split('\n').find((l) => l.trim());
      if (line) return line.replace(/^#\s*/, '').replace(/^《|》$/g, '').trim();
    }
  }
  return path.basename(path.resolve(projectDir));
}

function cmdLlmPrompt(projectDir) {
  readProject(projectDir);
  const chapters = readChapters(projectDir);
  const data = chapters.length ? extractEntities(chapters) : { persons: [], orgs: [], places: [] };
  const title = getTitle(projectDir);
  const personsStr = data.persons.map((p) => p.name).join('、') || '（未抽取到）';
  const orgsStr = data.orgs.join('、') || '（无）';
  const placesStr = data.places.join('、') || '（无）';
  const prompt = [
    `# 任务：为网文《${title}》生成结构化设定卡`,
    '',
    `## 我已从正文中确定性抽取到以下候选实体（可能有误抓，请核验并去噪）：`,
    `- 人物候选：${personsStr}`,
    `- 组织/势力候选：${orgsStr}`,
    `- 地点候选：${placesStr}`,
    '',
    `## 请基于${chapters.length ? `本书现有 ${chapters.length} 章正文` : '已知信息'}，输出 JSON：`,
    '```json',
    '{',
    '  "书名": "...",',
    '  "核心梗概": "...(一句话)",',
    '  "人物卡": [ { "姓名":"", "身份/头衔":"", "性格":"", "动机":"", "与主角关系":"", "高光时刻":"" } ],',
    '  "世界观": { "力量体系":"", "核心矛盾":"", "地图/势力格局":"" },',
    '  "势力与组织": [ { "名称":"", "立场":"", "关键人物":"" } ],',
    '  "关键物品/金手指": [ { "名称":"", "作用":"" } ],',
    '  "时间锚点与核心伏笔": [ { "锚点":"", "伏笔":"" } ]',
    '}',
    '```',
    '',
    '要求：去噪、补全空缺、保持与正文已写内容一致（不得与已有事实矛盾）。',
  ].join('\n');
  console.log(prompt);
}

function main() {
  const args = process.argv.slice(2);
  const projectDir = args[0];
  const sub = args[1];
  const asJson = args.includes('--json');
  if (!projectDir) {
    console.error(C.red + '需要 <项目目录>' + C.reset);
    process.exit(2);
  }
  switch (sub) {
    case 'build': return cmdBuild(projectDir);
    case 'extract': return cmdExtract(projectDir, asJson);
    case 'llm-prompt': return cmdLlmPrompt(projectDir);
    default:
      console.error(C.red + '未知子命令：' + (sub || '(空)') + C.reset);
      console.error('用法：<项目目录> build | extract [--json] | llm-prompt');
      process.exit(2);
  }
}

module.exports = { extractEntities, collectMd };
if (require.main === module) main();
