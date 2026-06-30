// Outbound half of the two-way Vishen sync (portal → Vishen's content base), instant + best-effort.
// Inbound (Vishen → portal) is handled by Airtable Automations — see docs/airtable-automations/.
// Every write here is DIFF-GUARDED (only writes a field whose value actually changed) so an
// outbound write can't ping-pong; automations live only in Vishen's base. See
// plans/vishen-two-way-sync.md. Node runtime (Airtable REST writes).

import { MAJOR_VIDEOS as V, VISHEN_CLIPS as VC, CLIP_SUGGESTIONS as C } from '@/lib/airtable/field-map';
import { getRecord, updateRecord, createRecords, type AirtableResult } from '@/lib/airtable/rest';
import type { MediaSource } from '@/lib/media/repository';
import type { ReelsClip } from '@/lib/clipping/schema';

type Raw = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** On by default; set VISHEN_SYNC_ENABLED=false to disable all portal→Vishen writes. */
export function vishenSyncEnabled(): boolean {
  return process.env.VISHEN_SYNC_ENABLED !== 'false';
}

/** App Clip status → Vishen Clips status. Dismissed has no Vishen equivalent → leave as-is. */
function mapClipStatusToVishen(appStatus: string | null): string | null {
  if (appStatus === C.status_.approved) return VC.status_.inProgress;
  if (appStatus === C.status_.proposed) return VC.status_.todo;
  return null; // Dismissed / unknown → don't touch the Vishen row
}

function clipNotes(c: ReelsClip): string {
  return [
    c.hookLine && `Hook: ${c.hookLine}`,
    c.rationale && `Why: ${c.rationale}`,
    c.caption && `Caption: ${c.caption}`,
    (c.timestampStart || c.timestampEnd) &&
      `Range: ${c.timestampStart ?? '?'}–${c.timestampEnd ?? '?'} · Virality ${c.viralityScore}/10`,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Mirror a Media Source's shared fields onto its linked Major Video (Name + Source URL only —
 * type/Select is inbound-only since the app side is free text and the Vishen field is constrained).
 * Diff-guarded + non-destructive (never blanks a populated Vishen field).
 */
export async function pushMediaSourceToMajorVideo(ms: MediaSource): Promise<void> {
  if (!vishenSyncEnabled() || !ms.sourceRecordId) return;
  const cur = await getRecord<Raw>(V.baseId, V.tableId, ms.sourceRecordId);
  if (!cur.ok) return; // best-effort
  const f = cur.data.fields;
  const patch: Record<string, unknown> = {};
  if (ms.title && ms.title !== str(f[V.fields.name])) patch[V.fields.name] = ms.title;
  if (ms.sourceUrl && ms.sourceUrl !== str(f[V.fields.finalUrl])) patch[V.fields.finalUrl] = ms.sourceUrl;
  if (Object.keys(patch).length === 0) return; // nothing changed → no write → no echo
  await updateRecord(V.baseId, V.tableId, ms.sourceRecordId, patch);
}

/**
 * Create rows in Vishen's Clips table for app-generated clips, linked to the Major Video, and
 * stamp the correlation id both ways (Vishen row ← App Clip ID, Clip Suggestion ← Vishen Clip ID).
 * `appClipIds[i]` is the Clip Suggestion recId for `clips[i]` (same order).
 */
export async function mirrorClipsToVishenBase(
  majorVideoRecId: string,
  clips: ReelsClip[],
  appClipIds: string[],
): Promise<AirtableResult<{ count: number }>> {
  if (!vishenSyncEnabled() || clips.length === 0) return { ok: true, data: { count: 0 } };

  const records = clips.map((c, i) => ({
    fields: {
      [VC.fields.name]: (c.hookLine || `Clip ${i + 1}`).slice(0, 200),
      [VC.fields.notes]: clipNotes(c),
      [VC.fields.status]: VC.status_.todo,
      [VC.links.source]: [majorVideoRecId],
      [VC.fields.appClipId]: appClipIds[i] ?? '',
    },
  }));

  const res = await createRecords<Raw>(VC.baseId, VC.tableId, records);
  if (!res.ok) return res;

  // Write each new Vishen recId back onto its Clip Suggestion (best-effort, one per row).
  await Promise.all(
    res.data.map((rec, i) => {
      const appId = appClipIds[i];
      if (!appId) return Promise.resolve();
      return updateRecord(C.baseId, C.tableId, appId, { [C.fields.vishenClipId]: rec.id });
    }),
  );

  return { ok: true, data: { count: res.data.length } };
}

/**
 * Push an app clip's status onto its mirrored Vishen Clips row (diff-guarded). No-op when the
 * clip has no mirror, the status doesn't map, or the Vishen row already holds the target value.
 */
export async function pushClipStatusToVishen(vishenClipId: string | null, appStatus: string | null): Promise<void> {
  if (!vishenSyncEnabled() || !vishenClipId) return;
  const target = mapClipStatusToVishen(appStatus);
  if (!target) return;
  const cur = await getRecord<Raw>(VC.baseId, VC.tableId, vishenClipId);
  if (!cur.ok) return;
  const currentName = (cur.data.fields[VC.fields.status] as { name?: string } | string | undefined);
  const currentVal = typeof currentName === 'string' ? currentName : currentName?.name ?? null;
  if (currentVal === target) return; // already there → no write → no echo
  await updateRecord(VC.baseId, VC.tableId, vishenClipId, { [VC.fields.status]: target });
}
