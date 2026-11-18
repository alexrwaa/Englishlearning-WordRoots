/**
 * Assemble the chapter/knowledge-point model from the extraction fragments.
 *
 * Extractions arrive in pieces (one file per chapter range, sometimes written by
 * different runs), so this script is deliberately forgiving:
 *   - a truncated JSON fragment is closed by scanning bracket depth;
 *   - `wordElements` / `exerciseTypes` are hoisted from section level to chapter
 *     level when a contributor nested them one level too deep;
 *   - duplicate knowledge-point ids keep the first occurrence.
 *
 *   npx tsx scripts/build-textbook.ts
 *
 * Output: src/content/textbook/s1-chapters.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'analysis/s1/knowledge');
const OUT = join(root, 'src/content/textbook/s1-chapters.json');

type Kp = { id: string; title: string; type: string; summary: string; terms?: string[]; examples?: string[]; lessonHint?: string };
type Section = { id: string; title: string; knowledgePoints: Kp[]; wordElements?: unknown[]; exerciseTypes?: unknown[] };
type Chapter = { id: string; chapter: number; title: string; sections: Section[]; wordElements?: unknown[]; exerciseTypes?: unknown[] };

/** Close a JSON document that was cut off mid-write. */
function looseParse(text: string): unknown {
  const clean = text.replace(/^\uFEFF/, '');
  try {
    return JSON.parse(clean);
  } catch {
    const stack: string[] = [];
    let inStr = false;
    let esc = false;
    for (const ch of clean) {
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === '{' || ch === '[') stack.push(ch);
      else if (ch === '}' || ch === ']') stack.pop();
    }
    const closers = stack
      .reverse()
      .map((c) => (c === '{' ? '}' : ']'))
      .join('');
    const body = clean.trimEnd().replace(/,$/, '');
    return JSON.parse(body + closers);
  }
}

const fragments = ['part1.json', 'part2.fixed.json', 'part2.json', 'part3.json', 'part4.json'].filter((f) =>
  existsSync(join(SRC, f)),
);

const chapters = new Map<string, Chapter>();
const skips: string[] = [];

for (const file of fragments) {
  const raw = readFileSync(join(SRC, file), 'utf-8');
  let parsed: { chapters?: Chapter[] };
  try {
    parsed = looseParse(raw) as { chapters?: Chapter[] };
  } catch (err) {
    skips.push(`${file}: ${(err as Error).message}`);
    continue;
  }
  for (const c of parsed.chapters ?? []) {
    if (!c?.id) continue;
    if (!chapters.has(c.id)) {
      chapters.set(c.id, { ...c, sections: [], wordElements: [], exerciseTypes: [] });
    }
    const target = chapters.get(c.id)!;

    for (const s of c.sections ?? []) {
      if (!s?.id || !Array.isArray(s.knowledgePoints)) continue;
      // Hoist contributor mistakes one level up instead of losing the data.
      for (const el of (s.wordElements ?? []) as unknown[]) target.wordElements!.push(el);
      for (const ex of (s.exerciseTypes ?? []) as unknown[]) target.exerciseTypes!.push(ex);
      const existing = target.sections.find((x) => x.id === s.id);
      const clean: Section = { id: s.id, title: s.title, knowledgePoints: s.knowledgePoints };
      if (existing) {
        const ids = new Set(existing.knowledgePoints.map((k) => k.id));
        for (const kp of s.knowledgePoints) if (!ids.has(kp.id)) existing.knowledgePoints.push(kp);
      } else {
        target.sections.push(clean);
      }
    }
    for (const el of (c.wordElements ?? []) as unknown[]) target.wordElements!.push(el);
    for (const ex of (c.exerciseTypes ?? []) as unknown[]) target.exerciseTypes!.push(ex);
  }
}

// Dedupe elements, but a bare form is not a unique key: the textbook teaches
// homographs that differ in origin and meaning (plac 'flat' Greek vs plac
// 'please' Latin; par 'produce' vs par 'equal'). Key on form + source + gloss.
for (const c of chapters.values()) {
  const seen = new Set<string>();
  c.wordElements = (c.wordElements ?? []).filter((el) => {
    const e = el as { form?: string; source?: string; gloss?: string };
    const form = String(e.form ?? '').toLowerCase();
    if (!form) return false;
    const key = `${form}|${String(e.source ?? '').toLowerCase()}|${String(e.gloss ?? '').toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  c.sections.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

const ordered = [...chapters.values()].sort((a, b) => a.chapter - b.chapter);
const kpCount = ordered.reduce((a, c) => a + c.sections.reduce((x, s) => x + s.knowledgePoints.length, 0), 0);
const elCount = ordered.reduce((a, c) => a + (c.wordElements?.length ?? 0), 0);

writeFileSync(
  OUT,
  JSON.stringify({ sourceId: 'S1', generatedAt: new Date().toISOString(), chapters: ordered }, null, 1) + '\n',
  'utf-8',
);

console.log(`s1-chapters.json: ${ordered.length} chapters, ${ordered.reduce((a, c) => a + c.sections.length, 0)} sections`);
console.log(`  knowledge points: ${kpCount}`);
console.log(`  chapter wordElements: ${elCount}`);
for (const c of ordered) {
  const kps = c.sections.reduce((a, s) => a + s.knowledgePoints.length, 0);
  console.log(`  ${c.id} ${String(c.title).slice(0, 38).padEnd(40)} sections=${String(c.sections.length).padStart(2)} kps=${String(kps).padStart(3)} elements=${String(c.wordElements?.length ?? 0).padStart(3)}`);
}
if (skips.length) console.log('skipped fragments:', skips.join('; '));
