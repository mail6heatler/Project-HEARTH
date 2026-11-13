import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { alignWords, buildCues, chapterAt, clock, cueAt, downloadName, encodeWav, formatBytes, isReadyMade, parseManifest, steer, toSrt, toVtt, wavMs, wordAt, wrapWords, type DemoManifest } from "@/lib/presenter/demo";
import { phrases } from "@/lib/presenter/motion";
import { CHAPTERS } from "@/lib/presenter/script";

describe("recorded demo: downloads with the viewer's choices", () => {
  it("serves the recorded file only when it already is what was asked for", () => {
    expect(isReadyMade({ voice: true, music: true, subtitles: false })).toBe(true);
    expect(isReadyMade({ voice: true, music: true, subtitles: true })).toBe(false);
    expect(isReadyMade({ voice: false, music: true, subtitles: false })).toBe(false);
  });

  it("names each copy after what is in it", () => {
    expect(downloadName({ voice: true, music: true, subtitles: false })).toBe("HEARTH-by-Team-Polaris.mp4");
    expect(downloadName({ voice: true, music: true, subtitles: true }, "webm")).toBe("HEARTH-by-Team-Polaris-subtitles.webm");
    expect(downloadName({ voice: true, music: false, subtitles: true })).toBe("HEARTH-by-Team-Polaris-subtitles-no-music.mp4");
    expect(downloadName({ voice: false, music: true, subtitles: false })).toBe("HEARTH-by-Team-Polaris-no-voice.mp4");
    expect(downloadName({ voice: false, music: false, subtitles: true })).toBe("HEARTH-by-Team-Polaris-subtitles-no-sound.mp4");
  });

  it("writes SubRip subtitles with comma milliseconds", () => {
    const srt = toSrt([
      { start: 0.465, end: 2.472, text: "Team Polaris presents HEARTH:", words: [] },
      { start: 62.5, end: 65, text: "Next line", words: [] },
    ]);
    expect(srt.split("\n").slice(0, 4)).toEqual(["1", "00:00:00,465 --> 00:00:02,472", "Team Polaris presents HEARTH:", ""]);
    expect(srt).toContain("00:01:02,500 --> 00:01:05,000");
  });

  it("wraps subtitle words into lines that fit", () => {
    const measure = (s: string) => s.length * 10;
    expect(wrapWords(["Ask", "VESTA", "in", "plain", "words."], measure, 120)).toEqual([["Ask", "VESTA", "in"], ["plain", "words."]]);
    expect(wrapWords(["a-very-long-word-indeed", "ok"], measure, 50)).toEqual([["a-very-long-word-indeed"], ["ok"]]);
    expect(wrapWords([], measure, 50)).toEqual([]);
  });
});

describe("recorded demo: lining the voice up with the words", () => {
  it("gives every word a start time from the voice's word reports", () => {
    const text = "Team Polaris presents HEARTH: fire-safety intelligence, built on 847 real tests.";
    const b = [
      { text: "Team", offsetMs: 100 },
      { text: "Polaris", offsetMs: 400 },
      { text: "presents", offsetMs: 900 },
      { text: "HEARTH", offsetMs: 1400 },
      { text: "fire", offsetMs: 2100 },
      { text: "safety", offsetMs: 2400 },
      { text: "intelligence", offsetMs: 2800 },
      { text: "built", offsetMs: 3900 },
      { text: "on", offsetMs: 4200 },
      { text: "847", offsetMs: 4400 },
      { text: "real", offsetMs: 5600 },
      { text: "tests", offsetMs: 5900 },
    ];
    const t = alignWords(text, b, 6600);
    expect(t).toEqual([100, 400, 900, 1400, 2100, 2800, 3900, 4200, 4400, 5600, 5900]);
  });

  it("spreads words the voice did not report between their neighbours, never going backwards", () => {
    const text = "Ask VESTA in plain words & she answers.";
    const t = alignWords(text, [{ text: "Ask", offsetMs: 0 }, { text: "plain", offsetMs: 900 }, { text: "answers", offsetMs: 2000 }], 2600);
    expect(t).toHaveLength(8);
    expect(t[0]).toBe(0);
    expect(t[3]).toBe(900);
    expect(t[1]).toBeGreaterThan(0);
    expect(t[2]).toBeLessThan(900);
    expect(t[7]).toBe(2000);
    for (let i = 1; i < t.length; i++) expect(t[i]).toBeGreaterThanOrEqual(t[i - 1]);
  });

  it("handles NASA's and a token that covers two written words", () => {
    const t = alignWords("against NASA's data", [{ text: "against", offsetMs: 0 }, { text: "NASA's", offsetMs: 500 }, { text: "data", offsetMs: 900 }], 1200);
    expect(t).toEqual([0, 500, 900]);
    expect(alignWords("built on top", [{ text: "builton", offsetMs: 10 }, { text: "top", offsetMs: 700 }], 900)).toEqual([10, 10, 700]);
  });
});

