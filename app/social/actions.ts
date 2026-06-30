'use server';

import { revalidatePath } from 'next/cache';
import { requireSocialAccess } from '@/lib/social/guard';
import { setSocialStatus, raiseSocialRequest } from '@/lib/social/repository';

export interface SocialActionResult {
  ok: boolean;
  error?: string;
}

/** Approve a suggestion (status → "2: Approved"). Does not raise a ticket. */
export async function approveSocialSuggestion(id: string): Promise<SocialActionResult> {
  await requireSocialAccess();
  const res = await setSocialStatus(id, 'approved');
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/social');
  return { ok: true };
}

/** Reject a suggestion (status → "13: Reject"). Retained for the feedback loop. */
export async function rejectSocialSuggestion(id: string): Promise<SocialActionResult> {
  await requireSocialAccess();
  const res = await setSocialStatus(id, 'reject');
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/social');
  return { ok: true };
}

/**
 * Commit a suggestion for ticket fan-out: set the Asset Type + check "Raise Request
 * (Creative)". The portal does NOT create the ticket — checking the box triggers the
 * Airtable automation, which creates the Prio ticket(s) and links them back.
 */
export async function raiseSocialRequestAction(id: string, assetTypeId: string): Promise<SocialActionResult> {
  await requireSocialAccess();
  if (!assetTypeId) return { ok: false, error: 'Pick an asset type first.' };
  const res = await raiseSocialRequest(id, assetTypeId);
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/social');
  return { ok: true };
}
