import { AppShell } from '@/components/ui/AppShell';
import { Badge, SLOT_TONE } from '@/components/ui/Badge';
import { AssetRow, AssetCard, OverflowCollapse, ThumbPlaceholder } from '@/components/ui/Asset';
import { EmptyOwned, EmptyFine, PlaceholderValue, TIER1, TIER2 } from '@/components/ui/Empty';
import { BigNumber } from '@/components/ui/BigNumber';

// Component sheet — artboard `3a` made real, and the source of truth for every MOW surface.
//
// It is a PAGE rather than a static document on purpose: the handoff's two hardest rules can only
// be checked by looking at rendered output in both themes —
//   · at most ONE gold element per screen (counted honestly: a gold frame containing gold pills
//     and gold buttons is three, not one), and
//   · tier-2 empty loses its surface entirely on dark, which is why it is a theme-aware variant
//     and not one component with two skins.
// Toggle the theme on this page and both are verifiable in seconds.

export const dynamic = 'force-dynamic';

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-[38px]">
      <h2 className="font-display text-base font-bold tracking-[-.015em]">{title}</h2>
      {note ? <p className="mt-1 max-w-[78ch] text-[12.5px] leading-relaxed text-text-muted">{note}</p> : null}
      <div className="mt-[22px]">{children}</div>
    </section>
  );
}

