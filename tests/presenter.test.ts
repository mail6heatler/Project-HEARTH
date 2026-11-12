import { describe, expect, it } from "vitest";
import { NAV } from "@/components/layout/SideNav";
import { CHAPTERS } from "@/lib/presenter/script";
import { chapterMs, fillNarration, pickVoiceName, speechMs, totalMs, wordIndexAt } from "@/lib/presenter/timing";

describe("presentation script", () => {
  it("covers every page in the left menu", () => {
    const covered = new Set(CHAPTERS.map((c) => c.nav).filter(Boolean));
    expect(NAV.map((n) => n.href).filter((h) => !covered.has(h))).toEqual([]);
  });

  it("opens on the launch screen and closes on Team Polaris", () => {
    expect(CHAPTERS[0].actions[0]).toEqual({ do: "launch" });
    expect(CHAPTERS[CHAPTERS.length - 1].say).toContain("Team Polaris");
    expect(new Set(CHAPTERS.map((c) => c.id)).size).toBe(CHAPTERS.length);
  });

  it("speaks no hand-typed numbers: they come from the data when it plays", () => {
    for (const c of CHAPTERS) expect(c.say.replace(/\{tests\}/g, "")).not.toMatch(/\d/);
    expect(fillNarration("built on {tests} tests", { tests: 847 })).toBe("built on 847 tests");
    expect(fillNarration("built on {tests} tests", {})).toBe("built on hundreds of tests");
  });

  it("lasts about a minute and a half", () => {
    const s = totalMs(CHAPTERS, { tests: 847 }) / 1000;
    expect(s).toBeGreaterThan(75);
    expect(s).toBeLessThan(105);
    for (const c of CHAPTERS) expect(chapterMs(c)).toBeLessThan(15_000);
  });
});

describe("narration timing and voice", () => {
  it("times speech by words and finds the word being said", () => {
    expect(speechMs("one two three four", 120)).toBe(2000);
    const t = "Ask VESTA in plain words.";
    expect(wordIndexAt(t, 0)).toBe(0);
    expect(wordIndexAt(t, t.indexOf("VESTA"))).toBe(1);
    expect(wordIndexAt(t, t.indexOf("plain"))).toBe(3);
  });

  it("prefers natural English voices and ignores other languages", () => {
    const voices = [
      { name: "Microsoft Hazel", lang: "en-GB" },
      { name: "Google Deutsch", lang: "de-DE" },
      { name: "Microsoft Aria Online (Natural) - English (United States)", lang: "en-US" },
      { name: "Google US English", lang: "en-US" },
    ];
    expect(pickVoiceName(voices)).toBe("Microsoft Aria Online (Natural) - English (United States)");
    expect(pickVoiceName([{ name: "Google Deutsch", lang: "de-DE" }])).toBeNull();
    expect(pickVoiceName([{ name: "Microsoft Zira", lang: "en-US" }, { name: "Google UK English Female", lang: "en-GB" }])).toBe("Google UK English Female");
  });
});
