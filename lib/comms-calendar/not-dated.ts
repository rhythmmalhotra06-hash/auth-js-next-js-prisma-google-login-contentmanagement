// The not-dated tray — artboard `6b`.
//
// The design handoff calls this "the largest single body of work in the system", and in the export
// it existed only as a `Show all 221` button. It is the surface that makes the calendar's central
// problem legible: `Live Date` has no owner, and without it no calendar can place the work.
//
// THE NUMBER THAT MATTERS is the published one. Undated work that has not gone out yet is an
// ordinary backlog; undated work that is ALREADY LIVE is finished work the calendar can never
// show, quietly losing attribution every day it sits there.
//
// ── One deliberate departure from the spec ────────────────────────────────────────────────────
//
// The handoff says "three counts, and ONLY the three the export holds": total, published, and
// "not yet published, not yet scheduled". That third one is wrong on live data — it sweeps in 17
// `Rejected` and 6 `Parked for later` assets, which are undated because they are NOT GOING OUT.
// Counting them as pending work overstates the backlog by ~20% and makes the nag less credible,
// which is the fastest way to get a number ignored. So they are split out as a fourth count. The
// export could not see this; the live data can.

import { VL_VIDEOS } from '@/lib/airtable/field-map';
import { vlRows } from './data.airtable';

export type TrayGrouping = 'source' | 'status' | 'channel';

export interface UndatedAsset {
  id: string;
  title: string;
  status: string | null;
  source: string | null;
  channel: string | null;
  publishedUrl: string | null;
  /** Already live. These are the ones losing attribution. */
  published: boolean;
  /** Rejected or parked — undated on purpose, and not part of the backlog. */
  retired: boolean;
}

export interface TrayGroup {
  key: string;
  total: number;
  published: number;
  assets: UndatedAsset[];
}

export interface NotDatedTray {
  grouping: TrayGrouping;
  groups: TrayGroup[];
  counts: {
    /** Every asset in the Vishen lane, dated or not — the denominator. */
    laneTotal: number;
    /** No Live Date at all. */
    undated: number;
    /** Undated AND already published. The one that matters. */
    published: number;
    /** Undated, still in flight, genuinely waiting to be scheduled. */
    inFlight: number;
    /** Undated because they are not going out — rejected or parked. Correctly undated. */
    retired: number;
  };
  /**
   * Of the published-but-undated, how many even have a link recorded.
   *
   * Live answer: 4 of 66. So for most of them the calendar cannot place the work AND nobody can
   * reach it either — two gaps stacked on the same records.
   */
  publishedWithLink: number;
  asOf: string;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
function selectName(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v || null;
  if (Array.isArray(v)) return selectName(v[0]);
  if (typeof v === 'object' && 'name' in (v as object)) return String((v as { name: unknown }).name);
  return null;
}

/** Statuses that mean "never going out", so being undated is correct rather than a gap. */
const RETIRED = new Set(['rejected', 'parked for later']);

export async function getNotDatedTray(grouping: TrayGrouping = 'source'): Promise<NotDatedTray> {
  // The shared, projected, memoised VL scan — see `vlRows` in data.airtable.ts. This used to be
  // its own five-page read of every column on every open of the tray.
  const rows = await vlRows();

  const assets: UndatedAsset[] = [];
  for (const r of rows) {
    const f = r.fields as Record<string, unknown>;
    if (str(f[VL_VIDEOS.fields.liveDate])) continue;

    const status = selectName(f[VL_VIDEOS.fields.status]);
    assets.push({
      id: r.id,
      title: str(f[VL_VIDEOS.fields.name]) ?? '(untitled)',
      status,
      source: selectName(f[VL_VIDEOS.fields.source]),
      channel: selectName(f[VL_VIDEOS.fields.medium]),
      publishedUrl: str(f[VL_VIDEOS.fields.publishedLink]),
      published: !!status && status.startsWith('7'),
      retired: !!status && RETIRED.has(status.trim().toLowerCase()),
    });
  }

  const keyOf = (a: UndatedAsset): string =>
    (grouping === 'status' ? a.status : grouping === 'channel' ? a.channel : a.source) ?? '(not set)';

  const byKey = new Map<string, UndatedAsset[]>();
  for (const a of assets) byKey.set(keyOf(a), [...(byKey.get(keyOf(a)) ?? []), a]);

  const groups: TrayGroup[] = [...byKey.entries()]
    .map(([key, list]) => ({
      key,
      total: list.length,
      published: list.filter((a) => a.published).length,
      // Published first inside a group too: those are the ones losing attribution today.
      assets: [...list].sort((a, b) =>
        Number(b.published) - Number(a.published) || a.title.localeCompare(b.title),
      ),
    }))
    // Most published first — the tray is sorted by urgency, not alphabetically, because the
    // question it answers is "what is bleeding", not "what exists".
    .sort((a, b) => b.published - a.published || b.total - a.total || a.key.localeCompare(b.key));

  const published = assets.filter((a) => a.published);

  return {
    grouping,
    groups,
    counts: {
      laneTotal: rows.length,
      undated: assets.length,
      published: published.length,
      inFlight: assets.filter((a) => !a.published && !a.retired).length,
      retired: assets.filter((a) => a.retired).length,
    },
    publishedWithLink: published.filter((a) => a.publishedUrl).length,
    asOf: new Date().toISOString(),
  };
}
