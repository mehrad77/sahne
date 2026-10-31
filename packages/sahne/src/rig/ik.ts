// Two-bone IK for the arms in the puppet's paper plane (DESIGN.md §7): a hand reaches a point on
// the stage or on the actor's own body, or points along a direction. It works on the world
// transforms of the pose built so far and hands back local angle offsets, blended with the
// keyed angles by the reach's weight.

import { apply, clamp, type Affine, type Vec2 } from "../core/math.ts";
import type { BodyDims } from "../core/types.ts";
import type { Reach, ReachTo, Side } from "../core/kit.ts";
import { jointOf, type BoneDef, type PoseState } from "./skeleton.ts";
import type { ReachReq } from "./gesture.ts";
import { limbSign, other, sideX } from "./layer.ts";

const TAU = 2 * Math.PI;
export const wrapPi = (a: number) => a - TAU * Math.floor((a + Math.PI) / TAU);
/**
 * An arm angle (outwards from hanging, + up the outside) in [−2.2, 2π − 2.2): across the chest up
 * to a little above horizontal is negative, everything else goes round the outside and over the
 * top, so blending two arm angles never swings the arm up through the body.
 */
const ARM_LO = -2.2;
export const normArm = (a: number) => a - TAU * Math.floor((a - ARM_LO) / TAU);

const INDEX = new WeakMap<BoneDef[], Map<string, BoneDef>>();
export function boneIndex(bones: BoneDef[]): Map<string, BoneDef> {
  let ix = INDEX.get(bones);
  if (!ix) { ix = new Map(bones.map(b => [b.name, b])); INDEX.set(bones, ix); }
  return ix;
}

/**
 * Two bones from the origin to (qx, qy), lengths L1 and L2, in paper space. Returns the world
 * angles of the upper and lower bone (engine convention: 0 points down, + turns clockwise). Of the
 * two elbows, the one further down and outwards (`o`: +1 when outwards is screen right) wins. A
 * point out of reach straightens the chain towards it; one too close folds it.
 */
export function twoBone(qx: number, qy: number, L1: number, L2: number, o: number, up = false): [number, number] {
  let d = Math.hypot(qx, qy);
  if (d < 1e-6) { qx = 0; qy = 1; d = 1; }
  const ux = qx / d, uy = qy / d, r = clamp(d, Math.abs(L1 - L2), L1 + L2);
  const c = clamp((L1 * L1 + r * r - L2 * L2) / (2 * L1 * r || 1), -1, 1), s = Math.sqrt(1 - c * c);
  const e1x = ux * c - uy * s, e1y = ux * s + uy * c, e2x = ux * c + uy * s, e2y = -ux * s + uy * c;
  // `up` picks the elbow that is up and outwards instead (pointing down at something close)
  const one = up ? o * e1x - e1y >= o * e2x - e2y : o * e1x + e1y >= o * e2x + e2y;
  const ex = one ? e1x : e2x, ey = one ? e1y : e2y, fx = ux * r - ex * L1, fy = uy * r - ey * L1;
  return [Math.atan2(-ex, ey), Math.atan2(-fx, fy)];
}

/**
 * A place on the actor's own body, for the hand on `side` (ear, eye, hip and front are on that
 * hand's side; shoulder2 is the other shoulder). Head points follow the face's slide.
 */
export function selfPoint(to: ReachTo, world: Map<string, Affine>, ix: Map<string, BoneDef>, body: BodyDims, side: Side, faceOff: Vec2): Vec2 | null {
  const o = sideX(side), W = body.headW, H = body.headH, fx = faceOff[0] * W, fy = faceOff[1] * H;
  const head = world.get("head"), spine = world.get("spine");
  if (!head || !spine) return null;
  switch (to) {
    case "mouth": return apply(head, fx, -H * 0.19 + fy);
    case "chin": return apply(head, fx, -H * 0.04 + fy);
    case "nose": return apply(head, fx, -H * 0.305 + fy);
    case "eye": return apply(head, o * W * 0.205 + fx, -H * 0.43 + fy);
    case "ear": return apply(head, o * (W * 0.5 - 0.6), -H * 0.42);
    case "forehead": return apply(head, fx, -H * 0.7 + fy);
    case "head_top": return apply(head, 0, -H);
    case "chest": return apply(spine, 0, -body.torsoL * 0.7);
    case "belly": return apply(spine, 0, -body.torsoL * 0.25);
    case "hip": return apply(spine, o * body.hipW * 0.5, -body.torsoL * 0.1);
    case "shoulder2": return world.has(`arm_${other(side)}`) ? jointOf(world, `arm_${other(side)}`) : null;
    case "front": {
      // in front of the body at about elbow height, a little to this hand's side
      const a = ix.get(`arm_${side}`);
      return a ? apply(spine, o * Math.abs(a.x) * 0.45, a.y + body.upperArmL * 0.95) : null;
    }
    default: return null;
  }
}

/**
 * A point up and across the body (out of reach, or pointed at) would lay the arm over the face:
 * keep the arm either across the chest, at most a little above horizontal, or raised overhead.
 */
function acrossLimit(qx: number, qy: number, o: number): [number, number] {
  const th = Math.atan2(o * qx, qy), lo = -2.75, hi = -1.95;
  if (th <= lo || th >= hi) return [qx, qy];
  const t = th > (lo + hi) / 2 ? hi : lo, d = Math.hypot(qx, qy);
  return [o * d * Math.sin(t), d * Math.cos(t)];
}

