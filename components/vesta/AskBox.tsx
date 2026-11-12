"use client";
import { useEffect, useRef, useState } from "react";
import { IconSend, IconStop } from "@/components/ui/Icons";
import { getMission } from "@/lib/missions";
import { useHearth } from "@/lib/store";
import { COMMANDS, parseCommand, suggestCommands, type Command } from "@/lib/vesta/commands";
import { detectIntent, parseMessage, type Intent } from "@/lib/vesta/parse";
import { useTypedPlaceholder } from "./TextFx";

const MAX_INPUT = 2000;
const COUNT_FROM = 1600;
const PLACEHOLDER = "Ask about fire risk, a test or a data gap…";
const EXAMPLES = [
  "Is 34% O2 at 8.2 psi inside the tested data?",
  "Run a fire-safety audit for the Moon base",
  "What is a cool flame?",
  "Compare ACME and SPICE",
  "What has never been tested for spacesuits?",
  "Type / for commands",
];

const INTENT_LABEL: Partial<Record<Intent, string>> = {
  assess: "check against NASA tests",
  calc: "calculate",
  compare: "compare experiments",
  gaps: "find data gaps",
  rank: "rank experiments",
  safety: "safety audit",
  explain_test: "explain a test",
  explain_topic: "explain a topic",
};

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** What VESTA understood so far, from the same parser Offline mode uses. Numbers are the user's own (or a tested unit conversion). */
function Understood({ draft }: { draft: string }) {
  if (!draft.trim() || draft.startsWith("/")) return null;
  const p = parseMessage(draft);
  const intent = detectIntent(draft, p);
  const chips: string[] = [];
  if (p.o2_pct != null) chips.push(`O2 ${fmt(p.o2_pct)}%`);
  if (p.pressure_psi != null) chips.push(p.pressure_raw && !/psi/i.test(p.pressure_raw) ? `${p.pressure_raw} = ${fmt(p.pressure_psi)} psi` : `${fmt(p.pressure_psi)} psi`);
  if (p.flow_cm_s != null) chips.push(`flow ${fmt(p.flow_cm_s)} cm/s`);
  if (p.mission) chips.push(getMission(p.mission)?.short ?? p.mission);
  chips.push(...p.investigations, ...p.test_ids);
  const label = INTENT_LABEL[intent];
  if (!chips.length && !label) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 px-3 pb-1 pt-0.5" aria-live="polite">
      <span className="font-mono text-[10px] text-muted">VESTA hears</span>
      {chips.map((c, i) => (
        <span key={`${c}-${i}`} className="hear-chip rounded-full border border-ember/40 bg-ember/10 px-1.5 py-px font-mono text-[10px] text-ember-soft">
          {c}
        </span>
      ))}
      {label && <span className="hear-chip rounded-full border border-line px-1.5 py-px font-mono text-[10px] text-text/80">→ {label}</span>}
    </div>
  );
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};
type SpeechCtor = new () => SpeechRec;

