import {
  env,
  envBar
} from "./chunk-T7B2O6CW.js";
import {
  board,
  needsFor,
  problems,
  ruleChips
} from "./chunk-WB6XEHS3.js";
import "./chunk-D3OMKUXF.js";
import {
  PLACE_RULES
} from "./chunk-6JPAPIMW.js";
import {
  FIGURE
} from "./chunk-YGBM7NGP.js";
import "./chunk-CMLP3XCI.js";
import "./chunk-6PR3AWGB.js";
import "./chunk-GO2IY55S.js";
import "./chunk-3BCF3C4G.js";
import "./chunk-ZT53KTYM.js";
import "./chunk-DDNHNEH6.js";
import "./chunk-6IX3XYSS.js";
import "./chunk-J3KVAIQI.js";
import {
  $,
  bar,
  button,
  chip,
  choice,
  facts,
  frame,
  link,
  toggle
} from "./chunk-4TGKXDN4.js";
import {
  interact,
  propText
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/places/scout.ts
var RULES = {
  valid: "Valid: names in three languages, district, size, wide camera, times, a perch up high, ambience, motif, surface; kit ids, marks, doors and terms resolve",
  needs: "Covers its needs: every mark, prop, state, time and sound of its needs.json entry",
  depth: "Depth: pieces in the four bands (far, backdrop, the actors' plane, near); outdoors, a far piece",
  density: "Density: at least 12 pieces, 3 beyond walls and floors; its needs' props plus 3 dressing props; each state 2 pieces of its own",
  crowd: "Crowds clear of the marks; at most 40 people",
  explore: "Explore: at least 5 tappable things with an A1 card; every prop has terms or is decor",
  light: "Light: with dusk or night, a practical light and lit windows or signs",
  sound: "Sound: an ambience bed, a motif, a surface",
  budget: "Budget: at most 5 KB of JSON"
};
async function render(host, ctx, id) {
  const b = await board(ctx);
  const bench = b.benches.find((d) => d.id === id);
  const doc = b.docs.find((d) => d.id === id) ?? bench;
  if (!doc) {
    const n = needsFor(b, id);
    host.append(link("\u2190 the board", "#/places"), $("h1", "", id), $("p", "note", n ? `Planned, not built yet: ${n.place.why}` : "No place document by that id."));
    if (n) host.append(needsTable(b, { id, pieces: [], marks: {}, props: {} }));
    return;
  }
  const ps = problems(b, doc, ctx);
  const h = $("h1", "", `${doc.name?.tr ?? doc.id} `);
  h.append(chip(doc.id), " ", bench ? chip("test bench", "", "the gallery's own test place (src/bench.ts), composed from kit pieces") : doc.placeholder ? chip("placeholder", "ph", doc.placeholder) : chip("built", "ok"));
  host.append(link("\u2190 the board", "#/places"), h, $("p", "note", `${doc.name?.en ?? ""}${doc.district ? ` \xB7 ${doc.district}` : ""}${doc.site ? ` \xB7 site ${doc.site}` : ""} \xB7 ${doc.size.w} \xD7 ${doc.size.d} m${doc.life === "run" ? " \xB7 runs (a vehicle)" : ""}`));
  if (doc.placeholder) host.append($("p", "note warn", doc.placeholder));
  if (!bench) host.append(ruleChips(ps));
  const marks = Object.entries(doc.marks);
  const ground = marks.filter(([, m]) => !m.air && !((m.y ?? 0) > 0));
  const box = frame("16 / 9");
  box.style.position = "relative";
  host.append(box);
  const stage = ctx.mount(box);
  propText(stage);
  const ix = interact(stage, { explore: false });
  const cast = {};
  const at = {};
  if (ground[0]) {
    cast.me = FIGURE;
    at.me = ground[0][0];
  }
  if (doc.perch) {
    cast.kerim = { puppet: "bird" };
    at.kerim = doc.perch;
  }
  const q = ctx.route.query, state = (q.get("state") ?? "").split(",").filter(Boolean), weather = q.get("weather") ?? void 0;
  stage.load({ v: 1, cues: [{ scene: { place: doc.id, time: q.get("time") ?? doc.times?.[0] ?? "day", ...weather ? { weather } : {}, ...state.length ? { state } : {}, at, cam: "wide" } }] }, { cast, places: { [doc.id]: doc } });
  if (q.get("lights") === "off") env(stage, "lights_off");
  const layer = $("div", "marks");
  box.append(layer);
  let showMarks = ctx.route.query.get("marks") !== "0";
  const pins = marks.map(([name, m]) => {
    const kind = name === doc.perch ? "perch" : m.air ? m.pace ? "pace" : "air" : m.door ? "door" : (m.y ?? 0) > 0 ? "high" : "ground";
    const sym = { perch: "\u2605", air: "\u25CC", pace: "\xBB", door: "\u21E5", high: "\u25B4", ground: "\u25CF" }[kind];
    const pin = button(`${sym} ${name}`, () => go(name, kind), void 0, `${kind} mark ${name} (${m.x}, ${m.y ?? 0}, ${m.z})${m.door ? ` \xB7 door ${m.door}` : ""}${m.in ? ` \xB7 in ${m.in.join(", ")}` : ""}`);
    pin.className = `pin ${kind}`;
    layer.append(pin);
    return { pin, p: [m.x, m.y ?? 0, m.z] };
  });
  const place = () => {
    layer.hidden = !showMarks;
    if (!showMarks) return;
    for (const { pin, p } of pins) {
      const q2 = stage.project(p);
      pin.hidden = !q2;
      if (q2) {
        pin.style.left = `${q2[0]}px`;
        pin.style.top = `${q2[1]}px`;
      }
    }
  };
  ctx.cleanup(stage.onFrame(place));
  let standing, out;
  const go = (mark, kind) => {
    if (kind === "perch" || kind === "air" || kind === "pace" || kind === "high") {
      if (cast.kerim) stage.act({ beat: { move: { who: "kerim", to: mark, how: "fly" } } });
      return;
    }
    if (!cast.me) return;
    if (out) {
      stage.act({ beat: { move: { who: "me", to: mark, how: "enter", from: out } } });
      out = void 0;
      standing = mark;
      return;
    }
    if (kind === "door" && standing === mark) {
      stage.act({ beat: { move: { who: "me", to: mark, how: "exit", from: mark } } });
      out = mark;
      standing = void 0;
      return;
    }
    stage.act({ beat: { move: { who: "me", to: mark } } });
    standing = mark;
  };
  const log = $("div", "log");
  log.textContent = "Explore is off: turn it on and tap a person, a prop or a piece with words.";
  ix.on("inspect", (e) => {
    log.textContent = `${e.kind} ${e.id}${e.part ? `.${e.part}` : ""} \xB7 ${e.name ?? ""}${e.terms?.length ? ` \xB7 terms ${e.terms.join(", ")}` : ""}`;
  });
  host.append(
    envBar(() => stage, doc, { ctx }),
    bar(
      "scout",
      toggle("marks", showMarks, (on) => {
        showMarks = on;
        ctx.setQuery({ marks: on ? null : "0" });
        place();
      }, "the place's marks; tap one to walk the figure there, or fly Kerim to the perch and air marks; tap a door mark the figure stands on to exit through its door, then any mark to come back in through it"),
      toggle("explore", false, (on) => ix.setExplore(on), "tap things as a learner does: each says its name and its cards"),
      button("wide", () => stage.act({ beat: { cam: "wide" } })),
      ...cast.me ? [button("figure close", () => stage.act({ beat: { who: "me", cam: "close" } }))] : [],
      ...cast.kerim ? [button("Kerim follow", () => stage.act({ beat: { who: "kerim", cam: "follow" } }))] : []
    ),
    log
  );
  const tab = ctx.route.query.get("tab") ?? "standard";
  const body = $("div");
  host.append(choice("", ["standard", "needs", "pieces", "checks"], tab, (t) => {
    ctx.setQuery({ tab: t === "standard" ? null : t });
    show(t);
  }, { standard: "the standard", needs: "what the briefs ask", pieces: "pieces and props", checks: "sheet and camera" }), body);
  const show = (t) => {
    body.replaceChildren();
    if (t === "standard" && bench) body.append($("p", "note", "A test bench, not a story place: it is not held to the standard."));
    else if (t === "standard") {
      const ul = $("ul", "checks");
      for (const r of PLACE_RULES) {
        const mine = ps.filter((p) => p.rule === r), err = mine.some((p) => p.level === "error");
        const li = $("li", err ? "bad" : mine.length ? "warn" : "ok", `${err ? "\u2717" : mine.length ? "!" : "\u2713"} ${RULES[r] ?? r}`);
        if (mine.length) {
          const sub = $("ul");
          for (const p of mine) sub.append($("li", "", p.message));
          li.append(sub);
        }
        ul.append(li);
      }
      ul.append($("li", "", "Camera: an actor on every mark and Kerim on the perch and air marks inside the frame at 390 and 1100 px (the checks tab)"));
      ul.append($("li", "", "Review: the contact sheet checked against STYLE.md and approved by the owner"));
      body.append(ul);
    } else if (t === "needs") body.append(needsTable(b, doc));
    else if (t === "pieces") {
      const ul = $("ul");
      for (const p of doc.pieces) {
        const li = $("li");
        li.append(link(`${p.kit}${p.variant ? ` \xB7 ${p.variant}` : ""}`, `#/kit/set/${p.kit}${p.variant ? `?variant=${p.variant}` : ""}`), ` ${p.id ? `#${p.id} ` : ""}at (${p.x}, ${p.y ?? 0}, ${p.z})${p.in ? ` in ${p.in.join(", ")}` : ""}`);
        ul.append(li);
      }
      const pl = $("ul");
      for (const [pid, p] of Object.entries(doc.props ?? {})) {
        const li = $("li");
        li.append($("b", "", pid), " ", link(`${p.kit}${p.variant ? ` \xB7 ${p.variant}` : ""}`, `#/kit/set/${p.kit}${p.variant ? `?variant=${p.variant}` : ""}`), ` ${p.n ? `\xD7${p.n} ` : ""}${p.terms?.length ? `\xB7 ${p.terms.join(" ")}` : p.decor ? "\xB7 decor" : ""}`);
        pl.append(li);
      }
      body.append($("h3", "", `Pieces \xB7 ${doc.pieces.length}`), ul, $("h3", "", `Props \xB7 ${Object.keys(doc.props ?? {}).length}`), pl, facts([
        ["times", (doc.times ?? []).join(", ")],
        ["states", Object.entries(doc.states ?? {}).map(([s, d]) => `${s}${d.group ? ` (${d.group})` : ""}${d.default ? " default" : ""}${d.cold ? " cold" : ""}`).join(", ")],
        ["sound", [doc.ambience?.length ? `ambience ${doc.ambience.join(" + ")}` : "", doc.motif ? `motif ${doc.motif}` : "", doc.surface ? `steps on ${doc.surface}` : ""].filter(Boolean).join(" \xB7 ")],
        ["cost", (() => {
          const s = $("span", "", "\u2026");
          setTimeout(() => {
            s.textContent = `${(stage.stats.texKB / 1024).toFixed(1)} MB of texture, atlas ${stage.stats.atlasMs} ms, ${(JSON.stringify(doc).length / 1024).toFixed(1)} KB of JSON`;
          }, 1500);
          return s;
        })()]
      ]));
    } else {
      const p = $("p");
      p.append(link("contact sheet: every time, at 1100 and 390 px", `#/places/${doc.id}/sheet`), $("br"), link("camera check: every mark framed wide, two and close", `#/places/${doc.id}/camera`));
      body.append(p, $("p", "note", "Each opens on its own (many stages at once): shots.mjs --places photographs them."));
    }
  };
  show(tab);
}
function needsTable(b, doc) {
  const n = needsFor(b, doc.id), wrap = $("div");
  if (!n) {
    wrap.append($("p", "note", "No brief asks for this place (needs.json)."));
    return wrap;
  }
  const P = n.place, have = new Set(Object.values(doc.props ?? {}).map((p) => p.kit)), pieces = new Set(doc.pieces.map((p) => p.kit));
  const word = (c) => b.cards?.[c]?.tr ?? c;
  const t = $("table", "t"), row = (...cells) => {
    const tr = $("tr");
    for (const c of cells) {
      const td = $("td");
      td.append(c);
      tr.append(td);
    }
    t.append(tr);
  };
  const mark = (ok) => $("span", ok ? "ok" : "bad", ok ? "\u2713" : "\u2717");
  t.append(Object.assign($("tr"), { innerHTML: "<th></th><th>asked</th><th>why</th>" }));
  for (const [m, x] of Object.entries(P.marks ?? {})) row(mark(Object.hasOwn(doc.marks, m)), `mark ${m}${x.perch ? " \u2605" : ""}${x.air ? " \u25CC" : ""}${x.door ? " \u21E5" : ""}${x.pace ? " \xBB" : ""}`, x.why ?? "");
  for (const [name, p] of Object.entries(P.props ?? {})) row(mark(have.has(p.kit) || pieces.has(p.kit)), `prop ${name}: ${p.kit}${p.variant ? ` \xB7 ${p.variant}` : ""}${p.n ? ` \xD7${p.n}` : ""}`, p.terms.map(word).join(", "));
  for (const [name, p] of Object.entries(P.storyProps ?? {})) row($("span", "", "\xB7"), `story prop ${name}: ${p.kit}${p.variant ? ` \xB7 ${p.variant}` : ""}`, p.terms.map(word).join(", "));
  for (const [s, x] of Object.entries(P.states ?? {})) row(mark(Object.hasOwn(doc.states ?? {}, s)), `state ${s}${x.group ? ` (${x.group})` : ""}`, "");
  for (const time of P.times ?? []) row(mark((doc.times ?? []).includes(time)), `time ${time}`, "");
  for (const s of P.sounds ?? []) row(mark((doc.ambience ?? []).includes(s) || doc.motif === s), `sound ${s}`, "an effect a story plays, or a bed the place keeps");
  wrap.append($("p", "note", `${P.why} \xB7 stories ${P.stories.join(", ")}${P.crowd ? ` \xB7 crowd: ${P.crowd}` : ""}${P.landmarks?.length ? ` \xB7 landmarks: ${P.landmarks.join(", ")}` : ""}`), t);
  if (P.notes) wrap.append($("p", "note", P.notes));
  return wrap;
}
export {
  render
};
//# sourceMappingURL=scout-AMONNWCE.js.map
