# Changelog — zidu-claw-story

纯 Node 零依赖单包 AI 网文写作技能。本文件记录 v1.7.x 系列的关键变更；更早的 v1.0–v1.6 历史不在此追溯。

版本号规则：`VERSION` 文件为唯一真源，`SKILL.md` / `README.md` / 12 个 `references/*.md` frontmatter 同步 bump。所有 bump 通过纯 Node 脚本写回，规避 Windows PowerShell 的 UTF-8 BOM 注入回归。

---

## v1.7.23（2026-07-29，启动闸 label 自包含说明 + 禁止砍选项）

- **label 格式改为自包含**：从 `emoji+单字`（如 `✍ 写`）改为 `emoji 单字 — 一句话说明`（如 `✍ 写 — 开书写文：长篇/短篇开书 → 大纲 → 连载/日更/续写 → 完结`）。功能说明直接写在 label 里，不依赖 AskUserQuestion 的 description 字段（该字段在部分 UI 中不渲染）。
- **新增硬规则：8 个域必须全量列出**。禁止因为「选项太多」而只列部分域、把其余折入「其他」或「其他补充…」。用户需要看到完整地图才能做决策。
- 实施要点同步更新：强调「label 必须包含功能说明文字」「8 域全列一个不少」。
- 未动 SOP-ANCHOR（指纹 93bc0e9c 不变）。

---

## v1.7.22（2026-07-29，启动闸选项加功能说明：不再只显示单字）

- **启动闸 AskUserQuestion 选项增加 `description` 字段**：原来只显示 emoji+单字（如「✍ 写」），用户无法判断每个域是干嘛的。现在每个选项必须同时填写 `label`（短名）和 `description`（功能说明），description 不得省略或只填单字。
- 8 个域的 description 分别为：
  - ✍ 写 → 开书写文：长篇/短篇开书 → 大纲 → 连载/日更/续写 → 完结
  - 🔍 拆 → 拆书研究：拆解对标爆款结构、黄金三章分析、情绪弧研究
  - 📊 选 → 扫榜选题：爬取起点/番茄/晋江/盐言等平台榜单，找热门题材和蓝海机会
  - ✨ 净 → 净化美化：去 AI 味润色、生成小说封面图
  - 🟥 查 → 查体导入：项目审查体检、导入已有小说、初始化新写作环境
  - 🛡 控 → 追踪管控：质检门禁、伏笔/角色/时间线追踪、追读力监控、自动备份续跑
  - 🔁 流 → 流程管线：选题→成书闭环、排行榜蓝海指数、风格护栏、自测回归
  - 📦 扩 → 扩展工具：题材库(37模板)检索、生成本书设定卡、多平台发布物料包
- 实施要点新增「description 不能省略」规则。
- 未动 SOP-ANCHOR（指纹 93bc0e9c 不变）。

---

## v1.7.21（2026-07-29，扫榜后列表推荐题材+对应书供选拆书）

强化 `story-long-scan` 的「选题→拆书」衔接：扫榜产出 `选题决策.md` 时，同步构建**「拆书候选书库」**——按推荐选题从真实扫榜样本挑 2-4 本对标书（书名/作者/平台·榜单/核心指标/为什么适合当标杆），并在对话中**以列表展示**。闸 A「拆书」分支改为用 AskUserQuestion 列出候选书让用户勾选 1-3 本（可跨选题），再把「书名+平台」直接带入 `/story-long-analyze`，不再重复问书名（long-analyze Phase 1 已识别该来源并改为只索取原文）。`topic-decision.md` 模板新增「拆书候选书库」段。未动 SOP-ANCHOR（指纹 93bc0e9c 不变）。

## v1.7.20（2026-07-29，启动闸无条件触发：无论启动词都先问功能）

强化 v1.7.19「启动闸」：移除「用户一开始说出明确意图则跳过本闸」的例外。**现在无论用户用什么词启动 skill**（哪怕直接说「帮我扫个榜」「写一本都市文」），第一步都必须用 AskUserQuestion 抛 8 大域选项让用户确认本轮功能，再进入对应流程。规则与手动模式人工闸 A/B 一致——功能入口必须由人拍板，AI 不替用户做分支决策。

- 未触动 SOP-ANCHOR 区块（指纹仍 93bc0e9c），docs/sop-complete 无需重绘。
- 验证：selftest 58/58 PASS；audit.js 全绿（D/E/F=0、SOP 指纹不变）。

---

## v1.7.19（2026-07-29，启动闸：第一轮必须由人选功能 + 扫榜默认实时新书榜）

解决「skill 启动后直接甩整张 8 大域地图给用户」的体验问题——改为启动即强制交互选功能：

