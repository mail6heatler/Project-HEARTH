/**
 * Reads conditions and intent out of a plain-language question: "34%", "8.2 psi", "1 atm", a test id,
 * a mission, compare / gaps / audit. Light (no data import), so the question box can preview what
 * VESTA understood while you type. Offline mode uses the same functions.
 */
import { convertPressure, type PressureUnit } from "@/lib/physics";
import type { Investigation } from "@/lib/types";

export type Intent = "help" | "explain_test" | "chart" | "compare" | "gaps" | "rank" | "safety" | "calc" | "assess" | "explain_topic" | "unknown";

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
  if (/\b(chart|plot|graph|scatter|visuali[sz]e)\b/.test(t)) return "chart";
  const comparing = /\bcompar|\bversus\b|\bvs\.?\b|differen/.test(t);
  if ((comparing && (p.investigations.length >= 1 || /investigation|experiment/.test(t))) || p.investigations.length >= 2) return "compare";
  if (/\bgaps?\b|missing|untested|(not|never) (been )?tested|no data|lack/.test(t)) return "gaps";
  if (/\brank|most relevant|relevan|which investigation|best (investigation|data)/.test(t)) return "rank";
  if (/safety|audit|hazard|fire risk|danger|\brisk/.test(t)) return "safety";
  // a pure calculation (pO2, ratio, conversion) that does not ask about test coverage
  if (/po2|partial pressure|\bratio\b|calculat|comput|convert/.test(t) && !/tested|envelope|assess|inside|covered|\bdata\b|safe/.test(t)) return "calc";
  if (p.o2_pct != null || p.pressure_psi != null || /assess|condition|envelope|tested|safe|cabin/.test(t) || p.mission) return "assess";
  if (/what is|what are|what's|explain|how does|how do|why|tell me about|define|describe/.test(t)) return "explain_topic";
  return "unknown";
}
