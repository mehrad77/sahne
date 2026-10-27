// A set piece or prop drawn on its own as SVG (the gallery's sketch of a tile until the stage has drawn it, and kit-sheet.ts):
// its flats, each moved by its offset; floor flats are shown as drawn, from above.

import { groupBounds, groupSvg, moveAt, rng, SVG_BASE, whenWeight, withVariant, type FlatSpec, type Kit, type PieceDef } from "sahne";

/** The look a thumbnail shows: day, clear, the place in no state. */
const PLAIN = { time: { from: "day", to: "day", k: 1 }, weather: { from: "clear", to: "clear", k: 1 }, state: { from: [], to: [], k: 1 } };

/** A piece's flats as one SVG, each moved by its offset (cm, y up), `px` across its longer side; "" when it draws nothing. `glow` adds what glows at night (the emissive groups) over the art. */
export function pieceSvg(kit: Kit, def: PieceDef, params: Record<string, unknown>, seed: string, px: number, glow = false, ids = seed) {
  const out = def.draw(withVariant(def, params), rng(seed), kit);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, body = "";
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
    body += `<g transform="translate(${dx} ${dy})">${groupSvg(f.group, { id: `${ids}-${i}-` })}${glow && f.emissive ? groupSvg(f.emissive, { id: `${ids}-${i}-g-` }) : ""}</g>`;
  }
  // a flame the stage burns as particles (a candle's), drawn here as one still flame on its wick
  for (const e of out.emitters ?? []) {
    if (e.kind !== "flame") continue;
    const k = (e.w ?? 1.2) / 1.2, x = e.x, y = -e.y;
    x0 = Math.min(x0, x - 0.7 * k); x1 = Math.max(x1, x + 0.7 * k); y0 = Math.min(y0, y - 2.9 * k); y1 = Math.max(y1, y);
    body += `<g transform="translate(${x} ${y}) scale(${k})"><path d="M0-2.85C.5-1.9.65-1.2.5-.4.35 0-.35 0-.5-.4-.65-1.2-.5-1.9 0-2.85Z" fill="#FFC23C"/><path d="M0-1.85C.3-1.2.35-.7.2-.3S-.35-.15-.35-.7-.3-1.2 0-1.85Z" fill="#FFF2B8"/></g>`;
  }
  if (!body) return "";
  const w = x1 - x0, h = y1 - y0, k = px / Math.max(w, h);
  return `<svg viewBox="${x0} ${y0} ${w} ${h}" width="${Math.round(w * k)}" height="${Math.round(h * k)}" role="img"><g${SVG_BASE}>${body}</g></svg>`;
}
