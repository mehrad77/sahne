// Kerim's gestures (DESIGN.md §7), in the humanoid format and played through rig/bird.ts's channel map:
// - `arm` turns the near wing, `arm2` the far one, radians, + raises either; `shape: "spread"` opens both wings,
//   and a `reach` to the target aims the spread wing's tip at it;
// - `head` turns the head (+ beak down), `headDy` drops it (+, cm), `spine` leans her trunk (+ forward),
//   `dy` moves all of her (− up, cm: a hop);
// - a `loop` range plays `n` times when the cue counts (`count`, `flap`), else once.
// Lengths are her own centimetres (she is 45 cm). Every key is a whole pose; each gesture ends at rest, and the wings go back to the mood's or the flight's.
// The wave's angles are the app's k-wave (kerim.css :53): 16°, 30°, 6°.

import type { GestureDef, GestureKey } from "sahne";

const k = (t: number, pose: Omit<GestureKey, "t"> = {}): GestureKey => ({ t, ...pose });
const D = Math.PI / 180;
const UP = 16 * D, HIGH = 30 * D, LOW = 6 * D;

export const BIRD_GESTURES: Record<string, GestureDef> = {
  /** şu: the spread wing swings out and its tip points at the target; the head lifts towards it. */
  point: {
    dur: 1300, stroke: 350, needs: ["target"],
    keys: [
      k(0),
      k(150, { ease: "out", arm: -0.15, head: -0.04, shape: "spread", look: "target" }), // draws back
      k(350, { ease: "spring", reach: { to: "target", aim: "dir" }, arm: 2.4, spine: 0.03, head: -0.06, shape: "spread", look: "target" }),
      k(800, { reach: { to: "target", aim: "dir" }, arm: 2.4, spine: 0.03, head: -0.06, shape: "spread", look: "target" }),
      k(1050, { arm: 0.8, head: -0.02, shape: "spread", look: "target" }),
      k(1300, { look: null }),
    ],
  },

  /** o: far away: she rises a little and leans back, the wing aimed higher. */
  point_far: {
    dur: 1500, stroke: 450, needs: ["target"],
    keys: [
      k(0),
      k(200, { ease: "out", arm: -0.2, dy: 0.5, shape: "spread", look: "target" }),
      k(450, { ease: "spring", reach: { to: "target", aim: "dir" }, arm: 2.2, spine: -0.06, head: -0.14, dy: -0.8, shape: "spread", look: "target" }),
      k(1000, { reach: { to: "target", aim: "dir" }, arm: 2.2, spine: -0.055, head: -0.13, dy: -0.8, shape: "spread", look: "target" }),
      k(1250, { arm: 0.6, head: -0.04, shape: "spread", look: "target" }),
      k(1500, { look: null }),
    ],
  },

  /** n wingbeats, one per number: the spread wing up, then down on the count. */
  count: {
    dur: 1250, stroke: 550, loop: [300, 800],
    keys: [
      k(0),
      k(150, { ease: "out", arm: -0.1, shape: "spread", look: "addressee" }),
      k(300, { arm: 0.5, shape: "spread", look: "addressee" }),
      k(550, { ease: "out", arm: -0.2, head: 0.08, shape: "spread", look: "addressee" }),
      k(800, { arm: 0.5, shape: "spread", look: "addressee" }),
      k(1050, { arm: 0.1, shape: "spread", look: "addressee" }),
      k(1250, { look: null }),
    ],
  },

  /** Evet: the head dips twice, beak down. */
  nod: {
    dur: 900, stroke: 300,
    keys: [
      k(0),
      k(110, { ease: "out", head: -0.06, headDy: -0.2 }),
      k(300, { head: 0.28, headDy: 0.6 }),
      k(480, { ease: "out", head: 0.02 }),
      k(650, { head: 0.18, headDy: 0.4 }),
      k(900, { ease: "spring" }),
    ],
  },

  /** A dove's hop on the spot (the app's k-hop: up 10 units): crouch, up with the wings a little out, land soft. */
  hop: {
    dur: 650, stroke: 300,
    keys: [
      k(0),
      k(120, { ease: "out", dy: 0.8, head: 0.06 }),
      k(300, { dy: -5.8, arm: 0.25, arm2: 0.2, head: -0.04 }),
      k(480, { ease: "in", dy: 0.6, head: 0.04 }),
      k(650, { ease: "spring" }),
    ],
  },

  /** Wings out and a flutter (the app's k-flutter: 8° up, 18° down); `n` adds beats. */
  flap: {
    dur: 800, stroke: 240, loop: [100, 380],
    keys: [
      k(0),
      k(100, { ease: "out", arm: 8 * D, arm2: 8 * D, dy: -0.5, shape: "spread" }),
      k(240, { arm: -18 * D, arm2: -18 * D, dy: -1.2, shape: "spread" }),
      k(380, { arm: 8 * D, arm2: 8 * D, dy: -0.5, shape: "spread" }),
      k(520, { arm: -18 * D, arm2: -18 * D, dy: -1.2, shape: "spread" }),
      k(660, { arm: 8 * D, arm2: 8 * D, dy: -0.5, shape: "spread" }),
      k(800),
    ],
  },

  /** Merhaba / Güle güle: the app's greeting wave, the spread wing rocking 16° → 30° → 6° → 30° → 16°; loops while held. */
  wave: {
    dur: 1450, stroke: 450, loop: [250, 1050],
    keys: [
      k(0),
      k(250, { ease: "spring", arm: UP, head: -5 * D, shape: "spread", look: "addressee" }),
      k(450, { arm: HIGH, head: -5 * D, shape: "spread", look: "addressee" }),
      k(650, { arm: LOW, head: -5 * D, shape: "spread", look: "addressee" }),
      k(850, { arm: HIGH, head: -5 * D, shape: "spread", look: "addressee" }),
      k(1050, { arm: UP, head: -5 * D, shape: "spread", look: "addressee" }),
      k(1300, { arm: 0.1, shape: "spread", look: "addressee" }),
      k(1450, { look: null }),
    ],
  },

  /** Hoş geldin: both wings open at the wave's top (30°), settling through 16° and 6°, with a small bow. */
  welcome: {
    dur: 1500, stroke: 550, hands: 2,
    keys: [
      k(0),
      k(200, { ease: "out", dy: 0.5, head: -0.05 }), // gathers in
      k(550, { ease: "spring", arm: HIGH, arm2: HIGH, head: 0.12, headDy: 0.4, dy: 0.4, shape: "spread", look: "addressee" }),
      k(1000, { arm: UP, arm2: UP, head: 0.08, headDy: 0.3, dy: 0.3, shape: "spread", look: "addressee" }),
      k(1300, { arm: LOW, arm2: LOW, shape: "spread", look: "addressee" }),
      k(1500, { look: null }),
    ],
  },

  /** She cocks her head up towards the target; loops as a held look. */
  look: {
    dur: 1500, stroke: 250, needs: ["target"], loop: [250, 1100],
    keys: [
      k(0),
      k(250, { ease: "out", head: -0.14, spine: -0.02, look: "target" }),
      k(700, { head: -0.17, spine: -0.02, look: "target" }),
      k(1100, { head: -0.14, spine: -0.02, look: "target" }),
      k(1500, { look: null }),
    ],
  },
};
