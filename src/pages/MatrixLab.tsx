import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, Button, EmptyState, Panel } from '../components/ui';
import { BasePicker } from '../components/matrix/BasePicker';
import { PRACTICE_QUEUE_KEY } from '../components/matrix/WordDetail';
import { PracticeQueue } from '../components/matrix/PracticeQueue';
import { buildBaseCandidates, uniqueWords } from '../components/matrix/model';
import {
  affixColumns,
  buildLadder,
  buildRows,
  filterRows,
  groupResults,
  type Cell,
  type FilterState,
  type LadderRow,
} from '../components/lab/model';
import { LabGrid, CellSummary } from '../components/lab/LabGrid';
import { LabDetail, type LabSelection } from '../components/lab/LabDetail';
import { allWords, getWord } from '../lib/content';
import { familyBaseForm, familyIdOf, rootIndexOf, type Pos } from '../lib/derive';
import type { WordEntry } from '../lib/types';

const POS_FILTERS: { key: Pos | 'all'; label: string }[] = [
  { key: 'all', label: '全部词性' },
  { key: 'n', label: '名词' },
  { key: 'v', label: '动词' },
  { key: 'adj', label: '形容词' },
  { key: 'adv', label: '副词' },
];

const EMPTY_FILTERS: FilterState = { query: '', pos: 'all', suffix: '', family: '' };

