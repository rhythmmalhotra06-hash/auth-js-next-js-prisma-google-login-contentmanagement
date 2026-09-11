// The one rate limiter for every Airtable request in the process.
//
// ── WHAT IT REPLACED, AND WHY ────────────────────────────────────────────────────────────────
//
// The previous client had a serial queue: one request in flight for the WHOLE process, a 200ms
// gap between starts, shared across every base. `drain()` awaited each fetch to completion before
// starting the next, so a request cost 200ms + a full US round trip (~0.4–0.8s from
// asia-southeast1) and nothing overlapped. Every `Promise.all` over Airtable reads in the repo —
// and there are several whose comments promise parallelism — was quietly sequential.
//
// Airtable's limit is 5 requests per second PER BASE. The app reads from two bases. So the old
// queue threw away roughly ten requests per second of budget, and with it about 4× of page speed
// on any surface that fans out.
//
// ── WHAT THIS DOES ───────────────────────────────────────────────────────────────────────────
//
// A sliding-window limiter keyed by base: a request may START when fewer than `PER_BASE_RPS`
// requests for that base have started in the last second. It does not wait for completion, so
// several are in flight at once. A small global cap keeps a pathological fan-out from opening
// dozens of sockets on a Cloud Run instance with one vCPU.
//
// Both clients — `rest.ts` (the canonical one) and `client.ts` (the older intake/reference lane,
// which had its own 220ms pacer) — go through here, so the two lanes combined cannot exceed a
// base's budget. 429 handling stays with the callers; a retry re-enters `acquire`, which is what
// spaces it.

const PER_BASE_RPS = 5;
const WINDOW_MS = 1000;
const GLOBAL_MAX_INFLIGHT = 8;

const starts = new Map<string, number[]>();
const waiters: Array<() => void> = [];
let inflight = 0;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Pull the base id (`app…`) out of any Airtable API URL. Unknown shapes share one bucket. */
export function baseOf(url: string): string {
  const m = /\/v0\/(app[A-Za-z0-9]+)/.exec(url);
  return m ? m[1] : '_';
}

function wake(): void {
  const next = waiters.shift();
  if (next) next();
}

/**
 * Wait until this base may start another request, then mark it started. Returns a release
 * function that MUST be called when the response has been read (a `finally` in the caller).
 */
export async function acquire(baseId: string): Promise<() => void> {
  // Global in-flight cap first — a pure gate, released by whoever finishes.
  while (inflight >= GLOBAL_MAX_INFLIGHT) {
    await new Promise<void>((r) => waiters.push(r));
  }

  // Per-base sliding window.
  for (;;) {
    const now = Date.now();
    const recent = (starts.get(baseId) ?? []).filter((t) => now - t < WINDOW_MS);
    if (recent.length < PER_BASE_RPS) {
      recent.push(now);
      starts.set(baseId, recent);
      break;
    }
    // Sleep until the oldest start in the window ages out, then re-check (another caller may
    // have taken the slot).
    await sleep(Math.max(5, WINDOW_MS - (now - recent[0])));
    starts.set(baseId, recent);
  }

  inflight++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    inflight--;
    wake();
  };
}

/** For the `[perf]` log line — how many requests were in flight when this one started. */
export function currentInflight(): number {
  return inflight;
}
