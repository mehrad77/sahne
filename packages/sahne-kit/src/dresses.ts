// Dresses (`outfit.dress`): one part that replaces the top and the bottom (`replaces: ["top",
// "bottom"]`). A dress draws its bodice on the spine bone (layer `torso`), its skirt on the hips
// bone (layer `hips`) and its sleeves on layer `sleeve`, so it bends with the body like the parts it
// replaces. The bodice ends 1.5 cm below its waist seam and the skirt starts 2 cm above it, under
// the bodice and narrower, so a lean of the spine never opens a gap; a band at the seam hides the
// join. Spine and hips pivot at the same point, so one print laid out from the skirt's hem runs on
// across the seam. A shalwar kameez is one tunic on the spine and its trousers as leg strips.
//
// THE LOWER ARTIST'S SECOND FILE (with bottoms.ts): add parts to `DRESSES` (ids `dress_*`,
// permanent). Shared helpers are in draw/ (`sleeves`, `cuffs`, `chestPatch`, `printed`,
// `stripPrint`); the skirt and leg helpers are bottoms.ts's. The midi dress is the template the
// others reuse (`bodice`, `dress`); long dresses are `modest`.

import { smooth, rect, rrect, ellipse, tone, mix, type BodyDims, type StripSpec, type Group, type Item, type PartCtx, type PartDef, type PartOut, type Path, type Shape, type Vec2 } from "sahne";
import { named, S, line, flat, chestPatch, sleeves, cuffs, printed, stripPrint, inksOf, printScale, type Pt } from "./draw/index.ts";
import { skirtGroup, legItems, shadeOf, legAt, widthAt, hipX, det, away, type SkirtCut, type View, type W3 } from "./bottoms.ts";

// ---- the bodice ----------------------------------------------------------------------------------

export interface BodiceCut {
  /** How far the front neckline dips below the shoulder line (cm); behind it is 1.2 unless `backNeck`. */
  neck: number;
  /** The neck opening's half width at the shoulder line (default the neck's, as a top's). */
  neckW?: number;
  backNeck?: number;
  /** Ease over the body, each side (cm). */
  loose: number;
  /** The waist seam's y on the spine bone. */
  seam: number;
  /** Straight down from the chest: no waist. */
  straight?: boolean;
}

/** Where a bodice's armpit sits: a top's 14.5 cm below the shoulder line, higher on a child's short torso. */
const armpitY = (b: BodyDims): number => -b.torsoL + Math.min(14.5, b.torsoL * 0.4);

/** A bodice's half width at `y` on the spine bone: the chest, in to the waist, out to the hips. */
export function bodiceW(b: BodyDims, o: BodiceCut, y: number): number {
  const cw = b.chestW / 2 + o.loose, ww = b.waistW / 2 + o.loose * 1.3, hw = b.hipW / 2 + o.loose, yc = armpitY(b), yw = -b.torsoL * 0.32;
  const w = y <= yc ? cw : y <= yw ? cw + (ww - cw) * (y - yc) / (yw - yc || 1) : ww + (hw - ww) * Math.min(1, (y - yw) / -yw);
  return o.straight ? Math.max(w, cw) : w;
}

/** A bodice's outline on the spine bone, from the shoulders to 1.5 cm below its seam. */
export function bodiceOutline(b: BodyDims, o: BodiceCut, view: View): Pt[] {
  const T = b.torsoL, sw = b.shoulderW / 2, nw = o.neckW ?? b.neckW / 2 + 1.4, yc = armpitY(b), hem = o.seam + 1.5, wh = bodiceW(b, o, hem);
  const dip = view === "back" ? o.backNeck ?? 1.2 : o.neck;
  return [
    [-nw, -T - 0.6, 0], [-(sw - 1.2), -T + 1.4], [-(sw + 0.3), -T + 4.6, 0], [-bodiceW(b, o, yc), yc], [-wh, hem, 0],
    [0, hem + 0.3], [wh, hem, 0], [bodiceW(b, o, yc), yc], [sw + 0.3, -T + 4.6, 0], [sw - 1.2, -T + 1.4], [nw, -T - 0.6, 0],
    [nw * 0.55, -T - 0.6 + dip * 0.7], [0, -T - 0.6 + dip], [-nw * 0.55, -T - 0.6 + dip * 0.7],
  ];
}

