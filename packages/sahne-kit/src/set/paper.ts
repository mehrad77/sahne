// Props of the paper family, following STYLE.md: paper things, bound things, photos,
// pens and map pins. Units cm; each flat's origin is its bottom centre. Words on them (a slip's date, a
// form's lines, a book's title, a clock's numbers) are `text` on the first flat, laid out as HTML
// (TextSpec), never drawn. Paper that fills in line by line takes `lines` (one per ruled line; a blank
// one leaves its line empty), a single text `label` (or `text`); `n` copies take one `labels[i]` each.

import { ellipse, rect, rrect, poly, smooth, tone, mix, luma, mul, rotate, translate, groupBounds, clipsOf, Path, type Affine, type PieceDef, type PieceOut, type Rng, type Shape, type TextSpec, type Vec2 } from "sahne";
import { S, P, num, str, type Pt } from "./draw.ts";
import { CROWD_FABRIC, FABRIC, HAIR, SKIN } from "../palette.ts";

const INK = "#2B2420", PEN = "#27408B", RED = "#C0392B", WHITE = "#FBF8F1", CREAM = "#F2E8D0", GOLD = "#D7B256", STEEL = "#B8BEC4", WOOD = "#C99A68", NAVY = "#2E3A59";
const BRIGHT = ["#F2C14E", "#F4A6B6", "#9CD3C0", "#8DB8DA", "#F0745F", "#B9A6DC", "#A9CC3A", "#F7E17A"];
const BOLD = ["#C8372D", "#2E6FB6", "#2F8C88", "#E07A1F", "#7A3E6E", "#4E7A68"];
const BOOKS = ["#A23F28", "#2E3A59", "#4E7A68", "#6A1E32", "#1F5FC0", "#6B4A35", "#E0A83A", "#2F8C88", "#7A3E6E", "#3A3D45"];
const PRINT: Partial<TextSpec> = { font: "print", color: INK }, HAND: Partial<TextSpec> = { font: "hand", color: PEN, align: "left" };

/** A prop's params, read once in its generator. */
interface Q {
  r: Rng; held: boolean; n: number; c?: string; label: string; lines: string[]; title?: string; labels?: string[];
  fields?: string[]; names?: string[]; rows?: number[]; missing?: number; stamped?: boolean; signed?: boolean; open?: boolean;
  picture?: string; time?: string; score?: string; flag?: boolean; spiral?: boolean; tabs?: boolean; level?: string;
}
/** One drawn thing: its shapes and words, its size (x −w/2…w/2, y −h…0), where a hand holds it (the art's offset from the grip), and whether it is shown when held. */
interface Out { sh: Shape[]; tx: TextSpec[]; w: number; h: number; gx?: number; gy?: number; show?: boolean }
type Kind = (q: Q) => Out;

const T = (text: string, x: number, y: number, w: number, h: number, o: Partial<TextSpec> = {}): TextSpec => ({ text, x, y, w, h, size: h * 0.6, ...o });
const list = (v: unknown): string[] => Array.isArray(v) ? v.map(s => typeof s === "string" ? s.trim() : "") : [];
const cnt = (v: unknown, max: number) => Math.max(1, Math.min(max, Math.round(num(v, 1))));
const words = (q: Q) => q.label ? [q.label, ...q.lines] : q.lines;
const flatS = (path: Path, fill: string, opacity = 1, o: Partial<Shape> = {}): Shape => ({ path, fill, flat: true, opacity, ...o });
const mv = (sh: Shape[], m: Affine): Shape[] => sh.map(s => ({ ...s, path: s.path.transform(m), ...(s.clip ? { clip: clipsOf(s).map(c => c.transform(m)) } : {}) }));
/** Segments [x0, y0, x1, y1] as one path. */
function pathOf(sg: number[][]): Path { const p = new Path(); for (const [a, b, c, d] of sg) p.moveTo(a, b).lineTo(c, d); return p; }
/** A path drawn with a pen, flat: rules, grids, a dashed box, a ring. */
const ring = (path: Path, color: string, width: number, opacity = 0.8, dash?: number[]): Shape => ({ path, stroke: { color, width, cap: "round", ...(dash ? { dash } : {}) }, flat: true, opacity });
/** Ruled lines under `rows` rows of `gap` from (x, y). */
const ruled = (x: number, y: number, w: number, rows: number, gap: number, c = "#8DB8DA") => ring(pathOf(Array.from({ length: rows }, (_, i) => [x, y + (i + 1) * gap, x + w, y + (i + 1) * gap])), c, 0.07, 0.7);
/** Writing seen from afar: `rows` printed bars of seeded lengths from (x, y), `gap` apart (`mid`: centred). */
function bars(r: Rng, x: number, y: number, w: number, rows: number, gap: number, c = INK, op = 0.3, th = 0.45, mid = false): Shape[] {
  const p = new Path();
  for (let i = 0; i < rows; i++) { const l = w * (i === rows - 1 && rows > 2 ? r.range(0.35, 0.6) : r.range(0.72, 1)); p.add(rrect(mid ? x + (w - l) / 2 : x, y + i * gap, l, gap * th, gap * th / 2)); }
  return rows > 0 ? [flatS(p, c, op)] : [];
}
/** Handwriting seen from afar, or a signature: a wavy pen line `w` long at (x, y). */
function scrawl(r: Rng, x: number, y: number, w: number, c = PEN, a = 0.5): Shape {
  const k = Math.max(4, Math.round(w / 0.7)), pts: Vec2[] = [];
  for (let i = 0; i <= k; i++) pts.push([x + w * i / k, y + (i % 2 ? -a : a) * r.range(0.3, 1)]);
  return { path: smooth(pts, false, 1), stroke: { color: c, width: 0.16, cap: "round", join: "round" }, flat: true, opacity: 0.85 };
}
/** `ws` one per row of `gap` from (x, y), at most `max`: a blank one leaves its row empty. */
const rowsOf = (ws: string[], x: number, y: number, w: number, gap: number, o: Partial<TextSpec>, max = 99): TextSpec[] =>
  ws.slice(0, max).flatMap((s, i) => s ? [T(s, x, y + i * gap, w, gap, o)] : []);
/** A sheet `w` × `h` in `c` on its bottom edge at (cx, by): shade down its right side, a dog-ear now and then. */
function sheet(r: Rng, w: number, h: number, c = WHITE, ear = r.chance(0.3), cx = 0, by = 0): Shape[] {
  const x0 = cx - w / 2, x1 = cx + w / 2, y = by - h, e = ear ? Math.min(w, h) * 0.1 : 0;
  const out = poly(ear ? [[x0, by], [x0, y], [x1 - e, y], [x1, y + e], [x1, by]] : [[x0, by], [x0, y], [x1, y], [x1, by]]);
  return [S(out, c), flatS(rect(x1 - w * 0.2, y, w * 0.2, h), tone(c, "shade"), 0.16, { clip: out }), ...(ear ? [S(poly([[x1 - e, y], [x1 - e, y + e], [x1, y + e]]), tone(c, "shade"))] : [])];
}
const page = (q: Q, w: number, h: number, c: string, ear?: boolean): Out => ({ sh: sheet(q.r, w, h, c, ear), tx: [], w, h });
/** Barcode stripes in a box. */
function barcode(r: Rng, x: number, y: number, w: number, h: number): Shape {
  const p = new Path();
  for (let a = x; a < x + w - 0.25;) { const b = r.range(0.06, 0.22); p.add(rect(a, y, b, h)); a += b + r.range(0.06, 0.2); }
  return flatS(p, INK, 0.75);
}
/** A made-up official crest: a ring and a rosette, never a real emblem. */
function crest(x: number, y: number, s: number, c: string): Shape[] {
  const dots = ellipse(x, y, s * 0.2);
  for (let i = 0; i < 8; i++) dots.add(ellipse(x + Math.cos(i * Math.PI / 4) * s * 0.5, y + Math.sin(i * Math.PI / 4) * s * 0.5, s * 0.13));
  return [ring(ellipse(x, y, s), c, s * 0.12, 0.85), flatS(dots, c, 0.85)];
}
/** A round ink stamp at (x, y), radius `s`. */
const stamp = (r: Rng, x: number, y: number, s: number, c: string): Shape[] => [ring(ellipse(x, y, s), c, s * 0.09, 0.7), ring(ellipse(x, y, s * 0.72), c, s * 0.05, 0.7), ...bars(r, x - s * 0.45, y - s * 0.25, s * 0.9, 2, s * 0.32, c, 0.6, 0.45, true)];
/** Text on a cover: in a box (on a `plate`), or printed bars standing in for it. */
function titled(o: Out, r: Rng, txt: string | undefined, x: number, y: number, w: number, h: number, color: string, plate?: string) {
  if (plate) o.sh.push(flatS(rrect(x, y, w, h, 0.3), plate));
  if (txt) o.tx.push(T(txt, x + 0.3, y + 0.2, w - 0.6, h - 0.4, { ...PRINT, color, weight: 700 }));
  else o.sh.push(...bars(r, x + w * 0.15, y + h * 0.3, w * 0.7, 2, h * 0.28, color, 0.55, 0.55, true));
}
/** Text that reads on `c`. */
const onC = (c: string) => luma(c) > 0.55 ? INK : "#F6EBCB";
/** A small Turkish flag on a toothpick, its top-left at (x, y), `w` wide. */
function flagOn(x: number, y: number, w: number): Shape[] {
  const h = w * 2 / 3, cx = x + w * 0.36, cy = y + h / 2, star: Pt[] = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, k = i % 2 ? h * 0.05 : h * 0.125; return [cx + h * 0.25 + Math.cos(a) * k, cy + Math.sin(a) * k, 0]; });
  return [S(rect(x - 0.3, y, 0.5, h * 3), WOOD), S(rect(x, y, w, h), "#E30A17"), flatS(ellipse(cx, cy, h * 0.25).add(ellipse(cx + h * 0.0625, cy, h * 0.2)), "#FFFFFF", 1, { evenodd: true }), P(star, "#FFFFFF", { flat: true })];
}
/** A small picture in a box centred at (x, y), `s` across: a dove (kumru), a house, a tea glass, an apple; anything else a sun over hills. */
function picture(kind: string, x: number, y: number, s: number): Shape[] {
  const k = s / 10, at = (pts: number[][]): Pt[] => pts.map(([a, b, c]) => c === 0 ? [x + a * k, y + b * k, 0] : [x + a * k, y + b * k]), e = (a: number, b: number, rx: number, ry = rx) => ellipse(x + a * k, y + b * k, rx * k, ry * k), re = (a: number, b: number, w: number, h: number) => rect(x + a * k, y + b * k, w * k, h * k);
  if (/bird|kumru|dove|güvercin/.test(kind)) return [
    P(at([[-2, -1.2], [1.5, -2.2], [3.6, -1.4], [5, -2, 0], [5.2, 0, 0], [2.5, 1.4], [-1.2, 1.6], [-2.8, 0.4]]), "#C9B8A6"), S(e(-2.9, -2.3, 1.7), "#C9B8A6"),
    P(at([[-4.4, -2.7, 0], [-5.5, -2.1, 0], [-4.4, -1.8, 0]]), "#4A3F3A"), flatS(e(-1.9, -1.1, 0.9, 0.3), "#2B2420", 0.85),
    P(at([[0, -1.1], [3, -1.7], [3.9, -0.6], [1.2, 0.6]]), "#A8957F"), ring(pathOf([[x - 0.4 * k, y + 1.6 * k, x - 0.8 * k, y + 3 * k], [x + 0.8 * k, y + 1.5 * k, x + 0.8 * k, y + 3 * k]]), "#C9776A", 0.35 * k, 1)];
  if (/house|ev/.test(kind)) return [S(re(-3.5, -1, 7, 5), "#E8B9A3"), S(poly(at([[-4.6, -0.8], [0, -5], [4.6, -0.8]]) as Vec2[]), "#B3261E"), flatS(re(-0.8, 1.2, 1.7, 2.8), "#7A5034"), flatS(re(1.4, 0.2, 1.6, 1.5), "#BFDDE6")];
  if (/tea|çay/.test(kind)) return [S(e(0, 3.3, 3.6, 0.8), "#E9E4DA"), P(at([[-1.7, -3.6, 0], [1.7, -3.6, 0], [1.1, -0.6], [1.8, 2.8, 0], [-1.8, 2.8, 0], [-1.1, -0.6]]), "#EAF3F5", { opacity: 0.9 }), P(at([[-1.25, -1.6, 0], [1.25, -1.6, 0], [1.05, -0.6], [1.6, 2.5, 0], [-1.6, 2.5, 0], [-1.05, -0.6]]), "#B5451B", { flat: true })];
  if (/apple|elma/.test(kind)) return [P(at([[0, -2.2], [2.6, -3], [3.8, -0.4], [2.4, 3], [0, 3.4], [-2.4, 3], [-3.8, -0.4], [-2.6, -3]]), "#C8372D"), ring(pathOf([[x, y - 2 * k, x + 0.5 * k, y - 4.4 * k]]), "#6B4A35", 0.5 * k, 1), P(at([[0.6, -3.8], [2.8, -4.8], [1.6, -3.2]]), "#4E7A48")];
  return [S(e(2, -2, 1.6), "#F2C14E"), P(at([[-4.5, 3.5, 0], [-4.5, 1], [-1.5, -1], [1.5, 1.5], [4.5, 0], [4.5, 3.5, 0]]), "#7FA36E")];
}
/** A drawing for a greeting card's front, centred at (x, y), `s` across: balloons, a cake with candles, or a flower. */
function motif(r: Rng, x: number, y: number, s: number): Shape[] {
  const k = r.int(0, 2), out: Shape[] = [];
  if (k === 0) {
    const tie: number[][] = [];
    for (const [dx, dy, c] of [[-0.24, -0.1, "#C8372D"], [0.22, -0.16, "#2E6FB6"], [0, 0.06, "#F2C14E"]] as const) { out.push(S(ellipse(x + dx * s, y + dy * s, s * 0.15, s * 0.18), c)); tie.push([x + dx * s, y + (dy + 0.18) * s, x, y + s * 0.5]); }
    out.unshift(ring(pathOf(tie), INK, 0.08, 0.6));
  } else if (k === 1) {
    out.push(S(rect(x - s * 0.32, y, s * 0.64, s * 0.24), "#F4D9C6"), S(rect(x - s * 0.24, y - s * 0.16, s * 0.48, s * 0.17), "#E58FA0"), flatS(rect(x - s * 0.32, y + s * 0.08, s * 0.64, s * 0.04), "#C8372D", 0.7));
    for (let i = -1; i <= 1; i++) out.push(S(rect(x + i * s * 0.12 - s * 0.015, y - s * 0.3, s * 0.03, s * 0.14), "#8DB8DA"), flatS(ellipse(x + i * s * 0.12, y - s * 0.34, s * 0.025, s * 0.045), "#F2B705"));
  } else {
    out.push(ring(pathOf([[x, y - s * 0.05, x, y + s * 0.5]]), "#4E7A48", s * 0.03, 1), P([[x, y + s * 0.3], [x + s * 0.22, y + s * 0.18], [x + s * 0.05, y + s * 0.38]], "#6F9E5A"));
    for (let i = 0; i < 6; i++) out.push(S(ellipse(x + Math.cos(i * Math.PI / 3) * s * 0.12, y - s * 0.12 + Math.sin(i * Math.PI / 3) * s * 0.12, s * 0.09), "#F0745F"));
    out.push(S(ellipse(x, y - s * 0.12, s * 0.07), "#F2C14E"));
  }
  return out;
}