- **§〇 改为「启动闸」**（SKILL.md）：原逻辑是「用户没说清 → 先展示 8 大域地图 → 再问想做什么」；新逻辑是**启动即 AskUserQuestion 抛 8 大域选项让用户选**，选完后再展开对应域详情。功能总览表降级为「按需展开参考」，不再启动时全量展示。若用户一开始就说了明确意图则跳过本闸直入路由表（**此例外已于 v1.7.20 移除，改为无条件触发**）。
- **扫榜默认值固化**（long-scan.md Phase 1）：用户选了「📊 选（扫榜）」进入后，**默认扫实时新书榜**（各平台新人向榜单），再用 AskUserQuestion 确认平台（起点/番茄/晋江/盐言）+ 频道/题材范围（男频/女频/特定/不限）。纯「扫榜」无限定时默认 = 番茄+男频+实时新书榜 直接开跑。消除「先问你要啥榜」的多余回合。

---

## v1.7.18（2026-07-29，固化「扫榜后选择」强制互动闸 A）

针对实测中「扫榜后未征询就直接 scaffold + 写正文」的失控入口，在「开书 → 咨询 → 写章」闸 B 之上游新增一道强制互动：

- **闸 A（SKILL.md 手动模式人工闸）**：扫榜（scan + 蓝海分析）产出 `选题决策.md` 后**必须暂停**，用 AskUserQuestion 向用户抛「拆书 / 直接开书」二选一；未经用户明确选择，禁止自动进拆书管道或写正文。AI 可给推荐项但不得替用户拍板。直接对齐 oh-story「先扫榜、后拆书」理念。
- **long-scan.md 流程衔接改写**：原被动「跳转到」表改为「手动模式强制互动（扫榜后的必停点）」——明确禁止自动跳转，列出 拆书 / 直接开书 / 再扫 / 短篇 四选项，等用户表态才继续；Phase 4 收尾也补「下一步不是自动开写」提示。
- 未触动 SOP-ANCHOR 区块（指纹仍 93bc0e9c），故 docs/sop-complete.svg/.html 无需重绘；纯行为/文档规则固化。
- 验证：selftest 53/53 PASS；audit.js 全绿（D/E/F=0、SOP 指纹不变）。

## v1.7.17（2026-07-28，修复「开书→写章」失控：人工闸 + quality-gate 主观项降级）

针对实测中「AI 在用户只说『长篇·从零开书·番茄』后自行锁定题材、设计概念、写第 1 章并陷入去味循环」的失控问题，做三处修复：

- **A 手动模式人工闸（SKILL.md）**：在 golden path 与 SOP 之间新增「手动模式人工闸（开书 → 咨询 → 写章）」小节——开书 = 搭骨架 + 抛选题建议（含扫榜/蓝海依据），**必须暂停等用户签字**才进写章 6 步；未经用户明确「开写/写第 N 章」禁止写正文。自动模式（定时/不在场）可跳过。未触动 SOP-ANCHOR 区块，指纹仍为 93bc0e9c。
- **B quality-gate 主观项降级（scripts/quality-gate.js）**：将「情绪曲线平坦」「爽点密度不足」由 `BLOCK`（exit 2 硬阻断）降级为 `ADVISORY`（默认不阻断，由人工读感终裁），新增 `--strict` 可升级回 BLOCK。对齐 oh-story「人工读感才是最终标准 / 为过检测而乱改文是反模式」原则，根治「为过检疯狂注入紧张词」的 20+ 轮去味循环。客观项（禁用词/一致性/字数/人设崩/跨章重复/overdue 伏笔）仍硬阻断。
- **C 细纲确认（references/long-write.md）**：「开书默认停靠」段交叉引用人工闸——题材/核心概念/书名/细纲草案需用户确认，不得 AI 自动建 stub 就写正文（细纲本就是写正文的硬前置）。
- 验证：selftest 53/53 PASS；audit.js 全绿（D/E/F=0、SOP 指纹不变 93bc0e9c）。

## v1.7.16（2026-07-27，版本 bump + SOP 图示同步 C②）

纯版本 bump 与图示同步，**无脚本行为变更**（C② 真实率软强制逻辑已于 v1.7.15 的 `2833ddb` 落地）：

- **VERSION 1.7.15 → 1.7.16**：同步 `README.md`、`docs/sop-baseline.json`、12 个 `references/*.md` frontmatter 的 `version:`，及 `references/setup.md` 的 `setup_skill_version:`。
- **SOP 流程图补 C② 节点**：`docs/sop-complete.svg` / `docs/sop-complete.html` 现于第 4 步「追踪更新 + 追读力」与软强制 note 区体现「软强制②：前 5 章内须补齐真实追读率，>5 章无则拒跑，--force 留痕 `.pipeline/realrate-force.log`」；页脚/同步注释版本号升 1.7.16。
- **HTML legend 顺序对齐门禁前置**：原「写正文 → 追踪 → 净化 → 门禁」旧顺序修正为「写正文 → 净化 → 质量门禁 → 追踪(+软强制) → 护栏 → 沉淀」，与图中框序一致。
- 验证：selftest 53/53 PASS；audit.js 全绿（SOP-ANCHOR 指纹不变，仍为 93bc0e9c——本次未触动 SKILL.md 主流程区块）。

