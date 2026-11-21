import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { allMorphemes, allWords, familyDossier, getWord, loadFamilies, type FamilyDossier } from '../lib/content';
import { affixRole, familyBaseForm, familyMembers, resolveFamilyId } from '../lib/derive';
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
  // Parts that are neither prefix nor suffix are lexical cores: two of them
  // means a compound, not a derivation.
  const cores = entry.parts.filter((p) => !affixRole(p)).length;
  if (cores >= 2) return 'compound';
  return affixRole(entry.parts[0]) === 'prefix' ? 'prefix' : 'suffix';
}

export default function Family() {
  const { id = '' } = useParams<{ id: string }>();
  const familyId = resolveFamilyId(id);
  const morpheme = useMemo(() => allMorphemes().find((m) => m.id === familyId), [familyId]);
  const baseForm = familyId ? (familyBaseForm(familyId) ?? '') : '';
  // The route carries a **morpheme** id (`rx-spec`); dossiers are filed under the
  // **family** id (`fam-spect`). Looking up by the route id never matched, so the
  // dossier panel silently never rendered in 0.8.0. Resolve through the
  // morpheme's familyId, and keep the direct id as a fallback for old links.
  const dossierId = morpheme?.familyId ?? familyId;
  const [dossier, setDossier] = useState<FamilyDossier | undefined>();

  useEffect(() => {
    let alive = true;
    void loadFamilies().then(() => {
      if (!alive) return;
      const key = dossierId ?? familyId ?? '';
      setDossier(key ? familyDossier(key) : undefined);
    });
    return () => {
      alive = false;
    };
  }, [dossierId, familyId]);

  const members = useMemo(() => {
    if (!familyId) return [];
    return familyMembers(familyId)
      .map((m) => getWord(m.word))
      .filter((entry): entry is WordEntry => Boolean(entry));
  }, [familyId]);

  const memberWords = useMemo(() => new Set(members.map((m) => m.w)), [members]);
  const dictionary = useMemo(() => new Set(allWords().map((w) => w.w)), []);

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

      {dossier ? (
        <Panel>
          <h2 className="h2">词族档案</h2>
          <p className="small muted">核心义、派生链、语义演变与反例——按可复核的语源整理</p>
          {dossier.coreIdea ? <p className="lede">{dossier.coreIdea}</p> : null}
          {dossier.root?.etymon ? (
            <p className="small muted">
              语源：{dossier.root.origin} <strong>{dossier.root.etymon}</strong>
              {dossier.root.etymonGloss ? `「${dossier.root.etymonGloss}」` : ''}
            </p>
          ) : null}

          {dossier.teaching?.induction ? (
            <div className="callout" style={{ marginTop: 12 }}>
              <strong>先自己归纳：</strong>
              {dossier.teaching.induction}
            </div>
          ) : null}

          {dossier.members?.length ? (
            <>
              <h3 className="h3" style={{ marginTop: 16 }}>真实成员（{dossier.members.length}）</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>词</th>
                    <th>关系</th>
                    <th>切分</th>
                    <th>释义</th>
                  </tr>
                </thead>
                <tbody>
                  {dossier.members.map((member) => (
                    <tr key={member.w}>
                      <td><code>{member.w}</code></td>
                      <td>
                        <Badge tone={member.relation === 'cognate' ? 'green' : 'accent'}>
                          {member.relation === 'cognate' ? '同源异途' : '派生'}
                        </Badge>
                      </td>
                      <td className="small">{(member.layer ?? []).join(' + ') || '—'}</td>
                      <td className="small">{member.glossZh ?? member.note ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}

          {dossier.derivationChains?.length ? (
            <>
              <h3 className="h3" style={{ marginTop: 16 }}>多层派生</h3>
              <ul className="list">
                {dossier.derivationChains.map((chain) => (
                  <li key={chain.stages.join('-')}>
                    <strong>{chain.stages.join(' → ')}</strong>
                    {chain.note ? <span className="small muted"> — {chain.note}</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {dossier.semanticShifts?.length ? (
            <>
              <h3 className="h3" style={{ marginTop: 16 }}>语义演变</h3>
              <ul className="list">
                {dossier.semanticShifts.map((shift) => (
                  <li key={shift.w}>
                    <code>{shift.w}</code>：{shift.from ?? '?'} → {shift.to ?? '?'}
                    {shift.why ? <span className="small muted">（{shift.why}）</span> : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {dossier.homographTraps?.length ? (
            <>
              <h3 className="h3" style={{ marginTop: 16 }}>同形异源的反例</h3>
              <ul className="list">
                {dossier.homographTraps.map((trap) => (
                  <li key={trap.form}>
                    <code>{trap.form}</code>：{trap.note ?? trap.other ?? '—'}
                  </li>
                ))}
              </ul>
            </>
          ) : null}

          {dossier.teaching?.transfer ? (
            <div className="callout" style={{ marginTop: 16 }}>
              <strong>迁移检验：</strong>
              {dossier.teaching.transfer.question ?? `把 ${dossier.teaching.transfer.word} 拆开并猜义`}
              <details style={{ marginTop: 6 }}>
                <summary className="small">看答案</summary>
                <p className="small">{dossier.teaching.transfer.answer ?? '—'}</p>
              </details>
            </div>
          ) : null}

          {dossier.sources?.length ? (
            <p className="tiny faint" style={{ marginTop: 12 }}>
              来源：{dossier.sources.map((s) => `${s.id}${s.detail ? `（${s.detail}）` : ''}`).join('；')}
            </p>
          ) : null}
        </Panel>
      ) : null}

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
            <span className="tiny faint">按词条词素拆解排列，可展开折叠</span>
          </div>
          {members.length === 0 ? (
            <p className="small faint" style={{ margin: 0 }}>
              词库里还没有以 {baseForm} 为词素的词条，所以没有可展示的层次。
            </p>
          ) : (
            <FamilyTree entries={members} dictionary={dictionary} />
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
