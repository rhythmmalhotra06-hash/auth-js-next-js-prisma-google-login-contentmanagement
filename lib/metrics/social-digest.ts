// Weekly social performance digest → Slack.
//
// The page only helps people who visit it. This brings the three things worth knowing to
// where the team already is: what won, which way the numbers are moving, and what fell
// below the account's own baseline.
//
// Composed from the same getAccountPerformance() the page renders, so the digest can never
// disagree with the page.

import { postToChannel, contentReadyChannel } from '@/lib/notify/slack';
import { getAccountPerformance, type AccountBoard } from '@/lib/metrics/social-perf';
import { formatCount, formatPct } from '@/lib/metrics/social-metric-types';

const MAX_WINNERS = 3;

/** A post's label. Many posts here carry no caption text at all, so fall back to the link
 *  rather than printing "Untitled post" repeatedly. */
function label(caption: string | null, url: string | null, max = 70): string {
  const flat = (caption ?? '').replace(/\s+/g, ' ').trim();
  if (!flat) return url ? `<${url}|(no caption — open post)>` : '(no caption)';
  const text = flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
  return url ? `${text} <${url}|open>` : text;
}

function boardSection(board: AccountBoard): string {
  const out: string[] = [];
  const trend = board.trendPct !== null
    ? ` · ${board.trendPct === 0 ? 'flat' : `${board.trendPct > 0 ? '↑' : '↓'} ${Math.abs(board.trendPct)}%`} vs the week before`
    : '';
  out.push(`*@${board.account}* — ${formatCount(board.reach)} reach across ${board.posts} post${board.posts === 1 ? '' : 's'}${trend}`);
  if (board.medianReach) {
    const split = board.kinds.story > 0
      ? ` (median of ${board.kinds.post} posts; ${board.kinds.story} stories are judged against each other)`
      : '';
    out.push(`Typical post: ${formatCount(board.medianReach)} reach${split}`);
  }

  const winners = board.top.slice(0, MAX_WINNERS);
  if (winners.length) {
    out.push('*What won*');
    for (const p of winners) {
      // Percentile leads, not the multiple: reach here spans 1k–172k, so "62× typical"
      // reads as a bug while "top 2%" reads as a fact.
      const rank = p.percentile !== null ? ` (top ${Math.max(1, 100 - p.percentile)}%)` : '';
      const eng = p.engagementRate !== null ? `, ${formatPct(p.engagementRate)} eng` : '';
      const kind = p.kind === 'story' ? ' [story]' : '';
      out.push(`• ${formatCount(p.reach)}${rank}${eng}${kind} — ${label(p.caption, p.url)}`);
    }
  }

  if (board.underperformers.length) {
    out.push('*Below half the baseline*');
    for (const p of board.underperformers) {
      out.push(`• ${formatCount(p.reach)} — ${label(p.caption, p.url)}`);
    }
  }
  return out.join('\n');
}

export interface DigestResult {
  sent: boolean;
  reason?: string;
  channel?: string;
  accounts: number;
  posts: number;
  preview: string;
}

/**
 * Build and (unless `dryRun`) post the digest. Returns the composed text either way, so a
 * scheduled run can be inspected without spamming the channel.
 */
export async function sendSocialDigest(opts?: { dryRun?: boolean; channel?: string }): Promise<DigestResult> {
  const data = await getAccountPerformance({ limit: MAX_WINNERS });

  if (data.posts === 0) {
    // Silence beats a weekly "nothing to report" — that's how a digest gets muted.
    return { sent: false, reason: 'no metrics stored yet', accounts: 0, posts: 0, preview: '' };
  }

  const header = data.boards.length > 1
    ? `*Social performance — last 30 days*\n${formatCount(data.reach)} reach across ${data.posts} posts on ${data.boards.length} accounts.`
    : '*Social performance — last 30 days*';

  const text = [
    header,
    ...data.boards.map(boardSection),
    data.attributed === 0
      ? '_None of these are linked to a ticket yet — open Performance to attach them, and future pulls keep the link._'
      : `_${data.attributed} post${data.attributed === 1 ? '' : 's'} linked to a ticket._`,
  ].join('\n\n');

  const channel = opts?.channel || contentReadyChannel();
  if (opts?.dryRun) {
    return { sent: false, reason: 'dry run', channel, accounts: data.boards.length, posts: data.posts, preview: text };
  }
  if (!channel) {
    return { sent: false, reason: 'no Slack channel configured', accounts: data.boards.length, posts: data.posts, preview: text };
  }

  await postToChannel(channel, text);
  return { sent: true, channel, accounts: data.boards.length, posts: data.posts, preview: text };
}
