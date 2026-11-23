/**
 * The six-step inquiry panel for a family page (0.11.0).
 *
 * Thin renderer over `lib/family-inquiry`: all rules live there so they can be
 * tested. This file only decides what to show, when to advance, and how to
 * persist — persistence goes through `lib/inquiry-store` (SQLite on desktop),
 * never directly through localStorage.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import type { FamilyDossier } from '../../lib/content';
import { buildInquiry, checkSum, compareHypothesis, type InquiryStepId } from '../../lib/family-inquiry';
import {
  beginFamilyView,
  canAutosave,
  findProgress,
  loadInquiryAsync,
  markFamilyLoaded,
  saveInquiryAsync,
  toStepIds,
  type InquiryRecord,
  type InquiryViewState,
} from '../../lib/inquiry-store';
import { Badge, Button, Panel } from '../ui';

interface Props {
  dossier: FamilyDossier;
  familyId: string;
  known: (word: string) => boolean;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Answers are stored as booleans; anything else is dropped, not guessed. */
function verifyAnswersOf(record: InquiryRecord): Record<string, boolean> {
  const raw = record.picks.verify;
  const out: Record<string, boolean> = {};
  if (!isPlainRecord(raw)) return out;
  for (const [word, answer] of Object.entries(raw)) {
    if (typeof answer === 'boolean') out[word] = answer;
  }
  return out;
}

/** Sum inputs are strings; a hand-edited number must not crash the input. */
function sumInputsOf(record: InquiryRecord): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [word, sum] of Object.entries(record.sums)) {
    if (typeof sum === 'string') out[word] = sum;
  }
  return out;
}

