"use client";
import { useEffect, useId, useRef } from "react";
import type { Level } from "@/lib/store";
import { MOOD_LABEL, shadesFor, type Mood, type Shades } from "@/lib/vesta/mood";

/** The presentation's pretend cursor announces where it is with this event, so VESTA's eyes can follow it too. */
export const LOOK_EVENT = "hearth:look";

/**
 * Pupils drift toward the mouse pointer (desktop with a mouse) or the presenter's cursor, motion allowed.
 * Writes CSS variables, no re-renders.
 */
function useLookAt(ref: React.RefObject<HTMLElement>, on: boolean) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !on || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const fine = !!window.matchMedia?.("(pointer: fine)").matches;
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
      const reach = Math.min(1, d / 220) * r.width * 0.04;
      el.style.setProperty("--lx", `${((dx / d) * reach).toFixed(2)}px`);
      el.style.setProperty("--ly", `${((dy / d) * reach).toFixed(2)}px`);
    };
    const aim = (x: number, y: number) => {
      px = x;
      py = y;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    // while presenting, the real pointer is hidden: only the presenter's cursor counts
    const onMove = (e: PointerEvent) => {
      if (!document.documentElement.classList.contains("presenting")) aim(e.clientX, e.clientY);
    };
    const onLook = (e: Event) => {
      const p = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (p) aim(p.x, p.y);
    };
    if (fine) window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener(LOOK_EVENT, onLook);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener(LOOK_EVENT, onLook);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref, on]);
}

/** A hat for each explanation level. Pure decoration; it pops on when the level changes. Nothing covers her eyes. */
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
  // researcher: a mission-control headset
  return (
    <svg key="researcher" className="vf-hat vf-hat-headset" viewBox="0 0 100 84" aria-hidden>
      <path d="M13 50 Q13 6 50 6 Q87 6 87 50" fill="none" stroke="#1d2440" strokeWidth="9" strokeLinecap="round" />
      <path d="M13 50 Q13 6 50 6 Q87 6 87 50" fill="none" stroke="#4cc9f0" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="3" y="40" width="15" height="26" rx="6" fill="#1d2440" stroke="#e8ecf6" strokeWidth="2" />
      <rect x="82" y="40" width="15" height="26" rx="6" fill="#1d2440" stroke="#e8ecf6" strokeWidth="2" />
      <path d="M90 64 Q90 80 68 80" fill="none" stroke="#e8ecf6" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="66" cy="80" r="3.6" fill="#ffb98a" stroke="#1d2440" strokeWidth="1.5" />
    </svg>
  );
}

const LENS_L = "M11 6 H45 Q47.5 6 47 9 L44.5 25 Q43.5 32 36 32 H21 Q13.5 32 12.5 25 L9 9 Q8.5 6 11 6 Z";
const LENS_R = "M89 6 H55 Q52.5 6 53 9 L55.5 25 Q56.5 32 64 32 H79 Q86.5 32 87.5 25 L91 9 Q91.5 6 89 6 Z";

/** See-through sunglasses: tinted lenses (her eyes stay visible), a dark frame and a glint that sweeps across. */
function Sunglasses({ drop = false }: { drop?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={`vf-shades ${drop ? "is-drop" : ""}`} viewBox="0 0 100 36" aria-hidden>
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#04060d" stopOpacity="0.66" />
          <stop offset="1" stopColor="#04060d" stopOpacity="0.22" />
        </linearGradient>
        <clipPath id={`${id}c`}>
          <path d={LENS_L} />
          <path d={LENS_R} />
        </clipPath>
      </defs>
      <path d="M1 10 L10 8 M99 10 L90 8" stroke="#0b0f1a" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M46 10 Q50 6.5 54 10" stroke="#0b0f1a" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d={LENS_L} fill={`url(#${id}t)`} stroke="#0b0f1a" strokeWidth="2.8" />
      <path d={LENS_R} fill={`url(#${id}t)`} stroke="#0b0f1a" strokeWidth="2.8" />
      <g clipPath={`url(#${id}c)`}>
        <g transform="rotate(22 50 18)">
          <rect className="vf-glint" x="-26" y="-30" width="9" height="96" fill="rgba(255,255,255,0.6)" />
        </g>
      </g>
      <path d="M14 8.5 Q28 7 42 8.5 M58 8.5 Q72 7 86 8.5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

/**
 * VESTA's face over her orb: clear eyes that blink and look around, a mouth for each mood, sunglasses and a hat
 * per level. Decoration only: the mood mirrors real events (tools running, the confidence tag, a mission warning)
 * and never replaces the tag itself. `shadesDrop` replays the shades landing on her nose (a new value each time).
 */
export function VestaFace({
  mood,
  level,
  listening = false,
  follow = true,
  shades,
  shadesDrop,
  className = "",
}: {
  mood: Mood;
  level?: Level;
  listening?: boolean;
  follow?: boolean;
  shades?: Shades;
  shadesDrop?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLookAt(ref, follow);
  const sh = shades ?? shadesFor(mood);
  return (
    <span ref={ref} className={`vesta-face mood-${mood} shades-${sh} ${listening ? "is-listening" : ""} ${className}`} aria-hidden>
      <span className="vf-rim" />
      {mood === "happy" ? (
        <>
          <span className="vf-arc l" />
          <span className="vf-arc r" />
          <span className="vf-blush l" />
          <span className="vf-blush r" />
        </>
      ) : (
        <>
          <span className="vf-eye l">
            <span className="vf-pupil" />
          </span>
          <span className="vf-eye r">
            <span className="vf-pupil" />
          </span>
        </>
      )}
      {mood === "worried" && (
        <>
          <span className="vf-brow l" />
          <span className="vf-brow r" />
        </>
      )}
      <span className="vf-mouth" />
      {sh !== "off" && <Sunglasses key={shadesDrop ?? "shades"} drop={shadesDrop != null} />}
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
