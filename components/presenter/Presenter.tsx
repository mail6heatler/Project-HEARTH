"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PolarisMark } from "@/components/ui/Polaris";
import { CHAPTERS, type Action } from "@/lib/presenter/script";
import { fillNarration, type Facts } from "@/lib/presenter/timing";
import { useHearth, type VestaMessage } from "@/lib/store";
import type { EngineChoice } from "@/lib/vesta/engines";
import { Narrator } from "./narrator";
import { startRecording, type Recording } from "./recorder";
import { centerOf, ensureVisible, hoverIn, hoverOut, pressKey, resolveTarget, unzoom, waitForTarget, zoomTo } from "./stage";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const calm = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

interface Saved {
  missionId: string;
  engine: EngineChoice;
  level: ReturnType<typeof useHearth.getState>["level"];
  messages: VestaMessage[];
  highlightIds: string[];
  path: string;
}

type Rect = { x: number; y: number; w: number; h: number };

/**
 * "See HEARTH in action": an automated presentation over the real site. A presenter cursor moves and clicks,
 * the camera zooms, a spotlight highlights, VESTA really answers (Offline mode: no failures, no tokens), and
 * Team Polaris narrates with the browser's voice and subtitles. Optional screen recording. Everything the
 * visitor had (mission, engine, level, chat, page) is put back afterwards.
 */
