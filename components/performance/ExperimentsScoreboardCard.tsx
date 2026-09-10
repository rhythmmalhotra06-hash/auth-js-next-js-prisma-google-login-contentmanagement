import { Icon } from '@/components/ui/Icon';

// Funnels & Experimentation's A/B test scoreboard, owned by Rafay.
//
// Why this is a link and not a band of real numbers: the scoreboard is a claude.ai Artifact
// that queries Metabase through the *viewer's own* connector (`claude.use("mcp")` →
// `fact_sales_order` + `ga4_web_session_event`) and keeps its test registry in the artifact's
// own store. There's no API to read and nothing we can iframe — the portal has no Metabase
// credentials at all. Rebuilding it here means a server-side Metabase service account plus a
// test registry the app owns; until then, link out honestly rather than half-mirror the data.
const SCOREBOARD_URL = 'https://claude.ai/code/artifact/46fdccca-d09a-4398-a12f-941912e5548a';

export function ExperimentsScoreboardCard() {
  return (
    <section>
      <div className="sec-head">
        <h3>Funnels &amp; experiments</h3>
        <span className="hint">revenue per session</span>
      </div>
      <a
        href={SCOREBOARD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="card pad row-between no-underline text-inherit"
      >
        <div className="min-w-0 flex-1">
          <b className="text-sm">Live Test Scoreboard</b>
          <div className="mt-1.5 text-xs leading-relaxed text-text-muted">
            Running A/B tests scored on revenue per session straight from the orders table, with
            live win odds and a 95% confidence bar. Kept by Rafay in Funnels &amp; Experimentation.
          </div>
          <div className="t-meta">
            <span>Opens in claude.ai</span>
            <span>·</span>
            <span>
              live numbers need the Metabase connector on your Claude account — without it the page
              shows its last saved snapshot
            </span>
          </div>
        </div>
        <Icon name="ext" size={16} />
      </a>
    </section>
  );
}
