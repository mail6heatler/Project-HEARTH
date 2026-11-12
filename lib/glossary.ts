/**
 * Plain-language glossary for VESTA's answers. Definitions hold no data values (the only number is the
 * tested envelope rule and the pO2 formula); each term also pulls a supporting NASA passage, with file and
 * page, from the document search when someone hovers it.
 */

export interface GlossaryTerm {
  id: string;
  /** Words that mark the term in text (matched whole-word, case-insensitive). */
  match: string[];
  title: string;
  plain: string;
  /** Search query for a supporting passage in the NASA PDFs. */
  query: string;
}

export const GLOSSARY: GlossaryTerm[] = [
  { id: "po2", match: ["pO2", "partial pressure"], title: "pO2 (oxygen partial pressure)", plain: "The part of the cabin pressure that comes from oxygen: pO2 = (O2% / 100) × pressure. It drives how easily things burn.", query: "oxygen partial pressure" },
  { id: "cool-flame", match: ["cool flame", "cool flames"], title: "Cool flame", plain: "A low-temperature flame that gives off very little light and heat, so it is hard to see and easy for detectors to miss.", query: "cool flame" },
  { id: "envelope", match: ["envelope"], title: "Tested envelope", plain: "The range of conditions NASA actually tested. HEARTH counts tests within ±5 points of O2 and ±2.5 psi of your conditions.", query: "test conditions oxygen pressure range" },
  { id: "microgravity", match: ["microgravity"], title: "Microgravity", plain: "Near-weightlessness, as on the ISS. Hot gas does not rise, so flames turn round and burn differently than on Earth.", query: "microgravity flame" },
  { id: "smoke-point", match: ["smoke point"], title: "Smoke point", plain: "The fuel flow at which a flame starts to release soot as smoke. SPICE measured it in microgravity.", query: "smoke point" },
  { id: "soot", match: ["soot"], title: "Soot", plain: "Tiny carbon particles from incomplete burning. They make flames glow yellow and turn into smoke.", query: "soot" },
  { id: "diluent", match: ["diluent", "diluents"], title: "Diluent", plain: "An inert gas, such as nitrogen or helium, mixed in to thin the oxygen.", query: "diluent" },
  { id: "extinction", match: ["extinction", "extinguished", "self-extinguished"], title: "Extinction", plain: "When a flame goes out on its own, for example because heat or oxygen runs short.", query: "extinction" },
  { id: "flammability", match: ["flammability", "flammable"], title: "Flammability", plain: "How easily a material ignites and keeps burning.", query: "flammability" },
  { id: "cir", match: ["CIR", "Combustion Integrated Rack"], title: "Combustion Integrated Rack", plain: "The ISS facility where ACME and CFI ran their flames.", query: "Combustion Integrated Rack" },
  { id: "coflow", match: ["coflow", "co-flow"], title: "Coflow", plain: "Air flowing alongside the fuel jet, as in SPICE, so the flame sits in a steady stream.", query: "coflow" },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ALL = GLOSSARY.flatMap((t) => t.match.map((m) => ({ m, t })));
const RE = new RegExp(`\\b(${ALL.map((x) => escape(x.m)).sort((a, b) => b.length - a.length).join("|")})\\b`, "gi");

export function findTerm(word: string): GlossaryTerm | undefined {
  const w = word.toLowerCase();
  return ALL.find((x) => x.m.toLowerCase() === w)?.t;
}

/**
 * Splits text so the FIRST mention of each glossary term (per `used` set, usually one per message) can be
 * marked. Later mentions stay plain, so answers do not turn into a sea of underlines.
 */
export function splitTerms(text: string, used: Set<string>): { text: string; term?: GlossaryTerm }[] {
  const out: { text: string; term?: GlossaryTerm }[] = [];
  let last = 0;
  for (const m of text.matchAll(RE)) {
    const term = findTerm(m[0]);
    if (!term || used.has(term.id)) continue;
    used.add(term.id);
    const i = m.index ?? 0;
    if (i > last) out.push({ text: text.slice(last, i) });
    out.push({ text: m[0], term });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}
