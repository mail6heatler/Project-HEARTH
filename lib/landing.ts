/** When the "Launch Project HEARTH" screen shows. Pure, so the rule is tested. */

/** Per browser tab: once launched, the screen stays away until the tab is closed. */
export const LAUNCHED_KEY = "hearth.launched.v1";

export function shouldShowLanding({ path, search, launched }: { path: string; search: string; launched: boolean }): boolean {
  const q = new URLSearchParams(search);
  if (q.has("launch")) return true;
  if (q.has("skipintro") || q.has("present")) return false;
  return path === "/" && !launched;
}
