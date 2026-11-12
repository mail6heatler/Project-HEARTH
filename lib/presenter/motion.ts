/** Pure motion maths for the presentation (cursor path, spotlight box, subtitle phrases, word cues). Tested. */

export interface Pt {
  x: number;
  y: number;
}
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Smooth start and stop. */
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** How long a cursor move takes: longer moves take a little longer, never sluggish (ms). */
export function moveMs(from: Pt, to: Pt): number {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  return Math.round(Math.min(1150, Math.max(420, 380 + d * 0.42)));
}

/** A point on a gentle curve from `from` to `to` (quadratic Bézier, bent sideways by `bend` of the distance). */
export function curvePoint(from: Pt, to: Pt, t: number, bend = 0.14): Pt {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // control point pushed perpendicular to the straight line
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  const u = 1 - t;
  return { x: u * u * from.x + 2 * u * t * cx + t * t * to.x, y: u * u * from.y + 2 * u * t * cy + t * t * to.y };
}

/**
 * The spotlight box for an element: padded, then kept inside the screen (with a margin) so its outline never
 * runs off an edge. Null when too little of the element is visible to highlight.
 */
export function spotBox(r: Box, pad: number, vw: number, vh: number, margin = 10): Box | null {
  const x1 = Math.max(margin, r.x - pad);
  const y1 = Math.max(margin, r.y - pad);
  const x2 = Math.min(vw - margin, r.x + r.w + pad);
  const y2 = Math.min(vh - margin, r.y + r.h + pad);
  if (x2 - x1 < 40 || y2 - y1 < 24) return null;
  return { x: Math.round(x1), y: Math.round(y1), w: Math.round(x2 - x1), h: Math.round(y2 - y1) };
}

/**
 * Splits narration into subtitle phrases of at most `max` words, breaking after punctuation where possible.
 * Returns [first word index, last word index] for each phrase.
 */
export function phrases(text: string, max = 9): [number, number][] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out: [number, number][] = [];
  let start = 0;
  for (let i = 0; i < words.length; i++) {
    const len = i - start + 1;
    const punct = /[,.;:!?]$/.test(words[i]);
    const last = i === words.length - 1;
    // break after punctuation once the phrase has some body, or when it gets too long
    if (last || (punct && len >= 3) || len >= max) {
      out.push([start, i]);
      start = i + 1;
    }
  }
  return out;
}

/** Which phrase holds a word. */
export function phraseAt(list: [number, number][], word: number): number {
  const i = list.findIndex(([a, b]) => word >= a && word <= b);
  return i >= 0 ? i : word < 0 ? 0 : list.length - 1;
}

/** Index of the first word that starts with `cue` (case-insensitive, punctuation ignored); -1 if absent. */
export function wordIndexOf(text: string, cue: string): number {
  const want = cue.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  return text
    .trim()
    .split(/\s+/)
    .findIndex((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "").startsWith(want));
}