## v1.7.15（2026-07-23，SOP 流畅度审计全量修复）

全流程 SOP 审计发现的 6 项（A/B/C/D/E/G）全部处理——含 3 处纯 doc/string 修正与 3 处行为变更/新功能：

- **C 修错流水线（doc/string）**：`topic-to-book.js scaffold` 打印的「推荐写作流水线」对齐 SKILL.md「写章标准流程」6 步——修正第 4 步 `quality-gate.js` 的 CLI（首个位置参数是章节文件而非目录，原写法必 exit 2），补齐去味/格式（punct-precheck+check-degeneration）、drift-guard、pipeline-gate backup，删除冗余的 pacing-density 步骤。
- **A 补文档（doc/string）**：`SKILL.md` learn-bank 段注明 `query` 现同时跨 `references/` 做 BM25 确定性召回「相关参考」（scripts/retrieval.js）。
- **E 激活方法论注入（doc/string）**：`references/long-write.md` 的 Phase 2/3/4 各加 `node scripts/genre-methodology.js route --stage character|outline|writing --len long` 注入句，激活 SKILL.md L11 声称但子文档缺失的跨题材方法论注入。
- **G quality-gate 子检查异常改 advisory（行为变更）**：check-ai-patterns 子检查异常（崩溃/非 JSON）原只记 `results.ai_patterns={status:error}` 却**不进 blockers**，导致 AI 味检查被静默跳过。现新增 `advisories` 数组，异常时转 advisory 并在 JSON/可读报告均可见，**不再静默放过**（仍不阻断，符合 advisory 语义）。
- **D 补完结生命周期（新功能）**：新增 `scripts/finish-book.js` —— 确定性完结门禁，复用 foreshadow-check（伏笔回收）/ detect-story-gaps（设定缺口）/ continuity-ledger（事实矛盾）/ quality-gate（收尾章）做全书级体检，输出 `追踪/完结报告.md` + 归档备份；exit 0 可完结 / exit 2 需先收尾。配套 `references/long-finish.md` SOP，接入 SKILL.md 生命周期、`menu.js` 写域、`topic-to-book.js finish` 子命令。
- **B 加强弱交接（行为变更 + 文档）**：① `topic-to-book scaffold` 现生成首批 10 章 `细纲_第NNN章.md` stub（含字数目标），闭合 quality-gate `getTargetWords` 的字数目标交接缺口（否则永远回退默认 3000、多处读取端读空）；② `learn-bank.js` 的 `add`/`query` 加双向消费者提示（add=生产者 / query=消费者，写前召回才算交接）；③ `SKILL.md` learn-bank 段补「交接纪律」说明。
- 验证：selftest 50/50 PASS（新增 finish-book 阶段3 冒烟）；`long-write.md` 含 3 处 route 调用；scaffold 实测生成细纲 stub + 打印正确流水线；finish-book 在临时项目实测 exit 0 / exit 2 双路径。
- 脚本数 49 → **50**（新增 finish-book.js）；README/menu.js/SKILL.md/selftest 计数同步。

## v1.7.14（2026-07-23，已发布 tag）

- **⑥②(b) 确定性检索增强**：新增 `scripts/retrieval.js` —— 零依赖 BM25 跨 `references/` 全部 `.md` 的确定性召回层（CJK 友好：拆词 + 二元组混合），索引全包 **216 文件 / 5529 个 section**，CLI 子命令 `search / stats / index`。与 `learn-bank`（记忆沉淀）、`genre-library`+`genre-methodology`（题材模板与方法论）数据源互不重叠，共同构成「确定性 RAG 式召回」底座。
- **`learn-bank query` 集成 references 召回**：`query --kw X` 现在同时输出「记忆召回」与「相关参考（跨 references 确定性召回）」，新段格式 `## 相关参考（跨 references 确定性召回）`。
- **R3 命名 smell 修复**：`rank-common.evalJSON`（base64 包装的浏览器内 JS 执行）与 `cdp-utils.evalJSON`（裸 eval）同名行为不同，易混淆。将特化版重命名为 `evalJSONB64`，更新 5 个调用方（dz-browse / ciweimao / fanqie / jjwxc / qimao），cdp-utils 裸版（heiyan / qidian 用）保持不变。
- **selftest 扩面**：阶段3 新增 `retrieval.js search` 冒烟（须运行、JSON 合法、库非空、有命中）；脚本数 48 → **49**。
- **CHANGELOG.md 新建**（本文件）。

