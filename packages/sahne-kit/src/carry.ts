// Bags and things in hand, in two slots: `carry` (worn bags: a backpack, a tote, a shoulder bag)
// and `hold` (what a hand holds: an umbrella, a phone, a book, a suitcase, a walking cane, a white
// cane). They are separate, so a cane user can also wear a backpack.
//
// THE CARRY ARTIST'S FILE: add parts to `CARRY` (ids: carry `bag_ case_`, hold `bag_ book_ cane_
// phone_ umbrella_`, permanent). A worn bag draws its body on `body_back` (behind the body in front,
// over the back from behind) and its straps on `chest_over`. A held part is one-sided (`sides`: a cane in
// the wearer's right hand by default, the rest in the left; `holdHand(ctx.side)`), and `heldOut(hand, front, back)` puts its pieces
// on the hand bone (they swing with the arm; the handle at `gripAt(b)`) or, with `onRoot`, on the
// root bone with the handle at `restGrip(b, hand)` (a suitcase, a cane on the floor), marks them
// held and closes the hand. Everything rests in the hanging hand: no arm poses.
//
// Sizes: worn bags from the torso (`u` = torsoL / 43, an adult's cm), things in the hand from the
// hand (`handL`) and the grip's height above the floor, so a child's case is a child's and an
// elder's cane reaches their lower hand. The closed hand (`fistOf`) covers the middle of a handle:
// what shows is what sticks out of it (a crook's hook, a phone's end, a book below the knuckles).
// Light comes from the upper left in art space in both views, as in the rest of the kit: shade on
// +x. A thing's own sides do not mirror (a book's spine is at -x front and back).
//
// The arms hang in front of the torso and cover the sides of the chest (a child's nearly meet at
// the collar), so a backpack's padded straps lie on `over_sleeve` along the inner edge of the
// sleeves, where they show on every build, and only their webbing goes under the arms
// (`chest_over`). A shoulder bag or a tote hangs under the arm on `chest_over`.

import { arcPoints, ellipse, luma, mix, mul, rotate, rrect, rect, smooth, tone, translate, type BodyDims, type Group, type Kit, type PartCtx, type PartDef, type PartOut, type Path, type Shape, type Vec2 } from "sahne";
import { named, S, line, flat, sidesOf, printed, gripAt, restGrip, holdHand, heldOut, patternsFor, type Pt } from "./draw/index.ts";

/**
 * A tube of one width along a smooth centre line: a strap, a crook, a rod. Its ends are cut square
 * at the first and last points (`band` would round them past the points).
 */
function tube(pts: Vec2[], width: number, fill: string, o: Partial<Shape> = {}): Shape {
  const n = pts.length, w = width / 2, left: Pt[] = [], right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l * w, ny = (b[0] - a[0]) / l * w;
    const end = i === 0 || i === n - 1, p = pts[i];
    left.push(end ? [p[0] + nx, p[1] + ny, 0] : [p[0] + nx, p[1] + ny]);
    right.push(end ? [p[0] - nx, p[1] - ny, 0] : [p[0] - nx, p[1] - ny]);
  }
  return { path: smooth([...left, ...right.reverse()], true, 1), fill, ...o };
}

/** A flat shade or sheen cut to an outline (it never changes the silhouette). */
const tint = (path: Path, fill: string, opacity: number, inside: Path): Shape => ({ path, fill, flat: true, opacity, clip: inside });

/** A ring (a bag's D-ring, a wheel's hub): a disc with a hole. */
const ring = (x: number, y: number, r: number, fill: string): Shape => ({ path: ellipse(x, y, r, r).add(ellipse(x, y, r * 0.55, r * 0.55)), fill, evenodd: true });

/** The closed hand (`handShape(…, "hold")`) in the hand bone's frame: its half width, its top (the wrist end) and its knuckles. */
const fistOf = (b: BodyDims) => ({ half: 0.53 * b.armW[2] * 1.12, top: -0.08 * b.handL, bottom: 0.62 * b.handL });

/** Shapes turned by `a` radians about a point (a phone tilted in the hand). */
function turned(shapes: Shape[], a: number, about: Vec2): Shape[] {
  const m = mul(translate(about[0], about[1]), mul(rotate(a), translate(-about[0], -about[1])));
  return shapes.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip && !Array.isArray(s.clip) ? { clip: s.clip.transform(m) } : {}) }));
}

/** A held part: one hand (`hand` by default, the wearer's right for a cane, the left for the rest, as the catalogue says) and its names. */
function held(en: string, tr: string, hand: "l" | "r", rest: Omit<PartDef, "slot" | "name" | "names" | "sides">): PartDef {
  return named("hold", en, tr, { sides: { allowed: ["l", "r"], default: hand }, ...rest });
}

/** The inner edge of a top's sleeve at height `y` on the spine bone (the arm hangs a little outwards). */
function sleeveInner(b: BodyDims, y: number): number {
  const sx = b.shoulderW / 2 - b.armW[0] * 0.5, sy = -b.torsoL + b.armW[0] * 0.72, t = Math.min(1, Math.max(0, (y - sy) / b.upperArmL));
  return sx + 0.13 * Math.max(0, y - sy) - ((b.armW[0] * 1.18 + 1.6) * (1 - t) + (b.armW[1] * 1.16 + 1.6) * t) / 2;
}

// ---- worn bags --------------------------------------------------------------------------------------

/** The everyday backpack: its body behind the back, two padded straps and a chest strap in front. */
function backpack(ctx: PartCtx): PartOut {
  const b = ctx.body, c = ctx.colors[0] ?? "#2E3A59", c2 = ctx.colors[1] ?? tone(c, "deep"), T = b.torsoL, u = T / 43;
  const bw = Math.min(0.95 * b.chestW, 0.9 * b.shoulderW) / 2, top = -T - Math.min(7 * u, b.neckL * 0.9), h = 0.95 * T + (top + T) * -0.4, bot = top + h;
  const body = rrect(-bw, top, bw * 2, h, [bw * 0.72, bw * 0.72, 4 * u, 4 * u]);
  // in front the pack shows round the torso: its rounded top either side of the neck above the
  // shoulders and its sides just past the waist under the arms (the rest is behind the body)
  const fw = Math.max(b.shoulderW, b.chestW) / 2 + 1.5 * u, fbody = rrect(-fw, top, fw * 2, h, [fw * 0.62, fw * 0.62, 5 * u, 5 * u]);
  const nw = b.neckW / 2 + 1.4, sw = 4 * u, dark = mix(c2, "#000000", 0.55);

  // front: each padded strap from the top of the shoulder down the inner edge of the sleeve to a
  // slider, then the webbing round under the arm to the pack's bottom corner
  const yb = -0.42 * T, xb = Math.max(nw + 0.7 * sw, sleeveInner(b, yb) + 0.15 * sw);
  const pad = (s: 1 | -1): Vec2[] => [[s * (nw + 0.3 * sw), -T - 1.2 * u], [s * (nw + 0.45 * sw), -T + 3 * u], [s * (xb - 0.1 * sw), -T + 0.32 * T], [s * xb, yb]];
  const straps: Shape[] = [], webbing: Shape[] = [];
  for (const s of [1, -1] as const) {
    const p = pad(s);
    webbing.push(tube([[s * xb, yb - 1 * u], [s * (xb + 2.2 * u), yb + 4 * u], [s * (xb + 5 * u), -0.22 * T]], 1.5 * u, tone(c2, "deep")));
    straps.push(tube(p, sw, c2), line(p.slice(0, 3).map(([x, y]) => [x - sw * 0.28, y] as Vec2), tone(c2, "light"), 0.45 * u, 0.55),
      { path: rrect(s * xb - sw * 0.62, yb - 1.4 * u, sw * 1.24, 1.6 * u, 0.5 * u), fill: dark });
  }
  const sy = -T + 9 * u, sx = nw + 0.4 * sw;
  straps.push(line([[-sx, sy], [sx, sy]], tone(c2, "shade"), 1 * u, 1), { path: rrect(-1.6 * u, sy - 1 * u, 3.2 * u, 2 * u, 0.6 * u), fill: dark });
  const front: Group = { shapes: [
    { path: fbody, fill: tone(c, "shade") },
    // the lit top seam and its grab loop
    line([[-fw * 0.7, top + 2.4 * u], [-fw * 0.3, top + 1.1 * u], [fw * 0.3, top + 1.1 * u], [fw * 0.7, top + 2.4 * u]], tone(c, "light"), 0.8 * u, 0.5),
    tube([[-2.2 * u, top + 1.6 * u], [-1.5 * u, top - Math.min(1.8 * u, b.neckL * 0.3)], [1.5 * u, top - Math.min(1.8 * u, b.neckL * 0.3)], [2.2 * u, top + 1.6 * u]], 1.2 * u, c2),
  ] };

  // back: the body over the back, a zipped front pocket, the grab loop, the strap ends
  const pw = 0.54 * bw, ph = 0.32 * h, pTop = bot - ph - 2.4 * u, pocket = rrect(-pw, pTop, pw * 2, ph, [2.6 * u, 2.6 * u, 3.6 * u, 3.6 * u]);
  const loopH = Math.min(1.8 * u, b.neckL * 0.3);
  const back: Group = { shapes: [
    tube([[-2.2 * u, top + 1.6 * u], [-1.5 * u, top - loopH], [1.5 * u, top - loopH], [2.2 * u, top + 1.6 * u]], 1.2 * u, c2),
    ...([1, -1] as const).map(s => tube([[s * bw * 0.42, top + 6 * u], [s * (b.shoulderW / 2 - 4 * u), -T - 0.6 * u], [s * (b.shoulderW / 2 - 2.2 * u), -T + 1.6 * u]], sw, c2)),
    { path: body, fill: c },
    tint(rect(bw - 3.6 * u, top, 4 * u, h), tone(c, "shade"), 0.55, body),
    line([[-bw + 2.2 * u, top + bw * 0.75], [-bw * 0.6, top + 2.8 * u], [0, top + 2 * u]], tone(c, "light"), 0.9 * u, 0.4),
    line([[-bw + 2.6 * u, pTop - 2.2 * u], [-bw + 2.4 * u, top + bw * 0.62], [-bw * 0.55, top + 3.4 * u], [0, top + 2.6 * u], [bw * 0.55, top + 3.4 * u], [bw - 2.4 * u, top + bw * 0.62], [bw - 2.6 * u, pTop - 2.2 * u]], tone(c, "deep"), 0.5 * u, 0.75),
    flat(rrect(bw * 0.52, top + 3.2 * u, 0.9 * u, 3 * u, 0.45 * u), tone(c2, "light")),
    { path: pocket, fill: c2 },
    tint(rect(pw - 2.6 * u, pTop, 3 * u, ph), tone(c2, "shade"), 0.5, pocket),
    line([[-pw + 1.6 * u, pTop + 1.6 * u], [pw - 1.6 * u, pTop + 1.6 * u]], tone(c2, "deep"), 0.5 * u, 0.75),
    flat(rrect(pw * 0.4, pTop + 1.4 * u, 0.9 * u, 3 * u, 0.45 * u), tone(c, "light")),
    // the webbing from the bottom corners round the sides
    ...([1, -1] as const).map(s => tube([[s * (bw - 3.4 * u), bot - 3 * u], [s * (bw - 0.6 * u), bot - 8 * u], [s * (bw + 1.2 * u), -0.32 * T]], 1.5 * u, tone(c2, "deep"))),
  ] };
  return {
    front: [{ layer: "body_back", bone: "spine", group: front }, { layer: "chest_over", bone: "spine", group: { shapes: webbing } }, { layer: "over_sleeve", bone: "spine", group: { shapes: straps } }],
    back: [{ layer: "body_back", bone: "spine", group: back }],
  };
}

