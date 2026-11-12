"use client";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { useHearth } from "@/lib/store";

/**
 * Panels below the fold rise into view as you scroll to them. Only panels that start off screen are
 * touched, so nothing visible ever blinks; switched off under reduced motion or in the looks menu.
 */
export function ScrollReveal() {
  const on = useHearth((s) => s.reveal);
  const path = usePathname();
  useEffect(() => {
    if (!on || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    let io: IntersectionObserver | null = null;
    const marked: Element[] = [];
    const t = setTimeout(() => {
      io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            if (!e.isIntersecting) continue;
            e.target.classList.remove("reveal-pending");
            e.target.classList.add("reveal-in");
            io?.unobserve(e.target);
          }
        },
        { rootMargin: "0px 0px -8% 0px" },
      );
      document.querySelectorAll("#main .hud-panel").forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) return;
        el.classList.add("reveal-pending");
        marked.push(el);
        io!.observe(el);
      });
    }, 80);
    return () => {
      clearTimeout(t);
      io?.disconnect();
      marked.forEach((el) => el.classList.remove("reveal-pending", "reveal-in"));
    };
  }, [on, path]);
  return null;
}
