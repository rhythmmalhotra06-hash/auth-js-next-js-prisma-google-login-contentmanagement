import { Icon, type IconName } from './Icon';

// Narrative "what's working" card. Ported from context/mockups/demo.html (.insight / .insight.warn).
// tone is semantic (good = green / warn = gold), kept distinct from the brand accent.
export function InsightCard({ tone = 'good', title, detail, icon, i = 0 }: {
  tone?: 'good' | 'warn'; title: string; detail: string; icon?: IconName; i?: number;
}) {
  return (
    <div className={tone === 'warn' ? 'insight warn' : 'insight'} style={{ ['--i' as string]: i }}>
      <div className="ico"><Icon name={icon ?? (tone === 'warn' ? 'bolt' : 'chart')} size={17} /></div>
      <div className="min-w-0">
        <b className="text-sm">{title}</b>
        <div className="muted text-xs mt-0.5 leading-snug">{detail}</div>
      </div>
    </div>
  );
}
