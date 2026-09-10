'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth';
import {
  commitWeek, reopenWeek, setWeekSummary, stageLearning, deleteLearning,
  type WriteResult,
} from '@/lib/mow/week-state';

// Server actions for the Monday pack.
//
// Every one of these re-checks the committer allowlist INSIDE lib/mow/week-state.ts rather than
// trusting the UI to have hidden the button. `middleware.ts` skips /api but not server actions;
// even so, the guard lives with the write, because "the button was hidden" is not access control.

function revalidate() {
  revalidatePath('/performance/week');
  revalidatePath('/studio');
}

async function email(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

export async function commitWeekAction(weekId: string): Promise<WriteResult> {
  const res = await commitWeek(weekId, await email());
  if (res.ok) revalidate();
  return res;
}

export async function reopenWeekAction(weekId: string): Promise<WriteResult> {
  const res = await reopenWeek(weekId, await email());
  if (res.ok) revalidate();
  return res;
}

export async function setSummaryAction(weekId: string, text: string): Promise<WriteResult> {
  const res = await setWeekSummary(weekId, text, await email());
  if (res.ok) revalidate();
  return res;
}

export async function addLearningAction(
  weekId: string,
  text: string,
  leverOwner: string | null,
): Promise<WriteResult> {
  const res = await stageLearning({ weekId, text, leverOwner, email: await email() });
  if (res.ok) revalidate();
  return res;
}

export async function editLearningAction(
  weekId: string,
  learningId: string,
  text: string,
  leverOwner: string | null,
): Promise<WriteResult> {
  const res = await stageLearning({ weekId, learningId, text, leverOwner, email: await email() });
  if (res.ok) revalidate();
  return res;
}

export async function deleteLearningAction(learningId: string): Promise<WriteResult> {
  const res = await deleteLearning(learningId, await email());
  if (res.ok) revalidate();
  return res;
}
