// Tops (`outfit.top`): tees, shirts, sweaters, blouses, tunics. A top is a torso piece on the spine
// bone (layer `torso`; the shoulder line at y = -torsoL, the hip pivot at 0, the hem below it) and
// two sleeve strips (layer `sleeve`). Drawn from the body's measurements, never for one shape.
//
// THE TOPS ARTIST'S FILE: add parts to `TOPS` (ids `top_*`, permanent). Shared helpers are in
// draw/ (`sleeves`, `chestPatch` under a deep neckline, `printed`, `stripPrint`); the torso is cut
// here by `outline` (a `Cut`), which adds what the tops need over draw/'s `torsoOutline`: a hem
// wide enough to cover a bottom's seat, a V, boxy sides, side slits, and lines that keep their
// places on a toddler's 21 cm torso. A top that takes prints lists them (`patterns: [...]`, from
// `patternsFor("top")`), prints every piece of its cloth front and back (`cloth`) and spreads
// `stripPrint(ctx)` into every sleeve of its ground colour; collars, plackets, ribs and buttons
// drawn after the print stay plain. The back view mirrors (+x, the wearer's left, is on the
// viewer's left), so its side shade is drawn at -x, away from the light. Long sleeves and a
// covered neckline are `modest` (the randomiser gives them their share).

import { Path as PathK, ellipse, rrect, smooth, tone, mix, type BodyDims, type PartDef, type PartCtx, type Item, type Path, type Shape, type StripSpec } from "sahne";
import { named, S, P, flat, chestPatch, sleeves, printed, stripPrint, inksOf, type Pt } from "./draw/index.ts";

/**
 * The strip under a printed sleeve: stripes run round it (`stripPrint`); under any other print it is
 * the print as it looks from a step away (its ground tinted by its inks), which is all that shows of
 * it once `sleevePrint`'s pieces lie on it: its rim, and the joint of a bent elbow.
 */
function armPrint(ctx: PartCtx): Partial<StripSpec> {
  const id = ctx.pattern, g = ctx.colors[0] ?? "#888888";
  if (!id || id === "pat_stripe_h") return stripPrint(ctx);
  const [a, b] = inksOf(id, g, ctx.inks), grid = id === "pat_check" || id === "pat_gingham";
  return { color: grid ? mix(g, a, 0.35) : mix(mix(g, a, id === "pat_dots" ? 0.12 : 0.14), b, id === "pat_dots" ? 0 : 0.1) };
}

/** How far down a straight arm (cm from the shoulder joint) a strip's point at `t` lies: the quadratic through the three joints (rig/strip.ts). */
function armS(b: BodyDims, t: number): number {
  const L = b.upperArmL + b.foreArmL, f = b.upperArmL / L;
  return 2 * t * (1 - t) * (2 * f - 0.5) * L + t * t * L;
}

/** A sleeve's widths at the shoulder, elbow and wrist, as draw/'s `sleeves` cuts them with `extra`. */
const sleeveW = (b: BodyDims, extra: number): [number, number, number] => [b.armW[0] * 1.18 + extra, b.armW[1] * 1.16 + extra, b.armW[2] * 1.12 + extra];

/**
 * The print on the sleeves, as flat pieces on the arm bones over the strips. A strip can carry only
 * stripes and draws its round shoulder in one colour, so the pieces fill the strip's core (the
 * renderers draw a light paper rim on the outer fifth of a strip's width, at 0.8; the pieces stay
 * inside it, so the sleeve keeps its rim and its shadow, and the pieces need neither):
 * - stripes: a dome over the strip's shoulder cap that carries the strip's own bands on, so the
 *   shoulder is striped like the rest of the sleeve;
 * - every other print: the upper sleeve (round at the shoulder) on `arm_*` and the forearm part on
 *   `forearm_*`, meeting at the elbow, the print's rows counted from the elbow in both so they run on.
 *   Under them the strip wears `armPrint`'s tint, which shows only where a bent elbow opens the joint.
 * The strip is the quadratic through the three joints (rig/strip.ts); on a straight arm its point at
 * `t` lies `armS(t)` cm from the shoulder, which is what places the pieces.
 */
function sleevePrint(ctx: PartCtx, c: string, w: [number, number, number], to: number): Item[] {
  const id = ctx.pattern, b = ctx.body;
  if (!id) return [];
  const U = b.upperArmL, s = (t: number) => armS(b, t);
  const wAt = (t: number) => (t < 0.5 ? w[0] + (w[1] - w[0]) * t * 2 : w[1] + (w[2] - w[1]) * (t - 0.5) * 2) / 2 * CORE;
  const arc = (cy: number, r: number, a0: number, a1: number, n = 8): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [Math.cos(a) * r, cy + Math.sin(a) * r] as Pt; });
  const chains = (["l", "r"] as const);
  if (id === "pat_stripe_h") {
    const sp = stripPrint(ctx);
    if (!sp.stripes) return [];
    const [g, p, duty] = sp.stripes, r = wAt(0), dome = smooth([...arc(0.05, r, Math.PI, 2 * Math.PI)], true, 1);
    // the strip's bands carried on over the cap: ground for the first `duty` of every period, back from 0
    const bands: Shape[] = [];
    for (let k = -Math.ceil(r / p); k < 0; k++) bands.push({ path: rrect(-r - 1, k * p, 2 * r + 2, duty * p, 0), fill: g, flat: true, clip: dome });
    return chains.map(sd => ({ layer: "sleeve", bone: `arm_${sd}`, group: { shapes: [flat(dome, sp.color ?? c), ...bands] } }));
  }
  const N = 6, side = (t0: number, t1: number, y0: number): [Pt[], Pt[]] => {
    const l: Pt[] = [], rr: Pt[] = [];
    for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N, y = s(t) - y0; l.push([-wAt(t), y]); rr.push([wAt(t), y]); }
    return [l, rr];
  };
  const out: Item[] = [];
  for (const sd of chains) {
    const long = to > 0.5, end = Math.min(to, 0.5), [l, r] = side(0, end, 0), r0 = wAt(0), re = wAt(end), ye = s(end) + (long ? 0.3 : 0);
    // round at the shoulder, cut flat at the cuff or just past the elbow, where the forearm part takes over
    const path = smooth([...arc(0, r0, Math.PI, 2 * Math.PI).slice(0, -1), ...r.slice(0, -1), [re, ye, 0], [-re, ye, 0], ...l.slice(1, -1).reverse()], true, 1);
    out.push({ layer: "sleeve", bone: `arm_${sd}`, group: { shapes: flatCloth(ctx, path, c, long ? U : ye) } });
    if (long) {
      const [l, r] = side(0.5, to, U), fore = smooth([[l[0][0], -0.3, 0], [r[0][0], -0.3, 0], ...r.slice(1, -1), [r[N][0], r[N][1], 0], [l[N][0], l[N][1], 0], ...l.slice(1, -1).reverse()], true, 1);
      out.push({ layer: "sleeve", bone: `forearm_${sd}`, group: { shapes: flatCloth(ctx, fore, c, 0) } });
    }
  }
  return out;
}