function speechCtor(): SpeechCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function AskBox({
  inputRef,
  busy,
  missionName,
  onSend,
  onStop,
  onCommand,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  busy: boolean;
  missionName: string;
  onSend: (text: string) => void;
  onStop: () => void;
  onCommand: (cmd: Command) => void;
}) {
  const draft = useHearth((s) => s.draft);
  const setDraft = useHearth((s) => s.setDraft);
  const track = useHearth((s) => s.track);
  const [sel, setSel] = useState(0);
  const [unknown, setUnknown] = useState(false);
  const [ignite, setIgnite] = useState(0);
  const [canVoice, setCanVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const rec = useRef<SpeechRec | null>(null);
  const placeholder = useTypedPlaceholder(EXAMPLES, !draft && !busy, PLACEHOLDER);

  useEffect(() => setCanVoice(!!speechCtor()), []);
  useEffect(() => () => rec.current?.stop(), []);
  useEffect(() => {
    setSel(0);
    setUnknown(false);
  }, [draft]);

  const sugg = suggestCommands(draft);
  const argChoices = draft.includes(" ") && sugg[0]?.args ? sugg[0].args.split(" | ") : [];
  const menuItems = argChoices.length ? argChoices.map((a) => ({ key: a, label: a, hint: "", fill: `/${sugg[0].name} ${a}` })) : sugg.map((c) => ({ key: c.name, label: `/${c.name}`, hint: c.hint, fill: c.args ? `/${c.name} ` : `/${c.name}` }));
  const menuOpen = draft.startsWith("/") && menuItems.length > 0;

  const run = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    if (t.startsWith("/")) {
      const cmd = parseCommand(t, missionName);
      if (!cmd) {
        setUnknown(true);
        return;
      }
      setDraft("");
      setIgnite((n) => n + 1);
      track({ kind: "command" });
      onCommand(cmd);
      return;
    }
    setDraft("");
    setIgnite((n) => n + 1);
    onSend(t);
  };

  const pick = (i: number, execute: boolean) => {
    const it = menuItems[i];
    if (!it) return;
    if (it.fill.endsWith(" ") || !execute) {
      setDraft(it.fill);
      inputRef.current?.focus();
    } else run(it.fill);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (menuOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => (s + (e.key === "ArrowDown" ? 1 : menuItems.length - 1)) % menuItems.length);
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        pick(sel, false);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setDraft("");
        return;
      }
      if (e.key === "Enter" && !e.shiftKey && !parseCommand(draft, missionName)) {
        e.preventDefault();
        pick(sel, true);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      run(draft);
    }
  };

  const toggleVoice = () => {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const Ctor = speechCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
      setDraft(text.slice(0, MAX_INPUT));
      if (e.results[e.results.length - 1]?.isFinal) track({ kind: "voice" });
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  };

  const fuel = Math.min(100, (draft.length / MAX_INPUT) * 100);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(draft);
      }}
      className="relative rounded-lg border border-line bg-bg/80 transition focus-within:border-ember focus-within:shadow-[0_0_16px_rgb(var(--ember-rgb)/0.25)]"
    >
      {menuOpen && (
        <ul role="listbox" aria-label="Commands" className="absolute bottom-full left-0 right-0 z-20 mb-1.5 max-h-60 animate-fadeUp overflow-y-auto rounded-lg border border-[#2c3b5e] bg-raised p-1 shadow-[0_-10px_28px_rgba(0,0,0,0.5)]">
          {menuItems.map((it, i) => (
            <li key={it.key} role="option" aria-selected={i === sel}>
              <button
                type="button"
                onMouseEnter={() => setSel(i)}
                onClick={() => pick(i, true)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition ${i === sel ? "bg-ember/15 text-text" : "text-text/85"}`}
              >
                <span className="font-mono text-ember-soft">{it.label}</span>
                <span className="truncate text-[11px] text-muted">{it.hint}</span>
              </button>
            </li>
          ))}
          <li className="px-2 pb-0.5 pt-1 font-mono text-[9px] text-muted">↑↓ choose · Enter run · Tab fill · Esc close</li>
        </ul>
      )}
      <label htmlFor="vesta-input" className="sr-only">
        Ask VESTA
      </label>
      <textarea
        id="vesta-input"
        ref={inputRef}
        rows={2}
        maxLength={MAX_INPUT}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-describedby="vesta-input-help"
        className="block w-full resize-none bg-transparent px-3 pt-2 text-sm placeholder:text-muted/70 focus:outline-none"
      />
      <Understood draft={draft} />
      {unknown && <p className="px-3 pb-1 text-[11px] text-warn">Unknown command. Type / to see the list.</p>}
      <div className="mx-2 h-[2px] overflow-hidden rounded-full bg-line/60" aria-hidden>
        <div className="fuel-bar h-full rounded-full" style={{ width: `${fuel}%` }} />
      </div>
      <div className="flex items-center justify-between gap-2 px-2 pb-1.5 pt-1">
        <span id="vesta-input-help" className="pl-1 font-mono text-[10px] text-muted">
          {draft.length >= COUNT_FROM ? (
            `${draft.length} / ${MAX_INPUT}`
          ) : (
            <>
              Enter to send · <span className="text-ember-soft">/</span> commands<span className="hidden sm:inline"> · Shift+Enter new line</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-1.5">
          {canVoice && !busy && (
            <button type="button" onClick={toggleVoice} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Ask VESTA out loud"} title={listening ? "Listening… click to stop" : "Ask out loud"} className={`vesta-ctl h-8 w-8 ${listening ? "is-on mic-live" : ""}`}>
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
            </button>
          )}
          {busy ? (
            <button type="button" onClick={onStop} className="flex h-8 items-center gap-1 rounded-md border border-bad/60 px-2 text-xs text-bad transition hover:bg-bad/10" aria-label="Stop VESTA">
              <IconStop className="h-3.5 w-3.5" /> Stop
            </button>
          ) : (
            <button type="submit" disabled={!draft.trim()} className={`btn-ember relative h-8 !px-2.5 !py-0 disabled:!shadow-none ${ignite ? (ignite % 2 ? "ignite-a" : "ignite-b") : ""}`} aria-label="Send to VESTA">
              <IconSend className="h-4 w-4" />
            </button>
          )}
        </span>
      </div>
    </form>
  );
}

/** Text for /help: the command list, as a local VESTA message (no AI). */
export function commandHelp(): string {
  return `Commands you can type:\n${COMMANDS.map((c) => `- /${c.name}${c.args ? ` <${c.args.replace(/ \| /g, "|")}>` : ""}: ${c.hint}`).join("\n")}`;
}
