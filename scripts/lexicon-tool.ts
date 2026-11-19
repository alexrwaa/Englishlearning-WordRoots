/**
 * Lexicon pipeline.
 *
 * Contributors (human or agent) write batches under `analysis/lexicon-batches/`
 * and this script merges them into the shipped JSON. Keeping the merge in one
 * place is what makes it possible to validate thousands of entries against one
 * schema instead of trusting whoever wrote the batch.
 *
 *   npx tsx scripts/lexicon-tool.ts stats
 *   npx tsx scripts/lexicon-tool.ts merge [--dry]
 *   npx tsx scripts/lexicon-tool.ts check
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadIdentity, normalizeForm, type FormIndex } from '../src/lib/identity';
import type { Morpheme as SharedMorpheme } from '../src/lib/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEX = join(root, 'src/content/lexicon');
const BATCH = join(root, 'analysis/lexicon-batches');

type Morpheme = {
  id: string;
  form: string;
  type: string;
  origin: string;
  glossZh: string;
  glossEn: string;
  allomorphs?: string[];
  examples?: string[];
  note?: string;
  sources?: { id: string; title: string; detail?: string }[];
  originalForm?: string;
  originalGloss?: string;
  familyId?: string;
  homographs?: { form: string; glossEn: string; origin: string; note?: string }[];
  rules?: string[];
  textbookRefs?: string[];
};

type WordEntry = {
  w: string;
  parts: string[];
  pos: string;
  glossZh: string;
  tags?: string[];
  domain?: string;
  glossEn?: string;
  etymology?: string;
  derivation?: string[];
  semanticShift?: string;
  family?: string;
  cognates?: string[];
  example?: string;
  verified?: boolean;
  sources?: { id: string; title: string; detail?: string }[];
  partIds?: (string | null)[];
  partResolution?: string;
};

const readJson = <T>(p: string, fallback: T): T =>
  existsSync(p) ? (JSON.parse(readFileSync(p, 'utf-8')) as T) : fallback;

/**
 * Natural key of a morpheme: spelling + source language + sense.
 *
 * Never the spelling alone. `plac` is Latin "please" and Greek "flat"; keying
 * a merge on the form is exactly how the Greek sense disappeared the first
 * time, because the second batch silently overwrote the first.
 */
function naturalKey(m: { form: string; origin: string; senseKey?: string }): string {
  // A morpheme's identity is form + origin + sense. A batch that writes the same
  // morpheme with different wording for its gloss must enrich the existing
  // record, not create a second entity — that bug produced px-in-lat-3/4.
  return `${normalizeForm(m.form)}|${m.origin}|${m.senseKey ?? 'primary'}`;
}

/** Canonical form index (`form -> [id…]`) regenerated after every merge. */
function writeForms(morphemes: Morpheme[]) {
  const forms: FormIndex = {};
  for (const m of morphemes) {
    const key = normalizeForm(m.form);
    if (!key) continue;
    const list = forms[key] ?? (forms[key] = []);
    if (!list.includes(m.id)) list.push(m.id);
  }
  const ordered: FormIndex = {};
  for (const key of Object.keys(forms).sort()) ordered[key] = forms[key].sort();
  writeFileSync(join(LEX, 'forms.json'), JSON.stringify(ordered, null, 2) + '\n', 'utf-8');
}

