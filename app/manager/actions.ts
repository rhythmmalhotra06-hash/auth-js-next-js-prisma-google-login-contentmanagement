'use server';

import { revalidatePath } from 'next/cache';
import { recomputeAllScores } from '@/lib/tickets/score-service';

export async function recomputePriority(): Promise<{ ok: boolean; scored: number }> {
  const scored = await recomputeAllScores();
  revalidatePath('/manager');
  revalidatePath('/tickets');
  revalidatePath('/editor');
  return { ok: true, scored };
}
