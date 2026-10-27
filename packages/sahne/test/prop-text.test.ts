// Prop text's maths (DESIGN.md §6.8): the matrix3d that lays a text box on its flat must put every
// pixel where the camera draws that point of the flat, and nothing is laid behind the near plane or
// on the back of a flat. No DOM: the layer itself is checked in the gallery.
import { test } from "node:test";
import assert from "node:assert/strict";
import { flatMatrix } from "../src/ui/prop-text.ts";
import { NEAR, FAR } from "../src/render/paper/camera.ts";
import { perspective, lookAt, mat4Mul, project, type Vec3 } from "../src/core/math.ts";
import { rng } from "../src/core/rng.ts";
import type { TextSpec } from "../src/core/kit.ts";

/** The stage's flat axes (stage.ts `axes`): R and D, metres per cm, for a yaw and a pitch. */
function axes(yaw: number, pitch: number): { R: Vec3; D: Vec3 } {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return { R: [cy / 100, 0, -sy / 100], D: [(-sp * sy) / 100, -cp / 100, (-sp * cy) / 100] };
}
const add = (a: Vec3, b: Vec3, k = 1): Vec3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Apply a CSS matrix3d to an element pixel as the browser does: homogeneous, then divided by w. */
function apply3d(m: string, X: number, Y: number): [number, number] {
  const v = m.slice(9, -1).split(",").map(Number);
  assert.equal(v.length, 16);
  const x = v[0] * X + v[4] * Y + v[12], y = v[1] * X + v[5] * Y + v[13], w = v[3] * X + v[7] * Y + v[15];
  return [x / w, y / w];
}

/** A random camera and a random flat near what it looks at, with a text box on it. */
function scene(R: () => number) {
  const target: Vec3 = [R() * 4 - 2, R() * 1.5 + 0.3, R() * 4 - 2], a = R() * Math.PI * 2, d = 1.5 + R() * 6;
  const eye: Vec3 = [target[0] + Math.sin(a) * d, target[1] + R() * 2 - 0.5, target[2] + Math.cos(a) * d];
  const fov = 0.35 + R() * 0.6, aspect = 0.45 + R() * 1.8, cssH = 300 + Math.round(R() * 500), css: [number, number] = [Math.round(cssH * aspect), cssH];
  const vp = mat4Mul(perspective(fov, aspect, NEAR, FAR), lookAt(eye, target));
  const { R: Rx, D } = axes(R() * Math.PI * 2, (R() - 0.7) * 2.4);
  const O = add(target, [R() - 0.5, R() * 0.6 - 0.3, R() - 0.5]);
  const t: TextSpec = { text: "Ekmek", x: R() * 20 - 10, y: R() * 20 - 10, w: 5 + R() * 40, h: 3 + R() * 25 };
  return { eye, target, vp, css, f: { O, R: Rx, D }, t, k: 2 + R() * 38 };
}

/** Where the camera draws a world point, in CSS px (y down). */
const shot = (vp: Float32Array, css: [number, number], p: Vec3): [number, number] => { const q = project(vp, p); return [(q[0] + 1) / 2 * css[0], (1 - q[1]) / 2 * css[1]]; };

test("flatMatrix maps a flat's corners and centre where the camera projects them", () => {
  const R = rng("prop-text");
  let checked = 0, front = 0;
  for (let i = 0; i < 4000 && checked < 400; i++) {
    const { eye, target, vp, css, f, t, k } = scene(R);
    const Q = add(add(f.O, f.R, t.x), f.D, t.y), world = (X: number, Y: number) => add(add(Q, f.R, X), f.D, Y);
    const fwd = sub(target, eye), fl = Math.hypot(...fwd), depth = (p: Vec3) => dot(sub(p, eye), fwd) / fl;
    const corners = [world(0, 0), world(t.w, 0), world(t.w, t.h), world(0, t.h)];
    // the oracle: the front of a flat faces along D × R (the art's right and down, seen from the front)
    const facing = dot(cross(f.D, f.R), sub(eye, world(t.w / 2, t.h / 2)));
    const near = Math.min(...corners.map(depth));
    if (Math.abs(near - NEAR) < 1e-3 || Math.abs(facing) < 1e-7) continue;
    const m = flatMatrix(vp, css, f, t, k);
    if (near < NEAR || facing < 0) { assert.equal(m, null, "behind the near plane, or from behind"); continue; }
    front++;
    assert.ok(m, "a flat seen from the front, in front of the camera, gets a matrix");
    // only what can be on screen matters: far off it, the pixel grid is coarse anyway
    const on = corners.map(p => shot(vp, css, p));
    if (on.some(([x, y]) => Math.abs(x) > css[0] * 4 || Math.abs(y) > css[1] * 4)) continue;
    const W = t.w * k, H = t.h * k;
    for (const [X, Y] of [[0, 0], [W, 0], [W, H], [0, H], [W / 2, H / 2]]) {
      const want = shot(vp, css, world(X / k, Y / k)), got = apply3d(m, X, Y);
      assert.ok(Math.hypot(got[0] - want[0], got[1] - want[1]) < 0.001, `pixel (${X.toFixed(1)}, ${Y.toFixed(1)}): ${got.map(v => v.toFixed(4))} vs ${want.map(v => v.toFixed(4))}`);
    }
    checked++;
  }
  assert.ok(checked >= 200 && front >= checked, `${checked} flats checked`);
});

test("flatMatrix is null behind the near plane and for a flat seen from behind", () => {
  const eye: Vec3 = [0, 1.5, 4], vp = mat4Mul(perspective(0.6, 1.5, NEAR, FAR), lookAt(eye, [0, 1.2, 0])), css: [number, number] = [600, 400];
  const t: TextSpec = { text: "Bakkal", x: -20, y: -10, w: 40, h: 10 };
  const sign = (z: number, yaw = 0) => ({ O: [0, 1.4, z] as Vec3, ...axes(yaw, 0) });
  assert.ok(flatMatrix(vp, css, sign(0), t, 8), "a sign facing the camera");
  assert.equal(flatMatrix(vp, css, sign(0, Math.PI), t, 8), null, "turned round: its back");
  assert.equal(flatMatrix(vp, css, sign(4.5), t, 8), null, "behind the camera");
  assert.equal(flatMatrix(vp, css, sign(eye[2] - NEAR / 2), t, 8), null, "nearer than the near plane");
  assert.ok(flatMatrix(vp, css, sign(eye[2] - NEAR * 2), t, 8), "just past the near plane");
  // a sign lying on the floor, seen from above, faces up at the camera; from below the floor, its back
  const floor = { O: [0, 0, 1] as Vec3, ...axes(0, -Math.PI / 2) };
  assert.ok(flatMatrix(vp, css, floor, t, 8));
  const under = mat4Mul(perspective(0.6, 1.5, NEAR, FAR), lookAt([0, -2, 4], [0, 0, 0]));
  assert.equal(flatMatrix(under, css, floor, t, 8), null);
});
