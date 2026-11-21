/**
 * Morpheme identity migration — implements docs/DATA_IDENTITY.md §1–§6.
 *
 *   npx tsx scripts/identity-migrate.ts          # migrate in place
 *   npx tsx scripts/identity-migrate.ts --dry    # report only, write nothing
 *
 * What it does, in order:
 *   1. restore the homograph senses the old form-keyed merge swallowed;
 *   2. assign IDs from `form + origin + glossEn` (never from file order alone);
 *   3. complete `formKey` / `senseKey` / `identityStatus` / `homographs`;
 *   4. regenerate `forms.json` (form → [id…]);
 *   5. give every word `partIds` + `partResolution`;
 *   6. give every lesson card `morphemeIds` (only when unambiguous);
 *   7. write `analysis/identity-migration.json` for stored learner data.
 *
 * Every step is a pure function of the current files, so running it twice
 * produces the same IDs and the same forms.json. Nothing is deleted: a renamed
 * record keeps its old ID in `legacyIds`.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  glossContains,
  glossVariants,
  loadIdentity,
  normalizeForm,
  senseKeyOf,
  type FormIndex,
} from '../src/lib/identity';
import type { Lesson, Morpheme, SourceRef, WordEntry } from '../src/lib/types';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEX = join(root, 'src/content/lexicon');
const WEEKS = join(root, 'src/content/weeks');
const ANALYSIS = join(root, 'analysis');
const BACKUPS = join(ANALYSIS, 'backups');

const DRY = process.argv.includes('--dry');

type LMorpheme = Morpheme & { [key: string]: unknown };
type LWord = WordEntry & { [key: string]: unknown };

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf-8')) as T;
const writeJson = (path: string, data: unknown) => {
  if (DRY) return;
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
};

const KIND_OF: Record<Morpheme['type'], string> = {
  root: 'rx',
  prefix: 'px',
  suffix: 'sx',
  combining: 'cx',
};

/* ------------------------------------------------------------------ */
/* 1. Senses the form-keyed merge lost                                 */
/* ------------------------------------------------------------------ */

interface KnownSense {
  form: string;
  type: Morpheme['type'];
  origin: Morpheme['origin'];
  glossZh: string;
  glossEn: string;
  senseKey: string;
  allomorphs?: string[];
  examples: string[];
  familyId: string;
  textbookRefs: string[];
  note: string;
  sources: SourceRef[];
}

const S1 = (detail: string): SourceRef => ({ id: 'S1', title: 'English Vocabulary Elements', detail });
const S5 = (detail: string): SourceRef => ({
  id: 'S5',
  title: 'Modern etymological dictionaries (OED, Etymonline)',
  detail,
});

/**
 * Each entry is a *different linguistic entity* that shares its spelling with a
 * record already in the lexicon. Glosses, origins and example words are the
 * evidence for splitting them; `note` explains the split to the learner.
 */
const KNOWN_SENSES: KnownSense[] = [
  {
    form: 'plac',
    type: 'root',
    origin: 'Gk',
    glossZh: '平；平板',
    glossEn: 'flat',
    senseKey: 'flat',
    examples: ['placoid'],
    familyId: 'fam-plac-flat',
    textbookRefs: ['S1 C11'],
    note: '希腊 πλάξ / πλακός（plax, plakos）“平板、平面”。与拉丁 placere“使高兴”同形异源：placoid（板状的鳞）、placenta、placoderm（盾皮鱼）属这一支，placate、placid 属拉丁那一支。',
    sources: [S1('appendix, ch.11: plac “flat”'), S5('πλάξ “flat surface, plate” → placoid, placenta')],
  },
  {
    form: 'in',
    type: 'prefix',
    origin: 'Lat',
    glossZh: '向内；进入',
    glossEn: 'in, into',
    senseKey: 'in',
    allomorphs: ['im', 'il', 'ir'],
    examples: ['inject', 'inspect', 'induce'],
    familyId: 'fam-in-into',
    textbookRefs: ['S1 C3'],
    note: '拉丁介词 in“在内、向内”（PIE *en）。与否定前缀 in-（PIE *ne，“不”）同形异源：inject（投进去）、include（关进去）、inhale（吸进去）、inspect（往里看）属这一支；invisible、incomplete 属否定那一支。im- / il- / ir- 是两义共用的同化形式，所以按形式查它们必然是歧义的。',
    sources: [S1('appendix, ch.3: in- “in, into”'), S5('in “in, into” (PIE *en) vs in- “not” (PIE *ne)')],
  },
  {
    form: 'bi',
    type: 'root',
    origin: 'Gk',
    glossZh: '生命',
    glossEn: 'life',
    senseKey: 'life',
    examples: [],
    familyId: 'fam-bi-life',
    textbookRefs: ['S1 C1'],
    note: '教材按 bi 立目的希腊语“生命”成分（βίος bios）。英语实际拼写为 bio-，本库由 cx-bio 承接（biology、biography、biosphere），本条只为教材的 bi 立目提供身份，避免与拉丁 bi-“二”混为一谈。',
    sources: [S1('appendix, ch.1: bi “life”'), S5('βίος “life” → bio-')],
  },
  {
    form: 'ver',
    type: 'root',
    origin: 'Lat',
    glossZh: '敬畏；畏惧',
    glossEn: 'fear, awe',
    senseKey: 'fear',
    examples: ['revere', 'reverence'],
    familyId: 'fam-ver-fear',
    textbookRefs: ['S1 C2'],
    note: '拉丁 vereri“敬畏、畏惧”（PIE *wer- “留意、警觉”，与希腊 ὁράω“看见”同源）。与 vērus“真”是两个不同的拉丁词：revere、reverence、reverent 属这一支，verify、veracity、verdict 属“真”那一支。二者在英语里拼写完全相同，只能靠词族判断。',
    sources: [S5('revere < Latin revereri “to fear, revere”; cf. verus “true”')],
  },
];

