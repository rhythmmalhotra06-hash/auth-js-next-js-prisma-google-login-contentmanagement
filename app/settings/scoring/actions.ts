'use server';

import { revalidatePath } from 'next/cache';
import { getScoringConfigAccess } from '@/lib/scoring-config/access';
import {
  updateGlobalValue, updateEventTypeScoring, updateAssetTypeScoring, updateCapacity,
  type EventTypeField, type AssetTypeField,
} from '@/lib/scoring-config/repository';
import { recomputeAllScores } from '@/lib/tickets/score-service';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function guard(): Promise<{ email: string | null } | { error: string }> {
  const { canEdit, email } = await getScoringConfigAccess();
  if (!canEdit) return { error: 'You don’t have permission to edit scoring config.' };
  return { email };
}

function revalidate() {
  revalidatePath('/settings/scoring');
  revalidatePath('/performance');
}

/** A blank/invalid number clears the override (revert to default); used by per-type & capacity edits. */
function parseOptional(raw: string): number | null | { error: string } {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return { error: 'Enter a non-negative number, or leave blank to reset.' };
  return n;
}

/** Global knob — a value is always required (these rows are seeded, never blank). */
export async function setGlobalValue(recId: string, raw: string): Promise<ActionResult> {
  const g = await guard();
  if ('error' in g) return { ok: false, error: g.error };
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n < 0) return { ok: false, error: 'Enter a non-negative number.' };
  const res = await updateGlobalValue(recId, n, g.email);
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidate();
  return { ok: true };
}

export async function setEventTypeValue(recId: string, field: EventTypeField, raw: string): Promise<ActionResult> {
  const g = await guard();
  if ('error' in g) return { ok: false, error: g.error };
  const v = parseOptional(raw);
  if (v && typeof v === 'object') return { ok: false, error: v.error };
  if (field === 'tierNorm' && v != null && v > 1) return { ok: false, error: 'Tier must be between 0 and 1.' };
  const res = await updateEventTypeScoring(recId, field, v as number | null);
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidate();
  return { ok: true };
}

export async function setAssetTypeValue(recId: string, field: AssetTypeField, raw: string): Promise<ActionResult> {
  const g = await guard();
  if ('error' in g) return { ok: false, error: g.error };
  const v = parseOptional(raw);
  if (v && typeof v === 'object') return { ok: false, error: v.error };
  if (field === 'effortNorm' && v != null && v > 1) return { ok: false, error: 'Effort must be between 0 and 1.' };
  const res = await updateAssetTypeScoring(recId, field, v as number | null);
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidate();
  return { ok: true };
}

export async function setCapacity(group: 'Creatives' | 'Freelancers & contractors', recId: string, raw: string): Promise<ActionResult> {
  const g = await guard();
  if ('error' in g) return { ok: false, error: g.error };
  const v = parseOptional(raw);
  if (v && typeof v === 'object') return { ok: false, error: v.error };
  const res = await updateCapacity(group, recId, v as number | null);
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidate();
  return { ok: true };
}

/** Recompute persisted priority scores after weight changes. */
export async function recomputeScores(): Promise<ActionResult & { count?: number }> {
  const g = await guard();
  if ('error' in g) return { ok: false, error: g.error };
  try {
    const count = await recomputeAllScores();
    revalidate();
    return { ok: true, count };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Recompute failed.' };
  }
}
