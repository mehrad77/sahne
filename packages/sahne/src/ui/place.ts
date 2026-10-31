// Where the overlay's pieces go (DESIGN.md §6.8): bubble bodies around their anchors, kept
// inside the stage and apart from each other, and the tail from a body towards its anchor.
// Pure geometry in CSS pixels of the host (x right, y down), so it can be tested without a DOM.

export interface Rect { x: number; y: number; w: number; h: number }
export type Pt = [number, number];
/** Where a body sits relative to its anchor. "free" has no anchor (or is fixed in a corner). */
export type Side = "above" | "below" | "left" | "right" | "free";

export interface Room {
  /** Host size. */
  W: number; H: number;
  /** Margin kept free at every edge. */
  m: number;
  /** Gap between an anchor and the body (the visible tail). */
  T: number;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Move a rect inside the room's margins (top-left wins when it is larger than the room). */
export function inside(r: Rect, room: Room): Rect {
  const { W, H, m } = room;
  return { x: clamp(r.x, m, Math.max(m, W - m - r.w)), y: clamp(r.y, m, Math.max(m, H - m - r.h)), w: r.w, h: r.h };
}

export interface Placement { r: Rect; side: Side; gap: number }

/**
 * Where a body of w×h can go for an anchor, best first (never empty): above it, beside it (the
 * roomier side first), below it; always inside the margins. A side still fits when the tail
 * has to shrink to half of `T` (`gap` is what is left). `prefer` (the side used last frame)
 * comes first while it fits and "above" does not, so a bubble does not flip at a threshold.
 * Without an anchor, top centre.
 */
export function placements(a: Pt | null, w: number, h: number, room: Room, prefer?: Side): Placement[] {
  const { W, H, m, T } = room;
  if (!a) return [{ r: inside({ x: (W - w) / 2, y: m, w, h }, room), side: "free", gap: 0 }];
  const [ax, ay] = a, tmin = Math.max(6, T / 2);
  // the room each side leaves for the tail, once the body is in
  const space = { above: ay - h - m, below: H - m - h - ay, right: W - m - w - ax, left: ax - w - m };
  const at = (s: Exclude<Side, "free">, g: number): Rect =>
    s === "above" ? { x: ax - w / 2, y: ay - g - h, w, h } : s === "below" ? { x: ax - w / 2, y: ay + g, w, h }
      : s === "right" ? { x: ax + g, y: ay - h * 0.6, w, h } : { x: ax - g - w, y: ay - h * 0.6, w, h };
  const sides: Exclude<Side, "free">[] = W - ax >= ax ? ["above", "right", "left", "below"] : ["above", "left", "right", "below"];
  if (prefer && prefer !== "free" && prefer !== "above" && space[prefer] >= tmin && space.above < tmin) sides.unshift(prefer);
  const out: Placement[] = [];
  for (const s of new Set(sides)) if (space[s] >= tmin) { const g = Math.min(T, space[s]); out.push({ r: inside(at(s, g), room), side: s, gap: g }); }
  return out.length ? out : [{ r: inside(at("above", T), room), side: "above", gap: tmin }];
}

/** Total area where bodies overlap each other. */
export function crowding(bodies: Body[]) {
  let sum = 0;
  for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
    const a = bodies[i].r, b = bodies[j].r;
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 0 && oy > 0) sum += ox * oy;
  }
  return sum;
}

/** Bounds for a body's top-left corner (beyond the room's margins, which always apply). */
export interface Lim { x0: number; x1: number; y0: number; y1: number }

export interface Body {
  r: Rect;
  /** How readily it moves when it overlaps another: 0 never (a corner piece), larger moves more. */
  mob: number;
  /** Where its top-left may go when it is pushed (see `keepSide`). */
  lim?: Lim;
}

/**
 * Limits that keep a placed bubble on its side of the anchor with at least `gap` of tail
 * showing, so a push never slides it over the head it belongs to.
 */
export function keepSide(side: Side, a: Pt | null, w: number, h: number, gap: number): Lim | undefined {
  if (!a) return undefined;
  const I = Infinity;
  switch (side) {
    case "above": return { x0: -I, x1: I, y0: -I, y1: a[1] - gap - h };
    case "below": return { x0: -I, x1: I, y0: a[1] + gap, y1: I };
    case "left": return { x0: -I, x1: a[0] - gap - w, y0: -I, y1: I };
    case "right": return { x0: a[0] + gap, x1: I, y0: -I, y1: I };
    default: return undefined;
  }
}

/**
 * Push overlapping bodies apart (with `gap` between them) along the axis that needs the least
 * movement, sharing the push by mobility (what one cannot take, the other does), and keep them
 * inside the room and their limits. A few rounds settle the small crowds of a stage.
 */
