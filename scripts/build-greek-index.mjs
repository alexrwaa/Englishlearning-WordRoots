#!/usr/bin/env node
/**
 * build-greek-index.mjs — 从 LSJLogeion 的 TEI XML 分卷构建可复用的希腊语词头索引。
 *
 * 输入：analysis/reference/greek/lsj/greatscott*.xml（本地下载，不入库）
 * 输出：analysis/greek-index.json
 *
 * 数据形状（实测）：<div2 id="crossgra/fw" key="gra/fw" type="main"><head ...>γράφω</head> … </div2>
 *   - div2 之间是平级关系（全库 div3/div4 为 0），可用顺序扫描切块。
 *   - 词头在 <head> 的文本内容；key 是 beta-code（/ = 锐音，_ = 下标，^ = 长音，| = 分音）。
 *   - 释义在 <sense> 内的 <i>…</i>（斜体=英文对译），实词引用在 <cit> 内，需先剥离。
 *
 * 用法：
 *   node scripts/build-greek-index.mjs                 # 全量重建
 *   node scripts/build-greek-index.mjs --query γράφω   # 仅查询（需已有索引）
 *   node scripts/build-greek-index.mjs --dir <path>    # 指定或追加目录
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_DIR = path.join(ROOT, 'analysis/reference/greek/lsj');
const OUT = path.join(ROOT, 'analysis/greek-index.json');

const SOURCE = {
  id: 'G3',
  work: 'LSJ (Liddell–Scott–Jones, A Greek-English Lexicon, 9th ed. with revised supplement)',
  edition: 'Machine-readable text as edited for Logeion (University of Chicago), converted to Unicode',
  repo: 'https://github.com/helmadik/LSJLogeion',
  commit: 'e15ac7b194ace23b8fd3e568323c107395f3e996',
  license: 'CC-BY-SA-4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  licenseNote:
    'LSJLogeion 的 LICENSE.md 声明 CC BY-SA 4.0；README 要求同时署名 Perseus Tufts 与 Helma Dik/Logeion。' +
    '该文本源自 Perseus 的 LSJ 电子本，与 PerseusDL/lexica、canonical-pdlrefwk 中的 LSJ/Middle Liddell 属同一编纂谱系，' +
    '不构成彼此独立的第二来源。',
};

/** 去掉变音符号，保留希腊字母与拉丁字母，用于建立检索键。 */
export function normalizeGreek(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u0340-\u0345\u1dc0-\u1dff]/g, '') // combining marks
    .replace(/[ς]/g, 'σ')
    .toLowerCase()
    .replace(/[^α-ωa-z]/g, '');
}

/** 取出从 pos 开始、第一个 <sense …> 的完整片段（sense 可嵌套，按标签配对）。 */
function firstSense(entryXml) {
  const open = entryXml.search(/<sense\b/);
  if (open < 0) return entryXml;
  const re = /<sense\b|<\/sense>/g;
  re.lastIndex = open;
  let depth = 0;
  let m;
  while ((m = re.exec(entryXml))) {
    if (m[0] === '</sense>') {
      depth--;
      if (depth === 0) return entryXml.slice(open, m.index + 8);
    } else {
      depth++;
    }
  }
  return entryXml.slice(open);
}

/** 剥掉 <cit>（作者引用）后再取 <i> 斜体对译，拼接成简短 gloss。 */
function extractGloss(entryXml) {
  const sense = firstSense(entryXml);
  const noCit = sense.replace(/<cit\b[\s\S]*?<\/cit>/g, ' ');
  const italics = [...noCit.matchAll(/<i>([\s\S]*?)<\/i>/g)].map((m) => cleanText(m[1]));
  let gloss = italics.join(' ').replace(/\s+/g, ' ').trim();
  if (!gloss) {
    // 少数条目无斜体，退化为该 sense 前 240 字的纯文本
    gloss = cleanText(noCit).slice(0, 240);
  }
  return gloss.slice(0, 400);
}

