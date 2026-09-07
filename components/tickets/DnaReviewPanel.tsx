'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { rerunDnaReview, reactToDnaFinding, dismissDnaFinding, runVisualDnaReviewAction } from '@/app/tickets/[id]/actions';
import { Badge, type Tone } from '@/components/ui/Badge';

export interface DnaFindingView {
  id: string;
  dimension: string;
  note: string;
  severity: 'info' | 'suggestion' | 'flag';
  evidence: string | null;
  timestampMs: number | null;
  reaction: string | null;
  reactionNote: string | null;
}

export interface DnaReviewView {
  id: string;
  assetTypeId: string | null;
  summary: string | null;
  usedFrames: boolean;
  frameCount: number | null;
  createdAt: string;
  findings: DnaFindingView[];
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const mm = Math.floor(totalSec / 60);
  const ss = (totalSec % 60).toString().padStart(2, '0');
  return `${mm}:${ss}`;
}

function severityTone(s: DnaFindingView['severity']): Tone {
  if (s === 'flag') return 'warning';
  if (s === 'suggestion') return 'neutral';
  return 'success';
}

function FindingRow({ ticketId, f, assetTypeId }: { ticketId: string; f: DnaFindingView; assetTypeId: string | null }) {
  const [pending, start] = useTransition();
  const [dismissing, setDismissing] = useState(false);
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const cleared = f.reaction === 'dismissed';
  const isFlag = f.severity === 'flag';

  function react(reaction: 'helpful' | 'not_helpful') {
    start(async () => {
      await reactToDnaFinding(f.id, reaction, '', assetTypeId, null);
      router.refresh();
    });
  }

  function submitDismiss() {
    setErr(null);
    start(async () => {
      const res = await dismissDnaFinding(ticketId, f.id, note);
      if (res.ok) {
        setDismissing(false);
        setNote('');
        router.refresh();
      } else {
        setErr(res.error ?? 'Failed to dismiss');
      }
    });
  }

  return (
    <div className="card pad mb-2.5" style={{ opacity: pending ? 0.7 : 1 }}>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <Badge tone={severityTone(f.severity)}>{f.severity}</Badge>
        <span className="subtle text-xs">
          {f.dimension.replace(/_/g, ' ')}
          {f.timestampMs != null && <> · {formatTimestamp(f.timestampMs)}</>}
        </span>
      </div>
      <p style={{ fontSize: 13, margin: '4px 0' }}>{f.note}</p>
      {f.evidence && <p className="muted" style={{ fontSize: 12, margin: '2px 0 6px', fontStyle: 'italic' }}>&ldquo;{f.evidence}&rdquo;</p>}

      {isFlag && cleared && (
        <p className="text-xs" style={{ color: 'var(--success-content)' }}>
          Dismissed{f.reactionNote ? ` — ${f.reactionNote}` : ''}
        </p>
      )}

      <div className="flex items-center gap-2" style={{ marginTop: 6 }}>
        <button className="btn ghost sm" disabled={pending} onClick={() => react('helpful')}>👍</button>
        <button className="btn ghost sm" disabled={pending} onClick={() => react('not_helpful')}>👎</button>
        {isFlag && !cleared && !dismissing && (
          <button className="btn ghost sm" disabled={pending} onClick={() => setDismissing(true)}>Dismiss…</button>
        )}
      </div>

      {dismissing && (
        <div style={{ marginTop: 8 }}>
          <textarea
            className="w-full rounded-sm border border-border-default px-2 py-1.5 text-sm"
            rows={2}
            placeholder="Why is this OK to dismiss? (required)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex items-center gap-2" style={{ marginTop: 4 }}>
            <button className="btn sm" disabled={pending || !note.trim()} onClick={submitDismiss}>Confirm dismiss</button>
            <button className="btn ghost sm" disabled={pending} onClick={() => { setDismissing(false); setErr(null); }}>Cancel</button>
          </div>
          {err && <p className="text-xs" style={{ color: 'var(--danger-content)', marginTop: 4 }}>{err}</p>}
        </div>
      )}
    </div>
  );
}

