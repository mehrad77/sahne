// Screenshots of a story playing in the gallery (#/stories/<id>), from a headless browser with the GPU on: for checking
// stage work when the browser pane is hidden (a hidden pane pauses animation and draws nothing).
// The gallery must be running (pnpm sahne dev). Playwright is a dev dependency of this package.
//
//   node packages/sahne-gallery/shots.mjs --out <dir> [--story s1e00] [--cues 0,5,13] [--mid] [--width 1100] [--height 760]
//   node packages/sahne-gallery/shots.mjs --out <dir> --page '#/systems/light' [--wait 1500] [--click "night,dusk"]
//   node packages/sahne-gallery/shots.mjs --out <dir> --places all|bakkal,ist [--camera]
//
// Each cue gives <dir>/<story>-<cue>.png at its end pose; with --mid it is played from the cue
// before, and shot at 15 %, 40 % and 70 % of its length too (<story>-<cue>-40.png): held props,
// gestures and flight go wrong mid-cue, not at the end.
//
// With --page it shoots a gallery route instead, as the window shows it once its stages have drawn, as
// <dir>/<route>.png (systems_light.png); --click presses the buttons with those labels (comma-separated,
// in order, the first that matches), and each press gives one more shot (…-1.png, …-2.png).
//
// With --places it shoots each place's contact sheet (#/places/<id>/sheet): one picture per time and
// width, <place>-<time>-<width>.png. With --camera it runs each place's camera check (#/places/<id>/camera),
// writes camera.json and exits 1 when anything is out of frame. `all`: every place document.

import playwright from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: o } = parseArgs({ options: {
  out: { type: "string" }, story: { type: "string", default: "s1e00" }, cues: { type: "string" }, mid: { type: "boolean", default: false },
  page: { type: "string" }, wait: { type: "string", default: "1500" }, click: { type: "string" },
  places: { type: "string" }, camera: { type: "boolean", default: false },
  width: { type: "string", default: "1100" }, height: { type: "string", default: "760" }, port: { type: "string", default: "5180" },
} });
if (!o.out) { console.error("usage: node packages/sahne-gallery/shots.mjs --out <dir> [--story s1e00] [--cues 0,5,13] [--mid] [--width 1100] [--height 760]"); process.exit(2); }
mkdirSync(o.out, { recursive: true });

const { chromium } = playwright;
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu"] });
const page = await browser.newPage({ viewport: { width: +o.width, height: +o.height }, deviceScaleFactor: 2 });
const errors = [];
page.on("console", m => { if (m.type() === "error" || m.type() === "warning") errors.push(m.text()); });
if (o.places !== undefined) {
  const { readdirSync } = await import("node:fs");
  const { PLACES: dir } = await import("../sahne-story/paths.ts");
  const ids = o.places !== "all" ? o.places.split(",") : readdirSync(dir).filter(f => f.endsWith(".json") && f !== "needs.json").map(f => f.slice(0, -5));
  const report = [];
  for (const id of ids) {
    await page.goto(`http://localhost:${o.port}/#/places/${id}/sheet`);
    await page.waitForTimeout(+o.wait);
    for (const fig of await page.$$("figure.sheetcell")) {
      const [time, w] = await fig.evaluate(f => [f.dataset.time, f.dataset.w]);
      await fig.screenshot({ path: `${o.out}/${id}-${time}-${w}.png` });
    }
    if (o.camera) {
      await page.goto(`http://localhost:${o.port}/#/places/${id}/camera`);
      await page.waitForFunction(() => window.cameraCheck?.place);
      const c = await page.evaluate(() => window.cameraCheck);
      report.push(c);
      console.log(`${id}: ${c.ok ? "all inside" : c.results.filter(r => !r.ok).map(r => `${r.who} on ${r.mark} (${r.shot}, ${r.width} px)`).join("; ") + " OUT OF FRAME"}`);
    }
  }
  if (o.camera) writeFileSync(`${o.out}/camera.json`, JSON.stringify(report, null, 1));
  await browser.close();
  console.log(`${ids.length} place(s) → ${o.out}`);
  if (errors.length) console.log(errors.join("\n"));
  process.exit(o.camera && report.some(c => !c.ok) ? 1 : 0);
}
if (o.page) {
  // a route of the gallery (#/kit/set/road?variant=coast) is shot whole; an older page's #anchor is that section
  const route = o.page.startsWith("#/");
  const [file, anchor] = route ? ["", ""] : o.page.split("#");
  const name = route ? o.page.slice(2).replace(/[^\w.-]+/g, "_").replace(/_+$/, "") || "home" : `${file.replace(/\.html$/, "")}${anchor ? "-" + anchor : ""}`;
  await page.goto(`http://localhost:${o.port}/${o.page}`);
  await page.waitForTimeout(+o.wait);
  const el = anchor ? await page.$(`[id="${anchor}"]`) : null;
  // a section taller than a screenshot can be (a long table) is cut at 6000 px
  const snap = async path => {
    const box = el && await el.boundingBox();
    // a route is shot as the window shows it (a tall view is scrolled with --scroll)
    if (route) return page.screenshot({ path });
    if (!box) return page.screenshot({ path, fullPage: true });
    if (box.height <= 6000) return el.screenshot({ path });
    return page.screenshot({ path, fullPage: true, clip: { x: box.x, y: box.y, width: box.width, height: 6000 } });
  };
  await snap(`${o.out}/${name}.png`);
  const clicks = o.click ? o.click.split(",") : [];
  for (const [i, label] of clicks.entries()) {
    await (el ?? page).$(`button:text-is("${label.trim()}")`).then(b => b?.click());
    await page.waitForTimeout(+o.wait);
    await snap(`${o.out}/${name}-${i + 1}.png`);
  }
  await browser.close();
  console.log(`${o.page} → ${o.out}/${name}${clicks.length ? ` (+${clicks.length})` : ""}.png`);
  if (errors.length) console.log(errors.join("\n"));
  process.exit(0);
}
await page.goto(`http://localhost:${o.port}/#/stories/${o.story}`);
await page.waitForFunction(() => window.storyDemo?.stage?.perf);
const n = await page.evaluate(() => window.storyDemo.stage.perfs.length);
const cues = o.cues ? o.cues.split(",").map(Number) : [...Array(n).keys()];
const stage = await page.$(".view .frame");
const shot = name => stage.screenshot({ path: `${o.out}/${o.story}-${name}.png` });

for (const i of cues) {
  if (o.mid && i > 0) {
    const dur = await page.evaluate(i => { const s = window.storyDemo.stage; s.show(i - 1); s.play(i); return s.perfs[i].dur; }, i);
    let at = 0;
    for (const f of [0.15, 0.4, 0.7]) { await page.waitForTimeout(dur * f - at); at = dur * f; await shot(`${i}-${Math.round(f * 100)}`); }
  }
  await page.evaluate(i => { const s = window.storyDemo.stage; s.show(i); s.render(); }, i);
  await page.waitForTimeout(300);
  await shot(String(i));
}
await browser.close();
console.log(`${cues.length} cue(s) of ${o.story} → ${o.out}`);
if (errors.length) console.log(errors.join("\n"));
