// #/systems: the list of the engine's systems, and #/systems/<id>: one system's demo.

import { $, chip, head, link } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { SYSTEMS } from "./registry.ts";

export async function render(host: HTMLElement, ctx: Ctx) {
  const id = ctx.route.path[0];
  const demo = SYSTEMS.find(s => s.id === id);
  if (!demo) {
    host.append($("h1", "", "Systems"), $("p", "note", "Everything the engine does, one live demo per system, grouped as the engine is (DESIGN.md). Every demo follows the top bar: motion, sound, captions and the stage width."));
    for (const g of [...new Set(SYSTEMS.map(s => s.group))]) {
      host.append($("h2", "", g));
      const cards = $("div", "cards");
      for (const s of SYSTEMS.filter(s => s.group === g)) {
        const a = link("", `#/systems/${s.id}`);
        a.className = "card";
        const b = $("b", "", s.title + " ");
        b.append(...s.design.map(d => chip(d)));
        a.append(b, $("small", "", s.about));
        cards.append(a);
      }
      host.append(cards);
    }
    return;
  }
  host.append(head(demo.title, demo.about, demo.design.join(" ")));
  await (await demo.load()).build(host, ctx);
}
