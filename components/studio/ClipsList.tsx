import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import type { MediaSource } from '@/lib/media/repository';

export interface ClipRow {
  id: string;
  name: string | null;
  viralityScore: number | null;
}

/**
 * Vishen's own content → suggested clips. Each media row links to the media detail; when
 * `clipsByMedia` is supplied, the top clip suggestions render nested beneath their source.
 */
export function ClipsList({
  media,
  clipsByMedia,
}: {
  media: MediaSource[];
  clipsByMedia?: Record<string, ClipRow[]>;
}) {
  return (
    <div>
      {media.map((m) => {
        const clips = clipsByMedia?.[m.id] ?? [];
        return (
          <div key={m.id}>
            <Link href={`/media/${m.id}`} className="st-cliprow">
              <span className="ic"><Icon name="play" size={18} /></span>
              <div className="body">
                <b>{m.title || m.sourceUrl || 'Untitled'}</b>
                <div className="sub">
                  {m.status ?? 'New'}
                  {m.clipCount ? ` · ${m.clipCount} clip ${m.clipCount === 1 ? 'idea' : 'ideas'}` : ''}
                  {m.guestShow ? ` · ${m.guestShow}` : ''}
                </div>
              </div>
              <Icon name="arrow" size={16} />
            </Link>
            {clips.length > 0 && (
              <ul className="st-clipnest">
                {clips.map((c) => (
                  <li key={c.id}>
                    <Link href={`/media/${m.id}`}>
                      <span className="dot">▸</span>
                      <span className="t">{c.name || 'Clip'}</span>
                      {c.viralityScore != null && <span className="v">{c.viralityScore}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
