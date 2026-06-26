'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchYouTube } from '@/app/content-engine/actions';

const PURPLE = '#572280';
const inputCls =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-[#572280] focus:ring-2 focus:ring-[#572280]/20';

type Tab = 'paste' | 'file' | 'youtube';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-neutral-900">{label}</label>
      {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      {children}
    </div>
  );
}

export function ClipEngineForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('paste');

  const [transcript, setTranscript] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [fileName, setFileName] = useState('');

  const [title, setTitle] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestAudience, setGuestAudience] = useState('');
  const [brandPillars, setBrandPillars] = useState('');
  const [webSearch, setWebSearch] = useState(true);

  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setTranscript(text);
    if (!title) setTitle(file.name.replace(/\.(txt|vtt|srt)$/i, ''));
  }

  async function onFetchYouTube() {
    setError(null);
    if (!sourceUrl.trim()) return setError('Paste a YouTube URL first.');
    setFetching(true);
    const res = await fetchYouTube(sourceUrl.trim());
    setFetching(false);
    if (res.ok && res.transcript) {
      setTranscript(res.transcript);
    } else {
      setError(res.error ?? 'Could not fetch the transcript.');
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (transcript.trim().length < 50) {
      setError(
        tab === 'youtube'
          ? 'No transcript yet — fetch the YouTube captions (or paste the transcript) first.'
          : 'Paste or upload a full transcript first.',
      );
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/content-engine/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          sourceType: tab,
          sourceUrl: tab === 'youtube' ? sourceUrl : undefined,
          title,
          guestName,
          guestAudience,
          brandPillars,
          webSearch,
        }),
      });
      const data = await res.json();
      if (data.strategyId) {
        router.push(`/content-engine/${data.strategyId}`);
        return;
      }
      setError(data.error ?? 'Generation failed.');
    } catch {
      setError('Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const tabBtn = (t: Tab, label: string) =>
    `rounded-md px-3 py-1.5 text-sm ${tab === t ? 'bg-[#572280] text-white' : 'text-neutral-600 hover:bg-neutral-100'}`;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-3">
        <div className="inline-flex gap-1 rounded-lg bg-neutral-100 p-1">
          <button type="button" className={tabBtn('paste', 'Paste')} onClick={() => setTab('paste')}>Paste</button>
          <button type="button" className={tabBtn('file', 'Upload')} onClick={() => setTab('file')}>Upload file</button>
          <button type="button" className={tabBtn('youtube', 'YouTube')} onClick={() => setTab('youtube')}>YouTube URL</button>
        </div>

        {tab === 'paste' && (
          <Field label="Transcript" hint="Paste the full podcast / interview / speech transcript.">
            <textarea className={inputCls} rows={10} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste transcript here…" />
          </Field>
        )}

        {tab === 'file' && (
          <Field label="Transcript file" hint="Upload a .txt, .vtt, or .srt file. Subtitle timestamps are stripped automatically.">
            <input type="file" accept=".txt,.vtt,.srt,text/plain" onChange={onFile} className="block w-full text-sm text-neutral-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#572280] file:px-3 file:py-1.5 file:text-sm file:text-white" />
            {fileName && <p className="text-xs text-neutral-500">Loaded: {fileName} ({transcript.length.toLocaleString()} chars)</p>}
          </Field>
        )}

        {tab === 'youtube' && (
          <Field label="YouTube URL" hint="Best-effort caption fetch. If it fails, paste the transcript instead.">
            <div className="flex gap-2">
              <input className={inputCls} value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…" />
              <button type="button" onClick={onFetchYouTube} disabled={fetching} className="shrink-0 rounded-lg border border-[#572280] px-4 py-2 text-sm font-medium text-[#572280] disabled:opacity-60">
                {fetching ? 'Fetching…' : 'Fetch'}
              </button>
            </div>
            {transcript && <p className="text-xs text-green-700">Fetched {transcript.length.toLocaleString()} chars. Review below or generate.</p>}
            {transcript && <textarea className={`${inputCls} mt-2`} rows={6} value={transcript} onChange={(e) => setTranscript(e.target.value)} />}
          </Field>
        )}
      </div>

      <div className="grid gap-5 border-t border-neutral-200 pt-6 sm:grid-cols-2">
        <Field label="Episode / working title"><input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kiara King × Vishen" /></Field>
        <Field label="Guest"><input className={inputCls} value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="e.g. Kiara King" /></Field>
        <Field label="Guest audience / reach" hint="Optional — helps prioritize collab-friendly clips"><input className={inputCls} value={guestAudience} onChange={(e) => setGuestAudience(e.target.value)} placeholder="e.g. 200k+ on IG" /></Field>
        <Field label="Brand pillars" hint="Leave blank for Vishen's defaults"><input className={inputCls} value={brandPillars} onChange={(e) => setBrandPillars(e.target.value)} placeholder="manifestation, growth, consciousness…" /></Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-700">
        <input type="checkbox" checked={webSearch} onChange={(e) => setWebSearch(e.target.checked)} className="h-4 w-4 accent-[#572280]" />
        Use web search to ground SEO keywords, trends & posting times (slower, more current)
      </label>

      {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex items-center justify-end gap-3 border-t border-neutral-200 pt-6">
        <button type="submit" disabled={submitting} className="rounded-lg px-5 py-2.5 text-sm font-medium text-white disabled:opacity-60" style={{ backgroundColor: PURPLE }}>
          {submitting ? 'Generating… (this can take a minute)' : 'Generate strategy'}
        </button>
      </div>
    </form>
  );
}
