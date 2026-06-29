// Auto-assignment (E9.6) — route a new ticket to the asset type's sole preferred
// editor. Conservative by design (CLAUDE.md §5: auto-assign only the unambiguous
// ~20–30%): we assign ONLY when an asset type has exactly one *active* preferred
// editor. Zero or multiple → left unassigned for the manager. Called from the single
// createTicket chokepoint so both intake and clip-convert get the same behaviour.

import { getRecord } from '@/lib/airtable/rest';
import { ASSET_TYPES } from '@/lib/airtable/field-map';
import { mapAssetType } from '@/lib/airtable/sync';
import { getLiveIntakeReference } from '@/lib/airtable/reference-live';

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; id: string | null }>();

/**
 * The Employee recId to auto-assign for this asset type, or null when ambiguous.
 * Returns an id only when the asset type has exactly one preferred editor and that
 * employee is active. Memoised ~60s so a clip-convert batch sharing one asset type
 * doesn't re-read it per clip.
 */
export async function resolveAutoAssignee(assetTypeRecId: string): Promise<string | null> {
  if (!assetTypeRecId) return null;

  const cached = cache.get(assetTypeRecId);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.id;

  let result: string | null = null;
  const rec = await getRecord(ASSET_TYPES.baseId, ASSET_TYPES.tableId, assetTypeRecId);
  if (rec.ok) {
    const editors = mapAssetType(rec.data).links.preferredEditors;
    if (editors.length === 1) {
      const candidate = editors[0];
      try {
        // Validate the sole preferred editor is active (reuses the cached intake
        // reference, which already filters to active employees).
        const ref = await getLiveIntakeReference();
        result = ref.employees.some((e) => e.id === candidate) ? candidate : null;
      } catch {
        // Reference unavailable — still honour the single-preferred-editor rule.
        result = candidate;
      }
    }
  }

  cache.set(assetTypeRecId, { at: Date.now(), id: result });
  return result;
}
