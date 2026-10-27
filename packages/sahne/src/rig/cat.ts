// A cat puppet (DESIGN.md §5.4): a side-on four-legged body whose postures are drawings (standing,
// sitting, a loaf, asleep), on one set of bones, with a stride for walking, a tail that sways, a head
// that turns to look and a mouth that opens to miaow. Generic like rig/bird.ts: the kit brings the cat
// (pivots, postures, moods, gestures), nothing here knows Pisi. Pure: same input, same pose.
//
// Angles in the cat's data are degrees and its lengths art units: + turns clockwise on screen (the
// engine's own sign: the nose dips), + moves down. The art faces screen right (+x), standing.
//
// The art switches it returns in `PoseOut.alt` (the kit's `Item.alt` keys):
//   body    stand | sit | loaf | sleep    the posture's drawing (walking is `stand`)
//   tail    the same names                 each posture has its own tail
//   legs    on | off                       the four legs, drawn only while standing
//   eyes    open | shut                    a blink is a short `shut`
//   mouth   shut | open                    open while it miaows or speaks

import { apply, clamp, type Vec2 } from "../core/math.ts";
import type { GestureDef } from "../core/kit.ts";
import { solve, jointOf, type BoneDef, type PoseState } from "./skeleton.ts";
import { applyGesture, newAcc, type GestureAcc } from "./gesture.ts";
import { idleAt } from "./idle.ts";
import { addLen, addOff, addRot } from "./layer.ts";
import type { GestureRun, PoseInput, PoseOut } from "./pose.ts";

/** One posture: where its head and tail join it (art units, y down), their turns (degrees), and what it shows. */
export interface CatPosture {
  head: Vec2; headRot?: number;
  tail: Vec2; tailRot?: number;
  /** The legs are drawn (standing); sitting, loafing and asleep they are in the body's drawing. */
  legs?: boolean;
  /** Eyes shut in this posture (a loaf, asleep). */
  shut?: boolean;
  /** The tail's idle sway, degrees either way, and its period (ms). */
  sway?: number; swayMs?: number;
}

export interface CatRig {
  /** Pivots in art units, standing (y down): `cat` (the feet: the root), `body`, `head`, `tail`, and the legs' tops `legNF`, `legNB` (near front and back), `legFF`, `legFB` (far). */
  pivots: Record<string, Vec2>;
  /** Centimetres per art unit. */
  scale: number;
  /** `stand` (also the walk), and the rest postures its moods name (`sit`, `loaf`, `sleep`). */
  postures: Record<string, CatPosture>;
}

/** A mood: a posture, and the head, tail and eyes it wears there (degrees, art units + down). */
export interface CatMood {
  posture: string;
  head?: number; headDy?: number; tail?: number;
  /** The whole cat down (+, a crouch) or up. */
  dy?: number;
  eyes?: "open" | "shut";
}

export interface CatPoseOptions {
  rig: CatRig;
  moods: Record<string, CatMood>;
  /** The kit's emotion → a mood name; an unmapped one is `idle`. */
  emo: Record<string, string>;
  /** `still` holds the stride and the tail (reduced motion, a still). */
  motion?: "full" | "calm" | "still";
}

// [bone, parent, pivot]: the root stands on the feet; the body carries the legs, the tail and the head
const CAT: [string, string | null, string][] = [
  ["root", null, "cat"], ["body", "root", "body"], ["leg_fb", "body", "legFB"], ["leg_ff", "body", "legFF"],
  ["tail", "body", "tail"], ["leg_nb", "body", "legNB"], ["leg_nf", "body", "legNF"], ["head", "body", "head"],
];

const pivot = (r: CatRig, k: string): Vec2 => {
  const p = r.pivots[k];
  if (!p) throw new Error(`sahne: cat pivot "${k}" missing`);
  return p;
};

/** The cat's bones in paper cm (y down, feet at the origin), each at its pivot relative to its parent's. */
export function catBones(r: CatRig): BoneDef[] {
  const pv = new Map(CAT.map(([n, , k]) => [n, pivot(r, k)]));
  return CAT.map(([name, parent, k]) => {
    const p = pivot(r, k), q = parent ? pv.get(parent)! : p;
    return { name, parent, x: (p[0] - q[0]) * r.scale, y: (p[1] - q[1]) * r.scale, rot: 0 };
  });
}

