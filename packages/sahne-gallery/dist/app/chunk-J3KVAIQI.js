import {
  __export
} from "./chunk-PZ5AY32C.js";

// src/bench.ts
var bench_exports = {};
__export(bench_exports, {
  BENCH_CLASS: () => BENCH_CLASS,
  BENCH_CROWD: () => BENCH_CROWD,
  BENCH_FERIKOY: () => BENCH_FERIKOY,
  BENCH_FLAT: () => BENCH_FLAT,
  BENCH_PARTY: () => BENCH_PARTY,
  BENCH_ROOF: () => BENCH_ROOF,
  BENCH_ROOM: () => BENCH_ROOM,
  BENCH_SHORE: () => BENCH_SHORE,
  BENCH_STAIRS: () => BENCH_STAIRS,
  BENCH_STREET: () => BENCH_STREET,
  BENCH_TAXI: () => BENCH_TAXI,
  BENCH_TAXI_BACK: () => BENCH_TAXI_BACK
});
var BENCH_ROOM = {
  v: 1,
  id: "bench_room",
  site: "bench",
  name: { tr: "Deneme odas\u0131", en: "Test room" },
  size: { w: 8, d: 4 },
  states: { shop: { group: "layout", default: true }, waiting: { group: "layout" }, pictures: { default: true }, cold: { cold: true } },
  pieces: [
    { kit: "street", x: 0, z: -4.6, w: 1500 },
    { kit: "floor", x: 0, z: -2.25, w: 1200, d: 1e3 },
    { kit: "wall", x: 0, z: -2.2, w: 1100, h: 430, openings: [{ x: -350, y: 0, w: 105, h: 220 }, { x: -40, y: 105, w: 150, h: 115 }] },
    { kit: "door_shop", id: "door", x: -3.5, z: -2.19 },
    { kit: "window", x: -0.4, y: 1.05, z: -2.19, w: 150, h: 115 },
    { kit: "lamp", x: 0.4, y: 2.3, z: -0.95 },
    // the shop
    { kit: "shelf", x: 2.35, z: -2.06, w: 230, h: 235, in: ["shop"] },
    { kit: "counter", x: 0.5, z: -0.35, w: 230, h: 86, in: ["shop"] },
    { kit: "fridge", x: -2.5, z: -2.06, in: ["shop"] },
    // the waiting room
    { kit: "bench_row", x: 1.6, z: -1.7, n: 3, in: ["waiting"] },
    { kit: "plant", x: 3.3, z: -1.8, in: ["waiting"] },
    { kit: "plant", x: -2.3, z: -1.8, in: ["waiting"] },
    // a toggle
    { kit: "picture", x: 0.8, y: 1.45, z: -2.18, in: ["pictures"] },
    { kit: "calendar", x: 3.75, y: 1.42, z: -2.18, in: ["pictures"] },
    { kit: "clock", x: -3.5, y: 2.36, z: -2.18, in: ["pictures"] }
  ],
  marks: {
    door: { x: -3.45, z: -1.15, door: "door", out: { x: -3.45, z: -2.95 } },
    mid: { x: -0.6, z: 0.15, facing: "r" },
    counter: { x: 0.64, z: -0.8, facing: "l", in: ["shop"] },
    bench: { x: 1.6, z: -1.2, in: ["waiting"], seat: 0.45 },
    ledge: { x: 2.35, y: 2.42, z: -2.05 }
  },
  props: {
    ekmek: { kit: "bread", n: 3, at: { x: 0.18, y: 0.9, z: -0.43 }, in: ["shop"], terms: ["a1-w-ekmek"] },
    sut: { kit: "milk", n: 2, at: { x: 1.4, y: 0.47, z: -1.5 }, in: ["waiting"], terms: ["a1-w-sut"] },
    caydanlik: { kit: "tea", variant: "caydanlik", at: { x: 1.1, y: 0.9, z: -0.45 }, in: ["shop"], terms: ["a1-w-caydanlik"] }
  },
  times: ["day", "golden", "dusk", "night"],
  camera: { wide: { x: -0.4, w: 8.2, z: -2.1 } },
  ambience: ["street_far"],
  motif: "home",
  surface: "tile",
  perch: "ledge"
};
var BENCH_STREET = {
  v: 1,
  id: "bench_street",
  site: "bench",
  name: { tr: "Deneme soka\u011F\u0131", en: "Test street" },
  size: { w: 9, d: 4 },
  pieces: [
    { kit: "street", x: 0, z: -3.6, w: 1500 },
    { kit: "floor", x: 0, z: -1.8, w: 1500, d: 500, tile: 55, a: "#BDB5A8", b: "#B1A99B" },
    { kit: "plant", x: -3.2, z: -2.6 }
  ],
  marks: { mid: { x: 0, z: 0.1, facing: "r" }, far: { x: 2.4, z: -1.6 } },
  props: {},
  times: ["day", "golden", "dusk", "night"],
  camera: { wide: { x: 0, w: 8.6, z: -2.2 } },
  ambience: ["traffic"],
  motif: "street",
  surface: "stone"
};
var BENCH_STAIRS = {
  v: 1,
  id: "bench_stairs",
  site: "bench",
  name: { tr: "Deneme merdiveni", en: "Test stairs" },
  size: { w: 9, d: 4 },
  pieces: [
    { kit: "floor", x: 0, z: -2, w: 1200, d: 800 },
    { kit: "stairwell", x: -2.9, z: -1.45, doors: true }
  ],
  // the kit's stairwell (2c.4): two flights of 8 risers, 28 cm treads, 110 cm landings; marks at its foot, top and landings
  marks: {
    hall: { x: -4, z: -0.2, facing: "r" },
    foot: { x: -3.04, z: -1.3 },
    top1: { x: -0.8, y: 1.44, z: -1.3 },
    landing1: { x: -0.39, y: 1.44, z: -1.3 },
    foot2: { x: 0.02, y: 1.44, z: -1.3 },
    top2: { x: 2.26, y: 2.88, z: -1.3 },
    landing2: { x: 2.67, y: 2.88, z: -1.3, facing: "l" }
  },
  times: ["day", "dusk", "night"],
  // the band is fitted at the back wall (z −2.1); she stands nearer, so it reaches above her head on the top landing
  camera: { wide: { x: -0.6, w: 7.8, z: -2.1, y1: 5.3 } },
  ambience: ["street_far"],
  motif: "home",
  surface: "stone"
};
var BENCH_CROWD = {
  v: 1,
  id: "bench_crowd",
  name: { tr: "Deneme kalabal\u0131\u011F\u0131", en: "Test crowd" },
  size: { w: 12, d: 6 },
  outdoor: true,
  states: { flags: {} },
  pieces: [
    { kit: "street", x: 0, z: -6.5, w: 2e3 },
    { kit: "crowd", variant: "far", x: 0, z: -6.1, x0: -900, x1: 900 },
    { kit: "floor", x: 0, z: -6.4, w: 2e3, d: 900, tile: 60, a: "#BDB5A8", b: "#B1A99B" },
    { kit: "crowd", variant: "walk", x: 0, z: -3.6, x0: -900, x1: 900, n: 10 },
    { kit: "crowd", variant: "walk", x: 0, z: -1.9, x0: -900, x1: 900, n: 6 },
    { kit: "crowd", variant: "stand", x: 0, z: -2.7, x0: 180, x1: 420, n: 5 },
    { kit: "crowd", variant: "queue", x: 0, z: -2.9, x0: -420, x1: -260, n: 4, dir: 1 },
    { kit: "bench_row", x: -1.2, z: -3.05, n: 3 },
    { kit: "crowd", variant: "sit", x: -1.2, z: -3, x0: -60, x1: 60, n: 2, seat: 44 },
    { kit: "birds", variant: "pigeons", x: 1, z: -0.9, x0: -120, x1: 120, n: 5 },
    { kit: "birds", variant: "gulls", x: 0, z: -5, x0: -900, x1: 900, alt: 300, n: 3 },
    { kit: "cat", x: 3.4, y: 0, z: -1.2, pose: "sleep", coat: "ginger" }
  ],
  marks: { left: { x: -4.5, z: 0.2, facing: "r" }, right: { x: 4.5, z: 0.2, facing: "l" }, mid: { x: 0, z: 0.3 } },
  props: {},
  times: ["day", "dusk", "night"],
  camera: { wide: { x: 0, w: 10, z: -2.6, y1: 2.8 } },
  ambience: ["crowd", "traffic"],
  motif: "street",
  surface: "stone"
};
var BENCH_ROOF = {
  v: 1,
  id: "bench_roof",
  name: { tr: "Deneme \xE7at\u0131s\u0131", en: "Test roof" },
  size: { w: 10, d: 4 },
  outdoor: true,
  pieces: [
    { kit: "night_sky", x: 0, y: -14, z: -160, w: 26e3, h: 12e3 },
    { kit: "street", x: 10, y: -14, z: -95, w: 9e3, switch: false },
    { kit: "street", x: -12, y: -14, z: -55, w: 6e3, switch: false },
    { kit: "street", x: 6, y: -14, z: -28, w: 3600, switch: false },
    { kit: "floor", x: 0, z: -2.6, w: 1200, d: 700, tile: 50, a: "#B6ADA0", b: "#AAA193" },
    { kit: "wall", x: 0, z: -2.6, w: 1200, h: 95, tiles: 0, color: "#C9BBA6" }
  ],
  marks: { left: { x: -3, z: -0.6, facing: "r" }, right: { x: 3, z: -0.6, facing: "l" }, mid: { x: 0, z: 0 } },
  props: {},
  times: ["golden", "dusk", "night"],
  camera: { wide: { x: 0, w: 10, z: -2.6, y1: 4.2 } },
  ambience: ["street_far"],
  motif: "home",
  surface: "stone"
};
var BENCH_SHORE = {
  v: 1,
  id: "bench_shore",
  name: { tr: "Deneme sahili", en: "Test shore" },
  size: { w: 12, d: 5 },
  outdoor: true,
  states: { flags: {}, bridge_red_white: {} },
  pieces: [
    { kit: "night_sky", x: 0, y: -2, z: -220, w: 36e3, h: 12e3, phase: 0.3 },
    { kit: "skyline", variant: "asian_shore", x: 0, y: -2, z: -140, w: 22e3 },
    { kit: "landmark", variant: "bosphorus_bridge", x: 10, y: -2, z: -110, red_white: "bridge_red_white" },
    { kit: "landmark", variant: "ortakoy_mosque", x: -14, y: -1.5, z: -55 },
    { kit: "sea", variant: "moon", x: 0, y: -1.2, z: -3.2, w: 6e3, d: 9e3 },
    { kit: "floor", x: 0, z: -3.2, w: 1600, d: 700, tile: 60, a: "#B8B0A3", b: "#ACA497" },
    { kit: "railing", variant: "shore", x: 0, z: -3.15, w: 1600 },
    { kit: "flag", variant: "bunting", x: 0, y: 2.3, z: -1, w: 1400, in: ["flags"] },
    { kit: "crowd", variant: "walk", x: 0, z: -2.4, x0: -800, x1: 800, n: 12, flags: 0.7 }
  ],
  marks: { left: { x: -4, z: 0.2, facing: "r" }, right: { x: 4, z: 0.2, facing: "l" } },
  props: {},
  times: ["golden", "dusk", "night"],
  camera: { wide: { x: 0, w: 11, z: -3, y1: 4.5 } },
  ambience: ["waves", "crowd"],
  motif: "sea",
  surface: "stone"
};
var BENCH_FERIKOY = {
  v: 1,
  id: "bench_ferikoy",
  name: { tr: "Deneme Ferik\xF6y", en: "Test Ferik\xF6y" },
  size: { w: 14, d: 5 },
  outdoor: true,
  states: { flags: {}, window_lit: {} },
  pieces: [
    { kit: "skyline", variant: "ferikoy", x: 0, z: -60, w: 9e3 },
    { kit: "facade", variant: "apartment", x: -9.5, z: -4.2, seed: "bench_apt" },
    { kit: "facade", variant: "apartment_old", x: -3.2, z: -4, lit: [4], litState: "window_lit" },
    { kit: "frontage", variant: "firin", x: 2.6, z: -4 },
    { kit: "frontage", variant: "eczane", x: 6.2, z: -4 },
    { kit: "frontage", variant: "cafe", x: 9.6, z: -4 },
    { kit: "floor", x: 0, z: -4, w: 2400, d: 900, tile: 50, a: "#BDB5A8", b: "#B1A99B" },
    { kit: "steps", x: -3.2, z: -3.7 },
    { kit: "lamp_post", variant: "street", x: 0.6, z: -3.2 },
    { kit: "tree", x: 4.6, z: -3.3, season: "autumn" },
    { kit: "garden_wall", x: -1.2, z: -3.1, w: 170, h: 75 },
    { kit: "cat", x: -1, y: 0.78, z: -3.1, pose: "sleep", coat: "tabby" },
    { kit: "bench", variant: "street", x: 7.8, z: -2.9 },
    { kit: "crowd", variant: "walk", x: 0, z: -2.4, x0: -1100, x1: 1100, n: 6 }
  ],
  marks: { left: { x: -4, z: 0.2, facing: "r" }, right: { x: 4, z: 0.2, facing: "l" } },
  props: {},
  times: ["day", "golden", "dusk", "night"],
  camera: { wide: { x: 0, w: 13, z: -3.4, y1: 6 } },
  ambience: ["street_far", "traffic"],
  motif: "street",
  surface: "stone"
};
var BENCH_FLAT = {
  v: 1,
  id: "bench_flat",
  name: { tr: "Deneme dairesi", en: "Test flat" },
  size: { w: 8, d: 4 },
  states: { cold: { cold: true } },
  pieces: [
    { kit: "street", x: 0, z: -6, w: 1400, switch: false },
    { kit: "floor", x: 0, z: -2.25, w: 1e3, d: 700, tile: 30, a: "#C9B79C", b: "#BFAD92" },
    { kit: "wall", x: 0, z: -2.2, w: 1e3, h: 420, tiles: 0, color: "wall_mint", openings: [{ x: 160, y: 0, w: 170, h: 230 }] },
    { kit: "balcony", variant: "door", x: 1.6, z: -2.19 },
    { kit: "door", variant: "flat", id: "door", x: -3.2, z: -2.18, number: "4" },
    { kit: "heater", variant: "boiler", x: -1.5, y: 1.3, z: -2.17 },
    { kit: "heater", variant: "radiator", x: 0, z: -2.15 },
    { kit: "lamp", x: 0, y: 2.6, z: -1 }
  ],
  marks: { door: { x: -3.2, z: -1.2, door: "door", out: { x: -3.2, z: -3 } }, mid: { x: -0.5, z: 0 }, balcony: { x: 1.6, z: -1.4 } },
  times: ["day", "dusk", "night"],
  camera: { wide: { x: -0.4, w: 8, z: -2.1 } },
  ambience: ["street_far"],
  motif: "home",
  surface: "wood"
};
var BENCH_PARTY = {
  v: 1,
  id: "bench_party",
  name: { tr: "Deneme do\u011Fum g\xFCn\xFC", en: "Test birthday" },
  size: { w: 6, d: 4 },
  pieces: [
    { kit: "floor", x: 0, z: -2, w: 800, d: 600, tile: 40, a: "#B98E62", b: "#AE8358" },
    { kit: "wall", x: 0, z: -2, w: 800, h: 320, tiles: 0, color: "wall_cream" },
    { kit: "table", variant: "party", x: 0, z: -1.2, w: 180 },
    { kit: "lamp", x: 0, y: 1.75, z: -1.2 }
  ],
  props: {
    pasta: { kit: "cake", candles: 8, flavor: "chocolate", at: { x: -0.1, y: 0.76, z: -1.25 } },
    mum: { kit: "candle", n: 5, at: { x: 0.55, y: 0.76, z: -1.15 } },
    cay: { kit: "tea", variant: "glass", hot: true, n: 2, at: { x: -0.65, y: 0.76, z: -1.15 } }
  },
  marks: { here: { x: 1.3, z: -0.5, facing: "l" } },
  times: ["day", "dusk", "night"],
  camera: { wide: { x: 0.3, w: 3.3, z: -1.2, y1: 2 } },
  ambience: ["street_far"],
  motif: "home",
  surface: "wood"
};
var BENCH_CLASS = {
  v: 1,
  id: "bench_class",
  name: { tr: "Deneme s\u0131n\u0131f\u0131", en: "Test class" },
  size: { w: 9, d: 5 },
  pieces: [
    { kit: "street", x: 0, z: -7, w: 1600 },
    { kit: "floor", x: 0, z: -2.6, w: 1100, d: 800, tile: 40, a: "#CDBFA6", b: "#C2B399" },
    { kit: "wall", x: 0, z: -2.6, w: 1100, h: 400, tiles: 0, color: "wall_cream", openings: [{ x: 300, y: 90, w: 150, h: 140 }] },
    { kit: "window", x: 3, y: 0.9, z: -2.58, w: 150, h: 140 },
    { kit: "board", variant: "white", x: -0.4, y: 0.9, z: -2.56, lines: ["Masa\u2026 masalar.", "Sandalye\u2026 sandalyeler."] },
    { kit: "board", variant: "map", x: -3.4, y: 1, z: -2.56, pins: 4 },
    { kit: "clock", x: 1.4, y: 2.5, z: -2.57, time: "9:10" },
    { kit: "desk", variant: "teacher", x: 1.6, z: -1.9 },
    { kit: "chair", variant: "school", x: -2.4, z: -1.5, n: 3, facing: "back" },
    ...[-3.3, -2.4, -1.5].map((x) => ({ kit: "desk", variant: "school", x, z: -1 })),
    { kit: "chair", variant: "waiting_row", x: 3.6, z: -2.2 },
    { kit: "lamp", variant: "standing", x: -4.2, z: -2.3 }
  ],
  marks: { teacher: { x: 1.6, z: -1.3, facing: "l" }, front: { x: 0.2, z: 0.4 } },
  times: ["day", "dusk", "night"],
  camera: { wide: { x: 0, w: 9.5, z: -2.6 } },
  ambience: ["corridor_murmur"],
  motif: "school",
  surface: "tile"
};
var BENCH_TAXI = {
  v: 1,
  id: "bench_taxi",
  name: { tr: "Deneme taksisi", en: "Test taxi" },
  size: { w: 6, d: 3 },
  life: "run",
  pieces: [
    { kit: "skyline", variant: "sisli", x: 0, y: 0.25, z: -170, w: 16e3, h: 4e3 },
    { kit: "road", x: 0, y: 0.25, z: -1.2 },
    { kit: "cabin", variant: "taxi", x: 0, z: -1.2, w: 460, fare: "48,50" }
  ],
  marks: { back: { x: 0.6, z: -0.2, facing: "l" } },
  times: ["day", "dusk", "night"],
  camera: { wide: { x: 0, w: 4.2, z: -1.2, y0: -0.1, y1: 2.2 } },
  ambience: ["car_engine"],
  motif: "street",
  surface: "carpet"
};
var BENCH_TAXI_BACK = {
  v: 1,
  id: "bench_taxi_back",
  name: { tr: "Deneme taksisi, arka koltuk", en: "Test taxi, back seat" },
  size: { w: 6, d: 3 },
  life: "run",
  pieces: [
    { kit: "skyline", variant: "sisli", x: 0, y: 0.25, z: -170, w: 16e3, h: 4e3 },
    { kit: "road", variant: "back", x: 0, y: 0.25, z: -1.2 },
    { kit: "cabin", variant: "taxi_back", x: 0, z: -1.2, w: 460 }
  ],
  // the marks needs.json asks of the taxi: the rear bench (three seats: a seat mark seats whoever is put or walks there, until
  // they move), the driver (the car's left, so screen right from the windscreen) and the front passenger, facing the way the
  // car goes, so towards us, as the camera sits at the windscreen; and Kerim flying along outside the side window
  marks: {
    back_l: { x: -0.55, z: -0.9, seat: 0.55 },
    back_m: { x: 0, z: -0.9, seat: 0.55 },
    back_r: { x: 0.55, z: -0.9, seat: 0.55 },
    driver: { x: 1, z: 0.45, seat: 0.55 },
    front: { x: -1, z: 0.45, seat: 0.55 },
    outside: { x: -1.85, y: 1.35, z: -0.6, air: true, pace: true }
  },
  times: ["day", "dusk", "night"],
  camera: { wide: { x: 0, w: 4.2, z: -1.2, y0: -0.1, y1: 2.4 } },
  ambience: ["car_engine"],
  motif: "street",
  surface: "carpet"
};

export {
  BENCH_ROOM,
  BENCH_STREET,
  BENCH_STAIRS,
  BENCH_CROWD,
  BENCH_ROOF,
  BENCH_SHORE,
  BENCH_FERIKOY,
  BENCH_FLAT,
  BENCH_PARTY,
  BENCH_TAXI_BACK,
  bench_exports
};
//# sourceMappingURL=chunk-J3KVAIQI.js.map