// ---- Paper ---------------------------------------------------------------------------------

const A4W = 21, A4H = 29.7, X0 = -9.3;
const PAPER: Record<string, Kind> = {
  plain(q) {
    const { r } = q, o = page(q, A4W, A4H, q.c ?? WHITE), ws = words(q);
    let y = -A4H + 2.2;
    if (q.title) { o.tx.push(T(q.title, -8.3, y, 16.6, 2.4, { ...PRINT, weight: 700 })); y += 3.2; }
    if (ws.length) o.tx.push(...rowsOf(ws, -8.3, y, 16.6, 2.2, HAND, 10));
    else o.sh.push(...bars(r, -8.3, y + 1, 16.6, 5, 1.5), ...bars(r, -8.3, y + 10.5, 16.6, 7, 1.5));
    if (r.chance(0.4)) o.sh.push(S(rect(-1.1, -0.15, 2.2, 0.3).transform(mul(translate(-A4W / 2 + 1.4, -A4H + 1.2), rotate(-0.7))), STEEL));
    return o;
  },
  sheet(q) {
    const o = page(q, A4W, A4H, q.c ?? q.r.pick(BRIGHT));
    o.tx.push(...rowsOf(words(q), -8.5, -A4H + 2.5, 17, 3.2, { font: "hand", color: INK }, 8));
    return o;
  },
  slip(q) {
    const { r } = q, w = 16, h = 9, o = page(q, w, h, q.c ?? WHITE, false), ws = words(q);
    o.sh.push(flatS(rect(-w / 2, -h, w, 2.3), "#D5DEE8"), ...crest(-6.5, -h + 1.15, 0.75, NAVY), ...bars(r, -5.2, -h + 0.65, 7, 2, 0.6, NAVY, 0.5, 0.5),
      ring(pathOf([[-w / 2 + 0.8, -h + 2.7, -w / 2 + 0.8, -0.4]]), "#8E979E", 0.12, 0.7, [0.25, 0.3]), barcode(r, 3.4, -1.45, 3.8, 0.9));
    if (ws.length) { const g = 4.5 / Math.min(ws.length, 5); o.tx.push(...rowsOf(ws, -6.6, -6.4, 13.8, g, { ...PRINT, size: Math.min(1.5, g * 0.6), weight: 600 }, 5)); }
    else o.sh.push(...bars(r, -6.6, -6, 12, 3, 1.4));
    return o;
  },
  number_slip(q) {
    const { r } = q, w = 8, h = 12, c = q.c ?? "#F7F5EF", top: Vec2[] = [];
    for (let i = 0; i <= 16; i++) top.push([w / 2 - i * w / 16, -h + (i % 2 ? 0.35 : 0)]);
    const out = poly([[-w / 2, 0], [w / 2, 0], ...top]), o: Out = { sh: [S(out, c), flatS(rect(w / 2 - 1.4, -h, 1.4, h), tone(c, "shade"), 0.15, { clip: out }), ...bars(r, -2.6, -h + 1.2, 5.2, 2, 0.75, INK, 0.45, 0.5, true),
      ring(pathOf([[-3.2, -h + 3.1, 3.2, -h + 3.1]]), INK, 0.06, 0.4, [0.2, 0.2]), ...bars(r, -2.4, -3.6, 4.8, 2, 0.7, INK, 0.4, 0.5, true), barcode(r, -2.2, -1.6, 4.4, 0.9)], tx: [], w, h };
    if (q.label) o.tx.push(T(q.label, -3.4, -h + 3.4, 6.8, 4.8, { ...PRINT, size: 3.8, weight: 700 }));
    else o.sh.push(...bars(r, -1.8, -7.4, 3.6, 1, 2.6, INK, 0.35, 0.7, true));
    return o;
  },
  form(q) {
    const { r } = q, o = page(q, A4W, A4H, q.c ?? WHITE, false), ws = words(q), n = Math.max(7, Math.min(10, ws.length)), g = 15.4 / n, y0 = -22.6, rules: number[][] = [];
    o.sh.push(flatS(rect(-A4W / 2, -A4H, A4W, 5.2), "#DCE4EC"), ...crest(-8, -A4H + 2.6, 1.3, NAVY), S(rect(5.4, -A4H + 0.9, 3.8, 4.8), "#F4F1EA"), ring(rect(5.4, -A4H + 0.9, 3.8, 4.8), "#8E979E", 0.08, 0.7, [0.3, 0.25]),
      flatS(ellipse(7.3, -A4H + 2.8, 0.8, 0.95).add(rrect(5.9, -A4H + 4, 2.8, 1.7, 0.8)), "#9AA0A6", 0.35));
    if (q.title) o.tx.push(T(q.title, -6.2, -A4H + 1, 11, 3.2, { ...PRINT, weight: 700, size: 1.4 }));
    else o.sh.push(...bars(r, -6.2, -A4H + 1.8, 9, 2, 1.1, NAVY, 0.45));
    for (let i = 0; i < n; i++) {
      const y = y0 + i * g, f = q.fields?.[i];
      rules.push([-3.4, y + g, -X0, y + g]);
      if (f) o.tx.push(T(f, X0, y, 5.6, g, { ...PRINT, align: "left", size: 0.8, color: "#55606B" }));
      else o.sh.push(...bars(r, X0, y + g * 0.45, r.range(3, 5.2), 1, g * 0.5));
    }
    o.sh.push(ring(pathOf(rules), "#7E8A96", 0.07, 0.8));
    o.tx.push(...rowsOf(ws, -3.2, y0, 12.4, g, { ...HAND, size: g * 0.55 }, n));
    // boxes to tick, and the signature
    for (let i = 0; i < 2; i++) o.sh.push(ring(rect(X0 + i * 6, -6, 0.9, 0.9), INK, 0.08, 0.6), ...bars(r, X0 + 1.3 + i * 6, -5.9, 3.5, 1, 0.8));
    o.sh.push(ring(pathOf([[2.5, -2, -X0, -2]]), INK, 0.07, 0.6), ...bars(r, 2.5, -1.6, 2.4, 1, 0.7));
    if (q.signed) o.sh.push(scrawl(r, 3, -2.7, 5));
    return o;
  },
  contract(q) {
    const { r } = q, o = page(q, A4W, A4H, q.c ?? WHITE), g = 1.9, y0 = -24.4, rows: number[][] = [];
    if (q.title) o.tx.push(T(q.title, -8, -A4H + 1.4, 16, 2.6, { ...PRINT, weight: 700, size: 1.5 }));
    else o.sh.push(...bars(r, -4, -A4H + 2.2, 8, 1, 1.4, INK, 0.5, 0.6, true));
    o.sh.push(ring(pathOf([[X0, -A4H + 4.4, -X0, -A4H + 4.4], [X0, -A4H + 4.75, -X0, -A4H + 4.75]]), INK, 0.06, 0.6));
    for (let i = 0; i < 4; i++) { rows.push([-3.2, y0 + (i + 1) * g, -X0, y0 + (i + 1) * g]); o.sh.push(...bars(r, X0, y0 + i * g + g * 0.45, r.range(3, 5), 1, g * 0.5)); }
    o.sh.push(ring(pathOf(rows), "#7E8A96", 0.06, 0.8), ...bars(r, X0, -15.8, 18.6, 6, 1.12), ...bars(r, X0 + 0.9, -8.9, 9.5, 1, 1.12));
    o.tx.push(...rowsOf(words(q), -3.1, y0, 12.4, g, { ...HAND, size: 1.05 }, 4));
    // two signatures on the left; on the right the stamp's box, dashed and empty until it is `stamped`
    for (const y of [-5, -1.8]) { o.sh.push(ring(pathOf([[X0, y, -1.6, y]]), INK, 0.06, 0.6), ...bars(r, X0, y + 0.3, 2.6, 1, 0.6)); if (q.signed) o.sh.push(scrawl(r, X0 + 1, y - 0.7, 5.5)); }
    o.sh.push(ring(rrect(2.2, -7.6, 7.1, 6.4, 0.4), "#6B6F78", 0.1, 0.75, [0.5, 0.35]));
    if (q.stamped) o.sh.push(...stamp(r, 5.75, -4.4, 2.5, "#5B4FA0"));
    return o;
  },
  exam(q) {
    const { r } = q, o = page(q, A4W, A4H, q.c ?? WHITE), g = 1.9, at: number[] = [];
    o.sh.push(...bars(r, X0, -A4H + 1.6, 2.6, 1, 0.8, INK, 0.35), ring(pathOf([[X0 + 3, -A4H + 2.3, 1.5, -A4H + 2.3]]), INK, 0.06, 0.6));
    if (q.score) { o.sh.push(ring(ellipse(7.2, -A4H + 2.6, 1.9), RED, 0.18, 0.85)); o.tx.push(T(q.score, 5.6, -A4H + 1.3, 3.2, 2.6, { font: "hand", color: RED, size: 1.5, weight: 700 })); }
    if (q.title) o.tx.push(T(q.title, -7, -A4H + 4.2, 14, 2.2, { ...PRINT, weight: 700, size: 1.3 })); else o.sh.push(...bars(r, -3.5, -A4H + 4.9, 7, 1, 1.2, INK, 0.45, 0.6, true));
    let y = -23;
    // the reading passage in a box, then questions: a number, a printed line, lines to write on
    if (q.label) { o.sh.push(flatS(rect(X0, y, 18.6, 7.6), "#EEF0F2"), ring(rect(X0, y, 18.6, 7.6), "#9AA0A6", 0.06, 0.8)); o.tx.push(T(q.label, X0 + 0.6, y + 0.4, 17.4, 6.8, { ...PRINT, align: "left", size: 1 })); y += 8.6; }
    while (y < -4) {
      o.sh.push(flatS(ellipse(X0 + 0.5, y + 0.55, 0.5), INK, 0.6), ...bars(r, X0 + 1.4, y + 0.3, 16, 1, 0.9));
      y += 1.4;
      for (let j = 0; j < 2 && y + g < -0.8; j++, y += g) at.push(y);
      y += 0.6;
    }
    o.sh.push(ring(pathOf(at.map(a => [X0 + 1.4, a + g, -X0, a + g])), "#7E8A96", 0.06, 0.8));
    q.lines.forEach((s, i) => { if (s && i < at.length) o.tx.push(T(s, X0 + 1.6, at[i], 17, g, { ...HAND, size: 1.1 })); });
    return o;
  },
  document(q) {
    const { r } = q, o = page(q, A4W, A4H, q.c ?? WHITE), ws = words(q);
    o.sh.push(...crest(X0 + 1.8, -A4H + 3, 1.6, NAVY), ...bars(r, X0 + 4.2, -A4H + 1.8, 10, 2, 1.1, NAVY, 0.55, 0.5), ...bars(r, X0 + 4.2, -A4H + 4.1, 7, 1, 0.7, NAVY, 0.35),
      ring(pathOf([[X0, -A4H + 5.6, -X0, -A4H + 5.6]]), NAVY, 0.1, 0.7), ...bars(r, 4.5, -A4H + 6.4, 4.8, 1, 0.7, INK, 0.35));
    if (q.title) o.tx.push(T(q.title, -8, -A4H + 7.6, 16, 2.4, { ...PRINT, weight: 700, size: 1.4 })); else o.sh.push(...bars(r, -3.5, -A4H + 8.4, 7, 1, 1.2, INK, 0.5, 0.6, true));
    if (ws.length) o.tx.push(...rowsOf(ws, X0, -18.8, 18.6, 1.7, { ...PRINT, align: "left", size: 1 }, 8));
    else o.sh.push(...bars(r, X0, -18.4, 18.6, 5, 1.2), ...bars(r, X0, -11.6, 18.6, 4, 1.2));
    o.sh.push(...bars(r, 3, -5.6, 5.5, 1, 0.8, INK, 0.35), scrawl(r, 3.2, -3.4, 5), ...stamp(r, 4.6, -3.2, 2.1, "#2E4C9A"));
    return o;
  },
  envelope(q) {
    const { r } = q, w = 22, h = 11, c = q.c ?? r.pick(["#CFAE7E", "#F4F0E6", "#E6D9BE"]), o = page(q, w, h, c, false), tip = -h * 0.42;
    o.sh.push(ring(pathOf([[-w / 2, 0, -1.5, tip + 1.6], [w / 2, 0, 1.5, tip + 1.6]]), tone(c, "shade"), 0.12, 0.6),
      P([[-w / 2, -h, 0], [w / 2, -h, 0], [0.8, tip - 0.2], [0, tip, 0], [-0.8, tip - 0.2]], tone(c, "light")), S(ellipse(0, tip - 0.4, 0.9), r.pick(["#B3261E", "#C8A24A", "#2E6FB6"])));
    if (q.label) o.tx.push(T(q.label, -7.5, tip + 1, 15, -tip - 1.6, { font: "hand", color: INK, size: 1.6 }));
    return o;
  },
  card(q) {
    const { r } = q, w = 14, h = 19, c = q.c ?? r.pick(BRIGHT), ws = words(q);
    if (!(q.open ?? ws.length > 0)) {
      // folded: the inside leaf shows past the front's edge
      const o: Out = { sh: [S(rect(-w / 2 + 0.7, -h + 0.3, w, h - 0.3), tone(WHITE, "shade")), ...sheet(r, w, h, c, false), ...motif(r, 0, -12, 9)], tx: [], w: w + 1.4, h };
      if (q.title) o.tx.push(T(q.title, -6, -5.6, 12, 4.2, { font: "hand", color: onC(c), size: 1.7 }));
      return o;
    }
    const dots = new Path();
    for (let i = 0; i < 22; i++) dots.add(ellipse(-r.range(1, w - 1), -r.range(1, h - 1), 0.25));
    const o: Out = { sh: [...sheet(r, w, h, mix(c, WHITE, 0.6), false, -w / 2), flatS(dots, tone(c, "shade"), 0.6), ...sheet(r, w, h, WHITE, false, w / 2), flatS(rect(-1.4, -h, 2.8, h), "#8E877C", 0.12)], tx: [], w: 2 * w, h, show: true };
    if (ws.length) o.tx.push(...rowsOf(ws, 1, -h + 2, 12, 2.1, { ...HAND, size: 1.25 }, 7));
    else for (let i = 0; i < 4; i++) o.sh.push(scrawl(r, 1.6, -h + 3.4 + i * 2.1, r.range(6, 10.5)));
    return o;
  },
  note(q) {
    const { r } = q, s = 9, e = 1.6, c = q.c ?? r.pick(["#F7E17A", "#F6B3C8", "#A8E0C8", "#9FCBEA", "#FFC48A"]), ws = words(q), out = poly([[-s / 2, 0], [-s / 2, -s], [s / 2, -s], [s / 2, -e], [s / 2 - e, 0]]);
    const o: Out = { sh: [S(out, c), flatS(rect(-s / 2, -s, s, 1.5), tone(c, "shade"), 0.18), S(poly([[s / 2 - e, 0], [s / 2, -e], [s / 2 - e * 0.85, -e * 0.85]]), tone(c, "light"))], tx: [], w: s, h: s };
    if (ws.length) { const k = Math.min(ws.length, 4), g = Math.min(2.4, 6.4 / k); o.tx.push(...rowsOf(ws, -3.8, -s + 1.8 + (6.4 - g * k) / 2, 7.4, g, { font: "hand", color: INK, size: g * 0.62 }, 4)); }
    else for (let i = 0; i < 3; i++) o.sh.push(scrawl(r, -3.4, -6.6 + i * 1.8, r.range(4, 6.6), INK, 0.35));
    return o;
  },
  list(q) {
    const { r } = q, w = 9, g = 1.9, ws = words(q), head = q.title ? 1 : 0, n = Math.max(8, ws.length + head), h = 3 + n * g, y0 = -h + 1.8, top: Vec2[] = [], dash: number[][] = [];
    for (let i = 0; i <= 12; i++) top.push([w / 2 - i * w / 12, -h + r.range(0, 0.45)]);
    const out = poly([[-w / 2, 0], [w / 2, 0], ...top]), o: Out = { sh: [S(out, q.c ?? WHITE), flatS(rect(w / 2 - 1.4, -h, 1.4, h), tone(WHITE, "shade"), 0.15, { clip: out }), ruled(-w / 2, y0, w, n, g), ring(pathOf([[-w / 2 + 1.5, -h + 0.6, -w / 2 + 1.5, 0]]), "#E58FA0", 0.08, 0.8)], tx: [], w, h };
    if (q.title) o.tx.push(T(q.title, -2.7, y0, 7, g, { font: "hand", color: INK, weight: 700, size: 1.2 }));
    const item = (i: number) => { const y = y0 + (head + i) * g; dash.push([-2.6, y + g * 0.55, -2, y + g * 0.55]); return y; };
    ws.forEach((s, i) => { if (s) o.tx.push(T(s, -1.7, item(i), 6, g, { ...HAND, size: 1.15 })); });
    if (!ws.length) for (let i = 0; i < 4; i++) o.sh.push(scrawl(r, -1.6, item(i) + g * 0.55, r.range(2.5, 5), PEN, 0.3));
    o.sh.push(ring(pathOf(dash), PEN, 0.14, 0.85));
    return o;
  },
  stack(q) {
    const { r } = q;
    if (q.held) {
      // in the hand: a sheaf, fanned a little, writing on the top sheet
      const sh: Shape[] = [];
      for (let i = 0; i < 4; i++) sh.push(...mv(sheet(r, A4W, A4H, i % 2 ? WHITE : "#F3EFE6", false), rotate((i - 3) * 0.05)));
      for (let i = 0; i < 9; i++) sh.push(scrawl(r, -8, -A4H + 3 + i * 2.4, r.range(9, 16)));
      return { sh, tx: [], w: A4W, h: A4H, gy: 3 };
    }
    // lying: the pile's edge, sheets sticking out, and the top sheet seen from above
    const k = q.n > 1 ? Math.min(q.n, 40) : 7, t = 0.35, W = 30, H = k * t, sh: Shape[] = [];
    for (let i = 0; i < 2; i++) { const y = -r.range(0.2, H - 0.2), sx = r.chance(0.5) ? 1 : -1; sh.push(S(rect(sx > 0 ? W / 2 - 3 : -W / 2 - 1.2, y - 0.3, 4.2, 0.3), WHITE)); }
    sh.push(S(rect(-W / 2, -H, W, H), "#F3EFE6"), ring(pathOf(Array.from({ length: k - 1 }, (_, i) => [-W / 2 + r.range(0, 0.6), -(i + 1) * t, W / 2 - r.range(0, 0.6), -(i + 1) * t])), "#B9B2A6", 0.06, 0.8),
      S(poly([[-W / 2, -H], [W / 2, -H], [W / 2 - 2, -H - 7], [-W / 2 + 2, -H - 7]]), WHITE), ...bars(r, -W / 2 + 4.5, -H - 6.2, W - 9, 6, 0.95, INK, 0.22, 0.4));
    return { sh, tx: [], w: W + 2, h: H + 7 };
  },
  family_tree(q) {
    const { r } = q, w = 60, h = 44, c = q.c ?? r.pick(["#F6E7B8", "#DCEFD9", "#E3EEF7", "#F8DCD3"]), o = page(q, w, h, c, false), nm = q.names ?? [], m = nm.length, bh = 5.4;
    const rows = q.rows ?? (m <= 3 ? [2, 1] : m <= 5 ? [2, 3] : m <= 7 ? [2, 3, 2] : [2, 4, 4]), R = rows.length, crown: Pt[] = [];
    // the tree behind it, cut from paper; the title on top
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; crown.push([Math.cos(a) * 27 * r.range(0.92, 1.04), -22 + Math.sin(a) * 15 * r.range(0.88, 1.04)]); }
    o.sh.push(P([[-3.5, 0, 0], [-2.5, -12], [-9, -20], [-1.5, -15], [0, -24], [1.5, -15], [9, -20], [2.5, -12], [3.5, 0, 0]], "#9C7A54"), P(crown, mix(c, "#7FB069", 0.45)));
    for (const sx of [-1, 1]) o.sh.push(flatS(rect(-3, -0.9, 6, 1.8).transform(mul(translate(sx * (w / 2 - 1.5), -h + 0.6), rotate(sx * 0.6))), "#F0E2C8", 0.75));
    if (q.title) o.tx.push(T(q.title, -20, -h + 1, 40, 3.8, { font: "hand", color: INK, size: 2.4, weight: 700 }));
    // generations: the couple on top, a bar to their children, and on down from the middle child
    const pos = rows.map((k, j) => { const sp = Math.min(15, 56 / k); return Array.from({ length: k }, (_, i) => [(i - (k - 1) / 2) * sp, -38 + (j + 0.5) * 34 / R, Math.min(12, sp - 2)]); }), ln: number[][] = [];
    for (let j = 0; j + 1 < R; j++) {
      const a = pos[j], b = pos[j + 1], ya = a[0][1], yb = b[0][1] - bh / 2, pair = j === 0 && a.length === 2, from = pair ? (a[0][0] + a[1][0]) / 2 : a[Math.floor((a.length - 1) / 2)][0], yBar = (ya + bh / 2 + yb) / 2;
      if (pair) ln.push([a[0][0], ya, a[1][0], ya]);
      ln.push([from, pair ? ya : ya + bh / 2, from, yBar], [Math.min(from, b[0][0]), yBar, Math.max(from, b[b.length - 1][0]), yBar], ...b.map(([x]) => [x, yBar, x, yb]));
    }
    o.sh.push(ring(pathOf(ln), "#5A4636", 0.3, 0.9));
    pos.flat().forEach(([x, y, bw], k) => {
      const b = rrect(x - bw / 2, y - bh / 2, bw, bh, 0.6);
      if (k === q.missing) return void o.sh.push(ring(b, INK, 0.2, 0.75, [0.8, 0.6]));
      o.sh.push(S(b, WHITE), flatS(rect(x - bw / 2, y - bh / 2, bw, 1.2), r.pick(BOLD), 0.85, { clip: b }));
      if (nm[k]) o.tx.push(T(nm[k], x - bw / 2 + 0.4, y - bh / 2 + 1.3, bw - 0.8, bh - 1.6, { font: "hand", color: INK, size: 1.6 }));
      else o.sh.push(scrawl(r, x - bw / 2 + 1.5, y + 0.6, bw - 3, INK, 0.3));
    });
    return o;
  },
  crown(q) {
    const { r } = q, w = 24, c = q.c ?? "#E8B931", pts: Pt[] = [[-w / 2, 0, 0]], J = ["#C8372D", "#2E6FB6", "#2E9E5B"];
    for (let i = 0; i <= 8; i++) pts.push([-w / 2 + i * w / 8, i % 2 ? -6.5 : i === 4 ? -13 : -11.5, 0]);
    pts.push([w / 2, 0, 0]);
    const cr = P(pts, c), o: Out = { sh: [...(q.flag ? flagOn(7.4, -20.5, 6) : []), cr, flatS(rect(-w / 2, -3.4, w, 3.4), tone(c, "shade"), 0.35, { clip: cr.path }), flatS(rect(-w / 2, -13, w * 0.4, 13), tone(c, "light"), 0.3, { clip: cr.path })], tx: [], w, h: q.flag ? 20.5 : 13 };
    for (let i = 0; i < 3; i++) o.sh.push(S(ellipse((i - 1) * 6, i === 1 ? -9.6 : -8.6, 0.85), J[i]), S(ellipse((i - 1) * 7, -1.7, 1, 0.75), J[(i + 1) % 3]));
    o.sh.push(...bars(r, -w / 2 + 1, -5, w - 2, 1, 0.5, "#FFF6D8", 0.5, 0.4));
    return o;
  },
  napkin(q) {
    const { r } = q, s = 16, c = q.c ?? "#FBFAF6", ws = words(q), dots = new Path();
    for (let i = 0; i < 18; i++) { const t = -7 + i * 14 / 17; dots.add(ellipse(t, -15, 0.2)).add(ellipse(t, -1, 0.2)).add(ellipse(-7, -8 + t, 0.2)).add(ellipse(7, -8 + t, 0.2)); }
    const o: Out = { sh: [P([[-s / 2, 0, 0], [s / 2, 0, 0], [s / 2 + 0.2, -s, 0], [-s / 2 - 0.1, -s + 0.2, 0]], c), flatS(dots, "#B8C4CE", 0.6), flatS(rect(0, -s, s / 2, s / 2), tone(c, "shade"), 0.1), ring(pathOf([[0, -s, 0, 0], [-s / 2, -s / 2, s / 2, -s / 2]]), tone(c, "shade"), 0.1, 0.5)], tx: [], w: s, h: s };
    if (r.chance(0.5)) { const x = r.range(-4, 4), y = r.range(-12, -4); o.sh.push(flatS(ellipse(x, y, 2.6).add(ellipse(x + 0.15, y, 2.2)), "#A0784F", 0.28, { evenodd: true })); }
    if (ws.length) { const k = Math.min(ws.length, 3), g = Math.min(4, 9 / k); o.tx.push(...rowsOf(ws, -6.4, -8 - g * k / 2, 12.8, g, { font: "hand", color: PEN, size: g * 0.7 }, 3)); }
    return o;
  },
  flash_card(q) {
    const { r } = q, w = 12, h = 7.5, o = page(q, w, h, WHITE, false), pic = q.picture ? picture(q.picture, -3.2, -3.4, 4.4) : [], x = pic.length ? -0.6 : -5.4, tw = pic.length ? 6.2 : 10.8;
    o.sh.push(flatS(rect(-w / 2, -h, w, 1.1), q.c ?? r.pick(BOLD), 0.9), ...pic);
    if (r.chance(0.4)) o.sh.push(S(ellipse(-w / 2 + 0.8, -h + 0.55, 0.3), tone(WHITE, "deep")));
    if (q.label) o.tx.push(T(q.label, x, -h + 1.5, tw, h - 2.1, { ...PRINT, weight: 700, size: 1.7 }));
    else o.sh.push(...bars(r, x + tw * 0.15, -3.9, tw * 0.7, 1, 1.4, INK, 0.35, 0.6, true));
    return o;
  },
  clipboard(q) {
    const { r } = q, w = 23, h = 32, wood = q.c ?? "#A07A50", board = rrect(-w / 2, -h, w, h, 1.2), ws = words(q), g = 1.75, y0 = -26.2, n = 13, sg: number[][] = [], tick = new Path();
    const o: Out = { sh: [S(board, wood), flatS(rect(w / 2 - 3, -h, 3, h), tone(wood, "shade"), 0.3, { clip: board }), ...sheet(r, 21, 28.6, WHITE, false, 0, -1), flatS(rect(-9.8, -27.8, 19.6, 1.6), "#DCE4EC"), ...bars(r, -9.4, -27.4, 6, 1, 0.9, NAVY, 0.45)], tx: [], w, h: h + 0.6 };
    for (let i = 0; i <= n; i++) sg.push([-9.8, y0 + i * g, 9.8, y0 + i * g]);
    sg.push([3.4, -27.8, 3.4, y0 + n * g], [6.6, -27.8, 6.6, y0 + n * g]);
    for (let i = 0; i < n; i++) {
      const y = y0 + i * g;
      if (ws.length ? !ws[i] : i > 8) continue;
      if (!ws.length) o.sh.push(...bars(r, -9.4, y + 0.6, r.range(5, 11), 1, 1, INK, 0.3));
      if (r.chance(0.8)) tick.moveTo(4.4, y + 0.9).lineTo(4.9, y + 1.35).lineTo(5.8, y + 0.4); else tick.moveTo(4.5, y + 0.4).lineTo(5.6, y + 1.35).moveTo(5.6, y + 0.4).lineTo(4.5, y + 1.35);
    }
    o.sh.push(ring(pathOf(sg), "#7E8A96", 0.06, 0.8), ring(tick, RED, 0.16, 0.9), S(rrect(-5.5, -h - 0.6, 11, 3.8, 0.8), STEEL), S(rrect(-3.8, -h + 1.4, 7.6, 1.4, 0.6), tone(STEEL, "deep")), flatS(ellipse(-4.6, -h + 0.5, 0.35).add(ellipse(4.6, -h + 0.5, 0.35)), tone(STEEL, "light")));
    o.tx.push(...rowsOf(ws, -9.6, y0, 12.8, g, { ...HAND, size: 1.05 }, n));
    return o;
  },
  clock_face(q) {
    const { r } = q, R = 14, cy = -R, c = q.c ?? r.pick(["#C4553A", "#2E6FB6", "#E0A83A", "#2F8C88"]), [hh, mm] = (/^(\d{1,2})[:.](\d{2})$/.exec(q.time ?? "") ?? ["", "10", "10"]).slice(1).map(Number), ticks: number[][] = [], big: number[][] = [];
    const o: Out = { sh: [S(ellipse(0, cy, R), c), flatS(ellipse(0, cy, R), tone(c, "shade"), 0.3, { clip: rect(0, -2 * R, R, 2 * R) }), S(ellipse(0, cy, R - 1.6), WHITE)], tx: [], w: 2 * R, h: 2 * R };
    for (let i = 0; i < 60; i++) { const a = i * Math.PI / 30, s = Math.sin(a), k = -Math.cos(a), r0 = R - (i % 5 ? 2.5 : 3.2), r1 = R - 2; (i % 5 ? ticks : big).push([s * r0, cy + k * r0, s * r1, cy + k * r1]); }
    o.sh.push(ring(pathOf(ticks), INK, 0.1, 0.6), ring(pathOf(big), INK, 0.3, 0.85));
    for (let i = 1; i <= 12; i++) { const a = i * Math.PI / 6; o.tx.push(T(String(i), Math.sin(a) * (R - 5.2) - 1.6, cy - Math.cos(a) * (R - 5.2) - 1.2, 3.2, 2.4, { ...PRINT, weight: 700, size: 1.9 })); }
    // the hands turn on a brass split pin
    const hand = (a: number, L: number, d: number, col: string) => S(poly([[-d / 2, 1.4], [-d / 2, -L + d * 1.6], [-d * 1.1, -L + d * 1.6], [0, -L], [d * 1.1, -L + d * 1.6], [d / 2, -L + d * 1.6], [d / 2, 1.4]]).transform(mul(translate(0, cy), rotate(a))), col);
    o.sh.push(hand(((hh % 12) + mm / 60) * Math.PI / 6, 6.4, 1.1, NAVY), hand(mm * Math.PI / 30, 9.6, 0.7, RED), S(ellipse(0, cy, 0.8), GOLD), flatS(ellipse(-0.25, cy - 0.25, 0.3), "#FFF6D8", 0.8));
    return o;
  },
  label(q) {
    const { r } = q, w = 20, h = 7, c = q.c ?? CREAM, ac = r.pick(["#4E7A68", "#A23F28", NAVY]), b = rrect(-w / 2, -h, w, h, 0.7), ws = words(q);
    const o: Out = { sh: [S(b, c), flatS(rect(w / 2 - 3, -h, 3, h), tone(c, "shade"), 0.15, { clip: b }), ring(rrect(-w / 2 + 0.6, -h + 0.6, w - 1.2, h - 1.2, 0.5), ac, 0.14, 0.8), ring(rrect(-w / 2 + 0.95, -h + 0.95, w - 1.9, h - 1.9, 0.35), ac, 0.05, 0.6)], tx: [], w, h };
    if (ws.length) { const g = 4.8 / Math.min(ws.length, 3); o.tx.push(...rowsOf(ws, -w / 2 + 1.4, -h + 1.1, w - 2.8, g, { font: "hand", color: INK, size: Math.min(1.5, g * 0.6) }, 3)); }
    else o.sh.push(...bars(r, -6, -4.2, 12, 1, 1.4, INK, 0.3, 0.6, true));
    return o;
  },
  price_tag(q) {
    const { r } = q, w = 11, h = 7, st = 14, c = q.c ?? r.pick(["#F1E3C2", "#FFF27A", "#C9E8A0", "#FFB8CC", "#FFFFFF", "#F6C46A"]), j = () => r.range(-0.3, 0.3), top = -st - h + 0.5;
    const o: Out = { sh: [S(poly([[-0.35, -st - h * 0.7], [0.35, -st - h * 0.7], [0.35, -1.2], [0, 0], [-0.35, -1.2]]), WOOD), P([[-w / 2 + j(), -st, 0], [w / 2 + j(), -st + j(), 0], [w / 2 + j(), -st - h, 0], [-w / 2 + j(), -st - h + j(), 0]], c)], tx: [], w, h: st + h + 0.3, gy: 5 };
    // "Domates · kilo 80 TL": the name, then the price
    const [a, ...b] = q.lines.length ? q.lines.filter(Boolean) : q.label.split(/\s*·\s*/).filter(Boolean);
    if (b.length) o.tx.push(T(a, -w / 2 + 0.8, top, w - 1.6, 2.4, { font: "hand", color: INK, size: 1.5 }), T(b.join(" "), -w / 2 + 0.8, top + 2.4, w - 1.6, 3.6, { font: "hand", color: RED, weight: 700, size: 2.3 }));
    else if (a) o.tx.push(T(a, -w / 2 + 0.8, top + 0.3, w - 1.6, 5.4, { font: "hand", color: INK, weight: 700, size: 2.3 }));
    else o.sh.push(...bars(r, -3.5, top + 3, 7, 1, 1.6, RED, 0.5, 0.6, true));
    return o;
  },
  flat_ad(q) {
    const { r } = q, w = 15, h = 21, tab = 3, k = 7, tw = w / k, gone = r.int(0, k - 1), bc = q.c ?? r.pick(["#C8372D", "#2E6FB6", "#2E8B57", "#E07A1F"]), ws = q.label ? q.label.split(/\s*·\s*/) : q.lines, ph = new Path(), win = new Path();
    const o: Out = { sh: sheet(r, w, h - tab, WHITE, false, 0, -tab), tx: [], w, h };
    // tear-off strips with the phone number, one or two already taken
    for (let i = 0; i < k; i++) if (i !== gone && !(i === gone + 2 && r.chance(0.5))) { o.sh.push(S(rect(-w / 2 + i * tw + 0.08, -tab, tw - 0.16, tab), WHITE)); ph.add(rrect(-w / 2 + i * tw + tw / 2 - 0.15, -tab + 0.4, 0.3, tab - 0.8, 0.15)); }
    // the header band, a photo of the building, the details
    for (let i = 0; i < 3; i++) for (let jj = 0; jj < 3; jj++) win.add(rect(-5.4 + i * 1.1, -13.7 + jj * 1.1, 0.6, 0.7));
    o.sh.push(flatS(ph, INK, 0.3), flatS(rect(-w / 2, -h + 1.4, w, 3.4), bc), flatS(rect(-6.6, -15.4, 6.2, 4.8), "#BFD3DC"), flatS(rect(-5.8, -14.2, 3.6, 3.6), r.pick(["#E8B9A3", "#E9CF9E", "#CFE0CF"])),
      flatS(rect(-2, -12.6, 1.5, 2), "#D9C7DA"), flatS(win, "#55657A", 0.8), ...bars(r, 0.4, -15, 6.2, 3, 1.5));
    if (q.title) o.tx.push(T(q.title, -w / 2 + 0.6, -h + 1.6, w - 1.2, 3, { ...PRINT, color: "#FFFFFF", weight: 800, size: 2 })); else o.sh.push(...bars(r, -4, -h + 2.6, 8, 1, 1.2, "#FFFFFF", 0.8, 0.6, true));
    o.tx.push(...ws.slice(0, 4).flatMap((s, i) => s ? [T(s, -6.6, -10.2 + i * 1.65, 13.2, 1.65, { ...PRINT, align: "left", size: 1.15, ...(/TL|₺/.test(s) ? { weight: 700, color: bc } : {}) })] : []));
    if (!ws.length) o.sh.push(...bars(r, -6.6, -9.8, 13.2, 4, 1.5));
    // the pin it hangs by
    o.sh.push(flatS(ellipse(0.3, -h + 0.95, 0.75), INK, 0.2), S(ellipse(0, -h + 0.7, 0.7), r.pick(["#C8372D", "#2E6FB6", "#F2C14E"])));
    return o;
  },
};

