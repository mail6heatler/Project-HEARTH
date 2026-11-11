import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as enginesGET } from "@/app/api/vesta/engines/route";
import { cleanModel, engineChain, isRealKey, listEngines } from "@/lib/vesta/engines";
import { extractConfidenceTag, type VestaEvent } from "@/lib/vesta/events";
import { checkGrounding, collectNumbers, extractNumbers, matches } from "@/lib/vesta/grounding";
import { detectIntent, parseMessage, runOffline } from "@/lib/vesta/offline";
import type { ChatSession, Provider, ProviderReply, ToolResultMessage } from "@/lib/vesta/providers/types";
import { clearVestaCache, runVesta, type RouterDeps } from "@/lib/vesta/router";
import { runTool, VESTA_TOOLS } from "@/lib/vesta/tools";
import { toolSpecs } from "@/lib/vesta/tools/schemas";

// ------------------------------------------------------------------ mock provider
type Step = ProviderReply | Error | "hang" | ((s: { results: ToolResultMessage[][]; userTexts: string[] }) => ProviderReply);

function mockProvider(id: Provider["id"], script: Step[]) {
  const log = { sessions: 0, results: [] as ToolResultMessage[][], userTexts: [] as string[], sends: 0 };
  const provider: Provider = {
    id,
    model: `${id}-test-model`,
    startSession(): ChatSession {
      log.sessions++;
      let i = 0;
      return {
        async send(signal) {
          log.sends++;
          const step = script[Math.min(i++, script.length - 1)];
          if (step === "hang") {
            return new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("aborted"))));
          }
          if (step instanceof Error) throw step;
          return typeof step === "function" ? step(log) : step;
        },
        addToolResults(r) {
          log.results.push(r);
        },
        addUserText(t) {
          log.userTexts.push(t);
        },
      };
    },
  };
  return { provider, log };
}

const text = (t: string): ProviderReply => ({ text: t, toolCalls: [], stop: "end" });
const tool = (name: string, args: unknown, id = `c-${name}`): ProviderReply => ({ text: "", toolCalls: [{ id, name, args }], stop: "tool_use" });
const httpError = (status: number) => Object.assign(new Error(`status ${status}`), { status });

async function run(deps: RouterDeps, message = "What is pO2 at 34% O2 and 8.2 psi?", engine: "auto" | "claude" | "openrouter" | "groq" | "gemini" | "offline" = "auto") {
  const events: VestaEvent[] = [];
  await runVesta({ messages: [{ role: "user", content: message }], missionId: "lunar-rover", level: "researcher", engine }, (e) => events.push(e), {
    chunkDelayMs: 0,
    useCache: false,
    timeoutMs: 200,
    log: () => {},
    ...deps,
  });
  const answer = events.filter((e) => e.type === "text").map((e) => (e as { delta: string }).delta).join("");
  const engines = events.filter((e) => e.type === "engine") as Extract<VestaEvent, { type: "engine" }>[];
  return { events, answer, engines, last: engines[engines.length - 1] };
}

const GOOD_PO2: Step[] = [tool("physics_calc", { o2_pct: 34, pressure_psi: 8.2 }), text("pO2 is **2.788 psi**, 0.903× ISS (lib/physics.ts).\nConfidence: supported")];

beforeEach(() => clearVestaCache());

