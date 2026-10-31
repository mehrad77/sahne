// Textured hair: curly, coily, afro, puffs, braids, box braids, cornrows, locs, twists and Bantu
// knots (the straight, wavy and tied styles are in hair.ts). Each gives a front and a back view,
// built from the head's own outline, so a style fits every face shape, build and body.
//
// THE TEXTURED-HAIR ARTIST'S FILE: add parts to `HAIR_TEXTURED` (ids `hair_*`, permanent). Shared
// helpers are in draw/ (`hairPart`, `backCover`, `sheen`, `onHead`, `onNeck` for plaits and locs
// that hang over the chest on layer `hair_lock`, front view only). Every style says its `bulk`
// (`HAIR_BULK.low|mid|high`, or cm), which hats and coverings read. Keep a style to one cut
// silhouette per curl, plait, twist or loc plus one compound flat path for each texture (creases,
// coils, partings, clumps of light), at most about 40 cut shapes per view.
// Ties and beads are `tone(hair, "deep")` until the document has an accent colour.
//
// The hairline never comes below 0.62 H within 0.4 W of the centre (the brows and eyes act there),
// and the front pieces stop above the ears, so earrings, aids and glasses temples show. In the back
// view the picture is mirrored (the wearer's left, +x, is on the viewer's left), so the light that
// falls from the upper left lands on +x there.

import { arcPoints, ellipse, poly, smooth, tone, mix, luma, Path, type BodyDims, type Group, type PartDef, type Shape, type Vec2 } from "sahne";
import { hairPart, onHead, onNeck, headToNeck, headHalfWidth, sheen, S, HAIR_BULK, type Head, type Pt } from "./draw/index.ts";

// ---- the drawing helpers only textured hair needs ---------------------------------------------------

const PI = Math.PI;

/** A repeatable 0…1 jitter for the i-th curl, so a style draws the same every time. */
const rnd = (i: number) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };

/** A flat ink mark along a (compound) path: creases, coils, partings. */
const ink = (path: Path, color: string, width: number, opacity: number, clip?: Path): Shape => ({ path, stroke: { color, width }, flat: true, opacity, ...(clip ? { clip } : {}) });

/** A flat fill of a (compound) path: clumps of curls in the light or in shade. */
const wash = (path: Path, fill: string, opacity: number, clip?: Path): Shape => ({ path, fill, flat: true, opacity, ...(clip ? { clip } : {}) });

/** Points at fractions of the head: [x × W, y × H]. */
const at = (h: Head, f: [number, number][]): Vec2[] => f.map(([x, y]) => [x * h.W, y * h.H]);

/** A run of points with a round bump between each pair, pushed away from `c` by `amp` cm; the valleys are corners. */
function scallop(pts: Vec2[], c: Vec2, amp: number): Pt[] {
  const o: Pt[] = [];
  pts.forEach((p, i) => {
    o.push([p[0], p[1], 0]);
    const q = pts[i + 1];
    if (!q) return;
    const m: Vec2 = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2], dx = m[0] - c[0], dy = m[1] - c[1], r = Math.hypot(dx, dy) || 1;
    o.push([m[0] + dx / r * amp, m[1] + dy / r * amp]);
  });
  return o;
}

/**
 * A run pulled in towards `c` by up to `d` cm on the side away from the light (`dark`, the angle the
 * shade faces: π/4 is the lower right on screen) and not at all on the lit side: a shape in the hair
 * colour over its shaded copy shows a crescent of shade where the light does not reach.
 */
const shadeIn = (pts: Vec2[], c: Vec2, d: number, dark: number): Vec2[] => pts.map(([x, y]): Vec2 => {
  const dx = x - c[0], dy = y - c[1], r = Math.hypot(dx, dy) || 1, f = d * Math.max(0, Math.cos(Math.atan2(dy, dx) - dark)) ** 1.5;
  return [x - dx / r * f, y - dy / r * f];
});

/** Discs at the spots, as one path (several clumps in one flat fill), a little uneven. */
const discs = (spots: Vec2[], r: number): Path => spots.reduce((p, [x, y], i) => p.add(ellipse(x, y, r * (0.8 + rnd(i) * 0.4), r * (0.65 + rnd(i + 9) * 0.3))), new Path());

/** Little open coils ('c' marks) at the spots, as one path for one flat stroke. */
const coils = (spots: Vec2[], r: number): Path => spots.reduce((p, [x, y], i) => { const a = rnd(i * 3 + 1) * PI * 2; return p.add(smooth(arcPoints(x, y, r, r * 0.85, a, a + PI * 1.35, 2), false)); }, new Path());

/** Short arcs, one path: the lit (upper-left) or the shaded (lower-right) side of a curl at each spot. */
function moons(spots: Vec2[], r: number, lit: boolean): Path {
  const a0 = lit ? 0.95 * PI : -0.05 * PI;
  return spots.reduce((p, [x, y], i) => { const q = r * (0.8 + rnd(i + 17) * 0.4); return p.add(smooth(arcPoints(x, y, q, q, a0, a0 + PI * 0.6, 2), false)); }, new Path());
}

/** The lit or shaded sides of curls at the spots as one round-capped flat stroke (cheap in the still output: three points a curl). */
const crescents = (spots: Vec2[], r: number, lit: boolean, color: string, opacity: number): Shape => ink(moons(spots, r, lit), color, r * 0.5, opacity);

/**
 * Box partings as a brick grid on a cap (one path): rows of arcs (`rows`, crown radii in cm, inside
 * the hair) and short partings between them, offset row to row, `cols` across from `a0` to `a1`.
 */
function bricks(h: Head, rows: number[], cols: number, a0: number, a1: number): Path {
  const out = new Path();
  for (const v of rows) out.add(smooth(h.arc(v, PI * a0, PI * a1, 10), false));
  const bands = [h.arc(rows[0] + 3 * h.k, PI * a0, PI * a1, 40), ...rows.map(v => h.arc(v, PI * a0, PI * a1, 40))];
  for (let r = 0; r < bands.length - 1; r++) for (let i = 0; i < cols; i++) {
    const f = (i + (r % 2 ? 0.5 : 0) + 0.25) / cols, j = Math.min(40, Math.round(f * 40));
    out.add(smooth([bands[r][j], bands[r + 1][j]], false));
  }
  return out;
}

