"use client";
import { useEffect, useId, useRef } from "react";
import type { Level } from "@/lib/store";
import { glassesFor, MOOD_LABEL, type Glasses, type Mood } from "@/lib/vesta/mood";

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

const LENS_L = "M17 6 H39 Q46 6 46 13 V25 Q46 33 38 33 H18 Q9 33 9 25 V13 Q9 6 17 6 Z";
const LENS_R = "M61 6 H83 Q91 6 91 13 V25 Q91 33 82 33 H62 Q54 33 54 25 V13 Q54 6 61 6 Z";

/**
 * Nerdy glasses: thick dark frames, tape round the bridge and clear lenses (her eyes always show) with a
 * little shine and a glint that sweeps across now and then.
 */
function NerdGlasses({ drop = false }: { drop?: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={`vf-glasses ${drop ? "is-drop" : ""}`} viewBox="0 0 100 40" aria-hidden>
      <defs>
        <clipPath id={`${id}c`}>
          <path d={LENS_L} />
          <path d={LENS_R} />
        </clipPath>
      </defs>
      <path d="M9 12 L1 10 M91 12 L99 10" stroke="#15121c" strokeWidth="4" strokeLinecap="round" />
      <path d={LENS_L} fill="rgba(190,225,255,0.2)" stroke="#15121c" strokeWidth="5" />
      <path d={LENS_R} fill="rgba(190,225,255,0.2)" stroke="#15121c" strokeWidth="5" />
      <path d="M46 15 Q50 11 54 15" stroke="#15121c" strokeWidth="5" fill="none" />
      {/* tape round the bridge */}
      <rect x="45.6" y="9" width="8.8" height="9.5" rx="1.6" fill="#f6f2e6" stroke="#bdb5a0" strokeWidth="0.8" />
      <path d="M47.6 10.5 V17 M50 10.5 V17 M52.4 10.5 V17" stroke="#d8d0bb" strokeWidth="0.7" />
      <g clipPath={`url(#${id}c)`}>
        <path d="M14 22 L22 10 M18 25 L28 11 M59 22 L67 10 M63 25 L73 11" stroke="rgba(255,255,255,0.45)" strokeWidth="1.6" strokeLinecap="round" />
        <g transform="rotate(22 50 20)">
          <rect className="vf-glint" x="-26" y="-30" width="9" height="100" fill="rgba(255,255,255,0.55)" />
        </g>
      </g>
    </svg>
  );
}

/**
 * VESTA's face over her orb: clear eyes that blink and look around, a mouth for each mood, freckles, nerdy
 * glasses and a hat per level. Decoration only: the mood mirrors real events (tools running, the confidence tag,
 * a mission warning) and never replaces the tag itself. `glassesDrop` replays her putting the glasses on (a new
 * value each time).
 */
export function VestaFace({
  mood,
  level,
  listening = false,
  follow = true,
  glasses,
  glassesDrop,
  className = "",
}: {
  mood: Mood;
  level?: Level;
  listening?: boolean;
  follow?: boolean;
  glasses?: Glasses;
  glassesDrop?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useLookAt(ref, follow);
  const gl = glasses ?? glassesFor(mood);
  return (
    <span ref={ref} className={`vesta-face mood-${mood} glasses-${gl} ${listening ? "is-listening" : ""} ${className}`} aria-hidden>
      <span className="vf-rim" />
      <span className="vf-freckles l" />
      <span className="vf-freckles r" />
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
      {gl !== "off" && <NerdGlasses key={glassesDrop ?? "glasses"} drop={glassesDrop != null} />}
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

/**
 * VESTA as a little floating orb (desktop; how every visit starts). Click to open the chat. `greet` makes her
 * say hello (a jump, a wave and a speech bubble); each new `hop` value makes her jump, e.g. for a new warning.
 */
export function MiniVesta({
  mood,
  level,
  unseen,
  missionName,
  greet,
  hop,
  onOpen,
}: {
  mood: Mood;
  level: Level;
  unseen: number;
  missionName: string;
  greet: { key: number; title: string; text: string } | null;
  hop: number;
  onOpen: () => void;
}) {
  const label = unseen ? `Open VESTA (${unseen} new ${unseen === 1 ? "warning" : "warnings"})` : "Open VESTA";
  return (
    <div className="vesta-mini-wrap fixed bottom-6 right-6 z-[35] hidden items-end gap-3 vesta:flex">
      {greet ? (
        <button key={greet.key} type="button" onClick={onOpen} className="vesta-hello mb-6 max-w-[230px] rounded-2xl rounded-br-sm border border-ember/50 bg-raised px-3.5 py-2.5 text-left shadow-[0_12px_30px_rgba(0,0,0,0.55),0_0_18px_rgb(var(--ember-rgb)/0.25)]">
          <span className="block font-head text-sm font-bold text-text">{greet.title}</span>
          <span className="mt-0.5 block text-xs leading-snug text-muted">{greet.text}</span>
        </button>
      ) : (
        unseen > 0 && (
          <span className="mb-6 animate-fadeUp rounded-xl rounded-br-sm border border-[#2c3b5e] bg-raised px-3 py-2 text-xs text-text shadow-[0_10px_24px_rgba(0,0,0,0.5)]">
            Psst, a new warning for {missionName}
          </span>
        )
      )}
      <div className="relative">
        {greet && (
          <span key={greet.key} className="vesta-wave pointer-events-none absolute -left-5 -top-3 z-10 text-[26px] leading-none" aria-hidden>
            👋
          </span>
        )}
        {greet && (
          <span key={`b${greet.key}`} className="mini-burst pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i} style={{ "--a": `${i * 36}deg` } as React.CSSProperties} />
            ))}
          </span>
        )}
        <button id="vesta-mini" type="button" onClick={onOpen} aria-label={label} title={`VESTA is ${MOOD_LABEL[mood]}`} className="vesta-mini relative block h-[72px] w-[72px] rounded-full">
          <span key={hop} className={`absolute inset-0 rounded-full ${hop ? "vesta-hop" : ""}`}>
            <span className={`vesta-mini-body mood-${mood}`} aria-hidden />
            <VestaFace mood={greet ? "happy" : mood} level={level} />
          </span>
          {unseen > 0 && (
            <span className="absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-bg bg-bad px-1 font-mono text-[10px] font-bold text-bg" aria-hidden>
              {unseen}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
