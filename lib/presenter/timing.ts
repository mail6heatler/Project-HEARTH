/** Pure helpers for the presentation: filling narration from data, and timing it. Tested. */
import type { Chapter } from "./script";

/** A calm presenting pace. */
export const WORDS_PER_MINUTE = 168;

export interface Facts {
  /** Total NASA test runs, from /api/tests. */
  tests?: number;
}

/** Puts real values into the narration; a value that could not be read becomes neutral words, never a guess. */
export function fillNarration(text: string, facts: Facts): string {
  return text.replace(/\{tests\}/g, facts.tests != null ? String(facts.tests) : "hundreds of");
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** How long the narration takes at the presenting pace, in ms. */
export function speechMs(text: string, wpm: number = WORDS_PER_MINUTE): number {
  return Math.round((wordCount(text) / wpm) * 60_000);
}

/** Rough time of the longer on-screen moves (ms); anything else counts as a short move. */
const ACTION_MS: Partial<Record<Chapter["actions"][number]["do"], number>> = { launch: 3200, vestaStage: 3400, vestaShow: 1200, vestaMini: 650, vestaDock: 500 };

/** Rough length of one chapter: its narration or its own waits, whichever is longer, plus moving about. */
export function chapterMs(ch: Chapter, facts: Facts = { tests: 1000 }): number {
  const waits = ch.actions.reduce((sum, a) => sum + (a.do === "wait" ? a.ms : a.do === "hover" ? (a.ms ?? 1200) : (ACTION_MS[a.do] ?? 700)), 0);
  return Math.max(speechMs(fillNarration(ch.say, facts)), waits) + 600;
}

export function totalMs(chapters: Chapter[], facts?: Facts): number {
  return chapters.reduce((sum, c) => sum + chapterMs(c, facts), 0);
}

/** Index of the word being spoken at a character position (for the subtitle highlight). */
export function wordIndexAt(text: string, charIndex: number): number {
  // the browser reports the start of the word it is about to say: count the words before it
  return text.slice(0, Math.max(0, charIndex)).split(/\s+/).filter(Boolean).length;
}

/** Best voice for presenting: natural English voices first (Edge's "Online (Natural)" ones), then any English one. */
export function pickVoiceName(voices: { name: string; lang: string }[]): string | null {
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  const rank = (n: string) => (/natural/i.test(n) ? 0 : /google (us|uk) english/i.test(n) ? 1 : /aria|jenny|guy|sonia|libby|zira|david/i.test(n) ? 2 : 3);
  const best = [...en].sort((a, b) => rank(a.name) - rank(b.name) || (/en-us/i.test(b.lang) ? 1 : 0) - (/en-us/i.test(a.lang) ? 1 : 0))[0];
  return best?.name ?? null;
}
