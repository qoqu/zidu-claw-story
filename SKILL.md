---
name: zidu-claw-story
description: "AI 网文写作完整工具箱（单包、WB 原生）。触发场景：写长篇/短篇、开书/大纲/连载/日更/续写、拆文分析（黄金三章/对标）、扫榜选题（起点/番茄/晋江/盐言）、去AI味、封面图、导入小说/反向解析、初始化写作环境、量化质检/质量门禁/查禁用词、伏笔时间线角色物品追踪、流水线闸门、浏览器/CDP抓取。关键词：「写网文」「帮我写书」「小说」「开书」「选题」「扫榜」「去味」「封面」「导入」「质检」「追踪」「流水线」「审查」「体检」。"
---

# zidu-claw-story：AI 网文写作完整工具箱（单包）

你是统一入口。本 skill 把**网文写作全流程**（长篇/短篇/拆文/扫榜/去味/封面/导入/初始化）与**量化质检**（quality-gate 硬门禁）+ **追踪流水线**（tracking-updater / pipeline-gate）全部能力整合为 **一个 WB 原生 skill**，无外部依赖、无宿主私有契约。

- 所有可执行脚本：`scripts/`（用 `node scripts/<name>.js` 调用）
- 所有子流程知识库：`references/<sub>.md`（路由后读对应主文档 + 其下 craft KB）。开书/大纲/写作阶段可运行 `node scripts/genre-methodology.js route --stage <outline|character|writing> --len <long|short>` 确定性召回 `references/genre-*` 跨题材写法方法论并注入上下文（与 `references/genres/` 的按题材模板互补，由 `genre-library.js` 检索）。
- 版本：`VERSION` 文件

## 〇、主动引导（零意图兜底）

**本 skill 必须主动引导，不要等用户先说出具体关键词。**

当本 skill 被加载，而用户**尚未给出明确子意图**（典型信号：只说「用一下 zidu-claw-story」「帮我写小说」「看看你能干嘛」「打开写作工具」等宽泛表述），你**必须**：

1. **先输出功能总览**，而不是反问「你想做什么」就停住；
2. 优先调用 `node scripts/menu.js` 生成最新功能清单并展示给用户；若无法执行脚本，则直接复用下方「功能总览」；
3. 用一句话收尾询问用户想先做哪件事（从清单里挑），或让他直接描述需求。

> 这一条优先级高于「一、意图路由表」的被动匹配：路由表解决「用户说了 A 就做 A」，本段解决「用户没说清就主动给地图」。

### 功能总览（6 大域）

| 域 | 能做什么 | 入口 |
|---|---|---|
| ✍ 写 | 长篇 / 短篇开书、大纲、连载、日更、续写、完结 | `references/long-write.md`、`references/short-write.md`、`references/long-finish.md` |
| 🔍 拆 | 长篇 / 短篇拆文、对标爆款、黄金三章 | `references/long-analyze.md`、`references/short-analyze.md` |
| 📊 选 | 起点 / 番茄 / 晋江 / 盐言扫榜选题 | `references/long-scan.md`、`references/short-scan.md` |
| ✨ 净 | 去 AI 味、生成封面图 | `references/deslop.md`、`references/cover.md` |
| 🗂 查 | 审查体检、导入已有书、初始化环境 | `references/review.md`、`references/import.md`、`references/setup.md` |
| 🛡 控 | 量化质检、伏笔/时间线/角色/物品追踪、追读力量化、自动备份/断点续跑、浏览器 CDP 抓取、项目体检、跨章事实账本、长期记忆沉淀库、节奏密度曲线、文风漂移检测、`drift-guard` 风格护栏、`quality-gate` 追读回落门禁、多项目仪表盘 | `scripts/quality-gate.js`、`scripts/tracking-updater.js`、`scripts/pipeline-gate.js`、`references/browser-cdp.md`、`scripts/doctor.js`、`scripts/continuity-ledger.js`、`scripts/learn-bank.js`、`scripts/pacing-density.js`、`scripts/style-drift.js`、`scripts/drift-guard.js`、`scripts/dashboard.js` |
| 🔁 流 | 选题→成书闭环、排行榜蓝海指数、写完一章风格护栏、自测回归护栏 | `scripts/topic-to-book.js`、`scripts/rank-dispatcher.js`、`scripts/drift-guard.js`、`scripts/selftest.js` |
| 📦 扩 | 题材库检索/扩充、自动生成本书设定卡、多平台发布物料（章推/书评/求追读） | `scripts/genre-library.js`、`scripts/setting-cards.js`、`scripts/promo-pack.js` |

