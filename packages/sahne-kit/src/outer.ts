// Outer layers (`outfit.outer`): cardigans, blazers, jackets, coats, an abaya. An outer is a torso
// piece on the spine bone, layer `outer` (over the top, under what lies on the chest), and sleeve
// strips on layer `outer_sleeve` (round at the shoulder, cut flat at the cuff).
//
// THE OUTER ARTIST'S FILE: add parts to `OUTER` (ids `outer_*`, permanent). Shared helpers are in
// draw/: `torsoOutline` with loose ≥ 2.4 and a hem at 8 cm or lower (`hemAt(b, "knee")`,
// `floorHem(b)` below the hip), `torsoPanel` for an open front (leave the gap empty, so the top and
// a necklace show), `outerSleeves` and `outerCuffs` (wider than any top's sleeve), `chestPatch`
// under a deep opening, `printed` and `stripPrint` for prints. The back view always differs (no
// opening, a collar stand, a seam or vent). Long coats and the abaya are `modest`.
//
// This file's own helpers (below) draw a coat's silhouette from the body (`half`, `outline`,
// `panel`): a waist nip read from the body's own waist (none on a round body), shoulder pads, an
// A-line flare and a hip point for long hems; an open front is two panels whose edges meet in a V
// and overlap below it, the upper panel's edge casting its paper shadow on the one under it.
// Details scale with the build (`detail`: child 0.8, toddler 0.7) and heights with the torso.

import { ellipse, rrect, smooth, tone, mix, Path, type BodyDims, type Item, type PartCtx, type PartDef, type Shape, type StripSpec } from "sahne";
import { named, S, line, flat, outerSleeves, outerCuffs, hemAt, floorHem, printed, stripPrint, type Pt } from "./draw/index.ts";

// ---- measures ----------------------------------------------------------------------------------

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
/** How much smaller pockets, buttons and lapels are drawn: child 0.8, toddler 0.7. */
const detail = (b: BodyDims) => (b.build === "toddler" ? 0.7 : b.build === "child" ? 0.8 : 1);
/** How much of an adult coat's ease a smaller body's coat has: the sleeves stay outside its sides. */
const ease = (b: BodyDims) => (b.build === "toddler" ? 0.72 : b.build === "child" ? 0.82 : 1);
/** How much the body narrows at the waist, 0 (round: a straight line) … 1, so a nip follows the body, not its shape's name. */
const shaping = (b: BodyDims) => clamp((b.hipW - b.waistW) / b.hipW * 6, 0, 1);
/** The widest a top's waist is (loose 1.8), plus a margin: an outer's waist never goes inside it. */
const TOP_WAIST = 1.8 * 1.3 + 0.6;
/** The neck point's half-width. */
const neckX = (b: BodyDims, collar = 0) => b.neckW / 2 + 1.4 + collar;
/** A point list mirrored to side `s` (1 the wearer's left, +x; corners stay corners). */
const side = (pts: Pt[], s: 1 | -1): Pt[] => pts.map(p => (p.length === 3 ? [s * p[0], p[1], 0] : [s * p[0], p[1]]) as Pt);
/** A corner point. */
const C = (x: number, y: number): Pt => [x, y, 0];

interface Cut {
  /** cm past the body each side at the chest (outers 2.4 and more). */
  loose: number;
  /** The hem's y on the spine bone (cm below the hip pivot). */
  hem: number;
  /** The hem's half-width (an A-line flares past the hip); default the hip's. */
  flare?: number;
  /** cm taken in at the waist, times the body's own waist shaping; never inside a top's waist. */
  nip?: number;
  /** Shoulder pads: cm past the shoulder point. */
  pad?: number;
  /** A wider neck (cm each side), for a collar that stands round it. */
  collar?: number;
  /** An A-line from the chest: no waist, the side runs straight out to the flared hem (a robe, a child's raincoat). */
  aline?: boolean;
  /** cm past the body at the waist (default 1.3 × loose): a puffer stays a barrel, not a bulge, on a round body. */
  waist?: number;
  /** How far the hem may draw in under a waist wider than the hips (cm; default 0.3, so a round body's coat falls straight, with no points at the hem). */
  gather?: number;
}

/** One side of an outer, from the neck point to the hem's side corner (`s` 1 is the wearer's left, +x). */
function half(b: BodyDims, o: Cut, s: 1 | -1): Pt[] {
  // a child's coat has less ease than an adult's, and its chest line sits as far down its own (short) torso
  const T = b.torsoL, v = T / 43, e = ease(b), sw = b.shoulderW / 2 + (o.pad ?? 0), cw = b.chestW / 2 + o.loose * e, hw = b.hipW / 2 + o.loose * e, yc = -T + 14.5 * v;
  const ww = Math.max(b.waistW / 2 + (o.waist ?? o.loose * 1.3) * e - (o.nip ?? 0) * shaping(b), b.waistW / 2 + TOP_WAIST);
  const hx = Math.max(o.flare ?? hw, b.hipW / 2 + 2 * e, o.aline ? 0 : ww - (o.gather ?? 0.3));
  const pts: Pt[] = [C(neckX(b, o.collar), -T - 0.6), [sw - 1.2, -T + 1.4], C(sw + 0.3, -T + 4.6 * Math.max(v, 0.7)), [Math.max(cw, sw + 0.3), yc]];
  // an A-line falls a little convex from the chest to the hem; otherwise the waist, and a long hem passes the hip first, then flares
  if (o.aline) pts.push([Math.max(cw, ww) + (hx - Math.max(cw, ww)) * 0.42 + 0.4, yc + (o.hem - yc) * 0.42]);
  else {
    pts.push([Math.max(ww, cw), -T * 0.32]);
    if (o.hem > 16) pts.push([Math.max(hw + (hx - hw) * 0.1, ww - 0.2), 4]);
  }
  pts.push(C(hx, o.hem));
  return side(pts, s);
}

/** The half-width of an outer at height `y` (on its straight-line outline, a little inside the smooth one), so a band or a seam across it needs no clip. */
function sideX(b: BodyDims, o: Cut, y: number): number {
  const h = half(b, o, 1);
  for (let i = 1; i < h.length; i++) {
    const [x0, y0] = h[i - 1], [x1, y1] = h[i];
    if (y <= y1 && y1 > y0) return y <= y0 ? x0 : x0 + (x1 - x0) * (y - y0) / (y1 - y0);
  }
  return h[h.length - 1][0];
}

/** A band across the hem from `y0` down (a rib, a casing): a flat piece that follows the sides, unclipped. */
function hemBand(b: BodyDims, o: Cut, y0: number, c: string, opacity = 0.55): Shape {
  const a = sideX(b, o, y0) - 0.15, z = sideX(b, o, o.hem) - 0.15;
  return flat(smooth([C(-a, y0), C(a, y0), C(z, o.hem + 0.3), C(-z, o.hem + 0.3)], true, 1), c, opacity);
}

/** A closed outer's silhouette: both sides, a straight hem and the front neck (a round dip, a V, or the back's shallow curve). */
function outline(b: BodyDims, o: Cut, dip: number, vee = false): Pt[] {
  const top = -b.torsoL - 0.6, nw = neckX(b, o.collar);
  const neck: Pt[] = vee ? [C(0, top + dip)] : [[nw * 0.55, top + dip * 0.7], [0, top + dip], [-nw * 0.55, top + dip * 0.7]];
  return [...half(b, o, -1), [0, o.hem], ...half(b, o, 1).reverse(), ...neck];
}

/**
 * One front panel of an open or overlapping front: from its side seam to its front edge at
 * x = -s·ext (past the centre line when ext > 0), a V from the neck point down to (edge, `vee`),
 * and below the lowest button (`low`) either straight down or, with `cut`, curving away to meet
 * the hem `cut` cm on its own side (a blazer's rounded front).
 */
function panel(b: BodyDims, o: Cut, s: 1 | -1, f: { ext: number; vee: number; cut?: number; low?: number }): Pt[] {
  const e = -s * f.ext, h = half(b, o, s);
  if (!f.cut) return [...h, C(e, o.hem), C(e, f.vee)];
  const low = f.low ?? f.vee, x = s * f.cut;
  return [...h, C(x, o.hem), [e + (x - e) * 0.62, low + (o.hem - low) * 0.62], [e + (x - e) * 0.08, low + (o.hem - low) * 0.12], C(e, low), C(e, f.vee)];
}