/** The neckline of a bodice as a line (for a facing or a trim along it). */
const necklinePts = (b: BodyDims, o: BodiceCut, view: View, inset = 0.5): Vec2[] => {
  const T = b.torsoL, nw = (o.neckW ?? b.neckW / 2 + 1.4) - inset * 0.6, dip = (view === "back" ? o.backNeck ?? 1.2 : o.neck) + inset;
  return [[-nw, -T - 0.6 + inset * 0.5], [-nw * 0.55, -T - 0.6 + dip * 0.7], [0, -T - 0.6 + dip], [nw * 0.55, -T - 0.6 + dip * 0.7], [nw, -T - 0.6 + inset * 0.5]];
};

/**
 * A bodice piece: skin under a wide or deep neckline, the ground and its print (laid out from the
 * dress's hem), the shade on the side away from the light, and the part's own details over them.
 */
export function bodice(ctx: PartCtx, c: string, o: BodiceCut, view: View, hem: number, extra: (path: Path) => Shape[] = () => []): Group {
  const b = ctx.body, out = bodiceOutline(b, o, view), path = smooth(out, true, 1), a = away(view), nw = o.neckW ?? b.neckW / 2 + 1.4, T = b.torsoL;
  const dip = view === "back" ? o.backNeck ?? 1.2 : o.neck;
  const shapes: Shape[] = [];
  if (dip > 4.5 || nw > b.neckW / 2 + 2) shapes.push(chestPatch(b, ctx.skin, dip, nw * 2));
  shapes.push(S(out, c), ...printed(ctx, path, { hem }),
    { path: rect(a > 0 ? bodiceW(b, o, o.seam) * 0.55 : -bodiceW(b, o, o.seam) * 1.6, -T + 3, bodiceW(b, o, o.seam) * 1.05, T + 6), ...shadeOf(ctx, c, 0.45), clip: path },
    ...extra(path));
  return { shapes };
}

/**
 * A dress's sleeves wear its print as tops.ts's sleeves do (a copy of its `armPrint`, `armS` and
 * `sleevePrint`, which that file does not export): stripes run round the strip and over its shoulder
 * cap; any other print is laid as flat pieces on the arm bones inside the strip's light rim (the upper
 * sleeve on `arm_*`, the forearm on `forearm_*`, rows counted from the elbow so they run on), over a
 * strip tinted as the print looks from a step away, which shows only where a bent elbow opens. Sleeves
 * of the bare ground would read as a shrug over a pinafore. The kilim border runs along the hem only,
 * so its sleeves stay the ground.
 */
export function sleeveTint(ctx: PartCtx): Partial<StripSpec> {
  const id = ctx.pattern, g = ctx.colors[0] ?? "#888888";
  if (!id || id === "pat_stripe_h") return stripPrint(ctx);
  if (id === "pat_kilim_band") return {};
  const [a, b] = inksOf(id, g, ctx.inks), k = printScale(ctx.body.build);
  if (id === "pat_check" || id === "pat_gingham") return { color: mix(g, a, 0.3), stripes: [mix(g, a, 0.55), (id === "pat_check" ? 3.2 : 1.4) * k, 0.5] };
  return { color: mix(mix(g, a, id === "pat_dots" ? 0.12 : 0.14), b, id === "pat_dots" ? 0 : 0.1) };
}

/** How far down a straight arm (cm from the shoulder joint) a strip's point at `t` lies: the quadratic through the three joints. */
function armS(b: BodyDims, t: number): number {
  const L = b.upperArmL + b.foreArmL, f = b.upperArmL / L;
  return 2 * t * (1 - t) * (2 * f - 0.5) * L + t * t * L;
}