function useNarrow(query = '(max-width: 1180px)'): boolean {
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

function selectionOf(row: LadderRow, cell: Cell): LabSelection {
  return {
    word: row.node.word,
    affix: cell.affix.form,
    kind: cell.affix.kind,
    verdict: cell.verdict,
    chain: [...row.node.steps, ...cell.verdict.steps],
  };
}

export default function MatrixLab() {
  const words = useMemo(() => uniqueWords(allWords()), []);
  const dictionary = useMemo(() => new Set(words.map((w) => w.w)), [words]);
  const candidates = useMemo(() => buildBaseCandidates(words), [words]);
  const narrow = useNarrow();
  const [params, setParams] = useSearchParams();

  const paramBase = params.get('base') ?? '';
  const [baseChoice, setBaseChoice] = useState(paramBase);
  const base = (baseChoice || paramBase || candidates[0]?.form || '').trim().toLowerCase();

  useEffect(() => {
    setBaseChoice(paramBase);
  }, [paramBase]);

  const [filter, setFilter] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedKey, setSelectedKey] = useState<{ word: string; affix: string } | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(PRACTICE_QUEUE_KEY);
        const list: unknown = raw ? JSON.parse(raw) : [];
        setQueueCount(Array.isArray(list) ? list.length : 0);
      } catch {
        setQueueCount(0);
      }
    };
    read();
    window.addEventListener('focus', read);
    return () => window.removeEventListener('focus', read);
  }, [queueOpen]);

  const nodes = useMemo(() => buildLadder(base, dictionary), [base, dictionary]);
  const columns = useMemo(() => affixColumns(nodes, words), [nodes, words]);
  const baseRows = useMemo(() => buildRows(nodes, columns, dictionary), [nodes, columns, dictionary]);
  const rows = useMemo(() => filterRows(baseRows, filter), [baseRows, filter]);

  const verifiedTotal = useMemo(
    () => baseRows.reduce((n, row) => n + row.cells.filter((c) => c.verdict.state === 'verified').length, 0),
    [baseRows],
  );

  const familyOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of baseRows) {
      for (const cell of row.cells) {
        if (cell.verdict.state !== 'verified') continue;
        const entry: WordEntry | undefined = getWord(cell.verdict.word);
        if (!entry) continue;
        const id = familyIdOf(entry.parts[rootIndexOf(entry.parts)]);
        if (id && !map.has(id)) map.set(id, familyBaseForm(id) ?? id);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [baseRows]);

  const suffixOptions = useMemo(
    () => columns.filter((c) => c.kind === 'suffix').map((c) => c.form),
    [columns],
  );

  const selection = useMemo<LabSelection | null>(() => {
    if (selectedKey) {
      const row = baseRows.find((r) => r.node.word === selectedKey.word);
      const cell = row?.cells.find((c) => c.affix.form === selectedKey.affix);
      if (row && cell) return selectionOf(row, cell);
    }
    for (const row of baseRows) {
      const cell = row.cells.find((c) => c.verdict.state === 'verified');
      if (cell) return selectionOf(row, cell);
    }
    return null;
  }, [selectedKey, baseRows]);

  const results = useMemo(() => groupResults(rows), [rows]);
  const knownBase = nodes[0]?.known ?? false;
  const filtersActive =
    Boolean(filter.query.trim()) || filter.pos !== 'all' || Boolean(filter.suffix) || Boolean(filter.family);

  function chooseBase(form: string) {
    setBaseChoice(form);
    setSelectedKey(null);
    setParams({ base: form }, { replace: true });
  }

  function pickCell(row: LadderRow, cell: Cell) {
    setSelectedKey({ word: row.node.word, affix: cell.affix.form });
  }

  if (words.length === 0 || candidates.length === 0) {
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
            title={words.length === 0 ? '词库尚未导入' : '词库中没有可用作词基的词条'}
            body={
              words.length === 0
                ? '构词实验室需要 lexicon/words.json 中的已验证词条才能生成矩阵。词库为空时不生成任何组合，也不会用拼写猜词。'
                : '现有词条无法拆出可独立组合的词基。请检查词库中的 parts 是否按词素拆分。'
            }
          />
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
            行是词基和它已验证的派生词，列是可以加的成分。每一格都是三选一：词库已收录、构词规则不允许、或词库未收录。
          </p>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Badge tone="accent">{nodes.length} 级词基</Badge>
          <Badge>{verifiedTotal} 格已收录</Badge>
          <Button size="sm" onClick={() => setQueueOpen(true)}>
            练习队列{queueCount > 0 ? ` (${queueCount})` : ''}
          </Button>
        </div>
      </header>

      <div className="panel-flat" style={{ borderLeft: '3px solid var(--accent)', marginBottom: 16 }}>
        <p className="small" style={{ margin: 0, lineHeight: 1.7 }}>
          <strong>三种状态都是结论。</strong>
          已收录 = 词库里有这个词；规则不允许 = 违反构词顺序或搭配（会给出原因）；
          未收录 = 拼写能成立但词库没有这个词——<strong>未收录不等于不存在</strong>。
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : '248px minmax(0, 1fr)',
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
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="word" style={{ fontSize: 18 }}>
                  {base}
                </span>
                {knownBase ? <Badge tone="green">词库已收录</Badge> : <Badge tone="amber">词库未收录该词基</Badge>}
              </div>
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {POS_FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="chip"
                  style={activeChipStyle(filter.pos === f.key)}
                  aria-pressed={filter.pos === f.key}
                  onClick={() => setFilter((prev) => ({ ...prev, pos: f.key }))}
                >
                  {f.label}
                </button>
              ))}
              <select
                className="select"
                aria-label="按后缀过滤"
                value={filter.suffix}
                onChange={(e) => setFilter((prev) => ({ ...prev, suffix: e.target.value }))}
                style={{ width: 'auto', minWidth: 104 }}
              >
                <option value="">全部后缀</option>
                {suffixOptions.map((s) => (
                  <option key={s} value={s}>
                    -{s}
                  </option>
                ))}
              </select>
              <select
                className="select"
                aria-label="按词族过滤"
                value={filter.family}
                onChange={(e) => setFilter((prev) => ({ ...prev, family: e.target.value }))}
                style={{ width: 'auto', minWidth: 116 }}
              >
                <option value="">全部词族</option>
                {familyOptions.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              {filtersActive ? (
                <Button size="sm" variant="ghost" onClick={() => setFilter(EMPTY_FILTERS)}>
                  清除筛选
                </Button>
              ) : null}
            </div>
          </div>

          <div className="row" style={{ marginBottom: 12, gap: 8 }}>
            <input
              className="input"
              type="search"
              value={filter.query}
              placeholder="搜索这一族的词 / 中文释义"
              aria-label="搜索词或释义"
              onChange={(e) => setFilter((prev) => ({ ...prev, query: e.target.value }))}
            />
            <span className="tiny faint" style={{ flex: 'none' }}>
              {rows.length} / {baseRows.length} 行
            </span>
          </div>

          {!knownBase ? (
            <p className="tiny" style={{ margin: '0 0 12px', color: 'var(--amber)', lineHeight: 1.6 }}>
              「{base}」不在词库中，无法验证派生，词基层只有它自己；行列沿用词库中最常见的成分。
            </p>
          ) : null}

          {selection ? (
            <CellSummary
              word={selection.word}
              affix={selection.affix}
              kind={selection.kind}
              verdict={selection.verdict}
              glossZh={getWord(selection.verdict.word)?.glossZh}
            />
          ) : null}

          {rows.length === 0 ? (
            <EmptyState
              title="当前筛选下没有组合"
              body="换一种词性、清空后缀或词族筛选，或减少搜索关键词再试。"
            />
          ) : (
            <LabGrid
              rows={rows}
              columns={columns}
              selected={selectedKey}
              onSelect={pickCell}
            />
          )}
        </Panel>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrow ? '1fr' : 'minmax(0, 1fr) 340px',
          gap: 16,
          marginTop: 16,
          alignItems: 'start',
        }}
      >
        <Panel style={{ marginTop: 0 }}>
        <div className="row-between" style={{ marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 style={{ marginBottom: 2 }}>结果</h3>
            <div className="tiny faint">按词族分组；只列出词库已确认的词。点词跳到对应格子。</div>
          </div>
          <span className="tiny faint">
            {results.reduce((n, g) => n + g.words.length, 0)} 个词 · {results.length} 个词族
          </span>
        </div>
        {results.length === 0 ? (
          <p className="small faint" style={{ margin: 0 }}>
            当前筛选下没有已收录的词。清空筛选可以看到这一族的全部结果。
          </p>
        ) : (
          results.map((group) => (
            <div key={group.family} style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                <span className="serif" style={{ fontSize: 15, fontWeight: 640 }}>
                  {group.label}
                </span>
                <span className="tiny faint">{group.words.length}</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {group.words.map((w) => (
                  <button
                    key={w.word}
                    type="button"
                    className="chip"
                    title={w.glossZh}
                    onClick={() => {
                      const row = baseRows.find((r) => r.cells.some((c) => c.verdict.word === w.word));
                      const cell = row?.cells.find((c) => c.verdict.word === w.word);
                      if (row && cell) pickCell(row, cell);
                    }}
                  >
                    <span className="word" style={{ fontSize: 13.5 }}>
                      {w.word}
                    </span>
                    <span className="tiny faint">{w.glossZh}</span>
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
        </Panel>

        <LabDetail selection={selection} />
      </div>

      <PracticeQueue open={queueOpen} onClose={() => setQueueOpen(false)} />
    </div>
  );
}
