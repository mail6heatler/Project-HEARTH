import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { O2_TICKS, PO2_TICKS, PRESSURE_TICKS, SCALE, INV_COLORS, aggregate, issCurve, o2ToZ, pickNearest, po2ToY, pointPx, pressureToX, toScene, xToPressure, type Agg, type MapData } from "@/lib/map3d";
import { pO2 } from "@/lib/physics";
import type { Mission } from "@/lib/types";
import { SUN_DIR, makeBackdrop } from "./backdrop";
import { missionModel } from "./models";

export interface LabPoint {
  label: string;
  o2_pct: number;
  pressure_psi: number;
}

export type Hover = { kind: "test"; agg: Agg; x: number; y: number } | { kind: "lab"; lab: LabPoint; x: number; y: number };

export interface EngineCallbacks {
  onHover: (h: Hover | null) => void;
  onOpenTest: (id: string) => void;
  onSelectMission: (id: string) => void;
  onLost: () => void;
}

/** A low viewing angle keeps the map in front of the planets instead of looking down past them. */
const HOME_POS = new THREE.Vector3(-3, 7, 21.5);
const HOME_TARGET = new THREE.Vector3(0, 2, 0);
const FOCUS_DISTANCE = 17;
/** How far the view leans towards the active mission: 1 would centre it, less keeps the whole map in frame. */
const FOCUS_LEAN = 0.5;
const FLY_MS = 1500;
const CLEAR = "#03060d";
/** World size of a point per pixel of the flat chart's size rule; includes room for the soft glow. */
const WORLD_PER_PX = 0.05;
/** Mission models are symbols: large enough to recognise from the opening view. */
const MODEL_SCALE = 1.5;
/** Keeps neighbouring mission labels apart: their horizontal anchor. */
const LABEL_ANCHOR: Record<string, string> = { "lunar-rover": "-100%", "lunar-base": "-20%", iss: "-10%" };

const POINT_VERTEX = /* glsl */ `
  attribute vec3 aColor; attribute float aSize; varying vec3 vC; uniform float uScale;
  void main() {
    vC = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(4.0, aSize * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  varying vec3 vC; uniform float uDim;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = smoothstep(0.34, 0.2, r);
    float glow = pow(max(1.0 - r, 0.0), 2.2) * 0.62;
    gl_FragColor = vec4(mix(vC, vec3(1.0), core * 0.62), (core + glow) * uDim);
  }
`;

const TRIANGLE_FRAGMENT = /* glsl */ `
  varying vec3 vC;
  void main() {
    vec2 p = (gl_PointCoord - vec2(0.5, 0.56)) * vec2(1.0, -1.0) * 2.0;
    float d = max(abs(p.x) * 0.866 + p.y * 0.5, -p.y) - 0.42;
    gl_FragColor = vec4(vC, smoothstep(0.03, -0.03, d));
  }
`;

const RING_FRAGMENT = /* glsl */ `
  varying vec3 vC; uniform float uTime; uniform float uCore;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float ph = fract(uTime * 0.42);
    float ring = smoothstep(0.035, 0.0, abs(r - (0.22 + ph * 0.72))) * (1.0 - ph);
    float still = smoothstep(0.022, 0.0, abs(r - 0.4)) * 0.75;
    float core = smoothstep(0.14, 0.0, r) * uCore;
    gl_FragColor = vec4(vC, ring + still + core);
  }
`;

interface Pickable {
  position: THREE.Vector3;
  reachPx: number;
  agg?: Agg;
  lab?: LabPoint;
}

