/** Little achievements for exploring HEARTH. Pure rules over local counters; nothing leaves the browser. */

export interface AchievementStats {
  questions: number;
  tools: string[];
  testsOpened: number;
  levels: string[];
  skins: string[];
  warps: number;
  facts: number;
  commands: number;
  selections: number;
  voice: number;
}

export const EMPTY_STATS: AchievementStats = { questions: 0, tools: [], testsOpened: 0, levels: [], skins: [], warps: 0, facts: 0, commands: 0, selections: 0, voice: 0 };

export interface Achievement {
  id: string;
  title: string;
  hint: string;
  done: (s: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-contact", title: "First contact", hint: "Ask VESTA a question", done: (s) => s.questions >= 1 },
  { id: "safety-officer", title: "Safety officer", hint: "Run a fire-safety audit", done: (s) => s.tools.includes("safety_audit") },
  { id: "gap-hunter", title: "Gap hunter", hint: "Find what NASA never tested", done: (s) => s.tools.includes("gap_finder") },
  { id: "side-by-side", title: "Side by side", hint: "Compare experiments", done: (s) => s.tools.includes("compare") },
  { id: "explorer", title: "Explorer", hint: "Open 10 NASA tests", done: (s) => s.testsOpened >= 10 },
  { id: "all-levels", title: "Student to engineer", hint: "Try all three answer levels", done: (s) => s.levels.length >= 3 },
  { id: "fact-finder", title: "Fact finder", hint: "Poke VESTA for 3 space fire facts", done: (s) => s.facts >= 3 },
  { id: "stylist", title: "Stylist", hint: "Try two skins", done: (s) => s.skins.length >= 2 },
  { id: "commander", title: "Commander", hint: "Use a / command", done: (s) => s.commands >= 1 },
  { id: "highlighter", title: "Highlighter", hint: "Ask VESTA about text you selected", done: (s) => s.selections >= 1 },
  { id: "voice", title: "Voice of mission control", hint: "Ask VESTA out loud", done: (s) => s.voice >= 1 },
  { id: "hyperspace", title: "Hyperspace", hint: "Jump to hyperspace", done: (s) => s.warps >= 1 },
];

/** Achievements that are done now but were not unlocked before. */
export function newlyUnlocked(stats: AchievementStats, unlocked: string[]): Achievement[] {
  return ACHIEVEMENTS.filter((a) => !unlocked.includes(a.id) && a.done(stats));
}

/** Adds one event to the counters (returns a new object). */
export function bump(stats: AchievementStats, event: { kind: "question" | "testOpened" | "warp" | "fact" | "command" | "selection" | "voice" } | { kind: "tool" | "level" | "skin"; value: string }): AchievementStats {
  const s = { ...stats, tools: [...stats.tools], levels: [...stats.levels], skins: [...stats.skins] };
  const add = (list: string[], v: string) => (list.includes(v) ? list : [...list, v]);
  switch (event.kind) {
    case "question":
      s.questions++;
      break;
    case "testOpened":
      s.testsOpened++;
      break;
    case "warp":
      s.warps++;
      break;
    case "fact":
      s.facts++;
      break;
    case "command":
      s.commands++;
      break;
    case "selection":
      s.selections++;
      break;
    case "voice":
      s.voice++;
      break;
    case "tool":
      s.tools = add(s.tools, event.value);
      break;
    case "level":
      s.levels = add(s.levels, event.value);
      break;
    case "skin":
      s.skins = add(s.skins, event.value);
      break;
  }
  return s;
}
