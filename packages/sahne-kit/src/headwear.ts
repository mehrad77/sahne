// Things worn on the head, in three slots: `head` coverings (headscarves, a turban, a kippah or
// takke: `wear.head`), `hat` hats and caps (`wear.hat`, also worn over a covering, so lift and widen
// a hat when `ctx.avatar.wear?.head` is set), and `hairwear` clips, bows and bands (`wear.hair`,
// drawn on `hair_front` so a hat covers them). Placed from the head's own measures: `headOf(ctx)`
// gives the outline for the face shape, `offset(-d)` a scarf's face opening, `eye(side)`, `y(line)`.
//
// THE HEADWEAR ARTIST'S FILE: add parts to `HEADWEAR` (ids by slot: head `headscarf_ turban_
// headwrap_ cap_ bandana_`, hat `hat_ cap_`, hairwear `hairclip_ hairbow_ hairflower_ headband_`).
// A covering that covers the hair says `hides: ["hair", "hairwear"]` (a band or clip would show in
// the face opening; add `"ears"` when it covers them: the kit tests check the first two go
// together); a hat or cap that only cuts the hair says `clips: { slots: ["hair", "hairwear"], keep:
// crownClip(band) }` (or `bandClip`), and when a covering clips too the hair is cut to both. A hat
// over a covering (`ctx.avatar.wear?.head`) is lifted and widened; a hat that sits on the hair reads
// its bulk (`hairBulk(ctx)`, cm), never a style's id. Hearing devices are never hidden (their own
// slot, drawn over coverings). Pieces go on layer
// `headwear`, bone `head`; a long drape that reaches the chest is split: the head piece here, the
// hanging piece on layer `chest_over`, bone `spine`. Glasses stay visible in every opening.
//
// How a scarf is cut. Its head piece frames the face and falls over the shoulders on both sides
// (layer `headwear`, so it lies over the tops of the arms); the cloth under the chin and the drape
// down the chest are a second piece on `chest_over` and the spine, so a hand on the heart, a held
// phone and a long beard lie over it. The face opening follows the face shape (`Opening`): a few cm
// inside the outline at the cheeks, opening out round the jaw, where the chest piece shows behind
// the chin. From behind, the head piece covers the head and ends at the shoulders, and the drape
// hangs between the shoulder blades, inside the arms (the back view draws the arms over it). The
// wearer's left is +x in both views, so a pin, a knot or a thrown end keeps its side when the
// puppet turns. A hat sits on what is under it (`under`): the covering's crown when one is worn
// (`COVERS`, kept beside the coverings' own measures), else the hair's bulk.

import { smooth, ellipse, band, tone, mix, type BodyDims, type Group, type Item, type PartCtx, type PartDef, type Path, type Shape, type Vec2 } from "sahne";
import { named, S, line, flat, headOf, headHalfWidth, hairBulk, HAIR_BULK, crownClip, printed, patternsFor, sidesOf, type Head, type Pt } from "./draw/index.ts";

const PI = Math.PI;
/** The prints a covering may wear (the kit's prints allowed on the `head` slot). */
const HEAD_PRINTS = patternsFor("head");

// ---- measures -----------------------------------------------------------------------------------------

/** Smooth step from 0 to 1. */
const s01 = (t: number) => { const u = Math.min(1, Math.max(0, t)); return u * u * (3 - 2 * u); };
/** A point mirrored to the other side (corners stay corners). */
const mx = (p: Pt): Pt => (p.length === 3 ? [-p[0], p[1], 0] : [-p[0], p[1]]);
/** An outline from its right half, listed from the top middle down to the bottom middle: the right side, then the left back up. */
const both = (right: Pt[]): Pt[] => [...right, ...[...right].reverse().filter(p => Math.abs(p[0]) > 1e-6).map(mx)];
/** Points moved by (dx, dy). */
const moved = (pts: Pt[], dx: number, dy: number): Pt[] => pts.map(p => (p.length === 3 ? [p[0] + dx, p[1] + dy, 0] : [p[0] + dx, p[1] + dy]));

/** What a head part is fitted to: the head, the hair's bulk and the shoulders, all in cm for this body. */
interface Fit {
  h: Head; b: BodyDims; W: number; H: number; k: number;
  /** The hair's bulk over the crown (cm, this build). */
  bulk: number;
  /** The chin's height above the shoulder line (head-space y = N is the shoulder line), and the torso's length. */
  N: number; T: number;
  /** Half the shoulders' width. */
  sw: number;
  /** How far out the ears reach from the centre line, on the side that reaches further. */
  ears: number;
  /** The x of a sleeve's inner edge at the shoulder: a drape between the arms stays about here. */
  inner: number;
  kid: boolean;
}

function fit(ctx: PartCtx): Fit {
  const h = headOf(ctx), b = ctx.body, a = b.armW[0];
  let ears = 0;
  for (const s of [1, -1] as const) { const e = h.ear(s); ears = Math.max(ears, Math.abs(e.c[0]) + Math.hypot(e.rx * Math.cos(e.rot), e.ry * Math.sin(e.rot))); }
  return {
    h, b, W: h.W, H: h.H, k: h.k, bulk: hairBulk(ctx), N: b.neckL, T: b.torsoL, sw: b.shoulderW / 2, ears,
    inner: Math.max(b.neckW / 2 + 1, b.shoulderW / 2 - a * 1.09 - 0.8), kid: b.build === "child" || b.build === "toddler",
  };
}

/** Head-space points on the spine bone (the chin is neckL above the shoulder line, which is torsoL above the hip pivot). */
const onSpine = (f: Fit, pts: Pt[]): Pt[] => moved(pts, 0, -f.N - f.T);

/** How far a covering stands off the head at the crown: `base` cm (adult), plus part of the hair's bulk past a crop's. */
const overHair = (f: Fit, base: number, share = 0.45) => base * f.k + Math.max(0, f.bulk - HAIR_BULK.low * f.k) * share;

/** How far out a covering reaches at the ears: past them by `pad` cm, and at least the crown's own width. */
const earX = (f: Fit, g: number, pad = 1) => Math.max(f.W / 2 + g, f.ears + pad * f.k);

/** The y of the crown's edge grown by `v` at x (on the crown ellipse; the top of the head when x is 0). */
const crownY = (f: Fit, v: number, x: number) => { const rx = f.W / 2 + v, ry = f.H * 0.42 + v; return -f.H * 0.6 - ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2)); };

/** The crown grown by `v` from the top middle down the right side to height y (head space), as points. */
function crownTo(f: Fit, v: number, y: number, n = 8): Vec2[] {
  const s = Math.max(-1, Math.min(1, (y + f.H * 0.6) / (f.H * 0.42 + v)));
  return f.h.crown(v, PI * 1.5, PI * 2 + Math.asin(s), n);
}

// ---- the face opening ----------------------------------------------------------------------------------

/**
 * A face opening that follows the face shape: its edge crosses the forehead at `top` (a fraction of
 * H above the chin) in an arch `arch` H deep, runs `side` cm inside the head's outline at the cheeks
 * and opens out to `chin` cm outside it round the jaw.
 */
interface Opening { top: number; arch: number; side: number; chin: number }

function openingX(h: Head, f: number, o: Opening): number {
  const hw = headHalfWidth(h.shape, h.W, h.H, -f * h.H), t = s01((f - 0.1) / 0.32);
  let x = hw - o.side * t + o.chin * (1 - t);
  const f0 = o.top - o.arch;
  if (f > f0) x *= Math.pow(Math.max(0, 1 - ((f - f0) / o.arch) ** 2), 0.42);
  return Math.max(0, x);
}

/** The right edge of an opening from the forehead's middle down to height `low` (a fraction of H above the chin). */
function openingRight(h: Head, o: Opening, low: number): Vec2[] {
  const fs = [0.08, 0.36, 0.72].map(u => o.top - o.arch * u);
  for (let f = o.top - o.arch - 0.04; f > low + 0.04; f -= 0.12) fs.push(f);
  fs.push(low);
  return [[0, -o.top * h.H], ...fs.map((f): Vec2 => [openingX(h, f, o), -f * h.H])];
}

/** The whole opening, closed under the chin. */
const openingPts = (h: Head, o: Opening): Pt[] => both([...openingRight(h, o, 0.05), [h.W * 0.16, o.chin * 0.8], [0, o.chin]]);

/** The edge of an opening from the left end at `low` over the forehead to the right end. */
const openingArc = (h: Head, o: Opening, low: number): Vec2[] => { const r = openingRight(h, o, low); return [...r.slice(1).reverse().map(([x, y]): Vec2 => [-x, y]), ...r]; };

