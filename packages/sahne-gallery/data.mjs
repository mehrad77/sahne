// What the gallery reads: each entry of DATA makes one /data/<name>.json from disk. serve.mjs answers
// them on every request (adding a place or a draft needs only a reload); build.mjs writes them once into
// the static site. Where the files live is sahne-story/paths.ts.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { posix } from "node:path";
import { fileURLToPath } from "node:url";
import { Marked } from "marked";
import { execFileSync } from "node:child_process";
import { CARDS, PLACES, STORIES_WORLD } from "../sahne-story/paths.ts";
import { loadNeeds } from "../sahne-story/load.ts";
import { loadCast, loadDrafts, loadExtras } from "../sahne-story/check/world.ts";

const at = p => new URL(p, import.meta.url);
const json = p => JSON.parse(readFileSync(at(p), "utf8"));

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

export const DATA = {
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
  // the docs' index (doc() renders one, as /data/docs/<slug>.json)
  docs: () => DOCS.map(({ slug, title, group }) => ({ slug, title, group })),
};

// ---- The docs: the repo's own markdown, rendered for #/docs -------------------------------------------

/** The docs the gallery shows, in its sidebar's order: slug, title, group, and the file from the repo root. A
 * link between two of them stays in the gallery; a link to any other repo file goes to GitHub. */
export const DOCS = [
  ["start", "Your first scene", "Guide", "packages/sahne-gallery/guide/start.md"],
  ["overview", "Overview", "Guide", "README.md"],
  ["engine", "The engine", "Engine", "packages/sahne/README.md"],
  ["design", "Design", "Engine", "packages/sahne/DESIGN.md"],
  ["turkish", "The Turkish plugin", "Engine", "packages/sahne-tr/README.md"],
  ["style", "Style guide", "Kit", "packages/sahne-kit/STYLE.md"],
  ["catalogue", "Catalogue", "Kit", "packages/sahne-kit/CATALOGUE.md"],
  ["set", "Set pieces", "Kit", "packages/sahne-kit/SET.md"],
  ["sounds", "Sound sources", "Kit", "packages/sahne-kit/sounds/SOURCES.md"],
  ["stories", "Stories and places", "Stories", "packages/sahne-story/README.md"],
  ["backstage", "Backstage, the editor", "Stories", "packages/sahne-backstage/README.md"],
  ["gallery", "The gallery", "Project", "packages/sahne-gallery/README.md"],
  ["packages", "Package conventions", "Project", "packages/README.md"],
  ["contributing", "Contributing", "Project", "CONTRIBUTING.md"],
  ["agents", "Rules for changes", "Project", "AGENTS.md"],
].map(([slug, title, group, file]) => ({ slug, title, group, file }));

