// #/: what Sahne is, what the gallery holds (counted from the kit, the engine and the data, so it is
// always current), how much of the engine has a demo, and what changed for the owner to check.

import { CUE_KINDS, STAGING_FIELDS, TIMES, WEATHER, type PieceDef } from "sahne";
import { $, chip, link } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { SECTIONS } from "../registry.ts";
import { CHANGES } from "../changes.ts";
import { coverage } from "../coverage.ts";

export async function render(host: HTMLElement, ctx: Ctx) {
  const k = ctx.kit;
  host.append(
    $("h1", "", "Sahne"),
    $("p", "note", "A paper-theatre stage for the Kumru stories: paper puppets with faces that talk, places built from parametric set pieces, light through the day, weather, particles, synthesized sound, and a learner who can tap, drag and speak. This gallery shows every part of it live; every view is a link (copy the address to share exactly what you see)."),
  );

  // the numbers, from the kit and the engine
  const defs = new Set<PieceDef>([...Object.values(k.set), ...Object.values(k.props)]);
  const variants = [...defs].reduce((n, d) => n + Object.keys(d.variants ?? {}).length, 0);
  const sounds = Object.values(k.sounds ?? {});
  const [places, drafts, world] = await Promise.all([ctx.data("places").catch(() => []), ctx.data("drafts").catch(() => []), ctx.data("world").catch(() => [])]);
  const stats: [string, number | string, string][] = [
    ["set generators", defs.size, "#/kit/set"],
    ["their variants", variants, "#/kit/set"],
    ["set pieces / props", `${Object.keys(k.set).length} / ${Object.keys(k.props).length}`, "#/kit/set"],
    ["character parts", Object.keys(k.parts).length, "#/kit/people"],
    ["gestures", Object.keys(k.gestures).length, "#/kit/gestures"],
    ["emotions", Object.keys(k.face.emotions).length, "#/kit/gestures"],
    ["sound effects", sounds.filter(s => !s.loop).length, "#/kit/sound"],
    ["ambience loops", sounds.filter(s => s.loop).length, "#/kit/sound"],
    ["music motifs", Object.keys(k.motifs ?? {}).length, "#/kit/sound"],
    ["places built", `${places.length} of ${world.filter(w => !w.placeholder).length}`, "#/places"],
    ["stories", drafts.length, "#/stories"],
    ["cue kinds · staging fields", `${CUE_KINDS.length} · ${STAGING_FIELDS.length}`, "#/systems/script"],
    ["times · weathers", `${Object.keys(TIMES).length} · ${Object.keys(WEATHER).length}`, "#/systems/light"],
  ];
  const grid = $("div", "cards");
  for (const [label, n, hash] of stats) {
    const a = link("", hash);
    a.className = "card";
    a.append($("b", "", String(n)), $("small", "", label));
    grid.append(a);
  }
  host.append($("h2", "", "In the gallery"), grid);

  // how much of the engine has a demo (test/coverage.test.ts fails while any is missing)
  const cov = coverage(), pct = Math.round(100 * cov.covered.length / cov.all.length);
  const meter = $("div", "meter"), fill = $("i");
  fill.style.width = `${pct}%`;
  meter.append(fill);
  host.append($("h2", "", `Engine coverage · ${cov.covered.length} of ${cov.all.length} (${pct}%)`), meter);
  if (cov.missing.length) {
    const p = $("p", "note", "Not demoed yet: ");
    p.append(...cov.missing.flatMap(m => [chip(m, "warn"), " "]));
    host.append(p);
  }

  // the sections
  const secs = $("div", "cards");
  for (const s of SECTIONS.filter(s => s.id)) {
    const a = link("", `#/${s.id}`);
    a.className = "card";
    a.append($("b", "", s.title), $("small", "", s.about));
    secs.append(a);
  }
  host.append($("h2", "", "Sections"), secs);

  // what changed, for the owner's review
  host.append($("h2", "", "Changes"), $("p", "note", "Each step with something to see, newest first: what to check, and links that open the gallery set up to show it."));
  if (!CHANGES.length) host.append($("p", "note", "Nothing yet."));
  for (const c of CHANGES) {
    const card = $("article", "card");
    const h = $("h3", "", `${c.title} `);
    h.append(chip(c.step), " ", chip(c.date));
    const ul = $("ul", "checks");
    for (const t of c.check) ul.append($("li", "", t));
    const links = $("p");
    for (const [label, hash] of c.links) links.append(link(label, hash), " · ");
    links.lastChild?.remove();
    card.append(h, ul, links);
    host.append(card);
  }
}
