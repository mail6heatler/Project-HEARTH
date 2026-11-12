"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconClose, IconSparkle } from "@/components/ui/Icons";
import { ACHIEVEMENTS } from "@/lib/achievements";
import { SKINS, useHearth, type Skin } from "@/lib/store";
import type { Confidence } from "@/lib/types";
import type { SpaceFact } from "@/lib/vesta/facts";

/** Three planets circling a small sun: VESTA's "working" indicator. Decoration only. */
export function OrbitLoader() {
  return (
    <span className="vesta-orbits" aria-hidden>
      <span className="sun" />
      <span className="o o1">
        <i />
      </span>
      <span className="o o2">
        <i />
      </span>
      <span className="o o3">
        <i />
      </span>
    </span>
  );
}

const SPARKS = 10;

/** Plays once when an answer's tag appears: a star burst for supported, a soft red pulse for no data. */
export function ConfidenceFx({ value, children }: { value: Confidence; children: React.ReactNode }) {
  return (
    <span className="vesta-stamp relative inline-flex">
      {children}
      {value === "supported" &&
        Array.from({ length: SPARKS }, (_, i) => {
          const a = (i / SPARKS) * Math.PI * 2;
          const d = 46 + (i % 3) * 12;
          return <span key={i} className="vesta-spark" aria-hidden style={{ "--dx": `${Math.round(Math.cos(a) * d)}px`, "--dy": `${Math.round(Math.sin(a) * d * 0.55)}px`, animationDelay: `${i * 14}ms` } as React.CSSProperties} />;
        })}
      {value === "no_data" && <span className="vesta-nodata-pulse" aria-hidden />}
    </span>
  );
}

const FACT_SHOW_MS = 12_000;

/** Poke VESTA's orb: she wiggles and shares a real fact from the data, with its source. */
export function useSpaceFacts() {
  const [facts, setFacts] = useState<SpaceFact[] | null>(null);
  const [index, setIndex] = useState(-1);
  const [open, setOpen] = useState(false);
  const [wiggle, setWiggle] = useState(0);
  const loading = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const arm = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), FACT_SHOW_MS);
  }, []);
  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  const poke = useCallback(async () => {
    setWiggle((w) => w + 1);
    let list = facts;
    if (!list && !loading.current) {
      loading.current = true;
      try {
        const res = await fetch("/api/vesta/facts");
        const data = res.ok ? ((await res.json()) as SpaceFact[]) : [];
        list = Array.isArray(data) ? data : [];
        setFacts(list);
      } catch {
        list = [];
        setFacts([]);
      } finally {
        loading.current = false;
      }
    }
    if (!list?.length) return;
    useHearth.getState().track({ kind: "fact" });
    setIndex((i) => (i + 1) % list!.length);
    setOpen(true);
    arm();
  }, [facts, arm]);

  const fact = facts && index >= 0 ? facts[index] : null;
  return { fact, n: index + 1, total: facts?.length ?? 0, open: open && !!fact, wiggle, poke, close: () => setOpen(false) };
}

export function SpaceFactCard({ fact, n, total, onClose, onNext }: { fact: SpaceFact; n: number; total: number; onClose: () => void; onNext: () => void }) {
  return (
    <div role="status" className="relative mx-3 mb-2 animate-fadeUp rounded-xl rounded-tl-sm border border-ember/40 bg-raised/95 p-2.5 pr-8 shadow-[0_10px_24px_rgba(0,0,0,0.45)]">
      <p className="font-mono text-[10px] uppercase tracking-wider text-ember-soft">
        Space fire fact {n} / {total}
      </p>
      <p className="mt-1 text-[13px] leading-snug text-text">{fact.text}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2 border-t border-line pt-1.5">
        <p className="truncate font-mono text-[10px] text-muted">Source: {fact.source}</p>
        <button type="button" onClick={onNext} className="shrink-0 font-mono text-[10px] text-ember-soft hover:text-ember">
          another
        </button>
      </div>
      <button type="button" onClick={onClose} aria-label="Close fact" className="absolute right-1.5 top-1.5 rounded p-1 text-muted hover:text-text">
        <IconClose className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const SKIN_SWATCH: Record<Skin, string> = { ember: "#ff7a2f", nebula: "#e879f9", mars: "#e2725b", moon: "#b8c4d9" };

/** Skins and the starfield. Only the accent colour changes; data and safety colours never do. */
export function EffectsMenu() {
  const skin = useHearth((s) => s.skin);
  const setSkin = useHearth((s) => s.setSkin);
  const starfield = useHearth((s) => s.starfield);
  const setStarfield = useHearth((s) => s.setStarfield);
  const trail = useHearth((s) => s.trail);
  const setTrail = useHearth((s) => s.setTrail);
  const reveal = useHearth((s) => s.reveal);
  const setReveal = useHearth((s) => s.setReveal);
  const unlocked = useHearth((s) => s.unlocked);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative" data-no-drag>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Looks and effects" title="Looks and effects" className={`vesta-ctl ${open ? "is-on" : ""}`}>
        <IconSparkle className="h-4 w-4" />
      </button>
      {open && (
        <div role="dialog" aria-label="Looks and effects" className="absolute right-0 top-9 z-30 max-h-[70vh] w-64 animate-fadeUp overflow-y-auto rounded-xl border border-[#2c3b5e] bg-raised p-3 shadow-[0_16px_36px_rgba(0,0,0,0.55)]">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Skin</p>
          <div className="mt-1.5 grid grid-cols-4 gap-1" role="radiogroup" aria-label="Skin">
            {(Object.keys(SKINS) as Skin[]).map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={skin === id}
                onClick={() => setSkin(id)}
                className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 text-[10px] transition ${skin === id ? "border-ember bg-ember/15 text-text" : "border-line text-muted hover:text-text"}`}
              >
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: SKIN_SWATCH[id], boxShadow: `0 0 8px ${SKIN_SWATCH[id]}` }} aria-hidden />
                {SKINS[id]}
              </button>
            ))}
          </div>
          {(
            [
              ["Starfield behind the chat", starfield, setStarfield],
              ["Ember trail behind the mouse", trail, setTrail],
              ["Panels rise in as you scroll", reveal, setReveal],
            ] as [string, boolean, (on: boolean) => void][]
          ).map(([label, on, set]) => (
            <label key={label} className="mt-2.5 flex cursor-pointer items-center justify-between gap-2 text-xs text-text">
              {label}
              <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[var(--ember)]" />
            </label>
          ))}
          <p className="mt-2 text-[10px] leading-snug text-muted">Data and safety colours never change. Type / in the chat for commands.</p>
          <div className="mt-3 border-t border-line pt-2">
            <p className="flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted">
              <span>Achievements</span>
              <span className="text-ember-soft">
                {unlocked.length} / {ACHIEVEMENTS.length}
              </span>
            </p>
            <ul className="mt-1.5 space-y-1">
              {ACHIEVEMENTS.map((a) => {
                const got = unlocked.includes(a.id);
                return (
                  <li key={a.id} className={`flex items-center gap-2 text-[11px] ${got ? "text-text" : "text-muted/70"}`}>
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] ${got ? "bg-ember text-bg" : "border border-line"}`} aria-hidden>
                      {got ? "★" : ""}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.title}</span>
                      <span className="block truncate text-[10px] text-muted">{a.hint}</span>
                    </span>
                    <span className="sr-only">{got ? "unlocked" : "locked"}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
