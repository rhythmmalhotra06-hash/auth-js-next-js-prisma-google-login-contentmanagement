'use client';

import { useState } from 'react';
import { cleanBrief } from '@/lib/tickets/brief';

// Presentation for briefs: linkify URLs, keep line breaks, collapse long ones.
// Markup is normalized at the data layer (cleanBrief); we run it again defensively
// (idempotent) so this component is safe for any raw input.
const URL_RE = /(https?:\/\/[^\s)|\]<>]+)/g;

function linkify(line: string, keyBase: string) {
  return line.split(URL_RE).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={`${keyBase}-${i}`} href={part} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
        {part.length > 60 ? part.slice(0, 57) + '…' : part}
      </a>
    ) : (
      <span key={`${keyBase}-${i}`}>{part}</span>
    ),
  );
}

export function BriefText({ text }: { text: string | null }) {
  const [open, setOpen] = useState(false);
  const cleaned = cleanBrief(text);
  if (!cleaned) return <span className="subtle">—</span>;
  const long = cleaned.length > 700;
  const lines = cleaned.split(/\r?\n/);

  return (
    <div>
      <div
        style={{
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          maxHeight: long && !open ? 220 : undefined,
          overflow: long && !open ? 'hidden' : undefined,
          WebkitMaskImage: long && !open ? 'linear-gradient(180deg,#000 70%,transparent)' : undefined,
          maskImage: long && !open ? 'linear-gradient(180deg,#000 70%,transparent)' : undefined,
          lineHeight: 1.55,
        }}
      >
        {lines.map((ln, i) => (
          <span key={i}>{linkify(ln, String(i))}{i < lines.length - 1 ? '\n' : ''}</span>
        ))}
      </div>
      {long && (
        <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setOpen((v) => !v)}>
          {open ? 'Show less' : 'Show full brief'}
        </button>
      )}
    </div>
  );
}
