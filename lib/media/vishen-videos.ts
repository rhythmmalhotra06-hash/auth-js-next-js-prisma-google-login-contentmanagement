// Vishen's "Videos" table (his own content base) — the complete cross-channel log of
// everything made for his channels. Read-only mirror for the founder "Vishen's Media"
// section (/studio/media), except Approval + Rating which the portal writes back on an
// explicit Vishen tap. Airtable-direct, same pattern as lib/media/repository.ts.
// See plans/jul2-2026-vishen-media-section.md.

import { VISHEN_VIDEOS as V } from '@/lib/airtable/field-map';
import { listAll, updateRecord, type AirtableRecord, type AirtableResult } from '@/lib/airtable/rest';

const VF = V.fields;
type Raw = Record<string, unknown>;

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return String(v);
}

/** Coarse pipeline stage (the ribbon) derived from the numbered Status option. */
export type VideoStage = 'production' | 'filmed' | 'editing' | 'published' | 'other';

/** Channel bucket, derived from the published link then the medium. */
export type VideoChannel = 'YouTube' | 'LinkedIn' | 'Instagram' | 'Email' | 'Web';

export interface VishenVideo {
  id: string;
  name: string | null;
  source: string | null; // who made it (agency/producer)
  medium: string | null; // channel/format select
  format: string | null; // shot style
  product: string | null; // what it promotes
  status: string | null; // raw 6-stage Status option
  stage: VideoStage; // derived coarse stage
  approval: string | null; // Vishen's sign-off axis
  publishedLink: string | null;
  channel: VideoChannel; // derived
  liveDate: string | null;
  rating: number | null; // 1–5
  views24h: string | null; // free-text 24h performance (team-logged)
  createdTime: string;
}

/** Map the numbered Status option ("4: 🎥 Filmed") to a coarse pipeline stage. */
export function stageOf(status: string | null): VideoStage {
  if (!status) return 'other';
  const n = parseInt(status, 10);
  if (n >= 1 && n <= 3) return 'production';
  if (n === 4) return 'filmed';
  if (n === 5) return 'editing';
  if (n === 6) return 'published';
  return 'other';
}

/** Channel from the published-link domain first, falling back to the Medium select. */
export function deriveChannel(publishedLink: string | null, medium: string | null): VideoChannel {
  const u = (publishedLink ?? '').toLowerCase();
  if (u.includes('linkedin.')) return 'LinkedIn';
  if (u.includes('youtube.') || u.includes('youtu.be')) return 'YouTube';
  if (u.includes('instagram.')) return 'Instagram';
  const m = (medium ?? '').toLowerCase();
  if (m.includes('linkedin')) return 'LinkedIn';
  if (m.includes('email')) return 'Email';
  if (m.includes('insta')) return 'Instagram';
  if (m.includes('video') || m.includes('talk')) return 'YouTube';
  return 'Web';
}

function mapVideo(rec: AirtableRecord<Raw>): VishenVideo {
  const f = rec.fields;
  const status = selectName(f[VF.status]);
  const medium = selectName(f[VF.medium]);
  const publishedLink = str(f[VF.publishedLink]);
  // A live link means it's out — many LinkedIn "LIVE:" posts carry a link + Approved
  // but leave Status blank, so treat any linked row without a real stage as published.
  const rawStage = stageOf(status);
  const stage = rawStage === 'other' && publishedLink ? 'published' : rawStage;
  return {
    id: rec.id,
    name: str(f[VF.name]),
    source: selectName(f[VF.source]),
    medium,
    format: selectName(f[VF.format]),
    product: selectName(f[VF.product]),
    status,
    stage,
    approval: selectName(f[VF.approval]),
    publishedLink,
    channel: deriveChannel(publishedLink, medium),
    liveDate: str(f[VF.liveDate]),
    rating: num(f[VF.rating]),
    views24h: str(f[VF.views24h]),
    createdTime: rec.createdTime,
  };
}

