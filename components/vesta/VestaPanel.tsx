"use client";
import { useEffect, useRef, useState } from "react";
import { IconAudit, IconCheck, IconDock, IconExpand, IconGap, IconGrip, IconHideMini, IconPopOut, IconRank, IconSend, IconShrink, IconStop, IconTrash } from "@/components/ui/Icons";
import { getMission } from "@/lib/missions";
import { newId, useHearth, type Level } from "@/lib/store";
import { MOOD_HOLD_MS, moodFor, type Mood } from "@/lib/vesta/mood";
import { EngineRoom } from "./EngineRoom";
import { EffectsMenu, SpaceFactCard, useSpaceFacts } from "./Fx";
import { Orb } from "./Orb";
import { MiniVesta, VestaFace } from "./VestaFace";
import { useVestaWindow } from "./useVestaWindow";
import type { Edge } from "./windowGeometry";
import { followUps, starters, toolLabel, type StarterIcon } from "./suggest";
import { useVesta } from "./useVesta";
import { VestaMessageView } from "./VestaMessageView";

const LEVELS: Level[] = ["student", "researcher", "engineer"];
const MAX_INPUT = 2000;
/** Show the character count only when it starts to matter. */
const COUNT_FROM = 1600;

const STARTER_ICONS: Record<StarterIcon, typeof IconAudit> = { assess: IconCheck, audit: IconAudit, rank: IconRank, gaps: IconGap };