const R = 0.017453292519943295; // π / 180 (a literal, as rig/bird.ts)
/** A walk's leg swing (radians either way) and how high a paw lifts as it comes forward (art units); a run's are larger. */
const SWING = 0.32, LIFT = 1.4, RUN_SWING = 0.5, RUN_LIFT = 2.6;
/** A walk's gait: the near hind leg, then the near front, the far hind, the far front, a quarter of the cycle apart (two steps to a cycle). */
const GAIT: [string, number][] = [["leg_nb", 0], ["leg_nf", 0.25], ["leg_fb", 0.5], ["leg_ff", 0.75]];
/** How far the head may turn to look, radians up (−) and down. */
const LOOK = [-0.75, 0.5];
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export function catPose(input: PoseInput, o: CatPoseOptions): PoseOut {
  const { rig } = o, s = rig.scale;
  const pose: PoseState = { bones: {}, dx: 0, dy: 0, len: {}, off: {} };
  const still = o.motion === "still", idle = input.idle, a = still || !idle ? 0 : clamp(idle.amount, 0, 1);
  const w = input.walk && input.walk.how !== "fly" ? input.walk : undefined, A = w ? clamp(w.amount, 0, 1) : 0;
  const mood = o.moods[o.emo[input.emo ?? ""] ?? "idle"] ?? o.moods.idle ?? { posture: "sit" };
  // the gestures first, on their own: one may ask for a posture while it plays (`shape2`: getting up to eat)
  const acc = newAcc(), g: PoseState = { bones: {}, dx: 0, dy: 0, off: {} };
  for (const run of input.gestures) { const def = input.defs[run.id]; if (def) gesture(g, def, run, acc); }
  const sh = acc.shapes.l?.shape, sh2 = acc.shapes.r?.shape;
  // walking it stands; at rest it takes the gesture's posture, else its mood's (a walk fading in or out switches about halfway)
  const own = A <= 0.4 && !(sh2 && rig.postures[sh2]) && !!rig.postures[mood.posture], m: CatMood = own ? mood : { posture: "stand" };
  const name = A > 0.4 ? "stand" : sh2 && rig.postures[sh2] ? sh2 : own ? mood.posture : "stand", P = rig.postures[name];
  const alt: Record<string, string> = { body: name, tail: name, legs: P.legs ? "on" : "off", eyes: m.eyes ?? (P.shut ? "shut" : "open"), mouth: "shut" };

  // the head and the tail join this posture's drawing where it says
  const hp = pivot(rig, "head"), tp = pivot(rig, "tail");
  addOff(pose, "head", s * (P.head[0] - hp[0]), s * (P.head[1] - hp[1]));
  addOff(pose, "tail", s * (P.tail[0] - tp[0]), s * (P.tail[1] - tp[1]));
  addRot(pose, "head", R * ((P.headRot ?? 0) + (m.head ?? 0)));
  addRot(pose, "tail", R * ((P.tailRot ?? 0) + (m.tail ?? 0)));
  addOff(pose, "head", 0, s * (m.headDy ?? 0)); pose.dy += s * (m.dy ?? 0);

  if (w && P.legs) {
    // a stride: each leg swings from its top, back on the ground and forward in the air (its paw lifted), a quarter-cycle after the last
    const run = w.how === "run", sw = (run ? RUN_SWING : SWING) * A, lift = (run ? RUN_LIFT : LIFT) * A * s, c = still ? 0 : w.phase / 2;
    for (const [bone, off] of GAIT) {
      const th = 2 * Math.PI * (c + off);
      addRot(pose, bone, sw * Math.sin(th));
      addOff(pose, bone, 0, -lift * Math.max(0, -Math.cos(th)));
    }
    // the back bobs twice a cycle, the head nods against it, the tail swings with the hips
    const bob = (1 - Math.cos(4 * Math.PI * c)) / 2;
    pose.dy -= s * (run ? 1.2 : 0.5) * A * bob;
    addRot(pose, "head", 0.035 * A * Math.sin(4 * Math.PI * c));
    addRot(pose, "tail", 0.12 * A * Math.sin(2 * Math.PI * c));
  }

  if (a > 0 && idle) {
    const life = idleAt(idle.t, idle.seed);
    // it breathes (the body swells about its middle), its tail sways on its own slow clock, and it blinks
    addLen(pose, "body", 0.012 * a * life.breath);
    addRot(pose, "tail", R * (P.sway ?? 0) * a * Math.sin(2 * Math.PI * idle.t / (P.swayMs ?? 2800)));
    if (!w) addRot(pose, "head", R * 2 * a * life.sway);
    if (life.blink >= 0.5 && alt.eyes === "open") alt.eyes = "shut";
  }
  // speaking (a line given to the cat) opens the mouth
  if ((input.talk ?? 0) > 0.3) alt.mouth = "open";

  // the gestures on top; a gesture's `shape` is the mouth's, its `shape2` the eyes' (or a posture's, above)
  for (const [b, v] of Object.entries(g.bones)) addRot(pose, b, v);
  for (const [b, v] of Object.entries(g.off ?? {})) if (v) addOff(pose, b, v[0], v[1]);
  pose.dy += g.dy;
  if (sh === "open" || sh === "shut") alt.mouth = sh;
  if (sh2 === "open" || sh2 === "shut") alt.eyes = sh2;
  if (acc.reaches.length) aim(pose, input.bones, acc);

  const out: PoseOut = { pose, alt, faces: [], faceOff: [0, 0], blink: 0, saccade: [0, 0] };
  if (acc.look) out.look = acc.look.v;
  return out;
}

