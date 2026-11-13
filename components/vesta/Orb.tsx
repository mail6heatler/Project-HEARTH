"use client";
import { useEffect, useRef } from "react";

const TAU = Math.PI * 2;
const FRAME_MS = 1000 / 30;
const SEGMENTS = 56;

type Variant = "vesta" | "flame";

/** rgb + peak opacity. Each layer fades to nothing at its own edge, so the flame has no hard outline. */
const LAYERS: Record<Variant, { k: number; rgb: string; a: number }[]> = {
  // VESTA's head: a warm, even ember with no white-hot centre, so her face reads clearly on top
  vesta: [
    { k: 1.12, rgb: "255,122,47", a: 0.22 },
    { k: 0.98, rgb: "226,92,30", a: 1 },
    { k: 0.84, rgb: "255,122,48", a: 0.95 },
    { k: 0.6, rgb: "255,150,86", a: 0.55 },
  ],
  // Hero artwork: a round flame with a blue outer shell and a warm core
  flame: [
    { k: 1.12, rgb: "76,201,240", a: 0.26 },
    { k: 0.94, rgb: "96,150,250", a: 0.34 },
    { k: 0.74, rgb: "255,122,47", a: 0.6 },
    { k: 0.5, rgb: "255,165,95", a: 0.8 },
    { k: 0.28, rgb: "255,244,232", a: 1 },
  ],
};

/**
 * Living flame on a canvas: a wobbling sphere, because flames have no "up" in microgravity.
 * Calm when idle, faster and brighter when VESTA is working. Decoration only, it encodes no data.
 * One still frame under reduced motion; skips drawing while off screen.
 */
export function Orb({ thinking, size = 44, variant = "vesta" }: { thinking: boolean; size?: number; variant?: Variant }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const thinkingRef = useRef(thinking);
  thinkingRef.current = thinking;

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const center = size / 2;
    const radius = center * 0.8;
    const layers = LAYERS[variant];
    const head = variant === "vesta";
    let raf = 0;
    let last = 0;
    let t = 1;
    let heat = thinkingRef.current ? 1 : 0;
    let visible = true;

    const draw = () => {
      heat += ((thinkingRef.current ? 1 : 0) - heat) * 0.08;
      ctx.clearRect(0, 0, size, size);
      // the hero flame adds its layers up into a white-hot core; VESTA's head paints them over each other
      ctx.globalCompositeOperation = head ? "source-over" : "lighter";

      const glow = ctx.createRadialGradient(center, center, radius * (head ? 0.7 : 0.2), center, center, center);
      glow.addColorStop(0, `rgba(255,122,47,${head ? 0.16 + heat * 0.14 : 0.3 + heat * 0.2})`);
      glow.addColorStop(1, "rgba(255,122,47,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, size, size);

      const wobble = 1 + heat * 0.9;
      layers.forEach((layer, i) => {
        const soft = ctx.createRadialGradient(center, center, 0, center, center, radius * layer.k * 1.12);
        soft.addColorStop(0, `rgba(${layer.rgb},${layer.a})`);
        soft.addColorStop(0.55, `rgba(${layer.rgb},${layer.a * 0.7})`);
        soft.addColorStop(1, `rgba(${layer.rgb},0)`);
        ctx.fillStyle = soft;
        ctx.beginPath();
        for (let s = 0; s <= SEGMENTS; s++) {
          const a = (s / SEGMENTS) * TAU;
          const shape =
            0.045 * Math.sin(3 * a + t * 1.1 + i) + 0.03 * Math.sin(5 * a - t * 1.7 + i * 2) + 0.016 * Math.sin(9 * a + t * 2.6 + i * 3);
          const r = radius * layer.k * (1 + shape * wobble);
          const x = center + Math.cos(a) * r;
          const y = center + Math.sin(a) * r;
          if (s === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      });

      ctx.globalCompositeOperation = "source-over";
      if (head) {
        // a soft highlight on the forehead gives the head some roundness, away from the eyes
        const hx = center - radius * 0.32;
        const hy = center - radius * 0.5;
        const shine = ctx.createRadialGradient(hx, hy, 0, hx, hy, radius * 0.36);
        shine.addColorStop(0, "rgba(255,226,200,0.42)");
        shine.addColorStop(1, "rgba(255,226,200,0)");
        ctx.fillStyle = shine;
        ctx.fillRect(0, 0, size, size);
      }
      const rings = variant === "flame" ? 2 : 1;
      for (let i = 0; i < rings; i++) {
        const tilt = i === 0 ? 0.42 : -0.5;
        const spin = t * (0.5 + heat * 1.1) * (i === 0 ? 1 : -0.7);
        const rx = center * (i === 0 ? 0.94 : 0.82);
        const ry = rx * 0.32;
        ctx.strokeStyle = i === 0 ? `rgba(255,185,138,${head ? 0.22 : 0.34})` : "rgba(76,201,240,0.3)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(center, center, rx, ry, tilt, 0, TAU);
        ctx.stroke();
        const sx = Math.cos(spin) * rx;
        const sy = Math.sin(spin) * ry;
        ctx.fillStyle = i === 0 ? "#FFF3E8" : "#4CC9F0";
        ctx.beginPath();
        ctx.arc(center + sx * Math.cos(tilt) - sy * Math.sin(tilt), center + sx * Math.sin(tilt) + sy * Math.cos(tilt), Math.max(1.4, size / 60), 0, TAU);
        ctx.fill();
      }
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || now - last < FRAME_MS) return;
      last = now;
      t += thinkingRef.current ? 0.085 : 0.03;
      draw();
    };

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    io.observe(canvas);
    if (reduce) draw();
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [size, variant]);

  return <canvas ref={ref} style={{ width: size, height: size }} aria-hidden className="shrink-0" />;
}
