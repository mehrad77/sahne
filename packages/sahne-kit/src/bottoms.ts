// Bottoms (`outfit.bottom`): trousers, jeans, shorts, joggers, skirts, şalvar. A bottom draws its
// seat or skirt on the hips bone (layer `hips`: the waist at y -6, the hip joints at 0) and trouser
// legs as strips on the leg chains (layer `trouser`, under the shoes; suit trousers put theirs on
// `trouser_hem`, over the shoe, so the hem breaks on it).
//
// A strip is one flat colour (or crosswise stripes), so what else a leg wears is a group on its
// thigh and shin bones, drawn right after the strip in the strip's layer (`legItems`): a print that
// does not reach strips (cut to the leg inside its rim, in the seat's phase, so checks run on from
// the seat), the shade down the side away from the light, creases, cuffs, a side stripe. They bend
// at the knee with the strip. Everything above y +6 on the seat lies under any top's hem: what
// tells two bottoms apart at 48 px is on the legs (the cut, a crease, a cuff, a stripe, a fade).
// The back view is mirrored by the renderer, so a shade that sits at +x in front sits at -x behind.
//
// THE LOWER ARTIST'S FILE (with dresses.ts): add parts to `BOTTOMS` (ids `bottom_*`, permanent).
// Shared helpers are in draw/ (`trouserWidths`, `skirtOutline`, `hemAt`, `floorHem`, `printed` and
// `stripPrint`); the leg and seat helpers below are this file's (dresses.ts uses them too). Long
// skirts and şalvar are `modest`.

import { smooth, poly, rect, rrect, ellipse, tone, mix, luma, Path, type BodyDims, type Group, type Item, type PartCtx, type PartDef, type PartOut, type Shape, type StripSpec, type Vec2 } from "sahne";
import { named, S, line, printed, stripPrint, inksOf, trouserWidths, PATTERNS, type Pt } from "./draw/index.ts";

export type W3 = [number, number, number];
export type Side = 1 | -1;
export type View = "front" | "back";
type Bone = "thigh" | "shin";

// ---- the leg's geometry ----------------------------------------------------------------------------

/** Small details scale with the build (pockets, loops, stitching): a child's 0.7, a toddler's 0.6. */
export const det = (b: BodyDims): number => (b.build === "toddler" ? 0.6 : b.build === "child" ? 0.7 : 1);

/** How far below the hip joints a seat reaches at the crotch: 0.4 of the thigh (an adult's 15 cm, a toddler's 6). */
export const crotch = (b: BodyDims): number => b.thighL * 0.4;

/** The x of the hip joints: the thigh bones' pivots and the leg strips' centres at the top. */
export const hipX = (b: BodyDims): number => b.hipW / 2 - b.legW[0] / 2;

/** The side of a piece away from the light: +x in front; behind, the mirrored back puts it at -x. */
export const away = (view: View): Side => (view === "front" ? 1 : -1);

/**
 * How far below the hip joint a leg strip's `t` lies on a straight leg: a strip runs along a
 * Bézier through hip, knee and ankle, so the knee is t = 0.5 and the ankle 1.
 */
export function legAt(b: BodyDims, t: number): number {
  const L = b.thighL + b.shinL, C = 2 * b.thighL - L / 2;
  return 2 * C * t + (L - 2 * C) * t * t;
}

/** The `t` of a leg strip at `y` cm below the hip joint (the inverse of `legAt`). */
export function legT(b: BodyDims, y: number): number {
  const L = b.thighL + b.shinL, C = 2 * b.thighL - L / 2, a = L - 2 * C;
  return Math.abs(a) < 1e-6 ? y / (2 * C) : (-2 * C + Math.sqrt(Math.max(0, 4 * C * C + 4 * a * y))) / (2 * a);
}

/** A leg strip's width at `t`: linear to the knee, then on to the ankle, as the strip is drawn. */
export const widthAt = (w: W3, t: number): number => (t < 0.5 ? w[0] + (w[1] - w[0]) * t * 2 : w[1] + (w[2] - w[1]) * (t - 0.5) * 2);

/**
 * A leg strip from `t0` to `t1` as an outline in its thigh's space (`t` up to 0.5: the pivot at the
 * hip joint) or its shin's (the pivot at the knee), the leg's centre line at x = 0. `x0` … `x1` are
 * fractions of the half width (-1 … 1, so a band along one side), of `scale` of the width: 0.8
 * keeps a print inside the strip's lighter rim.
 */
export function legBand(b: BodyDims, w: W3, t0: number, t1: number, bone: Bone, x0 = -1, x1 = 1, scale = 0.8, n = 6): Vec2[] {
  const y0 = bone === "thigh" ? 0 : b.thighL, L: Vec2[] = [], R: Vec2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = t0 + (t1 - t0) * i / n, y = legAt(b, t) - y0, h = widthAt(w, t) / 2 * scale;
    L.push([h * x0, y]); R.push([h * x1, y]);
  }
  return [...L, ...R.reverse()];
}

/** A y on the hips bone in a leg piece's space. */
export const onBone = (b: BodyDims, bone: Bone, y: number): number => y - (bone === "shin" ? b.thighL : 0);

/**
 * The shade on the side away from the light, as a shape's fill and opacity. On a plain cloth it is
 * the cloth's shade at `op`; over a print the pale ground's shade would lighten the inks into a milky
 * panel, so it is the darker of the ground's and the first ink's deep tone, at a lower opacity: it
 * darkens the print as a shadow does.
 */
export function shadeOf(ctx: PartCtx, c: string, op: number, plain = false): { fill: string; flat: true; opacity: number } {
  if (plain || !ctx.pattern) return { fill: tone(c, "shade"), flat: true, opacity: op };
  const [ink] = inksOf(ctx.pattern, c, ctx.inks), d1 = tone(c, "deep"), d2 = tone(tone(ink, "deep"), "deep");
  return { fill: luma(d1) < luma(d2) ? d1 : d2, flat: true, opacity: op * 0.32 };
}

/** What a part draws on one leg piece, over its print and shade: `s` 1 is the left leg (+x). */
export type LegDraw = (s: Side, bone: Bone, view: View) => Shape[];

export interface LegCut {
  w: W3;
  /** How far down the leg the strip reaches (0.97 to the shoe). */
  to: number;
  layer?: "trouser" | "trouser_hem";
  caps?: StripSpec["caps"];
  /** The bottom edge on the hips bone, where the print counts its rows from (default the strip's end). */
  hem?: number;
  /** Leave the leg plain: no stripes on the strips, no print on the pieces (a shalwar under a printed kameez). */
  plain?: boolean;
  /** Cover the strip's light rim to this fraction of its width with the ground (a very full leg, whose rim would read as a pale band); not under stripes, which the strip itself carries. */
  core?: number;
  draw?: LegDraw;
}

/**
 * A bottom's legs: per leg the strip, then the groups on its thigh and shin in the same layer: the
 * print when the pattern does not reach strips, the shade down the side away from the light, and
 * whatever `draw` adds. The print is laid out from the body's centre line and the hem, as the
 * seat's is, so a check runs on from the seat down the leg.
 */
