// Who may RAISE which asset type on the intake form.
//
// Titus, 2026-09-08: "people are just randomly tagging asset types… is there a way that
// when we're raising the form we can just ensure that if this is being raised by this
// person, they only have a selected number of asset types that they can select from."
//
// The rule is data-driven: Airtable's "Stakeholder" field on 🛎️ Creative Asset Type lists
// the people allowed to raise it, resolved to work emails at sync time. Kept here as one
// pure function so the client filter and the server-side re-check can never disagree —
// the client list is a convenience, the server call in app/intake/actions.ts is the rule.

import type { AssetTypeOption } from '@/lib/intake/data';

/** Emails that may raise the asset type — the session user OR the person named as the
 *  requester, since raising a request on a colleague's behalf is normal here. */
export interface Requester {
  sessionEmail: string | null;
  requesterEmail: string | null;
}

const norm = (e: string | null | undefined) => (e ?? '').trim().toLowerCase();

/**
 * FAIL OPEN in three cases, each deliberate:
 *  - the asset type is not a video type — Titus scoped this to video ("wherever the asset
 *    type is video I can do a filter for the stakeholder"), and the ~44 design types have
 *    no Stakeholder data at all;
 *  - the Stakeholder list is empty — a blank field must never hide a row from everyone.
 *    That exact trap already cost us once, when a blank `Category` silently removed asset
 *    types from the shoot form;
 *  - the caller is privileged (see canRaiseAnyAssetType).
 */
export function canRaiseAssetType(assetType: AssetTypeOption, who: Requester): boolean {
  if (!assetType.isVideo) return true;
  const allowed = assetType.stakeholderEmails ?? [];
  if (allowed.length === 0) return true;

  const set = new Set(allowed.map(norm));
  return set.has(norm(who.sessionEmail)) || set.has(norm(who.requesterEmail));
}

/** Admins, managers/approvers and founders bypass the filter entirely. Without this the
 *  form would show them nothing: neither rhythm@ nor titus@ is listed as a Stakeholder on
 *  any asset type today. */
export function canRaiseAnyAssetType(roles: string[], isAdmin: boolean): boolean {
  const has = (r: string) => roles.some((x) => x.trim().toLowerCase() === r.toLowerCase());
  return isAdmin || has('Manager') || has('Approver') || has('Admin') || has('Executive / CEO');
}

/** The asset types a person may raise, given the full list. */
export function allowedAssetTypes(
  assetTypes: AssetTypeOption[],
  who: Requester,
  unrestricted: boolean,
): AssetTypeOption[] {
  if (unrestricted) return assetTypes;
  return assetTypes.filter((a) => canRaiseAssetType(a, who));
}
