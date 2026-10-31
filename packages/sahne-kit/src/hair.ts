// Hair styles: straight, wavy and tied, hair loss and children's styles (the textured ones are in
// hair_textured.ts). Each gives a front view (pieces behind and over the head) and a back view.
// Shapes come from the head's own outline and size (`hairPart` hands the drawing a `Head`), so
// every style fits every face shape, build and body.
//
// THE HAIR ARTIST'S FILE: add parts to `HAIR_PARTS` (ids `hair_*`, permanent). Shared helpers are
// in draw/ (`hairPart`, `backCover`, `shortFront`, `sheen`, `onHead`, `onNeck`, `Head.crown`);
// a helper only this file needs stays here. Hair takes no colours of its own (`ctx.hair`). A style
// that is not for every build says `builds`; a rare one has `odds` (bald heads are not for children).
// A style fuller than a crop says its `bulk` (`HAIR_BULK.mid`, or cm), which hats and coverings read.
// Edges that must cover the head use `Head.crown` (the crown ellipse, grown only where a face shape's
// corner would show); lines inside the hair use `Head.arc`.
//
// How the styles here are built: bulk and detail sizes are adult cm × `Head.k`, so a child's cap is
// not helmet-thick; lengths below the chin are `below(body, f)` (the neck plus a fraction of the
// torso), so a child's hair never reaches the hips. Hair behind the head is `hair_back` (in front
// view behind the whole body, in shade); what hangs over the chest is on the neck bone (`onNeck`,
// front view only, under the arms), tucked 3 cm under the head piece. Sheens sit upper left in
// front, and on the wearer's left (+x) in back, which the mirrored back view puts upper left too.
// Ties and pins are `tone(hair, "deep")` (on very dark hair a muted brick or steel, so they show)
// until the document has an accent colour. The six oldest styles keep their A1 course words as
// Turkish names ("kısa", "klasik", "çok kısa", "bob", "uzun", "topuz"; the kit tests pin them), not
// the catalogue's longer "kısa saç", "klasik kesim", "makine tıraşı", "küt saç", "uzun saç", "yüksek topuz".

import { smooth, ellipse, band, rect, tone, mix, luma, hexToRgb, rgbToHsl, Path, type BodyDims, type Group, type Item, type PartDef, type Shape, type Vec2 } from "sahne";
import { hairPart, sheen, onHead, onNeck, headHalfWidth, HAIR_BULK, S, line, strand, type Head, type Pt } from "./draw/index.ts";

const PI = Math.PI;

// ---- this file's helpers ------------------------------------------------------------------------

/** Head-space y of a point on the body below the chin: the neck plus `f` of the torso (catalogue `L(f)`). */
const below = (b: BodyDims, f: number) => b.neckL + f * b.torsoL;
/** One value for adults and elders, one for children, one for toddlers. */
const per = (b: BodyDims, adult: number, child = adult, toddler = child) => b.build === "toddler" ? toddler : b.build === "child" ? child : adult;
/** The covering crown of bulk `v` at one angle (π the left side, 1.5π the top, 2π the right). */
const crownAt = (h: Head, v: number, a: number): Vec2 => h.crown(v, a, a, 1)[0];
/** A crown whose bulk changes along it: `v(t)`, t from 0 (at a0) to 1 (at a1). */
const crownBy = (h: Head, v: (t: number) => number, a0: number, a1: number, n: number): Vec2[] =>
  Array.from({ length: n + 1 }, (_, i) => crownAt(h, v(i / n), a0 + (a1 - a0) * i / n));
/** Points mirrored left to right (corners stay corners). */
const flipX = (pts: Pt[]): Pt[] => pts.map((p): Pt => p.length === 3 ? [-p[0], p[1], 0] : [-p[0], p[1]]);
/** A symmetric outline from its right half (+x), listed from the top centre down to the bottom centre. */
const mirrored = (right: Pt[]): Pt[] => [...right, ...flipX(right).reverse()];
/** Head-space points in the neck bone's frame (a lock that starts at the jaw and hangs over the chest). */
const toNeck = (b: BodyDims, pts: Pt[]): Pt[] => pts.map((p): Pt => p.length === 3 ? [p[0], p[1] - b.neckL, 0] : [p[0], p[1] - b.neckL]);
/** A line from p to q waving across itself: `n` half-waves of `a` cm (the first to the line's left), `steps` points. */
function wavy(p: Vec2, q: Vec2, n: number, a: number, steps = n * 3, phase = 0): Vec2[] {
  const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, s = Math.sin(t * n * PI + phase) * a;
    return [p[0] + dx * t + nx * s, p[1] + dy * t + ny * s] as Vec2;
  });
}
/**
 * Back view of hair that hangs past the shoulders: the arms come after `hair_back` from behind, so
 * the part below the chin is drawn again over them (layer `over_sleeve`, the first one above every
 * sleeve), cut at the chin. The cut runs inside the same hair, rim and shadow clipped with it, so no
 * seam shows; the head and anything on it (a hat's brim) stay on `hair_back`.
 */
const fallOver = (shapes: Shape[]): Item => ({ layer: "over_sleeve", bone: "head", group: { shapes: shapes.map(s => ({ ...s, clip: rect(-200, 0, 400, 400) })) } });
/** Hair behind the head in front view: in shade, but still read as the same hair. */
const behind = (c: string) => mix(c, tone(c, "shade"), 0.38);
/** The scalp seen through a parting: between the hair and the skin. */
const scalp = (c: string, skin: string) => mix(c, skin, 0.62);
/** A pin: the hair's deepest tone, or a steel grey on hair too dark to show it (the part's accent colour later). */
const pinOf = (c: string) => luma(c) < 0.22 ? mix(c, "#A39E98", 0.55) : tone(tone(c, "deep"), "shade");
/** An elastic tie: the hair's deepest tone, or a muted brick on hair too dark to show it (the part's accent colour later). */
const tieOf = (c: string) => luma(c) < 0.3 ? mix(c, "#B4584A", 0.6) : tone(tone(c, "deep"), "shade");
/** The grey of greying temples: lighter for dark hair, a mid grey for light hair, a quiet light tone when the hair is grey already. */
function greyOf(c: string): string {
  const [, s, l] = rgbToHsl(hexToRgb(c));
  return s < 0.14 && l > 0.42 ? tone(c, "light") : luma(c) > 0.5 ? mix(c, "#8F8A84", 0.55) : mix(c, "#E8E4DC", 0.42);
}

/**
 * The front of a short cap: the crown (bulk `v`, or the points `top`, left to right) from ear to
 * ear, down the sides to `low` (a fraction of H above the chin: 0.48 rests on the ear's top), a
 * sideburn in front of each ear down to `burn`, and the hairline `line` across the forehead, listed
 * from the wearer's left (+x) to the right.
 */
function capFront(h: Head, v: number, hairline: Pt[], o: { low?: number; burn?: number; top?: Vec2[]; out?: number } = {}): Pt[] {
  const { W, H, k } = h, low = o.low ?? 0.48, out = o.out ?? v * 0.45;
  const top = o.top ?? h.crown(v, PI * 1.02, PI * 1.98, 12);
  const side: Pt[] = [[W / 2 + out, -H * low, 0], [W / 2 - 1 * k, -H * (low - 0.005), 0]];
  if (o.burn) side.push([W / 2 - 1.2 * k, -H * o.burn, 0], [W / 2 - 3.1 * k, -H * (o.burn + 0.015), 0]);
  return [...flipX(side.slice(0, 1)), ...top, ...side, ...hairline, ...flipX(side.slice(1)).reverse()];
}

/**
 * The back of a short cap: the crown of bulk `v` from ear to ear, the sides tucked in over the ears by
 * `tuck` cm (so they show from behind), and the nape edge `nape` (the right half, from the ear down to the
 * centre; mirrored). The default is a soft rounded nape at -0.16 H.
 */
function capBack(h: Head, v: number, nape?: Pt[], o: { ears?: boolean; tuck?: number; top?: Pt[] } = {}): Pt[] {
  const { W, H, k } = h, top = o.top ?? h.crown(v, PI * 0.98, PI * 2.02, 12), t = o.tuck ?? 3.2;
  const side: Pt[] = o.ears === false ? [[W / 2 + v * 0.6, -H * 0.3]] : [[W / 2 + v * 0.5, -H * 0.5], [W / 2 - (t - 0.8) * k, -H * 0.47], [W / 2 - t * k, -H * 0.36]];
  const edge = nape ?? [[W * 0.3, -H * 0.2], [W * 0.12, -H * 0.165], [0, -H * 0.16]];
  const right = [...side, ...edge];
  return [...top, ...right, ...flipX(right).reverse().slice(1)];
}

/** Strands on the back of the head (the second one longer, on the lit side) and a sheen there: +x, which the mirrored back view shows upper left. */
function backDetail(h: Head, c: string, v: number, to = 0.3): Shape[] {
  const { W, H, k } = h;
  return [
    strand([[-W * 0.16, -H * 0.94], [-W * 0.07, -H * 0.62], [-W * 0.12, -H * (to + 0.02)]], tone(c, "deep"), 0.55 * k, 0.45),
    strand([[W * 0.15, -H * 0.92], [W * 0.09, -H * 0.58], [W * 0.13, -H * to]], tone(c, "deep"), 0.55 * k, 0.45),
    { ...strand(h.arc(v - 1.2 * k, PI * 1.55, PI * 1.82, 5), tone(c, "light"), 1.4 * k, 0.5) },
  ];
}

/**
 * A bare forehead or scalp: the head's own side shade (body.ts; the same points) would show there as a
 * slash, so its top is covered in skin above the temples, where hair hides it on every other style.
 * First in the hair's front group.
 */
function bareScalp(h: Head, skin: string): Shape {
  const { W, H, shape } = h;
  return S(([[0.18, 0.86], [0.46, 0.62], [0.44, 0.3], [0.26, 0.08], [0.38, 0.24], [0.43, 0.55]] as const).map(([x, y]): Pt => [Math.min(W * x, headHalfWidth(shape, W, H, -H * y) - 0.6), -H * y]),
    skin, { flat: true, stroke: { color: skin, width: 0.3 }, clip: rect(-W, -H * 1.2, W * 2, H * 0.56) });
}

