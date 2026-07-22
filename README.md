# zidu-claw-story

> AI 网文写作完整工具箱（单包 · WorkBuddy 原生 · 跨宿主可移植）

把**网文写作全流程**（长篇/短篇/拆文/扫榜/去味/封面/导入/初始化）与**量化质检**（quality-gate 硬门禁）+ **追踪流水线**（tracking-updater / pipeline-gate）整合为**一个技能包**，无外部依赖、无宿主私有契约。

当前版本：**1.7.7**（见 `VERSION`）。

## ✨ 特性

- **全流程覆盖**：开书 → 大纲 → 连载/日更 → 续写 → 完结，长短篇均支持
- **量化质检门禁**：约 12 项硬检查（禁用词/AI 句式/一致性/伏笔/字数/跨章重复/人设/情绪/爽点/缺口/追读回落/评分），全绿才放行
- **去 AI 味**：句式规则 + 禁用词库 + 退化检测，多脚本预检
- **追踪流水线**：伏笔/时间线/角色状态/物品/环境/重复语句/素材/上下文 8 类自动追踪，闸门防"带病章节"继续
- **追读力量化**：每章记录钩子类型/强度、爽点模式、微兑现、硬约束违规、债务余额，维持读者追更动力
- **自动备份/断点续跑**：每章写完后快照轮转（保留最近 10 份），失败可从断点续跑
- **项目体检（doctor）**：一键健康报告——结构 / 追踪文件 / 流水线状态 / 备份新鲜度，并委托既有脚本跑最新章一致性 + 角色同步
- **跨章事实账本**：确定性快筛全书「实体→属性→值」矛盾（左撇子变右撇子、死了又活），无需 LLM，与一致性子代理互补
- **长期记忆沉淀库**：LLM 抽取好写法后结构化存储，新章任务书 `query` 召回注入，越写越香
- **节奏密度曲线**：解析追读力数据合成每章追读密度分，ASCII 曲线 + 水章标记，一眼定位"凹下去"的章节
- **文风漂移检测**：逐章量化句长/对话比/标点密度/用词丰富度，z-score 标记代笔/AI 味突变/状态断档
- **多项目仪表盘**：一屏聚合所有书的进度/字数/追读密度/健康度/记忆条数，多开书必备
- **题材库检索扩充**：37 题材按男女频/平台/标签精准筛选，支持 `add` 扩充新题材、`scaffold` 一键铺成开书设定基底
- **自动生成本书设定卡**：合并散落设定 + 从正文确定性抽取人物/组织/地点候选，`llm-prompt` 出 LLM 补全提示词
- **多平台发布物料**：章推/书评/求追读文案，按起点/番茄/微博/小红书/知乎/微信/头条/B站/抖音 平台语气模板化生成
- **发布排期 / Runbook**：promo-pack 的 calendar / runbook 按平台+节奏生成逐章发布命令与检查清单，补齐「写→发」最后一公里
- **选题→成书闭环**：topic-to-book 把扫榜/题材库/日更配速/追读复盘串成一条流水线，从选题、匹配、开书骨架到每日配速与追读预警一气呵成
- **自测套件**：selftest 给 44 脚本做语法/启动/功能三层冒烟，改一处不崩一片
- **选题情报闭环**：rank-dispatcher 聚合 7 平台榜单为 rank-index.json，topic-to-book scan --from-rank 读缓存算「蓝海指数」（热榜命中热度 ÷ 题材竞争度）；加 --refresh 可一键刷新实时热榜再分析（失败回退缓存），动笔前知道写什么能火
- **排行榜统一底座**：rank-dispatcher 统一调度 7 个平台 rank-scraper（失败隔离），让沉睡的爬虫数据变成选题情报源
- **追读回落门禁**：quality-gate 新增 pacing 维度（advisory），写完一章若最新章追读密度低于阈值即预警，防默默掉追读
- **多平台追读复盘**：topic-to-book review 复用 pacing-density，对起点/番茄分别汇总真实追读率（均值/最新/完读均值/低于阈值章节），逐平台给建议；未填则回落结构性代理
- **实时风格护栏**：drift-guard 写完一章跑，聚焦该章文风 z-score 漂移，advisory 不阻断，可作编辑器保存钩子
- **37 题材库**：开书即选中文网文题材模板（修仙/都市/科幻/言情…）作为设定基底
- **扫榜选题**：起点/番茄/晋江/刺猬猫/七猫/豆瓣/黑岩 爬虫，辅助选题
- **浏览器操控**：基于 CDP 的 Chrome 自动化，支持登录态抓取
- **跨宿主**：纯文件技能（`SKILL.md` + `references/` + `scripts/`），WB / OpenClaw / Hermes 均可直接加载
- **单包零胶水**：合并后无宿主胶水，依赖更少、加载更轻