interface LabelSlot {
  el: HTMLElement;
  position: THREE.Vector3;
  anchorX?: string;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Three.js scene for the Habitat relevance map. Knows nothing about React; receives data and calls back. */
export class HabitatEngine {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private backdrop: ReturnType<typeof makeBackdrop>;
  private world = new THREE.Group();
  private dataLayer = new THREE.Group();
  private labLayer = new THREE.Group();
  private highlightLayer = new THREE.Group();
  private missionLayer = new THREE.Group();
  private uniforms = { scale: { value: 1 }, dim: { value: 1 }, time: { value: 0 } };
  private pickables: Pickable[] = [];
  private labPickables: Pickable[] = [];
  private labels: LabelSlot[] = [];
  private missionLabels = new Map<string, LabelSlot>();
  private missionModels = new Map<string, THREE.Group>();
  private activeRing: THREE.Points;
  private data: MapData | null = null;
  private activeMission: string | null = null;
  private fly: { fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; start: number; duration: number } | null = null;
  private raf = 0;
  private lastFrame = 0;
  private frameMs: number;
  private visible = true;
  private dirty = true;
  private idleSince = 0;
  private pointerDown: { x: number; y: number; at: number } | null = null;
  private observer: IntersectionObserver;
  private resizer: ResizeObserver;
  private v = new THREE.Vector3();
  private disposed = false;

  constructor(
    private host: HTMLElement,
    private overlay: HTMLElement,
    private cb: EngineCallbacks,
    private reduce: boolean,
  ) {
    const nav = navigator as Navigator & { deviceMemory?: number };
    const weak = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
    this.frameMs = 1000 / (weak ? 24 : 40);
    const pixelRatio = weak ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);

    this.renderer = new THREE.WebGLRenderer({ antialias: !weak, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setClearColor(CLEAR);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const canvas = this.renderer.domElement;
    canvas.style.display = "block";
    host.appendChild(canvas);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 400);
    this.camera.position.copy(HOME_POS);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.target.copy(HOME_TARGET);
    this.controls.enableDamping = !reduce;
    this.controls.dampingFactor = 0.07;
    this.controls.enablePan = false;
    this.controls.minDistance = 4;
    this.controls.maxDistance = 34;
    this.controls.minPolarAngle = 0.35;
    this.controls.maxPolarAngle = 1.52;
    this.controls.minAzimuthAngle = -1.25;
    this.controls.maxAzimuthAngle = 1.25;
    this.controls.addEventListener("change", () => {
      this.dirty = true;
    });
    // On phones a vertical swipe must still scroll the page; sideways drags turn the scene.
    canvas.style.touchAction = "pan-y";

    this.scene.add(new THREE.AmbientLight("#8ea4d8", 0.55));
    const sun = new THREE.DirectionalLight("#fff3e0", 3);
    sun.position.copy(SUN_DIR).multiplyScalar(50);
    this.scene.add(sun);
    // soft light from the viewer's side, so the mission models never turn into silhouettes
    const fill = new THREE.DirectionalLight("#bcd0ff", 1.1);
    fill.position.set(-8, 10, 20);
    this.scene.add(fill);

    this.backdrop = makeBackdrop(weak, pixelRatio);
    this.scene.add(this.backdrop.group);
    this.world.add(this.dataLayer, this.labLayer, this.highlightLayer, this.missionLayer);
    this.scene.add(this.world);

    this.activeRing = this.ringPoints([new THREE.Vector3()], "#ff7a2f", 2.1, 0);
    this.activeRing.visible = false;
    this.missionLayer.add(this.activeRing);

    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointerleave", this.onPointerLeave);
    canvas.addEventListener("webglcontextlost", this.onContextLost);

    this.observer = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
    });
    this.observer.observe(host);
    this.resizer = new ResizeObserver(() => this.resize());
    this.resizer.observe(host);
    this.resize();
    this.idleSince = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  // ------------------------------------------------------------------ public

  setData(data: MapData, missions: Mission[]) {
    this.data = data;
    this.buildGround();
    this.buildSheet(data);
    this.buildPoints(data);
    this.buildMissions(missions);
    this.dirty = true;
  }

