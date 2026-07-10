// Shared "mirror approved clips into Vishen's base" step, used by both the convert path
// (app/media/actions.ts:convertClipsToTickets) and the reconcile safety net
// (lib/media/ticket-links.ts:reconcileClipTicketLinks).
//
// For each approved clip that hasn't been mirrored yet, this ensures the parent Media Source has a
// LIVE Major Video in Vishen's base — creating one when the Source Record ID is empty OR dangling
// (its Major Video was deleted, e.g. during a manual de-dupe) — then creates the Vishen Clips rows
// and stamps `vishenClipId` back. Idempotent (skips clips that already carry a vishenClipId) and
// best-effort: it never throws, collecting per-source failures into the returned report so callers
// can log them instead of silently swallowing.

import { createMajorVideo, majorVideoExists } from '@/lib/media/major-videos';
import { updateMediaSource, type ClipSuggestion, type MediaSource } from '@/lib/media/repository';
import { mirrorClipsToVishenBase } from '@/lib/media/vishen-sync';
import type { ReelsClip } from '@/lib/clipping/schema';

export interface MirrorReport {
  mirrored: number; // Vishen Clips rows created this run
  errors: string[];
}

/**
 * Mirror clips that were just approved (or found approved-but-unmirrored) into Vishen's content
 * base. Groups by parent Media Source so at most one Major Video is created per source. On success
 * it MUTATES each clip's `vishenClipId` in place, so a caller holding the same objects can link the
 * Clips (Sync) mirror in the same run.
 */
export async function mirrorApprovedClips(
  clips: ClipSuggestion[],
  sources: Map<string, MediaSource>,
): Promise<MirrorReport> {
  const report: MirrorReport = { mirrored: 0, errors: [] };

  const bySource = new Map<string, ClipSuggestion[]>();
  for (const c of clips) {
    if (!c.mediaSourceId || c.vishenClipId) continue; // no parent, or already mirrored
    const arr = bySource.get(c.mediaSourceId) ?? [];
    arr.push(c);
    bySource.set(c.mediaSourceId, arr);
  }

  for (const [sourceId, group] of bySource) {
    const src = sources.get(sourceId);
    if (!src) continue;
    try {
      // Ensure the parent Media Source has a LIVE Major Video in Vishen's base. Recreate when the
      // Source Record ID is empty OR points at a deleted row — a dangling ref would otherwise fail
      // the linked-record create forever. AI Suggested only when WE create it.
      let majorVideoId = src.sourceRecordId;
      if (!majorVideoId || !(await majorVideoExists(majorVideoId))) {
        const mv = await createMajorVideo({
          title: src.title ?? src.sourceUrl ?? 'Untitled',
          url: src.sourceUrl,
          aiSuggested: true,
        });
        if (!mv.ok) {
          report.errors.push(`${sourceId} major video create: ${mv.error.message}`);
          continue; // best-effort
        }
        majorVideoId = mv.data.id;
        await updateMediaSource(sourceId, { sourceRecordId: majorVideoId }); // overwrite empty/dead ref
      }

      // Map Clip Suggestions to the shape mirrorClipsToVishenBase expects (format/virality feed the
      // notes blurb only; missing values are harmless).
      const reels: ReelsClip[] = group.map((c) => ({
        timestampStart: c.timestampStart ?? '',
        timestampEnd: c.timestampEnd ?? '',
        rationale: c.rationale ?? '',
        caption: c.caption ?? '',
        hookLine: c.hookLine ?? c.name ?? '',
        format: (c.format ?? 'talking_head') as ReelsClip['format'],
        viralityScore: c.viralityScore ?? 0,
      }));
      const res = await mirrorClipsToVishenBase(majorVideoId, reels, group.map((c) => c.id));
      if (!res.ok) {
        report.errors.push(`${sourceId} mirror: ${res.error.message}`);
        continue;
      }
      report.mirrored += res.data.count;
      // Reflect the new vishenClipIds onto the in-memory clips so same-run callers can link them.
      const byId = new Map(res.data.results.map((r) => [r.appClipId, r.vishenClipId]));
      for (const c of group) {
        const v = byId.get(c.id);
        if (v) c.vishenClipId = v;
      }
    } catch (e) {
      report.errors.push(`${sourceId}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return report;
}