export default function FamilyInquiry({ dossier, familyId, known }: Props) {
  // Which pass through this family, and which words have already been met. Both
  // live inside the record's `picks` JSON so no schema change is needed: a
  // second pass shows different members instead of repeating the same six.
  const [sessions, setSessions] = useState(0);
  const [seen, setSeen] = useState<string[]>([]);
  // How many times the learner changed an answer. Cheap to keep, and the only
  // signal we have for "thought again" versus "wrote once and moved on".
  const [revisions, setRevisions] = useState(0);
  const model = useMemo(
    () => buildInquiry(dossier, known, { session: sessions, explored: seen }),
    [dossier, known, sessions, seen],
  );
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<InquiryStepId[]>([]);
  const [hypothesis, setHypothesis] = useState('');
  const [guessPick, setGuessPick] = useState<string | null>(null);
  const [guessChecked, setGuessChecked] = useState(false);
  const [verifyAnswers, setVerifyAnswers] = useState<Record<string, boolean>>({});
  const [verifyChecked, setVerifyChecked] = useState(false);
  const [sumInputs, setSumInputs] = useState<Record<string, string>>({});
  const [sumResults, setSumResults] = useState<Record<string, boolean>>({});
  const [hintLevel, setHintLevel] = useState(0);

  // Which family the loaded data belongs to. A boolean here let family A's
  // `true` survive a fast switch and overwrite family B with A's answers.
  const [view, setView] = useState<InquiryViewState>(() => beginFamilyView(familyId));
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveError, setSaveError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [saveAttempt, setSaveAttempt] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    let cancelled = false;
    // Drop the previous family's state *before* awaiting the read: a slow disk
    // must never let A's step or hypothesis render (or be saved) under B.
    setView(beginFamilyView(familyId));
    setStep(0);
    setDone([]);
    setHypothesis('');
    setGuessPick(null);
    setGuessChecked(false);
    setVerifyAnswers({});
    setVerifyChecked(false);
    setSumInputs({});
    setSumResults({});
    setHintLevel(0);
    setSaveState('idle');
    setSaveError('');
    setLoadError('');
    startedAt.current = Date.now();

    loadInquiryAsync()
      .then((snapshot) => {
        if (cancelled) return;
        const saved = findProgress(snapshot, familyId);
        if (saved) {
          setStep(Math.min(saved.step, model.steps.length - 1));
          setDone(toStepIds(saved.done));
          setHypothesis(saved.hypothesis);
          setGuessPick(typeof saved.picks.discover === 'string' ? saved.picks.discover : null);
          setVerifyAnswers(verifyAnswersOf(saved));
          setSumInputs(sumInputsOf(saved));
          setHintLevel(Math.min(Math.max(0, saved.hints), model.hints.length));
          const savedSeen = saved.picks.seen;
          setSeen(Array.isArray(savedSeen) ? savedSeen.filter((w): w is string => typeof w === 'string') : []);
          setSessions(typeof saved.picks.sessions === 'number' ? saved.picks.sessions : 0);
          setRevisions(typeof saved.picks.revisions === 'number' ? saved.picks.revisions : 0);
        }
        // Marking loaded only for this family is what arms the autosave below.
        setView((current) => markFamilyLoaded(current, familyId));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Do not arm autosave: writing now would overwrite progress we failed
        // to read. The panel asks for a retry instead.
        setLoadError(errText(err));
      });

    return () => {
      cancelled = true;
    };
  }, [familyId, loadAttempt, model.steps.length, model.hints.length]);

  // Persist on every change rather than only on "next": a learner who answers a
  // step and closes the app should keep that answer. The write is debounced so
  // typing a hypothesis does not hammer SQLite.
  useEffect(() => {
    // `view` is read from the render that still belongs to the previous family;
    // require both to agree so a fast switch cannot schedule A's state under B.
    if (!canAutosave(view) || view.familyId !== familyId) return;
    const timer = window.setTimeout(() => {
      setSaveState('saving');
      const record = {
        familyId,
        step,
        done,
        hypothesis,
        picks: {
          discover: guessPick,
          verify: verifyAnswers,
          // Union, not replacement: leaving the first pass must not forget the
          // words met before it, or the next pass would repeat them.
          seen: [...new Set([...seen, ...model.observe.map((o) => o.w)])],
          sessions,
          revisions,
        },
        sums: sumInputs,
        hints: hintLevel,
        elapsedMs: Date.now() - startedAt.current,
      };
      saveInquiryAsync(record)
        .then(() => {
          setSaveState('saved');
          setSaveError('');
        })
        .catch((err: unknown) => {
          // A rejection is "not saved": never leave the success label up.
          setSaveState('error');
          setSaveError(errText(err));
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [
    view,
    familyId,
    step,
    done,
    hypothesis,
    guessPick,
    verifyAnswers,
    sumInputs,
    hintLevel,
    saveAttempt,
    // The record embeds which words were observed and which pass this is, so a
    // change there is a change to what must be stored.
    model.observe,
    seen,
    sessions,
    revisions,
  ]);

  const markDone = (id: InquiryStepId) => {
    if (!done.includes(id)) setDone([...done, id]);
  };

  /** Start another pass: keep what was met, drop this pass's answers. */
  const restart = () => {
    setSessions(sessions + 1);
    setStep(0);
    setDone([]);
    setHypothesis('');
    setGuessPick(null);
    setGuessChecked(false);
    setVerifyAnswers({});
    setVerifyChecked(false);
    setSumInputs({});
    setSumResults({});
    setHintLevel(0);
  };

  const advance = () => {
    markDone(model.steps[step].id);
    setStep(Math.min(step + 1, model.steps.length - 1));
  };

  const current = model.steps[step];
  const trapPick = model.traps[0]?.form;

  return (
    <Panel>
      <div className="row-between" style={{ alignItems: 'baseline', gap: 12 }}>
        <div>
          <h2 className="h2" style={{ margin: 0 }}>
            探究这一族
          </h2>
          <p className="small muted" style={{ margin: '4px 0 0' }}>
            先观察词形，自己提出假设，再用新词和反例检验。参考档案在下面，但先别打开。
          </p>
        </div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          {saveState === 'saving' ? <span className="tiny faint">保存中…</span> : null}
          {saveState === 'saved' ? <span className="tiny faint">已保存</span> : null}
          <Badge tone="accent">
            第 {step + 1} / {model.steps.length} 步
          </Badge>
        </div>
      </div>

      {loadError ? (
        <div className="callout" role="alert" style={{ marginTop: 10 }}>
          读不到已保存的探究进度：{loadError}。为避免覆盖旧记录，本次改动暂不会保存。
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <Button size="sm" onClick={() => setLoadAttempt((n) => n + 1)}>
              重试读取
            </Button>
          </div>
        </div>
      ) : null}

      {saveState === 'error' ? (
        <div className="callout" role="alert" style={{ marginTop: 10 }}>
          进度未保存：{saveError}。这次填写不算已保存，请重试。
          <div className="row" style={{ gap: 8, marginTop: 6 }}>
            <Button
              size="sm"
              onClick={() => {
                setSaveError('');
                setSaveAttempt((n) => n + 1);
              }}
            >
              重试保存
            </Button>
          </div>
        </div>
      ) : null}

      <div className="row" style={{ gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
        {model.steps.map((item, index) => (
          <button
            key={item.id}
            type="button"
            className={`btn btn-sm ${index === step ? 'btn-primary' : done.includes(item.id) ? 'btn-ghost' : 'btn-sm'}`}
            onClick={() => setStep(index)}
          >
            {done.includes(item.id) ? '✓ ' : ''}
            {item.title}
          </button>
        ))}
      </div>

      <h3 className="h3" style={{ marginTop: 16 }}>{current.title} {current.prompt}</h3>
      <p className="small">{current.action}</p>

      {current.id === 'observe' ? (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
            {model.observe.map((item) => (
              <span key={item.w} className="chip" style={{ padding: '4px 10px', border: '1px solid var(--line)', borderRadius: 999 }}>
                {item.w}
              </span>
            ))}
          </div>
          <p className="tiny faint">这里只给词形，不给切分和释义——那正是你要找的东西。</p>
        </>
      ) : null}

      {current.id === 'discover' ? (
        <>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap', margin: '10px 0' }}>
            {[...model.observe.map((o) => o.w), ...(trapPick ? [trapPick] : [])].map((word) => (
              <button
                key={word}
                type="button"
                className={`btn btn-sm ${guessPick === word ? 'btn-primary' : ''}`}
                onClick={() => {
                  setGuessPick(word);
                  setGuessChecked(false);
                }}
              >
                {word}
              </button>
            ))}
          </div>
          {guessChecked && guessPick ? (
            <div className="callout">
              {guessPick === trapPick ? (
                <>对了。<strong>{guessPick}</strong> 只是拼写像，来历不同：{model.traps[0]?.note}</>
              ) : (
                <>
                  不是它。<strong>{guessPick}</strong> 和这一族的关系是可解释的；再看一眼哪一个的"像"只在字母上。
                </>
              )}
            </div>
          ) : null}
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <Button size="sm" onClick={() => setGuessChecked(true)} disabled={!guessPick}>
              核对
            </Button>
          </div>
        </>
      ) : null}

      {current.id === 'hypothesize' ? (
        <>
          <textarea
            className="input"
            rows={2}
            placeholder="例如：表示「看」"
            value={hypothesis}
            onChange={(event) => {
              if (hypothesis && event.target.value !== hypothesis) setRevisions((n) => n + 1);
              setHypothesis(event.target.value);
            }}
            style={{ width: '100%', marginTop: 8 }}
          />
          {hypothesis.trim() ? (
            <div className="callout" style={{ marginTop: 8 }}>
              {(() => {
                const relation = compareHypothesis(hypothesis, model.rootSense);
                if (relation === 'close') return <>和参考义「{model.rootSense}」接近。带着它去第 ④ 步检验。</>;
                if (relation === 'related') return <>和参考义「{model.rootSense}」有关联，但措辞不同。先别说对错，去检验。</>;
                return <>你的说法「{hypothesis.trim()}」和参考义「{model.rootSense}」差得较远——但这不算错，去第 ④ 步看看它能不能解释那些词。</>;
              })()}
            </div>
          ) : null}
          <p className="tiny faint" style={{ marginTop: 6 }}>
            参考义不会自动判你"错"：同一个词根可以有好几种诚实的说法。
          </p>
        </>
      ) : null}

      {current.id === 'verify' ? (
        <>
          <ul className="list" style={{ marginTop: 8 }}>
            {model.verify.map((item) => (
              <li key={item.w} style={{ marginBottom: 8 }}>
                <code>{item.w}</code>{' '}
                <Button
                  size="sm"
                  variant={verifyAnswers[item.w] === true ? 'primary' : 'default'}
                  onClick={() => setVerifyAnswers({ ...verifyAnswers, [item.w]: true })}
                >
                  属于这一族
                </Button>{' '}
                <Button
                  size="sm"
                  variant={verifyAnswers[item.w] === false ? 'primary' : 'default'}
                  onClick={() => setVerifyAnswers({ ...verifyAnswers, [item.w]: false })}
                >
                  不属于
                </Button>
                {verifyChecked ? (
                  <div className="small" style={{ marginTop: 4 }}>
                    {verifyAnswers[item.w] === item.inFamily ? '✓ 判断成立。' : '✗ 再想一步。'}
                    {item.explain}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <Button size="sm" onClick={() => setVerifyChecked(true)} disabled={Object.keys(verifyAnswers).length < model.verify.length}>
            提交判断
          </Button>
        </>
      ) : null}

      {current.id === 'counterexample' ? (
        <ul className="list" style={{ marginTop: 8 }}>
          {(model.traps.length ? model.traps : [{ form: '（本例暂无）', note: '这一族没有可靠的同形反例，不编。' }]).map((trap) => (
            <li key={trap.form}>
              <strong>{trap.form}</strong>：{trap.note}
            </li>
          ))}
        </ul>
      ) : null}

      {current.id === 'summarize' ? (
        <>
          {model.sums.map((sum) => (
            <div key={sum.word} style={{ marginTop: 10 }}>
              <label className="small" htmlFor={`sum-${sum.word}`}>
                写出 <code>{sum.word}</code> 的 Word Sum（词素之间用 + 连接）
              </label>
              <div className="row" style={{ gap: 8, marginTop: 4 }}>
                <input
                  id={`sum-${sum.word}`}
                  className="input"
                  value={sumInputs[sum.word] ?? ''}
                  onChange={(event) => setSumInputs({ ...sumInputs, [sum.word]: event.target.value })}
                  placeholder="例如：in + spect + ion"
                  style={{ flex: 1 }}
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const result = checkSum(sumInputs[sum.word] ?? '', sum.accepted);
                    setSumResults({ ...sumResults, [sum.word]: result.ok });
                  }}
                >
                  核对
                </Button>
              </div>
              {sumResults[sum.word] === true ? (
                <p className="small" style={{ margin: '4px 0' }}>
                  ✓ 成立。{sum.accepted.length > 1 ? '这个式子还有别的合法写法，都被接受。' : ''}
                </p>
              ) : sumResults[sum.word] === false ? (
                <p className="small" style={{ margin: '4px 0' }}>
                  ✗ 还不对。提示：先划出前后缀，剩下的词根要在词库里能查到；参考写法之一：
                  <code>{sum.accepted[0].join(' + ')}</code>
                </p>
              ) : null}
            </div>
          ))}
          {model.matrix.length ? (
            <div style={{ marginTop: 12 }}>
              <p className="small faint">参考派生链（写完再看）：</p>
              <ul className="list">
                {model.matrix.map((chain) => (
                  <li key={chain.join('-')}>{chain.join(' → ')}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <div className="row-between" style={{ marginTop: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            上一步
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setHintLevel(Math.min(hintLevel + 1, model.hints.length));
            }}
          >
            给点提示
          </Button>
        </div>
        {step === model.steps.length - 1 ? (
          <Button size="sm" variant="primary" onClick={restart}>
            再探一次（第 {sessions + 2} 次，换一批词）
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            onClick={advance}
            disabled={
              (current.id === 'discover' && !guessChecked) || (current.id === 'verify' && !verifyChecked)
            }
          >
            下一步
          </Button>
        )}
      </div>

      {hintLevel > 0 ? (
        <ul className="list small" style={{ marginTop: 8 }}>
          {model.hints.slice(0, hintLevel).map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}