/** The nape of hair pulled up into a tie or a bun: as low as a short cut's, so no undercut shows (the right half, for `capBack`). */
const tiedNape = ({ W, H }: Head): Pt[] => [[W * 0.3, -H * 0.19], [W * 0.12, -H * 0.155], [0, -H * 0.145]];

/** A hanging tail (a ponytail, a pigtail): a band along `spine` with `widths`, and a strand down it. */
function tail(c: string, spine: Vec2[], widths: number[], k: number, fill = c): Shape[] {
  return [
    { path: band(spine, widths, 1), fill },
    strand(spine.slice(1, -1).map(([x, y], i): Vec2 => [x + (i % 2 ? 0.6 : -0.6) * k, y]), tone(c, "deep"), 0.55 * k, 0.45),
  ];
}

/** A round bun at (x, y): the ball, a lighter crescent upper left for its depth and a coiled strand. */
function bun(c: string, x: number, y: number, rx: number, ry: number, k: number): Shape[] {
  return [
    { path: ellipse(x, y, rx, ry), fill: c },
    { path: smooth([[x - rx * 0.78, y - ry * 0.1], [x - rx * 0.45, y - ry * 0.72], [x + rx * 0.1, y - ry * 0.86], [x - rx * 0.3, y - ry * 0.45]], true, 1), fill: tone(c, "light"), flat: true, opacity: 0.4 },
    strand([[x - rx * 0.62, y + ry * 0.2], [x - rx * 0.2, y - ry * 0.5], [x + rx * 0.5, y - ry * 0.35], [x + rx * 0.45, y + ry * 0.35], [x - rx * 0.05, y + ry * 0.5]], tone(c, "deep"), 0.6 * k, 0.55),
  ];
}

/**
 * An elastic round a tail or a bun's foot at `p`, seen from the side: a band `w` across and `t` high,
 * both edges bowed the same way as it wraps round (its near side lower), with a light line along its
 * top. Turned to angle `a` (radians, 0 = across, horizontal).
 */
function tie(c: string, p: Vec2, w: number, t: number, a = 0): Shape[] {
  const cs = Math.cos(a), sn = Math.sin(a), P = (u: number, v: number): Pt => [p[0] + u * cs - v * sn, p[1] + u * sn + v * cs];
  const fill = tieOf(c), bow = t * 0.16;
  return [
    S([[...P(-w / 2, -t / 2), 0] as Pt, P(0, -t / 2 + bow), [...P(w / 2, -t / 2), 0] as Pt, [...P(w / 2, t / 2), 0] as Pt, P(0, t / 2 + bow), [...P(-w / 2, t / 2), 0] as Pt], fill),
    line([P(-w * 0.32, -t * 0.12), P(0, -t * 0.12 + bow * 0.9), P(w * 0.32, -t * 0.12)] as Vec2[], tone(fill, "light"), t * 0.22, 0.55),
  ];
}

// ---- the styles ---------------------------------------------------------------------------------

