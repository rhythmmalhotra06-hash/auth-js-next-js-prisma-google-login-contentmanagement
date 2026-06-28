'use client';

import { useId } from 'react';

// SVG sparkline — area fill + faint midline grid + emphasized endpoint.
// Ported from context/mockups/demo.html `sparkline()`; styled by .spark/.sa/.sl/.sc in globals.css.
export function Sparkline({ series, w = 260, h = 46, color = 'var(--green)' }: {
  series: number[]; w?: number; h?: number; color?: string;
}) {
  const gid = useId();
  if (!series || series.length < 2) return null;

  const mn = Math.min(...series);
  const mx = Math.max(...series);
  const sp = mx - mn || 1;
  const pts = series.map((v, i) => [(i / (series.length - 1)) * w, h - ((v - mn) / sp) * (h - 6) - 3] as const);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} L${w} ${h} L0 ${h} Z`;
  const last = pts[pts.length - 1];

  return (
    <svg className="spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1={(h * 0.5).toFixed(1)} x2={w} y2={(h * 0.5).toFixed(1)} stroke="var(--border)" strokeWidth="1" strokeDasharray="2 4" />
      <path className="sa" d={area} fill={`url(#${gid})`} />
      <path className="sl" d={line} pathLength={1} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="sc" cx={last[0].toFixed(1)} cy={last[1].toFixed(1)} r="2.8" fill={color} />
    </svg>
  );
}