const LIST_FIELDS = [
  VF.name, VF.source, VF.medium, VF.format, VF.product, VF.status, VF.approval,
  VF.publishedLink, VF.liveDate, VF.rating, VF.views24h,
];

/**
 * Vishen's videos — excludes the Rejected pile. Sorted newest-first by Live Date,
 * then created time (ideas without a live date fall after live/scheduled ones).
 * `limit` caps the read (the table is ~341 rows and grows).
 */
export async function listVishenVideos(limit = 200): Promise<AirtableResult<VishenVideo[]>> {
  const res = await listAll<Raw>(V.baseId, V.tableId, {
    fields: LIST_FIELDS,
    filterByFormula: `NOT({Status} = 'Rejected')`,
    maxRecords: limit,
  });
  if (!res.ok) return res;
  const rows = res.data.map(mapVideo).sort((a, b) => {
    const ad = a.liveDate ?? '', bd = b.liveDate ?? '';
    if (ad !== bd) return ad < bd ? 1 : -1; // live date desc; empty dates sort last
    return a.createdTime < b.createdTime ? 1 : -1;
  });
  return { ok: true, data: rows };
}

// ── Selectors (pure, over a loaded set) ──────────────────────────────────────

/** Items marked for Vishen's sign-off — the "waiting on you" hero. */
export function waitingOnVishen(videos: VishenVideo[]): VishenVideo[] {
  return videos.filter((v) => v.approval === V.approval_.toReview);
}

/** Published items with a live link — the "live & performing" zone. */
export function publishedVideos(videos: VishenVideo[]): VishenVideo[] {
  return videos.filter((v) => v.stage === 'published' && v.publishedLink);
}

/** Named external agencies get their own card; everyone else rolls up to "Internal". */
export const AGENCIES = ['Simplex Media', 'Simplex (by Vishen)', 'Talking Heads', 'Two Comma PR'] as const;
export function producerBucket(source: string | null): string {
  return source && (AGENCIES as readonly string[]).includes(source) ? source : 'Internal';
}

export interface ProducerRollup {
  name: string;
  inFlight: number; // not yet published
  publishedRecent: number; // published with a live date in the last ~30d window
  avgRating: number | null;
}

/** Per-producer rollup for the accountability scoreboard. */
export function byProducer(videos: VishenVideo[], since: string): ProducerRollup[] {
  const map = new Map<string, VishenVideo[]>();
  for (const v of videos) {
    const b = producerBucket(v.source);
    (map.get(b) ?? map.set(b, []).get(b)!).push(v);
  }
  return [...map.entries()]
    .map(([name, rows]) => {
      const rated = rows.filter((r) => (r.rating ?? 0) > 0);
      return {
        name,
        inFlight: rows.filter((r) => r.stage !== 'published').length,
        publishedRecent: rows.filter((r) => r.stage === 'published' && (r.liveDate ?? '') >= since).length,
        avgRating: rated.length ? rated.reduce((s, r) => s + (r.rating ?? 0), 0) / rated.length : null,
      };
    })
    .sort((a, b) => b.inFlight + b.publishedRecent - (a.inFlight + a.publishedRecent));
}

// ── Write-back (Approve + rate) — the only writes this table takes ────────────

/**
 * Vishen's sign-off / rating write-back. The propose-only commit boundary: only ever
 * fires on an explicit tap. Loop-safe — no inbound automation reads Approval/Rating.
 */
export async function updateVishenVideo(
  id: string,
  patch: { approval?: string; rating?: number; views24h?: string },
): Promise<AirtableResult<VishenVideo>> {
  const fields: Record<string, unknown> = {};
  if (patch.approval !== undefined) fields[VF.approval] = patch.approval;
  if (patch.rating !== undefined) fields[VF.rating] = patch.rating;
  if (patch.views24h !== undefined) fields[VF.views24h] = patch.views24h;
  const res = await updateRecord<Raw>(V.baseId, V.tableId, id, fields);
  if (!res.ok) return res;
  return { ok: true, data: mapVideo(res.data) };
}
