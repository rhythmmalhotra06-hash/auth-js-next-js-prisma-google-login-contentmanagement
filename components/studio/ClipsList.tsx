import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type { MediaSource } from '@/lib/media/repository';

/** Vishen's own content → suggested clips. Rows link to the media detail. */
export function ClipsList({ media }: { media: MediaSource[] }) {
  return (
    <div>
      {media.map((m) => (
        <Link key={m.id} href={`/media/${m.id}`} className="st-cliprow">
          <span className="ic"><Icon name="play" size={18} /></span>
          <div className="body">
            <b>{m.title || m.sourceUrl || 'Untitled'}</b>
            <div className="sub">{m.status ?? 'New'}{m.clipCount ? ` · ${m.clipCount} clip ${m.clipCount === 1 ? 'idea' : 'ideas'}` : ''}</div>
          </div>
          <Icon name="arrow" size={16} />
        </Link>
      ))}
    </div>
  );
}
