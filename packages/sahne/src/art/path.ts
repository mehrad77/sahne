// Vector paths for the kit. Art is built with these helpers, not raw SVG strings, so every
// shape has exact bounds, can be mirrored or moved, and renders the same to SVG and to Path2D.
// Coordinates are centimetres with y pointing down, as in SVG.

import { apply, type Affine, type Box, type Vec2 } from "../core/math.ts";

export type Cmd =
  | ["M", number, number]
  | ["L", number, number]
  | ["C", number, number, number, number, number, number]
  | ["Q", number, number, number, number]
  | ["Z"];

export class Path {
  cmds: Cmd[] = [];

  moveTo(x: number, y: number) { this.cmds.push(["M", x, y]); return this; }
  lineTo(x: number, y: number) { this.cmds.push(["L", x, y]); return this; }
  cubicTo(x1: number, y1: number, x2: number, y2: number, x: number, y: number) { this.cmds.push(["C", x1, y1, x2, y2, x, y]); return this; }
  quadTo(x1: number, y1: number, x: number, y: number) { this.cmds.push(["Q", x1, y1, x, y]); return this; }
  close() { this.cmds.push(["Z"]); return this; }

  /** Append another path's commands (for compound shapes and holes). */
  add(p: Path) { this.cmds.push(...p.cmds.map(c => [...c] as Cmd)); return this; }

  /** Bounds of every point and control point: a box that always contains the shape. */
  bounds(): Box {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.cmds) for (let i = 1; i < c.length; i += 2) {
      const x = c[i] as number, y = c[i + 1] as number;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return x0 === Infinity ? [0, 0, 0, 0] : [x0, y0, x1, y1];
  }

  transform(m: Affine): Path {
    const p = new Path();
    for (const c of this.cmds) {
      if (c[0] === "Z") { p.cmds.push(["Z"]); continue; }
      const out: (string | number)[] = [c[0]];
      for (let i = 1; i < c.length; i += 2) out.push(...apply(m, c[i] as number, c[i + 1] as number));
      p.cmds.push(out as Cmd);
    }
    return p;
  }

  mirrorX(about = 0) { return this.transform([-1, 0, 0, 1, 2 * about, 0]); }
  move(dx: number, dy: number) { return this.transform([1, 0, 0, 1, dx, dy]); }
  scaled(sx: number, sy = sx, ox = 0, oy = 0) { return this.transform([sx, 0, 0, sy, ox - ox * sx, oy - oy * sy]); }

  toD(digits = 2): string {
    const f = (n: number) => +n.toFixed(digits);
    return this.cmds.map(c => c[0] + (c.length > 1 ? c.slice(1).map(v => f(v as number)).join(" ") : "")).join("");
  }

  /** The `d` attribute in its shortest form (see `cmdsToD`): what the SVG output uses. */
  toCompactD(digits = 2): string { return cmdsToD(this.cmds, digits); }

  /** Whether every coordinate is a finite number (a path that is not must never reach the output). */
  finite(): boolean { return this.cmds.every(c => c.every((v, i) => i === 0 || Number.isFinite(v))); }

  /** Trace into a Canvas 2D context (cheaper than building a Path2D from a string). */
  trace(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
    for (const c of this.cmds) {
      switch (c[0]) {
        case "M": ctx.moveTo(c[1], c[2]); break;
        case "L": ctx.lineTo(c[1], c[2]); break;
        case "C": ctx.bezierCurveTo(c[1], c[2], c[3], c[4], c[5], c[6]); break;
        case "Q": ctx.quadraticCurveTo(c[1], c[2], c[3], c[4]); break;
        case "Z": ctx.closePath(); break;
      }
    }
  }
}

// ---- SVG text -------------------------------------------------------------------

/** A list of numbers as short SVG text: rounded, no leading zero, a space only where the next number does not start with `-`. */
export function svgNums(v: number[], digits = 2): string {
  let out = "", prev = "";
  for (const n of v) {
    // a number that is not finite becomes 0, so no `NaN` ever reaches the output
    const s = (Number.isFinite(n) ? (+n.toFixed(digits)).toString() : "0").replace(/^(-?)0\./, "$1.");
    // "1.5.5" reads as 1.5 and .5, and "2-3" as 2 and -3
    out += !prev || s[0] === "-" || (s[0] === "." && prev.includes(".")) ? s : " " + s;
    prev = s;
  }
  return out;
}

