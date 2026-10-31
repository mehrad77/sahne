// Things worn on the body, in four slots: `neck` scarves, a shawl, a lanyard, necklaces and
// pendants (`wear.neck`), `wrist` a watch, prayer beads, a bangle (`wear.wrist`), `hands` a ring and
// henna (`wear.hands`), `waist` aprons and belts (`wear.waist`).
//
// THE BODY-ACCESSORIES ARTIST'S FILE: add parts to `ACCESSORIES` (ids: neck `neck_ scarf_ tie_
// lanyard_ shawl_`, wrist `watch_ bracelet_ bangle_ tesbih_ wrist_`, hands `ring_ hand_`, waist
// `apron_ belt_ bag_`, permanent). Layers: what lies over the chest and a coat is `chest_over`
// (scarves, lanyards, pendants, aprons), the wrist `over_sleeve` on the hand bone (over every
// sleeve), the hands `hand` with one item per hand shape (`HAND_SHAPES`, `alt: { key: "hand_r",
// value: shape }`), placed with `ringAt` or clipped to `handOutline`. Metal is the `metal` or
// `fabmetal` palette. One-sided parts say `sides` and draw `sidesOf(ctx.side)` (+x is the wearer's
// left in both views). Faith pendants come as a set and are never locked.
//
// Where things sit: neck pieces on the spine bone, the shoulder line at y = -torsoL, hanging inside
// the arms (`chestIn`); wrist pieces on the hand bone a little above the wrist pivot (`wristAt`),
// as wide as whatever sleeve covers the wrist there (`wristWidth` reads the worn clothes); aprons
// on the spine bone with the waist line at y = -0.21 torsoL. Small metal and beads use a thin paper
// rim (`edge`), and every group starts with a shape that casts no shadow, so the pieces after it
// lie on the clothes with the paper's soft shadow.

import { rrect, rect, ellipse, circle, poly, band, smooth, tone, mix, luma, Path, type BodyDims, type PartDef, type PartCtx, type PartOut, type Group, type Item, type Shape, type Vec2 } from "sahne";
import { named, S, P, line, flat, sidesOf, printed, ringAt, handOutline, HAND_SHAPES, lensAlpha, type Pt } from "./draw/index.ts";

// ---- shared measures ----------------------------------------------------------------------------------

/** The build's scale for small things (a pendant, a watch): 1 for adults, 0.8 for children, 0.74 for toddlers. */
const kOf = (b: BodyDims) => b.headH / 50;
/** The inner edge of a hanging arm at the chest (cm from the centre line): what hangs on the chest stays inside it. */
const chestIn = (b: BodyDims) => b.shoulderW / 2 - b.armW[0];
/** The top of `apron_shop`'s bib on the spine bone: a pendant worn with it is shortened to sit above it. */
const bibTop = (b: BodyDims) => -b.torsoL + 9;
/** A first shape that draws nothing, so the group's real first piece casts the paper's soft shadow on the clothes under it. */
const lift = (): Shape => ({ path: rect(0, 0, 0.01, 0.01), fill: "#000000", flat: true, opacity: 0 });
/** A light or a dark piece of paper (a card, a dial) in the colour of what it belongs to. */
const paper = (c: string) => mix(c, "#FFFDF6", 0.9);
const ink = (c: string) => mix(c, "#1C1614", 0.82);

/** A path through points rotated by `a` (radians) about (0, 0) and moved to `at`. */
const placed = (p: Path, at: Vec2, a = 0): Path => p.transform([Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), at[0], at[1]]);

/** A five-pointed star of outer radius `r` at `c`, one point at angle `a`. */
function star(c: Vec2, r: number, a = -Math.PI / 2): Path {
  const pts: Vec2[] = [];
  for (let i = 0; i < 10; i++) { const t = a + i * Math.PI / 5, q = i % 2 ? r * 0.4 : r; pts.push([c[0] + Math.cos(t) * q, c[1] + Math.sin(t) * q]); }
  return poly(pts);
}

// ---- necklaces --------------------------------------------------------------------------------------

/**
 * A fine chain round the neck, front and back, ending at a bail `depth` × torsoL below the shoulder
 * line (raised over a shop apron's bib by the pendant's `drop`). Returns the chain's shapes (flat:
 * a soft line under a metal line), the bail point and the nape's chain for the back.
 */
function chain(ctx: PartCtx, c: string, depth: number, drop: number, w = 0.24) {
  const b = ctx.body, T = b.torsoL, k = kOf(b), nx = b.neckW / 2 - 0.3, up = -T - Math.min(2, b.neckL * 0.45);
  let y = -T + depth * T + (ctx.avatar.body?.shape === "round" ? 1 : 0);
  if (ctx.avatar.wear?.waist?.id === "apron_shop") y = Math.min(y, bibTop(b) - drop - 0.6);
  const bail: Vec2 = [0, y];
  const pts: Vec2[] = [[-nx, up], [-nx * 1.02, -T + 1], [-nx * 0.55, y - (y + T) * 0.22], [0, y], [nx * 0.55, y - (y + T) * 0.22], [nx * 1.02, -T + 1], [nx, up]];
  const nape: Vec2[] = [[-nx, up - 0.4], [-nx * 0.5, -T - 0.4], [0, -T - 0.1], [nx * 0.5, -T - 0.4], [nx, up - 0.4]];
  const strand = (p: Vec2[]): Shape[] => [
    line(p.map(([x, y]) => [x + 0.12, y + 0.22] as Vec2), "#281810", w * k + 0.1, 0.22),
    line(p, c, w * k, 1),
    line(p.slice(0, 3), tone(c, "light"), w * k * 0.45, 0.8),
  ];
  const clasp: Shape = P(rrect(nx * 0.3 - 0.35 * k, -T - 0.55 - 0.25 * k, 0.7 * k, 0.5 * k, 0.2 * k), c);
  return { bail, front: strand(pts), back: [...strand(nape), clasp] };
}

/** A pendant on a chain: the chain, then the pendant's shapes in its own frame (the bail at (0, 0), hanging down `h` cm). */
function pendant(ctx: PartCtx, chainColor: string, h: number, draw: (k: number) => Shape[], depth = 0.22, w?: number): PartOut {
  const k = kOf(ctx.body) * 1.15, ch = chain(ctx, chainColor, depth, h * k, w);
  const ring: Shape = { path: circle(ch.bail[0], ch.bail[1] + 0.22 * k, 0.3 * k), stroke: { color: chainColor, width: 0.16 * k }, flat: true };
  const own = draw(k).map(s => ({ ...s, path: s.path.move(ch.bail[0], ch.bail[1] + 0.45 * k), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(p => p.move(ch.bail[0], ch.bail[1] + 0.45 * k)) : s.clip.move(ch.bail[0], ch.bail[1] + 0.45 * k) } : {}) }));
  // a soft dark copy of the solid pieces down and to the right, so pale metal still reads on pale cloth
  const shadow: Shape[] = own.filter(s => !s.flat && !s.stroke && !s.evenodd).map(s => ({ path: s.path.move(0.14 * k, 0.26 * k), fill: "#281810", flat: true, opacity: 0.3 }));
  const group = (shapes: Shape[]): Group => ({ shapes, edge: 0.12 });
  return { front: [{ layer: "chest_over", bone: "spine", group: group([...ch.front, ring, ...shadow, ...own]) }], back: [{ layer: "chest_over", bone: "spine", group: group(ch.back) }] };
}

/** The metal of a pendant: the cut piece, a flat highlight on the side towards the light and a shade on the other. */
function metalPiece(path: Path, c: string, light: Path | null, shade: Path | null, evenodd = false): Shape[] {
  return [
    { path, fill: c, ...(evenodd ? { evenodd } : {}) },
    ...(shade ? [{ path: shade, fill: tone(c, "shade"), flat: true, opacity: 0.85, clip: path } as Shape] : []),
    ...(light ? [{ path: light, fill: tone(c, "light"), flat: true, opacity: 0.9, clip: path } as Shape] : []),
  ];
}

// ---- scarves and the shawl -------------------------------------------------------------------------------

/** A hanging end of a scarf: a long panel from under the wrap at `top` to `hem`, `x0` … `x1` at the top, leaning `lean` cm at the hem. */
function scarfEnd(x0: number, x1: number, top: number, hem: number, lean: number): Pt[] {
  return [[x0, top, 0], [x1, top, 0], [x1 + lean * 0.5, (top + hem) / 2], [x1 + lean, hem, 0], [x0 + lean, hem, 0], [x0 + lean * 0.4, (top + hem) / 2]];
}

/** Fringe along a hem (a polyline): a thread every `step` cm, hanging straight down at most `len` past the edge from just inside it, in scallops of four; one stroked path (only the threads at an x that `keep` accepts). */
function hemFringe(pts: Vec2[], step: number, len: number, c: string, w: number, keep: (x: number) => boolean = () => true): Shape {
  const p = new Path();
  let i = 0;
  for (let j = 0; j + 1 < pts.length; j++) {
    const [ax, ay] = pts[j], dx = pts[j + 1][0] - ax, dy = pts[j + 1][1] - ay, l = Math.hypot(dx, dy), n = Math.max(1, Math.round(l / step));
    for (let t = 0; t < n; t++, i++) { const x = ax + dx * (t + 0.5) / n, y = ay + dy * (t + 0.5) / n; if (keep(x)) p.moveTo(x, y - 0.3).lineTo(x + 0.15 * (i % 3 - 1), y + len * (0.6 + 0.4 * Math.sin(Math.PI * (i % 4 + 0.5) / 4))); }
  }
  return { path: p, stroke: { color: c, width: w }, flat: true };
}

/**
 * The end of a scarf thrown back over the wearer's right shoulder, seen from behind: `w` wide, from
 * the side of the neck (folded over the shoulder, its top round) down to `hem` on the shoulder
 * blade, inside the arm. Its outline points, the hem's x span and a shade along the fold.
 */
function backEnd(b: BodyDims, w: number, hem: number) {
  const T = b.torsoL, k = kOf(b), xc = -(chestIn(b) * 0.55 + 1), x0 = xc - w / 2, x1 = xc + w / 2, lean = -0.5, top = -T - 1.6 * k;
  const pts: Pt[] = [[x0 + 0.6, top + 0.4 * k], [xc, top - 0.5 * k], [x1 - 0.4, top + 0.6 * k], [x1 + lean * 0.5, (top + hem) / 2], [x1 + lean, hem, 0], [x0 + lean, hem, 0], [x0 + lean * 0.4, (top + hem) / 2]];
  const fold = smooth([[x0 + 0.6, top + 0.4 * k], [xc, top - 0.5 * k], [x1 - 0.4, top + 0.6 * k], [x1 - 0.2, top + 2.6 * k], [xc, top + 1.6 * k], [x0 + 0.4, top + 2.4 * k]], true, 1);
  return { pts, outline: smooth(pts, true, 1), fold, hem, x0: x0 + lean, x1: x1 + lean };
}

