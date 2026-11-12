"use client";
import { useMemo } from "react";
import { IconBolt, IconChevron, IconFlame, IconGauge } from "@/components/ui/Icons";
import { useHearth } from "@/lib/store";
import { burnRate, burnTotals, clock, formatTokens, remainingPct } from "@/lib/vesta/burn";
import { ENGINE_LABELS, ENGINE_ORDER, type EngineChoice, type EngineId, type EngineInfo } from "@/lib/vesta/engines";
import { BurnMeter } from "./BurnMeter";
import { ENGINE_COLORS, ENGINE_META } from "./engineMeta";
import { FuelTank } from "./FuelTank";
import { toolLabel } from "./suggest";
import { restLeft, restShare, useCountUp, useEngines, useMeter, useNow, type Meter } from "./useEngineRoom";

type TileState = "running" | "resting" | "nokey" | "ready";

function tileState(id: EngineChoice, info: EngineInfo | undefined, live: EngineId | undefined, rest: number): TileState {
  if (id !== "auto" && live === id) return "running";
  if (id !== "auto" && !info?.available) return "nokey";
  if (rest > 0) return "resting";
  return "ready";
}

/** First engine Auto would try right now: has a key and is not resting (mirrors the router's skip rules). */
function autoNext(engines: EngineInfo[], meter: Meter | null, now: number): EngineId {
  for (const id of ENGINE_ORDER) {
    if (id === "offline") return id;
    if (engines.find((e) => e.id === id)?.available && restLeft(meter, id, now) === 0) return id;
  }
  return "offline";
}

function Tile({ id, info, state, rest, share, selected, next, onPick }: { id: EngineChoice; info?: EngineInfo; state: TileState; rest: number; share: number; selected: boolean; next?: EngineId; onPick: () => void }) {
  const meta = ENGINE_META[id];
  const disabled = state === "nokey";
  const dot = state === "running" ? "bg-ember animate-pulse" : state === "resting" ? "bg-warn" : state === "nokey" ? "bg-line" : "bg-ok";
  const line =
    state === "running"
      ? "answering now…"
      : state === "resting"
        ? `resting ${clock(rest)}`
        : state === "nokey"
          ? "no key"
          : id === "auto" && next
            ? `starts with ${ENGINE_LABELS[next]}`
            : meta.blurb;
  return (
    <label
      className={`engine-tile relative flex cursor-pointer flex-col gap-0.5 rounded-lg border p-2 text-left transition ${
        selected ? "border-ember bg-ember/10 shadow-[0_0_14px_rgba(255,122,47,0.25)]" : "border-line bg-raised/70 hover:border-ember/50"
      } ${disabled ? "cursor-not-allowed opacity-45 hover:border-line" : ""} ${state === "running" ? "tile-running" : ""}`}
    >
      <input type="radio" name="vesta-engine" value={id} checked={selected} disabled={disabled} onChange={onPick} className="sr-only" />
      <span className="flex items-center gap-1.5">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden />
        <span className="truncate font-head text-[13px] font-semibold text-text">{id === "auto" ? "Auto" : ENGINE_LABELS[id]}</span>
        <span className="ml-auto rounded border border-line px-1 font-mono text-[8px] tracking-wider text-muted">{meta.tag}</span>
      </span>
      <span className={`truncate font-mono text-[10px] ${state === "resting" ? "text-warn" : state === "running" ? "text-ember-soft" : "text-muted"}`}>{line}</span>
      {state === "resting" && (
        <span className="absolute inset-x-2 bottom-1 h-0.5 overflow-hidden rounded-full bg-line" aria-hidden>
          <span className="block h-full bg-warn transition-all duration-1000" style={{ width: `${share * 100}%` }} />
        </span>
      )}
      {info && !info.available && id !== "auto" && <span className="sr-only">(no key set)</span>}
    </label>
  );
}

