---
name: zidu-claw-story
description: "AI 网文写作完整工具箱（单包、WB 原生）。触发场景：写长篇/短篇、开书/大纲/连载/日更/续写、拆文分析（黄金三章/对标）、扫榜选题（起点/番茄/晋江/盐言）、去AI味、封面图、导入小说/反向解析、初始化写作环境、量化质检/质量门禁/查禁用词、伏笔时间线角色物品追踪、流水线闸门、浏览器/CDP抓取。关键词：「写网文」「帮我写书」「小说」「开书」「选题」「扫榜」「去味」「封面」「导入」「质检」「追踪」「流水线」「审查」「体检」。"
---

# zidu-claw-story：AI 网文写作完整工具箱（单包）

你是统一入口。本 skill 把**网文写作全流程**（长篇/短篇/拆文/扫榜/去味/封面/导入/初始化）与**量化质检**（quality-gate 硬门禁）+ **追踪流水线**（tracking-updater / pipeline-gate）全部能力整合为 **一个 WB 原生 skill**，无外部依赖、无宿主私有契约。

- 所有可执行脚本：`scripts/`（用 `node scripts/<name>.js` 调用）
- 所有子流程知识库：`references/<sub>.md`（路由后读对应主文档 + 其下 craft KB）
- 版本：`VERSION` 文件

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
```
> 管理 `追踪/` 下 8 类文件（伏笔/时间线/角色状态/物品/环境/重复语句/素材/上下文）。`after-chapter` 一键写上下文+字数。

### 流水线闸门 `pipeline-gate.js`
```bash
node scripts/pipeline-gate.js status <项目目录>
node scripts/pipeline-gate.js gate pre  <step> <项目目录>            # step: read|write|qa|track
node scripts/pipeline-gate.js gate post <step> <项目目录> --chapter N
node scripts/pipeline-gate.js qa <章节.md> <项目目录> [--chapter N] [--genre xxx] [--threshold 90]
```
- 状态机存于 WB 原生 `.pipeline/state.json`。
- **门禁语义固化于代码**：`qa` 质量**通过(exit 0)时自动标记 qa 完成**；**阻断(exit 2/3)绝不标记**——避免"带病章节"继续 track。
- 详细规范：`references/tracking-spec.md` + `references/pipeline.md`

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
4. 写章标准流程（WB 手动版）：写正文 → `normalize-punctuation.js` 标点预检 → `check-ai-patterns.js` 去味预检 → `quality-gate.js` 硬门禁（exit 0 才过）→ `tracking-updater.js after-chapter` + 各语义追踪 → `pipeline-gate.js gate post qa/track` 标记完成。

---

## 六、致谢

致谢：oh-story及mimocode-story
