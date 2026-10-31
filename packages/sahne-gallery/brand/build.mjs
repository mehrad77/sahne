// The Sahne brand files, from one place. Run from the repo root:
//
//   node packages/sahne-gallery/brand/build.mjs           writes them
//   node packages/sahne-gallery/brand/build.mjs --check   fails when one is stale or missing (pnpm check runs it)
//
// For every package in packages/ (a folder with a package.json), so a new package gets its own by running this:
// - assets/brand/<id>.svg: the mark, the n arch with the package's ebru in its window (ebru.mjs, seeded by the id);
// - assets/brand/<id>-header.svg and -header-dark.svg: the lockup, "sahne" and the package's name on a tab in its
//   colour, for light and dark pages; the top of the package's README.md shows it (a marked block, rewritten
//   here; a package without a README gets one from its package.json description);
// - assets/brand/<id>-favicon.svg: the flat mark (the window in the package's colour, no ebru), and the same as
//   favicon.svg beside the index.html of a package that has a web app, which must link it.
// The words are outlined from Fraunces Black and Inter Semibold (@fontsource, OFL), so they look the same in an
// <img>, on GitHub and offline.

import ot from "opentype.js";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inkPaths, hashSeed, recipe, run } from "./ebru.mjs";

const ROOT = new URL("../../../", import.meta.url);
const PACKAGES_DIR = new URL("packages/", ROOT);
const OUT = new URL("assets/brand/", ROOT);
const FONTS = new URL("../node_modules/@fontsource/", import.meta.url);

/** The brand pair, Gece (night) and Perde (the lit screen), and the brass of the pin. */
const INK = "#1C2246", PERDE = "#F6E3BE", BRASS = "#D8A440";
/** The mark in its 100 × 100 box: the frame (a lowercase n as a stage arch), its window and the stage floor. */
const FRAME = "M12 88V12H30V22C36 15 45 11 55 11C75 11 88 24 88 46V88H70V50C70 36 63 29 52 29C38 29 30 38 30 52V88Z";
const WIN = "M30 88V52C30 38 38 29 52 29C63 29 70 36 70 50V88Z";
/** The frame as the n inside the word: its stem stops at the shoulder, as a lowercase n's does. */
const FRAME_N = "M12 88V24H30V22C36 15 45 11 55 11C75 11 88 24 88 46V88H70V50C70 36 63 29 52 29C38 29 30 38 30 52V88Z";

/** Each package's colour: `key` fills the mark's window and the tab, `ebru` is its marbling (the water first).
 * `sahne-fa` waits for the Persian plugin. A package not listed gets a colour from its name (`colours`). */
export const PACKAGES = {
  sahne: { key: "#FBE6BC", name: "Perde", ebru: ["#F6E3BE", "#1C2246", "#2F8C88", "#C8463A", "#FBF3E2"] },
  "sahne-kit": { key: "#D8A440", name: "Pirinç", ebru: ["#F3E6CC", "#D8A440", "#8E6640", "#1C2246", "#FBF3E2"] },
  "sahne-tr": { key: "#E30A17", name: "Al", ebru: ["#FBF3E2", "#E30A17", "#9E0A12", "#1C2246", "#FFFFFF"] },
  "sahne-fa": { key: "#1FA5A0", name: "Fîrûze", ebru: ["#E6F3F0", "#1FA5A0", "#0E6F73", "#D8A440", "#1C2246"] },
  "sahne-story": { key: "#9C5F7C", name: "Mürdüm", ebru: ["#F4E4EA", "#9C5F7C", "#5E3550", "#E0A13A", "#1C2246"] },
  "sahne-backstage": { key: "#B98A5A", name: "Kraft", ebru: ["#E9D6B0", "#B98A5A", "#D8A440", "#8E6640", "#1C2246"] },
  "sahne-gallery": { key: "#5D72B4", name: "Gece mavisi", ebru: ["#DCE3F5", "#5D72B4", "#1C2246", "#D8A440", "#FBE6BC"] },
};
const SPARE = ["#C2452D", "#6A8D3A", "#3F7CAC", "#B5651D", "#7B5EA7", "#2E8B57"];

