import {
  snapshot
} from "./chunk-GM3QXWFH.js";
import {
  PLACE_RULES,
  lintPlace,
  needsOf
} from "./chunk-6JPAPIMW.js";
import {
  bench_exports
} from "./chunk-J3KVAIQI.js";
import {
  $,
  chip
} from "./chunk-4TGKXDN4.js";
import {
  hashString
} from "./chunk-BLASJ6YA.js";

// src/places/common.ts
var BENCH_DOCS = Object.values(bench_exports);
async function board(ctx) {
  const [docs, world, needs, cards] = await Promise.all([ctx.data("places"), ctx.data("world").catch(() => []), ctx.data("needs").catch(() => ({})), ctx.data("cards").catch(() => ({}))]);
  return { docs, benches: BENCH_DOCS, world, needs, cards };
}
var problems = (b, doc, ctx) => lintPlace(doc, { kit: ctx.kit, cards: b.cards, needs: b.needs });
function ruleChips(ps) {
  const s = $("span", "rules");
  for (const r of PLACE_RULES) {
    const mine = ps.filter((p) => p.rule === r), err = mine.some((p) => p.level === "error");
    s.append(chip(`${r} ${err ? "\u2717" : mine.length ? "!" : "\u2713"}`, err ? "bad" : mine.length ? "warn" : "ok", mine.map((p) => p.message).join("\n")), " ");
  }
  return s;
}
function placesOfSite(b, site) {
  const asked = Object.keys(b.needs[site]?.places ?? {});
  const built = b.docs.filter((d) => (d.site ?? d.id) === site).map((d) => d.id);
  return [.../* @__PURE__ */ new Set([...asked, ...built])];
}
var needsFor = (b, id) => needsOf(b.needs, id);
function placeThumb(ctx, doc) {
  return snapshot(ctx, `place|${hashString(JSON.stringify(doc))}`, doc.id, () => ({ place: doc, cues: [{ scene: { place: doc.id, time: doc.times?.[0] ?? "day", at: {}, cam: "wide" } }], cast: {} }));
}

export {
  BENCH_DOCS,
  board,
  problems,
  ruleChips,
  placesOfSite,
  needsFor,
  placeThumb
};
//# sourceMappingURL=chunk-KWJRLNB2.js.map
