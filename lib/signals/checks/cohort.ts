// The deterministic checks — the half of the intelligence that needs no model.
//
// Every function here is pure: graph in, SignalInput[] out. No database, no network, no
// Anthropic call. That is not a style preference. Numbers a language model produced cannot
// be reproduced, argued with, or trusted after the third time one of them is wrong — and
// this team has already watched a generator invent revenue. Statistics choose the pattern;
// phrasing can come later, with the numbers already fixed [D37].

import type { SignalInput } from '@/lib/signals/emit';
import { median, PROPOSAL_FLOOR, type MetricKey } from '@/lib/publications/repository';

export interface PostFacts {
  publicationId: string;
  accountRef: string;
  postType: string | null;
  publishedAt: Date | null;
  title: string | null;
  caption: string | null;
  ticketAirtableId: string | null;
  editor: string | null;
  assetType: string | null;
  /** Day-1 values, keyed by metric. */
  day1: Partial<Record<MetricKey, number>>;
  collaborators: Array<{ username: string | null; inviteStatus: string | null }>;
}

const pct = (a: number, b: number): number => Math.round(((a / b) - 1) * 100);
const fmt = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/**
 * A contrast is two groups of the same post type on the same account, split by one attribute.
 *
 * Both sides must clear the floor [D12]. The floor is the entire defence against the failure
 * everyone fears here: a confident sentence built on four posts, acted on, and wrong. Below it
 * the finding is still computed and still shown — as something to watch, never as a rule.
 */
function contrast(
  posts: PostFacts[],
  predicate: (p: PostFacts) => boolean,
  metric: MetricKey,
): { withMedian: number; withoutMedian: number; nWith: number; nWithout: number; delta: number } | null {
  const withVals = posts.filter((p) => predicate(p)).map((p) => p.day1[metric]).filter((v): v is number => v !== undefined);
  const withoutVals = posts.filter((p) => !predicate(p)).map((p) => p.day1[metric]).filter((v): v is number => v !== undefined);
  if (withVals.length < PROPOSAL_FLOOR || withoutVals.length < PROPOSAL_FLOOR) return null;
  const a = median(withVals);
  const b = median(withoutVals);
  if (a === null || b === null || b === 0) return null;
  return { withMedian: a, withoutMedian: b, nWith: withVals.length, nWithout: withoutVals.length, delta: pct(a, b) };
}

