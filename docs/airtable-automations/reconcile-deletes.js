// Airtable Automation script — DELETE RECONCILE (Vishen deletes → portal archive).
//
// Airtable has no "record deleted" trigger, so deletes can't propagate instantly. This runs on a
// schedule and archives portal-side mirrors whose Vishen source no longer exists.
//
// Set up in the CREATIVE SERVICES base (appFEFygXo2pRc8AR):
//   Trigger: "At a scheduled time" → hourly.
//   Action:  "Run a script". Input: apiKey (PAT, read on Vishen's base + read+write on this base).
//
// Behaviour ("archive where possible, else delete"):
//   • Media Source whose {Source Record ID} no longer exists in Major Videos → Status = "Archived".
//   • Clip Suggestion whose {Vishen Clip ID} no longer exists in Vishen Clips → Status = "Dismissed".
// (Deletions made on the Creative Services side are NOT pushed into Vishen's base — his base is the
//  authoritative source for what media/clips exist; this protects it from accidental wipes.)

const config = input.config();
const API_KEY = config.apiKey;

const VISHEN_BASE = 'appvBtCYdaSrD1y11';
const MV_TABLE = 'tblSrtPXAeiGeLUwW';   // Major Videos
const VC_TABLE = 'tblgGCaDK7W22UvSG';   // Vishen Clips
const CS_BASE = 'appFEFygXo2pRc8AR';
const SOURCES = 'tblBQhM2Blqa7uNZX';    // 📺 Media Sources
const CLIPS = 'tblquXg7eesUZwvSH';      // 🎬 Clip Suggestions
const AT = 'https://api.airtable.com/v0';
const H = { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' };

// Collect every record id in a table (paginated). Tables here are small (app-owned / Vishen's films).
async function liveIds(baseId, tableId) {
  const ids = new Set();
  let offset;
  do {
    const u = new URL(`${AT}/${baseId}/${tableId}`);
    u.searchParams.set('pageSize', '100');
    if (offset) u.searchParams.set('offset', offset);
    const r = await (await fetch(u.toString(), { headers: H })).json();
    (r.records || []).forEach((x) => ids.add(x.id));
    offset = r.offset;
  } while (offset);
  return ids;
}

// List candidate mirrors (filtered) from the Creative Services base.
async function candidates(tableId, formula, fields) {
  const out = [];
  let offset;
  do {
    const u = new URL(`${AT}/${CS_BASE}/${tableId}`);
    u.searchParams.set('filterByFormula', formula);
    u.searchParams.set('pageSize', '100');
    fields.forEach((f, i) => u.searchParams.set(`fields[${i}]`, f));
    if (offset) u.searchParams.set('offset', offset);
    const r = await (await fetch(u.toString(), { headers: H })).json();
    out.push(...(r.records || []));
    offset = r.offset;
  } while (offset);
  return out;
}

async function patch(tableId, id, fields) {
  await fetch(`${AT}/${CS_BASE}/${tableId}/${id}`, { method: 'PATCH', headers: H, body: JSON.stringify({ fields }) });
}

async function run() {
  // 1) Media Sources whose Major Video is gone → Archived.
  const liveMV = await liveIds(VISHEN_BASE, MV_TABLE);
  const orphanMS = await candidates(
    SOURCES,
    `AND({Source Record ID} != '', {Status} != 'Archived')`,
    ['Source Record ID', 'Status'],
  );
  let archived = 0;
  for (const rec of orphanMS) {
    if (!liveMV.has(rec.fields['Source Record ID'])) {
      await patch(SOURCES, rec.id, { 'Status': 'Archived' });
      archived++;
    }
  }

  // 2) Clip Suggestions whose Vishen clip is gone → Dismissed.
  const liveVC = await liveIds(VISHEN_BASE, VC_TABLE);
  const orphanClips = await candidates(
    CLIPS,
    `AND({Vishen Clip ID} != '', {Status} != 'Dismissed')`,
    ['Vishen Clip ID', 'Status'],
  );
  let dismissed = 0;
  for (const rec of orphanClips) {
    if (!liveVC.has(rec.fields['Vishen Clip ID'])) {
      await patch(CLIPS, rec.id, { 'Status': 'Dismissed' });
      dismissed++;
    }
  }

  console.log(`reconcile: archived ${archived} media source(s), dismissed ${dismissed} clip(s)`);
}

await run();
