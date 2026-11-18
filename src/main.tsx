import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { IS_TAURI, getInvoke, loadCoursePack } from './lib/api';
import { contentStatus, initContent } from './lib/content';
import { maybeRunSelftest } from './lib/selftest';

/**
 * Tell the Rust side that the frontend really mounted.
 *
 * The packaging smoke test asserts this file instead of "the process made a
 * database": a painted window and working IPC are the only proof that the
 * bundle, the router and the Tauri bridge all loaded inside WebView2. One frame
 * is waited so layout has happened and the counts are meaningful.
 *
 * Reporting must never break the UI, so every failure is a single console line.
 */
function reportMounted() {
  if (!IS_TAURI) return;
  const status = contentStatus();
  requestAnimationFrame(() => {
    void (async () => {
      try {
        const invoke = await getInvoke();
        await invoke('frontend_ready', {
          payload: {
            phase: 'mounted',
            route: location.hash || '#/',
            domNodes: document.querySelectorAll('*').length,
            textChars: (document.body.innerText || '').trim().length,
            navItems: document.querySelectorAll('a.nav-item').length,
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            contentSource: status.source,
            contentVersion: status.contentVersion,
            ts: Date.now(),
          },
        });
      } catch (err) {
        console.warn('[wordroots] frontend_ready report failed:', err);
      }
    })();
  });
}

/**
 * Mount exactly once, then report.
 *
 * `/course` and every session page read the shared `lessons` array, so the
 * external course pack has to be swapped in before the first render — after
 * mount it would leave the UI showing stale built-in data.
 */
function mount() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );

  reportMounted();

  // The harness may ask for a full interaction pass inside the real webview
  // (WORDROOTS_SELFTEST=1 -> app_info().selftest). It is fire-and-forget: the UI
  // stays usable and the result is reported back through `frontend_ready`.
  void maybeRunSelftest();
}

/** Never let a content upgrade delay the first paint for more than this. */
const CONTENT_LOAD_TIMEOUT_MS = 2500;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => resolve(value))
      .catch(() => resolve(null))
      .finally(() => clearTimeout(timer));
  });
}

/**
 * `initContent` swaps the in-memory curriculum for `courses/` next to the
 * executable (only when the pack's version and schema check out).
 *
 * The mount must happen even if the shell never answers: a hung IPC call must
 * not turn the window blank. So the load is bounded, and any failure falls back
 * to the built-in curriculum that was compiled into the bundle.
 */
async function boot() {
  if (IS_TAURI) {
    try {
      await withTimeout(initContent(loadCoursePack), CONTENT_LOAD_TIMEOUT_MS);
    } catch (err) {
      console.warn('[wordroots] content init failed, using built-in curriculum:', err);
    }
  }
  mount();
}

void boot();
