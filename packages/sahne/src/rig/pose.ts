// The pose of one actor at one moment, built from layers (DESIGN.md §7): the base (stand, carry,
// walk), the emotion's posture, the procedural idle (breath, sway, blink), the gestures, then IK
// for the reaching hands and a last pass that keeps the feet out of the floor.
// Pure: the same input gives the same pose, so a frame can be reproduced and tested.

import { clamp, type Vec2 } from "../core/math.ts";
import type { BodyDims } from "../core/types.ts";
import type { GestureDef, Side } from "../core/kit.ts";
import type { FacePreset } from "../face/params.ts";
import type { MoveHow } from "../script/types.ts";
import { solve, jointOf, restPose, type BoneDef, type PoseState } from "./skeleton.ts";
import { applyGesture, newAcc } from "./gesture.ts";
import { applyReach } from "./ik.ts";
import { walkLayer } from "./walk.ts";
import { idleAt } from "./idle.ts";
import { SIDES, addLen, addOff, addRot, limbSign } from "./layer.ts";

/** One gesture being performed. */
export interface GestureRun {
  id: string;
  /** Local time in ms, already scaled by the actor's tempo (0 = the gesture's start). */
  t: number;
  side: Side;
  /** The gesture's target (`at`) in the actor's paper space (cm, y down), if it has one. */
  target?: Vec2;
  /** For counting. */
  n?: number;
  /** Repeat the gesture's loop range instead of ending. */
  loop?: boolean;
  /** 0…1, for cross-fading two gestures (default 1). */
  weight?: number;
}

export interface PoseInput {
  bones: BoneDef[];
  body: BodyDims;
  defs: Record<string, GestureDef>;
  gestures: GestureRun[];
  /** Hands that hold a prop, 0…1 (the carry pose fades in): the arm bends to carry it and the hand grips. */
  hold?: Partial<Record<Side, number>>;
  /** The paper walk: `phase` counts steps (0…1 is one step), `amount` 0…1 fades it in and out, `dir` +1 walks towards screen right in paper space, −1 left. `how`: a `fly` is wingbeats, not steps. */
  walk?: { phase: number; amount: number; dir: number; how?: MoveHow; /** On a stair: +1 up, −1 down. */ climb?: number };
  /** The emotion now (the one it is turning to), for a kit puppet's moods. */
  emo?: string;
  /** How open the mouth is, 0…1 (a bird's beak). */
  talk?: number;
  /** At an `air` mark: a bird keeps flying (hovers). */
  air?: boolean;
  /** At a `pace` mark: a bird flies along (beats and drifts on the place's clock) instead of hovering. */
  pace?: boolean;
  /** Seated on a seat `h` m high, `k` of the way down (0…1). */
  seat?: { h: number; k: number } | null;
  /** The place's own clock (ms): it runs with the place's life (DESIGN.md §6.9). */
  life?: number;
  /** The emotion's head tilt (radians) and posture (−1 slumps … 1 lifts), already blended. */
  emotion?: { headTilt: number; posture: number };
  /** Idle life: global time (ms), a seed per actor, and how much of it (0 = still). */
  idle?: { t: number; seed: string; amount: number };
}

export interface PoseOut {
  pose: PoseState;
  /** Hand shapes: `hand_l` and `hand_r` (Item.alt keys), when not the kit's default. */
  alt: Record<string, string>;
  /** Face changes the gesture asks for, each with its weight. */
  faces: { preset: FacePreset; w: number }[];
  /** How far the face slides on the head (fractions of its width and height). */
  faceOff: Vec2;
  /** Where the gesture sends the eyes, if anywhere. */
  look?: "target" | "up" | "down" | "away" | "addressee" | null;
  /** Idle: how closed the eyes are for a blink (0…1) and a small gaze flick (pupil units). */
  blink: number;
  saccade: Vec2;
}

