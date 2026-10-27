// The stories' thumbnails: each story's opening scene (its first cue, as the gallery plays it at #/stories/<id>), shot headless
// and saved as a small WebP for an app's story pictures (Kumru's Stories tab, its "Next for you" card and its Path's "out today"
// banner).
//
//   node packages/sahne-gallery/thumbs.mjs            shoot every story whose thumbnail is missing or stale
//   node packages/sahne-gallery/thumbs.mjs --all      shoot every story again (after a change to the stage or the kit)
//   node packages/sahne-gallery/thumbs.mjs --only s1e01,s1e02
//   node packages/sahne-gallery/thumbs.mjs --check    fail when a thumbnail is missing, stale or has no story (no browser)
//
// Written: thumbs/<id>.webp of the content root ($SAHNE_CONTENT, sahne-story/paths.ts) and thumbs.json, { <id>: the hash of what the picture is drawn from }: the story's
// file, its opening place and its cast's documents, and this script. --check compares those hashes, never the pixels (a picture
// differs a little between machines). A change to the stage or the kit draws differently without making a thumbnail stale:
// run with --all then.
//
// It starts the gallery on a port of its own and draws with Chromium's software GL (as golden.mjs), so any machine draws alike;
// the browser encodes the WebP (OffscreenCanvas), so no image library is needed. Playwright is a dev dependency of this package.

import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import playwright from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { CHARACTERS, PLACES, THUMBS, storyFile, storyIds } from "../sahne-story/paths.ts";

const W = 480, H = 300, QUALITY = 0.72, PORT = 5198;
const OUT = THUMBS;
const INDEX = new URL("thumbs.json", OUT);

const { values: o } = parseArgs({ options: { check: { type: "boolean", default: false }, all: { type: "boolean", default: false }, only: { type: "string" } } });

const read = (u) => (existsSync(u) ? readFileSync(u) : Buffer.alloc(0));
/** What story `id`'s picture is drawn from, hashed. */
function sourceHash(id) {
  const raw = readFileSync(storyFile(id));
  const s = JSON.parse(raw.toString("utf8"));
  const first = (s.steps ?? []).find((x) => x && typeof x === "object" && "scene" in x);
  const place = first?.scene ?? s.place;
  const h = createHash("sha256").update(readFileSync(new URL(import.meta.url)));
  h.update(raw).update(read(new URL(`${place}.json`, PLACES)));
  for (const c of [...(s.cast ?? []), ...(s.extras ?? [])].sort()) h.update(c).update(read(new URL(`${c}.json`, CHARACTERS)));
  return h.digest("hex").slice(0, 16);
}

const ids = storyIds();
const want = Object.fromEntries(ids.map((id) => [id, sourceHash(id)]));
const have = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : {};
const stale = ids.filter((id) => have[id] !== want[id] || !existsSync(new URL(`${id}.webp`, OUT)));
const orphans = existsSync(OUT) ? readdirSync(OUT).filter((f) => f.endsWith(".webp") && !want[f.slice(0, -5)]) : [];

if (o.check) {
  if (!stale.length && !orphans.length) { console.log(`thumbs: ${ids.length} up to date`); process.exit(0); }
  if (stale.length) console.error(`thumbs: missing or stale: ${stale.join(", ")}`);
  if (orphans.length) console.error(`thumbs: no story for: ${orphans.join(", ")}`);
  console.error("run: node packages/sahne-gallery/thumbs.mjs");
  process.exit(1);
}

const todo = o.only ? o.only.split(",") : o.all ? ids : stale;
mkdirSync(OUT, { recursive: true });
for (const f of orphans) rmSync(new URL(f, OUT));
if (!todo.length) { writeIndex(); console.log(`thumbs: ${ids.length} up to date`); process.exit(0); }

// ---- the gallery, on a port of its own -----------------------------------------------------------------------------------
const server = spawn("node", ["serve.mjs"], { cwd: new URL(".", import.meta.url).pathname, env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });
let log = "";
server.stdout.on("data", (d) => (log += d)); server.stderr.on("data", (d) => (log += d));
const stop = () => { try { server.kill(); } catch { /* gone */ } };
process.on("exit", stop);
for (let i = 0; ; i++) {
  if (i > 200) { console.error("thumbs: the gallery did not start\n" + log); process.exit(1); }
  if (await fetch(`http://localhost:${PORT}/`).then((r) => r.ok, () => false)) break;
  await new Promise((r) => setTimeout(r, 100));
}

const { chromium } = playwright;
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

let bytes = 0;
for (const id of todo) {
  await page.goto(`http://localhost:${PORT}/#/stories/${id}`);
  await page.waitForFunction(() => window.storyDemo?.stage?.perf, null, { timeout: 30_000 });
  await page.evaluate(() => { const s = window.storyDemo.stage; s.show(0); s.render(); });
  await page.waitForTimeout(400);
  const png = await (await page.$(".view .frame")).screenshot();
  // cut to 16:10 from the middle, scale down and encode, in the page
  const webp = Buffer.from(await page.evaluate(async ([b64, w, h, q]) => {
    const bm = await createImageBitmap(await (await fetch("data:image/png;base64," + b64)).blob());
    const r = Math.min(bm.width / w, bm.height / h), sw = w * r, sh = h * r;
    const c = new OffscreenCanvas(w, h), x = c.getContext("2d");
    x.imageSmoothingQuality = "high";
    x.drawImage(bm, (bm.width - sw) / 2, (bm.height - sh) / 2, sw, sh, 0, 0, w, h);
    const buf = new Uint8Array(await (await c.convertToBlob({ type: "image/webp", quality: q })).arrayBuffer());
    let s = ""; for (const v of buf) s += String.fromCharCode(v);
    return btoa(s);
  }, [png.toString("base64"), W, H, QUALITY]), "base64");
  writeFileSync(new URL(`${id}.webp`, OUT), webp);
  have[id] = want[id];
  bytes += webp.length;
  console.log(`${id}.webp  ${(webp.length / 1024).toFixed(1)} KB`);
}
await browser.close();
stop();
writeIndex();
console.log(`thumbs: ${todo.length} written, ${(bytes / 1024 / todo.length).toFixed(1)} KB each on average`);
if (errors.length) { console.error("page errors:\n" + errors.join("\n")); process.exit(1); }
process.exit(0);

function writeIndex() {
  const out = Object.fromEntries(ids.filter((id) => have[id]).map((id) => [id, have[id]]));
  writeFileSync(INDEX, JSON.stringify(out, null, 1) + "\n");
}