export function Presenter() {
  const router = useRouter();
  const open = useHearth((s) => s.presenterOpen);
  const setOpen = useHearth((s) => s.setPresenterOpen);
  const presenting = useHearth((s) => s.presenting);

  const [voiceOn, setVoiceOn] = useState(true);
  const [subsOn, setSubsOn] = useState(true);
  const [recordOn, setRecordOn] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [word, setWord] = useState(-1);
  const [line, setLine] = useState("");
  const [paused, setPaused] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number; ms: number } | null>(null);
  const [press, setPress] = useState(0);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [spot, setSpot] = useState<Rect | null>(null);
  const [titleKey, setTitleKey] = useState(0);
  const [endCard, setEndCard] = useState(false);
  const [finished, setFinished] = useState(false);
  const [recState, setRecState] = useState<"off" | "on" | "saved" | "refused">("off");
  const [recFile, setRecFile] = useState<string | null>(null);

  const narrator = useRef<Narrator | null>(null);
  const abort = useRef<AbortController | null>(null);
  const saved = useRef<Saved | null>(null);
  const facts = useRef<Facts>({});
  const recording = useRef<Recording | null>(null);
  const pausedRef = useRef(false);
  const cursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const spotEl = useRef<{ el: Element; pad: number } | null>(null);
  const rippleId = useRef(0);

  // ?present opens the start card
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("present")) setOpen(true);
  }, [setOpen]);

  // the spotlight follows its element (scrolling, zooming, re-layout)
  useEffect(() => {
    if (!presenting) return;
    let raf = 0;
    let last = "";
    const tick = () => {
      const s = spotEl.current;
      if (s && s.el.isConnected) {
        const r = s.el.getBoundingClientRect();
        const next = { x: Math.round(r.left - s.pad), y: Math.round(r.top - s.pad), w: Math.round(r.width + s.pad * 2), h: Math.round(r.height + s.pad * 2) };
        const key = `${next.x},${next.y},${next.w},${next.h}`;
        if (key !== last) {
          last = key;
          setSpot(next);
        }
      } else if (last) {
        last = "";
        setSpot(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [presenting]);

  const gate = useCallback(async (signal: AbortSignal) => {
    while (pausedRef.current && !signal.aborted) await sleep(120);
  }, []);

  const wait = useCallback(
    async (ms: number, signal: AbortSignal) => {
      let left = ms;
      while (left > 0 && !signal.aborted) {
        await sleep(100);
        if (!pausedRef.current) left -= 100;
      }
    },
    [],
  );

  const moveTo = useCallback(async (x: number, y: number) => {
    const from = cursorRef.current;
    const ms = calm() ? 0 : Math.min(1100, Math.max(350, Math.hypot(x - from.x, y - from.y) * 0.9));
    cursorRef.current = { x, y };
    setCursor({ x, y, ms });
    await sleep(ms + 40);
  }, []);

  const clickAt = useCallback(async (el: HTMLElement) => {
    const c = centerOf(el);
    setPress((n) => n + 1);
    const id = ++rippleId.current;
    setRipples((r) => [...r.slice(-3), { id, x: c.x, y: c.y }]);
    setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 900);
    await sleep(160);
    el.click();
  }, []);

  const waitPath = useCallback(async (p: string, signal: AbortSignal) => {
    const end = Date.now() + 9000;
    while (!signal.aborted && Date.now() < end && window.location.pathname !== p) await sleep(120);
    await sleep(650);
  }, []);

  const run = useCallback(
    async (a: Action, signal: AbortSignal) => {
      const st = useHearth.getState;
      switch (a.do) {
        case "launch": {
          st().setLanding(true);
          await sleep(700);
          const btn = await waitForTarget(".ls-cta", signal, 3000);
          if (!btn) return;
          await moveTo(centerOf(btn).x, centerOf(btn).y);
          await clickAt(btn);
          const end = Date.now() + 6000;
          while (!signal.aborted && st().landing && Date.now() < end) await sleep(120);
          return;
        }
        case "go":
          router.push(a.path);
          return waitPath(a.path, signal);
        case "nav": {
          const link = await waitForTarget(`nav[aria-label="Main"] a[href="${a.path}"]`, signal, 2000);
          if (link) {
            await moveTo(centerOf(link).x, centerOf(link).y);
            await clickAt(link);
          } else router.push(a.path);
          return waitPath(a.path, signal);
        }
        case "move":
        case "click": {
          const el = await waitForTarget(a.do === "move" ? a.to : a.on, signal);
          if (!el) return;
          await ensureVisible(el, calm());
          await moveTo(centerOf(el).x, centerOf(el).y);
          if (a.do === "click") await clickAt(el);
          return;
        }
        case "hover": {
          const el = await waitForTarget(a.on, signal, 2500);
          if (!el) return;
          await ensureVisible(el, calm());
          await moveTo(centerOf(el).x, centerOf(el).y);
          hoverIn(el);
          await wait(a.ms ?? 1200, signal);
          hoverOut(el);
          return;
        }
        case "ask": {
          const box = (await waitForTarget("#vesta-input", signal)) as HTMLTextAreaElement | null;
          if (!box) return;
          await ensureVisible(box, calm());
          await moveTo(centerOf(box).x - 60, centerOf(box).y);
          await clickAt(box);
          box.focus({ preventScroll: true });
          for (let i = 1; i <= a.text.length && !signal.aborted; i++) {
            st().setDraft(a.text.slice(0, i));
            await sleep(calm() ? 0 : 28 + Math.random() * 30);
          }
          await sleep(250);
          const send = resolveTarget('button[aria-label="Send to VESTA"]');
          if (send) {
            await moveTo(centerOf(send).x, centerOf(send).y);
            setPress((n) => n + 1);
          }
          pressKey(box, "Enter");
          return;
        }
        case "waitVesta": {
          const start = Date.now();
          while (!signal.aborted && !st().busy && Date.now() - start < 1500) await sleep(80);
          while (!signal.aborted && st().busy && Date.now() - start < 25_000) await sleep(150);
          await sleep(500);
          return;
        }
        case "waitPath":
          return waitPath(a.path, signal);
        case "spot": {
          const el = await waitForTarget(a.on, signal, 3000);
          spotEl.current = el ? { el, pad: a.pad ?? 10 } : null;
          if (el) await ensureVisible(el, calm());
          return;
        }
        case "unspot":
          spotEl.current = null;
          return;
        case "zoom": {
          const el = await waitForTarget(a.on, signal, 2000);
          if (el) await zoomTo(el, a.scale ?? 1.2, calm());
          return;
        }
        case "unzoom":
          return unzoom();
        case "scroll": {
          const el = await waitForTarget(a.to, signal, 2500);
          if (!el) return;
          el.scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "center" });
          await sleep(calm() ? 50 : 750);
          return;
        }
        case "key":
          pressKey(document.activeElement ?? document.body, a.key);
          pressKey(document, a.key);
          return;
        case "wait":
          return wait(a.ms, signal);
        case "end":
          spotEl.current = null;
          setEndCard(true);
          return;
      }
    },
    [router, moveTo, clickAt, waitPath, wait],
  );

  const restore = useCallback(async () => {
    const st = useHearth.getState();
    await unzoom(true);
    spotEl.current = null;
    setSpot(null);
    setCursor(null);
    const s = saved.current;
    saved.current = null;
    st.setPresenting(false);
    st.setLanding(false);
    st.openTest(null);
    st.setRoomOpen(false);
    st.setDraft("");
    if (!s) return;
    st.setEngine(s.engine);
    st.setLevel(s.level);
    st.setMission(s.missionId);
    if (window.location.pathname !== s.path) router.push(s.path);
    // the mission change posts its alert after a moment: put the visitor's own chat back after that
    await sleep(450);
    useHearth.getState().setMessages(s.messages);
    useHearth.getState().setHighlight(s.highlightIds);
  }, [router]);

  const stopRecording = useCallback(async () => {
    const rec = recording.current;
    recording.current = null;
    if (!rec) return;
    const name = await rec.stop();
    setRecFile(name);
    setRecState(name ? "saved" : "off");
  }, []);

  const play = useCallback(
    async (from: number) => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      const signal = ctrl.signal;
      narrator.current?.stop();
      await unzoom(true);
      setEndCard(false);
      setFinished(false);
      for (let i = from; i < CHAPTERS.length && !signal.aborted; i++) {
        await gate(signal);
        const ch = CHAPTERS[i];
        setChapter(i);
        setTitleKey((k) => k + 1);
        spotEl.current = null;
        const text = fillNarration(ch.say, facts.current);
        setLine(text);
        setWord(-1);
        const speech = narrator.current ? narrator.current.speak(text, setWord, signal) : Promise.resolve();
        const actions = (async () => {
          for (const a of ch.actions) {
            if (signal.aborted) return;
            await gate(signal);
            try {
              await run(a, signal);
            } catch {
              /* a step that cannot run is skipped; the show goes on */
            }
          }
        })();
        await Promise.all([speech, actions]);
        await sleep(250);
      }
      if (signal.aborted) return;
      setFinished(true);
      await stopRecording();
    },
    [gate, run, stopRecording],
  );

  const start = async () => {
    // recording must start straight from this click: the browser asks what to share
    let rec: Recording | null = null;
    if (recordOn) {
      rec = await startRecording();
      setRecState(rec ? "on" : "refused");
      if (rec) {
        recording.current = rec;
        rec.onEnded(() => void stopRecording());
        await sleep(700);
      }
    } else setRecState("off");
    setRecFile(null);
    const n = new Narrator(voiceOn);
    narrator.current = n;
    await n.init();
    const st = useHearth.getState();
    saved.current = { missionId: st.missionId, engine: st.engine, level: st.level, messages: st.messages, highlightIds: st.highlightIds, path: window.location.pathname };
    try {
      const r = await fetch("/api/tests?page_size=1");
      const j = r.ok ? await r.json() : null;
      facts.current = { tests: typeof j?.total === "number" ? j.total : undefined };
    } catch {
      facts.current = {};
    }
    setOpen(false);
    st.setPresenting(true);
    st.setEngine("offline");
    st.setLevel("researcher");
    st.setMessages([]);
    st.setDraft("");
    st.setRoomOpen(false);
    st.requestOpen();
    if (window.location.pathname !== "/") router.push("/");
    cursorRef.current = { x: window.innerWidth / 2, y: window.innerHeight - 140 };
    setCursor({ ...cursorRef.current, ms: 0 });
    pausedRef.current = false;
    setPaused(false);
    void play(0);
  };

  const exit = useCallback(async () => {
    abort.current?.abort();
    narrator.current?.stop();
    setEndCard(false);
    setFinished(false);
    await stopRecording();
    await restore();
  }, [restore, stopRecording]);

  const togglePause = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    if (next) narrator.current?.pause();
    else narrator.current?.resume();
  };

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    narrator.current?.setVoice(next);
  };

  // Esc leaves the presentation (keys the presentation itself sends are not "trusted" and are ignored)
  useEffect(() => {
    if (!presenting && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      if (e.key === "Escape") {
        if (open) setOpen(false);
        else void exit();
      } else if (e.key === " " && presenting && !(e.target as HTMLElement)?.closest("input, textarea, button")) {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presenting, open, exit, setOpen]);

  useEffect(() => () => abort.current?.abort(), []);

  const words = line.split(/\s+/).filter(Boolean);
  const ch = CHAPTERS[chapter];
  const small = typeof window !== "undefined" && window.innerWidth < 1180;

  return (
    <>
      {open && !presenting && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-bg/80 p-4" role="dialog" aria-modal="true" aria-labelledby="present-h">
          <div className="present-card w-full max-w-md rounded-2xl border border-[#2c3b5e] bg-panel p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember-soft">Team Polaris presents</p>
            <h2 id="present-h" className="mt-1 font-head text-2xl font-bold">
              See HEARTH in action
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">A short guided run through every part of HEARTH, with VESTA answering live. Choose how you want it:</p>
            <div className="mt-4 space-y-2">
              {(
                [
                  ["Voice", "Team Polaris narrates with your browser's voice", voiceOn, setVoiceOn],
                  ["Subtitles", "The narration as text at the bottom", subsOn, setSubsOn],
                  ["Record a video", "Your browser asks what to share; the video downloads at the end", recordOn, setRecordOn],
                ] as [string, string, boolean, (v: boolean) => void][]
              ).map(([label, hint, on, set]) => (
                <label key={label} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-raised/60 px-3 py-2.5">
                  <span>
                    <span className="block text-sm font-medium text-text">{label}</span>
                    <span className="block text-[11px] text-muted">{hint}</span>
                  </span>
                  <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--ember)]" />
                </label>
              ))}
            </div>
            {recordOn && (
              <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-[11px] leading-snug text-warn">
                To keep the voice in the video, share <b>Entire screen</b> and tick <b>Share system audio</b>. Sharing only this tab may record the picture without the voice.
              </p>
            )}
            {small && <p className="mt-3 text-[11px] text-muted">Works best on a computer screen.</p>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                Not now
              </button>
              <button type="button" onClick={() => void start()} className="btn-ember px-5">
                ▶ Start
              </button>
            </div>
          </div>
        </div>
      )}

      {presenting && (
        <>
          {spot && (
            <div className="present-spot pointer-events-none fixed z-[75] rounded-xl" style={{ left: spot.x, top: spot.y, width: spot.w, height: spot.h }} aria-hidden />
          )}
          <div key={titleKey} className="present-title pointer-events-none fixed bottom-[132px] left-6 z-[85]" aria-hidden>
            <span className="font-mono text-[11px] tracking-[0.2em] text-ember-soft">
              {String(chapter + 1).padStart(2, "0")} / {String(CHAPTERS.length).padStart(2, "0")}
            </span>
            <span className="mt-0.5 block font-head text-xl font-bold text-text">{ch?.title}</span>
          </div>
          {ripples.map((r) => (
            <span key={r.id} className="present-ripple pointer-events-none fixed z-[86]" style={{ left: r.x, top: r.y }} aria-hidden />
          ))}
          {cursor && (
            <div className="present-cursor pointer-events-none fixed left-0 top-0 z-[87]" style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)`, transitionDuration: `${cursor.ms}ms` }} aria-hidden>
              <svg key={press} className="present-arrow" width="30" height="30" viewBox="0 0 24 24">
                <path d="M4 2l15 9.5-6.5 1.4L9.8 20z" fill="#fff4e8" stroke="#1a0d04" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
            </div>
          )}

          {subsOn && line && (
            <div className="pointer-events-none fixed inset-x-0 bottom-[70px] z-[85] flex justify-center px-4" aria-hidden>
              <p className="present-subs max-w-[900px] rounded-xl bg-[rgba(4,6,12,0.82)] px-5 py-2.5 text-center text-[17px] leading-relaxed sm:text-xl">
                {words.map((w, i) => (
                  <span key={`${titleKey}-${i}`} className={i < word ? "text-text" : i === word ? "text-ember-soft" : "text-text/45"}>
                    {w}{" "}
                  </span>
                ))}
              </p>
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            {ch?.title}. {line}
          </p>

          <div className="fixed inset-x-0 bottom-3 z-[88] flex justify-center px-3">
            <div className="present-bar flex items-center gap-1.5 rounded-full border border-[#2c3b5e] bg-[rgba(13,19,34,0.92)] px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <button type="button" onClick={togglePause} className="vesta-ctl h-9 w-9" aria-label={paused ? "Play" : "Pause"} title={paused ? "Play (Space)" : "Pause (Space)"}>
                {paused ? "▶" : "❚❚"}
              </button>
              <button type="button" onClick={() => void play(0)} className="vesta-ctl h-9 w-9" aria-label="Restart" title="Restart">
                ↺
              </button>
              <div className="mx-1 hidden items-center gap-1 sm:flex" role="group" aria-label="Chapters">
                {CHAPTERS.map((c, i) => (
                  <button key={c.id} type="button" onClick={() => void play(i)} title={c.title} aria-label={`Chapter ${i + 1}: ${c.title}`} aria-current={i === chapter ? "step" : undefined} className={`h-2.5 rounded-full transition-all ${i === chapter ? "w-6 bg-ember" : i < chapter ? "w-2.5 bg-ember/60" : "w-2.5 bg-line hover:bg-muted"}`} />
                ))}
              </div>
              <button type="button" onClick={() => setSubsOn((v) => !v)} aria-pressed={subsOn} className={`vesta-ctl h-9 w-9 font-mono text-[11px] font-bold ${subsOn ? "is-on" : ""}`} aria-label={subsOn ? "Hide subtitles" : "Show subtitles"} title="Subtitles">
                CC
              </button>
              <button type="button" onClick={toggleVoice} aria-pressed={voiceOn} className={`vesta-ctl h-9 w-9 ${voiceOn ? "is-on" : ""}`} aria-label={voiceOn ? "Mute voice" : "Turn voice on"} title="Voice">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                  <path d="M4 9h4l5-4v14l-5-4H4z" />
                  {voiceOn ? <path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" /> : <path d="M17 9l5 6M22 9l-5 6" />}
                </svg>
              </button>
              {recState === "on" && (
                <span className="flex items-center gap-1 px-1.5 font-mono text-[10px] font-bold text-bad" title="Recording">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-bad" aria-hidden /> REC
                </span>
              )}
              <button type="button" onClick={() => void exit()} className="vesta-ctl h-9 w-9" aria-label="Exit presentation" title="Exit (Esc)">
                ✕
              </button>
            </div>
          </div>

          {endCard && (
            <div className="present-end fixed inset-0 z-[84] grid place-items-center bg-[radial-gradient(circle_at_50%_45%,#101a35,rgba(4,6,12,0.97)_65%)] p-4">
              <div className="text-center">
                <div className="ls-orb mx-auto" aria-hidden />
                <h2 className="mt-5 font-head text-5xl font-bold tracking-[0.08em] sm:text-7xl">HEARTH</h2>
                <p className="mt-3 flex items-center justify-center gap-2 text-muted">
                  <PolarisMark size={14} /> by <b className="font-head tracking-[0.12em] text-text">TEAM POLARIS</b>
                </p>
                <p className="mt-1 font-mono text-[11px] tracking-[0.25em] text-muted">NASA SPACE APPS CHALLENGE 2026</p>
                {finished && (
                  <div className="mt-6 flex flex-col items-center gap-3">
                    {recState === "saved" && recFile && <p className="text-xs text-ok">Video saved to your downloads: {recFile}</p>}
                    {recState === "refused" && <p className="text-xs text-warn">Recording was not started (sharing was cancelled or is not supported here).</p>}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => void play(0)} className="btn-ghost">
                        Replay
                      </button>
                      <button type="button" onClick={() => void exit()} className="btn-ember px-5">
                        Back to HEARTH
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
