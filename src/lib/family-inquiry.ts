/**
 * Family inquiry: the six-step SWI loop as data + checks (0.11.0).
 *
 * The family page used to be a reference table: it printed the split, the gloss
 * and the derivation for every member before the learner had wondered anything.
 * Structured Word Inquiry runs the other way round — observe forms, notice a
 * pattern, state a hypothesis, test it, meet a counterexample, then write the sum.
 *
 * Everything here is pure so the rules can be tested without a DOM, and so the
 * page can stay a thin renderer. Two grading rules matter:
 *
 *   1. Only factual membership and spelling sums are auto-graded. A free-text
 *      hypothesis is never marked right or wrong: the app cannot know which
 *      honest formulation the learner used.
 *   2. A word missing from the lexicon is not "not a word". Items are drawn from
 *      the dossier, which lists real English words whether or not we have an
 *      entry for them.
 */
import type { FamilyDossier } from '../lib/content';

export type InquiryStepId = 'observe' | 'discover' | 'hypothesize' | 'verify' | 'counterexample' | 'summarize';

export interface InquiryStep {
  id: InquiryStepId;
  title: string;
  prompt: string;
  /** What the learner does, in their own words — shown above the control. */
  action: string;
}

export interface ObserveItem {
  w: string;
  /** True when the lexicon can open this word's entry. */
  known: boolean;
}

export interface VerifyItem {
  w: string;
  inFamily: boolean;
  /** Shown only after the learner answers. */
  explain: string;
}

export interface InquiryModel {
  steps: InquiryStep[];
  observe: ObserveItem[];
  /** Words that look like members but are not (homographs, loans). */
  traps: { form: string; note: string }[];
  verify: VerifyItem[];
  /** Root sense in the learner's language, revealed only on request. */
  rootSense: string;
  /** Accepted word sums for the summary step; alternatives are all legitimate. */
  sums: { word: string; accepted: string[][] }[];
  matrix: string[][];
  hints: string[];
}

const STEPS: InquiryStep[] = [
  {
    id: 'observe',
    title: '① 观察',
    prompt: '先只看这些词形，不看任何拆解。',
    action: '把它们共有的字母串圈出来，说出你看到的三件事。',
  },
  {
    id: 'discover',
    title: '② 发现',
    prompt: '哪一个是"混进来"的词？',
    action: '在下面这一组里挑出那个长得像、但来历不同的词。',
  },
  {
    id: 'hypothesize',
    title: '③ 假设',
    prompt: '这个词根大概是什么意思？',
    action: '用一句话写下你的猜测。写错不算错，先有假设才有检验。',
  },
  {
    id: 'verify',
    title: '④ 验证',
    prompt: '用新词检验你的假设。',
    action: '判断每个词是否属于这一族，并说明理由。',
  },
  {
    id: 'counterexample',
    title: '⑤ 反例',
    prompt: '有些词长得像，却不能用这条规则解释。',
    action: '读一读它们为什么不算，再回到你的假设看要不要修正。',
  },
  {
    id: 'summarize',
    title: '⑥ 总结',
    prompt: '用 Word Sum 把结构写出来。',
    action: '给一个词写出词素相加的式子；多种写法只要成立都算对。',
  },
];

