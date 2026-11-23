/**
 * Textbook coverage audit for the four registered textbook groups.
 *
 *   S1  English Vocabulary Elements (3e)      — 283 knowledge points
 *   S2  Essentials of Linguistics (2e)        — 43 morphology concepts
 *   S3  WordWorks / SWI                       — 5 inquiry steps
 *   S4  New Word-Analysis (1879)              — 16 historical topics + 7 dated claims
 *
 * The audit reads the course itself (243 lessons under src/content/weeks) and
 * never trusts a knowledge-point id, a glossary entry or a "mentioned once"
 * sentence. The three gates are the same for every group:
 *
 *   taught    the lesson body explains it (>=120 chars of prose, or a definition
 *             sentence) AND carries at least one real example form
 *   practiced at least one exercise actually asks about it (the question stem,
 *             or the keyed answer together with its explanation), not a
 *             neighbouring topic that happens to share a chapter
 *   feedback  that exercise has an explanation (explain / whyNot)
 *
 * complete = all three, partial = taught minus one, missing = no explanation.
 * Glossary-only coverage (card.terms without prose) is explicitly not taught.
 *
 * Usage:
 *   node scripts/audit-textbook.mjs           # recompute and write the report
 *   node scripts/audit-textbook.mjs --check   # fail if the report is stale
 *
 * Outputs (all generated, never hand-edited):
 *   docs/textbook-audit.json
 *   docs/TEXTBOOK_COVERAGE_V2.md
 *   docs/TEXTBOOK_S2_S3_S4.md
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const AUDIT_JSON = 'docs/textbook-audit.json';
const COVERAGE_MD = 'docs/TEXTBOOK_COVERAGE_V2.md';
const S234_MD = 'docs/TEXTBOOK_S2_S3_S4.md';

export const CRITERIA = {
  taught:
    '卡片正文有实质讲解（正文 ≥120 字，或 ≥80 字且含定义句），且至少出现 1 个真实例词；card.terms 术语表不算',
  practiced: '练习的题干（prompt/sentence/parts）直接问该点；或在讲过该点的课时里，正确选项/答案本身就是该点（术语填空、判断哪一项属于该类）。只在解析里提一句不算',
  feedback: '该练习的 explain 或 whyNot ≥40 字，能说明对错理由',
  taughtChars: 120,
  definitionChars: 80,
  feedbackChars: 40,
};

/* ------------------------------------------------------------------ */
/* text helpers                                                        */
/* ------------------------------------------------------------------ */

const countChars = (s) => Array.from(String(s ?? '').replace(/\s+/g, '')).length;

const DEF_RE =
  /(是指|指的是|定义为|是一种|是一个|叫作|称为|叫做|也就是说|是[^。；\n]{0,24}(规则|现象|机制|单位|过程|类型|方式|条件|概念|术语|方法|结构|范畴|标记|手段))/;

const CJK_RUN = /[\u4e00-\u9fff]+/g;
const LATIN_TOKEN = /[A-Za-z][A-Za-z'’-]{2,}/g;

const STOPWORDS = new Set(
  (
    'the and for with that this from have has are was were not but you your our its his her their ' +
    'can will would could should may might must does did doing done been being there here what which ' +
    'when where who whom whose how why all any both each few more most other some such only own same ' +
    'than too very just also into over under about after before between during through because while ' +
    'english latin greek word words lesson card cards example examples form forms meaning mean means ' +
    'morpheme morphemes root roots suffix suffixe prefix prefixes base stem stem'
  ).split(/\s+/),
);

const normalize = (s) =>
  String(s ?? '')
    .replace(/\r/g, '')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

function latinWords(text) {
  return new Set((normalize(text).match(LATIN_TOKEN) ?? []).map((w) => w.toLowerCase()));
}

/** Does this text contain a real example form (not the concept's own name)? */
function hasExampleForm(text, allow = []) {
  const lowered = normalize(text).toLowerCase();
  // When the concept declares its example set, only those forms count: the
  // concept's own name (or any other English word on the card) is not an example.
  if (allow.length) return allow.some((w) => lowered.includes(String(w).toLowerCase()));
  for (const w of latinWords(text)) {
    if (w.length >= 3 && !STOPWORDS.has(w)) return true;
  }
  return false;
}

const matchAny = (text, patterns) => {
  const s = String(text ?? '');
  return patterns.some((re) => re.test(s));
};

/* ------------------------------------------------------------------ */
/* corpus                                                              */
/* ------------------------------------------------------------------ */

function cardText(card) {
  const parts = [card.title, card.body];
  if (Array.isArray(card.head)) parts.push(card.head.join(' '));
  if (Array.isArray(card.rows)) parts.push(card.rows.flat().join(' '));
  for (const key of ['a', 'b', 'sums', 'steps', 'words', 'excerpt', 'base', 'prefixes', 'suffixes']) {
    const v = card[key];
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) parts.push(v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '));
  }
  if (Array.isArray(card.terms)) parts.push(card.terms.map((t) => `${t.term} ${t.zh ?? ''} ${t.note ?? ''}`).join(' '));
  return normalize(parts.filter(Boolean).join('\n'));
}

export function normalizeCard(lessonId, index, card) {
  const prose = normalize([card.title, card.body].filter(Boolean).join('\n'));
  return {
    lessonId,
    cardId: `${lessonId}-c${index + 1}`,
    index: index + 1,
    kind: card.kind ?? 'text',
    title: normalize(card.title ?? ''),
    body: normalize(card.body ?? ''),
    terms: Array.isArray(card.terms) ? card.terms : [],
    prose,
    text: cardText(card),
    proseLen: countChars(prose),
    textLen: countChars(cardText(card)),
    raw: card,
  };
}

function correctAnswerText(e) {
  const answer = e.answer;
  if (Array.isArray(e.choices) && (typeof answer === 'number' || Array.isArray(answer))) {
    const idx = Array.isArray(answer) ? answer : [answer];
    return idx.map((i) => e.choices[i] ?? '').join(' ');
  }
  if (Array.isArray(answer)) return answer.join(' ');
  return answer == null ? '' : String(answer);
}

export function normalizeExercise(lessonId, e) {
  const stemText = [e.prompt, e.sentence, Array.isArray(e.parts) ? e.parts.join(' ') : '', Array.isArray(e.segments) ? e.segments.join(' ') : '', e.word]
    .filter(Boolean)
    .join('\n');
  const optionText = Array.isArray(e.choices) ? e.choices.join('\n') : '';
  return {
    lessonId,
    exerciseId: e.id ?? `${lessonId}-x?`,
    kind: e.kind ?? 'unknown',
    prompt: normalize(e.prompt ?? ''),
    sentence: normalize(e.sentence ?? ''),
    choices: Array.isArray(e.choices) ? e.choices : [],
    answerText: normalize(correctAnswerText(e)),
    explain: normalize(e.explain ?? ''),
    whyNot: normalize(e.whyNot ?? ''),
    stemText: normalize(stemText),
    optionText: normalize(optionText),
    promptText: normalize([stemText, optionText].filter(Boolean).join('\n')),
    text: normalize([e.prompt, e.sentence, Array.isArray(e.choices) ? e.choices.join(' ') : '', e.explain, e.whyNot].filter(Boolean).join('\n')),
    raw: e,
  };
}

export function normalizeLesson(lesson) {
  return {
    id: lesson.id,
    week: lesson.week,
    day: lesson.day,
    title: normalize(lesson.title ?? ''),
    concepts: lesson.concepts ?? [],
    knowledgePoints: lesson.knowledgePoints ?? [],
    cards: (lesson.cards ?? []).map((c, i) => normalizeCard(lesson.id, i, c)),
    exercises: [...(lesson.practice ?? []), ...(lesson.apply ?? [])].map((e) => normalizeExercise(lesson.id, e)),
  };
}

export function loadCorpus(root = ROOT) {
  const weeksDir = path.join(root, 'src/content/weeks');
  const weeks = readdirSync(weeksDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^week\d{2}$/.test(d.name))
    .map((d) => d.name)
    .sort();
  const lessons = [];
  for (const week of weeks) {
    const dir = path.join(weeksDir, week);
    const days = readdirSync(dir)
      .filter((f) => /^day\d+\.json$/.test(f))
      .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    for (const day of days) {
      lessons.push(normalizeLesson(JSON.parse(readFileSync(path.join(dir, day), 'utf8'))));
    }
  }
  return {
    root,
    weeks: weeks.length,
    lessons,
    cards: lessons.flatMap((l) => l.cards),
    exercises: lessons.flatMap((l) => l.exercises),
  };
}

/* ------------------------------------------------------------------ */
/* generic concept evaluation                                          */
/* ------------------------------------------------------------------ */

/**
 * `explained` is the weaker gate: a substantial card exists. Without it the
 * point is missing; with it but without an example form, the point is partial
 * (缺一), which is exactly how the 0.8.0 report treated a half-taught concept.
 */
export function classify(taught, practiced, feedback, explained = taught) {
  if (!explained) return 'missing';
  return taught && practiced && feedback ? 'complete' : 'partial';
}

/**
 * Pick the card that best teaches a concept, with evidence.
 *
 * Ranking: a card must be substantial and carry a real example; among those, the
 * card that mentions the trigger most often wins, ties go to the earlier lesson.
 * That makes the evidence the place where the course actually introduces the
 * concept, not a later card that happens to reuse the word.
 */
function pickTeachingCard(def, cards) {
  const hits = cards.filter((c) => matchAny(c.text, def.patterns));
  const scored = hits
    .map((c) => {
      const substantial = (c.textLen >= CRITERIA.taughtChars && c.proseLen >= 60) || (c.proseLen >= CRITERIA.definitionChars && DEF_RE.test(c.body));
      const example = hasExampleForm(c.text, def.examples ?? []);
      const count = def.patterns.reduce((n, re) => n + (c.text.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)) ?? []).length, 0);
      // A card that writes 「term（中文）」 is the card that names the concept.
      const named = (def.term && c.text.includes(`${def.term}（`)) || (def.termZh && c.text.includes(`（${def.termZh}）`)) ? 3 : 0;
      const density = count >= 3 ? 3 : count === 2 ? 2 : 1;
      const inTitle = matchAny(c.title, def.patterns) ? 5 : 0;
      return { card: c, substantial, example, count, score: inTitle + (named ? 4 : 0) + density + (example ? 2 : 0) };
    })
    .sort((a, b) => b.score - a.score || a.card.lessonId.localeCompare(b.card.lessonId));
  const eligible = scored.filter((s) => s.substantial && s.example);
  const explained = scored.filter((s) => s.substantial);
  return { hit: eligible[0]?.card ?? null, explainedCard: explained[0]?.card ?? null, candidates: (eligible.length ? eligible : scored).slice(0, 3) };
}

