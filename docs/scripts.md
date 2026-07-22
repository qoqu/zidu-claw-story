# 脚本命令参考（scripts/）

本目录含 **44 个纯 Node 脚本**，无第三方依赖，统一用 `node scripts/<name>.js` 调用。脚本间通过 `__dirname` 互相定位，无需额外配置。

命令中的 `<项目目录>` 指你的小说工程根（含 `正文/` `设定/` `追踪/` 等）。

> **统一写章流程（canonical，每章 6 步）**：写正文 → `tracking-updater`(+`reading-power` 喂追读) → `punct-precheck`+`check-degeneration` → **`quality-gate`(含 pacing 维度，唯一硬门禁)** → `drift-guard`(advisory) → `learn-bank`+`pipeline-gate backup`。`quality-gate` 内部已含 `check-ai-patterns`，**不要在其外重复跑**。详见 `SKILL.md`「写章标准流程」与 `references/long-write.md` Phase 5 / `references/workflow-daily.md` Step 3。

---

## A. 量化质检族

`quality-gate.js` 是统一门禁，调用下列子检查。

| 脚本 | 作用 |
|---|---|
| `quality-gate.js` | 统一质量门禁入口（双道去味：style-lint + check-ai-patterns；含追读回落 pacing 维度 advisory；其余检查全绿才放行） |
| `style-lint.js` | 文风检查（措辞/病句） |
| `consitency-check.js` | 一致性检查（人名/设定前后矛盾） |
| `foreshadow-check.js` | 伏笔检查（overdue 未回收伏笔） |
| `chapter-wordcount.js` | 字数检查（达标/节奏） |
| `cross-chapter-check.js` | 跨章重复检查 |
| `voice-check.js` | 人设/声音一致性 |
| `emotion-analyzer.js` | 情绪曲线分析 |
| `satisfaction-meter.js` | 爽点密度测量 |
| `detect-story-gaps.js` | 剧情缺口检测 |
| `writing-scorer.js` | 综合评分（0-100） |

```bash
# 统一门禁（推荐日常使用）
node scripts/quality-gate.js <章节.md> <项目目录> [--json] [--genre dushi] [--threshold 90]
# 退出码：0=通过 / 2=硬阻断 / 3=评分不足建议提质

# 单独跑某子检查（调试用）
node scripts/style-lint.js <章节.md> <项目目录>
node scripts/consitency-check.js <章节.md> <项目目录>
node scripts/chapter-wordcount.js <章节.md> <项目目录>
node scripts/writing-scorer.js <章节.md> <项目目录> --threshold 90
```

---

## B. 去 AI 味族

| 脚本 | 作用 |
|---|---|
| `check-ai-patterns.js` | AI 句式模式检测（"首先/其次/综上所述"等） |
| `check-degeneration.js` | 退化检测（空洞/套话） |
| `punct-precheck.js` | 标点预检（写章前） |
| `punct-format.js` | 标点规范化（格式化） |
| `banned-words.js` | 禁用词检测 |

```bash
node scripts/check-ai-patterns.js <章节.md>
node scripts/check-degeneration.js <章节.md>
node scripts/punct-precheck.js <章节.md>
node scripts/banned-words.js <章节.md> <项目目录>
```

---

## C. 追踪与流水线族

| 脚本 | 作用 |
|---|---|
| `tracking-updater.js` | 追踪更新主程序（管理 8 类追踪文件） |
| `character-sync.js` | 角色状态同步 |
| `pipeline-gate.js` | 流水线闸门状态机（`.pipeline/state.json`） |

```bash
# 追踪更新
node scripts/tracking-updater.js <项目目录> init
node scripts/tracking-updater.js <项目目录> after-chapter --chapter N --summary "..."
node scripts/tracking-updater.js <项目目录> add-foreshadow --chapter N --text "..." --cover "..."
node scripts/tracking-updater.js <项目目录> add-timeline --chapter N --time "..." --desc "..." --chars "..."
node scripts/tracking-updater.js <项目目录> set-character --name "..." --key "..." --value "..."
node scripts/tracking-updater.js <项目目录> add-item --name "..." --loc "..." --status "..." --chapter N
node scripts/tracking-updater.js <项目目录> set-env --key "..." --value "..."
node scripts/tracking-updater.js <项目目录> add-repeat --content "..." --location "..." --count N --alt "..."
node scripts/tracking-updater.js <项目目录> set-material --name "..." --status "..." --chapter N

# 流水线闸门
node scripts/pipeline-gate.js status <项目目录>
node scripts/pipeline-gate.js gate pre  <step> <项目目录>            # step: read|write|qa|track
node scripts/pipeline-gate.js gate post <step> <项目目录> --chapter N
node scripts/pipeline-gate.js qa <章节.md> <项目目录> [--chapter N] [--genre xxx] [--threshold 90]
# 门禁语义：qa 通过(exit 0)自动标记 qa 完成；阻断(exit 2/3)绝不标记，防"带病章节"继续 track
```

