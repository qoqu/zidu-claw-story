---
name: pipeline
description: "网文写作流水线工具集（追踪 + 闸门），WB 原生。把「代码驱动流水线」核心——TrackingUpdater（8 类追踪文件更新）与 step-guard 闸门组——实现为不依赖宿主的纯 Node 工具。与写作流程、量化质检配合：写完一章 → qa 硬门禁 → track 更新追踪 → gate 步骤闸门保证有序。触发：「初始化小说项目」「更新这一章的追踪」「跑流水线闸门」「检查步骤到哪了」「长篇写作 SOP」。"
---

# 写作流水线工具集（追踪 + 闸门）

网文写作「代码驱动流水线」核心——TrackingUpdater（8 类追踪文件更新）与 step-guard 闸门组——的纯 Node、零宿主绑定实现。与写作流程、量化质检配合：写完一章 → qa 硬门禁 → track 更新追踪 → gate 步骤闸门保证有序。

> WorkBuddy 是 prompt 驱动 agent，无自动 hook。这些脚本在流程的**明确时机手动调用**，提供客观、可证伪的判定，弥补「AI 凭记忆容易跳步/漏检」。

---

## 与写作流程 / 质检的配合

| 阶段 | 职责 | 本工具集的位置 |
|------|------|----------------|
| 写作流程 | 细纲→正文→审阅 | 上游，产出 `正文/第N章.md` |
| 量化质检 | 硬门禁（exit 2/3） | 中游，`qa` 子命令直接复用 `scripts/quality-gate.js` |
| **本流水线** | 追踪更新 + 步骤闸门 | 下游，交稿前保证有序与可追溯 |

---

## 完整 SOP（写一章的标准动作）

```bash
# 0) 项目初始化（首次）
node scripts/tracking-updater.js "C:/path/项目" init

# 1) 用写作流程写第 N 章正文 → 产出 正文/第NNN章.md

# 2) 硬门禁：复用 scripts/quality-gate.js
node scripts/pipeline-gate.js qa "C:/path/项目/正文/第012章.md" "C:/path/项目" --genre dushi --threshold 90
#    exit 0 = 通过，**脚本自动标记 qa 完成**（写 .pipeline/state.json）
#    exit 2 = 阻断须修复 → 不要继续，修复后重跑 qa（不会标记完成）
#    exit 3 = 评分不足建议提质 → 提质后重评（不会标记完成）

# 3) 更新追踪（伏笔/时间线/角色/物品/环境/物资/重复 + 自动写上下文）
node scripts/tracking-updater.js "C:/path/项目" after-chapter --chapter 12 --summary "第12章完成：主角拜师"
node scripts/tracking-updater.js "C:/path/项目" add-foreshadow --chapter 12 --text "师父的真实身份" --cover "断剑的封印松动"
node scripts/tracking-updater.js "C:/path/项目" add-timeline --chapter 12 --time "夏末" --desc "主角拜师" --chars "主角、师父"
node scripts/tracking-updater.js "C:/path/项目" set-character --name "主角" --key "当前能力" --value "初窥门径"
node scripts/tracking-updater.js "C:/path/项目" add-item --name "断剑" --loc "主角背包" --status "封印松动" --chapter 12
node scripts/tracking-updater.js "C:/path/项目" set-env --key "季节" --value "夏末"
node scripts/tracking-updater.js "C:/path/项目" add-repeat --content "他的心跳如鼓" --location "第5、8、12章" --count 3 --alt "胸腔里闷闷地撞"
node scripts/tracking-updater.js "C:/path/项目" set-material --name "盘缠" --status "余五十两" --chapter 12

# 5) 闸门：标记 track 完成（要求 追踪/上下文.md 存在）
node scripts/pipeline-gate.js gate post track "C:/path/项目" --chapter 12

# 6) 随时查看进度
node scripts/pipeline-gate.js status "C:/path/项目"
```

> **Windows 路径注意**：用 WorkBuddy 的 Bash 调 Windows `node.exe` 时，路径必须用 `C:/...` 或 `C:\...`（不要用 `/c/...`，node.exe 不认 Git Bash 前缀）。

---

## tracking-updater.js 子命令

| 命令 | 作用 |
|------|------|
| `init` | 创建 `设定/角色`、`设定/世界观`、`大纲`、`正文`、`追踪/` 及 8 个追踪模板文件 |
| `after-chapter --chapter N --summary "..."` | 自动写 `上下文.md` + 统计字数 + 提示后续语义追踪子命令（**每章必跑**） |
| `add-foreshadow --chapter N --text "..." [--cover "..."]` | 埋设/回收伏笔 |
| `add-timeline --chapter N --time "..." --desc "..." --chars "..."` | 记录时间线事件 |
| `set-character --name "..." --key "身份" --value "..."` | 更新角色状态字段（自动定位角色段） |
| `add-item --name "..." --loc "..." --status "..." --chapter N` | 更新物品位置/状态 |
| `set-env --key "季节" --value "..."` | 覆盖写当前环境 |
| `add-repeat --content "..." --location "..." [--count N] [--alt "..."]` | 追加重复语句黑名单 |
| `set-material --name "..." --status "..." [--chapter N]` | 更新物资（钱财/食物/工具） |

退出码：0=成功，1=参数错误，2=文件操作失败。

---

## pipeline-gate.js 子命令

| 命令 | 作用 | 退出码 |
|------|------|--------|
| `status <project-dir>` | 显示各步骤 done/pending 与上下文进度 | 0 |
| `gate pre <step> <project-dir> [--chapter N]` | 校验前置步骤是否完成 | 0=过 / 1=阻断 |
| `gate post <step> <project-dir> [--chapter N]` | 校验后置产物到位并标记完成 | 0=过 / 1=阻断 |
| `qa <chapter-file> <project-dir> [--quality-gate PATH] [--genre ...] [...]` | 复用 quality-gate.js 硬门禁 | 透传 0/2/3 |

内置默认流水线步骤（对应长篇写作默认流程）：
`read → write → qa → track`，每步 `requires` 前置步骤 done，后置校验对应产物文件。

**自定义流水线**：在项目目录放 `.pipeline/steps.json`（覆盖 `DEFAULT_STEPS`），即可定义自己的步骤与产物契约。

---

## 追踪文件规范

详见 `references/tracking-spec.md`：目录结构、8 个文件格式、每章更新规则、「最简记忆包」筛选法、角色性格锚点一致性底线、归档策略。

---

## 适配说明（与原宿主差异）

- 去除早期宿主专有绑定：无 `.workflow/`、无 `$HOME/.config` 路径、无 `inputs:` 契约；纯 Node 零依赖。
- 早期实现的 `orchestrator.writeChapter` 只调了 `updateContext`、漏接其余 6 个追踪方法——本版全部暴露为显式子命令并强制每章调用。
- 15 个 `step-guard.js` 收敛为 1 个可配置 `pipeline-gate.js`，状态存 `.pipeline/state.json`。
- 质检直接复用 `scripts/quality-gate.js`（不再内联轻量版，避免双重标准）。
- **损失**：早期宿主的「自动前后置 hook」在 WB 降级为手动调用（约 2% 功能损失）；其余能力无损。
