// #/kit/people: the people of the kit, in three tabs (`?tab=`): the catalogue (every part, face value,
// colour and pattern, drawn or planned), the builder (the engine's `mountBuilder` with the host's
// switches) and the studio (the builder's live preview alone: looks, moods, gestures, turn, framings).
// Each tab is a link, so switching frees the last tab's stages.

import { $, css } from "../shell/dom.ts";
import { routeHash, type Ctx } from "../shell/ctx.ts";

const TABS = { catalogue: "Catalogue", builder: "Builder", studio: "Studio" } as const;
type Tab = keyof typeof TABS;

export async function render(host: HTMLElement, ctx: Ctx) {
  css("people", `
.ppl-tabs { display: flex; gap: 2px; border-bottom: 1px solid var(--line); margin: 8px 0 12px; overflow-x: auto; scrollbar-width: none; }
.ppl-tabs a { flex: none; padding: 7px 14px 5px; border-bottom: 3px solid transparent; color: var(--mute); font-weight: 600; text-decoration: none; }
.ppl-tabs a:hover { color: var(--ink); }
.ppl-tabs a[aria-current="page"] { color: var(--ink); border-bottom-color: var(--accent); }
`);
  const q = ctx.route.query, tab: Tab = (Object.keys(TABS) as Tab[]).find(t => t === q.get("tab")) ?? "catalogue";
  host.append(
    $("h1", "", "People"),
    $("p", "note", "The kit's people: the catalogue of every part, face value, colour and pattern (drawn, or planned and coming soon), the builder a learner makes a character with, and the studio, the builder's live preview on its own."),
  );
  const tabs = $("nav", "ppl-tabs");
  tabs.setAttribute("aria-label", "People");
  for (const [t, label] of Object.entries(TABS) as [Tab, string][]) {
    const a = Object.assign($("a", "", label), { href: routeHash(ctx.route.section, ctx.route.path, t === "catalogue" ? {} : { tab: t }) });
    if (t === tab) a.setAttribute("aria-current", "page");
    tabs.append(a);
  }
  const body = $("div");
  host.append(tabs, body);
  if (tab === "catalogue") return (await import("./people/catalogue.ts")).catalogue(body, ctx);
  if (tab === "builder") return (await import("./people/builder.ts")).builder(body, ctx);
  return (await import("./people/studio.ts")).studio(body, ctx);
}
