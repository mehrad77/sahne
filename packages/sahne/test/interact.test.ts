// Tests of the stage's interaction (DESIGN.md §9): hit-test geometry and alpha masks, the act
// state machine, what an act's answer does to the world, and what `inspect` reports.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lookAt, mat4Mul, perspective, project, type Vec3 } from "../src/core/math.ts";
import { AlphaMasks, MASK_SCALE, isTarget, maskHit, parseTarget, partOf, pickTop, poolAlpha, rayAt, rayFloor, rayQuad, rayTri, rayZ, type Pick } from "../src/interact/hit.ts";
import { HINT_AT, SHOW_AT, dragged, inspectOf, nameOf, resolvedCue, skipAct, startAct, targetOf, tryAct, type SceneInfo } from "../src/interact/act.ts";
import { speechFallback, matchFallback } from "../src/core/lang.ts";
import { direct, directAll, fold, glance, type DirectCtx } from "../src/director/direct.ts";
import { evaluate } from "../src/anim/timeline.ts";
import type { GestureDef } from "../src/core/kit.ts";
import type { PlaceDoc } from "../src/core/types.ts";
import type { Act, ActCue, Cue } from "../src/script/types.ts";

// ---- Geometry ----------------------------------------------------------------------------------

const near = (a: number, b: number, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);

test("the ray through a projected point passes through the point, for any camera", () => {
  const cams = [
    { eye: [0, 1.4, 6] as Vec3, target: [0, 1.1, 0] as Vec3, fov: 0.52 },
    { eye: [2, 2.5, 3] as Vec3, target: [-0.5, 0.8, -1] as Vec3, fov: 0.8 },
  ];
  for (const cam of cams) for (const aspect of [1.6, 0.56]) {
    const vp = mat4Mul(perspective(cam.fov, aspect, 0.1, 200), lookAt(cam.eye, cam.target));
    for (const p of [[0.3, 1.0, -0.4], [-2.4, 0.97, -2], [1.5, 2.2, 0.5]] as Vec3[]) {
      const q = project(vp, p), r = rayAt(cam, aspect, q[0], q[1]);
      // the closest point of the ray to p is p itself
      const v: Vec3 = [p[0] - r.o[0], p[1] - r.o[1], p[2] - r.o[2]], t = v[0] * r.d[0] + v[1] * r.d[1] + v[2] * r.d[2];
      const c: Vec3 = [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t];
      assert.ok(Math.hypot(c[0] - p[0], c[1] - p[1], c[2] - p[2]) < 1e-4, `ray misses ${p}`);
    }
  }
});

test("the floor point under a projected floor point is that point; above the horizon there is none", () => {
  const cam = { eye: [0, 1.4, 6] as Vec3, target: [0, 1.1, 0] as Vec3, fov: 0.52 }, aspect = 1.6;
  const vp = mat4Mul(perspective(cam.fov, aspect, 0.1, 200), lookAt(cam.eye, cam.target));
  for (const p of [[0.3, 0, -0.4], [-2.4, 0, -2], [1.5, 0, 1.5]] as Vec3[]) {
    const q = project(vp, p), f = rayFloor(rayAt(cam, aspect, q[0], q[1]))!;
    assert.ok(f && Math.hypot(f[0] - p[0], f[1], f[2] - p[2]) < 1e-4, `floor point misses ${p}`);
  }
  const shelf = rayFloor(rayAt(cam, aspect, 0, -0.2), 0.9)!;
  near(shelf[1], 0.9);
  assert.equal(rayFloor(rayAt(cam, aspect, 0, 0.9)), null, "a ray going up never meets the floor");
});

// a 1 m square standing at z = −2, art's top left at (−0.5, 2), as the stage builds flats (y down the art)
const SQ: [Vec3, Vec3, Vec3, Vec3] = [[-0.5, 2, -2], [0.5, 2, -2], [0.5, 1, -2], [-0.5, 1, -2]];
const fromEye = (x: number, y: number) => ({ o: [0, 1.5, 5] as Vec3, d: norm([x - 0, y - 1.5, -2 - 5]) });
const norm = (v: Vec3): Vec3 => { const l = Math.hypot(...v); return [v[0] / l, v[1] / l, v[2] / l]; };

