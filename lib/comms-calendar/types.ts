// Shapes the comms calendar renders. Deliberately backend-agnostic: the Airtable reader and the
// (later) Postgres reader both produce these, so the surface never learns where its data came from.
//
// Everything here tolerates absence, because absence IS the data. 221 of 440 Vishen-lane assets
// have no Live Date, `Goal` is empty on all six real messages, and the only VL message is named
// `test`. A shape that assumed these were populated would render the live base as a broken page.

/** Which lane an asset belongs to. Brand, not status — VL is teal on every surface. */
export type Brand = 'MV' | 'VL';

/** The three states of the one route. Not three routes. */
export type BrandState = 'main' | 'vl' | 'mv';

export interface CalendarAsset {
  id: string;
  title: string;
  brand: Brand;
  /** LinkedIn, YouTube, Email, Social… Displayed as text, not a third pill. */
  channel: string | null;
  /** '7. Published', '1. Idea', … Null when the source has no status concept. */
  status: string | null;
  /** 'VL LI: Two Comma PR', 'VL IG: Risevoice' … who produced it. */
  source: string | null;
  publishedUrl: string | null;
  /** True once the asset is live. Drives the asset's left edge. */
  live: boolean;
  /** The message it inherits, if any — and whether that message has a goal. */
  messageName: string | null;
  goal: string | null;
  /**
   * Coarse platforms this went to — Facebook, Instagram, LinkedIn. Empty for lanes that have no
   * channel concept. Drives the per-platform filter on the post grid.
   */
  platforms?: string[];
  /**
   * Delivered numbers, when a Perch caption matched (57% of posts inside Perch's window).
   * Null means NOT MATCHED, never zero — see lib/comms-calendar/social-posts.ts.
   */
  results?: { reach: number | null; engagements: number | null; multiAccount: boolean } | null;
  /** Post artwork, where the record carries an attachment (62% of them). */
  imageUrl?: string | null;
}

/** One day in the week, both lanes. */
export interface CalendarDay {
  /** YYYY-MM-DD, UTC calendar day. */
  date: string;
  weekday: string;
  dayOfMonth: number;
  isToday: boolean;
  isWeekend: boolean;
  vl: CalendarAsset[];
  mv: CalendarAsset[];
  /**
   * Assets beyond the ones rendered individually, per lane. In day-ROW layout (artboard 1a)
   * titles fit on one line and don't truncate, so the Vishen lane needs no collapse at all —
   * only Mindvalley's higher-volume social days do.
   */
  mvOverflow: number;
  vlOverflow: number;
}

/** A brand's message for the week — or the explicit absence of one. */
export interface BrandWeekHeader {
  brand: Brand;
  label: string;
  /**
   * Null means no message fit to show — either none committed, or one that is junk (Y2).
   * NEVER borrow the other brand's to fill it, and never scan outside the week for a candidate:
   * doing the latter is how the VL lane once presented a 16 Sep message as w/c 7 Sep's.
   */
  message: string | null;
  goal: string | null;
  /**
   * Other messages that also fall in this week, most-covering first — kept, not discarded.
   *
   * Live case, w/c 7 Sep: `Expert to Authority` covers six days and leads; `Jim Kwik (Mention
   * Expert to Authority)` covers Tuesday alone and sits beneath it. They are not rivals — the
   * second is a beat inside the first. An earlier pass dropped it, hiding a real day's content.
   */
  related: { name: string; days: number }[];
  /**
   * True when the value in the base is junk (`test`, `vcvdsv`) rather than absent.
   *
   * Y2: this does NOT reach the display — `message`/`goal` are already null in that case and the
   * surface renders the ordinary tier-1 gap. It survives on the shape so the junk can be named in
   * `warnings`, which is where the people who can fix it upstream will see it.
   */
  messageIsPlaceholder: boolean;
  goalIsPlaceholder: boolean;
  /** Assets dated into this week for this brand. */
  datedCount: number;
  /** Lane volume for the 6c-option-C header bar: this lane's share of the busier lane. */
  volumePct: number;
  /** e.g. 'spans 7–21 Sep' when a message covers more than this week. */
  spanNote: string | null;
}

export interface CalendarWeek {
  weekStart: string;
  weekEnd: string;
  days: CalendarDay[];
  headers: BrandWeekHeader[];
  /**
   * Brands with no committed goal — the thing the meeting is blocked by, and the one gold element.
   *
   * The design assumed both would be empty. On live data Mindvalley's comms calendar carries a real
   * goal while Vishen's is the placeholder `vcvdsv`, so the strip names which brand is missing one
   * instead of claiming neither has any. Still exactly one gold element.
   */
  brandsWithoutGoal: Brand[];
  /**
   * EVERY Mindvalley post in the week, uncapped and carrying its date.
   *
   * The day lanes cap at two rows plus an overflow count, which is right for a calendar cell and
   * wrong for a grid — building the grid from the lanes would silently drop the third post onward
   * on a busy day, and a "what went out" view that hides posts is worse than none.
   */
  allPosts: (CalendarAsset & { date: string })[];
  /**
   * The not-dated tray. Its count is the nag.
   *
   * `sharePct` is computed here rather than phrased in the component: the handoff's "more than
   * half" was true of 221-against-219 and quietly false by 204-against-238 a day later.
   */
  notDated: { total: number; published: number; unpublished: number; sharePct: number | null };
  /**
   * Latest Live Date anywhere, so the grid can state its own boundary instead of looking broken.
   *
   * NEVER a constant. The design handoff was written when the last VL date was 22 Sep; by the
   * first live run Ramya had seeded through 30 Sep, and sparsely (23, 26, 30 — nothing 24/25/27–29).
   * There is no single boundary date any more, which is why the grid states the facts rather than
   * tinting everything past a hardcoded day (Y3).
   */
  /**
   * True when any day this week links out to 📅 Official Cal — decision S2's live-campaign test.
   *
   * A campaign week defaults its headline metric to LEADS rather than revenue, because a campaign
   * is judged on the audience it builds before it is judged on what that audience buys.
   *
   * The signal is weaker than S2 assumed and the UI should not overstate it: on live September
   * data every comms day links to EITHER Official Cal or ⛳ Initiatives, alternating within a
   * week (7, 10, 11 Sep vs 8, 9, 12, 13). So this is closer to "which calendar is this day on"
   * than to a clean campaign boundary. It does still discriminate — w/c 1 Sep has none at all —
   * but it is a default a human overrides (S1), not a fact.
   */
  liveCampaign: boolean;
  datedThrough: string | null;
  /**
   * Vishen-lane assets dated AFTER this week — the honest replacement for a boundary tint.
   *
   * The tail is sparse (3 assets across 23, 26 and 30 Sep), so "content stops here" would be a
   * lie in either direction: the grid neither pretends the future is full nor paints it as missed.
   */
  datedAfterWeek: number;
  /** When the underlying read happened — the calendar must never imply live data. */
  asOf: string;
  /** Non-fatal problems worth showing rather than swallowing. */
  warnings: string[];
}
