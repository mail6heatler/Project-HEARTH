/** Pure geometry for VESTA's movable window (desktop). Tested in tests/vesta-window.test.ts. */

export type WinMode = "right" | "left" | "float" | "expand" | "hidden";
export type Dock = "right" | "left" | "float";
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Edge = "e" | "w" | "s" | "se" | "sw";

/** Height of the sticky top bar: the window never slides under it. */
export const TOP = 49;
export const MIN_W = 340;
export const MIN_H = 420;
/** Drop the window this close to a side of the screen to dock it there. */
export const SNAP_PX = 64;
/** Pointer travel before a press on the header turns into a drag (so a click stays a click). */
export const DRAG_START_PX = 5;

export const DEFAULT_RECT: Rect = { x: 0, y: TOP + 24, w: 420, h: 640 };

/** Keep the window on screen and within its size limits. */
export function clampRect(r: Rect, vw: number, vh: number): Rect {
  const w = Math.round(Math.min(Math.max(r.w, MIN_W), Math.max(MIN_W, vw - 16)));
  const h = Math.round(Math.min(Math.max(r.h, MIN_H), Math.max(MIN_H, vh - TOP - 8)));
  const x = Math.round(Math.min(Math.max(r.x, 0), Math.max(0, vw - w)));
  const y = Math.round(Math.min(Math.max(r.y, TOP), Math.max(TOP, vh - Math.min(h, 120))));
  return { x, y, w, h };
}

/** Which dock zone the pointer is in while dragging, if any. */
export function snapZone(clientX: number, vw: number): "left" | "right" | null {
  if (clientX <= SNAP_PX) return "left";
  if (clientX >= vw - SNAP_PX) return "right";
  return null;
}

/** New rectangle after dragging an edge or corner by (dx, dy). */
export function resizeRect(start: Rect, edge: Edge, dx: number, dy: number, vw: number, vh: number): Rect {
  let { x, w, h } = start;
  if (edge === "e" || edge === "se") w = start.w + dx;
  if (edge === "w" || edge === "sw") {
    w = Math.max(MIN_W, start.w - dx);
    x = start.x + (start.w - w);
  }
  if (edge === "s" || edge === "se" || edge === "sw") h = start.h + dy;
  return clampRect({ x, y: start.y, w, h }, vw, vh);
}

/** The big centred "Expand" view. */
export function expandRect(vw: number, vh: number): Rect {
  const w = Math.min(1040, vw - 80);
  const h = vh - TOP - 40;
  return { x: Math.round((vw - w) / 2), y: TOP + 20, w, h };
}

/** Read a saved window state, ignoring anything malformed. */
export function parseSaved(raw: string | null): { dock: Dock; hidden: boolean; rect: Rect } | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as { dock?: unknown; hidden?: unknown; rect?: Partial<Rect> };
    const dock: Dock = v.dock === "left" || v.dock === "float" ? v.dock : "right";
    const r = v.rect ?? {};
    const ok = (n: unknown) => typeof n === "number" && Number.isFinite(n);
    const rect = ok(r.x) && ok(r.y) && ok(r.w) && ok(r.h) ? { x: r.x!, y: r.y!, w: r.w!, h: r.h! } : DEFAULT_RECT;
    return { dock, hidden: v.hidden === true, rect };
  } catch {
    return null;
  }
}
