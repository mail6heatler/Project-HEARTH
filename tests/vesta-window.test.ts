import { describe, expect, it } from "vitest";
import { GET as factsGET } from "@/app/api/vesta/facts/route";
import { clampRect, DEFAULT_RECT, expandRect, MIN_H, MIN_W, parseSaved, resizeRect, snapZone, TOP } from "@/components/vesta/windowGeometry";
import { fmt, spaceFireFacts } from "@/lib/vesta/facts";
import { glassesFor, GREET_MS, greetingLine, MAX_NUDGES, moodFor, NUDGE_EVERY_MS } from "@/lib/vesta/mood";
import { runTool } from "@/lib/vesta/tools";

// ------------------------------------------------------------------ window geometry
describe("VESTA window geometry", () => {
  it("keeps the window on screen, under the top bar and within its size limits", () => {
    expect(clampRect({ x: -50, y: 0, w: 100, h: 100 }, 1440, 900)).toEqual({ x: 0, y: TOP, w: MIN_W, h: MIN_H });
    expect(clampRect({ x: 1400, y: 880, w: 420, h: 640 }, 1440, 900)).toEqual({ x: 1020, y: 780, w: 420, h: 640 });
    const huge = clampRect({ x: 0, y: TOP, w: 5000, h: 5000 }, 1280, 800);
    expect(huge.w).toBe(1280 - 16);
    expect(huge.h).toBe(800 - TOP - 8);
  });

  it("snaps to a side only near the screen edge", () => {
    expect(snapZone(10, 1440)).toBe("left");
    expect(snapZone(1430, 1440)).toBe("right");
    expect(snapZone(700, 1440)).toBeNull();
  });

  it("resizes from each edge, keeping the right edge fixed when pulling the left one", () => {
    const r = { x: 600, y: 100, w: 420, h: 600 };
    expect(resizeRect(r, "e", 80, 0, 1440, 900)).toEqual({ x: 600, y: 100, w: 500, h: 600 });
    expect(resizeRect(r, "s", 0, 50, 1440, 900)).toEqual({ x: 600, y: 100, w: 420, h: 650 });
    expect(resizeRect(r, "w", -100, 0, 1440, 900)).toEqual({ x: 500, y: 100, w: 520, h: 600 });
    const tooSmall = resizeRect(r, "w", 300, 0, 1440, 900);
    expect(tooSmall.w).toBe(MIN_W);
    expect(tooSmall.x + tooSmall.w).toBe(r.x + r.w);
  });

  it("centres the expanded view below the top bar", () => {
    const e = expandRect(1440, 900);
    expect(e.w).toBe(1040);
    expect(e.x).toBe(200);
    expect(e.y).toBeGreaterThan(TOP);
    expect(e.y + e.h).toBeLessThanOrEqual(900);
  });

  it("reads a saved state and ignores junk", () => {
    expect(parseSaved(JSON.stringify({ dock: "float", hidden: true, rect: { x: 10, y: 80, w: 500, h: 600 } }))).toEqual({ dock: "float", hidden: true, rect: { x: 10, y: 80, w: 500, h: 600 } });
    expect(parseSaved(JSON.stringify({ dock: "sideways", rect: { x: "a" } }))).toEqual({ dock: "right", hidden: false, rect: DEFAULT_RECT });
    expect(parseSaved("{not json")).toBeNull();
    expect(parseSaved(null)).toBeNull();
  });
});

// ------------------------------------------------------------------ moods
describe("VESTA moods", () => {
  it("follow what really happened", () => {
    expect(moodFor(true)).toBe("thinking");
    expect(moodFor(false)).toBe("idle");
    expect(moodFor(false, { role: "user" })).toBe("idle");
    expect(moodFor(false, { role: "vesta", pending: true })).toBe("thinking");
    expect(moodFor(false, { role: "vesta", confidence: "supported" })).toBe("happy");
    expect(moodFor(false, { role: "vesta", confidence: "extrapolated" })).toBe("worried");
    expect(moodFor(false, { role: "vesta", confidence: "no_data" })).toBe("worried");
    expect(moodFor(false, { role: "vesta", error: "lost" })).toBe("worried");
    expect(moodFor(false, { role: "vesta", alert: "bad", confidence: "supported" })).toBe("alert");
    expect(moodFor(false, { role: "vesta", alert: "ok" })).toBe("idle");
  });

  it("keeps her sunglasses on when relaxed or pleased and pushes them up otherwise", () => {
    expect(glassesFor("idle")).toBe("on");
    expect(glassesFor("happy")).toBe("on");
    expect(glassesFor("thinking")).toBe("push");
    expect(glassesFor("worried")).toBe("low");
    expect(glassesFor("alert")).toBe("low");
  });

  it("says hello without numbers, and leads with a warning she already spotted", () => {
    const hi = greetingLine(0, "Lunar rover");
    expect(hi.title).toContain("VESTA");
    expect(greetingLine(2, "Lunar rover").text).toContain("warning for Lunar rover");
    expect(greetingLine(0, "ISS", true).title).not.toBe(hi.title);
    for (const g of [hi, greetingLine(1, "ISS"), greetingLine(0, "ISS", true), greetingLine(3, "Moon base", true)]) expect(`${g.title} ${g.text}`).not.toMatch(/\d/);
    expect(MAX_NUDGES).toBeGreaterThan(0);
    expect(NUDGE_EVERY_MS).toBeGreaterThan(GREET_MS);
  });
});

// ------------------------------------------------------------------ space fire facts
describe("space fire facts", () => {
  it("are built from tool results, each with a source", async () => {
    const facts = await spaceFireFacts();
    expect(facts.length).toBeGreaterThanOrEqual(5);
    for (const f of facts) {
      expect(f.source.length).toBeGreaterThan(3);
      expect(f.sources.length).toBeGreaterThan(0);
    }
    const all = await runTool("query_data", { group_by: "investigation", limit: 1 });
    const total = (all.data as { total: number }).total;
    expect(facts.find((f) => f.id === "count")?.text).toContain(`${total} NASA test runs`);
    const top = await runTool("query_data", { sort: "-o2_pct", limit: 1 });
    const row = (top.data as { rows: { o2_pct: number; source_row: number }[] }).rows[0];
    const max = facts.find((f) => f.id === "max-o2");
    expect(max?.text).toContain(`${fmt(row.o2_pct)}% O2`);
    expect(max?.source).toContain(`row ${row.source_row}`);
    const iss = await runTool("envelope_check", { mission: "iss" });
    expect(facts.find((f) => f.id === "iss")?.text.startsWith(`${(iss.data as { count: number }).count} tests`)).toBe(true);
  });

  it("formats numbers without inventing precision", () => {
    expect([fmt(14.649), fmt(8.001), fmt(85), fmt(2.7876)]).toEqual(["14.65", "8", "85", "2.79"]);
  });

  it("are served by /api/vesta/facts", async () => {
    const res = await factsGET();
    const body = (await res.json()) as { id: string; text: string; source: string }[];
    expect(Array.isArray(body)).toBe(true);
    expect(body.map((f) => f.id)).toContain("count");
  });
});