test("a ray meets a quad where it should, with its place on the art; outside it misses", () => {
  const h = rayQuad(fromEye(0.25, 1.75), SQ)!;
  assert.ok(h);
  near(h.s, 0.75); near(h.v, 0.25);
  assert.equal(rayQuad(fromEye(0.6, 1.5), SQ), null);
  assert.equal(rayQuad(fromEye(0, 2.01), SQ), null);
  // a skewed parallelogram (a turned, tilted piece)
  const sk: [Vec3, Vec3, Vec3, Vec3] = [[0, 2, -2], [1, 2, -2.5], [1.3, 1, -2.5], [0.3, 1, -2]];
  const mid: Vec3 = [0.65, 1.5, -2.25], g = rayQuad({ o: [0, 1.5, 5], d: norm([mid[0], 0, mid[2] - 5]) }, sk)!;
  near(g.s, 0.5); near(g.v, 0.5);
  // behind the eye never hits
  assert.equal(rayQuad({ o: [0, 1.5, -5], d: [0, 0, -1] }, SQ), null);
});

test("a ray meets a triangle inside it and not outside", () => {
  assert.ok(rayTri(fromEye(-0.4, 1.9), SQ[0], SQ[1], SQ[2]) === null);
  assert.ok(rayTri(fromEye(0.4, 1.9), SQ[0], SQ[1], SQ[2])! > 0);
  assert.ok(rayTri(fromEye(-0.4, 1.1), SQ[0], SQ[2], SQ[3])! > 0);
});

test("a ray meets the plane z = c in front of the eye", () => {
  const p = rayZ({ o: [0, 1, 5], d: norm([0.2, -0.1, -1]) }, -1)!;
  near(p[2], -1); near(p[0], 1.2);
  assert.equal(rayZ({ o: [0, 1, 5], d: [0, 0, 1] }, -1), null);
});

// ---- Alpha masks -------------------------------------------------------------------------------

/** RGBA pixels, transparent except where `on(x, y)`. */
function pixels(w: number, h: number, on: (x: number, y: number) => number): Uint8ClampedArray {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) d[(y * w + x) * 4 + 3] = on(x, y);
  return d;
}

test("pooling keeps each cell's most opaque pixel, so a one-pixel line survives", () => {
  const d = pixels(16, 8, (x, y) => (x === 5 ? 200 : 0) + (y === 7 && x === 15 ? 90 : 0));
  const m = poolAlpha(d, 16, 8, 4);
  assert.deepEqual([m.w, m.h], [4, 2]);
  assert.deepEqual([...m.a], [0, 200, 0, 0, 0, 200, 0, 90]);
  // into a bigger mask at an offset
  const out = new Uint8Array(6 * 3);
  poolAlpha(d, 16, 8, 4, out, 6, 1, 1);
  assert.equal(out[1 * 6 + 2], 200); assert.equal(out[2 * 6 + 4], 90); assert.equal(out[0], 0);
});

test("a mask tells a round piece's transparent corner from its paper; a piece not drawn yet is solid", () => {
  const S = 64, M = S / MASK_SCALE;
  // a disc in the top-left 32×32 cell of the layer
  const d = pixels(S, S, (x, y) => Math.hypot(x - 16, y - 16) < 15 ? 255 : 0);
  const mask = poolAlpha(d, S, S, MASK_SCALE).a, r = { layer: 0, u0: 0, v0: 0, u1: 0.5, v1: 0.5 };
  assert.equal(maskHit([mask], M, r, 0.5, 0.5), true);
  assert.equal(maskHit([mask], M, r, 0.02, 0.02), false);
  assert.equal(maskHit([mask], M, r, 0.98, 0.98), false);
  assert.equal(maskHit([mask], M, { ...r, lazy: {} }, 0.02, 0.02), true);
  assert.equal(maskHit([null], M, r, 0.02, 0.02), true);
});