/** The flat shade down the side away from the light (+x), cut to the piece's outline. */
function shade(b: BodyDims, o: Cut, c: string, ground: ReturnType<typeof smooth>, w = 3.2): Shape {
  const h = half(b, o, 1).slice(3), inner = h.map(p => [p[0] - w, p[1]] as Pt).reverse();
  return { ...S([...h, ...inner], tone(c, "shade"), { flat: true, opacity: 0.5 }), clip: ground };
}

/** A round button: a small cut piece with a lit dot. */
const button = (x: number, y: number, r: number, c: string): Shape[] => [
  { path: ellipse(x, y, r, r), fill: c },
  { path: ellipse(x - r * 0.3, y - r * 0.3, r * 0.32, r * 0.32), fill: tone(c, "light"), flat: true, opacity: 0.7 },
];

/** Fine ribs across a band (knit rib, an elastic hem): a vertical tick every `step` cm, as one path. */
function ribPath(x0: number, x1: number, y0: number, y1: number, step: number): Path {
  const p = new Path();
  for (let x = x0 + step / 2; x < x1; x += step) p.moveTo(x, y0 + 0.3).lineTo(x, y1 - 0.3);
  return p;
}

/** A band of the piece cut to its outline (a rib hem, a casing, a reflective tape): flat by default. */
const bandAcross = (x: number, y0: number, y1: number, c: string, clip: Path, o: Partial<Shape> = {}): Shape =>
  ({ path: rrect(-x, y0, x * 2, y1 - y0, 0.2), fill: c, flat: true, opacity: 0.55, clip, ...o });

/** A strip pair on `outer_sleeve` with its own widths (a bell sleeve, a quilted one, a rib cuff). */
function armPair(c: string, widths: [number, number, number], from: number, to: number, spec: Partial<StripSpec> = {}): Item[] {
  return (["arm_l", "arm_r"] as const).map(chain => ({ layer: "outer_sleeve", bone: "spine", strip: { chain, widths, color: c, from, to, ...spec } }));
}
/** The outer sleeve's widths (`outerSleeves`), plus `add` cm, and the wrist `wrist` times as wide (a rib that gathers). */
const sleeveW = (b: BodyDims, add = 0, wrist = 1): [number, number, number] => [b.armW[0] * 1.28 + 3.6 + add, b.armW[1] * 1.26 + 3.4 + add, (b.armW[2] * 1.22 + 3.2 + add) * wrist];

/**
 * A striped sleeve's round shoulder cap, striped like the rest of it: a strip's stripes start at
 * the shoulder joint, so its cap would stay the plain ground. The ink bands carry on up the cap
 * (on the upper arm bone, +y down the arm), each cut to the half circle of radius `w0 / 2`.
 */
function capStripes(ctx: PartCtx, w0: number): Item[] {
  const sp = stripPrint(ctx);
  if (!sp.stripes || !sp.color) return [];
  const [, period, duty] = sp.stripes, r = w0 / 2, p = new Path(), xAt = (y: number) => Math.sqrt(Math.max(0, r * r - y * y));
  for (let y1 = 0; y1 > -r; y1 -= period) {
    const a = Math.max(-r, y1 - (1 - duty) * period), m = (a + y1) / 2;
    p.moveTo(-xAt(y1), y1).lineTo(-xAt(m), m).lineTo(-xAt(a), a).lineTo(xAt(a), a).lineTo(xAt(m), m).lineTo(xAt(y1), y1).close();
  }
  return (["arm_l", "arm_r"] as const).map(bone => ({ layer: "outer_sleeve", bone, group: { shapes: [{ path: p, fill: sp.color!, flat: true }] } }));
}

/** Small things on the sleeves, on the forearm bones (cuff buttons): `draw(s)` in the bone's frame, where +s·x is the outside of the arm. */
const onForearms = (b: BodyDims, draw: (s: 1 | -1) => Shape[]): Item[] =>
  ([["forearm_l", 1], ["forearm_r", -1]] as const).map(([bone, s]) => ({ layer: "outer_sleeve", bone, group: { shapes: draw(s) } }));

/** The front panel's second colour, or the ground's own tone when the document names none. */
const second = (ctx: PartCtx, c: string, t: "deep" | "shade" | "light" = "deep") => ctx.colors[1] ?? tone(c, t);

/** Several paths as one compound path: one shape (and one SVG element) for a row of repeated details. */
const many = (paths: Path[]): Path => paths.reduce((p, q) => p.add(q), new Path());

/** Printed lines (seams) as one compound stroke. */
const strokes = (c: string, w: number, op: number, paths: Path[]): Shape => ({ path: many(paths), stroke: { color: c, width: w }, flat: true, opacity: op });

