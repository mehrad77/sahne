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
const brand = Object.assign($("a", "brand"), { href: "#/" });
brand.setAttribute("aria-label", "sahne gallery");
brand.append($("span", "lockup"), $("small", "", "a paper-theatre stage engine: demos and docs"));
const nav = $("nav");
nav.setAttribute("aria-label", "Gallery");
side.append(brand, nav);
main.append(top, view);
app.append(side, main);
document.body.append(app);

// ---- the sidebar ---------------------------------------------------------------------------------

const items = new Map<string, NavItem[]>();
// the why-and-how sections first; the workshop's pages folded under Explore, open while one of them shows
const explore = $("details", "explore");
explore.append($("summary", "", "Explore"));
function drawNav() {
  nav.replaceChildren();
  for (const el of [...explore.children].slice(1)) el.remove();
  for (const s of SECTIONS) {
    const into = s.explore ? explore : nav;
    into.append(Object.assign($("a", "top", s.title), { href: `#/${s.id}`, title: s.about }));
    // a section's own list shows while the section does
    const subs = Object.assign($("div", "subs"), { hidden: true });
    subs.dataset.section = s.id;
    let group = "";
    for (const it of items.get(s.id) ?? []) {
      if (it.group && it.group !== group) { group = it.group; subs.append($("div", "group", group)); }
      const a = Object.assign($("a", "sub", it.label), { href: it.hash });
      if (it.note) a.append(" ", $("small", "", it.note));
      subs.append(a);
    }
    into.append(subs);
  }
  nav.append(explore);
  markCurrent();
}
function markCurrent() {
  const here = location.hash.split("?")[0] || "#/";
  const section = here.slice(2).split("/")[0];
  for (const d of nav.querySelectorAll<HTMLElement>(".subs")) d.hidden = d.dataset.section !== section;
  let best: HTMLAnchorElement | null = null;
  for (const a of nav.querySelectorAll<HTMLAnchorElement>("a")) {
    a.removeAttribute("aria-current");
    const h = a.getAttribute("href")!;
    if ((here === h || here.startsWith(h + "/")) && (!best || h.length > best.getAttribute("href")!.length)) best = a;
  }
  best?.setAttribute("aria-current", "page");
  if (best && explore.contains(best)) explore.open = true;
}
for (const s of SECTIONS) if (s.nav) Promise.resolve(s.nav()).then(list => { items.set(s.id, list); drawNav(); }, e => console.warn(`nav ${s.id}: ${e.message}`));
drawNav();

// ---- the top bar: sound, and the gallery-wide settings in a menu ------------------------------------------------------------

const crumbs = $("span", "crumbs");
// ☰ opens the sidebar over the page on a narrow window, and folds it away on a wide one (kept in this browser)
const narrow = matchMedia("(max-width: 860px)");
const folded = (() => { try { return localStorage.getItem("gallery:side") === "folded"; } catch { return false; } })();
app.classList.toggle("folded", folded);
const menu = button("☰", () => {
  if (narrow.matches) { app.classList.toggle("open"); return; }
  const on = app.classList.toggle("folded");
  try { localStorage.setItem("gallery:side", on ? "folded" : "open"); } catch { /* kept for this visit only */ }
}, undefined, "show or hide the sections");
menu.className = "menu";
const S = ctx.settings;
// sound is the one setting a newcomer wants at hand; the rest wait in a menu
const more = $("details", "settings"), panel = $("div", "panel");
more.append(Object.assign($("summary", "", "Settings"), { title: "Motion, captions, the stage's width, the theme" }), panel);
panel.append(
  choice<Settings["motion"]>("motion", ["full", "calm", "still"], S.motion, m => ctx.setSettings({ motion: m })),
  toggle("captions", S.captions, on => ctx.setSettings({ captions: on }), "sound words as bubbles while sound is on"),
  choice<Settings["width"]>("width", ["fit", "390", "1100"], S.width, w => ctx.setSettings({ width: w }), { fit: "fit", "390": "390", "1100": "1100" }),
  choice<Settings["theme"]>("theme", ["auto", "light", "dark"], S.theme, t => ctx.setSettings({ theme: t })),
);
addEventListener("pointerdown", e => { if (more.open && !more.contains(e.target as Node)) more.open = false; });
addEventListener("keydown", e => { if (e.key === "Escape") more.open = false; });
top.append(menu, crumbs, toggle("sound", S.sound, on => ctx.setSettings({ sound: on }), "sound on every stage (starts off: a browser wants a tap)"), more);

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