test("the atlas hook makes each layer's mask in its own task, and adds pieces drawn before or after", () => {
  const S = 32, img = (on: (x: number, y: number) => number, w = S, h = S) => ({ data: pixels(w, h, on), width: w, height: h });
  const m = new AlphaMasks();
  let reads = 0;
  m.layers(k => { reads++; return img((x, y) => k === 0 && x < 8 && y < 8 ? 255 : 0); }, 2, S);
  assert.equal(m.masks[0], null, "nothing is read in the upload's own task");
  // a lazy piece drawn into layer 1 before its mask exists, at pixel (16, 16)
  m.piece(1, 16, 16, () => img(() => 255, 8, 8));
  m.flush();
  assert.equal(reads, 2);
  assert.equal(m.size, S / MASK_SCALE);
  const r0 = { layer: 0, u0: 0, v0: 0, u1: 0.5, v1: 0.5 }, r1 = { layer: 1, u0: 0.5, v0: 0.5, u1: 0.75, v1: 0.75 };
  assert.equal(m.paper(r0, 0.2, 0.2), true); assert.equal(m.paper(r0, 0.9, 0.9), false);
  assert.equal(m.paper(r1, 0.5, 0.5), true, "the piece drawn early is in its layer's mask");
  // and one drawn after
  m.piece(0, 24, 24, () => img(() => 255, 4, 4));
  assert.equal(m.paper({ layer: 0, u0: 0.75, v0: 0.75, u1: 0.875, v1: 0.875 }, 0.5, 0.5), true);
  m.dispose();
});

// ---- Picking -----------------------------------------------------------------------------------

test("the topmost quad wins; a transparent corner passes through to what is behind", () => {
  const back: Pick = { target: "piece:wall", c: [[-2, 3, -2.2], [2, 3, -2.2], [2, 0, -2.2], [-2, 0, -2.2]] };
  const bread: Pick = { target: "obj:ekmek", c: SQ, rect: { layer: 0, u0: 0, v0: 0, u1: 1, v1: 1 } };
  const hand: Pick = { target: "ch:ismail", bone: "hand_r", c: [[0.2, 1.2, -1.9], [0.4, 1.2, -1.9], [0.4, 1.0, -1.9], [0.2, 1.0, -1.9]] };
  const picks = [back, bread, hand];
  // the bread's art is a disc: its corners are transparent
  const disc = (_p: Pick, s: number, v: number) => Math.hypot(s - 0.5, v - 0.5) < 0.5;
  assert.equal(pickTop(picks, fromEye(0, 1.5), disc)?.target, "obj:ekmek");
  assert.equal(pickTop(picks, fromEye(-0.47, 1.97), disc)?.target, "piece:wall");
  assert.equal(pickTop(picks, fromEye(0.3, 1.15), disc)?.target, "ch:ismail.hand", "drawn last, on top, with its body part");
  assert.equal(pickTop(picks, fromEye(0.3, 1.15), disc, p => p.target === "ch:ismail")?.target, "obj:ekmek");
  assert.equal(pickTop(picks, fromEye(5, 5), disc), null);
  // a strip's segment is tested as two triangles
  const arm: Pick = { target: "ch:nima", bone: "arm_l", tri: true, c: [[-1, 1.6, -1.8], [-0.9, 1.6, -1.8], [-0.85, 1.2, -1.8], [-1.05, 1.2, -1.8]] };
  assert.equal(pickTop([back, arm], fromEye(-0.95, 1.4))?.target, "ch:nima.arm");
});

test("targets: a body part is its person, a split-off loaf is its loaf; parts and kinds", () => {
  assert.ok(isTarget("ch:ismail", "ch:ismail.hand"));
  assert.ok(!isTarget("ch:ismail", "ch:ismailx.hand"));
  assert.ok(isTarget("ch:ismail.head", "ch:ismail.head"));
  assert.ok(!isTarget("ch:ismail.head", "ch:ismail.hand"));
  assert.ok(isTarget("obj:ekmek", "obj:ekmek#1"));
  assert.ok(!isTarget("obj:ekmek", "obj:ekmekci"));
  assert.ok(!isTarget("mark:door", "piece:door"));
  assert.deepEqual(["head", "neck", "hand_l", "forearm_r", "arm_l", "leg_r", "shin_l", "foot_r", "spine", "hips"].map(partOf), ["head", "head", "hand", "arm", "arm", "leg", "leg", "foot", "body", "body"]);
  assert.deepEqual(parseTarget("ch:nima.hand"), { kind: "ch", id: "nima", part: "hand" });
  assert.deepEqual(parseTarget("obj:ekmek#1"), { kind: "obj", id: "ekmek#1" });
});

