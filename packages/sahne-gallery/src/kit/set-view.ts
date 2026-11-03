// #/kit/set: every set piece and prop, by family, filtered by what it is and does, who uses it and who
// asks for it. Each tile is drawn by the stage (baked once, shell/thumbs.ts) with an SVG sketch until
// then, and opens the piece's inspector.

import { $, bar, chip, choice, select, toggle } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { pieceSvg } from "sahne-kit/set-svg";
import { thumb, cancelThumbs, clearThumbs } from "../shell/thumbs.ts";
import { generators, usage, asked, FEATURES, type Feature, type Gen } from "./catalog.ts";

export async function render(host: HTMLElement, ctx: Ctx) {
  const q = ctx.route.query, gens = generators();
  const [places, needs, cards] = await Promise.all([ctx.data("places").catch(() => []), ctx.data("needs").catch(() => ({})), ctx.data("cards").catch(() => ({}))]);
  const used = usage(places), wanted = asked(needs);
  const word = (id: string) => (cards as Record<string, { tr: string }> | null)?.[id]?.tr ?? "";
  const families = [...new Set(gens.map(g => g.family))];
  const variantCount = gens.reduce((n, g) => n + g.variants.length, 0);

  host.append(
    $("h1", "", "Set and props"),
    $("p", "note", `${gens.length} generators in ${families.length} families, with ${variantCount} named variants. Each one draws every look of a thing through its params (its meta says which); a place picks one with a variant or its own params. Open one to see it live, with its params as controls, beside a 170 cm figure. Drawn by the stage; an SVG sketch shows until a tile is baked.`),
  );

  // the filters, kept in the URL
  const state = {
    q: q.get("q") ?? "", family: q.get("family") ?? "all", kind: q.get("kind") ?? "all", feature: q.get("feature") ?? "all",
    use: q.get("use") ?? "all", variants: q.get("variants") === "1", look: q.get("look") ?? "stage",
  };
  const set = (k: keyof typeof state, v: string | boolean) => { (state as Record<string, unknown>)[k] = v; ctx.setQuery({ [k]: v === "all" || v === "" || v === false || (k === "look" && v === "stage") ? null : v === true ? "1" : v }); draw(); };
  const search = Object.assign($("input"), { type: "search", placeholder: "id, words, Turkish…", value: state.q });
  search.oninput = () => set("q", search.value.trim());
  host.append(
    bar("find", search,
      select("", [["all", "every family"], ...families.map(f => [f, f] as [string, string])], state.family, v => set("family", v)),
      select("", [["all", "pieces and props"], ["piece", "set pieces"], ["prop", "props"]], state.kind, v => set("kind", v)),
      select("", [["all", "anything"], ...Object.entries(FEATURES)], state.feature, v => set("feature", v)),
      select("", [["all", "used or not"], ["used", "in a place"], ["asked", "asked by a brief"], ["unused", "in no place"]], state.use, v => set("use", v)),
    ),
    bar("show",
      toggle("every variant", state.variants, on => set("variants", on), "a tile per named look"),
      choice("", ["stage", "svg"], state.look as "stage" | "svg", v => set("look", v), { stage: "drawn by the stage", svg: "SVG sketch" }),
      Object.assign($("button", "", "re-bake"), { type: "button", title: "forget the baked thumbnails (after a drawing changed in a helper)", onclick: async () => { await clearThumbs(); draw(); } }),
    ),
  );
  const count = $("p", "note"), out = $("div");
  host.append(count, out);

  const io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); (e.target as HTMLElement & { bake?: () => void }).bake?.(); }
  }, { rootMargin: "200px" });
  ctx.cleanup(() => { io.disconnect(); cancelThumbs(); });

  const matches = (g: Gen) => {
    if (state.family !== "all" && g.family !== state.family) return false;
    if (state.kind !== "all" && g.kind !== state.kind && g.kind !== "both") return false;
    if (state.feature !== "all" && !g.features.has(state.feature as Feature)) return false;
    if (state.use === "used" && !used.has(g.id)) return false;
    if (state.use === "unused" && used.has(g.id)) return false;
    if (state.use === "asked" && !wanted.has(g.id)) return false;
    if (state.q) {
      const hay = [g.id, g.family, g.meta?.about ?? "", ...g.variants, ...(g.meta?.tags ?? []), ...(g.meta?.terms ?? []).map(word), ...(wanted.get(g.id) ?? []).flatMap(a => [a.name, ...a.terms.map(word)])].join(" ").toLocaleLowerCase("tr");
      if (!state.q.toLocaleLowerCase("tr").split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  };

  function tile(g: Gen, variant?: string) {
    const params = variant ? { variant } : {}, asProp = g.kind === "prop";
    const a = $("a", "tile");
    a.href = `#/kit/set/${g.id}${variant ? `?variant=${variant}` : ""}`;
    const art = $("div", "art");
    const sketch = () => { try { art.innerHTML = pieceSvg(ctx.kit, g.def, { ...(asProp ? { n: 1 } : {}), ...params }, `${g.id}/a`, 130) || "<i>no flats</i>"; } catch (e) { art.textContent = (e as Error).message; } };
    sketch();
    if (state.look === "stage") Object.assign(a, { bake: () => thumb(ctx, g, { as: asProp ? "prop" : "piece", params, seed: "a", figure: false, ground: "floor" }).then(url => { if (url) art.replaceChildren(Object.assign($("img"), { src: url, alt: g.id })); }) });
    const cap = $("div", "cap");
    cap.append($("b", "", variant ? `${g.id} · ${variant}` : g.id));
    const tags = $("span");
    if (!variant) tags.append(chip(g.family), " ");
    if (g.kind !== "piece") tags.append(chip(g.kind === "both" ? "piece+prop" : "prop"), " ");
    if (used.has(g.id)) tags.append(chip("used", "ok"), " ");
    else if (wanted.has(g.id)) tags.append(chip("asked", "warn"), " ");
    cap.append(tags);
    a.append(art, cap);
    if (!variant && g.meta?.about) a.title = g.meta.about;
    io.observe(a);
    return a;
  }

  function draw() {
    cancelThumbs();
    out.replaceChildren();
    const list = gens.filter(matches);
    count.textContent = `${list.length} of ${gens.length}`;
    for (const f of families) {
      const mine = list.filter(g => g.family === f);
      if (!mine.length) continue;
      out.append($("h2", "", `${f} · ${mine.length}`));
      const grid = $("div", "grid");
      for (const g of mine) {
        grid.append(tile(g));
        if (state.variants) for (const v of g.variants) grid.append(tile(g, v));
      }
      out.append(grid);
    }
  }
  draw();
}
