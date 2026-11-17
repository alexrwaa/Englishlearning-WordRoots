import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { allWords, getMorpheme, getWord, stripDashes } from '../lib/content';
import { editDistance } from '../lib/morph';
import { useApp } from '../lib/store';
import type { WordEntry } from '../lib/types';
import { Badge, Button, EmptyState, Panel } from '../components/ui';
import { ConceptModal } from '../components/word/ConceptModal';
import { EntryDetail } from '../components/word/EntryDetail';
import { EntryRow } from '../components/word/EntryRow';
import { MorphemeModal } from '../components/word/MorphemeModal';
import { DOMAIN_LABELS, POS_LABELS } from '../components/word/tokens';

type Domain = NonNullable<WordEntry['domain']>;
type Pos = NonNullable<WordEntry['pos']>;

const DOMAIN_KEYS = Object.keys(DOMAIN_LABELS) as Domain[];
const POS_KEYS = Object.keys(POS_LABELS) as Pos[];

function ListView() {
  const words = allWords();
  const { bookmarks, toggleBookmark, toast } = useApp();

  const [query, setQuery] = useState('');
  const [domain, setDomain] = useState<Domain | 'all'>('all');
  const [pos, setPos] = useState<Pos | 'all'>('all');
  const [part, setPart] = useState('all');

  const domains = useMemo(
    () => DOMAIN_KEYS.filter((d) => words.some((w) => w.domain === d)),
    [words],
  );
  const poses = useMemo(() => POS_KEYS.filter((p) => words.some((w) => w.pos === p)), [words]);
  const parts = useMemo(() => {
    const seen = new Map<string, string>();
    for (const w of words) {
      for (const p of w.parts) {
        const key = stripDashes(p);
        if (!seen.has(key)) seen.set(key, p);
      }
    }
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [words]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words
      .filter((w) => {
        if (q) {
          const haystack = [w.w, w.glossZh, w.glossEn ?? ''].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        if (domain !== 'all' && w.domain !== domain) return false;
        if (pos !== 'all' && w.pos !== pos) return false;
        if (part !== 'all' && !w.parts.some((p) => stripDashes(p) === part)) return false;
        return true;
      })
      .sort((a, b) => a.w.localeCompare(b.w));
  }, [words, query, domain, pos, part]);

  const groups = useMemo(() => {
    const map = new Map<string, WordEntry[]>();
    for (const w of filtered) {
      const first = w.w.charAt(0).toUpperCase();
      const key = /[A-Z]/.test(first) ? first : '#';
      const bucket = map.get(key);
      if (bucket) bucket.push(w);
      else map.set(key, [w]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const filtersActive = Boolean(query.trim()) || domain !== 'all' || pos !== 'all' || part !== 'all';

  const reset = () => {
    setQuery('');
    setDomain('all');
    setPos('all');
    setPart('all');
  };

  const handleToggleBookmark = async (w: string) => {
    try {
      const added = await toggleBookmark('word', w);
      toast(added ? `已收藏 ${w}` : `已取消收藏 ${w}`, added ? 'success' : 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : '收藏操作失败', 'warn');
    }
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">词源词典</div>
          <h1>词源词典</h1>
          <p className="lede">
            按字母浏览已验证的词条：词素拆解、词源记载与同族词。词源只收录有来源支持的说明，没有可靠来源时宁可留空。
          </p>
        </div>
        <Badge tone="accent">{words.length} 个词条</Badge>
      </div>

      {words.length > 0 ? (
      <Panel flat>
        <div className="row wrap" style={{ gap: 10 }}>
          <input
            className="input"
            style={{ flex: '1 1 260px' }}
            type="search"
            value={query}
            placeholder="搜索拼写 / 中文释义 / 英文释义"
            aria-label="搜索词条"
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="select"
            style={{ width: 140 }}
            value={domain}
            aria-label="按领域筛选"
            onChange={(e) => setDomain(e.target.value as Domain | 'all')}
          >
            <option value="all">全部领域</option>
            {domains.map((d) => (
              <option key={d} value={d}>
                {DOMAIN_LABELS[d]}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: 120 }}
            value={pos}
            aria-label="按词性筛选"
            onChange={(e) => setPos(e.target.value as Pos | 'all')}
          >
            <option value="all">全部词性</option>
            {poses.map((p) => (
              <option key={p} value={p}>
                {POS_LABELS[p]}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: 170 }}
            value={part}
            aria-label="按词素筛选"
            onChange={(e) => setPart(e.target.value)}
          >
            <option value="all">全部词素</option>
            {parts.map(([key, raw]) => {
              const m = getMorpheme(key);
              return (
                <option key={key} value={key}>
                  {m ? `${m.form}（${m.glossZh}）` : raw}
                </option>
              );
            })}
          </select>
          {filtersActive ? (
            <Button size="sm" variant="ghost" onClick={reset}>
              清除筛选
            </Button>
          ) : null}
        </div>
        {filtersActive ? (
          <div className="tiny faint" style={{ marginTop: 10 }}>
            匹配 {filtered.length} / {words.length} 个词条
          </div>
        ) : null}
      </Panel>
      ) : null}

      {words.length === 0 ? (
        <EmptyState
          title="词库还是空的"
          body="词条由内容包提供，目前还没有载入任何词条。课程中出现过的词会在内容补齐后汇总到这里。"
          action={
            <Link to="/course">
              <Button variant="primary">去看课程</Button>
            </Link>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="没有匹配的词条"
          body="换个拼写或释义关键词试试，也可以放宽领域、词性与词素筛选。"
          action={
            <Button onClick={reset}>清除筛选</Button>
          }
        />
      ) : (
        <Panel style={{ padding: '6px 18px 18px', marginTop: 16 }}>
          {groups.map(([letter, items], gi) => (
            <div key={letter}>
              <div className="row" style={{ gap: 10, margin: gi === 0 ? '8px 0 4px' : '18px 0 4px' }}>
                <span className="serif" style={{ fontSize: 20, fontWeight: 650, color: 'var(--accent-ink)' }}>
                  {letter}
                </span>
                <span className="tiny faint">{items.length}</span>
                <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
              </div>
              {items.map((entry) => (
                <EntryRow
                  key={entry.w}
                  entry={entry}
                  bookmarked={bookmarks.some((b) => b.targetType === 'word' && b.targetId === entry.w)}
                  onToggleBookmark={(w) => void handleToggleBookmark(w)}
                />
              ))}
            </div>
          ))}
        </Panel>
      )}

      {words.length > 0 ? (
        <div className="tiny faint" style={{ marginTop: 14 }}>
          点开任一词条，可以逐词素查看释义、变体与来源。
          <span style={{ marginLeft: 6 }}>
            <Link to="/library">去知识库浏览全部词素</Link>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function NotFound({ word }: { word: string }) {
  const q = word.toLowerCase();
  const suggestions = useMemo(
    () =>
      allWords()
        .map((w) => ({ w: w.w, gloss: w.glossZh, d: editDistance(q, w.w) }))
        .filter((x) => x.d <= 2)
        .sort((a, b) => a.d - b.d || a.w.localeCompare(b.w))
        .slice(0, 6),
    [q],
  );

  return (
    <div className="page-narrow">
      <Link to="/word" className="small" style={{ display: 'inline-block', marginBottom: 14, color: 'var(--ink-soft)' }}>
        ← 返回词条列表
      </Link>
      <EmptyState
        title={`没有找到 “${word}”`}
        body="词库里没有这个词条。可能是拼写不同，或者它还没有被收录。"
        action={
          <Link to="/word">
            <Button>浏览全部词条</Button>
          </Link>
        }
      />
      {suggestions.length > 0 ? (
        <Panel flat>
          <div className="tiny faint" style={{ marginBottom: 8 }}>
            你可能想找
          </div>
          <div className="row wrap" style={{ gap: 8 }}>
            {suggestions.map((s) => (
              <Link key={s.w} to={`/word/${s.w}`} className="chip">
                <span className="word">{s.w}</span>
                <span className="tiny faint">{s.gloss}</span>
              </Link>
            ))}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function DetailView({
  entry,
  onPickMorpheme,
  onPickConcept,
}: {
  entry: WordEntry;
  onPickMorpheme: (form: string) => void;
  onPickConcept: (id: string) => void;
}) {
  return (
    <div className="page-narrow">
      <Link to="/word" className="small" style={{ display: 'inline-block', marginBottom: 14, color: 'var(--ink-soft)' }}>
        ← 返回词条列表
      </Link>
      <EntryDetail entry={entry} onPickMorpheme={onPickMorpheme} onPickConcept={onPickConcept} />
    </div>
  );
}

export default function WordLab() {
  const { word } = useParams<{ word: string }>();
  const [peekMorpheme, setPeekMorpheme] = useState<string | null>(null);
  const [peekConcept, setPeekConcept] = useState<string | null>(null);

  const entry = word ? getWord(word) : undefined;

  return (
    <div className="page">
      {word ? (
        entry ? (
          <DetailView entry={entry} onPickMorpheme={setPeekMorpheme} onPickConcept={setPeekConcept} />
        ) : (
          <NotFound word={word} />
        )
      ) : (
        <ListView />
      )}
      <MorphemeModal form={peekMorpheme} onClose={() => setPeekMorpheme(null)} />
      <ConceptModal id={peekConcept} onClose={() => setPeekConcept(null)} />
    </div>
  );
}
