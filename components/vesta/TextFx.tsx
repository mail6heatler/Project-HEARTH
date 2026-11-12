"use client";
import { useEffect, useRef, useState } from "react";
import { odometerChars, scrambleFrame, stripMarkdown } from "@/lib/textfx";

const calm = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Text that "decodes" letter by letter when it changes. Digits and punctuation never scramble. */
export function ScrambleText({ text, ms = 420, className = "" }: { text: string; ms?: number; className?: string }) {
  const [shown, setShown] = useState(text);
  const first = useRef(true);
  useEffect(() => {
    if (first.current || calm()) {
      first.current = false;
      setShown(text);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = (t - start) / ms;
      setShown(p >= 1 ? text : scrambleFrame(text, p));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text, ms]);
  return (
    <span className={className}>
      <span aria-hidden>{shown}</span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** A number that rolls like a car odometer. Each digit is a column of 0–9 that slides to its value. */
export function Odometer({ value, className = "" }: { value: string; className?: string }) {
  const chars = odometerChars(value);
  return (
    <span className={`odometer ${className}`} aria-label={value} role="img">
      {chars.map((c, i) =>
        c.digit === null ? (
          <span key={`${i}-${c.ch}`} aria-hidden>
            {c.ch}
          </span>
        ) : (
          <span key={`d${chars.length - i}`} className="odo-digit" aria-hidden>
            <span className="odo-strip" style={{ transform: `translateY(-${c.digit * 10}%)` }}>
              {"0123456789".split("").map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        ),
      )}
    </span>
  );
}

/**
 * The live view of an answer while it streams: each new word "decodes" out of a blur. Words that are
 * already on screen keep their place, so only new text animates. Markdown markers are hidden until the
 * final answer renders.
 */
export function StreamingText({ text }: { text: string }) {
  const tokens = stripMarkdown(text).split(/(\s+)/);
  return (
    <p className="whitespace-pre-wrap">
      {tokens.map((t, i) =>
        /^\s+$/.test(t) || !t ? (
          t
        ) : (
          <span key={i} className="decode-in">
            {t}
          </span>
        ),
      )}
    </p>
  );
}

/** Types text out once, for incoming transmissions. The full text is always there for screen readers. */
export function Typewriter({ text, cps = 70, className = "" }: { text: string; cps?: number; className?: string }) {
  const [n, setN] = useState(() => (calm() ? text.length : 0));
  useEffect(() => {
    if (calm()) {
      setN(text.length);
      return;
    }
    setN(0);
    const t = setInterval(() => setN((v) => (v >= text.length ? v : v + 2)), 1000 / (cps / 2));
    return () => clearInterval(t);
  }, [text, cps]);
  const done = n >= text.length;
  return (
    <span className={className}>
      <span aria-hidden className={done ? "" : "typing-caret"}>
        {text.slice(0, n)}
      </span>
      <span className="sr-only">{text}</span>
    </span>
  );
}

/** Cycles example questions through a placeholder, typing and deleting them. Stops while the box has text. */
export function useTypedPlaceholder(examples: string[], active: boolean, fallback: string): string {
  const [out, setOut] = useState(fallback);
  useEffect(() => {
    if (!active || calm() || !examples.length) {
      setOut(fallback);
      return;
    }
    let i = 0;
    let n = 0;
    let dir = 1;
    let hold = 0;
    const t = setInterval(() => {
      const ex = examples[i % examples.length];
      if (hold > 0) {
        hold--;
        return;
      }
      n += dir;
      if (n >= ex.length) {
        dir = -1;
        hold = 28;
      } else if (n <= 0) {
        dir = 1;
        i++;
        hold = 4;
      }
      setOut(`Try: ${ex.slice(0, Math.max(0, n))}`);
    }, 55);
    return () => clearInterval(t);
  }, [examples, active, fallback]);
  return out;
}
