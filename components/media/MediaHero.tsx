// Page header for a media source: what this episode is + what the page does.
// Server component — pure presentation from the already-fetched MediaSource.
import type { MediaSource } from '@/lib/media/repository';
import { Badge, type Tone } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';

const STATUS_TONE: Record<string, Tone> = {
  New: 'neutral',
  Transcribing: 'info',
  'Clips Suggested': 'brand',
  Error: 'danger',
};

export function MediaHero({ source }: { source: MediaSource }) {
  const hasClips = source.clipCount > 0;
  const status = source.status ?? 'New';
  return (
    <section className="card pad">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
        {source.platform && <Badge tone="neutral" dot={false}>{source.platform}</Badge>}
        {source.audience && <Badge tone="neutral" dot={false}>{source.audience} audience</Badge>}
        {source.submittedVia && <span className="text-xs text-text-subtle">via {source.submittedVia}</span>}
      </div>

      <h1 className="mt-3 text-xl leading-snug">{source.title || source.sourceUrl || 'Untitled source'}</h1>
      {source.guestShow && <p className="mt-1 text-sm text-text-muted">{source.guestShow}</p>}

      <p className="mt-4 max-w-2xl text-sm leading-relaxed text-text-muted">
        This page turns a long video or podcast into ready-to-post short clips.{' '}
        {hasClips
          ? 'Below are the clips our AI pulled from this episode — open any clip to see why it was picked and its ready-to-post caption, then approve the ones worth producing. Approved clips go to the Manager queue as tickets.'
          : 'Paste or auto-fetch the transcript, generate suggestions, then approve the best ones — approved clips go to the Manager queue as tickets.'}
      </p>

      {source.sourceUrl && (
        <a href={source.sourceUrl} target="_blank" rel="noreferrer" className="btn sm mt-4 no-underline">
          <Icon name="ext" size={15} /> Watch original{source.platform ? ` on ${source.platform}` : ''}
        </a>
      )}
    </section>
  );
}
