'use server';

import { revalidatePath } from 'next/cache';
import { updateClipSuggestion } from '@/lib/media/repository';

// The clip-approval gate. Approve → 'Approved' (ready to convert to a ticket);
// Dismiss → 'Dismissed'. Writes Clip Suggestions Status directly in Airtable.
export async function approveClip(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await updateClipSuggestion(id, { status: 'Approved' });
  revalidatePath('/vishen');
  return r.ok ? { ok: true } : { ok: false, error: r.error.message };
}

export async function dismissClip(id: string): Promise<{ ok: boolean; error?: string }> {
  const r = await updateClipSuggestion(id, { status: 'Dismissed' });
  revalidatePath('/vishen');
  return r.ok ? { ok: true } : { ok: false, error: r.error.message };
}
