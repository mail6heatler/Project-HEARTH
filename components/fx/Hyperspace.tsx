"use client";
import { useEffect, useState } from "react";
import { useHearth } from "@/lib/store";

const WARP_MS = 2000;

/** The /warp easter egg: two seconds of hyperspace streaks over the page. Decoration only; skipped under reduced motion. */
export function Hyperspace() {
  const warpAt = useHearth((s) => s.warpAt);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!warpAt || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), WARP_MS);
    return () => clearTimeout(t);
  }, [warpAt]);
  if (!on) return null;
  return (
    <div key={warpAt} className="hyperspace pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      <div className="hyperspace-streaks" />
      <div className="hyperspace-flash" />
    </div>
  );
}