---

## D. 扫榜爬虫族

用于选题参考。需配合浏览器 CDP（见 E 族）或站点公开接口。

| 脚本 | 平台 |
|---|---|
| `qidian-rank-scraper.js` | 起点排行榜 |
| `fanqie-rank-scraper.js` | 番茄排行榜 |
| `jjwxc-rank-scraper.js` | 晋江排行榜 |
| `ciweimao-rank-scraper.js` | 刺猬猫排行榜 |
| `qimao-rank-scraper.js` | 七猫排行榜 |
| `dz-browse-scraper.js` | 豆瓣浏览 |
| `heiyan-booklist-scraper.js` | 黑岩书单 |
| `rank-dispatcher.js` | 排行榜统一底座：scan 聚合各平台榜单 MD 为 rank-index.json；refresh 统一调度 7 个爬虫（失败隔离） |

```bash
node scripts/qidian-rank-scraper.js <项目目录> [--limit 50]
# 其余爬虫参数类似，详见各脚本 --help
# 统一聚合（离线，不联网）
node scripts/rank-dispatcher.js scan --dir data/rank
node scripts/rank-dispatcher.js refresh --dir data/rank   # 逐个 spawn 7 爬虫刷新（失败隔离）
```

> 合规提示：爬虫属个人研究用途，合规由使用者自行承担。

---

## E. 浏览器 / CDP 族

| 脚本 | 作用 |
|---|---|
| `setup-cdp-chrome.js` | 以 CDP 模式启动 Chrome（支持登录态抓取） |
| `cdp-utils.js` | CDP 工具函数（页面操作/内容提取） |

```bash
node scripts/setup-cdp-chrome.js            # 启动可远程调试的 Chrome
# 配合 references/browser-cdp.md 使用
```

---

## F. 工具 / 维护

| 脚本 | 作用 |
|---|---|
| `repair-scripts.js` | 脚本自检/修复（路径与依赖校验） |
| `outline-pacer.js` | 字数节奏 / 日更配速 |

```bash
node scripts/repair-scripts.js
node scripts/outline-pacer.js <项目目录> --target 4000
```

---

## G. 体检 / 跨章事实 / 记忆（T1 增强）

| 脚本 | 作用 |
|---|---|
| `doctor.js` | 项目体检：结构 / 追踪文件 / 流水线状态 / 备份新鲜度 / （默认）最新章一致性 + 角色同步，一键健康报告 |
| `continuity-ledger.js` | 跨章事实账本：确定性快筛全书「实体→属性→值」矛盾（左撇子变右撇子、死了又活等），无需 LLM，与 `consistency-checker.md` 子代理互补 |
| `learn-bank.js` | 长期记忆沉淀库：LLM 抽取好写法后结构化存储，`query` 召回注入新章任务书 |

```bash
# 项目体检（写章前后各跑一次）
node scripts/doctor.js <项目目录> [--json] [--no-subchecks]

# 跨章事实矛盾快筛（整本书级，确定性）
node scripts/continuity-ledger.js <项目目录> [--json]

# 长期记忆沉淀库（LLM 供内容，脚本存读）
node scripts/learn-bank.js <项目目录> add   --type 爽点套路 --content "..." [--tags "a,b"] [--chapter N] [--source "第N章"]
node scripts/learn-bank.js <项目目录> query [--type X] [--tag T] [--kw "..."] [--limit N]
node scripts/learn-bank.js <项目目录> list  [--type X] [--limit N]
node scripts/learn-bank.js <项目目录> export [--md]
node scripts/learn-bank.js <项目目录> stats
```

---

## H. 节奏 / 漂移 / 仪表盘（T2 数据层）

复用 T1 的 `追踪/追读力.md` 时间序列与正文语料，做"看数据"层。三者均为确定性、零依赖，与 LLM 类的 `consistency-checker.md` 互补。

| 脚本 | 作用 |
|---|---|
| `pacing-density.js` | 节奏密度曲线：解析 `追踪/追读力.md` 每章块，合成追读密度分(0-100)，ASCII 曲线 + 水章标记 + `--html` 折线图 |
| `style-drift.js` | 文风漂移检测：逐章算句长/对话比/标点密度/用词丰富度，与全书均值比 z-score，标记 `\|z\|>1.5` 的漂移章 |
| `dashboard.js` | 多项目仪表盘：扫描根目录下属项目，聚合章节数/总字数/最新章/最新追读密度/doctor 健康度/记忆条数；`--html` 卡片含每本书追读密度火花线(SVG)与健康度进度条 |
| `drift-guard.js` | 实时风格护栏：写完一章跑，复用 style-drift 只聚焦传入章的 z-score 漂移，advisory 不阻断，可作编辑器保存钩子 |

