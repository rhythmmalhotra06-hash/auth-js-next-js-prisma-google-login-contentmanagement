// Performance attribution: which ticket produced this published post?
//
// The join key is the CAPTION TEXT, because it is the only identifier that exists on both
// sides today:
//   - Hootsuite Perch hands us the published caption in `SocialMetric.raw.details.content.body`
//     (650 of 943 production rows carry it) alongside the platform id and permalink.
//   - Airtable's 📣 Social row carries the same copy in "✍️ Social Media Captions"
//     (SocialPost.captions) next to the ticket recId (SocialPost.creativeTicketId).
//
// Why not the published URL, which would be exact: Airtable's "Instagram Published Link" is
// filled on 1 of 8,546 rows, and `assets` has 0 rows in production, so there is nothing to
// match a permalink against. The caption is the half that is actually populated. Full
// investigation: plans/nvestigate-what-composio-actually-streamed-eclipse.md.
//
// Why fragment overlap rather than string equality: the Airtable caption is authoring copy,
// not the final post. Real samples carry posting instructions ("Post on (4am)"), collab
// handles, V1/V2/V3 variant blocks, markdown emphasis and strikethrough, and bilingual
// EN+DE / EN+ES text in ONE field where the live post carries a single language. Whole-field
// equality matches nothing. So we compare sets of normalized long fragments and require a
// substantial, unambiguous overlap.

import { prisma } from '@/lib/prisma';

/** A fragment shorter than this is too generic to be evidence ("Link in bio", "Post on 4am"). */
const MIN_FRAGMENT_CHARS = 40;

/** Total shared normalized characters required before we call it a match. */
const MIN_MATCH_CHARS = 80;

export interface AttributionReport {
  /** Distinct published posts considered (metric rows collapse by post). */
  postsScanned: number;
  /** Posts resolved to exactly one ticket. */
  postsMatched: number;
  /** `social_metrics` rows stamped with a ticket id. */
  rowsUpdated: number;
  /** Posts whose best candidates tied — deliberately left unattributed. */
  ambiguous: number;
  /** Posts with no candidate over the threshold. */
  unmatched: number;
  /** Posts whose Perch payload carried no caption body at all. */
  noCaption: number;
}

/**
 * Canonical form of one caption fragment. Strips everything that differs between authoring
 * copy and a live post — angle-wrapped and bare URLs, markdown emphasis/strikethrough, and
 * all punctuation and emoji — then lowercases and collapses whitespace.
 *
 * Punctuation goes because the two sides disagree on it constantly (curly vs straight
 * quotes, an em dash the scheduler rewrote); letters and digits are the durable signal.
 * `\p{L}` keeps accented and non-Latin text intact, which matters — a third of these posts
 * are German or Spanish.
 */
