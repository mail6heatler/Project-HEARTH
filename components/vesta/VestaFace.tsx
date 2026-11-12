"use client";
import { useEffect, useRef } from "react";
import type { Level } from "@/lib/store";
import { MOOD_LABEL, type Mood } from "@/lib/vesta/mood";

/** Eyes drift toward the mouse pointer (desktop with a mouse, motion allowed). Writes CSS variables, no re-renders. */
function useLookAt(ref: React.RefObject<HTMLElement>, on: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !on || !window.matchMedia?.("(pointer: fine)").matches || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let px = 0;
    let py = 0;
    const apply = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      const dx = px - (r.left + r.width / 2);
      const dy = py - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 220) * r.width * 0.06;
      el.style.setProperty("--lx", `${((dx / d) * reach).toFixed(2)}px`);
      el.style.setProperty("--ly", `${((dy / d) * reach).toFixed(2)}px`);
    };
    const onMove = (e: PointerEvent) => {
      px = e.clientX;
      py = e.clientY;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, on]);
}

/** A hat for each explanation level. Pure decoration; it pops on when the level changes. */
function Outfit({ level }: { level: Level }) {
  if (level === "student")
    return (
      <svg key="student" className="vf-hat vf-hat-cap" viewBox="0 0 100 60" aria-hidden>
        <polygon points="50,6 96,24 50,42 4,24" fill="#1d2440" stroke="#e8ecf6" strokeWidth="2" />
        <path d="M28 33 v12 q22 12 44 0 v-12" fill="#1d2440" stroke="#e8ecf6" strokeWidth="2" />
        <path d="M50 24 L86 30 v16" fill="none" stroke="#ffc857" strokeWidth="2.5" />
        <circle cx="86" cy="48" r="3.5" fill="#ffc857" />
      </svg>
    );
  if (level === "engineer")
    return (
      <svg key="engineer" className="vf-hat vf-hat-helmet" viewBox="0 0 100 60" aria-hidden>
        <path d="M14 46 q0 -38 36 -40 q36 2 36 40 z" fill="#ffc857" stroke="#7a5a10" strokeWidth="2" />
        <rect x="4" y="44" width="92" height="9" rx="4" fill="#ffd77f" stroke="#7a5a10" strokeWidth="2" />
        <path d="M50 8 v36 M36 12 v32 M64 12 v32" stroke="#e0a830" strokeWidth="3" />
      </svg>
    );
  return (
    <svg key="researcher" className="vf-hat vf-hat-goggles" viewBox="0 0 100 40" aria-hidden>
      <path d="M2 20 h96" stroke="#4cc9f0" strokeWidth="4" />
      <circle cx="33" cy="20" r="15" fill="rgba(76,201,240,0.18)" stroke="#e8ecf6" strokeWidth="4" />
      <circle cx="67" cy="20" r="15" fill="rgba(76,201,240,0.18)" stroke="#e8ecf6" strokeWidth="4" />
      <path d="M26 13 q5 -3 9 0 M60 13 q5 -3 9 0" stroke="#fff" strokeWidth="2.5" fill="none" />
    </svg>
  );
}

/**
 * Eyes, a mood glow and a hat drawn over VESTA's orb. Decoration only: the mood mirrors real events
 * (tools running, the confidence tag, a mission warning) and never replaces the tag itself.
 */
export function VestaFace({ mood, level, listening = false, follow = true, className = "" }: { mood: Mood; level?: Level; listening?: boolean; follow?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLookAt(ref, follow);
  return (
    <span ref={ref} className={`vesta-face mood-${mood} ${listening ? "is-listening" : ""} ${className}`} aria-hidden>
      <span className="vf-glow" />
      <span className="vf-eyes">
        {mood === "happy" ? (
          <>
            <span className="vf-arc l" />
            <span className="vf-arc r" />
          </>
        ) : (
          <>
            <span className="vf-eye l" />
            <span className="vf-eye r" />
          </>
        )}
      </span>
      {mood === "worried" && (
        <>
          <span className="vf-brow l" />
          <span className="vf-brow r" />
        </>
      )}
      {mood === "thinking" && (
        <span className="vf-orbit">
          <i />
          <i />
          <i />
        </span>
      )}
      {mood === "alert" && <span className="vf-ring" />}
      {level && <Outfit level={level} />}
    </span>
  );
}

/** VESTA hidden into a little floating orb (desktop). Click to bring the chat back. */
export function MiniVesta({ mood, level, unseen, missionName, onOpen }: { mood: Mood; level: Level; unseen: number; missionName: string; onOpen: () => void }) {
  const label = unseen ? `Open VESTA (${unseen} new ${unseen === 1 ? "warning" : "warnings"})` : "Open VESTA";
  return (
    <div className="vesta-mini-wrap fixed bottom-6 right-6 z-[35] hidden items-center gap-3 vesta:flex">
      {unseen > 0 && (
        <span className="animate-fadeUp rounded-xl rounded-br-sm border border-[#2c3b5e] bg-raised px-3 py-2 text-xs text-text shadow-[0_10px_24px_rgba(0,0,0,0.5)]">
          Psst, a new warning for {missionName}
        </span>
      )}
      <button type="button" onClick={onOpen} aria-label={label} title={`VESTA is ${MOOD_LABEL[mood]}`} className="vesta-mini relative h-[72px] w-[72px] rounded-full">
        <span className={`vesta-mini-body mood-${mood}`} aria-hidden />
        <VestaFace mood={mood} level={level} />
        {unseen > 0 && (
          <span className="absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-bg bg-bad px-1 font-mono text-[10px] font-bold text-bg" aria-hidden>
            {unseen}
          </span>
        )}
      </button>
    </div>
  );
}
