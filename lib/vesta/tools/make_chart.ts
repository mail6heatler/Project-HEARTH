import { z } from "zod";
import { defineTool, fail } from "./types";

export const CHART_TYPES = ["line", "bar", "scatter", "radar", "heatmap"] as const;
export const MAX_CHART_POINTS = 2000;

const SeriesSchema = z.object({
  name: z.string().max(60),
  values: z.array(z.number()).max(MAX_CHART_POINTS).optional().describe("bar / line / radar: one value per category"),
  points: z.array(z.array(z.number()).min(2).max(2)).max(MAX_CHART_POINTS).optional().describe("scatter: [x, y] pairs"),
  cells: z.array(z.array(z.number()).min(3).max(3)).max(MAX_CHART_POINTS).optional().describe("heatmap: [x_index, y_index, value]"),
  highlight: z.boolean().optional().describe("scatter: draw this series as a large labelled marker, e.g. the mission's own conditions"),
});

export const MakeChartInput = z.object({
  type: z.enum(CHART_TYPES),
  title: z.string().min(1).max(80),
  x_label: z.string().max(40).optional(),
  y_label: z.string().max(40).optional(),
  categories: z.array(z.string().max(40)).max(60).optional().describe("x categories (bar/line/heatmap) or radar axis names"),
  y_categories: z.array(z.string().max(40)).max(60).optional().describe("heatmap y categories"),
  radar_max: z.array(z.number()).max(60).optional().describe("radar: max value per axis"),
  series: z.array(SeriesSchema).min(1).max(8),
  source_note: z.string().max(160).optional().describe("Where the numbers come from, e.g. 'query_data on ACME rows'"),
});
export type MakeChartArgs = z.infer<typeof MakeChartInput>;

const PALETTE = ["#4CC9F0", "#A78BFA", "#5EE6A8", "#FF7A2F", "#FFC857", "#FF5D6C", "#FFB98A", "#97A3BC"];
/** A series named after an investigation always gets that investigation's colour. */
const INV_COLOR: Record<string, string> = { ACME: "#4CC9F0", CFI: "#A78BFA", SPICE: "#5EE6A8" };
const AXIS = {
  axisLine: { lineStyle: { color: "#1F2A44" } },
  axisLabel: { color: "#97A3BC" },
  splitLine: { lineStyle: { color: "#1F2A44" } },
  nameTextStyle: { color: "#97A3BC" },
};

export interface ChartPayload {
  id: string;
  title: string;
  type: (typeof CHART_TYPES)[number];
  option: Record<string, unknown>;
  source_note?: string;
}

/** Numbers that must be traceable to earlier tool results (heatmap indexes are positions, not data). */
export function chartDataNumbers(a: MakeChartArgs): number[] {
  const out: number[] = [];
  for (const s of a.series) {
    out.push(...(s.values ?? []));
    for (const p of s.points ?? []) out.push(...p);
    for (const c of s.cells ?? []) out.push(c[2]);
  }
  return out;
}

export function countPoints(a: MakeChartArgs): number {
  return a.series.reduce((n, s) => n + (s.values?.length ?? 0) + (s.points?.length ?? 0) + (s.cells?.length ?? 0), 0);
}

