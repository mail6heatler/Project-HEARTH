/**
 * The "See HEARTH in action" presentation: chapters of narration plus on-screen actions on the real site.
 * Narration holds no hand-typed numbers: `{tests}` is filled from the data when it plays (tested).
 * Every left-menu page is covered (tested against the side menu). `cue` holds an action until the narrator
 * reaches that word, so clicks land on what is being said.
 */

/** A thing on screen: a CSS selector, or the first element (of `tag`, inside `within`) whose text matches. */
export type Target = string | { text: string; tag?: string; within?: string };

export type Action =
  /** Shows the launch screen and presses LAUNCH (on the narration word `cue`, if given). */
  | { do: "launch"; cue?: string }
  | { do: "go"; path: string }
  | { do: "nav"; path: string }
  | { do: "move"; to: Target }
  | { do: "click"; on: Target }
  | { do: "hover"; on: Target; ms?: number }
  | { do: "ask"; text: string }
  | { do: "waitVesta" }
  | { do: "waitPath"; path: string }
  | { do: "spot"; on: Target; pad?: number }
  | { do: "unspot" }
  | { do: "zoom"; on: Target; scale?: number }
  | { do: "unzoom" }
  | { do: "scroll"; to: Target }
  | { do: "key"; key: string }
  | { do: "cue"; word: string }
  | { do: "wait"; ms: number }
  /** The cursor presses mini VESTA: she flies to the middle, spins, drops her sunglasses on, says `hello`
   *  (VESTA's own words: never a number), then her big chat window unfolds from where she was. */
  | { do: "vestaStage"; hello?: string }
  /** VESTA shrinks into mini VESTA (bottom right) and the page gets the whole screen. */
  | { do: "vestaMini" }
  /** Her big chat window docks back on the right. */
  | { do: "vestaDock" }
  /** The cursor clicks mini VESTA and she warps back in on the right, as a visitor would do it. */
  | { do: "vestaShow" }
  | { do: "end" };

export interface Chapter {
  id: string;
  title: string;
  /** The left-menu page this chapter covers, if any. */
  nav?: string;
  say: string;
  actions: Action[];
}

const FIRST_PANEL = "#main .hud-panel";
const LAST_ANSWER = "#vesta-panel > ul > li:last-child";

