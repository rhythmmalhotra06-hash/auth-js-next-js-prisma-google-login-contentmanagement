// DNA review config loader. Composes the authored baseline (AssetType.dnaRequirements /
// feedbackStandards, E9.7) with the learned rulebook (active DnaReviewRule rows) for one
// asset type. Ports lib/clipping/config.ts::getClipEngineConfig's cache-and-compose shape.

import { prisma } from '@/lib/prisma';
import { getActiveDnaRules } from '@/lib/dna-review/repository';

export interface DnaReviewConfig {
  assetTypeName: string;
  baseline: string; // dnaRequirements + feedbackStandards, or a placeholder when both are blank
  ruleBullets: string[]; // "statement — rationale (example)" per active rule, highest weight first
}

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
    select: { name: true, fullName: true, dnaRequirements: true, feedbackStandards: true },
  });
  if (!assetType) return null;

  const baselineParts = [assetType.dnaRequirements, assetType.feedbackStandards].filter((s) => s?.trim());
  const baseline = baselineParts.length
    ? baselineParts.join('\n\n')
    : 'No DNA requirements or feedback standards have been written for this asset type yet.';

  const rules = await getActiveDnaRules(assetTypeId);
  const ruleBullets = rules.map(composeRuleBullet);

  const value: DnaReviewConfig = {
    assetTypeName: assetType.name ?? assetType.fullName ?? '(unnamed asset type)',
    baseline,
    ruleBullets,
  };
  cache.set(assetTypeId, { value, at: Date.now() });
  return value;
}
