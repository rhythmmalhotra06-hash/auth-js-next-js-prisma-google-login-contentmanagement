// Airtable Automation script — INBOUND: Vishen's "Major Videos" → Creative Services "📺 Media Sources".
//
// Setup (in Vishen's base appvBtCYdaSrD1y11):
//   1. Automations → New automation.
//   2. Trigger: "When a record is created or updated" on the "Major Videos" table.
//      (Optionally watch only Name / Final URL / Draft URL / Select so it fires on the fields we sync.)
//   3. Action: "Run a script". In the script editor, add two Input variables:
//        recordId  →  the trigger step's "Airtable record ID"
//        apiKey    →  a Personal Access Token with data.records:read+write on appFEFygXo2pRc8AR
//                     and data.records:read on this base (see README — use a dedicated PAT).
//   4. Paste this script.
//
// Behaviour: upsert a Media Sources row keyed by {Source Record ID} = this Major Video's id.
// Diff-guarded (writes only changed fields) so it never ping-pongs with the app's outbound sync.

const config = input.config();
const recordId = config.recordId;
const API_KEY = config.apiKey;

const DEST_BASE = 'appFEFygXo2pRc8AR';
const DEST_TABLE = 'tblBQhM2Blqa7uNZX'; // 📺 Media Sources
const AT = 'https://api.airtable.com/v0';
const H = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

// Major Videos field IDs (rename-proof — match lib/airtable/field-map.ts MAJOR_VIDEOS).
const MV_TABLE = 'tblSrtPXAeiGeLUwW';
const F_NAME = 'fldLy51h0yvJy7OP9';
const F_FINAL_URL = 'fldxHwImLHdsDWfuL';
const F_DRAFT_URL = 'fldsqShd2qV1K1sae';
const F_SELECT = 'fldoMVNmdmVEPz1Uc';

async function run() {
  // 1) Read this Major Video (same base as the automation). Fields by ID, not name.
  const mv = await base.getTable(MV_TABLE).selectRecordAsync(recordId);
  if (!mv) { console.log('record gone'); return; }

  const name = mv.getCellValueAsString(F_NAME) || null;
  const finalUrl = mv.getCellValueAsString(F_FINAL_URL) || null;
  const draftUrl = mv.getCellValueAsString(F_DRAFT_URL) || null;
  const url = finalUrl || draftUrl || null;
  const selects = mv.getCellValue(F_SELECT);
  const type = Array.isArray(selects) && selects.length ? selects[0].name : null;
  const isYouTube = !!(url && /(?:youtube\.com|youtu\.be)/.test(url));
  const platform = isYouTube ? 'YouTube' : 'Other';

  // 2) Find an existing Media Source for this Major Video.
  const findUrl =
    `${AT}/${DEST_BASE}/${DEST_TABLE}?maxRecords=1&filterByFormula=` +
    encodeURIComponent(`{Source Record ID}='${recordId}'`);
  const found = await (await fetch(findUrl, { headers: H })).json();
  const existing = found.records && found.records[0];

  // 3a) Create when missing — only if there's a video link (mirrors the app's gate).
  if (!existing) {
    if (!url) { console.log('no url + no existing row → skip'); return; }
    const fields = {
      'Title': name,
      'Source URL': url,
      'Platform': platform,
      'Status': 'New',
      'Submitted Via': 'Airtable',
      'Guest / Show': type,
      'Source Record ID': recordId,
    };
    if (!isYouTube) fields['Download URL'] = url; // Dropbox/other = the editor download link too
    await fetch(`${AT}/${DEST_BASE}/${DEST_TABLE}`, { method: 'POST', headers: H, body: JSON.stringify({ fields }) });
    console.log('created Media Source');
    return;
  }

  // 3b) Update — diff-guarded (only changed shared fields; never blanks a populated field).
  const cur = existing.fields;
  const patch = {};
  if (name && name !== cur['Title']) patch['Title'] = name;
  if (url && url !== cur['Source URL']) patch['Source URL'] = url;
  if (type && type !== cur['Guest / Show']) patch['Guest / Show'] = type;
  if (Object.keys(patch).length === 0) { console.log('no change → no write (avoids echo)'); return; }
  await fetch(`${AT}/${DEST_BASE}/${DEST_TABLE}/${existing.id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: patch }) });
  console.log('updated Media Source', patch);
}

await run();
