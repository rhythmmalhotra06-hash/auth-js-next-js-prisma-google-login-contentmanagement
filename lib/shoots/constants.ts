// Client-safe shoot constants + the ShootRow shape. No server imports here so both
// client components (forms, the queue board) and the server repository can use them.

// Live singleSelect option values (must match Airtable exactly — see field-map.ts SHOOTS).
export const SHOOT_FORMATS = ['Studio', 'VLOG', 'Broll', 'Testimonial', 'Livestream', 'Interview'] as const;
export const SHOOT_LOCATIONS = [
  'Studio Time - Tallinn',
  'Studio Time - KL',
  'Studio Time - London',
  'MVU 2025',
  'MVU 2026',
  'External Recording',
] as const;

// Platforms a shoot's asset may be published to ("Platfom" multipleSelects — live typo).
export const SHOOT_PLATFORMS = ['Youtube', 'Facebook', 'Instagram', 'Twitter', 'LinkedIn', 'TikTok'] as const;

// Max value of the "Priority Ranking (Manual)" star rating in Airtable.
export const SHOOT_RANK_MAX = 10;

// Status values (the "New Requests - " prefix is part of the live enum).
export const SHOOT_STATUS = {
  needsReview: "New Requests - Needs Vishen's Review",
  approved: 'New Requests - Approved by Vishen',
  toFilm: 'To Film',
  filmed: 'Done - Filmed',
  cancelled: 'Cancelled',
} as const;

// Lifecycle order for grouping the queue.
export const SHOOT_STATUS_ORDER: string[] = [
  SHOOT_STATUS.needsReview,
  SHOOT_STATUS.approved,
  SHOOT_STATUS.toFilm,
  SHOOT_STATUS.filmed,
  SHOOT_STATUS.cancelled,
];

import type { Tone } from '@/components/ui/Badge';
export const SHOOT_STATUS_TONE: Record<string, Tone> = {
  [SHOOT_STATUS.needsReview]: 'warning',
  [SHOOT_STATUS.approved]: 'brand',
  [SHOOT_STATUS.toFilm]: 'info',
  [SHOOT_STATUS.filmed]: 'success',
  [SHOOT_STATUS.cancelled]: 'neutral',
};

// Shorter status labels for dense UI (drops the "New Requests - " prefix).
export function shortStatus(status: string | null): string {
  if (!status) return '—';
  return status.replace(/^New Requests - /, '');
}

// Low-level create input (recIds for links). Shared by the Airtable + Postgres write impls.
export interface CreateShootInput {
  title: string;
  format?: string | null; // Studio | VLOG | Broll | Testimonial | Livestream
  brief?: string | null;
  productionSupport?: string | null;
  filmingLocation?: string | null; // must match a Filming Location option
  filmingDate?: string | null; // ISO date
  vishenApproved?: boolean;
  requestedByRecId?: string | null; // Employee recId ("Requester" link)
  authorRecIds?: string[];
  eventTypeRecIds?: string[];
  assetTypeRecIds?: string[];
}

// Typed patch for shoot edits — backend-agnostic. The Airtable impl maps these to
// field IDs; the Postgres impl maps them to columns (+ enqueues an outbox push).
export interface ShootPatch {
  status?: string | null;
  format?: string | null;
  filmingDate?: string | null; // ISO date; '' / null clears
  filmingLocation?: string | null;
  brief?: string | null;
  productionSupport?: string | null;
  rawFiles?: string | null;
  vishenApproved?: boolean;
  platforms?: string[];
  eventTypeIds?: string[];
  priorityRanking?: number | null;
  ticketIds?: string[]; // postProductionTicket link (recIds)
  newPrioTicket?: boolean;
}

export interface ShootRow {
  id: string;
  title: string | null;
  status: string | null;
  format: string | null;
  filmingDate: string | null;
  filmingLocation: string | null;
  brief: string | null;
  productionSupport: string | null;
  vishenApproved: boolean;
  priorityRanking: number | null;
  rawFiles: string | null;
  platforms: string[];
  newPrioTicket: boolean;
  requestedById: string | null;
  authorIds: string[];
  eventTypeIds: string[];
  assetLibraryIds: string[];
  ticketIds: string[];
  ticketCount: number;
  createdTime: string;
}
