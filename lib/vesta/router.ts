import { runAgent, type AgentOutput } from "./agent";
import { badge, ENGINE_LABELS, engineChain, engineModel, type EngineChoice, type EngineId } from "./engines";
import { chunkText, type Emit, type VestaEvent } from "./events";
import { runOffline } from "./offline";
import type { Level } from "./prompt";
import { createProvider } from "./providers";
import { classifyError, FRIENDLY_REASON, type EngineErrorKind, type HistoryMessage, type Provider } from "./providers/types";

export const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX = 200;
/** After a limit / timeout / service error an engine is skipped for a while, so the next answers fall back at once. */
export const COOLDOWN_MS: Partial<Record<EngineErrorKind, number>> = {
  rate_limit: 60_000,
  timeout: 60_000,
  server: 60_000,
  auth: 5 * 60_000,
  model_unavailable: 5 * 60_000,
};
/** Total time for AI engines; after it, VESTA answers with Offline mode (keeps inside the 60 s function limit). */
export const AI_DEADLINE_MS = 40_000;

export interface VestaRequest {
  messages: HistoryMessage[];
  missionId?: string;
  level: Level;
  engine: EngineChoice;
}

export interface RouterDeps {
  /** Inject providers (tests). When given, only these are used; a missing entry means "no key". */
  providers?: Partial<Record<Exclude<EngineId, "offline">, Provider | undefined>>;
  env?: NodeJS.ProcessEnv;
  timeoutMs?: number;
  chunkDelayMs?: number;
  useCache?: boolean;
  log?: (msg: string) => void;
  deadlineMs?: number;
  now?: () => number;
  /** Eval runs only: use exactly the chosen engine (no fallback, no cooldown skip). */
  strict?: boolean;
}

const cache = new Map<string, { at: number; events: VestaEvent[] }>();
const cooldown = new Map<EngineId, { until: number; reason: string }>();

export function clearVestaCache() {
  cache.clear();
  cooldown.clear();
}

function cacheKey(r: VestaRequest): string {
  return JSON.stringify([r.engine, r.missionId ?? "", r.level, r.messages.map((m) => [m.role, m.content.trim().toLowerCase()])]);
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function getProvider(id: Exclude<EngineId, "offline">, deps: RouterDeps): Provider | undefined {
  if (deps.providers) return deps.providers[id];
  return createProvider(id, deps.env ?? process.env);
}

export async function runVesta(req: VestaRequest, emit: Emit, deps: RouterDeps = {}): Promise<void> {
  const log = deps.log ?? ((m: string) => console.warn(m));
  const delay = deps.chunkDelayMs ?? 8;
  const useCache = deps.useCache ?? true;
  const key = cacheKey(req);

  if (useCache) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      for (const e of hit.events) emit(e.type === "done" ? { type: "done", cached: true } : e);
      return;
    }
  }

  const recorded: VestaEvent[] = [];
  const out: Emit = (e) => {
    if (e.type !== "step") recorded.push(e);
    emit(e);
  };

  const failures: { id: EngineId; reason: string }[] = [];
  const lastUser = [...req.messages].reverse().find((m) => m.role === "user")?.content ?? "";

  const now = deps.now ?? Date.now;
  const started = now();
  const deadline = deps.deadlineMs ?? AI_DEADLINE_MS;

  const chain: EngineId[] = deps.strict && req.engine !== "auto" ? [req.engine] : engineChain(req.engine);
  for (const id of chain) {
    const model = id === "offline" ? "rule-based" : (getProvider(id, deps)?.model ?? engineModel(id, deps.env ?? process.env));
    let result: AgentOutput;
    if (id !== "offline") {
      const cd = deps.strict ? undefined : cooldown.get(id);
      if (cd && cd.until > now()) {
        if (getProvider(id, deps)) failures.push({ id, reason: `${cd.reason} (skipped for now)` });
        continue;
      }
      if (now() - started > deadline) {
        if (getProvider(id, deps)) failures.push({ id, reason: "skipped (time limit)" });
        continue;
      }
    }
    try {
      if (id === "offline") {
        out(engineEvent(id, model, failures));
        result = await runOffline({ message: lastUser, missionId: req.missionId, level: req.level, emit: out });
      } else {
        const provider = getProvider(id, deps);
        if (!provider) {
          if (req.engine === id) failures.push({ id, reason: FRIENDLY_REASON.no_key });
          continue;
        }
        out(engineEvent(id, provider.model, failures));
        const left = Math.max(2_000, deadline - (now() - started));
        result = await runAgent({ provider, history: req.messages, missionId: req.missionId, level: req.level, emit: out, timeoutMs: Math.min(deps.timeoutMs ?? 20_000, left) });
      }
    } catch (e) {
      const err = classifyError(e);
      log(`[vesta] engine ${id} failed: ${err.kind}`);
      failures.push({ id, reason: FRIENDLY_REASON[err.kind] });
      const cdMs = COOLDOWN_MS[err.kind];
      if (cdMs && id !== "offline") cooldown.set(id, { until: now() + cdMs, reason: FRIENDLY_REASON[err.kind] });
      emit({ type: "step", tool: "engine", status: "error", summary: `${ENGINE_LABELS[id]} ${FRIENDLY_REASON[err.kind]}, switching engine` });
      if (id === "offline" || (deps.strict && chain.length === 1)) {
        out({ type: "error", message: "VESTA could not answer right now. Please try again." });
        out({ type: "done" });
        return;
      }
      continue;
    }

    for (const chart of result.charts) out({ type: "chart", chart });
    for (const ui of result.ui) out({ type: "ui", ui });
    for (const piece of chunkText(result.text)) {
      out({ type: "text", delta: piece });
      if (delay) await sleep(delay);
    }
    out({ type: "sources", sources: result.sources });
    out({ type: "confidence", confidence: result.confidence, note: result.confidenceNote });
    out({ type: "done" });
    // A fallback answer is not cached: once the failed engine recovers, the same question should reach it again.
    if (useCache && !failures.length) {
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(key, { at: Date.now(), events: recorded.filter((e) => e.type !== "step") });
    }
    return;
  }
}

function engineEvent(id: EngineId, model: string, failures: { id: EngineId; reason: string }[]): VestaEvent {
  const note = failures.length
    ? `${failures.map((f) => `${ENGINE_LABELS[f.id]} ${f.reason}`).join("; ")}, answered with ${id === "offline" ? "Offline mode" : ENGINE_LABELS[id]}`
    : undefined;
  return { type: "engine", id, label: ENGINE_LABELS[id], model, badge: badge(id, model), note, fallback_from: failures.length ? [...failures] : undefined };
}
