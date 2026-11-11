/**
 * Everything the Blueprint SAYS, in plain words. The scanner (scan.ts) finds what EXISTS.
 *
 * - Each story has two versions: s = simple, e = engineer.
 * - Never type a number here. Write {{factName}} and the scanner fills it in from the code, so the
 *   text cannot go out of date. (tests/blueprint.test.ts enforces this. O2, pO2, 3D and `code` are fine.)
 * - When you add a page, API route, tool, engine, lib module, shell component or dependency, add its
 *   story here. Until you do, the page marks it "new, not explained yet" and the test fails.
 *
 * Mini format: **bold** and `code`.
 */
export interface Story {
  s: string;
  e: string;
}

const same = (t: string): Story => ({ s: t, e: t });

export const RAW_CLEAN: Record<string, { raw: string; clean: string; how: string }[]> = {
  ACME: [
    { raw: "Fuel", clean: "fuel", how: "tidied name" },
    { raw: "XO2 before test", clean: "o2_pct", how: "fraction → percent" },
    { raw: "approx p (bar)", clean: "pressure_psi", how: "bar → psi × {{barToPsi}}" },
    { raw: "burn time (sec)", clean: "key_metric_value", how: "kept, named burn_time_s" },
    { raw: "Hot ignition", clean: "outcome", how: "joined into a sentence" },
  ],
  CFI: [
    { raw: "Flex Number", clean: "test_id", how: "becomes a stable ID" },
    { raw: "Fuel", clean: "fuel", how: "formula → fuel name" },
    { raw: "Oxygen", clean: "o2_pct", how: "fraction → percent" },
    { raw: "Pressure", clean: "pressure_psi", how: "atm → psi × {{atmToPsi}}" },
  ],
  SPICE: [
    { raw: "Fuel", clean: "fuel", how: "tidied name" },
    { raw: "Nozzle (mm)", clean: "size_mm", how: "kept" },
    { raw: "Air Rate (cm/s)", clean: "flow_cm_s", how: "kept" },
    { raw: "HC Fuel Rate (mg/s)", clean: "key_metric_value", how: "kept, named hc_fuel_rate_mg_s" },
  ],
};

