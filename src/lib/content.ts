/**
 * Content registry. Course JSON is bundled at build time (offline safe).
 *
 * Layout: `content/weeks/weekNN/meta.json` (week theme) plus one file per day
 * (`day1.json` … `day7.json`). Splitting the week into per-day files keeps the
 * content pipeline mergeable: several authors can write different days of the
 * same week without touching the same file.
 *
 * ## Loading strategy (docs/PERF.md)
 *
 * Two payloads with different shapes, so they are loaded differently:
 *
 * • **Course** is eager. `Home`, `Course`, `plan.ts` and the sidebar all read
 *   `lessons` synchronously during the first render, so splitting it would
 *   force every consumer through an async boundary. It stays in the entry
 *   chunk; `lessonSummaries` is exposed for the (planned) day-by-day split.
 *
 * • **Lexicon** (`morphemes` / `words` / `concepts` / `forms`) is lazy. Only
 *   the lexicon pages need it, and those routes are code-split and gated on
 *   `loadLexicon()` in `App.tsx`. The exported accessors stay synchronous —
 *   they read mutable module arrays that `loadLexicon` fills in place — so
 *   existing call sites did not change. The arrays are simply empty until the
 *   lexicon is ready, which is why every lexicon page awaits it first.
 */
import type { Concept, Curriculum, Lesson, Morpheme, Week, WordEntry } from './types';
import { loadIdentity, type FormIndex, type IdentityIndex } from './identity';
import { mark, measure } from './perf';

/** A loader count, so the perf regression test can prove the home path is free. */
const loadStats = { lexiconLoads: 0, lessonLoads: 0 };

/*
 * Lessons are ~1.2 MB of JSON. They are loaded as their own chunk before the
 * first route renders (`loadLessons`), not inlined into the entry bundle: the
 * shell then parses in ~200 ms instead of ~400, and the JSON arrives as a
 * separate cacheable file. Tests get the eager form so a unit test can read
 * `lessons` without awaiting anything.
 */
/**
 * One bundle, one chunk. A lazy glob over the 230 lesson files emitted 230
 * chunks — a request each — which cost more than the bytes it saved.
 * `scripts/bundle-lessons.mjs` writes the file and CI verifies it is current.
 */
type LessonBundle = {
  contentHash: string;
  weeks: { week: number; theme: string; intro: string; lessons: Lesson[] }[];
};
const lessonBundle = () => import('../content/lessons-bundle.json') as Promise<{ default: LessonBundle }>;

/**
 * Lazy lexicon. `import.meta.glob` without `eager` emits one small chunk per
 * file instead of inlining ~1 MB of JSON into the entry chunk. Vite/Rollup
 * keeps them as dynamic imports, so nothing here is parsed until a lexicon
 * route asks for it.
 */
const lexiconModules = import.meta.glob<{ default: unknown }>([
  '../content/lexicon/morphemes.json',
  '../content/lexicon/words.json',
  '../content/lexicon/concepts.json',
  '../content/lexicon/forms.json',
]);

interface WeekMeta {
  week: number;
  theme: string;
  intro: string;
}

const weekMetas = new Map<number, WeekMeta>();
const weekLessons = new Map<number, Lesson[]>();

const weeks: Week[] = [];

function rebuildWeeks(): void {
  weeks.length = 0;
  for (const [weekNo, meta] of [...weekMetas.entries()].sort((a, b) => a[0] - b[0])) {
    weeks.push({
      week: weekNo,
      theme: meta.theme,
      intro: meta.intro,
      lessons: (weekLessons.get(weekNo) ?? []).sort((a, b) => a.day - b.day),
    });
  }
  lessons.length = 0;
  lessons.push(...weeks.flatMap((w) => w.lessons).sort((a, b) => lessonIndex(a) - lessonIndex(b)));
}

let lessonsLoaded = false;

/**
 * Load every lesson file. Called once during boot, before the first route
 * renders, so `lessons` / `getLesson` stay synchronous for all consumers.
 */
export async function loadLessons(): Promise<void> {
  if (lessonsLoaded) return;
  const { default: bundle } = await lessonBundle();
  for (const week of bundle.weeks) {
    weekMetas.set(week.week, { week: week.week, theme: week.theme, intro: week.intro });
    weekLessons.set(week.week, week.lessons);
  }
  rebuildWeeks();
  lessonsLoaded = true;
  loadStats.lessonLoads += 1;
}

/* ------------------------------ lexicon slots ----------------------------- *
 * These arrays are the public, synchronous view of the lexicon. They are
 * intentionally mutable: `loadLexicon()` replaces their contents in place so
 * `allMorphemes()` / `getWord()` / `identity` keep working for every consumer
 * without a reload, exactly like an external course pack does.
 * ------------------------------------------------------------------------- */

const morphemes: Morpheme[] = [];
const words: WordEntry[] = [];
const concepts: Concept[] = [];
let formIndex: FormIndex = {};

/** Everything a lexicon load has to install. Fields are optional so a course
 *  pack can contribute a subset without blanking the rest. */
