// Shapes and groups: the unit of paper art. A group is one cut-paper piece built from layered
// shapes. Drawing it adds the paper look: a lighter cut rim around each layer and a tiny soft
// shadow under every layer that sits on another one.

import { boxPad, boxUnion, type Box } from "../core/math.ts";
import { tone } from "../core/color.ts";
import { svgNums, svgList, svgGeom, type Path } from "./path.ts";

export interface Shape {
  path: Path;
  fill?: string;
  /** A stroke instead of, or as well as, a fill (lines on a face, stitching, a book's spine). */
  stroke?: { color: string; width: number; cap?: CanvasLineCap; join?: CanvasLineJoin; dash?: number[] };
  opacity?: number;
  /** Flat: no rim and no shadow (blush, print, glints, shadows painted in the art). */
  flat?: boolean;
  /** Even-odd fill, for holes. */
  evenodd?: boolean;
  /**
   * The shape is drawn only inside this path, rim and shadow included (hair under a hat, a fabric
   * pattern); a list is the region inside all of them (hair under a kippah and a beanie).
   */
  clip?: Path | Path[];
  /**
   * A repeating print (a fabric pattern): the shape is filled with the tile's shapes, repeated every
   * `w` × `h` cm from (`x`, `y`), instead of `fill`. Always flat. One fill per tile shape on a canvas
   * (every repeat in one path), one `<pattern>` in SVG, so a gingham dress costs little anywhere.
   */
  tile?: Tile;
}

/** A tile of flat shapes in its own cm frame, (0, 0) … (w, h); shapes may reach past it (a dot cut at the edge is drawn whole by its neighbour). */
export interface Tile { w: number; h: number; x?: number; y?: number; shapes: Shape[] }

/** At most this many repeats of a tile are drawn for one shape: a tile too small for its shape draws nothing rather than freeze. */
const MAX_REPEATS = 8000;

/** The repeats of a tile that cover a box: their offsets (each tile's (0, 0)), or none when there would be too many. */
export function tileOffsets(t: Tile, b: Box): [number, number][] {
  const out: [number, number][] = [];
  if (!(t.w > 0.05) || !(t.h > 0.05) || !b.every(Number.isFinite)) return out;
  const x = t.x ?? 0, y = t.y ?? 0, i0 = Math.floor((b[0] - x) / t.w) - 1, i1 = Math.ceil((b[2] - x) / t.w), j0 = Math.floor((b[1] - y) / t.h) - 1, j1 = Math.ceil((b[3] - y) / t.h);
  if ((i1 - i0 + 1) * (j1 - j0 + 1) > MAX_REPEATS) return out;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) out.push([x + i * t.w, y + j * t.h]);
  return out;
}

export interface Group {
  shapes: Shape[];
  /** Width of the paper rim in cm (default 0.45); 0 turns it off. */
  edge?: number;
  /** Words painted over the shapes (`paintText`): a sign's, a label's, a screen's (DESIGN.md §6.8). */
  text?: GroupText[];
}

/**
 * A box of words in a group, cm: `text` laid out in `family` at up to `size` cm (default h × 0.45), wrapped at spaces and
 * shrunk (×0.88, down to 0.35 of it) until it fits the box, lines 1.15 apart, centred down the box and set `align` across it.
 */
export interface GroupText { text: string; x: number; y: number; w: number; h: number; size?: number; color?: string; align?: "left" | "center" | "right"; weight?: number; family?: string }

export const DEFAULT_EDGE = 0.45;
const LIFT = { dx: 0.18, dy: 0.32, blur: 0.55, alpha: 0.22 };

/** A shape's clip paths as a list (none, one or several: the shape shows only inside all of them). */
export const clipsOf = (s: Pick<Shape, "clip">): Path[] => (!s.clip ? [] : Array.isArray(s.clip) ? s.clip : [s.clip]);

