#!/usr/bin/env node
'use strict';

/**
 * zidu-claw-story · 多平台发布物料（T3）
 * 用途：为章节更新 / 新书宣发，按目标平台语气批量生成发布文案（章推 / 书评 / 求追读）。
 * 设计：零依赖、模板化（确定性）。遵循用户平台适配规则（微博信息流 / 小红书竖版短文 / 知乎长文 /
 *       微信公号 / 头条 / B站 / 抖音竖版 等）。`--llm` 改输出「扩写提示词」而非成稿，交由 LLM 润色。
 * 用法：
 *   node scripts/promo-pack.js chapter <项目目录> --chapter N --platform 起点 [--title 书名] [--llm]
 *   node scripts/promo-pack.js book    <项目目录> --platform 小红书 [--title 书名] [--llm]
 */

const fs = require('fs');
const path = require('path');

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
};

// 平台适配规则（取自用户跨项目约定：平台 → 语气/长度/标签/emoji）
const PLATFORMS = {
  起点: { tone: '书友向，留钩子不剧透，强调"追更爽点"', length: '中（80-120字）', hashtag: false, emoji: false },
  番茄: { tone: '快节奏、强钩子、下沉口语，强调"免费爽看"', length: '短（60-100字）', hashtag: true, emoji: true },
  微博: { tone: '信息流短文，话题化，@式互动感', length: '短（60-100字）', hashtag: true, emoji: true },
  小红书: { tone: '竖版滑动短文，第一人称安利，emoji 分段，强种草', length: '中短（80-140字）', hashtag: true, emoji: true },
  知乎: { tone: '长文风，先抛观点/悬念再安利，像回答', length: '长（150-250字）', hashtag: false, emoji: false },
  微信: { tone: '公众号风，标题党+正文娓娓道来，克制 emoji', length: '中（120-180字）', hashtag: false, emoji: false },
  头条: { tone: '资讯风，一句话亮点+三段式', length: '中（100-150字）', hashtag: true, emoji: false },
  B站: { tone: '投稿风，UP主口吻，强调"这书适合谁看"', length: '中短（80-140字）', hashtag: true, emoji: true },
  抖音: { tone: '竖版口播风，前3秒钩子，强情绪', length: '极短（40-80字）', hashtag: true, emoji: true },
};