// ---- The act state machine ---------------------------------------------------------------------

const TAP: Act = { kind: "tap", targets: ["obj:ekmek", "obj:simit", "obj:sut"], expect: "obj:ekmek", prompt: "Bu ekmek mi?", who: "nima" };

test("a right tap is accepted at once", () => {
  const { s, out } = tryAct(TAP, startAct(), "obj:ekmek#1");
  assert.equal(out, "hit");
  assert.deepEqual(s, { misses: 0, hinted: false, shown: false, result: "obj:ekmek", tries: ["obj:ekmek"] });
});

test("misses are only counted; the second hints, the third shows the answer and completes", () => {
  let s = startAct();
  const outs: string[] = [];
  for (const t of ["obj:simit", "ch:ismail.hand", "piece:wall", "obj:sut", "obj:simit", "obj:ekmek"]) { const r = tryAct(TAP, s, t); s = r.s; outs.push(r.out); }
  assert.deepEqual(outs, ["miss", "ignore", "ignore", "hint", "show", "ignore"]);
  assert.equal(HINT_AT, 2); assert.equal(SHOW_AT, 3);
  assert.deepEqual(s, { misses: 3, hinted: true, shown: true, result: "obj:ekmek", tries: ["obj:simit", "obj:sut", "obj:simit"] });
});

test("a choice with no expected answer takes either thing; skipping shows the answer", () => {
  const choose: Act = { kind: "choose", targets: ["obj:ekmek", "obj:simit"] };
  assert.equal(tryAct(choose, startAct(), "obj:simit").s.result, "obj:simit");
  assert.equal(tryAct(choose, startAct(), "obj:sut").out, "ignore");
  assert.deepEqual(skipAct(TAP, startAct()), { misses: 0, hinted: false, shown: true, result: "obj:ekmek", tries: [] });
  assert.equal(skipAct(choose, startAct()).result, "obj:ekmek");
  assert.equal(targetOf(TAP, "obj:sut#2"), "obj:sut");
  assert.equal(dragged({ kind: "drag", targets: ["ch:nima"], obj: "sut" }), "sut");
  assert.equal(dragged({ kind: "drag", targets: ["obj:sut", "ch:nima"] }), "sut");
  assert.deepEqual(resolvedCue({ act: TAP }, "obj:simit"), { act: { ...TAP, result: "obj:simit" } });
});

// ---- The director: what an answer does to the world ----------------------------------------------

const g = (dur: number, stroke: number, extra: Partial<GestureDef> = {}): GestureDef => ({ dur, stroke, keys: [{ t: 0 }, { t: stroke, arm: 1 }, { t: dur }], ...extra });
const GESTURES: Record<string, GestureDef> = { point: g(1100, 350, { needs: ["target"] }), look: g(900, 300, { needs: ["target"] }), take: g(900, 450, { hold: "take" }), give: g(1000, 500, { hold: "give" }) };
const SHOP: PlaceDoc = {
  v: 1, id: "shop", size: { w: 8, d: 4 }, pieces: [{ kit: "door_shop", id: "door", x: -3.4, z: -2.1, terms: ["a1-w-kapi"] }],
  marks: { door: { x: -3.4, z: -1.1 }, front: { x: -1.6, z: 0.2 }, customer: { x: -0.4, z: 0.1, facing: "r" }, counter: { x: 0.6, z: -0.95, facing: "l" }, floor: { x: 1.5, z: 0.4 } },
  props: { ekmek: { kit: "bread", n: 3, at: { x: 0.2, y: 1.02, z: -0.43 }, terms: ["a1-w-ekmek"] }, simit: { kit: "simit_tray", at: { x: 0.8, y: 1.02, z: -0.43 }, name: "simit tepsisi" }, sut: { kit: "milk", at: { x: -2.4, y: 0.97, z: -2.0 }, terms: ["a1-w-sut"] } },
};
const ctx: DirectCtx = { places: { shop: SHOP }, gestures: GESTURES, lang: { id: "x", speech: speechFallback, match: matchFallback } };
const CAST = ["ismail", "nima"];
const OPEN: Cue[] = [{ scene: { place: "shop", at: { ismail: "counter", nima: "front" } } }];
const after = (c: Cue) => fold([...OPEN, c], 1, CAST, ctx);

