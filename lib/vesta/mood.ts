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

/** Where VESTA's sunglasses sit: "on" covers her eyes (see-through), "up" rests them on her forehead. */
export type Shades = "on" | "up" | "off";

/** Shades stay on while she is relaxed or pleased; she pushes them up to think, to worry and for a warning. */
export function shadesFor(mood: Mood): Shades {
  return mood === "idle" || mood === "happy" ? "on" : "up";
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
