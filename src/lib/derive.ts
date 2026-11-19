/**
 * Derivation engine (v0.3).
 *
 * The engine spells a derived word by applying the real English orthographic
 * rules in a fixed order and records every step, so the lab can show
 * `help -> +ful -> helpful -> +ness -> helpfulness` instead of a bare string.
 *
 * It never decides on its own that a word exists: existence always comes from
 * a dictionary (the verified lexicon). A form that the rules produce but the
 * dictionary does not contain is reported as `unknown` — "not in the lexicon",
 * never "does not exist".
 */
import { allMorphemes, allWords, getMorpheme, getWord, identity } from './content';
import type { Morpheme, WordEntry } from './types';

export type Pos = NonNullable<WordEntry['pos']>;

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export type RuleId =
  | 'none'
  | 'drop-e'
  | 'keep-e-soft'
  | 'y-to-i'
  | 'double'
  | 'assimilate'
  | 't-s-to-tion'
  | 'segment-guess';

export interface DerivationStep {
  from: string;
  add: string;
  to: string;
  rule?: string;
}

export interface Derivation {
  word: string;
  steps: DerivationStep[];
  familyId?: string;
  /** Morpheme ID of the base and of each addition, `null` when ambiguous. */
  ids?: (string | null)[];
}

export interface Analysis {
  parts: string[];
  steps: DerivationStep[];
  known: boolean;
  note?: string;
  /** Morpheme ID for each part, `null` where the spelling is ambiguous. */
  ids: (string | null)[];
}

/** A cell in the derivation grid: the three honest states. */
export type CellState = 'verified' | 'rule-blocked' | 'unknown';

export interface CellVerdict {
  state: CellState;
  word: string;
  /** Spelling rule that produced the form, or the rule that blocked it. */
  rule: RuleId | 'dup-affix' | 'pos-mismatch' | 'inflection-order' | 'i-conflict' | 'not-an-affix';
  reason?: string;
  steps: DerivationStep[];
}

/** Everything the grid knows about the word in one row. */
export interface WordContext {
  word: string;
  parts: string[];
  pos?: Pos | null;
}

/* ------------------------------------------------------------------ */
/* Rule labels                                                         */
/* ------------------------------------------------------------------ */

export const RULE_LABELS: Record<RuleId, string> = {
  none: '直接拼接，拼写不变',
  'drop-e': '不发音的 e 在元音开头的后缀前脱落',
  'keep-e-soft': '软音 c / g 之后的 e 保留',
  'y-to-i': '词尾 y 变 i（后接非 i 开头的后缀）',
  double: '词尾辅音双写，保持前面的短元音',
  assimilate: '前缀末辅音同化到词基首字母',
  't-s-to-tion': '-t / -s / -ce / -te 与 -ion 合并为 -tion / -sion',
  'segment-guess': '按拼写切分（推测，未经词库验证）',
};

