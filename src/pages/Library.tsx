import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  allMorphemes,
  allWords,
  getConcept,
  getLesson,
  getMorpheme,
  getWord,
  stripDashes,
} from '../lib/content';
import { useApp } from '../lib/store';
import type { Bookmark } from '../lib/api';
import type { MemoryCard, Morpheme, Note, WordEntry } from '../lib/types';
import { Badge, Button, EmptyState, Modal, Panel, SectionHead, Stat } from '../components/ui';
import { ConceptModal } from '../components/word/ConceptModal';
import { EntryRow } from '../components/word/EntryRow';
import { MorphemeDetail, MorphemeModal } from '../components/word/MorphemeModal';
import {
  DOMAIN_LABELS,
  POS_LABELS,
  formatDate,
  originLabel,
  TYPE_TONES,
  typeLabel,
} from '../components/word/tokens';

type Tab = 'morphemes' | 'words' | 'shelf';
type LearnedFilter = 'all' | 'learned' | 'unlearned';
type Domain = NonNullable<WordEntry['domain']>;
type Pos = NonNullable<WordEntry['pos']>;

const DOMAIN_KEYS = Object.keys(DOMAIN_LABELS) as Domain[];
const POS_KEYS = Object.keys(POS_LABELS) as Pos[];

const NOTE_GROUPS = [
  { type: 'word', label: '词条笔记' },
  { type: 'morpheme', label: '词素笔记' },
  { type: 'concept', label: '概念笔记' },
  { type: 'lesson', label: '课程笔记' },
] as const;

/** Memory cards are keyed `concept:<refId>`; forms may carry dashes. */
function learnedCard(cards: Record<string, MemoryCard>, form: string): MemoryCard | undefined {
  return cards[`concept:${form}`] ?? cards[`concept:${stripDashes(form)}`];
}

function targetLabel(type: string, id: string): string {
  if (type === 'word') {
    const w = getWord(id);
    return w ? `${w.w} · ${w.glossZh}` : id;
  }
  if (type === 'morpheme') {
    const m = getMorpheme(id);
    return m ? `${m.form} · ${m.glossZh}` : id;
  }
  if (type === 'concept') {
    const c = getConcept(id);
    return c ? c.zh : id;
  }
  if (type === 'lesson') {
    const l = getLesson(id);
    return l ? `第 ${l.week} 周 · ${l.title}` : id;
  }
  return id;
}

function typeName(type: string): string {
  if (type === 'word') return '词条';
  if (type === 'morpheme') return '词素';
  if (type === 'concept') return '概念';
  if (type === 'lesson') return '课程';
  return type;
}

/* ------------------------------- 词素分页 ------------------------------- */