/** The arm's angle, the forearm's offset and, when pointing, the hand's offset (null: leave the hand as keyed). */
interface ArmSol { A: number; F: number; H: number | null }

/** The arm's angle (as normArm, relative to its parent) and the forearm's engine offset that carry out one reach. */
function solveReach(pose: PoseState, ix: Map<string, BoneDef>, body: BodyDims, world: Map<string, Affine>, side: Side, r: Reach, target: Vec2 | undefined, faceOff: Vec2): ArmSol | null {
  const arm = ix.get(`arm_${side}`), fore = ix.get(`forearm_${side}`), hand = ix.get(`hand_${side}`);
  const parent = arm?.parent ? world.get(arm.parent) : undefined;
  if (!arm || !fore || !hand || !parent) return null;
  let T = r.to === "target" ? target : selfPoint(r.to, world, ix, body, side, faceOff);
  if (!T) return null;
  const o = sideX(side), T0 = T;
  const S = jointOf(world, arm.name);
  const L1 = Math.hypot(fore.x, fore.y) * (pose.len?.[arm.name] ?? 1), L2 = Math.hypot(hand.x, hand.y) * (pose.len?.[fore.name] ?? 1), L = L1 + L2;
  // offsets are written for an adult's arm (54 cm): a child's hands land as close in
  if (r.off) { const k = (body.upperArmL + body.foreArmL) / 54; T = [T[0] + o * r.off[0] * k, T[1] + r.off[1] * k]; }
  let qx = T[0] - S[0], qy = T[1] - S[1], near = false;
  if (r.aim === "dir") {
    const d = Math.hypot(qx, qy) || 1, want = clamp(r.ext ?? 0.95, 0, 1) * L;
    if (d < want + body.handL) {
      // never point past a thing within reach (the stage's depth is lost in the paper plane):
      // point down at it as people do at a counter, the elbow out and up, the forearm sloping
      // down, the hand just above and outside it with the finger on the line
      near = true;
      const k = body.handL * 1.15 / Math.hypot(0.5, 1);
      qx += o * 0.5 * k; qy -= k;
    } else { qx *= want / d; qy *= want / d; }
  } else {
    // a point far across the body (behind the actor's back): the hand stops past the far shoulder
    const lim = 2 * Math.abs(arm.x) + 0.25 * L;
    if (o * qx < -lim) qx = -o * lim;
  }
  if ((r.aim === "dir" && !near) || Math.hypot(qx, qy) >= L) [qx, qy] = acrossLimit(qx, qy, o);
  const [p1, p2] = twoBone(qx, qy, L1, L2, o, near && qy > -0.25 * L);
  // bone rotations whose child joints lie on those directions, then local offsets
  const r1 = p1 - Math.atan2(-fore.x, fore.y), r2 = p2 - Math.atan2(-hand.x, hand.y);
  const off1 = r1 - Math.atan2(parent[1], parent[0]) - arm.rot;
  let H: number | null = null;
  if (r.aim === "dir") {
    // the wrist turns the finger onto the target itself (not the offset point the hand went to), as far as a wrist bends
    const wx = S[0] + L1 * -Math.sin(p1) + L2 * -Math.sin(p2), wy = S[1] + L1 * Math.cos(p1) + L2 * Math.cos(p2);
    const want = Math.atan2(-(T0[0] - wx), T0[1] - wy);
    H = clamp(wrapPi(want - r2 - hand.rot), -1.1, 1.1);
  }
  return { A: normArm(limbSign(side) * (arm.rot + off1)), F: wrapPi(r2 - r1 - fore.rot), H };
}

/**
 * Blends one reaching hand into the pose: the IK solutions of the keys either side are blended by
 * the key fraction (arm angles stay on the outside, so the hand travels on an arc), then with the
 * keyed angles by the reach weight. `world` is the solved pose before any reach.
 */
export function applyReach(pose: PoseState, bones: BoneDef[], body: BodyDims, world: Map<string, Affine>, q: ReachReq, faceOff: Vec2): void {
  const ix = boneIndex(bones);
  const a = q.a ? solveReach(pose, ix, body, world, q.arm, q.a, q.target, faceOff) : null;
  const b = q.b ? solveReach(pose, ix, body, world, q.arm, q.b, q.target, faceOff) : null;
  const mixH = (x: ArmSol, y: ArmSol) => x.H !== null && y.H !== null ? x.H + (y.H - x.H) * q.e : y.H ?? x.H;
  const sol = a && b ? { A: a.A + (b.A - a.A) * q.e, F: a.F + wrapPi(b.F - a.F) * q.e, H: mixH(a, b) } : a ?? b;
  const arm = ix.get(`arm_${q.arm}`), fore = ix.get(`forearm_${q.arm}`);
  if (!sol || !arm || !fore) return;
  const m = limbSign(q.arm), w = clamp(q.w, 0, 1);
  const A0 = normArm(m * (arm.rot + (pose.bones[arm.name] ?? 0))), F0 = pose.bones[fore.name] ?? 0;
  pose.bones[arm.name] = m * (A0 + (sol.A - A0) * w) - arm.rot;
  pose.bones[fore.name] = F0 + wrapPi(sol.F - F0) * w;
  const hand = `hand_${q.arm}`;
  if (sol.H !== null) { const H0 = pose.bones[hand] ?? 0; pose.bones[hand] = H0 + (sol.H - H0) * w; }
}