/**
 * One gesture on a cat, through the humanoid channels (played on side `l`): head and neck → the head (+ the nose down),
 * headDy → the head along its neck, spine → the body (+ the front down), arm → the near front leg (+ forward and up:
 * a paw), arm2 → the far front leg, dy → the whole cat (− up). A `reach` to the target turns the head towards it;
 * `shape` is the mouth (`open`, `shut`), `shape2` the eyes (`open`, `shut`) or a posture to take while it plays.
 */
function gesture(pose: PoseState, def: GestureDef, run: GestureRun, acc: GestureAcc) {
  const g: PoseState = { bones: {}, dx: 0, dy: 0 }, b = g.bones;
  applyGesture(g, def, { ...run, side: "l" }, acc, { legs: 1, head: 1 });
  addRot(pose, "head", (b.head ?? 0) + (b.neck ?? 0));
  // the body tips about its middle; the legs stay upright under it
  addRot(pose, "body", b.spine ?? 0);
  for (const l of ["leg_nf", "leg_ff", "leg_nb", "leg_fb"]) addRot(pose, l, -(b.spine ?? 0));
  // on side l the arm is written with the left limb's sign (−) and arm2 with the right's (+)
  addRot(pose, "leg_nf", b.arm_l ?? 0);
  addRot(pose, "leg_ff", -(b.arm_r ?? 0));
  pose.dy += g.dy;
  const hd = g.off?.head;
  if (hd) addOff(pose, "head", hd[0], hd[1]);
}

/** A reach at the target turns the head so its nose (+x in its frame) points at it, by the reach's weight, within LOOK; side-on, a target behind is looked at over the shoulder only as high or low as it is. */
function aim(pose: PoseState, bones: BoneDef[], acc: GestureAcc) {
  const world = solve(bones, pose);
  for (const q of acc.reaches) {
    const to = (q.e < 0.5 ? q.a ?? q.b : q.b ?? q.a)?.to;
    if (to !== "target" || !q.target || q.arm !== "l") continue;
    const P = jointOf(world, "head"), T = apply(world.get("head")!, 1, 0);
    const d = wrap(Math.atan2(q.target[1] - P[1], Math.abs(q.target[0] - P[0])) - Math.atan2(T[1] - P[1], T[0] - P[0]));
    const now = pose.bones.head ?? 0, want = clamp(now + d, LOOK[0], LOOK[1]) - now;
    addRot(pose, "head", clamp(q.w, 0, 1) * want);
  }
}
