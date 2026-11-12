/**
 * Pipeline watch: fingerprints the files whose behaviour the Blueprint's written explanations describe.
 * The scanner keeps facts right by itself, but it cannot tell what a logic change means. So when one of
 * these files changes, the page says "explanation under review" and a test fails until someone has
 * re-read the matching section of stories.ts and run: npm run blueprint:reviewed
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const REVIEWED_FILE = "scripts/blueprint/reviewed.json";

/** `section` is the Blueprint section that explains the file. */
export const WATCHED: { file: string; section: string }[] = [
  { file: "scripts/ingest/ingest.py", section: "journey" },
  { file: "scripts/ingest/describe_sources.py", section: "journey" },
  { file: "lib/data.ts", section: "storage" },
  { file: "lib/search.ts", section: "storage" },
  { file: "lib/api.ts", section: "features" },
  { file: "lib/analysis.ts", section: "features" },
  { file: "lib/store.ts", section: "features" },
  { file: "components/layout/AppShell.tsx", section: "features" },
  { file: "app/api/vesta/route.ts", section: "vesta" },
  { file: "components/vesta/useVesta.ts", section: "vesta" },
  { file: "lib/vesta/router.ts", section: "vesta" },
  { file: "lib/vesta/agent.ts", section: "vesta" },
  { file: "lib/vesta/offline.ts", section: "vesta" },
  { file: "lib/vesta/parse.ts", section: "vesta" },
  { file: "lib/vesta/commands.ts", section: "vesta" },
  { file: "lib/vesta/engines.ts", section: "vesta" },
  { file: "lib/vesta/freellmapi-status.ts", section: "vesta" },
  { file: "lib/vesta/burn.ts", section: "vesta" },
  { file: "lib/vesta/events.ts", section: "vesta" },
  { file: "lib/vesta/alert.ts", section: "vesta" },
  { file: "lib/vesta/system-prompt.md", section: "vesta" },
  { file: "lib/vesta/tools/index.ts", section: "vesta" },
  { file: "lib/vesta/tools/schemas.ts", section: "vesta" },
  { file: "lib/vesta/grounding.ts", section: "honesty" },
  { file: "lib/physics.ts", section: "honesty" },
  { file: "lib/safety.ts", section: "honesty" },
  { file: "next.config.mjs", section: "ship" },
  { file: "package.json", section: "ship" },
  { file: "scripts/demo/record.mjs", section: "ship" },
];

export type ReviewReason = "changed" | "removed" | "new";
export interface ReviewItem {
  file: string;
  section: string;
  reason: ReviewReason;
}

/** Line endings are ignored: the same file is CRLF on Windows and LF on the build server. */
export function fingerprint(text: string): string {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex").slice(0, 16);
}

export function currentFingerprints(root: string = process.cwd()): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { file } of WATCHED) {
    const full = path.join(root, file);
    if (fs.existsSync(full)) out[file] = fingerprint(fs.readFileSync(full, "utf8"));
  }
  return out;
}

export function readReviewed(root: string = process.cwd()): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, REVIEWED_FILE), "utf8")) as Record<string, string>;
  } catch {
    return {};
  }
}

export function pipelineStatus(current: Record<string, string>, reviewed: Record<string, string>): ReviewItem[] {
  const out: ReviewItem[] = [];
  for (const { file, section } of WATCHED) {
    if (!(file in current)) out.push({ file, section, reason: "removed" });
    else if (!(file in reviewed)) out.push({ file, section, reason: "new" });
    else if (reviewed[file] !== current[file]) out.push({ file, section, reason: "changed" });
  }
  return out;
}