## 一、意图路由表

| 用户意图 | 关键词示例 | 执行 |
|---|---|---|
| 写长篇 | 开书、写大纲、长篇、连载、日更、续写、继续写、完结 | 读 `references/long-write.md` 并按其执行；收尾前读 `references/long-finish.md` 跑完结门禁 |
| 写短篇 | 短篇、盐言、一万字 | 读 `references/short-write.md` |
| 长篇拆文 | 拆文、分析这本书、黄金三章、对标 | 读 `references/long-analyze.md` |
| 短篇拆文 | 拆短篇、分析这个故事 | 读 `references/short-analyze.md` |
| 长篇扫榜 | 长篇排行、什么火、起点/番茄/晋江 | 读 `references/long-scan.md`（爬虫在 `scripts/`） |
| 短篇扫榜 | 短篇排行、知乎盐言排行 | 读 `references/short-scan.md` |
| 去 AI 味 | 去 AI 味、太 AI、去味 | 读 `references/deslop.md` |
| 封面 | 封面、封面图 | 读 `references/cover.md` |
| 环境部署 | 准备写书、搭环境、初始化 | 读 `references/setup.md` |
| 导入小说 | 导入、反向解析、把我的书导进来 | 读 `references/import.md` |
| 审查/体检 | 审查、体检、查问题、质量复盘 | 读 `references/review.md` |
| 浏览器操控 | 浏览器、抓取、登录态、CDP | 见 `references/browser-cdp.md` + `scripts/setup-cdp-chrome.js` |
| 量化质检 | 质检、质量门禁、查禁用词、评分 | 见下方「二、量化质检」 |
| 追踪/流水线 | 伏笔、时间线、角色状态、物品、闸门 | 见下方「三、追踪与流水线」 |
| 追读力追踪 | 追读力、读者动力、钩子/爽点/微兑现量化 | 见下方「三、追踪与流水线」→ `tracking-updater.js reading-power` |
| 自动备份/续跑 | 备份、断点续跑、误删恢复 | 见下方「三、追踪与流水线」→ `pipeline-gate.js backup`/`resume` |
| 项目体检/把脉 | 体检、把脉、查健康、项目缺什么 | 见下方「三·增强」→ `scripts/doctor.js` |
| 跨章矛盾/设定冲突 | 前后矛盾、左撇子变右撇子、死了又活 | 见下方「三·增强」→ `scripts/continuity-ledger.js` |
| 记忆沉淀/好写法库 | 沉淀好写法、写法库、越写越香 | 见下方「三·增强」→ `scripts/learn-bank.js` |
| 节奏曲线/水章 | 节奏、水章、哪章没劲、追读密度 | 见下方「四·观」→ `scripts/pacing-density.js` |
| 文风漂移/代笔 | 文风漂移、代笔、AI 味突变、前后不一致 | 见下方「四·观」→ `scripts/style-drift.js` |
| 仪表盘/多项目 | 多开书总览、所有书的进度/字数/健康 | 见下方「四·观」→ `scripts/dashboard.js` |
| 题材库(37) | 选题材、题材模板、开书设定基底 | 读 `references/genres/` 下对应题材 `.md` |
| 题材库检索/扩充 | 搜题材、按男女频/平台/标签筛、加新题材 | 见下方「四·扩」→ `scripts/genre-library.js` |
| 生成本书设定卡 | 合并设定、从正文抽人物/组织候选、出 LLM 补全提示词 | 见下方「四·扩」→ `scripts/setting-cards.js` |
| 多平台发布物料 | 章推、书评、求追读文案、按平台语气生成 | 见下方「四·扩」→ `scripts/promo-pack.js` |
| 发布排期/Runbook | 发布排期、逐章发布命令、写→发清单 | 见下方「四·扩」→ `scripts/promo-pack.js calendar|runbook` |
| 选题→成书闭环 | 选题、开书、从热点到成书、写作流水线、选题情报蓝海指数、追读回落门禁 | 见下方「四·流」→ `scripts/topic-to-book.js` / `scripts/rank-dispatcher.js` |
| 自测/回归 | 自测、回归、跑一遍脚本、别改坏 | 见下方「四·流」→ `scripts/selftest.js` |
| 查故事资料 | 查角色、查伏笔、查进度、写到哪了 | 主线程用 Read/Grep 检索项目 `设定/` `追踪/` `大纲/`（见「四、WB 适配」降级说明） |

