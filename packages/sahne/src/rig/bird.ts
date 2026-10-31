// A bird puppet (DESIGN.md §5.4): bones from its art's pivots, and a pose that flies, hovers, hops,
// talks with its beak and wears its moods as art switches. Generic: the kit brings the bird (pivots,
// flight, moods, gestures), nothing here knows Kerim. Pure, like composePose: same input, same pose.
//
// Angles in the bird's data are degrees and its lengths art units, as in the app's CSS: + turns
// clockwise on screen (the engine's own sign), + moves down. The art faces screen right (+x).
//
// The art switches it returns in `PoseOut.alt` (the kit's `Item.alt` keys):
//   wing      fold | spread               the near wing
//   wing_far  on | off                    the far wing, shown only while spread
//   legs      down | up                   up (tucked) in flight
//   tail      rest | fan
//   eyes      calm | big | joy | shut     a blink is a short `shut`
//   others    "on" while the mood asks (tear, wet, brow, brow2, smile_sad …); absent otherwise

import { apply, clamp, ease, type Vec2 } from "../core/math.ts";
import type { GestureDef } from "../core/kit.ts";
import { solve, jointOf, type BoneDef, type PoseState } from "./skeleton.ts";
import { applyGesture, newAcc, type GestureAcc } from "./gesture.ts";
import { idleAt } from "./idle.ts";
import { addLen, addOff, addRot } from "./layer.ts";
import type { GestureRun, PoseInput, PoseOut } from "./pose.ts";

export interface BirdFlight {
  /** The wings' beat, degrees from → to (near, far); one beat goes there and back over 2 × `flapMs` (the CSS `alternate`). */
  flap: [number, number]; flapFar: [number, number]; flapMs: number;
  /** The glide while flying: the whole bird up (− art units) and tilted (degrees), from → to over `ms` each way. */
  glide: { dy: [number, number]; rot: [number, number]; ms: number };
  /** The flying pose without motion (reduced motion, a still): art units and degrees. */
  lift: { dy: number; rot: number };
  /** The head's turn in flight, degrees (default 0). */
  head?: number;
}

export interface BirdRig {
  /** Pivots in art units (y down): `bird` (the feet: the root), `body`, `tail`, `wing`, `wingFar`, `legs`, `head`, `beak-lo`; optionally `wingTip` and `wingFarTip`, the spread wings' tips, for aiming a wing (else it aims straight up from its pivot). */
  pivots: Record<string, Vec2>;
  /** Centimetres per art unit. */
  scale: number;
  flight: BirdFlight;
}

/** A mood's static pose (the app's CSS mood): degrees, art units (+ down), and art switches. */
export interface BirdMood {
  head?: number; headDy?: number; beak?: number; tail?: number;
  /** The near wing; the far one turns the opposite way. */
  wing?: number;
  /** The whole bird up (−) or down, while perched. */
  dy?: number;
  alt?: Record<string, string>;
}

export interface BirdPoseOptions {
  rig: BirdRig;
  moods: Record<string, BirdMood>;
  /** The kit's emotion → a mood name; an unmapped one is `idle`. */
  emo: Record<string, string>;
  /** `still` holds the flying pose without beats or glide, as idle amount 0 does. */
  motion?: "full" | "calm" | "still";
}

// [bone, parent, pivot]: the root stands on the feet; the trunk carries the tail, wings and head
const BIRD: [string, string | null, string][] = [
  ["root", null, "bird"], ["legs", "root", "legs"], ["body", "root", "body"], ["tail", "body", "tail"],
  ["wing_far", "body", "wingFar"], ["wing", "body", "wing"], ["head", "body", "head"], ["beak", "head", "beak-lo"],
];

const pivot = (r: BirdRig, k: string): Vec2 => {
  const p = r.pivots[k];
  if (!p) throw new Error(`sahne: bird pivot "${k}" missing`);
  return p;
};

/** The bird's bones in paper cm (y down, feet at the origin), each at its pivot relative to its parent's. */
export function birdBones(r: BirdRig): BoneDef[] {
  const pv = new Map(BIRD.map(([n, , k]) => [n, pivot(r, k)]));
  return BIRD.map(([name, parent, k]) => {
    const p = pivot(r, k), q = parent ? pv.get(parent)! : p;
    return { name, parent, x: (p[0] - q[0]) * r.scale, y: (p[1] - q[1]) * r.scale, rot: 0 };
  });
}

