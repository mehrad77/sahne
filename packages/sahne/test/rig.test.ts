// Tests of the pose rig: sign conventions, gestures (mirroring, loops, overlap, shapes, faces),
// IK, carry, the walk, the floor, idle life, and the bird. Gestures here are fixtures, not the kit's.
import { test } from "node:test";
import assert from "node:assert/strict";
import { humanoid, solve, jointOf, restPose, type BoneDef } from "../src/rig/skeleton.ts";
import { composePose, type PoseInput, type GestureRun } from "../src/rig/pose.ts";
import { twoBone } from "../src/rig/ik.ts";
import { birdBones, birdPose, type BirdFlight, type BirdMood, type BirdPoseOptions, type BirdRig } from "../src/rig/bird.ts";
import { apply, rotate, type Vec2 } from "../src/core/math.ts";
import type { BodyDims } from "../src/core/types.ts";
import type { GestureDef, Reach } from "../src/core/kit.ts";

const ADULT: BodyDims = {
  build: "adult", H: 172, headW: 44, headH: 50, neckL: 5, neckW: 11, torsoL: 43, shoulderW: 42, chestW: 38, waistW: 32, hipW: 35,
  upperArmL: 29, foreArmL: 25, handL: 13, armW: [10.8, 9, 7.2], thighL: 36.57, shinL: 32.43, footH: 5, footW: 10.5, legW: [15, 12, 10], legLen: 74,
};
const CHILD: BodyDims = {
  build: "child", H: 114, headW: 36, headH: 40, neckL: 3, neckW: 9, torsoL: 27, shoulderW: 27.72, chestW: 25.74, waistW: 22.8, hipW: 23.56,
  upperArmL: 16, foreArmL: 14, handL: 8, armW: [8.42, 7.02, 5.62], thighL: 21.2, shinL: 18.8, footH: 4, footW: 7.5, legW: [10.8, 8.64, 7.2], legLen: 44,
};
const BONES = humanoid(ADULT);
const L = ADULT.upperArmL + ADULT.foreArmL;

const pose = (o: Partial<PoseInput> = {}) => composePose({ bones: BONES, body: ADULT, defs: {}, gestures: [], ...o });
const world = (o: Partial<PoseInput> = {}, bones: BoneDef[] = BONES) => solve(bones, composePose({ bones, body: ADULT, defs: {}, gestures: [], ...o }).pose);
const one = (def: GestureDef, run: Partial<GestureRun> = {}, o: Partial<PoseInput> = {}) =>
  pose({ defs: { g: def }, gestures: [{ id: "g", t: 500, side: "l", ...run }], ...o });
const at = (def: GestureDef, run: Partial<GestureRun> = {}, o: Partial<PoseInput> = {}) => solve(BONES, one(def, run, o).pose);
const dist = (a: Vec2, b: Vec2) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const reachDef = (r: Reach): GestureDef => ({ dur: 1000, stroke: 0, keys: [{ t: 0, reach: r }, { t: 1000, reach: r }] });

test("engine angles: + swings a hanging bone to screen left and tilts the spine's top to screen right", () => {
  const down = apply(rotate(0.5), 0, 1), up = apply(rotate(0.5), 0, -1);
  assert.ok(down[0] < 0 && up[0] > 0);
  const w = solve(BONES, { ...restPose(), bones: { spine: 0.2, arm_l: -1 } });
  assert.ok(jointOf(w, "neck")[0] > 5, "a positive spine leans the top towards +x");
  assert.ok(jointOf(w, "hand_l")[0] > jointOf(solve(BONES, restPose()), "hand_l")[0] + 10, "a negative arm_l swings out to +x");
});

test("gestures are written for the acting side and mirrored onto either arm", () => {
  const raise: GestureDef = { dur: 1000, stroke: 400, keys: [{ t: 0 }, { t: 400, arm: Math.PI / 2 }, { t: 800, arm: Math.PI / 2 }, { t: 1000 }] };
  const lean: GestureDef = { dur: 1000, stroke: 0, keys: [{ t: 0, spine: 0.2, head: 0.2 }, { t: 1000, spine: 0.2, head: 0.2 }] };
  for (const side of ["l", "r"] as const) {
    const w = at(raise, { side, t: 600 }), S = jointOf(w, `arm_${side}`), W = jointOf(w, `hand_${side}`), o = side === "l" ? 1 : -1;
    // the rest pose hangs 0.13 rad out, so +π/2 lands a little above level
    assert.ok(Math.abs(W[1] - S[1]) < 6, `${side}: hand level with the shoulder (${W[1] - S[1]})`);
    assert.ok(o * (W[0] - S[0]) > 50, `${side}: the hand is out on its own side`);
    const lw = at(lean, { side }), top = apply(lw.get("head")!, 0, -ADULT.headH);
    assert.ok(o * jointOf(lw, "neck")[0] > 4 && o * (top[0] - jointOf(lw, "head")[0]) > 5, `${side}: spine and head lean towards the acting side`);
    const other = side === "l" ? "r" : "l", rest = jointOf(solve(BONES, restPose()), `hand_${other}`);
    assert.ok(dist(jointOf(w, `hand_${other}`), rest) < 12, "the other arm is not raised");
  }
  const both: GestureDef = { dur: 1000, stroke: 0, keys: [{ t: 0, arm2: Math.PI / 2 }, { t: 1000, arm2: Math.PI / 2 }] };
  const w = at(both, { side: "l" });
  assert.ok(jointOf(w, "hand_r")[0] - jointOf(w, "arm_r")[0] < -50, "arm2 raises the other arm, outwards on its side");
});

