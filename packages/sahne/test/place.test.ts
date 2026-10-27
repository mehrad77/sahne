// Tests of a place's set pieces (DESIGN.md §5.5): each piece draws from its own seed (`pieceSeed`),
// so adding, removing or reordering a piece leaves the others' art as it was, `seed` pins a piece's
// art across places, and a piece repeated in two places of one site draws the same.
import { test } from "node:test";
import assert from "node:assert/strict";
import { drawPieces, pieceSeed } from "../src/stage.ts";
import { rng } from "../src/core/rng.ts";
import { groupSvg } from "../src/art/shape.ts";
import type { PieceRef, PlaceDoc } from "../src/core/types.ts";
import { withVariant } from "../src/core/kit.ts";
import { whenWeight } from "../src/script/world.ts";
import { moveAt } from "../src/anim/move.ts";
import kit from "../../sahne-kit/src/full.ts";

/** A piece's art as text: every flat's drawing and offsets, as the stage would draw it in this place. */
function art(place: Pick<PlaceDoc, "id" | "site">, p: PieceRef) {
  const out = kit.set[p.kit].draw(p, rng(pieceSeed(place, p)), kit);
  return out.flats.map(f => `${f.x ?? 0},${f.y ?? 0},${f.z ?? 0}:${groupSvg(f.group)}`).join("\n");
}

const SHELF: PieceRef = { kit: "shelf", x: 2.35, z: -2.06 };
const STREET: PieceRef = { kit: "street", x: 0, z: -9 };
const OTHER: PieceRef = { kit: "shelf", x: -1.5, z: -2.06, w: 180 };

test("the random pieces are random: two seeds draw two shelves and two streets", () => {
  assert.notEqual(art({ id: "a" }, SHELF), art({ id: "b" }, SHELF));
  assert.notEqual(art({ id: "a" }, STREET), art({ id: "b" }, STREET));
});

test("the stage draws each piece on its own seed: adding, removing or reordering one leaves the others", () => {
  const set = (pieces: PieceRef[]) => new Map(drawPieces({ id: "bakkal", pieces }, kit).map(({ p, out }) =>
    [p, out.flats.map(f => groupSvg(f.group)).join("\n")]));
  const lists = [[SHELF, STREET], [STREET, SHELF], [OTHER, STREET, SHELF], [SHELF], [OTHER, SHELF, STREET]];
  const shelves = lists.map(l => set(l).get(SHELF)), streets = lists.filter(l => l.includes(STREET)).map(l => set(l).get(STREET));
  for (const s of shelves) assert.equal(s, shelves[0]);
  for (const s of streets) assert.equal(s, streets[0]);
  // what the stage draws is what `pieceSeed` gives
  assert.equal(set([OTHER, SHELF]).get(SHELF), art({ id: "bakkal" }, SHELF).split("\n").map(l => l.slice(l.indexOf(":") + 1)).join("\n"));
});

test("the seed: the piece's id when it has one, else its kit and position; moving a piece redraws it", () => {
  assert.equal(pieceSeed({ id: "bakkal" }, { ...SHELF, id: "back" }), "bakkal|back");
  assert.equal(pieceSeed({ id: "bakkal" }, SHELF), "bakkal|shelf@2.35,0,-2.06");
  assert.notEqual(pieceSeed({ id: "bakkal" }, SHELF), pieceSeed({ id: "bakkal" }, { ...SHELF, x: 2 }));
  // with an id it can move and keep its art
  assert.equal(art({ id: "bakkal" }, { ...SHELF, id: "back" }), art({ id: "bakkal" }, { ...SHELF, id: "back", x: 2 }));
});

test("`seed` pins a piece's art across places; places of one site draw a shared piece the same", () => {
  assert.equal(art({ id: "ferikoy" }, { ...STREET, seed: "nima_building" }), art({ id: "rooftop" }, { ...STREET, seed: "nima_building" }));
  assert.equal(art({ id: "metro_m11", site: "metro" }, STREET), art({ id: "metro_osmanbey", site: "metro" }, STREET));
  assert.notEqual(art({ id: "metro_m11" }, STREET), art({ id: "metro_osmanbey" }, STREET));
});

// ---- place states and sites -------------------------------------------------

