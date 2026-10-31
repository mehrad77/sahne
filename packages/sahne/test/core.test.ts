// Tests of the engine's pure modules: paths, tones, the rig, framing and the face model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Path, ellipse, smooth, rect } from "../src/art/path.ts";
import { tone, luma } from "../src/core/color.ts";
import { rng } from "../src/core/rng.ts";
import { humanoid, solve, jointOf, restPose } from "../src/rig/skeleton.ts";
import { frameBoxes } from "../src/render/paper/camera.ts";
import { perspective, lookAt, mat4Mul, project } from "../src/core/math.ts";
import { NEUTRAL_FACE, blendFace, faceFrom, faceKey } from "../src/face/params.ts";
import type { BodyDims } from "../src/core/types.ts";

test("path bounds contain the shape, and mirroring flips them", () => {
  const e = ellipse(10, 5, 4, 2);
  assert.deepEqual(e.bounds(), [6, 3, 14, 7]);
  assert.deepEqual(e.mirrorX().bounds(), [-14, 3, -6, 7]);
  assert.equal(smooth([[0, 0], [10, 0], [10, 10]], true).cmds.filter(c => c[0] === "C").length, 3);
  assert.match(rect(0, 0, 2, 3).toD(), /^M0 0L2 0L2 3L0 3Z$/);
});

test("tones run from deep to edge", () => {
  for (const c of ["#C4553A", "#2E3A59", "#DCA27A", "#F7F3EA"]) {
    assert.ok(luma(tone(c, "deep")) < luma(tone(c, "shade")) && luma(tone(c, "shade")) < luma(c), c);
    assert.ok(luma(tone(c, "light")) >= luma(c) && luma(tone(c, "edge")) >= luma(tone(c, "light")), c);
  }
});

test("seeded random repeats exactly", () => {
  const a = rng("bakkal"), b = rng("bakkal");
  assert.deepEqual([a(), a(), a.int(1, 6)], [b(), b(), b.int(1, 6)]);
});

const ADULT: BodyDims = {
  build: "adult", H: 172, headW: 44, headH: 50, neckL: 5, neckW: 11, torsoL: 43, shoulderW: 42, chestW: 38, waistW: 32, hipW: 35,
  upperArmL: 29, foreArmL: 25, handL: 13, armW: [10.8, 9, 7.2], thighL: 36.57, shinL: 32.43, footH: 5, footW: 10.5, legW: [15, 12, 10], legLen: 74,
};

test("the rest pose stands on the floor with arms at the sides", () => {
  const w = solve(humanoid(ADULT), restPose());
  const ankle = jointOf(w, "foot_l"), head = jointOf(w, "head"), hand = jointOf(w, "hand_l"), handR = jointOf(w, "hand_r");
  assert.ok(Math.abs(ankle[1] + ADULT.footH) < 0.5, "the ankle sits footH above the floor");
  assert.ok(Math.abs(head[1] + (ADULT.H - ADULT.headH)) < 0.5, "the chin is a head below the top");
  assert.ok(hand[0] > 0 && handR[0] < 0, "the left hand is on screen right in the front view");
  assert.ok(hand[1] > -ADULT.legLen - 5 && hand[1] < -ADULT.legLen * 0.4, "hands hang near the hips");
});

test("framing keeps every box corner in view, in perspective", () => {
  const boxes = [{ x0: -1.4, x1: -0.7, y0: 0.7, y1: 1.76, z: 0.35 }, { x0: 0.2, x1: 1.0, y0: 0.7, y1: 1.74, z: -0.95 }];
  const aspect = 1.6, cam = frameBoxes(boxes, { aspect, margin: 0.1, tilt: 0.08 });
  const vp = mat4Mul(perspective(cam.fov, aspect, 0.1, 100), lookAt(cam.eye, cam.target));
  for (const b of boxes) for (const p of [[b.x0, b.y0], [b.x1, b.y0], [b.x0, b.y1], [b.x1, b.y1]]) {
    const [x, y, , w] = project(vp, [p[0], p[1], b.z]);
    assert.ok(w > 0 && Math.abs(x) <= 1.001 && Math.abs(y) <= 1.001, `corner ${p} at ${x.toFixed(3)}, ${y.toFixed(3)}`);
  }
});

