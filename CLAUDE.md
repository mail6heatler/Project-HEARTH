# HEARTH — Team Polaris · NASA Space Apps Challenge 2026

## What we are building
HEARTH (Habitat Environment Analysis & Risk Tracking Hub) is an AI-powered web dashboard that summarizes, ranks and interprets NASA microgravity combustion experiments to give fire-safety insights for crewed habitats: ISS, lunar base, pressurized rovers, spacesuits. (No Mars habitat preset: there are no sourced Mars cabin values, and no test ran at Mars gravity.)

It is guided by VESTA (Virtual Engineer for Space-fire Threat Assessment), an AI crewmate built as a tool-using agent. VESTA computes, charts, compares and audits inside the dashboard: its tool results change what the dashboard shows.

- Deadline: 2026-11-10. Audience: students, professors, aerospace researchers and engineers.
- Challenge goals: (1) find investigations most relevant to crew habitats, (2) extract data for flammability modeling, (3) highlight research for next-generation fire-safety equipment. Bonus: uses on Earth.

## Where things live
- GitHub repo: https://github.com/mail6heatler/Project-HEARTH.git (branch `main`). It may already contain a README with the Vercel link: keep it and merge, never force-push.
- Hosting: the EXISTING Vercel project connected to this repo. Every push to `main` deploys. Never create a second Vercel project; link to the existing one.
- Raw NASA data (READ-ONLY, never edit), committed in the GitHub repo and pulled with git: `Pseudo_DataKeep/{ACME,CFI,SPICE}/` each with `<INV>_Engineering_Doc.pdf`, `<INV>_Experimental_Table.csv`, `<INV>_Report.pdf`.
- Clean data made by our script: `data/processed/` (committed, the app reads it).
- Secrets: `.env.local` locally (git-ignored) and Vercel Environment Variables online. Possible keys: `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, plus `ANTHROPIC_MODEL`, `OPENROUTER_MODEL`, `GROQ_MODEL`, `GEMINI_MODEL`. Every key is OPTIONAL; an empty value or a value containing `PASTE` counts as missing. NEVER print, log or commit a key.

## About the data
- ACME: gaseous-fuel flames in the Combustion Integrated Rack (CIR). The table holds only the CFI-G campaign (normal and inverse spherical flames, oxidizer up to 85% O2). BRE (still-air material flammability) and E-FIELD Flames (electric field mimics partial gravity) appear only as text in the PDFs, not as table rows (DATA_NOTES.md Q4).
- CFI: Cool Flames Investigation. Liquid fuel droplets, MDCA in the CIR.
- SPICE: Smoke Point In Co-flow Experiment. Gaseous coflow flames in the Microgravity Science Glovebox flow duct.
- No partial-gravity combustion data exists in PSI yet (future: LUCI, FM2). Microgravity and 1g results bound lunar/Mars gravity.
- Field meanings and every mapping decision go in `docs/DATA_NOTES.md`.

## Reference atmospheres
| Environment | O2 | Pressure |
|---|---|---|
| ISS / Earth sea level | 21% | 14.7 psi |
| Spacesuit | 100% | 4.3 psi |
| Moon base / pressurized rover | ≥30% | ≤10.2 psi |
| Demo rover scenario | 34% | 8.2 psi |
O2 partial pressure: pO2 = (O2% / 100) × P. ISS reference = 3.087 psi.

## Product rules (never break these)
1. Every number shown to a user comes from the data or a tested formula. Never invent values. If missing, say it is missing.
2. VESTA never states a number it did not get from a tool result.
3. Every VESTA claim cites its source (file + row or page).
4. Every finding carries a confidence tag: `supported` | `extrapolated` | `no_data`.
5. Outside the tested range, VESTA does not predict; it names the data gap and the experiment that would fill it.
6. Safety advice is worded as evidence ("evidence suggests…"), never as official NASA rules.
7. Simulated features (live telemetry, fire drill) are clearly labelled DEMO and never mixed with NASA data.
8. The site must never break because a key is missing, a free limit is reached or a model service is down.

## Architecture (one Next.js app on Vercel)
- Next.js 14 App Router, TypeScript strict, Tailwind CSS, at the repo root.
- Charts: `echarts` + `echarts-for-react`. 3D Habitat relevance map: `three` (loaded only when that view is shown; falls back to the flat chart). Client state: `zustand`. Doc search: `minisearch`. Validation: `zod` + `zod-to-json-schema`. Tests: `vitest`.
- AI providers (server side only, in Route Handlers that stream Server-Sent Events, Node runtime, `maxDuration` 60):
  - Claude: `@anthropic-ai/sdk`, model `ANTHROPIC_MODEL`.
  - OpenRouter: `openai` SDK with `baseURL` `https://openrouter.ai/api/v1`, model `OPENROUTER_MODEL`.
  - Groq: `openai` SDK with `baseURL` `https://api.groq.com/openai/v1`, model `GROQ_MODEL`.
  - Gemini: `@google/genai`, model `GEMINI_MODEL`.