  setMission(id: string | null, missions: Mission[], animate: boolean) {
    this.activeMission = id;
    const m = missions.find((x) => x.id === id);
    for (const [mid, slot] of this.missionLabels) slot.el.setAttribute("aria-pressed", String(mid === id));
    if (!m) {
      this.activeRing.visible = false;
      return;
    }
    const p = toScene(m.pressure_psi, m.o2_pct);
    this.activeRing.position.set(p.x, p.y + 0.12, p.z);
    this.activeRing.visible = true;
    const target = new THREE.Vector3(p.x * FOCUS_LEAN, HOME_TARGET.y, p.z * FOCUS_LEAN);
    const offset = this.camera.position.clone().sub(this.controls.target).normalize().multiplyScalar(FOCUS_DISTANCE);
    this.flyTo(target.clone().add(offset), target, animate && !this.reduce);
  }

  setHighlight(ids: string[]) {
    this.clearLayer(this.highlightLayer);
    const set = new Set(ids);
    const hits = (this.data?.points ?? []).filter((p) => set.has(p.test_id));
    this.uniforms.dim.value = hits.length ? 0.42 : 1;
    if (hits.length) {
      const positions = hits.map((p) => {
        const s = toScene(p.pressure_psi, p.o2_pct);
        return new THREE.Vector3(s.x, s.y, s.z);
      });
      this.highlightLayer.add(this.ringPoints(positions, "#ffffff", 0.75, 1));
    }
    this.dirty = true;
  }

