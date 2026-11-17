import { useMemo } from 'react';
import { useApp } from '../../lib/store';
import { getConcept, getMorpheme } from '../../lib/content';
import { formatWordSum } from '../../lib/morph';
import type { WordEntry } from '../../lib/types';
import { Badge, Button, Panel, SectionHead } from '../ui';
import { RichText } from '../RichText';
import { FamilyList } from './FamilyList';
import { NoteEditor } from './NoteEditor';
import { PartChips, SourceList, domainLabel, posLabel } from './tokens';

const CONCEPT_KIND_LABELS = { concept: '概念', rule: '规则', method: '方法' } as const;

export function EntryDetail({
  entry,
  onPickMorpheme,
  onPickConcept,
}: {
  entry: WordEntry;
  onPickMorpheme: (form: string) => void;
  onPickConcept: (id: string) => void;
}) {
  const { bookmarks, notes, toggleBookmark, toast } = useApp();
  const bookmarked = bookmarks.some((b) => b.targetType === 'word' && b.targetId === entry.w);
  const hasNote = notes.some((n) => n.targetType === 'word' && n.targetId === entry.w);

  const conceptTags = useMemo(() => (entry.tags ?? []).filter((t) => t.startsWith('c-')), [entry.tags]);
  const plainTags = useMemo(() => (entry.tags ?? []).filter((t) => !t.startsWith('c-')), [entry.tags]);

  const toggle = async () => {
    try {
      const added = await toggleBookmark('word', entry.w);
      toast(added ? `已收藏 ${entry.w}` : `已取消收藏 ${entry.w}`, added ? 'success' : 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : '收藏操作失败', 'warn');
    }
  };

  return (
    <div>
      <div className="page-head" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div className="eyebrow">词条</div>
          <h1
            className="serif"
            style={{
              fontSize: 'calc(clamp(30px, 7vw, 44px) * var(--font-scale))',
              fontStyle: 'italic',
              lineHeight: 1.1,
              overflowWrap: 'anywhere',
            }}
          >
            {entry.w}
          </h1>
          <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
            {entry.pos ? <Badge tone="accent">{posLabel(entry.pos)}</Badge> : null}
            {entry.domain ? <Badge>{domainLabel(entry.domain)}</Badge> : null}
            {plainTags.map((tag) => {
              const m = getMorpheme(tag);
              if (!m) return <Badge key={tag}>{tag}</Badge>;
              return (
                <button
                  key={tag}
                  type="button"
                  className="chip"
                  style={{ padding: '2px 9px' }}
                  onClick={() => onPickMorpheme(tag)}
                  title={`${m.form} · ${m.glossZh}`}
                >
                  <span className="mono tiny">{m.form}</span>
                  <span className="tiny faint">{m.glossZh}</span>
                </button>
              );
            })}
          </div>
          <p className="lede" style={{ margin: '12px 0 0' }}>
            {entry.glossZh}
          </p>
          {entry.glossEn ? (
            <p
              className="small"
              style={{ margin: '4px 0 0', fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-soft)' }}
            >
              {entry.glossEn}
            </p>
          ) : null}
        </div>
        <div className="row" style={{ gap: 8, flex: 'none', flexWrap: 'wrap' }}>
          <Button variant={bookmarked ? 'primary' : 'default'} aria-pressed={bookmarked} onClick={() => void toggle()}>
            {bookmarked ? '★ 已收藏' : '☆ 收藏'}
          </Button>
          <Button
            variant="ghost"
            onClick={() => document.getElementById('word-note')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            {hasNote ? '查看笔记' : '写笔记'}
          </Button>
        </div>
      </div>

      <SectionHead title="词素拆解" hint="点击任一词素查看释义、变体与来源" />
      <Panel flat>
        {entry.parts.length > 0 ? (
          <>
            <div className="row wrap" style={{ gap: 6, alignItems: 'center', marginBottom: 12 }}>
              <span className="sum">{formatWordSum(entry.parts)}</span>
              <span className="sum-arrow">→</span>
              <span className="sum-result mono">{entry.w}</span>
            </div>
            <PartChips parts={entry.parts} onPick={onPickMorpheme} />
          </>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            该词条未提供词素拆解。
          </p>
        )}
        <p className="tiny faint" style={{ margin: '12px 0 0' }}>
          拆解反映的是构词结构，不等于现代词义的推导过程；两者不一致时，请以下方词源说明为准。
        </p>
      </Panel>

      <SectionHead title="词源" hint="只展示有来源支持的记载" />
      {entry.ety ? (
        <Panel flat>
          <div className="grid grid-2" style={{ gap: 12 }}>
            <div>
              <div className="tiny faint">来源形式</div>
              <div className="serif" style={{ fontSize: 17 }}>
                {entry.ety.from ?? '暂无记载'}
              </div>
            </div>
            <div>
              <div className="tiny faint">最早文献记载</div>
              <div style={{ fontSize: 15 }}>{entry.ety.firstAttested ?? '暂无记载'}</div>
            </div>
          </div>
          {entry.ety.note ? (
            <div
              className="feedback"
              style={{
                marginTop: 14,
                background: 'var(--amber-soft)',
                borderColor: 'color-mix(in srgb, var(--amber) 30%, transparent)',
              }}
            >
              <div className="title" style={{ color: 'var(--amber)' }}>
                现代义与历史来源
              </div>
              <RichText text={entry.ety.note} className="small" />
            </div>
          ) : null}
          <div style={{ marginTop: 14 }}>
            <SourceList sources={entry.ety.sources} />
          </div>
        </Panel>
      ) : (
        <Panel flat style={{ borderStyle: 'dashed' }}>
          <div className="row" style={{ gap: 10 }}>
            <Badge tone="amber">词源未收录</Badge>
            <strong className="small">本词条暂未收录可靠词源</strong>
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>
            只有词源有可核对的来源时我们才会写入。没有来源的“故事”一律不展示，也不用词素的字面义倒推现代词义。
          </p>
        </Panel>
      )}

      <SectionHead title="同族词" hint="与本词共享任一词素" />
      <Panel flat>
        <FamilyList entry={entry} />
      </Panel>

      {conceptTags.length > 0 ? (
        <>
          <SectionHead title="相关概念" hint="课程中讲授的规则或方法" />
          <div className="grid grid-2">
            {conceptTags.map((id) => {
              const c = getConcept(id);
              if (!c) {
                return (
                  <Panel key={id} flat>
                    <div className="row" style={{ gap: 8, marginBottom: 4 }}>
                      <Badge tone="amber">概念未收录</Badge>
                      <span className="mono small">{id}</span>
                    </div>
                    <p className="tiny faint" style={{ margin: 0 }}>
                      这个词条标记了该概念，但词典还没有它的说明。
                    </p>
                  </Panel>
                );
              }
              return (
                <button
                  key={id}
                  type="button"
                  className="panel-flat"
                  onClick={() => onPickConcept(id)}
                  style={{ textAlign: 'left', cursor: 'pointer', width: '100%', font: 'inherit', color: 'inherit' }}
                >
                  <div className="row-between" style={{ marginBottom: 4, gap: 10 }}>
                    <strong>{c.zh}</strong>
                    <Badge tone="accent">{CONCEPT_KIND_LABELS[c.kind]}</Badge>
                  </div>
                  <div className="tiny faint" style={{ fontFamily: 'var(--serif)', fontStyle: 'italic' }}>
                    {c.en}
                  </div>
                  <p className="small muted" style={{ margin: '6px 0 0' }}>
                    {c.summary}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      ) : null}

      <SectionHead title="笔记" hint="只保存在本地数据目录；支持编辑与删除" />
      <Panel flat>
        <div id="word-note">
          <NoteEditor targetType="word" targetId={entry.w} />
        </div>
      </Panel>
    </div>
  );
}
