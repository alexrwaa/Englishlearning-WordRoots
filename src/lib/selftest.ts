/**
 * In-app interaction self-test.
 *
 * The packaging smoke test used to accept "the exe wrote a database file" as a
 * pass, which proved nothing about the UI: a blank webview still creates the
 * DB. When the harness starts the app with `WORDROOTS_SELFTEST=1`, the Rust
 * `app_info` command reports `selftest: true` and this module drives a real
 * lesson inside the real WebView2 — clicking choices, submitting answers,
 * advancing stages — then reports what actually happened back through
 * `frontend_ready({ phase: 'selftest' })`.
 *
 * Design constraints:
 * - never reload the page (the proof must come from one live document);
 * - never block or break the product UI (everything is guarded);
 * - never swallow a failure (an exception is reported as `ok: false, fatal`).
 */
import { call, db, getInvoke, IS_TAURI, type AppInfo } from './api';
import { contentStatus } from './content';

const LESSON_ROUTE = '#/session/w01d1';
const MAX_STEPS = 160;
const STEP_MIN_MS = 120;
const STEP_MAX_MS = 200;
const RENDER_TIMEOUT_MS = 15_000;
const STUCK_LIMIT = 8;
const MAX_ERRORS = 10;

export interface SelftestResult {
  ok: boolean;
  steps: number;
  attemptsBefore: number;
  attemptsAfter: number;
  completedBefore: number;
  completedAfter: number;
  sawFeedback: boolean;
  errors: string[];
  /** Unhandled promise rejections: recorded for diagnosis, never fail `ok`. */
  warnings: string[];
  elapsedMs: number;
  finalRoute: string;
  /** Where the curriculum came from, so CI can prove the course pack applied. */
  contentSource: 'embedded' | 'external';
  contentVersion: string;
  fatal?: string;
  /* Paint evidence, so a single report covers "rendered" and "interactive". */
  domNodes?: number;
  textChars?: number;
  navItems?: number;
  viewport?: string;
  ts?: number;
}

type AppInfoWithSelftest = AppInfo & { selftest?: boolean; webviewArgs?: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function stepDelay(): Promise<void> {
  return sleep(STEP_MIN_MS + Math.random() * (STEP_MAX_MS - STEP_MIN_MS));
}

async function waitFor<T>(probe: () => T | null, timeoutMs: number, intervalMs = 100): Promise<T | null> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = probe();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await sleep(intervalMs);
  }
}

/** React listens on the root, so a native click through `.click()` is enough. */
function clickElement(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  el.click();
  return true;
}

/** Assign through the prototype setter so React's onChange sees the change. */
function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function submitForm(input: HTMLInputElement): boolean {
  const form = input.closest('form');
  if (form) {
    form.requestSubmit();
    return true;
  }
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return false;
}

/** A cheap fingerprint of the current screen, used to detect a frozen UI. */
function screenSignature(): string {
  const main = (document.querySelector('.main') ?? document.body) as HTMLElement;
  const states = Array.from(document.querySelectorAll('[data-state]'))
    .map((el) => el.getAttribute('data-state'))
    .join(',');
  return [
    location.hash,
    (main.innerText || '').trim().length,
    document.querySelectorAll('button').length,
    document.querySelectorAll('.feedback').length,
    states,
  ].join('|');
}

function isSummaryScreen(): boolean {
  const eyebrow = document.querySelector('.main .eyebrow') ?? document.querySelector('.page-narrow .eyebrow');
  return Boolean(eyebrow && /小结/.test(eyebrow.textContent ?? ''));
}

function paintEvidence() {
  return {
    domNodes: document.querySelectorAll('*').length,
    textChars: (document.body.innerText || '').trim().length,
    navItems: document.querySelectorAll('a.nav-item').length,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    ts: Date.now(),
  };
}

/** Proof that the course pack next to the exe was actually applied. */
function contentEvidence() {
  const status = contentStatus();
  return { contentSource: status.source, contentVersion: status.contentVersion };
}

/**
 * Drive one lesson to completion. Returns the raw measurements; the caller
 * decides `ok` so a crash can still be reported with partial data.
 */
