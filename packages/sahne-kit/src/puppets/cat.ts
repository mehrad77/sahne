// Pisi's puppet (DESIGN.md §5.4): the street cat of set/outdoor.ts (oneCat), cut again as a puppet on sahne's cat rig
// (rig/cat.ts): standing, sitting, a loaf and asleep are four drawings of the body on one set of bones, with four legs that
// stride, a tail for each posture, and a head (almond eyes awake, closed lines asleep, a mouth that opens to miaow).
// Pisi is black (the owner, 2026-10-23): one coat, no white chest, gold eyes. About 45 cm nose to tail, 37 cm to the ears.

import { band, ellipse, rrect, smooth, catBones, catPose, mix, type BodyDims, type CatMood, type CatPoseOptions, type CatRig, type GestureDef, type GestureKey, type Item, type Kit, type KitPuppet, type Path, type Shape, type Vec2 } from "sahne";
import { S, P, L, part, piece, boxOf, tf } from "./draw.ts";

/** The black coat: fur, the far side in shade, the inner ears, the nose, the eyes. */
const C = "#2F2C2C", SH = mix(C, "#463C38", 0.3), PINK = "#8A5D5A", NOSE = "#4A3A3A", EYE = "#C9B23C", PUPIL = "#1E1A18", LID = "#8A807A";

/** A tapering band along a spine: a tail, a leg. */
const limb = (pts: Vec2[], w0: number, w1: number) => band(pts, pts.map((_, i) => w0 + (w1 - w0) * i / (pts.length - 1)));
/** Shapes moved by (x, y). */
const put = (sh: Shape[], x: number, y: number): Shape[] => tf(sh, [1, 0, 0, 1, x, y]);

// ---- the head, centred at 0 (set/outdoor.ts): skull and ears in one outline, pink in the ears, the nose ----
const SKULL: Path = smooth([[-4.4, 3.4], [-5.2, -0.4], [-4.6, -3.7], [-4.3, -8.8, 0], [-1.2, -5.3], [0.6, -5.6], [2.9, -9.6, 0], [4.8, -4.2], [6.0, -2.2], [6.7, -0.4], [7.3, 0.6], [7.0, 1.9], [5.2, 3.1], [1.5, 4.1], [-1.8, 4.3]]);
const mark = (q: Path, col: string): Shape => ({ path: q, fill: col, flat: true });
const HEAD = part(SKULL, C, [
  mark(smooth([[1.3, -5.7], [2.8, -8.3, 0], [4.1, -4.6]]), PINK), mark(smooth([[-3.4, -5.2], [-3.9, -7.7, 0], [-1.8, -5.3]]), mix(PINK, "#000000", 0.25)),
  mark(smooth([[6.4, -0.2], [7.4, 0.1], [6.9, 1.0]]), NOSE),
]);
const EYES: [number, number, number][] = [[2.7, -1.2, 1], [5.6, -1.4, 0.6]];
/** Small almond eyes awake, gold with a slit. */
const OPEN = EYES.flatMap(([x, y, s]) => [P([[x - 0.95 * s, y + 0.1, 0], [x - 0.1, y - 0.7], [x + 0.95 * s, y - 0.35, 0], [x + 0.1, y + 0.55]], EYE, { flat: true }), S(ellipse(x + 0.1, y - 0.05, 0.28 * s, 0.6), PUPIL, { flat: true })]);
/** Closed lines asleep or blinking. */
const SHUT = EYES.map(([x, y, s]) => L([[x - 0.9 * s, y - 0.1], [x, y + 0.45], [x + 0.9 * s, y - 0.15]], LID, 0.38));
/** The mouth open under the nose, a miaow: the dark of it and a pink tongue. */
const MOUTH = [P([[4.5, 2.0, 0], [7.4, 1.4], [7.1, 3.5], [5.4, 4.4, 0]], "#3A2224", { flat: true }), S(ellipse(6.1, 3.5, 0.95, 0.55), "#B76B6E", { flat: true })];

/** The head's centre from its pivot (the neck). */
const HC: Vec2 = [2, -2.5];

