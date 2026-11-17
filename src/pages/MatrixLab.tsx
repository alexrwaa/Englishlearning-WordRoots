import { useEffect, useMemo, useState } from 'react';
import { Badge, EmptyState, Panel } from '../components/ui';
import { BasePicker } from '../components/matrix/BasePicker';
import { MatrixGrid, type GridRow } from '../components/matrix/MatrixGrid';
import { WordDetail, type MatrixSelection } from '../components/matrix/WordDetail';
import {
  affixInventory,
  buildBaseCandidates,
  coreIndexOf,
  familyOf,
  globalAffixes,
  locateInMatrix,
  uniqueWords,
  type PosFilter,
} from '../components/matrix/model';
import { allWords } from '../lib/content';
import { buildWord, type BuildResult } from '../lib/morph';
import type { WordEntry } from '../lib/types';

const POS_FILTERS: { key: PosFilter; label: string }[] = [
  { key: 'all', label: '全部词性' },
  { key: 'n', label: '名词' },
  { key: 'v', label: '动词' },
  { key: 'adj', label: '形容词' },
];

function useNarrow(query = '(max-width: 1080px)'): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return narrow;
}

function activeChipStyle(active: boolean): React.CSSProperties {
  return active
    ? { background: 'var(--accent-soft)', border: '1px solid var(--accent)', color: 'var(--accent-ink)' }
    : { border: '1px solid var(--line-strong)' };
}

function dedupe(list: string[]): string[] {
  return [...new Set(list.filter(Boolean))];
}

