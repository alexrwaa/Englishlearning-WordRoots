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
};

const readJson = <T>(p: string, fallback: T): T =>
  existsSync(p) ? (JSON.parse(readFileSync(p, 'utf-8')) as T) : fallback;

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
  const ids = new Set<string>();
  const problems: string[] = [];

  for (const m of morphemes) {
    if (!m.id || !m.form || !m.type || !m.origin) problems.push(`morpheme missing id/form/type/origin: ${JSON.stringify(m).slice(0, 80)}`);
    if (ids.has(m.id)) problems.push(`duplicate morpheme id: ${m.id}`);
    ids.add(m.id);
    if (!m.glossZh && !m.glossEn) problems.push(`morpheme has no gloss: ${m.id}`);
  }

  const forms = new Set<string>();
  for (const m of morphemes) {
    forms.add(m.form.toLowerCase());
    for (const a of m.allomorphs ?? []) forms.add(a.toLowerCase());
  }

  const seen = new Set<string>();
  const unresolved = new Map<string, number>();
  for (const w of words) {
    if (!w.w || !Array.isArray(w.parts) || w.parts.length === 0) problems.push(`word missing w/parts: ${JSON.stringify(w).slice(0, 80)}`);
    const key = w.w.toLowerCase();
    if (seen.has(key)) problems.push(`duplicate word: ${w.w}`);
    seen.add(key);
    if (!w.glossZh) problems.push(`word without Chinese gloss: ${w.w}`);
    for (const p of w.parts ?? []) {
      const norm = p.replace(/^-+|-+$/g, '').toLowerCase();
      if (!forms.has(norm) && !forms.has(p.toLowerCase())) {
        unresolved.set(p, (unresolved.get(p) ?? 0) + 1);
      }
    }
  }

  const topUnresolved = [...unresolved].sort((a, b) => b[1] - a[1]).slice(0, 25);
  console.log(`checked ${morphemes.length} morphemes, ${words.length} words`);
  console.log(`parts without a morpheme record: ${unresolved.size} distinct forms`);
  if (topUnresolved.length) {
    console.log('  worst offenders:', topUnresolved.map(([k, v]) => `${k}(${v})`).join(' '));
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

function merge(dry: boolean) {
  if (!existsSync(BATCH)) {
    console.log('no batch directory');
    return;
  }
  const morphemes = readJson<Morpheme[]>(join(LEX, 'morphemes.json'), []);
  const words = readJson<WordEntry[]>(join(LEX, 'words.json'), []);

  const morphByForm = new Map<string, Morpheme>();
  for (const m of morphemes) morphByForm.set(m.form.toLowerCase(), m);
  const wordBySpelling = new Map<string, WordEntry>();
  for (const w of words) wordBySpelling.set(w.w.toLowerCase(), w);

  let addedM = 0;
  let enrichedM = 0;
  let addedW = 0;
  let enrichedW = 0;
  let reparted = 0;
  const rejected: string[] = [];

  for (const file of readdirSync(BATCH).filter((f) => f.endsWith('.json')).sort()) {
    const payload = readJson<{ morphemes?: Morpheme[]; words?: WordEntry[] }>(join(BATCH, file), {});
    for (const m of payload.morphemes ?? []) {
      if (!m.form || !m.id) {
        rejected.push(`${file}: morpheme without form/id`);
        continue;
      }
      const key = m.form.toLowerCase();
      const existing = morphByForm.get(key);
      if (!existing) {
        morphemes.push(m);
        morphByForm.set(key, m);
        addedM += 1;
      } else {
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
        words.push({ ...clean, parts: normParts(w.parts) });
        wordBySpelling.set(key, w);
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
            reparted += 1;
            touched = true;
          }
        }
        if (touched) enrichedW += 1;
      }
    }
  }

  words.sort((a, b) => a.w.localeCompare(b.w));
  morphemes.sort((a, b) => a.form.localeCompare(b.form));

  console.log(`morphemes +${addedM} (~${enrichedM} enriched) → ${morphemes.length}`);
  console.log(`words +${addedW} (~${enrichedW} enriched, ${reparted} re-split) → ${words.length}`);
  if (rejected.length) console.log('rejected:', rejected.slice(0, 10).join('; '));

  if (!dry) {
    mkdirSync(LEX, { recursive: true });
    writeFileSync(join(LEX, 'morphemes.json'), JSON.stringify(morphemes, null, 2) + '\n', 'utf-8');
    writeFileSync(join(LEX, 'words.json'), JSON.stringify(words, null, 2) + '\n', 'utf-8');
    console.log('written');
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