// ------------------------------------------------------------------ tool loop + event order
describe("agent tool loop", () => {
  it("runs a tool, feeds the result back and answers with sources + confidence", async () => {
    const { provider, log } = mockProvider("claude", GOOD_PO2);
    const r = await run({ providers: { claude: provider } });
    expect(log.results.length).toBe(1);
    expect(log.results[0][0].content).toContain("2.788");
    expect(r.answer).toContain("2.788");
    expect(r.answer).not.toMatch(/confidence:/i);
    expect(r.last.badge).toBe("via Claude · claude-test-model");
    const conf = r.events.find((e) => e.type === "confidence") as Extract<VestaEvent, { type: "confidence" }>;
    expect(conf.confidence).toBe("supported");
    const src = r.events.find((e) => e.type === "sources") as Extract<VestaEvent, { type: "sources" }>;
    expect(src.sources[0].file).toBe("lib/physics.ts");
  });

  it("emits events in order: engine → step → text → sources → confidence → done", async () => {
    const { provider } = mockProvider("groq", GOOD_PO2);
    const r = await run({ providers: { groq: provider } });
    const order = r.events.map((e) => e.type).filter((t, i, a) => t !== a[i - 1]);
    expect(order).toEqual(["engine", "step", "text", "sources", "confidence", "done"]);
  });

  it("stops tool calls after 6 rounds", async () => {
    const { provider, log } = mockProvider("claude", [
      ...Array.from({ length: 7 }, (_, i) => tool("physics_calc", { o2_pct: 21, pressure_psi: 14.7 }, `c${i}`)),
      text("pO2 is 3.087 psi (lib/physics.ts). Confidence: supported"),
    ]);
    const r = await run({ providers: { claude: provider } });
    expect(log.results.length).toBe(7);
    expect(log.results[6][0].isError).toBe(true);
    expect(r.answer).toContain("3.087");
  });
});

// ------------------------------------------------------------------ make_chart + ui_action
describe("make_chart and ui_action validation", () => {
  it("rejects chart values that never came from a tool result", async () => {
    const res = await runTool("make_chart", { type: "bar", title: "x", categories: ["A"], series: [{ name: "s", values: [123.456] }] }, { isKnownNumber: () => false });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("123.456");
  });

  it("rejects malformed charts (types, shapes, functions as strings stay strings)", async () => {
    expect((await runTool("make_chart", { type: "pie", title: "x", series: [{ name: "a", values: [1] }] })).ok).toBe(false);
    expect((await runTool("make_chart", { type: "bar", title: "x", categories: ["A", "B"], series: [{ name: "a", values: [1] }] })).ok).toBe(false);
    const tooMany = Array.from({ length: 2001 }, (_, i) => [i, i]);
    expect((await runTool("make_chart", { type: "scatter", title: "x", series: [{ name: "a", points: tooMany }] })).ok).toBe(false);
  });

  it("emits a chart event for a valid chart built from tool numbers", async () => {
    const { provider } = mockProvider("claude", [
      tool("rank_investigations", { mission: "lunar-rover" }),
      tool("make_chart", { type: "bar", title: "Relevance", categories: ["ACME", "CFI", "SPICE"], series: [{ name: "Score", values: [94.8, 30.9, 14.1] }] }),
      text("ACME scores 94.8 (ACME_Experimental_Table.csv row 129). Confidence: supported"),
    ]);
    const r = await run({ providers: { claude: provider } });
    const chart = r.events.find((e) => e.type === "chart") as Extract<VestaEvent, { type: "chart" }>;
    expect(chart.chart.option).toBeTruthy();
    expect(JSON.stringify(chart.chart.option)).not.toContain("function");
  });

  it("ui_action validates views, missions and test ids", async () => {
    expect((await runTool("ui_action", { action: "go_view", view: "safety" })).ok).toBe(true);
    expect((await runTool("ui_action", { action: "go_view", view: "nowhere" })).ok).toBe(false);
    expect((await runTool("ui_action", { action: "set_mission", mission: "mars" })).ok).toBe(false);
    expect((await runTool("ui_action", { action: "open_test", test_id: "ACME-CFIG-999" })).ok).toBe(false);
    const ok = await runTool("ui_action", { action: "highlight_tests", test_ids: ["acme-cfig-128", "nope"] });
    expect((ok.data as { ui: { test_ids: string[] } }).ui.test_ids).toEqual(["ACME-CFIG-128"]);
  });

  it("tool schemas convert to plain JSON schema objects for every provider", () => {
    for (const s of toolSpecs(VESTA_TOOLS)) {
      expect(s.parameters.type).toBe("object");
      expect(JSON.stringify(s.parameters)).not.toContain("$ref");
    }
  });
});

