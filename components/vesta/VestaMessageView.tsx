"use client";
import { useState } from "react";
import { EChart } from "@/components/charts/EChart";
import { IconCheck, IconCopy, IconPin } from "@/components/ui/Icons";
import { useHearth, type Step, type VestaMessage } from "@/lib/store";
import { formatTokens } from "@/lib/vesta/burn";
import { ConfidenceTag, SourceChips } from "./Bits";
import { ConfidenceFx, OrbitLoader } from "./Fx";
import { RichText } from "./RichText";
import { toolLabel } from "./suggest";

/** Sources shown before "+N more": enough to see the evidence without burying the answer. */
const SOURCES_SHOWN = 3;

const ALERTS = {
  bad: { label: "Hazard alert", cls: "border-bad/70 text-bad", bar: "bg-bad" },
  warn: { label: "Caution", cls: "border-warn/70 text-warn", bar: "bg-warn" },
  ok: { label: "Mission note", cls: "border-ok/60 text-ok", bar: "bg-ok" },
};

function StepRow({ step }: { step: Step }) {
  const isEngine = step.tool === "engine";
  const dot = step.status === "running" ? "animate-pulse bg-ember shadow-[0_0_6px_var(--ember)]" : step.status === "done" ? "bg-ok" : "bg-bad";
  return (
    <li className="flex items-start gap-1.5 font-mono text-[10px] leading-snug text-muted">
      <span className={`mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span>
        {isEngine ? (
          step.summary
        ) : (
          <>
            <span className={step.status === "running" ? "text-ember-soft" : "text-text/80"}>{toolLabel(step.tool)}</span>
            {step.status !== "running" && step.summary && <span>: {step.summary}</span>}
          </>
        )}
      </span>
    </li>
  );
}

/** Live list while VESTA works; folds into one line once it has answered. */
function ToolLog({ steps, pending }: { steps: Step[]; pending?: boolean }) {
  if (!steps.length) return null;
  const list = (
    <ul className="space-y-0.5 border-l border-line pl-2" aria-label="Tool steps">
      {steps.map((s, i) => (
        <StepRow key={i} step={s} />
      ))}
    </ul>
  );
  if (pending) return <div className="mb-2">{list}</div>;
  const tools = steps.filter((s) => s.tool !== "engine").length;
  return (
    <details className="group mb-2">
      <summary className="cursor-pointer select-none font-mono text-[10px] text-muted hover:text-text">
        {tools} {tools === 1 ? "tool" : "tools"} used <span className="text-ember-soft group-open:hidden">· show</span>
        <span className="hidden text-ember-soft group-open:inline">· hide</span>
      </summary>
      <div className="mt-1">{list}</div>
    </details>
  );
}

function Working({ steps }: { steps: Step[] }) {
  const running = [...steps].reverse().find((s) => s.status === "running" && s.tool !== "engine");
  return (
    <p className="flex items-center gap-2 text-muted">
      <OrbitLoader />
      {running ? `${toolLabel(running.tool)}…` : "Thinking…"}
    </p>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked: the text can still be selected by hand */
    }
  };
  return (
    <button type="button" onClick={copy} aria-label={copied ? "Answer copied" : "Copy answer"} className="flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[10px] text-muted transition hover:text-text">
      {copied ? <IconCheck className="h-3 w-3 text-ok" /> : <IconCopy className="h-3 w-3" />}
      {copied ? "copied" : "copy"}
    </button>
  );
}

function Sources({ m, onOpen }: { m: VestaMessage; onOpen: (id: string) => void }) {
  const [all, setAll] = useState(false);
  const hidden = m.sources.length - SOURCES_SHOWN;
  const shown = all || hidden <= 0 ? m.sources : m.sources.slice(0, SOURCES_SHOWN);
  return (
    <div className="flex flex-wrap items-center gap-1">
      <SourceChips sources={shown} onOpen={onOpen} />
      {hidden > 0 && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="rounded border border-ember/40 px-1.5 py-0.5 font-mono text-[10px] text-ember-soft transition hover:border-ember">
          {all ? "show fewer" : `+${hidden} more`}
        </button>
      )}
    </div>
  );
}

export function VestaMessageView({ m }: { m: VestaMessage }) {
  const pin = useHearth((s) => s.pin);
  const openTest = useHearth((s) => s.openTest);

  if (m.role === "user") {
    return (
      <li className="vesta-rocket relative ml-8 max-w-full shrink-0 self-end whitespace-pre-wrap break-words rounded-xl rounded-br-sm border border-ember/30 bg-gradient-to-br from-ember/20 to-ember/5 px-3 py-2 text-sm">
        <span className="sr-only">You: </span>
        {m.text}
      </li>
    );
  }

  const alert = m.alert ? ALERTS[m.alert] : undefined;
  return (
    <li className={`relative mr-1 shrink-0 overflow-hidden rounded-xl rounded-bl-sm border bg-panel/95 py-2 pl-3.5 pr-3 text-sm ${alert ? `animate-alertIn ${alert.cls}` : "animate-fadeUp border-line"}`}>
      <span className={`absolute inset-y-0 left-0 w-[3px] ${alert?.bar ?? "bg-gradient-to-b from-ember to-ember/10"}`} aria-hidden />
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="vesta-dot" aria-hidden />
        <span className="font-head text-xs font-semibold tracking-wider text-ember-soft">VESTA</span>
        {alert && <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">{alert.label}</span>}
        {m.badge && <span className="rounded bg-raised px-1.5 py-0.5 font-mono text-[10px] text-muted">{m.badge}</span>}
        {m.served && <span className="font-mono text-[10px] text-ember-soft" title="The model FreeLLMAPI picked">→ {m.served}</span>}
        {m.usage && (
          <span className="font-mono text-[10px] text-muted" title={`${m.usage.input} read + ${m.usage.output} written, ${m.usage.calls} model calls${m.usage.unreported ? `, ${m.usage.unreported} without a count` : ""}`}>
            · {formatTokens(m.usage.input + m.usage.output)} tokens
          </span>
        )}
        {m.cached && <span className="font-mono text-[10px] text-muted">cached</span>}
      </div>
      {m.note && <p className="mb-1 text-[11px] text-warn">{m.note}</p>}
      <ToolLog steps={m.steps} pending={m.pending} />
      {m.charts.map((c) => (
        <figure key={c.id} className="my-2 rounded-md border border-line bg-bg p-2">
          <EChart option={c.option} height={220} ariaLabel={`Chart: ${c.title}`} />
          <figcaption className="mt-1 flex items-center justify-between gap-2 text-[10px] text-muted">
            <span>{c.source_note ?? "Data from VESTA tool results"}</span>
            <button type="button" onClick={() => pin(c)} className="flex shrink-0 items-center gap-1 rounded border border-line px-1.5 py-0.5 hover:border-ember hover:text-text">
              <IconPin className="h-3 w-3" /> Pin to dashboard
            </button>
          </figcaption>
        </figure>
      ))}
      <div className={`space-y-1 leading-relaxed text-text/90 ${m.pending && m.text ? "typing-caret" : ""}`}>
        {m.text ? <RichText text={m.text} /> : m.pending ? <Working steps={m.steps} /> : null}
        {m.error && <p className="text-bad">{m.error}</p>}
      </div>
      {(m.sources.length > 0 || m.confidence) && (
        <div className="mt-2 space-y-1.5 border-t border-line pt-2">
          <Sources m={m} onOpen={openTest} />
          <div className="flex flex-wrap items-center justify-between gap-1">
            {m.confidence ? (
              <ConfidenceFx value={m.confidence}>
                <ConfidenceTag value={m.confidence} note={m.confidenceNote} />
              </ConfidenceFx>
            ) : (
              <span />
            )}
            {m.text && !m.pending && <CopyButton text={m.text} />}
          </div>
        </div>
      )}
    </li>
  );
}
