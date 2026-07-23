---
name: zidu-claw-story-setup
version: 1.7.9
description: "zidu-claw-story 单包技能的基础设施部署。将 7 个可选 subagent（story-architect / story-explorer / story-researcher / chapter-extractor / character-designer / consistency-checker / narrative-writer）部署到 Claude Code / OpenCode / Codex / OpenClaw / 通用 Agent 项目的对应 agents 目录；说明 subagent 如何解析技能内置 references。触发方式：/story-setup、「准备写书」「帮我搭一下环境」「配置写作项目」。"
---
# zidu-claw-story 环境部署

你是写作基础设施部署器。zidu-claw-story 是**单包技能**（`SKILL.md` + `references/` + `scripts/`，零外部依赖），主流程在**主会话（solo）模式**即可完整运行。本部署器只负责把**可选 subagent** 部署到你的项目，启用多 agent 协作加速（非必需）。

**执行铁律：不覆盖用户已有配置，合并而非替换。**

---

## 单包范围说明（务必先读）

当前技能合并为单个 WB skill，与旧 `story-setup` 13-skill 拆分架构不同：

- **技能自带、无需部署**：`SKILL.md` + `references/`（扁平 .md）+ `scripts/`（44 个 .js）。主会话加载技能即全部可用。
- **可选 subagent（共 7 个）**：源文件在技能内 `references/setup_*.md`：
  - `references/setup_story-architect.md` → `story-architect`（题材/大纲/反转/情绪，opus）
  - `references/setup_story-explorer.md` → `story-explorer`（只读结构化查询，haiku）
  - `references/setup_story-researcher.md` → `story-researcher`（外部资料研究，sonnet）
  - `references/setup_chapter-extractor.md` → `chapter-extractor`（章节摘要/情节点提取，haiku）
  - `references/setup_character-designer.md` → `character-designer`（角色设定/对话创作，sonnet）
  - `references/setup_consistency-checker.md` → `consistency-checker`（事实/伏笔一致性，只读，haiku）
  - `references/setup_narrative-writer.md` → `narrative-writer`（正文写作/去AI味，sonnet）
- **本包不含**旧架构的 `templates/`、`hooks/`、`rules/`、`agent-references/` 子目录，也不含 opencode/codex 专属插件与同步脚本。正文守卫、commit 提醒等在该架构下以「技能内软约束或 solo/direct fallback」执行，不在本部署范围。

> 若项目已部署 subagent 但仍想用旧架构的 hooks/多 CLI 脚手架，超出本单包范围，请按技能内 fallback 规则降级 solo。

---

## Phase 1：检测项目状态

1. 检查当前目录是否已部署过（存在 `.story-deployed`）
   - 如果已存在 → 使用 AskUserQuestion 确认是否重新部署
2. 检查是否有书名目录（包含 `追踪/` 子目录的目录，或用户自定义结构）
   - 有 → 识别为长篇项目，显示当前项目信息
   - 无 → 识别为新项目或短篇项目
3. 检查 `.claude/settings.local.json` 是否存在
   - 存在 → 读取现有配置，后续合并
   - 不存在 → 后续创建新文件
4. 检查 `opencode.json` 或 `.opencode/` 是否存在
   - 存在 → 识别为 opencode 项目，`target_cli = opencode`
5. 检查 `.codex/`、`AGENTS.md` 中的 Codex 段
   - 存在 → 识别为 Codex 项目，`target_cli = codex`
6. 检查 `.openclaw/`、`.agents/skills/`、或 `skills/*/SKILL.md` 中的 `metadata.openclaw`
   - 存在 → 识别为 OpenClaw 项目，`target_cli = openclaw`
7. 如四类内置 CLI 标记都不存在（全新项目或 Web AI 项目）→ 使用 AskUserQuestion 让用户选择目标环境（Claude Code / OpenCode / Codex / OpenClaw / 通用 Web AI 或其他 Agent / 任意组合）
   - 用户选择 opencode → `target_cli = opencode`，部署时创建 `opencode.json` 和 `.opencode/`
   - 用户选择 claude-code → 按现有逻辑处理
   - 用户选择 codex → `target_cli = codex`，部署时创建 `.codex/`
   - 用户选择 openclaw → `target_cli = openclaw`，复制技能到项目 `skills/`
   - 用户选择通用 Web AI / 其他 Agent → `target_cli = generic`，部署通用 `AGENTS.md` 与项目本地 `skills/`；不写平台专属 hooks/agents
   - 用户选择多端 → `target_cli` 为上述子集