/** Where a bag that hangs from one shoulder hangs: its centre's x (clear of the hip) and how much lower a round body lets it hang. */
function besideHip(b: BodyDims, s: 1 | -1, out: number): { x: number; drop: number } {
  const u = b.torsoL / 43;
  return { x: s * (Math.max(b.hipW, b.waistW) / 2 + out * u), drop: Math.min(1.5, Math.max(0, (b.waistW / b.hipW - 0.9) * 15)) * u };
}

/** Where a one-shoulder strap rests: halfway along the shoulder slope, over the top of the sleeve. */
const onShoulder = (b: BodyDims, s: 1 | -1): Vec2 => [s * (b.shoulderW / 2 - 0.6 * b.armW[0]), -b.torsoL - 0.6 * b.torsoL / 43];

/** The canvas tote on one shoulder: a soft bag beside the hip under the arm, its handles a loop over the shoulder. */
function tote(ctx: PartCtx): PartOut {
  const b = ctx.body, c = ctx.colors[0] ?? "#F0E2C8", c2 = ctx.colors[1] ?? tone(c, "deep"), T = b.torsoL, u = T / 43, [s] = sidesOf(ctx.side, "l");
  const tw = 0.7 * T, th = 0.74 * T, { x: cx, drop } = besideHip(b, s, 5), ty = -0.3 * T + drop, by = ty + th, hw = 2.6 * u;
  // soft canvas: the mouth sags between the handles, the sides narrow a little to the top, the bottom is round
  const outline = smooth([[cx - 0.44 * tw, ty, 0], [cx - 0.2 * tw, ty + 1.1 * u], [cx + 0.2 * tw, ty + 1.1 * u], [cx + 0.44 * tw, ty, 0], [cx + 0.5 * tw, ty + 0.5 * th], [cx + 0.46 * tw, by - 3.5 * u], [cx + 0.3 * tw, by], [cx - 0.3 * tw, by], [cx - 0.46 * tw, by - 3.5 * u], [cx - 0.5 * tw, ty + 0.5 * th]]);
  // the strand towards the viewer rests halfway along the shoulder and falls along the inner edge of
  // the sleeve, where it shows; the other goes behind the arm to the bag's outer handle
  const sh = onShoulder(b, s), xi = s * Math.min(Math.abs(cx) - 0.24 * tw, sleeveInner(b, ty) - 0.2 * hw), xo = cx + s * 0.24 * tw;
  const near = (lean: number): Shape[] => [
    tube([[xi, ty + 4 * u], [xi - s * lean * u, ty - 0.3 * T], [sh[0] - s * 1.2 * u, -T + 6 * u], [sh[0], sh[1]]], hw, c2),
    line([[xi - hw * 0.4, ty + 1.4 * u], [xi + hw * 0.4, ty + 1.4 * u], [xi + hw * 0.4, ty + 3.6 * u], [xi - hw * 0.4, ty + 3.6 * u], [xi - hw * 0.4, ty + 1.4 * u]], tone(c2, "light"), 0.3 * u, 0.6),
  ];
  const far = tube([[xo, ty + 4 * u], [xo, ty - 3 * u], [sh[0] + s * 2 * u, -T + 6 * u], [sh[0] + s * 1.2 * u, sh[1] + 0.2 * u]], hw, tone(c2, "shade"));
  const bag = (view: "front" | "back"): Shape[] => [
    far,
    { path: outline, fill: c },
    ...printed(ctx, outline, { hem: by, cx }),
    tint(rect(cx + 0.5 * tw - 4 * u, ty, 4.5 * u, th + 1), tone(c, "shade"), 0.5, outline),
    // the hemmed mouth, lit
    { ...line([[cx - 0.44 * tw, ty + 0.9 * u], [cx - 0.2 * tw, ty + 2 * u], [cx + 0.2 * tw, ty + 2 * u], [cx + 0.44 * tw, ty + 0.9 * u]], tone(c, "light"), 1.6 * u, 0.8), clip: outline },
    // a soft crease where the canvas folds
    view === "front" ? line([[cx + s * 0.06 * tw, ty + 3 * u], [cx + s * 0.1 * tw, ty + 0.45 * th]], tone(c, "shade"), 0.6 * u, 0.5)
      : line([[cx - s * 0.12 * tw, by - 1 * u], [cx - s * 0.18 * tw, by - 0.3 * th]], tone(c, "shade"), 0.6 * u, 0.45),
  ];
  return {
    front: [{ layer: "chest_over", bone: "spine", group: { shapes: bag("front") } }, { layer: "over_sleeve", bone: "spine", group: { shapes: near(0) } }],
    back: [{ layer: "chest_over", bone: "spine", group: { shapes: bag("back") } }, { layer: "over_sleeve", bone: "spine", group: { shapes: near(0.8) } }],
  };
}

/**
 * A soft leather shoulder bag on one shoulder: a slouchy body with a zip top, a thin strap and brass
 * rings. It hangs at the hip a little forward, so it is drawn over the arm (`over_sleeve`) in both
 * views: under a wide sleeve (an abaya, a long coat) it would vanish. Both ends of the strap rise to
 * one point on the shoulder.
 */
