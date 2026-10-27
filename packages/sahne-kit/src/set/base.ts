// Set pieces: parametric generators for places (DESIGN.md §5.5). Units are centimetres; each
// flat's origin is its bottom centre, so a piece stands on the floor at y = 0.

import { smooth, ellipse, rect, rrect, poly, tone, mix, type PieceDef, type Shape, type Rng, type Path, type FlatSpec, type TextSpec, type PieceOut } from "sahne";
import { hex, S, P, L, num, str, glowOnly, litByTurns, solidLine, type Pt } from "./draw.ts";
import { SET, FABRIC, SKIN } from "../palette.ts";

// ---- The street outside ------------------------------------------------------------

const FACADES = ["#E9CF9E", "#F0DDBF", "#CFE0CF", "#E8B9A3", "#D9C7DA", "#F2E4C4", "#BFD3DC"];

function facade(x: number, w: number, h: number, col: string, r: Rng, lit: Shape[]): Shape[] {
  const out: Shape[] = [S(rect(x, -h, w, h), col), S(rect(x - 6, -h - 14, w + 12, 16), tone(col, "shade"))];
  out.push(S(rect(x, -h + 2, 9, h - 2), tone(col, "shade"), { flat: true, opacity: 0.35 }));
  const floors = Math.floor((h - 260) / 290), bays = Math.max(2, Math.round(w / 120));
  const bw = w / bays;
  const cumba = r.chance(0.55) ? r.int(0, bays - 1) : -1;
  for (let f = 0; f < floors; f++) {
    const y = -h + 70 + f * 290;
    for (let i = 0; i < bays; i++) {
      const wx = x + i * bw + bw * 0.22, ww = bw * 0.56, wh = 150;
      if (i === cumba && f < floors - 1) {
        out.push(S(rect(wx - 18, y - 10, ww + 36, wh + 40), tone(col, "light")));
        out.push(S(rect(wx - 18, y + wh + 26, ww + 36, 12), tone(col, "shade")));
      }
      out.push(S(rect(wx, y, ww, wh), "#55657A"));
      out.push(S(rect(wx + 4, y + 4, ww - 8, wh - 8), "#7E93A8", { flat: true }));
      out.push(L([[wx + ww / 2, y + 4], [wx + ww / 2, y + wh - 4]], "#55657A", 5, 1));
      if (r.chance(0.35)) lit.push(S(rect(wx + 4, y + 4, ww - 8, wh - 8), "#FFD27A", { flat: true }));
      if (r.chance(0.3) && i !== cumba) {
        out.push(S(rect(wx - 14, y + wh - 4, ww + 28, 8), tone(col, "deep")));
        for (let k = 0; k <= 6; k++) out.push(L([[wx - 12 + k * (ww + 24) / 6, y + wh - 4], [wx - 12 + k * (ww + 24) / 6, y + wh - 54]], "#3B3B40", 3, 0.9));
        out.push(L([[wx - 14, y + wh - 54], [wx + ww + 14, y + wh - 54]], "#3B3B40", 4, 0.9));
        if (r.chance(0.6)) out.push(P([[wx + 6, y + wh - 56], [wx + 30, y + wh - 56], [wx + 26, y + wh - 74], [wx + 10, y + wh - 74]], "#B8562F"), S(ellipse(wx + 18, y + wh - 86, 22, 16), "#4E7A48"));
      }
    }
  }
  // the shop front at street level
  out.push(S(rect(x + 20, -250, w - 40, 210), "#4C5A63"));
  out.push(S(rect(x + 26, -244, w - 52, 198), "#90A7B2", { flat: true }));
  out.push(S(rect(x + 10, -280, w - 20, 34), r.pick(["#B3261E", "#2F8C88", "#2E3A59", "#E0A83A"])));
  lit.push(S(rect(x + 26, -244, w - 52, 198), "#FFE2A6", { flat: true, opacity: 0.85 }));
  return out;
}

/**
 * A row of Istanbul façades across `w` cm (seeded heights, colours, cumba bays, shopfronts), a pavement, a kerb and a
 * street lamp; lit windows at night. `kind` `far`: a far street for a back band, simpler and muted into the haze by
 * `mute` (0…1, default 0.45), market awnings over its shops.
 */
const street: PieceDef = { draw(p, r) {
  if (str(p.kind, "") === "far") return farStreet(p, r);
  // a very long street (a far city) is drawn coarser, to fit the atlas
  const w = num(p.w, 1400), shapes: Shape[] = [], lit: Shape[] = [], ppcm = Math.min(0.42, 1900 / (w + 60));
  let x = -w / 2;
  while (x < w / 2) {
    const bw = r.range(260, 380), h = r.range(820, 1150);
    shapes.push(...facade(x, bw, h, r.pick(FACADES), r, lit));
    x += bw + r.range(0, 8);
  }
  // pavement and kerb
  shapes.push(S(rect(-w / 2 - 20, -36, w + 40, 40), "#B9B2A6"), S(rect(-w / 2 - 20, -8, w + 40, 10), "#8E877C"));
  // a street lamp
  shapes.push(L([[-120, -36], [-120, -520], [-60, -560]], "#3B3B40", 8, 1), S(ellipse(-52, -556, 22, 10), "#3B3B40"));
  // the lamp and the shops light first, then the windows one by one as the evening deepens
  const early = [S(ellipse(-52, -548, 16, 7), "#FFE6A8", { flat: true }), ...lit.filter(s => s.opacity === 0.85)], windows = lit.filter(s => s.opacity !== 0.85);
  return { flats: [
    { group: { shapes, edge: 2.2 }, switch: false, ppcm, lit: 0.85 },
    glowOnly(early, { ppcm, glowAt: 0.1 }),
    ...litByTurns(windows, { ppcm }),
  ] };
}, variants: { far: { kind: "far" } },
  meta: {
    about: "A row of seeded Istanbul façades with shopfronts, a pavement and a street lamp, lit windows at night; or a far, hazy street.",
    params: {
      kind: { type: "enum", values: ["plain", "far"], default: "plain", about: "far: a far street for a back band" },
      w: { type: "num", default: 1400, about: "length, cm" },
      mute: { type: "num", min: 0, max: 1, default: 0.45, about: "far: how much the haze mutes it" },
    },
    tags: ["street", "building", "light"],
  } };

// ---- Walls and floor ----------------------------------------------------------------

/**
 * A glass partition `w` × `h` (an office's counter wall): aluminium posts about every `bay` cm (default 120), a kick
 * plate, a frosted band at eye height (none when `frost` is false: a shop's glass front, people seen whole through
 * it), a head rail; clear glass with glints between. `openings` (`{x, y, w, h}`) are framed doorways with no glass.
 */
function glassPartition(p: Record<string, unknown>): { flats: FlatSpec[] } {
  const w = num(p.w, 600), h = num(p.h, 260), bay = num(p.bay, 120), alu = "#B8BEC4", glassC = "#BFD6DF";
  const openings = (p.openings as { x: number; y: number; w: number; h: number }[] | undefined) ?? [];
  const inDoor = (x: number, y = 1) => openings.some(o => x > o.x - o.w / 2 && x < o.x + o.w / 2 && y > o.y && y < o.y + o.h);
  /** Horizontal spans of the band y0..y1 that no doorway cuts. */
  const spans = (y0: number, y1: number): [number, number][] => {
    let out: [number, number][] = [[-w / 2, w / 2]];
    for (const o of openings) {
      if (o.y >= y1 || o.y + o.h <= y0) continue;
      const a = o.x - o.w / 2, b = o.x + o.w / 2;
      out = out.flatMap(([x0, x1]) => b <= x0 || a >= x1 ? [[x0, x1]] : [[x0, a], [b, x1]].filter(([u, v]) => v - u > 0.5) as [number, number][]);
    }
    return out;
  };
  const band = (y0: number, y1: number, fill: string, o: Partial<Shape> = {}): Shape[] => spans(y0, y1).map(([x0, x1]) => S(rect(x0, -y1, x1 - x0, y1 - y0), fill, o));
  const frost = p.frost !== false;
  const glass: Shape[] = [...band(15, h - 8, glassC, { flat: true, opacity: 0.16 }), ...(frost ? band(105, 140, "#F4F6F7", { flat: true, opacity: 0.6 }) : [])];
  const frame: Shape[] = [...band(0, 15, tone(alu, "shade")), ...band(h - 8, h, alu), ...(frost ? [...band(103, 105, alu), ...band(140, 142, alu)] : [])];
  const n = Math.max(1, Math.round(w / bay)), b = w / n;
  for (let k = 0; k <= n; k++) {
    const x = -w / 2 + k * b;
    if (inDoor(x)) continue;
    frame.push(S(rect(x - 2.5, -h, 5, h), alu), S(rect(x + 1, -h, 1.5, h), tone(alu, "shade"), { flat: true, opacity: 0.6 }));
    if (k < n && !inDoor(x + b / 2)) glass.push(L([[x + b * 0.2, -40], [x + b * 0.45, -95]], "#FFFFFF", 5, 0.22), L([[x + b * 0.3, -160], [x + b * 0.55, -220]], "#FFFFFF", 4, 0.16));
  }
  // a doorway is framed: two posts and a head
  for (const o of openings) {
    const a = o.x - o.w / 2, z = o.x + o.w / 2, top = o.y + o.h;
    frame.push(S(rect(a - 4, -top - 4, 4, top + 4 - o.y), alu), S(rect(z, -top - 4, 4, top + 4 - o.y), alu), S(rect(a - 4, -top - 4, o.w + 8, 4), alu));
  }
  return { flats: [{ group: { shapes: glass, edge: 0 }, z: -1, ppcm: 0.3 }, { group: { shapes: frame, edge: 0.8 }, ppcm: 0.9 }] };
}

/**
 * A room's back wall `w` × `h` in `color` (a `SET` name or a colour), tiled up to `tiles` cm (0: none), with skirting and a cornice; `openings` (`{x, y, w, h}`) are cut through it.
 * `kind: "glass"` is a glass partition instead (`glassPartition`).
 */
