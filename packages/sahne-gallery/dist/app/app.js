import {
  SYSTEMS
} from "./chunk-MBHY5FZF.js";
import {
  Ctx,
  parseRoute
} from "./chunk-CZRUW744.js";
import {
  addContentKit
} from "./chunk-Y35JX3JV.js";
import {
  data
} from "./chunk-6PR3AWGB.js";
import "./chunk-GO2IY55S.js";
import "./chunk-3BCF3C4G.js";
import "./chunk-ZT53KTYM.js";
import "./chunk-TYXGNTJ5.js";
import "./chunk-XKJEK365.js";
import {
  $,
  button,
  choice,
  toggle
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/shell/style.ts
var CSS = `
:root { --sahne-text-hand: "Comic Neue", "Segoe Print", "Chalkboard SE", "Bradley Hand", cursive; --sahne-text-print: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif; --sahne-text-screen: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
:root { --bg: #F4EFE6; --ink: #2B2420; --mute: #7A6E64; --line: #DDD3C4; --chip: #FFFDF8; --accent: #2F8C88; --warn: #B7791F; --bad: #B23A2A; --side: #EDE6DA; --frame-max: none; color-scheme: light; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #1E1B19; --ink: #EFE7DC; --mute: #A89C90; --line: #3A342F; --chip: #2A2623; --side: #24201D; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #1E1B19; --ink: #EFE7DC; --mute: #A89C90; --line: #3A342F; --chip: #2A2623; --side: #24201D; color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; background: var(--bg); color: var(--ink); font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; }
a { color: var(--accent); }
.app { display: grid; grid-template-columns: 236px 1fr; min-height: 100vh; }
.side { background: var(--side); border-right: 1px solid var(--line); padding: 12px 10px 24px; position: sticky; top: 0; height: 100vh; overflow: auto; }
.side .brand { padding: 4px 8px 10px; display: block; text-decoration: none; }
/* the sahne GALLERY lockup (assets/brand/, written by brand/build.mjs), light or dark with the theme */
.side .brand .lockup { display: block; width: 100%; max-width: 200px; aspect-ratio: 671 / 112; background: url(assets/brand/sahne-gallery-header.svg) left center / contain no-repeat; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .side .brand .lockup { background-image: url(assets/brand/sahne-gallery-header-dark.svg); } }
:root[data-theme="dark"] .side .brand .lockup { background-image: url(assets/brand/sahne-gallery-header-dark.svg); }
.side .brand small { color: var(--mute); font-weight: 400; display: block; font-size: 12px; margin-top: 6px; }
.side nav a { display: block; color: var(--ink); text-decoration: none; padding: 3px 8px; border-radius: 8px; font-size: 13.5px; }
.side nav a.top { font-weight: 650; margin-top: 6px; }
.side nav a.sub { padding-left: 18px; color: var(--mute); }
.side nav a.sub small { opacity: .8; }
.side nav .group { padding: 8px 8px 2px 18px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--mute); }
.side nav a:hover { background: var(--chip); }
.side nav a[aria-current="page"] { background: var(--accent); color: #fff; }
.main { min-width: 0; }
.topbar { position: sticky; top: 0; z-index: 5; background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(6px); border-bottom: 1px solid var(--line); padding: 8px 16px; display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: center; }
.topbar .crumbs { font-weight: 650; margin-right: auto; }
.topbar .menu { display: none; }
.view { max-width: 1180px; margin: 0 auto; padding: 16px 16px 60px; }
@media (max-width: 860px) {
  .app { grid-template-columns: 1fr; }
  .side { position: fixed; z-index: 10; inset: 0 30% 0 0; transform: translateX(-102%); transition: transform .2s; height: 100vh; }
  .app.open .side { transform: none; box-shadow: 0 0 40px #0004; }
  .topbar .menu { display: inline-block; }
}
h1 { font-size: 20px; margin: 4px 0 6px; }
h2 { font-size: 16px; margin: 22px 0 6px; }
h3 { font-size: 14px; margin: 14px 0 4px; }
.head h2 { margin-top: 18px; }
.note { color: var(--mute); margin: 0 0 10px; font-size: 13px; max-width: 80ch; }
.bar { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin: 6px 0; }
.bar > b { color: var(--mute); font-size: 11.5px; text-transform: uppercase; letter-spacing: .04em; margin-right: 2px; min-width: 56px; }
button, select, input[type=text], input[type=search], input[type=number] { font: inherit; color: var(--ink); background: var(--chip); border: 1px solid var(--line); border-radius: 999px; padding: 3px 11px; }
select, input[type=text], input[type=search], input[type=number] { border-radius: 8px; }
button { cursor: pointer; }
button:hover { border-color: var(--accent); }
button[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: var(--accent); }
button.primary { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: 600; }
.slider, .pick { display: inline-flex; gap: 6px; align-items: center; font-size: 12.5px; color: var(--mute); }
.slider output { min-width: 3ch; color: var(--ink); font-variant-numeric: tabular-nums; }
.chip { display: inline-block; font-size: 11px; font-weight: 600; border: 1px solid var(--line); border-radius: 999px; padding: 0 7px; color: var(--mute); vertical-align: 1px; white-space: nowrap; }
.chip.ok { border-color: var(--accent); color: var(--accent); }
.chip.warn { border-color: var(--warn); color: var(--warn); }
.chip.bad { border-color: var(--bad); color: var(--bad); }
.chip.ph { border-style: dashed; }
.frame { position: relative; width: 100%; max-width: var(--frame-max); border-radius: 12px; overflow: hidden; border: 1px solid var(--line); background: #CFE3EE; margin: 8px 0; }
.card { background: var(--chip); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px; margin: 0 0 14px; }
.cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 10px; }
.cards > a.card { color: var(--ink); text-decoration: none; display: grid; gap: 4px; margin: 0; }
.cards > a.card:hover { border-color: var(--accent); }
.cards > a.card small { color: var(--mute); }
.facts { display: grid; grid-template-columns: max-content 1fr; gap: 3px 12px; margin: 8px 0; font-size: 13px; }
.facts dt { color: var(--mute); }
.facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
.tile { margin: 0; background: var(--chip); border: 1px solid var(--line); border-radius: 12px; padding: 8px; display: grid; gap: 6px; color: var(--ink); text-decoration: none; }
a.tile:hover { border-color: var(--accent); }
.tile .art { height: 140px; display: grid; place-items: center; background: #EDE6DA; border-radius: 8px; overflow: hidden; }
.tile .art img, .tile .art svg { max-width: 100%; max-height: 136px; }
.tile figcaption, .tile .cap { font: 12px ui-monospace, monospace; display: flex; flex-wrap: wrap; gap: 4px; justify-content: space-between; align-items: center; }
table.t { border-collapse: collapse; font-size: 13px; margin: 6px 0; }
table.t th, table.t td { border: 1px solid var(--line); padding: 3px 8px; text-align: left; vertical-align: top; }
table.t th { color: var(--mute); font-weight: 600; }
.ok { color: var(--accent); } .bad { color: var(--bad); } .warn { color: var(--warn); }
.cols { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, 340px); gap: 16px; align-items: start; }
@media (max-width: 900px) { .cols { grid-template-columns: 1fr; } }
.log { font: 12px ui-monospace, monospace; max-height: 220px; overflow: auto; background: var(--chip); border: 1px solid var(--line); border-radius: 10px; padding: 8px; white-space: pre-wrap; }
.meter { height: 8px; border-radius: 4px; background: var(--line); overflow: hidden; }
.meter > i { display: block; height: 100%; background: var(--accent); }
.checks { margin: 6px 0 10px; padding-left: 20px; font-size: 13px; }
.sites { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
.site .art { height: 150px; display: grid; place-items: center; background: #EDE6DA; border-radius: 8px; overflow: hidden; margin-bottom: 6px; }
.site .art img { width: 100%; height: 100%; object-fit: cover; }
.site h3 { margin: 4px 0 0; }
.placerow { border-top: 1px solid var(--line); padding: 6px 0; display: grid; gap: 4px; font-size: 13px; }
.placerow small { display: block; }
.rules .chip { margin: 1px 0; }
.marks { position: absolute; inset: 0; pointer-events: none; }
.marks .pin { position: absolute; transform: translate(-50%, -100%); pointer-events: auto; font-size: 11px; padding: 1px 7px; opacity: .88; white-space: nowrap; background: #FFFDF8E8; color: #2B2420; border-color: #0002; }
.marks .pin.perch, .marks .pin.air, .marks .pin.pace { border-color: #B7791F; }
.marks .pin.door { border-color: #2F8C88; }
.sheetrow { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-start; }
.sheetrow h3 { width: 100%; }
.sheetcell { margin: 0; }
.sheetcell .stagebox, .camstages .stagebox { aspect-ratio: 16 / 9; border: 1px solid var(--line); border-radius: 8px; overflow: hidden; margin: 6px 0; }
.camstages { display: flex; flex-wrap: wrap; gap: 10px; }
.params { display: grid; gap: 6px; margin: 6px 0 10px; }
.param { display: grid; grid-template-columns: 92px 1fr; gap: 2px 8px; align-items: center; font-size: 12.5px; }
.param code { font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
.param input[type=text], .param select { width: 100%; min-width: 0; }
.param input[type=range] { grid-column: 2; width: 100%; }
.param small { grid-column: 2; color: var(--mute); font-size: 11.5px; line-height: 1.3; }
/* the home page */
.cards.stats { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
.hero { padding: 18px 0 6px; }
.hero .wordmark { margin: 0; }
/* sah\xB7n\xB7e, the mark as its n (assets/brand/sahne-wordmark*.svg), light or dark with the theme */
.hero .wordmark .word { display: block; height: clamp(48px, 9vw, 84px); aspect-ratio: 294 / 81.5; background: url(assets/brand/sahne-wordmark.svg) left center / contain no-repeat; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .hero .wordmark .word { background-image: url(assets/brand/sahne-wordmark-dark.svg); } }
:root[data-theme="dark"] .hero .wordmark .word { background-image: url(assets/brand/sahne-wordmark-dark.svg); }
.hero .wordmark small { display: block; font: italic 400 15px/1.6 Georgia, serif; color: var(--mute); letter-spacing: 0; margin-top: 4px; }
.hero .tagline { font-size: clamp(16px, 2.4vw, 20px); line-height: 1.4; max-width: 46ch; margin: 12px 0 14px; }
.ctas { display: flex; flex-wrap: wrap; gap: 8px; }
.cta { display: inline-block; padding: 7px 15px; border-radius: 999px; border: 1px solid var(--line); background: var(--chip); color: var(--ink); text-decoration: none; font-weight: 600; }
.cta:hover { border-color: var(--accent); }
.cta.main { background: var(--accent); border-color: var(--accent); color: #fff; }
.hero-stage .frame { border-radius: 16px; box-shadow: 0 10px 30px #0002; }
.film-title, .film-cap { position: absolute; pointer-events: none; opacity: 0; transition: opacity .8s; color: #fff; text-shadow: 0 1px 8px #000a; z-index: 3; }
.film-title { inset: 0; display: grid; place-content: center; text-align: center; background: radial-gradient(#0008, #000c); }
.film-title b { font: 700 clamp(30px, 7vw, 64px)/1.05 Georgia, serif; }
.film-title small { font: 600 clamp(10px, 1.4vw, 13px)/1.6 system-ui, sans-serif; letter-spacing: .3em; text-transform: uppercase; opacity: .8; }
.film-title span { font: italic 400 clamp(12px, 2vw, 17px)/1.6 Georgia, serif; opacity: .85; }
.film-cap { left: 14px; bottom: 12px; font: 600 clamp(11px, 1.6vw, 14px)/1.2 system-ui, sans-serif; letter-spacing: .04em; text-transform: uppercase; background: #0006; padding: 5px 10px; border-radius: 6px; }
.film-title.on, .film-cap.on { opacity: 1; }
.prose-p { max-width: 72ch; font-size: 15px; line-height: 1.6; margin: 0 0 10px; }
pre.code, .prose pre { font: 12.5px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--chip); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; overflow: auto; max-width: 100%; }
/* the docs */
.doc-head small { color: var(--mute); }
.toc { background: var(--chip); border: 1px solid var(--line); border-radius: 10px; padding: 6px 12px; margin: 10px 0; max-width: 72ch; }
.toc summary { cursor: pointer; font-weight: 600; }
.toc ul { margin: 6px 0; padding-left: 18px; columns: 2 260px; }
.toc li.sub { margin-left: 14px; font-size: 13px; }
.prose { max-width: 80ch; font-size: 15px; line-height: 1.6; overflow-wrap: anywhere; }
.prose h1 { font-size: 28px; margin: 14px 0 10px; }
.prose h2 { font-size: 21px; margin: 28px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--line); }
.prose h3 { font-size: 17px; margin: 20px 0 6px; }
.prose h1, .prose h2, .prose h3, .prose h4 { scroll-margin-top: 56px; }
.prose code { font: 0.88em ui-monospace, SFMono-Regular, Menlo, monospace; background: var(--chip); border: 1px solid var(--line); border-radius: 5px; padding: 0 4px; }
.prose pre code { border: 0; padding: 0; background: none; font-size: inherit; }
.prose table { border-collapse: collapse; display: block; overflow-x: auto; margin: 10px 0; font-size: 13.5px; }
.prose th, .prose td { border: 1px solid var(--line); padding: 5px 8px; text-align: left; vertical-align: top; }
.prose th { background: var(--chip); }
.prose img { max-width: 100%; height: auto; border-radius: 10px; }
.prose blockquote { margin: 10px 0; padding: 2px 14px; border-left: 3px solid var(--accent); color: var(--mute); }
.prose .live { margin: 10px 0 4px; }
.prose details.src summary { cursor: pointer; color: var(--mute); font-size: 13px; }
`;

// src/registry.ts
var SECTIONS = [
  { id: "", title: "Home", about: "What Sahne is, a scene playing, what it does", load: () => import("./home-TPEUS2DO.js") },
  {
    id: "docs",
    title: "Docs",
    about: "The guide, the engine's design, the kit, the story format",
    nav: async () => (await data("docs")).map((d) => ({ label: d.title, hash: `#/docs/${d.slug}`, group: d.group })),
    load: () => import("./docs-GS2MNP3S.js")
  },
  {
    id: "systems",
    title: "Systems",
    about: "The engine, one live demo per system",
    nav: () => SYSTEMS.map((s) => ({ label: s.title, hash: `#/systems/${s.id}`, group: s.group })),
    load: () => import("./view-Q4Q6YEBU.js")
  },
  {
    id: "kit",
    title: "Kit",
    about: "People, gestures, the set and props, sounds, Kerim",
    nav: () => KIT_NAV,
    load: () => import("./kit-SMYWFHMI.js")
  },
  {
    id: "places",
    title: "Places",
    about: "Every story place: the board, each place scouted",
    nav: async () => {
      const places = await data("places");
      const { BENCH_DOCS } = await import("./common-XHCZ36J4.js");
      return [{ label: "The board", hash: "#/places" }, ...places.map((p) => ({ label: p.id, hash: `#/places/${p.id}`, group: "built" })), ...BENCH_DOCS.map((p) => ({ label: p.id.replace(/^bench_/, ""), hash: `#/places/${p.id}`, group: "test benches" }))];
    },
    load: () => import("./places-YYBFWCE7.js")
  },
  {
    id: "stories",
    title: "Stories",
    about: "The stories played through the adapter",
    nav: async () => (await data("drafts")).map((d) => ({ label: d.id, hash: `#/stories/${d.id}`, note: d.fixture ? "test scene" : void 0 })),
    load: () => import("./stories-PXVFO7TE.js")
  },
  {
    id: "cast",
    title: "Cast",
    about: "The stories' characters: the roster and the extras, at every framing",
    nav: () => [{ label: "Roster", hash: "#/cast" }, { label: "Extras", hash: "#/cast/extras" }],
    load: () => import("./cast-5EPULRNQ.js")
  },
  { id: "dev", title: "For maintainers", about: "Engine coverage and the changes to review", load: () => import("./dev-KZXRWN64.js") }
];
var KIT_NAV = [
  { label: "Set and props", hash: "#/kit/set" },
  { label: "People", hash: "#/kit/people" },
  { label: "Gestures and faces", hash: "#/kit/gestures" },
  { label: "Sounds and music", hash: "#/kit/sound" },
  { label: "Kerim", hash: "#/kit/kerim" },
  { label: "Animals", hash: "#/kit/animals" }
];

// src/app.ts
await addContentKit();
var ctx = new Ctx();
window.gallery = ctx;
document.head.append(Object.assign(document.createElement("style"), { textContent: CSS }));
ctx.applyPage();
var app = $("div", "app");
var side = $("aside", "side");
var main = $("div", "main");
var top = $("div", "topbar");
var view = $("main", "view");
var brand = Object.assign($("a", "brand"), { href: "#/" });
brand.setAttribute("aria-label", "sahne gallery");
brand.append($("span", "lockup"), $("small", "", "a paper-theatre stage engine: demos and docs"));
var nav = $("nav");
nav.setAttribute("aria-label", "Gallery");
side.append(brand, nav);
main.append(top, view);
app.append(side, main);
document.body.append(app);
var items = /* @__PURE__ */ new Map();
function drawNav() {
  nav.replaceChildren();
  for (const s of SECTIONS) {
    nav.append(Object.assign($("a", "top", s.title), { href: `#/${s.id}`, title: s.about }));
    let group = "";
    for (const it of items.get(s.id) ?? []) {
      if (it.group && it.group !== group) {
        group = it.group;
        nav.append($("div", "group", group));
      }
      const a = Object.assign($("a", "sub", it.label), { href: it.hash });
      if (it.note) a.append(" ", $("small", "", it.note));
      nav.append(a);
    }
  }
  markCurrent();
}
function markCurrent() {
  const here = location.hash.split("?")[0] || "#/";
  let best = null;
  for (const a of nav.querySelectorAll("a")) {
    a.removeAttribute("aria-current");
    const h = a.getAttribute("href");
    if ((here === h || here.startsWith(h + "/")) && (!best || h.length > best.getAttribute("href").length)) best = a;
  }
  best?.setAttribute("aria-current", "page");
}
for (const s of SECTIONS) if (s.nav) Promise.resolve(s.nav()).then((list) => {
  items.set(s.id, list);
  drawNav();
}, (e) => console.warn(`nav ${s.id}: ${e.message}`));
drawNav();
var crumbs = $("span", "crumbs");
var menu = button("\u2630", () => app.classList.toggle("open"), void 0, "sections");
menu.className = "menu";
var S = ctx.settings;
top.append(
  menu,
  crumbs,
  choice("motion", ["full", "calm", "still"], S.motion, (m) => ctx.setSettings({ motion: m })),
  toggle("sound", S.sound, (on) => ctx.setSettings({ sound: on }), "sound on every stage (starts off: a browser wants a tap)"),
  toggle("captions", S.captions, (on) => ctx.setSettings({ captions: on }), "sound words as bubbles while sound is on"),
  choice("width", ["fit", "390", "1100"], S.width, (w) => ctx.setSettings({ width: w }), { fit: "fit", "390": "390", "1100": "1100" }),
  choice("theme", ["auto", "light", "dark"], S.theme, (t) => ctx.setSettings({ theme: t }))
);
new ResizeObserver(() => document.documentElement.style.setProperty("--topbar-h", `${top.offsetHeight}px`)).observe(top);
var token = 0;
async function show() {
  const route = parseRoute(), mine = ++token;
  ctx.reset(route);
  app.classList.remove("open");
  markCurrent();
  const section = SECTIONS.find((s) => s.id === route.section) ?? SECTIONS[0];
  crumbs.textContent = [section.title, ...route.path].join(" \xB7 ");
  document.title = route.section || route.path.length ? `${[...route.path].reverse().join(" \xB7 ") || section.title} \xB7 Sahne` : "Sahne: a paper-theatre stage engine";
  view.replaceChildren($("p", "note", "Loading\u2026"));
  try {
    const v = await section.load();
    if (mine !== token) return;
    view.replaceChildren();
    await v.render(view, ctx);
  } catch (e) {
    if (mine !== token) return;
    console.error(e);
    view.replaceChildren($("h1", "", "This view failed"), $("pre", "log", String(e.stack ?? e)));
  }
  if (mine === token) window.scrollTo(0, 0);
}
addEventListener("hashchange", show);
show();
//# sourceMappingURL=app.js.map
