// A set piece or prop drawn on its own as SVG (sahne-kit/set-svg: the gallery's sketch of a tile until the stage has drawn it,
// kit-sheet.ts, and backstage's prop gallery and its rendered sheets, server/render.ts):
// its flats, each moved by its offset; floor flats are shown as drawn, from above. `pieceSvg` is one piece;
// `kitSheetSvg` lays out labelled cells (each look, day and night, held and counted for a prop) with a grid and a person or a
// scale bar for scale, each zoomed to its item or all at one scale (`zoom`).

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
  const shown = out.flats.map((f: FlatSpec, i) => {
    const m = f.move ? moveAt(f.move, 0) : { at: [0, 0, 0], dx: 0, dy: 0 };
    if (!m || (f.when && whenWeight(f.when, PLAIN) < 0.5)) return null;
    return { f, i, dx: (f.x ?? 0) + m.at[0] * 100 + m.dx, dy: -(f.y ?? 0) - m.at[1] * 100 - m.dy, z: (f.z ?? 0) + m.at[2] * 100 };
  }).filter(v => v !== null).sort((a, b) => a.z - b.z);
  for (const { f, i, dx, dy } of shown) {
    const [bx0, by0, bx1, by1] = groupBounds(f.group);
    if (![bx0, by0, bx1, by1].every(Number.isFinite)) continue;
    x0 = Math.min(x0, bx0 + dx); y0 = Math.min(y0, by0 + dy); x1 = Math.max(x1, bx1 + dx); y1 = Math.max(y1, by1 + dy);
    day += `<g transform="translate(${dx} ${dy})">${groupSvg(f.group, { id: `${ids}-${i}-` })}${opts.text ? (f.text ?? []).map(textSvg).join("") : ""}</g>`;
    if (glow && f.emissive) lit += `<g transform="translate(${dx} ${dy})">${groupSvg(f.emissive, { id: `${ids}-${i}-g-` })}</g>`;
  }
  // a flame the stage burns as particles (a candle's), drawn here as one still flame on its wick
  for (const e of out.emitters ?? []) {
    if (e.kind !== "flame") continue;
    const k = (e.w ?? 1.2) / 1.2, x = e.x, y = -e.y;
    x0 = Math.min(x0, x - 0.7 * k); x1 = Math.max(x1, x + 0.7 * k); y0 = Math.min(y0, y - 2.9 * k); y1 = Math.max(y1, y);
    lit += `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0-2.85C.5-1.9.65-1.2.5-.4.35 0-.35 0-.5-.4-.65-1.2-.5-1.9 0-2.85Z" fill="#FFC23C"/><path d="M0-1.85C.3-1.2.35-.7.2-.3S-.35-.15-.35-.7-.3-1.2 0-1.85Z" fill="#FFF2B8"/></g>`;
  }
  if (!day && !lit) return null;
  // night: the day art dimmed and blued by a filter, the glow and the flames over it
  const dimmed = night ? `<g filter="url(#${ids}-night)">${day}</g>` : day;
  const defs = night ? `<defs><filter id="${ids}-night" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".34 0 0 0 0  0 .38 0 0 .01  0 0 .62 0 .06  0 0 0 1 0"/></filter></defs>` : "";
  return { body: defs + dimmed + lit, bounds: [x0, y0, x1, y1] as [number, number, number, number] };
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

/** A person 170 cm tall, standing at (0, 0) with y down (cm): the scale every cell carries, since puppet scale is the first thing a drawing gets wrong. */
const ADULT = `<g fill="#59607A" fill-opacity=".34"><circle cx="0" cy="-159" r="10"/><rect x="-6" y="-150" width="12" height="8" rx="3"/><rect x="-21" y="-145" width="42" height="62" rx="10"/><rect x="-30" y="-142" width="8" height="58" rx="4"/><rect x="22" y="-142" width="8" height="58" rx="4"/><rect x="-17" y="-86" width="15" height="86" rx="5"/><rect x="2" y="-86" width="15" height="86" rx="5"/></g>`;

