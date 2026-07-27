import { cn } from '@/lib/cn';

// Brand-accented range input. `accent-color` maps to the brand token so the
// thumb/track pick up the theme in both light and dark.
export function Slider({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="range"
      className={cn(
        'w-full cursor-pointer accent-brand focus-visible:outline-none',
        'focus-visible:[&::-webkit-slider-thumb]:shadow-[var(--mv-shadow-focus)]',
        className,
      )}
      {...props}
    />
  );
}
