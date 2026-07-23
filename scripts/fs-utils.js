#!/usr/bin/env node
'use strict';

/**
 * fs-utils.js — 共享文件系统工具（zidu-claw-story 内部库，零依赖）
 *
 * 收敛各脚本中反复 copy 的 readFile / readJson / writeJson 助手，并统一两件事：
 *   1. BOM 剥离（B6）：用户用 Windows 记事本 authored 的文件可能带 UTF-8 BOM，
 *      JSON.parse 不容忍前导 BOM，会导致脚本崩溃。readFile 统一剥离。
 *   2. 原子写（B5）：writeJsonAtomic 先写 .tmp.<pid> 再 rename，消除并行进程 /
 *      中断时的半截文件（共享状态 .pipeline/state.json、记忆/写法沉淀.json）。
 *
 * 所有函数对「不存在 / 损坏 / 无权限」文件均优雅返回 null（不抛），
 * 调用方自行判空。需要 fail-fast 的「必需配置文件」脚本可保留本地 readFile。
 *
 * 注意：本文件是内部库，无 CLI 子命令；被 selftest 阶段1 语法检查覆盖，
 * 但不计入「对外脚本」功能冒烟。
 */

const fs = require('fs');
const path = require('path');

/** 剥离 UTF-8 BOM（前导 0xFEFF）。非字符串原样返回。 */
function stripBOM(s) {
  if (typeof s !== 'string') return s;
  if (s.charCodeAt(0) === 0xfeff) return s.slice(1);
  return s;
}

/** 读取文本文件，不存在 / 出错返回 null。自动剥离 BOM。 */
function readFile(p) {
  try {
    return stripBOM(fs.readFileSync(p, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 读取并解析 JSON，不存在 / 损坏返回 fallback（默认 null）。自动剥离 BOM。
 * @param {string} p
 * @param {*} [fallback]
 */
function readJson(p, fallback) {
  const txt = readFile(p);
  if (txt == null) return fallback !== undefined ? fallback : null;
  try {
    return JSON.parse(txt);
  } catch {
    return fallback !== undefined ? fallback : null;
  }
}

/** 同步写 JSON（非原子，适合低频 / 单进程）。自动建父目录。 */
function writeJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 原子写 JSON：先写临时文件再 rename，消除并行竞态导致的半截文件。自动建父目录。
 * 适用于共享可变状态（.pipeline/state.json、记忆/写法沉淀.json 等）。
 * @param {string} p
 * @param {*} data
 */
function writeJsonAtomic(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp.' + process.pid;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, p);
}

module.exports = { stripBOM, readFile, readJson, writeJson, writeJsonAtomic };