function shoulderBag(ctx: PartCtx): PartOut {
  const b = ctx.body, c = ctx.colors[0] ?? "#6B4A35", c2 = ctx.colors[1] ?? tone(c, "deep"), T = b.torsoL, u = T / 43, [s] = sidesOf(ctx.side, "l");
  const brass = ctx.kit.color("met_gold"), bw = 0.5 * T, bh = 0.4 * T, { x: cx, drop } = besideHip(b, s, 3), ty = -0.08 * T + drop, by = ty + bh;
  const outline = smooth([[cx - 0.38 * bw, ty, 0], [cx, ty + 1 * u], [cx + 0.38 * bw, ty, 0], [cx + 0.5 * bw, ty + 0.55 * bh], [cx + 0.34 * bw, by], [cx - 0.34 * bw, by], [cx - 0.5 * bw, ty + 0.55 * bh]]);
  const xi = cx - s * 0.38 * bw, xo = cx + s * 0.38 * bw, sw = 1.8 * u, top = onShoulder(b, s);
  const body = (view: "front" | "back"): Shape[] => [
    { path: outline, fill: c },
    tint(rect(cx + 0.5 * bw - 3.6 * u, ty, 4 * u, bh + 1), tone(c, "shade"), 0.55, outline),
    line([[cx - 0.46 * bw, ty + 0.5 * bh], [cx - 0.3 * bw, by - 1.6 * u], [cx + 0.3 * bw, by - 1.6 * u], [cx + 0.46 * bw, ty + 0.5 * bh]], tone(c, "light"), 0.35 * u, 0.7, { stroke: { color: tone(c, "light"), width: 0.35 * u, dash: [0.9 * u, 0.7 * u] } }),
    line([[cx - 0.34 * bw, ty + 1.4 * u], [cx, ty + 2.2 * u], [cx + 0.34 * bw, ty + 1.4 * u]], tone(c, "deep"), 0.5 * u, 0.75),
    // front: a flap and its brass clasp; back: a slip pocket
    ...(view === "front"
      ? [{ path: smooth([[cx - 0.4 * bw, ty + 1.4 * u, 0], [cx + 0.4 * bw, ty + 1.4 * u, 0], [cx + 0.36 * bw, ty + 0.42 * bh], [cx, ty + 0.52 * bh], [cx - 0.36 * bw, ty + 0.42 * bh]]), fill: tone(c, "shade") },
        { path: rrect(cx - 0.6 * u, ty + 0.44 * bh, 1.2 * u, 2 * u, 0.4 * u), fill: brass }]
      : [line([[cx - 0.32 * bw, ty + 0.36 * bh], [cx + 0.32 * bw, ty + 0.36 * bh]], tone(c, "deep"), 0.5 * u, 0.6)]),
  ];
  // the far strand goes behind the bag, the near one over it; each ends at its ring
  const strand = (x: number, lean: number, fill: string) => tube([[x, ty - 0.6 * u], [x + (top[0] - x) * 0.35 + lean, ty - 0.35 * (ty - top[1])], [top[0], top[1]]], sw, fill);
  const view = (v: "front" | "back"): Shape[] => [
    strand(xo, -s * 1 * u, tone(c2, "shade")), ring(xo, ty - 0.4 * u, 1.1 * u, brass),
    ...body(v),
    strand(xi, 0, c2), ring(xi, ty - 0.4 * u, 1.1 * u, brass),
  ];
  return {
    front: [{ layer: "over_sleeve", bone: "spine", group: { shapes: view("front") } }],
    back: [{ layer: "over_sleeve", bone: "spine", group: { shapes: view("back") } }],
  };
}

/**
 * A child's school bag: a rounder, deeper pack than the backpack, with a domed top. In front the
 * padded straps carry a reflective strip and meet a chest clip; the dome's rim and the big pocket's
 * edge at the lower sides lie behind the body and show only where the arms and head leave room. From behind: a top flap with a buckle, a big zipped pocket
 * on the lower half, a bottle pocket at one side and a grab loop. Large on a child (about its whole
 * torso), smaller and rounder on a toddler; adults get the same proportions of their torso. As on the
 * backpack, the padded straps lie on `over_sleeve` (on `chest_over` a child's arms would hide them).
 */
function schoolBag(ctx: PartCtx): PartOut {
  const b = ctx.body, c = ctx.colors[0] ?? "#6F8FAF", c2 = ctx.colors[1] ?? "#F2B705", T = b.torsoL, u = T / 43;
  const kid = b.build === "child", tot = b.build === "toddler", dark = mix(c, "#000000", 0.6), strip = tone(c2, "light");
  const bw = (kid ? 1 : 0.9) * b.chestW / 2, h = (kid ? 1 : tot ? 0.95 : 0.9) * T, top = -T - Math.min(5 * u, b.neckL), bot = top + h;
  const dome = bw * (tot ? 0.95 : 0.8), corner = (tot ? 7 : 5) * u, body = rrect(-bw, top, bw * 2, h, [dome, dome, corner, corner]);
  const fw = Math.max(b.shoulderW, b.chestW) / 2 + 1.6 * u, fbody = rrect(-fw, top, fw * 2, h + 1.5 * u, [fw * 0.7, fw * 0.7, corner, corner]);
  const nw = b.neckW / 2 + 1.4, sw = 4.4 * u;

  // front: the padded straps (body colour) down the inner edge of the sleeves, a reflective strip on
  // each, the webbing under the arms and a chest clip in the accent colour
  const yb = -0.4 * T, xb = Math.max(nw + 0.7 * sw, sleeveInner(b, yb) + 0.15 * sw);
  const straps: Shape[] = [], webbing: Shape[] = [];
  for (const s of [1, -1] as const) {
    const p: Vec2[] = [[s * (nw + 0.3 * sw), -T - 1.2 * u], [s * (nw + 0.45 * sw), -T + 3 * u], [s * (xb - 0.1 * sw), -T + 0.32 * T], [s * xb, yb]];
    webbing.push(tube([[s * xb, yb - 1 * u], [s * (xb + 2.2 * u), yb + 4 * u], [s * (xb + 5 * u), -0.2 * T]], 1.6 * u, tone(c, "deep")));
    straps.push(tube(p, sw, tone(c, "shade")),
      line(p.slice(0, 3).map(([x, y]) => [x - sw * 0.3, y] as Vec2), tone(c, "light"), 0.45 * u, 0.5),
      // the reflective strip: flat, across the lower half of the strap
      flat(rrect(s * (xb - 0.05 * sw) - sw * 0.34, -T + 0.2 * T, sw * 0.68, 2.4 * u, 0.4 * u), strip, 0.9),
      { path: rrect(s * xb - sw * 0.62, yb - 1.4 * u, sw * 1.24, 1.6 * u, 0.5 * u), fill: dark });
  }
  const sy = -T + 10 * u, sx = nw + 0.4 * sw;
  straps.push(tube([[-sx, sy], [sx, sy]], 1.3 * u, c2), { path: rrect(-1.9 * u, sy - 1.2 * u, 3.8 * u, 2.4 * u, 0.9 * u), fill: dark },
    flat(rrect(-1.2 * u, sy - 0.6 * u, 2.4 * u, 1.2 * u, 0.5 * u), tone(dark, "light"), 0.7));
  const loopH = Math.min(1.8 * u, b.neckL * 0.35), loop = tube([[-2.4 * u, top + 2 * u], [-1.6 * u, top - loopH], [1.6 * u, top - loopH], [2.4 * u, top + 2 * u]], 1.3 * u, c2);
  // the big pocket bulges past the body's lower sides
  const pw = bw + 1.4 * u, ph = 0.46 * h, pTop = bot - ph - 1.2 * u, pocket = rrect(-pw, pTop, pw * 2, ph, [4 * u, 4 * u, corner, corner]);
  const front: Group = { shapes: [
    { path: rrect(-fw - 1.2 * u, pTop, (fw + 1.2 * u) * 2, ph + 1.2 * u, [4 * u, 4 * u, corner, corner]), fill: tone(c, "deep") },
    { path: fbody, fill: tone(c, "shade") },
    line([[-fw * 0.72, top + 2.6 * u], [-fw * 0.32, top + 1.1 * u], [fw * 0.32, top + 1.1 * u], [fw * 0.72, top + 2.6 * u]], tone(c, "light"), 0.8 * u, 0.5),
    loop,
  ] };

  // back: the body, its dome lit, a flap with a buckle, the big pocket with a zip, a bottle pocket
  const fh = 0.36 * h, flap = smooth([[-bw, top + dome * 0.9, 0], [-bw * 0.6, top + 0.5 * u], [0, top - 0.2 * u], [bw * 0.6, top + 0.5 * u], [bw, top + dome * 0.9, 0], [bw, top + fh], [bw * 0.5, top + fh + 2.4 * u], [0, top + fh + 3 * u], [-bw * 0.5, top + fh + 2.4 * u], [-bw, top + fh]]);
  const by = top + fh + 2.2 * u, bottleW = 0.28 * bw + 2 * u, bottleX = -bw + 0.25 * bottleW, bottleTop = pTop - 0.08 * h;
  const bottle = rrect(bottleX - bottleW * 0.55, bottleTop, bottleW, bot - bottleTop - 1.5 * u, [1.4 * u, 1.4 * u, 3 * u, 3 * u]);
  const back: Group = { shapes: [
    loop,
    ...([1, -1] as const).map(s => tube([[s * bw * 0.42, top + 6 * u], [s * (b.shoulderW / 2 - 4 * u), -T - 0.6 * u], [s * (b.shoulderW / 2 - 2.2 * u), -T + 1.6 * u]], sw, tone(c, "shade"))),
    // the bottle pocket at the wearer's right, a cap showing above its elastic hem
    { path: rrect(bottleX - bottleW * 0.32, bottleTop - 3.4 * u, bottleW * 0.64, 4 * u, 1 * u), fill: tone(c2, "deep") },
    { path: body, fill: c },
    tint(rect(bw - 3.8 * u, top, 4.2 * u, h), tone(c, "shade"), 0.55, body),
    { path: bottle, fill: tone(c, "deep") },
    flat(rrect(bottleX - bottleW * 0.55, bottleTop + 0.4 * u, bottleW, 1.3 * u, 0.6 * u), c2, 0.85),
    { path: pocket, fill: c },
    tint(rect(pw - 3 * u, pTop, 3.4 * u, ph), tone(c, "shade"), 0.5, pocket),
    // the pocket's zip runs round its top in the accent colour, its puller hanging at one side
    { ...line([[-pw + 2 * u, pTop + 3.6 * u], [-pw + 3.2 * u, pTop + 1.6 * u], [pw - 3.2 * u, pTop + 1.6 * u], [pw - 2 * u, pTop + 3.6 * u]], c2, 0.8 * u, 0.9), clip: pocket },
    flat(rrect(pw * 0.5, pTop + 1.4 * u, 1 * u, 3.4 * u, 0.5 * u), c2),
    line([[-pw + 2 * u, bot - 3 * u], [pw - 2 * u, bot - 3 * u]], tone(c, "deep"), 0.4 * u, 0.5),
    // the flap over the dome, lit along its top, its strap and buckle
    { path: flap, fill: c2 },
    tint(rect(bw - 3.4 * u, top - u, 4 * u, fh + 4 * u), tone(c2, "shade"), 0.5, flap),
    line([[-bw + 2.4 * u, top + dome * 0.8], [-bw * 0.55, top + 2.2 * u], [0, top + 1.6 * u]], tone(c2, "light"), 0.9 * u, 0.5),
    { path: rrect(-1.3 * u, by - 0.5 * u, 2.6 * u, 0.3 * h, 0.6 * u), fill: tone(c2, "deep") },
    { path: rrect(-2.4 * u, by, 4.8 * u, 3.2 * u, 0.9 * u), fill: dark },
    flat(rrect(-1.5 * u, by + 0.8 * u, 3 * u, 1.6 * u, 0.5 * u), tone(dark, "light"), 0.7),
    // reflective strips low on the pocket's sides
    ...([1, -1] as const).map(s => flat(rrect(s * 0.5 * pw - 1.1 * u, pTop + 0.42 * ph, 2.2 * u, 0.36 * ph, 0.6 * u), strip, 0.85)),
    ...([1, -1] as const).map(s => tube([[s * (bw - 3.4 * u), bot - 3 * u], [s * (bw - 0.6 * u), bot - 8 * u], [s * (bw + 1.2 * u), -0.3 * T]], 1.6 * u, tone(c, "deep"))),
  ] };
  return {
    front: [{ layer: "body_back", bone: "spine", group: front }, { layer: "chest_over", bone: "spine", group: { shapes: webbing } }, { layer: "over_sleeve", bone: "spine", group: { shapes: straps } }],
    back: [{ layer: "body_back", bone: "spine", group: back }],
  };
}

