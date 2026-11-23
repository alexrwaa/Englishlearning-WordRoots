/**
 * Word Sum grading (0.12.0): rules instead of "looks the same".
 *
 * The previous grader normalised every doubled letter away
 * (`part.replace(/(.)\1+/g, '$1')`), which made `press` and `pres` the same
 * string. A learner who dropped a letter at the seam therefore passed, and the
 * app could not tell a legitimate orthographic adjustment (create + ion →
 * creation) from a plain misspelling.
 *
 * Grading here is deliberately narrow. Only five named rules may change a
 * letter, each with a stated condition, an example and a counterexample; every
 * other character must match exactly. A rule may only *add* a letter where the
 * spelling genuinely does so: doubling is licensed from `admit` to `admitt`,
 * never from `press` back to `pres`, because un-doubling is a deletion and no
 * English rule licenses it.
 *
 * The verdict separates three questions that used to be one boolean:
 *
 *   - structure: did the learner identify the same morphemes, in the same order?
 *   - spelling:  is the surface string canonical, a licensed variant, or wrong?
 *   - unresolved: we cannot know (empty answer, part not in the lexicon, a
 *     difference too large to attribute to spelling). We say so instead of
 *     guessing, and an unresolved answer never passes.
 *
 * Pure: no imports, no lexicon, no I/O.
 */

export type RuleId =
  | 'e-drop'
  | 'y-to-i'
  | 'consonant-doubling'
  | 'assimilation'
  | 'connective-vowel';

export type SumStructure = 'correct' | 'incorrect' | 'unresolved';
export type SumSpelling = 'canonical' | 'licensed-variant' | 'misspelled' | 'unknown';

export interface SumVerdict {
  structure: SumStructure;
  spelling: SumSpelling;
  /** Rules that actually fired, e.g. ['e-drop']. Empty when nothing changed. */
  ruleIds: RuleId[];
  /** Learner-facing explanation, in Chinese. */
  note: string;
  /** The forms the comparison actually used (reference spelling where licensed). */
  normalized: string[];
  /** True only for correct structure + canonical or licensed spelling. */
  ok: boolean;
}

export interface SumOptions {
  /**
   * Optional probe into the morpheme lexicon. When it answers false for a part
   * the learner wrote, we refuse to call that part a misspelling: a word missing
   * from our lexicon is not evidence of a wrong word. The verdict becomes
   * `unresolved` instead.
   */
  known?: (part: string) => boolean;
}

/* --------------------------------- pieces --------------------------------- */

