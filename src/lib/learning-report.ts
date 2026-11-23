/**
 * Personal learning report (0.11.0).
 *
 * The lesson-time audit has always been an estimate: it counts what a lesson
 * contains, not what a learner spent. Attempts carry a real `durationMs`, so the
 * report can finally say how long study actually took, which kinds of exercise
 * fail, and which concepts collect the mistakes.
 *
 * What it deliberately does not do: infer error *types* the data does not
 * contain, or claim that a score change proves the teaching worked.
 */
import type { Attempt, Exercise } from './types';

export interface KindAccuracy {
  kind: Exercise['kind'];
  attempts: number;
  correct: number;
  accuracy: number;
  minutes: number;
}

export interface WeakConcept {
  conceptId: string;
  wrong: number;
  attempts: number;
  accuracy: number;
}

export interface RepeatedMistake {
  exerciseId: string;
  lessonId: string;
  wrong: number;
}

export interface LearningReport {
  attempts: number;
  /** Real time spent answering, summed from per-attempt duration. */
  minutes: number;
  activeDays: number;
  byKind: KindAccuracy[];
  weakConcepts: WeakConcept[];
  repeated: RepeatedMistake[];
  /** Things the data cannot answer, stated instead of guessed. */
  limitations: string[];
}

/**
 * Local calendar day, matching the rest of the app.
 *
 * This used to be `toISOString().slice(0,10)`, i.e. UTC, while the daily stats
 * elsewhere use the local day — so an evening session west of Greenwich, or an
 * early morning east of it, landed on a different date in the two panels.
 */
export function localDay(ts: number): string {
  const date = new Date(ts);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Exercise lookup by id, so attempts can be joined to the concepts they tested. */
export type ExerciseIndex = Map<string, Exercise & { lessonId: string }>;

export function buildExerciseIndex(
  lessons: { id: string; practice?: Exercise[]; apply?: Exercise[] }[],
): ExerciseIndex {
  const index: ExerciseIndex = new Map();
  for (const lesson of lessons) {
    for (const exercise of [...(lesson.practice ?? []), ...(lesson.apply ?? [])]) {
      index.set(exercise.id, { ...exercise, lessonId: lesson.id });
    }
  }
  return index;
}

const KIND_LABEL: Record<string, string> = {
  mcq: '选择题',
  cloze: '填空',
  wordSum: 'Word Sum',
  matrix: '词基矩阵',
  judge: '真伪判断',
  boundary: '手动切分',
  order: '排序',
};

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

export function buildReport(attempts: Attempt[], index: ExerciseIndex, now = Date.now()): LearningReport {
  const byKind = new Map<string, KindAccuracy>();
  const byConcept = new Map<string, { wrong: number; attempts: number }>();
  const byExercise = new Map<string, { lessonId: string; wrong: number }>();
  const days = new Set<string>();

  for (const attempt of attempts) {
    const minutes = Math.max(0, attempt.durationMs ?? 0) / 60_000;

    const kindRow = byKind.get(attempt.kind) ?? {
      kind: attempt.kind,
      attempts: 0,
      correct: 0,
      accuracy: 0,
      minutes: 0,
    };
    kindRow.attempts += 1;
    kindRow.minutes += minutes;
    if (attempt.correct) kindRow.correct += 1;
    byKind.set(attempt.kind, kindRow);

    days.add(localDay(attempt.ts));

    const exercise = index.get(attempt.exerciseId);
    if (exercise?.concepts?.length) {
      for (const conceptId of exercise.concepts) {
        const row = byConcept.get(conceptId) ?? { wrong: 0, attempts: 0 };
        row.attempts += 1;
        if (!attempt.correct) row.wrong += 1;
        byConcept.set(conceptId, row);
      }
    }

    if (!attempt.correct) {
      const row = byExercise.get(attempt.exerciseId) ?? { lessonId: attempt.lessonId, wrong: 0 };
      row.wrong += 1;
      byExercise.set(attempt.exerciseId, row);
    }
  }

  const kinds: KindAccuracy[] = [...byKind.values()]
    .map((row) => ({ ...row, minutes: Math.round(row.minutes), accuracy: row.attempts ? row.correct / row.attempts : 0 }))
    .sort((a, b) => b.attempts - a.attempts);

  const weakConcepts: WeakConcept[] = [...byConcept.entries()]
    .map(([conceptId, row]) => ({
      conceptId,
      wrong: row.wrong,
      attempts: row.attempts,
      accuracy: row.attempts ? (row.attempts - row.wrong) / row.attempts : 0,
    }))
    // One mistake out of one attempt is noise, not a weak spot.
    .filter((row) => row.wrong >= 2)
    .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy)
    .slice(0, 8);

  const repeated: RepeatedMistake[] = [...byExercise.entries()]
    .filter(([, row]) => row.wrong >= 2)
    .map(([exerciseId, row]) => ({ exerciseId, lessonId: row.lessonId, wrong: row.wrong }))
    .sort((a, b) => b.wrong - a.wrong)
    .slice(0, 8);

  const minutes = Math.round(attempts.reduce((sum, a) => sum + Math.max(0, a.durationMs ?? 0), 0) / 60_000);

  return {
    attempts: attempts.length,
    minutes,
    activeDays: days.size,
    byKind: kinds,
    weakConcepts,
    repeated,
    limitations: [
      '用时来自每道题的作答时长，不含阅读卡片的时间。',
      '提示使用次数没有记录：题目里有 hint 文本，但没有"点了提示"的事件。',
      '错误类型只能按题型分，不能区分"规则没掌握"与"粗心"。',
      `统计截至 ${new Date(now).toLocaleString('zh-CN')}。`,
    ],
  };
}

/** Machine-readable export; the same shape the UI renders. */
export function serializeReport(report: LearningReport): string {
  return JSON.stringify(
    {
      format: 'wordroots.learning-report',
      version: 1,
      generatedAt: new Date().toISOString(),
      report,
      // Repeated explicitly so an exporter cannot quietly drop the caveats.
      disclaimer:
        '这些是学习记录，不是教学效果证据：没有对照组、没有随机分组。分数或正确率的变化不能归因于课程。',
    },
    null,
    2,
  );
}