const R = 0.017453292519943295; // π / 180, a literal: `Math.PI / 180` would survive tree-shaking
/** The beak at full talk, degrees (the app's `k-beak`). */
const BEAK = 22;
/** A step's hop (art units) and the head's push forward with it (a dove's walk). */
const HOP = 5, PECK = 2;
/** Flying along (`pace`): how far she drifts about her mark, art units across and up. */
const PACE_DRIFT = [4, 3];
/** There and back: 0 → 1 → 0 over one unit, eased at both turns like the CSS `alternate`. */
const swing = (u: number) => ease.inOut(1 - Math.abs(1 - 2 * (u - Math.floor(u))));
const mix = (ab: [number, number], k: number) => ab[0] + (ab[1] - ab[0]) * k;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function birdPose(input: PoseInput, o: BirdPoseOptions): PoseOut {
  const { rig } = o, F = rig.flight, s = rig.scale;
  const pose: PoseState = { bones: {}, dx: 0, dy: 0, len: {}, off: {} };
  const idle = input.idle, still = o.motion === "still", a = still || !idle ? 0 : clamp(idle.amount, 0, 1);
  const w = input.walk, fly = w?.how === "fly", flying = fly || !!input.air;
  const mood = o.moods[o.emo[input.emo ?? ""] ?? "idle"] ?? o.moods.idle ?? {};

  const alt: Record<string, string> = flying
    ? { wing: "spread", wing_far: "on", legs: "up", tail: "fan", eyes: "big" }
    : { wing: "fold", wing_far: "off", legs: "down", tail: "rest", eyes: "calm" };
  // in flight the wings, legs and tail are the flight's; the face is the mood's
  for (const [k, v] of Object.entries(mood.alt ?? {})) if (!flying || !/^(wing|wing_far|legs|tail)$/.test(k)) alt[k] = v;
  addRot(pose, "head", R * ((mood.head ?? 0) + (flying ? F.head ?? 0 : 0)));
  addOff(pose, "head", 0, s * (mood.headDy ?? 0));
  if (!flying) {
    addRot(pose, "tail", R * (mood.tail ?? 0));
    addRot(pose, "wing", R * (mood.wing ?? 0)); addRot(pose, "wing_far", -R * (mood.wing ?? 0));
    pose.dy += s * (mood.dy ?? 0);
  }

  if (flying) {
    // a fly beats once per phase (deterministic); a hover beats on idle time, so it stops with idle life;
    // flying along beside a train or a ferry (`pace`) beats on the place's clock, which runs while the place does
    const beat = 2 * F.flapMs, pace = !fly && !!input.pace, hover = !fly && !pace;
    const ph = pace ? (input.life ?? 0) / beat : hover ? (idle?.t ?? 0) / beat : w!.phase, k = still ? 0 : hover ? a : 1;
    const g = swing(ph * beat / (2 * F.glide.ms)), lift = input.air ? 1 : clamp(w?.amount ?? 1, 0, 1);
    addRot(pose, "wing", R * k * mix(F.flap, swing(ph)));
    addRot(pose, "wing_far", R * k * mix(F.flapFar, swing(ph)));
    // held, she is at the lift; moving, she glides about it; landing (the fly fading out) lowers her onto her feet
    pose.dy += lift * s * (F.lift.dy + k * (mix(F.glide.dy, g) - F.lift.dy));
    addRot(pose, "root", lift * R * (F.lift.rot + k * (mix(F.glide.rot, g) - F.lift.rot)));
    // flying along she is never quite still beside the window: a slow drift of a few centimetres about her mark
    if (pace && !still) { const L = input.life ?? 0; pose.dx += s * PACE_DRIFT[0] * Math.sin(L / 1900); pose.dy += s * PACE_DRIFT[1] * Math.sin(L / 1300 + 1); }
  } else if (w) {
    // a walk is small hops, the head pushing forward with each and the tail flicking
    const A = clamp(w.amount, 0, 1), up = Math.sin(Math.PI * (w.phase - Math.floor(w.phase))) * A;
    pose.dy -= s * HOP * up;
    addOff(pose, "head", s * PECK * up, 0);
    addRot(pose, "tail", R * 6 * up);
  }

  if (a > 0 && idle) {
    const life = idleAt(idle.t, idle.seed);
    // she breathes (the trunk swells about her feet) and, perched, her head sways a little
    addLen(pose, "body", 0.015 * a * life.breath);
    if (!flying) addRot(pose, "head", R * 2.5 * a * life.sway);
    if (life.blink >= 0.5 && (alt.eyes === "calm" || alt.eyes === "big")) alt.eyes = "shut";
  }

  const talk = clamp(input.talk ?? 0, 0, 1), mb = mood.beak ?? 0;
  addRot(pose, "beak", R * (mb + (BEAK - mb) * talk));

  const acc = newAcc();
  for (const run of input.gestures) { const def = input.defs[run.id]; if (def) gesture(pose, def, run, acc); }
  // a gesture's shape is the near wing's (`shape`) or the far wing's (`shape2`)
  const sh = acc.shapes.l?.shape, sh2 = acc.shapes.r?.shape;
  if (sh) { alt.wing = sh; if (sh === "spread") alt.wing_far = "on"; }
  if (sh2) alt.wing_far = sh2 === "fold" || sh2 === "off" ? "off" : "on";
  if (acc.reaches.length) aim(pose, input.bones, rig, acc);

  const out: PoseOut = { pose, alt, faces: [], faceOff: [0, 0], blink: 0, saccade: [0, 0] };
  if (acc.look) out.look = acc.look.v;
  return out;
}

