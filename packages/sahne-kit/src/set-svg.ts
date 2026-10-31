// A set piece or prop drawn on its own as SVG (sahne-kit/set-svg: the gallery's sketch of a tile until the stage has drawn it,
// kit-sheet.ts, and backstage's prop gallery and its rendered sheets, server/render.ts):
// its flats, each moved by its offset; floor flats are shown as drawn, from above. `pieceSvg` is one piece;
// `kitSheetSvg` lays out labelled cells (each look, day and night, held and counted for a prop) with a grid and a person or a
// scale bar for scale, each zoomed to its item or all at one scale (`zoom`); `cellSheetSvg` the cells it is given, numbered,
// at a time of their motion (`t`) or cropped to a box (`focus`).

import { groupBounds, groupSvg, moveAt, rng, SVG_BASE, whenWeight, withVariant, type FlatSpec, type Kit, type PieceDef, type TextSpec } from "sahne";

/** The look a thumbnail shows: day, clear, the place in no state. */
const PLAIN = { time: { from: "day", to: "day", k: 1 }, weather: { from: "clear", to: "clear", k: 1 }, state: { from: [], to: [], k: 1 } };

/** What `pieceSvg` adds to the plain day sketch. */
export interface SvgOpts {
  /** Draw what glows at night (the emissive groups) over the art. */
  glow?: boolean;
  /** Write each flat's `text` as SVG `<text>`, so its words can be read (the stage lays them as HTML). */
  text?: boolean;
  /** Night: the day art dimmed and blued, with the glow over it (implies `glow`). */
  night?: boolean;
  /** A time on the place's clock (ms): each moving flat where its motion has it then, turned by its sway. Without it, every flat is at the start of its motion and never turned. */
  t?: number;
}

/** Face of the words written by `opts.text`: the stage's own, then what the renderer has. */
export const TEXT_FONT = "'Comic Neue', 'Helvetica Neue', Arial, sans-serif";
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

/** One `TextSpec` as SVG `<text>` in its flat's cm (x right, y down), shrunk to fit its box like the stage's `propText`. */
function textSvg(t: TextSpec): string {
  const lines = String(t.text).split("\n"), longest = Math.max(1, ...lines.map(l => l.length));
  const size = Math.min(t.size ?? t.h * 0.45, t.h / lines.length / 1.15, (t.w / longest) / 0.52);
  const anchor = t.align === "right" ? "end" : t.align === "left" ? "start" : "middle";
  const x = t.align === "right" ? t.x + t.w : t.align === "left" ? t.x : t.x + t.w / 2;
  const top = t.y + (t.h - size * 1.15 * lines.length) / 2;
  const spans = lines.map((l, i) => `<tspan x="${x}" y="${+(top + size * (0.9 + 1.15 * i)).toFixed(2)}">${esc(l)}</tspan>`).join("");
  return `<text font-family="${TEXT_FONT.replace(/'/g, "&apos;")}" font-size="${+size.toFixed(2)}" font-weight="${t.weight ?? 400}" fill="${esc(t.color ?? "#2B2420")}" text-anchor="${anchor}">${spans}</text>`;
}

