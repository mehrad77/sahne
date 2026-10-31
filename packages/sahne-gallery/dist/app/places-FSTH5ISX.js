import {
  bench
} from "./chunk-ZRNRQOB7.js";
import {
  BENCH_ROOM,
  BENCH_STREET
} from "./chunk-J3KVAIQI.js";
import {
  $,
  bar,
  button,
  toggle
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// ../sahne-story/samples/places/metro_m11.json
var metro_m11_default = {
  ambience: [
    "traffic"
  ],
  camera: {
    wide: {
      w: 6.4,
      x: 0,
      z: -1.5
    }
  },
  id: "metro_m11",
  life: "run",
  marks: {
    outside: {
      air: true,
      pace: true,
      x: 2.6,
      y: 1.45,
      z: -2.4
    },
    outside_far: {
      air: true,
      pace: true,
      x: -2.4,
      y: 1.45,
      z: -2.6
    },
    stand_l: {
      facing: "r",
      x: -0.55,
      z: -0.35
    },
    stand_r: {
      facing: "l",
      x: 0.5,
      z: -0.35
    },
    window: {
      x: -2.15,
      y: 1.4,
      z: -1.6
    }
  },
  motif: "street",
  name: {
    en: "The metro (M11)",
    fa: "\u0645\u062A\u0631\u0648 (M11)",
    tr: "Metro (M11)"
  },
  perch: "outside",
  pieces: [
    {
      kit: "metro_floor",
      x: 0,
      z: -1.65
    },
    {
      kit: "scroll_view",
      layer: "clouds",
      stops: true,
      w: 3600,
      x: 0,
      y: 1.4,
      z: -13.6
    },
    {
      kit: "scroll_view",
      layer: "platform",
      stops: true,
      x: 0,
      y: -0.05,
      z: -2.6
    },
    {
      kit: "scroll_view",
      layer: "hills",
      stops: true,
      w: 2200,
      x: 0,
      y: -1.3,
      z: -9.6
    },
    {
      kit: "scroll_view",
      layer: "town",
      stops: true,
      w: 1300,
      x: 0,
      y: -0.6,
      z: -5.6
    },
    {
      kit: "scroll_view",
      layer: "masts",
      stops: true,
      w: 1e3,
      x: 0,
      y: -0.1,
      z: -2.9
    },
    {
      kit: "metro_wall",
      stops: true,
      x: 0,
      z: -1.6
    },
    {
      ends: [
        "Havaliman\u0131",
        "Gayrettepe"
      ],
      kit: "route_strip",
      line: "M11",
      n: 7,
      stops: true,
      x: 0,
      y: 2.1,
      z: -1.57
    },
    {
      kit: "metro_display",
      stations: [
        "\u0130stanbul Havaliman\u0131",
        "\u0130hsaniye",
        "G\xF6kt\xFCrk",
        "Kemerburgaz",
        "Hasdal",
        "Ka\u011F\u0131thane",
        "Gayrettepe"
      ],
      stops: true,
      x: 0,
      y: 2.6,
      z: -1.56
    },
    {
      kit: "metro_bench",
      x: -2.15,
      z: -1.45
    },
    {
      kit: "metro_bench",
      x: 2.15,
      z: -1.45
    },
    {
      kit: "metro_straps",
      x: -2.15,
      z: -1.22
    },
    {
      kit: "metro_straps",
      x: 2.15,
      z: -1.22
    },
    {
      kit: "metro_pole",
      x: -1.12,
      z: -1.1
    },
    {
      kit: "metro_pole",
      x: 1.12,
      z: -1.1
    },
    {
      kit: "metro_pole",
      x: 2,
      z: 0.9
    },
    {
      id: "pencere",
      kit: "metro_window",
      terms: [
        "seed-w02"
      ],
      x: -2.15,
      z: -1.59
    },
    {
      front: true,
      gap: 46,
      kind: "sit",
      kit: "crowd",
      n: 2,
      x: 2.61,
      x0: 0,
      x1: 46,
      z: -1.4
    },
    {
      front: true,
      kind: "sit",
      kit: "crowd",
      n: 1,
      x: -3.07,
      x0: 0,
      x1: 0,
      z: -1.4
    },
    {
      kit: "metro_riders",
      x: 0,
      z: -1.6
    }
  ],
  props: {
    gazete: {
      at: {
        x: -1.5,
        y: 0.45,
        z: -1.35
      },
      kit: "print",
      terms: [
        "a1-w-gazete"
      ],
      variant: "newspaper"
    },
    istanbulkart: {
      at: {
        x: -2.6,
        y: 0.45,
        z: -1.35
      },
      decor: true,
      kit: "pass",
      variant: "istanbulkart"
    },
    kulaklik: {
      at: {
        x: 1.55,
        y: 0.45,
        z: -1.35
      },
      kit: "gadget",
      terms: [
        "a1-w-kulaklik"
      ],
      variant: "headphones"
    },
    sirt_cantasi: {
      at: {
        x: 2,
        y: 0,
        z: -1.2
      },
      kit: "pack",
      terms: [
        "a1-w-canta"
      ],
      variant: "backpack"
    },
    tren: {
      at: {
        x: 5.4,
        y: -0.1,
        z: -4.2
      },
      kit: "metro_alongside",
      terms: [
        "a1-w-metro"
      ]
    },
    ucak: {
      air: true,
      at: {
        x: -2.9,
        y: 1.1,
        z: -9
      },
      kit: "airport_plane",
      terms: [
        "a1-w-ucak"
      ],
      w: 320
    }
  },
  site: "metro",
  size: {
    d: 3,
    w: 8
  },
  stops: {
    stations: [
      "\u0130stanbul Havaliman\u0131",
      "\u0130hsaniye",
      "G\xF6kt\xFCrk",
      "Kemerburgaz",
      "Hasdal",
      "Ka\u011F\u0131thane",
      "Gayrettepe"
    ]
  },
  surface: "stone",
  times: [
    "day",
    "golden",
    "dusk",
    "night"
  ],
  v: 1
};

// src/systems/places.ts
var OTHER = { ...BENCH_STREET, id: "bench_other", site: void 0, name: { tr: "Ba\u015Fka sokak", en: "Another street" } };
function build(host, ctx) {
  const me = ctx.kit.defaultDoc;
  host.append($("h2", "", "States and sites"), $(
    "p",
    "note",
    "The test room has states: shop and waiting are one group (one at a time), pictures is a toggle. A piece, mark or prop with in: [states] shows only in them: the bread goes with the shop, the benches come with the waiting room. env state:<s> is a cut; with :fade, a 0.4 s fade. The test street is another place of the same site (site: bench): she takes the loaves, goes out, and still holds them though they are not kept props, and no motif plays. Another street, a site of its own, plays its motif. Back in the room, it is as she left it; a scene's state picks the layout on the way in."
  ));
  let raised = false, fade = true;
  const room = () => raised ? { ...BENCH_ROOM, camera: { wide: { ...BENCH_ROOM.camera.wide, y1: 4 } } } : BENCH_ROOM;
  const start = [{ scene: { place: "bench_room", at: { a: "mid" } } }];
  const TAKE = { beat: { who: "a", obj: [{ id: "ekmek", op: "take" }] } }, STREET = { scene: { place: "bench_street", at: { a: "mid" } } };
  const AWAY = { scene: { place: "bench_other", at: { a: "mid" } } }, BACK = { scene: { place: "bench_room", at: { a: "mid" } } };
  const WAITING = { scene: { place: "bench_room", state: ["waiting"], at: { a: "mid" } } };
  const extra = [{ at: 1, cues: [TAKE, STREET, BACK] }, { at: 1, cues: [TAKE, AWAY, WAITING] }];
  const site = bench(host, ctx, { places: [BENCH_ROOM, BENCH_STREET, OTHER], cast: { a: me }, cues: start, load: { extra } });
  const log = $("p", "note");
  const say = () => {
    const w = site.stage.world(), held = Object.values(w.actors.a?.hold ?? {}).map((id) => `${id} (${w.props[id]?.n ?? 1})`);
    const music = site.stage.perf?.sounds.filter((s) => s.music).map((s) => s.id).join(", ");
    log.textContent = `place ${w.place} \xB7 states ${(w.state ?? []).join(", ") || "its defaults"} \xB7 she holds ${held.join(", ") || "nothing"} \xB7 music on this cue: ${music || "none"}`;
  };
  const cue = (label, c) => button(label, () => {
    site.play(typeof c === "function" ? c() : c).done.then(say);
  });
  const st = (s) => () => ({ beat: { env: `state:${s}${fade ? ":fade" : ""}` } });
  const reload = () => {
    site.stage.load({ v: 1, cues: start }, { cast: { a: me }, places: { bench_room: room(), bench_street: BENCH_STREET, bench_other: OTHER }, extra });
    site.stage.show(0);
    say();
  };
  host.append(
    log,
    bar("states", cue("shop", st("shop")), cue("waiting", st("waiting")), cue("pictures off", st("-pictures")), cue("pictures on", st("pictures")), toggle(":fade", fade, (on) => {
      fade = on;
    }, "a 0.4 s fade instead of a cut")),
    bar(
      "site",
      cue("take the loaves", TAKE),
      cue("to the street (same site)", STREET),
      cue("to another street (another site)", AWAY),
      cue("back to the room", BACK),
      cue("back as the waiting room", WAITING),
      button("start again", reload)
    ),
    $("p", "note", "The wide band: the wide shot fits camera.wide's width at its depth, and its height from y0 to y1 (default 0.15 to 2.45 m, people standing). A stairwell or a roof with a water tank raises y1; here to 4 m, so the frame pulls back to show the whole wall."),
    bar("wide band", toggle("raise y1 to 4 m", false, (on) => {
      raised = on;
      reload();
    }))
  );
  setTimeout(say, 300);
  host.append($("h2", "", "A vehicle's clock, and Kerim keeping pace"), $(
    "p",
    "note",
    `A place's own clock moves its flats (\xA76.9). It runs while a cue plays and with idle life, which stops after a while without input (here 8 s rather than 20, to see it sooner); then the view outside freezes. The M11 car on the right is a running place (life: "run"): its clock goes on for as long as it is on stage, at 30 frames a second, and Kerim's air marks outside are pace marks, so she flies along, wings beating, drifting about her spot. On the left the same car without either: leave the page alone and it stops, and Kerim only hovers. The top bar's Still holds both where they start.`
  ));
  const after = metro_m11_default;
  const before = { ...after, id: "metro_still", life: void 0, marks: Object.fromEntries(Object.entries(after.marks).map(([k, m]) => [k, { ...m, pace: void 0 }])) };
  const pair = $("div");
  pair.style.cssText = "display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px";
  host.append(pair);
  const cars = [];
  for (const [label, doc] of [["no life: run, no pace marks", before], ["life: run, pace marks", after]]) {
    const fig = $("figure");
    fig.style.margin = "0";
    pair.append(fig);
    const b = bench(fig, ctx, { places: [doc], cast: { kerim: { puppet: "bird" } }, cues: [{ scene: { place: doc.id, at: { kerim: "outside" } } }], stage: { idleTimeout: 8e3 } });
    const n = $("figcaption", "", label);
    fig.append(n);
    cars.push({ stage: b.stage, n, play: b.play });
  }
  const t0 = performance.now();
  const iv = setInterval(() => cars.forEach((c) => {
    const life = c.stage.lifeT;
    c.n.textContent = `${c.n.textContent.split(" \xB7 ")[0]} \xB7 ${((performance.now() - t0) / 1e3).toFixed(0)} s on the page \xB7 the place's clock at ${(life / 1e3).toFixed(1)} s`;
  }), 500);
  ctx.cleanup(() => clearInterval(iv));
  host.append(bar(
    "both",
    button("Kerim to the far window", () => cars.forEach((c) => c.play({ beat: { move: { who: "kerim", to: "outside_far", how: "fly" } } }))),
    button("back to the near window", () => cars.forEach((c) => c.play({ beat: { move: { who: "kerim", to: "outside", how: "fly" } } })))
  ));
  host.append($("h2", "", "A train that stops, and a story that stops it"), $(
    "p",
    "note",
    `The M11 car keeps a timetable (its place's stops, \xA76.9): on its own it runs from station to station, easing into each; the doors slide open, one passenger gets off and another gets on, the doors shut and it pulls away, while the display reads "Gelecek istasyon: \u2026" on the leg and the station's name at the stop. A story can take hold of it: env stop:<station> brings it in to that station (from where it is if it is already on its way there, else on the whole leg to it) and holds it there with the doors open; env depart shuts the doors and goes on. A scene can open standing at a station (scene.stop). Only the flats on the stops clock wait; the straps, the train alongside and Kerim keep the place's own clock.`
  ));
  const stops = (after.stops?.stations ?? []).slice(1);
  const train = bench(host, ctx, { places: [after], cast: { kerim: { puppet: "bird" } }, cues: [{ scene: { place: after.id, at: { kerim: "outside" } } }] });
  host.append(
    bar("stop at", ...stops.map((st2) => train.cue(st2, { beat: { env: `stop:${st2}` } }))),
    bar("then", train.cue("depart", { beat: { env: "depart" } }), train.cue("open at Hasdal (scene.stop)", { scene: { place: after.id, at: { kerim: "outside" }, stop: "Hasdal" } }), train.cue("let it run", { scene: { place: after.id, at: { kerim: "outside" } } }))
  );
}
export {
  build
};
//# sourceMappingURL=places-FSTH5ISX.js.map
