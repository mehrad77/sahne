// A contact sheet of the set kit's pieces and props: every generator of a family,
// its default look and each variant, with three seeds; a prop also counted (n 3) and held. For checking
// art without the gallery running; the review page shows the same pieces live.
//
//   node packages/sahne-gallery/kit-sheet.ts --family street [--ids facade,awning] [--glow] [--out <dir>]
//
// Writes <out>/<family>.png (and .html). --glow draws what glows at night over the art, on a dark page.

import playwright from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import kit from "../sahne-kit/src/full.ts";
import { FAMILY_MODULES } from "../sahne-kit/src/set/all.ts";
import { pieceSvg } from "./src/piece-svg.ts";

const { values: o } = parseArgs({ options: { family: { type: "string" }, ids: { type: "string" }, glow: { type: "boolean" }, out: { type: "string", default: "kit-sheet" }, px: { type: "string", default: "170" } } });
const fam = FAMILY_MODULES[o.family ?? ""];
if (!fam) { console.error(`--family: one of ${Object.keys(FAMILY_MODULES).join(", ")}`); process.exit(1); }
const only = o.ids ? new Set(o.ids.split(",")) : null, px = +o.px!;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
let html = "", errors = 0, cell = 0;
for (const kind of ["set", "props"] as const) for (const [id, def] of Object.entries(fam[kind])) {
  if (only && !only.has(id)) continue;
  const looks: [string, Record<string, unknown>][] = [["", {}], ...Object.keys(def.variants ?? {}).map(v => [v, { variant: v }] as [string, Record<string, unknown>])];
  if (kind === "props") looks.push(["n 3", { n: 3 }], ["held", { held: true }]);
  html += `<h2>${esc(id)} <small>${kind === "set" ? "piece" : "prop"}</small></h2><div class="row">`;
  for (const [label, params] of looks) for (const seed of ["a", "b", "c"]) {
    let svg = "";
    try { svg = pieceSvg(kit, def, params, `${id}/${seed}`, px, !!o.glow, `c${cell++}`) || "<i>no flats</i>"; } catch (e) { svg = `<b class="err">${esc(String(e))}</b>`; errors++; }
    html += `<figure>${svg}<figcaption>${esc(label || "default")} · ${seed}</figcaption></figure>`;
  }
  html += "</div>";
}
const page = `<!doctype html><meta charset="utf-8"><style>body{font:13px system-ui;margin:16px;background:${o.glow ? "#1B2238" : "#F4EFE6"};color:${o.glow ? "#DDE" : "#333"}}.row{display:flex;flex-wrap:wrap;gap:8px}figure{margin:0;padding:6px;background:${o.glow ? "#2A3150" : "#EAE3D6"};border-radius:6px;display:flex;flex-direction:column;align-items:center;justify-content:end;min-width:${px}px}figcaption{font-size:11px;opacity:.7}.err{color:#C33}h2{margin:18px 0 6px;font-size:15px}</style>${html || "<p>nothing drawn</p>"}`;
mkdirSync(o.out!, { recursive: true });
const file = `${o.out}/${o.family}${o.glow ? "-glow" : ""}`;
writeFileSync(`${file}.html`, page);
const { chromium } = playwright;
const browser = await chromium.launch(), pg = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await pg.setContent(page);
await pg.screenshot({ path: `${file}.png`, fullPage: true });
await browser.close();
console.log(`${file}.png${errors ? ` (${errors} errors)` : ""}`);