import { inState, placeState, placeProps, propKey, siteOf } from "../src/script/world.ts";
import { wideBox } from "../src/render/paper/camera.ts";
import { directAll, type DirectCtx } from "../src/director/direct.ts";
import { evaluate } from "../src/anim/timeline.ts";
import { speechFallback, matchFallback } from "../src/core/lang.ts";
import type { Cue } from "../src/script/types.ts";

const CLASS: PlaceDoc = {
  v: 1, id: "class", size: { w: 8, d: 4 },
  states: { full: { group: "people", default: true }, empty: { group: "people" }, exam: { group: "layout" }, flags: {} },
  pieces: [{ kit: "wall", x: 0, z: -2 }, { kit: "shelf", id: "desks", x: 0, z: -1, in: ["full"] }, { kit: "shelf", id: "apart", x: 0, z: -1, in: ["exam"] }],
  marks: { door: { x: -3, z: -1 }, desk: { x: 0, z: -0.5, in: ["full"] }, exam_desk: { x: 1, z: -0.5, in: ["exam"] } },
  props: { saat: { kit: "clock", at: { x: 0, y: 2, z: -2 } }, bayrak: { kit: "milk", at: { x: 1, y: 2, z: -2 }, in: ["flags"] } },
};

test("placeState: defaults, a group's states exclude each other, toggles, and -s turns one off", () => {
  assert.deepEqual(placeState(CLASS, undefined), ["full"]);
  assert.deepEqual(placeState(CLASS, undefined, "empty"), ["empty"]);
  assert.deepEqual(placeState(CLASS, ["full"], ["exam", "flags"]), ["exam", "flags", "full"]);
  assert.deepEqual(placeState(CLASS, ["exam", "flags", "full"], "-flags"), ["exam", "full"]);
  assert.deepEqual(placeState(CLASS, ["full"], "nope"), ["full"], "an unknown state is ignored (with a warning)");
  assert.ok(inState(undefined, []) && inState(["full"], ["full", "flags"]) && !inState(["exam"], ["full"]));
});

test("a prop's states stay out of its look; siteOf gives a place's site, else its own id", () => {
  const p = placeProps(CLASS).bayrak;
  assert.deepEqual(p.in, ["flags"]);
  assert.ok(!propKey(p).includes("flags"));
  assert.equal(siteOf({ metro_m11: { ...CLASS, id: "metro_m11", site: "metro" } }, "metro_m11"), "metro");
  assert.equal(siteOf({ class: CLASS }, "class"), "class");
});

test("wideBox: the wide shot's band defaults to people standing, and a place may raise it", () => {
  assert.deepEqual(wideBox({ size: { w: 8, d: 4 } }), { x0: -3.44, x1: 3.44, y0: 0.15, y1: 2.45, z: -2 });
  const stairs = wideBox({ size: { w: 6, d: 4 }, camera: { wide: { x: 0, w: 5, z: -2, y0: 0.15, y1: 6 } } });
  assert.equal(stairs.y1, 6);
});

const ctx2 = (places: Record<string, PlaceDoc>): DirectCtx => ({ places, gestures: {}, lang: { id: "x", speech: speechFallback, match: matchFallback } });

test("a scene starts in the place's defaults plus its state; env state: cuts or fades, and the same place keeps its states", () => {
  const cues: Cue[] = [
    { scene: { place: "class", at: { a: "door" }, state: "flags" } },
    { beat: { env: "state:empty" } },
    { beat: { env: ["state:exam:fade", "state:-flags"] } },
    { scene: { place: "class", at: { a: "door" } } },
  ];
  const ps = directAll(cues, ["a"], ctx2({ class: CLASS }));
  assert.deepEqual(ps[0].after.state, ["flags", "full"]);
  assert.deepEqual(ps[1].after.state, ["empty", "flags"]);
  assert.deepEqual(evaluate(ps[1], 0).state, { from: ["flags", "full"], to: ["empty", "flags"], k: 1 }, "a cut");
  assert.deepEqual(ps[2].after.state, ["empty", "exam"]);
  const mid = evaluate(ps[2], 200).state;
  assert.ok(mid.k > 0.3 && mid.k < 0.7, `a fade is halfway at 200 ms (${mid.k})`);
  assert.deepEqual(ps[3].after.state, ["empty", "exam"], "the same place keeps its states");
});

