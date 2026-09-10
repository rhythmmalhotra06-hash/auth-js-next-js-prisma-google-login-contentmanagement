import { NextResponse } from 'next/server';
import { requireSyncSecret } from '@/lib/api/guard';
import { prisma } from '@/lib/prisma';
import { buildSmartNumber, resolveTarget, SMART_NUMBER_LABELS, type SmartNumberKey } from '@/lib/mow/smart-number';
import { utcDay, weekStartOf } from '@/lib/mow/week';
import { ensureWeek } from '@/lib/mow/week-state';
import { getCalendarWeekFromAirtable } from '@/lib/comms-calendar/data.airtable';

// Ingest the week's headline figures into a MOW week.
//
// This is the bridge in plan §2 (decision S6). The deployed app cannot call a claude.ai
// connector, so a SCHEDULED CLAUDE AGENT runs weekly with the Metabase connector attached and
// POSTs the numbers here. When IT delivers METABASE_URL + an API key, lib/metabase/client.ts
// reads questions 31846/32044 directly and this route becomes a fallback — the page never
// changes, because `source` records which path produced the figure.
//
//   curl -X POST "$URL/api/mow/metrics/ingest" \
//     -H "Authorization: Bearer $SYNC_SECRET" -H 'content-type: application/json' \
//     -d '{"weekOf":"2026-09-08","source":"session:metabase",
//          "figures":{"leads":18240,"revenue":42011.5},
//          "brands":["MV","VL"]}'
//
// GLEN'S DATA RULES apply to whatever fills `figures` — they are not advisory, each one cost
// this project real money or a day (Sep Calls/Handoff/CLAUDE.md):
//   • Revenue comes from Metabase question 32044, leads from 31846. NOTHING else is a source.
//   • NEVER question 31815 — same collection, name looks right, filters on the FIRST lead's
//     traffic_channel rather than the order's. Returns $80,076 where 32044 returns $422,722,
//     and $0 for a campaign that converted 16 times.
//   • Always SELECT DISTINCT order_id when joining fact_sales_order to fact_sales_attribution;
//     counting joined rows has inflated figures twice.
//   • Never sum the two revenue reports; never present the vendor-model figure as organic social.
//   • Organic social ONLY — not App, Email or Paid.
//   • Braze is "engaged revenue" and must never occupy the headline slot (decision S5).
//
// Staged only: a committed week keeps its number. Propose-only holds here too.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KEYS: SmartNumberKey[] = ['revenue', 'email_revenue', 'leads', 'active_users'];

interface Body {
  weekOf?: string;
  brands?: string[];
  source?: string;
  figures?: Partial<Record<SmartNumberKey, number>>;
}

export async function POST(req: Request) {
  const denied = requireSyncSecret(req);
  if (denied) return denied;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: 'Body must be JSON.' }, { status: 400 });
  }

  let weekStart: Date;
  try {
    weekStart = weekStartOf(body.weekOf ? utcDay(body.weekOf) : new Date());
  } catch {
    return NextResponse.json({ ok: false, error: 'weekOf must be YYYY-MM-DD.' }, { status: 400 });
  }

  const figures = body.figures ?? {};
  const bad = Object.keys(figures).filter((k) => !KEYS.includes(k as SmartNumberKey));
  if (bad.length) {
    return NextResponse.json(
      { ok: false, error: `Unknown figure key(s): ${bad.join(', ')}. Allowed: ${KEYS.join(', ')}.` },
      { status: 400 },
    );
  }
  for (const [k, v] of Object.entries(figures)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      return NextResponse.json({ ok: false, error: `Figure "${k}" must be a finite number.` }, { status: 400 });
    }
  }

  // Provenance is required, and must say which path produced the number so the page can show it.
  const source = body.source ?? 'session:metabase';

  let weeks = await prisma.mowWeek.findMany({
    where: { weekStart, ...(body.brands?.length ? { brand: { in: body.brands } } : {}) },
    select: { id: true, brand: true, smartNumberKey: true, committedAt: true, goal: true },
  });

  // Create the week if nobody has opened the pack for it yet.
  //
  // This used to 404 with "generate the pack first", which made the ingest depend on a human
  // having loaded a page — a footgun for a job that runs unattended on a Sunday night, and the
  // reason no figure ever reached production. `ensureWeek` resolves the message and goal from
  // Airtable exactly as the page does, so the row is identical either way.
  if (!weeks.length) {
    try {
      const cal = await getCalendarWeekFromAirtable(weekStart);
      const wanted = body.brands?.length
        ? cal.headers.filter((h) => body.brands!.includes(h.brand))
        : cal.headers;
      for (const h of wanted) {
        await ensureWeek(weekStart, h.brand, {
          message: h.message,
          goal: h.goal,
          liveCampaign: cal.liveCampaign,
        });
      }
      weeks = await prisma.mowWeek.findMany({
        where: { weekStart, ...(body.brands?.length ? { brand: { in: body.brands } } : {}) },
        select: { id: true, brand: true, smartNumberKey: true, committedAt: true, goal: true },
      });
    } catch (err) {
      return NextResponse.json(
        { ok: false, error: `Could not create the week from Airtable: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 },
      );
    }
  }
  if (!weeks.length) {
    return NextResponse.json(
      { ok: false, error: `No brands resolved for ${weekStart.toISOString().slice(0, 10)}.` },
      { status: 404 },
    );
  }

  const asOf = new Date();
  const updated: string[] = [];
  const skippedCommitted: string[] = [];
  const missingFigure: string[] = [];

  for (const w of weeks) {
    if (w.committedAt) { skippedCommitted.push(w.brand); continue; }

    const key = (w.smartNumberKey as SmartNumberKey | null) ?? 'leads';
    const value = figures[key];
    if (value == null) {
      // The week's headline metric has no figure in this payload. Leave the staged number alone
      // rather than blanking it — a partial ingest must not erase a good earlier one.
      missingFigure.push(`${w.brand}:${key}`);
      continue;
    }

    // Re-resolve the target from the week's own prose goal, so an ingest never loses the
    // 'inferred' provenance the generator established (finding F8).
    const target = resolveTarget({ numeric: null, prose: w.goal });
    const staged = buildSmartNumber({ key, value, target, source, asOf });

    const drivers = KEYS.filter((k) => k !== key && figures[k] != null).map((k) => ({
      key: k,
      label: SMART_NUMBER_LABELS[k],
      value: figures[k],
      source,
    }));

    await prisma.mowWeek.update({
      where: { id: w.id },
      data: { smartNumberStaged: staged as unknown as object, drivers: drivers as unknown as object },
    });
    updated.push(w.brand);
  }

  return NextResponse.json({
    ok: true,
    weekStart: weekStart.toISOString().slice(0, 10),
    source,
    updated,
    skippedCommitted,
    missingFigure,
  });
}
