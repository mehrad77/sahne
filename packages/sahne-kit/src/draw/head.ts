// The head's geometry, shared by the face, the hair, everything worn on the head and the ears.
// Head-bone space: centimetres, the chin at the origin, y up is negative, the crown at y = -H.
// W = headW, H = headH (adult 44 × 50, elder 44 × 48, child 36 × 40, toddler 35 × 37, times the
// shape's head factor). Every size is a fraction of W or H, or cm × `k` (H / 50), so one drawing
// fits every build. The outline follows `face.shape`, so nothing built from it leaves a corner of
// skin showing on a square, heart or long head: hair crowns (`crown`), scarf openings
// (`offset` with a negative grow), hat bands and their clips.

import { smooth, Path, rect, type AvatarDoc, type BodyDims, type PartCtx, type Vec2, type ViewName } from "sahne";

/** The head outlines, by `face.shape` id: the right half from the crown down to the chin (mirrored for the left), as fractions of the half width w and of H. */
const OUTLINES: Record<string, [number, number][]> = {
  oval: [[0.8, 0.93], [1, 0.66], [0.98, 0.38], [0.8, 0.13], [0.38, 0.005]],
  round: [[0.84, 0.92], [1.02, 0.62], [1, 0.34], [0.86, 0.12], [0.45, 0.01]],
  square: [[0.86, 0.94], [0.99, 0.66], [0.98, 0.3], [0.9, 0.1], [0.5, 0.005]],
  long: [[0.78, 0.95], [0.93, 0.66], [0.92, 0.36], [0.74, 0.12], [0.34, 0.005]],
  heart: [[0.86, 0.93], [1.03, 0.64], [0.95, 0.38], [0.68, 0.13], [0.28, 0.005]],
  // narrow forehead, widest at the cheekbones, a soft point at the chin
  diamond: [[0.66, 0.94], [0.9, 0.7], [1, 0.45], [0.66, 0.15], [0.28, 0.01]],
  // widest low, a broad jaw and a rounded chin
  full: [[0.8, 0.93], [0.98, 0.66], [1.04, 0.4], [0.93, 0.14], [0.55, 0.012]],
};

/** The face shapes the head can take, in the builder's order. */
export const HEAD_SHAPES = Object.keys(OUTLINES);

/** The head's outline in head-bone space: chin at the pivot (0, 0), the crown at (0, -headH). An unknown shape is oval. */
export function headPath(shape: string | undefined, W: number, H: number): Path {
  const w = W / 2, o = OUTLINES[shape ?? "oval"] ?? OUTLINES.oval, top = shape === "long" ? -H * 1.03 : -H;
  const right = o.map(([x, y]): Vec2 => [w * x, -H * y]);
  return smooth([[0, top], ...right, [0, 0], ...[...right].reverse().map(([x, y]): Vec2 => [-x, y])], true, 1);
}

// ---- sampling the outline ----------------------------------------------------------------------------

/** The outline as a dense polygon, cached per shape and size (hair asks for it many times per character). */
const polys = new Map<string, Vec2[]>();
function outlinePoly(shape: string | undefined, W: number, H: number): Vec2[] {
  const key = `${shape}|${W.toFixed(3)}|${H.toFixed(3)}`;
  let p = polys.get(key);
  if (p) return p;
  p = [];
  let x = 0, y = 0;
  for (const c of headPath(shape, W, H).cmds) {
    if (c[0] === "M") { x = c[1]; y = c[2]; p.push([x, y]); }
    else if (c[0] === "C") {
      for (let i = 1; i <= 24; i++) {
        const t = i / 24, u = 1 - t;
        p.push([u * u * u * x + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5], u * u * u * y + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]]);
      }
      x = c[5]; y = c[6];
    }
  }
  if (polys.size > 64) polys.clear();
  polys.set(key, p);
  return p;
}

/** Where a ray from (cx, cy) at angle `a` (radians: π left, 1.5π up, 2π right; y down) leaves the outline, with the outward normal there. */
function rayHit(poly: Vec2[], cx: number, cy: number, a: number): { p: Vec2; n: Vec2 } {
  const dx = Math.cos(a), dy = Math.sin(a);
  let best = Infinity, hit: Vec2 = [cx, cy], n: Vec2 = [dx, dy];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], ex = q[0] - p[0], ey = q[1] - p[1], den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((p[0] - cx) * ey - (p[1] - cy) * ex) / den, s = ((p[0] - cx) * dy - (p[1] - cy) * dx) / den;
    if (t > 0 && s >= 0 && s <= 1 && t < best) {
      best = t; hit = [cx + dx * t, cy + dy * t];
      // the outline runs clockwise on screen (y down), so its outward normal is (ey, -ex) rotated: (-ey, ex) points in; use the side away from the centre
      const l = Math.hypot(ex, ey) || 1, nx = ey / l, ny = -ex / l;
      n = nx * dx + ny * dy >= 0 ? [nx, ny] : [-nx, -ny];
    }
  }
  return { p: hit, n };
}

