// Event-type → visual tier (drives row/badge tints, matching the prototype).
// High = flagship programs, mid = events, soc = social, low = everything else.
export type Tier = 'high' | 'mid' | 'soc' | 'low';

export function tierForEvent(eventName: string | null | undefined): Tier {
  const n = (eventName ?? '').toLowerCase();
  if (!n) return 'low';
  if (/(masterclass|mastery|pathway|quest|program)/.test(n)) return 'high';
  if (/(summit|event|live|conference)/.test(n)) return 'mid';
  if (/(social|reel|short|organic|promo)/.test(n)) return 'soc';
  return 'low';
}
