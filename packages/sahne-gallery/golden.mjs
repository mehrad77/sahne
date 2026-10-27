// Golden frames (DESIGN.md §14): fixed scenes of the gallery, shot headless and compared with the baselines in
// golden/<platform>/ (darwin for a Mac, linux for CI). Part of `pnpm sahne check`; it starts the gallery on a port of its own and stops it again.
//
//   node golden.mjs            compare every scene with its baseline (exit 1 on a difference, or a missing baseline)
//   node golden.mjs --update   write the baselines (all scenes, or those whose name contains --only)
//   node golden.mjs --only s1e00   compare or update only the scenes whose name contains this
//
// A failure writes <scene>.actual.png and <scene>.diff.png to golden/failed/ (git-ignored); a missing baseline writes
// the shot there too, so a first CI run's artifact holds every Linux baseline to review and commit.
//
// Same renderer, same pixels: the baselines are shot with Chromium's software GL (SwiftShader), not the GPU, so a
// laptop and a CI runner draw alike. Fonts still differ between machines, and a little between Chromium builds, so a
// pixel counts as different only when a channel is off by more than CHANNEL, and a scene fails only when more than
// BUDGET of its pixels are. Stage frames carry no UI text, only the paper drawing; a scene that fails on CI alone
// is a font or Chromium change: look at golden/failed/ and, if the picture is right, copy the CI artifact's
// *.actual.png into golden/linux/ as <scene>.png (or shoot them in an x86_64 node:24 container with fonts-comic-neue,
// which CI installs for the signs' handwriting). Each platform keeps its own baselines: a Mac and a Linux runner
// draw a few percent of pixels differently even with software GL.
//
// Playwright is a dev dependency of this package; its Chromium must be installed (`pnpm --dir packages/sahne-gallery exec playwright install chromium`).

import playwright from "@playwright/test";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const CHANNEL = 24;     // a colour channel off by more than this (of 255) makes a pixel different
const BUDGET = 0.004;   // a scene fails when more than this share of its pixels differ
const PORT = 5199;

const { values: o } = parseArgs({ options: { update: { type: "boolean", default: false }, only: { type: "string" } } });
const ROOT = new URL("golden/", import.meta.url).pathname;
const GOLD = `${ROOT}${process.platform}/`;
const FAILED = ROOT + "failed/";
mkdirSync(GOLD, { recursive: true });
rmSync(FAILED, { recursive: true, force: true });

// Each scene: a gallery route and what to wait for and shoot. The story scenes are cues of the sample story s1e00 at their
// end pose (window.storyDemo, as shots.mjs drives it); the sheet scenes are a place's contact-sheet cells.
const STORY = "s1e00";
const CUES = [0, 3, 6, 9, 12];
const SHEETS = ["bakkal"];

const SCENES = [
  ...CUES.map(i => ({ name: `${STORY}-cue${i}`, kind: "cue", cue: i })),
  ...SHEETS.map(id => ({ name: `place-${id}-sheet`, kind: "sheet", id })),
].filter(s => !o.only || s.name.includes(o.only));

// ---- the gallery, on a port of its own -----------------------------------------------------------------------------

// always the samples (sahne-story/samples/), whatever SAHNE_CONTENT says: the baselines are of the sample story and places
const { SAHNE_CONTENT: _content, ...withoutContent } = process.env;

