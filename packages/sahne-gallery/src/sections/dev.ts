// #/dev: for the maintainers: how much of the engine has a demo (test/coverage.test.ts fails while any is
// missing) and what changed, step by step, with links that open the gallery set up to show it.

import { $, chip, link } from "../shell/dom.ts";
import { CHANGES } from "../changes.ts";
import { coverage } from "../coverage.ts";

export function render(host: HTMLElement) {
  host.append($("h1", "", "For maintainers"), $("p", "note", "How much of the engine has a live demo, and what changed for review."));

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