export default function MatrixLab() {
  const words = useMemo(() => uniqueWords(allWords()), []);
  const candidates = useMemo(() => buildBaseCandidates(words), [words]);
  const narrow = useNarrow();

  const [baseChoice, setBaseChoice] = useState('');
  const base = baseChoice || candidates[0]?.form || '';

  const [selection, setSelection] = useState<MatrixSelection | null>(null);
  const [pos, setPos] = useState<PosFilter>('all');
  const [onlyAttested, setOnlyAttested] = useState(false);
  const [suffixFilter, setSuffixFilter] = useState('');

  const familyWords = useMemo(() => words.filter((w) => w.parts.includes(base)), [words, base]);
  const inventory = useMemo(() => affixInventory(base, words), [base, words]);
  const fallback = useMemo(() => globalAffixes(words, 5), [words]);

  const rowForms = useMemo(() => {
    const source =
      inventory.prefixes.length > 0
        ? inventory.prefixes.map((p) => p.form)
        : fallback.prefixes.map((p) => p.form);
    return ['', ...dedupe(source)];
  }, [inventory, fallback]);
  const colForms = useMemo(() => {
    const source =
      inventory.suffixes.length > 0
        ? inventory.suffixes.map((s) => s.form)
        : fallback.suffixes.map((s) => s.form);
    return ['', ...dedupe(source)];
  }, [inventory, fallback]);

  // Every cell is produced by the engine; nothing is concatenated by hand.
  const cells = useMemo(() => {
    const map = new Map<string, BuildResult>();
    for (const prefix of rowForms) {
      for (const suffix of colForms) {
        map.set(`${prefix}|${suffix}`, buildWord(prefix, base, suffix));
      }
    }
    return map;
  }, [rowForms, colForms, base]);

  const getCell = (prefix: string, suffix: string): BuildResult =>
    cells.get(`${prefix}|${suffix}`) ?? buildWord(prefix, base, suffix);

  function cellMatches(result: BuildResult): boolean {
    if (!result.attested) return !onlyAttested && pos === 'all';
    return pos === 'all' || result.entry?.pos === pos;
  }

  const visibleCols = useMemo(
    () => colForms.filter((s) => !suffixFilter || s === suffixFilter),
    [colForms, suffixFilter],
  );

  const gridRows = useMemo<GridRow[]>(
    () =>
      rowForms
        .filter((prefix) => visibleCols.some((suffix) => cellMatches(getCell(prefix, suffix))))
        .map((prefix) => ({
          prefix,
          cells: visibleCols.map((suffix) => {
            const result = getCell(prefix, suffix);
            return { suffix, result, matches: cellMatches(result) };
          }),
        })),
    // getCell/cellMatches are pure lookups over `cells`; listing them adds noise.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rowForms, visibleCols, cells, pos, onlyAttested],
  );

  const attestedTotal = useMemo(() => [...cells.values()].filter((c) => c.attested).length, [cells]);

  const defaultSelection = useMemo<MatrixSelection | null>(() => {
    if (!base) return null;
    const standalone = words.find((w) => w.w === base);
    const target = standalone ?? familyWords[0];
    if (!target) return null;
    return { ...locateInMatrix(target, base), entry: target };
  }, [base, words, familyWords]);

  const current = selection ?? defaultSelection;
  const family = useMemo(() => (current ? familyOf(current.entry, words, 12) : []), [current, words]);

  // Highlight only when the cell reproduces the selected spelling exactly.
  const highlight = useMemo(() => {
    if (!current) return null;
    const built = buildWord(current.prefix, base, current.suffix);
    return built.entry?.w === current.entry.w ? { prefix: current.prefix, suffix: current.suffix } : null;
  }, [current, base]);

  const knownBase = candidates.some((c) => c.form === base);

  function chooseBase(form: string) {
    setBaseChoice(form);
    setSelection(null);
    setSuffixFilter('');
  }

  function pickFamilyWord(entry: WordEntry) {
    const core = entry.parts.includes(base) ? base : entry.parts[coreIndexOf(entry.parts)];
    if (core !== base) {
      setBaseChoice(core);
      setSuffixFilter('');
    }
    setSelection({ ...locateInMatrix(entry, core), entry });
  }

  function selectCell(prefix: string, suffix: string) {
    const built = buildWord(prefix, base, suffix);
    if (built.entry) setSelection({ prefix, suffix, entry: built.entry });
  }

  if (words.length === 0 || candidates.length === 0) {
    const noWords = words.length === 0;
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow">构词实验室</div>
            <h1>词矩阵</h1>
            <p className="lede">用一个词基验证前缀与后缀的组合，哪些组合真的存在。</p>
          </div>
        </header>
        <Panel>
          <EmptyState
            title={noWords ? '词库尚未导入' : '词库中没有可用作词基的词条'}
            body={
              noWords
                ? '构词实验室需要 lexicon/words.json 中的已验证词条才能生成矩阵。词库为空时不生成任何组合，也不会用拼写猜词。'
                : '现有词条无法拆出可独立组合的词基。请检查词库中的 parts 是否按词素拆分。'
            }
          />
        </Panel>
        <Panel flat style={{ marginTop: 16 }}>
          <p className="small muted" style={{ margin: 0 }}>
            词库导入后，这里会自动列出可作词基的词根与单词，并按词族推导前缀行与后缀列。
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">构词实验室</div>
          <h1>词矩阵</h1>
          <p className="lede">
            把一个词基放进「前缀 × 后缀」的网格里。每个格子都经过词库验证：命中就给出真实单词与释义，没命中就是一个结论。
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Badge tone="accent">{familyWords.length} 个词族词条</Badge>
          <Badge>{attestedTotal} 格已收录</Badge>
        </div>
      </header>

      <div className="panel-flat" style={{ borderLeft: '3px solid var(--accent)', marginBottom: 16 }}>
        <p className="small" style={{ margin: 0, lineHeight: 1.7 }}>
          <strong>矩阵的空格是结论，不是缺陷。</strong>
          形态合法（前缀 + 词基 + 后缀能拼出来）不等于英语里真的存在这个词；
          只有词库验证通过的组合才显示为单词，其余用虚线格表示「未收录」。
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : '252px minmax(0, 1fr) 336px',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <Panel>
          <BasePicker candidates={candidates} active={base} totalWords={words.length} onPick={chooseBase} />
        </Panel>

        <Panel>
          <div className="row-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ marginBottom: 2 }}>词基</h3>
              <div className="row" style={{ gap: 8 }}>
                <span className="word" style={{ fontSize: 18 }}>
                  {base}
                </span>
                {knownBase ? (
                  <Badge tone="green">词库已收录</Badge>
                ) : (
                  <Badge tone="amber">词库未收录该词基</Badge>
                )}
              </div>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {POS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="chip"
                  style={activeChipStyle(pos === f.key)}
                  aria-pressed={pos === f.key}
                  onClick={() => setPos(f.key)}
                >
                  {f.label}
                </button>
              ))}
              <button
                type="button"
                className="chip"
                style={activeChipStyle(onlyAttested)}
                aria-pressed={onlyAttested}
                onClick={() => setOnlyAttested((v) => !v)}
              >
                只看已收录
              </button>
              <select
                className="select"
                aria-label="按后缀过滤"
                value={suffixFilter}
                onChange={(e) => setSuffixFilter(e.target.value)}
                style={{ width: 'auto', minWidth: 104 }}
              >
                <option value="">全部后缀</option>
                {colForms.filter(Boolean).map((s) => (
                  <option key={s} value={s}>
                    -{s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!knownBase ? (
            <p className="tiny" style={{ margin: '0 0 12px', color: 'var(--amber)' }}>
              「{base}」不在词库中，行列只能沿用词库中最常见的前缀与后缀；这些格子会全部显示为未收录。
              形态上它们可能成立，但英语里没有对应的词。
            </p>
          ) : null}

          {gridRows.length === 0 ? (
            <EmptyState
              title="当前筛选下没有组合"
              body="换一种词性、清空后缀筛选，或关闭「只看已收录」再试。"
            />
          ) : (
            <MatrixGrid
              base={base}
              rows={gridRows}
              suffixes={visibleCols}
              selected={highlight}
              onSelect={selectCell}
            />
          )}
        </Panel>

        <WordDetail selection={current} base={base} family={family} onPick={pickFamilyWord} />
      </div>
    </div>
  );
}