export function legItems(ctx: PartCtx, c: string, cut: LegCut, view: View): Item[] {
  const b = ctx.body, layer = cut.layer ?? "trouser", hem = cut.hem ?? legAt(b, cut.to), hx = hipX(b), sh = shadeOf(ctx, c, 0.3, cut.plain), a = away(view);
  const pat = cut.plain ? null : ctx.pattern, overlay = !!pat && PATTERNS[pat]?.strips !== "stripes", core = overlay || !pat ? cut.core : undefined;
  const out: Item[] = [];
  for (const s of [1, -1] as const) {
    out.push({ layer, bone: "hips", strip: { chain: s === 1 ? "leg_l" : "leg_r", widths: cut.w, color: c, from: 0, to: cut.to, ...(cut.caps ? { caps: cut.caps } : {}), ...(cut.plain ? {} : stripPrint(ctx)) } });
    for (const bone of ["thigh", "shin"] as const) {
      const t0 = bone === "thigh" ? 0 : 0.5, t1 = bone === "thigh" ? Math.min(cut.to, 0.5) : cut.to;
      if (t1 <= t0) continue;
      const shapes: Shape[] = core ? [{ path: poly(legBand(b, cut.w, t0, bone === "thigh" ? Math.min(cut.to, 0.53) : t1, bone, -1, 1, core)), fill: c, flat: true }] : [];
      // the print: over the strip's rim at half strength (as its stripes are), whole inside it; the
      // thigh's runs a little past the knee, so a bent knee shows no seam
      if (overlay) {
        const p1 = bone === "thigh" ? Math.min(cut.to, 0.53) : t1, o = { hem: onBone(b, bone, hem), cx: -s * hx };
        shapes.push(...printed(ctx, poly(legBand(b, cut.w, t0, p1, bone, -1, 1, 1)), o).map(p => ({ ...p, opacity: 0.5 })), ...printed(ctx, poly(legBand(b, cut.w, t0, p1, bone)), o));
      }
      shapes.push({ path: poly(legBand(b, cut.w, t0, t1, bone, a > 0 ? 0.36 : -0.86, a > 0 ? 0.86 : -0.36)), ...sh });
      shapes.push(...(cut.draw?.(s, bone, view) ?? []));
      out.push({ layer, bone: `${bone}_${s === 1 ? "l" : "r"}`, group: { shapes } });
    }
  }
  return out;
}

// ---- the seat ---------------------------------------------------------------------------------------

export interface SeatCut {
  /** The leg strips' widths: the seat meets their outer edges. */
  w: W3;
  /** Extra width over the hips, each side (a full cut). */
  ease?: number;
  /** How far below the hip joints it reaches at the crotch (default `crotch(b)`). */
  drop?: number;
}

/** Where a seat's outline goes: the waist's and hips' half widths, where it meets the legs, the crotch. */
export function seatGeo(b: BodyDims, o: SeatCut) {
  const hx = hipX(b), d = o.drop ?? crotch(b), ww = b.waistW / 2 + 1;
  const hip = Math.max(b.hipW / 2 + 1.6, hx + o.w[0] / 2) + (o.ease ?? 0), low = hx + widthAt(o.w, legT(b, d * 0.86)) / 2 - 0.1;
  return { hx, d, ww, hip, low, notch: d * 0.17, k: det(b) };
}

/** A trouser seat on the hips bone: the waist at y -6, out over the hips to the legs' outer edges, and the crotch between them (a notch up the centre seam). */
export function seatOutline(b: BodyDims, o: SeatCut): Pt[] {
  const { d, ww, hip, low, notch } = seatGeo(b, o), inner = b.legW[0] * 0.1;
  return [[-ww, -6, 0], [ww, -6, 0], [hip, d * 0.25], [low, d * 0.86, 0], [inner, d, 0], [0, d - notch], [-inner, d, 0], [-low, d * 0.86, 0], [-hip, d * 0.25]];
}

/** Stitching as short flat dashes along a polyline (the still backend draws no `stroke.dash`): one shape, a dash of `on` cm every `on + off`. */
export function stitch(pts: Vec2[], c: string, w = 0.3, on = 0.8, off = 0.55, op = 0.85): Shape {
  const p = new Path();
  let carry = 0, draw = true;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], len = Math.hypot(x1 - x0, y1 - y0);
    let at = 0;
    while (at < len) {
      const step = Math.min((draw ? on : off) - carry, len - at), a = at / len, z = (at + step) / len;
      if (draw) p.moveTo(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a).lineTo(x0 + (x1 - x0) * z, y0 + (y1 - y0) * z);
      at += step; carry += step;
      if (carry >= (draw ? on : off) - 1e-9) { carry = 0; draw = !draw; }
    }
  }
  return { path: p, stroke: { color: c, width: w }, flat: true, opacity: op };
}

/** Points along a quadratic curve (for stitching that bends). */
export const curve = (a: Vec2, c: Vec2, z: Vec2, n = 8): Vec2[] =>
  Array.from({ length: n + 1 }, (_, i) => { const t = i / n, u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * z[0], u * u * a[1] + 2 * u * t * c[1] + t * t * z[1]] as Vec2; });

/** A gathered waistband: the band, and short creases across it every 1.6 cm. */
function elasticBand(ww: number, c: string, h: number): Shape[] {
  const out: Shape[] = [{ path: rrect(-ww, -6, ww * 2, h, 0.8), fill: tone(c, "shade"), flat: true, opacity: 0.45 }], deep = tone(c, "deep");
  const n = Math.max(4, Math.round(ww * 2 / 1.6));
  const p = new Path();
  for (let i = 1; i < n; i++) { const x = -ww + ww * 2 * i / n; p.moveTo(x, -5.6).lineTo(x + 0.15, -6 + h - 0.4); }
  out.push({ path: p, stroke: { color: deep, width: 0.28 }, flat: true, opacity: 0.4 });
  return out;
}

/**
 * The cloth of a full leg gathered into a cuff (a shape on the shin over the strip's end): it pouches
 * over the cuff's top edge `y0`, `wl` the leg's half width there, `h` the cuff's, `rise` how far up
 * it starts. Returns the shape and its outline (to print it or cut a stripe to it).
 */
function gathered(c: string, y0: number, wl: number, h: number, rise: number): [Shape, Path] {
  const pts: Pt[] = [[-wl * 0.98, y0 - rise], [wl * 0.98, y0 - rise], [wl + 0.6, y0 - rise * 0.32], [h * 0.8, y0 + rise * 0.22], [0, y0 + rise * 0.3], [-h * 0.8, y0 + rise * 0.22], [-wl - 0.6, y0 - rise * 0.32]];
  return [S(pts, c), smooth(pts, true, 1)];
}

export interface TrouserCut extends LegCut {
  /** The waistband's height (round bodies get 1.5 cm more). */
  band?: number;
  /** A gathered waist with no fly (a toddler's always is). */
  elastic?: boolean;
  ease?: number;
  drop?: number;
  /** Details on the seat, over its print (`front` true in front). */
  seat?: (g: ReturnType<typeof seatGeo>, view: View, path: Path) => Shape[];
}

/** A pair of trousers: the seat (front with a fly unless elastic), the legs, and the part's own details. */
export function trousers(ctx: PartCtx, c: string, cut: TrouserCut): PartOut {
  const b = ctx.body, hem = cut.hem ?? legAt(b, cut.to), elastic = cut.elastic || b.build === "toddler", geo = seatGeo(b, cut), sh = tone(c, "shade");
  const band = (cut.band ?? 2.6) + (b.waistW >= b.hipW ? 1.5 : 0);
  const seat = (view: View): Group => {
    const out = seatOutline(b, cut), path = smooth(out, true, 1), a = away(view);
    const shapes: Shape[] = [S(out, c), ...printed(ctx, path, { hem }),
      { path: rect(a > 0 ? geo.hip * 0.42 : -geo.hip * 1.2, -7, geo.hip * 0.78, geo.d + 8), ...shadeOf(ctx, c, 0.32), clip: path }];
    if (elastic) shapes.push(...elasticBand(geo.ww, c, band));
    else {
      shapes.push({ path: rrect(-geo.ww, -6, geo.ww * 2, band, 0.8), fill: sh, flat: true, opacity: 0.5 });
      if (view === "front") shapes.push(line([[0.8, -6 + band], [0.9, geo.d * 0.58], [0, geo.d - geo.notch - 0.4]], tone(c, "deep"), 0.55, 0.6));
      else shapes.push(line([[0, -6 + band], [0, geo.d - geo.notch - 0.4]], tone(c, "deep"), 0.45, 0.45));
    }
    shapes.push(...(cut.seat?.(geo, view, path) ?? []));
    return { shapes };
  };
  return {
    front: [{ layer: "hips", bone: "hips", group: seat("front") }, ...legItems(ctx, c, { ...cut, hem }, "front")],
    back: [{ layer: "hips", bone: "hips", group: seat("back") }, ...legItems(ctx, c, { ...cut, hem }, "back")],
  };
}

