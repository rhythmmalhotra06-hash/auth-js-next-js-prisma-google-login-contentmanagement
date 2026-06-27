'use server';

import { revalidatePath } from 'next/cache';
import { getClipRulesAccess } from '@/lib/clip-rules/access';
import { createClipRule, updateClipRule } from '@/lib/clip-rules/repository';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function guard(): Promise<{ email: string | null } | { error: string }> {
  const { canEdit, email } = await getClipRulesAccess();
  if (!canEdit) return { error: 'You don’t have permission to edit clip rules.' };
  return { email };
}

/** Update the Content of an existing row (Base Prompt, Brand Pillars, or a Rule). */
export async function updateRowContent(id: string, content: string): Promise<ActionResult> {
  const g = await guard();
  if ('error' in g) return { ok: false, error: g.error };
  if (!content.trim()) return { ok: false, error: 'Content can’t be empty.' };

  const res = await updateClipRule(id, { content: content.trim(), updatedBy: g.email });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/settings/clip-rules');
  return { ok: true };
}

export async function setRuleActive(id: string, active: boolean): Promise<ActionResult> {
  const g = await guard();
  if ('error' in g) return { ok: false, error: g.error };

  const res = await updateClipRule(id, { active, updatedBy: g.email });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/settings/clip-rules');
  return { ok: true };
}

export interface AddRuleInput {
  content: string;
  clipType: string; // All | Reel | Stage Talk | Short
  section?: string;
  note?: string;
}

export async function addRule(input: AddRuleInput): Promise<ActionResult> {
  const g = await guard();
  if ('error' in g) return { ok: false, error: g.error };

  const content = input.content?.trim();
  if (!content) return { ok: false, error: 'Rule text can’t be empty.' };
  if (!input.clipType?.trim()) return { ok: false, error: 'Pick a clip type for the rule.' };

  const res = await createClipRule({
    name: content.slice(0, 60),
    content,
    clipType: input.clipType,
    section: input.section || undefined,
    note: input.note?.trim() || undefined,
    updatedBy: g.email,
  });
  if (!res.ok) return { ok: false, error: res.error.message };
  revalidatePath('/settings/clip-rules');
  return { ok: true };
}