/**
 * A bağlama in its soft case, slung on the back: a pear-shaped bowl low on the back and a long slim
 * neck rising past the wearer's right shoulder (-x) to above the head, one strap across the chest
 * from the left shoulder. The case is about 0.68 of the wearer's height (a long-neck bağlama is about
 * 115 cm), so a child's is a child's. From the front only the neck (beside and above the head) and
 * the strap show; from behind, the whole case with its zip, handle and pocket.
 */
function baglamaCase(ctx: PartCtx): PartOut {
  const b = ctx.body, c = ctx.colors[0] ?? "#6B4A35", c2 = ctx.colors[1] ?? "#4B3428", T = b.torsoL, u = T / 43;
  const L = 0.68 * b.H, k = L / 117, bowlW = 32 * k, bowlH = 40 * k, neckW = 7 * k, a = 0.42;
  // the case's own frame: the bowl's bottom at the origin, its axis up (-y), then turned by `a` (top
  // towards -x) and set with the bowl low on the back towards the wearer's left
  const at: Vec2 = [0.16 * b.hipW, 0.16 * T], m = mul(translate(at[0], at[1]), rotate(-a));
  const hw = bowlW / 2, nTop = -L, nJoin = -bowlH * 0.98;
  const outline = smooth([
    [0, 0.6 * k], [hw * 0.75, -0.4 * k], [hw, -bowlH * 0.32], [hw * 0.82, -bowlH * 0.66], [neckW * 0.62, nJoin, 0],
    [neckW / 2, nJoin - 6 * k, 0], [neckW / 2, nTop + 14 * k, 0], [neckW * 0.62, nTop + 6 * k], [neckW * 0.42, nTop + 0.6 * k], [0, nTop],
    [-neckW * 0.42, nTop + 0.6 * k], [-neckW * 0.62, nTop + 6 * k], [-neckW / 2, nTop + 14 * k, 0], [-neckW / 2, nJoin - 6 * k, 0], [-neckW * 0.62, nJoin, 0], [-hw * 0.82, -bowlH * 0.66], [-hw, -bowlH * 0.32], [-hw * 0.75, -0.4 * k],
  ]).transform(m);
  const P = (pts: Vec2[]): Vec2[] => pts.map(([x, y]) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as Vec2);
  // the head end, a little wider for the pegbox, in the trim colour
  const cap = smooth(P([[-neckW * 0.5, nTop + 12 * k], [-neckW * 0.62, nTop + 6 * k], [-neckW * 0.42, nTop + 0.6 * k], [0, nTop], [neckW * 0.42, nTop + 0.6 * k], [neckW * 0.62, nTop + 6 * k], [neckW * 0.5, nTop + 12 * k]]), true, 1);
  const zip = (dx: number, from = -1.6 * k) => P([[dx, from], [dx, -bowlH * 0.7], [dx, nJoin - 4 * k], [dx, nTop + 12.5 * k]]);
  const lit = P([[-hw * 0.72, -bowlH * 0.18], [-hw * 0.8, -bowlH * 0.4], [-hw * 0.6, -bowlH * 0.66]]);
  const neckLit = P([[-neckW * 0.25, nJoin - 6 * k], [-neckW * 0.25, nTop + 13 * k]]);
  const shade = tint(smooth(P([[hw * 0.25, 1], [hw * 1.4, 1], [hw * 1.4, -bowlH * 0.9], [neckW * 0.2, nTop - 1], [neckW, nTop - 1], [neckW * 0.2, -bowlH], [hw * 0.25, -bowlH * 0.5]]).map(([x, y]) => [x, y, 0] as Pt), true, 1), tone(c, "shade"), 0.5, outline);
  // the short top handle on the bowl's shoulder, along the case
  const handle = [
    tube(P([[hw * 0.42, -bowlH * 0.5], [hw * 0.56, -bowlH * 0.58], [hw * 0.56, -bowlH * 0.72], [hw * 0.4, -bowlH * 0.8]]), 1.8 * k, c2),
    ...[0.5, 0.8].map(t => ({ path: rrect(-1.6 * k, -0.9 * k, 3.2 * k, 1.8 * k, 0.5 * k).transform(mul(m, translate(hw * 0.41, -bowlH * t))), fill: tone(c2, "deep") })),
  ];
  const sw = 4 * k, sh = onShoulder(b, 1);

  // front: the case behind the body; the strap from the left shoulder across the chest to the right hip
  const strap = tube([[sh[0] + 0.4 * u, -T - 1 * u], [sh[0] - 3 * u, -T + 4 * u], [-0.2 * b.waistW, -0.35 * T], [-0.5 * b.waistW - 1.2 * u, -0.06 * T]], sw, c2);
  const front: Group = { shapes: [
    { path: outline, fill: tone(c, "shade") },
    { path: cap, fill: c2 },
    line(neckLit, tone(c, "light"), 0.9 * k, 0.4),
    line(zip(neckW * 0.12), tone(c, "deep"), 0.5 * k, 0.6),
  ] };
  const strapShapes: Shape[] = [strap, line([[sh[0] - 0.8 * u, -T + 0.2 * u], [sh[0] - 3.6 * u, -T + 4.6 * u], [-0.2 * b.waistW - 1 * u, -0.36 * T]], tone(c2, "light"), 0.5 * u, 0.45)];

  // back: the whole case over the back, the strap's ends under it at the shoulder and the hip
  const pocket = rrect(-hw * 0.52, -bowlH * 0.44, hw * 1.04, bowlH * 0.28, [2 * k, 2 * k, 5 * k, 5 * k]).transform(m);
  const back: Group = { shapes: [
    tube([[sh[0], -T - 1 * u], [sh[0] - 2 * u, -T + 6 * u]], sw, tone(c2, "shade")),
    tube([[-0.5 * b.waistW - 1.2 * u, -0.06 * T], [-0.32 * b.waistW, -0.12 * T]], sw, tone(c2, "shade")),
    { path: outline, fill: c },
    shade,
    line(lit, tone(c, "light"), 1.2 * k, 0.45),
    line(neckLit, tone(c, "light"), 0.9 * k, 0.45),
    { path: cap, fill: c2 },
    { path: pocket, fill: tone(c, "shade") },
    line(P([[-hw * 0.44, -bowlH * 0.4], [hw * 0.44, -bowlH * 0.4]]), c2, 0.6 * k, 0.9),
    // the zip down the middle, double so it reads, and its puller
    line(zip(-0.2 * k, -bowlH * 0.46), tone(c, "deep"), 0.6 * k, 0.7),
    line(zip(0.35 * k, -bowlH * 0.46), c2, 0.35 * k, 0.8),
    { path: rrect(-0.7 * k, 0, 1.4 * k, 3.4 * k, 0.6 * k).transform(mul(m, translate(0.1 * k, -bowlH * 0.95))), fill: c2 },
    ...handle,
  ] };
  return {
    front: [{ layer: "body_back", bone: "spine", group: front }, { layer: "chest_over", bone: "spine", group: { shapes: strapShapes } }],
    back: [{ layer: "body_back", bone: "spine", group: back }],
  };
}