test("env state:<s>:roll is a slow fade: 1.4 s, and the beat lasts as long", () => {
  const ps = directAll([{ scene: { place: "class", at: { a: "door" } } }, { beat: { env: "state:empty:roll" } }], ["a"], ctx2({ class: CLASS }));
  assert.equal(evaluate(ps[1], 200).state.k < 0.1, true, "a roll is still near its start at 200 ms");
  const mid = evaluate(ps[1], 700).state;
  assert.ok(mid.k > 0.4 && mid.k < 0.6, `halfway at 700 ms (${mid.k})`);
  assert.equal(evaluate(ps[1], 1400).state.k, 1);
  assert.ok(ps[1].dur >= 1400, `the beat lasts the roll (${ps[1].dur})`);
});

test("places of one site: no motif between them, every prop carries, and leaving the site drops what waited", () => {
  const street: PlaceDoc = { v: 1, id: "nima_street", site: "nima", size: { w: 8, d: 4 }, pieces: [], motif: "home",
    marks: { door: { x: 0, z: -1 } }, props: { box: { kit: "milk", n: 3, at: { x: 0, y: 0, z: -1 } }, cat: { kit: "milk", at: { x: 1, y: 0, z: -1 } } } };
  const stairs: PlaceDoc = { ...street, id: "nima_stairs", props: { box: { kit: "milk", n: 1, at: { x: 0, y: 0, z: -1 } } } };
  const park: PlaceDoc = { ...street, id: "park", site: undefined, motif: "street", props: { cat: { kit: "milk", at: { x: 1, y: 0, z: -1 } } } };
  const cues: Cue[] = [
    { scene: { place: "nima_street", at: { a: "door" } } },
    { beat: { who: "a", obj: [{ id: "box", op: "add", n: 2 }, { id: "cat", op: "hide" }] } },
    { scene: { place: "nima_stairs", at: { a: "door" } } },
    { scene: { place: "nima_street", at: { a: "door" } } },
    { scene: { place: "park", at: { a: "door" } } },
  ];
  const ps = directAll(cues, ["a"], ctx2({ nima_street: street, nima_stairs: stairs, park }));
  assert.ok(!ps[2].sounds.some(s => s.music), "no motif from the street to the stairs");
  assert.equal(ps[2].after.props.box.n, 5, "the box's count carries, though box is not a kept prop");
  assert.ok(ps[2].after.away?.cat?.site === "nima", "the cat waits for another place of the site");
  assert.equal(ps[3].after.props.cat.shown, false, "back on the street, the cat is as it was left");
  assert.ok(ps[4].sounds.some(s => s.music && s.id === "street"), "a new site plays its motif");
  assert.equal(ps[4].after.props.cat.shown, true, "another site starts its own props afresh");
  assert.ok(!Object.values(ps[4].after.away ?? {}).some(p => p.site === "nima"), "what waited for the site is dropped");
});

test("a bird that flies to a pace mark flies along there; to a plain air mark she hovers", () => {
  const car: PlaceDoc = { v: 1, id: "car", size: { w: 6, d: 3 }, pieces: [], life: "run",
    marks: { seat: { x: 0, z: 0 }, beside: { x: 2, y: 1.4, z: -2.4, air: true, pace: true }, above: { x: -2, y: 2, z: -2, air: true } } };
  const c: DirectCtx = { ...ctx2({ car }), puppets: { k: { kind: "bird", gestures: {} } } } as DirectCtx;
  const ps = directAll([{ scene: { place: "car", at: { k: "beside" } } }, { beat: { move: { who: "k", to: "above", how: "fly" } } }, { beat: { move: { who: "k", to: "beside", how: "fly" } } }], ["k"], c);
  assert.deepEqual([ps[0].after.actors.k.air, ps[0].after.actors.k.pace], [true, true], "placed on it");
  assert.deepEqual([ps[1].after.actors.k.air, ps[1].after.actors.k.pace], [true, false], "hovering above");
  assert.equal(evaluate(ps[2], ps[2].dur).actors.k.pace, true, "flown back: flying along");
});

// ---- props moved by the script -----------------------------------------------

import { polyAt, polyLength } from "../src/core/math.ts";