/**
 * An arc of the crown ellipse grown by `v` cm, from angle a0 to a1 (radians: π is the left side at
 * ear height, 1.5π the top, 2π the right): centre (0, -0.6H), radii W/2 + v and 0.42H + v. Every
 * hair style was drawn on it; it ignores the face shape, so use it for lines that lie inside the
 * hair (a sheen, a parting, a strand), and `headCrown` for an edge that must cover the head.
 */
export function headArc(W: number, H: number, v: number, a0 = Math.PI, a1 = Math.PI * 2, n = 10): Vec2[] {
  const cy = -H * 0.6, rx = W / 2 + v, ry = H * 0.42 + v, out: Vec2[] = [];
  for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * (i / n); out.push([Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return out;
}

/** How far a crown stays outside the head's outline where the outline would pass it (cm): the head's paper rim stays under the hair. */
const CROWN_MARGIN = 0.3;

/**
 * The edge of hair (or a cap) of bulk `v` cm over the crown, from angle a0 to a1 (as `headArc`; the
 * default runs over the top from ear to ear): the crown ellipse (`headArc`), pushed out only where
 * the head's own outline would show past it, to the outline plus 0.3 cm (plus `v` when that is
 * less). So a style keeps its shape on an oval or a round head, and the corners of a square, heart
 * or long head stay covered.
 */
export function headCrown(shape: string | undefined, W: number, H: number, v: number, a0 = Math.PI, a1 = Math.PI * 2, n = 10): Vec2[] {
  const poly = outlinePoly(shape, W, H), cy = -H * 0.6, m = Math.min(CROWN_MARGIN, Math.max(0, v));
  return headArc(W, H, v, a0, a1, n).map(([x, y]): Vec2 => {
    const dy = y - cy, r = Math.hypot(x, dy);
    if (!(r > 1e-6)) return [x, y];
    const { p } = rayHit(poly, 0, cy, Math.atan2(dy, x)), need = Math.hypot(p[0], p[1] - cy) + m;
    return need > r ? [x / r * need, cy + dy / r * need] : [x, y];
  });
}

/** The head's half width at a height y (head space): how far right the outline reaches there (0 above the crown or below the chin). */
export function headHalfWidth(shape: string | undefined, W: number, H: number, y: number): number {
  const poly = outlinePoly(shape, W, H);
  let x = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    if ((p[1] - y) * (q[1] - y) > 0 || p[1] === q[1]) continue;
    x = Math.max(x, p[0] + (q[0] - p[0]) * (y - p[1]) / (q[1] - p[1]));
  }
  return x;
}

/** The whole outline grown by `v` cm (`v` < 0: inset), as a smooth closed path: a hood or a scarf's face opening is `offsetHead(shape, W, H, -0.3)`. */
export function offsetHead(shape: string | undefined, W: number, H: number, v: number, n = 32): Path {
  const poly = outlinePoly(shape, W, H), cy = -H * 0.5, pts: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const { p, n: nn } = rayHit(poly, 0, cy, Math.PI * 1.5 + (i / n) * Math.PI * 2);
    pts.push([p[0] + nn[0] * v, p[1] + nn[1] * v]);
  }
  return smooth(pts, true, 1);
}

/** The head outline moved inwards by `d` cm: a headscarf's face opening (keep it at least 0.1 W wider than the glasses' lenses). */
export const insetHead = (shape: string | undefined, W: number, H: number, d: number) => offsetHead(shape, W, H, -d);

// ---- anchors -------------------------------------------------------------------------------------------

/** Eye centres in head space, shared by the face, glasses and hats. Side 1 is the wearer's left (+x). */
export const eyeAt = (W: number, H: number, side: 1 | -1): Vec2 => [side * W * 0.205, -H * 0.43];

/** An ear: its ellipse (centre, radii, tilt in radians, + outwards) and the points jewellery and devices hang from. */
export interface Ear {
  c: Vec2; rx: number; ry: number; rot: number;
  /** The top of the ear (a cochlear coil sits above it, a behind-the-ear aid's hook over it). */
  top: Vec2;
  /** The lobe: earrings hang from here. */
  lobe: Vec2;
  /** The back edge, away from the face: a behind-the-ear aid sits here. */
  back: Vec2;
}

/** Ear sizes and set by `face.ears`: radii (cm), how far out it sits and its tilt (degrees, outwards). */
const EARS: Record<string, { rx: number; ry: number; out: number; tilt: number }> = {
  round: { rx: 3.6, ry: 5, out: 0, tilt: 0 },
  small: { rx: 2.9, ry: 4, out: -0.2, tilt: 0 },
  large: { rx: 4.3, ry: 6.4, out: 0.3, tilt: 0 },
  protruding: { rx: 3.6, ry: 5, out: 1.6, tilt: 15 },
};

/** The ear choices (`face.ears`), in the builder's order. */
export const EAR_SHAPES = Object.keys(EARS);