---

## Phase 2：部署可选 subagent

### 2.0 部署清单（机械可检查）

| Source path（技能内） | Target path（项目内） | 说明 |
|---|---|---|
| `references/setup_story-architect.md` | `.claude/agents/story-architect.md` | Claude Code 可选 subagent |
| `references/setup_story-explorer.md` | `.claude/agents/story-explorer.md` | Claude Code 可选 subagent（只读） |
| `references/setup_story-researcher.md` | `.claude/agents/story-researcher.md` | Claude Code 可选 subagent |
| `references/setup_chapter-extractor.md` | `.claude/agents/chapter-extractor.md` | Claude Code 可选 subagent |
| `references/setup_character-designer.md` | `.claude/agents/character-designer.md` | Claude Code 可选 subagent |
| `references/setup_consistency-checker.md` | `.claude/agents/consistency-checker.md` | Claude Code 可选 subagent（只读） |
| `references/setup_narrative-writer.md` | `.claude/agents/narrative-writer.md` | Claude Code 可选 subagent |
| `references/setup_story-architect.md` | `.opencode/agents/story-architect.md` | target_cli 含 opencode |
| `references/setup_story-explorer.md` | `.opencode/agents/story-explorer.md` | target_cli 含 opencode |
| `references/setup_story-researcher.md` | `.opencode/agents/story-researcher.md` | target_cli 含 opencode |
| `references/setup_chapter-extractor.md` | `.opencode/agents/chapter-extractor.md` | target_cli 含 opencode |
| `references/setup_character-designer.md` | `.opencode/agents/character-designer.md` | target_cli 含 opencode |
| `references/setup_consistency-checker.md` | `.opencode/agents/consistency-checker.md` | target_cli 含 opencode |
| `references/setup_narrative-writer.md` | `.opencode/agents/narrative-writer.md` | target_cli 含 opencode |
| `references/setup_*.md` | `skills/zidu-claw-story/references/setup_*.md`（原样随技能） | target_cli 含 openclaw / generic：无需单独部署 agents，技能自身加载即可 |

> Codex 使用 `.toml` agent 定义，本包不内置生成器；如需 Codex，将 `setup_*.md` 的 frontmatter 手动转为 `.codex/agents/*.toml`（`name` / `description` / `developer_instructions`），或在 Codex 下按 fallback 降级 solo。
>
> subagent 运行时会**自行解析技能 references**（见 2.2），无需复制参考包。

### 2.1 部署 Agents（Claude Code / OpenCode）

- 读取技能内 `references/setup_{chapter-extractor,character-designer,consistency-checker,narrative-writer,story-architect,story-explorer,story-researcher}.md`
- 复制到用户项目的 `.claude/agents/`（Claude Code）或 `.opencode/agents/`（OpenCode）
- Agent 文件属于本技能管理文件，可安全覆盖；版本升级时按下方重新部署
- **部署后必须新开会话**：agent 只在会话启动时注册；原因与必须输出的报告文案见 Phase 3 第 5 步。

### 2.2 subagent 参考文件解析（关键）

7 个 subagent 在运行时需要读技能内置参考资料（如 `story-architect` 用 `hooks-chapter`、`outline-methods`、`reversal-toolkit` 等；`consistency-checker` 用 `quality-checklist`、`reversal-toolkit` 等）。当前单包技能的 `references/` 为**扁平结构**（无旧架构的 `agent-references/` 子目录）。每个 `setup_*.md` 顶部「参考文件路径规则」已配置解析顺序：

1. Glob `**/zidu-claw-story/references/{文件名}.md`（用户级 / 项目级 skill 安装位置，最常见）
2. 兜底 `~/.workbuddy/skills/zidu-claw-story/references/{文件名}.md`（WorkBuddy 用户级）
3. 项目内副本 `.claude/skills/zidu-claw-story/references/{文件名}.md`（若你曾复制技能到项目）