/**
 * One gesture on a bird, through the humanoid channels (played on side `l`): arm → the near wing,
 * arm2 → the far wing (+ raises either), spine → the trunk, neck and head → the head, dy → a hop,
 * headDy → a bob. The other channels (forearms, legs, the face's slide) have nothing to move.
 */
function gesture(pose: PoseState, def: GestureDef, run: GestureRun, acc: GestureAcc) {
  const g: PoseState = { bones: {}, dx: 0, dy: 0 }, b = g.bones;
  applyGesture(g, def, beats(def, run), acc, { legs: 1, head: 1 });
  // on side l the arm is written with the left limb's sign (−) and arm2 with the right's (+)
  addRot(pose, "wing", -(b.arm_l ?? 0));
  addRot(pose, "wing_far", -(b.arm_r ?? 0));
  addRot(pose, "body", b.spine ?? 0);
  addRot(pose, "head", (b.head ?? 0) + (b.neck ?? 0));
  pose.dy += g.dy;
  const hd = g.off?.head;
  if (hd) addOff(pose, "head", hd[0], hd[1]);
}

/** A gesture with a loop range, played with `n` (a count): the range repeats n times (n wingbeats), then the rest plays. */
function beats(def: GestureDef, run: GestureRun): GestureRun {
  const n = Math.round(run.n ?? 0), L = def.loop;
  if (run.loop || !L || L[1] <= L[0] || n < 1) return { ...run, side: "l" };
  const [lo, hi] = L, len = hi - lo, t = run.t;
  return { ...run, side: "l", loop: false, t: t < lo ? t : t < lo + n * len ? lo + (t - lo) % len : t - (n - 1) * len };
}

/** A reach at the gesture's target turns that wing so its spread tip points at it (by the reach's weight). */
function aim(pose: PoseState, bones: BoneDef[], rig: BirdRig, acc: GestureAcc) {
  const world = solve(bones, pose);
  for (const q of acc.reaches) {
    const to = (q.e < 0.5 ? q.a ?? q.b : q.b ?? q.a)?.to, bone = q.arm === "l" ? "wing" : "wing_far";
    if (to !== "target" || !q.target || !world.has(bone)) continue;
    const pk = q.arm === "l" ? "wing" : "wingFar", tip = rig.pivots[pk + "Tip"], p0 = pivot(rig, pk);
    const local: Vec2 = tip ? [(tip[0] - p0[0]) * rig.scale, (tip[1] - p0[1]) * rig.scale] : [0, -1];
    const P = jointOf(world, bone), T = apply(world.get(bone)!, local[0], local[1]);
    const d = Math.atan2(q.target[1] - P[1], q.target[0] - P[0]) - Math.atan2(T[1] - P[1], T[0] - P[0]);
    addRot(pose, bone, clamp(q.w, 0, 1) * wrap(d));
  }
}
