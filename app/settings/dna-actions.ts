'use server';

import { revalidatePath } from 'next/cache';
import { getDnaAccessForAssetType } from '@/lib/dna-review/access';
import { setDnaRuleActive, dismissProposedDnaRule, createDnaRule, listDnaRulesForAssetType, type DnaReviewRule } from '@/lib/dna-review/repository';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

async function guard(assetTypePgId: string): Promise<{ email: string | null } | { error: string }> {
  const access = await getDnaAccessForAssetType(assetTypePgId);
  if (!access.canGovern) return { error: 'Only a manager, team lead, or exec can manage DNA rules for this asset type.' };
  return { email: access.email };
}

/** All rules (active + pending) for an asset type, for the Settings approval queue. */
export async function listDnaRules(assetTypePgId: string): Promise<DnaReviewRule[]> {
  return listDnaRulesForAssetType(assetTypePgId);
}

export async function approveDnaRule(assetTypePgId: string, ruleId: string): Promise<ActionResult> {
  const g = await guard(assetTypePgId);
  if ('error' in g) return { ok: false, error: g.error };
  await setDnaRuleActive(ruleId, true, g.email);
  revalidatePath('/settings/asset-types');
  return { ok: true };
}

export async function setDnaRuleActiveAction(assetTypePgId: string, ruleId: string, active: boolean): Promise<ActionResult> {
  const g = await guard(assetTypePgId);
  if ('error' in g) return { ok: false, error: g.error };
  await setDnaRuleActive(ruleId, active, g.email);
  revalidatePath('/settings/asset-types');
  return { ok: true };
}

export async function dismissProposedDnaRuleAction(assetTypePgId: string, ruleId: string): Promise<ActionResult> {
  const g = await guard(assetTypePgId);
  if ('error' in g) return { ok: false, error: g.error };
  await dismissProposedDnaRule(ruleId, g.email);
  revalidatePath('/settings/asset-types');
  return { ok: true };
}

export async function addDnaRule(assetTypePgId: string, statement: string, rationale: string): Promise<ActionResult> {
  const g = await guard(assetTypePgId);
  if ('error' in g) return { ok: false, error: g.error };
  const s = statement.trim();
  if (!s) return { ok: false, error: 'Rule text can’t be empty.' };
  await createDnaRule({
    assetTypeId: assetTypePgId,
    statement: s,
    rationale: rationale.trim() || undefined,
    active: true,
    source: 'manual',
    createdBy: g.email,
  });
  revalidatePath('/settings/asset-types');
  return { ok: true };
}
