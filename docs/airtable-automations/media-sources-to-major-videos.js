// Airtable Automation script — OUTBOUND (reverse): Creative Services "📺 Media Sources" → Vishen's "Major Videos".
//
// Set up in the CREATIVE SERVICES base (appFEFygXo2pRc8AR):
//   Trigger: "When a record is created or updated" on 📺 Media Sources (watch Title / Source URL).
//   Action:  "Run a script". Inputs: recordId (trigger record id) · apiKey (PAT, read+write on BOTH bases).
//
// UPDATE-ONLY: it never creates a Major Video. A Media Source with no "Source Record ID" (a
// Creative-Services-only / YouTube / Slack source) is skipped — per the decision to keep Vishen's
// Major Videos limited to films that originated there. Diff-guarded so it can't ping-pong.

const config = input.config();
const recordId = config.recordId;
const API_KEY = config.apiKey;

const VISHEN_BASE = 'appvBtCYdaSrD1y11';
const MV_TABLE = 'tblSrtPXAeiGeLUwW';
const MV_NAME = 'fldLy51h0yvJy7OP9';      // Major Videos "Name"
const MV_FINAL_URL = 'fldxHwImLHdsDWfuL'; // Major Videos "Final URL"
const SOURCES_TABLE = 'tblBQhM2Blqa7uNZX'; // 📺 Media Sources (this base)
const AT = 'https://api.airtable.com/v0';
const H = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

async function run() {
  const ms = await base.getTable(SOURCES_TABLE).selectRecordAsync(recordId);
  if (!ms) { console.log('record gone'); return; }

  const mvId = ms.getCellValueAsString('Source Record ID');
  if (!mvId) { console.log('no linked Major Video → skip (never create from CS)'); return; }

  const title = ms.getCellValueAsString('Title') || null;
  const url = ms.getCellValueAsString('Source URL') || null;

  // Read the current Major Video (by field ID) and diff.
  const cur = await (await fetch(`${AT}/${VISHEN_BASE}/${MV_TABLE}/${mvId}?returnFieldsByFieldId=true`, { headers: H })).json();
  if (!cur || !cur.fields) { console.log('Major Video gone → skip (reconcile handles deletes)'); return; }
  const f = cur.fields;

  const patch = {};
  if (title && title !== f[MV_NAME]) patch[MV_NAME] = title;
  if (url && url !== f[MV_FINAL_URL]) patch[MV_FINAL_URL] = url;
  if (Object.keys(patch).length === 0) { console.log('no change → no write (avoids echo)'); return; }

  await fetch(`${AT}/${VISHEN_BASE}/${MV_TABLE}/${mvId}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields: patch, returnFieldsByFieldId: true }) });
  console.log('updated Major Video', patch);
}

await run();
