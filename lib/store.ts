"use client";
import { create } from "zustand";
import type { Confidence, Source } from "./types";
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
  setSkin: (skin) => set({ skin }),
  starfield: true,
  setStarfield: (starfield) => set({ starfield }),
  warpAt: 0,
  warp: () => set({ warpAt: Date.now() }),
  startLive: () => set({ live: { startedAt: Date.now(), calls: 0, tokens: 0, fallbacks: [] } }),
  updateLive: (fn) => set((s) => (s.live ? { live: fn(s.live) } : s)),
  endLive: (answerTokens) => set((s) => ({ live: null, burn: answerTokens ? addAnswer(s.burn, answerTokens) : s.burn })),
  recordUsage: (u) => set((s) => ({ burn: addUsage(s.burn, u), burnPulse: s.burnPulse + 1 })),
  resetBurn: () => set({ burn: emptyTally() }),
  setLabRows: (labRows) => set({ labRows }),
  setMission: (missionId) => set({ missionId }),
  setEngine: (engine) => set({ engine }),
  setLevel: (level) => set({ level }),
  setHighlight: (highlightIds) => set({ highlightIds }),
  openTest: (openTestId) => set({ openTestId }),
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

type Prefs = Pick<HearthState, "engine" | "level" | "missionId" | "skin" | "starfield">;

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
