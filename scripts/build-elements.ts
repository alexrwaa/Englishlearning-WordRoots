/**
 * Turn the transcribed appendix table into the textbook element inventory and
 * (optionally) into morpheme records for the knowledge base.
 *
 *   npx tsx scripts/build-elements.ts            # write src/content/textbook/s1-elements.json
 *   npx tsx scripts/build-elements.ts --morphemes  # also emit missing morphemes as a batch
 *
 * Input : analysis/s1/appendix/part*.json  (page-by-page transcription)
 * Output: src/content/textbook/s1-elements.json
 *         analysis/lexicon-batches/from-textbook.json  (only with --morphemes)
 *
 * Nothing here invents a gloss or an origin: whatever the table says is copied,
 * and anything unreadable stays marked `?` so the coverage report can show it.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const APPENDIX = join(root, 'analysis/s1/appendix');
const TX = join(root, 'src/content/textbook');
const LEX = join(root, 'src/content/lexicon');
const BATCH = join(root, 'analysis/lexicon-batches');

type Raw = { element: string; gloss: string; chapter: string; source: string; page?: number; recoveredFrom?: string };
type Element = {
  id: string;
  element: string;
  forms: string[];
  type: 'prefix' | 'suffix' | 'root' | 'combining';
  gloss: string;
  chapter: string;
  source: string;
  page?: number;
  recoveredFrom?: string;
};

const raw: Raw[] = [];
for (const f of existsSync(APPENDIX) ? readdirSync(APPENDIX).sort() : []) {
  if (f.endsWith('.json')) {
    const part = JSON.parse(readFileSync(join(APPENDIX, f), 'utf-8')) as Raw[] | { rows?: Raw[] };
    const rows = Array.isArray(part) ? part : (part.rows ?? []);
    for (const r of rows) if (r.element) raw.push(r);
  } else if (f.endsWith('.txt')) {
    // page<TAB>element<TAB>gloss<TAB>chapter<TAB>source
    for (const line of readFileSync(join(APPENDIX, f), 'utf-8').split(/\r?\n/)) {
      if (!line.trim() || line.startsWith('#')) continue;
      const [page, element, gloss, chapter, source] = line.split('\t');
      if (!element) continue;
      // Pages may be numeric (appendix 1) or "A2:<page>" for entries recovered
      // from the reverse index after the A1/A2 cross-check (docs/APPENDIX_AUDIT.md).
      const recovered = page.startsWith('A2:');
      const pageNo = recovered ? Number(page.slice(3)) : Number(page);
      // Appendix 1 ("Elements to Glosses") ends on page 283; everything after is
      // the reverse index and would double-count the same elements.
      if (!recovered && pageNo && pageNo > 283) continue;
      raw.push({
        page: Number(pageNo) || undefined,
        element,
        gloss: gloss ?? '',
        chapter: chapter ?? '',
        source: source ?? '',
        ...(recovered ? { recoveredFrom: `appendix 2, p.${pageNo}` } : {}),
      } as Raw);
    }
  }
}

const seen = new Set<string>();
const usedIds = new Set<string>();
const elements: Element[] = [];

/** `L, G` -> `l-g`; `3, 4` -> `3-4`. Keeps IDs readable and filesystem-safe. */
function slug(value: string): string {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Stable element ID: `el-{form}-{origin}-{chapter}`, plus `-2`, `-3` when the
 * same three values occur twice (homographs inside one chapter). The counter
 * follows input order, so re-running on the same transcription reproduces the
 * same IDs — the old `el-{form}-{rest}` scheme collided silently instead.
 */
function elementId(forms: string[], source: string, chapter: string): string {
  const base = `el-${forms[0]}-${slug(source) || 'na'}-${slug(chapter) || 'na'}`;
  let id = base;
  let n = 2;
  while (usedIds.has(id)) id = `${base}-${n++}`;
  usedIds.add(id);
  return id;
}

for (const r of raw) {
  const variants = r.element
    .split('~')
    .map((v) => v.replace(/\([^)]*\)/g, '').trim())
    .filter(Boolean);
  if (!variants.length) continue;
  const forms = variants.map((v) => v.replace(/^-+|-+$/g, '').toLowerCase()).filter(Boolean);
  if (!forms.length) continue;
  // Same form + same chapter can still be two different elements (homographs);
  // include the gloss so the pair is preserved instead of silently merged.
  const key = `${forms[0]}|${r.chapter}|${(r.gloss ?? '').trim().toLowerCase()}`;
  if (seen.has(key)) continue;
  seen.add(key);

  const first = variants[0];
  const type: Element['type'] = first.startsWith('-') ? 'suffix' : first.endsWith('-') ? 'prefix' : forms.length > 1 ? 'root' : 'root';
  elements.push({
    id: elementId(forms, r.source ?? '', r.chapter ?? ''),
    element: r.element,
    forms,
    type,
    gloss: (r.gloss ?? '').trim(),
    chapter: (r.chapter ?? '').trim(),
    source: (r.source ?? '').trim(),
    page: r.page,
    ...(r.recoveredFrom ? { recoveredFrom: r.recoveredFrom } : {}),
  });
}

writeFileSync(
  join(TX, 's1-elements.json'),
  JSON.stringify({ sourceId: 'S1', generatedAt: new Date().toISOString(), count: elements.length, elements }, null, 1) + '\n',
  'utf-8',
);
console.log(`s1-elements.json: ${elements.length} elements from ${raw.length} rows`);
const byType = elements.reduce<Record<string, number>>((a, e) => ((a[e.type] = (a[e.type] ?? 0) + 1), a), {});
console.log('  types:', JSON.stringify(byType));
const unreadable = elements.filter((e) => e.gloss.includes('?') || e.element.includes('?'));
console.log(`  rows with unreadable characters: ${unreadable.length}`);

if (process.argv.includes('--morphemes')) {
  const existing = JSON.parse(readFileSync(join(LEX, 'morphemes.json'), 'utf-8')) as {
    form: string;
    allomorphs?: string[];
  }[];
  const known = new Set<string>();
  for (const m of existing) {
    known.add(m.form.toLowerCase());
    for (const a of m.allomorphs ?? []) known.add(a.toLowerCase());
  }

  const originMap: Record<string, string> = { L: 'Lat', G: 'Gk', OE: 'OE', F: 'Fr', ME: 'ME', It: 'It', Ar: 'Ar', Gk: 'Gk' };
  const morphemes = elements
    .filter((e) => !known.has(e.forms[0]))
    .map((e) => ({
      id: `cx-${e.forms[0]}${e.forms[1] ? '-' + e.forms[1] : ''}`.slice(0, 50),
      form: e.forms[0],
      type: e.type === 'prefix' ? 'prefix' : e.type === 'suffix' ? 'suffix' : 'root',
      origin: originMap[e.source] ?? 'unknown',
      glossZh: '',
      glossEn: e.gloss,
      allomorphs: e.forms.slice(1),
      examples: [] as string[],
      familyId: `fam-${e.forms[0]}`,
      textbookRefs: [`S1 C${e.chapter.replace(/\s+/g, '')}`],
      note: '',
      sources: [{ id: 'S1', title: 'English Vocabulary Elements', detail: `appendix, ch.${e.chapter}` }],
      needsChineseGloss: true,
    }));

  writeFileSync(
    join(BATCH, 'from-textbook.json'),
    JSON.stringify({ morphemes, words: [] }, null, 1) + '\n',
    'utf-8',
  );
  console.log(`batch: ${morphemes.length} new morphemes → analysis/lexicon-batches/from-textbook.json (glossZh still empty)`);
}
