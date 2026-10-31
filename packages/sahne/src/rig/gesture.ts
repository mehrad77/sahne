// Gestures as keyframed data (DESIGN.md §7): sampling the keys with their eases and loops,
// mirroring them onto the acting side, and the overlap that makes the head lead and the hand
// settle last. Everything is a pure function of the gesture and the run's local time.

import { ease, clamp, type Vec2 } from "../core/math.ts";
import type { GestureDef, GestureKey, GesturePose, Reach, Side } from "../core/kit.ts";
import type { FacePreset } from "../face/params.ts";
import type { PoseState } from "./skeleton.ts";
import type { GestureRun } from "./pose.ts";
import { addLen, addOff, addRot, limbSign, other, sideX } from "./layer.ts";

/** Overlap, in ms of local time behind the arm: the head leads, the forearm follows, the hand settles last. */
export const LAG = { head: -40, forearm: 30, hand: 60 } as const;

type Channel = keyof GesturePose;

const EASE: Record<NonNullable<GestureKey["ease"]>, (t: number) => number> = {
  inOut: ease.inOut, out: ease.out, in: ease.in, linear: ease.linear, spring: t => ease.spring(t),
};

/** A moment of a gesture: the keys either side (`a` at or before, `b` after), the eased fraction between them, and `a`'s index. */
export interface Seg { a: GestureKey | null; b: GestureKey | null; e: number; i: number }

const SORTED = new WeakMap<GestureDef, GestureKey[]>();
export function keysOf(def: GestureDef): GestureKey[] {
  let k = SORTED.get(def);
  if (!k) { k = def.keys.slice().sort((x, y) => x.t - y.t); SORTED.set(def, k); }
  return k;
}

const easeOf = (k: GestureKey, s: number) => (EASE[k.ease ?? "inOut"] ?? ease.inOut)(s);

/** Before the first key the gesture eases out of rest (a = null); after the last it holds it (b = null). */
export function seg(keys: GestureKey[], t: number): Seg {
  const n = keys.length;
  if (!n) return { a: null, b: null, e: 0, i: -1 };
  if (t < keys[0].t) { const b = keys[0]; return { a: null, b, e: b.t > 0 ? easeOf(b, clamp(t / b.t, 0, 1)) : 1, i: -1 }; }
  let lo = 0, hi = n - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (keys[m].t <= t) lo = m; else hi = m - 1; }
  if (lo === n - 1) return { a: keys[lo], b: null, e: 0, i: lo };
  const a = keys[lo], b = keys[lo + 1], span = b.t - a.t;
  return { a, b, e: span > 0 ? easeOf(b, (t - a.t) / span) : 1, i: lo };
}

/** A channel's value; a key that leaves the channel out is at rest (0) there. */
export function ch(s: Seg, c: Channel): number {
  const va = s.a?.[c] ?? 0, vb = s.b ? s.b[c] ?? 0 : va;
  return va + (vb - va) * s.e;
}

/** A thigh's foreshortening as a change of its length scale (rest is 1, so a missing key is 0 change). */
function lenCh(s: Seg, c: "thighLen" | "thighLen2"): number {
  const va = s.a ? (s.a[c] ?? 1) - 1 : 0, vb = s.b ? (s.b[c] ?? 1) - 1 : va;
  return va + (vb - va) * s.e;
}

/** The latest key at or before index i that has something to say. */
function latest(keys: GestureKey[], i: number, has: (k: GestureKey) => boolean): GestureKey | undefined {
  for (; i >= 0; i--) if (has(keys[i])) return keys[i];
  return undefined;
}

export const loops = (def: GestureDef, run: GestureRun) => !!(run.loop && def.loop && def.loop[1] > def.loop[0]);

/** Local time with the loop range repeating forever once it is reached. */
export function localTime(def: GestureDef, t: number, loop: boolean): number {
  if (loop) { const [a, b] = def.loop!; if (t >= b) return a + (t - a) % (b - a); }
  return Math.max(0, t);
}

/** A hand that reaches: the reaches of the keys either side (blended by `e`) and the IK weight. */
export interface ReachReq { arm: Side; a?: Reach; b?: Reach; e: number; w: number; target?: Vec2 }

/** What the gestures ask for besides angles, gathered over every run. */
export interface GestureAcc {
  reaches: ReachReq[];
  shapes: Partial<Record<Side, { shape: string; w: number }>>;
  faces: { preset: FacePreset; w: number }[];
  faceOff: Vec2;
  look?: { v: GestureKey["look"]; w: number };
}