// ---- Colour ----------------------------------------------------------------------------------------------

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = c => "#" + c.map(v => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase();
const mix = (a, b, t) => hex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));
const lum = h => {
  const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

export function colours(id) {
  if (PACKAGES[id]) return PACKAGES[id];
  const key = SPARE[hashSeed(id) % SPARE.length];
  return { key, name: key, ebru: [mix(key, "#FFFFFF", 0.82), key, mix(key, "#000000", 0.4), BRASS, INK] };
}
/** The tab's words: navy or white, whichever reads better on the package's colour. */
const tabInk = key => (contrast(key, INK) >= contrast(key, "#FFFFFF") ? INK : "#FFFFFF");
/** The package's name on its tab: `sahne-kit` → KIT; the engine has none. */
const tabLabel = id => (id === "sahne" ? "" : id.replace(/^sahne-/, "").toUpperCase());

// ---- Type, outlined ----------------------------------------------------------------------------------------

const font = file => {
  const b = readFileSync(new URL(file, FONTS));
  return ot.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const FRAUNCES = font("fraunces/files/fraunces-latin-900-normal.woff");
const INTER = font("inter/files/inter-latin-600-normal.woff");
const n = v => +v.toFixed(2);

/** `str` outlined at (x, baseline), with `tracking` added after each letter: its path data and its width. */
function words(f, str, x, y, size, tracking = 0) {
  if (!tracking) return { d: f.getPath(str, x, y, size).toPathData(2), width: f.getAdvanceWidth(str, size) };
  let d = "", at = x;
  for (const ch of str) { d += f.getPath(ch, at, y, size).toPathData(2); at += f.getAdvanceWidth(ch, size) + tracking; }
  return { d, width: at - x - tracking };
}

// ---- The mark ----------------------------------------------------------------------------------------------

/** The mark's drawing in its 100 × 100 box. `ink` colours the frame; `ebru` puts the package's marbling in the
 * window (else its flat colour); `uid` keeps the ids of two marks on one page apart. */
function markBody(id, { ink = INK, ebru = true, uid = id, frame = FRAME } = {}) {
  const c = colours(id);
  let win = `<path d="${WIN}" fill="${c.key}"/>`;
  if (ebru) {
    const rc = recipe(id, c.ebru);
    const ink_ = inkPaths(run(rc.ops)).map(p => `<path d="${p.d}" fill="${p.fill}"/>`).join("");
    win = `<clipPath id="${uid}-w"><path d="${WIN}"/></clipPath><g clip-path="url(#${uid}-w)"><rect width="100" height="100" fill="${rc.water}"/>${ink_}</g>`;
  }
  const rim = mix(ink, "#FFFFFF", 0.22);
  return win
    + `<path d="${frame}" transform="translate(1.2 1.8)" fill="#000" fill-opacity=".22"/>`
    + `<path d="${frame}" fill="${ink}"/>`
    + `<clipPath id="${uid}-f"><path d="${frame}"/></clipPath><path d="${frame}" fill="none" stroke="${rim}" stroke-width="2.2" clip-path="url(#${uid}-f)"/>`
    + `<rect x="4" y="86" width="92" height="7" rx="1.5" fill="${ink}"/><rect x="5" y="86" width="90" height="1.2" fill="${rim}"/>`
    + `<circle cx="21" cy="24" r="3.4" fill="${BRASS}" stroke="#7A5418" stroke-width=".5"/><circle cx="20" cy="22.8" r="1" fill="#FFF3C4" fill-opacity=".85"/>`;
}

const svg = (w, h, label, body, extra = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(w)} ${n(h)}" width="${Math.round(w)}" height="${Math.round(h)}" role="img" aria-label="${label}"${extra}><title>${label}</title>${body}</svg>\n`;

export const mark = id => svg(100, 100, `${id} mark`, markBody(id));

/** The lockup: the mark, "sahne" in Fraunces Black standing on the stage floor, and the package's name in Inter
 * Semibold capitals on a tab in its colour, centred on the x-height. */
export function lockup(id, dark = false) {
  const ink = dark ? PERDE : INK, s = 1.12, H = 112, base = 86 * s;
  const upm = FRAUNCES.unitsPerEm;
  const hTop = FRAUNCES.charToGlyph("h").getBoundingBox().y2 / upm;
  const size = (base - 12 * s) / hTop;
  const x0 = 100 * s + 0.16 * size;
  const word = words(FRAUNCES, "sahne", x0, base, size);
  let body = `<g transform="scale(${s})">${markBody(id, { ink, uid: `${id}${dark ? "-d" : ""}` })}</g><path d="${word.d}" fill="${ink}"/>`;
  let w = x0 + word.width + 2;
  const label = tabLabel(id);
  if (label) {
    const c = colours(id), xh = (FRAUNCES.tables.os2.sxHeight / upm) * size, mid = base - xh / 2;
    const tabH = xh * 0.82, cap = INTER.tables.os2.sCapHeight / INTER.unitsPerEm;
    const ls = (0.46 * tabH) / cap, track = 0.12 * ls, pad = 0.42 * tabH;
    const tx = x0 + word.width + 0.2 * size;
    const text = words(INTER, label, tx + pad, mid + (cap * ls) / 2, ls, track);
    body += `<rect x="${n(tx)}" y="${n(mid - tabH / 2)}" width="${n(text.width + 2 * pad)}" height="${n(tabH)}" rx="${n(0.07 * tabH)}" fill="${c.key}"/><path d="${text.d}" fill="${tabInk(c.key)}"/>`;
    w = tx + text.width + 2 * pad + 2;
  }
  return svg(w, H, label ? `sahne ${label}` : "sahne", body);
}

/** The word alone, the mark standing in for its n (sah·n·e), for a title such as the poster's: the frame fills
 * the n's x-height, its floor dropped. */
export function wordmark(dark = false) {
  const ink = dark ? PERDE : INK, size = 100, base = 96;
  const upm = FRAUNCES.unitsPerEm, xh = (FRAUNCES.tables.os2.sxHeight / upm) * size;
  const side = 0.035 * size, k = xh / 77;
  const sah = words(FRAUNCES, "sah", 0, base, size);
  const mx = sah.width + side - 12 * k;
  const e = words(FRAUNCES, "e", mx + 88 * k + side, base, size);
  const top = base - FRAUNCES.charToGlyph("h").getBoundingBox().y2 / upm * size - 2;
  const body = `<path d="${sah.d}" fill="${ink}"/><g transform="translate(${n(mx)} ${n(base - 88 * k)}) scale(${n(k)})">${markBody("sahne", { ink, uid: `word${dark ? "-d" : ""}`, frame: FRAME_N }).replace(/<rect x="4"[^>]*\/><rect x="5"[^>]*\/>/, "")}</g><path d="${e.d}" fill="${ink}"/>`;
  return svg(mx + 88 * k + side + e.width + 2, base + 4 - top, "sahne", `<g transform="translate(0 ${n(-top)})">${body}</g>`);
}

/** The flat mark for a browser tab: the window in the package's colour, the frame navy, or Perde on a dark
 * browser (and a window that would vanish against it turns navy). */
export function favicon(id) {
  const key = colours(id).key, darkWin = contrast(key, PERDE) < 1.5 ? INK : key;
  const style = `<style>.f{fill:${INK}}.w{fill:${key}}@media (prefers-color-scheme:dark){.f{fill:${PERDE}}.w{fill:${darkWin}}}</style>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="8 7 84 84">${style}<path class="w" d="${WIN}"/><path class="f" d="${FRAME}"/><circle cx="21" cy="24" r="5" fill="${BRASS}"/></svg>\n`;
}

// ---- The packages and their READMEs -------------------------------------------------------------------------

const START = "<!-- sahne:brand: written by packages/sahne-gallery/brand/build.mjs, edit that and run it -->";
const END = "<!-- /sahne:brand -->";

export const packageIds = () => readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter(e => e.isDirectory() && existsSync(new URL(`${e.name}/package.json`, PACKAGES_DIR)))
  .map(e => e.name).sort();

function brandBlock(id) {
  const label = tabLabel(id), alt = label ? `sahne ${label}` : "sahne";
  return `${START}\n<p><picture><source media="(prefers-color-scheme: dark)" srcset="../../assets/brand/${id}-header-dark.svg"><img src="../../assets/brand/${id}-header.svg" alt="${alt}" height="64"></picture></p>\n${END}\n`;
}

/** The README with its brand block at the top, replaced if it is there. */
function readme(id) {
  const file = new URL(`${id}/README.md`, PACKAGES_DIR);
  if (!existsSync(file)) {
    const { description = "" } = JSON.parse(readFileSync(new URL(`${id}/package.json`, PACKAGES_DIR), "utf8"));
    return `${brandBlock(id)}\n# ${id}\n\n${description}\n`;
  }
  const text = readFileSync(file, "utf8");
  const a = text.indexOf(START), b = text.indexOf(END);
  if (a === 0 && b > a) return brandBlock(id) + text.slice(b + END.length + 1);
  return `${brandBlock(id)}\n${text}`;
}

/** Every file this writes, path from the repo root → contents. */
export function outputs() {
  const files = new Map();
  for (const id of packageIds()) {
    files.set(`assets/brand/${id}.svg`, mark(id));
    files.set(`assets/brand/${id}-header.svg`, lockup(id));
    files.set(`assets/brand/${id}-header-dark.svg`, lockup(id, true));
    files.set(`assets/brand/${id}-favicon.svg`, favicon(id));
    files.set(`packages/${id}/README.md`, readme(id));
    if (existsSync(new URL(`${id}/index.html`, PACKAGES_DIR))) files.set(`packages/${id}/favicon.svg`, favicon(id));
  }
  files.set("assets/brand/sahne-wordmark.svg", wordmark());
  files.set("assets/brand/sahne-wordmark-dark.svg", wordmark(true));
  return files;
}

/** A web app's page must link its favicon. */
function pageProblems() {
  return packageIds()
    .filter(id => existsSync(new URL(`${id}/index.html`, PACKAGES_DIR)))
    .filter(id => !/<link rel="icon" href="\/?favicon\.svg"/.test(readFileSync(new URL(`${id}/index.html`, PACKAGES_DIR), "utf8")))
    .map(id => `packages/${id}/index.html has no <link rel="icon" href="favicon.svg" type="image/svg+xml">`);
}

// ---- Run ----------------------------------------------------------------------------------------------------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check");
  const files = outputs();
  const stale = [...files].filter(([p, text]) => !existsSync(new URL(p, ROOT)) || readFileSync(new URL(p, ROOT), "utf8") !== text).map(([p]) => p);
  const extra = existsSync(OUT) ? readdirSync(OUT).map(f => `assets/brand/${f}`).filter(p => !files.has(p)) : [];
  const problems = pageProblems();
  if (check) {
    for (const p of stale) console.error(`stale: ${p}`);
    for (const p of extra) console.error(`not made by the generator: ${p}`);
    for (const p of problems) console.error(p);
    if (stale.length || extra.length || problems.length) {
      console.error("run node packages/sahne-gallery/brand/build.mjs");
      process.exit(1);
    }
    console.log(`brand: ${files.size} files up to date`);
  } else {
    mkdirSync(OUT, { recursive: true });
    for (const p of stale) writeFileSync(new URL(p, ROOT), files.get(p));
    for (const p of extra) rmSync(new URL(p, ROOT));
    for (const p of problems) console.warn(p);
    console.log(`brand: wrote ${stale.length} of ${files.size} files${extra.length ? `, removed ${extra.length}` : ""}`);
  }
}