/** The strip renderers' core: the light rim is the outer fifth of a strip. */
const CORE = 0.8;

/** The print's pieces on both sleeves of widths `w` to `to` (none for no print or the kilim border). */
function sleevePieces(ctx: PartCtx, c: string, w: W3, to: number): Item[] {
  const id = ctx.pattern, b = ctx.body;
  if (!id || id === "pat_kilim_band") return [];
  const U = b.upperArmL, s = (t: number) => armS(b, t);
  const wAt = (t: number) => (t < 0.5 ? w[0] + (w[1] - w[0]) * t * 2 : w[1] + (w[2] - w[1]) * (t - 0.5) * 2) / 2 * CORE;
  const arc = (cy: number, r: number, a0: number, a1: number, n = 8): Pt[] => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [Math.cos(a) * r, cy + Math.sin(a) * r] as Pt; });
  const cloth = (path: Path, hem: number): Shape[] => [flat(path, c), ...printed(ctx, path, { hem })];
  if (id === "pat_stripe_h") {
    const sp = stripPrint(ctx);
    if (!sp.stripes) return [];
    const [g, p, duty] = sp.stripes, r = wAt(0), dome = smooth(arc(0.05, r, Math.PI, 2 * Math.PI), true, 1);
    const bands: Shape[] = [];
    for (let k = -Math.ceil(r / p); k < 0; k++) bands.push({ path: rrect(-r - 1, k * p, 2 * r + 2, duty * p, 0), fill: g, flat: true, clip: dome });
    return (["l", "r"] as const).map(sd => ({ layer: "sleeve", bone: `arm_${sd}`, group: { shapes: [flat(dome, sp.color ?? c), ...bands] } }));
  }
  const N = 6, side = (t0: number, t1: number, y0: number): [Pt[], Pt[]] => {
    const l: Pt[] = [], rr: Pt[] = [];
    for (let i = 0; i <= N; i++) { const t = t0 + (t1 - t0) * i / N, y = s(t) - y0; l.push([-wAt(t), y]); rr.push([wAt(t), y]); }
    return [l, rr];
  };
  const out: Item[] = [];
  for (const sd of ["l", "r"] as const) {
    const long = to > 0.5, end = Math.min(to, 0.5), [l, r] = side(0, end, 0), r0 = wAt(0), re = wAt(end), ye = s(end) + (long ? 0.3 : 0);
    const path = smooth([...arc(0, r0, Math.PI, 2 * Math.PI).slice(0, -1), ...r.slice(0, -1), [re, ye, 0], [-re, ye, 0], ...l.slice(1, -1).reverse()], true, 1);
    out.push({ layer: "sleeve", bone: `arm_${sd}`, group: { shapes: cloth(path, long ? U : ye) } });
    if (long) {
      const [l, r] = side(0.5, to, U), fore = smooth([[l[0][0], -0.3, 0], [r[0][0], -0.3, 0], ...r.slice(1, -1), [r[N][0], r[N][1], 0], [l[N][0], l[N][1], 0], ...l.slice(1, -1).reverse()], true, 1);
      out.push({ layer: "sleeve", bone: `forearm_${sd}`, group: { shapes: cloth(fore, 0) } });
    }
  }
  return out;
}

/** A dress's sleeves to `to` with `extra` ease (as draw/'s `sleeves`), wearing its print. */
function dressSleeves(ctx: PartCtx, c: string, to: number, extra: number): Item[] {
  const b = ctx.body, w: W3 = [b.armW[0] * 1.18 + extra, b.armW[1] * 1.16 + extra, b.armW[2] * 1.12 + extra];
  return [...sleeves(b, c, to, extra, "sleeve", sleeveTint(ctx)), ...sleevePieces(ctx, c, w, to)];
}