export interface LexiconPayload {
  morphemes?: Morpheme[];
  words?: WordEntry[];
  concepts?: Concept[];
  forms?: FormIndex;
}

/** Which parts came from an external course pack and must never be replaced. */
const externalLexicon = { morphemes: false, words: false, concepts: false };

let lexiconLoaded = false;
let lexiconPromise: Promise<void> | null = null;



/**
 * Test seam: lets a unit test install a tiny lexicon without touching the
 * shipped JSON, and (together with a stubbed `window`) lets the test observe
 * the browser path where nothing is loaded at import time.
 */
let testLexiconLoader: (() => Promise<LexiconPayload>) | null = null;

export function __setLexiconLoaderForTest(loader: (() => Promise<LexiconPayload>) | null): void {
  testLexiconLoader = loader;
}

/** Loader counter + readiness, read by the regression test and diagnostics. */
export function contentLoadStats(): { lexiconLoads: number; lessonLoads: number; lexiconReady: boolean } {
  return { ...loadStats, lexiconReady: lexiconLoaded };
}

function moduleLoader(suffix: string): (() => Promise<{ default: unknown }>) | undefined {
  const key = Object.keys(lexiconModules).find((k) => k.endsWith(suffix));
  return key ? lexiconModules[key] : undefined;
}

async function readEmbeddedLexicon(): Promise<LexiconPayload> {
  const [morphemeMod, wordMod, conceptMod, formMod] = await Promise.all([
    moduleLoader('lexicon/morphemes.json')?.(),
    moduleLoader('lexicon/words.json')?.(),
    moduleLoader('lexicon/concepts.json')?.(),
    moduleLoader('lexicon/forms.json')?.(),
  ]);
  return {
    morphemes: morphemeMod?.default as Morpheme[] | undefined,
    words: wordMod?.default as WordEntry[] | undefined,
    concepts: conceptMod?.default as Concept[] | undefined,
    forms: formMod?.default as FormIndex | undefined,
  };
}

function replaceArray<T>(target: T[], next: T[]) {
  target.length = 0;
  target.push(...next);
}

/**
 * Install a lexicon payload, keeping the public array references stable.
 *
 * An external course pack owns whatever it supplied, so those slices are never
 * overwritten by the embedded copy.
 */
function installLexicon(payload: LexiconPayload) {
  if (payload.morphemes && !externalLexicon.morphemes) replaceArray(morphemes, payload.morphemes);
  if (payload.words && !externalLexicon.words) replaceArray(words, payload.words);
  if (payload.concepts && !externalLexicon.concepts) replaceArray(concepts, payload.concepts);
  if (payload.forms) {
    formIndex = { ...payload.forms };
  }
  rebuildIndexes();
}

/**
 * Load the lexicon once. Safe to call from several routes at the same time:
 * concurrent callers share one promise, and a failure resets it so a retry can
 * succeed (offline JSON can only fail on a broken build, but a stuck promise
 * would blank the lab forever).
 */
export function loadLexicon(loader?: () => Promise<LexiconPayload>): Promise<void> {
  if (lexiconLoaded) return Promise.resolve();
  if (!lexiconPromise) {
    const source = loader ?? testLexiconLoader ?? readEmbeddedLexicon;
    lexiconPromise = (async () => {
      loadStats.lexiconLoads += 1;
      const payload = await source();
      installLexicon(payload);
      lexiconLoaded = true;
      mark('lexicon-ready');
      measure('content-ready→lexicon-ready', 'content-ready', 'lexicon-ready');
    })().catch((err) => {
      lexiconPromise = null;
      throw err;
    });
  }
  return lexiconPromise;
}

export function lexiconReady(): boolean {
  return lexiconLoaded;
}

export let identity: IdentityIndex = loadIdentity(morphemes, formIndex);

export const curriculum: Curriculum = { version: '1.0.0', weeks };

/**
 * Flat lesson list, kept mutable on purpose: `loadLessons()` fills it in place
 * so modules that captured the array at import time (plan.ts) still see the
 * loaded lessons.
 */
export const lessons: Lesson[] = [];

/* ------------------------------------------------------------------------- *
 * Lightweight lesson index
 *
 * `Course.tsx` (outside this module's change scope) renders every week card
 * from the full `lessons` array. When the per-day split is adopted, that page
 * only needs the fields below, which is what `lessonSummaries` provides:
 * id / week / day / title / minutes (+ the flags the list renders).
 * ------------------------------------------------------------------------- */

export interface LessonSummary {
  id: string;
  week: number;
  day: number;
  title: string;
  level: Lesson['level'];
  /** review + learn + practice + apply, the number shown on the course card. */
  minutes: number;
  hasContent: boolean;
}

function summarize(lesson: Lesson): LessonSummary {
  const { review, learn, practice, apply } = lesson.minutes;
  return {
    id: lesson.id,
    week: lesson.week,
    day: lesson.day,
    title: lesson.title,
    level: lesson.level,
    minutes: review + learn + practice + apply,
    hasContent: lesson.cards.length > 0 || lesson.practice.length > 0 || lesson.apply.length > 0,
  };
}

