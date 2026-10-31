import {
  FEATURES,
  asked,
  generators,
  pieceSvg,
  usage
} from "./chunk-4CDJ6GQX.js";
import {
  cancelThumbs,
  clearThumbs,
  thumb
} from "./chunk-D3OMKUXF.js";
import "./chunk-YGBM7NGP.js";
import "./chunk-CMLP3XCI.js";
import "./chunk-6PR3AWGB.js";
import "./chunk-GO2IY55S.js";
import "./chunk-3BCF3C4G.js";
import "./chunk-ZT53KTYM.js";
import "./chunk-DDNHNEH6.js";
import "./chunk-6IX3XYSS.js";
import {
  $,
  bar,
  chip,
  choice,
  select,
  toggle
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/kit/set-view.ts
async function render(host, ctx) {
  const q = ctx.route.query, gens = generators();
  const [places, needs, cards] = await Promise.all([ctx.data("places").catch(() => []), ctx.data("needs").catch(() => ({})), ctx.data("cards").catch(() => ({}))]);
  const used = usage(places), wanted = asked(needs);
  const word = (id) => cards?.[id]?.tr ?? "";
  const families = [...new Set(gens.map((g) => g.family))];
  const variantCount = gens.reduce((n, g) => n + g.variants.length, 0);
  host.append(
    $("h1", "", "Set and props"),
    $("p", "note", `${gens.length} generators in ${families.length} families, with ${variantCount} named variants. Each one draws every look of a thing through its params (its meta says which); a place picks one with a variant or its own params. Open one to see it live, with its params as controls, beside a 170 cm figure. Drawn by the stage; an SVG sketch shows until a tile is baked.`)
  );
  const state = {
    q: q.get("q") ?? "",
    family: q.get("family") ?? "all",
    kind: q.get("kind") ?? "all",
    feature: q.get("feature") ?? "all",
    use: q.get("use") ?? "all",
    variants: q.get("variants") === "1",
    look: q.get("look") ?? "stage"
  };
  const set = (k, v) => {
    state[k] = v;
    ctx.setQuery({ [k]: v === "all" || v === "" || v === false || k === "look" && v === "stage" ? null : v === true ? "1" : v });
    draw();
  };
  const search = Object.assign($("input"), { type: "search", placeholder: "id, words, Turkish\u2026", value: state.q });
  search.oninput = () => set("q", search.value.trim());
  host.append(
    bar(
      "find",
      search,
      select("", [["all", "every family"], ...families.map((f) => [f, f])], state.family, (v) => set("family", v)),
      select("", [["all", "pieces and props"], ["piece", "set pieces"], ["prop", "props"]], state.kind, (v) => set("kind", v)),
      select("", [["all", "anything"], ...Object.entries(FEATURES)], state.feature, (v) => set("feature", v)),
      select("", [["all", "used or not"], ["used", "in a place"], ["asked", "asked by a brief"], ["unused", "in no place"]], state.use, (v) => set("use", v))
    ),
    bar(
      "show",
      toggle("every variant", state.variants, (on) => set("variants", on), "a tile per named look"),
      choice("", ["stage", "svg"], state.look, (v) => set("look", v), { stage: "drawn by the stage", svg: "SVG sketch" }),
      Object.assign($("button", "", "re-bake"), { type: "button", title: "forget the baked thumbnails (after a drawing changed in a helper)", onclick: async () => {
        await clearThumbs();
        draw();
      } })
    )
  );
  const count = $("p", "note"), out = $("div");
  host.append(count, out);
  const io = new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) {
      io.unobserve(e.target);
      e.target.bake?.();
    }
  }, { rootMargin: "200px" });
  ctx.cleanup(() => {
    io.disconnect();
    cancelThumbs();
  });
  const matches = (g) => {
    if (state.family !== "all" && g.family !== state.family) return false;
    if (state.kind !== "all" && g.kind !== state.kind && g.kind !== "both") return false;
    if (state.feature !== "all" && !g.features.has(state.feature)) return false;
    if (state.use === "used" && !used.has(g.id)) return false;
    if (state.use === "unused" && used.has(g.id)) return false;
    if (state.use === "asked" && !wanted.has(g.id)) return false;
    if (state.q) {
      const hay = [g.id, g.family, g.meta?.about ?? "", ...g.variants, ...g.meta?.tags ?? [], ...(g.meta?.terms ?? []).map(word), ...(wanted.get(g.id) ?? []).flatMap((a) => [a.name, ...a.terms.map(word)])].join(" ").toLocaleLowerCase("tr");
      if (!state.q.toLocaleLowerCase("tr").split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  };
  function tile(g, variant) {
    const params = variant ? { variant } : {}, asProp = g.kind === "prop";
    const a = $("a", "tile");
    a.href = `#/kit/set/${g.id}${variant ? `?variant=${variant}` : ""}`;
    const art = $("div", "art");
    const sketch = () => {
      try {
        art.innerHTML = pieceSvg(ctx.kit, g.def, { ...asProp ? { n: 1 } : {}, ...params }, `${g.id}/a`, 130) || "<i>no flats</i>";
      } catch (e) {
        art.textContent = e.message;
      }
    };
    sketch();
    if (state.look === "stage") Object.assign(a, { bake: () => thumb(ctx, g, { as: asProp ? "prop" : "piece", params, seed: "a", figure: false, ground: "floor" }).then((url) => {
      if (url) art.replaceChildren(Object.assign($("img"), { src: url, alt: g.id }));
    }) });
    const cap = $("div", "cap");
    cap.append($("b", "", variant ? `${g.id} \xB7 ${variant}` : g.id));
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
      const mine = list.filter((g) => g.family === f);
      if (!mine.length) continue;
      out.append($("h2", "", `${f} \xB7 ${mine.length}`));
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
export {
  render
};
//# sourceMappingURL=set-view-2OYHJ5GV.js.map