const wall: PieceDef = { draw(p) {
  if (p.kind === "glass") return glassPartition(p);
  const w = num(p.w, 1000), h = num(p.h, 320), col = SET[hex(p.color, "wall_cream")] ?? hex(p.color, SET.wall_cream);
  const openings = (p.openings as { x: number; y: number; w: number; h: number }[] | undefined) ?? [];
  const tileH = num(p.tiles, 110);
  /** Horizontal spans of the band y0..y1 (cm above the floor) that no opening cuts through. */
  const spans = (y0: number, y1: number): [number, number][] => {
    let out: [number, number][] = [[-w / 2, w / 2]];
    for (const o of openings) {
      if (o.y >= y1 || o.y + o.h <= y0) continue;
      const a = o.x - o.w / 2, b = o.x + o.w / 2;
      out = out.flatMap(([x0, x1]) => b <= x0 || a >= x1 ? [[x0, x1]] : [[x0, a], [b, x1]].filter(([u, v]) => v - u > 0.5) as [number, number][]);
    }
    return out;
  };
  const band = (y0: number, y1: number, fill: string, o: Partial<Shape> = {}): Shape[] => spans(y0, y1).map(([x0, x1]) => S(rect(x0, -y1, x1 - x0, y1 - y0), fill, o));
  let path = rect(-w / 2, -h, w, h);
  for (const o of openings) path = path.add(rect(o.x - o.w / 2, -o.y - o.h, o.w, o.h));
  const shapes: Shape[] = [S(path, col, { evenodd: true })];
  if (tileH > 0) {
    shapes.push(...band(12, tileH, SET.tile_white));
    for (let y = 27; y < tileH; y += 15) for (const [x0, x1] of spans(y - 0.5, y + 0.5)) shapes.push(L([[x0, -y], [x1, -y]], SET.tile_grout, 0.8, 0.9));
    for (let x = -w / 2 + 15; x < w / 2; x += 15) {
      const cut = openings.filter(o => x > o.x - o.w / 2 && x < o.x + o.w / 2 && o.y < tileH);
      if (!cut.length) shapes.push(L([[x, -tileH], [x, -12]], SET.tile_grout, 0.8, 0.9));
      else for (const o of cut) if (o.y > 12) shapes.push(L([[x, -o.y], [x, -12]], SET.tile_grout, 0.8, 0.9));
    }
    shapes.push(...band(tileH, tileH + 5, tone(SET.tile_white, "shade")));
  }
  shapes.push(...band(0, 12, SET.wood_dark));
  shapes.push(...band(h - 10, h, tone(col, "light")));
  shapes.push(...band(h - 60, h - 10, tone(col, "shade"), { flat: true, opacity: 0.35 }));
  return { flats: [{ group: { shapes, edge: 1.2 }, ppcm: 0.9 }] };
}, variants: { glass: { kind: "glass" } },
  meta: {
    about: "A room's back wall with tiles up to a height, skirting and a cornice, openings cut through it. Or a glass partition with aluminium posts, a frosted band and framed doorways.",
    params: {
      kind: { type: "enum", values: ["plain", "glass"], default: "plain", about: "a painted wall, or a glass partition" },
      w: { type: "num", default: 1000, about: "cm" },
      h: { type: "num", default: 320, about: "cm (a glass partition 260)" },
      bay: { type: "num", min: 0, default: 120, about: "a glass partition's posts, about this far apart, cm" },
      frost: { type: "bool", default: true, about: "a glass partition's frosted band at eye height" },
      color: { type: "color", default: "wall_cream", about: "a SET palette id or a hex" },
      tiles: { type: "num", default: 110, about: "tiled up to this height, cm; 0 none" },
      openings: { type: "list", about: "{x, y, w, h} holes cut through it, cm" },
    },
    tags: ["wall", "room"],
  } };

/** A floor `w` × `d` laid flat, a chequer of `tile` cm in colours `a` and `b`. */
const floor: PieceDef = { draw(p) {
  const w = num(p.w, 1000), d = num(p.d, 450), t = num(p.tile, 40), a = hex(p.a, SET.floor_a), b = hex(p.b, SET.floor_b);
  const shapes: Shape[] = [S(rect(-w / 2, 0, w, d), a)];
  let cells: Path | null = null;
  for (let y = 0, j = 0; y < d; y += t, j++) for (let x = -w / 2, i = 0; x < w / 2; x += t, i++) if ((i + j) % 2) {
    const r = rect(x + 1, y + 1, t - 2, t - 2); cells = cells ? cells.add(r) : r;
  }
  if (cells) shapes.push(S(cells, b, { flat: true }));
  return { flats: [{ group: { shapes, edge: 0 }, pitch: -Math.PI / 2, ppcm: 0.7, lit: 1 }] };
},
  meta: {
    about: "A floor laid flat, a chequer of square tiles in two colours.",
    params: {
      w: { type: "num", default: 1000, about: "cm" },
      d: { type: "num", default: 450, about: "depth, cm" },
      tile: { type: "num", default: 40, about: "tile size, cm" },
      a: { type: "color", about: "a palette id or a hex; default the SET floor_a" },
      b: { type: "color", about: "a palette id or a hex; default the SET floor_b" },
    },
    tags: ["floor", "room"],
  } };

// ---- Windows and doors ----------------------------------------------------------------

/**
 * A window frame `w` × `h` with glazing bars and a sill, in `color`. `kind` `shop`: a big shop window seen from inside
 * (default 240 × 190, dark metal), a transom, the street beyond hinted through it (`view: false` leaves it clear), a
 * sill with a plant, and `curtain` a half curtain on a rod; `lit`: a window seen from the street, curtains drawn
 * back (`curtain` their colour), its pane glowing warm at night off the place's switch, from `glowAt` of the dusk.
 */
const windowFrame: PieceDef = { draw(p, r) {
  if (str(p.kind, "") === "shop") return shopWindow(p, r);
  const w = num(p.w, 150), h = num(p.h, 120), c = hex(p.color, "#F4F1EA"), f = 8;
  const frame = rect(-w / 2 - f, -h - f, w + 2 * f, h + 2 * f).add(rect(-w / 2, -h, w, h));
  const shapes: Shape[] = [
    S(frame, c, { evenodd: true }),
    S(rect(-3, -h, 6, h), c), S(rect(-w / 2, -h * 0.62 - 3, w, 6), c),
    S(rect(-w / 2 - f - 6, -2, w + 2 * f + 12, 9), tone(c, "shade")),
    L([[-w * 0.4, -h * 0.2], [-w * 0.18, -h * 0.55]], "#FFFFFF", 3, 0.35), L([[w * 0.1, -h * 0.25], [w * 0.3, -h * 0.55]], "#FFFFFF", 2, 0.3),
  ];
  if (str(p.kind, "") === "lit") return litWindow(p, r, shapes, w, h);
  return { flats: [{ group: { shapes, edge: 1 }, ppcm: 1.6, shadow: "drop" }] };
}, variants: { shop: { kind: "shop" }, lit: { kind: "lit" } },
  meta: {
    about: "A window frame with glazing bars and a sill; a big shop window seen from inside, or a window seen from the street glowing at night.",
    params: {
      kind: { type: "enum", values: ["plain", "shop", "lit"], default: "plain", about: "shop: a shop window from inside; lit: seen from the street" },
      w: { type: "num", about: "cm; default 150, shop 240" },
      h: { type: "num", about: "cm; default 120, shop 190" },
      color: { type: "color", about: "the frame, a palette id or a hex; default #F4F1EA, shop #4C5A63" },
      curtain: { type: ["color", "bool"], about: "shop: a half curtain (fabric id or hex, true for fab_01); lit: the drawn curtains, default seeded" },
      view: { type: "bool", default: true, about: "shop: the street hinted beyond" },
      glowAt: { type: "num", min: 0, max: 1, default: 0.1, about: "lit: from this share of the dusk it glows" },
    },
    tags: ["window", "light"],
  } };

/** A shop door `w` × `h` in `color`: a frame with the bell, and a glazed leaf that swings inward when the door opens. */
const doorShop: PieceDef = { draw(p) {
  const w = num(p.w, 105), h = num(p.h, 220), c = hex(p.color, "#5B6770"), f = 7;
  const frame: Shape[] = [
    S(rect(-w / 2 - f, -h - f, w + 2 * f, h + f).add(rect(-w / 2, -h, w, h)), c, { evenodd: true }),
    // the bell over the door
    L([[w / 2 - 10, -h - f], [w / 2 - 10, -h + 6]], "#3B3B40", 1, 1), S(smooth([[w / 2 - 16, -h + 14], [w / 2 - 10, -h + 4], [w / 2 - 4, -h + 14]], true), "#D9A72E"),
  ];
  // the leaf: a glazed door that swings into the shop on its left hinge
  const lw = w - 2, lx = -w / 2 + 1;
  const leaf: Shape[] = [
    S(rect(lx, -h + 1, lw, h - 2).add(rect(lx + 7, -h + 8, lw - 14, h - 26)), c, { evenodd: true }),
    S(rect(lx + 7, -h + 8, lw - 14, h - 26), "#CFE6EE", { flat: true, opacity: 0.22 }),
    S(rrect(lx + lw - 16, -h * 0.52, 5, 22, 2.5), tone(c, "light")),
    L([[-w * 0.3, -h * 0.25], [-w * 0.05, -h * 0.6]], "#FFFFFF", 3, 0.3),
    // a hanging open sign, without words (signs with words are labels)
    L([[-10, -h + 14], [0, -h + 28], [10, -h + 14]], "#3B3B40", 0.8, 1), S(rrect(-16, -h + 28, 32, 16, 2), "#F7F3EA"), S(rrect(-13, -h + 31, 26, 10, 1.5), "#2F8C88", { flat: true }),
  ];
  return { flats: [
    { group: { shapes: frame, edge: 1 }, ppcm: 1.8 },
    { group: { shapes: leaf, edge: 0.8 }, ppcm: 1.8, z: 1, id: "leaf", hinge: lx, swing: -1.25 },
  ] };
},
  meta: {
    about: "A shop door: a frame with a bell and a glazed leaf that swings inward when the door opens.",
    params: {
      w: { type: "num", default: 105, about: "cm" },
      h: { type: "num", default: 220, about: "cm" },
      color: { type: "color", default: "#5B6770", about: "a palette id or a hex" },
    },
    tags: ["door", "shop"],
  } };

// ---- Furniture ------------------------------------------------------------------------

const GOODS = ["#C4553A", "#E0A83A", "#2F8C88", "#4E7A68", "#2E3A59", "#D9534A", "#F2B705", "#7A3E6E", "#8DB8DA", "#B98A57", "#F7F3EA", "#6F7A45"];

function goodsRow(x0: number, x1: number, y: number, maxH: number, r: Rng): Shape[] {
  const out: Shape[] = [];
  let x = x0 + 3;
  while (x < x1 - 8) {
    const kind = r.pick(["box", "box", "can", "jar", "bottle", "bag", "tea"]);
    const c = r.pick(GOODS);
    if (kind === "box") {
      const w = r.range(10, 18), h = Math.min(maxH, r.range(16, 28));
      out.push(S(rrect(x, y - h, w, h, 1), c), S(rect(x, y - h * 0.62, w, h * 0.26), mix(c, "#FFFFFF", 0.55), { flat: true }));
      x += w + 1;
    } else if (kind === "can") {
      for (let k = 0; k < r.int(2, 3); k++) { out.push(S(rrect(x, y - 12, 8, 12, 1.5), c), S(rect(x, y - 8, 8, 4), "#F7F3EA", { flat: true }), S(rect(x, y - 12, 8, 1.4), SET.steel, { flat: true })); x += 8.6; }
      x += 1;
    } else if (kind === "jar") {
      out.push(S(rrect(x, y - 14, 10, 14, 3), mix(c, "#FFFFFF", 0.25)), S(rrect(x + 0.5, y - 16, 9, 3, 1), "#D9A72E"));
      x += 11;
    } else if (kind === "bottle") {
      const h = Math.min(maxH, 26);
      out.push(P([[x + 2, y, 0], [x + 8, y, 0], [x + 8, y - h * 0.6], [x + 6.2, y - h * 0.78], [x + 6.2, y - h, 0], [x + 3.8, y - h, 0], [x + 3.8, y - h * 0.78], [x + 2, y - h * 0.6]], mix(c, "#3B5E3B", 0.3)));
      x += 9.5;
    } else if (kind === "bag") {
      out.push(P([[x, y, 0], [x + 15, y, 0], [x + 14, y - 15], [x + 12, y - 18, 0], [x + 3, y - 18, 0], [x + 1, y - 15]], r.pick(["#E6D3A8", "#D9B98C", "#EFE2C6"])), S(rect(x + 3, y - 11, 9, 5), c, { flat: true }));
      x += 16;
    } else {
      out.push(S(rrect(x, y - 20, 12, 20, 1), "#3E7A3A"), S(ellipse(x + 6, y - 11, 3.2, 4.4), "#8CC56E", { flat: true }), S(rect(x, y - 20, 12, 3), "#B3261E", { flat: true }));
      x += 13;
    }
  }
  return out;
}

