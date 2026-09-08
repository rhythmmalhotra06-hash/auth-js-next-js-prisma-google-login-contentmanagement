// DNA review config loader. Composes the authored baseline with the learned rulebook
// (active DnaReviewRule rows) for one asset type. Ports lib/clipping/config.ts's
// cache-and-compose shape.
//
// Baseline precedence (fixed 2026-09-08). This used to read ONLY dnaRequirements +
// feedbackStandards — the two portal-owned Airtable fields — which are empty on all 118
// asset types, so every DNA review ever run used the "nothing written yet" placeholder even
// though 72 asset types have real DNA. The team maintains that DNA in Airtable's
// synced-source "DNA" / "Video/Virality DNA" fields, which are read-only upstream and so
// can never be written back from here.
//
// Resolution: upstream is the default, a portal edit is the override. Precedence lives here
// rather than in the data so the two editing surfaces cannot silently diverge.

import { prisma } from '@/lib/prisma';
import { getActiveDnaRules } from '@/lib/dna-review/repository';

export interface DnaReviewConfig {
  assetTypeName: string;
  baseline: string; // portal override if written, else upstream DNA; placeholder when neither exists
  /** Where `baseline` came from — surfaced in the UI so an editor knows which they're reading. */
  baselineSource: 'portal' | 'upstream' | 'none';
  /** Airtable "Process DNA" link, when the asset type has one. */
  processDnaUrl: string | null;
  /** The rule-list text only (no Process summary), for splitting into checkpoints in the
   *  ticket panel. `baseline` stays exactly what the model is shown. */
  dnaText: string | null;
  ruleBullets: string[]; // "statement — rationale (example)" per active rule, highest weight first
}

// Not invalidated by a reference sync, so a fresh Airtable DNA edit can lag by up to a
// minute per running instance. Acceptable for a review that a human triggers.
const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { value: DnaReviewConfig; at: number }>();

function composeRuleBullet(r: { statement: string; rationale: string | null; example: string | null }): string {
  const parts = [r.statement];
  if (r.rationale) parts.push(`(${r.rationale})`);
  if (r.example) parts.push(`e.g. ${r.example}`);
  return parts.join(' ');
}

/** Resolve the DNA review config for an asset type. Cached ~60s. */
export async function getDnaReviewConfig(assetTypeId: string): Promise<DnaReviewConfig | null> {
  const hit = cache.get(assetTypeId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const assetType = await prisma.assetType.findUnique({
    where: { id: assetTypeId },
    select: {
      name: true, fullName: true,
      dnaRequirements: true, feedbackStandards: true,
      dnaUpstream: true, viralityDna: true, processDnaUrl: true, processDnaSummary: true,
    },
  });
  if (!assetType) return null;

  const portalParts = [assetType.dnaRequirements, assetType.feedbackStandards].filter((s) => s?.trim());
  const upstreamParts = [assetType.dnaUpstream, assetType.viralityDna].filter((s) => s?.trim());
  // The Process DNA summary describes *how* the asset gets made, so it belongs with either
  // baseline rather than replacing one.
  const processPart = assetType.processDnaSummary?.trim() ? [`Process: ${assetType.processDnaSummary.trim()}`] : [];

  let baselineSource: 'portal' | 'upstream' | 'none' = 'none';
  let parts: string[] = [];
  if (portalParts.length) {
    baselineSource = 'portal';
    parts = portalParts as string[];
  } else if (upstreamParts.length) {
    baselineSource = 'upstream';
    parts = upstreamParts as string[];
  }

  const baseline = parts.length
    ? [...parts, ...processPart].join('\n\n')
    : 'No DNA requirements or feedback standards have been written for this asset type yet.';
  const dnaText = parts.length ? parts.join(', ') : null;

  const rules = await getActiveDnaRules(assetTypeId);
  const ruleBullets = rules.map(composeRuleBullet);

  const value: DnaReviewConfig = {
    assetTypeName: assetType.name ?? assetType.fullName ?? '(unnamed asset type)',
    baseline,
    baselineSource,
    processDnaUrl: assetType.processDnaUrl?.trim() || null,
    dnaText,
    ruleBullets,
  };
  cache.set(assetTypeId, { value, at: Date.now() });
  return value;
}