  setLabRows(rows: LabPoint[]) {
    this.clearLayer(this.labLayer);
    this.labPickables = rows.map((lab) => {
      const s = toScene(lab.pressure_psi, lab.o2_pct);
      return { position: new THREE.Vector3(s.x, s.y, s.z), reachPx: 12, lab };
    });
    if (rows.length) {
      const geo = new THREE.BufferGeometry().setFromPoints(this.labPickables.map((p) => p.position));
      const c = new THREE.Color("#ffc857");
      geo.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(rows.flatMap(() => [c.r, c.g, c.b])), 3));
      geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(rows.length).fill(0.75), 1));
      const mat = new THREE.ShaderMaterial({ uniforms: { uScale: this.uniforms.scale }, vertexShader: POINT_VERTEX, fragmentShader: TRIANGLE_FRAGMENT, transparent: true, depthWrite: false });
      this.labLayer.add(new THREE.Points(geo, mat));
    }
    this.dirty = true;
  }

  zoom(factor: number) {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const d = THREE.MathUtils.clamp(offset.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    const pos = this.controls.target.clone().add(offset.setLength(d));
    this.flyTo(pos, this.controls.target.clone(), !this.reduce, 350);
  }

  reset() {
    this.flyTo(HOME_POS.clone(), HOME_TARGET.clone(), !this.reduce);
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    this.resizer.disconnect();
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointermove", this.onPointerMove);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointerleave", this.onPointerLeave);
    canvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.controls.dispose();
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
        (m as THREE.SpriteMaterial).map?.dispose();
        m.dispose();
      }
    });
    this.renderer.dispose();
    canvas.remove();
    this.overlay.replaceChildren();
  }

  // ------------------------------------------------------------------ scene building

  private clearLayer(layer: THREE.Group) {
    for (const child of [...layer.children]) {
      layer.remove(child);
      const c = child as THREE.Points;
      c.geometry?.dispose();
      (c.material as THREE.Material | undefined)?.dispose?.();
    }
  }

  private buildGround() {
    const w = SCALE.halfWidth;
    const d = SCALE.halfDepth;
    const seg: number[] = [];
    for (const p of PRESSURE_TICKS) seg.push(pressureToX(p), 0, d, pressureToX(p), 0, -d);
    for (const o of O2_TICKS) seg.push(-w, 0, o2ToZ(o), w, 0, o2ToZ(o));
    const frame = [-w, 0, d, w, 0, d, w, 0, d, w, 0, -d, w, 0, -d, -w, 0, -d, -w, 0, -d, -w, 0, d];
    const line = (points: number[], color: string, opacity: number) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
      return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
    };
    this.world.add(line(seg, "#5d7199", 0.3));
    this.world.add(line(frame, "#8ea4cc", 0.55));

    // height axis at the back-left corner
    const h = po2ToY(PO2_TICKS[PO2_TICKS.length - 1]);
    const axis = [-w, 0, -d, -w, h, -d];
    for (const t of PO2_TICKS) axis.push(-w, po2ToY(t), -d, -w + 0.18, po2ToY(t), -d);
    this.world.add(line(axis, "#8ea4cc", 0.6));

    const tick = (text: string, x: number, y: number, z: number, cls = "text-[10px] text-muted") => this.addLabel(text, new THREE.Vector3(x, y, z), `pointer-events-none whitespace-nowrap font-mono [text-shadow:0_0_4px_#000,0_0_2px_#000] ${cls}`, true);
    for (const p of PRESSURE_TICKS) tick(`${p}`, pressureToX(p), 0, d + 0.55);
    for (const o of O2_TICKS) tick(`${o}%`, -w - 0.55, 0, o2ToZ(o));
    for (const t of PO2_TICKS) tick(`${t}`, -w - 0.4, po2ToY(t), -d);
    const title = "text-[11px] text-text/80";
    tick("Pressure (psi, log scale)", 0, 0, d + 1.25, title);
    tick("O2 (%)", -w - 1.3, 0, 0, title);
    tick("pO2 (psi)", -w, h + 0.5, -d, title);
  }

  private buildSheet(data: MapData) {
    const nu = 90;
    const nv = 60;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const cool = new THREE.Color("#2f6fd0");
    const hot = new THREE.Color("#ff7a2f");
    const c = new THREE.Color();
    const psiAt = (i: number) => xToPressure(-SCALE.halfWidth + (2 * SCALE.halfWidth * i) / nu);
    const o2At = (j: number) => (100 * j) / nv;
    for (let j = 0; j <= nv; j++) {
      for (let i = 0; i <= nu; i++) {
        const s = toScene(psiAt(i), o2At(j));
        positions.push(s.x, s.y, s.z);
        const po2 = pO2(o2At(j), psiAt(i));
        c.copy(cool).lerp(hot, Math.min(1, Math.sqrt(po2 / SCALE.sheetMaxPo2)));
        // the sheet blends additively, so fading to black dissolves its top edge smoothly
        const fade = 1 - THREE.MathUtils.smoothstep(po2, SCALE.sheetMaxPo2 * 0.6, SCALE.sheetMaxPo2);
        colors.push(c.r * fade, c.g * fade, c.b * fade);
      }
    }
    const within = (i: number, j: number) => pO2(o2At(j), psiAt(i)) <= SCALE.sheetMaxPo2;
    const vid = (i: number, j: number) => j * (nu + 1) + i;
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        if (within(i, j) && within(i + 1, j) && within(i, j + 1) && within(i + 1, j + 1)) {
          indices.push(vid(i, j), vid(i + 1, j), vid(i, j + 1), vid(i + 1, j), vid(i + 1, j + 1), vid(i, j + 1));
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    this.world.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.085, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));

    // grid lines lying on the sheet, so its shape is readable from any angle
    const seg: number[] = [];
    const addPolyline = (pts: [number, number][]) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const [p0, o0] = pts[k];
        const [p1, o1] = pts[k + 1];
        if (pO2(o0, p0) > SCALE.sheetMaxPo2 || pO2(o1, p1) > SCALE.sheetMaxPo2) continue;
        const a = toScene(p0, o0);
        const b = toScene(p1, o1);
        seg.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    };
    for (const p of PRESSURE_TICKS) addPolyline(Array.from({ length: 41 }, (_, k): [number, number] => [p, (100 * k) / 40]));
    for (const o of O2_TICKS) addPolyline(Array.from({ length: 61 }, (_, k): [number, number] => [psiAt((nu * k) / 60), o]));
    const grid = new THREE.BufferGeometry();
    grid.setAttribute("position", new THREE.Float32BufferAttribute(seg, 3));
    this.world.add(new THREE.LineSegments(grid, new THREE.LineBasicMaterial({ color: "#9fc3ff", transparent: true, opacity: 0.2, depthWrite: false, toneMapped: false })));

    // same pO2 as the ISS: a level line on the sheet
    const curve = new THREE.CatmullRomCurve3(issCurve().filter(([, o]) => o <= 100).map(([p, o]) => {
      const s = toScene(p, o);
      return new THREE.Vector3(s.x, s.y + 0.015, s.z);
    }));
    this.world.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 140, 0.028, 6), new THREE.MeshBasicMaterial({ color: "#ffc857", toneMapped: false })));

    // Moon base / rover zone
    const [o0, o1] = data.lunar_region.o2_pct;
    const [p0, p1] = data.lunar_region.pressure_psi;
    const zone: number[] = [];
    const zoneIndex: number[] = [];
    const n = 10;
    for (let j = 0; j <= n; j++) {
      for (let i = 0; i <= n; i++) {
        const s = toScene(p0 + ((p1 - p0) * i) / n, o0 + ((o1 - o0) * j) / n);
        zone.push(s.x, s.y + 0.012, s.z);
      }
    }
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const v = j * (n + 1) + i;
        zoneIndex.push(v, v + 1, v + n + 1, v + 1, v + n + 2, v + n + 1);
      }
    }
    const zoneGeo = new THREE.BufferGeometry();
    zoneGeo.setAttribute("position", new THREE.Float32BufferAttribute(zone, 3));
    zoneGeo.setIndex(zoneIndex);
    this.world.add(new THREE.Mesh(zoneGeo, new THREE.MeshBasicMaterial({ color: "#ff7a2f", transparent: true, opacity: 0.42, side: THREE.DoubleSide, depthWrite: false, toneMapped: false })));
    const corner = (p: number, o: number) => {
      const s = toScene(p, o);
      return new THREE.Vector3(s.x, s.y + 0.02, s.z);
    };
    const outline = new THREE.BufferGeometry().setFromPoints([corner(p0, o0), corner(p1, o0), corner(p1, o1), corner(p0, o1), corner(p0, o0)]);
    this.world.add(new THREE.Line(outline, new THREE.LineBasicMaterial({ color: "#ffb98a", toneMapped: false })));
  }

  private buildPoints(data: MapData) {
    this.clearLayer(this.dataLayer);
    const all: { agg: Agg; pos: THREE.Vector3 }[] = [];
    for (const inv of ["ACME", "CFI", "SPICE"] as const) {
      for (const agg of aggregate(data.points.filter((p) => p.investigation === inv))) {
        const s = toScene(agg.value[0], agg.value[1]);
        all.push({ agg, pos: new THREE.Vector3(s.x, s.y, s.z) });
      }
    }
    this.pickables = all.map(({ agg, pos }) => ({ position: pos, reachPx: Math.max(10, pointPx(agg.ids.length) * 0.75), agg }));

    const positions = new Float32Array(all.length * 3);
    const colors = new Float32Array(all.length * 3);
    const sizes = new Float32Array(all.length);
    const stems: number[] = [];
    const stemColors: number[] = [];
    const c = new THREE.Color();
    all.forEach(({ agg, pos }, i) => {
      positions.set([pos.x, pos.y, pos.z], i * 3);
      c.set(INV_COLORS[agg.inv as keyof typeof INV_COLORS]);
      colors.set([c.r, c.g, c.b], i * 3);
      sizes[i] = pointPx(agg.ids.length) * WORLD_PER_PX;
      // a thin stem down to the floor shows where the point stands on the pressure and O2 axes
      stems.push(pos.x, 0, pos.z, pos.x, pos.y, pos.z);
      stemColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    });
    const stemGeo = new THREE.BufferGeometry();
    stemGeo.setAttribute("position", new THREE.Float32BufferAttribute(stems, 3));
    stemGeo.setAttribute("color", new THREE.Float32BufferAttribute(stemColors, 3));
    this.dataLayer.add(new THREE.LineSegments(stemGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false })));

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: this.uniforms.scale, uDim: this.uniforms.dim },
      vertexShader: POINT_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.dataLayer.add(points);
  }

  private ringPoints(positions: THREE.Vector3[], color: string, size: number, core: number): THREE.Points {
    const geo = new THREE.BufferGeometry().setFromPoints(positions);
    const c = new THREE.Color(color);
    geo.setAttribute("aColor", new THREE.BufferAttribute(new Float32Array(positions.flatMap(() => [c.r, c.g, c.b])), 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array(positions.length).fill(size), 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uScale: this.uniforms.scale, uTime: this.uniforms.time, uCore: { value: core } },
      vertexShader: POINT_VERTEX,
      fragmentShader: RING_FRAGMENT,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = 5;
    return points;
  }

  private buildMissions(missions: Mission[]) {
    for (const m of missions) {
      const s = toScene(m.pressure_psi, m.o2_pct);
      const model = missionModel(m.id);
      model.position.set(s.x, s.y + 0.05, s.z);
      model.rotation.y = -0.5;
      model.scale.multiplyScalar(MODEL_SCALE);
      this.missionLayer.add(model);
      this.missionModels.set(m.id, model);

      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = `${m.name}: ${m.o2_pct}% O2 at ${m.pressure_psi} psi`;
      btn.setAttribute("aria-pressed", "false");
      btn.className =
        "pointer-events-auto absolute left-0 top-0 whitespace-nowrap rounded-full border border-star/40 bg-bg/80 px-2 py-0.5 font-head text-[11px] font-semibold text-text transition-colors hover:border-ember aria-pressed:border-ember aria-pressed:bg-ember/25 aria-pressed:text-ember-soft";
      btn.textContent = m.short;
      if (m.demo) {
        const tag = document.createElement("span");
        tag.className = "ml-1 text-[9px] uppercase text-warn";
        tag.textContent = "demo";
        btn.appendChild(tag);
      }
      btn.addEventListener("click", () => this.cb.onSelectMission(m.id));
      this.overlay.appendChild(btn);
      this.missionLabels.set(m.id, { el: btn, position: new THREE.Vector3(s.x, s.y + 0.8, s.z), anchorX: LABEL_ANCHOR[m.id] });
    }
  }

  private addLabel(text: string, position: THREE.Vector3, className: string, decorative: boolean) {
    const el = document.createElement("span");
    el.className = `absolute left-0 top-0 ${className}`;
    el.textContent = text;
    if (decorative) el.setAttribute("aria-hidden", "true");
    this.overlay.appendChild(el);
    this.labels.push({ el, position });
  }

  // ------------------------------------------------------------------ camera

  private flyTo(toPos: THREE.Vector3, toTarget: THREE.Vector3, animate: boolean, duration = FLY_MS) {
    if (!animate) {
      this.fly = null;
      this.camera.position.copy(toPos);
      this.controls.target.copy(toTarget);
      this.controls.update();
      this.dirty = true;
      return;
    }
    this.fly = { fromPos: this.camera.position.clone(), toPos, fromTarget: this.controls.target.clone(), toTarget, start: performance.now(), duration };
    this.idleSince = performance.now() + duration;
  }

  // ------------------------------------------------------------------ frame loop

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    if (!this.visible || now - this.lastFrame < this.frameMs) return;
    // the demo video is playing over the page: leave the computer to it
    if (document.documentElement.classList.contains("demo-watching")) return;
    this.lastFrame = now;

    if (this.fly) {
      const k = Math.min(1, (now - this.fly.start) / this.fly.duration);
      const e = easeInOut(k);
      this.camera.position.lerpVectors(this.fly.fromPos, this.fly.toPos, e);
      this.controls.target.lerpVectors(this.fly.fromTarget, this.fly.toTarget, e);
      if (k >= 1) this.fly = null;
      this.dirty = true;
    }

    if (this.reduce) {
      this.controls.update();
      if (this.dirty) this.draw();
      return;
    }

    // when left alone, the view sways gently; touching it stops the sway
    const t = now / 1000;
    // no idle sway during the presentation (smoother frame rate for recordings)
    const presenting = document.documentElement.classList.contains("presenting");
    const idle = !presenting && !this.fly && !this.pointerDown && now - this.idleSince > 6000;
    this.controls.autoRotate = idle;
    this.controls.autoRotateSpeed = 0.28 * Math.cos(t * 0.1);
    this.controls.update();
    this.uniforms.time.value = t;
    this.backdrop.tick(t);
    const station = this.missionModels.get("iss");
    if (station) station.rotation.y = -0.5 + Math.sin(t * 0.15) * 0.3;
    this.draw();
  };

  private draw() {
    this.renderer.render(this.scene, this.camera);
    this.placeLabels();
    this.dirty = false;
  }

  private placeLabels() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    const place = (slot: LabelSlot, center: boolean) => {
      this.v.copy(slot.position).project(this.camera);
      const off = this.v.z > 1 || Math.abs(this.v.x) > 1.05 || Math.abs(this.v.y) > 1.05;
      slot.el.style.visibility = off ? "hidden" : "visible";
      if (off) return;
      let x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      // axis labels stay readable near the edge; mission labels keep their own anchors
      if (center) {
        const half = slot.el.offsetWidth / 2;
        x = Math.min(Math.max(x, half), Math.max(half, w - half));
      }
      slot.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(${slot.anchorX ?? "-50%"}, ${center ? "-50%" : "-100%"})`;
    };
    for (const slot of this.labels) place(slot, true);
    for (const slot of this.missionLabels.values()) place(slot, false);
  }

  private resize() {
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = `${w}px`;
    this.renderer.domElement.style.height = `${h}px`;
    this.camera.aspect = w / h;
    // narrow screens pull back a little so the whole map still fits
    this.camera.fov = w < 640 ? 54 : 42;
    this.camera.updateProjectionMatrix();
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.uniforms.scale.value = (h * this.renderer.getPixelRatio()) / (2 * tan);
    this.dirty = true;
  }

  // ------------------------------------------------------------------ pointer

  private pick(e: PointerEvent): Pickable | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const items = [...this.labPickables, ...this.pickables];
    const projected = items.map((p) => {
      this.v.copy(p.position).project(this.camera);
      return { x: (this.v.x * 0.5 + 0.5) * rect.width, y: (-this.v.y * 0.5 + 0.5) * rect.height, reach: this.v.z > 1 ? -1 : p.reachPx };
    });
    const i = pickNearest(projected, px, py);
    return i >= 0 ? items[i] : null;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointerDown = { x: e.clientX, y: e.clientY, at: performance.now() };
    this.fly = null;
    this.cb.onHover(null);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointerDown || e.pointerType === "touch") return;
    const hit = this.pick(e);
    this.renderer.domElement.style.cursor = hit ? "pointer" : "grab";
    const rect = this.renderer.domElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (hit?.agg) this.cb.onHover({ kind: "test", agg: hit.agg, x, y });
    else if (hit?.lab) this.cb.onHover({ kind: "lab", lab: hit.lab, x, y });
    else this.cb.onHover(null);
  };

  private onPointerUp = (e: PointerEvent) => {
    const start = this.pointerDown;
    this.pointerDown = null;
    this.idleSince = performance.now();
    if (!start) return;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6 || performance.now() - start.at > 600) return;
    const hit = this.pick(e);
    if (hit?.agg) this.cb.onOpenTest(hit.agg.ids[0]);
  };

  private onPointerLeave = () => {
    this.cb.onHover(null);
  };

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.cb.onLost();
  };
}
