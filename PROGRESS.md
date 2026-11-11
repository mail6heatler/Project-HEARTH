# HEARTH progress

## Status
- Current phase: 6, in progress (partial commit made; "Phase 6: launch" and tag v1.0 still to come). The user wants a report + "go" after every phase.
- Live URL: https://project-hearth-five.vercel.app
- AI engines with keys: OpenRouter, Groq and Gemini on Vercel (Production + Preview, added after the user's permission). Claude key empty. The current machine's `.env.local` only has OpenRouter, so locally the chain goes OpenRouter → Offline.

## Log

### Stability and docs fixes (2026-11-11, branch `fix/stability-and-docs`)
**Done**
- Offline mode: new `investigation` intent. A question about what one investigation covered ("What oxygen levels were tested in the CFI droplet experiments?") now answers with that investigation's O2, pressure, airflow and fuel ranges from `query_data`, instead of the generic mission assessment. SPICE answers say its O2/pressure are documented conditions and cite the report page via `search_docs`. Airflow leaves out rows that failed the range check, as `/dataset` does. Questions that name a mission still go to `assess`.
- Router: an answer that needed a fallback is no longer cached, so after a short outage the same question reaches the recovered engine instead of replaying the fallback for 10 minutes.
- Fonts are self-hosted with `next/font/local` (`app/fonts/`, latin woff2 from Fontsource 5.3.0, SIL OFL licences included). Builds no longer download from Google Fonts. Three clean `npm run build` runs in a row passed; the built site serves the fonts as `font/woff2` with no Google Fonts reference.
- `scripts/ingest/requirements.txt` pinned to exact versions. With them, `ingest.py` reproduced `data/processed/` exactly (line endings aside) and the 6 pytest tests passed; all 9 raw files match the checksums in `sources.json`.
- CLAUDE.md: the ACME table holds only CFI-G (BRE and E-FIELD are PDF text only); no Mars habitat preset; the font rule now says self-hosted.
- 4 new tests (170 in total). Blueprint cache story updated and marked reviewed.

**Not done (needs the owner)**
- AI-engine evals: need the keys and fresh free limits.
- OpenRouter's 50 requests per day: add credits, or decide to move Groq ahead of it in the chain.
- "Phase 6: launch" commit and v1.0 tag.

### Blueprint link and pipeline watch (at the user's request)
**Done**
- Small "How HEARTH works" link in the site footer, on every page. It opens `/blueprint.html` in a new tab and is not in the side menu.
- `scripts/blueprint/pipeline-watch.ts` fingerprints the key pipeline files. If one changes, the Blueprint shows "explanation under review" and `tests/blueprint.test.ts` fails until someone checks the text and runs `npm run blueprint:reviewed`.

**Decisions**
- The user wants the Blueprint kept up to date for as long as the project is being built. Standing rule in `CLAUDE.md`.
- Fingerprints ignore line endings, so Windows and Vercel agree. Any edit to a watched file flags it, comments included: simple and hard to miss, at the cost of an occasional quick review.
- Flags never block a deploy, because Vercel does not run tests. A flagged item can show on the live page until reviewed.

### HEARTH Blueprint (added at the user's request, during Phase 6)
**Done**
- One self-contained animated page, `public/blueprint.html` (served at `/blueprint.html`, also opens by double-click). It explains the whole system: raw NASA files, cleaning, the split, the JSON "database", every page's data trail, VESTA, the honesty rules, deployment and project history, with Simple and Engineer views. No new dependencies.
- `scripts/blueprint/`: `scan.ts` imports the real modules for facts and traces imports; `stories.ts` holds all the text; `render.ts` and `build.ts` write the file; `watch.ts` serves a live version at localhost:4321; `page.js`, `logic.js`, `style.css` and `template.html` are the page.
- Real recordings at scan time, with no keys and no AI: 7 Offline answers, 81 engine failure mixes through the real router, and a scripted model whose invented number the real grounding check catches.
- Updates itself: `prebuild` runs the scan on every local and Vercel build.
- `tests/blueprint.test.ts` (14 tests) fails on unexplained items, a stale file, hand-typed numbers in stories, broken file links, a browser rule that differs from `lib/physics.ts`, or anything shaped like a key.
- Checked in headless Chrome at 400, 768, 1024 and 1440 px, both views: no sideways overflow, no console errors, all interactions, reduced motion.

**Decisions**
- Plain HTML/CSS/JS with inline SVG, so one file works anywhere. Fonts load without blocking the page.
- The scan can never stop a deploy: `--safe` and `|| exit 0` keep the last good page. Vercel does not run tests, so the Blueprint test cannot block a deploy either.
- Page trails stop at `useVesta`, and importing only a constant from a component does not count as using it, because either would overstate what a page uses. A separate "On every page" trail shows the shell and VESTA.
- No link to the page was added to the site's navigation, so existing pages stay unchanged.

**Problems**
- Test counts on the page are test blocks counted from the source, lower than vitest's total because some blocks run several cases. The page says so.
- This machine still has no Node on PATH; a portable Node 22 in a temp folder was used again (checksum verified).

### Dataset page (added during Phase 6 at the user's request)
**Done**
- New page `/dataset` ("Dataset", right after My data lab; VESTA can open it). No new dependencies.
- Sections: at a glance, data flow and storage, split explorer (10 ways to slice the data), every field with fill rates and origin, three investigation profiles, 9 distributions with statistics tables, raw row vs clean record for any test, quality flags and limits, train/test split builder, downloads, NASA references with checksums.
- `lib/dataset.ts` computes every number; `lib/dataset-docs.ts` holds the explanations; `lib/dataset-split.ts` makes splits and CSV; `/api/dataset/[file]` serves static downloads; `scripts/ingest/describe_sources.py` writes `data/processed/sources.json`.
- 16 new tests (148 in total). Checked in headless Chrome at 400, 1024 and 1440 px, with every row opened, plus reduced motion and all downloads.

**Decisions**
- The page says plainly that this data has no train/test split, because HEARTH trains no model. The split builder is labelled as a helper for other people's modelling.
- The fuel split decides across the whole dataset: propane burned in both ACME and SPICE, so a per-investigation split leaked it (a test caught this).
- No PSI record numbers are shown: they are not in the raw files and could not be confirmed. References use the details printed on each document, plus verified NASA links and a live PSI search.

**Problems**
- Evals could not finish (`evals/report.md`): Offline 12/12. Groq 3 of 5 scored, then 11 questions hit its free limit. Gemini and OpenRouter scored 0 questions, all limit or fallback. A first run of mine used up part of those limits. Run again once the limits reset, spread over more time. Two real Groq failures to look at: q03 returned a different confidence tag, and q12 answered without calling a tool or giving sources.

### Phase 6, part 2 (partial, not the launch commit)
**Done**
- Review: no secrets in git history, no key names in the browser JavaScript. DEMO labels present on the simulator and telemetry.
- Fallback tested for real with all four keys deliberately broken: the chain ended in Offline with a friendly note and no provider text or key in the stream or server log.
- Checked in headless Chrome: 7 pages at 400, 1024 and 1440 px with no sideways overflow and no console errors; tour steps, skip and remember.
- Added `app/error.tsx` and `app/not-found.tsx`. Gemini's 400 API_KEY_INVALID now counts as a rejected key. 3D axis labels stay inside the canvas. README updated (OpenRouter, Flame simulator, 3D map, 889 rows vs 847 test points). 132 tests.

**Decisions**
- Removed the map caption re-added in part 1: the map already explains itself below the scene.
- 847 on the site is correct: 889 rows minus 42 flagged duplicates.

**Problems**
- `next build` fails now and then in the Google Fonts loader (`loader.js:112`), 3 of 9 local builds; a retry passes. Cause not confirmed: 36 samples of Google's font CSS were clean. A failed Vercel build leaves the previous deployment live. Self-hosted fonts would remove the risk but change the `next/font/google` rule, so that needs the user's decision.
- A first eval attempt ran engines in parallel against one server and got 429s from VESTA's one-request-per-visitor rule, and also spent free AI quota. Run one engine per server.
- Gemini was rate-limited during this work.

**Next (rest of Phase 6)**
- Finish the AI-engine evals for `evals/report.md`, tuning the prompt if an engine is under 90%.
- Run the demo on the live site.
- Commit "Phase 6: launch", then tag v1.0.

### Phase 6, part 1 (partial, not the launch commit)
**Done**
- Hardening: per-visitor rate limit on `/api/vesta` and memoised results (`lib/ratelimit.ts`); engine cooldown after a failure and a 40 s AI time budget before Offline (`lib/vesta/router.ts`). 6 new tests in `tests/hardening.test.ts` (130 in total).
- Eval runner `scripts/run-evals.ts` with an eval-only `x-eval-token` / `VESTA_EVAL_TOKEN` mode. `evals/report-offline.md`: Offline 12/12.
- Skippable first-visit tour (`components/ui/Tour.tsx`), `app/icon.svg` replaces the favicon, reference atmospheres table on About.
- `README.md` and `docs/DEMO_SCRIPT.md`.
- Merged this work with upstream's OpenRouter engine, redesign, 3D map and Flame simulator.

**Decisions**
- Kept the redesign wherever it conflicted with this work and re-added the local changes on top.
- The map caption and tour step 2 no longer say "dashed line" / "pulsing diamond", because those only describe the flat chart and the map now opens in 3D.

**Problems**
- One `next build` failed in the Google Fonts loader (`loader.js:112`, null regex match); later builds passed with no code change, including clean ones. Cause not confirmed; looks transient.
- The merged site has not been checked in a browser yet.
- `README.md` still lists the old engine chain (no OpenRouter); `CLAUDE.md` and `.env.example` already include it.
- This machine's `.env.local` has no `OPENROUTER_API_KEY`.

**Next (rest of Phase 6)**
- Run the evals on every AI engine for `evals/report.md` (each must reach ≥ 90%).
- Strict NASA-judge review, including git history and keys reaching the browser.
- Broken-key fallback test; polish at 400, 1024 and 1440 px; update the README; run the demo on the live site.
- Commit "Phase 6: launch", then tag v1.0.

### Flame simulator (between Phase 5 and Phase 6)
**Done**
- New page `/simulator` ("Flame simulator", between My data lab and About; VESTA can open it). No new dependencies: plain WebGL.
- `lib/flame.ts`: real rows → evidence + animation settings, pure and tested. `GET /api/flame` serves compact rows so sliders respond instantly. `components/flame/`: `shader.ts` (flame), `FlameCanvas.tsx`, `FlameLab.tsx` (page).
- Three experiments: ACME spherical flame (fuel, flame type, O2, pressure), CFI droplet (fuel, helium, O2, pressure), SPICE jet (fuel, nozzle, fuel rate, air speed). Microgravity, Earth or side by side.
- ACME replays follow the tests near the settings (same fuel and flame type, ±5 points O2, ±2.5 psi): ignition / flash / failure by majority, median burn time with replay speed, how it ended, cool flames. Colour follows Tad, size follows Zst.
- Fun: Surprise me (random real test), Longest burn, mission buttons, a clickable map of where real tests happened, 5 challenges, Ask VESTA about the closest test.
- 19 new tests (123 in total). Checked in a real browser: all modes, no-data zone, 400 px, reduced motion, no WebGL, no console errors.

**Decisions**
- Labelled DEMO: the moving flame is artwork steered by results, not a combustion model. Every number comes from cited rows. A "How much of this is real?" panel says so.
- No flame where no test exists (rule 5): the page names the gap and the run that would fill it.
- Earth view is an illustration with no numbers and no cool flames: all tests ran in microgravity. No Moon or Mars gravity option: no data.
- CFI's table lists conditions, not results, so its replay has no timer; the sequence comes from CFI_Report p5–p6. SPICE's table does not mark which row reached the smoke point, so soot grows with fuel rate and no threshold is claimed.
- SPICE settings with no airflow value, a failed range check or zero fuel flow are left out.

**Problems**
- Smoothness on a real graphics card is unmeasured (the test browser renders in software). Capped at 30 fps on weak devices and 50 otherwise.

### 3D Habitat relevance map (between Phase 5 and Phase 6)
**Done**
- Added `three` (user approved). About 149 KB compressed, downloaded only when the 3D view is shown.
- `components/map3d/`: `engine.ts` (scene, camera, picking, labels), `backdrop.ts` (procedural Earth, Moon, Sun, stars; no image files), `models.ts` (station, base, rover, spacesuit), `HabitatScene.tsx` (React wrapper). `lib/map3d.ts` holds the scales and shared map helpers.
- Scene: every test is a glowing point with a stem to the floor; a sheet shows every possible pO2; gold level line at the ISS pO2; orange Moon base / rover patch; mission models at their real conditions with clickable labels; camera glides to the active mission.
- Kept from the flat chart: hover details, click opens the test, VESTA highlights, active mission marker, lab rows (yellow triangles, "not NASA"), merged points with the same size rule. "3D scene / Flat chart" switch; the choice is remembered.
- 9 new tests (104 in total). Checked in a real browser with real mouse events: hover, click, mission labels, zoom, reset, flat switch, lab rows, 400 px width, no console errors.

**Decisions**
- Height = pO2 from `pO2()` in lib/physics.ts. Airflow was rejected as the third axis because only SPICE has it, so it could not place ACME or CFI tests.
- Pressure is logarithmic in 3D (linear in the flat chart) so low-pressure habitats do not bunch together; the axis says so.
- Earth, Moon, Sun and the model shapes are artwork and the page says so; only the points, the sheet and each model's position are data.
- The sheet stops at pO2 44 psi, just above the data's maximum (a test checks everything fits). It is not a physical limit.
- Normal scrolling keeps moving the page; Ctrl + scroll or the +/− buttons zoom. On phones a vertical swipe scrolls and a sideways drag turns the scene.
- Falls back to the flat chart with no WebGL (no message) or if the 3D context is lost (with a short note). Visitors who prefer reduced motion start on the flat chart and get no idle movement in 3D.

**Problems**
- Frame rate on a real graphics card is unmeasured: the automated browser here renders in software. Capped at 24 fps on weak devices and 40 fps otherwise.

### Front-end redesign: space, fire and Team Polaris (between Phase 5 and Phase 6)
**Done**
- Backdrop (`components/fx/SpaceBackdrop.tsx`): stars turning slowly around a marked Polaris with the Little Dipper, embers drifting with no "up", a star streak on mission change, an occasional shooting star. Embers speed up while VESTA works.
- Team Polaris: north-star mark and badge in the top bar, hero line, team card in the left rail, site footer, a section on About.
- Overview hero: living spherical flame (labelled artwork, not a simulation), "Run a safety audit" and "Explore the tests" buttons, test count from the API. Mission tiles replay an entrance and light sweep on mission change; O2, pressure and pO2 have meters (pO2 marks the ISS reference).
- `.hud-panel` instrument style on every panel (corner brackets, warm top edge), page fade via `app/template.tsx`, flowing heat line under the top bar.
- VESTA panel: larger orb with state text, starter cards, live tool activity in plain words that folds into "N tools used", "+N more" sources, follow-up questions, Markdown rendering (`parseRichText.ts`: lists, headings, code, tables; rendered as text, never HTML), copy, Stop, Clear chat, "/" to focus, floating "Ask VESTA" button on phones.
- 8 new tests (95 in total). Checked in a real browser at 1500 px and 400 px: every page, no console errors, no sideways scroll, Stop, mission switching, reduced motion (backdrop still, no endless animations).

**Decisions**
- No new dependencies: canvas and CSS only. Frame rate capped at 30 fps (20 on weak devices), fewer particles on weak devices, orb skips drawing off screen, no backdrop blur.
- Decoration encodes no data, so it needs no DEMO label; the flame carries an "artwork" caption and meters use real values on stated scales.
- Follow-up and starter questions are worded so Offline mode understands them (tested) and hold no numbers of their own.

**Problems**
- Found and fixed an old bug: Tailwind colours were `var(--x)`, so all 41 distinct opacity classes (`border-warn/60`, `bg-ember/15`…) silently failed, which is why alerts and pills had white borders. Colours in `tailwind.config.ts` are now hex and must be kept in sync with `app/globals.css`.
- `richtext.ts` and `RichText.tsx` collided on Windows (same name apart from case), so the parser is `parseRichText.ts`.
- OpenRouter's free tier allows 50 requests per day per account, and one VESTA question uses at least 2. The limit was reached during testing; VESTA fell back as designed. All visitors of the live site share it. OpenRouter says adding 10 credits raises it to 1000 per day.
- Not fixed: Offline mode answers "What oxygen levels were tested in the CFI droplet experiments?" with the generic mission assessment instead of CFI's oxygen levels (keyword routing).

**Next**
- Phase 6 (see Status). Its tour and final polish should build on this design.

### OpenRouter engine added (between Phase 5 and Phase 6)
**Done**
- New chain: Claude → OpenRouter → Groq → Gemini → Offline. Engine id `openrouter`, `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, default `nvidia/nemotron-3.5-super-vl:free`.
- `providers/openai-compat.ts`: the logic from `groq.ts` moved into `openAICompatProvider({ id, apiKey, model, baseURL, headers?, extraBody? })`. `groq.ts` is now a thin wrapper (same base URL, reasoning_effort low for gpt-oss only). `providers/openrouter.ts` uses the same helper.
- Registered in engines.ts, provider types + index, `/api/vesta` enum and ModelMenu. Updated `.env.example`, the About page and CLAUDE.md.
- Tests: 87 pass (1 new: OpenRouter answers with its badge; a 429 falls back to Groq with the note). Lint and build pass.
- Live check against `POST /api/vesta` with engine `openrouter`: badge "via OpenRouter · nvidia/nemotron-3.5-super-vl:free", pO2 2.788 psi, source lib/physics.ts, confidence supported, about 3 s.
- `OPENROUTER_API_KEY` added to Vercel (Production + Preview).

**Decisions**
- OpenRouter requests send `reasoning: { effort: "low", exclude: true }`, so Nemotron answers fast and keeps its output budget for the answer and tool calls.
- `OPENROUTER_MODEL` is not set on Vercel; the default in engines.ts applies.

**Problems**
- The first live call failed with kind `server` ("service error") and fell back to Offline. The raw cause was not captured (a 5xx or an empty reply both map to this kind). It did not recur in 4 later full runs or 3 direct calls, so it looks transient.
- Known behaviour, not changed: a fallback answer is cached like any other, so after a brief engine failure the same question keeps getting the fallback answer for up to 10 minutes.
- This machine has no Node.js on PATH. The work used a portable Node 22 from nodejs.org in a temporary folder (checksum verified), not installed on the system. Future sessions here need Node installed or the same workaround. `npm ci` took about 8 minutes.

**Next**
- Phase 6 (see Status).

### Phase 5 done
**Done**
- `lib/safety.ts`: six rules — Prevention: oxygen enrichment, untested cabin materials; Detection: cool flames, smoke & soot; Suppression: still air & flow control, partial gravity. Each runs real queries, returns severity 0–100 with its formula string, confidence from evidence count (≥5 supported, 1–4 extrapolated, 0 no_data), evidence chips with file/row/page and an "Evidence suggests… / Evidence is missing…" guideline. `safety_audit` tool + `GET /api/safety`. 11 vitest tests (one per rule + audit + tool + radar + auto view).
- Compare (`/compare`): pick 2–3 investigations (URL `?inv=`, follows VESTA), coverage radar (max O2, pressure span, flow span, fuel variety, sensor types, mission relevance; raw values + formula per axis in the tooltip; `coverageRadar` in lib/analysis.ts), grouped bars of mean O2 / pressure / airflow ("not recorded" where missing), overlay scatter, "Shared by all" and "Only in X" lists.
- Safety & gaps (`/safety`): finding cards per category with animated severity bar, formula, confidence tag, evidence chips (open the test), guideline; O2 × pressure gap heatmap (count per cell, red "gap", active-mission cell outlined); missing fuel types, gravity levels, recommended experiments; "Uses on Earth" panel with PDF citations (ACME_Report p4, p68; CFI_Report p3; SPICE_Report p2, p7).
- Lab (`/lab`): sliders + number boxes (O2, pressure, airflow), material picker (filters the tests used; solid → no data), live pO2 / ratios / flow regime / envelope / heuristic hazard index with parts, nearest 5 tests, scatter with all tests + nearest 5 + pulsing user point; CSV upload in the browser (`lib/csv.ts`: quotes, comments, column + unit detection, confirm-mapping step, range checks, memory only), rows shown as triangles in the lab and on the overview map; `public/sample_lab_data.csv` labelled as made-up example data; "Ask VESTA to assess".
- DEMO mode (Lab page): simulated O2, pressure, pO2, airflow, smoke, temperature every 1.5 s with sparklines, DEMO hazard gauge, 90-second chart, "Run fire drill" (smoke/temperature up, airflow down, tiles red past DEMO limits, recovery), VESTA DEMO alert and closing message (badge "DEMO · simulated drill · not NASA data"; excluded from VESTA's history), event ticker. DEMO badge on every tile and panel.
- About (`/about`): investigations + hardware, what each file holds, NASA PSI credit and links, limits, how VESTA works (engine chain + Offline mode).
- VESTA moves the dashboard after compare / safety_audit / gap_finder in every engine (`withAutoView` in agent.ts; Offline uses safety_audit for safety questions). System prompt mentions safety_audit. 4 more eval questions (16 total). CSV tests. 86 vitest tests in total.

**Decisions**
- Severity values are HEARTH heuristics shown with their formulas; the audit's overall confidence is the condition's envelope confidence, lowered to extrapolated when any finding lacks data.
- Cool-flame severity requires both O2 (±5 pp) and pressure (±2.5 psi) closeness to the recorded cool-flame tests (all at 29.4 psi), so the rover gets "extrapolated", not "supported".
- DEMO lives on the Lab page (the nav has six fixed items).

**Problems**
- Gemini still overloaded during testing (falls back).

**Next**
- Phase 6: eval runner, NASA-judge review, hardening, polish + tour, README + demo script, v1.0 tag.

### Phase 4 done
**Done**
- GEMINI_MODEL changed to `gemini-flash-latest` (user's choice) in `.env.local` and on Vercel (Production + Preview). Gemini 3 models now run with low thinking level.
- Overview (`/`): mission header with envelope pill and count-up KPI tiles (O2, pressure, pO2, × ISS, × Earth air, tests in envelope; numbers from `POST /api/calc`); habitat relevance map (`components/charts/HabitatMap.tsx`): ECharts scatter of all 847 countable tests, x = pressure, y = O2, colour per investigation, identical conditions merged (size = count), dashed constant-pO2 curve O2 = 100 × 3.087 / P, shaded Moon base / rover zone (30–34% O2, 8.2–10.2 psi), ISS / Moon base / Spacesuit diamonds, pulsing active-mission marker, wheel zoom, rich tooltips, click → details drawer, VESTA-highlighted tests glow (with "clear"), "not plotted" list; ranking bars (`RankBars.tsx`) with stacked score parts and reasons on hover; investigation key; pinned VESTA charts.
- Explorer (`/explorer`): investigation toggles, fuel-phase select (solid → explains the data gap), O2 range sliders, debounced search, sortable paged table (duplicates hidden, failed range checks in amber, keyboard accessible rows), tests-per-campaign bars and O2 histogram that follow the filters.
- Details drawer: every field, pO2 + ratio, flow regime, key metric with units, source file + row, flags, sensors & measurements, all raw recorded values, notes, related PDF passages, "Ask VESTA about this test", Esc / backdrop close, focus moves into the drawer.
- Motion: fade-up entries, slide-in drawer, count-ups, pulsing mission marker and highlight ripples, chart entry animation; all off under prefers-reduced-motion. `EChart` wrapper now resizes with its box (ResizeObserver).
- Checked at 400 px (iframe), 1024 px and 1440 px.

**Decisions**
- Map merges tests at identical O2/pressure into one point (SPICE's 435 rows share the documented 21% / 14.65 psi) instead of jittering real data.
- Pressure axis is linear 0–80 psi (all data and missions fit).

**Problems**
- Gemini (`gemini-flash-latest`) still returned 503 / timeouts during testing (Google capacity); VESTA falls back to Groq / Offline.
- Headless Edge screenshots at exactly 1024 px catch charts before their resize; real browsers resize via ResizeObserver (verified canvas widths at 1100 and 1440 px).

**Next**
- Phase 5: Compare, safety rules + safety_audit, Safety & gaps page, Lab, DEMO mode, About.

### Phase 3 done
**Done**
- `lib/vesta/system-prompt.md` (model-agnostic: personality, 8 rules, 3 levels, reference atmospheres, tool guidance) + `prompt.ts` (adds active mission + level).
- Tools: Phase 2 tools + `make_chart` (zod spec → server-built plain-JSON ECharts option; line/bar/scatter/radar/heatmap; ≤2000 points; every chart value must match an earlier tool result) + `ui_action` (go_view, set_mission, highlight_tests, open_test; ids and missions validated). Zod schemas converted once with zod-to-json-schema (`tools/schemas.ts`).
- Providers behind one interface (`providers/types.ts`): `anthropic.ts` (@anthropic-ai/sdk, beta messages with `fallbacks: "default"` refusal fallback, effort medium, thinking blocks kept in history), `groq.ts` (openai SDK, Groq base URL, gpt-oss reasoning_effort low), `gemini.ts` (@google/genai function calling with JSON schema).
- `agent.ts`: provider-agnostic tool loop (max 6 tool rounds, 20 s per call, 3 invalid calls → engine error), confidence = model tag capped by tool evidence. `grounding.ts`: numbers must match tool results / user message (rounding and % ↔ fraction allowed; ids, formulas, page/row refs ignored); one fix request, then "Some figures could not be verified." + extrapolated.
- `offline.ts`: intent router (help, explain test, compare, gaps, rank, safety, assess, explain topic) + number/unit/test-id/mission extraction → same tools → templated answers; moves the dashboard (compare → /compare, gaps/safety → /safety, rank → overview, highlight/open tests).
- `router.ts`: Auto = Claude → Groq → Gemini → Offline; a chosen engine first, then the chain. Fallback on missing key, 401/403, 404 model, 429, 5xx, timeout, tool-incapable model, invalid tool calls, refusal. Logs only the error kind. 10-minute cache. Fallback note ("Groq limit reached, answered with Offline mode").
- API: `GET /api/vesta/engines` ({id,label,available} only), `POST /api/vesta` (SSE: engine, step, text, chart, ui, sources, confidence, done, error; Node runtime, maxDuration 60, message ≤ 2000 chars, one request per visitor), `POST /api/vesta/alert` (proactive alert, no AI).
- Dashboard shell: sticky top bar (logo, mission chips, data status), left nav, zustand store, VESTA panel (canvas orb, Online/Thinking, model menu with "no key" options disabled, Student/Researcher/Engineer, live tool steps, streamed text, engine badge, fallback note, inline charts with "Pin to dashboard", source chips, confidence tag, quick prompts), test details drawer, mission header with KPI tiles, pinned-charts strip, proactive alert on mission change. Preferences in localStorage (wrapped in try/catch). Checked at 1440 px and 400 px.
- 72 vitest tests (36 new: tool loop, event order, 6-round cap, make_chart/ui_action validation, grounding, every fallback case, cache, engines endpoint never leaks keys, every Offline intent with a grounding self-check). `evals/questions.yaml` with 12 questions. `scripts/probe-vesta.ts` dev probe (never prints keys).

**Decisions**
- Provider calls are not token-streamed: the full answer must pass the grounding check before the user sees any number, then it is streamed to the browser in small chunks.
- Groq gpt-oss runs with low reasoning effort and 1500 output tokens to fit the free tier.

**Problems**
- Gemini: `gemini-2.5-flash` returns 404 "no longer available to new users" for this key, so Gemini always falls back. Newer models (`gemini-3.5-flash`, `gemini-3.8-flash`) exist for this key but were overloaded (503 "high demand") during testing. Needs the user's choice of GEMINI_MODEL.
- Groq free tier: about 1–2 tool-using questions per minute before 429; the chain then answers with Offline mode.
- Python heredoc edits silently failed once on an escaped `\n`; switched to the Edit tool for such changes.

**Next**
- Phase 4: overview map, ranking bars, explorer table + charts, full details drawer, motion.

### Phase 2 done
**Done**
- `scripts/ingest/ingest.py`: one adapter per investigation → `data/processed/tests.json` (889 tests: ACME 333, CFI 87, SPICE 469), `chunks.json` (1066 page-aware chunks, ~800 chars / 100 overlap), `pdf_tables.json` (94 tables), `ingest_report.md`. Range checks: 8 SPICE rows with negative airflow kept and flagged. Duplicates flagged: CFI 8, SPICE 34. 6 pytest tests (`python -m pytest scripts/ingest`, run from the repo root).
- `lib/types.ts` (zod schemas), `lib/data.ts` (load once, filter/sort/stats/sources), `lib/util.ts` (pure helpers, safe for the browser), `lib/missions.ts` (ISS, Moon base, Lunar rover demo, Spacesuit), `lib/physics.ts` (pO2, ratio to ISS, O2 vs Earth, flow regime, unit conversion, envelope check, nearest tests, heuristic hazard index with parts), `lib/bins.ts`, `lib/analysis.ts` (compare, rank, gaps), `lib/search.ts` (MiniSearch).
- VESTA data tools in `lib/vesta/tools/`: query_data, search_docs, physics_calc, nearest_tests, envelope_check, compare, rank_investigations, gap_finder. Zod inputs, `runTool` validates and never throws, every result has sources and a confidence tag.
- API: missions, tests, tests/[id], map, rank, gaps, compare, search, calc (POST). `docs/API.md` with real example responses.
- 36 vitest tests (physics hand calculations: 34% at 8.2 psi = 2.788 psi, ISS = 3.087 psi, ratio 0.903).

**Decisions**
- Defaults for Q2 (SPICE 21% / 101 kPa from Report p20) and Q3 (duplicates flagged, not counted) adopted; Q1 flow columns stay in `extra` only.
- Envelope window ±5 percentage points O2 and ±2.5 psi; nearest-test distance is normalised so 1.0 = envelope edge.
- Ranking score = proximity 40 + O2 coverage 20 + pressure coverage 20 + tests-in-envelope 20 (constants in `lib/analysis.ts`). Hazard index = O2 concentration 40 + pO2 20 + airflow 20 + data coverage 20, labelled "heuristic".
- No Mars mission: no sourced values.
- `tsconfig` target set to ES2020.

**Findings worth knowing**
- Lunar rover (34% / 8.2 psi): supported, 28 ACME CFI-G tests inside the envelope (all gaseous spherical flames, no materials). Moon base: supported (6). Spacesuit: no_data. ISS: supported (518).
- Gaps: no solid fuels, only microgravity, spacesuit cell empty, 13 empty cells in the 21–50% O2 / < 14 psi exploration region.

**Problems**
- Bash heredocs with long TS content failed to parse in this shell; files were written with the editor tool instead.
- Running pytest from inside `scripts/ingest/` breaks because `inspect.py` shadows the stdlib; run it from the repo root.

**Next**
- Phase 3: VESTA system prompt, make_chart + ui_action, the three providers, agent loop, grounding, Offline mode, engine router, `/api/vesta*`, dashboard shell with the model menu.

### Phase 1 done
**Done**
- Git: initialised the folder, origin = github.com/mail6heatler/Project-HEARTH, checked out `main`. The remote had only `Pseudo_DataKeep/` and `test.txt` (no README, CLAUDE.md or PROGRESS.md), so nothing local was overwritten.
- All 9 raw files present (ACME, CFI, SPICE × Engineering_Doc.pdf, Experimental_Table.csv, Report.pdf).
- Next.js 14.2 (App Router, TS strict, Tailwind, ESLint) scaffolded in a temp folder and moved to the repo root. Installed echarts, echarts-for-react, zustand, minisearch, zod 3, zod-to-json-schema, @anthropic-ai/sdk, openai, @google/genai, vitest, tsx, yaml.
- Theme colours + Chakra Petch / IBM Plex Sans / IBM Plex Mono as CSS variables and Tailwind tokens. HEARTH welcome page with the inline SVG flame-in-ring logo.
- `.env.example`, `.gitignore`, `vitest.config.ts`, `npm test`.
- `scripts/ingest/inspect.py` (+ requirements.txt) → `docs/inspect_output.md`. `docs/DATA_NOTES.md` with the full column mapping and open questions.
- Vercel: linked to the existing `project-hearth` (Git already connected to this repo, production branch `main`). Fixed framework preset Other → Next.js, Node 26.x → 22.x.

**Decisions**
- The ACME table is the CFI-G campaign only (normal + inverse spherical diffusion flames). Inverse rows are shifted one column; the adapter will read them with their real layout (DATA_NOTES.md).
- SPICE O2/pressure come from SPICE_Report p20 (21% O2, 101 kPa) and are flagged `conditions_from_doc`.
- `inspect.py` must be run with `python -I` because its required name shadows the stdlib `inspect` module.
- Extra `flags: string[]` field on each test for data-quality marks.

**Problems**
- Adding keys to Vercel (`vercel env add`) was blocked by the Claude Code permission classifier. The user must allow it or run it by hand.
- `vercel link` appended a `VERCEL_OIDC_TOKEN` line to `.env.local` (git-ignored, harmless).
- `.env.local` line 2 has `ANTHROPIC_MODEL=claude-sonnet-5-5# VESTA AI keys...` (missing newline). The app trims model names at `#`/whitespace.

**Next**
- Phase 2: ingest.py adapters, processed data, lib/ data + physics, tools, API routes.
