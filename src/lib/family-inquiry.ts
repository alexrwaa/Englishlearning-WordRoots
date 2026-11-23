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
import type { AnalysisKind, FamilyDossier } from '../lib/content';
import { checkSum as judgeWordSum, splitSum, ungradedVerdict, type SumVerdict } from './word-sum';

export { splitSum };
export type { AnalysisKind };

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

/** Exploration depth. Members are sorted into these by how much structure they show. */
export type Tier = 'basic' | 'variation' | 'advanced' | 'transfer';

/** One documented analysis of a word, kept with the claim it makes. */
export interface SumAnalysis {
  layer: string[];
  kind: AnalysisKind;
  verified: boolean;
  /** Id in the dossier's `sources`, required before this may be graded. */
  source?: string;
  note?: string;
}

/**
 * One row of the summarize step.
 *
 * `graded` is the gate. When false the reference structure is still shown, but
 * `gradeSum` returns `unresolved`: a historical, analogical or unverified split
 * must never be the one right answer.
 */
export interface SumEntry {
  word: string;
  /** Every live analysis. More than one means the question accepts all of them. */
  accepted: string[][];
  graded: boolean;
  /** The primary analysis, or `unverified` when nothing was checked. */
  kind: AnalysisKind;
  source?: string;
  /** Why this row is or is not graded; shown to the learner either way. */
  note?: string;
  /** All documented analyses, so the page can show more than one. */
  analyses: SumAnalysis[];
}


export interface InquiryOptions {
  /** Which pass through this family this is; shifts which words appear. */
  session?: number;
  /** Words already met in earlier sessions, so a second pass is not a repeat. */
  explored?: string[];
}