// ------------------------------------------------------------------ grounding
describe("grounding", () => {
  it("ignores ids, formulas, page and row refs; keeps real quantities", () => {
    const n = extractNumbers("ACME-CFIG-128 at 34.081% O2 and 7.348 psi (SPICE_Report.pdf p20, row 129), C12H26, 3 tests").map((x) => x.value);
    expect(n).toEqual([34.081, 7.348]);
  });

  it("accepts rounding and % ↔ fraction", () => {
    const known = new Set([2.788, 0.34, 48.006]);
    expect(matches(2.79, 2, known)).toBe(true);
    expect(matches(34, 0, known)).toBe(true);
    expect(matches(48, 0, known)).toBe(true);
    expect(matches(2.9, 1, known)).toBe(false);
  });

  it("asks the model once to fix, then flags unverifiable figures", async () => {
    const { provider, log } = mockProvider("claude", [
      tool("physics_calc", { o2_pct: 34, pressure_psi: 8.2 }),
      text("pO2 is 2.788 psi and flames spread 17.5 cm/s faster. Confidence: supported"),
      text("pO2 is 2.788 psi and flames spread 17.5 cm/s faster. Confidence: supported"),
    ]);
    const r = await run({ providers: { claude: provider } });
    expect(log.userTexts.length).toBe(1);
    expect(log.userTexts[0]).toContain("17.5");
    expect(r.answer).toContain("Some figures could not be verified.");
    const conf = r.events.find((e) => e.type === "confidence") as Extract<VestaEvent, { type: "confidence" }>;
    expect(conf.confidence).toBe("extrapolated");
  });

  it("accepts the fixed answer without a warning", async () => {
    const { provider } = mockProvider("claude", [
      tool("physics_calc", { o2_pct: 34, pressure_psi: 8.2 }),
      text("pO2 is 2.788 psi and 99.9 other things."),
      text("pO2 is 2.788 psi (lib/physics.ts). Confidence: supported"),
    ]);
    const r = await run({ providers: { claude: provider } });
    expect(r.answer).not.toContain("could not be verified");
  });

  it("reads the confidence tag and never upgrades evidence", () => {
    expect(extractConfidenceTag("A.\n**Confidence:** extrapolated").tag).toBe("extrapolated");
    expect(collectNumbers({ a: [1.5, "x 2.25 y"] })).toEqual(new Set([1.5, 2.25]));
    expect(checkGrounding("pO2 is 2.788 psi", new Set([2.788])).ok).toBe(true);
  });
});