function MorphemePanel({
  morphemes,
  cards,
  bookmarks,
  onToggleBookmark,
  onPeek,
}: {
  morphemes: Morpheme[];
  cards: Record<string, MemoryCard>;
  bookmarks: Bookmark[];
  onToggleBookmark: (form: string) => void;
  onPeek: (form: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState<Morpheme['type'] | 'all'>('all');
  const [learned, setLearned] = useState<LearnedFilter>('all');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return morphemes
      .filter((m) => {
        if (q) {
          const hay = [m.form, stripDashes(m.form), m.glossZh, m.glossEn, ...(m.allomorphs ?? [])]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (type !== 'all' && m.type !== type) return false;
        const isLearned = Boolean(learnedCard(cards, m.form));
        if (learned === 'learned' && !isLearned) return false;
        if (learned === 'unlearned' && isLearned) return false;
        return true;
      })
      .sort((a, b) => stripDashes(a.form).localeCompare(stripDashes(b.form)));
  }, [morphemes, query, type, learned, cards]);

  const types = useMemo(
    () => (['prefix', 'root', 'suffix', 'combining'] as Morpheme['type'][]).filter((t) => morphemes.some((m) => m.type === t)),
    [morphemes],
  );

  const filtersActive = Boolean(query.trim()) || type !== 'all' || learned !== 'all';
  const reset = () => {
    setQuery('');
    setType('all');
    setLearned('all');
  };

  if (morphemes.length === 0) {
    return (
      <EmptyState
        title="词素库还是空的"
        body="词素数据由内容包提供，目前还没有载入。完成课程后，学过的词素会连同释义、变体和来源出现在这里。"
        action={
          <Link to="/course">
            <Button variant="primary">去学习</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <Panel flat>
        <div className="row wrap" style={{ gap: 10 }}>
          <input
            className="input"
            style={{ flex: '1 1 260px' }}
            type="search"
            value={query}
            placeholder="搜索词形 / 中文释义 / 英文释义"
            aria-label="搜索词素"
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className="select"
            style={{ width: 140 }}
            value={type}
            aria-label="按词素类型筛选"
            onChange={(e) => setType(e.target.value as Morpheme['type'] | 'all')}
          >
            <option value="all">全部类型</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {typeLabel(t)}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: 130 }}
            value={learned}
            aria-label="按学习状态筛选"
            onChange={(e) => setLearned(e.target.value as LearnedFilter)}
          >
            <option value="all">全部状态</option>
            <option value="learned">已学</option>
            <option value="unlearned">未学</option>
          </select>
          {filtersActive ? (
            <Button size="sm" variant="ghost" onClick={reset}>
              清除筛选
            </Button>
          ) : null}
        </div>
        <div className="tiny faint" style={{ marginTop: 10 }}>
          {filtersActive ? `匹配 ${filtered.length} / ${morphemes.length} 个词素` : `共 ${morphemes.length} 个词素，已学状态来自记忆卡。`}
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <EmptyState
          title="没有匹配的词素"
          body="换个词形或释义关键词，或者放宽类型与学习状态筛选。"
          action={<Button onClick={reset}>清除筛选</Button>}
        />
      ) : (
        <Panel style={{ padding: '4px 18px 18px', marginTop: 16 }}>
          {filtered.map((m) => {
            const isLearned = Boolean(learnedCard(cards, m.form));
            const bookmarked = bookmarks.some((b) => b.targetType === 'morpheme' && b.targetId === m.form);
            const open = expanded === m.form;
            return (
              <div key={m.id} style={{ borderBottom: '1px solid var(--line)' }}>
                <div className="row-between" style={{ gap: 12, padding: '10px 0' }}>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : m.form)}
                    aria-expanded={open}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      flexWrap: 'wrap',
                      color: 'inherit',
                      font: 'inherit',
                    }}
                  >
                    <span className="mono" style={{ fontSize: 16, fontWeight: 650, color: 'var(--accent-ink)' }}>
                      {m.form}
                    </span>
                    <Badge tone={TYPE_TONES[m.type]}>{typeLabel(m.type)}</Badge>
                    <span className="small muted">{m.glossZh}</span>
                    <span className="tiny faint">{originLabel(m.origin)}</span>
                    {isLearned ? <Badge tone="green">已学</Badge> : <Badge>未学</Badge>}
                  </button>
                  <div className="row" style={{ gap: 2, flex: 'none' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={bookmarked ? `取消收藏 ${m.form}` : `收藏 ${m.form}`}
                      aria-pressed={bookmarked}
                      style={{ color: bookmarked ? 'var(--amber)' : 'var(--ink-faint)', fontSize: 16, lineHeight: 1 }}
                      onClick={() => onToggleBookmark(m.form)}
                    >
                      {bookmarked ? '★' : '☆'}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setExpanded(open ? null : m.form)}>
                      {open ? '收起' : '展开'}
                    </Button>
                  </div>
                </div>
                {open ? (
                  <div className="fade-in" style={{ padding: '0 2px 18px' }}>
                    <Panel flat>
                      <MorphemeDetail form={m.form} onPick={onPeek} />
                    </Panel>
                  </div>
                ) : null}
              </div>
            );
          })}
        </Panel>
      )}
    </div>
  );
}

/* ------------------------------- 词条分页 ------------------------------- */

