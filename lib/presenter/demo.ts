/**
 * Pure helpers for the recorded demo: "See HEARTH in action" played as a pre-made video instead of driving the
 * live site. Lines the recorded voice up with the narration, builds subtitles, encodes WAV audio, checks the
 * manifest, and answers the player's timing questions (which chapter, which subtitle, does a track need
 * re-syncing). Tested.
 */
import { z } from "zod";
import { phrases } from "./motion";

/** A word the voice service reported: what it said and when (ms from the start of the line). */
export interface WordBoundary {
  text: string;
  offsetMs: number;
}

/** A narrated line's recorded timing: its length and when each word starts (ms from the start of the line). */
export interface LineTiming {
  ms: number;
  words: number[];
}

const Word = z.object({ text: z.string(), at: z.number() });
const CueSchema = z.object({ start: z.number(), end: z.number(), text: z.string(), words: z.array(Word) });
const ChapterSchema = z.object({ id: z.string(), title: z.string(), start: z.number() });

/** What `npm run demo:record` writes next to the video (public/demo/manifest.json) and the player reads. */
export const DemoManifestSchema = z.object({
  version: z.literal(1),
  /** ISO date of the recording. */
  recordedAt: z.string(),
  /** Seconds. */
  duration: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  /** File names next to the manifest. The video has the full sound mixed in and is also the download. */
  video: z.string().min(1),
  /** Narration only and music + sound effects only, played in sync so each can be switched off. */
  voice: z.string().nullable(),
  music: z.string().nullable(),
  poster: z.string().nullable(),
  vtt: z.string().nullable(),
  /** Size of the video file. */
  bytes: z.number().int().nonnegative(),
  /** The narrating voice, named to viewers. */
  voiceName: z.string(),
  chapters: z.array(ChapterSchema).min(1),
  cues: z.array(CueSchema),
});

export type DemoManifest = z.infer<typeof DemoManifestSchema>;
/** One subtitle phrase, in seconds of video time, with when each of its words is said. */
export type Cue = z.infer<typeof CueSchema>;
export type DemoChapter = z.infer<typeof ChapterSchema>;

export const DEMO_DIR = "/demo";
export const DEMO_MANIFEST = `${DEMO_DIR}/manifest.json`;

/** Checks a manifest read from the network; anything missing or malformed gives null (the player then offers the live show). */
export function parseManifest(json: unknown): DemoManifest | null {
  const r = DemoManifestSchema.safeParse(json);
  return r.success ? r.data : null;
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);
const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * Start time (ms) of every narration word (words split on spaces, exactly like the subtitles), from the
 * voice's word boundaries. The voice may split a word ("fire-safety" → "fire", "safety") or skip punctuation;
 * words it never reports get a time between their neighbours. Always non-decreasing.
 */
export function alignWords(text: string, boundaries: WordBoundary[], totalMs: number): number[] {
  const list = words(text);
  const starts: (number | null)[] = list.map(() => null);
  let wi = 0;
  let rest = norm(list[0] ?? "");
  for (const b of boundaries) {
    let token = norm(b.text);
    if (!token) continue;
    // a spoken token may cover the rest of the current word, several words, or only part of one
    for (let k = wi; k < Math.min(list.length, wi + 4) && token; k++) {
      const w = k === wi ? rest : norm(list[k]);
      if (!w) {
        // a word with no letters or digits (e.g. "&") is not spoken as a token: timed between neighbours
        if (k === wi) {
          wi = k + 1;
          rest = norm(list[wi] ?? "");
        }
        continue;
      }
      if (w.startsWith(token)) {
        if (starts[k] == null) starts[k] = b.offsetMs;
        const left = w.slice(token.length);
        token = "";
        wi = left ? k : k + 1;
        rest = left || norm(list[wi] ?? "");
      } else if (token.startsWith(w)) {
        if (starts[k] == null) starts[k] = b.offsetMs;
        token = token.slice(w.length);
        wi = k + 1;
        rest = norm(list[wi] ?? "");
      }
    }
  }
  // fill the gaps by spreading them evenly between known neighbours
  const out: number[] = new Array(list.length).fill(0);
  let prevIdx = -1;
  let prevT = 0;
  for (let i = 0; i <= list.length; i++) {
    const known = i === list.length ? Math.max(prevT, totalMs) : starts[i];
    if (known == null) continue;
    const t = Math.max(prevT, known);
    const gap = i - prevIdx;
    for (let j = prevIdx + 1; j < i; j++) out[j] = Math.round(prevT + ((t - prevT) * (j - prevIdx)) / gap);
    if (i < list.length) out[i] = t;
    prevIdx = i;
    prevT = t;
  }
  return out;
}

