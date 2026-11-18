/**
 * Morphology engine: word sums, word matrices and the orthographic rules that
 * connect a morpheme sequence to a real spelling.
 *
 * It deliberately refuses to "invent" words: a combination is only reported as
 * attested when it exists in the verified lexicon. Everything else is reported
 * as a structurally possible but unattested construction, which is the honest
 * answer and also what structured word inquiry teaches.
 */
import { getWord } from './content';
import type { WordEntry } from './types';

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

export interface SpellingStep {
  rule: string;
  before: string;
  after: string;
}

export interface BuildResult {
  word: string;
  steps: SpellingStep[];
  attested: boolean;
  entry?: WordEntry;
  /** True when the combination follows a known rule but is not in the lexicon. */
  plausible: boolean;
}

function joinPrefix(prefix: string, base: string): { text: string; steps: SpellingStep[] } {
  const p = prefix.replace(/-+$/, '');
  const steps: SpellingStep[] = [];
  const text = p + base;
  if (p.endsWith(base[0] ?? '')) {
    steps.push({ rule: 'prefix ends with the base’s first letter; keep both letters', before: `${p}+${base}`, after: text });
  }
  return { text, steps };
}

/**
 * Apply the standard suffixation spelling rules to base + suffix.
 * Order matters: replace-y, drop-e, then doubling checks.
 */
export function applySuffix(base: string, suffix: string): { text: string; steps: SpellingStep[] } {
  return applySuffixWith(base, suffix, true);
}

/**
 * Internal variant used by the word-sum checker. `allowDoubling=false` lets the
 * checker try the undoubled reading too: English only doubles a final CVC in a
 * stressed syllable, and the morphology engine has no stress data. Trying both
 * readings and keeping the one that produces the attested answer avoids false
 * rejections such as `loc + al` -> *loccal* while still accepting `run + er`
 * -> *runner*.
 */
function applySuffixWith(
  base: string,
  suffix: string,
  allowDoubling: boolean,
): { text: string; steps: SpellingStep[] } {
  const s = suffix.replace(/^-+/, '');
  const steps: SpellingStep[] = [];
  let stem = base;
  const vowelInitial = VOWELS.has(s[0] ?? '');
  const startsWithI = s.startsWith('i');

  // 1. consonant + y -> i (happy + ness -> happiness), but keep y before i
  //    (carry + ing -> carrying). The trigger is the spelling of the base,
  //    not the first letter of the suffix.
  if (/[^aeiou]y$/.test(stem) && !startsWithI && s.length > 0) {
    const before = stem;
    stem = stem.slice(0, -1) + 'i';
    steps.push({ rule: 'final y becomes i before a suffix that does not start with i', before, after: stem });
  }

  // 2. silent e drops before a vowel-initial suffix, except after soft c/g
  if (/e$/.test(stem) && vowelInitial && /[^cgs]e$/.test(stem)) {
    const before = stem;
    stem = stem.slice(0, -1);
    steps.push({ rule: 'silent e drops before a vowel-initial suffix', before, after: stem });
  }

  // 3. consonant doubling for short CVC bases before vowel-initial suffixes
  if (
    allowDoubling &&
    vowelInitial &&
    endsInCVC(stem) &&
    !/[wxy]$/.test(stem) &&
    s !== 'ing'
  ) {
    const last = stem.slice(-1);
    const before = stem;
    stem = stem + last;
    steps.push({ rule: 'final consonant doubles to keep the short vowel', before, after: stem });
  }

  const text = stem + s;
  if (text !== base + s) {
    steps.push({ rule: 'suffix attached', before: `${base}+${suffix}`, after: text });
  }
  return { text, steps };
}

export function endsInCVC(stem: string): boolean {
  if (stem.length < 3) return false;
  const [a, b, c] = [stem.at(-3)!, stem.at(-2)!, stem.at(-1)!];
  return !VOWELS.has(a) && VOWELS.has(b) && !VOWELS.has(c);
}

/** Build a word from prefix/base/suffix and check it against the lexicon. */
export function buildWord(prefix: string, base: string, suffix: string): BuildResult {
  const steps: SpellingStep[] = [];
  let text = base;

  if (prefix) {
    const r = joinPrefix(prefix, text);
    text = r.text;
    steps.push(...r.steps);
  }
  if (suffix) {
    const r = applySuffix(text, suffix);
    text = r.text;
    steps.push(...r.steps);
  }

  const entry = getWord(text);
  return {
    word: text,
    steps,
    attested: Boolean(entry),
    entry,
    plausible: steps.length > 0 || Boolean(prefix || suffix),
  };
}

