"use client";
import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { newId, useHearth } from "@/lib/store";
import { streamVesta } from "@/lib/vesta/client";
import type { UiEvent } from "@/lib/vesta/tools/ui_action";

const MAX_INPUT = 2000;

/** The question in flight. Shared because any component may send, and the VESTA panel holds the Stop button. */
let active: AbortController | null = null;

export function useVesta() {
  const router = useRouter();

  const stop = useCallback(() => active?.abort(), []);

  const applyUi = useCallback(
    (ui: UiEvent) => {
      const s = useHearth.getState();
      if (ui.action === "go_view" && ui.path) {
        const q = ui.view === "compare" && ui.compare?.length ? `?inv=${ui.compare.join(",")}` : "";
        router.push(`${ui.path}${q}`);
      } else if (ui.action === "set_mission" && ui.mission) s.setMission(ui.mission);
      else if (ui.action === "highlight_tests" && ui.test_ids) s.setHighlight(ui.test_ids);
      else if (ui.action === "open_test" && ui.test_id) s.openTest(ui.test_id);
    },
    [router],
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, MAX_INPUT);
      const st = useHearth.getState();
      if (!text || st.busy) return;
      st.setBusy(true);
      const history = st.messages
        .filter((m) => !m.pending && !m.error && !m.alert && m.text)
        .slice(-8)
        .map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.text.slice(0, MAX_INPUT * 3) }));
      st.addMessage({ id: newId(), role: "user", text, steps: [], charts: [], sources: [] });
      const id = newId();
      st.addMessage({ id, role: "vesta", text: "", steps: [], charts: [], sources: [], pending: true });
      const upd = useHearth.getState().updateMessage;
      const { startLive, updateLive, recordUsage } = useHearth.getState();
      const controller = new AbortController();
      active = controller;
      startLive();
      useHearth.getState().track({ kind: "question" });
      let answerTokens = 0;
      let answerComplete = true;
      try {
        const stream = streamVesta(
          { messages: [...history, { role: "user", content: text }], mission: st.missionId, level: st.level, engine: st.engine },
          controller.signal,
        );
        for await (const ev of stream) {
          switch (ev.type) {
            case "engine":
              upd(id, (m) => ({ ...m, badge: ev.badge, note: ev.note, engineId: ev.id }));
              updateLive((l) => ({ ...l, engine: ev.id, model: ev.model, served: undefined, fallbacks: ev.fallback_from ?? [] }));
              break;
            case "usage": {
              const tokens = (ev.input ?? 0) + (ev.output ?? 0);
              const known = ev.input !== null || ev.output !== null;
              answerTokens += tokens;
              if (!known) answerComplete = false;
              recordUsage({ engine: ev.engine, input: ev.input, output: ev.output });
              updateLive((l) => ({ ...l, calls: l.calls + 1, tokens: l.tokens + tokens, served: ev.served ?? l.served }));
              upd(id, (m) => {
                const u = m.usage ?? { input: 0, output: 0, calls: 0, unreported: 0 };
                return {
                  ...m,
                  served: ev.served ?? m.served,
                  usage: { input: u.input + (ev.input ?? 0), output: u.output + (ev.output ?? 0), calls: u.calls + 1, unreported: u.unreported + (known ? 0 : 1) },
                };
              });
              break;
            }
            case "step":
              if (ev.status === "done" && ev.tool !== "engine") useHearth.getState().track({ kind: "tool", value: ev.tool });
              upd(id, (m) => {
                const steps = [...m.steps];
                const i = steps.findIndex((s) => s.tool === ev.tool && s.status === "running");
                if (ev.status !== "running" && i >= 0) steps[i] = { tool: ev.tool, status: ev.status, summary: ev.summary };
                else steps.push({ tool: ev.tool, status: ev.status, summary: ev.summary });
                return { ...m, steps };
              });
              break;
            case "text":
              upd(id, (m) => ({ ...m, text: m.text + ev.delta }));
              break;
            case "chart":
              upd(id, (m) => ({ ...m, charts: [...m.charts, ev.chart] }));
              break;
            case "ui":
              applyUi(ev.ui);
              break;
            case "sources":
              upd(id, (m) => ({ ...m, sources: ev.sources }));
              break;
            case "confidence":
              upd(id, (m) => ({ ...m, confidence: ev.confidence, confidenceNote: ev.note }));
              break;
            case "error":
              upd(id, (m) => ({ ...m, error: ev.message }));
              break;
            case "done":
              upd(id, (m) => ({ ...m, pending: false, cached: ev.cached }));
              break;
          }
        }
      } catch {
        if (controller.signal.aborted) upd(id, (m) => ({ ...m, note: "Stopped before finishing." }));
        else upd(id, (m) => ({ ...m, error: "Connection to VESTA was lost. Please try again." }));
      } finally {
        upd(id, (m) => ({ ...m, pending: false }));
        // only fully reported answers feed the "average per answer" figure
        useHearth.getState().endLive(answerComplete && !controller.signal.aborted ? answerTokens : null);
        useHearth.getState().setBusy(false);
      }
    },
    [applyUi],
  );

  return { send, stop, applyUi };
}

/** Ask the server for the no-AI proactive alert of a mission and post it as a VESTA message. */
export async function postMissionAlert(missionId: string) {
  try {
    const res = await fetch("/api/vesta/alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mission: missionId }) });
    if (!res.ok) return;
    const a = await res.json();
    const s = useHearth.getState();
    s.addMessage({
      id: newId(),
      role: "vesta",
      text: `${a.title}. ${a.text}`,
      badge: "Proactive alert · no AI",
      steps: [],
      charts: [],
      sources: a.sources ?? [],
      confidence: a.confidence,
      alert: a.severity,
    });
    if (Array.isArray(a.highlight)) s.setHighlight(a.highlight);
  } catch {
    /* alerts are optional */
  }
}
