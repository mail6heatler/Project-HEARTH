"use client";
import { create } from "zustand";
import type { Confidence, Source } from "./types";
import { ACHIEVEMENTS, bump, EMPTY_STATS, newlyUnlocked, type AchievementStats } from "./achievements";
import { addAnswer, addUsage, emptyTally, type BurnTally, type UsageLike } from "./vesta/burn";
import type { EngineChoice, EngineId } from "./vesta/engines";
import type { ChartPayload } from "./vesta/tools/make_chart";

export type Level = "student" | "researcher" | "engineer";

/** Accent skins for the whole site. Only the ember accent changes; data and safety colours never do. */
export type Skin = "ember" | "nebula" | "mars" | "moon";
export const SKINS: Record<Skin, string> = { ember: "Ember", nebula: "Nebula", mars: "Mars", moon: "Moon" };

export interface Step {
  tool: string;
  status: "running" | "done" | "error";
  summary: string;
}

/** A row uploaded in My data lab. Lives in memory only; never mixed into NASA tables. */
export interface LabRow {
  label: string;
  o2_pct: number | null;
  pressure_psi: number | null;
  flow_cm_s: number | null;
  problems: string[];
}

export interface VestaMessage {
  id: string;
  role: "user" | "vesta";
  text: string;
  badge?: string;
  note?: string;
  steps: Step[];
  charts: ChartPayload[];
  sources: Source[];
  confidence?: Confidence;
  confidenceNote?: string;
  pending?: boolean;
  error?: string;
  alert?: "ok" | "warn" | "bad";
  cached?: boolean;
  /** Tokens this answer burned, from the providers' usage reports. */
  usage?: { input: number; output: number; calls: number; unreported: number };
  /** The model a router (FreeLLMAPI) really used, when it differs from the badge. */
  served?: string;
  /** The engine that answered. */
  engineId?: EngineId;
}

/** The answer in flight, for the Engine room's "now running" card. */
export interface LiveRun {
  engine?: EngineId;
  model?: string;
  served?: string;
  startedAt: number;
  calls: number;
  tokens: number;
  /** Engines that failed before this one, with friendly reasons. */
  fallbacks: { id: EngineId; reason: string }[];
}

interface HearthState {
  missionId: string;
  engine: EngineChoice;
  level: Level;
  highlightIds: string[];
  openTestId: string | null;
  pinned: ChartPayload[];
  messages: VestaMessage[];
  busy: boolean;
  draft: string;
  labRows: LabRow[];
  /** Tokens burned in this browser session (resets on reload). */
  burn: BurnTally;
  live: LiveRun | null;
  /** Bumped on every usage report so the Engine room can flare. */
  burnPulse: number;
  roomOpen: boolean;
  setRoomOpen: (open: boolean) => void;
  skin: Skin;
  setSkin: (s: Skin) => void;
  /** Slow stars behind the chat (decoration). */
  starfield: boolean;
  setStarfield: (on: boolean) => void;
  /** Time of the last /warp easter egg, 0 = never. */
  warpAt: number;
  warp: () => void;
  /** Ember trail behind the mouse pointer (decoration). */
  trail: boolean;
  setTrail: (on: boolean) => void;
  /** Panels rise into view while scrolling (decoration). */
  reveal: boolean;
  setReveal: (on: boolean) => void;
  /** The "Launch Project HEARTH" screen: null until decided on load, then open (true) or closed (false). */
  landing: boolean | null;
  setLanding: (open: boolean) => void;
  /** "See HEARTH in action" is open: the recorded demo player. */
  presenterOpen: boolean;
  setPresenterOpen: (open: boolean) => void;
  /** The live presentation's start card is open (the backup to the recorded demo). */
  liveOpen: boolean;
  setLiveOpen: (open: boolean) => void;
  /** A presentation is playing: tours, toasts and achievements stay quiet. */
  presenting: boolean;
  setPresenting: (on: boolean) => void;
  setMessages: (messages: VestaMessage[]) => void;
  /** Bumped when something outside the panel wants VESTA shown (e.g. "Ask VESTA about this"). */
  openRequest: number;
  requestOpen: () => void;
  achStats: AchievementStats;
  unlocked: string[];
  toasts: { id: string; title: string; hint: string }[];
  track: (e: Parameters<typeof bump>[1]) => void;
  dismissToast: (id: string) => void;
  loadAchievements: (stats: AchievementStats, unlocked: string[]) => void;
  startLive: () => void;
  updateLive: (fn: (l: LiveRun) => LiveRun) => void;
  endLive: (answerTokens: number | null) => void;
  recordUsage: (u: UsageLike) => void;
  resetBurn: () => void;
  setLabRows: (rows: LabRow[]) => void;
  setMission: (id: string) => void;
  setEngine: (e: EngineChoice) => void;
  setLevel: (l: Level) => void;
  setHighlight: (ids: string[]) => void;
  openTest: (id: string | null) => void;
  pin: (c: ChartPayload) => void;
  unpin: (id: string) => void;
  addMessage: (m: VestaMessage) => void;
  updateMessage: (id: string, fn: (m: VestaMessage) => VestaMessage) => void;
  clearMessages: () => void;
  setBusy: (b: boolean) => void;
  setDraft: (d: string) => void;
}