export const STORIES = {
  hero: {
    eyebrow: "Team Polaris · The working blueprint",
    title: "How HEARTH works",
    lead: {
      s: "Follow one idea all the way through: real NASA fire experiments go in one end, and a crewmate who can back up every number comes out the other. Click anything. Nothing here is a mock-up.",
      e: "An end-to-end map of the system, generated from the repository: data ingest, static data layer, API routes, the VESTA agent and deployment. Facts and recordings are produced by running the real modules at scan time.",
    } as Story,
    stats: [
      { fact: "testsCounted", label: "NASA tests" },
      { fact: "chunks", label: "PDF passages" },
      { fact: "pageCount", label: "Pages" },
      { fact: "routeCount", label: "API routes" },
      { fact: "toolCount", label: "VESTA tools" },
      { fact: "engineCount", label: "AI + backup engines" },
      { fact: "testBlocks", label: "Test blocks" },
    ],
  },

  sections: {
    map: {
      nav: "The machine",
      eyebrow: "Start here",
      title: "The whole machine on one screen",
      intro: same("The moving dots are data on its way to you. Click any box to see what it does and which files do the work."),
    },
    journey: {
      nav: "Data journey",
      eyebrow: "Step one · From NASA to clean data",
      title: "Messy files in, trustworthy records out",
      intro: {
        s: "NASA's files were written by scientists, for scientists. Different units, odd columns, a few repeated rows. A cleaning script turns them into one tidy format and never forgets where each value came from.",
        e: "`scripts/ingest/ingest.py` is an offline, one-shot job with one adapter per investigation. It writes committed JSON under `data/processed/`. Vercel never runs Python; every field mapping is recorded in `docs/DATA_NOTES.md`.",
      } as Story,
    },
    storage: {
      nav: "The “database”",
      eyebrow: "Step two · Where the data lives",
      title: "The database that isn't a database",
      intro: {
        s: "There's no database server to crash or pay for. The clean data is plain files shipped with the website, loaded into memory the first time they're needed. Fast, simple, and every change is visible in the project's history.",
        e: "JSON is imported at build time and bundled with the server functions. `lib/data.ts` validates it once with zod and caches it per instance; `lib/search.ts` builds a MiniSearch index lazily. The data is read-only at runtime, so there is no write path to protect.",
      } as Story,
    },
    features: {
      nav: "Every feature",
      eyebrow: "Step three · What you see",
      title: "Pick a page. Watch where its data comes from.",
      intro: {
        s: "Every page follows the same trail: the page asks an API route, the route asks a “brain” in the code, and the brain reads the clean data. These trails are traced from the real code.",
        e: "Edges come from walking the import graph from each `page.tsx` and `route.ts`, plus `/api/...` strings found in reached files. `import type` is ignored because it is erased at build time. A solid line is a call to the server; a dashed line is a module the page uses directly, with no API call. Importing only a constant from a component does not count as using it.",
      } as Story,
    },
    vesta: {
      nav: "How VESTA answers",
      eyebrow: "Step four · The crewmate",
      title: "How VESTA answers a question",
      intro: {
        s: "VESTA isn't allowed to answer from memory. It has to use tools that read the NASA data, and a checker reads its answer before you do. Pick a question and watch a real answer being built.",
        e: "A provider-agnostic tool loop runs behind a fallback router. Every engine shares one system prompt, one zod-defined tool set and one grounding check, and emits the same SSE events.",
      } as Story,
    },
    honesty: {
      nav: "Honesty rules",
      eyebrow: "The promises",
      title: "Rules the code enforces",
      intro: same("HEARTH makes promises about fire safety, so they can't just be good intentions. Each promise below points to the code that keeps it and the test that checks it."),
    },
    ship: {
      nav: "Going live",
      eyebrow: "Step five · Reaching the world",
      title: "From a code change to the live site",
      intro: {
        s: "One push to GitHub and the site rebuilds itself. If anything goes wrong, the previous version simply stays online.",
        e: "Vercel deploys `main` through its Git integration. Route handlers run as Node functions, static assets go to the CDN, and keys exist only in server-side environment variables.",
      } as Story,
    },
    growth: {
      nav: "How it grew",
      eyebrow: "The living part",
      title: "This page keeps itself up to date",
      intro: {
        s: "Nobody has to remember to update this page. A scanner re-reads the project on every build, so new pages, tools and numbers appear here by themselves, and anything it can't explain gets flagged.",
        e: "`scripts/blueprint/scan.ts` imports the real modules and produces a manifest, which `render.ts` embeds into one self-contained HTML file. It runs as an npm `prebuild` step and can never fail a deploy. `pipeline-watch.ts` fingerprints the key files so that a logic change flags its explanation for review.",
      } as Story,
    },
  },

  mapNodes: {
    nasa: {
      label: "NASA data keep",
      sub: "{{rawFiles}} raw files",
      jump: "journey",
      story: {
        s: "The starting point: real tables and reports from three NASA experiments on the Space Station. We only ever read these files. We never change them.",
        e: "`Pseudo_DataKeep/{ACME,CFI,SPICE}/`: {{rawCsv}} CSV tables and {{rawPdf}} PDFs ({{pdfPages}} pages). Read-only and committed to git. Checksums live in `sources.json`.",
      } as Story,
      files: ["Pseudo_DataKeep", "docs/DATA_NOTES.md"],
    },
    ingest: {
      label: "The cleaner",
      sub: "ingest.py",
      jump: "journey",
      story: {
        s: "A Python script that reads the messy files, fixes the units, spots repeated rows and cuts the PDFs into small searchable passages. It only runs when the raw data changes.",
        e: "pandas for tables, pymupdf for page text, pdfplumber for tables. One adapter per investigation, then duplicate marking and range checks. Output is committed, so deploys need no Python.",
      } as Story,
      files: ["scripts/ingest/ingest.py", "scripts/ingest/describe_sources.py", "scripts/ingest/tests/test_ingest.py"],
    },
    clean: {
      label: "Clean files",
      sub: "{{testsTotal}} rows · {{chunks}} passages",
      jump: "storage",
      story: {
        s: "The tidy result, and HEARTH's “database”. Plain files that travel with the website, so there's no server that can go down.",
        e: "`data/processed/`: tests, chunks, PDF tables, source checksums and the ingest report. Every test record carries `source_file` and `source_row`.",
      } as Story,
      files: ["data/processed/tests.json", "data/processed/chunks.json", "data/processed/pdf_tables.json", "data/processed/ingest_report.md"],
    },
    brains: {
      label: "The brains",
      sub: "{{libCount}} lib modules",
      jump: "features",
      story: {
        s: "Where the thinking happens: tested formulas, rankings, safety rules and search. Nothing is guessed here. It's all maths and lookups on real data.",
        e: "Pure TypeScript modules under `lib/`: the data layer, physics, analysis, safety rules, search and flame evidence. API routes and VESTA's tools share them, so both always agree.",
      } as Story,
      files: ["lib/data.ts", "lib/physics.ts", "lib/analysis.ts", "lib/safety.ts", "lib/search.ts"],
    },
    api: {
      label: "API routes",
      sub: "{{routeCount}} doors",
      jump: "features",
      story: {
        s: "The doors between the website and the brains. A page knocks, asks for something specific, and gets back just that.",
        e: "Next.js Route Handlers on the Node runtime. GET responses are cached at the edge for {{apiCacheMin}} minutes. `docs/API.md` documents the contract.",
      } as Story,
      files: ["app/api", "docs/API.md", "lib/api.ts"],
    },
    pages: {
      label: "Dashboard",
      sub: "{{pageCount}} pages",
      jump: "features",
      story: {
        s: "What you actually see: maps, tables, comparisons and the flame simulator. Choosing a mission here changes the whole dashboard, and VESTA too.",
        e: "Next.js App Router pages with shared client state in zustand (`lib/store.ts`). ECharts for charts, three.js loaded on demand for the 3D map, WebGL for the flame.",
      } as Story,
      files: ["app", "components", "lib/store.ts"],
    },
    you: {
      label: "You",
      sub: "student → engineer",
      jump: "vesta",
      story: {
        s: "Students, professors and engineers. Ask VESTA in plain words, and pick how technical the answer should be.",
        e: "Three explanation levels (student, researcher, engineer) are sent with each message and change the system prompt. Preferences persist in localStorage.",
      } as Story,
      files: ["components/vesta/VestaPanel.tsx", "components/vesta/useVesta.ts"],
    },
    tools: {
      label: "VESTA's tools",
      sub: "{{toolCount}} tools",
      jump: "vesta",
      story: {
        s: "VESTA's hands. Each tool does one job, like checking conditions or finding gaps. The tools use the same brains as the rest of the site, so VESTA and the dashboard always agree.",
        e: "One file per tool in `lib/vesta/tools/`. Schemas are written once in zod and converted for each provider. `runTool` validates the arguments and never throws.",
      } as Story,
      files: ["lib/vesta/tools/index.ts", "lib/vesta/tools/schemas.ts"],
    },
    vesta: {
      label: "VESTA",
      sub: "AI crewmate",
      jump: "vesta",
      story: {
        s: "The crewmate who explains it all. VESTA can also move the dashboard around for you, and it speaks first when it spots a hazard.",
        e: "`lib/vesta/agent.ts` runs the tool loop (at most {{maxToolRounds}} rounds) and `grounding.ts` verifies the numbers. Results stream as Server-Sent Events from `/api/vesta`.",
      } as Story,
      files: ["lib/vesta/agent.ts", "lib/vesta/grounding.ts", "lib/vesta/system-prompt.md", "app/api/vesta/route.ts"],
    },
    engines: {
      label: "Backup chain",
      sub: "{{aiEngineCount}} AI + Offline",
      jump: "chain",
      story: {
        s: "If one AI service is busy or down, VESTA quietly moves to the next. The last in line needs no AI at all, so VESTA always has an answer.",
        e: "`lib/vesta/router.ts` walks the chain on a missing key, auth errors, rate limits, server errors, timeouts or bad tool output, and failed engines cool down. Offline is rule-based and needs no network.",
      } as Story,
      files: ["lib/vesta/router.ts", "lib/vesta/engines.ts", "lib/vesta/offline.ts", "lib/vesta/providers"],
    },
    repo: {
      label: "GitHub",
      sub: "branch main",
      jump: "ship",
      story: {
        s: "The project's home. The code and the clean data live here together, with a full history of every change.",
        e: "Code, raw data and processed data are all versioned together. Pushing to `main` triggers a production deployment.",
      } as Story,
      files: ["CLAUDE.md", "PROGRESS.md"],
    },
    vercel: {
      label: "Vercel",
      sub: "builds + hosts",
      jump: "ship",
      story: {
        s: "Takes the code from GitHub, builds the site and puts it online. It also keeps the secret keys safe, away from your browser.",
        e: "`npm run build` runs the blueprint scan, then `next build`. API routes become Node functions with a {{functionMaxS}} second limit on `/api/vesta`. A failed build leaves the previous deployment live.",
      } as Story,
      files: ["next.config.mjs", "package.json"],
    },
  },

  investigations: {
    ACME: { title: "Gas flames", story: same("Flames fed by gaseous fuel, burning as glowing spheres in microgravity. This set spans the widest range of oxygen and pressure, which makes it the closest match for future habitats.") },
    CFI: { title: "Burning droplets", story: same("Single fuel droplets burning in mid-air, including strange “cool flames” that keep going at far lower temperatures than an ordinary flame.") },
    SPICE: { title: "Smoke points", story: same("Small jet flames in a gentle stream of air, measuring when a flame starts to make smoke. Smoke is what fire detectors look for.") },
  } as Record<string, { title: string; story: Story }>,

  ingestSteps: [
    { id: "read", label: "Read", story: { s: "Open each NASA table and remember its exact row number.", e: "`read_csv` loads each table and stores the spreadsheet row in `__row`, so every record can cite its source." } },
    { id: "adapt", label: "Translate", story: { s: "Each experiment has its own layout, so each gets its own translator into one shared format.", e: "`adapt_acme`, `adapt_cfi` and `adapt_spice` map to one record model. ACME inverse-flame rows use a shifted column layout and get the flag `layout_shifted`." } },
    { id: "units", label: "Fix units", story: { s: "NASA used bar, atm, kPa and fractions. Everything becomes psi and percent, so values can be compared fairly.", e: "bar × {{barToPsi}}, atm × {{atmToPsi}}, kPa × {{kpaToPsi}}, fraction × `100`. The original units are recorded in `DATA_NOTES.md`." } },
    { id: "unknown", label: "Never guess", story: { s: "If a value is missing, it stays empty. No filling in, no best guesses.", e: "`num()` maps blanks, dashes and text to `null`. SPICE O2 and pressure come from its report, not per-row data, and carry the flag `conditions_from_doc`." } },
    { id: "flag", label: "Flag problems", story: { s: "Repeated rows are marked so they never count twice, and impossible values are reported. Nothing is silently deleted.", e: "`mark_duplicates` flagged {{duplicates}} rows, excluded from statistics by `isCountable`. `run_checks` found {{rangeFails}} range failures, all listed in `ingest_report.md`." } },
    { id: "chunk", label: "Slice PDFs", story: { s: "Long reports are cut into short passages so VESTA can find the right paragraph and cite its page.", e: "Page-aware chunks of about {{chunkSize}} characters with {{chunkOverlap}} overlap, cut at sentence ends where possible. pdfplumber extracts tables separately." } },
    { id: "write", label: "Save", story: { s: "The clean files are saved and committed with the code, along with a report card of the run.", e: "Writes `tests.json`, `chunks.json`, `pdf_tables.json` and `ingest_report.md`. `describe_sources.py` adds `sources.json` with checksums." } },
  ] as { id: string; label: string; story: Story }[],

  split: {
    title: "The split: one pile becomes three",
    story: {
      s: "Different kinds of information need different handling, so the raw files split into three clean collections, each with its own job.",
      e: "CSV rows become structured records for filtering and statistics. PDF prose becomes passages for full-text search. PDF tables are stored separately with file and page.",
    } as Story,
    lanes: [
      { key: "rows", file: "tests.json", title: "Test records", from: "from the CSV tables", use: "Filters, charts, rankings, safety rules" },
      { key: "chunks", file: "chunks.json", title: "PDF passages", from: "from the PDF text", use: "VESTA's search_docs, the test details drawer" },
      { key: "tables", file: "pdf_tables.json", title: "PDF tables", from: "from tables inside the PDFs", use: "Downloads and the Dataset page" },
    ],
    equation: same("Why two totals? NASA's tables hold {{testsTotal}} rows, but {{duplicates}} are exact repeats. They stay visible and flagged, but only {{testsCounted}} are ever counted."),
  },

  rawClean: {
    title: "Watch one real row get cleaned",
    story: same("This is an actual row from the NASA table next to the record HEARTH keeps. Pick an experiment and press the button."),
  },

  chunkDemo: {
    title: "How a PDF gets sliced",
    story: {
      s: "Neighbouring passages share a little text, so a sentence is never lost at a cut. These are two real passages. The orange text is the part they share.",
      e: "Two consecutive chunks from `chunks.json`. The shared span comes from the {{chunkOverlap}} character overlap in `chunk_page`, adjusted by the cut at a sentence or line end.",
    } as Story,
  },

  storageSteps: [
    { title: "Shipped with the site", story: { s: "The clean files travel inside the website's own code.", e: "Static JSON imports in `lib/data.ts`, bundled into the server functions." } },
    { title: "Checked once", story: { s: "On first use, every record is checked for the right shape.", e: "`z.array(TestRecordSchema).parse()` runs once per instance and fails loudly if the data is malformed." } },
    { title: "Kept in memory", story: { s: "After that, the data sits in memory and answers instantly.", e: "Module-level arrays and a `Map` by test ID. Pure computations are memoised with `memo()` in `lib/ratelimit.ts`." } },
    { title: "Searched by word", story: { s: "PDF passages get an index, like the one at the back of a book.", e: "MiniSearch inverted index with prefix and fuzzy matching, built lazily on first search." } },
  ] as { title: string; story: Story }[],

  envelope: {
    title: "Try it: has anyone tested this?",
    story: {
      s: "Slide the oxygen and pressure. The box shows which NASA tests are close enough to count as evidence. This is the same rule VESTA follows, running on the same data.",
      e: "A browser copy of `envelopeCheck` from `lib/physics.ts`, run over the embedded counted tests. `tests/blueprint.test.ts` checks that it matches the real function.",
    } as Story,
    rule: same("At least {{envMin}} tests within ±{{envO2}} points of O2 and ±{{envP}} psi is **supported**. Between one and {{envSparseMax}} is **sparse**. None is **no data**, and VESTA won't predict there."),
  },

  pages: {
    "/": { story: { s: "Home base. Choose a mission and see how close NASA's tests come to it on the map, in 3D or flat, and which experiment matters most.", e: "`HabitatMap` plots `/api/map`, with a lazy three.js scene and flat ECharts fallback. `RankBars` reads `/api/rank`. `MissionHeader` posts to `/api/calc`." }, try: "Switch the mission and watch VESTA speak first." },
    "/explorer": { story: { s: "Every NASA test in one searchable table. Open any row to see its details and exactly where it came from.", e: "Server-side filter, sort and paging through `/api/tests`. `TestDrawer` loads `/api/tests/[id]` with derived values and related PDF passages." }, try: "Filter by fuel, then open a row." },
    "/compare": { story: { s: "Put experiments side by side: what they share, how they differ, and how much of the habitat range each one covers.", e: "`/api/compare` returns shared and unique attributes, condition stats and the coverage radar. `/api/map` supplies the overlay." }, try: "Pick two experiments and read the radar." },
    "/safety": { story: { s: "What the evidence suggests for prevention, detection and suppression, plus the conditions nobody has tested yet.", e: "`lib/safety.ts` rules run real queries and return severity, confidence and sources. `findGaps` builds the O2 × pressure coverage grid. Severity is a HEARTH heuristic, not a NASA rating." }, try: "Find the empty cells in the gap grid." },
    "/lab": { story: { s: "Enter your own conditions or upload your own data and compare it with NASA's. Your file stays in your browser, and the live telemetry is clearly marked as a demo.", e: "`lib/csv.ts` parses and maps uploads client-side into memory only, never mixed with NASA rows. `/api/calc` returns pO2, the envelope, a heuristic hazard index and nearest tests. `DemoTelemetry` is labelled DEMO." }, try: "Upload the sample CSV." },
    "/dataset": { story: { s: "The full story of the data: where it came from, how it's organised, its limits, and how to download it.", e: "A server component using `lib/dataset.ts` for computed statistics. `/api/dataset/[file]` serves force-static exports, and `lib/dataset-split.ts` builds leak-safe train/test splits for other people's modelling." }, try: "Compare a raw row with its clean record." },
    "/simulator": { story: { s: "Change the oxygen, pressure and fuel, then press Ignite. The result follows real NASA tests near your settings. The moving flame itself is artwork, and it's labelled DEMO.", e: "`/api/flame` serves compact rows so sliders respond instantly, and `lib/flame.ts` turns them into evidence and animation settings. Plain WebGL shader, not a combustion model." }, try: "Try Surprise me, then compare with Earth." },
    "every page": { story: { s: "These parts surround every page: the top bar, the navigation and VESTA's panel. That's why VESTA is one question away, wherever you are.", e: "`app/layout.tsx` wraps pages in `AppShell`. The trail shows what the shell reaches on its own, including all of VESTA through `useVesta`. Page trails stop at `useVesta` so an Ask VESTA button does not inflate them." }, try: "Change the mission and watch every page follow." },
    "/about": { story: { s: "Who built HEARTH, why, and how far its data can be trusted.", e: "Static page with the challenge goals, team, reference atmospheres and the DEMO policy." }, try: "Check the reference atmospheres table." },
  } as Record<string, { story: Story; try: string }>,

  shell: {
    "components/layout/TopBar.tsx": { title: "Top bar & mission chips", story: same("The mission you pick here steers every page and VESTA at once. Shared state lives in one small store.") },
    "components/layout/SideNav.tsx": { title: "Side navigation", story: same("The list of pages. On small screens it moves to a sliding row at the top.") },
    "components/layout/SiteFooter.tsx": { title: "Footer", story: same("Credits at the bottom of every page, plus the link that opens this Blueprint.") },
    "components/vesta/VestaPanel.tsx": { title: "VESTA panel", story: same("The chat on every page, with the engine menu and level picker. It moves below the page on small screens.") },
    "components/ui/TestDrawer.tsx": { title: "Test details drawer", story: same("Opens one test with its derived values, source row and related PDF passages. VESTA can open it too.") },
    "components/ui/Tour.tsx": { title: "First-visit tour", story: same("A short guided tour for newcomers. Skip it once and it stays away.") },
    "components/fx/SpaceBackdrop.tsx": { title: "Space backdrop", story: same("Decoration only. It never carries data, and it calms down if you prefer reduced motion.") },
  } as Record<string, { title: string; story: Story }>,

  routes: {
    "/api/calc": same("Takes oxygen, pressure and airflow. Returns pO2, the data envelope, a heuristic hazard index and the nearest tests."),
    "/api/compare": same("Shared and different attributes for chosen experiments, plus condition statistics."),
    "/api/dataset/[file]": same("Serves the downloadable data files, built once at deploy time."),
    "/api/flame": same("Compact test rows for the flame simulator, so its sliders respond instantly."),
    "/api/gaps": same("The oxygen × pressure coverage grid, the gaps in it and suggested experiments."),
    "/api/map": same("Every plottable test as a point for the habitat relevance map."),
    "/api/missions": same("The reference atmospheres with computed pO2. A public route: pages use the same module directly."),
    "/api/rank": same("Ranks the experiments for a mission and shows how each score was built."),
    "/api/safety": same("Prevention, detection and suppression findings for a mission, each with evidence."),
    "/api/search": same("Searches the PDF passages and returns file and page. A public route: VESTA and the drawer use the same module directly."),
    "/api/tests": same("Filters, sorts and pages the test table."),
    "/api/tests/[id]": same("One test with derived values and related PDF passages."),
    "/api/vesta": same("The chat itself. Checks the request, then streams VESTA's answer as live events."),
    "/api/vesta/alert": same("VESTA's proactive mission warning. Uses tested formulas only, no AI."),
    "/api/vesta/engines": same("Tells the model menu which engines are available. Only yes or no, never a key."),
  } as Record<string, Story>,

  libs: {
    "lib/analysis.ts": same("Compares experiments, scores relevance and finds gaps."),
    "lib/bins.ts": same("Defines the oxygen and pressure buckets for the gap grid."),
    "lib/csv.ts": same("Reads CSV files, including uploads in My data lab."),
    "lib/data.ts": same("Loads, validates and filters the clean data."),
    "lib/dataset-docs.ts": same("The written explanations on the Dataset page."),
    "lib/dataset-export.ts": same("Builds the downloadable data files."),
    "lib/dataset-split.ts": same("Makes train/test splits and CSV exports."),
    "lib/dataset.ts": same("Computes every statistic on the Dataset page."),
    "lib/flame.ts": same("Turns real tests into flame simulator results."),
    "lib/map3d.ts": same("The scales and geometry for the 3D map."),
    "lib/missions.ts": same("The reference atmospheres: ISS, Moon base, rover, spacesuit."),
    "lib/physics.ts": same("The tested formulas: pO2, ratios, unit conversion, envelope check."),
    "lib/ratelimit.ts": same("Limits requests per visitor and remembers finished calculations."),
    "lib/safety.ts": same("The rules behind prevention, detection and suppression findings."),
    "lib/search.ts": same("Full-text search over the PDF passages."),
    "lib/store.ts": same("The browser's shared memory: mission, engine, messages, level."),
    "lib/vesta": same("VESTA's router, agent, tools, grounding check and Offline mode."),
  } as Record<string, Story>,

  tools: {
    query_data: same("Looks up and counts tests, returning rows and their sources."),
    search_docs: same("Finds passages in the NASA PDFs, with file and page."),
    physics_calc: same("Does the maths with tested formulas and shows the formula used."),
    nearest_tests: same("Finds the NASA tests closest to given conditions."),
    envelope_check: same("Answers “has anyone tested near this?” with supported, sparse or no data."),
    compare: same("Sets experiments side by side."),
    rank_investigations: same("Scores which experiment matters most for a mission."),
    gap_finder: same("Finds the conditions and fuels nobody has tested."),
    safety_audit: same("Lists prevention, detection and suppression findings with evidence."),
    make_chart: same("Draws a chart from tool numbers. Invalid charts are rejected."),
    ui_action: same("Moves the dashboard: opens a page, sets a mission, highlights tests."),
  } as Record<string, Story>,

  engines: {
    claude: same("Used first when a key is set."),
    openrouter: same("Free tier, second in line."),
    groq: same("Free tier, very fast."),
    gemini: same("Free tier, last of the AI engines."),
    offline: same("No AI and no key. Rule-based, and it never fails."),
  } as Record<string, Story>,

  deps: {
    "@anthropic-ai/sdk": "Talks to Claude",
    "@google/genai": "Talks to Gemini",
    echarts: "Draws the charts",
    "echarts-for-react": "Connects charts to React",
    minisearch: "Searches the PDF passages",
    next: "The website framework",
    openai: "Talks to OpenRouter and Groq",
    react: "Builds the interface",
    "react-dom": "Puts it in the browser",
    three: "The 3D habitat map",
    zod: "Checks data and tool inputs",
    "zod-to-json-schema": "Describes tools to each AI",
    zustand: "Shared browser state",
  } as Record<string, string>,

  stages: [
    { id: "send", label: "You ask", story: { s: "Your question leaves the browser with your mission, level and chosen engine, plus recent messages for context.", e: "`useVesta` POSTs to `/api/vesta` with the last {{historyMsgs}} messages. `streamVesta` reads the response as an SSE stream." } },
    { id: "gate", label: "Front door", story: { s: "A quick check: is the question valid, and are you asking too fast? This keeps free AI limits safe.", e: "zod validates the body (at most {{maxMsgs}} messages, {{maxMsgChars}} characters). One request at a time per visitor, and {{rateLimit}} questions per {{rateWindowMin}} minutes." } },
    { id: "cache", label: "Memory", story: { s: "Same question a moment ago? VESTA reuses that answer and saves time and AI credits. A backup answer, given while an engine was down, is not reused, so the next ask can reach that engine again.", e: "An in-memory cache keyed by engine, mission, level and messages, with a {{cacheMin}} minute lifetime, replaying the recorded events. Answers that needed a fallback are not stored." } },
    { id: "router", label: "Pick engine", story: { s: "VESTA picks the first engine that works, from best to always-available.", e: "`engineChain` starts with the chosen engine and always ends at Offline. Timeout {{engineTimeoutS}} s per call, {{aiDeadlineS}} s AI budget overall, cooldowns on failure." } },
    { id: "think", label: "Decide", story: { s: "An AI model decides which tools it needs. In Offline mode, simple rules recognise the kind of question instead.", e: "AI: tool loop, at most {{maxToolRounds}} rounds. Offline: `detectIntent` and `parseMessage` choose a template, calling the same tools." } },
    { id: "tools", label: "Use tools", story: { s: "The tools read the real data and return numbers with their sources. This is where the facts come from.", e: "`runTool` validates with zod and returns `{ok, data, sources, confidence, summary}`. Results are capped at {{toolResultMax}} characters for the model." } },
    { id: "check", label: "Check numbers", story: { s: "Every number in the answer must match a tool result or your own message. Offline templates can only fill in tool numbers to begin with.", e: "`checkGrounding` extracts numbers, allowing rounding and % ↔ fraction, and skips small integers up to {{smallIntMax}}. One rewrite is requested; if it still fails, the answer is marked as unverified." } },
    { id: "stream", label: "Stream back", story: { s: "The answer arrives bit by bit, with its sources and a confidence tag, plus a badge naming the engine that answered.", e: "SSE order: `engine → step* → (chart|ui)* → text* → sources → confidence → done`." } },
    { id: "move", label: "Move the view", story: { s: "VESTA can change the dashboard: open a page, switch the mission or highlight tests.", e: "`ui` events are applied by `applyUi`. `AUTO_VIEW` guarantees compare, audit and gap tools move the view even if the model forgets to." } },
  ] as { id: string; label: string; story: Story }[],

  replay: {
    title: "Watch a real answer",
    note: "Real recording: these events came from the actual Offline engine and tools when this page was last scanned. No AI was involved, so the numbers are straight from the code. AI engines follow the same path and send the same events, but word things in their own way.",
  },

  brains: {
    title: "Two ways to think, one set of tools",
    ai: {
      title: "AI engines",
      points: [
        same("The model reads your question and the rules, and picks tools."),
        same("Tools return real numbers. It can go round up to {{maxToolRounds}} times."),
        same("It writes an answer, and the grounding check reads it."),
      ],
    },
    offline: {
      title: "Offline mode",
      points: [
        same("Simple rules recognise the question type and pull out numbers like `34%`."),
        same("It calls the very same tools as the AI does."),
        same("It fills in a template. Unknown questions get a list of what it can do."),
      ],
    },
    alert: {
      title: "Proactive alert",
      story: same("When you change mission, VESTA speaks first, without any AI, using tested formulas and the envelope check. That's why it can warn you even if every AI service is down."),
    },
  },

  toolsBoard: {
    title: "VESTA's toolbox",
    story: same("{{dataToolCount}} tools read the data and {{actionToolCount}} act on the dashboard. A glowing tool was used in the replay above."),
  },

  groundingDemo: {
    title: "Caught in the act: a made-up number",
    story: same("What happens if a model invents a number? We gave the real checker a scripted model that lies on purpose, and recorded what happened."),
    steps: ["The tool returns the truth", "The model invents a number", "The checker catches it", "The rewrite uses real data"],
    note: "Scripted model, real code: the agent and grounding check are the ones VESTA uses.",
  },

  chain: {
    title: "Break things on purpose",
    story: same("Click an engine to change its state, then see who answers. The site must never break because a key is missing or a free limit is reached."),
    note: "DEMO: the failures are pretend. The decisions are real: {{fallbackRuns}} combinations were run through the real router when this page was scanned.",
    stateLabels: { ok: "Working", nokey: "No key", limit: "Limit reached" },
    detail: {
      s: "A failed engine is skipped for a while, so the next person doesn't have to wait for it to fail again.",
      e: "Cooldowns: {{cooldownShortS}} s for limits, timeouts and service errors; {{cooldownLongMin}} min for rejected keys and missing models. Raw provider errors are never shown to users.",
    } as Story,
  },

  confidence: {
    title: "Every finding wears a tag",
    items: [
      { id: "supported", story: same("At least {{envMin}} NASA tests are near this, or the fact is quoted from a document.") },
      { id: "extrapolated", story: same("Only sparse or indirect evidence, such as microgravity results used to reason about the Moon.") },
      { id: "no_data", story: same("Nothing covers it. VESTA won't predict. It names the gap and the experiment that would fill it.") },
    ],
    lowest: same("When tools disagree, the lowest confidence wins. No AI can talk its way up to “supported”."),
  },

  rules: [
    { title: "Every number has a source", story: same("Numbers come from the data or from a tested formula. If a value is missing, the site says it's missing."), code: ["lib/physics.ts", "lib/data.ts"], test: ["tests/physics.test.ts", "tests/data.test.ts"] },
    { title: "VESTA can't invent numbers", story: same("Any number that isn't in a tool result or your message gets caught, as you saw above."), code: ["lib/vesta/grounding.ts", "lib/vesta/agent.ts"], test: ["tests/vesta.test.ts"] },
    { title: "Every claim shows its source", story: same("Tools return the file with its row or page, and those travel with every answer."), code: ["lib/vesta/tools/query_data.ts", "lib/vesta/events.ts"], test: ["tests/tools.test.ts"] },
    { title: "Every finding has a confidence tag", story: same("Supported, extrapolated or no data, always the lowest the evidence allows."), code: ["lib/vesta/events.ts", "lib/physics.ts"], test: ["tests/vesta.test.ts"] },
    { title: "No predictions outside the data", story: same("VESTA names the gap and the experiment that would fill it, rather than guessing."), code: ["lib/vesta/tools/gap_finder.ts", "lib/vesta/system-prompt.md"], test: ["tests/safety.test.ts"] },
    { title: "Evidence, not official rules", story: same("Safety advice says “evidence suggests”. It's never presented as a NASA rule."), code: ["lib/safety.ts", "lib/vesta/system-prompt.md"], test: ["tests/safety.test.ts"] },
    { title: "Simulations are labelled DEMO", story: same("The flame animation and live telemetry are marked clearly and never mixed with NASA data."), code: ["components/lab/DemoTelemetry.tsx", "lib/flame.ts"], test: ["tests/flame.test.ts"] },
    { title: "It never breaks over a key", story: same("Missing keys, used-up limits and outages all end in a working answer, in the worst case from Offline mode."), code: ["lib/vesta/router.ts", "lib/vesta/offline.ts"], test: ["tests/hardening.test.ts", "tests/vesta.test.ts"] },
  ] as { title: string; story: Story; code: string[]; test: string[] }[],

  shipSteps: [
    { label: "Change", sub: "code or data", story: same("Someone improves the code. If the raw NASA data changes, the cleaner is run again by hand.") },
    { label: "Check", sub: "lint · test · build", story: { s: "Automated checks make sure nothing broke.", e: "`npm run lint`, `npm test` and `npm run build` must all pass before a phase is finished." } },
    { label: "Push", sub: "git → main", story: same("The change goes to GitHub, on the main branch.") },
    { label: "Scan", sub: "blueprint", story: same("The build re-scans the project and refreshes this page. If the scan ever fails, the build carries on with the last good version.") },
    { label: "Build", sub: "next build", story: same("Vercel builds the site. If the build fails, the previous version stays live.") },
    { label: "Live", sub: "the world", story: same("New version online, with the same address.") },
  ] as { label: string; sub: string; story: Story }[],

  vault: {
    title: "Where the secret keys live",
    story: same("AI keys are optional, and they never reach your browser. VESTA's menu only learns whether an engine is available."),
    steps: [
      { label: "On a laptop", detail: "`.env.local`, ignored by git" },
      { label: "Online", detail: "Vercel environment variables" },
      { label: "Server only", detail: "Read inside API routes" },
      { label: "Browser sees", detail: "`{id, label, available}`, nothing else" },
    ],
  },

  testsPanel: {
    title: "The safety net",
    story: same("{{testFiles}} test files with {{testBlocks}} test blocks, some of which run several cases. VESTA is also graded on {{evalQuestions}} exam questions. Latest saved Offline score: {{evalOffline}}."),
  },

  stack: { title: "What it's built with", python: "Cleaner (Python)" },

  selfUpdate: {
    title: "How the auto-update works",
    steps: [
      { label: "Scan", story: same("Reads routes, pages, tools, engines, tests and data counts straight from the code.") },
      { label: "Run", story: same("Runs the real Offline engine, router and grounding check, and records what they do.") },
      { label: "Compare", story: same("Logs anything new or removed since the last scan, and checks whether a key pipeline file changed since its explanation was last reviewed.") },
      { label: "Publish", story: same("Writes one self-contained file: public/blueprint.html.") },
    ],
    commands: [
      { cmd: "npm run blueprint:watch", what: "Live view at localhost: it refreshes itself whenever a file changes." },
      { cmd: "npm run blueprint", what: "Rebuild the page once." },
      { cmd: "npm run build", what: "Rebuilds it automatically, and so does every Vercel deploy." },
      { cmd: "npm run blueprint:reviewed", what: "After a pipeline change: run this once you've checked that the explanation is still right." },
    ],
    guard: {
      s: "A scanner can't explain something new in plain words, or tell what a code change means. So anything without an explanation is marked “new, not explained yet”, a changed pipeline file is marked “explanation under review”, and a test fails until someone has checked.",
      e: "`tests/blueprint.test.ts` fails on unexplained items, pipeline files changed since review, stale output, unresolved placeholders, numbers typed into prose and any key-like string. Vercel doesn't run tests, so this can never block a deploy; flagged items simply show on the page.",
    } as Story,
    watchList: "The {{watchedFiles}} pipeline files under watch",
  },

  review: {
    title: "Explanation under review.",
    story: same("This code changed after its explanation was last checked. Numbers on this page still come straight from the code, but the written explanation may be behind."),
    pill: "Explanation under review",
    reasons: { changed: "changed", removed: "removed", new: "not reviewed yet" } as Record<string, string>,
  },

  timeline: { title: "The project's story so far", changes: "Spotted by the scanner", noChanges: "No structural changes recorded yet. New pages, routes and tools will show up here." },
  footer: "Built from the real code. Every number here is read from the project or produced by running it. Fire-safety findings are evidence from NASA data, not official NASA rules.",
};

export type Stories = typeof STORIES;
