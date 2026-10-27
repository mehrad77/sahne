// A recording stand-in for the 2D canvas context. A kit draws its face with canvas calls
// (`kit.face.draw`); handed this, the same code comes out as SVG, in the coordinates it draws in
// (centimetres in the head bone's frame), so the still backend needs no raster and no second
// face. It implements exactly the subset kit faces may use (kit STYLE.md): paths (moveTo lineTo
// bezierCurveTo quadraticCurveTo closePath rect arc), fill and clip with either rule, stroke with
// a dash, fillRect, save/restore and the properties fillStyle strokeStyle globalAlpha lineWidth
// lineCap lineJoin. Anything else a kit calls is absent and throws (a method is not a function,
// a property cannot be added: the object is sealed), which `portrait` reports through
// `onPortraitError` and turns into the silhouette, so a face that drifts out of the subset shows.

import { Path, svgNums, svgList, svgGeom } from "../../art/path.ts";
import { svgId, svgPaint } from "../../art/shape.ts";

interface State { fillStyle: string; strokeStyle: string; globalAlpha: number; lineWidth: number; lineCap: string; lineJoin: string; dash: number[] }

const CAPS = ["round", "square"], JOINS = ["round", "bevel"];

export class SvgContext implements Omit<State, "dash"> {
  fillStyle = "#000000";
  strokeStyle = "#000000";
  globalAlpha = 1;
  lineWidth = 1;
  lineCap = "butt";
  lineJoin = "miter";
  private dash: number[] = [];

  private prefix: string;
  private digits: number;
  private out: string[] = [];
  private path = new Path();
  private stack: { s: State; open: number }[] = [];
  private open = 0;
  private clips = 0;

  /** `prefix` starts every clip path id (the caller keeps it unique within the document); `digits` is the precision of the coordinates. */
  constructor(prefix: string, digits = 2) { this.prefix = svgId(prefix); this.digits = digits; Object.seal(this); }

  beginPath() { this.path = new Path(); }
  moveTo(x: number, y: number) { this.path.moveTo(x, y); }
  lineTo(x: number, y: number) { this.path.lineTo(x, y); }
  bezierCurveTo(a: number, b: number, c: number, d: number, x: number, y: number) { this.path.cubicTo(a, b, c, d, x, y); }
  quadraticCurveTo(a: number, b: number, x: number, y: number) { this.path.quadTo(a, b, x, y); }
  closePath() { this.path.close(); }
  rect(x: number, y: number, w: number, h: number) { this.path.moveTo(x, y).lineTo(x + w, y).lineTo(x + w, y + h).lineTo(x, y + h).close(); }
  setLineDash(d: number[]) { this.dash = Array.isArray(d) ? d.slice() : []; }

  /** A circular arc (angles in radians, clockwise unless `ccw`) as cubic curves of at most a quarter turn, joined to the path so far by a line. */
  arc(x: number, y: number, r: number, a0: number, a1: number, ccw = false) {
    const T = Math.PI * 2;
    let d = a1 - a0;
    d = ccw ? (d <= -T ? -T : -(((-d % T) + T) % T)) : (d >= T ? T : ((d % T) + T) % T);
    const n = Math.max(1, Math.ceil(Math.abs(d) / (T / 4) - 1e-9)), st = d / n, k = 4 / 3 * Math.tan(st / 4), p = this.path;
    const sx = x + r * Math.cos(a0), sy = y + r * Math.sin(a0);
    if (p.cmds.length) p.lineTo(sx, sy); else p.moveTo(sx, sy);
    for (let i = 0; i < n; i++) {
      const a = a0 + st * i, b = a + st, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      p.cubicTo(x + r * (ca - k * sa), y + r * (sa + k * ca), x + r * (cb + k * sb), y + r * (sb - k * cb), x + r * cb, y + r * sb);
    }
  }

  save() { this.stack.push({ s: this.snap(), open: this.open }); }
  restore() {
    const top = this.stack.pop();
    if (!top) return;
    // the clips made since the matching save end here
    this.out.push("</g>".repeat(this.open - top.open));
    this.open = top.open;
    Object.assign(this, top.s);
  }

  /** The current path becomes the clip of everything drawn until the matching restore. */
  clip(rule?: string) {
    if (!this.path.finite()) return;
    const id = `${this.prefix}${this.clips++}`;
    this.out.push(`<clipPath id="${id}">${this.el(rule === "evenodd" ? ` clip-rule="evenodd"` : "")}</clipPath><g clip-path="url(#${id})">`);
    this.open++;
  }

  fill(rule?: string) {
    const c = svgPaint(this.fillStyle);
    if (c && this.path.finite() && this.path.cmds.length) this.out.push(this.el(` fill="${c}"${rule === "evenodd" ? ` fill-rule="evenodd"` : ""}${this.alpha("fill-opacity")}`));
  }

  stroke() {
    const c = svgPaint(this.strokeStyle), w = this.lineWidth;
    if (!c || !(w > 0) || !Number.isFinite(w) || !this.path.finite() || !this.path.cmds.length) return;
    const cap = CAPS.includes(this.lineCap) ? ` stroke-linecap="${this.lineCap}"` : "", join = JOINS.includes(this.lineJoin) ? ` stroke-linejoin="${this.lineJoin}"` : "";
    const d = this.dash, dash = d.length && d.every(n => n >= 0 && Number.isFinite(n)) && d.some(n => n > 0) ? ` stroke-dasharray="${svgList(d)}"` : "";
    this.out.push(this.el(` fill="none" stroke="${c}" stroke-width="${svgNums([w])}"${cap}${join}${dash}${this.alpha("stroke-opacity")}`));
  }

  fillRect(x: number, y: number, w: number, h: number) {
    const c = svgPaint(this.fillStyle);
    if (c && [x, y, w, h].every(Number.isFinite)) this.out.push(`<rect x="${svgNums([x], this.digits)}" y="${svgNums([y], this.digits)}" width="${svgNums([w], this.digits)}" height="${svgNums([h], this.digits)}" fill="${c}"${this.alpha("fill-opacity")}/>`);
  }

  /** Close what is still open and return the markup. */
  done(): string {
    this.out.push("</g>".repeat(this.open));
    this.open = 0;
    return this.out.join("");
  }

  /** The current path as an element with the given attributes. */
  private el(attrs: string) { const g = svgGeom(this.path, this.digits); return `<${g.tag}${g.attrs}${attrs}/>`; }
  /** The opacity attribute; a value outside 0…1 is ignored, as the canvas ignores it. */
  private alpha(attr: string) { const a = this.globalAlpha; return a >= 0 && a < 1 ? ` ${attr}="${svgNums([a])}"` : ""; }
  private snap(): State {
    const { fillStyle, strokeStyle, globalAlpha, lineWidth, lineCap, lineJoin, dash } = this;
    return { fillStyle, strokeStyle, globalAlpha, lineWidth, lineCap, lineJoin, dash };
  }
}
