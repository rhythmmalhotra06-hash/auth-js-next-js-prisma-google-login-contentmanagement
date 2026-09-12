// Publication resolution — turn stored metric rows into the noun that was missing.
//
// `lib/performance/attribution.ts` already holds the hard part: a caption fingerprint that
// survives the difference between authoring copy and a live post (posting instructions,
// collab handles, V1/V2 variant blocks, bilingual fields). It was written, tested against
// production, and never called — because the only place it had to write was
// `social_metrics.ticket_airtable_id`, and stamping a column the live Performance page reads
// is not something to do on a branch.
//
// So the fingerprint is reused verbatim and the result lands on `publications` instead. The
// existing table is never written. That is also the better model: a link belongs to the post,
// not to one of the several metric rows a post accumulates.

import { prisma } from '@/lib/prisma';
import { normalizeUrl } from '@/lib/metrics/social-metric-types';
import { captionFingerprint, captionFromRaw, bestCandidate } from '@/lib/performance/attribution';

/** How a publication came to be linked to a ticket [D43]. */
export type LinkTier = 'url' | 'caption' | 'transcript' | 'image' | 'manual';

export interface ResolveReport {
  postsScanned: number;
  publicationsCreated: number;
  publicationsUpdated: number;
  metricsLinked: number;
  linkedByUrl: number;
  linkedByCaption: number;
  /** Two tickets tied on caption overlap — deliberately left for a human [D43, D44]. */
  proposed: number;
  /** A real publication with no ticket. Legal: the social team posts directly [D45]. */
  orphans: number;
  errors: string[];
}

interface PostGroup {
  accountRef: string;
  channel: string | null;
  platformPostId: string | null;
  publishedUrl: string | null;
  postType: string | null;
  publishedAt: Date | null;
  tags: string[];
  caption: string | null;
  metricIds: string[];
}

/** Account handle as the platform reports it — `raw.details.source.name`. */
function accountFromRaw(raw: unknown): string | null {
  const source = (raw as { details?: { source?: { name?: unknown } } })?.details?.source;
  const name = source?.name;
  return typeof name === 'string' && name.trim() ? name.trim() : null;
}

