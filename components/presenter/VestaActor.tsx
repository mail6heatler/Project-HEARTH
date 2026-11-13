"use client";
import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { Orb } from "@/components/vesta/Orb";
import { VestaFace } from "@/components/vesta/VestaFace";
import { curvePoint, easeInOutCubic, type Pt } from "@/lib/presenter/motion";
import type { Level } from "@/lib/store";
import type { Glasses, Mood } from "@/lib/vesta/mood";

/** Her size in the middle of the screen (px). */
const SIZE = 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

const place = (p: Pt, s: number, deg: number) => `translate3d(${p.x - SIZE / 2}px, ${p.y - SIZE / 2}px, 0) scale(${s}) rotate(${deg}deg)`;

export interface ActorApi {
  /**
   * Mini VESTA flies from `from` (the mini orb) to the middle of the screen on a curve, spinning and growing,
   * lands with a squash, drops her sunglasses on and says `hello`. `onRise` / `onLand` play the sounds.
   */
  arrive(from: DOMRect | null, opts: { calm: boolean; hello?: string; onRise?: () => void; onLand?: () => void }): Promise<void>;
  /** She spins down to a point and is gone, while her chat window unfolds from the same spot. */
  leave(calm: boolean): Promise<void>;
}

/**
 * The presentation's big VESTA: the same orb and face as in the chat, made large for her entrance.
 * Decoration only (no data). Motion is the Web Animations API, which the demo recorder's clock also drives.
 */
export const VestaActor = forwardRef<ActorApi, { level: Level }>(function VestaActor({ level }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const at = useRef<Pt>({ x: 0, y: 0 });
  const first = useRef("");
  const [on, setOn] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [glasses, setGlasses] = useState<Glasses>("on");
  const [drop, setDrop] = useState<number | undefined>(undefined);
  const [hello, setHello] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);

  useImperativeHandle(
    ref,
    () => ({
      async arrive(from, { calm, hello: line, onRise, onLand }) {
        const end = { x: window.innerWidth / 2, y: window.innerHeight / 2 - 24 };
        const start = from ? { x: from.left + from.width / 2, y: from.top + from.height / 2 } : end;
        const s0 = from ? from.width / SIZE : 0.3;
        at.current = end;
        // drawn straight onto the mini orb on its first frame (no flash in a corner)
        first.current = place(start, s0, 0);
        setMood("idle");
        // she flies without her glasses and puts them on when she lands
        setGlasses("off");
        setDrop(undefined);
        setHello(null);
        setOn(true);
        await frame();
        await frame();
        const node = el.current;
        if (!node) return;
        if (!calm) {
          onRise?.();
          const frames: Keyframe[] = [];
          for (let i = 0; i <= 24; i++) {
            const k = easeInOutCubic(i / 24);
            frames.push({ transform: place(curvePoint(start, end, k, -0.32), s0 + (1 - s0) * k, 360 * k) });
          }
          const fly = node.animate(frames, { duration: 1000, easing: "linear", fill: "forwards" });
          await fly.finished;
          node.style.transform = place(end, 1, 0);
          fly.cancel();
          // squash and stretch as she lands
          const base = place(end, 1, 0);
          await node.animate([{ transform: base }, { transform: `${base} scale(1.1, 0.9)` }, { transform: `${base} scale(0.96, 1.05)` }, { transform: base }], { duration: 420, easing: "ease-out" }).finished;
        } else node.style.transform = place(end, 1, 0);
        first.current = place(end, 1, 0);
        setBurst((b) => b + 1);
        setGlasses("on");
        setDrop((d) => (d ?? 0) + 1);
        setMood("happy");
        onLand?.();
        if (line) setHello(line);
        await sleep(calm ? 300 : 1300);
      },
      async leave(calm) {
        const node = el.current;
        setHello(null);
        if (node && !calm) {
          const a = node.animate(
            [
              { transform: place(at.current, 1, 0), opacity: 1 },
              { transform: place(at.current, 0.2, 200), opacity: 0 },
            ],
            { duration: 460, easing: "cubic-bezier(0.5, 0, 0.75, 0)", fill: "forwards" },
          );
          await a.finished;
        }
        setOn(false);
        setBurst(0);
      },
    }),
    [],
  );

  if (!on) return null;
  return (
    <div ref={el} className="vesta-actor pointer-events-none fixed left-0 top-0 z-[80]" style={{ width: SIZE, height: SIZE, transform: first.current }} aria-hidden>
      {burst > 0 && (
        <span key={burst} className="actor-burst">
          {Array.from({ length: 12 }, (_, i) => (
            <i key={i} style={{ "--a": `${i * 30}deg` } as React.CSSProperties} />
          ))}
        </span>
      )}
      <Orb thinking={mood === "thinking"} size={SIZE} />
      <VestaFace mood={mood} level={level} glasses={glasses} glassesDrop={drop} />
      {hello && <span className="actor-hello">{hello}</span>}
    </div>
  );
});
