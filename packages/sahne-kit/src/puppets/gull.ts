// A gull's puppet (DESIGN.md §5.4): Istanbul's yellow-legged gull on sahne's bird rig (rig/bird.ts), side on, standing on
// a rail or a quay, flying and hovering as Kerim does. Drawn after the gulls of set/outdoor.ts (gull()): a white head and
// body, a grey mantle that is the folded wing, black wingtips with a white mirror, a yellow beak with its red spot, and
// yellow legs. About 40 cm to the crown standing.

import { ellipse, birdBones, birdPose, tone, type BirdFlight, type BirdMood, type BirdPoseOptions, type BirdRig, type BodyDims, type GestureDef, type GestureKey, type Item, type Kit, type KitPuppet, type Shape } from "sahne";
import { S, P, L, piece, boxOf } from "./draw.ts";

const WHITE = "#F4F3EF", GREY = "#B4BCC4", INK = "#2B2F33", BEAK = "#E7B53A", SPOT = "#D2462F", LEGS = "#D9B23A", EYE = "#E8D27A";

// ---- the art, in cm before scaling (y down, the feet at the origin, facing right) ----
const LEG = [
  L([[3.4, -12], [3.6, -6], [3.4, -0.7]], tone(LEGS, "shade"), 1.3, 1), L([[-1.2, -12], [-1.5, -6], [-1.9, -0.7]], LEGS, 1.4, 1),
  P([[0.6, 0, 0], [3.4, -1.3, 0], [6.4, 0, 0]], tone(LEGS, "shade"), { flat: true }), P([[-4.8, 0, 0], [-1.9, -1.4, 0], [1.2, 0, 0]], LEGS, { flat: true }),
];
const TAIL = P([[-13, -21, 0], [-27, -19.6], [-27.6, -16.6, 0], [-13, -16, 0]], WHITE);
const TAIL_FAN = P([[-13, -21, 0], [-23, -22.6], [-26.6, -19.8], [-26.6, -16.2], [-23, -14.4], [-13, -16, 0]], WHITE);
const BODY = P([[-16, -17], [-8, -23.5], [2, -27], [9, -27.5], [13.5, -23.5], [12.5, -16], [6, -12], [-4, -11.4], [-12, -13.6]], WHITE);
const BELLY = S(ellipse(0, -12.6, 11, 2.4), tone(WHITE, "shade"), { flat: true, opacity: 0.5, clip: BODY.path });
/** The folded wing: the grey mantle along the back, the black primaries past the tail with a white mirror, a white trailing edge. */
const FOLD = (() => {
  const m = P([[9, -25], [2, -27.6, 0], [-10, -25.6], [-22, -21.6], [-33, -18.6, 0], [-22, -16.2], [-8, -15.8], [3, -18], [8.5, -21]], GREY);
  return [m, P([[-19, -21.2], [-33, -18.6, 0], [-19, -16.4]], INK, { flat: true, clip: m.path }), S(ellipse(-28.6, -18.6, 0.9, 0.55), WHITE, { flat: true }),
    L([[-3, -16.3], [-16, -17]], WHITE, 0.7, 0.9)];
})();
/** The wing raised: from the shoulder up to the wrist and back to the black tip, its white mirror, the trailing edge white. */
const spread = (c: string): Shape[] => {
  const w = P([[7, -25, 0], [6.5, -34], [3.5, -42], [0.5, -47, 0], [-14, -61, 0], [-12, -53.5], [-8.5, -46], [-6, -38], [-4, -30], [-3, -24, 0]], c);
  return [w, P([[-4.6, -50.5], [-14, -61, 0], [-10.6, -48.5]], INK, { flat: true, clip: w.path }), S(ellipse(-11.2, -55.4, 0.9, 0.6), WHITE, { flat: true }),
    L([[-5.5, -30], [-8, -45]], WHITE, 0.6, 0.6)];
};
/** The head: a round white head on a short neck, the beak's upper half (the lower is its own bone). */
const HEAD = [
  P([[7, -23.5], [8.6, -30.5], [11.8, -35.4], [15.8, -35.8], [18.8, -33.2], [19.6, -30], [17.4, -27.2], [13.4, -25.2], [10.6, -22]], WHITE),
  P([[18.6, -32.2, 0], [25.5, -31.3], [26.4, -30.1, 0], [24.8, -30.4], [18.8, -30.2, 0]], BEAK, { flat: true }),
];
const BEAK_LO = [P([[19, -30.3, 0], [25, -30.2], [25.6, -29.3, 0], [24, -28.8], [19.2, -29.5, 0]], BEAK, { flat: true }), S(ellipse(24.2, -29.6, 0.6), SPOT, { flat: true })];
const eye = (r: number) => [S(ellipse(15.9, -32.4, r), EYE, { flat: true }), S(ellipse(16.1, -32.4, r * 0.5), INK, { flat: true }), S(ellipse(15.7, -32.8, r * 0.18), WHITE, { flat: true })];
const SHUT = [L([[14.8, -32.6], [16, -31.9], [17.2, -32.5]], INK, 0.4, 0.9)];

/** Its height, toes to crown, cm. */
const H = 40;
const SC = H / -boxOf(HEAD)[1];

