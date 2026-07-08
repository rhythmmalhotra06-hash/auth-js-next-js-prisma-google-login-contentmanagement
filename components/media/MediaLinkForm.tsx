'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitMediaLink } from '@/app/media/actions';
import { Field, Input, Select } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';

export function MediaLinkForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [title, setTitle] = useState('');
  const [guestShow, setGuestShow] = useState('');
  const [audience, setAudience] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await submitMediaLink({ url, downloadUrl, title, guestShow, audience });
    setSubmitting(false);
    if (res.ok && res.id) {
      router.push(`/media/${res.id}`);
    } else {
      setError(res.error ?? 'Failed to submit.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="card pad space-y-4">
      <Field label="YouTube URL" hint="v1 supports YouTube links only.">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus />
      </Field>
      <Field label="Title" hint="Optional — auto-filled from YouTube when we fetch the transcript.">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode / interview title" />
      </Field>
      <Field label="Download link" hint="Optional — Dropbox/Drive link editors download to cut. Carried onto every ticket made from this media.">
        <Input value={downloadUrl} onChange={(e) => setDownloadUrl(e.target.value)} placeholder="https://www.dropbox.com/…" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guest / Show" hint="Optional context for the clip prompt.">
          <Input value={guestShow} onChange={(e) => setGuestShow(e.target.value)} placeholder="e.g. The Diary of a CEO" />
        </Field>
        <Field label="Audience">
          <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="">—</option>
            <option value="Cold">Cold</option>
            <option value="Warm">Warm</option>
          </Select>
        </Field>
      </div>

      {error && <div className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger-content">{error}</div>}

      <div className="flex justify-end gap-2 border-t border-border-default pt-4">
        <Button type="submit" disabled={submitting}>{submitting ? 'Adding…' : 'Add to inbox'}</Button>
      </div>
    </form>
  );
}
