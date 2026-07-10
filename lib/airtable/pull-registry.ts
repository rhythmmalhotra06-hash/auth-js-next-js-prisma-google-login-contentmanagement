// Pull registry — the set of domains the inbound pull route drains, one runner each.
// The route loops these so onboarding a domain is "add a runner here" (plus its
// PullDomain in the domain module). Tickets first; shoots/social/media follow.

import { pullTickets } from './pull';
import { pullShoots } from './pull-shoots';
import { pullSocial } from './pull-social';
import { pullVishenVideos } from './pull-vishen-videos';
import { pullMediaSources } from './pull-media-sources';
import { shootsArePostgres } from '@/lib/shoots/backend';
import { socialIsPostgres } from '@/lib/social/backend';
import { vishenVideosArePostgres, mediaIsPostgres } from '@/lib/media/backend';
import type { PullReport } from './pull-core';

export interface PullRunner {
  entity: string;
  run(opts: { fullResync?: boolean }): Promise<PullReport>;
}

// Each transactional domain's pull is gated on its <DOMAIN>_BACKEND=postgres flag: when a
// domain is still Airtable-served there's nothing in PG to keep fresh, and gating also avoids
// writing that domain's columns before its migration is applied (so this code is safe to deploy
// before each cutover). Each activates automatically on its flag flip. Cursor fields:
// shoots fldrfHdoRnXSqp7K3, social fldyYNCIzWdMNtys5, vishen videos fld4wVqxMStdAyNAg (2026-07-09).
export const PULL_RUNNERS: PullRunner[] = [
  { entity: 'ticket', run: pullTickets },
  ...(shootsArePostgres() ? [{ entity: 'shoot', run: pullShoots }] : []),
  ...(socialIsPostgres() ? [{ entity: 'social', run: pullSocial }] : []),
  ...(vishenVideosArePostgres() ? [{ entity: 'vishenVideo', run: pullVishenVideos }] : []),
  ...(mediaIsPostgres() ? [{ entity: 'mediaSource', run: pullMediaSources }] : []),
];