// ---- standing (the walk's drawing, set/outdoor.ts): the torso, the legs each on its own bone, the tail up ----
const TORSO = smooth([[-14.5, -15], [-13.5, -20.5], [-9, -23.2], [0, -22], [8, -23.4], [12.5, -26.5], [15.8, -20], [13.5, -14], [9.5, -12.2], [0, -11.8], [-8, -12.4], [-12.5, -12.8]]);
/** A leg in its bone's frame (its top at 0): a hind one bent at the hock, a front one straight; the near hind carries its haunch. */
function leg(hind: boolean, near: boolean): Shape[] {
  const col = near ? C : SH, sp: Vec2[] = hind ? [[0, 0], [1, 7], [-1.4, 11.4], [-0.6, 14.8]] : near ? [[0, 0], [0, 11.5], [0, 17.8]] : [[0, 0], [0, 8.5], [0, 14.8]];
  const [px, py] = sp[sp.length - 1];
  return [...(hind && near ? part(ellipse(0, -1, 5.6, 6), C) : []), ...part(band(sp, hind ? [5, 3.6, 2.8, 2.6] : [near ? 5.4 : 4.4, 3, 2.6]), col), ...part(ellipse(px + 0.7, py + 0.1, 1.9, 1.1), col)];
}
const TAIL_UP: Vec2[] = [[0, 0], [-3.4, -4], [-5, -10], [-3.6, -16], [-0.6, -19.2], [2, -18.6]];

// ---- sitting up: chest and haunch, the front legs straight down, the tail round the feet with its tip apart ----
const SIT = [
  ...[[7.6, false], [5.2, true]].flatMap(([x, near]) => part(limb([[x as number, -15], [(x as number) + 0.3, -7], [(x as number) + 0.5, -1.2]], near ? 4.8 : 4.2, 3.1), near ? C : SH)),
  ...part(smooth([[-2, -27], [-6, -21.5], [-10, -14], [-12.2, -7], [-11.5, -2], [-9, -0.3, 0], [0, -0.3, 0], [1.6, -5], [3.4, -10.6], [6.6, -14.2], [8, -18.5], [4.6, -25]]), C),
  ...part(smooth([[-12, -4.5], [-10.8, -11.5], [-5.6, -15], [-1.2, -11], [-0.8, -4], [-3.2, -0.4, 0], [-10.6, -0.4, 0]]), C),
  ...part(rrect(-3.6, -2.5, 7.4, 2.5, 1.25), C), ...part(limb([[-11.5, -2.6], [-7, -1.2], [2, -1.1], [9.5, -1.6]], 3.4, 3), C),
  ...[[7.6, false], [5.2, true]].flatMap(([x, near]) => part(ellipse((x as number) + 1.3, -1.3, 2.3, 1.3), near ? C : SH)),
];
const TAIL_TIP: Vec2[] = [[0, 0], [2.2, -1.2], [3.4, -3.6], [2.9, -6]];

// ---- a loaf: paws tucked under the chest, the tail along the side ----
const LOAF = [
  ...part(smooth([[-15, -1], [-16.2, -8], [-12.5, -15], [-3, -17.6], [6, -16.6], [11, -12.6], [12.2, -4], [10.6, -0.4, 0], [-13.5, -0.4, 0]]), C),
  ...part(smooth([[-14.5, -2], [-15, -9], [-10, -14], [-4.5, -11], [-4, -4], [-7, -1]]), C), ...part(ellipse(10.5, -1.6, 2.6, 1.4), C),
];
const TAIL_LOAF: Vec2[] = [[0, 0], [4.5, 1.9], [14.5, 2.1], [21.5, 1.8], [25, 0.4]];

// ---- asleep: curled up, the head down on the front paws, the tail round the front ----
const SLEEP = [
  ...part(smooth([[-15.5, -1], [-17, -7.5], [-12, -14], [-3, -16.5], [6, -15], [12, -10.5], [14.5, -4.5], [12.5, -0.4, 0], [-13.5, -0.4, 0]]), C),
  ...part(smooth([[-15, -2], [-15.2, -9], [-9.5, -14], [-3, -11.5], [-2, -5], [-5.5, -1]]), C), ...part(ellipse(14, -2.2, 3.4, 1.9), C),
];
const TAIL_SLEEP: Vec2[] = [[0, 0], [4.5, 2], [15.5, 2.1], [24.5, 1.7], [29.5, -0.4], [32.1, -3.6]];

