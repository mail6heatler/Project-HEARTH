"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PolarisMark } from "@/components/ui/Polaris";
import { curvePoint, easeInOutCubic, moveMs, phraseAt, phrases, spotBox, wordIndexOf, type Pt } from "@/lib/presenter/motion";
import { CHAPTERS, type Action } from "@/lib/presenter/script";
import { encodeWav, type LineTiming } from "@/lib/presenter/demo";
import { fillNarration, speechMs, type Facts } from "@/lib/presenter/timing";
import { useHearth, type VestaMessage } from "@/lib/store";
import type { EngineChoice } from "@/lib/vesta/engines";
import { renderSoundtrack, SoundLog, Soundscape, type SoundEvent, type SoundOut } from "./audio";
import { Narrator } from "./narrator";
import { startRecording, type Quality, type Recording } from "./recorder";
import { centerOf, ensureVisible, glow, hoverIn, hoverOut, isZoomed, press, pressKey, resolveTarget, settlePage, settleScroll, unzoom, waitForTarget, zoomTo } from "./stage";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const calm = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const MORPH_MS = 520;
const BAR_HIDE_MS = 2500;

interface Saved {
  missionId: string;
  engine: EngineChoice;
  level: ReturnType<typeof useHearth.getState>["level"];
  messages: VestaMessage[];
  highlightIds: string[];
  path: string;
}
type Phase = "card" | "countdown" | "playing";

/**
 * How `npm run demo:record` talks to the page (it opens `/?present=record` with this already on `window`):
 * it hands over the recorded voice's timing, waits for `ready`, sets `go`, and reads back what happened when.
 * Times are seconds on the page's clock, which the recorder moves on frame by frame.
 */
interface RecordBridge {
  voice: Record<string, LineTiming>;
  ready?: boolean;
  go?: boolean;
  done?: boolean;
  end?: number;
  chapters: { id: string; title: string; at: number }[];
  lines: { text: string; at: number }[];
  missing: string[];
  events?: SoundEvent[];
  renderSound?: (events: SoundEvent[], seconds: number) => Promise<string>;
}

const bridgeOf = () => (typeof window !== "undefined" ? (window as unknown as { __hearthRec?: RecordBridge }).__hearthRec : undefined);

/** Bytes to base64, in chunks (a long track would overflow one call). */
function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...Array.from(bytes.subarray(i, i + 0x8000)));
  return btoa(s);
}

/**
 * The live presentation (the backup to the recorded demo at `?present=live`, and what `npm run demo:record`
 * films at `?present=record`): an automated presentation over the real site. A presenter cursor glides on curves
 * and clicks (hover glow, press, ripple, tick), the camera zooms and drifts, a spotlight locks onto each feature,
 * pages change behind a soft curtain, VESTA really answers (Offline mode: no failures, no tokens), and Team
 * Polaris narrates with the browser's voice, phrase subtitles, sound effects and an ambient pad. Optional
 * recording with a countdown. Cinema mode hides the real pointer and extras. Everything is restored afterwards.
 */