// ------------------------------------------------------------------ backup chain
describe("backup chain", () => {
  it("skips engines without a key", async () => {
    const { provider } = mockProvider("gemini", GOOD_PO2);
    const r = await run({ providers: { gemini: provider } });
    expect(r.engines.map((e) => e.id)).toEqual(["gemini"]);
  });

  it("falls back on 429 with a short note", async () => {
    const claude = mockProvider("claude", [httpError(429)]);
    const groq = mockProvider("groq", GOOD_PO2);
    const r = await run({ providers: { claude: claude.provider, groq: groq.provider } });
    expect(r.last.id).toBe("groq");
    expect(r.last.note).toBe("Claude limit reached, answered with Groq");
  });

  it("falls back on 401/403 and 5xx", async () => {
    const claude = mockProvider("claude", [httpError(401)]);
    const groq = mockProvider("groq", [httpError(503)]);
    const gemini = mockProvider("gemini", GOOD_PO2);
    const r = await run({ providers: { claude: claude.provider, groq: groq.provider, gemini: gemini.provider } });
    expect(r.last.id).toBe("gemini");
    expect(r.last.fallback_from?.map((f) => f.reason)).toEqual(["key rejected", "service error"]);
  });

  it("falls back on timeout", async () => {
    const groq = mockProvider("groq", ["hang"]);
    const gemini = mockProvider("gemini", GOOD_PO2);
    const r = await run({ providers: { groq: groq.provider, gemini: gemini.provider }, timeoutMs: 50 });
    expect(r.last.id).toBe("gemini");
    expect(r.last.note).toContain("timed out");
  });

  it("falls back on repeated invalid tool calls", async () => {
    const claude = mockProvider("claude", [tool("physics_calc", { o2_pct: "high" }, "a"), tool("no_such_tool", {}, "b"), tool("physics_calc", { o2_pct: -5 }, "c")]);
    const groq = mockProvider("groq", GOOD_PO2);
    const r = await run({ providers: { claude: claude.provider, groq: groq.provider } });
    expect(r.last.id).toBe("groq");
    expect(r.last.note).toContain("invalid tool call");
  });

  it("falls back when the model cannot use tools (400 about tools)", async () => {
    const claude = mockProvider("claude", [Object.assign(new Error("tools are not supported for this model"), { status: 400 })]);
    const groq = mockProvider("groq", GOOD_PO2);
    const r = await run({ providers: { claude: claude.provider, groq: groq.provider } });
    expect(r.last.fallback_from?.[0].reason).toBe("cannot use tools");
  });

  it("ends in Offline mode when every AI engine fails", async () => {
    const r = await run({
      providers: { claude: mockProvider("claude", [httpError(429)]).provider, groq: mockProvider("groq", [httpError(500)]).provider, gemini: mockProvider("gemini", ["hang"]).provider },
      timeoutMs: 30,
    });
    expect(r.last.id).toBe("offline");
    expect(r.last.badge).toBe("Offline mode");
    expect(r.answer).toContain("2.788");
    expect(r.events[r.events.length - 1].type).toBe("done");
  });

  it("a chosen engine is tried first, then the chain continues", async () => {
    expect(engineChain("gemini")).toEqual(["gemini", "claude", "openrouter", "groq", "offline"]);
    expect(engineChain("offline")).toEqual(["offline"]);
    const r = await run({ providers: {} }, "What is pO2 at 34% O2 and 8.2 psi?", "groq");
    expect(r.last.id).toBe("offline");
    expect(r.last.note).toBe("Groq no key, answered with Offline mode");
  });

  it("OpenRouter answers when set, and on a 429 falls back to Groq", async () => {
    const ok = await run({ providers: { openrouter: mockProvider("openrouter", GOOD_PO2).provider } });
    expect(ok.last.id).toBe("openrouter");
    expect(ok.last.badge).toBe("via OpenRouter · openrouter-test-model");
    const limited = mockProvider("openrouter", [httpError(429)]);
    const groq = mockProvider("groq", GOOD_PO2);
    const r = await run({ providers: { openrouter: limited.provider, groq: groq.provider } });
    expect(r.last.id).toBe("groq");
    expect(r.last.note).toBe("OpenRouter limit reached, answered with Groq");
  });

  it("never shows raw provider error text", async () => {
    const claude = mockProvider("claude", [Object.assign(new Error("secret internal detail sk-ant-XYZ"), { status: 500 })]);
    const r = await run({ providers: { claude: claude.provider } });
    expect(JSON.stringify(r.events)).not.toContain("sk-ant");
    expect(JSON.stringify(r.events)).not.toContain("secret internal detail");
  });

  it("caches identical questions", async () => {
    const { provider, log } = mockProvider("claude", GOOD_PO2);
    const req = { messages: [{ role: "user" as const, content: "pO2 at 34% and 8.2 psi?" }], missionId: "iss", level: "student" as const, engine: "auto" as const };
    const ev1: VestaEvent[] = [];
    const ev2: VestaEvent[] = [];
    await runVesta(req, (e) => ev1.push(e), { providers: { claude: provider }, chunkDelayMs: 0 });
    await runVesta(req, (e) => ev2.push(e), { providers: { claude: provider }, chunkDelayMs: 0 });
    expect(log.sessions).toBe(1);
    expect(ev2[ev2.length - 1]).toEqual({ type: "done", cached: true });
  });

  it("does not cache a fallback answer", async () => {
    const limited = mockProvider("claude", [httpError(429)]);
    const groq = mockProvider("groq", GOOD_PO2);
    const req = { messages: [{ role: "user" as const, content: "pO2 at 34% and 8.2 psi, after a limit?" }], missionId: "iss", level: "student" as const, engine: "auto" as const };
    const ev1: VestaEvent[] = [];
    const ev2: VestaEvent[] = [];
    const deps = { providers: { claude: limited.provider, groq: groq.provider }, chunkDelayMs: 0, log: () => {} };
    await runVesta(req, (e) => ev1.push(e), deps);
    await runVesta(req, (e) => ev2.push(e), deps);
    expect(groq.log.sessions).toBe(2);
    expect(ev2[ev2.length - 1]).toEqual({ type: "done" });
  });
});

