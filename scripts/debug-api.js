// Debug: try different Fanqie API endpoints
const { ab, sleep } = require("./cdp-utils");
const { evalJSONB64 } = require("./rank-common");

// Make sure we're on fanqie
ab(9222, "open", "https://fanqienovel.com/rank/1_1_1141");
sleep(3000);

const debugJS = `JSON.stringify((function(){
  var results = {};
  
  // Test 1: /page/{bookId} with Accept header
  try {
    var x = new XMLHttpRequest();
    x.open('GET', '/page/7649259001011522622', false);
    x.setRequestHeader('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8');
    x.send();
    results.test1_page_html = {
      status: x.status,
      len: (x.responseText || '').length,
      contentType: x.getResponseHeader('content-type'),
      contentLength: x.getResponseHeader('content-length')
    };
  } catch(e) { results.test1_page_html = {error: String(e)}; }
  
  // Test 2: API endpoint for book directory
  var apiTests = [
    '/api/reader/directory/detail?bookId=7649259001011522622',
    '/api/reader/full?bookId=7649259001011522622',
    '/api/book/directory?bookId=7649259001011522622',
    '/reading/bookapi/directory/all_items/v/?book_id=7649259001011522622',
    '/reading/reader/full/v1/?book_id=7649259001011522622',
    '/api/reader/item?bookId=7649259001011522622',
    '/page/7649259001011522622?enter_from=rank'
  ];
  
  for (var i = 0; i < apiTests.length; i++) {
    try {
      var x2 = new XMLHttpRequest();
      x2.open('GET', apiTests[i], false);
      x2.send();
      results['test_' + i] = {
        url: apiTests[i],
        status: x2.status,
        len: (x2.responseText || '').length,
        contentType: x2.getResponseHeader('content-type'),
        sample: (x2.responseText || '').substring(0, 300)
      };
    } catch(e) {
      results['test_' + i] = {url: apiTests[i], error: String(e)};
    }
  }
  
  // Test 3: Navigate to book page and check __INITIAL_STATE__ after JS render
  // (This won't work via XHR, but let's check the current page's state)
  results.currentPageState = {
    hasState: !!window.__INITIAL_STATE__,
    stateKeys: window.__INITIAL_STATE__ ? Object.keys(window.__INITIAL_STATE__) : []
  };
  
  return results;
})())`;

const result = evalJSONB64(9222, debugJS);
console.log(JSON.stringify(result, null, 2));
