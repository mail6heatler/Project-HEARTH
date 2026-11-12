# HEARTH · Team Polaris

**Fire-safety intelligence for crewed habitats** — NASA Space Apps Challenge 2026.

**Live site: https://project-hearth-five.vercel.app**

HEARTH (Habitat Environment Analysis & Risk Tracking Hub) summarises, ranks and interprets NASA microgravity combustion experiments to give fire-safety insights for crewed habitats: the ISS, a lunar base, pressurized rovers and spacesuits. It is guided by **VESTA** (Virtual Engineer for Space-fire Threat Assessment), an AI crewmate built as a tool-using agent: its tool results change what the dashboard shows.

Every number shown comes from the NASA data or a tested formula, every VESTA claim cites a file and row or page, and every finding carries a confidence tag: `supported`, `extrapolated` or `no_data`.

## The challenge goals
1. **Find the investigations most relevant to crew habitats** → mission ranking with transparent score parts, habitat relevance map.
2. **Extract data for flammability modeling** → one clean table of 889 raw rows (847 test points once 42 flagged duplicate rows are left out of the statistics) with units, sources and raw values; search over the PDFs.
3. **Highlight research for next-generation fire-safety equipment** → Prevention / Detection / Suppression audit, data-gap heatmap, recommended experiments, uses on Earth.

## Features
| Page | What it does |
|---|---|
| **Mission overview** (`/`) | Active mission with envelope status and KPI tiles (O2, pressure, pO2, × ISS, × Earth air, tests nearby); habitat relevance map of every test as a 3D scene with a flat chart switch (O2 vs pressure, ISS pO2 line, Moon base / rover zone, pulsing mission marker, zoom, click for details); investigation ranking with score parts; pinned VESTA charts. |
| **Test explorer** (`/explorer`) | Filter by investigation, fuel phase, O2 range and text; sortable, paged table; charts that follow the filters; details drawer with every field, source row and related PDF passages. |
| **Compare** (`/compare`) | 2–3 investigations: coverage radar (formula on each axis), mean conditions, overlay scatter, shared and unique attributes. |
| **Safety & gaps** (`/safety`) | Six evidence-based rules (oxygen enrichment, untested cabin materials, cool flames, smoke detection, still air & flow control, partial gravity) with documented severity, confidence and sources; O2 × pressure gap heatmap; experiments that would fill each gap; uses on Earth. |
| **My data lab** (`/lab`) | Your own O2 / pressure / airflow / material: pO2, envelope, heuristic hazard index with its parts, nearest 5 tests; CSV upload kept in the browser only; **DEMO** cabin telemetry with a fire drill (clearly simulated). |
| **Dataset** (`/dataset`) | Everything about the data: how it is stored, an interactive split explorer, every field with its fill rate and origin, investigation profiles, distributions, raw row vs clean record, quality flags and limits, a repeatable train/test split builder, downloads (CSV, JSON, dictionary) and NASA references with checksums. |
| **Flame simulator** (`/simulator`) | **DEMO** replays of real tests in microgravity and on Earth. The moving flame is artwork steered by NASA results, not a combustion model; its numbers come from the test rows it cites, and settings with no nearby test show the data gap instead of a flame. |
| **About** (`/about`) | Investigations, hardware, files, reference atmospheres, credits, limits and how VESTA works. |
| **VESTA panel** (every page) | Streaming answers with live tool steps, inline charts (pin to dashboard), source chips, confidence tag, engine badge with tokens per answer, Engine room (pick an engine, see which one is answering, tokens burned, FreeLLMAPI fuel tank), Student / Researcher / Engineer levels, proactive alert when the mission changes. On a computer: drag, resize, expand, dock left or right, or hide VESTA into mini VESTA, whose face follows the confidence tag; poke her for a fact from the data; skins, starfield and a `/warp` easter egg. Answers decode word by word, numbers glow, glossary words explain themselves with a NASA passage; the question box shows what VESTA understood, offers `/` commands and voice input; select any text to ask VESTA about it; achievements. |

