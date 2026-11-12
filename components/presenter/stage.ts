"use client";
import type { Target } from "@/lib/presenter/script";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SMOOTH = "cubic-bezier(.65,0,.35,1)";

/** The first element matching a selector, or (for a text target) whose visible text matches. Hidden ones are skipped. */
export function resolveTarget(t: Target): HTMLElement | null {
  const visible = (el: Element | null): el is HTMLElement => !!el && el instanceof HTMLElement && el.getClientRects().length > 0;
  if (typeof t === "string") {
    const all = Array.from(document.querySelectorAll(t));
    return (all.find(visible) as HTMLElement | undefined) ?? null;
  }
  const scope = t.within ? document.querySelector(t.within) : document;
  if (!scope) return null;
  const want = t.text.toLowerCase();
  const els = Array.from(scope.querySelectorAll(t.tag ?? "*")).filter(visible);
  return els.find((el) => (el.textContent ?? "").trim().toLowerCase() === want) ?? els.find((el) => (el.textContent ?? "").toLowerCase().includes(want)) ?? null;
}

/** Waits (up to `ms`) for a target to appear. Null if it never does: the show then skips that step. */
export async function waitForTarget(t: Target, signal: AbortSignal, ms = 4000): Promise<HTMLElement | null> {
  const end = Date.now() + ms;
  while (!signal.aborted && Date.now() < end) {
    const el = resolveTarget(t);
    if (el) return el;
    await sleep(120);
  }
  return null;
}

export function centerOf(el: Element): { x: number; y: number } {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

/** Brings an element into view if it is mostly off screen, and waits for the scroll to finish. */
export async function ensureVisible(el: Element, calm: boolean): Promise<void> {
  const r = el.getBoundingClientRect();
  const off = r.bottom < 70 || r.top > window.innerHeight - 90;
  if (!off) return;
  el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
  await settleScroll(calm);
}

/** Waits until the page stops scrolling (smooth scrolls end at different times). */
export async function settleScroll(calm: boolean): Promise<void> {
  if (calm) {
    await sleep(30);
    return;
  }
  let last = -1;
  for (let i = 0; i < 20; i++) {
    await sleep(60);
    const y = window.scrollY;
    if (y === last) return;
    last = y;
  }
}

/** After a page change: waits until its panels stop appearing (charts, map, fonts), at most `max` ms. */
export async function settlePage(signal: AbortSignal, max = 2600): Promise<void> {
  const end = Date.now() + max;
  let count = -1;
  let stable = 0;
  try {
    await Promise.race([document.fonts?.ready, sleep(800)]);
  } catch {
    /* fonts API missing: carry on */
  }
  while (!signal.aborted && Date.now() < end) {
    await sleep(120);
    const n = document.querySelectorAll("#main .hud-panel, #main canvas, #main table").length;
    stable = n === count && n > 0 ? stable + 1 : 0;
    count = n;
    if (stable >= 3) return;
  }
}

const STAGE = "hearth-stage";
let zoomAnims: Animation[] = [];

/** The "camera": zooms the page stage onto an element, then keeps drifting in very slowly while held. */
export async function zoomTo(el: Element, scale: number, calm: boolean): Promise<void> {
  const stage = document.getElementById(STAGE);
  if (!stage || calm || typeof stage.animate !== "function") return;
  await unzoom(true);
  const s = stage.getBoundingClientRect();
  const c = centerOf(el);
  stage.style.transformOrigin = `${c.x - s.left}px ${c.y - s.top}px`;
  const zoom = stage.animate([{ transform: "scale(1)" }, { transform: `scale(${scale})` }], { duration: 900, easing: SMOOTH, fill: "forwards" });
  zoomAnims = [zoom];
  await sleep(900);
  if (!zoomAnims.includes(zoom)) return;
  const drift = stage.animate([{ transform: `scale(${scale})` }, { transform: `scale(${scale * 1.015})` }], { duration: 4000, easing: "linear", fill: "forwards" });
  zoomAnims.push(drift);
}

export async function unzoom(instant = false): Promise<void> {
  const stage = document.getElementById(STAGE);
  if (!stage || !zoomAnims.length) return;
  const current = zoomAnims;
  zoomAnims = [];
  if (!instant) {
    const from = getComputedStyle(stage).transform;
    const back = stage.animate([{ transform: from === "none" ? "scale(1)" : from }, { transform: "scale(1)" }], { duration: 750, easing: SMOOTH, fill: "forwards" });
    current.forEach((a) => a.cancel());
    await sleep(760);
    back.cancel();
  } else current.forEach((a) => a.cancel());
  stage.style.transformOrigin = "";
}

export function isZoomed(): boolean {
  return zoomAnims.length > 0;
}

/** A real mouse hover, so the page reacts as it would to a person (React listens to mouseover / mouseout). */
export function hoverIn(el: Element) {
  el.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, relatedTarget: document.body }));
  el.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }));
}

export function hoverOut(el: Element) {
  el.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }));
  el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));
}

/** The target glows softly while the presenter cursor is on it, and sinks a little when pressed. */
export function glow(el: Element, on: boolean) {
  el.classList.toggle("present-hover", on);
}

export async function press(el: Element) {
  el.classList.add("present-press");
  await sleep(140);
  el.classList.remove("present-press");
}

/** Presses a key the way the page's own keyboard handlers will see it (marked untrusted, so the presenter ignores it). */
export function pressKey(target: EventTarget, key: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}
