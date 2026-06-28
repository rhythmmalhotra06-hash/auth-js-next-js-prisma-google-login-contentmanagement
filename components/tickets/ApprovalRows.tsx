import { Badge, type Tone } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import type { ApprovalRow } from '@/lib/tickets/data';

// Approval state is a free-text Airtable enum; normalize to a label + semantic tone + cleared flag.
function classify(state: string): { label: string; tone: Tone; cleared: boolean } {
  const s = (state ?? '').toLowerCase();
  if (s.includes('approve')) return { label: 'Approved', tone: 'success', cleared: true };
  if (s.includes('change') || s.includes('revision') || s.includes('reject')) return { label: state || 'Changes requested', tone: 'warning', cleared: false };
  return { label: state || 'Pending', tone: 'neutral', cleared: false };
}

// Decision-lock summary + per-reviewer rows. Ported from context/mockups/demo.html (.lockbar / .appr).
export function ApprovalRows({ approvals }: { approvals: ApprovalRow[] }) {
  if (!approvals.length) {
    return (
      <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
        No approvals on this ticket yet. Reviewers and decision locks appear here once an approval is requested.
      </p>
    );
  }

  const pending = approvals.filter((a) => !classify(a.state).cleared);

  return (
    <>
      {pending.length === 0 ? (
        <div className="lockbar open"><Icon name="unlock" size={16} /> All approvals cleared — ready to publish.</div>
      ) : (
        <div className="lockbar">
          <Icon name="lock" size={16} />
          <span>
            Publishing is locked until {pending.map((a) => a.approver ?? 'a reviewer').join(' & ')} {pending.length > 1 ? 'approve' : 'approves'}.
            <span className="future-tag" style={{ marginLeft: 6 }}>Decision lock</span>
          </span>
        </div>
      )}
      {approvals.map((a) => {
        const c = classify(a.state);
        return (
          <div key={a.id} className={c.tone === 'warning' ? 'appr locked' : 'appr'}>
            <div className="top">
              <b style={{ fontSize: 13 }}>{a.approver ?? 'Reviewer'}</b>
              <Badge tone={c.tone}>{c.label}</Badge>
            </div>
            {a.feedback && <div className="muted" style={{ fontSize: 12.5, marginTop: 6, lineHeight: 1.45 }}>{a.feedback}</div>}
          </div>
        );
      })}
    </>
  );
}