命中即停，直接 Read 对应 `.md`。**无需在部署时复制参考包**，agent 自行定位。

### 2.3 配置 OpenCode Agent 模型（target_cli 含 opencode 时）

> OpenCode 子代理不指定模型时继承主模型，导致低成本 Agent 也消耗主模型额度。此步骤自动检测用户模型并写入 `model:` 字段。

#### Step 0：保留已有模型配置（必须在 `.opencode/agents/` 的 replace 之前执行）

OpenCode agents 部署是 `replace`，会覆盖上次写入的 `model:`。所以在执行该 replace **之前**先扫描现有 `.opencode/agents/*.md`，缓存每个 agent 的 `model:`（agent 名 → 模型 ID）。后续检测失败/超时、或用户跳过某一级时，用缓存值回填，避免把用户上次配好的低成本模型抹成主模型。

#### Step 1：获取模型列表

优先执行 `opencode models --verbose`（含 cost / context / capabilities）；不可用或解析失败时回退到 `opencode models`（每行 `provider/model`）。两者都用 60000ms 超时。

- 成功 → 进入 Step 2
- 超时 → 重试一次；仍超时则按 Step 0 缓存回填已有 `model:`、跳过自动配置，在安装报告中输出手动配置指南
- 失败（命令不存在、输出为空等）→ 同上

#### Step 2：模型分级

**优先按成本分级（有 `--verbose` 时）**：按每模型实际 cost 从低到高分档。免费模型按真实 cost=0 归低端，不按名字里的营销词。无 cost 数据时据此进入候选。

**回退按关键词分级（无 cost 时）**：按模型 ID 最后 `/` 之后的名字段精确匹配（不区分大小写）。关键词分级是启发式，安装报告中标注 `分级依据：关键词（heuristic）`。

| 等级 | 匹配关键词 | 对应 Agent |
|------|-----------|-----------|
| 低端 | `haiku`, `flash`, `mini`, `nano`, `lite` | story-explorer、chapter-extractor、consistency-checker |
| 中端 | `sonnet`, `plus` | story-researcher、character-designer、narrative-writer |
| 高端 | `opus`, `pro`, `ultra`, `max` | story-architect |

- 一个模型可能匹配多个等级关键词，取最高等级
- 同等级内优先列出知名供应商（anthropic、openai、google、deepseek）的模型

#### Step 3：逐级交互选择

按 低端 → 中端 → 高端 顺序，每级用 AskUserQuestion 让用户选择。

**低端选项结构：**
```
问题："为只读查询 Agent（story-explorer / chapter-extractor / consistency-checker）选择模型："
选项：
  - provider/model-id
  - 自定义输入（手动输入完整模型 ID）
  - 保留现有模型（Step 0 缓存）
  - 跳过，使用主模型
```
**中端选项结构：**
```
问题："为资料研究 / 角色设计 / 叙事创作 Agent（story-researcher / character-designer / narrative-writer）选择模型："
选项：
  - provider/model-id
  - 自定义输入（请勿使用低端模型，会影响研究/创作质量）
  - 保留现有模型
  - 跳过，使用主模型
```
**高端选项结构：**
```
问题："为总指挥 Agent（story-architect）选择模型："
选项：
  - provider/model-id
  - 自定义输入
  - 保留现有模型
  - 跳过，使用主模型
```

规则：
- 候选最多显示 5 个，超过则截断并提示「更多模型请使用自定义输入」。**每一级无论候选数是否为 0 都用 AskUserQuestion 弹出**，选项至少含：候选模型（如有）、`自定义输入`、`保留现有模型`、`跳过，用主模型`。
- `自定义输入`：校验为单行、无控制字符、匹配 `^[A-Za-z0-9._-]+/[A-Za-z0-9._:+-]+$`。
- `保留现有模型`：写回 Step 0 缓存（重新部署时保住用户上次配置）。
- `跳过，用主模型`：清除 `model:`，agent 继承主模型。
- 各级候选为 0 时仍弹窗，问题说明给出对应警告。

#### Step 4：写入 model 字段

对应用户选择的 agent 文件（`.opencode/agents/*.md`），在 frontmatter 末尾、closing `---` 之前，以**零缩进的顶层字段**插入 `model:`：

