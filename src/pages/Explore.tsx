import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { allWords, getMorpheme, getWord } from '../lib/content';
import { analyze, familyIdOf, resolveFamilyId, rootIndexOf } from '../lib/derive';
import { editDistance } from '../lib/morph';
import { Badge, Button, Panel } from '../components/ui';
import { DerivationChain } from '../components/lab/DerivationChain';
import { POS_LABEL } from '../components/matrix/model';
import { ORIGIN_LABELS, TYPE_LABELS } from '../components/word/tokens';

const EXAMPLES = ['unhelpfulness', 'nationalization', 'unhappiness', 'brunch'];

const POSSIBILITIES = [
  {
    title: '词库还没收录',
    body: '词条是分批补进来的。罕见词、专业术语、新词常常还没进库，这不代表英语里没有这个词。',
  },
  {
    title: '它本来就不是派生词',
    body: '单纯词、借词、拟声词无法按词素切开，比如 brunch 是 breakfast + lunch 的混成词，不是前缀加词基。',
  },
  {
    title: '它是某个词的拼写变体',
    body: '屈折形式（-s / -ed / -ing）或某个词的变体，看起来像派生词，其实不是新的构词。',
  },
];

export default function Explore() {
  const [params] = useSearchParams();
  const [input, setInput] = useState(params.get('word') ?? '');
  const word = input.trim().toLowerCase();

  const analysis = useMemo(() => (word ? analyze(word) : null), [word]);
  const entry = word ? getWord(word) : undefined;
  const rootPart = analysis?.parts[rootIndexOf(analysis.parts)];
  const familyId = entry
    ? familyIdOf(entry.parts[rootIndexOf(entry.parts)])
    : resolveFamilyId(rootPart ?? word);

  const suggestions = useMemo(() => {
    if (!word || entry) return [];
    const near = allWords()
      .map((w) => ({ w: w.w, glossZh: w.glossZh, d: editDistance(word, w.w) }))
      .filter((x) => x.d <= 2)
      .sort((a, b) => a.d - b.d || a.w.localeCompare(b.w))
      .slice(0, 6);
    if (near.length > 0) return near;
    return allWords()
      .filter((w) => w.w.startsWith(word.slice(0, 3)))
      .slice(0, 6)
      .map((w) => ({ w: w.w, glossZh: w.glossZh, d: 3 }));
  }, [word, entry]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <div className="eyebrow">词族探究</div>
          <h1>拆开一个词</h1>
          <p className="lede">
            输入任意英文单词：词库收录的词用已验证的拆解，未收录的词按构词规则推测，并明确标出哪些是推测。
          </p>
        </div>
      </header>

      <Panel flat>
        <form
          className="row"
          style={{ gap: 8 }}
          onSubmit={(e) => {
            e.preventDefault();
          }}
        >
          <input
            className="input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例：unhelpfulness / nationalization / brunch"
            aria-label="输入要拆解的英文单词"
            autoComplete="off"
            spellCheck={false}
            style={{ fontSize: 16 }}
          />
          <Button type="submit" variant="primary" style={{ flex: 'none' }}>
            拆解
          </Button>
        </form>
        <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
          <span className="tiny faint">试试：</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" className="chip" onClick={() => setInput(ex)}>
              <span className="mono" style={{ fontSize: 12.5 }}>
                {ex}
              </span>
            </button>
          ))}
        </div>
      </Panel>

      {!word || !analysis ? (
        <Panel style={{ marginTop: 16 }}>
          <p className="small muted" style={{ margin: 0, lineHeight: 1.7 }}>
            还没有输入。拆解结果会显示：词素序列、每个成分的释义、逐步拼写规则、词族入口，以及这个词是否在词库中。
          </p>
        </Panel>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
            gap: 16,
            alignItems: 'start',
            marginTop: 16,
          }}
          className="family-top"
        >
          <Panel>
            <div className="row" style={{ gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <Badge tone={entry ? 'green' : 'amber'}>{entry ? '词库已收录' : '词库未收录'}</Badge>
              {entry?.pos ? <Badge tone="accent">{POS_LABEL[entry.pos] ?? entry.pos}</Badge> : null}
              {analysis.parts.length <= 1 ? <Badge>不可再分</Badge> : null}
            </div>

            <div className="word" style={{ fontSize: 30, lineHeight: 1.2 }}>
              {word}
            </div>
            {entry ? (
              <>
                <p className="small muted" style={{ margin: '8px 0 0', lineHeight: 1.6 }}>
                  {entry.glossZh}
                </p>
                {entry.glossEn ? (
                  <p className="tiny faint" style={{ margin: '4px 0 0' }}>
                    {entry.glossEn}
                  </p>
                ) : null}
              </>
            ) : (
              <p className="small" style={{ margin: '8px 0 0', lineHeight: 1.7, color: 'var(--amber)' }}>
                {analysis.note}
              </p>
            )}

            <div className="divider" />

            <div className="tiny faint" style={{ marginBottom: 8 }}>
              词素序列（{analysis.parts.length} 个成分）
            </div>
            <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
              {analysis.parts.map((part, i) => {
                const m = getMorpheme(part);
                return (
                  <span
                    key={`${part}-${i}`}
                    className="chip"
                    style={{ cursor: 'default', alignItems: 'flex-start' }}
                    title={m ? `${TYPE_LABELS[m.type]} · ${ORIGIN_LABELS[m.origin] ?? m.origin}` : '词库未收录该词素'}
                  >
                    <span className="mono" style={{ fontSize: 13 }}>
                      {part}
                    </span>
                    <span className="tiny faint">{m ? `${TYPE_LABELS[m.type]}｜${m.glossZh}` : '释义未收录'}</span>
                  </span>
                );
              })}
            </div>

            <div className="divider" />

            <div className="tiny faint" style={{ marginBottom: 8 }}>
              逐层拼写
            </div>
            <DerivationChain steps={analysis.steps} familyId={familyId} />

            <div className="divider" />

            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              {familyId ? (
                <Link to={`/family/${familyId}`} className="btn btn-sm btn-primary">
                  进入词族
                </Link>
              ) : null}
              {rootPart ? (
                <Link to={`/matrix?base=${encodeURIComponent(rootPart)}`} className="btn btn-sm">
                  用 {rootPart} 试拼矩阵
                </Link>
              ) : null}
              {entry ? (
                <Link to={`/word/${entry.w}`} className="btn btn-sm">
                  词源词典
                </Link>
              ) : null}
            </div>
          </Panel>

          <div>
            <Panel>
              <h3 style={{ marginBottom: 8 }}>{entry ? '这个词的结论' : '未收录意味着什么'}</h3>
              {entry ? (
                <ul className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                  <li>拼写：词库确认它存在，拆解来自内容编辑，不是推测。</li>
                  <li>
                    词性：
                    {entry.pos ? POS_LABEL[entry.pos] : '未标注'}
                    {entry.pos ? '；释义与词性配套，可直接用于记忆。' : '；词性未标注，使用时请留意。'}
                  </li>
                  <li>
                    词源：
                    {entry.ety?.from ? `${entry.ety.from}。` : '词源未核验，本页不做同源断言。'}
                  </li>
                </ul>
              ) : (
                <ol className="small muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                  {POSSIBILITIES.map((p) => (
                    <li key={p.title}>
                      <strong>{p.title}</strong>：{p.body}
                    </li>
                  ))}
                </ol>
              )}
              {!entry ? (
                <p className="tiny faint" style={{ margin: '10px 0 0', lineHeight: 1.6 }}>
                  上面的词素序列是<strong>按拼写规则推测的切分</strong>，不是辞书结论。
                </p>
              ) : null}
            </Panel>

            {!entry && suggestions.length > 0 ? (
              <Panel style={{ marginTop: 16 }}>
                <div className="tiny faint" style={{ marginBottom: 8 }}>
                  词库里相近的词
                </div>
                <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                  {suggestions.map((s) => (
                    <button key={s.w} type="button" className="chip" onClick={() => setInput(s.w)}>
                      <span className="word" style={{ fontSize: 13.5 }}>
                        {s.w}
                      </span>
                      <span className="tiny faint">{s.glossZh}</span>
                    </button>
                  ))}
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