test("polyAt goes along a polyline at an even speed", () => {
  const pts: [number, number, number][] = [[0, 0, 0], [1, 0, 0], [1, 0, 3]];
  assert.equal(polyLength(pts), 4);
  assert.deepEqual(polyAt(pts, 0.25), [1, 0, 0]);
  assert.deepEqual(polyAt(pts, 0.5), [1, 0, 1]);
  assert.deepEqual(polyAt(pts, 1), [1, 0, 3]);
});

const YARD: PlaceDoc = { v: 1, id: "yard", size: { w: 8, d: 4 }, pieces: [],
  marks: { here: { x: -3, z: 0 }, bowl1: { x: -2, z: -1 }, bowl2: { x: 0, z: -1 }, bowl3: { x: 2, z: -1 } },
  props: { kedi: { kit: "milk", at: "bowl1" }, top: { kit: "milk", at: { x: 1, y: 0, z: 0 } } } };

test("obj go: a prop goes along marks to a mark; the world has it there, the timeline between, and seeking is exact", () => {
  const ps = directAll([
    { scene: { place: "yard", at: { a: "here" } } },
    { beat: { obj: [{ id: "kedi", op: "go", via: ["bowl2"], to: "bowl3", ms: 2000 }] } },
    { beat: { obj: [{ id: "top", op: "set", set: { still: true } }] } },
  ], ["a"], ctx2({ yard: YARD }));
  const p = ps[1];
  assert.deepEqual(p.after.props.kedi.at, [2, 0, -1], "the world: at the last mark");
  assert.equal(p.paths?.length, 1);
  assert.ok(p.dur >= 2000);
  // it sets off when the beat's prop changes do (t0), and takes the 2 s asked
  const t0 = p.paths![0].t0;
  assert.equal(p.paths![0].t1 - t0, 2000);
  assert.deepEqual(evaluate(p, t0).props.kedi.at, [-2, 0, -1], "starts at its place");
  assert.deepEqual(evaluate(p, t0 + 1000).props.kedi.at, [0, 0, -1], "halfway: at the middle bowl");
  const x = (t: number) => evaluate(p, t0 + t).props.kedi.at![0];
  assert.ok(x(500) > -2 && x(500) < 0 && x(1500) > 0 && x(1500) < 2);
  assert.equal(x(1234), x(1234), "the same time, the same place");
  assert.deepEqual(evaluate(p, t0 + 2500).props.kedi.at, [2, 0, -1]);
  // still holds its motion, and is not part of its look
  assert.equal(ps[2].after.props.top.still, true);
  assert.ok(!propKey(ps[2].after.props.top).includes("still"));
});

test("obj go: a held prop or an unknown mark does not go", () => {
  const ps = directAll([
    { scene: { place: "yard", at: { a: "here" } } },
    { beat: { obj: [{ id: "kedi", op: "go", to: "nowhere" }] } },
  ], ["a"], ctx2({ yard: YARD }));
  assert.deepEqual(ps[1].after.props.kedi.at, [-2, 0, -1]);
  assert.equal(ps[1].paths, undefined);
});

// ---- stairs ------------------------------------------------------------------

import { walkAt } from "../src/anim/timeline.ts";

const STAIRS: PlaceDoc = { v: 1, id: "stairs", size: { w: 6, d: 4 }, pieces: [],
  marks: { hall: { x: -2, z: 0 }, foot: { x: -1, z: -0.5 }, landing1: { x: 0, y: 1.44, z: -1.5 }, landing2: { x: 1.5, y: 2.88, z: -1.5 }, side: { x: 2, z: 0 } } };

