'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { submitMediaLink } from '@/app/media/actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Field';

// Inline "add media → generate clips" entry, part of the Clips section. Paste a
// source link (YouTube first); on submit it creates the Media Source and opens it
// where clips are generated.
export function NewMediaCard() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const submit = () =>
    start(async () => {
      setErr(null);
      if (!url.trim()) { setErr('Paste a media link first'); return; }
      const res = await submitMediaLink({ url: url.trim(), title: title.trim() });
      if (res.ok && res.id) router.push(`/media/${res.id}`);
      else setErr(res.error ?? 'Failed to submit');
    });

  return (
    <div className="rounded-[12px] border border-border-default bg-surface p-4 shadow-[var(--mv-shadow-light)]">
      <div className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-brand-soft text-brand-content">＋</span>
        <div>
          <h3 className="text-sm font-semibold text-text">Add media to generate clips</h3>
          <p className="text-[12.5px] text-text-muted">Paste a YouTube / source link — we transcribe it and propose clips.</p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" className="sm:flex-[2]" />
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (optional)" className="sm:flex-1" />
        <Button disabled={pending} onClick={submit}>{pending ? 'Submitting…' : 'Generate clips'}</Button>
      </div>
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
