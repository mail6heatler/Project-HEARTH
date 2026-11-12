"use client";
import { PolarisMark } from "@/components/ui/Polaris";
import { useHearth } from "@/lib/store";

export function SiteFooter() {
  const setLanding = useHearth((s) => s.setLanding);
  return (
    <footer className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-4 text-xs text-muted">
      <span className="flex items-center gap-1.5 font-head font-semibold tracking-wider text-star">
        <PolarisMark size={13} />
        Built by Team Polaris
      </span>
      <span>NASA Space Apps Challenge 2026</span>
      <a href="/blueprint.html" target="_blank" rel="noopener noreferrer" className="inline-block py-1 underline underline-offset-2 transition hover:text-ember-soft">
        How HEARTH works
        <span className="sr-only"> (opens in a new tab)</span>
      </a>
      <button type="button" onClick={() => setLanding(true)} className="inline-block py-1 underline underline-offset-2 transition hover:text-ember-soft">
        Replay launch screen
      </button>
      <span className="basis-full sm:basis-auto">Data: NASA Physical Sciences Informatics. Independent student project, not endorsed by NASA.</span>
    </footer>
  );
}
