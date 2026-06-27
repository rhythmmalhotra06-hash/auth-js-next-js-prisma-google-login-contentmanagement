'use server';

// Airtable-direct: priority/ordering now come from Airtable.
// - Priority SCORE is an Airtable formula (no app-side recompute needed).
// - "Priority ranking (Manual)" is a 1–5 rating field and can't hold arbitrary
//   queue positions, so drag-to-reorder is not persisted; views order by SCORE.
// These remain as no-ops so the existing manager UI keeps working.

export async function recomputePriority(): Promise<{ ok: boolean; scored: number }> {
  // SCORE is computed live by Airtable's formula field.
  return { ok: true, scored: 0 };
}

export async function setQueueOrder(_orderedIds: string[]): Promise<{ ok: boolean }> {
  // No-op: the Airtable rank field is a 1–5 rating; ordering is driven by SCORE.
  return { ok: true };
}

export async function syncToAirtableNow(): Promise<{ ok: boolean; enabled: boolean; tickets: number; created: number; updated: number; failed: number; error?: string }> {
  // No-op: the app now reads/writes Airtable directly — nothing to sync.
  return { ok: true, enabled: false, tickets: 0, created: 0, updated: 0, failed: 0 };
}
