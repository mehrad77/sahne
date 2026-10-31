import {
  live
} from "./chunk-7NDFZUS2.js";
import "./chunk-WB6XEHS3.js";
import "./chunk-D3OMKUXF.js";
import "./chunk-6JPAPIMW.js";
import "./chunk-YGBM7NGP.js";
import "./chunk-CMLP3XCI.js";
import {
  doc
} from "./chunk-6PR3AWGB.js";
import "./chunk-GO2IY55S.js";
import "./chunk-3BCF3C4G.js";
import "./chunk-ZT53KTYM.js";
import "./chunk-DDNHNEH6.js";
import "./chunk-6IX3XYSS.js";
import "./chunk-VFMRH5SO.js";
import "./chunk-J3KVAIQI.js";
import {
  $
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/sections/docs.ts
async function render(host, ctx) {
  const d = await doc(ctx.route.path[0] ?? "start");
  const head = $("div", "doc-head");
  const src = Object.assign($("a", "", "View on GitHub"), { href: d.source, target: "_blank", rel: "noopener" });
  head.append($("small", "", `${d.group} \xB7 ${d.file} \xB7 `), src);
  const article = $("article", "prose");
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
  for (const el of article.querySelectorAll(".sahne-live")) {
    const slot = $("div", "live");
    el.replaceWith(slot);
    try {
      await live(slot, ctx, JSON.parse(el.dataset.script ?? ""));
    } catch (e) {
      slot.append($("pre", "log", `This script did not load: ${e.message}`));
    }
  }
  const at = ctx.route.query.get("at");
  if (at) {
    const target = /^s\d+(\.\d+)?$/.test(at) ? article.querySelector(`[data-sec="${at.slice(1)}"]`) : document.getElementById(at);
    if (target) setTimeout(() => target.scrollIntoView({ block: "start" }), 0);
  }
}
export {
  render
};
//# sourceMappingURL=docs-TWLVUSLB.js.map
