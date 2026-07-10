// Ticket ↔ clip link reconcile.
//
// When a clip is converted to a ticket (app/media/actions.ts → convertClipsToTickets), two
// Airtable links should end up on the ticket in the Creative Services base:
//   1. ticket ↔ 🎬 Clip Suggestions  (the app's own clip row)
//   2. ticket ↔ Clips (Sync)         (the synced mirror of Vishen's real clip — perf/rating)
// Both can only be written once the async pieces settle:
//   • on the Postgres backend the ticket's Airtable recId exists only after the outbox drains
//     (lib/airtable/push.ts stamps ticket.airtableId);
//   • the Clips (Sync) mirror row appears only after the app pushes the clip to Vishen's base
//     and Airtable re-syncs it back.
// So this runs on a timer (POST /api/media/link-tickets) and is idempotent + best-effort: it
// pairs each approved clip to its ticket via the clip's "App Ticket ID" and fills any missing
// link. Safe to re-run — it skips links already in place.

import { CLIPS_SYNC, TICKETS } from '@/lib/airtable/field-map';
import { getRecord, listRecords, updateRecord } from '@/lib/airtable/rest';
import { ticketAirtableId } from '@/lib/tickets/airtable-id';
import { listClipsByStatus, getMediaSource, updateClipSuggestion, type MediaSource } from './repository';
import { mirrorApprovedClips } from './clip-mirror';
import { syncTicketFieldsToVishenClip, newSyncCaches } from './clip-ticket-sync';

export interface LinkReconcileReport {
  scanned: number;
  reMirrored: number; // approved clips that never reached Vishen's base, mirrored this run
  suggestionLinked: number;
  clipsSyncLinked: number;
  fieldsSynced: number; // Vishen clips whose Editor Assigned/Status/Type were refreshed from the ticket
  deferred: number; // ticket not mirrored to Airtable yet — will retry next run
  errors: string[];
}

function linkIds(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && 'id' in x ? String((x as { id: unknown }).id) : null))
    .filter((x): x is string => !!x);
}

// Link the ticket to its synced-clip mirror row. Returns 'absent' when the mirror hasn't synced
// yet OR the "App Clip ID" field isn't in the sync's field set (then the match formula can't
// resolve) — both are expected no-ops the next run heals, so neither is treated as an error.
async function linkTicketToClipsSync(ticketRecId: string, clipRecId: string): Promise<'linked' | 'present' | 'absent' | 'error'> {
  const escaped = clipRecId.replace(/'/g, "\\'");
  const found = await listRecords(CLIPS_SYNC.baseId, CLIPS_SYNC.tableId, {
    filterByFormula: `{${CLIPS_SYNC.appClipIdName}} = '${escaped}'`,
    maxRecords: 1,
  });
  if (!found.ok) return 'absent'; // field not synced yet / transient — retried next run
  const mirror = found.data.records[0];
  if (!mirror) return 'absent';

  const tRes = await getRecord(TICKETS.baseId, TICKETS.tableId, ticketRecId);
  if (!tRes.ok) return 'error';
  const current = linkIds(tRes.data.fields[TICKETS.links.clipsSync]);
  if (current.includes(mirror.id)) return 'present';

  const up = await updateRecord(TICKETS.baseId, TICKETS.tableId, ticketRecId, {
    [TICKETS.links.clipsSync]: [...current, mirror.id], // union — never clobber existing links
  });
  return up.ok ? 'linked' : 'error';
}

export async function reconcileClipTicketLinks(limit = 60): Promise<LinkReconcileReport> {
  const report: LinkReconcileReport = { scanned: 0, reMirrored: 0, suggestionLinked: 0, clipsSyncLinked: 0, fieldsSynced: 0, deferred: 0, errors: [] };
  const caches = newSyncCaches(); // memoize employee/asset-type lookups across the run

  const clipsRes = await listClipsByStatus('Approved', limit);
  if (!clipsRes.ok) {
    report.errors.push(`load approved clips: ${clipsRes.error.message}`);
    return report;
  }
  // Only clips raised through the app convert flow carry an App Ticket ID pairing key.
  const clips = clipsRes.data.filter((c) => c.appTicketId);
  report.scanned = clips.length;

  // Safety net: re-mirror any approved clip that never reached Vishen's base (no vishenClipId) —
  // e.g. its convert-time mirror failed on a dangling Major Video ref. mirrorApprovedClips
  // self-heals the Major Video and MUTATES each clip's vishenClipId in place, so the Clips (Sync)
  // link step below can run in the same pass. Best-effort; errors are surfaced, not thrown.
  const unmirrored = clips.filter((c) => !c.vishenClipId && c.mediaSourceId);
  if (unmirrored.length) {
    const sources = new Map<string, MediaSource>();
    for (const sid of [...new Set(unmirrored.map((c) => c.mediaSourceId!).filter(Boolean))]) {
      const r = await getMediaSource(sid);
      if (r.ok) sources.set(sid, r.data);
    }
    const mirror = await mirrorApprovedClips(unmirrored, sources);
    report.reMirrored = mirror.mirrored;
    report.errors.push(...mirror.errors);
  }

  for (const c of clips) {
    try {
      const recId = await ticketAirtableId(c.appTicketId as string);
      if (!recId) {
        report.deferred++; // ticket not mirrored to Airtable yet
        continue;
      }

      // 1. Clip Suggestions ↔ ticket — repair if missing or pointing at a non-recId (PG uuid).
      if (c.ticketId !== recId) {
        const r = await updateClipSuggestion(c.id, { ticketRecId: recId });
        if (r.ok) report.suggestionLinked++;
        else report.errors.push(`${c.id} suggestion link: ${r.error.message}`);
      }

      // 2. ticket ↔ Clips (Sync) — only once the clip has been mirrored into Vishen's base
      //    (vishenClipId set), which is what eventually surfaces the synced mirror row.
      if (c.vishenClipId) {
        const outcome = await linkTicketToClipsSync(recId, c.id);
        if (outcome === 'linked') report.clipsSyncLinked++;
        else if (outcome === 'error') report.errors.push(`${c.id} Clips (Sync) link failed`);

        // 3. Mirror the ticket's live Editor Assigned / Status / Type onto the Vishen clip row.
        const fs = await syncTicketFieldsToVishenClip(recId, c.vishenClipId, caches);
        if (fs === 'updated') report.fieldsSynced++;
        else if (fs === 'error') report.errors.push(`${c.id} field sync failed`);
      }
    } catch (e) {
      report.errors.push(`${c.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return report;
}
