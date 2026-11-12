"use client";
import { pickVoiceName, speechMs, wordIndexAt } from "@/lib/presenter/timing";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The narrator: the browser's built-in voice. With the voice off (or no voice in this browser) the same
 * call runs on a timer, so subtitles still move word by word and the show keeps its pace.
 */
export class Narrator {
  voiceOn: boolean;
  paused = false;
  private voice: SpeechSynthesisVoice | null = null;

  constructor(voiceOn: boolean) {
    this.voiceOn = voiceOn;
  }

  static supported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
  }

  /** Voices load lazily in some browsers: wait briefly for them, then pick the most natural English one. */
  async init(): Promise<void> {
    if (!Narrator.supported()) return;
    let list = window.speechSynthesis.getVoices();
    if (!list.length) {
      await new Promise<void>((resolve) => {
        const done = () => resolve();
        window.speechSynthesis.addEventListener("voiceschanged", done, { once: true });
        setTimeout(done, 1500);
      });
      list = window.speechSynthesis.getVoices();
    }
    const name = pickVoiceName(list.map((v) => ({ name: v.name, lang: v.lang })));
    this.voice = list.find((v) => v.name === name) ?? null;
  }

  get voiceName(): string | null {
    return this.voice?.name ?? null;
  }

  setVoice(on: boolean) {
    this.voiceOn = on;
    if (!on && Narrator.supported()) window.speechSynthesis.cancel();
  }

  pause() {
    this.paused = true;
    if (Narrator.supported()) window.speechSynthesis.pause();
  }

  resume() {
    this.paused = false;
    if (Narrator.supported()) window.speechSynthesis.resume();
  }

  stop() {
    if (Narrator.supported()) window.speechSynthesis.cancel();
  }

  /** Speaks (or times) one line; `onWord` gets the index of the word being said. Resolves when it is done. */
  async speak(text: string, onWord: (i: number) => void, signal: AbortSignal): Promise<void> {
    if (this.voiceOn && this.voice && Narrator.supported()) {
      const spoken = await this.speakAloud(text, onWord, signal);
      if (spoken || signal.aborted) return;
    }
    await this.timed(text, onWord, signal);
  }

  private speakAloud(text: string, onWord: (i: number) => void, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.lang = this.voice?.lang ?? "en-US";
      u.rate = 1.06;
      u.pitch = 1;
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        signal.removeEventListener("abort", onAbort);
        resolve(ok);
      };
      const onAbort = () => {
        synth.cancel();
        finish(true);
      };
      u.onboundary = (e) => {
        if (e.name === "word" || e.name === undefined) onWord(wordIndexAt(text, e.charIndex));
      };
      u.onend = () => {
        onWord(Number.MAX_SAFE_INTEGER);
        finish(true);
      };
      // a voice that fails at once falls back to timed subtitles; a later failure (or the voice being switched
      // off mid-line) just ends the line, so the show never plays a line twice
      const started = Date.now();
      u.onerror = () => finish(Date.now() - started > 400 || !this.voiceOn);
      // some browsers never report the end of speech: never let one line hold the show for long
      const guard = setTimeout(() => {
        synth.cancel();
        finish(true);
      }, speechMs(text) * 1.4 + 2500);
      signal.addEventListener("abort", onAbort, { once: true });
      synth.speak(u);
    });
  }

  private async timed(text: string, onWord: (i: number) => void, signal: AbortSignal): Promise<void> {
    const words = text.trim().split(/\s+/).length;
    const total = speechMs(text);
    let elapsed = 0;
    while (elapsed < total && !signal.aborted) {
      await sleep(100);
      if (this.paused) continue;
      elapsed += 100;
      onWord(Math.floor((elapsed / total) * words));
    }
    onWord(Number.MAX_SAFE_INTEGER);
  }
}