/** One narrated line placed in the video: where it starts (ms of video time) and its recorded timing. */
export interface PlacedLine {
  text: string;
  startMs: number;
  timing: LineTiming;
}

const sec = (ms: number) => Math.round(ms) / 1000;

/** Subtitles in short phrases (the same phrases as the live presentation), timed to the recorded voice. */
export function buildCues(lines: PlacedLine[]): Cue[] {
  const cues: Cue[] = [];
  for (const line of lines) {
    const w = words(line.text);
    const at = (i: number) => line.startMs + (line.timing.words[i] ?? line.timing.ms);
    const list = phrases(line.text);
    list.forEach(([a, b], i) => {
      const next = list[i + 1];
      const start = at(a);
      const end = next ? at(next[0]) : line.startMs + line.timing.ms + 250;
      cues.push({
        start: sec(start),
        end: sec(Math.max(end, start + 400)),
        text: w.slice(a, b + 1).join(" "),
        words: w.slice(a, b + 1).map((text, n) => ({ text, at: sec(at(a + n)) })),
      });
    });
  }
  return cues;
}

const stamp = (s: number) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const x = Math.floor((ms % 60_000) / 1000);
  const r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(x).padStart(2, "0")}.${String(r).padStart(3, "0")}`;
};

/** WebVTT subtitles (for downloads, other players and video sites). */
export function toVtt(cues: Cue[]): string {
  return ["WEBVTT", "", ...cues.flatMap((c, i) => [String(i + 1), `${stamp(c.start)} --> ${stamp(c.end)}`, c.text, ""])].join("\n");
}

/** The subtitle showing at a moment (seconds), or null. */
export function cueAt(cues: Cue[], t: number): Cue | null {
  for (const c of cues) if (t >= c.start && t < c.end) return c;
  return null;
}

/** The word being said inside a subtitle at a moment (-1 before its first word). */
export function wordAt(cue: Cue, t: number): number {
  let i = -1;
  cue.words.forEach((w, n) => {
    if (w.at <= t) i = n;
  });
  return i;
}

/** Index of the chapter playing at a moment (0 before the first starts). */
export function chapterAt(chapters: DemoChapter[], t: number): number {
  let idx = 0;
  chapters.forEach((c, i) => {
    if (t >= c.start) idx = i;
  });
  return idx;
}

/**
 * Keeps a separate audio track in step with the picture. `drift` = picture time − track time (seconds). A
 * small drift is evened out by playing the track a touch faster or slower (no audible jump; browsers keep the
 * pitch); only a big one, or a seek, is a jump.
 */
export function steer(drift: number): { jump: boolean; rate: number } {
  const d = Math.abs(drift);
  if (d > 0.3) return { jump: true, rate: 1 };
  if (d < 0.03) return { jump: false, rate: 1 };
  return { jump: false, rate: Math.round((1 + Math.sign(drift) * Math.min(0.06, d * 0.5)) * 1000) / 1000 };
}

/** m:ss for the player. */
export function clock(s: number): string {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** "18.4 MB" for the download button. */
export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** A 16-bit PCM WAV file from audio samples (-1…1), one array per channel. */
export function encodeWav(channels: Float32Array[], sampleRate: number): Uint8Array {
  const n = channels[0]?.length ?? 0;
  const ch = channels.length;
  const dataBytes = n * ch * 2;
  const buf = new ArrayBuffer(44 + dataBytes);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, ch, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * ch * 2, true);
  v.setUint16(32, ch * 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, dataBytes, true);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (let c = 0; c < ch; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  return new Uint8Array(buf);
}

/** Length in ms of a PCM WAV file (reads its header; other chunks before the data are skipped). */
export function wavMs(bytes: Uint8Array): number {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const byteRate = v.getUint32(28, true);
  let o = 12;
  while (o + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    const size = v.getUint32(o + 4, true);
    if (id === "data") return Math.round((Math.min(size, bytes.length - o - 8) / byteRate) * 1000);
    o += 8 + size + (size % 2);
  }
  return 0;
}
