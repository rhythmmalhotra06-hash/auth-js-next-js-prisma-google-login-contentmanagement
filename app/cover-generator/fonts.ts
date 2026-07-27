// Title fonts for the Cover Generator ONLY. Kept separate from app/fonts.ts
// (which is mirrored verbatim with the Vendor Portal and must not diverge).
//
// Sharp Grotesk is Mindvalley's brand display face and the default cover title
// font — self-hosted via next/font/local from the .otf files copied out of the
// standalone prototype (Clip Cover Generator/assets). Archivo and Playfair are
// the two alternate title options, self-loaded via next/font/google (no runtime
// CDN link — next inlines them at build, which keeps html-to-image capture from
// falling back to wrong metrics).
//
// Each loader exposes `.style.fontFamily`; the generated family names are
// referenced directly in the cover's inline styles (the artwork is pixel-exact,
// so its typography is inline, not tokenised).
import localFont from 'next/font/local';
import { Archivo, Playfair_Display } from 'next/font/google';

export const sharpGrotesk = localFont({
  src: './fonts/SharpGroteskSmBold.otf',
  weight: '700',
  display: 'swap',
});

export const sharpGroteskTight = localFont({
  src: './fonts/SharpGroteskSmBoldTight.otf',
  weight: '700',
  display: 'swap',
});

// The .otf is already an italic face, so we load it as a normal style and let
// the glyphs carry the slant (avoids a synthetic-oblique double-italic).
export const sharpGroteskItalic = localFont({
  src: './fonts/SharpGroteskSmBoldItalic.otf',
  weight: '700',
  display: 'swap',
});

export const archivo = Archivo({
  subsets: ['latin'],
  weight: ['700', '900'],
  display: 'swap',
});

export const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['700', '900'],
  display: 'swap',
});

/** Title-font options offered in the generator's font dropdown. */
export const TITLE_FONTS: { label: string; stack: string }[] = [
  { label: 'Sharp Grotesk · brand default', stack: sharpGrotesk.style.fontFamily },
  { label: 'Sharp Grotesk · tight (long titles)', stack: sharpGroteskTight.style.fontFamily },
  { label: 'Sharp Grotesk · italic', stack: sharpGroteskItalic.style.fontFamily },
  { label: 'Archivo · bold grotesque', stack: archivo.style.fontFamily },
  { label: 'Playfair Display · editorial serif', stack: playfair.style.fontFamily },
];

export const DEFAULT_TITLE_FONT = sharpGrotesk.style.fontFamily;
