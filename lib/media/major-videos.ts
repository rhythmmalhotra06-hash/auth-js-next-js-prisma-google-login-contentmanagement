// Vishen's "Major Videos" table (his own content base) → 📺 Media Sources.
// One-way sync of new rows that have a video link, reusing the discover pattern
// (createMediaSource + Source Record ID dedupe). Also creates rows back in Major
// Videos for the Studio "add media" entry. Node runtime (Airtable REST writes).

import { MAJOR_VIDEOS as V } from '@/lib/airtable/field-map';
import { listAll, createRecord, type AirtableRecord, type AirtableResult } from '@/lib/airtable/rest';
import { createMediaSource, existingSourceRecordIds } from '@/lib/media/repository';
import { parseVideoId } from '@/lib/media/youtube';

const VF = V.fields;
type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

/** First multipleSelects option name (the content "type"), tolerating {name} objects. */
function firstSelectName(v: unknown): string | null {
  if (!Array.isArray(v) || v.length === 0) return null;
  const x = v[0];
  if (typeof x === 'string') return x || null;
  if (x && typeof x === 'object' && 'name' in x) return String((x as { name: unknown }).name);
  return null;
}

export interface MajorVideo {
  id: string;
  name: string | null;
  finalUrl: string | null;
  draftUrl: string | null;
  type: string | null; // content category from the "Select" field
}

function mapVideo(rec: AirtableRecord<Raw>): MajorVideo {
  const f = rec.fields;
  return {
    id: rec.id,
    name: str(f[VF.name]),
    finalUrl: str(f[VF.finalUrl]),
    draftUrl: str(f[VF.draftUrl]),
    type: firstSelectName(f[VF.select]),
  };
}

/**
 * Major Videos created after `cutoffDate` (YYYY-MM-DD) that have a video link (Final or Draft
 * URL). The cutoff honours "only new rows going forward" — never backfills the pre-existing rows.
 */
export async function recentMajorVideos(cutoffDate: string): Promise<AirtableResult<MajorVideo[]>> {
  const formula = `AND(IS_AFTER(CREATED_TIME(), DATETIME_PARSE('${cutoffDate}', 'YYYY-MM-DD')), OR({Final URL} != '', {Draft URL} != ''))`;
  const res = await listAll<Raw>(V.baseId, V.tableId, {
    filterByFormula: formula,
    fields: [VF.name, VF.finalUrl, VF.draftUrl, VF.select],
  });
  if (!res.ok) return res;
  return { ok: true, data: res.data.map(mapVideo) };
}

/** YouTube → "YouTube"; anything else (Dropbox, Vimeo, …) → "Other". */
export function derivePlatform(url: string | null): string {
  return url && parseVideoId(url) ? 'YouTube' : 'Other';
}

/** Create a row in Vishen's Major Videos base (Studio "add media" write-back). Returns recId. */
export async function createMajorVideo(input: {
  title: string;
  url?: string | null;
  type?: string | null;
  aiSuggested?: boolean; // tag the row as portal/AI-originated (set on approval-time creates)
}): Promise<AirtableResult<{ id: string }>> {
  const fields: Record<string, unknown> = { [VF.name]: input.title };
  if (input.url) {
    // Public watch links go in Final URL; we don't distinguish draft/final on manual add.
    fields[VF.finalUrl] = input.url;
  }
  if (input.type) fields[VF.select] = [input.type];
  if (input.aiSuggested) fields[VF.aiSuggested] = V.aiSuggested_;
  const res = await createRecord<Raw>(V.baseId, V.tableId, fields);
  if (!res.ok) return res;
  return { ok: true, data: { id: res.data.id } };
}

export interface SyncResult {
  scanned: number;
  added: string[];
  failed: { id: string; error: string }[];
}

/**
 * Mirror new Major Videos rows into 📺 Media Sources (Status New, Submitted Via Airtable,
 * Guest/Show = the content type), deduped on Source Record ID. Adds rows only — never runs
 * the clip engine (a human still clicks "Suggest clips").
 */
export async function syncMajorVideos(cutoffDate: string): Promise<AirtableResult<SyncResult>> {
  const vids = await recentMajorVideos(cutoffDate);
  if (!vids.ok) return vids;

  const seenRes = await existingSourceRecordIds();
  if (!seenRes.ok) return seenRes;
  const seen = seenRes.data;

  const added: string[] = [];
  const failed: { id: string; error: string }[] = [];

  for (const v of vids.data) {
    if (seen.has(v.id)) continue;
    const url = v.finalUrl || v.draftUrl || null; // prefer Final over Draft
    const platform = derivePlatform(url);
    const res = await createMediaSource({
      url,
      // A non-YouTube link (e.g. Dropbox) is the editor's download link as well as the source.
      downloadUrl: platform === 'Other' ? url : null,
      title: v.name,
      platform,
      guestShow: v.type, // capture the content "type" into Guest / Show (informational)
      submittedVia: 'Airtable',
      sourceRecordId: v.id,
    });
    if (res.ok) added.push(v.id);
    else failed.push({ id: v.id, error: res.error.message });
  }

  return { ok: true, data: { scanned: vids.data.length, added, failed } };
}
