"use client";
import { useEffect, useRef } from "react";
import { useHearth } from "@/lib/store";

const TAU = Math.PI * 2;
/** One turn every 10 minutes: slow enough to feel calm, fast enough to notice the sky turning. */
const SKY_TURN = TAU / 600;
const WARP_MS = 900;
/** Little Dipper as artwork, with Polaris at the end of the handle. Not to scale, not data. */
const DIPPER = [
  [0, 0],
  [0.18, 0.3],
  [0.3, 0.6],
  [0.48, 0.85],
  [0.8, 0.9],
  [0.86, 1.2],
  [0.52, 1.18],
];
const DIPPER_LINES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 3],
];
const STAR_COLORS = ["#FFFFFF", "#CFE6FF", "#FFE9D6"];
/** Width at which the left rail appears (the `vesta` breakpoint); Polaris sits in its empty space. */
const RAIL_MIN_WIDTH = 1180;

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  twinkle: number;
  phase: number;
  color: string;
}

interface Ember {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  phase: number;
}

/**
 * Decorative background: stars turning around Polaris, embers drifting without an "up" as they
 * would in microgravity, a star streak when the mission changes. Nothing here is data.
 * Runs at a capped frame rate, fewer particles on weak devices, one still frame under reduced motion.
 */
export function SpaceBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
    const frameMs = 1000 / (weak ? 20 : 30);

    let w = 0;
    let h = 0;
    let pole = { x: 0, y: 0 };
    let dipperScale = 85;
    let stars: Star[] = [];
    let embers: Ember[] = [];
    let raf = 0;
    let last = 0;
    let energy = 0;
    let warpAt = -Infinity;
    let meteorAt = performance.now() + 15000;
    let meteor: { x: number; y: number; vx: number; vy: number; born: number } | null = null;
    const mountedAt = performance.now();

    const spawnEmber = (e: Partial<Ember> = {}): Ember => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 9,
      vy: (Math.random() - 0.5) * 9,
      life: 0,
      maxLife: 7 + Math.random() * 9,
      size: 0.8 + Math.random() * 1.5,
      phase: Math.random() * TAU,
      ...e,
    });

    const seed = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      const hasRail = w >= RAIL_MIN_WIDTH;
      pole = hasRail ? { x: 112, y: Math.max(h * 0.62, 430) } : { x: w - 64, y: Math.min(190, h * 0.3) };
      dipperScale = hasRail ? 85 : 44;
      const maxR = Math.hypot(Math.max(pole.x, w - pole.x), Math.max(pole.y, h - pole.y));
      const onScreen = Math.min(140, (w * h) / 9000) * (weak ? 0.55 : 1);
      // Stars fill the whole circle around the pole, so they keep covering the screen as it turns.
      const total = Math.ceil(onScreen * Math.min(6, (Math.PI * maxR * maxR) / (w * h)));
      stars = Array.from({ length: total }, () => {
        const r = maxR * Math.sqrt(Math.random());
        const a = Math.random() * TAU;
        const big = Math.random() < 0.08;
        return {
          x: Math.cos(a) * r,
          y: Math.sin(a) * r,
          size: big ? 1.8 : 0.8 + Math.random() * 0.7,
          alpha: big ? 0.9 : 0.25 + Math.random() * 0.5,
          twinkle: 0.5 + Math.random() * 1.6,
          phase: Math.random() * TAU,
          color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
        };
      });
      embers = Array.from({ length: weak ? 8 : 18 }, () => spawnEmber({ life: Math.random() * 6 }));
    };

    const drawPolaris = (angle: number, t: number) => {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const points = DIPPER.map(([dx, dy]) => ({
        x: pole.x + (dx * c - dy * s) * dipperScale,
        y: pole.y + (dx * s + dy * c) * dipperScale,
      }));
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = "#CFE6FF";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [a, b] of DIPPER_LINES) {
        ctx.moveTo(points[a].x, points[a].y);
        ctx.lineTo(points[b].x, points[b].y);
      }
      ctx.stroke();
      ctx.fillStyle = "#E8F3FF";
      ctx.globalAlpha = 0.75;
      for (const p of points.slice(1)) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, TAU);
        ctx.fill();
      }
      const pulse = reduce ? 1 : 1 + Math.sin(t * 1.6) * 0.14;
      const glow = ctx.createRadialGradient(pole.x, pole.y, 0, pole.x, pole.y, 20 * pulse);
      glow.addColorStop(0, "rgba(207,230,255,0.6)");
      glow.addColorStop(0.3, "rgba(207,230,255,0.16)");
      glow.addColorStop(1, "rgba(207,230,255,0)");
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(pole.x, pole.y, 20 * pulse, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.globalAlpha = 0.85;
      const ray = 13 * pulse;
      ctx.beginPath();
      ctx.moveTo(pole.x - ray, pole.y);
      ctx.lineTo(pole.x + ray, pole.y);
      ctx.moveTo(pole.x, pole.y - ray * 1.35);
      ctx.lineTo(pole.x, pole.y + ray * 1.35);
      ctx.stroke();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(pole.x, pole.y, 2.2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = "#CFE6FF";
      ctx.font = "9px ui-monospace, monospace";
      // without the rail the star sits near the right edge, so the label goes on its left
      const labelOnLeft = w < RAIL_MIN_WIDTH;
      ctx.textAlign = labelOnLeft ? "right" : "left";
      ctx.fillText("P O L A R I S", pole.x + (labelOnLeft ? -16 : 16), pole.y - 8);
    };

    const draw = (now: number) => {
      const t = now / 1000;
      const dt = Math.min(0.1, frameMs / 1000);
      const busy = useHearth.getState().busy;
      energy += ((busy ? 1 : 0) - energy) * 0.06;
      const warpT = (now - warpAt) / WARP_MS;
      const warp = warpT >= 0 && warpT < 1 ? (1 - warpT) * (1 - warpT) : 0;
      const angle = (reduce ? 40 : t) * SKY_TURN;
      const c = Math.cos(angle);
      const s = Math.sin(angle);

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      for (const star of stars) {
        const x = pole.x + star.x * c - star.y * s;
        const y = pole.y + star.x * s + star.y * c;
        if (x < -2 || y < -2 || x > w + 2 || y > h + 2) continue;
        const flicker = reduce ? 1 : 0.68 + 0.32 * Math.sin(t * star.twinkle + star.phase);
        ctx.globalAlpha = star.alpha * flicker;
        if (warp > 0.01) {
          ctx.strokeStyle = star.color;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (x - pole.x) * warp * 0.16, y + (y - pole.y) * warp * 0.16);
          ctx.stroke();
        } else {
          ctx.fillStyle = star.color;
          ctx.fillRect(x, y, star.size, star.size);
        }
      }

      drawPolaris(angle, t);

      const speed = 1 + energy * 2.4;
      for (let i = 0; i < embers.length; i++) {
        const e = embers[i];
        if (!reduce) {
          e.life += dt;
          e.x += (e.vx + Math.sin(t * 0.7 + e.phase) * 4) * dt * speed;
          e.y += (e.vy + Math.cos(t * 0.6 + e.phase) * 4) * dt * speed;
          if (e.life > e.maxLife) {
            embers[i] = spawnEmber();
            continue;
          }
        }
        const fade = reduce ? 0.6 : Math.sin((e.life / e.maxLife) * Math.PI);
        ctx.fillStyle = "#FF7A2F";
        ctx.globalAlpha = fade * (0.1 + energy * 0.1);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size * 3.2, 0, TAU);
        ctx.fill();
        ctx.fillStyle = "#FFB98A";
        ctx.globalAlpha = fade * (0.65 + energy * 0.3);
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.size, 0, TAU);
        ctx.fill();
      }

      if (!reduce) {
        if (!meteor && now > meteorAt) {
          meteor = { x: Math.random() * w, y: Math.random() * h * 0.4, vx: -300 - Math.random() * 180, vy: 130 + Math.random() * 90, born: now };
          meteorAt = now + 22000 + Math.random() * 26000;
        }
        if (meteor) {
          const age = (now - meteor.born) / 1000;
          if (age > 0.85) meteor = null;
          else {
            const x = meteor.x + meteor.vx * age;
            const y = meteor.y + meteor.vy * age;
            ctx.strokeStyle = "#FFFFFF";
            ctx.globalAlpha = 0.65 * (1 - age / 0.85);
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x - meteor.vx * 0.13, y - meteor.vy * 0.13);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      // hold still during the presentation, and while the demo video plays over the page, so either stays smooth
      if (useHearth.getState().presenting || document.documentElement.classList.contains("demo-watching")) return;
      if (now - last < frameMs) return;
      last = now;
      draw(now);
    };

    seed();
    if (reduce) draw(performance.now());
    else raf = requestAnimationFrame(loop);

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        seed();
        if (reduce) draw(performance.now());
      }, 150);
    };
    window.addEventListener("resize", onResize);
    const unsubscribe = useHearth.subscribe((state, prev) => {
      // ignore the mission restored from saved preferences right after loading
      if (!reduce && state.missionId !== prev.missionId && performance.now() - mountedAt > 1500) warpAt = performance.now();
    });

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener("resize", onResize);
      unsubscribe();
    };
  }, []);

  return (
    <div aria-hidden className="space-backdrop pointer-events-none fixed inset-0 z-0">
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
