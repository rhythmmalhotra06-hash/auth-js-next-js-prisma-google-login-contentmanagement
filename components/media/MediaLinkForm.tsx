'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitMediaLink } from '@/app/media/actions';

const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#572280] focus:ring-2 focus:ring-[#572280]/20';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-neutral-900">{label}</label>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      {children}
    </div>
  );
}

export function MediaLinkForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [guestShow, setGuestShow] = useState('');
  const [audience, setAudience] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await submitMediaLink({ url, title, guestShow, audience });
    setSubmitting(false);
    if (res.ok && res.id) {
      router.push(`/media/${res.id}`);
    } else {
      setError(res.error ?? 'Failed to submit.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-neutral-200">
      <Field label="YouTube URL" hint="v1 supports YouTube links only.">
        <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus />
      </Field>
      <Field label="Title" hint="Optional — auto-filled from YouTube when we fetch the transcript.">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Episode / interview title" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Guest / Show" hint="Optional context for the clip prompt.">
          <input className={inputCls} value={guestShow} onChange={(e) => setGuestShow(e.target.value)} placeholder="e.g. The Diary of a CEO" />
        </Field>
        <Field label="Audience">
          <select className={inputCls} value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="">—</option>
            <option value="Cold">Cold</option>
            <option value="Warm">Warm</option>
          </select>
        </Field>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <div className="flex justify-end gap-2 border-t border-neutral-200 pt-4">
        <button type="submit" disabled={submitting} className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: '#572280' }}>
          {submitting ? 'Adding…' : 'Add to inbox'}
        </button>
      </div>
    </form>
  );
}
