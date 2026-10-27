// Shoes (`outfit.shoes`): a piece per foot on foot_l / foot_r (layer `shoe`; the pivot at the ankle,
// the floor at y = footH), and for boots a shaft on shin_l / shin_r (layer `shaft`, over the trouser).
//
// THE SHOES ARTIST'S FILE: add parts to `SHOES` (ids `shoes_*`, permanent). Shared helpers are in
// draw/ (`shoe`, `feet`, `bareFoot` for every shoe that shows skin, `bootShafts`, `shoeHalfWidth`,
// `footScale`, `darkSole`). The back view shows the heel, the counter and the straps: it differs
// from the front. A print goes on the upper only (`printed(ctx, upperPath)`), never on the sole.
//
// Seen from the front a shoe is its toe box: the opening round the ankle (centred on the leg, so no
// skin shows beside it), widening to the toe box on the foot (centred 0.8 cm out, so the toes point
// a little outwards), the instep a shade darker than the toe, the sole a band under it (a fraction
// of footH: leather 0.22, rubber 0.34). From behind it is the heel cup, with the forefoot flaring
// beside it near the floor. Light comes from the upper left on screen in both views: the back view
// is mirrored, so its shade and gloss are drawn mirrored too (`a`, +1 in front and -1 behind: the
// side away from the light, as `away(view)` in bottoms.ts). A boot's shaft is a rigid group on the
// shin, as a rubber or leather shaft is: it covers whatever trouser leg the bottom or dress draws into
// it (`trouserLeg`), else it fits round the bare leg, so a skirt shows a slim boot and trousers go into
// a wider one; a very full leg (şalvar) is tucked in, so the boot keeps its shape.

import { ellipse, rrect, smooth, band, tone, luma, humanoid, Path, type BodyDims, type Group, type Item, type PartCtx, type PartDef, type PartOut, type Shape, type Vec2 } from "sahne";
import { named, S, P, line, bareFoot, shoeHalfWidth, footScale, darkSole, printed, patternsFor, type Pt } from "./draw/index.ts";
import { stitch, curve } from "./bottoms.ts";

/** The prints a shoe's upper may wear (`patternsFor("shoes")`). */
const PRINTS = ["pat_stripe_h", "pat_check", "pat_dots"];

/** Of the prints a part's plan lists, those drawn and allowed on shoes (the rest join as they are drawn). */
const prints = (...ids: string[]) => patternsFor("shoes").filter(p => ids.includes(p));
const SPORTY = prints("pat_stripe_h", "pat_stripe_v", "pat_dots", "pat_check", "pat_tartan", "pat_stars");


// ---- one foot ----------------------------------------------------------------------------------------

/**
 * One foot's frame: the shoe's centre `x` (side 1 is the left foot, its big toe at -x), half width
 * `w`, the floor `h`, the detail scale `s`, and `a`, the half width of an opening round the ankle.
 */
interface Foot { b: BodyDims; side: 1 | -1; x: number; w: number; h: number; s: number; a: number }
const footOf = (b: BodyDims, side: 1 | -1, wider = 0.6): Foot => {
  const w = shoeHalfWidth(b) + wider;
  return { b, side, x: side * 0.8, w, h: b.footH, s: footScale(b), a: Math.min(w * 0.94, b.legW[2] / 2 + 0.3) };
};

/** Where a shoe's centre line is at a height: on the ankle at the opening (`top`), on the toe at the floor. */
const midAt = ({ x, h }: Foot, top: number, y: number) => x * Math.min(1, Math.max(0, (y - top) / (h - top)));

/** A closed shoe's upper from the front: the opening at `top` dipping `throat` cm at the front, the toe box widest low down, the underside at h + 0.3. */
function upperFront({ x, w, h, a }: Foot, top: number, throat = 0.4, bulge = 1): Pt[] {
  const g = w * bulge;
  return [[-a, top, 0], [-a * 0.5, top + throat * 0.6], [0, top + throat], [a * 0.5, top + throat * 0.6], [a, top, 0], [a + (x + g - a) * 0.15, h * 0.14], [x + g, h * 0.68], [x + g * 0.9, h + 0.3, 0], [x - g * 0.9, h + 0.3, 0], [x - g, h * 0.68], [-a + (x - g + a) * 0.15, h * 0.14]];
}

/** The same shoe from behind: the heel cup over the ankle. */
function heelCup({ w, h, a, side }: Foot, top: number): Pt[] {
  const c = side * 0.2;
  return [[-a, top, 0], [a, top, 0], [c + w * 0.86, h * 0.42], [c + w * 0.78, h + 0.25], [c, h + 0.45], [c - w * 0.78, h + 0.25], [c - w * 0.86, h * 0.42]];
}

/** The heel's centre in the back view (a little out from the ankle, under the leg). */
const heelX = (f: Foot) => f.side * 0.2;

/** The forefoot showing beside the heel near the floor on the outer side (the toes point a little outwards), in the back view, with the upper's print. */
function toeFlare(ctx: PartCtx, { x, w, h, side }: Foot, c: string): Shape[] {
  const pts: Pt[] = [[side * 0.2, h * 0.45, 0], [x + side * w * 0.88, h * 0.45], [x + side * w * 0.96, h * 0.8], [x + side * w * 0.86, h + 0.3, 0], [side * 0.2, h + 0.3, 0]];
  return [S(pts, c), ...printed(ctx, smooth(pts, true, 1), { hem: h + 0.3, cx: x })];
}

/** A sole `t` cm thick up from the underside (h + 0.6), `wide` times the shoe's width about `cx`; a thick one has a flat shade line along it. */
function sole({ x, w, h }: Foot, c: string, t: number, wide = 1.02, cx = x): Shape[] {
  const y = h + 0.6 - t;
  return [P(rrect(cx - w * wide, y, w * 2 * wide, t, Math.min(t * 0.5, 0.9)), c), ...(t > 1.1 ? [line([[cx - w * wide * 0.9, y + t * 0.52], [cx + w * wide * 0.9, y + t * 0.52]], tone(c, "shade"), 0.35, 0.7)] : [])];
}

/** The instep above the toe box, turning away: a flat shade over the top of an upper down to the toe's crown at `y`, cut to it. */
function instep({ x, w, h }: Foot, c: string, clip: Path, y: number, opacity = 0.3): Shape {
  const r = Math.abs(x) + w + 3;
  return { path: smooth([[-r, -12, 0], [r, -12, 0], [r, h * 0.62, 0], [x + w * 0.92, h * 0.62], [x + w * 0.5, y + (h - y) * 0.16], [x, y], [x - w * 0.5, y + (h - y) * 0.16], [x - w * 0.92, h * 0.62], [-r, h * 0.62, 0]], true, 1), fill: tone(c, "shade"), flat: true, opacity, clip };
}

/** The side away from the light: +x in front, -x behind (the back view is mirrored). */
type Away = 1 | -1;

/** The light on a toe box (towards the light) and the shade down its far side (`a`), cut to the upper. */
function toeLight({ x, w, h, s }: Foot, c: string, clip: Path, y = h * 0.36, a: Away = 1): Shape[] {
  return [
    { path: ellipse(x - a * w * 0.4, y, w * 0.3, 0.75 * s), fill: tone(c, "light"), flat: true, opacity: 0.65, clip },
    { path: smooth(([[0.62, -12], [1.3, -12], [1.3, h + 1], [0.66, h + 1], [0.8, h * 0.4]] as const).map(([u, y]): Pt => [x + a * w * u, y]), true, 1), fill: tone(c, "shade"), flat: true, opacity: 0.28, clip },
  ];
}

/** A detail colour that shows on `c` when the document gives none: a shade on a light colour, a light one on a dark colour. */
const accent = (c: string) => (luma(c) > 0.6 ? tone(c, "deep") : tone(c, "edge"));

/** A pair from one foot's pieces per view (side 1 is the left foot, on foot_l), after `more` items (shafts). */
function pair(draw: (side: 1 | -1) => { front: Group; back: Group }, more: { front: Item[]; back: Item[] } = { front: [], back: [] }): PartOut {
  const l = draw(1), r = draw(-1);
  return {
    front: [...more.front, { layer: "shoe", bone: "foot_l", group: l.front }, { layer: "shoe", bone: "foot_r", group: r.front }],
    back: [...more.back, { layer: "shoe", bone: "foot_l", group: l.back }, { layer: "shoe", bone: "foot_r", group: r.back }],
  };
}

// ---- bare feet and straps ------------------------------------------------------------------------------

/** The half width of `bareFoot`'s outline at a height (its trapezoid), for straps that cross it. */
function footHalf(b: BodyDims, y: number): number {
  const wb = b.footW / 2 + 0.3, h = b.footH, m = h * 0.55;
  return y <= m ? wb * (0.62 + 0.33 * Math.min(1, Math.max(0, (y + 1) / (m + 1)))) : wb * (0.95 - 0.05 * Math.min(1, (y - m) / (h + 0.3 - m)));
}

/**
 * The bare heel from behind, for every shoe that shows it (sandals, slippers): the back of the ankle
 * from y -1 and the round heel to the floor (h + 0.3), the forefoot showing beside it low down.
 */
function bareHeel(b: BodyDims, skin: string, side: 1 | -1): Shape[] {
  const wb = b.footW / 2 + 0.3, h = b.footH, x = side * 0.8, c = side * 0.2, shade = tone(skin, "shade");
  return [
    S([[c, h * 0.4, 0], [x + side * wb * 0.86, h * 0.45], [x + side * wb * 0.92, h + 0.3, 0], [c, h + 0.3, 0]], skin),
    S([[c - wb * 0.6, -1], [c + wb * 0.6, -1], [c + wb * 0.72, h * 0.55], [c + wb * 0.6, h + 0.3], [c - wb * 0.6, h + 0.3], [c - wb * 0.72, h * 0.55]], skin),
    line([[c, -0.6], [c, h * 0.3]], shade, 0.35, 0.35),
    // the light on the heel, at +x: the back view is mirrored
    { path: ellipse(c + wb * 0.25, h * 0.5, wb * 0.22, 0.8), fill: tone(skin, "light"), flat: true, opacity: 0.3 },
  ];
}

/** A strap across the foot at height `y`, `half` wide each side of `cx` and `t` tall, its ends bending down (`droop`) round the foot. */
const strap = (cx: number, y: number, half: number, t: number, c: string, droop = 0.5): Shape =>
  P(band([[cx - half, y + droop], [cx - half * 0.5, y + droop * 0.15], [cx, y], [cx + half * 0.5, y + droop * 0.15], [cx + half, y + droop]], [t * 0.9, t, t, t, t * 0.9]), c);

// ---- boots -------------------------------------------------------------------------------------------

/** A strip's width at `t` along its chain (as the engine lays it out: linear from hip to knee and knee to ankle). */
const stripWidth = (w: [number, number, number], t: number) => (t < 0.5 ? w[0] + (w[1] - w[0]) * t * 2 : w[1] + (w[2] - w[1]) * (t - 0.5) * 2);

/**
 * What covers the shin under a boot: the widest trouser leg the outfit's bottom or dress draws (its
 * strip on layer `trouser`) and how far down it reaches, or null for bare legs and skirts.
 */
function trouserLeg(ctx: PartCtx): { widths: [number, number, number]; to: number } | null {
  let best: { widths: [number, number, number]; to: number } | null = null;
  for (const g of [ctx.avatar.outfit?.dress, ctx.avatar.outfit?.bottom]) {
    const p = g ? ctx.kit.parts[g.id] : undefined;
    if (!g || !p || p.slot === "shoes") continue;
    let out: PartOut;
    try { out = p.draw({ ...ctx, colors: (p.defaults ?? []).map(c => ctx.kit.color(c)), pattern: null, inks: [], side: null, garment: g }); } catch { continue; }
    for (const it of out.front ?? []) {
      const st = it.strip;
      if (it.layer === "trouser" && st && st.chain.startsWith("leg") && (!best || st.widths[2] > best.widths[2])) best = { widths: st.widths, to: st.to ?? 1 };
    }
  }
  return best;
}

/**
 * How a boot shaft covering `k` of the shin fits: its half width down the shin (u 0 at the knee, 1
 * at the ankle), `over` cm wider than a trouser leg that reaches into it, else `bare` cm round the
 * leg. It is never more than `room` cm wider than the bare fit (a fuller leg is tucked in), and never
 * so wide that the two shafts, with the `out` cm their rims and flare stand past it, meet between the
 * legs: the shins hang a little in from the hips, so the gap is measured at the knee.
 */
