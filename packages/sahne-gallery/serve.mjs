// The Sahne gallery's dev server. One page, index.html, is the gallery: esbuild bundles src/app.ts with
// a lazy chunk per section into dist/app/. The data it shows is read from disk on each request and
// served as /data/<name>.json (places, needs, cards, plans, sizes, drafts …), so adding a place or a
// draft needs only a reload. Everything else is served from this folder.
import * as esbuild from "esbuild";
import http from "node:http";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { CARDS, PLACES, STORIES_WORLD } from "../sahne-story/paths.ts";
import { loadNeeds } from "../sahne-story/load.ts";
import { loadCast, loadDrafts, loadExtras } from "../sahne-story/check/world.ts";

const dir = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT ?? 5180);
const at = p => new URL(p, import.meta.url);
const json = p => JSON.parse(readFileSync(at(p), "utf8"));

// ---- What the gallery reads ----------------------------------------------------------------------

// Kerim's art is the kit's (sahne-kit/src/kerim/art.ts, which Kumru imports too). kerim.json carries her
// whole figure and mood names, the rules of her stylesheet (sahne-kit/src/kerim/kerim.css) that name .kerim
// or her k- parts (with their @media blocks and k- keyframes) and her shadow per theme.
// Her drop shadow is the app's --k-shadow (light, dark): an app sets it on :root, so the gallery keeps its own copy.
const K_SHADOW = { light: "0 1.5px 2px rgba(70,55,25,.26)", dark: "0 0 6px rgba(255,236,206,.1)" };
async function kerimPage() {
  const art = await import(at(`../sahne-kit/src/kerim/art.ts?${Date.now()}`).href);
  const statements = css => {
    const out = []; let depth = 0, start = 0;
    for (let i = 0; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) { out.push(css.slice(start, i + 1).trim()); start = i + 1; }
    }
    return out;
  };
  const rules = css => statements(css).flatMap(st => {
    if (st.startsWith("@media")) {
      const inner = rules(st.slice(st.indexOf("{") + 1, st.lastIndexOf("}")));
      return inner.length ? [`${st.slice(0, st.indexOf("{"))}{${inner.join("")}}`] : [];
    }
    if (st.startsWith("@keyframes")) return /^@keyframes k-/.test(st) ? [st] : [];
    return /\.kerim\b|\.k-/.test(st.slice(0, st.indexOf("{"))) ? [st] : [];
  });
  // her stylesheet is sahne-kit/src/kerim/kerim.css: the rules, in one `@layer features { ... }` block
  const css = readFileSync(at("../sahne-kit/src/kerim/kerim.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const section = css.slice(css.indexOf("@layer features {") + "@layer features {".length, css.lastIndexOf("}"));
  return { art: art.KERIM_ART, head: art.KERIM_HEAD, moods: art.K_MOODS, once: art.K_ONCE, land: art.K_LAND,
    css: rules(section).join("\n"), shadow: K_SHADOW };
}

// The planned places: the tables of STORIES_WORLD.md §2 in $SAHNE_STORY_DOCS (id, place, district, stories,
// notes) as plain text, with map links pulled out and the rows under "Placeholders" marked as such; none when
// SAHNE_STORY_DOCS is not set (the places board then shows the place documents alone).
function world() {
  if (!STORIES_WORLD || !existsSync(STORIES_WORLD)) return [];
  const md = h => h.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/\*\*|\*|`/g, "").replace(/\s+\(map\)/g, "").trim();
  let placeholder = false;
  return readFileSync(STORIES_WORLD, "utf8").split("\n").flatMap(l => {
    if (/^\*\*Placeholders/.test(l)) placeholder = true;
    if (/^## /.test(l)) placeholder = false;
    if (!/^\| `[a-z0-9_]+` \|/.test(l)) return [];
    const [id, place, district, stories, notes] = l.split("|").slice(1, -1).map(md);
    const link = l.match(/\]\((https?:[^)]+)\)/)?.[1] ?? "";
    return [{ id, place, district, stories, notes, link, placeholder }];
  });
}

// The A1 words for tap-to-translate: [turkish, english, persian] from the content root's cards/ (sahne-story/paths.ts),
// or none when it has no cards.
function vocab() {
  if (!existsSync(CARDS)) return [];
  return readdirSync(CARDS).filter(f => f.endsWith(".json")).sort().map(f => JSON.parse(readFileSync(new URL(f, CARDS), "utf8")))
    .filter(c => c.level === "A1" && c.tr && !c.retired).map(c => [c.tr, c.en ?? "", c.fa ?? ""]);
}

// Every story the gallery plays: the bakkal test scene, then each story (where they live is
// sahne-story/paths.ts), with its characters from the roster (the story check's own loader, check/world.ts).
function drafts() {
  const chars = d => existsSync(d) ? Object.fromEntries(readdirSync(d).filter(f => f.endsWith(".json")).map(f => [f.slice(0, -5), JSON.parse(readFileSync(new URL(f, d), "utf8"))])) : {};
  return [
    { id: "bakkal", fixture: true, story: json("../sahne-story/test/fixtures/bakkal.json"), characters: chars(at("../sahne-story/test/fixtures/characters/")) },
    ...loadDrafts().map(({ id, story, characters }) => ({ id, story, characters })),
  ];
}

// The cast roster (sorted by `order`) and the generic extras (each served as it is, with its file name),
// read by the story check's own loaders (check/world.ts) from where sahne-story/paths.ts says they live.
const cast = () => Object.values(loadCast()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
const extras = () => Object.entries(loadExtras()).filter(([, x]) => x && typeof x === "object" && !Array.isArray(x)).map(([file, x]) => ({ ...x, file }));

// The code sizes (size.mjs --json); measuring takes a few seconds, so a result is kept for a minute.
let sizes = { at: 0, rows: [] };
function measure() {
  if (Date.now() - sizes.at < 60000) return sizes.rows;
  let rows;
  try { rows = JSON.parse(execFileSync(process.execPath, [at("size.mjs").pathname, "--json"], { encoding: "utf8" })); }
  catch (e) { rows = JSON.parse(e.stdout || "[]"); }
  sizes = { at: Date.now(), rows };
  return rows;
}

const DATA = {
  places: () => readdirSync(PLACES).filter(f => f.endsWith(".json") && f !== "needs.json").sort().map(f => JSON.parse(readFileSync(new URL(f, PLACES), "utf8"))),
  needs: () => loadNeeds() ?? {},
  // the content root's cards for the place and story lints (sahne-story/load.ts): id → level, Turkish, English, retired;
  // null without cards (the card rules do not run); read only
  cards: async () => (await import(at(`../sahne-story/load.ts?${Date.now()}`).href)).loadCards(),
  catalogue: () => json("../sahne-kit/catalogue/plan.json"),
  world,
  vocab,
  drafts,
  cast,
  extras,
  sizes: measure,
  kerim: kerimPage,
};

// ---- The bundles ---------------------------------------------------------------------------------

// The kit's recordings, served from dist/sounds/ as an app would serve them.
const SOUNDS = at("../sahne-kit/sounds/").pathname;
mkdirSync(dir + "dist/sounds", { recursive: true });
for (const f of readdirSync(SOUNDS).filter(f => f.endsWith(".m4a"))) cpSync(SOUNDS + f, dir + "dist/sounds/" + f);

const app = await esbuild.context({
  entryPoints: [dir + "src/app.ts"],
  bundle: true, splitting: true, format: "esm", target: "es2022", sourcemap: true,
  outdir: dir + "dist/app", logLevel: "info",
});
await app.watch();

// esbuild serves the folder on a port of its own; this server answers /data/* and passes the rest on.
const { port: inner } = await app.serve({ servedir: dir, port: 0 });
http.createServer(async (req, res) => {
  const m = req.url.match(/^\/data\/([a-z]+)\.json(?:\?|$)/);
  if (m) {
    const make = DATA[m[1]];
    if (!make) { res.writeHead(404).end(); return; }
    try {
      const body = JSON.stringify(await make());
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(body);
    } catch (e) {
      console.warn(`/data/${m[1]}: ${e.message}`);
      res.writeHead(500, { "content-type": "text/plain" }).end(String(e.message));
    }
    return;
  }
  const up = http.request({ host: "127.0.0.1", port: inner, path: req.url, method: req.method, headers: req.headers }, r => {
    res.writeHead(r.statusCode, r.headers);
    r.pipe(res);
  });
  up.on("error", e => res.writeHead(502).end(e.message));
  req.pipe(up);
}).listen(port, () => console.log(`sahne gallery on http://localhost:${port}`));
