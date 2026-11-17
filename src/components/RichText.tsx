import React, { useMemo } from 'react';
import { getMorpheme, stripDashes } from '../lib/content';
import type { Morpheme } from '../lib/types';

/**
 * Small markdown-lite renderer for course prose. Supported inline markup:
 *   **bold**  *italic*  `morpheme`  [[term|中文释义]]
 * Block level: blank-line paragraphs, "- " bullets, "1. " ordered items,
 * "### " sub-headings. No HTML is ever injected.
 */
export interface RichTextProps {
  text: string;
  onMorpheme?: (m: Morpheme | null, form: string) => void;
  className?: string;
}

type Token = { t: 'text' | 'bold' | 'italic' | 'morph' | 'gloss'; v: string; extra?: string };

function tokenize(line: string): Token[] {
  const tokens: Token[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[\[[^\]]+\]\])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) tokens.push({ t: 'text', v: line.slice(last, m.index) });
    const raw = m[0];
    if (raw.startsWith('**')) tokens.push({ t: 'bold', v: raw.slice(2, -2) });
    else if (raw.startsWith('`')) tokens.push({ t: 'morph', v: raw.slice(1, -1) });
    else if (raw.startsWith('[[')) {
      const inner = raw.slice(2, -2);
      const [term, gloss] = inner.split('|');
      tokens.push({ t: 'gloss', v: term, extra: gloss });
    } else tokens.push({ t: 'italic', v: raw.slice(1, -1) });
    last = m.index + raw.length;
  }
  if (last < line.length) tokens.push({ t: 'text', v: line.slice(last) });
  return tokens;
}

export function RichText({ text, onMorpheme, className }: RichTextProps) {
  const blocks = useMemo(() => text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean), [text]);

  return (
    <div className={`prose ${className ?? ''}`}>
      {blocks.map((block, bi) => {
        if (block.startsWith('### ')) {
          return (
            <h3 key={bi} style={{ margin: '1.1em 0 0.5em' }}>
              {block.slice(4)}
            </h3>
          );
        }
        const lines = block.split('\n');
        const isBullets = lines.every((l) => /^[-•]\s+/.test(l));
        const isOrdered = lines.every((l) => /^\d+[.)]\s+/.test(l));
        if (isBullets || isOrdered) {
          const items = lines.map((l, i) => (
            <li key={i}>{renderInline(l.replace(/^([-•]|\d+[.)])\s+/, ''), onMorpheme)}</li>
          ));
          return isBullets ? <ul key={bi}>{items}</ul> : <ol key={bi}>{items}</ol>;
        }
        return <p key={bi}>{renderInline(block, onMorpheme)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string, onMorpheme?: RichTextProps['onMorpheme']): React.ReactNode[] {
  return tokenize(text).map((tok, i) => {
    switch (tok.t) {
      case 'bold':
        return <strong key={i}>{tok.v}</strong>;
      case 'italic':
        return <em key={i}>{tok.v}</em>;
      case 'gloss':
        return (
          <span
            key={i}
            title={tok.extra}
            style={{ borderBottom: '1px dotted var(--ink-faint)', cursor: 'help' }}
          >
            {tok.v}
          </span>
        );
      case 'morph': {
        const m = getMorpheme(tok.v);
        const kind = m?.type === 'prefix' ? 'morph-prefix' : m?.type === 'suffix' ? 'morph-suffix' : '';
        return (
          <span
            key={i}
            className={`morph ${kind}`}
            role="button"
            tabIndex={0}
            onClick={() => onMorpheme?.(m ?? null, stripDashes(tok.v))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onMorpheme?.(m ?? null, stripDashes(tok.v));
            }}
          >
            {tok.v}
          </span>
        );
      }
      default:
        return <React.Fragment key={i}>{tok.v}</React.Fragment>;
    }
  });
}