test("the hand settles after the forearm, and the forearm after the arm", () => {
  const snap: GestureDef = { dur: 1000, stroke: 200, keys: [{ t: 0 }, { t: 200, arm: 1, forearm: 1, hand: 1, ease: "linear" }, { t: 1000, arm: 1, forearm: 1, hand: 1 }] };
  const b = one(snap, { t: 100 }).pose.bones;
  assert.ok(Math.abs(b.arm_l) > Math.abs(b.forearm_l) && Math.abs(b.forearm_l) > Math.abs(b.hand_l));
  const c = one(snap, { t: 300 }).pose.bones;
  assert.ok(Math.abs(c.arm_l - c.forearm_l) < 1e-9 && Math.abs(c.forearm_l - c.hand_l) < 1e-9, "settled once every part is past the key");
});

test("IK puts the wrist on a reachable point, on either side", () => {
  for (const side of ["l", "r"] as const) {
    const o = side === "l" ? 1 : -1, S = jointOf(solve(BONES, restPose()), `arm_${side}`);
    for (const d of [[20, 10], [30, -20], [-10, 35], [-25, -5], [5, -40], [40, 25]] as Vec2[]) {
      const T: Vec2 = [S[0] + o * d[0], S[1] + d[1]];
      const W = jointOf(at(reachDef({ to: "target" }), { side, target: T }), `hand_${side}`);
      assert.ok(dist(W, T) < 0.5, `${side} ${d}: off by ${dist(W, T).toFixed(2)}`);
    }
  }
});

test("IK reaches the actor's own body with the elbow down or out", () => {
  const rest = solve(BONES, restPose()), S = jointOf(rest, "arm_l"), spine = jointOf(rest, "spine");
  const head = jointOf(rest, "head");
  const points: [Reach["to"], Vec2][] = [
    ["chest", [spine[0], spine[1] - ADULT.torsoL * 0.7]], ["belly", [spine[0], spine[1] - ADULT.torsoL * 0.25]],
    ["hip", [ADULT.hipW / 2, spine[1] - ADULT.torsoL * 0.1]], ["shoulder2", jointOf(rest, "arm_r")],
    ["mouth", [0, head[1] - ADULT.headH * 0.19]], ["ear", [ADULT.headW / 2 - 0.6, head[1] - ADULT.headH * 0.42]],
  ];
  for (const [to, P] of points) {
    const w = at(reachDef({ to }), { side: "l" }), W = jointOf(w, "hand_l"), E = jointOf(w, "forearm_l");
    assert.ok(dist(W, P) < 0.5, `${to}: off by ${dist(W, P).toFixed(2)}`);
    if (to === "chest" || to === "belly" || to === "shoulder2") assert.ok(E[1] > S[1], `${to}: the elbow hangs below the shoulder`);
    if (to === "hip" || to === "belly" || to === "ear") assert.ok(E[0] > S[0], `${to}: the elbow points outwards`);
  }
  const off = jointOf(at(reachDef({ to: "chest", off: [3, 2] }), { side: "r" }), "hand_r");
  assert.ok(dist(off, [-3, spine[1] - ADULT.torsoL * 0.7 + 2]) < 0.5, "off is mirrored: + is outwards on the reaching side");
});

