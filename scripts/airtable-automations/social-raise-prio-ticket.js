// 📣 Social (checkbox) → 🎯 Prio ticket in the CREATIVE SERVICES base (cross-base).
// Gate: Raise Request checked AND an Asset Type set AND no ticket already raised.
//
// This is the source of truth for the Airtable Scripting automation on the 📣 Social table
// (tblCcrdkHzOakOGnm). Paste into the automation's Run-script action. Kept here for provenance.
//
// FIX (2026-07-13): P_TEAM was 'Social Media Video', which is NOT a valid option on the Creative
// Services Team/Service Level field (fldHGT2p5SObJEzPh). The automation token can't create select
// options, so every ticket-create POST failed with INVALID_MULTIPLE_CHOICE_OPTIONS and no ticket
// was created. Changed to the existing option 'Video Team - Campaign [Events, etc]'.

const config = input.config();
const recordId = config.recordId;
const API_KEY = config.apiKey;
const AT = 'https://api.airtable.com/v0';
const H = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

// ── 📣 Social (this base) — field IDs / names ──
const SOCIAL_TABLE = 'tblCcrdkHzOakOGnm';
const S_RAISE = 'fldrNumf2EpoRetuf';        // Raise Request (Creative) (checkbox)
const S_ASSET = 'fldWJgCJ10WnRe62U';        // Asset Type (link; cell .name = Full title)
const S_TICKET_ID = 'fldZxIaWrFImce9H9';    // Creative Ticket ID (text) — idempotency key
const S_STATUS = 'fld8F8Z05DIzh5BJM';       // Status
const S_TITLE = 'fldBDHsk0YiLMiCqX';        // Title
const S_NOTES = 'fldJc3ZNwn42yMW35';        // Notes / Brief
const S_CAPTIONS = 'fldCpBMCWeGwmyYpx';     // Social Media Captions
const S_SOURCE_URL = 'fldXi03EEUtKThsBv';   // Clip Source URL
const S_EVENT_LOOKUP = 'fldkXRTBoribSHwQw'; // Event type (from Official Cal) lookup
const S_RAISED_BY = 'Raised By';            // Last-modified-by field you added (by name)
const STATUS_RAISED = '2A. Ticket Raised';

// ── Creative Services base — Prio + taxonomy + employees ──
const CS_BASE = 'appFEFygXo2pRc8AR';
const PRIO = 'tblhrRl8GzsDMv0DD';
const P_PROJECT = 'fldxatmiW57hVUL9X';      // Project/Program (writable title)
const P_BRIEF = 'fld5INJXFHCliBAKY';        // Creative Brief
const P_TEAM = 'fldHGT2p5SObJEzPh';         // Team/Service Level (singleSelect)
const P_TYPE = 'fldlfaGYlYlTxNy1s';         // Type of Request (singleSelect)
const P_PRIO = 'fldFH3scvUfjnOwhg';         // Prio. Status (singleSelect)
const P_EVENT_LINK = 'fldKGGZMuyqnF7gP8';   // → Event Type
const P_ASSET_LINK = 'fldPgIBDJCuJng7K1';   // → Asset Type
const P_REQUESTED_BY = 'fldgw7zf5fD2YK2EL'; // → Employees (Requested By)

// Valid Team/Service Level options (token cannot create new ones): must be one of
// 'Video Team - Non Campaign' | 'Video Team - Campaign [Events, etc]' |
// 'Event Design Graphic' | 'Brand Design Graphic'
const TEAM_SERVICE_LEVEL = 'Video Team - Campaign [Events, etc]';

const CS_ASSET_TABLE = 'tblLbcgob2Bxevugy';
const CS_ASSET_FULLTITLE = 'fldP6YGDBvf4DWXld'; // "Asset Type (Full title)"
const CS_EVENT_TABLE = 'tblzTFTZ2ttEvi2j1';
const CS_EVENT_NAME = 'fldAthwfuZIZ1Ip1L';      // "Event Type"
const CS_EMP_TABLE = 'tbllP5vRon54L7Ccf';       // 👬 Employees
const CS_EMP_EMAIL = 'fldCSlSk6mwmQYK74';       // "Work Email"

async function getJSON(url) { return (await fetch(url, { headers: H })).json(); }

// GET all records (one field) from a Creative Services table, keyed by field id.
async function getAll(tableId, fieldId) {
  const out = [];
  let offset;
  do {
    const u = new URL(`${AT}/${CS_BASE}/${tableId}`);
    u.searchParams.set('returnFieldsByFieldId', 'true');
    u.searchParams.set('pageSize', '100');
    u.searchParams.append('fields[]', fieldId);
    if (offset) u.searchParams.set('offset', offset);
    const j = await getJSON(u.toString());
    (j.records || []).forEach((r) => out.push(r));
    offset = j.offset;
  } while (offset);
  return out;
}

