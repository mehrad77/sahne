// Things worn on the face and ears, in three slots: `eyes` glasses and sunglasses (`wear.eyes`),
// `ears` earrings and earbuds (`wear.ears`), `aid` hearing devices (`wear.aid`: never hidden by a
// covering and drawn over it, so an aid goes with earrings and a headscarf).
//
// THE FACE-ACCESSORIES ARTIST'S FILE: add parts to `EYEWEAR` (ids: eyes `glasses_ sunglasses_`,
// ears and aid `ear_`, permanent). Place everything from the head's anchors in draw/head.ts:
// `headOf(ctx).eye(side)` for lenses, `.ear(side)` (its `lobe`, `top`, `back`) for earrings and
// devices, so they follow the ear's size and the head's shape. Glasses go on layer `glasses` (front)
// and their temples on `headwear` (back); earrings on `ear_wear` (so hair over the ear covers
// them); devices on `headwear`. A frame's colour is `fabmetal`, a lens `lens` (drawn at
// `lensAlpha(ctx.colors[i])`: parts get hex, a cast member's own hex too), a device shell `skinfab`. One-sided parts say `sides` and draw `sidesOf(ctx.side)`.
//
// How they are built here:
// - A lens is sized from the eye the face draws (`eyeSize`), so the frame never crosses an eye on
//   any build; a frame is a cut-paper ring (the lens's outline grown by the frame's width), with a
//   narrow rim (`GLASS_EDGE`) so a thin frame is not swallowed by it, and a soft shadow on the face.
// - Temples end at the head's own outline (`headHalfWidth`), so they fit every face shape. Behind,
//   they show over the hair, except under a covering that hides the hair (its cloth runs over them).
// - Earrings and earbuds hang from the ear's anchors; seen from behind they sit a little further
//   out, on the rim of the ear that shows past the hair.
// - Hearing devices follow the ear's rim (`rim`), are never smaller than 70% of an adult's (so a
//   toddler's still reads), and a cochlear coil in front shows only where it passes the outline of
//   the hair or covering (`beyond`).

import { ellipse, smooth, band, poly, tone, mix, Path, type BodyDims, type Group, type Item, type PartCtx, type PartDef, type Shape, type Vec2 } from "sahne";
import { named, sidesOf, line, headOf, headHalfWidth, hairBulk, HAIR_BULK, lensAlpha, type Head, type Ear } from "./draw/index.ts";

// ---- shared measures and shapes -----------------------------------------------------------------------

const kidOf = (b: BodyDims) => b.build === "child" || b.build === "toddler";

/** The eye as the face draws it at rest (face.ts `drawEye`): half width and half height, cm. A lens holds it with room to spare. */
const eyeSize = (b: BodyDims): Vec2 => { const k = kidOf(b) ? 1.12 : 1; return [b.headW * 0.083 * k, b.headH * 0.088 * k]; };

/** A frame's width (cm): thinner on children's heads, so it does not swallow their big eyes. */
const frameW = (b: BodyDims, w = 0.85) => w * (kidOf(b) ? 0.8 : 1);

/** The paper rim of glasses and jewellery (cm): narrower than the kit's 0.45, so a thin frame keeps its colour. */
const GLASS_EDGE = 0.22;

const K = 0.5523;

/** A closed outline through corners (clockwise on screen), each corner rounded by its radius. */
function rounded(cs: Vec2[], r: number[]): Path {
  const n = cs.length, p = new Path();
  const ends = cs.map((c, i) => {
    const a = cs[(i + n - 1) % n], b = cs[(i + 1) % n], la = Math.hypot(a[0] - c[0], a[1] - c[1]) || 1, lb = Math.hypot(b[0] - c[0], b[1] - c[1]) || 1;
    const ra = Math.min(r[i], la / 2), rb = Math.min(r[i], lb / 2);
    return { c, A: [c[0] + (a[0] - c[0]) / la * ra, c[1] + (a[1] - c[1]) / la * ra] as Vec2, B: [c[0] + (b[0] - c[0]) / lb * rb, c[1] + (b[1] - c[1]) / lb * rb] as Vec2 };
  });
  p.moveTo(ends[0].B[0], ends[0].B[1]);
  for (let i = 1; i <= n; i++) {
    const { c, A, B } = ends[i % n];
    p.lineTo(A[0], A[1]).cubicTo(A[0] + (c[0] - A[0]) * K, A[1] + (c[1] - A[1]) * K, B[0] + (c[0] - B[0]) * K, B[1] + (c[1] - B[1]) * K, B[0], B[1]);
  }
  return p.close();
}

/**
 * A ring: an outline and a hole traced the other way round, so the hole is cut by the default
 * (nonzero) fill rule. Not `evenodd`: the still backend's paper shadow ignores the fill rule and
 * would fill the hole (a frame's lens) with shadow.
 */
const ring = (outer: Path, hole: Path) => new Path().add(outer).add(hole);