/** The head's pivot for a head centred at `c` turned by `a` radians. */
const neckFor = (c: Vec2, a = 0): Vec2 => [c[0] - (HC[0] * Math.cos(a) - HC[1] * Math.sin(a)), c[1] - (HC[0] * Math.sin(a) + HC[1] * Math.cos(a))];
const SLEEP_TURN = 0.42;

/** Pisi's rig: art units are cm. Standing pivots; each posture puts the head and tail where its drawing has them. */
export const CAT_RIG: CatRig = {
  scale: 1,
  pivots: { cat: [0, 0], body: [0, -18], head: neckFor([15.6, -27]), tail: [-13, -20], legNF: [9, -19], legNB: [-9, -16], legFF: [10.5, -16], legFB: [-7.5, -16] },
  postures: {
    stand: { head: neckFor([15.6, -27]), tail: [-13, -20], legs: true, sway: 6, swayMs: 2400 },
    sit: { head: neckFor([4.2, -26.4]), tail: [9.5, -1.6], sway: 9, swayMs: 2700 },
    loaf: { head: neckFor([10.4, -19.2]), tail: [-15.5, -3], shut: true, sway: 1.5, swayMs: 4000 },
    sleep: { head: neckFor([11.5, -8.6], SLEEP_TURN), headRot: SLEEP_TURN * 57.29577951308232, tail: [-15.5, -3], shut: true },
  },
};

/** Its moods: a posture each, and the head, tail and eyes worn there. */
export const CAT_MOODS: Record<string, CatMood> = {
  idle: { posture: "sit" },
  curious: { posture: "sit", head: -14 },
  content: { posture: "loaf" },
  sleepy: { posture: "sleep" },
  alert: { posture: "stand", head: -6, tail: -8 },
  wary: { posture: "stand", head: 8, headDy: 1, tail: 14, dy: 1.5 },
};

/** The kit's 14 emotions (face.ts EMOTIONS), each worn as one of its moods. */
export const CAT_EMO: Record<string, string> = {
  neutral: "idle", proud: "idle", annoyed: "alert", surprised: "alert", happy: "content", laugh: "content", moved: "content",
  curious: "curious", confused: "curious", tired: "sleepy", sad: "wary", sorry: "wary", shy: "wary", nervous: "wary",
};

const k = (t: number, pose: Omit<GestureKey, "t"> = {}): GestureKey => ({ t, ...pose });
const TARGET = { reach: { to: "target" as const, aim: "dir" as const }, look: "target" as const };

/**
 * Its gestures, in the humanoid format played through rig/cat.ts's channel map: `head` turns the head (+ the nose down), `headDy`
 * drops it (cm), `spine` tips the body (+ the front down), `arm` lifts the near front paw, `dy` moves all of it; `shape` opens
 * the mouth (`open`), `shape2` shuts the eyes (`shut`); a `reach` to the target turns the head towards it.
 */
export const CAT_GESTURES: Record<string, GestureDef> = {
  /** It turns its head to the target and holds it (loops as a held look). */
  look: {
    dur: 1500, stroke: 300, needs: ["target"], loop: [300, 1100],
    keys: [k(0), k(300, { ease: "out", ...TARGET }), k(700, { head: -0.04, ...TARGET }), k(1100, TARGET), k(1500, { look: null })],
  },
  /** Miyav: the head lifts and the mouth opens on the stroke (pair it with the kit's `meow` sound). */
  meow: {
    dur: 1000, stroke: 380,
    keys: [k(0), k(180, { ease: "out", head: 0.05 }), k(380, { ease: "out", head: -0.3, headDy: -0.4, shape: "open" }), k(700, { head: -0.24, shape: "open" }), k(820, { head: -0.1, shape: "shut" }), k(1000)],
  },
  /** A wide yawn, eyes shut, the head up and back. */
  yawn: {
    dur: 1700, stroke: 700,
    keys: [k(0), k(300, { ease: "out", head: -0.2, shape2: "shut" }), k(700, { head: -0.45, headDy: -0.5, spine: -0.03, shape: "open", shape2: "shut" }),
      k(1200, { head: -0.42, headDy: -0.4, shape: "open", shape2: "shut" }), k(1450, { head: -0.1, shape: "shut", shape2: "shut" }), k(1700, { shape2: "open" })],
  },
  /** Eating from a bowl before its front paws: it stands, the head goes down to it, nibbling (loops). */
  eat: {
    dur: 1800, stroke: 400, loop: [400, 1200],
    keys: [k(0, { shape2: "stand" }), k(400, { ease: "out", head: 0.9, headDy: 9, spine: 0.06, shape2: "stand" }), k(800, { head: 1.0, headDy: 9.6, spine: 0.06, shape2: "stand" }),
      k(1200, { head: 0.9, headDy: 9, spine: 0.06, shape2: "stand" }), k(1650, { shape2: "stand" }), k(1800)],
  },
  /** A paw lifted and put down, as if to tap something. */
  paw: {
    dur: 900, stroke: 350,
    keys: [k(0), k(350, { ease: "out", arm: 0.9, head: 0.08 }), k(600, { arm: 0.7, head: 0.08 }), k(900, { ease: "spring" })],
  },
};