export default function ComponentSheetPage() {
  return (
    <AppShell title="Component sheet" subtitle="Artboard 3a — every MOW surface assembles from this">
      <div className="max-w-[1180px]">

        <Section
          title="1 · Colour roles — one job each"
          note="Red was doing three jobs: missed, “this week's figures are sample”, and “nothing planned after 22 Sep”. Two of those are wrong. Violet-slate absorbing everything provisional is what frees red to be sharp."
        >
          <div className="grid gap-[14px] sm:grid-cols-2 lg:grid-cols-3">
            {([
              ['Gold', 'Attention. Exactly one element per screen.', 'Never a status.'],
              ['Red', 'Missed — due and did not happen.', 'Never sample data or an empty future week.'],
              ['Amber', 'Blocked — waiting on someone upstream.', 'Never an editor’s failure.'],
              ['Violet-slate', 'Provisional — staged, inferred, sample, unowned.', 'Never a lifecycle state.'],
              ['Green', 'Landed — on plan, published, committed.', 'Never anything unfinished.'],
              ['Teal / purple', 'Brand.', 'Never anything else.'],
            ] as const).map(([role, means, never]) => (
              <div key={role} className="rounded-md border border-border-default bg-surface p-4">
                <div className="text-[13px] font-semibold">{role}</div>
                <div className="mt-1 text-xs text-text-muted">{means}</div>
                <div className="mt-1 text-xs text-text-subtle">{never}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="2 · Pills — one shape, three classes"
          note="A dot means a lifecycle state; no dot means a label. Maximum two pills per asset — the third is always metadata that belongs on the line beneath."
        >
          <div className="flex flex-wrap gap-2">
            <Badge tone="vishen">Vishen Lakhiani Media</Badge>
            <Badge tone="brand">Mindvalley</Badge>
            <Badge tone={SLOT_TONE.shipped}>On plan</Badge>
            <Badge tone={SLOT_TONE.blocked}>Blocked</Badge>
            <Badge tone={SLOT_TONE.missed}>Missed</Badge>
            <Badge tone={SLOT_TONE.planned}>No post</Badge>
            <Badge tone="staged" dot={false}>Staged</Badge>
            <Badge tone="success" dot={false}>Committed</Badge>
            <Badge tone="info" dot={false}>Email</Badge>
            <Badge tone="brand" dot={false}>Social</Badge>
            <Badge tone="neutral" dot={false}>LinkedIn</Badge>
          </div>
        </Section>

        <Section
          title="3 · Asset — two densities, one anatomy"
          note="Title first and heaviest. The left edge carries state and NOTHING else — brand is never repeated on the asset when the container already names it. Resting is a hairline, because “no state recorded yet” is not an error."
        >
          <div className="grid gap-[14px] lg:grid-cols-2">
            <div className="rounded-md border border-border-default bg-surface p-4">
              <div className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">Row — week view, lists</div>
              <div className="flex flex-col gap-2">
                <AssetRow title="A mentor once stopped me mid-sentence with four words." meta="LinkedIn · live" state="live"
                  pills={<Badge tone="neutral" dot={false}>LinkedIn</Badge>} />
                <AssetRow title="I visualised the trophy for years and wondered why nothing ever moved." meta="LinkedIn · 1. Idea" state={null}
                  pills={<Badge tone="staged" dot={false}>no goal</Badge>} />
                <AssetRow title="The Gift — 5-Minute Visualization" meta="Waiting on Vishen’s voiceover" state="blocked"
                  pills={<Badge tone={SLOT_TONE.blocked}>Blocked</Badge>} />
              </div>
            </div>
            <div className="rounded-md border border-border-default bg-surface p-4">
              <div className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">Card — 186px column, month</div>
              <div className="grid max-w-[186px] gap-2">
                <AssetCard title="Vishen × Jim Kwik — World #1 Brain Coach" meta="YouTube · live" state="live" />
                <OverflowCollapse count={5} label="more social" detail="channels not in this export" />
              </div>
              <p className="mt-[14px] text-2xs leading-relaxed text-text-subtle">
                The collapse is never quieter than a single asset — it usually outnumbers them.
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="4 · Empty states — two tiers, nine strings"
          note="Eleven phrasings across five files collapsed to nine canonical strings. Tier 1 always names who closes it; tier 2 is fine and must not look like a gap. Never a dashed box in light mode — it reads as a component that failed to load."
        >
          <div className="grid gap-[14px] lg:grid-cols-2">
            <div className="rounded-md border border-border-default bg-surface p-4">
              <div className="mb-[14px] flex items-center gap-2">
                <span className="h-1.5 w-1.5 bg-staged" />
                <span className="text-[13px] font-semibold">Tier 1 — someone owns this</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {(Object.keys(TIER1) as (keyof typeof TIER1)[]).map((k) => (
                  <EmptyOwned key={k} kind={k} />
                ))}
              </div>
            </div>
            <div className="rounded-md border border-border-default bg-surface p-4">
              <div className="mb-[14px] text-[13px] font-semibold">Tier 2 — this is fine</div>
              <div className="flex flex-col gap-2.5">
                {Object.values(TIER2).map((v) => <EmptyFine key={v}>{v}</EmptyFine>)}
              </div>
              <p className="mt-[14px] text-2xs leading-relaxed text-text-subtle">
                Say it once per boundary, not once per cell. Three consecutive cells reading
                “nothing dated” makes real data look like a broken fetch.
              </p>
            </div>
          </div>
        </Section>

        <Section
          title="5 · Present but meaningless — the third data state"
          note="`test` and `vcvdsv` are neither filled nor empty. The value is always shown and never rewritten — the fix belongs upstream in Airtable — but it carries a chip so junk is not mistaken for an intentional identifier."
        >
          <div className="flex flex-col gap-3 rounded-md border border-border-default bg-surface p-4">
            <PlaceholderValue value="test" note="The only Vishen-brand message in the base." />
            <PlaceholderValue value="vcvdsv" note="Its goal. Shown as written; the fix is in Airtable." />
            <PlaceholderValue value="Mindalley" chip="misspelled upstream" note="On 6 of 7 records. Recognised in code, never rewritten." />
          </div>
        </Section>

        <Section
          title="6 · The number — three cases"
          note="A missing target changes the SHAPE of the component, not just its text. Case 3 is the common one today: Goal is empty on all six real records, so no asset inherits a goal."
        >
          <div className="grid gap-[14px] lg:grid-cols-3">
            <div className="rounded-md border border-border-default bg-surface p-4">
              <BigNumber label="Leads · target set" value="18,240" target="35,000" provenance="numeric"
                source="session:metabase" asOf="Mon 7 Sep 07:40" />
            </div>
            <div className="rounded-md border border-border-default bg-surface p-4">
              <BigNumber label="Leads · target inferred" value="18,240" target="35,000" provenance="inferred"
                targetProse="To achieve 35k leads to expert to authority summit" source="session:metabase" />
            </div>
            <div className="rounded-md border border-border-default bg-surface p-4">
              <BigNumber label="Leads · no target" value="2,910" provenance="none" source="session:metabase" />
            </div>
          </div>
        </Section>

        <Section
          title="7 · Missing thumbnail"
          note="A hatch plus a stated reason. It was in a title attribute — invisible in a meeting, which is the only place it matters."
        >
          <div className="flex items-center gap-3 rounded-md border border-border-default bg-surface p-4">
            <ThumbPlaceholder />
            <EmptyOwned kind="notSet" owner="composed on a partner account, so no Hootsuite planner record" />
          </div>
        </Section>

        <Section
          title="8 · Vertical rhythm — 14 / 22 / 38"
          note="Three steps, no new tokens. The surfaces this replaces used 12–26px between everything, so a section break and a card gap looked identical."
        >
          <div className="flex flex-col gap-[14px] text-[12.5px] text-text-muted">
            <div><code className="text-brand">gap-within</code> 14px — cards in one grid, rows in one list</div>
            <div><code className="text-brand">gap-label</code> 22px — an eyebrow to the thing it names</div>
            <div><code className="text-brand">gap-section</code> 38px — the only break that says “new subject”</div>
          </div>
        </Section>

      </div>
    </AppShell>
  );
}