const CELL = { w: 250, h: 270, pad: 8, label: 24 };
const FONT = TEXT_FONT.replace(/'/g, "&apos;");

/**
 * How a sheet scales its cells. `auto` (the default): an item smaller than SMALL_CM both ways fills its cell, never at
 * less than the scene's scale nor more than MAX_PX_PER_CM, on a grid of 1, 2, 5 or 10 cm, with a scale bar where the adult
 * would be (a cup beside a 170 cm person is a speck); a larger one stands beside the adult. `scene`: one scale for every
 * cell of the sheet, each beside the adult, for comparing sizes. Each cell prints its scale ("1 cm = 6 px").
 */
export type SheetZoom = "auto" | "scene";
/** Below this size (cm, both ways) an `auto` cell zooms in on the item and leaves the adult out. */
export const SMALL_CM = 60;
/** The most an `auto` cell magnifies: a 1 cm thing is not blown up past this many px per cm. */
export const MAX_PX_PER_CM = 40;

/** One cell's art and what frames it, before it is drawn. */
interface Measured {
  item: SheetItem; label: string; params: Record<string, unknown>; night: boolean; ids: string;
  a: ReturnType<typeof pieceBody>; err: string;
  /** The scene frame: the art and the adult beside it, and where they stand (cm, y down). */
  scene?: { left: number; right: number; top: number; bottom: number; floor: number; sx: number; held: boolean; above: number; below: number };
}

/** A cell's art, and the frame it has in a scene: the person right of the art; a small thing is not shrunk to fit one (that person is cut by the cell). */
function measure(kit: Kit, item: SheetItem, label: string, params: Record<string, unknown>, night: boolean, seed: string, ids: string, text: boolean): Measured {
  let a: ReturnType<typeof pieceBody> = null, err = "";
  try { a = pieceBody(kit, item.def, params, seed, ids, { text, night }); } catch (e) { err = (e as Error).message.slice(0, 70); }
  const m: Measured = { item, label, params, night, ids, a, err };
  if (!a) return m;
  const [x0, y0, x1, y1] = a.bounds, ih = y1 - y0;
  // a held prop's origin is the grip, about 90 cm up a person; anything else stands on its origin (the kit's floor point)
  // when the art reaches it, else on its lowest edge
  const held = !!params.held, floor = held ? 90 : y0 < 0 && y1 >= 0 ? 0 : y1, tall = ih >= 60 || held;
  const top = tall ? Math.min(y0, floor - 170) : y0 - (100 - ih) / 2, bottom = tall ? Math.max(y1, floor) : top + Math.max(ih, 100);
  const sx = x1 + 35;
  // on a scene sheet the whole adult shows in every cell, standing on one floor line across the sheet
  m.scene = { left: x0, right: sx + 32, top, bottom, floor, sx, held, above: floor - Math.min(y0, floor - 170), below: Math.max(y1, floor) - floor };
  return m;
}

const AREA = { w: CELL.w - 2 * CELL.pad, h: CELL.h - 2 * CELL.pad - CELL.label };
/** The px per cm that fits a scene frame in a cell. */
const sceneK = (f: NonNullable<Measured["scene"]>) => Math.min(AREA.w / (f.right - f.left), AREA.h / (f.bottom - f.top));
/** The first of 1, 2, 5, 10, 20, 50, 100 … cm at least `px` px long at `k` px per cm. */
function niceStep(k: number, px: number): number {
  for (let d = 1; ; d *= 10) for (const m of [1, 2, 5]) if (m * d * k >= px || m * d >= 1e5) return m * d;
}
const fmtK = (k: number) => (k >= 10 ? String(Math.round(k)) : k >= 1 ? String(+k.toFixed(1)) : String(+k.toFixed(2)));

/** One cell: the art on a faint grid, the floor (or, held, the grip), the adult beside it or a scale bar, and its scale. */
function cellSvg(m: Measured, zoom: SheetZoom, sheet: Shared) {
  const { w: W, h: H, pad, label: L } = CELL, { a, item, night } = m;
  const bg = night ? "#1B2238" : "#F4EFE6", ink = night ? "#C9D0E8" : "#4A4540";
  const cap = `<text x="${W / 2}" y="${H - 8}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="${ink}">${esc(`${item.id} · ${m.label}${night ? " · night" : ""}`)}</text>`;
  const frame = `<rect width="${W}" height="${H}" rx="6" fill="${bg}"/>`;
  if (!a || !m.scene) return `<g>${frame}<text x="${W / 2}" y="${H / 2}" font-family="${FONT}" font-size="12" text-anchor="middle" fill="${m.err ? "#E0605A" : ink}">${esc(m.err || "draws nothing")}</text>${cap}</g>`;
  const [x0, y0, x1, y1] = a.bounds, f = m.scene;
  const small = zoom === "auto" && Math.max(x1 - x0, y1 - y0) < SMALL_CM;
  // the frame (cm) and the scale: the scene's, or (small, auto) the art's own with a margin, held ones with their grip
  let left = f.left, right = f.right, top = f.top, bottom = f.bottom, k = zoom === "scene" ? sheet.k : sceneK(f);
  if (small) {
    const bx0 = f.held ? Math.min(x0, 0) : x0, bx1 = f.held ? Math.max(x1, 0) : x1, by0 = f.held ? Math.min(y0, 0) : y0, by1 = f.held ? Math.max(y1, 0) : y1;
    const w = Math.max(bx1 - bx0, 4) * 1.3, h = Math.max(by1 - by0, 4) * 1.3 + 2;
    k = Math.max(sceneK(f), Math.min(AREA.w / w, AREA.h / h, MAX_PX_PER_CM));
    left = (bx0 + bx1) / 2 - w / 2; right = left + w; top = (by0 + by1) / 2 - h / 2 - 1; bottom = top + h;
  }
  const ox = pad + (AREA.w - (right - left) * k) / 2 - left * k, oy = zoom === "scene" ? sheet.floorRow - f.floor * k : pad + (AREA.h - (bottom - top) * k) / 2 - top * k;
  // the grid over the cell's reach, in cm, its lines at least 8 px apart (10 cm in a scene), at most about 60 an axis
  const gx0f = -ox / k, gx1f = (W - ox) / k, gy0f = -oy / k, gy1f = (H - L - oy) / k;
  const step = small ? niceStep(k, 8) : 10 * Math.max(1, Math.ceil(Math.max(gx1f - gx0f, gy1f - gy0f) / 600));
  const gx0 = Math.floor(gx0f / step) * step, gx1 = Math.ceil(gx1f / step) * step, gy0 = Math.floor(gy0f / step) * step, gy1 = Math.ceil(gy1f / step) * step;
  let grid = "";
  for (let x = gx0; x <= gx1; x += step) grid += `M${x} ${gy0}V${gy1}`;
  for (let y = gy0; y <= gy1; y += step) grid += `M${gx0} ${y}H${gx1}`;
  const gridInk = night ? "#8892B8" : "#8A7F70", px = (n: number) => +(n / k).toFixed(3);
  // small and held: no floor and no person; a cross marks the grip, the hand's place
  const grip = small && f.held
    ? `<path d="M${-px(7)} 0H${px(7)}M0 ${-px(7)}V${px(7)}" stroke="#C0504A" stroke-opacity=".8" stroke-width="${px(1.2)}" fill="none"/>`
    : "";
  const ground = small && f.held ? "" : `<path d="M${gx0} ${f.floor}H${gx1}" stroke="${gridInk}" stroke-opacity=".55" stroke-width="${px(1.2)}" fill="none"/>`;
  const person = small ? "" : `<g transform="translate(${f.sx} ${f.floor})">${ADULT}</g>`;
  const art = `<svg x="0" y="0" width="${W}" height="${H - L}" viewBox="0 0 ${W} ${H - L}" overflow="hidden"><g transform="translate(${+ox.toFixed(2)} ${+oy.toFixed(2)}) scale(${+k.toFixed(4)})">`
    + `<path d="${grid}" fill="none" stroke="${gridInk}" stroke-opacity=".22" stroke-width="${px(0.8)}"/>${ground}${person}<g${SVG_BASE}>${a.body}</g>${grip}</g></svg>`;
  // the scale, top left; and where the adult would dwarf the art, a bar of a round length
  const words = `1 cm = ${fmtK(k)} px · grid ${step} cm${small && f.held ? " · + grip" : ""}`;
  const scale = `<rect x="${pad - 2}" y="${pad - 1}" width="${+(words.length * 4.7 + 8).toFixed(1)}" height="15" rx="3" fill="${bg}" fill-opacity=".8"/><text x="${pad + 2}" y="${pad + 10}" font-family="${FONT}" font-size="10" fill="${ink}">${esc(words)}</text>`;
  let bar = "";
  if (small) {
    let len = 1;
    for (const c of [1, 2, 5, 10, 20, 50]) if (c * k <= AREA.w * 0.4) len = c;
    const bx = pad + 4, by = H - L - 8, bw = len * k;
    bar = `<g fill="${ink}" stroke="${ink}"><path d="M${bx} ${by}H${+(bx + bw).toFixed(2)}M${bx} ${by - 4}V${by + 1}M${+(bx + bw).toFixed(2)} ${by - 4}V${by + 1}" stroke-width="1.5" fill="none"/><text x="${+(bx + bw + 5).toFixed(2)}" y="${by + 3}" stroke="none" font-family="${FONT}" font-size="10">${len} cm</text></g>`;
  }
  return `<g>${frame}${art}${scale}${bar}${cap}</g>`;
}

/** What every cell of a `scene` sheet shares: the scale that fits the widest and the tallest frame, and the row of the floor. */
interface Shared { k: number; floorRow: number }
function shared(cells: Measured[]): Shared {
  const fs = cells.flatMap(c => (c.scene ? [c.scene] : []));
  if (!fs.length) return { k: 1, floorRow: CELL.pad + AREA.h / 2 };
  const above = Math.max(...fs.map(f => f.above)), below = Math.max(...fs.map(f => f.below)), wide = Math.max(...fs.map(f => f.right - f.left));
  const k = Math.min(AREA.w / wide, AREA.h / (above + below));
  return { k, floorRow: CELL.pad + (AREA.h - (above + below) * k) / 2 + above * k };
}

/** A contact sheet as one SVG (render it with server/render.ts): a titled row per item (`flow`: one grid of cells, each captioned with its item), in cells of each look by day and by night (`views` picks), held and counted for a prop, every cell on a faint grid with its scale printed, `zoom` (SheetZoom) deciding how it is scaled. Words are written (`text`). */
export function kitSheetSvg(kit: Kit, items: readonly SheetItem[], opts: { seed?: string; text?: boolean; columns?: number; views?: readonly ("day" | "night")[]; flow?: boolean; zoom?: SheetZoom } = {}) {
  const { w: W, h: H } = CELL, cols = opts.columns ?? 6, gap = 8, seed = opts.seed ?? "a", text = opts.text ?? true, views = opts.views?.length ? opts.views : ["day", "night"], zoom = opts.zoom ?? "auto";
  let n = 0;
  // measure every cell first: a scene sheet draws them all at the scale of the largest
  const rows = items.map(item => sheetLooks(item).flatMap(([label, params]) => views.map(view => measure(kit, item, label, params, view === "night", `${item.id}/${seed}`, `s${n++}`, text))));
  const k = zoom === "scene" ? shared(rows.flat()) : { k: 0, floorRow: 0 };
  let y = gap, body = "";
  if (opts.flow) {
    // one cell per look of every item in a single grid, no row titles: each cell's caption names its item (a list of items on one picture)
    const cells = rows.flat().map(c => cellSvg(c, zoom, k));
    const across = Math.max(1, Math.min(cols, cells.length)), width = gap + across * (W + gap), height = gap + Math.ceil(cells.length / across) * (H + gap);
    cells.forEach((c, i) => { body += `<g transform="translate(${gap + (i % across) * (W + gap)} ${gap + Math.floor(i / across) * (H + gap)})">${c}</g>`; });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#E8E1D4"/>${body}</svg>`;
  }
  items.forEach((item, r) => {
    const cells = rows[r].map(c => cellSvg(c, zoom, k));
    body += `<text x="${gap}" y="${y + 14}" font-family="${FONT}" font-size="15" font-weight="700" fill="#2B2420">${esc(item.id)} <tspan font-size="11" font-weight="400" fill="#6B645C">${item.kind === "set" ? "set piece" : "prop"}</tspan></text>`;
    y += 22;
    cells.forEach((c, i) => { body += `<g transform="translate(${gap + (i % cols) * (W + gap)} ${y + Math.floor(i / cols) * (H + gap)})">${c}</g>`; });
    y += Math.ceil(cells.length / cols) * (H + gap) + 6;
  });
  const width = gap + Math.min(cols, Math.max(2, items.reduce((m, it) => Math.max(m, sheetLooks(it).length * views.length), 2))) * (W + gap);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y + gap}" viewBox="0 0 ${width} ${y + gap}"><rect width="${width}" height="${y + gap}" fill="#E8E1D4"/>${body}</svg>`;
}