> 意图模糊时，先匹配上表；无法匹配则询问用户想做什么（从表中选）。说"我想写小说"但未指定篇幅，先问长篇/短篇再路由。

## 二、量化质检（quality-gate）

`scripts/quality-gate.js` 是统一质量门禁，约 12 项（11 个脚本子检查 + 内联字数检查）全绿才放行：

```bash
node scripts/quality-gate.js <章节.md> <项目目录> [--json] [--genre dushi] [--threshold 90]
```

- 退出码：**0 = 通过** / **2 = 硬阻断**（一级禁用词、一致性错误、 overdue 伏笔、字数不足、跨章重复、人设崩、情绪曲线平坦、爽点密度不足等）/ **3 = 评分不足建议提质**
- 子检查：style-lint / check-ai-patterns（去味第一道）/ consistency / foreshadow / wordcount（内联）/ cross-chapter / voice / emotion / satisfaction / gaps（detect-story-gaps）/ **pacing（复用 pacing-density 的追读回落预警）** / scorer（均位于 `scripts/`，`quality-gate` 用 `__dirname` 自动定位）
- 详细规则库：`references/`（quality-rules / quality-checklist / banned-words / anti-ai-writing / quality-monitoring）
- 完整 SOP：见 `references/quality.md`

## 三、追踪与流水线（tracking-updater / pipeline-gate）

### 追踪更新 `tracking-updater.js`
```bash
node scripts/tracking-updater.js <项目目录> init
node scripts/tracking-updater.js <项目目录> after-chapter --chapter N --summary "..."
node scripts/tracking-updater.js <项目目录> add-foreshadow --chapter N --text "..." --cover "..."
node scripts/tracking-updater.js <项目目录> add-timeline --chapter N --time "..." --desc "..." --chars "..."
node scripts/tracking-updater.js <项目目录> set-character --name "..." --key "..." --value "..."
node scripts/tracking-updater.js <项目目录> add-item --name "..." --loc "..." --status "..." --chapter N
node scripts/tracking-updater.js <项目目录> set-env --key "..." --value "..."
node scripts/tracking-updater.js <项目目录> add-repeat --content "..." --location "..." --count N --alt "..."
node scripts/tracking-updater.js <项目目录> set-material --name "..." --status "..." --chapter N
node scripts/tracking-updater.js <项目目录> reading-power --chapter N --hook-type 危机钩 --hook-strength strong --coolpoint "..." [--coolpoint "..."] --micropayoff "..." [--hard-violation HARD-xxx] [--debt 0] [--qidian-rate 12.3] [--qidian-finish 38.5] [--fanqie-rate 10.1] [--fanqie-finish 33.0] [--real-rate 11.0] [--real-finish 35.0]
```
> 管理 `追踪/` 下 8 类文件（伏笔/时间线/角色状态/物品/环境/重复语句/素材/上下文）。`after-chapter` 一键写上下文+字数。