- Data prep (run locally once, again only if raw data changes): Python script `scripts/ingest/ingest.py` (pandas, pdfplumber, pymupdf; requirements in `scripts/ingest/requirements.txt`) writes `data/processed/tests.json`, `chunks.json`, `pdf_tables.json`, `ingest_report.md`.

## Folder layout (target)
- `app/` pages: `/` overview, `/explorer`, `/compare`, `/safety`, `/lab`, `/simulator`, `/about`; `app/api/*` route handlers
- `components/` layout/, charts/, vesta/, ui/, fx/ (decorative canvas effects, never data), map3d/ (3D map scene; its scales are in `lib/map3d.ts`)
- `lib/data.ts` (load + query processed data), `lib/physics.ts`, `lib/flame.ts`, `lib/missions.ts`, `lib/safety.ts`, `lib/search.ts`, `lib/types.ts`, `lib/store.ts`
- `lib/vesta/` `agent.ts` (tool loop, provider-agnostic), `router.ts` (engine chain + fallback), `offline.ts` (Offline mode), `providers/` (`anthropic.ts`, `openai-compat.ts` (shared helper), `openrouter.ts`, `groq.ts`, `gemini.ts`, one shared interface), `system-prompt.md`, `tools/` (one file per tool), `grounding.ts`
- `scripts/blueprint/` the live system map: `scan.ts` reads the project, `stories.ts` holds the plain-language text, `render.ts` + `build.ts` write `public/blueprint.html`
- `scripts/ingest/` Python data prep · `data/processed/` clean data · `docs/` notes · `evals/` VESTA test questions · `tests/` vitest

## Clean data model (`data/processed/tests.json`, one object per test run)
`test_id` (stable, e.g. ACME-BRE-001), `investigation` (ACME|CFI|SPICE), `campaign` (string|null), `hardware`, `fuel`, `fuel_phase` (gas|liquid|solid), `geometry`, `size_mm`, `o2_pct`, `pressure_psi`, `diluent`, `flow_cm_s`, `gravity` (ug|1g|efield), `measurements` (string[]), `sensors` (string[]), `outcome`, `key_metric_name`, `key_metric_value`, `source_file`, `source_row`, `notes`.
Unknown value → `null`. Units converted on ingest; original units recorded in DATA_NOTES.md.
`chunks.json`: `{chunk_id, investigation, source_file, page, text}`. `pdf_tables.json`: `{table_id, source_file, page, rows}`.

## VESTA tools (`lib/vesta/tools/`)
- `query_data` filter/aggregate tests, returns rows + sources
- `search_docs` passages from the PDFs with file + page
- `physics_calc` pO2, ratio to ISS, O2 vs Earth, flow regime, unit conversion (shows the formula)
- `nearest_tests` closest tests to given O2/pressure/flow
- `envelope_check` supported (≥5 tests within ±5% O2 and ±2.5 psi) / sparse (1–4) / no_data (0)
- `compare` shared vs different attributes and condition stats for 2–3 investigations
- `rank_investigations` relevance for a mission, returns score parts
- `safety_audit` findings (prevention / detection / suppression) with evidence + confidence
- `gap_finder` untested O2 × pressure cells and missing fuel types
- `make_chart` validated ECharts option (line, bar, scatter, radar, heatmap only)
- `ui_action` tell the dashboard to go to a view, set mission, highlight tests, open a test
Tool schemas are written once in zod and converted for each provider. SSE events from `/api/vesta`: `engine` (which engine is answering), `step`, `text`, `chart`, `ui`, `sources`, `confidence`, `done`, `error`.

## VESTA engines (the backup chain)
| Engine | Used when | Notes |
|---|---|---|
| 1. Claude | `ANTHROPIC_API_KEY` is set | Best quality |
| 2. OpenRouter (free) | `OPENROUTER_API_KEY` is set | Default `OPENROUTER_MODEL=nvidia/nemotron-3.5-super-vl:free` |
| 3. Groq (free) | `GROQ_API_KEY` is set | Default `GROQ_MODEL=openai/gpt-oss-120b` |
| 4. Gemini (free) | `GEMINI_API_KEY` is set | Default `GEMINI_MODEL=gemini-2.5-flash` |
| 5. Offline | always available | Rule-based, no AI, never fails |
- Auto mode (default): try the engines in order 1 → 2 → 3 → 4 → 5 and use the first one that works. Move to the next on: missing key, 401/403, 429 (rate or free limit), 5xx, timeout (20 s), a model that cannot do tool calling, or invalid tool-call output. Never show raw provider errors to users.
- Every engine uses the same system prompt, the same tools and the same grounding check, and must emit the same SSE events.
- Offline mode (`lib/vesta/offline.ts`): a deterministic router detects the intent (assess conditions, compare, gaps, rank, safety audit, explain a test or a topic, help), pulls numbers like "34%" or "8.2 psi" from the message, calls the same tools and builds a templated answer with sources and a confidence tag. Unknown questions get a short list of what it can do.
- `GET /api/vesta/engines` returns only `{id, label, available}` for each engine (never keys or key fragments). The frontend uses it for the model menu.
- Cost and limits: max 6 tool rounds, short answers, cache identical questions for 10 minutes, one request at a time per visitor.

