#!/usr/bin/env node
/**
 * rank-common.js — 排行榜爬虫共享底座（零依赖，复用 cdp-utils 原语）
 *
 * 收敛 7 个平台 rank-scraper 中 copy-paste 的通用 CDP 脚手架，消除重复实现。
 * 各平台页面结构（选择器 / 字段 / 反爬）差异巨大，提取逻辑保留在各爬虫内，
 * 本模块只收敛「平台无关」的 CDP plumbing，符合 rank-dispatcher.js
 * 「不重写 7 个爬虫主体，保留各平台 CDP 适配差异」的设计原则。
 *
 * 导出：
 *   - evalJSON(port, js)       浏览器内执行 JS（base64 传参，规避复杂 JS 的 shell 转义）
 *   - probePage(port)         连通性 + 页面就绪自检（host + body 文本长度）
 *   - clickTab(port, text, opts)        按文本点击 tab（opts.trailing 支持 "榜" 后缀匹配）
 *   - clickTabRetry(port, text, opts)   clickTab 失败重试一次
 *   - extractBookUrls(port, opts)       聚合 /book|shuku/{id} 链接，挑最长书名文本
 *   - pushBookBlock(lines, b, opts)     统一输出单本书 Markdown 段
 *   - dateStamp(d)             文件名用 YYYYMMDD
 */

const { ab, sleep } = require("./cdp-utils");

/**
 * 在浏览器内执行 JS 并解析 JSON 返回值。
 * 注意：走 base64（-b）传参，与 cdp-utils.evalJSON 的裸 eval 不同——
 * 榜单页内联 JS 含正则/引号/反斜杠，base64 可规避 shell 转义问题。
 */
function evalJSON(port, js) {
  const b64 = Buffer.from(String(js), "utf-8").toString("base64");
  const raw = ab(port, "eval", "-b", b64);
  if (!raw || raw === "ERR") return null;
  try {
    let parsed = JSON.parse(raw);
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch {}
    }
    return parsed;
  } catch {
    return null;
  }
}

/** 连通性 + 页面就绪自检（host + body 文本长度，区分 CDP 未连 vs 被重定向） */
function probePage(port) {
  return evalJSON(
    port,
    "JSON.stringify({host:location.host,len:(document.body&&document.body.innerText||'').length})"
  );
}

/** 点击包含指定文本的 tab 元素；opts.trailing 可追加后缀再匹配（如 "榜"） */
function clickTab(port, text, opts = {}) {
  const variants = opts.trailing ? [text, text + opts.trailing] : [text];
  const js = `JSON.stringify((()=>{
    var all=document.querySelectorAll('div,span,a,button,li');
    var variants=${JSON.stringify(variants)};
    var el=Array.from(all).find(function(e){var t=(e.textContent||'').trim();return variants.indexOf(t)>=0;});
    if(el){el.click();return true}return false
  })())`;
  return evalJSON(port, js);
}

/** 点 tab，失败后等一拍重试一次（tab 异步渲染可能滞后） */
function clickTabRetry(port, text, opts) {
  if (clickTab(port, text, opts)) return true;
  sleep(1500);
  return !!clickTab(port, text, opts);
}

/**
 * 从 DOM 聚合书籍链接：按 bookId 聚合多个 anchor，挑最长、最像书名的文本。
 * @param {number} port
 * @param {object} [opts]
 *   hrefRe    匹配书籍链接 href 的正则（默认 /\/(?:book|shuku)\/([0-9]+)/）
 *   urlPrefix 拼出作品页 URL 的前缀（默认占位，调用方必须传）
 *   skipRe    跳过纯数字 / UI 文字等锚点文本（如 /^[0-9]+$|^(最近更新|最新章节|最新)/）
 *   cleanRe   对锚点文本做清洗的正则（如去 "N[题材]" 前缀、尾部数字，global）
 */
function extractBookUrls(port, opts = {}) {
  const hrefPattern = (opts.hrefRe || /\/(?:book|shuku)\/([0-9]+)/).source;
  const urlPrefix = opts.urlPrefix || "https://www.example.com/book/";
  const skipPattern = opts.skipRe ? opts.skipRe.source : null;
  const cleanPattern = opts.cleanRe ? opts.cleanRe.source : null;
  const js = `JSON.stringify((function(){
    var re=new RegExp(${JSON.stringify(hrefPattern)});
    var skipRe=${skipPattern ? "new RegExp(" + JSON.stringify(skipPattern) + ")" : "null"};
    var cleanRe=${cleanPattern ? "new RegExp(" + JSON.stringify(cleanPattern) + ")" : "null"};
    var byId={};var order=[];
    Array.from(document.querySelectorAll('a')).forEach(function(a){
      var h=a.getAttribute('href')||a.href||'';
      var m=h.match(re); if(!m)return; var id=m[1];
      var t=(a.innerText||a.textContent||'').replace(/\\s+/g,' ').trim();
      if(cleanRe)t=t.replace(cleanRe,'');
      if(!byId[id]){byId[id]='';order.push(id);}
      if(t&&!(skipRe&&skipRe.test(t))){ if(t.length>byId[id].length)byId[id]=t; }
    });
    return order.map(function(id){return {bookId:id,title:byId[id],url:${JSON.stringify(urlPrefix)}+id};});
  })())`;
  return evalJSON(port, js) || [];
}

/**
 * 统一输出单本书 Markdown 段。
 * @param {string[]} lines  输出行数组（原地 push）
 * @param {object} b  { rank, title, meta:[..], extraLines:[..], update, tags:[..], url, desc }
 * @param {object} [opts]
 *   headingLevel 书标题级数（默认 3 → "### #N"）
 *   updateLabel  更新行标签（默认 "最新更新"；dz 用 "最新"）
 *   descQuote    简介用 ">" 引用块（heiyan/dz）；否则用 "**简介**" 段
 *   descMax      简介截断长度（默认 200）
 */
function pushBookBlock(lines, b, opts = {}) {
  const level = opts.headingLevel || 3;
  const hashes = "#".repeat(level);
  const updateLabel = opts.updateLabel || "最新更新";
  const descMax = opts.descMax || 200;
  const meta = (b.meta || []).filter(Boolean);

  lines.push(`${hashes} #${b.rank} ${b.title || "（待解析）"}`);
  if (meta.length) lines.push(`*${meta.join(" · ")}*`);
  if (b.extraLines && b.extraLines.length) b.extraLines.forEach((l) => lines.push(l));
  if (b.update) lines.push(`**${updateLabel}：** ${b.update}`);
  if (b.tags && b.tags.length) lines.push(`**标签：** ${b.tags.join("、")}`);
  if (b.url) lines.push(`[作品页](${b.url})`);
  if (b.desc) {
    if (opts.descQuote) {
      lines.push(`> ${b.desc.substring(0, descMax)}${b.desc.length > descMax ? "..." : ""}`);
    } else {
      lines.push("");
      lines.push("**简介**");
      lines.push("");
      lines.push(b.desc);
    }
  }
  lines.push("", "---", "");
}

/** 文件名用 YYYYMMDD（含当天榜单日期） */
function dateStamp(d) {
  return (d || new Date()).toISOString().slice(0, 10).replace(/-/g, "");
}

module.exports = {
  evalJSON,
  probePage,
  clickTab,
  clickTabRetry,
  extractBookUrls,
  pushBookBlock,
  dateStamp,
};