## 📦 目录结构

```
zidu-claw-story/
├── SKILL.md              # 技能入口（意图路由 + 完整说明，给 AI 读）
├── VERSION               # 版本号
├── README.md             # 本文档
├── LICENSE               # MIT
├── docs/
│   ├── install.md       # 多宿主安装与部署
│   ├── scripts.md       # 44 个脚本命令参考
│   └── references.md    # 知识库（references/）索引
├── scripts/              # 44 个 Node 脚本（质检/去味/追踪/爬虫/CDP/体检/记忆/观/扩/闭环/自测/数据驱动）
└── references/          # 243 篇子流程知识库（206 篇扁平 + genres/ 37 题材模板）
```

## 🚀 快速开始

### 安装（以 WorkBuddy 为例）

```bash
# 克隆到 WB 技能目录即可自动加载
git clone https://github.com/qoqu/zidu-claw-story.git \
  ~/.workbuddy/skills/zidu-claw-story
```

其他宿主见 [docs/install.md](docs/install.md)。

### 写一本小说的最小流程（手动版）

```bash
# 1. 写正文（长篇小说）
#    读 references/long-write.md 按其执行，产出 正文/第N章.md

# 2. 标点预检
node scripts/punct-precheck.js 正文/第N章.md

# 3. 去味预检
node scripts/check-ai-patterns.js 正文/第N章.md

# 4. 量化质检硬门禁（exit 0 才过）
node scripts/quality-gate.js 正文/第N章.md ./ --genre dushi

# 5. 追踪更新（含追读力）
node scripts/tracking-updater.js ./ after-chapter --chapter N --summary "..."
node scripts/tracking-updater.js ./ reading-power --chapter N --hook-type 危机钩 --hook-strength strong --coolpoint "..." [--micropayoff "..."] [--debt 0] [--qidian-rate 12.3] [--qidian-finish 38.5] [--fanqie-rate 10.1] [--fanqie-finish 33.0] [--real-rate 11.0]
# --qidian-rate/--qidian-finish（起点）、--fanqie-rate/--fanqie-finish（番茄）为可选真实数据回填（方案①）：
# 从平台作家后台手抄，填了则真实率接管 pacing 信号（结构性代理回退为参考）；也可用 --real-rate 填通用值。

# 6. 流水线闸门标记完成 + 自动备份
node scripts/pipeline-gate.js gate post qa ./ --chapter N
node scripts/pipeline-gate.js gate post track ./ --chapter N
node scripts/pipeline-gate.js backup ./ --chapter N
```

## 📖 命令速查

<details>
<summary>量化质检 quality-gate</summary>

```bash
node scripts/quality-gate.js <章节.md> <项目目录> [--json] [--genre dushi] [--threshold 90]
# 退出码：0=通过 / 2=硬阻断 / 3=评分不足建议提质
```
</details>

<details>
<summary>追踪更新 tracking-updater</summary>

```bash
node scripts/tracking-updater.js <项目目录> init
node scripts/tracking-updater.js <项目目录> after-chapter --chapter N --summary "..."
node scripts/tracking-updater.js <项目目录> add-foreshadow --chapter N --text "..." --cover "..."
node scripts/tracking-updater.js <项目目录> add-timeline --chapter N --time "..." --desc "..." --chars "..."
node scripts/tracking-updater.js <项目目录> set-character --name "..." --key "..." --value "..."
node scripts/tracking-updater.js <项目目录> add-item --name "..." --loc "..." --status "..." --chapter N
node scripts/tracking-updater.js <项目目录> reading-power --chapter N --hook-type 危机钩 --hook-strength strong --coolpoint "..." [--micropayoff "..."] [--debt 0]
```
</details>