/** Split "in + spect + ion" style strings into parts, dropping arrows/spaces. */
export function splitSum(sum: string): string[] {
  return sum
    .split(/[+\-–—>→]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Check a learner's sum against the accepted alternatives.
 *
 * A sum matches when it uses the same parts as any accepted split, ignoring
 * order-insensitive spelling differences such as a doubled consonant at the
 * join (ad + ferent vs afferent) — that is orthography, not analysis.
 */
export function checkSum(input: string, accepted: string[][]): { ok: boolean; normalized: string[] } {
  const parts = splitSum(input);
  const normalized = parts.map((part) => part.replace(/(.)\1+/g, '$1'));
  for (const alternative of accepted) {
    const wanted = alternative.map((part) => part.toLowerCase().replace(/(.)\1+/g, '$1'));
    if (wanted.length !== normalized.length) continue;
    if (wanted.every((part, index) => part === normalized[index])) return { ok: true, normalized };
  }
  return { ok: false, normalized };
}

/**
 * Compare a free-text hypothesis with the reference sense, without grading it.
 *
 * Returns a coarse relation so the page can say "接近参考义" or "和参考义差得远，
 * 但你的说法也可能是对的" — never "错误".
 */
export function compareHypothesis(input: string, reference: string): 'close' | 'related' | 'distant' {
  const text = input.trim();
  if (!text) return 'distant';
  const ref = reference.toLowerCase();
  const cleaned = text.toLowerCase();
  if (cleaned.includes(ref) || ref.includes(cleaned)) return 'close';
  const refChars = new Set([...ref].filter((ch) => /[\u4e00-\u9fa5a-z]/.test(ch)));
  const hit = [...cleaned].filter((ch) => refChars.has(ch)).length;
  if (hit >= 1) return 'related';
  return 'distant';
}

const HINT_BANK = [
  '去掉前缀和后缀，剩下的那段字母在各词里是同一串吗？',
  '把每个词的意思用一句话说出来，找它们共同指向的动作或状态。',
  '有一个词的"像"只是拼写上的：它的词源和这一族没有关系。',
];

/** Build the inquiry model for one dossier. Pure: same input, same output. */
export function buildInquiry(
  dossier: FamilyDossier,
  known: (word: string) => boolean,
): InquiryModel {
  const members = (dossier.members ?? []).filter((member) => member.w);
  // Observe on real members only; the traps arrive later so the first step is not
  // a guessing game about which rows are fake.
  const observe = members.slice(0, 6).map((member) => ({ w: member.w, known: known(member.w) }));

  const traps = (dossier.homographTraps ?? []).map((trap) => ({
    form: trap.form,
    note: trap.note ?? trap.other ?? '同形异源，不能按这一族的规则分析。',
  }));

  // Verification uses members as positives and traps as negatives; both are
  // factual, so this is the one place auto-grading is safe.
  const verify: VerifyItem[] = [
    ...members.slice(0, 4).map((member) => ({
      w: member.w,
      inFamily: true,
      explain:
        member.note ??
        `${member.w} 由 ${(member.layer ?? []).join(' + ') || '该词根'} 构成，属于这一族。`,
    })),
    ...traps.slice(0, 2).map((trap) => ({
      w: trap.form,
      inFamily: false,
      explain: trap.note,
    })),
  ];

  const sums = members
    .filter((member) => (member.layer?.length ?? 0) >= 2)
    .slice(0, 3)
    .map((member) => ({
      word: member.w,
      // The dossier's own split plus the same split without the connecting vowel,
      // which is the alternative learners most often write.
      accepted: [member.layer as string[], (member.layer as string[]).filter((part) => part !== 'o')],
    }));

  const matrix = (dossier.derivationChains ?? [])
    .slice(0, 3)
    .map((chain) => chain.stages.map((stage) => stage.toLowerCase()));

  return {
    steps: STEPS,
    observe,
    traps,
    verify,
    rootSense: dossier.root?.glossZh ?? '',
    sums,
    matrix,
    hints: HINT_BANK,
  };
}

/** Progress is per family and local: a learner can leave and come back. */
export const INQUIRY_STORAGE_KEY = 'wordroots.family.inquiry.v1';

export interface InquiryProgress {
  step: number;
  done: InquiryStepId[];
  hypothesis: string;
  updatedAt: number;
}

export function loadProgress(familyId: string, storage: Pick<Storage, 'getItem'>): InquiryProgress | null {
  try {
    const raw = storage.getItem(INQUIRY_STORAGE_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw) as Record<string, InquiryProgress>;
    const entry = all[familyId];
    if (!entry || typeof entry.step !== 'number') return null;
    return entry;
  } catch {
    return null;
  }
}

export function saveProgress(
  familyId: string,
  progress: Omit<InquiryProgress, 'updatedAt'>,
  storage: Pick<Storage, 'getItem' | 'setItem'>,
): void {
  try {
    const raw = storage.getItem(INQUIRY_STORAGE_KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, InquiryProgress>) : {};
    all[familyId] = { ...progress, updatedAt: Date.now() };
    storage.setItem(INQUIRY_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* a full or unavailable store must not break the lesson */
  }
}
