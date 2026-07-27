#!/usr/bin/env node
'use strict';
/*
 * audit.js — zidu-claw-story 包二次全量审计 + SOP 漂移检测（随包走）
 *
 * 数据源：scripts/*.js (require/execFileSync/spawn) + references/*.md (markdown 链接 + fs 引用)
 * 输出：A) 根级与 genres/ 重名  B) 根级 setup_*.md  C) 根级 legacy 题材
 *       D) 真孤立 references  E) scripts 零入链  F) ENTRY_DOCS 死链  G) 总览
 *       H) SOP 图漂移检测（基于 SKILL.md 的 SOP-ANCHOR 区块指纹）
 *
 * 用法：
 *   node scripts/audit.js [<skill根目录>]            # 全量报告（默认自动定位自身所属 skill 根）
 *   node scripts/audit.js --sop-check [--json]       # 仅做 SOP 漂移检测，输出 JSON（供 selftest）
 *   node scripts/audit.js --update-baseline          # 刷新 docs/sop-baseline.json
 *   node scripts/audit.js --help
 *
 * 零依赖（fs/path/crypto/child_process）。退出码：0=正常（漂移仅告警）；2=定位失败。
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const argRoot = process.argv.slice(2).find((a) => !a.startsWith('--'));
// 脚本随包置于 scripts/，默认 skill 根 = scripts/..
const ROOT = argRoot || (fs.existsSync(path.join(__dirname, '..', 'SKILL.md'))
  ? path.resolve(__dirname, '..')
  : path.resolve(__dirname));
const skillsDir = ROOT;
const SKILL = path.resolve(skillsDir, '.workbuddy', 'skills', 'zidu-claw-story');

let SK = SKILL;
if (!fs.existsSync(path.join(SK, 'SKILL.md'))) {
  if (fs.existsSync(path.join(skillsDir, 'SKILL.md'))) SK = skillsDir;
  else { console.error('SKILL_NOT_FOUND:', skillsDir, 'or', SKILL); process.exit(2); }
}

// ---- SOP 漂移检测：指纹化 SKILL.md 的 SOP-ANCHOR 区块 ----
function sopFingerprint(skillRoot) {
  const md = path.join(skillRoot, 'SKILL.md');
  if (!fs.existsSync(md)) return { found: false };
  const txt = fs.readFileSync(md, 'utf-8');
  const m = txt.match(/<!--\s*SOP-ANCHOR-START\s*-->([\s\S]*?)<!--\s*SOP-ANCHOR-END\s*-->/);
  if (!m) return { found: false };
  const norm = m[1].replace(/\s+/g, ' ').trim();
  const hash = crypto.createHash('sha256').update(norm, 'utf-8').digest('hex').slice(0, 16);
  return { found: true, hash, text: norm };
}

function readBaseline(skillRoot) {
  const bp = path.join(skillRoot, 'docs', 'sop-baseline.json');
  try { return JSON.parse(fs.readFileSync(bp, 'utf-8')); } catch { return null; }
}

function sopCheckMode() {
  const fp = sopFingerprint(SK);
  if (!fp.found) {
    console.log(JSON.stringify({ drift: false, found: false, reason: 'SKILL.md 未含 SOP-ANCHOR 区块' }));
    return;
  }
  const base = readBaseline(SK);
  const drift = !base || !base.hash || base.hash !== fp.hash;
  console.log(JSON.stringify({
    drift,
    found: true,
    hash: fp.hash,
    baseline: base && base.hash,
    reason: drift ? 'SKILL.md 主流程已变更，docs/sop-complete.* 需重导出并 --update-baseline' : '一致',
  }));
}

function updateBaselineMode() {
  const fp = sopFingerprint(SK);
  if (!fp.found) { console.error('SKILL_NOT_FOUND: SOP-ANCHOR 区块缺失，无法建立基线'); process.exit(2); }
  let version = '?';
  try { version = fs.readFileSync(path.join(SK, 'VERSION'), 'utf-8').trim(); } catch { /* ignore */ }
  const base = {
    tool: 'scripts/audit.js --sop-check',
    version,
    hash: fp.hash,
    updatedAt: new Date().toISOString().slice(0, 10),
    note: 'SKILL.md 主流程 SOP 锚点指纹。改动 SOP-ANCHOR 段后须重导出 docs/sop-complete.svg/.html 并运行 --update-baseline 刷新本基线。',
  };
  fs.writeFileSync(path.join(SK, 'docs', 'sop-baseline.json'), JSON.stringify(base, null, 2) + '\n', 'utf-8');
  console.log(`基线已更新：docs/sop-baseline.json (hash=${fp.hash}, v${version})`);
}

