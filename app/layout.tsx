import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const head = Chakra_Petch({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-head" });
const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: { default: "HEARTH · Team Polaris", template: "%s · HEARTH" },
  description: "Fire-safety intelligence for crewed habitats, built on NASA microgravity combustion data.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${head.variable} ${sans.variable} ${mono.variable}`}>
      <body className="antialiased">
        {/* without JavaScript the launch button cannot work, so never cover the page */}
        <noscript>
          <style>{".launch-screen{display:none!important}"}</style>
        </noscript>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