/** The creases behind a knee (the back view): three short soft curves across the top of the shin. */
const kneeBack = (b: BodyDims, w: W3, c: string): Shape[] => {
  const h = widthAt(w, 0.5) / 2, k = det(b);
  return [0.6, 2, 3.5].map((y, i) => line([[-h * (0.55 - i * 0.08), y * k], [0, (y + 0.9) * k], [h * (0.5 - i * 0.08), (y - 0.2) * k]], tone(c, "deep"), 0.45, 0.35));
};

/** A hem's stitching across a leg, `up` cm above the strip's end. */
const hemLine = (b: BodyDims, w: W3, to: number, up: number, c: string, dashed = false): Shape => {
  const y = legAt(b, to) - b.thighL - up, h = widthAt(w, legT(b, legAt(b, to) - up)) / 2 * 0.86, pts: Vec2[] = [[-h, y], [h, y + 0.15]];
  return dashed ? stitch(pts, c, 0.3, 0.7, 0.5, 0.8) : line(pts, c, 0.4, 0.55);
};

/** The patterns a trouser or skirt can wear (every print but the denim fades and the border). */
const ALL_OVER = ["pat_stripe_h", "pat_check", "pat_gingham", "pat_dots", "pat_floral", "pat_iznik_tulip"];

// ---- skirts --------------------------------------------------------------------------------------------

export interface SkirtCut {
  /** The hem's y on the hips bone. */
  hem: number;
  /** How far past the hips the hem flares, each side (cm). */
  flare: number;
  /** The top's y and half width (a skirt from the waistband at y -6, a dress's from its seam). */
  top?: number;
  topW?: number;
  /** Width over the hips, each side, past the hip (cm). */
  ease?: number;
  /** A vent up the centre back (cm), as a notch the legs show through. */
  vent?: number;
}

/** A skirt's outline on the hips bone: from its top over the hips, flaring to a hem that dips a little at the front. */
export function skirtShape(b: BodyDims, o: SkirtCut, view: View = "front"): Pt[] {
  const W = Math.max(b.hipW, b.waistW), tw = o.topW ?? b.waistW / 2 + 1.2, top = o.top ?? -6, hw = W / 2 + o.flare, hip = W / 2 + (o.ease ?? 2), y = o.hem;
  const vent = view === "back" && o.vent ? o.vent : 0;
  const hem: Pt[] = vent > 0 ? [[hw * 0.5, y + 0.6], [1.3, y + 0.2, 0], [0, y - vent, 0], [-1.3, y + 0.2, 0], [-hw * 0.5, y + 0.6]] : [[hw * 0.5, y + 0.6], [0, y + (view === "front" ? 0.2 : 0.6)], [-hw * 0.5, y + 0.6]];
  return [[-tw, top, 0], [tw, top, 0], [hip, Math.max(top + 4, 6)], [hw, y - 1, 0], ...hem, [-hw, y - 1, 0], [-hip, Math.max(top + 4, 6)]];
}

/**
 * A skirt piece: its ground, print, the shade down the side away from the light and soft folds
 * fanning to the hem; `extra` adds the part's own details over them (a hem band, a vent's seam).
 */
export function skirtGroup(ctx: PartCtx, c: string, o: SkirtCut, view: View, folds = 2, extra: (path: Path, hw: number) => Shape[] = () => []): Group {
  const b = ctx.body, out = skirtShape(b, o, view), path = smooth(out, true, 1), W = Math.max(b.hipW, b.waistW), hw = W / 2 + o.flare, a = away(view), y = o.hem;
  const top = Math.max((o.top ?? -6) + 4, 6);
  const shapes: Shape[] = [S(out, c), ...printed(ctx, path, { hem: y }),
    // the side away from the light, wider at the hem
    { path: poly([[a * W * 0.28, top], [a * (W / 2 + 3), top], [a * (hw + 2), y + 2], [a * hw * 0.5, y + 2]]), ...shadeOf(ctx, c, 0.4), clip: path }];
  // folds from the hips to the hem, spread with the body; behind, only the two at the sides
  const n = view === "front" ? folds : Math.min(folds, 2);
  for (let i = 0; i < n; i++) {
    const f = n === 1 ? 0 : (i / (n - 1)) * 2 - 1, x0 = f * W * 0.2 + W * 0.04, x1 = f * hw * 0.62 + hw * 0.06;
    shapes.push(line([[x0, top + 2], [x0 + (x1 - x0) * 0.45, (top + y) / 2], [x1, y - 1.4]], tone(c, "deep"), 0.7, 0.3));
  }
  shapes.push(...extra(path, hw));
  return { shapes };
}

/** A lighter band along a hem, cut to the skirt: a turned hem's stitching shows as a line above it. */
const hemBand = (path: Path, c: string, y: number, h: number): Shape[] => [
  { path: rect(-200, y - h, 400, h + 3), fill: tone(c, "light"), flat: true, opacity: 0.5, clip: path },
  { path: rect(-200, y - h - 0.25, 400, 0.25), fill: tone(c, "shade"), flat: true, opacity: 0.5, clip: path },
];

/** A pair of jeans' cut: the legs, the knee (`light` a worn patch, `stretch` two tight wrinkles, `slack` loose folds), the back pockets' size and depth, the hem's stitching and a worn hem. */
interface DenimCut { w: W3; to: number; layer?: "trouser" | "trouser_hem"; knee: "light" | "stretch" | "slack"; hemUp: number; pocket?: number; low?: number; worn?: boolean }

