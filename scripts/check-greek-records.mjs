#!/usr/bin/env node
/**
 * check-greek-records.mjs — 回验 analysis/greek-verification/*.json 的每条 quote。
 *
 * 对每条记录：
 *   1. JSON 结构、claim.type、record 必填字段、morphemeId 与词库一致；
 *   2. source=G3 时按 url 里的文件名定位 analysis/reference/greek/lsj/<file>；
 *   3. 用 url 的 #L 行号定位 <div2> 条目块，断言 headword（去变音）出现在该块内；
 *   4. 断言 quote 是该条目块原文的子串（不做任何模糊匹配）；
 *   5. 断言 quoteNormalized 等于 quote 去标签、去变音、压缩空白后的结果；
 *   6. 断言 verdict 与 records[].supports 自洽。
 *
 * 任一断言失败 → 非零退出。CI 不跑本脚本（字典文件不在仓库内），手动运行：
 *   node scripts/check-greek-records.mjs            # 默认目录
 *   node scripts/check-greek-records.mjs --dir DIR  # 指定参考文本目录
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const REC_DIR = path.join(ROOT, 'analysis/greek-verification');
const REF_DIR = path.join(ROOT, 'analysis/reference/greek/lsj');
const MORPHEMES = path.join(ROOT, 'src/content/lexicon/morphemes.json');

const CLAIM_TYPES = new Set([
  'root-sense',
  'classical-derivation',
  'borrowing-path',
  'modern-structure',
  'modern-sense',
]);
const VERDICTS = new Set(['supports', 'conflicts', 'not-covered']);
const REQUIRED = ['source', 'work', 'headword', 'locator', 'url', 'quote', 'quoteNormalized', 'supports', 'fetchedAt', 'tz'];

const diacritics = /[\u0300-\u036f\u0340-\u0345\u1dc0-\u1dff]/g;

export function stripMarkup(s) {
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeQuote(s) {
  return stripMarkup(s).normalize('NFD').replace(diacritics, '').normalize('NFC');
}

export function normalizeGreek(s) {
  return stripMarkup(s)
    .normalize('NFD')
    .replace(diacritics, '')
    .replace(/ς/g, 'σ')
    .toLowerCase()
    .replace(/[^α-ω]/g, '');
}

const errors = [];
const fail = (where, msg) => errors.push(`${where}: ${msg}`);

function main() {
  const args = process.argv.slice(2);
  const dirArg = args.indexOf('--dir');
  const refDir = dirArg >= 0 ? path.resolve(args[dirArg + 1]) : REF_DIR;

  if (!fs.existsSync(refDir)) {
    console.error(`参考文本目录不存在: ${refDir}\n先按 docs/GREEK_SOURCES.md 下载字典文件。`);
    process.exit(2);
  }

  const morphemes = JSON.parse(fs.readFileSync(MORPHEMES, 'utf8'));
  const morphemeList = Array.isArray(morphemes) ? morphemes : morphemes.morphemes || Object.values(morphemes);
  const morphemeIds = new Set(morphemeList.map((m) => m.id));

  const files = fs.readdirSync(REC_DIR).filter((f) => f.endsWith('.json')).sort();
  let recordCount = 0;
  let quoteCount = 0;

  for (const file of files) {
    const where = file;
    let doc;
    try {
      doc = JSON.parse(fs.readFileSync(path.join(REC_DIR, file), 'utf8'));
    } catch (e) {
      fail(where, `JSON 解析失败: ${e.message}`);
      continue;
    }

    if (!doc.morphemeId) fail(where, '缺少 morphemeId');
    if (!morphemeIds.has(doc.morphemeId)) fail(where, `morphemeId ${doc.morphemeId} 不在词库 morphemes.json 中`);
    if (path.basename(file, '.json') !== doc.morphemeId) {
      fail(where, `文件名与 morphemeId 不一致（${path.basename(file, '.json')} vs ${doc.morphemeId}）`);
    }
    if (!doc.claim || !CLAIM_TYPES.has(doc.claim.type)) {
      fail(where, `claim.type 非法: ${doc.claim && doc.claim.type}`);
    }
    if (!doc.claim || typeof doc.claim.text !== 'string' || !doc.claim.text.trim()) {
      fail(where, 'claim.text 为空');
    }
    if (!VERDICTS.has(doc.verdict)) fail(where, `verdict 非法: ${doc.verdict}`);
    if (!Array.isArray(doc.records) || doc.records.length === 0) {
      fail(where, 'records 为空');
      continue;
    }

    for (const [i, rec] of doc.records.entries()) {
      recordCount++;
      const rw = `${where} records[${i}]`;
      for (const k of REQUIRED) if (!(k in rec)) fail(rw, `缺少字段 ${k}`);
      if (typeof rec.supports !== 'boolean') fail(rw, 'supports 必须是布尔值');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(rec.fetchedAt || '')) fail(rw, `fetchedAt 格式应为 YYYY-MM-DD: ${rec.fetchedAt}`);
      if (rec.tz !== 'Asia/Shanghai') fail(rw, `tz 应为 Asia/Shanghai: ${rec.tz}`);
      if (!rec.locator) fail(rw, 'locator 为空');

      const m = /#L(\d+)$/.exec(rec.url || '');
      if (!m) {
        fail(rw, `url 缺少 #L 行号: ${rec.url}`);
        continue;
      }
      const fileName = (rec.url.split('/').pop() || '').split('#')[0];
      const abs = path.join(refDir, fileName);
      if (!fs.existsSync(abs)) {
        fail(rw, `找不到参考文件 ${path.relative(ROOT, abs)}（字典文件不入库，需本地下载）`);
        continue;
      }
      const text = fs.readFileSync(abs, 'utf8');
      const lines = text.split('\n');
      const lineNo = Number(m[1]);
      const startIdx = lineNo > 1 ? lines.slice(0, lineNo - 1).join('\n').length + 1 : 0;
      if (startIdx > text.length) {
        fail(rw, `行号 ${lineNo} 超出文件范围`);
        continue;
      }
      if (!/<div2\s/.test(lines[lineNo - 1] || '')) {
        fail(rw, `第 ${lineNo} 行不是 div2 条目开头`);
        continue;
      }
      const closeIdx = text.indexOf('</div2>', startIdx);
      const block = text.slice(startIdx, closeIdx > 0 ? closeIdx : text.length);

      if (!normalizeGreek(block).includes(normalizeGreek(rec.headword))) {
        fail(rw, `条目块内找不到词头 ${rec.headword}`);
      }
      quoteCount++;
      if (!block.includes(rec.quote)) {
        fail(rw, `quote 不是条目原文子串: ${JSON.stringify(rec.quote)}`);
      }
      const expect = normalizeQuote(rec.quote);
      if (rec.quoteNormalized !== expect) {
        fail(rw, `quoteNormalized 与规范化结果不符\n    实际: ${JSON.stringify(rec.quoteNormalized)}\n    应为: ${JSON.stringify(expect)}`);
      }
    }

    const allSupport = doc.records.every((r) => r.supports === true);
    const anySupport = doc.records.some((r) => r.supports === true);
    if (doc.verdict === 'supports' && !allSupport) fail(where, 'verdict=supports 但存在 supports=false 的记录');
    if (doc.verdict === 'conflicts' && anySupport) fail(where, 'verdict=conflicts 但存在 supports=true 的记录');
    if (doc.verdict === 'not-covered' && doc.records.length > 0) fail(where, 'verdict=not-covered 时不应带 records');
  }

  console.log(`检查 ${files.length} 份记录、${recordCount} 条 record、回验 ${quoteCount} 条 quote`);
  if (errors.length) {
    console.error(`\n失败 ${errors.length} 项：`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log('全部通过：quote 均为参考文本原文子串，quoteNormalized 可复算，verdict 自洽。');
}

main();