/** Copies side by side on their bottom edges (`gap` of the first one's width apart), or held: the first at the grip, the rest fanned behind it. One flat, all the words on it; a line written `~~so~~` is struck through. */
function lay(id: string, outs: Out[], held: boolean, front: boolean, edge: number, drop = false, gap = 0.1): PieceOut {
  const sh: Shape[] = [], tx: TextSpec[] = [], top = outs[0];
  const put = (o: Out, m: Affine, w: boolean) => { sh.push(...mv(o.sh, m)); if (w) tx.push(...o.tx.map(t => ({ ...t, x: t.x + m[4], y: t.y + m[5] }))); };
  if (held) {
    const g = translate(top.gx ?? 0, top.gy ?? Math.min(4, top.h * 0.12));
    outs.slice(1).forEach((o, i) => put(o, mul(rotate((i % 2 ? 1 : -1) * (0.12 + 0.1 * Math.floor(i / 2))), g), false));
    put(top, g, true);
  } else {
    const d = top.w * gap, W = outs.reduce((s, o) => s + o.w + d, -d);
    let x = -W / 2;
    for (const o of outs) { put(o, translate(x + o.w / 2, 0), true); x += o.w + d; }
  }
  // a line written ~~so~~ is crossed out with the pen that wrote it
  for (const t of tx) {
    const m = /^~~(.+)~~$/.exec(t.text);
    if (!m) continue;
    const l = Math.min(t.w, m[1].length * (t.size ?? t.h * 0.6) * 0.55), x = t.align === "left" ? t.x : t.align === "right" ? t.x + t.w - l : t.x + (t.w - l) / 2;
    t.text = m[1];
    sh.push(ring(pathOf([[x - 0.2, t.y + t.h * 0.56, x + l + 0.2, t.y + t.h * 0.5]]), t.color ?? INK, 0.16, 0.9));
  }
  const group = { shapes: sh, edge }, [x0, y0, x1, y1] = groupBounds(group);
  const ppcm = Math.min(Math.min(10, Math.max(4, 300 / Math.max(top.w, top.h))), 1900 / Math.max(x1 - x0, y1 - y0, 1));
  return { flats: [{ group, ppcm, id, ...(held && (front || top.show) ? { front: true } : {}), ...(drop && !held ? { shadow: "drop" as const } : {}), ...(tx.length ? { text: tx } : {}) }] };
}

