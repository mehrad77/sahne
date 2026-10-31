// The gesture vocabulary of the first kit (DESIGN.md §5.6, §7; Kumru's STORIES_STAGE.md §2).
//
// Each gesture is written once for the *acting side* and mirrored onto whichever arm the director
// picks. The sign conventions are in sahne's core/kit.ts; in short:
// - limb angles are radians added to the rest pose; positive swings a bone outwards and up on its
//   own side (a hanging arm at +π/2 points out sideways; a forearm at −1.6 on a hanging arm crosses
//   the chest; a forearm at +π/2 on a horizontal upper arm points up);
// - spine, neck and head lean their top towards the acting side when positive; `faceX` slides the
//   face towards the acting side (a head turn), `faceY` up (−) or down (+); `headDy` drops (+) or
//   lifts (−) the head along the neck (a nod, the cık); `dy` moves the whole body down (+);
// - every key is a whole pose: an angle a key leaves out is 0 there, so holds repeat their values.
//
// Shapes and `look` are repeated on every key that keeps them, so the data reads the same whether
// the rig treats them as "from this key on" or per key. Every gesture ends at rest (every channel
// 0, the hand relaxed or still holding), the looping ones after their loop; only `sit` ends seated
// and holds there (its loop), and `stand` starts from that seated pose.
//
// Assumptions for the rig (the integrator tunes these):
// - `reach2` is read from the other hand's point of view: its `off.x` grows towards that hand's own
//   side, and `eye`, `ear`, `hip` and `shoulder2` are taken from that hand, so in `shiver` both
//   hands cross to the opposite shoulder. The offsets are symmetric, so `photo` reads either way.
// - Reach keys also carry their own arm angles, a fallback pose close to the IK result. The rig's
//   IK takes the elbow further down and outwards; hands at the face are closer to the shoulder than
//   a planar arm folds with the elbow down, so for a point at the chin the elbow crosses the chest
//   (think, shush, eat, drink), and for one at the mouth or ear it goes up and out (phone). Eat and
//   drink aim the wrist under the chin for that reason, the held thing reaching the mouth. The
//   `hand` angles of reach keys were tuned for these solutions; retune them if the rig changes
//   (for instance by foreshortening the upper arm).
// - Hands that reach the face are drawn on the `hand` layer, which sits under `head` today.
// - `off` values are in cm for an adult; the hands of children and toddlers land a little wide.
// - `dy` for sit and stand is an adult's (thigh 37 cm × 0.55); a child needs about 0.55 of it.
// - face presets are not mirrored with the side (they are symmetric, except `think`'s brows).
//
// Timing is at tempo 1, a calm A1 pace. `stroke` is the moment that meets the motivating word.

import type { FacePreset, GestureDef, GestureKey } from "sahne";

// ---- Faces ---------------------------------------------------------------------------------------

const FACE: Record<string, FacePreset> = {
  // the cık: brows up, eyes half-lidded, lips together
  cik: { brows: { l: [0.85, 0.7], r: [0.85, 0.7] }, eyeOpen: [0.55, 0.55], mouth: { open: 0, smile: -0.05, wide: 0.45 } },
  // a shrug: brows up, the corners of the mouth turned down a little
  shrug: { brows: { l: [0.7, 0.35], r: [0.7, 0.35] }, mouth: { smile: -0.35, wide: 0.42, open: 0 } },
  // thinking: one brow up, mouth slightly round (the eyes go up through `look`)
  think: { brows: { l: [0.5, 0.3], r: [0.05, -0.05] }, mouth: { round: 0.4, open: 0.06, smile: 0, wide: 0.4 } },
  sleep: { eyeOpen: [0, 0], brows: { l: [-0.1, -0.15], r: [-0.1, -0.15] }, mouth: { open: 0.08, smile: 0.05, round: 0.2 } },
  // şşş: lips pushed together and forward
  shush: { brows: { l: [0.35, 0.2], r: [0.35, 0.2] }, mouth: { open: 0, round: 0.75, wide: 0.22, smile: 0 } },
  // thanks with a hand on the heart: soft eyes, a warm small smile
  heart: { eyeOpen: [0.72, 0.72], lower: [0.25, 0.25], mouth: { smile: 0.45 } },
  bow: { eyeOpen: [0.5, 0.5] },
  // a greeting brow flash
  greet: { brows: { l: [0.45, 0.4], r: [0.45, 0.4] } },
  stop: { brows: { l: [0.35, 0.5], r: [0.35, 0.5] }, mouth: { smile: 0, open: 0 } },
  shiver: { eyeOpen: [0.85, 0.85], brows: { l: [0.55, -0.1], r: [0.55, -0.1] }, mouth: { wide: 0.75, teeth: 0.7, open: 0.06, smile: -0.1 } },
  bite: { mouth: { open: 0.45, round: 0.15 } },
  chew: { mouth: { open: 0.14, round: 0.1 } },
  shut: { mouth: { open: 0, smile: 0.1 } },
  sip: { eyeOpen: [0.6, 0.6], mouth: { round: 0.4, open: 0.08 } },
  ahh: { eyeOpen: [0.8, 0.8], mouth: { smile: 0.3, open: 0.05 } },
  // squinting through a camera
  aim: { eyeOpen: [0.7, 0.7], lower: [0.45, 0.45] },
  hug: { eyeOpen: [0.35, 0.35], mouth: { smile: 0.5 } },
  // a thumbs-up: a quick pleased smile, the brows lifted a little
  thumb: { brows: { l: [0.3, 0.3], r: [0.3, 0.3] }, mouth: { smile: 0.75, open: 0.04, wide: 0.62 } },
  cheer: { brows: { l: [0.6, 0.5], r: [0.6, 0.5] }, mouth: { open: 0.5, smile: 0.9, wide: 0.7 } },
};

// ---- Gestures ------------------------------------------------------------------------------------

const k = (t: number, pose: Omit<GestureKey, "t"> = {}): GestureKey => ({ t, ...pose });

