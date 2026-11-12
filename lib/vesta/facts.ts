/**
 * "Space fire facts" for mini VESTA. Every fact is built from a real tool result over the NASA data
 * (the same tools VESTA uses), carries the tool's sources, and contains no hand-typed number.
 * A fact whose tool fails is left out rather than guessed.
 */
import type { Source } from "@/lib/types";
import { runTool } from "./tools";

export interface SpaceFact {
  id: string;
  text: string;
  /** Short human source line for the card, e.g. "ACME_Experimental_Table.csv · row 197". */
  source: string;
  sources: Source[];
}

type Stats = { n: number; min: number | null; max: number | null };
type Group = { key: string; n: number; o2_pct?: Stats; pressure_psi?: Stats };
type Row = { test_id: string; investigation: string; o2_pct: number; pressure_psi: number; source_file: string; source_row: number };

/** Up to 2 decimals, trailing zeros dropped: 14.649 → "14.65", 8.001 → "8". */
export function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

const file = (p: string) => p.split("/").pop() ?? p;
const groupsText = (gs: Group[]) => [...gs].sort((a, b) => b.n - a.n).map((g) => `${g.key} ${g.n}`).join(", ");

async function tool<T>(name: string, args: Record<string, unknown>): Promise<{ data: T; sources: Source[] } | null> {
  const r = await runTool(name, args, {});
  return r.ok && r.data ? { data: r.data as T, sources: r.sources } : null;
}

export async function spaceFireFacts(): Promise<SpaceFact[]> {
  const out: SpaceFact[] = [];

  const all = await tool<{ total: number; groups: Group[] }>("query_data", { group_by: "investigation", limit: 1 });
  if (all) out.push({ id: "count", text: `HEARTH holds ${all.data.total} NASA test runs: ${groupsText(all.data.groups)}.`, source: "ACME, CFI and SPICE experimental tables", sources: all.sources.slice(0, 3) });

  const top = await tool<{ rows: Row[] }>("query_data", { sort: "-o2_pct", limit: 1 });
  const r = top?.data.rows?.[0];
  if (top && r) out.push({ id: "max-o2", text: `The highest oxygen level ever tested here is ${fmt(r.o2_pct)}% O2, in ${r.investigation} (${r.test_id}).`, source: `${file(r.source_file)} · row ${r.source_row}`, sources: top.sources.slice(0, 1) });

  const spice = await tool<{ total: number; o2_pct: Stats; pressure_psi: Stats }>("query_data", { investigation: ["SPICE"], limit: 1 });
  if (spice) {
    const { o2_pct: o, pressure_psi: p, total } = spice.data;
    if (o.min !== null && o.min === o.max && p.min !== null && p.min === p.max) {
      out.push({ id: "spice-air", text: `All ${total} SPICE runs used the same atmosphere: ${fmt(o.min)}% O2 at ${fmt(p.min)} psi. Only the fuel and airflow changed.`, source: "SPICE_Experimental_Table.csv", sources: spice.sources.slice(0, 1) });
    }
  }

  const iss = await tool<{ count: number; target: { o2_pct: number; pressure_psi: number } }>("envelope_check", { mission: "iss" });
  if (iss) out.push({ id: "iss", text: `${iss.data.count} tests sit close to ISS cabin air (${fmt(iss.data.target.o2_pct)}% O2, ${fmt(iss.data.target.pressure_psi)} psi).`, source: "envelope check over all three tables", sources: iss.sources.slice(0, 2) });

  const suit = await tool<{ count: number; target: { o2_pct: number; pressure_psi: number }; nearest: { test_id: string; o2_pct: number; pressure_psi: number }[] }>("envelope_check", { mission: "spacesuit" });
  const near = suit?.data.nearest?.[0];
  if (suit && suit.data.count === 0 && near) {
    out.push({
      id: "spacesuit",
      text: `No test has ever run near spacesuit conditions (${fmt(suit.data.target.o2_pct)}% O2, ${fmt(suit.data.target.pressure_psi)} psi). The closest is ${fmt(near.o2_pct)}% O2 at ${fmt(near.pressure_psi)} psi (${near.test_id}).`,
      source: "envelope check · nearest test",
      sources: suit.sources.slice(0, 1),
    });
  }

  const propane = await tool<{ total: number; groups: Group[] }>("query_data", { fuel: "propane", group_by: "investigation", limit: 1 });
  if (propane && propane.data.total > 0) out.push({ id: "propane", text: `${propane.data.total} tests burned propane: ${groupsText(propane.data.groups)}.`, source: "ACME and SPICE experimental tables", sources: propane.sources.slice(0, 2) });

  return out;
}
