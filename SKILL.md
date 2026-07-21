---
name: zidu-claw-story
description: "AI 网文写作完整工具箱（单包、WB 原生）。触发场景：写长篇/短篇、开书/大纲/连载/日更/续写、拆文分析（黄金三章/对标）、扫榜选题（起点/番茄/晋江/盐言）、去AI味、封面图、导入小说/反向解析、初始化写作环境、量化质检/质量门禁/查禁用词、伏笔时间线角色物品追踪、流水线闸门、浏览器/CDP抓取。关键词：「写网文」「帮我写书」「小说」「开书」「选题」「扫榜」「去味」「封面」「导入」「质检」「追踪」「流水线」「审查」「体检」。"
---

# zidu-claw-story：AI 网文写作完整工具箱（单包）

你是统一入口。本 skill 把**网文写作全流程**（长篇/短篇/拆文/扫榜/去味/封面/导入/初始化）与**量化质检**（quality-gate 硬门禁）+ **追踪流水线**（tracking-updater / pipeline-gate）全部能力整合为 **一个 WB 原生 skill**，无外部依赖、无宿主私有契约。

- 所有可执行脚本：`scripts/`（用 `node scripts/<name>.js` 调用）
- 所有子流程知识库：`references/<sub>.md`（路由后读对应主文档 + 其下 craft KB）
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
| ✍ 写 | 长篇 / 短篇开书、大纲、连载、日更、续写 | `references/long-write.md`、`references/short-write.md` |
| 🔍 拆 | 长篇 / 短篇拆文、对标爆款、黄金三章 | `references/long-analyze.md`、`references/short-analyze.md` |
| 📊 选 | 起点 / 番茄 / 晋江 / 盐言扫榜选题 | `references/long-scan.md`、`references/short-scan.md` |
| ✨ 净 | 去 AI 味、生成封面图 | `references/deslop.md`、`references/cover.md` |
| 🗂 查 | 审查体检、导入已有书、初始化环境 | `references/review.md`、`references/import.md`、`references/setup.md` |
| 🛡 控 | 量化质检、伏笔/时间线/角色/物品追踪、追读力量化、自动备份/断点续跑、浏览器 CDP 抓取、项目体检、跨章事实账本、长期记忆沉淀库、节奏密度曲线、文风漂移检测、多项目仪表盘 | `scripts/quality-gate.js`、`scripts/tracking-updater.js`、`scripts/pipeline-gate.js`、`references/browser-cdp.md`、`scripts/doctor.js`、`scripts/continuity-ledger.js`、`scripts/learn-bank.js`、`scripts/pacing-density.js`、`scripts/style-drift.js`、`scripts/dashboard.js` |

## 一、意图路由表

| 用户意图 | 关键词示例 | 执行 |
|---|---|---|
| 写长篇 | 开书、写大纲、长篇、连载、日更、续写、继续写 | 读 `references/long-write.md` 并按其执行 |
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
| 查故事资料 | 查角色、查伏笔、查进度、写到哪了 | 主线程用 Read/Grep 检索项目 `设定/` `追踪/` `大纲/`（见「四、WB 适配」降级说明） |

> 意图模糊时，先匹配上表；无法匹配则询问用户想做什么（从表中选）。说"我想写小说"但未指定篇幅，先问长篇/短篇再路由。

## 二、量化质检（quality-gate）

`scripts/quality-gate.js` 是统一质量门禁，9–10 项检查全绿才放行：

```bash
node scripts/quality-gate.js <章节.md> <项目目录> [--json] [--genre dushi] [--threshold 90]
```