/** A piece drawn in cm (y down): the art as SVG body and its bounds, or null when it draws nothing. */
export function pieceBody(kit: Kit, def: PieceDef, params: Record<string, unknown>, seed: string, ids = seed, opts: SvgOpts = {}) {
  const night = !!opts.night, glow = night || !!opts.glow;
  const out = def.draw(withVariant(def, params), rng(seed), kit);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, day = "", lit = "";
  // each flat where its motion has it at the start (walkers along their lanes, a gull on its way; of flats that take
  // turns, a stride or wings up and down, the one showing), only what shows by day in clear weather (no umbrellas,
  // no flags), the farthest first
  const t = opts.t;
  const shown = out.flats.map((f: FlatSpec, i) => {
    const m = f.move ? moveAt(f.move, t ?? 0) : { at: [0, 0, 0], dx: 0, dy: 0, rot: 0 };
    if (!m || (f.when && whenWeight(f.when, PLAIN) < 0.5)) return null;
    return { f, i, dx: (f.x ?? 0) + m.at[0] * 100 + m.dx, dy: -(f.y ?? 0) - m.at[1] * 100 - m.dy, z: (f.z ?? 0) + m.at[2] * 100, rot: t === undefined ? 0 : m.rot };
  }).filter(v => v !== null).sort((a, b) => a.z - b.z);
  // the reach: the art with its glow, which may stand out past it (a star on a top, a lamp's halo), so a sheet frames both
  let r0 = Infinity, r1 = Infinity, r2 = -Infinity, r3 = -Infinity;
  // a group's bounds where its flat puts them: turned about the flat's origin (a sway, at `t`), then moved
  const placed = (b: number[], dx: number, dy: number, rot: number): number[] => {
    if (!rot) return [b[0] + dx, b[1] + dy, b[2] + dx, b[3] + dy];
    const c = Math.cos(rot), s = Math.sin(rot), xs: number[] = [], ys: number[] = [];
    for (const [x, y] of [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]]) { xs.push(x * c - y * s + dx); ys.push(x * s + y * c + dy); }
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
  };
  for (const { f, i, dx, dy, rot } of shown) {
    const gb = groupBounds(f.group);
    if (!gb.every(Number.isFinite)) continue;
    const [bx0, by0, bx1, by1] = placed(gb, dx, dy, rot);
    x0 = Math.min(x0, bx0); y0 = Math.min(y0, by0); x1 = Math.max(x1, bx1); y1 = Math.max(y1, by1);
    const eb = f.emissive ? groupBounds(f.emissive) : null, [e0, e1, e2, e3] = eb && eb.every(Number.isFinite) ? placed(eb, dx, dy, rot) : [bx0, by0, bx1, by1];
    r0 = Math.min(r0, bx0, e0); r1 = Math.min(r1, by0, e1); r2 = Math.max(r2, bx1, e2); r3 = Math.max(r3, by1, e3);
    // SVG turns clockwise for a positive angle, as the stage's sway does (y down)
    const tf = `translate(${dx} ${dy})${rot ? ` rotate(${+(rot * 180 / Math.PI).toFixed(3)})` : ""}`;
    day += `<g transform="${tf}">${groupSvg(f.group, { id: `${ids}-${i}-` })}${opts.text ? (f.text ?? []).map(textSvg).join("") : ""}</g>`;
    if (glow && f.emissive) lit += `<g transform="${tf}">${groupSvg(f.emissive, { id: `${ids}-${i}-g-` })}</g>`;
  }
  // a flame the stage burns as particles (a candle's), drawn here as one still flame on its wick
  for (const e of out.emitters ?? []) {
    if (e.kind !== "flame") continue;
    const k = (e.w ?? 1.2) / 1.2, x = e.x, y = -e.y;
    x0 = Math.min(x0, x - 0.7 * k); x1 = Math.max(x1, x + 0.7 * k); y0 = Math.min(y0, y - 2.9 * k); y1 = Math.max(y1, y);
    lit += `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0-2.85C.5-1.9.65-1.2.5-.4.35 0-.35 0-.5-.4-.65-1.2-.5-1.9 0-2.85Z" fill="#FFC23C"/><path d="M0-1.85C.3-1.2.35-.7.2-.3S-.35-.15-.35-.7-.3-1.2 0-1.85Z" fill="#FFF2B8"/></g>`;
  }
  if (!day && !lit) return null;
  r0 = Math.min(r0, x0); r1 = Math.min(r1, y0); r2 = Math.max(r2, x1); r3 = Math.max(r3, y1);
  // night: the day art dimmed and blued by a filter, the glow and the flames over it
  const dimmed = night ? `<g filter="url(#${ids}-night)">${day}</g>` : day;
  const defs = night ? `<defs><filter id="${ids}-night" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".34 0 0 0 0  0 .38 0 0 .01  0 0 .62 0 .06  0 0 0 1 0"/></filter></defs>` : "";
  return { body: defs + dimmed + lit, bounds: [x0, y0, x1, y1] as [number, number, number, number], reach: [r0, r1, r2, r3] as [number, number, number, number] };
}