### 流水线闸门 `pipeline-gate.js`
```bash
node scripts/pipeline-gate.js status <项目目录>
node scripts/pipeline-gate.js gate pre  <step> <项目目录>            # step: read|write|qa|track
node scripts/pipeline-gate.js gate post <step> <项目目录> --chapter N
node scripts/pipeline-gate.js qa <章节.md> <项目目录> [--chapter N] [--genre xxx] [--threshold 90]
node scripts/pipeline-gate.js backup <项目目录> --chapter N        # 每章写完后自动快照（轮转保留最近 10 份）
node scripts/pipeline-gate.js resume <项目目录> --chapter N        # 断点续跑：打印从哪步继续
```
- 状态机存于 WB 原生 `.pipeline/state.json`。
- **门禁语义固化于代码**：`qa` 质量**通过(exit 0)时自动标记 qa 完成**；**阻断(exit 2/3)绝不标记**——避免"带病章节"继续 track。
- 详细规范：`references/tracking-spec.md` + `references/pipeline.md`

## 三·增强：体检 / 跨章事实账本 / 长期记忆沉淀库（T1 新增）

### 项目体检 `doctor.js`
```bash
node scripts/doctor.js <项目目录> [--json] [--no-subchecks]
```
- 一键检查：① 结构完整性（设定/大纲/正文/追踪/.pipeline）② 追踪文件齐全度 ③ 流水线状态（`.pipeline/state.json` 的 read/write/qa/track）④ 自动备份新鲜度 ⑤（默认）委托 `consistency-check.js` 跑最新章 + `character-sync.js` 角色同步。
- 退出码：**0 = 健康** / **1 = 仅警告（可继续）** / **2 = 有阻断错误**。写章前后各跑一次。

### 跨章事实账本 `continuity-ledger.js`
```bash
node scripts/continuity-ledger.js <项目目录> [--json]
```
- 确定性快筛（**无需 LLM**）：遍历全书正文，抽取「实体→属性→值→章节」事实，标出同一实体同属性多值矛盾、死亡后又活跃。
- 与 `consistency-check.js`（单章 vs 追踪文件）和 `references/setup_consistency-checker.md`（LLM 推理子代理，S1–S4 分级）**互补**，不重复。结果作为候选交人工 / LLM 子代理裁决。
- 退出码：0 = 通过 / 2 = 发现矛盾候选。

### 长期记忆沉淀库 `learn-bank.js`
```bash
node scripts/learn-bank.js <项目目录> add   --type 爽点套路 --content "..." [--tags "a,b"] [--chapter N] [--source "第N章"]
node scripts/learn-bank.js <项目目录> query [--type X] [--tag T] [--kw "..."] [--limit N]
node scripts/learn-bank.js <项目目录> list  [--type X] [--limit N]
node scripts/learn-bank.js <项目目录> export [--md]
node scripts/learn-bank.js <项目目录> stats
```
- LLM 从正文抽取「好用的写法」后写入 `记忆/写法沉淀.json`；新章任务书用 `query` 召回注入，**越写越香、不糊**；`query` 还会跨 `references/` 做 BM25 确定性召回「相关参考」（见 `scripts/retrieval.js`），无需手动挑文件。
- **交接纪律（B 弱交接修复）**：`add` 是生产者、`query` 是消费者——写每章前先 `query` 召回并粘贴进任务书，否则记忆库只进不出、多处读取端读空。脚手架已对 `add` / `query` 双向加提示，写前不召回视为漏接。
- type 建议：`爽点套路` / `人设高光` / `金句` / `节奏` / `设定钩子`。

## 四·观：节奏曲线 / 文风漂移 / 多项目仪表盘（T2 新增）

三者均**确定性、零依赖**，复用 T1 的 `追踪/追读力.md` 时间序列与正文语料，属于"看数据"层，与 `references/setup_consistency-checker.md`（LLM 推理子代理）互补。

