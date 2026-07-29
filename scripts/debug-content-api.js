// Find chapter content API - fixed version
const { ab, sleep } = require("./cdp-utils");
const { evalJSONB64 } = require("./rank-common");

// Get directory info including chapterListWithVolume
const dirJS = `JSON.stringify((function(){
  var x = new XMLHttpRequest();
  x.open('GET', '/api/reader/directory/detail?bookId=7649259001011522622', false);
  x.send();
  var data = JSON.parse(x.responseText);
  var d = data.data || {};
  var ids = d.allItemIds || [];
  var vols = d.chapterListWithVolume || [];
  // Get chapter titles from volume list
  var chapters = [];
  for (var i = 0; i < vols.length; i++) {
    var cl = vols[i].chapterList || vols[i].chapter_list || [];
    for (var j = 0; j < cl.length; j++) {
      chapters.push({
        itemId: String(cl[j].itemId || cl[j].item_id || ''),
        title: cl[j].title || cl[j].chapterName || cl[j].chapter_name || ''
      });
    }
  }
  return {
    totalIds: ids.length,
    firstIds: ids.slice(0, 5),
    volCount: vols.length,
    chapterCount: chapters.length,
    firstChapters: chapters.slice(0, 5),
    volKeys: vols.length ? Object.keys(vols[0]) : []
  };
})())`;

const dirResult = evalJSONB64(9222, dirJS);
console.log("Directory:", JSON.stringify(dirResult, null, 2));

const firstId = dirResult.firstIds[0];
console.log("\nTesting content APIs with itemId:", firstId);

// Test content API endpoints
const contentJS = `JSON.stringify((function(){
  var itemId = '${firstId}';
  var results = {};
  
  var tests = [
    {name: 'reader_full_item', url: '/api/reader/full?itemId=' + itemId},
    {name: 'reader_item_content', url: '/api/reader/item?itemId=' + itemId},
    {name: 'reader_content', url: '/api/reader/content?itemId=' + itemId},
    {name: 'reading_full_v1', url: '/reading/reader/full/v1/?item_id=' + itemId},
    {name: 'reading_content_query', url: '/reading/bookapi/content/query/v/?item_id=' + itemId},
    {name: 'reading_page_full', url: '/reading/page/full/v1/?item_id=' + itemId},
    {name: 'reader_page_direct', url: '/reader/' + itemId}
  ];
  
  for (var i = 0; i < tests.length; i++) {
    try {
      var x = new XMLHttpRequest();
      x.open('GET', tests[i].url, false);
      x.send();
      var h = x.responseText || '';
      results[tests[i].name] = {
        status: x.status,
        len: h.length,
        contentType: x.getResponseHeader('content-type'),
        sample: h.substring(0, 500)
      };
    } catch(e) {
      results[tests[i].name] = {error: String(e)};
    }
  }
  
  return results;
})())`;

const contentResult = evalJSONB64(9222, contentJS);
console.log("\nContent API results:", JSON.stringify(contentResult, null, 2));
