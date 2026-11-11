/**
 * Offline mode: no AI. Detects the intent, pulls numbers from the message, calls the same tools
 * and fills a template. Every number in the text comes from a tool result or the user's message.
 */
import { getMission, MISSIONS } from "@/lib/missions";
import { convertPressure, type PressureUnit } from "@/lib/physics";
import type { Confidence, Investigation, Source, ToolResult } from "@/lib/types";
import type { AgentOutput } from "./agent";
import { dedupeSources, lowerConfidence, type Emit } from "./events";
import { collectNumbers, matches } from "./grounding";
import type { Level } from "./prompt";
import { runTool } from "./tools";
import type { ChartPayload } from "./tools/make_chart";
import type { UiEvent } from "./tools/ui_action";

export type Intent = "help" | "explain_test" | "compare" | "gaps" | "rank" | "safety" | "calc" | "investigation" | "assess" | "explain_topic" | "unknown";

export interface Parsed {
  o2_pct?: number;
  pressure_psi?: number;
  pressure_raw?: string;
  flow_cm_s?: number;
  test_ids: string[];
  investigations: Investigation[];
  mission?: string;
}

const TEST_ID = /\b(ACME-CFIG-\d{3}|CFI-FLEX-\d{4}(?:-DUP)?|SPICE-\d{3})\b/gi;

export function parseMessage(msg: string): Parsed {
  const test_ids = [...new Set((msg.match(TEST_ID) ?? []).map((s) => s.toUpperCase()))];
  const clean = msg.replace(TEST_ID, " ");
  const o2m = clean.match(/(\d+(?:\.\d+)?)\s*%/);
  const o2 = o2m ? Number(o2m[1]) : undefined;
  const pm = clean.match(/(\d+(?:\.\d+)?)\s*(psia|psi|bar|atm|kpa)\b/i);
  let pressure: number | undefined;
  if (pm) {
    const unit = pm[2].toLowerCase().replace("psia", "psi").replace("kpa", "kPa") as PressureUnit;
    pressure = unit === "psi" ? Number(pm[1]) : convertPressure(Number(pm[1]), unit, "psi").value;
  }
  const fm = clean.match(/(-?\d+(?:\.\d+)?)\s*cm\s*\/\s*s/i);
  const invs = (["ACME", "CFI", "SPICE"] as Investigation[]).filter((i) => new RegExp(`\\b${i}\\b`, "i").test(clean));
  const low = clean.toLowerCase();
  let mission: string | undefined;
  if (/\brover\b/.test(low)) mission = "lunar-rover";
  else if (/(moon|lunar)\s*(base|habitat|outpost)/.test(low)) mission = "lunar-base";
  else if (/\b(iss|space station|station)\b/.test(low)) mission = "iss";
  else if (/\b(space\s*suit|spacesuit|suit|eva)\b/.test(low)) mission = "spacesuit";
  return {
    o2_pct: o2 != null && o2 >= 0 && o2 <= 100 ? o2 : undefined,
    pressure_psi: pressure != null && pressure > 0 ? pressure : undefined,
    pressure_raw: pm?.[0],
    flow_cm_s: fm ? Number(fm[1]) : undefined,
    test_ids,
    investigations: invs,
    mission,
  };
}