function WordsPanel({
  bookmarks,
  onToggleBookmark,
}: {
  bookmarks: Bookmark[];
  onToggleBookmark: (word: string) => void;
}) {
  const words = allWords();
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<Pos | 'all'>('all');
  const [domain, setDomain] = useState<Domain | 'all'>('all');
  const [onlyBookmarked, setOnlyBookmarked] = useState(false);

  const domains = useMemo(() => DOMAIN_KEYS.filter((d) => words.some((w) => w.domain === d)), [words]);
  const poses = useMemo(() => POS_KEYS.filter((p) => words.some((w) => w.pos === p)), [words]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words
      .filter((w) => {
        if (q) {
          const hay = [w.w, w.glossZh, w.glossEn ?? ''].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (pos !== 'all' && w.pos !== pos) return false;
        if (domain !== 'all' && w.domain !== domain) return false;
        if (onlyBookmarked && !bookmarks.some((b) => b.targetType === 'word' && b.targetId === w.w)) return false;
        return true;
      })
      .sort((a, b) => a.w.localeCompare(b.w));
  }, [words, query, pos, domain, onlyBookmarked, bookmarks]);

  const filtersActive = Boolean(query.trim()) || pos !== 'all' || domain !== 'all' || onlyBookmarked;
  const reset = () => {
    setQuery('');
    setPos('all');
    setDomain('all');
    setOnlyBookmarked(false);
  };

  if (words.length === 0) {
    return (
      <EmptyState
        title="词条库还是空的"
        body="词条由内容包提供，目前还没有载入。课程中出现的词会在内容补齐后汇总到这里。"
        action={
          <Link to="/course">
            <Button variant="primary">去学习</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
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
            style={{ width: 130 }}
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
          <Button
            size="sm"
            variant={onlyBookmarked ? 'primary' : 'default'}
            aria-pressed={onlyBookmarked}
            onClick={() => setOnlyBookmarked((v) => !v)}
          >
            ★ 只看收藏
          </Button>
          {filtersActive ? (
            <Button size="sm" variant="ghost" onClick={reset}>
              清除筛选
            </Button>
          ) : null}
        </div>
        <div className="tiny faint" style={{ marginTop: 10 }}>
          {filtersActive ? `匹配 ${filtered.length} / ${words.length} 个词条` : `共 ${words.length} 个词条。`}
        </div>
      </Panel>

      {filtered.length === 0 ? (
        <EmptyState
          title="没有匹配的词条"
          body="换个关键词，或取消词性、领域与收藏筛选。"
          action={<Button onClick={reset}>清除筛选</Button>}
        />
      ) : (
        <Panel style={{ padding: '4px 18px 18px', marginTop: 16 }}>
          {filtered.map((entry) => (
            <EntryRow
              key={entry.w}
              entry={entry}
              bookmarked={bookmarks.some((b) => b.targetType === 'word' && b.targetId === entry.w)}
              onToggleBookmark={onToggleBookmark}
            />
          ))}
        </Panel>
      )}
    </div>
  );
}

/* ---------------------------- 笔记与收藏分页 ---------------------------- */

function ShelfPanel({
  notes,
  bookmarks,
  onOpenTarget,
  onPeekNote,
  onToggleBookmark,
}: {
  notes: Note[];
  bookmarks: Bookmark[];
  onOpenTarget: (type: string, id: string) => void;
  onPeekNote: (note: Note) => void;
  onToggleBookmark: (type: string, id: string) => void;
}) {
  const { deleteNote, toast } = useApp();
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<number | null>(null);

  const q = query.trim().toLowerCase();

  const filteredNotes = useMemo(
    () => notes.filter((n) => !q || n.body.toLowerCase().includes(q) || n.targetId.toLowerCase().includes(q)),
    [notes, q],
  );
  const filteredBookmarks = useMemo(
    () =>
      bookmarks.filter(
        (b) => !q || b.targetId.toLowerCase().includes(q) || targetLabel(b.targetType, b.targetId).toLowerCase().includes(q),
      ),
    [bookmarks, q],
  );

  const groups = NOTE_GROUPS.map((g) => ({ ...g, items: filteredNotes.filter((n) => n.targetType === g.type) })).filter(
    (g) => g.items.length > 0,
  );

  const remove = async (id: number) => {
    if (pending !== id) {
      setPending(id);
      return;
    }
    try {
      await deleteNote(id);
      toast('笔记已删除', 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : '删除失败，请重试', 'warn');
    } finally {
      setPending(null);
    }
  };

  if (notes.length === 0 && bookmarks.length === 0) {
    return (
      <EmptyState
        title="还没有笔记与收藏"
        body="在词条详情里写下的笔记、在词条或词素上点的 ☆，都会汇总到这里。"
        action={
          <Link to="/word">
            <Button variant="primary">去词源词典</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div>
      <Panel flat>
        <input
          className="input"
          type="search"
          value={query}
          placeholder="搜索笔记内容 / 收藏目标"
          aria-label="搜索笔记与收藏"
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="tiny faint" style={{ marginTop: 10 }}>
          笔记 {filteredNotes.length} 条 · 收藏 {filteredBookmarks.length} 个
        </div>
      </Panel>

      {q && groups.length === 0 && filteredBookmarks.length === 0 ? (
        <EmptyState
          title="没有匹配的内容"
          body="换一个关键词试试；搜索只匹配笔记正文与目标名称。"
          action={<Button onClick={() => setQuery('')}>清除搜索</Button>}
        />
      ) : null}

      {groups.map((group) => (
        <div key={group.type}>
          <SectionHead title={`${group.label} · ${group.items.length}`} hint="点击「打开」回到对应词条或词素" />
          <Panel style={{ padding: '4px 18px' }}>
            {group.items.map((n) => (
              <div key={n.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <div className="row-between" style={{ gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row wrap" style={{ gap: 8 }}>
                      <span className="small" style={{ fontWeight: 600 }}>
                        {targetLabel(n.targetType, n.targetId)}
                      </span>
                      <span className="tiny faint">{formatDate(n.updatedAt)}</span>
                    </div>
                    <p
                      className="small muted"
                      style={{ margin: '4px 0 0', maxHeight: 62, overflow: 'hidden', whiteSpace: 'pre-wrap' }}
                    >
                      {n.body}
                    </p>
                  </div>
                  <div className="row" style={{ gap: 2, flex: 'none' }}>
                    <Button size="sm" variant="ghost" onClick={() => onOpenTarget(n.targetType, n.targetId)}>
                      打开
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onPeekNote(n)}>
                      查看
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      style={{ color: pending === n.id ? 'var(--red)' : undefined }}
                      onClick={() => void remove(n.id)}
                    >
                      {pending === n.id ? '确认删除' : '删除'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </Panel>
        </div>
      ))}

      <SectionHead title={`收藏 · ${filteredBookmarks.length}`} hint="词条、词素、概念与课程都可以收藏" />
      {filteredBookmarks.length === 0 ? (
        <Panel flat>
          <p className="small faint" style={{ margin: 0 }}>
            还没有匹配的收藏。词条与词素右侧的 ☆ 会把它们放到这里。
          </p>
        </Panel>
      ) : (
        <Panel style={{ padding: '4px 18px' }}>
          {filteredBookmarks.map((b) => (
            <div
              key={`${b.targetType}:${b.targetId}`}
              className="row-between"
              style={{ gap: 12, padding: '9px 0', borderBottom: '1px solid var(--line)' }}
            >
              <div className="row wrap" style={{ gap: 8, minWidth: 0 }}>
                <Badge tone="accent">{typeName(b.targetType)}</Badge>
                <span className="small">{targetLabel(b.targetType, b.targetId)}</span>
                <span className="tiny faint">{formatDate(b.createdAt)}</span>
              </div>
              <div className="row" style={{ gap: 2, flex: 'none' }}>
                <Button size="sm" variant="ghost" onClick={() => onOpenTarget(b.targetType, b.targetId)}>
                  打开
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`取消收藏 ${b.targetId}`}
                  style={{ color: 'var(--amber)' }}
                  onClick={() => onToggleBookmark(b.targetType, b.targetId)}
                >
                  ★
                </Button>
              </div>
            </div>
          ))}
        </Panel>
      )}
    </div>
  );
}

/* --------------------------------- 外壳 --------------------------------- */

export default function Library() {
  const { notes, bookmarks, cards, toggleBookmark, toast } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'words' || tabParam === 'shelf' ? tabParam : 'morphemes';

  const [peekMorph, setPeekMorph] = useState<string | null>(null);
  const [peekConcept, setPeekConcept] = useState<string | null>(null);
  const [peekNote, setPeekNote] = useState<Note | null>(null);

  const morphemes = allMorphemes();
  const words = allWords();

  const setTab = (t: Tab) => setParams({ tab: t });

  const openTarget = (type: string, id: string) => {
    if (type === 'word') {
      navigate(`/word/${id}`);
      return;
    }
    if (type === 'morpheme') {
      setPeekMorph(id);
      return;
    }
    if (type === 'concept') {
      setPeekConcept(id);
      return;
    }
    if (type === 'lesson') {
      navigate(getLesson(id) ? `/session/${id}` : '/course');
      return;
    }
    toast('暂时无法打开这个目标', 'warn');
  };

  const handleToggleBookmark = async (type: string, id: string) => {
    try {
      const added = await toggleBookmark(type, id);
      toast(added ? '已收藏' : '已取消收藏', added ? 'success' : 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : '收藏操作失败', 'warn');
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <div className="eyebrow">知识库</div>
          <h1>知识库</h1>
          <p className="lede">
            词素、词条与你的笔记收藏都在这里。已学状态来自记忆卡的计算结果，不能手动勾选。
          </p>
        </div>
      </div>

      <Panel flat style={{ marginBottom: 16 }}>
        <div className="grid grid-4">
          <Stat label="词素" value={morphemes.length} />
          <Stat label="词条" value={words.length} />
          <Stat label="笔记" value={notes.length} />
          <Stat label="收藏" value={bookmarks.length} />
        </div>
      </Panel>

      <div className="row wrap" style={{ gap: 8, marginBottom: 6 }}>
        <Button variant={tab === 'morphemes' ? 'primary' : 'default'} size="sm" onClick={() => setTab('morphemes')}>
          词素 {morphemes.length}
        </Button>
        <Button variant={tab === 'words' ? 'primary' : 'default'} size="sm" onClick={() => setTab('words')}>
          词条 {words.length}
        </Button>
        <Button variant={tab === 'shelf' ? 'primary' : 'default'} size="sm" onClick={() => setTab('shelf')}>
          笔记与收藏 {notes.length + bookmarks.length}
        </Button>
      </div>

      <div className="fade-in" style={{ marginTop: 12 }}>
        {tab === 'morphemes' ? (
          <MorphemePanel
            morphemes={morphemes}
            cards={cards}
            bookmarks={bookmarks}
            onToggleBookmark={(form) => void handleToggleBookmark('morpheme', form)}
            onPeek={setPeekMorph}
          />
        ) : null}
        {tab === 'words' ? (
          <WordsPanel bookmarks={bookmarks} onToggleBookmark={(w) => void handleToggleBookmark('word', w)} />
        ) : null}
        {tab === 'shelf' ? (
          <ShelfPanel
            notes={notes}
            bookmarks={bookmarks}
            onOpenTarget={openTarget}
            onPeekNote={setPeekNote}
            onToggleBookmark={(type, id) => void handleToggleBookmark(type, id)}
          />
        ) : null}
      </div>

      <MorphemeModal form={peekMorph} onClose={() => setPeekMorph(null)} />
      <ConceptModal id={peekConcept} onClose={() => setPeekConcept(null)} />

      <Modal
        open={Boolean(peekNote)}
        onClose={() => setPeekNote(null)}
        title={peekNote ? `${typeName(peekNote.targetType)}笔记` : '笔记'}
        footer={
          peekNote ? (
            <div className="row">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const target = peekNote;
                  setPeekNote(null);
                  openTarget(target.targetType, target.targetId);
                }}
              >
                打开目标
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setPeekNote(null)}>
                关闭
              </Button>
            </div>
          ) : null
        }
      >
        {peekNote ? (
          <div className="col" style={{ gap: 12 }}>
            <div className="row wrap" style={{ gap: 8 }}>
              <Badge tone="accent">{typeName(peekNote.targetType)}</Badge>
              <span className="small">{targetLabel(peekNote.targetType, peekNote.targetId)}</span>
            </div>
            <div className="panel-flat" style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
              {peekNote.body}
            </div>
            <div className="tiny faint">
              创建于 {formatDate(peekNote.createdAt)} · 更新于 {formatDate(peekNote.updatedAt)}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
