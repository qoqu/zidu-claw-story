#!/usr/bin/env node
'use strict';

// 统一爽点词表（合并 emotion-analyzer.satisfaction 与 satisfaction-meter.strong，去重）
// 单一来源，供两脚本共用，消除「双扫描 + 词表漂移」。
// 任何爽点识别的增删改都只在此处进行。
const SATISFACTION_WORDS = [
  '打脸', '反杀', '逆袭', '翻身', '扬眉吐气', '一鸣惊人',
  '全场沸腾', '掌声雷动', '刮目相看', '跪下', '求饶',
  '后悔', '后悔莫及', '肠子悔青', '众人震惊', '目瞪口呆',
  '瞠目结舌', '大快人心', '痛快', '爽', '太帅了', '牛逼', '厉害了',
];

function splitParagraphs(text) {
  return text.split(/\r?\n/).filter(p => p.trim().length > 10);
}

function countWords(text) {
  return text.replace(/\s+/g, '').length;
}

// 共享爽点检测：基于统一词表返回段落级爽点命中
// 返回 [{ paragraph, words:[...], score, preview, position_pct }]
function detectSatisfactionPoints(text) {
  const paragraphs = splitParagraphs(text);
  const totalWords = countWords(text) || 1;
  const points = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const hits = [];
    for (const w of SATISFACTION_WORDS) {
      if (para.includes(w)) hits.push(w);
    }
    if (hits.length > 0) {
      points.push({
        paragraph: i + 1,
        words: hits,
        score: hits.length,
        preview: para.substring(0, 40),
        position_pct: Math.round((countWords(paragraphs.slice(0, i + 1).join('')) / totalWords) * 100),
      });
    }
  }
  return points;
}

module.exports = { SATISFACTION_WORDS, detectSatisfactionPoints, splitParagraphs, countWords };

// 直接运行：命令行快速爽点扫描
if (require.main === module) {
  const fs = require('fs');
  const path = require('path');
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === '--help') {
    console.log('Usage: node satisfaction-points.js <chapter-file> [--json]');
    process.exit(0);
  }
  const f = path.resolve(args[0]);
  if (!fs.existsSync(f)) { console.error('File not found: ' + f); process.exit(2); }
  const text = fs.readFileSync(f, 'utf-8');
  const pts = detectSatisfactionPoints(text);
  if (args.includes('--json')) {
    console.log(JSON.stringify({ satisfaction_points: pts.length, points: pts }, null, 2));
  } else {
    console.log(`🎯 爽点（统一词表）：${pts.length} 个`);
    pts.forEach(p => console.log(`  第${p.paragraph}段 [${p.words.join('、')}] 位置 ${p.position_pct}%`));
  }
  process.exit(0);
}