/**
 * An exercise practices a concept only when the *question* is about it: the
 * trigger must sit in the stem (prompt / sentence / parts), or — for a question
 * whose options or keyed answer are the concept — in an option or the answer,
 * and the item must sit in a lesson that teaches the concept. A concept named
 * only in the explanation is feedback about a neighbouring answer, not a test.
 */
function pickPractice(def, exercises, teachingLessons) {
  const asked = [];
  for (const e of exercises) {
    const inTeachingLesson = teachingLessons.has(e.lessonId);
    let how = null;
    if (matchAny(e.stemText, def.patterns)) how = 'stem';
    else if (inTeachingLesson && (matchAny(e.optionText, def.patterns) || matchAny(e.answerText, def.patterns) || matchAny(e.answerText, def.answers ?? []))) how = 'keyed';
    if (!how) continue;
    const feedback = e.explain.length >= CRITERIA.feedbackChars || e.whyNot.length >= 20;
    asked.push({ exercise: e, how, feedback, inTeachingLesson });
  }
  // Prefer a stem that asks about the concept, and prefer the lesson that teaches it.
  return asked.sort(
    (a, b) =>
      Number(b.inTeachingLesson) - Number(a.inTeachingLesson) ||
      Number(b.how === 'stem') - Number(a.how === 'stem') ||
      a.exercise.lessonId.localeCompare(b.exercise.lessonId),
  );
}

export function evaluateConcept(def, corpus) {
  const teaching = pickTeachingCard(def, corpus.cards);
  // Every card that passes the gate counts as a teaching site; practice is only
  // credited when the item sits in one of those lessons, so a distractor that
  // happens to contain the word cannot manufacture a practice hit.
  const teachingSites = corpus.cards
    .filter((c) => matchAny(c.text, def.patterns))
    .filter((c) => (c.textLen >= CRITERIA.taughtChars && c.proseLen >= 60) || (c.proseLen >= CRITERIA.definitionChars && DEF_RE.test(c.body)));
  const teachingLessons = new Set(teachingSites.map((c) => c.lessonId));
  const practice = pickPractice(def, corpus.exercises, teachingLessons);
  const first = practice[0] ?? null;
  const explained = Boolean(teaching.explainedCard);
  const taught = Boolean(teaching.hit);
  const practiced = practice.length > 0;
  const feedback = practice.some((p) => p.feedback);
  const evidence = {
    teaching: teaching.hit
      ? { lessonId: teaching.hit.lessonId, cardId: teaching.hit.cardId, title: teaching.hit.title }
      : teaching.explainedCard
        ? { lessonId: teaching.explainedCard.lessonId, cardId: teaching.explainedCard.cardId, title: teaching.explainedCard.title, noExample: true }
        : null,
    practice: first ? { lessonId: first.exercise.lessonId, exerciseId: first.exercise.exerciseId, kind: first.exercise.kind } : null,
    feedback: (practice.find((p) => p.feedback) ?? null)
      ? {
          lessonId: (practice.find((p) => p.feedback) ?? first).exercise.lessonId,
          exerciseId: (practice.find((p) => p.feedback) ?? first).exercise.exerciseId,
        }
      : null,
  };
  const lessons = [...new Set([teaching.hit?.lessonId, ...practice.map((p) => p.exercise.lessonId)].filter(Boolean))];
  return {
    id: def.id,
    term: def.term,
    termZh: def.termZh,
    status: classify(taught, practiced, feedback, explained),
    explained,
    taught,
    practiced,
    feedback,
    lessons,
    evidence,
    nearMisses: teaching.hit
      ? []
      : teaching.candidates.map((c) => ({
          cardId: c.card.cardId,
          proseLen: c.card.proseLen,
          substantial: c.substantial,
          example: c.example,
        })),
    practiceKinds: [...new Set(practice.map((p) => p.exercise.kind))],
  };
}

/* ------------------------------------------------------------------ */
/* S2 concept matchers                                                 */
/* ------------------------------------------------------------------ */

/**
 * One entry per concept in analysis/textbook/s2-concepts.json. `patterns` do the
 * semantic matching; `examples` are the real forms the teaching card must carry,
 * so a card that only names the term cannot pass as taught.
 */
