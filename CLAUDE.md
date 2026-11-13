# HEARTH — Team Polaris · NASA Space Apps Challenge 2026

## What we are building
HEARTH (Habitat Environment Analysis & Risk Tracking Hub) is an AI-powered web dashboard that summarizes, ranks and interprets NASA microgravity combustion experiments to give fire-safety insights for crewed habitats: ISS, lunar base, pressurized rovers, Mars habitats.

It is guided by VESTA (Virtual Engineer for Space-fire Threat Assessment), an AI crewmate built as a tool-using agent. VESTA computes, charts, compares and audits inside the dashboard: its tool results change what the dashboard shows.

- Deadline: 2026-11-10. Audience: students, professors, aerospace researchers and engineers.
- Challenge goals: (1) find investigations most relevant to crew habitats, (2) extract data for flammability modeling, (3) highlight research for next-generation fire-safety equipment. Bonus: uses on Earth.

## Where things live
- GitHub repo: https://github.com/mail6heatler/Project-HEARTH.git (branch `main`). It may already contain a README with the Vercel link: keep it and merge, never force-push.
- Hosting: the EXISTING Vercel project connected to this repo. Every push to `main` deploys. Never create a second Vercel project; link to the existing one.
- Raw NASA data (READ-ONLY, never edit), committed in the GitHub repo and pulled with git: `Pseudo_DataKeep/{ACME,CFI,SPICE}/` each with `<INV>_Engineering_Doc.pdf`, `<INV>_Experimental_Table.csv`, `<INV>_Report.pdf`.
- Clean data made by our script: `data/processed/` (committed, the app reads it).
- Secrets: `.env.local` locally (git-ignored) and Vercel Environment Variables online. Possible keys: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `FREELLMAPI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, plus `ANTHROPIC_MODEL`, `OPENAI_MODEL`, `FREELLMAPI_MODEL`, `FREELLMAPI_BASE_URL`, `FREELLMAPI_BUDGET`, `OPENROUTER_MODEL`, `GROQ_MODEL`, `GEMINI_MODEL`. Every key is OPTIONAL; an empty value or a value containing `PASTE` counts as missing. NEVER print, log or commit a key.

## About the data
- ACME: gaseous-fuel flames in the Combustion Integrated Rack (CIR). Includes BRE (still-air material flammability), CFI-G (oxidizer up to 85% O2), E-FIELD Flames (electric field mimics partial gravity).
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
- `lib/vesta/` `agent.ts` (tool loop, provider-agnostic), `router.ts` (engine chain + fallback), `offline.ts` (Offline mode), `providers/` (`anthropic.ts`, `openai-compat.ts` (shared helper), `openai.ts`, `freellmapi.ts`, `openrouter.ts`, `groq.ts`, `gemini.ts`, one shared interface), `freellmapi-status.ts`, `burn.ts`, `system-prompt.md`, `tools/` (one file per tool), `grounding.ts`
- `scripts/blueprint/` the live system map: `scan.ts` reads the project, `stories.ts` holds the plain-language text, `render.ts` + `build.ts` write `public/blueprint.html`
- `scripts/ingest/` Python data prep · `data/processed/` clean data · `docs/` notes · `evals/` VESTA test questions · `tests/` vitest

## Clean data model (`data/processed/tests.json`, one object per test run)
`test_id` (stable, e.g. ACME-BRE-001), `investigation` (ACME|CFI|SPICE), `campaign` (string|null), `hardware`, `fuel`, `fuel_phase` (gas|liquid|solid), `geometry`, `size_mm`, `o2_pct`, `pressure_psi`, `diluent`, `flow_cm_s`, `gravity` (ug|1g|efield), `measurements` (string[]), `sensors` (string[]), `outcome`, `key_metric_name`, `key_metric_value`, `source_file`, `source_row`, `notes`.
Unknown value → `null`. Units converted on ingest; original units recorded in DATA_NOTES.md.
`chunks.json`: `{chunk_id, investigation, source_file, page, text}`. `pdf_tables.json`: `{table_id, source_file, page, rows}`.

## VESTA tools (`lib/vesta/tools/`)
- `query_data` filter/aggregate tests, returns rows + sources (`points: true` adds every distinct O2 × pressure condition with its test count, for scatter charts)
- `search_docs` passages from the PDFs with file + page
- `physics_calc` pO2, ratio to ISS, O2 vs Earth, flow regime, unit conversion (shows the formula)
- `nearest_tests` closest tests to given O2/pressure/flow
- `envelope_check` supported (≥5 tests within ±5% O2 and ±2.5 psi) / sparse (1–4) / no_data (0)
- `compare` shared vs different attributes and condition stats for 2–3 investigations
- `rank_investigations` relevance for a mission, returns score parts
- `safety_audit` findings (prevention / detection / suppression) with evidence + confidence
- `gap_finder` untested O2 × pressure cells and missing fuel types
- `make_chart` validated ECharts option (line, bar, scatter, radar, heatmap only); series named ACME/CFI/SPICE get their colours, a `highlight` scatter series is a big labelled diamond (e.g. the mission cabin)
- `ui_action` tell the dashboard to go to a view, set mission, highlight tests, open a test
Tool schemas are written once in zod and converted for each provider. SSE events from `/api/vesta`: `engine` (which engine is answering), `step`, `usage` (tokens one model call used, as the provider reported them; none for Offline or cached answers), `text`, `chart`, `ui`, `sources`, `confidence`, `done`, `error`.

## VESTA engines (the backup chain)
| Engine | Used when | Notes |
|---|---|---|
| 1. Claude | `ANTHROPIC_API_KEY` is set | Best quality |
| 2. ChatGPT (paid) | `OPENAI_API_KEY` is set | `openai` SDK on api.openai.com. Default `OPENAI_MODEL=gpt-5-mini`. No key yet: slot kept ready |
| 3. FreeLLMAPI (local, free) | `FREELLMAPI_API_KEY` is set | The team's FreeLLMAPI desktop app on the same PC (`FREELLMAPI_BASE_URL`, default `http://127.0.0.1:31415/v1`), `FREELLMAPI_MODEL=auto` lets it pick a tool-capable model. Local only: never set on Vercel |
| 4. OpenRouter (free) | `OPENROUTER_API_KEY` is set | Default `OPENROUTER_MODEL=nvidia/nemotron-3.5-super-vl:free` |
| 5. Groq (free) | `GROQ_API_KEY` is set | Default `GROQ_MODEL=openai/gpt-oss-120b` |
| 6. Gemini (free) | `GEMINI_API_KEY` is set | Default `GEMINI_MODEL=gemini-2.5-flash` |
| 7. Offline | always available | Rule-based, no AI, never fails |
- Auto mode (default): try the engines in order 1 → 7 and use the first one that works. Move to the next on: missing key, 401/403, 429 (rate or free limit), 5xx, timeout (20 s), a model that cannot do tool calling, or invalid tool-call output. Never show raw provider errors to users.
- Every engine uses the same system prompt, the same tools and the same grounding check, and must emit the same SSE events.
- Offline mode (`lib/vesta/offline.ts`): a deterministic router detects the intent (assess conditions, chart (scatter of every tested O2 × pressure condition with the mission cabin marked; also `/chart`), compare, gaps, rank, safety audit, explain a test or a topic, help), pulls numbers like "34%" or "8.2 psi" from the message, calls the same tools and builds a templated answer with sources and a confidence tag. Unknown questions get a short list of what it can do.
- `GET /api/vesta/engines` returns only `{id, label, available}` for each engine (never keys or key fragments). The frontend uses it for the Engine room.
- `GET /api/vesta/meter` returns engine cooldowns and, when a FreeLLMAPI key is set, its provider health and monthly token budget (`lib/vesta/freellmapi-status.ts`; the budget is read through the desktop app's local sign-in, only when it runs on this PC; `FREELLMAPI_BUDGET=off` turns that off). Never keys, session tokens or provider error text.
- Cost and limits: max 6 tool rounds, short answers, cache identical questions for 10 minutes, one request at a time per visitor.

## VESTA Engine room (in the VESTA panel header)
- A strip under the level picker shows the picked engine, the engine answering right now, tokens burned this session and the FreeLLMAPI budget left; clicking it opens the Engine room (`components/vesta/EngineRoom.tsx`).
- Engine tiles: Auto (recommended) · Claude · ChatGPT · FreeLLMAPI · OpenRouter · Groq · Gemini · Offline. Engines without a key are greyed out with "no key" and cannot be picked; engines resting after a failure show a countdown. The fallback chain lights up while VESTA works.
- Cards: Now running (engine, model, model FreeLLMAPI routed to, calls, tokens, time), Token burn (session total, per engine, average per answer; counts come only from provider `usage` reports, `lib/vesta/burn.ts`), FreeLLMAPI fuel tank (its own budget estimate, per-model bar, provider health).

## VESTA window and effects (desktop; phones keep the panel below the page)
- Same layout, new moves (`components/vesta/useVestaWindow.ts`, pure geometry in `windowGeometry.ts`): drag the header to float it, resize from the edges and corner, drop near the left or right screen edge to dock there, double-click the header to dock right, Expand (Esc to shrink), Pop out / Dock, Hide into mini VESTA (bottom right; a badge counts mission warnings that arrived while hidden). The state is remembered in localStorage.
- VESTA's face (`VestaFace.tsx`) over the orb follows `lib/vesta/mood.ts`: thinking while tools run, happy for `supported`, worried for `extrapolated` / `no_data` / errors, alert for a mission warning; relaxes to idle after a while. Decoration only: the confidence tag stays the source of truth.
  - Readable at 58 px: white eyes with dark outlines and pupils that follow the mouse (or the presenter's cursor, `LOOK_EVENT`), a mouth per mood, sizes in `cqw`. The orb behind her is a calm ember (no white-hot centre, about half the glow); the mood shows as a thin rim.
  - Nerdy look (the user's choice): thick dark glasses with tape on the bridge and clear lenses (her eyes always show), freckles, buck teeth. Glasses on when idle or happy, pushed up her nose as she starts thinking, slid down so she peers over them when worried or alerted (`glassesFor`, tested). Hats: student cap, researcher headset, engineer hard hat.
  - Every visit starts with mini VESTA (window key `hearth.vesta-window.v2`; the panel is not drawn on desktop until the saved state is read). Once per visit, after the launch screen and the tour, she jumps, waves and says hello in a bubble (`greetingLine`, a spotted warning first; no numbers); until a visitor has opened her once (`hearth.vesta-met.v1`) she nudges again a few times (`NUDGE_EVERY_MS`, `MAX_NUDGES`). A new warning while she is mini makes her hop. A question sent from a page button while she is mini opens her. The tour's VESTA step points at mini VESTA. Never during the presentation.
- Poke the orb for a space fire fact: `/api/vesta/facts` builds them from real tool results (`lib/vesta/facts.ts`), each with its source. Never hand-type a fact.
- Effects (`Fx.tsx`, CSS in `app/globals.css`): rocket send, orbiting-planets loader, star burst on `supported`, red pulse on `no_data`, starfield behind the chat, `/warp` hyperspace easter egg (`components/fx/Hyperspace.tsx`). Skins Ember / Nebula / Mars / Moon swap only the accent (`--ember-rgb`), never data or safety colours. All of it stops under prefers-reduced-motion.
- Round 2 (no animation library; GSAP was offered but not approved, so effects are CSS + small hooks):
  - Header: eyes follow the mouse and widen while you type, a hat per level (`VestaFace.tsx`), scrambling status text and a rolling token odometer (`TextFx.tsx`, pure rules in `lib/textfx.ts`), a scan line on mission change.
  - Chat: answers decode word by word while streaming, then numbers glow once (numbers are never scrambled or replaced), tool steps as rocket stages, the confidence tag lands like a stamp, warnings arrive as an incoming transmission (typewriter), source chips light their test up on the map, glossary words (`lib/glossary.ts`) open a plain definition plus a NASA passage that really mentions the word (`Glossary.tsx`, rendered in a portal).
  - Question box (`AskBox.tsx`): typed example questions, "VESTA hears" chips from `lib/vesta/parse.ts` (the Offline parser, now browser-safe), `/` commands (`lib/vesta/commands.ts`), ignition + fuel bar, voice input where the browser supports it.
  - Site: select text → "Ask VESTA about this" (`AskSelection.tsx`), page-change warp (`app/template.tsx`, kept outside transformed parents), ember cursor trail (`components/fx/EmberTrail.tsx`), scroll reveal (`ScrollReveal.tsx`), achievements (`lib/achievements.ts`, `AchievementToasts.tsx`, local only). Trail, reveal and starfield are switches in the looks menu.
  - Never put `position: fixed` UI inside an element with a transform or animation: use a portal or mount it in `AppShell`.
- "See HEARTH in action" is a recorded video, so it plays smoothly every time (`components/presenter/DemoPlayer.tsx`, pure helpers in `lib/presenter/demo.ts`, files in `public/demo/`), opened from the launch screen, the top bar or `?present=1`.
  - Made by `npm run demo:record` (`scripts/demo/record.mjs`): builds and starts the site (`next start`, never dev mode), has Microsoft Aria speak each narration line (`scripts/demo/tts.py`, edge-tts; only the public narration text is sent; cached in `.cache/demo`), then hidden Chrome films `/?present=record` frame by frame on a virtual clock (`scripts/demo/virtual-time.js`: timers, rAF, Date, CSS / Web Animations and smooth scrolling move 1/60 s per captured frame; the clock stands still while the network is busy, so no waiting reaches the video). 1536×864 page at 1.25× = 1920×1080, 60 fps, H.264. Music and sound effects are rendered offline at the logged moments (`renderSoundtrack` in `audio.ts`); voice lines are placed at their chapter starts.
  - Download (player ⤓ and end screen): a panel with Voice / Music and sound effects / Subtitles, set from the player's toggles. Voice + music without subtitles is the recorded file itself; any other mix is made in the viewer's browser while the video plays through once (`components/presenter/exportVideo.ts`: canvas at 30 fps with the subtitles drawn word by word, the chosen tracks through Web Audio, MediaRecorder MP4 or WebM, pauses in a background tab). Pure helpers `isReadyMade`, `downloadName`, `toSrt`, `wrapWords` in `lib/presenter/demo.ts` (tested). A separate `.srt` subtitles file is always offered.
  - Writes `hearth-demo.mp4` (all sound mixed; the ready-made download), `voice.m4a`, `music.m4a`, `poster.jpg`, `subtitles.vtt`, `manifest.json` (chapters, word-timed subtitles). The player keeps voice and music in step with the picture so each can be muted (`steer`: a touch faster or slower, a jump only past 0.3 s; a stopped track is restarted; a failed one is retried once, then the video's mixed sound plays); CC, chapter dots, seek, full screen, download, keys (Space, arrows, F, C, Esc). While it plays, `html.demo-watching` hides the page behind it and rests the 3D map and starfield, so the video decodes without stutter. A missing manifest or a playback error offers the live show instead.
  - Tools: `.tools/` (puppeteer-core, ffmpeg-static; only its package files are committed) and edge-tts in Python. Re-record after changing the script or the pages: `tests/demo.test.ts` fails if the video's chapters or narration no longer match `lib/presenter/script.ts`.
- The live presentation (the backup, at `?present=live` or "Run it live" in the player; `components/presenter/Presenter.tsx`, script in `lib/presenter/script.ts`, timing in `lib/presenter/timing.ts`): an automated ~100 s presentation over the real site.
  - VESTA is the star: the show starts on the ISS with mini VESTA (picking the rover makes her flag the hazard), on "Ask VESTA" the cursor presses mini VESTA and she flies to the middle, spins, drops her shades on and says hello (`VestaActor.tsx`), then spins away as her chat unfolds in the centre; she draws the O2 × pressure chart there, docks right for the map and the pages that need her, shrinks to mini for lab / dataset / simulator and warps back for the Engine room. Script actions `vestaStage` / `vestaMini` / `vestaDock` / `vestaShow`; `vestaSpotAt` (tested) puts her right for any chapter jump.
  - The window moves through `commandVestaWindow` (`useVestaWindow.ts`); nothing is saved while presenting, and `restore` gives the visitor back their own window. Typing has keyboard sounds; her flight, shades and pops have their own (all in the recorded soundtrack too). `?present=record` is the recorder filming it (no controls or subtitles, sound written down, voice timing from the recording). A start card offers Voice (browser speech), Subtitles and Record a video (browser screen capture, downloads a .webm/.mp4). A presenter cursor glides and clicks with ripples, a spotlight dims everything else, the page stage (`#hearth-stage`) zooms in and out, chapter titles slide in, VESTA really answers in Offline mode (asks, `/compare`, `/audit`, opens a test). Every left-menu page is a chapter (tested). Narration holds no typed numbers (`{tests}` comes from `/api/tests`). Pause/Space, restart, chapter dots, CC and voice toggles, Esc exits; the visitor's mission, engine, level, chat and page are restored. Tours, toasts and achievements stay quiet while it plays.
  - Smoothness (pure maths in `lib/presenter/motion.ts`, tested): the cursor glides on a curved, eased path (frame by frame, not CSS), hovers with a glow, presses, ripples and ticks; the spotlight locks onto its target every frame, is kept inside the screen, copies the target's corner radius and only animates when moving to a new target; pages change behind a soft curtain and are shown only once settled; the camera zooms with an in-out curve and a slow drift, never on the VESTA panel; `cue` actions wait for a narration word; subtitles show short phrases.
  - Extras: cinema mode (no real pointer, scrollbars or decorative extras; backdrop and 3D map idle frozen; `html.presenting`), optional cinema bars (the page is fitted between them, never hidden behind them: `.shell-top` / `.shell-side`, `--lb`), fade in from black, a 3-2-1 countdown before recording (not in the video), 720p/1080p at 60 fps, sound effects and an ambient pad made with Web Audio (`components/presenter/audio.ts`, the pad ducks under the voice), a control bar that hides until the mouse moves.
- Launch screen (`components/layout/LaunchScreen.tsx`, rule in `lib/landing.ts`): the hyperspace landing "PROJECT HEARTH · by Team Polaris" covers the home page on a first visit (once per tab). LAUNCH speeds up the tunnel, flashes white and fades to the real dashboard; Skip intro / Esc closes it; `?launch=1` forces it, `?skipintro` or `?present` skips it; the footer can replay it. The first-visit tour waits until it is closed. No data on it; hidden without JavaScript.
- The choice is saved in the zustand store and in localStorage, and sent with every message.
- If the picked engine fails, VESTA falls back down the chain and shows a small note in that message, e.g. "Groq limit reached, answered with Gemini".
- Every VESTA message shows a small badge with the engine that answered (e.g. "via Groq · gpt-oss-120b", "Offline mode"), the model FreeLLMAPI routed to, and the tokens the answer burned.

## VESTA personality
Calm, precise, a little dry humour. Speaks first when it sees a hazard. Three explanation levels: student, researcher, engineer. Never bluffs. Original character; never mention film characters.

## Look and feel
- Dark "mission control". Background #070B14, panel #0D1322, raised #131B2E, lines #1F2A44, text #E8ECF6, muted #97A3BC.
- Accent ember #FF7A2F (soft #FFB98A); in code use the `ember` Tailwind colour or `var(--ember)` / `rgb(var(--ember-rgb) / a)`, never the hex, so VESTA's skins can swap it. ACME #4CC9F0, CFI #A78BFA, SPICE #5EE6A8. Status: ok #5EE6A8, warn #FFC857, bad #FF5D6C.
- Fonts via next/font/google: Chakra Petch (headings), IBM Plex Sans (text), IBM Plex Mono (numbers).
- Layout: sticky top bar (logo, mission chips, status) · left nav · main view · VESTA panel on the right (moves below on small screens). Must work at 400px wide.
- Lively but tasteful: chart entry animations, pulsing mission marker, streaming chat, animated VESTA orb. Respect prefers-reduced-motion. Real buttons and labels, visible focus.

## Commands
- `npm run dev` (local site at http://localhost:3000) · `npm run build` · `npm run lint` · `npm test`
- Data prep: `python3 -m venv .venv && . .venv/bin/activate && pip install -r scripts/ingest/requirements.txt && python scripts/ingest/ingest.py`
- Blueprint: `npm run blueprint` (rebuild once) · `npm run blueprint:watch` (live at http://localhost:4321) · `npm run blueprint:reviewed` (after checking the explanations). `npm run build` rebuilds it automatically.
- Demo video: `npm run demo:record` (builds, then films for about 15 minutes; `npm run demo:record -- --seconds 12 --fps 30` makes a quick preview in `.cache/demo/preview` without touching the site)
- Deploy: push to `main` (auto) or `npx vercel --prod`

## How Claude Code works here
1. Start: run `git pull` (merge, never force), then read `CLAUDE.md` and `PROGRESS.md`. Then read only what the task needs. The build plan is `MASTER_PROMPT.md` (copy in `docs/MASTER_PROMPT.md`).
2. Do only the current phase's goal. No unrelated rewrites.
3. Before finishing a phase: `npm run lint`, `npm test`, `npm run build` must pass. Fix failures.
4. Never edit `Pseudo_DataKeep/`. Never commit `.env.local` or any secret.
5. If a data column is unclear: check the PDFs, write the answer in `docs/DATA_NOTES.md`; still unclear → ask the user.
6. Ask before adding big new dependencies or changing the architecture.
7. When the user must act (log in, approve in a browser), STOP and give short numbered steps, then wait.
8. Keys: add every key that is set in `.env.local` to Vercel (Production and Preview) by piping the value into `npx vercel env add`, never showing it. Exception: `FREELLMAPI_*` stays local (the app runs on the team's PC, which Vercel cannot reach). When the user adds a new key later, do the same and redeploy.
9. Blueprint (`public/blueprint.html`, generated; never edit it by hand): when you add or remove a page, API route, VESTA tool, engine, lib module, shell component or dependency, or change how the pipeline works, update `scripts/blueprint/stories.ts` and run `npm run blueprint`. Never type a number into a story: use `{{factName}}` from `scan.ts`. This applies until the project is finished. When a file in `scripts/blueprint/pipeline-watch.ts` changes, re-read the matching section of `stories.ts`, correct it if the behaviour changed, then run `npm run blueprint:reviewed`; never run that command without checking. New pipeline files go on the watch list. `tests/blueprint.test.ts` fails if any of this is out of step.
10. End of every phase: update `PROGRESS.md` (Done · Decisions · Problems · Next), then `git add -A`, `git commit -m "Phase N: <summary>"`, `git push origin main`, and report the Vercel URL.