/** Corners grown outwards (clockwise on screen): edge i (corner i to i + 1) moves out by d[i]. A frame's outer edge. */
function grow(cs: Vec2[], d: number[]): Vec2[] {
  const n = cs.length;
  const edge = (i: number) => {
    const a = cs[i], b = cs[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (b[1] - a[1]) / l, ny = -(b[0] - a[0]) / l, di = d[i % d.length];
    return { p: [a[0] + nx * di, a[1] + ny * di] as Vec2, v: [(b[0] - a[0]) / l, (b[1] - a[1]) / l] as Vec2 };
  };
  return cs.map((_, i) => {
    const e0 = edge((i + n - 1) % n), e1 = edge(i), den = e0.v[0] * e1.v[1] - e0.v[1] * e1.v[0];
    if (Math.abs(den) < 1e-6) return e1.p;
    const t = ((e1.p[0] - e0.p[0]) * e1.v[1] - (e1.p[1] - e0.p[1]) * e1.v[0]) / den;
    return [e0.p[0] + e0.v[0] * t, e0.p[1] + e0.v[1] * t];
  });
}

/** A lens drawn for the wearer's left (+x, `u` outwards from the nose) placed on a side: mirrored for the right, keeping the corners clockwise. */
const place = (cs: Vec2[], cx: number, cy: number, side: 1 | -1): Vec2[] => {
  const p = cs.map(([u, y]): Vec2 => [cx + side * u, cy + y]);
  return side === 1 ? p : p.reverse();
};

/** How far right of the centre the hair (bulk `v`, cm) reaches at height y: its crown ellipse, or the head's outline where that shows past it (as `Head.crown`). */
function hairEdge(h: Head, v: number, y: number): number {
  const t = (y + h.H * 0.6) / (h.H * 0.42 + v), e = t <= -1 ? 0 : (h.W / 2 + v) * Math.sqrt(Math.max(0, 1 - Math.min(1, t * t)));
  return Math.max(t > 0 ? h.W / 2 + v : e, headHalfWidth(h.shape, h.W, h.H, y) + Math.min(0.3, v));
}

/** The top of the hair (bulk `v`) at x: its crown ellipse there. */
const hairTop = (h: Head, v: number, x: number) => -h.H * 0.6 - (h.H * 0.42 + v) * Math.sqrt(Math.max(0, 1 - (x / (h.W / 2 + v)) ** 2));

/** A covering that hides the hair is worn (its cloth runs over the sides of the head, the temples and the ears). */
const covered = (ctx: PartCtx) => {
  const id = ctx.avatar.wear?.head?.id;
  return typeof id === "string" && Object.hasOwn(ctx.kit.parts, id) && !!ctx.kit.parts[id].hides?.includes("hair");
};

/** A covering or a hat is worn (a part the kit knows in `wear.head` or `wear.hat`): it covers anything resting on the top of the head. */
const topCovered = (ctx: PartCtx) => [ctx.avatar.wear?.head?.id, ctx.avatar.wear?.hat?.id].some(id => typeof id === "string" && Object.hasOwn(ctx.kit.parts, id));

/**
 * How far the hair stands off the scalp on the top of the head, between whatever it is gathered into
 * (cm): a style's `bulk` is its fullest point, which for puffs, buns, knots and pigtails is beside or
 * behind the crown, while the hair over the crown lies close; there, no more than `HAIR_BULK.low`.
 */
function crownBulk(ctx: PartCtx): number {
  const id = ctx.avatar.hair?.style, p = typeof id === "string" && Object.hasOwn(ctx.kit.parts, id) ? ctx.kit.parts[id] : undefined, v = hairBulk(ctx);
  const gathered = !!p && (p.tags?.some(t => t === "updo" || t === "tied" || t === "bun") || /puffs|knots|pigtails/.test(String(id)));
  return gathered ? Math.min(v, HAIR_BULK.low * ctx.body.headH / 50) : v;
}

// ---- glasses ------------------------------------------------------------------------------------------

interface Lens {
  /** The lens's own outline (the glass), and the same traced the other way round: the frame's hole. */
  inner: Path;
  hole: Path;
  /** The frame's outer edge, or null for a half rim. */
  outer: Path | null;
  /** A half rim's line (over the top and down the sides), drawn as a band instead of a ring. */
  rim?: Vec2[];
  /** Where the bridge meets the lens (nose side) and the temple (the hinge, outer side). */
  nose: Vec2;
  hinge: Vec2;
  /** A light line along the frame's top edge, upper left. */
  top: Vec2[];
  /** The glint: a short line inside the upper left of the glass, and its width. */
  glint: Vec2[]; g: number;
}

/** The pieces of one lens: the glass at its tint, the frame ring with its rim and shadow, the light on the frame, the glint. */
function lensShapes(l: Lens, frame: string, glass: string, fw: number): Shape[] {
  const a = lensAlpha(glass), dark = a > 0.5, [x0, y0, x1, y1] = l.inner.bounds();
  return [
    { path: l.inner, fill: glass, opacity: a, flat: true },
    // a dark lens is lighter at the top, as glass catches the sky
    ...(dark ? [{ path: ellipse((x0 + x1) / 2 - (x1 - x0) * 0.15, y0, (x1 - x0) * 0.62, (y1 - y0) * 0.42), fill: tone(glass, "light"), opacity: 0.32, flat: true, clip: l.inner } as Shape] : []),
    ...(l.outer ? [{ path: ring(l.outer, l.hole), fill: frame } as Shape] : []),
    // a half rim: the frame over the top and down the sides; below, only a faint line where the glass ends
    // (its deep-toned shadow just under it, so a gold rim on warm skin still reads at a phone's size)
    ...(l.rim ? [
      { path: l.inner, stroke: { color: tone(glass, "deep"), width: fw * 0.3 }, flat: true, opacity: 0.5 } as Shape,
      { path: band(l.rim.map(([x, y]): Vec2 => [x + fw * 0.12, y + fw * 0.4]), l.rim.map((_, i) => (i === 0 || i === l.rim!.length - 1 ? fw * 0.4 : fw))), fill: tone(frame, "deep"), flat: true, opacity: 0.55 } as Shape,
      { path: band(l.rim, l.rim.map((_, i) => (i === 0 || i === l.rim!.length - 1 ? fw * 0.4 : fw))), fill: frame } as Shape,
    ] : []),
    line(l.top, tone(frame, "light"), fw * 0.32, 0.55),
    // the glint: a short arc inside the upper left of the glass, clear of the eye (a dark lens gets a second, smaller one)
    line(l.glint, "#FFFFFF", l.g, dark ? 0.75 : 0.65),
    ...(dark ? [line(l.glint.map(([x, y]): Vec2 => [x + l.g * 2.2, y + l.g * 2.2]).slice(0, 2), "#FFFFFF", l.g * 0.7, 0.45)] : []),
  ];
}

/** A temple seen from the front: from the hinge to the head's outline at that height, and a little onto the ear. */
function temple(h: Head, hinge: Vec2, side: 1 | -1, c: string, w: number, rise = 0.5): Shape {
  const y = hinge[1] - rise, x = side * (headHalfWidth(h.shape, h.W, h.H, y) + 0.5);
  return { path: band([hinge, [(hinge[0] + x) / 2, (hinge[1] + y) / 2 - 0.1], [x, y]], [w, w * 0.9, w * 0.75]), fill: c };
}

/** The temples from behind: over the ear and down behind it, on top of the hair; none under a covering that hides the hair. */
function backTemples(ctx: PartCtx, h: Head, y: number, c: string, w: number, hingeDot = false): Item[] {
  if (covered(ctx)) return [];
  const shapes: Shape[] = [];
  for (const s of [1, -1] as const) {
    const x = s * headHalfWidth(h.shape, h.W, h.H, y);
    shapes.push({ path: band([[x + s * 0.4, y - 0.4], [x - s * 0.4, y + 0.6], [x - s * 1.3, y + 2.6 * h.k], [x - s * 1.6, y + 4 * h.k]], [w, w, w * 0.95, w * 1.15]), fill: c });
    shapes.push(line([[x + s * 0.3, y - 0.5], [x - s * 0.5, y + 0.4]], tone(c, "light"), w * 0.3, 0.5));
    if (hingeDot) shapes.push({ path: ellipse(x + s * 0.2, y - 0.2, w * 0.55), fill: tone(c, "light"), flat: true, opacity: 0.8 });
  }
  return [{ layer: "headwear", bone: "head", group: { shapes, edge: GLASS_EDGE } }];
}

/** Glasses worn on the eyes: the two lenses of a style, a bridge, temples to the head's edge; the temples from behind. */
function worn(ctx: PartCtx, lensOf: (side: 1 | -1, cx: number, cy: number) => Lens, o: { bridge: (r: Lens, l: Lens) => Vec2[]; fw: number; bw?: number; tw?: number; rise?: number; hingeDot?: boolean }) {
  const h = headOf(ctx), frame = ctx.colors[0] ?? "#26272C", glass = ctx.colors[1] ?? "#DCEFF5";
  const lenses = ([1, -1] as const).map(s => { const [cx, cy] = h.eye(s); return lensOf(s, cx, cy); });
  const tw = o.tw ?? o.fw * 0.9;
  const shapes: Shape[] = [
    temple(h, lenses[0].hinge, 1, tone(frame, "shade"), tw, o.rise), temple(h, lenses[1].hinge, -1, tone(frame, "shade"), tw, o.rise),
    { path: band(o.bridge(lenses[1], lenses[0]), [o.bw ?? o.fw]), fill: frame },
    ...lenses.flatMap(l => lensShapes(l, frame, glass, o.fw)),
  ];
  return {
    front: [{ layer: "glasses", bone: "head", group: { shapes, edge: GLASS_EDGE } }],
    back: backTemples(ctx, h, lenses[0].hinge[1] - (o.rise ?? 0.5), frame, tw, o.hingeDot),
  };
}

/** A round lens of radius r round (cx, cy). */
function roundLens(cx: number, cy: number, side: 1 | -1, r: number, fw: number): Lens {
  const ry = r * 0.96, t = -0.42;
  return {
    inner: ellipse(cx, cy, r, ry), hole: ellipse(cx, cy, r, ry).mirrorX(cx), outer: ellipse(cx, cy, r + fw, ry + fw),
    nose: [cx - side * r * Math.cos(t), cy + ry * Math.sin(t)], hinge: [cx + side * (r + fw * 0.5) * Math.cos(t), cy + ry * Math.sin(t)],
    top: Array.from({ length: 5 }, (_, i): Vec2 => { const a = Math.PI * (1.12 + i * 0.09); return [cx + Math.cos(a) * (r + fw * 0.55), cy + Math.sin(a) * (ry + fw * 0.55)]; }),
    glint: [[cx - r * 0.74, cy - ry * 0.2], [cx - r * 0.58, cy - ry * 0.52], [cx - r * 0.3, cy - ry * 0.74]], g: r * 0.13,
  };
}

/** A lens from its corners (u outwards from the nose, clockwise for the wearer's left), with corner radii and a frame of edge widths. */
function cornerLens(cx: number, cy: number, side: 1 | -1, cs: Vec2[], r: number[], frame: number[] | null): Lens {
  const inner = place(cs, cx, cy, side), rr = side === 1 ? r : [...r].reverse();
  const fr = frame ? (side === 1 ? frame : [...frame.slice(0, -1)].reverse().concat(frame[frame.length - 1])) : null;
  // the edges' widths follow their corners when mirrored: edge i runs from corner i to i + 1
  const fe = frame && side === -1 ? cs.map((_, i) => frame[(cs.length * 2 - 2 - i) % cs.length]) : fr;
  const outer = fe ? grow(inner, fe) : null;
  const [u0, y0] = cs[0], [u1, y1] = cs[1], [, y3] = cs[cs.length - 1];
  const w = (u1 - u0), hgt = Math.max(...cs.map(c => c[1])) - Math.min(...cs.map(c => c[1]));
  const fTop = frame?.[0] ?? 0;
  return {
    inner: rounded(inner, rr), hole: rounded([...inner].reverse(), [...rr].reverse()), outer: outer ? rounded(outer, rr.map((v, i) => v + (fe?.[i] ?? 0) * 0.6)) : null,
    nose: [cx + side * u0, cy + (y0 + y3) / 2 - hgt * 0.12], hinge: [cx + side * (u1 + (frame?.[1] ?? 0) * 0.5), cy + y1 + hgt * 0.22],
    top: [[cx + side * (u0 + w * 0.08), cy + y0 - fTop * 0.6], [cx + side * (u0 + w * 0.45), cy + (y0 + y1) / 2 - fTop * 0.6]].map(([x, y]): Vec2 => [x, y]).sort((a, b) => a[0] - b[0]),
    glint: glintIn(inner, Math.min(w, hgt)), g: Math.min(w, hgt) * 0.065,
  };
}

/** A glint hugging the upper left corner of a lens drawn from corners, `d` the lens's smaller size. */
function glintIn(cs: Vec2[], d: number): Vec2[] {
  const [x, y] = cs.reduce((a, c) => (c[0] + c[1] < a[0] + a[1] ? c : a));
  return [[x + d * 0.14, y + d * 0.4], [x + d * 0.17, y + d * 0.2], [x + d * 0.4, y + d * 0.14]];
}

// ---- earrings and devices -----------------------------------------------------------------------------

/** A point on the ear's rim, grown by `g` cm: θ −π/2 is the top, 0 the back of the ear (away from the face), π/2 the lobe. */
function rim(e: Ear, side: 1 | -1, th: number, g = 0): Vec2 {
  const x = side * (e.rx + g) * Math.cos(th), y = (e.ry + g) * Math.sin(th), c = Math.cos(e.rot), s = Math.sin(e.rot);
  return [e.c[0] + x * c - y * s, e.c[1] + x * s + y * c];
}

/** Points along the rim from θ0 to θ1. */
const rimArc = (e: Ear, side: 1 | -1, t0: number, t1: number, g: number, n = 6): Vec2[] => Array.from({ length: n + 1 }, (_, i) => rim(e, side, t0 + (t1 - t0) * i / n, g));

/** The bowl of the ear (where the base draws its shade), and where an earpiece shows in front: past the head's outline. */
function concha(h: Head, e: Ear, side: 1 | -1, r: number): Vec2 {
  const sx = e.rx / 3.6, sy = e.ry / 5, x = side * 0.4 * sx, y = 0.3 * sy, c = Math.cos(e.rot), s = Math.sin(e.rot);
  const p: Vec2 = [e.c[0] + x * c - y * s, e.c[1] + x * s + y * c];
  const out = headHalfWidth(h.shape, h.W, h.H, p[1]) + r * 0.85;
  return [side * Math.max(Math.abs(p[0]), out), p[1]];
}

/** Devices are drawn at an adult's size times this: the head's scale, never below 70% (a toddler's aid still reads). */
const devK = (h: Head) => Math.max(h.k, 0.7);

/** The region outside the outline of the hair (grown by `v` cm) on one side, from height y0 to y1: a cochlear coil in front shows only there. */
function beyond(h: Head, side: 1 | -1, v: number): Path {
  const arc = side === 1 ? h.crown(v, Math.PI * 1.62, Math.PI * 2.12, 12) : h.crown(v, Math.PI * 0.88, Math.PI * 1.38, 12);
  const far = side * h.W * 1.5;
  return poly([...arc, [far, arc[arc.length - 1][1]], [far, arc[0][1]]]);
}

/** How far the hair or a covering stands off the head at the side (cm), for what sits on it. */
const sideBulk = (ctx: PartCtx) => covered(ctx) ? 3.4 : hairBulk(ctx);

/** A small piece's painted contact shadow, down and to the right (light from the upper left), under the paper's own. */
const contact = (p: Path, k: number, opacity = 0.2): Shape => ({ path: p.move(0.2 * k, 0.3 * k), fill: "#3A2418", flat: true, opacity });

/** One piece per worn side. */
const perSide = (ctx: PartCtx, fallback: "l" | "r" | "b", f: (s: 1 | -1) => Shape[]): Group => ({ shapes: sidesOf(ctx.side, fallback).flatMap(f), edge: GLASS_EDGE });

// ---- the parts ----------------------------------------------------------------------------------------

const GLASSES = { colors: 2, palettes: ["fabmetal", "lens"] };

export const EYEWEAR: Record<string, PartDef> = {
  // Turkish was the generic "gözlük" (still what a learner may search for; PartDef has no name aliases)
  glasses_round: named("eyes", "Round glasses", "yuvarlak gözlük", { ...GLASSES, defaults: ["fab_22", "len_01"], tags: ["casual", "school", "work"], draw: ctx => {
    const b = ctx.body, fw = frameW(b), r = eyeSize(b)[1] + 0.75 * b.headH / 50;
    return worn(ctx, (s, cx, cy) => roundLens(cx, cy, s, r, fw), {
      fw, bw: fw * 0.85,
      bridge: (rl, ll) => [rl.nose, [0, rl.nose[1] - r * 0.32], ll.nose],
    });
  } }),

  glasses_rectangle: named("eyes", "Rectangular glasses", "dikdörtgen gözlük", { ...GLASSES, defaults: ["fab_22", "len_01"], tags: ["work", "formal", "school"], draw: ctx => {
    const b = ctx.body, k = b.headH / 50, fw = frameW(b, 0.8), [ex, ey] = eyeSize(b), tilt = b.headW * 0.01, top = -(ey + 0.5 * k), bot = ey + 0.45 * k;
    const cs: Vec2[] = [[-(ex + 2.9 * k), top], [ex + 2.6 * k, top - tilt], [ex + 2.5 * k, bot], [-(ex + 2.8 * k), bot]];
    const rad = (bot - top) * 0.2;
    return worn(ctx, (s, cx, cy) => cornerLens(cx, cy + (b.build === "elder" ? b.headH * 0.02 : 0), s, cs, [rad, rad, rad * 1.2, rad * 1.2], [fw, fw, fw, fw]), {
      fw, tw: fw, hingeDot: true,
      bridge: (rl, ll) => [[rl.nose[0] - 0.3, rl.nose[1] - 0.6], [0, rl.nose[1] - 0.9], [ll.nose[0] + 0.3, ll.nose[1] - 0.6]],
    });
  } }),

  glasses_reading: named("eyes", "Reading glasses (half-rim)", "okuma gözlüğü", { ...GLASSES, defaults: ["met_gold", "len_01"], tags: ["elder", "work", "school"], builds: ["adult", "elder"], draw: ctx => {
    const b = ctx.body, k = b.headH / 50, fw = frameW(b, 1.2), [ex, ey] = eyeSize(b), hh = b.headW * 0.055;
    // low on the nose: the straight top rim crosses the lower part of the eye, so the pupils look over it (elders wear them lower still)
    const drop = ey * 0.5 + hh + (b.build === "elder" ? b.headH * 0.01 : 0);
    const cs: Vec2[] = [[-(ex + 1.0 * k), -hh], [ex + 1.8 * k, -hh - 0.3 * k], [ex + 1.5 * k, hh], [-(ex + 0.7 * k), hh]];
    const rad = [0.6 * k, 0.6 * k, hh * 1.25, hh * 1.25];
    return worn(ctx, (s, cx, cy) => {
      const l = cornerLens(cx, cy + drop, s, cs, rad, null);
      const p = place(cs, cx, cy + drop, s), [a, bb, c, d] = s === 1 ? p : [...p].reverse();
      const down = (q: Vec2, r: Vec2, t: number): Vec2 => [q[0] + (r[0] - q[0]) * t, q[1] + (r[1] - q[1]) * t];
      return { ...l, outer: null, rim: [down(a, d, 0.55), down(a, d, 0.12), [a[0] + s * 0.9 * k, a[1] - 0.15 * k], down(a, bb, 0.5), [bb[0] - s * 0.9 * k, bb[1] - 0.15 * k], down(bb, c, 0.12), down(bb, c, 0.55)] };
    }, {
      fw, bw: fw * 0.75, tw: fw * 0.75, rise: 1.6 * k,
      bridge: (rl, ll) => [[rl.nose[0] + 0.2, rl.nose[1] - hh * 0.75], [0, rl.nose[1] - hh * 1.1], [ll.nose[0] - 0.2, ll.nose[1] - hh * 0.75]],
    });
  } }),

  glasses_pushed_up: named("eyes", "Glasses pushed up into the hair", "saça takılı gözlük", { ...GLASSES, defaults: ["fab_22", "len_01"], tags: ["casual", "work", "summer"], builds: ["adult", "elder"], over: ["hair"], draw: ctx => {
    // a covering or a hat covers them, front and back: they are under it, so nothing shows
    if (topCovered(ctx)) return { front: [], back: [] };
    // seated on the hair over the crown (close to the scalp between puffs, knots or a bun), the temples ending inside its outline
    const b = ctx.body, h = headOf(ctx), k = h.k, fw = frameW(b, 0.8), [ex, ey] = eyeSize(b), v = crownBulk(ctx), frame = ctx.colors[0] ?? "#26272C", glass = ctx.colors[1] ?? "#DCEFF5";
    // lying on the top of the head, seen from the front: the same lenses, foreshortened to a little over half their height
    const cy = -h.H * 0.88 - Math.max(0, v - 2.5 * k) * 0.55, sq = 0.52, top = -(ey + 0.5 * k) * sq, bot = (ey + 0.45 * k) * sq;
    const cs: Vec2[] = [[-(ex + 2.6 * k), top], [ex + 2.4 * k, top], [ex + 2.3 * k, bot], [-(ex + 2.5 * k), bot]];
    const rad = (bot - top) * 0.3;
    const lenses = ([1, -1] as const).map(s => cornerLens(h.eye(s)[0] * 0.96, cy, s, cs, [rad, rad, rad, rad], [fw, fw * 0.8, fw * 0.8, fw * 0.8]));
    const tw = fw * 0.85, shapes: Shape[] = [];
    // the temples run back into the hair at the sides and vanish there, inside its outline
    for (const [i, s] of ([1, -1] as const).entries()) {
      const hg = lenses[i].hinge, y = hg[1] + 2.6 * k, end: Vec2 = [s * (hairEdge(h, v, y) - 1.2 * k), y];
      shapes.push({ path: band([hg, [(hg[0] * 0.4 + end[0] * 0.6), hg[1] + 1.2 * k], end], [tw, tw * 0.8, tw * 0.25]), fill: tone(frame, "shade") });
    }
    shapes.push({ path: band([lenses[1].nose, [0, lenses[1].nose[1] - 0.5 * k], lenses[0].nose], [fw * 0.85]), fill: frame });
    shapes.push(...lenses.flatMap(l => lensShapes(l, frame, glass, fw)));
    // from behind: the lenses lie along the crown, nearly edge on, their upper half over its outline; the temples' ends in the hair at the sides
    const vb = v * 0.85, bx = Math.abs(h.eye(1)[0]) * 0.96, by = hairTop(h, vb, bx) + 0.8 * k, tilt = Math.atan2(hairTop(h, vb, bx + 1) - hairTop(h, vb, bx - 1), 2);
    const flatCs = cs.map(([u, y]): Vec2 => { const yy = y * 0.55; return [u * Math.cos(tilt) - yy * Math.sin(tilt), u * Math.sin(tilt) + yy * Math.cos(tilt)]; });
    const bl = ([1, -1] as const).map(s => cornerLens(bx * s, by, s, flatCs, [rad * 0.6, rad * 0.6, rad * 0.6, rad * 0.6], [fw, fw * 0.8, fw * 0.8, fw * 0.8]));
    // hair gathered higher than where they sit (puffs, knots, a curly bun) stands behind them and hides the frame from behind
    const back: Shape[] = v < hairBulk(ctx) - 0.5 * k ? [] : [
      { path: band([bl[1].nose, [0, hairTop(h, vb, 0) + 0.9 * k], bl[0].nose], [fw * 0.85]), fill: frame },
      ...bl.flatMap(l => lensShapes(l, frame, glass, fw)),
    ];
    for (const s of [1, -1] as const) {
      const y = -h.H * 0.78, x = s * hairEdge(h, v, y);
      back.push({ path: band([[x - s * 0.6 * k, y - 0.3 * k], [x - s * 2 * k, y + 0.5 * k], [x - s * 3.2 * k, y + 1.4 * k]], [tw * 0.35, tw * 0.9, tw * 1.15]), fill: frame });
    }
    return {
      front: [{ layer: "hair_front", bone: "head", group: { shapes, edge: GLASS_EDGE } }],
      back: [{ layer: "hair_front", bone: "head", group: { shapes: back, edge: GLASS_EDGE } }],
    };
  } }),

  sunglasses_classic: named("eyes", "Classic sunglasses", "klasik güneş gözlüğü", { ...GLASSES, defaults: ["fab_22", "len_02"], tags: ["sunglasses", "summer", "casual", "fashion", "istanbul"], builds: ["adult", "elder", "child"], draw: ctx => {
    const b = ctx.body, k = b.headH / 50, [ex, ey] = eyeSize(b), fw = frameW(b, 1.0), tilt = b.headW * 0.012;
    // wider at the top than below, the top bar heavier than the rest of the frame
    const top = -(ey + 0.7 * k), bot = ey + 0.9 * k;
    const cs: Vec2[] = [[-(ex + 2.5 * k), top], [ex + 3.1 * k, top - tilt], [ex + 1.9 * k, bot], [-(ex + 1.2 * k), bot - 0.4 * k]];
    const rad = [0.9 * k, 1.1 * k, (bot - top) * 0.38, (bot - top) * 0.3];
    return worn(ctx, (s, cx, cy) => cornerLens(cx, cy, s, cs, rad, [fw * 1.7, fw, fw, fw]), {
      fw, bw: fw * 1.3, tw: fw * 1.25, hingeDot: true,
      bridge: (rl, ll) => [[rl.nose[0] - 0.4, rl.nose[1] - 1.6 * k], [0, rl.nose[1] - 1.9 * k], [ll.nose[0] + 0.4, ll.nose[1] - 1.6 * k]],
    });
  } }),

  ear_stud: named("ears", "Stud earrings", "çivi küpe", { colors: 2, palettes: ["metal", "fabmetal"], defaults: ["met_silver"], tags: ["casual", "formal", "traditional"], sides: { allowed: ["b", "l", "r"], default: "b" }, draw: ctx => {
    const h = headOf(ctx), k = h.k, metal = ctx.colors[0] ?? "#C3C8CE", stone = ctx.colors[1];
    // never under 0.8 of an adult's (a toddler's still shows), and set in a deep-toned bezel so pale metal reads on any skin
    const stud = (p: Vec2): Shape[] => {
      const r = 1.25 * Math.max(k, 0.8);
      return [
        contact(ellipse(p[0], p[1], r), k, 0.28),
        { path: ellipse(p[0], p[1], r), fill: tone(metal, "deep") },
        { path: ellipse(p[0] - r * 0.06, p[1] - r * 0.06, r * 0.74), fill: metal, flat: true },
        stone && stone !== metal ? { path: ellipse(p[0], p[1], r * 0.5), fill: stone, flat: true } : { path: ellipse(p[0] + r * 0.18, p[1] + r * 0.22, r * 0.42), fill: tone(metal, "shade"), flat: true, opacity: 0.5 },
        { path: ellipse(p[0] - r * 0.3, p[1] - r * 0.3, r * 0.26), fill: "#FFFFFF", flat: true, opacity: 0.9 },
      ];
    };
    return {
      front: [{ layer: "ear_wear", bone: "head", group: perSide(ctx, "b", s => stud(h.ear(s).lobe)) }],
      back: [{ layer: "ear_wear", bone: "head", group: perSide(ctx, "b", s => { const e = h.ear(s); return stud([e.lobe[0] + s * e.rx * 0.45, e.lobe[1] - 0.3 * k]); }) }],
    };
  } }),

  ear_hoop_big: named("ears", "Big hoop earrings", "büyük halka küpe", { colors: 1, palettes: ["fabmetal"], defaults: ["met_gold"], tags: ["fashion", "casual"], builds: ["adult", "elder", "child"], sides: { allowed: ["b", "l", "r"], default: "b" }, draw: ctx => {
    // 5.4 cm across (never more than 0.108 H, 0.09 H on a child), hanging from the lobe past the jaw line
    const h = headOf(ctx), k = h.k, c = ctx.colors[0] ?? "#E0B03C", R = Math.min(2.7 * k, h.H * (kidOf(ctx.body) ? 0.045 : 0.054)), t = 0.7 * k;
    const hoop = (p: Vec2, s: 1 | -1, squash: number, lobe: boolean, clip?: Path): Shape[] => {
      const cx = p[0] + s * 0.25 * k, cy = p[1] + R - t * 0.6, rx = R * squash, inx = Math.max(0.12 * k, rx - t * Math.max(squash, 0.6));
      const hoopPath = ring(ellipse(cx, cy, rx, R), ellipse(cx, cy, inx, R - t).mirrorX(cx)), cl = clip ? { clip } : {};
      return [
        { ...contact(hoopPath, k, clip ? 0.12 : 0.16), ...cl },
        { path: hoopPath, fill: c, ...cl },
        // shade on the lower right of the ring, light on its upper left
        { path: smooth([[cx + rx * 0.15, cy + R - t * 0.4], [cx + rx * 0.75, cy + R * 0.6], [cx + rx - t * 0.4, cy]], false), stroke: { color: tone(c, "shade"), width: t * 0.45 }, flat: true, opacity: 0.8, ...cl },
        { path: smooth([[cx - rx + t * 0.45, cy + R * 0.05], [cx - rx * 0.78, cy - R * 0.55], [cx - rx * 0.3, cy - R + t * 0.45]], false), stroke: { color: tone(c, "light"), width: t * 0.4 }, flat: true, opacity: 0.8, ...cl },
        // the ring goes through the lobe: the lobe covers its top
        ...(lobe ? [{ path: ellipse(p[0], p[1] - 0.1 * k, 0.75 * k, 0.6 * k), fill: ctx.skin, flat: true } as Shape] : []),
      ];
    };
    // the lower part of the ring, from just below the lobe down, again over the hair: hair over the ear covers only the top of the ring
    const below = (p: Vec2): Path => poly([[p[0] - h.W, p[1] + R * 0.45], [p[0] + h.W, p[1] + R * 0.45], [p[0] + h.W, p[1] + 3 * R], [p[0] - h.W, p[1] + 3 * R]]);
    const backAt = (s: 1 | -1): Vec2 => { const e = h.ear(s); return [e.lobe[0] + s * e.rx * 0.4, e.lobe[1]]; };
    return {
      front: [
        { layer: "ear_wear", bone: "head", group: perSide(ctx, "b", s => hoop(h.ear(s).lobe, s, 1, true)) },
        { layer: "headwear", bone: "head", group: perSide(ctx, "b", s => hoop(h.ear(s).lobe, s, 1, false, below(h.ear(s).lobe))) },
      ],
      // from behind the ring is seen nearly edge on, beside the neck
      back: [
        { layer: "ear_wear", bone: "head", group: perSide(ctx, "b", s => hoop(backAt(s), s, 0.34, false)) },
        { layer: "headwear", bone: "head", group: perSide(ctx, "b", s => hoop(backAt(s), s, 0.34, false, below(backAt(s)))) },
      ],
    };
  } }),

  ear_drop: named("ears", "Drop earrings", "sallantılı küpe", { colors: 2, palettes: ["metal", "fabmetal"], defaults: ["met_silver"], tags: ["formal", "fashion", "traditional"], builds: ["adult", "elder"], sides: { allowed: ["b", "l", "r"], default: "b" }, draw: ctx => {
    const h = headOf(ctx), k = h.k, metal = ctx.colors[0] ?? "#C3C8CE", stone = ctx.colors[1] ?? metal;
    const drop = (p: Vec2): Shape[] => {
      const [x, y] = p, top = y + 1.8 * k, w = 0.95 * k, len = 3.5 * k;
      const body = smooth([[x, top, 0], [x + w * 0.75, top + len * 0.45], [x + w, top + len * 0.72], [x, top + len], [x - w, top + len * 0.72], [x - w * 0.75, top + len * 0.45]], true, 1);
      return [
        contact(body, k, 0.16),
        line([[x, y], [x, top + 0.2 * k]], tone(metal, "shade"), 0.3 * k, 1),
        { path: ellipse(x, y, 0.5 * k), fill: metal },
        { path: body, fill: stone },
        { path: smooth([[x + w * 0.2, top + len * 0.5], [x + w * 0.8, top + len * 0.72], [x + w * 0.1, top + len * 0.95]], true), fill: tone(stone, "shade"), flat: true, opacity: 0.55 },
        { path: ellipse(x - w * 0.4, top + len * 0.62, w * 0.22, w * 0.38), fill: "#FFFFFF", flat: true, opacity: 0.8 },
        ...(stone !== metal ? [{ path: ellipse(x, top + 0.25 * k, 0.38 * k, 0.3 * k), fill: metal } as Shape] : []),
      ];
    };
    return {
      front: [{ layer: "ear_wear", bone: "head", group: perSide(ctx, "b", s => drop(h.ear(s).lobe)) }],
      back: [{ layer: "ear_wear", bone: "head", group: perSide(ctx, "b", s => { const e = h.ear(s); return drop([e.lobe[0] + s * e.rx * 0.45, e.lobe[1]]); }) }],
    };
  } }),

  ear_buds_wireless: named("ears", "Wireless earbuds", "kablosuz kulaklık", { colors: 1, defaults: ["fab_01"], tags: ["tech", "casual", "student", "istanbul"], avoid: ["hearing"], builds: ["adult", "elder", "child"], sides: { allowed: ["b", "l", "r"], default: "b" }, draw: ctx => {
    const h = headOf(ctx), k = h.k, c = ctx.colors[0] ?? "#F7F3EA";
    const bud = (p: Vec2, s: 1 | -1, back: boolean): Shape[] => {
      const r = 1.1 * k, [x, y] = p, end: Vec2 = [x - s * 0.4 * k, y + 3.0 * k];
      return [
        ...(back ? [] : [{ path: ellipse(x + s * 0.1, y, r), fill: c } as Shape]),
        { path: band([[x, y + (back ? 0.4 * k : 0)], end], [0.8 * k, 0.7 * k]), fill: c },
        { path: ellipse(end[0], end[1], 0.31 * k), fill: tone(c, "shade"), flat: true, opacity: 0.6 },
        ...(back ? [] : [{ path: ellipse(x + s * 0.1, y, r * 0.5), fill: tone(c, "deep"), flat: true, opacity: 0.35 } as Shape, { path: ellipse(x - r * 0.3, y - r * 0.35, r * 0.25), fill: "#FFFFFF", flat: true, opacity: 0.8 } as Shape]),
      ];
    };
    return {
      front: [{ layer: "ear_wear", bone: "head", group: perSide(ctx, "b", s => bud(concha(h, h.ear(s), s, 1.1 * k), s, false)) }],
      back: [{ layer: "ear_wear", bone: "head", group: perSide(ctx, "b", s => { const e = h.ear(s); return bud([e.c[0] + s * e.rx * 0.55, e.lobe[1] - 1.2 * k], s, true); }) }],
    };
  } }),

  ear_hearing_aid_bte: named("aid", "Behind-the-ear hearing aid", "kulak arkası işitme cihazı", { colors: 2, palettes: ["skinfab", "skinfab"], defaults: ["fab_21", "fab_15"], tags: ["accessibility", "medical", "hearing"], sides: { allowed: ["b", "l", "r"], default: "b" }, draw: ctx => {
    const h = headOf(ctx), kd = devK(h), shell = ctx.colors[0] ?? "#9AA0A6", mould = ctx.colors[1] ?? "#E58FA0", tube = mix(mould, "#FFFFFF", 0.35);
    const front = (s: 1 | -1): Shape[] => {
      const e = h.ear(s), sp = rimArc(e, s, -Math.PI * 0.62, -Math.PI * 0.06, 0.45 * kd, 6), m = concha(h, e, s, 0.6 * kd);
      return [
        { path: band(sp, [0.85 * kd, 1.35 * kd, 1.45 * kd, 1.45 * kd, 1.4 * kd, 1.25 * kd, 1.05 * kd]), fill: shell },
        line(sp.slice(0, 4).map(([x, y]): Vec2 => [x - s * 0.15, y - 0.3 * kd]), tone(shell, "light"), 0.35 * kd, 0.6),
        // the tube hooks over the top of the ear and down into it, to the earmould
        line([sp[0], rim(e, s, -Math.PI * 0.72, 0.2 * kd), [m[0] - s * 0.6 * kd, m[1] - 2.2 * kd], m], tube, 0.32 * kd, 0.75),
        { path: ellipse(m[0], m[1], 0.6 * kd, 0.55 * kd), fill: mould },
      ];
    };
    const back = (s: 1 | -1): Shape[] => {
      const e = h.ear(s), sp = rimArc(e, s, -Math.PI * 0.42, -Math.PI * 0.96, 0.3 * kd, 6);
      return [
        line([sp[0], rim(e, s, -Math.PI * 0.3, 0.5 * kd), rim(e, s, -Math.PI * 0.18, 0.2 * kd)], tube, 0.32 * kd, 0.75),
        { path: band(sp, [0.9 * kd, 1.35 * kd, 1.5 * kd, 1.5 * kd, 1.45 * kd, 1.3 * kd, 1.1 * kd]), fill: shell },
        line(sp.slice(1, 4), tone(shell, "light"), 0.35 * kd, 0.55),
        // the battery door: a line across the lower end
        line([rim(e, s, -Math.PI * 0.86, -0.15 * kd), rim(e, s, -Math.PI * 0.84, 0.8 * kd)], tone(shell, "deep"), 0.22 * kd, 0.6),
      ];
    };
    return { front: [{ layer: "headwear", bone: "head", group: perSide(ctx, "b", front) }], back: [{ layer: "headwear", bone: "head", group: perSide(ctx, "b", back) }] };
  } }),

  ear_cochlear: named("aid", "Cochlear implant processor", "koklear implant işlemcisi", { colors: 2, palettes: ["skinfab", "skinfab"], defaults: ["fab_22", "fab_21"], tags: ["accessibility", "medical", "hearing"], sides: { allowed: ["l", "r", "b"], default: "l" }, draw: ctx => {
    const h = headOf(ctx), kd = devK(h), proc = ctx.colors[0] ?? "#26272C", coil = ctx.colors[1] ?? "#9AA0A6", r = 2.5 * kd, cable = tone(proc, "shade");
    const coilShapes = (x: number, y: number, clip?: Path): Shape[] => [
      { path: ellipse(x, y, r), fill: coil, ...(clip ? { clip } : {}) },
      { path: ellipse(x - 0.1 * kd, y - 0.1 * kd, r * 0.45), fill: tone(coil, "light"), ...(clip ? { clip } : {}) },
      { path: ellipse(x - r * 0.35, y - r * 0.4, r * 0.2), fill: "#FFFFFF", flat: true, opacity: 0.5, ...(clip ? { clip } : {}) },
    ];
    const processor = (e: Ear, s: 1 | -1, t0: number, t1: number, g: number, hook = g): Shape[] => {
      // the hook end (t0) may sit closer in than the body (`hook`): over the top of the ear
      const sp = Array.from({ length: 7 }, (_, i) => rim(e, s, t0 + (t1 - t0) * i / 6, i === 0 ? hook : i === 1 ? (hook + g) / 2 : g));
      return [
        { path: band(sp, [0.85 * kd, 1.35 * kd, 1.45 * kd, 1.45 * kd, 1.45 * kd, 1.4 * kd, 1.25 * kd]), fill: proc },
        line(sp.slice(1, 4).map(([x, y]): Vec2 => [x - s * 0.2, y - 0.3 * kd]), tone(proc, "light"), 0.35 * kd, 0.5),
      ];
    };
    const v = sideBulk(ctx);
    const front = (s: 1 | -1): Shape[] => {
      const e = h.ear(s), y = e.top[1] - 1.2 * kd - r, edge = hairEdge(h, v, y);
      const cx = s * (edge + r * 0.45), top = rim(e, s, -Math.PI * 0.6, 0.55 * kd);
      return [
        line([top, [s * (edge - 0.2), (top[1] + y) / 2], [cx - s * r * 0.6, y + r * 0.5]], cable, 0.35 * kd, 0.9),
        // behind the ear: it hugs the back of the rim, outside it, and only its hook comes over the top of the ear
        ...processor(e, s, -Math.PI * 0.6, Math.PI * 0.06, 0.95 * kd, 0.4 * kd),
        ...coilShapes(cx, y, beyond(h, s, v)),
      ];
    };
    const back = (s: 1 | -1): Shape[] => {
      const e = h.ear(s), x = e.c[0] - s * (r + 1.8 * kd), y = e.top[1] - 0.8 * kd - r, top = rim(e, s, -Math.PI * 0.45, 0.35 * kd);
      return [
        line([top, [(top[0] + x) / 2 + s * 0.4, (top[1] + y) / 2 + 0.3], [x + s * r * 0.5, y + r * 0.6]], cable, 0.35 * kd, 0.9),
        ...processor(e, s, -Math.PI * 0.45, -Math.PI * 1.08, 0.35 * kd),
        ...coilShapes(x, y),
      ];
    };
    return { front: [{ layer: "headwear", bone: "head", group: perSide(ctx, "l", front) }], back: [{ layer: "headwear", bone: "head", group: perSide(ctx, "l", back) }] };
  } }),

  ear_hearing_aid_ite: named("aid", "In-the-ear hearing aid", "kulak içi işitme cihazı", { colors: 2, palettes: ["skinfab", "skinfab"], defaults: ["fab_21", "fab_01"], tags: ["accessibility", "medical", "hearing"], builds: ["adult", "elder", "child"], sides: { allowed: ["b", "l", "r"], default: "b" }, draw: ctx => {
    // small by nature: drawn half as big again, so at a phone's size it is still a dot of its colour
    const h = headOf(ctx), kd = devK(h) * 1.5, shell = ctx.colors[0] ?? "#9AA0A6", plate = ctx.colors[1] ?? "#F7F3EA";
    const front = (s: 1 | -1): Shape[] => {
      const [x, y] = concha(h, h.ear(s), s, 0.7 * kd);
      return [
        { path: smooth([[x - s * 0.55 * kd, y - 0.95 * kd], [x + s * 0.65 * kd, y - 0.7 * kd], [x + s * 0.7 * kd, y + 0.45 * kd], [x + s * 0.05 * kd, y + 0.95 * kd], [x - s * 0.6 * kd, y + 0.5 * kd]], true), fill: shell },
        { path: ellipse(x + s * 0.05 * kd, y - 0.05 * kd, 0.45 * kd, 0.55 * kd), fill: plate },
        { path: ellipse(x + s * 0.15 * kd, y - 0.3 * kd, 0.12 * kd), fill: tone(plate, "deep"), flat: true, opacity: 0.8 },
        line([[x - s * 0.1 * kd, y + 0.6 * kd], [x - s * 0.45 * kd, y + 1.15 * kd]], tone(shell, "deep"), 0.2 * kd, 0.9),
        { path: ellipse(x - s * 0.2 * kd, y - 0.35 * kd, 0.14 * kd), fill: "#FFFFFF", flat: true, opacity: 0.6 },
      ];
    };
    // from behind only the edge of the shell shows at the rim of the ear
    const back = (s: 1 | -1): Shape[] => {
      const e = h.ear(s), p = rim(e, s, Math.PI * 0.05, -0.2 * kd);
      return [{ path: ellipse(p[0], p[1], 0.4 * kd, 0.7 * kd), fill: shell }];
    };
    // in the ear, on the earrings' layer: hair or a covering over the ear covers it as it covers the ear
    return { front: [{ layer: "ear_wear", bone: "head", group: perSide(ctx, "b", front) }], back: [{ layer: "ear_wear", bone: "head", group: perSide(ctx, "b", back) }] };
  } }),
};
