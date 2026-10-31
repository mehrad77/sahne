// Hand shapes (DESIGN.md §6.3). Each shape is one paper piece; the base part gives every shape as
// an alternative item (Item.alt, keys `hand_l` and `hand_r`) and the rig picks one per frame.
//
// Drawn in the hand bone's frame: the wrist pivot at (0, 0), the fingers along +y (down, when the
// arm hangs), length `body.handL`, width about `armW[2] · 1.12`. Side 1 is the character's left
// hand (screen right in the front view) with the thumb on −x, towards the body, as in the relaxed
// hand; side −1 is the mirror image. The back view uses the same silhouettes (the back of the hand).
//
// Points are written as fractions of the hand, [u, v]: u across (of the width), v along (of the
// length), so one table serves adults (13 cm hands), children (8) and toddlers (6.5).
//
// Counting starts with the index finger, as in Turkey and Iran: count1 is the index, count2 index
// and middle (a V), count3 adds the ring finger, count4 is four fingers with the thumb folded over
// the palm, count5 the open hand with the fingers spread. Folded fingers lie on the palm under the
// thumb, so a raised counting hand shows its palm.

import { smooth, rrect, band, tone, Path, type BodyDims, type Group, type Shape, type Vec2 } from "sahne";

export const HAND_SHAPES: string[] = [
  "relaxed", "open", "point", "fist", "hold", "pinch", "thumb",
  "count1", "count2", "count3", "count4", "count5",
];

type UV = [number, number];

/** A capsule (a finger, a thumb) from a to b, radius r, in centimetres. */
function capsule(a: Vec2, b: Vec2, r: number): Path {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1e-6, c = dx / l, s = dy / l;
  return rrect(-r, -r, l + 2 * r, 2 * r, r).transform([c, s, -s, c, a[0], a[1]]);
}

// The four fingers, index first (next to the thumb): where each leaves the palm, and its length
// from there to the centre of the tip (fractions of the hand's length).
const FINGERS: { u: number; len: number }[] = [
  { u: -0.33, len: 0.46 }, // index
  { u: -0.11, len: 0.52 }, // middle
  { u: 0.11, len: 0.48 },  // ring
  { u: 0.33, len: 0.38 },  // pinky
];
const ROOT_V = 0.44;  // the knuckle line
const R_FINGER = 0.118, R_STUB = 0.13, R_THUMB = 0.15; // radii, fractions of the width

/** Per shape: which fingers are out (their spread angle, + towards the pinky side) and where the thumb goes. */
interface Spec {
  /** Spread angles of the extended fingers (index, middle, ring, pinky); null = folded. */
  out: (number | null)[];
  /** How the folded fingers sit: on the palm (a raised counting hand) or curled under it (a fist). */
  folded: "palm" | "fist";
  /** The thumb: a polyline [u, v] from its root. */
  thumb: UV[];
  /** The thumb lies across the front of the hand (true) or comes out from behind its side. */
  over?: boolean;
  /** The index bends to meet the thumb (pinch). */
  pinch?: boolean;
  /** A crease on the palm (front view only). */
  crease?: boolean;
}

const SPECS: Record<string, Spec> = {
  open: { out: [-0.07, -0.02, 0.03, 0.09], folded: "palm", thumb: [[-0.36, 0.12], [-0.8, 0.44]], crease: true },
  point: { out: [-0.04, null, null, null], folded: "fist", thumb: [[-0.56, 0.14], [-0.26, 0.46]], over: true },
  fist: { out: [null, null, null, null], folded: "fist", thumb: [[-0.56, 0.2], [-0.04, 0.46]], over: true },
  hold: { out: [null, null, null, null], folded: "fist", thumb: [[-0.38, 0.1], [-0.62, 0.36], [-0.54, 0.64]] },
  pinch: { out: [0, null, null, null], folded: "fist", pinch: true, thumb: [[-0.4, 0.14], [-0.74, 0.46], [-0.66, 0.8]] },
  thumb: { out: [null, null, null, null], folded: "fist", thumb: [[-0.3, 0.24], [-0.98, 0.14]] },
  count1: { out: [-0.04, null, null, null], folded: "palm", thumb: [[-0.56, 0.22], [0.24, 0.5]], over: true },
  count2: { out: [-0.2, 0.1, null, null], folded: "palm", thumb: [[-0.56, 0.22], [0.34, 0.5]], over: true },
  count3: { out: [-0.17, 0, 0.15, null], folded: "palm", thumb: [[-0.56, 0.22], [0.36, 0.48]], over: true },
  count4: { out: [-0.17, -0.06, 0.06, 0.19], folded: "palm", thumb: [[-0.54, 0.16], [0.14, 0.34]], over: true },
  count5: { out: [-0.3, -0.1, 0.1, 0.3], folded: "palm", thumb: [[-0.36, 0.12], [-0.9, 0.3]], crease: true },
};

