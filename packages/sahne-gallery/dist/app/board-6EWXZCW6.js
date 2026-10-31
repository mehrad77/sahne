import {
  board,
  needsFor,
  placeThumb,
  placesOfSite,
  problems,
  ruleChips
} from "./chunk-KWJRLNB2.js";
import "./chunk-GM3QXWFH.js";
import "./chunk-6JPAPIMW.js";
import "./chunk-6S7WIXPA.js";
import "./chunk-C3Y47KXC.js";
import "./chunk-6PR3AWGB.js";
import "./chunk-GO2IY55S.js";
import "./chunk-3BCF3C4G.js";
import "./chunk-ZT53KTYM.js";
import "./chunk-MK75BOA5.js";
import "./chunk-6IX3XYSS.js";
import "./chunk-J3KVAIQI.js";
import {
  $,
  chip,
  choice,
  link
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/places/board.ts
async function render(host, ctx) {
  const b = await board(ctx);
  const sites = b.world.filter((w) => !w.placeholder), placeholders = b.world.filter((w) => w.placeholder);
  const all = sites.flatMap((s) => placesOfSite(b, s.id));
  const built = all.filter((id) => b.docs.some((d) => d.id === id && !d.placeholder));
  const pct = all.length ? Math.round(100 * built.length / all.length) : 0;
  const meter = $("div", "meter"), fill = $("i");
  fill.style.width = `${pct}%`;
  meter.append(fill);
  host.append(
    $("h1", "", "Places"),
    $("p", "note", `The ${sites.length} sites of the A1 stories and the ${all.length} places the briefs split them into. A place is finished when it meets the standard: the chips are lintPlace's rules; open a place to scout it, see its standard in full, its needs, its contact sheet and its camera check. A new place document ($SAHNE_CONTENT/places/) shows here after a reload.`),
    $("h2", "", `${built.length} of ${all.length} built to the standard's start (${pct}%)`),
    meter
  );
  const show = ctx.route.query.get("show") ?? "all";
  host.append(choice("show", ["all", "built", "todo"], show, (v) => {
    ctx.setQuery({ show: v === "all" ? null : v });
    draw(v);
  }, { all: "every site", built: "with a place built", todo: "nothing built yet" }));
  const out = $("div");
  host.append(out);
  const placeRow = (id) => {
    const doc = b.docs.find((d) => d.id === id), n = needsFor(b, id);
    const row = $("div", "placerow");
    const title = $("div");
    title.append(doc ? link(id, `#/places/${id}`) : $("b", "", id), " ", doc ? doc.placeholder ? chip("placeholder", "ph", doc.placeholder) : chip("built", "ok") : chip("planned"));
    if (n) title.append($("small", "note", ` ${n.place.why}`));
    row.append(title);
    if (doc) row.append(ruleChips(problems(b, doc, ctx)));
    return row;
  };
  function draw(which) {
    out.replaceChildren();
    const grid = $("div", "sites");
    for (const s of sites) {
      const ids = placesOfSite(b, s.id), docs = ids.map((id) => b.docs.find((d) => d.id === id)).filter(Boolean);
      if (which === "built" && !docs.length) continue;
      if (which === "todo" && docs.length) continue;
      const card = $("article", "card site");
      const art = $("div", "art");
      if (docs[0]) {
        art.append($("span", "note", "drawing\u2026"));
        placeThumb(ctx, docs[0]).then((url) => {
          if (url) art.replaceChildren(Object.assign($("img"), { src: url, alt: docs[0].id }));
        });
      }
      const h = $("h3", "", `${s.place} `);
      h.append(chip(s.id));
      card.append(art, h, $("p", "note", `${s.district}${s.stories && s.stories !== "\u2014" ? ` \xB7 ${s.stories}` : ""}`));
      for (const id of ids) card.append(placeRow(id));
      if (s.link) card.append(Object.assign($("a", "", "map \u2197"), { href: s.link, target: "_blank", rel: "noopener noreferrer" }));
      grid.append(card);
    }
    out.append(grid);
    if (which === "all") {
      out.append($("h2", "", `Test benches \xB7 ${b.benches.length}`), $("p", "note", "The gallery's own test places (src/bench.ts): sets composed from kit pieces to try a family or an engine feature (a Ferik\xF6y street, a flat, a classroom, a shore, a taxi, a party, a crowd, a roof at night). Not story places; the system demos stand on them."));
      const grid2 = $("div", "sites");
      for (const d of b.benches) {
        const card = $("a", "card site");
        card.href = `#/places/${d.id}`;
        card.style.color = "inherit";
        card.style.textDecoration = "none";
        const art = $("div", "art");
        placeThumb(ctx, d).then((url) => {
          if (url) art.replaceChildren(Object.assign($("img"), { src: url, alt: d.id }));
        });
        const h = $("h3", "", `${d.name?.en ?? d.id} `);
        h.append(chip(d.id));
        card.append(art, h, $("p", "note", `${d.pieces.length} pieces \xB7 ${Object.keys(d.props ?? {}).length} props${Object.keys(d.states ?? {}).length ? ` \xB7 states ${Object.keys(d.states ?? {}).join(", ")}` : ""}`));
        grid2.append(card);
      }
      out.append(grid2);
    }
    if (which !== "built" && placeholders.length) {
      out.append($("h2", "", `Placeholders \xB7 ${placeholders.length}`), $("p", "note", "Sites kept for a later story (Kumru's STORIES_WORLD.md \xA72): not built yet."));
      const ul = $("ul");
      for (const p of placeholders) ul.append($("li", "", `${p.place} (${p.id}) \xB7 ${p.notes}`));
      out.append(ul);
    }
  }
  draw(show);
}
export {
  render
};
//# sourceMappingURL=board-6EWXZCW6.js.map