/** A piece's flats as one SVG, each moved by its offset (cm, y up), `px` across its longer side; "" when it draws nothing. `opts` (or `true`, `{glow: true}`) adds the glow, the words, or the night (SvgOpts). */
export function pieceSvg(kit: Kit, def: PieceDef, params: Record<string, unknown>, seed: string, px: number, opts: SvgOpts | boolean = false, ids = seed) {
  const a = pieceBody(kit, def, params, seed, ids, typeof opts === "boolean" ? { glow: opts } : opts);
  if (!a) return "";
  const [x0, y0, x1, y1] = a.bounds, w = x1 - x0, h = y1 - y0, k = px / Math.max(w, h);
  return `<svg viewBox="${x0} ${y0} ${w} ${h}" width="${Math.round(w * k)}" height="${Math.round(h * k)}" role="img"><g${SVG_BASE}>${a.body}</g></svg>`;
}

/** One thing on a sheet: a set piece or a prop, the looks to try beside its default (default: its variants, and for a prop `n: 3` and held). */
export interface SheetItem {
  id: string;
  def: PieceDef;
  kind: "set" | "props";
  looks?: [label: string, params: Record<string, unknown>][];
}

/** The looks a sheet shows of an item: its default, each variant, and for a prop three of it and held. */
export function sheetLooks(item: SheetItem): [string, Record<string, unknown>][] {
  if (item.looks) return item.looks;
  const out: [string, Record<string, unknown>][] = [["default", {}], ...Object.keys(item.def.variants ?? {}).map(v => [v, { variant: v }] as [string, Record<string, unknown>])];
  if (item.kind === "props") out.push(["n 3", { n: 3 }], ["held", { held: true }]);
  return out;
}

/** A box in an item's own cm, as its path data has them (the origin at its floor point, x right, y down: up is negative): [x0, y0, x1, y1]. */
export type CmBox = [number, number, number, number];

/** One cell of a sheet: an item in one look, by day or by night, at a time of its motion, maybe cropped to a box. */
export interface SheetCell {
  item: SheetItem;
  label: string;
  params: Record<string, unknown>;
  night?: boolean;
  /** A time on the place's clock, ms (`SvgOpts.t`): the moving flats where they are then. */
  t?: number;
  /** Show only this box of the item, as large as the cell allows (up to FOCUS_MAX_PX_PER_CM). */
  focus?: CmBox;
  /** Printed first in the caption, so the cells of a long list are named by number. */
  num?: number;
  /** Draw no art: this is why (an id the kit does not have), in red. */
  error?: string;
}

/** A person 170 cm tall, standing at (0, 0) with y down (cm): the scale every cell carries, since puppet scale is the first thing a drawing gets wrong. */
const ADULT = `<g fill="#59607A" fill-opacity=".34"><circle cx="0" cy="-159" r="10"/><rect x="-6" y="-150" width="12" height="8" rx="3"/><rect x="-21" y="-145" width="42" height="62" rx="10"/><rect x="-30" y="-142" width="8" height="58" rx="4"/><rect x="22" y="-142" width="8" height="58" rx="4"/><rect x="-17" y="-86" width="15" height="86" rx="5"/><rect x="2" y="-86" width="15" height="86" rx="5"/></g>`;

