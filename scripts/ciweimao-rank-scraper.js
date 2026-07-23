#!/usr/bin/env node
/**
 * 刺猬猫阅读排行榜采集脚本
 *
 * 配合 browser-cdp skill 使用。先启动 Chrome CDP 环境，再运行本脚本。
 * 采集策略：刺猬猫 rank-index 页面单页展示所有榜单，文本解析提取结构化数据。
 * 输出 Markdown 格式匹配 scan-output-format.md 规范。
 *
 * 用法：
 *   node ciweimao-rank-scraper.js --type click       # 点击榜
 *   node ciweimao-rank-scraper.js --type monthly      # 月票榜
 *   node ciweimao-rank-scraper.js --type all           # 全部榜单
 *
 * 前置：
 *   node {SKILL_DIR}/browser-cdp/scripts/setup-cdp-chrome.js 9222
 */

const fs = require("fs");
const path = require("path");
const { ab, sleep, scrollLoad, getArg } = require("./cdp-utils");
// 通用 CDP 脚手架来自共享底座
const { evalJSON, probePage, extractBookUrls, pushBookBlock } = require("./rank-common");

const RANK_URL = "https://www.ciweimao.com/rank-index";

const RANK_TYPES = [
  { id: "click", label: "点击榜", header: "点击榜" },
  { id: "favor", label: "收藏榜", header: "收藏榜" },
  { id: "recommend", label: "推荐榜", header: "推荐榜" },
  { id: "subscribe", label: "订阅榜", header: "订阅榜" },
  { id: "monthly", label: "月票榜", header: "月票榜" },
  { id: "tsukkomi", label: "吐槽榜", header: "吐槽榜" },
  { id: "newbook", label: "新书榜", header: "新书榜" },
  { id: "blade", label: "刀片榜", header: "刀片榜" },
  { id: "update", label: "更新榜", header: "更新榜" },
];

// ---------------------------------------------------------------------------
// 页面提取
// ---------------------------------------------------------------------------

/**
 * 从 rank-index 单页解析所有榜单。
 * 页面结构：每个榜单有标题行（如"点击榜"），后跟 NO.1 特殊条目 + #2-10 普通条目。
 * NO.1 格式：标题 / 作者 / 指标值（三行）
 * #2-10 格式：N[题材]书名 / 指标值（两行）
 */