### 节奏密度曲线 `pacing-density.js`
```bash
node scripts/pacing-density.js <项目目录> [--json] [--html out.html] [--water 45]
```
- 解析 `追踪/追读力.md` 每章块，合成**追读密度分(0-100)**：钩子强度 + 爽点模式数 + 微兑现数×1.5 − 硬约束违规数 + 债务微加成，再按全书最大值归一化（结构性代理）。
- **有效密度 eff = 多平台真实率均值（已是 0-100）接管 pacing 信号，否则回退结构性归一分**。支持起点（`--qidian-rate/--qidian-finish`）、番茄（`--fanqie-rate/--fanqie-finish`）分别回填，也可用 `--real-rate/--real-finish` 填通用值（向后兼容）；任一平台真实率低于阈值即标水章。平台后台数字手抄（方案①），不填则纯结构性代理，完全兼容。
- 终端输出 ASCII 曲线 + **水章标记**（有效密度 < 阈值，默认 45）；`--html` 出 SVG 折线图（灰虚线=结构性归一分、蓝/橙实线=起点/番茄真实率、红=水章）。
- 用途：写章后一眼看出"节奏凹下去"的章节，针对性补钩子/爽点/微兑现。

### 文风漂移检测 `style-drift.js`
```bash
node scripts/style-drift.js <项目目录> [--json] [--html out.html] [--z 1.5]
```
- 逐章算文风指标：句长均、对话占比、标点密度、用词丰富度、段落数；与全书均值比 **z-score**，标记 `|z| > 1.5`（可 `--z` 调）的**漂移章**。
- 用途：辅助识别代笔 / AI 味突变 / 写作状态断档。
- 有效章节 < 3 章时退出（基线不可靠）。

### 实时风格护栏 `drift-guard.js`
```bash
node scripts/drift-guard.js <章节文件> [--project <项目目录>] [--z 1.5]
```
- 写完一章跑一次，复用 `style-drift.js --json` 但**只聚焦传入章节**的 z-score：从结果里定位该章号对应的指标，标记漂移（advisory，不阻断）。
- 内容过短（<30 字）或未被纳入基线的章节会友好跳过；前 2 章基线不足也跳过。可作编辑器"保存章节"钩子。

### 多项目仪表盘 `dashboard.js`
```bash
node scripts/dashboard.js <根目录> [--json] [--html out.html]
```
- 扫描根目录下所有含 `正文/` 或 `追踪/` 的子项目，聚合：章节数 / 总字数 / 最新章 / 最新追读密度 / doctor 健康度（内联轻量检查）/ 记忆沉淀条数 / 最近更新。
- doctor 健康度用内联轻量检查（不逐项目 spawn 子进程）；需要深度体检仍用 `doctor.js`。
- 用途：多开书时一屏总览；`--html` 出卡片视图。

## 四·扩：题材库检索 / 设定卡 / 发布物料（T3 新增）

三者均**确定性、零依赖**，与既有 LLM 子代理（`setup_consistency-checker.md`）与爬虫（`*rank-scraper.js`）互补。

### 题材库检索扩充 `genre-library.js`
```bash
node scripts/genre-library.js list
node scripts/genre-library.js search --kw 扮猪吃虎
node scripts/genre-library.js filter --gender 女频 --platform 番茄 --tag 甜宠
node scripts/genre-library.js show 修仙
node scripts/genre-library.js stats
node scripts/genre-library.js add 国运降维 --gender 男频 --platform 起点,番茄 --tags 国运,爽文 --hook "全民穿越，国运绑定个人天赋"
node scripts/genre-library.js scaffold 修仙 <项目目录>     # 把题材模板写入 设定/题材基底_xxx.md
```
- 索引 = 内置审定种子（37 篇的男女频/平台/标签归类）+ 解析每篇 `> **核心卖点**：` 行；`add` 创建的新题材带 `<!-- meta -->` 注释，list/filter 优先读取后回退种子。
- 用途：37 篇看得眼花时，按"自己赛道"精准筛；`scaffold` 一键把题材模板铺成开书设定基底。

### 自动生成本书设定卡 `setting-cards.js`
```bash
node scripts/setting-cards.js <项目目录> build          # 合并 设定/ 下所有 .md → 设定/本书设定卡.md
node scripts/setting-cards.js <项目目录> extract [--json]  # 从正文确定性抽取人物/组织/地点候选（标 ⚠️ 待补全）
node scripts/setting-cards.js <项目目录> llm-prompt       # 输出 LLM 补全提示词（结构化 JSON 设定卡）
```
- `build` 合并散落设定；`extract` 在设定稀疏时从正文用中文模式（引号说话人 / 称谓头衔 / 姓氏名）抽候选实体，明显误抓已过滤但仍需人工/LLM 核验。
- 本脚本**不调用 LLM**，`llm-prompt` 把候选喂给 LLM 生成正式卡，保持宿主无关。

