import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

// Self-hosted (latin subset, SIL OFL; licences in app/fonts) so builds never depend on Google Fonts being reachable.
const head = localFont({
  src: [
    { path: "./fonts/chakra-petch-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/chakra-petch-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/chakra-petch-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-head",
  display: "swap",
});
const sans = localFont({
  src: [
    { path: "./fonts/ibm-plex-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/ibm-plex-sans-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});
const mono = localFont({
  src: [
    { path: "./fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "HEARTH · Team Polaris", template: "%s · HEARTH" },
  description: "Fire-safety intelligence for crewed habitats, built on NASA microgravity combustion data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${head.variable} ${sans.variable} ${mono.variable}`}>
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
