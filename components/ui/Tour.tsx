"use client";
import { useCallback, useEffect, useState } from "react";
import { useHearth } from "@/lib/store";

const KEY = "hearth.tour.v1";

const STEPS = [
  { target: "tour-missions", title: "1 · Pick a mission", text: "Switch between the ISS, a Moon base, a pressurized lunar rover (demo scenario) and a spacesuit. Every page and VESTA follow the mission you pick." },
  { target: "tour-map", title: "2 · The habitat relevance map", text: "Every NASA test by pressure and oxygen. The gold line has the same O2 partial pressure as the ISS, and your mission is marked on the map. Click a point for its details." },
  { target: "tour-vesta", title: "3 · Ask VESTA", text: "VESTA answers with numbers from the NASA data or tested formulas, cites sources and adds a confidence tag. The Engine room picks the AI engine and shows the tokens it burns; Auto falls back to the next engine, down to Offline mode." },
];

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Skippable 3-step first-visit tour, remembered in localStorage. */
export function Tour() {
  const [step, setStep] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  // wait until the launch screen is gone, so the two never overlap
  const landing = useHearth((s) => s.landing);
  const presenting = useHearth((s) => s.presenting);

  useEffect(() => {
    if (landing !== false || presenting) return;
    let seen = false;
    try {
      seen = window.localStorage.getItem(KEY) === "done";
    } catch {
      seen = true; // storage blocked: don't nag every visit
    }
    if (!seen && window.location.pathname === "/") {
      const t = setTimeout(() => setStep(0), 900);
      return () => clearTimeout(t);
    }
  }, [landing, presenting]);

  const finish = useCallback(() => {
    setStep(null);
    try {
      window.localStorage.setItem(KEY, "done");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (step == null) return;
    const measure = () => {
      const el = document.getElementById(STEPS[step].target);
      if (!el) return setBox(null);
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      const r = el.getBoundingClientRect();
      setBox({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    const t = setTimeout(measure, 350);
    window.addEventListener("resize", measure);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && finish();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("keydown", onKey);
    };
  }, [step, finish]);

  if (step == null) return null;
  const s = STEPS[step];
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(340, vw - 32);
  let top = box ? box.top + box.height + 12 : vh / 2 - 80;
  if (top + 190 > vh) top = Math.max(16, (box?.top ?? vh / 2) - 200);
  const left = Math.min(Math.max(16, box ? box.left : vw / 2 - cardW / 2), vw - cardW - 16);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="HEARTH tour">
      <div className="absolute inset-0 bg-black/55" onClick={finish} aria-hidden />
      {box && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-ember transition-all duration-300"
          style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12, boxShadow: "0 0 0 9999px rgba(0,0,0,0.25)" }}
        />
      )}
      <div className="absolute animate-fadeUp rounded-xl border border-line bg-panel p-4 shadow-2xl" style={{ top, left, width: cardW }}>
        <p className="font-mono text-[10px] uppercase tracking-widest text-ember-soft">Welcome to HEARTH</p>
        <h2 className="mt-1 font-head text-lg font-bold">{s.title}</h2>
        <p className="mt-1 text-sm text-muted">{s.text}</p>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={finish} className="text-xs text-muted underline hover:text-text">
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-muted">
              {step + 1}/{STEPS.length}
            </span>
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="rounded-md border border-line px-3 py-1 text-xs">
                Back
              </button>
            )}
            <button type="button" autoFocus onClick={() => (step + 1 < STEPS.length ? setStep(step + 1) : finish())} className="rounded-md bg-ember px-3 py-1 text-xs font-semibold text-bg">
              {step + 1 < STEPS.length ? "Next" : "Done"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