/**
 * Paper things, by `kind` (each a variant): `plain` (the default: a printed sheet, or `lines` written on it), a coloured
 * `sheet`, an appointment `slip`, a queue `number_slip` (its big number the `label`), an official `form` (`fields` printed
 * on the left, `lines` filling in, `signed`), a rental `contract` (field `lines`, `signed`, and a dashed stamp box that
 * `stamped` fills), an `exam` (`label` the reading passage, `lines` the answers, `score` in red), an official `document`,
 * a closed `envelope` (a name as `label`), a greeting `card` (folded, a drawing and `title` on the front; `open`, or any
 * `lines`, shows it open and written in), a sticky `note`, a shopping `list` (`lines` growing, `title`), a `stack` of
 * papers (`n` sheets; held, a sheaf), a `family_tree` (`names` in boxes by generation `rows`, e.g. [2, 3, 2], the box
 * `missing` dashed and empty, `title`), a paper `crown` (`flag`: a small Turkish flag stuck in it), a café `napkin`, a
 * `flash_card` (the word as `label`, a `picture`: bird, house, tea, apple), a `clipboard` with a mark sheet, a cardboard
 * `clock_face` (`time` "H:MM" sets its hands), a `label` card (a proverb), a `price_tag` on a stick ("Domates · kilo 80 TL":
 * the name, then the price), a `flat_ad` pinned up (`title` on its band, the `label`'s parts one per line, tear-off strips).
 * Words: `title`, `label` (or `text`), `lines` (a line written `~~21.000~~` is crossed out); `color` is the paper's. `n` copies lie side by side, each with its own
 * `labels[i]` (`times[i]` for clocks; number slips count up from their number). Held, it is shown in front, several
 * fanned with the words on the top one; a stack is cradled.
 */
