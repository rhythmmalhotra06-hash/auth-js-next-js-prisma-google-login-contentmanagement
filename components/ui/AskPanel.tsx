'use client';

import { useState, useRef, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';

const PROMPTS = ['Who has capacity?', 'What’s blocking us?', 'What’s at risk?', 'How are we performing?'];

type Msg = { role: 'u' | 'a'; text: string };

// light markdown: **bold**
function render(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**') ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>,
  );
}

export function AskPanel() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'a', text: 'I’m wired to the queue — ask about capacity, blockers, or what’s at risk. I only propose; you decide.' },
  ]);
  const [q, setQ] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight; }, [msgs, open]);

  async function ask(text: string) {
    if (!text.trim() || busy) return;
    setMsgs((m) => [...m, { role: 'u', text }]);
    setQ('');
    setBusy(true);
    try {
      const res = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: text }) });
      const data = await res.json();
      setMsgs((m) => [...m, { role: 'a', text: data.answer ?? 'No answer.' }]);
    } catch {
      setMsgs((m) => [...m, { role: 'a', text: 'Couldn’t reach the brain. Try again.' }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="ai-fab" onClick={() => setOpen(true)} aria-label="Ask the brain">
        <span className="spk" /> Ask the brain
      </button>
      <div className={`ai-panel${open ? ' open' : ''}`} role="dialog" aria-label="Ask the brain">
        <div className="ai-head">
          <span className="avatar" style={{ background: 'var(--brand)', color: '#fff' }}><Icon name="sparkle" size={14} /></span>
          <div style={{ flex: 1 }}><b style={{ fontSize: 13.5 }}>Ask the brain</b><div className="subtle" style={{ fontSize: 11.5 }}>Propose-only · computed from live data</div></div>
          <button className="icobtn" onClick={() => setOpen(false)} aria-label="Close"><Icon name="x" size={16} /></button>
        </div>
        <div className="ai-body" ref={bodyRef}>
          {msgs.map((m, i) => <div key={i} className={`msg ${m.role}`}>{render(m.text)}</div>)}
          {busy && <div className="msg a">…</div>}
        </div>
        <div className="ai-foot">
          <form className="ai-input" onSubmit={(e) => { e.preventDefault(); ask(q); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask anything about the queue…" autoComplete="off" />
            <button type="submit" aria-label="Send"><Icon name="arrow" size={16} /></button>
          </form>
          <div className="suggest">
            {PROMPTS.map((p) => <button key={p} onClick={() => ask(p)}>{p}</button>)}
          </div>
        </div>
      </div>
    </>
  );
}
