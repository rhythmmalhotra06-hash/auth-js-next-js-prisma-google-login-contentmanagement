// PG social post → Airtable 📣 Social field payload. Writes ONLY the app-managed fields;
// other columns on the row (social format, content type, transcript, shoots link, "Raise
// Request" checkbox) are left untouched by Airtable's PATCH. creativeTicketId is cross-base
// text; officialCal is a same-base link (recId array).

import { SOCIAL } from './field-map';

const F = SOCIAL.fields;
const L = SOCIAL.links;

export interface SocialForPush {
  title: string | null;
  notes: string | null;
  captions: string | null;
  status: string | null;
  clipSourceUrl: string | null;
  sourceTitle: string | null;
  viralityScore: number | null;
  timecode: string | null;
  creativeTicketId: string | null;
  officialCalId: string | null;
}

export function socialToAirtableFields(s: SocialForPush): Record<string, unknown> {
  return {
    [F.title]: s.title,
    [F.notes]: s.notes,
    [F.captions]: s.captions,
    [F.status]: s.status,
    [F.clipSourceUrl]: s.clipSourceUrl,
    [F.sourceTitle]: s.sourceTitle,
    [F.virality]: s.viralityScore,
    [F.timecode]: s.timecode,
    [F.creativeTicketId]: s.creativeTicketId,
    [L.officialCal]: s.officialCalId ? [s.officialCalId] : [],
  };
}
