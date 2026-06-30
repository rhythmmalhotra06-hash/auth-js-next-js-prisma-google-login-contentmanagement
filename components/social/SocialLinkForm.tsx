'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const inputCls =
  'w-full rounded-sm border border-border-default px-3 py-2 text-sm text-text outline-none focus-visible:border-brand focus-visible:shadow-[var(--mv-shadow-focus)]';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-text">{label}</label>
      {hint && <p className="text-xs text-text-muted">{hint}</p>}
      {children}
    </div>
  );
}

export function SocialLinkForm() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [transcript, setTranscript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/social/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title, transcript }),
      });
      const data = (await res.json()) as { ok: boolean; count?: number; error?: string };
      if (data.ok) {
        router.push('/social');
        router.refresh();
      } else {
        setError(data.error ?? 'Generation failed.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-md bg-surface p-6 shadow-sm ring-1 ring-border-default">
      <Field label="Media URL" hint="Paste a YouTube link — we transcribe it and draft ranked, platform-ready clip suggestions.">
        <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" autoFocus />
      </Field>
      <Field label="Title" hint="Optional — context for the clip prompt.">
        <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Talk / interview title" />
      </Field>
      <Field label="Transcript" hint="Optional — paste a transcript if the link can't be auto-fetched.">
        <textarea className={`${inputCls} min-h-24`} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste transcript text (optional)…" />
      </Field>

      {error && <div className="rounded-sm bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div>}

      <div className="flex justify-end gap-2 border-t border-border-default pt-4">
        <button type="submit" disabled={submitting || !url.trim()} className="rounded-sm px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand-bright disabled:opacity-60">
          {submitting ? 'Generating…' : 'Generate clip suggestions'}
        </button>
      </div>
    </form>
  );
}
