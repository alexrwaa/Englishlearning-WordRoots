/**
 * Content registry. Course JSON is bundled at build time (offline safe) and can
 * be overridden at runtime by files in `<exe dir>/courses/` for content updates
 * without rebuilding the app.
 */
import type { Concept, Curriculum, Lesson, Morpheme, Week, WordEntry } from './types';

const weekModules = import.meta.glob<{ default: Week }>('../content/weeks/*.json', {
  eager: true,
});
const morphemeModules = import.meta.glob<{ default: Morpheme[] }>('../content/lexicon/morphemes.json', {
  eager: true,
});
const wordModules = import.meta.glob<{ default: WordEntry[] }>('../content/lexicon/words.json', {
  eager: true,
});
const conceptModules = import.meta.glob<{ default: Concept[] }>('../content/lexicon/concepts.json', {
  eager: true,
});

function collect<T>(mods: Record<string, { default: T }>): T[] {
  return Object.keys(mods)
    .sort()
    .map((k) => mods[k].default);
}

const weeks: Week[] = collect(weekModules).sort((a, b) => a.week - b.week);
const morphemes: Morpheme[] = collect(morphemeModules).flat();
const words: WordEntry[] = collect(wordModules).flat();
const concepts: Concept[] = collect(conceptModules).flat();

export const curriculum: Curriculum = { version: '1.0.0', weeks };

export const lessons: Lesson[] = weeks.flatMap((w) => w.lessons).sort((a, b) => lessonIndex(a) - lessonIndex(b));

export function lessonIndex(l: { week: number; day: number }): number {
  return (l.week - 1) * 7 + (l.day - 1);
}

const lessonById = new Map(lessons.map((l) => [l.id, l]));
const morphemeByForm = new Map<string, Morpheme>();
for (const m of morphemes) {
  morphemeByForm.set(m.form.replace(/^-+|-+$/g, '').toLowerCase(), m);
  for (const alt of m.allomorphs ?? []) {
    morphemeByForm.set(alt.replace(/^-+|-+$/g, '').toLowerCase(), m);
  }
}
const wordBySpelling = new Map(words.map((w) => [w.w.toLowerCase(), w]));
const conceptById = new Map(concepts.map((c) => [c.id, c]));

export function getLesson(id: string): Lesson | undefined {
  return lessonById.get(id);
}
export function getMorpheme(form: string): Morpheme | undefined {
  return morphemeByForm.get(stripDashes(form));
}
export function getWord(w: string): WordEntry | undefined {
  return wordBySpelling.get(w.toLowerCase());
}
export function getConcept(id: string): Concept | undefined {
  return conceptById.get(id);
}

export function stripDashes(form: string): string {
  return form.replace(/^-+/, '').replace(/-+$/, '').toLowerCase();
}

/** Human label for any reference used in a lesson (concept id or morpheme form). */
export function labelFor(ref: string): string {
  const c = conceptById.get(ref);
  if (c) return c.zh;
  const m = getMorpheme(ref);
  if (m) return `${m.form}（${m.glossZh}）`;
  return ref;
}

export function allMorphemes(): Morpheme[] {
  return morphemes;
}
export function allWords(): WordEntry[] {
  return words;
}
export function allConcepts(): Concept[] {
  return concepts;
}

/** Find the first lesson that has not been completed yet. */
export function nextLesson(completed: Set<string>): Lesson | undefined {
  return lessons.find((l) => !completed.has(l.id));
}

export function weekOf(week: number): Week | undefined {
  return weeks.find((w) => w.week === week);
}