/** The relaxed hand, as B1 drew it: hanging from the wrist, palm towards the body, fingers together. */
function relaxed(b: BodyDims, skin: string, side: 1 | -1): Group {
  const L = b.handL, w = b.armW[2] * 1.12;
  const palm = smooth([[-w * 0.5, -1], [w * 0.5, -1], [w * 0.58, L * 0.42], [w * 0.46, L * 0.86], [w * 0.1, L], [-w * 0.3, L * 0.9], [-w * 0.52, L * 0.5]], true, 1);
  const thumb = smooth([[-w * 0.45, L * 0.12], [-w * 0.95, L * 0.4], [-w * 0.86, L * 0.62], [-w * 0.42, L * 0.5]], true, 1);
  const flip = (p: Path) => side === 1 ? p : p.mirrorX();
  return {
    shapes: [
      { path: flip(thumb), fill: skin },
      { path: flip(palm), fill: skin },
      { path: flip(smooth([[w * 0.06, L * 0.56], [w * 0.1, L * 0.86]], false)), stroke: { color: tone(skin, "deep"), width: 0.5 }, flat: true, opacity: 0.55 },
      { path: flip(smooth([[w * 0.3, L * 0.5], [w * 0.32, L * 0.78]], false)), stroke: { color: tone(skin, "deep"), width: 0.5 }, flat: true, opacity: 0.55 },
    ],
  };
}

/** One hand shape as a paper piece in the hand bone's frame. `back` draws the back of the hand. */
export function handShape(b: BodyDims, skin: string, side: 1 | -1, shape: string, back = false): Group {
  const spec = SPECS[shape];
  if (!spec) return relaxed(b, skin, side);
  const L = b.handL, w = b.armW[2] * 1.12;
  const P = ([u, v]: UV): Vec2 => [u * w, v * L];
  const flip = (p: Path) => side === 1 ? p : p.mirrorX();
  const shade = tone(skin, "shade"), deep = tone(skin, "deep");
  const shapes: Shape[] = [];
  const piece = (p: Path) => { shapes.push({ path: flip(p), fill: skin }); };
  const tint = (p: Path, opacity = 0.45) => { shapes.push({ path: flip(p), fill: shade, flat: true, opacity }); };
  const line = (pts: UV[], opacity = 0.5) => {
    shapes.push({ path: flip(smooth(pts.map(P), false)), stroke: { color: deep, width: 0.45 }, flat: true, opacity });
  };
  /** A digit along a polyline of [u, v] points, as one piece. */
  const digit = (pts: Vec2[], r: number): Path => {
    const p = capsule(pts[0], pts[1], r);
    for (let i = 2; i < pts.length; i++) p.add(capsule(pts[i - 1], pts[i], r));
    return p;
  };
  const tipOf = (i: number, ang: number, k = 1): Vec2 => {
    const f = FINGERS[i], [x, y] = P([f.u, ROOT_V]), l = f.len * L * k;
    return [x + Math.sin(ang) * l, y + Math.cos(ang) * l];
  };

  const th = spec.thumb.map(P);
  // a thumb over the hand is a tapered piece, broad where it leaves the palm, so it reads as a
  // thumb and not as a stick laid across; a thumb from behind is a plain capsule (its root is hidden)
  const thumbPath = (pts: Vec2[]): Path => {
    if (!spec.over) return digit(pts, R_THUMB * w);
    const a = pts[pts.length - 2], z = pts[pts.length - 1], d = Math.hypot(z[0] - a[0], z[1] - a[1]) || 1;
    const tip: Vec2 = [z[0] + (z[0] - a[0]) / d * R_THUMB * w * 0.9, z[1] + (z[1] - a[1]) / d * R_THUMB * w * 0.9];
    const widths = pts.map((_, i) => w * (0.44 - 0.16 * i / (pts.length - 1)));
    return band([...pts, tip], [...widths, w * 0.12]);
  };
  const thumb = () => piece(thumbPath(th));

  // 1. a thumb that comes out from the side lies behind the hand, its root hidden
  if (!spec.over) thumb();

  // 2. extended fingers, pinky at the back, index in front (nearest the thumb)
  for (let i = 3; i >= 0; i--) {
    const ang = spec.out[i];
    if (ang == null) continue;
    const root = P([FINGERS[i].u, ROOT_V]);
    if (spec.pinch && i === 0) piece(digit([root, P([-0.46, 0.7]), P([-0.62, 0.84])], R_FINGER * w));
    else if (i === 0 && spec.out.filter(a => a != null).length === 1) piece(capsule(root, tipOf(i, ang, 1.15), R_FINGER * w * 1.15)); // a lone index reads better a little bigger
    else piece(capsule(root, tipOf(i, ang), R_FINGER * w));
  }

  // 3. the palm, or the fist block with the folded fingers curled under it (their knuckles show)
  const folded = FINGERS.map((f, i) => ({ f, i })).filter(({ i }) => spec.out[i] == null);
  if (spec.folded === "fist") {
    const block = smooth([P([-0.44, -0.08]), P([0.44, -0.08]), P([0.54, 0.2]), P([0.53, 0.5]), P([0.38, 0.6]), P([-0.38, 0.6]), P([-0.52, 0.5]), P([-0.53, 0.2])], true, 1);
    for (const { f } of folded) block.add(capsule(P([f.u, 0.44]), P([f.u * 0.96, 0.62]), R_STUB * w));
    piece(block);
    // creases between neighbouring folded fingers
    for (let i = 0; i < 3; i++) if (spec.out[i] == null && spec.out[i + 1] == null) {
      const u = (FINGERS[i].u + FINGERS[i + 1].u) / 2;
      line([[u, 0.5], [u, 0.66]], 0.45);
    }
  } else {
    piece(smooth([P([-0.42, -0.08]), P([0.42, -0.08]), P([0.52, 0.22]), P([0.49, 0.48]), P([0.24, 0.56]), P([-0.22, 0.56]), P([-0.5, 0.48]), P([-0.53, 0.2])], true, 1));
    if (spec.crease && !back) line([[-0.04, 0.47], [-0.18, 0.3], [-0.24, 0.1]], 0.4);
    // folded fingers lie on the palm, tips towards the wrist, with a shade where they fold
    if (folded.length) {
      tint(capsule(P([folded[0].f.u, 0.34]), P([folded[folded.length - 1].f.u, 0.34]), R_STUB * w * 0.9));
      const fold = capsule(P([folded[0].f.u, 0.56]), P([folded[0].f.u * 0.95, 0.38]), R_STUB * w);
      for (const { f } of folded.slice(1)) fold.add(capsule(P([f.u, 0.56]), P([f.u * 0.95, 0.38]), R_STUB * w));
      piece(fold);
    }
  }

  // 4. a thumb across the front, with its shade on the hand
  if (spec.over) {
    tint(thumbPath(th.map(([x, y]) => [x + 0.04 * w, y + 0.06 * L] as Vec2)), 0.5);
    thumb();
  }

  return { shapes };
}