/** The strip renderers' core: its rim is the outer fifth of the band (the still backend's RIM, the shader's 0.80). */
const CORE = 0.8;
/** A flat piece of cloth and its print: no cut edge or lift of its own (it lies inside a strip's rim). */
const flatCloth = (ctx: PartCtx, path: Path, c: string, hem: number): Shape[] => [flat(path, c), ...printed(ctx, path, { hem })];

/** Both sleeves to `to` with `extra` ease (as draw/'s `sleeves`), wearing the top's print. */
function printedSleeves(ctx: PartCtx, c: string, to: number, extra: number): Item[] {
  return [...sleeves(ctx.body, c, to, extra, "sleeve", armPrint(ctx)), ...sleevePrint(ctx, c, sleeveW(ctx.body, extra), to)];
}

/** The prints a top may wear: the catalogue's list, as far as the kit has them (`patternsFor("top")` without the denim fades). */
const PRINTS = ["pat_stripe_h", "pat_check", "pat_gingham", "pat_dots", "pat_floral", "pat_iznik_tulip"];

type Out = { front: Item[]; back: Item[] };

/** A top: its names, default colours and drawing (`c` is its first colour as hex). */
function top(en: string, tr: string, defs: string[], draw: (ctx: PartCtx, c: string) => Out, o: Partial<PartDef> = {}): PartDef {
  return named("top", en, tr, { colors: defs.length, defaults: defs, ...o, draw: ctx => draw(ctx, ctx.colors[0] ?? "#7FB3C8") });
}

// ---- the cut ---------------------------------------------------------------------------------------