/** Build a plain-JSON ECharts option (no functions) from the validated spec. */
export function buildOption(a: MakeChartArgs): Record<string, unknown> {
  const base = {
    backgroundColor: "transparent",
    color: PALETTE,
    title: { text: a.title, left: 0, top: 0, textStyle: { color: "#E8ECF6", fontSize: 13 } },
    tooltip: { trigger: a.type === "scatter" || a.type === "heatmap" ? "item" : "axis" },
    legend: a.series.length > 1 ? { top: 26, textStyle: { color: "#97A3BC" } } : undefined,
    grid: { left: 48, right: 16, top: a.series.length > 1 ? 62 : 40, bottom: 40, containLabel: true },
    animationDuration: 700,
  };
  if (a.type === "radar") {
    const names = a.categories ?? [];
    return {
      ...base,
      radar: {
        indicator: names.map((n, i) => ({ name: n, max: a.radar_max?.[i] })),
        axisName: { color: "#97A3BC" },
        splitLine: { lineStyle: { color: "#1F2A44" } },
        splitArea: { show: false },
      },
      series: [{ type: "radar", data: a.series.map((s) => ({ name: s.name, value: s.values ?? [] })) }],
    };
  }
  if (a.type === "heatmap") {
    const vals = a.series.flatMap((s) => (s.cells ?? []).map((c) => c[2]));
    return {
      ...base,
      xAxis: { type: "category", data: a.categories ?? [], name: a.x_label, ...AXIS },
      yAxis: { type: "category", data: a.y_categories ?? [], name: a.y_label, ...AXIS },
      visualMap: { min: Math.min(0, ...vals), max: Math.max(1, ...vals), calculable: true, orient: "horizontal", left: "center", bottom: 0, textStyle: { color: "#97A3BC" }, inRange: { color: ["#131B2E", "#FF7A2F"] } },
      series: a.series.map((s) => ({ name: s.name, type: "heatmap", data: s.cells ?? [], label: { show: true, color: "#E8ECF6" } })),
    };
  }
  if (a.type === "scatter") {
    return {
      ...base,
      xAxis: { type: "value", name: a.x_label, scale: true, ...AXIS },
      yAxis: { type: "value", name: a.y_label, scale: true, ...AXIS },
      series: a.series.map((s) =>
        s.highlight
          ? {
              name: s.name,
              type: "scatter",
              data: s.points ?? [],
              symbol: "diamond",
              symbolSize: 20,
              z: 10,
              itemStyle: { color: "#FF7A2F", borderColor: "#FFF4E8", borderWidth: 2, shadowBlur: 14, shadowColor: "rgba(255,122,47,0.9)" },
              label: { show: true, formatter: "{a}", position: "top", color: "#FFB98A", fontWeight: "bold" },
            }
          : { name: s.name, type: "scatter", symbolSize: 8, data: s.points ?? [], ...(INV_COLOR[s.name] ? { itemStyle: { color: INV_COLOR[s.name], opacity: 0.85 } } : {}) },
      ),
    };
  }
  return {
    ...base,
    xAxis: { type: "category", data: a.categories ?? [], name: a.x_label, ...AXIS },
    yAxis: { type: "value", name: a.y_label, ...AXIS },
    series: a.series.map((s) => ({ name: s.name, type: a.type, data: s.values ?? [], smooth: a.type === "line" })),
  };
}

let chartSeq = 0;

export const makeChartTool = defineTool({
  name: "make_chart",
  description:
    "Draw a chart in the chat (line, bar, scatter, radar or heatmap, max 2000 points). Use ONLY numbers that came from earlier tool results in this conversation; anything else is rejected. Give categories for bar/line/radar/heatmap, points for scatter, cells for heatmap.",
  input: MakeChartInput,
  run(a, ctx) {
    if (countPoints(a) > MAX_CHART_POINTS) return fail(`too many points (max ${MAX_CHART_POINTS})`);
    const cats = a.categories?.length ?? 0;
    if ((a.type === "bar" || a.type === "line" || a.type === "radar") && a.series.some((s) => (s.values?.length ?? 0) !== cats)) {
      return fail("each series needs exactly one value per category");
    }
    if (a.type === "scatter" && a.series.some((s) => !s.points?.length)) return fail("scatter series need points");
    if (a.type === "heatmap" && a.series.some((s) => !s.cells?.length)) return fail("heatmap series need cells");
    if (ctx.isKnownNumber) {
      const unknown = chartDataNumbers(a).filter((n) => !ctx.isKnownNumber!(n));
      if (unknown.length) return fail(`chart values must come from earlier tool results; not found: ${[...new Set(unknown)].slice(0, 5).join(", ")}`);
    }
    const chart: ChartPayload = { id: `chart-${Date.now().toString(36)}-${++chartSeq}`, title: a.title, type: a.type, option: buildOption(a), source_note: a.source_note };
    return { ok: true, data: { chart }, sources: [], summary: `chart "${a.title}" drawn` };
  },
});
