"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHearth } from "@/lib/store";
import { clampRect, DEFAULT_RECT, DRAG_START_PX, expandRect, parseSaved, resizeRect, snapZone, TOP, type Dock, type Edge, type Rect, type WinMode } from "./windowGeometry";

const KEY = "hearth.vesta-window.v1";
const DESKTOP = "(min-width: 1180px)";
const ANIM_OUT_MS = 360;
const ANIM_IN_MS = 650;
const ANIM_UNFOLD_MS = 700;
/** Elements inside the header that keep their own click behaviour instead of starting a drag. */
const NO_DRAG = "button, a, input, textarea, select, label, [role='radio'], [role='radiogroup'], [data-no-drag]";

/** The presentation moves VESTA's window with this event (see `commandVestaWindow`). */
export const WINDOW_EVENT = "hearth:vesta-window";
export type WindowAnim = "in" | "out" | "pop" | "unfold";
export type WindowCommand =
  | { type: "set"; hidden?: boolean; expanded?: boolean; dock?: Dock; anim?: WindowAnim }
  /** Back to what the visitor had (read from storage, which is not written while presenting). */
  | { type: "restore" };

export function commandVestaWindow(cmd: WindowCommand) {
  window.dispatchEvent(new CustomEvent<WindowCommand>(WINDOW_EVENT, { detail: cmd }));
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * VESTA's window on desktop: docked right (default) or left, floating (drag + resize), expanded, or hidden
 * into mini VESTA. Below the desktop breakpoint it always stays in the page flow, exactly as before.
 * The choice and the floating size are remembered in localStorage (wrapped: storage may be blocked).
 */
export function useVestaWindow(panelRef: React.RefObject<HTMLElement>) {
  const [isDesktop, setDesktop] = useState(false);
  const [vp, setVp] = useState({ w: 1440, h: 900 });
  const [dock, setDock] = useState<Dock>("right");
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [rect, setRect] = useState<Rect>(DEFAULT_RECT);
  const [anim, setAnim] = useState<WindowAnim | null>(null);
  const [zone, setZone] = useState<"left" | "right" | null>(null);
  const [dragging, setDragging] = useState(false);
  const loaded = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // restore once, then follow the screen size
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP);
    const sync = () => {
      setDesktop(mq.matches);
      setVp({ w: window.innerWidth, h: window.innerHeight });
      setRect((r) => clampRect(r, window.innerWidth, window.innerHeight));
    };
    let saved: ReturnType<typeof parseSaved> = null;
    try {
      saved = parseSaved(window.localStorage.getItem(KEY));
    } catch {
      saved = null;
    }
    const start = saved?.rect ?? { ...DEFAULT_RECT, x: window.innerWidth - DEFAULT_RECT.w - 24 };
    setRect(clampRect(start, window.innerWidth, window.innerHeight));
    if (saved) {
      setDock(saved.dock);
      setHidden(saved.hidden);
    }
    sync();
    loaded.current = true;
    mq.addEventListener("change", sync);
    window.addEventListener("resize", sync);
    return () => {
      mq.removeEventListener("change", sync);
      window.removeEventListener("resize", sync);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    // the presentation's moves are never remembered as the visitor's own
    if (!loaded.current || dragging || useHearth.getState().presenting) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ dock, hidden, rect }));
    } catch {
      /* storage blocked: the window just doesn't remember */
    }
  }, [dock, hidden, rect, dragging]);

  // Escape shrinks the expanded view back
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  const play = useCallback((a: WindowAnim, ms: number, then?: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    if (reducedMotion()) {
      setAnim(null);
      then?.();
      return;
    }
    setAnim(a);
    timer.current = setTimeout(() => {
      setAnim(null);
      then?.();
    }, ms);
  }, []);

  // commands from the presentation
  useEffect(() => {
    const onCmd = (e: Event) => {
      const c = (e as CustomEvent<WindowCommand>).detail;
      if (!c) return;
      if (c.type === "restore") {
        let saved: ReturnType<typeof parseSaved> = null;
        try {
          saved = parseSaved(window.localStorage.getItem(KEY));
        } catch {
          saved = null;
        }
        if (timer.current) clearTimeout(timer.current);
        setAnim(null);
        setExpanded(false);
        setDock(saved?.dock ?? "right");
        setHidden(saved?.hidden ?? false);
        return;
      }
      const apply = () => {
        if (c.dock) setDock(c.dock);
        if (c.expanded !== undefined) setExpanded(c.expanded);
        if (c.hidden !== undefined) setHidden(c.hidden);
      };
      if (c.anim === "out") {
        play("out", ANIM_OUT_MS, apply);
        return;
      }
      apply();
      if (c.anim) play(c.anim, c.anim === "unfold" ? ANIM_UNFOLD_MS : c.anim === "in" ? ANIM_IN_MS : 400);
      else {
        if (timer.current) clearTimeout(timer.current);
        setAnim(null);
      }
    };
    window.addEventListener(WINDOW_EVENT, onCmd);
    return () => window.removeEventListener(WINDOW_EVENT, onCmd);
  }, [play]);

  const mode: WinMode = !isDesktop ? "right" : hidden ? "hidden" : expanded ? "expand" : dock;

  /** Pointer down on the header: becomes a drag only after the pointer really moves. */
  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isDesktop || expanded || hidden || e.button !== 0) return;
      if ((e.target as HTMLElement).closest(NO_DRAG)) return;
      const sx = e.clientX;
      const sy = e.clientY;
      let from: Rect | null = dock === "float" ? rect : null;
      let active = false;
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - sx;
        const dy = ev.clientY - sy;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (!active) {
          if (Math.hypot(dx, dy) < DRAG_START_PX) return;
          active = true;
          setDragging(true);
          document.body.classList.add("vesta-dragging");
          if (!from) {
            // lift the docked panel off the side, keeping the grab point under the pointer
            const b = panelRef.current?.getBoundingClientRect();
            const w = DEFAULT_RECT.w;
            const offX = b ? Math.min(Math.max(sx - b.left, 24), w - 24) : 40;
            from = clampRect({ x: sx - offX, y: b ? b.top : TOP, w, h: Math.min(DEFAULT_RECT.h, vh - TOP - 40) }, vw, vh);
            setDock("float");
          }
        }
        setRect(clampRect({ ...from!, x: from!.x + dx, y: from!.y + dy }, vw, vh));
        setZone(snapZone(ev.clientX, vw));
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        if (!active) return;
        document.body.classList.remove("vesta-dragging");
        const z = snapZone(ev.clientX, window.innerWidth);
        setZone(null);
        setDragging(false);
        if (z) {
          setDock(z);
          play("pop", 400);
        }
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [isDesktop, expanded, hidden, dock, rect, panelRef, play],
  );

  const startResize = useCallback(
    (edge: Edge) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const sx = e.clientX;
      const sy = e.clientY;
      const from = rect;
      setDragging(true);
      document.body.classList.add("vesta-dragging");
      const onMove = (ev: PointerEvent) => setRect(resizeRect(from, edge, ev.clientX - sx, ev.clientY - sy, window.innerWidth, window.innerHeight));
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        document.body.classList.remove("vesta-dragging");
        setDragging(false);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [rect],
  );

  const dockRight = useCallback(() => {
    setExpanded(false);
    setDock("right");
    play("pop", 400);
  }, [play]);

  const toggleFloat = useCallback(() => {
    setExpanded(false);
    if (dock === "float") setDock("right");
    else {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      setRect((r) => clampRect(r.x === DEFAULT_RECT.x && r.y === DEFAULT_RECT.y ? { ...DEFAULT_RECT, x: vw - DEFAULT_RECT.w - 24 } : r, vw, vh));
      setDock("float");
    }
    play("pop", 400);
  }, [dock, play]);

  const toggleExpand = useCallback(() => {
    setExpanded((v) => !v);
    play("pop", 400);
  }, [play]);

  const hide = useCallback(() => {
    play("out", ANIM_OUT_MS, () => {
      setHidden(true);
      setExpanded(false);
    });
  }, [play]);

  const show = useCallback(() => {
    setHidden(false);
    play("in", ANIM_IN_MS);
  }, [play]);

  const box: Rect | null = mode === "float" ? rect : mode === "expand" ? expandRect(vp.w, vp.h) : null;

  return { isDesktop, mode, dock, box, anim, zone, dragging, onHeaderPointerDown, startResize, dockRight, toggleFloat, toggleExpand, hide, show };
}