export function composePose(input: PoseInput): PoseOut {
  const { bones, body } = input;
  const pose: PoseState = { bones: {}, dx: 0, dy: 0, len: {}, off: {} };
  const hold: Record<Side, number> = { l: clamp(input.hold?.l ?? 0, 0, 1), r: clamp(input.hold?.r ?? 0, 0, 1) };
  // a gesture on an arm is written from the arm at rest, so the carry gives way while it plays
  // (fading over its first and last quarter-second) and comes back after it
  const busy = armsBusy(input.defs, input.gestures);
  for (const s of SIDES) if (hold[s] > 0) carry(pose, s, hold[s] * (1 - busy[s]));
  if (input.walk) walkLayer(pose, body, input.walk, hold);
  if (input.seat && input.seat.k > 0) seated(pose, body, input.seat, hold);
  if (input.emotion) posture(pose, body, input.emotion);
  let blink = 0, saccade: Vec2 = [0, 0];
  const idle = input.idle;
  if (idle && idle.amount > 0) {
    const a = clamp(idle.amount, 0, 1), life = idleAt(idle.t, idle.seed), k = body.torsoL / 43;
    // the chest rises with the breath and the shoulders ride along
    addOff(pose, "spine", 0, -0.35 * k * a * life.breath);
    addOff(pose, "arm_l", 0, -0.1 * k * a * life.breath);
    addOff(pose, "arm_r", 0, -0.1 * k * a * life.breath);
    // the hips sway; the thighs turn back so the legs stay upright
    const sway = 0.006 * a * life.sway;
    addRot(pose, "hips", sway); addRot(pose, "thigh_l", -sway); addRot(pose, "thigh_r", -sway);
    blink = a * life.blink;
    saccade = [a * life.saccade[0], a * life.saccade[1]];
  }

  const acc = newAcc();
  const size = { legs: body.legLen / 74, head: body.headH / 50 };
  for (const run of input.gestures) { const def = input.defs[run.id]; if (def) applyGesture(pose, def, run, acc, size); }
  if (acc.reaches.length) {
    const world = solve(bones, pose);
    for (const q of acc.reaches) applyReach(pose, bones, body, world, q, acc.faceOff);
  }
  keepFeetUp(pose, bones);

  const alt: Record<string, string> = {};
  for (const s of SIDES) {
    const shape = acc.shapes[s]?.shape ?? (hold[s] > 0 ? "hold" : undefined);
    if (shape) alt[`hand_${s}`] = shape;
  }
  const out: PoseOut = { pose, alt, faces: acc.faces, faceOff: acc.faceOff, blink, saccade };
  if (acc.look) out.look = acc.look.v;
  return out;
}

const ARMS = new WeakMap<GestureDef, Record<"a" | "b", boolean>>();
/** Whether a gesture moves its acting arm (a) and the other arm (b). */
function armsOf(def: GestureDef): Record<"a" | "b", boolean> {
  let r = ARMS.get(def);
  if (!r) {
    r = {
      a: def.keys.some(k => !!(k.arm || k.forearm || k.hand || k.reach)),
      b: def.keys.some(k => !!(k.arm2 || k.forearm2 || k.hand2 || k.reach2)),
    };
    ARMS.set(def, r);
  }
  return r;
}

/** How much each arm is taken by a gesture now, 0…1, easing in and out at the gesture's ends. */
function armsBusy(defs: Record<string, GestureDef>, runs: GestureRun[]): Record<Side, number> {
  const out: Record<Side, number> = { l: 0, r: 0 }, RAMP = 250;
  for (const run of runs) {
    const def = defs[run.id];
    if (!def || run.t < 0) continue;
    const looping = !!(run.loop && def.loop);
    if (!looping && run.t > def.dur) continue;
    const env = clamp(run.t / RAMP, 0, 1) * (looping ? 1 : clamp((def.dur - run.t) / RAMP, 0, 1)) * clamp(run.weight ?? 1, 0, 1);
    const arms = armsOf(def), other: Side = run.side === "l" ? "r" : "l";
    if (arms.a) out[run.side] = Math.max(out[run.side], env);
    if (arms.b) out[other] = Math.max(out[other], env);
  }
  return out;
}

/** Carrying, in gesture angles: the upper arm a little out, the forearm across the waist, the hand in front of the belly. */
const CARRY = { arm: 0.24, forearm: -1.62, hand: 0.15 };

