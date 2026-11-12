"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { GlossaryTerm } from "@/lib/glossary";

type Passage = { source_file: string; page: number; snippet: string } | null;
const cache = new Map<string, Promise<Passage>>();

/** The best NASA passage for a term: only one that really mentions it, otherwise none (never an unrelated quote). */
function passageFor(term: GlossaryTerm): Promise<Passage> {
  let p = cache.get(term.id);
  if (!p) {
    const words = [...term.match, term.query].map((w) => w.toLowerCase());
    p = fetch(`/api/search?q=${encodeURIComponent(term.query)}&limit=5`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => ((j?.passages ?? []) as NonNullable<Passage>[]).find((x) => words.some((w) => x.snippet.toLowerCase().includes(w))) ?? null)
      .catch(() => null);
    cache.set(term.id, p);
  }
  return p;
}

/** A glossary word in an answer: dotted underline; hover or focus shows a plain definition plus a NASA passage with its page. */
export function Term({ term, children }: { term: GlossaryTerm; children: React.ReactNode }) {
  const [at, setAt] = useState<{ left: number; top?: number; bottom?: number } | null>(null);
  const [passage, setPassage] = useState<Passage | undefined>(undefined);
  const ref = useRef<HTMLButtonElement>(null);
  const open = !!at;
  // the card is placed against the screen, so the chat's scroll area cannot clip it
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const up = r.bottom + 190 > window.innerHeight;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - 272));
    setAt(up ? { left, bottom: window.innerHeight - r.top + 6 } : { left, top: r.bottom + 6 });
    if (passage === undefined) passageFor(term).then(setPassage);
  };
  const hide = () => setAt(null);
  useEffect(() => {
    if (!at) return;
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [at]);
  return (
    <span className="relative inline">
      <button
        type="button"
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={() => (open ? hide() : show())}
        aria-expanded={open}
        className="glossary-term"
      >
        {children}
      </button>
      {at &&
        createPortal(
        <span role="tooltip" style={at} className="fixed z-[60] block w-64 animate-fadeUp rounded-lg border border-[#2c3b5e] bg-raised p-2.5 text-left text-[12px] leading-snug text-text shadow-[0_12px_28px_rgba(0,0,0,0.55)]">
          <span className="block font-head text-[12px] font-semibold text-ember-soft">{term.title}</span>
          <span className="mt-1 block text-text/90">{term.plain}</span>
          {passage === undefined ? (
            <span className="mt-1.5 block font-mono text-[10px] text-muted">Looking in the NASA documents…</span>
          ) : passage ? (
            <span className="mt-1.5 block border-t border-line pt-1.5 text-[11px] text-muted">
              “{passage.snippet.slice(0, 160)}{passage.snippet.length > 160 ? "…" : ""}”
              <span className="mt-0.5 block font-mono text-[10px]">
                {passage.source_file.split("/").pop()} · p{passage.page}
              </span>
            </span>
          ) : (
            <span className="mt-1.5 block font-mono text-[10px] text-muted">No passage found in the NASA documents.</span>
          )}
        </span>,
          document.body,
        )}
    </span>
  );
}
