import { Suspense } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/ui/AppShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyFine, EmptyOwned } from '@/components/ui/Empty';
import { Skel } from '@/components/ui/Skeletons';
import { getPlannedEmail } from '@/lib/comms-calendar/emails';
import { getEmailResults, type AudienceResult, type EmailResults } from '@/lib/braze/results';

// Email detail — the counterpart to the asset detail, for the other half of the Mindvalley lane.
//
// An email was the one thing on the calendar with nowhere to go: the lane rendered the word
// "Email" and that was all anyone could learn without opening Airtable. This is what the row
// opens into — the copy as planned, the lists it went to, and what Braze says each of them did.
//
// PER LIST, NOT JUST A TOTAL. One planned email is six to eleven Braze campaigns, and the team
// reads them separately because Daily and Members behave nothing alike — their own benchmark
// sheet is written per list. The rollup is offered first because the meeting wants one number,
// and the breakdown sits under it because that is where the decisions get made.

export const dynamic = 'force-dynamic';

const pct = (v: number | null): string => (typeof v === 'number' ? `${v.toFixed(1)}%` : '—');
const num = (v: number | null): string => (typeof v === 'number' ? v.toLocaleString('en-US') : '—');

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">{label}</div>
      <div className="mt-1 text-[13px] leading-snug text-pretty">{value ?? <EmptyFine>—</EmptyFine>}</div>
    </div>
  );
}

export default async function EmailDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const backHref = sp.week ? `/performance/week?week=${sp.week}` : '/studio/comms-calendar';

  return (
    <AppShell title="Email">
      <div className="flex flex-col gap-[22px]">
        <Link href={backHref} className="text-[12.5px] font-medium text-brand hover:underline">
          ← Back
        </Link>
        <Suspense fallback={<div className="flex flex-col gap-3"><Skel height={140} /><Skel height={220} /></div>}>
          <Body id={id} />
        </Suspense>
      </div>
    </AppShell>
  );
}

