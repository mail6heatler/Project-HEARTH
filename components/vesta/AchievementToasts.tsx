"use client";
import { useEffect } from "react";
import { useHearth } from "@/lib/store";

const SHOW_MS = 5500;
const SPARKS = 12;

function Toast({ id, title, hint }: { id: string; title: string; hint: string }) {
  const dismiss = useHearth((s) => s.dismissToast);
  useEffect(() => {
    const t = setTimeout(() => dismiss(id), SHOW_MS);
    return () => clearTimeout(t);
  }, [id, dismiss]);
  return (
    <div role="status" className="achievement relative flex items-center gap-3 rounded-xl border border-ember/50 bg-raised/95 py-2.5 pl-3 pr-8 shadow-[0_14px_34px_rgba(0,0,0,0.55),0_0_22px_rgb(var(--ember-rgb)/0.25)]">
      <span className="relative grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ember text-lg text-bg" aria-hidden>
        ★
        {Array.from({ length: SPARKS }, (_, i) => {
          const a = (i / SPARKS) * Math.PI * 2;
          return <span key={i} className="vesta-spark achievement-spark" style={{ "--dx": `${Math.round(Math.cos(a) * 34)}px`, "--dy": `${Math.round(Math.sin(a) * 34)}px`, animationDelay: `${i * 12}ms` } as React.CSSProperties} />;
        })}
      </span>
      <span className="min-w-0">
        <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-ember-soft">Achievement unlocked</span>
        <span className="block font-head text-sm font-semibold text-text">{title}</span>
        <span className="block text-[11px] text-muted">{hint}</span>
      </span>
      <button type="button" onClick={() => dismiss(id)} aria-label="Close" className="absolute right-1.5 top-1.5 rounded px-1 text-muted hover:text-text">
        ×
      </button>
    </div>
  );
}

/** Little "achievement unlocked" cards for exploring HEARTH. Local only. */
export function AchievementToasts() {
  const toasts = useHearth((s) => s.toasts);
  const presenting = useHearth((s) => s.presenting);
  if (!toasts.length || presenting) return null;
  return (
    <div className="pointer-events-none fixed left-1/2 top-[60px] z-[50] flex w-[min(340px,calc(100vw-32px))] -translate-x-1/2 flex-col gap-2">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast {...t} />
        </div>
      ))}
    </div>
  );
}