test("an act frames the stage wide; with no answer yet nothing else changes", () => {
  const w0 = fold(OPEN, 0, CAST, ctx);
  const p = direct({ ...w0, shot: { kind: "two", ids: ["ismail", "nima"], objs: [] } }, { act: { ...TAP, expect: undefined } }, 1, ctx);
  assert.deepEqual(p.cams.map(c => c.shot.kind), ["wide"]);
  const json = (x: unknown) => JSON.parse(JSON.stringify(x));
  assert.deepEqual(json(p.after.actors), json(w0.actors));
  assert.deepEqual(json(p.after.props), json(w0.props));
  const close = direct(w0, { act: { ...TAP, expect: undefined, cam: "two", by: "ismail" } }, 1, ctx);
  assert.deepEqual(close.after.shot, { kind: "two", ids: ["nima", "ismail"], objs: ["ekmek", "simit", "sut"] });
});

test("a tap's answer: the learner's actor points at it and looks, whoever asked looks too", () => {
  const p = directAll([...OPEN, { act: { ...TAP, by: "ismail" } }], CAST, ctx)[1];
  assert.equal(p.tracks.nima.gestures[0].id, "point");
  assert.equal(p.tracks.nima.gestures[0].at, "obj:ekmek");
  assert.equal(p.after.actors.nima.look, "obj:ekmek");
  assert.equal(p.after.actors.ismail.look, "obj:ekmek");
  // the learner's answer, not the expected one, is what the world shows
  assert.equal(after({ act: { ...TAP, result: "obj:simit" } }).actors.nima.look, "obj:simit");
});

test("a drag's answer: taken from where it lies, given out of a hand, or put on a mark", () => {
  const take = after({ act: { kind: "drag", obj: "sut", targets: ["ch:nima", "ch:ismail"], expect: "ch:nima", who: "nima" } });
  assert.equal(take.props.sut.holder?.actor, "nima");
  assert.equal(Object.values(take.actors.nima.hold)[0], "sut");
  // nima gives what she holds to İsmail: out of her hand into his
  const cues: Cue[] = [...OPEN,
    { act: { kind: "drag", obj: "sut", targets: ["ch:nima"], expect: "ch:nima", who: "nima" } },
    { act: { kind: "drag", obj: "sut", targets: ["ch:ismail", "ch:nima"], expect: "ch:ismail", who: "nima" } }];
  const perfs = directAll(cues, CAST, ctx), give = perfs[2];
  assert.equal(give.after.props.sut.holder?.actor, "ismail");
  assert.deepEqual(give.after.actors.nima.hold, {});
  assert.ok(give.tracks.nima.gestures.some(x => x.id === "give"));
  assert.ok(give.tracks.ismail.gestures.some(x => x.id === "take"));
  // the hand-over happens during the performance, not at its start
  const mid = evaluate(give, 0), end = evaluate(give, give.dur);
  assert.equal(mid.props.sut.holder?.actor, "nima"); assert.equal(end.props.sut.holder?.actor, "ismail");
  // onto a mark: out of the hand, lying on the floor there
  const put = directAll([...cues.slice(0, 2), { act: { kind: "drag", obj: "sut", targets: ["mark:floor"], who: "nima", result: "mark:floor" } }], CAST, ctx)[2];
  assert.deepEqual(put.after.props.sut.at, [1.5, 0, 0.4]);
  assert.equal(put.after.props.sut.holder, undefined);
  assert.deepEqual(put.after.actors.nima.hold, {});
});