export const HAIR_PARTS: Record<string, PartDef> = {
  // the default: a plain short cut, the base every short cut here starts from
  hair_short: hairPart("Short", "kısa", (h, c) => {
    const { W, H, k } = h, v = 2.6 * k;
    const front: Group = {
      shapes: [
        S(capFront(h, v, [[W * 0.37, -H * 0.62], [W * 0.26, -H * 0.71], [W * 0.1, -H * 0.745], [-W * 0.03, -H * 0.722, 0], [-W * 0.13, -H * 0.765], [-W * 0.27, -H * 0.745], [-W * 0.37, -H * 0.62]], { burn: 0.41 }), c),
        sheen(h, c, v - 1.2 * k, 1.25, 1.62, 1.4 * k),
        strand([[-W * 0.12, -H * 0.97], [-W * 0.03, -H * 0.86], [W * 0.01, -H * 0.77]], tone(c, "deep"), 0.5 * k, 0.5),
      ],
    };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", { shapes: [S(capBack(h, v), c), ...backDetail(h, c, v)] })] };
  }, { tags: ["casual", "school", "work", "lowmaintenance"], bulk: HAIR_BULK.low }),

  // İsmail's and Reza's: a side part on the wearer's left, the hair combed over, a higher forehead, grey at the temples
  hair_classic: hairPart("Classic", "klasik", (h, c, ctx) => {
    const { W, H, k } = h, grey = greyOf(c), part: Vec2 = [W * 0.2, -H * 0.795];
    // fuller where the hair is combed over to the right, flatter beside the part
    const top = crownBy(h, t => k * (1.8 + 0.9 * Math.sin(PI * Math.min(1, t * 1.15))), PI * 1.02, PI * 1.98, 14);
    const temple = (s: 1 | -1): Shape => S([[s * (W / 2 + 0.95 * k), -H * 0.48, 0], [s * (W / 2 + 1.1 * k), -H * 0.6], [s * (W / 2 - 0.4 * k), -H * 0.68, 0], [s * (W / 2 - 1.8 * k), -H * 0.58], [s * (W / 2 - 1.3 * k), -H * 0.475, 0]], grey, { flat: true, opacity: 0.85 });
    const front: Group = {
      shapes: [
        S(capFront(h, 2 * k, [[W * 0.37, -H * 0.7], [W * 0.29, -H * 0.765], [...part, 0], [W * 0.08, -H * 0.78], [-W * 0.1, -H * 0.765], [-W * 0.26, -H * 0.755], [-W * 0.37, -H * 0.7]], { top, burn: 0.42 }), c),
        temple(1), temple(-1),
        line([part, [W * 0.18, -H * 0.9], [W * 0.15, -H * 1.0]], scalp(c, ctx.skin), 0.45 * k, 0.75),
        strand([[W * 0.13, -H * 0.84], [-W * 0.04, -H * 0.88], [-W * 0.26, -H * 0.82]], tone(c, "deep"), 0.5 * k, 0.5),
        strand([[W * 0.14, -H * 0.94], [-W * 0.08, -H * 0.98], [-W * 0.3, -H * 0.9]], tone(c, "deep"), 0.5 * k, 0.4),
        sheen(h, c, 1, 1.22, 1.5, 1.4 * k),
      ],
    };
    const backG: Group = {
      shapes: [
        S(capBack(h, 2 * k, [[W * 0.3, -H * 0.21], [W * 0.1, -H * 0.18], [0, -H * 0.175]]), c),
        // grey low at the sides and the nape
        ...([1, -1] as const).map(s => S([[s * (W / 2 + 0.9 * k), -H * 0.6], [s * (W / 2 + 0.8 * k), -H * 0.5, 0], [s * (W / 2 - 2.4 * k), -H * 0.47], [s * (W / 2 - 3.2 * k), -H * 0.36, 0], [s * W * 0.3, -H * 0.21, 0], [s * W * 0.31, -H * 0.28], [s * (W / 2 - 5.4 * k), -H * 0.39], [s * (W / 2 - 4.6 * k), -H * 0.51], [s * (W / 2 - 1.4 * k), -H * 0.57]], grey, { flat: true, opacity: 0.75 })),
        ...backDetail(h, c, 2 * k),
      ],
    };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["formal", "work", "classic", "elder"], builds: ["adult", "elder"], bulk: 2, odds: { elder: 2 } }),

  // clippered close: a flat, see-through cap with a faint hairline edge, darkened where it would vanish into the skin
  hair_buzz: hairPart("Buzz cut", "çok kısa", (h, c, ctx) => {
    const { W, H, k } = h, v = 0.6 * k, d = luma(c) - luma(ctx.skin);
    const fill = Math.abs(d) >= 0.16 ? c : luma(ctx.skin) > 0.35 ? mix(c, "#2A2420", 0.42) : mix(c, "#000000", 0.25);
    const hl: Pt[] = [[W * 0.37, -H * 0.65], [W * 0.2, -H * 0.735], [0, -H * 0.745], [-W * 0.2, -H * 0.735], [-W * 0.37, -H * 0.65]];
    const front: Group = {
      shapes: [
        S(capFront(h, v, hl, { burn: 0.43, out: 0.4 * k }), fill, { flat: true, opacity: 0.62 }),
        line(hl as Vec2[], tone(fill, "deep"), 0.45 * k, 0.45),
      ],
    };
    const nape: Pt[] = [[W * 0.3, -H * 0.24], [W * 0.12, -H * 0.2], [0, -H * 0.19]];
    const backG: Group = { shapes: [S(capBack(h, v, nape, { tuck: 4.8 }), fill, { flat: true, opacity: 0.62 }), line([[W * 0.3, -H * 0.24], [0, -H * 0.19], [-W * 0.3, -H * 0.24]], tone(fill, "deep"), 0.4 * k, 0.3)] };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["casual", "sport", "summer", "lowmaintenance"], bulk: 0.6 }),

  // Elif's: a straight bob to the jaw with a blunt fringe; it covers the ears
  hair_bob: hairPart("Bob", "bob", (h, c) => {
    const { W, H, k } = h, v = 3.4 * k;
    const panel: Pt[] = [[W / 2 + 3.7 * k, -H * 0.3], [W / 2 + 3.3 * k, -H * 0.11], [W / 2 + 2 * k, -H * 0.045], [W / 2 - 1.4 * k, -H * 0.035, 0], [W * 0.43, -H * 0.28], [W * 0.43, -H * 0.5], [W * 0.375, -H * 0.665, 0], [W * 0.16, -H * 0.668]];
    const front: Group = {
      shapes: [
        S([...h.crown(v, PI, PI * 2, 14), ...panel, [0, -H * 0.666], ...flipX(panel).reverse()], c),
        strand([[-W * 0.1, -H * 0.98], [-W * 0.15, -H * 0.82], [-W * 0.19, -H * 0.68]], tone(c, "deep"), 0.6 * k, 0.5),
        strand([[W * 0.12, -H * 0.98], [W * 0.18, -H * 0.82], [W * 0.21, -H * 0.68]], tone(c, "deep"), 0.6 * k, 0.5),
        strand([[W * 0.34, -H * 0.8], [W * 0.47, -H * 0.45], [W * 0.5, -H * 0.1]], tone(c, "deep"), 0.6 * k, 0.4),
        sheen(h, c, v - 1.2 * k, 1.28, 1.6, 1.6 * k, 0.5),
      ],
    };
    const outline = (sh: Pt[] = []): Pt[] => mirrored([...h.crown(v, PI * 1.5, PI * 2.08, 7), [W / 2 + 3.8 * k, -H * 0.06], [W / 2 + 2.4 * k, H * 0.03], ...sh, [0, H * 0.04]]).slice(0, -1);
    const backG: Group = { shapes: [S(outline(), c), ...backDetail(h, c, v, 0.02)] };
    return { front: [onHead("hair_back", { shapes: [S(outline(), behind(c))] }), onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["casual", "work", "formal", "school", "medium", "straight", "fringe"], bulk: 3.4 }),

  // straight and long, parted in the middle: the mass behind to mid-back, a lock over each shoulder
  hair_long: hairPart("Long", "uzun", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body, v = 3 * k;
    // the mass fans out a little over the back below the shoulders (an A-line), so it reads as long from the front past the arms
    const hem = below(b, per(b, 0.6, 0.5, 0.3)), end = below(b, per(b, 0.5, 0.42, 0.25)), hw = Math.max(b.shoulderW / 2 + 2 * k, W / 2 + 8.6 * k);
    const mass = mirrored([...h.crown(v, PI * 1.5, PI * 2.1, 7), [W / 2 + 4.2 * k, -H * 0.2], [W / 2 + 5.4 * k, hem * 0.3], [hw + 0.8 * k, hem - 3.5 * k], [hw - 1.2 * k, hem, 0], [hw * 0.5, hem + 0.8 * k], [0, hem + 1.2 * k]]).slice(0, -1);
    const panel: Pt[] = [[W / 2 + 3.8 * k, -H * 0.25], [W / 2 + 3.4 * k, 2 * k, 0], [W * 0.46, 3.8 * k], [W * 0.385, 1.6 * k, 0], [W * 0.4, -H * 0.12], [W * 0.43, -H * 0.4], [W * 0.38, -H * 0.6], [W * 0.22, -H * 0.745], [W * 0.07, -H * 0.795]];
    const cap: Pt[] = [...h.crown(v, PI, PI * 2, 14), ...panel, [0, -H * 0.785, 0], ...flipX(panel).reverse()];
    const lock = (s: 1 | -1): Pt[] => [[s * W * 0.39, -3 * k], [s * (W / 2 + 3.3 * k), -3 * k], [s * (W / 2 + 3.9 * k), end * 0.45], [s * (W / 2 + 2.8 * k), end - 3 * k], [s * (W / 2 + 0.6 * k), end], [s * (W * 0.43), end * 0.62], [s * W * 0.38, end * 0.2]];
    const front: Group = {
      shapes: [
        S(cap, c),
        line([[0, -H * 0.785], [W * 0.012, -H * 0.9], [0, -H * 1.0]], scalp(c, ctx.skin), 0.45 * k, 0.75),
        strand([[W * 0.26, -H * 0.86], [W * 0.42, -H * 0.55], [W * 0.45, -H * 0.05]], tone(c, "deep"), 0.6 * k, 0.5),
        strand([[-W * 0.26, -H * 0.86], [-W * 0.42, -H * 0.55], [-W * 0.45, -H * 0.05]], tone(c, "deep"), 0.6 * k, 0.5),
        sheen(h, c, v - 1.2 * k, 1.25, 1.45, 1.5 * k),
      ],
    };
    const locks: Group = {
      shapes: [1, -1].flatMap(s => [S(toNeck(b, lock(s as 1 | -1)), c), strand(toNeck(b, [[s * W * 0.44, 0], [s * (W / 2 + 0.6 * k), end * 0.5], [s * (W / 2 + 1 * k), end * 0.85]]) as Vec2[], tone(c, "deep"), 0.55 * k, 0.45)]),
    };
    const backG: Group = {
      shapes: [
        S(mass, c),
        strand([[0, -H * 0.97], [W * 0.04, -H * 0.4], [-W * 0.02, hem * 0.9]], tone(c, "deep"), 0.6 * k, 0.5),
        strand([[-W * 0.28, -H * 0.85], [-W * 0.36, -H * 0.2], [-W * 0.34, hem * 0.8]], tone(c, "deep"), 0.6 * k, 0.45),
        strand([[W * 0.28, -H * 0.85], [W * 0.37, -H * 0.2], [W * 0.36, hem * 0.8]], tone(c, "deep"), 0.6 * k, 0.45),
        { ...strand(h.arc(v - 1.2 * k, PI * 1.55, PI * 1.8, 5), tone(c, "light"), 1.5 * k, 0.5) },
      ],
    };
    return { front: [onHead("hair_back", { shapes: [S(mass, behind(c))] }), onHead("hair_front", front), onNeck(locks)], back: [onHead("hair_back", backG), fallOver(backG.shapes.slice(0, 4))] };
  }, { tags: ["casual", "formal", "work", "school", "long", "loose", "straight"], over: ["top", "outer"], bulk: 3 }),

  // a tight bun high on the crown; the hair pulled up, the ears free
  hair_bun: hairPart("Top bun", "topuz", (h, c) => {
    const { W, H, k } = h, v = 1.3 * k, top = -(H * 1.02 + v), rx = W * 0.15, ry = H * 0.12, by = top - ry * 0.62;
    const front: Group = {
      shapes: [
        S(capFront(h, v, [[W * 0.38, -H * 0.66], [W * 0.22, -H * 0.745], [0, -H * 0.765], [-W * 0.22, -H * 0.745], [-W * 0.38, -H * 0.66]], { low: 0.5 }), c),
        strand([[W * 0.3, -H * 0.73], [W * 0.17, -H * 0.9], [W * 0.05, -H * 1.0]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[-W * 0.3, -H * 0.73], [-W * 0.17, -H * 0.9], [-W * 0.05, -H * 1.0]], tone(c, "deep"), 0.5 * k, 0.45),
        sheen(h, c, v - 1 * k, 1.22, 1.42, 1.4 * k),
        ...tie(c, [0, top + 0.1 * k], rx * 1.05, 1.6 * k),
      ],
    };
    const backG: Group = {
      shapes: [
        S(capBack(h, v, tiedNape(h)), c),
        strand([[-W * 0.3, -H * 0.22], [-W * 0.2, -H * 0.7], [-W * 0.05, -H * 1.0]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[W * 0.3, -H * 0.22], [W * 0.2, -H * 0.7], [W * 0.05, -H * 1.0]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[0, -H * 0.17], [W * 0.01, -H * 0.62], [0, -H * 1.0]], tone(c, "deep"), 0.5 * k, 0.4),
        { ...strand(h.arc(v - 1 * k, PI * 1.6, PI * 1.85, 5), tone(c, "light"), 1.4 * k, 0.5) },
      ],
    };
    return {
      front: [onHead("hair_back", { shapes: bun(c, 0, by, rx, ry, k) }), onHead("hair_front", front)],
      back: [onHead("hair_back", backG), onHead("hair_front", { shapes: [...bun(c, 0, by, rx, ry, k), ...tie(c, [0, top + 0.1 * k], rx * 1.05, 1.6 * k)] })],
    };
  }, { tags: ["casual", "work", "sport", "formal", "tied", "updo", "bun"], bulk: 1.5 }),

  // no hair on top: a band from each temple round behind the ears to the nape, and the light on the dome.
  // It is also the look for alopecia and treatment: a plain name, never a joke. Rare among adults, and
  // not drawn for children by the randomiser (a learner may still pick it).
  hair_bald: hairPart("Bald", "kel", (h, c, ctx) => {
    const { W, H, k } = h, dome = tone(ctx.skin, "light");
    const side = (s: 1 | -1): Shape => S([[s * (W / 2 - 0.9 * k), -H * 0.66, 0], [s * (W / 2 + 0.6 * k), -H * 0.57], [s * (W / 2 + 0.4 * k), -H * 0.45, 0], [s * (W / 2 - 1.1 * k), -H * 0.465], [s * (W / 2 - 1.5 * k), -H * 0.56]], c);
    // the band behind the head shows round the ears
    const round: Group = { shapes: [S(mirrored([[0, -H * 0.58], [W / 2 + 0.4 * k, -H * 0.57], [W / 2 + 0.9 * k, -H * 0.42], [W / 2 - 1 * k, -H * 0.31], [0, -H * 0.29]]), behind(c))] };
    const front: Group = { shapes: [bareScalp(h, ctx.skin), side(1), side(-1), line(h.arc(-2.6 * k, PI * 1.24, PI * 1.44, 5), dome, 2.4 * k, 0.5)] };
    // from behind a horseshoe: thin at the temples, deepest at the back, down to the nape with no skin
    // between it and the neck; tucked inside the ears so they show; a softer, thinner edge above it
    const horseshoe = (lift: number): Pt[] => mirrored([[0, -H * (0.43 + lift)], [W * 0.22, -H * (0.45 + lift)], [W * 0.4, -H * (0.52 + lift * 0.6)], [W / 2 + 0.6 * k, -H * 0.62, 0],
      [W / 2 + 0.5 * k, -H * 0.53], [W / 2 - 2.6 * k, -H * 0.47], [W / 2 - 3.2 * k, -H * 0.36], [W * 0.3, -H * 0.2], [W * 0.12, -H * 0.15], [0, -H * 0.14]]);
    const backG: Group = {
      shapes: [
        S(horseshoe(0.035), c, { flat: true, opacity: 0.45 }),
        S(horseshoe(0), c),
        ...([1, -1] as const).map(s => strand([[s * W * 0.06, -H * 0.2], [s * W * 0.1, -H * 0.32], [s * W * 0.14, -H * 0.42]], tone(c, "deep"), 0.5 * k, 0.4)),
        line(h.arc(-2.6 * k, PI * 1.56, PI * 1.76, 5), dome, 2.4 * k, 0.5),
      ],
    };
    return { front: [onHead("hair_back", round), onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["casual", "hairloss", "lowmaintenance"], bulk: 0, odds: { adult: 0.5, child: 0, toddler: 0 } }),

  // Ömer's: uncombed, tufts all round, an uneven fringe and a cowlick (a fixed table, so every backend draws the same)
  hair_messy_short: hairPart("Messy short", "dağınık kısa saç", (h, c, ctx) => {
    const { W, H, k } = h, v = 2.6 * k, b = ctx.body;
    const tufts = b.build === "toddler" ? [1.6, 2.2, 1.4, 2.4, 1.7, 2] : [1.6, 2.2, 1.3, 2.4, 1.8, 1.2, 2.0, 1.5];
    /**
     * Along the crown from a0 to a1, each tuft a point leaning a little to the right; the cowlick is one
     * of them, standing taller and curling over to the wearer's left (+x) near the angle `cow`.
     */
    const crownTufts = (a0: number, a1: number, cow: number): Pt[] => {
      const n = tufts.length, step = (a1 - a0) / n, ci = Math.round((cow - a0) / step - 0.5), out: Pt[] = [crownAt(h, v, a0)];
      tufts.forEach((len, i) => {
        const a = a0 + step * i;
        if (i !== ci) { out.push(crownAt(h, v + 0.3 * k, a + step * 0.35), [...crownAt(h, v + Math.max(1.2, len * k), a + step * 0.78), 0] as Pt, crownAt(h, v - 0.2 * k, a + step)); return; }
        // the cowlick: up from the crown, then over in a hook whose tip points back down to the right
        const base = crownAt(h, v + 0.4 * k, a + step * 0.25), up = crownAt(h, v + 3.4 * k, a + step * 0.55), tip = crownAt(h, v + 3 * k, a + step * 1.25);
        out.push(base, up, [up[0] + (tip[0] - up[0]) * 0.5, up[1] - 0.9 * k], [tip[0], tip[1] + 0.4 * k, 0], crownAt(h, v + 1.6 * k, a + step * 0.85), crownAt(h, v - 0.2 * k, a + step));
      });
      return out;
    };
    const front: Group = {
      shapes: [
        S([[-(W / 2 + v * 0.45), -H * 0.48, 0], ...crownTufts(PI * 1.04, PI * 1.96, PI * 1.6), [W / 2 + v * 0.45, -H * 0.48, 0], [W / 2 - 1 * k, -H * 0.475, 0], [W / 2 - 1.2 * k, -H * 0.41, 0], [W / 2 - 3.1 * k, -H * 0.425, 0],
          [W * 0.37, -H * 0.62], [W * 0.27, -H * 0.66, 0], [W * 0.18, -H * 0.74], [W * 0.05, -H * 0.71, 0], [-W * 0.05, -H * 0.775], [-W * 0.17, -H * 0.645, 0], [-W * 0.27, -H * 0.73], [-W * 0.37, -H * 0.63, 0],
          [-(W / 2 - 3.1 * k), -H * 0.425, 0], [-(W / 2 - 1.2 * k), -H * 0.41, 0], [-(W / 2 - 1 * k), -H * 0.475, 0]], c),
        strand([[-W * 0.2, -H * 0.95], [-W * 0.1, -H * 0.83], [-W * 0.05, -H * 0.75]], tone(c, "deep"), 0.55 * k, 0.5),
        strand([[W * 0.22, -H * 0.93], [W * 0.17, -H * 0.82], [W * 0.2, -H * 0.72]], tone(c, "deep"), 0.55 * k, 0.5),
        sheen(h, c, v - 1.3 * k, 1.24, 1.42, 1.4 * k),
      ],
    };
    const nape: Pt[] = [[W * 0.32, -H * 0.24], [W * 0.26, -H * 0.17, 0], [W * 0.18, -H * 0.22], [W * 0.08, -H * 0.13, 0], [0, -H * 0.19]];
    // the same cowlick from behind, on the same side of the head (+x; the back view is mirrored)
    const backG: Group = {
      shapes: [
        S(capBack(h, v, nape, { top: crownTufts(PI * 0.98, PI * 2.02, PI * 1.62) }), c),
        ...backDetail(h, c, v),
      ],
    };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["casual", "kid", "school"], bulk: 3.5, odds: { child: 1.5, toddler: 1.5 } }),

  // Ömer's longer messy hair ("bed hair" on an adult): a lumpy tousled cap with tufts every which way and a
  // cowlick at the front, a ragged fringe clear of the brows, the sides falling to the jaw with ends sticking
  // out. The tufts are fixed in cm, so they still read on a toddler.
  hair_messy_medium: hairPart("Messy, medium length", "dağınık orta boy saç", (h, c) => {
    const { W, H, k, shape } = h, v = 3.6 * k, hw = (y: number) => headHalfWidth(shape, W, H, -H * y);
    // the tufts: [length cm, lean] along the crown, the lean a share of the step between them (- towards the wearer's right)
    const TUFTS: [number, number][] = [[2.4, -0.5], [3.1, 0.3], [2.2, -0.2], [3.2, 0.6], [2.6, -0.6], [3, 0.4], [2.3, -0.1]];
    const tufted = (a0: number, a1: number, cow = 3): Pt[] => {
      const step = (a1 - a0) / TUFTS.length, out: Pt[] = [crownAt(h, v, a0)];
      TUFTS.forEach(([len, lean], i) => {
        const a = a0 + step * i;
        if (i !== cow) { out.push(crownAt(h, v + 0.4 * k, a + step * 0.3), [...crownAt(h, v + len, a + step * (0.6 + lean * 0.5)), 0] as Pt, crownAt(h, v - 0.3 * k, a + step)); return; }
        // the cowlick: a short spike standing up at the front, its tip curling over towards the wearer's left
        const base = crownAt(h, v + 0.4 * k, a + step * 0.2), up = crownAt(h, v + 3.6, a + step * 0.5), tip = crownAt(h, v + 3.2, a + step * 1.2);
        out.push(base, up, [up[0] + (tip[0] - up[0]) * 0.5, up[1] - 0.9], [tip[0], tip[1] + 0.5, 0], crownAt(h, v + 1.6, a + step * 0.8), crownAt(h, v - 0.3 * k, a + step));
      });
      return out;
    };
    // the sides to the jaw: the outer edge out from the head, ragged ends 1.5 cm out at the bottom, the inner edge beside the cheek
    const sideR: Pt[] = [[W / 2 + v * 0.7, -H * 0.5], [W / 2 + 2.6 * k, -H * 0.3], [hw(0.14) + 3 * k, -H * 0.12], [hw(0.1) + 3.4 * k + 1.5, -H * 0.03, 0], [hw(0.1) + 2.2 * k, -H * 0.1], [hw(0.06) + 1.6 * k, -H * 0.02, 0],
      [hw(0.12) + 0.6 * k, -H * 0.13], [hw(0.06) + 0.2 * k, -H * 0.06, 0], [hw(0.2) + 0.1 * k, -H * 0.22], [hw(0.38) - 0.3 * k, -H * 0.4], [hw(0.56) - 1.4 * k, -H * 0.57, 0]];
    // the ragged fringe, from the wearer's left temple to the right, never below 0.645 H
    const fringe: Pt[] = [[W * 0.37, -H * 0.655], [W * 0.29, -H * 0.72, 0], [W * 0.22, -H * 0.66], [W * 0.12, -H * 0.73, 0], [W * 0.04, -H * 0.65], [-W * 0.06, -H * 0.735, 0], [-W * 0.14, -H * 0.655], [-W * 0.24, -H * 0.725, 0], [-W * 0.31, -H * 0.66], [-W * 0.38, -H * 0.7, 0]];
    const front: Group = {
      shapes: [
        S([...flipX([sideR[0]]), ...tufted(PI * 1.04, PI * 1.96), ...sideR, ...fringe, ...flipX(sideR).reverse().slice(0, -1)], c),
        strand([[-W * 0.22, -H * 0.94], [-W * 0.16, -H * 0.82], [-W * 0.2, -H * 0.72]], tone(c, "deep"), 0.55 * k, 0.5),
        strand([[W * 0.24, -H * 0.92], [W * 0.15, -H * 0.8], [W * 0.17, -H * 0.71]], tone(c, "deep"), 0.55 * k, 0.5),
        strand([[W / 2 + 1 * k, -H * 0.42], [W / 2 + 1.6 * k, -H * 0.24], [hw(0.12) + 2.6 * k, -H * 0.08]], tone(c, "deep"), 0.55 * k, 0.45),
        strand([[-W / 2 - 1 * k, -H * 0.42], [-W / 2 - 1.6 * k, -H * 0.24], [-hw(0.12) - 2.6 * k, -H * 0.08]], tone(c, "deep"), 0.55 * k, 0.45),
        sheen(h, c, v - 1.4 * k, 1.24, 1.42, 1.4 * k),
      ],
    };
    // the mass behind the head, down past the jaw, ragged at its hem
    const massR: Pt[] = [[W / 2 + v * 0.8, -H * 0.4], [W / 2 + 3 * k, -H * 0.12], [W * 0.46 + 1.5, H * 0.04, 0], [W * 0.38, H * 0.0], [W * 0.3, H * 0.05, 0], [W * 0.18, H * 0.02], [0, H * 0.03]];
    const mass = (fill: string): Shape => S([...h.crown(v + 0.3 * k, PI * 1.5, PI * 2.1, 6), ...massR, ...flipX(massR).reverse().slice(1), ...h.crown(v + 0.3 * k, PI * 0.9, PI * 1.5, 6).slice(0, -1)], fill);
    // behind: the tousled mass to the nape, a ragged hem at +0.06 H, three tuft lines
    const hemR: Pt[] = [[W / 2 + v * 0.6, -H * 0.3], [W / 2 + 1.5 * k, -H * 0.04], [W * 0.44, H * 0.08, 0], [W * 0.34, H * 0.02], [W * 0.24, H * 0.09, 0], [W * 0.13, H * 0.03], [W * 0.04, H * 0.1, 0], [-W * 0.06, H * 0.03]];
    const tuftLines = [[[W * 0.2, -H * 0.9], [W * 0.1, -H * 0.6], [W * 0.18, -H * 0.2], [W * 0.26, H * 0.06]], [[-W * 0.04, -H * 0.94], [W * 0.02, -H * 0.5], [-W * 0.04, H * 0.08]], [[-W * 0.24, -H * 0.86], [-W * 0.3, -H * 0.5], [-W * 0.24, H * 0.06]]] as Vec2[][];
    const backG: Group = {
      shapes: [
        S([...tufted(PI * 0.98, PI * 2.02, 3), ...hemR, [-W * 0.16, H * 0.09, 0], [-W * 0.26, H * 0.03], [-W * 0.36, H * 0.085, 0], [-W * 0.45, H * 0.02], [-(W / 2 + 1.5 * k), -H * 0.04], [-(W / 2 + v * 0.6), -H * 0.3]], c),
        { path: tuftLines.reduce((p, q) => p.add(smooth(q, false, 1)), new Path()), stroke: { color: tone(c, "deep"), width: 0.6 * k }, flat: true, opacity: 0.45 },
        { ...strand(h.arc(v - 1.4 * k, PI * 1.55, PI * 1.8, 5), tone(c, "light"), 1.4 * k, 0.5) },
      ],
    };
    return { front: [onHead("hair_back", { shapes: [mass(behind(c))] }), onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["casual", "kids", "school", "medium", "textured"], bulk: 3.6 }),

  // Serkan's: the hairline gone back at the temples (an M), a high forehead, short sides with the ears free
  hair_receding: hairPart("Receding hairline", "alnı açılmış saç", (h, c, ctx) => {
    const { W, H, k } = h, v = 1.8 * k;
    const front: Group = {
      shapes: [
        bareScalp(h, ctx.skin),
        // a deep M: the temples bare far back, a forelock left of centre between them
        S(capFront(h, v, [[W / 2 - 2.8 * k, -H * 0.52], [W * 0.42, -H * 0.66], [W * 0.38, -H * 0.84], [W * 0.3, -H * 0.915, 0], [W * 0.17, -H * 0.86], [W * 0.06, -H * 0.79], [-W * 0.04, -H * 0.76, 0],
          [-W * 0.12, -H * 0.8], [-W * 0.2, -H * 0.87], [-W * 0.3, -H * 0.915, 0], [-W * 0.38, -H * 0.84], [-W * 0.42, -H * 0.66], [-(W / 2 - 2.8 * k), -H * 0.52]], { burn: 0.42 }), c),
        strand([[W * 0.02, -H * 0.8], [W * 0.05, -H * 0.9], [W * 0.03, -H * 0.99]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[-W * 0.14, -H * 0.83], [-W * 0.12, -H * 0.92], [-W * 0.14, -H * 0.99]], tone(c, "deep"), 0.5 * k, 0.45),
        sheen(h, c, v - 1 * k, 1.2, 1.36, 1.3 * k),
      ],
    };
    const backG: Group = {
      shapes: [
        S(capBack(h, v), c),
        // the crown a little thinner
        { path: ellipse(W * 0.04, -H * 0.9, W * 0.12, H * 0.06), fill: scalp(c, ctx.skin), flat: true, opacity: 0.3 },
        ...backDetail(h, c, v),
        strand([[0, -H * 0.8], [W * 0.01, -H * 0.55], [0, -H * 0.3]], tone(c, "deep"), 0.5 * k, 0.4),
      ],
    };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["casual", "work", "hairloss", "elder"], builds: ["adult", "elder"], bulk: 1.8, odds: { adult: 0.5, elder: 1.5 } }),

  // Tolga's gelled hair: combed straight back from a high hairline, one gloss band, a neat straight nape
  hair_slick_back: hairPart("Slicked back", "jöleli geriye taranmış saç", (h, c, ctx) => {
    const { W, H, k } = h, v = 1.6 * k, hl = per(ctx.body, 0.83, 0.78), gloss = tone(c, "light");
    // flat and sleek on top (less bulk over the crown than at the sides), a high bare forehead
    const top = crownBy(h, t => k * (1.6 - 0.6 * Math.sin(PI * t)), PI * 1.02, PI * 1.98, 12);
    const front: Group = {
      shapes: [
        bareScalp(h, ctx.skin),
        S(capFront(h, v, [[W * 0.4, -H * 0.62], [W * 0.38, -H * 0.73], [W * 0.26, -H * (hl - 0.01)], [0, -H * hl], [-W * 0.26, -H * (hl - 0.01)], [-W * 0.38, -H * 0.73], [-W * 0.4, -H * 0.62]], { top, burn: 0.43, out: v * 0.3 }), c),
        // comb lines from the hairline back over the crown
        ...[-0.28, -0.14, 0, 0.14, 0.28].map(x => line([[W * x, -H * (hl + 0.02) + Math.abs(x) * H * 0.12], [W * x * 0.8, -H * 0.93], [W * x * 0.55, -H * 1.0]], gloss, 0.4 * k, 0.5)),
        // the one wide gloss band
        line(h.arc(-0.4 * k, PI * 1.2, PI * 1.44, 6), gloss, 3.4 * k, 0.5),
      ],
    };
    const nape: Pt[] = [[W * 0.32, -H * 0.2, 0], [0, -H * 0.2]];
    const backG: Group = {
      shapes: [
        S(capBack(h, v, nape), c),
        ...[-0.3, -0.15, 0, 0.15, 0.3].map(x => line([[W * x, -H * 0.24], [W * x * 0.7, -H * 0.7], [W * x * 0.2, -H * 1.0]], gloss, 0.4 * k, 0.3)),
        line(h.arc(-0.4 * k, PI * 1.56, PI * 1.8, 6), gloss, 3.4 * k, 0.5),
      ],
    };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["formal", "work", "istanbul"], builds: ["adult", "elder", "child"], bulk: 1.6, odds: { child: 0.3 } }),

  // Gülten's: the blow-dried set from the hairdresser: soft lobes round the crown, a fringe swept to one side, over the ears' tops
  hair_set_short: hairPart("Short set (blow-dried)", "fönlü kısa saç", (h, c) => {
    const { W, H, k } = h, v = 3.8 * k, light = tone(c, "light");
    /** The crown in `n` soft lobes from a0 to a1, each dipping to a corner where it meets the next. */
    const lobes = (a0: number, a1: number, n: number): Pt[] => {
      const out: Pt[] = [], s = (a1 - a0) / n;
      for (let i = 0; i < n; i++) out.push([...crownAt(h, v - 0.5 * k, a0 + s * i), 0] as Pt, crownAt(h, v + 0.5 * k, a0 + s * (i + 0.3)), crownAt(h, v + 0.5 * k, a0 + s * (i + 0.7)));
      out.push([...crownAt(h, v - 0.5 * k, a1), 0] as Pt);
      return out;
    };
    const side: Pt[] = [[W / 2 + 3.4 * k, -H * 0.55], [W / 2 + 2.8 * k, -H * 0.42], [W / 2 + 1.6 * k, -H * 0.39, 0], [W / 2 - 2.4 * k, -H * 0.4, 0], [W * 0.42, -H * 0.56]];
    const front: Group = {
      shapes: [
        S([...lobes(PI * 0.96, PI * 2.04, 8), ...side, [W * 0.36, -H * 0.66], [W * 0.24, -H * 0.755], [W * 0.1, -H * 0.73], [-W * 0.08, -H * 0.685], [-W * 0.22, -H * 0.675], [-W * 0.33, -H * 0.7], ...flipX(side).reverse()], c),
        strand([[W * 0.3, -H * 0.8], [W * 0.12, -H * 0.76], [-W * 0.1, -H * 0.72], [-W * 0.28, -H * 0.74]], tone(c, "deep"), 0.6 * k, 0.5),
        ...[1.2, 1.32, 1.44].map(a => line(h.arc(v - 0.6 * k, PI * a, PI * (a + 0.07), 3), light, 1.4 * k, 0.5)),
      ],
    };
    const backG: Group = {
      shapes: [
        S([...lobes(PI * 0.96, PI * 2.04, 8), [W / 2 + 3 * k, -H * 0.4], [W / 2 + 1.6 * k, -H * 0.3], [W * 0.3, -H * 0.2], [0, -H * 0.18], [-W * 0.3, -H * 0.2], [-(W / 2 + 1.6 * k), -H * 0.3], [-(W / 2 + 3 * k), -H * 0.4]], c),
        strand([[-W * 0.2, -H * 0.9], [-W * 0.26, -H * 0.55], [-W * 0.2, -H * 0.26]], tone(c, "deep"), 0.6 * k, 0.4),
        strand([[W * 0.18, -H * 0.92], [W * 0.24, -H * 0.55], [W * 0.18, -H * 0.24]], tone(c, "deep"), 0.6 * k, 0.4),
        ...[1.56, 1.68, 1.8].map(a => line(h.arc(v - 0.6 * k, PI * a, PI * (a + 0.07), 3), light, 1.4 * k, 0.5)),
      ],
    };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["casual", "formal", "elder", "istanbul"], builds: ["adult", "elder"], bulk: 4.4, odds: { adult: 0.3, elder: 2 } }),

  // Parvaneh's: pulled up into a high tail that arches over and falls on the wearer's left
  hair_ponytail_high: hairPart("High ponytail", "yüksek at kuyruğu", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body, v = 1.4 * k, top = -(H * 1.02 + v), end = below(b, per(b, 0.35, 0.3, 0.2)), f = per(b, 1, 1, 0.8);
    const spine: Vec2[] = [[0, top - 1 * k], [W * 0.14, top - 3.6 * k], [W * 0.36, top - 1.8 * k], [W * 0.54, -H * 0.78], [W * 0.62, -H * 0.5], [W * 0.6, -H * 0.18], [W * 0.54, end]];
    const widths = [0.15, 0.19, 0.22, 0.25, 0.25, 0.18, 0.06].map(x => x * W * f);
    const front: Group = {
      shapes: [
        S(capFront(h, v, [[W * 0.38, -H * 0.66], [W * 0.22, -H * 0.745], [W * 0.02, -H * 0.765, 0], [-W * 0.22, -H * 0.745], [-W * 0.38, -H * 0.66]], { low: 0.5 }), c),
        line([[W * 0.02, -H * 0.765], [W * 0.015, -H * 0.88], [0, -H * 1.0]], scalp(c, ctx.skin), 0.4 * k, 0.6),
        strand([[W * 0.3, -H * 0.72], [W * 0.17, -H * 0.9], [W * 0.05, -H * 1.0]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[-W * 0.3, -H * 0.72], [-W * 0.17, -H * 0.9], [-W * 0.05, -H * 1.0]], tone(c, "deep"), 0.5 * k, 0.45),
        sheen(h, c, v - 1 * k, 1.22, 1.42, 1.4 * k),
        // across the tail's root, which leaves the crown up and to the wearer's left
        ...tie(c, [W * 0.06, top - 2.2 * k], W * 0.16 * f, 2 * k, Math.atan2(spine[1][1] - spine[0][1], spine[1][0] - spine[0][0]) + PI / 2),
      ],
    };
    const backSpine: Vec2[] = [[0, top - 0.6 * k], [W * 0.02, -H * 0.86], [W * 0.035, -H * 0.4], [W * 0.02, end * 0.5], [0, end + 1.5 * k]];
    const backG: Group = {
      shapes: [
        S(capBack(h, v, tiedNape(h)), c),
        strand([[-W * 0.3, -H * 0.22], [-W * 0.2, -H * 0.7], [-W * 0.04, -H * 0.98]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[W * 0.3, -H * 0.22], [W * 0.2, -H * 0.7], [W * 0.04, -H * 0.98]], tone(c, "deep"), 0.5 * k, 0.45),
      ],
    };
    return {
      front: [onHead("hair_back", { shapes: tail(c, spine, widths, k, behind(c)) }), onHead("hair_front", front)],
      back: [onHead("hair_back", backG), onHead("hair_front", { shapes: [...tail(c, backSpine, [0.24, 0.3, 0.29, 0.22, 0.07].map(x => x * W * f), k), ...tie(c, [0, top + 0.6 * k], W * 0.11, 1.8 * k)] })],
    };
  }, { tags: ["casual", "sport", "work", "school", "long", "tied"], over: ["top", "outer"], bulk: 1.5 }),

  // Maria Teyze's: smoothed back from a side part, soft waves over the ears' tops, lighter wisps at the temples, a round bun pinned high at the back
  hair_bun_pinned: hairPart("Pinned bun", "firketeli topuz", (h, c, ctx) => {
    const { W, H, k } = h, v = 2 * k, top = -(H * 1.02 + v), rx = W * 0.18, ry = H * 0.13, by = top - 6 * k + ry, wisp = greyOf(c), pin = pinOf(c);
    const side = (s: 1 | -1): Pt[] => [[s * (W / 2 + 3 * k), -H * 0.62], [s * (W / 2 + 2 * k), -H * 0.52], [s * (W / 2 + 2.2 * k), -H * 0.45], [s * (W / 2 + 0.8 * k), -H * 0.41], [s * (W / 2 - 2.4 * k), -H * 0.435, 0], [s * W * 0.42, -H * 0.55], [s * W * 0.4, -H * 0.63]];
    const front: Group = {
      shapes: [
        S([...h.crown(v, PI * 1.0, PI * 2.0, 12), ...side(1), [W * 0.28, -H * 0.7], [W * 0.08, -H * 0.742], [-W * 0.12, -H * 0.75, 0], [-W * 0.26, -H * 0.72], ...side(-1).reverse()], c),
        line([[-W * 0.12, -H * 0.75], [-W * 0.11, -H * 0.88], [-W * 0.09, -H * 1.0]], scalp(c, ctx.skin), 0.4 * k, 0.6),
        // the waves smoothed back from the part, and the lighter wisps at the temples
        strand(wavy([W * 0.0, -H * 0.87], [W * 0.45, -H * 0.62], 3, 0.6 * k), tone(c, "deep"), 0.55 * k, 0.45),
        strand(wavy([-W * 0.2, -H * 0.89], [-W * 0.45, -H * 0.62], 3, 0.6 * k), tone(c, "deep"), 0.55 * k, 0.45),
        ...([1, -1] as const).map(s => S([[s * W * 0.41, -H * 0.64, 0], [s * (W / 2 + 1 * k), -H * 0.57], [s * (W / 2 + 1 * k), -H * 0.48], [s * (W / 2 - 0.2 * k), -H * 0.445, 0], [s * (W / 2 - 1 * k), -H * 0.5], [s * W * 0.445, -H * 0.58]], wisp, { flat: true, opacity: 0.8 })),
        sheen(h, c, v - 1 * k, 1.24, 1.42, 1.4 * k),
      ],
    };
    const backG: Group = {
      shapes: [
        S([...h.crown(v, PI * 0.98, PI * 2.02, 12), [W / 2 + 2.6 * k, -H * 0.44], [W / 2 + 1 * k, -H * 0.38], [W / 2 - 3 * k, -H * 0.33], [W * 0.3, -H * 0.19], [W * 0.12, -H * 0.155], [0, -H * 0.145],
          [-W * 0.12, -H * 0.155], [-W * 0.3, -H * 0.19], [-(W / 2 - 3 * k), -H * 0.33], [-(W / 2 + 1 * k), -H * 0.38], [-(W / 2 + 2.6 * k), -H * 0.44]], c),
        // the hair swept up into the bun
        strand([[-W * 0.36, -H * 0.36], [-W * 0.22, -H * 0.62], [-W * 0.08, -H * 0.86]], tone(c, "deep"), 0.55 * k, 0.45),
        strand([[W * 0.36, -H * 0.36], [W * 0.22, -H * 0.62], [W * 0.08, -H * 0.86]], tone(c, "deep"), 0.55 * k, 0.45),
        strand([[0, -H * 0.17], [W * 0.02, -H * 0.55], [0, -H * 0.84]], tone(c, "deep"), 0.55 * k, 0.4),
        ...([1, -1] as const).map(s => S([[s * (W / 2 + 2 * k), -H * 0.6, 0], [s * (W / 2 + 2.4 * k), -H * 0.46], [s * (W / 2 + 0.8 * k), -H * 0.39, 0], [s * (W / 2 - 1 * k), -H * 0.47]], wisp, { flat: true, opacity: 0.7 })),
      ],
    };
    const pins = (sh: number) => [-0.5, 0, 0.5].map(t => line([[t * rx, by + ry * 0.92 + sh], [t * rx * 1.25, by + ry * 0.55 + sh]], pin, 0.55 * k, 0.9));
    return {
      front: [onHead("hair_back", { shapes: bun(c, 0, by, rx, ry, k) }), onHead("hair_front", front)],
      back: [onHead("hair_back", backG), onHead("hair_front", { shapes: [...bun(c, 0, by, rx, ry, k), ...pins(0)] })],
    };
  }, { tags: ["casual", "formal", "traditional", "tied", "bun", "updo"], builds: ["adult", "elder"], bulk: 2, odds: { adult: 0.4, elder: 2 } }),

  // Farzad's: a smooth cap combed back from a centre part, the ears free, a bun low at the nape. From the
  // front the bun is behind the head and neck, so only a crescent of it shows past each side of the neck
  hair_bun_low: hairPart("Low bun", "alçak topuz", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body, v = 1.3 * k, part: Vec2 = [W * 0.02, -H * 0.765];
    const front: Group = {
      shapes: [
        S(capFront(h, v, [[W * 0.38, -H * 0.66], [W * 0.22, -H * 0.745], [...part, 0], [-W * 0.22, -H * 0.745], [-W * 0.38, -H * 0.66]], { low: 0.5 }), c),
        line([part, [W * 0.015, -H * 0.88], [0, -H * 1.0]], scalp(c, ctx.skin), 0.4 * k, 0.6),
        // combed straight back from the part
        strand([[W * 0.32, -H * 0.7], [W * 0.2, -H * 0.86], [W * 0.08, -H * 0.99]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[-W * 0.32, -H * 0.7], [-W * 0.2, -H * 0.86], [-W * 0.08, -H * 0.99]], tone(c, "deep"), 0.5 * k, 0.45),
        sheen(h, c, v - 1 * k, 1.22, 1.42, 1.4 * k),
      ],
    };
    // the bun behind the neck in front view: wider than the neck, so its sides show (on a child the neck is short and it nearly rests on the shoulders)
    const peek: Group = { shapes: [{ path: ellipse(0, H * 0.1, b.neckW / 2 + 3 * k, H * 0.085), fill: behind(c) }] };
    const rx = W * 0.17, ry = H * 0.12, by = -H * 0.12;
    const backG: Group = {
      shapes: [
        S(capBack(h, v, tiedNape(h)), c),
        strand([[-W * 0.3, -H * 0.24], [-W * 0.18, -H * 0.62], [-W * 0.06, -H * 0.98]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[W * 0.3, -H * 0.24], [W * 0.18, -H * 0.62], [W * 0.06, -H * 0.98]], tone(c, "deep"), 0.5 * k, 0.45),
        { ...strand(h.arc(v - 1 * k, PI * 1.6, PI * 1.85, 5), tone(c, "light"), 1.4 * k, 0.5) },
      ],
    };
    return {
      front: [onHead("hair_back", peek), onHead("hair_front", front)],
      // the bun over the collar: hair_front comes after the outer layer from behind
      back: [onHead("hair_back", backG), onHead("hair_front", { shapes: [...bun(c, 0, by, rx, ry, k), ...tie(c, [0, by - ry * 0.95], rx * 0.9, 1.5 * k)] })],
    };
  }, { tags: ["casual", "work", "formal", "tied", "updo", "bun", "elder"], builds: ["adult", "elder", "child"], bulk: 1.4 }),

  // the everyday low ponytail: a centre part, the ears free; from the front the tail shows past one side of the neck
  hair_ponytail_low: hairPart("Low ponytail", "alçak at kuyruğu", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body, v = 1.3 * k, part: Vec2 = [W * 0.02, -H * 0.765], f = per(b, 1, 1, 0.8);
    const front: Group = {
      shapes: [
        S(capFront(h, v, [[W * 0.38, -H * 0.66], [W * 0.22, -H * 0.745], [...part, 0], [-W * 0.22, -H * 0.745], [-W * 0.38, -H * 0.66]], { low: 0.5 }), c),
        line([part, [W * 0.015, -H * 0.88], [0, -H * 1.0]], scalp(c, ctx.skin), 0.4 * k, 0.6),
        strand([[W * 0.32, -H * 0.7], [W * 0.2, -H * 0.86], [W * 0.08, -H * 0.99]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[-W * 0.32, -H * 0.7], [-W * 0.2, -H * 0.86], [-W * 0.08, -H * 0.99]], tone(c, "deep"), 0.5 * k, 0.45),
        sheen(h, c, v - 1 * k, 1.22, 1.42, 1.4 * k),
      ],
    };
    // the plume behind the neck, leaning to the viewer's left (-x) and over the shoulder
    const nx = b.neckW / 2, tip = below(b, per(b, 0.3, 0.3, 0.2));
    const plume: Vec2[] = [[-nx * 0.2, -H * 0.12], [-nx - 1.5 * k, H * 0.02], [-nx - 3 * k, tip * 0.55], [-nx - 2.2 * k, tip]];
    const backSpine: Vec2[] = [[0, -H * 0.14], [W * 0.02, -H * 0.02], [W * 0.015, below(b, per(b, 0.2, 0.18, 0.1))], [0, below(b, per(b, 0.45, 0.3, 0.2))]];
    const backG: Group = {
      shapes: [
        S(capBack(h, v, tiedNape(h)), c),
        strand([[-W * 0.3, -H * 0.24], [-W * 0.18, -H * 0.62], [-W * 0.06, -H * 0.98]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[W * 0.3, -H * 0.24], [W * 0.18, -H * 0.62], [W * 0.06, -H * 0.98]], tone(c, "deep"), 0.5 * k, 0.45),
        { ...strand(h.arc(v - 1 * k, PI * 1.6, PI * 1.85, 5), tone(c, "light"), 1.4 * k, 0.5) },
      ],
    };
    return {
      front: [onHead("hair_back", { shapes: tail(c, plume, [0.12, 0.2, 0.18, 0.05].map(x => x * W * f), k, behind(c)) }), onHead("hair_front", front)],
      back: [onHead("hair_back", backG), onHead("hair_front", { shapes: [...tail(c, backSpine, [0.2, 0.24, 0.2, 0.06].map(x => x * W * f), k), ...tie(c, [0, -H * 0.14], W * 0.13 * f, 1.6 * k)] })],
    };
  }, { tags: ["casual", "work", "formal", "sport", "long", "tied"], over: ["top", "outer"], bulk: 1.4 }),

  // the barber's everyday cut: short on top with some lift, the sides fading out in three steps above the ears
  hair_fade_mid: hairPart("Mid fade", "orta geçişli kesim", (h, c) => {
    // the faded hair a little deeper than the top, so it shows on light hair over light skin too
    const stubble = mix(c, tone(c, "deep"), 0.45);
    const { W, H, k, shape } = h, out = (y: number) => headHalfWidth(shape, W, H, -H * y), hw = (y: number) => out(y) + 0.35 * k;
    // a squared-off top with real lift: the one short cut here whose crown stands up
    const lift = (t: number) => k * (0.8 + 3.4 * Math.pow(Math.sin(PI * t), 0.55));
    // the solid top ends at -0.62 H on the sides; a choppy fringe pushed forward
    const side: Pt[] = [[W / 2 + 0.5 * k, -H * 0.62, 0], [W / 2 - 2.4 * k, -H * 0.645], [W * 0.38, -H * 0.685]];
    const front: Group = {
      shapes: [
        S([...flipX(side.slice(0, 1)), ...crownBy(h, lift, PI * 1.04, PI * 1.96, 14), ...side, [W * 0.3, -H * 0.725], [W * 0.2, -H * 0.705, 0], [W * 0.1, -H * 0.76], [0, -H * 0.72, 0], [-W * 0.1, -H * 0.765], [-W * 0.2, -H * 0.73, 0], [-W * 0.3, -H * 0.75], ...flipX(side.slice(1)).reverse()], c),
        // the fade: three flat layers stacked from the solid edge down, each ending lower, so the hair thins out towards the ear's top
        ...([1, -1] as const).flatMap(s => [0.585, 0.545, 0.5].map(y => S([[s * hw(0.655), -H * 0.655], [s * hw(y), -H * y, 0], [s * (hw(y) - 1.6 * k), -H * (y - 0.006)], [s * (hw(y + 0.04) - 2.8 * k), -H * (y + 0.04)], [s * (hw(0.64) - 2.8 * k), -H * 0.64, 0]], stubble, { flat: true, opacity: 0.42 }))),
        strand([[-W * 0.18, -H * 1.0], [-W * 0.06, -H * 0.88], [W * 0.0, -H * 0.77]], tone(c, "deep"), 0.55 * k, 0.5),
        strand([[W * 0.1, -H * 1.03], [W * 0.17, -H * 0.9], [W * 0.17, -H * 0.77]], tone(c, "deep"), 0.55 * k, 0.5),
        sheen(h, c, 1.4 * k, 1.22, 1.45, 1.5 * k),
      ],
    };
    // from behind: the solid top ends in a soft curve at -0.6 H, and the fade wraps the head below it
    // in four see-through layers, each lower in the middle than at the sides, down to -0.34 H. Their
    // sides follow the head's outline and stay inside the ears.
    const ear = h.ear(1), inner = ear.c[0] - ear.rx - 1 * k, earTop = -ear.top[1] / H + 0.08;
    // the side runs down the outline, then slants in to clear the ear (a polyline: a smoothed curve would bulge over the ear)
    const edge = (y: number): Pt => {
      const t = Math.min(1, Math.max(0, (earTop - y) / 0.1));
      return [Math.min(out(y) + 0.1 * k, (out(y) + 0.1 * k) * (1 - t) + inner * t), -H * y, 0];
    };
    const layer = (ys: number, ym: number): Shape => {
      const down: Pt[] = [];
      for (let y = 0.68; y > ys + 0.02; y -= 0.04) down.push(edge(y));
      const right: Pt[] = [[0, -H * 0.7], [W * 0.3, -H * 0.7], ...down, edge(ys), [W * 0.24, -H * (ym + (ys - ym) * 0.45)], [0, -H * ym]];
      return S([...right, ...flipX(right.slice(1, -1)).reverse()], stubble, { flat: true, opacity: 0.3 });
    };
    const backG: Group = {
      shapes: [
        S([[...crownAt(h, lift(0), PI), 0] as Pt, ...crownBy(h, lift, PI * 1.04, PI * 1.96, 14), [...crownAt(h, lift(0), PI * 2), 0] as Pt, [W * 0.26, -H * 0.59], [0, -H * 0.58], [-W * 0.26, -H * 0.59]], c),
        layer(0.57, 0.56), layer(0.52, 0.5), layer(0.47, 0.44), layer(0.41, 0.35),
        ...backDetail(h, c, 2.4 * k, 0.62).slice(0, 2),
        { ...strand(h.arc(1.6 * k, PI * 1.55, PI * 1.8, 5), tone(c, "light"), 1.4 * k, 0.5) },
      ],
    };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["casual", "work", "sport", "barber", "trend"], builds: ["adult", "elder", "child"], bulk: 3, odds: { elder: 0.4 } }),

  // short and tapered, a soft fringe swept from a side part towards the wearer's left; the ears free
  hair_pixie: hairPart("Pixie", "pixie kesim", (h, c, ctx) => {
    const { W, H, k } = h, fr = per(ctx.body, 0.6, 0.64);
    const top = crownBy(h, t => k * (1.2 + 1.3 * Math.sin(PI * t)), PI * 1.03, PI * 1.97, 14);
    const front: Group = {
      shapes: [
        // a long fringe swept from the part down across the forehead, its point on the brow's outer end
        S(capFront(h, 1.8 * k, [[W * 0.41, -H * 0.6], [W * 0.38, -H * (fr - 0.07), 0], [W * 0.27, -H * (fr + 0.01)], [W * 0.1, -H * (fr + 0.07)], [-W * 0.15, -H * 0.765, 0], [-W * 0.28, -H * 0.745], [-W * 0.38, -H * 0.64]], { top, burn: 0.42, out: 0.6 * k }), c),
        line([[-W * 0.15, -H * 0.765], [-W * 0.13, -H * 0.88], [-W * 0.1, -H * 0.98]], scalp(c, ctx.skin), 0.4 * k, 0.6),
        strand([[-W * 0.1, -H * 0.84], [W * 0.12, -H * 0.76], [W * 0.33, -H * (fr - 0.02)]], tone(c, "deep"), 0.55 * k, 0.5),
        strand([[-W * 0.04, -H * 0.94], [W * 0.18, -H * 0.88], [W * 0.36, -H * 0.72]], tone(c, "deep"), 0.55 * k, 0.4),
        sheen(h, c, 1.2 * k, 1.22, 1.42, 1.4 * k),
      ],
    };
    const nape: Pt[] = [[W / 2 - 3.4 * k, -H * 0.3, 0], [W * 0.26, -H * 0.36], [W * 0.1, -H * 0.3], [0, -H * 0.26, 0]];
    const backG: Group = { shapes: [S(capBack(h, 1.8 * k, nape), c), ...backDetail(h, c, 1.8 * k, 0.36)] };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", backG)] };
  }, { tags: ["casual", "work", "trend"], builds: ["adult", "elder", "child"], bulk: 2 }),

  // straight to the shoulders, parted in the middle, tucked behind the ears (they show, front and back)
  hair_shoulder: hairPart("Shoulder-length", "omuz hizasında saç", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body, v = 2.5 * k;
    const hem = below(b, per(b, 0.06, 0.04, 0)), hm = Math.max(b.shoulderW / 2 + 1 * k, W / 2 + 2 * k);
    const fall: Pt[] = [[hm + 0.4 * k, hem * 0.4 - 2 * k], [hm + 1.6 * k, hem - 1.6 * k], [hm - 0.6 * k, hem, 0], [hm * 0.5, hem + 0.6 * k], [0, hem + 0.8 * k]];
    const mass = (tuck: boolean): Pt[] => mirrored([...h.crown(v, PI * 1.5, PI * 2.1, 7),
      ...(tuck ? [[W / 2 + 0.8 * k, -H * 0.48], [W / 2 + 0.8 * k, -H * 0.36], [W / 2 + 3.4 * k, -H * 0.24]] as Pt[] : [[W / 2 + 3.8 * k, -H * 0.3]] as Pt[]), ...fall]).slice(0, -1);
    const panel: Pt[] = [[W / 2 + 2.8 * k, -H * 0.44, 0], [W / 2 - 0.6 * k, -H * 0.53], [W / 2 - 3.8 * k, -H * 0.45, 0], [W * 0.42, -H * 0.6], [W * 0.3, -H * 0.72], [W * 0.08, -H * 0.79]];
    const front: Group = {
      shapes: [
        S([...h.crown(v, PI * 1.02, PI * 1.98, 12), ...panel, [0, -H * 0.785, 0], ...flipX(panel).reverse()], c),
        line([[0, -H * 0.785], [W * 0.012, -H * 0.9], [0, -H * 1.0]], scalp(c, ctx.skin), 0.45 * k, 0.75),
        strand([[W * 0.24, -H * 0.88], [W * 0.38, -H * 0.7], [W * 0.44, -H * 0.54]], tone(c, "deep"), 0.55 * k, 0.45),
        strand([[-W * 0.24, -H * 0.88], [-W * 0.38, -H * 0.7], [-W * 0.44, -H * 0.54]], tone(c, "deep"), 0.55 * k, 0.45),
        sheen(h, c, v - 1.2 * k, 1.25, 1.45, 1.5 * k),
      ],
    };
    const backG: Group = {
      shapes: [
        S(mass(true), c),
        strand([[0, -H * 0.96], [W * 0.04, -H * 0.4], [0, hem * 0.9]], tone(c, "deep"), 0.6 * k, 0.5),
        { ...strand(h.arc(v - 1.2 * k, PI * 1.55, PI * 1.8, 5), tone(c, "light"), 1.5 * k, 0.5) },
      ],
    };
    return { front: [onHead("hair_back", { shapes: [S(mass(false), behind(c))] }), onHead("hair_front", front)], back: [onHead("hair_back", backG), fallOver(backG.shapes.slice(0, 2))] };
  }, { tags: ["casual", "work", "formal", "school", "medium", "straight"], bulk: 2.5 }),

  // long and wavy: an off-centre part on the wearer's left, S-curved edges, a wavy lock over each shoulder
  hair_wavy_long: hairPart("Long, wavy", "uzun dalgalı saç", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body, v = 3.4 * k, amp = W * 0.04;
    const hem = below(b, per(b, 0.6, 0.5, 0.3)), end = below(b, per(b, 0.5, 0.42, 0.25)), hw = Math.max(b.shoulderW / 2, W / 2 + 3.5 * k);
    const side = (s: 1 | -1): Pt[] => wavy([s * (W / 2 + 4.6 * k), -H * 0.3], [s * (hw + 1 * k), hem - 4 * k], 5, s * amp, 10);
    const hemPts = wavy([hw - 1 * k, hem], [-(hw - 1 * k), hem], 3, -1.1 * k, 6);
    const mass: Pt[] = [...h.crown(v, PI * 0.92, PI * 2.08, 8), ...side(1), ...hemPts, ...side(-1).reverse()];
    // in front its top is hidden by the head and the cap, so it is cut straight across there (fewer points)
    const massFront: Pt[] = [[-(W / 2 + 2 * k), -H * 0.72, 0], [W / 2 + 2 * k, -H * 0.72, 0], ...side(1), ...hemPts, ...side(-1).reverse()];
    const part = W * 0.12;
    const panel = (s: 1 | -1): Pt[] => [[s * (W / 2 + 4 * k), -H * 0.28], [s * (W / 2 + 3.4 * k), 2 * k, 0], [s * W * 0.46, 3.8 * k], [s * W * 0.385, 1.6 * k, 0],
      ...wavy([s * W * 0.4, -H * 0.08], [s * W * 0.41, -H * 0.56], 2, s * 0.8 * k, 4), [s * W * 0.34, -H * 0.66], [s * W * 0.2, -H * 0.75]];
    const cap: Pt[] = [...h.crown(v, PI, PI * 2, 8), ...panel(1), [part, -H * 0.79, 0], ...panel(-1).reverse()];
    const lock = (s: 1 | -1): Pt[] => [[s * W * 0.39, -3 * k], [s * (W / 2 + 3.4 * k), -3 * k],
      ...wavy([s * (W / 2 + 3.6 * k), end * 0.1], [s * (W / 2 + 2.4 * k), end - 3 * k], 3, -s * amp * 0.8, 6), [s * (W / 2 + 0.4 * k), end],
      [s * W * 0.43, end * 0.62], [s * W * 0.38, end * 0.2]];
    const light = tone(c, "light");
    const front: Group = {
      shapes: [
        S(cap, c),
        line([[part, -H * 0.79], [part * 0.9, -H * 0.9], [part * 0.7, -H * 1.0]], scalp(c, ctx.skin), 0.45 * k, 0.75),
        strand(wavy([-W * 0.36, -H * 0.8], [-W * 0.48, -H * 0.05], 3, 0.8 * k, 5), light, 0.9 * k, 0.45),
        strand(wavy([W * 0.36, -H * 0.82], [W * 0.49, -H * 0.05], 3, 0.8 * k, 5), tone(c, "deep"), 0.6 * k, 0.45),
        sheen(h, c, v - 1.2 * k, 1.25, 1.42, 1.5 * k),
      ],
    };
    const locks: Group = {
      // one strand, on the lit lock only (the picture stays inside the head budget)
      shapes: [S(toNeck(b, lock(1)), c), S(toNeck(b, lock(-1)), c), strand(toNeck(b, wavy([-W * 0.44, 0], [-(W / 2 + 1 * k), end * 0.85], 3, amp * 0.8, 6)) as Vec2[], light, 0.6 * k, 0.45)],
    };
    const backG: Group = {
      shapes: [
        S(mass, c),
        ...[-0.3, 0, 0.3].map((x, i) => strand(wavy([W * x * 0.8, -H * 0.85], [W * x, hem * 0.85], 5, 0.9 * k, 10, i), i === 2 ? light : tone(c, "deep"), 0.6 * k, 0.45)),
        { ...strand(h.arc(v - 1.2 * k, PI * 1.55, PI * 1.8, 5), light, 1.5 * k, 0.5) },
      ],
    };
    return { front: [onHead("hair_back", { shapes: [S(massFront, behind(c))] }), onHead("hair_front", front), onNeck(locks)], back: [onHead("hair_back", backG), fallOver(backG.shapes.slice(0, 4))] };
  }, { tags: ["casual", "formal", "long", "wavy", "loose"], over: ["top", "outer"], bulk: 3.5 }),

  // two tails tied high at the sides, arching out and down: the children's classic
  hair_pigtails: hairPart("Pigtails", "iki at kuyruğu", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body, v = 1.5 * k, end = below(b, per(b, 0.2, 0.15, 0.1));
    const spine = (s: 1 | -1): Vec2[] => [[s * W * 0.44, -H * 0.8], [s * W * 0.6, -H * 0.74], [s * W * 0.69, -H * 0.5], [s * W * 0.68, -H * 0.18], [s * W * 0.62, end]];
    const widths = [0.1, 0.16, 0.2, 0.15, 0.05].map(x => x * W);
    const ties = (): Shape[] => ([1, -1] as const).flatMap(s => {
      const p: Vec2 = [s * W * 0.49, -H * 0.785];
      return [...tie(c, p, W * 0.12, 1.8 * k, s * 0.35 + PI / 2), { path: ellipse(p[0] + s * 0.4 * k, p[1] - 1.6 * k, 1.5 * k, 1.5 * k), fill: tieOf(c) }];
    });
    const front: Group = {
      shapes: [
        S(capFront(h, v, [[W * 0.38, -H * 0.66], [W * 0.2, -H * 0.735], [0, -H * 0.75, 0], [-W * 0.2, -H * 0.735], [-W * 0.38, -H * 0.66]], { low: 0.5 }), c),
        line([[0, -H * 0.75], [W * 0.01, -H * 0.88], [0, -H * 1.0]], scalp(c, ctx.skin), 0.45 * k, 0.7),
        strand([[W * 0.1, -H * 0.98], [W * 0.3, -H * 0.9], [W * 0.42, -H * 0.8]], tone(c, "deep"), 0.5 * k, 0.45),
        strand([[-W * 0.1, -H * 0.98], [-W * 0.3, -H * 0.9], [-W * 0.42, -H * 0.8]], tone(c, "deep"), 0.5 * k, 0.45),
        sheen(h, c, v - 1 * k, 1.24, 1.42, 1.4 * k),
        ...ties(),
      ],
    };
    const backG: Group = {
      shapes: [
        S(capBack(h, v, tiedNape(h)), c),
        line([[0, -H * 0.16], [W * 0.01, -H * 0.6], [0, -H * 1.02]], scalp(c, ctx.skin), 0.45 * k, 0.7),
        strand([[W * 0.1, -H * 0.4], [W * 0.3, -H * 0.6], [W * 0.42, -H * 0.78]], tone(c, "deep"), 0.5 * k, 0.4),
        strand([[-W * 0.1, -H * 0.4], [-W * 0.3, -H * 0.6], [-W * 0.42, -H * 0.78]], tone(c, "deep"), 0.5 * k, 0.4),
      ],
    };
    const tails = (fill: string): Shape[] => ([1, -1] as const).flatMap(s => tail(c, spine(s), widths, k, fill));
    return {
      front: [onHead("hair_back", { shapes: tails(behind(c)) }), onHead("hair_front", front)],
      back: [onHead("hair_back", backG), onHead("hair_front", { shapes: [...tails(c), ...ties()] })],
    };
  }, { tags: ["casual", "school", "kids", "long", "tied"], bulk: 1.5, odds: { adult: 0.25, elder: 0.1, child: 2, toddler: 2 } }),
};
