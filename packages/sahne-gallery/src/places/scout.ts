// #/places/<id>: one place scouted. The place live with the env bar and its states; its marks drawn over
// the stage (a tap walks the figure there, or flies Kerim to the perch and air marks); explore, as a
// learner taps things; its sound; and tabs for the standard, what the briefs ask of it, its pieces
// and props, and links to its contact sheet and camera check.

import { interact, propText, type Mark, type Stage, type Vec3 } from "sahne";
import { PLACE_RULES } from "sahne-story";
import { $, bar, button, chip, choice, facts, frame, link, toggle } from "../shell/dom.ts";
import { envBar, env } from "../shell/env.ts";
import type { Ctx } from "../shell/ctx.ts";
import { FIGURE } from "../kit/solo.ts";
import { board, needsFor, problems, ruleChips, type Board, type Doc } from "./common.ts";

const RULES: Record<string, string> = {
  valid: "Valid: names in three languages, district, size, wide camera, times, a perch up high, ambience, motif, surface; kit ids, marks, doors and terms resolve",
  needs: "Covers its needs: every mark, prop, state, time and sound of its needs.json entry",
  depth: "Depth: pieces in the four bands (far, backdrop, the actors' plane, near); outdoors, a far piece",
  density: "Density: at least 12 pieces, 3 beyond walls and floors; its needs' props plus 3 dressing props; each state 2 pieces of its own",
  crowd: "Crowds clear of the marks; at most 40 people",
  explore: "Explore: at least 5 tappable things with an A1 card; every prop has terms or is decor",
  light: "Light: with dusk or night, a practical light and lit windows or signs",
  sound: "Sound: an ambience bed, a motif, a surface",
  budget: "Budget: at most 5 KB of JSON",
};