/** Its rig: the pivots in art units (cm before `scale`), the spread wings' tips for aiming, and a gull's slower, longer beat. */
export const GULL_RIG: BirdRig = {
  pivots: { bird: [0, 0], legs: [1, -12], body: [0, -12], tail: [-13, -18.5], wing: [5, -24], wingFar: [8, -25], head: [10, -26], "beak-lo": [19.2, -30.2], wingTip: [-14, -61], wingFarTip: [-11, -62] },
  scale: SC,
  flight: { flap: [18, -84], flapFar: [14, -80], flapMs: 380, glide: { dy: [-10, -5], rot: [2, 6], ms: 2600 }, lift: { dy: -8, rot: 4 }, head: -3 } satisfies BirdFlight,
};

/** Its moods (degrees, art units + down) and the kit's emotions worn as them. */
export const GULL_MOODS: Record<string, BirdMood> = {
  idle: {},
  happy: { head: -5, alt: { eyes: "big" } },
  alarm: { head: -4, wing: 6, alt: { eyes: "big" } },
  sad: { head: 12, headDy: 1, tail: -5, wing: -3 },
  think: { head: -10 },
  sleepy: { head: 8, headDy: 1, alt: { eyes: "shut" } },
};
export const GULL_EMO: Record<string, string> = {
  neutral: "idle", annoyed: "idle", happy: "happy", proud: "happy", laugh: "happy", surprised: "alarm", nervous: "alarm",
  sad: "sad", sorry: "sad", moved: "sad", curious: "think", confused: "think", shy: "think", tired: "sleepy",
};

const k = (t: number, pose: Omit<GestureKey, "t"> = {}): GestureKey => ({ t, ...pose });
const D = Math.PI / 180;
/** Its gestures, as Kerim's (rig/bird.ts's channel map): a look to the target, and wings out with a few beats (`n` adds beats). */
export const GULL_GESTURES: Record<string, GestureDef> = {
  look: {
    dur: 1500, stroke: 250, needs: ["target"], loop: [250, 1100],
    keys: [k(0), k(250, { ease: "out", head: -0.14, spine: -0.02, look: "target" }), k(700, { head: -0.17, spine: -0.02, look: "target" }), k(1100, { head: -0.14, spine: -0.02, look: "target" }), k(1500, { look: null })],
  },
  flap: {
    dur: 900, stroke: 260, loop: [120, 440],
    keys: [k(0), k(120, { ease: "out", arm: 10 * D, arm2: 10 * D, dy: -0.6, shape: "spread" }), k(280, { arm: -40 * D, arm2: -40 * D, dy: -1.6, shape: "spread" }),
      k(440, { arm: 10 * D, arm2: 10 * D, dy: -0.6, shape: "spread" }), k(600, { arm: -40 * D, arm2: -40 * D, dy: -1.6, shape: "spread" }), k(760, { arm: 6 * D, arm2: 6 * D, shape: "spread" }), k(900)],
  },
};

const PV = GULL_RIG.pivots;
// its pieces in drawing order: bone, art switch, shapes (the far wing and the tail behind the body, the wing over it, the head on top)
const ART: [string, string, Shape[]][] = [
  ["wing_far", "wing_far=on", spread(tone(GREY, "shade"))],
  ["tail", "tail=rest*", [TAIL]], ["tail", "tail=fan", [TAIL_FAN]],
  ["legs", "legs=down*", LEG],
  ["body", "-", [BODY, BELLY]],
  ["wing", "wing=fold*", FOLD], ["wing", "wing=spread", spread(GREY)],
  ["beak", "-", BEAK_LO],
  ["head", "-", HEAD], ["head", "eyes=calm*", eye(0.95)], ["head", "eyes=big", eye(1.3)], ["head", "eyes=shut", SHUT],
];
const PIVOT: Record<string, string> = { root: "bird", legs: "legs", body: "body", tail: "tail", wing_far: "wingFar", wing: "wing", head: "head", beak: "beak-lo" };

function items(): Item[] {
  return ART.map(([bone, alt, sh]) => piece(bone, PV[PIVOT[bone]], SC, alt, sh));
}

/** A gull as a kit puppet; `motion: "still"` holds a flight's pose without wingbeats (rig/bird.ts). */
export function gull(_kit?: Kit, motion?: BirdPoseOptions["motion"]): KitPuppet {
  const head = boxOf(HEAD), trunk = boxOf([BODY]), cm = (u: number) => u * SC, sh = cm(trunk[2] - trunk[0]) * 0.6;
  const arm = cm(PV.wing[1] - PV.wingTip[1]) - sh / 2, leg = cm(-PV.legs[1]);
  const body: BodyDims = {
    build: "adult", H, headW: cm(9.5), headH: cm(head[3] - head[1]) * 0.75, neckL: 0, neckW: cm(6),
    torsoL: cm(-PV.head[1]), shoulderW: sh, chestW: sh, waistW: sh, hipW: sh * 0.9,
    upperArmL: arm * 0.45, foreArmL: arm * 0.45, handL: arm * 0.1, armW: [cm(8), cm(6), cm(3)],
    thighL: leg / 2, shinL: leg / 2, footH: cm(1.4), footW: cm(6), legW: [cm(1.4), cm(1.4), cm(1.4)], legLen: leg,
  };
  const front = items();
  return {
    kind: "bird", body, bones: birdBones(GULL_RIG), views: { front, back: front }, gestures: GULL_GESTURES,
    pose: input => birdPose(input, { rig: GULL_RIG, moods: GULL_MOODS, emo: GULL_EMO, ...(motion ? { motion } : {}) }),
  };
}
