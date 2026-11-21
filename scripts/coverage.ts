/**
 * Textbook coverage audit — seven levels (docs/DATA_IDENTITY.md §5).
 *
 * The point of this script is to stop us from claiming "the curriculum covers
 * the textbook" without evidence. It joins four things that are edited
 * independently:
 *
 *   1. the textbook inventory  (src/content/textbook/s1-elements.json,
 *      s1-chapters.json) — what the book actually teaches;
 *   2. the knowledge base      (src/content/lexicon/*.json + forms.json) —
 *      which morpheme each element *is*;
 *   3. the curriculum          (src/content/weeks/**) — what the app teaches;
 *   4. the word database       (words.json partIds, review records).
 *
 * Levels (§5):
 *   L1 registered   in s1-elements.json
 *   L2 linked       element → morpheme ID, with form *and* origin agreeing
 *   L3 glossed      glossZh and glossEn both real (no placeholders)
 *   L4 exemplified  ≥2 verified words whose partIds contain the ID
 *   L5 explained    a lesson's concepts or a card names the ID, or the card's
 *                   prose glosses it (snippet stored, chapter proximity is NOT
 *                   evidence and is reported separately)
 *   L6 practised    a practice/apply item really uses the ID: declared parts,
 *                   concepts, matrix base, or the answer word's partIds
 *   L7 reviewed     the morpheme has a review record (`review.by`)
 *
 *   npx tsx scripts/coverage.ts            # human report
 *   npx tsx scripts/coverage.ts --json    # docs/coverage.json
 *   npx tsx scripts/coverage.ts --write   # docs/TEXTBOOK_COVERAGE.md
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  glossContains,
  glossVariants,
  loadIdentity,
  normalizeForm,
  normalizeOrigin,
  type FormIndex,
} from '../src/lib/identity';
import type { Card, Exercise, Lesson, Morpheme, WordEntry } from '../src/lib/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TX = join(root, 'src/content/textbook');
const LEX = join(root, 'src/content/lexicon');
const WEEKS = join(root, 'src/content/weeks');

const read = <T>(path: string, fallback: T): T =>
  existsSync(path) ? (JSON.parse(readFileSync(path, 'utf-8')) as T) : fallback;

type Element = {
  id: string;
  element: string;
  forms: string[];
  type: string;
  gloss: string;
  chapter: string;
  source: string;
  page?: number;
};
type Word = Pick<WordEntry, 'w' | 'parts' | 'glossZh' | 'verified' | 'partIds'> & {
  analysis?: { segmentation?: string; quizSafe?: boolean; etymology?: { status?: string } };
};

/**
 * L4's evidence rule (0.8.0): a word only counts when its own segmentation is
 * verified. `verified: true` alone is not enough — 101 such words still had a
 * part with no morpheme ID, so counting them would credit a morpheme with an
 * example that nobody has actually analysed.
 */
function countsForL4(word: Word): boolean {
  const segmentation = word.analysis?.segmentation;
  if (segmentation) return segmentation === 'verified';
  return Boolean(word.verified);
}
type Kp = { id: string; title: string; type: string; summary: string; terms?: string[]; examples?: string[] };
type Chapter = {
  id: string;
  chapter: number;
  title: string;
  sections: { id: string; title: string; knowledgePoints: Kp[] }[];
  wordElements?: { form: string; gloss: string; source: string; note?: string }[];
  exerciseTypes?: { name: string; shape: string }[];
};
type KpMap = {
  kpToLessons?: Record<string, string[]>;
  lessonToKps?: Record<string, string[]>;
};
type SourceRow = { id: string; title: string; status: string; role?: string; edition?: string };

