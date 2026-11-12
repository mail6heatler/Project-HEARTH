import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, bump, EMPTY_STATS, newlyUnlocked } from "@/lib/achievements";
import { GLOSSARY, splitTerms } from "@/lib/glossary";
import { cleanSelection, odometerChars, scrambleFrame, splitNumbers, stripMarkdown } from "@/lib/textfx";
import { COMMANDS, parseCommand, suggestCommands } from "@/lib/vesta/commands";
import { parseMessage as offlineParse } from "@/lib/vesta/offline";
import { detectIntent, parseMessage } from "@/lib/vesta/parse";

describe("text effects", () => {
  it("scramble never touches digits or punctuation and ends on the real text", () => {
    let seed = 0;
    const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const frame = scrambleFrame("pO2 is 2.788 psi", 0, rand);
    expect(frame.length).toBe(16);
    expect(frame.replace(/[A-Za-z#%&*+=<>/\\]/g, "_")).toBe("__2 __ 2.788 ___");
    expect(scrambleFrame("Checking tested data…", 1, rand)).toBe("Checking tested data…");
  });

  it("finds standalone numbers to glow, not ids or formulas", () => {
    const nums = splitNumbers("pO2 is 2.788 psi, 0.903× ISS, 34% O2, test ACME-CFIG-128").filter((p) => p.num).map((p) => p.text);
    expect(nums).toEqual(["2.788", "0.903×", "34%"]);
    expect(splitNumbers("no numbers here")).toEqual([{ text: "no numbers here", num: false }]);
  });

  it("strips Markdown markers for the streaming view, cleans selections and splits odometer digits", () => {
    expect(stripMarkdown("**Yes.** See `physics.ts`\n## Notes\n- one")).toBe("Yes. See physics.ts\nNotes\n• one");
    expect(cleanSelection("  cool \n flame  ")).toBe("cool flame");
    expect(cleanSelection("ab")).toBeNull();
    expect(cleanSelection("x".repeat(400))).toBeNull();
    expect(odometerChars("19.8k").map((c) => c.digit)).toEqual([1, 9, null, 8, null]);
  });
});

describe("glossary", () => {
  it("marks only the first mention of each term, case-insensitively", () => {
    const used = new Set<string>();
    const parts = splitTerms("A Cool flame is hard to see. Cool flames and pO2 matter; pO2 again.", used);
    const marked = parts.filter((p) => p.term).map((p) => `${p.term!.id}:${p.text}`);
    expect(marked).toEqual(["cool-flame:Cool flame", "po2:pO2"]);
    expect(parts.map((p) => p.text).join("")).toBe("A Cool flame is hard to see. Cool flames and pO2 matter; pO2 again.");
    expect(splitTerms("more pO2", used).some((p) => p.term)).toBe(false);
  });

  it("every term has a definition and a search query, and no data values beyond the tested rules", () => {
    for (const t of GLOSSARY) {
      expect(t.plain.length).toBeGreaterThan(20);
      expect(t.query.length).toBeGreaterThan(2);
      const digits = t.plain.match(/\d+(\.\d+)?/g) ?? [];
      expect(digits.every((d) => ["2", "5", "2.5", "100"].includes(d))).toBe(true);
    }
  });
});

describe("slash commands", () => {
  it("suggests by prefix and offers argument choices", () => {
    expect(suggestCommands("/").length).toBe(COMMANDS.length);
    expect(suggestCommands("/le").map((c) => c.name)).toEqual(["level"]);
    expect(suggestCommands("/level ").map((c) => c.args)).toEqual(["student | researcher | engineer"]);
    expect(suggestCommands("hello")).toEqual([]);
  });

  it("parses commands into actions", () => {
    expect(parseCommand("/audit", "Moon base")).toEqual({ kind: "ask", question: "Run a fire-safety audit for the Moon base." });
    expect(parseCommand("/level Engineer")).toEqual({ kind: "level", level: "engineer" });
    expect(parseCommand("/skin mars")).toEqual({ kind: "skin", skin: "mars" });
    expect(parseCommand("/skin purple")).toBeNull();
    expect(parseCommand("/warp")).toEqual({ kind: "warp" });
    expect(parseCommand("/nope")).toBeNull();
    expect(parseCommand("not a command")).toBeNull();
  });
});

describe("question parser (shared with Offline mode)", () => {
  it("is the same function Offline uses and reads conditions while you type", () => {
    expect(offlineParse).toBe(parseMessage);
    const p = parseMessage("Is 34% O2 at 8.2 psi ok on the rover?");
    expect([p.o2_pct, p.pressure_psi, p.mission]).toEqual([34, 8.2, "lunar-rover"]);
    expect(detectIntent("Compare ACME and SPICE")).toBe("compare");
  });
});

describe("achievements", () => {
  it("unlock once from local counters", () => {
    let s = bump(EMPTY_STATS, { kind: "question" });
    expect(newlyUnlocked(s, []).map((a) => a.id)).toEqual(["first-contact"]);
    s = bump(bump(bump(s, { kind: "level", value: "student" }), { kind: "level", value: "engineer" }), { kind: "level", value: "student" });
    expect(s.levels).toEqual(["student", "engineer"]);
    s = bump(s, { kind: "level", value: "researcher" });
    expect(newlyUnlocked(s, ["first-contact"]).map((a) => a.id)).toEqual(["all-levels"]);
    s = bump(s, { kind: "tool", value: "safety_audit" });
    expect(newlyUnlocked(s, ["first-contact", "all-levels"]).map((a) => a.id)).toEqual(["safety-officer"]);
    expect(EMPTY_STATS.levels).toEqual([]);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });
});
