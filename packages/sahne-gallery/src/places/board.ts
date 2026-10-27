// #/places: every site the A1 stories use (Kumru's STORIES_WORLD.md §2), with the places the briefs
// split it into (needs.json) and the place documents built so far: each place's status, its standard
// at a glance and its wide shot.
import { $, chip, choice, link } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { board, needsFor, placeThumb, placesOfSite, problems, ruleChips, type Doc } from "./common.ts";

export async function render(host: HTMLElement, ctx: Ctx) {
  const b = await board(ctx);
  const sites = b.world.filter(w => !w.placeholder), placeholders = b.world.filter(w => w.placeholder);
  const all = sites.flatMap(s => placesOfSite(b, s.id));
  const built = all.filter(id => b.docs.some(d => d.id === id && !d.placeholder));
  const pct = all.length ? Math.round(100 * built.length / all.length) : 0;
  const meter = $("div", "meter"), fill = $("i");
  fill.style.width = `${pct}%`;
  meter.append(fill);
  host.append(
    $("h1", "", "Places"),
    $("p", "note", `The ${sites.length} sites of the A1 stories and the ${all.length} places the briefs split them into. A place is finished when it meets the standard: the chips are lintPlace's rules; open a place to scout it, see its standard in full, its needs, its contact sheet and its camera check. A new place document ($SAHNE_CONTENT/places/) shows here after a reload.`),
    $("h2", "", `${built.length} of ${all.length} built to the standard's start (${pct}%)`), meter,
  );
  const show = (ctx.route.query.get("show") ?? "all") as "all" | "built" | "todo";
  host.append(choice("show", ["all", "built", "todo"], show, v => { ctx.setQuery({ show: v === "all" ? null : v }); draw(v); }, { all: "every site", built: "with a place built", todo: "nothing built yet" }));
  const out = $("div");
  host.append(out);

  const placeRow = (id: string) => {
    const doc = b.docs.find(d => d.id === id) as Doc | undefined, n = needsFor(b, id);
    const row = $("div", "placerow");
    const title = $("div");
    title.append(doc ? link(id, `#/places/${id}`) : $("b", "", id), " ", doc ? (doc.placeholder ? chip("placeholder", "ph", doc.placeholder) : chip("built", "ok")) : chip("planned"));
    if (n) title.append($("small", "note", ` ${n.place.why}`));
    row.append(title);
    if (doc) row.append(ruleChips(problems(b, doc, ctx)));
    return row;
  };

  function draw(which: string) {
    out.replaceChildren();
    const grid = $("div", "sites");
    for (const s of sites) {
      const ids = placesOfSite(b, s.id), docs = ids.map(id => b.docs.find(d => d.id === id)).filter(Boolean) as Doc[];
      if (which === "built" && !docs.length) continue;
      if (which === "todo" && docs.length) continue;
      const card = $("article", "card site");
      const art = $("div", "art");
      if (docs[0]) {
        art.append($("span", "note", "drawing…"));
        placeThumb(ctx, docs[0]).then(url => { if (url) art.replaceChildren(Object.assign($("img"), { src: url, alt: docs[0].id })); });
      }
      const h = $("h3", "", `${s.place} `);
      h.append(chip(s.id));
      card.append(art, h, $("p", "note", `${s.district}${s.stories && s.stories !== "—" ? ` · ${s.stories}` : ""}`));
      for (const id of ids) card.append(placeRow(id));
      if (s.link) card.append(Object.assign($("a", "", "map ↗"), { href: s.link, target: "_blank", rel: "noopener noreferrer" }));
      grid.append(card);
    }
    out.append(grid);
    if (which === "all") {
      out.append($("h2", "", `Test benches · ${b.benches.length}`), $("p", "note", "The gallery's own test places (src/bench.ts): sets composed from kit pieces to try a family or an engine feature (a Feriköy street, a flat, a classroom, a shore, a taxi, a party, a crowd, a roof at night). Not story places; the system demos stand on them."));
      const grid = $("div", "sites");
      for (const d of b.benches) {
        const card = $("a", "card site");
        card.href = `#/places/${d.id}`;
        card.style.color = "inherit"; card.style.textDecoration = "none";
        const art = $("div", "art");
        placeThumb(ctx, d).then(url => { if (url) art.replaceChildren(Object.assign($("img"), { src: url, alt: d.id })); });
        const h = $("h3", "", `${d.name?.en ?? d.id} `);
        h.append(chip(d.id));
        card.append(art, h, $("p", "note", `${d.pieces.length} pieces · ${Object.keys(d.props ?? {}).length} props${Object.keys(d.states ?? {}).length ? ` · states ${Object.keys(d.states ?? {}).join(", ")}` : ""}`));
        grid.append(card);
      }
      out.append(grid);
    }
    if (which !== "built" && placeholders.length) {
      out.append($("h2", "", `Placeholders · ${placeholders.length}`), $("p", "note", "Sites kept for a later story (Kumru's STORIES_WORLD.md §2): not built yet."));
      const ul = $("ul");
      for (const p of placeholders) ul.append($("li", "", `${p.place} (${p.id}) · ${p.notes}`));
      out.append(ul);
    }
  }
  draw(show);
}