export const useHearth = create<HearthState>((set) => ({
  missionId: "lunar-rover",
  engine: "auto",
  level: "researcher",
  highlightIds: [],
  openTestId: null,
  pinned: [],
  messages: [],
  busy: false,
  draft: "",
  labRows: [],
  burn: emptyTally(),
  live: null,
  burnPulse: 0,
  roomOpen: false,
  setRoomOpen: (roomOpen) => set({ roomOpen }),
  skin: "ember",
  setSkin: (skin) => {
    set({ skin });
    useHearth.getState().track({ kind: "skin", value: skin });
  },
  starfield: true,
  setStarfield: (starfield) => set({ starfield }),
  warpAt: 0,
  warp: () => {
    set({ warpAt: Date.now() });
    useHearth.getState().track({ kind: "warp" });
  },
  trail: true,
  setTrail: (trail) => set({ trail }),
  reveal: true,
  setReveal: (reveal) => set({ reveal }),
  landing: null,
  setLanding: (landing) => set({ landing }),
  presenterOpen: false,
  setPresenterOpen: (presenterOpen) => set({ presenterOpen }),
  liveOpen: false,
  setLiveOpen: (liveOpen) => set({ liveOpen }),
  presenting: false,
  setPresenting: (presenting) => set({ presenting }),
  setMessages: (messages) => set({ messages }),
  openRequest: 0,
  requestOpen: () => set((s) => ({ openRequest: s.openRequest + 1 })),
  achStats: EMPTY_STATS,
  unlocked: [],
  toasts: [],
  track: (e) =>
    set((s) => {
      // the presentation is a demo, not the visitor's own exploring
      if (s.presenting) return s;
      const achStats = bump(s.achStats, e);
      const fresh = newlyUnlocked(achStats, s.unlocked);
      if (!fresh.length) return { achStats };
      return { achStats, unlocked: [...s.unlocked, ...fresh.map((a) => a.id)], toasts: [...s.toasts, ...fresh.map((a) => ({ id: a.id, title: a.title, hint: a.hint }))].slice(-3) };
    }),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  loadAchievements: (achStats, unlocked) => set({ achStats, unlocked: unlocked.filter((id) => ACHIEVEMENTS.some((a) => a.id === id)) }),
  startLive: () => set({ live: { startedAt: Date.now(), calls: 0, tokens: 0, fallbacks: [] } }),
  updateLive: (fn) => set((s) => (s.live ? { live: fn(s.live) } : s)),
  endLive: (answerTokens) => set((s) => ({ live: null, burn: answerTokens ? addAnswer(s.burn, answerTokens) : s.burn })),
  recordUsage: (u) => set((s) => ({ burn: addUsage(s.burn, u), burnPulse: s.burnPulse + 1 })),
  resetBurn: () => set({ burn: emptyTally() }),
  setLabRows: (labRows) => set({ labRows }),
  setMission: (missionId) => set({ missionId }),
  setEngine: (engine) => set({ engine }),
  setLevel: (level) => {
    set({ level });
    useHearth.getState().track({ kind: "level", value: level });
  },
  setHighlight: (highlightIds) => set({ highlightIds }),
  openTest: (openTestId) => {
    set({ openTestId });
    if (openTestId) useHearth.getState().track({ kind: "testOpened" });
  },
  pin: (c) => set((s) => (s.pinned.some((p) => p.id === c.id) ? s : { pinned: [...s.pinned, c].slice(-6) })),
  unpin: (id) => set((s) => ({ pinned: s.pinned.filter((p) => p.id !== id) })),
  addMessage: (m) => set((s) => ({ messages: [...s.messages, m].slice(-60) })),
  updateMessage: (id, fn) => set((s) => ({ messages: s.messages.map((m) => (m.id === id ? fn(m) : m)) })),
  clearMessages: () => set({ messages: [] }),
  setBusy: (busy) => set({ busy }),
  setDraft: (draft) => set({ draft }),
}));

// ---- small per-viewer preferences in localStorage (always wrapped: storage may be blocked)
const PREFS_KEY = "hearth.prefs.v1";

type Prefs = Pick<HearthState, "engine" | "level" | "missionId" | "skin" | "starfield" | "trail" | "reveal">;

export function loadPrefs(): Partial<Prefs> {
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function savePrefs(p: Prefs) {
  try {
    window.localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked: preferences just don't persist */
  }
}

export const newId = () => Math.random().toString(36).slice(2, 10);

// ---- achievements, also per viewer in localStorage
const ACH_KEY = "hearth.achievements.v1";

export function loadAchievementState(): { stats: AchievementStats; unlocked: string[] } {
  try {
    const raw = JSON.parse(window.localStorage.getItem(ACH_KEY) ?? "null") as { stats?: Partial<AchievementStats>; unlocked?: unknown } | null;
    if (!raw) return { stats: EMPTY_STATS, unlocked: [] };
    const stats = { ...EMPTY_STATS, ...raw.stats };
    for (const k of ["tools", "levels", "skins"] as const) if (!Array.isArray(stats[k])) stats[k] = [];
    return { stats, unlocked: Array.isArray(raw.unlocked) ? raw.unlocked.filter((x): x is string => typeof x === "string") : [] };
  } catch {
    return { stats: EMPTY_STATS, unlocked: [] };
  }
}

export function saveAchievementState(stats: AchievementStats, unlocked: string[]) {
  try {
    window.localStorage.setItem(ACH_KEY, JSON.stringify({ stats, unlocked }));
  } catch {
    /* storage blocked: achievements last for this visit only */
  }
}
