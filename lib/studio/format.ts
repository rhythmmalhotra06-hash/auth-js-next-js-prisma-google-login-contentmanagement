// Client-safe Studio display helpers — NO server imports, so client components
// can use these without dragging the Airtable/server data layer into the bundle.

/** Five-glyph star string from a 1–5 manual rank (null → all empty). */
export function starString(rank: number | null): string {
  const n = Math.max(0, Math.min(5, Math.round(rank ?? 0)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

/** Short "30 Jun" style date, or null. */
export function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