/** Split "in + spect + ion" style strings into parts, dropping arrows/spaces. */
export function splitSum(sum: string): string[] {
  return sum
    .split(/[+\-–—>→]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/** Morpheme-boundary notation ("in-", "-tion") is not spelling. */
function cleanPart(part: string): string {
  return part.trim().toLowerCase().replace(/^[-–—]+/, '').replace(/[-–—]+$/, '');
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

function isVowelLetter(ch: string | undefined): boolean {
  return ch !== undefined && VOWELS.has(ch);
}

function isConsonantLetter(ch: string | undefined): boolean {
  return ch !== undefined && /[a-z]/.test(ch) && !VOWELS.has(ch);
}

function startsWithVowel(part: string | undefined): boolean {
  return part !== undefined && isVowelLetter(part[0]);
}

function vowelGroups(word: string): string[] {
  return word.match(/[aeiou]+/g) ?? [];
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Levenshtein distance, abandoned once it exceeds `cap`. */
function editDistance(a: string, b: string, cap: number): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let previous: number[] = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current: number[] = [i];
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return Math.min(previous[b.length], cap + 1);
}

/* ------------------------------- rule inputs ------------------------------- */

/**
 * Prefixes are never a "stem" that doubles its final consonant. Without this,
 * `ad + opt` would license `add + opt`: `ad` is CVC and monosyllabic, but a
 * prefix does not undergo consonant doubling.
 */
const PREFIXES = new Set([
  'a', 'ab', 'ac', 'ad', 'af', 'ag', 'al', 'an', 'ap', 'ar', 'as', 'at',
  'be', 'co', 'col', 'com', 'con', 'cor', 'de', 'di', 'dif', 'dis',
  'e', 'ef', 'em', 'en', 'ex', 'il', 'im', 'in', 'inter', 'intro', 'ir',
  'mis', 'non', 'ob', 'oc', 'of', 'op', 'per', 'post', 'pre', 'pro',
  're', 'retro', 'se', 'sub', 'suc', 'suf', 'sup', 'sus', 'super',
  'trans', 'un', 'under', 'up',
]);

/**
 * Multi-syllable stems whose final syllable carries primary (or the only)
 * stress, so the final consonant doubles before a vowel-initial suffix:
 * adMITTed, reFERRing, ocCURRing, beGINning, conTROLLed.
 *
 * Stems stressed earlier stay single: VISited, OFfered, DIFfered, ENtered.
 * That is exactly the distinction the rule has to make, and a stress lexicon is
 * the only honest way to make it without guessing from the spelling.
 */
const POLYSYLLABIC_DOUBLING_STEMS = new Set([
  'abet', 'abhor', 'acquit', 'admit', 'allot', 'beget', 'begin', 'commit',
  'compel', 'concur', 'confer', 'control', 'defer', 'deter', 'dispel',
  'emit', 'equip', 'expel', 'forbid', 'forget', 'format', 'impel', 'incur',
  'infer', 'intermit', 'omit', 'outwit', 'patrol', 'permit', 'prefer',
  'propel', 'rebel', 'rebut', 'recur', 'refer', 'regret', 'remit', 'repel',
  'reset', 'resit', 'submit', 'transfer', 'transmit', 'upset',
]);

/**
 * `assimilation` is a whitelist, not a rule about "similar consonants".
 * Each form names the one letter that has to start the next morpheme, so
 * `af` is licensed before `fer` but never before `sent`.
 */
const ASSIMILATION: { canonical: string; forms: { surface: string; trigger: string }[] }[] = [
  {
    canonical: 'ad',
    forms: [
      { surface: 'af', trigger: 'f' },
      { surface: 'ag', trigger: 'g' },
      { surface: 'al', trigger: 'l' },
      { surface: 'an', trigger: 'n' },
      { surface: 'ap', trigger: 'p' },
      { surface: 'ar', trigger: 'r' },
      { surface: 'as', trigger: 's' },
      { surface: 'at', trigger: 't' },
      { surface: 'ac', trigger: 'c' },
    ],
  },
  {
    canonical: 'in',
    forms: [
      { surface: 'im', trigger: 'b' },
      { surface: 'im', trigger: 'm' },
      { surface: 'im', trigger: 'p' },
      { surface: 'il', trigger: 'l' },
      { surface: 'ir', trigger: 'r' },
    ],
  },
  {
    canonical: 'con',
    forms: [
      { surface: 'col', trigger: 'l' },
      { surface: 'com', trigger: 'b' },
      { surface: 'com', trigger: 'm' },
      { surface: 'com', trigger: 'p' },
      { surface: 'cor', trigger: 'r' },
    ],
  },
  {
    canonical: 'sub',
    forms: [
      { surface: 'suc', trigger: 'c' },
      { surface: 'suf', trigger: 'f' },
      { surface: 'sup', trigger: 'p' },
      { surface: 'sus', trigger: 's' },
    ],
  },
  {
    canonical: 'ob',
    forms: [
      { surface: 'oc', trigger: 'c' },
      { surface: 'of', trigger: 'f' },
      { surface: 'op', trigger: 'p' },
    ],
  },
  { canonical: 'ex', forms: [{ surface: 'ef', trigger: 'f' }] },
  { canonical: 'dis', forms: [{ surface: 'dif', trigger: 'f' }] },
  {
    canonical: 'syn',
    forms: [
      { surface: 'sym', trigger: 'b' },
      { surface: 'sym', trigger: 'm' },
      { surface: 'sym', trigger: 'p' },
      { surface: 'syl', trigger: 'l' },
    ],
  },
];

/* -------------------------------- rule docs -------------------------------- */

export interface RuleDoc {
  id: RuleId;
  /** When the rule may fire, in one sentence. */
  condition: string;
  example: string;
  /** A near-miss the rule must NOT license. */
  counterexample: string;
  accept: { input: string; accepted: string[][] };
  reject: { input: string; accepted: string[][] };
}

/**
 * The published rule set. `word-sum.test.ts` replays every entry, so a rule
 * cannot exist without both a licensed example and a counterexample that it
 * refuses.
 */
export const RULE_DOCS: RuleDoc[] = [
  {
    id: 'e-drop',
    condition: '加元音开头的后缀时，词尾不发音的 e 脱落；后缀以辅音开头时 e 必须保留。',
    example: 'create + ion → creation',
    counterexample: 'care + ful → careful（后缀 f- 开头，e 不脱落）',
    accept: { input: 'creat + ion', accepted: [['create', 'ion']] },
    reject: { input: 'car + ful', accepted: [['care', 'ful']] },
  },
  {
    id: 'y-to-i',
    condition: '辅音字母 + y 结尾的词素，接不以 i 开头的后缀时 y 变 i；元音 + y 不变。',
    example: 'happy + ness → happiness',
    counterexample: 'play + ing → playing（y 前是元音 a）',
    accept: { input: 'happi + ness', accepted: [['happy', 'ness']] },
    reject: { input: 'plai + ing', accepted: [['play', 'ing']] },
  },
  {
    id: 'consonant-doubling',
    condition:
      '单音节闭音节词干，或重音落在末音节的多音节词干（白名单），接元音开头的后缀时双写词尾辅音；只能加上一个辅音，不能从已有的双写里删掉一个。',
    example: 'admit + ed → admitted',
    counterexample: 'visit + ed → visited（重音在首音节，不双写）',
    accept: { input: 'admitt + ed', accepted: [['admit', 'ed']] },
    reject: { input: 'visitt + ed', accepted: [['visit', 'ed']] },
  },
  {
    id: 'assimilation',
    condition:
      '前缀末辅音被词根首辅音同化，且只在白名单内：ad→af/ap/at/ac…、in→im/il/ir、con→col/com/cor、sub→suc/suf/sup/sus、ob→oc/of/op、ex→ef、dis→dif。',
    example: 'ad + ferent → afferent',
    counterexample: 'ab + ferent（ab- 不是 ad- 的白名单同化形式）',
    accept: { input: 'ad + ferent', accepted: [['af', 'ferent']] },
    reject: { input: 'ab + ferent', accepted: [['af', 'ferent']] },
  },
  {
    id: 'connective-vowel',
    condition:
      '两个实词根之间的连接元音 -o- / -i- 可以省略或补出；前缀后面不算，两侧必须辅音相接。',
    example: 'spectr + o + meter → spectrometer',
    counterexample: 'in + o + spect（in- 是前缀，不是词根）',
    accept: { input: 'spectr + meter', accepted: [['spectr', 'o', 'meter']] },
    reject: { input: 'in + o + spect', accepted: [['in', 'spect']] },
  },
];

const RULE_EXPLAIN: Record<RuleId, string> = {
  'e-drop': '词尾 e 在元音开头的后缀前脱落（e-drop）',
  'y-to-i': '辅音 + y 在非 i 开头的后缀前变成 i（y→i）',
  'consonant-doubling': '重读闭音节的词尾辅音在元音开头的后缀前双写（辅音双写）',
  assimilation: '前缀末辅音被词根首辅音同化，且属于白名单（assimilation）',
  'connective-vowel': '连接元音 -o- / -i- 的增删（connective-vowel）',
};

/* ------------------------------ rule matching ------------------------------ */

/** `create` / `creat` before a vowel-initial suffix. Both directions. */
function matchEDrop(learner: string, reference: string, next: string | undefined): boolean {
  if (reference.length < 3 || !startsWithVowel(next)) return false;
  if (reference.endsWith('e') && learner === reference.slice(0, -1)) {
    // The letter before the e must be a consonant; "see + ing" keeps both e's.
    return isConsonantLetter(reference[reference.length - 2]);
  }
  if (learner.endsWith('e') && reference === learner.slice(0, -1)) {
    return isConsonantLetter(learner[learner.length - 2]);
  }
  return false;
}

/** `happy` / `happi` before a suffix that does not begin with i. */
function matchYToI(learner: string, reference: string, next: string | undefined): boolean {
  if (next === undefined || next.startsWith('i')) return false;
  if (reference.length < 3 || learner.length < 3) return false;
  if (reference.endsWith('y') && isConsonantLetter(reference[reference.length - 2])) {
    if (learner === `${reference.slice(0, -1)}i`) return true;
  }
  if (learner.endsWith('y') && isConsonantLetter(learner[learner.length - 2])) {
    if (reference === `${learner.slice(0, -1)}i`) return true;
  }
  return false;
}

/**
 * Learner may have written the surface form with the final consonant doubled.
 * The reverse (reference `press`, learner `pres`) is a deletion and is NOT a
 * doubling licence — that asymmetry is what keeps `pres` out.
 */
function matchDoubling(
  learner: string,
  reference: string,
  next: string | undefined,
  stemPrefix: string,
): boolean {
  if (!startsWithVowel(next)) return false;
  if (learner.length !== reference.length + 1) return false;
  if (learner !== reference + reference.slice(-1)) return false;
  if (!isConsonantLetter(reference[reference.length - 1])) return false;
  const stem = `${stemPrefix}${reference}`;
  const base = reference;
  if (base.length < 2 || PREFIXES.has(base) || PREFIXES.has(stem)) return false;
  if (POLYSYLLABIC_DOUBLING_STEMS.has(stem)) return true;
  // A monosyllabic stem is stressed by definition, so its CVC final letter doubles.
  return isMonosyllabicCvc(stem);
}

function isMonosyllabicCvc(word: string): boolean {
  if (!/^[a-z]+$/.test(word) || word.length < 3) return false;
  if (vowelGroups(word).length !== 1) return false;
  const n = word.length;
  return (
    isConsonantLetter(word[n - 1]) &&
    isVowelLetter(word[n - 2]) &&
    isConsonantLetter(word[n - 3])
  );
}

/** Whitelisted prefix assimilation, in either direction. */
function matchAssimilation(
  learner: string,
  reference: string,
  next: string | undefined,
): boolean {
  if (next === undefined) return false;
  return surfaceMatches(reference, learner, next) || surfaceMatches(learner, reference, next);
}

/** True when `surface` is a licensed form of `canonical` before `next`. */
function surfaceMatches(canonical: string, surface: string, next: string): boolean {
  for (const entry of ASSIMILATION) {
    if (entry.canonical !== canonical) continue;
    for (const form of entry.forms) {
      const geminate = `${form.surface}${form.surface.slice(-1)}`;
      if (surface !== form.surface && surface !== geminate) continue;
      if (next.startsWith(form.trigger)) return true;
    }
  }
  return false;
}

/* ------------------------------- connective -------------------------------- */

/**
 * Remove one connective -o- / -i- standing between two consonant-edged roots.
 * A prefix never takes a connective vowel, which is what keeps `in + o + spect`
 * from being treated as a licensed variant.
 */
function stripConnectiveVowel(parts: string[]): string[] | null {
  for (let i = 1; i < parts.length - 1; i += 1) {
    if (parts[i] !== 'o' && parts[i] !== 'i') continue;
    const left = parts[i - 1];
    const right = parts[i + 1];
    if (left.length < 3 || PREFIXES.has(left)) continue;
    const leftEdge = left[left.length - 1];
    // `y` is a consonant letter but a vowel sound: happy + o + ness is not a
    // connective vowel, it is an inserted vowel.
    if (!isConsonantLetter(leftEdge) || leftEdge === 'y') continue;
    if (!isConsonantLetter(right[0]) || right[0] === 'y') continue;
    return [...parts.slice(0, i), ...parts.slice(i + 1)];
  }
  return null;
}

/* ------------------------------- judging one ------------------------------- */

interface PartOutcome {
  kind: 'same' | 'licensed' | 'misspelled' | 'unresolved';
  /** What the comparison used for this slot. */
  canonical: string;
  ruleIds: RuleId[];
  learner: string;
  reference: string;
  detail: string;
}

function assessPair(
  learner: string,
  reference: string,
  next: string | undefined,
  index: number,
  stemPrefix: string,
  options: SumOptions,
): PartOutcome {
  const base: PartOutcome = {
    kind: 'unresolved',
    canonical: learner,
    ruleIds: [],
    learner,
    reference,
    detail: '',
  };

  if (!/^[a-z]+$/.test(learner) || !/^[a-z]+$/.test(reference)) {
    return {
      ...base,
      detail: `第 ${index + 1} 段“${learner}”或参考词素“${reference}”里有非字母字符，无法比较拼写`,
    };
  }
  if (learner === reference) return { ...base, kind: 'same', canonical: reference };

  if (matchEDrop(learner, reference, next)) {
    return { ...base, kind: 'licensed', canonical: reference, ruleIds: ['e-drop'] };
  }
  if (matchYToI(learner, reference, next)) {
    return { ...base, kind: 'licensed', canonical: reference, ruleIds: ['y-to-i'] };
  }
  if (matchDoubling(learner, reference, next, stemPrefix)) {
    return { ...base, kind: 'licensed', canonical: reference, ruleIds: ['consonant-doubling'] };
  }
  if (index === 0 && matchAssimilation(learner, reference, next)) {
    return { ...base, kind: 'licensed', canonical: reference, ruleIds: ['assimilation'] };
  }

  // Nothing licensed the difference. An unknown morpheme is not proof of a
  // misspelling; anything beyond a single edit is not attributable either.
  if (options.known && !options.known(learner)) {
    return {
      ...base,
      detail: `第 ${index + 1} 段“${learner}”在词库里查不到，无法判断它是另一个词素还是拼错了`,
    };
  }

  // Two shapes deserve a targeted explanation, because "one letter" hides the
  // reason: removing one of a genuine double, and adding one where the stem
  // does not double.
  if (removesDoubling(learner, reference)) {
    return {
      ...base,
      kind: 'misspelled',
      detail:
        `第 ${index + 1} 段“${learner}”比参考词素“${reference}”少了一个 ` +
        `${learner[learner.length - 1]}；双写是这个词本身的拼写，删掉一个不是任何规则允许的变化`,
    };
  }
  if (addsDoubling(learner, reference)) {
    return {
      ...base,
      kind: 'misspelled',
      detail:
        `第 ${index + 1} 段“${learner}”比参考词素“${reference}”多写了一个 ` +
        `${reference[reference.length - 1]}；辅音双写只在“重读闭音节 + 元音开头后缀”时成立，这里的条件不满足`,
    };
  }

  const distance = editDistance(learner, reference, 2);
  if (distance <= 1) {
    return {
      ...base,
      kind: 'misspelled',
      detail: `第 ${index + 1} 段“${learner}”与参考词素“${reference}”只差一个字母，但没有任何规则允许这种变化`,
    };
  }
  return {
    ...base,
    detail: `第 ${index + 1} 段“${learner}”与参考词素“${reference}”差异较大，无法判断是换了词素还是拼写有误`,
  };
}

/** `press` → `pres`: deleting one copy of a genuine double. Never licensed. */
function removesDoubling(learner: string, reference: string): boolean {
  return (
    reference.length === learner.length + 1 &&
    reference === learner + learner.slice(-1) &&
    isConsonantLetter(learner[learner.length - 1])
  );
}

/** `admit` → `admitt`: adding a doubling letter that the stem cannot take. */
function addsDoubling(learner: string, reference: string): boolean {
  return (
    learner.length === reference.length + 1 &&
    learner === reference + reference.slice(-1) &&
    isConsonantLetter(reference[reference.length - 1])
  );
}

function passes(structure: SumStructure, spelling: SumSpelling): boolean {
  return structure === 'correct' && (spelling === 'canonical' || spelling === 'licensed-variant');
}

function judgeAgainst(learner: string[], accepted: string[], options: SumOptions): SumVerdict {
  let learnerSeq = learner;
  let acceptedSeq = accepted;
  const sequencesRule: RuleId[] = [];

  if (learner.length === accepted.length + 1) {
    const stripped = stripConnectiveVowel(learner);
    if (stripped) {
      learnerSeq = stripped;
      sequencesRule.push('connective-vowel');
    }
  } else if (accepted.length === learner.length + 1) {
    const stripped = stripConnectiveVowel(accepted);
    if (stripped) {
      acceptedSeq = stripped;
      sequencesRule.push('connective-vowel');
    }
  }

  if (learnerSeq.length !== acceptedSeq.length) {
    return {
      structure: 'incorrect',
      spelling: 'unknown',
      ruleIds: [],
      note:
        `词素数不对：参考分析有 ${accepted.length} 段（${accepted.join(' + ')}），` +
        `你写了 ${learner.length} 段。Word Sum 要把每个词素单独写出来。`,
      normalized: learner,
      ok: false,
    };
  }

  const outcomes: PartOutcome[] = [];
  const canonicalSoFar: string[] = [];
  for (let i = 0; i < learnerSeq.length; i += 1) {
    const outcome = assessPair(
      learnerSeq[i],
      acceptedSeq[i],
      acceptedSeq[i + 1],
      i,
      canonicalSoFar.join(''),
      options,
    );
    outcomes.push(outcome);
    canonicalSoFar.push(outcome.canonical);
  }

  const ruleIds = unique([...sequencesRule, ...outcomes.flatMap((outcome) => outcome.ruleIds)]);
  const normalized = outcomes.map((outcome) => outcome.canonical);
  const unexplained = outcomes.filter((outcome) => outcome.kind === 'unresolved');
  const misspelled = outcomes.filter((outcome) => outcome.kind === 'misspelled');
  const licensed = outcomes.some((outcome) => outcome.kind === 'licensed') || sequencesRule.length > 0;

  if (unexplained.length) {
    return {
      structure: 'unresolved',
      spelling: 'unknown',
      ruleIds,
      note: `无法判断：${unexplained.map((outcome) => outcome.detail).join('；')}。不据此判错。`,
      normalized,
      ok: false,
    };
  }

  if (misspelled.length) {
    return {
      structure: 'correct',
      spelling: 'misspelled',
      ruleIds,
      note:
        '词素切分是对的，但拼写不符合规则：' +
        `${misspelled.map((outcome) => outcome.detail).join('；')}。`,
      normalized,
      ok: false,
    };
  }

  const notes = ruleIds.map((id) => RULE_EXPLAIN[id]);
  return {
    structure: 'correct',
    spelling: licensed ? 'licensed-variant' : 'canonical',
    ruleIds,
    note: licensed
      ? `成立。${unique(notes).join('；')}，这是规则允许的写法。`
      : '成立：词素切分与参考分析一致，拼写也是规范形态。',
    normalized,
    ok: passes('correct', licensed ? 'licensed-variant' : 'canonical'),
  };
}

/* --------------------------------- entry ---------------------------------- */

const STRUCTURE_RANK: Record<SumStructure, number> = { correct: 2, unresolved: 1, incorrect: 0 };
const SPELLING_RANK: Record<SumSpelling, number> = {
  canonical: 3,
  'licensed-variant': 2,
  misspelled: 1,
  unknown: 0,
};

function better(candidate: SumVerdict, incumbent: SumVerdict): boolean {
  if (candidate.ok !== incumbent.ok) return candidate.ok;
  const byStructure = STRUCTURE_RANK[candidate.structure] - STRUCTURE_RANK[incumbent.structure];
  if (byStructure !== 0) return byStructure > 0;
  return SPELLING_RANK[candidate.spelling] > SPELLING_RANK[incumbent.spelling];
}

/**
 * Grade one Word Sum against the accepted analyses.
 *
 * Each alternative in `accepted` is a legitimate analysis (a base form and its
 * connecting-vowel variant, for instance). The best verdict wins: a pass beats
 * a non-pass, a graded structure beats an unresolved one.
 */
export function checkSum(input: string, accepted: string[][], options: SumOptions = {}): SumVerdict {
  const learner = splitSum(input).map(cleanPart).filter(Boolean);
  const alternatives = (accepted ?? [])
    .map((alternative) => alternative.map(cleanPart).filter(Boolean))
    .filter((alternative) => alternative.length > 0);

  if (!learner.length) {
    return {
      structure: 'unresolved',
      spelling: 'unknown',
      ruleIds: [],
      note: '还没有写出 Word Sum。用 + 把词素连起来，例如 in + spect + ion。',
      normalized: [],
      ok: false,
    };
  }
  if (!alternatives.length) {
    return {
      structure: 'unresolved',
      spelling: 'unknown',
      ruleIds: [],
      note: '这道题没有可对照的参考拆解，无法判断；不据此判错。',
      normalized: learner,
      ok: false,
    };
  }

  let best = judgeAgainst(learner, alternatives[0], options);
  for (const alternative of alternatives.slice(1)) {
    const candidate = judgeAgainst(learner, alternative, options);
    if (better(candidate, best)) best = candidate;
  }
  return best;
}

/* ------------------------------- no verdict -------------------------------- */

/**
 * A verdict for a reference structure we deliberately refuse to grade.
 *
 * Added in 0.12.1 for the sum gate. `layer` alone cannot tell a live modern
 * analysis from an etymological or teaching one, so a historical split must be
 * shown without being turned into "the one right answer". The learner is not
 * wrong — we are not judging. Multiple *live* analyses are not ungraded; those
 * go through `checkSum` with several entries in `accepted`.
 */
export function ungradedVerdict(note: string, normalized: string[] = []): SumVerdict {
  return {
    structure: 'unresolved',
    spelling: 'unknown',
    ruleIds: [],
    note,
    normalized,
    ok: false,
  };
}