async function Body({ id }: { id: string }) {
  let email: Awaited<ReturnType<typeof getPlannedEmail>> = null;
  let error: string | null = null;
  try {
    email = await getPlannedEmail(id);
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
  }

  if (error) {
    return (
      <div className="rounded-md border border-danger bg-danger-soft px-4 py-3">
        <div className="text-[13.5px] font-semibold text-danger-content">Could not read the email</div>
        <div className="mt-1 text-xs text-text-muted">{error}</div>
      </div>
    );
  }
  if (!email) {
    return (
      <div className="rounded-md border border-border-default bg-surface px-4 py-3">
        <div className="text-[13.5px] font-semibold">No such email</div>
        <div className="mt-1 text-xs text-text-muted">It may have been deleted in Airtable since the calendar was read.</div>
      </div>
    );
  }

  // The send day bounds the search: a campaign is only this email's if it went out around when
  // this email was planned. See lib/braze/match.ts for why the date is a gate, not a score.
  const day = email.liveDate;
  const results = day
    ? (await getEmailResults([{ id: email.id, title: email.title, subject: email.subject, liveDate: day, audiences: email.audiences }], { from: day, to: day }).catch(() => new Map())).get(email.id) ?? null
    : null;

  return (
    <>
      <div className="rounded-md border border-border-default bg-surface p-[18px]">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">Mindvalley</Badge>
          {email.emailType ? <Badge tone="neutral" dot={false}>{email.emailType}</Badge> : null}
          {email.stage ? <Badge tone={email.stage.toLowerCase().includes('sent') ? 'success' : 'neutral'}>{email.stage}</Badge> : null}
        </div>

        <h2 className="mt-3 font-display text-xl font-bold leading-[1.25] tracking-[-.02em] text-pretty">{email.title}</h2>

        {/* The subject is the promoted field here for the same reason Live Date is on the asset
            page: it is what the recipient actually saw, and it is the key everything joins on. */}
        <div className="mt-[22px] rounded-sm border border-border-strong bg-surface p-3.5">
          <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">Subject line</div>
          {email.subject ? (
            <div className="mt-1 font-display text-[17px] font-bold leading-snug tracking-[-.01em] text-pretty">{email.subject}</div>
          ) : (
            <>
              <EmptyOwned kind="notSet" owner="no Sub:/Subject: line in the copy · Ramya" className="mt-1" />
              <div className="mt-1.5 text-xs leading-relaxed text-text-muted">
                The subject is read from the first line of the copy. Without it this email cannot be
                matched to its Braze numbers by anything stronger than its name.
              </div>
            </>
          )}
          {email.preheader ? <div className="mt-1.5 text-xs text-text-muted">{email.preheader}</div> : null}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Live date" value={email.liveDate
            ? new Date(`${email.liveDate}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
            : <EmptyFine>not dated</EmptyFine>} />
          <Field label="Purpose" value={email.purpose ?? <EmptyFine>—</EmptyFine>} />
          <Field
            label="Lists"
            value={email.audiences.length
              ? <span className="flex flex-wrap gap-1">{email.audiences.map((a) => <Badge key={a} tone="neutral" dot={false}>{a}</Badge>)}</span>
              : <EmptyFine>none set</EmptyFine>}
          />
          <Field
            label="Links"
            value={
              <span className="flex flex-wrap gap-x-3 gap-y-1">
                {email.copyDoc ? <a href={email.copyDoc} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">Copy doc ↗</a> : null}
                {email.blogLink ? <a href={email.blogLink.split(/\s+/)[0]} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">Blog ↗</a> : null}
                {email.brazeUrls.map((u, i) => (
                  <a key={u} href={u} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                    Braze {email.brazeUrls.length > 1 ? i + 1 : ''}↗
                  </a>
                ))}
                {!email.copyDoc && !email.blogLink && !email.brazeUrls.length ? <EmptyFine>—</EmptyFine> : null}
              </span>
            }
          />
        </div>
      </div>

      <ResultsSection results={results} planned={email.audiences} />

      {email.body ? (
        <section>
          <h3 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">The copy, as planned</h3>
          <div className="rounded-md border border-border-default bg-surface p-[18px]">
            <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-text-muted">{email.body}</pre>
          </div>
        </section>
      ) : null}
    </>
  );
}

function ResultsSection({ results, planned }: { results: EmailResults | null; planned: string[] }) {
  return (
    <section>
      <h3 className="mb-[14px] text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">
        What it did
      </h3>
      {!results || !results.total ? (
        <div className="rounded-md border border-border-default bg-surface px-4 py-4">
          <EmptyOwned kind="notSet" owner="no Braze campaign matched" />
          <p className="mt-1.5 max-w-prose text-xs leading-relaxed text-text-muted">
            Numbers are matched to Braze by subject line and send date — there is no shared id
            between the two systems. A miss usually means the subject was changed in Braze after
            the email was planned here, or the nightly pull has not run for this week yet.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 rounded-md border border-border-default bg-surface p-[18px] sm:grid-cols-4">
            {([
              ['Sent', num(results.total.sent)],
              ['Opened', pct(results.total.openRate)],
              ['CTOR', pct(results.total.ctor)],
              ['Unsubscribes', num(results.total.unsubscribes)],
            ] as const).map(([label, value]) => (
              <div key={label}>
                <div className="text-2xs font-semibold uppercase tracking-[.08em] text-text-subtle">{label}</div>
                <div className="mt-1 font-display text-[22px] font-bold leading-none tabular-nums tracking-[-.02em]">{value}</div>
              </div>
            ))}
          </div>

          {results.maturing ? (
            <div className="rounded-md border border-staged bg-staged-soft px-4 py-2.5 text-xs text-staged-content">
              Sent in the last 48 hours — opens are still arriving, so these will rise. Braze reports
              in daily buckets, so there is no true 24-hour figure to show instead.
            </div>
          ) : null}

          {/* The breakdown. Rates above are recomputed from summed counts, never averaged across
              these rows — the lists differ in size by an order of magnitude. */}
          <div className="overflow-x-auto rounded-md border border-border-default bg-surface">
            <table className="list w-full">
              <thead>
                <tr>
                  <th className="text-left">List</th>
                  <th className="text-right">Sent</th>
                  <th className="text-right">Open rate</th>
                  <th className="text-right">CTR</th>
                  <th className="text-right">CTOR</th>
                  <th className="text-right">Unsub</th>
                  <th className="text-left">Campaign</th>
                </tr>
              </thead>
              <tbody>
                {results.perAudience.map((a: AudienceResult) => (
                  <tr key={a.brazeCampaignId}>
                    <td className="font-medium">{a.audience ?? <EmptyFine>untagged</EmptyFine>}</td>
                    <td className="text-right tabular-nums">{num(a.sent)}</td>
                    <td className="text-right tabular-nums">{pct(a.openRate)}</td>
                    <td className="text-right tabular-nums">{pct(a.ctr)}</td>
                    <td className="text-right tabular-nums">{pct(a.ctor)}</td>
                    <td className="text-right tabular-nums">{num(a.unsubscribes)}</td>
                    <td className="text-2xs text-text-subtle">
                      {a.campaignName}
                      {/* Provenance, so a 0.6 match is visible rather than inherited. */}
                      {!a.confident ? <span className="ml-1 text-staged-content">· matched by name</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {results.unmatchedAudiences.length ? (
            <p className="text-2xs text-text-subtle">
              No campaign matched for {results.unmatchedAudiences.join(', ')} — planned for{' '}
              {planned.length} {planned.length === 1 ? 'list' : 'lists'}, {results.perAudience.length} matched.
            </p>
          ) : null}

          <p className="text-2xs text-text-subtle">
            From Braze, pulled nightly. Open rate is unique opens over delivered; CTOR is clicks
            over opens. Apple Mail&rsquo;s automatic opens are included, as they are everywhere else.
          </p>
        </div>
      )}
    </section>
  );
}
