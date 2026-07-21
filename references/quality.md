---
name: quality
description: "网文写作质量门禁（量化硬检查）。对已写好的章节正文运行确定性质检脚本，输出可证伪的质量判定与 exit 码门禁：一级禁用词/AI腔句式、跨章重复、伏笔逾期、字数不足、角色声音漂移、情绪曲线平坦、爽点密度、设定缺口，并可生成百分制评分提示。触发方式：「质检这一章」「跑质量门禁」「检查禁用词/AI味」「这章达标了吗」「章节评分」，或在写完/改完一章正文后主动调用。"
---

# 量化质量门禁

对已写好的章节正文运行确定性质检脚本族（纯 Node，零 npm 依赖），把“质量”从模型自觉变成**代码层可证伪的 exit 码门禁**。

## 何时使用
- 写完 / 改完一章正文后，动笔下一章**之前**。
- 用户要求“质检 / 检查禁用词 / 去 AI 味核验 / 章节评分 / 这章达标了吗”。

## 核心用法

```bash
# 完整门禁（阻断检查 + 评分提示）
node scripts/quality-gate.js <章节文件.md> <项目目录> --json

# 只跑阻断检查（快，跳过评分与非阻断项）
node scripts/quality-gate.js <章节文件.md> <项目目录> --json --no-score --fast

# 指定题材评分模板（默认阈值 90）
node scripts/quality-gate.js <章节.md> <项目目录> --genre dushi --threshold 90
```

**Windows 注意**：用 WorkBuddy 的 Bash 调 Windows node.exe 时，路径必须用 `C:/...` 或 `C:\...`（不要用 `/c/...`，node.exe 不认 Git Bash 前缀）。

## Exit 码（门禁语义）
| 码 | 含义 | 处理 |
|----|------|------|
| 0 | 全部通过（含评分 ≥ 阈值） | 可继续下一章 |
| 2 | 阻断（任一硬检查未过） | **必须先修复**再继续 |
| 3 | 规则通过但评分 < 阈值 | 回炉提质后重评 |

## 项目目录约定（脚本按此定位文件）
- 正文：`第N章.md`
- 细纲（取字数目标）：`大纲/细纲_第NNN章.md`（三位补零，如 `细纲_第001章.md`）
- 追踪目录：`追踪/`（伏笔/角色状态/时间线等）；**不存在时相关检查自动 skip，不报错**

## 检查项（scripts/quality-gate.js 调度链）
style-lint（一级禁用词→阻断）· check-ai-patterns（AI 味句式→阻断，去味第一道）· consistency-check（物品/环境/角色/时间线）· foreshadow-check（伏笔逾期>50章）· wordcount（<目标90%阻断）· cross-chapter-check（跨章重复）· voice-check（角色声音）· emotion-analyzer（情绪曲线）· satisfaction-meter（爽点密度）· detect-story-gaps（--full）· pacing（追读密度回落→advisory ⚠️ 不阻断）· writing-scorer（百分制评分提示）

> 注：`quality-gate.js` 已内部调度 `check-ai-patterns`，所以写章流程里**不要在其外再单独跑 `check-ai-patterns.js`**，避免双重执行（见 SKILL.md「写章标准流程」步骤 3/4）。pacing 维度依赖 `追踪/追读力.md`，需每章 `tracking-updater reading-power` 供数，否则不触发。

## 规则库（references/）
- `quality-rules.md` — 质检规则总纲
- `quality-checklist.md` — 人工核对清单
- `quality-monitoring.md` — 长线质量监控
- `banned-words.md` — 禁用词分级表（与 `scripts/banned-words.js` 同源）
- `anti-ai-writing.md` — 去 AI 味系统方法
