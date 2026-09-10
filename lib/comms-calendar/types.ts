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
  /** Null means no message committed. NEVER borrow the other brand's to fill it. */
  message: string | null;
  goal: string | null;
  /** True when the message name is junk (`test`) rather than absent. A third data state. */
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
  /** The not-dated tray. Its count is the nag. */
  notDated: { total: number; published: number; unpublished: number };
  /** Latest Live Date anywhere, so the grid can state its own boundary instead of looking broken. */
  datedThrough: string | null;
  /** When the underlying read happened — the calendar must never imply live data. */
  asOf: string;
  /** Non-fatal problems worth showing rather than swallowing. */
  warnings: string[];
}