## VESTA engine chain
| Engine | Used when | Notes |
|---|---|---|
| 1. Claude | `ANTHROPIC_API_KEY` is set | `@anthropic-ai/sdk`, model `ANTHROPIC_MODEL` |
| 2. ChatGPT (paid) | `OPENAI_API_KEY` is set | `openai` SDK on OpenAI's API, default `gpt-5-mini` |
| 3. FreeLLMAPI (local, free) | `FREELLMAPI_API_KEY` is set | Your own [FreeLLMAPI](https://github.com/tashfeenahmed/freellmapi) desktop app on the same PC (`http://127.0.0.1:31415/v1`), model `auto`. Only when HEARTH runs locally |
| 4. OpenRouter (free) | `OPENROUTER_API_KEY` is set | `openai` SDK on OpenRouter's API, default `nvidia/nemotron-3.5-super-vl:free` |
| 5. Groq (free) | `GROQ_API_KEY` is set | `openai` SDK on Groq's API, default `openai/gpt-oss-120b` |
| 6. Gemini (free) | `GEMINI_API_KEY` is set | `@google/genai`, `GEMINI_MODEL` (e.g. `gemini-flash-latest`) |
| 7. Offline mode | always | Rule-based: intent router + number extraction → same tools → templated answer. No AI, never fails. |

**Auto** tries the engines in order and uses the first that works. VESTA moves to the next engine on a missing key, 401/403, 404 model, 429 limit, 5xx, a 20 s timeout, a model that cannot call tools or invalid tool calls; an engine that just failed is skipped for a minute, and after 40 s VESTA answers with Offline mode so a reply always arrives. A small note says what happened ("Groq limit reached, answered with Gemini"). Raw provider errors are never shown and keys never leave the server.

Every engine uses the same system prompt (`lib/vesta/system-prompt.md`), the same 11 tools (zod schemas converted once with zod-to-json-schema) and the same **grounding check**: every number in an answer must appear in a tool result or the user's message, or VESTA is asked to fix it once and then the answer is flagged "Some figures could not be verified" with confidence lowered.

Tools: `query_data`, `search_docs`, `physics_calc`, `nearest_tests`, `envelope_check`, `compare`, `rank_investigations`, `gap_finder`, `safety_audit`, `make_chart`, `ui_action`.

## Architecture
```
Pseudo_DataKeep/ (raw NASA files, read-only)
   └─ scripts/ingest/ingest.py ─▶ data/processed/ tests.json · chunks.json · pdf_tables.json · ingest_report.md
Next.js 14 App Router (TypeScript strict, Tailwind) on Vercel
   ├─ lib/data.ts · physics.ts · analysis.ts · safety.ts · search.ts (MiniSearch) · missions.ts
   ├─ lib/vesta/ agent.ts (tool loop) · router.ts (engine chain) · offline.ts · grounding.ts · providers/ · tools/
   ├─ app/api/  missions · tests · tests/[id] · map · rank · gaps · compare · search · calc · safety · vesta (SSE) · vesta/engines · vesta/meter · vesta/alert
   └─ app/ pages + components/ (ECharts, three.js 3D map, WebGL flame, zustand)
```
Data decisions (column mapping, unit conversions, the shifted ACME inverse-flame layout, SPICE documented conditions, duplicates) are in [`docs/DATA_NOTES.md`](docs/DATA_NOTES.md); API examples in [`docs/API.md`](docs/API.md).

## Run it
```bash
npm install
cp .env.example .env.local      # every key is optional
npm run dev                     # http://localhost:3000
npm test                        # 145+ vitest tests (providers mocked)
npm run build
```
Data prep (only if the raw data changes):
```bash
python -m venv .venv && . .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r scripts/ingest/requirements.txt
python scripts/ingest/ingest.py
python -I scripts/ingest/describe_sources.py   # file sizes, checksums and pages for /dataset
python -m pytest scripts/ingest
```
Evals: start a local server with `VESTA_EVAL_TOKEN=<16+ random chars>` and run `VESTA_EVAL_TOKEN=<same> npx tsx scripts/run-evals.ts --base http://localhost:3000` → `evals/report*.md`.

### Keys (all optional)
`ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY` and their `*_MODEL` names. An empty value or one containing `PASTE` counts as missing. With no keys at all HEARTH still works fully in Offline mode.

## Data and credits
All experimental data and documents come from NASA's [Physical Sciences Informatics (PSI)](https://psi.nasa.gov) system: **ACME** (CFI-G campaign, Combustion Integrated Rack), **CFI** (Cool Flames Investigation, droplets) and **SPICE** (Smoke Point In Co-flow Experiment, Microgravity Science Glovebox), all run aboard the International Space Station. HEARTH is an independent student project and is not endorsed by NASA.

Limits: all data is microgravity (lunar and Martian gravity are untested), there are no solid-material tests, SPICE oxygen and pressure are documented conditions, and ranking, severity and hazard scores are HEARTH heuristics with published formulas. Safety guidance is worded as evidence, never as official NASA rules. DEMO telemetry is simulated and always labelled.

## Team Polaris
Built for the NASA Space Apps Challenge 2026.
