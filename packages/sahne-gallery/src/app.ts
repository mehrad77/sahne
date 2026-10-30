// The gallery: one page with a sidebar of sections (registry.ts), a top bar of gallery-wide settings,
// and a view per route (`#/<section>/<path…>?<query>`). A route change frees the previous view's
// stages and listeners (Ctx.reset) and loads the section's chunk.

import { $, choice, toggle, button } from "./shell/dom.ts";
import { Ctx, parseRoute, type Settings } from "./shell/ctx.ts";
import { addContentKit } from "./shell/kit.ts";
import { CSS } from "./shell/style.ts";
import { SECTIONS, type NavItem } from "./registry.ts";

declare global { interface Window { gallery: Ctx } }

await addContentKit();
const ctx = new Ctx();
window.gallery = ctx;
document.head.append(Object.assign(document.createElement("style"), { textContent: CSS }));
ctx.applyPage();

const app = $("div", "app"), side = $("aside", "side"), main = $("div", "main"), top = $("div", "topbar"), view = $("main", "view");
const brand = Object.assign($("a", "brand", "Sahne"), { href: "#/" });
brand.append($("small", "", "a paper-theatre stage engine: demos and docs"));
const nav = $("nav");
nav.setAttribute("aria-label", "Gallery");
side.append(brand, nav);
main.append(top, view);
app.append(side, main);
document.body.append(app);

// ---- the sidebar ---------------------------------------------------------------------------------

const items = new Map<string, NavItem[]>();
function drawNav() {
  nav.replaceChildren();
  for (const s of SECTIONS) {
    nav.append(Object.assign($("a", "top", s.title), { href: `#/${s.id}`, title: s.about }));
    let group = "";
    for (const it of items.get(s.id) ?? []) {
      if (it.group && it.group !== group) { group = it.group; nav.append($("div", "group", group)); }
      const a = Object.assign($("a", "sub", it.label), { href: it.hash });
      if (it.note) a.append(" ", $("small", "", it.note));
      nav.append(a);
    }
  }
  markCurrent();
}
function markCurrent() {
  const here = location.hash.split("?")[0] || "#/";
  let best: HTMLAnchorElement | null = null;
  for (const a of nav.querySelectorAll<HTMLAnchorElement>("a")) {
    a.removeAttribute("aria-current");
    const h = a.getAttribute("href")!;
    if ((here === h || here.startsWith(h + "/")) && (!best || h.length > best.getAttribute("href")!.length)) best = a;
  }
  best?.setAttribute("aria-current", "page");
}
for (const s of SECTIONS) if (s.nav) Promise.resolve(s.nav()).then(list => { items.set(s.id, list); drawNav(); }, e => console.warn(`nav ${s.id}: ${e.message}`));
drawNav();

// ---- the top bar: gallery-wide settings ------------------------------------------------------------

const crumbs = $("span", "crumbs");
const menu = button("☰", () => app.classList.toggle("open"), undefined, "sections");
menu.className = "menu";
const S = ctx.settings;
top.append(
  menu, crumbs,
  choice<Settings["motion"]>("motion", ["full", "calm", "still"], S.motion, m => ctx.setSettings({ motion: m })),
  toggle("sound", S.sound, on => ctx.setSettings({ sound: on }), "sound on every stage (starts off: a browser wants a tap)"),
  toggle("captions", S.captions, on => ctx.setSettings({ captions: on }), "sound words as bubbles while sound is on"),
  choice<Settings["width"]>("width", ["fit", "390", "1100"], S.width, w => ctx.setSettings({ width: w }), { fit: "fit", "390": "390", "1100": "1100" }),
  choice<Settings["theme"]>("theme", ["auto", "light", "dark"], S.theme, t => ctx.setSettings({ theme: t })),
);

// the top bar's height, for a view's own sticky bars (it wraps on a narrow window)
new ResizeObserver(() => document.documentElement.style.setProperty("--topbar-h", `${top.offsetHeight}px`)).observe(top);

// ---- the view ----------------------------------------------------------------------------------------

let token = 0;
async function show() {
  const route = parseRoute(), mine = ++token;
  ctx.reset(route);
  app.classList.remove("open");
  markCurrent();
  const section = SECTIONS.find(s => s.id === route.section) ?? SECTIONS[0];
  crumbs.textContent = [section.title, ...route.path].join(" · ");
  document.title = route.section || route.path.length ? `${[...route.path].reverse().join(" · ") || section.title} · Sahne` : "Sahne: a paper-theatre stage engine";
  view.replaceChildren($("p", "note", "Loading…"));
  try {
    const v = await section.load();
    if (mine !== token) return;
    view.replaceChildren();
    await v.render(view, ctx);
  } catch (e) {
    if (mine !== token) return;
    console.error(e);
    view.replaceChildren($("h1", "", "This view failed"), $("pre", "log", String((e as Error).stack ?? e)));
  }
  if (mine === token) window.scrollTo(0, 0);
}
// a section changing its own query (Ctx.setQuery) uses replaceState, which fires no hashchange
addEventListener("hashchange", show);
show();