function shaftFit(ctx: PartCtx, k: number, over: number, bare: number, room: number, out = 0): { half: (u: number) => number; trousers: boolean; tucked: boolean } {
  const b = ctx.body, leg = trouserLeg(ctx), fit = leg && leg.to > 1 - 0.5 * k + 0.01 ? leg.widths : null;
  const hx = Math.abs(humanoid(b).find(n => n.name === "thigh_l")?.x ?? b.hipW / 4), gap = hx - b.thighL * 0.02 - out - 0.35 * footScale(b);
  const half = (u: number) => {
    const skin = stripWidth(b.legW, 0.5 + u / 2) / 2, under = fit ? stripWidth(fit, 0.5 + u / 2) / 2 : skin;
    return Math.max(skin + 0.15, Math.min(gap, skin + bare + room, Math.max(skin + bare, under + (fit ? over : bare))));
  };
  // tucked: some of the leg is fuller than the shaft, so its gathers (a şalvar's cuff) bunch inside it
  const tucked = !!fit && [0, 0.25, 0.5, 0.75, 1].some(t => stripWidth(fit, 1 - k / 2 + (k / 2) * t) / 2 + over > half(1 - k + k * t) + 0.01);
  return { trousers: !!fit, tucked, half };
}

/** A shaft's outline on the shin bone: from `k` of the shin above the ankle (y = shinL) to 1.2 cm under it, the top cut straight, `flare` cm wider at the top. */
function shaftOutline(L: number, k: number, half: (u: number) => number, flare = 0): Pt[] {
  const u0 = 1 - k, um = 1 - k / 2;
  return [[-half(u0) - flare, L * u0, 0], [half(u0) + flare, L * u0, 0], [half(um), L * um], [half(1), L + 1.2, 0], [-half(1), L + 1.2, 0], [-half(um), L * um]];
}

/** A boot's foot from the front: the top flush with the shaft (half width `ha` at `top`), its vamp seam dipping `dip` cm at the front, the toe box on the foot. */
function bootFoot({ x, w, h }: Foot, top: number, ha: number, dip = 0): Pt[] {
  const g = Math.max(w, ha + 0.2);
  return [[-ha, top, 0], [-ha * 0.45, top + dip * 0.7], [x * 0.3, top + dip], [ha * 0.45, top + dip * 0.7], [ha, top, 0], [ha + (x + g - ha) * 0.15, h * 0.16], [x + g, h * 0.7], [x + g * 0.92, h + 0.3, 0], [x - g * 0.92, h + 0.3, 0], [x - g, h * 0.7], [-ha + (x - g + ha) * 0.15, h * 0.16]];
}

/** The same boot from behind: the heel under the shaft. */
function bootHeel(f: Foot, top: number, ha: number): Pt[] {
  const { w, h } = f, c = heelX(f), g = Math.max(w * 0.84, ha);
  return [[-ha, top, 0], [ha, top, 0], [c + g, h * 0.42], [c + g * 0.9, h + 0.25], [c, h + 0.45], [c - g * 0.9, h + 0.25], [c - g, h * 0.42]];
}

/** The shade down a shaft's side away from the light (`a`) and a light streak down the other, cut to it. */
function shaftLight(half: (u: number) => number, L: number, k: number, c: string, clip: Path, light = 0.35, a: Away = 1): Shape[] {
  const u0 = 1 - k, y0 = L * u0, hw = half(1 - k / 2), lw = Math.max(0.8, hw * 0.24);
  return [
    { path: rrect(a > 0 ? hw * 0.5 : -hw * 1.7, y0 - 2, hw * 1.2, L * k + 4, 1), fill: tone(c, "shade"), flat: true, opacity: 0.3, clip },
    { path: rrect(a > 0 ? -hw * 0.72 : hw * 0.72 - lw, y0 + 1.2, lw, L * k - 2.2, 0.8), fill: tone(c, "light"), flat: true, opacity: light, clip },
  ];
}

/** The two shafts' items (shin_l, shin_r) on layer `shaft` from one shin's drawing. */
const shafts = (draw: (side: 1 | -1) => { front: Group; back: Group }): { front: Item[]; back: Item[] } => {
  const l = draw(1), r = draw(-1);
  return { front: [{ layer: "shaft", bone: "shin_l", group: l.front }, { layer: "shaft", bone: "shin_r", group: r.front }], back: [{ layer: "shaft", bone: "shin_l", group: l.back }, { layer: "shaft", bone: "shin_r", group: r.back }] };
};

/** Whether a trouser leg reaches the ankle, so a sock's or a bootie's cuff would be under it. */
const covered = (ctx: PartCtx) => (trouserLeg(ctx)?.to ?? 0) >= 0.95;

/** Whether the wearer is broad or round, so a shaft gives the calf more room. */
const roomy = (ctx: PartCtx) => ["broad", "round"].includes(ctx.avatar.body?.shape ?? "");

// ---- details -------------------------------------------------------------------------------------

/** Small flat dots (eyelets, rivets, vent holes) as one shape. */
function dots(at: Vec2[], rx: number, c: string, ry = rx, opacity = 0.9): Shape {
  const p = new Path();
  for (const [x, y] of at) p.add(ellipse(x, y, rx, ry));
  return { path: p, fill: c, flat: true, opacity };
}

/** Laces crossing between rows of eyelets at heights `ys`, `g` cm each side of the centre line `mx`: one flat stroked shape. */
function crossed(ys: number[], mx: (y: number) => number, g: number, c: string, w: number): Shape {
  const p = new Path();
  for (let i = 1; i < ys.length; i++) for (const d of [-1, 1]) p.moveTo(mx(ys[i - 1]) - d * g, ys[i - 1]).lineTo(mx(ys[i]) + d * g, ys[i]);
  return { path: p, stroke: { color: c, width: w }, flat: true, opacity: 0.95 };
}

/** A rubber sole `t` cm thick whose underside is cut in `n` teeth `d` deep (a lug or tread sole), `wide` times the shoe about `cx`, a dark midsole line along its top. */
function lugSole({ x, w, h }: Foot, c: string, t: number, n: number, d: number, wide = 1.04, cx = x): Shape[] {
  const half = w * wide, y = h + 0.6 - t, bot = h + 0.6, pts: Pt[] = [[cx - half, y + 0.2, 0], [cx + half, y + 0.2, 0], [cx + half, bot - d, 0]];
  for (let i = 0; i < n; i++) pts.push([cx + half - (2 * half * (i + 0.5)) / n, bot, 0], [cx + half - (2 * half * (i + 1)) / n, bot - d, 0]);
  return [S(pts, c), line([[cx - half * 0.96, y + 0.45], [cx + half * 0.96, y + 0.45]], tone(c, "deep"), 0.5, 0.6)];
}

/** A rubber toe cap over the lowest part of an upper, its crown at `capY`, shaded on the far side. */
function toeCap({ x, w, h }: Foot, c: string, capY: number, hem: number, a: Away = 1): Shape[] {
  const pts: Pt[] = [[x - w * 0.9, hem + 0.3, 0], [x - w * 0.78, capY + (hem - capY) * 0.35], [x, capY], [x + w * 0.78, capY + (hem - capY) * 0.35], [x + w * 0.9, hem + 0.3, 0]], clip = smooth(pts, true, 1);
  return [S(pts, c), { path: rrect(a > 0 ? x + w * 0.35 : x - w * 1.4, capY - 1, w * 1.05, h, 0.5), fill: tone(c, "shade"), flat: true, opacity: 0.35, clip }];
}

/** A knitted cuff from `y0` to `y1`, `hw` each side of the leg, its top edge scalloped (`n` bumps) or straight, with flat rib lines. */
function cuff(hw: number, y0: number, y1: number, c: string, ribs: number, s: number, n = 0): Shape[] {
  const top: Pt[] = n ? Array.from({ length: 2 * n + 1 }, (_, i): Pt => [-hw + (hw * i) / n, y0 + (i % 2 ? -0.3 * s : 0.25 * s)]) : [[-hw, y0, 0], [hw, y0, 0]];
  const xs = Array.from({ length: ribs }, (_, i) => -hw + (2 * hw * (i + 1)) / (ribs + 1)), p = new Path();
  for (const rx of xs) p.moveTo(rx, y0 + 0.5 * s).lineTo(rx, y1 - 0.3 * s);
  return [S([...top, [hw, y1, 0], [-hw, y1, 0]], c), { path: p, stroke: { color: tone(c, "shade"), width: 0.3 * s }, flat: true, opacity: 0.6 }];
}

/** A sock-shaped foot (socks, patik): from the ankle opening `hw` wide at `y0` round the foot `wb` wide to a rounded toe at `bot`. */
const sockFront = (x: number, hw: number, wb: number, h: number, y0: number, bot: number, bag = 0): Pt[] =>
  [[-hw, y0, 0], [hw, y0, 0], [hw + bag, -0.4], [x + wb * 0.98, h * 0.5], [x + wb * 0.9, bot - 0.5], [x + wb * 0.6, bot], [x - wb * 0.6, bot], [x - wb * 0.9, bot - 0.5], [x - wb * 0.98, h * 0.5], [-hw - bag, -0.4]];

/** The same from behind: the round heel, the forefoot beside it low down. */
const sockBack = (c: number, hw: number, wb: number, h: number, y0: number, bot: number, bag = 0): Pt[] =>
  [[-hw, y0, 0], [hw, y0, 0], [hw + bag, -0.4], [c + wb * 0.8, h * 0.5], [c + wb * 0.6, bot], [c - wb * 0.6, bot], [c - wb * 0.8, h * 0.5], [-hw - bag, -0.4]];

// ---- the shoes -------------------------------------------------------------------------------------------

