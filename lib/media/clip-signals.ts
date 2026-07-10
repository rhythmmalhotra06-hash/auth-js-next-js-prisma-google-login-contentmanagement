// Reads outcome signals for released/rated clips from the read-only "Clips (Sync)"
// mirror (CLIPS_SYNC). Feeds the Tier-2 learning loop (app/api/clips/learn) so the
// engine can propose rules from what actually performed. Best-effort, read-only.

import { CLIPS_SYNC as S } from '@/lib/airtable/field-map';
import { listAll, type AirtableRecord, type AirtableResult } from '@/lib/airtable/rest';

const SF = S.fields;
type Raw = Record<string, unknown>;

export interface ClipSignalRow {
  appClipId: string | null;
  rating: number | null;
  released: boolean;
  /**
   * Human-entered 24-hour performance text ("24 Data"). NOTE: we deliberately do NOT
   * use the "Notes" field — the two-way sync mirrors the app's OWN generated clip text
   * (Hook/Why/Caption) and BlinkLife links into Notes, so it's not genuine outcome
   * feedback and would pollute the Tier-2 proposals. Verified live 2026-07-10.
   */
  feedback: string | null;
  /** A Loom review link exists (we can't read its contents, only note presence). */
  hasLoomFeedback: boolean;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
function selectNames(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => (typeof x === 'object' && x && 'name' in x ? String((x as { name: unknown }).name) : String(x)));
  if (typeof v === 'string' && v) return [v];
  return [];
}

function mapRow(rec: AirtableRecord<Raw>): ClipSignalRow {
  const f = rec.fields;
  const data24 = str(f[SF.data24]);
  return {
    appClipId: str(f[SF.appClipId]),
    rating: num(f[SF.rating]),
    released: selectNames(f[SF.released]).length > 0,
    feedback: data24 ? `24h data: ${data24}` : null,
    hasLoomFeedback: !!str(f[SF.feedbackUrl]),
  };
}

/**
 * All clips carrying a usable signal — a rating, released status, or written feedback.
 * Rows with no signal at all are dropped (nothing to learn from).
 */
export async function listClipSignals(): Promise<AirtableResult<ClipSignalRow[]>> {
  const res = await listAll<Raw>(S.baseId, S.tableId);
  if (!res.ok) return res;
  const rows = res.data
    .map(mapRow)
    .filter((r) => r.rating != null || r.released || r.feedback);
  return { ok: true, data: rows };
}