const paper: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "plain"), f = Object.hasOwn(PAPER, kind) ? PAPER[kind] : PAPER.plain, held = !!p.held, n = kind === "stack" ? 1 : cnt(p.n, 12);
  const labels = list(p.labels), times = list(p.times), label = str(p.label, str(p.text, "")).trim(), rows = Array.isArray(p.rows) ? p.rows.map(Number).filter(v => v >= 1 && v <= 6).map(Math.round) : [];
  const outs = Array.from({ length: n }, (_, i) => f({
    r, held, n: cnt(p.n, 40), c: typeof p.color === "string" ? kit.color(p.color) : undefined, title: str(p.title, "").trim(), lines: i ? [] : list(p.lines),
    label: labels[i] || (!i ? label : kind === "number_slip" && /^\d+$/.test(label) ? String(+label + i) : ""), fields: list(p.fields), names: list(p.names), rows: rows.length ? rows : undefined,
    missing: num(p.missing, -1), stamped: !!p.stamped, signed: !!p.signed, open: typeof p.open === "boolean" ? p.open : undefined, picture: str(p.picture, ""), time: times[i] || str(p.time, "10:10"), score: str(p.score, "").trim(), flag: !!p.flag,
  }));
  return lay("paper", outs, held, kind !== "stack", 0.25, kind === "family_tree" || kind === "flat_ad");
}, variants: { ...Object.fromEntries(Object.keys(PAPER).filter(k => k !== "plain").map(k => [k, { kind: k }])), crown: { kind: "crown", flag: true }, contract: { kind: "contract", title: "KİRA SÖZLEŞMESİ" }, flat_ad: { kind: "flat_ad", title: "KİRALIK" } },
  meta: {
    about: "Paper things: sheets, slips, forms, contracts, exams, envelopes, cards, notes, lists, a family tree, a paper crown, price tags, ads.",
    params: {
      kind: { type: "enum", values: ["plain", "sheet", "slip", "number_slip", "form", "contract", "exam", "document", "envelope", "card", "note", "list", "stack", "family_tree", "crown", "napkin", "flash_card", "clipboard", "clock_face", "label", "price_tag", "flat_ad"], default: "plain" },
      n: { type: "int", min: 1, max: 40, default: 1, about: "copies side by side (≤ 12); a stack's sheets (≤ 40)" },
      title: { type: "text", about: "a heading, a card's front, a flat ad's band" },
      label: { type: "text", about: "the main words (a slip's number, an envelope's name, an exam's passage, a price tag's \"Domates · kilo 80 TL\")" },
      text: { type: "text", about: "the same as label, when label is not given" },
      lines: { type: "list", about: "lines written in, one per ruled line; a blank one leaves it empty; ~~so~~ crosses one out" },
      labels: { type: "list", about: "each copy's label" },
      color: { type: "color", about: "the paper's; default seeded or white" },
      fields: { type: "list", about: "form: the printed field names" },
      signed: { type: "bool", default: false, about: "form, contract: signed" },
      stamped: { type: "bool", default: false, about: "contract: its stamp box stamped" },
      score: { type: "text", about: "exam: the mark in red" },
      open: { type: "bool", about: "card: shown open; default open when it has lines" },
      names: { type: "list", about: "family_tree: names in the boxes" },
      rows: { type: "list", about: "family_tree: boxes per generation, e.g. [2, 3, 2]" },
      missing: { type: "int", about: "family_tree: the box left dashed and empty (index)" },
      flag: { type: "bool", default: false, about: "crown: a small Turkish flag stuck in it" },
      picture: { type: "text", about: "flash_card: bird, house, tea or apple (Turkish words too); else a sun over hills" },
      time: { type: "text", default: "10:10", about: "clock_face: \"H:MM\"" },
      times: { type: "list", about: "clock_face: each copy's time" },
    },
    terms: ["a1-w-form", "a1-w-sozlesme", "a1-w-sinav", "a1-w-liste", "a2-w-not", "a1-w-randevu", "a2-w-ilan"],
    tags: ["paper"],
  } };

// ---- Books -----------------------------------------------------------------------------------