type VisualState = 'available' | 'confirming' | 'running' | 'failed';

export function DnaReviewPanel({ ticketId, review }: { ticketId: string; review: DnaReviewView | null }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [visualState, setVisualState] = useState<VisualState>('available');
  const [visualErr, setVisualErr] = useState<string | null>(null);
  const router = useRouter();

  function rerun() {
    setErr(null);
    start(async () => {
      const res = await rerunDnaReview(ticketId);
      if (!res.ok) setErr(res.error ?? 'Review failed');
      router.refresh();
    });
  }

  function runVisual() {
    setVisualErr(null);
    setVisualState('running');
    start(async () => {
      const res = await runVisualDnaReviewAction(ticketId);
      if (res.ok) {
        setVisualState('available');
        router.refresh();
      } else {
        setVisualState('failed');
        setVisualErr(res.error ?? 'Visual review failed');
      }
    });
  }

  const unmetFlags = review?.findings.filter((f) => f.severity === 'flag' && f.reaction == null).length ?? 0;

  return (
    <div>
      <p className="subtle text-xs" style={{ marginBottom: 8 }}>
        AI first pass — still needs human approval. {review?.usedFrames === false && 'Text/brief only — no video access yet.'}
      </p>

      {!review && (
        <p className="muted" style={{ fontSize: 12.5, margin: '0 0 8px' }}>
          No DNA review yet. It runs automatically when this ticket enters Review, or trigger one now.
        </p>
      )}

      {review && (
        <>
          {review.summary && <p style={{ fontSize: 13, marginBottom: 8 }}>{review.summary}</p>}
          {review.usedFrames && (
            <p className="text-xs" style={{ color: 'var(--success-content)', marginBottom: 8 }}>
              ✓ Visual review included ({review.frameCount ?? '?'} frames analyzed)
            </p>
          )}
          {unmetFlags > 0 && (
            <div className="lockbar" style={{ marginBottom: 10 }}>
              {unmetFlags} unresolved flag{unmetFlags > 1 ? 's' : ''} — blocks moving this ticket to Approved until dismissed.
            </div>
          )}
          {review.findings.length === 0 && <p className="muted" style={{ fontSize: 12.5 }}>No findings — brief and deliverables look complete.</p>}
          {review.findings.map((f) => (
            <FindingRow key={f.id} ticketId={ticketId} f={f} assetTypeId={review.assetTypeId} />
          ))}
        </>
      )}

      <div className="flex items-center gap-2" style={{ marginTop: 4, flexWrap: 'wrap' }}>
        <button className="btn ghost sm" disabled={pending} onClick={rerun}>
          {pending && visualState !== 'running' ? 'Running…' : review ? 'Re-run DNA review' : 'Run DNA review'}
        </button>

        {visualState === 'available' && (
          <button className="btn ghost sm" disabled={pending} onClick={() => setVisualState('confirming')}>
            👁️ Review with visuals
          </button>
        )}
        {visualState === 'confirming' && (
          <span className="flex items-center gap-2">
            <span className="subtle text-xs">Analyzes real frames from the deliverable. Costs ~$0.30 in Anthropic usage, takes 30-90s.</span>
            <button className="btn sm" disabled={pending} onClick={runVisual}>Confirm</button>
            <button className="btn ghost sm" disabled={pending} onClick={() => setVisualState('available')}>Cancel</button>
          </span>
        )}
        {visualState === 'running' && <span className="text-xs text-text-subtle">Watching the recording…</span>}
        {visualState === 'failed' && (
          <button className="btn ghost sm" disabled={pending} onClick={() => setVisualState('confirming')}>Retry visual review</button>
        )}
      </div>
      {err && <p className="text-xs" style={{ color: 'var(--danger-content)', marginTop: 6 }}>{err}</p>}
      {visualErr && <p className="text-xs" style={{ color: 'var(--danger-content)', marginTop: 6 }}>{visualErr}</p>}
    </div>
  );
}
