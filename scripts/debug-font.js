// Debug: examine raw API response and font info
const { ab, sleep } = require("./cdp-utils");
const { evalJSONB64 } = require("./rank-common");

// We're on fanqie already

// Get raw API response with all details
const rawJS = `JSON.stringify((function(){
  var x = new XMLHttpRequest();
  x.open('GET', '/api/reader/full?itemId=7649259029226603070', false);
  x.send();
  var h = x.responseText || '';
  
  // Get the raw response and examine it
  var data = JSON.parse(h);
  var cd = data.data && data.data.chapterData;
  
  // Get the raw content before any processing
  var rawContent = cd ? cd.content : '';
  
  // Check for font info in the response
  var fontInfo = '';
  var ffMatch = rawContent.match(/@font-face[^}]+}/);
  if (ffMatch) fontInfo = ffMatch[0];
  
  // Check the reader page HTML for font URL
  var x2 = new XMLHttpRequest();
  x2.open('GET', '/reader/7649259029226603070', false);
  x2.send();
  var pageHtml = x2.responseText || '';
  
  // Extract font-face declaration
  var fontFaceMatch = pageHtml.match(/@font-face\\s*{[^}]+}/g);
  var fontUrl = '';
  if (fontFaceMatch) {
    for (var i = 0; i < fontFaceMatch.length; i++) {
      if (fontFaceMatch[i].indexOf('ttf') > -1 || fontFaceMatch[i].indexOf('woff') > -1) {
        var urlMatch = fontFaceMatch[i].match(/url\\(["']?([^"')]+)["']?\\)/);
        if (urlMatch) fontUrl = urlMatch[1];
        break;
      }
    }
  }
  
  // Check for character mapping in the page
  // Fanqie uses a custom font where certain Unicode PUA (Private Use Area) codepoints
  // are mapped to real characters via the font file
  var puaChars = rawContent.match(/[\\uE000-\\uF8FF]/g);
  
  // Check the raw content for any unusual characters
  var unusualChars = [];
  for (var i = 0; i < rawContent.length && i < 500; i++) {
    var code = rawContent.charCodeAt(i);
    if (code >= 0xE000 && code <= 0xF8FF) {
      unusualChars.push({index: i, code: '0x' + code.toString(16), char: rawContent[i]});
    }
  }
  
  return {
    rawContentLen: rawContent.length,
    rawContentSample: rawContent.substring(0, 600),
    fontInfo: fontInfo,
    fontUrl: fontUrl,
    fontFaceCount: fontFaceMatch ? fontFaceMatch.length : 0,
    puaCount: puaChars ? puaChars.length : 0,
    unusualChars: unusualChars,
    dataKeys: data.data ? Object.keys(data.data) : [],
    cdKeys: cd ? Object.keys(cd) : []
  };
})())`;

const result = evalJSONB64(9222, rawJS);
console.log(JSON.stringify(result, null, 2));