function stats() {
  const morphemes = readJson<Morpheme[]>(join(LEX, 'morphemes.json'), []);
  const words = readJson<WordEntry[]>(join(LEX, 'words.json'), []);
  const batches = existsSync(BATCH) ? readdirSync(BATCH).filter((f) => f.endsWith('.json')) : [];

  const byOrigin = new Map<string, number>();
  for (const m of morphemes) byOrigin.set(m.origin, (byOrigin.get(m.origin) ?? 0) + 1);
  const byType = new Map<string, number>();
  for (const m of morphemes) byType.set(m.type, (byType.get(m.type) ?? 0) + 1);

  const wordsWithEtymology = words.filter((w) => w.etymology).length;
  const wordsVerified = words.filter((w) => w.verified).length;
  const familyless = morphemes.filter((m) => !m.familyId).length;

  console.log(`morphemes: ${morphemes.length}  (no familyId: ${familyless})`);
  console.log('  by origin:', [...byOrigin].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' '));
  console.log('  by type:  ', [...byType].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' '));
  console.log(`words: ${words.length}  (with etymology: ${wordsWithEtymology}, verified: ${wordsVerified})`);
  console.log(`batches: ${batches.length}  ${batches.join(', ') || '(none)'}`);
}

function check(verbose = true): boolean {
  const morphemes = readJson<Morpheme[]>(join(LEX, 'morphemes.json'), []);
  const words = readJson<WordEntry[]>(join(LEX, 'words.json'), []);
  const formsIndex = readJson<FormIndex>(join(LEX, 'forms.json'), {});
  const identity = loadIdentity(morphemes as unknown as SharedMorpheme[], formsIndex);
  const ids = new Set<string>();
  const problems: string[] = [];

  for (const m of morphemes) {
    if (!m.id || !m.form || !m.type || !m.origin) problems.push(`morpheme missing id/form/type/origin: ${JSON.stringify(m).slice(0, 80)}`);
    if (ids.has(m.id)) problems.push(`duplicate morpheme id: ${m.id}`);
    ids.add(m.id);
    if (!m.glossZh && !m.glossEn) problems.push(`morpheme has no gloss: ${m.id}`);
  }

  // Same form + same origin + same gloss twice is a duplicate record; the same
  // form with a *different* gloss is a legitimate homograph and must stay.
  const byNaturalKey = new Map<string, string>();
  for (const m of morphemes) {
    const key = naturalKey(m);
    const first = byNaturalKey.get(key);
    if (first) problems.push(`duplicate record for ${key} (${first} / ${m.id})`);
    else byNaturalKey.set(key, m.id);
  }

  // Parts are resolved through the identity index, not by string matching.
  let resolvedParts = 0;
  let ambiguousParts = 0;
  const unresolved = new Map<string, number>();
  let wordsExact = 0;
  const seenWords = new Set<string>();
  for (const w of words) {
    if (!w.w || !Array.isArray(w.parts) || w.parts.length === 0) problems.push(`word missing w/parts: ${JSON.stringify(w).slice(0, 80)}`);
    if (!w.glossZh) problems.push(`word without Chinese gloss: ${w.w}`);
    const key = w.w?.toLowerCase();
    if (key && seenWords.has(key)) problems.push(`duplicate word: ${w.w}`);
    if (key) seenWords.add(key);
    let allResolved = true;
    for (const p of w.parts ?? []) {
      const result = identity.resolve(p);
      if (result.id) resolvedParts += 1;
      else {
        allResolved = false;
        if (result.ambiguous) ambiguousParts += 1;
        else unresolved.set(p, (unresolved.get(p) ?? 0) + 1);
      }
    }
    if (allResolved && w.parts?.length) wordsExact += 1;
  }

  const topUnresolved = [...unresolved].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log(`checked ${morphemes.length} morphemes, ${words.length} words`);
  console.log(
    `parts: ${resolvedParts} resolved to one ID, ${ambiguousParts} ambiguous, ${[...unresolved.values()].reduce((a, b) => a + b, 0)} with no morpheme record`,
  );
  console.log(`words with a fully resolved split: ${wordsExact}/${words.length}`);
  console.log(`parts without a morpheme record: ${unresolved.size} distinct forms`);
  if (topUnresolved.length) {
    console.log('  worst offenders:', topUnresolved.map(([k, v]) => `${k}(${v})`).join(' '));
  }
  const ambiguousForms = identity.stats().ambiguousForms;
  if (ambiguousForms.length) {
    console.log(`homograph spellings (intentionally ambiguous): ${ambiguousForms.join(', ')}`);
  }
  if (problems.length) {
    console.log(`✖ ${problems.length} problems`);
    if (verbose) problems.slice(0, 40).forEach((p) => console.log('  -', p));
    return false;
  }
  console.log('✓ lexicon consistent');
  return true;
}