<details>
<summary>流水线闸门 pipeline-gate</summary>

```bash
node scripts/pipeline-gate.js status <项目目录>
node scripts/pipeline-gate.js gate pre  <step> <项目目录>            # step: read|write|qa|track
node scripts/pipeline-gate.js gate post <step> <项目目录> --chapter N
node scripts/pipeline-gate.js qa <章节.md> <项目目录> [--chapter N] [--genre xxx] [--threshold 90]
node scripts/pipeline-gate.js backup <项目目录> --chapter N        # 每章快照轮转（保留最近 10 份）
node scripts/pipeline-gate.js resume <项目目录> --chapter N       # 断点续跑：列出未完成的步骤
```
</details>

<details>
<summary>项目体检 / 跨章事实 / 记忆沉淀（T1）</summary>

```bash
# 一键健康体检（写章前后各跑一次）
node scripts/doctor.js <项目目录> [--json] [--no-subchecks]

# 确定性快筛全书设定矛盾（无需 LLM）
node scripts/continuity-ledger.js <项目目录> [--json]

# 长期记忆沉淀库：LLM 抽取好写法后存读，新章任务书召回
node scripts/learn-bank.js <项目目录> add   --type 爽点套路 --content "..." [--tags "a,b"] [--chapter N]
node scripts/learn-bank.js <项目目录> query [--type X] [--tag T] [--kw "..."] [--limit N]
node scripts/learn-bank.js <项目目录> list  [--type X] [--limit N]
node scripts/learn-bank.js <项目目录> export [--md]
node scripts/learn-bank.js <项目目录> stats
```
</details>

<details>
<summary>节奏曲线 / 文风漂移 / 多项目仪表盘（T2）</summary>

```bash
# 节奏密度曲线：写章后看节奏是否"凹"下去（水章 = 密度<阈值，默认45）
node scripts/pacing-density.js <项目目录> [--json] [--html out.html] [--water 45]

# 文风漂移检测：查代笔 / AI 味突变 / 状态断档（|z|>1.5 标记）
node scripts/style-drift.js <项目目录> [--json] [--html out.html] [--z 1.5]

# 多项目仪表盘：多开书时一屏总览（根目录含多个子项目）
node scripts/dashboard.js <根目录> [--json] [--html out.html]
```
</details>

</details>

<details>
<summary>题材库检索 / 设定卡 / 发布物料（T3）</summary>

```bash
# 题材库检索扩充
node scripts/genre-library.js list
node scripts/genre-library.js filter --gender 女频 --platform 番茄 --tag 甜宠
node scripts/genre-library.js add 国运降维 --gender 男频 --platform 起点,番茄 --tags 国运,爽文 --hook "全民穿越，国运绑定个人天赋"
node scripts/genre-library.js scaffold 修仙 <项目目录>      # → 设定/题材基底_修仙.md

# 自动生成本书设定卡
node scripts/setting-cards.js <项目目录> build
node scripts/setting-cards.js <项目目录> extract [--json]
node scripts/setting-cards.js <项目目录> llm-prompt

# 多平台发布物料（章推 / 书评·求追读）
node scripts/promo-pack.js chapter <项目目录> --chapter N --platform 起点 [--title 书名] [--llm]
node scripts/promo-pack.js book    <项目目录> --platform 小红书 [--title 书名] [--llm]
```

完整脚本清单见 [docs/scripts.md](docs/scripts.md)。

## 📚 文档

| 文档 | 内容 |
|---|---|
| [docs/install.md](docs/install.md) | WB / OpenClaw / Hermes 安装与部署 |
| [docs/scripts.md](docs/scripts.md) | 44 个脚本分类与命令参考 |
| [docs/references.md](docs/references.md) | references/ 知识库主题索引 |

## ⚙️ 环境要求

- **Node.js** ≥ 18（脚本均为纯 Node，无第三方依赖，无需 `npm install`）
- 操作系统：Windows / macOS / Linux

## 🤝 致谢

致谢：oh-story及mimocode-story

## 📄 许可

[MIT](LICENSE) © 2026 qoqu
