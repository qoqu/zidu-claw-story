#!/usr/bin/env node
'use strict';

// zidu-claw-story · 功能地图生成器
// 用途：AI 加载 skill 后主动引导用户，或用户自查可用功能。
// 用法：
//   node scripts/menu.js          # 打印功能总览（纯文本）
//   node scripts/menu.js --json   # 输出 JSON，供程序消费

const args = process.argv.slice(2);
const asJson = args.includes('--json');

const DOMAINS = [
  {
    key: 'write',
    title: '写  —— 开书 / 大纲 / 连载 / 日更 / 续写',
    items: [
      { name: '长篇写作', entry: 'references/long-write.md', note: '黄金三章、人设、节奏、去味预检、质检闸门' },
      { name: '短篇写作', entry: 'references/short-write.md', note: '盐言 / 一万字短篇结构' },
      { name: '题材库(37)', entry: 'references/genres/', note: '开书选题材模板作为设定基底' },
    ],
  },
  {
    key: 'analyze',
    title: '拆  —— 对标 / 黄金三章 / 反向解析爆款',
    items: [
      { name: '长篇拆文', entry: 'references/long-analyze.md', note: '结构、爽点、情绪曲线拆解' },
      { name: '短篇拆文', entry: 'references/short-analyze.md', note: '短篇爆款要素拆解' },
    ],
  },
  {
    key: 'scan',
    title: '选  —— 扫榜选题 / 找赛道',
    items: [
      { name: '长篇扫榜', entry: 'references/long-scan.md', note: '起点 / 番茄 / 晋江 排行爬虫' },
      { name: '短篇扫榜', entry: 'references/short-scan.md', note: '知乎盐言排行' },
    ],
  },
  {
    key: 'polish',
    title: '净  —— 去 AI 味 / 封面图',
    items: [
      { name: '去 AI 味', entry: 'references/deslop.md', note: 'check-ai-patterns / 禁用词 / 标点归一' },
      { name: '封面图', entry: 'references/cover.md', note: '生成封面提示词 / 出图' },
    ],
  },
  {
    key: 'manage',
    title: '查  —— 审查 / 导入 / 环境',
    items: [
      { name: '审查体检', entry: 'references/review.md', note: '全书质量复盘' },
      { name: '导入小说', entry: 'references/import.md', note: '反向解析已有书' },
      { name: '环境部署', entry: 'references/setup.md', note: '初始化写作环境' },
    ],
  },
  {
    key: 'control',
    title: '控  —— 质检 / 追踪 / 浏览器',
    items: [
      { name: '量化质检', entry: 'scripts/quality-gate.js', note: '9–10 项硬门禁，exit0 放行 / exit2 阻断' },
      { name: '追踪流水线', entry: 'scripts/tracking-updater.js + pipeline-gate.js', note: '伏笔/时间线/角色/物品 + 四步闸门' },
      { name: '浏览器 CDP', entry: 'references/browser-cdp.md', note: '登录态抓取 / 榜单' },
      { name: '追读力追踪', entry: 'scripts/tracking-updater.js reading-power', note: '钩子/爽点/微兑现/债务量化' },
      { name: '自动备份/续跑', entry: 'scripts/pipeline-gate.js backup|resume', note: '每章快照轮转、断点续跑' },
    ],
  },
];

if (asJson) {
  process.stdout.write(JSON.stringify({ skill: 'zidu-claw-story', domains: DOMAINS }, null, 2) + '\n');
  process.exit(0);
}

const line = '─'.repeat(60);
const out = [];
out.push(line);
out.push('  zidu-claw-story · 功能总览');
out.push('  AI 网文写作工具箱（单包 · WB 原生）');
out.push(line);
out.push('');
out.push('  告诉我你想做哪件事，或直接说需求，我帮你路由。');
out.push('');
for (const d of DOMAINS) {
  out.push('[' + d.title + ']');
  for (const it of d.items) {
    out.push('    • ' + it.name + '  —  ' + it.note);
    out.push('        ↳ ' + it.entry);
  }
  out.push('');
}
out.push(line);
out.push('  通用约定：scripts/ 下用 `node scripts/<name>.js` 调用');
out.push('  知识库：references/<sub>.md。版本见 VERSION。');
out.push(line);

process.stdout.write(out.join('\n') + '\n');
process.exit(0);
