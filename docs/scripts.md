# 脚本命令参考（scripts/）

本目录含 **32 个纯 Node 脚本**，无第三方依赖，统一用 `node scripts/<name>.js` 调用。脚本间通过 `__dirname` 互相定位，无需额外配置。

命令中的 `<项目目录>` 指你的小说工程根（含 `正文/` `设定/` `追踪/` 等）。

---

## A. 量化质检族

`quality-gate.js` 是统一门禁，调用下列子检查。

| 脚本 | 作用 |
|---|---|
| `quality-gate.js` | 统一质量门禁入口（10 项检查全绿才放行） |
| `style-lint.js` | 文风检查（措辞/病句） |
| `consitency-check.js` | 一致性检查（人名/设定前后矛盾） |
| `foreshadow-check.js` | 伏笔检查（overdue 未回收伏笔） |
| `wordcount.js` | 字数检查（达标/节奏） |
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
node scripts/wordcount.js <章节.md> <项目目录>
node scripts/writing-scorer.js <章节.md> <项目目录> --threshold 90
```

---

## B. 去 AI 味族

| 脚本 | 作用 |
|---|---|
| `check-ai-patterns.js` | AI 句式模式检测（"首先/其次/综上所述"等） |
| `check-degeneration.js` | 退化检测（空洞/套话） |
| `normalize-punctuation.js` | 标点预检（写章前） |
| `punctuation-normalize.js` | 标点规范化（格式化） |
| `banned-words.js` | 禁用词检测 |

```bash
node scripts/check-ai-patterns.js <章节.md>
node scripts/check-degeneration.js <章节.md>
node scripts/normalize-punctuation.js <章节.md>
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

```bash
node scripts/qidian-rank-scraper.js <项目目录> [--limit 50]
# 其余爬虫参数类似，详见各脚本 --help
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
| `wordcount-pacer.js` | 字数节奏 / 日更配速 |
| `full-consistency-audit.js` | 全量一致性审计（整本书级） |

```bash
node scripts/repair-scripts.js
node scripts/wordcount-pacer.js <项目目录> --target 4000
node scripts/full-consistency-audit.js <项目目录>
```
