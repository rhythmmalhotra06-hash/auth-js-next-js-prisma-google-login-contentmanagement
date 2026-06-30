// Airtable Automation script — SOCIAL FAN-OUT: 📣 Social (approved + raised) → 🎯 Prio tickets.
//
// Both tables live in the 📣 MV Content & Comms base (app9YRZOVeE65fJPA), so this is an
// INTRA-base automation using the native scripting API — no PAT / fetch needed.
//
// Setup (in the Content & Comms base app9YRZOVeE65fJPA):
//   1. Automations → New automation.
//   2. Trigger: "When a record matches conditions" on the 📣 Social table, conditions:
//        Status               is   "2: Approved"
//        Raise Request (Creative)  is checked
//        (Optionally also: Asset Type is not empty — the script re-checks anyway.)
//      (A plain "created or updated" trigger also works; the script gates internally.)
//   3. Action: "Run a script". Input variable:
//        recordId  →  the trigger step's "Airtable record ID"
//   4. Paste this script. Test, then toggle On.
//
// Behaviour (propose → commit → fan-out): when a human has set an Asset Type and checked
// "Raise Request (Creative)" on an approved suggestion, create ONE Prio ticket per linked
// Asset Type, link each back to the Social row, write the ticket links into "Creative
// Request", and flip Status → "2A. Ticket Raised". Idempotent: skips rows that already
// carry a Creative Request. The checkbox is left checked (preserved), matching Shoots.

const config = input.config();
const recordId = config.recordId;

// 📣 Social — field IDs (rename-proof; match lib/airtable/field-map.ts SOCIAL).
const SOCIAL_TABLE = 'tblCcrdkHzOakOGnm';
const S_STATUS = 'fld8F8Z05DIzh5BJM';
const S_RAISE = 'fldrNumf2EpoRetuf';
const S_ASSET_TYPE = 'fldWJgCJ10WnRe62U'; // → 🛎️ Creative Asset Type
const S_CREATIVE_REQUEST = 'flddCgrgYAcBMFcs9'; // → 🎯 Prio (link-back target)
const S_TITLE = 'fldBDHsk0YiLMiCqX';
const S_NOTES = 'fldJc3ZNwn42yMW35';

const STATUS_APPROVED = '2: Approved';
const STATUS_TICKET_RAISED = '2A. Ticket Raised';

// 🎯 Prio: Creatives Requests (New) — field IDs (match SOCIAL_PRIO).
const PRIO_TABLE = 'tblojUG9wmfTru9Wc';
const P_NAME = 'fldcLqx95hRTklFFq';
const P_NOTES = 'fldcyhu1RbiQkijhp';
const P_ASSET_TYPE = 'fldN8xTDWr9wnAPzd';
const P_PRIO_STATUS = 'fld7kNhgIYw5tk0au';
const P_TEAM_SERVICE = 'fldHWXRcyhKshGaS2';
const P_SOCIAL = 'fldaBYvP6gkirDDw8'; // → 📣 Social (reciprocal link-back)

const PRIO_STATUS_NEW = 'New Request';
const TEAM_SERVICE_SOCIAL = 'Social Media Video';

async function run() {
  const social = base.getTable(SOCIAL_TABLE);
  const prio = base.getTable(PRIO_TABLE);

  const rec = await social.selectRecordAsync(recordId);
  if (!rec) { console.log('record gone'); return; }

  // ── Gate ──────────────────────────────────────────────────────────────────
  const status = rec.getCellValueAsString(S_STATUS);
  const raised = rec.getCellValue(S_RAISE) === true;
  const assetTypes = rec.getCellValue(S_ASSET_TYPE) || []; // array of {id,name}
  const existing = rec.getCellValue(S_CREATIVE_REQUEST) || [];

  if (status !== STATUS_APPROVED) { console.log(`status "${status}" != approved → skip`); return; }
  if (!raised) { console.log('Raise Request not checked → skip'); return; }
  if (!assetTypes.length) { console.log('no Asset Type set → skip'); return; }
  if (existing.length) { console.log('Creative Request already set → already raised, skip'); return; }

  const title = rec.getCellValueAsString(S_TITLE) || 'Social clip';
  const notes = rec.getCellValueAsString(S_NOTES) || '';

  // ── Fan-out: one ticket per Asset Type ──────────────────────────────────────
  const newTicketIds = [];
  for (const at of assetTypes) {
    const ticketId = await prio.createRecordAsync({
      [P_NAME]: title,
      [P_NOTES]: notes,
      [P_ASSET_TYPE]: [{ id: at.id }],
      [P_PRIO_STATUS]: { name: PRIO_STATUS_NEW },
      [P_TEAM_SERVICE]: { name: TEAM_SERVICE_SOCIAL },
      [P_SOCIAL]: [{ id: recordId }],
    });
    newTicketIds.push({ id: ticketId });
  }

  // ── Link-back + status flip (checkbox preserved) ────────────────────────────
  await social.updateRecordAsync(recordId, {
    [S_CREATIVE_REQUEST]: newTicketIds,
    [S_STATUS]: { name: STATUS_TICKET_RAISED },
  });

  console.log(`raised ${newTicketIds.length} ticket(s) for "${title}"`);
}

await run();