function getTitle(projectDir, override) {
  if (override) return override;
  for (const rel of ['设定/书名.md', '大纲/书名.md', '书名.md']) {
    const p = path.join(projectDir, rel);
    if (fs.existsSync(p)) {
      const line = fs.readFileSync(p, 'utf-8').split('\n').find((l) => l.trim());
      if (line) return line.replace(/^#\s*/, '').replace(/^《|》$/g, '').trim();
    }
  }
  return path.basename(path.resolve(projectDir));
}

function getChapter(projectDir, n) {
  const dir = path.join(projectDir, '正文');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md'));
  // 优先精确匹配 第N章
  const exact = files.find((f) => new RegExp('第\\s*' + n + '\\s*章').test(f));
  const file = exact || files.sort((a, b) => a.localeCompare(b, 'zh'))[Math.max(0, (parseInt(n, 10) || 1) - 1)];
  if (!file) return null;
  const text = fs.readFileSync(path.join(dir, file), 'utf-8');
  const title = (text.match(/^#\s*(.+)/) || [, file])[1];
  const body = text.replace(/^#.*\n/, '').replace(/[#*`>]/g, '').replace(/\n{2,}/g, '\n').trim();
  let hook = body.split(/[。！？!?]/)[0].slice(0, 60).trim();
  hook = hook.replace(/^[""「『]+|[""』」]+$/g, '');
  return { file, title, hook };
}

function fill(tpl, vars) {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '');
}

function renderChapter(platform, vars) {
  const P = PLATFORMS[platform] || PLATFORMS['起点'];
  const emoji = P.emoji ? '✨' : '';
  const tag = P.hashtag ? `\n\n#${vars.title}# #网文推荐# #${platform}好书#` : '';
  const templates = {
    起点: `《{{title}}》第{{n}}章已更。\n{{hook}}……这一章的爽点埋得很稳，建议直接从这章追。书友们，评论区聊聊你猜下一步怎么爆？`,
    番茄: `${emoji}《{{title}}》第{{n}}章更新！${emoji}\n{{hook}}……免费看到爽，这章直接上头，点开就不想退。`,
    微博: `【《{{title}}》更新】第{{n}}章：{{hook}}……\n追更的举个手🙋 这章你打几分？${tag}`,
    小红书: `${emoji}挖到一本停不下来的《{{title}}》！第{{n}}章刚更～\n{{hook}}……\n真的越看越上头，强推给喜欢爽文的姐妹💡${tag}`,
    知乎: `如何评价《{{title}}》第{{n}}章？\n这一章其实挺能说明作者功底：开头用「{{hook}}」直接把人拽进去，中段节奏不拖，结尾留的钩子正好卡在追更欲最强的位置。整体属于"放心追、不会烂尾"的类型。`,
    微信: `《{{title}}》第{{n}}章更新：{{hook}}……\n这一章把前面的伏笔往前推了一步，建议老读者回看前文找彩蛋。新朋友可从最新章直接入坑。`,
    头条: `《{{title}}》第{{n}}章更新：{{hook}}。\n本章节奏紧凑，爽点与伏笔并行；适合作者型读者细品。${tag}`,
    B站: `【书籍安利】{{title}} 第{{n}}章更新！\n{{hook}}……这书适合喜欢"开局即高潮、越往后越上头"的观众，强烈建议三连追更～${tag}`,
    抖音: `${emoji}第{{n}}章直接封神！{{hook}}……\n这本书我熬夜看完了，信我，入坑不亏！${tag}`,
  };
  return fill(templates[platform] || templates['起点'], vars);
}

function renderBook(platform, vars) {
  const P = PLATFORMS[platform] || PLATFORMS['起点'];
  const emoji = P.emoji ? '🔥' : '';
  const tag = P.hashtag ? `\n\n#${vars.title}# #网文安利# #${platform}推书#` : '';
  const templates = {
    起点: `【求追读】《{{title}}》\n{{hook}}……目前已铺开主线，人设和金手指都已立住。喜欢稳扎稳打爽文的兄弟，这本可以进书架了。`,
    番茄: `${emoji}《{{title}}》真香警告！${emoji}\n{{hook}}……免费爽文，章节飞快，通勤路上根本停不下来。`,
    微博: `最近在追《{{title}}》，{{hook}}……\n写得太对胃口了，安利给同好，评论区蹲一波书友📚${tag}`,
    小红书: `${emoji}无限回购的宝藏文《{{title}}》！\n{{hook}}……\n姐妹们信我，这本属于"打开就舍不得关"的类型💡${tag}`,
    知乎: `有哪些值得熬夜追的网文？\n推荐《{{title}}》。它的核心钩子在于「{{hook}}」，作者没有一上来就堆设定，而是用情节把人带进去，爽点和情绪曲线都算克制但有后劲。属于可以放心追更的那一类。`,
    微信: `今天想认真安利一本《{{title}}》。\n{{hook}}……它最难得的是节奏稳，不靠堆砌金手指凑字数。适合想安静看本书的朋友。`,
    头条: `《{{title}}》值得一读：{{hook}}。\n作品主线清晰、更新稳定，适合大众读者。${tag}`,
    B站: `【推书】这本《{{title}}》我可以！\n{{hook}}……风格偏"慢热但后劲大"，适合喜欢细节和设定的观众，建议关注追更～${tag}`,
    抖音: `${emoji}这本书不看后悔！{{hook}}……\n熬夜追完，质量在线，入坑不亏！${tag}`,
  };
  return fill(templates[platform] || templates['起点'], vars);
}

function llmPrompt(kind, platform, vars) {
  return [
    `# 任务：为网文《${vars.title}》写一条「${kind === 'chapter' ? `第${vars.n}章章推` : '新书安利'}」发布文案`,
    '',
    `## 目标平台：${platform}`,
    `平台调性：${(PLATFORMS[platform] || PLATFORMS['起点']).tone}`,
    `建议长度：${(PLATFORMS[platform] || PLATFORMS['起点']).length}`,
    `是否带话题标签：${(PLATFORMS[platform] || PLATFORMS['起点']).hashtag ? '是' : '否'}；是否用 emoji：${(PLATFORMS[platform] || PLATFORMS['起点']).emoji ? '是' : '否'}`,
    '',
    `## 已知素材：`,
    `- 书名：《${vars.title}》`,
    kind === 'chapter' ? `- 章节：第${vars.n}章（${vars.chTitle || ''}）` : '',
    `- 钩子/亮点：${vars.hook || '（请自行提炼）'}`,
    '',
    `## 输出要求：`,
    `1. 严格贴合平台调性，不要跨平台混用语气；`,
    `2. 不剧透关键反转，只留钩子；`,
    `3. 口语自然，去 AI 味；`,
    `4. 直接给最终文案，无需解释。`,
  ].filter(Boolean).join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const kind = args[0]; // chapter | book
  const projectDir = args[1];
  const getOpt = (k) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : ''; };
  const platform = getOpt('--platform') || '起点';
  const title = getOpt('--title');
  const asLlm = args.includes('--llm');
  const n = getOpt('--chapter') || (kind === 'chapter' ? '1' : '');

  if (!['chapter', 'book'].includes(kind) || !projectDir) {
    console.error(C.red + '用法：chapter <项目目录> --chapter N --platform X [--title] [--llm] | book <项目目录> --platform X [--title] [--llm]' + C.reset);
    process.exit(2);
  }
  if (!fs.existsSync(projectDir)) { console.error(C.red + `项目目录不存在：${projectDir}` + C.reset); process.exit(2); }
  if (!PLATFORMS[platform]) {
    console.error(C.red + `未知平台 "${platform}"。可选：` + Object.keys(PLATFORMS).join('/') + C.reset);
    process.exit(2);
  }

  const t = getTitle(projectDir, title);
  let ch = null;
  if (kind === 'chapter') ch = getChapter(projectDir, n);
  const vars = {
    title: t,
    n: n,
    chTitle: ch ? ch.title : '',
    hook: ch ? ch.hook : '',
  };

  if (asLlm) {
    console.log(llmPrompt(kind, platform, vars));
    return;
  }

  let out;
  if (kind === 'chapter') {
    if (!ch) { console.error(C.red + `未找到第 ${n} 章正文。` + C.reset); process.exit(2); }
    out = renderChapter(platform, vars);
    console.log(C.bold + `【章推 · ${platform}】 《${t}》第${n}章` + C.reset);
  } else {
    out = renderBook(platform, vars);
    console.log(C.bold + `【书宣 · ${platform}】 《${t}》` + C.reset);
  }
  console.log(C.dim + '─'.repeat(40) + C.reset);
  console.log(out);
  console.log(C.dim + '─'.repeat(40) + C.reset);
  console.log(C.dim + `（模板化初稿；需更贴书味的版本加 --llm 获取扩写提示词交给 LLM 润色。）` + C.reset);
}

module.exports = { PLATFORMS, renderChapter, renderBook };
if (require.main === module) main();
