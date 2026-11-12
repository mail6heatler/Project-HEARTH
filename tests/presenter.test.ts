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
    expect(CHAPTERS[0].actions[0]).toMatchObject({ do: "launch" });
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

describe("presentation motion", () => {
  it("moves the cursor on a curve that starts and ends exactly on target", async () => {
    const { curvePoint, easeInOutCubic, moveMs } = await import("@/lib/presenter/motion");
    const a = { x: 10, y: 20 };
    const b = { x: 610, y: 420 };
    expect(curvePoint(a, b, 0)).toEqual(a);
    expect(curvePoint(a, b, 1)).toEqual(b);
    const mid = curvePoint(a, b, 0.5, 0.14);
    expect(mid).not.toEqual({ x: 310, y: 220 });
    expect([easeInOutCubic(0), easeInOutCubic(0.5), easeInOutCubic(1)]).toEqual([0, 0.5, 1]);
    expect(moveMs(a, a)).toBe(420);
    expect(moveMs({ x: 0, y: 0 }, { x: 5000, y: 0 })).toBe(1150);
  });

  it("keeps the spotlight inside the screen and drops it when almost nothing is visible", async () => {
    const { spotBox } = await import("@/lib/presenter/motion");
    expect(spotBox({ x: 100, y: 100, w: 200, h: 80 }, 8, 1440, 900)).toEqual({ x: 92, y: 92, w: 216, h: 96 });
    const tall = spotBox({ x: 1040, y: -300, w: 400, h: 2000 }, 0, 1440, 900)!;
    expect(tall.y).toBeGreaterThanOrEqual(10);
    expect(tall.y + tall.h).toBeLessThanOrEqual(890);
    expect(tall.x + tall.w).toBeLessThanOrEqual(1430);
    expect(spotBox({ x: 100, y: 895, w: 200, h: 80 }, 0, 1440, 900)).toBeNull();
  });

  it("splits subtitles into short phrases and finds cue words", async () => {
    const { phraseAt, phrases, wordIndexOf } = await import("@/lib/presenter/motion");
    const text = "Ask VESTA in plain words. She checks the NASA data with her tools, cites every source, and tags how sure she is.";
    const list = phrases(text);
    for (const [a, b] of list) expect(b - a + 1).toBeLessThanOrEqual(9);
    expect(list[0]).toEqual([0, 4]);
    expect(list[list.length - 1][1]).toBe(text.split(" ").length - 1);
    expect(phraseAt(list, 6)).toBe(1);
    expect(wordIndexOf(text, "cites")).toBe(13);
    expect(wordIndexOf("Every page, and our crewmate VESTA, follow it.", "VESTA")).toBe(5);
    expect(wordIndexOf(text, "nowhere")).toBe(-1);
  });

  it("every cue word in the script is actually in its narration", () => {
    for (const c of CHAPTERS)
      for (const a of c.actions)
        if (a.do === "cue") expect(c.say.toLowerCase(), `${c.id}: ${a.word}`).toContain(a.word.toLowerCase());
        else if (a.do === "launch" && a.cue) expect(c.say.toLowerCase(), `${c.id}: ${a.cue}`).toContain(a.cue.toLowerCase());
  });
});
