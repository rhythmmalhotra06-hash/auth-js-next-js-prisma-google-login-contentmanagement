// PG Vishen Video → Airtable 🎬 Videos field payload. Writes ONLY the three app-managed
// fields (approval, rating, 24h data). The Videos table is team-maintained, so a null PG value
// means "app never set it" → omit it (don't clear a team value). Status/name/etc. are never
// written by the app.

import { VISHEN_VIDEOS } from './field-map';

const F = VISHEN_VIDEOS.fields;

export interface VishenVideoForPush {
  approval: string | null;
  rating: number | null;
  views24h: string | null;
}

export function vishenVideoToAirtableFields(v: VishenVideoForPush): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (v.approval != null) fields[F.approval] = v.approval;
  if (v.rating != null) fields[F.rating] = v.rating;
  if (v.views24h != null) fields[F.views24h] = v.views24h;
  return fields;
}