/* ------------------------------------------------------------------ */
/* Evidence used to place a word part on the right homograph           */
/* ------------------------------------------------------------------ */

/**
 * Reading evidence, not a lookup table of answers: each pattern is a way the
 * etymology or gloss of a word can *state* which sense it uses. Patterns are
 * keyed by ID, so a missing/renamed ID simply scores 0 instead of guessing.
 */
const SENSE_PATTERNS: Record<string, RegExp[]> = {
  'px-in': [/[（(]\s*不\s*[）)]/, /\bnot\b/i, /否定/, /非/, /invisible|informal|incomplete/i],
  'px-in-lat-2': [/向内/, /进入/, /往里/, /\binto\b/i, /inject|include|inhale|inspect|induce/i],
  'cx-plac': [/please/i, /placere/i, /使高兴/, /安抚/, /placate|placid/i],
  // Same-spelling, different-etymon pairs added in 0.7.0. The cue is the Latin
  // etymon itself: a word whose etymology names terrere is not about terra.
  'cx-terr': [/\bterra\b/i, /土地/, /terrain|terrace|territory/i],
  'cx-terr-2': [/terrere/i, /territ/i, /frighten|scare/i, /恐吓|使害怕/, /terror|terrify|deter/i],
  'cx-sex': [/\bsix\b/i, /六个/, /hexa|sexang/i],
  'cx-sex-2': [/sexus/i, /gender/i, /性别|性$/, /sexual|sexism/i],
  'cx-sal-sil': [/salire/i, /跳/, /assail|assault|somersault|result/i],
  'cx-sal-2': [/\bsal\b/i, /\bsalt\b/i, /盐/, /saline|salad|salami/i],
  'cx-libr': [/\blibra\b/i, /天平|平衡/, /equilibrium|deliberate/i],
  'cx-libr-2': [/\bliber\b|libri/i, /\bbook\b/i, /书/, /librarian|libretto/i],
  'cx-par': [/parere/i, /生育|生产/, /parent|partum/i],
  'cx-par-2': [/parare/i, /\bprepare\b/i, /备好|准备/, /apparatus|repair|parade/i],
  'rx-man': [/\bmanus\b/i, /手/, /manual|manicure|manuscript/i],
  'rx-man-2': [/manere/i, /mansi/i, /停留|留下/, /remain|mansion|manor/i],
  'cx-cur': [/\bcura\b/i, /关心|照料/, /cure|curious|accurate/i],
  'cx-cur-2': [/currere/i, /\bcurs/i, /跑/, /current|cursor|excursion/i],
  'cx-ven': [/venire/i, /来/, /invent|prevent|convene/i],
  'cx-ven-2': [/\bvena\b/i, /\bvein\b/i, /静脉|血管/, /intravenous/i],
  // capt- is two etymologies: caput "head" (captain, capital) and capere "take"
  // (capture, captive). The word's own etymology decides.
  'rx-capit': [/\bcaput|capit/i, /头|首/, /capital|captain|chapter|decapitate/i],
  'rx-capt': [/\bcapere|\bcaptus/i, /抓|取|拿/, /capture|captive|caption|captivate|accept/i],
  'cx-plac-gk': [/flat/i, /plako?s?\b/i, /平面/, /平板/, /placoid|placenta|placoderm/i],
  'cx-ver': [/\btrue\b/i, /verus/i, /真实/, /verify|veracity|verdict/i],
  'cx-ver-lat-2': [/fear/i, /awe/i, /revere/i, /vereri/i, /敬畏/, /revere|reverence|reverent/i],
  'cx-bi': [/\btwo\b/i, /\bbis\b/i, /二/, /bicycle|bilingual|bilateral/i],
  'cx-bi-gk': [/life/i, /bios/i, /生命/, /biolog/i],
  'cx-bio': [/life/i, /bios/i, /生命/, /biolog/i],
  'cx-bin': [/two/i, /bini/i, /二/, /binary|binocular|binaural/i],
};

