# zidu-claw-story

> AI 网文写作完整工具箱（单包 · WorkBuddy 原生 · 跨宿主可移植）

把**网文写作全流程**（长篇/短篇/拆文/扫榜/去味/封面/导入/初始化）与**量化质检**（quality-gate 硬门禁）+ **追踪流水线**（tracking-updater / pipeline-gate）整合为**一个技能包**，无外部依赖、无宿主私有契约。

当前版本：**1.1.0**（见 `VERSION`）。

## ✨ 特性

- **全流程覆盖**：开书 → 大纲 → 连载/日更 → 续写 → 完结，长短篇均支持
- **量化质检门禁**：9–10 项硬检查（禁用词/一致性/伏笔/字数/跨章重复/人设/情绪/爽点/缺口/评分），全绿才放行
- **去 AI 味**：句式规则 + 禁用词库 + 退化检测，多脚本预检
- **追踪流水线**：伏笔/时间线/角色状态/物品/环境/重复语句/素材/上下文 8 类自动追踪，闸门防"带病章节"继续
- **追读力量化**：每章记录钩子类型/强度、爽点模式、微兑现、硬约束违规、债务余额，维持读者追更动力
- **自动备份/断点续跑**：每章写完后快照轮转（保留最近 10 份），失败可从断点续跑
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
│   ├── scripts.md       # 32 个脚本命令参考
│   └── references.md    # 知识库（references/）索引
├── scripts/              # 32 个 Node 脚本（质检/去味/追踪/爬虫/CDP/菜单）
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
node scripts/normalize-punctuation.js 正文/第N章.md

# 3. 去味预检
node scripts/check-ai-patterns.js 正文/第N章.md

# 4. 量化质检硬门禁（exit 0 才过）
node scripts/quality-gate.js 正文/第N章.md ./ --genre dushi

# 5. 追踪更新（含追读力）
node scripts/tracking-updater.js ./ after-chapter --chapter N --summary "..."
node scripts/tracking-updater.js ./ reading-power --chapter N --hook-type 危机钩 --hook-strength strong --coolpoint "..." [--micropayoff "..."] [--debt 0]

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

完整脚本清单见 [docs/scripts.md](docs/scripts.md)。

## 📚 文档

| 文档 | 内容 |
|---|---|
| [docs/install.md](docs/install.md) | WB / OpenClaw / Hermes 安装与部署 |
| [docs/scripts.md](docs/scripts.md) | 32 个脚本分类与命令参考 |
| [docs/references.md](docs/references.md) | references/ 知识库主题索引 |

## ⚙️ 环境要求

- **Node.js** ≥ 18（脚本均为纯 Node，无第三方依赖，无需 `npm install`）
- 操作系统：Windows / macOS / Linux

## 🤝 致谢

致谢：oh-story及mimocode-story

## 📄 许可

[MIT](LICENSE) © 2026 qoqu
