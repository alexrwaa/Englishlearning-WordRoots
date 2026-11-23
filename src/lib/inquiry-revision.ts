/**
 * Save coordinator for the family-inquiry panel.
 *
 * The panel writes on every change. A naive `setTimeout(() => save(), 300)`
 * loses the last keystroke when the window closes inside that window, and two
 * overlapping writes can land out of order. This coordinator keeps three
 * invariants instead:
 *
 * 1. **Single flight per family.** At most one `save` call is in flight. A
 *    change made while it runs is *merged* into one "latest value" that is
 *    written once the current call settles — never a queue of every keystroke.
 * 2. **Revisions, not booleans.** Every change bumps `currentRevision`. A
 *    completed write only moves `savedRevision`, and the "saved" status is
 *    emitted only when `savedRevision === currentRevision`. A success callback
 *    for an older revision can therefore never light up "已保存".
 * 3. **A flush that does not wait for the debounce.** Window close, tab hide,
 *    family switch and unmount call `flush()`, which cancels the timer and
 *    starts the write immediately. Failures surface as `error` and are retried
 *    with the newest value, never reported as success.
 *
 * DOM-free on purpose: the component owns the 300 ms timing via the option,
 * and the tests drive it with fake timers.
 */

export type InquirySaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface InquirySaveInfo {
  status: InquirySaveStatus;
  /** Revision of the newest state the learner produced. */
  currentRevision: number;
  /** Highest revision the backend confirmed. */
  savedRevision: number;
  /** True while `savedRevision < currentRevision`. */
  pending: boolean;
  error: string;
}

export interface InquiryFlushResult extends InquirySaveInfo {
  /** Why the flush was requested (`unmount`, `beforeunload`, …). */
  reason: string;
}

export interface InquiryFlusherOptions<T> {
  /** Must reject when the backend did not acknowledge the write. */
  save: (payload: T, context: { revision: number }) => Promise<void>;
  /** Called on every status change; suppressed after `close()`. */
  onStatus?: (status: InquirySaveStatus, info: InquirySaveInfo) => void;
  /** Milliseconds to coalesce typing. Default 300. */
  debounceMs?: number;
  /**
   * Milliseconds before an in-flight write is treated as failed. Default 8000.
   * A late settlement of the abandoned attempt is ignored, so it can never
   * resurrect "saved" for a revision the learner has already moved past.
   */
  timeoutMs?: number;
  onLog?: (level: 'info' | 'warn' | 'error', message: string) => void;
}

export const INQUIRY_DEBOUNCE_MS = 300;