/** Numbers for an attribute that is not path data (a viewBox, a transform, a dash list): rounded, separated by spaces. */
export const svgList = (v: number[], digits = 2) => v.map(n => svgNums([n], digits)).join(" ");

/**
 * Path commands as the shortest `d`, with the same geometry to the rounding: relative commands, a
 * repeated letter written once, `h` and `v` for axis-aligned lines, a cubic whose controls sit on
 * its ends as a line, and `s` where the first control reflects the last one (the smooth curves).
 * Rounding is done on absolute positions, so it never drifts along a path.
 */
export function cmdsToD(cmds: Cmd[], digits = 2): string {
  const u = 10 ** digits, r = (n: number) => Math.round(n * u) / u;
  let out = "", last = "", cx = 0, cy = 0, sx = 0, sy = 0, rx = NaN, ry = NaN;
  const put = (letter: string, v: number[]) => {
    const n = svgNums(v, digits);
    out += letter === last && letter !== "z" ? (n[0] === "-" ? "" : " ") + n : letter + n;
    last = letter;
  };
  const line = (x: number, y: number) => { const dx = x - cx, dy = y - cy; if (!dy) put("h", [dx]); else if (!dx) put("v", [dy]); else put("l", [dx, dy]); cx = x; cy = y; rx = NaN; };
  for (const c of cmds) {
    if (c[0] === "Z") { put("z", []); cx = sx; cy = sy; rx = NaN; continue; }
    const q = (c.slice(1) as number[]).map(r);
    if (c[0] === "M") { out += "M" + svgNums(q, digits); last = "M"; cx = sx = q[0]; cy = sy = q[1]; rx = NaN; }
    else if (c[0] === "L") line(q[0], q[1]);
    else if (c[0] === "Q") { put("q", [q[0] - cx, q[1] - cy, q[2] - cx, q[3] - cy]); cx = q[2]; cy = q[3]; rx = NaN; }
    else if (q[0] === cx && q[1] === cy && q[2] === q[4] && q[3] === q[5]) line(q[4], q[5]);
    else {
      // within a rounding step of the reflection of the previous control point: a smooth join
      if (Math.abs(q[0] - (2 * cx - rx)) <= 1 / u + 1e-9 && Math.abs(q[1] - (2 * cy - ry)) <= 1 / u + 1e-9) put("s", [q[2] - cx, q[3] - cy, q[4] - cx, q[5] - cy]);
      else put("c", [q[0] - cx, q[1] - cy, q[2] - cx, q[3] - cy, q[4] - cx, q[5] - cy]);
      rx = q[2]; ry = q[3]; cx = q[4]; cy = q[5];
    }
  }
  return out;
}

/** The centre and radii when a path is exactly the one `ellipse()` builds, else null. */
export function asEllipse(p: Path): [number, number, number, number] | null {
  const c = p.cmds;
  if (c.length !== 6 || c[0][0] !== "M" || c[1][0] !== "C") return null;
  const cx = (c[1] as number[])[5], cy = c[0][2], rx = cx - c[0][1], ry = cy - (c[1] as number[])[6];
  if (!(rx > 0) || !(ry > 0)) return null;
  const e = ellipse(cx, cy, rx, ry).cmds, tol = 1e-6 * Math.max(rx, ry);
  return c.every((m, i) => m[0] === e[i][0] && m.every((v, k) => k === 0 || Math.abs((v as number) - (e[i][k] as number)) <= tol)) ? [cx, cy, rx, ry] : null;
}

/** An SVG element for a path: its tag and attributes. An exact ellipse becomes an `ellipse` or `circle`, anything else a `path` with a compact `d`. */
export function svgGeom(p: Path, digits = 2): { tag: string; attrs: string } {
  const e = asEllipse(p), n = (v: number) => svgNums([v], digits);
  if (!e) return { tag: "path", attrs: ` d="${cmdsToD(p.cmds, digits)}"` };
  return Math.abs(e[2] - e[3]) < 1e-6 * e[2] ? { tag: "circle", attrs: ` cx="${n(e[0])}" cy="${n(e[1])}" r="${n(e[2])}"` } : { tag: "ellipse", attrs: ` cx="${n(e[0])}" cy="${n(e[1])}" rx="${n(e[2])}" ry="${n(e[3])}"` };
}

