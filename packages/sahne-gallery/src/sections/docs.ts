// #/docs/<slug>: the repo's own markdown (data.mjs DOCS), rendered: the guide, the engine's README and
// DESIGN.md, the kit's style guide and lists, the story format, the conventions. A link between two docs
// stays here, `?at=<anchor>` scrolls to a heading (`?at=s12` to DESIGN.md §12), and a `sahne` block plays.

import type { Script } from "sahne";
import { $ } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { doc } from "../shell/data.ts";
import { live } from "../shell/live.ts";

export async function render(host: HTMLElement, ctx: Ctx) {
  const d = await doc(ctx.route.path[0] ?? "start");
  const head = $("div", "doc-head");
  const src = Object.assign($("a", "", "View on GitHub"), { href: d.source, target: "_blank", rel: "noopener" });
  head.append($("small", "", `${d.group} · ${d.file} · `), src);
  const article = $("article", "prose");
  // the HTML is the repo's own docs, rendered by data.mjs
  article.innerHTML = d.html;
  host.append(head);
  if (d.toc.length > 6) {
    const toc = $("details", "toc"), list = $("ul");
    toc.append($("summary", "", "On this page"), list);
    for (const t of d.toc) {
      const li = $("li", t.depth === 3 ? "sub" : "");
      li.append(Object.assign($("a", "", t.text), { href: `#/docs/${d.slug}?at=${t.id}` }));
      list.append(li);
    }
    host.append(toc);
  }
  host.append(article);

  for (const el of article.querySelectorAll<HTMLElement>(".sahne-live")) {
    const slot = $("div", "live");
    el.replaceWith(slot);
    try { await live(slot, ctx, JSON.parse(el.dataset.script ?? "") as Script); }
    catch (e) { slot.append($("pre", "log", `This script did not load: ${(e as Error).message}`)); }
  }

  const at = ctx.route.query.get("at");
  if (at) {
    const target = /^s\d+(\.\d+)?$/.test(at) ? article.querySelector(`[data-sec="${at.slice(1)}"]`) : document.getElementById(at);
    // after the shell's scroll to the top
    if (target) setTimeout(() => target.scrollIntoView({ block: "start" }), 0);
  }
}
