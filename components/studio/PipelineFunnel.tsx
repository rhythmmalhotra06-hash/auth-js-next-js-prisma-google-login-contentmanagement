import Link from 'next/link';

export interface FunnelStage {
  key: string;
  label: string;
  count: number | string;
  cap: string;          // small uppercase caption under the count
  sub?: string;         // optional note line
  href: string;
  icon: string;         // emoji glyph in the stage chip
  gold?: boolean;       // gold accent (attention) — legacy, prefer `tone`
  /** Lifecycle state colour: violet=production, gold=awaiting, blue=ready, green=published. */
  tone?: 'prod' | 'review' | 'ready' | 'pub';
}

// Engine pipeline funnel — the Studio hero. Lifecycle stages, arrow-connected,
// each a link into the matching grid. Counts come from existing studio selectors.
export function PipelineFunnel({ stages }: { stages: FunnelStage[] }) {
  return (
    <div className="st-funnel">
      {stages.map((s, i) => (
        <Link
          key={s.key}
          href={s.href}
          className={`st-lane${s.tone ? ` tone-${s.tone}` : ''}${s.gold ? ' gold' : ''}`}
        >
          {i < stages.length - 1 && <span className="st-arrow" aria-hidden>→</span>}
          <div className="st-stage"><span className="ic">{s.icon}</span><span className="nm">{s.label}</span></div>
          <div className="st-count">{s.count}</div>
          {s.cap && <div className="st-cap">{s.cap}</div>}
          {s.sub && <div className="st-sub"><span className="d" />{s.sub}</div>}
        </Link>
      ))}
    </div>
  );
}