export function normalizeFragment(s: string): string {
  return s
    .replace(/<[^>]*>/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * The set of long, normalized fragments in a caption.
 *
 * Splitting on line breaks AND sentence terminators is what makes the instruction preamble
 * and the variant markers fall out on their own: "Post on (4am)", "V3", "Collab with" and
 * "Link in bio" are all shorter than MIN_FRAGMENT_CHARS once normalized, so they never
 * become evidence and we need no fragile list of prefixes to strip. It is also what makes
 * the bilingual fields work — the EN and DE halves become separate fragments, and a post
 * in either language matches its own half.
 */
export function captionFingerprint(text: string | null | undefined): Set<string> {
  const out = new Set<string>();
  if (!text) return out;
  for (const piece of text.split(/\n+|(?<=[.!?])\s+/)) {
    const n = normalizeFragment(piece);
    if (n.length >= MIN_FRAGMENT_CHARS) out.add(n);
  }
  return out;
}

/** Shared normalized characters between two fingerprints. Symmetric, order-free. */
export function overlapChars(a: Set<string>, b: Set<string>): number {
  let total = 0;
  // Iterate the smaller set — these are per-post comparisons run in a loop.
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const frag of small) if (large.has(frag)) total += frag.length;
  return total;
}

/** Pull the published caption out of a Perch payload. Shape: raw.details.content.body. */
export function captionFromRaw(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const details = (raw as { details?: unknown }).details;
  if (!details || typeof details !== 'object') return null;
  const content = (details as { content?: unknown }).content;
  if (!content || typeof content !== 'object') return null;
  const body = (content as { body?: unknown }).body;
  return typeof body === 'string' && body.trim() ? body : null;
}

interface Candidate {
  ticketAirtableId: string;
  fingerprint: Set<string>;
}

/**
 * Resolve the winning ticket for one caption, or null.
 *
 * A strict winner is required: if two candidates score the same, we attribute nothing. That
 * is the case that actually occurs — an English post can appear verbatim inside both the
 * German row's caption and the Spanish row's caption, and picking either would silently
 * credit the wrong ticket. An unattributed row is visible in the report; a wrong one is not.
 */
export function bestCandidate(
  caption: string,
  candidates: Candidate[],
): { ticketAirtableId: string; score: number } | 'ambiguous' | null {
  const fp = captionFingerprint(caption);
  if (fp.size === 0) return null;

  let best: { ticketAirtableId: string; score: number } | null = null;
  let runnerUp = 0;

  for (const c of candidates) {
    const score = overlapChars(fp, c.fingerprint);
    if (score < MIN_MATCH_CHARS) continue;
    if (!best || score > best.score) {
      if (best) runnerUp = best.score;
      best = { ticketAirtableId: c.ticketAirtableId, score };
    } else if (score > runnerUp) {
      runnerUp = score;
    }
  }

  if (!best) return null;
  // Distinct rows can legitimately carry the same ticket (one ticket, several channels), so
  // only a tie across DIFFERENT tickets is ambiguous.
  if (runnerUp === best.score) return 'ambiguous';
  return best;
}

/**
 * Match unattributed metric rows to tickets and stamp `SocialMetric.ticketAirtableId`.
 *
 * Writes to the existing column on purpose: it is already indexed
 * (`idx_social_metrics_ticket`) and `inheritLinks()` in lib/metrics/social-perf.ts already
 * carries it forward onto tomorrow's rows, so an attribution made once sticks instead of
 * evaporating on the next pull.
 */
export async function attributeMetrics(opts: { dryRun?: boolean } = {}): Promise<AttributionReport> {
  const report: AttributionReport = {
    postsScanned: 0, postsMatched: 0, rowsUpdated: 0, ambiguous: 0, unmatched: 0, noCaption: 0,
  };

  const posts = await prisma.socialPost.findMany({
    where: { creativeTicketId: { not: null }, captions: { not: null } },
    select: { creativeTicketId: true, captions: true },
  });

  const candidates: Candidate[] = [];
  for (const p of posts) {
    const fingerprint = captionFingerprint(p.captions);
    if (fingerprint.size === 0 || !p.creativeTicketId) continue;
    candidates.push({ ticketAirtableId: p.creativeTicketId, fingerprint });
  }
  if (candidates.length === 0) return report;

  const rows = await prisma.socialMetric.findMany({
    where: { ticketAirtableId: null },
    select: { id: true, platformPostId: true, publishedUrl: true, raw: true },
  });

  // Collapse to one decision per post: metric rows repeat per window and per captured day,
  // and every row for a post must land on the same ticket.
  const byPost = new Map<string, { ids: string[]; caption: string | null }>();
  for (const r of rows) {
    const key = r.platformPostId ?? r.publishedUrl;
    if (!key) continue;
    const entry = byPost.get(key) ?? { ids: [], caption: null };
    entry.ids.push(r.id);
    entry.caption ??= captionFromRaw(r.raw);
    byPost.set(key, entry);
  }

  report.postsScanned = byPost.size;

  for (const { ids, caption } of byPost.values()) {
    if (!caption) { report.noCaption++; continue; }

    const result = bestCandidate(caption, candidates);
    if (result === null) { report.unmatched++; continue; }
    if (result === 'ambiguous') { report.ambiguous++; continue; }

    report.postsMatched++;
    if (opts.dryRun) { report.rowsUpdated += ids.length; continue; }

    const { count } = await prisma.socialMetric.updateMany({
      where: { id: { in: ids } },
      data: { ticketAirtableId: result.ticketAirtableId },
    });
    report.rowsUpdated += count;
  }

  return report;
}
