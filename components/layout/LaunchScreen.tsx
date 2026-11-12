"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PolarisMark } from "@/components/ui/Polaris";
import { LAUNCHED_KEY, shouldShowLanding } from "@/lib/landing";
import { useHearth } from "@/lib/store";

type Stage = "idle" | "jump" | "white" | "out";
const calm = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * The hyperspace landing screen ("Launch Project HEARTH"). It covers the real dashboard on a first visit to
 * the home page; LAUNCH speeds up the tunnel, flashes white and fades away to reveal the site behind it.
 * Decoration only: it shows no data. Mounted in AppShell, never inside a transformed parent.
 */
export function LaunchScreen() {
  const path = usePathname();
  const open = useHearth((s) => s.landing);
  const setLanding = useHearth((s) => s.setLanding);
  const [stage, setStage] = useState<Stage>("idle");
  const launchRef = useRef<HTMLButtonElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const decided = useRef(false);

  // the home page starts covered (no flash of the dashboard); on load, decide whether it should stay
  useEffect(() => {
    if (decided.current) return;
    decided.current = true;
    let launched = false;
    try {
      launched = window.sessionStorage.getItem(LAUNCHED_KEY) === "1";
    } catch {
      launched = false;
    }
    setLanding(shouldShowLanding({ path, search: window.location.search, launched }));
  }, [path, setLanding]);

  const close = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    try {
      window.sessionStorage.setItem(LAUNCHED_KEY, "1");
    } catch {
      /* storage blocked: it will simply show again next time */
    }
    setStage("idle");
    setLanding(false);
  }, [setLanding]);

  const launch = useCallback(() => {
    if (stage !== "idle") return;
    if (calm()) return close();
    setStage("jump");
    timers.current.push(setTimeout(() => setStage("white"), 1500));
    timers.current.push(setTimeout(() => setStage("out"), 2300));
    timers.current.push(setTimeout(close, 2900));
  }, [stage, close]);

  // while open: no page scroll, focus on LAUNCH, Esc skips
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    launchRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = before;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // undecided (first paint, also on the server): cover the home page only
  const show = open === null ? path === "/" : open;
  if (!show) return null;
  const fast = stage !== "idle";
  return (
    <div role="dialog" aria-modal="true" aria-label="Launch Project HEARTH" className={`launch-screen fixed inset-0 z-[70] overflow-hidden text-text ${fast ? "is-fast" : ""} ${stage === "out" ? "is-out" : ""}`}>
      <div className="ls-tunnel" aria-hidden />
      <div className="ls-zoom" aria-hidden />
      <div className="ls-zoom z2" aria-hidden />
      <div className="ls-zoom z3" aria-hidden />

      <button type="button" onClick={close} className="absolute right-4 top-4 z-[2] rounded-full border border-[#cfe6ff]/25 bg-bg/60 px-4 py-2 text-xs text-muted transition hover:text-text sm:right-6 sm:top-6">
        Skip intro
      </button>

      <main className="relative z-[1] flex h-full flex-col items-center justify-center gap-5 px-4 py-20 text-center sm:gap-7">
        <div className="ls-orb" aria-hidden />
        <p className="ls-rise font-mono text-[11px] tracking-[0.32em] text-muted sm:text-xs">NASA SPACE APPS CHALLENGE 2026</p>
        <h1 className="ls-glitch ls-rise m-0 font-head font-bold leading-[0.95] tracking-[0.08em]" data-text="PROJECT HEARTH">
          PROJECT HEARTH
        </h1>
        <p className="ls-rise m-0 max-w-[600px] text-[15px] leading-relaxed text-[#c3cbe0] sm:text-lg" style={{ animationDelay: "0.3s" }}>
          Jump from NASA&apos;s microgravity fire tests straight to fire-safety answers for crewed habitats, with VESTA as your crewmate.
        </p>
        <div className="ls-rise" style={{ animationDelay: "0.6s" }}>
          <button ref={launchRef} type="button" onClick={launch} disabled={fast} className="ls-cta min-h-[56px] rounded-full px-8 font-head text-base font-bold tracking-[0.08em] text-[#1a0d04] sm:text-lg">
            LAUNCH PROJECT HEARTH
          </button>
        </div>
      </main>

      <footer className="absolute inset-x-0 bottom-5 z-[1] flex items-center justify-center gap-2 text-[13px] text-muted">
        <PolarisMark size={14} />
        <span>
          by <b className="font-head tracking-[0.12em] text-text">TEAM POLARIS</b>
        </span>
      </footer>

      {(stage === "white" || stage === "out") && <div className="ls-white" aria-hidden />}
    </div>
  );
}
