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
    title: '写  —— 开书 / 大纲 / 连载 / 日更 / 续写 / 完结',
    items: [
      { name: '长篇写作', entry: 'references/long-write.md', note: '黄金三章、人设、节奏、去味预检、质检闸门' },
      { name: '短篇写作', entry: 'references/short-write.md', note: '盐言 / 一万字短篇结构' },
      { name: '题材库(37)', entry: 'references/genres/', note: '开书选题材模板作为设定基底' },
      { name: '完结门禁', entry: 'scripts/finish-book.js', note: '收尾前全书体检：伏笔回收/设定缺口/事实矛盾/收尾章质量门，exit0 可完结' },
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
      { name: '排行榜统一底座', entry: 'scripts/rank-dispatcher.js', note: '聚合 7 平台榜单为 rank-index.json，选题情报数据源' },
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
      { name: '项目体检', entry: 'scripts/doctor.js', note: '结构/追踪/流水线/备份 一键健康体检' },
      { name: '跨章事实账本', entry: 'scripts/continuity-ledger.js', note: '确定性快筛全书设定矛盾（无需 LLM）' },
      { name: '长期记忆沉淀库', entry: 'scripts/learn-bank.js', note: '好写法沉淀 + 新章任务书召回' },
    ],
  },
  {
    key: 'inspect',
    title: '观  —— 节奏曲线 / 漂移 / 仪表盘（Tier 2 数据层）',
    items: [
      { name: '节奏密度曲线', entry: 'scripts/pacing-density.js', note: '解析追读力.md，ASCII 曲线 + 水章标记 + HTML 线图' },
      { name: '文风漂移检测', entry: 'scripts/style-drift.js', note: '逐章句长/对话比/标点/丰富度 z-score，标记漂移章' },
      { name: '多项目仪表盘', entry: 'scripts/dashboard.js', note: '聚合所有书的进度/字数/追读密度/健康度/记忆条数' },
      { name: '实时风格护栏', entry: 'scripts/drift-guard.js', note: '写完一章跑，聚焦该章文风 z-score 漂移，advisory 不阻断' },
    ],
  },
  {
    key: 'expand',
    title: '扩  —— 题材库检索 / 设定卡 / 发布物料（Tier 3 增强）',
    items: [
      { name: '题材库检索扩充', entry: 'scripts/genre-library.js', note: 'list/search/filter/show/add/stats/scaffold，37 题材按男女频/平台/标签筛' },
      { name: '自动生成本书设定卡', entry: 'scripts/setting-cards.js', note: 'build 合并设定 / extract 抽候选实体 / llm-prompt 出补全提示词' },
      { name: '多平台发布物料', entry: 'scripts/promo-pack.js', note: '章推/书评/求追读，按起点/番茄/微博/小红书等平台语气生成' },
      { name: '发布排期/Runbook', entry: 'scripts/promo-pack.js calendar|runbook', note: '按平台+节奏生成逐章发布命令与检查清单，写→发闭环' },
    ],
  },
  {
    key: 'flow',
    title: '流  —— 选题→成书闭环 / 自测（T4 新增）',
    items: [
      { name: '选题→成书闭环', entry: 'scripts/topic-to-book.js', note: 'scan(含选题情报蓝海指数，--refresh 一键刷实时热榜)/match/scaffold/plan/review 串起扫榜→开书→追读复盘' },
      { name: '自测套件', entry: 'scripts/selftest.js', note: '50 脚本语法/启动/功能三层冒烟，改一处不崩一片' },
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