/** Publish time — `raw.timestamp`, the only field that says when the post went live. */
function publishedAtFromRaw(raw: unknown): Date | null {
  const ts = (raw as { timestamp?: unknown })?.timestamp;
  if (typeof ts !== 'string') return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Collapse metric rows into one group per post.
 *
 * Rows repeat per window (1/7/30) and per captured day, so a post with a fortnight of history
 * is ~40 rows. Every one of them must land on the same publication, which is exactly the
 * property `social_metrics` could never express on its own.
 */
export function groupByPost(rows: Array<{
  id: string; platformPostId: string | null; publishedUrl: string | null;
  channel: string | null; postType: string | null; tags: string[]; raw: unknown;
}>): Map<string, PostGroup> {
  const byPost = new Map<string, PostGroup>();
  for (const r of rows) {
    const key = r.platformPostId ?? r.publishedUrl;
    if (!key) continue;
    const account = accountFromRaw(r.raw);
    // Without an account we cannot key a publication — the unique index is (account, post).
    if (!account) continue;

    const existing = byPost.get(key);
    if (existing) {
      existing.metricIds.push(r.id);
      existing.caption ??= captionFromRaw(r.raw);
      existing.postType ??= r.postType;
      existing.publishedAt ??= publishedAtFromRaw(r.raw);
      existing.publishedUrl ??= normalizeUrl(r.publishedUrl);
      for (const t of r.tags) if (!existing.tags.includes(t)) existing.tags.push(t);
      continue;
    }
    byPost.set(key, {
      accountRef: account,
      channel: r.channel,
      platformPostId: r.platformPostId,
      publishedUrl: normalizeUrl(r.publishedUrl),
      postType: r.postType,
      publishedAt: publishedAtFromRaw(r.raw),
      tags: [...r.tags],
      caption: captionFromRaw(r.raw),
      metricIds: [r.id],
    });
  }
  return byPost;
}

/**
 * Build publications from every stored metric row, and link each to a ticket where the
 * evidence allows it.
 *
 * Tiers, in order [D43]:
 *   url      — the normalized permalink matches a VishenVideo's published link. Exact, auto.
 *   caption  — ≥ 80 shared normalized characters with a 📣 Social record's caption. Auto.
 *   (tie)    — two different tickets score the same: proposed, a human confirms [D44].
 *   none     — the publication still exists, with no ticket. It stays a cohort peer [D45].
 *
 * Transcript and image tiers are not implemented here: both need a similarity method that is
 * still an open question (O3), and guessing one would put wrong numbers under someone's name.
 */
export async function buildPublications(opts: { dryRun?: boolean } = {}): Promise<ResolveReport> {
  const report: ResolveReport = {
    postsScanned: 0, publicationsCreated: 0, publicationsUpdated: 0, metricsLinked: 0,
    linkedByUrl: 0, linkedByCaption: 0, proposed: 0, orphans: 0, errors: [],
  };

  const rows = await prisma.socialMetric.findMany({
    select: {
      id: true, platformPostId: true, publishedUrl: true, channel: true,
      postType: true, tags: true, raw: true,
    },
  });
  const byPost = groupByPost(rows);
  report.postsScanned = byPost.size;
  if (byPost.size === 0) return report;

  // Candidates for the caption tier: every Social record that names a ticket and carries copy.
  const socialPosts = await prisma.socialPost.findMany({
    where: { creativeTicketId: { not: null }, captions: { not: null } },
    select: { airtableId: true, creativeTicketId: true, captions: true },
  });
  const candidates = socialPosts
    .map((p) => ({
      ticketAirtableId: p.creativeTicketId!,
      socialRecordId: p.airtableId,
      fingerprint: captionFingerprint(p.captions),
    }))
    .filter((c) => c.fingerprint.size > 0);
  const socialByTicket = new Map(candidates.map((c) => [c.ticketAirtableId, c.socialRecordId]));

  // Candidates for the url tier.
  const videos = await prisma.vishenVideo.findMany({
    where: { publishedLink: { not: null } },
    select: { id: true, publishedLink: true },
  });
  const videoByUrl = new Map<string, string>();
  for (const v of videos) {
    const n = normalizeUrl(v.publishedLink);
    if (n && !videoByUrl.has(n)) videoByUrl.set(n, v.id);
  }

  for (const group of byPost.values()) {
    let ticketAirtableId: string | null = null;
    let socialRecordId: string | null = null;
    let vishenVideoId: string | null = null;
    let linkTier: LinkTier | null = null;
    let confirmed = false;

    const urlHit = group.publishedUrl ? videoByUrl.get(group.publishedUrl) ?? null : null;
    if (urlHit) {
      vishenVideoId = urlHit;
      linkTier = 'url';
      confirmed = true;
      report.linkedByUrl++;
    }

    if (group.caption) {
      const hit = bestCandidate(group.caption, candidates);
      if (hit === 'ambiguous') {
        report.proposed++;
        linkTier ??= 'caption';
        // confirmed stays false: a tie is exactly the case a human must break.
      } else if (hit) {
        ticketAirtableId = hit.ticketAirtableId;
        socialRecordId = socialByTicket.get(hit.ticketAirtableId) ?? null;
        linkTier ??= 'caption';
        confirmed = true;
        report.linkedByCaption++;
      }
    }

    if (!ticketAirtableId && !vishenVideoId) report.orphans++;

    if (opts.dryRun) continue;

    const data = {
      accountRef: group.accountRef,
      channel: group.channel,
      platformPostId: group.platformPostId,
      publishedUrl: group.publishedUrl,
      postType: group.postType,
      publishedAt: group.publishedAt,
      tags: group.tags,
      ticketAirtableId,
      socialRecordId,
      vishenVideoId,
      linkTier,
      confirmed,
      linkedAt: linkTier ? new Date() : null,
    };

    try {
      // Keyed on whichever identifier the post actually has. `platform_post_id` is preferred:
      // a permalink can be edited or redirected, a platform id cannot.
      const where = group.platformPostId
        ? { accountRef_platformPostId: { accountRef: group.accountRef, platformPostId: group.platformPostId } }
        : { accountRef_publishedUrl: { accountRef: group.accountRef, publishedUrl: group.publishedUrl! } };

      const existing = await prisma.publication.findUnique({ where });
      const pub = existing
        ? await prisma.publication.update({
            where: { id: existing.id },
            // Never overwrite a link a human confirmed with a weaker automatic one.
            data: existing.confirmed && existing.linkTier === 'manual' ? { tags: data.tags } : data,
          })
        : await prisma.publication.create({ data });
      if (existing) report.publicationsUpdated++;
      else report.publicationsCreated++;

      const linked = await prisma.socialMetric.updateMany({
        where: { id: { in: group.metricIds }, publicationId: null },
        data: { publicationId: pub.id },
      });
      report.metricsLinked += linked.count;
    } catch (err) {
      report.errors.push(`${group.accountRef}/${group.platformPostId ?? group.publishedUrl}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return report;
}
