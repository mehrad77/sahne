// #/docs/<slug> (and #/new, #/get-started): the repo's own markdown (data.mjs DOCS), rendered: the guide, the engine's README and
// DESIGN.md, the kit's style guide and lists, the story format, the conventions. A link between two docs
// stays here, `?at=<anchor>` scrolls to a heading (`?at=s12` to DESIGN.md §12), a `sahne` block plays, and a
// `mermaid` block is drawn.

import type { Script } from "sahne";
import { $ } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { doc } from "../shell/data.ts";
import { live } from "../shell/live.ts";

export async function render(host: HTMLElement, ctx: Ctx) {
  // #/new and #/get-started are docs with a section of their own
  const d = await doc(ctx.route.section === "docs" ? ctx.route.path[0] ?? "overview" : ctx.route.section);
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

  // a mermaid block becomes its diagram, in the page's colours; mermaid is loaded only for a doc that has one
  const diagrams = [...article.querySelectorAll<HTMLElement>("pre.mermaid")];
  if (diagrams.length) {
    const { default: mermaid } = await import("mermaid");
    const css = getComputedStyle(document.documentElement), v = (name: string) => css.getPropertyValue(name).trim();
    mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: "base", fontFamily: "system-ui, -apple-system, sans-serif", themeVariables: {
      background: v("--bg"), primaryColor: v("--chip"), primaryTextColor: v("--ink"), primaryBorderColor: v("--line"),
      lineColor: v("--mute"), secondaryColor: v("--side"), tertiaryColor: v("--side"), clusterBkg: v("--side"), clusterBorder: v("--line"),
      edgeLabelBackground: v("--bg"), titleColor: v("--ink"), fontSize: "16px",
    }, flowchart: { nodeSpacing: 22, rankSpacing: 34, padding: 10, wrappingWidth: 240 } });
    try { await mermaid.run({ nodes: diagrams }); }
    catch (e) { console.warn(`a diagram did not draw: ${(e as Error).message}`); }
  }

  const at = ctx.route.query.get("at");
  if (at) {
    const target = /^s\d+(\.\d+)?$/.test(at) ? article.querySelector(`[data-sec="${at.slice(1)}"]`) : document.getElementById(at);
    // after the shell's scroll to the top
    if (target) setTimeout(() => target.scrollIntoView({ block: "start" }), 0);
  }
}
