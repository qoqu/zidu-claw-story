#!/usr/bin/env node
/**
 * 番茄小说章节正文采集脚本 v2
 *
 * 使用番茄官方 API 采集章节列表和正文：
 *   目录: /api/reader/directory/detail?bookId={bookId}
 *   正文: /api/reader/full?itemId={itemId}
 *
 * 用法：
 *   node fanqie-chapter-scraper.js --bookid 7649259001011522622 --chapters 10 --outdir ./ --title 书名
 *
 * 前置：
 *   node scripts/setup-cdp-chrome.js 9222
 */

const fs = require("fs");
const path = require("path");
const { ab, sleep, getArg } = require("./cdp-utils");
const { evalJSONB64 } = require("./rank-common");

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

const PORT = parseInt(getArg(process.argv.slice(2), "--port") || "9222", 10);
const BOOKID = getArg(process.argv.slice(2), "--bookid") || "";
const CHAPTERS = parseInt(getArg(process.argv.slice(2), "--chapters") || "10", 10);
const OUTDIR = getArg(process.argv.slice(2), "--outdir") || ".";
const BOOK_TITLE = getArg(process.argv.slice(2), "--title") || BOOKID;

if (!BOOKID) {
  console.error("用法: node fanqie-chapter-scraper.js --bookid <id> --chapters 10 --outdir ./ --title 书名");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 章节列表提取（使用 API）
// ---------------------------------------------------------------------------

function buildDirectoryJS(bookId) {
  return `JSON.stringify((function(){
    var x=new XMLHttpRequest();
    x.open('GET','/api/reader/directory/detail?bookId=${bookId}',false);
    x.send();
    var h=x.responseText||'';
    if(!h) return {error:'empty response',status:x.status};
    try{
      var data=JSON.parse(h);
      var d=data.data||{};
      var ids=d.allItemIds||[];
      var volData=d.chapterListWithVolume||{};
      var volNames=d.volumeNameList||[];

      // chapterListWithVolume 的 key 是数字字符串 "0".."N"
      // 每个 value 可能是 {itemId, title, ...} 或包含 chapterList 数组的 volume 对象
      var chapters=[];
      if(Array.isArray(ids)){
        for(var i=0;i<ids.length;i++){
          var title='';
          // 尝试从 volData 获取标题
          var vd=volData[String(i)]||volData[i];
          if(vd){
            if(vd.title){title=vd.title;}
            else if(vd.chapterName){title=vd.chapterName;}
            else if(vd.chapterList&&vd.chapterList[0]&&vd.chapterList[0].title){title=vd.chapterList[0].title;}
          }
          chapters.push({itemId:String(ids[i]),title:title,index:i});
        }
      }

      return {
        bookName:d.bookName||'',
        author:d.author||'',
        totalChapters:ids.length,
        chapters:chapters,
        volNames:volNames
      };
    }catch(e){
      return {error:String(e),sample:h.substring(0,300)};
    }
  })())`;
}

// ---------------------------------------------------------------------------
// 章节正文提取（使用 API）
// ---------------------------------------------------------------------------

function buildContentJS(itemId) {
  return `JSON.stringify((function(){
    var x=new XMLHttpRequest();
    x.open('GET','/api/reader/full?itemId=${itemId}',false);
    x.send();
    var h=x.responseText||'';
    if(!h) return {error:'empty response',status:x.status};
    try{
      var data=JSON.parse(h);
      if(data.code!==0) return {error:'api error: '+(data.message||''),code:data.code};
      var cd=data.data&&data.data.chapterData;
      if(!cd) return {error:'no chapterData'};

      var content=cd.content||'';
      var title=cd.title||cd.chapterName||'';
      var author=cd.author||'';
      var bookName=cd.bookName||'';
      var wordCount=cd.chapterWordNumber||0;

      // 清理 content: 去除 HTML 标签，保留段落换行
      if(content){
        // 番茄正文以 <p>...</p> 分段
        content=content.replace(/<\\/p>/g,'\\n');
        content=content.replace(/<[^>]+>/g,'');
        content=content.replace(/&nbsp;/g,' ');
        content=content.replace(/&lt;/g,'<');
        content=content.replace(/&gt;/g,'>');
        content=content.replace(/&amp;/g,'&');
        content=content.replace(/&quot;/g,'"');
        content=content.replace(/\\r\\n/g,'\\n');
        content=content.replace(/\\n{3,}/g,'\\n\\n');
        content=content.trim();
      }

      return {
        title:title,
        content:content,
        author:author,
        bookName:bookName,
        wordCount:wordCount,
        contentLen:content.length
      };
    }catch(e){
      return {error:String(e),sample:h.substring(0,300)};
    }
  })())`;
}

// ---------------------------------------------------------------------------
// 主流程
// ---------------------------------------------------------------------------

function main() {
  const outDir = path.resolve(OUTDIR);
  const bookDir = path.join(outDir, BOOK_TITLE);
  const rawDir = path.join(bookDir, "原文");

  // 创建输出目录
  fs.mkdirSync(rawDir, { recursive: true });

  console.log(`\n=== 番茄章节采集 v2 ===`);
  console.log(`书ID: ${BOOKID}`);
  console.log(`书名: ${BOOK_TITLE}`);
  console.log(`抓取章数: ${CHAPTERS}`);
  console.log(`输出目录: ${bookDir}`);
  console.log();

  // Step 1: 打开番茄页面建立会话
  console.log("→ 建立番茄会话...");
  ab(PORT, "open", "https://fanqienovel.com/rank/1_1_1141");
  sleep(3000);

  const probe = evalJSONB64(PORT, "JSON.stringify({host:location.host,bodyLen:document.body?document.body.innerText.length:0})");
  if (!probe || probe.host !== "fanqienovel.com") {
    console.error("✗ 无法连接番茄小说，请检查 CDP Chrome");
    process.exit(1);
  }
  console.log("  会话已建立 ✓");

  // Step 2: 获取章节列表
  console.log("\n→ 获取章节列表...");
  const dirResult = evalJSONB64(PORT, buildDirectoryJS(BOOKID));

  if (!dirResult || dirResult.error) {
    console.error("✗ 获取章节列表失败:", dirResult ? dirResult.error : "无响应");
    process.exit(1);
  }

  const bookName = dirResult.bookName || BOOK_TITLE;
  const author = dirResult.author || "未知";
  console.log(`  书名: ${bookName}`);
  console.log(`  作者: ${author}`);
  console.log(`  总章数: ${dirResult.totalChapters}`);

  if (!dirResult.chapters || !dirResult.chapters.length) {
    console.error("✗ 未找到章节");
    process.exit(1);
  }

  const chapterList = dirResult.chapters.slice(0, CHAPTERS);
  console.log(`  将抓取前 ${chapterList.length} 章`);

  // 保存章节列表
  fs.writeFileSync(
    path.join(bookDir, "章节列表.json"),
    JSON.stringify({ bookId: BOOKID, bookName, author, totalChapters: dirResult.totalChapters, chapters: chapterList }, null, 2),
    "utf-8"
  );

  // Step 3: 逐章抓取正文
  console.log("\n→ 开始抓取章节正文...");
  const allChapters = [];

  for (let i = 0; i < chapterList.length; i++) {
    const ch = chapterList[i];
    process.stdout.write(`  [${i + 1}/${chapterList.length}] ${ch.title || ch.itemId}... `);

    sleep(600); // 礼貌延迟

    const content = evalJSONB64(PORT, buildContentJS(ch.itemId));

    if (content && content.content && content.content.length > 50) {
      // 如果 API 返回了标题，用它（更准确）
      const chapterTitle = content.title || ch.title;
      const chapterText = `# 第${i + 1}章 ${chapterTitle}\n\n${content.content}\n`;
      const safeTitle = chapterTitle.replace(/[\\/:*?"<>|]/g, "_").substring(0, 50);
      const chapterPath = path.join(rawDir, `第${String(i + 1).padStart(3, "0")}章_${safeTitle}.txt`);
      fs.writeFileSync(chapterPath, chapterText, "utf-8");

      allChapters.push({
        index: i + 1,
        itemId: ch.itemId,
        title: chapterTitle,
        wordCount: content.content.length,
        apiWordCount: content.wordCount,
        file: chapterPath
      });

      console.log(`✓ ${content.content.length} 字`);
    } else {
      console.log(`✗ ${content ? content.error || "内容过短" : "无响应"}`);
      allChapters.push({
        index: i + 1,
        itemId: ch.itemId,
        title: ch.title,
        wordCount: 0,
        file: null,
        error: content ? content.error || "内容过短" : "无响应"
      });
    }
  }

  // Step 4: 合并全文
  console.log("\n→ 合并全文...");
  let fullText = "";
  for (const ch of allChapters) {
    if (ch.file && fs.existsSync(ch.file)) {
      fullText += fs.readFileSync(ch.file, "utf-8") + "\n\n---\n\n";
    }
  }
  const fullPath = path.join(rawDir, "原文.md");
  fs.writeFileSync(fullPath, fullText, "utf-8");

  // 写元数据
  const success = allChapters.filter(c => c.file).length;
  const fail = allChapters.filter(c => !c.file).length;
  const totalWords = allChapters.reduce((s, c) => s + (c.wordCount || 0), 0);

  fs.writeFileSync(
    path.join(bookDir, "采集元数据.json"),
    JSON.stringify({
      bookId: BOOKID,
      bookName,
      author,
      scrapeDate: new Date().toISOString(),
      targetChapters: CHAPTERS,
      successCount: success,
      failCount: fail,
      totalWords,
      chapters: allChapters
    }, null, 2),
    "utf-8"
  );

  console.log(`\n=== 采集完成 ===`);
  console.log(`成功: ${success} / ${chapterList.length} 章`);
  console.log(`失败: ${fail} 章`);
  console.log(`总字数: ${totalWords}`);
  console.log(`原文文件: ${fullPath}`);
  console.log(`输出目录: ${bookDir}`);

  if (fail > 0) {
    console.log(`\n⚠ 有 ${fail} 章抓取失败`);
  }
}

main();