test("a go's answer: the learner's actor walks to the mark and turns to whoever asked", () => {
  const p = directAll([...OPEN, { act: { kind: "go", targets: ["mark:customer", "mark:door"], expect: "mark:customer", who: "nima", by: "ismail" } }], CAST, ctx)[1];
  assert.deepEqual(p.after.actors.nima.pos, [-0.4, 0, 0.1]);
  assert.equal(p.tracks.nima.walks.length, 1);
  assert.equal(p.after.actors.nima.look, "ch:ismail");
  assert.ok(p.after.actors.nima.yaw > 0, "turned towards İsmail, on her right");
  assert.ok(p.sounds.some(s => s.id === "step"), "with footsteps");
  const door = after({ act: { kind: "go", targets: ["mark:customer", "mark:door"], expect: "mark:customer", who: "nima", result: "mark:door" } });
  assert.deepEqual(door.actors.nima.pos, [-3.4, 0, -1.1]);
});

test("a glance (an act's hint) moves only the eyes, and the point when the answer is shown", () => {
  const w0 = fold(OPEN, 0, CAST, ctx), p = glance(w0, 0, ctx, ["ismail"], "obj:ekmek", "ismail");
  assert.equal(p.cue, 0);
  assert.equal(p.after.actors.ismail.look, "obj:ekmek");
  assert.equal(p.tracks.ismail.gestures[0].id, "point");
  const json = (x: unknown) => JSON.parse(JSON.stringify(x));
  assert.deepEqual(json(p.after.props), json(w0.props));
  assert.deepEqual(json(p.after.actors.nima), json(w0.actors.nima));
});

// ---- Inspect -----------------------------------------------------------------------------------

test("inspect reports a prop's terms, a person's terms and part, a piece with terms, and nothing else", () => {
  const w = fold(OPEN, 0, CAST, ctx);
  const c: SceneInfo = { names: { ismail: "İsmail", "obj:ekmek": "ekmek" }, terms: { ismail: ["a1-w-bakkal"] }, place: SHOP, props: { ...w.props, "ekmek#1": { ...w.props.ekmek, id: "ekmek#1", n: 2 } } };
  assert.deepEqual(inspectOf("obj:ekmek#1", c, "pointer", 10, 20), { target: "obj:ekmek#1", kind: "prop", id: "ekmek#1", of: "ekmek", terms: ["a1-w-ekmek"], name: "ekmek", via: "pointer", x: 10, y: 20 });
  assert.deepEqual(inspectOf("ch:ismail.hand", c, "list"), { target: "ch:ismail.hand", kind: "actor", id: "ismail", part: "hand", terms: ["a1-w-bakkal"], name: "İsmail", via: "list" });
  assert.deepEqual(inspectOf("ch:nima.head", c, "list")?.terms, []);
  assert.deepEqual(inspectOf("piece:door", c, "list"), { target: "piece:door", kind: "piece", id: "door", terms: ["a1-w-kapi"], name: "door", via: "list" });
  assert.equal(inspectOf("piece:", c, "list"), null);
  assert.equal(inspectOf("piece:shelf", c, "list"), null);
  // names: the app's, else the place prop's, else the id
  assert.equal(nameOf("obj:simit", c), "simit tepsisi");
  assert.equal(nameOf("obj:sut", c), "sut");
  assert.equal(nameOf("mark:customer", { ...c, names: { "mark:customer": "tezgâh" } }), "tezgâh");
});

test("act cues carry their answer, so a scene folds the same after a replay", () => {
  const cue: ActCue = { act: { kind: "choose", targets: ["obj:ekmek", "obj:simit"], who: "nima" } };
  const a = fold([...OPEN, resolvedCue(cue, "obj:simit")], 1, CAST, ctx), b = fold([...OPEN, resolvedCue(cue, "obj:simit")], 1, CAST, ctx);
  assert.deepEqual(a, b);
  assert.equal(a.actors.nima.look, "obj:simit");
  // without an answer and with nothing expected, a choice leaves the world alone
  assert.equal(fold([...OPEN, cue], 1, CAST, ctx).actors.nima.look, null);
});

test("a stage builds the places of every branch, the ones only another branch reaches too", async () => {
  const { scriptPlaces } = await import("../src/stage.ts");
  const script = { v: 1 as const, cues: [{ scene: { place: "bakkal", at: {} } }] as Cue[] };
  assert.deepEqual([...scriptPlaces(script, [{ cues: [{ scene: { place: "park", at: {} } }] }])], ["bakkal", "park"]);
  assert.deepEqual([...scriptPlaces(script)], ["bakkal"]);
});