export const BLOCK_LABELS: Record<Exclude<CellVerdict['rule'], RuleId>, string> = {
  'dup-affix': '同一个词缀不能叠两次',
  'pos-mismatch': '词性与后缀要求不匹配',
  'inflection-order': '屈折后缀之后不能再接派生后缀',
  'i-conflict': 'y→i 造成的 i 不能再接 i 开头的后缀',
  'not-an-affix': '不是可识别的词缀',
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * Place assimilation: the prefix's final consonant takes the place of
 * articulation of the base's first letter. Keyed by base-initial letter; a
 * letter not listed means "no change".
 */
const ASSIMILATION: Record<string, Record<string, string>> = {
  in: { l: 'il', m: 'im', p: 'im', b: 'im', r: 'ir' },
  con: { l: 'col', m: 'com', p: 'com', b: 'com', r: 'cor' },
  ad: { c: 'ac', f: 'af', g: 'ag', l: 'al', p: 'ap', r: 'ar', s: 'as', t: 'at' },
  sub: { c: 'suc', f: 'suf', g: 'sug', p: 'sup', s: 'sus' },
  ob: { c: 'oc', f: 'of', p: 'op' },
  ex: { f: 'ef' },
  dis: { f: 'dif' },
  syn: { m: 'sym' },
};

/** Inflectional suffixes: nothing derivational may follow them. */
const INFLECTIONAL = new Set(['s', 'ed', 'ing']);

/**
 * Which word class a suffix attaches to. Keyed by the canonical morpheme form
 * from the lexicon; used only to block combinations that are grammatically
 * impossible. A verified word always wins over this table.
 */
const SUFFIX_INPUT: Record<string, readonly Pos[]> = {
  ness: ['adj'],
  ity: ['adj'],
  ly: ['adj'],
  ful: ['n'],
  less: ['n'],
  ous: ['n'],
  able: ['v'],
  ible: ['v'],
  ive: ['v'],
  ment: ['v'],
  tion: ['v'],
  ion: ['v'],
  ance: ['v', 'adj'],
  ence: ['v'],
  ize: ['n', 'adj'],
  ise: ['n', 'adj'],
  ify: ['n', 'adj'],
  ism: ['n', 'adj'],
  ist: ['v', 'n'],
  er: ['v'],
  or: ['v'],
  ant: ['v'],
  ent: ['v'],
  ic: ['n'],
  ical: ['n'],
  al: ['n'],
  est: ['adj'],
  ed: ['v'],
  ing: ['v'],
  s: ['n'],
  ate: ['n', 'adj'],
  ure: ['v'],
};

const POS_ZH: Record<Pos, string> = {
  n: '名词',
  v: '动词',
  adj: '形容词',
  adv: '副词',
  other: '其他词类',
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */

export function stripAffixDashes(form: string): string {
  return form.trim().toLowerCase().replace(/^-+/, '').replace(/-+$/, '');
}

function isVowel(ch: string | undefined): boolean {
  return Boolean(ch) && VOWELS.has(ch as string);
}

export function endsInCVC(stem: string): boolean {
  if (stem.length < 3) return false;
  return !isVowel(stem.at(-3)) && isVowel(stem.at(-2)) && !isVowel(stem.at(-1));
}

function vowelGroups(stem: string): number {
  let count = 0;
  let prev = false;
  for (const ch of stem) {
    const now = VOWELS.has(ch);
    if (now && !prev) count += 1;
    prev = now;
  }
  return count;
}

/** English doubles a stressed final CVC; without stress data we only trust one syllable. */
function preferDoubling(stem: string): boolean {
  return endsInCVC(stem) && vowelGroups(stem) <= 1;
}

function notation(form: string, kind: 'prefix' | 'suffix'): string {
  return kind === 'prefix' ? `${form}-` : `-${form}`;
}

/** Morpheme type of an addition, used to decide where it attaches. */
export function affixKind(add: string): 'prefix' | 'suffix' {
  const trimmed = add.trim().toLowerCase();
  if (trimmed.endsWith('-')) return 'prefix';
  if (trimmed.startsWith('-')) return 'suffix';
  return affixRole(trimmed) === 'prefix' ? 'prefix' : 'suffix';
}

/**
 * Is this spelling a prefix or a suffix in the lexicon?
 *
 * Two entries can share a spelling (the Arabic article `al` and the suffix
 * `-al`), and the form index keeps only one of them, so a miss or a non-affix
 * reading falls back to the identity index: a spelling whose candidates all
 * agree on one affix type has that type; a genuine conflict has none.
 */
export function affixRole(form: string): 'prefix' | 'suffix' | undefined {
  const f = stripAffixDashes(form);
  const type = morphemeType(f);
  if (type === 'prefix' || type === 'suffix') return type;
  const direct = getMorpheme(f);
  if (direct?.type === 'prefix') return direct.type;
  if (direct?.type === 'suffix') return direct.type;
  return undefined;
}

/** Type shared by every record this spelling can stand for, else undefined. */
function morphemeType(form: string): Morpheme['type'] | undefined {
  const types = new Set(
    identity
      .idsForForm(form)
      .map((id) => identity.byId(id)?.type)
      .filter((type): type is Morpheme['type'] => Boolean(type)),
  );
  return types.size === 1 ? [...types][0] : undefined;
}

/** The morpheme a spelling belongs to (allomorphs resolve to their canonical entry). */
export function morphemeOf(part: string): Morpheme | undefined {
  const { id } = identity.resolve(part);
  if (id) return identity.byId(id);
  return undefined;
}

/** Index of the lexical core: the first root / combining form, else the first part. */
export function rootIndexOf(parts: readonly string[]): number {
  const idx = parts.findIndex((p) => {
    const type = morphemeType(stripAffixDashes(p));
    return type === 'root' || type === 'combining';
  });
  return idx >= 0 ? idx : 0;
}

/* ------------------------------------------------------------------ */
/* Spelling rules                                                      */
/* ------------------------------------------------------------------ */

interface Joined {
  text: string;
  rule: RuleId;
}

function joinPrefix(base: string, prefix: string): Joined {
  const p = stripAffixDashes(prefix);
  const morpheme = getMorpheme(p);
  const canonical = morpheme?.type === 'prefix' ? stripAffixDashes(morpheme.form) : p;
  const first = base[0] ?? '';

  // The surface form is already an allomorph (`il-`, `im-`): the step is the
  // assimilation itself, and the join is verbatim.
  if (canonical !== p) return { text: p + base, rule: 'assimilate' };

  const variant = ASSIMILATION[canonical]?.[first];
  if (variant) return { text: variant + base, rule: 'assimilate' };
  return { text: p + base, rule: 'none' };
}

/** Both readings of a prefix join, assimilated first: the dictionary decides. */
function prefixCandidates(base: string, prefix: string): Joined[] {
  const p = stripAffixDashes(prefix);
  const assimilated = joinPrefix(base, p);
  if (assimilated.rule === 'assimilate' && assimilated.text !== p + base) {
    return [assimilated, { text: p + base, rule: 'none' }];
  }
  return [assimilated];
}

/**
 * Candidates for base + suffix, best reading first. The only genuinely
 * ambiguous rule is consonant doubling (it needs stress, which we do not have),
 * so it returns both readings and lets the dictionary decide.
 */
function suffixCandidates(base: string, suffix: string): Joined[] {
  const s = stripAffixDashes(suffix);
  if (!s) return [{ text: base, rule: 'none' }];
  const vowelInitial = isVowel(s[0]);

  // 1. -tion / -sion family: the stem's t / s is the one we hear.
  if (/^(tion|sion|ion|ation|itions?)$/.test(s)) {
    if (/de$/.test(base)) {
      return [{ text: `${base.slice(0, -2)}sion`, rule: 't-s-to-tion' }];
    }
    if (/ce$/.test(base)) {
      return [{ text: `${base.slice(0, -1)}tion`, rule: 't-s-to-tion' }];
    }
    if (/[ts]e$/.test(base)) {
      return [{ text: `${base.slice(0, -1)}ion`, rule: 't-s-to-tion' }];
    }
    if (/[ts]$/.test(base)) {
      return [{ text: `${base}ion`, rule: 't-s-to-tion' }];
    }
  }

  // 2. silent e: kept after soft c / g, otherwise dropped before a vowel.
  let stem = base;
  let rule: RuleId = 'none';
  if (/e$/.test(stem) && vowelInitial) {
    if (/[cgs]e$/.test(stem)) {
      return [{ text: stem + s, rule: 'keep-e-soft' }];
    }
    stem = stem.slice(0, -1);
    rule = 'drop-e';
  }

  // 3. consonant + y -> i, except before an i-initial suffix.
  if (/[^aeiou]y$/.test(stem) && !s.startsWith('i')) {
    stem = `${stem.slice(0, -1)}i`;
    rule = 'y-to-i';
  }

  // 4. consonant doubling before a vowel-initial suffix.
  const doubles =
    vowelInitial && endsInCVC(stem) && !/[wxy]$/.test(stem) && s !== 'ing' && !/[aeiou]ing$/.test(s);
  if (doubles) {
    const doubled = stem + stem.slice(-1);
    return [
      { text: doubled + s, rule: 'double' },
      { text: stem + s, rule },
    ];
  }

  return [{ text: stem + s, rule }];
}

function pickCandidates(base: string, candidates: Joined[], dictionary?: Set<string>): Joined {
  if (dictionary) {
    const hit = candidates.find((c) => dictionary.has(c.text));
    if (hit) return hit;
  }
  const doubled = candidates.find((c) => c.rule === 'double');
  if (doubled && preferDoubling(base)) return doubled;
  return candidates.find((c) => c.rule !== 'double') ?? candidates[0];
}

/* ------------------------------------------------------------------ */
/* deriveFrom                                                          */
/* ------------------------------------------------------------------ */

/**
 * Apply `additions` to `base` in derivation order (all prefixes first, then
 * suffixes left to right) and report the spelling steps.
 *
 * `valid` means the resulting spelling is in `dictionary`; it is not a claim
 * that the word is grammatical or idiomatic.
 */
export function deriveFrom(
  base: string,
  additions: string[],
  dictionary: Set<string>,
): Derivation & { valid: boolean } {
  const start = stripAffixDashes(base);
  const prefixes: string[] = [];
  const suffixes: string[] = [];
  const ids: (string | null)[] = [identity.resolve(start).id ?? null];
  for (const raw of additions) {
    const add = raw.trim().toLowerCase();
    if (!add) continue;
    ids.push(identity.resolve(add).id ?? null);
    if (affixKind(add) === 'prefix') prefixes.push(add);
    else suffixes.push(add);
  }

  const steps: DerivationStep[] = [];
  let word = start;

  for (const add of prefixes) {
    const form = stripAffixDashes(add);
    const joined = pickCandidates(word, prefixCandidates(word, form), dictionary);
    steps.push({ from: word, add: notation(form, 'prefix'), to: joined.text, rule: joined.rule });
    word = joined.text;
  }

  for (const add of suffixes) {
    const form = stripAffixDashes(add);
    const joined = pickCandidates(word, suffixCandidates(word, form), dictionary);
    steps.push({ from: word, add: notation(form, 'suffix'), to: joined.text, rule: joined.rule });
    word = joined.text;
  }

  return { word, steps, familyId: familyIdOf(start), valid: dictionary.has(word), ids };
}

/** Canonical family id for a base spelling, e.g. `help` -> `rx-help`. */
export function familyIdOf(base: string): string | undefined {
  const resolved = identity.resolve(base).id;
  if (resolved) return resolved;
  // A spelling the lexicon does not list may still be a listed word whose
  // verified analysis names the morphemes.
  const entry = getWord(base);
  const coreId = entry?.partIds?.[rootIndexOf(entry.parts)];
  if (coreId) return coreId;
  return entry?.parts.map((p) => identity.resolve(p).id).find(Boolean) ?? undefined;
}

/* ------------------------------------------------------------------ */
/* analyze                                                             */
/* ------------------------------------------------------------------ */

function buildStepsFromParts(
  parts: string[],
  rootIndex: number,
  allowDoubling = true,
): DerivationStep[] {
  const steps: DerivationStep[] = [];
  let word = parts[rootIndex] ?? '';
  for (let i = rootIndex - 1; i >= 0; i -= 1) {
    const form = stripAffixDashes(parts[i]);
    const joined = prefixCandidates(word, form)[0];
    steps.push({ from: word, add: notation(form, 'prefix'), to: joined.text, rule: joined.rule });
    word = joined.text;
  }
  for (let i = rootIndex + 1; i < parts.length; i += 1) {
    const form = stripAffixDashes(parts[i]);
    const candidates = suffixCandidates(word, form);
    // Doubling needs stress data we do not have; the verified spelling decides.
    const joined = allowDoubling
      ? candidates[0]
      : (candidates.find((c) => c.rule !== 'double') ?? candidates[0]);
    steps.push({ from: word, add: notation(form, 'suffix'), to: joined.text, rule: joined.rule });
    word = joined.text;
  }
  return steps;
}

function knownMorpheme(stem: string): string | undefined {
  const tries = [stem, `${stem}e`, `${stem}y`, `${stem}${stem.slice(-1)}`];
  // Undo a y -> i change: `happi` must be recognised as `happy`.
  if (stem.endsWith('i')) tries.splice(1, 0, `${stem.slice(0, -1)}y`);
  return tries.find((candidate) => identity.idsForForm(candidate).length > 0);
}

function peeledForms(type: Morpheme['type']): string[] {
  const forms = new Set<string>();
  for (const m of allMorphemes()) {
    if (m.type !== type) continue;
    forms.add(stripAffixDashes(m.form));
    for (const alt of m.allomorphs ?? []) forms.add(stripAffixDashes(alt));
  }
  return [...forms].filter((f) => f.length >= 1).sort((a, b) => b.length - a.length);
}

/**
 * Best-effort segmentation of an unlisted spelling. Prefixes are peeled from
 * the left, suffixes from the right, and the remainder is matched against the
 * lexicon. Everything it returns is explicitly a guess.
 */
function segmentUnknown(word: string): { parts: string[]; steps: DerivationStep[]; note: string } {
  const prefixForms = peeledForms('prefix');
  const suffixForms = peeledForms('suffix');

  let rest = word;
  const prefixes: string[] = [];
  while (prefixes.length < 2) {
    const hit = prefixForms.find((p) => p.length >= 2 && rest.startsWith(p) && rest.length - p.length >= 4);
    if (!hit) break;
    prefixes.push(hit);
    rest = rest.slice(hit.length);
  }

  let stem = rest;
  const suffixes: string[] = [];
  while (suffixes.length < 3) {
    // One-letter forms other than the plural -s produce nonsense peels such as
    // happy -> happi + i, so they are not offered as suffixes.
    const hit = suffixForms.find(
      (s) => (s.length >= 2 || s === 's') && stem.endsWith(s) && stem.length - s.length >= 3,
    );
    if (!hit) break;
    suffixes.unshift(hit);
    stem = stem.slice(0, -hit.length);
  }

  const restored = knownMorpheme(stem);
  const root = restored ?? stem;
  if (!restored && prefixes.length === 0 && suffixes.length === 0) {
    return {
      parts: [word],
      steps: [],
      note: '词库未收录，且未能识别出任何词素：更可能是单纯词、专名或外来词，不能按派生词切分。',
    };
  }

  const parts = [...prefixes, root, ...suffixes];
  const steps = buildStepsFromParts(parts, prefixes.length);
  const produced = steps.length > 0 ? steps[steps.length - 1].to : root;
  if (produced !== word) {
    steps.push({ from: produced, add: '（拼写调整）', to: word, rule: 'segment-guess' });
  }

  const unknownRoot = restored ? '' : `中间部分「${root}」也不是词库收录的词素，`;
  return {
    parts,
    steps,
    note: `词库未收录「${word}」，以上切分是据拼写的推测，不是辞书结论。${unknownRoot}请把它当作假设，而不是定论。`,
  };
}

/**
 * Split any spelling into morphemes.
 *
 * A listed word uses its verified analysis. An unlisted word is segmented by
 * rule and returned with `known: false` and an explanatory note — an unknown
 * input must never throw or be presented as a fact.
 */
export function analyze(word: string): Analysis {
  const w = word.trim().toLowerCase();
  if (!w) return { parts: [], steps: [], known: false, note: '请输入一个英文单词。', ids: [] };

  const entry = getWord(w);
  if (entry) {
    const parts = entry.parts.map(stripAffixDashes);
    const rootIndex = rootIndexOf(parts);
    const doubled = buildStepsFromParts(parts, rootIndex, true);
    const plain = buildStepsFromParts(parts, rootIndex, false);
    const last = (steps: DerivationStep[]) => (steps.length > 0 ? steps[steps.length - 1].to : (parts[rootIndex] ?? ''));
    // Only the listed spelling can pick between the two doubling readings.
    const steps = last(doubled) === entry.w ? doubled : last(plain) === entry.w ? plain : doubled;
    const ids = entry.partIds ?? parts.map((part) => identity.resolve(part).id ?? null);
    return { parts, steps, known: true, ids };
  }

  const guess = segmentUnknown(w);
  const ids = guess.parts.map((part) => identity.resolve(part).id ?? null);
  return { parts: guess.parts, steps: guess.steps, known: false, note: guess.note, ids };
}

/* ------------------------------------------------------------------ */
/* Three-state judgement                                               */
/* ------------------------------------------------------------------ */

function requiredInput(form: string): readonly Pos[] | undefined {
  const ids = identity.idsForForm(form);
  const canonical =
    ids.length === 1
      ? identity.byId(ids[0])?.form.replace(/^-+|-+$/g, '').toLowerCase()
      : undefined;
  return SUFFIX_INPUT[form] ?? (canonical ? SUFFIX_INPUT[canonical] : undefined);
}

/**
 * Decide what one affix does to one word: verified (in the lexicon),
 * rule-blocked (impossible by a stated morphological rule) or unknown
 * (spellable, but not in the lexicon).
 */
export function judgeAdd(context: WordContext, affix: string, dictionary: Set<string>): CellVerdict {
  const form = stripAffixDashes(affix);
  const kind = affixKind(affix);
  const add = notation(form, kind);

  if (!/^[a-z]+$/.test(form)) {
    return {
      state: 'rule-blocked',
      word: context.word,
      rule: 'not-an-affix',
      reason: '这不是一个可识别的词缀。',
      steps: [],
    };
  }

  const parts = context.parts.map(stripAffixDashes);

  if (kind === 'prefix') {
    if (parts[0] === form) {
      return {
        state: 'rule-blocked',
        word: context.word,
        rule: 'dup-affix',
        reason: `${context.word} 已经带前缀 ${form}-，英语里同一个前缀不会相邻叠用。`,
        steps: [],
      };
    }
    const joined = pickCandidates(context.word, prefixCandidates(context.word, form), dictionary);
    const step: DerivationStep = {
      from: context.word,
      add,
      to: joined.text,
      rule: joined.rule,
    };
    if (dictionary.has(joined.text)) {
      return { state: 'verified', word: joined.text, rule: joined.rule, steps: [step] };
    }
    return {
      state: 'unknown',
      word: joined.text,
      rule: joined.rule,
      reason: '按规则可以拼出，但词库未收录这个词条（未收录 ≠ 不存在）。',
      steps: [step],
    };
  }

  if (parts.at(-1) === form) {
    return {
      state: 'rule-blocked',
      word: context.word,
      rule: 'dup-affix',
      reason: `${context.word} 已经带后缀 -${form}，同一个后缀不能连续叠用。`,
      steps: [],
    };
  }

  const candidates = suffixCandidates(context.word, form);
  const joined = pickCandidates(context.word, candidates, dictionary);
  const step: DerivationStep = {
    from: context.word,
    add,
    to: joined.text,
    rule: joined.rule,
  };

  // The dictionary is ground truth: a listed word is verified even when a
  // heuristic below would have guessed otherwise.
  if (dictionary.has(joined.text)) {
    return { state: 'verified', word: joined.text, rule: joined.rule, steps: [step] };
  }

  const last = parts.at(-1) ?? '';
  if (INFLECTIONAL.has(last) && !INFLECTIONAL.has(form)) {
    return {
      state: 'rule-blocked',
      word: joined.text,
      rule: 'inflection-order',
      reason: `-${last} 是屈折后缀，派生后缀 -${form} 不能接在它后面（应先派生再屈折）。`,
      steps: [step],
    };
  }

  const rootEndsInY = parts.some((p) => /[^aeiou]y$/.test(p));
  const yAlreadyBecameI = rootEndsInY && !context.word.endsWith('y') && /[^aeiou]i/.test(context.word);
  if (yAlreadyBecameI && form.startsWith('i')) {
    return {
      state: 'rule-blocked',
      word: joined.text,
      rule: 'i-conflict',
      reason: `词基的词尾 y 已经按 y→i 变成 i，再接 i 开头的 -${form} 会让这条拼写规则无法还原。`,
      steps: [step],
    };
  }

  const needed = requiredInput(form);
  if (needed && context.pos && !needed.includes(context.pos)) {
    const wanted = needed.map((p) => POS_ZH[p]).join(' / ');
    return {
      state: 'rule-blocked',
      word: joined.text,
      rule: 'pos-mismatch',
      reason: `-${form} 通常接${wanted}，而 ${context.word} 是${POS_ZH[context.pos]}，搭配不成立。`,
      steps: [step],
    };
  }

  return {
    state: 'unknown',
    word: joined.text,
    rule: joined.rule,
    reason: '拼写符合规则，但词库未收录该词（未收录 ≠ 不存在）；它可能是罕见词、专业术语，或英语里根本不使用这个组合。',
    steps: [step],
  };
}

/* ------------------------------------------------------------------ */
/* Families                                                            */
/* ------------------------------------------------------------------ */

/** Resolve a family reference: morpheme id, morpheme form, or a word spelling. */
export function resolveFamilyId(idOrForm: string): string | undefined {
  const raw = idOrForm.trim();
  if (!raw) return undefined;
  if (identity.byId(raw)) return raw;
  const resolved = identity.resolve(raw).id;
  if (resolved) return resolved;
  const entry = getWord(raw);
  if (entry) {
    const coreId = entry.partIds?.[rootIndexOf(entry.parts)];
    if (coreId) return coreId;
    return entry.parts.map((p) => identity.resolve(p).id).find(Boolean);
  }
  return undefined;
}

export function familyBaseForm(familyId: string): string | undefined {
  const id = resolveFamilyId(familyId);
  if (!id) return undefined;
  return identity.byId(id)?.form.replace(/^-+|-+$/g, '');
}

/** Every listed word built on one morpheme, with its derivation depth. */
export function familyMembers(familyId: string): { word: string; depth: number }[] {
  const id = resolveFamilyId(familyId);
  if (!id) return [];
  const members: { word: string; depth: number }[] = [];
  for (const entry of allWords()) {
    const ids = entry.partIds ?? entry.parts.map((p) => identity.resolve(p).id ?? null);
    if (!ids.includes(id)) continue;
    members.push({ word: entry.w, depth: Math.max(0, entry.parts.length - 1) });
  }
  return members.sort((a, b) => a.depth - b.depth || a.word.localeCompare(b.word));
}
