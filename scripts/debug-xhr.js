// Debug XHR to Fanqie /page/ endpoint
const { ab, sleep } = require("./cdp-utils");
const { evalJSONB64 } = require("./rank-common");

// Already on rank page from previous attempt
// Let's debug the XHR more carefully

const debugJS = `JSON.stringify((function(){
  var results = {};
  
  // Test 1: XHR to /page/{bookId}
  try {
    var x = new XMLHttpRequest();
    x.open('GET', '/page/7649259001011522622', false);
    x.onreadystatechange = function() {};
    x.send();
    results.xhr1 = {
      status: x.status,
      statusText: x.statusText,
      responseTextLen: (x.responseText || '').length,
      responseTextType: typeof x.responseText,
      responseURL: x.responseURL,
      responseType: x.responseType,
      headers: x.getAllResponseHeaders(),
      sample: (x.responseText || '').substring(0, 200)
    };
  } catch(e) {
    results.xhr1 = {error: String(e)};
  }
  
  // Test 2: XHR with explicit responseType
  try {
    var x2 = new XMLHttpRequest();
    x2.open('GET', '/page/7649259001011522622', false);
    x2.responseType = 'text';
    x2.send();
    results.xhr2 = {
      status: x2.status,
      responseTextLen: (x2.responseText || '').length,
      responseLen: (x2.response || '').length,
      sample: (x2.response || '').substring(0, 200)
    };
  } catch(e) {
    results.xhr2 = {error: String(e)};
  }
  
  // Test 3: XHR to homepage (should work)
  try {
    var x3 = new XMLHttpRequest();
    x3.open('GET', '/', false);
    x3.send();
    results.xhr3 = {
      status: x3.status,
      responseTextLen: (x3.responseText || '').length,
      sample: (x3.responseText.substring(0, 200))
    };
  } catch(e) {
    results.xhr3 = {error: String(e)};
  }
  
  // Test 4: Check current page URL
  results.currentURL = location.href;
  results.currentHost = location.host;
  
  return results;
})())`;

const result = evalJSONB64(9222, debugJS);
console.log(JSON.stringify(result, null, 2));