// Resolve the checker's email → Creative Services Employee recId (or null).
async function findEmployeeId(email) {
  if (!email) return null;
  const u = new URL(`${AT}/${CS_BASE}/${CS_EMP_TABLE}`);
  u.searchParams.set('filterByFormula', `LOWER({Work Email}) = '${email.toLowerCase().replace(/'/g, "\\'")}'`);
  u.searchParams.set('maxRecords', '1');
  const r = ((await getJSON(u.toString())).records || [])[0];
  return r ? r.id : null;
}

// Fallback: resolve by display name → Employee recId (or null).
async function findEmployeeByName(name) {
  if (!name) return null;
  const u = new URL(`${AT}/${CS_BASE}/${CS_EMP_TABLE}`);
  u.searchParams.set('filterByFormula', `{Name} = '${name.replace(/'/g, "\\'")}'`);
  u.searchParams.set('maxRecords', '1');
  const r = ((await getJSON(u.toString())).records || [])[0];
  return r ? r.id : null;
}

async function run() {
  const social = base.getTable(SOCIAL_TABLE);
  const rec = await social.selectRecordAsync(recordId);
  if (!rec) { console.log('record gone'); return; }

  // ── Gate ──
  if (rec.getCellValue(S_RAISE) !== true) { console.log('Raise Request not checked → skip'); return; }
  if (rec.getCellValueAsString(S_TICKET_ID)) { console.log('already raised → skip'); return; }
  const assetCell = rec.getCellValue(S_ASSET) || [];
  if (!assetCell.length) { console.log('no Asset Type set → skip + flag'); return; }

  const assetTitle = (assetCell[0].name || '').trim();

  // ── Map Asset Type by full title → Creative Services recId ──
  const csAssets = await getAll(CS_ASSET_TABLE, CS_ASSET_FULLTITLE);
  const assetMatch = csAssets.find((r) => ((r.fields[CS_ASSET_FULLTITLE] || '').trim()) === assetTitle);
  if (!assetMatch) { console.log(`no asset type matches "${assetTitle}" → skip`); return; }

  // ── Best-effort Event Type by name ──
  let eventRecId = null;
  const evRaw = rec.getCellValue(S_EVENT_LOOKUP);
  const evName = Array.isArray(evRaw)
    ? String(evRaw[0] && evRaw[0].name ? evRaw[0].name : evRaw[0] || '').trim() : '';
  if (evName) {
    const csEvents = await getAll(CS_EVENT_TABLE, CS_EVENT_NAME);
    const evMatch = csEvents.find((r) => ((r.fields[CS_EVENT_NAME] || '').trim()) === evName);
    if (evMatch) eventRecId = evMatch.id;
  }

  // ── Requested By = the person who checked the box (Raised By → Employee) ──
  let requesterId = null;
  if (social.fields.some((f) => f.name === S_RAISED_BY)) {
    const raisedBy = rec.getCellValue(S_RAISED_BY);
    console.log('Raised By cell =', JSON.stringify(raisedBy)); // debug
    const email = raisedBy && raisedBy.email ? raisedBy.email : '';
    const name = raisedBy && raisedBy.name ? raisedBy.name : '';
    if (email) requesterId = await findEmployeeId(email);
    if (!requesterId && name) requesterId = await findEmployeeByName(name);
    console.log('resolved requesterId =', requesterId);
  } else {
    console.log(`"${S_RAISED_BY}" field missing → add a "Last modified by" field named "${S_RAISED_BY}" to set Requested By`);
  }

  // ── Build the ticket ──
  const title = (rec.getCellValueAsString(S_TITLE) || 'Social clip').trim();
  const brief = [
    rec.getCellValueAsString(S_NOTES),
    rec.getCellValueAsString(S_CAPTIONS) ? `Caption: ${rec.getCellValueAsString(S_CAPTIONS)}` : '',
    rec.getCellValueAsString(S_SOURCE_URL) ? `Source: ${rec.getCellValueAsString(S_SOURCE_URL)}` : '',
  ].filter(Boolean).join('\n\n') || 'Social clip from the content portal.';

  const fields = {
    [P_PROJECT]: title,
    [P_BRIEF]: brief,
    [P_TEAM]: TEAM_SERVICE_LEVEL,
    [P_TYPE]: 'Video',
    [P_PRIO]: 'New Request',
    [P_ASSET_LINK]: [assetMatch.id],
  };
  if (eventRecId) fields[P_EVENT_LINK] = [eventRecId];
  if (requesterId) fields[P_REQUESTED_BY] = [requesterId];

  const created = await (await fetch(`${AT}/${CS_BASE}/${PRIO}`, {
    method: 'POST', headers: H, body: JSON.stringify({ fields, returnFieldsByFieldId: true }),
  })).json();

  if (!created.id) { console.log('ticket create failed:', JSON.stringify(created)); return; }

  await social.updateRecordAsync(recordId, {
    [S_TICKET_ID]: created.id,
    [S_STATUS]: { name: STATUS_RAISED },
  });

  console.log(`raised ticket ${created.id} for "${title}"${requesterId ? ' (requester set)' : ' (no requester match)'}`);
}

await run();