function carry(pose: PoseState, s: Side, h: number) {
  const m = limbSign(s) * h;
  addRot(pose, `arm_${s}`, m * CARRY.arm);
  addRot(pose, `forearm_${s}`, m * CARRY.forearm);
  addRot(pose, `hand_${s}`, m * CARRY.hand);
}

/** The emotion's head tilt and posture: a slump sinks the chest, drops the head and draws the shoulders in; a lift does the opposite. */
function posture(pose: PoseState, body: BodyDims, e: { headTilt: number; posture: number }) {
  const tilt = e.headTilt || 0, p = clamp(e.posture || 0, -1, 1), k = body.torsoL / 43;
  addRot(pose, "head", 0.8 * tilt);
  addRot(pose, "neck", 0.2 * tilt);
  if (p < 0) {
    const s = -p;
    addLen(pose, "spine", -0.03 * s);
    addOff(pose, "neck", 0, 0.8 * s * k);
    addOff(pose, "arm_l", -0.4 * s * k, 0.5 * s * k);
    addOff(pose, "arm_r", 0.4 * s * k, 0.5 * s * k);
    addRot(pose, "arm_l", 0.04 * s); addRot(pose, "arm_r", -0.04 * s);
  } else if (p > 0) {
    addOff(pose, "spine", 0, -0.4 * p * k);
    addOff(pose, "neck", 0, -0.5 * p * k);
    addOff(pose, "arm_l", 0.5 * p * k, -0.3 * p * k);
    addOff(pose, "arm_r", -0.5 * p * k, -0.3 * p * k);
    addRot(pose, "arm_l", -0.03 * p); addRot(pose, "arm_r", 0.03 * p);
  }
}

const REST_ANKLES = new WeakMap<BoneDef[], Partial<Record<Side, number>>>();

/**
 * Sitting on a seat (a `seat` mark, DESIGN.md §5.5): the hips come down onto it, the thighs come
 * towards the viewer (foreshortened), the back rounds a little and the free hands rest on the thighs.
 * The feet stay on the floor through the floor pass (keepFeetUp bends the knees further), and hang
 * where the seat is higher than the shins (a bar stool).
 */
function seated(pose: PoseState, body: BodyDims, s: { h: number; k: number }, hold: Record<Side, number>) {
  const k = clamp(s.k, 0, 1), drop = Math.max(0, body.legLen - s.h * 100 - 2) * k;
  pose.dy += drop;
  for (const side of SIDES) {
    addLen(pose, `thigh_${side}`, -0.5 * k);
    const free = 1 - clamp(hold[side], 0, 1), sg = side === "r" ? 1 : -1;
    addRot(pose, `arm_${side}`, -sg * 0.06 * k * free);
    addRot(pose, `forearm_${side}`, -sg * 0.24 * k * free);
  }
  addRot(pose, "spine", 0.01 * k);
}

/**
 * No foot goes below the floor: an ankle lower than at rest (a bob, a bow, a sway) bends that knee
 * towards the viewer instead, by foreshortening the thigh just enough. Lifted feet are left alone.
 */
function keepFeetUp(pose: PoseState, bones: BoneDef[]) {
  let rest = REST_ANKLES.get(bones);
  if (!rest) {
    const w = solve(bones, restPose());
    rest = {};
    for (const s of SIDES) if (w.has(`foot_${s}`)) rest[s] = jointOf(w, `foot_${s}`)[1];
    REST_ANKLES.set(bones, rest);
  }
  if (rest.l === undefined && rest.r === undefined) return;
  const world = solve(bones, pose);
  for (const s of SIDES) {
    const r0 = rest[s], thigh = `thigh_${s}`;
    if (r0 === undefined || !world.has(thigh) || !world.has(`shin_${s}`)) continue;
    const sink = jointOf(world, `foot_${s}`)[1] - r0;
    if (sink <= 1e-9) continue;
    // the ankle moves with the knee, which slides along the thigh as its length scale changes
    const len = pose.len?.[thigh] ?? 1, per = (jointOf(world, `shin_${s}`)[1] - jointOf(world, thigh)[1]) / len;
    if (per > 1) addLen(pose, thigh, -Math.max(0, Math.min(len - 0.2, sink / per)));
  }
}