/** Jeans: topstitching (the fly's J, the pockets' curves, the outer seams), the yoke and patch pockets behind; the washed print fades the seat and the thighs. */
function denim(ctx: PartCtx, c: string, o: DenimCut): PartOut {
  const b = ctx.body, { w, to } = o, st = tone(c, "light"), k = det(b);
  const washed = ctx.pattern === "pat_denim", [ink] = inksOf("pat_denim", c, ctx.inks), mid = mix(c, ink, 0.5);
  // the fades of the washed print, cut to a leg piece (in the piece's space)
  const fade = (outline: Vec2[], x: number, y: number, rx: number, ry: number): Shape[] => {
    const clip = poly(outline);
    return [{ path: ellipse(x, y, rx, ry), fill: mid, flat: true, clip }, { path: ellipse(x - rx * 0.12, y - ry * 0.1, rx * 0.55, ry * 0.6), fill: ink, flat: true, clip }];
  };
  const knee = (view: View): Shape[] => {
    const h = widthAt(w, 0.5) / 2;
    if (o.knee === "light") return [{ path: ellipse(0, 1.2 * k, widthAt(w, 0.5) * 0.24, 3.2 * k), fill: st, flat: true, opacity: view === "front" ? 0.22 : 0.12 }];
    if (view === "back") return [];
    // stretch: two short wrinkles pulled across the knee; slack: two long soft folds falling across it
    return o.knee === "stretch"
      ? [-1.4, 1.1].map((y, i) => line([[-h * 0.62, y * k], [-h * 0.1, (y + 0.7) * k], [h * 0.55, (y - 0.1 - i * 0.3) * k]], tone(c, "shade"), 0.55, 0.25))
      : [line([[-h * 0.6, -4.5 * k], [-h * 0.1, -2.6 * k], [h * 0.45, -0.4 * k]], tone(c, "deep"), 0.55, 0.28), line([[-h * 0.45, 0.6 * k], [h * 0.05, 2.2 * k], [h * 0.6, 4.6 * k]], tone(c, "deep"), 0.5, 0.22)];
  };
  // a worn hem: a paler band frayed along the bottom edge
  const worn = (): Shape[] => {
    const y = legAt(b, to) - b.thighL, h = widthAt(w, to) / 2, outline = legBand(b, w, 0.5, to, "shin", -1, 1, 1);
    return [{ path: rect(-h - 1, y - 1.1 * k, h * 2 + 2, 1.2 * k), fill: st, flat: true, opacity: 0.4, clip: poly(outline) }];
  };
  return trousers(ctx, c, { w, to, layer: o.layer, seat: (g, view) => {
    const out: Shape[] = [];
    if (washed) out.push(...printed(ctx, smooth(seatOutline(b, { w }), true, 1), { hem: legAt(b, to), spots: [[-b.hipW * 0.24, view === "front" ? g.d * 0.54 : g.d * 0.4], [b.hipW * 0.24, view === "front" ? g.d * 0.54 : g.d * 0.4]] }));
    if (view === "front") {
      // the fly's J and the front pockets' curves
      out.push(stitch([[2.6 * k, -6 + 2.6], [2.6 * k, g.d * 0.45], ...curve([2.6 * k, g.d * 0.45], [2.6 * k, g.d * 0.62], [0.4, g.d * 0.64], 4).slice(1)], st));
      for (const s of [-1, 1]) out.push(stitch(curve([s * g.ww * 0.82, -6 + 2.6], [s * g.ww * 0.82, g.d * 0.06], [s * (g.hip - 0.5), g.d * 0.12]), st));
    } else {
      // the yoke's V and two patch pockets, their points just above the crotch
      out.push(stitch([[-g.ww, -1.5 * k], [0, 1.2 * k], [g.ww, -1.5 * k]], st));
      for (const s of [-1, 1]) {
        const x = s * b.hipW * 0.22, pw = b.hipW * (o.pocket ?? 0.15), top = 0.8 * k, bot = g.d * (o.low ?? 0.8), P: Vec2[] = [[x - pw, top], [x + pw, top], [x + pw * 0.9, bot - 2.2 * k], [x, bot], [x - pw * 0.9, bot - 2.2 * k]];
        out.push({ path: poly(P), fill: tone(c, "shade"), flat: true, opacity: 0.22 }, stitch([...P, P[0]], st));
      }
    }
    return out;
  }, draw: (s, bone, view) => {
    const out: Shape[] = [];
    if (bone === "thigh") {
      if (washed) out.push(...fade(legBand(b, w, 0, 0.5, "thigh"), view === "front" ? -s * 0.6 : 0, view === "front" ? b.thighL * 0.5 : crotch(b) * 1.15, widthAt(w, 0.25) * 0.24, b.thighL * (view === "front" ? 0.26 : 0.16)));
      // the outer seam's topstitching down the side
      out.push(stitch(legBand(b, w, 0.12, 0.5, "thigh", 0, 0.92, 1, 3).slice(4).reverse().map(([x, y]) => [s * x, y] as Vec2), st, 0.28, 0.7, 0.5, 0.6));
    } else {
      out.push(...knee(view));
      if (washed && view === "front") out.push(...fade(legBand(b, w, 0.5, to, "shin"), 0, 1.4 * k, widthAt(w, 0.5) * 0.22, 4 * k));
      if (view === "back") out.push(...kneeBack(b, w, c));
      out.push(stitch(legBand(b, w, 0.5, to, "shin", 0, 0.92, 1, 3).slice(4).reverse().map(([x, y]) => [s * x, y] as Vec2), st, 0.28, 0.7, 0.5, 0.6));
      if (o.worn) out.push(...worn());
      out.push(hemLine(b, w, to, o.hemUp * k, st, true));
    }
    return out;
  } });
}

/**
 * Wide legs held apart: the knee and the ankle no wider than lets the two legs overlap by `most`
 * of a leg's width in front (they hang 2 × hipX apart), so the pair still reads as trousers, not
 * a culotte; the top no wider than the seat may be beside a top.
 */
const clampLegs = (b: BodyDims, w: W3, most: number): W3 => {
  const max = (2 * hipX(b)) / (1 - most);
  // at the top no wider than a top's hem covers (hipW / 2 + 2.4 each side), so the seat never shows beside it
  return [Math.min(w[0], b.legW[0] + 4.6), Math.min(w[1], max), Math.min(w[2], max)];
};

/** The prints a woven trouser or skirt of the second batch takes, as the plan lists them; the ones not drawn yet are left out until they are. */
const WOVEN = ["pat_stripe_h", "pat_stripe_v", "pat_breton", "pat_dots", "pat_check", "pat_gingham", "pat_pinstripe", "pat_floral", "pat_tartan", "pat_dots_small", "pat_houndstooth", "pat_paisley", "pat_iznik_tulip", "pat_herringbone", "pat_ditsy", "pat_ikat", "pat_stars", "pat_wax_print", "pat_batik"];
const drawn = (ids: string[]): string[] => ids.filter(id => Object.hasOwn(PATTERNS, id));


// ---- the parts --------------------------------------------------------------------------------------------