/** The Auto order as a row of nodes; a spark runs along it while VESTA works. */
function Chain({ engines, meter, now, live, lastAnswered, fallbacks }: { engines: EngineInfo[]; meter: Meter | null; now: number; live?: EngineId; lastAnswered?: EngineId; fallbacks: { id: EngineId; reason: string }[] }) {
  return (
    <div className="relative mt-2">
      <p className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">Fallback chain</p>
      <ol className="relative flex items-center justify-between gap-0.5" aria-label="Order Auto tries the engines">
        <span className={`absolute inset-x-2 top-[7px] h-px bg-line ${live ? "chain-wire" : ""}`} aria-hidden />
        {ENGINE_ORDER.map((id) => {
          const has = id === "offline" || engines.find((e) => e.id === id)?.available;
          const resting = restLeft(meter, id, now) > 0;
          const failed = fallbacks.find((f) => f.id === id);
          const isLive = live === id;
          const isLast = !live && lastAnswered === id;
          return (
            <li key={id} className="relative z-[1] flex min-w-0 flex-1 flex-col items-center gap-0.5" title={failed ? `${ENGINE_LABELS[id]}: ${failed.reason}` : ENGINE_LABELS[id]}>
              <span
                className={`grid h-[15px] w-[15px] place-items-center rounded-full border text-[8px] ${
                  isLive ? "chain-node-live border-ember bg-ember text-bg" : failed ? "border-bad/70 bg-bad/20 text-bad" : resting ? "border-warn/70 bg-warn/20 text-warn" : isLast ? "border-ok bg-ok/25 text-ok" : has ? "border-muted/60 bg-raised" : "border-line bg-bg"
                }`}
                style={has && !isLive && !failed && !resting && !isLast ? { boxShadow: `inset 0 0 0 2px ${ENGINE_COLORS[id]}55` } : undefined}
                aria-hidden
              >
                {failed ? "✕" : isLast ? "✓" : ""}
              </span>
              <span className={`max-w-full truncate font-mono text-[8.5px] ${has ? "text-text/80" : "text-muted/50 line-through"}`}>{ENGINE_META[id].short}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function LiveCard({ now }: { now: number }) {
  const live = useHearth((s) => s.live);
  const busy = useHearth((s) => s.busy);
  const messages = useHearth((s) => s.messages);
  const last = [...messages].reverse().find((m) => m.role === "vesta" && !m.alert && m.badge);
  const lastMsg = messages[messages.length - 1];
  const running = [...(lastMsg?.steps ?? [])].reverse().find((s) => s.status === "running" && s.tool !== "engine");
  const tokens = useCountUp(live?.tokens ?? 0, 500);

  if (busy && live) {
    const ms = now - live.startedAt;
    const rate = burnRate(live.tokens, ms);
    return (
      <section aria-label="Now running" className="live-card relative overflow-hidden rounded-lg border border-ember/50 bg-ember/[0.07] p-2.5">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ember-soft">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ember" aria-hidden /> Now running
        </p>
        <p className="mt-1 font-head text-base font-semibold leading-tight">{live.engine ? ENGINE_LABELS[live.engine] : "Picking an engine…"}</p>
        {live.model && <p className="truncate font-mono text-[11px] text-text/80">{live.model}</p>}
        {live.served && <p className="truncate font-mono text-[10px] text-ember-soft">routed to {live.served}</p>}
        <p className="mt-1 truncate text-[11px] text-muted">{running ? `${toolLabel(running.tool)}…` : "Thinking…"}</p>
        <div className="mt-1.5 grid grid-cols-3 gap-1 text-center font-mono">
          <span className="rounded bg-bg/60 py-1">
            <b className="block text-sm text-text">{live.calls}</b>
            <span className="text-[9px] text-muted">calls</span>
          </span>
          <span className="rounded bg-bg/60 py-1">
            <b className="block text-sm text-text">{formatTokens(tokens)}</b>
            <span className="text-[9px] text-muted">tokens</span>
          </span>
          <span className="rounded bg-bg/60 py-1">
            <b className="block text-sm text-text">{(ms / 1000).toFixed(0)}s</b>
            <span className="text-[9px] text-muted">{rate !== null && live.tokens > 0 ? `${formatTokens(rate)}/s` : "elapsed"}</span>
          </span>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Last answer" className="rounded-lg border border-line bg-bg/60 p-2.5">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted">Last answer</p>
      {last ? (
        <>
          <p className="mt-1 truncate font-mono text-[11px] text-text/90">{last.badge}</p>
          {last.served && <p className="truncate font-mono text-[10px] text-ember-soft">routed to {last.served}</p>}
          <p className="mt-0.5 font-mono text-[10px] text-muted">
            {last.usage ? `${formatTokens(last.usage.input + last.usage.output)} tokens in ${last.usage.calls} call${last.usage.calls === 1 ? "" : "s"}` : last.cached ? "cached: no tokens burned" : "no AI tokens used"}
          </p>
        </>
      ) : (
        <p className="mt-1 text-[11px] text-muted">Standing by. Ask a question to see which engine answers.</p>
      )}
    </section>
  );
}

export function EngineRoom() {
  const open = useHearth((s) => s.roomOpen);
  const setOpen = useHearth((s) => s.setRoomOpen);
  const engine = useHearth((s) => s.engine);
  const setEngine = useHearth((s) => s.setEngine);
  const busy = useHearth((s) => s.busy);
  const live = useHearth((s) => s.live);
  const burn = useHearth((s) => s.burn);
  const messages = useHearth((s) => s.messages);
  const engines = useEngines();
  const { meter, refresh, loading } = useMeter(open);
  const now = useNow(open || busy || !!meter?.cooldowns.length);
  const total = useCountUp(useMemo(() => burnTotals(burn).total, [burn]));

  const lastAnswered = [...messages].reverse().find((m) => m.role === "vesta" && m.engineId)?.engineId;
  const next = autoNext(engines, meter, now);
  const fuel = meter?.freellmapi?.budget;
  const fuelPct = fuel ? remainingPct(fuel.remaining, fuel.total) : null;
  const shownEngine = busy && live?.engine ? live.engine : engine === "auto" ? null : engine;

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="engine-room"
        className={`engine-strip group flex w-full items-center gap-2 rounded-md border px-2 py-1 text-left transition ${open ? "border-ember/60 bg-ember/10" : "border-line bg-bg/60 hover:border-ember/50"}`}
      >
        <IconBolt className={`h-3.5 w-3.5 shrink-0 ${busy ? "animate-pulse text-ember" : "text-ember-soft"}`} />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px]">
          <span className="text-muted">Engine </span>
          <span className="text-text">{engine === "auto" ? "Auto" : ENGINE_LABELS[engine]}</span>
          {shownEngine && engine === "auto" && <span className="text-ember-soft"> → {ENGINE_LABELS[shownEngine]}</span>}
          {busy && live?.model && <span className="text-muted"> · {live.served ?? live.model}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-ember-soft" title="Tokens burned this session">
          <IconFlame className="h-3 w-3" />
          {formatTokens(total)}
        </span>
        {fuelPct !== null && (
          <span className="flex shrink-0 items-center gap-1 font-mono text-[10px] text-ok" title="FreeLLMAPI monthly budget left">
            <IconGauge className="h-3 w-3" />
            {fuelPct}%
          </span>
        )}
        <IconChevron className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        <span className="sr-only">{open ? "Close" : "Open"} the Engine room</span>
      </button>

      {open && (
        <div id="engine-room" className="engine-room mt-2 max-h-[min(62vh,620px)] space-y-2 overflow-y-auto overscroll-contain pr-0.5 vesta:max-h-[var(--room-max)]">
          <fieldset className="rounded-lg border border-line bg-bg/40 p-2">
            <legend className="px-1 font-mono text-[10px] uppercase tracking-wider text-muted">Pick an engine</legend>
            <div className="grid grid-cols-2 gap-1.5">
              {(["auto", ...ENGINE_ORDER] as EngineChoice[]).map((id) => {
                const info = engines.find((e) => e.id === id);
                const rest = id === "auto" ? 0 : restLeft(meter, id, now);
                return (
                  <Tile
                    key={id}
                    id={id}
                    info={info}
                    state={tileState(id, info, busy ? live?.engine : undefined, rest)}
                    rest={rest}
                    share={id === "auto" ? 0 : restShare(meter, id, now)}
                    selected={engine === id}
                    next={id === "auto" ? next : undefined}
                    onPick={() => setEngine(id)}
                  />
                );
              })}
            </div>
            <Chain engines={engines} meter={meter} now={now} live={busy ? live?.engine : undefined} lastAnswered={lastAnswered} fallbacks={busy ? (live?.fallbacks ?? []) : []} />
            <p className="mt-1.5 text-[10px] leading-snug text-muted/80">
              Engines without a key stay greyed out. If the picked engine fails, VESTA moves down the chain and says so in the answer.
            </p>
          </fieldset>
          <LiveCard now={now} />
          <BurnMeter />
          <FuelTank status={meter?.freellmapi ?? null} loaded={!!meter} loading={loading} onRefresh={refresh} />
        </div>
      )}
    </div>
  );
}
