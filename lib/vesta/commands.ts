/** The "/" commands in VESTA's question box. Pure: parsing and suggestions are tested. */
import type { Level, Skin } from "@/lib/store";

export type Command =
  | { kind: "ask"; question: string }
  | { kind: "fact" }
  | { kind: "warp" }
  | { kind: "clear" }
  | { kind: "level"; level: Level }
  | { kind: "skin"; skin: Skin }
  | { kind: "help" };

export interface CommandInfo {
  name: string;
  /** What to show after the name, e.g. "<student|researcher|engineer>". */
  args?: string;
  hint: string;
}

export const COMMANDS: CommandInfo[] = [
  { name: "audit", hint: "Fire-safety audit for this mission" },
  { name: "compare", hint: "Compare ACME, CFI and SPICE" },
  { name: "gaps", hint: "What has never been tested here?" },
  { name: "rank", hint: "Which experiment matters most here?" },
  { name: "fact", hint: "A space fire fact from the data" },
  { name: "level", args: "student | researcher | engineer", hint: "How technical answers are" },
  { name: "skin", args: "ember | nebula | mars | moon", hint: "Change the accent colour" },
  { name: "warp", hint: "Hyperspace!" },
  { name: "clear", hint: "Clear the chat" },
  { name: "help", hint: "What VESTA can do" },
];

const LEVELS: Level[] = ["student", "researcher", "engineer"];
const SKINS: Skin[] = ["ember", "nebula", "mars", "moon"];

/** Commands whose name starts with what was typed after "/". Empty when the text is not a command. */
export function suggestCommands(draft: string): CommandInfo[] {
  if (!draft.startsWith("/")) return [];
  const word = draft.slice(1).split(/\s/)[0].toLowerCase();
  if (draft.slice(1).includes(" ")) return COMMANDS.filter((c) => c.name === word && c.args);
  return COMMANDS.filter((c) => c.name.startsWith(word));
}

/** Turns "/level engineer" into an action; null when the text is not a known command. */
export function parseCommand(text: string, missionName = "this mission"): Command | null {
  const t = text.trim();
  if (!t.startsWith("/")) return null;
  const [name, arg = ""] = t.slice(1).toLowerCase().split(/\s+/, 2);
  switch (name) {
    case "audit":
      return { kind: "ask", question: `Run a fire-safety audit for the ${missionName}.` };
    case "compare":
      return { kind: "ask", question: "Compare ACME, CFI and SPICE." };
    case "gaps":
      return { kind: "ask", question: `What data is missing for the ${missionName}?` };
    case "rank":
      return { kind: "ask", question: `Which investigation is most relevant for the ${missionName}?` };
    case "fact":
      return { kind: "fact" };
    case "warp":
      return { kind: "warp" };
    case "clear":
      return { kind: "clear" };
    case "help":
      return { kind: "help" };
    case "level":
      return LEVELS.includes(arg as Level) ? { kind: "level", level: arg as Level } : null;
    case "skin":
      return SKINS.includes(arg as Skin) ? { kind: "skin", skin: arg as Skin } : null;
    default:
      return null;
  }
}
