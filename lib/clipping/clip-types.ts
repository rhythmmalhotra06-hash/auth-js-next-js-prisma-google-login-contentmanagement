// Content-form types a clip rule can be scoped to.
//
// Single source of truth shared by: the Airtable "Clip Type" single-select options,
// the rules-config filter (lib/clipping/config.ts), and the admin UI selector.
// Today the engine only generates Reels; the other forms exist so rules can be
// authored ahead of supporting generation for them. Extend this list (and the
// Airtable single-select) together when a new short-form format is added.

export const CLIP_TYPES = ['Reel', 'Stage Talk', 'Short'] as const;
export type ClipType = (typeof CLIP_TYPES)[number];

/** What `generateStrategy` defaults to — matches today's Instagram-Reels behaviour. */
export const DEFAULT_CLIP_TYPE: ClipType = 'Reel';

// A rule row scoped to 'All' applies to every clip type. 'All' is a valid rule
// scope but never a *requested* generation type.
export const RULE_SCOPE_ALL = 'All';
export type RuleScope = ClipType | typeof RULE_SCOPE_ALL;
export const RULE_SCOPES = [RULE_SCOPE_ALL, ...CLIP_TYPES] as const;

// Marker on a Clip Rule's Note identifying a Tier-2 auto-proposal awaiting approval.
// Lives here (server-free) so client components can read it without pulling in server deps.
export const PROPOSED_NOTE_PREFIX = 'Proposed from performance';

export function isClipType(v: string | null | undefined): v is ClipType {
  return !!v && (CLIP_TYPES as readonly string[]).includes(v);
}

/** True when a rule scope applies to the requested clip type. */
export function scopeAppliesTo(scope: string | null | undefined, clipType: ClipType): boolean {
  return scope === RULE_SCOPE_ALL || scope === clipType;
}