// ---- held: on the hand bone ---------------------------------------------------------------------------

/**
 * A phone's face, `w` × `L` cm from its top-left corner (`x0`, `y0`): the case, the lit screen, its
 * status bar at the top (at +y when it hangs `down`), the glare, and two message bubbles between `msgs`
 * (y from, y to) when given. Shared by the held part and the `phone` prop, so the two match.
 */
export function phoneFace(kit: Kit, c: string, x0: number, y0: number, w: number, L: number, down: boolean, msgs?: [number, number]): Shape[] {
  const r = w * 0.2, bz = w * 0.08, end = y0 + L, sh = L * 0.12, r7 = r * 0.7;
  const screen = mix(kit.color("fab_01"), kit.color("fab_05"), 0.3), blue = kit.color("fab_05");
  const bubbles: Shape[] = [];
  if (msgs) {
    const [f, t] = msgs, gap = (t - f) / 5;
    bubbles.push(flat(rrect(x0 + bz + w * 0.08, f + gap * 0.6, w * 0.5, gap * 1.6, gap * 0.6), kit.color("fab_01")), flat(rrect(x0 + w * 0.36, f + gap * 2.8, w * 0.52, gap * 1.6, gap * 0.6), blue));
  }
  return [
    { path: rrect(x0, y0, w, L, r), fill: c },
    { path: rrect(x0 + bz, y0 + bz, w - 2 * bz, L - 2 * bz, r7), fill: screen },
    flat(down ? rrect(x0 + bz, end - bz - sh, w - 2 * bz, sh, [0, 0, r7, r7]) : rrect(x0 + bz, y0 + bz, w - 2 * bz, sh, [r7, r7, 0, 0]), mix(screen, blue, 0.75)),
    ...bubbles,
    flat(smooth([[x0 + bz, y0 + L * 0.5], [x0 + w * 0.42, y0 + L * 0.3], [x0 + w * 0.6, y0 + L * 0.34], [x0 + bz, y0 + L * 0.72]]), tone(screen, "light"), 0.55),
  ];
}

/** A phone held by its bottom, hanging from the closed hand: the lit screen in front, the case and its cameras behind. */
function phone(ctx: PartCtx): PartOut {
  const b = ctx.body, hand = holdHand(ctx.side), out = hand === "l" ? 1 : -1, c = ctx.colors[0] ?? "#26272C";
  const [, gy] = gripAt(b), L = b.handL * 1.25, w = L * 0.5, y0 = gy - L * 0.15, x0 = -w / 2, bz = w * 0.08, end = y0 + L, shell = rrect(x0, y0, w, L, w * 0.2);
  // it hangs top down: the bubbles run from the knuckles to the status bar at the far end
  const front = phoneFace(ctx.kit, c, x0, y0, w, L, true, [fistOf(b).bottom, end - bz - L * 0.12]);
  const block = luma(c) > 0.5 ? tone(c, "shade") : tone(c, "light"), cw = w * 0.36, cx = out > 0 ? x0 + w - bz * 1.4 - cw : x0 + bz * 1.4, cy = end - bz * 1.4 - cw;
  const back: Shape[] = [
    { path: shell, fill: c },
    tint(rect(x0 + w - w * 0.22, y0, w * 0.3, L), tone(c, "shade"), 0.5, shell),
    flat(rrect(x0 + w * 0.14, y0 + L * 0.3, w * 0.1, L * 0.4, w * 0.05), tone(c, "light"), 0.35),
    { path: rrect(cx, cy, cw, cw, cw * 0.32), fill: block },
    { path: ellipse(cx + cw * 0.3, cy + cw * 0.3, cw * 0.19), fill: mix(block, "#000000", 0.6) },
    { path: ellipse(cx + cw * 0.7, cy + cw * 0.7, cw * 0.19), fill: mix(block, "#000000", 0.6) },
  ];
  // tilted a little, its lower end out from the body
  const a = -out * 0.1, at: Vec2 = [0, gy];
  return heldOut(hand, [{ shapes: turned(front, a, at) }], [{ shapes: turned(back, a, at) }]);
}

/** A hardcover notebook held at the side, hanging from the closed hand: the cover with a label, coloured tabs and a ribbon; a toddler's is a square picture book. */
function book(ctx: PartCtx): PartOut {
  const b = ctx.body, hand = holdHand(ctx.side), out = hand === "l" ? 1 : -1, c = ctx.colors[0] ?? "#B3261E", c2 = ctx.colors[1] ?? tone(c, "light"), kit = ctx.kit;
  const picture = b.handL < 7, h = b.handL * (picture ? 1.5 : 1.6), w = h * (picture ? 0.95 : 0.72), k = h / 20;
  const y0 = b.handL * 0.12, x0 = -w / 2 + out * w * 0.08, cover = rrect(x0, y0, w, h, 0.6 * k), paper = kit.color("fab_02");
  const pages = { path: rrect(x0 + 0.5 * k, y0 + 0.4 * k, w, h - 0.1 * k, 0.4 * k), fill: paper };
  const tabs: Shape[] = picture ? [] : [0, 1, 2].flatMap(i => {
    // each tab stands well clear of the page block, in colour 2, its lower half a little shaded
    const ty = y0 + h * (0.44 + i * 0.15), tab = rrect(x0 + w - 0.5 * k, ty, 2.8 * k, 1.7 * k, 0.5 * k);
    return [{ path: tab, fill: c2 }, tint(rect(x0 + w, ty + 0.9 * k, 3 * k, 1 * k), tone(c2, "shade"), 0.5, tab)];
  });
  const ribbon: Shape[] = picture ? [] : [S([[x0 + 0.3 * w - 0.4 * k, y0 + h - 1, 0], [x0 + 0.3 * w + 0.4 * k, y0 + h - 1, 0], [x0 + 0.31 * w + 0.45 * k, y0 + h + 2.6 * k, 0], [x0 + 0.31 * w, y0 + h + 2 * k, 0], [x0 + 0.31 * w - 0.4 * k, y0 + h + 2.6 * k, 0]], c2)];
  const base = (view: "front" | "back"): Shape[] => [
    ...ribbon, ...tabs, pages,
    line([[x0 + w + 0.2 * k, y0 + h * 0.3], [x0 + w + 0.2 * k, y0 + h - 0.6 * k]], tone(paper, "shade"), 0.25 * k, 0.6),
    { path: cover, fill: c },
    tint(rect(x0 + w - 1.8 * k, y0, 2 * k, h), tone(c, "shade"), 0.5, cover),
    flat(rrect(x0 + 0.24 * w, y0 + h * 0.3, 0.08 * w, h * 0.62, 0.04 * w), tone(c, "light"), view === "front" ? 0.3 : 0.2),
    // the spine (a quarter binding) on the wearer's right of the cover, front and back
    { path: rrect(x0, y0, 0.17 * w, h, [0.6 * k, 0, 0, 0.6 * k]), fill: tone(c, "deep") },
  ];
  const label: Shape[] = picture
    ? [{ path: ellipse(x0 + 0.58 * w, y0 + h * 0.58, 0.2 * w, 0.2 * w), fill: c2 }, flat(rrect(x0 + 0.24 * w, y0 + h * 0.82, 0.68 * w, h * 0.08, h * 0.04), tone(c, "light"), 0.7)]
    : [{ path: rrect(x0 + 0.3 * w, y0 + h * 0.5, 0.56 * w, h * 0.16, 0.3 * k), fill: mix(kit.color("fab_01"), c, 0.08) }, line([[x0 + 0.36 * w, y0 + h * 0.6], [x0 + 0.78 * w, y0 + h * 0.6]], tone(c, "light"), 0.3 * k, 0.5)];
  return heldOut(hand, [{ shapes: [...base("front"), ...label] }], [{ shapes: base("back") }]);
}

