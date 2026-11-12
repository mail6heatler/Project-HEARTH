"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { chapterAt, clock, cueAt, DEMO_DIR, DEMO_MANIFEST, formatBytes, parseManifest, steer, wordAt, type DemoManifest } from "@/lib/presenter/demo";
import { useHearth } from "@/lib/store";

type Stage = "card" | "playing" | "ended";
type Load = { state: "loading" } | { state: "ready"; m: DemoManifest } | { state: "missing" };

const HIDE_MS = 2500;
const src = (file: string) => `${DEMO_DIR}/${file}`;

/**
 * "See HEARTH in action": the recorded demo (made by `npm run demo:record` from the real site, so it plays
 * smoothly every time). The narration and the music + sound effects are separate tracks kept in step with the
 * picture, so each can be switched off; subtitles are timed to the voice word by word. If the recording is
 * missing or will not play, the live presentation is offered instead: the site never shows a broken player.
 */
export function DemoPlayer() {
  const open = useHearth((s) => s.presenterOpen);
  const setOpen = useHearth((s) => s.setPresenterOpen);
  const setLiveOpen = useHearth((s) => s.setLiveOpen);
  const presenting = useHearth((s) => s.presenting);

  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [stage, setStage] = useState<Stage>("card");
  const [voiceOn, setVoiceOn] = useState(true);
  const [subsOn, setSubsOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [barShown, setBarShown] = useState(true);
  const [broken, setBroken] = useState(false);
  const [full, setFull] = useState(false);
  /** A separate track failed to load: play the sound mixed into the video instead (one switch for all sound). */
  const [mixed, setMixed] = useState(false);

  const shell = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const voice = useRef<HTMLAudioElement>(null);
  const music = useRef<HTMLAudioElement>(null);
  const playBtn = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();
  const retried = useRef(new Set<HTMLAudioElement>());

  // ?present (or ?present=1) opens it; ?present=live and ?present=record belong to the live presentation
  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("present");
    if (mode !== null && mode !== "live" && mode !== "record") setOpen(true);
  }, [setOpen]);

  // read the manifest the first time it is opened
  useEffect(() => {
    if (!open || load.state !== "loading") return;
    let alive = true;
    fetch(DEMO_MANIFEST, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        const m = parseManifest(j);
        setLoad(m ? { state: "ready", m } : { state: "missing" });
      })
      .catch(() => alive && setLoad({ state: "missing" }));
    return () => {
      alive = false;
    };
  }, [open, load.state]);

  const m = load.state === "ready" ? load.m : null;
  const separate = !!(m?.voice && m?.music) && !mixed;
  const tracks = () => [voice.current, music.current].filter((a): a is HTMLAudioElement => !!a);

  /** A track failed to load: try it once more (sync() puts it back in step), then fall back to the mixed sound. */
  const onTrackError = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const a = e.currentTarget;
    if (!retried.current.has(a)) {
      retried.current.add(a);
      a.load();
      return;
    }
    setMixed(true);
  };

  /** Keeps the voice and music in step with the picture (gently, see `steer`), and restarts one that stopped by itself. */
  const sync = useCallback((force = false) => {
    const v = video.current;
    if (!v) return;
    for (const a of [voice.current, music.current]) {
      if (!a) continue;
      const s = force ? { jump: true, rate: 1 } : steer(v.currentTime - a.currentTime);
      if (s.jump) a.currentTime = v.currentTime;
      if (a.playbackRate !== s.rate) a.playbackRate = s.rate;
      if (!v.paused && !v.ended && v.readyState >= 3 && a.paused && !a.ended) void a.play().catch(() => {});
    }
  }, []);

  const close = useCallback(() => {
    video.current?.pause();
    tracks().forEach((a) => a.pause());
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    setStage("card");
    setPlaying(false);
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setOpen]);

  const goLive = () => {
    close();
    setLiveOpen(true);
  };

  /** Starts from a moment (straight from a click, so the browser lets the sound play). */
  const playFrom = (at?: number) => {
    const v = video.current;
    if (!v) return;
    if (at !== undefined) {
      v.currentTime = at;
      tracks().forEach((a) => (a.currentTime = at));
    }
    setStage("playing");
    void v.play().catch(() => setBroken(true));
    tracks().forEach((a) => void a.play().catch(() => {}));
  };

  const togglePlay = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) playFrom(stage === "ended" ? 0 : undefined);
    else v.pause();
  };

  const seek = (to: number) => {
    const v = video.current;
    if (!v || !m) return;
    const at = Math.max(0, Math.min(m.duration - 0.05, to));
    v.currentTime = at;
    tracks().forEach((a) => (a.currentTime = at));
    setT(at);
    if (stage === "ended") setStage("playing");
  };

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else void shell.current?.requestFullscreen?.().catch(() => {});
  };

  // the picture leads; the voice and music follow it
  useEffect(() => {
    const v = video.current;
    if (!v || !m) return;
    const onPlay = () => {
      setPlaying(true);
      sync(true);
      tracks().forEach((a) => void a.play().catch(() => {}));
    };
    const onPause = () => {
      setPlaying(false);
      tracks().forEach((a) => a.pause());
    };
    const onWaiting = () => tracks().forEach((a) => a.pause());
    const onSeek = () => sync(true);
    const onEnded = () => {
      setPlaying(false);
      tracks().forEach((a) => a.pause());
      setStage("ended");
    };
    const onError = () => setBroken(true);
    v.addEventListener("play", onPlay);
    v.addEventListener("playing", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("seeked", onSeek);
    v.addEventListener("ended", onEnded);
    v.addEventListener("error", onError);
    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("playing", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("seeked", onSeek);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("error", onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m, sync, open]);

  // a smooth clock for word-by-word subtitles, plus a gentle drift check
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = -1;
    let checked = 0;
    const tick = (now: number) => {
      const v = video.current;
      if (v) {
        const tenth = Math.floor(v.currentTime * 20);
        if (tenth !== last) {
          last = tenth;
          setT(v.currentTime);
        }
        if (now - checked > 250) {
          checked = now;
          sync();
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, sync]);

  // switching a track off just mutes it, so it stays in step
  useEffect(() => {
    if (voice.current) voice.current.muted = !voiceOn;
    if (music.current) music.current.muted = !musicOn;
    if (video.current) video.current.muted = separate || !(voiceOn || musicOn);
  }, [voiceOn, musicOn, separate, stage]);

  // while the video is on screen the page behind it is not drawn and its animations rest, so even a modest
  // computer decodes the video without stutter (headless tests stalled every few seconds before this)
  const watching = open && !presenting && stage !== "card";
  useEffect(() => {
    if (!watching) return;
    const root = document.documentElement;
    root.classList.add("demo-watching");
    return () => root.classList.remove("demo-watching");
  }, [watching]);

  // controls hide while it plays and come back when the mouse moves
  const showBar = useCallback(() => {
    setBarShown(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setBarShown(false), HIDE_MS);
  }, []);

  // keys, page scroll, fullscreen state, and focus on the play button when the card opens
  useEffect(() => {
    if (!open || presenting) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === "Escape") {
        if (!document.fullscreenElement) close();
        return;
      }
      if (stage === "card" || tag === "INPUT") return;
      if (e.key === " " || e.key === "k") {
        if (tag === "BUTTON") return;
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") seek((video.current?.currentTime ?? 0) + 5);
      else if (e.key === "ArrowLeft") seek((video.current?.currentTime ?? 0) - 5);
      else if (e.key === "f") toggleFull();
      else if (e.key === "c") setSubsOn((v) => !v);
      else return;
      showBar();
    };
    const onFull = () => setFull(!!document.fullscreenElement);
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFull);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFull);
      document.documentElement.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, presenting, stage, close, showBar]);

  useEffect(() => {
    if (open && stage === "card") playBtn.current?.focus();
  }, [open, stage, load.state]);

  if (!open || presenting) return null;

  const ch = m ? chapterAt(m.chapters, t) : 0;
  const cue = m && subsOn && stage === "playing" ? cueAt(m.cues, t) : null;
  const said = cue ? wordAt(cue, t) : -1;
  const recorded = m?.recordedAt ? new Date(m.recordedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null;
  const options: [string, string, boolean, (v: boolean) => void][] = [
    ["Voice", m?.voiceName ? `Narrated by ${m.voiceName.replace(/\s*\(.*\)$/, "")}` : "The narration", voiceOn, setVoiceOn],
    ["Subtitles", "The narration as text, word by word", subsOn, setSubsOn],
    ["Music and sound effects", "A quiet space-ambient pad, clicks and whooshes", musicOn, setMusicOn],
  ];
  const ctl = "vesta-ctl h-9 w-9 shrink-0";

  return (
    <div ref={shell} className={`fixed inset-0 z-[90] text-text ${stage === "card" ? "bg-black/95" : "bg-black"}`} role="dialog" aria-modal="true" aria-labelledby="demo-h" onPointerMove={stage !== "card" ? showBar : undefined}>
      {m && (
        <div className={`absolute inset-0 grid place-items-center ${stage === "card" ? "pointer-events-none opacity-0" : "opacity-100"} transition-opacity duration-500`}>
          <div className="relative aspect-video w-[min(100vw,calc(100vh*16/9))]" onClick={() => stage !== "card" && togglePlay()}>
            <video ref={video} className="h-full w-full bg-black" src={src(m.video)} poster={m.poster ? src(m.poster) : undefined} preload="metadata" playsInline muted />
            {cue && (
              <div className="pointer-events-none absolute inset-x-0 bottom-[7%] flex justify-center px-4" aria-hidden>
                <p className="max-w-[78%] rounded-xl bg-[rgba(4,6,12,0.8)] px-4 py-1.5 text-center text-[clamp(14px,2vw,24px)] leading-snug">
                  {cue.words.map((w, i) => (
                    <span key={`${cue.start}-${i}`} className={i < said ? "text-text" : i === said ? "text-ember-soft" : "text-text/50"}>
                      {w.text}{" "}
                    </span>
                  ))}
                </p>
              </div>
            )}
            {stage === "ended" && (
              <div className="absolute inset-0 grid place-items-end justify-center bg-gradient-to-t from-black/80 via-transparent to-transparent pb-[12%]" onClick={(e) => e.stopPropagation()}>
                <div className="flex flex-wrap justify-center gap-2">
                  <button type="button" onClick={() => playFrom(0)} className="btn-ghost">
                    ↺ Replay
                  </button>
                  <a href={src(m.video)} download="HEARTH-by-Team-Polaris.mp4" className="btn-ghost">
                    ⤓ Download video
                  </a>
                  <button type="button" onClick={close} className="btn-ember px-5">
                    Back to HEARTH
                  </button>
                </div>
              </div>
            )}
          </div>
          {separate && (
            <>
              <audio ref={voice} src={src(m.voice!)} preload="auto" onError={onTrackError} />
              <audio ref={music} src={src(m.music!)} preload="auto" onError={onTrackError} />
            </>
          )}
          <p className="sr-only" aria-live="polite">
            {stage === "playing" ? m.chapters[ch]?.title : ""}
          </p>
        </div>
      )}

      {stage === "card" && (
        <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-bg/80 p-4">
          <div className="present-card w-full max-w-md rounded-2xl border border-[#2c3b5e] bg-panel p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:p-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember-soft">Team Polaris presents</p>
            <h2 id="demo-h" className="mt-1 font-head text-2xl font-bold">
              See HEARTH in action
            </h2>
            {load.state === "loading" && <p className="mt-3 text-sm text-muted">Getting the video ready…</p>}
            {load.state === "missing" && (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted">The recorded video is not available right now. You can watch the same presentation run live on this page instead.</p>
                <div className="mt-5 flex justify-end gap-2">
                  <button type="button" onClick={close} className="btn-ghost">
                    Not now
                  </button>
                  <button ref={playBtn} type="button" onClick={goLive} className="btn-ember px-5">
                    ▶ Run it live
                  </button>
                </div>
              </>
            )}
            {m && (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  A short tour of every part of HEARTH, with VESTA answering. Filmed from the real site{recorded ? ` on ${recorded}` : ""}.
                </p>
                <button type="button" onClick={() => playFrom(0)} className="group relative mt-4 block aspect-video w-full overflow-hidden rounded-xl border border-line bg-black" aria-label={`Play the video, ${clock(m.duration)}`}>
                  {m.poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src(m.poster)} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" />
                  )}
                  <span className="absolute inset-0 grid place-items-center" aria-hidden>
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-ember text-xl text-bg shadow-[0_0_30px_rgb(var(--ember-rgb)/0.6)] transition group-hover:scale-110">▶</span>
                  </span>
                  <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[11px]">{clock(m.duration)}</span>
                </button>
                <div className="mt-3 grid gap-1.5">
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
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
                  <button type="button" onClick={goLive} className="text-xs text-muted underline-offset-2 hover:text-text hover:underline">
                    Run it live on this page instead
                  </button>
                  <span className="flex gap-2">
                    <button type="button" onClick={close} className="btn-ghost">
                      Not now
                    </button>
                    <button ref={playBtn} type="button" onClick={() => playFrom(0)} className="btn-ember px-5">
                      ▶ Play
                    </button>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {m && stage !== "card" && (
        <div className={`present-dock absolute inset-x-0 bottom-3 z-10 flex justify-center px-3 ${barShown || !playing ? "is-shown" : ""}`} onPointerEnter={showBar}>
          <div className="present-bar w-full max-w-[980px] rounded-2xl border border-[#2c3b5e] bg-[rgba(13,19,34,0.92)] px-3 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.5)]">
            <div className="relative">
              <input type="range" min={0} max={m.duration} step={0.1} value={Math.min(t, m.duration)} onChange={(e) => seek(Number(e.target.value))} aria-label="Position in the video" aria-valuetext={`${clock(t)} of ${clock(m.duration)}, ${m.chapters[ch]?.title ?? ""}`} className="h-1.5 w-full cursor-pointer accent-[var(--ember)]" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-0" aria-hidden>
                {m.chapters.slice(1).map((c) => (
                  <span key={c.id} className="absolute h-2.5 w-px -translate-y-1/2 bg-text/40" style={{ left: `${(c.start / m.duration) * 100}%` }} />
                ))}
              </div>
            </div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <button type="button" onClick={togglePlay} className={ctl} aria-label={playing ? "Pause" : "Play"} title={playing ? "Pause (Space)" : "Play (Space)"}>
                {playing ? "❚❚" : "▶"}
              </button>
              <span className="shrink-0 font-mono text-[11px] text-muted">
                {clock(t)} / {clock(m.duration)}
              </span>
              <span className="mx-2 hidden min-w-0 flex-1 items-center gap-1 sm:flex" role="group" aria-label="Chapters">
                {m.chapters.map((c, i) => (
                  <button key={c.id} type="button" onClick={() => seek(c.start)} title={c.title} aria-label={`Chapter ${i + 1}: ${c.title}`} aria-current={i === ch ? "step" : undefined} className={`h-2.5 rounded-full transition-all duration-500 ${i === ch ? "w-6 bg-ember" : i < ch ? "w-2.5 bg-ember/60" : "w-2.5 bg-line hover:bg-muted"}`} />
                ))}
                <span className="ml-2 truncate text-xs text-text">{m.chapters[ch]?.title}</span>
              </span>
              <span className="ml-auto flex items-center gap-1.5">
                <button type="button" onClick={() => setSubsOn((v) => !v)} aria-pressed={subsOn} className={`${ctl} font-mono text-[11px] font-bold ${subsOn ? "is-on" : ""}`} aria-label={subsOn ? "Hide subtitles" : "Show subtitles"} title="Subtitles (C)">
                  CC
                </button>
                <button type="button" onClick={() => setVoiceOn((v) => !v)} aria-pressed={voiceOn} className={`${ctl} ${voiceOn ? "is-on" : ""}`} aria-label={voiceOn ? "Mute the voice" : "Turn the voice on"} title="Voice">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                    <path d="M4 9h4l5-4v14l-5-4H4z" />
                    {voiceOn ? <path d="M16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11" /> : <path d="M17 9l5 6M22 9l-5 6" />}
                  </svg>
                </button>
                <button type="button" onClick={() => setMusicOn((v) => !v)} aria-pressed={musicOn} className={`${ctl} ${musicOn ? "is-on" : ""}`} aria-label={musicOn ? "Mute music and sound effects" : "Turn music and sound effects on"} title="Music and sound effects">
                  ♪
                </button>
                <a href={src(m.video)} download="HEARTH-by-Team-Polaris.mp4" className={`${ctl} grid place-items-center`} aria-label={`Download the video (${formatBytes(m.bytes)})`} title={`Download (${formatBytes(m.bytes)})`}>
                  ⤓
                </a>
                <button type="button" onClick={toggleFull} className={ctl} aria-label={full ? "Leave full screen" : "Full screen"} title="Full screen (F)">
                  {full ? "⤡" : "⤢"}
                </button>
                <button type="button" onClick={close} className={ctl} aria-label="Close the video" title="Close (Esc)">
                  ✕
                </button>
              </span>
            </div>
            {broken && (
              <p className="mt-1.5 text-[11px] text-warn">
                This browser could not play the video.{" "}
                <button type="button" onClick={goLive} className="underline">
                  Run it live instead
                </button>
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