/** A sleeve's colour under its print (for a cuff cut from the same cloth). */
const sleeveColor = (ctx: PartCtx, c: string): string => (ctx.pattern && ctx.pattern !== "pat_stripe_h" ? sleeveTint(ctx).color ?? c : c);

/** A band over a waist seam (a sash, a belt): a cut piece across the bodice, cut to it. */
const seamBand = (b: BodyDims, o: BodiceCut, c: string, h: number, clip: Path): Shape => {
  const w = bodiceW(b, o, o.seam) + 1;
  return { path: rrect(-w, o.seam - h / 2, w * 2, h, Math.min(1, h / 2)), fill: c, clip };
};

/** What a dress is made of: the bodice, the skirt, the sleeves, the band at the seam. */
export interface DressCut {
  bodice: BodiceCut;
  skirt: SkirtCut;
  /** How far down the arm the sleeves reach (0 none) and how much wider than the arm (cm). */
  sleeve: number;
  sleeveExtra?: number;
  /** The band at the seam (colour 2), cm; 0 none. */
  band: number;
  folds?: number;
}

/**
 * A dress from its cut: the template every dress here reuses. `bodiceExtra` and `skirtExtra` add
 * a part's own details (a facing, a zip, a pocket); `more` adds whole items (cuffs).
 */
export function dress(ctx: PartCtx, cut: DressCut, o: { bodiceExtra?: (view: View, path: Path) => Shape[]; skirtExtra?: (view: View, path: Path, hw: number) => Shape[]; more?: (view: View) => Item[] } = {}): PartOut {
  const b = ctx.body, c = ctx.colors[0] ?? "#C4553A", c2 = ctx.colors[1] ?? c, hem = cut.skirt.hem;
  const skirt: SkirtCut = { ...cut.skirt, top: cut.bodice.seam - 2, topW: bodiceW(b, cut.bodice, cut.bodice.seam - 2) - 2 };
  const arms = cut.sleeve > 0 ? dressSleeves(ctx, c, cut.sleeve, cut.sleeveExtra ?? 1.6) : [];
  const view = (v: View): Item[] => [
    { layer: "hips", bone: "hips", group: skirtGroup(ctx, c, skirt, v, cut.folds ?? 2, (path, hw) => o.skirtExtra?.(v, path, hw) ?? []) },
    { layer: "torso", bone: "spine", group: bodice(ctx, c, cut.bodice, v, hem, path => [...(cut.band > 0 ? [seamBand(b, cut.bodice, c2, cut.band, path)] : []), ...(o.bodiceExtra?.(v, path) ?? [])]) },
    ...arms, ...(o.more?.(v) ?? []),
  ];
  return { front: view("front"), back: view("back") };
}

/** A centre-back zip from the neck down: a seam line with a light tape and a small pull. */
const zip = (b: BodyDims, c: string, to: number): Shape[] => {
  const T = b.torsoL, k = det(b);
  return [line([[0, -T + 0.8], [0, to]], tone(c, "deep"), 0.45, 0.55), line([[0.45, -T + 0.8], [0.45, to]], tone(c, "light"), 0.35, 0.5), { path: rrect(-0.2, -T + 1, 1.1 * k, 2 * k, 0.4), fill: tone(c, "deep"), flat: true, opacity: 0.7 }];
};

/** The patterns a dress may wear. */
const DRESS_PATTERNS = ["pat_stripe_h", "pat_check", "pat_gingham", "pat_dots", "pat_floral", "pat_iznik_tulip", "pat_kilim_band"];

/** A child's build. */
const young = (b: BodyDims) => b.build === "child" || b.build === "toddler";

// ---- the parts -------------------------------------------------------------------------------------

