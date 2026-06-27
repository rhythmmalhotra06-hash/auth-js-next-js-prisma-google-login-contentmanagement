import type { Metadata } from "next";
import { Inter } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Display face — Bricolage Grotesque (headings, KPI numerals, brand). Body stays Inter.
const bricolage = localFont({
  src: "./fonts/BricolageGrotesque.woff2",
  variable: "--font-display-face",
  weight: "600 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Content Studio",
  description: "Mindvalley Content Production & Management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${bricolage.variable} antialiased`}>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