/** Relative luminance of a hex colour, 0 … 1. */
function lum(hex: string): number {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  if (!Number.isFinite(n)) return 0.5;
  const ch = (v: number) => { const x = v / 255; return x <= 0.04 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}
/** A facing (lapels, a collar) `amt` of the way to the light tone, or to the shade on a light cloth, where the light tone would vanish. */
const facing = (c: string, amt: number) => mix(c, tone(c, lum(c) > 0.45 ? "shade" : "light"), amt);

/** A piece on the spine bone, layer `outer`. */
const onSpine = (shapes: Shape[], layer = "outer"): Item => ({ layer, bone: "spine", group: { shapes } });

/**
 * Notch lapels and the collar on one side `s`: from the neck point down the roll line to the top
 * button at (`bx`, `by`), widest `wide` cm out at the chest, with the notch below the collar.
 */
function lapel(b: BodyDims, s: 1 | -1, bx: number, by: number, wide: number, c: string): Shape {
  const T = b.torsoL, nw = neckX(b), k = detail(b), v = T / 43;
  const pts: Pt[] = [C(nw - 0.3, -T - 0.4), [nw + 1.2 * k, -T - 1.3], C(nw + 3.6 * k, -T + 2.6 * v), C(nw + 2.9 * k, -T + 5 * v), C(nw + wide * 0.82, -T + 5.4 * v), [nw + wide, -T + 11 * v]];
  return S([...side(pts, s), C(bx, by)], c);
}

/** A hood worn down: in front a soft bunch behind the neck (on `body_back`), from behind hanging flat over the coat, a half-shade darker so it reads on a plain coat. */
function hood(b: BodyDims, c: string, rim: string, tall?: number): { front: Shape[]; back: Shape[] } {
  // a child's big head and hair would hide a short hood: on a small build it hangs longer and wider; `tall` sets the bunch's height (cm) in front
  const small = b.build === "child" || b.build === "toddler", T = b.torsoL, hf = (b.headW + 3) * 0.34, hb = small ? Math.min((b.headW + 3) * 0.42, b.shoulderW / 2 - 2) : hf, hh = tall ?? Math.min(8, b.headH * 0.17), nw = neckX(b);
  const bunch = S([[-hf, -T + 3], [-hf * 1.02, -T - hh * 0.4], [-hf * 0.62, -T - hh], [0, -T - hh * 0.82], [hf * 0.62, -T - hh], [hf * 1.02, -T - hh * 0.4], [hf, -T + 3]], tone(c, "shade"));
  const lip = S([[-hf * 0.96, -T - hh * 0.4], [-hf * 0.6, -T - hh], [0, -T - hh * 0.82], [hf * 0.6, -T - hh], [hf * 0.96, -T - hh * 0.4], [hf * 0.55, -T - hh * 0.72], [0, -T - hh * 0.55], [-hf * 0.55, -T - hh * 0.72]], rim);
  const drop = T * (b.build === "toddler" ? 0.55 : small ? 0.46 : 0.3), hang = S([C(-hb, -T - 1.2), [-hb * 0.9, -T + drop * 0.55], [-hb * 0.35, -T + drop], [0, -T + drop * 1.08], [hb * 0.35, -T + drop], [hb * 0.9, -T + drop * 0.55], C(hb, -T - 1.2), [0, -T - 0.2]], mix(c, tone(c, "shade"), small ? 0.8 : 0.45));
  const edge = S([C(-hb, -T - 1.2), [0, -T - 0.2], C(hb, -T - 1.2), [hb * 0.92, -T + 1.4], [0, -T + 2.4], [-hb * 0.92, -T + 1.4]], rim);
  return {
    front: [bunch, lip, flat(smooth([[-nw - 1, -T - hh * 0.5], [0, -T - hh * 0.3], [nw + 1, -T - hh * 0.5], [0, -T + 1]], true, 1), tone(c, "deep"), 0.35)],
    back: [hang, edge, line([[0, -T + 2.4], [0, -T + drop * 0.98]], tone(c, "shade"), 0.45, 0.6)],
  };
}

/** A flap or welt pocket: a cut piece of the cloth with its opening as a flat line along the top. */
function flapPocket(x: number, y: number, w: number, h: number, c: string, slant = 0): Shape[] {
  const d = slant * w / 2;
  return [S([C(x - w / 2, y + d), C(x + w / 2, y - d), C(x + w / 2 - 0.3, y - d + h), C(x - w / 2 + 0.3, y + d + h)], c),
    line([[x - w / 2 + 0.4, y + d + 0.35], [x + w / 2 - 0.4, y - d + 0.35]], tone(c, "deep"), 0.35, 0.55)];
}

interface Tailor {
  /** The hem on an adult (cm below the hip pivot; shorter torsos scale it). */
  hem: number;
  /** Shoulder pads (cm). */
  pad: number;
  /** How far the front edges curve apart at the hem (cm each side of the centre): a blazer's rounded front. */
  cut: number;
  /** How far out the lapels reach from the neck point (cm). */
  wide: number;
  /** The lapels' tone (`facing`): further from the cloth for a blazer, nearer it for a suit. */
  lapels: (c: string) => string;
  /** A pocket square in the breast welt. */
  square?: boolean;
  /** One vent at the centre back or two at the sides. */
  vents: 1 | 2;
  /** Buttons on each cuff. */
  cuff: number;
}

/**
 * A tailored jacket (a blazer, a suit jacket): two panels that overlap at the buttons, notch lapels
 * down a V that shows the top (and a tie), flap pockets; a two-button front, or one button where
 * the body has no waist (a lower button would pull). From behind: a collar band, a centre seam
 * and vents.
 */
function tailored(ctx: PartCtx, t: Tailor) {
  const b = ctx.body, c = ctx.colors[0] ?? "#2E3A59", btn = second(ctx, c), T = b.torsoL, k = detail(b), v = T / 43, sh = shaping(b);
  const o: Cut = { loose: 2.4, hem: Math.max(8.5, t.hem * v), nip: 2.5, pad: t.pad * k, flare: b.hipW / 2 + 2.4 + 0.8 * sh }, hem = o.hem, hx = o.flare!;
  const one = sh < 0.3, yb = -T * (one ? 0.27 : 0.36), ys = one ? [yb] : [yb, yb + 9.5 * v], low = ys[ys.length - 1] + 2.4 * v, ext = 1.8 * k;
  const f = { ext, vee: yb, cut: t.cut * k, low };
  const under = panel(b, o, 1, f), over = panel(b, o, -1, f), up = smooth(under, true, 1), op = smooth(over, true, 1), lt = t.lapels(c), nw = neckX(b);
  // the breast welt on the wearer's left, set low and just off the lapel's edge, where the hanging arm leaves it in view; a pocket square stands out of it
  const by = -T + 17 * v, lx = nw + t.wide * k, ly = -T + 11 * v, edge = lx + (-ext * 0.6 - lx) * (by - ly) / (yb - ly), bx = edge + 2 * k, qx = bx - 0.9 * k;
  const welt: Shape[] = [
    ...(t.square ? [S([C(qx - 1.5 * k, by + 0.6), [qx - 1 * k, by - 1.8 * k], C(qx - 0.2 * k, by - 0.8 * k), C(qx + 0.6 * k, by - 2.2 * k), C(qx + 1.5 * k, by + 0.4)], tone(lt, "edge"))] : []),
    ...flapPocket(bx, by, 4.4 * k, 1.2 * k, c, 0.14)];
  const pockets = (s: 1 | -1) => flapPocket(s * hx * 0.5, -1.5 * v, 11 * k, 3.8 * k, c, s * 0.06);
  const front: Shape[] = [
    S(under, c), ...printed(ctx, up, { hem }), shade(b, o, c, up), ...pockets(1), lapel(b, 1, -ext * 0.6, yb, t.wide * k, lt), ...welt,
    S(over, c), ...printed(ctx, op, { hem }), ...pockets(-1), lapel(b, -1, ext * 0.6, yb, t.wide * k, lt),
    ...ys.flatMap(y => button(0, y + 0.4, 0.62 * k, btn)),
  ];
  const whole = outline(b, o, 1.2), wp = smooth(whole, true, 1);
  const vents = t.vents === 1 ? [[0]] : [[-hx * 0.62], [hx * 0.62]];
  const back: Shape[] = [
    S(whole, c), ...printed(ctx, wp, { hem }), shade(b, o, c, wp),
    line([[0, -T + 2], [0.3, -T * 0.4], [0, hem - (t.vents === 1 ? 9 * v : 0)]], tone(c, "shade"), 0.45, 0.6),
    ...vents.flatMap(([x]) => [{ ...flat(smooth([C(x, hem - 9 * v), C(x + 1.4 * k, hem - 8.4 * v), C(x + 1.4 * k, hem), C(x, hem)], true, 1), tone(c, "shade"), 0.5), clip: wp }, line([[x, hem - 9 * v], [x, hem]], tone(c, "deep"), 0.4, 0.6)]),
    S([C(-nw - 1.4, -T + 0.6), [-nw - 0.5, -T - 1.8], [0, -T - 1.5], [nw + 0.5, -T - 1.8], C(nw + 1.4, -T + 0.6), [0, -T + 2]], lt),
  ];
  const cuffs = onForearms(b, s => Array.from({ length: t.cuff }, (_, i) => ({ path: ellipse(s * (b.armW[2] * 0.61 + 0.4), b.foreArmL * (0.93 - i * 0.055), 0.36 * k, 0.36 * k), fill: tone(c, "deep"), flat: true, opacity: 0.8 } as Shape)));
  const arms = [...outerSleeves(b, c, 0.98, stripPrint(ctx)), ...cuffs];
  return { front: [onSpine(front), ...arms], back: [onSpine(back), ...arms] };
}

/**
 * A standing collar round the neck (a parka's, a puffer's), `h` cm above the shoulder line: it
 * hides the neck's foot and the chin stands in front of its top. Its front dips, so the inside of
 * its back shows above it as a dark crescent.
 */
function standCollar(b: BodyDims, c: string, h: number, collar = 0.4): Shape[] {
  const T = b.torsoL, nw = neckX(b, collar), dip = Math.min(1.4, h * 0.3);
  return [
    flat(smooth([C(-nw + 0.5, -T - h), [0, -T - h - 0.2], C(nw - 0.5, -T - h), [0, -T - h + dip + 0.4]], true, 1), tone(c, "deep"), 0.9),
    S([C(-nw - 1, -T + 0.6), [-nw - 0.2, -T - h * 0.5], [-nw + 0.2, -T - h + 0.1], [-nw * 0.5, -T - h + dip * 0.55], [0, -T - h + dip], [nw * 0.5, -T - h + dip * 0.55], [nw - 0.2, -T - h + 0.1], [nw + 0.2, -T - h * 0.5], C(nw + 1, -T + 0.6), [0, -T + 2.4]], c),
  ];
}

// ---- the parts ---------------------------------------------------------------------------------

export const OUTER: Record<string, PartDef> = {
  // a buttoned knit cardigan with a V neck: the panels meet in the V and overlap below it
  outer_cardigan_short: named("outer", "Cardigan", "hırka", {
    colors: 2, palettes: ["fabric", "fabric"], defaults: ["fab_18"], patterns: ["pat_stripe_h"],
    tags: ["casual", "modest", "knit", "autumn", "winter", "home"], over: ["top", "dress"],
    draw(ctx) {
      const b = ctx.body, c = ctx.colors[0] ?? "#D8C3A0", btn = second(ctx, c), T = b.torsoL, k = detail(b), v = T / 43, sh = shaping(b);
      const o: Cut = { loose: sh > 0.6 ? 2.4 : 2.8, hem: Math.max(8.5, 10 * v) }, hem = o.hem, rib = tone(c, "shade"), rw = 3 * k;
      const ext = sh < 0.3 ? 0.8 : 0.6, vee = -T + 9 * v + 0.6, nw = neckX(b);
      const under = smooth(panel(b, o, 1, { ext, vee }), true, 1), over = smooth(panel(b, o, -1, { ext, vee }), true, 1), whole = smooth(outline(b, o, 1.2), true, 1);
      // the rib along a panel's front edge, from the neck point down the V and on to the hem
      const placket = (s: 1 | -1): Shape => {
        const e = -s * ext, dx = e - s * nw, dy = vee + T + 0.6, l = Math.hypot(dx, dy), nx = (dy / l) * rw * s, ny = (-dx / l) * rw * s;
        return { ...S([C(s * nw, -T - 0.6), C(e, vee), C(e, hem), C(e + s * rw, hem), C(e + s * rw, vee + rw * 0.4), C(s * nw + nx * 0.9, -T - 0.6 + Math.abs(ny) * 0.2)], rib, { flat: true, opacity: 0.45 }), clip: s === 1 ? under : over };
      };
      const bandH = rw;
      const n = b.build === "toddler" ? 3 : b.build === "child" ? 4 : 5, y0 = vee + 1.6 * k, y1 = hem - bandH - 1.6 * k;
      const buttons = Array.from({ length: n }, (_, i) => button(ext - rw * 0.5, y0 + (y1 - y0) * (i / (n - 1)), 0.7 * k, btn)).flat();
      // a patch pocket: rounded at the bottom, a rib along its top, a little shade inside its lower edge
      const pocket = (s: 1 | -1): Shape[] => {
        const w = 8 * k, x = s * (b.hipW / 2 + o.loose) * 0.5, top = hem - bandH - 1.2 - w, p = rrect(x - w / 2, top, w, w, [0.2, 0.2, 1.4 * k, 1.4 * k]);
        return [{ path: p, fill: c }, ...printed(ctx, p, { hem }), flat(rrect(x - w / 2, top + w - 1.4 * k, w, 1.4 * k, [0, 0, 1.4 * k, 1.4 * k]), tone(c, "shade"), 0.35),
          flat(rrect(x - w / 2, top, w, 1.8 * k, 0.2), rib, 0.5)];
      };
      const pocketRibs = (s: 1 | -1) => { const w = 8 * k, x = s * (b.hipW / 2 + o.loose) * 0.5, top = hem - bandH - 1.2 - w; return ribPath(x - w / 2, x + w / 2, top, top + 1.8 * k, 1 * k); };
      const hr = Math.min(sideX(b, o, hem - bandH), sideX(b, o, hem)) - 0.4, hemRibs = ribPath(-hr, hr, hem - bandH, hem, 1.5 * k);
      const front: Shape[] = [
        S(panel(b, o, 1, { ext, vee }), c), ...printed(ctx, under, { hem }), shade(b, o, c, under), placket(1),
        S(panel(b, o, -1, { ext, vee }), c), ...printed(ctx, over, { hem }), placket(-1),
        hemBand(b, o, hem - bandH, rib, 0.55),
        ...(b.build === "toddler" ? [] : [...pocket(1), ...pocket(-1)]),
        strokes(tone(c, "deep"), 0.3, 0.35, b.build === "toddler" ? [hemRibs] : [hemRibs, pocketRibs(1), pocketRibs(-1)]), ...buttons,
      ];
      const back: Shape[] = [
        S(outline(b, o, 1.2), c), ...printed(ctx, whole, { hem }), shade(b, o, c, whole),
        flat(smooth([[-nw - 0.8, -T - 0.6], [0, -T + 0.8], [nw + 0.8, -T - 0.6], [nw + 0.4, -T + 1.8], [0, -T + 3], [-nw - 0.4, -T + 1.8]], true, 1), rib, 0.5),
        hemBand(b, o, hem - bandH, rib, 0.55), strokes(tone(c, "deep"), 0.3, 0.35, [hemRibs]),
        line([[0, -T + 3.2], [0, hem - bandH]], tone(c, "shade"), 0.4, 0.3),
      ];
      const arms = [...outerSleeves(b, c, 0.97, stripPrint(ctx)), ...capStripes(ctx, sleeveW(b)[0]), ...armPair(rib, sleeveW(b, 0, 0.86), 0.9, 1)];
      return { front: [onSpine(front), ...arms], back: [onSpine(back), ...arms] };
    },
  }),

  // Tolga's blazer: softer and shorter than the suit jacket, light lapels, a rounded front
  outer_blazer: named("outer", "Blazer", "blazer ceket", {
    colors: 2, palettes: ["fabric", "fabric"], defaults: ["fab_04"], builds: ["adult", "elder", "child"],
    tags: ["formal", "work", "school", "smart", "istanbul"], over: ["top", "dress"],
    draw: ctx => tailored(ctx, { hem: 15, pad: 0.6, cut: 4.2, wide: 5, lapels: c => facing(c, 0.7), vents: 1, cuff: 2 }),
  }),

  // Reza's suit jacket: longer and straighter, pads, a pocket square, meant to match trousers
  outer_jacket_suit: named("outer", "Suit jacket", "takım elbise ceketi", {
    colors: 2, palettes: ["fabric", "fabric"], defaults: ["fab_24"], builds: ["adult", "elder", "child"],
    tags: ["formal", "work", "wedding", "interview"], over: ["top", "dress"],
    draw: ctx => tailored(ctx, { hem: 17, pad: 1, cut: 1.6, wide: 4.6, lapels: c => facing(c, 0.6), square: true, vents: 2, cuff: 3 }),
  }),

  // Alex's parka, hood down: a standing collar, a snap flap over the zip, flap pockets, a drawstring
  outer_coat_parka: named("outer", "Parka (hood down)", "parka", {
    colors: 2, palettes: ["fabric", "fabric"], defaults: ["fab_08"], tags: ["winter", "casual", "student", "istanbul"], over: ["top", "dress", "bottom"],
    draw(ctx) {
      const b = ctx.body, c = ctx.colors[0] ?? "#6F7A45", rim = second(ctx, c, "light"), T = b.torsoL, k = detail(b), v = T / 43;
      const o: Cut = { loose: 4.2, hem: Math.max(8.5, hemAt(b, 0.5)), collar: 0.4 }, hem = o.hem, hx = b.hipW / 2 + 4.2, deep = tone(c, "deep");
      const whole = outline(b, o, 1.6), wp = smooth(whole, true, 1), hc = Math.min(5 * k, b.neckL * 0.8 + 0.6), ht = hood(b, c, rim);
      // the casing at the body's own waist line, its cords short on a child and none on a toddler
      const yw = -T * 0.32, cord = b.build === "toddler" ? 0 : b.build === "child" ? 3 : 4;
      const pocket = (s: 1 | -1): Shape[] => {
        const w = 9 * k, h = 10 * k, x = s * hx * 0.5, top = hem - 2.4 * v - h;
        return [S([C(x - w / 2, top), C(x + w / 2, top), C(x + w / 2, top + h), C(x - w / 2, top + h)], c),
          S([C(x - w / 2 - 0.4, top - 0.6), C(x + w / 2 + 0.4, top - 0.6), [x + w / 2 + 0.2, top + 2.8 * k], [x, top + 3.6 * k], [x - w / 2 - 0.2, top + 2.8 * k]], c),
          { path: ellipse(x, top + 2.4 * k, 0.45 * k, 0.45 * k), fill: deep, flat: true, opacity: 0.6 }];
      };
      const flapX = 0.4, flapW = 3.6 * k, snaps = Array.from({ length: 5 }, (_, i) => -T + 3 * v + (hem - 2 + T - 3 * v) * (i + 0.5) / 5);
      const front: Shape[] = [
        S(whole, c), shade(b, o, c, wp),
        bandAcross(hx + 3, yw - 1.1 * k, yw + 1.1 * k, tone(c, "shade"), wp, { opacity: 0.45 }),
        ...(b.build === "toddler" ? [] : [...pocket(1), ...pocket(-1)]),
        ...standCollar(b, c, hc),
        line([[-0.2, -T - hc + 1.6], [-0.2, hem]], deep, 0.45, 0.7),
        S([C(flapX, -T - hc + Math.min(1.4, hc * 0.3) + 0.2), C(flapX + flapW, -T - hc + Math.min(1.4, hc * 0.3) - 0.1), C(flapX + flapW, hem), C(flapX, hem)], c),
        ...snaps.map(y => ({ path: ellipse(flapX + flapW / 2, y, 0.42 * k, 0.42 * k), fill: deep, flat: true, opacity: 0.55 } as Shape)),
        ...(cord ? [-1.6, 1.6].flatMap(x => [line([[x, yw], [x * 1.2, yw + cord * 0.6], [x * 1.1, yw + cord]], rim, 0.4, 0.95), { path: ellipse(x * 1.1, yw + cord, 0.5, 0.75), fill: rim } as Shape]) : []),
      ];
      const bk = outline(b, o, 1.2), bp = smooth(bk, true, 1), nw = neckX(b, 0.4);
      const back: Shape[] = [
        S(bk, c), shade(b, o, c, bp),
        line([[-(b.chestW / 2 + 4), -T + 9 * v], [0, -T + 9.6 * v], [b.chestW / 2 + 4, -T + 9 * v]], tone(c, "shade"), 0.5, 0.6),
        line([[0, -T + T * 0.3], [0, hem]], tone(c, "shade"), 0.45, 0.55),
        bandAcross(hx + 3, yw - 1.1 * k, yw + 1.1 * k, tone(c, "shade"), bp, { opacity: 0.4 }),
        // the collar standing behind the neck, then the hood lying on the back
        S([C(-nw - 0.8, -T + 0.6), [-nw - 0.2, -T - hc * 0.6], [-nw + 0.4, -T - hc], [0, -T - hc - 0.2], [nw - 0.4, -T - hc], [nw + 0.2, -T - hc * 0.6], C(nw + 0.8, -T + 0.6), [0, -T + 1.6]], c),
        ...ht.back,
      ];
      const patch: Item = { layer: "outer_sleeve", bone: "arm_l", group: { shapes: [S([C(-0.6, b.upperArmL * 0.26), C(4 * k, b.upperArmL * 0.26), C(4 * k, b.upperArmL * 0.26 + 6 * k), C(-0.6, b.upperArmL * 0.26 + 6 * k)], c),
        line([[-0.2, b.upperArmL * 0.26 + 1.2 * k], [3.6 * k, b.upperArmL * 0.26 + 1.2 * k]], deep, 0.35, 0.55)] } };
      const arms = [...outerSleeves(b, c, 1), ...armPair(tone(c, "shade"), sleeveW(b, 0, 0.84), 0.92, 1)];
      return { front: [{ layer: "body_back", bone: "spine", group: { shapes: ht.front } }, onSpine(front), ...arms, ...(b.build === "toddler" ? [] : [patch])], back: [onSpine(back), ...arms] };
    },
  }),

  // Dilnoza's long coat: calf length, wide lapels, a gentle A-line; the learners' coat outfit
  outer_coat_long: named("outer", "Long coat", "uzun palto", {
    colors: 1, palettes: ["fabric"], defaults: ["fab_19"], patterns: ["pat_kilim_band"], builds: ["adult", "elder", "child"],
    tags: ["formal", "winter", "modest", "smart", "istanbul"], over: ["top", "dress", "bottom"],
    draw(ctx) {
      const b = ctx.body, c = ctx.colors[0] ?? "#B98A57", T = b.torsoL, k = detail(b), v = T / 43, sh = shaping(b), small = b.build === "child" || b.build === "toddler";
      const loose = sh > 0.6 ? 3.2 : 3.6, pad = clamp((b.shoulderW - b.hipW - 7) / 3, 0, 1);
      const o: Cut = { loose, hem: hemAt(b, small ? 1.1 : 1.3), pad, flare: b.hipW / 2 + loose + 4 + 2 * sh }, hem = o.hem, hx = o.flare!;
      const yb = -T * 0.62, ext = 2.4 * k, f = { ext, vee: yb }, under = panel(b, o, 1, f), over = panel(b, o, -1, f), up = smooth(under, true, 1), op = smooth(over, true, 1);
      const lt = facing(c, 1), deep = tone(c, "deep");
      const front: Shape[] = [
        S(under, c), ...printed(ctx, up, { hem }), shade(b, o, c, up), ...flapPocket(hx * 0.5, 1 * v, 10 * k, 1.6 * k, c, 0.22), lapel(b, 1, -ext * 0.6, yb, 6 * k, lt),
        S(over, c), ...printed(ctx, op, { hem }), ...flapPocket(-hx * 0.5, 1 * v, 10 * k, 1.6 * k, c, -0.22), lapel(b, -1, ext * 0.6, yb, 6 * k, lt),
        line([[ext - 2.2 * k, yb + 3], [ext - 2.2 * k, hem - 1]], tone(c, "shade"), 0.4, 0.55),
        ...[0, 1, 2].flatMap(i => button(ext - 1.1 * k, yb + 0.6 + i * 12 * v, 0.62 * k, deep)),
      ];
      const whole = outline(b, o, 1.2), wp = smooth(whole, true, 1), nw = neckX(b), vent = Math.min(25 * v, hem * 0.55);
      const back: Shape[] = [
        S(whole, c), ...printed(ctx, wp, { hem }), shade(b, o, c, wp),
        line([[0, -T + 2.4], [0.3, -T * 0.4], [0, hem - vent]], tone(c, "shade"), 0.45, 0.6),
        { ...flat(smooth([C(0, hem - vent), C(1.6 * k, hem - vent + 0.8), C(1.6 * k, hem), C(0, hem)], true, 1), tone(c, "shade"), 0.5), clip: wp }, line([[0, hem - vent], [0, hem]], deep, 0.4, 0.6),
        line([[-(b.chestW / 2 + loose) * 0.8, -T * 0.32], [(b.chestW / 2 + loose) * 0.8, -T * 0.32]], tone(c, "shade"), 0.35, 0.3),
        S([C(-nw - 1.8, -T + 0.6), [-nw - 0.8, -T - 2.2], [0, -T - 1.9], [nw + 0.8, -T - 2.2], C(nw + 1.8, -T + 0.6), [0, -T + 2.6]], lt),
      ];
      const arms = [...outerSleeves(b, c, 1, stripPrint(ctx)), ...outerCuffs(b, tone(c, "shade"), 0.88, 1)];
      return { front: [onSpine(front), ...arms], back: [onSpine(back), ...arms] };
    },
  }),

  // Parvaneh's bold jacket: a blouson over a rib band, rib collar and cuffs, the zip a little open
  outer_jacket_bomber: named("outer", "Bomber jacket", "bomber ceket", {
    colors: 2, palettes: ["fabric", "fabric"], defaults: ["fab_09"], tags: ["casual", "student", "sport", "istanbul"], over: ["top", "dress"],
    draw(ctx) {
      const b = ctx.body, c = ctx.colors[0] ?? "#4E7A68", rib = second(ctx, c, "shade"), T = b.torsoL, k = detail(b), v = T / 43, sh = shaping(b);
      const loose = (sh > 0.6 ? 3 : 3.4) * ease(b), hem = 8.5, bandH = 3.5 * k, rw = 3 * k, nw = neckX(b, 0.3), sw = b.shoulderW / 2, cw = b.chestW / 2 + loose, bw = b.hipW / 2 + 2.2;
      // the body blouses out over the band: widest at the belly, drawn in to the band's top
      const bulge = Math.max(cw + 0.3, b.waistW / 2 + TOP_WAIST + 1), top = hem - bandH + 0.5;
      const halfB = (s: 1 | -1) => side([C(nw, -T - 0.6), [sw - 1.2, -T + 1.4], C(sw + 0.4, -T + 4.6 * Math.max(v, 0.7)), [cw, -T + 14.5 * v], [bulge, -T * 0.36], [Math.max(bw + 1.4, bulge - 1.2), top - 1.6], C(bw + 0.3, top)], s);
      const yv = -T - 0.6 + 5 * v;
      const body = (back: boolean): Pt[] => [...halfB(-1), [0, top + 0.7], ...halfB(1).reverse(), ...(back ? [[nw * 0.55, -T + 0.2], [0, -T + 0.6], [-nw * 0.55, -T + 0.2]] as Pt[] : [C(0, yv)])];
      const bp = smooth(body(false), true, 1);
      const band = (back: boolean): Shape[] => [S([C(-bw, top - 1), C(bw, top - 1), C(bw, hem), C(-bw, hem)], rib), strokes(tone(rib, "deep"), 0.3, 0.35, [ribPath(-bw, bw, top, hem, 1.1 * k)])];
      // the rib collar: a band up each side of the V and round the neck
      // it edges the opening on the body and stands up beside the neck
      const collar = (s: 1 | -1): Shape[] => {
        const pts = side([C(0.2, yv), C(nw - 0.3, -T - 0.6), [nw - 0.5, -T - 0.6 - rw * 0.75], C(nw + rw * 0.55, -T - 0.6 - rw * 0.6), [nw + rw * 0.95, -T + 0.4], C(0.2 + rw * 0.95, yv + rw * 0.55)], s);
        return [S(pts, rib), { ...line(side([[0.2 + rw * 0.5, yv + rw * 0.3], [nw + rw * 0.35, -T - 0.2], [nw + rw * 0.1, -T - 0.6 - rw * 0.55]] as Pt[], s) as [number, number][], tone(rib, "deep"), 0.3, 0.35) }];
      };
      const slit = (s: 1 | -1): Shape[] => {
        const x0 = s * bw * 0.36, x1 = s * bw * 0.5, y0 = -T * 0.14, y1 = top - 3;
        return [S([C(x0, y0), C(x0 + s * 1.1 * k, y0 - 0.2), C(x1 + s * 1.1 * k, y1 - 0.2), C(x1, y1)], c), line([[x0 + s * 0.45, y0 + 0.2], [x1 + s * 0.45, y1]], tone(c, "deep"), 0.35, 0.55)];
      };
      const front: Shape[] = [
        ...band(false), S(body(false), c), shade(b, { loose, hem: top }, c, bp),
        { ...flat(smooth([[-2.4 * v, -T + 6 * v], [-3.6 * v, -T + 9 * v], [-5.4 * v, -T + 17 * v], [-4.4 * v, -T + 10 * v]], true, 1), tone(c, "light"), 0.35), clip: bp },
        line([[0, yv + 0.6], [0, top]], tone(c, "deep"), 0.45, 0.7), { path: rrect(-0.55 * k, yv + 0.4, 1.1 * k, 2.2 * k, 0.4), fill: tone(rib, "light") },
        ...slit(1), ...slit(-1), ...collar(1), ...collar(-1),
      ];
      const bk = smooth(body(true), true, 1);
      const back: Shape[] = [
        ...band(true), S(body(true), c), shade(b, { loose, hem: top }, c, bk),
        line([[0, -T + 2.6], [0, top]], tone(c, "shade"), 0.45, 0.5),
        S([C(-nw - 0.2, -T - 0.6), [-nw + 0.4, -T - 2.6 * k], [0, -T - 2.4 * k], [nw - 0.4, -T - 2.6 * k], C(nw + 0.2, -T - 0.6), [0, -T + 0.9]], rib),
      ];
      const pocket: Item = { layer: "outer_sleeve", bone: "arm_l", group: { shapes: [S([C(-0.4, b.upperArmL * 0.24), C(3.8, b.upperArmL * 0.24), C(3.8, b.upperArmL * 0.24 + 6.2), C(-0.4, b.upperArmL * 0.24 + 6.2)], c),
        line([[0, b.upperArmL * 0.24 + 1], [3.4, b.upperArmL * 0.24 + 1]], tone(c, "deep"), 0.35, 0.6), { path: rrect(2.6, b.upperArmL * 0.24 + 0.55, 0.8, 1.6, 0.3), fill: tone(rib, "light") }] } };
      const arms = [...outerSleeves(b, c, 0.88), ...armPair(rib, sleeveW(b, 0, 0.8), 0.88, 1)];
      return { front: [onSpine(front), ...arms, ...(b.build === "adult" || b.build === "elder" ? [pocket] : [])], back: [onSpine(back), ...arms] };
    },
  }),

  // Farzad's: a boxy trucker jacket, buttoned with the top button open, a point collar, two chest pockets
  // with pointed button flaps on a yoke seam, pleat seams down to a buttoned waistband, all topstitched
  outer_jacket_denim: named("outer", "Denim jacket", "kot ceket", {
    colors: 1, palettes: ["fabric"], defaults: ["fab_05"], patterns: ["pat_denim"],
    tags: ["casual", "student", "summer", "istanbul"], over: ["top", "dress"],
    draw(ctx) {
      const b = ctx.body, c = ctx.colors[0] ?? "#8DB8DA", T = b.torsoL, k = detail(b), v = T / 43, sh = shaping(b), toddler = b.build === "toddler";
      const o: Cut = { loose: sh > 0.6 ? 2.6 : 3, hem: Math.max(8.5, 9 * v) }, hem = o.hem, bandH = 4 * k, nw = neckX(b);
      const metal = ctx.kit.color("met_silver"), st = tone(c, "light"), deep = tone(c, "deep"), dash = [0.9 * k, 0.6 * k];
      const stitch = (paths: Path[], op = 0.75): Shape => ({ path: many(paths), stroke: { color: st, width: 0.32, dash }, flat: true, opacity: op });
      // the V of the open top button, the yoke across the chest, the pockets on it
      // the pockets sit in from the sides, where the hanging arms leave them in view
      const dip = 7 * v, yv = -T - 0.6 + dip, yoke = -T + 12 * v, cw = b.chestW / 2 + o.loose * ease(b), pw = 8 * k, ph = 7 * k, px = Math.max(pw / 2 + 2.6 * k, cw * 0.36);
      const whole = outline(b, o, dip, true), wp = smooth(whole, true, 1), spots: [number, number][] = [[-px, hem - bandH - 5 * k], [px, hem - bandH - 5 * k]];
      const pocket = (s: 1 | -1): Shape[] => {
        const x = s * px, fh = 3.6 * k;
        return [
          S([C(x - pw / 2, yoke), C(x + pw / 2, yoke), C(x + pw / 2, yoke + ph), C(x - pw / 2, yoke + ph)], c),
          ...(toddler ? [] : [S([C(x - pw / 2 - 0.3, yoke - 0.2), C(x + pw / 2 + 0.3, yoke - 0.2), C(x + pw / 2 + 0.3, yoke + fh * 0.5), C(x, yoke + fh), C(x - pw / 2 - 0.3, yoke + fh * 0.5)], c),
            ...button(x, yoke + fh * 0.62, 0.5 * k, metal)]),
        ];
      };
      // pleat seams either side of each pocket, from under it to the band
      const pleats = [1, -1].flatMap(s => [-1, 1].map(d => smooth([[s * px + d * (pw / 2 - 0.8 * k), yoke + ph], [s * px + d * (pw / 2 - 0.4 * k), hem - bandH]], false, 1)));
      const n = toddler ? 3 : b.build === "child" ? 4 : 5, y0 = yv + 2.4 * k, y1 = hem - bandH - 2 * k;
      const front: Shape[] = [
        S(whole, c), ...printed(ctx, wp, { hem, spots }), shade(b, o, c, wp),
        hemBand(b, o, hem - bandH, tone(c, "shade"), 0.35),
        // the placket's edge and its topstitching, the yoke seam, the pleats and the band's top
        line([[0.9 * k, yv + 0.4], [0.9 * k, hem]], deep, 0.4, 0.55),
        { ...stitch([smooth([[1.7 * k, yv + 1], [1.7 * k, hem - 0.4]], false, 1), smooth([[-sideX(b, o, yoke) + 0.6, yoke], [sideX(b, o, yoke) - 0.6, yoke]], false, 1), ...pleats,
          smooth([[-sideX(b, o, hem - bandH) + 0.6, hem - bandH + 0.5], [sideX(b, o, hem - bandH) - 0.6, hem - bandH + 0.5]], false, 1)]), clip: wp },
        ...pocket(1), ...pocket(-1),
        // the hand pockets' welts at the sides, where the arms leave them in view
        ...(toddler ? [] : [1, -1].map(s => line([[s * (cw - 3.2 * k), yoke + ph + 4 * k], [s * (cw - 2.6 * k), hem - bandH - 1.6 * k]], deep, 0.45, 0.55))),
        ...Array.from({ length: n }, (_, i) => button(0.2, y0 + (y1 - y0) * (i / (n - 1)), 0.62 * k, metal)).flat(),
        ...button(0.2, hem - bandH / 2, 0.62 * k, metal),
        // the point collar: each side from the neck down past the open V to a point out on the chest
        ...([1, -1] as const).map(s => S(side([C(nw - 0.4, -T - 2 * k), C(nw + 5.6 * k, -T + 8.5 * v), [nw + 1.6 * k, -T + 7 * v], C(1.4 * k, yv), [nw * 0.5, -T + 1.4]], s), facing(c, 0.45))),
      ];
      // the collar's band round the back of the neck: behind the body, so it shows beside the neck and the top's neckline stays in view
      const band = S([C(-nw - 0.6, -T + 0.4), [-nw + 0.2, -T - 2.4 * k], [0, -T - 2.2 * k], [nw - 0.2, -T - 2.4 * k], C(nw + 0.6, -T + 0.4), [0, -T + 0.8]], tone(c, "shade"));
      const bk = outline(b, o, 1.2), bp = smooth(bk, true, 1), byoke = -T + 10 * v;
      const back: Shape[] = [
        S(bk, c), ...printed(ctx, bp, { hem, spots }), shade(b, o, c, bp),
        hemBand(b, o, hem - bandH, tone(c, "shade"), 0.35),
        // the pointed back yoke, two seams down to the band, and the band's two buttoned tabs
        { ...stitch([smooth([[-sideX(b, o, byoke) + 0.4, byoke], C(0, byoke + 5 * v), [sideX(b, o, byoke) - 0.4, byoke]], false, 1),
          ...[1, -1].map(s => smooth([[s * cw * 0.42, byoke + 3 * v], [s * cw * 0.46, hem - bandH]], false, 1)),
          smooth([[-sideX(b, o, hem - bandH) + 0.6, hem - bandH + 0.5], [sideX(b, o, hem - bandH) - 0.6, hem - bandH + 0.5]], false, 1)]), clip: bp },
        ...(toddler ? [] : [1, -1].flatMap(s => button(s * cw * 0.72, hem - bandH / 2, 0.5 * k, metal))),
        // the collar lying round the back of the neck
        S([C(-nw - 1.6, -T + 0.8), [-nw - 0.6, -T - 2 * k], [0, -T - 1.8 * k], [nw + 0.6, -T - 2 * k], C(nw + 1.6, -T + 0.8), [0, -T + 2.4]], facing(c, 0.45)),
      ];
      const cuffs = onForearms(b, s => button(s * (b.armW[2] * 0.61 + 0.4), b.foreArmL * 0.9, 0.42 * k, metal));
      const arms = [...outerSleeves(b, c, 0.98), ...outerCuffs(b, tone(c, "shade"), 0.88, 0.98), ...cuffs];
      return { front: [onSpine([band], "body_back"), onSpine(front), ...arms], back: [onSpine(back), ...arms] };
    },
  }),

  // the winter mont: quilted baffles across a big, round silhouette, puffed shoulders and sleeves, a high collar, the zip in colour 2
  outer_jacket_puffer: named("outer", "Puffer jacket", "şişme mont", {
    colors: 2, palettes: ["fabric", "fabric"], defaults: ["fab_23"], tags: ["winter", "casual", "student", "istanbul"], over: ["top", "dress"],
    draw(ctx) {
      const b = ctx.body, c = ctx.colors[0] ?? "#B3261E", zip = second(ctx, c, "light"), T = b.torsoL, k = detail(b), v = T / 43, small = b.build === "child" || b.build === "toddler";
      // a constant loose: a slim body looks puffier, as in life; the hem gathers in under the widest baffle, so the jacket is a round barrel
      const o: Cut = { loose: 6.4, hem: 13 * Math.max(v, 0.75), collar: 0.8, pad: 1.4 * k, flare: b.hipW / 2 + 3 * ease(b), waist: 6, gather: 2.2 }, hem = o.hem, bandH = 3 * k, hc = Math.min(6 * k, b.neckL * 0.9 + 0.8), W = b.chestW / 2 + 10;
      const whole = outline(b, o, 1.6), wp = smooth(whole, true, 1), back = outline(b, o, 1.2), bkp = smooth(back, true, 1);
      const gap = T / (small ? 4 : 6), seams: number[] = [];
      for (let y = -T + 4.5 * v + gap; y < hem - bandH - gap * 0.4; y += gap) seams.push(y);
      // each baffle a tube: shade above its seam, then the seam; one compound path each, so a jacket costs two shapes, not two per baffle
      const sx = seams.map(y => sideX(b, o, y) - 0.5);
      const baffles = (): Shape[] => [
        flat(many(seams.map((y, i) => smooth([C(-sx[i], y - 1.6 * k), [0, y - 0.7], C(sx[i], y - 1.6 * k), C(sx[i], y + 0.2), [0, y + 1.2], C(-sx[i], y + 0.2)], true, 1))), tone(c, "shade"), 0.5),
        strokes(tone(c, "deep"), 0.5, 0.75, seams.map((y, i) => smooth([[-sx[i], y], [0, y + 1.2], [sx[i], y]], false, 1))),
      ];
      const front: Shape[] = [
        S(whole, c), shade(b, o, c, wp), ...baffles(), hemBand(b, o, hem - bandH, tone(c, "shade")),
        strokes(tone(c, "deep"), 0.4, 0.6, [1, -1].map(s => smooth([[s * W * 0.3, -T * 0.2], [s * W * 0.38, hem - bandH - 3]], false, 1))),
        line([[0, -T - hc + 0.8], [0, hem]], zip, 0.55, 0.95),
        ...standCollar(b, c, hc, 0.8), { path: rrect(-0.6 * k, -T - hc + 1, 1.2 * k, 2.4 * k, 0.4), fill: zip },
      ];
      const nw = neckX(b, 0.8);
      const bk: Shape[] = [
        S(back, c), shade(b, o, c, bkp), ...baffles(), hemBand(b, o, hem - bandH, tone(c, "shade")),
        S([C(-nw - 0.4, -T + 0.6), [-nw - 0.2, -T - hc * 0.7], [0, -T - hc + 0.4], [nw + 0.2, -T - hc * 0.7], C(nw + 0.4, -T + 0.6), [0, -T + 1.6]], c),
      ];
      // quilted sleeves, fat as the body: the cloth is the stripe and the seam the gap, so the shoulder starts on a puff, not a seam
      const arms = [...armPair(tone(c, "shade"), sleeveW(b, 4.2 * ease(b)), 0, 0.92, { stripes: [c, 8 * k, 0.86] }), ...armPair(tone(c, "shade"), sleeveW(b, 2 * ease(b), 0.74), 0.92, 1)];
      return { front: [onSpine(front), ...arms], back: [onSpine(bk), ...arms] };
    },
  }),

  // Ömer's yellow raincoat: an A-line with big toggles, the hood down, a reflective band
  outer_coat_kids_rain: named("outer", "Kids' raincoat", "çocuk yağmurluğu", {
    colors: 2, palettes: ["fabric", "fabric"], defaults: ["fab_11"], builds: ["child", "toddler"], tags: ["school", "rain", "casual", "istanbul"], over: ["top", "dress"],
    draw(ctx) {
      const b = ctx.body, c = ctx.colors[0] ?? "#F2B705", c2 = second(ctx, c), T = b.torsoL, k = detail(b), v = T / 43, toddler = b.build === "toddler";
      const loose = 5, hem = Math.max(8.5, hemAt(b, 0.6)), hx = Math.max(b.hipW / 2 + 6, b.chestW / 2 + loose + 2.5 * k), o: Cut = { loose, hem, flare: hx, aline: true };
      const whole = outline(b, o, 1.8), wp = smooth(whole, true, 1), back = outline(b, o, 1.2), bkp = smooth(back, true, 1), ht = hood(b, c, c2);
      const silver = ctx.kit.color("met_silver"), ry = hem - 4.2 * k, tape = (clip: Path) => bandAcross(hx + 2, ry, ry + 1.8 * k, silver, clip, { opacity: 0.9 });
      const pw = 4.2 * k, n = toddler ? 3 : 4, y0 = -T + 4 * v, y1 = ry - 2.4 * k;
      const pocket = (s: 1 | -1): Shape[] => {
        // beside the toggle placket, where the hanging arms leave them in view
        const w = 6 * k, x = s * (pw / 2 + 1 * k + w / 2), top = ry - 1.4 - w;
        return [S([C(x - w / 2, top), C(x + w / 2, top), [x + w / 2, top + w], [x, top + w + 0.4], [x - w / 2, top + w]], c), line([[x - w / 2 + 0.4, top + 1.2], [x + w / 2 - 0.4, top + 1.2]], tone(c, "deep"), 0.35, 0.5)];
      };
      const front: Shape[] = [
        S(whole, c), shade(b, o, c, wp), ...(toddler ? [] : [...pocket(1), ...pocket(-1)]),
        S([C(-pw / 2, -T + 1.4), C(pw / 2, -T + 1.4), C(pw / 2, hem), C(-pw / 2, hem)], c), tape(wp),
        ...Array.from({ length: n }, (_, i) => button(0, y0 + (y1 - y0) * (i / (n - 1)), 0.9 * k, c2)).flat(),
        flat(smooth([[-neckX(b) * 0.9, -T - 0.4], [0, -T + 1.6], [neckX(b) * 0.9, -T - 0.4], [0, -T + 3]], true, 1), tone(c, "shade"), 0.4),
      ];
      const bk: Shape[] = [S(back, c), shade(b, o, c, bkp), line([[0, -T + T * 0.3], [0, hem]], tone(c, "shade"), 0.45, 0.55), tape(bkp), ...ht.back];
      const arms = [...outerSleeves(b, c, 1), ...armPair(tone(c, "shade"), sleeveW(b, 0, 0.85), 0.93, 1)];
      return { front: [{ layer: "body_back", bone: "spine", group: { shapes: ht.front } }, onSpine(front), ...arms], back: [onSpine(bk), ...arms] };
    },
  }),

  // Yusuf's zip hoodie, worn open-necked over a shirt or a tee: the hood down in a soft bunch behind the neck,
  // cords in colour 2, a centre zip, a kangaroo pocket split by it, rib hem and cuffs. Children's cords are
  // short; a toddler's are tied in a knot. The rib band stays at the hips on every shape, so the pocket sits on the belly.
  outer_hoodie_zip: named("outer", "Zip hoodie", "fermuarlı kapüşonlu sweatshirt", {
    colors: 2, palettes: ["fabric", "fabric"], defaults: ["fab_21"], tags: ["casual", "student", "sport", "winter"], over: ["top", "dress"],
    draw(ctx) {
      const b = ctx.body, c = ctx.colors[0] ?? "#9AA0A6", cord = second(ctx, c, "light"), T = b.torsoL, k = detail(b), v = T / 43, e = ease(b);
      const toddler = b.build === "toddler", small = toddler || b.build === "child", rib = tone(c, "shade"), deep = tone(c, "deep");
      const o: Cut = { loose: ctx.avatar.body?.shape === "slim" ? 3 : 3.4, hem: Math.max(8.5, 13 * v), flare: b.hipW / 2 + 3 * e, gather: 8 }, hem = o.hem, bandH = 3 * k;
      const whole = outline(b, o, 2.2), wp = smooth(whole, true, 1), bk = outline(b, o, 1.2), bp = smooth(bk, true, 1), nw = neckX(b);
      const ht = hood(b, c, tone(c, "light"), 7 * b.headH / 50), hr = Math.min(sideX(b, o, hem - bandH), sideX(b, o, hem)) - 0.4, ribs = ribPath(-hr, hr, hem - bandH, hem, 1.4 * k);
      // the hood's two front edges, rolled round the neck and meeting at the top of the zip; the cords come out of them
      const yz = -T + 3.2 * v + 0.4, ew = 2.2 * k;
      const edge = (s: 1 | -1): Shape => S(side([C(nw + 0.4, -T - 0.9), [nw * 0.55, -T + 0.4], C(0.1, yz), C(0.1, yz + ew * 0.7), [nw * 0.5 + ew * 0.4, -T + 0.4 + ew], C(nw + ew * 0.9, -T + 0.4)], s), c);
      // the cords: 12 cm on an adult, 8 on a child; a toddler's 5 cm and tied
      const len = toddler ? 5 : small ? 8 : 12, cx = 1.7 * k, cy = yz + ew * 0.35, cw = 0.5 * k;
      const cords: Shape[] = toddler
        ? [line([[-cx, cy], [-cx * 0.5, cy + len * 0.6], [0, cy + len * 0.75]], cord, cw * 2, 1), line([[cx, cy], [cx * 0.5, cy + len * 0.6], [0, cy + len * 0.75]], cord, cw * 2, 1),
          { path: ellipse(0, cy + len * 0.78, 0.8 * k, 0.65 * k), fill: cord }, line([[0, cy + len * 0.8], [-0.5 * k, cy + len]], cord, cw * 2, 1), line([[0, cy + len * 0.8], [0.6 * k, cy + len * 0.97]], cord, cw * 2, 1)]
        : [-1, 1].flatMap(s => [line([[s * cx, cy], [s * cx * 1.25, cy + len * 0.5], [s * cx * 1.15, cy + len]], cord, cw * 2, 1), { path: rrect(s * cx * 1.15 - 0.4 * k, cy + len - 0.2, 0.8 * k, 1.8 * k, 0.35 * k), fill: tone(cord, "deep") } as Shape]);
      // the kangaroo pocket over the belly: a trapezoid, its hand slots the slanted sides, the zip running through it
      const pbot = hem - bandH - 0.8, pb = Math.min(hr - 2.4 * k, Math.max(b.hipW, b.waistW) * 0.36), pt = pb * 0.64, py = Math.max(-T * 0.36, pbot - 16 * k * Math.max(v, 0.7)), pk = (pbot - py) * 0.32;
      const pocket: Pt[] = [C(-pt, py), C(pt, py), C(pb, py + pk), C(pb, pbot), C(-pb, pbot), C(-pb, py + pk)];
      const front: Shape[] = [
        S(whole, c), shade(b, o, c, wp),
        hemBand(b, o, hem - bandH, rib, 0.55), strokes(deep, 0.3, 0.35, [ribs]),
        S(pocket, c), line([[pt, py], [pb, py + pk]], deep, 0.8 * k, 0.65), line([[-pt, py], [-pb, py + pk]], deep, 0.8 * k, 0.65),
        flat(smooth([C(-pb + 0.3, pbot - 1.4 * k), C(pb - 0.3, pbot - 1.4 * k), C(pb - 0.3, pbot - 0.2), C(-pb + 0.3, pbot - 0.2)], true, 1), rib, 0.35),
        line([[0, yz + 0.2], [0, hem - 0.1]], deep, 0.45 * k, 0.75),
        edge(1), edge(-1),
        { path: rrect(-0.55 * k, yz + 0.8 * k, 1.1 * k, 2.2 * k, 0.45 * k), fill: ctx.kit.color("met_silver") },
        ...cords,
      ];
      const back: Shape[] = [
        S(bk, c), shade(b, o, c, bp),
        hemBand(b, o, hem - bandH, rib, 0.55), strokes(deep, 0.3, 0.35, [ribs]),
        ...ht.back,
      ];
      const arms = [...outerSleeves(b, c, 0.9), ...armPair(rib, sleeveW(b, 0, 0.84), 0.9, 1)];
      return { front: [{ layer: "body_back", bone: "spine", group: { shapes: ht.front } }, onSpine(front), ...arms], back: [onSpine(back), ...arms] };
    },
  }),

  // the abaya: a long, loose robe falling from the shoulders, wide sleeves, a trim down the front
  outer_abaya: named("outer", "Abaya", "abaya", {
    colors: 2, palettes: ["fabric", "fabric"], defaults: ["fab_22"], patterns: ["pat_kilim_band"], builds: ["adult", "elder", "child"],
    tags: ["modest", "religious", "traditional", "formal", "festival"], over: ["top", "dress", "bottom"],
    draw(ctx) {
      const b = ctx.body, c = ctx.colors[0] ?? "#26272C", trim = second(ctx, c, "light"), T = b.torsoL, k = detail(b);
      // the A-line hides the body's shape: every build is dressed alike and nothing is revealed
      const hem = floorHem(b), hx = b.hipW / 2 + 10, o: Cut = { loose: 4, hem, flare: hx, aline: true };
      const whole = outline(b, o, 2.4), wp = smooth(whole, true, 1), back = outline(b, o, 1.2), bkp = smooth(back, true, 1), tw = 4 * k;
      // long folds from the hip to the hem, where the cloth falls free
      const folds = (clip: Path): Shape[] => [0.32, 0.62].flatMap(f => [1, -1].map(s => ({ ...line([[s * hx * f * 0.7, 2], [s * hx * f * 0.85, hem * 0.55], [s * hx * f, hem - 0.6]], tone(c, s > 0 ? "deep" : "shade"), 0.5, 0.5), clip })));
      const front: Shape[] = [
        S(whole, c), ...printed(ctx, wp, { hem }), shade(b, o, c, wp, 4), ...folds(wp),
        S([C(-tw / 2, -T + 1.2), C(tw / 2, -T + 1.2), C(tw / 2, hem), C(-tw / 2, hem)], trim),
        flat(smooth([[-neckX(b), -T - 0.6], [0, -T + 1.8], [neckX(b), -T - 0.6], [neckX(b) * 0.7, -T + 0.6], [0, -T + 3], [-neckX(b) * 0.7, -T + 0.6]], true, 1), trim, 0.85),
      ];
      const bk: Shape[] = [S(back, c), ...printed(ctx, bkp, { hem }), shade(b, o, c, bkp, 4), ...folds(bkp), line([[0, -T + 2], [0, hem]], tone(c, "shade"), 0.45, 0.6)];
      const bell: [number, number, number] = [b.armW[0] * 1.3 + 4, b.armW[1] * 1.4 + 6, b.armW[2] * 1.8 + 9];
      const arms = [...armPair(c, bell, 0, 1, stripPrint(ctx)), ...armPair(trim, [bell[0] + 0.4, bell[1] + 0.6, bell[2] + 0.8], 0.88, 1)];
      return { front: [onSpine(front), ...arms], back: [onSpine(bk), ...arms] };
    },
  }),
};