async function driveLesson(): Promise<{
  steps: number;
  sawFeedback: boolean;
  attemptsBefore: number;
  attemptsAfter: number;
  completedBefore: number;
  completedAfter: number;
}> {
  const totalsBefore = await db.totals();
  const statesBefore = await db.lessonStates();
  // lessonsCompleted comes from the totals query, the per-lesson rows are the
  // source of truth for "did a lesson actually finish".
  const completedBefore = statesBefore.filter((s) => s.status === 'completed').length;
  const attemptsBefore = totalsBefore.attempts ?? 0;

  // The provider loads settings/state before `Shell` renders the nav. Navigating
  // earlier would land on the "正在打开学习数据" placeholder and never recover.
  const shellReady = await waitFor(() => document.querySelector('a.nav-item'), 20_000);
  if (!shellReady) throw new Error('app shell did not render (no a.nav-item)');

  location.hash = LESSON_ROUTE;

  const firstControl = await waitFor(
    () => document.querySelector('.choice') ?? document.querySelector('.btn-primary:not([disabled])'),
    RENDER_TIMEOUT_MS,
  );
  if (!firstControl) throw new Error(`lesson did not render within ${RENDER_TIMEOUT_MS}ms`);

  let steps = 0;
  let sawFeedback = false;
  let stuck = 0;
  let previous = screenSignature();

  while (steps < MAX_STEPS) {
    if (isSummaryScreen()) break;

    steps += 1;

    const choice = document.querySelector('.choice:not([disabled])') as HTMLElement | null;
    if (choice) {
      clickElement(choice);
      await sleep(80);
    } else {
      const input = document.querySelector('input.input:not([disabled])') as HTMLInputElement | null;
      if (input) {
        typeInto(input, 'zzz');
        await sleep(60);
        submitForm(input);
        await sleep(80);
      }
    }

    // The footer primary button advances (and, for choice items, submits).
    clickElement(document.querySelector('button.btn-primary:not([disabled])'));

    await stepDelay();

    if (document.querySelector('.feedback')) sawFeedback = true;

    const current = screenSignature();
    if (current === previous) {
      stuck += 1;
      if (stuck >= STUCK_LIMIT) {
        throw new Error(`UI stopped responding for ${STUCK_LIMIT} consecutive steps at step ${steps}`);
      }
    } else {
      stuck = 0;
    }
    previous = current;
  }

  // Writes are async (`recordAttempt` / `saveLessonState`); let them land.
  await sleep(900);
  const totalsAfter = await db.totals();
  const statesAfter = await db.lessonStates();
  const completedAfter = statesAfter.filter((s) => s.status === 'completed').length;

  return {
    steps,
    sawFeedback,
    attemptsBefore,
    attemptsAfter: totalsAfter.attempts ?? 0,
    completedBefore,
    completedAfter,
  };
}

async function report(payload: Record<string, unknown>) {
  const invoke = await getInvoke();
  await invoke('frontend_ready', { payload });
}

async function run(): Promise<SelftestResult> {
  const startedAt = performance.now();
  const errors: string[] = [];
  // Unhandled rejections are recorded but do not fail the run: a background
  // save can reject for a harmless reason (e.g. a toast race) while the lesson
  // still works, and the `ok` gate must mean "the UI broke".
  const warnings: string[] = [];
  const collect = (message: string) => {
    if (errors.length < MAX_ERRORS) errors.push(message);
  };

  const onError = (event: ErrorEvent) => {
    // Resource-load noise has neither a message nor an error object.
    if (!event.message && !event.error) return;
    collect(`${event.message} @ ${event.filename}:${event.lineno}`);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    if (warnings.length >= MAX_ERRORS) return;
    const reason = event.reason as { message?: string } | undefined;
    warnings.push(`unhandled rejection: ${reason?.message ?? String(event.reason)}`);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);

  let steps = 0;
  let sawFeedback = false;
  let attemptsBefore = 0;
  let attemptsAfter = 0;
  let completedBefore = 0;
  let completedAfter = 0;
  let fatal: string | undefined;

  try {
    const measured = await driveLesson();
    ({ steps, sawFeedback, attemptsBefore, attemptsAfter, completedBefore, completedAfter } = measured);
  } catch (err) {
    fatal = err instanceof Error ? err.message : String(err);
    // Even on a crash, try to read the counters so the report is diagnosable.
    try {
      const totals = await db.totals();
      attemptsAfter = totals.attempts ?? 0;
      completedAfter = totals.lessonsCompleted;
    } catch {
      /* the data layer itself is broken; the fatal message says so */
    }
  } finally {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  }

  // Leave the lesson so a screenshot or a following check sees the home page.
  location.hash = '#/';
  await sleep(350);

  const result: SelftestResult = {
    ok: !fatal && errors.length === 0 && attemptsAfter > attemptsBefore,
    steps,
    attemptsBefore,
    attemptsAfter,
    completedBefore,
    completedAfter,
    sawFeedback,
    errors,
    warnings,
    elapsedMs: Math.round(performance.now() - startedAt),
    finalRoute: location.hash || '#/',
    ...contentEvidence(),
    ...(fatal ? { fatal } : {}),
    ...paintEvidence(),
  };
  return result;
}

/**
 * Entry point called once from `main.tsx`. No-op outside Tauri and when the
 * harness did not request a self-test, so normal launches pay nothing.
 */
export async function maybeRunSelftest(): Promise<void> {
  if (!IS_TAURI) return;
  let enabled = false;
  try {
    const info = await call<AppInfoWithSelftest>('app_info');
    enabled = info?.selftest === true;
  } catch (err) {
    console.warn('[wordroots] selftest: app_info unavailable:', err);
    return;
  }
  if (!enabled) return;

  let result: SelftestResult;
  try {
    result = await run();
  } catch (err) {
    result = {
      ok: false,
      steps: 0,
      attemptsBefore: 0,
      attemptsAfter: 0,
      completedBefore: 0,
      completedAfter: 0,
      sawFeedback: false,
      errors: [],
      warnings: [],
      elapsedMs: 0,
      contentSource: contentStatus().source,
      contentVersion: contentStatus().contentVersion,
      finalRoute: location.hash || '#/',
      fatal: `selftest crashed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  try {
    await report({ phase: 'selftest', ...result });
  } catch (err) {
    console.error('[wordroots] selftest: could not report result:', err, result);
  }
}