/** The ear on one side (1 = the wearer's left, +x) in head space, for every view. Earrings, aids and earbuds hang from its anchors, so they follow the ear's size. */
export function earAt(W: number, H: number, side: 1 | -1, ears?: string): Ear {
  const e = EARS[ears ?? "round"] ?? EARS.round, rot = side * e.tilt * Math.PI / 180;
  const c: Vec2 = [side * (W * 0.5 - 0.6 + e.out), -H * 0.42];
  const P = (x: number, y: number): Vec2 => [c[0] + x * Math.cos(rot) - y * Math.sin(rot), c[1] + x * Math.sin(rot) + y * Math.cos(rot)];
  return { c, rx: e.rx, ry: e.ry, rot, top: P(0, -e.ry * 0.85), lobe: P(side * e.rx * 0.1, e.ry * 0.8), back: P(side * e.rx * 0.85, -e.ry * 0.1) };
}

// ---- the head as one object -------------------------------------------------------------------------------

/** Reference heights on the head, fractions of H above the chin (head space y = -f · H). */
export const HEAD_Y = { crown: 1.02, hairline: 0.73, temple: 0.64, brow: 0.52, eye: 0.43, ear: 0.42, nose: 0.305, mouth: 0.19 } as const;

/** One head's measures and helpers: what a part on the head bone needs. */
export interface Head {
  W: number; H: number;
  /** cm per adult cm: H / 50 (child 0.8, toddler 0.74). Size small details (a button, a pin) with it. */
  k: number;
  shape: string;
  ears: string;
  outline: Path;
  /** `headCrown` of this head: the edge of hair or a cap of bulk `v`, covering the head's outline. */
  crown(v: number, a0?: number, a1?: number, n?: number): Vec2[];
  /** `headArc` of this head: the crown ellipse, for lines inside the hair (a sheen, a parting). */
  arc(v: number, a0?: number, a1?: number, n?: number): Vec2[];
  /** `offsetHead` of this head (`v` < 0: inset). */
  offset(v: number): Path;
  eye(side: 1 | -1): Vec2;
  ear(side: 1 | -1): Ear;
  /** The y of a reference line (`HEAD_Y`), e.g. `y("brow")`. */
  y(line: keyof typeof HEAD_Y): number;
}

export function head(b: Pick<BodyDims, "headW" | "headH">, shape?: string, ears?: string): Head {
  const W = b.headW, H = b.headH, s = shape ?? "oval", e = ears ?? "round";
  return {
    W, H, k: H / 50, shape: s, ears: e, outline: headPath(s, W, H),
    crown: (v, a0, a1, n) => headCrown(s, W, H, v, a0, a1, n),
    arc: (v, a0, a1, n) => headArc(W, H, v, a0, a1, n),
    offset: v => offsetHead(s, W, H, v),
    eye: side => eyeAt(W, H, side), ear: side => earAt(W, H, side, e),
    y: line => -H * HEAD_Y[line],
  };
}

/** The head of the character a part is drawn for. */
export const headOf = (ctx: { body: BodyDims; avatar: AvatarDoc }): Head => head(ctx.body, ctx.avatar.face?.shape, ctx.avatar.face?.ears);

// ---- hats: what they keep of the hair -----------------------------------------------------------------------

/**
 * A hat's band line, fractions of H above the chin: at the centre of the forehead, above the ears,
 * and at the back (the view from behind). A baseball cap is about { centre: 0.72, side: 0.62, back: 0.58 }.
 */
export interface Band { centre: number; side: number; back?: number }

/** The region below a band line (to 80 cm below the chin, so long hair stays), for one view: the `crown` clip mode. */
export function belowBand(b: Pick<BodyDims, "headW" | "headH">, band: Band, view: ViewName): Path {
  const W = b.headW, H = b.headH, far = W * 1.2;
  const yc = -H * (view === "back" ? band.back ?? band.side : band.centre), ys = -H * band.side;
  return smooth([[-far, ys, 0], [-W * 0.55, ys], [0, yc], [W * 0.55, ys], [far, ys, 0], [far, 80, 0], [-far, 80, 0]], true, 1);
}

/** The region outside a band between two heights (fractions of H): the `band` clip mode, for a headband over the hair. */
export function outsideBand(b: Pick<BodyDims, "headW" | "headH">, top: number, bottom: number): Path {
  const W = b.headW, H = b.headH, far = W * 1.2;
  return new Path().add(rect(-far, -H * 2, far * 2, H * 2 - H * top)).add(rect(-far, -H * bottom, far * 2, H * bottom + 80));
}

/**
 * `clips.keep` for a hat that cuts the hair above its band (`crown` mode), with the band per view:
 * `clips: { slots: ["hair"], keep: crownClip({ centre: 0.72, side: 0.62, back: 0.58 }) }`.
 */
export const crownClip = (band: Band) => (ctx: PartCtx, view: ViewName) => belowBand(ctx.body, band, view);

/** `clips.keep` for a band over the hair (`band` mode): only the strip under the band is cut. */
export const bandClip = (top: number, bottom: number) => (ctx: PartCtx) => outsideBand(ctx.body, top, bottom);