test("every reach on the right side mirrors the same reach on the left", () => {
  const tos: Reach["to"][] = ["mouth", "chin", "nose", "eye", "ear", "forehead", "head_top", "chest", "belly", "hip", "shoulder2", "front"];
  const cases: [Reach, Vec2 | undefined][] = [
    ...tos.map(to => [{ to, off: [2, 3] }, undefined] as [Reach, undefined]),
    ...([[60, -120], [-40, -90], [-200, -250], [10, -300]] as Vec2[]).flatMap(T => [[{ to: "target" }, T], [{ to: "target", aim: "dir" }, T]] as [Reach, Vec2][]),
  ];
  for (const [r, T] of cases) {
    const def: GestureDef = { dur: 1000, stroke: 0, keys: [{ t: 0, arm: 0.4, faceX: 0.1 }, { t: 1000, reach: r, faceX: 0.1 }] };
    const wl = at(def, { side: "l", target: T }), wr = at(def, { side: "r", target: T && [-T[0], T[1]] });
    for (const j of ["forearm", "hand"]) {
      const a = jointOf(wl, `${j}_l`), b = jointOf(wr, `${j}_r`);
      assert.ok(Math.abs(a[0] + b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6, `${r.to} ${r.aim ?? ""} ${T ?? ""}: ${j} ${a} vs ${b}`);
    }
  }
});

test("IK straightens towards a point out of reach, and points with `dir`", () => {
  const S = jointOf(solve(BONES, restPose()), "arm_l");
  for (const T of [[150, -120], [60, 40], [20, -260]] as Vec2[]) {
    const W = jointOf(at(reachDef({ to: "target" }), { target: T }), "hand_l");
    const a = Math.atan2(T[1] - S[1], T[0] - S[0]), b = Math.atan2(W[1] - S[1], W[0] - S[0]);
    assert.ok(Math.abs(dist(W, S) - L) < 0.5, `${T}: the arm is straight (${dist(W, S).toFixed(2)} of ${L})`);
    assert.ok(Math.abs(a - b) < 0.01, `${T}: towards the point`);
  }
  for (const ext of [undefined, 0.6]) {
    const T: Vec2 = [120, -60], W = jointOf(at(reachDef({ to: "target", aim: "dir", ext }), { target: T }), "hand_l");
    assert.ok(Math.abs(dist(W, S) - (ext ?? 0.95) * L) < 0.5, `ext ${ext}: ${dist(W, S).toFixed(2)}`);
    assert.ok(Math.abs(Math.atan2(T[1] - S[1], T[0] - S[0]) - Math.atan2(W[1] - S[1], W[0] - S[0])) < 0.01, "pointing at it");
  }
  // a thing within reach is never pointed past: the hand comes from just above and outside it,
  // the elbow out and up, and the finger ends on it
  for (const T of [[S[0] + 0.55 * L, S[1] + 0.3 * L], [S[0] - 0.1 * L, S[1] + 0.6 * L]] as Vec2[]) {
    const w = at(reachDef({ to: "target", aim: "dir" }), { target: T });
    const Wr = jointOf(w, "hand_l"), E = jointOf(w, "forearm_l"), tip = apply(w.get("hand_l")!, 0, ADULT.handL);
    assert.ok(Wr[1] < T[1] - 5, `${T}: the hand comes from above it`);
    assert.ok(E[1] < Wr[1], `${T}: the elbow is up, the forearm slopes down`);
    assert.ok(dist(tip, T) < 4, `${T}: the finger ends on it (${dist(tip, T).toFixed(1)} cm)`);
  }
});

test("a reach behind the actor's back stays in front of the chest", () => {
  const S = jointOf(solve(BONES, restPose()), "arm_l"), Sr = jointOf(solve(BONES, restPose()), "arm_r");
  for (const T of [[-200, -110], [-150, -60], [-200, -260]] as Vec2[]) for (const aim of ["pos", "dir"] as const) {
    const w = at(reachDef({ to: "target", aim }), { target: T }), W = jointOf(w, "hand_l"), E = jointOf(w, "forearm_l");
    // reaching stops a little past the far shoulder; pointing may cross the chest with a straight arm
    assert.ok(W[0] > Sr[0] - (aim === "pos" ? 0.3 : 0.45) * L, `${T} ${aim}: the hand stays near the far shoulder (${W[0].toFixed(1)})`);
    assert.ok(E[1] > S[1] - 0.3 * ADULT.upperArmL || W[1] < S[1] - 0.8 * L, `${T} ${aim}: no elbow over the face`);
  }
});

test("a reach eases in and out with its keys and the run's weight", () => {
  const T: Vec2 = [40, -140];
  const def: GestureDef = { dur: 1000, stroke: 400, keys: [{ t: 0 }, { t: 400, reach: { to: "target" } }, { t: 700, reach: { to: "target" } }, { t: 1000 }] };
  let last = Infinity;
  for (let t = 0; t <= 400; t += 25) {
    const d = dist(jointOf(at(def, { t, target: T }), "hand_l"), T);
    assert.ok(d <= last + 1e-6, `t ${t}: the hand closes in`);
    last = d;
  }
  assert.ok(last < 0.5);
  const rest = jointOf(solve(BONES, restPose()), "hand_l"), half = jointOf(at(def, { t: 550, target: T, weight: 0.5 }), "hand_l");
  assert.ok(dist(half, T) > 5 && dist(half, rest) > 5, "half weight is half way");
  assert.ok(dist(jointOf(at(def, { t: 1000, target: T }), "hand_l"), rest) < 0.5, "back at rest at the end");
});

test("the same input gives the same pose", () => {
  const def: GestureDef = { dur: 1200, stroke: 300, loop: [300, 900], keys: [{ t: 0 }, { t: 300, arm: 1, reach: { to: "mouth", w: 0.7 }, shape: "fist" }, { t: 900, arm: 1.2, spine: 0.1 }, { t: 1200 }] };
  const input: PoseInput = {
    bones: BONES, body: ADULT, defs: { g: def }, gestures: [{ id: "g", t: 1730, side: "r", loop: true, weight: 0.8 }],
    hold: { l: 0.6 }, walk: { phase: 3.27, amount: 0.7, dir: -1 }, emotion: { headTilt: 0.1, posture: -0.5 }, idle: { t: 81234, seed: "ismail", amount: 1 },
  };
  assert.deepEqual(composePose(input), composePose(input));
  assert.deepEqual(composePose(input), composePose(structuredClone(input)));
});

test("a loop wraps forever, and a one-off gesture leaves nothing after its end", () => {
  const wave: GestureDef = { dur: 1000, stroke: 300, loop: [200, 600], keys: [{ t: 0 }, { t: 200, arm: 2.4, forearm: 0.3 }, { t: 400, arm: 2.4, forearm: 1.1 }, { t: 600, arm: 2.4, forearm: 0.3 }, { t: 1000 }] };
  const b = (t: number, loop: boolean) => one(wave, { t, loop }).pose.bones;
  for (const t of [700, 1100, 300 + 400 * 50]) {
    const x = b(t, true), y = b(300, false);
    for (const k of ["arm_l", "forearm_l", "hand_l"]) assert.ok(Math.abs((x[k] ?? 0) - (y[k] ?? 0)) < 1e-9, `${t} ${k}`);
  }
  assert.notDeepEqual(b(700, false), b(300, false), "without loop the gesture moves on");
  const still = pose();
  assert.deepEqual(one(wave, { t: 1001 }), still, "nothing after the end");
  const noLoop: GestureDef = { ...wave, loop: undefined };
  assert.deepEqual(one(noLoop, { t: 1001, loop: true }), still, "loop asks for nothing the gesture has not got");
  assert.deepEqual(one(wave, { t: -5 }), still, "nothing before the start");
});

test("hand shapes hold from their key, count takes n, holding grips", () => {
  const def: GestureDef = { dur: 1000, stroke: 0, keys: [{ t: 0 }, { t: 200, shape: "count", shape2: "open" }, { t: 600, shape: "fist" }, { t: 1000 }] };
  assert.deepEqual(one(def, { t: 100 }).alt, {});
  assert.deepEqual(one(def, { t: 400, n: 3 }).alt, { hand_l: "count3", hand_r: "open" });
  assert.deepEqual(one(def, { t: 400, n: 9, side: "r" }).alt, { hand_r: "count5", hand_l: "open" });
  assert.deepEqual(one(def, { t: 800 }).alt, { hand_l: "fist", hand_r: "open" });
  assert.deepEqual(pose({ hold: { r: 0.3 } }).alt, { hand_r: "hold" });
  assert.deepEqual(one(def, { t: 800 }, { hold: { l: 1 } }).alt, { hand_l: "fist", hand_r: "open" }, "a gesture's shape wins over the grip");
  assert.deepEqual(one(def, { t: 800, weight: 0.3 }, { hold: { l: 1 } }).alt, { hand_l: "hold" }, "a fading gesture gives the hand back");
});

test("faces, the face's slide and the look come from the keys", () => {
  const brows = { brows: { l: [0.6, 0.4] as [number, number] } };
  const def: GestureDef = { dur: 1000, stroke: 0, keys: [{ t: 0 }, { t: 200, face: brows, faceX: 0.1, look: "target" }, { t: 600, face: brows, faceX: 0.1 }, { t: 1000, look: null }] };
  const a = one(def, { t: 400, weight: 0.8 });
  assert.deepEqual(a.faces, [{ preset: brows, w: 0.8 }]);
  assert.ok(Math.abs(a.faceOff[0] - 0.08) < 1e-9 && a.look === "target");
  assert.ok(Math.abs(one(def, { t: 400, side: "r" }).faceOff[0] + 0.1) < 1e-9, "faceX is mirrored");
  assert.equal(one(def, { t: 100 }).look, undefined);
  assert.equal(one(def, { t: 1000 }).look, null);
  const mid = one(def, { t: 800 }).faces[0].w;
  assert.ok(mid > 0 && mid < 1, "the face fades out with the keys");
});

test("carrying holds the hand in front of the belly", () => {
  for (const side of ["l", "r"] as const) {
    const w = world({ hold: { [side]: 1 } }), W = jointOf(w, `hand_${side}`), hips = jointOf(w, "spine");
    assert.ok(Math.abs(W[0]) < ADULT.waistW / 2, `${side}: across the body (${W[0].toFixed(1)})`);
    assert.ok(W[1] < hips[1] && W[1] > hips[1] - ADULT.torsoL * 0.5, `${side}: at the waist (${W[1].toFixed(1)})`);
    assert.ok(jointOf(w, `forearm_${side}`)[1] > jointOf(w, `arm_${side}`)[1], "the elbow hangs");
  }
  const half = jointOf(world({ hold: { l: 0.5 } }), "hand_l"), full = jointOf(world({ hold: { l: 1 } }), "hand_l");
  assert.ok(half[0] > full[0], "the carry fades in");
});

const restAnkle = (bones: BoneDef[], s: "l" | "r") => jointOf(solve(bones, restPose()), `foot_${s}`)[1];

test("the walk lifts alternate feet and never sinks one into the floor", () => {
  for (const [body, bones] of [[ADULT, BONES], [CHILD, humanoid(CHILD)]] as const) {
    const rl = restAnkle(bones, "l"), rr = restAnkle(bones, "r");
    let liftL = 0, liftR = 0, dyMin = Infinity, dyMax = -Infinity;
    for (let ph = 0; ph <= 4; ph += 0.02) for (const dir of [1, -1]) for (const amount of [1, 0.4]) {
      const out = composePose({ bones, body, defs: {}, gestures: [], walk: { phase: ph, amount, dir }, idle: { t: ph * 480, seed: "w", amount: 1 } });
      const w = solve(bones, out.pose), al = jointOf(w, "foot_l")[1], ar = jointOf(w, "foot_r")[1];
      assert.ok(al <= rl + 1e-6 && ar <= rr + 1e-6, `${body.build} phase ${ph.toFixed(2)}: ankles ${al.toFixed(3)} ${ar.toFixed(3)}`);
      if (amount === 1) {
        const step = Math.floor(ph) % 2 === 0 ? "l" : "r", lift = (step === "l" ? rl - al : rr - ar);
        if (Math.abs(ph % 1 - 0.5) < 0.01) { if (step === "l") liftL = Math.max(liftL, lift); else liftR = Math.max(liftR, lift); }
        dyMin = Math.min(dyMin, out.pose.dy); dyMax = Math.max(dyMax, out.pose.dy);
      }
    }
    assert.ok(liftL > body.thighL * 0.12 && liftR > body.thighL * 0.12, `${body.build}: both feet lift (${liftL.toFixed(1)}, ${liftR.toFixed(1)})`);
    assert.ok(dyMax - dyMin > 0.8, `${body.build}: the body bobs`);
  }
  const lean = jointOf(world({ walk: { phase: 0.3, amount: 1, dir: -1 } }), "neck")[0];
  assert.ok(lean < -1, "the spine leans into the direction");
});

test("a bow or a dip bends the knees instead of sinking the feet", () => {
  const bow: GestureDef = { dur: 1000, stroke: 0, keys: [{ t: 0, dy: 4, spine: 0.1 }, { t: 1000, dy: 4 }] };
  const w = at(bow), body = jointOf(w, "hips")[1];
  assert.ok(body > -ADULT.legLen + 3, "the body went down");
  assert.ok(Math.abs(jointOf(w, "foot_l")[1] - restAnkle(BONES, "l")) < 1e-6 && Math.abs(jointOf(w, "foot_r")[1] - restAnkle(BONES, "r")) < 1e-6);
});

test("posture slumps or lifts, and the head tilts", () => {
  const head = (posture: number, headTilt = 0) => jointOf(world({ emotion: { headTilt, posture } }), "head");
  assert.ok(head(-1)[1] > head(0)[1] + 1.5 && head(1)[1] < head(0)[1] - 0.5);
  const tilted = world({ emotion: { headTilt: 0.2, posture: 0 } }), top = apply(tilted.get("head")!, 0, -ADULT.headH);
  assert.ok(top[0] > 5, "a positive tilt turns the crown to +x, like the engine angle");
});

test("idle: blinks are short, seeded and pure; breath and gaze stay small", () => {
  const seq = (seed: string) => { const b: number[] = []; for (let t = 0; t < 10000; t += 2) b.push(pose({ idle: { t, seed, amount: 1 } }).blink); return b; };
  const a = seq("nima"), again = seq("nima"), other = seq("ismail");
  assert.deepEqual(a, again);
  assert.notDeepEqual(a, other);
  assert.equal(Math.max(...a), 1);
  assert.ok(a.filter(v => v > 0).length / a.length < 0.15, "the eyes are mostly open");
  // pure in t: the order of calls does not matter
  const backwards: number[] = [];
  for (let t = 9998; t >= 0; t -= 2) backwards.push(pose({ idle: { t, seed: "nima", amount: 1 } }).blink);
  assert.deepEqual(backwards.reverse(), a);
  let sMax = 0, lift = 0;
  for (let t = 0; t < 30000; t += 50) {
    const o = pose({ idle: { t, seed: "nima", amount: 1 } });
    sMax = Math.max(sMax, Math.abs(o.saccade[0]), Math.abs(o.saccade[1]));
    lift = Math.max(lift, -(o.pose.off?.spine?.[1] ?? 0));
  }
  assert.ok(sMax > 0.01 && sMax <= 0.06 + 1e-9, `saccades ${sMax}`);
  assert.ok(lift > 0.3 && lift <= 0.36, `breath ${lift}`);
  const off = pose({ idle: { t: 1234, seed: "nima", amount: 0 } });
  assert.deepEqual(off, pose(), "amount 0 is still");
});

test("two-bone IK picks the elbow that is down and out", () => {
  // left arm (outwards is +x): a point across and level folds the elbow below
  const [p1] = twoBone(-30, 0, 29, 25, 1), e = [-Math.sin(p1), Math.cos(p1)];
  assert.ok(e[1] > 0, "the elbow is below the line");
  const [q1] = twoBone(0, 30, 29, 25, 1), f = [-Math.sin(q1), Math.cos(q1)];
  assert.ok(f[0] > 0, "straight down, the elbow goes outwards");
  const [r1] = twoBone(0, 30, 29, 25, -1);
  assert.ok(-Math.sin(r1) < 0, "and to screen left for the right arm");
});

test("carrying gives way while a gesture moves that arm, and comes back after it", () => {
  const lift: GestureDef = { dur: 1200, stroke: 500, keys: [{ t: 0 }, { t: 500, arm: 1.2, forearm: 1 }, { t: 900, arm: 1.2, forearm: 1 }, { t: 1200 }] };
  const W = (t: number, hold: number) => jointOf(solve(BONES, pose({ defs: { g: lift }, gestures: [{ id: "g", t, side: "r" }], hold: { r: hold } }).pose), "hand_r");
  assert.ok(dist(W(600, 1), W(600, 0)) < 0.5, "mid-gesture, the held arm moves as written");
  const carried = jointOf(solve(BONES, pose({ hold: { r: 1 } }).pose), "hand_r");
  assert.ok(dist(W(1200, 1), carried) < 0.5 && dist(W(0, 1), carried) < 0.5, "it starts and ends carrying");
});

// ---- the bird (rig/bird.ts), on Kerim's pivots and flight copied from sahne-kit's art.gen.ts ----

const KP: Record<string, [number, number]> = { bird: [55, 87], head: [57, 48], eye: [55.4, 33], eye2: [71.9, 32.2], wing: [47.5, 53], wingFar: [66, 51], tail: [42, 73], body: [55, 86], legs: [55, 83], "beak-lo": [66.6, 41.5], wingTip: [4, 23] };
const KF: BirdFlight = { flap: [14, -62], flapFar: [-14, 62], flapMs: 460, glide: { dy: [-9, -4.5], rot: [3, 7], ms: 2200 }, lift: { dy: -7, rot: 5 } };
const RIG: BirdRig = { pivots: KP, scale: 0.62, flight: KF };
const MOODS: Record<string, BirdMood> = {
  idle: {}, happy: { head: -6, beak: 16, tail: 6, alt: { eyes: "big", brow: "on" } },
  sad: { head: 16, headDy: 1.5, tail: -7, wing: -4, alt: { eyes: "big", wet: "on", tear: "on", brow: "on", smile_sad: "on" } },
  sleepy: { head: 10, headDy: 1, alt: { eyes: "shut" } },
};
const EMO: Record<string, string> = { neutral: "idle", happy: "happy", sad: "sad", sorry: "sad", tired: "sleepy" };
const BB = birdBones(RIG), DEG = Math.PI / 180;
const bird = (o: Partial<PoseInput> = {}, motion?: BirdPoseOptions["motion"]) =>
  birdPose({ bones: BB, body: ADULT, defs: {}, gestures: [], ...o }, { rig: RIG, moods: MOODS, emo: EMO, motion });
const near = (a: number | undefined, b: number, eps = 1e-9) => Math.abs((a ?? 0) - b) < eps;

test("a bird solves from its pivots and stands on its feet", () => {
  assert.deepEqual(BB.map(b => b.name), ["root", "legs", "body", "tail", "wing_far", "wing", "head", "beak"]);
  const w = solve(BB, restPose());
  assert.deepEqual(jointOf(w, "root"), [0, 0]);
  for (const [bone, k] of [["head", "head"], ["beak", "beak-lo"], ["wing_far", "wingFar"], ["tail", "tail"]] as const) {
    const p = jointOf(w, bone), q = KP[k];
    assert.ok(dist(p, [(q[0] - 55) * 0.62, (q[1] - 87) * 0.62]) < 1e-9, `${bone} sits on its pivot`);
  }
  assert.ok(jointOf(w, "head")[1] < -20 && jointOf(w, "legs")[1] < 0, "the head is above the feet");
  const o = bird();
  assert.deepEqual(o.alt, { wing: "fold", wing_far: "off", legs: "down", tail: "rest", eyes: "calm" });
  assert.deepEqual([o.faces, o.faceOff, o.blink, o.saccade], [[], [0, 0], 0, [0, 0]]);
});

test("flight spreads the wings, tucks the legs and flaps 14° → −62° over 0.92 s; landing folds", () => {
  const fly = (phase: number, amount = 1) => bird({ walk: { phase, amount, dir: 1, how: "fly" } });
  const f0 = fly(0), fh = fly(0.5), f1 = fly(1), fq = fly(0.25);
  assert.deepEqual(f0.alt, { wing: "spread", wing_far: "on", legs: "up", tail: "fan", eyes: "big" });
  assert.ok(near(f0.pose.bones.wing, 14 * DEG) && near(fh.pose.bones.wing, -62 * DEG) && near(f1.pose.bones.wing, 14 * DEG), "one phase is one beat, there and back");
  assert.ok(near(f0.pose.bones.wing_far, -14 * DEG) && near(fh.pose.bones.wing_far, 62 * DEG));
  const q = fq.pose.bones.wing!;
  assert.ok(q < 14 * DEG && q > -62 * DEG, "between the turns mid-stroke");
  // a phase is 2 × flapMs, so 0.92 s of hovering is one beat too
  assert.ok(near(bird({ air: true, idle: { t: 460, seed: "k", amount: 1 } }).pose.bones.wing, -62 * DEG));
  assert.ok(f0.pose.dy < -2 && (f0.pose.bones.root ?? 0) > 0, "she rises and leans into the flight");
  assert.ok(near(fly(0, 0.5).pose.dy, f0.pose.dy / 2), "the fly fading out lowers her onto her feet");
  assert.deepEqual(fly(0.37), fly(0.37), "pure");
  const landed = bird();
  assert.equal(landed.alt.wing, "fold"); assert.equal(landed.alt.legs, "down");
  assert.ok(near(landed.pose.dy, 0) && near(landed.pose.bones.root, 0) && near(landed.pose.bones.wing, 0));
  // a walk that is not a fly hops, with the wings folded
  const hop = bird({ walk: { phase: 0.5, amount: 1, dir: 1, how: "hop" } });
  assert.equal(hop.alt.wing, "fold");
  assert.ok(near(hop.pose.dy, -5 * 0.62) && near(bird({ walk: { phase: 1, amount: 1, dir: 1 } }).pose.dy, 0));
});

test("at an air mark she keeps flying; idle 0 holds the spread pose", () => {
  const air = (t: number, amount: number, motion?: BirdPoseOptions["motion"]) => bird({ air: true, idle: { t, seed: "kerim", amount } }, motion);
  const a = air(0, 1), b = air(230, 1);
  assert.equal(a.alt.wing, "spread"); assert.equal(a.alt.legs, "up");
  assert.ok(Math.abs(a.pose.bones.wing! - b.pose.bones.wing!) > 0.2, "hovering, she beats on");
  const held = [0, 300, 1234, 5000].map(t => air(t, 0));
  for (const h of held) {
    assert.equal(h.alt.wing, "spread");
    assert.ok(near(h.pose.bones.wing, 0) && near(h.pose.bones.wing_far, 0), "no beat");
    assert.ok(near(h.pose.dy, -7 * 0.62) && near(h.pose.bones.root, 5 * DEG), "at the lift");
  }
  assert.ok(near(air(1234, 1, "still").pose.bones.wing, 0) && near(air(1234, 1, "still").pose.dy, -7 * 0.62), "a still holds it too");
  // blinks come from idle and never at amount 0
  const shut = (amount: number) => { let n = 0; for (let t = 0; t < 20000; t += 10) if (bird({ idle: { t, seed: "kerim", amount } }).alt.eyes === "shut") n++; return n; };
  assert.ok(shut(1) > 0 && shut(1) < 200, `short blinks (${shut(1)})`);
  assert.equal(shut(0), 0);
});

test("an emotion reaches its mood through the kit's map: pose and art switches; the beak talks", () => {
  const sad = bird({ emo: "sorry" });
  assert.deepEqual(sad.alt, { wing: "fold", wing_far: "off", legs: "down", tail: "rest", eyes: "big", wet: "on", tear: "on", brow: "on", smile_sad: "on" });
  assert.ok(near(sad.pose.bones.head, 16 * DEG) && near(sad.pose.bones.tail, -7 * DEG) && near(sad.pose.bones.wing, -4 * DEG));
  assert.ok(near(sad.pose.off?.head?.[1], 1.5 * 0.62), "the head lowers");
  assert.equal(bird({ emo: "tired" }).alt.eyes, "shut");
  assert.deepEqual(bird({ emo: "confused" }).alt, bird().alt, "an unmapped emotion is idle");
  const sadFly = bird({ emo: "sad", air: true });
  assert.equal(sadFly.alt.tear, "on"); assert.equal(sadFly.alt.wing, "spread");
  assert.ok(near(bird({ talk: 1 }).pose.bones.beak, 22 * DEG) && near(bird({ talk: 0.5 }).pose.bones.beak, 11 * DEG));
  assert.ok(near(bird({ emo: "happy" }).pose.bones.beak, 16 * DEG) && near(bird({ emo: "happy", talk: 1 }).pose.bones.beak, 22 * DEG));
});

test("bird gestures: arm moves the wing, shape spreads it, reach aims its tip, n beats a loop n times", () => {
  const run = (def: GestureDef, r: Partial<GestureRun> = {}, o: Partial<PoseInput> = {}) => bird({ defs: { g: def }, gestures: [{ id: "g", t: 500, side: "r", ...r }], ...o });
  const raise: GestureDef = { dur: 1000, stroke: 0, keys: [{ t: 0, arm: 0.5, arm2: 0.3, spine: 0.1, head: 0.2, dy: -3, shape: "spread" }, { t: 1000, arm: 0.5, arm2: 0.3, spine: 0.1, head: 0.2, dy: -3, shape: "spread" }] };
  const g = run(raise);
  assert.ok(near(g.pose.bones.wing, 0.5) && near(g.pose.bones.wing_far, -0.3) && near(g.pose.bones.body, 0.1) && near(g.pose.bones.head, 0.2));
  assert.ok(near(g.pose.dy, -3));
  assert.equal(g.alt.wing, "spread"); assert.equal(g.alt.wing_far, "on");
  const point: GestureDef = { dur: 1000, stroke: 0, keys: [{ t: 0, reach: { to: "target" }, shape: "spread" }, { t: 1000, reach: { to: "target" }, shape: "spread" }] };
  const target: Vec2 = [-60, -40], w = solve(BB, run(point, { target }).pose);
  const P = jointOf(w, "wing"), T = apply(w.get("wing")!, (4 - 47.5) * 0.62, (23 - 53) * 0.62);
  const ang = (v: Vec2) => Math.atan2(v[1] - P[1], v[0] - P[0]);
  assert.ok(Math.abs(ang(T) - ang(target)) < 1e-6, "the spread tip points at the target");
  const beat: GestureDef = { dur: 400, stroke: 0, loop: [100, 300], keys: [{ t: 0 }, { t: 100 }, { t: 200, arm: 1 }, { t: 300 }, { t: 400 }] };
  assert.ok(near(run(beat, { t: 400, n: 3 }).pose.bones.wing, 1) && near(run(beat, { t: 600, n: 3 }).pose.bones.wing, 1), "beats two and three");
  assert.ok(near(run(beat, { t: 400 }).pose.bones.wing, 0) && near(run(beat, { t: 800, n: 3 }).pose.bones.wing, 0), "one beat without n; after the third, the rest");
  assert.ok(near(run(beat, { t: 850, n: 3 }).pose.bones.wing, 0));
});

test("on a stair the stepping knee lifts higher than on the flat, most going up, and the body leans into it", async () => {
  const { walkLayer } = await import("../src/rig/walk.ts");
  const at = (climb: number) => {
    const pose = { bones: {}, dx: 0, dy: 0, len: {}, off: {} } as Parameters<typeof walkLayer>[0];
    walkLayer(pose, ADULT, { phase: 0.5, amount: 1, dir: 1, climb }, { l: 0, r: 0 });
    return { knee: -(pose.len.thigh_l ?? 0), lean: pose.bones.spine ?? 0 };
  };
  assert.ok(at(1).knee > at(-1).knee && at(-1).knee > at(0).knee, `${at(1).knee} > ${at(-1).knee} > ${at(0).knee}`);
  assert.ok(at(1).lean > at(0).lean && at(-1).lean < at(0).lean);
});

test("seated on a seat: the hips come down onto it, the feet stay on the floor (or hang from a high seat)", () => {
  const hip = (o: Partial<PoseInput>) => jointOf(world(o), "hips")[1], ankle = (o: Partial<PoseInput>, s: "l" | "r") => jointOf(world(o), `foot_${s}`)[1];
  const stand = hip({}), chair = hip({ seat: { h: 0.45, k: 1 } }), half = hip({ seat: { h: 0.45, k: 0.5 } });
  // y grows downwards: down by the hip's height above the seat (less 2 cm of cushion), halfway at k = 0.5
  assert.ok(Math.abs(chair - stand - (ADULT.legLen - 45 - 2)) < 0.5, `${chair - stand}`);
  assert.ok(Math.abs(half - stand - (chair - stand) / 2) < 0.5);
  for (const s of ["l", "r"] as const) assert.ok(ankle({ seat: { h: 0.45, k: 1 } }, s) <= restAnkle(BONES, s) + 1e-6, "no foot below the floor");
  // a seat higher than the knees: the feet hang above the floor
  assert.ok(ankle({ seat: { h: 0.8, k: 1 } }, "l") < restAnkle(BONES, "l") - 1);
});