## VESTA model menu (in the VESTA panel header)
- Dropdown with: Auto (recommended) · Claude · OpenRouter · Groq · Gemini · Offline. Engines without a key are shown greyed out with "no key" and cannot be picked.
- The choice is saved in the zustand store and in localStorage, and sent with every message.
- If the picked engine fails, VESTA falls back down the chain and shows a small note in that message, e.g. "Groq limit reached, answered with Gemini".
- Every VESTA message shows a small badge with the engine that answered (e.g. "via Groq · gpt-oss-120b", "Offline mode").

## VESTA personality
Calm, precise, a little dry humour. Speaks first when it sees a hazard. Three explanation levels: student, researcher, engineer. Never bluffs. Original character; never mention film characters.

## Look and feel
- Dark "mission control". Background #070B14, panel #0D1322, raised #131B2E, lines #1F2A44, text #E8ECF6, muted #97A3BC.
- Accent ember #FF7A2F (soft #FFB98A). ACME #4CC9F0, CFI #A78BFA, SPICE #5EE6A8. Status: ok #5EE6A8, warn #FFC857, bad #FF5D6C.
- Fonts self-hosted with next/font/local from `app/fonts/` (latin woff2 files, SIL OFL licences beside them): Chakra Petch (headings), IBM Plex Sans (text), IBM Plex Mono (numbers). Do not switch back to next/font/google: it downloaded the fonts at build time and made builds fail now and then.
- Layout: sticky top bar (logo, mission chips, status) · left nav · main view · VESTA panel on the right (moves below on small screens). Must work at 400px wide.
- Lively but tasteful: chart entry animations, pulsing mission marker, streaming chat, animated VESTA orb. Respect prefers-reduced-motion. Real buttons and labels, visible focus.

## Commands
- `npm run dev` (local site at http://localhost:3000) · `npm run build` · `npm run lint` · `npm test`
- Data prep: `python3 -m venv .venv && . .venv/bin/activate && pip install -r scripts/ingest/requirements.txt && python scripts/ingest/ingest.py`
- Blueprint: `npm run blueprint` (rebuild once) · `npm run blueprint:watch` (live at http://localhost:4321) · `npm run blueprint:reviewed` (after checking the explanations). `npm run build` rebuilds it automatically.
- Deploy: push to `main` (auto) or `npx vercel --prod`

## How Claude Code works here
1. Start: run `git pull` (merge, never force), then read `CLAUDE.md` and `PROGRESS.md`. Then read only what the task needs. The build plan is `MASTER_PROMPT.md` (copy in `docs/MASTER_PROMPT.md`).
2. Do only the current phase's goal. No unrelated rewrites.
3. Before finishing a phase: `npm run lint`, `npm test`, `npm run build` must pass. Fix failures.
4. Never edit `Pseudo_DataKeep/`. Never commit `.env.local` or any secret.
5. If a data column is unclear: check the PDFs, write the answer in `docs/DATA_NOTES.md`; still unclear → ask the user.
6. Ask before adding big new dependencies or changing the architecture.
7. When the user must act (log in, approve in a browser), STOP and give short numbered steps, then wait.
8. Keys: add every key that is set in `.env.local` to Vercel (Production and Preview) by piping the value into `npx vercel env add`, never showing it. When the user adds a new key later, do the same and redeploy.
9. Blueprint (`public/blueprint.html`, generated; never edit it by hand): when you add or remove a page, API route, VESTA tool, engine, lib module, shell component or dependency, or change how the pipeline works, update `scripts/blueprint/stories.ts` and run `npm run blueprint`. Never type a number into a story: use `{{factName}}` from `scan.ts`. This applies until the project is finished. When a file in `scripts/blueprint/pipeline-watch.ts` changes, re-read the matching section of `stories.ts`, correct it if the behaviour changed, then run `npm run blueprint:reviewed`; never run that command without checking. New pipeline files go on the watch list. `tests/blueprint.test.ts` fails if any of this is out of step.
10. End of every phase: update `PROGRESS.md` (Done · Decisions · Problems · Next), then `git add -A`, `git commit -m "Phase N: <summary>"`, `git push origin main`, and report the Vercel URL.
