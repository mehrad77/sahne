import {
  SYSTEMS
} from "./chunk-MBHY5FZF.js";
import {
  $,
  chip,
  link
} from "./chunk-4TGKXDN4.js";
import {
  ACT_KINDS,
  CAM_KINDS,
  CUE_KINDS,
  EMIT_KINDS,
  ENV_VERBS,
  MOTION_KINDS,
  MOVE_HOWS,
  OBJ_OPS,
  STAGING_FIELDS,
  TIMES,
  VOICES,
  WEATHER
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/changes.ts
var CHANGES = [
  {
    date: "2026-10-27",
    step: "repo",
    title: "Sahne in a repo of its own",
    check: [
      "#/stories/s1e00: the sample story plays from sahne-story/samples/ (Nima on the metro, then oranges at \u0130smail's bakkal); set SAHNE_CONTENT to play another content root's stories.",
      "#/places: the two sample places, bakkal and metro_m11, with their sheets and camera checks.",
      "#/kit/kerim: her art and her CSS now both come from the kit (sahne-kit/kerim.css)."
    ],
    links: [["the sample story", "#/stories/s1e00"], ["the places", "#/places"], ["Kerim", "#/kit/kerim"]]
  }
];

// src/coverage.ts
function vocabulary() {
  const of = (kind, values) => values.map((v) => `${kind}:${v}`);
  return [
    ...of("cue", CUE_KINDS),
    ...of("staging", STAGING_FIELDS),
    ...of("cam", CAM_KINDS),
    ...of("move", MOVE_HOWS),
    ...of("voice", VOICES),
    ...of("obj", OBJ_OPS),
    ...of("act", ACT_KINDS),
    ...of("env", ENV_VERBS),
    ...of("emit", EMIT_KINDS),
    ...of("motion", MOTION_KINDS),
    ...of("time", Object.keys(TIMES)),
    ...of("weather", Object.keys(WEATHER))
  ];
}
function coverage() {
  const covered = new Set(SYSTEMS.flatMap((s) => s.covers));
  const all = vocabulary();
  return { all, covered: all.filter((v) => covered.has(v)), missing: all.filter((v) => !covered.has(v)), unknown: [...covered].filter((v) => !all.includes(v) && !/^(design|kit|place):/.test(v)) };
}

// src/sections/dev.ts
function render(host) {
  host.append($("h1", "", "For maintainers"), $("p", "note", "How much of the engine has a live demo, and what changed for review."));
  const cov = coverage(), pct = Math.round(100 * cov.covered.length / cov.all.length);
  const meter = $("div", "meter"), fill = $("i");
  fill.style.width = `${pct}%`;
  meter.append(fill);
  host.append($("h2", "", `Engine coverage \xB7 ${cov.covered.length} of ${cov.all.length} (${pct}%)`), meter);
  if (cov.missing.length) {
    const p = $("p", "note", "Not demoed yet: ");
    p.append(...cov.missing.flatMap((m) => [chip(m, "warn"), " "]));
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
    for (const [label, hash] of c.links) links.append(link(label, hash), " \xB7 ");
    links.lastChild?.remove();
    card.append(h, ul, links);
    host.append(card);
  }
}
export {
  render
};
//# sourceMappingURL=dev-KZXRWN64.js.map
