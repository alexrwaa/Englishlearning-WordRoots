/**
 * WordRoots domain model — single source of truth shared by UI, engines and
 * the content pipeline. Content JSON must validate against these types
 * (see docs/CONTENT_SCHEMA.md and scripts/validate-content.ts).
 */

export type CEFR = 'A2' | 'B1' | 'B2' | 'C1';
export type LangOrigin =
  | 'OE'
  | 'ME'
  | 'Lat'
  | 'Gk'
  | 'Fr'
  | 'Norse'
  | 'It'
  | 'Sp'
  | 'Ger'
  | 'Ar'
  | 'unknown';

/** Where a knowledge claim comes from. Kept short but traceable. */
export interface SourceRef {
  /** S1 = English Vocabulary Elements, S2 = Essentials of Linguistics,
   *  S3 = WordWorks SWI, S4 = New Word-Analysis, S5 = modern reference work. */
  id: 'S1' | 'S2' | 'S3' | 'S4' | 'S5';
  title: string;
  detail?: string;
  url?: string;
}

export interface TermGloss {
  term: string;
  zh: string;
  en?: string;
  note?: string;
}

/** A morpheme entry (root, prefix, suffix or combining form). */
export interface Morpheme {
  id: string;
  /** Surface form as shown in a word matrix, e.g. "un", "struct", "-tion". */
  form: string;
  type: 'prefix' | 'root' | 'suffix' | 'combining';
  origin: LangOrigin;
  glossZh: string;
  glossEn: string;
  /** Positional / orthographic variants such as "struct/stru". */
  allomorphs?: string[];
  /** Short, verified example words. */
  examples: string[];
  /** Free-form teaching note, in Chinese, aimed at CET-4/6 readers. */
  note?: string;
  sources: SourceRef[];
}

/** A non-morpheme concept: a rule, a distinction, or a method. */
export interface Concept {
  id: string;
  zh: string;
  en: string;
  kind: 'concept' | 'rule' | 'method';
  summary: string;
  detail?: string;
  sources?: SourceRef[];
}

/** A verified word entry used by the Word Matrix / Word Sum engines. */
export interface WordEntry {
  /** Surface spelling, lowercase. */
  w: string;
  /** Verified morphemic analysis, base first is NOT required; order = spelling order. */
  parts: string[];
  pos?: 'n' | 'v' | 'adj' | 'adv' | 'other';
  glossZh: string;
  glossEn?: string;
  /** Etymology note, only when backed by a source. */
  ety?: {
    from?: string;
    firstAttested?: string;
    note?: string;
    sources?: SourceRef[];
  };
  /** Concepts / morphemes this word demonstrates. */
  tags?: string[];
  /** Domain tag for scientific-English lessons. */
  domain?: 'robotics' | 'slam' | 'sensor' | 'cs' | 'ai' | 'science' | 'general';
}

export interface EtymStep {
  period: string;
  form: string;
  note?: string;
}

export interface MatrixCell {
  text: string;
  glossZh: string;
}

export type Card =
  | {
      kind: 'text';
      title: string;
      body: string;
      terms?: TermGloss[];
      morphemes?: string[];
    }
  | {
      kind: 'etym';
      title: string;
      body: string;
      steps?: EtymStep[];
      terms?: TermGloss[];
    }
  | {
      kind: 'table';
      title: string;
      body: string;
      head: string[];
      rows: string[][];
    }
  | {
      kind: 'matrix';
      title: string;
      body: string;
      base: string;
      prefixes: MatrixCell[];
      suffixes: MatrixCell[];
      words: { w: string; parts: string[]; glossZh: string }[];
    }
  | {
      kind: 'sum';
      title: string;
      body: string;
      sums: { parts: string[]; result: string; glossZh: string; note?: string }[];
    }
  | {
      kind: 'compare';
      title: string;
      body: string;
      a: string;
      b: string;
      rows: { label: string; a: string; b: string }[];
    }
  | {
      kind: 'passage';
      title: string;
      body: string;
      /** English excerpt for reading practice, with optional gloss. */
      excerpt: string;
      glossZh?: string;
      questions?: { q: string; a: string }[];
    };