interface Waiter {
  revision: number;
  resolve: (result: InquiryFlushResult) => void;
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class InquiryFlusher<T> {
  private readonly save: InquiryFlusherOptions<T>['save'];
  private readonly onStatus: InquiryFlusherOptions<T>['onStatus'];
  private readonly onLog: InquiryFlusherOptions<T>['onLog'];
  private readonly debounceMs: number;
  private readonly timeoutMs: number;

  /** Newest state produced by the learner. Starts at 0 ("nothing yet"). */
  private current = 0;
  /** Highest revision the backend acknowledged. */
  private saved = 0;
  /** The newest value waiting to be written; only the last one is kept. */
  private pendingValue: T | null = null;

  private status: InquirySaveStatus = 'idle';
  private error = '';
  /** Set after a failure: a keystroke alone must not hammer a broken disk. */
  private paused = false;
  /** No new marks/status callbacks after close; the last write still finishes. */
  private disposed = false;
  private inFlight = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private waiters: Waiter[] = [];

  constructor(options: InquiryFlusherOptions<T>) {
    this.save = options.save;
    this.onStatus = options.onStatus;
    this.onLog = options.onLog;
    this.debounceMs = options.debounceMs ?? INQUIRY_DEBOUNCE_MS;
    this.timeoutMs = options.timeoutMs ?? 8000;
  }

  get currentRevision(): number {
    return this.current;
  }

  get savedRevision(): number {
    return this.saved;
  }

  get saveStatus(): InquirySaveStatus {
    return this.status;
  }

  get saveError(): string {
    return this.error;
  }

  hasUnsaved(): boolean {
    return this.saved < this.current;
  }

  snapshot(): InquirySaveInfo {
    return {
      status: this.status,
      currentRevision: this.current,
      savedRevision: this.saved,
      pending: this.hasUnsaved(),
      error: this.error,
    };
  }

  /**
   * Record a new state. Merges with any value already waiting: only the last
   * one is written, which is why ten fast keystrokes cost one write.
   */
  mark(payload: T): void {
    if (this.disposed) return;
    this.current += 1;
    this.pendingValue = payload;
    if (this.status !== 'error') {
      // Any change invalidates a previous "saved": show "saving" until the
      // backend confirms this revision.
      this.status = 'saving';
      this.emit();
    }
    this.schedule();
  }

  /** Retry after an error, writing the newest value (not the failed one). */
  retry(reason = 'retry'): Promise<InquiryFlushResult> {
    return this.flush(reason);
  }

  /**
   * Write now, bypassing the debounce. Resolves when the newest revision is
   * confirmed, or when the write reports failure.
   */
  flush(reason = 'flush'): Promise<InquiryFlushResult> {
    this.clearTimer();
    if (this.disposed) return Promise.resolve(this.result(reason));
    // An explicit flush (switch / unload / retry) is allowed to try again after
    // an error; an ordinary keystroke is not.
    this.paused = false;
    const target = this.current;

    if (!this.hasUnsaved()) {
      return Promise.resolve(this.result(reason));
    }

    const wait = new Promise<InquiryFlushResult>((resolve) => {
      this.waiters.push({
        revision: target,
        resolve: (result) => resolve({ ...result, reason }),
      });
    });
    void this.drain();
    return wait;
  }

  /**
   * Detach from the UI. Pending work still finishes (the component calls
   * `flush()` first); no further status callbacks or marks are accepted.
   */
  close(): void {
    this.clearTimer();
    this.disposed = true;
    this.settle();
  }

  private schedule(): void {
    this.clearTimer();
    if (this.paused || this.disposed) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.drain();
    }, this.debounceMs);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /**
   * Single-flight loop. It keeps writing as long as the learner moved on while
   * a call was running; only one call is ever in flight.
   */
  private async drain(): Promise<void> {
    if (this.inFlight) return;
    this.inFlight = true;
    try {
      while (this.hasUnsaved() && !this.paused) {
        const revision = this.current;
        const payload = this.pendingValue as T;
        this.status = 'saving';
        this.emit();
        this.attempts += 1;
        const attempt = this.attempts;
        try {
          await this.runAttempt(payload, revision);
        } catch (err) {
          // An attempt that timed out while a newer one exists has already
          // reported; only the live attempt may move the status.
          if (attempt !== this.attempts) break;
          this.error = errText(err);
          this.paused = true;
          this.status = 'error';
          this.emit();
          this.onLog?.(
            'error',
            `inquiry 保存失败（revision ${revision}/${this.current}）：${this.error}`,
          );
          break;
        }
        if (attempt !== this.attempts) break;
        this.saved = revision;
        this.error = '';
      }
      if (!this.hasUnsaved()) {
        this.pendingValue = null;
        if (this.current > 0) {
          this.status = 'saved';
          this.emit();
        }
      }
    } finally {
      this.inFlight = false;
      this.settle();
    }
  }

  /** One backend call, bounded by `timeoutMs`. Late settlement is ignored. */
  private runAttempt(payload: T, revision: number): Promise<void> {
    const call = this.save(payload, { revision });
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) return call;

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        const timeout = new Error(`保存超过 ${this.timeoutMs}ms 未完成`);
        timeout.name = 'InquirySaveTimeout';
        // Abandon the old promise: if it resolves later it must not be allowed
        // to mark this revision saved.
        void call.then(
          () => undefined,
          () => undefined,
        );
        reject(timeout);
      }, this.timeoutMs);

      call.then(
        () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve();
        },
        (err: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          reject(err);
        },
      );
    });
  }

  private settle(): void {
    if (this.waiters.length === 0) return;
    const waiting: Waiter[] = [];
    for (const waiter of this.waiters) {
      if (this.saved >= waiter.revision) {
        waiter.resolve(this.result(''));
      } else if (!this.inFlight && this.status === 'error') {
        waiter.resolve(this.result(''));
      } else {
        waiting.push(waiter);
      }
    }
    this.waiters = waiting;
  }

  private emit(): void {
    if (this.disposed) return;
    this.onStatus?.(this.status, this.snapshot());
  }

  private result(reason: string): InquiryFlushResult {
    return { ...this.snapshot(), reason };
  }
}