export const GESTURES: Record<string, GestureDef> = {
  // ---- deixis and attention ----

  /** şu: index out towards the target, the head and eyes lead; the addressee's gaze follows. */
  point: {
    dur: 1300, stroke: 350, needs: ["target"],
    keys: [
      k(0),
      k(150, { ease: "out", arm: 0.12, forearm: -0.6, hand: 0.15, spine: -0.02, faceX: 0.05, shape: "point", look: "target" }), // draws back
      k(350, { ease: "spring", reach: { to: "target", aim: "dir", ext: 0.95 }, arm: 1.3, forearm: 0.15, hand: 0.05, spine: 0.03, faceX: 0.07, shape: "point", look: "target" }),
      k(800, { reach: { to: "target", aim: "dir", ext: 0.93 }, arm: 1.28, forearm: 0.17, hand: 0.05, spine: 0.025, faceX: 0.07, shape: "point", look: "target" }),
      k(1050, { arm: 0.45, forearm: 0.1, hand: 0.05, spine: 0.01, faceX: 0.03, shape: "point", look: "target" }),
      k(1300, { shape: "relaxed", look: null }),
    ],
  },

  /** o: far away (out of the window, across the street): higher, the arm fully out, a lean. */
  point_far: {
    dur: 1500, stroke: 450, needs: ["target"],
    keys: [
      k(0),
      k(200, { ease: "out", arm: 0.1, forearm: -0.75, hand: 0.2, spine: -0.03, dy: 0.4, faceX: 0.04, shape: "point", look: "target" }),
      k(450, { ease: "spring", reach: { to: "target", aim: "dir", ext: 1, off: [0, -12] }, arm: 1.9, forearm: 0.05, hand: 0.1, spine: 0.05, neck: 0.02, faceX: 0.1, faceY: -0.03, shape: "point", look: "target" }),
      k(1000, { reach: { to: "target", aim: "dir", ext: 0.98, off: [0, -12] }, arm: 1.88, forearm: 0.06, hand: 0.1, spine: 0.045, neck: 0.02, faceX: 0.1, faceY: -0.03, shape: "point", look: "target" }),
      k(1250, { arm: 0.6, forearm: 0.1, hand: 0.05, spine: 0.01, faceX: 0.04, shape: "point", look: "target" }),
      k(1500, { shape: "relaxed", look: null }),
    ],
  },

  /** bu: lifts the thing in the hand to show it, beside the shoulder. */
  hold_up: {
    dur: 1500, stroke: 400, needs: ["prop"],
    keys: [
      k(0, { shape: "hold" }),
      k(150, { ease: "out", arm: -0.04, forearm: -0.15, dy: 0.5, shape: "hold" }),
      k(400, { ease: "spring", arm: 0.5, forearm: 2.3, hand: -0.25, spine: 0.02, head: 0.03, shape: "hold", look: "addressee" }),
      k(750, { arm: 0.5, forearm: 2.4, hand: -0.3, spine: 0.02, head: 0.035, shape: "hold", look: "addressee" }),
      k(1050, { arm: 0.48, forearm: 2.35, hand: -0.25, spine: 0.02, head: 0.03, shape: "hold", look: "addressee" }),
      k(1300, { arm: 0.15, forearm: 0.7, shape: "hold", look: "addressee" }),
      k(1500, { shape: "hold", look: null }),
    ],
  },

  /** bu: the index touches the thing (or a body part), with a small press. */
  touch: {
    dur: 1400, stroke: 450, needs: ["target"],
    keys: [
      k(0),
      k(200, { ease: "out", arm: 0.25, forearm: -0.5, hand: 0.1, shape: "point", look: "target" }),
      k(450, { ease: "spring", reach: { to: "target" }, arm: 0.9, forearm: 0.3, hand: 0.2, spine: 0.02, faceX: 0.04, shape: "point", look: "target" }),
      k(600, { reach: { to: "target", off: [0, 0.6] }, arm: 0.9, forearm: 0.3, hand: 0.2, spine: 0.02, faceX: 0.04, shape: "point", look: "target" }),
      k(950, { reach: { to: "target" }, arm: 0.9, forearm: 0.3, hand: 0.2, spine: 0.02, faceX: 0.04, shape: "point", look: "target" }),
      k(1200, { arm: 0.35, forearm: 0, shape: "point", look: "target" }),
      k(1400, { shape: "relaxed", look: null }),
    ],
  },

  /** Turns the head and eyes to the target; loops as a held look. */
  look: {
    dur: 1500, stroke: 250, needs: ["target"], loop: [250, 1100],
    keys: [
      k(0),
      k(250, { ease: "out", faceX: 0.1, head: 0.03, neck: 0.02, look: "target" }),
      k(700, { faceX: 0.11, head: 0.035, neck: 0.02, look: "target" }),
      k(1100, { faceX: 0.1, head: 0.03, neck: 0.02, look: "target" }),
      k(1500, { look: null }),
    ],
  },

  // ---- greetings and reactions ----

  /** Merhaba / Güle güle: the open hand up, waving from the elbow. */
  wave: {
    dur: 1500, stroke: 420, loop: [420, 1020],
    keys: [
      k(0),
      k(150, { ease: "out", arm: 0.1, forearm: -0.2 }),
      k(420, { ease: "spring", arm: 1.2, forearm: 1.8, shape: "open", look: "addressee" }),
      k(620, { arm: 1.2, forearm: 1.5, hand: -0.25, shape: "open", look: "addressee", face: FACE.greet }),
      k(820, { arm: 1.2, forearm: 2.05, hand: 0.25, shape: "open", look: "addressee", face: FACE.greet }),
      k(1020, { arm: 1.2, forearm: 1.8, shape: "open", look: "addressee" }),
      k(1300, { arm: 0.35, forearm: 0.3, shape: "relaxed", look: "addressee" }),
      k(1500, { look: null }),
    ],
  },

  /** Hoş geldiniz, buyrun: both hands open, palms up, out towards the guest, with a small dip. */
  welcome: {
    dur: 1500, stroke: 550, hands: 2,
    keys: [
      k(0),
      k(200, { ease: "out", arm: 0, forearm: -0.45, hand: 0.1, forearm2: -0.35, dy: -0.5 }), // gathers in
      k(550, { ease: "spring", arm: 0.55, forearm: 0.95, hand: 0.15, arm2: 0.35, forearm2: 0.75, hand2: 0.15, spine: 0.03, head: 0.06, headDy: 0.5, dy: 0.8, shape: "open", shape2: "open", look: "addressee", face: FACE.greet }),
      k(1000, { arm: 0.52, forearm: 0.9, hand: 0.12, arm2: 0.33, forearm2: 0.72, hand2: 0.12, spine: 0.03, head: 0.05, headDy: 0.4, dy: 0.7, shape: "open", shape2: "open", look: "addressee" }),
      k(1300, { arm: 0.2, forearm: 0.3, arm2: 0.12, forearm2: 0.2, shape: "relaxed", shape2: "relaxed", look: "addressee" }),
      k(1500, { look: null }),
    ],
  },

  /** Teşekkürler, sağ olun: the open hand flat on the chest and a small bow of the head. */
  hand_heart: {
    dur: 1700, stroke: 520,
    keys: [
      k(0),
      k(180, { ease: "out", arm: 0.05, forearm: -0.7, shape: "open" }),
      k(520, { ease: "spring", reach: { to: "chest", off: [-3, 0] }, arm: 0.1, forearm: -2.2, hand: 0.2, headDy: 0.9, faceY: 0.04, shape: "open", look: "down", face: FACE.heart }),
      k(900, { reach: { to: "chest", off: [-3, 0] }, arm: 0.1, forearm: -2.2, hand: 0.2, headDy: 0.6, faceY: 0.025, shape: "open", look: "addressee", face: FACE.heart }),
      k(1250, { reach: { to: "chest", off: [-3, 0.4] }, arm: 0.1, forearm: -2.2, hand: 0.2, headDy: 0.2, faceY: 0.01, shape: "open", look: "addressee", face: FACE.heart }),
      k(1500, { arm: 0.08, forearm: -0.6, shape: "relaxed", look: "addressee" }),
      k(1700, { look: null }),
    ],
  },

  /** Evet: up a hair, then down, and a smaller second nod. */
  nod: {
    dur: 900, stroke: 300,
    keys: [
      k(0),
      k(110, { ease: "out", headDy: -0.4, faceY: -0.015 }),
      k(300, { headDy: 1.5, faceY: 0.06 }),
      k(480, { ease: "out", headDy: -0.1 }),
      k(650, { headDy: 0.9, faceY: 0.035 }),
      k(900, { ease: "spring" }),
    ],
  },

  /** Cık, the Turkish (and Iranian) no: the head tips back, brows up, eyes half-lidded. */
  cik: {
    dur: 950, stroke: 300,
    keys: [
      k(0),
      k(100, { headDy: 0.3, faceY: 0.012 }),
      k(300, { ease: "out", headDy: -1.6, faceY: -0.08, look: "addressee", face: FACE.cik }),
      k(650, { headDy: -1.4, faceY: -0.07, look: "addressee", face: FACE.cik }),
      k(950, { look: null }),
    ],
  },

  /** A head shake. In Turkey it means "I don't understand" more than "no" (that is the cık). */
  shake_head: {
    dur: 900, stroke: 320,
    keys: [
      k(0),
      k(140, { faceX: 0.06, head: 0.02 }),
      k(320, { faceX: -0.07, head: -0.025 }),
      k(500, { faceX: 0.055, head: 0.02 }),
      k(680, { faceX: -0.035, head: -0.01 }),
      k(900),
    ],
  },

  /** Bilmiyorum / yok: shoulders up (the head sinks), forearms out, palms up, the mouth turned down. */
  shrug: {
    dur: 1400, stroke: 450, hands: 2,
    keys: [
      k(0),
      k(150, { ease: "out", dy: 0.5, arm: 0.05, forearm: -0.2, arm2: 0.05, forearm2: -0.2 }),
      k(450, { ease: "spring", arm: 0.18, forearm: 1.25, hand: 0.3, arm2: 0.18, forearm2: 1.25, hand2: 0.3, headDy: 1.4, head: 0.08, dy: -0.6, shape: "open", shape2: "open", look: "addressee", face: FACE.shrug }),
      k(850, { arm: 0.17, forearm: 1.2, hand: 0.28, arm2: 0.17, forearm2: 1.2, hand2: 0.28, headDy: 1.3, head: 0.085, dy: -0.5, shape: "open", shape2: "open", look: "addressee", face: FACE.shrug }),
      k(1150, { arm: 0.1, forearm: 0.3, arm2: 0.1, forearm2: 0.3, headDy: 0.3, shape: "relaxed", shape2: "relaxed", look: "addressee" }),
      k(1400, { look: null }),
    ],
  },

  /** A small respectful bow of the head, eyes lowered. */
  bow_head: {
    dur: 1150, stroke: 450,
    keys: [
      k(0),
      k(100, { headDy: -0.25 }),
      k(450, { headDy: 1.8, faceY: 0.085, dy: 0.6, look: "down", face: FACE.bow }),
      k(800, { headDy: 1.65, faceY: 0.08, dy: 0.55, look: "down", face: FACE.bow }),
      k(1150, { look: null }),
    ],
  },

  // ---- persons, numbers and talk ----

  /** Ben: the open hand to one's own chest, chin up a little. */
  me: {
    dur: 1250, stroke: 380,
    keys: [
      k(0),
      k(150, { ease: "out", arm: 0.08, forearm: -0.45, shape: "open" }),
      k(380, { ease: "spring", reach: { to: "chest", off: [2, 0] }, arm: 0.1, forearm: -2, hand: 0.15, headDy: -0.4, faceY: -0.015, shape: "open", look: "addressee" }),
      k(800, { reach: { to: "chest", off: [2, 0.5] }, arm: 0.1, forearm: -2, hand: 0.15, headDy: -0.3, faceY: -0.01, shape: "open", look: "addressee" }),
      k(1050, { arm: 0.08, forearm: -0.6, shape: "relaxed", look: "addressee" }),
      k(1250, { look: null }),
    ],
  },

  /** Sen / siz: an open palm, up, held out towards the person (polite, not a point). */
  you: {
    dur: 1300, stroke: 400, needs: ["target"],
    keys: [
      k(0),
      k(150, { ease: "out", arm: 0.08, forearm: -0.45, hand: 0.1, shape: "open" }),
      k(400, { ease: "spring", reach: { to: "target", aim: "dir", ext: 0.72 }, arm: 0.8, forearm: 0.55, hand: -0.3, head: 0.03, faceX: 0.03, shape: "open", look: "target" }),
      k(850, { reach: { to: "target", aim: "dir", ext: 0.7 }, arm: 0.78, forearm: 0.55, hand: -0.3, head: 0.03, faceX: 0.03, shape: "open", look: "target" }),
      k(1100, { arm: 0.25, forearm: 0.2, shape: "relaxed", look: "target" }),
      k(1300, { look: null }),
    ],
  },

  /** İki ekmek: the hand up beside the shoulder, palm out, showing the cue's `n` fingers. Holds. */
  count: {
    dur: 1850, stroke: 500,
    keys: [
      k(0),
      k(200, { ease: "out", arm: 0.05, forearm: -0.35 }),
      k(500, { ease: "spring", arm: 0.42, forearm: 2.35, hand: -0.12, shape: "count", look: "addressee" }),
      k(850, { arm: 0.44, forearm: 2.45, hand: -0.14, shape: "count", look: "addressee" }),
      k(1350, { arm: 0.42, forearm: 2.38, hand: -0.12, shape: "count", look: "addressee" }),
      k(1650, { arm: 0.15, forearm: 0.6, shape: "relaxed", look: "addressee" }),
      k(1850, { look: null }),
    ],
  },

  /** Gel: the Turkish "come here", palm DOWN, the fingers scooping down and in, repeated. */
  beckon: {
    dur: 1700, stroke: 650, loop: [450, 850],
    keys: [
      k(0),
      k(200, { ease: "out", arm: 0.1, forearm: -0.3 }),
      k(450, { ease: "out", arm: 0.85, forearm: 0.65, shape: "open", look: "addressee" }),
      k(650, { arm: 0.85, forearm: 0.5, hand: -1, shape: "hold", look: "addressee" }),
      k(850, { arm: 0.85, forearm: 0.65, shape: "open", look: "addressee" }),
      k(1050, { arm: 0.85, forearm: 0.5, hand: -1, shape: "hold", look: "addressee" }),
      k(1250, { arm: 0.85, forearm: 0.65, shape: "open", look: "addressee" }),
      k(1500, { arm: 0.3, forearm: 0.2, shape: "relaxed", look: "addressee" }),
      k(1700, { look: null }),
    ],
  },

  /** Dur / bir dakika: the open palm up and out towards the person, a lean back. */
  /** süper, harika, tamam: a thumb up to the addressee, the fist across the chest (the thumb shape's thumb stands out from the side of the fist). */
  thumb_up: {
    dur: 1300, stroke: 380,
    keys: [
      k(0),
      k(160, { ease: "out", arm: 0.15, forearm: -0.6, hand: 0.05, shape: "fist" }),
      k(380, { ease: "spring", arm: 0.75, forearm: -2.0, hand: -0.1, spine: -0.015, headDy: -0.2, shape: "thumb", look: "addressee", face: FACE.thumb }),
      k(900, { arm: 0.74, forearm: -1.97, hand: -0.1, spine: -0.015, headDy: -0.15, shape: "thumb", look: "addressee", face: FACE.thumb }),
      k(1120, { arm: 0.2, forearm: -0.5, shape: "relaxed", look: "addressee" }),
      k(1300, { look: null }),
    ],
  },
  stop: {
    dur: 1350, stroke: 350,
    keys: [
      k(0),
      k(150, { ease: "out", arm: 0.15, forearm: -0.45, hand: 0.1 }),
      k(350, { ease: "spring", arm: 1.05, forearm: 1.15, hand: 0.55, spine: -0.02, headDy: -0.3, shape: "open", look: "addressee", face: FACE.stop }),
      k(900, { arm: 1.03, forearm: 1.13, hand: 0.55, spine: -0.02, headDy: -0.25, shape: "open", look: "addressee", face: FACE.stop }),
      k(1150, { arm: 0.35, forearm: 0.3, shape: "relaxed", look: "addressee" }),
      k(1350, { look: null }),
    ],
  },

  /** Hmm: the index at the chin, the head tilted into the hand, eyes up. Loops while thinking. */
  think: {
    dur: 2100, stroke: 600, loop: [600, 1600],
    keys: [
      k(0),
      k(250, { ease: "out", arm: 0.05, forearm: -0.6 }),
      k(600, { reach: { to: "chin", off: [2, 5] }, arm: 0.15, forearm: -2.6, hand: 0.8, head: 0.06, faceY: -0.03, shape: "point", look: "up", face: FACE.think }),
      k(1100, { reach: { to: "chin", off: [2, 5.5] }, arm: 0.15, forearm: -2.6, hand: 0.8, head: 0.075, faceY: -0.035, shape: "point", look: "up", face: FACE.think }),
      k(1600, { reach: { to: "chin", off: [2, 5] }, arm: 0.15, forearm: -2.6, hand: 0.8, head: 0.06, faceY: -0.03, shape: "point", look: "up", face: FACE.think }),
      k(1900, { arm: 0.1, forearm: -0.6, shape: "relaxed" }),
      k(2100, { look: null }),
    ],
  },

  /** Talking hands: both palms up beside the body, beating with the speech. */
  explain: {
    dur: 1500, stroke: 450, hands: 2, loop: [450, 850],
    keys: [
      k(0),
      k(200, { ease: "out", arm: 0.05, forearm: -0.35, arm2: 0.05, forearm2: -0.3 }),
      k(450, { ease: "out", arm: 0.28, forearm: 1.05, hand: 0.25, arm2: 0.22, forearm2: 0.7, hand2: 0.15, head: 0.03, shape: "open", shape2: "open", look: "addressee" }),
      k(650, { arm: 0.25, forearm: 0.8, hand: 0.05, arm2: 0.2, forearm2: 0.85, hand2: 0.25, head: -0.02, shape: "open", shape2: "open", look: "addressee" }),
      k(850, { arm: 0.28, forearm: 1.05, hand: 0.25, arm2: 0.22, forearm2: 0.7, hand2: 0.15, head: 0.03, shape: "open", shape2: "open", look: "addressee" }),
      k(1050, { arm: 0.25, forearm: 0.8, hand: 0.05, arm2: 0.2, forearm2: 0.85, hand2: 0.25, head: -0.02, shape: "open", shape2: "open", look: "addressee" }),
      k(1300, { arm: 0.1, forearm: 0.3, arm2: 0.08, forearm2: 0.2, shape: "relaxed", shape2: "relaxed", look: "addressee" }),
      k(1500, { look: null }),
    ],
  },

  // ---- things changing hands ----

  /** Buyrun: the held thing travels on an arc to the receiver's hand (the target), then the hand opens. */
  give: {
    dur: 1500, stroke: 650, needs: ["target"], hold: "give",
    keys: [
      k(0, { shape: "hold" }),
      k(220, { ease: "out", arm: 0.12, forearm: -0.65, hand: 0.1, shape: "hold", look: "target" }),
      k(650, { reach: { to: "target" }, arm: 0.95, forearm: 0.45, hand: 0.3, spine: 0.04, head: 0.03, faceX: 0.05, shape: "hold", look: "target" }),
      k(800, { ease: "spring", reach: { to: "target", off: [0, 0.8] }, arm: 0.95, forearm: 0.45, hand: 0.3, spine: 0.04, head: 0.03, faceX: 0.05, shape: "hold", look: "target" }),
      k(950, { reach: { to: "target", off: [-1.5, 0] }, arm: 0.9, forearm: 0.4, hand: 0.3, spine: 0.03, head: 0.03, faceX: 0.04, shape: "open", look: "addressee" }),
      k(1250, { arm: 0.4, forearm: 0.1, hand: 0.1, spine: 0.01, shape: "open", look: "addressee" }),
      k(1500, { shape: "relaxed", look: null }),
    ],
  },

  /** The open hand goes to the thing (the target), closes on it at the stroke, and brings it in. */
  take: {
    dur: 1300, stroke: 650, needs: ["target"], hold: "take",
    keys: [
      k(0),
      k(200, { ease: "out", arm: 0.2, forearm: -0.4, shape: "open", look: "target" }),
      k(550, { reach: { to: "target", off: [0, 0.5] }, arm: 0.9, forearm: 0.45, hand: 0.3, spine: 0.03, faceX: 0.04, shape: "open", look: "target" }),
      k(650, { reach: { to: "target" }, arm: 0.9, forearm: 0.45, hand: 0.3, spine: 0.03, faceX: 0.04, shape: "hold", look: "target" }),
      k(1000, { arm: 0.3, forearm: -0.9, hand: 0.1, shape: "hold", look: "addressee" }),
      k(1300, { shape: "hold", look: null }),
    ],
  },

  // ---- everyday actions ----

  /** A bite of the held food, then chewing (loops). The wrist goes under the chin so the food in the hand meets the mouth. */
  eat: {
    dur: 2150, stroke: 600, needs: ["prop"], loop: [600, 1600],
    keys: [
      k(0, { shape: "hold" }),
      k(200, { ease: "out", arm: 0.05, forearm: -0.4, shape: "hold" }),
      k(600, { reach: { to: "chin", off: [1, 0] }, arm: 0.1, forearm: -2.5, hand: 0.7, headDy: 0.3, shape: "hold", face: FACE.bite }),
      k(750, { reach: { to: "chin", off: [1.5, 1] }, arm: 0.1, forearm: -2.5, hand: 0.7, headDy: 0.3, shape: "hold", face: FACE.shut }),
      k(1000, { reach: { to: "chin", off: [2.5, 5] }, arm: 0.1, forearm: -2.3, hand: 0.7, shape: "hold", face: FACE.chew }),
      k(1200, { reach: { to: "chin", off: [2.5, 5] }, arm: 0.1, forearm: -2.3, hand: 0.7, shape: "hold", face: FACE.shut }),
      k(1400, { reach: { to: "chin", off: [2.5, 5] }, arm: 0.1, forearm: -2.3, hand: 0.7, shape: "hold", face: FACE.chew }),
      k(1600, { reach: { to: "chin", off: [1, 0] }, arm: 0.1, forearm: -2.5, hand: 0.7, headDy: 0.3, shape: "hold", face: FACE.bite }),
      k(1900, { arm: 0.1, forearm: -1, shape: "hold", face: FACE.chew }),
      k(2150, { shape: "hold" }),
    ],
  },

  /** A sip from the held glass: the glass at the mouth (the wrist under the chin), the head tips back. Loops while sipping. */
  drink: {
    dur: 2200, stroke: 900, needs: ["prop"], loop: [900, 1400],
    keys: [
      k(0, { shape: "hold" }),
      k(250, { ease: "out", arm: 0.05, forearm: -0.45, shape: "hold" }),
      k(650, { reach: { to: "chin", off: [1, 2] }, arm: 0.1, forearm: -2.5, hand: 0.7, shape: "hold", look: "down" }),
      k(900, { reach: { to: "chin", off: [1, 3] }, arm: 0.1, forearm: -2.5, hand: 0.45, headDy: -0.4, faceY: -0.025, shape: "hold", look: "down", face: FACE.sip }),
      k(1150, { reach: { to: "chin", off: [1, 3] }, arm: 0.1, forearm: -2.5, hand: 0.4, headDy: -0.5, faceY: -0.03, shape: "hold", look: "down", face: FACE.sip }),
      k(1400, { reach: { to: "chin", off: [1, 3] }, arm: 0.1, forearm: -2.5, hand: 0.45, headDy: -0.4, faceY: -0.025, shape: "hold", look: "down", face: FACE.sip }),
      k(1650, { reach: { to: "chin", off: [1.5, 1] }, arm: 0.1, forearm: -2.5, hand: 0.7, shape: "hold", look: "addressee", face: FACE.ahh }),
      k(1950, { arm: 0.1, forearm: -1, shape: "hold", look: "addressee" }),
      k(2200, { shape: "hold", look: null }),
    ],
  },

  /** Writing in a notebook held in the other hand: small strokes across the page (loops). */
  write: {
    dur: 1850, stroke: 550, needs: ["prop"], hands: 2, loop: [550, 1350],
    keys: [
      k(0),
      k(250, { ease: "out", arm: 0.1, forearm: -0.6, arm2: 0.05, forearm2: -0.8, headDy: 0.4, faceY: 0.04, shape: "pinch", shape2: "open", look: "down" }),
      k(550, { reach: { to: "front", off: [-4, 2] }, arm: 0.2, forearm: -1.7, hand: -0.3, arm2: 0.05, forearm2: -1.3, hand2: -0.1, headDy: 0.6, faceY: 0.05, shape: "pinch", shape2: "open", look: "down" }),
      k(750, { reach: { to: "front", off: [-2, 1] }, arm: 0.2, forearm: -1.7, hand: -0.25, arm2: 0.05, forearm2: -1.3, hand2: -0.1, headDy: 0.6, faceY: 0.05, shape: "pinch", shape2: "open", look: "down" }),
      k(950, { reach: { to: "front", off: [0, 2] }, arm: 0.2, forearm: -1.7, hand: -0.3, arm2: 0.05, forearm2: -1.3, hand2: -0.1, headDy: 0.6, faceY: 0.05, shape: "pinch", shape2: "open", look: "down" }),
      k(1150, { reach: { to: "front", off: [-2, 2.6] }, arm: 0.2, forearm: -1.7, hand: -0.35, arm2: 0.05, forearm2: -1.3, hand2: -0.1, headDy: 0.65, faceY: 0.05, shape: "pinch", shape2: "open", look: "down" }),
      k(1350, { reach: { to: "front", off: [-4, 2] }, arm: 0.2, forearm: -1.7, hand: -0.3, arm2: 0.05, forearm2: -1.3, hand2: -0.1, headDy: 0.6, faceY: 0.05, shape: "pinch", shape2: "open", look: "down" }),
      k(1650, { arm: 0.1, forearm: -0.5, arm2: 0.05, forearm2: -0.6, shape: "pinch", shape2: "open", look: "down" }),
      k(1850, { shape: "relaxed", shape2: "relaxed", look: null }),
    ],
  },

  /** Reading a book held in both hands at the chest, the head down (loops as a slow drift). */
  read: {
    dur: 2600, stroke: 300, needs: ["prop"], hands: 2, loop: [300, 2100],
    keys: [
      k(0),
      k(300, { arm: 0.6, forearm: -2.3, hand: -0.6, arm2: 0.6, forearm2: -2.3, hand2: -0.6, headDy: 0.6, faceY: 0.06, shape: "hold", shape2: "hold", look: "down" }),
      k(1200, { arm: 0.6, forearm: -2.35, hand: -0.62, arm2: 0.6, forearm2: -2.35, hand2: -0.62, headDy: 0.75, faceY: 0.065, shape: "hold", shape2: "hold", look: "down" }),
      k(2100, { arm: 0.6, forearm: -2.3, hand: -0.6, arm2: 0.6, forearm2: -2.3, hand2: -0.6, headDy: 0.6, faceY: 0.06, shape: "hold", shape2: "hold", look: "down" }),
      k(2400, { arm: 0.15, forearm: -0.8, arm2: 0.15, forearm2: -0.8, shape: "hold", shape2: "hold", look: "addressee" }),
      k(2600, { shape: "hold", shape2: "relaxed", look: null }),
    ],
  },

  /** Alo: the held phone at the ear, the head leaning into it, the eyes away (loops). */
  phone: {
    dur: 2450, stroke: 650, needs: ["prop"], loop: [650, 1950],
    keys: [
      k(0, { shape: "hold" }),
      k(250, { ease: "out", arm: 0.05, forearm: -0.5, shape: "hold" }),
      k(650, { reach: { to: "ear", off: [1, 7] }, arm: 0.35, forearm: -2.9, hand: 0.1, head: 0.07, shape: "hold", look: "away" }),
      k(1300, { reach: { to: "ear", off: [1, 7.5] }, arm: 0.35, forearm: -2.9, hand: 0.1, head: 0.08, faceX: -0.02, shape: "hold", look: "away" }),
      k(1950, { reach: { to: "ear", off: [1, 7] }, arm: 0.35, forearm: -2.9, hand: 0.1, head: 0.07, shape: "hold", look: "away" }),
      k(2250, { arm: 0.1, forearm: -0.8, shape: "hold", look: "addressee" }),
      k(2450, { shape: "hold", look: null }),
    ],
  },

  /** Typing on a phone held in both hands, the thumbs tapping (loops). */
  type: {
    dur: 1250, stroke: 300, hands: 2, loop: [300, 750],
    keys: [
      k(0),
      k(300, { arm: 0.45, forearm: -2.15, hand: -0.4, arm2: 0.45, forearm2: -2.15, hand2: -0.4, headDy: 0.7, faceY: 0.06, shape: "hold", shape2: "hold", look: "down" }),
      k(450, { arm: 0.45, forearm: -2.15, hand: -0.25, arm2: 0.45, forearm2: -2.15, hand2: -0.45, headDy: 0.7, faceY: 0.06, shape: "hold", shape2: "hold", look: "down" }),
      k(600, { arm: 0.45, forearm: -2.15, hand: -0.45, arm2: 0.45, forearm2: -2.15, hand2: -0.25, headDy: 0.7, faceY: 0.06, shape: "hold", shape2: "hold", look: "down" }),
      k(750, { arm: 0.45, forearm: -2.15, hand: -0.4, arm2: 0.45, forearm2: -2.15, hand2: -0.4, headDy: 0.7, faceY: 0.06, shape: "hold", shape2: "hold", look: "down" }),
      k(1050, { arm: 0.1, forearm: -0.5, arm2: 0.1, forearm2: -0.5, shape: "relaxed", shape2: "relaxed", look: "addressee" }),
      k(1250, { look: null }),
    ],
  },

  /** Knitting: both hands at the chest holding needles, working in small alternating loops. */
  knit: {
    dur: 1400, stroke: 300, hands: 2, loop: [300, 900],
    keys: [
      k(0),
      k(300, { arm: 0.45, forearm: -2.1, hand: -0.5, arm2: 0.45, forearm2: -2.1, hand2: -0.5, headDy: 0.5, faceY: 0.05, shape: "pinch", shape2: "pinch", look: "down" }),
      k(500, { arm: 0.5, forearm: -2.25, hand: -0.3, arm2: 0.42, forearm2: -2, hand2: -0.6, headDy: 0.5, faceY: 0.05, shape: "pinch", shape2: "pinch", look: "down" }),
      k(700, { arm: 0.42, forearm: -2, hand: -0.6, arm2: 0.5, forearm2: -2.25, hand2: -0.3, headDy: 0.5, faceY: 0.05, shape: "pinch", shape2: "pinch", look: "down" }),
      k(900, { arm: 0.45, forearm: -2.1, hand: -0.5, arm2: 0.45, forearm2: -2.1, hand2: -0.5, headDy: 0.5, faceY: 0.05, shape: "pinch", shape2: "pinch", look: "down" }),
      k(1200, { arm: 0.1, forearm: -0.6, arm2: 0.1, forearm2: -0.6, shape: "relaxed", shape2: "relaxed", look: "addressee" }),
      k(1400, { look: null }),
    ],
  },

  /**
   * Sitting down, seen from the front: the thighs come towards the viewer (foreshortened to 0.45),
   * the shins hang, the body drops by the shortening, the hands rest on the knees. Ends seated and
   * loops there (the director keeps the seated pose until `stand`).
   */
  sit: {
    dur: 1950, stroke: 750, hands: 2, loop: [750, 1950],
    keys: [
      k(0, { thighLen: 1, thighLen2: 1 }),
      k(200, { ease: "out", dy: -0.6, arm: 0.05, arm2: 0.05, thighLen: 1, thighLen2: 1 }),
      k(750, { ease: "spring", dy: 20, thighLen: 0.45, thighLen2: 0.45, arm: -0.06, forearm: -0.22, hand: 0.05, arm2: -0.06, forearm2: -0.22, hand2: 0.05, headDy: 0.2 }),
      k(1350, { dy: 20.2, thighLen: 0.45, thighLen2: 0.45, arm: -0.06, forearm: -0.24, hand: 0.05, arm2: -0.06, forearm2: -0.24, hand2: 0.05, headDy: 0.3, spine: 0.01 }),
      k(1950, { dy: 20, thighLen: 0.45, thighLen2: 0.45, arm: -0.06, forearm: -0.22, hand: 0.05, arm2: -0.06, forearm2: -0.22, hand2: 0.05, headDy: 0.2 }),
    ],
  },

  /** Standing up from `sit`'s seated pose: a press down on the knees, then up with a small overshoot. */
  stand: {
    dur: 1000, stroke: 750, hands: 2,
    keys: [
      k(0, { dy: 20, thighLen: 0.45, thighLen2: 0.45, arm: -0.06, forearm: -0.22, hand: 0.05, arm2: -0.06, forearm2: -0.22, hand2: 0.05, headDy: 0.2 }),
      k(250, { ease: "out", dy: 21, thighLen: 0.43, thighLen2: 0.43, arm: -0.1, forearm: -0.32, hand: 0.05, arm2: -0.1, forearm2: -0.32, hand2: 0.05, headDy: 0.6, faceY: 0.02 }),
      k(750, { ease: "out", dy: -0.8, thighLen: 1, thighLen2: 1, arm: 0.05, arm2: 0.05, headDy: -0.2 }),
      k(1000, { ease: "spring", thighLen: 1, thighLen2: 1 }),
    ],
  },

  // ---- more (2026-10-09 additions) ----

  /** Alkış: the open hands meet in front of the chest (loops). */
  clap: {
    dur: 1050, stroke: 400, hands: 2, loop: [250, 550],
    keys: [
      k(0),
      k(250, { ease: "out", arm: 0.5, forearm: -2.73, hand: -0.7, arm2: 0.5, forearm2: -2.73, hand2: -0.7, shape: "open", shape2: "open", look: "addressee" }),
      k(400, { ease: "in", arm: 0.15, forearm: -2.25, hand: -0.8, arm2: 0.15, forearm2: -2.25, hand2: -0.8, shape: "open", shape2: "open", look: "addressee" }),
      k(550, { ease: "out", arm: 0.5, forearm: -2.73, hand: -0.7, arm2: 0.5, forearm2: -2.73, hand2: -0.7, shape: "open", shape2: "open", look: "addressee" }),
      k(850, { arm: 0.1, forearm: -0.6, arm2: 0.1, forearm2: -0.6, shape: "relaxed", shape2: "relaxed", look: "addressee" }),
      k(1050, { look: null }),
    ],
  },

  /** Sarılmak: arms open wide, then wrap round the partner, a lean in, eyes closing. */
  hug: {
    dur: 2200, stroke: 800, needs: ["partner"], hands: 2,
    keys: [
      k(0),
      k(300, { ease: "out", arm: 1.2, forearm: 0.45, hand: 0.1, arm2: 1.2, forearm2: 0.45, hand2: 0.1, spine: 0.02, shape: "open", shape2: "open", look: "addressee" }),
      k(800, { arm: 0.7, forearm: -2.2, hand: -0.2, arm2: 0.7, forearm2: -2.2, hand2: -0.2, spine: 0.03, head: 0.06, dy: 0.6, shape: "open", shape2: "open", face: FACE.hug }),
      k(1500, { arm: 0.68, forearm: -2.25, hand: -0.2, arm2: 0.68, forearm2: -2.25, hand2: -0.2, spine: 0.03, head: 0.07, dy: 0.7, shape: "open", shape2: "open", face: FACE.hug }),
      k(1900, { arm: 0.6, forearm: 0.1, arm2: 0.6, forearm2: 0.1, shape: "open", shape2: "open", look: "addressee" }),
      k(2200, { shape: "relaxed", shape2: "relaxed", look: null }),
    ],
  },

  /** Taking a photo: the held phone or camera at the eyes in both hands, a squint, the click at the stroke. */
  photo: {
    dur: 1950, stroke: 1150, needs: ["prop"], hands: 2,
    keys: [
      k(0, { shape: "hold" }),
      k(300, { ease: "out", arm: 0.1, forearm: -0.6, arm2: 0.1, forearm2: -0.6, shape: "hold", shape2: "hold" }),
      k(700, { reach: { to: "eye", off: [4, 3] }, reach2: { to: "eye", off: [4, 3] }, arm: 0.6, forearm: -2.8, hand: 0.4, arm2: 0.6, forearm2: -2.8, hand2: 0.4, shape: "hold", shape2: "hold", face: FACE.aim }),
      k(1050, { reach: { to: "eye", off: [4, 3] }, reach2: { to: "eye", off: [4, 3] }, arm: 0.6, forearm: -2.8, hand: 0.4, arm2: 0.6, forearm2: -2.8, hand2: 0.4, shape: "hold", shape2: "hold", face: FACE.aim }),
      k(1150, { ease: "in", reach: { to: "eye", off: [4, 3.8] }, reach2: { to: "eye", off: [4, 3.8] }, arm: 0.6, forearm: -2.8, hand: 0.4, arm2: 0.6, forearm2: -2.8, hand2: 0.4, shape: "hold", shape2: "hold", face: FACE.aim }),
      k(1300, { ease: "out", reach: { to: "eye", off: [4, 3] }, reach2: { to: "eye", off: [4, 3] }, arm: 0.6, forearm: -2.8, hand: 0.4, arm2: 0.6, forearm2: -2.8, hand2: 0.4, shape: "hold", shape2: "hold", face: FACE.aim }),
      k(1700, { arm: 0.15, forearm: -1, arm2: 0.15, forearm2: -1, shape: "hold", shape2: "hold", look: "addressee" }),
      k(1950, { shape: "hold", shape2: "relaxed", look: null }),
    ],
  },

  /** Şşş: the index finger up at the lips, the lips pushed together. */
  shush: {
    dur: 1600, stroke: 500,
    keys: [
      k(0),
      k(200, { ease: "out", arm: 0.05, forearm: -0.55, shape: "point" }),
      k(500, { ease: "spring", reach: { to: "chin", off: [0, 2] }, arm: 0.2, forearm: -2.6, hand: 0.6, shape: "point", look: "addressee", face: FACE.shush }),
      k(1100, { reach: { to: "chin", off: [0, 2] }, arm: 0.2, forearm: -2.6, hand: 0.6, headDy: 0.2, shape: "point", look: "addressee", face: FACE.shush }),
      k(1400, { arm: 0.1, forearm: -0.8, shape: "relaxed", look: "addressee" }),
      k(1600, { look: null }),
    ],
  },

  /** Üşüdüm: arms crossed, the hands on the other shoulders, hunched, trembling (loops). */
  shiver: {
    dur: 1000, stroke: 250, hands: 2, loop: [250, 430],
    keys: [
      k(0),
      k(250, { reach: { to: "shoulder2", off: [3, 3] }, reach2: { to: "shoulder2", off: [3, 3] }, arm: 0.2, forearm: -2.6, hand: -0.4, arm2: 0.2, forearm2: -2.6, hand2: -0.4, headDy: 1.3, dy: 0.5, shape: "open", shape2: "open", face: FACE.shiver }),
      k(310, { reach: { to: "shoulder2", off: [3, 3] }, reach2: { to: "shoulder2", off: [3, 3] }, arm: 0.2, forearm: -2.6, hand: -0.4, arm2: 0.2, forearm2: -2.6, hand2: -0.4, headDy: 1.3, dy: 0.5, spine: 0.012, head: -0.02, faceX: 0.008, shape: "open", shape2: "open", face: FACE.shiver }),
      k(370, { reach: { to: "shoulder2", off: [3, 3] }, reach2: { to: "shoulder2", off: [3, 3] }, arm: 0.2, forearm: -2.6, hand: -0.4, arm2: 0.2, forearm2: -2.6, hand2: -0.4, headDy: 1.3, dy: 0.5, spine: -0.012, head: 0.02, faceX: -0.008, shape: "open", shape2: "open", face: FACE.shiver }),
      k(430, { reach: { to: "shoulder2", off: [3, 3] }, reach2: { to: "shoulder2", off: [3, 3] }, arm: 0.2, forearm: -2.6, hand: -0.4, arm2: 0.2, forearm2: -2.6, hand2: -0.4, headDy: 1.3, dy: 0.5, shape: "open", shape2: "open", face: FACE.shiver }),
      k(800, { arm: 0.1, forearm: -0.8, arm2: 0.1, forearm2: -0.8, shape: "relaxed", shape2: "relaxed" }),
      k(1000),
    ],
  },

  /** Yaşasın: both fists up in a V, a little hop (loops as pumps). Not for feedback: no celebration inside a story. */
  cheer: {
    dur: 1400, stroke: 450, hands: 2, loop: [450, 850],
    keys: [
      k(0),
      k(200, { ease: "out", dy: 1.5, arm: -0.05, forearm: -0.6, arm2: -0.05, forearm2: -0.6, headDy: 0.4, shape: "fist", shape2: "fist" }),
      k(450, { ease: "spring", arm: 2.55, forearm: 0.25, arm2: 2.55, forearm2: 0.25, dy: -2.5, headDy: -0.5, faceY: -0.03, shape: "fist", shape2: "fist", face: FACE.cheer }),
      k(650, { arm: 2.3, forearm: 0.6, arm2: 2.3, forearm2: 0.6, dy: -1, headDy: -0.3, faceY: -0.02, shape: "fist", shape2: "fist", face: FACE.cheer }),
      k(850, { arm: 2.55, forearm: 0.25, arm2: 2.55, forearm2: 0.25, dy: -2.5, headDy: -0.5, faceY: -0.03, shape: "fist", shape2: "fist", face: FACE.cheer }),
      k(1200, { arm: 0.4, forearm: 0.3, arm2: 0.4, forearm2: 0.3, shape: "relaxed", shape2: "relaxed" }),
      k(1400),
    ],
  },

  /** Tık tık: the fist knocks on the target (a door) twice; loops for more knocks. */
  knock: {
    dur: 1300, stroke: 400, needs: ["target"], loop: [400, 640],
    keys: [
      k(0),
      k(250, { ease: "out", reach: { to: "target", off: [-5, -2] }, arm: 0.9, forearm: 0.9, hand: 0.2, shape: "fist", look: "target" }),
      k(400, { ease: "in", reach: { to: "target" }, arm: 0.9, forearm: 0.9, hand: 0.2, shape: "fist", look: "target" }),
      k(520, { ease: "out", reach: { to: "target", off: [-3.5, -0.5] }, arm: 0.9, forearm: 0.9, hand: 0.2, shape: "fist", look: "target" }),
      k(640, { ease: "in", reach: { to: "target" }, arm: 0.9, forearm: 0.9, hand: 0.2, shape: "fist", look: "target" }),
      k(780, { ease: "out", reach: { to: "target", off: [-4, -1] }, arm: 0.9, forearm: 0.9, hand: 0.2, shape: "fist", look: "target" }),
      k(1100, { arm: 0.4, forearm: 0.2, shape: "fist", look: "target" }),
      k(1300, { shape: "relaxed", look: null }),
    ],
  },

  /** Asleep: eyes closed, the head lolls and drops, slow breathing (loops); the last key wakes. */
  sleep: {
    dur: 3000, stroke: 500, loop: [500, 2700],
    keys: [
      k(0),
      k(500, { headDy: 1.6, head: 0.14, faceY: 0.06, dy: 0.5, spine: 0.02, face: FACE.sleep }),
      k(1600, { headDy: 1.9, head: 0.16, faceY: 0.065, dy: 0.8, spine: 0.025, face: FACE.sleep }),
      k(2700, { headDy: 1.6, head: 0.14, faceY: 0.06, dy: 0.5, spine: 0.02, face: FACE.sleep }),
      k(3000, { ease: "spring" }),
    ],
  },
};
