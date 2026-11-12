import { describe, expect, it } from "vitest";
import { shouldShowLanding } from "@/lib/landing";

describe("launch screen", () => {
  it("shows on the home page once per tab", () => {
    expect(shouldShowLanding({ path: "/", search: "", launched: false })).toBe(true);
    expect(shouldShowLanding({ path: "/", search: "", launched: true })).toBe(false);
  });

  it("stays out of the way on deep links", () => {
    expect(shouldShowLanding({ path: "/explorer", search: "", launched: false })).toBe(false);
    expect(shouldShowLanding({ path: "/safety", search: "?mission=iss", launched: false })).toBe(false);
  });

  it("can be forced with ?launch and skipped with ?skipintro or ?present", () => {
    expect(shouldShowLanding({ path: "/compare", search: "?launch=1", launched: true })).toBe(true);
    expect(shouldShowLanding({ path: "/", search: "?skipintro", launched: false })).toBe(false);
    expect(shouldShowLanding({ path: "/", search: "?present=1", launched: false })).toBe(false);
  });
});