```bash
# 节奏密度曲线（写章后看节奏是否"凹"下去）
node scripts/pacing-density.js <项目目录> [--json] [--html out.html] [--water 45]
#   → 水章 = 密度低于阈值(默认45)的章节，建议补钩子/爽点/微兑现

# 文风漂移检测（查代笔 / AI 味突变 / 状态断档）
node scripts/style-drift.js <项目目录> [--json] [--html out.html] [--z 1.5]

# 多项目仪表盘（多开书时总览）
node scripts/dashboard.js <根目录> [--json] [--html out.html]
#   → 根目录：含多个子项目（各含 正文/ 或 追踪/）的父目录

# 实时风格护栏（写完一章触发，聚焦该章文风漂移）
node scripts/drift-guard.js <章节文件> [--project <项目目录>] [--z 1.5]
```

---

## I. 题材库 / 设定卡 / 发布物料（T3 增强）

均为确定性、零依赖，与 LLM 类 `consistency-checker.md`、爬虫族互补。

| 脚本 | 作用 |
|---|---|
| `genre-library.js` | 题材库检索扩充：list / search / filter（按男女频·平台·标签）/ show / stats / add（新题材带 meta）/ scaffold（题材模板铺成开书设定基底） |
| `setting-cards.js` | 自动生成本书设定卡：build（合并 `设定/` 所有 .md → `本书设定卡.md`）/ extract（正文确定性抽人物·组织·地点候选，标 ⚠️）/ llm-prompt（输出 LLM 补全提示词） |
| `promo-pack.js` | 多平台发布物料：chapter（章推）/ book（书评·求追读），按起点/番茄/微博/小红书/知乎/微信/头条/B站/抖音 语气模板化生成；`--llm` 改出扩写提示词；新增 calendar / runbook 子命令按平台+节奏生成逐章发布命令与检查清单（写→发闭环） |

```bash
# 题材库检索
node scripts/genre-library.js list
node scripts/genre-library.js search --kw 扮猪吃虎
node scripts/genre-library.js filter --gender 女频 --platform 番茄 --tag 甜宠
node scripts/genre-library.js show 修仙
node scripts/genre-library.js stats
node scripts/genre-library.js add 国运降维 --gender 男频 --platform 起点,番茄 --tags 国运,爽文 --hook "全民穿越，国运绑定个人天赋"
node scripts/genre-library.js scaffold 修仙 <项目目录>      # → 设定/题材基底_修仙.md

# 设定卡
node scripts/setting-cards.js <项目目录> build
node scripts/setting-cards.js <项目目录> extract [--json]
node scripts/setting-cards.js <项目目录> llm-prompt

# 发布物料
node scripts/promo-pack.js chapter <项目目录> --chapter N --platform 起点 [--title 书名] [--llm]
node scripts/promo-pack.js book    <项目目录> --platform 小红书 [--title 书名] [--llm]

# 发布排期 / Runbook（写→发闭环）
node scripts/promo-pack.js calendar <项目目录> --platforms 微博,小红书,B站 --start 2026-07-22 --cadence daily [--chapters 30] [--out 排期.md]
node scripts/promo-pack.js runbook  <项目目录> --platforms 微博,小红书,B站 [--out 发布Runbook.md]

---

## J. 选题→成书闭环 / 自测套件（T4 增强）

把零散能力串成可复用系统，并加回归护栏。

| 脚本 | 作用 |
|---|---|
| `topic-to-book.js` | 选题→成书闭环编排：scan（题材风向）/ match（选题匹配）/ scaffold（开书骨架）/ plan（每日配速）/ review（追读复盘），通过 child_process 复用 genre-library / outline-pacer / tracking-updater / pacing-density / learn-bank |
| `selftest.js` | 自测套件：阶段1 语法检查 + 阶段2 启动冒烟 + 阶段3 功能冒烟（tracking-updater init → dashboard → learn-bank → genre-library → outline-pacer），回归护栏 |

```bash
# 选题→成书（从热点到开书骨架）
node scripts/topic-to-book.js scan --kw 扮猪吃虎
node scripts/topic-to-book.js scan --from-rank [--refresh] --rank-dir data/rank   # 蓝海指数选题榜（--refresh 一键刷热榜，失败回退缓存）
node scripts/topic-to-book.js match --topic "重生爽文"
node scripts/topic-to-book.js scaffold --genre 修仙 --title "我的书" [--gender 男频] [--platform 起点]
node scripts/topic-to-book.js plan    --dir <项目目录> [--words 3000]
node scripts/topic-to-book.js review  --dir <项目目录>

# 自测（改完任何脚本后跑一遍，防回归）
node scripts/selftest.js [--quiet] [--json]
```

> 实时热榜需 rank-scraper（浏览器/CDP），scan 默认离线以适配无头环境。
```