/** A furled umbrella hanging from its crook: the hook round the hand, the canopy tapering to its tip a hand's breadth above the floor. */
function umbrella(ctx: PartCtx): PartOut {
  const b = ctx.body, hand = holdHand(ctx.side), out = hand === "l" ? 1 : -1, c = ctx.colors[0] ?? "#2E3A59", c2 = ctx.colors[1] ?? "#6B4A35", metal = ctx.kit.color("met_silver");
  const [, gy] = gripAt(b), L = b.handL, f = fistOf(b), tw = L * 0.11, tip = gy + (-restGrip(b, hand)[1] - 8 * b.H / 172);
  // the crook: up from the shaft (inside the hand), over and down outside its outer edge
  const xs = -out * 0.3 * f.half, rc = 0.72 * f.half, xc = xs + out * rc, cy = gy - 0.12 * L, xh = xs + out * 2 * rc, yHB = f.bottom + 0.2 * L;
  const arc = arcPoints(xc, cy, rc, rc, out > 0 ? Math.PI : 0, out > 0 ? 2 * Math.PI : -Math.PI, 10).slice(1, -1);
  const crook: Vec2[] = [[xs, yHB], [xs, cy], ...arc, [xh, cy], [xh, gy + 0.3 * L], [xh - out * 0.3 * rc, gy + 0.4 * L]];
  const cw = L * 0.24, c0 = yHB + 0.18 * L, ce = tip - Math.max(1.2, 0.08 * (tip - c0)), Lc = ce - c0;
  const canopy = smooth([[xs - 0.7 * cw, c0 + 0.5], [xs - 0.36 * cw, c0 - 0.35, 0], [xs, c0 + 0.25], [xs + 0.36 * cw, c0 - 0.35, 0], [xs + 0.7 * cw, c0 + 0.5], [xs + cw, c0 + 0.22 * Lc], [xs + 0.55 * cw, c0 + 0.66 * Lc], [xs + 0.1 * cw, ce, 0], [xs - 0.1 * cw, ce, 0], [xs - 0.52 * cw, c0 + 0.64 * Lc], [xs - 0.98 * cw, c0 + 0.2 * Lc]]);
  const ys = c0 + 0.3 * Lc;
  const draw = (view: "front" | "back"): Shape[] => [
    // the bare shaft between the handle and the canopy, and the ferrule at the tip
    tube([[xs, yHB - 0.5], [xs, c0 + 1]], tw * 0.42, metal),
    S([[xs - 0.13 * cw, ce - 0.4], [xs + 0.13 * cw, ce - 0.4], [xs + 0.04 * cw, tip, 0], [xs - 0.04 * cw, tip, 0]], metal),
    { path: canopy, fill: c },
    tint(smooth([[xs + 0.35 * cw, c0, 0], [xs + 1.2 * cw, c0, 0], [xs + 0.4 * cw, ce + 1, 0], [xs + 0.05 * cw, ce + 1, 0]]), tone(c, "shade"), 0.55, canopy),
    ...(view === "front"
      ? [line([[xs - 0.3 * cw, c0 + 0.1 * Lc], [xs - 0.12 * cw, c0 + 0.5 * Lc], [xs - 0.02 * cw, ce - 0.6]], tone(c, "deep"), Math.max(0.25, 0.06 * cw), 0.55),
        line([[xs + 0.42 * cw, c0 + 0.12 * Lc], [xs + 0.24 * cw, c0 + 0.55 * Lc], [xs + 0.06 * cw, ce - 1]], tone(c, "deep"), Math.max(0.25, 0.06 * cw), 0.45),
        line([[xs - 0.62 * cw, c0 + 0.16 * Lc], [xs - 0.4 * cw, c0 + 0.5 * Lc]], tone(c, "light"), Math.max(0.3, 0.12 * cw), 0.45)]
      : [line([[xs + 0.1 * cw, c0 + 0.08 * Lc], [xs + 0.02 * cw, c0 + 0.5 * Lc], [xs - 0.02 * cw, ce - 0.6]], tone(c, "deep"), Math.max(0.25, 0.06 * cw), 0.5),
        line([[xs - 0.55 * cw, c0 + 0.18 * Lc], [xs - 0.3 * cw, c0 + 0.55 * Lc]], tone(c, "light"), Math.max(0.3, 0.12 * cw), 0.4)]),
    // the strap round its widest part, with its snap in front
    tube([[xs - 1.02 * cw, ys + 0.35 * cw], [xs, ys], [xs + 1.02 * cw, ys - 0.35 * cw]], Math.max(0.6, 0.5 * cw), tone(c, "shade")),
    ...(view === "front" ? [{ path: ellipse(xs + 0.35 * cw, ys - 0.12 * cw, 0.16 * cw), fill: tone(c, "light") }] : []),
    // the handle: the crook, a light along it, and its collar on the shaft
    tube(crook, tw, c2),
    { path: ellipse(crook[crook.length - 1][0], crook[crook.length - 1][1], tw * 0.5), fill: c2 },
    line([[xs - out * tw * 0.25, yHB - 0.3], [xs - out * tw * 0.25, f.bottom - 0.2]], tone(c2, "light"), tw * 0.22, 0.5),
    { path: rrect(xs - tw * 0.6, yHB - 0.4, tw * 1.2, Math.max(0.5, 0.06 * L), tw * 0.2), fill: tone(c2, "deep") },
  ];
  return heldOut(hand, [{ shapes: draw("front") }], [{ shapes: draw("back") }]);
}

// ---- held: standing on the floor ------------------------------------------------------------------------

/** The grip in root space, the side it is on (+1 the wearer's left), how high it is and the closed hand's half width. */
function onFloor(ctx: PartCtx) {
  const b = ctx.body, hand = holdHand(ctx.side), g = restGrip(b, hand);
  return { b, hand, g, sx: (g[0] >= 0 ? 1 : -1) as 1 | -1, gh: -g[1], f: fistOf(b) };
}

/** A hard-shell rolling case standing beside the wearer, its telescopic handle pulled up to the hand. */
function suitcase(ctx: PartCtx): PartOut {
  const { b, hand, g, sx, gh } = onFloor(ctx), L = b.handL, c = ctx.colors[0] ?? "#6F8FAF", c2 = ctx.colors[1] ?? "#26272C", metal = ctx.kit.color("met_silver");
  // the case stands out beside the hip (hipW/2 + 16 cm, k-scaled) and a little behind the wearer, so
  // in front the near leg and the shoe cover its inner edge; its handle leans in to the hand
  const k = b.H / 172, wh = 0.07 * gh, ch = gh * 0.84 - 0.17 * L - wh, cw = ch * 0.66, cx = sx * Math.max(Math.abs(g[0]) + 0.1 * cw, b.hipW / 2 + 16 * k), top = -wh - ch, x0 = cx - cw / 2, r = cw * 0.12;
  const shell = rrect(x0, top, cw, ch, r), barH = Math.max(1.1, L * 0.15), rw = Math.max(0.6, cw * 0.042), gu = cw * 0.17;
  // two rods from the case's top to the bar in the hand: the wide lower stage, then the narrow upper one
  const hx = g[0], hw = 0.27 * cw;
  const rods: Shape[] = [-1, 1].flatMap(d => {
    const a: Vec2 = [cx + d * hw, top + 1], e: Vec2 = [hx + d * hw * 0.9, g[1]], m: Vec2 = [(a[0] + e[0]) / 2, (a[1] + e[1]) / 2];
    return [tube([a, m], rw * 1.35, tone(metal, "shade")), tube([[m[0] + (e[0] - a[0]) * 0.02, m[1] + (e[1] - a[1]) * 0.02], e], rw, metal)];
  });
  const bar: Shape = { path: rrect(hx - 0.34 * cw, g[1] - barH / 2, 0.68 * cw, barH, barH / 2), fill: c2 };
  const guards: Shape[] = [
    { path: rrect(x0 - 0.2, top - 0.2, gu, gu, [r, 0.5, 0.5, 0.5]), fill: c2 }, { path: rrect(x0 + cw - gu + 0.2, top - 0.2, gu, gu, [0.5, r, 0.5, 0.5]), fill: c2 },
    { path: rrect(x0 + cw - gu + 0.2, -wh - gu + 0.2, gu, gu, [0.5, 0.5, r, 0.5]), fill: c2 }, { path: rrect(x0 - 0.2, -wh - gu + 0.2, gu, gu, [0.5, 0.5, 0.5, r]), fill: c2 },
  ];
  const shading: Shape[] = [
    tint(rect(x0 + cw - 0.16 * cw, top, 0.2 * cw, ch), tone(c, "shade"), 0.5, shell),
    line([[x0 + 0.1 * cw, top + 0.9], [x0 + 0.55 * cw, top + 0.9]], tone(c, "light"), Math.max(0.4, cw * 0.025), 0.6),
  ];
  // front: four small spinner wheels, two ribs across, a carry handle on top
  const spinners: Shape[] = [x0 + 0.17 * cw, x0 + 0.83 * cw].flatMap(x => [
    { path: rrect(x - 0.09 * cw, -wh - 0.6, 0.18 * cw, wh * 0.55, 0.3), fill: tone(c2, "light") },
    { path: ellipse(x - 0.05 * cw, -wh * 0.42, wh * 0.42), fill: c2 }, { path: ellipse(x + 0.05 * cw, -wh * 0.42, wh * 0.42), fill: c2 },
  ]);
  const front: Shape[] = [
    ...rods, ...spinners,
    tube([[cx - 0.13 * cw, top + 0.8], [cx - 0.1 * cw, top - 0.04 * ch], [cx + 0.1 * cw, top - 0.04 * ch], [cx + 0.13 * cw, top + 0.8]], Math.max(0.7, cw * 0.04), c2),
    { path: shell, fill: c }, ...shading,
    ...[0.36, 0.64].flatMap(k => [line([[x0 + 0.6, top + ch * k - 0.5], [x0 + cw - 0.6, top + ch * k - 0.5]], tone(c, "light"), Math.max(0.3, cw * 0.02), 0.55), line([[x0 + 0.6, top + ch * k], [x0 + cw - 0.6, top + ch * k]], tone(c, "shade"), Math.max(0.35, cw * 0.025), 0.75)]),
    ...guards, bar,
  ];
  // back: the trolley channel, ribs down the shell and two big wheels
  const wheels: Shape[] = [x0 + 0.16 * cw, x0 + 0.84 * cw].flatMap(x => [{ path: ellipse(x, -wh * 0.85, wh * 0.85), fill: c2 }, ring(x, -wh * 0.85, wh * 0.38, tone(c2, "light"))]);
  const back: Shape[] = [
    ...rods, ...wheels,
    { path: shell, fill: c }, ...shading,
    { path: rrect(cx - 0.33 * cw, top + 0.3, 0.66 * cw, 0.5 * ch, [0, 0, 0.05 * cw, 0.05 * cw]), fill: tone(c, "shade") },
    ...[-0.22, 0, 0.22].map(d => line([[cx + d * cw, top + 0.56 * ch], [cx + d * cw, -wh - 0.1 * ch]], tone(c, "shade"), Math.max(0.35, cw * 0.025), 0.7)),
    ...guards, bar,
  ];
  const out = heldOut(hand, [{ shapes: front }], [{ shapes: back }], { onRoot: true });
  // in front it stands behind the body (the hand still closes over the bar); from behind it is nearer than the body
  for (const it of out.front ?? []) it.layer = "body_back";
  return out;
}

