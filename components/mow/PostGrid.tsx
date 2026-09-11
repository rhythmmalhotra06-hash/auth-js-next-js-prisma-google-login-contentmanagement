'use client';

// Every post the week put out, with its image, channel and results — artboard-adjacent, and the
// answer to "I should be able to drill down and see the posts published in Facebook, their image,
// content link and results".
//
// It is a GRID rather than a table because the image is the fastest way to recognise a post in a
// meeting; a title alone means re-reading five similar lines. Filtered by platform, because
// "how did Facebook do this week" is the question actually being asked.
//
// ── WHAT IT CAN AND CANNOT SHOW ───────────────────────────────────────────────────────────────
//
// Measured across all 8,564 📣 Social records: Title 100%, Channels 89%, image 62% — those are
// real. Published link is 3% and Airtable's own Engagement 1%, so results come from Hootsuite
// Perch instead, matched by caption, which lands on 57% of posts inside Perch's window.
//
// So a missing result means NOT MATCHED and says so. It never renders as zero, because a zero
// here would be a claim that a post reached nobody.

import { useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyFine } from '@/components/ui/Empty';
import { cn } from '@/lib/cn';
import type { CalendarAsset } from '@/lib/comms-calendar/types';

export interface PostGridItem extends CalendarAsset {
  date: string;
  imageUrl?: string | null;
}

const ALL = 'All';

function Thumb({ url, title }: { url: string | null | undefined; title: string }) {
  if (url) {
    /* Airtable attachment URLs are signed and expire within hours; Next's optimiser would cache
       bytes against a URL that soon 403s. A plain img that re-requests is correct here. */
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        // Lazy + async: a busy week is thirty-odd Airtable-CDN fetches, and eager-loading all of
        // them competed with the page's own paint. The fixed height above already reserves the box.
        loading="lazy"
        decoding="async"
        className="h-32 w-full rounded-t-sm border-b border-border-default object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="block h-32 w-full rounded-t-sm border-b border-border-default"
      style={{
        // Hatched, so it reads as deliberately absent rather than as a failed image.
        backgroundImage: 'repeating-linear-gradient(45deg,#f4f2f8 0 6px,#ece9f1 6px 12px)',
      }}
      title={title}
    />
  );
}

export function PostGrid({ posts, weekHref }: { posts: PostGridItem[]; weekHref: string }) {
  const platforms = [...new Set(posts.flatMap((p) => p.platforms ?? []))].sort();
  const [filter, setFilter] = useState<string>(ALL);

  const shown = filter === ALL ? posts : posts.filter((p) => (p.platforms ?? []).includes(filter));
  const withResults = shown.filter((p) => p.results?.reach).length;

  if (!posts.length) {
    return (
      <div className="rounded-md border border-border-default bg-surface px-4 py-6 text-center">
        <EmptyFine>No Mindvalley posts are linked to this week&rsquo;s comms calendar.</EmptyFine>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="flex flex-wrap items-center gap-3">
        {platforms.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2">
            {[ALL, ...platforms].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setFilter(p)}
                className={cn(
                  'rounded-sm border px-3 py-1.5 text-[12.5px] transition-colors',
                  p === filter
                    ? 'border-border-strong bg-bg-subtle font-semibold text-text'
                    : 'border-border-default bg-surface font-medium text-text-muted hover:bg-bg-subtle',
                )}
              >
                {p}
                <span className="ml-1.5 text-2xs text-text-subtle">
                  {p === ALL ? posts.length : posts.filter((x) => (x.platforms ?? []).includes(p)).length}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        <span className="ml-auto text-2xs text-text-subtle">
          {/* Say the coverage rather than letting a wall of "not matched" imply the tool is broken. */}
          {withResults} of {shown.length} matched to a published post
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((p) => (
          <Link
            key={p.id}
            href={`/studio/comms-calendar/asset/${p.id}?brand=main&week=${weekHref}`}
            className="flex flex-col overflow-hidden rounded-sm border border-border-default bg-surface transition-colors hover:border-brand-border"
          >
            <Thumb url={p.imageUrl} title={p.title} />

            <span className="flex min-w-0 flex-1 flex-col gap-1.5 p-2.5">
              <span className="text-2xs text-text-subtle">
                {new Date(`${p.date}T00:00:00Z`).toLocaleDateString('en-GB', {
                  weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
                })}
              </span>
              <span className="line-clamp-3 text-xs font-semibold leading-snug text-pretty">{p.title}</span>

              <span className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                {(p.platforms ?? []).map((pl) => (
                  <Badge key={pl} tone="neutral" dot={false}>{pl}</Badge>
                ))}
              </span>

              {p.results?.reach ? (
                <span className="flex items-baseline gap-1.5 border-t border-border-default pt-1.5">
                  <span className="font-display text-[15px] font-bold tabular-nums">
                    {p.results.reach.toLocaleString('en-US')}
                  </span>
                  <span className="text-2xs text-text-subtle">
                    reach{p.results.multiAccount ? ' · several accounts' : ''}
                  </span>
                </span>
              ) : (
                <span className="border-t border-border-default pt-1.5 text-2xs text-text-subtle">
                  no published post matched
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