test("faces blend, and only visible changes change the key", () => {
  const happy = faceFrom({ mouth: { smile: 0.9, open: 0.3 }, lower: [0.5, 0.5] });
  assert.deepEqual(blendFace(NEUTRAL_FACE, happy, 0), NEUTRAL_FACE);
  assert.deepEqual(blendFace(NEUTRAL_FACE, happy, 1), happy);
  const near = blendFace(NEUTRAL_FACE, happy, 0.001);
  assert.equal(faceKey(near), faceKey(NEUTRAL_FACE));
  assert.notEqual(faceKey(blendFace(NEUTRAL_FACE, happy, 0.5)), faceKey(NEUTRAL_FACE));
});

test("Path.fromSvg reads every command, absolute and relative, into the Cmd set", () => {
  assert.equal(Path.fromSvg("M0 0L10 0 10 5H0V0Z").toD(), "M0 0L10 0L10 5L0 5L0 0Z");
  assert.equal(Path.fromSvg("m1 1l2 0 0 2h-2v-2z").toD(), "M1 1L3 1L3 3L1 3L1 1Z");
  assert.equal(Path.fromSvg("M0 0m5 5 5 0").toD(), "M0 0M5 5L10 5", "a move's implicit repeats are lines");
  assert.equal(Path.fromSvg("M0-5L-5-5").toD(), "M0 -5L-5 -5", "run-together numbers");
  assert.equal(Path.fromSvg("M0 0C1 1 2 2 3 0S5-2 6 0").toD(), "M0 0C1 1 2 2 3 0C4 -2 5 -2 6 0", "S reflects the last cubic control");
  assert.equal(Path.fromSvg("M0 0S1 1 2 0").toD(), "M0 0C0 0 1 1 2 0", "S after no cubic starts at the point");
  assert.equal(Path.fromSvg("M0 0Q2 2 4 0T8 0").toD(), "M0 0Q2 2 4 0Q6 -2 8 0", "T reflects the last quad control");
  assert.equal(Path.fromSvg("M0 0 10 10").toD(), "M0 0L10 10");
});

test("Path.fromSvg turns an arc into cubics that stay on the ellipse", () => {
  const half = Path.fromSvg("M-10 0A10 10 0 0 1 10 0");
  assert.equal(half.cmds.filter(c => c[0] === "C").length, 2);
  const [x0, y0, x1, y1] = half.bounds();
  assert.ok(Math.abs(x0 + 10) < 1e-6 && Math.abs(x1 - 10) < 1e-6 && y1 === 0 && y0 > -14, "control points hug the top half");
  const last = half.cmds[half.cmds.length - 1] as number[];
  assert.deepEqual(last.slice(-2), [10, 0]);
  // the sweep flag picks the side; flags may be run together
  assert.ok(Path.fromSvg("M-10 0A10 10 0 0110 0").bounds()[1] < 0);
  assert.ok(Path.fromSvg("M-10 0A10 10 0 0 0 10 0").bounds()[3] > 0);
  // a radius too small is scaled up to reach; a zero radius is a line
  assert.equal(Path.fromSvg("M0 0A1 1 0 0 1 10 0").cmds.length, 3);
  assert.equal(Path.fromSvg("M0 0A0 5 0 0 1 10 0").toD(), "M0 0L10 0");
  // a full circle of two arcs matches the kit's ellipse to a hair
  const circ = Path.fromSvg("M-5 0A5 5 0 0 1 5 0A5 5 0 0 1-5 0Z").bounds();
  assert.ok(circ.every((v, i) => Math.abs(v - [-5, -5, 5, 5][i]) < 0.1), String(circ));
});

test("Path.fromSvg refuses bad data, saying where", () => {
  for (const d of ["", "L1 1", "M0", "M0 0 X", "M0 0Z5 5", "M0 0A1 1 0 2 0 5 5", "5 5"]) assert.throws(() => Path.fromSvg(d), /path data/, d);
});