export const newAcc = (): GestureAcc => ({ reaches: [], shapes: {}, faces: [], faceOff: [0, 0] });

// [channel, bone, on the other side, timing: 0 arm, 1 forearm, 2 hand]
const LIMBS: [Channel, string, boolean, 0 | 1 | 2][] = [
  ["arm", "arm", false, 0], ["forearm", "forearm", false, 1], ["hand", "hand", false, 2],
  ["arm2", "arm", true, 0], ["forearm2", "forearm", true, 1], ["hand2", "hand", true, 2],
  ["thigh", "thigh", false, 0], ["shin", "shin", false, 0], ["foot", "foot", false, 0],
  ["thigh2", "thigh", true, 0], ["shin2", "shin", true, 0], ["foot2", "foot", true, 0],
];

function addFace(acc: GestureAcc, preset: FacePreset, w: number) {
  if (w <= 1e-4) return;
  const f = acc.faces.find(x => x.preset === preset);
  if (f) f.w += w; else acc.faces.push({ preset, w });
}

/**
 * Adds one run's angles to the pose and its reaches, shapes, faces and look to `acc`. Gestures are
 * written in an adult's centimetres: `size` scales `dy` by the legs and `headDy` by the head.
 */
export function applyGesture(pose: PoseState, def: GestureDef, run: GestureRun, acc: GestureAcc, size = { legs: 1, head: 1 }): void {
  const loop = loops(def, run), w = clamp(run.weight ?? 1, 0, 1);
  if (w <= 0 || run.t < 0 || (!loop && run.t > def.dur)) return;
  const keys = keysOf(def), at = (lag: number) => seg(keys, localTime(def, run.t - lag, loop));
  const arm = at(0), segs = [arm, at(LAG.forearm), at(LAG.hand)], head = at(LAG.head);
  const s = run.side, o = other(s), tx = sideX(s);

  for (const [c, bone, two, timing] of LIMBS) {
    const side = two ? o : s;
    addRot(pose, `${bone}_${side}`, limbSign(side) * w * ch(segs[timing], c));
  }
  // the trunk leans its top towards the acting side
  addRot(pose, "spine", tx * w * ch(arm, "spine"));
  addRot(pose, "neck", tx * w * ch(head, "neck"));
  addRot(pose, "head", tx * w * ch(head, "head"));
  pose.dy += w * ch(arm, "dy") * size.legs;
  addOff(pose, "head", 0, w * ch(head, "headDy") * size.head);
  addLen(pose, `thigh_${s}`, w * lenCh(arm, "thighLen"));
  addLen(pose, `thigh_${o}`, w * lenCh(arm, "thighLen2"));
  acc.faceOff[0] += tx * w * ch(head, "faceX");
  acc.faceOff[1] += w * ch(head, "faceY");

  for (const [f, side] of [["reach", s], ["reach2", o]] as const) {
    const ra = arm.a?.[f], rb = arm.b ? arm.b[f] : undefined;
    const wa = ra ? ra.w ?? 1 : 0, wb = arm.b ? (rb ? rb.w ?? 1 : 0) : wa;
    const wi = w * (wa + (wb - wa) * arm.e);
    if (wi > 1e-4) acc.reaches.push({ arm: side, a: ra, b: rb, e: arm.e, w: wi, target: run.target });
  }

  // hand shapes switch with the hand; the stronger of two cross-fading gestures wins
  if (w >= 0.5) for (const [f, side] of [["shape", s], ["shape2", o]] as const) {
    const k = latest(keys, segs[2].i, k => k[f] !== undefined);
    if (!k || w < (acc.shapes[side]?.w ?? 0)) continue;
    const shape = k[f]!;
    acc.shapes[side] = { shape: shape === "count" ? `count${clamp(Math.round(run.n ?? 1), 1, 5)}` : shape, w };
  }

  const fa = head.a?.face, fb = head.b?.face;
  if (fa && fa === fb) addFace(acc, fa, w);
  else { if (fa) addFace(acc, fa, w * (1 - head.e)); if (fb) addFace(acc, fb, w * head.e); }

  const lk = latest(keys, arm.i, k => k.look !== undefined);
  if (lk && w >= (acc.look?.w ?? 0)) acc.look = { v: lk.look, w };
}
