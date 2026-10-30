// A set piece or prop drawn on its own as SVG (sahne-kit/set-svg: the gallery's sketch of a tile until the stage has drawn it,
// kit-sheet.ts, and backstage's prop gallery and its rendered sheets, server/render.ts):
// its flats, each moved by its offset; floor flats are shown as drawn, from above. `pieceSvg` is one piece;
// `kitSheetSvg` lays out labelled cells (each look, day and night, held and counted for a prop) with a grid and a person for scale.

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

/** One cell: the art for `params` in `night` or by day, on a faint 10 cm grid, with an adult beside it. */
function cellSvg(kit: Kit, item: SheetItem, label: string, params: Record<string, unknown>, night: boolean, seed: string, ids: string, text: boolean) {
  const { w: W, h: H, pad, label: L } = CELL;
  let a: ReturnType<typeof pieceBody> = null, err = "";
  try { a = pieceBody(kit, item.def, params, seed, ids, { text, night }); } catch (e) { err = (e as Error).message.slice(0, 70); }
  const bg = night ? "#1B2238" : "#F4EFE6", ink = night ? "#C9D0E8" : "#4A4540";
  const cap = `<text x="${W / 2}" y="${H - 8}" font-family="${TEXT_FONT.replace(/'/g, "&apos;")}" font-size="12" text-anchor="middle" fill="${ink}">${esc(`${item.id} · ${label}${night ? " · night" : ""}`)}</text>`;
  const frame = `<rect width="${W}" height="${H}" rx="6" fill="${bg}"/>`;
  if (!a) return `<g>${frame}<text x="${W / 2}" y="${H / 2}" font-family="${TEXT_FONT.replace(/'/g, "&apos;")}" font-size="12" text-anchor="middle" fill="${err ? "#E0605A" : ink}">${esc(err || "draws nothing")}</text>${cap}</g>`;
  const [x0, y0, x1, y1] = a.bounds, ih = y1 - y0;
  // a held prop's origin is the grip, about 90 cm up a person; anything else stands on its lowest edge
  const held = !!params.held, floor = held ? 90 : y1;
  // the person goes right of the art; a small thing is not shrunk to fit one: that person is cut by the cell
  const fitH = ih >= 60 || held ? Math.max(ih, 170) : 100;
  const top = ih >= 60 || held ? Math.min(y0, floor - 170) : y0 - (100 - ih) / 2, bottom = ih >= 60 || held ? Math.max(y1, floor) : top + fitH;
  const sx = x1 + 35, left = x0, right = sx + 32;
  const k = Math.min((W - 2 * pad) / (right - left), (H - 2 * pad - L) / (bottom - top));
  const ox = pad + ((W - 2 * pad) - (right - left) * k) / 2 - left * k, oy = pad + ((H - 2 * pad - L) - (bottom - top) * k) / 2 - top * k;
  // the 10 cm grid, over the cell's reach, in cm (so a stroke of 0.15 cm shows as about a pixel)
  const gx0 = Math.floor((-ox / k) / 10) * 10, gx1 = Math.ceil(((W - ox) / k) / 10) * 10, gy0 = Math.floor((-oy / k) / 10) * 10, gy1 = Math.ceil(((H - L - oy) / k) / 10) * 10;
  let grid = "";
  for (let x = gx0; x <= gx1; x += 10) grid += `M${x} ${gy0}V${gy1}`;
  for (let y = gy0; y <= gy1; y += 10) grid += `M${gx0} ${y}H${gx1}`;
  const gridInk = night ? "#8892B8" : "#8A7F70";
  return `<g>${frame}<svg x="0" y="0" width="${W}" height="${H - L}" viewBox="0 0 ${W} ${H - L}" overflow="hidden"><g transform="translate(${+ox.toFixed(2)} ${+oy.toFixed(2)}) scale(${+k.toFixed(4)})">`
    + `<path d="${grid}" fill="none" stroke="${gridInk}" stroke-opacity=".22" stroke-width="${+(0.8 / k).toFixed(3)}"/>`
    + `<path d="M${gx0} ${floor}H${gx1}" stroke="${gridInk}" stroke-opacity=".55" stroke-width="${+(1.2 / k).toFixed(3)}" fill="none"/>`
    + `<g transform="translate(${sx} ${floor})">${ADULT}</g><g${SVG_BASE}>${a.body}</g></g></svg>${cap}</g>`;
}

/** A contact sheet as one SVG (render it with server/render.ts): a titled row per item (`flow`: one grid of cells, each captioned with its item), in cells of each look by day and by night (`views` picks), held and counted for a prop, every cell on a faint 10 cm grid with a 170 cm adult beside it. Words are written (`text`). */
export function kitSheetSvg(kit: Kit, items: readonly SheetItem[], opts: { seed?: string; text?: boolean; columns?: number; views?: readonly ("day" | "night")[]; flow?: boolean } = {}) {
  const { w: W, h: H } = CELL, cols = opts.columns ?? 6, gap = 8, seed = opts.seed ?? "a", text = opts.text ?? true, views = opts.views?.length ? opts.views : ["day", "night"];
  let y = gap, body = "", n = 0;
  if (opts.flow) {
    // one cell per look of every item in a single grid, no row titles: each cell's caption names its item (a list of items on one picture)
    const cells: string[] = [];
    for (const item of items) for (const [label, params] of sheetLooks(item)) for (const view of views) cells.push(cellSvg(kit, item, label, params, view === "night", `${item.id}/${seed}`, `s${n++}`, text));
    const across = Math.max(1, Math.min(cols, cells.length)), width = gap + across * (W + gap), height = gap + Math.ceil(cells.length / across) * (H + gap);
    cells.forEach((c, i) => { body += `<g transform="translate(${gap + (i % across) * (W + gap)} ${gap + Math.floor(i / across) * (H + gap)})">${c}</g>`; });
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#E8E1D4"/>${body}</svg>`;
  }
  for (const item of items) {
    const cells: string[] = [];
    for (const [label, params] of sheetLooks(item)) for (const view of views) cells.push(cellSvg(kit, item, label, params, view === "night", `${item.id}/${seed}`, `s${n++}`, text));
    body += `<text x="${gap}" y="${y + 14}" font-family="${TEXT_FONT.replace(/'/g, "&apos;")}" font-size="15" font-weight="700" fill="#2B2420">${esc(item.id)} <tspan font-size="11" font-weight="400" fill="#6B645C">${item.kind === "set" ? "set piece" : "prop"}</tspan></text>`;
    y += 22;
    cells.forEach((c, i) => { body += `<g transform="translate(${gap + (i % cols) * (W + gap)} ${y + Math.floor(i / cols) * (H + gap)})">${c}</g>`; });
    y += Math.ceil(cells.length / cols) * (H + gap) + 6;
  }
  const width = gap + Math.min(cols, Math.max(2, items.reduce((m, it) => Math.max(m, sheetLooks(it).length * views.length), 2))) * (W + gap);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y + gap}" viewBox="0 0 ${width} ${y + gap}"><rect width="${width}" height="${y + gap}" fill="#E8E1D4"/>${body}</svg>`;
}