export async function render(host: HTMLElement, ctx: Ctx, id: string) {
  const b = await board(ctx);
  const bench = b.benches.find(d => d.id === id);
  const doc = b.docs.find(d => d.id === id) ?? bench;
  if (!doc) {
    const n = needsFor(b, id);
    host.append(link("← the board", "#/places"), $("h1", "", id), $("p", "note", n ? `Planned, not built yet: ${n.place.why}` : "No place document by that id."));
    if (n) host.append(needsTable(b, { id, pieces: [], marks: {}, props: {} } as unknown as Doc));
    return;
  }
  const ps = problems(b, doc, ctx);
  const h = $("h1", "", `${doc.name?.tr ?? doc.id} `);
  h.append(chip(doc.id), " ", bench ? chip("test bench", "", "the gallery's own test place (src/bench.ts), composed from kit pieces") : doc.placeholder ? chip("placeholder", "ph", doc.placeholder) : chip("built", "ok"));
  host.append(link("← the board", "#/places"), h, $("p", "note", `${doc.name?.en ?? ""}${doc.district ? ` · ${doc.district}` : ""}${doc.site ? ` · site ${doc.site}` : ""} · ${doc.size.w} × ${doc.size.d} m${doc.life === "run" ? " · runs (a vehicle)" : ""}`));
  if (doc.placeholder) host.append($("p", "note warn", doc.placeholder));
  if (!bench) host.append(ruleChips(ps));

  // ---- the stage, with the figure on the first mark people stand on and Kerim on the perch ----
  const marks = Object.entries(doc.marks) as [string, Mark][];
  const ground = marks.filter(([, m]) => !m.air && !((m.y ?? 0) > 0));
  const box = frame("16 / 9");
  box.style.position = "relative";
  host.append(box);
  const stage: Stage = ctx.mount(box);
  propText(stage);
  const ix = interact(stage, { explore: false });
  const cast: Record<string, typeof FIGURE | { puppet: string }> = {};
  const at: Record<string, string> = {};
  if (ground[0]) { cast.me = FIGURE; at.me = ground[0][0]; }
  if (doc.perch) { cast.kerim = { puppet: "bird" }; at.kerim = doc.perch; }
  // the link's weather and states are the scene's own, so the scene's start does not reset them
  const q = ctx.route.query, state = (q.get("state") ?? "").split(",").filter(Boolean), weather = q.get("weather") ?? undefined;
  stage.load({ v: 1, cues: [{ scene: { place: doc.id, time: q.get("time") ?? doc.times?.[0] ?? "day", ...(weather ? { weather } : {}), ...(state.length ? { state } : {}), at, cam: "wide" } }] }, { cast, places: { [doc.id]: doc } });
  if (q.get("lights") === "off") env(stage, "lights_off");

  // the marks, over the stage
  const layer = $("div", "marks");
  box.append(layer);
  let showMarks = ctx.route.query.get("marks") !== "0";
  const pins = marks.map(([name, m]) => {
    const kind = name === doc.perch ? "perch" : m.air ? (m.pace ? "pace" : "air") : m.door ? "door" : (m.y ?? 0) > 0 ? "high" : "ground";
    const sym = { perch: "★", air: "◌", pace: "»", door: "⇥", high: "▴", ground: "●" }[kind];
    const pin = button(`${sym} ${name}`, () => go(name, kind), undefined, `${kind} mark ${name} (${m.x}, ${m.y ?? 0}, ${m.z})${m.door ? ` · door ${m.door}` : ""}${m.in ? ` · in ${m.in.join(", ")}` : ""}`);
    pin.className = `pin ${kind}`;
    layer.append(pin);
    return { pin, p: [m.x, m.y ?? 0, m.z] as Vec3 };
  });
  const place = () => {
    layer.hidden = !showMarks;
    if (!showMarks) return;
    for (const { pin, p } of pins) {
      const q = stage.project(p);
      pin.hidden = !q;
      if (q) { pin.style.left = `${q[0]}px`; pin.style.top = `${q[1]}px`; }
    }
  };
  ctx.cleanup(stage.onFrame(place));
  // where the figure stands, and the door it left by: a door mark tapped again is an exit through its door, and the next tap an entrance through it
  let standing: string | undefined, out: string | undefined;
  const go = (mark: string, kind: string) => {
    if (kind === "perch" || kind === "air" || kind === "pace" || kind === "high") { if (cast.kerim) stage.act({ beat: { move: { who: "kerim", to: mark, how: "fly" } } }); return; }
    if (!cast.me) return;
    if (out) { stage.act({ beat: { move: { who: "me", to: mark, how: "enter", from: out } } }); out = undefined; standing = mark; return; }
    if (kind === "door" && standing === mark) { stage.act({ beat: { move: { who: "me", to: mark, how: "exit", from: mark } } }); out = mark; standing = undefined; return; }
    stage.act({ beat: { move: { who: "me", to: mark } } });
    standing = mark;
  };

  // ---- controls ----
  const log = $("div", "log");
  log.textContent = "Explore is off: turn it on and tap a person, a prop or a piece with words.";
  ix.on("inspect", e => { log.textContent = `${e.kind} ${e.id}${e.part ? `.${e.part}` : ""} · ${e.name ?? ""}${e.terms?.length ? ` · terms ${e.terms.join(", ")}` : ""}`; });
  host.append(
    envBar(() => stage, doc, { ctx }),
    bar("scout",
      toggle("marks", showMarks, on => { showMarks = on; ctx.setQuery({ marks: on ? null : "0" }); place(); }, "the place's marks; tap one to walk the figure there, or fly Kerim to the perch and air marks; tap a door mark the figure stands on to exit through its door, then any mark to come back in through it"),
      toggle("explore", false, on => ix.setExplore(on), "tap things as a learner does: each says its name and its cards"),
      button("wide", () => stage.act({ beat: { cam: "wide" } })),
      ...(cast.me ? [button("figure close", () => stage.act({ beat: { who: "me", cam: "close" } }))] : []),
      ...(cast.kerim ? [button("Kerim follow", () => stage.act({ beat: { who: "kerim", cam: "follow" } }))] : []),
    ),
    log,
  );

  // ---- the tabs ----
  const tab = (ctx.route.query.get("tab") ?? "standard") as "standard" | "needs" | "pieces" | "checks";
  const body = $("div");
  host.append(choice("", ["standard", "needs", "pieces", "checks"], tab, t => { ctx.setQuery({ tab: t === "standard" ? null : t }); show(t); }, { standard: "the standard", needs: "what the briefs ask", pieces: "pieces and props", checks: "sheet and camera" }), body);
  const show = (t: string) => {
    body.replaceChildren();
    if (t === "standard" && bench) body.append($("p", "note", "A test bench, not a story place: it is not held to the standard."));
    else if (t === "standard") {
      const ul = $("ul", "checks");
      for (const r of PLACE_RULES) {
        const mine = ps.filter(p => p.rule === r), err = mine.some(p => p.level === "error");
        const li = $("li", err ? "bad" : mine.length ? "warn" : "ok", `${err ? "✗" : mine.length ? "!" : "✓"} ${RULES[r] ?? r}`);
        if (mine.length) { const sub = $("ul"); for (const p of mine) sub.append($("li", "", p.message)); li.append(sub); }
        ul.append(li);
      }
      ul.append($("li", "", "Camera: an actor on every mark and Kerim on the perch and air marks inside the frame at 390 and 1100 px (the checks tab)"));
      ul.append($("li", "", "Review: the contact sheet checked against STYLE.md and approved by the owner"));
      body.append(ul);
    } else if (t === "needs") body.append(needsTable(b, doc));
    else if (t === "pieces") {
      const ul = $("ul");
      for (const p of doc.pieces) { const li = $("li"); li.append(link(`${p.kit}${p.variant ? ` · ${p.variant}` : ""}`, `#/kit/set/${p.kit}${p.variant ? `?variant=${p.variant}` : ""}`), ` ${p.id ? `#${p.id} ` : ""}at (${p.x}, ${p.y ?? 0}, ${p.z})${p.in ? ` in ${p.in.join(", ")}` : ""}`); ul.append(li); }
      const pl = $("ul");
      for (const [pid, p] of Object.entries(doc.props ?? {})) { const li = $("li"); li.append($("b", "", pid), " ", link(`${p.kit}${p.variant ? ` · ${p.variant}` : ""}`, `#/kit/set/${p.kit}${p.variant ? `?variant=${p.variant}` : ""}`), ` ${p.n ? `×${p.n} ` : ""}${p.terms?.length ? `· ${p.terms.join(" ")}` : (p as { decor?: boolean }).decor ? "· decor" : ""}`); pl.append(li); }
      body.append($("h3", "", `Pieces · ${doc.pieces.length}`), ul, $("h3", "", `Props · ${Object.keys(doc.props ?? {}).length}`), pl, facts([
        ["times", (doc.times ?? []).join(", ")], ["states", Object.entries(doc.states ?? {}).map(([s, d]) => `${s}${d.group ? ` (${d.group})` : ""}${d.default ? " default" : ""}${d.cold ? " cold" : ""}`).join(", ")],
        ["sound", [doc.ambience?.length ? `ambience ${doc.ambience.join(" + ")}` : "", doc.motif ? `motif ${doc.motif}` : "", doc.surface ? `steps on ${doc.surface}` : ""].filter(Boolean).join(" · ")],
        ["cost", (() => { const s = $("span", "", "…"); setTimeout(() => { s.textContent = `${(stage.stats.texKB / 1024).toFixed(1)} MB of texture, atlas ${stage.stats.atlasMs} ms, ${(JSON.stringify(doc).length / 1024).toFixed(1)} KB of JSON`; }, 1500); return s; })()],
      ]));
    } else {
      const p = $("p");
      p.append(link("contact sheet: every time, at 1100 and 390 px", `#/places/${doc.id}/sheet`), $("br"), link("camera check: every mark framed wide, two and close", `#/places/${doc.id}/camera`));
      body.append(p, $("p", "note", "Each opens on its own (many stages at once): shots.mjs --places photographs them."));
    }
  };
  show(tab);
}

/** What the briefs ask of a place (needs.json), each item marked as there or missing. */
function needsTable(b: Board, doc: Doc) {
  const n = needsFor(b, doc.id), wrap = $("div");
  if (!n) { wrap.append($("p", "note", "No brief asks for this place (needs.json).")); return wrap; }
  const P = n.place, have = new Set(Object.values(doc.props ?? {}).map(p => p.kit)), pieces = new Set(doc.pieces.map(p => p.kit));
  const word = (c: string) => b.cards?.[c]?.tr ?? c;
  const t = $("table", "t"), row = (...cells: (string | Node)[]) => { const tr = $("tr"); for (const c of cells) { const td = $("td"); td.append(c); tr.append(td); } t.append(tr); };
  const mark = (ok: boolean) => $("span", ok ? "ok" : "bad", ok ? "✓" : "✗");
  t.append(Object.assign($("tr"), { innerHTML: "<th></th><th>asked</th><th>why</th>" }));
  for (const [m, x] of Object.entries(P.marks ?? {})) row(mark(Object.hasOwn(doc.marks, m)), `mark ${m}${x.perch ? " ★" : ""}${x.air ? " ◌" : ""}${x.door ? " ⇥" : ""}${x.pace ? " »" : ""}`, x.why ?? "");
  for (const [name, p] of Object.entries(P.props ?? {})) row(mark(have.has(p.kit) || pieces.has(p.kit)), `prop ${name}: ${p.kit}${p.variant ? ` · ${p.variant}` : ""}${p.n ? ` ×${p.n}` : ""}`, p.terms.map(word).join(", "));
  for (const [name, p] of Object.entries(P.storyProps ?? {})) row($("span", "", "·"), `story prop ${name}: ${p.kit}${p.variant ? ` · ${p.variant}` : ""}`, p.terms.map(word).join(", "));
  for (const [s, x] of Object.entries(P.states ?? {})) row(mark(Object.hasOwn(doc.states ?? {}, s)), `state ${s}${x.group ? ` (${x.group})` : ""}`, "");
  for (const time of P.times ?? []) row(mark((doc.times ?? []).includes(time)), `time ${time}`, "");
  for (const s of P.sounds ?? []) row(mark((doc.ambience ?? []).includes(s) || doc.motif === s), `sound ${s}`, "an effect a story plays, or a bed the place keeps");
  wrap.append($("p", "note", `${P.why} · stories ${P.stories.join(", ")}${P.crowd ? ` · crowd: ${P.crowd}` : ""}${P.landmarks?.length ? ` · landmarks: ${P.landmarks.join(", ")}` : ""}`), t);
  if (P.notes) wrap.append($("p", "note", P.notes));
  return wrap;
}