/** A closed book face on: the board `w` × `h` in `c` with a spine band and a hinge, the page block `t` thick showing past its right edge (`soft`: a paper cover, flush). */
function cover(w: number, h: number, t: number, c: string, soft = false): Shape[] {
  const x = -w / 2, pg = soft ? 0 : Math.min(1.6, t * 0.35), b = rrect(x, -h, w, h, soft ? 0.25 : 0.5), out: Shape[] = [];
  if (pg) out.push(S(rect(w / 2 - 0.6, -h + 0.25, pg + 0.6, h - 0.25), tone(c, "deep")), S(rect(w / 2 - 0.6, -h + 0.55, pg + 0.3, h - 1.1), CREAM), ring(pathOf([[w / 2 + pg * 0.3, -h + 0.8, w / 2 + pg * 0.3, -0.8], [w / 2 + pg * 0.65, -h + 0.8, w / 2 + pg * 0.65, -0.8]]), "#C9B994", 0.06, 0.8));
  out.push(S(b, c), flatS(rect(x, -h, w * 0.1, h), tone(c, "shade"), 0.5, { clip: b }), ring(pathOf([[x + w * 0.12, -h + 0.3, x + w * 0.12, -0.3]]), tone(c, "deep"), 0.12, 0.45),
    flatS(rect(w / 2 - w * 0.14, -h, w * 0.14, h), tone(c, "shade"), 0.18, { clip: b }), flatS(rect(x, -h, w, 0.5), tone(c, "light"), 0.35, { clip: b }));
  return out;
}
const closed = (sh: Shape[], w: number, h: number, t: number): Out => ({ sh, tx: [], w: w + Math.min(1.6, t * 0.35), h, gx: w / 2 - 1.5, gy: h * 0.4 });
/** A dictionary's thumb index: notches cut in the fore-edge. */
function thumbs(w: number, h: number, t: number, k: number): Shape {
  const pg = Math.min(1.6, t * 0.35), cut = new Path();
  for (let i = 0; i < k; i++) cut.add(ellipse(w / 2 + pg, -h + 1.6 + (i + 0.5) * (h - 3.2) / k, 0.5, 0.65));
  return flatS(cut, "#3A3D45", 0.75, { clip: rect(w / 2 - 0.6, -h + 0.55, pg + 0.3, h - 1.1) });
}
/** A spiral binding down x from y0, `len` long. */
function coil(x: number, y0: number, len: number): Shape[] {
  const holes = new Path(), loops = new Path();
  for (let y = y0 + 0.5; y < y0 + len; y += 1) { holes.add(ellipse(x + 0.6, y, 0.22)); loops.moveTo(x + 0.6, y).cubicTo(x + 0.2, y - 0.6, x - 1, y - 0.55, x - 1, y + 0.1); }
  return [flatS(holes, "#3A3D45", 0.8), { path: loops, stroke: { color: "#8E979E", width: 0.22, cap: "round" }, flat: true }];
}
/** A city's silhouette over the foot y: low roofs, a dome with two minarets, a round tower: a language workbook's cover art. */
function skyline(w: number, y: number, c: string): Shape {
  const sil = rect(-w / 2, y - 1.6, w, 1.6).add(ellipse(-2, y - 1.6, 3, 2.4)).add(rect(-2.4, y - 5, 0.8, 1.2)).add(rect(4, y - 7, 1.8, 6)).add(poly([[3.8, y - 7], [6, y - 7], [4.9, y - 9.2]]));
  for (const mx of [-6, 2]) sil.add(rect(mx - 0.3, y - 7.2, 0.6, 6)).add(poly([[mx - 0.4, y - 7.2], [mx + 0.4, y - 7.2], [mx, y - 8.6]]));
  for (const [bx, bh] of [[-w / 2, 3], [-w / 2 + 2.4, 4.2], [w / 2 - 3.2, 3.6]]) sil.add(rect(bx, y - bh, 2.6, bh));
  return flatS(sil, c, 0.55);
}
/** A book open flat: two pages `w` × `h` on the cover's edges in `c`, ruled for `style` (lines, a diary's hours, a workbook's exercises), the `lines` written in hand from the left page on. */
function pages(q: Q, w: number, h: number, c: string, bind: "spiral" | "staple" | "sewn", style: "lines" | "diary" | "work"): Out {
  const { r } = q, o: Out = { sh: [S(rrect(-w - 0.5, -h - 0.5, 2 * w + 1, h + 0.5, 0.5), c), S(rect(-w, -h - 0.2, w, h), WHITE), S(rect(0, -h - 0.2, w, h), WHITE), flatS(rect(-1.5, -h, 3, h), "#8E877C", 0.12)], tx: [], w: 2 * w + 1, h: h + 0.5, gy: 3, show: true };
  const g = 2, at: number[][] = [], rules: number[][] = [], margins: number[][] = [];
  for (const px of [-w, 0]) {
    let y = -h + 1.6;
    if (style === "lines") margins.push([px + 2, -h + 0.6, px + 2, -1]);
    else { if (style === "work") o.sh.push(flatS(rrect(px + 1.2, y, 1.4, 1.4, 0.3), c)); o.sh.push(...bars(r, px + (style === "work" ? 3 : 1.4), y + 0.2, w - 5, 1, 1.2, style === "work" ? INK : c, 0.5)); y += 2.4; }
    for (let i = 0; y + g < -0.8; i++, y += g) {
      if (style === "work" && i % 4 === 3) { o.sh.push(flatS(rrect(px + 1.2, y + 0.2, 1.1, 1.1, 0.25), c, 0.7), ...bars(r, px + 2.8, y + 0.4, w - 5, 1, 0.9)); continue; }
      const x = px + (style === "diary" ? 2.6 : 2.2);
      at.push([x, y, px + w - 0.8 - x]);
      rules.push([px + 0.8, y + g, px + w - 0.8, y + g]);
      if (style === "diary" && i % 2 === 0) o.sh.push(...bars(r, px + 0.8, y + 0.6, 1.2, 1, 0.8));
    }
  }
  o.sh.push(ring(pathOf(rules), "#8DB8DA", 0.07, 0.8), ring(pathOf(margins), "#E58FA0", 0.08, 0.8));
  if (bind === "spiral") o.sh.push(...coil(-0.4, -h, h - 0.4)); else if (bind === "staple") o.sh.push(flatS(rect(-0.12, -h * 0.72, 0.24, 2.2).add(rect(-0.12, -h * 0.3, 0.24, 2.2)), "#8E979E"));
  q.lines.forEach((s, i) => { if (s && i < at.length) o.tx.push(T(s, at[i][0], at[i][1], at[i][2], g, { ...HAND, size: 1.3 })); });
  return o;
}