export const BOTTOMS: Record<string, PartDef> = {
  // plain everyday trousers: a straight leg, a soft fold at the knee and the hem's stitching
  bottom_trousers: named("bottom", "Trousers", "pantolon", { colors: 1, defaults: ["fab_24"], tags: ["casual", "work", "school"], patterns: ALL_OVER, draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#3A3D45", w = trouserWidths(b), to = 0.97, deep = tone(c, "deep"), k = det(b);
    return trousers(ctx, c, { w, to, seat: (g, view) => view === "front"
      // slanted pockets, and two welts behind
      ? [-1, 1].map(s => line([[s * g.ww * 0.72, -6 + 2.6], [s * (g.hip - 1.2), g.d * 0.3]], deep, 0.45, 0.5))
      : [-1, 1].map(s => line([[s * g.ww * 0.2, -0.5 * k], [s * g.ww * 0.62, -0.5 * k]], deep, 0.55, 0.55)),
    draw: (s, bone, view) => bone === "thigh"
      ? view === "front" ? [line([[-1.6 * k, b.thighL - 3.5 * k], [0.2, b.thighL - 1.2 * k], [2 * k, b.thighL - 2.6 * k]], deep, 0.45, 0.35)] : []
      : [...(view === "back" ? kneeBack(b, w, c) : []), hemLine(b, w, to, 1.6 * k, tone(c, "shade"))] });
  } }),

  // jeans: topstitching, a fade at the knee, patch pockets behind; the washed print fades the seat and the thighs
  bottom_jeans: named("bottom", "Jeans", "kot pantolon", { colors: 1, defaults: ["fab_03"], tags: ["casual", "school"], patterns: ["pat_denim"], draw: ctx =>
    denim(ctx, ctx.colors[0] ?? "#4F6E9E", { w: trouserWidths(ctx.body, -0.4), to: 0.97, knee: "light", hemUp: 1.4 }) }),

  // a long skirt, gathered to the waist, to above the ankle; may wear the kilim band along its hem
  bottom_skirt_long: named("bottom", "Long skirt", "uzun etek", { colors: 1, defaults: ["fab_16"], tags: ["modest", "casual", "winter"], patterns: ["pat_kilim_band", ...ALL_OVER], draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#7A3E6E", k = det(b), cut: SkirtCut = { hem: b.legLen - b.footH - 4 * k, flare: 9 * (b.thighL / 37), ease: 2.4 };
    const g = (view: View) => skirtGroup(ctx, c, cut, view, 4, () => {
      const ww = b.waistW / 2 + 1.2;
      return view === "front" ? [...elasticBand(ww, c, 3)]
        // behind: the centre seam and a short zip at the waist
        : [{ path: rrect(-ww, -6, ww * 2, 3, 1), fill: tone(c, "shade"), flat: true, opacity: 0.5 }, line([[0, -3], [0, cut.hem - 0.5]], tone(c, "deep"), 0.45, 0.4), line([[0.5, -3], [0.5, 8 * k]], tone(c, "light"), 0.5, 0.6)];
    });
    return { front: [{ layer: "hips", bone: "hips", group: g("front") }], back: [{ layer: "hips", bone: "hips", group: g("back") }] };
  } }),

  // shorts to above the knee with a turned-up hem; on children a little longer
  bottom_shorts: named("bottom", "Shorts", "şort", { colors: 1, defaults: ["fab_19"], tags: ["casual", "summer", "sport"], patterns: ALL_OVER, draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#B98A57", k = det(b), w: W3 = [b.legW[0] * 1.22 + 2.6, b.legW[1] * 1.2 + 2.4, b.legW[2] * 1.2 + 2.4];
    const to = b.build === "toddler" ? 0.46 : b.build === "child" ? 0.44 : 0.4, end = legAt(b, to), hx = hipX(b);
    // the turned-up hem: a cut band a little wider than the leg, printed like it
    const cuff = (s: Side): Shape[] => {
      const h = widthAt(w, to) / 2 + 0.4, ch = 2.4 * k, out: Pt[] = [[-h, end - ch, 0], [h, end - ch, 0], [h + 0.2, end + 0.4, 0], [-h - 0.2, end + 0.4, 0]], p = poly(out as Vec2[]);
      return [S(out, c), ...printed(ctx, p, { hem: end, cx: -s * hx }), line([[-h + 0.4, end - ch + 0.6], [h - 0.4, end - ch + 0.6]], tone(c, "light"), 0.35, 0.6), { path: rect(h * 0.3, end - ch, h * 0.8, ch + 0.4), ...shadeOf(ctx, c, 0.3), clip: p }];
    };
    return trousers(ctx, c, { w, to, seat: (g, view) => view === "front"
      ? [-1, 1].map(s => line(curve([s * g.ww * 0.7, -6 + 2.6], [s * g.ww * 0.75, g.d * 0.1], [s * (g.hip - 0.3), g.d * 0.22], 4), tone(c, "deep"), 0.45, 0.5))
      // two pocket flaps behind
      : [-1, 1].map(s => ({ path: rrect(s * b.hipW * 0.22 - b.hipW * 0.12, 0.6 * k, b.hipW * 0.24, 2.6 * k, 0.6), fill: tone(c, "shade"), flat: true, opacity: 0.4 })),
    draw: (s, bone) => bone === "thigh" ? cuff(s) : [] });
  } }),

  // joggers: an elastic waist, a leg that narrows into a ribbed cuff with the cloth gathered over it, and one thin
  // stripe down the outer side (colour 2; derived from the cloth when none is given; never three, which reads as a brand)
  bottom_joggers: named("bottom", "Joggers", "eşofman altı", { colors: 2, defaults: ["fab_24"], tags: ["casual", "sport", "home", "istanbul"], draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#3A3D45", k = det(b), hx = hipX(b), stripe = ctx.colors[1] ?? (luma(c) > 0.45 ? tone(c, "deep") : mix(c, "#F7F3EA", 0.72));
    const w: W3 = [b.legW[0] * 1.2 + 2.4, b.legW[1] * 1.1 + 1.6, b.legW[2] * 0.9 + 1.2], to = 0.88, X0 = 0.7, X1 = 0.94;
    const cuff = (s: Side): Shape[] => {
      const y0 = legAt(b, 0.885) - b.thighL, y1 = legAt(b, 0.97) - b.thighL, h = b.legW[2] * 0.5 + 0.3, wl = widthAt(w, 0.885) / 2;
      const ribs = new Path();
      for (let x = -h + 0.9 * k; x < h - 0.5; x += 1.1 * k) ribs.moveTo(x, y0 + 0.5).lineTo(x, y1 - 0.4);
      const [pouch, pp] = gathered(c, y0, wl, h, 3.4 * k), sw = (X1 - X0) * wl * 0.9;
      return [{ path: rrect(-h, y0, h * 2, y1 - y0, 0.8 * k), fill: tone(c, "shade") }, { path: ribs, stroke: { color: tone(c, "deep"), width: 0.25 }, flat: true, opacity: 0.45 },
        pouch, { path: rect(s > 0 ? wl * X0 * 0.9 : -wl * X0 * 0.9 - sw, y0 - 4 * k, sw, 6 * k), fill: stripe, flat: true, clip: pp },
        line([[-wl * 0.5, y0 - 1.6 * k], [0, y0 - 0.6 * k], [wl * 0.45, y0 - 1.8 * k]], tone(c, "deep"), 0.4, 0.35)];
    };
    // the strip's light rim is narrowed to a hairline (`core`) and the stripe runs along it, so the two read as one light line down the leg
    return trousers(ctx, c, { w, to, elastic: true, band: 3.4, core: 0.93,
      seat: (g, view, path) => [
        // the stripe runs up the seat's side to the waist (where the leg's lies at rest)
        ...([1, -1] as const).map(s => ({ path: poly([[X0 * w[0] / 2, -7], ...legBand(b, w, 0, legT(b, g.d), "thigh", X0, X1, 1, 3), [X1 * w[0] / 2, -7]].map(([x, y]) => [s * (hx + x), y] as Vec2)), fill: stripe, flat: true, clip: path })),
        // the drawstring's ends in front; one patch pocket behind
        ...(view === "front" ? [line([[-1.2, -6 + 3.4], [-1.6, -6 + 9]], stripe, 0.45, 0.8), line([[1.2, -6 + 3.4], [1.7, -6 + 8.4]], stripe, 0.45, 0.8)]
          : [{ path: rrect(-b.hipW * 0.31, 0.4 * k, b.hipW * 0.22, g.d * 0.62, [0, 0, 1, 1]), fill: tone(c, "shade"), flat: true, opacity: 0.3 }])],
      draw: (s, bone) => [{ path: poly(legBand(b, w, bone === "thigh" ? 0 : 0.5, bone === "thigh" ? 0.5 : to, bone, X0, X1, 1).map(([x, y]) => [s * x, y] as Vec2)), fill: stripe, flat: true }, ...(bone === "shin" ? cuff(s) : [])] });
  } }),

  // a midi skirt to mid-calf, a little A, with a lighter hem band; behind, a seam and a vent
  bottom_skirt_midi: named("bottom", "Midi skirt", "midi etek", { colors: 1, defaults: ["fab_56"], tags: ["modest", "casual", "work"], patterns: [...ALL_OVER, "pat_kilim_band"], draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#A78BA8", k = det(b), cut: SkirtCut = { hem: (b.legLen - b.footH) * (b.build === "child" || b.build === "toddler" ? 0.72 : 0.78), flare: 6 * (b.thighL / 37), ease: 1.8, vent: 9 * k };
    const g = (view: View) => skirtGroup(ctx, c, cut, view, 2, path => {
      const ww = b.waistW / 2 + 1.2;
      return [{ path: rrect(-ww, -6, ww * 2, 3, 1), fill: tone(c, "shade"), flat: true, opacity: 0.5 }, ...hemBand(path, c, cut.hem + 0.4, 1.4 * k),
        ...(view === "back" ? [line([[0, -3], [0, cut.hem - (cut.vent ?? 0)]], tone(c, "deep"), 0.45, 0.45)] : [])];
    });
    return { front: [{ layer: "hips", bone: "hips", group: g("front") }], back: [{ layer: "hips", bone: "hips", group: g("back") }] };
  } }),

  // suit trousers: pressed creases front and back, a tapered leg whose hem breaks over the shoe
  bottom_trousers_suit: named("bottom", "Suit trousers", "kumaş pantolon", { colors: 1, defaults: ["fab_24"], tags: ["formal", "work"], builds: ["adult", "elder", "child"], over: ["shoes"], patterns: ["pat_check", "pat_gingham"], draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#3A3D45", k = det(b), w: W3 = [b.legW[0] * 1.16 + 2, b.legW[1] * 1.08 + 1.6, b.legW[2] * 1.0 + 1.6], to = 1;
    const lite = tone(c, "light"), deep = tone(c, "deep");
    // the crease: a lit line with its shade beside it, from below the seat to the hem
    const crease = (bone: Bone, view: View): Shape[] => {
      const y0 = bone === "thigh" ? crotch(b) * 0.8 : 0, y1 = bone === "thigh" ? b.thighL + 0.3 : legAt(b, to) - b.thighL - 0.6, op = view === "front" ? 1 : 0.6;
      return [line([[0.35, y0], [0.35, y1]], deep, 0.35, 0.35 * op), line([[0, y0], [0, y1]], lite, 0.4, 0.65 * op)];
    };
    return trousers(ctx, c, { w, to, layer: "trouser_hem", band: 4, seat: (g, view) => view === "front"
      // pleats from the waistband, a button and belt loops
      ? [...[-1, 1].map(s => line([[s * g.ww * 0.42, -6 + 4], [s * g.ww * 0.4, 2.5 * k]], deep, 0.45, 0.45)), { path: ellipse(1.4, -4, 0.55 * k), fill: deep, flat: true, opacity: 0.8 },
        ...[-0.82, -0.36, 0.36, 0.82].map(f => ({ path: rect(f * g.ww - 0.45 * k, -6.3, 0.9 * k, 4.6), fill: tone(c, "light"), flat: true, opacity: 0.35 }))]
      // two welt pockets with a button
      : [-1, 1].flatMap(s => [line([[s * g.ww * 0.22, 0.6 * k], [s * g.ww * 0.66, 0.6 * k]], deep, 0.6, 0.6), { path: ellipse(s * g.ww * 0.44, 1.8 * k, 0.45 * k), fill: deep, flat: true, opacity: 0.7 }]),
    draw: (s, bone, view) => [...crease(bone, view), ...(bone === "shin" ? [
      // the break: a soft fold where the hem rests on the shoe
      line([[-widthAt(w, 1) * 0.38, legAt(b, to) - b.thighL - 2.2 * k], [0, legAt(b, to) - b.thighL - 1.4 * k], [widthAt(w, 1) * 0.38, legAt(b, to) - b.thighL - 2.4 * k]], deep, 0.45, 0.35),
      ...(view === "back" ? kneeBack(b, w, c).slice(0, 2) : [])] : [])] });
  } }),

  // şalvar: full legs that billow from a gathered waist to below the knee and gather into a cuff (colour 2) at the
  // ankle, and a seat that hangs low between the legs. An everyday garment (a market, a village, a summer street), not a costume.
  bottom_salvar: named("bottom", "Şalvar", "şalvar", { colors: 2, defaults: ["fab_09", "fab_02"], tags: ["traditional", "casual", "summer", "modest", "istanbul"], patterns: ["pat_floral", "pat_dots", "pat_check", "pat_gingham", "pat_stripe_h", "pat_iznik_tulip"], draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#4E7A68", band = ctx.colors[1] ?? tone(c, "light"), k = det(b), hx = hipX(b);
    // at the top the legs are no wider than any seat (a top's hem covers hipW / 2 + 2.4 each side), so the
    // fullness never shows beside a top; it billows below the hem, widest at the knee
    const w: W3 = [Math.min(b.legW[0] * 1.4 + 6 * k, b.legW[0] + 4.2 * k), b.legW[1] * 2.1 + 9 * k, b.legW[2] * 0.95 + 1.5], to = 0.84, hem = legAt(b, 0.97);
    const drop = legAt(b, 0.3), deep = tone(c, "deep"), ww = b.waistW / 2 + 1.5;
    // the seat: gathered at the waist, out over the legs' tops (cut flat at the hip joints), hanging in a soft U between the legs
    const seatPts = (): Pt[] => {
      const top = hx + w[0] / 2, side = hx + widthAt(w, legT(b, drop * 0.5)) / 2 - 0.1;
      return [[-ww, -6, 0], [ww, -6, 0], [ww + (top - ww) * 0.45, -3.2], [top + 0.3, 3], [side, drop * 0.5, 0], [hx * 0.9, drop * 0.86], [0, drop], [-hx * 0.9, drop * 0.86], [-side, drop * 0.5, 0], [-top - 0.3, 3], [-ww - (top - ww) * 0.45, -3.2]];
    };
    const seat = (view: View): Group => {
      const out = seatPts(), path = smooth(out, true, 1), a = away(view);
      return { shapes: [S(out, c), ...printed(ctx, path, { hem }),
        { path: rect(a > 0 ? hx * 0.6 : -hx * 4, -7, hx * 3.4, drop + 8), ...shadeOf(ctx, c, 0.3), clip: path },
        ...elasticBand(ww, c, 3.2),
        // the drape: folds falling from the hips into the hanging seat
        ...[-1, 1].flatMap(s => [line([[s * hx * 1.7, 3 * k], [s * hx * 1.1, drop * 0.55], [s * hx * 0.3, drop * 0.92]], deep, 0.6, 0.35), line([[s * hx * 0.8, 0], [s * hx * 0.4, drop * 0.5], [s * 0.4, drop * 0.82]], deep, 0.5, 0.25)])] };
    };
    // the leg's fullness falling over its cuff (printed like the leg), then the cuff itself in colour 2: a
    // gathered band wider than the ankle, flush with the pouch's bottom, its gathers drawn on it
    const cuff = (s: Side): Shape[] => {
      const y0 = legAt(b, 0.845) - b.thighL, y1 = legAt(b, 0.99) - b.thighL, wl = widthAt(w, 0.845) / 2, ht = Math.max(wl * 0.92, b.legW[2] * 0.5 + 2.4 * k), hb = Math.max(wl * 0.8, b.legW[2] * 0.5 + 1.8 * k);
      const [pouch, pp] = gathered(c, y0, wl, ht, 4.4 * k), top = y0 - 0.2 * k;
      const band_: Pt[] = [[-ht, top - 0.3, 0], [0, top + 0.3], [ht, top - 0.3, 0], [hb, y1, 0], [-hb, y1, 0]], bp = smooth(band_, true, 1);
      const gathers = new Path();
      for (let i = -2; i <= 2; i++) { const f = i / 2.6; gathers.moveTo(f * ht, top + 0.6).lineTo(f * hb, y1 - 0.6); }
      return [pouch, ...printed(ctx, pp, { hem: onBone(b, "shin", hem), cx: -s * hx }),
        { path: rect(s > 0 ? wl * 0.3 : -wl * 1.4, y0 - 7 * k, wl * 1.1, 10 * k), ...shadeOf(ctx, c, 0.3), clip: pp },
        ...[-0.45, 0, 0.45].map(f => line([[f * wl, y0 - 3.4 * k], [f * wl * 0.9, y0 + 0.4 * k]], deep, 0.4, 0.35)),
        S(band_, band), { path: gathers, stroke: { color: tone(band, "deep"), width: 0.3 }, flat: true, opacity: 0.4 },
        { path: rect(s > 0 ? ht * 0.25 : -ht * 1.2, top - 1, ht, y1 - top + 2), fill: tone(band, "shade"), flat: true, opacity: 0.35, clip: bp }];
    };
    const legs = (view: View) => legItems(ctx, c, { w, to, caps: "none", hem, core: 0.94, draw: (s, bone) => bone === "thigh"
      ? [line([[s * widthAt(w, 0.3) * 0.12, drop * 0.8], [s * widthAt(w, 0.45) * 0.26, b.thighL * 0.92]], deep, 0.55, 0.3)]
      : [line([[-s * widthAt(w, 0.55) * 0.2, 2], [-s * widthAt(w, 0.8) * 0.12, legAt(b, 0.8) - b.thighL]], deep, 0.55, 0.3), ...cuff(s)] }, view);
    return { front: [{ layer: "hips", bone: "hips", group: seat("front") }, ...legs("front")], back: [{ layer: "hips", bone: "hips", group: seat("back") }, ...legs("back")] };
  } }),

  // scrub trousers: straight and loose, an elastic waist with a tie, a patch pocket on the left thigh
  bottom_scrubs: named("bottom", "Scrub trousers", "forma pantolonu", { colors: 1, defaults: ["fab_06"], tags: ["work", "uniform"], builds: ["adult", "elder"], draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#2F8C88", k = det(b), w: W3 = [b.legW[0] * 1.18 + 2.2, b.legW[1] * 1.12 + 2.2, b.legW[2] * 1.08 + 2.2], to = 0.97, sh = tone(c, "shade"), deep = tone(c, "deep");
    // a patch pocket on the outer side of the left thigh, seen from both sides
    const pocket = (s: Side): Shape[] => {
      if (s !== 1) return [];
      const h = widthAt(w, 0.3) / 2, y0 = b.thighL * 0.42, y1 = b.thighL * 0.8, x0 = h * 0.08, x1 = h * 0.82, p = rrect(x0, y0, x1 - x0, y1 - y0, [0, 0, 1.2, 1.2]);
      return [{ path: p, fill: c }, line([[x0 + 0.3, y0 + 1.6 * k], [x1 - 0.3, y0 + 1.6 * k]], sh, 0.4, 0.55), { path: rect(x0 + (x1 - x0) * 0.62, y0, (x1 - x0) * 0.4, y1 - y0), fill: sh, flat: true, opacity: 0.3, clip: p }];
    };
    return trousers(ctx, c, { w, to, elastic: true, band: 3.4,
      seat: (g, view) => view === "front"
        // the drawstring's bow at the centre
        ? [S([[0, -4.2, 0], [-2.4 * k, -5.4 * k - 1], [-2.6 * k, -3.2]], tone(c, "light"), { flat: true }), S([[0, -4.2, 0], [2.4 * k, -5.4 * k - 1], [2.6 * k, -3.2]], tone(c, "light"), { flat: true }), line([[-0.3, -4], [-1.2 * k, 1.5]], tone(c, "light"), 0.5, 0.9), line([[0.3, -4], [1.4 * k, 1.2]], tone(c, "light"), 0.5, 0.9)]
        // a patch pocket on the right behind
        : [{ path: rrect(-b.hipW * 0.32, 0.6 * k, b.hipW * 0.24, g.d * 0.62, [0, 0, 1, 1]), fill: sh, flat: true, opacity: 0.32 }],
      draw: (s, bone, view) => bone === "thigh" ? pocket(s) : [...(view === "back" ? kneeBack(b, w, c).slice(0, 2) : []), line([[-widthAt(w, 0.6) * 0.3, legAt(b, 0.62) - b.thighL], [0, legAt(b, 0.6) - b.thighL + 0.8]], deep, 0.4, 0.25), hemLine(b, w, to, 1.8 * k, sh)] });
  } }),

  // cargo trousers: a roomy straight leg, belt loops, a big patch pocket with a buttoned flap on the outer side of each
  // thigh and a smaller one on the calf (a toddler's has only the thigh's); flap pockets behind. Plain cloth only
  bottom_cargo: named("bottom", "Cargo trousers", "kargo pantolon", { colors: 1, defaults: ["fab_29"], tags: ["casual", "work"], draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#5E6B3F", k = det(b), w: W3 = [b.legW[0] * 1.22 + 2.6, b.legW[1] * 1.2 + 2.4, b.legW[2] * 1.1 + 2], to = 0.97;
    const sh = tone(c, "shade"), deep = tone(c, "deep"), lite = tone(c, "light");
    // a patch pocket on the outer side of a leg piece from y0 to y1 (in the piece's space, at +x; `s` puts it outside), with a flap and its button
    const patch = (s: Side, half: number, y0: number, y1: number): Shape[] => {
      const x0 = half * 0.02, x1 = half * 0.86, fh = Math.min(3.4 * k, (y1 - y0) * 0.3), m = (a: number) => s * a;
      const body: Vec2[] = [[m(x0), y0 + fh * 0.6], [m(x1), y0 + fh * 0.6], [m(x1), y1], [m(x0), y1]];
      const flap: Vec2[] = [[m(x0 - 0.3), y0], [m(x1 + 0.3), y0], [m(x1 + 0.3), y0 + fh], [m(x0 - 0.3), y0 + fh]], pb = poly(body);
      return [{ path: pb, fill: c }, { path: rect(Math.min(m(x0 + (x1 - x0) * 0.6), m(x1)), y0, (x1 - x0) * 0.4, y1 - y0), fill: sh, flat: true, opacity: 0.32, clip: pb },
        // a pleat down the middle of the big pocket, the flap over it and its button
        line([[m((x0 + x1) / 2), y0 + fh + 0.4], [m((x0 + x1) / 2), y1 - 0.5]], deep, 0.35, 0.3),
        { path: poly(flap), fill: c }, line([[m(x0), y0 + fh - 0.35], [m(x1), y0 + fh - 0.35]], lite, 0.3, 0.5),
        { path: ellipse(m((x0 + x1) / 2), y0 + fh * 0.62, 0.5 * k), fill: deep, flat: true, opacity: 0.8 }];
    };
    return trousers(ctx, c, { w, to, band: 2.6,
      seat: (g, view) => view === "front"
        // belt loops and slanted front pockets
        ? [...[-0.82, -0.36, 0.36, 0.82].map(f => ({ path: rect(f * g.ww - 0.45 * k, -6.3, 0.9 * k, 3.4), fill: lite, flat: true, opacity: 0.4 })),
          ...[-1, 1].map(s => line([[s * g.ww * 0.7, -6 + 2.6], [s * (g.hip - 1), g.d * 0.32]], deep, 0.45, 0.5))]
        // two flap pockets behind
        : [-1, 1].flatMap(s => {
            const x = s * b.hipW * 0.22, pw = b.hipW * 0.13, top = 0.6 * k, bot = g.d * 0.7;
            return [{ path: rrect(x - pw, top, pw * 2, bot - top, [0, 0, 0.8, 0.8]), fill: sh, flat: true, opacity: 0.28 },
              { path: rrect(x - pw - 0.2, top - 0.3, pw * 2 + 0.4, 2.6 * k, 0.4), fill: sh, flat: true, opacity: 0.45 },
              { path: ellipse(x, top + 1.7 * k, 0.45 * k), fill: deep, flat: true, opacity: 0.75 }];
          }),
      draw: (s, bone, view) => bone === "thigh"
        ? [...patch(s, widthAt(w, 0.4) / 2, b.thighL * 0.5, b.thighL * 0.88), ...(view === "front" ? [line([[-1.6 * k, b.thighL - 3.5 * k], [0.2, b.thighL - 1.2 * k], [2 * k, b.thighL - 2.6 * k]], deep, 0.45, 0.35)] : [])]
        : [...(b.build === "toddler" ? [] : patch(s, widthAt(w, 0.72) / 2, legAt(b, 0.66) - b.thighL, legAt(b, 0.8) - b.thighL)),
          ...(view === "back" ? kneeBack(b, w, c) : []), hemLine(b, w, to, 1.6 * k, sh)] });
  } }),

  // skinny jeans: the jeans' stitching on legs that follow the body (never narrower than the leg), stretch
  // wrinkles at the knee, a narrow hem; smaller pockets behind
  bottom_jeans_skinny: named("bottom", "Skinny jeans", "dar paça kot", { colors: 1, defaults: ["fab_04"], tags: ["casual"], patterns: ["pat_denim"], draw: ctx => {
    const b = ctx.body, L = b.legW, w: W3 = [Math.max(L[0] * 1.04 + 1.2, L[0] + 0.6), Math.max(L[1] * 0.98 + 0.8, L[1] + 0.6), Math.max(L[2] * 0.92 + 0.6, L[2] + 0.6)];
    return denim(ctx, ctx.colors[0] ?? "#2E3A59", { w, to: 0.97, knee: "stretch", hemUp: 0.9, pocket: 0.13, low: 0.72 });
  } }),

  // wide-leg jeans: full straight legs to the floor, their hem over the shoe (`trouser_hem`), slack folds at
  // the knee and a worn hem; low patch pockets behind
  bottom_jeans_wide: named("bottom", "Wide-leg jeans", "bol paça kot", { colors: 1, defaults: ["fab_03"], tags: ["casual", "school"], over: ["shoes"], patterns: ["pat_denim"], draw: ctx => {
    const b = ctx.body, L = b.legW, kid = b.build === "child" || b.build === "toddler";
    const w = clampLegs(b, [L[0] * 1.25 + 3, L[1] * 1.35 + 3.5, L[2] * 1.5 + 4], kid ? 0.08 : 0.15);
    return denim(ctx, ctx.colors[0] ?? "#4F6E9E", { w, to: 0.99, layer: "trouser_hem", knee: "slack", hemUp: 1.8, pocket: 0.16, low: 0.95, worn: true });
  } }),

  // chinos: a little slimmer than trousers, belt loops, slash pockets and a button, a rolled cuff; welt pockets behind
  bottom_chinos: named("bottom", "Chinos", "chino pantolon", { colors: 1, defaults: ["fab_18"], tags: ["casual", "work", "school"], patterns: drawn(WOVEN), draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#D8C3A0", k = det(b), w: W3 = [b.legW[0] * 1.1 + 1.8, b.legW[1] * 1.04 + 1.4, b.legW[2] * 0.98 + 1.2], to = 0.97;
    const deep = tone(c, "deep"), lite = tone(c, "light"), sh = tone(c, "shade");
    // the rolled cuff: a lighter band 3 cm deep at the hem, its top edge a fold line
    const cuff = (): Shape[] => {
      const y = legAt(b, to) - b.thighL, ch = 3 * k, clip = poly(legBand(b, w, 0.5, to, "shin", -1, 1, 1)), h = widthAt(w, to) / 2 + 1;
      return [{ path: rect(-h, y - ch, h * 2, ch + 1), fill: lite, flat: true, opacity: 0.35, clip }, { path: rect(-h, y - ch - 0.1, h * 2, 0.45), fill: sh, flat: true, opacity: 0.6, clip }];
    };
    return trousers(ctx, c, { w, to,
      seat: (g, view) => view === "front"
        // five belt loops, the button and two curved slash pockets
        ? [...[-0.86, -0.45, 0, 0.45, 0.86].filter((_, i) => i !== 2).map(f => ({ path: rect(f * g.ww - 0.45 * k, -6.3, 0.9 * k, 3.4), fill: lite, flat: true, opacity: 0.4 })),
          { path: ellipse(0.9, -4.6, 0.55 * k), fill: deep, flat: true, opacity: 0.8 },
          ...[-1, 1].map(s => line(curve([s * g.ww * 0.7, -6 + 2.6], [s * g.ww * 0.78, g.d * 0.18], [s * (g.hip - 0.4), g.d * 0.26], 5), sh, 0.5, 0.65))]
        // the fifth loop at the centre back, two welt pockets with a button
        : [{ path: rect(-0.45 * k, -6.3, 0.9 * k, 3.4), fill: lite, flat: true, opacity: 0.4 },
          ...[-1, 1].flatMap(s => [line([[s * g.ww * 0.22, 0.6 * k], [s * g.ww * 0.66, 0.6 * k]], deep, 0.55, 0.6), { path: ellipse(s * g.ww * 0.44, 1.7 * k, 0.42 * k), fill: deep, flat: true, opacity: 0.7 }])],
      draw: (s, bone, view) => bone === "thigh"
        ? view === "front" ? [line([[-1.6 * k, b.thighL - 3.5 * k], [0.2, b.thighL - 1.2 * k], [2 * k, b.thighL - 2.6 * k]], deep, 0.45, 0.35)] : []
        : [...(view === "back" ? kneeBack(b, w, c) : []), ...cuff()] });
  } }),

  // wide-leg trousers (palazzo): a high waistband with two soft pleats, legs flaring to the floor and over the
  // shoe (`trouser_hem`), kept far enough apart to read as trousers; pocket slits behind
  bottom_trousers_wide: named("bottom", "Wide-leg trousers", "bol paça pantolon", { colors: 1, defaults: ["fab_27"], tags: ["casual", "work", "summer", "modest"], over: ["shoes"], patterns: drawn(WOVEN), draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#8A6F9E", k = det(b), kid = b.build === "child" || b.build === "toddler", round = b.waistW >= b.hipW;
    const w = clampLegs(b, [b.legW[0] * 1.2 + 2, b.legW[1] * 1.5 + 3, b.legW[2] * 1.9 + 4], kid ? 0.08 : 0.15), to = 0.99, deep = tone(c, "deep");
    return trousers(ctx, c, { w, to, layer: "trouser_hem", band: round ? 2.5 : 4.1, core: 0.94,
      seat: (g, view) => view === "front"
        // two soft pleats from the band (none on a round body), a button
        ? [...(round ? [] : [-1, 1].map(s => line([[s * g.ww * 0.45, -6 + 4.1], [s * g.ww * 0.5, 1.5 * k], [s * g.ww * 0.62, g.d * 0.4]], deep, 0.5, 0.35))),
          { path: ellipse(1.4, -6 + 2.05, 0.55 * k), fill: deep, flat: true, opacity: 0.8 }]
        // two pocket slits behind
        : [-1, 1].map(s => line([[s * g.ww * 0.24, 0.8 * k], [s * g.ww * 0.64, 0.6 * k]], deep, 0.5, 0.55)),
      draw: (s, bone, view) => bone === "thigh"
        // the fall of the cloth: a long soft fold down the front of each leg, from the pleat
        ? [line([[s * widthAt(w, 0.2) * 0.04, crotch(b) * 0.7], [-s * widthAt(w, 0.45) * 0.04, b.thighL * 0.95]], deep, 0.5, view === "front" ? 0.28 : 0.18)]
        : [line([[-s * widthAt(w, 0.5) * 0.04, 0], [-s * widthAt(w, 0.8) * 0.12, legAt(b, 0.9) - b.thighL]], deep, 0.5, view === "front" ? 0.28 : 0.18),
          line([[s * widthAt(w, 0.6) * 0.25, legAt(b, 0.62) - b.thighL], [s * widthAt(w, 0.9) * 0.34, legAt(b, 0.95) - b.thighL]], deep, 0.45, 0.22),
          hemLine(b, w, to, 1.6 * k, tone(c, "shade"))] });
  } }),

  // an A-line skirt to the knee: a waistband with two darts, a smooth flare, one faint fold down the centre (fewer
  // folds than the long skirt: it holds its shape); a zip down the centre back
  bottom_skirt_a_line: named("bottom", "A-line skirt", "A kesim etek", { colors: 1, defaults: ["fab_40"], tags: ["casual", "work", "school", "modest"], patterns: [...drawn(WOVEN), "pat_kilim_band"], draw: ctx => {
    const b = ctx.body, c = ctx.colors[0] ?? "#2E5237", k = det(b), kid = b.build === "child" || b.build === "toddler", round = b.waistW >= b.hipW, elastic = b.build === "toddler";
    const cut: SkirtCut = { hem: (b.legLen - b.footH) * (kid ? 0.52 : 0.55), flare: 7 * (b.thighL / 37), ease: 1.6 }, bh = round ? 4 : 3, ww = b.waistW / 2 + 1.2, deep = tone(c, "deep");
    const g = (view: View) => skirtGroup(ctx, c, cut, view, 0, path => [
      ...(elastic ? elasticBand(ww, c, bh) : [{ path: rrect(-ww, -6, ww * 2, bh, 1), fill: tone(c, "shade"), flat: true, opacity: 0.5 } as Shape]),
      // two darts below the band (not on a round body or a gathered waist)
      ...(round || elastic ? [] : [-1, 1].map(s => line([[s * ww * 0.5, -6 + bh], [s * ww * 0.54, -6 + bh + 6 * k]], deep, 0.45, 0.4))),
      ...(view === "front"
        ? [line([[0.4, 4 * k], [0.6, (cut.hem + 4) / 2], [0.9, cut.hem - 1]], deep, 0.6, 0.18)]
        // behind: the zip from the band and the centre seam on to the hem
        : [line([[0, -6 + bh], [0, cut.hem - 0.4]], deep, 0.45, 0.4), ...(elastic ? [] : [line([[0.5, -6 + bh], [0.5, 8 * k]], tone(c, "light"), 0.5, 0.6)])]),
      ...hemBand(path, c, cut.hem + 0.4, 1 * k).slice(1)]);
    return { front: [{ layer: "hips", bone: "hips", group: g("front") }], back: [{ layer: "hips", bone: "hips", group: g("back") }] };
  } }),
};
