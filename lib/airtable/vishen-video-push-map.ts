// PG Vishen Video → Airtable 🎬 Videos field payload. Writes ONLY the app-managed fields
// (approval, rating, 24h data, and now Live Date). The Videos table is team-maintained, so a null
// PG value means "app never set it" → omit it, never clear a team value. Status/name/etc. are
// never written by the app.
//
// `liveDate` joined the list on 10 Sep (decision AB4). It is the field with no owner — 204 of 442
// assets lack it, 66 of those already published — and the not-dated tray now lets a human set it
// without leaving the portal. It is the ONLY scheduling field the app writes here; status in
// particular stays the team's, per the standing rule that the app never overwrites a status it
// does not own.

import { VISHEN_VIDEOS } from './field-map';

const F = VISHEN_VIDEOS.fields;

export interface VishenVideoForPush {
  approval: string | null;
  rating: number | null;
  views24h: string | null;
  liveDate: string | null;
}

export function vishenVideoToAirtableFields(v: VishenVideoForPush): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (v.approval != null) fields[F.approval] = v.approval;
  if (v.rating != null) fields[F.rating] = v.rating;
  if (v.views24h != null) fields[F.views24h] = v.views24h;
  if (v.liveDate != null) fields[F.liveDate] = v.liveDate;
  return fields;
}
