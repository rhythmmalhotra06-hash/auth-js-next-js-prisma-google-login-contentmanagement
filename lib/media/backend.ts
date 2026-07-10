// Backend flags for the media domain. Two distinct concerns, two flags:
//  • VISHEN_VIDEOS_BACKEND — Vishen's Videos: full PG system-of-record + two-way sync.
//  • MEDIA_BACKEND — Media Sources: read-PG mirror (writes stay Airtable + vishen-sync; a
//    pull + write-through keep PG fresh). Clip Suggestions stay Airtable (deferred).
// Both default to 'airtable' (pre-cutover behavior) until backfilled + verified.
export const VISHEN_VIDEOS_BACKEND: 'airtable' | 'postgres' =
  process.env.VISHEN_VIDEOS_BACKEND === 'postgres' ? 'postgres' : 'airtable';
export const vishenVideosArePostgres = (): boolean => VISHEN_VIDEOS_BACKEND === 'postgres';

export const MEDIA_BACKEND: 'airtable' | 'postgres' =
  process.env.MEDIA_BACKEND === 'postgres' ? 'postgres' : 'airtable';
export const mediaIsPostgres = (): boolean => MEDIA_BACKEND === 'postgres';
