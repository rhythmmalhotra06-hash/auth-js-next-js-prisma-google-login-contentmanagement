'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/cn';
import { inspectTools, tryTool, pullNow, disconnectHootsuite, type HootsuiteActionResult } from '@/app/admin/hootsuite/actions';

// Admin controls for the Hootsuite Perch integration: inspect what the connector exposes,
// try a single tool, run the nightly pull on demand, disconnect.
//
// The inspector exists because Perch's tool surface is undocumented and sits behind OAuth —
// this is where we learn the real tool names and payload shapes, in production, against the
// real grant.
export function HootsuiteControls({ connected }: { connected: boolean }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<HootsuiteActionResult | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [toolName, setToolName] = useState('');
  const [toolArgs, setToolArgs] = useState('{}');
  const [windowDays, setWindowDays] = useState('30');

  const run = (label: string, fn: () => Promise<HootsuiteActionResult>) => {
    setRunning(label);
    setResult(null);
    start(async () => {
      try {
        setResult(await fn());
      } catch (e) {
        setResult({ ok: false, message: e instanceof Error ? e.message : 'Request failed or timed out' });
      } finally {
        setRunning(null);
      }
    });
  };

  const busy = (label: string) => pending && running === label;

  if (!connected) {
    return (
      <div className="card pad">
        <p className="text-sm text-text-muted">
          Connect Hootsuite to enable scheduled pulls. You&apos;ll be sent to Hootsuite to sign in and approve
          read-only analytics access; the app stores the resulting token and refreshes it on its own.
        </p>
        {/* A real <a>, not next/link: this must be a full-page GET so the route's 302 to
            Hootsuite's consent screen is followed by the browser. A client-side navigation
            would try to render an API route as a page and the OAuth flow would never start. */}
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/hootsuite/connect"
          className="mt-3 inline-flex rounded-sm bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-bright">
          Connect Hootsuite
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card pad">
        <div className="text-2xs font-bold uppercase tracking-wide text-text-subtle">Actions</div>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <button type="button" disabled={pending} onClick={() => run('inspect', inspectTools)}
            className="rounded-sm border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-bg-subtle disabled:opacity-50">
            {busy('inspect') ? 'Inspecting…' : 'Inspect available tools'}
          </button>

          <label className="flex items-end gap-2">
            <span className="sr-only">Window in days</span>
            <input value={windowDays} onChange={(e) => setWindowDays(e.target.value)} inputMode="numeric"
              className="w-20 rounded-sm border border-border-strong bg-surface px-2.5 py-2 text-xs tabular-nums text-text" />
          </label>
          <button type="button" disabled={pending} onClick={() => run('pull', () => pullNow(Number(windowDays) || 30))}
            className="rounded-sm bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-bright disabled:opacity-50">
            {busy('pull') ? 'Pulling…' : 'Pull metrics now'}
          </button>

          <button type="button" disabled={pending} onClick={() => run('disconnect', disconnectHootsuite)}
            className="ml-auto rounded-sm border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-danger-content hover:bg-bg-subtle disabled:opacity-50">
            Disconnect
          </button>
        </div>
      </div>

      <div className="card pad">
        <div className="text-2xs font-bold uppercase tracking-wide text-text-subtle">Try a tool</div>
        <p className="mt-1.5 text-xs text-text-muted">
          Call one tool directly to see its real response shape. Use the names from &ldquo;Inspect&rdquo;.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <input value={toolName} onChange={(e) => setToolName(e.target.value)} placeholder="tool name"
            className="min-w-[200px] flex-1 rounded-sm border border-border-strong bg-surface px-2.5 py-2 text-xs text-text placeholder:text-text-subtle" />
          <input value={toolArgs} onChange={(e) => setToolArgs(e.target.value)} placeholder='{"startDate":"2026-08-01"}'
            className="min-w-[240px] flex-[2] rounded-sm border border-border-strong bg-surface px-2.5 py-2 font-mono text-xs text-text placeholder:text-text-subtle" />
          <button type="button" disabled={pending} onClick={() => run('try', () => tryTool(toolName, toolArgs))}
            className="rounded-sm border border-border-strong bg-surface px-3 py-2 text-xs font-semibold text-text hover:bg-bg-subtle disabled:opacity-50">
            {busy('try') ? 'Calling…' : 'Call'}
          </button>
        </div>
      </div>

      {result && (
        <div className={cn('card pad', result.ok ? 'border-success' : 'border-danger')}>
          <div className={cn('text-xs font-semibold', result.ok ? 'text-success-content' : 'text-danger-content')}>
            {result.message}
          </div>
          {result.detail && (
            <pre className="mt-2.5 max-h-96 overflow-auto whitespace-pre-wrap rounded-sm bg-bg-subtle p-3 font-mono text-2xs leading-relaxed text-text-muted">
              {result.detail}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
