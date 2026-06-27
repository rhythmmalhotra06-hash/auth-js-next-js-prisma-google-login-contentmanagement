'use server';

import { revalidatePath } from 'next/cache';
import { setTicketStatus } from '@/lib/repositories/ticket.repository';

// POC write: update a ticket's status directly in Airtable (no Postgres).
export async function updateStatus(recordId: string, status: string): Promise<{ ok: boolean; error?: string }> {
  const res = await setTicketStatus(recordId, status);
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/airtable-poc');
  return { ok: true };
}