const isGatedCta = (p: PostFacts): boolean => /comment\s*["'“]/i.test(p.caption ?? '');

/**
 * Gated-CTA captions: fewer people see them, more people reply.
 *
 * Emitted as one Signal carrying both halves, because either on its own is misleading. "Views
 * are down 27%" reads as a failing post; "comments are up 52%" reads as a triumph. Together
 * they say what is actually true — the format trades reach for replies, so pick the goal
 * before writing the caption, and judge it on the goal you picked.
 */
export function gatedCtaContrast(posts: PostFacts[], accountRef: string): SignalInput[] {
  const views = contrast(posts, isGatedCta, 'views');
  const comments = contrast(posts, isGatedCta, 'comments');
  if (!views && !comments) return [];

  const parts: string[] = [];
  if (views) parts.push(`first-day views ${views.delta > 0 ? '+' : ''}${views.delta}% (median ${fmt(views.withMedian)} gated vs ${fmt(views.withoutMedian)} open, n=${views.nWith} vs ${views.nWithout})`);
  if (comments) parts.push(`comments ${comments.delta > 0 ? '+' : ''}${comments.delta}% (median ${fmt(comments.withMedian)} vs ${fmt(comments.withoutMedian)}, n=${comments.nWith} vs ${comments.nWithout})`);

  return [{
    agent: 'social',
    checkId: 'gated-cta-contrast',
    kind: 'learning',
    lane: 'social',
    subjectType: 'account',
    subjectId: accountRef,
    title: 'Comment-gated captions trade reach for replies',
    body: `On ${accountRef}: ${parts.join('; ')}. The format is not better or worse — it is a different goal. Pick reach or conversation before the caption is written, and judge the post on the one you picked.`,
    evidence: {
      cohort: `${accountRef} · same post type · first-day capture`,
      views, comments,
      n: (views?.nWith ?? 0) + (views?.nWithout ?? 0),
    },
    ownerHint: 'Glen · Vidura (caption) → Titus (brief)',
  }];
}

/**
 * A post far below its cohort at day one, with the cause separated.
 *
 * This is the check that decides whether an editor gets told their work underperformed. So it
 * refuses to say that unless it has ruled out the alternative: if retention is at or above the
 * cohort while views are far below, the cut held attention and the problem is distribution —
 * a pending collaborator invite, a bad slot, a caption that suppressed reach. Telling an
 * editor their edit failed when it did not is how a system like this loses its audience.
 */
export function anomalyChecks(posts: PostFacts[], opts: { threshold?: number; cohortMedians: Partial<Record<MetricKey, number>>; n: number }): SignalInput[] {
  const threshold = opts.threshold ?? 0.5;
  if (opts.n < PROPOSAL_FLOOR) return [];
  const out: SignalInput[] = [];

  for (const p of posts) {
    const views = p.day1.views;
    const medianViews = opts.cohortMedians.views;
    if (views === undefined || !medianViews) continue;
    if (views >= medianViews * threshold) continue;

    const watch = p.day1.avgWatchSeconds;
    const medianWatch = opts.cohortMedians.avgWatchSeconds;
    const heldAttention = watch !== undefined && medianWatch !== undefined && watch >= medianWatch;
    const pending = p.collaborators.filter((c) => (c.inviteStatus ?? '').toLowerCase() === 'pending');

    const distribution: string[] = [];
    if (pending.length) distribution.push(`${pending.length === 1 ? 'a collaborator invite is' : `${pending.length} collaborator invites are`} still pending (${pending.map((c) => '@' + (c.username ?? '?')).join(', ')}) — the post reached one audience instead of two`);
    if (isGatedCta(p)) distribution.push('the caption is comment-gated, which trades reach for replies');

    const edit = heldAttention
      ? `retention is fine: ${fmt(watch!)}s average watch against a cohort median of ${fmt(medianWatch!)}s — the cut held attention`
      : watch !== undefined && medianWatch !== undefined
        ? `retention is also below the cohort: ${fmt(watch)}s against ${fmt(medianWatch)}s`
        : 'no retention figure was captured for this post';

    out.push({
      agent: 'social',
      checkId: 'day1-anomaly',
      kind: 'anomaly',
      lane: 'social',
      subjectType: 'publication',
      subjectId: p.publicationId,
      publicationId: p.publicationId,
      title: `${fmt(views)} first-day views against a cohort median of ${fmt(medianViews)}`,
      body: [
        `${p.title ?? 'This post'} took ${fmt(views)} views in its first day, against ${fmt(medianViews)} for ${p.accountRef} posts of the same type (n=${opts.n}).`,
        `Edit signal — ${edit}.`,
        distribution.length
          ? `Distribution signal — ${distribution.join('; ')}.`
          : 'Distribution signal — nothing obvious: no pending collaborator, no gated caption.',
        heldAttention ? 'On the evidence this is a distribution problem, not an editing one.' : '',
      ].filter(Boolean).join(' '),
      evidence: {
        cohort: `${p.accountRef} · ${p.postType ?? 'post'} · first day`,
        n: opts.n,
        views, medianViews, watch: watch ?? null, medianWatch: medianWatch ?? null,
        pendingCollaborators: pending.map((c) => c.username),
        ticket: p.ticketAirtableId,
      },
      ownerHint: heldAttention ? 'Glen (distribution)' : (p.editor ?? 'Titus'),
    });
  }
  return out;
}

/**
 * An asset type with no DNA text cannot be reviewed against a standard, so every review on it
 * says so and the first-cut agent has nothing to apply. It is a gap in the system, not a
 * failure of the work, and it belongs to whoever owns the type.
 */
export function dnaGapChecks(types: Array<{ name: string; hasDna: boolean; ticketsLast60d: number; lead: string | null }>): SignalInput[] {
  return types
    .filter((t) => !t.hasDna && t.ticketsLast60d >= 5)
    .map((t) => ({
      agent: 'video' as const,
      checkId: 'asset-type-without-dna',
      kind: 'gap' as const,
      subjectType: 'assetType' as const,
      subjectId: t.name,
      title: `${t.name} has no DNA text`,
      body: `${t.ticketsLast60d} tickets of this type were raised in the last 60 days and none of them could be reviewed against a documented standard — every DNA review on this type says exactly that. Until someone writes the first version, the review can only check the brief, and the first-cut agent has nothing to apply.`,
      evidence: { ticketsLast60d: t.ticketsLast60d, n: t.ticketsLast60d },
      ownerHint: t.lead ?? 'Titus',
    }));
}

/**
 * Work that has not moved. The threshold differs by lane because the work does: a video
 * ticket that has sat for a fortnight is late, a design ticket often has a legitimate
 * three-week shape [D86].
 */
export function stuckWorkChecks(tickets: Array<{ id: string; title: string; lane: string; status: string; assignee: string | null; daysSinceEvent: number }>): SignalInput[] {
  return tickets
    .filter((t) => t.daysSinceEvent >= (t.lane === 'design' ? 21 : 14))
    .map((t) => ({
      agent: (t.lane === 'design' ? 'design' : 'video') as 'design' | 'video',
      checkId: 'stuck-work',
      kind: 'blocker' as const,
      lane: t.lane,
      subjectType: 'ticket' as const,
      subjectId: t.id,
      title: `${Math.round(t.daysSinceEvent)} days without a status change`,
      body: `“${t.title}” has been ${t.status} for ${Math.round(t.daysSinceEvent)} days with no recorded status change${t.assignee ? `, assigned to ${t.assignee}` : ' and unassigned'}. Either the work is finished and unmarked, or it is stuck — both are worth a minute.`,
      evidence: { daysSinceEvent: Math.round(t.daysSinceEvent), status: t.status, n: 1 },
      ownerHint: t.assignee,
    }));
}