## v1.7.13（commit `ffc842a`）

全流程重审计修复轮（基于 Explore 子代理扫描 + 源码核验）：

- **R1+B6 抽共享库 `scripts/fs-utils.js`**：收敛 6 处完全相同的 `readFile`（continuity-ledger / dashboard / doctor / learn-bank / pacing-density / style-drift）+ doctor/pipeline-gate 的 `readJson` / `writeJson` → 统一 `require('./fs-utils')`；`readFile` 统一剥离 UTF-8 BOM（修 B6）。
- **B5 原子写**：`fs-utils.writeJsonAtomic`（先写 `.tmp.<pid>` 再 rename），`learn-bank` 与 `pipeline-gate` 的状态 JSON 写入路由到原子写，消除并行竞态。
- **writing-scorer 裸 JSON.parse 修复**（line 29）→ 改用 `readJson`（BOM 防护）。
- **B1 cdp-utils.ab() 显式告警**：agent-browser CLI 缺失时向 stderr 打印一次提示，仍优雅降级（可诊断、不崩流程）。
- **R2 收尾**：核验 fanqie / heiyan 本地 `probePage` 为**有意分歧**（番茄查 `__INITIAL_STATE__`、黑岩走 API），加注释保留；qidian SSR 不引 rank-common 加注。
- **B7+B4 selftest 扩面**：阶段3 新增 `doctor` / `writing-scorer` / `quality-gate` 端到端冒烟；脚本数 47 → **48**。
- **⚠ 审计漏掉的真实死链修复**：`references/score-templates/` 目录原本不存在，`writing-scorer` 与 `quality-gate` 第 10 项 writing-score 子检查是死链 → 新建 `references/score-templates/default.json`（15 维度权重合计 100），实测现 `status:ready`。
- **R4 文档计数修正**：README / menu.js / SKILL.md / docs/scripts.md / setup.md 的「44 / 40」→ 实际脚本数。

## v1.7.12（commit `557ffc1`）

- **⑥ Tier3 真实剩余增量**：新增 `scripts/genre-methodology.js` —— 确定性检索 `references/genre-*`（跨题材写法方法论：genre-catalog / core-mechanics / readers / trends / writing-formulas / writing-techniques / prose-cards，及 `long-write_*` / `short-analyze_*` / `setup_*` 变体），按管线阶段 `outline|character|writing` + 篇幅 `long|short` 过滤，供开书 / 大纲自动注入。与 `genre-library.js`（`references/genres/` 37 篇按题材模板）互补。
- **BOM 回归修复**（commit `859e714`）：剥离 v1.7.11 版本 bump 经 PowerShell 误注入的 UTF-8 BOM（曾致 `style-lint.js` 语法错误与 11 个 `references/*.md` frontmatter 解析失败）。
- 新增 `TIER3-ROADMAP.md`，记录 ① 已由 genre-library 实现、②③ 受铁律 / 高风险约束暂缓。

## v1.7.11（commit `f58d575`）

- **④ 8 平台排行榜脚本合并**：抽取 `scripts/rank-common.js` 共享 CDP 脚手架（`evalJSON` / `probePage` / `clickTab` / `extractBookUrls` / `pushBookBlock`）；7 个爬虫主体零改动仅去重 plumbing；新增 `rank-dispatcher.js` 调度底座。脚本数 46 → **47**。

## v1.7.9–v1.7.10（commits `53d02f2` / `820788d`）

- **质量 / AI 味簇交叉审计**：抽取共享 `satisfaction-points.js`（emotion-analyzer + satisfaction-meter 单一爽点词表，消除双扫描）；收敛 `style-lint` ↔ `check-ai-patterns` 去味门禁（`not-is` / 破折号独家 blocking，保留 voice / writing-scorer / degeneration 不动）。脚本数 45 → **46**。

## v1.7.0（基线）

- 单包技能成形，约 **44** 个脚本 + 扁平 `references/` 方法论 + 11 子文档；确立「零依赖 + 确定性」铁律（不引入 webnovel 的 RAG 向量嵌入方案）。

---

## 仍未启动（按决策暂缓，非缺陷）

- **⑥ ②(a) 向量 RAG**：受铁律约束，默认阻断。
- **⑥ ③ 协同 Agent 化**：高复杂、破坏确定性质量门禁风险、状态契约未定义，后置。
- **① 成书双路径**：经核查 `topic-to-book scaffold` 早已消费 `选题决策.md`（v1.7.8 已对齐），属过期待办，已清。
