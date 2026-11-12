"use client";
import type { Target } from "@/lib/presenter/script";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

/** Brings an element into view if it is mostly off screen. */
export async function ensureVisible(el: Element, calm: boolean): Promise<void> {
  const r = el.getBoundingClientRect();
  const off = r.bottom < 60 || r.top > window.innerHeight - 60;
  if (!off) return;
  el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "center" });
  await sleep(calm ? 50 : 650);
}

const STAGE = "hearth-stage";
let zoomAnim: Animation | null = null;

/** Zooms the page in on an element ("camera" move). The page stage is the layout below the top bar. */
export async function zoomTo(el: Element, scale: number, calm: boolean): Promise<void> {
  const stage = document.getElementById(STAGE);
  if (!stage || calm || typeof stage.animate !== "function") return;
  await unzoom(true);
  const s = stage.getBoundingClientRect();
  const c = centerOf(el);
  stage.style.transformOrigin = `${c.x - s.left}px ${c.y - s.top}px`;
  zoomAnim = stage.animate([{ transform: "scale(1)" }, { transform: `scale(${scale})` }], { duration: 750, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
  await sleep(760);
}

export async function unzoom(instant = false): Promise<void> {
  const stage = document.getElementById(STAGE);
  if (!stage || !zoomAnim) return;
  const current = zoomAnim;
  zoomAnim = null;
  if (!instant) {
    const back = stage.animate([{ transform: getComputedStyle(stage).transform === "none" ? "scale(1)" : getComputedStyle(stage).transform }, { transform: "scale(1)" }], { duration: 600, easing: "cubic-bezier(.2,.8,.2,1)", fill: "forwards" });
    current.cancel();
    await sleep(610);
    back.cancel();
  } else current.cancel();
  stage.style.transformOrigin = "";
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

/** Presses a key the way the page's own keyboard handlers will see it (marked untrusted, so the presenter ignores it). */
export function pressKey(target: EventTarget, key: string) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
}