const REPO_URL = "https://github.com/mehrad77/sahne";
/** The gallery's own address: a link to it from a doc stays in the page (`#/…`). */
const SITE = "https://sahne.shab.boo/";
const BY_FILE = new Map(DOCS.map(d => [d.file, d]));
/** A heading's anchor, as GitHub makes it. */
const anchor = text => text.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\p{L}\p{N}\s_-]/gu, "").trim().replace(/\s/g, "-");
const escape = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** One doc as HTML. Links: to another doc → `#/docs/<slug>?at=<anchor>`; to a heading of its own → `?at=`; to
 * any other repo file → GitHub (images → raw; the repo's assets/ is served beside the page). Headings carry GitHub's anchors, and a numbered one (`## 12.`,
 * `### 4.1`) also `data-sec`, so `?at=s12` finds DESIGN.md §12. A fenced block in the language `sahne` (a
 * script, `{ v, cues }`) becomes a live stage in the gallery and stays plain JSON on GitHub. */
export function doc(slug) {
  const d = DOCS.find(d => d.slug === slug);
  if (!d) return null;
  const here = posix.dirname(d.file);
  const href = (url, image) => {
    if (url.startsWith(SITE)) return url.slice(SITE.length) || "#/";
    if (/^[a-z]+:|^\/\//i.test(url)) return url;
    if (url.startsWith("#")) return `#/docs/${slug}?at=${url.slice(1)}`;
    const [path, hash] = url.split("#");
    const file = posix.normalize(posix.join(here, path)).replace(/\/$/, "");
    const to = BY_FILE.get(file);
    if (to && !image) return `#/docs/${to.slug}${hash ? `?at=${hash}` : ""}`;
    if (image && file.startsWith("assets/")) return file;
    return image ? `https://raw.githubusercontent.com/mehrad77/sahne/main/${file}` : `${REPO_URL}/${file.includes(".") ? "blob" : "tree"}/main/${file}${hash ? `#${hash}` : ""}`;
  };
  const toc = [];
  const md = new Marked({ gfm: true, renderer: {
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens), id = anchor(html);
      const sec = html.match(/^(\d+(?:\.\d+)?)\.?\s/)?.[1];
      if (depth >= 2 && depth <= 3) toc.push({ id, depth, text: html.replace(/<[^>]+>/g, "") });
      return `<h${depth} id="${id}"${sec ? ` data-sec="${sec}"` : ""}>${html}</h${depth}>\n`;
    },
    link({ href: url, title, tokens }) { return `<a href="${escape(href(url))}"${title ? ` title="${escape(title)}"` : ""}>${this.parser.parseInline(tokens)}</a>`; },
    image({ href: url, title, text }) { return `<img src="${escape(href(url, true))}" alt="${escape(text)}"${title ? ` title="${escape(title)}"` : ""} loading="lazy">`; },
    code({ text, lang }) {
      if (lang === "sahne") return `<div class="sahne-live" data-script="${escape(text)}"></div><details class="src"><summary>The script</summary><pre><code>${escape(text)}</code></pre></details>\n`;
      return `<pre><code${lang ? ` class="language-${escape(lang)}"` : ""}>${escape(text)}</code></pre>\n`;
    },
  } });
  // inline HTML in the docs (the README's centred poster, a package's brand block) has repo-relative src/srcset/href too
  const html = md.parse(readFileSync(at(`../../${d.file}`), "utf8"))
    .replace(/(<(?:img|a|source)\b[^>]*?\s(?:src|srcset|href)=")([^"#][^"]*)"/g, (m, pre, url) => /^[a-z]+:|^\/\/|^#/i.test(url) ? m : `${pre}${escape(href(url, !pre.startsWith("<a")))}"`);
  return { ...d, html, toc, source: `${REPO_URL}/blob/main/${d.file}` };
}

// ---- What the page loads beside the bundle --------------------------------------------------------

/** The bundle's esbuild options (serve.mjs watches them, build.mjs builds them once): a lazy chunk per section. */
export const BUNDLE = { entryPoints: [fileURLToPath(at("src/app.ts"))], bundle: true, splitting: true, format: "esm", target: "es2022" };

/** Copies the files the page loads into `dist` (a folder path ending in /): the kit's recordings into sounds/,
 * as an app would serve them, and Comic Neue (OFL, @fontsource/comic-neue, the bubbles' hand font) into fonts/. */
export function copyStatic(dist) {
  const sounds = fileURLToPath(at("../sahne-kit/sounds/"));
  mkdirSync(dist + "sounds", { recursive: true });
  for (const f of readdirSync(sounds).filter(f => f.endsWith(".m4a"))) cpSync(sounds + f, dist + "sounds/" + f);
  const fonts = fileURLToPath(at("node_modules/@fontsource/comic-neue/files/"));
  mkdirSync(dist + "fonts", { recursive: true });
  for (const w of [400, 700]) cpSync(`${fonts}comic-neue-latin-${w}-normal.woff2`, `${dist}fonts/comic-neue-${w}.woff2`);
}
