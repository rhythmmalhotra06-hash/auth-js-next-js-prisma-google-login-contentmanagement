import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';

/** Back-to-Studio link shown atop every expanded sub-route. */
export function BackLink({ href = '/studio', label = 'Back to Studio' }: { href?: string; label?: string }) {
  return (
    <Link href={href} className="st-back">
      <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={14} /></span>
      {label}
    </Link>
  );
}