/** A walking cane on the floor beside the foot, its crook in the hand: the hook shows outside the hand, the shaft below it. */
function walkingCane(ctx: PartCtx): PartOut {
  const { b, hand, g, sx, f } = onFloor(ctx), L = b.handL, k = b.H / 172, c = ctx.colors[0] ?? "#6B4A35", c2 = ctx.colors[1] ?? c, rubber = ctx.kit.color("fab_22");
  const tw = Math.max(1.8, 2.2 * k), xs = g[0] - sx * 0.3 * f.half, rc = 0.75 * f.half, xc = xs + sx * rc, cy = g[1] - 0.1 * L, xh = xs + sx * 2 * rc;
  const tipX = xs + sx * 2.6 * k, top = g[1] + 0.3 * L;
  const arc = arcPoints(xc, cy, rc, rc, sx > 0 ? Math.PI : 0, sx > 0 ? 2 * Math.PI : -Math.PI, 10).slice(1, -1);
  const crook: Vec2[] = [[xs, top], [xs, cy], ...arc, [xh, cy], [xh, g[1] + 0.32 * L], [xh - sx * 0.25 * rc, g[1] + 0.42 * L]];
  const draw = (view: "front" | "back"): Shape[] => [
    tube([[xs, top - 0.5], [tipX, -2.6 * k]], tw, c),
    line([[xs - tw * 0.22, top + 1], [tipX - tw * 0.22, -3.4 * k]], tone(c, "light"), tw * 0.22, view === "front" ? 0.5 : 0.35),
    S([[tipX - 1.1 * k, -3.2 * k], [tipX + 1.1 * k, -3.2 * k], [tipX + 1.15 * k, 0, 0], [tipX - 1.15 * k, 0, 0]], rubber),
    tube(crook, tw, c2),
    { path: ellipse(crook[crook.length - 1][0], crook[crook.length - 1][1], tw * 0.5), fill: c2 },
    line(arc.slice(2, 8).map(([x, y]) => [x, y - tw * 0.18] as Vec2), tone(c2, "light"), tw * 0.2, 0.45),
    { path: rrect(xs - tw * 0.62, top - 0.2, tw * 1.24, Math.max(0.6, 0.07 * L), tw * 0.2), fill: tone(c2, "deep") },
  ];
  return heldOut(hand, [{ shapes: draw("front") }], [{ shapes: draw("back") }], { onRoot: true });
}

/**
 * A long white cane from the hand at the hip out to the floor, tilted outward so it reads (a real
 * one points ahead): a dark grip, a red band near the floor and a rolling tip. Its elastic loop is
 * round the wrist, on the hand bone, so it goes where the hand goes.
 */
function whiteCane(ctx: PartCtx): PartOut {
  const { b, hand, g, sx, gh } = onFloor(ctx), L = b.handL, k = b.H / 172, c = ctx.kit.color("fab_01"), red = ctx.kit.color("fab_23"), grip = ctx.colors[0] ?? "#26272C";
  const tip: Vec2 = [g[0] + sx * Math.tan(0.31) * gh, 0], len = Math.hypot(g[0] - tip[0], g[1]), dx = (g[0] - tip[0]) / len, dy = g[1] / len;
  const at = (d: number): Vec2 => [tip[0] + dx * d, tip[1] + dy * d], tw = Math.max(1.8, 2.4 * k), ball = 1.3 * k, total = len + 0.3 * L;
  const draw = (view: "front" | "back"): Shape[] => [
    tube([at(ball), at(total)], tw, c),
    line([at(len * 0.36), at(len - 0.55 * L)], tone(c, "shade"), tw * 0.22, 0.45),
    tube([at(ball * 1.4), at(len * 0.33)], tw * 1.04, red),
    line([at(ball * 1.8), at(len * 0.31)], tone(red, "light"), tw * 0.22, view === "front" ? 0.6 : 0.45),
    tube([at(len - 0.5 * L), at(total)], tw * 1.4, grip),
    line([at(len - 0.46 * L), at(len - 0.2 * L)], tone(grip, "light"), tw * 0.2, 0.45),
    { path: ellipse(tip[0] + dx * ball, -ball, ball), fill: grip },
  ];
  const out = heldOut(hand, [{ shapes: draw("front") }], [{ shapes: draw("back") }], { onRoot: true });
  const rx = b.armW[2] * 0.56, wy = -0.2 * L, loop = (view: "front" | "back"): Shape[] => [
    tube(arcPoints(0, wy, rx, rx * 0.3, view === "front" ? 0.12 : Math.PI + 0.12, view === "front" ? Math.PI - 0.12 : 2 * Math.PI - 0.12, 8), 0.55 * k, grip),
  ];
  for (const view of ["front", "back"] as const) out[view]!.push({ layer: "over_sleeve", bone: `hand_${hand}`, group: { shapes: loop(view) }, hold: hand });
  return out;
}

/**
 * A market trolley (pazar arabası) beside the wearer, pulled by its handle: a check-fabric bag with
 * a lid and a front strap on a frame with two big wheels, tilted back 6 degrees so its top leans to
 * the hand. Its height comes from the measured grip (the bar in the hand, the wheels on the floor),
 * not from the real 55 cm bag: at puppet scale the hand hangs lower than a real trolley's handle.
 * `hold` is not a pattern slot yet, so the check is drawn into the art from the fabric colour (a
 * deep and a light tone of it); it becomes `printed` once the slot prints.
 */