function smooth(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function VestaPanel() {
  const messages = useHearth((s) => s.messages);
  const busy = useHearth((s) => s.busy);
  const level = useHearth((s) => s.level);
  const setLevel = useHearth((s) => s.setLevel);
  const draft = useHearth((s) => s.draft);
  const setDraft = useHearth((s) => s.setDraft);
  const clearMessages = useHearth((s) => s.clearMessages);
  const missionId = useHearth((s) => s.missionId);
  const mission = getMission(missionId);
  const { send, stop } = useVesta();
  const listRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [panelInView, setPanelInView] = useState(true);
  const starfield = useHearth((s) => s.starfield);
  const warp = useHearth((s) => s.warp);
  const addMessage = useHearth((s) => s.addMessage);
  const win = useVestaWindow(panelRef);
  const facts = useSpaceFacts();

  // VESTA's face follows the last message: thinking, happy (supported), worried (little data), alert (mission warning)
  const lastMsg = messages[messages.length - 1];
  const baseMood: Mood = moodFor(busy, lastMsg ? { role: lastMsg.role, alert: lastMsg.alert, confidence: lastMsg.confidence, pending: lastMsg.pending, error: lastMsg.error } : undefined);
  const [relaxed, setRelaxed] = useState(false);
  useEffect(() => {
    setRelaxed(false);
    if (baseMood === "idle" || baseMood === "thinking") return;
    const t = setTimeout(() => setRelaxed(true), MOOD_HOLD_MS);
    return () => clearTimeout(t);
  }, [baseMood, lastMsg?.id]);
  const mood: Mood = relaxed ? "idle" : baseMood;

  // warnings that arrive while VESTA is hidden show as a badge on mini VESTA
  const [unseen, setUnseen] = useState(0);
  const seenId = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!lastMsg || lastMsg.id === seenId.current) return;
    seenId.current = lastMsg.id;
    if (win.mode === "hidden" && (lastMsg.alert === "warn" || lastMsg.alert === "bad")) setUnseen((n) => n + 1);
  }, [lastMsg, win.mode]);
  const openFromMini = () => {
    setUnseen(0);
    win.show();
  };

  useEffect(() => {
    // jump while text streams in, glide only for whole new messages
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: busy ? "auto" : smooth() });
  }, [messages, busy]);

  // "/" jumps to the question box, unless the visitor is already typing somewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || el?.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!panelRef.current) return;
    const io = new IntersectionObserver(([entry]) => setPanelInView(entry.isIntersecting), { threshold: 0.15 });
    io.observe(panelRef.current);
    return () => io.disconnect();
  }, []);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || busy) return;
    const t = draft;
    setDraft("");
    if (t.trim().toLowerCase() === "/warp") {
      warp();
      addMessage({ id: newId(), role: "vesta", text: "Hyperspace jump complete. Back to fire safety.", badge: "Easter egg · no AI", steps: [], charts: [], sources: [] });
      return;
    }
    send(t);
  };

  const jumpToPanel = () => {
    panelRef.current?.scrollIntoView({ behavior: smooth(), block: "start" });
    inputRef.current?.focus({ preventScroll: true });
  };

  const asked = messages.some((m) => m.role === "user");
  const last = messages[messages.length - 1];
  const showFollowUps = asked && !busy && last?.role === "vesta" && !last.pending && !last.error;
  const running = [...(last?.steps ?? [])].reverse().find((s) => s.status === "running" && s.tool !== "engine");
  const nextQuestions = showFollowUps
    ? followUps(
        last.steps.map((s) => s.tool),
        last.sources.find((s) => s.test_id)?.test_id,
      )
    : [];

  const { mode, box, anim } = win;
  const floating = mode === "float" || mode === "expand";
  const draggable = win.isDesktop && mode !== "expand";
  const animClass = anim === "in" ? "vesta-warp-in" : anim === "out" ? "vesta-warp-out" : anim === "pop" ? "vesta-pop" : "";
  const docked = `relative flex scroll-mt-28 flex-col border-t border-line bg-panel/70 vesta:sticky vesta:top-[49px] vesta:h-[calc(100vh-49px)] vesta:w-[400px] vesta:shrink-0 vesta:border-t-0 ${mode === "left" ? "vesta:border-r" : "vesta:border-l"}`;
  const panelClass =
    mode === "hidden"
      ? "hidden"
      : floating
        ? `fixed flex flex-col overflow-hidden rounded-2xl border border-[#2c3b5e] bg-panel/95 shadow-[0_24px_60px_rgba(0,0,0,0.6),0_0_30px_rgba(255,122,47,0.12)] ${mode === "expand" ? "z-[37]" : "z-[35]"}`
        : docked;
  const panelStyle = {
    ...(floating && box ? { left: box.x, top: box.y, width: box.w, height: box.h } : { order: mode === "left" ? 1 : 3 }),
    // the Engine room's height budget, so the question box always stays on screen
    "--room-max": floating && box ? `${Math.max(150, box.h - 470)}px` : "max(220px, calc(100vh - 520px))",
  } as unknown as React.CSSProperties;
  const resizeEdges: { edge: Edge; cls: string }[] = [
    { edge: "e", cls: "right-[-3px] top-3 bottom-4 w-2 cursor-ew-resize" },
    { edge: "w", cls: "left-[-3px] top-3 bottom-4 w-2 cursor-ew-resize" },
    { edge: "s", cls: "bottom-[-3px] left-4 right-4 h-2 cursor-ns-resize" },
    { edge: "sw", cls: "bottom-0 left-0 h-4 w-4 cursor-nesw-resize" },
    { edge: "se", cls: "bottom-0 right-0 h-5 w-5 cursor-nwse-resize" },
  ];
  const wiggle = facts.wiggle ? (facts.wiggle % 2 ? "vesta-wiggle-a" : "vesta-wiggle-b") : "";

  return (
    <>
      <aside ref={panelRef} id="vesta-panel" aria-label="VESTA assistant" className={`${panelClass} ${animClass}`} style={panelStyle}>
        {anim === "in" && <div className="vesta-streaks" aria-hidden />}
        <div id="tour-vesta" className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-line bg-gradient-to-b from-ember/10 to-transparent px-3 py-2">
          <div
            onPointerDown={win.onHeaderPointerDown}
            onDoubleClick={(e) => {
              if (win.isDesktop && !(e.target as HTMLElement).closest("button")) win.dockRight();
            }}
            title={draggable ? "Drag to move VESTA · double-click to dock her on the right" : undefined}
            className={`flex w-full items-center gap-2 ${draggable ? "cursor-grab touch-none" : ""}`}
          >
            {draggable && <IconGrip className="h-4 w-2.5 shrink-0 text-muted/60" />}
            <button type="button" onClick={facts.poke} aria-label="Poke VESTA for a space fire fact" title="Poke me for a space fire fact" className={`relative shrink-0 rounded-full ${wiggle}`}>
              <Orb thinking={busy} size={58} />
              <VestaFace mood={mood} />
            </button>
          <div className="mr-auto min-w-0">
            <h2 className="font-head text-lg font-bold leading-tight tracking-[0.18em]">VESTA</h2>
            <p className="text-[10px] leading-tight text-muted">Your AI fire-safety crewmate</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted" role="status" aria-live="polite">
              <span className={`h-1.5 w-1.5 rounded-full ${busy ? "animate-pulse bg-ember" : "bg-ok"}`} aria-hidden />
              {busy ? (running ? `${toolLabel(running.tool)}…` : "Thinking…") : "Standing by"}
            </p>
          </div>
            <div className="flex flex-col items-end gap-1 self-start" data-no-drag>
              <div className="flex items-center gap-0.5">
                <EffectsMenu />
                {win.isDesktop && (
                  <>
                    <button type="button" onClick={win.toggleExpand} aria-label={mode === "expand" ? "Shrink VESTA back" : "Expand VESTA"} title={mode === "expand" ? "Shrink back (Esc)" : "Expand"} className={`vesta-ctl ${mode === "expand" ? "is-on" : ""}`}>
                      {mode === "expand" ? <IconShrink className="h-4 w-4" /> : <IconExpand className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={win.toggleFloat} aria-label={win.dock === "float" ? "Dock VESTA on the right" : "Pop VESTA out as a floating window"} title={win.dock === "float" ? "Dock on the right" : "Pop out"} className="vesta-ctl">
                      {win.dock === "float" ? <IconDock className="h-4 w-4" /> : <IconPopOut className="h-4 w-4" />}
                    </button>
                    <button type="button" onClick={win.hide} aria-label="Hide VESTA into mini VESTA" title="Hide into mini VESTA" className="vesta-ctl">
                      <IconHideMini className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              {messages.length > 0 && (
                <button type="button" disabled={busy} onClick={clearMessages} className="flex items-center gap-1 rounded px-1 text-[11px] text-muted transition hover:text-text disabled:opacity-40">
                  <IconTrash className="h-3 w-3" /> Clear chat
                </button>
              )}
            </div>
          </div>
          <div role="radiogroup" aria-label="Explanation level" className="relative flex w-full rounded-md border border-line bg-bg/60 text-[11px]">
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 w-1/3 rounded-md border border-ember/50 bg-ember/20 transition-transform duration-300"
              style={{ transform: `translateX(${LEVELS.indexOf(level) * 100}%)` }}
            />
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={level === l}
                onClick={() => setLevel(l)}
                className={`relative flex-1 rounded-md px-2 py-1 capitalize transition ${level === l ? "text-ember-soft" : "text-muted hover:text-text"}`}
              >
                {l}
              </button>
            ))}
          </div>
          <EngineRoom />
        </div>
        <div className={busy ? "vesta-conduit" : "h-0.5"} aria-hidden />
        {facts.open && facts.fact && <SpaceFactCard fact={facts.fact} n={facts.n} total={facts.total} onClose={facts.close} onNext={facts.poke} />}

        <ul ref={listRef} className={`flex max-h-[60vh] min-h-[240px] flex-1 flex-col gap-2 overflow-y-auto px-3 py-3 vesta:max-h-none vesta:min-h-[96px] ${starfield ? "vesta-stars" : ""}`} aria-live="polite">
          <li className="shrink-0 animate-fadeUp px-1 text-[13px] leading-relaxed text-muted">
            I&apos;m <b className="font-semibold text-ember-soft">VESTA</b>. Every number I give comes from NASA test data or a tested formula, with its source and a confidence tag. If the data can&apos;t answer, I&apos;ll say so.
          </li>
          {messages.map((m) => (
            <VestaMessageView key={m.id} m={m} />
          ))}
        </ul>

        <div className="border-t border-line bg-panel/80 px-3 py-2">
          {!asked && (
            <div className="mb-2 grid grid-cols-2 gap-1.5">
              {starters(mission?.short ?? "mission").map((s) => {
                const Icon = STARTER_ICONS[s.icon];
                return (
                  <button
                    key={s.title}
                    type="button"
                    disabled={busy}
                    onClick={() => send(s.question)}
                    className="group rounded-lg border border-line bg-raised/80 p-2 text-left transition hover:-translate-y-px hover:border-ember/70 hover:shadow-[0_0_14px_rgba(255,122,47,0.2)] disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1.5 font-head text-xs font-semibold text-text">
                      <Icon className="h-3.5 w-3.5 text-ember transition-transform group-hover:scale-110" />
                      {s.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-muted">{s.hint}</span>
                  </button>
                );
              })}
            </div>
          )}
          {nextQuestions.length > 0 && (
            <div className="mb-2">
              <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">Ask next</p>
              <div className="flex flex-wrap gap-1.5">
                {nextQuestions.map((q) => (
                  <button key={q} type="button" onClick={() => send(q)} className="rounded-full border border-line bg-raised px-2.5 py-1 text-left text-[11px] text-muted transition hover:border-ember hover:text-text">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={submit} className="rounded-lg border border-line bg-bg/80 transition focus-within:border-ember focus-within:shadow-[0_0_16px_rgba(255,122,47,0.25)]">
            <label htmlFor="vesta-input" className="sr-only">
              Ask VESTA
            </label>
            <textarea
              id="vesta-input"
              ref={inputRef}
              rows={2}
              maxLength={MAX_INPUT}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) submit(e);
              }}
              placeholder="Ask about fire risk, a test or a data gap…"
              className="block w-full resize-none bg-transparent px-3 pt-2 text-sm placeholder:text-muted/70 focus:outline-none"
            />
            <div className="flex items-center justify-between gap-2 px-2 pb-1.5">
              <span className="pl-1 font-mono text-[10px] text-muted">
                {draft.length >= COUNT_FROM ? `${draft.length} / ${MAX_INPUT}` : (
                  <>
                    Enter to send<span className="hidden sm:inline"> · Shift+Enter for new line</span>
                  </>
                )}
              </span>
              {busy ? (
                <button type="button" onClick={stop} className="flex h-8 items-center gap-1 rounded-md border border-bad/60 px-2 text-xs text-bad transition hover:bg-bad/10" aria-label="Stop VESTA">
                  <IconStop className="h-3.5 w-3.5" /> Stop
                </button>
              ) : (
                <button type="submit" disabled={!draft.trim()} className="btn-ember h-8 !px-2.5 !py-0 disabled:!shadow-none" aria-label="Send to VESTA">
                  <IconSend className="h-4 w-4" />
                </button>
              )}
            </div>
          </form>
        </div>
        {mode === "float" &&
          resizeEdges.map((r) => (
            <div key={r.edge} onPointerDown={win.startResize(r.edge)} className={`absolute z-20 touch-none ${r.cls}`} aria-hidden>
              {r.edge === "se" && (
                <svg viewBox="0 0 12 12" className="h-full w-full p-0.5 text-ember-soft" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
                  <path d="M11 3L3 11M11 7l-4 4" />
                </svg>
              )}
            </div>
          ))}
      </aside>

      {win.zone && (
        <div className={`vesta-zone pointer-events-none fixed bottom-0 top-[49px] z-[34] grid w-[400px] place-items-center font-head tracking-[0.12em] ${win.zone === "left" ? "left-0" : "right-0"}`} aria-hidden>
          DROP TO DOCK {win.zone.toUpperCase()}
        </div>
      )}
      {mode === "expand" && <button type="button" onClick={win.toggleExpand} aria-label="Shrink VESTA back" className="fixed inset-0 z-[36] animate-fadeUp cursor-default bg-bg/70" />}
      {mode === "hidden" && <MiniVesta mood={unseen ? "alert" : mood} unseen={unseen} missionName={mission?.short ?? "current mission"} onOpen={openFromMini} />}

      {/* On phones the panel sits below the page, so keep a way to reach it from anywhere */}
      {!panelInView && (
        <button type="button" onClick={jumpToPanel} className="btn-ember fixed bottom-4 right-4 z-20 !rounded-full vesta:hidden">
          <span className="vesta-dot" aria-hidden />
          Ask VESTA
        </button>
      )}
    </>
  );
}
