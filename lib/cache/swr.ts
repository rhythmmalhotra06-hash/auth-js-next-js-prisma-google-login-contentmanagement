// A stale-while-revalidate memo for slow reads — the one cache the read paths share.
//
// ── WHY ──────────────────────────────────────────────────────────────────────────────────────
//
// This pattern existed nine times in `lib/` as hand-rolled `{ at, rows }` + TTL, each slightly
// different (some deduped in-flight calls, most did not), and none could serve a stale value
// while refreshing. So in a meeting, the first load after a TTL rolled over paid the whole
// Airtable bill again — several seconds of blank page, exactly when someone is watching.
//
// This does the thing those copies could not: a value that is past `fresh` but inside `stale`
// is returned IMMEDIATELY and refreshed in the background, once, for the next reader. Only a
// value nobody has asked for in `stale` ms is refetched in the foreground.
//
// ── THE TRADE ────────────────────────────────────────────────────────────────────────────────
//
// Readers see data up to `stale` ms old. For Airtable-sourced planning data (what is planned,
// the message of the week) that was agreed acceptable — a few minutes — and every surface that
// uses this already shows an "as of" time. It is NOT acceptable for the writer: someone who sets
// a Live Date and returns to the calendar must see it there. So every server action that writes
// to a source cached here MUST call `invalidate(prefix)` before its `revalidatePath`. Grep for
// the key prefixes before adding a write path.
//
// The memo is per process. Cloud Run may run more than one instance; an invalidation on one does
// not reach the other, and the `stale` ceiling is what bounds that. Keep it in minutes, not hours.

interface Entry<T> {
  at: number;
  value: T;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export interface SwrOptions {
  /** Return the cached value without any refresh for this long. Default 60s. */
  fresh?: number;
  /** After `fresh`, still return the cached value but refresh in the background, until this. Default 5 min. */
  stale?: number;
}

const DEFAULT_FRESH = 60_000;
const DEFAULT_STALE = 5 * 60_000;

function refresh<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const p = fn()
    .then((value) => {
      store.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, p);
  return p;
}

/**
 * Memoise `fn` under `key`.
 *
 * - fresh   → cached value, no I/O.
 * - stale   → cached value now; one background refresh for the next reader. A failing refresh
 *             keeps the old value and is logged, never thrown at the reader.
 * - expired → `fn` runs in the foreground (deduped if several readers arrive together).
 */
export async function swr<T>(key: string, fn: () => Promise<T>, opts: SwrOptions = {}): Promise<T> {
  const fresh = opts.fresh ?? DEFAULT_FRESH;
  const stale = opts.stale ?? DEFAULT_STALE;
  const hit = store.get(key) as Entry<T> | undefined;
  const age = hit ? Date.now() - hit.at : Infinity;

  if (hit && age < fresh) return hit.value;
  if (hit && age < stale) {
    void refresh(key, fn).catch((err) => {
      console.warn(`[swr] background refresh failed for ${key}: ${err instanceof Error ? err.message : String(err)}`);
    });
    return hit.value;
  }
  return refresh(key, fn);
}

/** Drop every cached value whose key starts with `prefix`. Call from any action that writes to the source. */
export function invalidate(prefix: string): void {
  for (const k of [...store.keys()]) if (k.startsWith(prefix)) store.delete(k);
}

/** For tests and the admin page. */
export function swrStats(): { keys: string[]; inflight: number } {
  return { keys: [...store.keys()], inflight: inflight.size };
}
