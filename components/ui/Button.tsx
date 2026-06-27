import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-[8px] transition-colors duration-[120ms] ' +
  'disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:shadow-[var(--mv-shadow-focus)]';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-bright',
  secondary: 'bg-surface text-text border border-border-default hover:bg-bg-subtle',
  ghost: 'text-text hover:bg-bg-subtle',
  danger: 'bg-danger text-white hover:opacity-90',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonProps) {
  return <button className={cn(base, VARIANTS[variant], SIZES[size], className)} {...props} />;
}
