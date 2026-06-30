'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitMediaLink } from '@/app/media/actions';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Field';

// Content types — must match the "Select" options in Vishen's Major Videos base exactly,
// since the write-back sets that field.
const TYPES = [
  '🎙️Podcast by Vishen',
  '🎙️Podcast Featuring Vishen',
  '📺 Youtube Long',
  '📯 Masterclass',
  '🎤 Vishen on Stage',
  '🪑 Vishen interviews Guest on Stage',
];

/**
 * Studio "add a media source" entry. Creates a 📺 Media Source AND writes a row back to
 * Vishen's Major Videos base (writeBack), so his table stays the source of truth and the
 * hourly sync treats it as already-mirrored.
 */
export function AddVishenMedia() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = () =>
    start(async () => {
      setErr(null);
      if (!url.trim()) { setErr('Paste a media link first'); return; }
      const res = await submitMediaLink({
        url: url.trim(),
        title: title.trim() || undefined,
        type: type || undefined,
        writeBack: true,
      });
      if (res.ok) {
        setUrl(''); setTitle(''); setType(''); setDone(true);
        router.refresh();
      } else setErr(res.error ?? 'Failed to add');
    });

  return (
    <div className="rounded-md border border-border-default bg-surface p-4 shadow-[var(--mv-shadow-light)]">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-brand-soft text-brand-content">＋</span>
        <div>
          <h3 className="text-sm font-semibold text-text">Add a media source</h3>
          <p className="text-xs text-text-muted">Adds it to your pipeline and your Major Videos base. Paste a YouTube, Dropbox, or other link.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={url} onChange={(e) => { setUrl(e.target.value); setDone(false); }} placeholder="https://…" className="sm:flex-[2]" />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="sm:flex-1" />
        <Select value={type} onChange={(e) => setType(e.target.value)} className="sm:flex-1">
          <option value="">Type (optional)</option>
          {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
        <Button disabled={pending} onClick={submit}>{pending ? 'Adding…' : 'Add'}</Button>
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
      {done && !err && <p className="mt-2 text-xs text-success">Added to your pipeline.</p>}
    </div>
  );
}