function printUsage() {
  console.log(`audit.js — zidu-claw-story 包全量审计 + SOP 漂移检测

用法：
  node scripts/audit.js [<skill根目录>]     全量引用关系报告
  node scripts/audit.js --sop-check [--json]  仅 SOP 漂移检测（JSON 输出供 selftest）
  node scripts/audit.js --update-baseline   刷新 docs/sop-baseline.json
  node scripts/audit.js --help

默认 skill 根：脚本自身 scripts/ 的上一级（随包放置即可自动定位）。`);
}

function runFullReport() {
  const scriptsDir = path.join(SK, 'scripts');
  const refDir = path.join(SK, 'references');
  const genresDir = path.join(refDir, 'genres');

  const allScripts = fs.readdirSync(scriptsDir).filter((f) => f.endsWith('.js')).sort();
  const allRefs = fs.readdirSync(refDir).filter((f) => f.endsWith('.md')).sort();
  const allGenres = fs.readdirSync(genresDir).filter((f) => f.endsWith('.md')).sort();

  const out = {};
  const inb = {};
  const nodes = new Set();
  const touch = (a, b) => {
    nodes.add(a); nodes.add(b);
    (out[a] ||= new Set()).add(b);
    (inb[b] ||= new Set()).add(a);
  };

  const SCRIPT_ID = (f) => 'scripts/' + f;
  const REF_ID = (f) => 'references/' + f;
  const GENRE_ID = (f) => 'references/genres/' + f;

  for (const f of allScripts) {
    const src = fs.readFileSync(path.join(scriptsDir, f), 'utf-8');
    for (const m of src.matchAll(/require\(['"]([^'"]+)['"]\)/g)) {
      let p = m[1];
      if (!p.startsWith('./') && !p.startsWith('../')) continue;
      p = p.replace(/^\.\//, '').replace(/^\.\.\//, '');
      const baseName = p.split('/').pop();
      const name = baseName.endsWith('.js') ? baseName : baseName + '.js';
      const cand = allScripts.find((s) => s === name || s === baseName);
      if (cand && cand !== f) touch(SCRIPT_ID(f), SCRIPT_ID(cand));
    }
    for (const m of src.matchAll(/(['"]\.\/scripts?\/([\w-]+)['"])|(['"]\.\/([\w-]+)['"])|(path\.join\(dir,\s*['"]([\w-]+)['"])|(['"]([\w-]+)\.js['"])/g)) {
      const name = (m[2] || m[4] || m[6] || m[8]) + '.js';
      const cand = allScripts.find((s) => s === name || s === (m[2] || m[4] || m[6] || m[8]));
      if (cand && cand !== f) touch(SCRIPT_ID(f), SCRIPT_ID(cand));
    }
    for (const m of src.matchAll(/['"]([\w-]+\.md)['"]/g)) {
      const name = m[1];
      if (allRefs.includes(name)) touch(SCRIPT_ID(f), REF_ID(name));
    }
    if (src.includes("'references/genres'") || src.includes('"references/genres"') || src.includes("'genres'") || src.includes('"genres"')) {
      for (const g of allGenres) touch(SCRIPT_ID(f), GENRE_ID(g));
    }
  }

  for (const f of allRefs) {
    const src = fs.readFileSync(path.join(refDir, f), 'utf-8');
    for (const m of src.matchAll(/\[[^\]]*\]\(([^)]+\.md)(?:#[^)]*)?\)/g)) {
      const link = m[1].replace(/^\.\//, '').replace(/^references\//, '');
      const base = link.split('/').pop();
      if (allRefs.includes(base)) touch(REF_ID(f), REF_ID(base));
      else if (allGenres.includes(base)) touch(REF_ID(f), GENRE_ID(base));
    }
    for (const m of src.matchAll(/\b([\w-]+(?:\.md|_[\w-]+\.md))\b/g)) {
      const name = m[1];
      if (allRefs.includes(name)) touch(REF_ID(f), REF_ID(name));
    }
    for (const m of src.matchAll(/`([\w-]+\.md)`/g)) {
      const name = m[1];
      if (allRefs.includes(name)) touch(REF_ID(f), REF_ID(name));
    }
    const mm = src.match(/genres\/([\w-]+)\.md/g);
    if (mm) for (const x of mm) {
      const base = x.replace(/^genres\//, '');
      if (allGenres.includes(base + '.md')) touch(REF_ID(f), GENRE_ID(base + '.md'));
    }
  }

  const entryFiles = ['SKILL.md', 'README.md'];
  for (const f of fs.readdirSync(path.join(SK, 'docs'))) {
    if (f.endsWith('.md')) entryFiles.push('docs/' + f);
  }
  const entrySrc = entryFiles.map((f) => fs.readFileSync(path.join(SK, f), 'utf-8')).join('\n');

  const mainIdxRefs = new Set();
  for (const m of entrySrc.matchAll(/\b([\w-]+\.md)\b/g)) {
    const name = m[1];
    if (allRefs.includes(name) || allGenres.includes(name + '.md')) mainIdxRefs.add(name);
  }
  mainIdxRefs.forEach((n) => {
    const id = allGenres.includes(n + '.md') ? GENRE_ID(n + '.md') : REF_ID(n);
    touch('ENTRY_DOCS', id);
  });
  for (const m of entrySrc.matchAll(/scripts?\/([\w-]+)\.js|`([\w-]+)\.js`|\b([\w-]+)\.js\b/g)) {
    const name = (m[1] || m[2] || m[3]) + '.js';
    if (allScripts.includes(name)) touch('ENTRY_DOCS', SCRIPT_ID(name));
  }

  function getInOut(node) {
    return {
      in: (inb[node] || new Set()).size,
      out: (out[node] || new Set()).size,
      inList: [...(inb[node] || new Set())].sort(),
      outList: [...(out[node] || new Set())].sort(),
    };
  }

  const dup = [];
  for (const f of allRefs) if (allGenres.includes(f)) dup.push(f);
  console.log('=== A. 根级与 genres/ 重名（', dup.length, '）===');
  dup.forEach((f) => console.log('  ', f));

  const setupFiles = allRefs.filter((f) => f.startsWith('setup_'));
  console.log('\n=== B. 根级 setup_*.md（', setupFiles.length, '）===');
  setupFiles.forEach((f) => {
    const io = getInOut(REF_ID(f));
    const inHuman = io.inList.map((x) => x.replace(/^references\//, '').replace(/^scripts\//, 's/')).join(', ') || '(none)';
    console.log(`  ${f}  in=${io.in}  out=${io.out}  ← ${inHuman}`);
  });

  const genresSet = new Set(allGenres);
  const legacy = allRefs
    .filter((f) => !f.startsWith('setup_') && !genresSet.has(f) && !['genre-prose-cards.md', 'genre-library.js', 'genre-methodology.js'].includes(f))
    .filter((f) => !f.includes('-'))
    .filter((f) => !f.includes('_'))
    .filter((f) => fs.existsSync(path.join(genresDir, f)) === false);
  console.log('\n=== C. 根级疑似 legacy 题材（不在 genres/，', legacy.length, '）===');
  legacy.forEach((f) => {
    const io = getInOut(REF_ID(f));
    const inHuman = io.inList.map((x) => x.replace(/^references\//, '').replace(/^scripts\//, 's/')).join(', ') || '(none)';
    console.log(`  ${f}  in=${io.in}  out=${io.out}  ← ${inHuman}`);
  });

  const trueOrphans = allRefs.filter((f) => {
    const io = getInOut(REF_ID(f));
    return io.in === 0 && io.out === 0;
  });
  console.log('\n=== D. 真孤立 references（零入零出，', trueOrphans.length, '）===');
  trueOrphans.forEach((f) => console.log('  ', f));

  const orphanScripts = allScripts.filter((f) => getInOut(SCRIPT_ID(f)).in === 0);
  console.log('\n=== E. scripts 零入链（其他脚本不调用，', orphanScripts.length, '）===');
  orphanScripts.forEach((f) => {
    const io = getInOut(SCRIPT_ID(f));
    const outHuman = io.outList.map((x) => x.replace(/^references\//, 'r/').replace(/^scripts\//, '')).slice(0, 5).join(', ') + (io.outList.length > 5 ? '…' : '');
    console.log(`  ${f}  out=${io.out}  → ${outHuman}`);
  });

  const docsFiles = fs.readdirSync(path.join(SK, 'docs')).filter((f) => f.endsWith('.md'));
  const deadLinks = [];
  for (const m of entrySrc.matchAll(/\b([\w-]+\.md)\b/g)) {
    const n = m[1];
    const idx = m.index;
    const ctx = entrySrc.slice(Math.max(0, idx - 16), idx);
    if (n === 'SKILL.md' || n === 'README.md' || n === 'CHANGELOG.md' || n === 'LICENSE' || n === 'VERSION') continue;
    if (n === '_xxx.md') continue;
    if (/--out\s|发布|输出/.test(ctx)) continue;
    if (!allRefs.includes(n) && !allGenres.includes(n + '.md') && !docsFiles.includes(n)) deadLinks.push(n);
  }
  console.log('\n=== F. ENTRY_DOCS 死链（', [...new Set(deadLinks)].length, '）===');
  [...new Set(deadLinks)].forEach((n) => console.log('  ', n));

  console.log('\n=== G. 总览 ===');
  console.log('scripts:', allScripts.length);
  console.log('根级 references:', allRefs.length);
  console.log('genres/:', allGenres.length);
  console.log('所有节点:', nodes.size);

  // H. SOP 图漂移检测
  const fp = sopFingerprint(SK);
  console.log('\n=== H. SOP 图漂移检测 ===');
  if (!fp.found) {
    console.log('  ⚠ SKILL.md 未找到 SOP-ANCHOR 区块，跳过漂移检测。');
  } else {
    const base = readBaseline(SK);
    if (!base || !base.hash) {
      console.log('  ⚠ 基线缺失（docs/sop-baseline.json）。运行 `node scripts/audit.js --update-baseline` 建立基线。');
    } else if (base.hash !== fp.hash) {
      console.log(`  ⚠ 漂移！当前指纹 ${fp.hash} ≠ 基线 ${base.hash}`);
      console.log('     SKILL.md 主流程已变更，需重导出 docs/sop-complete.svg/.html 并运行 --update-baseline。');
    } else {
      console.log(`  ✓ 一致（指纹 ${fp.hash}，基线 v${base.version || '?'} @ ${base.updatedAt || '?'}）`);
    }
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) { printUsage(); return; }
  if (argv.includes('--sop-check')) { sopCheckMode(); return; }
  if (argv.includes('--update-baseline')) { updateBaselineMode(); return; }
  runFullReport();
}

if (require.main === module) {
  try { main(); } catch (e) { console.error('AUDIT_ERROR:', e && e.message ? e.message : e); process.exit(2); }
}
module.exports = { sopFingerprint, readBaseline };
