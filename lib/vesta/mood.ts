/**
 * VESTA's face follows what really happened: tools running, the answer's confidence tag, a mission
 * warning. Pure, so the mapping is tested. Decoration only: it never stands in for the tag itself.
 */
import type { Confidence } from "@/lib/types";

export type Mood = "idle" | "thinking" | "happy" | "worried" | "alert";

export interface MoodInput {
  role: "user" | "vesta";
  alert?: "ok" | "warn" | "bad";
  confidence?: Confidence;
  pending?: boolean;
  error?: string;
}

export function moodFor(busy: boolean, last?: MoodInput): Mood {
  if (busy || last?.pending) return "thinking";
  if (!last || last.role !== "vesta") return "idle";
  if (last.alert === "bad" || last.alert === "warn") return "alert";
  if (last.error) return "worried";
  if (last.confidence === "supported") return "happy";
  if (last.confidence === "extrapolated" || last.confidence === "no_data") return "worried";
  return "idle";
}

/**
 * VESTA's nerdy glasses (clear lenses: her eyes always show). "on" sits on her eyes, "push" is her pushing
 * them up her nose as she starts thinking, "low" has them slid down so she peers over them.
 */
export type Glasses = "on" | "push" | "low" | "off";

/** Glasses on while relaxed or pleased; pushed up to think; slid down her nose when worried or warning. */
export function glassesFor(mood: Mood): Glasses {
  if (mood === "thinking") return "push";
  if (mood === "worried" || mood === "alert") return "low";
  return "on";
}

/** How long mini VESTA's hello (jump, wave and bubble) stays up. */
export const GREET_MS = 7000;
/** Until a visitor has opened her once, mini VESTA hops and waves again this often, a few times per visit. */
export const NUDGE_EVERY_MS = 22_000;
export const MAX_NUDGES = 3;

/** What mini VESTA says when she says hello: a warning she already spotted comes first. No numbers. */
export function greetingLine(warnings: number, missionShort: string, nudge = false): { title: string; text: string } {
  if (warnings > 0) return { title: nudge ? "Still here!" : "Hi, I'm VESTA!", text: `I spotted a warning for ${missionShort}. Click me to see it.` };
  if (nudge) return { title: "Psst, need a hand?", text: "Ask me anything about fire safety." };
  return { title: "Hi, I'm VESTA!", text: "Your AI fire-safety crewmate. Click me to ask anything." };
}

/** How long a reaction stays on VESTA's face before she relaxes back to idle. */
export const MOOD_HOLD_MS = 12_000;

export const MOOD_LABEL: Record<Mood, string> = {
  idle: "standing by",
  thinking: "thinking",
  happy: "happy: the data backs this",
  worried: "worried: little or no data",
  alert: "alert: a mission warning",
};