export function shapeBounds(s: Shape, edge: number): Box {
  const pad = Math.max(s.stroke ? s.stroke.width / 2 : 0, s.flat ? 0 : edge, s.flat ? 0 : LIFT.blur + LIFT.dy);
  const b = boxPad(s.path.bounds(), pad + 0.1);
  // nothing shows outside a clip
  let r: Box = b;
  for (const p of clipsOf(s)) { const c = boxPad(p.bounds(), 0.1); r = [Math.max(r[0], c[0]), Math.max(r[1], c[1]), Math.min(r[2], c[2]), Math.min(r[3], c[3])]; }
  return r[2] > r[0] && r[3] > r[1] ? r : b;
}

export function groupBounds(g: Group): Box {
  const edge = g.edge ?? DEFAULT_EDGE;
  let b: Box | null = null;
  for (const s of g.shapes) b = boxUnion(b, shapeBounds(s, edge));
  for (const t of g.text ?? []) b = boxUnion(b, [t.x, t.y, t.x + t.w, t.y + t.h]);
  return b ?? [0, 0, 1, 1];
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/**
 * Draw a group into a 2D context whose transform already maps centimetres to pixels.
 * `pxPerCm` sets the blur sizes, which canvas measures in device pixels.
 */
export function drawGroup(ctx: Ctx, g: Group, pxPerCm: number) {
  const edge = g.edge ?? DEFAULT_EDGE;
  g.shapes.forEach((s, i) => {
    ctx.save();
    ctx.globalAlpha = s.opacity ?? 1;
    const rule: CanvasFillRule = s.evenodd ? "evenodd" : "nonzero";
    for (const c of clipsOf(s)) { ctx.beginPath(); c.trace(ctx); ctx.clip(); }
    if (s.tile) {
      // the print: inside the shape, every repeat of a tile shape in one path and one fill
      ctx.beginPath(); s.path.trace(ctx); ctx.clip(rule);
      const at = tileOffsets(s.tile, s.path.bounds());
      for (const t of s.tile.shapes) {
        if (!t.fill) continue;
        ctx.beginPath();
        for (const [dx, dy] of at) { ctx.translate(dx, dy); t.path.trace(ctx); ctx.translate(-dx, -dy); }
        ctx.globalAlpha = (s.opacity ?? 1) * (t.opacity ?? 1);
        ctx.fillStyle = t.fill;
        ctx.fill(t.evenodd ? "evenodd" : "nonzero");
      }
      ctx.restore();
      return;
    }
    ctx.beginPath();
    s.path.trace(ctx);
    if (s.fill) {
      if (!s.flat && i > 0) {
        // the soft shadow of a paper layer lying on the one below
        ctx.save();
        ctx.shadowColor = `rgba(40,24,16,${LIFT.alpha})`;
        ctx.shadowBlur = LIFT.blur * pxPerCm;
        ctx.shadowOffsetX = LIFT.dx * pxPerCm;
        ctx.shadowOffsetY = LIFT.dy * pxPerCm;
        ctx.fillStyle = s.fill;
        ctx.fill(rule);
        ctx.restore();
      }
      if (!s.flat && edge > 0) {
        ctx.lineJoin = "round";
        ctx.lineWidth = edge * 2;
        ctx.strokeStyle = tone(s.fill.slice(0, 7), "edge");
        ctx.stroke();
      }
      ctx.fillStyle = s.fill;
      ctx.fill(rule);
    }
    if (s.stroke) {
      ctx.lineWidth = s.stroke.width;
      ctx.lineCap = s.stroke.cap ?? "round";
      ctx.lineJoin = s.stroke.join ?? "round";
      ctx.strokeStyle = s.stroke.color;
      if (s.stroke.dash) ctx.setLineDash(s.stroke.dash);
      ctx.stroke();
    }
    ctx.restore();
  });
  for (const t of g.text ?? []) paintText(ctx, t, pxPerCm);
}

/** Lay out and paint a box of words (`GroupText`) in the group's cm frame, at `pxPerCm`: in pixels, so small type stays sharp. */
export function paintText(ctx: Ctx, t: GroupText, pxPerCm: number) {
  const words = t.text.trim();
  if (!words) return;
  ctx.save();
  ctx.scale(1 / pxPerCm, 1 / pxPerCm);
  const W = t.w * pxPerCm, H = t.h * pxPerCm, size0 = (t.size ?? t.h * 0.45) * pxPerCm, family = t.family || "system-ui, sans-serif";
  const lay = (px: number): string[] => {
    ctx.font = `${t.weight ?? 400} ${px}px ${family}`;
    const out: string[] = [];
    for (const para of words.split("\n")) {
      let line = "";
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const next = line ? line + " " + w : w;
        if (line && ctx.measureText(next).width > W) { out.push(line); line = w; } else line = next;
      }
      out.push(line);
    }
    return out;
  };
  let fit = 1, lines = lay(size0);
  for (; fit > 0.35; fit = Math.max(0.35, fit * 0.88)) {
    lines = lay(size0 * fit);
    if (lines.length * size0 * fit * 1.15 <= H + 0.5 && lines.every(l => ctx.measureText(l).width <= W + 0.5)) break;
  }
  const px = size0 * fit, lh = px * 1.15, top = t.y * pxPerCm + (H - lines.length * lh) / 2 + lh / 2, align = t.align ?? "center";
  const x = align === "left" ? t.x * pxPerCm : align === "right" ? (t.x + t.w) * pxPerCm : (t.x + t.w / 2) * pxPerCm;
  ctx.fillStyle = t.color ?? "#2B2420"; ctx.textAlign = align; ctx.textBaseline = "middle";
  lines.forEach((l, i) => ctx.fillText(l, x, top + i * lh));
  ctx.restore();
}