describe("recorded demo: subtitles", () => {
  const text = "Ask VESTA in plain words. She checks the NASA data with her tools, cites every source, and tags how sure she is.";
  const n = text.split(" ").length;
  const timing = { ms: n * 300 + 400, words: Array.from({ length: n }, (_, i) => i * 300) };
  const cues = buildCues([{ text, startMs: 2000, timing }]);

  it("uses the live show's short phrases, timed to the voice", () => {
    expect(cues.map((c) => c.text).join(" ")).toBe(text);
    expect(cues).toHaveLength(phrases(text).length);
    expect(cues[0].start).toBe(2);
    for (const c of cues) {
      expect(c.text.split(" ").length).toBeLessThanOrEqual(9);
      expect(c.end).toBeGreaterThan(c.start);
      expect(c.words[0].at).toBe(c.start);
    }
    for (let i = 1; i < cues.length; i++) expect(cues[i].start).toBeGreaterThanOrEqual(cues[i - 1].end - 0.001);
  });

  it("finds the subtitle and the word being said at a moment", () => {
    expect(cueAt(cues, 1.9)).toBeNull();
    const c = cueAt(cues, 2.35)!;
    expect(c.text.startsWith("Ask VESTA")).toBe(true);
    expect(wordAt(c, 2.35)).toBe(1);
    expect(wordAt(c, 1)).toBe(-1);
  });

  it("writes WebVTT", () => {
    const vtt = toVtt(cues);
    expect(vtt.startsWith("WEBVTT\n\n1\n00:00:02.000 --> ")).toBe(true);
    expect(vtt).toContain("Ask VESTA in plain words.");
  });
});

describe("recorded demo: player helpers", () => {
  it("knows the chapter, the clock, the file size and when a track has drifted", () => {
    const ch = [
      { id: "a", title: "A", start: 0.3 },
      { id: "b", title: "B", start: 9 },
      { id: "c", title: "C", start: 20 },
    ];
    expect([chapterAt(ch, 0), chapterAt(ch, 9), chapterAt(ch, 19.9), chapterAt(ch, 99)]).toEqual([0, 1, 1, 2]);
    expect([clock(0), clock(65.9), clock(92)]).toEqual(["0:00", "1:05", "1:32"]);
    expect([formatBytes(2048), formatBytes(19_293_798)]).toEqual(["2 KB", "18.4 MB"]);
    // in step: leave it; a little behind: play a touch faster; a little ahead: slower; far off: jump
    expect(steer(0.01)).toEqual({ jump: false, rate: 1 });
    expect(steer(0.1)).toEqual({ jump: false, rate: 1.05 });
    expect(steer(-0.1)).toEqual({ jump: false, rate: 0.95 });
    expect(steer(0.25).rate).toBe(1.06);
    expect(steer(0.5)).toEqual({ jump: true, rate: 1 });
    expect(steer(-2).jump).toBe(true);
  });

  it("encodes WAV audio and reads its length back", () => {
    const one = encodeWav([new Float32Array(48_000).fill(0.25)], 48_000);
    expect(String.fromCharCode(...one.slice(0, 4))).toBe("RIFF");
    expect(one.length).toBe(44 + 96_000);
    expect(wavMs(one)).toBe(1000);
    expect(wavMs(encodeWav([new Float32Array(24_000), new Float32Array(24_000)], 48_000))).toBe(500);
  });

  it("refuses a broken manifest (the player then offers the live show)", () => {
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({ version: 1, video: "x.mp4" })).toBeNull();
    const ok: DemoManifest = { version: 1, recordedAt: "2026-11-13T00:00:00Z", duration: 90, width: 1920, height: 1080, fps: 60, video: "v.mp4", voice: "voice.m4a", music: null, poster: null, vtt: null, bytes: 1, voiceName: "Aria", chapters: [{ id: "a", title: "A", start: 0 }], cues: [] };
    expect(parseManifest(ok)).toEqual(ok);
    expect(parseManifest({ ...ok, chapters: [] })).toBeNull();
  });
});