function cleanText(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 把一段 XML 拆成 div2 条目块（开始位置 + 原文 + 行号）。 */
function splitEntries(xml) {
  const out = [];
  const re = /<div2\s[^>]*>/g;
  let m;
  const starts = [];
  while ((m = re.exec(xml))) starts.push({ idx: m.index, tag: m[0] });
  const newlines = [];
  for (let i = 0; i < xml.length; i++) if (xml.charCodeAt(i) === 10) newlines.push(i);
  const lineAt = (pos) => {
    let lo = 0;
    let hi = newlines.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (newlines[mid] < pos) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
  for (let i = 0; i < starts.length; i++) {
    const s = starts[i].idx;
    const e = i + 1 < starts.length ? starts[i + 1].idx : xml.length;
    out.push({ tag: starts[i].tag, xml: xml.slice(s, e), line: lineAt(s) });
  }
  return out;
}

function attr(tag, name) {
  const m = new RegExp(`${name}="([^"]*)"`).exec(tag);
  return m ? m[1] : '';
}

function main() {
  const args = process.argv.slice(2);
  const qIdx = args.indexOf('--query');
  if (qIdx >= 0) {
    const word = args[qIdx + 1];
    if (!fs.existsSync(OUT)) {
      console.error('索引不存在，先运行 node scripts/build-greek-index.mjs');
      process.exit(1);
    }
    const idx = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    const key = normalizeGreek(word);
    const hit = idx.entries[key];
    if (!hit) {
      console.log(`未收录: ${word} (key=${key})`);
      process.exit(0);
    }
    console.log(JSON.stringify(hit, null, 2));
    return;
  }

  const dirArgIdx = args.indexOf('--dir');
  const dirs = dirArgIdx >= 0 ? [path.resolve(args[dirArgIdx + 1])] : [DEFAULT_DIR];
  const entries = {};
  let total = 0;
  let collisions = 0;
  const files = [];

  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      console.error(`目录不存在: ${dir}`);
      process.exit(1);
    }
    const names = fs
      .readdirSync(dir)
      .filter((f) => /^greatscott\d+\.xml$/.test(f))
      .sort();
    for (const name of names) {
      const xml = fs.readFileSync(path.join(dir, name), 'utf8');
      const blocks = splitEntries(xml);
      let kept = 0;
      for (const b of blocks) {
        if (!/type="main"/.test(b.tag)) continue;
        const headM = /<head\b[^>]*>([\s\S]*?)<\/head>/.exec(b.xml);
        if (!headM) continue;
        const headword = cleanText(headM[1]);
        if (!headword) continue;
        const key = normalizeGreek(headword);
        if (!key) continue;
        const gloss = extractGloss(b.xml);
        const entryKey = attr(b.tag, 'key');
        const id = attr(b.tag, 'id');
        const rec = {
          headword,
          key: entryKey,
          gloss,
          sourceUrl: `${SOURCE.repo}/blob/${SOURCE.commit}/${name}#L${b.line}`,
          file: name,
          anchor: id,
        };
        total++;
        const prev = entries[key];
        if (prev) {
          collisions++;
          if (rec.gloss.length > prev.gloss.length) entries[key] = rec;
        } else {
          entries[key] = rec;
        }
        kept++;
      }
      files.push({ file: name, entries: kept });
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    normalization:
      'NFD 去组合变音符，ς→σ，小写，仅保留 α-ω/a-z；即 headword 的“去变音检索键”。同一键冲突时保留 gloss 更长的条目。',
    stats: { headwords: Object.keys(entries).length, div2Main: total, collisions, files: files.length },
    files,
    entries,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(
    `已写入 ${path.relative(ROOT, OUT)}：${out.stats.headwords} 个词头，` +
      `${total} 个 type="main" 条目，${collisions} 次同键冲突，${files.length} 个分卷，` +
      `${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB`,
  );
}

main();
