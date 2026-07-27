#!/usr/bin/env node
"use strict";
// cdp-agent-browser — zidu-claw-story 内联 CDP 通道 shim（随包分发，零依赖）。
//
// 这是 fanqie-scan-cdp-shim 中 agent-browser 的 canonical 副本，直接内联进 skill，
// 使其对「扫榜 / CDP 采集」自包含：把 skill 整个目录发给别人，无需对方另装任何 skill 或 CLI。
//
// 实现仅覆盖采集脚本用到的子命令：open / eval / eval -b
// 通过持久化 Chrome Tab 的 CDP（原生 WebSocket，无第三方依赖）通信。
//
// cdp-utils.ab() 的调用约定：真实 agent-browser CLI 存在时优先使用真 CLI；
// 缺失（ENOENT / 未识别）时回退到本文件（node <本文件> --cdp <port> <args>）。
//
// 前置：先启动 Chrome CDP 环境（node scripts/setup-cdp-chrome.js 9222）。
const http = require("http");
const crypto = require("crypto");
const { URL } = require("url");

function parseArgs(argv) {
  let port = 9222;
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--cdp") { port = parseInt(argv[++i], 10) || 9222; }
    else rest.push(argv[i]);
  }
  return { port, rest };
}

function httpGetJson(path, port) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: "127.0.0.1", port, path }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } });
    });
    req.on("error", reject);
  });
}

async function getTarget(port) {
  let list = await httpGetJson("/json", port);
  let page = (list || []).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  if (!page) {
    await new Promise((resolve) => {
      const req = http.post({ host: "127.0.0.1", port, path: "/json/new" }, (res) => {
        res.on("data", () => {}); res.on("end", resolve);
      });
      req.on("error", () => resolve()); req.end();
    });
    list = await httpGetJson("/json", port);
    page = (list || []).find((t) => t.type === "page" && t.webSocketDebuggerUrl);
  }
  return page;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const u = new URL(wsUrl);
    const key = crypto.randomBytes(16).toString("base64");
    const req = http.request({
      host: u.hostname, port: u.port || 80, path: u.pathname + u.search,
      headers: { Connection: "Upgrade", Upgrade: "websocket", "Sec-WebSocket-Version": "13", "Sec-WebSocket-Key": key },
    });
    req.on("upgrade", (res, socket, head) => resolve({ socket, head: Buffer.from(head || "") }));
    req.on("error", reject);
    req.end();
  });
}

function encodeFrame(payload) {
  const len = payload.length;
  let header;
  if (len < 126) { header = Buffer.from([0x81, 0x80 | len]); }
  else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 0x80 | 126; header.writeUInt16BE(len, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 0x80 | 127; header.writeUInt32BE(0, 2); header.writeUInt32BE(len, 6); }
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(len);
  for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i & 3];
  return Buffer.concat([header, mask, masked]);
}

function decodeFrames(buf) {
  const frames = [];
  let off = 0;
  while (off + 2 <= buf.length) {
    const b0 = buf[off], b1 = buf[off + 1];
    const opcode = b0 & 0x0f;
    const masked = (b1 & 0x80) !== 0;
    let len = b1 & 0x7f;
    let p = off + 2;
    if (len === 126) { if (off + 4 > buf.length) break; len = buf.readUInt16BE(off + 2); p = off + 4; }
    else if (len === 127) { if (off + 10 > buf.length) break; len = Number(buf.readBigUInt64BE(off + 2)); p = off + 10; }
    if (p + len > buf.length) break;
    let payload = buf.slice(p, p + len);
    if (masked) { const m = buf.slice(p - 4, p); const out = Buffer.alloc(len); for (let i = 0; i < len; i++) out[i] = payload[i] ^ m[i & 3]; payload = out; }
    frames.push({ opcode, payload });
    off = p + len;
  }
  return { frames, rest: buf.slice(off) };
}

async function main() {
  const { port, rest } = parseArgs(process.argv.slice(2));
  const sub = rest[0];

  if (sub === "help" || sub === "--help" || sub === "-h") {
    process.stdout.write(
      "cdp-agent-browser (内联 shim, 零依赖)\n" +
      "用法:\n" +
      "  cdp-agent-browser --cdp <port> open <url>\n" +
      "  cdp-agent-browser --cdp <port> eval <js-expr>\n" +
      "  cdp-agent-browser --cdp <port> eval -b <base64-js>\n" +
      "说明: 连接本机 Chrome CDP (127.0.0.1:<port>)，实现 open / eval 三个子命令。\n" +
      "      真实 agent-browser CLI 存在时 cdp-utils 优先使用真 CLI，本文件为其回退副本。\n" +
      "前置: 先启动 Chrome CDP (node scripts/setup-cdp-chrome.js <port>)。\n"
    );
    process.exit(0);
  }

  const target = await getTarget(port);
  if (!target) { process.stderr.write("no-target\n"); process.exit(1); }
  const { socket, head } = await connect(target.webSocketDebuggerUrl);
  let recvBuf = Buffer.from(head);
  const messages = [];
  let wake = null;
  socket.on("data", (chunk) => {
    recvBuf = Buffer.concat([recvBuf, chunk]);
    const { frames, rest: rb } = decodeFrames(recvBuf);
    recvBuf = rb;
    for (const f of frames) {
      if (f.opcode === 0x9) { socket.write(Buffer.concat([Buffer.from([0x8a, f.payload.length]), f.payload])); continue; }
      if (f.opcode === 0x8) { try { socket.end(); } catch (e) {} return; }
      const text = f.payload.toString("utf-8");
      try { messages.push(JSON.parse(text)); } catch (e) {}
    }
    if (wake) { const w = wake; wake = null; w(); }
  });

  let idc = 1;
  function sendRecv(method, params) {
    return new Promise((resolve, reject) => {
      const id = idc++;
      const deadline = Date.now() + 18000;
      const poll = () => {
        for (let i = 0; i < messages.length; i++) {
          if (messages[i] && messages[i].id === id) return messages.splice(i, 1)[0];
        }
        return null;
      };
      wsSend(socket, JSON.stringify({ id, method, params: params || {} }));
      const tick = () => {
        const m = poll();
        if (m) return resolve(m);
        if (Date.now() > deadline) return reject(new Error("timeout " + method));
        wake = () => tick();
        setTimeout(tick, 150);
      };
      tick();
    });
  }
  function wsSend(s, str) { s.write(encodeFrame(Buffer.from(str, "utf-8"))); }

  try {
    if (sub === "open") {
      const url = rest[1];
      await sendRecv("Page.enable", {});
      await sendRecv("Page.navigate", { url });
      try { socket.end(); } catch (e) {}
      process.exit(0);
    } else if (sub === "eval") {
      let expr;
      if (rest[1] === "-b") expr = Buffer.from(rest[2] || "", "base64").toString("utf-8");
      else expr = rest[1] || "";
      await sendRecv("Runtime.enable", {});
      const resp = await sendRecv("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      try { socket.end(); } catch (e) {}
      if (resp && resp.result && resp.result.result) {
        const v = resp.result.result.value;
        if (v === undefined || v === null) process.stdout.write("");
        else if (typeof v === "string") process.stdout.write(v);
        else process.stdout.write(JSON.stringify(v));
      } else {
        process.stdout.write("");
      }
      process.exit(0);
    } else {
      process.stderr.write("unknown subcommand: " + sub + "\n");
      try { socket.end(); } catch (e) {}
      process.exit(2);
    }
  } catch (e) {
    process.stderr.write("shim-error: " + e.message + "\n");
    try { socket.end(); } catch (e2) {}
    process.exit(1);
  }
}
main();
