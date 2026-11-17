/** Shared axis helpers for the hand-rolled SVG charts. */

/**
 * Round a data maximum up to a readable axis top.
 * Steps are chosen from {1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10} × 10^n so that
 * 60 minutes maps to 60, 12.7 maps to 15, and 3.2 maps to 4.
 */
export function niceMax(value: number): number {
  const v = Math.max(value, 0);
  if (v <= 1) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  const norm = v / mag;
  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  const step = steps.find((s) => norm <= s) ?? 10;
  return step * mag;
}

/** Compact tick text: integers stay integers, halves keep one decimal. */
export function tickText(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value >= 10 ? String(Math.round(value)) : value.toFixed(1);
}

/** "2026-11-17" → "11-17" for the x axis. */
export function shortDate(key: string): string {
  return key.slice(5);
}
