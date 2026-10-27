// Tests of the engine's pure modules: paths, tones, the rig, framing and the face model.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ellipse, smooth, rect } from "../src/art/path.ts";
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