const server = spawn("node", ["serve.mjs"], { cwd: new URL(".", import.meta.url).pathname, env: { ...withoutContent, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", d => log += d); server.stderr.on("data", d => log += d);
const stop = () => { try { server.kill(); } catch {} };
process.on("exit", stop);
for (let i = 0; ; i++) {
  if (i > 200) { console.error("golden: the gallery did not start\n" + log); process.exit(1); }
  if (await fetch(`http://localhost:${PORT}/`).then(r => r.ok, () => false)) break;
  await new Promise(r => setTimeout(r, 100));
}

const { chromium } = playwright;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", e => errors.push(String(e)));

// ---- shooting --------------------------------------------------------------------------------------------------------

const url = hash => `http://localhost:${PORT}/${hash}`;
async function shoot(scene) {
  if (scene.kind === "cue") {
    await page.goto(url(`#/stories/${STORY}`));
    await page.waitForFunction(() => window.storyDemo?.stage?.perf);
    await page.evaluate(i => { const s = window.storyDemo.stage; s.show(i); s.render(); }, scene.cue);
    await page.waitForTimeout(400);
    return [await (await page.$(".view .frame")).screenshot()];
  }
  await page.goto(url(`#/places/${scene.id}/sheet`));
  await page.waitForSelector("figure.sheetcell");
  await page.waitForTimeout(1500);
  const cells = await page.$$("figure.sheetcell");
  // the cells are named by their time and width; the first time at the wide width is the scene
  const wide = [];
  for (const c of cells) if ((await c.evaluate(f => f.dataset.w)) === "1100") wide.push(c);
  return Promise.all(wide.slice(0, 2).map(c => c.screenshot()));
}

// Compared in the browser, which decodes PNGs for free: no image library in the repo.
const compare = (a, b) => page.evaluate(async ([a, b, channel]) => {
  const load = async s => { const bm = await createImageBitmap(await (await fetch("data:image/png;base64," + s)).blob()); const c = new OffscreenCanvas(bm.width, bm.height); const x = c.getContext("2d"); x.drawImage(bm, 0, 0); return { w: bm.width, h: bm.height, d: x.getImageData(0, 0, bm.width, bm.height).data }; };
  const A = await load(a), B = await load(b);
  if (A.w !== B.w || A.h !== B.h) return { size: [A.w, A.h, B.w, B.h] };
  const out = new OffscreenCanvas(A.w, A.h), ox = out.getContext("2d"), img = ox.createImageData(A.w, A.h);
  let bad = 0;
  for (let i = 0; i < A.d.length; i += 4) {
    const diff = Math.max(Math.abs(A.d[i] - B.d[i]), Math.abs(A.d[i + 1] - B.d[i + 1]), Math.abs(A.d[i + 2] - B.d[i + 2]));
    const isBad = diff > channel;
    if (isBad) bad++;
    img.data.set(isBad ? [255, 0, 0, 255] : [B.d[i], B.d[i + 1], B.d[i + 2], 70], i);
  }
  ox.putImageData(img, 0, 0);
  const png = await out.convertToBlob({ type: "image/png" });
  const buf = new Uint8Array(await png.arrayBuffer()); let s = ""; for (const x of buf) s += String.fromCharCode(x);
  return { share: bad / (A.w * A.h), diff: btoa(s) };
}, [a.toString("base64"), b.toString("base64"), CHANNEL]);

// ---- the run ---------------------------------------------------------------------------------------------------------

let failures = 0;
for (const scene of SCENES) {
  const shots = await shoot(scene);
  for (const [n, png] of shots.entries()) {
    const name = shots.length > 1 ? `${scene.name}-${n}` : scene.name;
    const file = `${GOLD}${name}.png`;
    if (o.update) { writeFileSync(file, png); console.log(`wrote ${name}.png`); continue; }
    if (!existsSync(file)) { failures++; console.log(`MISSING ${name}: no baseline (run with --update)`); mkdirSync(FAILED, { recursive: true }); writeFileSync(`${FAILED}${name}.actual.png`, png); continue; }
    const r = await compare(png, readFileSync(file));
    if (r.size || r.share > BUDGET) {
      failures++;
      mkdirSync(FAILED, { recursive: true });
      writeFileSync(`${FAILED}${name}.actual.png`, png);
      if (r.diff) writeFileSync(`${FAILED}${name}.diff.png`, Buffer.from(r.diff, "base64"));
      console.log(r.size ? `DIFF ${name}: size ${r.size.slice(0, 2)} vs baseline ${r.size.slice(2)}` : `DIFF ${name}: ${(r.share * 100).toFixed(2)} % of pixels differ (budget ${BUDGET * 100} %)`);
    } else console.log(`ok   ${name} (${(r.share * 100).toFixed(3)} % differ)`);
  }
}
if (!o.update) {
  // a baseline no scene produces any more is stale
  const made = new Set(SCENES.map(s => s.name));
  if (!o.only) for (const f of readdirSync(GOLD).filter(f => f.endsWith(".png"))) if (![...made].some(m => f.startsWith(m))) { failures++; console.log(`STALE ${f}: no scene makes it (delete it)`); }
}
await browser.close();
stop();
if (errors.length) console.log("page errors:\n" + errors.join("\n"));
if (failures) { console.error(`golden: ${failures} scene(s) differ; see ${FAILED}`); process.exit(1); }
console.log(o.update ? "golden: baselines written" : "golden: all frames match");
process.exit(0);