// ---- SVG ----------------------------------------------------------------------------------
// Shape data can come from a document somebody else wrote (a colour id that is really `#…`), so
// nothing is written into the markup unchecked: colours are `#hex` or dropped, numbers finite,
// keywords from short lists, ids reduced to word characters.

const HEX = /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i;

/** A colour that is safe to write into an attribute (`#rgb`, `#rrggbb`, `#rrggbbaa`, `none`, `transparent`), else null. */
export function svgColor(c: unknown): string | null {
  return typeof c === "string" && (HEX.test(c) || c === "none" || c === "transparent") ? c : null;
}

/** A colour that paints something: `svgColor` without `none` and `transparent`. */
export function svgPaint(c: unknown): string | null {
  const s = svgColor(c);
  return s && s[0] === "#" ? s : null;
}

/** An id (or a prefix of ids) with only letters, digits, `_` and `-`. */
export const svgId = (s: string) => String(s).replace(/[^\w-]/g, "");

const RIM_TAIL = ` stroke-linejoin="round" paint-order="stroke"`;
/**
 * What an ancestor `<g>` sets once so that no shape's rim need say it (see `SvgOptions.base`): no
 * stroke unless a shape asks, then a rim of twice the default edge, round joins, the stroke painted
 * under the fill. A `<g>` and not the `<svg>` itself, because a stylesheet rule on `svg` (an icon
 * rule with `stroke: …`) beats attributes on the root but not the ones of an element inside it.
 */
export const SVG_BASE = ` stroke="none" stroke-width="${svgNums([DEFAULT_EDGE * 2])}"` + RIM_TAIL;

