#!/usr/bin/env node
/**
 * build-greek-index.mjs — 从 LSJLogeion 的 TEI XML 分卷构建可复用的希腊语词头索引。
 *
 * 输入：analysis/reference/greek/lsj/greatscott*.xml（本地下载，不入库）
 * 输出：analysis/greek-index.json（不入库）
 *       analysis/greek-disambiguation.json（--disambiguate，不入库）
 *
 * 数据形状（实测）：<div2 id="crossgra/fw" key="gra/fw" type="main"><head …>γράφω</head> … </div2>
 *   - div2 之间是平级关系（全库 div3/div4 为 0），可用顺序扫描切块。
 *   - 词头在 <head> 的文本内容；key 是 beta-code（/ = 锐音，_ = 下标，^ = 长音，| = 分音）。
 *   - 释义在 <sense> 内的 <i>…</i>（斜体=英文对译），实词引用在 <cit> 内，需先剥离。
 *
 * 同键冲突不再二选一。规范化会抹掉变音与长短音，λῡ́ω 与 λύω 因此落进同一个 key；
 * 旧版只保留 gloss 更长的那条，等于对「这是哪个词」做了没有证据的判断。现在每个 key
 * 都存全部候选，并保留原始词形、div2 @id/@key、文件与行号；能否消歧另由
 * --disambiguate 按证据报告，不猜。
 *
 * 用法：
 *   node scripts/build-greek-index.mjs                    # 全量重建
 *   node scripts/build-greek-index.mjs --disambiguate     # 重建并输出冲突分析报告
 *   node scripts/build-greek-index.mjs --query γράφω      # 仅查询（需已有索引）
 *   node scripts/build-greek-index.mjs --dir <path>       # 指定目录
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DEFAULT_DIR = path.join(ROOT, 'analysis/reference/greek/lsj');
const OUT = path.join(ROOT, 'analysis/greek-index.json');
const REPORT = path.join(ROOT, 'analysis/greek-disambiguation.json');

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

/** 只去掉变音与长短音记号，保留字母本身，用于判断两个词头是否「仅差变音」。 */
export function bareGreek(s) {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u0340-\u0345\u1dc0-\u1dff]/g, '')
    .replace(/ς/g, 'σ')
    .toLowerCase();
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

/**
 * 词头之后的语法标注。LSJ 用 <gen> 标名词性别、<itype> 标变格词尾、
 * <tns> 标时态词干、<pos> 标词性（Adv. 等）。这些是本索引里唯一能「不猜」地
 * 分开同形词的证据。
 *
 * 位置很关键：名词的 <itype> 紧跟词头（φᾶρος, εος, τό），而动词词条会在
 * 变位表里塞进大量 <itype> 作为异形标注（λύω … (δια-, κατα-λύω) …），
 * 那些不是词头属性。所以只取词头之后、第一个例句 <cit> / 义项 <sense> /
 * <gramGrp> / <etym> 之前的那一段。
 */
function extractGrammar(entryXml) {
  const headEnd = entryXml.indexOf('</head>');
  const senseStart = entryXml.search(/<sense\b/);
  const after =
    headEnd >= 0
      ? entryXml.slice(headEnd + '</head>'.length, senseStart > headEnd ? senseStart : undefined)
      : '';
  const stop = after.search(/<(cit|sense|gramGrp|etym)\b/);
  const seg = stop >= 0 ? after.slice(0, stop) : after;
  const text = (re) => {
    const m = re.exec(seg);
    return m ? cleanText(m[1]) : '';
  };
  return {
    pos: text(/<pos\b[^>]*>([\s\S]*?)<\/pos>/),
    gender: text(/<gen\b[^>]*>([\s\S]*?)<\/gen>/),
    itype: text(/<itype\b[^>]*>([\s\S]*?)<\/itype>/),
    tns: text(/<tns\b[^>]*>([\s\S]*?)<\/tns>/),
  };
}