export function detectIntent(msg: string, p: Parsed = parseMessage(msg)): Intent {
  const t = msg.toLowerCase().trim();
  if (!t || /^(help|\?|what can you do|hi|hello|hey)\b/.test(t)) return "help";
  if (p.test_ids.length) return "explain_test";
  const comparing = /\bcompar|\bversus\b|\bvs\.?\b|differen/.test(t);
  if ((comparing && (p.investigations.length >= 1 || /investigation|experiment/.test(t))) || p.investigations.length >= 2) return "compare";
  if (/\bgaps?\b|missing|untested|(not|never) (been )?tested|no data|lack/.test(t)) return "gaps";
  if (/\brank|most relevant|relevan|which investigation|best (investigation|data)/.test(t)) return "rank";
  if (/safety|audit|hazard|fire risk|danger|\brisk/.test(t)) return "safety";
  // a pure calculation (pO2, ratio, conversion) that does not ask about test coverage
  if (/po2|partial pressure|\bratio\b|calculat|comput|convert/.test(t) && !/tested|envelope|assess|inside|covered|\bdata\b|safe/.test(t)) return "calc";
  // what one investigation covered ("What oxygen levels were tested in CFI?"), not a check of given conditions
  if (p.investigations.length === 1 && p.o2_pct == null && p.pressure_psi == null && !p.mission && /oxygen|\bo2\b|pressure|condition|fuel|airflow|\bflow\b|tested|\brun\b|\bran\b|range|levels?\b|how many|\btests?\b/.test(t)) return "investigation";
  if (p.o2_pct != null || p.pressure_psi != null || /assess|condition|envelope|tested|safe|cabin/.test(t) || p.mission) return "assess";
  if (/what is|what are|what's|explain|how does|how do|why|tell me about|define|describe/.test(t)) return "explain_topic";
  return "unknown";
}

const fmt = (n: number | null | undefined) => (n == null ? "missing" : String(n));
const range = (a: number | null, b: number | null) => (a != null && a === b ? fmt(a) : `${fmt(a)}–${fmt(b)}`);
const METRIC: Record<string, [string, string]> = { burn_time_s: ["Burn time", "s"], hc_fuel_rate_mg_s: ["Hydrocarbon fuel rate", "mg/s"] };
const short = (file: string) => file.split("/").pop() ?? file;
function cite(s?: Source): string {
  if (!s) return "";
  return s.row ? `(${short(s.file)} row ${s.row})` : s.page ? `(${short(s.file)} p${s.page})` : `(${short(s.file)})`;
}

interface Ctx {
  missionId?: string;
  emit: Emit;
  known: Set<number>;
  sources: Source[];
  charts: ChartPayload[];
  ui: UiEvent[];
  conf: Confidence[];
  used: string[];
}

async function call(c: Ctx, name: string, args: unknown): Promise<ToolResult> {
  c.emit({ type: "step", tool: name, status: "running", summary: `calling ${name}` });
  const r = await runTool(name, args, { missionId: c.missionId, isKnownNumber: (n) => matches(n, 6, c.known) });
  c.emit({ type: "step", tool: name, status: r.ok ? "done" : "error", summary: r.summary });
  if (r.ok) {
    c.used.push(name);
    collectNumbers(JSON.stringify(r.data), c.known);
    c.sources.push(...r.sources);
    if (r.confidence) c.conf.push(r.confidence);
    const d = r.data as { chart?: ChartPayload; ui?: UiEvent };
    if (d?.chart) c.charts.push(d.chart);
    if (d?.ui) c.ui.push(d.ui);
  }
  return r;
}

const HELP =
  "I'm in Offline mode (no AI model), so I answer a fixed set of questions with the same NASA data tools:\n" +
  "• Assess conditions: \"Is 34% O2 at 8.2 psi tested?\" or \"What is pO2 at 30% and 10.2 psi?\"\n" +
  "• Compare: \"Compare ACME and SPICE\"\n" +
  "• Gaps: \"What data is missing for the lunar rover?\"\n" +
  "• Rank: \"Which investigation is most relevant for the Moon base?\"\n" +
  "• Safety audit: \"Run a safety audit for the rover\"\n" +
  "• Explain a test or a topic: \"Explain ACME-CFIG-128\", \"What is a cool flame?\"";

// ------------------------------------------------------------------ intents
async function assess(c: Ctx, p: Parsed, level: Level, safetyMode: boolean): Promise<string[]> {
  const m = getMission(p.mission ?? c.missionId);
  const o2 = p.o2_pct ?? m?.o2_pct;
  const pr = p.pressure_psi ?? m?.pressure_psi;
  if (o2 == null || pr == null) {
    c.conf.push("no_data");
    return ["I need both an O2 percentage and a pressure (e.g. \"34% O2 at 8.2 psi\"), or pick a mission in the top bar."];
  }
  const label = p.o2_pct != null ? `${o2}% O2 and ${pr} psi` : `${m!.name} conditions (${o2}% O2, ${pr} psi)`;
  const phys = (await call(c, "physics_calc", { o2_pct: o2, pressure_psi: pr, flow_cm_s: p.flow_cm_s })).data as {
    po2: { value: number; formula: string }; ratio_to_iss: { value: number }; o2_vs_earth: { value: number; delta_pp: number }; iss_po2_psi: number;
    flow_regime?: { regime: string; rule: string };
  };
  const env = (await call(c, "envelope_check", { o2_pct: o2, pressure_psi: pr })).data as {
    status: string; count: number; by_investigation: Record<string, number>; rule: string;
    nearest: { test_id: string; investigation: string; o2_pct: number; pressure_psi: number; distance: number }[];
  };
  const near = (await call(c, "nearest_tests", { o2_pct: o2, pressure_psi: pr, flow_cm_s: p.flow_cm_s, k: 5 })).data as {
    tests: { test_id: string; fuel_phase: string | null; source_file: string; source_row: number; o2_pct: number; pressure_psi: number; distance: number }[];
  };
  const out: string[] = [];
  const enriched = o2 > 21;
  if (enriched) {
    out.push(`Hazard first: oxygen is enriched to ${o2}%, ${phys.o2_vs_earth.value}× Earth air (+${phys.o2_vs_earth.delta_pp} points).`);
  }
  out.push(`At ${label}, pO2 = ${phys.po2.value} psi, which is ${phys.ratio_to_iss.value}× the ISS value of ${phys.iss_po2_psi} psi (lib/physics.ts).`);
  if (level === "engineer") out.push(`Formula: ${phys.po2.formula}.`);
  if (level === "student") out.push("pO2 (oxygen partial pressure) is the share of the total pressure that is oxygen; it tells how much oxygen a flame can actually reach.");
  if (phys.flow_regime) out.push(`Airflow ${p.flow_cm_s} cm/s is in the "${phys.flow_regime.regime}" regime (${phys.flow_regime.rule}).`);
  const by = Object.entries(env.by_investigation).map(([k, v]) => `${k} ${v}`).join(", ");
  out.push(`Data envelope: ${env.status} — ${env.count} NASA tests lie within the window${by ? ` (${by})` : ""}; rule: ${env.rule}.`);
  const first = near.tests[0];
  if (first) {
    out.push(`Nearest test: ${first.test_id} at ${first.o2_pct}% O2 and ${first.pressure_psi} psi, distance ${first.distance} ${cite({ file: first.source_file, row: first.source_row })}.`);
    c.ui.push({ action: "highlight_tests", test_ids: near.tests.map((t) => t.test_id) });
  }
  const phases = [...new Set(near.tests.map((t) => t.fuel_phase).filter(Boolean))];
  if (env.status !== "no_data" && phases.length && !phases.includes("solid")) {
    out.push(`Evidence suggests caution: the nearby tests are ${phases.join(" and ")} flames only — no cabin materials (fabrics, foams) were tested at these conditions.`);
    c.conf.push("extrapolated");
  }
  if (env.status === "no_data") {
    out.push("Outside the tested range I won't predict flame behaviour. A combustion campaign at these exact O2/pressure conditions would fill this gap.");
  }
  if (m && m.gravity.startsWith("lunar")) {
    out.push("All three investigations ran in microgravity; lunar gravity is untested. LUCI or FM2-type experiments at lunar gravity would close that gap.");
    c.conf.push("extrapolated");
  }
  if (safetyMode) {
    const audit = (await call(c, "safety_audit", p.o2_pct != null && p.pressure_psi != null ? { o2_pct: o2, pressure_psi: pr, mission: m?.id } : { mission: m?.id })).data as {
      findings: { category: string; title: string; severity: number; confidence: string; guideline: string }[];
    };
    out.push("Safety audit (evidence, not NASA rules; severity is a HEARTH heuristic 0–100):");
    for (const f of audit.findings) {
      out.push(`• ${f.category[0].toUpperCase()}${f.category.slice(1)} — ${f.title} (severity ${f.severity}, ${f.confidence.replace("_", " ")}): ${f.guideline}`);
    }
    c.ui.push({ action: "go_view", view: "safety", path: "/safety" });
  }
  return out;
}

async function calc(c: Ctx, p: Parsed, level: Level): Promise<string[]> {
  const m = getMission(p.mission ?? c.missionId);
  const o2 = p.o2_pct ?? m?.o2_pct;
  const pr = p.pressure_psi ?? m?.pressure_psi;
  if (o2 == null || pr == null) {
    c.conf.push("no_data");
    return ['I need an O2 percentage and a pressure for that, e.g. "pO2 at 30% and 10.2 psi".'];
  }
  const r = (await call(c, "physics_calc", { o2_pct: o2, pressure_psi: pr, flow_cm_s: p.flow_cm_s })).data as {
    po2: { value: number; formula: string };
    ratio_to_iss: { value: number };
    o2_vs_earth: { value: number };
    iss_po2_psi: number;
    flow_regime?: { regime: string; rule: string };
  };
  const where = p.o2_pct != null ? `${o2}% O2 and ${pr} psi` : `${m!.short} (${o2}% O2, ${pr} psi)`;
  const out = [`At ${where}, pO2 = ${r.po2.value} psi (${r.po2.formula}, lib/physics.ts).`];
  out.push(`That is ${r.ratio_to_iss.value}× the ISS reference pO2 of ${r.iss_po2_psi} psi, and the O2 fraction is ${r.o2_vs_earth.value}× Earth air.`);
  if (r.flow_regime) out.push(`Airflow ${p.flow_cm_s} cm/s is in the "${r.flow_regime.regime}" regime (${r.flow_regime.rule}).`);
  if (level === "student") out.push("pO2 is the part of the total pressure that is oxygen: it is what a flame actually “feels”.");
  out.push("Ask “is it inside the tested data?” to check it against the NASA tests.");
  return out;
}

async function investigation(c: Ctx, inv: Investigation): Promise<string[]> {
  type S = { min: number | null; max: number | null };
  const r = (await call(c, "query_data", { investigation: [inv], group_by: "fuel", limit: 1 })).data as {
    total: number; o2_pct: S; pressure_psi: S; flow_cm_s: S; groups?: { key: string; n: number }[];
  };
  if (!r.total) {
    c.conf.push("no_data");
    return [`I found no countable ${inv} tests in the data.`];
  }
  const out = [`${inv} has ${r.total} countable tests (duplicate rows left out):`];
  out.push(`• Oxygen: ${range(r.o2_pct.min, r.o2_pct.max)}%.`);
  out.push(`• Pressure: ${range(r.pressure_psi.min, r.pressure_psi.max)} psi.`);
  let flow = r.flow_cm_s;
  let flowNote = "";
  if (flow.min != null && flow.min < 0) {
    // negative air speeds failed the range check (range_check_failed:flow); leave them out, as /dataset does
    flow = ((await call(c, "query_data", { investigation: [inv], flow_min: 0, limit: 1 })).data as { flow_cm_s: S }).flow_cm_s;
    flowNote = " (rows with a negative value failed the range check and are left out)";
  }
  out.push(`• Airflow: ${flow.min == null ? "not recorded" : `${range(flow.min, flow.max)} cm/s${flowNote}`}.`);
  if (r.groups?.length) out.push(`• Fuels: ${r.groups.map((g) => `${g.key} (${g.n})`).join(", ")}.`);
  if (inv === "SPICE") {
    // SPICE rows carry no O2 or pressure column: the values come from the report (conditions_from_doc)
    const d = (await call(c, "search_docs", { query: "parameters assume conditions 101 kPa 21% O2", investigation: "SPICE", limit: 1 })).data as {
      passages: { source_file: string; page: number }[];
    };
    const doc = d.passages[0];
    out.push(`The SPICE table has no oxygen or pressure column, so these values are the documented conditions${doc ? ` ${cite({ file: doc.source_file, page: doc.page })}` : ""}, not per-row measurements.`);
  }
  await call(c, "ui_action", { action: "go_view", view: "explorer" });
  return out;
}

async function compare(c: Ctx, p: Parsed): Promise<string[]> {
  const invs = p.investigations.length >= 2 ? p.investigations.slice(0, 3) : (["ACME", "CFI", "SPICE"] as Investigation[]);
  const r = (await call(c, "compare", { investigations: invs })).data as {
    shared: Record<string, string[]>; only: Record<string, Record<string, string[]>>;
    conditions: { investigation: string; tests: number; o2_pct: { min: number | null; max: number | null; mean: number | null }; pressure_psi: { min: number | null; max: number | null; mean: number | null } }[];
  };
  const out = [`Comparing ${invs.join(", ")}:`];
  for (const k of r.conditions) {
    out.push(`• ${k.investigation}: ${k.tests} tests, O2 ${range(k.o2_pct.min, k.o2_pct.max)}%, pressure ${range(k.pressure_psi.min, k.pressure_psi.max)} psi.`);
  }
  const shared = Object.entries(r.shared).filter(([, v]) => v.length).map(([k, v]) => `${k}: ${v.join(", ")}`);
  out.push(`Shared by all: ${shared.length ? shared.join("; ") : "nothing beyond microgravity operation"}.`);
  for (const inv of invs) {
    const phase = r.only[inv]?.fuel_phase ?? [];
    if (phase.length) out.push(`Only ${inv} has ${phase.join("/")} fuels.`);
  }
  const cats = r.conditions.map((k) => k.investigation);
  const means = r.conditions.map((k) => k.o2_pct.mean);
  const pmeans = r.conditions.map((k) => k.pressure_psi.mean);
  if (means.every((x) => x != null) && pmeans.every((x) => x != null)) {
    await call(c, "make_chart", {
      type: "bar", title: "Mean test conditions", categories: cats,
      series: [{ name: "Mean O2 %", values: means }, { name: "Mean pressure psi", values: pmeans }],
      source_note: "compare tool, countable rows",
    });
  }
  await call(c, "ui_action", { action: "go_view", view: "compare", compare: invs });
  return out;
}

async function gaps(c: Ctx, p: Parsed): Promise<string[]> {
  const m = getMission(p.mission ?? c.missionId);
  const g = (await call(c, "gap_finder", { mission: m?.id })).data as {
    focus_cell: { o2_bin: string; p_bin: string; count: number } | null;
    mission_gaps: { o2_bin: string; p_bin: string; missions: string[] }[];
    exploration_region_gaps: { o2_bin: string; p_bin: string }[];
    exploration_region_gap_count: number;
    missing_fuel_phases: string[]; recommendations: { gap: string; suggestion: string }[];
  };
  const out: string[] = [];
  if (m && g.focus_cell) out.push(`${m.name}: its cell (${g.focus_cell.o2_bin} O2, ${g.focus_cell.p_bin}) holds ${g.focus_cell.count} tests.`);
  out.push(`Missing fuel types: ${g.missing_fuel_phases.length ? g.missing_fuel_phases.join(", ") : "none"}. Untested gravity: everything except microgravity.`);
  out.push(`${g.exploration_region_gap_count} empty O2 × pressure cells sit in the exploration region (higher O2, lower pressure).`);
  for (const r of g.recommendations) out.push(`• ${r.gap}: ${r.suggestion}`);
  await call(c, "ui_action", { action: "go_view", view: "safety" });
  return out;
}

async function rank(c: Ctx, p: Parsed): Promise<string[]> {
  const m = getMission(p.mission ?? c.missionId) ?? getMission("lunar-rover")!;
  const args = p.o2_pct != null && p.pressure_psi != null ? { o2_pct: p.o2_pct, pressure_psi: p.pressure_psi } : { mission: m.id };
  const r = (await call(c, "rank_investigations", args)).data as {
    target: { o2_pct: number; pressure_psi: number };
    ranking: { investigation: string; score: number; envelope_count: number; parts: { name: string; points: number; max: number }[] }[];
  };
  const out = [`Relevance for ${r.target.o2_pct}% O2 at ${r.target.pressure_psi} psi (score 0–100, heuristic):`];
  for (const x of r.ranking) {
    out.push(`• ${x.investigation}: ${x.score} — ${x.parts.map((q) => `${q.name} ${q.points}/${q.max}`).join(", ")}; ${x.envelope_count} tests in the envelope.`);
  }
  await call(c, "make_chart", {
    type: "bar", title: "Investigation relevance", categories: r.ranking.map((x) => x.investigation),
    series: [{ name: "Score", values: r.ranking.map((x) => x.score) }], source_note: "rank_investigations",
  });
  await call(c, "ui_action", { action: "go_view", view: "overview" });
  return out;
}

async function explainTest(c: Ctx, p: Parsed): Promise<string[]> {
  const id = p.test_ids[0];
  const r = await call(c, "query_data", { q: id, limit: 1 });
  const rows = (r.data as { rows: { test_id: string; investigation: string; campaign: string | null; fuel: string | null; geometry: string | null; o2_pct: number | null; pressure_psi: number | null; flow_cm_s: number | null; outcome: string | null; key_metric_name: string | null; key_metric_value: number | null; source_file: string; source_row: number }[] }).rows;
  const t = rows.find((x) => x.test_id === id) ?? rows[0];
  if (!t) {
    c.conf.push("no_data");
    return [`I can't find ${id} in the data.`];
  }
  const out = [`${t.test_id} (${t.investigation}${t.campaign ? `, ${t.campaign}` : ""}): ${t.fuel ?? "fuel missing"}, ${t.geometry ?? "geometry missing"} ${cite({ file: t.source_file, row: t.source_row })}.`];
  out.push(`Conditions: O2 ${fmt(t.o2_pct)}%, pressure ${fmt(t.pressure_psi)} psi, airflow ${t.flow_cm_s == null ? "not recorded" : `${t.flow_cm_s} cm/s`}.`);
  if (t.o2_pct != null && t.pressure_psi != null) {
    const ph = (await call(c, "physics_calc", { o2_pct: t.o2_pct, pressure_psi: t.pressure_psi })).data as { po2: { value: number }; ratio_to_iss: { value: number } };
    out.push(`pO2 = ${ph.po2.value} psi (${ph.ratio_to_iss.value}× ISS).`);
  }
  if (t.outcome) out.push(`Outcome: ${t.outcome}.`);
  if (t.key_metric_name && t.key_metric_value != null) {
    const [name, unit] = METRIC[t.key_metric_name] ?? [t.key_metric_name.replace(/_/g, " "), ""];
    out.push(`${name}: ${t.key_metric_value}${unit ? ` ${unit}` : ""}.`);
  }
  await call(c, "ui_action", { action: "open_test", test_id: t.test_id });
  return out;
}

async function explainTopic(c: Ctx, msg: string): Promise<string[]> {
  const q = msg.replace(/^(what is|what are|what's|explain|how does|how do|why|tell me about|define|describe)\s*/i, "").replace(/[?!.]+$/, "");
  const r = (await call(c, "search_docs", { query: q || msg, limit: 2 })).data as { passages: { source_file: string; page: number; snippet: string }[] };
  if (!r.passages.length) {
    c.conf.push("no_data");
    return [`The NASA documents in HEARTH don't mention "${q}". ${HELP}`];
  }
  return [`From the NASA documents:`, ...r.passages.map((x) => `“${x.snippet}” ${cite({ file: x.source_file, page: x.page })}`)];
}

// ------------------------------------------------------------------ entry
export async function runOffline(input: { message: string; missionId?: string; level: Level; emit: Emit }): Promise<AgentOutput & { intent: Intent; known: Set<number> }> {
  const p = parseMessage(input.message);
  const intent = detectIntent(input.message, p);
  const c: Ctx = { missionId: input.missionId, emit: input.emit, known: new Set(), sources: [], charts: [], ui: [], conf: [], used: [] };
  collectNumbers(input.message, c.known);
  if (p.mission && p.mission !== input.missionId && MISSIONS.some((m) => m.id === p.mission)) {
    await call(c, "ui_action", { action: "set_mission", mission: p.mission });
  }
  let lines: string[];
  switch (intent) {
    case "help":
    case "unknown":
      lines = [intent === "unknown" ? `I couldn't match that to something I can answer offline. ${HELP}` : HELP];
      break;
    case "explain_test":
      lines = await explainTest(c, p);
      break;
    case "compare":
      lines = await compare(c, p);
      break;
    case "gaps":
      lines = await gaps(c, p);
      break;
    case "rank":
      lines = await rank(c, p);
      break;
    case "safety":
      lines = await assess(c, p, input.level, true);
      break;
    case "calc":
      lines = await calc(c, p, input.level);
      break;
    case "investigation":
      lines = await investigation(c, p.investigations[0]);
      break;
    case "assess":
      lines = await assess(c, p, input.level, false);
      break;
    case "explain_topic":
      lines = await explainTopic(c, input.message);
      break;
  }
  const confidence: Confidence = intent === "help" || intent === "unknown" ? "no_data" : c.conf.length ? c.conf.reduce(lowerConfidence) : "supported";
  return { intent, known: c.known, text: lines.join("\n"), confidence, sources: dedupeSources(c.sources), charts: c.charts, ui: dedupeUi(c.ui), toolsUsed: c.used };
}

function dedupeUi(list: UiEvent[]): UiEvent[] {
  const seen = new Set<string>();
  return list.filter((u) => {
    const k = JSON.stringify(u);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