/** Flat fringe tabs under a hem from `x0` to `x1` (its y `hem`), `len` long: one stroked path of short lines, every other one shorter. */
function fringe(x0: number, x1: number, hem: number, len: number, c: string, n = 6): Shape {
  const p = new Path(), w = (x1 - x0) / n;
  for (let i = 0; i < n; i++) p.moveTo(x0 + w * (i + 0.5), hem - 0.4).lineTo(x0 + w * (i + 0.5), hem + len - (i % 2) * len * 0.18);
  return { path: p, stroke: { color: c, width: w * 0.52 }, flat: true };
}

/**
 * The part of a closed outline on one side of an upright line: where `s` × x ≥ `x0` (s = 1 the
 * right of x = x0, s = −1 the left of x = −x0), cut exactly along the line (each curve split where
 * it crosses it), so the piece lies on the whole outline without a seam.
 */
function cutAt(p: Path, s: 1 | -1, x0: number): Path {
  type C4 = [Vec2, Vec2, Vec2, Vec2];
  const lerp = (a: Vec2, b: Vec2, t: number): Vec2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const at = (c: C4, t: number): Vec2 => { const a = lerp(c[0], c[1], t), b = lerp(c[1], c[2], t), d = lerp(c[2], c[3], t), e = lerp(a, b, t), f = lerp(b, d, t); return lerp(e, f, t); };
  const head = (c: C4, t: number): C4 => { const a = lerp(c[0], c[1], t), b = lerp(c[1], c[2], t), d = lerp(c[2], c[3], t), e = lerp(a, b, t), f = lerp(b, d, t); return [c[0], a, e, lerp(e, f, t)]; };
  const tail = (c: C4, t: number): C4 => { const a = lerp(c[0], c[1], t), b = lerp(c[1], c[2], t), d = lerp(c[2], c[3], t), e = lerp(a, b, t), f = lerp(b, d, t); return [lerp(e, f, t), f, d, c[3]]; };
  const side = (q: Vec2) => s * q[0] - x0;
  const out = new Path();
  let segs: C4[] = [], start: Vec2 = [0, 0], cur: Vec2 = [0, 0];
  const flush = () => {
    let open = false, pen: Vec2 = [0, 0];
    for (const c of segs) {
      // where the curve crosses the line: sign changes over 24 steps, refined by bisection
      const ts = [0];
      for (let i = 0; i < 24; i++) {
        let a = i / 24, b = (i + 1) / 24;
        if (side(at(c, a)) * side(at(c, b)) >= 0) continue;
        for (let j = 0; j < 30; j++) { const m = (a + b) / 2; if (side(at(c, a)) * side(at(c, m)) <= 0) b = m; else a = m; }
        ts.push((a + b) / 2);
      }
      ts.push(1);
      for (let i = 0; i + 1 < ts.length; i++) {
        if (side(at(c, (ts[i] + ts[i + 1]) / 2)) < 0) continue;
        const piece = tail(head(c, ts[i + 1]), ts[i + 1] > 0 ? ts[i] / ts[i + 1] : 0);
        if (!open) { out.moveTo(piece[0][0], piece[0][1]); open = true; } else if (Math.hypot(piece[0][0] - pen[0], piece[0][1] - pen[1]) > 1e-6) out.lineTo(piece[0][0], piece[0][1]);
        out.cubicTo(piece[1][0], piece[1][1], piece[2][0], piece[2][1], piece[3][0], piece[3][1]);
        pen = piece[3];
      }
    }
    if (open) out.close();
    segs = [];
  };
  for (const c of p.cmds) {
    if (c[0] === "M") { flush(); start = cur = [c[1], c[2]]; }
    else if (c[0] === "L") { const e: Vec2 = [c[1], c[2]]; segs.push([cur, lerp(cur, e, 1 / 3), lerp(cur, e, 2 / 3), e]); cur = e; }
    else if (c[0] === "C") { const e: Vec2 = [c[5], c[6]]; segs.push([cur, [c[1], c[2]], [c[3], c[4]], e]); cur = e; }
    else if (c[0] === "Q") { const q: Vec2 = [c[1], c[2]], e: Vec2 = [c[3], c[4]]; segs.push([cur, lerp(cur, q, 2 / 3), lerp(e, q, 2 / 3), e]); cur = e; }
    else { if (Math.hypot(cur[0] - start[0], cur[1] - start[1]) > 1e-6) segs.push([cur, lerp(cur, start, 1 / 3), lerp(cur, start, 2 / 3), start]); cur = start; flush(); }
  }
  flush();
  return out;
}

// ---- wrist pieces -------------------------------------------------------------------------------------

/** How far above the wrist pivot a wrist piece sits (y on the hand bone, negative). */
const wristAt = (b: BodyDims) => -Math.max(2.8, 4 * kOf(b));

/** The sleeve strips on one arm of the worn top, dress and coat (not the part being drawn): what covers the arm, and how wide. */
function armStrips(ctx: PartCtx, hand: "l" | "r") {
  const out: NonNullable<Item["strip"]>[] = [], o = ctx.avatar.outfit ?? {}, kit = ctx.kit, dress = o.dress ? kit.parts[o.dress.id] : undefined;
  for (const g of [o.outer, o.dress, dress?.replaces?.includes("top") ? null : o.top]) {
    const part = g ? kit.parts[g.id] : undefined;
    if (!g || !part || part === ctx.kit.parts[ctx.garment?.id ?? ""]) continue;
    try {
      const drawn = part.draw({ ...ctx, colors: (part.defaults ?? []).map(c => kit.color(c)), pattern: null, inks: [], side: null, garment: g, clip: null, clipBack: null });
      for (const it of drawn.front ?? []) if (it.strip && it.strip.chain === `arm_${hand}`) out.push(it.strip);
    } catch { /* a part that cannot draw here covers nothing */ }
  }
  return out;
}

/**
 * How wide the arm is `d` cm above the wrist with what covers it there: the skin, or the widest
 * sleeve or cuff of the worn top, dress or coat that reaches it. A watch's strap wraps that, so it
 * is never narrower than the sleeve it lies on.
 */
function wristWidth(ctx: PartCtx, hand: "l" | "r", d: number): number {
  const b = ctx.body, t = 1 - d / (2 * b.foreArmL), at = (w: [number, number, number]) => w[2] + (w[1] - w[2]) * (1 - t) * 2;
  let width = at(b.armW);
  for (const s of armStrips(ctx, hand)) if ((s.from ?? 0) <= t && (s.to ?? 1) >= t - 0.005) width = Math.max(width, at(s.widths));
  return width;
}

/** A wrist part's items: per worn side, its front and back groups on the hand bone (layer `over_sleeve`), `out` the side away from the body. */
function onWrist(ctx: PartCtx, draw: (o: { hand: "l" | "r"; out: 1 | -1; w: number; y: number; k: number; back: boolean }) => Group, extra?: (o: { hand: "l" | "r"; out: 1 | -1; w: number; y: number; k: number }) => Item[]): PartOut {
  const b = ctx.body, k = kOf(b), y = wristAt(b), front: Item[] = [], back: Item[] = [];
  for (const out of sidesOf(ctx.side, "l")) {
    // a wide loose sleeve (an abaya's, a kimono-cut coat's) would make a belt of a strap: the piece is worn over its cuff at the arm's own width
    const hand = out === 1 ? "l" : "r", skin = wristWidth({ ...ctx, avatar: { ...ctx.avatar, outfit: {} } }, hand, -y), cover = wristWidth(ctx, hand, -y);
    const w = cover > skin * 1.7 ? skin + 1.2 : cover, bone = `hand_${hand}`;
    front.push({ layer: "over_sleeve", bone, group: draw({ hand, out, w, y, k, back: false }) });
    back.push({ layer: "over_sleeve", bone, group: draw({ hand, out, w, y, k, back: true }) });
    if (extra) front.push(...extra({ hand, out, w, y, k }));
  }
  return { front, back };
}

// ---- hand pieces --------------------------------------------------------------------------------------

/** A hands part's items: one per hand shape, side and view, each drawn only with its shape (`Item.alt`). */
function onHands(ctx: PartCtx, sides: (1 | -1)[], draw: (side: 1 | -1, shape: string, back: boolean) => Group | null): PartOut {
  const front: Item[] = [], back: Item[] = [];
  for (const side of sides) for (const shape of HAND_SHAPES) for (const view of [false, true]) {
    const group = draw(side, shape, view), key = `hand_${side === 1 ? "l" : "r"}`;
    if (group) (view ? back : front).push({ layer: "hand", bone: key, group, alt: { key, value: shape } });
  }
  return { front, back };
}

// ---- aprons ---------------------------------------------------------------------------------------------

/** The waist line of an apron on the spine bone, and how far its band reaches sideways (over a top or a coat). */
function apronWaist(b: BodyDims) {
  const T = b.torsoL, y = -T * 0.21, ww = b.waistW / 2, hw = b.hipW / 2;
  return { y, half: ww + (hw - ww) * 0.24 + 3.2 };
}

/** A bow of tape at `at`: two loops, two tails `tail` long, the knot; `c` the tape. */
function bow(at: Vec2, k: number, c: string, tail = 7): Shape[] {
  const [x, y] = at, L = tone(c, "light");
  return [
    S([[x - 0.3, y + 0.4], [x - 1.8 * k, y + tail * k, 0], [x - 0.5 * k, y + tail * k + 0.3, 0], [x + 0.5, y + 0.6]], c),
    S([[x + 0.3, y + 0.4], [x + 1.2 * k, y + tail * 0.86 * k, 0], [x + 2.3 * k, y + tail * 0.82 * k, 0], [x + 0.8, y + 0.4]], tone(c, "shade")),
    S([[x, y], [x - 3 * k, y - 1.7 * k], [x - 3.5 * k, y + 0.2 * k], [x - 2.4 * k, y + 1.4 * k]], c),
    S([[x, y], [x + 3 * k, y - 1.5 * k], [x + 3.4 * k, y + 0.4 * k], [x + 2.2 * k, y + 1.4 * k]], tone(c, "shade")),
    flat(ellipse(x - 2.4 * k, y - 0.4 * k, 0.9 * k, 0.5 * k), L, 0.7),
    { path: ellipse(x, y + 0.1, 0.95 * k, 0.85 * k), fill: c },
  ];
}