export const lessonSummaries: LessonSummary[] = lessons.map(summarize);

/**
 * Async lesson accessor for the day-by-day loading path.
 *
 * The course payload is still embedded (see the header), so this resolves from
 * memory today. It exists so a route can be written as `await loadLesson(id)`
 * and switch to a chunked fetch without touching call sites later.
 */
export async function loadLesson(id: string): Promise<Lesson | undefined> {
  loadStats.lessonLoads += 1;
  return lessonById.get(id);
}

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

  // Deterministic order (by ID) so a form shared by two records always resolves
  // to the same one. `px-in` sorts before `px-in-lat-2`, so the negative prefix
  // stays the default reading exactly as before identity existed.
  morphemeByForm.clear();
  for (const m of [...morphemes].sort((a, b) => a.id.localeCompare(b.id))) {
    const form = stripDashes(m.form);
    if (!morphemeByForm.has(form)) morphemeByForm.set(form, m);
    for (const alt of m.allomorphs ?? []) {
      const key = stripDashes(alt);
      if (!morphemeByForm.has(key)) morphemeByForm.set(key, m);
    }
  }

  wordBySpelling.clear();
  for (const w of words) wordBySpelling.set(w.w.toLowerCase(), w);

  conceptById.clear();
  for (const c of concepts) conceptById.set(c.id, c);

  identity = loadIdentity(morphemes, formIndex);
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
  // The summaries are derived data: keep them in step with the swapped array.
  lessonSummaries.length = 0;
  lessonSummaries.push(...lessons.map(summarize));

  const lex = pack.lexicon ?? {};
  if (Array.isArray(lex.morphemes) && lex.morphemes.length > 0) {
    replaceArray(morphemes, lex.morphemes);
    externalLexicon.morphemes = true;
  }
  if (Array.isArray(lex.words) && lex.words.length > 0) {
    replaceArray(words, lex.words);
    externalLexicon.words = true;
  }
  if (Array.isArray(lex.concepts) && lex.concepts.length > 0) {
    replaceArray(concepts, lex.concepts);
    externalLexicon.concepts = true;
  }
  // A complete pack makes the embedded lexicon unnecessary; a partial one still
  // lets `loadLexicon()` fill the missing slices.
  if (externalLexicon.morphemes && externalLexicon.words && externalLexicon.concepts) {
    lexiconLoaded = true;
    lexiconPromise = Promise.resolve();
  }

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

const lessonById = new Map<string, Lesson>();
const morphemeByForm = new Map<string, Morpheme>();
const wordBySpelling = new Map<string, WordEntry>();
const conceptById = new Map<string, Concept>();
rebuildIndexes();

export function getLesson(id: string): Lesson | undefined {
  return lessonById.get(id);
}
/**
 * Legacy single-answer lookup: the lowest ID that owns this spelling or
 * allomorph. It cannot represent a homograph (`plac` is both Latin and Greek),
 * so anything that needs the right sense must use `identity.resolve` instead.
 */
/**
 * Legacy single-form lookup, kept for the UI that predates `identity`.
 *
 * A spelling can own two morphemes (`in-` negation vs direction). This lookup
 * must stay deterministic, so it prefers the record whose ID is literally
 * `kind-form` and otherwise falls back to the first ID in sorted order. Code
 * that knows which sense it means should call `identity.resolve` instead.
 */
export function getMorpheme(form: string): Morpheme | undefined {
  const bare = stripDashes(form);
  const ids = identity.idsForForm(bare);
  // A spelling can own two morphemes (`in-` negation vs direction) and an
  // allomorph can belong to a prefix as well as a combining form (`im`). Prefer
  // the record whose ID is literally `kind-form`, then the historical map, then
  // the first ID — never a random pick.
  const exact = ['px', 'rx', 'sx', 'cx']
    .map((kind) => `${kind}-${bare}`)
    .find((id) => ids.includes(id));
  if (exact) return identity.byId(exact);
  return morphemeByForm.get(bare) ?? identity.byId(ids[0] ?? '');
}

export function getMorphemeById(id: string): Morpheme | undefined {
  return identity.byId(id);
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

/* ------------------------------ boot marks ------------------------------- */

mark('content-ready');
measure('boot→content-ready', 'boot', 'content-ready');

/**
 * Node / Vitest only: the unit tests (`derive.test.ts`, `identity.test.ts`, …)
 * read `allWords()` at module scope and rely on a synchronously populated
 * lexicon. The lazy loader is a browser optimisation; in a headless Node run
 * there is no first paint to protect, so we hydrate now and skip the Lazy step.
 *
 * This branch is dead in the browser (`window` exists), but it is a top-level
 * await, so the browser entry chunk stays standards-compliant (ES2022, TLA).
 */
if (typeof window === 'undefined') {
  await loadLexicon();
}
