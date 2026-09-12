// The agent runner: load the graph, run the deterministic checks, write the Signals.
//
// Slice 1 runs the checks that need no model and no Slack. Drafting, phrasing and nudging
// arrive with the Knowledge store; what matters now is that the observations are real, keyed,
// and auditable — an agent that proposes nothing but is right is worth more than one that
// talks and is not.

import { prisma } from '@/lib/prisma';
import { emit, type EmitReport } from '@/lib/signals/emit';
import { gatedCtaContrast, anomalyChecks, dnaGapChecks, stuckWorkChecks, type PostFacts } from '@/lib/signals/checks/cohort';
import { median, viewsOf, type MetricKey } from '@/lib/publications/repository';
import { captionFromRaw } from '@/lib/performance/attribution';

const DAY1 = { min: 6, max: 48 };
const METRICS: MetricKey[] = ['views', 'reach', 'engagementRate', 'saves', 'shares', 'comments', 'likes', 'avgWatchSeconds'];

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Day-one facts per publication: the first capture 6–48h after publish. */
async function loadPostFacts(): Promise<PostFacts[]> {
  const pubs = await prisma.publication.findMany({
    where: { publishedAt: { not: null }, removedFromPlatformAt: null },
    select: {
      id: true, accountRef: true, postType: true, publishedAt: true, ticketAirtableId: true,
      metrics: {
        select: {
          capturedAt: true, views: true, reach: true, engagementRate: true, saves: true,
          shares: true, comments: true, likes: true, avgWatchSeconds: true,
          collaborators: true, raw: true,
        },
        orderBy: { capturedAt: 'asc' },
      },
    },
  });

  const ticketIds = [...new Set(pubs.map((p) => p.ticketAirtableId).filter((x): x is string => !!x))];
  const tickets = ticketIds.length
    ? await prisma.ticket.findMany({
        where: { airtableId: { in: ticketIds } },
        select: { airtableId: true, title: true, assigneeName: true, assignee: { select: { name: true } }, assetType: { select: { name: true } } },
      })
    : [];
  const ticketById = new Map(tickets.map((t) => [t.airtableId!, t]));

  const out: PostFacts[] = [];
  for (const p of pubs) {
    if (!p.publishedAt) continue;
    const first = p.metrics.find((m) => {
      const h = (m.capturedAt.getTime() - p.publishedAt!.getTime()) / 3_600_000;
      return h >= DAY1.min && h <= DAY1.max;
    });
    if (!first) continue;

    const day1: Partial<Record<MetricKey, number>> = {};
    for (const k of METRICS) {
      // views comes out of `raw`, not the column — see viewsOf(). `raw` is already selected.
      const v = k === 'views' ? viewsOf(first) : num((first as Record<string, unknown>)[k]);
      if (v !== null) day1[k] = v;
    }
    const collaborators = Array.isArray(first.collaborators)
      ? (first.collaborators as Array<{ username?: unknown; inviteStatus?: unknown }>).map((c) => ({
          username: typeof c?.username === 'string' ? c.username : null,
          inviteStatus: typeof c?.inviteStatus === 'string' ? c.inviteStatus : null,
        }))
      : [];

    const t = p.ticketAirtableId ? ticketById.get(p.ticketAirtableId) : undefined;
    out.push({
      publicationId: p.id,
      accountRef: p.accountRef,
      postType: p.postType,
      publishedAt: p.publishedAt,
      title: t?.title ?? null,
      caption: captionFromRaw(first.raw),
      ticketAirtableId: p.ticketAirtableId,
      editor: t?.assignee?.name ?? t?.assigneeName ?? null,
      assetType: t?.assetType?.name ?? null,
      day1,
      collaborators,
    });
  }
  return out;
}

export interface RunReport {
  postsConsidered: number;
  checks: Record<string, EmitReport>;
}

/** Run every deterministic check. Safe to re-run: the natural key absorbs it [D103]. */
export async function runDeterministicChecks(): Promise<RunReport> {
  const facts = await loadPostFacts();
  const checks: Record<string, EmitReport> = {};

  // Cohorts are per account × post type — the only grouping where a median means anything.
  const groups = new Map<string, PostFacts[]>();
  for (const f of facts) {
    if (!f.postType || /STORY/i.test(f.postType)) continue;
    const key = `${f.accountRef}|${f.postType}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(f);
  }

  const learnings = [];
  const anomalies = [];
  for (const [key, posts] of groups) {
    const [accountRef] = key.split('|');
    learnings.push(...gatedCtaContrast(posts, accountRef));

    const cohortMedians: Partial<Record<MetricKey, number>> = {};
    for (const m of METRICS) {
      const vals = posts.map((p) => p.day1[m]).filter((v): v is number => v !== undefined);
      const med = median(vals);
      if (med !== null) cohortMedians[m] = med;
    }
    anomalies.push(...anomalyChecks(posts, { cohortMedians, n: posts.length }));
  }
  checks['gated-cta-contrast'] = await emit('social', 'gated-cta-contrast', learnings);
  checks['day1-anomaly'] = await emit('social', 'day1-anomaly', anomalies);

  // Asset types carrying real volume but no documented standard.
  const since = new Date(Date.now() - 60 * 86_400_000);
  const types = await prisma.assetType.findMany({
    where: { active: true },
    select: {
      name: true, dnaRequirements: true, dnaUpstream: true,
      teamLeads: { select: { employee: { select: { name: true } } } },
      _count: { select: { tickets: { where: { createdAt: { gte: since } } } } },
    },
  });
  checks['asset-type-without-dna'] = await emit('video', 'asset-type-without-dna', dnaGapChecks(
    types.map((t) => ({
      name: t.name,
      hasDna: Boolean((t.dnaRequirements ?? t.dnaUpstream ?? '').trim()),
      ticketsLast60d: t._count.tickets,
      lead: t.teamLeads[0]?.employee?.name ?? null,
    })),
  ));

  // Work that has not moved. Age is measured from the last recorded status change, because
  // ticket statuses have no transition graph — only events tell you anything actually happened.
  const open = await prisma.ticket.findMany({
    where: { ticketStatus: { in: ['In Progress', 'Review', 'In Revision'] }, createdAt: { gte: new Date(Date.now() - 180 * 86_400_000) } },
    select: {
      airtableId: true, title: true, ticketStatus: true, createdAt: true,
      assigneeName: true, assignee: { select: { name: true } },
      typeOfRequest: true,
      events: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
    },
  });
  checks['stuck-work'] = await emit('video', 'stuck-work', stuckWorkChecks(
    open
      .filter((t) => t.airtableId)
      .map((t) => ({
        id: t.airtableId!,
        title: t.title,
        lane: (t.typeOfRequest ?? '').toLowerCase() === 'design' ? 'design' : 'video',
        status: t.ticketStatus ?? 'open',
        assignee: t.assignee?.name ?? t.assigneeName ?? null,
        daysSinceEvent: (Date.now() - (t.events[0]?.createdAt ?? t.createdAt).getTime()) / 86_400_000,
      })),
  ));

  return { postsConsidered: facts.length, checks };
}
