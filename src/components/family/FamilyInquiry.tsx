/**
 * The six-step inquiry panel for a family page (0.11.0).
 *
 * Thin renderer over `lib/family-inquiry`: all rules live there so they can be
 * tested. This file only decides what to show and when to advance.
 */
import { useEffect, useMemo, useState } from 'react';

import type { FamilyDossier } from '../../lib/content';
import {
  buildInquiry,
  checkSum,
  compareHypothesis,
  loadProgress,
  saveProgress,
  type InquiryStepId,
} from '../../lib/family-inquiry';
import { Badge, Button, Panel } from '../ui';

interface Props {
  dossier: FamilyDossier;
  familyId: string;
  known: (word: string) => boolean;
}

export default function FamilyInquiry({ dossier, familyId, known }: Props) {
  const model = useMemo(() => buildInquiry(dossier, known), [dossier, known]);
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

  useEffect(() => {
    const saved = loadProgress(familyId, window.localStorage);
    if (saved) {
      setStep(Math.min(saved.step, model.steps.length - 1));
      setDone(saved.done);
      setHypothesis(saved.hypothesis);
    }
  }, [familyId, model.steps.length]);

  const markDone = (id: InquiryStepId) => {
    const nextDone = done.includes(id) ? done : [...done, id];
    setDone(nextDone);
    saveProgress(familyId, { step, done: nextDone, hypothesis }, window.localStorage);
  };

  const advance = () => {
    const id = model.steps[step].id;
    markDone(id);
    const next = Math.min(step + 1, model.steps.length - 1);
    setStep(next);
    saveProgress(familyId, { step: next, done: done.includes(id) ? done : [...done, id], hypothesis }, window.localStorage);
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
        <Badge tone="accent">
          第 {step + 1} / {model.steps.length} 步
        </Badge>
      </div>

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
            onChange={(event) => setHypothesis(event.target.value)}
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
        <Button
          size="sm"
          variant="primary"
          onClick={advance}
          disabled={
            (current.id === 'discover' && !guessChecked) ||
            (current.id === 'verify' && !verifyChecked) ||
            step === model.steps.length - 1
          }
        >
          下一步
        </Button>
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
