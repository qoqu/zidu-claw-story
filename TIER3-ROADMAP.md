# Tier3 路线图（可选 / 远期）

> 规划 zidu-claw-story 技能 Tier3 阶段（可选增强）。所有方案必须遵守包内铁律：**纯 Node 零依赖单包 + 确定性**。
> 既有铁律（见 MEMORY.md）：**不引入 webnovel 的 RAG 向量嵌入方案**（会破坏零依赖 + 确定性）。本路线图以该铁律为边界。

## 当前地基（已具备）

- `scripts/learn-bank.js`：确定性「关键词 + tag」检索 `记忆/写法沉淀.json`，供新章任务书注入。无 embedding。
- `references/` 已有丰富题材库：`genre-catalog` / `genre-core-mechanics` / `genre-readers` / `genre-trends` / `genre-writing-formulas` / `genre-writing-techniques` / `genre-prose-cards`，以及 `long-write_*` / `short-analyze_*` / `setup_*` 同名变体；另有 `cross-book-recall.md`（跨书召回参考）。
- 调度 / 脚手架底座：`rank-dispatcher.js`（调度）+ `rank-common.js`（CDP 脚手架）已就位（v1.7.11）。

## 方向一：题材库检索扩充（⭐ 推荐首选）

**现状（2026-07-23 核查）**：本方向已由 `scripts/genre-library.js`（标题「题材库检索与扩充（T3）」）实现——索引 `references/genres/` 下 37 篇题材模板，提供 list/search/filter/show/stats/add/scaffold，且被 selftest 覆盖。原「新增 genre-index.js」方案作废（避免重复造轮子）。真实剩余缺口见本方向末尾。

**问题**：题材参考文件虽多，但管线目前靠 `SKILL.md` 手动指名读取，无法按「目标题材 → 自动召回最相关参考」注入；`learn-bank` 也不索引 `references/`。

**方案（原规划，已调整）**：原计划新增 `scripts/genre-index.js` 做「题材关键词 → 参考文件」通用确定性索引。经核查，`genre-library.js` 已覆盖 `references/genres/` 模板层面，原 full-blown `genre-index.js` 不再必要。

**真实剩余缺口（已落地 v1.7.12 ✅）**：`genre-library.js` 只索引 `references/genres/`（按题材的模板），未覆盖 `references/genre-*`（跨题材写法方法论：genre-catalog / core-mechanics / readers / trends / formulas / techniques / prose-cards，及 `long-write_*` / `short-analyze_*` / `setup_*` 变体）。后者此前靠 `SKILL.md` 手动路由。
- **已实现**：新增零依赖 `scripts/genre-methodology.js`（纯 `fs/path`，确定性检索 `references/genre-*`）。
  - 子命令：`list`（按 general/long/short/setup 分组）、`route --stage <outline|character|writing> --len <long|short> [--json]`（按阶段 + 篇幅过滤，输出绝对路径）、`search --kw X`（跨文件标题扫描）、`stats`。
  - 映射：`STAGE_CORES` 把 outline→catalog+core-mechanics+writing-formulas+trends、character→readers+core-mechanics、writing→writing-techniques+prose-cards+writing-formulas+core-mechanics；`VARIANT_PREFIX` 把 long→long-write / short→short-analyze / setup→setup 变体。
  - 已接入 `SKILL.md` + `README.md`，开书 / 大纲阶段可运行 `node scripts/genre-methodology.js route --stage <outline|character|writing> --len <long|short>` 确定性召回并注入。
  - 与 `genre-library.js` 互补（前者按题材模板、后者跨题材方法论），selftest 阶段3 已加 `route` 冒烟，全量 47/47 PASS。

**哲学契合**：✅ 完美。纯 `fs/path`，无新依赖，结果可复现。
**风险 / 工作量**：低 / S（1 脚本 + 接入，已完成）。
**产出价值**：开书 / 大纲阶段自动拿到对口题材方法论，替代手动挑文件；也是「确定性 RAG」底座的一部分。

## 方向二：轻量 RAG（⚠️ 受铁律约束）

两种解读，必须分清：
- **(a) 向量嵌入 RAG**（对齐 webnovel 方案）：需 embedding 模型 + 向量库 → **违反 MEMORY.md 铁律**，需本地模型（重、非零依赖）或外部 API（网络 / 凭证、非确定性）。**默认阻断**，除非用户明确推翻该约定并说明理由。
- **(b) 确定性检索增强**（BM25 / 关键词跨 `references` + `learn-bank` 召回）：本身就是「方向一」的 superset，不引入 embedding，哲学兼容。

**结论**：不单独做 (a)。若用户要「RAG 式召回」，落地为方向一中的确定性检索层即可。

## 方向三：协同 Agent 化（⚠️ 高复杂，建议后置）

**设想**：把写作管线拆成协作子 Agent（大纲 Agent / 角色 Agent / 写作 Agent / 质检 Agent），经项目 `记忆/`、`选题决策.md` 等共享状态协作。

**哲学契合**：⚠️ 部分。编排本身不增依赖，但会改变执行模型，多 LLM Agent + 共享可变状态可能破坏「确定性质量门禁」的保证。
**风险 / 工作量**：高 / L。需先定义稳定的状态契约。
**建议**：放到方向一落地之后——届时 Agent 可确定性读取 `genre-index` + `learn-bank`，降低非确定性面。

## 推荐推进顺序

1. **Phase A（现在可做）**：方向一 题材库检索扩充。安全、高价值、零行为风险。
2. **Phase B（条件）**：仅当用户明确推翻 RAG 铁律才做向量嵌入；否则并入方向一。
3. **Phase C（探索 / 后置）**：方向三 协同 Agent 化，依赖 Phase A 提供的确定性检索底座。

## 状态

- 路线图整理于 2026-07-23。
- **方向一 真实剩余增量（已落地 v1.7.12 ✅）**：`scripts/genre-methodology.js` 确定性检索 `references/genre-*` 跨题材写法方法论，按管线阶段 + 篇幅过滤，接入 SKILL.md / README.md，selftest 47/47 PASS。与 `genre-library.js` 互补，共同构成「确定性 RAG」底座。
- 方向一 主体（`genre-library.js`，37 篇题材模板）此前已落地（v1.7.x），本路线图原 `genre-index.js` 方案作废（避免重复）。
- 方向二（向量 RAG）受铁律约束默认阻断；方向三（协同 Agent 化）高复杂后置，未启动。
- **决策（2026-07-23）**：用户评估 ②/③ 后选择「收尾本轮」。结论：⑥ 已交付 ①(genre-library) + 真实增量(genre-methodology)，②/③ 因铁律/高风险约束暂缓，不启动。后续若真要语义级召回，再单独议 ②(a) 是否推翻铁律。
- **全部改动已写入工作树，但 git 提交 / 推送被沙箱拦截（SSH 凭证未授权），待用户本地 `git add -A && git commit && git push`**。