### 多平台发布物料 `promo-pack.js`
```bash
node scripts/promo-pack.js chapter <项目目录> --chapter N --platform 起点 [--title 书名] [--llm]
node scripts/promo-pack.js book    <项目目录> --platform 小红书 [--title 书名] [--llm]
```
- 按目标平台语气模板化生成章推 / 书评 / 求追读文案，遵循用户平台适配规则（微博信息流 / 小红书竖版种草 / 知乎长文 / 微信公号 / 头条 / B站 / 抖音竖版 等）。
- 平台可选：起点 / 番茄 / 微博 / 小红书 / 知乎 / 微信 / 头条 / B站 / 抖音。
- 书名取 `设定/书名.md` → `大纲/书名.md` → `--title` → 项目目录名；`--llm` 改为输出扩写提示词交 LLM 润色。

## 四·流：选题→成书闭环编排 / 自测套件（T4 新增）

把既有零散能力串成**可复用的写作系统**，并加回归护栏，避免「51 个脚本各自为战、改一个崩一片」。

### 选题→成书闭环 `topic-to-book.js`
```bash
node scripts/topic-to-book.js scan    [--kw 扮猪吃虎] [--platform 番茄] [--gender 男频]   # 离线题材风向
node scripts/topic-to-book.js scan --from-rank [--refresh] --rank-dir data/rank   # 蓝海指数选题榜（--refresh 一键刷热榜，失败回退缓存）
node scripts/topic-to-book.js match   --topic "重生爽文"                                  # 选题匹配题材库
node scripts/topic-to-book.js scaffold --genre 修仙 --title "我的书" [--gender 男频] [--platform 起点] [--decision 选题决策.md]   # 开书骨架（设定/正文/追踪/大纲/记忆 + 追踪文件 + 大纲模板；有 选题决策.md 则消费并拷入项目根）
node scripts/topic-to-book.js plan    --dir <项目目录> [--words 3000]                     # 今日配速（章节数 + outline-pacer 结构配比）
node scripts/topic-to-book.js review  --dir <项目目录>                                    # 追读复盘（字数/密度序列/水章预警/记忆条数 + 起点·番茄逐平台真实率复盘与建议）
```
- 不重复造轮子：通过 child_process 复用 `genre-library` / `outline-pacer` / `tracking-updater` / `pacing-density` / `learn-bank`；review 直接 require `pacing-density` 拿曲线（**有效密度 eff = 多平台真实率均值**，未填则结构性归一分）。
- review 的「平台复盘」段对 **起点 / 番茄** 分别汇总真实追读率（均值/最新/完读均值/低于阈值的章节），逐平台给出建议：某平台偏低即单独警告并提示下一章补钩子/爽点/回收伏笔；均未填则只给结构性代理结论。
- scaffold 输出标准写作流水线提示（每章严格按 `SKILL.md`「写章标准流程」6 步：写章 → tracking-updater(+`reading-power`) → 去味/格式 → quality-gate(含 pacing) → drift-guard → learn-bank+backup）。
- scaffold **可选消费** `选题决策.md`（long-scan Phase 4 产出）：`--decision <路径>` 显式指定，或放在运行目录自动发现；找到则解析排在最前（可行性最高）的推荐选题，预填书名/题材/大纲的「选题决策依据」段，并**拷入项目根**供下游 `long-write Phase1` / `long-analyze Stage5` 自动读取（单一数据源）。无决策文件时行为不变。

### 自测套件 `selftest.js`
```bash
node scripts/selftest.js [--quiet] [--json]
```
- 阶段1 语法检查（`node --check` 每个脚本）→ 阶段2 启动冒烟（非网络/浏览器脚本跑 `--help`，断言不崩）→ 阶段3 功能冒烟（临时项目跑 tracking-updater init → dashboard → learn-bank → genre-library → outline-pacer）。
- **改完任何脚本后先跑一遍**，确认没带崩其他脚本，再提交。