function normParts(parts: string[]): string[] {
  return parts.map((p) => p.trim().toLowerCase()).filter(Boolean);
}

const KIND_OF: Record<string, string> = {
  root: 'rx',
  prefix: 'px',
  suffix: 'sx',
  combining: 'cx',
};

/** A batch entry without an ID gets one from its type + form, never a bare form. */
function assignId(m: Morpheme, taken: Set<string>): string {
  if (m.id) return m.id;
  const kind = KIND_OF[m.type] ?? 'cx';
  const root = `${kind}-${normalizeForm(m.form)}`;
  if (!taken.has(root)) return root;
  const withOrigin = `${root}-${m.origin.toLowerCase()}`;
  if (!taken.has(withOrigin)) return withOrigin;
  let n = 2;
  while (taken.has(`${withOrigin}-${n}`)) n += 1;
  return `${withOrigin}-${n}`;
}

/**
 * Last-resort match: if exactly one record shares form + origin, a batch entry
 * without an explicit senseKey is almost certainly that record with different
 * wording. Two or more candidates means it is genuinely ambiguous — refuse to
 * guess and let it be added (the identity pass will disambiguate it).
 */
function uniqueByFormOrigin(m: { form: string; origin: string }, morphemes: Morpheme[]): Morpheme | undefined {
  const hits = morphemes.filter(
    (x) => normalizeForm(x.form) === normalizeForm(m.form) && x.origin === m.origin,
  );
  return hits.length === 1 ? hits[0] : undefined;
}