export interface InquiryModel {
  session: number;
  /** How many words the learner has already seen in this family. */
  seen: number;
  steps: InquiryStep[];
  observe: ObserveItem[];
  /** Words that look like members but are not (homographs, loans). */
  traps: { form: string; note: string }[];
  verify: VerifyItem[];
  /** Root sense in the learner's language, revealed only on request. */
  rootSense: string;
  /** Accepted word sums for the summary step; alternatives are all legitimate. */
  sums: SumEntry[];
  /**
   * Reference structures shown but never graded: historical, analogical,
   * unverified, cognate, or words with more than one live analysis.
   */
  ungraded: SumEntry[];
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

/**
 * Check a learner's sum against the accepted alternatives.
 *
 * The analysis (structure) and the spelling are graded separately. A sum only
 * passes when the morphemes match and every letter is either identical to the
 * reference or changed by one of the five documented rules in `word-sum`
 * (e-drop, y→i, consonant doubling, whitelisted assimilation, connective
 * vowel). Different letters are no longer smoothed away: `pres` is not `press`.
 */
export function checkSum(input: string, accepted: string[][]): SumVerdict {
  return judgeWordSum(input, accepted);
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

/**
 * Which layer a member belongs to.
 *
 * A bare root+affix member teaches the pattern; a member with more affixes
 * teaches how the pattern varies; a cognate teaches that a shared root is not a
 * modern derivation. The learner meets them in that order.
 */
export function tierOf(member: { relation?: string; layer?: string[] }): Tier {
  if (member.relation === 'cognate') return 'advanced';
  return (member.layer?.length ?? 0) >= 3 ? 'variation' : 'basic';
}

const TIER_LABEL: Record<Tier, string> = {
  basic: '基础',
  variation: '变化',
  advanced: '进阶',
  transfer: '迁移',
};

export function tierLabel(tier: Tier): string {
  return TIER_LABEL[tier];
}

const HINT_BANK = [
  '去掉前缀和后缀，剩下的那段字母在各词里是同一串吗？',
  '把每个词的意思用一句话说出来，找它们共同指向的动作或状态。',
  '有一个词的"像"只是拼写上的：它的词源和这一族没有关系。',
];

/* -------------------------------- sum gate -------------------------------- */

type MemberLike = NonNullable<FamilyDossier['members']>[number];

function stripBoundary(part: string): string {
  return part.replace(/^-+|-+$/g, '');
}

/**
 * Does `layer` actually spell `word`?
 *
 * `capacity` as `cap + -ity` does not — the letters give "capity". Such a split
 * can still be a useful historical note, but it cannot be the spelling a
 * learner is asked to reproduce. A silent e may drop at a morpheme seam before
 * a vowel, because e-drop is a documented rule (`create + ion` → `creation`,
 * `spectate + -or` → `spectator`).
 */
export function spellsOut(layer: string[], word: string): boolean {
  const parts = layer.map(stripBoundary);
  const plain = parts.join('');
  const withEDrop = parts
    .map((part, index) => {
      const next = parts[index + 1] ?? '';
      // e-drop only at a real morpheme seam, before a vowel-initial suffix:
      // create + ion → creation, spectate + -or → spectator.
      const drops = index < parts.length - 1 && part.endsWith('e') && /^[aeiou]/.test(next);
      return drops ? part.slice(0, -1) : part;
    })
    .join('');
  return plain === word || withEDrop === word;
}

/**
 * The claim a member's `layer` makes.
 *
 * Absence of `analysis` means nobody checked, not that the split is modern:
 * the default is `unverified`, which never grades.
 */
export function classifyMember(member: Pick<MemberLike, 'relation' | 'layer' | 'analysis'>): SumAnalysis {
  const analysis = member.analysis;
  const kind: AnalysisKind =
    analysis?.kind ?? (member.relation === 'cognate' ? 'cognate' : 'unverified');
  return {
    layer: member.layer ?? [],
    kind,
    verified: analysis?.verified === true,
    source: analysis?.source,
    note: analysis?.note,
  };
}

/**
 * The gate. A structure is auto-gradable only when it is a modern analysis,
 * someone verified it, the verification names a source, the split has at least
 * two parts, and the letters actually build the word.
 */
export function isGradable(analysis: SumAnalysis, word: string): boolean {
  return (
    analysis.kind === 'synchronous' &&
    analysis.verified &&
    typeof analysis.source === 'string' &&
    analysis.source.trim().length > 0 &&
    analysis.layer.length >= 2 &&
    spellsOut(analysis.layer, word)
  );
}

/** Every documented analysis of a member: the primary layer plus alternatives. */
export function analysesOf(member: Pick<MemberLike, 'relation' | 'layer' | 'analysis'>): SumAnalysis[] {
  const primary = classifyMember(member);
  const alternatives = (member.analysis?.alternatives ?? []).map((alt) => ({
    layer: alt.layer,
    kind: alt.kind,
    verified: alt.verified === true,
    source: alt.source,
    note: alt.note,
  }));
  const seen = new Set<string>();
  return [primary, ...alternatives].filter((entry) => {
    if (entry.layer.length === 0) return false;
    const key = `${entry.kind}:${entry.layer.join('|')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Why a row is displayed without a verdict, in the learner's language. */
function ungradedNote(primary: SumAnalysis, word: string): string {
  const split = primary.layer.join(' + ');
  switch (primary.kind) {
    case 'cognate':
      return `${word} 与这一族历史同源，不是现代派生，不给标准答案。`;
    case 'historical':
      return `${word} 的 ${split} 是历史形态，不作为现代标准答案。`;
    case 'analogical':
      return `${word} 的 ${split} 是教学拆分，不是一条现代构词规则，不作为标准答案。`;
    default:
      return `${word} 的参考结构尚未核实来源，不作为标准答案。`;
  }
}

/** Factual membership line for the verify step; never claims a rule it lacks. */
function explainMember(member: MemberLike): string {
  const primary = classifyMember(member);
  const split = primary.layer.join(' + ') || '该词根';
  if (primary.kind === 'cognate' || member.relation === 'cognate') {
    return `${member.w} 与这一族历史同源，但不是现代派生——同源与派生不能混为一谈。`;
  }
  if (primary.kind === 'historical') {
    return `${member.w} 历史上来自 ${split}，现代共时不按这个切分分析；它仍属于这一族。`;
  }
  if (primary.kind === 'analogical') {
    return `${member.w} 可以用 ${split} 作教学拆分来记，但这不是一条现代构词规则。`;
  }
  if (primary.kind === 'unverified') {
    return `${member.w} 属于这一族；参考结构尚未核实，不作为标准答案。`;
  }
  return member.note ?? `${member.w} 由 ${split} 构成，属于这一族。`;
}

/**
 * Judge one summarize-step row.
 *
 * An ungraded row always returns `unresolved` with the reason: the learner is
 * not wrong, the reference is simply not a modern rule. Graded rows may accept
 * several analyses, and any one of them passes.
 */
export function gradeSum(input: string, entry: SumEntry): SumVerdict {
  if (!entry.graded) {
    return ungradedVerdict(
      entry.note ?? '这条参考结构不作为标准答案，不判对错。',
      entry.analyses.flatMap((analysis) => analysis.layer),
    );
  }
  return judgeWordSum(input, entry.accepted);
}


/** Build the inquiry model for one dossier. Pure: same input, same output. */
export function buildInquiry(
  dossier: FamilyDossier,
  known: (word: string) => boolean,
  options: InquiryOptions = {},
): InquiryModel {
  const members = (dossier.members ?? []).filter((member) => member.w);
  // Observe on real members only; the traps arrive later so the first step is not
  // a guessing game about which rows are fake.
  const session = Math.max(0, options.session ?? 0);
  const explored = new Set((options.explored ?? []).map((w) => w.toLowerCase()));

  // Three pools, chosen by what a word shows: a bare root+affix member teaches
  // the pattern, a multi-affix member teaches the variation, and a cognate
  // teaches that similarity is not descent.
  const pools: Record<'basic' | 'variation' | 'advanced', typeof members> = {
    basic: members.filter((m) => m.relation !== 'cognate' && (m.layer?.length ?? 0) <= 2),
    variation: members.filter((m) => m.relation !== 'cognate' && (m.layer?.length ?? 0) >= 3),
    advanced: members.filter((m) => m.relation === 'cognate'),
  };

  /** Rotate through a pool by session, preferring words this learner has not met. */
  const pick = (pool: typeof members, count: number): typeof members => {
    const fresh = pool.filter((m) => !explored.has(m.w.toLowerCase()));
    const source = fresh.length >= count ? fresh : pool;
    if (source.length === 0) return [];
    const out: typeof members = [];
    for (let i = 0; i < Math.min(count, source.length); i += 1) {
      const member = source[(session + i) % source.length];
      if (!out.some((m) => m.w === member.w)) out.push(member);
    }
    return out;
  };

  const observed = [
    ...pick(pools.basic, 3),
    ...pick(pools.variation, 2),
    ...pick(pools.advanced, 1),
  ];
  // A family with few members must still show something: fall back to the head
  // of the list rather than an empty first step.
  const observeMembers = observed.length >= 4 ? observed : members.slice(0, 6);
  const observe = observeMembers.map((member) => ({ w: member.w, known: known(member.w) }));
  const seen = members.filter((m) => explored.has(m.w.toLowerCase())).length;

  const traps = (dossier.homographTraps ?? []).map((trap) => ({
    form: trap.form,
    note: trap.note ?? trap.other ?? '同形异源，不能按这一族的规则分析。',
  }));

  // Verification uses members as positives and traps as negatives; both are
  // factual, so this is the one place auto-grading is safe.
  // Verification uses words this session did not show, so the answer cannot be
  // read off the observe step.
  const shown = new Set(observeMembers.map((m) => m.w));
  const unseen = members.filter((m) => !shown.has(m.w));
  const verifyMembers = (unseen.length >= 2 ? unseen : members).slice(session % Math.max(1, (unseen.length || members.length) - 1), undefined).slice(0, 2);
  const verify: VerifyItem[] = [
    ...(verifyMembers.length >= 2 ? verifyMembers : members.slice(0, 2)).map((member) => ({
      w: member.w,
      inFamily: true,
      explain: explainMember(member),
    })),
    ...traps.slice(0, 2).map((trap) => ({
      w: trap.form,
      inFamily: false,
      explain: trap.note,
    })),
  ];

  // Only a modern, verified, sourced structure may be graded. Everything else
  // is still shown — but as a reference, never as the one right answer. A word
  // with a documented historical analysis alongside a live one (spectator) is
  // not a unique-answer question at all.
  const analysable = members.filter((member) => (member.layer?.length ?? 0) >= 2);
  const sumEntries: SumEntry[] = [];
  const ungradedEntries: SumEntry[] = [];
  for (const member of analysable) {
    const analyses = analysesOf(member);
    const live = analyses.filter((entry) => isGradable(entry, member.w));
    const historical = analyses.filter((entry) => entry.kind === 'historical');
    const contested = historical.length > 0;

    if (live.length > 0 && !contested) {
      const accepted: string[][] = [];
      const seenForms = new Set<string>();
      for (const entry of live) {
        const key = entry.layer.join('|');
        if (seenForms.has(key)) continue;
        seenForms.add(key);
        accepted.push(entry.layer);
      }
      sumEntries.push({
        word: member.w,
        accepted,
        graded: true,
        kind: 'synchronous',
        source: live[0].source,
        note: live.length > 1 ? '这个词有多种成立的分析，写哪一种都算对。' : undefined,
        analyses,
      });
      continue;
    }

    const primary = live[0] ?? analyses[0];
    const note =
      live.length > 0
        ? `${member.w} 有两种都成立的分析：${live[0].layer.join(' + ')}（现代）与 ` +
          `${historical.map((entry) => entry.layer.join(' + ')).join(' / ')}（历史）。不设唯一答案。`
        : ungradedNote(primary, member.w);
    ungradedEntries.push({
      word: member.w,
      accepted: analyses.map((entry) => entry.layer),
      graded: false,
      kind: primary.kind,
      source: primary.source,
      note,
      analyses,
    });
  }

  const sumStart = sumEntries.length > 0 ? session % sumEntries.length : 0;
  const sums = [...sumEntries.slice(sumStart), ...sumEntries.slice(0, sumStart)].slice(0, 3);

  // Every documented chain, not the first three: truncating here hid real
  // members of large families from the summary step.
  const matrix = (dossier.derivationChains ?? []).map((chain) =>
    chain.stages.map((stage) => stage.toLowerCase()),
  );

  return {
    session,
    seen,
    steps: STEPS,
    observe,
    traps,
    verify,
    rootSense: dossier.root?.glossZh ?? '',
    sums,
    ungraded: ungradedEntries,
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
