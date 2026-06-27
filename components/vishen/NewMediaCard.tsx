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
  const [transcript, setTranscript] = useState('');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const submit = () =>
    start(async () => {
      setErr(null);
      if (!url.trim()) { setErr('Paste a media link first'); return; }
      const res = await submitMediaLink({
        url: url.trim(),
        title: title.trim(),
        transcript: transcript.trim() || undefined,
      });
      if (res.ok && res.id) router.push(`/media/${res.id}?autostart=1`);
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
      <label className="mt-3 block text-[12.5px] font-medium text-text">
        Transcript <span className="font-normal text-text-muted">— recommended. Paste it for instant, reliable clips; leave blank and we’ll try to auto-fetch.</span>
      </label>
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        rows={5}
        placeholder="Paste the full transcript here. If provided, we skip the YouTube fetch entirely."
        className="mt-1.5 w-full rounded-[9px] border border-border-default bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
      />
      {err && <p className="mt-2 text-xs text-danger">{err}</p>}
    </div>
  );
}
