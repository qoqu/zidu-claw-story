/**
 * CDP 工具函数 — 各平台采集脚本的公共依赖
 *
 * 使用方式：
 *   const { ab, sleep, evalJSON, scrollLoad, getArg, safeStr } = require("./cdp-utils");
 *
 * 前置（启动 Chrome CDP 调试端口）：
 *   node scripts/setup-cdp-chrome.js 9222
 *
 * CDP 通道自包含说明（v1.7.15 起）：
 *   ab() 优先调用宿主环境提供的真实 agent-browser CLI；
 *   若该 CLI 缺失（ENOENT / 未识别），自动回退到随包内联的
 *   scripts/cdp-agent-browser.js（纯 Node 零依赖 shim，实现 open/eval/eval -b）。
 *   因此把本 skill 整个目录发给他人即可使用扫榜 / 采集，无需另装任何 skill 或 CLI。
 */

const { execSync, execFileSync } = require("child_process");
const path = require("path");

// 随包内联的 CDP shim（零依赖，canonical 副本），agent-browser CLI 缺失时回退到此
const SHIM = path.join(__dirname, "cdp-agent-browser.js");

// agent-browser 缺失告警只打印一次，避免每页调用刷屏
let _abWarned = false;
function warnAgentBrowserMissing(detail) {
  if (_abWarned) return;
  _abWarned = true;
  process.stderr.write(
    "\n[cdp-utils] ⚠ CDP 通道不可用" +
      (detail ? "（" + detail + "）" : "") +
      "：排行榜 / 扫描将静默降级（输出可能为空或退化为占位）。\n" +
      "  已尝试真实 agent-browser CLI 与随包内联 shim 均失败；请确认 Chrome CDP 已启动" +
      "（node scripts/setup-cdp-chrome.js 9222）且 node 可用。\n"
  );
}

// ---------------------------------------------------------------------------
// agent-browser 工具函数
// ---------------------------------------------------------------------------

/**
 * 调用 agent-browser CLI
 * @param {number} port - CDP 端口
 * @param  {...string} args - agent-browser 参数
 * @returns {string} stdout（trim 后）
 */
function ab(port, ...args) {
  const cmd = args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(" ");
  try {
    return execSync(`agent-browser --cdp ${port} ${cmd}`, {
      encoding: "utf-8",
      timeout: 20000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch (e) {
    // 真实 agent-browser CLI 未安装 / 不在 PATH → 回退到随包内联 shim
    const msg = String((e && (e.message || e.stderr)) || "");
    const missing = e && e.code === "ENOENT";
    const notRecognized = /not recognized|command not found|no such file|'agent-browser' is not recognized/i.test(msg);
    // Windows 中文系统下 cmd.exe 的错误信息是 GBK 编码，regex 匹配不到；
    // 额外判断：status=1 且 stdout 为空 → 命令不存在
    const winMissing = process.platform === "win32" && e && e.status === 1 && !e.stdout;
    if (missing || notRecognized || winMissing) {
      try {
        return execFileSync(process.execPath, [SHIM, "--cdp", String(port), ...args], {
          encoding: "utf-8",
          timeout: 20000,
          stdio: ["pipe", "pipe", "pipe"],
        }).trim();
      } catch (e2) {
        // shim 也起不来（极少见：node 不可达 / shim 自身损坏）→ 告警一次，优雅降级返回 ""
        const m2 = String((e2 && (e2.message || e2.stderr)) || "");
        const missing2 = e2 && e2.code === "ENOENT";
        const notRec2 = /not recognized|command not found|no such file/i.test(m2);
        if (missing2 || notRec2) warnAgentBrowserMissing("内联 shim 也无法启动（node 不可达？）");
        else warnAgentBrowserMissing("内联 shim 执行失败：" + (m2.split("\n")[0] || ""));
        return e2.stdout?.trim() || "";
      }
    }
    return e.stdout?.trim() || "";
  }
}

/** 等待 ms 毫秒（跨平台，不依赖系统 sleep 命令） */
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

/** 在浏览器内执行 JS 并解析 JSON 返回值 */
function evalJSON(port, js) {
  const raw = ab(port, "eval", js);
  if (!raw || raw === "ERR") return null;
  try {
    let parsed = JSON.parse(raw);
    if (typeof parsed === "string") {
      try { parsed = JSON.parse(parsed); } catch {}
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * 安全地将值插入浏览器 eval 字符串。
 * 使用 JSON.stringify 确保值不会因特殊字符（引号、反斜杠等）破坏 eval 字符串。
 * @param {*} val - 要插入的值
 * @returns {string} JSON 字符串表示（含引号）
 */
function safeStr(val) {
  return JSON.stringify(String(val));
}

/**
 * 滚动页面加载更多内容
 * @param {number} port - CDP 端口
 * @param {number} times - 滚动次数
 * @param {number} [interval=1000] - 每次滚动间隔（ms）
 */
function scrollLoad(port, times, interval = 1000) {
  for (let i = 0; i < times; i++) {
    ab(port, "eval", "window.scrollBy(0, window.innerHeight)");
    sleep(interval);
  }
}

/** 解析 --xxx 参数 */
function getArg(args, name) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

module.exports = { ab, sleep, evalJSON, safeStr, scrollLoad, getArg };
