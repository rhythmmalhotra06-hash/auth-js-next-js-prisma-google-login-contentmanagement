// One message's week, day by day — the drill-down behind the message on the brand card.
//
// Read top to bottom the way the meeting reads a day: the email first (it sets the beat), then
// the posts with their artwork and results, then Vishen's assets. Reach is shown per post and
// counted per platform in the header; it is NEVER summed across platforms — the platforms do not
// report the same things (see lib/mow/week-pack.ts), and one total would be an Instagram number
// wearing the message's clothes.
//
// A post with no result reads "no published post matched", never 0. A day with nothing under
// this message is a quiet row, not a gap: the message may simply not have run that day.

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyFine, EmptyOwned } from '@/components/ui/Empty';
import { cn } from '@/lib/cn';
import type { MessageWeek as MessageWeekData, MessageWeekItem } from '@/lib/mow/message-week';

function Thumb({ url }: { url: string | null | undefined }) {
  if (!url) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- signed, expiring Airtable URLs; see PostGrid
    <img src={url} alt="" loading="lazy" decoding="async" className="h-14 w-14 flex-none rounded-xs border border-border-default object-cover" />
  );
}

function LiveLink({ url }: { url: string | null }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-2xs font-medium text-brand hover:underline" title="Open the live post">
      Live ↗
    </a>
  );
}

function Result({ item }: { item: MessageWeekItem }) {
  if (item.kind === 'email') return <EmptyFine>results live in Braze</EmptyFine>;
  if (item.results?.reach) {
    return (
      <span className="flex items-baseline gap-1.5">
        <span className="font-display text-[15px] font-bold tabular-nums">{item.results.reach.toLocaleString('en-US')}</span>
        <span className="text-2xs text-text-subtle">reach{item.results.multiAccount ? ' · several accounts' : ''}</span>
        {item.results.engagements ? (
          <span className="text-2xs text-text-subtle">· {item.results.engagements.toLocaleString('en-US')} eng.</span>
        ) : null}
      </span>
    );
  }
  if (item.kind === 'vl') {
    // Perch watches the Mindvalley social accounts, not Vishen's LinkedIn or YouTube.
    return <EmptyFine>{item.live ? 'no results source for this channel yet' : 'not live yet'}</EmptyFine>;
  }
  return <EmptyFine>no published post matched</EmptyFine>;
}

function Row({ item, weekHref }: { item: MessageWeekItem; weekHref: string }) {
  const detailHref = item.kind === 'email'
    ? null
    : `/studio/comms-calendar/asset/${item.id}?brand=${item.brand === 'VL' ? 'vl' : 'main'}&week=${weekHref}`;
  const title = detailHref ? (
    <Link href={detailHref} className="hover:underline">{item.title}</Link>
  ) : (
    item.title
  );
  return (
    <li className={cn('flex items-start gap-3 border-l-2 py-2 pl-3', item.live ? 'border-l-success' : 'border-l-border-default')}>
      <Thumb url={item.imageUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={item.brand === 'VL' ? 'vishen' : 'brand'} dot={false}>{item.brand === 'VL' ? 'Vishen' : 'Mindvalley'}</Badge>
          {(item.platforms?.length ? item.platforms : item.channel ? [item.channel] : []).map((p) => (
            <Badge key={p} tone="neutral" dot={false}>{p}</Badge>
          ))}
          <span className="ml-auto"><LiveLink url={item.publishedUrl} /></span>
        </div>
        <div className="mt-1 text-[13px] font-semibold leading-snug text-pretty">{title}</div>
        <div className="mt-1"><Result item={item} /></div>
      </div>
    </li>
  );
}

export function MessageWeekView({ data, weekHref }: { data: MessageWeekData; weekHref: string }) {
  const total = data.counts.posts + data.counts.emails + data.counts.vl;

  if (!total) {
    return (
      <div className="rounded-md border border-border-default bg-surface px-4 py-6">
        <EmptyOwned kind="notSet" owner={null} />
        <p className="mt-1.5 text-xs text-text-muted">
          Nothing in this week&rsquo;s comms calendar carries this message. It may run on other
          weeks — the brand card says how far it spans.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <p className="text-xs text-text-muted">
        <span className="font-semibold text-text">{data.counts.posts}</span> {data.counts.posts === 1 ? 'post' : 'posts'}
        {data.counts.emails ? <>, <span className="font-semibold text-text">{data.counts.emails}</span> {data.counts.emails === 1 ? 'email' : 'emails'}</> : null}
        {data.counts.vl ? <>, <span className="font-semibold text-text">{data.counts.vl}</span> Vishen {data.counts.vl === 1 ? 'asset' : 'assets'}</> : null}
        {' '}under this message.{' '}
        <span className="text-text-subtle">
          {data.counts.matched} of {data.counts.posts} posts matched to a published post; reach is per post and never totalled across platforms.
        </span>
      </p>

      <div className="flex flex-col gap-3">
        {data.days.map((d) => (
          <section key={d.date} className={cn('rounded-md border bg-surface', d.isToday ? 'border-brand-border' : 'border-border-default')}>
            <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border-default px-[18px] py-2.5">
              <span className="text-[13px] font-semibold">
                {d.weekday.slice(0, 3)} {d.dayOfMonth}
                {d.isToday ? <span className="ml-1.5 text-2xs font-medium text-brand">today</span> : null}
              </span>
              <span className="text-2xs text-text-subtle">
                {d.items.length ? `${d.items.length} under this message` : d.isFuture ? 'upcoming' : 'nothing under this message'}
                {d.planned !== null && d.delivered !== null && !d.isFuture
                  ? ` · day total: ${d.planned} planned, ${d.delivered} went live`
                  : null}
              </span>
            </header>
            {d.items.length ? (
              <ul className="flex flex-col divide-y divide-border-default px-[18px] py-1">
                {d.items.map((it) => <Row key={`${it.kind}:${it.id}`} item={it} weekHref={weekHref} />)}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
    </div>
  );
}