export interface BaseExercise {
  id: string;
  prompt: string;
  hint?: string;
  explain: string;
  /** Concepts exercised — used to schedule the right memory card. */
  concepts?: string[];
}

export type Exercise =
  | (BaseExercise & {
      kind: 'mcq';
      choices: string[];
      answer: number;
    })
  | (BaseExercise & {
      kind: 'cloze';
      /** Sentence containing "___" for the gap. */
      sentence: string;
      answer: string;
      accept?: string[];
    })
  | (BaseExercise & {
      kind: 'wordSum';
      parts: string[];
      answer: string;
    })
  | (BaseExercise & {
      kind: 'matrix';
      base: string;
      prefix?: string;
      suffix?: string;
      answer: string;
    })
  | (BaseExercise & {
      kind: 'infer';
      passage: string;
      word: string;
      choices: string[];
      answer: number;
      strategy: string;
    });

export interface Lesson {
  /** Stable id, "w03d02" = week 3 day 2. */
  id: string;
  week: number;
  day: number;
  title: string;
  tagline: string;
  objectives: string[];
  /** Lesson ids or concept ids that should be studied first. */
  prereqs: string[];
  /** Concept / morpheme ids taught or reinforced here. */
  concepts: string[];
  minutes: { review: number; learn: number; practice: number; apply: number };
  level: CEFR;
  cards: Card[];
  practice: Exercise[];
  apply: Exercise[];
  sources: SourceRef[];
}

export interface Week {
  week: number;
  theme: string;
  intro: string;
  lessons: Lesson[];
}

export interface Curriculum {
  version: string;
  weeks: Week[];
}

/* ------------------------------------------------------------------ */
/* Learning state                                                      */
/* ------------------------------------------------------------------ */

export type CardKind = 'concept' | 'inference';

export interface MemoryCard {
  cardId: string;
  kind: CardKind;
  refId: string;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  /** 0 = new, 1 = learning, 2 = review, 3 = relearning */
  state: 0 | 1 | 2 | 3;
  due: number;
  lastReview: number | null;
}

export type LessonStatus = 'not_started' | 'in_progress' | 'completed';

export interface LessonState {
  lessonId: string;
  status: LessonStatus;
  startedAt: number | null;
  completedAt: number | null;
  elapsedMs: number;
  /** 0..1, share of exercises answered correctly on first try. */
  score: number | null;
  /** Position inside the lesson so the session can resume. */
  cursor: number;
}

export interface ReviewLog {
  id?: number;
  cardId: string;
  rating: 1 | 2 | 3 | 4;
  ts: number;
  correct: boolean;
  phase: 'review' | 'learn' | 'practice' | 'apply';
  elapsedMs?: number;
}

export interface Attempt {
  lessonId: string;
  exerciseId: string;
  kind: Exercise['kind'];
  correct: boolean;
  ts: number;
  durationMs: number;
  answer?: string;
}

export interface Note {
  id: number;
  targetType: 'word' | 'morpheme' | 'concept' | 'lesson';
  targetId: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface Stats {
  streakDays: number;
  totalMinutes: number;
  lessonsCompleted: number;
  morphemesMastered: number;
  rulesMastered: number;
  inferenceAccuracy: number;
  reviewCompletion: number;
  weakConcepts: { id: string; label: string; lapses: number; accuracy: number }[];
  errorKinds: { kind: string; count: number }[];
  daily: { date: string; minutes: number; reviews: number; accuracy: number }[];
}

export interface Settings {
  dailyMinutes: number;
  newCardsPerDay: number;
  targetRetention: number;
  theme: 'light' | 'sepia' | 'dark';
  fontScale: number;
  /** zh = 中文为主, bi = 中英对照, en = 英文为主 */
  explanationMode: 'zh' | 'bi' | 'en';
  showEtymologyByDefault: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  dailyMinutes: 25,
  newCardsPerDay: 8,
  targetRetention: 0.9,
  theme: 'light',
  fontScale: 1,
  explanationMode: 'zh',
  showEtymologyByDefault: true,
};