/** `m` + 1 points evenly spaced along a smooth curve through `pts`. */
function along(pts: Vec2[], m: number): Vec2[] {
  const dense: Vec2[] = [], n = pts.length, q = (i: number) => pts[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) {
    const p0 = q(i - 1), p1 = q(i), p2 = q(i + 1), p3 = q(i + 2);
    for (let s = 0; s < 10; s++) {
      const t = s / 10, t2 = t * t, t3 = t2 * t, f = (j: 0 | 1) => 0.5 * (2 * p1[j] + (p2[j] - p0[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (3 * p1[j] - p0[j] - 3 * p2[j] + p3[j]) * t3);
      dense.push([f(0), f(1)]);
    }
  }
  dense.push(pts[n - 1]);
  const len = [0];
  for (let i = 1; i < dense.length; i++) len.push(len[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const total = len[len.length - 1], out: Vec2[] = [];
  let j = 0;
  for (let k = 0; k <= m; k++) {
    const s = total * k / m;
    while (j < len.length - 2 && len[j + 1] < s) j++;
    const u = Math.min(1, (s - len[j]) / ((len[j + 1] - len[j]) || 1));
    out.push([dense[j][0] + (dense[j + 1][0] - dense[j][0]) * u, dense[j][1] + (dense[j + 1][1] - dense[j][1]) * u]);
  }
  return out;
}

/** The unit direction of travel at point i of a run. */
function dirOf(p: Vec2[], i: number): Vec2 {
  const a = p[Math.max(0, i - 1)], b = p[Math.min(p.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
  return [dx / l, dy / l];
}

/** The unit normal at point i, to the left of the direction of travel (−x for a strand hanging down). */
const normalOf = (p: Vec2[], i: number): Vec2 => { const [dx, dy] = dirOf(p, i); return [-dy, dx]; };

/**
 * A plait, braid or twist down a spine: its outline, leaves alternating left and right with a waist
 * of `valley` (0…1) between them, a rounded tip when `tip`, and its creases in one path: each leaf's
 * lower edge from its waist across the middle (a plait), or a rope line across the whole width (a twist).
 */
function plait(spine: Vec2[], w0: number, w1: number, leaves: number, o: { valley?: number; tip?: boolean; rope?: boolean } = {}): { body: Path; creases: Path; end: Vec2; dir: Vec2 } {
  const m = Math.max(2, leaves * 2), p = along(spine, m), valley = o.valley ?? 0.62;
  const half = (i: number) => (w0 + (w1 - w0) * i / m) / 2;
  const side = (i: number, s: number, f: number): Vec2 => { const nn = normalOf(p, i), r = half(i) * f * s; return [p[i][0] + nn[0] * r, p[i][1] + nn[1] * r]; };
  const L: Pt[] = [], R: Pt[] = [];
  for (let i = 0; i <= m; i++) {
    const l = side(i, 1, i % 2 ? 1 : valley), r = side(i, -1, i % 2 ? valley : 1);
    L.push(i % 2 ? l : [l[0], l[1], 0]); R.push(i % 2 ? [r[0], r[1], 0] : r);
  }
  const end = p[m], dir = dirOf(p, m), tip: Pt[] = o.tip ? [[end[0] + dir[0] * half(m) * 1.15, end[1] + dir[1] * half(m) * 1.15]] : [];
  const creases = new Path();
  for (let i = 0; i < m - (o.tip ? 1 : 0); i++) {
    const s = i % 2 ? -1 : 1, a = side(i, s, valley * 0.9);
    if (o.rope) creases.add(smooth([a, side(i + 1, 0, 0), side(Math.min(m, i + 2), -s, valley * 0.9)], false));
    else creases.add(poly([a, side(i + 1, -s * 0.3, 0.95)], false));
  }
  return { body: smooth([...L, ...tip, ...R.reverse()], true, 1), creases, end, dir };
}

/** The end of a plait: a short tuft and the tie over it (the accent colour once there is one; `tone(hair, "deep")` until then). */
function tieTuft(end: Vec2, d: Vec2, w: number, c: string, len: number): Shape[] {
  const a: Vec2 = [-d[1], d[0]], P = (u: number, v: number, corner = false): Pt => { const x = end[0] + a[0] * u * w + d[0] * v, y = end[1] + a[1] * u * w + d[1] * v; return corner ? [x, y, 0] : [x, y]; };
  return [
    S([P(-0.3, -0.6), P(-0.55, len * 0.5), P(-0.42, len, true), P(-0.14, len * 0.72), P(0.02, len * 1.08, true), P(0.16, len * 0.72), P(0.42, len * 0.95, true), P(0.55, len * 0.5), P(0.3, -0.6)], c),
    S([P(-0.42, -0.75), P(0, -0.95), P(0.42, -0.75), P(0.46, 0.75), P(0, 0.95), P(-0.46, 0.75)], tone(c, "deep")),
  ];
}

/**
 * The front cap of a close style: the crown edge `top` (left to right, already shaped), down each
 * side to `side` (a fraction of H, above the ear) just outside the face, and back across the
 * hairline `line` (left to right, already shaped).
 */
function cap(h: Head, top: Pt[], line: Pt[], side = 0.54): Pt[] {
  const y = -h.H * side, x = headHalfWidth(h.shape, h.W, h.H, y) + 0.3 * h.k;
  return [...top, [x, y, 0], ...[...line].reverse(), [-x, y, 0]];
}

/** A hairline, left to right: the temples at ±`tx` W and `temple` (fractions of H above the chin), the middle at `mid`. */
function hairline(h: Head, mid: number, temple: number, n = 8, tx = 0.42): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= n; i++) { const u = -1 + 2 * i / n; out.push([u * tx * h.W, -h.H * (temple + (mid - temple) * Math.sqrt(1 - u * u * 0.96))]); }
  return out;
}

/** The back of a close style: the crown edge from below one ear to the other, down to a nape line (left to right after the crown's right end). */
const backCap = (top: Pt[], nape: Pt[]): Pt[] => [...top, ...[...nape].reverse()];

/** Where hanging hair lies on the chest, in the neck bone's frame: between the neck (`f` 0) and the inside of the arm (`f` 1). */
function chestX(b: BodyDims, f: number): number {
  const lo = b.neckW * 0.36, hi = Math.max(lo + 1.5, b.shoulderW / 2 - b.armW[0] * 0.8);
  return lo + (hi - lo) * f;
}

/**
 * The spine of a strand that hangs from behind the jaw over the shoulder onto the chest, in the
 * neck bone's frame: from (±rx W, -ry H) in head space, over the shoulder to `x` and down to `y`.
 * The head covers the start, so it seems to come from behind the ear.
 */
function hang(b: BodyDims, h: Head, s: 1 | -1, rx: number, ry: number, x: number, y: number, wob = 0, seed = 0): Vec2[] {
  const r = headToNeck(b, [s * rx * h.W, -ry * h.H]), jaw = headToNeck(b, [s * rx * h.W * 0.96, h.H * 0.02]);
  const sh: Vec2 = [s * (x + (Math.abs(jaw[0]) - x) * 0.45), b.armW[0] * 0.12];
  const w = (i: number) => (rnd(seed * 7 + i) - 0.5) * 2 * wob;
  return [r, jaw, sh, [s * x + w(1), sh[1] + (y - sh[1]) * 0.35], [s * x * 0.97 + w(2), sh[1] + (y - sh[1]) * 0.7], [s * x * 0.95 + w(3), y]];
}

/** `hang` with four points (from the jaw, over the shoulder, halfway, the end): enough for a stroked cord, and a quarter of the bytes. */
function hangLean(b: BodyDims, h: Head, s: 1 | -1, rx: number, x: number, y: number, wob = 0, seed = 0): Vec2[] {
  const p = hang(b, h, s, rx, 0.2, x, y, wob, seed);
  return [p[1], p[2], p[3], p[5]];
}

/**
 * The back view of long strands that start on the scalp: tiers of roots (`[y, half-spread, count]`,
 * fractions of H and W, top tier first), each strand lying down over the back of the head, leaving
 * its outline beside the ears and hanging to `len` (neck space below the chin, head space here) with
 * its tip off by up to `hem` cm. Lower tiers come first in the list, so the upper ones lie over them.
 */
function fall(h: Head, tiers: [number, number, number][], bx: number, len: number, hem: number, wob: number, seed: number): { spines: Vec2[][]; roots: Vec2[] } {
  const { W, H } = h, spines: Vec2[][] = [], roots: Vec2[] = [], widest = Math.max(...tiers.map(t => t[1])) * W, edge = headHalfWidth(h.shape, W, H, -H * 0.3) * 1.04;
  [...tiers].reverse().forEach(([y, spread, n], t) => {
    for (let i = 0; i < n; i++) {
      // every strand keeps its place across the back (`f`, -1…1 of the widest tier), so they hang side by side, not in a fan
      const u = n > 1 ? -1 + 2 * i / (n - 1) : 0, x0 = u * spread * W, f = x0 / widest, j = seed + t * 17 + i, w = (q: number) => (rnd(j * 5 + q) - 0.5) * 2 * wob;
      roots.push([x0, -H * y]);
      spines.push([[x0, -H * y], [f * edge + w(1) * 0.3, -H * 0.24], [f * bx * 0.9 + w(2), len * 0.5], [f * bx * 0.86 + w(3), len + (rnd(j * 3) - 0.5) * 2 * hem]]);
    }
  });
  return { spines, roots };
}

/**
 * Many thin strands (box braids, locs, twists) as two flat strokes along one path of their spines:
 * the hair colour `w` wide with round ends, then its sections across it (`dash`: mark and gap, cm) in
 * the deep tone. A strand costs its three or four spine points twice and no outline, so a curtain of
 * braids stays inside the portrait budget; a darker mass drawn behind shows between the strands.
 */
function cords(spines: Vec2[][], c: string, w: number, dash: [number, number], mark = 0.8, opacity = 0.5): Shape[] {
  const path = spines.reduce((p, sp) => p.add(smooth(sp, false)), new Path());
  return [{ path, stroke: { color: c, width: w }, flat: true }, { path, stroke: { color: between(c), width: w * mark, dash, cap: "butt" }, flat: true, opacity }];
}

/**
 * The colour that shows between thin strands and in their marks: the deep tone on dark hair, nearer
 * the hair colour itself on light hair, where the deep tone turns a saturated orange (blonde) and
 * the colour the learner picked would no longer be what shows.
 */
const between = (c: string) => mix(c, tone(c, "deep"), Math.max(0.22, Math.min(1, 1.25 - luma(c) * 1.45)));

// ---- the styles --------------------------------------------------------------------------------------

export const HAIR_TEXTURED: Record<string, PartDef> = {
  // loose curls to the jaw, all-round: a cap of curls over the head and a halo of them behind it
  hair_curly: hairPart("Curly", "kıvırcık", (h, c) => {
    const { W, H, k } = h, ctr: Vec2 = [0, -H * 0.6], v = 4 * k, amp = 0.05 * W;
    const shade = tone(c, "shade"), light = tone(c, "light"), deep = tone(c, "deep");
    const halo = S([...scallop(h.crown(v + 0.4 * k, PI * 0.8, PI * 2.2, 15), ctr, amp), [W * 0.34, -H * 0.12], [0, -H * 0.1], [-W * 0.34, -H * 0.12]], shade);
    const top = scallop(h.crown(v, PI * 0.98, PI * 2.02, 12), ctr, amp);
    const line = scallop(hairline(h, 0.71, 0.63, 5, 0.43), [0, -H * 1.6], amp * 0.75);
    const lit = at(h, [[-0.3, -0.9], [-0.1, -0.99], [-0.42, -0.74], [-0.2, -0.8], [0.06, -0.9], [-0.32, -1.02]]), dark = at(h, [[0.3, -0.88], [0.14, -0.96], [0.42, -0.72], [0.24, -0.79], [-0.04, -0.82]]);
    const front: Group = {
      shapes: [
        S(cap(h, top, line, 0.55), c),
        crescents(lit, W * 0.05, true, light, 0.5),
        crescents(dark, W * 0.05, false, shade, 0.6),
        ink(coils(at(h, [[-0.22, -0.88], [0.04, -0.98], [0.32, -0.8], [-0.06, -0.76], [0.2, -0.88], [-0.38, -0.66], [0.38, -0.64], [-0.14, -0.96]]), 1.1 * k), deep, 0.55 * k, 0.45),
      ],
    };
    const mirror = (ps: Vec2[]) => ps.map(([x, y]): Vec2 => [-x, y]);
    const back: Group = {
      shapes: [
        S(backCap(scallop(h.crown(v, PI * 0.84, PI * 2.16, 15), ctr, amp), scallop(at(h, [[-0.47, -0.27], [-0.24, -0.14], [0, -0.11], [0.24, -0.14], [0.47, -0.27]]), ctr, amp * 0.8)), c),
        crescents([...mirror(lit), ...at(h, [[0.3, -0.5], [0.06, -0.62]])], W * 0.05, true, light, 0.5),
        crescents([...mirror(dark), ...at(h, [[-0.36, -0.42], [-0.12, -0.36], [0.14, -0.26], [-0.3, -0.22]])], W * 0.05, false, shade, 0.6),
        ink(coils(at(h, [[0.22, -0.84], [-0.1, -0.92], [-0.3, -0.66], [0.32, -0.36], [0, -0.48], [-0.2, -0.3], [0.2, -0.22], [0.06, -0.7]]), 1.1 * k), deep, 0.55 * k, 0.45),
      ],
    };
    return { front: [onHead("hair_back", { shapes: [halo] }), onHead("hair_front", front)], back: [onHead("hair_back", back)] };
  }, { bulk: 4, tags: ["textured", "curly", "casual", "medium"] }),

  // a close cap of small curls, a straight hairline, ears and temples clear (Yusuf)
  hair_curly_short: hairPart("Short curls", "kısa kıvırcık saç", (h, c, ctx) => {
    const { W, H, k } = h, ctr: Vec2 = [0, -H * 0.6], v = 2.4 * k, b = ctx.body.build, n = b === "toddler" ? 9 : b === "child" ? 11 : 14, amp = 0.032 * W;
    const deep = tone(c, "deep"), light = tone(c, "light");
    const line = hairline(h, 0.74, 0.64, 6, 0.42);
    const curled: Pt[] = [...scallop(line.slice(0, 3), [0, -H * 1.6], amp * 0.5), ...line.slice(3, 6), ...scallop(line.slice(6), [0, -H * 1.6], amp * 0.5)];
    const front: Group = {
      shapes: [
        S(cap(h, scallop(h.crown(v, PI * 0.985, PI * 2.015, n), ctr, amp), curled, 0.53), c),
        sheen(h, c, v - 1.6 * k, 1.2, 1.5, 1.6 * k, 0.45),
        ink(coils(at(h, [[-0.26, -0.88], [0.02, -0.95], [0.26, -0.86], [-0.08, -0.82], [0.16, -0.79], [-0.36, -0.72], [0.38, -0.7], [-0.16, -0.95]]), 0.9 * k), deep, 0.5 * k, 0.45),
      ],
    };
    // the nape cut arches up to 0.28 H (0.22 H on a toddler, whose neck is short), a band of skin below it
    const nape = b === "toddler" ? 0.22 : 0.28;
    const back: Group = {
      shapes: [
        S(backCap(scallop(h.crown(v, PI * 0.92, PI * 2.08, n + 2), ctr, amp), [...at(h, [[-0.47, -nape - 0.16]]), ...scallop(at(h, [[-0.34, -nape - 0.07], [-0.12, -nape], [0.12, -nape], [0.34, -nape - 0.07]]), ctr, amp * 0.6), ...at(h, [[0.47, -nape - 0.16]])]), c),
        sheen(h, c, v - 1.6 * k, 1.5, 1.8, 1.6 * k, 0.45),
        wash(discs(at(h, [[0.28, -0.82], [0.06, -0.92]]), W * 0.04), light, 0.3),
        ink(coils(at(h, [[0.2, -0.84], [-0.1, -0.9], [-0.3, -0.66], [0.32, -0.56], [0, -0.5], [-0.2, -0.44], [0.18, -0.42], [0.06, -0.7]]), 0.9 * k), deep, 0.5 * k, 0.45),
      ],
    };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", back)] };
  }, { bulk: 2.4, tags: ["textured", "curly", "casual", "work", "school", "short"] }),

  // short curls on top, the sides tapered by the barber (Yusuf): a bumpy cap of big curls that steps in at
  // the temples, the sides fading out in three steps above the ears; from behind a tapered nape
  hair_curly_taper: hairPart("Short curls, tapered sides", "yanları kısa kıvırcık saç", (h, c) => {
    const { W, H, k, shape } = h, ctr: Vec2 = [0, -H * 0.6], v = 3 * k, n = Math.max(7, Math.min(8, Math.round(W / 5.9))), r = Math.max(1.3, 1.6 * k);
    const deep = tone(c, "deep"), light = tone(c, "light"), stubble = mix(c, tone(c, "deep"), 0.45), hw = (y: number) => headHalfWidth(shape, W, H, -H * y);
    // the curls along the crown, from angle a0 to a1: a bump each, every other one 1.15 times as big
    const curls = (a0: number, a1: number, m: number): Pt[] => {
      const base = h.crown(v, a0, a1, m * 2), out: Pt[] = [];
      base.forEach((p, i) => {
        if (i % 2 === 0) { out.push([p[0], p[1], 0]); return; }
        const dx = p[0] - ctr[0], dy = p[1] - ctr[1], l = Math.hypot(dx, dy) || 1, a = r * ((i >> 1) % 2 ? 1.15 : 1);
        out.push([p[0] + dx / l * a, p[1] + dy / l * a]);
      });
      return out;
    };
    // front: the curls from temple to temple, the edge stepping in to 0.5 cm at the temples, a curly hairline at about 0.76 H
    const tY = 0.66, tX = hw(tY) + 0.5 * k, line = scallop(hairline(h, 0.765, 0.69, 6, 0.4), [0, -H * 1.6], 0.5 * k);
    const capF: Pt[] = [[-tX, -H * tY, 0], ...curls(PI * 1.08, PI * 1.92, n), [tX, -H * tY, 0], [W * 0.43, -H * 0.665], ...[...line].reverse().slice(1)];
    // the fade: three see-through bands from the temple down to above the ear, each lighter
    const fade = [[0.66, 0.615, 0.5], [0.615, 0.565, 0.3], [0.565, 0.52, 0.15]].map(([y0, y1, op]) => {
      const p = new Path();
      for (const s of [1, -1]) p.add(smooth([[s * (hw(y0) + 0.5 * k), -H * y0, 0], [s * (hw(y1) + 0.3 * k), -H * y1, 0], [s * (hw(y1) - 2.4 * k), -H * y1, 0], [s * (hw(y0) - 2.8 * k), -H * y0, 0]], true, 1));
      return wash(p, stubble, op);
    });
    const spots = at(h, [[-0.3, -0.88], [-0.12, -0.98], [0.08, -0.93], [-0.38, -0.76], [0.26, -0.86]]);
    const front: Group = {
      shapes: [
        ...fade,
        S(capF, c),
        wash(discs(spots, 1.3 * k), light, 0.4),
        ink(coils(at(h, [[-0.2, -0.84], [0.02, -1.0], [0.3, -0.8], [0.14, -0.9], [-0.06, -0.8], [0.4, -0.72]]), 0.9 * k), deep, 0.5 * k, 0.4),
      ],
    };
    // back: the curls over the crown to a soft edge at 0.58 H, then two fading bands to a clean nape at 0.18 H, inside the ears
    const ear = h.ear(1), inner = ear.c[0] - ear.rx - 0.8 * k, earTop = -ear.top[1] / H + 0.06;
    const edge = (y: number, s: number): Pt => { const t = Math.min(1, Math.max(0, (earTop - y) / 0.1)), x = hw(y) + 0.1 * k; return [s * Math.min(x, x * (1 - t) + inner * t), -H * y, 0]; };
    const capB: Pt[] = [[-(hw(0.6) + 0.3 * k), -H * 0.6, 0], ...curls(PI * 1.0, PI * 2.0, n + 1), [hw(0.6) + 0.3 * k, -H * 0.6, 0], [W * 0.3, -H * 0.575], [0, -H * 0.565], [-W * 0.3, -H * 0.575]];
    const taper = (y0: number, y1: number, op: number): Shape => {
      const down: Pt[] = [];
      for (let y = y0; y > y1 + 0.02; y -= 0.04) down.push(edge(y, 1));
      const right: Pt[] = [[0, -H * (y0 - 0.01)], ...down, edge(y1 + 0.05, 1), [W * 0.2, -H * (y1 + 0.02)], [0, -H * y1]];
      return S([...right, ...right.slice(1, -1).reverse().map((p): Pt => [-p[0], p[1], 0])], stubble, { flat: true, opacity: op });
    };
    const back: Group = {
      shapes: [
        taper(0.6, 0.18, 0.3), taper(0.6, 0.38, 0.5),
        S(capB, c),
        wash(discs(spots.map(([x, y]): Vec2 => [-x, y]), 1.3 * k), light, 0.4),
        ink(coils(at(h, [[0.2, -0.86], [-0.1, -0.96], [-0.3, -0.72], [0.34, -0.68], [0.04, -0.74]]), 0.9 * k), deep, 0.5 * k, 0.4),
      ],
    };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", back)] };
  }, { bulk: 3, builds: ["adult", "child"], tags: ["casual", "textured", "barber"] }),

  // curly hair tied up in a high bun of curls (Berfin), a few loose tendrils
  hair_bun_curly: hairPart("Curly bun", "kıvırcık topuz", (h, c, ctx) => {
    const { W, H, k } = h, ctr: Vec2 = [0, -H * 0.6], v = 1.6 * k, s = ctx.body.build === "child" ? 0.8 : 1;
    const deep = tone(c, "deep"), light = tone(c, "light");
    // the bun: seven curl lobes in a ring around a middle one, a little off-centre, as one cut shape
    const bx = W * 0.04, by = -H - H * 0.15 * s, rx = W * 0.22 * s, ry = W * 0.185 * s, r = W * 0.098 * s, lobes: Vec2[] = [];
    for (let i = 0; i < 7; i++) { const a = -PI / 2 + i * PI * 2 / 7 + 0.2; lobes.push([bx + Math.cos(a) * (rx - r * 0.7), by + Math.sin(a) * (ry - r * 0.7)]); }
    const bunPath = lobes.reduce((p, [x, y], i) => p.add(ellipse(x, y, r * (0.95 + rnd(i) * 0.15), r * (0.9 + rnd(i + 3) * 0.15))), new Path()).add(ellipse(bx, by, rx * 0.62, ry * 0.62));
    const bun = (): Shape[] => [{ path: bunPath, fill: c }, crescents(lobes, r * 0.85, false, tone(c, "shade"), 0.65), crescents([...lobes.slice(4), [bx - rx * 0.15, by - ry * 0.1]], r * 0.6, true, light, 0.5), ink(coils([[bx + rx * 0.1, by + ry * 0.05], [bx - rx * 0.35, by + ry * 0.35]], 1.1 * k), deep, 0.55 * k, 0.45)];
    const tie = (y: number): Shape[] => [
      S([[bx - W * 0.14 * s, y - 0.9 * k], [bx, y - 1.2 * k], [bx + W * 0.14 * s, y - 0.9 * k], [bx + W * 0.15 * s, y + 0.8 * k], [bx, y + 1.0 * k], [bx - W * 0.15 * s, y + 0.8 * k]], deep),
      ink(new Path().add(smooth([[bx - W * 0.11 * s, y - 0.3 * k], [bx, y - 0.5 * k], [bx + W * 0.11 * s, y - 0.3 * k]], false)).add(smooth([[bx - W * 0.12 * s, y + 0.4 * k], [bx, y + 0.3 * k], [bx + W * 0.12 * s, y + 0.4 * k]], false)), tone(deep, "light"), 0.3 * k, 0.5),
    ];
    const tendril = (pts: Vec2[]): Shape => ({ path: smooth(pts, false), stroke: { color: c, width: 0.7 * k }, flat: true });
    // the curls show where the hair is pulled back: a hairline of small curls, coils along it and at the nape
    const line = scallop(hairline(h, 0.74, 0.64, 9), [0, -H * 1.6], 0.042 * W);
    const edgeCurls = (pts: [number, number][]): Shape[] => { const ps = at(h, pts); return [crescents(ps, W * 0.04, false, tone(c, "shade"), 0.55), ink(coils(ps.map(([x, y]): Vec2 => [x - 0.5 * k, y - 0.6 * k]), 0.9 * k), deep, 0.5 * k, 0.45)]; };
    const front: Group = {
      shapes: [
        S(cap(h, scallop(h.crown(v, PI * 0.985, PI * 2.015, 6), ctr, 0.03 * W), line, 0.53), c),
        ...edgeCurls([[-0.4, -0.66], [-0.2, -0.77], [0.04, -0.8], [0.26, -0.76], [0.42, -0.62]]),
        ink(new Path().add(smooth(h.arc(-3 * k, PI * 1.14, PI * 1.4, 4), false)).add(smooth(h.arc(-3 * k, PI * 1.6, PI * 1.86, 4), false)).add(smooth(h.arc(-7 * k, PI * 1.25, PI * 1.45, 3), false)), deep, 0.5 * k, 0.35),
        sheen(h, c, v - 1.2 * k, 1.22, 1.45, 1.4 * k, 0.45),
        ...tie(-H - 0.6 * k),
        tendril(at(h, [[-0.42, -0.64], [-0.46, -0.58], [-0.42, -0.54], [-0.45, -0.49]])),
        tendril(at(h, [[0.41, -0.65], [0.45, -0.6], [0.42, -0.56], [0.46, -0.5], [0.44, -0.46]])),
      ],
    };
    const back: Group = {
      shapes: [
        S(backCap(scallop(h.crown(v, PI * 0.9, PI * 2.1, 8), ctr, 0.03 * W), scallop(at(h, [[-0.44, -0.4], [-0.33, -0.33], [-0.2, -0.3], [-0.07, -0.29], [0.07, -0.29], [0.2, -0.3], [0.33, -0.33], [0.44, -0.4]]), ctr, 0.04 * W)), c),
        ...edgeCurls([[-0.34, -0.39], [-0.1, -0.34], [0.14, -0.35], [0.36, -0.42]]),
        ink(new Path().add(smooth(at(h, [[-0.2, -0.36], [-0.12, -0.7], [-0.04, -0.98]]), false)).add(smooth(at(h, [[0.22, -0.36], [0.14, -0.7], [0.06, -0.98]]), false)), deep, 0.5 * k, 0.35),
        sheen(h, c, v - 1.2 * k, 1.55, 1.78, 1.4 * k, 0.45),
        tendril(at(h, [[-0.16, -0.33], [-0.19, -0.27], [-0.15, -0.22], [-0.18, -0.17]])),
        tendril(at(h, [[0.2, -0.33], [0.17, -0.28], [0.21, -0.23]])),
      ],
    };
    return { front: [onHead("hair_back", { shapes: bun() }), onHead("hair_front", front)], back: [onHead("hair_back", back), onHead("hair_front", { shapes: [...bun(), ...tie(-H - 0.4 * k)] })] };
  }, { bulk: HAIR_BULK.mid, builds: ["adult", "elder", "child"], tags: ["textured", "curly", "updo", "casual", "work"] }),

  // natural coily hair grown out round: a big halo behind the head, the face and ears in front of it
  hair_afro: hairPart("Afro", "afro saç", (h, c, ctx) => {
    const { W, H, k } = h, ctr: Vec2 = [0, -H * 0.6], v = 0.3 * W, amp = 0.042 * W;
    const shade = tone(c, "shade"), light = tone(c, "light"), deep = tone(c, "deep");
    // the marks are placed for a halo of 0.2 W and pushed out from the middle to this one
    const grow = (ps: Vec2[]) => ps.map(([x, y]): Vec2 => [x * 1.16, ctr[1] + (y - ctr[1]) * 1.16]);
    const lit = grow(at(h, [[-0.42, -1.0], [-0.22, -1.12], [-0.02, -1.16], [-0.52, -0.8], [-0.3, -0.88], [-0.12, -0.98], [-0.6, -0.56]]));
    const dark = grow(at(h, [[0.5, -0.88], [0.3, -1.06], [0.6, -0.62], [0.58, -0.36], [-0.6, -0.32], [0.36, -0.82], [0.12, -1.0]]));
    const curls = grow(at(h, [[-0.36, -0.96], [-0.14, -1.06], [0.1, -1.1], [0.32, -0.98], [0.48, -0.74], [-0.5, -0.66], [0.54, -0.46], [-0.56, -0.44], [0.18, -0.9], [-0.24, -0.8]]));
    const mirror = (ps: Vec2[]) => ps.map(([x, y]): Vec2 => [-x, y]);
    // under a cap or a beanie the halo is pressed flat: what is left below the band, the same width in both
    // views (W + 12 cm, more than the brief's 4 cm so it shows past the ears in front)
    const pressed = (top: number, back: boolean): Shape[] => {
      const hw = W / 2 + 6 * k, y0 = top - 1.5 * k, foot = back ? -H * 0.17 : -H * 0.24;
      const side = (s: 1 | -1): Vec2[] => [[s * hw * 0.92, y0], [s * hw, (y0 * 2 + foot) / 3], [s * hw * 0.97, (y0 + foot * 2) / 3], [s * hw * 0.8, foot]];
      const run: Pt[] = [...scallop(side(-1), ctr, amp * 0.6), ...scallop([[-hw * 0.8, foot], [-hw * 0.3, foot + 0.6 * k], [hw * 0.3, foot + 0.6 * k], [hw * 0.8, foot]], [0, -H], amp * 0.6).slice(1, -1), ...scallop(side(1).reverse(), ctr, amp * 0.6)];
      return [S([[-hw * 0.9, y0 - 2 * k, 0], ...run, [hw * 0.9, y0 - 2 * k, 0]], c), ink(coils(at(h, back ? [[-0.3, -0.3], [0.1, -0.24], [0.34, -0.36], [-0.06, -0.42]] : [[-0.56, -0.4], [0.56, -0.44]]), 1.1 * k), deep, 0.55 * k, 0.4)];
    };
    const flatTop = (clip: Path | null | undefined) => { const t = clip ? clip.bounds()[1] : -Infinity; return t > -H * 0.82 ? t : null; };
    const fTop = flatTop(ctx.clip), bTop = flatTop(ctx.clipBack ?? ctx.clip);
    // the halo in shade, and the same curls in the hair colour a little smaller and up towards the
    // light, so a rim of shaded curls shows on the side away from it (the back view's light is on +x)
    const outerRun = h.crown(v, PI * 0.8, PI * 2.2, 21), ringOf = (d: number) => shadeIn(outerRun, ctr, 2.4 * k, d);
    const ring = ringOf(PI * 0.25), outer = scallop(outerRun, ctr, amp);
    const foot: Pt[] = [[W * 0.36, -H * 0.12], [0, -H * 0.09], [-W * 0.36, -H * 0.12]];
    // the halo carries the marks beside the face, the cap in front those over the top
    const aside = (ps: Vec2[]) => ps.filter(([x, y]) => Math.abs(x) > W * 0.46 && y > -H * 0.8);
    // the cap over the forehead is the top of the same halo, cut along the hairline and down to the
    // temples in a line of curls: one silhouette from the front
    const y = -H * 0.56, x = headHalfWidth(h.shape, W, H, y) + 0.3 * k;
    const seam = (e: Vec2, s: 1 | -1) => scallop([0, 1, 2, 3].map((i): Vec2 => [e[0] + (s * x - e[0]) * i / 3, e[1] + (y - e[1]) * i / 3]), [s * W * 0.15, -H * 0.95], amp * 0.7);
    const line = scallop(hairline(h, 0.75, 0.63, 6, 0.42), [0, -H * 1.6], 0.02 * W);
    const capPts: Pt[] = [...scallop(ring.slice(3, 19), ctr, amp), ...seam(ring[18], 1).slice(1), ...[...line].reverse().slice(1, -1), ...[...seam(ring[3], -1)].reverse().slice(0, -1)];
    const front: Group = {
      shapes: [
        S(capPts, c),
        crescents(lit, W * 0.065, true, light, 0.45), crescents(dark.filter(p => !aside([p]).length), W * 0.065, false, shade, 0.55), ink(coils(curls.filter(p => !aside([p]).length), 1.3 * k), deep, 0.6 * k, 0.4),
      ],
    };
    const halo: Shape[] = fTop !== null ? pressed(fTop, false) : [S([...outer, ...foot], shade), S([...scallop(ring, ctr, amp), ...foot], c), crescents(aside(dark), W * 0.065, false, shade, 0.55), ink(coils(aside(curls), 1.3 * k), deep, 0.6 * k, 0.4)];
    const nape = scallop(at(h, [[-0.62, -0.3], [-0.42, -0.21], [-0.2, -0.17], [0, -0.16], [0.2, -0.17], [0.42, -0.21], [0.62, -0.3]]), ctr, amp * 0.8);
    const back: Group = {
      shapes: bTop !== null ? pressed(bTop, true) : [
        S(backCap(outer, nape.map(p => [p[0] * 1.03, p[1] + 0.6 * k, ...p.slice(2)] as Pt)), shade),
        S(backCap(scallop(ringOf(PI * 0.75), ctr, amp), nape.map(p => [p[0] - Math.max(0, -p[0]) * 0.05, p[1] - 0.6 * k, ...p.slice(2)] as Pt)), c),
        wash(smooth(at(h, [[-0.56, -0.31], [-0.2, -0.23], [0.2, -0.23], [0.56, -0.31], [0.3, -0.18], [0, -0.17], [-0.3, -0.18]]), true), shade, 0.55),
        crescents([...mirror(lit), ...at(h, [[0.3, -0.6], [0.06, -0.72]])], W * 0.065, true, light, 0.45),
        crescents([...mirror(dark), ...at(h, [[-0.3, -0.5], [-0.06, -0.4], [0.3, -0.36]])], W * 0.065, false, shade, 0.55),
        ink(coils([...mirror(curls), ...at(h, [[0, -0.6], [-0.2, -0.3], [0.24, -0.26]])], 1.3 * k), deep, 0.6 * k, 0.4),
      ],
    };
    return { front: [onHead("hair_back", { shapes: halo }), onHead("hair_front", front)], back: [onHead("hair_back", back)] };
  }, { bulk: HAIR_BULK.high, tags: ["textured", "coily", "casual", "formal", "medium"] }),

  // a very short natural coily cut: a crisp shape-up hairline and a close, fluffy edge
  hair_twa: hairPart("Teeny weeny afro", "çok kısa afro", (h, c, ctx) => {
    const { W, H, k } = h, ctr: Vec2 = [0, -H * 0.6], v = 1.5 * k, t = ctx.body.build === "toddler", n = t ? 18 : 24, amp = 0.016 * W;
    const deep = tone(c, "deep");
    const tx = 0.41 * W, yl = -H * 0.74, ys = headHalfWidth(h.shape, W, H, -H * 0.53) + 0.25 * k;
    const line: Pt[] = [[-tx - 0.4 * k, -H * 0.58, 0], [-tx + 0.5 * k, yl + 0.8 * k, 0], [-W * 0.2, yl - 0.2 * k], [0, yl - 0.4 * k], [W * 0.2, yl - 0.2 * k], [tx - 0.5 * k, yl + 0.8 * k, 0], [tx + 0.4 * k, -H * 0.58, 0]];
    const top = scallop(h.crown(v, PI * 0.985, PI * 2.015, n), ctr, amp);
    const tex = coils(at(h, [[-0.3, -0.86], [-0.1, -0.94], [0.12, -0.93], [0.3, -0.84], [-0.18, -0.8], [0.04, -0.82], [0.22, -0.77], [-0.38, -0.7], [0.4, -0.69], [-0.04, -0.98], [0.34, -0.94], [-0.3, -0.98]]), 0.6 * k);
    const front: Group = {
      shapes: [
        S([...top, [ys, -H * 0.53, 0], ...[...line].reverse(), [-ys, -H * 0.53, 0]], c),
        sheen(h, c, v - 1.2 * k, 1.2, 1.48, 1.2 * k, 0.4),
        ink(tex, deep, 0.45 * k, 0.5),
      ],
    };
    // the nape tapers: up to 0.3 H in the middle (0.22 H on a toddler), higher behind the ears, skin below
    const nape = t ? 0.22 : 0.3;
    const back: Group = {
      shapes: [
        S(backCap(scallop(h.crown(v, PI * 0.94, PI * 2.06, n + 2), ctr, amp), [[-W * 0.46, -H * (nape + 0.18), 0], [-W * 0.32, -H * (nape + 0.06)], [-W * 0.14, -H * nape, 0], [W * 0.14, -H * nape, 0], [W * 0.32, -H * (nape + 0.06)], [W * 0.46, -H * (nape + 0.18), 0]]), c),
        sheen(h, c, v - 1.2 * k, 1.52, 1.8, 1.2 * k, 0.4),
        ink(tex.mirrorX().move(0, H * 0.14), deep, 0.45 * k, 0.5),
      ],
    };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", back)] };
  }, { bulk: 1.5, tags: ["textured", "coily", "casual", "sport", "work", "school", "short"] }),

  // two round puffs high on the crown, tied at the base, a centre parting
  hair_afro_puffs: hairPart("Afro puffs", "iki afro topuz", (h, c, ctx) => {
    const { W, H, k } = h, v = 1.2 * k, small = ctx.body.build === "child" || ctx.body.build === "toddler";
    const shade = tone(c, "shade"), light = tone(c, "light"), deep = tone(c, "deep");
    // the puffs stand clear of the crown's top corners, so they read as two circles at 48 px
    const rx = (small ? 0.2 : 0.22) * W, ry = (small ? 0.185 : 0.2) * W, py = -1.04 * H, px = 0.36 * W;
    // a puff: its curls in shade, and again in the hair colour a little smaller and up towards the light
    const puff = (s: 1 | -1, lx: number): Shape[] => {
      const o: Vec2 = [s * px, py], amp = 0.032 * W, run = arcPoints(o[0], py, rx, ry, 0, PI * 2, 12);
      return [S(scallop(run, o, amp), shade), S(scallop(shadeIn(run, o, 1.8 * k, lx < 0 ? PI * 0.25 : PI * 0.75), o, amp), c)];
    };
    const tex = (side: 1 | -1): Shape[] => {
      const spots = (s: number, f: [number, number][]) => f.map(([x, y]): Vec2 => [s * px + x * rx, py + y * ry]);
      const lit = [...spots(-side, [[-0.4, -0.35], [0.1, -0.55], [-0.55, 0.15]]), ...spots(side, [[-0.4, -0.35], [0.1, -0.55], [-0.55, 0.15]])];
      const dark = [...spots(-side, [[0.45, 0.3], [0.05, 0.5]]), ...spots(side, [[0.45, 0.3], [0.05, 0.5]])];
      const curl = [...spots(-1, [[0, 0], [0.45, -0.2], [-0.3, 0.45]]), ...spots(1, [[0, 0], [0.45, -0.2], [-0.3, 0.45]])];
      return [crescents(lit, rx * 0.26, true, light, 0.45), crescents(dark, rx * 0.26, false, shade, 0.55), ink(coils(curl, 1.1 * k), deep, 0.55 * k, 0.45)];
    };
    // the tie round a puff's foot (the accent colour once there is one), along the edge it sits on
    const tie = (x: number, y: number, a: number): Shape => {
      const d: Vec2 = [Math.cos(a), Math.sin(a)], u: Vec2 = [-d[1], d[0]], wv = 0.075 * W, hv = 0.85 * k;
      const P = (p: number, q: number): Vec2 => [x + d[0] * p * wv + u[0] * q * hv, y + d[1] * p * wv + u[1] * q * hv];
      return S([P(-1, -1), P(0, -1.3), P(1, -1), P(1.05, 1), P(0, 1.3), P(-1.05, 1)], deep);
    };
    const edge = (s: 1 | -1) => { const [p, q] = h.crown(v, PI * (1.5 + s * 0.2), PI * (1.5 + s * 0.22), 1); return { p, a: Math.atan2(q[1] - p[1], q[0] - p[0]) }; };
    const parting = (y0: number, y1: number, clip: Path) => ink(smooth([[0, y0], [0.2 * k, (y0 + y1) / 2], [0, y1]], false), ctx.skin, 0.45 * k, 0.85, clip);
    const capPath = smooth(cap(h, h.crown(v, PI * 0.985, PI * 2.015, 10), hairline(h, 0.75, 0.64, 6), 0.53), true, 1);
    const pulls = new Path().add(smooth(h.arc(-3 * k, PI * 1.08, PI * 1.32, 4), false)).add(smooth(h.arc(-3 * k, PI * 1.68, PI * 1.92, 4), false)).add(smooth(at(h, [[-0.06, -0.78], [-0.14, -0.88], [-0.22, -0.95]]), false)).add(smooth(at(h, [[0.06, -0.78], [0.14, -0.88], [0.22, -0.95]]), false));
    const front: Group = {
      shapes: [
        { path: capPath, fill: c },
        ink(pulls, deep, 0.5 * k, 0.35),
        parting(-H * 0.75, -H - v, capPath),
        sheen(h, c, v - 1.2 * k, 1.12, 1.3, 1.3 * k, 0.4),
        ...([-1, 1] as const).map(s => { const e = edge(s); return tie(e.p[0], e.p[1], e.a); }),
      ],
    };
    const nape = 0.2, backPts = backCap(h.crown(v, PI * 0.9, PI * 2.1, 10), at(h, [[-0.46, -0.34], [-0.3, -nape - 0.04], [0, -nape], [0.3, -nape - 0.04], [0.46, -0.34]])), backPath = smooth(backPts, true, 1);
    const back: Group = {
      shapes: [
        { path: backPath, fill: c },
        ink(new Path().add(smooth(at(h, [[-0.36, -0.36], [-0.3, -0.66], [-0.24, -0.9]]), false)).add(smooth(at(h, [[0.36, -0.36], [0.3, -0.66], [0.24, -0.9]]), false)).add(smooth(at(h, [[-0.14, -0.26], [-0.16, -0.6], [-0.2, -0.9]]), false)).add(smooth(at(h, [[0.14, -0.26], [0.16, -0.6], [0.2, -0.9]]), false)), deep, 0.5 * k, 0.35),
        parting(-H * nape, -H - v, backPath),
        sheen(h, c, v - 1.2 * k, 1.68, 1.88, 1.3 * k, 0.4),
      ],
    };
    // under a cap or a beanie the puffs are pressed down to two 2 cm bumps of curls just under its band, both views
    const flatTop = (clip: Path | null | undefined) => { const t = clip ? clip.bounds()[1] : -Infinity; return t > -H * 0.82 ? t : null; };
    const bumps = (top: number): Shape[] => {
      const y = top + 0.08 * H, run = (s: 1 | -1): Pt[] => { const x = s * (headHalfWidth(h.shape, W, H, y) + 1.6 * k), o: Vec2 = [x, y]; return scallop(arcPoints(x, y, 3.2 * k, 2.8 * k, 0, PI * 2, 7), o, 0.7 * k); };
      return [S(run(-1), c), S(run(1), c), ink(coils([[-(headHalfWidth(h.shape, W, H, y) + 1.4 * k), y], [headHalfWidth(h.shape, W, H, y) + 1.4 * k, y + 0.5 * k]], 0.9 * k), deep, 0.5 * k, 0.45)];
    };
    const fTop = flatTop(ctx.clip), bTop = flatTop(ctx.clipBack ?? ctx.clip);
    return {
      front: [onHead("hair_back", { shapes: fTop !== null ? bumps(fTop) : [...puff(-1, -1), ...puff(1, -1), ...tex(1)] }), onHead("hair_front", front)],
      back: [onHead("hair_back", back), onHead("hair_front", { shapes: bTop !== null ? bumps(bTop) : [...puff(-1, 1), ...puff(1, 1), ...tex(-1), tie(-px, py + ry * 0.9, 0.12), tie(px, py + ry * 0.9, -0.12)] })],
    };
  }, { bulk: 8, tags: ["textured", "coily", "casual", "school", "updo"] }),

  // a centre parting and two plaits from behind the ears over the shoulders, tied at the ends
  hair_braids_double: hairPart("Two braids", "iki saç örgüsü", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body, v = 2 * k, toddler = b.build === "toddler";
    const deep = tone(c, "deep"), shade = tone(c, "shade");
    const leaves = toddler ? 5 : 7, len = b.torsoL * (toddler ? 0.26 : b.build === "child" ? 0.42 : 0.5);
    const plaits = ([-1, 1] as const).map(s => plait(hang(b, h, s, 0.42, 0.22, chestX(b, 0.45), len), 0.09 * W, 0.065 * W, leaves));
    const lock: Group = {
      shapes: [
        ...plaits.flatMap(p => [{ path: p.body, fill: c } as Shape]),
        ink(plaits.reduce((q, p) => q.add(p.creases), new Path()), deep, 0.5 * k, 0.55),
        ...plaits.flatMap(p => tieTuft(p.end, p.dir, 0.09 * W, c, 3 * k)),
      ],
    };
    const capPath = smooth(cap(h, h.crown(v, PI * 0.985, PI * 2.015, 10), hairline(h, 0.74, 0.64, 6), 0.54), true, 1);
    const sweep = new Path();
    for (const s of [-1, 1]) for (const f of [0.35, 0.7]) sweep.add(smooth([[s * W * 0.03, -H * (0.99 - f * 0.06)], [s * W * (0.18 + f * 0.1), -H * (0.92 - f * 0.12)], [s * W * (0.36 + f * 0.06), -H * (0.68 - f * 0.08)]], false));
    const front: Group = { shapes: [{ path: capPath, fill: c }, ink(sweep, deep, 0.5 * k, 0.4), ink(smooth([[0, -H * 0.74], [0, -H - v]], false), ctx.skin, 0.45 * k, 0.85, capPath), sheen(h, c, v - 1.2 * k, 1.12, 1.32, 1.3 * k, 0.45)] };
    // behind the head, the hair gathered down to the roots of the plaits, beside the neck
    const behind = S([...h.crown(v, PI * 0.9, PI * 2.1, 10), [W * 0.5, -H * 0.2], [W * 0.43, -H * 0.06], [W * 0.3, -H * 0.12], [0, -H * 0.14], [-W * 0.3, -H * 0.12], [-W * 0.43, -H * 0.06], [-W * 0.5, -H * 0.2]], shade);
    // from behind: the parting down to the nape, the hair pulled to each side, and the plaits' roots going round the neck
    const backPath = smooth(backCap(h.crown(v, PI * 0.88, PI * 2.12, 10), at(h, [[-0.46, -0.3], [-0.3, -0.17], [0, -0.2], [0.3, -0.17], [0.46, -0.3]])), true, 1);
    // the roots go over the shoulders to the front, under the arms (the arm is drawn over them in the back view)
    const sx = b.shoulderW / 2 - b.armW[0] * 0.5, sy = b.neckL + b.armW[0] * 0.75;
    const roots = ([-1, 1] as const).map(s => plait([[s * W * 0.3, -H * 0.22], [s * (W * 0.36 + sx) / 2, -H * 0.02], [s * sx * 0.98, sy]], 0.09 * W, 0.085 * W, toddler ? 3 : 4));
    const pulled = new Path();
    for (const s of [-1, 1]) for (const f of [0.3, 0.65]) pulled.add(smooth([[s * W * 0.03, -H * (0.98 - f * 0.4)], [s * W * (0.16 + f * 0.12), -H * (0.6 - f * 0.2)], [s * W * 0.3, -H * 0.24]], false));
    const back: Group = {
      shapes: [
        ...roots.map(p => ({ path: p.body, fill: c } as Shape)), ink(roots.reduce((q, p) => q.add(p.creases), new Path()), deep, 0.5 * k, 0.55),
        { path: backPath, fill: c }, ink(pulled, deep, 0.5 * k, 0.4), ink(smooth([[0, -H * 0.2], [0, -H - v]], false), ctx.skin, 0.45 * k, 0.85, backPath),
        sheen(h, c, v - 1.2 * k, 1.6, 1.8, 1.3 * k, 0.45),
      ],
    };
    return { front: [onHead("hair_back", { shapes: [behind] }), onHead("hair_front", front), onNeck(lock)], back: [onHead("hair_back", back)] };
  }, { bulk: 2, tags: ["textured", "braids", "casual", "school", "sport", "medium"] }),

  // many thin braids from square partings: a curtain behind, two framing the face each side, three more over each shoulder
  hair_braids_box_long: hairPart("Long box braids", "uzun afro örgü", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body, v = 1.5 * k, child = b.build === "child" || b.build === "toddler", sw = b.shoulderW / 2;
    const bw = 0.056 * W, part = mix(ctx.skin, c, 0.3), dash: [number, number] = [bw * 0.32, bw * 0.4];
    const capPath = smooth(cap(h, h.crown(v, PI * 0.985, PI * 2.015, 10), scallop(hairline(h, 0.74, 0.64, 10), [0, -H * 1.6], 0.35 * k), 0.54), true, 1);
    const front: Group = { shapes: [{ path: capPath, fill: c }, ink(bricks(h, [-4 * k, -8.5 * k], 5, 1.1, 1.9), part, 0.32 * k, 0.7, capPath), sheen(h, c, v - 1 * k, 1.14, 1.34, 1.2 * k, 0.4)] };
    // behind the head, a dark mass beside the neck and two braids each side framing the face (behind the ears)
    const mass = S([...h.crown(v + 0.8 * k, PI * 0.86, PI * 2.14, 10), [W * 0.56, -H * 0.25], [Math.min(W * 0.56, sw - 0.5), b.neckL + 3 * k], [-Math.min(W * 0.56, sw - 0.5), b.neckL + 3 * k], [-W * 0.56, -H * 0.25]], between(c));
    const framing = ([-1, 1] as const).flatMap(s => [0, 1].map((j): Vec2[] => [[s * (W * 0.45 + j * bw * 1.25), -H * 0.62], [s * (W * 0.49 + j * bw * 1.25), -H * 0.3], [s * (W * 0.48 + j * bw * 1.25), -H * (0.02 + j * 0.06)]]));
    // three each side over the shoulders onto the chest, their tips uneven
    const len = b.torsoL * (child ? 0.45 : 0.65);
    const hanging = ([-1, 1] as const).flatMap(s => [0, 1, 2].map(j => hangLean(b, h, s, 0.36 + j * 0.05, chestX(b, 0.08 + j * 0.42), len + (rnd(j * 5 + s + 1) - 0.5) * 4 * k, 0.4 * k, j * 3 + s)));
    // from behind: the scalp parted into a grid of boxes, a thin braid from each box of the lower
    // three rows lying down over the head and hanging to mid-back, the upper ones over the lower, tips staggered
    const blen = b.neckL + b.torsoL * (child ? 0.45 : 0.7), bx = Math.max(W * 0.5, sw * 0.92);
    const tiers: [number, number, number][] = child ? [[0.8, 0.22, 4], [0.64, 0.36, 5], [0.5, 0.44, 6]] : [[0.8, 0.24, 5], [0.65, 0.38, 6], [0.5, 0.45, 7]];
    const { spines, roots } = fall(h, tiers, bx, blen, 2 * k, 0.3 * k, 11);
    const backMass = S([...h.crown(v + 0.8 * k, PI * 0.94, PI * 2.06, 10), [W * 0.53, -H * 0.28], [bx * 0.96, blen * 0.5], [bx * 0.92, blen - 2 * k], [-bx * 0.92, blen - 2 * k], [-bx * 0.96, blen * 0.5], [-W * 0.53, -H * 0.28]], between(c));
    // the scalp is flat (no paper rim, so no seam where the braids leave it): the partings run round
    // the head between the rows and across between the boxes, the root of each braid in a box
    const scalp = smooth([...h.crown(v, PI * 0.88, PI * 2.12, 10), [W * 0.3, -H * 0.24], [-W * 0.3, -H * 0.24]], true, 1), grid = new Path().add(smooth([[0, -H * 0.88], [0, -H - v]], false));
    for (const [y, spread] of [[0.88, 0.2], [0.72, 0.32], [0.57, 0.42]] as const) grid.add(smooth([[-spread * W * 1.15, -H * (y - 0.04)], [0, -H * y], [spread * W * 1.15, -H * (y - 0.04)]], false));
    let r0 = 0;
    for (const [, , n] of [...tiers].reverse()) { const row = roots.slice(r0, r0 + n); r0 += n; row.slice(1).forEach(([x, y], i) => { const m = (x + row[i][0]) / 2; grid.add(smooth([[m, y - 0.07 * H], [m, y + 0.06 * H]], false)); }); }
    const back: Group = { shapes: [wash(scalp, c, 1), ink(grid, part, 0.32 * k, 0.75, scalp), sheen(h, c, v - 1 * k, 1.66, 1.86, 1.2 * k, 0.4)] };
    return {
      front: [onHead("hair_back", { shapes: [mass, ...cords(framing, c, bw, dash)] }), onHead("hair_front", front), onNeck({ shapes: cords(hanging, c, bw, dash) })],
      back: [onHead("hair_back", { shapes: [backMass] }), onHead("hair_back", back), onHead("hair_front", { shapes: cords(spines, c, bw * 0.85, dash) })],
    };
  }, { bulk: 3, builds: ["adult", "elder", "child"], tags: ["textured", "braids", "protective", "casual", "formal", "long"] }),

  // rows braided flat to the scalp from the hairline to the nape
  hair_cornrows_straight: hairPart("Cornrows", "yatık örgüler", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body.build, v = 0.6 * k, rows = b === "toddler" ? 6 : b === "child" ? 7 : 9;
    const deep = tone(c, "deep"), light = tone(c, "light"), part = mix(ctx.skin, tone(ctx.skin, "shade"), 0.4);
    // between two partings, a row: a light line along its lit side and its stitches as a dashed stroke down its middle (no geometry of their own)
    const ridges = (lines: Vec2[][]) => {
      const parts = new Path(), mids = new Path(), lit = new Path();
      for (const l of lines) parts.add(smooth(l, false));
      for (let i = 0; i < lines.length - 1; i++) {
        const a = lines[i], z = lines[i + 1];
        mids.add(smooth(a.map((p, j): Vec2 => [(p[0] + z[j][0]) / 2, (p[1] + z[j][1]) / 2]), false));
        lit.add(smooth(a.map((p, j): Vec2 => [p[0] + (z[j][0] - p[0]) * 0.28, p[1] + (z[j][1] - p[1]) * 0.28]), false));
      }
      return { parts, mids, lit };
    };
    const stitches = (mids: Path, clip: Path, width: number): Shape => ({ path: mids, stroke: { color: deep, width, dash: [0.5 * k, 0.9 * k], cap: "butt" }, flat: true, opacity: 0.5, clip });
    // front: the rows rise from the hairline over the crown, so their partings run like meridians
    const capPts = cap(h, h.crown(v, PI * 0.99, PI * 2.01, 12), [[-W * 0.43, -H * 0.6, 0], [-W * 0.4, -H * 0.71, 0], [-W * 0.2, -H * 0.738], [0, -H * 0.742], [W * 0.2, -H * 0.738], [W * 0.4, -H * 0.71, 0], [W * 0.43, -H * 0.6, 0]], 0.55), capPath = smooth(capPts, true, 1);
    const fl: Vec2[][] = [];
    for (let i = 0; i <= rows; i++) { const u = -1 + 2 * i / rows, x = u * W * 0.4; fl.push([[x, -H * (0.72 + 0.02 * u * u) + 0.4 * k], [x * 1.12, -H * 0.86], [x * 0.95, -H * 0.98], [x * 0.55, -H * 1.08]]); }
    const f = ridges(fl);
    const front: Group = { shapes: [{ path: capPath, fill: c }, ink(f.lit, light, 0.9 * k, 0.3, capPath), stitches(f.mids, capPath, W * 0.4 / rows), ink(f.parts, part, 0.4 * k, 0.9, capPath)] };
    // back: the rows run from the crown down to the nape, closing in a little, with short loose ends
    const nape = -H * 0.22, backPts = backCap(h.crown(v, PI * 0.9, PI * 2.1, 12), at(h, [[-0.46, -0.36], [-0.32, -0.24], [0, -0.22], [0.32, -0.24], [0.46, -0.36]])), backPath = smooth(backPts, true, 1);
    const bl: Vec2[][] = [];
    for (let i = 0; i <= rows; i++) { const u = -1 + 2 * i / rows; bl.push([[u * W * 0.22, -H * 1.06], [u * W * 0.5, -H * 0.8], [u * W * 0.44, -H * 0.5], [u * W * 0.34, nape - 2 * k]]); }
    const r = ridges(bl), ends = new Path();
    for (let i = 0; i < rows; i++) { const u = -1 + 2 * (i + 0.5) / rows, x = u * W * 0.34, w = W * 0.3 / rows; ends.add(smooth([[x - w, nape - 1.5 * k], [x - w * 0.8, nape + 1.5 * k], [x - w * 0.2, nape + 3.2 * k, 0], [x + w * 0.2, nape + 2.4 * k], [x + w * 0.7, nape + 3 * k, 0], [x + w, nape - 1.5 * k]], true)); }
    const back: Group = { shapes: [{ path: ends, fill: c }, { path: backPath, fill: c }, ink(r.lit.mirrorX(), light, 0.9 * k, 0.3, backPath), stitches(r.mids, backPath, W * 0.36 / rows), ink(r.parts, part, 0.4 * k, 0.9, backPath)] };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", back)] };
  }, { bulk: 0.5, tags: ["textured", "braids", "protective", "casual", "sport", "school", "short"] }),

  // long locs: round roots at the hairline, a curtain behind, three over each shoulder
  hair_locs_long: hairPart("Long locs", "uzun rasta saç", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body, v = 3 * k, child = b.build === "child" || b.build === "toddler", sw = b.shoulderW / 2, ctr: Vec2 = [0, -H * 0.6];
    const deep = tone(c, "deep"), light = tone(c, "light"), lw = 0.064 * W, dash: [number, number] = [0.45 * k, 5.5 * k];
    // front: a centre parting, the locs lying back over the head to each side, round tops at the hairline
    const capPath = smooth(cap(h, scallop(h.crown(v, PI * 0.985, PI * 2.015, 12), ctr, 0.02 * W), scallop(hairline(h, 0.74, 0.64, 9), [0, -H * 1.6], 0.022 * W), 0.54), true, 1);
    const lie = new Path(), lift = new Path();
    for (const s of [-1, 1]) for (const f of [0.25, 0.55, 0.85]) {
      const pts: Vec2[] = [[s * W * 0.03, -H * (1.0 - f * 0.05)], [s * W * (0.2 + f * 0.2), -H * (0.9 - f * 0.16)], [s * W * (0.4 + f * 0.08), -H * (0.7 - f * 0.12)]];
      lie.add(smooth(pts, false));
      if (s < 0 || f < 0.5) lift.add(smooth(pts.map(([x, y]): Vec2 => [x - s * 0.6 * k, y - 1.1 * k]), false));
    }
    const capG: Group = { shapes: [{ path: capPath, fill: c }, ink(lie, deep, 0.5 * k, 0.45, capPath), ink(lift, light, 0.5 * k, 0.35, capPath), ink(smooth([[0, -H * 0.74], [0, -H - v]], false), mix(ctx.skin, c, 0.3), 0.4 * k, 0.8, capPath)] };
    // behind: a dark mass beside the neck and two locs each side framing the face, behind the ears
    const mass = S([...h.crown(v + 0.5 * k, PI * 0.86, PI * 2.14, 10), [W * 0.58, -H * 0.25], [Math.min(W * 0.58, sw - 0.5), b.neckL + 3 * k], [-Math.min(W * 0.58, sw - 0.5), b.neckL + 3 * k], [-W * 0.58, -H * 0.25]], between(c));
    const framing: Vec2[][] = [];
    for (const s of [-1, 1] as const) for (let j = 0; j < 2; j++) framing.push([[s * (W * 0.45 + j * lw * 1.2), -H * 0.66], [s * (W * 0.5 + j * lw * 1.2), -H * 0.36], [s * (W * 0.49 + j * lw * 1.2), -H * (0.04 + j * 0.06) + (rnd(j + s) - 0.5) * 2 * k]]);
    // over the shoulders, in front
    const len = b.torsoL * (child ? 0.4 : 0.55), front: Vec2[][] = [];
    for (const s of [-1, 1] as const) for (let j = 0; j < 3; j++) front.push(hangLean(b, h, s, 0.34 + j * 0.05, chestX(b, 0.05 + j * 0.5), len + (rnd(j * 7 + s) - 0.5) * 8 * k, 0.7 * k, j * 5 + s + 3));
    // from behind: fewer, thicker locs than box braids, no partings: each comes over the top of the head
    // (its round end on the crown's edge, so the silhouette is a row of locs) and hangs to about the waist, the hem uneven
    const blen = b.neckL + b.torsoL * (child ? 0.5 : 0.8), bx = Math.max(W * 0.5, sw * 0.92), n = child ? 8 : 9, edge = headHalfWidth(h.shape, W, H, -H * 0.3) * 1.04;
    const rim = h.crown(v - 0.4 * k, PI, PI * 2, 40), topAt = (x: number) => rim.reduce((a, p) => Math.abs(p[0] - x) < Math.abs(a[0] - x) ? p : a)[1];
    const spines: Vec2[][] = [];
    for (let i = 0; i < n; i++) {
      const f = -1 + 2 * i / (n - 1), x0 = f * W * 0.44, w = (q: number) => (rnd(i * 5 + q + 23) - 0.5) * 1.8 * k;
      spines.push([[x0, topAt(x0) + 0.25 * lw + rnd(i + 40) * 2 * k], [x0 * 1.06 + w(4) * 0.3, -H * 0.7], [f * edge + w(1) * 0.3, -H * 0.24], [f * bx * 0.9 + w(2), blen * 0.5], [f * bx * 0.86 + w(3), blen + (rnd(i * 3 + 7) - 0.5) * 9 * k]]);
    }
    const backMass = S([...h.crown(v + 0.5 * k, PI * 0.94, PI * 2.06, 10), [W * 0.55, -H * 0.28], [bx * 0.96, blen * 0.5], [bx * 0.92, blen - 3 * k], [-bx * 0.92, blen - 3 * k], [-bx * 0.96, blen * 0.5], [-W * 0.55, -H * 0.28]], between(c));
    // the light along the upper lengths of the locs on the lit side (+x from behind), where they turn over the crown
    const lit = new Path();
    spines.filter(([r]) => r[0] > 0).forEach(([r, m]) => lit.add(smooth([[r[0] - 0.2 * lw, r[1] + 1.5 * k], [m[0] - 0.2 * lw, m[1]]], false)));
    return {
      front: [onHead("hair_back", { shapes: [mass, ...cords(framing, c, lw, dash, 0.95)] }), onHead("hair_front", capG), onNeck({ shapes: cords(front, c, lw, dash, 0.95) })],
      back: [onHead("hair_back", { shapes: [backMass] }), onHead("hair_front", { shapes: [...cords(spines.filter((_, i) => i % 2), c, lw * 1.3, dash, 0.95), ...cords(spines.filter((_, i) => !(i % 2)), c, lw * 1.3, [dash[0], dash[1] * 0.8], 0.95), ink(lit, light, lw * 0.3, 0.4)] })],
    };
  }, { bulk: 3, builds: ["adult", "elder", "child"], tags: ["textured", "locs", "casual", "long"] }),

  // short two-strand twists: standing out round the crown, a fringe of them, more falling to the jaw behind
  hair_twists_short: hairPart("Short twists", "kısa twist örgü", (h, c, ctx) => {
    const { W, H, k } = h, few = ctx.body.build === "toddler", v = 3 * k, tw = 0.074 * W, dash: [number, number] = [tw * 0.2, tw * 0.3];
    const shade = between(c);
    // a twist: a short bent cord from its root along `d`
    const twist = (p0: Vec2, d: Vec2, len: number, bend: number): Vec2[] => {
      const n: Vec2 = [-d[1], d[0]], P = (t: number, b: number): Vec2 => [p0[0] + d[0] * len * t + n[0] * bend * b, p0[1] + d[1] * len * t + n[1] * bend * b];
      return [P(0, 0), P(0.5, 1), P(1, 2.2)];
    };
    // twists that stand out from the scalp round the crown, drooping more towards the sides
    const ring = (count: number, a0: number, a1: number, droop: number, seed: number): Vec2[][] => {
      const out: Vec2[][] = [];
      for (let i = 0; i < count; i++) {
        const a = PI * (a0 + (a1 - a0) * i / (count - 1)), p = h.crown(v - 3.5 * k, a, a, 1)[0], d0: Vec2 = [Math.cos(a), Math.sin(a) + Math.abs(Math.cos(a)) * droop], l = Math.hypot(d0[0], d0[1]);
        out.push(twist(p, [d0[0] / l, d0[1] / l], W * (0.1 + rnd(i + seed) * 0.04), (rnd(i * 3 + seed) - 0.5) * 1.4 * k));
      }
      return out;
    };
    // front: a dark base, the crown's twists standing out, a fringe falling to above the brows
    const base = S(cap(h, h.crown(v, PI * 0.985, PI * 2.015, 10), hairline(h, 0.76, 0.64, 6), 0.54), shade);
    const tops = ring(few ? 8 : 11, 1.04, 1.96, 1.4, 0);
    const fringe: Vec2[][] = [], fn = few ? 4 : 5;
    for (let i = 0; i < fn; i++) { const u = -1 + 2 * i / (fn - 1); fringe.push(twist([u * W * 0.3, -H * 0.88], [u * 0.3, 1], H * 0.15 + (1 - u * u) * 0.4 * k, -u * 0.8 * k)); }
    // behind the head: more twists falling out and down beside the ears to the jaw
    const sides: Vec2[][] = [];
    for (const s of [-1, 1] as const) for (let j = 0; j < (few ? 2 : 3); j++) {
      const d0: Vec2 = [s * (0.5 - j * 0.1), 1], l = Math.hypot(d0[0], d0[1]);
      sides.push(twist([s * W * (0.42 - j * 0.01), -H * (0.68 - j * 0.15)], [d0[0] / l, d0[1] / l], W * (0.13 + rnd(j + s * 3 + 60) * 0.05), -s * 0.6 * k));
    }
    const behind = S([...h.crown(v, PI * 0.88, PI * 2.12, 10), [W * 0.52, -H * 0.14], [0, -H * 0.12], [-W * 0.52, -H * 0.14]], shade);
    // from behind: the crown's twists standing out, then twists hanging from the crown in staggered
    // rows, each row's rounded tips over the roots of the next, the last over the hem at the nape
    const rows: Vec2[][] = [];
    for (const [r, y, half, n, len] of (few ? [[0, 0.92, 0.2, 4, 0.2], [1, 0.72, 0.36, 5, 0.22], [2, 0.52, 0.42, 5, 0.24]] : [[0, 0.93, 0.22, 5, 0.2], [1, 0.75, 0.36, 6, 0.22], [2, 0.56, 0.43, 7, 0.24]]) as [number, number, number, number, number][]) {
      for (let i = 0; i < n; i++) { const u = -1 + 2 * i / (n - 1), x = u * W * half; rows.push(twist([x, -H * y], [u * 0.28, 1], H * (len + rnd(i + r * 11) * 0.04), (rnd(i * 7 + r) - 0.5) * 1.6 * k)); }
    }
    const backBase = S(backCap(h.crown(v, PI * 0.9, PI * 2.1, 10), at(h, [[-0.47, -0.36], [-0.22, -0.3], [0.22, -0.3], [0.47, -0.36]])), shade);
    return {
      front: [onHead("hair_back", { shapes: [behind, ...cords(sides, c, tw, dash, 0.7, 0.4)] }), onHead("hair_front", { shapes: [base, sheen(h, shade, v - 2 * k, 1.2, 1.4, 1.2 * k, 0.3), ...cords([...tops, ...fringe], c, tw, dash, 0.7, 0.4)] })],
      back: [onHead("hair_back", { shapes: [backBase, ...cords(ring(few ? 8 : 11, 1.06, 1.94, 1.4, 100), c, tw, dash, 0.7, 0.4), ...cords(rows, c, tw, dash, 0.7, 0.4)] })],
    };
  }, { bulk: HAIR_BULK.mid, tags: ["textured", "twists", "protective", "casual", "school", "short"] }),

  // the hair parted into sections, each twisted and wound into a round knot on the scalp
  hair_knots_bantu: hairPart("Bantu knots", "Bantu düğümleri", (h, c, ctx) => {
    const { W, H, k } = h, b = ctx.body.build, v = 1.2 * k, r = 0.072 * W;
    const light = tone(c, "light"), part = mix(ctx.skin, tone(ctx.skin, "shade"), 0.35);
    const onCrown = (a: number): Vec2 => h.crown(v + r * 0.3, PI * a, PI * a, 1)[0];
    // a knot is the wearer's own hair wound up, so it is flat (no paper rim): a soft shadow on the
    // section under it, a round in the hair colour, its shaded lower right and lit upper left, and a
    // short spiral of the wound twist, the marks of every knot in one path each
    const knotShapes = (spots: [Vec2, number][]): Shape[] => {
      const spiral = new Path(), dark = new Path(), under = new Path(), body = new Path();
      spots.forEach(([[x, y], s], i) => {
        under.add(ellipse(x + r * s * 0.16, y + r * s * 0.2, r * s * 1.04, r * s * 0.98));
        body.add(ellipse(x, y, r * s * (1 + rnd(i) * 0.06), r * s * (0.92 + rnd(i + 5) * 0.06)));
        dark.add(smooth(arcPoints(x, y, r * s * 0.72, r * s * 0.68, -0.15 * PI, 0.75 * PI, 3), false));
        spiral.add(smooth(([[-0.75, 0.68], [-0.1, 0.58], [0.5, 0.44], [1.05, 0.3], [1.55, 0.12]] as const).map(([a, q]): Vec2 => [x + Math.cos(PI * a) * r * s * q, y + Math.sin(PI * a) * r * s * q]), false));
      });
      const mark = mix(between(c), tone(c, "deep"), 0.45);
      return [wash(under, mark, 0.3), wash(body, c, 1), ink(dark, mark, r * 0.36, 0.45), ink(moons(spots.map(([p]) => p), r * 0.8, true), light, r * 0.24, 0.5), ink(spiral, mark, 0.5 * k, 0.7)];
    };
    // the partings: round the head between the rows and across between the knots of each row (skin-tone lines, cut to the hair)
    const partings = (rows: Vec2[][], between: number[], half: number): Path => {
      const out = new Path();
      for (const y of between) out.add(smooth([[-half * W, -H * (y - 0.035)], [0, -H * y], [half * W, -H * (y - 0.035)]], false));
      for (const row of rows) row.slice(1).forEach(([x, y], i) => { const m = (x + row[i][0]) / 2; out.add(smooth([[m, y - r * 0.95], [m, y + r * 0.95]], false)); });
      return out;
    };
    const top = b === "toddler" ? [1.38, 1.62] : [1.33, 1.5, 1.67], low = b === "toddler" ? [-0.15, 0.15] : [-0.24, 0, 0.24];
    const ftop = top.map(a => onCrown(a)), fside = [1.13, 1.87].map(a => onCrown(a)), flow = low.map((x): Vec2 => [x * W, -H * 0.79]);
    const fspots: [Vec2, number][] = [...ftop.map((p): [Vec2, number] => [p, 1]), ...fside.map((p): [Vec2, number] => [p, 0.95]), ...flow.map((p): [Vec2, number] => [p, 1])];
    const capPath = smooth(cap(h, h.crown(v, PI * 0.985, PI * 2.015, 10), hairline(h, 0.74, 0.64, 6), 0.54), true, 1);
    const front: Group = { shapes: [{ path: capPath, fill: c }, ink(partings([ftop, [fside[0], ...flow, fside[1]]], [0.9], 0.42), part, 0.45 * k, 0.85, capPath), ...knotShapes(fspots)] };
    // from behind: rows over the crown and down the back of the head, then a row of smaller ones inside the nape
    const rowsB: [number[], number][] = b === "toddler" ? [[[-0.2, 0.2], -0.72], [[-0.3, 0, 0.3], -0.5]] : [[[-0.36, -0.12, 0.12, 0.36], -0.72], [[-0.24, 0, 0.24], -0.5]];
    const btop = [onCrown(1.08), ...top.map(a => onCrown(a)), onCrown(1.92)], brows = rowsB.map(([xs, y]) => xs.map((x): Vec2 => [x * W, y * H])), bnape = [-0.17, 0, 0.17].map((x): Vec2 => [x * W, -H * 0.37]);
    const bspots: [Vec2, number][] = [...btop.map((p, i): [Vec2, number] => [p, i === 0 || i === btop.length - 1 ? 0.95 : 1]), ...brows.flat().map((p): [Vec2, number] => [p, 1]), ...bnape.map((p): [Vec2, number] => [p, 0.72])];
    const backPath = smooth(backCap(h.crown(v, PI * 0.9, PI * 2.1, 10), at(h, [[-0.45, -0.34], [-0.26, -0.26], [0, -0.24], [0.26, -0.26], [0.45, -0.34]])), true, 1);
    const bparts = partings([btop, ...brows, bnape], [0.84, 0.61, 0.43], 0.5).add(smooth([[0, -H * 0.26], [0, -H * 0.3]], false));
    const back: Group = { shapes: [{ path: backPath, fill: c }, ink(bparts, part, 0.38 * k, 0.75, backPath), ...knotShapes(bspots)] };
    return { front: [onHead("hair_front", front)], back: [onHead("hair_back", back)] };
  }, { bulk: HAIR_BULK.mid, tags: ["textured", "coily", "protective", "traditional", "casual"] }),
};