export const S2_MATCHERS = {
  morphology: { patterns: [/形态学/i, /morphology/i], examples: ['teachers', 'unkind', 'table'] },
  morpheme: { patterns: [/词素/, /语素/, /\bmorpheme/i], examples: ['teachers', 'unkind', 'table'] },
  'free-bound': {
    patterns: [/自由(词素|语素)/, /(黏着|粘着)(词素|语素)/, /free morpheme/i, /bound morpheme/i, /(不能|必须)单独成词/, /附着在别的成分/],
    examples: ['help', 'kind', 'un-', '-ness'],
    answers: [/^(bound|free|粘着|黏着|自由)$/i],
  },
  'root-base-stem': { patterns: [/词根/, /词基/, /词干/], examples: ['struct', 'fer', 'form', 'unhelpfulness'] },
  'affix-positions': {
    patterns: [/前缀/, /后缀/, /中缀/, /间缀/, /环缀/, /按位置分|五种位置/, /\b(prefix|suffix|infix|interfix|superfix)/i],
    examples: ['prefix', 'suffix', 'un-', '-ness'],
  },
  'inflection-vs-derivation': {
    patterns: [/屈折/, /派生/, /inflection/i, /derivation/i],
    examples: ['-s', '-ed', '-ing', '-ness'],
  },
  productivity: { patterns: [/能产/, /\bproductiv(e|ity)\b/i], examples: ['un-', '-ness', '-ment', 'unhelpment'] },
  selection: {
    patterns: [/选择限制/, /宿主(词性|条件|限制|必须|要求)/, /接缀(条件|限制|规则)/, /selectional/i],
    examples: ['-ness', '-ful', 'docful'],
  },
  hierarchy: { patterns: [/层级(派生|结构|关系)/, /加缀顺序/, /括号切分/, /hierarch/i, /每一步只加一个/], examples: ['unhelpfulness', 'helpful', 'nationalization'] },
  blocking: { patterns: [/阻塞[(（]blocking/, /阻塞(是|的|这|机制|现象|解释)/, /同义[^。]{0,24}阻塞|阻塞[^。]{0,12}同义/, /\bblocking\b/i], examples: ['gloriosity', 'glory', 'impossible'] },
  lexicalization: { patterns: [/词汇化/, /lexicaliz/i], examples: ['laser', 'understand'] },
  compounding: { patterns: [/复合词/, /复合/, /compound/i], examples: ['blackboard', 'greenhouse'] },
  'endo-exocentric': { patterns: [/向心/, /离心/, /endocentric/i, /exocentric/i], examples: ['blackboard', 'redhead'] },
  dvandva: { patterns: [/dvandva/i, /并列复合/], examples: ['bittersweet', 'deaf-mute', 'tragicomic'] },
  allomorphy: { patterns: [/语素变体/, /词素变体/, /allomorph/i], examples: ['in-', 'im-', 'il-', 'ir-'] },
  'allomorph-conditioning': {
    patterns: [/语音条件/, /词汇条件/, /phonologically conditioned/i, /lexically conditioned/i, /按词条/, /屈折层|词汇层/],
    examples: ['-s', '-ed', 'im-', 'in-'],
  },
  'zero-affix': {
    patterns: [/零形式/, /零派生/, /零词缀/, /zero (affix|derivation)/i, /不添加任何词缀/, /超缀/],
    examples: ['email', 'ship', 'conversion', 'record'],
    answers: [/^superfix$/i],
  },
  suppletion: { patterns: [/异干/, /suppletion/i], examples: ['go', 'went', 'good', 'better'] },
  'internal-change': { patterns: [/内部屈折/, /元音变换/, /元音变音/, /ablaut/i, /umlaut/i], examples: ['sing', 'sang', 'foot', 'feet'] },
  reduplication: { patterns: [/重叠/, /reduplication/i], examples: ['bye-bye', 'zigzag', 'orang-orang'] },
  clipping: { patterns: [/截短/, /截尾/, /截首/, /clipping/i], examples: ['phone', 'gym', 'ad'] },
  blending: { patterns: [/混成/, /\bblend/i, /portmanteau/i], examples: ['smog', 'brunch'] },
  acronym: { patterns: [/首字母/, /缩略词/, /缩拼/, /\bacronym/i, /initialism/i], examples: ['NASA', 'CPU'] },
  'back-formation': { patterns: [/逆构词/, /back-formation/i], examples: ['edit', 'burgle', 'editor', 'burglar'] },
  conversion: {
    patterns: [/转类/, /零派生/, /零词缀/, /conversion/i, /名动同形/, /不添加任何词缀|改变词类/],
    examples: ['email', 'ship', 'record'],
  },
  reanalysis: {
    patterns: [/重新分析/, /再分析/, /reanalysis/i, /rebracketing/i, /agenda/],
    examples: ['goodbye', 'cockroach', 'agenda'],
  },
  'folk-etymology': { patterns: [/民间词源/, /folk etymology/i], examples: ['nickname', 'adder', 'female', 'shamefaced'] },
  analogy: { patterns: [/类推/, /analogy/i], examples: ['tweetophobia', '-bolic'] },
  'borrowing-strata': { patterns: [/借词层|三层|(本土|法语|拉丁)[^。]{0,12}(层|叠加)/, /borrowing/i, /loanword/i], examples: ['sky', 'egg', 'law', 'capital', 'chief'] },
  'semantic-change': {
    patterns: [/词义变化/, /语义变化/, /义变/, /semantic (change|shift)/i],
    examples: ['bead', 'cool', 'church', 'horse'],
  },
  grammaticalization: { patterns: [/语法化/, /grammaticalization/i], examples: ['be going to', 'gonna', 'while', 'very'] },
  typology: {
    patterns: [/形态类型学/, /孤立语(?!言)/, /黏着语/, /屈折语/, /多式综合/, /typolog/i],
    examples: ['汉语', '土耳其语', '拉丁', '因纽特语'],
  },
  'tree-diagram': {
    patterns: [/树形图/, /形态树/, /画成树/, /tree diagram/i, /括号切分/, /内部节点/],
    examples: ['unhelpfulness', 'helpful'],
  },
  'structural-ambiguity': {
    patterns: [/结构歧义/, /structural ambiguity/i, /两种(切分|意义)/, /都(合法|落在词素边界)/],
    examples: ['unlockable', 'undoable'],
  },
  case: {
    patterns: [/格(标记|变化|系统|位)/, /主格/, /宾格/, /属格/, /与格/, /夺格/, /呼格/, /拉丁[^。]{0,8}格/],
    examples: ['accusative', 'genitive', 'dative'],
  },
  agreement: { patterns: [/一致关系/, /三重一致/, /性数格/, /语法一致/], examples: ['bonus', 'bona', 'bonum'] },
  'tense-aspect': { patterns: [/时与体/, /时态/, /体标记/, /完成体/, /进行体/, /\btense\b/i, /\baspect\b/i], examples: ['walks', 'is walking', 'has walked'] },
  onomatopoeia: { patterns: [/拟声/, /声音象征/, /phonestheme/i, /onomatopoeia/i], examples: ['buzz', 'hiss', 'snap'] },
  eponym: { patterns: [/专名/, /商标/, /eponym/i, /genericiz/i], examples: ['algorithm', 'google', '-gate'] },
  metathesis: { patterns: [/音位置换/, /换位/, /metathesis/i], examples: ['brid', 'bird', 'through', 'ask'] },
  'spelling-pronunciation': {
    patterns: [/拼读式读音/, /拼读读音/, /spelling pronunciation/i, /按(拼写|字形)[^。]{0,8}(读|恢复)/],
    examples: ['often', 'waistcoat', 'forehead'],
    answers: [/^spelling$/i],
  },
  hypercorrection: {
    patterns: [/过度纠正/, /超外来/, /hypercorrect/i, /hyperforeign/i],
    examples: ['scissors', 'Celtic'],
  },
  bleaching: { patterns: [/语义漂白/, /漂白/, /bleaching/i], examples: ['literally', 'very', 'awfully'] },
};

function loadS2Concepts(root) {
  const file = path.join(root, 'analysis/textbook/s2-concepts.json');
  return JSON.parse(readFileSync(file, 'utf8')).concepts;
}

function auditS2(corpus, root) {
  const concepts = loadS2Concepts(root);
  // 0.8.0 used taught / partial / missing without the practice gate. "taught"
  // therefore maps onto "complete" for comparison; anything else is a real
  // change in verdict, not a renaming.
  const OLD = { taught: 'complete', partial: 'partial', missing: 'missing' };
  const items = concepts.map((c) => {
    const matcher = S2_MATCHERS[c.id];
    if (!matcher) throw new Error(`S2 concept "${c.id}" has no matcher; add one to S2_MATCHERS`);
    const out = evaluateConcept({ id: c.id, term: c.term, termZh: c.termZh, ...matcher }, corpus);
    return { ...out, oldStatus: c.status, oldMapped: OLD[c.status] ?? c.status };
  });
  const changes = items
    .filter((i) => i.oldMapped !== i.status)
    .map((i) => ({ id: i.id, termZh: i.termZh, from: i.oldMapped, oldRaw: i.oldStatus, to: i.status, evidence: i.evidence }));
  return {
    population: items.length,
    source: 'analysis/textbook/s2-concepts.json',
    ...tally(items),
    items,
    changes,
  };
}

/* ------------------------------------------------------------------ */
/* S1 knowledge points                                                 */
/* ------------------------------------------------------------------ */

function loadS1(root) {
  const coverage = JSON.parse(readFileSync(path.join(root, 'docs/coverage.json'), 'utf8'));
  return { knowledge: coverage.knowledge, lessons: coverage.curriculum?.lessons, weeks: coverage.curriculum?.weeks };
}

/**
 * Share of a kp title's *distinctive* characters present in a text, weighted by
 * inverse document frequency over the 283 titles. Chinese titles paraphrase the
 * cards instead of quoting them, so exact bigrams fail (a kp titled 「复合词内部
 * 关系多种多样」 maps to a card titled 「向心与离心」). Character recall with IDF
 * is the smallest signal that survives that paraphrase; it is calibrated against
 * the 30 hand-checked samples and the agreement rate is reported.
 */
const S1_STOP_CHARS = new Set('的了是在与和或及而被把对为以就其之也都不一个有这那个我你他她它们中上下里说会能可要'.split(''));

const cjkChars = (s) => Array.from((normalize(s).match(CJK_RUN) ?? []).join(''));

function buildIdf(titles) {
  const df = new Map();
  for (const title of titles) {
    for (const ch of new Set(cjkChars(title))) df.set(ch, (df.get(ch) ?? 0) + 1);
  }
  const idf = new Map();
  for (const [ch, n] of df) idf.set(ch, Math.log(titles.length / (1 + n)));
  return idf;
}

/**
 * Hand-verified practice anchors.
 *
 * Character recall is a paraphrase-tolerant matcher, but it fails the other way
 * too: a lesson can ask exactly the right thing in different words and score
 * below the 0.35 gate (「152 个单成分词」tests 「词汇丰富的两面性」with two shared
 * characters). For those points a human read the lesson, named the item that
 * asks the question, and wrote a `must` regex against the item's stem, options
 * and keyed answer — so the credit is falsifiable: if the item is edited to stop
 * asking the point, the regex no longer matches and the audit stops crediting it
 * (`gap-closure.test.ts` re-checks every entry against the corpus).
 *
 * This is a recognition rule, not a lower bar: the taught gate, the feedback
 * gate and the 0.35 recall path for every other exercise are untouched.
 */
export const S1_PRACTICE_ANCHORS = {
  'kp-s1c1s1-2': [
    { exerciseId: 'w31d2-p2', must: /单成分词|11\.6%/, note: 'p2 考代价一面（11.6% 不可拆），p1 考收益一面（精确＝近义词分工）' },
  ],
  'kp-s1c1s2-1': [{ exerciseId: 'w12d7-p2', must: /preclude/, note: '要求对没背过的词先做形态分析再查证，正是「以规则替代逐词记忆」' }],
  'kp-s1c1s4-2': [
    { exerciseId: 'w09d1-p5', must: /借来的词一定比本土词正式/, note: '直接反驳「借词更正式」，考的是语域由场合决定' },
    { exerciseId: 'w12d5-p6', must: /改写为论文表达/, note: '同一意思按语域改写，考的是选词而不只是认词' },
  ],
  'kp-s1c3s1-3': [{ exerciseId: 'w07d1-p2', must: /greenhouse 的意思/, note: 'greenhouse 不是「绿色的房子」，考部件给线索但不等于全义' }],
  'kp-s1c3s9-1': [
    { exerciseId: 'w03d4-p7', must: /semiconductor/, note: 'semi- 从「一半」到「介于之间」，考词素义随搭配环境专门化' },
  ],
  'kp-s1c3s9-2': [{ exerciseId: 'w36d3-p5', must: /义变/, note: '要求把具体义变归入隐喻/转喻，考「义变循可描述的规律」' }],
  'kp-s1c4s1-3': [{ exerciseId: 'w05d6-p5', must: /mit- 与 miss-/, note: '两套词干是拉丁事实、不是英语拼写规则，正是「变体的引用方式与误切分风险」' }],
  'kp-s1c5s1-1': [{ exerciseId: 'w23d1-p2', must: /被改变的特征/, note: 'im- 改的是部位（齿龈→双唇），考发音部位与方式这套描写' }],
  'kp-s1c5s6-3': [{ exerciseId: 'w23d7-p6', must: /唯一的中央元音|中央元音/, note: 'p2 只说明 -able/-ible 都含 schwa，没有考「唯一的中央元音」这层描写，故补 p6 并以它为准' }],
  'kp-s1c7s1-2': [{ exerciseId: 'w10d4-p5', must: /hound/, note: 'dog 泛化与 hound 窄化同时发生，考专门化与泛化可以双向' }],
  'kp-s1c7s9-1': [
    { exerciseId: 'w10d2-p1', must: /隐喻路径/, note: '相似类：grasp 的手→心智映射' },
    { exerciseId: 'w10d3-p1', must: /转喻/, note: '相关类：壶代壶里的水' },
  ],
  'kp-s1c7s10-2': [{ exerciseId: 'w10d2-p1', must: /grasp/, note: '具体域（手部抓取）到抽象域（理解）的迁移' }],
  'kp-s1c7s12-1': [{ exerciseId: 'w10d3-p3', must: /隐喻而不是转喻/, note: '判别标准题：先问是否跨域，再问能否改写为「像」' }],
  'kp-s1c8s2-4': [{ exerciseId: 'w24d5-p5', must: /sure 而不是 secure/, note: '同源双式词按语域分工，考「并存的变体可以分工」' }],
  'kp-s1c8s2-5': [{ exerciseId: 'w24d6-p4', must: /方言/, note: '语言/方言的分界＝互通度＋政治共同体，考「变体积淀即成新语言」' }],
  'kp-s1c8s3-2': [{ exerciseId: 'w24d7-p4', must: /prepone/, note: '印度英语按本地规则造词并在本地通行，考海外变体各自演变' }],
  'kp-s1c8s3-4': [{ exerciseId: 'w24d7-p5', must: /新加坡/, note: '本地规范 vs 国际期刊，考「世界语言身份埋下分裂种子」' }],
  'kp-s1c8s6-2': [{ exerciseId: 'w25d5-p5', must: /hopefully/, note: '曾被禁用、今属标准，考「非标准不等于无效、标准会移动」' }],
  'kp-s1c9s5-2': [
    { exerciseId: 'w14d4-p1', must: /-sc-/, note: '-sc- 起始体：开始发光' },
    { exerciseId: 'w14d4-p4', must: /-ta-/, note: '-ta- 反复体：agitator 的「反复」' },
  ],
  'kp-s1c10s7-2': [{ exerciseId: 'w29d1-p3', must: /fāgus|beech/, note: '用树名（山毛榉）推定温带林地，并提示证据强度' }],
  'kp-s1c10s7-3': [{ exerciseId: 'w29d2-p2', must: /轮、轴/, note: '轮轴轭驾成套 → 上限线索，考金属/船/农业/轮轴这批判据' }],
  'kp-s1c10s10-3': [{ exerciseId: 'w30d3-p1', must: /ferō/, note: 'bʰ 在拉丁变 f、在日耳曼变 b' }],
  'kp-s1c11s4-1': [{ exerciseId: 'w15d4-p2', must: /Caesar/, note: 'ae 在后世读作前元音，说明「拉丁读音传统远离古罗马」' }],
  'kp-s1c11s5-2': [{ exerciseId: 'w16d1-p2', must: /缩短/, note: '法语重音后移导致词形缩短，考「更常见的做法是削去词尾」' }],
  'kp-s1c11s6-3': [{ exerciseId: 'w16d4-p5', must: /noise/, note: '词形不透明所以不按 nausea 重拼，考「不重拼的另一个原因」' }],
};

/**
 * Teaching evidence overrides.
 *
 * The taught gate is aggregate on purpose (a point can be built across several
 * cards), but the pointer a reader clicks should be the card that names the
 * point. For four points the highest-recall card is a neighbouring idea with
 * shared characters, so the card that actually carries the explanation is named
 * here. Overrides change only `evidence.teaching`, never a verdict.
 */
export const S1_TEACHING_OVERRIDES = {
  'kp-s1c1s2-1': 'w12d7-c3', // 两种读词方式：只查词典 vs 先分析再查 —— 正是「以规则替代逐词记忆」
  'kp-s1c1s4-1': 'w07d5-c5', // 接受度：语言不看逻辑，看社区 —— 新词不是衰败
  'kp-s1c7s12-1': 'w10d3-c3', // 两步判断：这是隐喻还是转喻 —— 正是判别标准
  'kp-s1c9s5-2': 'w14d4-c2', // -sc- 起始体（c3 讲 -ta-、c4 讲鼻音中缀，三个子项各一张卡）
};

function titleRecall(title, text, idf) {
  const chars = [...new Set(cjkChars(title))].filter((c) => !S1_STOP_CHARS.has(c));
  if (chars.length === 0) return 0;
  let total = 0;
  let hit = 0;
  for (const ch of chars) {
    const weight = idf.get(ch) ?? 0;
    total += weight;
    if (text.includes(ch)) hit += weight;
  }
  return total === 0 ? 0 : hit / total;
}

function auditS1(corpus, root) {
  const { knowledge } = loadS1(root);
  const idf = buildIdf(knowledge.map((kp) => kp.title));
  const lessonsById = new Map(corpus.lessons.map((l) => [l.id, l]));
  const exercisesById = new Map(corpus.exercises.map((e) => [e.exerciseId, e]));

  const audit = knowledge.map((kp) => {
    const claimed = kp.claimedBy ?? [];
    const lessons = claimed.map((id) => lessonsById.get(id)).filter(Boolean);
    const cards = lessons.flatMap((l) => l.cards);
    const exercises = lessons.flatMap((l) => l.exercises);

    const relevant = cards
      .map((c) => ({ card: c, score: Number(titleRecall(kp.title, c.text, idf).toFixed(2)) }))
      .filter((x) => x.score >= 0.1)
      .sort((a, b) => b.score - a.score);
    const proseTotal = relevant.reduce((n, x) => n + x.card.proseLen, 0);
    const defined = relevant.some((x) => x.card.proseLen >= 80 && DEF_RE.test(x.card.body));
    const example = relevant.some((x) => hasExampleForm(x.card.text));
    const explained = relevant.length > 0 && (proseTotal >= CRITERIA.taughtChars || defined);
    const taught = explained && example;
    // Evidence must be the card a reader can check, so prefer the highest-recall
    // card that is itself substantial and carries an example, not merely the
    // card that shares the most characters.
    const substantial = (c) => (c.textLen >= CRITERIA.taughtChars && c.proseLen >= 60) || (c.proseLen >= CRITERIA.definitionChars && DEF_RE.test(c.body));
    const pinnedCard = S1_TEACHING_OVERRIDES[kp.id]
      ? cards.find((c) => c.cardId === S1_TEACHING_OVERRIDES[kp.id])
      : null;
    const anchor = pinnedCard
      ? { card: pinnedCard, score: Number(titleRecall(kp.title, pinnedCard.text, idf).toFixed(2)) }
      : relevant.find((x) => substantial(x.card) && hasExampleForm(x.card.text)) ?? relevant[0] ?? null;

    const scoredExercises = exercises
      .map((e) => ({ exercise: e, score: Number(titleRecall(kp.title, e.text, idf).toFixed(2)) }))
      .sort((a, b) => b.score - a.score);
    const byRecall = scoredExercises[0] && scoredExercises[0].score >= 0.35 ? scoredExercises[0] : null;
    // A hand-verified anchor wins over the recall path: it names the exercise
    // and the words that make the item ask the point, so it cannot drift.
    const anchored = (S1_PRACTICE_ANCHORS[kp.id] ?? [])
      .map((a) => ({ a, exercise: exercisesById.get(a.exerciseId) }))
      .find(({ a, exercise }) => exercise && a.must.test(exercise.promptText));
    const practice = anchored
      ? { exercise: anchored.exercise, score: 1, how: 'anchor' }
      : byRecall
        ? { exercise: byRecall.exercise, score: byRecall.score, how: 'recall' }
        : null;
    const feedback = Boolean(practice && practice.exercise.explain.length >= CRITERIA.feedbackChars);

    return {
      id: kp.id,
      title: kp.title,
      chapter: kp.chapter,
      status: classify(taught, Boolean(practice), feedback, explained),
      explained,
      taught,
      practiced: Boolean(practice),
      feedback,
      score: anchor ? anchor.score : 0,
      practiceScore: practice ? practice.score : 0,
      relevantCards: relevant.length,
      proseChars: proseTotal,
      evidence: {
        teaching: anchor
          ? {
              lessonId: anchor.card.lessonId,
              cardId: anchor.card.cardId,
              ...(pinnedCard ? { title: anchor.card.title } : { overlap: Number(anchor.score.toFixed(3)) }),
            }
          : null,
        practice: practice
          ? {
              lessonId: practice.exercise.lessonId,
              exerciseId: practice.exercise.exerciseId,
              kind: practice.exercise.kind,
              how: practice.how,
              ...(practice.how === 'recall' ? { overlap: Number(practice.score.toFixed(3)) } : {}),
            }
          : null,
      },
      claimedBy: claimed,
    };
  });

  const byChapter = {};
  for (const item of audit) {
    const key = item.chapter ?? 'unknown';
    byChapter[key] ??= { complete: 0, partial: 0, missing: 0 };
    byChapter[key][item.status] += 1;
  }

  return {
    population: audit.length,
    source: 'docs/coverage.json → knowledge[]（283 条，claimedBy 指向真实课时）',
    calibration: calibrateS1(audit, root),
    byChapter,
    ...tally(audit),
    items: audit,
  };
}

/** Compare the machine verdict with the 30 hand-checked samples from 0.8.0. */
function calibrateS1(audit, root) {
  const file = path.join(root, 'analysis/textbook/s1-sample-audit.json');
  if (!existsSync(file)) return { available: false };
  const samples = JSON.parse(readFileSync(file, 'utf8')).samples ?? [];
  const byId = new Map(audit.map((a) => [a.id, a]));
  const map = { pass: 'complete', partial: 'partial', fail: 'missing' };
  const disagreements = [];
  let agree = 0;
  for (const s of samples) {
    const got = byId.get(s.kp);
    if (!got) {
      disagreements.push({ kp: s.kp, expected: s.verdict, got: 'not-in-population' });
      continue;
    }
    if (got.status === map[s.verdict]) agree += 1;
    else disagreements.push({ kp: s.kp, title: s.title, expected: s.verdict, got: got.status, score: got.score });
  }
  return { available: true, total: samples.length, agree, rate: `${agree}/${samples.length}`, disagreements };
}

/* ------------------------------------------------------------------ */
/* S3 inquiry steps                                                    */
/* ------------------------------------------------------------------ */

const S3_STEPS = [
  {
    id: 'observe',
    stepZh: '观察',
    step: '观察并提出可追问的拼写现象',
    teach: [/先写下来/, /规则先由你写/, /观察/, /注意到/, /分组/],
    studentItem: (e) =>
      e.raw.__withheldRule === true && /规律|规则|分组|哪一条|哪条/.test(e.stemText + e.optionText) ? 2 : 0,
    note: '需要课时里有一张「先写下来 / 规则先由你写」的卡（课程不给结论），并有一题要求从数据里选/写规则。',
  },
  {
    id: 'hypothesis',
    stepZh: '假设',
    step: '提出可以检验的假设',
    teach: [/假设/, /判定依据/, /可检验/, /猜/],
    studentItem: (e) => (/哪一条规则(能|可)|可检验|先写(下)?(你|自己)的/.test(e.stemText) ? 3 : e.kind === 'judge' ? 2 : 0),
    note: 'judge 题型要求写出判定依据，或题干直接要求提出/选择一条可检验的规则。',
  },
  {
    id: 'verify',
    stepZh: '验证',
    step: '用证据检验假设',
    teach: [/验证/, /证据/, /三条判据/, /核验/, /反例/, /词典/, /语料库/],
    studentItem: (e) =>
      e.whyNot.length > 0 ? 4 : /反例|判据|怎么验证|哪条证据|最能说明|证据(链|是)/.test(e.stemText) ? 3 : e.kind === 'judge' ? 2 : 0,
    note: 'whyNot（逐项说明为什么不成立）或「哪条证据最能说明」类题，或 judge 题型。',
  },
  {
    id: 'matrix',
    stepZh: '矩阵',
    step: '画词矩阵',
    teach: [/矩阵/, /matrix/i],
    studentItem: (e) => (e.kind === 'matrix' ? 3 : 0),
    note: 'matrix 题型由学生自己填出合法格（base + prefix/suffix）。',
  },
  {
    id: 'wordSum',
    stepZh: 'Word Sum',
    step: '写 word sum',
    teach: [/word sum/i, /算式/, /词素\+|＋/, /切分/],
    studentItem: (e) => (e.kind === 'wordSum' ? 3 : 0),
    note: 'wordSum 题型由学生写出词素切分式。',
  },
];

function auditS3(corpus) {
  // Mark lessons whose cards explicitly withhold the rule until the student writes.
  const withheld = new Set();
  for (const l of corpus.lessons) {
    if (l.cards.some((c) => /先写下来|规则先由你写/.test(c.body))) withheld.add(l.id);
  }
  for (const e of corpus.exercises) e.raw.__withheldRule = withheld.has(e.lessonId);

  const items = S3_STEPS.map((step) => {
    const teachCards = corpus.cards.filter((c) => matchAny(c.text, step.teach));
    const scored = corpus.exercises
      .map((e) => ({ exercise: e, priority: step.studentItem(e) }))
      .filter((x) => x.priority > 0)
      .sort((a, b) => b.priority - a.priority || a.exercise.lessonId.localeCompare(b.exercise.lessonId));
    const studentItems = scored.map((x) => x.exercise);
    const taught = teachCards.length > 0;
    const practiced = studentItems.length > 0;
    const feedback = studentItems.some((e) => e.explain.length >= CRITERIA.feedbackChars || e.whyNot.length > 0);
    return {
      id: step.id,
      step: step.step,
      stepZh: step.stepZh,
      status: classify(taught, practiced, feedback),
      taught,
      practiced,
      feedback,
      studentItemCount: studentItems.length,
      studentKinds: [...new Set(studentItems.map((e) => e.kind))],
      criteria: step.note,
      evidence: {
        teaching: teachCards.slice(0, 3).map((c) => ({ lessonId: c.lessonId, cardId: c.cardId, title: c.title })),
        student: studentItems.slice(0, 3).map((e) => ({ lessonId: e.lessonId, exerciseId: e.exerciseId, kind: e.kind })),
      },
    };
  });

  const byKind = {};
  for (const e of corpus.exercises) byKind[e.kind] = (byKind[e.kind] ?? 0) + 1;
  const produced = ['wordSum', 'matrix', 'boundary', 'judge'].reduce((n, k) => n + (byKind[k] ?? 0), 0);

  return {
    population: items.length,
    source: 'S3 WordWorks / SWI inquiry cycle（analysis/textbook/s3-swi.json 的五步）',
    ...tally(items),
    steps: items,
    tooling: {
      exercises: corpus.exercises.length,
      byKind,
      producedItems: produced,
      producedShare: `${produced}/${corpus.exercises.length} = ${((produced / corpus.exercises.length) * 100).toFixed(1)}%`,
    },
    caveat: 'S3 的「观察」判定的是「从课程给出的数据里自己归纳」，不是「学生自选真实语料」。现象仍由课程挑选，这一点写在 steps.observe.note 里。',
  };
}

/* ------------------------------------------------------------------ */
/* S4 historical topics and dated claims                               */
/* ------------------------------------------------------------------ */

const ISOLATION_STRONG = [
  '教材说法',
  '教材的推断',
  '教材由此给出',
  '教材约定',
  '教材的编排约定',
  '传统叙述',
  '不是定论',
  '不是硬约束',
  '有争议',
  '一种解释模型',
  '无法证明',
  '不是自然事实',
  '叙述工具',
  '不是事实边界',
  '不是全集',
  '描述性概括',
  '已被抛弃',
  '教学隐喻',
  '只是线索',
  '上限线索',
  '不单独证明',
  '不是判决',
  '不能由',
  '不等于',
  '不是最早的一次谱系分裂',
  '拼写不决定读音',
  '拼写.{0,4}不决定读音',
  '不是规律失效',
  '音值不确定',
  '不确定读音',
  '音值仍然不明',
  '音值不明',
  '不记录音值',
  '不给(你)?唯一答案',
  '不是唯一答案',
  '候选路径',
  '相符',
];

const S4_TOPIC_CUES = {
  grimm: /格里姆|Grimm|辅音推移|pater|father/,
  verner: /维尔纳|Verner/,
  'chain-shift': /链移|推链|chain shift/i,
  gvs: /元音大推移|Great Vowel Shift|上移|高化/,
  asterisk: /星号|构拟|reconstruct/i,
  laryngeal: /喉音|laryngeal/i,
  'centum-satem': /centum|satem|腭化|谱系分裂|地域扩散/i,
  homeland: /故乡|库尔干|草原假说|安纳托利亚假说|kurgan/i,
  'palaeo-lexicon': /考古|古 DNA|轮车|铁|bear|词表/,
  'branch-count': /十三|分支/,
  periodization: /三分期|古英语|中古英语|现代英语/,
  'anglo-saxon': /盎格鲁|撒克逊|449/,
  'loan-strata': /三层|借词层|法语|拉丁/,
  'latin-pronunciation': /拉丁[^。]{0,6}读|复原读音|拼读|Celtic/,
  typology: /类型学|孤立语|黏着语|屈折语|多式综合/,
  'semantic-regularity': /义变|词义变化|规律/,
};

const S4_CLAIM_CUES = {
  'oc-centum': /谱系分裂|地域扩散|等语线|centum|satem/i,
  'oc-kurgan': /三波|入侵|取代|定论|古 DNA|主流/,
  'oc-threelayer': /三层|全集/,
  'oc-wheel-date': /硬约束|上限|轮车|Wanderwort|上限线索/i,
  'oc-iron-date': /教材的推断|教材说法|缺词|铁/,
  'oc-typology': /描述性概括|优劣|已被抛弃|19 世纪/,
  'oc-gvs-uniform': /教学隐喻|地域差|时间差|争议|一格/,
};

function isolationOf(cards, cue) {
  const cueCards = cards.filter((c) => cue.test(c.text));
  const strong = [];
  const weak = [];
  for (const c of cueCards) {
    for (const marker of ISOLATION_STRONG) {
      if (c.text.includes(marker)) strong.push({ cardId: c.cardId, marker });
    }
  }
  if (strong.length) {
    const byCard = new Map();
    for (const hit of strong) byCard.set(hit.cardId, (byCard.get(hit.cardId) ?? 0) + 1);
    const ordered = [...cueCards].sort((a, b) => (byCard.get(b.cardId) ?? 0) - (byCard.get(a.cardId) ?? 0));
    return { level: 'explicit', cards: ordered, markers: dedupe(strong) };
  }
  for (const c of cueCards) {
    for (const marker of ['教材', '主流', '假说', '传统叙述', '约定', '推测']) {
      if (c.text.includes(marker)) weak.push({ cardId: c.cardId, marker });
    }
  }
  if (weak.length) return { level: 'partial', cards: cueCards, markers: dedupe(weak) };
  return { level: 'none', cards: cueCards, markers: [] };
}

const dedupe = (list) => {
  const seen = new Set();
  return list.filter((x) => {
    const k = `${x.cardId}|${x.marker}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
};

const lessonsOf = (corpus, ids) => corpus.lessons.filter((l) => ids.includes(l.id));
const cardsOf = (corpus, ids) => lessonsOf(corpus, ids).flatMap((l) => l.cards);

const lessonIdsIn = (text) => [...new Set(String(text ?? '').match(/w\d{2}d\d+/g) ?? [])];

function auditS4(corpus, root) {
  const file = path.join(root, 'analysis/textbook/s4-history.json');
  const s4 = JSON.parse(readFileSync(file, 'utf8'));

  const inventory = s4.inventory.map((item) => {
    const cue = S4_TOPIC_CUES[item.id];
    if (!cue) throw new Error(`S4 topic "${item.id}" has no cue; add one to S4_TOPIC_CUES`);
    const cards = cardsOf(corpus, item.lessons);
    const iso = isolationOf(cards, cue);
    return {
      id: item.id,
      topicZh: item.topicZh,
      status: item.status,
      taught: iso.cards.length > 0,
      isolation: iso.level,
      oldIsolation: item.isolation,
      lessons: item.lessons,
      evidence: iso.markers.slice(0, 3),
      cardIds: iso.cards.slice(0, 3).map((c) => c.cardId),
    };
  });

  const claims = s4.outdatedClaims.map((claim) => {
    const cue = S4_CLAIM_CUES[claim.id];
    if (!cue) throw new Error(`S4 claim "${claim.id}" has no cue; add one to S4_CLAIM_CUES`);
    const lessons = lessonIdsIn(claim.where);
    const cards = cardsOf(corpus, lessons);
    const iso = isolationOf(cards, cue);
    return {
      id: claim.id,
      claim: claim.claim,
      lessons,
      isolation: iso.level,
      evidence: iso.markers.slice(0, 3),
      cardIds: iso.cards.slice(0, 3).map((c) => c.cardId),
    };
  });

  const obsolete = JSON.parse(readFileSync(path.join(root, 'src/content/textbook/s4-elements.json'), 'utf8')).elements.filter((e) => e.obsolete);
  const LEAK_TESTS = {
    's4-prefix-dis-2': [/dis-\s*(=|＝|表示)\s*(二|two|double)/i, /dis-\s*[（(]\s*(二|two)/i],
    's4-prefix-n': [/(?<![a-z])n-\s*(是|为|表示)?\s*(否定|negative)/i],
    's4-suffix-fold': [/-fold[^。]{0,24}plico/i],
    's4-suffix-hood': [/-hood[^。]{0,24}(来源不明|来源未知|不确定)/],
    's4-suffix-ic': [/-ic[^。]{0,24}只(见|限)[^。]{0,8}希腊/],
    's4-suffix-ics': [/-ics[^。]{0,24}只(见|限)[^。]{0,8}希腊/],
    's4-suffix-ish': [/-ish[^。]{0,24}(to make|使[^。]{0,4}成为)/i],
  };
  const leaks = obsolete
    .map((el) => {
      const tests = LEAK_TESTS[el.id] ?? [];
      const hits = [];
      for (const card of corpus.cards) {
        for (const re of tests) {
          if (re.test(card.text)) hits.push({ cardId: card.cardId, pattern: String(re) });
        }
      }
      return { id: el.id, element: el.element, wrongGloss: el.gloss, hits };
    })
    .filter((x) => x.hits.length > 0);

  return {
    population: inventory.length,
    claimsPopulation: claims.length,
    source: 'analysis/textbook/s4-history.json + src/content/textbook/s4-elements.json（obsolete:true）',
    ...tally(inventory.map((i) => ({ status: i.taught ? (i.isolation === 'explicit' ? 'complete' : i.isolation === 'partial' ? 'partial' : 'missing') : 'missing' }))),
    inventory,
    claims,
    claimsSummary: claims.reduce((acc, c) => ({ ...acc, [c.isolation]: (acc[c.isolation] ?? 0) + 1 }), {}),
    leakCheck: { obsolete: obsolete.length, leaks },
  };
}

/* ------------------------------------------------------------------ */
/* tallies and conflicts                                               */
/* ------------------------------------------------------------------ */

function tally(items) {
  const out = { complete: 0, partial: 0, missing: 0 };
  for (const i of items) out[i.status] += 1;
  return out;
}

export function buildAudit({ root = ROOT } = {}) {
  const corpus = loadCorpus(root);
  const s1 = auditS1(corpus, root);
  const s2 = auditS2(corpus, root);
  const s3 = auditS3(corpus);
  const s4 = auditS4(corpus, root);

  const payload = {
    generatedAt: new Date().toISOString(),
    command: 'node scripts/audit-textbook.mjs',
    criteria: CRITERIA,
    corpus: {
      weeks: corpus.weeks,
      lessons: corpus.lessons.length,
      cards: corpus.cards.length,
      exercises: corpus.exercises.length,
    },
    groups: { S1: s1, S2: s2, S3: s3, S4: s4 },
    conflicts: collectConflicts({ s1, s2, s3, s4 }),
  };
  payload.digest = digestOf(payload);
  return payload;
}

function collectConflicts({ s1, s2, s3, s4 }) {
  const out = [];
  const S2_WHY = {
    morphology: '新口径要求讲解卡出现例词；w32d4-c1 只给了一句定义，例词是音系学的 cats / dogs，旧报告按「讲过这个学科名」记 taught',
    selection: '新口径要求题干或选项点名该点；w38d3 的 judge 题虽要动用宿主条件，但没有一题点名，旧报告按「相关题」记 taught',
    hypercorrection: '新口径要求题干或选项点名该点；w16d3-p2 只在解析里写「过度纠正」，旧报告按「解析提到」记 taught',
  };
  for (const p of s2.changes) {
    const fixed = ['dvandva', 'grammaticalization', 'spelling-pronunciation', 'blocking', 'reduplication', 'typology', 'tree-diagram', 'structural-ambiguity', 'tense-aspect', 'metathesis'].includes(p.id);
    out.push({
      group: 'S2',
      item: p.id,
      old: p.oldRaw,
      now: p.to,
      why: fixed ? '0.9.1（commit d14a162）补了正文 / 例词 / 练习，脚本按当前内容重判' : S2_WHY[p.id],
      evidence: p.evidence,
    });
  }
  const changedS3 = s3.steps.filter((s) => {
    const old = { observe: 'partial', hypothesis: 'complete', verify: 'complete', matrix: 'complete', wordSum: 'complete' }[s.id];
    return old !== s.status;
  });
  for (const s of changedS3) {
    out.push({ group: 'S3', item: s.id, old: 'partial', now: s.status, why: '0.9.1 在 w38d1 加了「规则先由你写 → 反例推翻」的探究环', evidence: s.evidence.student[0] ?? null });
  }
  for (const c of s4.claims) {
    if (c.isolation === 'explicit' && ['oc-iron-date', 'oc-wheel-date', 'oc-typology', 'oc-gvs-uniform'].includes(c.id)) {
      out.push({ group: 'S4', item: c.id, old: 'none/partial', now: 'explicit', why: '0.9.1 改写为「教材说法 / 证据等级」并补了检测题', evidence: c.evidence[0] ?? null });
    }
  }
  const s1Sample = s1.calibration;
  if (s1Sample.available) {
    out.push({
      group: 'S1',
      item: 'sample-vs-population',
      old: '30 个抽样人工判定：27 pass / 3 partial / 0 fail',
      now: `全量 283 条：${s1.complete} complete / ${s1.partial} partial / ${s1.missing} missing；与抽样一致 ${s1Sample.rate}`,
      why: '旧报告只抽样 30 条；本脚本对 283 条全量重算，并保留抽样一致性作为校准',
      evidence: null,
    });
  }
  return out;
}

function digestOf(payload) {
  const rest = { ...payload };
  delete rest.generatedAt;
  delete rest.digest;
  return `sha256:${createHash('sha256').update(JSON.stringify(rest)).digest('hex').slice(0, 16)}`;
}

/* ------------------------------------------------------------------ */
/* markdown rendering                                                  */
/* ------------------------------------------------------------------ */

const pct = (n, d) => `${n}/${d} = ${((n / d) * 100).toFixed(1)}%`;
const statusCell = (g) => `**${g.complete}** / ${g.partial} / ${g.missing}`;
const fmtEvidence = (e) => (e ? Object.values(e).filter((v) => typeof v === 'string').join(' · ') : '—');

function renderS234(payload) {
  const { corpus, groups, digest } = payload;
  const { S1, S2, S3, S4 } = groups;
  const lines = [];
  lines.push('# 四组教材的教学覆盖审计（由脚本生成）');
  lines.push('');
  lines.push('<!-- 本文件由 `node scripts/audit-textbook.mjs` 生成，请勿手改；改口径请改脚本后重跑。 -->');
  lines.push(`<!-- audit-digest: ${digest} -->`);
  lines.push('');
  lines.push(`审计对象：\`src/content/weeks/week01..week39\`，**${corpus.lessons} 节课 / ${corpus.cards} 张卡 / ${corpus.exercises} 道练习**。`);
  lines.push('');
  lines.push('判定口径（三段式，四组共用）：');
  lines.push('');
  lines.push('| 门槛 | 机器判定 |');
  lines.push('| --- | --- |');
  lines.push(`| taught | ${CRITERIA.taught} |`);
  lines.push(`| practiced | ${CRITERIA.practiced} |`);
  lines.push(`| feedback | ${CRITERIA.feedback} |`);
  lines.push('');
  lines.push('**complete** = 三者齐；**partial** = 有讲解，但缺例词、或缺定点练习、或缺解析；**missing** = 正文没有讲解。术语表（`card.terms`）不计入讲解；只在解析里提一句不算 practiced；题干里有词、但题目问的是别的事，也不算。');
  lines.push('');
  lines.push('## 总览');
  lines.push('');
  lines.push('| 教材 | 总体 | complete / partial / missing | 教学覆盖率 |');
  lines.push('| --- | --- | --- | --- |');
  lines.push(`| S1 *English Vocabulary Elements* (3e) | ${S1.population} 个知识点（全量） | ${statusCell(S1)} | ${pct(S1.complete, S1.population)} |`);
  lines.push(`| S2 *Essentials of Linguistics* (2e) | ${S2.population} 个概念 | ${statusCell(S2)} | ${pct(S2.complete, S2.population)} |`);
  lines.push(`| S3 WordWorks（SWI） | ${S3.population} 个环节 | ${statusCell(S3)} | ${pct(S3.complete, S3.population)} |`);
  lines.push(`| S4 *New Word-Analysis* (1879) | ${S4.population} 项内容 + ${S4.claimsPopulation} 条旧说 | ${statusCell(S4)} | ${pct(S4.complete, S4.population)} |`);
  lines.push('');
  lines.push('S4 的 complete 表示「内容教到且旧说已显式隔离」；隔离档位另见第四节。');
  lines.push('');
  lines.push('## 一、S1：283 个知识点的全量判定');
  lines.push('');
  lines.push('口径说明：S1 的知识点只有中文标题、没有统一概念名。脚本用「标题的**区别性汉字**在卡片正文中的覆盖比例」锁定讲解卡（汉字按 283 个标题的 IDF 加权，覆盖 ≥0.10 视为相关卡），再要求相关正文合计 ≥120 字且出现例词；练习用同一比例，≥0.35 才算练到。这是全量机器统计，不是人工逐条核对，误差见下方抽样校准。');
  lines.push('');
  lines.push('| 章 | complete | partial | missing |');
  lines.push('| --- | --- | --- | --- |');
  for (const [ch, v] of Object.entries(S1.byChapter).sort()) {
    lines.push(`| ${ch} | ${v.complete} | ${v.partial} | ${v.missing} |`);
  }
  lines.push('');
  if (S1.calibration.available) {
    lines.push(`**与 0.8.0 的 30 条人工抽样对照**：一致 ${S1.calibration.rate}。不一致条目：`);
    lines.push('');
    if (S1.calibration.disagreements.length === 0) {
      lines.push('- 无');
    } else {
      for (const d of S1.calibration.disagreements) lines.push(`- ${d.kp}${d.title ? `（${d.title}）` : ''}：人工 ${d.expected} → 脚本 ${d.got}（overlap ${d.score}）`);
    }
    lines.push('');
    lines.push('三处不一致都是「0.8.0 人工判 partial → 现在 complete」：抽样是旧内容的快照，不是当前口径的判决。kp-s1c5s6-1 与 kp-s1c8s8-3 是补了定点练习（w23d6-p6、w07d5-p7）；kp-s1c2s8-4 是覆盖率口径的已知误报——它含两个并列子项（诺斯借词 / 同源双式词），前半被练到就拉高了整条标题的覆盖率，这条至今仍是机器高估，不是补出来的。');
    lines.push('');
  }
  const s1Missing = S1.items.filter((i) => i.status !== 'complete');
  lines.push(`**非 complete 的 ${s1Missing.length} 条**（完整清单见 \`docs/textbook-audit.json\`）：`);
  lines.push('');
  if (s1Missing.length === 0) {
    lines.push('- 无');
  } else {
    lines.push('| 知识点 | 章 | 判定 | 讲解证据 | 练习证据 |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const i of s1Missing.slice(0, 20)) {
      lines.push(`| ${i.title} | ${i.chapter} | ${i.status} | ${fmtEvidence(i.evidence.teaching)} | ${fmtEvidence(i.evidence.practice)} |`);
    }
  }
  lines.push('');
  lines.push('0.9.2 的缺口归因与处理（逐条见 docs/GAP_CLOSURE.md）：41 条 partial 中 23 条是「有题但审计没识别」——题干换了说法，字符覆盖率到不了 0.35（例如「152 个单成分词」考「词汇丰富的两面性」）；这 23 条由 S1_PRACTICE_ANCHORS 人工登记（另有 2 条新增练习的覆盖口径低于 0.35，也用锚点登记），每条锚点带一个 must 正则，必须命中该题的题干/选项/答案，题被改写就不再计分（gap-closure.test.ts 逐条复核）。14 条真正缺定点练习，补了 13 道原创题（w07d5 的两条共用一个判断）；4 条正文没讲到（三阶段框架、四重收益、借词层音系规则、单音节词根的两种命运），补正文并各补一道题。S1 共补 17 道题、4 张新卡、2 处正文补句。evidence.practice.how 标出该条走的是 anchor 还是 recall；evidence.teaching 指向讲解该点的实质卡（4 条由 S1_TEACHING_OVERRIDES 指定，因为最高覆盖率的卡是邻近概念）。');
  lines.push('');
  lines.push('## 二、S2：43 个概念');
  lines.push('');
  lines.push('| 概念 | 判定 | 讲解证据 | 练习证据 | 旧判定 |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const c of S2.items) {
    lines.push(`| ${c.termZh}（${c.term}） | ${c.status} | ${fmtEvidence(c.evidence.teaching)} | ${fmtEvidence(c.evidence.practice)} | ${c.oldStatus} |`);
  }
  lines.push('');
  lines.push(`**判定发生变化的 ${S2.changes.length} 条**（旧报告的 taught 不分「有例词 / 有定点练习」，新口径把它拆成 complete 与 partial）：`);
  lines.push('');
  if (S2.changes.length === 0) lines.push('- 无');
  for (const p of S2.changes) {
    lines.push(`- ${p.termZh}（${p.id}）：旧 ${p.oldRaw} → **${p.to}**，讲解 ${fmtEvidence(p.evidence.teaching)}，练习 ${fmtEvidence(p.evidence.practice)}`);
  }
  lines.push('');
  const s2Left = S2.items.filter((c) => c.status !== 'complete');
  lines.push(`**仍未 complete 的概念（${s2Left.length}）**：`);
  lines.push('');
  if (s2Left.length === 0) {
    lines.push('- 无');
  } else {
    for (const c of s2Left) {
      const missingGates = [!c.explained && '无正文讲解', c.explained && !c.taught && '讲解缺例词', !c.practiced && '无针对性练习', c.practiced && !c.feedback && '练习无解析'].filter(Boolean);
      lines.push(`- ${c.termZh}（${c.id}）：${missingGates.join(' / ')}；最近命中 ${fmtEvidence(c.nearMisses[0] ?? null)}`);
    }
    lines.push('');
    lines.push('0.9.2 处理（逐条见 `docs/GAP_CLOSURE.md`）：`morphology` 补形态学自己的例词（teachers、unkind、table，w32d4-c1）；`selection` 是匹配缺陷——w38d3-p4 的选项原文是「-ness 的宿主必须是形容词或分词」，`宿主(必须)` 不在原正则里，改 `S2_MATCHERS.selection` 后该题即被识别；`hypercorrection` 补了一道正面判别的题（scissors 的 sc- 与 debt 的 b，w16d3-p6），不再只靠解析提一句。');
  }
  lines.push('');
  lines.push('## 三、S3：SWI 五步');
  lines.push('');
  lines.push('| 环节 | 判定 | 学生动手题 | 题量/题型 | 说明 |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const s of S3.steps) {
    lines.push(`| ${s.stepZh} | ${s.status} | ${fmtEvidence(s.evidence.student[0] ?? null)} | ${s.studentItemCount} 道（${s.studentKinds.join('/') || '—'}） | ${s.criteria} |`);
  }
  lines.push('');
  lines.push(`产出型题型合计 **${S3.tooling.producedShare}**（wordSum ${S3.tooling.byKind.wordSum ?? 0} / matrix ${S3.tooling.byKind.matrix ?? 0} / boundary ${S3.tooling.byKind.boundary ?? 0} / judge ${S3.tooling.byKind.judge ?? 0}）。`);
  lines.push('');
  lines.push('五步现在都有「学生自己动手」的题，但**观察一步只有 1 道**（w38d1-p6）：课程给出六条 -ed 读音数据、要求先写规则再翻页，第 6 题再从四条候选规则里选能同时解释数据的那条。现象仍由课程挑选，学生做的是「从给定数据归纳」，不是「从真实语料里发现问题」。');
  lines.push('');

  lines.push('## 四、S4：16 项历史内容 + 7 条旧说');
  lines.push('');
  lines.push('| 内容 | 旧说等级 | 隔离 | 证据（标记） |');
  lines.push('| --- | --- | --- | --- |');
  for (const i of S4.inventory) {
    lines.push(`| ${i.topicZh} | ${i.status} | ${i.isolation} | ${i.evidence.map((e) => `「${e.marker}」@${e.cardId}`).join('；') || '—'} |`);
  }
  lines.push('');
  lines.push('| # | 旧说 | 位置 | 隔离 | 证据 |');
  lines.push('| --- | --- | --- | --- | --- |');
  S4.claims.forEach((c, i) => {
    lines.push(`| ${i + 1} | ${c.claim} | ${c.lessons.join(', ')} | ${c.isolation} | ${c.evidence.map((e) => `「${e.marker}」@${e.cardId}`).join('；') || '—'} |`);
  });
  lines.push('');
  lines.push(`旧说隔离分布：${Object.entries(S4.claimsSummary).map(([k, v]) => `${k} ${v}`).join(' / ')}。`);
  lines.push('');
  lines.push('**泄漏检查**：`s4-elements.json` 中标 `obsolete:true` 的条目共 ' + S4.leakCheck.obsolete + ' 条，按旧义教学的模式命中 ' + S4.leakCheck.leaks.length + ' 处。');
  if (S4.leakCheck.leaks.length) {
    for (const l of S4.leakCheck.leaks) lines.push(`- ${l.element}（${l.id}）：${l.hits.map((h) => h.cardId).join(', ')}`);
  }
  lines.push('');
  lines.push('## 五、脚本与旧报告的冲突');
  lines.push('');
  lines.push('| 组 | 条目 | 旧报告 | 当前 | 原因 |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const c of payload.conflicts) {
    lines.push(`| ${c.group} | ${c.item} | ${c.old} | ${c.now} | ${c.why} |`);
  }
  lines.push('');
  lines.push('## 复现');
  lines.push('');
  lines.push('```bash');
  lines.push('node scripts/audit-textbook.mjs');
  lines.push('node scripts/audit-textbook.mjs --check');
  lines.push('npx vitest run src/lib/textbook-audit.test.ts');
  lines.push('```');
  lines.push('');
  lines.push('`--check` 会重算整份 JSON 并比对 `docs/textbook-audit.json` 与本文件的 digest；数据或报告过期即非零退出。');
  lines.push('');
  lines.push(`每项的 \`evidence\` 都带 \`lessonId\` 与 \`cardId\`/\`exerciseId\`，可直接按 \`weekNN/dayN.json\` 抽样复核。`);
  return `${lines.join('\n')}\n`;
}

function renderCoverage(payload) {
  const { corpus, groups, digest } = payload;
  const { S1, S2, S3, S4 } = groups;
  const lines = [];
  lines.push('# 教材覆盖数据（机器可读摘要）');
  lines.push('');
  lines.push('<!-- 本文件由 `node scripts/audit-textbook.mjs` 生成，请勿手改。 -->');
  lines.push(`<!-- audit-digest: ${digest} -->`);
  lines.push('');
  lines.push(`课程规模：${corpus.lessons} 课时 / ${corpus.cards} 卡 / ${corpus.exercises} 练习。完整逐项证据见 \`docs/textbook-audit.json\`，叙述版见 \`docs/TEXTBOOK_S2_S3_S4.md\`。`);
  lines.push('');
  lines.push('| 组 | population | complete | partial | missing | rate |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const [name, g] of Object.entries({ S1, S2, S3, S4 })) {
    lines.push(`| ${name} | ${g.population} | ${g.complete} | ${g.partial} | ${g.missing} | ${pct(g.complete, g.population)} |`);
  }
  lines.push('');
  lines.push('## 非 complete 条目');
  lines.push('');
  lines.push('| 组 | 条目 | 判定 | 缺什么 |');
  lines.push('| --- | --- | --- | --- |');
  for (const i of S1.items.filter((x) => x.status !== 'complete')) {
    lines.push(`| S1 | ${i.id} ${i.title} | ${i.status} | ${[!i.taught && '讲解', !i.practiced && '练习', i.practiced && !i.feedback && '解析'].filter(Boolean).join('、')} |`);
  }
  for (const c of S2.items.filter((x) => x.status !== 'complete')) {
    lines.push(`| S2 | ${c.id} ${c.termZh} | ${c.status} | ${[!c.taught && '讲解', !c.practiced && '练习', c.practiced && !c.feedback && '解析'].filter(Boolean).join('、')} |`);
  }
  for (const s of S3.steps.filter((x) => x.status !== 'complete')) {
    lines.push(`| S3 | ${s.id} ${s.stepZh} | ${s.status} | ${[!s.taught && '讲解', !s.practiced && '学生动手题', s.practiced && !s.feedback && '解析'].filter(Boolean).join('、')} |`);
  }
  for (const i of S4.inventory.filter((x) => x.isolation !== 'explicit')) {
    lines.push(`| S4 | ${i.id} ${i.topicZh} | ${i.isolation} | 隔离标记 |`);
  }
  for (const c of S4.claims.filter((x) => x.isolation !== 'explicit')) {
    lines.push(`| S4-claim | ${c.id} | ${c.isolation} | 隔离标记 |`);
  }
  lines.push('');
  lines.push('## S2 状态变化');
  lines.push('');
  if (S2.changes.length === 0) lines.push('- 无');
  for (const p of S2.changes) lines.push(`- ${p.id}：${p.from} → ${p.to}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

/* ------------------------------------------------------------------ */
/* check mode                                                          */
/* ------------------------------------------------------------------ */

function fail(msg) {
  console.error(`audit-textbook: ${msg}`);
  process.exit(1);
}

function runCheck(payload) {
  if (!existsSync(path.join(ROOT, AUDIT_JSON))) fail(`${AUDIT_JSON} missing; run the script without --check first`);
  const disk = JSON.parse(readFileSync(path.join(ROOT, AUDIT_JSON), 'utf8'));
  const clean = (p) => {
    const rest = { ...p };
    delete rest.generatedAt;
    delete rest.digest;
    return JSON.stringify(rest, null, 2);
  };
  if (clean(disk) !== clean(payload)) fail(`${AUDIT_JSON} is stale; re-run node scripts/audit-textbook.mjs`);
  for (const [file, render] of [
    [COVERAGE_MD, renderCoverage],
    [S234_MD, renderS234],
  ]) {
    const abs = path.join(ROOT, file);
    if (!existsSync(abs)) fail(`${file} missing`);
    const text = readFileSync(abs, 'utf8');
    if (!text.includes(`<!-- audit-digest: ${payload.digest} -->`)) fail(`${file} digest mismatch; re-run without --check`);
    const expected = render(payload);
    if (text !== expected) fail(`${file} content mismatch; re-run without --check`);
  }
  console.log(`audit-textbook: ok — ${AUDIT_JSON} + 2 reports match ${payload.corpus.lessons} lessons (${payload.digest})`);
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const payload = buildAudit();
  if (process.argv.includes('--check')) {
    runCheck(payload);
  } else {
    writeFileSync(path.join(ROOT, AUDIT_JSON), `${JSON.stringify(payload, null, 2)}\n`);
    writeFileSync(path.join(ROOT, COVERAGE_MD), renderCoverage(payload));
    writeFileSync(path.join(ROOT, S234_MD), renderS234(payload));
    const { S1, S2, S3, S4 } = payload.groups;
    console.log('group  complete  partial  missing   rate');
    for (const [name, g] of Object.entries({ S1, S2, S3, S4 })) {
      console.log(`${name.padEnd(6)} ${String(g.complete).padStart(8)} ${String(g.partial).padStart(8)} ${String(g.missing).padStart(8)}   ${pct(g.complete, g.population)}`);
    }
    console.log(`wrote ${AUDIT_JSON}, ${COVERAGE_MD}, ${S234_MD} (${payload.digest})`);
  }
}
