import { Fragment, useState, type ReactNode } from 'react';
import { Badge, Button } from '../ui';
import { RichText } from '../RichText';
import { buildWord, explainSum, formatWordSum } from '../../lib/morph';
import { getMorpheme, stripDashes } from '../../lib/content';
import type { Card, MatrixCell, TermGloss } from '../../lib/types';
import { MorphemeModal, TermModal } from './RefModal';

interface CardHandlers {
  openMorph: (form: string) => void;
  openTerm: (term: TermGloss) => void;
  showZh: boolean;
  toggleZh: () => void;
  openAnswer: number | null;
  toggleAnswer: (i: number) => void;
}

/** Renders any of the seven card kinds of a lesson. */
export function CardView({ card }: { card: Card }) {
  const [morphForm, setMorphForm] = useState<string | null>(null);
  const [term, setTerm] = useState<TermGloss | null>(null);
  const [showZh, setShowZh] = useState(false);
  const [openAnswer, setOpenAnswer] = useState<number | null>(null);

  const handlers: CardHandlers = {
    openMorph: setMorphForm,
    openTerm: setTerm,
    showZh,
    toggleZh: () => setShowZh((v) => !v),
    openAnswer,
    toggleAnswer: (i) => setOpenAnswer((cur) => (cur === i ? null : i)),
  };

  let body: ReactNode = null;

  switch (card.kind) {
    case 'text':
      body = (
        <>
          <MorphChips forms={card.morphemes ?? []} onOpen={handlers.openMorph} />
          <TermChips terms={card.terms} onOpen={handlers.openTerm} />
        </>
      );
      break;

    case 'etym': {
      const steps = card.steps ?? [];
      body = (
        <>
          {steps.length > 0 ? (
            <div style={{ marginTop: 20 }}>
              {steps.map((step, i) => {
                const last = i === steps.length - 1;
                return (
                  <div
                    key={`${step.period}-${i}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '16px 1fr',
                      gap: 12,
                      paddingBottom: last ? 0 : 18,
                      position: 'relative',
                    }}
                  >
                    {!last ? (
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          left: 7,
                          top: 16,
                          bottom: 0,
                          width: 1,
                          background: 'var(--line)',
                        }}
                      />
                    ) : null}
                    <span
                      className="dot"
                      aria-hidden
                      style={{ marginTop: 8, width: 9, height: 9, background: 'var(--accent)' }}
                    />
                    <div>
                      <div className="row wrap" style={{ gap: 8 }}>
                        <Badge tone="accent">{step.period}</Badge>
                        <span className="mono">{step.form}</span>
                      </div>
                      {step.note ? (
                        <div className="small muted" style={{ marginTop: 4 }}>
                          {step.note}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          <TermChips terms={card.terms} onOpen={handlers.openTerm} />
        </>
      );
      break;
    }

    case 'table':
      body = (
        <div className="scroll-x" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                {card.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {card.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className="small">
                      {cell}
                    </td>
                  ))}                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      break;

    case 'matrix':
      body = (
        <div style={{ marginTop: 18 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
              gap: 12,
              alignItems: 'center',
            }}
          >
            <div className="col" style={{ gap: 8 }}>
              <div className="tiny faint">前缀</div>
              {card.prefixes.length > 0 ? (
                card.prefixes.map((p, i) => <MorphTile key={`${p.text}-${i}`} cell={p} onOpen={handlers.openMorph} />)
              ) : (
                <span className="tiny faint">—</span>
              )}
            </div>
            <div className="matrix-base">{card.base}</div>
            <div className="col" style={{ gap: 8 }}>
              <div className="tiny faint">后缀</div>
              {card.suffixes.length > 0 ? (
                card.suffixes.map((s, i) => <MorphTile key={`${s.text}-${i}`} cell={s} onOpen={handlers.openMorph} />)
              ) : (
                <span className="tiny faint">—</span>
              )}
            </div>
          </div>

          <div className="tiny faint" style={{ marginTop: 14 }}>
            前缀（改变方向或否定）+ 词基（核心意义）+ 后缀（改变词性或语法）—— 点击任意词组查看拆解。
          </div>

          <div className="col" style={{ gap: 8, marginTop: 14 }}>
            {card.words.map((word) => (
              <MatrixWord key={word.w} word={word} base={card.base} />
            ))}
          </div>
        </div>
      );
      break;

    case 'sum':
      body = (
        <div className="col" style={{ gap: 14, marginTop: 18 }}>
          {card.sums.map((sum, i) => {
            const steps = explainSum(sum.parts, sum.result);
            return (
              <div key={`${sum.result}-${i}`} className="panel-flat">
                <div className="sum">
                  {sum.parts.map((part, j) => (
                    <Fragment key={`${part}-${j}`}>
                      {j > 0 ? <span className="sum-arrow">+</span> : null}
                      <span
                        className="morph"
                        role="button"
                        tabIndex={0}
                        onClick={() => handlers.openMorph(stripDashes(part))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handlers.openMorph(stripDashes(part));
                        }}
                      >
                        {part}
                      </span>
                    </Fragment>
                  ))}
                  <span className="sum-arrow">→</span>
                  <span className="sum-result">{sum.result}</span>
                </div>
                <div className="small" style={{ marginTop: 8 }}>
                  {sum.glossZh}
                </div>
                {sum.note ? (
                  <div className="tiny faint" style={{ marginTop: 4 }}>
                    {sum.note}
                  </div>
                ) : null}
                {steps.length > 0 ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="tiny faint" style={{ marginBottom: 4 }}>
                      拼写变化
                    </div>
                    <ul className="small muted" style={{ margin: 0, paddingLeft: '1.1em' }}>
                      {steps.map((step, k) => (
                        <li key={k}>
                          {step.rule}：<span className="mono">{step.before} → {step.after}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      );
      break;

    case 'compare':
      body = (
        <div className="scroll-x" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th aria-label="比较维度" />
                <th>{card.a}</th>
                <th>{card.b}</th>
              </tr>
            </thead>
            <tbody>
              {card.rows.map((row, i) => (
                <tr key={i}>
                  <td className="tiny faint" style={{ whiteSpace: 'nowrap' }}>
                    {row.label}
                  </td>
                  <td className="small">{row.a}</td>
                  <td className="small">{row.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      break;

    case 'passage':
      body = (
        <div style={{ marginTop: 18 }}>
          <div
            className="prose"
            lang="en"
            style={{
              fontFamily: 'var(--serif)',
              borderLeft: '3px solid var(--accent-soft)',
              paddingLeft: 16,
              fontStyle: 'normal',
            }}
          >
            <p>{card.excerpt}</p>
          </div>

          {card.glossZh ? (
            <div style={{ marginTop: 10 }}>
              <Button size="sm" variant="ghost" onClick={handlers.toggleZh}>
                {handlers.showZh ? '收起中文对照' : '显示中文对照'}
              </Button>
              {handlers.showZh ? (
                <div className="panel-flat small" style={{ marginTop: 8 }}>
                  {card.glossZh}
                </div>
              ) : null}
            </div>
          ) : null}

          {card.questions && card.questions.length > 0 ? (
            <div style={{ marginTop: 16 }}>
              <div className="tiny faint" style={{ marginBottom: 8 }}>
                先自己回答，再展开对照
              </div>
              <div className="col" style={{ gap: 8 }}>
                {card.questions.map((q, i) => (
                  <div key={i} className="panel-flat">
                    <div className="serif" lang="en" style={{ fontSize: 15 }}>
                      {q.q}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handlers.toggleAnswer(i)} style={{ marginTop: 4 }}>
                      {handlers.openAnswer === i ? '隐藏答案' : '显示答案'}
                    </Button>
                    {handlers.openAnswer === i ? (
                      <div className="small muted" style={{ marginTop: 4 }}>
                        {q.a}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      );
      break;
  }

  return (
    <article className="fade-in">
      <h2 style={{ marginBottom: 10 }}>{card.title}</h2>
      <RichText text={card.body} onMorpheme={(_m, form) => setMorphForm(form)} />
      {body}
      <MorphemeModal form={morphForm} onClose={() => setMorphForm(null)} />
      <TermModal term={term} onClose={() => setTerm(null)} />
    </article>
  );
}

function MorphTile({ cell, onOpen }: { cell: MatrixCell; onOpen: (form: string) => void }) {
  const form = stripDashes(cell.text);
  const known = Boolean(getMorpheme(form));
  return (
    <button
      type="button"
      className="morph-tile"
      title={cell.glossZh}
      onClick={() => onOpen(form)}
      style={{ opacity: known ? 1 : 0.72 }}
    >
      <span className="mono">{cell.text || '—'}</span>
      <span className="tiny faint" style={{ display: 'block', marginTop: 2 }}>
        {cell.glossZh}
      </span>
    </button>
  );
}

function MatrixWord({ word, base }: { word: { w: string; parts: string[]; glossZh: string }; base: string }) {
  const [open, setOpen] = useState(false);
  const baseIdx = word.parts.findIndex((p) => stripDashes(p) === stripDashes(base));
  const prefix = baseIdx > 0 ? word.parts.slice(0, baseIdx).join('') : '';
  const suffix = baseIdx >= 0 ? word.parts.slice(baseIdx + 1).join('') : '';
  const stem = baseIdx >= 0 ? base : (word.parts[0] ?? base);
  const built = buildWord(prefix, stem, suffix);
  const steps = built.word.toLowerCase() === word.w.toLowerCase() ? built.steps : [];

  return (
    <div
      className="panel-flat"
      role="button"
      tabIndex={0}
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
      style={{ cursor: 'pointer', borderColor: open ? 'var(--accent)' : 'var(--line)' }}
    >
      <div className="row-between" style={{ gap: 10 }}>
        <span className="word" style={{ fontSize: 17 }}>
          {word.w}
        </span>
        <span className="mono tiny faint">{formatWordSum(word.parts, word.w)}</span>
      </div>
      {open ? (
        <div style={{ marginTop: 8 }}>
          <div className="small">{word.glossZh}</div>
          {steps.length > 0 ? (
            <ul className="small muted" style={{ margin: '8px 0 0', paddingLeft: '1.1em' }}>
              {steps.map((step, i) => (
                <li key={i}>
                  {step.rule}：<span className="mono">{step.before} → {step.after}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="tiny faint" style={{ marginTop: 6 }}>
              直接拼接，无需改变拼写。
            </div>
          )}
          <div style={{ marginTop: 8 }}>
            <Badge tone={built.attested ? 'green' : 'default'}>
              {built.attested ? '词典已收录' : '结构合法，词典未收录'}
            </Badge>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MorphChips({ forms, onOpen }: { forms: string[]; onOpen: (form: string) => void }) {
  if (forms.length === 0) return null;
  return (
    <div className="row wrap" style={{ marginTop: 16, gap: 8 }}>
      <span className="tiny faint">词素</span>
      {forms.map((form) => {
        const morpheme = getMorpheme(form);
        return (
          <button key={form} type="button" className="chip" onClick={() => onOpen(stripDashes(form))}>
            <span className="mono">{form}</span>
            <span className="tiny faint">{morpheme ? morpheme.glossZh : '未收录'}</span>
          </button>
        );
      })}
    </div>
  );
}

function TermChips({ terms, onOpen }: { terms?: TermGloss[]; onOpen: (term: TermGloss) => void }) {
  if (!terms || terms.length === 0) return null;
  return (
    <div className="row wrap" style={{ marginTop: 16, gap: 8 }}>
      <span className="tiny faint">术语</span>
      {terms.map((term) => (
        <button key={term.term} type="button" className="chip" onClick={() => onOpen(term)}>
          <span className="serif">{term.term}</span>
          <span className="tiny faint">{term.zh}</span>
        </button>
      ))}
    </div>
  );
}
