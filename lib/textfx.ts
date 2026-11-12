/**
 * Pure helpers for VESTA's text effects. Decoration rules: words may scramble or type out, but a number
 * is never shown as anything other than itself (no random digits standing in for data).
 */

const GLYPHS = "ABCDEFGHJKLMNPQRSTUVWXYZ#%&*+=<>/\\";

/**
 * One frame of a "decoding" text change: characters settle left to right as progress goes 0 → 1.
 * Unsettled letters show random glyphs; digits, spaces and punctuation are never scrambled.
 */
export function scrambleFrame(target: string, progress: number, rand: () => number = Math.random): string {
  const p = Math.max(0, Math.min(1, progress));
  const settled = Math.floor(target.length * p);
  let out = "";
  for (let i = 0; i < target.length; i++) {
    const c = target[i];
    if (i < settled || !/[A-Za-z]/.test(c)) out += c;
    else out += GLYPHS[Math.floor(rand() * GLYPHS.length) % GLYPHS.length];
  }
  return out;
}

/** Splits text into plain parts and standalone numbers (e.g. 2.788, 34%, 0.903×) so numbers can glow once. */
export function splitNumbers(text: string): { text: string; num: boolean }[] {
  const re = /(?<![\w.-])(\d+(?:[.,]\d+)?(?:\s?%|×)?)(?![\w-])/g;
  const out: { text: string; num: boolean }[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i), num: false });
    out.push({ text: m[0], num: true });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), num: false });
  return out;
}

/** Markdown markers removed for the live "decoding" view while an answer streams in. */
export function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "• ")
    .replace(/^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/gm, "")
    .replace(/\|/g, " ");
}

/** Selected page text turned into a short, safe question snippet; null when it is too short or too long. */
export function cleanSelection(raw: string): string | null {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length < 3 || t.length > 280) return null;
  return t;
}

/** The characters of an odometer: digits roll, everything else (".", "k", "M") stays put. */
export function odometerChars(value: string): { ch: string; digit: number | null }[] {
  return [...value].map((ch) => ({ ch, digit: /\d/.test(ch) ? Number(ch) : null }));
}