// Its pieces in drawing order: bone, art switch (`key=value`, `*` the default, `-` always), shapes in the art frame.
const ART: [string, string, Shape[]][] = [
  ["leg_fb", "legs=on*", leg(true, false)], ["leg_ff", "legs=on*", leg(false, false)],
  ["tail", "tail=stand*", part(limb(TAIL_UP, 3.8, 2.4), C)],
  ["body", "body=stand*", part(TORSO, C)], ["body", "body=sit", SIT], ["body", "body=loaf", LOAF], ["body", "body=sleep", SLEEP],
  ["leg_nb", "legs=on*", leg(true, true)], ["leg_nf", "legs=on*", leg(false, true)],
  ["head", "-", HEAD], ["head", "eyes=open*", OPEN], ["head", "eyes=shut", SHUT], ["head", "mouth=open", MOUTH],
  ["tail", "tail=sit", part(limb(TAIL_TIP, 3, 2.3), C)], ["tail", "tail=loaf", part(limb(TAIL_LOAF, 3.2, 2.4), C)], ["tail", "tail=sleep", part(limb(TAIL_SLEEP, 3.4, 2.4), C)],
];
// the art frame of each bone's pieces: a leg's, the tail's and the head's own (their pivot at 0), the body's in the standing figure's
const FRAME: Record<string, Vec2> = { body: CAT_RIG.pivots.body };

function items(): Item[] {
  return ART.map(([bone, alt, sh]) => {
    // the head's art is centred at HC from its pivot; legs and tails are drawn from their pivot already
    const shapes = bone === "head" ? put(sh, HC[0], HC[1]) : sh, at = FRAME[bone] ?? [0, 0];
    return piece(bone, at, CAT_RIG.scale, alt, shapes);
  });
}

/** Pisi as a kit puppet; `motion: "still"` holds the stride and the tail (rig/cat.ts). Its colours are its own. */
export function cat(_kit?: Kit, motion?: CatPoseOptions["motion"]): KitPuppet {
  const head = boxOf(HEAD), top = CAT_RIG.pivots.head[1] + HC[1] + head[1], H = -top, len = 40;
  // sized for framing, bubbles, targets and the shadow (a side-on cat's shoulders are its length); it has no arms or neck to measure
  const body: BodyDims = {
    build: "adult", H, headW: head[2] - head[0], headH: head[3] - head[1], neckL: 0, neckW: 7,
    torsoL: H - 16, shoulderW: len * 0.55, chestW: len * 0.55, waistW: len * 0.5, hipW: len * 0.5,
    upperArmL: 8, foreArmL: 8, handL: 2, armW: [5.4, 3, 2.6], thighL: 8, shinL: 8, footH: 1.2, footW: 3.8, legW: [5, 3, 2.6], legLen: 16,
  };
  const front = items();
  return {
    kind: "cat", body, bones: catBones(CAT_RIG), views: { front, back: front }, gestures: CAT_GESTURES,
    pose: input => catPose(input, { rig: CAT_RIG, moods: CAT_MOODS, emo: CAT_EMO, ...(motion ? { motion } : {}) }),
  };
}