function merge(dry: boolean) {
  if (!existsSync(BATCH)) {
    console.log('no batch directory');
    return;
  }
  const morphemes = readJson<Morpheme[]>(join(LEX, 'morphemes.json'), []);
  const words = readJson<WordEntry[]>(join(LEX, 'words.json'), []);

  // Two keys, both identity-carrying: the ID (stable) and the natural key
  // form+origin+gloss (what "same morpheme" actually means). The spelling is
  // never a key on its own.
  const byId = new Map<string, Morpheme>();
  const byNaturalKey = new Map<string, Morpheme>();
  for (const m of morphemes) {
    byId.set(m.id, m);
    byNaturalKey.set(naturalKey(m), m);
  }
  const wordBySpelling = new Map<string, WordEntry>();
  for (const w of words) wordBySpelling.set(w.w.toLowerCase(), w);

  let addedM = 0;
  let enrichedM = 0;
  let addedW = 0;
  let enrichedW = 0;
  let reparted = 0;
  const rejected: string[] = [];
  const takenIds = new Set(morphemes.map((m) => m.id));

  for (const file of readdirSync(BATCH).filter((f) => f.endsWith('.json')).sort()) {
    const payload = readJson<{ morphemes?: Morpheme[]; words?: WordEntry[] }>(join(BATCH, file), {});
    for (const m of payload.morphemes ?? []) {
      if (!m.form) {
        rejected.push(`${file}: morpheme without form`);
        continue;
      }
      const existing =
        (m.id ? byId.get(m.id) : undefined) ??
        byNaturalKey.get(naturalKey(m)) ??
        byNaturalKey.get(`${normalizeForm(m.form)}|${m.origin}|${normalizeForm(m.glossEn ?? '')}`) ??
        uniqueByFormOrigin(m, morphemes);
      if (!existing) {
        const id = assignId(m, takenIds);
        const record = { ...m, id };
        morphemes.push(record);
        takenIds.add(id);
        byId.set(id, record);
        byNaturalKey.set(naturalKey(record), record);
        addedM += 1;
        continue;
      }
      // Never let a batch overwrite curated fields with empties.
      let touched = false;
      for (const field of ['originalForm', 'originalGloss', 'familyId', 'note'] as const) {
        if (!existing[field] && m[field]) {
          (existing as Record<string, unknown>)[field] = m[field];
          touched = true;
        }
      }
      for (const field of ['allomorphs', 'examples', 'rules', 'textbookRefs'] as const) {
        const cur = (existing[field] ?? []) as string[];
        const add = (m[field] ?? []) as string[];
        const merged = [...new Set([...cur, ...add])];
        if (merged.length !== cur.length) {
          (existing as Record<string, unknown>)[field] = merged;
          touched = true;
        }
      }
      if (touched) enrichedM += 1;
    }

    for (const w of payload.words ?? []) {
      if (!w.w || !w.parts) {
        rejected.push(`${file}: word without spelling/parts`);
        continue;
      }
      const key = w.w.toLowerCase();
      const existing = wordBySpelling.get(key);
      if (!existing) {
        const clean = { ...(w as WordEntry & { needsChineseGloss?: boolean }) };
        delete clean.needsChineseGloss;
        const record: WordEntry = { ...clean, parts: normParts(w.parts) };
        words.push(record);
        wordBySpelling.set(key, record);
        addedW += 1;
      } else {
        let touched = false;
        for (const field of ['glossEn', 'etymology', 'semanticShift', 'family', 'example', 'pos'] as const) {
          if (!existing[field] && w[field]) {
            (existing as Record<string, unknown>)[field] = w[field];
            touched = true;
          }
        }
        if (!existing.derivation?.length && w.derivation?.length) {
          existing.derivation = w.derivation;
          touched = true;
        }
        // A later batch may correct a wrong morphological split (ex+pect, not
        // exs+pect). Parts are the one field worth overwriting, because a stale
        // split silently corrupts the matrix and the derivation tree.
        const nextParts = normParts(w.parts);
        if (nextParts.length && nextParts.join('+') !== (existing.parts ?? []).join('+')) {
          if (w.verified !== false) {
            existing.parts = nextParts;
            // The old IDs no longer describe the new split; the identity
            // migration recomputes them. Stale IDs are worse than missing ones.
            delete existing.partIds;
            delete existing.partResolution;
            reparted += 1;
            touched = true;
          }
        }
        if (touched) enrichedW += 1;
      }
    }
  }

  words.sort((a, b) => a.w.localeCompare(b.w));
  morphemes.sort((a, b) => a.form.localeCompare(b.form) || a.id.localeCompare(b.id));

  console.log(`morphemes +${addedM} (~${enrichedM} enriched) → ${morphemes.length}`);
  console.log(`words +${addedW} (~${enrichedW} enriched, ${reparted} re-split) → ${words.length}`);
  if (rejected.length) console.log('rejected:', rejected.slice(0, 10).join('; '));

  if (!dry) {
    mkdirSync(LEX, { recursive: true });
    writeFileSync(join(LEX, 'morphemes.json'), JSON.stringify(morphemes, null, 2) + '\n', 'utf-8');
    writeFileSync(join(LEX, 'words.json'), JSON.stringify(words, null, 2) + '\n', 'utf-8');
    writeForms(morphemes);
    console.log('written (forms.json regenerated)');
    if (reparted > 0 || addedM > 0) {
      console.log('next: npx tsx scripts/identity-migrate.ts   # refresh partIds / morphemeIds');
    }
  } else {
    console.log('(dry run)');
  }
}

const cmd = process.argv[2] ?? 'stats';
if (cmd === 'stats') stats();
else if (cmd === 'check') process.exit(check() ? 0 : 1);
else if (cmd === 'merge') merge(process.argv.includes('--dry'));
else {
  console.log('usage: stats | merge [--dry] | check');
  process.exit(1);
}