/**
 * Wooden shelves `w` × `h` with `rows` rows of seeded goods (tins, jars, packets, bottles). `kind` `books`: a bookcase
 * (default 120 × 200, `rows` 5) of seeded book spines, a few leaning or lying; `bread`: a bakery's slanted bread rack
 * (160 × 190, `rows` 4) of somun, long loaves, simits and dark loaves, `fill` (0…1) the share of its places filled.
 */
const shelf: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "");
  if (kind === "books") return bookcase(p, r);
  if (kind === "bread") return breadRack(p, r);
  const w = num(p.w, 220), h = num(p.h, 230), rows = num(p.rows, 5), wood = SET.wood, depth = 6;
  const shapes: Shape[] = [S(rect(-w / 2, -h, w, h), tone(wood, "shade")), S(rect(-w / 2 + depth, -h + depth, w - 2 * depth, h - depth - 10), mix(tone(wood, "deep"), "#3A2A20", 0.3), { flat: true })];
  const gap = (h - 20) / rows;
  for (let i = 0; i < rows; i++) {
    const y = -10 - i * gap;
    shapes.push(...goodsRow(-w / 2 + depth, w / 2 - depth, y - 3, gap - 8, r));
    shapes.push(S(rect(-w / 2, y - 3, w, 5), SET.wood_light), S(rect(-w / 2, y + 2, w, 1.5), tone(wood, "deep"), { flat: true, opacity: 0.6 }));
  }
  shapes.push(S(rect(-w / 2, -h, depth, h), wood), S(rect(w / 2 - depth, -h, depth, h), wood), S(rect(-w / 2 - 2, -h - 6, w + 4, 8), wood), S(rect(-w / 2, -10, w, 10), tone(wood, "shade")));
  return { flats: [{ group: { shapes, edge: 0.8 }, ppcm: 2.4, shadow: "drop" }] };
}, variants: { books: { kind: "books" }, books_tall: { kind: "books", w: 110, h: 270, rows: 7 }, bread_rack: { kind: "bread" } },
  meta: {
    about: "Wooden shelves of seeded goods; a bookcase of seeded spines, or a bakery's slanted bread rack.",
    params: {
      kind: { type: "enum", values: ["plain", "books", "bread"], default: "plain", about: "books: a bookcase; bread: a bread rack" },
      w: { type: "num", about: "cm; default 220, books 120, bread 160" },
      h: { type: "num", about: "cm; default 230, books 200, bread 190" },
      rows: { type: "int", min: 1, about: "default 5, bread 4" },
      color: { type: "color", about: "books: the wood, a fabric or SET id or a hex; default seeded" },
      fill: { type: "num", min: 0, max: 1, default: 1, about: "bread: share of the places filled" },
    },
    tags: ["furniture", "shop", "food", "paper"],
  } };

/**
 * A shop counter `w` × `h` with panelled front, a till and a jar of sweets on top. `kind`: `shop` (a glass display
 * counter: `goods` `cakes`, `bread` or `flowers` inside on two shelves, `prices` one price label per tray; flowers
 * bring paper and ribbon on top), `office` (an agency's counter: a laminate front with a band in `color` and `label`
 * on it, a raised ledge, leaflets), `glass` (a public office's counter with a glass screen, a speaking hole and a
 * document slot per window, `label` over each) or `cafe` (a tiled café counter, cups, tea glasses and a cake under a dome).
 */
const counter: PieceDef = { draw(p, r) {
  const kind = str(p.kind, "");
  if (kind) return counterKind(kind, p, r);
  const w = num(p.w, 240), h = num(p.h, 98), wood = SET.wood;
  const panel = (x: number, pw: number): Shape[] => [S(rect(x, -h + 22, pw, h - 38), tone(wood, "shade")), S(rect(x + 4, -h + 26, pw - 8, h - 46), wood, { flat: true })];
  const front: Shape[] = [S(rect(-w / 2, -h, w, h), wood)];
  const n = Math.max(2, Math.round(w / 70)), pw = (w - 20) / n;
  for (let i = 0; i < n; i++) front.push(...panel(-w / 2 + 10 + i * pw + 4, pw - 8));
  front.push(S(rrect(-w / 2 - 6, -h - 7, w + 12, 9, 2), SET.wood_light), S(rect(-w / 2, -10, w, 10), tone(wood, "deep")));
  // things on the counter, standing just behind its front edge
  const items: Shape[] = [];
  const sx = w / 2 - 46;
  items.push(S(rrect(sx - 16, -10, 32, 10, 2), SET.steel), S(rrect(sx - 13, -24, 26, 12, 2), "#E9E4DA"), S(rect(sx - 8, -21, 16, 6), "#3A6B5A", { flat: true }), S(ellipse(sx, -27, 16, 3), SET.steel));
  const jx = -w / 2 + 34;
  items.push(S(rrect(jx - 10, -26, 20, 26, 5), "#DCEFF5", { opacity: 0.55 }), S(rrect(jx - 9, -30, 18, 5, 2), "#C4553A"));
  for (let k = 0; k < 6; k++) items.push(S(ellipse(jx - 5 + (k % 3) * 5, -6 - Math.floor(k / 3) * 6, 2.4), r.pick(GOODS), { flat: true }));
  return { flats: [
    { group: { shapes: items, edge: 0.6 }, z: -16, y: h, ppcm: 3 },
    { group: { shapes: front, edge: 0.9 }, ppcm: 2.4, shadow: "drop" },
  ] };
}, variants: { shop: { kind: "shop" }, office: { kind: "office" }, glass: { kind: "glass" }, cafe: { kind: "cafe" } },
  meta: {
    about: "A shop counter with a till and a sweet jar; or a glass display counter, an agency's, a public office's glass one, or a café's.",
    params: {
      kind: { type: "enum", values: ["shop", "office", "glass", "cafe"], about: "unset: a panelled wooden shop counter" },
      w: { type: "num", about: "cm; default 240, glass 160, others 200" },
      h: { type: "num", about: "cm; default 98, shop 92" },
      goods: { type: "enum", values: ["cakes", "bread", "flowers"], default: "cakes", about: "shop: what is in the display" },
      prices: { type: ["list", "text"], about: "shop: one price label per tray" },
      label: { type: ["text", "list"], about: "office: the word on its band; glass: one label per window, a list" },
      color: { type: "color", about: "office: the band, a fabric or SET id or a hex; default seeded" },
    },
    tags: ["furniture", "shop", "food"],
  } };

/**
 * A drinks fridge. `clear` keeps stretches of its shelves empty for props (`{shelf, x, w}`, cm from its middle; shelf 0 is
 * the lowest). `kind` `home`: a household fridge-freezer, white (or `color`), the freezer door over the fridge door, long
 * handles, a few magnets and a child's drawing on it; as a prop, hidden, it leaves the dashed outline of a fridge that is not there.
 */
const fridge: PieceDef = { draw(p, r) {
  if (str(p.kind, "drinks") === "home") return homeFridge(p, r);
  const w = num(p.w, 85), h = num(p.h, 195), body = "#F2F1EC";
  const clear = (p.clear as { shelf: number; x: number; w: number }[] | undefined) ?? [];
  const inner: Shape[] = [S(rect(-w / 2, -h, w, h), body), S(rect(-w / 2 + 6, -h + 30, w - 12, h - 52), "#2F3B44", { flat: true })];
  inner.push(S(rect(-w / 2, -h, w, 26), "#2F8C88"), S(rrect(-w / 2 + 10, -h + 7, w - 20, 12, 6), "#F7F3EA", { flat: true }));
  for (let i = 0; i < 4; i++) {
    const y = -26 - i * ((h - 56) / 4);
    shapes4(inner, -w / 2 + 8, w / 2 - 8, y, r, clear.filter(c => c.shelf === i).map(c => [c.x - c.w / 2, c.x + c.w / 2] as [number, number]));
    inner.push(S(rect(-w / 2 + 6, y, w - 12, 2), "#AEB8BE"));
  }
  const glass: Shape[] = [
    S(rect(-w / 2 + 6, -h + 30, w - 12, h - 52), "#CFE6EE", { flat: true, opacity: 0.16 }),
    L([[-w * 0.3, -h * 0.25], [-w * 0.08, -h * 0.62]], "#FFFFFF", 3, 0.35), L([[w * 0.05, -h * 0.3], [w * 0.22, -h * 0.55]], "#FFFFFF", 2, 0.28),
    S(rrect(w / 2 - 14, -h * 0.6, 4, 40, 2), "#AEB8BE"),
  ];
  return { flats: [{ group: { shapes: inner, edge: 0.8 }, ppcm: 2.2, shadow: "drop" }, { group: { shapes: glass, edge: 0 }, z: 3, ppcm: 2.2 }] };
},
  meta: {
    about: "A glass-fronted drinks fridge of seeded bottles and cartons, with stretches of shelf kept clear for props; or a household fridge-freezer.",
    params: {
      kind: { type: "enum", values: ["drinks", "home"], default: "drinks", about: "home: a household fridge-freezer with magnets" },
      w: { type: "num", about: "cm (85 drinks, 64 home)" },
      h: { type: "num", about: "cm (195 drinks, 172 home)" },
      clear: { type: "list", about: "drinks: {shelf, x, w} stretches kept empty; shelf 0 the lowest, cm from its middle" },
      color: { type: "color", about: "home: the body; default white" },
    },
    terms: ["buzdolabı"],
    tags: ["furniture", "shop", "food", "kitchen"],
  }, variants: { home: { kind: "home" } } };

/** A household fridge-freezer `w` × `h` cm: the freezer door over the fridge door, a gasket line between, long handles at the right, a few magnets and a child's drawing. */
function homeFridge(p: Record<string, unknown>, r: Rng): PieceOut {
  const w = num(p.w, 64), h = num(p.h, 172), c = typeof p.color === "string" ? hex(p.color, "#F1F1EE") : "#F1F1EE", fz = Math.round(h * 0.34), steel = "#B9C0C5";
  const sh: Shape[] = [S(rrect(-w / 2, -h, w, h, 4), c), S(rect(w / 2 - 6, -h + 3, 6, h - 6), tone(c, "shade"), { flat: true, opacity: 0.5 })];
  sh.push(S(rect(-w / 2 + 1, -h + fz, w - 2, 1.6), tone(c, "deep"), { flat: true, opacity: 0.7 }), S(rect(-w / 2 + 3, -4, w - 6, 4), "#5C6166"));
  sh.push(S(rrect(w / 2 - 10, -h + fz - 30, 3.2, 24, 1.6), steel), S(rrect(w / 2 - 10, -h + fz + 10, 3.2, 46, 1.6), steel));
  sh.push(L([[-w / 2 + 6, -h + 8], [-w / 2 + 6, -h + fz - 8]], "#FFFFFF", 2.5, 0.4), L([[-w / 2 + 6, -h + fz + 12], [-w / 2 + 6, -30]], "#FFFFFF", 2.5, 0.35));
  // the drawing: a sun and a house in crayon, held by a magnet; three more magnets
  const dx = -w / 2 + 10 + r.range(0, 6), dy = -h + fz + 22;
  sh.push(S(rect(dx, dy, 24, 18), "#FBF7EE"), S(ellipse(dx + 6, dy + 5, 3), "#F2B705", { flat: true }), P([[dx + 11, dy + 15, 0], [dx + 21, dy + 15, 0], [dx + 21, dy + 9, 0], [dx + 16, dy + 5, 0], [dx + 11, dy + 9, 0]], "#D9534A", { flat: true }), S(ellipse(dx + 12, dy + 1, 2.2), "#2F8C88"));
  for (const [mx, my, mc] of [[w / 2 - 22, -h + 16, "#4F6E9E"], [-w / 2 + 14, -h + fz - 16, "#E0A83A"], [w / 2 - 24, -h + fz + 60, "#D9534A"]] as [number, number, string][]) sh.push(S(rrect(mx - 3.5, my - 2.5, 7, 5, 1.5), mc));
  return { flats: [{ group: { shapes: sh, edge: 0.8 }, ppcm: 2.2, shadow: "drop" }] };
}