/** Normalise a user-entered word sum: "un + help + ful" -> ["un","help","ful"] */
export function parseWordSum(input: string): string[] {
  return input
    .split(/[+＋]/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Normalise one morpheme for comparison: trim, lowercase and drop the leading
 * / trailing hyphens used in dictionary notation ("un-", "-ness"). Spelling
 * inside the morpheme is left untouched so a misspelt root still counts as a
 * different morpheme and gets the right feedback.
 */
export function normalizeMorpheme(part: string): string {
  return part
    .trim()
    .toLowerCase()
    .replace(/^[-–—]+/, '')
    .replace(/[-–—]+$/, '')
    .replace(/\s+/g, '');
}

export function normalizeParts(parts: readonly string[]): string[] {
  return parts.map(normalizeMorpheme).filter(Boolean);
}

/** Order-sensitive comparison: are these exactly the same morphemes in order? */
export function partsMatch(actual: readonly string[], expected: readonly string[]): boolean {
  const a = normalizeParts(actual);
  const b = normalizeParts(expected);
  return a.length === b.length && a.every((part, i) => part === b[i]);
}

/** Order-insensitive comparison: same morphemes, possibly in another order. */
export function samePartSet(actual: readonly string[], expected: readonly string[]): boolean {
  const a = normalizeParts(actual).sort();
  const b = normalizeParts(expected).sort();
  return a.length === b.length && a.every((part, i) => part === b[i]);
}

/** Render a word sum in the conventional SWI notation. */
export function formatWordSum(parts: string[], result?: string): string {
  const left = parts.join(' + ');
  return result ? `${left} → ${result}` : left;
}

/**
 * Prefixes whose final consonant assimilates to the first letter of the base.
 * Only the two-letter forms that actually change spelling are listed; a prefix
 * not in this table is joined verbatim (which is the normal case).
 */
const ASSIMILATION_VARIANTS: Record<string, readonly string[]> = {
  in: ['il', 'im', 'ir'],
  con: ['col', 'com', 'cor'],
  ad: ['ac', 'af', 'ag', 'al', 'ap', 'ar', 'as', 'at'],
  sub: ['suc', 'suf', 'sug', 'sup', 'sus'],
  ob: ['oc', 'of', 'op'],
  ex: ['ef'],
  dis: ['dif'],
  syn: ['sym'],
};

/** Join a prefix to a base, applying consonant assimilation when it is warranted. */
export function joinPrefixWithAssimilation(
  prefix: string,
  base: string,
): { text: string; step?: SpellingStep } {
  const p = prefix.replace(/-+$/, '').toLowerCase();
  const first = base[0]?.toLowerCase() ?? '';
  const variant = ASSIMILATION_VARIANTS[p]?.find((v) => v.endsWith(first));
  if (variant) {
    return {
      text: variant + base,
      step: {
        rule: 'prefix assimilates to the base’s first letter',
        before: `${prefix}+${base}`,
        after: variant + base,
      },
    };
  }
  return { text: p + base };
}

function joinSequentially(
  parts: string[],
  assimilateFirst = false,
  allowDoubling = true,
): { text: string; steps: SpellingStep[] } {
  const steps: SpellingStep[] = [];
  if (parts.length === 0) return { text: '', steps };
  let produced = parts[0].replace(/-+$/, '');
  if (assimilateFirst && parts.length > 1) {
    const joined = joinPrefixWithAssimilation(produced, parts[1].replace(/^-+/, ''));
    produced = joined.text;
    if (joined.step) steps.push(joined.step);
    for (const part of parts.slice(2)) {
      const r = applySuffixWith(produced, part.replace(/^-+/, ''), allowDoubling);
      produced = r.text;
      steps.push(...r.steps);
    }
    return { text: produced, steps };
  }
  for (const part of parts.slice(1)) {
    const r = applySuffixWith(produced, part.replace(/^-+/, ''), allowDoubling);
    produced = r.text;
    steps.push(...r.steps);
  }
  return { text: produced, steps };
}

/**
 * Check a word-sum answer: the parts must join to the target spelling.
 *
 * Two dimensions are tried because English orthography is ambiguous without
 * stress data: (a) the first morpheme may be an assimilating prefix
 * (`in + legal -> illegal`) or a base (`happy + ness`), and (b) a final CVC may
 * or may not double (`run + er -> runner` vs `loc + al -> local`). The target
 * answer selects the correct reading; a wrong reading can never manufacture a
 * different word. The plain sequential suffixation is tried first, so the
 * simple spelling always wins when it works.
 */
export function checkWordSum(parts: string[], target: string): { ok: boolean; produced: string; steps: SpellingStep[] } {
  const clean = normalizeParts(parts);
  if (clean.length === 0) return { ok: false, produced: '', steps: [] };
  const wanted = target.trim().toLowerCase();

  const candidates = [
    joinSequentially(clean, false, true),
    joinSequentially(clean, false, false),
  ];
  if (clean.length > 1) {
    candidates.push(joinSequentially(clean, true, true), joinSequentially(clean, true, false));
  }

  const match = candidates.find((candidate) => candidate.text.toLowerCase() === wanted);
  if (match) return { ok: true, produced: match.text, steps: match.steps };

  return { ok: false, produced: candidates[0].text, steps: candidates[0].steps };
}

/** Split a spelling into the given morphemes and report the spelling changes. */
export function explainSum(parts: string[], result: string): SpellingStep[] {
  const { produced, steps } = checkWordSum(parts, result);
  if (produced.toLowerCase() !== result.toLowerCase()) {
    steps.push({
      rule: 'surface spelling differs from a plain concatenation; this form must be learned as a whole',
      before: produced,
      after: result,
    });
  }
  return steps;
}

/** Levenshtein distance, used to give useful feedback on near-misses. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const prev = new Array<number>(n + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= m; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[n];
}