/** A cell: its size, the art's padding and the caption's two lines under the art (never over it). */
interface Dims { w: number; h: number; pad: number; label: number }
const CELL: Dims = { w: 250, h: 270, pad: 8, label: 34 };
/** A cell `scale` times as large in its art (the caption keeps its size). */
const dimsOf = (scale = 1): Dims => (scale === 1 ? CELL : { w: Math.round(CELL.w * scale), h: Math.round((CELL.h - CELL.label) * scale) + CELL.label, pad: CELL.pad, label: CELL.label });
const FONT = TEXT_FONT.replace(/'/g, "&apos;");

/**
 * How a sheet scales its cells. `auto` (the default): an item smaller than SMALL_CM both ways fills its cell, never at
 * less than the scene's scale nor more than MAX_PX_PER_CM, on a grid of 1, 2, 5 or 10 cm, with a scale bar where the adult
 * would be (a cup beside a 170 cm person is a speck); a larger one stands beside the adult. `scene`: one scale for every
 * cell of the sheet, each beside the adult, for comparing sizes. `fit`: every item fills its cell, however large (a long
 * train, a tall house), with a scale bar and no adult. Each cell prints its scale ("1 cm = 6 px") under the art.
 */
export type SheetZoom = "auto" | "scene" | "fit";
/** Below this size (cm, both ways) an `auto` cell zooms in on the item and leaves the adult out. */
export const SMALL_CM = 60;
/** The most an `auto` cell magnifies: a 1 cm thing is not blown up past this many px per cm. */
export const MAX_PX_PER_CM = 40;
/** The most a cell cropped to a box (`SheetCell.focus`) magnifies. */
export const FOCUS_MAX_PX_PER_CM = 400;

/** One cell's art and what frames it, before it is drawn. */
interface Measured {
  cell: SheetCell; ids: string;
  a: ReturnType<typeof pieceBody>; err: string;
  /** The scene frame: the art (with its glow) and the adult beside it, and where they stand (cm, y down). */
  scene?: { left: number; right: number; top: number; bottom: number; floor: number; sx: number; held: boolean; above: number; below: number };
}

/** A cell's art, and the frame it has in a scene: the person right of the art; a small thing is not shrunk to fit one (that person is cut by the cell). */
function measure(kit: Kit, cell: SheetCell, seed: string, ids: string, text: boolean): Measured {
  let a: ReturnType<typeof pieceBody> = null, err = cell.error ?? "";
  if (!err) try { a = pieceBody(kit, cell.item.def, cell.params, seed, ids, { text, night: !!cell.night, ...(cell.t !== undefined ? { t: cell.t } : {}) }); } catch (e) { err = (e as Error).message; }
  const m: Measured = { cell, ids, a, err };
  if (!a) return m;
  // framed by the reach (the art and its glow, a margin round it), stood by the art: a held prop's origin is the grip, about
  // 90 cm up a person; anything else stands on its origin (the kit's floor point) when the art reaches it, else on its lowest edge
  const [, y0, , y1] = a.bounds, [r0, r1, r2, r3] = a.reach, mx = (r2 - r0) * 0.05, my = (r3 - r1) * 0.05;
  const x0 = r0 - mx, x1 = r2 + mx, ry0 = r1 - my, ry1 = r3 + my, ih = ry1 - ry0;
  const held = !!cell.params.held, floor = held ? 90 : y0 < 0 && y1 >= 0 ? 0 : y1, tall = ih >= 60 || held;
  const top = tall ? Math.min(ry0, floor - 170) : ry0 - (100 - ih) / 2, bottom = tall ? Math.max(ry1, floor) : top + Math.max(ih, 100);
  const sx = x1 + 35;
  // on a scene sheet the whole adult shows in every cell, standing on one floor line across the sheet
  m.scene = { left: x0, right: sx + 32, top, bottom, floor, sx, held, above: floor - Math.min(ry0, floor - 170), below: Math.max(ry1, floor) - floor };
  return m;
}

const areaOf = (D: Dims) => ({ w: D.w - 2 * D.pad, h: D.h - 2 * D.pad - D.label });
/** The px per cm that fits a scene frame in a cell. */
const sceneK = (f: NonNullable<Measured["scene"]>, D: Dims) => { const A = areaOf(D); return Math.min(A.w / (f.right - f.left), A.h / (f.bottom - f.top)); };
/** The first of `min`, 2, 5, 10, 20, 50, 100 … times `min` cm at least `px` px long at `k` px per cm. */
function niceStep(k: number, px: number, min = 1): number {
  for (let d = min; ; d *= 10) for (const m of [1, 2, 5]) if (m * d * k >= px || m * d >= 1e5) return +(m * d).toPrecision(3);
}
const fmtK = (k: number) => (k >= 10 ? String(Math.round(k)) : k >= 1 ? String(+k.toFixed(1)) : String(+k.toFixed(2)));
/** `s` cut to `n` characters, with an ellipsis. */
const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, Math.max(1, Math.floor(n) - 1))}…`);

/** One cell: the art on a faint grid, the floor (or, held, the grip), the adult beside it or a scale bar; under it, the caption (number, item, look) and a line with the view, the time and the scale. */
function cellSvg(m: Measured, zoom: SheetZoom, sheet: Shared, D: Dims) {
  const { w: W, h: H, pad, label: L } = D, A = areaOf(D), { a, cell } = m, night = !!cell.night;
  const bg = night ? "#1B2238" : "#F4EFE6", ink = night ? "#C9D0E8" : "#4A4540";
  const head = `${cell.num !== undefined ? `${cell.num}  ` : ""}${cell.item.id} · ${cell.label}`;
  let foot = `${night ? "night" : "day"}${cell.t !== undefined ? ` · t ${Math.round(cell.t)} ms` : ""}`;
  const caption = () => `<text x="${W / 2}" y="${H - L + 14}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="${ink}">${esc(clip(head, (W - 10) / 6.4))}</text>`
    + `<text x="${W / 2}" y="${H - 7}" font-family="${FONT}" font-size="10" text-anchor="middle" fill="${ink}" fill-opacity=".85">${esc(clip(foot, (W - 10) / 5.2))}</text>`;
  const frame = `<rect width="${W}" height="${H}" rx="6" fill="${bg}"/>`;
  if (!a || !m.scene) {
    // why it draws nothing, in up to five lines
    const words = (m.err || "draws nothing").split(/\s+/), lines: string[] = [], max = (W - 20) / 6.4;
    for (const w of words) if (lines.length && (lines[lines.length - 1] + " " + w).length <= max) lines[lines.length - 1] += ` ${w}`; else lines.push(w);
    const shown = lines.slice(0, 5).map((l, i) => `<tspan x="${W / 2}" dy="${i ? 15 : 0}">${esc(clip(l, max))}${i === 4 && lines.length > 5 ? "…" : ""}</tspan>`).join("");
    return `<g>${frame}<text x="${W / 2}" y="${(H - L) / 2 - Math.min(lines.length, 5) * 7}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="${m.err ? "#E0605A" : ink}">${shown}</text>${caption()}</g>`;
  }
  const f = m.scene, [rx0, ry0, rx1, ry1] = a.reach;
  const small = zoom === "auto" && Math.max(rx1 - rx0, ry1 - ry0) < SMALL_CM, own = !!cell.focus || zoom === "fit" || small;
  // the frame (cm) and the scale: the scene's; or its own (a small item in auto, fit, a focus box), held ones with their grip
  let left = f.left, right = f.right, top = f.top, bottom = f.bottom, k = zoom === "scene" && !cell.focus ? sheet.k : sceneK(f, D);
  if (own) {
    const [bx0, by0, bx1, by1] = cell.focus
      ? [Math.min(cell.focus[0], cell.focus[2]), Math.min(cell.focus[1], cell.focus[3]), Math.max(cell.focus[0], cell.focus[2]), Math.max(cell.focus[1], cell.focus[3])]
      : f.held ? [Math.min(rx0, 0), Math.min(ry0, 0), Math.max(rx1, 0), Math.max(ry1, 0)] : [rx0, ry0, rx1, ry1];
    const grow = cell.focus ? 1.04 : small ? 1.3 : 1.1, min = cell.focus ? 0.5 : 4;
    const w = Math.max(bx1 - bx0, min) * grow, h = Math.max(by1 - by0, min) * grow + (small ? 2 : 0);
    const cap = cell.focus ? FOCUS_MAX_PX_PER_CM : MAX_PX_PER_CM;
    k = small ? Math.max(sceneK(f, D), Math.min(A.w / w, A.h / h, cap)) : Math.min(A.w / w, A.h / h, cap);
    left = (bx0 + bx1) / 2 - w / 2; right = left + w; top = (by0 + by1) / 2 - h / 2 - (small ? 1 : 0); bottom = top + h;
  }
  const ox = pad + (A.w - (right - left) * k) / 2 - left * k, oy = zoom === "scene" && !own ? sheet.floorRow - f.floor * k : pad + (A.h - (bottom - top) * k) / 2 - top * k;
  // the grid over the cell's reach, in cm, its lines at least 8 px apart (10 cm in a scene), at most about 60 an axis
  const gx0f = -ox / k, gx1f = (W - ox) / k, gy0f = -oy / k, gy1f = (H - L - oy) / k;
  const step = own ? niceStep(k, 8, cell.focus ? 0.1 : 1) : 10 * Math.max(1, Math.ceil(Math.max(gx1f - gx0f, gy1f - gy0f) / 600));
  const gx0 = Math.floor(gx0f / step) * step, gx1 = Math.ceil(gx1f / step) * step, gy0 = Math.floor(gy0f / step) * step, gy1 = Math.ceil(gy1f / step) * step;
  let grid = "";
  for (let x = gx0; x <= gx1 + step / 2; x += step) grid += `M${+x.toFixed(3)} ${gy0}V${gy1}`;
  for (let y = gy0; y <= gy1 + step / 2; y += step) grid += `M${gx0} ${+y.toFixed(3)}H${gx1}`;
  const gridInk = night ? "#8892B8" : "#8A7F70", px = (n: number) => +(n / k).toFixed(3);
  // in its own frame and held: no floor and no person; a cross marks the grip, the hand's place
  const grip = own && f.held
    ? `<path d="M${-px(7)} 0H${px(7)}M0 ${-px(7)}V${px(7)}" stroke="#C0504A" stroke-opacity=".8" stroke-width="${px(1.2)}" fill="none"/>`
    : "";
  // a crop shows a detail, not where it stands (a moving piece's lowest edge moves with it)
  const ground = (own && f.held) || cell.focus ? "" : `<path d="M${gx0} ${f.floor}H${gx1}" stroke="${gridInk}" stroke-opacity=".55" stroke-width="${px(1.2)}" fill="none"/>`;
  const person = own ? "" : `<g transform="translate(${f.sx} ${f.floor})">${ADULT}</g>`;
  const art = `<svg x="0" y="0" width="${W}" height="${H - L}" viewBox="0 0 ${W} ${H - L}" overflow="hidden"><g transform="translate(${+ox.toFixed(2)} ${+oy.toFixed(2)}) scale(${+k.toFixed(4)})">`
    + `<path d="${grid}" fill="none" stroke="${gridInk}" stroke-opacity=".22" stroke-width="${px(0.8)}"/>${ground}${person}<g${SVG_BASE}>${a.body}</g>${grip}</g></svg>`;
  foot += ` · 1 cm = ${fmtK(k)} px · grid ${step} cm${own && f.held ? " · + grip" : ""}`;
  // where the adult would dwarf the art, a bar of a round length, bottom left of the art
  let bar = "";
  if (own) {
    let len = 0.1;
    for (const c of [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]) if (c * k <= A.w * 0.4) len = c;
    const bx = pad + 4, by = H - L - 8, bw = len * k;
    bar = `<g fill="${ink}" stroke="${ink}"><rect x="${bx - 3}" y="${by - 9}" width="${+(bw + 40).toFixed(2)}" height="14" rx="3" fill="${bg}" fill-opacity=".75" stroke="none"/><path d="M${bx} ${by}H${+(bx + bw).toFixed(2)}M${bx} ${by - 4}V${by + 1}M${+(bx + bw).toFixed(2)} ${by - 4}V${by + 1}" stroke-width="1.5" fill="none"/><text x="${+(bx + bw + 5).toFixed(2)}" y="${by + 3}" stroke="none" font-family="${FONT}" font-size="10">${len} cm</text></g>`;
  }
  return `<g>${frame}${art}${bar}${caption()}</g>`;
}

