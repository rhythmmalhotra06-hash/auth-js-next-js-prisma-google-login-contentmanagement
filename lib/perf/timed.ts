// Server-side timing that survives the session.
//
// Every performance number this codebase has ever quoted ("4.4s of a 5.5s page", "seventeen
// seconds") was measured by hand once and then lost — the code kept the conclusion and threw
// away the instrument. This is the instrument. It writes one line per slow call to stdout, which
// is where `kessel runtime-logs --search perf` reads from, so a before/after is always a grep.
//
// Threshold-gated so a healthy page is silent: only calls at or over `PERF_LOG_MS` (default
// 100ms) are logged. Set `PERF_LOG_MS=0` to see everything, or a large number to mute.

const THRESHOLD_MS = Number(process.env.PERF_LOG_MS ?? 100);

/** Log one measurement. Exposed so callers with their own clock (the Airtable client) can use it. */
export function perfLog(label: string, ms: number, extra?: string): void {
  if (!(ms >= THRESHOLD_MS)) return;
  console.log(`[perf] ${label} ${Math.round(ms)}ms${extra ? ` ${extra}` : ''}`);
}

/** Run `fn`, log how long it took. A rejection is logged with a `!` marker and re-thrown. */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  let failed = false;
  try {
    return await fn();
  } catch (err) {
    failed = true;
    throw err;
  } finally {
    perfLog(failed ? `${label}!` : label, performance.now() - t0);
  }
}