/** Every hand shape for one side, keyed by name (the relaxed one included). */
export function handShapes(b: BodyDims, skin: string, side: 1 | -1, back = false): Record<string, Group> {
  const out: Record<string, Group> = {};
  for (const s of HAND_SHAPES) out[s] = s === "relaxed" ? relaxed(b, skin, side) : handShape(b, skin, side, s, back);
  return out;
}

// ---- for things worn on the hand (wear.hands: a ring, henna) --------------------------------------------

/**
 * Where a ring sits on the ring finger in one hand shape, in the hand bone's frame: its centre, the
 * finger's direction (radians, 0 = +x, y down) and the finger's radius; null where the finger is
 * hidden (folded into a fist). A ring part draws one item per hand shape (`Item.alt`), so it
 * follows the hand.
 */
export function ringAt(b: BodyDims, side: 1 | -1, shape: string): { c: Vec2; dir: number; r: number } | null {
  const L = b.handL, w = b.armW[2] * 1.12, f = FINGERS[2];
  const mirror = (p: Vec2): Vec2 => [side * p[0], p[1]], dir = (a: number) => (side === 1 ? a : Math.PI - a);
  const spec = SPECS[shape];
  if (!spec) return { c: mirror([w * 0.2, L * 0.6]), dir: dir(Math.PI / 2), r: R_FINGER * w };
  const ang = spec.out[2];
  if (ang == null) return null;
  const root: Vec2 = [f.u * w, ROOT_V * L], l = f.len * L * 0.3;
  return { c: mirror([root[0] + Math.sin(ang) * l, root[1] + Math.cos(ang) * l]), dir: dir(Math.PI / 2 - ang), r: R_FINGER * w };
}

/** The silhouette of one hand shape (its cut pieces, not its printed lines), for drawing inside it (henna). */
export function handOutline(b: BodyDims, side: 1 | -1, shape: string, back = false): Path {
  const g = handShape(b, "#000000", side, shape, back), p = new Path();
  for (const s of g.shapes) if (!s.flat) p.add(s.path);
  return p;
}