function extractAllRanks(port) {
  const js =
    "JSON.stringify((()=>{" +
    "var text=document.body.innerText||'';" +
    "var lines=text.split(/\\n/).map(function(l){return l.trim()}).filter(Boolean);" +
    "var headers=['点击榜','收藏榜','推荐榜','订阅榜','月票榜','吐槽榜','新书榜','刀片榜','更新榜'];" +
    "var sections=[];var curName='';var curEntries=[];" +
    "for(var i=0;i<lines.length;i++){" +
    "  var line=lines[i];" +
    // 检测新 section
    "  var headerIdx=headers.indexOf(line);" +
    "  if(headerIdx>=0){" +
    "    if(curName&&curEntries.length)sections.push({name:curName,entries:curEntries});" +
    "    curName=headers[headerIdx];curEntries=[];continue" +
    "  }" +
    "  if(!curName)continue;" +
    // 跳过周期 tab 和 UI 文字
    "  if(/^(周榜|月榜|总榜)$/.test(line))continue;" +
    // NO.1 条目
    "  if(line==='NO.1'&&i+3<lines.length){" +
    "    var t=lines[i+1]||'';var a=lines[i+2]||'';var v=lines[i+3]||'';" +
    "    if(headers.indexOf(v)>=0)continue;" +
    "    curEntries.push({rank:1,title:t,author:a,genre:'',metric:v});" +
    "    i+=2;continue" +
    "  }" +
    // #2-10 条目：N[题材]书名
    "  var rm=line.match(/^(\\d{1,2})\\[(.+?)\\](.+)$/);" +
    "  if(rm){" +
    "    var nextVal=i+1<lines.length?lines[i+1]:'';" +
    "    var metric='';" +
    "    if(/^[\\d.]+(万)?$/.test(nextVal)){metric=nextVal;i++}" +
    "    curEntries.push({rank:parseInt(rm[1]),title:rm[3],author:'',genre:rm[2],metric:metric});" +
    "    continue" +
    "  }" +
    "}" +
    "if(curName&&curEntries.length)sections.push({name:curName,entries:curEntries});" +
    "return sections" +
    "})())";
  return evalJSON(port, js) || [];
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const PORT = parseInt(getArg(args, "--port") || "9222", 10);
const OUTDIR = getArg(args, "--outdir") || ".";
const RANKTYPE = getArg(args, "--type") || "all";

function main() {
  console.log("\n→ 采集 刺猬猫排行榜...");
  console.log(`  URL: ${RANK_URL}`);

  let sections, urls;
  try {
    ab(PORT, "open", RANK_URL);
    sleep(4000);

    // 连通性自检：CDP 未起/被重定向时给可操作报错，而非误报"结构已变"
    const probe = probePage(PORT);
    if (!probe) {
      console.error(
        `  ✗ CDP 无响应。请确认已用 browser-cdp 启动 Chrome（端口 ${PORT}），且 agent-browser 可用。`
      );
      return;
    }
    if (probe.host && probe.host.indexOf("ciweimao") === -1) {
      console.error(`  ✗ 当前页面非刺猬猫（host=${probe.host}），可能被重定向，已跳过。`);
      return;
    }

    scrollLoad(PORT, 3);
    sleep(1000);

    sections = extractAllRanks(PORT);
    if (!sections.length) {
      // 懒加载可能未触发，再滚动重试一次
      scrollLoad(PORT, 2);
      sleep(1000);
      sections = extractAllRanks(PORT);
    }
    if (!sections.length) {
      console.error("[ciweimao] 采集失败：未解析到榜单（页面结构可能变动或未加载）。请人工打开榜单页确认。");
      return;
    }

    urls = extractBookUrls(PORT, {
      hrefRe: /\/book\/([0-9]+)/,
      urlPrefix: "https://www.ciweimao.com/book/",
      cleanRe: /^[0-9]+\[[^\]]*\]|\s+[0-9.]+(?:万|亿)?$/g,
    });
  } catch (err) {
    console.error(`[ciweimao] 采集失败（页面加载或提取阶段）: ${err.message}`);
    return;
  }

  console.log(`  ✓ 提取 ${sections.length} 个榜单，${urls.length} 个书籍链接`);

  // 筛选需要的榜单类型
  const targetTypes =
    RANKTYPE === "all"
      ? RANK_TYPES
      : RANK_TYPES.filter((r) => r.id === RANKTYPE);

  for (const rt of targetTypes) {
    try {
      const section = sections.find((s) => s.name === rt.header);
      if (!section || !section.entries.length) {
        console.log(`  ⚠ ${rt.label} 无数据，跳过`);
        continue;
      }

      const now = new Date().toISOString();
      const norm = (s) => (s || "").replace(/\s+/g, "");
      const linked = section.entries.filter((e) =>
        urls.some((u) => norm(u.title) === norm(e.title))
      ).length;
      const lines = [
        `# 刺猬猫 · ${rt.label}`,
        "",
        `- 来源：${RANK_URL}`,
        `- 抓取时间：${now}`,
        `- 条目数：${section.entries.length}`,
        `- 作品页链接：${linked} / ${section.entries.length}`,
        "",
        "---",
        "",
      ];

      for (const entry of section.entries) {
        try {
          // 按标题匹配书籍链接（归一后比对）
          const matched = urls.find((u) => norm(u.title) === norm(entry.title));
          pushBookBlock(lines, {
            rank: entry.rank,
            title: entry.title,
            meta: [entry.author, entry.genre, entry.metric || ""],
            url: matched ? matched.url : null,
          });
        } catch (entryErr) {
          console.error(`[ciweimao] ${rt.label} 条目处理出错（#${entry.rank} ${entry.title}）: ${entryErr.message}`);
          lines.push("", "---", "");
        }
      }

      const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const filename = `刺猬猫${rt.label}_${date}.md`;
      fs.mkdirSync(OUTDIR, { recursive: true });
      const filepath = path.join(OUTDIR, filename);
      fs.writeFileSync(filepath, lines.join("\n"), "utf-8");
      console.log(`  ✓ ${rt.label}：${section.entries.length} 条 → ${filepath}`);
    } catch (rankErr) {
      console.error(`[ciweimao] ${rt.label} 处理出错，跳过: ${rankErr.message}`);
    }
  }
}

try {
  main();
} catch (e) {
  console.error(`刺猬猫采集失败: ${e && e.message ? e.message : e}`);
  process.exit(1);
}