```yaml
---
description: ...
tools: [Read, Glob, Grep]
model: provider/model-id
---
```

- 已有 `model:` 则替换值，不新增重复键
- `保留现有模型`：写回 Step 0 缓存
- `跳过`：不写 `model:`
- 检测失败/超时、没走到本步骤的等级：用 Step 0 缓存回填

### 2.4 创建部署标记

- 创建 `.story-deployed` 文件（sentinel file），写入：
  ```
  deployed_at: <date -u +"%Y-%m-%dT%H:%M:%SZ">
  agents_version: 7
  setup_skill_version: 1.7.9
  target_cli: claude-code（或 opencode、codex、openclaw、generic，或组合）
  resolver_strategy: skill-glob
  references_dir: references（技能扁平目录，agent 运行时 Glob 定位）
  ```
- 此文件供写作 skill 检测部署状态，避免重复提示。
- 同时创建一次性标记 `.claude/.agents-pending-restart`（空文件）。新会话启动后据此确认 agents 已注册并自动删除。

---

## Phase 3：验证安装

1. 验证 agents（Claude Code）：
   - 检查 `.claude/agents/` 下 `story-architect.md` / `story-explorer.md` / `story-researcher.md` / `chapter-extractor.md` / `character-designer.md` / `consistency-checker.md` / `narrative-writer.md` 是否存在
2. 验证 agents（OpenCode）：
   - 检查 `.opencode/agents/` 下 7 个同名 `.md` 是否存在，frontmatter 含 `tools:`、`model:`（如有）
3. 验证参考文件解析：
   - 任选一个 subagent 需要的参考文件（如 `references/hooks-chapter.md`、`references/outline-methods.md`），确认技能 `references/` 下存在（扁平结构）
   - 说明：agent 运行时按 2.2 的 Glob 顺序自行定位，部署时无需复制
4. 验证部署标记：
   - 检查 `.story-deployed` 是否存在且含 `agents_version: 7`、`setup_skill_version`、`target_cli`、`resolver_strategy`、`references_dir`
5. 输出安装报告：
   - 列出所有已部署的文件
   - 列出需要注意的事项（如已有配置已合并）
   - **⚠️ 重启提示（必须醒目输出）**：本次部署写入了 `.claude/agents/`，但 custom agent 只在「会话启动」时注册。请新开一个会话再开始写作，否则当前会话里想 spawn `story-architect` 等时会拿到「subagent_type 不可用」并降级 solo。判断是否生效：新会话里跑 `/story-review`，报告头若是 `Effective Mode: full/lean` 即注册成功。
   - 重启后即可使用 `/story-long-write` 或 `/story-short-write`
   - 如执行了 2.3 模型配置，输出 Agent 模型配置摘要：
     ```
     Agent 模型配置：
       story-architect     → <高端模型>
       story-researcher    → <中端模型>
       character-designer  → <中端模型>
       narrative-writer    → <中端模型>
       story-explorer      → <低端模型>
       chapter-extractor   → <低端模型>
       consistency-checker → <低端模型>
     ```
   - 如自动检测失败，输出手动配置指南（编辑 `.opencode/agents/{agent名}.md` 加 `model: provider/model-id`）

---

## 重新部署

- `.story-deployed` 不存在 → 全新安装，Phase 2 全部执行
- `.story-deployed` 存在且 `agents_version: 7` → 提示已部署，AskUserQuestion 确认是否重新部署
- `.story-deployed` 存在但 `agents_version` < 7 → 提示需要更新，重新执行 Phase 2 覆盖 agents

---

## 流程衔接

**流水线：** 部署
**位置：** 初始化（最前置）

| 时机 | 跳转到 | 命令 |
|---|---|---|
| 部署完成，开始写作 | story-long-write / story-short-write | `/story-long-write` 或 `/story-short-write` |
| 导入已有小说做拆解 | story-import | `/story-import` |
| 需要浏览器登录态（扫榜/拆文取原文） | browser-cdp | `/browser-cdp` |

各端调用语法：Claude `/名`、Codex `$名`、OpenClaw `/skill 名`、generic 直接点名 skill。