// ------------------------------------------------------------------ engines endpoint
describe("engines endpoint", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it("lists only id, label, available and never leaks keys", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-SECRET-123";
    process.env.OPENROUTER_API_KEY = "sk-or-SECRET-789";
    process.env.GROQ_API_KEY = "gsk_SECRET_456";
    process.env.GEMINI_API_KEY = "PASTE_YOUR_KEY_HERE";
    const res = enginesGET();
    const body = await res.text();
    expect(body).not.toContain("SECRET");
    expect(body).not.toContain("sk-ant");
    expect(body).not.toContain("gsk_");
    expect(body).not.toContain("sk-or-");
    const list = JSON.parse(body) as Record<string, unknown>[];
    expect(list.map((e) => Object.keys(e).sort().join(","))).toEqual(Array(6).fill("available,id,label"));
    expect(list.find((e) => e.id === "claude")?.available).toBe(true);
    expect(list.find((e) => e.id === "openrouter")?.available).toBe(true);
    expect(list.find((e) => e.id === "gemini")?.available).toBe(false);
    expect(list.find((e) => e.id === "offline")?.available).toBe(true);
  });

  it("treats empty and PASTE values as missing and cleans model names", () => {
    expect(isRealKey("")).toBe(false);
    expect(isRealKey("PASTE_HERE")).toBe(false);
    expect(cleanModel("claude-sonnet-5-5# VESTA AI keys")).toBe("claude-sonnet-5-5");
    expect(listEngines({} as NodeJS.ProcessEnv).filter((e) => e.available).map((e) => e.id)).toEqual(["auto", "offline"]);
  });
});