### 排行榜统一底座 / 选题情报 `rank-dispatcher.js`
```bash
node scripts/rank-dispatcher.js scan --dir data/rank        # 离线聚合各平台榜单 MD → rank-index.json
node scripts/rank-dispatcher.js refresh --dir data/rank    # 逐个 spawn 7 爬虫刷新（失败隔离），再聚合
```
- 把 7 个平台 `*-rank-scraper.js` 的采集结果统一收拢为一份 `rank-index.json`，供 `topic-to-book.js scan --from-rank` 做蓝海指数分析。
- 不重写爬虫主体（保留各平台 CDP 适配差异）；`scan` 只聚合已有缓存、永远可跑，`refresh` 才联网且失败隔离。

## 四、WorkBuddy 适配说明（与原生多宿主差异，已降级处理）

| 原宿主能力 | 原生形态 | WB 下处理 |
|---|---|---|
| guard hook 自动注册 | 多个 hook 自动拦截 | **降级为手动**：写章后跑 `node scripts/pipeline-gate.js qa ...` 做门禁 |
| 子 agent 调度 | 各宿主 explorer / researcher agent | **降级为** WB `Agent(Explore)`/`Task` 工具或主线程 Read/Grep 直接检索项目文件（标注 `Fallback: direct lookup`） |
| 私有状态契约 | 各宿主私有 JSON 状态机 | **改为** WB 原生 `.pipeline/state.json`（pipeline-gate 管理） |
| 多端同步脚本 | 各宿主同步器 | WB 单宿主，无需；保留逻辑可手动跑 |
| 版本自检 | 拉 GitHub release | 保留 `VERSION`；更新由用户手动决定，不自动安装 |

> **爬虫合规**：扫榜脚本（CDP 爬虫）完整保留，属个人研究用途，合规由用户自行承担。

## 五、调用约定

1. 脚本统一在 `scripts/`，用 `node scripts/<name>.js` 调用；脚本间用 `__dirname` 互相定位，无需额外配置。
2. 子流程知识库在 `references/`；路由后读对应 `references/<sub>.md` 主文档，按其中指引加载其下 craft KB（如 `references/long-write/genre-prose-cards/`）。
3. 项目文件结构（`设定/` `大纲/` `正文/` `追踪/` `对标/`）遵循本工具箱约定，详见各 `references/<sub>.md`。
4. **写章标准流程（WB 手动版，唯一 canonical 流程）**：开书时从 `references/genres/` 选题材模板作为设定基底，之后**每章严格按以下 6 步**——与 `references/long-write.md` Phase 5、`references/workflow-daily.md` Step 3 完全一致，不要各写一套：
   1. 写正文（Phase 4）
   2. `tracking-updater.js after-chapter` + **`reading-power`**（喂追读密度数据；不填则 review / 门禁的追读维度永远为空；可加 `--qidian-rate/--fanqie-rate`（起点/番茄）或 `--real-rate` 从平台后台手抄真实追读率，让真实数据接管 pacing 信号）
   3. 去味/格式一次性：`punct-precheck.js`（标点格式化）+ `check-degeneration.js`（退化防护）；**AI 味由第 4 步 quality-gate 内部 check-ai-patterns 覆盖，不要在其外重复跑**
   4. **质量门禁 `quality-gate.js <章.md> <项目> [--genre X]`（exit 0 才过；含 `pacing` 维度，最新章密度过低会 ⚠️ 预警；narrative-writer agent 不跑此脚本）**——这是写章的唯一硬门禁
      - **narrative-writer agent 跳过 quality-gate 的工作流兜底**：agent 写完章节返回后，**主线程在跑 step ② `tracking-updater after-chapter` 之前必须显式跑一次 `quality-gate.js <该章> <项目>`**，exit ≠ 0 不进入 track，并把阻断项转 `finish-book.js --todo` 风格的待办人工收尾，避免 agent 写章绕过唯一硬门禁导致"带病章节"入库。
   5. 风格护栏 `drift-guard.js <章.md> --project <项目>`（advisory，不阻断，仅提示文风漂移）
   6. `learn-bank.js add` 沉淀好写法 + `pipeline-gate.js backup --chapter N` 自动备份
   - **门禁语义说明**：`quality-gate.js` 是综合门禁（内部已含 check-ai-patterns / style-lint 等）；`pipeline-gate.js qa` 只是它外面套的 `.pipeline` 状态机标记壳，**两者不要重复跑**——需要状态机标记时用 `pipeline-gate.js qa`（内部调 quality-gate），否则直接调 `quality-gate.js`。中途失败用 `pipeline-gate.js resume --chapter N` 查看断点续跑。

