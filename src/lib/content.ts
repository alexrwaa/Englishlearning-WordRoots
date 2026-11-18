/**
 * Content registry. Course JSON is bundled at build time (offline safe).
 *
 * Layout: `content/weeks/weekNN/meta.json` (week theme) plus one file per day
 * (`day1.json` … `day7.json`). Splitting the week into per-day files keeps the
 * content pipeline mergeable: several authors can write different days of the
 * same week without touching the same file.
 */
import type { Concept, Curriculum, Lesson, Morpheme, Week, WordEntry } from './types';

const weekModules = import.meta.glob<{ default: unknown }>('../content/weeks/**/*.json', {
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

interface WeekMeta {
  week: number;
  theme: string;
  intro: string;
}

const weekMetas = new Map<number, WeekMeta>();
const weekLessons = new Map<number, Lesson[]>();

for (const [path, mod] of Object.entries(weekModules)) {
  const match = /weeks\/week(\d{2})\/(.+)\.json$/.exec(path);
  if (!match) continue;
  const weekNo = Number(match[1]);
  const file = match[2];
  if (file === 'meta') {
    weekMetas.set(weekNo, mod.default as WeekMeta);
  } else {
    const lesson = mod.default as Lesson;
    const list = weekLessons.get(weekNo) ?? [];
    list.push(lesson);
    weekLessons.set(weekNo, list);
  }
}

function collect<T>(mods: Record<string, { default: T }>): T[] {
  return Object.keys(mods)
    .sort()
    .map((k) => mods[k].default);
}

const weeks: Week[] = [...weekMetas.entries()]
  .sort((a, b) => a[0] - b[0])
  .map(([weekNo, meta]) => ({
    week: weekNo,
    theme: meta.theme,
    intro: meta.intro,
    lessons: (weekLessons.get(weekNo) ?? []).sort((a, b) => a.day - b.day),
  }));
const morphemes: Morpheme[] = collect(morphemeModules).flat();
const words: WordEntry[] = collect(wordModules).flat();
const concepts: Concept[] = collect(conceptModules).flat();

export const curriculum: Curriculum = { version: '1.0.0', weeks };

export const lessons: Lesson[] = weeks.flatMap((w) => w.lessons).sort((a, b) => lessonIndex(a) - lessonIndex(b));

/* ------------------------------------------------------------------------- *
 * External course packs
 *
 * The build embeds the course JSON, so the app always has a complete, working
 * curriculum. A folder next to the executable may carry a newer pack
 * (`courses/`); it is used only when it is complete and schema-compatible, and
 * the containers above are mutated in place so every existing consumer keeps
 * working without a reload.
 * ------------------------------------------------------------------------- */

export interface CoursePackWeek {
  meta?: { week?: number; theme?: string; intro?: string } | null;
  days: Lesson[];
}

export interface CoursePack {
  source: string;
  contentVersion: string;
  schemaVersion: number;
  weekCount: number;
  dayCount: number;
  weeks: CoursePackWeek[];
  lexicon: {
    morphemes?: Morpheme[];
    words?: WordEntry[];
    concepts?: Concept[];
  };
  problems: string[];
}

export type ContentSource = 'embedded' | 'external';

export interface ContentStatus {
  source: ContentSource;
  contentVersion: string;
  reason?: string;
  problems: string[];
}

const EMBEDDED_DAYS = lessons.length;
const EMBEDDED_WEEKS = weeks.length;
export const CONTENT_SCHEMA_VERSION = 1;

const status: ContentStatus = { source: 'embedded', contentVersion: 'embedded', problems: [] };

export function contentStatus(): ContentStatus {
  return status;
}

function rebuildIndexes() {
  lessonById.clear();
  for (const l of lessons) lessonById.set(l.id, l);

  morphemeByForm.clear();
  for (const m of morphemes) {
    morphemeByForm.set(stripDashes(m.form), m);
    for (const alt of m.allomorphs ?? []) morphemeByForm.set(stripDashes(alt), m);
  }

  wordBySpelling.clear();
  for (const w of words) wordBySpelling.set(w.w.toLowerCase(), w);

  conceptById.clear();
  for (const c of concepts) conceptById.set(c.id, c);
}

function replaceArray<T>(target: T[], next: T[]) {
  target.length = 0;
  target.push(...next);
}

interface PackCheck {
  ok: boolean;
  reason?: string;
}

/** A pack is usable only when it is complete and matches the schema we parse. */
export function checkCoursePack(pack: CoursePack | null | undefined): PackCheck {
  if (!pack || pack.source !== 'external') return { ok: false, reason: '没有可用的外部课程包' };
  if (pack.schemaVersion !== CONTENT_SCHEMA_VERSION) {
    return { ok: false, reason: `课程包 schema v${pack.schemaVersion}，本程序只支持 v${CONTENT_SCHEMA_VERSION}` };
  }
  if (pack.problems?.length) return { ok: false, reason: `课程包存在问题：${pack.problems[0]}` };
  if (pack.weekCount < EMBEDDED_WEEKS) {
    return { ok: false, reason: `课程包只有 ${pack.weekCount} 周，少于内置的 ${EMBEDDED_WEEKS} 周` };
  }
  if (pack.dayCount < EMBEDDED_DAYS) {
    return { ok: false, reason: `课程包只有 ${pack.dayCount} 天，少于内置的 ${EMBEDDED_DAYS} 天` };
  }
  const ids = new Set<string>();
  for (const [i, week] of pack.weeks.entries()) {
    if (!Array.isArray(week.days) || week.days.length === 0) {
      return { ok: false, reason: `第 ${i + 1} 周没有课程` };
    }
    for (const day of week.days) {
      if (!day?.id || !Array.isArray(day.cards) || day.cards.length === 0) {
        return { ok: false, reason: `第 ${i + 1} 周存在缺少卡片或 id 的课程` };
      }
      if (ids.has(day.id)) return { ok: false, reason: `课程 id 重复：${day.id}` };
      ids.add(day.id);
    }
  }
  return { ok: true };
}

/**
 * Swap the in-memory curriculum for an external pack.
 * Returns false (and changes nothing) when the pack is not usable.
 */
export function applyCoursePack(pack: CoursePack | null | undefined): boolean {
  const check = checkCoursePack(pack);
  if (!check.ok || !pack) {
    status.reason = check.reason;
    return false;
  }

  const nextWeeks: Week[] = pack.weeks.map((w, i) => ({
    week: w.meta?.week ?? i + 1,
    theme: w.meta?.theme ?? w.days[0]?.title ?? `第 ${i + 1} 周`,
    intro: w.meta?.intro ?? w.days[0]?.objectives?.[0] ?? '',
    lessons: [...w.days].sort((a, b) => a.day - b.day),
  }));
  const nextLessons = nextWeeks
    .flatMap((w) => w.lessons)
    .sort((a, b) => lessonIndex(a) - lessonIndex(b));

  replaceArray(weeks, nextWeeks);
  replaceArray(lessons, nextLessons);
  curriculum.weeks = weeks;

  const lex = pack.lexicon ?? {};
  if (Array.isArray(lex.morphemes) && lex.morphemes.length > 0) replaceArray(morphemes, lex.morphemes);
  if (Array.isArray(lex.words) && lex.words.length > 0) replaceArray(words, lex.words);
  if (Array.isArray(lex.concepts) && lex.concepts.length > 0) replaceArray(concepts, lex.concepts);

  rebuildIndexes();
  status.source = 'external';
  status.contentVersion = pack.contentVersion || `external-${pack.dayCount}`;
  status.reason = undefined;
  status.problems = pack.problems ?? [];
  return true;
}

/**
 * Ask the desktop shell for a course pack next to the executable and apply it.
 * Always resolves: content problems must never stop the app from opening.
 */
export async function initContent(loader?: () => Promise<CoursePack | null>): Promise<ContentStatus> {
  if (!loader) return status;
  try {
    const pack = await loader();
    if (pack) applyCoursePack(pack);
    if (!status.reason) status.reason = checkCoursePack(pack).reason;
  } catch (err) {
    status.reason = `读取外部课程失败：${(err as Error).message}`;
  }
  return status;
}

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