const BOOK: Record<string, Kind> = {
  book(q) {
    const { r } = q, w = 16, h = 23, c = q.c ?? r.pick(BOOKS), o = closed(cover(w, h, 3, c), w, h, 3), k = r.int(0, 2), g = "#E6C877";
    if (k === 0) o.sh.push(ring(rrect(-w / 2 + 2.4, -h + 1.2, w - 3.6, h - 2.4, 0.4), g, 0.15, 0.85));
    else if (k === 1) o.sh.push(flatS(poly([[0.8, -12], [3.6, -9], [0.8, -6], [-2, -9]]), g, 0.8));
    else o.sh.push(flatS(rect(-w / 2 + 1.6, -h + 2, w - 1.6, 0.5).add(rect(-w / 2 + 1.6, -2.5, w - 1.6, 0.5)), g, 0.8));
    titled(o, r, q.label, -w / 2 + 2.8, -h + 3.6, w - 4.6, 5, onC(c));
    return o;
  },
  small(q) {
    const { r } = q, w = 10.5, h = 15, c = q.c ?? r.pick(["#C8372D", "#1F5FC0", "#2E8B57", "#E07A1F"]), o = closed(cover(w, h, 3.6, c), w, h, 3.6);
    o.sh.push(flatS(rect(-w / 2 + 1.1, -h + 3.6, w - 1.1, 4.4), WHITE, 0.95), flatS(rect(-w / 2 + 1.1, -3, w - 1.1, 0.6), WHITE, 0.8), thumbs(w, h, 3.6, 4));
    titled(o, r, q.label, -w / 2 + 1.4, -h + 3.8, w - 1.8, 4, INK);
    return o;
  },
  dictionary(q) {
    const { r } = q, w = 16.5, h = 24, c = q.c ?? r.pick(["#A23F28", "#2E3A59", "#2E5237", "#1F5FC0"]), o = closed(cover(w, h, 5.5, c), w, h, 5.5);
    // two colours split on the diagonal: two languages
    o.sh.push(flatS(poly([[w / 2, -h * 0.55], [w / 2, 0], [-w / 2 + 1.6, 0]]), r.pick(["#E0A83A", "#F2C14E", "#E8E2D4", "#8DB8DA"]), 0.9, { clip: rrect(-w / 2, -h, w, h, 0.5) }), thumbs(w, h, 5.5, 6));
    titled(o, r, q.label, -w / 2 + 2.4, -h + 3.5, w - 4, 5, INK, WHITE);
    return o;
  },
  notebook(q) {
    const { r } = q, w = 16, h = 21.5, c = q.c ?? r.pick(["#2F8C88", "#E58FA0", "#4F6E9E", "#E0A83A", "#7A3E6E", "#C4553A", "#9CD3C0"]), spiral = q.spiral ?? r.chance(0.5);
    if (q.open ?? q.lines.length > 0) return pages(q, w, h, c, spiral ? "spiral" : "staple", "lines");
    const o = closed(q.tabs ? BRIGHT.slice(0, 4).map((t, i) => S(rrect(w / 2 - 1, -h + 3 + i * 3.2, 2.4, 2.2, 0.4), t)) : [], w, h, 0);
    o.sh.push(...cover(w, h, 0, c, true), ...(spiral ? coil(-w / 2 + 0.6, -h, h) : [flatS(rect(-w / 2, -h, 1.6, h), tone(c, "deep"), 0.85)]),
      S(rrect(-4, -h + 3.5, 10, 4.6, 0.4), WHITE), ring(pathOf([[-3.4, -h + 5.6, 5.4, -h + 5.6], [-3.4, -h + 7.2, 5.4, -h + 7.2]]), "#8DB8DA", 0.07, 0.8));
    if (q.label) o.tx.push(T(q.label, -3.6, -h + 3.8, 9.2, 4, { ...HAND, align: "center", size: 1.4 }));
    if (q.tabs) o.w += 1.4;
    return o;
  },
  diary(q) {
    const { r } = q, w = 15, h = 21, c = q.c ?? r.pick(["#6A1E32", "#2E3A59", "#26272C", "#6B4A35", "#2E5237"]);
    if (q.open ?? q.lines.length > 0) { const o = pages(q, w, h, c, "sewn", "diary"); o.sh.push(S(poly([[-0.1, -h - 0.4], [0.6, -h - 0.4], [-0.7, -0.3], [-1.4, -0.3]]), RED)); return o; }
    // the ribbon peeks out at the top; an elastic holds it shut
    const o = closed([S(poly([[-3.4, -h + 0.5], [-2.4, -h + 0.5], [-2.3, -h - 2.6], [-2.85, -h - 2], [-3.5, -h - 2.6]]), RED), ...cover(w, h, 2, c)], w, h, 2);
    o.sh.push(S(rect(w / 2 - 2.4, -h, 0.8, h), tone(c, "deep")), flatS(rrect(-w / 2 + 2.6, -h + 2.6, w - 6.6, 3.2, 0.3), tone(c, "light"), 0.35));
    titled(o, r, q.label, -w / 2 + 2.6, -h + 2.6, w - 6.6, 3.2, GOLD);
    o.h += 2.6;
    return o;
  },
  workbook(q) {
    const { r } = q, w = 19, h = 26, c = q.c ?? r.pick(["#E07A1F", "#2F8C88", "#C8372D", "#4F6E9E", "#7A3E6E"]);
    if (q.open ?? q.lines.length > 0) return pages(q, w, h, c, "staple", "work");
    const o = closed(cover(w, h, 0, c, true), w, h, 0);
    o.sh.push(flatS(rect(-w / 2, -h + 1.5, w, 5), WHITE, 0.95), skyline(w, 0, tone(c, "deep")));
    titled(o, r, q.label, -w / 2 + 1.6, -h + 1.8, w - 3.2, 4.4, INK);
    if (q.level) { o.sh.push(S(ellipse(w / 2 - 3.8, -h + 10.6, 2.5), WHITE)); o.tx.push(T(q.level, w / 2 - 5.6, -h + 9.4, 3.6, 2.4, { ...PRINT, weight: 800, color: c, size: 1.9 })); }
    return o;
  },
  booklet(q) {
    const { r } = q, w = 14.8, h = 21, c = q.c ?? r.pick(["#8DB8DA", "#F2B705", "#9CD3C0", "#E58FA0"]), b = rect(-w / 2, -h, w, h * 0.58), o = closed(cover(w, h, 0, WHITE, true), w, h, 0);
    // a map pin on the coloured half: a guide; two staples in the fold
    o.sh.push(flatS(b, c), flatS(smooth([[0, -h + 11.6, 0], [-2.3, -h + 7], [0, -h + 4.6], [2.3, -h + 7]]).add(ellipse(0, -h + 6.9, 0.9)), WHITE, 0.95, { evenodd: true }),
      ring(pathOf([[-w / 2 + 0.7, -h, -w / 2 + 0.7, 0]]), "#B9B2A6", 0.06, 0.8), flatS(rect(-w / 2 + 0.25, -h * 0.78, 0.25, 2.2).add(rect(-w / 2 + 0.25, -h * 0.3, 0.25, 2.2)), "#8E979E"), ...bars(r, -w / 2 + 1.8, -4.4, w - 3.6, 2, 1.1));
    titled(o, r, q.label, -w / 2 + 1.4, -h * 0.42 + 0.6, w - 2.8, 3.8, INK);
    return o;
  },
  folder(q) {
    const { r } = q, w = 24, h = 32, c = q.c ?? r.pick(["#D9B77E", "#2E6FB6", "#2E8B57", "#C8372D", "#3A3D45"]), fr = P([[-w / 2, 0, 0], [w / 2, 0, 0], [w / 2, -h + 1.6, 0], [2.6, -h + 1.6, 0], [0, -h + 3], [-2.6, -h + 1.6, 0], [-w / 2, -h + 1.6, 0]], c);
    // the back with its tab, papers peeking out, the front with a thumb cut, a label window and the corner elastics
    const o: Out = { sh: [S(rrect(-w / 2 + 0.6, -h - 0.2, w, h + 0.2, 0.6), tone(c, "shade")), S(rrect(w / 2 - 8, -h - 2, 6, 3, 0.6), tone(c, "shade"))], tx: [], w: w + 0.6, h: h + 2, gx: w / 2 - 1.5, gy: h * 0.4 };
    for (let i = 0; i < 3; i++) { const x = r.range(-1.6, 1.6), t = -h + r.range(0.1, 1.3); o.sh.push(...sheet(r, 21, 20, i % 2 ? WHITE : "#F3EFE6", false, x, t + 20), ...bars(r, x - 8, t + 0.5, 15, 1, 0.8, INK, 0.25)); }
    const el = (y0: number, d: number) => S(poly([[w / 2 - 4.6, y0], [w / 2 - 3.6, y0], [w / 2, y0 + d * 3.6], [w / 2, y0 + d * 4.6]]), "#26272C");
    o.sh.push(fr, flatS(rect(w / 2 - 3.2, -h, 3.2, h), tone(c, "shade"), 0.25, { clip: fr.path }), S(rrect(-6.5, -h + 6, 13, 4.6, 0.3), "#F4F1EA"), el(-h + 1.6, 1), el(0, -1));
    titled(o, r, q.label, -6.3, -h + 6.2, 12.6, 4.2, INK);
    return o;
  },
  passport(q) {
    const { r } = q, w = 9, h = 12.5, o = closed(cover(w, h, 0, q.c ?? "#6A1E32", true), w, h, 0);
    // gold on burgundy: a made-up crest (never the real emblem), the word under it, the chip mark
    o.sh.push(...crest(0, -h * 0.55, 1.7, GOLD), ...bars(r, -2.2, -h * 0.55 + 2.4, 4.4, 1, 0.8, GOLD, 0.85, 0.55, true), ring(rrect(-0.8, -2.4, 1.6, 1.1, 0.2), GOLD, 0.1, 0.9), ring(ellipse(0, -1.85, 0.3), GOLD, 0.08, 0.9));
    titled(o, r, q.label, -w / 2 + 1, -h + 0.9, w - 2, 2.6, GOLD);
    return o;
  },
  stack(q) {
    // books lying one on another, spines out; `labels` on the spines, the top book's first
    const { r } = q, k = q.n > 1 ? Math.min(q.n, 12) : 3, L = Array.from({ length: k }, () => r.range(19, 27)).sort((a, b) => b - a), o: Out = { sh: [], tx: [], w: L[0] + 4, h: 0, gy: 2 };
    let y = 0;
    for (let i = 0; i < k; i++) {
      const t = r.range(2.7, 4.4), x = r.range(-1.8, 1.8), c = r.pick(BOOKS), b = rrect(x - L[i] / 2, y - t, L[i], t, 0.4), lab = q.labels?.[k - 1 - i];
      o.sh.push(S(b, c), flatS(rect(x - L[i] / 2, y - t, L[i], t * 0.22), tone(c, "light"), 0.3, { clip: b }), flatS(rect(x - L[i] / 2 + 1.5, y - t, 0.5, t).add(rect(x + L[i] / 2 - 2, y - t, 0.5, t)), GOLD, 0.7), flatS(rect(x - 4.5, y - t + 0.5, 9, t - 1), mix(c, WHITE, 0.75), 0.9));
      if (lab) o.tx.push(T(lab, x - 4.3, y - t + 0.55, 8.6, t - 1.1, { ...PRINT, weight: 700 }));
      y -= t;
    }
    o.h = -y;
    return o;
  },
};
/** Books standing in a row, spines out (a shelf's worth): seeded heights, colours and bands. */
function spines(q: Q): Out {
  const { r } = q, o: Out = { sh: [], tx: [], w: 0, h: 0 };
  let x = 0;
  for (let i = 0; i < q.n; i++) {
    const t = r.range(2.6, 5.2), hh = r.range(19, 28), c = q.c && !i ? q.c : r.pick(BOOKS);
    o.sh.push(S(rect(x, -hh, t, hh), c), flatS(rect(x, -hh + 1.2, t, 0.5).add(rect(x, -2.4, t, 0.5)), r.chance(0.5) ? GOLD : tone(c, "light"), 0.75), flatS(rect(x + t * 0.7, -hh, t * 0.3, hh), tone(c, "shade"), 0.3),
      ...(r.chance(0.6) ? [flatS(rect(x + t * 0.2, -hh * 0.72, t * 0.6, hh * 0.3), mix(c, WHITE, 0.6), 0.6)] : []));
    x += t + 0.15; o.h = Math.max(o.h, hh);
  }
  o.sh = mv(o.sh, translate(-x / 2, 0)); o.w = x;
  return o;
}

/**
 * Bound things, by `kind` (each a variant): a hardback `book` (the default: seeded `color` and gilt), a `small` pocket
 * dictionary, a thick `dictionary` (two-colour cover, thumb index), a school `notebook` (`spiral` or stapled, a name plate,
 * coloured `tabs`), an agenda `diary` (elastic, ribbon), a course `workbook` (a city skyline, `level` in a badge), a stapled
 * `booklet` (a guide), a document `folder` (papers peeking, corner elastics, a label window), a `passport` (burgundy, a
 * stylised crest, never a real emblem), a `stack` of `n` books lying, spines out (`labels` on them, the top one's first).
 * Face on, standing, its `title` (or `label`) on the cover; a notebook, diary or workbook `open` (or given `lines`, or
 * `text`) lies open with them written in (a line written `~~so~~` is crossed out). A plain `book` with `n` is a row of spines; other kinds lie side by side. Held,
 * it hangs by its spine in the hand, cradled; open, it is shown in front.
 */
const book: PieceDef = { draw(p, r, kit) {
  const kind = str(p.kind, "book"), f = Object.hasOwn(BOOK, kind) ? BOOK[kind] : BOOK.book, held = !!p.held, n = cnt(p.n, 40), text = str(p.text, "").trim(), labels = list(p.labels), label = str(p.title, str(p.label, "")).trim();
  const q = (i: number): Q => ({ r, held, n, c: typeof p.color === "string" ? kit.color(p.color) : undefined, label: labels[i] || (i ? "" : label), labels, lines: i ? [] : text ? [text, ...list(p.lines)] : list(p.lines),
    open: typeof p.open === "boolean" ? p.open : undefined, spiral: typeof p.spiral === "boolean" ? p.spiral : undefined, tabs: !!p.tabs, level: str(p.level, "").trim() });
  const outs = kind === "stack" ? [f(q(0))] : kind === "book" && n > 1 ? [spines(q(0))] : Array.from({ length: Math.min(n, 12) }, (_, i) => f(q(i)));
  return lay("book", outs, held, false, 0.35);
}, variants: Object.fromEntries(Object.keys(BOOK).filter(k => k !== "book").map(k => [k, { kind: k }])),
  meta: {
    about: "Bound things: a book, dictionaries, a notebook, a diary, a workbook, a booklet, a folder, a passport, or a stack of books.",
    params: {
      kind: { type: "enum", values: ["book", "small", "dictionary", "notebook", "diary", "workbook", "booklet", "folder", "passport", "stack"], default: "book" },
      n: { type: "int", min: 1, max: 40, default: 1, about: "a row of spines (book), books in a stack (≤ 12), else copies side by side (≤ 12)" },
      title: { type: "text", about: "the words on the cover" },
      label: { type: "text", about: "the same as title, when title is not given" },
      labels: { type: "list", about: "each copy's cover words; a stack's spines, the top one's first" },
      text: { type: "text", about: "a first line written in (opens a notebook, diary or workbook)" },
      lines: { type: "list", about: "lines written in an open notebook, diary or workbook; ~~so~~ crosses one out" },
      open: { type: "bool", about: "notebook, diary, workbook lie open; default open when they have lines" },
      color: { type: "color", about: "the cover's; default seeded" },
      spiral: { type: "bool", about: "notebook: spiral bound, else stapled; default seeded" },
      tabs: { type: "bool", default: false, about: "notebook: coloured tabs" },
      level: { type: "text", about: "workbook: the level in a badge (A1, B1…)" },
    },
    terms: ["a1-w-defter", "a1-w-sozluk", "a2-w-pasaport", "a1-w-dosya"],
    tags: ["paper"],
  } };

// ---- Photos, pens, pins ------------------------------------------------------------------------

