# 知识库索引（references/）

`references/` 含 **243 篇** 子流程知识库（craft KB）。其中 206 篇扁平组织在目录根；**`genres/` 子目录**含 37 个原创中文题材模板（开书可直接调用，见「5. 题材 / 类型写作」）。同名多版本以 `<sub>_<name>.md` 前缀区分（例如 `deslop_anti-ai-writing.md`、`long-analyze_material-decomposition.md`），均为单一真相源的补充视角，无信息丢失。

> **AI 如何使用**：先读 `SKILL.md` 的「意图路由表」定位主文档（下表「主文档」列），再按主文档指引加载相关 craft KB。

---

## 主题分组与代表性文档

### 1. 创作主流程（写 / 拆 / 扫 / 导入 / 初始化 / 封面 / 审查）
| 主文档 | 内容 |
|---|---|
| `long-write.md` | 长篇小说创作全流程 |
| `short-write.md` | 短篇小说创作 |
| `long-analyze.md` | 长篇拆文（黄金三章/对标） |
| `short-analyze.md` | 短篇拆文 |
| `long-scan.md` | 长篇扫榜选题 |
| `short-scan.md` | 短篇扫榜选题 |
| `import.md` | 导入/反向解析已有小说 |
| `setup.md` | 写作环境初始化与多宿主部署 |
| `review.md` | 审查/体检/质量复盘 |
| `cover.md` / `cover-styles.md` | 封面图设计与风格 |
| `length-routing.md` | 篇幅路由 |

### 2. 去 AI 味 / 文风
- `deslop.md`（主）、`deslop_anti-ai-writing.md`、`deslop_banned-words.md`
- `anti-ai-writing.md`、`banned-words.md`
- `dialogue-mastery.md`（对话功力）、`format-and-structure.md`（格式与结构）

### 3. 量化质检规范
- `quality.md`（质检 SOP 主文档）
- `quality-rules.md`、`quality-checklist.md`、`quality-monitoring.md`
- `consistency-checker.md`

### 4. 追踪 / 流水线规范
- `tracking-spec.md`（8 类追踪规范）
- `pipeline.md`（流水线闸门规范）
- `cross-book-recall.md`（跨书召回）、`character-state-reverse.md`（角色状态反推）

### 5. 题材 / 类型写作
- `genre-catalog.md`（类型总览）、`genre-core-mechanics.md`（核心机制）
- `genre-prose-cards.md`（类型范例卡片）、`genre-readers.md`（读者画像）
- `genre-trends.md`（趋势）、`genre-writing-formulas.md`（公式）、`genre-writing-techniques.md`（技法）
- `female-audience-writing.md`（女频）、`commercial-core-methods.md`（商业核）
- **`genres/`（37 个原创题材模板，开书可直接调用）**：`修仙.md` `都市异能.md` `科幻.md` `末世.md` `无限流.md` `宫斗宅斗.md` `规则怪谈.md` `西幻.md` 等。完整清单见目录列表，或 `node scripts/menu.js --json` 的 `write` 域「题材库(37)」项。

### 6. 角色设计
- `character-basics.md`、`character-designer.md`、`character-design-methods.md`
- `character-relations.md`（人物关系）、`character-state-reverse.md`（状态反推）

### 7. 钩子 / 悬念
- `hooks-chapter.md`（章钩子）、`hooks-paragraph.md`（段钩子）、`hooks-suspense.md`（悬念）

### 8. 情绪 / 情感
- `emotional-arc-design.md`（情绪弧设计）、`emotional-methods.md`（情感技法）

### 9. 结构 / 拆解
- `deconstruction-examples.md`、`deconstruction-notes.md`（拆解范例与笔记）
- `chapter-extractor.md`（章节抽取）

### 10. 浏览器 / CDP
- `browser-cdp.md`（CDP 浏览器操控主文档）、`artifact-protocols.md`（产物协议）

### 11. 平台专题
- `fanqie.md`（番茄平台专题）等

---

## 使用约定

1. **路由优先**：意图明确时，直接读对应主文档（见上表）；意图模糊时回 `SKILL.md` 意图路由表。
2. **craft KB 跟随主文档**：主文档会指明需要加载的配套 KB，按需读取，不必全量载入。
3. **跨平台适配**：题材/读者相关 KB 含多平台视角（起点/番茄/晋江等），按目标平台选用。
4. **版本**：知识库随包版本迭代，版本号见根目录 `VERSION`。
