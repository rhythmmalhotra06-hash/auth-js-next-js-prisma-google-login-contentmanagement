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
import { formatCount } from '@/lib/metrics/social-metric-types';

const MAX_WINNERS = 3;

function line(caption: string | null, max = 70): string {
  const flat = (caption ?? 'Untitled post').replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max).trimEnd()}…` : flat;
}

function boardSection(board: AccountBoard): string {
  const out: string[] = [];
  const trend = board.trendPct !== null
    ? ` · ${board.trendPct >= 0 ? '↑' : '↓'} ${Math.abs(board.trendPct)}% vs the week before`
    : '';
  out.push(`*@${board.account}* — ${formatCount(board.reach)} reach across ${board.posts} post${board.posts === 1 ? '' : 's'}${trend}`);
  if (board.medianReach) out.push(`Typical post: ${formatCount(board.medianReach)} reach`);

  const winners = board.top.slice(0, MAX_WINNERS);
  if (winners.length) {
    out.push('*What won*');
    for (const p of winners) {
      const multiple = p.vsMedian !== null ? ` (${p.vsMedian}× typical)` : '';
      const eng = p.engagementRate !== null ? `, ${p.engagementRate}% eng` : '';
      const link = p.url ? ` <${p.url}|open>` : '';
      out.push(`• ${formatCount(p.reach)}${multiple}${eng} — ${line(p.caption)}${link}`);
    }
  }

  if (board.underperformers.length) {
    out.push('*Below half the baseline*');
    for (const p of board.underperformers) {
      out.push(`• ${formatCount(p.reach)} — ${line(p.caption)}`);
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