export interface SvgOptions {
  /** The prefix of this group's clip path ids; the caller keeps it unique within the document. */
  id?: string;
  /** The id of the shared shadow filter (`shadowFilter`): while it is set, a layer lying on another casts the paper's soft shadow. */
  shadow?: string;
  /** Decimals of the coordinates (default 2). */
  digits?: number;
  /** An ancestor element carries `SVG_BASE`, so the output leaves those attributes out. */
  base?: boolean;
  /** The clip paths written so far, by path: a path that several shapes share (hair under a hat) is written once and the later shapes refer to it. Keep one table per coordinate system (per bone), since a clip is read in the user space of whoever refers to it. */
  clips?: Map<Path, string>;
  /** Leave out the small details: a flat shape or a bare stroke whose box is under this many units on its longer side (a highlight, a stitch, a glint), where it would be a pixel or less. */
  minDetail?: number;
  /** The tiles (`Shape.tile`) written as `<pattern>` so far: one table for the whole picture, since a tile is laid out in the user space of each shape that uses it. */
  tiles?: Map<Tile, string>;
}

/** The filter behind the layer shadow of `drawGroup`: define it once in `<defs>` and pass its id as `SvgOptions.shadow`. */
export function shadowFilter(id: string): string {
  const rgb = [40, 24, 16].map(v => v / 255);
  return `<filter id="${svgId(id)}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">` +
    `<feGaussianBlur stdDeviation="${svgNums([LIFT.blur / 2], 3)}"/><feOffset dx="${svgNums([LIFT.dx])}" dy="${svgNums([LIFT.dy])}"/>` +
    `<feColorMatrix values="0 0 0 0 ${svgNums([rgb[0]], 3)} 0 0 0 0 ${svgNums([rgb[1]], 3)} 0 0 0 0 ${svgNums([rgb[2]], 3)} 0 0 0 ${svgNums([LIFT.alpha])} 0"/></filter>`;
}

const CAPS = ["butt", "round", "square"], JOINS = ["miter", "round", "bevel"];

/**
 * The same group as SVG markup (the still backend and portraits): per shape the optional soft
 * shadow, the cut rim and the fill in one element (the rim is a stroke painted first), then the
 * stroke. Opacity covers rim and fill together, so a translucent shape does not double.
 */
export function groupSvg(g: Group, o: SvgOptions = {}): string {
  const edge = Math.max(0, Number(g.edge ?? DEFAULT_EDGE) || 0), id = svgId(o.id ?? "c"), dg = o.digits ?? 2;
  // consecutive shapes inside the same clips share one `<g clip-path>` (a clipped print or a hat's cut
  // hair is many shapes under one clip; a wrapper each was most of a portrait's size)
  let out = "", run: { clips: Path[]; body: string; id: string } | null = null;
  const flush = () => { if (run) out += clipSvg(run.clips, run.body, run.id, dg, o); run = null; };
  const emit = (s: Shape, body: string, sid: string) => {
    const clips = clipsOf(s);
    if (!clips.length) { flush(); out += body; return; }
    if (run && run.clips.length === clips.length && run.clips.every((c, k) => c === clips[k])) { run.body += body; return; }
    flush(); run = { clips, body, id: sid };
  };
  g.shapes.forEach((s, i) => {
    if (!s.path.finite() || clipsOf(s).some(c => !c.finite())) return;
    if (o.minDetail && (s.flat || !svgPaint(s.fill)) && !s.tile) {
      const [x0, y0, x1, y1] = s.path.bounds(), w = Math.max(x1 - x0, y1 - y0) + (s.stroke?.width ?? 0);
      if (w < o.minDetail) return;
    }
    if (s.tile) { const t = tileSvg(s, `${id}${i}`, dg, o); if (t) { out += t.def; emit(s, t.body, `${id}${i}c`); } return; }
    const geo = svgGeom(s.path, dg), fill = svgPaint(s.fill), st = s.stroke, ink = st && st.width > 0 && Number.isFinite(st.width) ? svgPaint(st.color) : null;
    const op = Number.isFinite(s.opacity) ? Math.min(1, s.opacity!) : 1;
    const parts: string[] = [];
    if (fill) {
      if (o.shadow && !s.flat && i > 0) parts.push(` fill="#000" filter="url(#${svgId(o.shadow)})"`);
      const rim = !s.flat && edge > 0 ? ` stroke="${tone(fill.slice(0, 7), "edge")}"` + (o.base && edge === DEFAULT_EDGE ? "" : ` stroke-width="${svgNums([edge * 2])}"`) + (o.base ? "" : RIM_TAIL) : "";
      parts.push(` fill="${fill}"${rim}${s.evenodd ? ` fill-rule="evenodd"` : ""}`);
    }
    if (ink) {
      const cap = CAPS.includes(st!.cap!) ? st!.cap! : "round", join = JOINS.includes(st!.join!) ? st!.join! : "round";
      const dash = st!.dash?.length && st!.dash.every(n => n >= 0 && Number.isFinite(n)) && st!.dash.some(n => n > 0) ? ` stroke-dasharray="${svgList(st!.dash)}"` : "";
      parts.push(` fill="none" stroke="${ink}" stroke-width="${svgNums([st!.width])}"${cap === "butt" ? "" : ` stroke-linecap="${cap}"`}${join === (o.base ? "round" : "miter") ? "" : ` stroke-linejoin="${join}"`}${dash}`);
    }
    if (!parts.length || op <= 0) return;
    const alpha = op < 1 ? ` opacity="${svgNums([op])}"` : "", el = (a: string) => `<${geo.tag}${geo.attrs}${a}/>`;
    let body = parts.length === 1 ? el(parts[0] + alpha) : (alpha ? `<g${alpha}>` : "") + parts.map(el).join("") + (alpha ? "</g>" : "");
    emit(s, body, `${id}${i}`);
  });
  flush();
  return out;
}