export const CHAPTERS: Chapter[] = [
  {
    id: "launch",
    title: "HEARTH",
    say: "Team Polaris presents HEARTH: fire-safety intelligence for crewed habitats, built on {tests} real NASA microgravity fire tests.",
    actions: [{ do: "launch", cue: "real" }],
  },
  {
    id: "overview",
    title: "Mission overview",
    nav: "/",
    say: "On Mission overview, pick a habitat and see its air at a glance. Mini VESTA flags the hazard straight away.",
    actions: [
      { do: "spot", on: "#tour-missions", pad: 6 },
      { do: "cue", word: "pick" },
      { do: "click", on: { text: "Lunar rover", tag: "button", within: "#tour-missions" } },
      { do: "cue", word: "glance" },
      { do: "spot", on: FIRST_PANEL, pad: 6 },
      { do: "zoom", on: FIRST_PANEL, scale: 1.1 },
      { do: "cue", word: "Mini" },
      { do: "unzoom" },
      { do: "spot", on: ".vesta-mini-wrap", pad: 10 },
      { do: "wait", ms: 1300 },
    ],
  },
  {
    id: "vesta",
    title: "Ask VESTA",
    say: "Ask VESTA in plain words. She flies in, checks the NASA data with her tools, cites every source, and tags how sure she is.",
    actions: [
      { do: "vestaStage", hello: "Shades on. Let's check the data." },
      { do: "ask", text: "Is my rover cabin inside the tested data?" },
      { do: "waitVesta" },
      { do: "spot", on: LAST_ANSWER, pad: 4 },
      { do: "wait", ms: 1300 },
    ],
  },
  {
    id: "chart",
    title: "VESTA draws charts",
    say: "Ask for a chart, and she plots every NASA test, oxygen against pressure, with your rover cabin marked. Not one made-up point.",
    actions: [
      { do: "ask", text: "Plot O2 against pressure for every test" },
      { do: "waitVesta" },
      { do: "spot", on: `${LAST_ANSWER} figure`, pad: 6 },
      { do: "cue", word: "marked" },
      { do: "wait", ms: 2000 },
    ],
  },
  {
    id: "map",
    title: "VESTA drives the map",
    say: "Her answers light up the matching tests on the habitat map.",
    actions: [
      { do: "vestaDock" },
      { do: "scroll", to: "#tour-map" },
      { do: "spot", on: "#tour-map", pad: 4 },
      { do: "hover", on: `${LAST_ANSWER} button[title*="lights it up"]`, ms: 2400 },
    ],
  },
  {
    id: "explorer",
    title: "Test explorer",
    nav: "/explorer",
    say: "Test explorer filters every run, and VESTA can open any test for you.",
    actions: [
      { do: "nav", path: "/explorer" },
      { do: "spot", on: FIRST_PANEL, pad: 6 },
      { do: "cue", word: "VESTA" },
      { do: "ask", text: "Explain test ACME-CFIG-128" },
      { do: "waitVesta" },
      { do: "spot", on: '[role="dialog"][aria-label^="Test "] > div', pad: 0 },
      { do: "wait", ms: 1500 },
      { do: "key", key: "Escape" },
    ],
  },
  {
    id: "compare",
    title: "Compare",
    nav: "/compare",
    say: "Ask her to compare, and she lines up ACME, CFI and SPICE side by side.",
    actions: [
      { do: "ask", text: "/compare" },
      { do: "waitPath", path: "/compare" },
      { do: "waitVesta" },
      { do: "spot", on: FIRST_PANEL, pad: 6 },
      { do: "zoom", on: FIRST_PANEL, scale: 1.08 },
      { do: "wait", ms: 1400 },
      { do: "unzoom" },
    ],
  },
  {
    id: "safety",
    title: "Safety & gaps",
    nav: "/safety",
    say: "Safety and gaps shows prevention, detection and suppression evidence, and what NASA has never tested.",
    actions: [
      { do: "ask", text: "/audit" },
      { do: "waitPath", path: "/safety" },
      { do: "waitVesta" },
      { do: "spot", on: FIRST_PANEL, pad: 6 },
      { do: "zoom", on: FIRST_PANEL, scale: 1.1 },
      { do: "cue", word: "never" },
      { do: "wait", ms: 900 },
      { do: "unzoom" },
    ],
  },
  {
    id: "lab",
    title: "My data lab",
    nav: "/lab",
    say: "My data lab checks your own conditions against NASA's, right in your browser.",
    actions: [
      { do: "vestaMini" },
      { do: "nav", path: "/lab" },
      { do: "spot", on: FIRST_PANEL, pad: 6 },
      { do: "zoom", on: FIRST_PANEL, scale: 1.08 },
      { do: "wait", ms: 1600 },
      { do: "unzoom" },
    ],
  },
  {
    id: "dataset",
    title: "Dataset",
    nav: "/dataset",
    say: "Dataset explains every field and lets you download the clean data.",
    actions: [
      { do: "nav", path: "/dataset" },
      { do: "spot", on: FIRST_PANEL, pad: 6 },
      { do: "cue", word: "download" },
      { do: "scroll", to: "#download" },
      { do: "spot", on: "#download", pad: 6 },
      { do: "wait", ms: 1200 },
    ],
  },
  {
    id: "simulator",
    title: "Flame simulator",
    nav: "/simulator",
    say: "The flame simulator replays real tests, in microgravity and on Earth.",
    actions: [
      { do: "nav", path: "/simulator" },
      { do: "cue", word: "replays" },
      { do: "click", on: { text: "Ignite", tag: "button", within: "#main" } },
      { do: "spot", on: FIRST_PANEL, pad: 6 },
      { do: "zoom", on: FIRST_PANEL, scale: 1.08 },
      { do: "wait", ms: 1500 },
      { do: "unzoom" },
    ],
  },
  {
    id: "about",
    title: "About & the engine room",
    nav: "/about",
    say: "About tells our story. And if an AI service fails, VESTA switches engines, down to an offline mode that never fails.",
    actions: [
      { do: "nav", path: "/about" },
      { do: "spot", on: FIRST_PANEL, pad: 6 },
      { do: "cue", word: "if" },
      { do: "vestaShow" },
      { do: "click", on: 'button[aria-controls="engine-room"]' },
      { do: "spot", on: "#engine-room", pad: 4 },
      { do: "wait", ms: 1900 },
      { do: "click", on: 'button[aria-controls="engine-room"]' },
    ],
  },
  {
    id: "end",
    title: "by Team Polaris",
    say: "HEARTH. By Team Polaris.",
    actions: [{ do: "end" }, { do: "wait", ms: 2400 }],
  },
];

/** Where VESTA's window is: mini VESTA, the big centre window she unfolds into, or docked on the right. */
export type VestaSpot = "mini" | "stage" | "docked";

/** Where VESTA's window is when chapter `index` starts (the show begins with mini VESTA), so any chapter can be jumped to. */
export function vestaSpotAt(index: number, chapters: Chapter[] = CHAPTERS): VestaSpot {
  let spot: VestaSpot = "mini";
  for (const c of chapters.slice(0, index))
    for (const a of c.actions) {
      if (a.do === "vestaStage") spot = "stage";
      else if (a.do === "vestaDock" || a.do === "vestaShow") spot = "docked";
      else if (a.do === "vestaMini") spot = "mini";
    }
  return spot;
}