/** A waist apron's skirt panel from the band at `top` to `hem`, `half` wide at the band and `halfHem` at the hem, with soft corners. */
const apronSkirt = (top: number, hem: number, half: number, halfHem: number): Pt[] =>
  [[-half, top, 0], [half, top, 0], [halfHem, hem - 1.6], [halfHem - 1.4, hem, 0], [0, hem + 0.3], [-halfHem + 1.4, hem, 0], [-halfHem, hem - 1.6]];

const APRON_PATTERNS = ["pat_stripe_h", "pat_check", "pat_gingham"];

// ---- the parts -------------------------------------------------------------------------------------------

export const ACCESSORIES: Record<string, PartDef> = {
  // ---- neck

  lanyard_badge: named("neck", "Lanyard with ID badge", "yaka kartı", {
    colors: 2, defaults: ["fab_04", "fab_01"], builds: ["adult", "elder", "child"], tags: ["work", "school", "health", "istanbul"],
    draw: ctx => {
      const b = ctx.body, T = b.torsoL, k = kOf(b), strap = ctx.colors[0] ?? "#2E3A59", bandC = ctx.colors[1] ?? "#F7F3EA";
      const cw = Math.min(6.5 * k, chestIn(b) * 1.5), chh = cw * 9.5 / 6.5, cardTop = -T + Math.min(0.3 * T, T * 0.79 - 3 - chh), clipY = cardTop - 1.4 * k;
      const nx = b.neckW / 2 + 0.2, up = -T - Math.min(2.2, b.neckL * 0.5), sw = 1.1 * k, metal = ctx.kit.color("met_silver");
      const strapPath = (s: 1 | -1) => band([[s * nx, up], [s * nx * 1.05, -T + 1.2], [s * nx * 0.45, (-T + clipY) / 2 + 1], [s * 0.35, clipY]], [sw, sw, sw * 0.95, sw * 0.8]);
      const card = rrect(-cw / 2, cardTop, cw, chh, 0.7 * k), white = paper(strap), stripe = luma(bandC) > 0.75 ? strap : bandC;
      const front: Group = { edge: 0.18, shapes: [lift(),
        P(strapPath(-1), tone(strap, "shade")), P(strapPath(1), strap),
        line([[nx * 1.05 + 0.1, -T + 1], [nx * 0.5, (-T + clipY) / 2 + 1]], tone(strap, "light"), 0.18 * k, 0.6),
        { path: card, fill: white },
        { path: rrect(-cw / 2, cardTop + chh * 0.78, cw, chh * 0.22, [0, 0, 0.7 * k, 0.7 * k]), fill: stripe, flat: true, clip: card },
        flat(rrect(-0.9 * k, cardTop + 0.5 * k, 1.8 * k, 0.5 * k, 0.25 * k), tone(white, "deep"), 0.7),
        flat(rrect(-cw / 2 + 0.7 * k, cardTop + 1.6 * k, cw * 0.36, cw * 0.42, 0.25 * k), mix(white, "#5A5F68", 0.45)),
        flat(rrect(-cw / 2 + 0.7 * k + cw * 0.44, cardTop + 1.9 * k, cw * 0.38, 0.55 * k, 0.25 * k), mix(white, "#5A5F68", 0.5)),
        flat(rrect(-cw / 2 + 0.7 * k + cw * 0.44, cardTop + 3.1 * k, cw * 0.28, 0.55 * k, 0.25 * k), mix(white, "#5A5F68", 0.35)),
        flat(rrect(cw / 2 - 1.2 * k, cardTop + 0.5 * k, 0.7 * k, chh - 1.2 * k, 0.35 * k), tone(white, "shade"), 0.35),
        P(rrect(-0.75 * k, clipY - 0.4 * k, 1.5 * k, 1.9 * k, 0.4 * k), metal),
        flat(rrect(-0.5 * k, clipY - 0.2 * k, 0.4 * k, 1.3 * k, 0.2 * k), tone(metal, "light"), 0.9),
      ] };
      const back: Group = { edge: 0.18, shapes: [lift(), P(band([[-nx, up], [-nx * 0.55, -T - 0.4], [0, -T - 0.1], [nx * 0.55, -T - 0.4], [nx, up]], [sw, sw, sw, sw, sw]), strap)] };
      return { front: [{ layer: "chest_over", bone: "spine", group: front }], back: [{ layer: "chest_over", bone: "spine", group: back }] };
    },
  }),

  scarf_wool: named("neck", "Wool scarf", "yün atkı", {
    colors: 1, defaults: ["fab_23"], patterns: ["pat_stripe_h", "pat_check", "pat_dots", "pat_kilim_band"], tags: ["winter", "casual", "istanbul"], over: ["top", "outer"],
    draw: ctx => {
      const b = ctx.body, T = b.torsoL, k = kOf(b), c = ctx.colors[0] ?? "#B3261E", child = b.build === "child", toddler = b.build === "toddler";
      const hw = (b.neckW + 6.4) / 2, top = -T - 4.4 * k, bot = -T + 3.6 * k, fr = mix(c, tone(c, "light"), 0.6);
      // the wraps: a tight inner one under the chin and the outer one over it, sagging on the chest
      const inner: Pt[] = [[-hw * 0.82, top + 2.2 * k], [-hw * 0.62, top + 0.4 * k], [0, top + 1.6 * k], [hw * 0.62, top + 0.4 * k], [hw * 0.82, top + 2.2 * k], [hw * 0.55, bot - 2.2 * k], [0, bot - 1.4 * k], [-hw * 0.55, bot - 2.2 * k]];
      const outer: Pt[] = [[-hw, top + 3.4 * k], [-hw * 0.7, top + 2.6 * k], [-hw * 0.2, top + 3.7 * k], [hw * 0.35, top + 3.3 * k], [hw * 0.92, top + 2.8 * k], [hw * 1.02, top + 4.6 * k], [hw * 0.7, bot - 0.2 * k], [0, bot + 0.3 * k], [-hw * 0.75, bot - 0.4 * k]];
      const wraps = (back: boolean): Shape[] => [
        S(inner, tone(c, back ? "shade" : "base")), ...printed(ctx, smooth(inner, true, 1), { hem: bot - 1.4 * k }),
        S(outer, c), ...printed(ctx, smooth(outer, true, 1), { hem: bot + 0.3 * k }),
        line([[-hw * 0.55, top + 4.2 * k], [-hw * 0.1, bot - 0.6 * k]], tone(c, "shade"), 0.5 * k, 0.55),
        line([[hw * 0.25, top + 4 * k], [hw * 0.6, bot - 1 * k]], tone(c, "shade"), 0.5 * k, 0.55),
        line([[-hw * 0.8, top + 3.4 * k], [-hw * 0.3, top + 3.9 * k]], fr, 0.4 * k, 0.5),
      ];
      const front: Shape[] = [lift()];
      if (!toddler) {
        const w = b.shoulderW * 0.2, x0 = Math.max(0.3 * k, Math.min(chestIn(b) - w + 0.8, hw * 0.5)), long = -T + T * (child ? 0.55 : 0.7), short = -T + T * (child ? 0.3 : 0.4);
        const sEnd = scarfEnd(-x0 - w * 0.7, -x0 + w * 0.3, bot - 2 * k, short, -0.6), lEnd = scarfEnd(x0, x0 + w, bot - 2 * k, long, 1.1);
        for (const [pts, hem, lean, x] of [[sEnd, short, -0.6, -x0 - w * 0.7], [lEnd, long, 1.1, x0]] as [Pt[], number, number, number][]) {
          const ww = pts[1][0] - pts[0][0];
          const outline = smooth(pts, true, 1);
          front.push(S(pts, c), ...printed(ctx, outline, { hem }),
            { ...flat(smooth([[x + ww * 0.62 + lean * 0.3, bot], [x + ww + lean * 0.5, bot], [x + ww + lean, hem], [x + ww * 0.7 + lean, hem]], true, 1), tone(c, "shade"), 0.45), clip: outline },
            fringe(x + lean, x + ww + lean, hem, 2.4 * k, fr, child ? 4 : 6));
        }
      }
      front.push(...wraps(false));
      // from behind: the wraps across the nape, lower and wider, the ends' tops showing over the shoulders
      const nape: Pt[] = [[-hw * 1.05, -T + 0.6 * k], [-hw * 0.75, -T - 3 * k], [0, -T - 2.6 * k], [hw * 0.75, -T - 3 * k], [hw * 1.05, -T + 0.6 * k], [hw * 0.6, -T + 3.4 * k], [0, -T + 3.9 * k], [-hw * 0.6, -T + 3.4 * k]];
      const back: Shape[] = [lift(), S(nape, c), ...printed(ctx, smooth(nape, true, 1), { hem: -T + 3.9 * k }),
        line([[-hw * 0.7, -T - 1.4 * k], [hw * 0.7, -T - 1.4 * k]], tone(c, "shade"), 0.5 * k, 0.5),
        line([[-hw * 0.6, -T + 1.4 * k], [0, -T + 2 * k], [hw * 0.6, -T + 1.4 * k]], tone(c, "shade"), 0.5 * k, 0.45)];
      if (!toddler) {
        // one end thrown back over the wearer's right shoulder, lying over the wraps down to the shoulder blade
        const be = backEnd(b, b.shoulderW * 0.2, -T + (child ? 0.34 : 0.3) * T);
        back.push(S(be.pts, c), ...printed(ctx, be.outline, { hem: be.hem }), flat(be.fold, tone(c, "shade"), 0.45), fringe(be.x0, be.x1, be.hem, 2.4 * k, fr, child ? 4 : 6));
      }
      return { front: [{ layer: "chest_over", bone: "spine", group: { shapes: front } }], back: [{ layer: "chest_over", bone: "spine", group: { shapes: back } }] };
    },
  }),

  scarf_fan: named("neck", "Football fan scarf", "taraftar atkısı", {
    colors: 2, defaults: ["fab_22", "fab_01"], builds: ["adult", "elder", "child"], tags: ["sport", "casual", "winter", "football", "istanbul"], over: ["top", "outer"],
    draw: ctx => {
      const b = ctx.body, T = b.torsoL, k = kOf(b), A = ctx.colors[0] ?? "#26272C", B = ctx.colors[1] ?? "#F7F3EA";
      const w = Math.max(3.2 * k, b.shoulderW * 0.17), x0 = Math.max(0.8 * k, Math.min(chestIn(b) - w - 0.2, b.neckW / 2 - 0.6)), top = -T - 1.6 * k, hem = -T + 0.6 * T, bh = 2.4 * k;
      const ends: Shape[] = [];
      for (const s of [-1, 1] as const) {
        // the outer top corner tucked lower, under the wrap's sloping side, so no corner of the end shows above it
        const xa = s === 1 ? x0 : -x0 - w, lean = s * 0.5, pts = scarfEnd(xa, xa + w, top, hem, lean), stripes = new Path();
        pts[s === 1 ? 1 : 0] = [s === 1 ? xa + w : xa, -T + 1.4 * k, 0];
        const outline = smooth(pts, true, 1);
        // six bands of each colour, counted up from the hem; a fringe of threads in both
        for (let y = hem - bh; y > top - bh; y -= bh * 2) stripes.add(rect(xa - 2, y, w + 4, bh));
        ends.push(S(pts, A), { path: stripes, fill: B, flat: true, clip: outline },
          { ...flat(smooth([[xa + w * 0.66, top], [xa + w, top], [xa + w + lean, hem], [xa + w * 0.7 + lean, hem]], true, 1), tone(A, "shade"), 0.35), clip: outline },
          fringe(xa + lean, xa + w + lean, hem, 2 * k, A, 4), fringe(xa + lean + w / 8, xa + w + lean + w / 8, hem, 1.6 * k, B, 4));
      }
      // the doubled band round the neck, its knitted bands running across it (upright stripes)
      const nw = b.neckW / 2 + 1.4, collar = (y0: number, y1: number, d: number): Pt[] => [[-nw - w * 0.4, y1], [-nw, y0], [0, y0 + d], [nw, y0], [nw + w * 0.4, y1], [0, y1 + d + 1.2 * k]];
      const ring = collar(-T - 2.8 * k, -T + 1.6 * k, 1.4 * k), ringPath = smooth(ring, true, 1), across = new Path();
      for (let x = -nw - w; x < nw + w; x += bh * 2) across.add(rect(x, -T - 6, bh, 12));
      const neck = [S(ring, A), { path: across, fill: B, flat: true, clip: ringPath } as Shape, line([[-nw * 0.8, -T + 0.4 * k], [0, -T + 1.6 * k], [nw * 0.8, -T + 0.4 * k]], tone(A, "deep"), 0.4 * k, 0.4)];
      const nape: Pt[] = [[-nw - 1.6 * k, -T + 1.2 * k], [-nw, -T - 2.4 * k], [0, -T - 2 * k], [nw, -T - 2.4 * k], [nw + 1.6 * k, -T + 1.2 * k], [0, -T + 2.2 * k]];
      const back: Shape[] = [lift(), S(nape, A), { path: across, fill: B, flat: true, clip: smooth(nape, true, 1) }];
      // one end thrown back over the wearer's right shoulder, its bands across it as in front
      const be = backEnd(b, w, -T + (b.build === "child" ? 0.34 : 0.3) * T), bands = new Path();
      for (let y = be.hem - bh; y > -T - 6 * k; y -= bh * 2) bands.add(rect(be.x0 - 3, y, w + 6, bh));
      back.push(S(be.pts, A), { path: bands, fill: B, flat: true, clip: be.outline }, flat(be.fold, tone(A, "shade"), 0.35),
        fringe(be.x0, be.x1, be.hem, 2 * k, A, 4), fringe(be.x0 + w / 8, be.x1 + w / 8, be.hem, 1.6 * k, B, 4));
      return { front: [{ layer: "chest_over", bone: "spine", group: { shapes: [lift(), ...ends, ...neck] } }], back: [{ layer: "chest_over", bone: "spine", group: { shapes: back } }] };
    },
  }),

  shawl_knit: named("neck", "Knitted shawl", "örgü şal", {
    colors: 2, defaults: ["fab_56", "fab_02"], patterns: ["pat_stripe_h", "pat_dots", "pat_floral", "pat_kilim_band"], builds: ["adult", "elder", "child"],
    tags: ["elder", "winter", "traditional", "modest", "handmade"], over: ["top", "dress", "outer"],
    draw: ctx => {
      const b = ctx.body, T = b.torsoL, k = kOf(b), c = ctx.colors[0] ?? "#A78BA8", e = ctx.colors[1] ?? tone(c, "light"), child = b.build !== "adult" && b.build !== "elder";
      const nw = b.neckW / 2 + 0.8, pinY = -T + 0.3 * T, tipY = -T + (child ? 0.52 : 0.66) * T, cin = Math.max(chestIn(b), 4 * k);
      const fl = (child ? 1.4 : 2) * k, step = 1.5 * k, fw = 0.62 * k;
      const knit = (outline: Path, x0: number, x1: number, y0: number, y1: number, keep: (x: number) => boolean = () => true): Shape => {
        // the knit: columns of stitches, each a dashed line in the shade (cheap in a still: one path of two-point lines)
        const p = new Path(), s = 3.4 * k;
        for (let x = x0 + s / 2; x < x1; x += s) if (keep(x)) p.moveTo(x, y0).lineTo(x + (y1 - y0) * 0.06, y1);
        return { path: p, stroke: { color: tone(c, "shade"), width: 0.55 * k, dash: [0.55 * k, 0.4 * k] }, flat: true, opacity: 0.45, clip: outline };
      };
      // over each shoulder and upper arm, over every sleeve (layer `over_sleeve`): the drape, wide enough for a coat's sleeve
      const ax = b.shoulderW / 2 - b.armW[0] / 2, ay = -T + b.armW[0] * 0.72, half = (b.armW[0] * 1.28 + 3.6) / 2 + 0.9, lo = -T + (child ? 0.3 : 0.36) * T;
      const xo = (y: number) => ax + (y - ay) * 0.13 + half, xi = (y: number) => ax + (y - ay) * 0.13 - half;
      const mir = (s: 1 | -1, pts: Pt[]): Pt[] => pts.map(p => (p.length === 3 ? [s * p[0], p[1], 0] : [s * p[0], p[1]]) as Pt);
      const xin = Math.max(xi(lo) - 0.5, cin * 0.97), drapeHem: Vec2[] = [[xo(lo), lo], [(xo(lo) + xin) / 2, lo + 1.2 * k], [xin, lo - 0.6 * k]];
      const drape = (s: 1 | -1): Pt[] => mir(s, [[nw, -T - 2 * k, 0], [ax, -T - 1.9], [xo(-T + 2.5) + 0.4, -T + 2.5], [xo(lo), lo, 0], drapeHem[1], [xin, lo - 0.6 * k, 0], [cin * 0.92, -T + 0.15 * T], [nw * 1.05, -T + 1.2 * k, 0]]);
      // the two front ends under it: wide panels from the neck down the chest to the pin, each tip hanging past it to the other side
      const hem = (s: 1 | -1): Vec2[] => [[s * cin * 0.86, -T + 0.25 * T], [s * cin * 0.4, pinY + 0.8 * k], [s * cin * 0.04, pinY + (tipY - pinY) * 0.55], [-s * cin * 0.32, tipY]];
      const end = (s: 1 | -1): Pt[] => [[s * nw * 0.6, -T + 1.2 * k, 0], [s * (cin + 0.6), -T + 0.12 * T], ...hem(s).slice(0, 3).map(([x, y], i) => (i ? [x, y] : [x, y, 0]) as Pt), [-s * cin * 0.32, tipY, 0],
        [-s * cin * 0.66, pinY + (tipY - pinY) * 0.4], [-s * 0.8 * k, pinY - 1.4 * k], [s * nw * 0.3, -T + 0.14 * T], [s * nw * 0.45, -T + 3 * k]];
      const front: Shape[] = [lift()], over: Shape[] = [lift()];
      for (const s of [-1, 1] as const) {
        const pts = end(s), outline = smooth(pts, true, 1), g = s === 1 ? c : tone(c, "shade");
        front.push(S(pts, g), ...printed(ctx, outline, { hem: tipY }), knit(outline, -cin - 1, cin + 1, -T, tipY),
          hemFringe(hem(s), step, fl, e, fw),
          line([[s * nw * 0.5, -T + 3.4 * k], [s * nw * 0.42, -T + 0.15 * T], [0, pinY - 0.6 * k]], tone(c, "shade"), 0.5 * k, s === 1 ? 0.5 : 0.25));
        const d = drape(s), dp = smooth(d, true, 1);
        over.push(S(d, c), ...printed(ctx, dp, { hem: lo + 1.2 * k }), knit(dp, s === 1 ? Math.min(nw, xin) - 1 : -xo(lo) - 1, s === 1 ? xo(lo) + 1 : -Math.min(nw, xin) + 1, -T - 3, lo + 2),
          flat(smooth([[s * (xo(-T + 6)), -T + 6], [s * (xo(lo) + 0.2), lo], [s * (xo(lo) - 3), lo + 0.4], [s * (xo(-T + 8) - 2.4), -T + 8]], true, 1), tone(c, "shade"), s === 1 ? 0.5 : 0.25),
          hemFringe(drapeHem.map(([x, y]) => [s * x, y] as Vec2), step, fl, e, fw));
      }
      front.push({ path: circle(0, pinY, 0.75 * k), fill: ctx.kit.color("met_gold") }, flat(circle(-0.25 * k, pinY - 0.25 * k, 0.25 * k), "#FFFDF6", 0.7));
      // from behind: the big triangle over the shoulders and the shoulder blades, its point low on the back, fringed along
      // both lower edges. It lies under the hair (long hair falls over it); the part over each upper arm is drawn again over the sleeves.
      const tipB = -T + (child ? 0.55 : 0.7) * T, edgeR: Vec2[] = [[xo(lo), lo], [xo(lo) * 0.5, (lo + tipB) / 2 + 0.6 * k], [0, tipB]];
      const edgeL: Vec2[] = edgeR.slice().reverse().map(([x, y]) => [-x, y] as Vec2);
      const tri: Pt[] = [[-xo(lo), lo, 0], [-xo(-T + 2.5) - 0.4, -T + 2.5], [-ax, -T - 1.9], [-nw, -T - 2 * k], [nw, -T - 2 * k], [ax, -T - 1.9], [xo(-T + 2.5) + 0.4, -T + 2.5],
        [xo(lo), lo, 0], edgeR[1], [0, tipB, 0], edgeL[1]];
      const triPath = smooth(tri, true, 1);
      // the copy over the sleeves: the triangle cut a little inside the widest sleeve's top, so the hair is cut about where the arm already cuts it
      const top = Math.max(b.armW[0], ...armStrips(ctx, "l").filter(st => (st.from ?? 0) < 0.05).map(st => st.widths[0]));
      const x0 = Math.min(cin, ax - top / 2) - 1.6, far = xo(lo) + 6;
      const wings = new Path().add(cutAt(triPath, 1, x0)).add(cutAt(triPath, -1, x0));
      const wingZone = new Path().add(rect(x0, -T - 6, far - x0, T + 12)).add(rect(-far, -T - 6, far - x0, T + 12));
      const back = (outline: Path, zone?: Path): Shape[] => {
        // the ground is the whole triangle cut by the zone, so its paper rim runs only along the real edges, never along the cut;
        // each copy draws only the stitches and threads on its own side of the cut (and a little past it)
        const mine = (x: number) => zone ? Math.abs(x) > x0 - 1.5 : Math.abs(x) < x0 + 1.5;
        return [P(triPath, c, zone ? { clip: zone } : {}), ...printed(ctx, outline, { hem: tipB }), knit(outline, -xo(lo) - 1, xo(lo) + 1, -T - 3, tipB, mine),
          { ...flat(smooth([[xo(-T + 4) - 3, -T + 4], [xo(-T + 4), -T + 4], [xo(lo), lo], [xo(lo) - 6, lo + 3]], true, 1), tone(c, "shade"), 0.4), clip: outline },
          ...[hemFringe(edgeR, step, fl, e, fw, mine), hemFringe(edgeL, step, fl, e, fw, mine)].map(f => zone ? { ...f, clip: zone } : f)];
      };
      return {
        front: [{ layer: "chest_over", bone: "spine", group: { shapes: front } }, { layer: "over_sleeve", bone: "spine", group: { shapes: over } }],
        back: [{ layer: "chest_over", bone: "spine", group: { shapes: [lift(), ...back(triPath)] } }, { layer: "over_sleeve", bone: "spine", group: { shapes: [lift(), ...back(wings, wingZone)] } }],
      };
    },
  }),

  neck_glasses_chain: named("neck", "Glasses on a chain", "gözlük zinciri", {
    colors: 2, palettes: ["metal", "fabmetal"], defaults: ["met_gold", "fab_22"], builds: ["adult", "elder"], tags: ["elder", "accessibility", "work", "school"],
    draw: ctx => {
      const b = ctx.body, T = b.torsoL, k = kOf(b), c = ctx.colors[0] ?? "#E0B03C", frame = ctx.colors[1] ?? "#26272C";
      // with glasses on the face the chain hangs from their temples behind the ears; without, the pair rests on the chest
      if (ctx.avatar.wear?.eyes?.id) {
        const ex = b.headW / 2 - 1.2, ey = -T - b.neckL - b.headH * 0.36, low = -T + 0.12 * T;
        const pts: Vec2[] = [[-ex, ey], [-ex * 0.8, -T - 2], [-b.neckW * 0.45, low - 1.5], [0, low], [b.neckW * 0.45, low - 1.5], [ex * 0.8, -T - 2], [ex, ey]];
        const nape: Vec2[] = [[-ex, ey], [-b.neckW * 0.55, -T - 2.2], [0, -T - 0.8], [b.neckW * 0.55, -T - 2.2], [ex, ey]];
        const g = (p: Vec2[]): Group => ({ edge: 0.12, shapes: [line(p.map(([x, y]) => [x + 0.12, y + 0.22] as Vec2), "#281810", 0.3 * k, 0.2), line(p, c, 0.2 * k, 1)] });
        return { front: [{ layer: "chest_over", bone: "spine", group: g(pts) }], back: [{ layer: "chest_over", bone: "spine", group: g(nape) }] };
      }
      return pendant(ctx, c, 5.6, k => {
        // a reading pair at full size (lenses about 3.4 cm), the lenses tinted towards the frame, so the pair reads as a dark spot on the sternum even at 48 px
        const r = 2.15 * k, lens = mix(ctx.kit.color("len_01"), frame, 0.55), a = lensAlpha("len_01");
        const rims = new Path().add(ellipse(-r * 1.15, r * 1.25, r, r * 0.86)).add(ellipse(r * 1.15, r * 1.35, r, r * 0.86));
        const holes = new Path().add(ellipse(-r * 1.15, r * 1.25, r * 0.7, r * 0.58)).add(ellipse(r * 1.15, r * 1.35, r * 0.7, r * 0.58));
        return [
          // the folded temples behind the rims, the rims with their lenses, the bridge
          line([[-r * 2.05, r * 0.85], [-r * 0.2, r * 2.0]], tone(frame, "shade"), 0.3 * k, 1),
          line([[r * 2.05, r * 0.95], [r * 0.2, r * 2.0]], tone(frame, "shade"), 0.3 * k, 1),
          { path: holes, fill: lens, flat: true, opacity: Math.max(0.7, a + 0.45) },
          { path: rims.add(holes), fill: frame, evenodd: true },
          line([[-r * 0.3, r * 0.85], [0, r * 0.62], [r * 0.3, r * 0.9]], frame, 0.32 * k, 1),
          flat(ellipse(-r * 1.45, r * 0.95, r * 0.28, r * 0.14), "#FFFFFF", 0.6),
          line([[-r * 2.1, r * 0.95], [-r * 1.2, -0.45 * k], [0, -0.45 * k], [r * 1.2, -0.45 * k], [r * 2.1, r * 1.05]], c, 0.2 * k, 1),
        ];
      }, 0.2);
    },
  }),

  neck_nazar: named("neck", "Evil-eye bead necklace", "nazar boncuğu kolye", {
    colors: 2, defaults: ["fab_33", "fab_22"], builds: ["adult", "elder", "child"], tags: ["traditional", "istanbul", "cultural"],
    draw: ctx => {
      const c = ctx.colors[0] ?? "#1F5FC0", cord = ctx.colors[1] ?? "#26272C";
      return pendant(ctx, cord, 3.8, k => {
        const w = 1.6 * k, h = 3.8 * k, cy = h * 0.6;
        const drop: Pt[] = [[0, 0, 0], [w * 0.62, h * 0.28], [w, cy], [w * 0.7, h * 0.92], [0, h], [-w * 0.7, h * 0.92], [-w, cy], [-w * 0.62, h * 0.28]];
        return [
          S(drop, c),
          flat(ellipse(0, cy, w * 0.74, w * 0.78), "#FFFDF6"),
          flat(ellipse(0, cy, w * 0.5, w * 0.53), mix(c, "#FFFFFF", 0.55)),
          flat(ellipse(0, cy, w * 0.27, w * 0.29), ink(c)),
          flat(ellipse(-w * 0.1, cy - w * 0.1, w * 0.08, w * 0.08), "#FFFFFF", 0.9),
          flat(ellipse(-w * 0.6, h * 0.42, w * 0.1, w * 0.22), tone(c, "light"), 0.6),
        ];
      }, 0.22, 0.3);
    },
  }),

  neck_cross: named("neck", "Cross pendant", "haç kolye", {
    colors: 1, palettes: ["metal"], defaults: ["met_silver"], builds: ["adult", "elder", "child"], tags: ["religious", "faith", "traditional"],
    draw: ctx => {
      const c = ctx.colors[0] ?? "#C3C8CE";
      return pendant(ctx, c, 3.2, k => {
        const w = 2.4 * k, h = 3.2 * k, t = 0.55 * k, bar = h * 0.32, a = t / 2;
        const cross = poly([[-a, 0], [a, 0], [a, bar - a], [w / 2, bar - a], [w / 2, bar + a], [a, bar + a], [a, h], [-a, h], [-a, bar + a], [-w / 2, bar + a], [-w / 2, bar - a], [-a, bar - a]]);
        return metalPiece(cross, c, new Path().add(rect(-a, 0, t * 0.4, bar)).add(rect(-w / 2, bar - a, w / 2 - a, t * 0.4)), new Path().add(rect(a - t * 0.35, bar + a, t * 0.35, h)).add(rect(a, bar + a - t * 0.3, w / 2, t * 0.3)));
      });
    },
  }),

  neck_crescent: named("neck", "Crescent pendant", "hilal kolye", {
    colors: 1, palettes: ["metal"], defaults: ["met_silver"], builds: ["adult", "elder", "child"], tags: ["religious", "faith", "traditional", "istanbul"],
    draw: ctx => {
      const c = ctx.colors[0] ?? "#C3C8CE";
      return pendant(ctx, c, 3, k => {
        // the outer circle less an inner one moved towards the opening; tilted, the horns up to the right, a small star joined to the upper horn
        const R = 1.4 * k, r = 1.2 * k, d = 0.5 * k, tilt = -0.45, cx = 0, cy = R;
        const hx = (R * R - r * r + d * d) / (2 * d), hy = Math.sqrt(Math.max(0, R * R - hx * hx)), a0 = Math.atan2(hy, hx), b0 = Math.atan2(hy, hx - d);
        const pts: Vec2[] = [];
        for (let i = 0; i <= 24; i++) { const t = a0 + (Math.PI * 2 - 2 * a0) * i / 24; pts.push([Math.cos(t) * R, Math.sin(t) * R]); }
        for (let i = 0; i <= 18; i++) { const t = -b0 - (Math.PI * 2 - 2 * b0) * i / 18; pts.push([d + Math.cos(t) * r, Math.sin(t) * r]); }
        const crescent = placed(poly(pts), [cx, cy], tilt), horn: Vec2 = [Math.cos(tilt) * hx - Math.sin(tilt) * -hy + cx, Math.sin(tilt) * hx + Math.cos(tilt) * -hy + cy];
        const st = star([horn[0] + 0.15 * k, horn[1] + 0.85 * k], 0.48 * k, Math.PI + tilt);
        const lightArc = placed(new Path().add(ellipse(-R * 0.72, -R * 0.35, R * 0.22, R * 0.5)), [cx, cy], tilt);
        return [...metalPiece(crescent, c, lightArc, null), ...metalPiece(st, c, null, null), flat(circle(horn[0] + 0.08 * k, horn[1] + 0.3 * k, 0.16 * k), c)];
      });
    },
  }),

  neck_david_star: named("neck", "Star of David pendant", "Davut yıldızı kolye", {
    colors: 1, palettes: ["metal"], defaults: ["met_silver"], builds: ["adult", "elder", "child"], tags: ["religious", "faith", "traditional"],
    draw: ctx => {
      const c = ctx.colors[0] ?? "#C3C8CE";
      return pendant(ctx, c, 2.6, k => {
        // two interlocked triangle frames as one cut piece: each frame an outer triangle and its inner one wound the other way, so
        // the non-zero fill leaves the open hexagon in the middle and a small hole in each point (no even-odd: the paper's own
        // shadow and rim follow the holes). The weave is flat shade on top: at every other crossing the downward frame passes over.
        const R = 1.6 * k, t = 0.34 * k, cy = R, tri = (a: number, rr: number): Vec2[] => [0, 1, 2].map(i => [Math.cos(a + i * 2 * Math.PI / 3) * rr, cy + Math.sin(a + i * 2 * Math.PI / 3) * rr] as Vec2);
        const frame = (a: number) => new Path().add(poly(tri(a, R))).add(poly(tri(a, R - 2 * t).reverse()));
        const both = frame(-Math.PI / 2).add(frame(Math.PI / 2)), down = frame(Math.PI / 2), up = frame(-Math.PI / 2), m = (R - t) / Math.sqrt(3);
        const under = new Path();
        for (let i = 0; i < 6; i += 2) under.add(circle(Math.cos(i * Math.PI / 3) * m, cy + Math.sin(i * Math.PI / 3) * m, t * 1.3));
        const upTop = tri(-Math.PI / 2, R - t * 0.5);
        return [
          { path: both, fill: c },
          // the downward frame a shade darker, except where it passes under the upward one
          { path: down, fill: tone(c, "shade"), flat: true, opacity: 0.55, clip: both },
          { path: up, fill: c, flat: true, clip: under },
          line([upTop[2], upTop[0]], tone(c, "light"), t * 0.4, 0.9),
        ];
      }, 0.22);
    },
  }),

  // ---- wrist

  watch_classic: named("wrist", "Classic watch", "kol saati", {
    colors: 2, palettes: ["fabmetal", "metal"], defaults: ["fab_20", "met_silver"], builds: ["adult", "elder", "child"], tags: ["casual", "formal", "work", "istanbul"],
    sides: { allowed: ["l", "r"], default: "l" },
    draw: ctx => {
      const strap = ctx.colors[0] ?? "#6B4A35", metal = ctx.colors[1] ?? "#C3C8CE", dial = ctx.kit.color("fab_02"), hands = ctx.kit.color("fab_22");
      return onWrist(ctx, ({ out, w, y, k, back }) => {
        const sh = 1.8 * k, cr = (ctx.body.build === "child" ? 1.7 : 2) * k, W = w + 0.6;
        const strapP = rrect(-W / 2, y - sh / 2, W, sh, sh * 0.35);
        const shapes: Shape[] = [lift(), { path: strapP, fill: strap },
          flat(rrect(W / 2 - W * 0.16, y - sh / 2, W * 0.16, sh, sh * 0.35), tone(strap, "shade"), 0.6),
          line([[-W / 2 + 0.4, y - sh * 0.3], [W / 2 - 0.4, y - sh * 0.3]], tone(strap, "light"), 0.1, 0.7, { stroke: { color: tone(strap, "light"), width: 0.1 * k, dash: [0.3 * k, 0.25 * k] } })];
        if (back) {
          // the inside of the wrist: the buckle, and the case's edge showing at the outer side
          shapes.push(P(rrect(-0.6 * k, y - 0.4 * k - sh * 0.1, 1.2 * k, 0.8 * k + sh * 0.2, 0.2 * k), metal), flat(rect(-0.1 * k, y - sh / 2, 0.2 * k, sh), tone(metal, "deep"), 0.6),
            P(rrect(out * (W / 2) - 0.55 * k, y - cr * 0.6, 1.1 * k, cr * 1.2, 0.5 * k), metal));
          return { shapes, edge: 0.14 };
        }
        const tick = (a: number) => placed(rrect(-0.09 * k, -cr * 0.66, 0.18 * k, 0.36 * k, 0.05 * k), [0, y], a);
        shapes.push(
          P(rrect(-cr * 0.62, y - cr - 0.45 * k, cr * 1.24, cr * 2 + 0.9 * k, 0.35 * k), tone(metal, "shade")),
          { path: circle(0, y, cr), fill: metal },
          { path: circle(0, y, cr * 0.8), fill: dial },
          { path: new Path().add(tick(0)).add(tick(Math.PI / 2)).add(tick(Math.PI)).add(tick(-Math.PI / 2)), fill: hands, flat: true, opacity: 0.85 },
          line([[0, y], [-Math.sin(Math.PI / 3) * cr * 0.42, y - Math.cos(Math.PI / 3) * cr * 0.42]], hands, 0.2 * k, 1),
          line([[0, y], [Math.sin(Math.PI / 3) * cr * 0.6, y - Math.cos(Math.PI / 3) * cr * 0.6]], hands, 0.14 * k, 1),
          flat(circle(0, y, 0.16 * k), metal),
          { path: smooth([[-cr * 0.86, y - cr * 0.1], [-cr * 0.55, y - cr * 0.62], [-cr * 0.1, y - cr * 0.86], [-cr * 0.5, y - cr * 0.5]], true, 1), fill: "#FFFFFF", flat: true, opacity: 0.35 },
        );
        return { shapes, edge: 0.14 };
      });
    },
  }),

  tesbih_wrist: named("wrist", "Prayer beads on the wrist", "tespih", {
    colors: 2, defaults: ["fab_20"], builds: ["adult", "elder", "child"], tags: ["traditional", "religious", "elder", "cultural"], sides: { allowed: ["l", "r"], default: "l" },
    draw: ctx => {
      const c = ctx.colors[0] ?? "#6B4A35", t = ctx.colors[1] ?? tone(c, "shade");
      // one loop of beads round the wrist, the front half seen (the beads at the sides foreshortened)
      const loop = (w: number, y: number, k: number): Group => {
        const r = 0.42 * k, rx = w / 2 + 0.25, n = Math.max(7, Math.round(Math.PI * rx / (2.3 * r))), beads = new Path(), glints = new Path();
        for (let i = 0; i < n; i++) {
          const a = -Math.PI / 2 + Math.PI * (i + 0.5) / n, x = Math.sin(a) * rx, yy = y + Math.cos(a) * 0.7 * k, rr = r * (0.72 + 0.28 * Math.cos(a));
          beads.add(ellipse(x, yy, rr * (0.7 + 0.3 * Math.cos(a)), rr));
          if (Math.abs(a) < 1.1) glints.add(circle(x - rr * 0.3, yy - rr * 0.35, rr * 0.24));
        }
        return { edge: 0.08, shapes: [lift(), line([[-rx, y], [0, y + 0.7 * k], [rx, y]], tone(c, "deep"), 0.12 * k, 0.8), { path: beads, fill: c }, { path: glints, fill: tone(c, "edge"), flat: true, opacity: 0.85 }] };
      };
      return onWrist(ctx, ({ w, y, k }) => loop(w, y, k), ({ hand, y, k }) => {
        // the imame where the strings meet and the tassel, hanging over the back of the hand
        const y0 = y + 0.7 * k, tassel = new Path();
        for (let i = -3; i <= 3; i++) tassel.add(rrect(i * 0.24 * k - 0.11 * k + i * 0.05 * k, y0 + 2.2 * k, 0.22 * k, 3.4 * k + Math.abs(i) * -0.15 * k, 0.11 * k));
        return [{ layer: "hand", bone: `hand_${hand}`, group: { edge: 0.1, shapes: [lift(),
          { path: ellipse(0, y0 + 1.1 * k, 0.42 * k, 0.85 * k), fill: c },
          flat(ellipse(-0.12 * k, y0 + 0.8 * k, 0.12 * k, 0.3 * k), tone(c, "edge"), 0.8),
          { path: tassel, fill: t },
          { path: rrect(-0.55 * k, y0 + 1.95 * k, 1.1 * k, 0.6 * k, 0.25 * k), fill: tone(t, "deep") },
        ] } }];
      });
    },
  }),

  bangle_kara: named("wrist", "Kara (Sikh steel bangle)", "Sih bileziği (kara)", {
    colors: 1, palettes: ["metal"], defaults: ["met_silver"], builds: ["adult", "elder", "child"], tags: ["religious", "faith", "cultural"], sides: { allowed: ["l", "r"], default: "r" },
    draw: ctx => {
      const c = ctx.colors[0] ?? "#C3C8CE";
      // a plain thick steel ring, loose on the wrist: the front half of it seen a little from above
      return onWrist(ctx, ({ w, y, k }) => {
        const rx = w / 2 + 1, ry = rx * 0.26, th = 0.9 * k, n = 16, lower: Vec2[] = [], upper: Vec2[] = [];
        for (let i = 0; i <= n; i++) { const a = Math.PI * i / n; lower.push([Math.cos(a) * rx, y + Math.sin(a) * ry + th / 2]); upper.push([Math.cos(Math.PI - a) * (rx - 0.05), y + Math.sin(Math.PI - a) * ry - th / 2]); }
        const ring = poly([...lower, ...upper]), hi: Vec2[] = [], lo: Vec2[] = [];
        for (let i = 0; i <= 8; i++) { const a = Math.PI * (0.55 + 0.38 * i / 8); hi.push([Math.cos(a) * rx * 0.98, y + Math.sin(a) * ry - th * 0.18]); }
        for (let i = 0; i <= 10; i++) { const a = Math.PI * (0.1 + 0.6 * i / 10); lo.push([Math.cos(a) * rx, y + Math.sin(a) * ry + th * 0.3]); }
        return { edge: 0.12, shapes: [lift(), { path: ring, fill: c }, line(lo, tone(c, "shade"), th * 0.4, 0.8, { clip: ring }), line(hi, tone(c, "edge"), th * 0.28, 0.95)] };
      });
    },
  }),

  // ---- hands

  ring_band: named("hands", "Wedding ring", "alyans", {
    colors: 1, palettes: ["metal"], defaults: ["met_gold"], builds: ["adult", "elder"], tags: ["formal", "traditional", "work"], sides: { allowed: ["l", "r"], default: "r" },
    draw: ctx => {
      const b = ctx.body, c = ctx.colors[0] ?? "#E0B03C", k = kOf(b);
      return onHands(ctx, sidesOf(ctx.side, "r"), (side, shape) => {
        const at = ringAt(b, side, shape);
        if (!at) return null;
        const t = 0.5 * k, h = at.r + 0.14, band = placed(rrect(-t / 2, -h, t, 2 * h, t / 2), at.c, at.dir);
        return { edge: 0.06, shapes: [lift(), { path: band, fill: c }, flat(placed(ellipse(-t * 0.1, -h * 0.45, t * 0.22, h * 0.28), at.c, at.dir), "#FFFDF6", 0.85)] };
      });
    },
  }),

  hand_henna: named("hands", "Henna on the hands", "elde kına", {
    colors: 1, defaults: ["fab_13"], tags: ["traditional", "festive", "cultural"],
    draw: ctx => {
      const b = ctx.body, c = ctx.colors[0] ?? "#A23F28", L = b.handL, w = b.armW[2] * 1.12, s = L / 13;
      return onHands(ctx, [1, -1], (side, shape, back) => {
        const clip = handOutline(b, side, shape, back), x = side * w * 0.02, y = L * 0.22;
        const dye = (path: Path, opacity = 0.9): Shape => ({ path, fill: c, flat: true, opacity, clip });
        if (b.build === "toddler") return { shapes: [dye(circle(x, y, 0.9 * s))] };
        // a rosette on the palm or the back of the hand, a ring of dots, a line of dots at the wrist and the fingertips dyed, as for a kına night
        const petals = new Path(), dots = new Path(), wrist = new Path();
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; petals.add(placed(ellipse(1.15 * s, 0, 0.5 * s, 0.28 * s), [x, y], a)); }
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 + Math.PI / 6; dots.add(circle(x + Math.cos(a) * 1.85 * s, y + Math.sin(a) * 1.85 * s, 0.2 * s)); }
        for (let i = -2; i <= 2; i++) wrist.add(circle(i * w * 0.17, L * 0.02, 0.2 * s));
        // two dyed pieces, each clipped once: the pattern, and the fingertips with the line at the wrist (a little lighter)
        return { shapes: [
          dye(new Path().add(circle(x, y, 0.55 * s)).add(petals).add(dots).add(wrist)),
          dye(new Path().add(rect(-w * 0.6, L * 0.035 - 0.08 * s, w * 1.2, 0.16 * s)).add(rect(-w * 2, L * 0.82, w * 4, L)), 0.8),
        ] };
      });
    },
  }),

  // ---- waist

  apron_shop: named("waist", "Shop apron", "önlük", {
    colors: 2, defaults: ["fab_04"], patterns: APRON_PATTERNS, builds: ["adult", "elder", "child"], tags: ["work", "shop", "istanbul"], over: ["top", "bottom", "outer"],
    draw: ctx => {
      const b = ctx.body, c = ctx.colors[0] ?? "#2E3A59", trim = ctx.colors[1], tape = trim ?? tone(c, "shade"), pencil = ctx.kit.color("fab_12");
      const T = b.torsoL, top = bibTop(b), bw = Math.min(10, b.chestW * 0.28), ww = b.waistW / 2 + 2.5, len = b.thighL * 0.95, hw = b.hipW / 2 + 4;
      const body: Pt[] = [[-bw, top, 0], [bw, top, 0], [bw * 1.08, -T * 0.42], [ww, -T * 0.2, 0], [hw, len, 0], [0, len + 1], [-hw, len, 0], [-ww, -T * 0.2, 0], [-bw * 1.08, -T * 0.42]];
      const bandP = rrect(-ww - 0.6, -T * 0.22 - 1, ww * 2 + 1.2, 2.2, 1);
      const front: Group = { shapes: [
        line([[-bw * 0.8, top + 0.5], [-b.neckW / 2 - 0.5, -T - 0.2]], tape, 1.5, 1),
        line([[bw * 0.8, top + 0.5], [b.neckW / 2 + 0.5, -T - 0.2]], tape, 1.5, 1),
        S(body, c), ...printed(ctx, smooth(body, true, 1), { hem: len + 1 }),
        S([[-ww * 0.62, 6, 0], [ww * 0.62, 6, 0], [ww * 0.6, 16, 0], [-ww * 0.6, 16, 0]], trim ?? tone(c, "light"), { opacity: 0.95 }),
        line([[0, 6.2], [0, 15.8]], tone(trim ?? c, "deep"), 0.5, 0.6),
        { path: rrect(ww * 0.25, 2.4, 0.9, 6.5, 0.4), fill: pencil },
        trim ? { path: bandP, fill: trim } : { path: bandP, fill: tone(c, "shade"), flat: true, opacity: 0.8 },
        S([[hw - 3.6, len * 0.4], [hw, len, 0], [hw - 3.2, len + 0.6]], tone(c, "shade"), { flat: true, opacity: 0.5 }),
      ] };
      const back: Group = { shapes: [
        { path: bandP, fill: trim ?? c }, ...(trim ? [] : printed(ctx, bandP, { hem: -T * 0.22 + 1.2 })),
        S([[0, -T * 0.21], [-3.4, -T * 0.21 - 2.4], [-3.8, -T * 0.21 + 1.6]], tone(trim ?? c, "light")), S([[0, -T * 0.21], [3.4, -T * 0.21 - 2.4], [3.8, -T * 0.21 + 1.6]], tone(trim ?? c, "light")),
        line([[-0.4, -T * 0.21], [-2, -T * 0.21 + 9]], trim ?? c, 1.4, 1), line([[0.4, -T * 0.21], [1.6, -T * 0.21 + 8]], trim ?? c, 1.4, 1),
        line([[-b.neckW / 2 - 0.5, -T - 0.4], [0, -T + 3]], trim ?? c, 1.5, 1), line([[b.neckW / 2 + 0.5, -T - 0.4], [0, -T + 3]], trim ?? c, 1.5, 1),
      ] };
      return { front: [{ layer: "chest_over", bone: "spine", group: front }], back: [{ layer: "chest_over", bone: "spine", group: back }] };
    },
  }),

  // Gülten Hanım's garden apron: a sturdy square bib on two shoulder straps with slide buckles, a big
  // two-part pouch with secateurs in it (a child's pouch is empty), the skirt to above the knee; from
  // behind the straps cross in an X into the waist band.
  apron_garden: named("waist", "Garden apron", "bahçe önlüğü", {
    colors: 2, palettes: ["fabric", "fabric"], defaults: ["fab_09", "fab_20"], builds: ["adult", "elder", "child"], tags: ["work", "garden", "florist"], over: ["top", "bottom", "outer"],
    draw: ctx => {
      const b = ctx.body, k = kOf(b), c = ctx.colors[0] ?? "#4E7A68", trim = ctx.colors[1] ?? "#6B4A35", T = b.torsoL, v = T / 43, metal = ctx.kit.color("met_silver");
      const wide = ctx.avatar.body?.shape === "broad" || ctx.avatar.body?.shape === "round", kid = b.build === "child";
      const top = -T + 8.5 * v, bw = b.chestW * 0.3, { y, half } = apronWaist(b), len = b.thighL * 0.85, hw = b.hipW / 2 + 3.5;
      const body: Pt[] = [[-bw, top, 0], [bw, top, 0], [bw * 1.02, y - 4 * v], [half - 0.4, y + 1, 0], [hw, len - 1.4], [hw - 1.2, len, 0], [0, len + 0.4], [-hw + 1.2, len, 0], [-hw, len - 1.4], [-half + 0.4, y + 1, 0], [-bw * 1.02, y - 4 * v]];
      // the straps: from the bib's corners up over the shoulders, wider apart on a broad or round body
      const sx = b.neckW / 2 + (wide ? 4 : 2.6) * k, sw = 1.6 * k, bx = bw - sw * 0.6, by = top - 3 * k;
      const buckle = (s: 1 | -1): Shape[] => {
        const x = s * (bx + (sx - bx) * 0.12), r = rrect(x - 0.95 * k, by - 0.65 * k, 1.9 * k, 1.3 * k, 0.25 * k);
        return [P(r, metal), flat(rrect(x - 0.6 * k, by - 0.3 * k, 1.2 * k, 0.6 * k, 0.15 * k), tone(trim, "deep"), 0.8), flat(rect(x - 0.95 * k, by - 0.6 * k, 1.9 * k, 0.25 * k), tone(metal, "light"), 0.6)];
      };
      // the pouch: 18 × 13 cm, two compartments, its top hemmed in the trim colour, dashed stitching
      const pw = Math.min(18 * k, hw * 2 - 4), ph = 13 * k, px = -pw / 2, py = y + 1.5 * k, dash = { color: tone(c, "light"), width: 0.16 * k, dash: [0.5 * k, 0.35 * k] };
      const stitchP = new Path().add(poly([[px + 0.6 * k, py + 1.8 * k], [px + 0.6 * k, py + ph - 0.6 * k], [px + pw - 0.6 * k, py + ph - 0.6 * k], [px + pw - 0.6 * k, py + 1.8 * k]], false)).add(poly([[0, py + 1.8 * k], [0, py + ph - 0.6 * k]], false));
      // secateurs in the wearer's-left compartment: red grips up out of it, the metal head at its mouth
      const red = ctx.kit.color("fab_23"), tx = pw * 0.26, hy = py - 1.8 * k;
      const tool: Shape[] = kid ? [] : [
        P(band([[tx - 0.4 * k, hy], [tx - 1.2 * k, hy - 2.6 * k], [tx - 1.9 * k, hy - 5.4 * k]], [1.3 * k, 1.5 * k, 1.4 * k]), red),
        P(band([[tx + 0.4 * k, hy], [tx + 1.3 * k, hy - 2.5 * k], [tx + 2.3 * k, hy - 5 * k]], [1.3 * k, 1.5 * k, 1.4 * k]), tone(red, "shade")),
        P(smooth([[tx - 1.1 * k, hy + 0.2 * k], [tx - 0.2 * k, hy - 1.2 * k], [tx + 1.1 * k, hy + 0.1 * k], [tx + 0.9 * k, py + 1 * k, 0], [tx - 0.9 * k, py + 1 * k, 0]], true, 1), metal),
        flat(circle(tx, hy + 0.5 * k, 0.4 * k), tone(metal, "deep"), 0.8),
      ];
      const front: Group = { shapes: [lift(),
        line([[-bx, top + 0.3], [-sx, -T - 0.4]], trim, sw, 1), line([[bx, top + 0.3], [sx, -T - 0.4]], trim, sw, 1),
        S(body, c),
        flat(smooth([[hw - 3.4, y + 4], [hw, len - 1.4], [hw - 1.2, len], [hw - 4, len]], true, 1), tone(c, "shade"), 0.45),
        flat(rect(-bw, top, bw * 2, 1.2 * k), trim, 0.9),
        line([[-bw + 0.7 * k, top + 1.8 * k], [bw - 0.7 * k, top + 1.8 * k]], tone(c, "light"), 0.16 * k, 0.7, { stroke: dash }),
        ...buckle(1), ...buckle(-1),
        ...tool,
        P(rrect(px, py, pw, ph, [0.2 * k, 0.2 * k, 1.2 * k, 1.2 * k]), c),
        flat(rect(px, py, pw, 1.2 * k), trim, 0.9),
        flat(rect(px + 0.3, py + ph - 1.6 * k, pw - 0.6, 1.2 * k), tone(c, "shade"), 0.35),
        { path: stitchP, stroke: dash, flat: true, opacity: 0.8 },
        line([[-half + 0.6, y + 1], [-half - 0.8 * k, y + 2.4 * k]], trim, 1.2 * k, 1), line([[half - 0.6, y + 1], [half + 0.8 * k, y + 2.4 * k]], trim, 1.2 * k, 1),
      ] };
      // behind: the apron's side edges below the waist, the band, and the straps crossing between the shoulder blades
      const edge = (s: 1 | -1): Path => rrect(s > 0 ? hw - 2 : -hw - 0.2, y + 1.2, 2.2, len - y - 2.4, 1);
      const cross = (s: 1 | -1): Path => band([[s * sx, -T - 0.4], [s * sx * 0.6, -T * 0.7], [-s * half * 0.55, y]], [sw, sw, sw]);
      const back: Group = { shapes: [lift(),
        P(edge(-1), c), P(edge(1), tone(c, "shade")),
        P(rrect(-half, y - 1.3 * k, half * 2, 2.6 * k, 1 * k), trim),
        P(cross(-1), tone(trim, "shade")), P(cross(1), trim),
        flat(circle(0, (-T * 0.7 + y) * 0.5 - T * 0.12, 0.5 * k), tone(trim, "deep"), 0.5),
      ] };
      return { front: [{ layer: "chest_over", bone: "spine", group: front }], back: [{ layer: "chest_over", bone: "spine", group: back }] };
    },
  }),

  apron_cafe: named("waist", "Café apron", "kafe önlüğü", {
    colors: 2, defaults: ["fab_20", "fab_01"], patterns: ["pat_stripe_h", "pat_gingham", "pat_check", "pat_kilim_band"], builds: ["adult", "elder", "child"], tags: ["work", "cafe", "istanbul"], over: ["top", "bottom"],
    draw: ctx => {
      const b = ctx.body, k = kOf(b), c = ctx.colors[0] ?? "#6B4A35", tape = ctx.colors[1] ?? "#F7F3EA", { y, half } = apronWaist(b), hem = b.thighL * 0.7, sk = b.hipW / 2 + 2;
      const skirt = apronSkirt(y + 1, hem, Math.min(half, sk), sk), skirtP = smooth(skirt, true, 1), pw = Math.min(14 * k, sk * 1.2), ph = 9 * k, py = y + 6 * k;
      const front: Group = { shapes: [lift(),
        S(skirt, c), ...printed(ctx, skirtP, { hem: hem + 0.3 }),
        flat(smooth([[sk - 3.2, y + 2], [sk, hem - 1.6], [sk - 1.4, hem], [sk - 4, hem]], true, 1), tone(c, "shade"), 0.45),
        P(rrect(-pw / 2, py, pw, ph, 0.8 * k), tone(c, "light")),
        line([[-pw / 2 + 0.6 * k, py + 0.9 * k], [pw / 2 - 0.6 * k, py + 0.9 * k]], tape, 0.18 * k, 0.8, { stroke: { color: tape, width: 0.18 * k, dash: [0.5 * k, 0.4 * k] } }),
        line([[0, py + 1.3 * k], [0, py + ph - 0.4 * k]], tone(c, "deep"), 0.3 * k, 0.5),
        P(rrect(-half, y - 1.5 * k, half * 2, 3 * k, 1.2 * k), tape),
        flat(rrect(-half, y + 0.6 * k, half * 2, 0.9 * k, 0.4 * k), tone(tape, "shade"), 0.5),
        // the long ties wrap round and are bowed at the front of the left hip
        ...bow([half * 0.55, y], k, tape, 9),
      ] };
      const back: Group = { shapes: [lift(),
        P(rrect(-sk - 0.4, y + 0.6, 2.2, hem - y - 2.4, 1), c), P(rrect(sk - 1.8, y + 0.6, 2.2, hem - y - 2.4, 1), tone(c, "shade")),
        ...printed(ctx, rrect(-sk - 0.4, y + 0.6, 2.2, hem - y - 2.4, 1), { hem: hem - 1.8 }),
        P(rrect(-half, y - 1.5 * k, half * 2, 3 * k, 1.2 * k), tape), flat(rrect(-half, y + 0.6 * k, half * 2, 0.9 * k, 0.4 * k), tone(tape, "shade"), 0.5),
        // the long ties cross over the band at the small of the back on their way round to the bow in front
        P(band([[-half * 0.62, y - 1.6 * k], [0, y + 0.2 * k], [half * 0.62, y + 2 * k]], [1.1 * k, 1.1 * k, 1.1 * k]), tone(tape, "shade")),
        P(band([[-half * 0.62, y + 2 * k], [0, y + 0.2 * k], [half * 0.62, y - 1.6 * k]], [1.1 * k, 1.1 * k, 1.1 * k]), tape),
        flat(band([[-half * 0.5, y + 1.9 * k], [0, y + 0.55 * k]], [0.35 * k, 0.35 * k]), tone(tape, "shade"), 0.5),
      ] };
      return { front: [{ layer: "chest_over", bone: "spine", group: front }], back: [{ layer: "chest_over", bone: "spine", group: back }] };
    },
  }),

  apron_pockets: named("waist", "Apron with pockets", "cepli önlük", {
    colors: 2, defaults: ["fab_18", "fab_20"], patterns: ["pat_check", "pat_floral", "pat_stripe_h"], builds: ["adult", "elder"], tags: ["work", "market", "traditional", "cast"], over: ["top", "bottom"],
    draw: ctx => {
      const b = ctx.body, k = kOf(b), c = ctx.colors[0] ?? "#D8C3A0", trim = ctx.colors[1] ?? "#6B4A35", { y, half } = apronWaist(b), hem = b.thighL * 0.55, sk = b.hipW / 2 + 1.5;
      const skirt = apronSkirt(y + 1, hem, Math.min(half, sk), sk), skirtP = smooth(skirt, true, 1);
      const pw = Math.min(9 * k, (sk * 2 - 4) / 3 - 0.6), ph = Math.min(10 * k, hem - y - 9), py = y + 6.5 * k, gap = (sk * 2 - 3 * pw) / 4;
      const gold = ctx.kit.color("met_gold"), silver = ctx.kit.color("met_silver"), note = mix(ctx.kit.color("fab_43"), "#FFFFFF", 0.25);
      const shapes: Shape[] = [lift(), S(skirt, c), ...printed(ctx, skirtP, { hem: hem + 0.3 }),
        flat(smooth([[sk - 3, y + 2], [sk, hem - 1.6], [sk - 1.4, hem], [sk - 3.6, hem]], true, 1), tone(c, "shade"), 0.45)];
      for (let i = 0; i < 3; i++) {
        const x = -sk + gap + i * (pw + gap);
        if (i === 1) {
          // the change in the middle pocket: a folded banknote and three coins peeking out
          shapes.push(P(placed(rrect(-1.9 * k, -3 * k, 3.8 * k, 4.2 * k, 0.2 * k), [x + pw * 0.64, py + 0.6 * k], 0.24), note), flat(placed(rect(-1.3 * k, -2.3 * k, 2.6 * k, 0.35 * k), [x + pw * 0.64, py + 0.6 * k], 0.24), tone(note, "deep"), 0.6),
            flat(placed(circle(0, -1.2 * k, 0.6 * k), [x + pw * 0.64, py + 0.6 * k], 0.24), tone(note, "shade"), 0.7),
            P(circle(x + pw * 0.2, py - 0.4 * k, 0.95 * k), gold), P(circle(x + pw * 0.4, py - 0.75 * k, 0.85 * k), silver), P(circle(x + pw * 0.3, py + 0.05 * k, 0.8 * k), gold));
        }
        shapes.push(P(rrect(x, py, pw, ph, [0.2 * k, 0.2 * k, 1 * k, 1 * k]), tone(c, "light")), P(rect(x, py, pw, 1.1 * k), trim, { flat: true, opacity: 0.9 }),
          line([[x + 0.5 * k, py + 1.6 * k], [x + 0.5 * k, py + ph - 0.6 * k], [x + pw - 0.5 * k, py + ph - 0.6 * k], [x + pw - 0.5 * k, py + 1.6 * k]], tone(c, "deep"), 0.12 * k, 0.6, { stroke: { color: tone(c, "deep"), width: 0.12 * k, dash: [0.4 * k, 0.3 * k] } }));
      }
      shapes.push(P(rrect(-half, y - 1.3 * k, half * 2, 2.6 * k, 1 * k), trim), line([[half - 1, y + 0.6], [half + 0.6, y + 6 * k]], trim, 0.9 * k, 1));
      const back: Group = { shapes: [lift(),
        P(rrect(-sk - 0.4, y + 0.6, 2.2, hem - y - 2.4, 1), c), P(rrect(sk - 1.8, y + 0.6, 2.2, hem - y - 2.4, 1), tone(c, "shade")),
        ...printed(ctx, rrect(-sk - 0.4, y + 0.6, 2.2, hem - y - 2.4, 1), { hem: hem - 1.8 }),
        P(rrect(-half, y - 1.3 * k, half * 2, 2.6 * k, 1 * k), trim), ...bow([0, y], k, trim, 7),
      ] };
      return { front: [{ layer: "chest_over", bone: "spine", group: { shapes } }], back: [{ layer: "chest_over", bone: "spine", group: back }] };
    },
  }),
};
