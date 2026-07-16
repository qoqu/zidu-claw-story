# 安装与部署

`zidu-claw-story` 是**纯文件技能**，不绑定任何宿主私有机制。把它所在的目录（`zidu-claw-story/`）放到对应宿主的技能目录下即可，无需改代码。

## 环境要求

- **Node.js ≥ 18**（所有 `scripts/*.js` 均为纯 Node，无 `npm install` 依赖）
- 支持 Windows / macOS / Linux

## 1. WorkBuddy（原生）

WorkBuddy 会自动加载 `.workbuddy/skills/` 下的技能。

```bash
# 方式 A：放到当前项目的技能目录
git clone https://github.com/qoqu/zidu-claw-story.git \
  <项目根>/.workbuddy/skills/zidu-claw-story

# 方式 B：放到用户级技能目录（所有项目可用）
git clone https://github.com/qoqu/zidu-claw-story.git \
  ~/.workbuddy/skills/zidu-claw-story
```

放入后，在对话中输入触发词（「写网文」「开书」「去味」「质检」「追踪」等）即可调用。

## 2. OpenClaw

OpenClaw 兼容 SKILL.md 格式技能。将技能目录复制到 OpenClaw 的技能目录：

```bash
git clone https://github.com/qoqu/zidu-claw-story.git \
  <openclaw-skills-dir>/zidu-claw-story
```

> 说明：本包已合并为**单技能**，只需标准 `name` + `description` frontmatter，**无需** `metadata.openclaw` 标签（该标签仅为 legacy 13-skill 拆分包给 skill-watcher 的自识别用，对单技能是多余物）。

## 3. Hermes

Hermes（Nous Research 自主 Agent）的 Skills 兼容 agentskills.io 开放标准，技能即 `~/.hermes/skills/` 下的 `SKILL.md`，纯 Markdown 可移植，且在真实终端/文件系统上可运行 Node。

```bash
git clone https://github.com/qoqu/zidu-claw-story.git \
  ~/.hermes/skills/zidu-claw-story
```

> 若 Hermes 的技能 linter 要求 `name`/`description` 之外的额外 frontmatter 字段，补一行即可，不影响功能。

## 4. 通用 / 其他宿主

任何「能读目录 + 能跑 `node`」的 Agent（Claude Code、Codex、通用 Web AI 等）均可：复制目录到其技能目录，或直接让 Agent 读取 `SKILL.md` 与 `references/` 工作。

## 验证安装

```bash
cd zidu-claw-story
node scripts/quality-gate.js --help        # 应输出 Usage
node scripts/tracking-updater.js ./ init    # 应生成 追踪/ 目录骨架
```

## 扫榜爬虫合规说明

`scripts/` 下的扫榜爬虫（起点/番茄/晋江/刺猬猫/七猫/豆瓣/黑岩）完整保留，属个人研究用途，合规由使用者自行承担。