type LevelId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'L7';
const LEVELS: LevelId[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7'];
const LEVEL_NAMES: Record<LevelId, string> = {
  L1: '已登记',
  L2: '已关联',
  L3: '释义已核',
  L4: '例词充分',
  L5: '有讲解',
  L6: '有练习',
  L7: '已审校',
};
const LEVEL_RULES: Record<LevelId, string> = {
  L1: '出现在 s1-elements.json',
  L2: '元素 → 词素 ID，form 与 origin 同时一致',
  L3: 'glossZh 与 glossEn 均非空且无占位符',
  L4: '≥2 个「切分已核验」且 partIds 含该 ID 的词条（切分未核验的不计，即使 verified:true）',
  L5: '某课的 concepts 或卡片声明该 ID，或卡片正文以释义线索讲到它（存证据片段）',
  L6: 'practice/apply 里有题目真正用到该 ID（parts / concepts / matrix base / 答案词的 partIds）',
  L7: '该词素在 reviews.json 有审校记录（或记录自带 review.by）',
};

const sources = read<{ sources: SourceRow[] }>(join(TX, 'sources.json'), { sources: [] }).sources;
const elements = read<{ elements: Element[] }>(join(TX, 's1-elements.json'), { elements: [] }).elements;
const chapters = read<{ chapters: Chapter[] }>(join(TX, 's1-chapters.json'), { chapters: [] }).chapters;
const kpMap = read<KpMap>(join(TX, 'kp-map.json'), {});
// Sample linguistic review lives in its own file so regenerating the textbook
// model never wipes it, and so the report can say exactly what was reviewed.
const reviews = read<{ reviewedBy?: string; scope?: string; caveat?: string; entries?: { id: string }[] }>(
  join(TX, 'reviews.json'),
  {},
);
// L7 counts a review only when it names a source. "Has a Chinese gloss" or
// "has an English definition" is not linguistic review; a traceable reference is.
type ReviewEntry = { id: string; kinds?: string[]; sources?: { id: string; detail?: string }[]; reviewer?: string };
const reviewEntries = (reviews.entries ?? []) as ReviewEntry[];
const reviewed = new Map<string, ReviewEntry>();
for (const entry of reviewEntries) {
  if (!entry.id) continue;
  if (!entry.sources || entry.sources.length === 0) continue;
  reviewed.set(entry.id, entry);
}
const reviewedIds = new Set(reviewed.keys());
const morphemes = read<Morpheme[]>(join(LEX, 'morphemes.json'), []);
const words = read<Word[]>(join(LEX, 'words.json'), []);
const concepts = read<{ id: string; zh: string }[]>(join(LEX, 'concepts.json'), []);
const formsIndex = read<FormIndex>(join(LEX, 'forms.json'), {});
const identity = loadIdentity(morphemes, formsIndex);

// ---------------------------------------------------------------- lessons ---
const lessons: Lesson[] = [];
const parseErrors: string[] = [];
for (const weekDir of existsSync(WEEKS) ? readdirSync(WEEKS).sort() : []) {
  const dir = join(WEEKS, weekDir);
  if (!existsSync(dir)) continue;
  for (const file of readdirSync(dir).filter((f) => /^day\d+\.json$/.test(f)).sort()) {
    const path = `${weekDir}/${file}`;
    try {
      lessons.push(JSON.parse(readFileSync(join(dir, file), 'utf-8')) as Lesson);
    } catch (error) {
      // A half-written lesson is a real finding, not background noise: the file
      // is skipped for counting, but the audit says so and --strict fails.
      parseErrors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

/**
 * Card → morpheme IDs with the evidence that produced them.
 *
 * A card explains a morpheme in three legitimate ways, and the audit records
 * which one it saw so a human can sample the claim instead of trusting a count:
 *   `id`    the card declares the ID (`morphemeIds`)
 *   `form`  the card declares the spelling (`morphemes`) and it resolves
 *   `text`  the card's own prose names the form — recorded with a snippet
 * Anything else (a neighbouring lesson, a chapter that merely contains the
 * form) is *not* evidence and no longer counts.
 */
interface EvidenceHit {
  kind: 'id' | 'form' | 'text';
  lesson: string;
  card?: string;
  snippet?: string;
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Does the prose name this morpheme?
 *
 * Precision matters more than recall here: a false hit inflates the headline
 * number and makes sampling useless. So:
 *   - 1-2 letter forms never count (`a-` matched every English article);
 *   - 3-4 letter forms count only in the conventional dash notation (`in-`, `-al`);
 *   - 5+ letters count on a word boundary (`struct` matches `structure`).
 */
function mentions(blob: string, form: string): string | null {
  const bare = normalizeForm(form);
  if (!bare || bare.length <= 2) return null;
  const esc = escapeRe(bare);
  const pattern =
    bare.length <= 4
      ? new RegExp(`(?:[-–—]${esc}\\b|\\b${esc}[-–—])`, 'i')
      : new RegExp(`(^|[^a-z])${esc}`, 'i');
  // A bare occurrence inside an unrelated word ("the practice of...") is not an
  // explanation. Require a gloss cue next to the hit: a dash, a colon, a bracket
  // or an equals sign — the notations cards actually use to define a morpheme.
  const CUE = /[-–—（(：:→→=＝「]|即|意思是|表示|意为/;
  const global = new RegExp(pattern.source, 'gi');
  let match: RegExpExecArray | null;
  while ((match = global.exec(blob)) !== null) {
    const at = match.index;
    const window = blob.slice(Math.max(0, at - 30), Math.min(blob.length, at + 40));
    if (!CUE.test(window)) continue;
    return window.replace(/\s+/g, ' ').trim();
  }
  return null;
}

/** Only prose: string values long enough to be a sentence, never object keys. */
function cardText(card: Card): string {
  const parts: string[] = [];
  const walk = (value: unknown, depth: number) => {
    if (depth > 4 || value === null || value === undefined) return;
    if (typeof value === 'string') {
      if (value.length >= 6) parts.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      for (const [key, inner] of Object.entries(record)) {
        // Declarations are evidence of their own kind, not prose.
        if (key === 'morphemeIds' || key === 'morphemes' || key === 'id' || key === 'kind') continue;
        walk(inner, depth + 1);
      }
    }
  };
  walk(card, 0);
  return parts.join(' \n ');
}

function cardHits(card: Card, lessonId: string): Map<string, EvidenceHit> {
  const hits = new Map<string, EvidenceHit>();
  const title = 'title' in card ? String((card as { title?: string }).title ?? '') : '';
  if ('morphemeIds' in card && Array.isArray(card.morphemeIds)) {
    for (const id of card.morphemeIds) hits.set(id, { kind: 'id', lesson: lessonId, card: title });
  }
  if ('morphemes' in card && Array.isArray(card.morphemes)) {
    for (const form of card.morphemes) {
      const resolved = identity.resolve(form).id;
      if (resolved && !hits.has(resolved)) hits.set(resolved, { kind: 'form', lesson: lessonId, card: title });
    }
  }
  const blob = cardText(card);
  for (const morpheme of morphemes) {
    if (hits.has(morpheme.id)) continue;
    const forms = [morpheme.form, ...(morpheme.allomorphs ?? [])];
    for (const form of forms) {
      const snippet = mentions(blob, form);
      if (snippet) {
        hits.set(morpheme.id, { kind: 'text', lesson: lessonId, card: title, snippet });
        break;
      }
    }
  }
  return hits;
}

/** Exercises: declared parts, concepts, matrix base, and the answer word's parts. */
function exerciseHits(ex: Exercise, lessonId: string): Map<string, EvidenceHit> {
  const hits = new Map<string, EvidenceHit>();
  const add = (id: string | undefined, kind: EvidenceHit['kind'], snippet?: string) => {
    if (id && !hits.has(id)) hits.set(id, { kind, lesson: lessonId, snippet });
  };
  const parts = 'parts' in ex && Array.isArray(ex.parts) ? ex.parts : [];
  for (const part of parts) add(identity.resolve(part).id, 'form', `parts: ${parts.join(' + ')}`);
  for (const concept of ex.concepts ?? []) {
    if (identity.byId(concept)) add(concept, 'id');
    else add(identity.resolve(concept).id, 'form');
  }
  if (ex.kind === 'matrix') add(identity.resolve(ex.base).id, 'form', `matrix: ${ex.base}`);
  // A wordSum/cloze whose answer is a known word still exercises that word's
  // morphemes even when the item never lists them as parts.
  const answer = 'answer' in ex && typeof ex.answer === 'string' ? ex.answer : '';
  if (answer) {
    const word = words.find((candidate) => candidate.w.toLowerCase() === answer.toLowerCase());
    for (const id of word?.partIds ?? []) add(id ?? undefined, 'text', `answer: ${answer}`);
  }
  return hits;
}

/** Everything each lesson demonstrably touches, with the evidence kept. */
interface LessonEvidence {
  id: string;
  concepts: Set<string>;
  knowledgePoints: Set<string>;
  cardHits: Map<string, EvidenceHit>;
  exerciseHits: Map<string, EvidenceHit>;
}
const lessonEvidence: LessonEvidence[] = lessons.map((lesson) => {
  const cards = new Map<string, EvidenceHit>();
  for (const card of lesson.cards ?? []) for (const [id, hit] of cardHits(card, lesson.id)) if (!cards.has(id)) cards.set(id, hit);
  const exercises = new Map<string, EvidenceHit>();
  for (const ex of [...(lesson.practice ?? []), ...(lesson.apply ?? [])]) {
    for (const [id, hit] of exerciseHits(ex, lesson.id)) if (!exercises.has(id)) exercises.set(id, hit);
  }
  return {
    id: lesson.id,
    concepts: new Set(lesson.concepts ?? []),
    knowledgePoints: new Set(lesson.knowledgePoints ?? []),
    cardHits: cards,
    exerciseHits: exercises,
  };
});

/** kp → lessons that claim it (lesson file first, generated map second). */
const kpLessons = new Map<string, Set<string>>();
for (const [kp, ids] of Object.entries(kpMap.kpToLessons ?? {})) kpLessons.set(kp, new Set(ids));
for (const lesson of lessonEvidence) {
  for (const kp of lesson.knowledgePoints) {
    const set = kpLessons.get(kp) ?? new Set<string>();
    set.add(lesson.id);
    kpLessons.set(kp, set);
  }
}

// ------------------------------------------------------------- chapter map --
/** chapter number → forms the book teaches in that chapter */
const chapterForms = new Map<number, Set<string>>();
const chapterKps = new Map<number, Set<string>>();
for (const chapter of chapters) {
  const forms = new Set<string>();
  for (const element of chapter.wordElements ?? []) {
    const first = element.form.split('~')[0] ?? '';
    const normalised = normalizeForm(first);
    if (normalised) forms.add(normalised);
  }
  chapterForms.set(chapter.chapter, forms);
  const kps = new Set<string>();
  for (const section of chapter.sections ?? []) for (const kp of section.knowledgePoints ?? []) kps.add(kp.id);
  chapterKps.set(chapter.chapter, kps);
}

function elementChapters(raw: string): number[] {
  return (raw.match(/\d+/g) ?? []).map(Number);
}

function elementOrigins(raw: string): Set<string> {
  const origins = new Set<string>();
  for (const token of raw.split(/[,/、 ]+/).filter(Boolean)) {
    const normalised = normalizeOrigin(token);
    if (normalised) origins.add(normalised);
  }
  return origins;
}

/** L3's definition of a real gloss. */
const PLACEHOLDER = /(\?|TODO|FIXME|待补|占位|xxx|^unknown$|^$)/i;
function glossOk(value: string | undefined): boolean {
  return Boolean(value && value.trim() && !PLACEHOLDER.test(value.trim()));
}

function glossMatchesMorpheme(elementGloss: string, morpheme: Morpheme): boolean {
  const variants = [
    ...glossVariants(morpheme.glossEn),
    ...glossVariants(morpheme.glossZh),
    ...glossVariants(morpheme.senseKey),
  ];
  const wanted = (elementGloss ?? '').trim().toLowerCase();
  if (!wanted) return false;
  for (const variant of variants) {
    if (!variant) continue;
    if (wanted === variant) return true;
    if (variant.length >= 3 && glossContains(wanted, variant)) return true;
    if (wanted.length >= 3 && glossContains(variant, wanted)) return true;
  }
  return false;
}

// --------------------------------------------------------------- L2 lookup ---
interface Link {
  id?: string;
  reason?: string;
}

/**
 * Element → morpheme ID. Form and origin must both agree; when several records
 * share both (a same-origin homograph), only an agreeing gloss may choose one.
 * "Spelling matches" is never enough.
 */
function linkElement(element: Element): Link {
  const origins = elementOrigins(element.source);
  if (origins.size === 0) return { reason: `源头标注缺失或无法识别（"${element.source}"）` };

  let candidates: string[] = [];
  for (const form of element.forms) {
    for (const id of identity.idsForForm(form)) {
      const morpheme = identity.byId(id);
      if (morpheme && origins.has(morpheme.origin)) candidates.push(id);
    }
  }
  candidates = [...new Set(candidates)];
  if (candidates.length === 0) return { reason: `词库中没有 form+origin 一致的记录（${element.forms.join('/')} · ${element.source}）` };
  if (candidates.length === 1) return { id: candidates[0] };

  const byGloss = candidates.filter((id) => {
    const morpheme = identity.byId(id);
    return Boolean(morpheme && glossMatchesMorpheme(element.gloss, morpheme));
  });
  if (byGloss.length === 1) return { id: byGloss[0] };
  if (byGloss.length > 1) return { reason: `同形同源多条记录，释义仍无法区分（${byGloss.join(' / ')}）` };
  return { reason: `同形同源多条记录且释义不匹配（${candidates.join(' / ')}）` };
}

// --------------------------------------------------------------- L4 / L6 -----
const verifiedWordsByMorpheme = new Map<string, string[]>();
for (const word of words) {
  if (!countsForL4(word)) continue;
  for (const id of word.partIds ?? []) {
    if (!id) continue;
    const list = verifiedWordsByMorpheme.get(id) ?? [];
    list.push(word.w);
    verifiedWordsByMorpheme.set(id, list);
  }
}

interface ElementRow {
  id: string;
  element: string;
  forms: string[];
  gloss: string;
  chapter: string;
  source: string;
  page?: number;
  morphemeId?: string;
  levels: Record<LevelId, boolean>;
  gap: LevelId | 'done';
  reason: string;
  verifiedWords: string[];
  /** Lessons that show this morpheme on a card, with the kind of proof. */
  teaching: EvidenceHit[];
  /** Exercises that actually use the ID, with the kind of proof. */
  practice: EvidenceHit[];
  /** Diagnostics: the form appears in a chapter whose kp is taught, but no card
   *  or exercise names it. Real teaching, but not evidence for *this* morpheme. */
  chapterTopicOnly: boolean;
}

function teachingFor(morphemeId: string, element: Element): EvidenceHit[] {
  const hits: EvidenceHit[] = [];
  for (const lesson of lessonEvidence) {
    if (lesson.concepts.has(morphemeId)) {
      hits.push({ kind: 'id', lesson: lesson.id, snippet: 'lesson.concepts' });
      continue;
    }
    const card = lesson.cardHits.get(morphemeId);
    if (card) hits.push(card);
  }
  if (hits.length > 0) return hits;
  // No card names it. Kept only as a diagnostic, never as L5 evidence.
  void element;
  return [];
}

/** The form sits in a chapter whose knowledge point is taught, but no card or
 *  exercise names it: useful signal, not proof. */
function chapterTopicOnly(morphemeId: string, element: Element): boolean {
  for (const chapterNo of elementChapters(element.chapter)) {
    const forms = chapterForms.get(chapterNo);
    if (!forms || !element.forms.some((form) => forms.has(normalizeForm(form)))) continue;
    for (const kp of chapterKps.get(chapterNo) ?? []) {
      for (const lessonId of kpLessons.get(kp) ?? []) {
        const lesson = lessonEvidence.find((candidate) => candidate.id === lessonId);
        if (!lesson) continue;
        if (lesson.concepts.has(morphemeId) || lesson.cardHits.has(morphemeId) || lesson.exerciseHits.has(morphemeId)) return false;
      }
    }
  }
  return true;
}

const elementRows: ElementRow[] = elements.map((element) => {
  const link = linkElement(element);
  const morpheme = link.id ? identity.byId(link.id) : undefined;
  const verifiedWords = link.id ? (verifiedWordsByMorpheme.get(link.id) ?? []).slice(0, 6) : [];
  const teaching = link.id ? teachingFor(link.id, element) : [];
  const practice = link.id
    ? lessonEvidence.flatMap((lesson) => {
        const hit = lesson.exerciseHits.get(link.id as string);
        return hit ? [hit] : [];
      })
    : [];
  const topicOnly = Boolean(link.id) && teaching.length === 0 && chapterTopicOnly(link.id as string, element);

  const levels: Record<LevelId, boolean> = {
    L1: Boolean(element.element),
    L2: Boolean(link.id),
    L3: Boolean(morpheme && glossOk(morpheme.glossZh) && glossOk(morpheme.glossEn)),
    L4: verifiedWords.length >= 2,
    L5: teaching.length > 0,
    L6: practice.length > 0,
    L7: Boolean(morpheme?.review?.by) || reviewedIds.has(morpheme?.id ?? ''),
  };

  const gap = LEVELS.find((level) => !levels[level]) ?? 'done';
  const reasons: Record<LevelId, string> = {
    L1: '教材清单里没有这一行',
    L2: link.reason ?? '',
    L3: morpheme ? '释义为空或含占位符' : '还没有词素记录',
    L4: `verified 词条只有 ${verifiedWords.length} 个（需要 2 个）`,
    L5: '没有任何课时讲到它',
    L6: '讲到它的课时没有练习用到它',
    L7: '没有语言学审校记录（reviews.json 抽样未覆盖到它）',
  };

  return {
    id: element.id,
    element: element.element,
    forms: element.forms,
    gloss: element.gloss,
    chapter: element.chapter,
    source: element.source,
    page: element.page,
    morphemeId: link.id,
    levels,
    gap,
    reason: gap === 'done' ? '' : reasons[gap],
    verifiedWords,
    teaching,
    practice,
    chapterTopicOnly: topicOnly,
  };
});

// ------------------------------------------------------------ knowledge -----
type KpRow = {
  id: string;
  chapter: string;
  section: string;
  title: string;
  type: string;
  /** Lessons whose own `knowledgePoints` array names this id. */
  claimedBy: string[];
  /** Lessons only reachable through the generated kp-map: mapping, not evidence. */
  mappedOnly: string[];
  taught: boolean;
};
const kpRows: KpRow[] = [];
for (const chapter of chapters) {
  for (const section of chapter.sections ?? []) {
    for (const kp of section.knowledgePoints ?? []) {
      const claimedBy = lessons.filter((lesson) => (lesson.knowledgePoints ?? []).includes(kp.id)).map((lesson) => lesson.id);
      const mappedOnly = [...(kpLessons.get(kp.id) ?? [])]
        .filter((id) => !claimedBy.includes(id))
        .sort();
      kpRows.push({
        id: kp.id,
        chapter: chapter.id,
        section: section.title,
        title: kp.title,
        type: kp.type,
        claimedBy,
        mappedOnly,
        // Only a lesson that names the id in its own file is evidence. A
        // generated substring map is a hint for authors, never a claim.
        taught: claimedBy.length > 0,
      });
    }
  }
}

// --------------------------------------------------------------- summary ----
const levelRows = (level: LevelId) => elementRows.filter((row) => row.levels[level]);
function countBy<T extends string>(rows: ElementRow[], key: (row: ElementRow) => T | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of rows) {
    const k = key(row) ?? 'unknown';
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
}

const pct = (n: number, d: number) => (d === 0 ? '—' : `${Math.round((n / d) * 100)}%`);
const count = (level: LevelId) => elementRows.filter((row) => row.levels[level]).length;
const stuckAt = new Map<LevelId | 'done', number>();
for (const row of elementRows) stuckAt.set(row.gap, (stuckAt.get(row.gap) ?? 0) + 1);

const levelSummary = LEVELS.map((level) => ({
  level,
  name: LEVEL_NAMES[level],
  rule: LEVEL_RULES[level],
  count: count(level),
  total: elementRows.length,
  pct: elementRows.length === 0 ? 0 : Math.round((count(level) / elementRows.length) * 100),
  gaps: elementRows
    .filter((row) => !row.levels[level])
    .slice(0, 20)
    .map((row) => ({ element: row.element, chapter: row.chapter, reason: row.levels[level] ? '' : row.reason || LEVEL_RULES[level] })),
}));

// L7b: review records whose evidence passes all five levels (see
// scripts/audit-reviews.mjs). Reported next to L7 instead of replacing it, so a
// definition change can never read as progress.
const crossVerified = new Map<string, number>();
{
  const raw = read<{ entries?: { id: string; verification?: { verdict?: string } }[] }>(
    join(TX, 'reviews.json'),
    {},
  );
  for (const entry of raw.entries ?? []) {
    if (entry.verification && entry.verification.verdict !== 'conflict') {
      crossVerified.set(entry.id, (crossVerified.get(entry.id) ?? 0) + 1);
    }
  }
}
const crossVerifiedElements = elementRows.filter((row) => row.morphemeId && crossVerified.has(row.morphemeId)).length;

const summary = {
  generatedAt: new Date().toISOString(),
  identity: identity.stats(),
  sources: sources.map((source) => ({ id: source.id, title: source.title, status: source.status, role: source.role })),
  knowledgeBase: {
    morphemes: morphemes.length,
    words: words.length,
    verifiedWords: words.filter((word) => word.verified).length,
    concepts: concepts.length,
    families: new Set(morphemes.map((morpheme) => morpheme.familyId).filter(Boolean)).size,
  },
  curriculum: { lessons: lessons.length, weeks: new Set(lessons.map((lesson) => lesson.week)).size },
  levels: levelSummary,
  s1: {
    elements: elementRows.length,
    knowledgePoints: kpRows.length,
    knowledgePointsTaught: kpRows.filter((row) => row.taught).length,
    elementsCrossVerified: crossVerifiedElements,
    knowledgePointsMappedOnly: kpRows.filter((row) => !row.taught && row.mappedOnly.length > 0).length,
    chapters: chapters.length,
    sections: chapters.reduce((total, chapter) => total + (chapter.sections?.length ?? 0), 0),
    exerciseTypes: [...new Set(chapters.flatMap((chapter) => (chapter.exerciseTypes ?? []).map((type) => type.shape)))].length,
    stuck: [...stuckAt.entries()].map(([level, n]) => ({ at: level, count: n })),
  },
  evidence: {
    l5: countBy(levelRows('L5'), (row) => row.teaching[0]?.kind),
    l6: countBy(levelRows('L6'), (row) => row.practice[0]?.kind),
    chapterTopicOnly: elementRows.filter((row) => row.chapterTopicOnly).length,
    l7: countBy(levelRows('L7'), (row) => (reviewed.get(row.morphemeId ?? '')?.kinds ?? []).join('+') || undefined),
  },
  parseErrors,
  rows: elementRows,
  knowledge: kpRows,
};

if (process.argv.includes('--strict') && parseErrors.length > 0) {
  console.error(`strict: ${parseErrors.length} lesson file(s) could not be parsed`);
  for (const err of parseErrors.slice(0, 10)) console.error(`  - ${err}`);
  process.exit(1);
}

if (process.argv.includes('--json')) {
  writeFileSync(join(root, 'docs/coverage.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf-8');
  console.log(`docs/coverage.json written: ${elementRows.length} elements, ${kpRows.length} knowledge points`);
  process.exit(0);
}

console.log(`textbook elements: ${elementRows.length}`);
for (const level of levelSummary) {
  console.log(`  ${level.level} ${level.name}: ${level.count} (${pct(level.count, level.total)})  — ${level.rule}`);
}
const evidence = summary.evidence;
console.log(`  L5 evidence: ${JSON.stringify(evidence.l5)}  (chapter-topic only, not counted: ${evidence.chapterTopicOnly})`);
console.log(`  L6 evidence: ${JSON.stringify(evidence.l6)}`);
if (parseErrors.length > 0) console.log(`  parse errors: ${parseErrors.length} (${parseErrors[0]})`);
const worst = [...levelSummary].sort((a, b) => a.pct - b.pct)[0];
console.log(`biggest gap: ${worst.level} ${worst.name} at ${worst.pct}% (${worst.count}/${worst.total})`);
const biggestStuck = [...stuckAt.entries()].filter(([level]) => level !== 'done').sort((a, b) => b[1] - a[1])[0];
if (biggestStuck) console.log(`most elements stop after ${biggestStuck[0]}: ${biggestStuck[1]}`);
console.log(`knowledge points: ${summary.s1.knowledgePoints}, taught: ${summary.s1.knowledgePointsTaught} (${pct(summary.s1.knowledgePointsTaught, summary.s1.knowledgePoints)})`);
console.log(`L7b 独立交叉核验（词典引用可通过 URL 复核）: ${crossVerifiedElements} / ${elementRows.length} (${pct(crossVerifiedElements, elementRows.length)})`);

if (process.argv.includes('--write')) {
  const lines: string[] = [];
  lines.push('# 教材覆盖率审计（自动生成）', '');
  lines.push(`生成时间：${summary.generatedAt}`, '');
  lines.push('> 本文件由 `npx tsx scripts/coverage.ts --write` 生成，请勿手工编辑。');
  lines.push('> 数据来自教材清单、词库（含 `forms.json` 身份索引）、课程与审校记录四处独立来源。');
  lines.push('> 判据见 `docs/DATA_IDENTITY.md` 第 5 节：L2 只认 `form + origin` 都一致的 ID，拼写相同不算。', '');

  lines.push('## 一、七级覆盖', '');
  lines.push('| 级别 | 判据 | 数量 | 占比 |');
  lines.push('| --- | --- | --- | --- |');
  for (const level of levelSummary) {
    lines.push(`| ${level.level} ${level.name} | ${level.rule} | ${level.count} | ${pct(level.count, level.total)} |`);
  }
  lines.push('');

  lines.push('## 一之二、证据构成（可抽样复核）', '');
  lines.push('| 级别 | 证据类型 | 数量 | 说明 |');
  lines.push('| --- | --- | --- | --- |');
  lines.push(`| L5 | 卡片/课时声明 ID | ${evidence.l5.id ?? 0} | 最强：作者显式声明 |`);
  lines.push(`| L5 | 卡片声明拼写 | ${evidence.l5.form ?? 0} | 拼写经身份索引解析到唯一 ID |`);
  lines.push(`| L5 | 卡片正文释义 | ${evidence.l5.text ?? 0} | 命中处附近有释义线索，报告存片段 |`);
  lines.push(`| L6 | 题目声明成分 | ${evidence.l6.form ?? 0} | parts / concepts / matrix base |`);
  lines.push(`| L6 | 答案为已知词 | ${evidence.l6.text ?? 0} | wordSum/cloze 答案词的 partIds 含该 ID |`);
  lines.push(`| L7 | 有来源的审校 | ${count('L7')} | 必须带 sources，否则不计 |`);
  lines.push('');
  lines.push(`> 另有 **${evidence.chapterTopicOnly}** 个成分：所在章有知识点被讲到，但没有任何卡片或题目点名它。`);
  lines.push('> 这部分**不计入 L5**——章节相近不等于讲解证据，仅作为排课线索。');
  lines.push('');

  lines.push('## 二、卡点分布（每个成分停在第一处未达标）', '');
  lines.push('| 停在 | 数量 | 含义 |');
  lines.push('| --- | --- | --- |');
  for (const level of LEVELS) {
    const n = stuckAt.get(level) ?? 0;
    lines.push(`| ${level} ${LEVEL_NAMES[level]} 未过 | ${n} | ${LEVEL_RULES[level]} 尚未满足 |`);
  }
  lines.push(`| — 七级全过 | ${stuckAt.get('done') ?? 0} | 已登记、已关联、释义已核、例词充分、有讲解、有练习、已审校 |`);
  lines.push('');

  lines.push('## 三、各级差异清单（前 20 条）', '');
  for (const level of levelSummary) {
    lines.push(`### ${level.level} ${level.name}（缺 ${level.total - level.count} 条）`, '');
    if (level.gaps.length === 0) {
      lines.push('- 无', '');
      continue;
    }
    for (const gap of level.gaps) {
      lines.push(`- \`${gap.element}\`（第 ${gap.chapter || '?'} 章）：${gap.reason}`);
    }
    lines.push('');
  }

  lines.push('## 四、词素明细', '');
  lines.push('| 成分 | 释义 | 章 | 语源 | 词素 ID | L1 | L2 | L3 | L4 | L5 | L6 | L7 | 卡在 |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of elementRows) {
    lines.push(
      `| ${row.element} | ${row.gloss} | ${row.chapter} | ${row.source} | ${row.morphemeId ?? '—'} | ${LEVELS.map((level) => (row.levels[level] ? '✓' : '—')).join(' | ')} | ${row.gap === 'done' ? '全过' : row.gap} |`,
    );
  }
  lines.push('');

  lines.push('## 五、知识点覆盖', '');
  lines.push(`- 已识别知识点：${summary.s1.knowledgePoints}`);
  lines.push(`- 已映射到课程：${summary.s1.knowledgePointsTaught}（${pct(summary.s1.knowledgePointsTaught, summary.s1.knowledgePoints)}）`);
  lines.push(`- 章节数：${summary.s1.chapters}，小节数：${summary.s1.sections}，题型种类：${summary.s1.exerciseTypes}`);
  lines.push('');

  lines.push('## 六、知识点明细', '');
  lines.push('| 知识点 | 章 | 小节 | 类型 | 课时声明 | 仅生成映射 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const kp of kpRows) {
    lines.push(
      `| ${kp.title} | ${kp.chapter} | ${kp.section} | ${kp.type} | ${kp.claimedBy.join(', ') || '—'} | ${kp.mappedOnly.join(', ') || '—'} |`,
    );
  }
  lines.push('');

  writeFileSync(join(root, 'docs/TEXTBOOK_COVERAGE.md'), lines.join('\n'), 'utf-8');
  console.log('docs/TEXTBOOK_COVERAGE.md written');
}
