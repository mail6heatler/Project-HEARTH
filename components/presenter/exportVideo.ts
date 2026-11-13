"use client";
import { cueAt, steer, wordAt, wrapWords, type Cue, type DemoManifest, type DownloadChoice } from "@/lib/presenter/demo";

const TYPES = ["video/mp4;codecs=avc1,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
/** A made copy is drawn at a steady 30 frames a second (half the work of the 60 fps original, so modest laptops keep up). */
const FPS = 30;
const VIDEO_BITS = 5_000_000;

export interface MadeVideo {
  blob: Blob;
  ext: "mp4" | "webm";
}

/** Can this browser make a custom video (canvas capture + the browser's own recorder)? */
export function canMakeVideo(): boolean {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") return false;
  const audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return !!audio && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
}

/** Waits until a media file can play through (false if it fails or takes too long). */
function ready(el: HTMLMediaElement, ms = 30_000): Promise<boolean> {
  return new Promise((resolve) => {
    if (el.readyState >= 4) return resolve(true);
    const finish = (ok: boolean) => {
      clearTimeout(timer);
      el.removeEventListener("canplaythrough", yes);
      el.removeEventListener("error", no);
      resolve(ok);
    };
    const yes = () => finish(true);
    const no = () => finish(false);
    const timer = setTimeout(no, ms);
    el.addEventListener("canplaythrough", yes);
    el.addEventListener("error", no);
    el.load();
  });
}

/** One subtitle drawn like the player shows it: words said so far bright, the word being said in ember. */
function drawSubtitle(g: CanvasRenderingContext2D, cue: Cue, t: number, W: number, H: number, font: string) {
  const size = Math.round(H * 0.037);
  g.font = `500 ${size}px ${font}`;
  g.textBaseline = "middle";
  const lines = wrapWords(
    cue.words.map((w) => w.text),
    (s) => g.measureText(s).width,
    W * 0.74,
  );
  const widths = lines.map((l) => g.measureText(l.join(" ")).width);
  const lineH = size * 1.32;
  const padX = size * 0.75;
  const padY = size * 0.4;
  const boxW = Math.max(...widths) + padX * 2;
  const boxH = lines.length * lineH + padY * 2;
  const x0 = (W - boxW) / 2;
  const y0 = H * 0.93 - boxH;
  g.fillStyle = "rgba(4,6,12,0.8)";
  g.beginPath();
  if (typeof g.roundRect === "function") g.roundRect(x0, y0, boxW, boxH, size * 0.5);
  else g.rect(x0, y0, boxW, boxH);
  g.fill();
  const said = wordAt(cue, t);
  let i = 0;
  lines.forEach((line, li) => {
    let x = (W - widths[li]) / 2;
    const y = y0 + padY + lineH * (li + 0.5);
    for (const w of line) {
      g.fillStyle = i < said ? "#E8ECF6" : i === said ? "#FFB98A" : "rgba(232,236,246,0.5)";
      g.fillText(w, x, y);
      x += g.measureText(`${w} `).width;
      i++;
    }
  });
}

/**
 * Makes the demo video with just the parts the viewer picked: the voice, the music + sound effects and the
 * subtitles drawn into the picture. The recorded video plays once, unseen, in real time; each frame is drawn
 * onto a canvas (plus the subtitle) and the browser's own recorder writes it with the chosen sound tracks.
 * Resolves null when stopped, or when the browser cannot do it. Pauses while the tab is in the background.
 */
export async function makeVideo(o: {
  m: DemoManifest;
  dir: string;
  choice: DownloadChoice;
  onProgress: (fraction: number) => void;
  signal: AbortSignal;
}): Promise<MadeVideo | null> {
  const { m, choice, signal } = o;
  if (!canMakeVideo()) return null;
  const url = (f: string) => `${o.dir}/${f}`;
  const v = document.createElement("video");
  v.src = url(m.video);
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  // without separate tracks, the video's own mixed sound is the only sound there is
  const mixed = (choice.voice || choice.music) && !(m.voice && m.music);
  const files = mixed ? [] : ([choice.voice && m.voice, choice.music && m.music].filter(Boolean) as string[]);
  const tracks = files.map((f) => {
    const a = new Audio(url(f));
    a.preload = "auto";
    return a;
  });
  const loaded = await Promise.all([ready(v), ...tracks.map((a) => ready(a))]);
  if (!loaded.every(Boolean) || signal.aborted) return null;

  const W = m.width;
  const H = m.height;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext("2d");
  if (!g) return null;
  const font = getComputedStyle(document.body).fontFamily || "sans-serif";
  const Audio_ = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ac = new Audio_();
  await ac.resume().catch(() => {});
  const dest = ac.createMediaStreamDestination();
  if (mixed) {
    v.muted = false;
    ac.createMediaElementSource(v).connect(dest);
  }
  for (const a of tracks) ac.createMediaElementSource(a).connect(dest);
  const sound = mixed || tracks.length > 0;
  const stream = new MediaStream([...canvas.captureStream(Math.min(FPS, m.fps)).getVideoTracks(), ...(sound ? dest.stream.getAudioTracks() : [])]);
  const mimeType = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  let rec: MediaRecorder;
  try {
    rec = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: VIDEO_BITS, audioBitsPerSecond: 160_000 } : undefined);
  } catch {
    void ac.close();
    return null;
  }
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));

  const draw = () => {
    g.drawImage(v, 0, 0, W, H);
    if (choice.subtitles) {
      const cue = cueAt(m.cues, v.currentTime);
      if (cue) drawSubtitle(g, cue, v.currentTime, W, H, font);
    }
  };
  const vfc = "requestVideoFrameCallback" in HTMLVideoElement.prototype;
  let handle = 0;
  let running = true;
  let drawnAt = -1;
  const loop = () => {
    if (!running) return;
    // one picture per 1/30 s of video
    if (v.currentTime - drawnAt >= 1 / FPS - 0.004 || v.currentTime < drawnAt) {
      drawnAt = v.currentTime;
      draw();
    }
    o.onProgress(Math.min(1, v.currentTime / m.duration));
    // the separate tracks follow the picture, gently (see `steer`)
    for (const a of tracks) {
      const s = steer(v.currentTime - a.currentTime);
      if (s.jump) a.currentTime = v.currentTime;
      if (a.playbackRate !== s.rate) a.playbackRate = s.rate;
    }
    handle = vfc ? v.requestVideoFrameCallback(loop) : requestAnimationFrame(loop);
  };
  // a background tab stops drawing: everything waits until the tab is back
  const onVisible = () => {
    if (document.hidden) {
      v.pause();
      tracks.forEach((a) => a.pause());
      if (rec.state === "recording") rec.pause();
    } else if (!v.ended && running) {
      if (rec.state === "paused") rec.resume();
      void v.play().catch(() => {});
      tracks.forEach((a) => void a.play().catch(() => {}));
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  draw();
  rec.start(1000);
  loop();
  const ended = new Promise<void>((r) => v.addEventListener("ended", () => r(), { once: true }));
  const abort = new Promise<void>((r) => signal.addEventListener("abort", () => r(), { once: true }));
  let failed = false;
  try {
    await Promise.all([v.play(), ...tracks.map((a) => a.play())]);
  } catch {
    failed = true;
    running = false;
  }
  if (running) await Promise.race([ended, abort]);
  running = false;
  if (vfc) v.cancelVideoFrameCallback(handle);
  else cancelAnimationFrame(handle);
  document.removeEventListener("visibilitychange", onVisible);
  draw();
  if (rec.state !== "inactive") rec.stop();
  await stopped;
  v.pause();
  tracks.forEach((a) => a.pause());
  stream.getTracks().forEach((t) => t.stop());
  void ac.close();
  if (signal.aborted || failed || !chunks.length) return null;
  o.onProgress(1);
  const type = mimeType ?? chunks[0].type ?? "video/webm";
  return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" };
}

/** Saves a file the page made (a made video, the subtitles) to the viewer's downloads. */
export function saveFile(data: Blob | string, name: string) {
  const href = typeof data === "string" ? data : URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (typeof data !== "string") setTimeout(() => URL.revokeObjectURL(href), 60_000);
}
