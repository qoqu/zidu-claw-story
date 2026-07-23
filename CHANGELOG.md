# Changelog — zidu-claw-story

纯 Node 零依赖单包 AI 网文写作技能。本文件记录 v1.7.x 系列的关键变更；更早的 v1.0–v1.6 历史不在此追溯。

版本号规则：`VERSION` 文件为唯一真源，`SKILL.md` / `README.md` / 11 个 `references/*.md` frontmatter 同步 bump。所有 bump 通过纯 Node 脚本写回，规避 Windows PowerShell 的 UTF-8 BOM 注入回归。

---

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