/** 一级义项数（level="1"）；无 level 属性的按 TEI 默认也视为一级。 */
function countSenses(entryXml) {
  const all = entryXml.match(/<sense\b[^>]*>/g) ?? [];
  let level1 = 0;
  let unlevelled = 0;
  for (const tag of all) {
    const m = /level="(\d+)"/.exec(tag);
    if (!m) unlevelled += 1;
    else if (m[1] === '1') level1 += 1;
  }
  return level1 || unlevelled || all.length;
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

const GRAMMAR_FIELDS = ['pos', 'gender', 'itype', 'tns'];

/**
 * 一个冲突组能靠条目自带的语法标注分到什么程度。
 *
 * 只做**单字段**切分，且只在该字段每个候选都有值时才用：一个缺失的标注不能
 * 当作「与别人不同」。三种结论：
 *   full    该字段把全组切成每组一个 → 每个候选都能定位
 *   partial 只切掉一部分 → 剩下的仍是多候选，不能假装解决了
 *   none    没有任何字段能切
 */
function judgeGroup(candidates) {
  if (candidates.length < 2) return null;
  const usable = GRAMMAR_FIELDS.filter((f) => candidates.every((c) => String(c[f] ?? '').trim()));
  let best = null;
  for (const field of usable) {
    const buckets = new Map();
    for (const c of candidates) {
      const v = String(c[field]).trim();
      buckets.set(v, (buckets.get(v) ?? 0) + 1);
    }
    const maxSize = Math.max(...buckets.values());
    const split = buckets.size;
    const detail = [...buckets.entries()].map(([v, n]) => (n > 1 ? `${v}×${n}` : v)).join(' / ');
    // 先看「最大残余组」有多小，再看切了几块。
    if (!best || maxSize < best.maxSize || (maxSize === best.maxSize && split > best.split)) {
      best = { field, maxSize, split, detail };
    }
  }

  if (best && best.maxSize === 1) {
    return { resolvable: 'full', basis: best.field, detail: best.detail };
  }
  if (best && best.maxSize < candidates.length) {
    return {
      resolvable: 'partial',
      basis: best.field,
      detail: `${best.detail}（仍有 ${best.maxSize} 条同值，不能分开）`,
    };
  }

  // 次级观察：义项数不同只能说明「这两个条目不是同一条」，不能说明哪个词形
  // 对应哪个条目，所以不据此消歧，只列出来备查。
  const counts = candidates.map((c) => c.senseCount);
  const sameLetters = new Set(candidates.map((c) => bareGreek(c.headword))).size === 1;
  const notes = [];
  if (new Set(counts).size >= 2) notes.push(`senseCount ${counts.join('/')}`);
  if (!sameLetters) notes.push('headwords differ beyond diacritics');
  return {
    resolvable: 'none',
    basis: 'none',
    detail: notes.length ? notes.join('; ') : 'only diacritics differ',
  };
}

function build() {
  const args = process.argv.slice(2);
  const dirArgIdx = args.indexOf('--dir');
  const dirs = dirArgIdx >= 0 ? [path.resolve(args[dirArgIdx + 1])] : [DEFAULT_DIR];
  const groups = new Map();
  let total = 0;
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
        const grammar = extractGrammar(b.xml);
        const candidate = {
          headword,
          id: '', // filled in once the group ordinal is known
          anchor: attr(b.tag, 'id'),
          key: attr(b.tag, 'key'),
          locator: `${name}#L${b.line}`,
          line: b.line,
          file: name,
          gloss: extractGloss(b.xml),
          senseCount: countSenses(b.xml),
          pos: grammar.pos,
          gender: grammar.gender,
          itype: grammar.itype,
          tns: grammar.tns,
          sourceUrl: `${SOURCE.repo}/blob/${SOURCE.commit}/${name}#L${b.line}`,
        };
        total++;
        const list = groups.get(key);
        if (list) list.push(candidate);
        else groups.set(key, [candidate]);
        kept++;
      }
      files.push({ file: name, entries: kept });
    }
  }

  const entries = {};
  const report = [];
  let collisions = 0;
  const resolution = { full: 0, partial: 0, none: 0 };
  for (const [key, candidates] of groups) {
    candidates.forEach((c, i) => {
      c.id = `LSJ.${key}.${i + 1}`;
    });
    entries[key] = { candidates };
    if (candidates.length > 1) {
      collisions += 1;
      const judgement = judgeGroup(candidates);
      resolution[judgement.resolvable] += 1;
      report.push({
        key,
        candidates: candidates.length,
        ...judgement,
        headwords: candidates.map((c) => c.headword),
        detailLines: candidates.map((c) => ({
          id: c.id,
          headword: c.headword,
          locator: c.locator,
          senseCount: c.senseCount,
          pos: c.pos,
          gender: c.gender,
          itype: c.itype,
          tns: c.tns,
        })),
      });
    }
  }

  const out = {
    generatedAt: new Date().toISOString(),
    source: SOURCE,
    normalization:
      'NFD 去组合变音符，ς→σ，小写，仅保留 α-ω/a-z；即 headword 的「去变音检索键」。' +
      '同一键下的全部条目都保留在 candidates 里，不按 gloss 长短取舍。',
    stats: {
      headwords: Object.keys(entries).length,
      div2Main: total,
      collisions,
      collisionCandidates: total - Object.keys(entries).length,
      files: files.length,
    },
    files,
    entries,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));

  console.log(
    `已写入 ${path.relative(ROOT, OUT)}：${out.stats.headwords} 个检索键 / ${total} 个 type="main" 条目 / ` +
      `${collisions} 个同键冲突组（涉及 ${out.stats.collisionCandidates} 个条目）/ ${files.length} 个分卷 / ` +
      `${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB`,
  );

  if (args.includes('--disambiguate')) {
    report.sort((a, b) => b.candidates - a.candidates);
    const payload = {
      generatedAt: out.generatedAt,
      source: SOURCE.id,
      method:
        '只做单字段切分，且该字段必须对组内每个候选都有值：组内全部分开记 full，' +
        '只切掉一部分记 partial，切不动记 none。义项数或词形差异只作备注，不用于消歧。' +
        '无论结论如何，索引都保留全部候选。',
      stats: { collisionGroups: collisions, ...resolution, candidates: out.stats.collisionCandidates },
      groups: report,
    };
    fs.writeFileSync(REPORT, `${JSON.stringify(payload, null, 2)}\n`);
    const byBasis = report
      .filter((r) => r.basis !== 'none')
      .reduce((acc, r) => ((acc[r.basis] = (acc[r.basis] ?? 0) + 1), acc), {});
    console.log(
      `已写入 ${path.relative(ROOT, REPORT)}：${collisions} 组冲突 ` +
        `(full ${resolution.full} / partial ${resolution.partial} / none ${resolution.none})，` +
        `切分依据 ${JSON.stringify(byBasis)}`,
    );
  }
}

function query(word) {
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
}

const args = process.argv.slice(2);
const qIdx = args.indexOf('--query');
if (qIdx >= 0) query(args[qIdx + 1]);
else build();
