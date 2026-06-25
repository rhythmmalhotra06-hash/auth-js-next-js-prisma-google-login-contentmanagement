#!/usr/bin/env node
/**
 * export-airtable-schema.js
 * --------------------------------------------------------------------------
 * Pulls the FULL live schema (tables, fields, types, select options, links)
 * for every base the content system touches, and writes one JSON file per
 * base into ./context/airtable-schema/.
 *
 * This is step 1 before any sync code. It replaces every [VERIFY] guess in
 * schema.sql with ground truth: real field names, real single-select option
 * values, real link relationships (single vs multi record).
 *
 * USAGE:
 *   export AIRTABLE_TOKEN=pat_xxx        # personal access token, scope: schema.bases:read
 *   node export-airtable-schema.js
 *
 * The token needs the `schema.bases:read` scope and access to each base.
 * --------------------------------------------------------------------------
 */

const fs = require("fs");
const path = require("path");

const TOKEN = process.env.AIRTABLE_TOKEN;
if (!TOKEN) {
  console.error("Missing AIRTABLE_TOKEN env var (needs schema.bases:read scope).");
  process.exit(1);
}

// Bases the system touches. Add Brain's base id once confirmed.
const BASES = {
  creative_services: "appFEFygXo2pRc8AR",
  titus_video:       "appDZnMnJGehbSOo5",
  ads_creative_lib:  "appWYOr2p4RKHf2LR",
  // brain:          "appXXXXXXXXXXXXXX",  // TODO: confirm Brain base id
};

const OUT_DIR = path.join(__dirname, "context", "airtable-schema");

async function fetchSchema(baseId) {
  const url = `https://api.airtable.com/v0/meta/bases/${baseId}/tables`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`${baseId}: ${res.status} ${res.statusText} — ${await res.text()}`);
  }
  return res.json();
}

/**
 * Reduce the raw payload to a readable summary: for each table, list fields
 * with id, name, type, and — crucially — select options and link targets.
 */
function summarize(raw) {
  return raw.tables.map((t) => ({
    id: t.id,
    name: t.name,
    primaryFieldId: t.primaryFieldId,
    fields: t.fields.map((f) => {
      const out = { id: f.id, name: f.name, type: f.type };
      const o = f.options || {};
      if (o.choices) out.choices = o.choices.map((c) => c.name);          // single/multi select
      if (o.linkedTableId) {
        out.linkedTableId = o.linkedTableId;
        out.prefersSingleRecordLink = o.prefersSingleRecordLink ?? null;  // single vs multi link
      }
      if (o.result) out.resultType = o.result.type;                       // lookup/rollup result
      if (o.formula) out.formula = o.formula;                             // formula expression
      return out;
    }),
  }));
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  for (const [label, baseId] of Object.entries(BASES)) {
    try {
      const raw = await fetchSchema(baseId);
      // Write both the raw payload and a readable summary.
      fs.writeFileSync(
        path.join(OUT_DIR, `${label}.raw.json`),
        JSON.stringify(raw, null, 2)
      );
      fs.writeFileSync(
        path.join(OUT_DIR, `${label}.summary.json`),
        JSON.stringify(summarize(raw), null, 2)
      );
      const tableCount = raw.tables.length;
      const fieldCount = raw.tables.reduce((n, t) => n + t.fields.length, 0);
      console.log(`✓ ${label} (${baseId}): ${tableCount} tables, ${fieldCount} fields`);
    } catch (e) {
      console.error(`✗ ${label} (${baseId}): ${e.message}`);
    }
  }
  console.log(`\nWrote schema files to ${OUT_DIR}`);
  console.log("Next: reconcile every [VERIFY] in schema.sql against the .summary.json files.");
})();
