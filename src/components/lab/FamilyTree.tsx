import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMorpheme } from '../../lib/content';
import type { WordEntry } from '../../lib/types';
import { POS_LABEL } from '../matrix/model';

export interface FamilyNode {
  entry: WordEntry;
  children: FamilyNode[];
}

function isSubsequence(small: string[], big: string[]): boolean {
  let i = 0;
  for (const part of big) {
    if (i < small.length && part === small[i]) i += 1;
  }
  return i === small.length;
}

/**
 * A real derivation tree, not a list: every word hangs under the longest listed
 * word whose morphemes it contains in order. Several paths can be valid
 * (`unhelpfulness` is both un+helpful+ness and helpful+ness with un-), so the
 * tree shows one attestation and the matrix chain shows the applied path.
 */
export function buildFamilyTree(entries: WordEntry[]): FamilyNode[] {
  const sorted = [...entries].sort(
    (a, b) => a.parts.length - b.parts.length || a.w.localeCompare(b.w),
  );
  const nodes = new Map<string, FamilyNode>();
  for (const entry of sorted) nodes.set(entry.w, { entry, children: [] });

  const roots: FamilyNode[] = [];
  for (const entry of sorted) {
    const node = nodes.get(entry.w)!;
    let parent: FamilyNode | undefined;
    for (const candidate of sorted) {
      if (candidate === entry) continue;
      if (candidate.parts.length >= entry.parts.length) continue;
      if (!isSubsequence(candidate.parts, entry.parts)) continue;
      const candidateNode = nodes.get(candidate.w);
      if (!candidateNode) continue;
      if (!parent || candidate.parts.length > parent.entry.parts.length) parent = candidateNode;
    }
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function FamilyTree({ entries }: { entries: WordEntry[] }) {
  const roots = useMemo(() => buildFamilyTree(entries), [entries]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = (word: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });

  if (roots.length === 0) {
    return (
      <p className="small faint" style={{ margin: 0 }}>
        这个词族还没有可展示的派生层次。
      </p>
    );
  }

  function render(nodes: FamilyNode[], level: number) {
    return (
      <ul className="lab-tree" style={{ marginLeft: level === 0 ? 0 : 14 }}>
        {nodes.map((node) => {
          const hasChildren = node.children.length > 0;
          const isCollapsed = collapsed.has(node.entry.w);
          return (
            <li key={node.entry.w} className="lab-tree-node">
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'baseline' }}>
                {hasChildren ? (
                  <button
                    type="button"
                    className="lab-tree-toggle"
                    aria-expanded={!isCollapsed}
                    aria-label={`${isCollapsed ? '展开' : '折叠'} ${node.entry.w} 的下层`}
                    onClick={() => toggle(node.entry.w)}
                  >
                    {isCollapsed ? '▸' : '▾'}
                  </button>
                ) : (
                  <span className="lab-tree-toggle" aria-hidden>
                    ·
                  </span>
                )}
                <Link to={`/word/${node.entry.w}`} className="word" style={{ fontSize: 15 }}>
                  {node.entry.w}
                </Link>
                {node.entry.pos ? <span className="tiny faint">{POS_LABEL[node.entry.pos] ?? node.entry.pos}</span> : null}
                <span className="tiny muted">{node.entry.glossZh}</span>
              </div>
              <div className="tiny faint mono" style={{ paddingLeft: 20, marginTop: 2 }}>
                {node.entry.parts
                  .map((p) => {
                    const m = getMorpheme(p);
                    return m ? `${p}（${m.glossZh}）` : p;
                  })
                  .join(' + ')}
              </div>
              {hasChildren && !isCollapsed ? render(node.children, level + 1) : null}
            </li>
          );
        })}
      </ul>
    );
  }

  return <div>{render(roots, 0)}</div>;
}
