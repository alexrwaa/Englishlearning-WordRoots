/** Small formatting helpers shared by the session screens. */
import { DAY } from '../../lib/fsrs';

/** "8 分 20 秒" / "45 秒" */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} 秒`;
  if (seconds === 0) return `${minutes} 分钟`;
  return `${minutes} 分 ${seconds} 秒`;
}

/** "12:04" — ticking clock in the session header. */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

/** "现在" / "3 小时后" / "3 天后" — next review estimate from a due timestamp. */
export function relativeDue(due: number, now = Date.now()): string {
  const diff = due - now;
  if (diff <= 60_000) return '现在';
  if (diff < DAY) {
    const hours = Math.max(1, Math.round(diff / 3_600_000));
    return `${hours} 小时后`;
  }
  const days = diff / DAY;
  if (days < 30) return `${Math.round(days)} 天后`;
  if (days < 365) return `${Math.round(days / 30)} 个月后`;
  return `${(days / 365).toFixed(1)} 年后`;
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