/** What every cell of a `scene` sheet shares: the scale that fits the widest and the tallest frame, and the row of the floor. */
interface Shared { k: number; floorRow: number }
function shared(cells: Measured[], D: Dims): Shared {
  const fs = cells.flatMap(c => (c.scene && !c.cell.focus ? [c.scene] : [])), A = areaOf(D);
  if (!fs.length) return { k: 1, floorRow: D.pad + A.h / 2 };
  const above = Math.max(...fs.map(f => f.above)), below = Math.max(...fs.map(f => f.below)), wide = Math.max(...fs.map(f => f.right - f.left));
  const k = Math.min(A.w / wide, A.h / (above + below));
  return { k, floorRow: D.pad + (A.h - (above + below) * k) / 2 + above * k };
}

/** Cells laid out in a grid, as one SVG. */
function gridSheet(cells: string[], D: Dims, cols: number) {
  const gap = 8, across = Math.max(1, Math.min(cols, cells.length)), width = gap + across * (D.w + gap), height = gap + Math.ceil(cells.length / across) * (D.h + gap);
  const body = cells.map((c, i) => `<g transform="translate(${gap + (i % across) * (D.w + gap)} ${gap + Math.floor(i / across) * (D.h + gap)})">${c}</g>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#E8E1D4"/>${body}</svg>`;
}

/** The given cells on one sheet, as one SVG (render it with server/render.ts): a grid, each cell captioned with its number, item and look, and under that its view, time and scale. `scale` makes every cell's art that much larger (fewer go across: `columns` defaults to 6 / scale). */
export function cellSheetSvg(kit: Kit, cells: readonly SheetCell[], opts: { seed?: string; text?: boolean; columns?: number; zoom?: SheetZoom; scale?: number } = {}) {
  const seed = opts.seed ?? "a", text = opts.text ?? true, zoom = opts.zoom ?? "auto", D = dimsOf(opts.scale ?? 1);
  const ms = cells.map((c, i) => measure(kit, c, `${c.item.id}/${seed}`, `s${i}`, text));
  const k = zoom === "scene" ? shared(ms, D) : { k: 0, floorRow: 0 };
  return gridSheet(ms.map(m => cellSvg(m, zoom, k, D)), D, opts.columns ?? Math.max(1, Math.floor(6 / (opts.scale ?? 1))));
}

/** A contact sheet as one SVG (render it with server/render.ts): a titled row per item (`flow`: one grid of cells, each captioned with its item), in cells of each look by day and by night (`views` picks), held and counted for a prop, every cell on a faint grid with its scale printed, `zoom` (SheetZoom) deciding how it is scaled. Words are written (`text`). */
export function kitSheetSvg(kit: Kit, items: readonly SheetItem[], opts: { seed?: string; text?: boolean; columns?: number; views?: readonly ("day" | "night")[]; flow?: boolean; zoom?: SheetZoom } = {}) {
  const { w: W, h: H } = CELL, cols = opts.columns ?? 6, gap = 8, seed = opts.seed ?? "a", text = opts.text ?? true, views = opts.views?.length ? opts.views : ["day", "night"], zoom = opts.zoom ?? "auto";
  let n = 0;
  // measure every cell first: a scene sheet draws them all at the scale of the largest
  const rows = items.map(item => sheetLooks(item).flatMap(([label, params]) => views.map(view => measure(kit, { item, label, params, night: view === "night" }, `${item.id}/${seed}`, `s${n++}`, text))));
  const k = zoom === "scene" ? shared(rows.flat(), CELL) : { k: 0, floorRow: 0 };
  if (opts.flow) return gridSheet(rows.flat().map(c => cellSvg(c, zoom, k, CELL)), CELL, cols);
  let y = gap, body = "";
  items.forEach((item, r) => {
    const cells = rows[r].map(c => cellSvg(c, zoom, k, CELL));
    body += `<text x="${gap}" y="${y + 14}" font-family="${FONT}" font-size="15" font-weight="700" fill="#2B2420">${esc(item.id)} <tspan font-size="11" font-weight="400" fill="#6B645C">${item.kind === "set" ? "set piece" : "prop"}</tspan></text>`;
    y += 22;
    cells.forEach((c, i) => { body += `<g transform="translate(${gap + (i % cols) * (W + gap)} ${y + Math.floor(i / cols) * (H + gap)})">${c}</g>`; });
    y += Math.ceil(cells.length / cols) * (H + gap) + 6;
  });
  const width = gap + Math.min(cols, Math.max(2, items.reduce((m, it) => Math.max(m, sheetLooks(it).length * views.length), 2))) * (W + gap);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y + gap}" viewBox="0 0 ${width} ${y + gap}"><rect width="${width}" height="${y + gap}" fill="#E8E1D4"/>${body}</svg>`;
}
