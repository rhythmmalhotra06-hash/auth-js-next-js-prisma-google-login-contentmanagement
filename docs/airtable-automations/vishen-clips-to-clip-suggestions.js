// Airtable Automation script — INBOUND: Vishen's "Clips" → Creative Services "🎬 Clip Suggestions".
//
// Setup (in Vishen's base appvBtCYdaSrD1y11):
//   1. Automations → New automation.
//   2. Trigger: "When a record is created or updated" on the "Clips" table.
//   3. Action: "Run a script". Input variables:
//        recordId  →  the trigger step's "Airtable record ID"
//        apiKey    →  PAT with data.records:read+write on appFEFygXo2pRc8AR (+ read on this base).
//   4. Paste this script.
//
// Behaviour: for clips Vishen adds by hand, upsert a Clip Suggestion linked to the Media Source
// that mirrors the clip's Major Video. Rows that already carry an "App Clip ID" came FROM the app
// (the portal's clip mirror) — those are skipped so we never duplicate.

const config = input.config();
const recordId = config.recordId;
const API_KEY = config.apiKey;

const DEST_BASE = 'appFEFygXo2pRc8AR';
const CLIPS = 'tblquXg7eesUZwvSH';  // 🎬 Clip Suggestions
const SOURCES = 'tblBQhM2Blqa7uNZX'; // 📺 Media Sources
const AT = 'https://api.airtable.com/v0';
const H = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

// Vishen "Clips" field IDs (rename-proof — match lib/airtable/field-map.ts VISHEN_CLIPS).
const CLIPS_TABLE = 'tblgGCaDK7W22UvSG';
const F_NAME = 'fldgUxxaSXsYeplFe';
const F_NOTES = 'fldD5qTTkth62Fuyy';
const F_STATUS = 'fldrBTX1eD26lPZx1';
const F_SOURCE = 'fldAyfIU17piBfHZQ';
const F_APP_CLIP_ID = 'fld8zMOlMzFG4Bn3v';

async function run() {
  const clipsTable = base.getTable(CLIPS_TABLE);
  const clip = await clipsTable.selectRecordAsync(recordId);
  if (!clip) { console.log('record gone'); return; }

  // App-originated rows already have App Clip ID — skip (avoids re-creating a Clip Suggestion).
  if (clip.getCellValueAsString(F_APP_CLIP_ID)) { console.log('app-originated → skip'); return; }

  const name = clip.getCellValueAsString(F_NAME) || 'Clip';
  const notes = clip.getCellValueAsString(F_NOTES) || '';
  const vStatus = clip.getCellValueAsString(F_STATUS); // Todo | In progress | Done
  const appStatus = ({ 'Todo': 'Proposed', 'In progress': 'Approved', 'Done': 'Approved' })[vStatus] || 'Proposed';

  // Parent Media Source = the one mirroring this clip's Major Video (the "Source" link).
  const sourceLinks = clip.getCellValue(F_SOURCE);
  const mvId = Array.isArray(sourceLinks) && sourceLinks.length ? sourceLinks[0].id : null;
  let mediaSourceId = null;
  if (mvId) {
    const q = `${AT}/${DEST_BASE}/${SOURCES}?maxRecords=1&filterByFormula=` +
      encodeURIComponent(`{Source Record ID}='${mvId}'`);
    const r = await (await fetch(q, { headers: H })).json();
    mediaSourceId = r.records && r.records[0] ? r.records[0].id : null;
  }
  if (!mediaSourceId) { console.log('parent Media Source not synced yet → skip'); return; }

  // Upsert the Clip Suggestion keyed by {Vishen Clip ID} = this clip's id.
  const q2 = `${AT}/${DEST_BASE}/${CLIPS}?maxRecords=1&filterByFormula=` +
    encodeURIComponent(`{Vishen Clip ID}='${recordId}'`);
  const existing = ((await (await fetch(q2, { headers: H })).json()).records || [])[0];

  if (existing) {
    const cur = existing.fields;
    const patch = {};
    if (name !== cur['Name']) patch['Name'] = name;
    if (notes && notes !== cur['Rationale']) patch['Rationale'] = notes;
    if (appStatus !== cur['Status']) patch['Status'] = appStatus;
    if (Object.keys(patch).length) {
      await fetch(`${AT}/${DEST_BASE}/${CLIPS}/${existing.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: patch }) });
      console.log('updated Clip Suggestion', patch);
    } else {
      console.log('no change → no write (avoids echo)');
    }
    return;
  }

  const fields = {
    'Name': name,
    'Hook Line': name,
    'Rationale': notes,
    'Status': appStatus,
    'Added Date': new Date().toISOString(),
    'Media Source': [mediaSourceId],
    'Vishen Clip ID': recordId,
  };
  const created = await (await fetch(`${AT}/${DEST_BASE}/${CLIPS}`, { method: 'POST', headers: H, body: JSON.stringify({ fields }) })).json();
  // Stamp App Clip ID back so this row is recognised as synced on its next edit (and dedup holds).
  if (created.id) await clipsTable.updateRecordAsync(recordId, { [F_APP_CLIP_ID]: created.id });
  console.log('created Clip Suggestion', created.id);
}

await run();
