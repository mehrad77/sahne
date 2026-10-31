import {
  SYSTEMS
} from "./chunk-IM3DRBND.js";
import {
  $,
  chip,
  head,
  link
} from "./chunk-4TGKXDN4.js";
import "./chunk-PZ5AY32C.js";

// src/systems/view.ts
async function render(host, ctx) {
  const id = ctx.route.path[0];
  const demo = SYSTEMS.find((s) => s.id === id);
  if (!demo) {
    host.append($("h1", "", "Systems"), $("p", "note", "Everything the engine does, one live demo per system, grouped as the engine is (DESIGN.md). Every demo follows the top bar: motion, sound, captions and the stage width."));
    for (const g of [...new Set(SYSTEMS.map((s) => s.group))]) {
      host.append($("h2", "", g));
      const cards = $("div", "cards");
      for (const s of SYSTEMS.filter((s2) => s2.group === g)) {
        const a = link("", `#/systems/${s.id}`);
        a.className = "card";
        const b = $("b", "", s.title + " ");
        b.append(...s.design.map((d) => chip(d)));
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
export {
  render
};
//# sourceMappingURL=view-M4SB7QMD.js.map