// ------------------------------------------------------------------ offline mode
describe("offline mode", () => {
  it("extracts numbers, units, test ids and missions", () => {
    const p = parseMessage("Is 34% O2 at 8.2 psi with 5 cm/s ok on the rover? Also ACME-CFIG-128");
    expect([p.o2_pct, p.pressure_psi, p.flow_cm_s, p.mission]).toEqual([34, 8.2, 5, "lunar-rover"]);
    expect(p.test_ids).toEqual(["ACME-CFIG-128"]);
    expect(parseMessage("21% at 1 atm").pressure_psi).toBe(14.6959);
    expect(parseMessage("30% at 0.7 bar").pressure_psi).toBeCloseTo(10.153, 3);
  });

  it("detects every intent", () => {
    expect(detectIntent("help")).toBe("help");
    expect(detectIntent("Explain SPICE-001")).toBe("explain_test");
    expect(detectIntent("Compare ACME and CFI")).toBe("compare");
    expect(detectIntent("What data is missing for the Moon base?")).toBe("gaps");
    expect(detectIntent("Which conditions have never been tested?")).toBe("gaps");
    expect(detectIntent("Which investigation is most relevant for the ISS?")).toBe("rank");
    expect(detectIntent("Run a safety audit")).toBe("safety");
    expect(detectIntent("Is 34% at 8.2 psi tested?")).toBe("assess");
    expect(detectIntent("What is pO2 at 34% O2 and 8.2 psi?")).toBe("calc");
    expect(detectIntent("How does ISS cabin air compare with the ISS reference pO2?")).toBe("calc");
    expect(detectIntent("Compare the investigations")).toBe("compare");
    expect(detectIntent("What is a cool flame?")).toBe("explain_topic");
    expect(detectIntent("sing me a song")).toBe("unknown");
    expect(detectIntent("What oxygen levels were tested in the CFI droplet experiments?")).toBe("investigation");
    expect(detectIntent("What fuels did SPICE use?")).toBe("investigation");
    expect(detectIntent("Is the rover covered by ACME tests?")).toBe("assess");
    expect(detectIntent("What data is missing for CFI?")).toBe("gaps");
  });

  it("answers what one investigation tested with its real ranges", async () => {
    const cfi = await runOffline({ message: "What oxygen levels were tested in the CFI droplet experiments?", missionId: "iss", level: "student", emit: () => {} });
    expect(cfi.intent).toBe("investigation");
    expect(cfi.text).toContain("Oxygen: 17–21%");
    expect(cfi.text).not.toContain("ISS value");
    const spice = await runOffline({ message: "Under what pressure and oxygen did SPICE run?", level: "student", emit: () => {} });
    expect(spice.text).toContain("Oxygen: 21%");
    expect(spice.text).toContain("SPICE_Report");
  });

  const cases: [string, string[]][] = [
    ["What is pO2 at 34% O2 and 8.2 psi?", ["physics_calc"]],
    ["Is 34% O2 at 8.2 psi inside the tested data?", ["physics_calc", "envelope_check", "nearest_tests"]],
    ["Compare ACME and SPICE", ["compare", "make_chart", "ui_action"]],
    ["What data is missing for the lunar rover?", ["gap_finder", "ui_action"]],
    ["Which investigation is most relevant for the Moon base?", ["rank_investigations", "make_chart", "ui_action"]],
    ["Run a safety audit for the rover", ["physics_calc", "envelope_check", "nearest_tests", "safety_audit"]],
    ["Explain ACME-CFIG-128", ["query_data", "physics_calc", "ui_action"]],
    ["What is a cool flame?", ["search_docs"]],
    ["What oxygen levels were tested in the CFI droplet experiments?", ["query_data", "ui_action"]],
    ["Under what pressure and oxygen did SPICE run?", ["query_data", "search_docs", "ui_action"]],
  ];
  for (const [q, tools] of cases) {
    it(`answers "${q}" with tools, sources, confidence and only grounded numbers`, async () => {
      const events: VestaEvent[] = [];
      const out = await runOffline({ message: q, missionId: "lunar-rover", level: "engineer", emit: (e) => events.push(e) });
      for (const t of tools) expect(out.toolsUsed).toContain(t);
      expect(out.sources.length).toBeGreaterThan(0);
      expect(["supported", "extrapolated", "no_data"]).toContain(out.confidence);
      expect(events.some((e) => e.type === "step")).toBe(true);
      // every number in the text must come from the tool results or the question
      const g = checkGrounding(out.text, out.known);
      expect(g.unverified, out.text).toEqual([]);
    });
  }

  it("moves the dashboard for compare and gaps", async () => {
    const a = await runOffline({ message: "Compare ACME and CFI", level: "student", emit: () => {} });
    expect(a.ui.some((u) => u.action === "go_view" && u.view === "compare")).toBe(true);
    const b = await runOffline({ message: "What is missing?", missionId: "iss", level: "student", emit: () => {} });
    expect(b.ui.some((u) => u.action === "go_view" && u.view === "safety")).toBe(true);
  });

  it("returns a help list for unknown questions", async () => {
    const out = await runOffline({ message: "tell a joke", level: "student", emit: () => {} });
    expect(out.text).toContain("Offline mode");
    expect(out.confidence).toBe("no_data");
  });
});
