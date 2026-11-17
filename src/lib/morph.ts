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
  if (vowelInitial && endsInCVC(stem) && !/[wxy]$/.test(stem) && s !== 'ing') {
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

/** Render a word sum in the conventional SWI notation. */
export function formatWordSum(parts: string[], result?: string): string {
  const left = parts.join(' + ');
  return result ? `${left} → ${result}` : left;
}

/** Check a word-sum answer: the parts must join to the target spelling. */
export function checkWordSum(parts: string[], target: string): { ok: boolean; produced: string; steps: SpellingStep[] } {
  const clean = parts.map((p) => p.trim()).filter(Boolean);
  if (clean.length === 0) return { ok: false, produced: '', steps: [] };
  let produced = clean[0].replace(/-+$/, '');
  const steps: SpellingStep[] = [];
  for (const part of clean.slice(1)) {
    const r = applySuffix(produced, part.replace(/^-+/, ''));
    produced = r.text;
    steps.push(...r.steps);
  }
  return { ok: produced.toLowerCase() === target.toLowerCase(), produced, steps };
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
