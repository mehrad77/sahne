import {
  routeHash
} from "./chunk-3ITRU2RE.js";
import "./chunk-C3Y47KXC.js";
import "./chunk-6PR3AWGB.js";
import "./chunk-GO2IY55S.js";
import "./chunk-3BCF3C4G.js";
import "./chunk-ZT53KTYM.js";
import "./chunk-MK75BOA5.js";
import "./chunk-6IX3XYSS.js";
import {
  $,
  css
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/kit/people.ts
var TABS = { catalogue: "Catalogue", builder: "Builder", studio: "Studio" };
async function render(host, ctx) {
  css("people", `
.ppl-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); margin: 8px 0 12px; overflow-x: auto; scrollbar-width: none; }
.ppl-tabs a { flex: none; padding: 7px 14px 5px; border-bottom: 3px solid transparent; color: var(--mute); font-weight: 600; text-decoration: none; }
.ppl-tabs a:hover { color: var(--ink); }
.ppl-tabs a[aria-current="page"] { color: var(--ink); border-bottom-color: var(--accent); }
`);
  const q = ctx.route.query, tab = Object.keys(TABS).find((t) => t === q.get("tab")) ?? "catalogue";
  host.append(
    $("h1", "", "People"),
    $("p", "note", "The kit's people: the catalogue of every part, face value, colour and pattern (drawn, or planned and coming soon), the builder a learner makes a character with, and the studio, the builder's live preview on its own.")
  );
  const tabs = $("nav", "ppl-tabs");
  tabs.setAttribute("aria-label", "People");
  for (const [t, label] of Object.entries(TABS)) {
    const a = Object.assign($("a", "", label), { href: routeHash(ctx.route.section, ctx.route.path, t === "catalogue" ? {} : { tab: t }) });
    if (t === tab) a.setAttribute("aria-current", "page");
    tabs.append(a);
  }
  const body = $("div");
  host.append(tabs, body);
  if (tab === "catalogue") return (await import("./catalogue-GMGUAAOO.js")).catalogue(body, ctx);
  if (tab === "builder") return (await import("./builder-3NADPRJ7.js")).builder(body, ctx);
  return (await import("./studio-WUSR67IQ.js")).studio(body, ctx);
}
export {
  render
};
//# sourceMappingURL=people-MXPEO7YT.js.map