// ---- Shape helpers ------------------------------------------------------------

const K = 0.5522847498; // cubic Bézier circle constant

export function ellipse(cx: number, cy: number, rx: number, ry = rx): Path {
  const ox = rx * K, oy = ry * K;
  return new Path().moveTo(cx - rx, cy)
    .cubicTo(cx - rx, cy - oy, cx - ox, cy - ry, cx, cy - ry)
    .cubicTo(cx + ox, cy - ry, cx + rx, cy - oy, cx + rx, cy)
    .cubicTo(cx + rx, cy + oy, cx + ox, cy + ry, cx, cy + ry)
    .cubicTo(cx - ox, cy + ry, cx - rx, cy + oy, cx - rx, cy).close();
}

export const circle = (cx: number, cy: number, r: number) => ellipse(cx, cy, r, r);

export function rect(x: number, y: number, w: number, h: number): Path {
  return new Path().moveTo(x, y).lineTo(x + w, y).lineTo(x + w, y + h).lineTo(x, y + h).close();
}

export function rrect(x: number, y: number, w: number, h: number, r: number | [number, number, number, number]): Path {
  const [tl, tr, br, bl] = (typeof r === "number" ? [r, r, r, r] : r).map(v => Math.min(v, w / 2, h / 2));
  const p = new Path().moveTo(x + tl, y).lineTo(x + w - tr, y);
  if (tr) p.cubicTo(x + w - tr * (1 - K), y, x + w, y + tr * (1 - K), x + w, y + tr);
  p.lineTo(x + w, y + h - br);
  if (br) p.cubicTo(x + w, y + h - br * (1 - K), x + w - br * (1 - K), y + h, x + w - br, y + h);
  p.lineTo(x + bl, y + h);
  if (bl) p.cubicTo(x + bl * (1 - K), y + h, x, y + h - bl * (1 - K), x, y + h - bl);
  p.lineTo(x, y + tl);
  if (tl) p.cubicTo(x, y + tl * (1 - K), x + tl * (1 - K), y, x + tl, y);
  return p.close();
}

export function poly(points: Vec2[], closed = true): Path {
  const p = new Path().moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) p.lineTo(points[i][0], points[i][1]);
  return closed ? p.close() : p;
}

/**
 * A smooth curve through the points (Catmull–Rom turned into cubic Béziers).
 * `tension` 1 is the classic curve; lower is tighter. A point given as [x, y, 0] is a corner.
 */
export function smooth(points: (Vec2 | [number, number, number])[], closed = true, tension = 1): Path {
  const n = points.length, p = new Path();
  const at = (i: number) => closed ? points[(i + n) % n] : points[Math.max(0, Math.min(n - 1, i))];
  p.moveTo(points[0][0], points[0][1]);
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    const k1 = (p1 as number[])[2] === 0 ? 0 : tension / 6, k2 = (p2 as number[])[2] === 0 ? 0 : tension / 6;
    p.cubicTo(
      p1[0] + (p2[0] - p0[0]) * k1, p1[1] + (p2[1] - p0[1]) * k1,
      p2[0] - (p3[0] - p1[0]) * k2, p2[1] - (p3[1] - p1[1]) * k2,
      p2[0], p2[1]);
  }
  return closed ? p.close() : p;
}

/** A stroke-like band of varying width along a smooth spine, as a filled shape. */
export function band(spine: Vec2[], widths: number[], tension = 1): Path {
  const n = spine.length, left: Vec2[] = [], right: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const w = (widths[i] ?? widths[widths.length - 1]) / 2;
    left.push([spine[i][0] - dy * w, spine[i][1] + dx * w]);
    right.push([spine[i][0] + dy * w, spine[i][1] - dx * w]);
  }
  return smooth([...left, ...right.reverse()], true, tension);
}

/** Points on an ellipse arc, for building organic outlines (angles in radians, 0 = right, y down). */
export function arcPoints(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, steps: number): Vec2[] {
  const out: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (a1 - a0) * (i / steps);
    out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return out;
}