export function Presenter() {
  const router = useRouter();
  const open = useHearth((s) => s.liveOpen);
  const setOpen = useHearth((s) => s.setLiveOpen);
  const presenting = useHearth((s) => s.presenting);

  // choices on the start card
  const [voiceOn, setVoiceOn] = useState(true);
  const [subsOn, setSubsOn] = useState(true);
  const [sfxOn, setSfxOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [letterbox, setLetterbox] = useState(false);
  const [recordOn, setRecordOn] = useState(false);
  const [quality, setQuality] = useState<Quality>("1080p");

  const [phase, setPhase] = useState<Phase>("card");
  const [count, setCount] = useState(3);
  const [chapter, setChapter] = useState(0);
  const [word, setWord] = useState(-1);
  const [line, setLine] = useState("");
  const [paused, setPaused] = useState(false);
  const [curtain, setCurtain] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [pressKeyN, setPressKeyN] = useState(0);
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const [titleKey, setTitleKey] = useState(0);
  const [endCard, setEndCard] = useState(false);
  const [finished, setFinished] = useState(false);
  const [barShown, setBarShown] = useState(true);
  const [recState, setRecState] = useState<"off" | "on" | "saved" | "refused">("off");
  const [recFile, setRecFile] = useState<string | null>(null);
  /** Being filmed by `npm run demo:record`: no controls, no subtitles, sound written down instead of played. */
  const [filming, setFilming] = useState(false);

  const cursorEl = useRef<HTMLDivElement>(null);
  const spotEl = useRef<HTMLDivElement>(null);
  const morphTimer = useRef<ReturnType<typeof setTimeout>>();
  const cursorPos = useRef<Pt>({ x: 0, y: 0 });
  const bendSign = useRef(1);
  const narrator = useRef<Narrator | null>(null);
  const sound = useRef<SoundOut | null>(null);
  const bridge = useRef<RecordBridge | null>(null);
  const filmRef = useRef<(() => Promise<void>) | null>(null);
  /** Filming: page changes are a quick cut (nothing is ever still loading on film). */
  const quick = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const saved = useRef<Saved | null>(null);
  const facts = useRef<Facts>({});
  const recording = useRef<Recording | null>(null);
  const pausedRef = useRef(false);
  const spotTarget = useRef<{ el: Element; pad: number } | null>(null);
  const wordRef = useRef(-1);
  const lineRef = useRef("");
  const chapterStart = useRef(0);
  const rippleId = useRef(0);
  const barTimer = useRef<ReturnType<typeof setTimeout>>();

  // ?present=live opens the start card; ?present=record is the recorder filming the show
  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("present");
    if (mode === "live") setOpen(true);
    else if (mode === "record" && bridgeOf()) void filmRef.current?.();
  }, [setOpen]);

  // cinema mode: hide the real pointer, scrollbars and decorative extras while presenting
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("presenting", presenting);
    root.classList.toggle("present-letterbox", presenting && letterbox);
    return () => root.classList.remove("presenting", "present-letterbox");
  }, [presenting, letterbox]);

  // the spotlight locks onto its element every frame, written straight to the page in the same frame as the
  // target moves (no React render in between); it only animates while moving to a new target
  useEffect(() => {
    if (!presenting) return;
    let raf = 0;
    let last = "";
    const tick = () => {
      const node = spotEl.current;
      const t = spotTarget.current;
      const r = t && t.el.isConnected ? t.el.getBoundingClientRect() : null;
      // with cinema bars on, the spotlight stays in the picture between them
      const lb = document.querySelector<HTMLElement>(".present-bars")?.offsetHeight ?? 0;
      const fit = t && r ? spotBox({ x: r.left, y: r.top - lb, w: r.width, h: r.height }, t.pad, window.innerWidth, window.innerHeight - 2 * lb) : null;
      const box = fit ? { ...fit, y: fit.y + lb } : null;
      if (node) {
        if (box && t) {
          const radius = Math.min(26, (parseFloat(getComputedStyle(t.el).borderTopLeftRadius) || 8) + t.pad);
          const key = `${box.x},${box.y},${box.w},${box.h},${radius}`;
          if (key !== last) {
            last = key;
            node.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
            node.style.width = `${box.w}px`;
            node.style.height = `${box.h}px`;
            node.style.borderRadius = `${radius}px`;
          }
          node.classList.add("is-on");
        } else {
          node.classList.remove("is-on");
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [presenting]);

  // the control bar hides while it plays and comes back when the real mouse moves
  const showBar = useCallback(() => {
    setBarShown(true);
    if (barTimer.current) clearTimeout(barTimer.current);
    barTimer.current = setTimeout(() => {
      if (!pausedRef.current) setBarShown(false);
    }, BAR_HIDE_MS);
  }, []);
  useEffect(() => {
    if (!presenting) return;
    const onMove = (e: PointerEvent) => e.isTrusted && showBar();
    window.addEventListener("pointermove", onMove);
    showBar();
    return () => window.removeEventListener("pointermove", onMove);
  }, [presenting, showBar]);

  const gate = useCallback(async (signal: AbortSignal) => {
    while (pausedRef.current && !signal.aborted) await sleep(120);
  }, []);

  const wait = useCallback(async (ms: number, signal: AbortSignal) => {
    let left = ms;
    while (left > 0 && !signal.aborted) {
      await sleep(100);
      if (!pausedRef.current) left -= 100;
    }
  }, []);

  const placeCursor = (p: Pt) => {
    cursorPos.current = p;
    if (cursorEl.current) cursorEl.current.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
  };

  /** Glides the cursor along a gentle curve with a smooth start and stop. */
  const moveTo = useCallback((to: Pt) => {
    const from = { ...cursorPos.current };
    if (calm()) {
      placeCursor(to);
      return sleep(60);
    }
    const ms = moveMs(from, to);
    bendSign.current *= -1;
    const bend = 0.12 * bendSign.current;
    return new Promise<void>((resolve) => {
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / ms);
        placeCursor(curvePoint(from, to, easeInOutCubic(k), bend));
        if (k < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }, []);

  /** A human click: arrive, the target glows, the cursor presses, the button sinks, ripple and tick, then the click. */
  const clickAt = useCallback(async (el: HTMLElement) => {
    glow(el, true);
    await sleep(calm() ? 0 : 200);
    const c = centerOf(el);
    setPressKeyN((n) => n + 1);
    const id = ++rippleId.current;
    setRipples((r) => [...r.slice(-3), { id, x: c.x, y: c.y }]);
    setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 900);
    sound.current?.click();
    await press(el);
    glow(el, false);
    el.click();
    await sleep(calm() ? 0 : 120);
  }, []);

  /** Points the spotlight at an element (null clears it). Moving to a new target morphs; then it locks on. */
  const spotOn = useCallback((el: Element | null, pad = 8) => {
    const prev = spotTarget.current?.el;
    // marked so the spotlight can be checked against its target
    prev?.removeAttribute("data-present-spot");
    el?.setAttribute("data-present-spot", String(pad));
    const node = spotEl.current;
    if (el && prev !== el && node && prev) {
      node.classList.add("is-morph");
      if (morphTimer.current) clearTimeout(morphTimer.current);
      morphTimer.current = setTimeout(() => node.classList.remove("is-morph"), MORPH_MS);
    }
    spotTarget.current = el ? { el, pad } : null;
  }, []);

  /** A soft curtain hides a page change until the new page has finished drawing. */
  const turnPage = useCallback(async (path: string, signal: AbortSignal, navigate?: () => void) => {
    if (isZoomed()) await unzoom();
    setCurtain(true);
    sound.current?.whoosh();
    spotOn(null);
    await sleep(calm() ? 0 : quick.current ? 200 : 280);
    navigate?.();
    const end = Date.now() + 9000;
    while (!signal.aborted && Date.now() < end && window.location.pathname !== path) await sleep(quick.current ? 40 : 100);
    await settlePage(signal, 2600, quick.current);
    window.scrollTo({ top: 0, behavior: "auto" });
    await sleep(quick.current ? 40 : 120);
    setCurtain(false);
    await sleep(calm() ? 0 : 380);
  }, [spotOn]);

  /** Holds until the narrator reaches a word (or the time it should have, if the voice reports no words). */
  const cue = useCallback(async (w: string, signal: AbortSignal) => {
    const text = lineRef.current;
    const idx = wordIndexOf(text, w);
    if (idx < 0) return;
    const words = text.trim().split(/\s+/).length;
    const due = chapterStart.current + (narrator.current ? narrator.current.expectedAt(text, idx) : (speechMs(text) * idx) / words) + 600;
    while (!signal.aborted && wordRef.current < idx && Date.now() < due) await sleep(60);
  }, []);

  const run = useCallback(
    async (a: Action, signal: AbortSignal) => {
      const st = useHearth.getState;
      switch (a.do) {
        case "launch": {
          st().setLanding(true);
          await sleep(900);
          const btn = await waitForTarget(".ls-cta", signal, 3000);
          if (!btn) return;
          await moveTo(centerOf(btn));
          // hold on the button until the narration reaches its word, so the dashboard arrives as the line ends
          if (a.cue) {
            glow(btn, true);
            await cue(a.cue, signal);
          }
          await clickAt(btn);
          sound.current?.whoosh();
          const end = Date.now() + 6000;
          while (!signal.aborted && st().landing && Date.now() < end) await sleep(100);
          return;
        }
        case "go":
          return turnPage(a.path, signal, () => router.push(a.path));
        case "nav": {
          if (isZoomed()) await unzoom();
          const link = await waitForTarget(`nav[aria-label="Main"] a[href="${a.path}"]`, signal, 2000);
          if (link) {
            await moveTo(centerOf(link));
            await clickAt(link);
            return turnPage(a.path, signal);
          }
          return turnPage(a.path, signal, () => router.push(a.path));
        }
        case "move":
        case "click": {
          const el = await waitForTarget(a.do === "move" ? a.to : a.on, signal);
          if (!el) return;
          await ensureVisible(el, calm());
          await moveTo(centerOf(el));
          if (a.do === "click") await clickAt(el);
          return;
        }
        case "hover": {
          const el = await waitForTarget(a.on, signal, 2500);
          if (!el) return;
          await ensureVisible(el, calm());
          await moveTo(centerOf(el));
          glow(el, true);
          hoverIn(el);
          await wait(a.ms ?? 1200, signal);
          hoverOut(el);
          glow(el, false);
          return;
        }
        case "ask": {
          // the camera pulls back first so the whole question box is in the picture
          if (isZoomed()) await unzoom();
          const box = (await waitForTarget("#vesta-input", signal)) as HTMLTextAreaElement | null;
          if (!box) return;
          await ensureVisible(box, calm());
          const c = centerOf(box);
          await moveTo({ x: c.x - 70, y: c.y });
          await clickAt(box);
          box.focus({ preventScroll: true });
          for (let i = 1; i <= a.text.length && !signal.aborted; i++) {
            st().setDraft(a.text.slice(0, i));
            if (calm()) continue;
            // a human rhythm: quick within words, a beat between them
            await sleep(a.text[i - 1] === " " ? 70 + Math.random() * 60 : 26 + Math.random() * 34);
          }
          await sleep(220);
          const send = resolveTarget('button[aria-label="Send to VESTA"]');
          if (send) {
            await moveTo(centerOf(send));
            glow(send, true);
            await sleep(150);
            setPressKeyN((n) => n + 1);
            sound.current?.click();
            await press(send);
            glow(send, false);
          }
          pressKey(box, "Enter");
          return;
        }
        case "waitVesta": {
          const start = Date.now();
          while (!signal.aborted && !st().busy && Date.now() - start < 1500) await sleep(80);
          while (!signal.aborted && st().busy && Date.now() - start < 25_000) await sleep(120);
          await sleep(400);
          return;
        }
        case "waitPath": {
          // VESTA moved the page herself: cover the jump the same way
          const end = Date.now() + 9000;
          while (!signal.aborted && Date.now() < end && window.location.pathname !== a.path) await sleep(80);
          if (isZoomed()) await unzoom(true);
          setCurtain(true);
          sound.current?.whoosh();
          spotOn(null);
          await sleep(quick.current ? 200 : 0);
          await settlePage(signal, 2600, quick.current);
          window.scrollTo({ top: 0, behavior: "auto" });
          await sleep(quick.current ? 40 : 120);
          setCurtain(false);
          await sleep(calm() ? 0 : 380);
          return;
        }
        case "spot": {
          const el = await waitForTarget(a.on, signal, 3000);
          if (el) await ensureVisible(el, calm());
          spotOn(el, a.pad ?? 8);
          return;
        }
        case "unspot":
          spotOn(null);
          return;
        case "zoom": {
          const el = await waitForTarget(a.on, signal, 2000);
          if (el) await zoomTo(el, a.scale ?? 1.1, calm());
          return;
        }
        case "unzoom":
          return unzoom();
        case "scroll": {
          const el = await waitForTarget(a.to, signal, 2500);
          if (!el) return;
          el.scrollIntoView({ behavior: calm() ? "auto" : "smooth", block: "center" });
          await settleScroll(calm());
          return;
        }
        case "key":
          pressKey(document.activeElement ?? document.body, a.key);
          pressKey(document, a.key);
          await sleep(250);
          return;
        case "cue":
          return cue(a.word, signal);
        case "wait":
          return wait(a.ms, signal);
        case "end":
          if (isZoomed()) await unzoom(true);
          spotOn(null);
          setEndCard(true);
          return;
      }
    },
    [router, moveTo, clickAt, turnPage, cue, wait, spotOn],
  );

  const restore = useCallback(async () => {
    const st = useHearth.getState();
    await unzoom(true);
    spotOn(null);
    setCurtain(false);
    setBlackout(false);
    sound.current?.stop();
    sound.current = null;
    const s = saved.current;
    saved.current = null;
    st.setPresenting(false);
    st.setLanding(false);
    st.openTest(null);
    st.setRoomOpen(false);
    st.setDraft("");
    setPhase("card");
    if (!s) return;
    st.setEngine(s.engine);
    st.setLevel(s.level);
    st.setMission(s.missionId);
    if (window.location.pathname !== s.path) router.push(s.path);
    // the mission change posts its alert after a moment: put the visitor's own chat back after that
    await sleep(450);
    useHearth.getState().setMessages(s.messages);
    useHearth.getState().setHighlight(s.highlightIds);
  }, [router, spotOn]);

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
      if (from === 0 && !calm()) {
        // fade in from black
        setBlackout(true);
        await sleep(350);
        setBlackout(false);
      }
      for (let i = from; i < CHAPTERS.length && !signal.aborted; i++) {
        await gate(signal);
        const ch = CHAPTERS[i];
        setChapter(i);
        setTitleKey((k) => k + 1);
        spotOn(null);
        const text = fillNarration(ch.say, facts.current);
        lineRef.current = text;
        wordRef.current = -1;
        chapterStart.current = Date.now();
        const b = bridge.current;
        if (b) {
          const at = performance.now() / 1000;
          b.chapters.push({ id: ch.id, title: ch.title, at });
          b.lines.push({ text, at });
          if (!b.voice[text]) b.missing.push(text);
        }
        setLine(text);
        setWord(-1);
        const onWord = (n: number) => {
          wordRef.current = n;
          setWord(n);
        };
        const speech = narrator.current ? narrator.current.speak(text, onWord, signal) : Promise.resolve();
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
      }
      if (signal.aborted) return;
      await sleep(1200);
      const b = bridge.current;
      if (b) {
        b.end = performance.now() / 1000;
        b.events = sound.current instanceof SoundLog ? sound.current.events : [];
        b.done = true;
        return;
      }
      setFinished(true);
      setBarShown(true);
      await stopRecording();
    },
    [gate, run, stopRecording, spotOn],
  );

  const start = async () => {
    // recording must start straight from this click: the browser asks what to share
    let rec: Recording | null = null;
    if (recordOn) {
      rec = await startRecording(quality);
      setRecState(rec ? "on" : "refused");
      if (rec) {
        recording.current = rec;
        rec.onEnded(() => void stopRecording());
      }
    } else setRecState("off");
    setRecFile(null);
    const n = new Narrator(voiceOn);
    narrator.current = n;
    const s = new Soundscape(sfxOn, musicOn);
    sound.current = s;
    s.start();
    n.onSpeaking = (on) => s.duck(on);
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
    pausedRef.current = false;
    setPaused(false);
    setTimeout(() => placeCursor({ x: window.innerWidth / 2, y: window.innerHeight - 160 }), 0);
    if (rec && !calm()) {
      // a 3 · 2 · 1 countdown that is not in the video
      setPhase("countdown");
      for (const c of [3, 2, 1]) {
        setCount(c);
        await sleep(800);
      }
    }
    rec?.begin();
    setPhase("playing");
    void play(0);
  };

  /** Filmed by `npm run demo:record`: the same show on the recorded voice's timing, sound written down. */
  filmRef.current = async () => {
    const b = bridgeOf();
    if (!b || bridge.current) return;
    bridge.current = b;
    b.renderSound = async (events, seconds) => {
      const rate = 48_000;
      return toBase64(encodeWav([await renderSoundtrack(events, seconds, rate)], rate));
    };
    setFilming(true);
    quick.current = true;
    setSubsOn(false);
    setLetterbox(false);
    const n = new Narrator(true, b.voice);
    narrator.current = n;
    const s = new SoundLog();
    sound.current = s;
    b.events = s.events;
    n.onSpeaking = (on) => s.duck(on);
    const st = useHearth.getState();
    try {
      const r = await fetch("/api/tests?page_size=1");
      const j = r.ok ? await r.json() : null;
      facts.current = { tests: typeof j?.total === "number" ? j.total : undefined };
    } catch {
      facts.current = {};
    }
    st.setPresenting(true);
    st.setEngine("offline");
    st.setLevel("researcher");
    st.setMessages([]);
    st.setDraft("");
    st.setRoomOpen(false);
    st.requestOpen();
    placeCursor({ x: window.innerWidth / 2, y: window.innerHeight - 160 });
    b.ready = true;
    while (!b.go) await sleep(50);
    setPhase("playing");
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

  const togglePause = useCallback(() => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    setBarShown(true);
    if (next) narrator.current?.pause();
    else narrator.current?.resume();
  }, []);

  const toggleVoice = () => {
    const next = !voiceOn;
    setVoiceOn(next);
    narrator.current?.setVoice(next);
  };

  const soundOn = sfxOn || musicOn;
  const toggleSound = () => {
    const next = !soundOn;
    setSfxOn(next);
    setMusicOn(next);
    sound.current?.setSfx(next);
    sound.current?.setMusic(next);
  };

  // Esc leaves, Space pauses (keys the presentation itself sends are not "trusted" and are ignored)
  useEffect(() => {
    if (!presenting && !open) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.isTrusted) return;
      if (e.key === "Escape") {
        if (open && !presenting) setOpen(false);
        else void exit();
      } else if (e.key === " " && presenting && !(e.target as HTMLElement)?.closest("input, textarea, button")) {
        e.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [presenting, open, exit, setOpen, togglePause]);

  useEffect(() => () => abort.current?.abort(), []);

  const ch = CHAPTERS[chapter];
  const words = line.split(/\s+/).filter(Boolean);
  const list = phrases(line);
  const pIdx = phraseAt(list, word);
  const [pa, pb] = list[pIdx] ?? [0, -1];
  const small = typeof window !== "undefined" && window.innerWidth < 1180;

  const options: [string, string, boolean, (v: boolean) => void][] = [
    ["Voice", "Team Polaris narrates with your browser's voice", voiceOn, setVoiceOn],
    ["Subtitles", "The narration as text at the bottom", subsOn, setSubsOn],
    ["Sound effects", "Soft clicks and page whooshes", sfxOn, setSfxOn],
    ["Background music", "A quiet space-ambient pad that softens under the voice", musicOn, setMusicOn],
    ["Cinema bars", "Thin black bars at the top and bottom", letterbox, setLetterbox],
    ["Record a video", "Your browser asks what to share; the video downloads at the end", recordOn, setRecordOn],
  ];

  return (
    <>
      {open && !presenting && phase === "card" && (
        <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-bg/80 p-4" role="dialog" aria-modal="true" aria-labelledby="present-h">
          <div className="present-card w-full max-w-md rounded-2xl border border-[#2c3b5e] bg-panel p-6 shadow-[0_30px_80px_rgba(0,0,0,0.6)]">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember-soft">Team Polaris presents</p>
            <h2 id="present-h" className="mt-1 font-head text-2xl font-bold">
              See HEARTH in action
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">A short guided run through every part of HEARTH, with VESTA answering live. Choose how you want it:</p>
            <div className="mt-4 grid gap-1.5">
              {options.map(([label, hint, on, set]) => (
                <label key={label} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-raised/60 px-3 py-2">
                  <span>
                    <span className="block text-sm font-medium text-text">{label}</span>
                    <span className="block text-[11px] text-muted">{hint}</span>
                  </span>
                  <input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} className="h-5 w-5 shrink-0 accent-[var(--ember)]" />
                </label>
              ))}
            </div>
            {recordOn && (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-text">Video quality</span>
                  <span className="flex gap-1" role="radiogroup" aria-label="Video quality">
                    {(["720p", "1080p"] as Quality[]).map((q) => (
                      <button key={q} type="button" role="radio" aria-checked={quality === q} onClick={() => setQuality(q)} className={`rounded-md border px-2.5 py-1 font-mono text-xs ${quality === q ? "border-ember bg-ember/15 text-ember-soft" : "border-line text-muted"}`}>
                        {q} · 60 fps
                      </button>
                    ))}
                  </span>
                </div>
                <p className="rounded-lg border border-warn/40 bg-warn/10 p-2.5 text-[11px] leading-snug text-warn">
                  To keep the voice in the video, share <b>Entire screen</b> and tick <b>Share system audio</b>. Sharing only this tab may record the picture without the voice. A 3-second countdown runs before recording starts.
                </p>
              </div>
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
          {letterbox && (
            <>
              <div className="present-bars top-0" aria-hidden />
              <div className="present-bars bottom-0" aria-hidden />
            </>
          )}
          <div ref={spotEl} className="present-spot pointer-events-none fixed left-0 top-0 z-[75]" aria-hidden />
          <div className={`present-curtain pointer-events-none fixed inset-0 z-[82] ${curtain ? "is-on" : ""}`} aria-hidden>
            <span className="present-sweep" />
          </div>
          <div className={`pointer-events-none fixed inset-0 z-[89] bg-black transition-opacity duration-1000 ${blackout ? "opacity-100" : "opacity-0"}`} aria-hidden />
          <div key={titleKey} className="present-title pointer-events-none fixed bottom-[136px] left-6 z-[85]" aria-hidden>
            <span className="font-mono text-[11px] tracking-[0.2em] text-ember-soft">
              {String(chapter + 1).padStart(2, "0")} / {String(CHAPTERS.length).padStart(2, "0")}
            </span>
            <span className="mt-0.5 block font-head text-xl font-bold text-text">{ch?.title}</span>
          </div>
          {ripples.map((r) => (
            <span key={r.id} className="present-ripple pointer-events-none fixed z-[86]" style={{ left: r.x, top: r.y }} aria-hidden />
          ))}
          <div ref={cursorEl} className={`present-cursor pointer-events-none fixed left-0 top-0 z-[87] transition-opacity duration-700 ${endCard ? "opacity-0" : ""}`} aria-hidden>
            <svg key={pressKeyN} className="present-arrow" width="30" height="30" viewBox="0 0 24 24">
              <path d="M4 2l15 9.5-6.5 1.4L9.8 20z" fill="#fff4e8" stroke="#1a0d04" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
          </div>

          {subsOn && line && pb >= pa && (
            <div className="pointer-events-none fixed inset-x-0 bottom-[76px] z-[85] flex justify-center px-4" aria-hidden>
              <p key={`${titleKey}-${pIdx}`} className="present-subs max-w-[860px] rounded-xl bg-[rgba(4,6,12,0.8)] px-5 py-2 text-center text-[18px] leading-snug sm:text-[21px]">
                {words.slice(pa, pb + 1).map((w, i) => {
                  const n = pa + i;
                  return (
                    <span key={n} className={n < word ? "text-text" : n === word ? "text-ember-soft" : "text-text/50"}>
                      {w}{" "}
                    </span>
                  );
                })}
              </p>
            </div>
          )}
          <p className="sr-only" aria-live="polite">
            {ch?.title}. {line}
          </p>

          <div className={`present-dock fixed inset-x-0 bottom-3 z-[88] flex justify-center px-3 ${filming ? "hidden" : ""} ${barShown || paused || finished ? "is-shown" : ""}`} onPointerEnter={showBar}>
            <div className="present-bar flex items-center gap-1.5 rounded-full border border-[#2c3b5e] bg-[rgba(13,19,34,0.92)] px-2 py-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
              <button type="button" onClick={togglePause} className="vesta-ctl h-9 w-9" aria-label={paused ? "Play" : "Pause"} title={paused ? "Play (Space)" : "Pause (Space)"}>
                {paused ? "▶" : "❚❚"}
              </button>
              <button type="button" onClick={() => void play(0)} className="vesta-ctl h-9 w-9" aria-label="Restart" title="Restart">
                ↺
              </button>
              <div className="mx-1 hidden items-center gap-1 sm:flex" role="group" aria-label="Chapters">
                {CHAPTERS.map((c, i) => (
                  <button key={c.id} type="button" onClick={() => void play(i)} title={c.title} aria-label={`Chapter ${i + 1}: ${c.title}`} aria-current={i === chapter ? "step" : undefined} className={`h-2.5 rounded-full transition-all duration-500 ${i === chapter ? "w-6 bg-ember" : i < chapter ? "w-2.5 bg-ember/60" : "w-2.5 bg-line hover:bg-muted"}`} />
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
              <button type="button" onClick={toggleSound} aria-pressed={soundOn} className={`vesta-ctl h-9 w-9 ${soundOn ? "is-on" : ""}`} aria-label={soundOn ? "Mute music and sound effects" : "Turn music and sound effects on"} title="Music and sound effects">
                ♪
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

      {phase === "countdown" && (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black" aria-live="assertive">
          <div className="text-center">
            <p className="font-mono text-xs tracking-[0.3em] text-muted">RECORDING STARTS IN</p>
            <p key={count} className="present-count mt-2 font-head text-[140px] font-bold leading-none text-ember-soft">
              {count}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