---

## 六、能力决策树（该用哪个）

> 同名/近名脚本众多，按"想解决什么"直接定位，避免误用。

**标点**
- 写章前机械预检（清无功能省略号/破折号/双连字符/`---`）→ `scripts/punct-precheck.js`
- 写章后格式化（清 AI 特殊标点+不可见字符、引号切换）→ `scripts/punct-format.js`

**字数**
- 单章字数是否达标 → `scripts/chapter-wordcount.js`
- 从大纲生成日更配速表 → `scripts/outline-pacer.js`

**一致性 / 矛盾（四件套按层级选）**
- 单章 vs 追踪文件结构（物品/季节/角色死亡重现/名字漂移）→ `scripts/consistency-check.js`
- 跨章文本重复 / 洗稿指纹 → `scripts/cross-chapter-check.js`
- 跨章事实矛盾（独生子/长子、左手/右手、死亡后活跃）→ `scripts/continuity-ledger.js`
- 深度因果 / 设定推理（需 LLM 裁决）→ 读 `references/setup_consistency-checker.md` 走子代理
- 项目整体健康入口（会编排 consistency-check + character-sync）→ `scripts/doctor.js`

**质量 / 去 AI 味（统一入口）**
- 一键硬门禁（编排下面细分）→ `scripts/quality-gate.js`
- 细分：AI 味模式 `check-ai-patterns.js`、禁用词 `style-lint.js`、退化检测 `check-degeneration.js`、文风/人设声 `voice-check.js`、情绪曲线 `emotion-analyzer.js`、满意度 `satisfaction-meter.js`、写作评分 `writing-scorer.js`

**追踪 / 流水线 / 记忆 / 观 / 扩** → 见各自 `references/<sub>.md` 与 `docs/scripts.md`。

**选题→成书闭环 / 自测 / 数据驱动**
- 从选题到开书骨架到追读复盘一条龙 → `scripts/topic-to-book.js`（scan / match / scaffold / plan / review / finish / genre-card）
- 写完想确认全书能否收尾（伏笔回收 / 设定缺口 / 事实矛盾 / 收尾章质量门）→ `scripts/finish-book.js <项目目录>`（确定性完结门禁，exit 0 可完结 / exit 2 需先收尾；详见 `references/long-finish.md`）
- 写之前想自动组装题材正文提示卡（消手工合并瓶颈）→ `scripts/assemble-genre-card.js <项目目录> [<题材>] [--platform X]`（抽 题材定位+索引+genres模板+风格模块 生成 设定/题材正文提示卡.md；也可经 `topic-to-book.js genre-card` 调用）
- 写之前想用热榜数据定选题 → `scripts/rank-dispatcher.js` 聚合 + `topic-to-book.js scan --from-rank`（蓝海指数）
- 写完一章想防默默掉追读 → `scripts/quality-gate.js` 的 pacing 维度（advisory）
- 写完一章想防文风跑偏 → `scripts/drift-guard.js`（聚焦该章 z-score 漂移，advisory）
- 改完想确认没带崩其他脚本 → `scripts/selftest.js`

> 已废弃：`full-consistency-audit.js`（原声称"整本书级审计"但未实现跨章矛盾，且被 doctor + consistency-check + continuity-ledger 覆盖，已于 v1.4.1 删除）。

## 七、致谢

致谢：oh-story及mimocode-story