- 退出码：**0 = 通过** / **2 = 硬阻断**（一级禁用词、一致性错误、 overdue 伏笔、字数不足、跨章重复、人设崩、情绪曲线平坦、爽点密度不足等）/ **3 = 评分不足建议提质**
- 子检查：style-lint / consistency / foreshadow / wordcount / cross-chapter / voice / emotion / satisfaction / gaps / scorer（均位于 `scripts/`，`quality-gate` 用 `__dirname` 自动定位）
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
node scripts/tracking-updater.js <项目目录> reading-power --chapter N --hook-type 危机钩 --hook-strength strong --coolpoint "..." [--coolpoint "..."] --micropayoff "..." [--hard-violation HARD-xxx] [--debt 0]
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
- 与 `consistency-check.js`（单章 vs 追踪文件）和 `references/consistency-checker.md`（LLM 推理子代理，S1–S4 分级）**互补**，不重复。结果作为候选交人工 / LLM 子代理裁决。
- 退出码：0 = 通过 / 2 = 发现矛盾候选。

### 长期记忆沉淀库 `learn-bank.js`
```bash
node scripts/learn-bank.js <项目目录> add   --type 爽点套路 --content "..." [--tags "a,b"] [--chapter N] [--source "第N章"]
node scripts/learn-bank.js <项目目录> query [--type X] [--tag T] [--kw "..."] [--limit N]
node scripts/learn-bank.js <项目目录> list  [--type X] [--limit N]
node scripts/learn-bank.js <项目目录> export [--md]
node scripts/learn-bank.js <项目目录> stats
```
- LLM 从正文抽取「好用的写法」后写入 `记忆/写法沉淀.json`；新章任务书用 `query` 召回注入，**越写越香、不糊**。
- type 建议：`爽点套路` / `人设高光` / `金句` / `节奏` / `设定钩子`。

## 四·观：节奏曲线 / 文风漂移 / 多项目仪表盘（T2 新增）

三者均**确定性、零依赖**，复用 T1 的 `追踪/追读力.md` 时间序列与正文语料，属于"看数据"层，与 `references/consistency-checker.md`（LLM 推理子代理）互补。

### 节奏密度曲线 `pacing-density.js`
```bash
node scripts/pacing-density.js <项目目录> [--json] [--html out.html] [--water 45]
```
- 解析 `追踪/追读力.md` 每章块，合成**追读密度分(0-100)**：钩子强度 + 爽点模式数 + 微兑现数×1.5 − 硬约束违规数 + 债务微加成，再按全书最大值归一化。
- 终端输出 ASCII 曲线 + **水章标记**（密度 < 阈值，默认 45）；`--html` 出 SVG 折线图（水章标红）。
- 用途：写章后一眼看出"节奏凹下去"的章节，针对性补钩子/爽点/微兑现。

### 文风漂移检测 `style-drift.js`
```bash
node scripts/style-drift.js <项目目录> [--json] [--html out.html] [--z 1.5]
```
- 逐章算文风指标：句长均、对话占比、标点密度、用词丰富度、段落数；与全书均值比 **z-score**，标记 `|z| > 1.5`（可 `--z` 调）的**漂移章**。
- 用途：辅助识别代笔 / AI 味突变 / 写作状态断档。
- 有效章节 < 3 章时退出（基线不可靠）。

### 多项目仪表盘 `dashboard.js`
```bash
node scripts/dashboard.js <根目录> [--json] [--html out.html]
```
- 扫描根目录下所有含 `正文/` 或 `追踪/` 的子项目，聚合：章节数 / 总字数 / 最新章 / 最新追读密度 / doctor 健康度（内联轻量检查）/ 记忆沉淀条数 / 最近更新。
- doctor 健康度用内联轻量检查（不逐项目 spawn 子进程）；需要深度体检仍用 `doctor.js`。
- 用途：多开书时一屏总览；`--html` 出卡片视图。

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
4. 写章标准流程（WB 手动版）：开书时从 `references/genres/` 选题材模板作为设定基底 → 写正文 → `normalize-punctuation.js` 标点预检 → `check-ai-patterns.js` 去味预检 → `quality-gate.js` 硬门禁（exit 0 才过）→ `tracking-updater.js after-chapter` + 各语义追踪（含 `reading-power` 追读力）→ `pipeline-gate.js gate post qa/track` 标记完成 → `pipeline-gate.js backup --chapter N` 自动备份。中途失败用 `pipeline-gate.js resume --chapter N` 查看断点续跑。

---

## 六、致谢

致谢：oh-story及mimocode-story
