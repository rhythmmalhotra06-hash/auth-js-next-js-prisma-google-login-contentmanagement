// Drain the outbox immediately after an app write, instead of waiting for the cron.
//
// WHY THIS EXISTS
// The two-way sync was documented — in CLAUDE.md, Context/portal-overview.md and the workflow
// file itself — as running "every 5 minutes". It does not. GitHub throttles `*/5` schedules hard
// on this repo; the observed run times on 2026-08-26..28 were:
//
//   Aug 26 20:00 -> 23:20 -> Aug 27 04:34 -> 15:27 -> Aug 28 00:32
//
// Gaps of 3 to 11 hours. So a portal edit could sit unsynced for most of a day, against a
// ~90-second echo-suppression window and last-writer-wins conflict resolution. Two people
// editing the same ticket hours apart could silently lose one of the edits, with nothing
// reporting it.
//
// The outbound half of that is fixable here and does not need a scheduler at all: the app knows
// the moment it has enqueued something. Draining right away also *removes* the conflict risk
// rather than narrowing it — once Airtable holds the app's value, a later pull reads that value
// back instead of overwriting it with something stale.
//
// The inbound half (Airtable -> Postgres) still needs a real scheduler; changes made in Airtable
// remain invisible to the portal until the next pull. That is staleness, not data loss, which is
// the far less damaging failure.
//
// BEST-EFFORT BY DESIGN
// `after()` runs once the response is sent. On Cloud Run the instance may have its CPU throttled
// after the response, so this is not guaranteed to complete — the scheduled drain stays as the
// backstop and nothing here is load-bearing. It cannot make things worse than the cron alone,
// which is the bar it has to clear.

import { after } from 'next/server';
import { drainOutbox } from './push';

/**
 * Ask for an outbox drain once the current response is sent.
 *
 * Safe to call from anywhere a write happens. Outside a request scope (the cron's own pull, a
 * script) `after()` throws, and we swallow it — those paths already drain explicitly.
 *
 * `onDrained` fires after a successful drain — e.g. to invalidate an Airtable-backed read cache.
 */
export function scheduleOutboxDrain(onDrained?: () => void): void {
  try {
    after(async () => {
      try {
        await drainOutbox();
        // Runs only once Airtable holds the value — the moment a read cache built from Airtable
        // is genuinely out of date. The caller uses this to drop that cache.
        onDrained?.();
      } catch {
        // A push failure is already recorded on the outbox row (status/attempts/last_error) and
        // retried by the drainer. Nothing useful to add here, and throwing inside after() would
        // surface as an unhandled rejection long after the user's request finished.
      }
    });
  } catch {
    // Not in a request scope — the scheduled drain will pick this up.
  }
}