/** A lone `e` is an orthographic marker (silent e), never a morpheme. */
const ORTHOGRAPHIC = new Set(['e']);

/* ------------------------------------------------------------------ */
/* Words that evidence the split                                       */
/* ------------------------------------------------------------------ */

/**
 * A homograph split is only checkable if both senses have entry words. These
 * are added when missing so `placoid → Greek plac` can be *verified*, not just
 * asserted. Insert-only: an existing entry is never overwritten.
 */
const EVIDENCE_WORDS: LWord[] = [
  {
    w: 'binary',
    parts: ['bin', 'ary'],
    pos: 'adj',
    glossZh: '二进制的；二元的；由两部分组成的',
    glossEn: 'consisting of two; base-2',
    domain: 'cs',
    family: 'fam-bin',
    etymology: '晚期拉丁 binarius < bini「两个一组」，与 bis「两次」同源',
    derivation: ['bin-（两个一组）+ -ary → 二元的、二进制的'],
    verified: true,
    sources: [S5('binarius < bini “two each”')],
  },
  {
    w: 'placate',
    parts: ['plac', 'ate'],
    pos: 'v',
    glossZh: '安抚；平息；使高兴',
    glossEn: 'to make less angry; to appease',
    domain: 'general',
    family: 'fam-plac',
    etymology: '拉丁 placatus < placare「安抚、平息」< placere「使高兴」',
    derivation: ['plac（使高兴）+ -ate（动词后缀）→ 使平息、安抚'],
    verified: true,
    sources: [S5('placare “to appease” < placere “to please”')],
  },
  {
    w: 'placoid',
    parts: ['plac', 'oid'],
    pos: 'adj',
    glossZh: '板状的（指鲨鱼等鱼的盾鳞）',
    glossEn: 'plate-like (of fish scales)',
    domain: 'science',
    family: 'fam-plac-flat',
    etymology: '希腊 plax / plakos「平板、平面」+ -oeides「像……的」',
    derivation: ['plac（平板）+ -oid（像……的）→ 板状的'],
    verified: true,
    sources: [S5('Greek plax “flat surface” + -oeides “like”')],
  },
  {
    w: 'verify',
    parts: ['ver', 'ify'],
    pos: 'v',
    glossZh: '核实；证实；验证',
    glossEn: 'to check that something is true',
    domain: 'general',
    family: 'fam-ver',
    etymology: '中世纪拉丁 verificare < verus「真」+ facere「做」',
    derivation: ['ver（真）+ -ify（使……）→ 证明其为真'],
    verified: true,
    sources: [S5('verificare < verus “true”')],
  },
  {
    w: 'revere',
    parts: ['re', 'ver', 'e'],
    pos: 'v',
    glossZh: '尊敬；敬畏',
    glossEn: 'to respect deeply; to hold in awe',
    domain: 'general',
    family: 'fam-ver-fear',
    etymology: '拉丁 revereri < re-（加强）+ vereri「敬畏、畏惧」',
    derivation: ['re-（加强）+ ver（敬畏）+ e → 深深敬畏'],
    verified: true,
    sources: [S5('revereri “to fear, revere”')],
  },
  {
    w: 'reverence',
    parts: ['re', 'ver', 'ence'],
    pos: 'n',
    glossZh: '尊敬；敬畏',
    glossEn: 'deep respect; awe',
    domain: 'general',
    family: 'fam-ver-fear',
    etymology: '拉丁 reverentia < revereri「敬畏」',
    derivation: ['revere + -ence（名词后缀）→ 敬畏之情'],
    verified: true,
    sources: [S5('reverentia < revereri')],
  },
];

/**
 * Etymology that states which `in-` / `ver-` sense the word uses. Without it the
 * resolver must answer "ambiguous", which is honest but useless: the sense is
 * knowable, it just was never written down.
 */
const ETYMOLOGY_FIXES: { w: string; etymology: string }[] = [
  { w: 'inject', etymology: '拉丁 inicere < in-（向内）+ iacere（投、掷）→ 投入' },
  { w: 'invisible', etymology: '拉丁 invisibilis < in-（不）+ visibilis（可见的）' },
  { w: 'induct', etymology: '拉丁 inductus，inducere 的分词词干：in-（向内）+ ducere（引导）' },
  { w: 'inductive', etymology: 'induct + -ive；源自拉丁 inducere，in-（向内）+ ducere（引导）' },
  { w: 'inductor', etymology: 'induct + -or；源自拉丁 inducere，in-（向内）+ ducere（引导）' },
  { w: 'inference', etymology: '中世纪拉丁 inferentia < inferre：in-（向内）+ ferre（带）' },
  { w: 'inferential', etymology: 'inference + -ial；源自拉丁 inferre，in-（向内）+ ferre（带）' },
  { w: 'inscribe', etymology: '拉丁 inscribere：in-（向内、往上）+ scribere（写）' },
  { w: 'inscription', etymology: '拉丁 inscriptio < inscribere：in-（向内、往上）+ scribere（写）' },
  { w: 'incredible', etymology: '拉丁 incredibilis：in-（不）+ credibilis（可信的）' },
  { w: 'invert', etymology: '拉丁 invertere：in-（向内、转向）+ vertere（转）' },
];

