'use client';

import { ThemeProvider as NextThemes } from 'next-themes';

// Wraps next-themes; sets the `dark` class on <html> which globals.css keys off.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      {children}
    </NextThemes>
  );
}
