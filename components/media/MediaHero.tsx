// Page header for a media source: what this episode is + what the page does.
// Server component — pure presentation from the already-fetched MediaSource.
import type { MediaSource } from '@/lib/media/repository';

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    New: 'bg-bg-subtle text-text-muted',
    Transcribing: 'bg-warning-soft text-warning-content',
    'Clips Suggested': 'bg-success-soft text-success-content',
    Error: 'bg-danger-soft text-danger',
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${map[status ?? ''] ?? 'bg-bg-subtle text-text-muted'}`}>
      {status ?? 'New'}
    </span>
  );
}

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-text-muted">{children}</span>
);

export function MediaHero({ source }: { source: MediaSource }) {
  const hasClips = source.clipCount > 0;
  return (
    <section className="rounded-md bg-surface p-6 shadow-sm ring-1 ring-border-default">
      <div className="flex flex-wrap items-center gap-2">
        {source.platform && <Chip>{source.platform}</Chip>}
        <StatusBadge status={source.status} />
        {source.audience && <Chip>{source.audience} audience</Chip>}
        {source.submittedVia && <span className="text-xs text-text-subtle">via {source.submittedVia}</span>}
      </div>

      <h1 className="mt-3 text-xl font-semibold leading-snug text-text">
        {source.title || source.sourceUrl || 'Untitled source'}
      </h1>
      {source.guestShow && <p className="mt-1 text-sm text-text-muted">{source.guestShow}</p>}

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-muted">
        This page turns a long video or podcast into ready-to-post short clips.{' '}
        {hasClips
          ? 'Below are the clips our AI pulled from this episode — open any clip to see why it was picked and its ready-to-post caption, then approve the ones worth producing. Approved clips go to the Manager queue as tickets.'
          : 'Paste or auto-fetch the transcript, generate suggestions, then approve the best ones — approved clips go to the Manager queue as tickets.'}
      </p>

      {source.sourceUrl && (
        <a
          href={source.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 rounded-sm border border-border-default px-3 py-1.5 text-sm text-brand hover:bg-bg-subtle"
        >
          Watch original{source.platform ? ` on ${source.platform}` : ''} ↗
        </a>
      )}
    </section>
  );
}