export const DRESSES: Record<string, PartDef> = {
  // the template: a fitted bodice with a scoop neck and short sleeves, a band at the waist (colour 2) and a skirt to mid-calf
  dress_midi: named("dress", "Midi dress", "midi elbise", { colors: 2, defaults: ["fab_12", "fab_02"], replaces: ["top", "bottom"], tags: ["casual", "work", "summer"], patterns: DRESS_PATTERNS, draw: ctx => {
    const b = ctx.body, T = b.torsoL, k = det(b), round = b.waistW >= b.hipW, c = ctx.colors[0] ?? "#C4553A";
    const cut: DressCut = {
      bodice: { neck: 7 * T / 43, neckW: b.neckW / 2 + 3.2 * k, backNeck: 3 * T / 43, loose: round ? 2.4 : 1, seam: b.build === "toddler" ? -T * 0.55 : -T * 0.32, straight: round },
      skirt: { hem: (b.legLen - b.footH) * (young(b) ? 0.74 : 0.78), flare: 9 * b.thighL / 37, ease: 2.6 },
      sleeve: 0.4, sleeveExtra: 1.8, band: 2.6 * k, folds: 3,
    };
    return dress(ctx, cut, {
      bodiceExtra: (view, path) => view === "front"
        // a facing round the neck, and soft darts under the bust
        ? [{ ...line(necklinePts(b, cut.bodice, view, 0.9), tone(c, "light"), 0.45, 0.55), clip: path }, ...(round ? [] : [-1, 1].map(s => line([[s * b.chestW * 0.2, cut.bodice.seam - 1], [s * b.chestW * 0.18, cut.bodice.seam - 6 * k]], tone(c, "deep"), 0.45, 0.35)))]
        : zip(b, c, cut.bodice.seam - 1.5),
      skirtExtra: (view, path) => view === "back" ? [line([[0, cut.bodice.seam], [0, cut.skirt.hem - 0.6]], tone(c, "deep"), 0.4, 0.4)] : [],
    });
  } }),

  // a long dress cut for covering (tesettür elbise): a high round neck, a loose straight bodice, long sleeves with
  // gathered cuffs, a skirt to the ankle and a self-tie belt (colour 2). An everyday dress, for anyone.
  dress_modest_long: named("dress", "Long modest dress", "kapalı uzun elbise", { colors: 2, defaults: ["fab_04", "fab_02"], replaces: ["top", "bottom"], tags: ["modest", "casual", "work", "winter", "istanbul"], patterns: DRESS_PATTERNS, draw: ctx => {
    const b = ctx.body, T = b.torsoL, k = det(b), c = ctx.colors[0] ?? "#2E3A59", c2 = ctx.colors[1] ?? c, round = b.waistW >= b.hipW;
    // a round body: the dress hangs loose from the chest, with a straight seam and no belt
    const cut: DressCut = {
      bodice: { neck: 2.4 * k, backNeck: 1.2, loose: 2.6, seam: b.build === "toddler" ? -T * 0.55 : -T * 0.3, straight: true },
      skirt: { hem: b.legLen - b.footH - (young(b) ? 2.2 : 1.6), flare: 10 * b.thighL / 37, ease: 4 },
      sleeve: 0.97, sleeveExtra: 2.4, band: round ? 0 : 2.2 * k, folds: 4,
    };
    const seamLine = (view: View, clip: Path): Shape[] => {
      const w = bodiceW(b, cut.bodice, cut.bodice.seam) + 1, y = cut.bodice.seam;
      return round ? [line([[-w, y + 0.2], [w, y + 0.2]], tone(c, "deep"), 0.5, view === "front" ? 0.45 : 0.35), line([[-w, y + 0.75], [w, y + 0.75]], tone(c, "light"), 0.35, 0.35)].map(l => ({ ...l, clip })) : [];
    };
    // the belt tied in a bow, off centre to the wearer's left: two loops, two tails, the knot
    const tie = (): Shape[] => {
      const x = bodiceW(b, cut.bodice, cut.bodice.seam) * 0.34, y = cut.bodice.seam, L = 8 * k + 2, r = 2.4 * k + 0.4;
      return [
        S([[x - 0.5, y + 0.4], [x + 0.3, y + 0.7], [x - 1.4 * k, y + L], [x - 3 * k, y + L - 0.8, 0]], tone(c2, "shade")),
        S([[x + 0.1, y + 0.5], [x + 0.9, y + 0.3], [x + 2.6 * k, y + L * 0.9, 0], [x + 1 * k, y + L * 0.92]], c2),
        S([[x, y, 0], [x - r * 1.6, y - r * 0.9], [x - r * 1.7, y + r * 0.5]], c2), S([[x, y, 0], [x + r * 1.6, y - r * 0.8], [x + r * 1.6, y + r * 0.55]], c2),
        { path: ellipse(x, y, 0.95 * k + 0.2, 1.15 * k + 0.2), fill: tone(c2, "light") },
      ];
    };
    return dress(ctx, cut, {
      bodiceExtra: (view, path) => view === "front"
        ? [line(necklinePts(b, cut.bodice, view, 0.7), tone(c, "deep"), 0.5, 0.4), ...seamLine(view, path), ...(round ? [] : tie())]
        : [...seamLine(view, path), ...zip(b, c, cut.bodice.seam - 1.2)],
      skirtExtra: (view, path) => view === "back" ? [line([[0, cut.bodice.seam], [0, cut.skirt.hem - 0.6]], tone(c, "deep"), 0.4, 0.4)] : [],
      // gathered cuffs at the wrists
      more: () => cuffs(b, tone(sleeveColor(ctx, c), "shade"), 0.9, 2.6),
    });
  } }),

  // a child's everyday dress: a round yoke and a big patch pocket (colour 2), short puffed sleeves, a full skirt to the knee
  dress_kids_play: named("dress", "Play dress", "çocuk elbisesi", { colors: 2, defaults: ["fab_11", "fab_02"], replaces: ["top", "bottom"], builds: ["child", "toddler"], tags: ["kids", "casual", "summer"], patterns: ["pat_stripe_h", "pat_dots", "pat_gingham", "pat_floral"], draw: ctx => {
    const b = ctx.body, T = b.torsoL, k = det(b), c = ctx.colors[0] ?? "#F2B705", c2 = ctx.colors[1] ?? tone(c, "light"), round = b.waistW >= b.hipW;
    const cut: DressCut = {
      bodice: { neck: 3.2 * T / 27, loose: round ? 2.2 : 1.5, seam: b.build === "toddler" || b.torsoL < 24 ? -T * 0.58 : -T * 0.36, straight: true },
      skirt: { hem: b.thighL * (b.build === "toddler" ? 0.95 : 1.02), flare: Math.max(4, b.thighL * 0.3), ease: 2.4 },
      sleeve: 0, band: 0, folds: 3,
    };
    const yc = armpitY(b);
    // the yoke: a cut piece over the shoulders with a round lower edge, cut to the bodice
    const yoke = (path: Path, view: View): Shape => ({ path: ellipse(0, -T - T * 0.12, bodiceW(b, cut.bodice, yc) * 1.3, T * (view === "front" ? 0.52 : 0.46)), fill: c2, clip: path });
    // puffed sleeves: wide at the shoulder, gathered into a band
    const puff: W3 = [b.armW[0] * 1.6 + 2.2, b.armW[1] * 1.15 + 1.2, b.armW[2] * 1.1];
    const arms = (["arm_l", "arm_r"] as const).flatMap((chain): Item[] => [
      { layer: "sleeve", bone: "spine", strip: { chain, widths: puff, color: c, from: 0, to: 0.3, ...sleeveTint(ctx) } },
    ]).concat(sleevePieces(ctx, c, puff, 0.3), (["arm_l", "arm_r"] as const).map((chain): Item => (
      { layer: "sleeve", bone: "spine", strip: { chain, widths: [puff[0] * 0.78, puff[1], puff[2]], color: c2, from: 0.27, to: 0.33 } })));
    return dress(ctx, cut, {
      bodiceExtra: (view, path) => [yoke(path, view), ...(view === "back"
        // the button placket behind
        ? [line([[0, -T * 0.7], [0, cut.bodice.seam + 1.2]], tone(c, "deep"), 0.4, 0.45), ...[0.62, 0.46, 0.3].map(f => ({ path: ellipse(0.9 * k, -T * f, 0.55 * k), fill: tone(c2, "deep"), flat: true, opacity: 0.85 } as Shape))]
        : [])],
      skirtExtra: (view, path, hw) => {
        const out: Shape[] = [];
        // a gathered waist: short creases under the seam
        for (let i = -3; i <= 3; i++) out.push(line([[i * bodiceW(b, cut.bodice, cut.bodice.seam) * 0.26, cut.bodice.seam + 1.6], [i * bodiceW(b, cut.bodice, cut.bodice.seam) * 0.3, cut.bodice.seam + 4.5 * k]], tone(c, "deep"), 0.4, 0.35));
        if (view === "front") {
          // a big patch pocket on the wearer's left
          const x = hw * 0.36, y = cut.skirt.hem * 0.42, pw = Math.max(5, hw * 0.42), ph = pw * 0.9, p = rrect(x - pw / 2, y, pw, ph, [0.4, 0.4, pw * 0.3, pw * 0.3]);
          out.push({ path: p, fill: c2 }, line([[x - pw / 2 + 0.4, y + 1.2 * k], [x + pw / 2 - 0.4, y + 1.2 * k]], tone(c2, "shade"), 0.35, 0.6));
        }
        return out;
      },
      more: () => arms,
    });
  } }),

  // shalwar kameez: a knee-length tunic with side slits, a placket and trim (colour 3), long sleeves with cuffs, and
  // full trousers gathered at the ankle (colour 2). Worn by everyone from South and Central Asia; the print is on the kameez.
  dress_shalwar_kameez: named("dress", "Shalwar kameez", "şalvar kamiz", { colors: 3, defaults: ["fab_09", "fab_02", "fab_10"], replaces: ["top", "bottom"], tags: ["traditional", "casual", "formal", "modest"], patterns: DRESS_PATTERNS, draw: ctx => {
    const b = ctx.body, T = b.torsoL, k = det(b), c = ctx.colors[0] ?? "#4E7A68", c2 = ctx.colors[1] ?? "#F0E2C8", c3 = ctx.colors[2] ?? tone(c, "light");
    const sw = b.shoulderW / 2, nw = b.neckW / 2 + 1.4, cw = b.chestW / 2 + 2.2, ww = b.waistW / 2 + 2.6, hw = Math.max(b.hipW / 2 + 2.6, ww), yc = armpitY(b);
    const H = (b.legLen - b.footH) * (b.build === "toddler" ? 0.65 : b.build === "child" ? 0.6 : 0.55), slit = Math.min(6, H * 0.2), flare = 1.6 * k;
    // the side slits: the seams open `Hs` down and the front panel's corners cut in by `gap` at the hem, so the back
    // panel (hanging `drop` lower, its inside in the deep tone) shows in a V past the hands
    const Hs = H - Math.min(15 * k, (H - slit) * 0.55), gap = 6.5 * k, drop = 1.4 * k;
    const neck = (view: View) => (view === "front" ? 2.2 * k : 1.2);
    const panel = (view: View): Pt[] => [
      [-nw, -T - 0.6, 0], [-(sw - 1.2), -T + 1.4], [-(sw + 0.3), -T + 4.6, 0], [-cw, yc], [-ww, -T * 0.32], [-hw, slit, 0], [-(hw + flare * 0.6), Hs, 0], [-(hw + flare - gap), H, 0],
      [0, H + 0.4], [hw + flare - gap, H, 0], [hw + flare * 0.6, Hs, 0], [hw, slit, 0], [ww, -T * 0.32], [cw, yc], [sw + 0.3, -T + 4.6, 0], [sw - 1.2, -T + 1.4], [nw, -T - 0.6, 0],
      [nw * 0.55, -T - 0.6 + neck(view) * 0.7], [0, -T - 0.6 + neck(view)], [-nw * 0.55, -T - 0.6 + neck(view) * 0.7],
    ];
    const tunic = (view: View): Group => {
      const out = panel(view), path = smooth(out, true, 1), a = away(view);
      // the other panel shows past the slits, from the hip down
      const flap = (s: 1 | -1): Shape[] => {
        const pts: Pt[] = [[s * (hw - 1.2), Hs - 3, 0], [s * (hw + flare * 0.6 + 0.2), Hs - 2, 0], [s * (hw + flare + 0.3), H + drop, 0], [s * (hw + flare - gap - 2), H + drop + 0.2, 0]], p = smooth(pts, true, 1);
        return [S(pts, tone(c, "deep")), { path: rect(-hw * 2, H + drop - 1.6 * k, hw * 4, 2.2 * k), fill: tone(c3, "shade"), flat: true, clip: p }];
      };
      // the slit's edge: a soft shadow the front panel throws on the back one
      const edge = (s: 1 | -1): Shape => line([[s * (hw + flare * 0.6 - 0.1), Hs], [s * (hw + flare - gap - 0.1), H]], tone(c, "deep"), 0.7, 0.4);
      const shapes: Shape[] = [...flap(1), ...flap(-1), edge(1), edge(-1), S(out, c), ...printed(ctx, path, { hem: H }),
        { path: rect(a > 0 ? cw * 0.5 : -cw * 1.9, -T + 3, cw * 1.4, T + H), ...shadeOf(ctx, c, 0.4), clip: path },
        // trim along the hem and round the neck
        { path: rect(-hw * 2, H - 1.6 * k, hw * 4, 0.9 * k), fill: c3, flat: true, clip: path },
        line(necklinePts(b, { neck: neck(view), loose: 0, seam: 0 }, view, 0.6), c3, 1.1 * k, 1)];
      if (view === "front") {
        // the placket with its buttons
        const y0 = -T - 0.6 + neck(view), L = 11 * k;
        shapes.push({ path: rrect(-0.9 * k, y0, 1.8 * k, L, 0.3), fill: c3, flat: true }, line([[0, y0 + 0.4], [0, y0 + L - 0.3]], tone(c3, "deep"), 0.3, 0.5),
          ...[0.3, 0.6, 0.88].map(f => ({ path: ellipse(0, y0 + L * f, 0.45 * k), fill: tone(c3, "deep"), flat: true, opacity: 0.85 } as Shape)));
      }
      return { shapes };
    };
    // the shalwar: full legs gathered at the ankle, plain (the print is the kameez's)
    // (no wider at the top than the kameez, which covers them to the knee)
    const hx = hipX(b), w: W3 = [Math.min(b.legW[0] * 1.5 + 4 * k, 2 * (hw - 1.2 - hx)), b.legW[1] * 1.4 + 3.5 * k, b.legW[2] * 1.05 + 1.8], to = 0.97;
    const legs = (view: View) => legItems(ctx, c2, { w, to, plain: true, draw: (_s, bone) => bone === "shin" ? [0, 1, 2].map(i => {
      const y = legAt(b, to) - b.thighL - (1.2 + i * 1.7) * k, h = widthAt(w, 0.9) * 0.36;
      return line([[-h, y - 0.3], [0, y + 0.5], [h, y - 0.2]], tone(c2, "deep"), 0.4, 0.35);
    }) : [] }, view);
    const arms = [...dressSleeves(ctx, c, 0.95, 2.2), ...cuffs(b, c3, 0.89, 2.3)];
    return {
      front: [...legs("front"), { layer: "torso", bone: "spine", group: tunic("front") }, ...arms],
      back: [...legs("back"), { layer: "torso", bone: "spine", group: tunic("back") }, ...arms],
    };
  } }),
};
