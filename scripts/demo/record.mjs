/*
 * npm run demo:record: films "See HEARTH in action" once, perfectly, as a video the site then plays.
 *
 * 1. Builds the site and starts it (`next start`, never dev mode, which compiles each page on first open).
 * 2. Has Microsoft's Aria voice speak every narration line (scripts/demo/tts.py, cached).
 * 3. Opens the real site in a hidden Chrome at /?present=record with a virtual clock (virtual-time.js): the page
 *    only moves on 1/fps of a second per captured frame, and the clock stands still while anything is loading,
 *    so the video is perfectly smooth and has no waiting in it, however slow this computer is.
 * 4. Renders the music and sound effects at the moments they happened, places the voice lines, and writes
 *    public/demo/: hearth-demo.mp4 (everything mixed; also the download), voice.m4a, music.m4a, poster.jpg,
 *    subtitles.vtt and manifest.json (chapters and timed subtitles for the player).
 *
 * Options: --fps 30 · --seconds 12 (a short preview into .cache/demo/preview, public/demo untouched)
 *          --skip-build · --port 3210 · --out <dir>. Chrome: the installed one, or CHROME_PATH.
 * Tools live in .tools/ (puppeteer-core, ffmpeg-static; installed on first run) and edge-tts in Python.
 */
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAPTERS } from "../../lib/presenter/script";
import { fillNarration } from "../../lib/presenter/timing";
import { alignWords, buildCues, parseManifest, toVtt, wavMs } from "../../lib/presenter/demo";

const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);
const FPS = Number(arg("fps", 60));
const LIMIT = Number(arg("seconds", 0));
const PORT = Number(arg("port", 3210));
const BASE = `http://localhost:${PORT}`;
const VIEW = { width: 1536, height: 864, deviceScaleFactor: 1.25 }; // a laptop-sized page, filmed at 1920×1080
const FRAME = 1000 / FPS;
const WORK = join(ROOT, ".cache", "demo");
const OUT = join(ROOT, arg("out", LIMIT ? ".cache/demo/preview" : "public/demo"));
const win = process.platform === "win32";
const log = (...a) => console.log("[demo]", ...a);
const realSleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", shell: win, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed (${r.status})`);
  return r;
}

// ---- tools ----
if (!existsSync(join(ROOT, ".tools", "node_modules", "puppeteer-core")) || !existsSync(join(ROOT, ".tools", "node_modules", "ffmpeg-static"))) {
  log("installing the recording tools into .tools/ (once)");
  run("npm", ["install", "--prefix", ".tools", "--no-audit", "--no-fund"]);
}
const tools = createRequire(join(ROOT, ".tools", "package.json"));
const puppeteer = tools("puppeteer-core");
const FFMPEG = tools("ffmpeg-static");
const ff = (args) => run(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { shell: false });
const pythonCandidates = win ? [join(ROOT, ".venv", "Scripts", "python.exe"), "python", "py"] : [join(ROOT, ".venv", "bin", "python"), "python3", "python"];
const PYTHON = pythonCandidates.find((p) => spawnSync(p, ["-c", "import edge_tts"], { stdio: "ignore" }).status === 0);
if (!PYTHON) throw new Error("edge-tts is missing: run  pip install edge-tts  (in .venv or your Python)");

// ---- the site ----
if (!flag("skip-build") && !LIMIT) {
  log("building the site");
  run("npm", ["run", "build"]);
}
if (!existsSync(join(ROOT, ".next", "BUILD_ID"))) throw new Error("no build found: run npm run build first");
log(`starting the site on port ${PORT}`);
const server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: ROOT, shell: win, stdio: "ignore" });
const stopServer = () => {
  if (server.exitCode !== null) return;
  if (win) spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
  else server.kill("SIGTERM");
};
process.on("exit", stopServer);