export function separate(bodies: Body[], room: Room, gap = 6, rounds = 6) {
  type Axis = "x" | "y";
  const size = (ax: Axis) => (ax === "x" ? "w" : "h");
  /** Overlap of a and b along an axis, gap included (≤ 0: apart). */
  const over = (a: Rect, b: Rect, ax: Axis) => Math.min(a[ax] + a[size(ax)], b[ax] + b[size(ax)]) - Math.max(a[ax], b[ax]) + gap;
  /** Move a body along an axis as far as it may; returns the distance moved. */
  const move = (B: Body, ax: Axis, d: number) => {
    if (!B.mob || !d) return 0;
    const r = B.r, l = B.lim, v = r[ax] + d;
    const lo = l ? (ax === "x" ? l.x0 : l.y0) : -Infinity, hi = l ? (ax === "x" ? l.x1 : l.y1) : Infinity;
    const lim = hi < lo ? lo : clamp(v, lo, hi);
    B.r = inside({ ...r, [ax]: lim }, room);
    return B.r[ax] - r[ax];
  };
  const push = (A: Body, B: Body, ax: Axis) => {
    const d = over(A.r, B.r, ax), k = A.mob + B.mob;
    const s = Math.sign(A.r[ax] + A.r[size(ax)] / 2 - (B.r[ax] + B.r[size(ax)] / 2)) || -1;
    const ma = Math.abs(move(A, ax, s * d * A.mob / k));
    const mb = Math.abs(move(B, ax, -s * (d - ma)));
    if (d - ma - mb > 0.5) move(A, ax, s * (d - ma - mb));
  };
  for (let k = 0; k < rounds; k++) {
    let moved = false;
    for (let i = 0; i < bodies.length; i++) for (let j = i + 1; j < bodies.length; j++) {
      const A = bodies[i], B = bodies[j];
      if (!A.mob && !B.mob) continue;
      const ox = over(A.r, B.r, "x"), oy = over(A.r, B.r, "y");
      if (ox <= 0 || oy <= 0) continue;
      // the cheaper axis first; if the walls swallow that push, the other axis too
      const first: Axis = ox < oy ? "x" : "y", other: Axis = first === "x" ? "y" : "x";
      push(A, B, first);
      if (over(A.r, B.r, first) > 1 && over(A.r, B.r, other) > 0) push(A, B, other);
      moved = true;
    }
    if (!moved) break;
  }
}

export interface TailOpts {
  /** Corner radius of the body: the tail leaves from the straight part of an edge. */
  radius: number;
  /** Width of the tail where it meets the body. */
  base: number;
  /** How far inside the body the base sits (hidden under it). */
  inset: number;
  /** Visible length beyond the body edge: at least `min`, at most `max`. */
  min: number; max: number;
}

export interface Tail {
  /** Base centre, in host pixels. */
  x: number; y: number;
  /** Rotation from "pointing straight down", in radians (CSS rotate, clockwise). */
  angle: number;
  /** Length from the base centre to the tip. */
  len: number;
}

/** A head on screen: its centre and half-sizes in pixels. */
export interface HeadOval { c: Pt; rx: number; ry: number }

/**
 * A speech tail that points at the speaker's mouth and stops just outside the head (`gap` short
 * of its outline), as comics draw it: it shows who speaks from any side without covering the face.
 */
export function tailAim(r: Rect, mouth: Pt, head: HeadOval, o: TailOpts & { gap: number }): Tail | null {
  const t = tailTo(r, mouth, o);
  if (!t) return null;
  const dx = mouth[0] - t.x, dy = mouth[1] - t.y, L = Math.hypot(dx, dy) || 1;
  // where the line from the base to the mouth enters the head's oval
  const px = (t.x - head.c[0]) / head.rx, py = (t.y - head.c[1]) / head.ry, vx = dx / L / head.rx, vy = dy / L / head.ry;
  const A = vx * vx + vy * vy, B = 2 * (px * vx + py * vy), C = px * px + py * py - 1, D = B * B - 4 * A * C;
  let s = L;
  if (C > 0 && D >= 0) { const s0 = (-B - Math.sqrt(D)) / (2 * A); if (s0 > 0) s = Math.min(L, s0); }
  return { x: t.x, y: t.y, angle: Math.atan2(dy, dx) - Math.PI / 2, len: clamp(s - o.gap, o.inset + o.min, o.inset + o.max) };
}

/**
 * The tail of a body towards a point: it leaves the edge that faces the point, from the spot
 * on that edge nearest to it, and points at it even when the body was pushed away. null when
 * the point is inside the body.
 */
export function tailTo(r: Rect, a: Pt, o: TailOpts): Tail | null {
  const [ax, ay] = a;
  const dx = ax < r.x ? r.x - ax : ax > r.x + r.w ? ax - (r.x + r.w) : 0;
  const dy = ay < r.y ? r.y - ay : ay > r.y + r.h ? ay - (r.y + r.h) : 0;
  if (!dx && !dy) return null;
  const rad = Math.min(o.radius, r.w / 2, r.h / 2);
  let x: number, y: number;
  if (dy >= dx) {
    const lo = r.x + rad + o.base / 2, hi = r.x + r.w - rad - o.base / 2;
    x = lo <= hi ? clamp(ax, lo, hi) : r.x + r.w / 2;
    y = ay > r.y + r.h ? r.y + r.h - o.inset : r.y + o.inset;
  } else {
    const lo = r.y + rad + o.base / 2, hi = r.y + r.h - rad - o.base / 2;
    y = lo <= hi ? clamp(ay, lo, hi) : r.y + r.h / 2;
    x = ax > r.x + r.w ? r.x + r.w - o.inset : r.x + o.inset;
  }
  const vx = ax - x, vy = ay - y;
  const len = clamp(Math.hypot(vx, vy), o.inset + o.min, o.inset + o.max);
  return { x, y, angle: Math.atan2(vy, vx) - Math.PI / 2, len };
}
