"use client";
import { useEffect, useRef } from "react";
import { useHearth } from "@/lib/store";

const MAX = 70;
const LIFE_MS = 650;

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  born: number;
  r: number;
}

/**
 * A few embers drift off the mouse pointer. Decoration only, drawn on one canvas that sleeps when idle.
 * Off on touch screens, under reduced motion, and when switched off in the looks menu.
 */
export function EmberTrail() {
  const on = useHearth((s) => s.trail);
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!on || !canvas || !window.matchMedia?.("(pointer: fine)").matches || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    const sparks: Spark[] = [];
    let raf = 0;
    let rgb = "255,122,47";
    const readColour = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue("--ember-rgb").trim();
      if (v) rgb = v.split(/\s+/).join(",");
    };
    readColour();
    let lastX = -1;
    let lastY = -1;
    const draw = () => {
      const now = performance.now();
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        const age = (now - s.born) / LIFE_MS;
        if (age >= 1) {
          sparks.splice(i, 1);
          continue;
        }
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.96;
        s.vy *= 0.96;
        const a = (1 - age) * 0.8;
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 3);
        g.addColorStop(0, `rgba(255,244,232,${a})`);
        g.addColorStop(0.4, `rgba(${rgb},${a * 0.8})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = sparks.length ? requestAnimationFrame(draw) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const moved = Math.hypot(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      if (moved < 6) return;
      if (sparks.length < MAX) {
        const ang = Math.random() * Math.PI * 2;
        const sp = 0.3 + Math.random() * 0.6;
        sparks.push({ x: e.clientX, y: e.clientY, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, born: performance.now(), r: 1 + Math.random() * 1.6 });
      }
      if (!raf) raf = requestAnimationFrame(draw);
    };
    const obs = new MutationObserver(readColour);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-skin"] });
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("resize", size);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", size);
      obs.disconnect();
      if (raf) cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
  }, [on]);

  if (!on) return null;
  return <canvas ref={ref} className="pointer-events-none fixed inset-0 z-[55] h-full w-full" aria-hidden />;
}