let browser = null;
try {
  let total = null;
  for (let i = 0; i < 120 && total == null; i++) {
    try {
      const r = await fetch(`${BASE}/api/tests?page_size=1`);
      if (r.ok) total = (await r.json()).total;
    } catch {
      await realSleep(500);
    }
  }
  if (typeof total !== "number") throw new Error("the site did not start");

  // ---- the voice ----
  mkdirSync(WORK, { recursive: true });
  const lines = CHAPTERS.map((c) => ({ id: c.id, text: fillNarration(c.say, { tests: total }) }));
  writeFileSync(join(WORK, "lines.json"), JSON.stringify(lines));
  log("narration: Microsoft Aria");
  run(PYTHON, [join(ROOT, "scripts", "demo", "tts.py"), join(WORK, "lines.json"), join(WORK, "voice"), join(WORK, "voice.json")], { shell: false });
  const spoken = JSON.parse(readFileSync(join(WORK, "voice.json"), "utf8"));
  const timing = {};
  const wavOf = {};
  for (const line of spoken.lines) {
    const wav = line.mp3.replace(/\.mp3$/, ".wav");
    if (!existsSync(wav)) ff(["-i", line.mp3, "-ar", "48000", "-ac", "1", wav]);
    const ms = wavMs(new Uint8Array(readFileSync(wav)));
    timing[line.text] = { ms, words: alignWords(line.text, line.words, ms) };
    wavOf[line.text] = wav;
  }

  // ---- film it ----
  const opts = { headless: true, defaultViewport: VIEW, args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb", "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows", "--mute-audio"] };
  browser = await puppeteer.launch(process.env.CHROME_PATH ? { ...opts, executablePath: process.env.CHROME_PATH } : { ...opts, channel: "chrome" });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.evaluateOnNewDocument(`window.__hearthRec = ${JSON.stringify({ voice: timing, chapters: [], lines: [], missing: [] })};`);
  await page.evaluateOnNewDocument(`try { localStorage.setItem("hearth.tour.v1", "done"); } catch (e) {}`);
  // injected as source text: a serialized function would carry the bundler's helpers into the page
  await page.evaluateOnNewDocument(readFileSync(join(ROOT, "scripts", "demo", "virtual-time.js"), "utf8"));

  // the clock stands still while anything is loading, so waits never reach the video
  const cdp = await page.createCDPSession();
  // this connection captures the frames: give it the same screen, or frames come out at 1536×864
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.deviceScaleFactor, mobile: false });
  await cdp.send("Network.enable");
  const inflight = new Map();
  cdp.on("Network.requestWillBeSent", (e) => inflight.set(e.requestId, Date.now()));
  cdp.on("Network.loadingFinished", (e) => inflight.delete(e.requestId));
  cdp.on("Network.loadingFailed", (e) => inflight.delete(e.requestId));
  const settleNetwork = async () => {
    for (let i = 0; i < 2000; i++) {
      const now = Date.now();
      for (const [id, t] of inflight) if (now - t > 15_000) inflight.delete(id);
      if (!inflight.size) return;
      await realSleep(10);
    }
  };
  const step = async () => {
    await settleNetwork();
    await page.evaluate(`window.__vt.step(${FRAME})`);
  };

  log("opening the site");
  await page.goto(`${BASE}/?present=record`, { waitUntil: "load", timeout: 120_000 });
  const t0 = Date.now();
  while (!(await page.evaluate("!!window.__hearthRec.ready"))) {
    await step();
    if (Date.now() - t0 > 90_000) throw new Error("the page never got ready to film");
  }
  // let the first page finish drawing before the camera rolls
  for (let i = 0; i < Math.round(FPS * 1.5); i++) await step();
  const vt0 = await page.evaluate("window.__vt.now()");
  await page.evaluate("window.__hearthRec.go = true");

  mkdirSync(OUT, { recursive: true });
  const silent = join(WORK, "silent.mp4");
  const enc = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "22", "-tune", "animation", "-pix_fmt", "yuv420p", "-g", String(FPS * 2), "-movflags", "+faststart", silent], { stdio: ["pipe", "ignore", "inherit"] });
  const started = Date.now();
  let frames = 0;
  for (;;) {
    await step();
    const { data } = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 92, optimizeForSpeed: true });
    if (!enc.stdin.write(Buffer.from(data, "base64"))) await once(enc.stdin, "drain");
    frames++;
    if (frames % FPS === 0) {
      const s = await page.evaluate("({ done: !!window.__hearthRec.done, ch: window.__hearthRec.chapters.length })");
      const rate = frames / ((Date.now() - started) / 1000);
      process.stdout.write(`\r[demo] filmed ${(frames / FPS).toFixed(0)} s · chapter ${s.ch}/${CHAPTERS.length} · ${rate.toFixed(1)} frames/s   `);
      if (s.done) break;
    }
    if (LIMIT && frames >= LIMIT * FPS) break;
    if (frames > FPS * 300) throw new Error("the show never finished");
  }
  process.stdout.write("\n");
  enc.stdin.end();
  await once(enc, "close");
  if (enc.exitCode !== 0) throw new Error("video encoding failed");

  const rec = await page.evaluate("({ chapters: __hearthRec.chapters, lines: __hearthRec.lines, missing: __hearthRec.missing, events: __hearthRec.events || [], end: __hearthRec.end || null })");
  if (rec.missing.length) throw new Error(`no recorded voice for: ${rec.missing.join(" | ")}`);
  const seconds = frames / FPS;
  // frame k shows the page's clock at vt0 + (k + 1) frames: page seconds → video ms
  const videoMs = (at) => Math.max(0, Math.round(at * 1000 - vt0 - FRAME));

  // ---- sound ----
  log("rendering the music and sound effects");
  const events = rec.events.map((e) => ({ ...e, at: videoMs(e.at) / 1000 })).filter((e) => e.at < seconds);
  const music64 = await page.evaluate((ev, s) => window.__hearthRec.renderSound(ev, s), events, seconds);
  const musicWav = join(WORK, "music.wav");
  writeFileSync(musicWav, Buffer.from(music64, "base64"));

  log("placing the voice");
  const placed = rec.lines.map((l) => ({ text: l.text, startMs: videoMs(l.at), timing: timing[l.text] })).filter((l) => l.timing && l.startMs < seconds * 1000);
  const voiceWav = join(WORK, "voice.wav");
  const inputs = placed.flatMap((l) => ["-i", wavOf[l.text]]);
  const chains = placed.map((l, i) => `[${i}:a]adelay=${l.startMs}:all=1[v${i}]`);
  const mix = `${chains.join(";")};${placed.map((_, i) => `[v${i}]`).join("")}amix=inputs=${placed.length}:normalize=0:dropout_transition=0,apad,atrim=0:${seconds.toFixed(3)}[out]`;
  if (placed.length) ff([...inputs, "-filter_complex", mix, "-map", "[out]", "-ar", "48000", "-ac", "1", voiceWav]);
  else ff(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=mono", "-t", seconds.toFixed(3), voiceWav]);

  // ---- files for the site ----
  log("writing the video and its tracks");
  const video = join(OUT, "hearth-demo.mp4");
  ff(["-i", silent, "-i", voiceWav, "-i", musicWav, "-filter_complex", "[2:a]volume=1.6[m];[1:a][m]amix=inputs=2:normalize=0,alimiter=limit=0.95[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", video]);
  ff(["-i", voiceWav, "-c:a", "aac", "-b:a", "96k", join(OUT, "voice.m4a")]);
  ff(["-i", musicWav, "-af", "volume=1.6", "-c:a", "aac", "-b:a", "96k", join(OUT, "music.m4a")]);
  const chapters = rec.chapters.map((c) => ({ id: c.id, title: c.title, start: videoMs(c.at) / 1000 }));
  const posterAt = Math.min(seconds - 0.1, (chapters[1]?.start ?? 2) + 3);
  ff(["-ss", posterAt.toFixed(2), "-i", silent, "-frames:v", "1", "-q:v", "3", join(OUT, "poster.jpg")]);
  const cues = buildCues(placed);
  writeFileSync(join(OUT, "subtitles.vtt"), toVtt(cues));
  const manifest = {
    version: 1,
    recordedAt: new Date().toISOString(),
    duration: Math.round(seconds * 1000) / 1000,
    width: Math.round(VIEW.width * VIEW.deviceScaleFactor),
    height: Math.round(VIEW.height * VIEW.deviceScaleFactor),
    fps: FPS,
    video: "hearth-demo.mp4",
    voice: "voice.m4a",
    music: "music.m4a",
    poster: "poster.jpg",
    vtt: "subtitles.vtt",
    bytes: statSync(video).size,
    voiceName: spoken.voice,
    chapters,
    cues,
  };
  if (!parseManifest(manifest)) throw new Error("the manifest did not pass its own check");
  writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1));
  log(`done: ${seconds.toFixed(1)} s, ${(manifest.bytes / 1048576).toFixed(1)} MB → ${OUT}`);
  if (pageErrors.length) log(`page errors while filming (${pageErrors.length}):`, pageErrors.slice(0, 5));
} finally {
  if (browser) await browser.close().catch(() => {});
  stopServer();
}
