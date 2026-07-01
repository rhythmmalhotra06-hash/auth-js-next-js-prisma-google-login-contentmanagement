// ─────────────────────────────────────────────────────────────────────────
// MV shared type foundation — CANONICAL SOURCE: ContentManagement/app/fonts.ts
// Mirrored verbatim into the Vendor Portal
// (auth-js-next-js-prisma-google-login-vendorportal/app/fonts.ts).
// Keep the two identical — do not diverge.
//
// One typeface for both portals: Plus Jakarta Sans, self-hosted via next/font
// (no runtime Google Fonts request). Exposed as the --font-jakarta CSS variable,
// applied to <body> by each app's root layout via `jakarta.variable`.
// ─────────────────────────────────────────────────────────────────────────
import { Plus_Jakarta_Sans } from "next/font/google";

export const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