test("a walk up the stairs: through the via marks in order, a riser at a time, settling on each tread", () => {
  const ps = directAll([{ scene: { place: "stairs", at: { a: "hall" } } }, { beat: { move: { who: "a", to: "landing2", via: ["foot", "landing1"] } } }], ["a"], ctx2({ stairs: STAIRS }));
  const w = ps[1].tracks.a.walks[0];
  assert.deepEqual(w.pts.map(p => p[1]), [0, 0, 1.44, 2.88], "hall, foot, landing 1, landing 2");
  assert.deepEqual(w.steps, [0, 8, 8], "a flat leg, then two flights of 8 risers");
  // height never goes down on the way up, and stands still on each tread for a while
  let prev = -1, flat = 0;
  for (let t = w.t0; t <= w.t1; t += 10) { const y = walkAt(w, t).pos[1]; assert.ok(y >= prev - 1e-9, `${y} after ${prev}`); if (Math.abs(y - prev) < 1e-6) flat++; prev = y; }
  assert.ok(flat > 20, "it plateaus on the treads");
  assert.equal(walkAt(w, w.t1).pos[1], 2.88);
  // the steps counted on the stairs are its risers
  assert.ok(Math.abs(walkAt(w, w.t1).phase - (Math.hypot(1, 0.5) / w.stride + 16)) < 1e-6);
  const mid = walkAt(w, (w.t0 + w.t1) / 2);
  assert.ok(mid.climb > 0, "climbing");
  // a walk on the flat is as it was: no steps, no climb
  const flatWalk = directAll([{ scene: { place: "stairs", at: { a: "hall" } } }, { beat: { move: { who: "a", to: "side" } } }], ["a"], ctx2({ stairs: STAIRS }))[1].tracks.a.walks[0];
  assert.equal(flatWalk.steps, undefined);
  assert.equal(walkAt(flatWalk, (flatWalk.t0 + flatWalk.t1) / 2).climb, 0);
  // and down again: climb is negative, and it takes longer than the flat distance alone
  const down = directAll([{ scene: { place: "stairs", at: { a: "landing2" } } }, { beat: { move: { who: "a", to: "hall", via: ["landing1", "foot"] } } }], ["a"], ctx2({ stairs: STAIRS }))[1].tracks.a.walks[0];
  assert.ok(walkAt(down, (down.t0 + down.t1) / 2).climb < 0);
});

test("a variant is a named set of params: the piece's own params override it, and an unknown one draws the defaults", () => {
  const seen: Record<string, unknown>[] = [];
  const def = { draw: (p: Record<string, unknown>) => { seen.push(p); return { flats: [] }; }, variants: { folding: { kind: "folding", w: 40 } } };
  const k = { ...kit, set: { ...kit.set, chair_t: def } };
  drawPieces({ id: "v", pieces: [{ kit: "chair_t", x: 0, z: 0, variant: "folding" }, { kit: "chair_t", x: 1, z: 0, variant: "folding", w: 50 }, { kit: "chair_t", x: 2, z: 0, variant: "nope" }] }, k);
  assert.deepEqual(seen.map(p => [p.kind, p.w]), [["folding", 40], ["folding", 50], [undefined, undefined]]);
  assert.equal(withVariant(def, { variant: "folding", n: 3 }).n, 3);
});

test("when: a flat follows the weather, the time and the place's states, blending as they change", () => {
  const f = (weather: [string, string, number], time: [string, string, number] = ["day", "day", 1], state: [string[], string[], number] = [[], [], 1]) =>
    ({ weather: { from: weather[0], to: weather[1], k: weather[2] }, time: { from: time[0], to: time[1], k: time[2] }, state: { from: state[0], to: state[1], k: state[2] } });
  const umbrella = { weather: ["rain"] };
  assert.equal(whenWeight(umbrella, f(["clear", "clear", 1])), 0);
  assert.equal(whenWeight(umbrella, f(["rain", "rain", 1])), 1);
  assert.equal(whenWeight(umbrella, f(["clear", "rain", 0.5])), 0.5);
  const daytime = { time: ["day", "dusk"] };
  assert.equal(whenWeight(daytime, f(["clear", "clear", 1], ["dusk", "night", 0.25])), 0.75);
  assert.equal(whenWeight({ state: ["flags"] }, f(["clear", "clear", 1], undefined, [[], ["flags"], 1])), 1);
  assert.equal(whenWeight({ weather: ["rain"], state: ["flags"] }, f(["rain", "rain", 1], undefined, [[], [], 1])), 0, "each list must hold");
});

test("a blink can start part of the way through its cycle: two strides take turns", () => {
  const a = { blink: { ms: 500, on: 0.5, at: 0 } }, b = { blink: { ms: 500, on: 0.5, at: 0.5 } };
  for (const t of [0, 100, 260, 400, 777, 1234]) assert.notEqual(moveAt(a, t) === null, moveAt(b, t) === null, `exactly one at ${t}`);
});
