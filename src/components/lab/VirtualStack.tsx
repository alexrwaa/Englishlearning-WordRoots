/**
 * A small windowed list, written here instead of pulled in as a dependency.
 *
 * A word family can hold 60+ members and the derivation tree can nest three
 * levels deep; rendering all of them at once makes scrolling janky on a laptop.
 * The list keeps a fixed row height (the callers all use single-line rows, so
 * this is honest rather than a guess), renders only the rows inside the
 * viewport plus a couple of overscan rows, and positions them absolutely so the
 * scrollbar still reflects the full list.
 *
 * No measurement pass, no ResizeObserver storms: the window is derived from
 * `scrollTop` and the container's client height, both read on scroll (throttled
 * to one rAF) and on mount.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface VirtualWindow {
  start: number;
  end: number;
}

/** Pure window arithmetic, exported so it can be reasoned about (and tested). */
export function windowFor(count: number, scrollTop: number, viewport: number, rowHeight: number, overscan = 3): VirtualWindow {
  if (count <= 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const first = Math.floor(scrollTop / rowHeight) - overscan;
  const last = Math.ceil((scrollTop + Math.max(viewport, rowHeight)) / rowHeight) + overscan;
  const start = Math.max(0, first);
  const end = Math.min(count, Math.max(start + 1, last));
  return { start, end };
}

/** Above this many rows the list is windowed; below it, plain rendering is cheaper. */
export const VIRTUAL_THRESHOLD = 24;

export function VirtualStack({
  count,
  rowHeight,
  renderRow,
  height = 320,
  overscan = 3,
  label,
  className,
  showCount,
  footer,
}: {
  count: number;
  rowHeight: number;
  renderRow: (index: number) => ReactNode;
  /** Max height of the scroll viewport, in px. */
  height?: number;
  overscan?: number;
  label?: string;
  className?: string;
  /** Print "窗口内渲染 x / y 项" under the list — the trade-off stays visible. */
  showCount?: boolean;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(height);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setViewport(el.clientHeight || height);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [height]);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // A shorter list can leave the container scrolled past the end; snap back so
  // the window maths cannot point at rows that no longer exist.
  useEffect(() => {
    const el = ref.current;
    if (el && el.scrollTop > Math.max(0, count * rowHeight - viewport)) el.scrollTop = 0;
  }, [count, rowHeight, viewport]);

  if (count <= 0) return null;

  const windowed = count > VIRTUAL_THRESHOLD;
  const { start, end } = windowed ? windowFor(count, scrollTop, viewport, rowHeight, overscan) : { start: 0, end: count };

  return (
    <div className={`vstack-wrap ${className ?? ''}`}>
      <div
        ref={ref}
        className="vstack"
        style={windowed ? { maxHeight: height, overflowY: 'auto' } : undefined}
        data-virtual-count={end - start}
        data-virtual-total={count}
        aria-label={label}
        onScroll={
          windowed
            ? (e) => {
                const next = e.currentTarget.scrollTop;
                if (frame.current) return;
                frame.current = requestAnimationFrame(() => {
                  frame.current = 0;
                  setScrollTop(next);
                });
              }
            : undefined
        }
      >
        {windowed ? (
          <div style={{ height: count * rowHeight, position: 'relative' }}>
            {Array.from({ length: end - start }, (_, i) => {
              const index = start + i;
              return (
                <div
                  key={index}
                  style={{ position: 'absolute', top: index * rowHeight, left: 0, right: 0, height: rowHeight }}
                >
                  {renderRow(index)}
                </div>
              );
            })}
          </div>
        ) : (
          Array.from({ length: count }, (_, index) => (
            <div key={index} style={{ minHeight: rowHeight }}>
              {renderRow(index)}
            </div>
          ))
        )}
        {footer}
      </div>
      {showCount ? (
        <div className="tiny faint vstack-count">
          {windowed ? `窗口内渲染 ${end - start} / ${count} 项（其余随滚动进入）` : `${count} 项，全部渲染`}
        </div>
      ) : null}
    </div>
  );
}
