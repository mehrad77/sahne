import {
  bench
} from "./chunk-ZRNRQOB7.js";
import {
  BENCH_CROWD
} from "./chunk-J3KVAIQI.js";
import {
  $,
  bar,
  choice,
  toggle
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/life.ts
var LAB = {
  v: 1,
  id: "life_lab",
  name: { tr: "Deneme hayat\u0131", en: "Test life" },
  size: { w: 10, d: 5 },
  outdoor: true,
  pieces: [
    { kit: "skyline", variant: "sisli", x: 0, z: -60, w: 9e3, scroll: true, ms: 3e4 },
    { kit: "floor", x: 0, z: -7, w: 2400, d: 1200, tile: 55, a: "#BDB5A8", b: "#B1A99B" },
    { kit: "car", variant: "taxi", x: 0, z: -5.4, go: [[-800, 0, 0], [800, 0, 0]], ms: 5e3, wait: 1500 },
    { kit: "flag", variant: "pole", x: -3.6, z: -2.4, h: 360 },
    { kit: "birds", variant: "gulls", x: 0, z: -7, x0: -900, x1: 900, alt: 260, n: 3 },
    { kit: "birds", variant: "pigeons", x: 2.8, z: -1.2, x0: -60, x1: 60, n: 3 }
  ],
  props: { kedi: { kit: "cat", pose: "sit", coat: "ginger", at: { x: -1.2, y: 0, z: -1.8 } } },
  marks: { mid: { x: -1.6, z: 0.3, facing: "r" } },
  times: ["day", "dusk", "night"],
  camera: { wide: { x: 0, w: 9.5, z: -3, y1: 4.2 } },
  ambience: ["traffic"],
  motif: "street",
  surface: "stone"
};
var YARD = {
  v: 1,
  id: "life_yard",
  name: { tr: "Avlu", en: "Yard" },
  size: { w: 9, d: 4 },
  outdoor: true,
  pieces: [
    { kit: "street", variant: "far", x: 0, z: -9, w: 2400 },
    { kit: "floor", x: 0, z: -1.5, w: 1400, d: 700, tile: 60, a: "#C9C2B6", b: "#BDB5A8" },
    { kit: "birds", variant: "pigeons", x: -1.2, z: -1.3, x0: -90, x1: 90, n: 5 },
    { kit: "cat", pose: "sit", coat: "tabby", x: 2.4, z: -1.6 }
  ],
  marks: { left: { x: -3.6, z: 0.2, facing: "r" }, pigeons: { x: -1.2, z: -0.9 }, right: { x: 0.6, z: 0.3, facing: "l" }, cat: { x: 1.9, z: -1.2, facing: "r" }, far: { x: 3.8, z: 0.3 } },
  camera: { wide: { x: 0, w: 9.2, z: -1.6 } }
};
function build(host, ctx) {
  host.append($("h2", "", "Flats that move on their own"), $(
    "p",
    "note",
    "Any flat of a piece or a prop may carry move (FlatMotion), one kind or several. scroll: \u015Ei\u015Fli's towers slide by and start over, the near layer faster (parallax). path: the taxi drives along its offsets, waits, and drives again, hidden while it waits; the gulls cross on paths. sway: the flag rocks about its hoist, the cat's tail flicks, the pigeons peck. blink: a flat shows for a share of each period, so two flats on one clock take turns: the gulls' wings up and down (a walker's two strides, below), and at night the towers' red beacons. All of it runs on the place's own clock (while a cue plays, and with idle life), worked out from the time alone; the top bar's Still holds every flat where it starts, so a place must read well frozen. A prop's own motion can be held too (obj set {still: true})."
  ));
  const lab = bench(host, ctx, { places: [LAB], cues: [{ scene: { place: LAB.id, time: "day", at: {} } }] });
  host.append(bar(
    "try",
    ...["day", "dusk", "night"].map((t) => lab.cue(t, { beat: { env: `time:${t}` } })),
    lab.cue("hold the cat's tail", { beat: { obj: [{ id: "kedi", op: "set", set: { still: true } }] } }),
    lab.cue("let it flick", { beat: { obj: [{ id: "kedi", op: "set", set: { still: false } }] } })
  ));
  host.append($("h2", "", "Crowds, birds and a cat"), $(
    "p",
    "note",
    "Crowds are kit pieces: faceless paper people, seeded, never tapped. A far strip of small people scrolls along the back; two walking lanes (each walker on their own pace, two strides taking turns, a bob; now and then a child beside a grown-up); a group talking; a queue; two on a bench; pigeons pecking, gulls crossing high up, a ginger cat asleep. Flats with when show only while the weather, time or states say so, and fade as they change: rain opens the umbrellas of those who have one, flags (a place state) hands out little flags (more to children), at night fewer people are out. Walk across: the crowds keep clear of the marks people stand on, and they are pick: false, so a tap goes through them."
  ));
  let n = 10;
  const doc = () => ({ ...BENCH_CROWD, pieces: BENCH_CROWD.pieces.map((p) => p.kit === "crowd" && p.variant === "walk" ? { ...p, n: p.z > -2 ? Math.round(n * 0.6) : n } : p) });
  const start = [{ scene: { place: "bench_crowd", at: { a: "left" } } }];
  const crowd = bench(host, ctx, { places: [doc()], cast: { a: ctx.kit.defaultDoc }, cues: start });
  host.append(
    bar("when", ...["time:day", "time:dusk", "time:night", "weather:rain", "weather:clear", "state:flags", "state:-flags"].map((e) => crowd.cue(e.replace(/^\w+:/, "").replace("-flags", "no flags"), { beat: { env: e } }))),
    bar("actor", crowd.cue("walk across", { beat: { move: { who: "a", to: "right" } } }), crowd.cue("walk back", { beat: { move: { who: "a", to: "left" } } })),
    choice("walkers per lane", ["4", "10", "18", "24"], "10", (o) => {
      n = +o;
      crowd.stage.load({ v: 1, cues: start }, { cast: { a: ctx.kit.defaultDoc }, places: { bench_crowd: doc() } });
      crowd.stage.show(0);
    })
  );
  host.append($("h2", "", "Pigeons and a cat answer people"), $(
    "p",
    "note",
    "A flat may react to people on stage and remember it (FlatReact, DESIGN.md \xA76.9): the stage replays where people walked here since the scene began, so seeking and replaying land in the same state; Kerim does not count, and Still keeps everything at home. The pigeons fly up and off to the far side from anyone within 1.3 m (a flying flat with two wingbeats each way, shown only while flying), land 1.4 m off and peck there, and stay; someone walking at them again sends them on. The sitting cat turns its head up to anyone within 2.5 m; within 0.9 m it gets up, walks off and sits down there. With explore on, a tap answers too (FlatReact.tap, on the wall clock, not part of the story): a pigeon flutters up where it is with its wings' p\u0131r p\u0131r, the cat looks up and miaows."
  ));
  const start2 = [{ scene: { place: YARD.id, at: { a: "left" } } }];
  const yard = bench(host, ctx, { places: [YARD], cast: { a: ctx.kit.defaultDoc, kerim: { puppet: "bird" } }, cues: start2, interact: true });
  host.append(
    bar(
      "walk",
      yard.cue("through the pigeons", { beat: { move: { who: "a", to: "pigeons" } } }),
      yard.cue("on past them", { beat: { move: { who: "a", to: "right" } } }),
      yard.cue("up to the cat", { beat: { move: { who: "a", to: "cat" } } }),
      yard.cue("away", { beat: { move: { who: "a", to: "far" } } }),
      yard.cue("back to the start", { beat: { move: { who: "a", to: "left" } } })
    ),
    bar("Kerim", yard.cue("Kerim lands by the pigeons (they stay)", { beat: { move: { who: "kerim", to: "pigeons", how: "fly" } } })),
    bar("tap", toggle("explore", false, (on) => yard.ix?.setExplore(on), "tap as a learner does: a pigeon flutters where it is (p\u0131r p\u0131r), the cat looks up and miaows; sound on (top bar) to hear them"))
  );
}
export {
  build
};
//# sourceMappingURL=life-DRJFQ4E3.js.map