/** How a top is cut. Lengths in cm on an adult; a neckline is shallower on a child (`neckK`). */
interface Cut {
  /** How deep the front neckline dips below the shoulder line. */
  neck: number;
  /** A V neckline instead of a round one. */
  v?: boolean;
  /** The back view's outline: the neck closes to `nape` (default 1.2). */
  back?: boolean;
  nape?: number;
  /** How far the hem's middle drops below its sides. */
  drop: number;
  /** Ease at the chest, each side: tops 1–1.8, a boxy cut more. */
  loose: number;
  /** The hem's y on the spine bone. */
  hem: number;
  /** Ease past the hips at the hem, each side (default max(loose, 2.4): a bottom's seat is hipW/2 + 2.2 wide, and the top covers it). */
  hip?: number;
  /** Straight sides from the chest down (a hoodie, scrubs). */
  boxy?: boolean;
  /** Side slits, cm up from the hem. */
  slit?: number;
  /** A neckline wider than the neck, each side (a sweater's V). */
  wide?: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Necklines and collars on a child: a shorter torso and neck, so a shallower dip (never past the chin). */
const neckK = (b: BodyDims) => clamp(b.torsoL / 42, 0.62, 1);
/** Widths of details (pockets, collars, shade) against an adult's 42 cm shoulders. */
const sizeK = (b: BodyDims) => clamp(b.shoulderW / 42, 0.56, 1.1);
/** Hems below the hip pivot shrink with the thigh, so a toddler's tee stays a tee. */
const hemK = (b: BodyDims) => clamp(b.thighL / 34, 0.5, 1);

/** The lines of the torso, as fractions of it, so a 21 cm torso keeps the same shape as a 46 cm one. */
function ys(b: BodyDims) {
  const T = b.torsoL;
  return { T, top: -T - 0.6, slope: -T + Math.min(1.4, T * 0.05), sh: -T + Math.min(4.6, T * 0.17), chest: -T * 0.66, waist: -T * 0.32 };
}
function xs(b: BodyDims, o: Cut) {
  const cw = b.chestW / 2 + o.loose, hw = b.hipW / 2 + (o.hip ?? Math.max(o.loose, 2.4)), w0 = b.waistW / 2 + o.loose * 1.3;
  return { sw: b.shoulderW / 2, nw: b.neckW / 2 + 1.4 + (o.wide ?? 0) * sizeK(b), cw, hw, ww: o.boxy ? Math.max(w0, cw, (cw + hw) / 2) : w0 };
}
const depth = (b: BodyDims, o: Cut) => (o.back ? o.nape ?? 1.2 : o.neck * neckK(b));

/** A side slit: the x and y of its top on the side seam, and the x where the front panel meets the hem. */
function slitAt(b: BodyDims, o: Cut): [number, number, number] {
  const y = ys(b), x = xs(b, o), sy = o.hem - (o.slit ?? 0), t = (sy - y.waist) / (o.hem - y.waist), sx = x.ww + (x.hw - x.ww) * t;
  return [sx, sy, sx + (x.hw - sx) * 0.3];
}

/** The torso's outline points (a smooth closed shape; corners at the neck, the shoulders and the hem). */
function outline(b: BodyDims, o: Cut): Pt[] {
  const y = ys(b), x = xs(b, o), d = depth(b, o);
  const side = (s: 1 | -1): Pt[] => {
    const pts: Pt[] = [[s * x.nw, y.top, 0], [s * (x.sw - 1.2), y.slope], [s * (x.sw + 0.3), y.sh, 0], [s * x.cw, y.chest], [s * x.ww, y.waist]];
    if (o.slit) { const [sx, sy, nx] = slitAt(b, o); pts.push([s * sx, sy, 0], [s * nx, o.hem, 0]); } else pts.push([s * x.hw, o.hem, 0]);
    return pts;
  };
  const neck: Pt[] = o.v && !o.back
    ? [[x.nw * 0.5, y.top + d * 0.5, 0], [0, y.top + d, 0], [-x.nw * 0.5, y.top + d * 0.5, 0]]
    : [[x.nw * 0.66, y.top + d * 0.62], [0, y.top + d], [-x.nw * 0.66, y.top + d * 0.62]];
  return [...side(-1), [0, o.hem + o.drop], ...side(1).reverse(), ...neck];
}

/** Points mirrored to side `s` (corners kept). */
const mx = (pts: Pt[], s: number): Pt[] => pts.map(p => (p.length === 3 ? [s * p[0], p[1], 0] : [s * p[0], p[1]]) as Pt);

/** The shade down the side away from the light: +x in front, -x in the (mirrored) back view; it stops at a slit. */
function sideShade(b: BodyDims, c: string, o: Cut): Shape {
  const y = ys(b), x = xs(b, o), w = 3.2 * sizeK(b), [lx, ly] = o.slit ? slitAt(b, o) : [x.hw, o.hem];
  const pts: Pt[] = [[x.cw - w, y.chest + 0.6], [x.cw, y.chest], [x.ww, y.waist], [lx, ly, 0], [lx - w, ly, 0], [x.ww - w, y.waist]];
  return S(mx(pts, o.back ? -1 : 1), tone(c, "shade"), { flat: true, opacity: 0.5 });
}

/** The light on the lit side: a soft flat band down the -x side in front (+x in the mirrored back), from the shoulder to the waist. */
function sideLight(b: BodyDims, c: string, o: Cut): Shape {
  const y = ys(b), x = xs(b, o), w = 2.4 * sizeK(b);
  const pts: Pt[] = [[x.sw - 1.4, y.slope + 0.6], [x.sw - 0.2, y.sh], [x.cw - 0.4, y.chest], [x.ww - 0.6, y.waist * 0.6], [x.ww - w, y.waist * 0.75], [x.cw - w - 0.4, y.chest], [x.sw - w - 0.6, y.sh + 0.4]];
  return S(mx(pts, o.back ? 1 : -1), tone(c, "light"), { flat: true, opacity: 0.35 });
}

/** The back panel seen through the side slits: a shaded triangle under the front's notch. */
function vents(b: BodyDims, c: string, o: Cut): Shape[] {
  if (!o.slit) return [];
  const x = xs(b, o), [sx, sy, nx] = slitAt(b, o);
  return [1, -1].map(s => S(mx([[sx - 0.2, sy - 0.6], [x.hw, o.hem, 0], [nx - 0.6, o.hem + o.drop * 0.2, 0]], s), tone(c, "deep")));
}

/** A piece of cloth: the ground and its print (`hem` is where the print's rows start). */
const cloth = (ctx: PartCtx, path: Path, fill: string, hem: number): Shape[] => [P(path, fill), ...printed(ctx, path, { hem })];

/** The torso piece: what lies under it (skin under a deep neckline, the slits), the cloth, its print and shade, then the plain details. */
function torso(ctx: PartCtx, c: string, o: Cut, over: Shape[] = [], under: Shape[] = []): Item {
  const path = smooth(outline(ctx.body, o), true, 1);
  return { layer: "torso", bone: "spine", group: { shapes: [...under, ...vents(ctx.body, c, o), ...cloth(ctx, path, c, o.hem), sideShade(ctx.body, c, o), sideLight(ctx.body, c, o), ...over] } };
}

// ---- details ---------------------------------------------------------------------------------------

/** A printed line through points (corners allowed): a seam, a rib, piping; `dash` for stitching. */
function stroke(pts: Pt[], c: string, w = 0.5, op = 0.6, dash?: [number, number]): Shape {
  return { path: smooth(pts, false, 1), stroke: { color: c, width: w, ...(dash ? { dash } : {}) }, flat: true, opacity: op };
}

/** Points along the neckline, `off` cm inside it (a rib, piping, a binding). */
function neckLine(b: BodyDims, o: Cut, off: number): Pt[] {
  const y = ys(b), x = xs(b, o), d = depth(b, o), n = x.nw - off * 0.35;
  if (o.v && !o.back) return [[-n, y.top + off * 0.6], [0, y.top + d + off * 1.1, 0], [n, y.top + off * 0.6]];
  return [[-n, y.top + off * 0.5], [-n * 0.66, y.top + d * 0.62 + off * 0.9], [0, y.top + d + off], [n * 0.66, y.top + d * 0.62 + off * 0.9], [n, y.top + off * 0.5]];
}

/** Points along the hem, `off` cm above it. */
function hemLine(b: BodyDims, o: Cut, off: number): Pt[] {
  const x = xs(b, o), w = (o.slit ? slitAt(b, o)[2] : x.hw) - 0.6;
  return [[-w, o.hem - off], [0, o.hem + o.drop - off], [w, o.hem - off]];
}

/** A knitted rib band along the hem: a flat shade band and its ribs (a dashed stroke across it). */
function hemRib(b: BodyDims, c: string, o: Cut): Shape[] {
  const h = 3 * neckK(b), x = xs(b, o), w = x.hw, band: Pt[] = [[-w, o.hem - h, 0], [w, o.hem - h, 0], [w, o.hem, 0], [-w, o.hem, 0]];
  return [S(band, tone(c, "shade"), { flat: true, opacity: 0.45 }), stroke([[-w + 0.3, o.hem - h / 2], [w - 0.3, o.hem - h / 2]], tone(c, "deep"), h * 0.9, 0.16, [0.3, 0.9])];
}

/** A pale colour (relative luminance over 0.6): cream, white, sand, pastels. */
function pale(c: string): boolean {
  const n = parseInt(c.slice(1, 7), 16), lin = (v: number) => { const x = v / 255; return x <= 0.04 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255) > 0.6;
}

/** A shirt collar's two leaves, hinged at the neck, their points towards the chest (smaller on a child). A printed shirt's collar is cut from its print. */
function collar(ctx: PartCtx, c: string, open: number, own = true, wing = 4): Shape[] {
  const b = ctx.body, T = b.torsoL, nw = b.neckW / 2 + 1.4, kx = sizeK(b), ky = neckK(b), tip = -T + open;
  const leaf = (s: 1 | -1, dy = 0): Path => smooth(mx([[nw * 0.12, tip + dy, 0], [nw + 0.6, -T - 1.6 * ky + dy, 0], [nw + wing * kx, -T + 1.3 * ky + dy], [nw * 0.45 + wing * 0.65 * kx, tip - 0.3 + dy, 0]], s), true, 1);
  // on pale cloth the light leaves would vanish: there each casts a soft shadow under its lower edges
  const shadow: Shape[] = [];
  if (pale(c)) shadow.push({ path: new PathK().add(leaf(-1, 0.8 * ky)).add(leaf(1, 0.8 * ky)), fill: tone(c, "deep"), flat: true, opacity: 0.45 });
  if (own && ctx.pattern) return [...shadow, ...cloth(ctx, leaf(-1), c, tip), ...cloth(ctx, leaf(1), c, tip)];
  return [...shadow, P(leaf(-1), tone(c, "light")), P(leaf(1), mix(c, tone(c, "light"), 0.6))];
}

/** Buttons down the centre from `y0` to `y1`. */
const buttons = (n: number, y0: number, y1: number, c: string, r = 0.55, x = 0.6): Shape[] =>
  Array.from({ length: n }, (_, i) => ({ path: ellipse(x, y0 + (y1 - y0) * (n > 1 ? i / (n - 1) : 0), r), fill: tone(c, "deep"), flat: true, opacity: 0.8 }));

/** A band on both sleeves from `from` to `to` (a hem, a cuff, a roll), as wide as `sleeves` with `extra`. */
function band(b: BodyDims, c: string, from: number, to: number, extra: number, spec: Partial<StripSpec> = {}): Item[] {
  const w: [number, number, number] = [b.armW[0] * 1.18 + extra, b.armW[1] * 1.16 + extra, b.armW[2] * 1.12 + extra];
  return (["arm_l", "arm_r"] as const).map(chain => ({ layer: "sleeve", bone: "spine", strip: { chain, widths: w, color: c, from, to, ...spec } }));
}

/** Skin under a neckline deeper than the neck reaches: draw/'s `chestPatch`, flat, since the cloth's edge lies over all of its own. */
const skinUnder = (b: BodyDims, skin: string, d: number, w: number): Shape => ({ ...chestPatch(b, skin, d, w), flat: true });

/** A softer shade for a hem or a cuff band, between the cloth and its shade. */
const half = (c: string) => mix(c, tone(c, "shade"), 0.45);

/** Both views from a front and a back torso piece and the arms they share. */
const views = (front: Item, back: Item, arms: Item[], backArms = arms): Out => ({ front: [front, ...arms], back: [back, ...backArms] });

// ---- shirts ----------------------------------------------------------------------------------------

/** The shirt's body: collar, placket, buttons, a pocket on the wearer's left; the back with its collar stand, yoke and pleat. */
function shirt(ctx: PartCtx, c: string): [Item, Item] {
  const b = ctx.body, T = b.torsoL, ky = neckK(b), hem = 7 * hemK(b);
  // the opening reaches the bottom of the neck (5 cm below the shoulder line), so no skin patch is needed under it
  const cut: Cut = { neck: 5.6, drop: 1.6, loose: 1.4, hem }, open = 6.4 * ky - 0.2, nw = b.neckW / 2 + 1.4;
  const kid = b.build === "child" || b.build === "toddler", pl = b.chestW * 0.1, pw = b.chestW * (kid ? 0.2 : 0.23), py = -T + T * 0.28, ph = T * 0.15;
  const pocket = smooth([[pl, py, 0], [pl + pw, py, 0], [pl + pw, py + ph - 0.8], [pl + pw / 2, py + ph, 0], [pl, py + ph - 0.8]], true, 1);
  const lit = ctx.pattern ? c : tone(c, "light");
  const front = torso(ctx, c, cut, [
    stroke([[0.6, -T + open], [0.6, hem + 1.2]], tone(c, "shade"), 0.55, 0.7), ...buttons(4, -T + open + T * 0.1, hem - 2.5, c),
    ...cloth(ctx, pocket, lit, py + ph), stroke([[pl + 0.4, py + 1.1], [pl + pw - 0.4, py + 1.1]], tone(c, "shade"), 0.35, 0.6, [0.6, 0.45]),
    ...collar(ctx, c, open),
  ]);
  // the back: the collar's stand round the nape, the yoke seam and a box pleat under it
  const stand: Pt[] = [[-nw - 0.9, -T - 0.2], [-nw - 0.4, -T - 1.9 * ky, 0], [nw + 0.4, -T - 1.9 * ky, 0], [nw + 0.9, -T - 0.2], [0, -T + 0.9]];
  const yoke = -T + T * 0.17;
  const back = torso(ctx, c, { ...cut, back: true }, [
    S(stand, lit), stroke([[-b.chestW * 0.42, yoke], [0, yoke + 0.5], [b.chestW * 0.42, yoke]], tone(c, "shade"), 0.5, 0.55),
    stroke([[-1.2, yoke + 0.4], [-1.2, yoke + T * 0.18]], tone(c, "shade"), 0.45, 0.5), stroke([[1.2, yoke + 0.4], [1.2, yoke + T * 0.18]], tone(c, "shade"), 0.45, 0.5),
    stroke(hemLine(b, cut, 1.1), tone(c, "shade"), 0.35, 0.5, [0.7, 0.5]),
  ]);
  return [front, back];
}

/** A V-necked sweater's ribbed V. */
const vRib = (b: BodyDims, c: string, o: Cut): Shape => stroke(neckLine(b, o, 0.9), tone(c, "shade"), 1.7, 0.75);

export const TOPS: Record<string, PartDef> = {
  top_tee: top("T-shirt", "tişört", ["fab_05"], (ctx, c) => {
    const b = ctx.body, T = b.torsoL, cut: Cut = { neck: 4.4, drop: 0.8, loose: 1, hem: 6 * hemK(b) }, bk: Cut = { ...cut, back: true };
    const front = torso(ctx, c, cut, [
      stroke(neckLine(b, cut, 0.65), tone(c, "shade"), 1.2, 0.7), stroke(hemLine(b, cut, 1.1), tone(c, "shade"), 0.35, 0.6, [0.7, 0.5]),
      stroke([[-b.waistW * 0.22, -T * 0.52], [-b.waistW * 0.08, -T * 0.3]], tone(c, "shade"), 0.6, 0.5),
      stroke([[b.waistW * 0.16, -T * 0.16], [b.waistW * 0.3, -T * 0.06]], tone(c, "shade"), 0.5, 0.4),
    ]);
    const back = torso(ctx, c, bk, [stroke(neckLine(b, bk, 0.6), tone(c, "shade"), 1.1, 0.6), stroke(hemLine(b, bk, 1.1), tone(c, "shade"), 0.35, 0.6, [0.7, 0.5])]);
    return views(front, back, [...printedSleeves(ctx, c, 0.42, 1.6), ...band(b, half(c), 0.385, 0.42, 1.7)]);
  }, { patterns: PRINTS, tags: ["casual", "summer", "school", "istanbul"] }),

  top_shirt: top("Shirt", "gömlek", ["fab_02"], (ctx, c) => {
    const b = ctx.body, [front, back] = shirt(ctx, c);
    return views(front, back, [...printedSleeves(ctx, c, 0.96, 2), ...band(b, tone(c, "light"), 0.89, 0.97, 2.3)]);
  }, { patterns: PRINTS, tags: ["formal", "work", "school", "modest", "collared"] }),

  // the shirt with its sleeves rolled to just below the elbow: a thick turned-up band with its folds, the forearm bare
  top_shirt_rolled: top("Shirt, sleeves rolled", "kıvrık kollu gömlek", ["fab_35"], (ctx, c) => {
    const b = ctx.body, [front, back] = shirt(ctx, c);
    const arms = [...printedSleeves(ctx, c, 0.6, 2), ...band(b, tone(c, "light"), 0.53, 0.63, 2.9, { stripes: [half(c), 3, 0.17] })];
    return views(front, back, arms);
  }, { patterns: PRINTS, builds: ["adult", "elder", "child"], tags: ["casual", "work", "summer", "istanbul", "collared"] }),

  top_sweater: top("Sweater", "kazak", ["fab_12"], (ctx, c) => {
    const b = ctx.body, T = b.torsoL, loose = b.armW[0] > 12 ? 2.4 : 1.8, cut: Cut = { neck: 3.4, drop: 0, loose, hem: 7.5 * hemK(b) }, bk: Cut = { ...cut, back: true };
    const rib = tone(c, "shade"), vs = [0, 1, 2].map(i => stroke([[-b.chestW * 0.2 - 1.1, -T * 0.6 + i * 2.2], [-b.chestW * 0.2, -T * 0.6 + i * 2.2 + 1.1, 0], [-b.chestW * 0.2 + 1.1, -T * 0.6 + i * 2.2]], tone(c, "light"), 0.5, 0.55));
    const front = torso(ctx, c, cut, [stroke(neckLine(b, cut, 0.9), rib, 1.8, 0.75), stroke(neckLine(b, cut, 0.9), tone(c, "deep"), 1.6, 0.18, [0.3, 0.8]), ...hemRib(b, c, cut), ...vs]);
    const back = torso(ctx, c, bk, [stroke(neckLine(b, bk, 0.8), rib, 1.6, 0.7), ...hemRib(b, c, bk)]);
    return views(front, back, [...printedSleeves(ctx, c, 0.97, 2.4), ...band(b, rib, 0.89, 0.97, 2.6, { stripes: [tone(c, "deep"), 1.2, 0.12] })]);
  }, { patterns: PRINTS, tags: ["winter", "casual", "modest", "istanbul"] }),

  top_blouse: top("Blouse", "bluz", ["fab_07"], (ctx, c) => {
    const b = ctx.body, T = b.torsoL, ky = neckK(b), kx = sizeK(b), cut: Cut = { neck: 7.2, v: true, drop: 1.2, loose: 1.5, hem: 6.5 * hemK(b) }, d = depth(b, cut), nw = b.neckW / 2 + 1.4, top = -T - 0.6;
    const lapel = (s: 1 | -1): Path => smooth(mx([[nw + 0.2, top - 0.5, 0], [0.15, top + d, 0], [0.5, top + d + 2.2 * ky, 0], [nw + 4.2 * kx, top + 2.4 * ky, 0]], s), true, 1);
    const lit = ctx.pattern ? c : tone(c, "light");
    const lapels = ctx.pattern ? [...cloth(ctx, lapel(1), c, top + d), ...cloth(ctx, lapel(-1), c, top + d)] : [P(lapel(1), mix(c, lit, 0.55)), P(lapel(-1), lit)];
    const front = torso(ctx, c, cut, [
      ...lapels, stroke([[-nw - 0.1, top - 0.3], [0, top + d + 0.1, 0], [nw + 0.1, top - 0.3]], tone(c, "shade"), 0.5, 0.55),
      stroke([[-b.chestW * 0.22, -T * 0.52], [-b.chestW * 0.18, cut.hem - 1]], tone(c, "shade"), 0.6, 0.5), stroke([[b.chestW * 0.2, -T * 0.52], [b.chestW * 0.16, cut.hem - 1]], tone(c, "shade"), 0.6, 0.5),
    ], [skinUnder(b, ctx.skin, d + 0.4, b.neckW + 3)]);
    const bk: Cut = { ...cut, back: true }, yoke = -T + T * 0.16;
    const back = torso(ctx, c, bk, [stroke([[-b.chestW * 0.44, yoke], [0, yoke + 0.6], [b.chestW * 0.44, yoke]], tone(c, "shade"), 0.5, 0.5), stroke([[0, yoke + 0.6], [0, -T * 0.45]], tone(c, "shade"), 0.45, 0.35)]);
    return views(front, back, [...printedSleeves(ctx, c, 0.8, 3.2), ...band(b, lit, 0.735, 0.8, 3.5)]);
  }, { patterns: PRINTS, tags: ["formal", "work", "summer", "modest", "collared"] }),

  // a hoodie with its hood down: a boxy body, a kangaroo pocket, the hood a thick ring round the neck in
  // front (layer torso_over, with the neck redrawn inside its opening) and a pouch on the upper back;
  // children's hoodies have no cords
  top_hoodie: top("Hoodie", "kapüşonlu sweatshirt", ["fab_21"], (ctx, c) => {
    const b = ctx.body, T = b.torsoL, ky = neckK(b), kid = b.build === "child" || b.build === "toddler", nn = b.neckW / 2, R = (b.neckW + (kid ? 7 : 11)) / 2;
    const cut: Cut = { neck: 2, drop: 0, loose: 3, hem: 8 * hemK(b), hip: 3, boxy: true }, bk: Cut = { ...cut, back: true };
    const deep = tone(c, "deep"), shade = tone(c, "shade"), rh = 3 * ky;
    // the kangaroo pocket: a rounded trapezoid over the belly, its hand slots the slanted sides
    const pb = Math.min(b.chestW, b.waistW + 4) * 0.3, pt = pb * 0.62, py = -T * 0.36, pbot = cut.hem - rh - 0.6, pk = (pbot - py) * 0.32;
    const pocket: Pt[] = [[-pt, py, 0], [pt, py, 0], [pb, py + pk, 0], [pb, pbot, 0], [-pb, pbot, 0], [-pb, py + pk, 0]];
    const front = torso(ctx, c, cut, [...hemRib(b, c, cut), S(pocket, c), stroke([[pt, py], [pb, py + pk]], deep, 0.9, 0.7), stroke([[-pt, py], [-pb, py + pk]], deep, 0.9, 0.7), stroke([[-pb + 0.8, pbot - 0.9], [pb - 0.8, pbot - 0.9]], shade, 0.35, 0.5, [0.7, 0.5])]);
    const back = torso(ctx, c, bk, hemRib(b, c, bk));
    // the hood in front: a thick collar round the neck, crossing at a V; its inside shows round the neck
    const skin = ctx.skin, neck = (bottom: number): Shape[] => [
      S([[-nn, -b.neckL - 6], [nn, -b.neckL - 6], [nn + 0.3, bottom - 1.2], [0, bottom, 0], [-nn - 0.3, bottom - 1.2]], skin),
      { path: ellipse(0, -b.neckL - 1.5, b.neckW * 0.55, 3.2), fill: tone(skin, "shade"), flat: true, opacity: 0.7 },
    ];
    const ring: Pt[] = [[-R, 1.8], [-R + 1.2, -1.9], [-nn - 1.6, -3.5 * ky, 0], [nn + 1.6, -3.5 * ky, 0], [R - 1.2, -1.9], [R, 1.8], [R * 0.48, 6.4 * ky], [0, 9 * ky, 0], [-R * 0.48, 6.4 * ky]];
    const hole: Pt[] = [[-nn - 1, -3.2 * ky], [nn + 1, -3.2 * ky], [nn + 1.5, 1.4 * ky], [0, 5.6 * ky, 0], [-nn - 1.5, 1.4 * ky]];
    const cords = kid ? [] : [-1, 1].flatMap(s => {
      const x0 = s * (nn * 0.55 + 0.4), x1 = s * (nn * 0.6 + 0.9), y0 = 4 * ky, y1 = 15.5;
      return [S([[x0 - 0.45, y0, 0], [x0 + 0.45, y0, 0], [x1 + 0.5, y1, 0], [x1 - 0.5, y1, 0]], tone(c, "light")), P(rrect(x1 - 0.65, y1 - 0.2, 1.3, 2.6, 0.55), deep)];
    });
    // under a coat the hood is worn outside it, over its collar (chest_over), as people wear one
    const hl = ctx.avatar.outfit?.outer ? "chest_over" : "torso_over";
    const hoodFront: Item = { layer: hl, bone: "neck", group: { shapes: [
      S(ring, c), stroke([[nn + 1.8, 0.6 * ky], [R * 0.5, 5.2 * ky], [0.6, 8.6 * ky]], shade, 0.8, 0.55), stroke([[-R + 1.4, -1.2], [-nn - 2, -3 * ky]], tone(c, "light"), 0.8, 0.6),
      S(hole, deep), ...neck(1.8 * ky), ...cords,
    ] } };
    // the hood from behind: a pouch on the upper back with a centre seam, its rim round the neck
    const W = b.shoulderW * (kid ? 0.3 : 0.33), H = 14 * ky, t0 = -2.8 * ky;
    const pouch: Pt[] = [[-W, t0, 0], [W, t0, 0], [W * 1.04, H * 0.3], [W * 0.78, H * 0.75], [0, H], [-W * 0.78, H * 0.75], [-W * 1.04, H * 0.3]];
    const hoodBack: Item = { layer: hl, bone: "neck", group: { shapes: [
      S(pouch, c), S(mx([[W * 0.25, H * 0.15], [W * 1.02, H * 0.32], [W * 0.78, H * 0.75], [0, H], [W * 0.1, H * 0.7]], -1), shade, { flat: true, opacity: 0.45 }),
      stroke([[0, 0.8 * ky], [0, H - 0.5]], shade, 0.5, 0.6),
      // its rim: the edge of the opening, rolled over round the neck, the inside showing under it
      S([[-nn - 1.4, t0 + 0.2, 0], [nn + 1.4, t0 + 0.2, 0], [nn + 0.8, 1.6 * ky], [0, 2.4 * ky], [-nn - 0.8, 1.6 * ky]], deep),
      S([[-W + 0.4, t0 - 0.3, 0], [-nn - 0.8, t0 - 0.6, 0], [-nn - 1.2, 0.4], [-W * 0.7, 1.4 * ky]], tone(c, "light")), S([[W - 0.4, t0 - 0.3, 0], [nn + 0.8, t0 - 0.6, 0], [nn + 1.2, 0.4], [W * 0.7, 1.4 * ky]], mix(c, tone(c, "light"), 0.5)),
    ] } };
    const arms = [...sleeves(b, c, 0.97, 3), ...band(b, half(c), 0.89, 0.97, 3.2, { stripes: [shade, 1.1, 0.14] })];
    return { front: [front, hoodFront, ...arms], back: [back, hoodBack, ...arms] };
  }, { tags: ["casual", "winter", "school", "modest"] }),

  // the long-sleeved tee: the tee's body, snug sleeves to the wrist with a rib cuff; a base layer under aprons and scrubs
  top_tee_long: top("Long-sleeve tee", "uzun kollu tişört", ["fab_08"], (ctx, c) => {
    const b = ctx.body, T = b.torsoL, loose = b.armW[0] > 12 ? 1.4 : 1, cut: Cut = { neck: 4.4, drop: 0.8, loose, hem: 6 * hemK(b) }, bk: Cut = { ...cut, back: true };
    const front = torso(ctx, c, cut, [
      stroke(neckLine(b, cut, 0.65), tone(c, "shade"), 1.2, 0.7), stroke(hemLine(b, cut, 1.1), tone(c, "shade"), 0.35, 0.6, [0.7, 0.5]),
      stroke([[b.waistW * 0.2, -T * 0.55], [b.waistW * 0.06, -T * 0.34]], tone(c, "shade"), 0.6, 0.45),
    ]);
    const back = torso(ctx, c, bk, [stroke(neckLine(b, bk, 0.6), tone(c, "shade"), 1.1, 0.6), stroke(hemLine(b, bk, 1.1), tone(c, "shade"), 0.35, 0.6, [0.7, 0.5])]);
    return views(front, back, [...printedSleeves(ctx, c, 0.96, 1.2), ...band(b, half(c), 0.915, 0.965, 1.3)]);
  }, { patterns: PRINTS, tags: ["casual", "modest", "winter", "work"] }),

  // a shirt under a V-neck sweater: colour 1 the sweater, colour 2 the shirt (its collar in the V, its cuffs at the wrists)
  top_sweater_collar: top("Shirt and sweater", "gömlek ve kazak", ["fab_04", "fab_01"], (ctx, c) => {
    const b = ctx.body, T = b.torsoL, s2 = ctx.colors[1] ?? "#F7F3EA", ky = neckK(b), loose = b.armW[0] > 12 ? 2.4 : 1.8;
    const cut: Cut = { neck: 13, v: true, wide: 1.6, drop: 0, loose, hem: 7.5 * hemK(b) }, d = depth(b, cut), top = -T - 0.6, w = xs(b, cut).nw + 1;
    const shirtPatch = S([[-w, top - 0.4, 0], [w, top - 0.4, 0], [w * 0.75, top + d * 0.5], [0, top + d + 1.4, 0], [-w * 0.75, top + d * 0.5]], s2);
    const placket = stroke([[0.5, top + 5 * ky], [0.5, top + d + 1]], tone(s2, "shade"), 0.5, 0.7);
    const front = torso(ctx, c, cut, [vRib(b, c, cut), ...hemRib(b, c, cut), ...collar(ctx, s2, 5 * ky, false, 3)], [shirtPatch, placket, ...buttons(2, top + d * 0.62, top + d - 0.4, s2, 0.5, 0.5)]);
    const bk: Cut = { ...cut, back: true }, nw = b.neckW / 2 + 1.4;
    const stand = S([[-nw - 0.8, -T - 0.2], [-nw - 0.3, -T - 1.9 * ky, 0], [nw + 0.3, -T - 1.9 * ky, 0], [nw + 0.8, -T - 0.2], [0, -T + 0.6]], tone(s2, "light"));
    const back = torso(ctx, c, bk, [stand, stroke(neckLine(b, bk, 0.9), tone(c, "shade"), 1.6, 0.7), ...hemRib(b, c, bk)]);
    // the shirt's cuff first, so the sweater's sleeve and its rib cover where it starts
    return views(front, back, [...band(b, s2, 0.86, 0.975, 2.1), ...sleeves(b, c, 0.9, 2.4), ...band(b, tone(c, "shade"), 0.845, 0.9, 2.6, { stripes: [tone(c, "deep"), 1.2, 0.12] })]);
  }, { builds: ["adult", "elder", "child"], tags: ["work", "formal", "school", "winter", "modest", "collared"] }),

  // a blouse with a round Peter Pan collar (bebe yaka) in colour 2, a short buttoned placket, sleeves
  // gathered into a puff at the shoulder and a gathered cuff at the wrist
  top_blouse_collar: top("Blouse with a round collar", "bebe yaka bluz", ["fab_17", "fab_01"], (ctx, c) => {
    const b = ctx.body, T = b.torsoL, s2 = ctx.colors[1] ?? "#F7F3EA", ky = neckK(b), kid = b.build === "child" || b.build === "toddler";
    const cut: Cut = { neck: 4.2, drop: 0.8, loose: 1.4, hem: 6.5 * hemK(b) }, d = depth(b, cut), top = -T - 0.6, nw = b.neckW / 2 + 1.4;
    // each leaf from the centre front towards the shoulder and down the chest, rounded at the front; as
    // wide as the room between the sleeves' shoulders allows (the sleeves hang in front of the torso), and
    // deep, so it reads as a collar and not a binding; bigger on a child, as children's collars are
    const inner = b.shoulderW / 2 - b.armW[0] * 1.09 - 0.9, R = clamp(inner - nw - 0.3, 1.6, 7) / 0.95, D = kid ? b.headW * 0.26 : 10 * ky;
    const leaf = (s: 1 | -1, dy = 0): Path => smooth(mx([[nw + 0.4, top - 0.4 + dy, 0], [nw + R * 0.95, top + D * 0.3 + dy], [nw * 0.6 + R * 0.85, top + d * 0.5 + D * 0.85 + dy], [nw * 0.2 + R * 0.35, top + d + D * 0.75 + dy], [0.2, top + d + 0.4 + dy, 0], [nw * 0.66, top + d * 0.62 + dy]], s), true, 1);
    // each leaf casts a soft shadow on the cloth under its round edge; the leaf away from the light is a touch darker
    const leaves = ([1, -1] as const).flatMap(s => [{ path: leaf(s, 0.45), fill: tone(c, "shade"), flat: true, opacity: 0.55 } as Shape, P(leaf(s), s === 1 ? mix(s2, tone(s2, "shade"), 0.22) : s2)]);
    const front = torso(ctx, c, cut, [
      stroke([[0.55, top + d + 1], [0.55, -T * 0.48]], tone(c, "shade"), 0.5, 0.65), ...buttons(kid ? 3 : 4, top + d + D * 0.95, -T * 0.5, c, kid ? 0.42 : 0.5, 0.55),
      ...leaves,
    ]);
    const bk: Cut = { ...cut, back: true };
    const back = torso(ctx, c, bk, [S([[-nw - 0.9, -T - 0.3], [-nw - 0.4, -T - 1.4 * ky, 0], [nw + 0.4, -T - 1.4 * ky, 0], [nw + 0.9, -T - 0.3], [0, -T + 0.9]], s2)]);
    // the puff: a cap gathered into the sleeve at about a sixth of the arm, bulging up and out over the
    // shoulder (a piece on the upper-arm bone, so it stands out away from the body, never in over the collar)
    const w = sleeveW(b, 1.8), r = w[0] / 2, tb = 0.15, yb = armS(b, tb), k = sizeK(b);
    const puff = (sd: "l" | "r"): Item => {
      const o = sd === "l" ? 1 : -1, pts: Pt[] = [[-r * 0.98, yb, 0], [-r * 0.92, -r * 0.35], [-r * 0.3, -r - 1.1 * k], [r * 0.7, -r * 0.8 - 0.6 * k], [r + 1.7 * k, -r * 0.05], [r + 1.4 * k, yb * 0.6], [r + 0.3, yb, 0]];
      const path = smooth(pts.map(p => (p.length === 3 ? [o * p[0], p[1], 0] : [o * p[0], p[1]]) as Pt), true, 1);
      const sh = tone(c, "shade"), gathers = [-0.55, -0.1, 0.4, 0.85].map(f => stroke([[o * f * r, yb - 0.3], [o * f * r * 1.15, yb - r * 0.7]], sh, 0.45, 0.5));
      return { layer: "sleeve", bone: `arm_${sd}`, group: { shapes: [...cloth(ctx, path, c, yb), S(mx([[-r * 0.9, yb - 1.6 * k], [r + 1.5 * k, yb - 1.8 * k], [r + 0.3, yb, 0], [-r * 0.98, yb, 0]], o), sh, { flat: true, opacity: 0.4 }), ...gathers] } };
    };
    return views(front, back, [...printedSleeves(ctx, c, 0.95, 1.8), puff("l"), puff("r"), ...band(b, half(c), tb - 0.01, tb + 0.03, 2.2), ...band(b, half(c), 0.9, 0.97, 2.4, { stripes: [tone(c, "shade"), 0.9, 0.2] })]);
  }, { patterns: PRINTS, tags: ["formal", "school", "modest", "traditional", "collared"] }),

  // hospital scrubs: a boxy V-neck with piping, short wide sleeves, a chest pocket on the wearer's
  // left and two patch pockets, side vents; no name, badge or logo (the lanyard is a neck part)
  top_scrubs: top("Scrubs top", "hastane forması", ["fab_06"], (ctx, c) => {
    const b = ctx.body, T = b.torsoL, kx = sizeK(b), cut: Cut = { neck: 9, v: true, drop: 0, loose: 2.4, hip: 2.8, hem: 8 * hemK(b), boxy: true, slit: 3 * neckK(b) }, d = depth(b, cut);
    const pipe = tone(c, "light"), sh = tone(c, "shade");
    const patch = (x0: number, y0: number, w: number, h: number): Shape[] => {
      const path = rrect(x0, y0, w, h, [0, 0, 1, 1]);
      return [...cloth(ctx, path, c, y0 + h), stroke([[x0 + 0.3, y0 + 1], [x0 + w - 0.3, y0 + 1]], pipe, 0.35, 0.7, [0.6, 0.45])];
    };
    const pw = b.chestW * 0.2, lw = Math.min(b.chestW, b.waistW) * 0.22;
    const front = torso(ctx, c, cut, [
      stroke(neckLine(b, cut, 0.5), pipe, 0.9, 0.9), stroke(neckLine(b, cut, 1.2), sh, 0.4, 0.45),
      ...patch(b.chestW * 0.1, -T * 0.64, pw, T * 0.15),
      ...patch(-b.chestW * 0.08 - lw, -T * 0.22, lw, T * 0.22), ...patch(b.chestW * 0.08, -T * 0.22, lw, T * 0.22),
      stroke([[b.chestW * 0.1 + pw * 0.7, -T * 0.64 - 1.4 * kx], [b.chestW * 0.1 + pw * 0.7, -T * 0.64 + 1.6]], tone(c, "deep"), 0.7, 0.8),
    ], [skinUnder(b, ctx.skin, d + 0.6, b.neckW + 3.4)]);
    const bk: Cut = { ...cut, back: true, nape: 1.6 };
    const back = torso(ctx, c, bk, [stroke(neckLine(b, bk, 0.5), pipe, 0.9, 0.9)]);
    return views(front, back, [...printedSleeves(ctx, c, 0.38, 3.2), ...band(b, half(c), 0.345, 0.38, 3.3)]);
  }, { patterns: PRINTS, builds: ["adult", "elder"], tags: ["work", "uniform", "summer"] }),

  // the hip-length tunic worn over trousers from Turkey to Central and South Asia: an A-line to the
  // top of the thigh with side slits, a round neck with a short buttoned placket, long loose sleeves
  top_tunic: top("Tunic", "tunik", ["fab_50"], (ctx, c) => {
    const b = ctx.body, T = b.torsoL, k = neckK(b), flare = 6 * clamp(T / 43, 0.55, 1), wide = Math.max(b.hipW, b.chestW, b.waistW) / 2;
    const cut: Cut = { neck: 3.8, drop: 1.4, loose: 1.6, hem: b.thighL * 0.6, hip: wide + flare - b.hipW / 2, slit: 7 * k }, d = depth(b, cut), top = -T - 0.6;
    // the neckline and the placket edged with a light trim, and a trim along the hem, as tunics often are
    const pk = -T + 10 * k, trim = tone(c, "light");
    const front = torso(ctx, c, cut, [
      P(rrect(-1.2, top + d - 0.4, 2.4, pk - top - d + 0.4, [0, 0, 0.9, 0.9]), c), stroke([[-1.2, top + d], [-1.2, pk - 0.6], [0, pk + 0.1], [1.2, pk - 0.6], [1.2, top + d]], trim, 0.45, 0.8),
      ...buttons(3, top + d + 1.5, pk - 1.4, c, 0.42, 0), stroke(neckLine(b, cut, 0.55), trim, 1, 0.85),
      stroke([[-b.chestW * 0.24, -T * 0.4], [-wide - flare * 0.45, cut.hem - 1]], tone(c, "shade"), 0.6, 0.45),
      stroke([[b.chestW * 0.22, -T * 0.36], [wide + flare * 0.3, cut.hem - 1.5]], tone(c, "shade"), 0.6, 0.45),
      stroke(hemLine(b, cut, 1.6), trim, 0.7, 0.75),
    ]);
    const bk: Cut = { ...cut, back: true }, yoke = -T + T * 0.16;
    const back = torso(ctx, c, bk, [stroke(neckLine(b, bk, 0.55), trim, 1, 0.8), stroke([[-b.chestW * 0.44, yoke], [b.chestW * 0.44, yoke]], tone(c, "shade"), 0.5, 0.5), stroke(hemLine(b, bk, 1.6), trim, 0.7, 0.75)]);
    return views(front, back, printedSleeves(ctx, c, 0.9, 2.4));
  }, { patterns: PRINTS, tags: ["casual", "modest", "summer", "istanbul"] }),

  // the baby's bodysuit (zıbın, body): an envelope neck bound in colour 2, cap sleeves, the leg
  // openings bound too and three snaps at the crotch; it covers the hips like a romper and is worn on
  // its own, so it hides the bottom (which stays in the document and comes back when it is taken off);
  // a toddler's piece only (an older child wears a tee)
  top_bodysuit: top("Baby bodysuit", "zıbın", ["fab_01", "fab_15"], (ctx, c) => {
    const b = ctx.body, T = b.torsoL, s2 = ctx.colors[1] ?? "#E58FA0", ky = neckK(b), kx = sizeK(b), y = ys(b);
    const cut: Cut = { neck: 3.4, drop: 0, loose: 1, hem: 0, hip: 1.4 }, x = xs(b, cut), cr = b.thighL * 0.3, cw = b.hipW * 0.13;
    const suit = (back: boolean): Pt[] => {
      const o = back ? { ...cut, back: true } : cut, d = depth(b, o), leg = back ? 1.2 : -1, low = back ? cr + 0.8 : cr;
      const side = (s: 1 | -1): Pt[] => mx([[x.nw, y.top, 0], [x.sw - 1.2, y.slope], [x.sw + 0.3, y.sh, 0], [x.cw, y.chest], [x.ww, y.waist], [x.hw, leg, 0], [x.hw * 0.6, low * 0.72], [cw * (back ? 1.3 : 1), low, 0]], s);
      return [...side(-1), ...side(1).reverse(), [x.nw * 0.66, y.top + d * 0.62], [0, y.top + d], [-x.nw * 0.66, y.top + d * 0.62]];
    };
    const legHole = (s: 1 | -1, back: boolean): Shape => stroke(mx([[x.hw - 0.3, back ? 1.6 : -0.4], [x.hw * 0.6, (back ? cr + 0.8 : cr) * 0.72 - 0.5], [cw * (back ? 1.3 : 1) + 0.2, (back ? cr + 0.8 : cr) - 0.6]], s), s2, 0.9, 0.95);
    const arms = [...printedSleeves(ctx, c, 0.3, 1.8), ...band(b, s2, 0.265, 0.3, 2)];
    const fold = (s: 1 | -1): Shape => S(mx([[x.nw - 0.2, y.top + 0.2, 0], [x.nw + 2.8 * kx, y.top + 0.9 * ky, 0], [x.nw + 0.5, y.top + 3 * ky, 0]], s), tone(c, "shade"), { flat: true, opacity: 0.45 });
    const piece = (back: boolean): Item => {
      const o = back ? { ...cut, back: true } : cut, path = smooth(suit(back), true, 1);
      return { layer: "torso", bone: "spine", group: { shapes: [
        ...cloth(ctx, path, c, back ? cr + 0.8 : cr), sideShade(b, c, { ...o, hem: -1 }), fold(1), fold(-1),
        stroke(neckLine(b, o, 0.45), s2, 1.1, 0.95), legHole(1, back), legHole(-1, back),
        ...(back ? [stroke([[0, y.top + 2], [0, -T * 0.2]], tone(c, "shade"), 0.4, 0.4)] : [-1, 0, 1].map(i => ({ path: ellipse(i * cw * 0.55, cr - 1.1, 0.42), fill: tone(s2, "deep"), flat: true, opacity: 0.85 } as Shape))),
      ] } };
    };
    return views(piece(false), piece(true), arms);
  }, { patterns: ["pat_stripe_h", "pat_dots", "pat_gingham", "pat_floral"], builds: ["toddler"], hides: ["bottom"], tags: ["kids", "home", "casual"] }),
};