function shapes4(out: Shape[], x0: number, x1: number, y: number, r: Rng, skip: [number, number][] = []) {
  let x = x0 + 2;
  while (x < x1 - 8) {
    const gap = skip.find(([a, b]) => x + 8.5 > a && x < b);
    if (gap) { x = gap[1] + 1; continue; }
    if (r.chance(0.5)) { out.push(S(rrect(x, y - 13, 7, 13, 2), "#F7F3EA"), S(rect(x, y - 13, 7, 3), r.pick(["#2F8C88", "#E0A83A", "#4F6E9E"]), { flat: true })); x += 8; }
    else { out.push(P([[x + 1, y, 0], [x + 7, y, 0], [x + 7, y - 14], [x + 5, y - 18, 0], [x + 3, y - 18, 0], [x + 1, y - 14]], r.pick(["#8DB8DA", "#F2B705", "#D9534A", "#9CD3C0"]), { opacity: 0.9 })); x += 8.5; }
  }
}

/**
 * A hanging pendant lamp: shade, bulb glow and a warm light. `kind`: `wall` (a landing's wall lamp, a frosted globe on
 * a brass bracket), `desk` (a desk lamp on a jointed arm, its light on the desk) or `standing` (a floor lamp, a fabric
 * shade on a tall pole); `color` its shade.
 */
const lamp: PieceDef = { draw(p) {
  const kind = str(p.kind, "");
  if (kind) return lampKind(kind, p);
  // the shade seen a little from below: its mouth an ellipse, dark inside by day; the bulb sits up inside it
  const c = "#2F8C88", mouth = ellipse(0, 0, 21, 3.4), inside = { flat: true, clip: mouth };
  const shapes: Shape[] = [L([[0, -80], [0, -16]], "#3B3B40", 1, 1), S(rrect(-3, -21, 6, 4, 1), "#3B3B40"), P([[-6, -18, 0], [6, -18, 0], [22, 0, 0], [-22, 0, 0]], c),
    S(poly([[-4, -17], [-1, -17], [-14, -1], [-19, -1]]), tone(c, "light"), { flat: true, opacity: 0.35 }), S(ellipse(0, 0, 22, 4), tone(c, "shade")), S(mouth, tone(c, "deep")),
    S(ellipse(0, -2.6, 6, 4), "#EFE8D6", inside)];
  // lit, the inside of the shade glows and the bulb with it: all of it within the mouth, nothing hanging below
  const glow: Shape[] = [S(mouth, "#FFD98A", { flat: true, opacity: 0.85 }), S(ellipse(0, -1.2, 13, 3), "#FFE6A8", inside), S(ellipse(0, -2.6, 6, 4), "#FFF8E6", inside)];
  return { flats: [{ group: { shapes, edge: 0.6 }, emissive: { shapes: glow, edge: 0 }, ppcm: 3 }], lights: [{ x: 0, y: -20, z: 40, color: "#FFD59A", radius: 4.2, intensity: 0.75 }] };
}, variants: { wall: { kind: "wall" }, desk: { kind: "desk" }, standing: { kind: "standing" } },
  meta: {
    about: "A lamp that lights: a hanging pendant, a wall globe, a desk lamp on a jointed arm or a standing floor lamp.",
    params: {
      kind: { type: "enum", values: ["wall", "desk", "standing"], about: "unset: a hanging pendant" },
      color: { type: "color", about: "the shade or globe (not the pendant's), a fabric or SET id or a hex" },
    },
    tags: ["light", "furniture"],
  } };

/** A clock face of radius `r` centred at (0, `cy`) showing `time` ("hh:mm"), its rim in `rim`. */
function dial(cy: number, r: number, time: unknown, rim: string): Shape[] {
  const [hh, mm] = String(time ?? "10:10").split(":").map(Number);
  const a = (v: number) => -Math.PI / 2 + v * Math.PI * 2;
  const hand = (ang: number, len: number, w: number): Shape => ({ path: poly([[Math.cos(ang - 1.5708) * w, Math.sin(ang - 1.5708) * w], [Math.cos(ang) * len, Math.sin(ang) * len], [Math.cos(ang + 1.5708) * w, Math.sin(ang + 1.5708) * w]]).move(0, cy), fill: "#2B2420", flat: true });
  const shapes: Shape[] = [S(ellipse(0, cy, r + 2.2, r + 2.2), rim), S(ellipse(0, cy, r, r), "#FBF7EE")];
  for (let i = 0; i < 12; i++) { const t = a(i / 12); shapes.push(L([[Math.cos(t) * r * 0.8, cy + Math.sin(t) * r * 0.8], [Math.cos(t) * r * 0.93, cy + Math.sin(t) * r * 0.93]], "#2B2420", i % 3 ? 0.7 : 1.4, 1)); }
  shapes.push(hand(a(((hh % 12) + mm / 60) / 12), r * 0.52, 1.1), hand(a(mm / 60), r * 0.8, 0.8), S(ellipse(0, cy, 1.2, 1.2), "#B3261E"));
  return shapes;
}

/**
 * A wall clock of radius `r` showing `time` ("hh:mm"). `kind` `hall`: a longcase hall clock, 194 cm, its dial (`r`
 * default 13) in the hood and its pendulum swinging behind the trunk's glass.
 */
const clock: PieceDef = { draw(p) {
  if (str(p.kind, "") === "hall") return hallClock(p);
  const r = num(p.r, 16);
  return { flats: [{ group: { shapes: dial(-r, r, p.time, "#2E3A59"), edge: 0.5 }, ppcm: 5, shadow: "drop" }] };
}, variants: { hall: { kind: "hall" } },
  meta: {
    about: "A wall clock showing a time, or a longcase hall clock with its pendulum swinging.",
    params: {
      kind: { type: "enum", values: ["plain", "hall"], default: "plain", about: "hall: a longcase hall clock" },
      r: { type: "num", about: "the dial's radius, cm; default 16, hall 13" },
      time: { type: "text", default: "10:10", about: "hh:mm" },
      color: { type: "color", about: "hall: the case wood, a fabric or SET id or a hex" },
    },
    tags: ["clock", "wall", "hung"],
  } };

/**
 * A framed picture `w` × `h`: tea terraces on green hills (İsmail's Rize). `kind` `photo`: a framed family photo
 * (default 22 × 16, `stand` on its strut on a desk), `people` faceless paper figures in it (default 3, the last a
 * child); `sepia`: `n` old sepia photos of the neighbourhood in a row of frames (default 3): streets with a tram,
 * a domed building, a group in hats.
 */
const picture: PieceDef = { draw(p, rr) {
  const kind = str(p.kind, "");
  if (kind === "photo") return familyPhoto(p, rr);
  if (kind === "sepia") return sepiaPhotos(p, rr);
  const w = num(p.w, 60), h = num(p.h, 42), f = 4;
  const shapes: Shape[] = [S(rect(-w / 2 - f, -h - f, w + 2 * f, h + 2 * f), SET.wood_dark), S(rect(-w / 2, -h, w, h), "#BFE0EE")];
  // tea terraces on green hills: İsmail's Rize
  shapes.push(P([[-w / 2, -h * 0.55], [-w * 0.2, -h * 0.8], [w * 0.15, -h * 0.62], [w / 2, -h * 0.85], [w / 2, 0, 0], [-w / 2, 0, 0]], "#5E9A55"));
  shapes.push(P([[-w / 2, -h * 0.3], [0, -h * 0.5], [w / 2, -h * 0.4], [w / 2, 0, 0], [-w / 2, 0, 0]], "#3E7A3A"));
  for (let i = 0; i < 6; i++) { const y = -h * 0.08 - i * h * 0.075; shapes.push(L([[-w / 2 + 2, y - i * 0.6], [-w * 0.1, y - h * 0.08], [w / 2 - 2, y - i * 1.2]], "#8CC56E", 1.2, 0.8)); }
  shapes.push(S(ellipse(w * 0.3, -h * 0.8, 4, 4), "#FFF1C2", { flat: true }));
  return { flats: [{ group: { shapes, edge: 0.6 }, ppcm: 4, shadow: "drop" }] };
}, variants: { photo: { kind: "photo", stand: true }, sepia: { kind: "sepia" } },
  meta: {
    about: "A framed picture of tea terraces on green hills; a framed family photo, or a row of old sepia photos.",
    params: {
      kind: { type: "enum", values: ["plain", "photo", "sepia"], default: "plain", about: "photo: a family photo; sepia: a row of old photos" },
      w: { type: "num", about: "cm; default 60, photo 22" },
      h: { type: "num", about: "cm; default 42, photo 16" },
      people: { type: "int", min: 1, max: 6, default: 3, about: "photo: figures in it, the last a child" },
      stand: { type: "bool", about: "photo: on its strut on a desk" },
      n: { type: "int", min: 1, max: 8, default: 3, about: "sepia: how many frames" },
    },
    tags: ["picture", "wall", "hung"],
  } };

/**
 * A wall calendar with one day marked red. `month` names it on the red head; `day` (1–31) is circled in red pen, its
 * cell found from `start`, the weekday the month starts on (0 Monday … 6 Sunday); `note` is written in red under the days.
 */
const calendar: PieceDef = { draw(p) {
  const note = str(p.note, ""), month = str(p.month, ""), day = Math.round(num(p.day, 0)), start = Math.max(0, Math.min(6, Math.round(num(p.start, 0))));
  const H = note ? 56 : 46, shapes: Shape[] = [S(rect(-17, -H, 34, H), "#FBF7EE"), S(rect(-17, -H, 34, 9), "#B3261E"), S(ellipse(0, -H - 2, 1.4, 1.4), "#3B3B40")];
  const cell = day >= 1 && day <= 31 ? day - 1 + start : day ? -1 : 12, text: TextSpec[] = [];
  for (let j = 0; j < 5; j++) for (let i = 0; i < 7; i++) shapes.push(S(rect(-14.5 + i * 4.2, -H + 12 + j * 6.2, 3.2, 4.4), !day && j === 1 && i === 5 ? "#D9534A" : "#D8CFBF", { flat: true }));
  if (day && cell >= 0) { const cx = -12.9 + (cell % 7) * 4.2, cy = -H + 14.2 + Math.min(4, Math.floor(cell / 7)) * 6.2; shapes.push({ path: ellipse(cx, cy, 3.2, 3.6), stroke: { color: "#C4302B", width: 0.7 }, flat: true }); }
  if (month) text.push({ text: month, x: -15, y: -H + 1.2, w: 30, h: 6.5, size: 4.6, font: "print", weight: 700, color: "#FBF7EE" });
  if (note) text.push({ text: note, x: -15.5, y: -10, w: 31, h: 8, size: 4.4, font: "hand", weight: 700, color: "#C4302B" });
  return { flats: [{ group: { shapes, edge: 0.4 }, ppcm: 4, shadow: "drop", ...(text.length ? { text } : {}) }] };
}, meta: {
  about: "A wall calendar with one day marked red; its month on the head, a day circled and a note written under the days.",
  params: {
    month: { type: "text", about: "the month's name on the red head" },
    day: { type: "int", min: 0, max: 31, about: "the day circled in red (0: a seeded red day, none circled)" },
    start: { type: "int", min: 0, max: 6, default: 0, about: "the weekday the month starts on, 0 Monday … 6 Sunday" },
    note: { type: "text", about: "a note in red pen under the days" },
  },
  terms: ["tarih"], tags: ["paper", "wall", "hung"],
} };

// ---- The variants' looks ---------------------------------------------------------

