import {
  live
} from "./chunk-7NDFZUS2.js";
import "./chunk-WB6XEHS3.js";
import "./chunk-D3OMKUXF.js";
import {
  textOf
} from "./chunk-6JPAPIMW.js";
import "./chunk-YGBM7NGP.js";
import "./chunk-CMLP3XCI.js";
import "./chunk-6PR3AWGB.js";
import "./chunk-GO2IY55S.js";
import "./chunk-3BCF3C4G.js";
import "./chunk-ZT53KTYM.js";
import "./chunk-DDNHNEH6.js";
import "./chunk-6IX3XYSS.js";
import {
  BAKKAL
} from "./chunk-VFMRH5SO.js";
import {
  BENCH_CROWD,
  BENCH_FERIKOY,
  BENCH_SHORE
} from "./chunk-J3KVAIQI.js";
import {
  $,
  link
} from "./chunk-4TGKXDN4.js";
import {
  CUE_KINDS,
  STAGING_FIELDS,
  TIMES,
  WEATHER
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/film.ts
var withMarks = (doc, id, marks, o = {}) => ({ ...doc, id, marks: { ...doc.marks, ...marks }, pieces: doc.pieces.filter((p) => p.kit !== o.drop), props: { ...doc.props, ...o.props } });
var [SKY, SKYLINE, , , SEA] = BENCH_SHORE.pieces;
var FILM_PLACES = [
  withMarks(BAKKAL, "film_bakkal", {}, { props: {
    foto: { kit: "photo", variant: "sepia", at: { x: 0.2, y: 0.92, z: -0.5 }, keep: true },
    bavul: { kit: "bag", variant: "suitcase", at: "ismail", keep: true }
  } }),
  withMarks(BENCH_FERIKOY, "film_street", { mid: { x: 0.6, z: 0.3 }, wall: { x: -1, y: 0.78, z: -3.1 }, bakery: { x: 2.6, z: -2.2, facing: "l" } }, { drop: "cat" }),
  // the waterfront in the morning: the sun up over the far shore, the bunting out
  { ...withMarks(BENCH_SHORE, "film_shore", { mid: { x: 0.4, z: 0.3, facing: "l" }, sky: { x: -1.5, y: 3, z: -1.6, air: true } }), times: ["dawn", "day", "golden", "dusk", "night"] },
  withMarks(BENCH_CROWD, "film_crowd", { start: { x: -5.6, z: 0.1, facing: "r" }, stall: { x: 2.2, z: -0.6, facing: "l" } }),
  {
    v: 1,
    id: "film_pier",
    name: { tr: "Karak\xF6y iskelesi", en: "Karak\xF6y pier" },
    size: { w: 14, d: 6 },
    outdoor: true,
    pieces: [
      SKY,
      SKYLINE,
      SEA,
      { kit: "ferry", variant: "alongside", x: 2.6, z: -10, len: 2200, name: "KADIK\xD6Y" },
      { kit: "floor", x: 0, z: -3.2, w: 1600, d: 700, tile: 60, a: "#A9A196", b: "#9D958A" },
      { kit: "lamp_post", variant: "street", x: -2.6, z: -2.9 },
      { kit: "crowd", variant: "walk", x: 0, z: -2.2, x0: -700, x1: 700, n: 5 }
    ],
    marks: { left: { x: -4, z: 0.2, facing: "r" }, mid: { x: 0, z: 0.1 }, gangway: { x: 2.4, z: -2.6 }, deck: { x: 3.4, y: 3.2, z: -8, air: true } },
    props: {},
    times: ["dusk", "night"],
    camera: { wide: { x: 0, w: 12, z: -3.2, y1: 5.5 } },
    ambience: ["waves", "crowd"],
    motif: "sea",
    surface: "stone"
  },
  {
    v: 1,
    id: "film_deck",
    name: { tr: "Vapurun \xFCst g\xFCvertesi", en: "The ferry's upper deck" },
    size: { w: 12, d: 4 },
    outdoor: true,
    pieces: [
      SKY,
      SKYLINE,
      SEA,
      { kit: "ferry", variant: "deck", x: 0, z: -1.6, w: 1400, d: 360, benches: 2 }
    ],
    marks: { rail_l: { x: -1.6, z: -0.6, facing: "r" }, rail_r: { x: 1.2, z: -0.6, facing: "l" }, cayci: { x: 3.2, z: -0.2, facing: "l" }, sky: { x: -3.2, y: 2.4, z: -1.6, air: true } },
    props: {},
    times: ["night"],
    camera: { wide: { x: 0, w: 9, z: -1.6, y1: 4.2 } },
    ambience: ["waves", "ferry_engine"],
    motif: "sea",
    surface: "wood"
  }
];
var FILM_EXTRAS = { baker: "baker_firin", driver: "passenger_3", rider: "passenger_1", seller: "stallholder_1", cayci: "cayci_vapur" };
var CHAPTERS = [
  ["23:31 \xB7 \u0130smail's shop", [
    { scene: { place: "film_bakkal", time: "night", at: { ismail: "counter", nima: "customer", kerim: "ledge" }, cam: "wide" } },
    { line: { who: "ismail", text: "K\u0131z\u0131m yar\u0131n evleniyor! Son vapurla Kad\u0131k\xF6y'e gidiyorum.", to: "nima", do: "hand_heart", emo: "moved" } },
    { line: { who: "nima", text: "Ne g\xFCzel! Tebrikler, \u0130smail Bey!", do: "clap", emo: "happy", react: { ismail: { do: "nod", emo: "happy" } } } },
    { line: { who: "ismail", text: "Saat on bir bu\xE7uk mu?! Ge\xE7 kald\u0131m!", do: "look", at: "mark:clock", emo: "surprised", sfx: { id: "clock_tick", word: "tik tak", at: "mark:clock" }, cam: "close" } },
    { beat: { move: { who: "ismail", to: "door", how: "exit" }, sfx: { id: "shop_bell", word: "\xE7\u0131n \xE7\u0131n" }, cam: "wide" } },
    { line: { who: "kerim", text: "Nima! Foto\u011Fraf! Tezg\xE2hta kald\u0131!", emo: "surprised", cam: "single", sfx: { id: "coo", word: "gu-guu!" } } },
    { line: { who: "nima", text: "K\u0131z\u0131n\u0131n foto\u011Fraf\u0131\u2026 D\xFC\u011F\xFCn hediyesi bu!", obj: [{ id: "foto", op: "take", to: "nima" }], emo: "surprised", cam: "close" } },
    { line: { who: "nima", text: "Vapur gece yar\u0131s\u0131 kalk\u0131yor. Ko\u015F, Nima!", emo: "proud", do: "stop", cam: "single" } },
    { beat: { move: { who: "nima", to: "door", how: "exit" }, sfx: { id: "shop_bell", word: "\xE7\u0131n \xE7\u0131n" }, cam: "wide" } }
  ]],
  ["23:36 \xB7 Ferik\xF6y", [
    { scene: { place: "film_street", time: "night", weather: "rain", state: ["flags"], at: { nima: "left", baker: "bakery", pisi: "wall" }, cam: "wide" } },
    { line: { who: "baker", text: "Nima! Bu saatte nereye?", to: "nima", do: "wave", emo: "curious" } },
    { line: { who: "nima", text: "Karak\xF6y'e! Taksi!", do: "point_far", emo: "nervous", move: { who: "nima", to: "mid", how: "run" }, cam: "follow" } },
    { beat: { who: "pisi", do: "meow", emo: "surprised", sfx: { id: "meow", word: "miyav!" }, env: ["thunder"], cam: "single" } }
  ]],
  ["23:41 \xB7 A taxi", [
    { scene: { place: "bench_taxi_back", time: "night", at: { driver: "driver", nima: "back_l", kerim: "outside" }, cam: "wide" } },
    { line: { who: "nima", text: "Karak\xF6y iskelesi, l\xFCtfen! \xC7ok acil!", do: "point_far", emo: "nervous", cam: "single" } },
    { line: { who: "driver", text: "Tamam abla, bas\u0131yorum!", do: "thumb_up", emo: "proud", cam: "wide" } },
    { beat: { env: ["stop"], sfx: { id: "car_engine", word: "v\u0131\u0131\u0131\u0131n\u2026" }, wait: 1500 } },
    { line: { who: "driver", text: "Eyvah\u2026 trafik. Hi\xE7 k\u0131m\u0131ldam\u0131yor.", do: "shrug", emo: "sorry" } },
    { line: { who: "nima", text: "Olamaz! Metroya!", do: "stop", emo: "annoyed", cam: "close" } }
  ]],
  ["23:47 \xB7 The M11", [
    { scene: { place: "metro_m11", time: "night", at: { nima: "stand_l", rider: "stand_r", kerim: "outside" }, cam: "wide" } },
    { line: { who: "rider", text: "Neden bu kadar acele?", to: "nima", emo: "curious" } },
    { line: { who: "nima", text: "Son vapur! On \xFC\xE7 dakika kald\u0131!", do: "count", n: 3, emo: "nervous", cam: "two" } },
    { line: { who: "kerim", text: "Ben buraday\u0131m, Nima! H\u0131zl\u0131, h\u0131zl\u0131!", emo: "proud", sfx: { id: "wing_flap", word: "p\u0131r p\u0131r" }, cam: "single" } }
  ]],
  ["23:53 \xB7 The market street", [
    { scene: { place: "film_crowd", time: "night", weather: "rain", state: ["flags"], at: { nima: "start", seller: "stall" }, cam: "wide" } },
    { beat: { who: "nima", move: { who: "nima", to: "mid", how: "run" }, sfx: { id: "market_call", word: "taze simit!" }, cam: "follow" } },
    { line: { who: "seller", text: "Dikkat! Yava\u015F, k\u0131z\u0131m!", emo: "surprised", do: "stop", cam: "two" } },
    { line: { who: "nima", text: "Pardon! Vapur ka\xE7\u0131yor!", emo: "nervous", move: { who: "nima", to: "right", how: "run" }, cam: "follow" } }
  ]],
  ["23:59 \xB7 Karak\xF6y pier", [
    { scene: { place: "film_pier", time: "night", weather: "clear", at: { nima: "left" }, cam: "wide" } },
    { beat: { sfx: { id: "ferry_horn", word: "d\xFC\xFC\xFCt!" }, wait: 1400 } },
    { line: { who: "nima", text: "Bekleyin! Bekleyin!", do: "wave", emo: "nervous", move: { who: "nima", to: "gangway", how: "run" }, cam: "follow" } },
    { beat: { move: { who: "kerim", to: "deck", how: "fly" }, sfx: { id: "wing_flap", word: "p\u0131r p\u0131r" }, cam: "wide", wait: 600 } }
  ]],
  ["00:00 \xB7 On board", [
    { scene: { place: "film_deck", time: "night", weather: "clear", at: { ismail: "rail_r", nima: "rail_l", cayci: "cayci", kerim: "sky" }, cam: "wide" } },
    { line: { who: "ismail", text: "Nima?! Sen burada ne ar\u0131yorsun?", emo: "surprised", to: "nima", cam: "two" } },
    { line: { who: "nima", text: "Bunu unuttunuz!", obj: [{ id: "foto", op: "give", to: "ismail" }], do: "give", emo: "proud" } },
    { line: { who: "ismail", text: "K\u0131z\u0131m\u0131n foto\u011Fraf\u0131\u2026 Te\u015Fekk\xFCr ederim, Nima.", do: "hand_heart", emo: "moved", cam: "close" } },
    { line: { who: "cayci", text: "\xC7aylar benden! Ho\u015F geldiniz!", emo: "happy", do: "welcome", sfx: { id: "tea_glass", word: "\u015F\u0131k\u0131r \u015F\u0131k\u0131r" }, cam: "wide" } },
    { beat: { env: ["fireworks:6"], sfx: { id: "fireworks", word: "bum! bum!" }, wait: 1400 } },
    { line: { who: "kerim", text: "Gece yar\u0131s\u0131! Tam zaman\u0131nda.", emo: "happy", react: { nima: { do: "cheer", emo: "laugh" }, ismail: { do: "cheer", emo: "laugh" } } } },
    { beat: { env: ["fireworks:6"], wait: 3600 } }
  ]],
  ["09:00 \xB7 Kad\u0131k\xF6y, the next morning", [
    { scene: { place: "film_shore", time: "dawn", weather: "clear", state: ["flags", "bridge_red_white"], at: { ismail: "right", nima: "mid", kerim: "sky" }, cam: "wide" } },
    { beat: { env: ["time:day:4000"], sfx: { id: "gull", word: "ak ak" }, wait: 2400 } },
    { line: { who: "ismail", text: "K\u0131z\u0131m foto\u011Fraf\u0131 g\xF6r\xFCnce a\u011Flad\u0131. \xC7ok mutluydu!", to: "nima", do: "hand_heart", emo: "moved" } },
    { line: { who: "nima", text: "Ne g\xFCzel bir sabah! G\xFCne\u015F de a\xE7t\u0131.", do: "look", at: "viewer", emo: "laugh", cam: "two" } },
    { line: { who: "kerim", text: "Son vapur ka\xE7mad\u0131. Yava\u015F yava\u015F\u2026 ama zaman\u0131nda!", emo: "happy", sfx: { id: "coo", word: "gu-guu" }, cam: "wide", react: { nima: { do: "wave", emo: "happy" }, ismail: { do: "wave", emo: "happy" } } } },
    { beat: { move: { who: "kerim", to: "sky", how: "fly" }, wait: 3200 } }
  ]]
];
var FILM = { v: 1, cues: CHAPTERS.flatMap(([, cues]) => cues) };
var FILM_TITLES = (() => {
  const m = /* @__PURE__ */ new Map();
  let i = 0;
  for (const [title, cues] of CHAPTERS) {
    m.set(i, title);
    i += cues.length;
  }
  return m;
})();

// src/sections/home.ts
var FEATURES = [
  ["Cut-paper puppets", "People built from a kit of parts: faces that talk and blink, 39 gestures and 14 emotions, walks, carries and idle life, all posed by one rig.", "#/systems/actors"],
  ["A director", "You write who says what. The director picks the gaze, the gesture's timing, the listeners' reactions and the camera shot.", "#/systems/director"],
  ["Light and weather", "Dawn to night and overcast, rain, thunder and fireworks; windows and lamps glow after dark. The art is never redrawn: one shader lights the paper.", "#/systems/light"],
  ["Places from set pieces", "Streets, shops, roofs and waterfronts made of parametric pieces, with crowds, birds and traffic that live in them.", "#/places"],
  ["Sound, made in code", "A synthesizer and a sequencer: sound effects, ambience and music motifs, the browser's voice keeping time with the mouths.", "#/systems/audio"],
  ["Learners act", "Tap, drag, choose or say it aloud. Hints, an accessible list, and tap-to-translate on the bubbles' words.", "#/systems/interact"],
  ["Avatars", "A builder screen and a few hundred bytes of JSON per person; SVG portraits for lists and cards.", "#/systems/avatar"],
  ["Stories", "A story format with turns, choices and acts, its lints and a player, ready for an app to draw.", "#/stories/s1e00"]
];
var QUICK = `import { mountStage } from "sahne";
import kit from "sahne-kit/full";
import tr from "sahne-tr";

const stage = mountStage(el, { kit, lang: tr });
stage.load(script, { cast: { nima, ismail }, places: { bench_shore } });
stage.show(0);
for (let i = 1; i < script.cues.length; i++) await stage.play(i).done;`;
async function render(host, ctx) {
  const k = ctx.kit;
  const hero = $("section", "hero");
  const word = $("h1", "wordmark");
  word.setAttribute("aria-label", "Sahne, Turkish for \u201Cstage\u201D");
  word.append($("span", "word"), $("small", "", "Turkish for \u201Cstage\u201D"));
  const go = $("div", "ctas");
  const cta = (label, href, main = false) => {
    const a = link(label, href);
    a.className = `cta${main ? " main" : ""}`;
    return a;
  };
  const gh = cta("GitHub \u2197", "https://github.com/mehrad77/sahne");
  gh.target = "_blank";
  gh.rel = "noopener";
  go.append(cta("Get started", "#/docs/start", true), cta("See every system", "#/systems/script"), cta("Play a story", "#/stories/s1e00"), gh);
  hero.append(word, $("p", "tagline", "A paper-theatre stage engine for interactive scenes on the web: cut-paper puppets, lip-sync, light and weather, sound, all drawn in code."), go);
  host.append(hero);
  const stageSlot = $("div", "hero-stage");
  host.append(stageSlot);
  const title = $("div", "film-title"), cap = $("div", "film-cap");
  title.append($("small", "", "Sahne presents"), $("b", "", "Son Vapur"), $("span", "", "The Last Ferry \xB7 a film in one script"));
  let capTimer = 0;
  const extras = new Map((await ctx.data("extras").catch(() => [])).map((x) => [x.file.replace(/\.json$/, ""), x]));
  const cast = Object.fromEntries(Object.entries(FILM_EXTRAS).map(([actor, id]) => [actor, extras.get(id)?.avatar ?? ctx.kit.defaultDoc]));
  const names = Object.fromEntries(Object.entries(FILM_EXTRAS).map(([actor, id]) => [actor, textOf(extras.get(id)?.name) ?? actor]));
  const chapter = Number(ctx.route.query.get("chapter") ?? 0), starts = [...FILM_TITLES.keys()];
  const film = await live(stageSlot, ctx, FILM, { loop: true, controls: false, preroll: 2600, places: FILM_PLACES, cast, names, start: starts[chapter] ?? 0, onCue: (i) => {
    if (i === 0 && !chapter) {
      title.classList.add("on");
      setTimeout(() => title.classList.remove("on"), 2800);
    }
    const t = FILM_TITLES.get(i);
    if (!t) return;
    cap.textContent = t;
    cap.classList.add("on");
    clearTimeout(capTimer);
    capTimer = setTimeout(() => cap.classList.remove("on"), 3200);
  } });
  ctx.cleanup(() => clearTimeout(capTimer));
  film.box.append(title, cap);
  host.append($("p", "note", `Live, not a video: a ${FILM.cues.length}-cue script in ${FILM_TITLES.size} places, directed and drawn in your browser as it plays. Turn on sound in the top bar.`));
  host.append($("h2", "", "What it is"));
  for (const t of [
    "Sahne plays illustrated dialogue scenes the way a paper theatre would: flat, hand-cut figures in layers, lit like a stage. An app writes a script (who speaks, to whom, with what gesture) and Sahne directs and performs it: the timing, the gaze, the shots, the mouths, the sounds.",
    "Everything is drawn in code from a kit (people, set pieces, props, sounds and music), so a whole city of scenes costs a few hundred kilobytes, not a folder of images. The engine has no dependencies and renders with WebGL2, with an SVG backend for stills.",
    "It is built for language learning. Sahne is the stage of Kumru, an app for learning Turkish, and its Turkish plugin times the mouths from the spelling. The engine itself knows no language and no app."
  ]) host.append($("p", "prose-p", t));
  host.append($("h2", "", "What it does"));
  const feats = $("div", "cards");
  for (const [title2, text, hash] of FEATURES) {
    const a = link("", hash);
    a.className = "card";
    a.append($("b", "", title2), $("small", "", text));
    feats.append(a);
  }
  host.append(feats);
  host.append($("h2", "", "In a few lines"));
  const pre = $("pre", "code");
  pre.textContent = QUICK;
  const more = $("p", "note");
  more.append("The whole walk-through, with a scene that plays: ", link("Your first scene", "#/docs/start"), ". The design, the formats and the budgets: ", link("DESIGN.md", "#/docs/design"), ".");
  host.append(pre, more);
  const defs = /* @__PURE__ */ new Set([...Object.values(k.set), ...Object.values(k.props)]);
  const variants = [...defs].reduce((n, d) => n + Object.keys(d.variants ?? {}).length, 0);
  const sounds = Object.values(k.sounds ?? {});
  const [places, drafts, world] = await Promise.all([ctx.data("places").catch(() => []), ctx.data("drafts").catch(() => []), ctx.data("world").catch(() => [])]);
  const planned = world.filter((w) => !w.placeholder).length;
  const stats = [
    ["set generators", defs.size, "#/kit/set"],
    ["their variants", variants, "#/kit/set"],
    ["set pieces / props", `${Object.keys(k.set).length} / ${Object.keys(k.props).length}`, "#/kit/set"],
    ["character parts", Object.keys(k.parts).length, "#/kit/people"],
    ["gestures", Object.keys(k.gestures).length, "#/kit/gestures"],
    ["emotions", Object.keys(k.face.emotions).length, "#/kit/gestures"],
    ["sound effects", sounds.filter((s) => !s.loop).length, "#/kit/sound"],
    ["ambience loops", sounds.filter((s) => s.loop).length, "#/kit/sound"],
    ["music motifs", Object.keys(k.motifs ?? {}).length, "#/kit/sound"],
    ["places built", planned ? `${places.length} of ${planned}` : places.length, "#/places"],
    ["stories", drafts.length, "#/stories"],
    ["cue kinds \xB7 staging fields", `${CUE_KINDS.length} \xB7 ${STAGING_FIELDS.length}`, "#/systems/script"],
    ["times \xB7 weathers", `${Object.keys(TIMES).length} \xB7 ${Object.keys(WEATHER).length}`, "#/systems/light"]
  ];
  const grid = $("div", "cards stats");
  for (const [label, n, hash] of stats) {
    const a = link("", hash);
    a.className = "card";
    a.append($("b", "", String(n)), $("small", "", label));
    grid.append(a);
  }
  host.append($("h2", "", "In the gallery"), grid);
  const foot = $("p", "note");
  foot.append("Code MIT, art CC BY 4.0, except Kerim, Kumru's mascot, whose art is all rights reserved. ", link("Contributing", "#/docs/contributing"), " \xB7 ", link("For maintainers", "#/dev"));
  host.append(foot);
}
export {
  render
};
//# sourceMappingURL=home-TS525KHQ.js.map