describe("recorded demo: the virtual clock that films it frame by frame", () => {
  type Fake = {
    setTimeout: (fn: () => void, ms?: number) => number;
    setInterval: (fn: () => void, ms?: number) => number;
    clearInterval: (id: number) => void;
    requestAnimationFrame: (fn: (t: number) => void) => number;
    Date: DateConstructor;
    performance: { now: () => number };
    console: Console;
    __vt: { step: (ms: number) => Promise<void>; now: () => number };
  };
  const install = () => {
    const w = { setTimeout, Date, performance: { now: () => 1000 }, console } as unknown as Fake;
    (globalThis as unknown as { __vtTarget: unknown }).__vtTarget = w;
    new Function(readFileSync(join(process.cwd(), "scripts/demo/virtual-time.js"), "utf8"))();
    return w;
  };
  const F = 1000 / 60;

  it("moves the page's time only when a frame is taken", async () => {
    const w = install();
    let fired = 0;
    w.setTimeout(() => fired++, 40);
    const d0 = w.Date.now();
    await w.__vt.step(F);
    await w.__vt.step(F);
    expect(fired).toBe(0);
    await w.__vt.step(F);
    expect(fired).toBe(1);
    expect(w.performance.now()).toBeCloseTo(1000 + 3 * F, 6);
    expect(w.Date.now() - d0).toBeCloseTo(3 * F, 6);
    expect(new w.Date().getTime()).toBeCloseTo(w.Date.now(), 0);
  });

  it("runs animation frames, intervals and chained waits on that clock", async () => {
    const w = install();
    let stamp = -1;
    w.requestAnimationFrame((t) => (stamp = t));
    let ticks = 0;
    const id = w.setInterval(() => ticks++, 10);
    const sleep = (ms: number) => new Promise((r) => w.setTimeout(() => r(null), ms));
    let done = false;
    void (async () => {
      await sleep(4);
      await sleep(4);
      done = true;
    })();
    await w.__vt.step(F);
    expect(stamp).toBeCloseTo(w.performance.now(), 6);
    expect(ticks).toBe(1);
    expect(done).toBe(true);
    w.clearInterval(id);
    await w.__vt.step(F * 3);
    expect(ticks).toBe(1);
  });
});

describe("recorded demo: the video on the site matches the presentation", () => {
  const dir = join(process.cwd(), "public", "demo");
  const file = join(dir, "manifest.json");
  it.runIf(existsSync(file))("has every file, every chapter and the current narration (else run npm run demo:record)", () => {
    const m = parseManifest(JSON.parse(readFileSync(file, "utf8")));
    expect(m).not.toBeNull();
    for (const f of [m!.video, m!.voice, m!.music, m!.poster, m!.vtt]) if (f) expect(existsSync(join(dir, f)), f).toBe(true);
    expect(m!.chapters.map((c) => c.id)).toEqual(CHAPTERS.map((c) => c.id));
    const said = m!.cues.map((c) => c.text).join(" ").replace(/\d+/g, "#");
    const script = CHAPTERS.map((c) => c.say).join(" ").replace(/\{tests\}|\d+/g, "#");
    expect(said).toBe(script);
  });
});
