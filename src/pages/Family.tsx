import { useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { allMorphemes, allWords, getMorpheme, getWord } from '../lib/content';
import { familyBaseForm, familyMembers, resolveFamilyId } from '../lib/derive';
import { Badge, EmptyState, Panel } from '../components/ui';
import { FamilyTree } from '../components/lab/FamilyTree';
import { POS_LABEL } from '../components/matrix/model';
import { ORIGIN_LABELS, TYPE_LABELS } from '../components/word/tokens';
import type { WordEntry } from '../lib/types';

type GroupKey = 'prefix' | 'suffix' | 'compound' | 'base';

const GROUPS: { key: GroupKey; label: string; hint: string }[] = [
  { key: 'prefix', label: '前缀派生', hint: '最外层是前缀：un- / re- / in- 这类成分' },
  { key: 'suffix', label: '后缀派生', hint: '词基后接后缀：-ful / -ness / -ation 这类成分' },
  { key: 'compound', label: '复合', hint: '两个或更多词根并列构成' },
  { key: 'base', label: '基础词', hint: '没有加成分的单词本身' },
];

function groupOf(entry: WordEntry): GroupKey {
  if (entry.parts.length <= 1) return 'base';
  const roots = entry.parts.filter((p) => {
    const type = getMorpheme(p)?.type;
    return type === 'root' || type === 'combining';
  }).length;
  if (roots >= 2) return 'compound';
  return getMorpheme(entry.parts[0])?.type === 'prefix' ? 'prefix' : 'suffix';
}

export default function Family() {
  const { id = '' } = useParams<{ id: string }>();
  const familyId = resolveFamilyId(id);
  const morpheme = useMemo(() => allMorphemes().find((m) => m.id === familyId), [familyId]);
  const baseForm = familyId ? (familyBaseForm(familyId) ?? '') : '';

  const members = useMemo(() => {
    if (!familyId) return [];
    return familyMembers(familyId)
      .map((m) => getWord(m.word))
      .filter((entry): entry is WordEntry => Boolean(entry));
  }, [familyId]);

  const memberWords = useMemo(() => new Set(members.map((m) => m.w)), [members]);

  const grouped = useMemo(() => {
    const map = new Map<GroupKey, WordEntry[]>();
    for (const entry of members) {
      const key = groupOf(entry);
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    }
    return map;
  }, [members]);

  // Same spelling opening, different morpheme: never claim a shared origin.
  const lookalikes = useMemo(() => {
    if (!baseForm || baseForm.length < 3) return [];
    return allWords()
      .filter((w) => w.w !== baseForm && w.w.startsWith(baseForm) && !memberWords.has(w.w))
      .slice(0, 8);
  }, [baseForm, memberWords]);

  if (!familyId || !morpheme) {
    return (
      <div className="page">
        <header className="page-head">
          <div>
            <div className="eyebrow">词族探究</div>
            <h1>没有找到这个词族</h1>
          </div>
        </header>
        <EmptyState
          title={`「${id || '（空）'}」不是一个已知的词族`}
          body="词族按词素组织。请从构词实验室的词条进入，或先确认这个词素是否已在词库中收录。"
          action={
            <Link to="/matrix" className="btn btn-primary">
              回到构词实验室
            </Link>
          }
        />
      </div>
    );
  }

  const familyLink = `/matrix?base=${encodeURIComponent(baseForm)}`;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">词族探究</div>
          <h1 style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span className="word" style={{ fontSize: 34 }}>
              {baseForm}
            </span>
            <span className="muted" style={{ fontSize: 17 }}>
              {morpheme.glossZh}
            </span>
          </h1>
          <p className="lede">
            同一个词素长出的词：先看核心词基，再按加成分分组，最后看派生层次。词源关系只按词素拆解与词源记载判定。
          </p>
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Badge tone="accent">{TYPE_LABELS[morpheme.type]}</Badge>
          <Badge>{ORIGIN_LABELS[morpheme.origin] ?? morpheme.origin}</Badge>
          <Badge tone="green">{members.length} 个词条</Badge>
        </div>
      </header>

      <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <Link to={familyLink} className="btn btn-sm">
          在矩阵里试拼这一族
        </Link>
        <Link to={`/explore?word=${encodeURIComponent(baseForm)}`} className="btn btn-sm">
          拆解 {baseForm}
        </Link>
        <Link to="/matrix" className="btn btn-sm btn-ghost">
          换一个词基
        </Link>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: 16,
          alignItems: 'start',
        }}
        className="family-top"
      >
        <Panel>
          <h3 style={{ marginBottom: 10 }}>核心词基</h3>
          <div className="row" style={{ gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span className="word" style={{ fontSize: 24 }}>
              {morpheme.form}
            </span>
            <span className="small muted">{morpheme.glossZh}</span>
            <span className="tiny faint mono">{morpheme.id}</span>
          </div>
          <p className="tiny faint" style={{ margin: '4px 0 0' }}>
            {TYPE_LABELS[morpheme.type]} · {ORIGIN_LABELS[morpheme.origin] ?? morpheme.origin}
          </p>
          {morpheme.allomorphs?.length ? (
            <p className="small" style={{ margin: '10px 0 0' }}>
              <span className="tiny faint">变体：</span>
              <span className="mono">{morpheme.allomorphs.join(' / ')}</span>
            </p>
          ) : null}
          {morpheme.note ? (
            <p className="small muted" style={{ margin: '10px 0 0', lineHeight: 1.7 }}>
              {morpheme.note}
            </p>
          ) : null}
          <div className="divider" />
          <div className="tiny faint" style={{ marginBottom: 6 }}>
            词库中的例词
          </div>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {morpheme.examples.map((ex) => {
              const entry = getWord(ex);
              return entry ? (
                <Link key={ex} to={`/word/${entry.w}`} className="chip">
                  <span className="word">{entry.w}</span>
                </Link>
              ) : (
                <span key={ex} className="chip" style={{ cursor: 'default' }}>
                  <span className="word">{ex}</span>
                  <span className="tiny faint">未收录</span>
                </span>
              );
            })}
          </div>
        </Panel>

        <Panel>
          <div className="row-between" style={{ marginBottom: 8 }}>
            <h3 style={{ marginBottom: 0 }}>派生层次</h3>
            <span className="tiny faint">由构词规则从词基逐层生成</span>
          </div>
          {members.length === 0 ? (
            <p className="small faint" style={{ margin: 0 }}>
              词库里还没有以 {baseForm} 为词素的词条，所以没有可展示的层次。
            </p>
          ) : (
            <FamilyTree entries={members} />
          )}
        </Panel>
      </div>

      <Panel style={{ marginTop: 16 }}>
        <div className="row-between" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ marginBottom: 0 }}>按加成分分组</h3>
          <span className="tiny faint">同一词素，不同加成分位置</span>
        </div>
        {members.length === 0 ? (
          <p className="small faint" style={{ margin: 0 }}>
            暂无成员。
          </p>
        ) : (
          GROUPS.filter((g) => (grouped.get(g.key)?.length ?? 0) > 0).map((g) => {
            const items = grouped.get(g.key) ?? [];
            return (
              <div key={g.key} style={{ marginBottom: 16 }}>
                <div className="row" style={{ gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span className="serif" style={{ fontSize: 16, fontWeight: 640 }}>
                    {g.label}
                  </span>
                  <span className="tiny faint">{items.length}</span>
                  <span className="tiny faint">{g.hint}</span>
                  <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
                </div>
                <div className="grid" style={{ gap: 6 }}>
                  {items.map((entry) => (
                    <div
                      key={entry.w}
                      className="row"
                      style={{ gap: 8, flexWrap: 'wrap', alignItems: 'baseline', padding: '5px 0' }}
                    >
                      <Link to={`/word/${entry.w}`} className="word" style={{ fontSize: 15 }}>
                        {entry.w}
                      </Link>
                      {entry.pos ? <span className="tiny faint">{POS_LABEL[entry.pos] ?? entry.pos}</span> : null}
                      <span className="small muted">{entry.glossZh}</span>
                      <span className="mono tiny faint">{entry.parts.join(' + ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </Panel>

      <Panel style={{ marginTop: 16 }}>
        <h3 style={{ marginBottom: 4 }}>同源，还是只是拼写相似？</h3>
        <p className="small muted" style={{ margin: '0 0 12px', lineHeight: 1.7 }}>
          这里的判定只有两条依据：词条是否真的含有同一个词素（词素 id 相同），以及词条是否带有词源记载。
          两条都不满足时，只标「仅拼写相近」，并注明同源关系<strong>未核验</strong>。
        </p>

        <div className="tiny faint" style={{ marginBottom: 6 }}>
          同一词素（词素拆解支持）
        </div>
        {members.length === 0 ? (
          <p className="small faint" style={{ margin: '0 0 12px' }}>
            暂无。
          </p>
        ) : (
          <div className="grid" style={{ gap: 4, marginBottom: 14 }}>
            {members.map((entry) => (
              <div key={entry.w} className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Link to={`/word/${entry.w}`} className="word" style={{ fontSize: 14.5 }}>
                  {entry.w}
                </Link>
                <Badge tone="green">同一词素</Badge>
                {entry.ety?.from ? (
                  <span className="tiny faint">词源：{entry.ety.from}</span>
                ) : (
                  <span className="tiny" style={{ color: 'var(--amber)' }}>
                    词源未核验
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="tiny faint" style={{ marginBottom: 6 }}>
          仅拼写相近（同源未核验）
        </div>
        {lookalikes.length === 0 ? (
          <p className="small faint" style={{ margin: 0 }}>
            词库中没有只共享拼写的词条。
          </p>
        ) : (
          <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
            {lookalikes.map((w) => (
              <Link key={w.w} to={`/word/${w.w}`} className="chip" title={`${w.glossZh}｜词源未核验`}>
                <span className="word" style={{ fontSize: 13.5 }}>
                  {w.w}
                </span>
                <span className="tiny faint">同源未核验</span>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
