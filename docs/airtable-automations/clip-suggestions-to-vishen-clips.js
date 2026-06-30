// Airtable Automation script — OUTBOUND (reverse): Creative Services "🎬 Clip Suggestions" → Vishen's "Clips".
//
// Set up in the CREATIVE SERVICES base (appFEFygXo2pRc8AR):
//   Trigger: "When a record is created or updated" on 🎬 Clip Suggestions.
//   Action:  "Run a script". Inputs: recordId (trigger record id) · apiKey (PAT, read+write on BOTH bases).
//
// This is the single mechanism that mirrors clips into Vishen's base (covers BOTH app-generated
// clips and clips edited in Creative Services — so the app-code outbound is disabled, see README):
//   • Already mirrored ("Vishen Clip ID" set) → update the Vishen clip (Name / Notes / Status), diff-guarded.
//   • Not yet mirrored → create a Vishen clip ONLY if the parent Media Source belongs to a Vishen
//     Major Video (Source Record ID set); otherwise skip (non-Vishen media stays out of his base).
// Status map (app → Vishen): Proposed→Todo, Approved→In progress, Dismissed→(leave as-is).

const config = input.config();
const recordId = config.recordId;
const API_KEY = config.apiKey;

const VISHEN_BASE = 'appvBtCYdaSrD1y11';
const VC_TABLE = 'tblgGCaDK7W22UvSG';
const VC_NAME = 'fldgUxxaSXsYeplFe';
const VC_NOTES = 'fldD5qTTkth62Fuyy';
const VC_STATUS = 'fldrBTX1eD26lPZx1';
const VC_SOURCE = 'fldAyfIU17piBfHZQ';   // → Major Videos
const VC_APP_CLIP_ID = 'fld8zMOlMzFG4Bn3v';

const CS_BASE = 'appFEFygXo2pRc8AR';
const CLIPS = 'tblquXg7eesUZwvSH';   // 🎬 Clip Suggestions (this base)
const SOURCES = 'tblBQhM2Blqa7uNZX'; // 📺 Media Sources
const AT = 'https://api.airtable.com/v0';
const H = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

const STATUS_MAP = { 'Proposed': 'Todo', 'Approved': 'In progress' }; // Dismissed → undefined (no change)

async function run() {
  const csTable = base.getTable(CLIPS);
  const cs = await csTable.selectRecordAsync(recordId);
  if (!cs) { console.log('record gone'); return; }

  const name = (cs.getCellValueAsString('Name') || 'Clip').slice(0, 200);
  const notes = cs.getCellValueAsString('Rationale') || '';
  const vStatus = STATUS_MAP[cs.getCellValueAsString('Status')]; // may be undefined for Dismissed
  const vishenClipId = cs.getCellValueAsString('Vishen Clip ID');

  // Already mirrored → update the Vishen clip (diff-guarded).
  if (vishenClipId) {
    const cur = await (await fetch(`${AT}/${VISHEN_BASE}/${VC_TABLE}/${vishenClipId}?returnFieldsByFieldId=true`, { headers: H })).json();
    if (!cur || !cur.fields) { console.log('Vishen clip gone → skip (reconcile handles deletes)'); return; }
    const f = cur.fields;
    const curStatus = typeof f[VC_STATUS] === 'string' ? f[VC_STATUS] : (f[VC_STATUS] && f[VC_STATUS].name) || null;
    const patch = {};
    if (name !== f[VC_NAME]) patch[VC_NAME] = name;
    if (notes && notes !== f[VC_NOTES]) patch[VC_NOTES] = notes;
    if (vStatus && vStatus !== curStatus) patch[VC_STATUS] = vStatus;
    if (Object.keys(patch).length === 0) { console.log('no change → no write (avoids echo)'); return; }
    await fetch(`${AT}/${VISHEN_BASE}/${VC_TABLE}/${vishenClipId}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: patch, returnFieldsByFieldId: true }) });
    console.log('updated Vishen clip', patch);
    return;
  }

  // Not mirrored yet → create only if the parent Media Source is a Vishen Major Video.
  const msLinks = cs.getCellValue('Media Source');
  const msId = Array.isArray(msLinks) && msLinks.length ? msLinks[0].id : null;
  if (!msId) { console.log('no parent Media Source → skip'); return; }

  const msRec = await (await fetch(`${AT}/${CS_BASE}/${SOURCES}/${msId}`, { headers: H })).json();
  const mvId = msRec && msRec.fields ? msRec.fields['Source Record ID'] : null;
  if (!mvId) { console.log('parent Media Source is not a Vishen Major Video → skip'); return; }

  const fields = {
    [VC_NAME]: name,
    [VC_NOTES]: notes,
    [VC_STATUS]: vStatus || 'Todo',
    [VC_SOURCE]: [mvId],
    [VC_APP_CLIP_ID]: recordId,
  };
  const created = await (await fetch(`${AT}/${VISHEN_BASE}/${VC_TABLE}`, { method: 'POST', headers: H, body: JSON.stringify({ fields, returnFieldsByFieldId: true }) })).json();
  // Stamp Vishen Clip ID back onto the Clip Suggestion so future edits update (not re-create).
  if (created.id) await csTable.updateRecordAsync(recordId, { 'Vishen Clip ID': created.id });
  console.log('created Vishen clip', created.id);
}

await run();