/** Marker that the etymology already states the prefix sense. */
const SENSE_STATED = /[（(](不|向内|进入|往上|转向)[）)]/;

function ensureEvidenceWords(words: LWord[]): { added: number; touched: number } {
  let added = 0;
  let touched = 0;
  const byWord = new Map(words.map((word) => [word.w, word]));

  for (const template of EVIDENCE_WORDS) {
    const existing = byWord.get(template.w);
    if (!existing) {
      const record = { ...template };
      words.push(record);
      byWord.set(record.w, record);
      added += 1;
      continue;
    }
    let changed = false;
    for (const field of ['family', 'etymology', 'glossEn', 'domain'] as const) {
      if (!existing[field] && template[field]) {
        (existing as Record<string, unknown>)[field] = template[field];
        changed = true;
      }
    }
    if (changed) touched += 1;
  }

  for (const fix of ETYMOLOGY_FIXES) {
    const existing = byWord.get(fix.w);
    if (!existing) continue;
    const current = typeof existing.etymology === 'string' ? existing.etymology : '';
    if (current && SENSE_STATED.test(current)) continue;
    existing.etymology = fix.etymology;
    touched += 1;
  }

  if (added > 0) words.sort((a, b) => a.w.localeCompare(b.w));
  return { added, touched };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

/**
 * Sense key of a gloss: the alternatives, lowercased and sorted.
 *
 * `in, into` and `into, in` are the same sense written twice; without sorting
 * the natural key they would look like two entities and be split.
 */
function glossKey(gloss: string | undefined): string {
  return glossVariants(gloss).sort().join('|');
}

function tripleKey(m: LMorpheme): string {
  return `${normalizeForm(m.form)}|${m.origin}|${glossKey(m.glossEn)}`;
}

const PLACEHOLDER = /(\?|TODO|FIXME|待补|占位|xxx|^unknown$)/i;

function identityStatusOf(m: LMorpheme): 'verified' | 'provisional' {
  const clean = (value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return text.length > 0 && !PLACEHOLDER.test(text);
  };
  const hasEvidence = (m.examples?.length ?? 0) > 0 || Boolean(m.review?.by);
  const origin = m.origin && m.origin !== 'unknown';
  return origin && clean(m.glossEn) && clean(m.glossZh) && hasEvidence ? 'verified' : 'provisional';
}

const BACKED_UP = new Set<string>();

/** Snapshot the pre-migration inputs once; re-running must not overwrite them. */
function backupOnce(name: string, sourcePath: string) {
  if (DRY) return;
  const target = join(BACKUPS, name);
  if (existsSync(target)) return;
  mkdirSync(BACKUPS, { recursive: true });
  writeFileSync(target, readFileSync(sourcePath));
  BACKED_UP.add(name);
}

/* ------------------------------------------------------------------ */
/* 2. ID assignment                                                    */
/* ------------------------------------------------------------------ */

interface IdAssignment {
  renames: { from: string; to: string; form: string; origin: string }[];
  added: string[];
  groups: { form: string; base: string; ids: string[] }[];
}

/**
 * Assign one ID per `form + origin + glossEn` triple.
 *
 * Base = the shortest existing ID in the spelling group (i.e. the record that
 * already owns the bare `kind-form` spelling). Later senses get `-origin`; a
 * second sense from the *same* origin gets `-origin-N`, because `-lat` alone
 * would not distinguish two Latin roots. Numbering follows glosses sorted
 * alphabetically, so it is stable across runs and machines.
 */
export /**
 * Fold records that describe the same morpheme twice.
 *
 * The appendix lists a morpheme under each allomorph order (`ann~enn` and
 * `enn~ann`), which produced twin records. Same origin, same sense, and at
 * least one shared surface form means one entity: keep the larger record and
 * turn the other ID into a legacy alias. Records that merely share a gloss but
 * no form (`ante` / `pre`) are left alone — those are different etymons.
 */
function mergeOverlappingDuplicates(morphemes: LMorpheme[]): {
  kept: LMorpheme[];
  merges: { from: string; into: string }[];
} {
  const bags = (gloss: string | undefined) =>
    (gloss ?? '')
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter(Boolean)
      .sort()
      .join(' ');

  const kept: LMorpheme[] = [];
  const merges: { from: string; into: string }[] = [];
  for (const m of morphemes) {
    const forms = new Set([normalizeForm(m.form), ...(m.allomorphs ?? []).map(normalizeForm)]);
    // Overlap, not equality: `px-im` says "into" while its parent says "in,
    // into" — same sense, different wording. Disjoint glosses (in- "not" vs
    // in- "into") never merge.
    const twin = kept.find((k) => {
      if (k.origin !== m.origin) return false;
      const a = new Set(bags(k.glossEn).split(' ').filter(Boolean));
      const b = bags(m.glossEn).split(' ').filter(Boolean);
      if (!b.some((w) => a.has(w))) return false;
      const kForms = new Set([normalizeForm(k.form), ...(k.allomorphs ?? []).map(normalizeForm)]);
      return [...forms].some((f) => kForms.has(f));
    });
    if (!twin) {
      kept.push(m);
      continue;
    }
    twin.legacyIds = [...new Set([...(twin.legacyIds ?? []), m.id])];
    twin.allomorphs = [...new Set([...(twin.allomorphs ?? []), ...(m.allomorphs ?? [])])];
    twin.examples = [...new Set([...(twin.examples ?? []), ...(m.examples ?? [])])];
    if (!twin.note && m.note) twin.note = m.note;
    twin.sources = [...(twin.sources ?? [])];
    for (const source of m.sources ?? []) {
      if (!twin.sources.some((x) => x.id === source.id && x.title === source.title)) twin.sources.push(source);
    }
    merges.push({ from: m.id, into: twin.id });
  }
  return { kept, merges };
}

function assignIds(morphemes: LMorpheme[], taken: Set<string>): IdAssignment {
  const result: IdAssignment = { renames: [], added: [], groups: [] };
  const byForm = groupBy(morphemes, (m) => normalizeForm(m.form));

  // IDs are frozen once minted: a learner's review cards, notes and bookmarks
  // point at them, so a migration must never renumber an existing record just
  // because a new homograph arrived. Only a literal duplicate id is repaired.
  const seen = new Map<string, LMorpheme>();
  for (const [form, group] of [...byForm.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const ids: string[] = [];
    for (const m of group) {
      const clash = seen.get(m.id);
      if (clash) {
        const base = m.id;
        const origin = m.origin.toLowerCase();
        let candidate = `${base}-${origin}`;
        let bump = 2;
        while (taken.has(candidate)) candidate = `${base}-${origin}-${bump++}`;
        const previous = m.id;
        m.legacyIds = [...new Set([...(m.legacyIds ?? []), previous])];
        m.id = candidate;
        result.renames.push({ from: previous, to: candidate, form, origin: m.origin });
      }
      seen.set(m.id, m);
      ids.push(m.id);
    }
    if (group.length > 1) {
      result.groups.push({ form, base: ids[0], ids: [...ids].sort() });
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/* 3. Field completion                                                 */
/* ------------------------------------------------------------------ */

export function completeFields(morphemes: LMorpheme[]) {
  for (const m of morphemes) {
    m.formKey = normalizeForm(m.form);
    if (!m.identityStatus) m.identityStatus = identityStatusOf(m);
    if (!m.homographs) m.homographs = [];
  }

  const byForm = groupBy(morphemes, (m) => m.formKey ?? '');
  for (const group of byForm.values()) {
    const ids = group.map((m) => m.id);
    for (const m of group) {
      m.homographs = ids.filter((id) => id !== m.id).sort();
    }
    // senseKey must distinguish the homographs, so it is assigned per group.
    const used = new Map<string, number>();
    for (const m of [...group].sort((a, b) => a.id.localeCompare(b.id))) {
      const stem = m.senseKey ?? senseKeyOf(m);
      let key = stem;
      if (used.has(key)) key = `${stem} (${m.origin})`;
      let n = 2;
      while (used.has(key)) key = `${stem} (${m.origin} ${n++})`;
      used.set(key, 1);
      m.senseKey = key;
    }
  }
}

/* ------------------------------------------------------------------ */
/* 4. Word part resolution                                             */
/* ------------------------------------------------------------------ */

function evidenceText(word: LWord): string {
  return [
    // The spelling itself is evidence: a pattern that names a member word
    // (`verdict`, `inject`) is a curated word-family assignment, not a guess.
    word.w,
    word.etymology,
    // 0.8.0 splits etymology into layers; the historical layer is exactly the
    // evidence a homograph needs, so it must be part of the blob.
    word.ety?.historical,
    word.ety?.teaching,
    Array.isArray(word.derivation) ? word.derivation.join(' ') : '',
    word.semanticShift,
    word.glossEn,
    word.glossZh,
    word.example,
    word.family,
  ]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ');
}

function pickFromEvidence(ids: string[], text: string, byId: (id: string) => Morpheme | undefined): string | null {
  const scores = new Map<string, number>();
  for (const id of ids) {
    const morpheme = byId(id);
    let score = 0;
    for (const pattern of SENSE_PATTERNS[id] ?? []) if (pattern.test(text)) score += 1;
    if (morpheme) {
      for (const variant of [...glossVariants(morpheme.glossEn), ...glossVariants(morpheme.glossZh)]) {
        // Three Latin letters or two CJK characters: shorter strings ("in",
        // "不") appear inside unrelated words and would inflate every score.
        const minLength = /^[\x20-\x7e]+$/.test(variant) ? 3 : 2;
        if (variant.length >= minLength && glossContains(text, variant)) score += 1;
      }
    }
    if (process.env.IDENTITY_DEBUG) {
      const hits = (SENSE_PATTERNS[id] ?? []).filter((p) => p.test(text)).map((p) => String(p));
      if (hits.length) console.log(`    ${id} hit ${hits.join(' , ')}`);
    }
    scores.set(id, score);
  }
  if (process.env.IDENTITY_DEBUG) {
    console.log(`  evidence for ${ids.join(' / ')} → ${[...scores].map(([k, v]) => `${k}:${v}`).join(' ')}`);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [best, second] = ranked;
  if (!best || best[1] === 0) return null;
  if (second && second[1] === best[1]) return null; // a tie is still ambiguous
  return best[0];
}

function resolveParts(
  word: LWord,
  index: ReturnType<typeof loadIdentity>,
): { ids: (string | null)[]; resolution: NonNullable<WordEntry['partResolution']> } {
  const parts = (word.parts ?? []).map((p) => p.trim().toLowerCase());
  const text = evidenceText(word);
  const ids: (string | null)[] = [];
  let sawAmbiguous = false;
  let sawUnresolved = false;

  for (const [partIndex, part] of parts.entries()) {
    const form = normalizeForm(part);
    if (!form) {
      ids.push(null);
      sawUnresolved = true;
      continue;
    }
    if (ORTHOGRAPHIC.has(form)) {
      // Silent e: real orthography, no morpheme identity. Not a guess either way.
      ids.push(null);
      sawUnresolved = true;
      continue;
    }
    const direct = index.resolve(part);
    if (process.env.IDENTITY_DEBUG) {
      console.log(`[${word.w}] ${part} -> ${JSON.stringify(direct)} text=${text.slice(0, 60)}`);
    }
    // `resolve` already collapses same-family candidates, which is fine for the
    // UI but too eager here: capt- in *captain* is caput "head", not capere
    // "take", and both sit in fam-cap. So any multi-candidate spelling goes
    // through the evidence pipeline below first.
    if (direct.id && direct.candidates.length <= 1) {
      ids.push(direct.id);
      continue;
    }
    if (direct.ambiguous || direct.candidates.length > 1) {
      // Position is evidence the spelling itself carries: the first part of a
      // multi-part word is a prefix, the last is a suffix. `al` is -al (suffix),
      // ad- (prefix) and a root; where it stands decides which can be meant.
      const mayBePrefix = partIndex === 0 && parts.length > 1;
      const mayBeSuffix = partIndex === parts.length - 1 && parts.length > 1;
      const byType = direct.candidates.filter((id) => {
        const morpheme = index.byId(id);
        if (!morpheme) return false;
        if (mayBePrefix) return morpheme.type === 'prefix';
        if (mayBeSuffix) return morpheme.type === 'suffix';
        return morpheme.type === 'root' || morpheme.type === 'combining';
      });
      if (byType.length === 1) {
        ids.push(byType[0]);
        continue;
      }
      // The word's own etymology outranks spelling identity: capt- is "head" in
      // captain and "take" in capture, and only the evidence can tell them apart.
      const pool = byType.length > 1 ? byType : direct.candidates;
      const byEvidence = pickFromEvidence(pool, text, (id) => index.byId(id));
      if (byEvidence) {
        ids.push(byEvidence);
        continue;
      }
      // No evidence: fall back to the candidate written exactly like the part.
      const exactForm = pool.filter((id) => index.byId(id)?.form === form);
      if (exactForm.length === 1) {
        ids.push(exactForm[0]);
        continue;
      }
      const picked = byEvidence;
      if (picked) {
        ids.push(picked);
        continue;
      }
      ids.push(null);
      sawAmbiguous = true;
      continue;
    }
    ids.push(null);
    sawUnresolved = true;
  }

  const resolution = sawUnresolved ? 'unresolved' : sawAmbiguous ? 'ambiguous' : 'exact';
  return { ids, resolution };
}

/* ------------------------------------------------------------------ */
/* 5. Cards                                                            */
/* ------------------------------------------------------------------ */

interface CardStats {
  withMorphemes: number;
  filled: number;
  blanked: number;
}

function migrateCards(index: ReturnType<typeof loadIdentity>): CardStats {
  const stats: CardStats = { withMorphemes: 0, filled: 0, blanked: 0 };
  if (!existsSync(WEEKS)) return stats;

  for (const weekDir of readdirSync(WEEKS).sort()) {
    const dir = join(WEEKS, weekDir);
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => /^day\d+\.json$/.test(f)).sort()) {
      const path = join(dir, file);
      const raw = readFileSync(path, 'utf-8');
      let lesson: Lesson;
      try {
        lesson = JSON.parse(raw) as Lesson;
      } catch (err) {
        // Another author may be mid-write; never abort the whole migration for
        // one unreadable lesson — report it and leave the file alone.
        console.warn(`skipped ${weekDir}/${file}: ${(err as Error).message}`);
        continue;
      }
      let touched = false;

      for (const card of lesson.cards ?? []) {
        if (!('morphemes' in card) || !Array.isArray(card.morphemes) || card.morphemes.length === 0) continue;
        stats.withMorphemes += 1;
        const ids = card.morphemes.map((form) => {
          const f = normalizeForm(form);
          if (!f || ORTHOGRAPHIC.has(f)) return undefined;
          return index.resolve(form, { lessonConcepts: lesson.concepts }).id;
        });
        const complete = ids.every((id): id is string => Boolean(id));
        const next = complete ? ids : [];
        if (complete) stats.filled += 1;
        else stats.blanked += 1;
        const current = 'morphemeIds' in card ? card.morphemeIds : undefined;
        if (JSON.stringify(current) !== JSON.stringify(next)) {
          (card as { morphemeIds?: string[] }).morphemeIds = next;
          touched = true;
        }
      }

      if (touched) writeJson(path, lesson);
    }
  }
  return stats;
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

function main() {
  const morphPath = join(LEX, 'morphemes.json');
  const wordPath = join(LEX, 'words.json');

  const morphemes = readJson<LMorpheme[]>(morphPath);
  const words = readJson<LWord[]>(wordPath);

  backupOnce('morphemes.pre-identity.json', morphPath);
  backupOnce('words.pre-identity.json', wordPath);
  if (!DRY && !existsSync(join(BACKUPS, 'schema.json'))) {
    writeJson(join(BACKUPS, 'schema.json'), {
      identitySchemaVersion: 2,
      contentSchemaVersion: 1,
      dbSchemaVersion: 2,
      createdAt: new Date().toISOString(),
      note: 'Pre-identity-migration snapshot. dbSchemaVersion mirrors SCHEMA_VERSION in src-tauri/src/db.rs.',
    });
  }

  // -- 1. restore lost homograph senses -------------------------------
  const byForm = groupBy(morphemes, (m) => `${normalizeForm(m.form)}|${m.origin}`);
  const added: string[] = [];
  for (const sense of KNOWN_SENSES) {
    const key = `${normalizeForm(sense.form)}|${sense.origin}`;
    const siblings = byForm.get(key) ?? [];
    const exists = siblings.some((m) => glossKey(m.glossEn) === glossKey(sense.glossEn));
    if (exists) continue;
    const formKey = normalizeForm(sense.form);
    const kind = KIND_OF[sense.type];
    let id = `${kind}-${formKey}-${sense.origin.toLowerCase()}`;
    const takenIds = new Set(morphemes.map((m) => m.id));
    let n = 2;
    while (takenIds.has(id)) id = `${kind}-${formKey}-${sense.origin.toLowerCase()}-${n++}`;
    const record: LMorpheme = {
      id,
      form: sense.form,
      type: sense.type,
      origin: sense.origin,
      glossZh: sense.glossZh,
      glossEn: sense.glossEn,
      allomorphs: sense.allomorphs ?? [],
      examples: sense.examples,
      note: sense.note,
      sources: sense.sources,
      familyId: sense.familyId,
      textbookRefs: sense.textbookRefs,
      formKey,
      senseKey: sense.senseKey,
      homographs: [],
      identityStatus: 'verified',
    };
    morphemes.push(record);
    added.push(id);
  }

  // -- 2. exact duplicates (same form+origin+gloss) --------------------
  const seenTriples = new Map<string, LMorpheme>();
  const keep: LMorpheme[] = [];
  for (const m of morphemes) {
    const key = tripleKey(m);
    const first = seenTriples.get(key);
    if (!first) {
      seenTriples.set(key, m);
      keep.push(m);
      continue;
    }
    // Same entity described twice: fold the later record into the first.
    first.legacyIds = [...new Set([...(first.legacyIds ?? []), m.id, ...(m.legacyIds ?? [])])];
    first.allomorphs = [...new Set([...(first.allomorphs ?? []), ...(m.allomorphs ?? [])])];
    first.examples = [...new Set([...(first.examples ?? []), ...(m.examples ?? [])])];
    if (!first.note && m.note) first.note = m.note;
    first.sources = [...(first.sources ?? [])];
    for (const source of m.sources ?? []) {
      if (!first.sources.some((s) => s.id === source.id && s.title === source.title)) first.sources.push(source);
    }
  }
  const mergedCount = morphemes.length - keep.length;

  // -- 2b. records that are the same entity written twice --------------
  // The appendix transcription produced one record per allomorph order
  // (`cx-ann-enn` and `cx-enn-ann`). Same origin + same sense + overlapping
  // surface forms is the same morpheme, so the smaller record folds into the
  // larger one and its ID becomes a legacy ID. Records with the same gloss but
  // no shared form (ante / pre) are *not* touched: those are different etymons.
  const overlap = mergeOverlappingDuplicates(keep);

  // -- 3. IDs ----------------------------------------------------------
  const taken = new Set(overlap.kept.map((m) => m.id));
  const assignment = assignIds(overlap.kept, taken);

  // -- 4. fields -------------------------------------------------------
  completeFields(overlap.kept);

  // -- 5. persist lexicon ---------------------------------------------
  const final = overlap.kept;
  final.sort((a, b) => (a.formKey ?? '').localeCompare(b.formKey ?? '') || a.id.localeCompare(b.id));
  writeJson(morphPath, final);

  // -- 6. forms.json ---------------------------------------------------
  // Canonical spellings only: allomorphs are positional variants listed on the
  // record, and publishing them here would turn every shared variant (`im-`,
  // `struct`) into a false identity conflict.
  const forms: FormIndex = {};
  for (const m of final) {
    // Index the canonical form **and every allomorph**. Without the allomorphs
    // `spect`, `spic` and `miss` were unresolvable: 164 words were marked
    // "partial" only because the index could not see the spelling the word uses.
    for (const spelling of [m.form, ...((m.allomorphs ?? []) as string[])]) {
      const key = normalizeForm(spelling);
      if (!key) continue;
      const list = forms[key] ?? (forms[key] = []);
      if (!list.includes(m.id)) list.push(m.id);
    }
  }
  const formsOrdered: FormIndex = {};
  for (const key of Object.keys(forms).sort()) formsOrdered[key] = forms[key].sort();
  writeJson(join(LEX, 'forms.json'), formsOrdered);
  const index = loadIdentity(final as Morpheme[], formsOrdered);

  // -- 7. words --------------------------------------------------------
  const evidence = ensureEvidenceWords(words);
  const resolutionCounts = { exact: 0, ambiguous: 0, unresolved: 0 };
  for (const word of words) {
    const { ids, resolution } = resolveParts(word, index);
    word.partIds = ids;
    word.partResolution = resolution;
    resolutionCounts[resolution] += 1;
  }
  writeJson(wordPath, words);

  // -- 8. cards --------------------------------------------------------
  const cardStats = migrateCards(index);

  // -- 9. migration table ---------------------------------------------
  const ambiguousForms = Object.keys(formsOrdered)
    .filter((form) => formsOrdered[form].length > 1)
    .map((form) => ({
      form,
      ids: formsOrdered[form],
      senses: formsOrdered[form].map((id) => {
        const m = index.byId(id);
        return { id, origin: m?.origin, glossEn: m?.glossEn, senseKey: m?.senseKey };
      }),
    }));

  const legacyIds: Record<string, string> = {};
  for (const m of final) for (const old of m.legacyIds ?? []) legacyIds[old] = m.id;

  const migration = {
    generatedAt: new Date().toISOString(),
    identitySchemaVersion: 2,
    formToIds: formsOrdered,
    ambiguousForms,
    idRenames: assignment.renames,
    /** Old ID → the ID that now owns the sense (merged duplicates only). */
    legacyIds,
    restoredSenses: KNOWN_SENSES.map((s) => ({
      form: s.form,
      glossEn: s.glossEn,
      origin: s.origin,
      id:
        byForm
          .get(`${normalizeForm(s.form)}|${s.origin}`)
          ?.find((m) => glossKey(m.glossEn) === glossKey(s.glossEn))?.id ?? null,
    })),
    counts: {
      morphemes: final.length,
      addedMorphemes: added.length,
      mergedDuplicates: mergedCount,
      mergedAllomorphRecords: overlap.merges,
      idRenames: assignment.renames.length,
      forms: Object.keys(formsOrdered).length,
      ambiguousForms: ambiguousForms.length,
      words: words.length,
      wordEvidence: evidence,
      wordPartResolution: resolutionCounts,
      cards: cardStats,
    },
  };
  writeJson(join(ANALYSIS, 'identity-migration.json'), migration);

  // -- report ----------------------------------------------------------
  console.log(`morphemes: ${final.length} (+${added.length} restored, ${mergedCount} duplicates merged, ${overlap.merges.length} allomorph-record merges)`);
  console.log(`forms: ${Object.keys(formsOrdered).length}, ambiguous spellings: ${ambiguousForms.length}`);
  for (const group of ambiguousForms) {
    const labels = group.senses.map((s) => `${s.id}=${s.glossEn ?? '?'}`).join(' / ');
    console.log(`  ${group.form}: ${labels}`);
  }
  console.log(
    `words: ${words.length} — exact ${resolutionCounts.exact}, ambiguous ${resolutionCounts.ambiguous}, unresolved ${resolutionCounts.unresolved}` +
      (evidence.added || evidence.touched ? ` (evidence words +${evidence.added}, ~${evidence.touched} etymology)` : ''),
  );
  console.log(
    `cards: ${cardStats.withMorphemes} with morphemes — filled ${cardStats.filled}, left empty ${cardStats.blanked}`,
  );
  if (BACKED_UP.size > 0) console.log(`backups written: ${[...BACKED_UP].join(', ')}`);
  if (DRY) console.log('(dry run — nothing written)');
}

// Only run when invoked as a script: the tests import assignIds/completeFields
// to check the ID rules without touching the repository.
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
