/**
 * CDP 工具函数 — 各平台采集脚本的公共依赖
 *
 * 使用方式：
 *   const { ab, sleep, evalJSON, scrollLoad, getArg, safeStr } = require("./cdp-utils");
 *
 * 前置：
 *   node {SKILL_DIR}/browser-cdp/scripts/setup-cdp-chrome.js 9222
 */

const { execSync } = require("child_process");

// agent-browser 缺失告警只打印一次，避免每页调用刷屏
let _abWarned = false;
function warnAgentBrowserMissing(detail) {
  if (_abWarned) return;
  _abWarned = true;
  process.stderr.write(
    "\n[cdp-utils] ⚠ agent-browser CLI 未安装或不可用" +
      (detail ? "（" + detail + "）" : "") +
      "：排行榜 / 扫描将静默降级（输出可能为空或退化为占位）。\n" +
      "  请先部署 agent-browser（或检查 PATH），否则依赖 CDP 的采集无法真正工作。\n"
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
    // agent-browser 未安装 / 不在 PATH → 友好告警一次，仍优雅降级返回 ""
    const msg = String((e && (e.message || e.stderr)) || "");
    const missing = e && e.code === "ENOENT";
    const notRecognized = /not recognized|command not found|no such file|'agent-browser' is not recognized/i.test(msg);
    if (missing || notRecognized) {
      warnAgentBrowserMissing(missing ? "ENOENT：命令未找到" : "命令未被识别");
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
