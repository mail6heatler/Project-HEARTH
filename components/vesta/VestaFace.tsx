"use client";
import { MOOD_LABEL, type Mood } from "@/lib/vesta/mood";

/**
 * Eyes and a mood glow drawn over VESTA's orb. Decoration only: the mood mirrors real events
 * (tools running, the confidence tag, a mission warning) and never replaces the tag itself.
 */
export function VestaFace({ mood, className = "" }: { mood: Mood; className?: string }) {
  return (
    <span className={`vesta-face mood-${mood} ${className}`} aria-hidden>
      <span className="vf-glow" />
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
    </span>
  );
}

/** VESTA hidden into a little floating orb (desktop). Click to bring the chat back. */
export function MiniVesta({ mood, unseen, missionName, onOpen }: { mood: Mood; unseen: number; missionName: string; onOpen: () => void }) {
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
        <VestaFace mood={mood} />
        {unseen > 0 && (
          <span className="absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-bg bg-bad px-1 font-mono text-[10px] font-bold text-bg" aria-hidden>
            {unseen}
          </span>
        )}
      </button>
    </div>
  );
}