/** A printed shape as SVG: its tile as a `<pattern>` (written once per picture, `def`) and the shape filled with it (`body`, still to clip). */
function tileSvg(s: Shape, id: string, dg: number, o: SvgOptions): { def: string; body: string } | null {
  const t = s.tile!, n = (v: number) => svgNums([v], dg);
  if (!(t.w > 0.05) || !(t.h > 0.05) || ![t.w, t.h, t.x ?? 0, t.y ?? 0].every(Number.isFinite)) return null;
  let pid = o.tiles?.get(t), def = "";
  if (!pid) {
    pid = `${id}t`;
    o.tiles?.set(t, pid);
    const inner = t.shapes.map(ts => { const f = svgPaint(ts.fill); if (!f || !ts.path.finite()) return ""; const g = svgGeom(ts.path, dg); return `<${g.tag}${g.attrs} fill="${f}"${ts.evenodd ? ` fill-rule="evenodd"` : ""}/>`; }).join("");
    def = `<pattern id="${pid}" patternUnits="userSpaceOnUse" x="${n(t.x ?? 0)}" y="${n(t.y ?? 0)}" width="${n(t.w)}" height="${n(t.h)}">${inner}</pattern>`;
  }
  const geo = svgGeom(s.path, dg), op = Number.isFinite(s.opacity) ? Math.min(1, s.opacity!) : 1;
  if (op <= 0) return { def, body: "" };
  return { def, body: `<${geo.tag}${geo.attrs} fill="url(#${pid})"${s.evenodd ? ` fill-rule="evenodd"` : ""}${op < 1 ? ` opacity="${svgNums([op])}"` : ""}/>` };
}

/**
 * Markup inside a list of clips: one `<clipPath>` per path (written once per table, see
 * `SvgOptions.clips`) and one `<g clip-path>` per clip, nested, so a list clips to the region inside all.
 */
function clipSvg(clips: Path[], body: string, id: string, dg: number, o: SvgOptions): string {
  if (!body) return "";
  let defs = "";
  clips.forEach((c, k) => {
    let cid = o.clips?.get(c);
    if (!cid) {
      const cg = svgGeom(c, dg);
      cid = k ? `${id}k${k}` : id;
      o.clips?.set(c, cid);
      defs += `<clipPath id="${cid}"><${cg.tag}${cg.attrs}/></clipPath>`;
    }
    body = `<g clip-path="url(#${cid})">${body}</g>`;
  });
  return defs + body;
}