export const SHOES: Record<string, PartDef> = {
  // canvas and rubber: a thick sole and a toe cap in the second colour, laces and the heel tab in the third
  shoes_sneakers: named("shoes", "Sneakers", "spor ayakkabı", {
    colors: 3, defaults: ["fab_01", "fab_01"], patterns: PRINTS, tags: ["casual", "sport", "school", "istanbul"],
    draw: ctx => {
      const up = ctx.colors[0] ?? "#F7F3EA", so = ctx.colors[1] ?? "#F7F3EA", lace = ctx.colors[2] ?? accent(up), small = ctx.body.build === "toddler";
      return pair(side => {
        const f = footOf(ctx.body, side), { x, w, h, s } = f, top = -1.8, t = 0.34 * h, hem = h + 0.6 - t, c = heelX(f);
        const out = upperFront(f, top), path = smooth(out, true, 1), cup = heelCup(f, top), cupPath = smooth(cup, true, 1), mid = (y: number) => midAt(f, top, y);
        const bars = (small ? [0.3, 0.7] : [0.2, 0.47, 0.74]).map(k => top + 0.8 * s + (h * 0.3 - top - 0.8 * s) * k), capY = h * (small ? 0.4 : 0.52);
        const front: Group = { shapes: [
          P(rrect(-1.1 * s, top - 0.5 * s, 2.2 * s, 1.6 * s, 0.7 * s), tone(up, "light")),
          S(out, up), ...printed(ctx, path, { hem, cx: x }), instep(f, up, path, h * 0.3), ...toeLight(f, up, path, h * 0.45),
          // the tongue between the eyestays, crossed by the laces
          S([[-1.6 * s, top + 0.1, 0], [1.6 * s, top + 0.1, 0], [mid(h * 0.3) + 1.9 * s, h * 0.3], [mid(h * 0.36), h * 0.38], [mid(h * 0.3) - 1.9 * s, h * 0.3]], tone(up, "light"), { flat: true, opacity: 0.75 }),
          ...bars.flatMap((y, i) => [line([[mid(y) - 1.75 * s, y + (i % 2 ? 0.25 : -0.15) * s], [mid(y) + 1.75 * s, y + (i % 2 ? -0.15 : 0.25) * s]], lace, 0.55 * s, 0.95),
            ...[-1, 1].map(d => ({ path: ellipse(mid(y) + d * 2 * s, y, 0.3 * s), fill: tone(up, "deep"), flat: true, opacity: 0.55 } as Shape))]),
          // the rubber toe cap, low over the sole
          S([[x - w * 0.86, hem + 0.3, 0], [x - w * 0.66, capY + (hem - capY) * 0.3], [x, capY], [x + w * 0.66, capY + (hem - capY) * 0.3], [x + w * 0.86, hem + 0.3, 0]], so),
          ...sole(f, so, t),
        ] };
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, up),
          P(rrect(c - 0.65 * s, top - 1.7 * s, 1.3 * s, 2.8 * s, 0.55 * s), lace),
          S(cup, up), ...printed(ctx, cupPath, { hem, cx: c }), ...toeLight({ ...f, x: c }, up, cupPath, h * 0.2, -1).slice(1),
          // the padded collar, a heel stripe and the counter's seam
          line([[-f.a + 0.5, top + 0.5], [f.a - 0.5, top + 0.5]], tone(up, "light"), 0.9 * s, 0.75),
          P(rrect(c - 0.6 * s, top + 1.1 * s, 1.2 * s, hem - top - 0.6 * s, 0.4 * s), lace),
          line([[c - w * 0.78, h * 0.3], [c - w * 0.3, h * 0.1], [c + w * 0.3, h * 0.1], [c + w * 0.78, h * 0.3]], tone(up, "shade"), 0.35 * s, 0.6),
          ...sole(f, so, t, 0.9, c),
        ] };
        return { front, back };
      });
    },
  }),

  // the plain leather shoe: a smooth slip-on, a cap-toe seam, a gloss on the toe, a thin dark welt
  // (the sole is the second colour darkened, as stored documents expect, or the upper's deep tone when that is darker)
  shoes_leather: named("shoes", "Leather shoes", "ayakkabı", {
    colors: 2, defaults: ["fab_20", "fab_01"], builds: ["adult", "elder", "child"], tags: ["formal", "work", "school"],
    draw: ctx => {
      const up = ctx.colors[0] ?? "#6B4A35", welt = darkSole(ctx.colors[1] ?? "#F7F3EA"), deep = tone(up, "deep"), so = luma(welt) > luma(deep) ? deep : welt;
      return pair(side => {
        const f = footOf(ctx.body, side, 0.2), { x, w, h, s } = f, top = -1.4, t = (ctx.body.build === "child" ? 0.25 : 0.22) * h, hem = h + 0.6 - t, c = heelX(f);
        const out = upperFront(f, top, 1.1, 0.97), path = smooth(out, true, 1), cup = heelCup(f, top), capY = h * 0.3;
        const front: Group = { shapes: [
          S(out, up), instep(f, up, path, h * 0.12, 0.26), ...toeLight(f, up, path, h * 0.42),
          // the vamp's throat, the cap-toe seam and a gloss along the toe
          line([[-f.a * 0.7, top + 0.25], [midAt(f, top, top + 1) * 0.5, top + 1.1 * s], [f.a * 0.7, top + 0.25]], tone(up, "deep"), 0.45 * s, 0.6),
          line([[x - w * 0.93, capY + 1.2 * s], [x - w * 0.45, capY], [x + w * 0.45, capY], [x + w * 0.93, capY + 1.2 * s]], tone(up, "shade"), 0.4 * s, 0.8),
          line([[x - w * 0.72, h * 0.62], [x - w * 0.62, h * 0.4], [x - w * 0.36, h * 0.3]], tone(up, "edge"), 0.45 * s, 0.55),
          ...sole(f, so, t, 1.03),
          line([[x - w * 0.97, hem + 0.12], [x + w * 0.97, hem + 0.12]], tone(so, "light"), 0.25, 0.5),
        ] };
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, up), S(cup, up), ...toeLight({ ...f, x: c }, up, smooth(cup, true, 1), h * 0.2, -1).slice(1),
          line([[c, top + 0.5], [c, hem]], tone(up, "shade"), 0.4 * s, 0.75),
          line([[-f.a + 0.5, top + 0.35], [f.a - 0.5, top + 0.35]], tone(up, "light"), 0.6 * s, 0.6),
          ...sole(f, so, t, 0.92, c),
          // the heel stack under the counter
          P(rrect(c - w * 0.58, hem - 0.6 * s, w * 1.16, t + 0.6 * s, [0.3, 0.3, 0.5, 0.5]), so),
          line([[c - w * 0.54, hem + t * 0.4], [c + w * 0.54, hem + t * 0.4]], tone(so, "light"), 0.25, 0.4),
        ] };
        return { front, back };
      });
    },
  }),

  // babet: cut low under the ankle, so the instep shows above a rounded vamp; a binding and a small
  // bow in the second colour (a toddler's has a strap over the instep and a bigger bow)
  shoes_flats: named("shoes", "Flats", "babet", {
    colors: 2, defaults: ["fab_16"], patterns: PRINTS, tags: ["casual", "formal", "summer"],
    draw: ctx => {
      const up = ctx.colors[0] ?? "#7A3E6E", trim = ctx.colors[1] ?? tone(up, "deep"), b = ctx.body, toddler = b.build === "toddler";
      return pair(side => {
        const f = footOf(b, side, 0), { x, w, h, s } = f, edgeY = h + 0.3, dip = h * 0.36, rise = h * 0.2, bow = toddler ? 1.5 : 1;
        const edge: [number, number][] = [[x - w * 0.97, rise], [x - w * 0.6, h * 0.24], [x, dip], [x + w * 0.6, h * 0.24], [x + w * 0.97, rise]];
        const vamp: Pt[] = [...edge, [x + w * 1.02, h * 0.72], [x + w * 0.92, edgeY, 0], [x - w * 0.92, edgeY, 0], [x - w * 1.02, h * 0.72]];
        const path = smooth(vamp, true, 1);
        const lobe = (d: 1 | -1): Shape => S([[x, dip + 0.15], [x + d * 1.0 * s * bow, dip - 0.45 * s * bow], [x + d * 1.15 * s * bow, dip + 0.5 * s * bow]], trim);
        const front: Group = { shapes: [
          ...bareFoot(b, ctx.skin, side),
          S(vamp, up), ...printed(ctx, path, { hem: edgeY, cx: x }), ...toeLight(f, up, path, h * 0.6),
          line(edge.map(([px, py]): [number, number] => [px * 0.985 + x * 0.015, py + 0.2]), trim, 0.45 * s, 0.95),
          line([[x - w * 0.9, edgeY - 0.1], [x + w * 0.9, edgeY - 0.1]], tone(up, "deep"), 0.35, 0.7),
          ...(toddler ? [strap(0, -0.4, f.a + 0.1, 1.1 * s, up, 0.6), P(ellipse(side * (f.a - 0.6), 0.1, 0.4 * s), trim)] : []),
          lobe(-1), lobe(1), P(ellipse(x, dip + 0.15, 0.34 * s * bow), tone(trim, "deep")),
        ] };
        const c = heelX(f), cupTop = h + 0.3 - 3 * s;
        const cup: Pt[] = [[c - w * 0.84, cupTop], [c, cupTop + 0.4 * s], [c + w * 0.84, cupTop], [c + w * 0.82, edgeY, 0], [c - w * 0.82, edgeY, 0]];
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, up), ...bareHeel(b, ctx.skin, side).slice(1),
          S(cup, up), ...printed(ctx, smooth(cup, true, 1), { hem: edgeY, cx: c }),
          line([[c - w * 0.82, cupTop + 0.2], [c, cupTop + 0.6 * s], [c + w * 0.82, cupTop + 0.2]], trim, 0.45 * s, 0.95),
          line([[c - w * 0.8, edgeY - 0.1], [c + w * 0.8, edgeY - 0.1]], tone(up, "deep"), 0.35, 0.7),
        ] };
        return { front, back };
      });
    },
  }),

  // kısa bot: a leather shaft a quarter of the shin high (over a trouser leg, else slim round the leg
  // with a little flare), a zip on the outer side (an elastic gusset on children), a stacked heel
  shoes_boots_ankle: named("shoes", "Ankle boots", "kısa bot", {
    colors: 3, palettes: ["fabric", "fabric", "fabmetal"], defaults: ["fab_20", "fab_22", "met_gunmetal"], tags: ["casual", "winter", "formal"], over: ["bottom"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#6B4A35", so = ctx.colors[1] ?? "#26272C", pull = ctx.colors[2] ?? "#4B5058", L = b.shinL, k = 0.25, s = footScale(b);
      const kid = b.build === "child" || b.build === "toddler", fit = shaftFit(ctx, k, 0.35, 0.45, 1.6, 0.45 * footScale(b)), half = fit.half, u0 = 1 - k, y0 = L * u0;
      const sh = shaftOutline(L, k, half, fit.trousers ? 0 : 0.45 * s), shPath = smooth(sh, true, 1), top = -1.4, ha = half(1 + top / L) + 0.05;
      const more = shafts(side => {
        const zx = side * (half(u0 + 0.05) - 1.1 * s), trimLine = line([[-half(u0) + 0.4, y0 + 0.5], [half(u0) - 0.4, y0 + 0.5]], tone(up, "light"), 0.45 * s, 0.6);
        const front: Group = { shapes: [
          S(sh, up), ...shaftLight(half, L, k, up, shPath), trimLine,
          ...(kid
            ? [S([[zx - side * 0.9 * s, y0 + 0.3, 0], [zx + side * 0.5 * s, y0 + 0.3, 0], [side * (half(0.98) - 0.4 * s), L - 0.2, 0], [side * (half(0.98) - 1.6 * s), L - 0.2, 0]], tone(up, "deep"), { flat: true, opacity: 0.5 })]
            : [line([[zx, y0 + 0.6], [side * (half(0.98) - 1.2 * s), L + 0.6]], tone(up, "deep"), 0.35 * s, 0.85),
              P(rrect(zx - 0.3 * s, y0 + 0.5, 0.6 * s, 1.4 * s, 0.3 * s), pull)]),
        ] };
        const back: Group = { shapes: [
          S(sh, up), ...shaftLight(half, L, k, up, shPath, 0.35, -1), trimLine,
          line([[0, y0 + 0.4], [0, L + 1]], tone(up, "shade"), 0.4 * s, 0.75),
          // a pull loop standing above the back of the shaft
          P(band([[-0.5 * s, y0 + 0.8], [-0.5 * s, y0 - 0.9 * s], [0, y0 - 1.4 * s], [0.5 * s, y0 - 0.9 * s], [0.5 * s, y0 + 0.8]], [0.5 * s, 0.5 * s, 0.5 * s, 0.5 * s, 0.5 * s]), tone(up, "light")),
        ] };
        return { front, back };
      });
      return pair(side => {
        const f = footOf(b, side, 0.4), { w, h } = f, t = 0.25 * h, hem = h + 0.6 - t, c = heelX(f);
        const out = bootFoot(f, top, ha, 1.6 + 0.2 * h), path = smooth(out, true, 1), heel = bootHeel(f, top, ha);
        const front: Group = { shapes: [S(out, up), instep(f, up, path, h * 0.2), ...toeLight(f, up, path, h * 0.45), ...sole(f, so, t, 1.03)] };
        const back: Group = { shapes: [...toeFlare(ctx, f, up), S(heel, up), ...toeLight({ ...f, x: c }, up, smooth(heel, true, 1), h * 0.2, -1).slice(1), line([[0, top + 0.3], [c, hem]], tone(up, "shade"), 0.4 * s, 0.75), ...sole(f, so, t, 0.92, c),
          P(rrect(c - w * 0.58, hem - 0.9 * s, w * 1.16, t + 0.9 * s, [0.3, 0.3, 0.5, 0.5]), so), line([[c - w * 0.54, hem + 0.05], [c + w * 0.54, hem + 0.05]], tone(so, "light"), 0.25, 0.45)] };
        return { front, back };
      }, more);
    },
  }),

  // yağmur çizmesi: a rubber shaft to just under the knee, loose over the trouser, a shine streak,
  // a rolled rim and ankle creases; a pull tab and a heel kick behind; a toddler's has handles
  shoes_boots_rain: named("shoes", "Rain boots", "yağmur çizmesi", {
    colors: 2, defaults: ["fab_11", "fab_22"], patterns: PRINTS, tags: ["rain", "child", "istanbul"], over: ["bottom"], odds: { adult: 0.4, elder: 0.4, child: 1, toddler: 1 },
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#F2B705", so = ctx.colors[1] ?? "#26272C", L = b.shinL, k = 0.8, s = footScale(b);
      // a tucked leg bunches inside the shaft, so the shaft falls straight from the calf instead of narrowing to the ankle
      const fit = shaftFit(ctx, k, 1.3, 1.4, 2.2, 0.9), half = fit.tucked ? (u: number) => fit.half(Math.min(u, 0.6)) : fit.half, u0 = 1 - k, y0 = L * u0, sh = shaftOutline(L, k, half, 0.3), shPath = smooth(sh, true, 1), hem = L + 1.2;
      const top = -0.6, ha = half(1 + top / L) + 0.05;
      const more = shafts(side => {
        const rim = P(rrect(-half(u0) - 0.6, y0 - 0.3, (half(u0) + 0.6) * 2, 1.6 * s, 0.7 * s), tone(up, "light"));
        const handles = b.build === "toddler" ? [-1, 1].map(d => ({ path: ellipse(d * (half(u0 + 0.1) - 1.5 * s), y0 + 2.4 * s, 0.9 * s, 0.5 * s), fill: tone(up, "deep"), flat: true, opacity: 0.85 } as Shape)) : [];
        const creases = [0, 1, 2].map(i => line([[-half(1) * 0.55 + i * 0.4 * s, L - 0.4 - i * 1.2 * s], [-half(1) * 0.1, L - i * 1.2 * s], [half(1) * 0.3 - i * 0.4 * s, L - 0.5 - i * 1.2 * s]], tone(up, "shade"), 0.35 * s, 0.55));
        const front: Group = { shapes: [S(sh, up), ...printed(ctx, shPath, { hem }), ...shaftLight(half, L, k, up, shPath, 0.55), ...creases, rim, ...handles] };
        const back: Group = { shapes: [S(sh, up), ...printed(ctx, shPath, { hem }), ...shaftLight(half, L, k, up, shPath, 0.4, -1), P(rrect(-0.9 * s, y0 - 1.3 * s, 1.8 * s, 3 * s, 0.6 * s), tone(up, "shade")), rim, ...handles] };
        return { front, back };
      });
      return pair(side => {
        const f = footOf(b, side, 0.2), { x, w, h } = f, t = 0.3 * h, hemF = h + 0.6 - t, c = heelX(f), g = Math.max(w * 0.84, ha);
        const out = bootFoot(f, top, ha, 0.8 + 0.2 * h), path = smooth(out, true, 1), heel = bootHeel(f, top, ha);
        const front: Group = { shapes: [S(out, up), ...printed(ctx, path, { hem: hemF, cx: x }), instep(f, up, path, h * 0.25, 0.18), ...toeLight(f, up, path, h * 0.45), ...sole(f, so, t, 1.04), line([[x - w, hemF + 0.15], [x + w, hemF + 0.15]], tone(so, "light"), 0.3, 0.5)] };
        const back: Group = { shapes: [
          // the heel kick on the outer side, to step off the boot with the other foot
          P(rrect(side > 0 ? c + g * 0.7 : c - g * 0.7 - 2.2 * s, hemF - 1.3 * s, 2.2 * s, 1.3 * s, 0.5 * s), so),
          ...toeFlare(ctx, f, up), S(heel, up), ...printed(ctx, smooth(heel, true, 1), { hem: hemF, cx: c }), ...toeLight({ ...f, x: c }, up, smooth(heel, true, 1), h * 0.2, -1).slice(1), ...sole(f, so, t, 0.98, c),
        ] };
        return { front, back };
      }, more);
    },
  }),

  // sandalet: the bare foot on a thin sole, three straps (two on children; a toddler's has a closed toe),
  // the ankle strap's buckle on the outer side; a heel strap behind
  shoes_sandals_strap: named("shoes", "Strappy sandals", "sandalet", {
    colors: 3, palettes: ["fabric", "fabric", "fabmetal"], defaults: ["fab_19", "fab_22", "met_gold"], tags: ["summer", "casual"],
    draw: ctx => {
      const b = ctx.body, st = ctx.colors[0] ?? "#B98A57", so = ctx.colors[1] ?? "#26272C", buckle = ctx.colors[2] ?? "#E0B03C";
      const toddler = b.build === "toddler", child = b.build === "child", h = b.footH, s = footScale(b), sw = (toddler ? 1.25 : 1) * s, ankle = b.legW[2] / 2 + 0.3;
      const buck = (cx: number, y: number): Shape[] => [P(rrect(cx - 0.5 * s, y - 0.6 * sw, 1 * s, 1.2 * sw, 0.25 * s), buckle), line([[cx, y - 0.38 * sw], [cx, y + 0.38 * sw]], tone(buckle, "deep"), 0.25, 0.7)];
      return pair(side => {
        const x = side * 0.8, wb = b.footW / 2 + 0.3, c = side * 0.2, fore = h - 2.15 * s, inst = h * 0.1;
        const front: Group = { shapes: [
          P(rrect(x - wb * 1.08, h - 0.4, wb * 2.16, 1, 0.45), tone(so, "shade")),
          ...bareFoot(b, ctx.skin, side),
          ...(toddler ? [S([[x - wb * 0.97, h + 0.3, 0], [x - wb * 0.88, h - 1.5 * s], [x, h - 1.9 * s], [x + wb * 0.88, h - 1.5 * s], [x + wb * 0.97, h + 0.3, 0]], so)] : []),
          ...(child || toddler ? [] : [strap(x, fore, footHalf(b, fore) + 0.1, 0.75 * sw, st, 0.25)]),
          strap(x * 0.6, inst, footHalf(b, inst) + 0.1, 0.85 * sw, st, 0.45),
          strap(0, -0.8 * s, ankle, 0.8 * sw, st, 0.25),
          ...buck(side * (ankle - 0.85 * s), -0.68 * s),
          P(rrect(x - wb * 1.06, h - 0.05, wb * 2.12, 0.65, 0.3), so),
        ] };
        const back: Group = { shapes: [
          ...bareHeel(b, ctx.skin, side),
          P(rrect(c - 0.6 * sw, -0.8 * s, 1.2 * sw, h + 0.6 * s, 0.4), st),
          strap(0, -0.8 * s, ankle, 0.8 * sw, st, -0.2),
          ...buck(side * (ankle - 0.85 * s), -0.8 * s),
          P(rrect(c - wb * 0.84, h - 0.15, wb * 1.68, 0.75, 0.3), so),
        ] };
        return { front, back };
      });
    },
  }),

  // ev terliği: a puffy closed toe with a piped edge over the bare instep, a soft sole, the heel open but for a low lip
  // (a toddler's is a closed bootie with a pull tab)
  shoes_slippers_house: named("shoes", "House slippers", "ev terliği", {
    colors: 2, defaults: ["fab_20", "fab_02"], patterns: PRINTS, tags: ["indoor", "home", "comfort", "winter"], odds: 0.3,
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#6B4A35", trim = ctx.colors[1] ?? "#F0E2C8", toddler = b.build === "toddler";
      return pair(side => {
        const f = footOf(b, side, 0.6), { x, w, h, s } = f, t = Math.max(0.75, 0.2 * h), hem = h + 0.6 - t, c = heelX(f), topY = toddler ? -1.4 : h * 0.12;
        const pipe: [number, number][] = toddler ? [[-f.a + 0.2, topY + 0.1], [f.a - 0.2, topY + 0.1]] : [[x - w * 0.97, h * 0.62], [x - w * 0.66, h * 0.24], [x, topY], [x + w * 0.66, h * 0.24], [x + w * 0.97, h * 0.62]];
        const vamp: Pt[] = toddler ? upperFront(f, topY, 0.3, 1.02) : [[x - w, hem + 0.3, 0], ...pipe.map(([px, py]): Pt => [px + (px - x) * 0.04, py - 0.2]), [x + w, hem + 0.3, 0]];
        const path = smooth(vamp, true, 1);
        const front: Group = { shapes: [
          ...(toddler ? [] : bareFoot(b, ctx.skin, side)),
          S(vamp, up), ...printed(ctx, path, { hem, cx: x }), ...toeLight(f, up, path, h * 0.5),
          // the puff: a soft fold across the toe
          line([[x - w * 0.5, h * 0.7], [x, h * 0.6], [x + w * 0.5, h * 0.7]], tone(up, "shade"), 0.45 * s, 0.4),
          P(band(pipe, pipe.map(() => 0.75 * s)), tone(trim, "light")),
          P(rrect(x - w * 1.02, hem, w * 2.04, t, Math.min(0.5, t / 2)), trim),
        ] };
        const cup = heelCup(f, -1.4);
        // the open heel's low lip: the upper's quarters wrapping round to a soft rim behind the heel, printed, piped like the front
        const lip = (): Shape[] => {
          const ly = hem - 2.3 * s, pts: Pt[] = [[c - w * 0.9, hem + 0.1, 0], [c - w * 0.88, ly + 0.5 * s], [c, ly], [c + w * 0.88, ly + 0.5 * s], [c + w * 0.9, hem + 0.1, 0]], lp = smooth(pts, true, 1);
          return [S(pts, up), ...printed(ctx, lp, { hem, cx: c }), ...toeLight({ ...f, x: c }, up, lp, h * 0.2, -1).slice(1), P(band([[c - w * 0.86, ly + 0.5 * s], [c, ly + 0.05], [c + w * 0.86, ly + 0.5 * s]], [0.4 * s, 0.45 * s, 0.4 * s]), tone(trim, "light"))];
        };
        const back: Group = { shapes: toddler
          ? [...toeFlare(ctx, f, up), P(rrect(c - 0.6 * s, -2.9 * s, 1.2 * s, 2.4 * s, 0.5 * s), trim), S(cup, up), ...printed(ctx, smooth(cup, true, 1), { hem, cx: c }), P(band([[-f.a + 0.3, -1.1], [f.a - 0.3, -1.1]], [0.75 * s, 0.75 * s]), tone(trim, "light")), P(rrect(c - w * 0.86, hem - 0.2, w * 1.72, t + 0.2, Math.min(0.5, t / 2)), trim)]
          : [...toeFlare(ctx, f, up), ...bareHeel(b, ctx.skin, side).slice(1), ...lip(), P(rrect(c - w * 0.86, hem - 0.2, w * 1.72, t + 0.2, Math.min(0.5, t / 2)), trim)] };
        return { front, back };
      });
    },
  }),

  // cırt cırtlı ayakkabı: a roomy toe box with a rubber bumper, hook-and-loop straps whose flaps stand
  // out on the outer side (two on a child's, one wide one on a toddler's, one plain one on an adult's)
  shoes_velcro: named("shoes", "Hook-and-loop strap shoes", "cırt cırtlı ayakkabı", {
    colors: 3, defaults: ["fab_04", "fab_01", "fab_23"], patterns: PRINTS, tags: ["child", "school", "comfort", "accessible", "easyon"], odds: { adult: 0.3, elder: 0.6, child: 1.5, toddler: 2 },
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#2E3A59", so = ctx.colors[1] ?? "#F7F3EA", tab = ctx.colors[2] ?? "#B3261E";
      const n = b.build === "child" ? 2 : 1, tall = b.build === "toddler" ? 2.4 : n === 2 ? 1.6 : 1.9;
      return pair(side => {
        const f = footOf(b, side, 0.5), { x, w, h, s } = f, top = -1.6, t = 0.34 * h, hem = h + 0.6 - t, c = heelX(f), th = tall * s;
        const out = upperFront(f, top, 0.5, 1.03), path = smooth(out, true, 1), cup = heelCup(f, top), mid = (y: number) => midAt(f, top, y);
        const ys = n === 2 ? [top + 1.4 * s, top + 3.3 * s] : [top + 2.1 * s];
        const flap = (y: number): Shape[] => {
          const m = mid(y), tip = x + side * (w + 0.8 * s), from = m - side * (f.a * 0.9), patch = m + side * w * 0.42;
          return [
            P(band([[from, y + 0.3], [m - side * f.a * 0.3, y + 0.05], [m + side * w * 0.4, y], [tip - side * 0.7 * s, y + 0.1], [tip, y + 0.15]], [th * 0.9, th, th, th, th * 0.9]), tab),
            { path: rrect(Math.min(patch, tip - side * 0.5 * s), y - th * 0.3, Math.abs(tip - side * 0.5 * s - patch), th * 0.6, 0.3 * s), fill: tone(tab, "shade"), flat: true, opacity: 0.6 },
          ];
        };
        const front: Group = { shapes: [
          P(rrect(-1.1 * s, top - 0.6 * s, 2.2 * s, 1.7 * s, 0.7 * s), tone(up, "light")),
          S(out, up), ...printed(ctx, path, { hem, cx: x }), instep(f, up, path, h * 0.3), ...toeLight(f, up, path, h * 0.5),
          S([[x - w * 0.88, hem + 0.3, 0], [x - w * 0.7, h * 0.68], [x, h * 0.62], [x + w * 0.7, h * 0.68], [x + w * 0.88, hem + 0.3, 0]], so),
          ...ys.flatMap(flap),
          ...sole(f, so, t),
        ] };
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, up),
          ...ys.map(y => P(rrect(side > 0 ? x + w * 0.4 : x - w - 0.8 * s, y - th * 0.5, w * 0.6 + 0.8 * s, th, 0.5 * s), tab)),
          P(rrect(c - 0.6 * s, top - 1.6 * s, 1.2 * s, 2.5 * s, 0.5 * s), tab),
          S(cup, up), ...printed(ctx, smooth(cup, true, 1), { hem, cx: c }), ...toeLight({ ...f, x: c }, up, smooth(cup, true, 1), h * 0.2, -1).slice(1),
          line([[-f.a + 0.5, top + 0.5], [f.a - 0.5, top + 0.5]], tone(up, "light"), 0.9 * s, 0.7),
          line([[c - w * 0.78, h * 0.3], [c - w * 0.3, h * 0.1], [c + w * 0.3, h * 0.1], [c + w * 0.78, h * 0.3]], tone(up, "shade"), 0.35 * s, 0.6),
          ...sole(f, so, t, 0.9, c),
        ] };
        return { front, back };
      });
    },
  }),

  // koşu ayakkabısı: a chunky midsole half the foot's height with a waving top edge, a mesh upper with
  // panel seams, a padded collar, a plain slanted flash on the outer side; a reflective heel tab behind
  shoes_running: named("shoes", "Running shoes", "koşu ayakkabısı", {
    colors: 3, defaults: ["fab_35", "fab_01", "fab_23"], builds: ["adult", "elder", "child"], patterns: SPORTY, tags: ["sport", "casual"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#6F8FAF", ms = ctx.colors[1] ?? "#F7F3EA", fl0 = ctx.colors[2] ?? "#B3261E", child = b.build === "child", fl = child ? tone(fl0, "light") : fl0;
      return pair(side => {
        const f = footOf(b, side, 0.5), { x, w, h, s } = f, top = -1.8, t = (child ? 0.45 : 0.5) * h, hem = h + 0.6 - t, c = heelX(f);
        const out = upperFront(f, top, 0.4, 1.02), path = smooth(out, true, 1), cup = heelCup(f, top), cupPath = smooth(cup, true, 1), m = (y: number) => midAt(f, top, y);
        const bars = [0.15, 0.45, 0.75].map(k => top + 0.8 * s + (hem - 0.6 * s - top - 0.8 * s) * k * 0.8);
        // the midsole, its top edge waving, a flat shade band along its foot
        const mid = (cx: number, wide: number): Shape[] => {
          const W = w * wide;
          return [S([[cx - W, hem + 0.35, 0], [cx - W * 0.5, hem - 0.15], [cx, hem + 0.2], [cx + W * 0.5, hem - 0.15], [cx + W, hem + 0.35, 0], [cx + W * 0.98, h + 0.6, 0], [cx - W * 0.98, h + 0.6, 0]], ms),
            P(rrect(cx - W * 0.94, h + 0.6 - t * 0.3, W * 1.88, t * 0.3 - 0.1, [0, 0, 0.5, 0.5]), tone(ms, "shade"), { flat: true, opacity: 0.55 })];
        };
        const seams = [-1, 1].map(d => line([[m(h * 0.1) + d * 2.4 * s, top + 1.2], [x + d * w * 0.5, h * 0.35], [x + d * w * 0.62, hem]], tone(up, "shade"), 0.35 * s, 0.6));
        const front: Group = { shapes: [
          P(rrect(-1.1 * s, top - 0.7 * s, 2.2 * s, 1.8 * s, 0.7 * s), tone(up, "light")),
          S(out, up), ...printed(ctx, path, { hem, cx: x }), instep(f, up, path, h * 0.25), ...toeLight(f, up, path, h * 0.3), ...seams,
          line([[-f.a + 0.4, top + 0.35], [0, top + 0.6], [f.a - 0.4, top + 0.35]], tone(up, "light"), 1.3 * s, 0.9),
          // the flash: a plain slanted bar across the outer side panel
          { ...P(band([[x + side * w * 0.2, hem + 0.3], [x + side * w * 0.95, top + 1.4]], [1.4 * s]), fl), flat: true, clip: path },
          ...bars.map((y, i) => line([[m(y) - 1.7 * s, y + (i % 2 ? 0.25 : -0.15) * s], [m(y) + 1.7 * s, y + (i % 2 ? -0.15 : 0.25) * s]], fl, 0.5 * s, 0.95)),
          dots(bars.flatMap(y => [[m(y) - 1.95 * s, y], [m(y) + 1.95 * s, y]] as Vec2[]), 0.28 * s, tone(up, "deep"), 0.28 * s, 0.55),
          ...mid(x, 1.04),
        ] };
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, up),
          P(band([[c - 0.5 * s, top + 0.8], [c - 0.5 * s, top - 1.1 * s], [c, top - 1.6 * s], [c + 0.5 * s, top - 1.1 * s], [c + 0.5 * s, top + 0.8]], [0.5 * s]), tone(up, "deep")),
          S(cup, up), ...printed(ctx, cupPath, { hem, cx: c }), ...toeLight({ ...f, x: c }, up, cupPath, h * 0.2, -1).slice(1),
          // the padded heel counter, the collar and the reflective tab
          S([[c - w * 0.8, hem + 0.3, 0], [c - w * 0.72, h * 0.05], [c, -0.5], [c + w * 0.72, h * 0.05], [c + w * 0.8, hem + 0.3, 0]], tone(up, "shade"), { flat: true, opacity: 0.4, clip: cupPath }),
          line([[-f.a + 0.4, top + 0.5], [f.a - 0.4, top + 0.5]], tone(up, "light"), 1.1 * s, 0.85),
          P(rrect(c - 0.6 * s, top + 1.1 * s, 1.2 * s, 3 * s, 0.3 * s), fl),
          ...mid(c, 0.92),
          P(ellipse(c, h + 0.6, 0.6 * s, 0.45 * s), tone(ms, "shade"), { flat: true, opacity: 0.8 }),
        ] };
        return { front, back };
      });
    },
  }),

  // bez ayakkabı: a low canvas upper, a rubber toe bumper and sole, a foxing stripe along the sole,
  // five eyelets a side with crossed laces (a toddler's slips on, with two elastic gores); a heel tape behind
  shoes_canvas: named("shoes", "Canvas shoes", "bez ayakkabı", {
    colors: 3, defaults: ["fab_04", "fab_01", "fab_01"], patterns: SPORTY, tags: ["casual", "summer", "school"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#2E3A59", so = ctx.colors[1] ?? "#F7F3EA", st = ctx.colors[2] ?? "#F7F3EA", toddler = b.build === "toddler";
      return pair(side => {
        const f = footOf(b, side, 0.3), { x, w, h, s } = f, top = -1.6, t = 0.3 * h, hem = h + 0.6 - t, c = heelX(f);
        const out = upperFront(f, top, 0.6, 1), path = smooth(out, true, 1), cup = heelCup(f, top), cupPath = smooth(cup, true, 1), m = (y: number) => midAt(f, top, y);
        const capY = h + 0.6 - 0.35 * (h + 0.6 - top), ys = [0, 1, 2, 3, 4].map(i => top + 0.6 * s + ((capY - 0.8 * s - top - 0.6 * s) * i) / 4);
        const stripe = (cx: number, k: number) => [line([[cx - w * k, hem + 0.05], [cx + w * k, hem + 0.05]], tone(so, "deep"), 0.25, 0.6), line([[cx - w * k, hem + 0.45], [cx + w * k, hem + 0.45]], st, 0.4, 0.95)];
        const front: Group = { shapes: [
          P(rrect(-1.2 * s, top - 0.5 * s, 2.4 * s, 1.6 * s, 0.6 * s), tone(up, "light")),
          S(out, up), ...printed(ctx, path, { hem, cx: x }), instep(f, up, path, h * 0.3), ...toeLight(f, up, path, h * 0.3),
          ...(toddler
            ? [-1, 1].map(d => ({ path: rrect(d * f.a * 0.5 - 0.6 * s, top + 0.2, 1.2 * s, 2.4 * s, 0.4 * s), fill: accent(up), flat: true, opacity: 0.55 } as Shape))
            : [{ ...S([[m(ys[0]) - 1.5 * s, top + 0.1, 0], [m(ys[0]) + 1.5 * s, top + 0.1, 0], [m(ys[4]) + 1.3 * s, ys[4]], [m(ys[4]) - 1.3 * s, ys[4]]], tone(up, "light")), flat: true, opacity: 0.7 },
              dots(ys.flatMap(y => [[m(y) - 1.45 * s, y], [m(y) + 1.45 * s, y]] as Vec2[]), 0.24 * s, tone(st, "shade")),
              crossed(ys, m, 1.4 * s, st, 0.4 * s)]),
          ...toeCap(f, so, capY, hem), ...sole(f, so, t, 1.03), ...stripe(x, 1.0),
        ] };
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, up), S(cup, up), ...printed(ctx, cupPath, { hem, cx: c }), ...toeLight({ ...f, x: c }, up, cupPath, h * 0.2, -1).slice(1),
          line([[-f.a + 0.5, top + 0.4], [f.a - 0.5, top + 0.4]], tone(up, "light"), 0.6 * s, 0.6),
          P(rrect(c - 0.7 * s, top + 0.1, 1.4 * s, hem - top, 0.3 * s), st),
          ...sole(f, so, t, 0.92, c), ...stripe(c, 0.9),
        ] };
        return { front, back };
      });
    },
  }),

  // klasik ayakkabı: closed lacing, the quarters meeting in a V over three lace bars; a narrower toe
  // with a straight cap seam and a polish gloss; a thin sole with a welt line and a heel stack
  shoes_oxford: named("shoes", "Oxford shoes", "klasik ayakkabı", {
    colors: 2, defaults: ["fab_22", "fab_24"], builds: ["adult", "elder", "child"], tags: ["formal", "work", "school"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#26272C", so = ctx.colors[1] ?? "#3A3D45", child = b.build === "child", deep = accent(up);
      return pair(side => {
        const f = footOf(b, side, 0.2), { x, w, h, s } = f, top = -1.4, t = (child ? 0.25 : 0.22) * h, hem = h + 0.6 - t, c = heelX(f), m = (y: number) => midAt(f, top, y);
        const out = upperFront(f, top, 0.9, child ? 0.97 : 0.88), path = smooth(out, true, 1), cup = heelCup(f, top), capY = h * 0.34;
        const ys = [0, 1, 2].map(i => top + 0.6 * s + i * 0.75 * s), g = (i: number) => (1.25 - i * 0.3) * s, vy = ys[2] + 0.9 * s;
        const front: Group = { shapes: [
          S(out, up), instep(f, up, path, h * 0.12, 0.26), ...toeLight(f, up, path, h * 0.42),
          // the quarters closing in a V over the laces
          line([[m(top) - g(0) - 0.5 * s, top + 0.1], [m(vy), vy], [m(top) + g(0) + 0.5 * s, top + 0.1]], deep, 0.4 * s, 0.75),
          ...ys.map((y, i) => line([[m(y) - g(i), y], [m(y) + g(i), y]], deep, 0.32 * s, 0.9)),
          dots(ys.flatMap((y, i) => [[m(y) - g(i), y], [m(y) + g(i), y]] as Vec2[]), 0.2 * s, tone(up, "edge")),
          line([[x - w * 0.9, capY + 0.9 * s], [x - w * 0.45, capY], [x + w * 0.45, capY], [x + w * 0.9, capY + 0.9 * s]], tone(up, "shade"), 0.4 * s, 0.8),
          line([[x - w * 0.7, h * 0.62], [x - w * 0.6, h * 0.42], [x - w * 0.34, h * 0.32]], tone(up, "edge"), 0.45 * s, 0.6),
          ...sole(f, so, t, 1.02),
          line([[x - w * 0.96, hem + 0.12], [x + w * 0.96, hem + 0.12]], tone(so, "light"), 0.25, 0.5),
        ] };
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, up), S(cup, up), ...toeLight({ ...f, x: c }, up, smooth(cup, true, 1), h * 0.2, -1).slice(1),
          line([[c, top + 0.5], [c, hem]], tone(up, "shade"), 0.4 * s, 0.75),
          line([[-f.a + 0.5, top + 0.35], [f.a - 0.5, top + 0.35]], tone(up, "light"), 0.6 * s, 0.6),
          ...sole(f, so, t, 0.92, c),
          P(rrect(c - w * 0.56, hem - 0.6 * s, w * 1.12, t + 0.6 * s, [0.3, 0.3, 0.5, 0.5]), so),
          line([[c - w * 0.52, hem + t * 0.4], [c + w * 0.52, hem + t * 0.4]], tone(so, "light"), 0.25, 0.4),
        ] };
        return { front, back };
      });
    },
  }),

  // bağcıklı ayakkabı: open lacing, two quarter flaps over the vamp with a tongue between them, a full
  // round toe, welt stitching along a chunkier sole; a stitched back seam and a heel stack behind
  shoes_derby: named("shoes", "Derby shoes", "bağcıklı ayakkabı", {
    colors: 2, defaults: ["fab_20", "fab_28"], builds: ["adult", "elder", "child"], tags: ["formal", "work", "casual", "school"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#6B4A35", so = ctx.colors[1] ?? "#4B3428", deep = tone(up, "deep");
      return pair(side => {
        const f = footOf(b, side, 0.3), { x, w, h, s } = f, top = -1.5, t = (b.build === "child" ? 0.28 : 0.3) * h, hem = h + 0.6 - t, c = heelX(f), m = (y: number) => midAt(f, top, y);
        const out = upperFront(f, top, 0.5, 1), path = smooth(out, true, 1), cup = heelCup(f, top), cupPath = smooth(cup, true, 1);
        const ys = [0, 1, 2].map(i => top + 0.7 * s + i * 0.8 * s), yb = ys[2] + 0.8 * s;
        const front: Group = { shapes: [
          S(out, up), instep(f, up, path, h * 0.2, 0.26), ...toeLight(f, up, path, h * 0.45),
          // the tongue between the flaps, the flaps' edges curving out over the vamp
          P(rrect(m(yb) - 0.8 * s, top + 0.1, 1.6 * s, yb - top, 0.5 * s), tone(up, "shade"), { flat: true, opacity: 0.8 }),
          ...[-1, 1].map(d => line([[m(top) + d * 0.9 * s, top + 0.2], [m(yb) + d * 0.9 * s, yb], [m(yb) + d * 2.4 * s, yb + 0.7 * s], [x + d * w * 0.86, h * 0.32]], deep, 0.4 * s, 0.75)),
          ...ys.map(y => line([[m(y) - 1.4 * s, y], [m(y) + 1.4 * s, y]], deep, 0.32 * s, 0.9)),
          dots(ys.flatMap(y => [[m(y) - 1.45 * s, y], [m(y) + 1.45 * s, y]] as Vec2[]), 0.22 * s, tone(up, "edge")),
          ...sole(f, so, t, 1.04),
          stitch([[x - w * 0.94, hem + 0.35], [x + w * 0.94, hem + 0.35]], tone(so, "light"), 0.22 * s, 0.5 * s, 0.4 * s, 0.7),
        ] };
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, up), S(cup, up), ...toeLight({ ...f, x: c }, up, cupPath, h * 0.2, -1).slice(1),
          stitch([[c - 0.25 * s, top + 0.5], [c - 0.25 * s, hem]], tone(up, "light"), 0.22 * s, 0.5 * s, 0.4 * s, 0.6),
          line([[c + 0.1, top + 0.5], [c + 0.1, hem]], tone(up, "shade"), 0.35 * s, 0.7),
          ...sole(f, so, t, 0.92, c),
          P(rrect(c - w * 0.58, hem - 0.8 * s, w * 1.16, t + 0.8 * s, [0.3, 0.3, 0.5, 0.5]), so),
          line([[c - w * 0.54, hem + 0.1], [c + w * 0.54, hem + 0.1]], tone(so, "light"), 0.25, 0.45),
        ] };
        return { front, back };
      });
    },
  }),

  // mokasen: a slip-on cut low over the bare instep, the moccasin apron stitched round the vamp, a
  // saddle band with its slot (a child's has none), a thin sole; a low soft heel cup behind
  shoes_loafer: named("shoes", "Loafers", "mokasen", {
    colors: 2, defaults: ["fab_32", "fab_28"], builds: ["adult", "elder", "child"], tags: ["casual", "formal", "summer", "work"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#7A3F2A", so = ctx.colors[1] ?? "#4B3428", child = b.build === "child";
      return pair(side => {
        const f = footOf(b, side, 0.2), { x, w, h, s } = f, t = 0.2 * h, hem = h + 0.6 - t, c = heelX(f), sy = 0.45;
        const edge: Vec2[] = [[x - w * 0.98, 0.9], [x - w * 0.55, 0.32], [x * 0.3, 0.2], [x + w * 0.55, 0.32], [x + w * 0.98, 0.9]];
        const vamp: Pt[] = [...edge, [x + w * 1.02, h * 0.7], [x + w * 0.92, hem + 0.3, 0], [x - w * 0.92, hem + 0.3, 0], [x - w * 1.02, h * 0.7]], path = smooth(vamp, true, 1);
        const front: Group = { shapes: [
          ...bareFoot(b, ctx.skin, side),
          S(vamp, up), instep(f, up, path, h * 0.25, 0.22), ...toeLight(f, up, path, h * 0.55),
          line(edge.map(([px, py]): Vec2 => [px, py + 0.2]), tone(up, "deep"), 0.4 * s, 0.8),
          // the apron: a U of stitching round the top of the foot
          stitch(curve([x - w * 0.7, 0.8], [x, 2 * h * 0.78 - 0.8], [x + w * 0.7, 0.8], 10), tone(up, "light"), 0.25 * s, 0.5 * s, 0.35 * s, 0.75),
          ...(child ? [] : [{ ...P(rrect(x - w * 0.56, sy, w * 1.12, 2 * s, 0.5 * s), tone(up, "light")), clip: path }, { path: ellipse(x, sy + 1 * s, 0.75 * s, 0.32 * s), fill: tone(up, "deep"), flat: true, opacity: 0.85 } as Shape]),
          ...sole(f, so, t, 1.02),
        ] };
        const cupTop = h + 0.3 - 3 * s, cup: Pt[] = [[c - w * 0.84, cupTop], [c, cupTop + 0.3 * s], [c + w * 0.84, cupTop], [c + w * 0.82, hem + 0.3, 0], [c - w * 0.82, hem + 0.3, 0]];
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, up), ...bareHeel(b, ctx.skin, side).slice(1),
          S(cup, up), ...toeLight({ ...f, x: c }, up, smooth(cup, true, 1), h * 0.5, -1).slice(1),
          line([[c, cupTop + 0.4 * s], [c, hem]], tone(up, "shade"), 0.35 * s, 0.7),
          line([[c - w * 0.82, cupTop + 0.2], [c, cupTop + 0.5 * s], [c + w * 0.82, cupTop + 0.2]], tone(up, "deep"), 0.4 * s, 0.8),
          ...sole(f, so, t, 0.9, c),
          P(rrect(c - w * 0.56, hem - 0.4 * s, w * 1.12, t + 0.4 * s, [0.3, 0.3, 0.5, 0.5]), so),
        ] };
        return { front, back };
      });
    },
  }),

  // kapalı terlik: a wipeable clog, its vamp domed high with a grid of vent holes, a heel strap on two
  // rivets swung up behind the ankle, a chunky sole; the open heel behind with the strap across it
  shoes_clogs_work: named("shoes", "Work clogs", "kapalı terlik", {
    colors: 2, defaults: ["fab_01", "fab_21"], builds: ["adult", "elder", "child"], tags: ["work", "comfort", "summer"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#F7F3EA", st = ctx.colors[1] ?? "#9AA0A6", r = b.build === "child" ? 1.25 : 1;
      return pair(side => {
        const f = footOf(b, side, 0.9), { x, w, h, s } = f, t = 0.3 * h, hem = h + 0.6 - t, c = heelX(f), ry = h * 0.3;
        const vamp: Pt[] = [[x - w, h * 0.25], [x - w * 0.62, -0.1], [x * 0.4, -0.45], [x + w * 0.62, -0.1], [x + w, h * 0.25], [x + w * 1.03, h * 0.7], [x + w * 0.95, hem + 0.3, 0], [x - w * 0.95, hem + 0.3, 0], [x - w * 1.03, h * 0.7]], path = smooth(vamp, true, 1);
        const holes = [0, 1, 2].flatMap(i => [-1, 0, 1].map((j): Vec2 => [x + j * w * 0.42 + (i - 1) * 0.1 * x, h * 0.08 + i * h * 0.17]));
        const rivets = (cx: number, k: number) => dots([[cx - w * k, ry], [cx + w * k, ry]], 0.25 * s * r, st, 0.25 * s * r, 1);
        const front: Group = { shapes: [
          ...bareFoot(b, ctx.skin, side),
          P(band([[x - w * 0.92, ry], [x - w * 0.6, -0.6], [x * 0.3, -1.1], [x + w * 0.6, -0.6], [x + w * 0.92, ry]], [0.8 * s]), st),
          S(vamp, up), ...toeLight(f, up, path, h * 0.62), instep(f, up, path, h * 0.45, 0.18),
          dots(holes, 0.35 * r, darkSole(up), 0.25 * r, 0.6), rivets(x, 0.92),
          ...sole(f, st, t, 1.05),
        ] };
        const lt = hem - 3.4 * s, lip: Pt[] = [[c - w * 0.95, hem + 0.1, 0], [c - w * 0.92, lt + 0.5 * s], [c, lt], [c + w * 0.92, lt + 0.5 * s], [c + w * 0.95, hem + 0.1, 0]];
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, up), ...bareHeel(b, ctx.skin, side).slice(1),
          S(lip, up), ...toeLight({ ...f, x: c }, up, smooth(lip, true, 1), h * 0.2, -1).slice(1),
          P(band([[c - w * 0.9, lt + 1.2 * s], [c - w * 0.6, ry - 0.6 * s], [c, ry - 0.9 * s], [c + w * 0.6, ry - 0.6 * s], [c + w * 0.9, lt + 1.2 * s]], [1.8 * s]), st), dots([[c - w * 0.88, lt + 1.2 * s], [c + w * 0.88, lt + 1.2 * s]], 0.25 * s * r, tone(st, "light"), 0.25 * s * r, 1),
          P(rrect(c - w * 0.92, hem - 0.1, w * 1.84, t + 0.1, Math.min(0.6, t / 2)), st),
          P(ellipse(c, h + 0.6, 0.7 * s, 0.5 * s), tone(st, "deep"), { flat: true, opacity: 0.7 }),
        ] };
        return { front, back };
      });
    },
  }),

  // çorap: a sock in the foot's shape (no sole), the toe and the ribbed cuff in the second colour, a
  // toe seam; a heel patch behind; a child's and a toddler's bag a little at the ankle
  shoes_socks: named("shoes", "Socks", "çorap", {
    colors: 2, defaults: ["fab_01", "fab_21"], patterns: SPORTY, tags: ["indoor", "home", "modest", "comfort"],
    draw: ctx => {
      const b = ctx.body, c1 = ctx.colors[0] ?? "#F7F3EA", c2 = ctx.colors[1] ?? "#9AA0A6", h = b.footH, s = footScale(b), hw = b.legW[2] / 2 + 0.4;
      // under a trouser leg the cuff is hidden: the sock stops where a shoe's opening would
      const bag = b.build === "child" || b.build === "toddler" ? 0.4 : 0.1, y0 = -1 - 3 * s, bot = h + 0.3, hid = covered(ctx);
      const ribs = hid ? [] : cuff(hw, y0, -0.9, c2, 3, s), yt = hid ? -1.8 : y0 + 1;
      const wrinkles = (cx: number) => line([[cx - hw * 0.6, -0.5], [cx, -0.2], [cx + hw * 0.6, -0.5]], tone(c1, "shade"), 0.3 * s, 0.45);
      return pair(side => {
        const x = side * 0.8, wb = b.footW / 2 + 0.45, f: Foot = { b, side, x, w: wb, h, s, a: hw }, c = side * 0.2;
        const body = sockFront(x, hw, wb, h, yt, bot, bag), path = smooth(body, true, 1), hb = sockBack(c, hw, wb, h, yt, bot, bag), hp = smooth(hb, true, 1);
        const front: Group = { shapes: [
          S(body, c1), ...printed(ctx, path, { hem: bot, cx: x }), ...toeLight(f, c1, path, h * 0.3),
          { path: ellipse(x, bot + 0.6, wb * 0.9, bot + 0.6 - h * 0.78), fill: c2, flat: true, clip: path },
          line([[x - wb * 0.85, h * 0.8], [x, h * 0.74], [x + wb * 0.85, h * 0.8]], tone(c2, "shade"), 0.35 * s, 0.6),
          wrinkles(0), ...ribs,
        ] };
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, c1), S(hb, c1), ...printed(ctx, hp, { hem: bot, cx: c }), ...toeLight({ ...f, x: c }, c1, hp, h * 0.2, -1).slice(1),
          { path: rrect(c - 2 * s, bot - 3 * s, 4 * s, 3.4 * s, 1.3 * s), fill: c2, flat: true, clip: hp },
          wrinkles(c), ...ribs,
        ] };
        return { front, back };
      });
    },
  }),

  // patik: a knitted bootie, round and soft, a scalloped ribbed cuff, a pompom on the front and a felt
  // sole patch in the second colour (a toddler's cuff is folded down and tied with a ribbon); a heel patch behind
  shoes_patik: named("shoes", "Knitted booties", "patik", {
    colors: 2, defaults: ["fab_02", "fab_55"], patterns: prints("pat_stripe_h", "pat_breton", "pat_dots", "pat_dots_small", "pat_gingham", "pat_floral", "pat_ditsy", "pat_stars"), tags: ["indoor", "home", "winter", "traditional", "comfort"],
    draw: ctx => {
      const b = ctx.body, c1 = ctx.colors[0] ?? "#F0E2C8", c2 = ctx.colors[1] ?? "#F3CBD3", h = b.footH, s = footScale(b), toddler = b.build === "toddler";
      const hw = b.legW[2] / 2 + 0.6, y1 = -0.8, y0 = y1 - (toddler ? 2.2 : 3) * s, bot = h + 0.5, hid = covered(ctx), yt = hid ? -1.8 : y1 - 0.5;
      const cf = hid ? [] : cuff(hw, y0, y1, c2, 4, s, toddler ? 0 : 4);
      const bow: Shape[] = hid ? [] : toddler
        ? [-1, 1].map(d => S([[0, y1 - 0.4 * s], [d * 1.3 * s, y1 - 1.2 * s], [d * 1.4 * s, y1 + 0.3 * s]], tone(c2, "deep"))).concat([P(ellipse(0, y1 - 0.4 * s, 0.4 * s), tone(c2, "deep"))])
        : [P(ellipse(0, y0 + 1.6 * s, 0.7 * s), c2), { path: ellipse(-0.2 * s, y0 + 1.4 * s, 0.3 * s), fill: tone(c2, "light"), flat: true, opacity: 0.6 }];
      return pair(side => {
        const x = side * 0.8, wb = shoeHalfWidth(b) + 0.1, f: Foot = { b, side, x, w: wb, h, s, a: hw }, c = side * 0.2;
        const body = sockFront(x, hw - 0.2, wb, h, yt, bot, 0.3), path = smooth(body, true, 1), hb = sockBack(c, hw - 0.2, wb, h, yt, bot, 0.3), hp = smooth(hb, true, 1);
        const pad = (cx: number, k: number) => P(rrect(cx - wb * k, bot - 0.55, wb * 2 * k, 0.55, 0.25), c2);
        const front: Group = { shapes: [
          S(body, c1), ...printed(ctx, path, { hem: bot, cx: x }), ...toeLight(f, c1, path, h * 0.35),
          line([[x - wb * 0.7, h * 0.55], [x, h * 0.42], [x + wb * 0.7, h * 0.55]], tone(c1, "shade"), 0.4 * s, 0.4),
          pad(x, 0.9), ...cf, ...bow,
        ] };
        const back: Group = { shapes: [
          ...toeFlare(ctx, f, c1), S(hb, c1), ...printed(ctx, hp, { hem: bot, cx: c }), ...toeLight({ ...f, x: c }, c1, hp, h * 0.2, -1).slice(1),
          { path: rrect(c - 1.8 * s, bot - 3 * s, 3.6 * s, 3.4 * s, 1.2 * s), fill: c2, flat: true, clip: hp },
          pad(c, 0.75), ...cf,
        ] };
        return { front, back };
      });
    },
  }),

  // bilekli spor ayakkabı: the sneaker with a shaft a fifth of the shin high, a padded collar, the laces
  // running up it (a toddler's has one hook-and-loop strap), a plain disc patch on the outer ankle
  shoes_hightops: named("shoes", "High-top sneakers", "bilekli spor ayakkabı", {
    colors: 3, defaults: ["fab_22", "fab_01", "fab_01"], patterns: SPORTY, tags: ["casual", "sport", "school"], over: ["bottom"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#26272C", so = ctx.colors[1] ?? "#F7F3EA", lace = ctx.colors[2] ?? "#F7F3EA", L = b.shinL, s = footScale(b), toddler = b.build === "toddler";
      const k = toddler ? 0.3 : b.build === "child" ? 0.22 : 0.2, wide = roomy(ctx) ? 0.4 : 0, fit = shaftFit(ctx, k, 0.6, 0.6, 1.6, 0.5 * s), half = fit.half, u0 = 1 - k, y0 = L * u0;
      const sh = shaftOutline(L, k, half, 0.2), shPath = smooth(sh, true, 1), top = -0.6, ha = half(1 + top / L) + 0.05, hem = L + 1.2;
      const ys = Array.from({ length: 6 }, (_, i) => y0 + 1.9 * s + ((L - 0.8 - y0 - 1.9 * s) * i) / 5), hc = half(u0) + 0.25 + wide, ty = (y0 + 1.4 * s + L + top) / 2;
      const collar = P(rrect(-hc, y0 - 0.3, hc * 2, 1.6 * s, 0.75 * s), tone(up, "light"));
      const more = shafts(side => {
        const um = u0 + k * 0.55, py = L * um;
        const front: Group = { shapes: [
          P(rrect(-1.3 * s, y0 - 1.2 * s, 2.6 * s, 2.4 * s, 0.8 * s), tone(up, "light")),
          S(sh, up), ...printed(ctx, shPath, { hem }), ...shaftLight(half, L, k, up, shPath),
          ...(toddler
            ? [P(band([[-side * (half(ty / L) - 0.9), ty], [side * (half(ty / L) + 0.5 * s), ty - 0.1]], [1.6 * s]), lace)]
            : [{ ...S([[-1.4 * s, y0 + 0.6, 0], [1.4 * s, y0 + 0.6, 0], [1.6 * s, L + 0.8, 0], [-1.6 * s, L + 0.8, 0]], tone(up, "light")), flat: true, opacity: 0.5 },
              ...ys.map((y, i) => line([[-1.6 * s, y + (i % 2 ? 0.2 : -0.15) * s], [1.6 * s, y + (i % 2 ? -0.15 : 0.2) * s]], lace, 0.45 * s, 0.95)),
              dots(ys.flatMap(y => [[-1.9 * s, y], [1.9 * s, y]] as Vec2[]), 0.26 * s, accent(up))]),
          ...(toddler ? [] : [P(ellipse(side * (half(um) - 1.5 * s), py, 1 * s), lace)]),
          collar,
        ] };
        const back: Group = { shapes: [
          S(sh, up), ...printed(ctx, shPath, { hem }), ...shaftLight(half, L, k, up, shPath, 0.35, -1),
          line([[0, y0 + 1.2], [0, hem]], tone(up, "shade"), 0.35 * s, 0.6),
          P(rrect(-0.6 * s, y0 - 1.3 * s, 1.2 * s, 3.2 * s, 0.5 * s), lace), collar,
        ] };
        return { front, back };
      });
      return pair(side => {
        const f = footOf(b, side, 0.5), { x, w, h } = f, t = 0.34 * h, hemF = h + 0.6 - t, c = heelX(f);
        const out = bootFoot(f, top, ha, 0.6), path = smooth(out, true, 1), heel = bootHeel(f, top, ha), hp = smooth(heel, true, 1), m = (y: number) => midAt(f, top, y);
        const bars = toddler ? [] : [h * 0.02, h * 0.22].map(y => line([[m(y) - 1.6 * s, y], [m(y) + 1.6 * s, y + 0.2 * s]], lace, 0.45 * s, 0.95));
        const front: Group = { shapes: [S(out, up), ...printed(ctx, path, { hem: hemF, cx: x }), instep(f, up, path, h * 0.3), ...toeLight(f, up, path, h * 0.4), ...bars,
          ...toeCap(f, so, h * 0.5, hemF), ...sole(f, so, t), line([[x - w, hemF + 0.4], [x + w, hemF + 0.4]], tone(so, "shade"), 0.35, 0.7)] };
        const back: Group = { shapes: [...toeFlare(ctx, f, up), S(heel, up), ...printed(ctx, hp, { hem: hemF, cx: c }), ...toeLight({ ...f, x: c }, up, hp, h * 0.2, -1).slice(1),
          P(rrect(c - 0.6 * s, top + 0.5, 1.2 * s, hemF - top - 0.3, 0.3 * s), lace), ...sole(f, so, t, 0.92, c)] };
        return { front, back };
      }, more);
    },
  }),

  // Chelsea bot: a plain leather shaft a third of the shin high, an elastic gusset down each side, a
  // slim toe and a thin welted sole; a pull tab standing above the back, a heel stack
  shoes_boots_chelsea: named("shoes", "Chelsea boots", "Chelsea bot", {
    colors: 2, defaults: ["fab_28", "fab_22"], builds: ["adult", "elder", "child"], tags: ["casual", "formal", "winter", "work"], over: ["bottom"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#4B3428", so = ctx.colors[1] ?? "#26272C", L = b.shinL, s = footScale(b), child = b.build === "child", k = 0.3;
      const fit = shaftFit(ctx, k, 0.35, 0.45 + (roomy(ctx) ? 0.6 : 0), 2, 0.45 * s), half = fit.half, u0 = 1 - k, y0 = L * u0;
      const sh = shaftOutline(L, k, half, fit.trousers ? 0 : 0.3 * s), shPath = smooth(sh, true, 1), top = -1.4, ha = half(1 + top / L) + 0.05, gw = (child ? 1.8 : 2.2) * s, gy = L - 1;
      // the gussets: a V of elastic down each side of the shaft, ribbed
      const gussets: Shape[] = [-1, 1].flatMap(e => {
        const um = 1 - k * 0.3, o = e * half(u0), i = e * (half(u0) - gw), im = e * (half(um) - gw * 0.75), tip = e * (half(gy / L) - 0.2), p = new Path();
        for (const q of [0.25, 0.5, 0.75]) p.moveTo(o + (i - o) * q, y0 + 0.4).lineTo(e * half(um) + (im - e * half(um)) * q, L * um).lineTo(tip + e * 0.1 * (1 - q), gy - 1.5 * (1 - q));
        return [{ path: smooth([[o + e, y0 - 0.5, 0], [i, y0 - 0.5, 0], [im, L * um, 0], [tip, gy + 0.2, 0], [o + e * 2, gy, 0]], true, 1), fill: tone(up, "deep"), flat: true, clip: shPath } as Shape,
          { path: p, stroke: { color: tone(up, "light"), width: 0.25 * s }, flat: true, opacity: 0.35, clip: shPath }];
      });
      const rim = line([[-half(u0) + 0.3, y0 + 0.35], [half(u0) - 0.3, y0 + 0.35]], tone(up, "light"), 0.35 * s, 0.5);
      const more = shafts(() => ({
        front: { shapes: [S(sh, up), ...shaftLight(half, L, k, up, shPath), ...gussets, rim] },
        back: { shapes: [P(rrect(-0.7 * s, y0 - 1.6 * s, 1.4 * s, 2.4 * s, 0.35 * s), tone(up, "light")), S(sh, up), ...shaftLight(half, L, k, up, shPath, 0.35, -1), ...gussets, rim,
          stitch([[0, y0 + 0.9 * s], [0, L + 1]], tone(up, "light"), 0.22 * s, 0.5 * s, 0.4 * s, 0.6)] },
      }));
      return pair(side => {
        const f0 = footOf(b, side, 0.2), f = child ? f0 : { ...f0, w: f0.w * 0.94 }, { x, w, h } = f, t = 0.22 * h, hem = h + 0.6 - t, c = heelX(f);
        const out = bootFoot(f, top, ha, 0.3), path = smooth(out, true, 1), heel = bootHeel(f, top, ha), hp = smooth(heel, true, 1);
        const front: Group = { shapes: [S(out, up), instep(f, up, path, h * 0.2), ...toeLight(f, up, path, h * 0.45), line([[x - w * 0.7, h * 0.6], [x - w * 0.6, h * 0.42], [x - w * 0.36, h * 0.32]], tone(up, "edge"), 0.4 * s, 0.5),
          ...sole(f, so, t, 1.03), line([[x - w * 0.97, hem + 0.12], [x + w * 0.97, hem + 0.12]], tone(so, "light"), 0.25, 0.5)] };
        const back: Group = { shapes: [...toeFlare(ctx, f, up), S(heel, up), ...toeLight({ ...f, x: c }, up, hp, h * 0.2, -1).slice(1), line([[0, top + 0.3], [c, hem]], tone(up, "shade"), 0.4 * s, 0.7),
          ...sole(f, so, t, 0.92, c), P(rrect(c - w * 0.58, hem - 0.9 * s, w * 1.16, t + 0.9 * s, [0.3, 0.3, 0.5, 0.5]), so), line([[c - w * 0.54, hem + 0.05], [c + w * 0.54, hem + 0.05]], tone(so, "light"), 0.25, 0.45)] };
        return { front, back };
      }, more);
    },
  }),

  // iş botu: a nubuck lace-up a third of the shin high, a padded collar, five pairs of eyelets and
  // crossed laces, a toe-cap seam, welt stitching and a chunky lug sole; a pull loop and a dark counter behind
  shoes_boots_work: named("shoes", "Work boots", "iş botu", {
    colors: 3, defaults: ["fab_31", "fab_20", "fab_22"], builds: ["adult", "elder", "child"], tags: ["work", "winter", "sport"], over: ["bottom"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#9C5A34", so = ctx.colors[1] ?? "#6B4A35", lace = ctx.colors[2] ?? "#26272C", L = b.shinL, s = footScale(b), k = 0.35, pad = roomy(ctx) ? 0.5 : 0;
      const fit = shaftFit(ctx, k, 0.5 + pad, 0.7 + pad, 2.2, 0.6 * s), half = fit.half, u0 = 1 - k, y0 = L * u0;
      const sh = shaftOutline(L, k, half, 0.2), shPath = smooth(sh, true, 1), top = -1.4, ha = half(1 + top / L) + 0.05, hc = half(u0) + 0.35;
      const ys = Array.from({ length: 5 }, (_, i) => y0 + 2.4 * s + ((L - y0 - 2.4 * s) * i) / 4);
      const collar = P(rrect(-hc, y0 - 0.6, hc * 2, 2 * s, 0.9 * s), tone(up, "light"));
      const more = shafts(() => ({
        front: { shapes: [
          S(sh, up), ...shaftLight(half, L, k, up, shPath, 0.18),
          { ...S([[-1.3 * s, y0 + 0.8, 0], [1.3 * s, y0 + 0.8, 0], [1.5 * s, L + 1.2, 0], [-1.5 * s, L + 1.2, 0]], tone(up, "shade")), flat: true, opacity: 0.5 },
          ...[-1, 1].map(d => line([[d * 1.75 * s, y0 + 1], [d * 1.85 * s, L + 1.1]], tone(up, "deep"), 0.3 * s, 0.6)),
          dots(ys.flatMap(y => [[-1.75 * s, y], [1.75 * s, y]] as Vec2[]), 0.3 * s, lace), crossed(ys, () => 0, 1.7 * s, lace, 0.45 * s),
          collar,
        ] },
        back: { shapes: [
          P(band([[-0.6 * s, y0 + 1], [-0.6 * s, y0 - 1.1 * s], [0, y0 - 1.7 * s], [0.6 * s, y0 - 1.1 * s], [0.6 * s, y0 + 1]], [0.6 * s]), lace),
          S(sh, up), ...shaftLight(half, L, k, up, shPath, 0.18, -1), collar,
          stitch([[0, y0 + 1.6 * s], [0, L + 1]], tone(up, "light"), 0.22 * s, 0.5 * s, 0.4 * s, 0.6),
        ] },
      }));
      return pair(side => {
        const f = footOf(b, side, 0.6), { x, w, h } = f, t = 0.42 * h, hem = h + 0.6 - t, c = heelX(f), capY = h * 0.42;
        const out = bootFoot(f, top, ha, 0.4), path = smooth(out, true, 1), heel = bootHeel(f, top, ha), hp = smooth(heel, true, 1);
        const front: Group = { shapes: [S(out, up), instep(f, up, path, h * 0.2, 0.22), ...toeLight(f, up, path, h * 0.5).slice(1),
          line([[x - w * 0.92, capY + 1.3 * s], [x - w * 0.5, capY], [x + w * 0.5, capY], [x + w * 0.92, capY + 1.3 * s]], tone(up, "deep"), 0.4 * s, 0.7),
          stitch([[x - w * 0.96, hem - 0.3], [x + w * 0.96, hem - 0.3]], tone(up, "light"), 0.22 * s, 0.5 * s, 0.4 * s, 0.7),
          ...lugSole(f, so, t, 5, 0.55 * s)] };
        const back: Group = { shapes: [...toeFlare(ctx, f, up), S(heel, up), ...toeLight({ ...f, x: c }, up, hp, h * 0.2, -1).slice(1),
          S([[c - w * 0.8, hem + 0.2, 0], [c - w * 0.7, h * 0.1], [c, -0.6], [c + w * 0.7, h * 0.1], [c + w * 0.8, hem + 0.2, 0]], tone(up, "deep"), { flat: true, opacity: 0.6, clip: hp }),
          ...lugSole(f, so, Math.max(t, 1.4 * s), 4, 0.55 * s, 0.94, c)] };
        return { front, back };
      }, more);
    },
  }),

  // kışlık bot: a puffy insulated shell half the shin high with quilting, a scalloped fleece cuff, a strap
  // with a toggle (hook-and-loop on children), a rubber toe cap and a tread sole; a heel kick and a pull loop behind
  shoes_boots_winter: named("shoes", "Winter boots", "kışlık bot", {
    colors: 3, defaults: ["fab_20", "fab_22", "fab_02"], tags: ["winter", "istanbul", "child"], over: ["bottom"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#6B4A35", so = ctx.colors[1] ?? "#26272C", fl = ctx.colors[2] ?? "#F0E2C8", L = b.shinL, s = footScale(b), k = 0.47;
      const kid = b.build === "child" || b.build === "toddler", pad = roomy(ctx) ? 1 : 0;
      const fit = shaftFit(ctx, k, 1.8 + pad, 1.8 + pad, 3.4, 0.9), half = fit.tucked ? (u: number) => fit.half(Math.min(u, 0.75)) : fit.half, u0 = 1 - k, y0 = L * u0;
      const sh = shaftOutline(L, k, half, 0.3), shPath = smooth(sh, true, 1), top = -1.2, ha = half(1 + top / L) + 0.05, hem = L + 1.2;
      const ch = (kid ? 1.6 : 2.2) * s, hc = half(u0) + 0.6, fleece = cuff(hc, y0 - 0.6, y0 - 0.6 + ch, fl, 0, s, 5);
      const qs = [0.36, 0.68].map(q => y0 + L * k * q), uy = (y: number) => y / L, sy = y0 + L * k * 0.42;
      const quilt = qs.map(y => line([[-half(uy(y)), y - 0.3], [0, y + 0.3], [half(uy(y)), y - 0.3]], tone(up, "shade"), 0.4 * s, 0.6, { clip: shPath }));
      const more = shafts(side => {
        const hs = half(uy(sy)), strap: Shape[] = [P(band([[-hs - 1, sy], [hs + 1, sy]], [1.3 * s]), fl, { clip: shPath }),
          kid ? P(band([[side * (hs - 2.4 * s), sy + 0.1], [side * (hs + 1 * s), sy + 0.25]], [1.8 * s]), fl) : P(rrect(side * (hs - 1.3 * s) - 0.35 * s, sy - 1 * s, 0.7 * s, 2 * s, 0.35 * s), tone(fl, "shade"))];
        return {
          front: { shapes: [S(sh, up), ...shaftLight(half, L, k, up, shPath, 0.4), ...quilt, ...strap, ...fleece] },
          back: { shapes: [P(band([[-0.6 * s, y0 + 0.5], [-0.6 * s, y0 - 1.6 * s], [0, y0 - 2.2 * s], [0.6 * s, y0 - 1.6 * s], [0.6 * s, y0 + 0.5]], [0.6 * s]), tone(fl, "shade")),
            S(sh, up), ...shaftLight(half, L, k, up, shPath, 0.3, -1), ...quilt, line([[0, y0 + ch], [0, hem]], tone(up, "shade"), 0.35 * s, 0.6), ...strap, ...fleece] },
        };
      });
      return pair(side => {
        const f = footOf(b, side, 0.9), { w, h } = f, t = 0.45 * h, hemF = h + 0.6 - t, c = heelX(f), g = Math.max(w * 0.84, ha);
        const out = bootFoot(f, top, ha, 0.6), path = smooth(out, true, 1), heel = bootHeel(f, top, ha), hp = smooth(heel, true, 1);
        const front: Group = { shapes: [S(out, up), instep(f, up, path, h * 0.2, 0.2), ...toeLight(f, up, path, h * 0.4), ...toeCap(f, so, hemF - 0.35 * (hemF - top), hemF), ...lugSole(f, so, t, 6, 0.6 * s, 1.06)] };
        const back: Group = { shapes: [
          P(rrect(side > 0 ? c + g * 0.7 : c - g * 0.7 - 2.2 * s, hemF - 1.3 * s, 2.2 * s, 1.3 * s, 0.5 * s), so),
          ...toeFlare(ctx, f, up), S(heel, up), ...toeLight({ ...f, x: c }, up, hp, h * 0.2, -1).slice(1), ...lugSole(f, so, t, 5, 0.6 * s, 0.98, c)] };
        return { front, back };
      }, more);
    },
  }),

  // uzun çizme: a fitted leather shaft to just under the knee (cut for a full calf first), two long
  // highlights, a trim band, ankle creases, a side zip with a metal pull; a seam and a stretch notch behind
  shoes_boots_knee: named("shoes", "Knee-high boots", "uzun çizme", {
    colors: 3, palettes: ["fabric", "fabric", "metal"], defaults: ["fab_22", "fab_22", "met_silver"], builds: ["adult", "elder", "child"], tags: ["formal", "winter", "modest"], over: ["bottom"],
    draw: ctx => {
      const b = ctx.body, up = ctx.colors[0] ?? "#26272C", so0 = ctx.colors[1] ?? "#26272C", zip = ctx.colors[2] ?? "#C3C8CE", L = b.shinL, s = footScale(b), k = 0.95, wide = roomy(ctx) ? 1 : 0;
      const so = so0 === up ? tone(so0, "deep") : so0;
      const fit = shaftFit(ctx, k, 0.5, 1 + wide, 2.4 + wide, 0.4 * s), half = fit.half, u0 = 1 - k, y0 = L * u0;
      const sh = shaftOutline(L, k, half, 0.3), shPath = smooth(sh, true, 1), top = -1.4, ha = half(1 + top / L) + 0.05, hw = half(1 - k / 2);
      const trim = P(rrect(-half(u0) - 0.35, y0 - 0.1, (half(u0) + 0.35) * 2, 1.2 * s, 0.5 * s), tone(up, "light"));
      const creases = [0, 1, 2].map(i => line([[-half(1) * 0.6, L - 0.3 - i * 1.1 * s], [0, L + 0.1 - i * 1.1 * s], [half(1) * 0.6, L - 0.3 - i * 1.1 * s]], tone(up, "shade"), 0.3 * s, 0.5));
      const more = shafts(side => {
        const zx = side * (half(0.5) - 1.1 * s);
        return {
          front: { shapes: [S(sh, up), ...shaftLight(half, L, k, up, shPath, 0.4),
            { path: rrect(-hw * 0.3, y0 + 3, Math.max(0.5, hw * 0.12), L * k - 8, 0.4), fill: tone(up, "light"), flat: true, opacity: 0.25, clip: shPath },
            line([[side * (half(u0 + 0.06) - 1.1 * s), y0 + 1.6 * s], [zx, L * 0.5], [side * (half(1) - 0.9 * s), L + 0.6]], tone(up, "deep"), 0.35 * s, 0.85),
            P(rrect(side * (half(u0 + 0.06) - 1.1 * s) - 0.35 * s, y0 + 1.4 * s, 0.7 * s, 1.5 * s, 0.35 * s), zip),
            ...creases, trim] },
          back: { shapes: [S(sh, up), ...shaftLight(half, L, k, up, shPath, 0.35, -1), line([[0, y0 + 2 * s], [0, L + 1.1]], tone(up, "shade"), 0.4 * s, 0.75), trim,
            { path: smooth([[-0.9 * s, y0 - 0.2, 0], [0.9 * s, y0 - 0.2, 0], [0, y0 + 2 * s, 0]], true, 1), fill: tone(up, "deep"), flat: true, opacity: 0.9 }] },
        };
      });
      return pair(side => {
        const f0 = footOf(b, side, 0.2), f = { ...f0, w: f0.w * 0.92 }, { x, w, h } = f, t = 0.22 * h, hem = h + 0.6 - t, c = heelX(f);
        const out = bootFoot(f, top, ha, 0.2), path = smooth(out, true, 1), heel = bootHeel(f, top, ha), hp = smooth(heel, true, 1);
        const front: Group = { shapes: [S(out, up), instep(f, up, path, h * 0.2), ...toeLight(f, up, path, h * 0.45), ...sole(f, so, t, 1.03), line([[x - w * 0.97, hem + 0.12], [x + w * 0.97, hem + 0.12]], tone(so, "light"), 0.25, 0.5)] };
        const back: Group = { shapes: [...toeFlare(ctx, f, up), S(heel, up), ...toeLight({ ...f, x: c }, up, hp, h * 0.2, -1).slice(1), ...sole(f, so, t, 0.92, c),
          P(rrect(c - w * 0.56, hem - 1 * s, w * 1.12, t + 1 * s, [0.3, 0.3, 0.5, 0.5]), so), line([[c - w * 0.52, hem + 0.05], [c + w * 0.52, hem + 0.05]], tone(so, "light"), 0.25, 0.45)] };
        return { front, back };
      }, more);
    },
  }),
};