function trolley(ctx: PartCtx): PartOut {
  const { b, hand, g, sx, gh } = onFloor(ctx), L = b.handL, c = ctx.colors[0] ?? "#8A7A6C", c2 = ctx.colors[1] ?? "#26272C", metal = ctx.kit.color("met_silver");
  // built upright with the bar's centre at the origin, then turned about it so the wheels stand out
  const a = 6 * Math.PI / 180, H = gh / Math.cos(a), r = 0.085 * H, bh = 0.6 * H, bw = bh * 32 / 55;
  const bot = H - 1.1 * r, btop = bot - bh, x0 = -bw / 2, tw = Math.max(0.7, 0.035 * bw), barH = Math.max(1.1, L * 0.15);
  const bag = rrect(x0, btop, bw, bh, [0.2 * bw, 0.2 * bw, 0.1 * bw, 0.1 * bw]);
  const lid = smooth([[x0 - 0.4, btop + 0.12 * bh, 0], [x0 + 0.05 * bw, btop - 0.01 * bh], [0, btop - 0.035 * bh], [-x0 - 0.05 * bw, btop - 0.01 * bh], [-x0 + 0.4, btop + 0.12 * bh, 0], [-x0 + 0.2, btop + 0.19 * bh], [0, btop + 0.21 * bh], [x0 - 0.2, btop + 0.19 * bh]]);
  // the check: broad deep bands each way (darker where they cross) and thin light lines between
  const n = 4, cell = bw / n, check: Shape[] = [];
  for (let i = 0; i <= n; i++) check.push(tint(rect(x0 + i * cell - cell * 0.22, btop - 1, cell * 0.44, bh + 2), tone(c, "deep"), 0.45, bag));
  for (let y = bot - cell * 0.5; y > btop - cell; y -= cell) check.push(tint(rect(x0 - 1, y - cell * 0.22, bw + 2, cell * 0.44), tone(c, "deep"), 0.45, bag));
  for (let i = 0; i < n; i++) check.push({ ...line([[x0 + (i + 0.5) * cell, btop], [x0 + (i + 0.5) * cell, bot]], tone(c, "light"), 0.06 * cell, 0.7), clip: bag });
  for (let y = bot; y > btop; y -= cell) check.push({ ...line([[x0, y], [x0 + bw, y]], tone(c, "light"), 0.06 * cell, 0.7), clip: bag });
  const shading: Shape[] = [
    tint(rect(-x0 - 0.18 * bw, btop - 2, 0.22 * bw, bh + 4), tone(c, "shade"), 0.55, bag),
    line([[x0 + 0.12 * bw, btop + 0.04 * bh], [x0 + 0.5 * bw, btop + 0.015 * bh]], tone(c, "light"), Math.max(0.4, 0.03 * bw), 0.55),
  ];
  // the frame: two tubes from the bar down behind the bag to the axle, the wheels at its corners and a toe plate
  const rails: Shape[] = [-1, 1].map(d => tube([[d * 0.32 * bw, 0], [d * 0.32 * bw, btop + 0.1 * bh], [d * 0.36 * bw, bot - 0.2 * r]], tw, metal));
  const bar: Shape = { path: rrect(-0.4 * bw, -barH / 2, 0.8 * bw, barH, barH / 2), fill: c2 };
  const wheel = (x: number): Shape[] => [
    { path: ellipse(x, H - r, r), fill: c2 },
    ring(x, H - r, r * 0.5, tone(c2, "light")),
    { path: ellipse(x, H - r, r * 0.16), fill: metal },
  ];
  const wheels = [...wheel(x0 + 0.1 * bw), ...wheel(-x0 - 0.1 * bw)];
  const axle = tube([[x0 + 0.1 * bw, H - r], [-x0 - 0.1 * bw, H - r]], tw * 0.9, tone(metal, "shade"));
  const toe = { path: rrect(x0 + 0.08 * bw, bot - 0.4, bw * 0.84, Math.max(0.8, 0.05 * bh), 0.3), fill: tone(c2, "light") };

  // front: the check bag, its lid and the front strap with a buckle; the frame behind it
  const strapX = 0, strap = rrect(strapX - 0.07 * bw, btop + 0.1 * bh, 0.14 * bw, 0.5 * bh, [0, 0, 0.07 * bw, 0.07 * bw]);
  const front: Shape[] = [
    ...rails, axle, ...wheels,
    { path: bag, fill: c }, ...check, ...shading,
    { path: lid, fill: tone(c, "shade") },
    tint(rect(x0 - 1, btop + 0.12 * bh, bw + 2, 0.1 * bh), tone(c, "deep"), 0.35, lid),
    { path: strap, fill: c2 },
    { path: rrect(strapX - 0.1 * bw, btop + 0.5 * bh, 0.2 * bw, 0.07 * bh, 0.02 * bw), fill: metal },
    flat(rrect(strapX - 0.06 * bw, btop + 0.515 * bh, 0.12 * bw, 0.04 * bh, 0.01 * bw), c2),
    toe, bar,
  ];
  // back: a plain panel with a zipped pocket; the frame is nearer than the bag from this side
  const pk = rrect(x0 + 0.16 * bw, btop + 0.36 * bh, 0.68 * bw, 0.36 * bh, 0.06 * bw);
  const back: Shape[] = [
    axle, ...wheels,
    { path: bag, fill: c }, ...shading,
    { path: lid, fill: tone(c, "shade") },
    { path: pk, fill: tone(c, "shade") },
    line([[x0 + 0.2 * bw, btop + 0.4 * bh], [-x0 - 0.2 * bw, btop + 0.4 * bh]], c2, Math.max(0.35, 0.02 * bw), 0.85),
    { path: rrect(-x0 - 0.3 * bw, btop + 0.39 * bh, Math.max(0.6, 0.04 * bw), 0.06 * bh, 0.3), fill: c2 },
    ...rails, toe, bar,
  ];
  // stood up: the bar's centre on the grip, the wheels swung out from the body onto the floor
  const m = mul(translate(g[0], g[1]), rotate(-sx * a));
  const place = (shapes: Shape[]): Shape[] => shapes.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip && !Array.isArray(s.clip) ? { clip: s.clip.transform(m) } : {}) }));
  return heldOut(hand, [{ shapes: place(front) }], [{ shapes: place(back) }], { onRoot: true });
}

export const CARRY: Record<string, PartDef> = {
  bag_backpack: named("carry", "Backpack", "sırt çantası", { colors: 2, defaults: ["fab_04", "fab_20"], tags: ["casual", "travel", "student", "work"], draw: backpack }),
  bag_tote: named("carry", "Tote bag", "bez çanta", {
    colors: 2, defaults: ["fab_02", "fab_20"], sides: { allowed: ["l", "r"], default: "l" }, tags: ["casual", "student", "market", "summer"],
    patterns: patternsFor("carry"), draw: tote,
  }),
  bag_shoulder: named("carry", "Shoulder bag", "omuz çantası", {
    colors: 2, defaults: ["fab_20"], sides: { allowed: ["l", "r"], default: "l" }, builds: ["adult", "elder", "child"], tags: ["casual", "work", "fashion"], draw: shoulderBag,
  }),
  bag_school: named("carry", "School bag", "okul çantası", { colors: 2, defaults: ["fab_35", "fab_11"], builds: ["adult", "elder", "child", "toddler"], tags: ["school", "student"], draw: schoolBag }),
  case_baglama: named("carry", "Bağlama case", "bağlama kılıfı", { colors: 2, defaults: ["fab_20", "fab_28"], builds: ["adult", "elder", "child"], tags: ["music", "traditional", "cultural"], draw: baglamaCase }),
  // the umbrella's canopy prints (pat_stripe_h, pat_dots) wait for the lead: `hold` is not a pattern slot yet
  umbrella_closed: held("Closed umbrella", "kapalı şemsiye", "l", { colors: 2, defaults: ["fab_04", "fab_20"], tags: ["rain", "autumn", "istanbul"], draw: umbrella }),
  phone_held: held("Phone in hand", "elinde telefon", "l", { colors: 1, defaults: ["fab_22"], builds: ["adult", "elder", "child"], tags: ["tech", "student"], draw: phone }),
  book_held: held("Book or notebook", "kitap / defter", "l", { colors: 2, defaults: ["fab_23", "fab_10"], tags: ["school", "student"], draw: book }),
  bag_suitcase: held("Rolling suitcase", "tekerlekli bavul", "l", { colors: 2, defaults: ["fab_35", "fab_22"], builds: ["adult", "elder", "child"], tags: ["travel", "istanbul"], odds: 0.5, draw: suitcase }),
  // its check (pat_check, pat_tartan, pat_stripe_h) is drawn in, as `hold` is not a pattern slot yet
  bag_trolley: held("Market trolley", "pazar arabası", "l", { colors: 2, defaults: ["fab_27", "fab_22"], builds: ["adult", "elder"], tags: ["market", "elder", "istanbul"], draw: trolley }),
  cane_walking: held("Walking cane", "baston", "r", {
    colors: 2, palettes: ["fabric", "fabmetal"], defaults: ["fab_20"], builds: ["adult", "elder"], tags: ["accessibility", "elder", "health"], odds: { adult: 0.4, elder: 2 }, draw: walkingCane,
  }),
  // white with a red band is a mobility signal, so only the grip takes a colour
  cane_white: held("White cane", "beyaz baston", "r", {
    colors: 1, defaults: ["fab_22"], builds: ["adult", "elder", "child"], tags: ["accessibility", "health", "istanbul"], avoid: ["sunglasses"], draw: whiteCane,
  }),
};
