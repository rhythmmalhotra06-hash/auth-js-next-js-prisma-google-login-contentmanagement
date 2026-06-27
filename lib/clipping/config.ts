// Clip-engine config loader. Reads the editable prompt + rules from Airtable
// (🧠 Clip Rules), composes the system prompt for a given clip type, and caches
// the result briefly. ALWAYS falls back to the hardcoded constants in prompt.ts so
// generation never breaks when Airtable is unreachable or the table is empty.

import { listClipRules, type ClipRule } from '@/lib/clip-rules/repository';
import { SYSTEM_PROMPT, DEFAULT_BRAND_PILLARS } from '@/lib/clipping/prompt';
import { DEFAULT_CLIP_TYPE, scopeAppliesTo, type ClipType } from '@/lib/clipping/clip-types';

export interface ClipEngineConfig {
  systemPrompt: string;
  brandPillars: string;
  /** false when we fell back to the hardcoded constants (Airtable down / empty). */
  fromAirtable: boolean;
}

const CACHE_TTL_MS = 60_000;
type CacheEntry = { value: ClipEngineConfig; at: number };
// Keyed by clip type — different types compose different rule sets.
const cache = new Map<ClipType, CacheEntry>();

/** Compose the system prompt: active Base Prompt + appended active rules for this type. */
function compose(rows: ClipRule[], clipType: ClipType): ClipEngineConfig | null {
  const active = rows.filter((r) => r.active);

  const basePrompt = active.find((r) => r.kind === 'Base Prompt')?.content?.trim();
  if (!basePrompt) return null; // no usable base → caller falls back to constants

  const pillars = active.find((r) => r.kind === 'Brand Pillars')?.content?.trim() || DEFAULT_BRAND_PILLARS;

  const rules = active
    .filter((r) => r.kind === 'Rule' && r.content?.trim() && scopeAppliesTo(r.clipType, clipType))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((r) => `- ${r.content!.trim()}`);

  const systemPrompt = rules.length
    ? `${basePrompt}\n\nAdditional rules and learnings (always apply):\n${rules.join('\n')}`
    : basePrompt;

  return { systemPrompt, brandPillars: pillars, fromAirtable: true };
}

const fallback = (): ClipEngineConfig => ({
  systemPrompt: SYSTEM_PROMPT,
  brandPillars: DEFAULT_BRAND_PILLARS,
  fromAirtable: false,
});

/**
 * Resolve the clip-engine config for a clip type. Cached ~60s per type. On any
 * Airtable failure or missing base prompt, returns the hardcoded defaults.
 */
export async function getClipEngineConfig(clipType: ClipType = DEFAULT_CLIP_TYPE): Promise<ClipEngineConfig> {
  const hit = cache.get(clipType);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  let value: ClipEngineConfig;
  try {
    const res = await listClipRules();
    value = res.ok ? compose(res.data, clipType) ?? fallback() : fallback();
  } catch {
    value = fallback();
  }

  cache.set(clipType, { value, at: Date.now() });
  return value;
}
