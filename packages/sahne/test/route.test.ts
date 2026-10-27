// Tests of solid lines and the ways round them (DESIGN.md §7): the router, a piece's lines as placed, and a walk
// the director routes round a railing and through a gate only on an entrance.
import { test } from "node:test";
import assert from "node:assert/strict";
import { speechFallback, matchFallback } from "../src/core/lang.ts";
import { directAll, type DirectCtx } from "../src/director/direct.ts";
import { placeSolids, route, detour, CLEAR, type Solid } from "../src/director/route.ts";
import { evaluate } from "../src/anim/timeline.ts";
import type { PieceDef } from "../src/core/kit.ts";
import type { PlaceDoc } from "../src/core/types.ts";
import type { Cue } from "../src/script/types.ts";

// a railing across the yard from x −3 to 1 at z −1, with a gate (a leaf) from 1 to 2, and a wall beyond it from 2 to 4
const RAIL: Solid = { a: [-3, -1], b: [1, -1] }, GATE: Solid = { a: [1, -1], b: [2, -1], piece: "gate", door: "gate" }, WALL: Solid = { a: [2, -1], b: [4, -1] };
const crossesAny = (pts: number[][], lines: Solid[]) => lines.some(l => pts.slice(1).some((q, i) => {
  const p = pts[i], d = (a: number[], b: number[], c: number[]) => (b[0] - a[0]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[0] - a[0]);
  const A = [l.a[0], 0, l.a[1]], B = [l.b[0], 0, l.b[1]];
  return d(p, q, A) * d(p, q, B) < 0 && d(A, B, p) * d(A, B, q) < 0;
}));

test("a walk that crosses nothing goes straight", () => {
  assert.deepEqual(route([-2, 0, 0], [3, 0, 0.5], [RAIL, GATE, WALL]), []);
});

test("a walk across a railing goes round its end, clear of it, the shortest way", () => {
  const from: [number, number, number] = [-1, 0, 0], to: [number, number, number] = [-1, 0, -2];
  const way = route(from, to, [RAIL, GATE, WALL])!;
  assert.ok(way.length > 0);
  assert.ok(!crossesAny([from, ...way, to], [RAIL, GATE, WALL]), "it crosses no line");
  assert.ok(way.every(p => p[0] < -3 - CLEAR + 1e-9), "round the railing's free end, not through the gate");
  assert.ok(detour(from, to, way) > 0);
  assert.deepEqual(route(from, to, [RAIL, GATE, WALL]), way, "the same way every time");
});

test("a gate is solid but to an entrance or exit through it; a gap in a wall is a way through", () => {
  const from: [number, number, number] = [1.5, 0, 0], to: [number, number, number] = [1.5, 0, -2];
  assert.ok(route(from, to, [RAIL, GATE, WALL])!.length > 0, "a plain walk does not go through the closed gate");
  assert.deepEqual(route(from, to, [RAIL, GATE, WALL], { door: "gate" }), [], "an entrance through it does");
  assert.deepEqual(route(from, to, [RAIL, WALL]), [], "an open gap is a way");
});

test("a line stands only in its states; with nowhere round, there is no way", () => {
  const shutter: Solid = { ...RAIL, in: ["closed"] };
  assert.deepEqual(route([-1, 0, 0], [-1, 0, -2], [shutter], { state: ["open"] }), []);
  assert.ok(route([-1, 0, 0], [-1, 0, -2], [shutter], { state: ["closed"] })!.length > 0);
  // a wall wall to wall across a 4 m floor
  assert.equal(route([0, 0, 0], [0, 0, -2], [{ a: [-6, -1], b: [6, -1] }], { size: { w: 4, d: 3 } }), null);
});

test("a way round keeps the height along the walk, so a climb stays a climb", () => {
  const way = route([-1, 0, 0], [-1, 0.48, -2], [RAIL])!;
  assert.ok(way.every((p, i) => p[1] > 0 && p[1] < 0.48 && (i === 0 || p[1] >= way[i - 1][1])));
});

test("a piece's lines are placed in metres, with its id, its leaves and its states; solid: false has none", () => {
  const fence: PieceDef = { draw: () => ({ flats: [] }), solid: p => [{ a: [-(p.w as number) / 2, 0], b: [0, 0] }, { a: [0, 0], b: [(p.w as number) / 2, 0], door: true }], variants: { long: { w: 400 } } };
  const place = { v: 1, id: "yard", size: { w: 8, d: 4 }, marks: {}, pieces: [
    { kit: "fence", variant: "long", id: "f", x: 1, z: -1, in: ["day"] }, { kit: "fence", w: 200, x: 0, z: -3, solid: false }, { kit: "lamp", x: 0, z: 0 },
  ] } as unknown as PlaceDoc;
  assert.deepEqual(placeSolids(place, { set: { fence, lamp: { draw: () => ({ flats: [] }) } } }), [
    { a: [-1, -1], b: [1, -1], piece: "f", in: ["day"] }, { a: [1, -1], b: [3, -1], piece: "f", door: "f", in: ["day"] },
  ]);
});

// the director: a yard behind railings, the gate a door mark's leaf
const YARD: PlaceDoc = {
  v: 1, id: "yard", size: { w: 8, d: 4 }, pieces: [],
  marks: { gate: { x: 1.5, z: -0.6, door: "gate", out: { x: 1.5, z: -1.8 } }, street: { x: -1, z: 0 }, steps: { x: -1, z: -2 } },
};
const ctx = (solids?: Solid[]): DirectCtx => ({ places: { yard: YARD }, gestures: {}, lang: { id: "x", speech: speechFallback, match: matchFallback }, ...(solids ? { solids: { yard: solids } } : {}) });

test("the director walks round the railing, and through the gate on an exit, opening it on the way", () => {
  const cues: Cue[] = [{ scene: { place: "yard", at: { me: "street" } } }, { beat: { move: { who: "me", to: "steps" } } }, { beat: { move: { who: "me", to: "gate" } } }, { beat: { move: { who: "me", to: "gate", how: "exit" } } }];
  const [, walk] = directAll(cues, ["me"], ctx([RAIL, GATE, WALL]));
  const pts = walk.tracks.me.walks[0].pts;
  assert.ok(pts.length > 2 && !crossesAny(pts, [RAIL, GATE, WALL]), "round, not through");
  assert.equal(directAll(cues, ["me"], ctx())[1].tracks.me.walks[0].pts.length, 2, "without solids it walks straight");
  const exit = directAll(cues, ["me"], ctx([RAIL, GATE, WALL]))[3], door = exit.doors[0];
  assert.ok(door && door.piece === "gate");
  assert.deepEqual(exit.tracks.me.walks[0].pts.at(-1), [1.5, 0, -1.8], "out through the gate");
  assert.ok(evaluate(exit, (door.t0 + door.t1) / 2).doors.gate > 0.9, "open as she passes");
});

test("an exit from behind the railing goes round to the gate's mark first: only the door's own leg passes the leaf", () => {
  const cues: Cue[] = [{ scene: { place: "yard", at: { me: "steps" } } }, { beat: { move: { who: "me", to: "gate", how: "exit" } } }];
  const pts = directAll(cues, ["me"], ctx([RAIL, GATE, WALL]))[1].tracks.me.walks[0].pts;
  assert.ok(!crossesAny(pts.slice(0, -1), [RAIL, GATE, WALL]), "round to the gate's mark, not through the gate");
  assert.ok(crossesAny(pts.slice(-2), [GATE]), "then out through it");
});
