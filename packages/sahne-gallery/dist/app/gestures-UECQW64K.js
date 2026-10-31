import {
  FIGURE
} from "./chunk-PRZYX3JM.js";
import "./chunk-Y35JX3JV.js";
import "./chunk-6PR3AWGB.js";
import "./chunk-GO2IY55S.js";
import "./chunk-3BCF3C4G.js";
import "./chunk-ZT53KTYM.js";
import {
  HAND_SHAPES
} from "./chunk-TYXGNTJ5.js";
import "./chunk-XKJEK365.js";
import {
  $,
  bar,
  button,
  chip,
  choice,
  css,
  frame,
  head,
  link,
  select,
  toggle
} from "./chunk-4TGKXDN4.js";
import {
  compose,
  faceFrom,
  normalize,
  portrait,
  renderSvg
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/kit/gestures.ts
var PARTNER = { ...FIGURE, skin: "skin_07", body: { ...FIGURE.body, height: 0.25 }, hair: { ...FIGURE.hair, color: "hair_04" } };
var PROP_FOR = {
  eat: { kit: "food", variant: "simit" },
  drink: { kit: "tea", variant: "glass" },
  write: { kit: "pen" },
  read: { kit: "book" },
  phone: { kit: "phone" },
  photo: { kit: "phone" },
  hold_up: { kit: "sign_board" }
};
var DEFAULT_PROP = { kit: "book" };
var TARGETS = [["ch:b", "the partner"], ["ch:b.hand", "the partner's hand"], ["ch:b.head", "the partner's head"], ["obj:bread", "the loaf on the table"], ["mark:shelf", "a spot up on the wall"], ["viewer", "the viewer"]];
function lab(held, partnerHolds = false) {
  const props = { bread: { kit: "bread", at: partnerHolds ? "b" : { x: -1.35, y: 0.86, z: -0.25 }, terms: [] } };
  if (held) props.held = { ...held, at: "a" };
  return {
    v: 1,
    id: "lab",
    name: { tr: "lab", en: "lab" },
    size: { w: 6, d: 4 },
    pieces: [
      { kit: "floor", x: 0, z: -1.6, w: 900, d: 600 },
      { kit: "wall", x: 0, z: -1.6, w: 900, h: 320 },
      { kit: "table", x: -1.35, z: -0.25 }
    ],
    marks: { a: { x: -0.35, z: 0.3, facing: "r" }, b: { x: 0.85, z: 0.3, facing: "l" }, shelf: { x: -0.9, y: 1.75, z: -1.55 } },
    props,
    times: ["day", "golden", "dusk", "night"],
    camera: { wide: { x: -0.2, w: 3.8, z: 0.3, y0: 0, y1: 2.1 } }
  };
}
var setupOf = (name, def) => {
  if (def.hold === "give") return { key: "give", place: lab(), take: "bread", partner: false };
  if (def.hold === "take") return { key: "take", place: lab(void 0, true), take: null, partner: true };
  if (def.needs?.includes("prop")) {
    const p = PROP_FOR[name] ?? DEFAULT_PROP;
    return { key: `prop:${p.kit}/${p.variant ?? ""}`, place: lab(p), take: "held", partner: false };
  }
  return { key: "plain", place: lab(), take: null, partner: false };
};
var HANDS_UP = { bones: { arm_r: 0.22, forearm_r: 2.5, hand_r: -0.12, arm_l: -0.22, forearm_l: -2.5, hand_l: 0.12 }, dx: 0, dy: 0 };
function render(host, ctx) {
  css("gestures", `
.gst-table td:first-child button { min-width: 110px; text-align: left; }
.gst-scroll { overflow-x: auto; max-width: 100%; }
.gst-table td { white-space: nowrap; }
.gst-table tr[aria-current="true"] td { background: color-mix(in srgb, var(--accent) 12%, transparent); }
.gst-faces { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 8px; }
.gst-faces .tile { cursor: pointer; }
.gst-faces .tile .art { height: 110px; background: #EDE6DA; }
.gst-faces .tile .art svg { width: 104px; height: 104px; }
.gst-hands { grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); }
.gst-hands .tile .art { height: 160px; }
.gst-hands .tile .art svg { width: 156px; height: 156px; }
.gst-mouth { display: flex; flex-wrap: wrap; gap: 3px; margin: 6px 0; font: 12px ui-monospace, monospace; }
.gst-mouth span { border: 1px solid var(--line); border-radius: 6px; padding: 1px 5px; background: var(--chip); }
.gst-mouth span.on { background: var(--accent); color: #fff; border-color: var(--accent); }
.gst-mouth span small { color: var(--mute); margin-left: 3px; }
.gst-mouth span.on small { color: #fffc; }
.gst-say input { min-width: 260px; flex: 1; }
`);
  const q = ctx.route.query, kit = ctx.kit;
  const names = Object.keys(kit.gestures).sort();
  const emotions = Object.keys(kit.face.emotions), visemes = Object.keys(kit.face.visemes);
  const st = {
    g: names.includes(q.get("g") ?? "") ? q.get("g") : names.includes("wave") ? "wave" : names[0],
    n: Number(q.get("n") ?? 3) || 3,
    loop: q.get("loop") === "1",
    at: q.get("at") ?? ""
  };
  host.append(
    $("h1", "", "Gestures and faces"),
    $("p", "note", `The kit's ${names.length} gestures, ${emotions.length} emotions, ${visemes.length} mouth shapes and ${HAND_SHAPES.length} hand shapes, on a stand-in (left) beside a partner (right), with a loaf on the table to point at. Pick a gesture and play it: look at the anticipation before it, the stroke (the moment that meets its word) and the settle after. Gestures that need a target aim at what you pick; those that need a prop get one in the hand first. Kerim's own gestures and moods are on `)
  );
  host.lastElementChild.append(link("Kerim", "#/kit/kerim"), ".");
  const box = frame("16 / 9");
  host.append(box);
  const stage = ctx.mount(box);
  let setupKey = "";
  const ready = (name) => {
    const s = setupOf(name, kit.gestures[name]);
    if (s.key === setupKey) return;
    setupKey = s.key;
    const cues = [{ scene: { place: "lab", at: { a: "a", b: "b" }, cam: "wide" } }];
    if (s.take) cues.push({ beat: { who: "a", obj: [{ id: s.take, op: "take" }] } });
    if (s.partner) cues.push({ beat: { who: "b", obj: [{ id: "bread", op: "take" }] } });
    stage.load({ v: 1, cues }, { cast: { a: FIGURE, b: PARTNER }, places: { lab: s.place }, names: { a: "stand-in", b: "partner" } });
    stage.show(cues.length - 1);
  };
  const targetFor = (name) => {
    const def = kit.gestures[name];
    if (!def.needs?.includes("target") && !def.needs?.includes("partner")) return void 0;
    if (st.at) return st.at;
    return def.needs.includes("partner") || def.hold ? "ch:b" : "obj:bread";
  };
  const play = (name) => {
    ready(name);
    const def = kit.gestures[name];
    if (def.hold === "give") return stage.act({ beat: { who: "a", obj: [{ id: "bread", op: "give", to: "b" }] } });
    if (def.hold === "take") return stage.act({ beat: { who: "a", do: name, at: "ch:b.hand", obj: [{ id: "bread", op: "take" }] } });
    return stage.act({ beat: { who: "a", do: name, at: targetFor(name), n: usesCount(def) ? st.n : void 0, loop: def.loop && st.loop ? true : void 0 } });
  };
  const usesCount = (def) => def.keys.some((k) => k.shape === "count" || k.shape2 === "count");
  const gSel = select("", names, st.g, (v) => {
    st.g = v;
    save();
    syncRows();
    detail();
    play(v);
  });
  const nRow = choice("count", ["1", "2", "3", "4", "5"], String(st.n), (v) => {
    st.n = Number(v);
    save();
    play(st.g);
  });
  const loopT = toggle("loop", st.loop, (on) => {
    st.loop = on;
    save();
    if (on) play(st.g);
    else stage.show(stage.script.cues.length - 1);
  }, "a gesture with a loop repeats its middle while a cue asks for loop (until the next cue)");
  const atSel = select("at", [["", "(its default)"], ...TARGETS], st.at, (v) => {
    st.at = v;
    save();
    play(st.g);
  });
  const info = $("p", "note");
  const save = () => ctx.setQuery({ g: st.g, n: st.n === 3 ? null : st.n, loop: st.loop ? "1" : null, at: st.at || null });
  const detail = () => {
    const def = kit.gestures[st.g];
    const show = (el, on) => {
      el.style.display = on ? "" : "none";
    };
    show(nRow, usesCount(def));
    show(loopT, !!def.loop);
    show(atSel, (!!def.needs?.includes("target") || !!def.needs?.includes("partner")) && !def.hold);
    const prop = def.needs?.includes("prop") ? PROP_FOR[st.g] ?? DEFAULT_PROP : null;
    info.textContent = `${st.g}: ${def.dur} ms long, the stroke at ${def.stroke} ms${def.loop ? `, loops ${def.loop[0]}\u2013${def.loop[1]} ms` : ""}${def.hands === 2 ? ", two hands" : ""}${def.needs?.length ? `; needs ${def.needs.join(", ")}` : ""}${prop ? ` (holds ${prop.kit}${prop.variant ? ` ${prop.variant}` : ""})` : ""}${def.hold ? `; hands the loaf ${def.hold === "give" ? "to the partner" : "over from the partner"} at its stroke` : ""}.`;
  };
  host.append(
    bar(
      "gesture",
      gSel,
      button("\u25B6 play", () => play(st.g), void 0, "play it again"),
      nRow,
      loopT,
      atSel,
      button("rest", () => {
        setupKey = "";
        ready(st.g);
      }, void 0, "back to the start: no gesture, no mood")
    ),
    info,
    bar(
      "camera",
      button("wide", () => stage.act({ beat: { cam: "wide" } })),
      button("two", () => stage.act({ beat: { who: "a", to: "b", cam: "two" } })),
      button("stand-in", () => stage.act({ beat: { who: "a", cam: "single" } })),
      button("close", () => stage.act({ beat: { who: "a", cam: "close" } })),
      button("flip", () => {
        const a = stage.world().actors.a;
        stage.turnTo("a", Math.cos(a.yaw) >= 0 ? Math.PI - a.yaw : (Math.sign(a.yaw) || 1) * 0.32);
      }, void 0, "the paper flip: turn past side-on to the back, and back")
    )
  );
  const rows = /* @__PURE__ */ new Map();
  const table = $("table", "t gst-table");
  table.append(Object.assign($("thead"), { innerHTML: "<tr><th>gesture</th><th>needs</th><th>hands</th><th>loop</th><th>length</th><th>stroke</th><th>holds or hands over</th></tr>" }));
  const tbody = $("tbody");
  for (const name of names) {
    const def = kit.gestures[name], tr = $("tr");
    const td = (x) => {
      const c = $("td");
      c.append(x);
      return c;
    };
    const needs = $("span");
    for (const n of def.needs ?? []) needs.append(chip(n, "warn"), " ");
    if (usesCount(def)) needs.append(chip("n", "", "a count: the cue's n fingers"));
    tr.append(
      td(button(`\u25B6 ${name}`, () => {
        st.g = name;
        gSel.querySelector("select").value = name;
        save();
        syncRows();
        detail();
        play(name);
      })),
      td(needs),
      td(String(def.hands ?? 1)),
      td(def.loop ? `${def.loop[0]}\u2013${def.loop[1]} ms` : ""),
      td(`${def.dur} ms`),
      td(`${def.stroke} ms`),
      td(def.hold ? `${def.hold}s the held prop` : def.needs?.includes("prop") ? (({ kit: k, variant: v }) => `${k}${v ? ` ${v}` : ""}`)(PROP_FOR[name] ?? DEFAULT_PROP) : "")
    );
    rows.set(name, tr);
    tbody.append(tr);
  }
  table.append(tbody);
  const syncRows = () => {
    for (const [n, r] of rows) r.setAttribute("aria-current", String(n === st.g));
  };
  syncRows();
  detail();
  ready(st.g);
  const scroll = $("div", "gst-scroll");
  scroll.append(table);
  host.append(head(`Every gesture \xB7 ${names.length}`, "Each is keyframed data in the kit, written once for the acting hand and mirrored. The stroke is the moment that meets the word that motivates it (DESIGN.md \xA77); a loop repeats its middle while the cue asks; needs says what the cue must give it.", "\xA77"), scroll);
  const still = (svg, label, onclick, title) => {
    const f = $("figure", "tile"), art = $("div", "art");
    art.innerHTML = svg;
    f.append(art, $("figcaption", "cap", label));
    f.onclick = onclick;
    if (title) f.title = title;
    return f;
  };
  const emoGrid = $("div", "gst-faces");
  for (const e of emotions) {
    const p = kit.face.emotions[e];
    const extra = [p.headTilt ? `tilt ${p.headTilt}` : "", p.posture ? `posture ${p.posture}` : "", p.blush ? "blush" : "", p.sweat ? "sweat" : "", p.tears ? "tears" : ""].filter(Boolean).join(", ");
    emoGrid.append(still(portrait(FIGURE, kit, { framing: "head", emotion: e, size: 104, trusted: true, idPrefix: `ge-${e}-` }), e, () => {
      stage.mood("a", e);
    }, `tap: the stand-in feels ${e}${extra ? ` (${extra})` : ""}`));
  }
  host.append(head(`Emotions \xB7 ${emotions.length}`, "Each is a preset of face parameters (eyes, lids, brows, mouth, blush, sweat, tears) with a head tilt and a posture. Stills from the SVG backend; tap one to wear it on the stage (it stays until another; neutral is rest). Look for the squint of a real smile, the inner brows of sad and sorry, and the slump of tired.", "\xA76.4"), emoGrid);
  const doc = normalize(FIGURE, kit, { trusted: true }), puppet = compose(doc, kit, { trusted: true });
  const visGrid = $("div", "gst-faces");
  for (const v of visemes) {
    const face = faceFrom({ mouth: kit.face.visemes[v] });
    visGrid.append(still(renderSvg(puppet, kit, { framing: "head", face, size: 104, idPrefix: `gv-${v}-` }), v, () => {
      stage.act({ line: { who: "a", text: SAMPLE[v] ?? "Merhaba!", cam: "close" } });
    }, `tap: the stand-in says \u201C${SAMPLE[v] ?? "Merhaba!"}\u201D`));
  }
  const say = Object.assign($("input"), { type: "text", value: q.get("say") ?? "Merhaba! Bir ekmek, l\xFCtfen. Te\u015Fekk\xFCr ederim." });
  const keys = $("div", "gst-mouth");
  let timer = 0;
  const showKeys = () => {
    keys.replaceChildren();
    for (const k of ctx.lang.speech(say.value).keys) {
      const s = $("span", "", k.v);
      s.append($("small", "", String(Math.round(k.t))));
      s.dataset.t = String(k.t);
      keys.append(s);
    }
  };
  const speak = () => {
    ctx.setQuery({ say: say.value });
    showKeys();
    ready(st.g);
    const run = stage.act({ line: { who: "a", text: say.value, cam: "close" } });
    const spans = [...keys.children], t0 = performance.now();
    clearInterval(timer);
    timer = window.setInterval(() => {
      const t = performance.now() - t0;
      let on = -1;
      spans.forEach((s, i) => {
        if (Number(s.dataset.t) <= t) on = i;
      });
      spans.forEach((s, i) => s.classList.toggle("on", i === on));
      if (t > run.dur + 300) {
        clearInterval(timer);
        spans.forEach((s) => s.classList.remove("on"));
      }
    }, 40);
  };
  ctx.cleanup(() => clearInterval(timer));
  say.onkeydown = (e) => {
    if (e.key === "Enter") speak();
  };
  say.oninput = showKeys;
  showKeys();
  const sayBar = bar("say", say, button("\u25B6 say", speak));
  sayBar.classList.add("gst-say");
  host.append(
    head(`Mouth shapes \xB7 ${visemes.length}`, "The visemes the mouth moves through while a line is said, blended with the emotion's own mouth (so a sad character still looks sad as it speaks). Type a line and say it: the stand-in speaks it in close-up, and the strip below lights each shape at its time (the Turkish plugin's estimate, about 200 ms a vowel). With sound on in the top bar the browser's voice says it and the mouth follows the voice.", "\xA76.4 \xA77"),
    visGrid,
    sayBar,
    keys
  );
  const handGrid = $("div", "gst-faces gst-hands");
  for (const s of HAND_SHAPES) {
    handGrid.append(still(renderSvg(puppet, kit, { framing: "bust", pose: HANDS_UP, alt: { hand_r: s, hand_l: s }, size: 156, idPrefix: `gh-${s}-` }), s, () => {
      const m = /^count(\d)$/.exec(s);
      if (m && kit.gestures.count) {
        st.n = Number(m[1]);
        play("count");
        return;
      }
      const g = names.find((n) => kit.gestures[n].keys.some((k) => k.shape === s || k.shape2 === s));
      if (g) play(g);
    }, `tap: a gesture that uses ${s} plays on the stage`));
  }
  host.append(head(`Hand shapes \xB7 ${HAND_SHAPES.length}`, "One paper piece per shape, switched by the rig per frame (a gesture key names one). Counting starts with the index finger, as in Turkey and Iran; five is the open hand. Here both hands are raised so the shape shows; tap one to see a gesture that uses it.", "\xA76.3"), handGrid);
}
var SAMPLE = { rest: "Hmm.", MBP: "Bebek mi?", A: "Aaa, ama!", E: "Evet, hemen.", I: "Bir \u015Fi\u015Fe.", O: "Oo, okul!", U: "Uzun, uzun.", FV: "F\u0131st\u0131k ve vi\u015Fne." };
export {
  render
};
//# sourceMappingURL=gestures-UECQW64K.js.map
