"use client";
import { useEffect, useState } from "react";
import { IconSparkle } from "@/components/ui/Icons";
import { useHearth } from "@/lib/store";
import { cleanSelection } from "@/lib/textfx";
import { useVesta } from "./useVesta";

const SKIP = "textarea, input, select, [contenteditable='true'], #vesta-panel form, [data-no-ask]";

/** Select any text on the site and a small "Ask VESTA about this" button appears next to it. */
export function AskSelection() {
  const [at, setAt] = useState<{ x: number; y: number; text: string } | null>(null);
  const { send } = useVesta();

  useEffect(() => {
    const check = () => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return setAt(null);
      const host = sel.anchorNode instanceof Element ? sel.anchorNode : sel.anchorNode?.parentElement;
      if (host?.closest(SKIP)) return setAt(null);
      const text = cleanSelection(sel.toString());
      if (!text) return setAt(null);
      const r = sel.getRangeAt(0).getBoundingClientRect();
      if (!r.width && !r.height) return setAt(null);
      setAt({ x: r.left + r.width / 2, y: r.top, text });
    };
    const later = () => setTimeout(check, 10);
    const hide = () => setAt(null);
    document.addEventListener("mouseup", later);
    document.addEventListener("keyup", later);
    window.addEventListener("scroll", hide, true);
    return () => {
      document.removeEventListener("mouseup", later);
      document.removeEventListener("keyup", later);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!at) return null;
  const left = Math.max(8, Math.min(window.innerWidth - 200, at.x - 96));
  const top = Math.max(56, at.y - 44);
  const ask = () => {
    const st = useHearth.getState();
    if (st.busy) return;
    send(`Explain this using the NASA data: "${at.text}"`);
    st.track({ kind: "selection" });
    st.requestOpen();
    window.getSelection()?.removeAllRanges();
    setAt(null);
  };
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={ask}
      className="ask-selection fixed z-[45] flex items-center gap-1.5 rounded-full border border-ember/60 bg-raised px-3 py-1.5 text-xs font-semibold text-text shadow-[0_10px_26px_rgba(0,0,0,0.55),0_0_16px_rgb(var(--ember-rgb)/0.3)]"
      style={{ left, top }}
    >
      <IconSparkle className="h-3.5 w-3.5 text-ember" />
      Ask VESTA about this
    </button>
  );
}