/** A strip along an opening's edge from `low` over the forehead and down to `low`, from `out` cm outside the edge to `inn` cm inside it (an underscarf, a folded hem, a border). */
function edgeStrip(h: Head, o: Opening, low: number, out: number, inn: number): Pt[] {
  const arc = openingArc(h, o, low), n = arc.length, nrm = (i: number): Vec2 => {
    const a = arc[Math.max(0, i - 1)], b = arc[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return [dy / l, -dx / l]; // the arc runs left to right over the top, so this points away from the face
  };
  const outer = arc.map((p, i): Pt => [p[0] + nrm(i)[0] * out, p[1] + nrm(i)[1] * out]), inner = arc.map((p, i): Pt => [p[0] - nrm(i)[0] * inn, p[1] - nrm(i)[1] * inn]);
  return [...outer, ...inner.reverse()];
}

/** A flat shade just inside an opening along its top and left (light from the upper left): the cloth's shadow on the face. */
function rimShade(pts: Pt[], skin: string, k: number, opacity = 0.26): Shape {
  const path = smooth(pts, true, 1);
  return { path: smooth(pts, true, 1).add(smooth(moved(pts, 0.45 * k, 0.9 * k), true, 1)), fill: tone(skin, "deep"), evenodd: true, flat: true, opacity, clip: path };
}

/** Several like shapes (all one fill and opacity: dots, ribs, seams) as one, so a portrait carries one path instead of many. */
const merged = (shapes: Shape[]): Shape[] => (shapes.length ? [{ ...shapes[0], path: shapes.slice(1).reduce((p, x) => p.add(x.path), shapes[0].path) }] : []);

// ---- pieces ------------------------------------------------------------------------------------------------

const onHeadwear = (group: Group): Item => ({ layer: "headwear", bone: "head", group });
const onChest = (group: Group): Item => ({ layer: "chest_over", bone: "spine", group });
const onHair = (group: Group): Item => ({ layer: "hair_front", bone: "head", group });
/** A piece lying over the top of a shoulder, on the spine: over the sleeve in both views, under the head in front. */
const onShoulder = (group: Group): Item => ({ layer: "over_sleeve", bone: "spine", group });

/** The ground of a cloth piece and its print (`hem`: the garment's bottom edge in the piece's space). */
function cloth(ctx: PartCtx, pts: Pt[], c: string, hem: number, o: Partial<Shape> = {}): Shape[] {
  const path = smooth(pts, true, 1);
  return [{ path, fill: c, ...o }, ...printed(ctx, path, { hem })];
}

/** The shade on the side away from the light: the piece's outline, cut to its right `share`, flat (or, given the outline's own path, a box cut to it, so a path already written as a clip is not written again). */
const rightShade = (pts: Pt[], c: string, x0: number, opacity = 0.32, within?: Path): Shape => {
  const path = within ?? smooth(pts, true, 1), [, y0, x1, y1] = path.bounds();
  const cut = smooth([[x0, y0 - 1, 0], [x1 + 1, y0 - 1, 0], [x1 + 1, y1 + 1, 0], [x0 + (x1 - x0) * 0.35, y1 + 1, 0], [x0 - (x1 - x0) * 0.1, (y0 + y1) / 2]], true, 1);
  return within ? { path: cut, fill: tone(c, "shade"), flat: true, opacity, clip: within } : { path, fill: tone(c, "shade"), flat: true, opacity, clip: cut };
};

/** A covering's crown standoff (`g`) and its half-width at the ears (`ex`), by id: what a hat worn over it sits on. */
interface Cover { g: number; ex: number }
const COVERS: Record<string, (f: Fit) => Cover> = {
  headscarf_wrap: f => { const g = overHair(f, 3.2); return { g, ex: earX(f, g, 1.2) }; },
  headscarf_pinned: f => ({ g: overHair(f, 2), ex: earX(f, overHair(f, 2.6), 1) }),
  headscarf_back_tie: f => { const g = overHair(f, 1.8); return { g, ex: earX(f, g, 0.9) }; },
  headscarf_esarp: f => { const g = overHair(f, 2.2); return { g, ex: earX(f, g, 1) }; },
  headscarf_sport: f => { const g = overHair(f, 1.0, 0.3); return { g, ex: earX(f, g, 0.7) }; },
  turban_dastar: f => ({ g: (f.kid ? 0.2 : 0.26) * f.H, ex: f.W * 0.6 }),
  cap_kippah: f => ({ g: f.bulk + 0.6 * f.k, ex: f.W / 2 + f.bulk }),
  cap_taqiyah: f => { const g = f.bulk * 0.9 + 0.8 * f.k; return { g, ex: f.W / 2 + g }; },
};

/** What a hat sits on: the covering worn under it (its crown, its width at the ears), else the hair. */
function under(ctx: PartCtx, f: Fit): Cover & { cover: boolean } {
  const id = ctx.avatar.wear?.head?.id;
  if (typeof id === "string" && id) {
    const c = Object.hasOwn(COVERS, id) ? COVERS[id](f) : { g: 3.4 * f.k, ex: f.W / 2 + 3.6 * f.k };
    return { g: Math.max(c.g, f.bulk * 0.6), ex: Math.max(c.ex, f.W / 2 + f.bulk * 0.6), cover: true };
  }
  return { g: f.bulk, ex: f.W / 2 + f.bulk * 0.85, cover: false };
}

// ---- headscarves -----------------------------------------------------------------------------------------

/**
 * A scarf's head piece in front: the crown grown by `g` from the top down the right side through
 * `side` (the ear, the shoulder, the hem's corner, the fold) to the jaw end of the face opening at
 * `jaw`, up round the face and down the left side, mirrored. Its middle below the chin stays open
 * for the chest piece.
 */
function scarfFront(f: Fit, o: Opening, g: number, side: Pt[], jaw: number): Pt[] {
  const right: Pt[] = [...crownTo(f, g, -f.H * 0.62, 7), ...side, ...[...openingRight(f.h, o, jaw)].reverse()];
  return [...right, ...right.map(mx).reverse().slice(1, -1)];
}

/** The headscarves' shared metadata: they hide the hair, its clips and the ears; offered to every build but the toddler's. */
const SCARF = { hides: ["hair", "hairwear", "ears"], builds: ["adult", "elder", "child"] as BodyDims["build"][] };

// ---- hats --------------------------------------------------------------------------------------------------

/** The light on a dome's upper left: a flat arc just inside its edge. */
const domeSheen = (f: Fit, c: string, v: number, a0 = 1.2, a1 = 1.46, w = 1.6): Shape => line(f.h.arc(v, PI * a0, PI * a1, 6), tone(c, "light"), w * f.k, 0.5);

/** The kit's tags for hats: the randomiser never puts one on a turban. */
const HAT = { tags: ["hat"], avoid: ["turban"] };

/** The scrub cap's prints: the catalogue's list, as far as the kit has them and allows them on a hat. */
const SCRUB_PRINTS = ["pat_stripe_h", "pat_stripe_v", "pat_dots", "pat_check", "pat_gingham", "pat_floral", "pat_tartan", "pat_dots_small", "pat_stripe_wide", "pat_houndstooth", "pat_paisley", "pat_iznik_tulip", "pat_ebru", "pat_herringbone", "pat_ditsy", "pat_stripe_diag", "pat_ikat", "pat_stars", "pat_argyle", "pat_geometric", "pat_wax_print", "pat_batik"].filter(id => patternsFor("hat").includes(id));
/** The scrub cap's edge (fractions of H above the chin): at the hairline in front, above the ears, at the tie behind. The drawn edge and the hair's clip share it. */
const SCRUB_BAND = { centre: 0.74, side: 0.56, back: 0.45 };

// ---- hairwear ----------------------------------------------------------------------------------------------

/** A soft flat shadow of a piece on the hair under it (the piece's outline moved down and right). */
const castOnHair = (pts: Pt[], hair: string, k: number): Shape => flat(smooth(moved(pts, 0.35 * k, 0.75 * k), true, 1), tone(hair, "deep"), 0.45);

/** Points of a rounded bar from a to b, `w` thick. */
function bar(a: Vec2, b: Vec2, w: number): Pt[] {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2, ex = dx / l * w * 0.35, ey = dy / l * w * 0.35;
  return [[a[0] + nx, a[1] + ny], [a[0] - ex, a[1] - ey], [a[0] - nx, a[1] - ny], [b[0] - nx, b[1] - ny], [b[0] + ex, b[1] + ey], [b[0] + nx, b[1] + ny]];
}

/** An ellipse as outline points, turned by `rot` radians. */
function oval(cx: number, cy: number, rx: number, ry: number, rot = 0, n = 10): Pt[] {
  const c = Math.cos(rot), s = Math.sin(rot), out: Pt[] = [];
  for (let i = 0; i < n; i++) { const a = (i / n) * PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push([cx + x * c - y * s, cy + x * s + y * c]); }
  return out;
}

/** A small bow: two loops, a knot and two notched tails, centred at (x, y), `s` cm per adult cm, loops in `c`, knot and tails in `c2`. */
function bow(x: number, y: number, s: number, c: string, c2: string, back = false): Shape[] {
  const loop = (side: 1 | -1) => oval(x + side * 3.6 * s, y - 0.5 * s, 3.9 * s, 2.2 * s, -side * 0.42);
  const tail = (side: 1 | -1, len: number): Pt[] => [[x + side * 0.5 * s, y + 0.6 * s], [x + side * 2.2 * s, y + len * s], [x + side * 1.5 * s, y + (len - 0.9) * s], [x + side * 0.9 * s, y + (len + 0.2) * s], [x - side * 0.6 * s, y + 1 * s]];
  return [
    S(tail(-1, 4.6), tone(c2, "shade")), S(tail(1, 4.2), c2),
    S(loop(-1), c), S(loop(1), c),
    ...(back ? [] : [line([[x - 1.2 * s, y - 0.2 * s], [x - 3.4 * s, y - 0.9 * s]], tone(c, "deep"), 0.5 * s, 0.45), line([[x + 1.2 * s, y - 0.2 * s], [x + 3.4 * s, y - 0.9 * s]], tone(c, "deep"), 0.5 * s, 0.45)]),
    { path: ellipse(x, y - 0.3 * s, 1.35 * s, 1.5 * s), fill: c2 },
    line([[x - 5.4 * s, y - 1.6 * s], [x - 3.6 * s, y - 2.5 * s]], tone(c, "light"), 0.55 * s, 0.6),
  ];
}

export const HEADWEAR: Record<string, PartDef> = {
  // ---- coverings (wear.head) ----

  // The everyday wrap: a soft frame for the face with an underscarf band at the forehead, the end
  // wrapped round and pinned at the wearer's left jaw, falling over the shoulders and in a rounded
  // bib down the chest (to the chest only on children). Its id and two colours are the first kit's.
  headscarf_wrap: named("head", "Headscarf", "başörtüsü", { colors: 2, defaults: ["fab_06"], patterns: HEAD_PRINTS, tags: ["modest", "everyday", "traditional", "istanbul"], ...SCARF, over: ["top", "neck"], draw: ctx => {
    const f = fit(ctx), { h, W, H, k, N } = f, c = ctx.colors[0] ?? "#2F8C88", trim = ctx.colors[1] ?? tone(c, "light"), sh = tone(c, "shade");
    const { g, ex } = COVERS.headscarf_wrap(f), o: Opening = { top: 0.75, arch: 0.26, side: 2.8 * k, chin: 0.9 * k };
    const hem = Math.min(H * 0.42 + 1.5 * k, N + 0.45 * f.T), bib = Math.max(f.inner + 1.4 * k, f.b.neckW / 2 + 2 * k);
    const cx = Math.max(ex + 1.4 * k, f.sw + 3 * k), fx = bib + 0.8 * k, jaw = 0.12, jx = openingX(h, jaw, o);
    const side: Pt[] = [[ex, -H * 0.4], [ex + (cx - ex) * 0.4, -H * 0.06], [cx, N + 1.5 * k], [cx - 1.2 * k, N + 4 * k, 0], [(cx + fx) / 2, N + 4.6 * k], [fx, N + 6.5 * k, 0]];
    const front = scarfFront(f, o, g, side, jaw);
    const head: Shape[] = [
      { ...S(edgeStrip(h, o, 0.5, 2.4 * k, 1.3 * k), trim), flat: true },
      ...cloth(ctx, front, c, hem),
      rightShade(front, c, W * 0.42),
      // a fold down each side, the wrapped end's edge and its pin
      ...merged([line([[-W * 0.5, -H * 0.34], [-W * 0.49, -H * 0.04], [-(cx - 3 * k), N + 2.5 * k]], sh, 0.8, 0.5), line([[W * 0.49, -H * 0.3], [W * 0.5, -H * 0.02], [cx - 3.2 * k, N + 2.6 * k]], sh, 0.8, 0.5)]),
      { path: ellipse(W * 0.4, -H * 0.06, 0.95 * k, 0.95 * k), fill: mix(trim, "#FFFFFF", 0.45) },
      rimShade(openingPts(h, o), ctx.skin, k),
    ];
    // the drape below the chin: behind the jaw, under the flaps, a rounded bib down the chest
    const drape: Pt[] = both([[0, -H * 0.34], [W * 0.46, -H * 0.32], [jx + 1.5 * k, -H * 0.1], [fx + 4 * k, N + 3 * k], [fx + 0.3 * k, N + 6.8 * k], [bib + 0.6 * k, hem - 5 * k], [bib * 0.6, hem - 0.6 * k], [0, hem + 1.2 * k]]);
    const chest: Shape[] = [...cloth(ctx, onSpine(f, drape), mix(c, sh, 0.2), hem - N - f.T),
      line(onSpine(f, [[W * 0.22, H * 0.05], [-bib * 0.15, N + 5 * k], [-bib * 0.55, hem - 2.5 * k]]) as Vec2[], sh, 0.8, 0.45)];
    // behind: the head piece down to the shoulders, the drape between the shoulder blades
    const nw = Math.min(W * 0.36, bib + 1.2 * k), bhem = hem + 2 * k;
    const back = both([...crownTo(f, g, -H * 0.62, 5), [ex, -H * 0.4], [ex + 0.3 * k, -H * 0.1], [cx - 0.6 * k, N - 1 * k, 0], [(cx + nw) / 2, N - 0.2 * k], [nw, N + 1.6 * k, 0], [0, N + 2.4 * k]]);
    const backDrape: Pt[] = both([[0, -H * 0.1], [nw + 1.5 * k, -H * 0.05], [nw + 0.4 * k, N + 3 * k], [nw + 0.2 * k, bhem - 3 * k], [nw * 0.5, bhem - 0.4 * k], [0, bhem]]);
    return {
      front: [onChest({ shapes: chest }), onHeadwear({ shapes: head })],
      back: [
        onChest({ shapes: [...cloth(ctx, onSpine(f, backDrape), c, bhem - N - f.T), line(onSpine(f, [[0, N], [-nw * 0.1, bhem - 2 * k]]) as Vec2[], sh, 0.8, 0.4)] }),
        onHeadwear({ shapes: [...cloth(ctx, back, c, bhem), rightShade(back, c, W * 0.3, 0.25), line([[0, -H * 0.99], [-W * 0.06, -H * 0.5], [0, N]], sh, 0.8, 0.45)] }),
      ],
    };
  } }),

  // Dilnoza's scarf: snug over the head, a crisp folded edge round a wide opening, the ends crossed
  // under the chin and pinned at the wearer's left, covering the neck to a rounded V on the collarbone.
  headscarf_pinned: named("head", "Headscarf pinned under the chin", "iğneli başörtüsü", { colors: 2, palettes: ["fabric", "metal"], defaults: ["fab_05", "met_silver"], patterns: HEAD_PRINTS, tags: ["modest", "everyday", "work", "school", "istanbul"], ...SCARF, over: ["top", "neck"], draw: ctx => {
    const f = fit(ctx), { h, W, H, k, N } = f, c = ctx.colors[0] ?? "#8DB8DA", pin = ctx.colors[1] ?? "#C3C8CE", sh = tone(c, "shade");
    const { g, ex } = COVERS.headscarf_pinned(f), o: Opening = { top: 0.74, arch: 0.24, side: 0.6 * k, chin: 0.8 * k };
    const hw = Math.min(f.sw - 3 * k, W * 0.62), drop = Math.min(H * 0.3, N + 0.3 * f.T), sideY = Math.min(H * 0.16, drop - 2 * k), jaw = 0.12, jx = openingX(h, jaw, o);
    const side: Pt[] = [[ex, -H * 0.4], [ex - 0.5 * k, -H * 0.16], [Math.max(hw + 1.2 * k, jx + 1.5 * k), H * 0.05], [hw, sideY, 0], [hw - 2.6 * k, sideY - 0.4 * k, 0]];
    const front = scarfFront(f, o, g, side, jaw);
    const pinAt: Vec2 = [W * 0.2, H * 0.1];
    const head: Shape[] = [
      ...cloth(ctx, front, c, drop),
      rightShade(front, c, W * 0.4),
      // the folded edge round the face
      { ...S(edgeStrip(h, o, 0.1, 0.2 * k, 1.1 * k), mix(c, tone(c, "light"), 0.55)), flat: true },
      ...merged([line([[W * 0.5, -H * 0.3], [W * 0.47, -H * 0.02], [hw - 1.2 * k, sideY - 1 * k]], sh, 0.7, 0.45), line([[-W * 0.5, -H * 0.3], [-W * 0.47, -H * 0.02], [-(hw - 1.2 * k), sideY - 1 * k]], sh, 0.7, 0.45)]),
      rimShade(openingPts(h, o), ctx.skin, k, 0.22),
    ];
    // under the chin: the cloth to the rounded V, the end crossing over from the wearer's right to the pin, three folds from it
    const under: Pt[] = both([[0, -H * 0.34], [W * 0.46, -H * 0.32], [jx + 1.5 * k, -H * 0.08], [hw + 0.6 * k, sideY - 1.5 * k], [hw, sideY + 0.3 * k], [hw * 0.55, (sideY + drop) / 2 + 1.2 * k], [0, drop]]);
    const end: Pt[] = [[-jx - 1 * k, -H * 0.06], [-W * 0.18, H * 0.1], [-W * 0.02, H * 0.2], [pinAt[0] + 1.5 * k, pinAt[1] + 1.8 * k], [pinAt[0] + 2 * k, pinAt[1] - 1.2 * k], [W * 0.05, H * 0.035], [-W * 0.2, -H * 0.03]];
    const chest: Shape[] = [
      // the cloth under the chin (in the flaps' shadow), and the crossing end over it: told apart by tone, not by a paper edge
      ...cloth(ctx, onSpine(f, under), mix(c, sh, 0.25), drop - N - f.T),
      { ...S(onSpine(f, end), mix(c, tone(c, "light"), 0.18)), flat: true },
      ...merged([[-W * 0.02, drop - 1.5 * k], [hw * 0.8, sideY + 2 * k]].map(([x, y]) => line(onSpine(f, [[pinAt[0] + 0.5 * k, pinAt[1] + 1 * k], [(pinAt[0] + x) / 2, (pinAt[1] + y) / 2 + 0.6 * k], [x, y]]) as Vec2[], sh, 0.7, 0.45))),
      { path: ellipse(pinAt[0], pinAt[1] - N - f.T, 0.95 * k, 0.95 * k), fill: pin },
      flat(ellipse(pinAt[0] - 0.3 * k, pinAt[1] - N - f.T - 0.3 * k, 0.35 * k, 0.35 * k), mix(pin, "#FFFFFF", 0.6), 0.9),
    ];
    // behind: snug from the crown to a straight hem at the collar, one seam
    const bw = Math.min(hw, f.inner + 3.5 * k), bhem = Math.min(H * 0.2, N + 0.25 * f.T);
    const back = both([...crownTo(f, g, -H * 0.62, 5), [ex, -H * 0.4], [ex - 0.6 * k, -H * 0.14], [bw + 1.4 * k, bhem - 3 * k], [bw, bhem, 0], [0, bhem + 0.3 * k]]);
    return {
      front: [onChest({ shapes: chest }), onHeadwear({ shapes: head })],
      back: [onHeadwear({ shapes: [...cloth(ctx, back, c, bhem), rightShade(back, c, W * 0.3, 0.25), line([[0, -H * 0.99], [W * 0.02, -H * 0.4], [0, bhem - 0.5 * k]], sh, 0.7, 0.45)] })],
    };
  } }),

  // Hatice Abla's yazma: a printed cotton scarf folded to a triangle, round the face and over the
  // ears, the neck left bare, knotted at the nape with two short tails, an oya lace edge round the face.
  headscarf_back_tie: named("head", "Headscarf tied at the back", "arkadan bağlı yazma", { colors: 2, defaults: ["fab_14", "fab_02"], patterns: HEAD_PRINTS, tags: ["traditional", "modest", "work", "summer"], ...SCARF, over: ["top"], draw: ctx => {
    const f = fit(ctx), { h, W, H, k } = f, c = ctx.colors[0] ?? "#D9534A", lace = ctx.colors[1] ?? "#F0E2C8", sh = tone(c, "shade");
    const { g, ex } = COVERS.headscarf_back_tie(f), o: Opening = { top: 0.73, arch: 0.27, side: 0.15 * k, chin: 0.5 * k };
    const low = 0.2, jx = openingX(h, low, o);
    const side: Pt[] = [[ex, -H * 0.4], [ex - 0.2 * k, -H * 0.27], [ex - 1.2 * k, -H * low, 0], [jx + 0.3 * k, -H * (low - 0.005), 0]];
    const front = scarfFront(f, o, g, side, low);
    // the oya: little flowers of thread along the edge, from ear to ear
    // (one dotted stroke: a round dot every 1.7 cm along the edge)
    const oya: Shape[] = [{ path: smooth(moved(openingArc(h, o, low + 0.03), 0, 0.15 * k), false, 1), stroke: { color: lace, width: 1.24 * k, cap: "round", dash: [0.01, 1.7 * k] }, flat: true }];
    const head: Shape[] = [
      ...cloth(ctx, front, c, -H * low),
      rightShade(front, c, W * 0.38),
      line([[W * 0.3, -H * 0.88], [W * 0.46, -H * 0.66], [W * 0.5, -H * 0.5]], sh, 0.7, 0.45),
      line([[-W * 0.32, -H * 0.88], [-W * 0.47, -H * 0.66], [-W * 0.51, -H * 0.5]], sh, 0.7, 0.45),
      line(openingArc(h, o, low), lace, 0.5 * k, 0.9),
      ...oya,
      rimShade(openingPts(h, o), ctx.skin, k, 0.2),
    ];
    // behind: the cloth to the nape, its corners knotted there, two tails over the collar
    const tail = Math.min(f.kid ? H * 0.16 : H * 0.24, 0.3 * f.T + H * 0.1), ky = -H * 0.12;
    const back = both([...crownTo(f, g, -H * 0.62, 5), [ex, -H * 0.4], [ex - 0.6 * k, -H * 0.24], [W * 0.24, -H * 0.1], [3 * k, ky - 1 * k], [0, ky]]);
    const tails: Shape[] = [
      S([[-1 * k, ky], [-3.6 * k, ky + tail * 0.55], [-3.2 * k, ky + tail, 0], [-1.6 * k, ky + tail - 1.4 * k], [-0.2 * k, ky + tail * 0.9, 0], [0.8 * k, ky + 1 * k]], tone(c, "shade")),
      ...cloth(ctx, [[0.6 * k, ky], [3.8 * k, ky + tail * 0.5], [4.4 * k, ky + tail * 0.86, 0], [2.6 * k, ky + tail * 0.8], [1.2 * k, ky + tail * 0.92, 0], [-0.8 * k, ky + 1.2 * k]], c, ky + tail),
    ];
    const knot: Shape[] = [S(oval(-2.2 * k, ky - 0.2 * k, 2.3 * k, 1.6 * k, 0.3), c), S(oval(2.3 * k, ky - 0.3 * k, 2.3 * k, 1.6 * k, -0.3), c), { path: ellipse(0, ky, 1.5 * k, 1.4 * k), fill: tone(c, "shade") }];
    return {
      front: [onHeadwear({ shapes: head })],
      back: [onHeadwear({ shapes: [...tails, ...cloth(ctx, back, c, ky), rightShade(back, c, W * 0.28, 0.25), line([[-W * 0.36, -H * 0.5], [-W * 0.12, -H * 0.22], [-1.5 * k, ky - 1.5 * k]], sh, 0.7, 0.45), line([[W * 0.36, -H * 0.5], [W * 0.12, -H * 0.22], [1.5 * k, ky - 1.5 * k]], sh, 0.7, 0.45), ...knot] })],
    };
  } }),

  // The Istanbul eşarp: a light printed square folded to a triangle, smooth over the head and ears,
  // knotted loosely under the chin at the wearer's left; the long end thrown back over that shoulder
  // (from the front it crosses the shoulder by the neck, from behind it hangs over the shoulder
  // blade), the short end falling to the collarbone; a contrast border on its edges. One print per
  // bone: the head piece and the short end share one, the thrown end and the cloth under the chin another.
  headscarf_esarp: named("head", "Printed scarf, one end over the shoulder", "eşarp", { colors: 2, defaults: ["fab_17", "fab_16"], patterns: HEAD_PRINTS, tags: ["fashion", "modest", "work", "istanbul"], ...SCARF, over: ["top", "neck"], draw: ctx => {
    const f = fit(ctx), { h, W, H, k, N } = f, c = ctx.colors[0] ?? "#B9A6DC", rim = ctx.colors[1] ?? "#7A3E6E", sh = tone(c, "shade");
    const { g, ex } = COVERS.headscarf_esarp(f), o: Opening = { top: 0.75, arch: 0.25, side: 0.9 * k, chin: 0.8 * k };
    const knot: Vec2 = [W * 0.22, H * 0.1], jaw = 0.1, jx = openingX(h, jaw, o), end = Math.min(H * 0.34, N + (f.kid ? 0.3 : 0.42) * f.T);
    // the head piece: round the head, down both sides and under the chin to the knot (an opening, wound the other way)
    const dome = crownTo(f, g, -H * 0.62, 5);
    const outer: Pt[] = [...dome.map(mx).reverse(), ...dome.slice(1), [ex, -H * 0.4], [ex - 0.6 * k, -H * 0.12], [knot[0] + 3.5 * k, knot[1] - 1.5 * k], [knot[0] + 1 * k, knot[1] + 1.4 * k], [-W * 0.1, H * 0.11], [-W * 0.36, H * 0.02], [-ex + 0.6 * k, -H * 0.12], [-ex, -H * 0.4]];
    const hole = openingPts(h, o), ground = smooth(outer, true, 1).add(smooth([...hole].reverse(), true, 1));
    const short: Pt[] = [[knot[0] + 1.6 * k, knot[1] + 1.2 * k], [knot[0] + 2.2 * k, end - 2 * k, 0], [knot[0] - 3 * k, end, 0], [knot[0] - 3.4 * k, end - 4 * k], [knot[0] - 1.6 * k, knot[1] + 0.4 * k]];
    const shortPath = smooth(short, true, 1);
    const head: Shape[] = [
      { path: ground, fill: c, evenodd: true },
      rightShade(outer, c, W * 0.42, 0.28),
      { path: shortPath, fill: c },
      ...printed(ctx, smooth(outer, true, 1).add(smooth([...hole].reverse(), true, 1)).add(smooth(short, true, 1)), { hem: end }),
      // the border along the face edge and the short end's hem
      { ...S(edgeStrip(h, o, 0.12, 1.2 * k, 0), rim), flat: true, opacity: 0.95 },
      line([[knot[0] - 2.8 * k, end - 0.7 * k], [knot[0] + 1.9 * k, end - 2.5 * k]], rim, 1 * k, 0.95),
      line([[-W * 0.5, -H * 0.32], [-W * 0.46, -H * 0.02], [-W * 0.1, H * 0.09]], sh, 0.7, 0.45),
      // the knot: two folded lobes and the wound middle
      S(oval(knot[0] - 1.7 * k, knot[1] + 0.2 * k, 2.2 * k, 1.6 * k, 0.5), tone(c, "shade")), S(oval(knot[0] + 1.7 * k, knot[1] - 0.4 * k, 2.2 * k, 1.6 * k, -0.4), c),
      { path: ellipse(knot[0], knot[1], 1.5 * k, 1.4 * k), fill: c }, line([[knot[0] - 0.8 * k, knot[1] - 0.5 * k], [knot[0] + 0.9 * k, knot[1] + 0.4 * k]], sh, 0.6, 0.6),
      rimShade(hole, ctx.skin, k, 0.22),
    ];
    // where the thrown end crosses the shoulder: just past the knot, 0.21 W wide (short of the shoulder's tip); it lies over the sleeve's top (layer `over_sleeve`, under the head in front, over the arm behind)
    const xa = Math.max(f.b.neckW / 2 + 0.4 * k, knot[0] + 1.5 * k), xb = Math.max(xa + 3 * k, Math.min(xa + W * 0.21, f.sw - 1 * k)), top = N - 1.2 * k;
    // front: from behind the knot out and up over the shoulder (its top just above the shoulder's line), the border on its lower edge; the cloth behind the chin
    const thrown: Pt[] = [[knot[0] - 0.6 * k, knot[1] - 1.6 * k], [xa, top - 0.8 * k], [(xa + xb) / 2, top - 1.4 * k], [xb - 0.4 * k, top - 0.6 * k], [xb + 0.6 * k, N + 1.2 * k], [(knot[0] + xb) / 2 + 1.5 * k, N + 6 * k], [knot[0] + 1.4 * k, knot[1] + 3 * k]];
    const chin: Pt[] = both([[0, -H * 0.3], [W * 0.42, -H * 0.28], [jx + 1.5 * k, -H * 0.04], [W * 0.3, H * 0.1], [0, H * 0.12]]);
    const sp = (pts: Pt[]) => onSpine(f, pts), hemS = end - N - f.T;
    const chest: Shape[] = cloth(ctx, sp(chin), mix(c, sh, 0.3), hemS);
    const thrownPath = smooth(sp(thrown), true, 1);
    const over: Shape[] = [
      { path: thrownPath, fill: c }, ...printed(ctx, thrownPath, { hem: hemS }), rightShade(sp(thrown), c, (xa + xb) / 2 + 2 * k, 0.25, thrownPath),
      // the part going back over the shoulder, turned from the light
      { path: smooth(sp([[xa - 1 * k, top - 3 * k, 0], [xb + 2 * k, top - 3 * k, 0], [xb + 2 * k, N + 0.6 * k, 0], [(xa + xb) / 2, N + 1.4 * k], [xa - 1 * k, N + 0.4 * k, 0]]), true, 1), fill: sh, flat: true, opacity: 0.35, clip: thrownPath },
      line(sp([[knot[0] + 1.8 * k, knot[1] + 2.9 * k], [(knot[0] + xb) / 2 + 1.4 * k, N + 5.6 * k], [xb + 0.4 * k, N + 1.4 * k]]) as Vec2[], rim, 1 * k, 0.95, { clip: thrownPath }),
    ];
    // behind: the dome to the nape, the loose knot at the left of the nape, the thrown end hanging over the left shoulder blade with its border at the cut
    const back = both([...crownTo(f, g, -H * 0.62, 5), [ex, -H * 0.4], [ex - 0.5 * k, -H * 0.1], [W * 0.3, H * 0.07], [0, H * 0.1]]);
    const blade = N + (f.kid ? 0.3 : 0.45) * f.T, drift = 1.4 * k;
    const hang: Pt[] = [[xa, top + 0.8 * k], [(xa + xb) / 2, top + 0.1 * k], [xb, top + 0.7 * k], [xb + drift + 0.4 * k, blade - 1.2 * k, 0], [xa + drift + 0.6 * k, blade, 0], [xa - 0.2 * k, N + 2 * k]];
    const bk: Vec2 = [W * 0.3, H * 0.06];
    return {
      front: [onChest({ shapes: chest }), onShoulder({ shapes: over }), onHeadwear({ shapes: head })],
      back: [
        onShoulder({ shapes: [...cloth(ctx, sp(hang), c, blade - N - f.T), rightShade(sp(hang), c, (xa + xb) / 2 + 0.5 * k, 0.25), line(sp([[xa + drift + 0.8 * k, blade - 0.6 * k], [xb + drift + 0.2 * k, blade - 1.7 * k]]) as Vec2[], rim, 1 * k, 0.95), line(sp([[(xa + xb) / 2, top + 1 * k], [(xa + xb) / 2 + drift, blade - 2.5 * k]]) as Vec2[], sh, 0.6, 0.4)] }),
        onHeadwear({ shapes: [...cloth(ctx, back, c, H * 0.1), rightShade(back, c, W * 0.3, 0.22), line([[0, -H * 0.99], [W * 0.05, -H * 0.4], [W * 0.1, H * 0.06]], sh, 0.7, 0.45),
          S(oval(bk[0] - 1.2 * k, bk[1] + 0.3 * k, 1.8 * k, 1.3 * k, 0.6), tone(c, "shade")), S(oval(bk[0] + 0.8 * k, bk[1] - 0.2 * k, 1.8 * k, 1.3 * k, -0.3), c), { path: ellipse(bk[0], bk[1], 1.1 * k, 1 * k), fill: c }] }),
      ],
    };
  } }),

  // The sports hijab: a one-piece stretch hood, the tightest of the scarves, running on into a neck
  // gaiter that ends flat at the base of the neck. Nothing hangs or flaps, so it is safe for every gesture.
  headscarf_sport: named("head", "Sports hijab", "spor başörtüsü", { colors: 2, defaults: ["fab_22", "fab_21"], tags: ["sport", "modest", "school", "summer"], ...SCARF, over: ["neck"], draw: ctx => {
    const f = fit(ctx), { h, W, H, k, N } = f, c = ctx.colors[0] ?? "#26272C", acc = ctx.colors[1] ?? "#9AA0A6", sh = tone(c, "shade");
    const { g, ex } = COVERS.headscarf_sport(f), o: Opening = { top: 0.73, arch: 0.25, side: 0.4 * k, chin: 0.6 * k };
    const gw = f.b.neckW / 2 + 3 * k, hem = Math.min(H * 0.18, N + 4 * k), jaw = 0.12, jx = openingX(h, jaw, o);
    const side: Pt[] = [[ex, -H * 0.4], [ex - 0.8 * k, -H * 0.18], [Math.max(gw + 2.5 * k, jx + 1.8 * k), -H * 0.02], [Math.max(gw, jx * 0.7), H * 0.05, 0]];
    const front = scarfFront(f, o, g, side, jaw);
    const head: Shape[] = [
      ...cloth(ctx, front, c, hem),
      rightShade(front, c, W * 0.42, 0.28),
      { ...S(edgeStrip(h, o, 0.14, 1.1 * k, 0), acc), flat: true },
      // seams: round the face and down the sides, and the lycra's sheen on the left
      line(openingArc(h, { ...o, top: o.top + 3.6 * k / H, side: o.side - 3.4 * k, arch: o.arch + 0.02 }, 0.2), sh, 0.55, 0.5, { clip: smooth(front, true, 1) }),
      line(h.arc(g - 1.8 * k, PI * 1.12, PI * 1.32, 5), tone(c, "light"), 1.4 * k, 0.35),
      rimShade(openingPts(h, o), ctx.skin, k, 0.2),
    ];
    // the gaiter: behind the jaw, round the neck, a flat hem across the base of the neck
    const gaiter: Pt[] = both([[0, -H * 0.3], [W * 0.42, -H * 0.28], [jx + 1.5 * k, -H * 0.04], [gw + 0.6 * k, H * 0.06], [gw + 1.2 * k, hem, 0], [0, hem + 0.4 * k]]);
    const chest: Shape[] = [...cloth(ctx, onSpine(f, gaiter), c, hem - N - f.T),
      line(onSpine(f, [[-gw * 0.55, H * 0.05], [-gw * 0.6, hem - 0.6 * k]]) as Vec2[], sh, 0.55, 0.5), line(onSpine(f, [[gw * 0.55, H * 0.05], [gw * 0.6, hem - 0.6 * k]]) as Vec2[], sh, 0.55, 0.5)];
    const back = both([...crownTo(f, g, -H * 0.62, 5), [ex, -H * 0.4], [ex - 0.8 * k, -H * 0.16], [gw + 2.4 * k, H * 0.0], [gw + 1.2 * k, hem, 0], [0, hem + 0.4 * k]]);
    return {
      front: [onChest({ shapes: chest }), onHeadwear({ shapes: head })],
      back: [onHeadwear({ shapes: [...cloth(ctx, back, c, hem), rightShade(back, c, W * 0.3, 0.25), line([[0, -H * 1.0], [0, hem - 0.5 * k]], sh, 0.55, 0.55), line(h.arc(g - 1.8 * k, PI * 1.14, PI * 1.34, 5), tone(c, "light"), 1.4 * k, 0.3)] })],
    };
  } }),

  // The dastar: the Sikh turban, worn every day over the uncut hair. A rounded oblong 1.2 W wide
  // standing 0.26 H over the crown, its clean front edge across the forehead with a small point in
  // the middle; the wound layers show as five or six bands rising from the wearer's right to the
  // left, light and shade by turns; the ears and the nape stay bare; a beard goes with it. No print,
  // and nothing worn over it: it `replaces` a hat, so the builder takes one off for the other.
  turban_dastar: named("head", "Dastar (Sikh turban)", "dastar (Sih sarığı)", { colors: 1, defaults: ["fab_04"], tags: ["religious", "traditional", "modest", "formal", "turban"], builds: ["adult", "elder", "child"], hides: ["hair", "hairwear"], replaces: ["hat"], draw: ctx => {
    const f = fit(ctx), { W, H, k } = f, c = ctx.colors[0] ?? "#2E3A59", sh = tone(c, "shade"), lt = tone(c, "light"), dp = tone(c, "deep");
    const top = -H * 1.02 - COVERS.turban_dastar(f).g, side = W * 0.5 + 0.6 * k;
    // the layers: band edges y = y0 - 0.3 x, bowed a little down at the sides (round on the head); light on every other band, a shade line under each edge
    const edge = (y0: number, x: number) => y0 - 0.3 * x + H * 0.05 * (x / (W * 0.6)) ** 2;
    const bands = (y0s: number[], clip: Path, xs = [-0.7, -0.35, 0, 0.35, 0.7]): Shape[] => {
      const at = (y0: number): Vec2[] => xs.map((t): Vec2 => [W * t, edge(y0, W * t)]);
      const lit = y0s.slice(0, -1).filter((_, i) => i % 2 === 1).map(y0 => smooth([...at(y0), ...at(y0s[y0s.indexOf(y0) + 1]).reverse()], true, 1));
      const folds = y0s.map(y0 => smooth(at(y0), false, 1));
      return [
        ...(lit.length ? [{ path: lit.slice(1).reduce((p, q) => p.add(q), lit[0]), fill: lt, flat: true, opacity: 0.32, clip }] : []),
        { path: folds.slice(1).reduce((p, q) => p.add(q), folds[0]), stroke: { color: dp, width: 0.9 * k }, flat: true, opacity: 0.42, clip },
      ];
    };
    // front: the oblong, its edge across the forehead pointed in the middle, a fold at each temple
    const sil: Pt[] = both([[0, top], [W * 0.28, top + H * 0.012], [W * 0.5, top + H * 0.08], [W * 0.6, -H * 0.98], [W * 0.6, -H * 0.76], [side, -H * 0.57, 0], [W * 0.42, -H * 0.66], [W * 0.18, -H * 0.735], [0, -H * 0.78, 0]]);
    const path = smooth(sil, true, 1), span = top + H * 0.02 - -H * 0.74;
    const front: Shape[] = [
      { path, fill: c },
      ...bands([0.08, 0.24, 0.4, 0.56, 0.72, 0.88].map(t => -H * 0.74 + span * t), path),
      rightShade(sil, c, W * 0.3, 0.3, path),
      { path: smooth([[-W * 0.5, -H * 0.62], [-W * 0.56, -H * 0.72], [-W * 0.57, -H * 0.82]], false, 1).add(smooth([[W * 0.5, -H * 0.62], [W * 0.56, -H * 0.72], [W * 0.57, -H * 0.82]], false, 1)), stroke: { color: dp, width: 0.8 * k }, flat: true, opacity: 0.4, clip: path },
      line([[-W * 0.42, -H * 0.665], [-W * 0.18, -H * 0.74], [0, -H * 0.785], [W * 0.18, -H * 0.74], [W * 0.42, -H * 0.665]], lt, 1.2 * k, 0.5, { clip: path }),
      line([[-W * 0.46, top + H * 0.13], [-W * 0.3, top + H * 0.035]], lt, 1.6 * k, 0.4),
    ];
    // behind: the bands wound round, a straight lower edge across the back of the head at -0.55 H, the end tucked in near the middle
    const bsil: Pt[] = both([[0, top + H * 0.01], [W * 0.3, top + H * 0.025], [W * 0.52, top + H * 0.1], [W * 0.6, -H * 0.96], [W * 0.6, -H * 0.72], [side - 0.2 * k, -H * 0.58, 0], [W * 0.36, -H * 0.55], [0, -H * 0.55]]);
    const bpath = smooth(bsil, true, 1), bspan = top + H * 0.02 - -H * 0.55, ty = -H * 0.55 + bspan * 0.42 + H * 0.01;
    const wraps = (y0s: number[]): Shape[] => {
      const at = (y0: number): Vec2[] => [-0.7, -0.35, 0, 0.35, 0.7].map((t): Vec2 => [W * t, y0 + 0.12 * W * t + H * 0.05 * (1 - t * t)]);
      const lit = [1, 3].filter(i => i + 1 < y0s.length).map(i => smooth([...at(y0s[i]), ...at(y0s[i + 1]).reverse()], true, 1));
      return [
        { path: lit.slice(1).reduce((p, q) => p.add(q), lit[0]), fill: lt, flat: true, opacity: 0.3, clip: bpath },
        { path: y0s.map(y0 => smooth(at(y0), false, 1)).reduce((p, q) => p.add(q)), stroke: { color: dp, width: 0.9 * k }, flat: true, opacity: 0.42, clip: bpath },
      ];
    };
    const back: Shape[] = [
      { path: bpath, fill: c },
      ...wraps([0.06, 0.24, 0.42, 0.6, 0.78].map(t => -H * 0.55 + bspan * t - H * 0.04)),
      rightShade(bsil, c, W * 0.25, 0.26, bpath),
      line([[-W * 0.44, -H * 0.57], [0, -H * 0.565], [W * 0.44, -H * 0.57]], lt, 0.7 * k, 0.45),
      // the tucked end: a small flap in the shade tone, its shadow under it
      flat(smooth([[-2.2 * k, ty + 0.5 * k, 0], [2.4 * k, ty - 0.3 * k, 0], [0.9 * k, ty + 3.1 * k]], true, 1), dp, 0.3),
      flat(smooth([[-2.6 * k, ty - 0.1 * k, 0], [2.2 * k, ty - 0.9 * k, 0], [0.5 * k, ty + 2.5 * k]], true, 1), sh, 1),
    ];
    return { front: [onHeadwear({ shapes: front })], back: [onHeadwear({ shapes: back })] };
  } }),

  // The kippah: a small round cap on the crown, seen as a low dome with rounded ends sitting into
  // the hair (0.42 W across, a child's a little wider), a narrow band in colour 2 at its rim; plain,
  // knitted or striped, never a symbol. Under a hat it is not drawn (the hat covers it).
  cap_kippah: named("head", "Kippah", "kipa", { colors: 2, defaults: ["fab_04", "fab_02"], patterns: ["pat_stripe_h"], tags: ["religious", "traditional", "formal", "modest"], over: ["hair"], draw: ctx => {
    if (ctx.avatar.wear?.hat) return { front: [], back: [] };
    const f = fit(ctx), { W, H, k } = f, c = ctx.colors[0] ?? "#2E3A59", c2 = ctx.colors[1] ?? "#F0E2C8";
    // its rim sits where the hair's surface is, sunk a little into it; on a bare head on the scalp
    const v = Math.min(f.bulk * 0.5, 2.6 * k);
    const cap = (r: number, hgt: number, lip: number, dy: number): Shape[] => {
      const base = (x: number) => crownY(f, v, x) + dy, ts = [0, 0.12, 0.3, 0.5, 0.7, 0.88, 1];
      const top = ts.map((t): Pt => { const a = PI * t, x = r * Math.cos(a); return [x, base(x) - hgt * Math.sin(a) ** 0.8]; });
      const rim = ts.slice(1, -1).reverse().map((t): Pt => { const a = PI * t, x = r * Math.cos(a) * 0.98; return [x, base(x) + lip * Math.sin(a)]; });
      const pts = [...top, ...rim], path = smooth(pts, true, 1);
      // the band: the cap's lowest 0.8 cm (the cap's own outline cuts it)
      const bandPts: Pt[] = [...ts.map((t): Pt => { const x = r * Math.cos(PI * t) * 1.1; return [x, base(x) + lip * Math.sin(PI * t) - 0.8 * k]; }), [-r * 1.1, base(r) + 3 * k, 0], [r * 1.1, base(r) + 3 * k, 0]];
      return [
        castOnHair(pts, ctx.hair, k),
        { path, fill: c }, ...printed(ctx, path, { hem: base(0) + lip }),
        { path: smooth(bandPts, true, 1), fill: c2, flat: true, clip: path },
        line(top.slice(1, 4).map(([x, y]): Vec2 => [x * 0.8, y + 0.9 * k]), tone(c, "light"), 0.8 * k, 0.5, { clip: path }),
      ];
    };
    const r = W * (f.kid ? 0.23 : 0.21);
    return { front: [onHeadwear({ shapes: cap(r, H * 0.07, 1.2 * k, 0.6 * k) })], back: [onHeadwear({ shapes: cap(r * 1.04, H * 0.08, 0.7 * k, 1.4 * k) })] };
  } }),

  // The takke (taqiyah): a snug white dome of openwork lace, worn for prayer and every day; the
  // hairline and side hair stay, the hair under it is cut to its band.
  cap_taqiyah: named("head", "Prayer cap (taqiyah)", "takke", { colors: 2, defaults: ["fab_01", "fab_02"], tags: ["religious", "traditional", "modest", "everyday"], over: ["hair"], clips: { slots: ["hair", "hairwear"], keep: crownClip({ centre: 0.775, side: 0.69, back: 0.6 }) }, draw: ctx => {
    const f = fit(ctx), { W, H, k } = f, c = ctx.colors[0] ?? "#F7F3EA", c2 = ctx.colors[1] ?? "#F0E2C8", { g } = COVERS.cap_taqiyah(f);
    const holes = mix(c, tone(ctx.hair, "shade"), 0.55);
    const dome = (yc: number, ys: number): { pts: Pt[]; edge: (x: number) => number; xs: number } => {
      const r = crownTo(f, g, ys + 0.3 * k, 8), xs = r[r.length - 1][0], edge = (x: number) => yc + (ys - yc) * (x / xs) ** 2 + 0.3 * k;
      const base: Pt[] = [0.6, 0.25].map((u): Pt => [xs * u, edge(xs * u)]);
      return { pts: both([...r, ...base, [0, edge(0)]]), edge, xs };
    };
    const draw = (yc: number, ys: number, back: boolean): Shape[] => {
      const d = dome(yc, ys), out: Shape[] = [...cloth(ctx, d.pts, c, d.edge(0)), rightShade(d.pts, c, W * 0.2, 0.22)];
      // two rows of openwork diamonds above the band, a sheen
      const work: Shape[] = [];
      for (const [row, n] of [[3.2, 9], [6.2, 7]] as const) for (let i = 0; i < n; i++) {
        const x = d.xs * 0.86 * (i / (n - 1) * 2 - 1), y = d.edge(x) - row * k, s = 0.75 * k;
        work.push(flat(smooth([[x, y - s, 0], [x + s * 0.8, y, 0], [x, y + s, 0], [x - s * 0.8, y, 0]], true, 1), holes, 0.85));
      }
      out.push(...merged(work));
      const bandPts: Pt[] = [[-d.xs - 0.2 * k, d.edge(-d.xs) + 0.2 * k], ...[-0.6, 0, 0.6].map((u): Pt => [d.xs * u, d.edge(d.xs * u) + 0.2 * k]), [d.xs + 0.2 * k, d.edge(d.xs) + 0.2 * k, 0], [d.xs, d.edge(d.xs) - 1.4 * k], ...[0.6, 0, -0.6].map((u): Pt => [d.xs * u, d.edge(d.xs * u) - 1.2 * k])];
      bandPts.push([-d.xs, d.edge(-d.xs) - 1.4 * k]);
      out.push(S(bandPts, c2), domeSheen(f, c, g - 1.4 * k));
      if (back) out.push(...merged([0, 1, 2, 3, 4, 5].map(i => ({ path: ellipse(Math.cos(i * PI / 3) * 1.1 * k, crownY(f, g, 0) + 4.2 * k + Math.sin(i * PI / 3) * 1.1 * k, 0.75 * k, 0.75 * k), fill: holes, flat: true } as Shape))));
      return out;
    };
    return { front: [onHeadwear({ shapes: draw(-H * 0.78, -H * 0.69, false) })], back: [onHeadwear({ shapes: draw(-H * 0.6, -H * 0.6, true) })] };
  } }),

  // ---- hats (wear.hat) ----

  // A baseball cap: six panels to a button, a curved visor above the brows, the strap and its
  // opening at the back. No logo or letters.
  cap_baseball: named("hat", "Baseball cap", "beyzbol şapkası", { colors: 2, defaults: ["fab_04", "fab_01"], tags: ["casual", "sport", "school", "summer", ...HAT.tags], avoid: HAT.avoid, over: ["hair", "head"], clips: { slots: ["hair", "hairwear"], keep: crownClip({ centre: 0.72, side: 0.62, back: 0.58 }) }, draw: ctx => {
    const f = fit(ctx), { W, H, k } = f, c = ctx.colors[0] ?? "#2E3A59", c2 = ctx.colors[1] ?? "#F7F3EA", sh = tone(c, "shade"), u = under(ctx, f);
    const v = Math.max(1.4 * k, u.g * 0.95 + 0.8 * k);
    const band = (view: "front" | "back") => {
      const ys = -H * (view === "back" ? 0.58 : 0.62) + 0.5 * k, yc = -H * (view === "back" ? 0.58 : 0.72) + 0.5 * k, r = crownTo(f, v, ys, 9), xs = r[r.length - 1][0];
      return { r, xs, ys, at: (x: number) => yc + (ys - yc) * Math.min(1, Math.abs(x) / xs) ** 2 };
    };
    const top = crownY(f, v, 0), btn = Math.max(1.1, 1.4 * k);
    // front: the dome, its seams and button, the visor and its shadow on the forehead
    const fb = band("front"), dome = both([...fb.r, ...[0.7, 0.35].map((t): Pt => [fb.xs * t, fb.at(fb.xs * t)]), [0, fb.at(0)]]);
    const vw = W * 0.47, vis = (x: number) => fb.at(x) + 0.088 * H * Math.pow(Math.max(0, 1 - (x / vw) ** 2), 0.8);
    const visor: Pt[] = [...[-1, -0.7, -0.35, 0, 0.35, 0.7, 1].map((t): Pt => [vw * t, fb.at(vw * t) - 0.6 * k]), ...[1, 0.7, 0.35, 0, -0.35, -0.7].map((t): Pt => [vw * t, vis(vw * t)])];
    const front: Shape[] = [
      flat(smooth([[-vw * 0.8, vis(0) - 0.5 * k], [0, vis(0) + 2.6 * k], [vw * 0.8, vis(0) - 0.5 * k], [0, vis(0)]], true, 1), "#2B1A10", 0.18),
      ...cloth(ctx, dome, c, fb.at(0)), rightShade(dome, c, W * 0.18, 0.3),
      ...merged([-0.5, -0.17, 0.17, 0.5].map(t => line([[0, top + btn], [fb.xs * t * 0.75, (top + fb.at(fb.xs * t)) / 2], [fb.xs * t * 1.02, fb.at(fb.xs * t)]], sh, 0.55, 0.5))),
      domeSheen(f, c, v - 1.8 * k),
      { path: ellipse(0, top + btn * 0.6, btn, btn * 0.8), fill: c2 },
      S(visor, c2), line([0.9, 0.5, 0, -0.5, -0.9].map((t): Vec2 => [vw * t, vis(vw * t) - 0.5 * k]), tone(c2, "deep"), 0.9 * k, 0.4),
    ];
    // back: the dome to a lower band, its opening over the strap, the visor's tips beside it
    const bb = band("back"), bdome: Pt[] = both([...bb.r, [bb.xs * 0.5, bb.ys], [W * 0.13, bb.ys, 0], [W * 0.12, bb.ys - H * 0.055], [W * 0.06, bb.ys - H * 0.085], [0, bb.ys - H * 0.09]]);
    const tip = (s: 1 | -1): Pt[] => [[s * (bb.xs - 2 * k), -H * 0.64], [s * (bb.xs + 1.4 * k), -H * 0.66], [s * (bb.xs + 1.2 * k), -H * 0.61], [s * (bb.xs - 2 * k), -H * 0.6]];
    const back: Shape[] = [
      S(tip(1), c2), S(tip(-1), tone(c2, "shade")),
      flat(smooth([[-W * 0.13, bb.ys + 0.4 * k], [-W * 0.12, bb.ys - H * 0.06], [0, bb.ys - H * 0.095], [W * 0.12, bb.ys - H * 0.06], [W * 0.13, bb.ys + 0.4 * k]], true, 1), mix(tone(c, "deep"), ctx.hair, 0.4)),
      ...cloth(ctx, bdome, c, bb.ys), rightShade(bdome, c, W * 0.18, 0.28),
      ...merged([-0.55, -0.2, 0.2, 0.55].map(t => line([[0, top + btn], [bb.xs * t * 0.8, (top + bb.ys) / 2], [bb.xs * t * 1.02, bb.ys]], sh, 0.55, 0.5))),
      S([[-W * 0.15, bb.ys - 1.6 * k, 0], [W * 0.15, bb.ys - 1.6 * k, 0], [W * 0.15, bb.ys + 0.6 * k, 0], [-W * 0.15, bb.ys + 0.6 * k, 0]], tone(c, "shade")),
      S([[W * 0.02, bb.ys - 1.9 * k, 0], [W * 0.08, bb.ys - 1.9 * k, 0], [W * 0.08, bb.ys + 0.9 * k, 0], [W * 0.02, bb.ys + 0.9 * k, 0]], c2),
      domeSheen(f, c, v - 1.8 * k, 1.54, 1.8),
      { path: ellipse(0, top + btn * 0.6, btn, btn * 0.8), fill: c2 },
    ];
    return { front: [onHeadwear({ shapes: front })], back: [onHeadwear({ shapes: back })] };
  } }),

  // A knitted beanie: a soft dome over a folded cuff that covers the ear tops; ribs on the cuff.
  hat_beanie: named("hat", "Beanie", "bere", { colors: 2, defaults: ["fab_21"], tags: ["winter", "casual", "sport", ...HAT.tags], avoid: HAT.avoid, over: ["hair", "head"], clips: { slots: ["hair", "hairwear"], keep: crownClip({ centre: 0.7, side: 0.5, back: 0.52 }) }, draw: ctx => {
    const f = fit(ctx), { W, H, k } = f, c = ctx.colors[0] ?? "#9AA0A6", c2 = ctx.colors[1] ?? mix(c, tone(c, "light"), 0.5), u = under(ctx, f);
    const v = Math.max(1.6 * k, u.g * 0.95 + 1 * k), top = crownY(f, v, 0);
    const knit = (view: "front" | "back") => {
      const lo = view === "back" ? -H * 0.52 : -H * 0.7, ls = -H * 0.5, ch = H * (view === "back" ? 0.12 : 0.12);
      const r = crownTo(f, v, ls - ch + 1 * k, 9), xs = Math.max(r[r.length - 1][0], u.ex + 0.4 * k), cx = xs + 0.5 * k;
      const at = (x: number) => lo + (ls - lo) * Math.min(1, Math.abs(x) / cx) ** 2;
      const dome = both([...r, [xs, ls - ch * 0.4], [0, ls - ch * 0.4]]);
      const ts = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1];
      const cuff: Pt[] = [...ts.map((t): Pt => [cx * t, at(cx * t) - ch]), ...[...ts].reverse().map((t): Pt => [cx * t * 1.0, at(cx * t)])];
      cuff[0] = [cuff[0][0], cuff[0][1], 0]; cuff[ts.length - 1] = [cuff[ts.length - 1][0], cuff[ts.length - 1][1], 0];
      const ribs: Shape[] = [];
      for (let x = -cx + 1.4 * k; x < cx - 0.8 * k; x += 2.1 * k) ribs.push(line([[x, at(x) - ch + 0.7 * k], [x, at(x) - 0.6 * k]], tone(c2, "shade"), 0.55 * k, 0.45));
      const rows = [-0.62, -0.3, 0, 0.3, 0.62].map(t => line([[cx * t * 0.95, at(cx * t) - ch], [cx * t * 0.7, (at(cx * t) - ch + top) / 2], [cx * t * 0.12, top + 2.4 * k]], tone(c, "shade"), 0.5 * k, 0.28));
      return [...cloth(ctx, dome, c, at(0)), rightShade(dome, c, W * 0.15, 0.28), ...merged(rows), domeSheen(f, c, v - 1.6 * k, 1.22, 1.44), ...cloth(ctx, cuff, c2, at(0)), ...merged(ribs), line(ts.slice(1, -1).map((t): Vec2 => [cx * t * 0.97, at(cx * t) - ch + 0.6 * k]), tone(c2, "light"), 0.6 * k, 0.5)];
    };
    return { front: [onHeadwear({ shapes: knit("front") })], back: [onHeadwear({ shapes: knit("back") })] };
  } }),

  // The kasket: the flat cap of Istanbul's older men and tradesmen (women wear it too): a low wide
  // crown bulging forward over a short stiff peak.
  cap_flat: named("hat", "Flat cap", "kasket", { colors: 2, defaults: ["fab_21", "fab_24"], tags: ["traditional", "casual", "work", "elder", "istanbul", ...HAT.tags], avoid: HAT.avoid, builds: ["adult", "elder"], over: ["hair", "head"], clips: { slots: ["hair", "hairwear"], keep: crownClip({ centre: 0.73, side: 0.64, back: 0.55 }) }, draw: ctx => {
    const f = fit(ctx), { W, H, k } = f, c = ctx.colors[0] ?? "#9AA0A6", c2 = ctx.colors[1] ?? "#3A3D45", sh = tone(c, "shade"), u = under(ctx, f);
    const v = Math.max(1.2 * k, u.g * 0.9 + 0.8 * k), wide = Math.max(W / 2 + v + 1.5 * k, u.ex + 1 * k), top = -H * 0.98 - v * 0.8;
    const peak: Pt[] = [[-W * 0.37, -H * 0.735], [-W * 0.2, -H * 0.745], [W * 0.2, -H * 0.745], [W * 0.37, -H * 0.735, 0], [W * 0.24, -H * 0.685], [0, -H * 0.66], [-W * 0.24, -H * 0.685]];
    const body: Pt[] = both([[0, top], [W * 0.3, top + 0.4 * k], [wide - 3 * k, -H * 0.93], [wide, -H * 0.84], [wide - 1.2 * k, -H * 0.72], [W / 2 + v * 0.6, -H * 0.64, 0], [W * 0.38, -H * 0.7], [W * 0.15, -H * 0.745], [0, -H * 0.75]]);
    const btn = 1.0 * k;
    const front: Shape[] = [
      S(peak, c2), line([[-W * 0.3, -H * 0.69], [0, -H * 0.665], [W * 0.3, -H * 0.69]], tone(c2, "light"), 0.6 * k, 0.4),
      ...cloth(ctx, body, c, -H * 0.75), rightShade(body, c, W * 0.2, 0.3),
      line([[-wide + 1.8 * k, -H * 0.79], [-W * 0.3, -H * 0.775], [0, -H * 0.8], [W * 0.3, -H * 0.775], [wide - 1.8 * k, -H * 0.79]], sh, 0.6, 0.45),
      line([[0, top + btn], [W * 0.05, -H * 0.88], [W * 0.02, -H * 0.8]], sh, 0.55, 0.4),
      line([[-W * 0.38, top + 1.2 * k], [-W * 0.18, top + 0.2 * k]], tone(c, "light"), 1.4 * k, 0.45),
      { path: ellipse(0, top + btn * 0.5, btn, btn * 0.75), fill: sh },
    ];
    const bbody: Pt[] = both([[0, top - 0.4 * k], [W * 0.32, top + 0.2 * k], [wide - 2.6 * k, -H * 0.93], [wide - 0.2 * k, -H * 0.84], [wide - 1 * k, -H * 0.68], [W / 2 + v * 0.5, -H * 0.56, 0], [0, -H * 0.55]]);
    const back: Shape[] = [
      ...cloth(ctx, bbody, c, -H * 0.55), rightShade(bbody, c, W * 0.2, 0.28),
      ...merged([-0.85, -0.5, -0.17, 0.17, 0.5, 0.85].map(t => line([[0, top + btn], [wide * t * 0.75, -H * 0.86], [wide * t * 0.82, -H * 0.56]], sh, 0.5, 0.42))),
      line([[-W * 0.38, top + 1.2 * k], [-W * 0.18, top + 0.2 * k]], tone(c, "light"), 1.4 * k, 0.45),
      { path: ellipse(0, top + btn * 0.3, btn, btn * 0.75), fill: sh },
    ];
    return { front: [onHeadwear({ shapes: front })], back: [onHeadwear({ shapes: back })] };
  } }),

  // A scrub cap: soft cloth pulled down to the hairline, a little volume over the hair, the ears out; a
  // lighter band along its edge, and from behind gathered by a tie knotted at the nape. Elif's ward look.
  cap_scrub: named("hat", "Scrub cap", "cerrahi bone", { colors: 1, palettes: ["fabric"], defaults: ["fab_06"], patterns: SCRUB_PRINTS, builds: ["adult", "elder"], tags: ["work", "healthcare", ...HAT.tags], avoid: HAT.avoid, over: ["hair", "head"], clips: { slots: ["hair", "hairwear"], keep: crownClip(SCRUB_BAND) }, draw: ctx => {
    const f = fit(ctx), { W, H, k } = f, c = ctx.colors[0] ?? "#2F8C88", sh = tone(c, "shade"), lt = mix(c, tone(c, "light"), 0.7), u = under(ctx, f);
    const v = u.g * 0.9 + 1.5 * k, d = 0.5 * k, top = crownY(f, v, 0);
    // the cap's lower edge: the clip's band line moved d below it (the same points, so no scalp shows between them), `lift` cm up for the band's top
    const edge = (yc: number, ys: number, xs: number, lift: number): Pt[] => [[xs, ys + d - lift, 0], [W * 0.55, ys + d - lift], [0, yc + d - lift], [-W * 0.55, ys + d - lift], [-xs, ys + d - lift, 0]];
    const piece = (view: "front" | "back"): { pts: Pt[]; path: Path; xs: number; yc: number; ys: number } => {
      const yc = -H * (view === "back" ? SCRUB_BAND.back : SCRUB_BAND.centre), ys = -H * SCRUB_BAND.side, r = crownTo(f, v, ys + d, 9), xs = Math.max(r[r.length - 1][0], W * 0.55 + 1.5 * k);
      const pts: Pt[] = [...r.slice(0, -1), [xs, ys + d, 0], ...edge(yc, ys, xs, 0).slice(1, -1), [-xs, ys + d, 0], ...r.slice(1, -1).reverse().map(mx)];
      return { pts, path: smooth(pts, true, 1), xs, yc, ys };
    };
    const stitch = (pts: Vec2[], o = 0.5): Shape => line(pts, tone(c, "deep"), 0.3 * k, o, { stroke: { color: tone(c, "deep"), width: 0.3 * k, dash: [0.7 * k, 0.5 * k] } });
    const fp = piece("front"), band = (p: typeof fp): Shape => ({ path: smooth([...edge(p.yc, p.ys, p.xs + 1, 0), ...edge(p.yc, p.ys, p.xs + 1, 1 * k).reverse()], true, 1), fill: lt, flat: true, opacity: 0.85, clip: p.path });
    const front: Shape[] = [
      ...cloth(ctx, fp.pts, c, fp.yc + d), rightShade(fp.pts, c, W * 0.2, 0.28, fp.path), band(fp),
      stitch(edge(fp.yc, fp.ys, fp.xs - 1.4 * k, 1.3 * k).slice(1, -1) as Vec2[]),
      // the crown panel's seam, and a soft fold of the volume
      line(f.h.arc(v - 2.6 * k, PI * 1.12, PI * 1.88, 8), sh, 0.45 * k, 0.45),
      line([[W * 0.3, top + 4 * k], [W * 0.36, -H * 0.8]], sh, 0.5 * k, 0.3),
      domeSheen(f, c, v - 1.4 * k, 1.2, 1.42),
    ];
    // from behind: down to the tie at the nape, gathered into the knot; two tails hang from it
    const bp = piece("back"), ky = bp.yc + d - 0.4 * k, tl = 4 * k;
    const gathers = merged([-0.75, -0.4, 0.4, 0.75].map(t => line([[t * 1.4 * k, ky - 0.8 * k], [t * W * 0.22, ky - H * 0.12]], sh, 0.45 * k, 0.45)));
    const back: Shape[] = [
      ...cloth(ctx, bp.pts, c, bp.yc + d), rightShade(bp.pts, c, W * 0.2, 0.26, bp.path), band(bp),
      line(f.h.arc(v - 2.6 * k, PI * 1.12, PI * 1.88, 8), sh, 0.45 * k, 0.4), ...gathers,
      S([[-0.4 * k, ky], [-1.6 * k, ky + tl * 0.6], [-1.2 * k, ky + tl, 0], [-0.1 * k, ky + tl * 0.9, 0], [0.2 * k, ky + 0.4 * k]], sh),
      S([[0.3 * k, ky], [1.4 * k, ky + tl * 0.55], [1.9 * k, ky + tl * 0.95, 0], [0.8 * k, ky + tl * 0.92, 0], [-0.1 * k, ky + 0.5 * k]], c),
      { path: ellipse(0, ky, 1.1 * k, 0.9 * k), fill: c },
      domeSheen(f, c, v - 1.4 * k, 1.54, 1.78),
    ];
    return { front: [onHeadwear({ shapes: front })], back: [onHeadwear({ shapes: back })] };
  } }),

  // A baby's bonnet: a soft round cap over the crown and ears, a scalloped frill across the hairline
  // from temple to temple, two thin ties down along the jaw to a small bow under the chin on the
  // wearer's right (x -0.17 W).
  hat_bonnet: named("hat", "Baby bonnet", "bebek şapkası", { colors: 2, defaults: ["fab_07", "fab_01"], tags: ["summer", "winter", "casual", ...HAT.tags], avoid: HAT.avoid, builds: ["toddler", "child"], hides: ["hair", "hairwear", "ears"], over: ["neck", "head"], draw: ctx => {
    const f = fit(ctx), { h, W, H, k } = f, c = ctx.colors[0] ?? "#9CD3C0", c2 = ctx.colors[1] ?? "#F7F3EA", sh = tone(c, "shade");
    const g = overHair(f, 2.4, 0.4), ex = earX(f, g, 1.1), o: Opening = { top: 0.77, arch: 0.3, side: 0.1 * k, chin: 0.6 * k }, low = 0.17, jx = openingX(h, low, o);
    const side: Pt[] = [[ex + 0.4 * k, -H * 0.4], [ex, -H * 0.25], [ex - 1.6 * k, -H * low, 0], [jx + 0.4 * k, -H * (low - 0.01), 0]];
    const cap = scarfFront(f, o, g, side, low);
    // the frill: scallops along the face edge, from temple to temple
    const arc = openingArc(h, o, 0.55), frill: Pt[] = [];
    for (let i = 0; i < arc.length; i++) {
      const a = arc[Math.max(0, i - 1)], b = arc[Math.min(arc.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (b[1] - a[1]) / l, ny = -(b[0] - a[0]) / l;
      frill.push([arc[i][0] + nx * 0.9 * k, arc[i][1] + ny * 0.9 * k]);
    }
    const inner: Pt[] = [];
    for (let i = arc.length - 1; i >= 0; i--) {
      const a = arc[Math.max(0, i - 1)], b = arc[Math.min(arc.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (b[1] - a[1]) / l, ny = -(b[0] - a[0]) / l;
      inner.push([arc[i][0] - nx * 1.2 * k, arc[i][1] - ny * 1.2 * k]);
      if (i > 0) { const m: Vec2 = [(arc[i][0] + arc[i - 1][0]) / 2, (arc[i][1] + arc[i - 1][1]) / 2]; inner.push([m[0] - nx * 0.3 * k, m[1] - ny * 0.3 * k]); }
    }
    // the ties: from the cap's lower corners down just outside the jaw to the bow; the far one passes under the chin
    const bowAt: Vec2 = [-W * 0.17, H * 0.05], jawX = (y: number) => headHalfWidth(h.shape, W, H, y) + 0.5 * k;
    const tie = (s: 1 | -1): Shape => {
      const pts: Vec2[] = [[s * (jx + 0.2 * k), -H * (low - 0.01)], [s * jawX(-H * 0.1), -H * 0.1], ...(s > 0 ? [[jawX(-H * 0.03) * 0.75, -H * 0.005] as Vec2, [W * 0.05, H * 0.035] as Vec2] : []), [bowAt[0] + (s > 0 ? 0.8 : -0.4) * k, bowAt[1]]];
      return { path: band(pts, pts.map(() => 0.95 * k)), fill: mix(c2, tone(c2, "shade"), s > 0 ? 0.9 : 0.6), flat: true };
    };
    const front: Shape[] = [
      tie(-1), tie(1),
      ...cloth(ctx, cap, c, -H * low), rightShade(cap, c, W * 0.36, 0.28),
      line([[W * 0.34, -H * 0.9], [W * 0.5, -H * 0.62], [W * 0.5, -H * 0.36]], sh, 0.6, 0.4),
      S([...frill, ...inner], c2),
      ...bow(bowAt[0], bowAt[1], 0.62 * k, c2, tone(c2, "shade")),
      rimShade(openingPts(h, o), ctx.skin, k, 0.18),
    ];
    // behind: gathered to a point low on the back of the head, one seam up to the crown
    const back = both([...crownTo(f, g, -H * 0.62, 5), [ex + 0.4 * k, -H * 0.4], [ex - 0.4 * k, -H * 0.26], [W * 0.3, -H * 0.17], [0, -H * 0.15]]);
    const gx = 0, gy = -H * 0.3;
    return {
      front: [onHeadwear({ shapes: front })],
      back: [onHeadwear({ shapes: [...cloth(ctx, back, c, -H * 0.15), rightShade(back, c, W * 0.25, 0.25), line([[0, -H * 1.0], [0, gy]], sh, 0.6, 0.45),
        ...merged([-0.9, -0.55, -0.2, 0.2, 0.55, 0.9].map(t => line([[gx + t * 1.2 * k, gy - 0.6 * k], [t * W * 0.22, gy - H * 0.16]], sh, 0.5, 0.4))),
        { path: ellipse(gx, gy, 1.4 * k, 1.1 * k), fill: tone(c, "shade") }] })],
    };
  } }),

  // ---- hair accessories (wear.hair) ----

  // An Alice band over the crown behind the hairline, from ear to ear, lying on the hair.
  headband_band: named("hairwear", "Headband", "saç bandı", { colors: 1, defaults: ["fab_14"], tags: ["casual", "school", "everyday", "summer"], over: ["hair"], draw: ctx => {
    const f = fit(ctx), { W, H, k } = f, c = ctx.colors[0] ?? "#D9534A";
    const make = (lift: number, a0: number, a1: number): Shape[] => {
      const cy = -H * 0.5, rx = W / 2 + f.bulk * 0.75 - 0.4 * k, ry = H * 0.52 + f.bulk - lift, n = 14, spine: Vec2[] = [], wd: number[] = [];
      for (let i = 0; i <= n; i++) { const a = PI * (a0 + (a1 - a0) * i / n), m = Math.sin(PI * i / n); spine.push([Math.cos(a) * rx, cy + Math.sin(a) * ry]); wd.push((1.1 + 1.2 * m) * k); }
      const path = band(spine, wd), pts = spine.map(([x, y]): Pt => [x, y]);
      return [flat(band(spine.map(([x, y]): Vec2 => [x + 0.3 * k, y + 0.8 * k]), wd), tone(ctx.hair, "deep"), 0.45), { path, fill: c }, ...printed(ctx, path, { hem: cy }), line(pts.slice(2, n / 2 + 1).map(([x, y]): Vec2 => [x * 0.985, y + (y - cy) * 0.035 - 0.15 * k]), tone(c, "light"), 0.6 * k, 0.55)];
    };
    return { front: [onHair({ shapes: make(3 * f.k, 1.03, 1.97) })], back: [onHair({ shapes: make(2.2 * f.k, 1.08, 1.92) })] };
  } }),

  // A hair clip at the temple (or both), chunky, its colour against the hair (bright pink by default, so it shows on dark hair), three bright stones on it.
  hairclip_barrette: named("hairwear", "Hair clip", "toka", { colors: 2, palettes: ["fabric", "metal"], defaults: ["fab_51", "met_silver"], tags: ["casual", "school", "everyday"], over: ["hair"], sides: { allowed: ["l", "r", "b"], default: "l" }, draw: ctx => {
    const f = fit(ctx), { W, H, k } = f, c = ctx.colors[0] ?? "#E4528C", c2 = ctx.colors[1] ?? "#C3C8CE", L = W * (f.kid ? 0.28 : 0.24), T2 = H * (f.kid ? 0.085 : 0.068);
    const clip = (s: 1 | -1, x0: number, y0: number, back: boolean): Shape[] => {
      const a = s * 0.35, dx = Math.cos(a) * L / 2, dy = Math.sin(a) * L / 2 * s;
      const pts = bar([x0 - dx * s, y0 - dy], [x0 + dx * s, y0 + dy], T2);
      if (back) return [castOnHair(pts, ctx.hair, k), S(pts, tone(c, "shade"))];
      const dots = [-0.5, 0, 0.5].map(t => ({ path: ellipse(x0 + dx * s * t, y0 + dy * t, T2 * 0.2, T2 * 0.2), fill: c2, flat: true } as Shape));
      return [castOnHair(pts, ctx.hair, k), S(pts, c), line([[x0 - dx * s * 0.8, y0 - dy * 0.8 - T2 * 0.3], [x0 + dx * s * 0.6, y0 + dy * 0.6 - T2 * 0.3]], tone(c, "light"), 0.45 * k, 0.6), ...dots];
    };
    const sides = sidesOf(ctx.side, "l");
    return {
      front: [onHair({ shapes: sides.flatMap(s => clip(s, s * W * 0.3, -H * 0.84, false)) })],
      back: [onHair({ shapes: sides.flatMap(s => clip(s, s * W * 0.4, -H * 0.8, true)) })],
    };
  } }),

  // A ribbon bow high on the crown at the wearer's left (a toddler's in the middle, larger).
  hairbow_ribbon: named("hairwear", "Hair bow", "fiyonklu toka", { colors: 2, defaults: ["fab_15", "fab_53"], tags: ["casual", "school", "festive"], over: ["hair"], sides: { allowed: ["l", "r"], default: "l" }, draw: ctx => {
    const f = fit(ctx), { W, k } = f, c = ctx.colors[0] ?? "#E58FA0", c2 = ctx.colors[1] ?? "#9A2D62", toddler = f.b.build === "toddler";
    const s = sidesOf(ctx.side, "l")[0], x = toddler ? 0 : s * W * 0.3, y = crownY(f, f.bulk, x) + 1.6 * k, size = (toddler ? 1.3 : 1) * W * 0.22 / 15.6;
    return {
      front: [onHair({ shapes: bow(x, y, size * 2, c, c2) })],
      back: [onHair({ shapes: bow(x, y + 0.6 * k, size * 2, c, c2, true) })],
    };
  } }),
};
