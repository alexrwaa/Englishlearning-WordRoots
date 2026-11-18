import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMorpheme } from '../../lib/content';
import { affixRole, deriveFrom } from '../../lib/derive';
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

/** The one morpheme `big` has that `small` does not, when the difference is a single affix. */
function extraPart(small: string[], big: string[]): string | undefined {
  for (let i = 0; i < big.length; i += 1) {
    const rest = [...big.slice(0, i), ...big.slice(i + 1)];
    if (rest.length === small.length && rest.every((part, j) => part === small[j])) return big[i];
  }
  return undefined;
}

/**
 * A derivation tree, not a list. An edge exists only when the engine can spell
 * the child from the parent by adding exactly the one morpheme that differs
 * (checked against the dictionary), so the tree is made of real derivations.
 * Several paths can be valid (`unhelpfulness` is both un+helpful+ness and
 * helpful+ness with un-); the tree shows one, the matrix shows the applied one.
 */
export function buildFamilyTree(entries: WordEntry[], dictionary?: Set<string>): FamilyNode[] {
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
      if (candidate.w === entry.w) continue;
      if (candidate.parts.length !== entry.parts.length - 1) continue;
      if (!isSubsequence(candidate.parts, entry.parts)) continue;
      const extra = extraPart(candidate.parts, entry.parts);
      if (!extra) continue;
      if (dictionary) {
        const add = affixRole(extra) === 'prefix' ? `${extra}-` : `-${extra}`;
        const derived = deriveFrom(candidate.w, [add], dictionary);
        if (!derived.valid || derived.word !== entry.w) continue;
      }
      parent = nodes.get(candidate.w);
      break;
    }
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

export function FamilyTree({ entries, dictionary }: { entries: WordEntry[]; dictionary?: Set<string> }) {
  const roots = useMemo(() => buildFamilyTree(entries, dictionary), [entries, dictionary]);
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