/** A faceless paper person in a photo, feet at (x, y), `fh` tall: a coat, a head, hair or a headscarf (flat, inside the print). */
function figure(r: Rng, x: number, y: number, fh: number, tint: (c: string) => string, clip: Path): Shape[] {
  const hr = fh * 0.13, sw = fh * 0.2, top = y - fh, scarf = r.chance(0.25), o = { flat: true, clip };
  return [
    P([[x - sw, y, 0], [x - sw * 0.95, top + hr * 2.7], [x - sw * 0.6, top + hr * 2.1], [x + sw * 0.6, top + hr * 2.1], [x + sw * 0.95, top + hr * 2.7], [x + sw, y, 0]], tint(FABRIC[r.pick(CROWD_FABRIC)]), o),
    ...(scarf ? [S(ellipse(x, top + hr * 1.1, hr * 1.3, hr * 1.4), tint(FABRIC[r.pick(CROWD_FABRIC)]), o)] : []),
    S(ellipse(x, top + hr * 1.05, hr * (scarf ? 0.8 : 1)), tint(r.pick(Object.values(SKIN))), o),
    ...(scarf ? [] : [S(ellipse(x, top + hr * 0.7, hr * 1.04, hr * 0.75), tint(r.pick(Object.values(HAIR))), { ...o, clip: [clip, rect(x - hr * 1.2, top - hr, hr * 2.4, hr * 1.55)] })]),
  ];
}
/** One photograph: a white border round a seeded snapshot (people, a street, the sea); `old`: sepia, deckle-edged, a crease. */
function snap(r: Rng, old: boolean, scene: string): Out {
  const w = old ? 11 : 15, h = old ? 8.5 : 10, m = old ? 0.8 : 0.6, tint = (c: string) => old ? mix("#3B2A1C", "#EBD9B4", luma(c)) : c;
  const ix = -w / 2 + m, iy = -h + m, iw = w - 2 * m, ih = h - 2 * m - (old ? 0.3 : 0), img = rect(ix, iy, iw, ih), yg = iy + ih * 0.66, o = { flat: true, clip: img };
  const edge: Vec2[] = [];
  if (old) for (const [a, b, nx, ny] of [[[-w / 2, 0], [-w / 2, -h], 1, 0], [[-w / 2, -h], [w / 2, -h], 0, 1], [[w / 2, -h], [w / 2, 0], -1, 0], [[w / 2, 0], [-w / 2, 0], 0, -1]] as [Vec2, Vec2, number, number][])
    for (let i = 0; i < 18; i++) edge.push([a[0] + (b[0] - a[0]) * i / 18 + nx * 0.2 * (i % 2), a[1] + (b[1] - a[1]) * i / 18 + ny * 0.2 * (i % 2)]);
  const sh: Shape[] = [S(old ? poly(edge) : rect(-w / 2, -h, w, h), old ? "#EFE3C8" : WHITE), S(img, tint("#A9CBE3"), o)], s = scene || r.pick(["people", "street", "sea"]);
  if (s === "sea") {
    const far = new Path().add(poly([[ix, iy + ih * 0.5], [ix, iy + ih * 0.42], [ix + iw * 0.3, iy + ih * 0.36], [ix + iw * 0.6, iy + ih * 0.44], [ix + iw, iy + ih * 0.38], [ix + iw, iy + ih * 0.5]])).add(rect(ix + iw * 0.7, iy + ih * 0.24, 0.35, ih * 0.2));
    sh.push(S(far, tint("#8FA39A"), o), S(rect(ix, iy + ih * 0.5, iw, ih), tint("#4F7FA6"), o), S(poly([[ix + iw * 0.2, iy + ih * 0.6], [ix + iw * 0.48, iy + ih * 0.6], [ix + iw * 0.45, iy + ih * 0.66], [ix + iw * 0.23, iy + ih * 0.66]]), tint("#F4F1EA"), o),
      S(rect(ix + iw * 0.31, iy + ih * 0.53, iw * 0.04, ih * 0.07), tint("#C8372D"), o), S(rect(ix, yg + ih * 0.12, iw, ih), tint("#C9B79A"), o), ...figure(r, ix + iw * 0.72, iy + ih + 0.4, ih * 0.6, tint, img));
  } else {
    sh.push(S(rect(ix, yg, iw, ih), tint(s === "street" ? "#B9B2A6" : "#9DB98A"), o));
    if (s === "street") for (let x = ix - 0.5; x < ix + iw; x += r.range(2.6, 3.6)) { const hh = r.range(ih * 0.4, ih * 0.62), win = new Path(); for (let k = 0; k < 2; k++) win.add(rect(x + 0.6 + k * 1.2, yg - hh + 1, 0.6, 0.8)); sh.push(S(rect(x, yg - hh, 3, hh), tint(r.pick(["#E9CF9E", "#E8B9A3", "#CFE0CF", "#D9C7DA"])), o), S(win, tint("#55657A"), o)); }
    const k = s === "street" ? 1 : r.int(2, 4);
    for (let i = 0; i < k; i++) sh.push(...figure(r, ix + iw * (k === 1 ? 0.6 : (i + 0.5) / k), yg + ih * 0.3, ih * (r.chance(0.25) ? 0.42 : 0.62), tint, img));
  }
  sh.push(flatS(poly([[ix, iy], [ix + iw * 0.35, iy], [ix, iy + ih * 0.5]]), "#FFFFFF", 0.12, { clip: img }), ...(old ? [ring(pathOf([[w / 2 - 3, -h, w / 2, -h + 2.4]]), "#FFFFFF", 0.1, 0.5)] : []));
  return { sh, tx: [], w, h };
}

/**
 * Loose photographs: a white border round a seeded snapshot (`scene`: people, street or sea) of faceless paper people; `n`
 * of them lie overlapping, each turned a little. `frame: "sepia"` (the variant `sepia`) is an old one, brown and deckle-edged,
 * for Feriköy long ago. Held, it is shown in front.
 */
const photo: PieceDef = { draw(p, r) {
  const n = cnt(p.n, 12), held = !!p.held, old = str(p.frame, "") === "sepia", scene = str(p.scene, "");
  const outs = Array.from({ length: n }, () => snap(r, old, scene)).map((o, i) => n > 1 && !held ? { ...o, sh: mv(o.sh, rotate(r.range(-0.09, 0.09) + (i % 2 ? 0.04 : -0.04))) } : o);
  return lay("photo", outs, held, true, 0.2, false, -0.18);
}, variants: { sepia: { frame: "sepia" } },
  meta: {
    about: "Loose photographs of faceless paper people, a street or the sea, lying overlapping; or an old sepia one.",
    params: {
      n: { type: "int", min: 1, max: 12, default: 1, about: "how many" },
      frame: { type: "enum", values: ["white", "sepia"], default: "white", about: "sepia: old, brown and deckle-edged" },
      scene: { type: "enum", values: ["people", "street", "sea"], about: "default seeded" },
    },
    terms: ["a1-w-fotograf"],
    tags: ["paper"],
  } };

/**
 * A ballpoint pen lying on its side (a seeded colour, capped or not), or a whiteboard `marker` (`kind: "marker"`, its cap in
 * `color`). `n` lie in a loose heap; held, it is in the fist ready to write, the tip down.
 */
const pen: PieceDef = { draw(p, r, kit) {
  const marker = str(p.kind, "") === "marker", n = cnt(p.n, 12), held = !!p.held, c0 = typeof p.color === "string" ? kit.color(p.color) : undefined, L = marker ? 13 : 14.5, d = marker ? 1.9 : 0.95, sh: Shape[] = [];
  const one = (): Shape[] => {
    const c = c0 ?? r.pick(marker ? ["#26272C", "#2E6FB6", "#C8372D", "#2E8B57"] : ["#1F3F8F", "#26272C", "#C0392B", "#F4F4F2"]), x0 = -L / 2;
    if (marker) return [S(rrect(x0 - 0.4, -d * 0.8, 1, d * 0.6, 0.2), c), S(rrect(x0, -d, L * 0.74, d, 0.5), "#EDEDEA"), flatS(rect(x0 + L * 0.3, -d, L * 0.2, d), c, 0.85), flatS(rect(x0, -d * 0.35, L * 0.74, d * 0.35), "#9AA0A6", 0.2),
      S(rrect(L / 2 - L * 0.3, -d - 0.1, L * 0.3, d + 0.2, 0.5), c), ring(pathOf([[L / 2 - L * 0.22, -d, L / 2 - L * 0.22, 0], [L / 2 - L * 0.17, -d, L / 2 - L * 0.17, 0]]), tone(c, "deep"), 0.12, 0.7)];
    // a white barrel takes a blue cap and end
    const cap = r.chance(0.5), ink = c === "#F4F4F2" ? "#1F3F8F" : c;
    return [S(rrect(x0 - 0.3, -d * 0.8, 0.8, d * 0.6, 0.2), ink), S(rrect(x0, -d, L * 0.86, d, d / 2), c), flatS(rect(x0, -d, L * 0.86, d * 0.28), "#FFFFFF", 0.25),
      S(poly([[L / 2 - L * 0.15, -d], [L / 2 - 0.25, -d * 0.62], [L / 2 - 0.25, -d * 0.38], [L / 2 - L * 0.15, 0]]), "#C9CDD2"), S(ellipse(L / 2 - 0.2, -d / 2, 0.15), "#3A3D45"),
      ...(cap ? [S(rrect(L / 2 - L * 0.34, -d - 0.08, L * 0.34, d + 0.16, d / 2), ink), S(rect(L / 2 - L * 0.32, -d - 0.32, L * 0.24, 0.3), STEEL)] : [])];
  };
  for (let i = 0; i < n; i++) sh.push(...mv(one(), held ? mul(rotate(Math.PI / 2 + 0.35 + (i - (n - 1) / 2) * 0.12), translate(-L * 0.2, d / 2)) : mul(translate(r.range(-1.2, 1.2), -i * (d + 0.1)), rotate(r.range(-0.04, 0.04)))));
  return { flats: [{ group: { shapes: sh, edge: 0.15 }, ppcm: 10, id: "pen" }] };
}, variants: { marker: { kind: "marker" } },
  meta: {
    about: "A ballpoint pen lying on its side, capped or not, or a whiteboard marker; several lie in a loose heap.",
    params: {
      kind: { type: "enum", values: ["pen", "marker"], default: "pen" },
      n: { type: "int", min: 1, max: 12, default: 1, about: "how many" },
      color: { type: "color", about: "the barrel's (a marker's cap); default seeded" },
    },
    terms: ["a1-w-kalem"],
    tags: ["paper"],
  } };

/**
 * Map pins with round heads, `n` in a row, in `colors[i]`, `color` or seeded colours, seen head on as they stand in a wall map; a
 * `label` (or `labels[i]`) puts a small paper flag with the name beside a head. Held, the pins are side on in the fingers.
 */
const pin: PieceDef = { draw(p, r, kit) {
  const n = cnt(p.n, 20), labels = list(p.labels), label = str(p.label, "").trim(), cs = list(p.colors), c0 = typeof p.color === "string" ? kit.color(p.color) : undefined, sh: Shape[] = [], tx: TextSpec[] = [];
  let k = 0;
  const col = () => { const c = cs[k++]; return c ? kit.color(c) : c0 ?? r.pick(["#C8372D", "#2E6FB6", "#F2C14E", "#2E9E5B", "#F4F1EA"]); };
  if (p.held) {
    for (let i = 0; i < n; i++) { const c = col(); sh.push(...mv([S(rect(-0.08, -3, 0.16, 3), STEEL), S(rrect(-0.35, -3.9, 0.7, 1, 0.2), c), S(ellipse(0, -4.9, 1), c), flatS(ellipse(-0.35, -5.25, 0.3), "#FFFFFF", 0.6)], mul(rotate((i - (n - 1) / 2) * 0.25), translate(0, 2)))); }
    return { flats: [{ group: { shapes: sh, edge: 0.15 }, ppcm: 10, id: "pin" }] };
  }
  let x = 0;
  for (let i = 0; i < n; i++) {
    const c = col(), lab = labels[i] || (i ? "" : label), lw = lab ? Math.min(14, 2 + lab.length * 0.75) : 0;
    if (lab) { sh.push(S(rect(x + 0.8, -2.8, lw, 2.2), WHITE)); tx.push(T(lab, x + 1.6, -2.7, lw - 0.9, 2, { ...PRINT, size: 1.2 })); }
    sh.push(flatS(ellipse(x + 0.35, -0.9, 1), INK, 0.22), S(ellipse(x, -1.2, 1), c), flatS(ellipse(x + 0.3, -0.95, 0.7), tone(c, "shade"), 0.45, { clip: ellipse(x, -1.2, 1) }), flatS(ellipse(x - 0.35, -1.55, 0.3), "#FFFFFF", 0.7));
    x += 3 + lw;
  }
  const dx = -(x - 3) / 2;
  return { flats: [{ group: { shapes: mv(sh, translate(dx, 0)), edge: 0.15 }, ppcm: 10, id: "pin", ...(tx.length ? { text: tx.map(t => ({ ...t, x: t.x + dx })) } : {}) }] };
}, meta: {
  about: "Map pins with round heads in a row, as they stand in a wall map, a small paper flag with a name beside one.",
  params: {
    n: { type: "int", min: 1, max: 20, default: 1, about: "how many" },
    color: { type: "color", about: "all the heads'; default seeded" },
    colors: { type: "list", about: "each head's colour" },
    label: { type: "text", about: "a name on a flag by the first pin" },
    labels: { type: "list", about: "each pin's flag" },
  },
  terms: ["a1-w-harita"],
  tags: ["paper"],
} };

/** The family's set pieces and props (`index.ts`). */
export const set: Record<string, PieceDef> = {};
export const props: Record<string, PieceDef> = { paper, book, photo, pen, pin };