type Sh = Shape[];
const R = (x: number, y: number, w: number, h: number, c: string, o: Partial<Shape> = {}) => S(rect(x, y, w, h), c, o);
const RR = (x: number, y: number, w: number, h: number, k: number, c: string, o: Partial<Shape> = {}) => S(rrect(x, y, w, h, k), c, o);
const E = (x: number, y: number, rx: number, ry: number, c: string, o: Partial<Shape> = {}) => S(ellipse(x, y, rx, ry), c, o);
const fl = (opacity = 1): Partial<Shape> => ({ flat: true, opacity });
const lt = (c: string) => tone(c, "light"), sd = (c: string) => tone(c, "shade"), dk = (c: string) => tone(c, "deep");
const colOf = (v: unknown, d: string) => typeof v === "string" ? FABRIC[v] ?? SET[v] ?? (/^#[0-9a-f]{6}$/i.test(v) ? v : d) : d;
const words = (v: unknown): string[] => (Array.isArray(v) ? v : [v]).map(s => typeof s === "number" ? String(s) : s).filter((s): s is string => typeof s === "string" && s.trim() !== "").map(s => s.trim());
const bar = (x0: number, y0: number, x1: number, y1: number, w: number, c: string): Shape => { const l = Math.hypot(x1 - x0, y1 - y0) || 1, nx = -(y1 - y0) / l * w / 2, ny = (x1 - x0) / l * w / 2; return S(poly([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]), c); };
const HAZE = "#C9D3DC", CRUST = "#C8863F", STEEL = "#B8BEC4", PAPER = "#FBF7EE";

/** A far street: façades muted into the haze by `mute`, small windows, market awnings over the shops; lit windows by turns. */
function farStreet(p: Record<string, unknown>, r: Rng) {
  const w = num(p.w, 1400), mute = num(p.mute, 0.45), ppcm = Math.min(0.3, 1900 / (w + 60)), sh: Sh = [], lit: Shape[] = [], m = (c: string) => mix(c, HAZE, mute);
  let x = -w / 2;
  while (x < w / 2) {
    const bw = r.range(200, 320), h = r.range(640, 1000), c = m(r.pick(FACADES)), floors = Math.floor((h - 260) / 250), cols = Math.max(2, Math.round(bw / 100));
    sh.push(R(x, -h, bw, h, c), R(x - 4, -h - 10, bw + 8, 12, m(tone(c, "shade"))), R(x, -h + 2, 7, h - 2, tone(c, "shade"), fl(0.3)));
    for (let f = 0; f < floors; f++) for (let i = 0; i < cols; i++) {
      const wx = x + (i + 0.25) * bw / cols, wy = -h + 60 + f * 250;
      sh.push(R(wx, wy, bw / cols * 0.5, 120, m("#55657A")));
      if (r.chance(0.35)) lit.push(R(wx + 3, wy + 3, bw / cols * 0.5 - 6, 114, "#FFD27A", fl(1)));
    }
    const aw = m(r.pick(["#B3261E", "#2F8C88", "#E0A83A", "#2E3A59", "#6F7A45"]));
    sh.push(R(x + 12, -240, bw - 24, 200, m("#4C5A63")));
    for (let k = 0; k < 5; k++) sh.push(E(x + 30 + k * (bw - 60) / 4, -60, r.range(18, 30), r.range(14, 22), m(r.pick(["#C4553A", "#E0A83A", "#6F9A4A", "#D9534A", "#F2B705"]))));
    sh.push(P([[x + 6, -262, 0], [x + bw - 6, -262, 0], [x + bw + 4, -206, 0], [x - 4, -206, 0]], aw), ...Array.from({ length: Math.floor(bw / 40) }, (_, k) => R(x + 6 + k * 40, -262, 20, 56, mix("#FFFFFF", HAZE, mute), fl(0.55))));
    x += bw + r.range(0, 6);
  }
  sh.push(R(-w / 2 - 20, -36, w + 40, 40, m("#B9B2A6")), R(-w / 2 - 20, -8, w + 40, 10, m("#8E877C")));
  return { flats: [{ group: { shapes: sh, edge: 1.6 }, switch: false as const, ppcm, lit: 0.85 }, ...litByTurns(lit, { ppcm })] };
}

/** A big shop window seen from inside: dark frame, transom, the street beyond hinted, a sill with a plant, a half curtain. */
function shopWindow(p: Record<string, unknown>, r: Rng) {
  const w = num(p.w, 240), h = num(p.h, 190), a = w / 2, c = hex(p.color, "#4C5A63"), f = 6, ty = -h + h * 0.18;
  const view: Sh = [R(-a, -h, w, h, "#DCE8EE", fl(0.35))];
  let x = -a - 10;
  while (x < a) { const bw = r.range(50, 90), bh = r.range(h * 0.55, h * 1.1), bc = mix(r.pick(FACADES), HAZE, 0.5); view.push(R(x, -bh - 30, bw, bh, bc, { opacity: 0.55, flat: true })); for (let y = -bh - 18; y < -60; y += 34) view.push(R(x + bw * 0.25, y, bw * 0.5, 18, "#8C9BAA", fl(0.4))); x += bw + r.range(2, 10); }
  view.push(R(-a, -30, w, 30, "#B9B2A6", fl(0.55)), R(-a, -32, w, 3, "#8E877C", fl(0.5)));
  const frame: Sh = [S(rect(-a - f, -h - f, w + 2 * f, h + 2 * f).add(rect(-a, -h, w, h)), c, { evenodd: true }), R(-a, ty - 2.5, w, 5, c)];
  const k = Math.max(2, Math.round(w / 90));
  for (let i = 1; i < k; i++) frame.push(R(-a + i * w / k - 1.5, -h, 3, ty + h, c));
  frame.push(R(-a, -h, w, h, "#CFE6EE", fl(0.12)), L([[-a * 0.7, -h * 0.25], [-a * 0.3, -h * 0.7]], "#FFFFFF", 4, 0.3), L([[a * 0.2, -h * 0.2], [a * 0.5, -h * 0.55]], "#FFFFFF", 2.5, 0.25));
  frame.push(R(-a - f - 6, -2, w + 2 * f + 12, 9, tone("#D8CFBF", "shade")), R(-a - f - 6, -3, w + 2 * f + 12, 2, "#D8CFBF"));
  const px = a * r.range(0.45, 0.75) * r.pick([-1, 1]);
  frame.push(P([[px - 9, -3, 0], [px + 9, -3, 0], [px + 11, -20, 0], [px - 11, -20, 0]], "#B8562F"), ...Array.from({ length: 7 }, (_, i) => E(px - 12 + i * 4, -26 - (i % 3) * 5, 5, 3.4, i % 2 ? "#4E7A48" : "#6E9A52")));
  if (p.curtain) {
    const cc = colOf(p.curtain === true ? "fab_01" : p.curtain, FABRIC.fab_01), cy = -h * 0.42;
    frame.push(R(-a - 4, cy - 2, w + 8, 2, "#B58A3A"));
    const pts: Pt[] = [[-a, cy, 0], [a, cy, 0]];
    for (let i = 0; i <= 24; i++) pts.push([a - i * w / 24, cy + h * 0.42 - 6 + (i % 2) * 3]);
    frame.push(P(pts, cc, { opacity: 0.92 }), ...Array.from({ length: 23 }, (_, i) => L([[-a + (i + 1) * w / 24, cy + 2], [-a + (i + 1) * w / 24, cy + h * 0.42 - 8]], sd(cc), 0.6, 0.35)));
  }
  const flats: FlatSpec[] = [], pane = rect(-a, -h, w, h);
  if (p.view !== false) flats.push({ group: { shapes: view.map(s => ({ ...s, clip: pane })), edge: 0 }, z: -2, ppcm: 0.8, lit: 0.9 });
  flats.push({ group: { shapes: frame, edge: 1 }, ppcm: Math.min(1.6, 1900 / (w + 40)), shadow: "drop" });
  return { flats };
}

/** The window seen from the street at night: a dark pane, curtains drawn back, its glow (off the place's switch). */
function litWindow(p: Record<string, unknown>, r: Rng, frame: Shape[], w: number, h: number) {
  const cc = colOf(p.curtain, FABRIC[r.pick(["fab_02", "fab_15", "fab_10", "fab_07", "fab_12"])]), a = w / 2, pane: Sh = [R(-a, -h, w, h, "#46556A"), E(0, -h * 0.85, w * 0.12, 3, "#F4EBD8", fl(0.6))];
  for (const s of [-1, 1]) pane.push(P([[s * a, -h, 0], [s * (a - w * 0.22), -h, 0], [s * (a - w * 0.14), -h * 0.5], [s * (a - w * 0.06), -h * 0.38, 0], [s * (a - w * 0.1), -h * 0.2], [s * (a - w * 0.18), 0, 0], [s * a, 0, 0]], cc), L([[s * (a - w * 0.08), -h * 0.9], [s * (a - w * 0.06), -h * 0.45]], sd(cc), 1.2, 0.5));
  const glow: Sh = [R(-a + w * 0.12, -h, w * 0.76, h, "#FFD27A", fl(0.9)), E(0, -h * 0.6, w * 0.3, h * 0.35, "#FFE9B8", fl(0.8)), ...[-1, 1].map(s => R(s > 0 ? a - w * 0.2 : -a, -h, w * 0.2, h, "#FFB866", fl(0.35)))];
  return { flats: [{ group: { shapes: [...pane, ...frame], edge: 1 }, emissive: { shapes: glow, edge: 0 }, switch: false as const, glowAt: num(p.glowAt, 0.1), ppcm: 1.6, shadow: "drop" as const }] };
}

const BOOKS = ["#8C2F2B", "#2E3A59", "#4E7A68", "#B98A57", "#6B4A35", "#C4553A", "#E0A83A", "#3C6E9E", "#7A3E6E", "#D8C3A0", "#2F5D4A", "#A23F28", "#F0E2C8"];

/** A bookcase of seeded spines; tall ones (over 240 cm) get a deeper cornice and brass shelf labels. */
function bookcase(p: Record<string, unknown>, r: Rng) {
  const w = num(p.w, 120), h = num(p.h, 200), rows = Math.max(1, Math.round(num(p.rows, 5))), wood = colOf(p.color, r.pick([SET.wood, SET.wood_dark, "#8B5E3C"])), d = 5, tall = h > 240, gap = (h - 22) / rows;
  const sh: Sh = [R(-w / 2, -h, w, h, mix(dk(wood), "#2A2018", 0.35))];
  for (let i = 0; i < rows; i++) {
    const y = -12 - i * gap;
    let x = -w / 2 + d + 1;
    while (x < w / 2 - d - 3) {
      const roll = r(), bw = r.range(2.4, 5.8), bh = Math.min(gap - 5, r.range(gap * 0.58, gap * 0.9)), c = r.pick(BOOKS);
      if (roll < 0.05 && x < w / 2 - d - 20) { x += r.range(6, 12); continue; }
      if (roll < 0.1 && x < w / 2 - d - 26) { let yy = y - 3; for (let k = 0; k < r.int(2, 4); k++) { const lw = r.range(17, 22), lh = r.range(2.5, 4); sh.push(R(x, yy - lh, lw, lh, r.pick(BOOKS)), R(x, yy - lh, 1.2, lh, PAPER, fl(0.6))); yy -= lh; } x += 23; continue; }
      if (roll < 0.14 && x + bw + bh * 0.3 < w / 2 - d - 1) { const tilt = bh * 0.3; sh.push(S(poly([[x, y - 3], [x + bw, y - 3], [x + bw + tilt, y - 3 - bh * 0.95], [x + tilt, y - 3 - bh * 0.95]]), c)); x += bw + tilt + 0.5; continue; }
      if (x + bw > w / 2 - d) break;
      sh.push(R(x, y - 3 - bh, bw, bh, c), R(x, y - bh, bw, 0.9, lt(c), fl(0.55)), R(x, y - 3 - bh + 2, bw, 0.9, lt(c), fl(0.55)));
      if (r.chance(0.35)) sh.push(R(x + bw * 0.2, y - 3 - bh * 0.6, bw * 0.6, bh * 0.16, PAPER, fl(0.5)));
      x += bw + r.range(0, 0.6);
    }
    sh.push(R(-w / 2, y - 3, w, 4, wood), R(-w / 2, y - 3, w, 1, lt(wood), fl(0.6)));
    if (tall) sh.push(R(-5, y - 2.4, 10, 2.6, "#C9A43A"));
  }
  const top = tall ? 14 : 8;
  sh.push(R(-w / 2, -h, d, h, wood), R(w / 2 - d, -h, d, h, wood), R(-w / 2 - 3, -h - top + 2, w + 6, top, wood), R(-w / 2 - 3, -h - top + 2, w + 6, 2, lt(wood), fl(0.6)), R(-w / 2, -12, w, 12, sd(wood)));
  if (tall) sh.push(R(-w / 2 - 1, -h - 2, w + 2, 3, dk(wood)));
  return { flats: [{ group: { shapes: sh, edge: 0.7 }, ppcm: Math.min(2.4, 1900 / (h + 20)), shadow: "drop" as const }] };
}

/** One somun on its base at (x, y). */
const somun = (x: number, y: number, w: number, h: number, c = CRUST): Sh => [P([[x - w / 2, y, 0], [x + w / 2, y, 0], [x + w / 2 - 1, y - h * 0.55], [x + w * 0.3, y - h], [x - w * 0.3, y - h], [x - w / 2 + 1, y - h * 0.55]], c), L([[x - w * 0.26, y - h * 0.7], [x - w * 0.04, y - h * 0.88]], tone(c, "light"), 1.2, 0.9), L([[x + w * 0.02, y - h * 0.7], [x + w * 0.24, y - h * 0.88]], tone(c, "light"), 1.2, 0.9)];

/** A bakery's bread rack: slanted shelves of loaves, the places filled in a scattered order up to `fill`. */
function breadRack(p: Record<string, unknown>, r: Rng) {
  const w = num(p.w, 160), h = num(p.h, 190), rows = Math.max(1, Math.round(num(p.rows, 4))), fill = Math.min(1, Math.max(0, num(p.fill, 1))), wood = "#B5835A", gap = (h - 30) / rows, sh: Sh = [R(-w / 2, -h, w, h - 10, mix(wood, "#3A2A20", 0.45))];
  for (let x = -w / 2 + 12; x < w / 2; x += 12) sh.push(L([[x, -h + 4], [x, -14]], dk(wood), 0.8, 0.5));
  let slot = 0;
  for (let i = 0; i < rows; i++) {
    const y = -20 - i * gap, kind = ["somun", "long", "simit", "dark"][i % 4];
    sh.push(S(poly([[-w / 2 + 4, y - 12], [w / 2 - 4, y - 12], [w / 2 - 4, y], [-w / 2 + 4, y]]), lt(wood)));
    const sw = kind === "long" ? 13 : kind === "simit" ? 17 : 24, n = Math.floor((w - 12) / sw);
    for (let k = 0; k < n; k++) {
      const x = -w / 2 + 6 + (k + 0.5) * (w - 12) / n, j = r.range(-1, 1), on = ((slot++ * 7919) % 101) / 101 < fill - 1e-9;
      if (!on) continue;
      if (kind === "somun" || kind === "dark") sh.push(...somun(x + j, y - 5, 22, 11, kind === "dark" ? "#8A5A34" : CRUST));
      else if (kind === "long") sh.push(S(poly([[x - 4, y - 4], [x + 2, y - 4], [x + 7, y - gap + 12], [x + 1, y - gap + 10]]), "#D29A52"), ...[0.3, 0.5, 0.7].map(t => L([[x - 1 + 5 * t, y - 4 - (gap - 14) * t], [x + 2 + 5 * t, y - 6 - (gap - 14) * t]], "#F0CF98", 0.8, 0.8)));
      else sh.push(S(ellipse(x, y - 9, 7.5, 6).add(ellipse(x, y - 9, 3.2, 2.4)), "#B5652A", { evenodd: true }), E(x - 3, y - 13, 0.6, 0.4, "#F2E1B8", fl(1)), E(x + 2, y - 14, 0.6, 0.4, "#F2E1B8", fl(1)));
    }
    sh.push(R(-w / 2 + 2, y - 1, w - 4, 5, wood), R(-w / 2 + 2, y - 1, w - 4, 1, lt(wood), fl(0.6)));
  }
  sh.push(R(-w / 2 - 4, -h, 6, h, wood), R(w / 2 - 2, -h, 6, h, wood), R(-w / 2 - 6, -h - 6, w + 12, 7, wood), R(-w / 2, -10, w, 10, sd(wood)));
  return { flats: [{ group: { shapes: sh, edge: 0.7 }, ppcm: 2.2, shadow: "drop" as const }] };
}

/** The counter's other looks: a glass display counter, an agency's counter, a public office's glass counter, a café counter. */
function counterKind(kind: string, p: Record<string, unknown>, r: Rng) {
  const w = num(p.w, kind === "glass" ? 160 : 200), h = num(p.h, kind === "shop" ? 92 : 98), a = w / 2, front: Sh = [], items: Sh = [], text: TextSpec[] = [], flats: FlatSpec[] = [];
  if (kind === "shop") {
    const base = r.pick([SET.wood, "#F4F1EA", "#8E6E5A"]), goods = str(p.goods, "cakes"), prices = words(p.prices), inner = -h + 6, floorY = -36, mid = (inner + floorY) / 2;
    front.push(R(-a, -36, w, 36, base), R(-a + 3, -8, w - 6, 8, dk(base)), R(-a, -36, w, 3, lt(base), fl(0.5)));
    front.push(R(-a, -h, w, h - 34, "#C9CED3"), R(-a + 4, inner, w - 8, floorY - inner - 2, "#F4EFE4"), R(-a + 4, inner, w - 8, 3, "#FFFFFF", fl(0.7)));
    let tag = 0;
    for (const sy of [floorY - 2, mid]) {
      front.push(R(-a + 4, sy, w - 8, 2, "#DCEFF5"));
      const n = Math.max(2, Math.round((w - 16) / 34));
      for (let k = 0; k < n; k++) {
        const x = -a + 8 + (k + 0.5) * (w - 16) / n;
        if (goods === "bread") { if (k % 3 === 2) for (let j = 0; j < 3; j++) front.push(S(ellipse(x - 6 + j * 6, sy - 7 - (j % 2) * 4, 5.5, 4.4).add(ellipse(x - 6 + j * 6, sy - 7 - (j % 2) * 4, 2.2, 1.6)), "#B5652A", { evenodd: true })); else front.push(...somun(x - 7, sy, 13, 8), ...somun(x + 7, sy, 13, 8), ...somun(x, sy - 6, 13, 8)); }
        else if (goods === "flowers") { front.push(P([[x - 8, sy, 0], [x + 8, sy, 0], [x + 9, sy - 14, 0], [x - 9, sy - 14, 0]], "#9AA0A6")); const fc = r.pick(["#D9534A", "#F2B705", "#E58FA0", "#F7F3EA", "#B9A6DC", "#F0745F"]); for (let j = 0; j < 7; j++) { const fx = x - 8 + j * 2.7, fy = sy - 18 - (j % 3) * 4; front.push(L([[x, sy - 12], [fx, fy]], "#4E7A48", 0.6, 1), E(fx, fy, 2.4, 2.2, fc)); } }
        else {
          const t = (k + (sy === mid ? 1 : 0)) % 4, cc = r.pick(["#F7F3EA", "#F2B7C4", "#6B4A35", "#F6E7A8", "#C9E2B8"]);
          if (t === 0) front.push(R(x - 12, sy - 12, 24, 12, "#E9D9A6"), R(x - 12, sy - 15, 24, 4, cc), RR(x - 12, sy - 16, 24, 3, 1.5, lt(cc)), ...[-6, 0, 6].map(dx => E(x + dx, sy - 17.5, 1.6, 1.6, "#C4402E")));
          else if (t === 1) for (let j = 0; j < 3; j++) front.push(P([[x - 13 + j * 9, sy, 0], [x - 5 + j * 9, sy, 0], [x - 9 + j * 9, sy - 10, 0]], "#E9D9A6"), P([[x - 13 + j * 9, sy - 1, 0], [x - 5 + j * 9, sy - 1, 0], [x - 9 + j * 9, sy - 10, 0]], cc, fl(0.6)));
          else if (t === 2) front.push(R(x - 14, sy - 3, 28, 3, STEEL), R(x - 13, sy - 9, 26, 6, "#D9A04A"), S(rect(x - 13, sy - 9, 26, 6), "#D9A04A", { tile: { w: 4, h: 3, shapes: [L([[0, 0], [2, 3], [4, 0]], "#8A5A24", 0.4, 0.8)] } }), R(x - 13, sy - 9, 26, 1.4, "#6E9A3A", fl(0.8)));
          else for (let j = 0; j < 5; j++) front.push(E(x - 9 + j * 4.5, sy - 3 - (j % 2) * 3, 3.2, 2.4, j % 2 ? "#B98A57" : "#E3B37A"));
        }
        if (tag < 12 && (tag < prices.length || !prices.length)) {
          front.push(RR(x - 5, sy - 1, 10, 5, 0.8, PAPER), R(x - 5, sy - 1, 10, 1, "#B3261E", fl(0.8)));
          if (prices[tag]) text.push({ text: prices[tag], x: x - 4.6, y: sy + 0.1, w: 9.2, h: 3.7, size: 2.8, font: "print" });
          tag++;
        }
      }
    }
    front.push(R(-a + 4, inner, w - 8, floorY - inner - 2, "#CFE6EE", fl(0.14)), L([[-a * 0.7, inner + 6], [-a * 0.55, floorY - 6]], "#FFFFFF", 3, 0.35), L([[a * 0.3, inner + 6], [a * 0.42, floorY - 10]], "#FFFFFF", 2, 0.3));
    front.push(S(poly([[-a + 2, -h - 7], [a - 2, -h - 7], [a, -h], [-a, -h]]), "#DCEFF5", { opacity: 0.7 }), R(-a - 1, -h, w + 2, 3, "#AEB6BC"));
    if (goods === "flowers") items.push(E(-a + 30, -9, 16, 9, "#F0E2C8"), E(-a + 30, -9, 4, 9, "#D8C3A0"), R(-a + 14, -9, 32, 9, "#F0E2C8"), ...["#D9534A", "#2F8C88", "#F2B705"].map((c, i) => E(a - 60 + i * 13, -5, 5.5, 5, c)), ...["#D9534A", "#2F8C88", "#F2B705"].map((_, i) => E(a - 60 + i * 13, -5, 1.8, 1.8, "#F7F3EA")));
    else items.push(RR(a - 40, -10, 32, 10, 2, STEEL), RR(a - 36, -24, 24, 12, 2, "#E9E4DA"), R(a - 31, -21, 14, 6, "#3A6B5A", fl(1)));
  } else if (kind === "office") {
    const lam = r.pick(["#EDEAE3", "#D9D6CF", "#F4F1EA"]), accent = colOf(p.color, r.pick(["#2F8C88", "#2E3A59", "#D18A1C", "#B3261E"]));
    front.push(R(-a, -h, w, h, lam), R(-a, -h + 22, w, 14, accent), R(-a, -h + 36, w, 1.4, sd(accent), fl(0.6)), R(-a + 4, -9, w - 8, 9, "#5A5048"), R(a - 8, -h, 8, h - 9, sd(lam), fl(0.35)));
    front.push(R(-a - 3, -h - 5, w + 6, 6, SET.wood_light), R(-a - 3, -h - 5, w + 6, 1.4, lt(SET.wood_light), fl(0.6)));
    const label = str(p.label, "").trim();
    if (label) text.push({ text: label, x: -a + 8, y: -h + 23, w: w - 16, h: 12, size: 7, font: "print", color: "#FFFFFF" });
    const bx = -a + 30;
    items.push(R(bx - 14, -26, 28, 26, "#AEB6BC", fl(0.9)));
    for (let k = 0; k < 3; k++) { const y = -24 + k * 8; items.push(R(bx - 12, y, 24, 6.5, PAPER), P([[bx - 9, y + 5.5, 0], [bx - 9, y + 3, 0], [bx - 6.5, y + 1.2, 0], [bx - 4, y + 3, 0], [bx - 4, y + 5.5, 0]], r.pick(["#C4553A", "#2F8C88", "#E0A83A"])), L([[bx - 1, y + 2.5], [bx + 9, y + 2.5]], "#9AA0A6", 0.5, 0.8)); }
    items.push(P([[a - 32, 0, 0], [a - 22, 0, 0], [a - 21, -11, 0], [a - 33, -11, 0]], "#E9E4DA"), ...Array.from({ length: 6 }, (_, i) => E(a - 34 + i * 3, -16 - (i % 2) * 4, 3.4, 2, "#4E7A48")));
  } else if (kind === "glass") {
    const panel = "#D9D6CF", nw = Math.max(1, Math.round(w / 150)), ww = w / nw, labels = words(p.label), screen: Sh = [], ink = "#2E3A59";
    front.push(R(-a, -h, w, h, panel), R(-a + 4, -9, w - 8, 9, "#5A5048"), R(-a - 3, -h - 4, w + 6, 5, "#8E979E"), R(-a - 3, -h - 4, w + 6, 1.2, lt("#8E979E"), fl(0.6)));
    for (let i = 0; i < nw; i++) front.push(RR(-a + i * ww + 8, -h + 12, ww - 16, h - 30, 2, sd(panel), fl(0.3)));
    for (let i = 0; i < nw; i++) {
      const x0 = -a + i * ww, cx = x0 + ww / 2;
      screen.push(R(x0 + 3, -96, ww - 6, 88, "#CFE6EE", fl(0.2)), L([[x0 + ww * 0.2, -86], [x0 + ww * 0.42, -30]], "#FFFFFF", 3, 0.35), L([[x0 + ww * 0.55, -80], [x0 + ww * 0.68, -50]], "#FFFFFF", 2, 0.3));
      for (let k = 0; k < 3; k++) for (let j = -k; j <= k; j++) screen.push(E(cx + j * 2.2, -54 + (k - 1) * 2.2, 0.7, 0.7, "#5A6470"));
      screen.push({ path: ellipse(cx, -54, 7.5, 7.5), stroke: { color: "#AEB6BC", width: 1 }, flat: true }, Q4(cx - 16, -8, cx + 16, -8, cx + 19, 0, cx - 19, 0, "#9AA0A6"), R(cx - 14, -10, 28, 2, "#2B2F36"));
      screen.push(R(x0 + 4, -112, ww - 8, 14, ink), R(x0 + 4, -112, ww - 8, 2, lt(ink), fl(0.5)));
      if (labels[i]) text.push({ text: labels[i], x: x0 + 6, y: -111, w: ww - 12, h: 12, size: 7, font: "print", color: "#FFFFFF" });
    }
    for (let i = 0; i <= nw; i++) screen.push(R(-a + i * ww - (i === 0 ? 0 : i === nw ? 4 : 2), -112, 4, 112, "#9AA0A6"));
    flats.push({ group: { shapes: screen, edge: 0.6 }, z: -14, y: h, ppcm: Math.min(2.4, 1900 / (w + 10)), ...(text.length ? { text: text.splice(0) } : {}) });
  } else {
    const tc = r.pick(["#F4F1EA", "#CFE3D3", "#E9D9C2"]), wt = SET.wood;
    front.push(R(-a, -h, w, h, tc), S(rect(-a, -h, w, h), tc, { tile: { w: 16, h: 8, shapes: [R(0, 0, 16, 0.6, "#BDB4A4", fl(0.9)), R(0, 0, 0.6, 4, "#BDB4A4", fl(0.9)), R(8, 4, 0.6, 4, "#BDB4A4", fl(0.9)), R(0, 4, 16, 0.6, "#BDB4A4", fl(0.9))] } }), R(-a, -10, w, 10, dk(wt)), R(-a - 5, -h - 6, w + 10, 8, wt), R(-a - 5, -h - 6, w + 10, 1.6, lt(wt), fl(0.6)));
    const x0 = -a + 24;
    items.push(R(x0 - 15, -2, 30, 2, "#C9CED3"), R(x0 - 1.5, -16, 3, 14, "#C9CED3"), E(x0, -16, 13, 2, "#C9CED3"), S(smooth([[x0 - 12, -17, 0], [x0 + 12, -17, 0], [x0 + 12, -30], [x0, -38], [x0 - 12, -30]], true, 1), "#DCEFF5", { opacity: 0.45 }), R(x0 - 10, -26, 20, 9, "#6B4A35"), R(x0 - 10, -27, 20, 2.5, "#F2E1B8"), E(x0, -39, 1.6, 1.6, "#C9CED3"));
    const x1 = x0 + 34;
    for (let k = 0; k < 4; k++) items.push(E(x1, -1 - k * 4.4, 7, 1.4, "#F7F3EA"), RR(x1 - 5, -5 - k * 4.4, 10, 4, 1.5, k % 2 ? "#F7F3EA" : "#E9E4DA"));
    const x2 = x1 + 30;
    items.push(R(x2 - 16, -2, 32, 2, "#B58A3A"));
    for (let k = 0; k < 4; k++) { const gx = x2 - 11 + k * 7.3; items.push(E(gx, -2.6, 3, 0.8, "#E9E4DA"), P([[gx - 2.2, -3, 0], [gx + 2.2, -3, 0], [gx + 1.4, -6], [gx + 2.4, -10, 0], [gx - 2.4, -10, 0], [gx - 1.4, -6]], "#DCEFF5", { opacity: 0.55 }), R(gx - 1.8, -8.5, 3.6, 5, "#B3261E", fl(0.85))); }
    const x3 = x2 + 30;
    items.push(RR(x3 - 7, -18, 14, 18, 4, "#DCEFF5", { opacity: 0.55 }), RR(x3 - 7.5, -21, 15, 4, 1.5, "#C4553A"), ...[0, 1, 2, 3].map(k => E(x3 - 3 + (k % 2) * 6, -4 - Math.floor(k / 2) * 6, 2.6, 2.6, "#C99A68", fl(1))));
  }
  if (items.length) flats.push({ group: { shapes: items, edge: 0.6 }, z: -16, y: h, ppcm: 3 });
  flats.push({ group: { shapes: front, edge: 0.9 }, ppcm: Math.min(2.4, 1900 / (w + 12)), shadow: "drop", ...(text.length ? { text } : {}) });
  return { flats };
}
const Q4 = (x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: string): Shape => S(poly([[x0, y0], [x1, y1], [x2, y2], [x3, y3]]), c);

/** The lamp's other looks: on the wall, on a desk, standing on the floor. */
function lampKind(kind: string, p: Record<string, unknown>) {
  const brass = "#B58A3A", sh: Sh = [], glow: Sh = [];
  if (kind === "wall") {
    const g = colOf(p.color, "#F4EBD8");
    sh.push(RR(-5, -14, 10, 14, 4, brass), bar(0, -10, 0, -22, 2.2, brass), S(poly([[-4, -22], [4, -22], [3, -25], [-3, -25]]), brass), E(0, -34, 9, 10, g), E(-3, -37, 2.6, 3.4, "#FFFFFF", fl(0.5)));
    glow.push(E(0, -34, 9, 10, "#FFE6A8", fl(0.9)), E(-1, -35, 6, 7, "#FFF8E6", fl(1)));
    return { flats: [{ group: { shapes: sh, edge: 0.5 }, emissive: { shapes: glow, edge: 0 }, ppcm: 4, shadow: "drop" as const }], lights: [{ x: 0, y: 34, z: 25, color: "#FFD59A", radius: 3, intensity: 0.6 }] };
  }
  if (kind === "desk") {
    const c = colOf(p.color, "#2F8C88");
    sh.push(E(0, -1.6, 9, 2.4, sd(c)), RR(-9, -3.4, 18, 3.4, 1.5, c), bar(0, -3, -8, -26, 1.8, "#4B5058"), bar(-8, -26, 6, -40, 1.8, "#4B5058"), E(-8, -26, 1.8, 1.8, c), E(6, -40, 2, 2, c));
    sh.push(P([[2, -44, 0], [9, -46, 0], [20, -30, 0], [6, -26, 0]], c), L([[5, -42], [12, -30]], lt(c), 1, 0.4));
    glow.push(S(poly(Array.from({ length: 16 }, (_, i) => { const t = i / 16 * Math.PI * 2, a = -0.278; return [13 + 7.2 * Math.cos(t) * Math.cos(a) - 1.8 * Math.sin(t) * Math.sin(a), -28 + 7.2 * Math.cos(t) * Math.sin(a) + 1.8 * Math.sin(t) * Math.cos(a)] as [number, number]; })), "#FFF1C2", fl(1)));
    return { flats: [{ group: { shapes: sh, edge: 0.5 }, emissive: { shapes: glow, edge: 0 }, ppcm: 4 }], lights: [{ x: 14, y: 14, z: 15, color: "#FFE2B0", radius: 1.8, intensity: 0.7 }] };
  }
  const c = colOf(p.color, "#EFE2C6");
  sh.push(E(0, -2, 15, 3, "#3A3D45"), R(-1.2, -152, 2.4, 150, brass), R(-1.2, -152, 0.8, 150, lt(brass), fl(0.6)), S(poly([[-12, -180], [12, -180], [19, -150], [-19, -150]]), c), R(-19, -152, 38, 2, sd(c)), R(-12, -180, 24, 2, sd(c)));
  glow.push(S(poly([[-12, -180], [12, -180], [19, -150], [-19, -150]]), "#FFE2A0", fl(0.7)), E(0, -150, 18, 3.4, "#FFF1C2", fl(1)));
  return { flats: [{ group: { shapes: sh, edge: 0.5 }, emissive: { shapes: glow, edge: 0 }, ppcm: 2.5 }], lights: [{ x: 0, y: 160, z: 30, color: "#FFD59A", radius: 4, intensity: 0.7 }] };
}

/** A longcase hall clock: a dial in the hood, a pendulum swinging behind the trunk's glass. */
function hallClock(p: Record<string, unknown>) {
  const wood = colOf(p.color, "#6B4A35"), brass = "#C9A43A", r = num(p.r, 13), sh: Sh = [];
  sh.push(R(-27, -18, 54, 18, wood), R(-29, -20, 58, 4, lt(wood)), R(-20, -128, 40, 110, wood), R(-20, -128, 4, 110, lt(wood), fl(0.3)), R(16, -128, 4, 110, sd(wood), fl(0.4)));
  sh.push(RR(-12, -118, 24, 78, 10, "#2A2420"), R(-25, -132, 50, 6, lt(wood)), R(-24, -180, 48, 50, wood), P([[-27, -180, 0], [27, -180, 0], [23, -188], [0, -200], [-23, -188]], wood), E(-23, -186, 2.6, 2.6, brass), E(23, -186, 2.6, 2.6, brass), E(0, -202, 3, 3, brass));
  sh.push(R(-20, -173, 40, 38, sd(wood)), ...dial(-154, r, p.time, brass));
  const pend: Sh = [R(-0.7, 0, 1.4, 52, brass), E(0, 54, 7, 7, brass), E(-2, 52, 2.4, 2.4, "#F2DC8A", fl(0.6))];
  const glass: Sh = [RR(-12, -118, 24, 78, 10, "#CFE6EE", fl(0.12)), L([[-6, -108], [-2, -60]], "#FFFFFF", 2, 0.3), S(rrect(-13, -119, 26, 80, 11).add(rrect(-12, -118, 24, 78, 10)), brass, { evenodd: true })];
  return { flats: [
    { group: { shapes: sh, edge: 0.7 }, ppcm: 3, shadow: "drop" as const },
    { group: { shapes: pend, edge: 0.4 }, y: 112, z: 0.5, ppcm: 3, move: { sway: { rot: 0.07, ms: 2000 } } },
    { group: { shapes: glass, edge: 0.4 }, z: 1, ppcm: 3 },
  ] };
}

/** A framed family photo: faceless paper figures in front of a park or the sea; on its strut when it `stand`s. */
function familyPhoto(p: Record<string, unknown>, r: Rng) {
  const w = num(p.w, 22), h = num(p.h, 16), f = Math.max(1.2, w * 0.07), n = Math.max(1, Math.min(6, Math.round(num(p.people, 3)))), fc = r.pick(["#C3C8CE", SET.wood_dark, "#F4F1EA", "#C9A43A"]), sh: Sh = [], pic = rect(-w / 2, -h, w, h);
  if (p.stand) sh.push(bar(w * 0.2, -h * 0.7, w * 0.42, 0, 1, sd(fc)));
  sh.push(R(-w / 2 - f, -h - f, w + 2 * f, h + 2 * f, fc), R(-w / 2, -h, w, h, "#BFDCE6"), R(-w / 2, -h * 0.38, w, h * 0.38, r.pick(["#9DBF8A", "#7FB3C8", "#D8C3A0"])), E(w * 0.3, -h * 0.82, w * 0.07, w * 0.07, "#FFF1C2", fl(1)));
  for (let i = 0; i < n; i++) {
    const child = n > 1 && i === n - 1, x = -w / 2 + (i + 0.5) * w / n, ht = h * (child ? 0.48 : r.range(0.66, 0.78)), hr = ht * 0.16, skin = SKIN[r.pick(Object.keys(SKIN))], cloth = FABRIC[r.pick(["fab_06", "fab_12", "fab_03", "fab_10", "fab_16", "fab_14", "fab_09"])];
    sh.push(P([[x - hr * 1.5, 1, 0], [x + hr * 1.5, 1, 0], [x + hr * 1.3, -ht + hr * 2.2], [x, -ht + hr * 1.8], [x - hr * 1.3, -ht + hr * 2.2]], cloth, { clip: pic }), E(x, -ht + hr, hr, hr * 1.1, skin, { clip: pic }));
    sh.push(r.chance(0.3) ? P([[x - hr * 1.2, -ht + hr * 1.5, 0], [x - hr * 1.1, -ht], [x, -ht - hr * 0.2], [x + hr * 1.1, -ht], [x + hr * 1.2, -ht + hr * 1.5, 0], [x, -ht + hr * 0.5]], FABRIC[r.pick(["fab_15", "fab_04", "fab_18", "fab_09"])], { clip: pic }) : P([[x - hr, -ht + hr * 0.9, 0], [x - hr * 0.9, -ht + hr * 0.1], [x, -ht - hr * 0.1], [x + hr * 0.9, -ht + hr * 0.1], [x + hr, -ht + hr * 0.9, 0], [x, -ht + hr * 0.45]], "#2E2019", { clip: pic }));
  }
  sh.push(L([[-w * 0.4, -h * 0.9], [-w * 0.15, -h * 0.4]], "#FFFFFF", w * 0.04, 0.25));
  return { flats: [{ group: { shapes: sh, edge: 0.3 }, ppcm: Math.min(10, 600 / (w + 2 * f)), shadow: "drop" as const }] };
}

/** Old sepia photos of the neighbourhood, `n` frames in a row: a street with a tram, a domed building, a group in hats. */
function sepiaPhotos(p: Record<string, unknown>, r: Rng) {
  const n = Math.max(1, Math.min(8, Math.round(num(p.n, 3)))), sep = ["#EAD9B4", "#C8AC7E", "#9C7E56", "#6E5638", "#4A3A28"], sh: Sh = [], sizes: [number, number][] = [];
  for (let i = 0; i < n; i++) sizes.push(r.chance(0.5) ? [r.range(30, 38), r.range(24, 28)] : [r.range(24, 28), r.range(32, 40)]);
  const gap = 12, total = sizes.reduce((s, [w]) => s + w + 8, 0) + gap * (n - 1), mh = Math.max(...sizes.map(([, h]) => h));
  let x0 = -total / 2;
  const first = r.int(0, 2);
  sizes.forEach(([w, h], i) => {
    const f = 4, cx = x0 + f + w / 2, by = -(mh - h) / 2 - f, top = by - h, pic = rect(cx - w / 2, top, w, h), gilt = r.chance(0.4), fc = gilt ? "#B58A3A" : r.pick(["#4A2E22", "#6B4A35", "#2E2620"]), scene = (i + first) % 3, o = { clip: pic, flat: true };
    sh.push(R(cx - w / 2 - f, top - f, w + 2 * f, h + 2 * f, fc), R(cx - w / 2 - f + 1, top - f + 1, w + 2 * f - 2, 1, lt(fc), fl(0.5)), R(cx - w / 2, top, w, h, sep[0]));
    const ground = by - h * 0.22;
    if (scene === 0) {
      // a street of old houses, a tram going by
      let x = cx - w / 2 - 2;
      while (x < cx + w / 2) { const bw = r.range(7, 11), bh = r.range(h * 0.42, h * 0.68); sh.push(R(x, ground - bh, bw, bh, r.pick([sep[1], sep[2]]), o), R(x - 0.5, ground - bh - 1, bw + 1, 1.4, sep[3], o)); for (let y = ground - bh + 3; y < ground - 4; y += 5) sh.push(R(x + 1.6, y, 1.6, 2.6, sep[3], o), R(x + bw - 3.2, y, 1.6, 2.6, sep[3], o)); x += bw + 0.4; }
      const tx = cx + r.range(-w * 0.2, w * 0.05), tw = w * 0.4, th = h * 0.17;
      sh.push(R(cx - w / 2, ground, w, by - ground, sep[1], o), L([[cx - w / 2, ground + 2], [cx + w / 2, ground + 2]], sep[3], 0.3, 0.9), RR(tx - tw / 2, ground - th + 1.5, tw, th, 1.2, sep[3], o), R(tx - tw / 2 + 1, ground - th + 3, tw - 2, th * 0.3, sep[0], o));
      for (let k = 1; k < 5; k++) sh.push(R(tx - tw / 2 + k * tw / 5 - 0.3, ground - th + 3, 0.6, th * 0.3, sep[3], o));
      sh.push(L([[tx, ground - th + 1.5], [tx + 2, ground - th - 4]], sep[4], 0.3, 0.9), L([[cx - w / 2, ground - th - 4], [cx + w / 2, ground - th - 4.6]], sep[4], 0.2, 0.7));
    } else if (scene === 1) {
      // a domed building with a minaret, cypresses
      const bw = w * 0.5, bx = cx - w * 0.08, dome: Pt[] = [];
      for (let k = 0; k <= 8; k++) { const t = Math.PI * k / 8; dome.push([bx - Math.cos(t) * bw * 0.32, ground - h * 0.28 - Math.sin(t) * h * 0.2]); }
      sh.push(R(cx - w / 2, ground, w, by - ground, sep[1], o), S(poly(dome as [number, number][]), sep[2], o), R(bx - bw / 2, ground - h * 0.28, bw, h * 0.28, sep[2], o), R(bx - bw / 2, ground - h * 0.28, bw, 1, sep[3], o));
      for (let k = 0; k < 4; k++) sh.push(R(bx - bw / 2 + 2 + k * (bw - 4) / 4, ground - h * 0.2, 1.6, 3.2, sep[3], o));
      const mx = bx + bw * 0.5 + w * 0.08;
      sh.push(R(mx - 1, ground - h * 0.62, 2, h * 0.62, sep[2], o), R(mx - 1.6, ground - h * 0.48, 3.2, 1, sep[3], o), S(poly([[mx - 1.2, ground - h * 0.62], [mx + 1.2, ground - h * 0.62], [mx, ground - h * 0.74]]), sep[3], o));
      for (const k of [-0.42, -0.34]) sh.push(E(cx + w * k, ground - h * 0.12, 1.6, h * 0.14, sep[4], o));
    } else {
      // a group in hats, standing in a row
      sh.push(R(cx - w / 2, ground, w, by - ground, sep[1], o));
      const m = r.int(3, 5);
      for (let k = 0; k < m; k++) { const x = cx - w / 2 + (k + 0.5) * w / m, hh = h * r.range(0.5, 0.62), hr = hh * 0.13; sh.push(P([[x - hr * 1.6, by + 1, 0], [x + hr * 1.6, by + 1, 0], [x + hr * 1.3, by - hh + hr * 2.2], [x - hr * 1.3, by - hh + hr * 2.2]], r.pick([sep[3], sep[4]]), o), E(x, by - hh + hr, hr, hr * 1.1, sep[1], o), r.chance(0.5) ? R(x - hr * 0.8, by - hh - hr * 0.4, hr * 1.6, hr * 0.9, "#6E3A28", o) : R(x - hr * 1.3, by - hh + hr * 0.1, hr * 2.6, hr * 0.5, sep[4], o)); }
    }
    sh.push(S(rect(cx - w / 2, top, w, h).add(rrect(cx - w / 2 + 1.5, top + 1.5, w - 3, h - 3, 5)), sep[3], { evenodd: true, flat: true, opacity: 0.25 }), R(cx - w / 2, top, w, h, "#B08850", fl(0.1)), R(cx - w / 2, top, w, h, PAPER, { flat: true, opacity: 0, stroke: { color: PAPER, width: 1.4 } }));
    x0 += w + 8 + gap;
  });
  return { flats: [{ group: { shapes: sh, edge: 0.4 }, ppcm: Math.min(5, 1900 / (total + 10)), shadow: "drop" as const }] };
}

/** The family's set pieces and props (`index.ts`). */
// ---- Solid lines: what people walk round (DESIGN.md §7) ----------------------------------------------------
// a wall (or a glass partition): its openings down to the floor are ways through
wall.solid = p => { const w = num(p.w, 1000); return solidLine(-w / 2, w / 2, ((p.openings as { x: number; y?: number; w: number }[] | undefined) ?? []).filter(o => (o.y ?? 0) < 30).map(o => [o.x - o.w / 2, o.x + o.w / 2])); };
doorShop.solid = p => { const w = num(p.w, 105); return solidLine(-w / 2, w / 2, [], true); };
counter.solid = p => { const k = str(p.kind, ""), w = num(p.w, k === "glass" ? 160 : k ? 200 : 240); return solidLine(-w / 2, w / 2); };

export const set: Record<string, PieceDef> = { street, wall, floor, window: windowFrame, door_shop: doorShop, shelf, counter, fridge, lamp, clock, picture, calendar };
export const props: Record<string, PieceDef> = { fridge };
