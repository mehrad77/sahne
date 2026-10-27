// Texture atlases (DESIGN.md §6.2). Paper pieces are rasterised once per scene into the layers
// of a WebGL2 texture array; faces get their own small array, redrawn only when a face changes.

import { drawGroup, groupBounds, type Group } from "../../art/shape.ts";
import type { Box } from "../../core/math.ts";

export interface AtlasRect {
  layer: number;
  /** Normalised texture coordinates (set as the atlas is painted). */
  u0: number; v0: number; u1: number; v1: number;
  /** The piece's own box in centimetres (its local frame). */
  box: Box;
  /** Set while the piece has a cell but no pixels yet (`add(…, true)`): `Atlas.ensure` draws it. */
  lazy?: { g: Group; ppcm: number; x: number; y: number; w: number; h: number };
}

type Canvas2D = HTMLCanvasElement | OffscreenCanvas;
type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

function makeCanvas(w: number, h: number): Canvas2D {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas"); c.width = w; c.height = h; return c;
}

/** A 2D context for building atlas pixels: the hint keeps the canvas on the CPU, where the paper look's soft shadows draw several times faster than on the GPU. */
const ctx2d = (c: Canvas2D) => c.getContext("2d", { willReadFrequently: true }) as Ctx2D;

const PAD = 6; // pixels around each piece, so mipmaps never bleed a neighbour in
/** The side of the largest atlas layer, pixels: a flat bigger than this less its padding cannot be drawn. */
export const ATLAS_MAX = 2048;

/** A group's cell in the atlas at `ppcm`, pixels (a damaged document can make a box NaN: it gets one pixel, not a poisoned layout). */
export function cellSize(g: Group, ppcm: number): { w: number; h: number } {
  const box = groupBounds(g), px = (cm: number) => Math.max(1, Math.ceil(cm * ppcm) || 1);
  return { w: px(box[2] - box[0]), h: px(box[3] - box[1]) };
}

/** Whether a cell `w`×`h` pixels fits a layer `size` pixels square, with its padding. */
export const fitsAtlas = (w: number, h: number, size = ATLAS_MAX) => w + 2 * PAD <= size && h + 2 * PAD <= size;

export interface Slot { layer: number; x: number; y: number }

/**
 * Told about the pixels as they are made, for the hit tests' alpha masks (interact/masks.ts):
 * `layers` when it is sent to the GPU (`read(k)` gives layer k's pixels, while the hook keeps `read`), and
 * `piece` when a lazy piece is drawn (`read()` gives its cell's pixels, now or never).
 */
export interface AtlasHook {
  layers(read: (layer: number) => ImageData, n: number, size: number): void;
  piece(layer: number, x: number, y: number, read: () => ImageData): void;
}

/**
 * Shelf packing: cells go left to right on shelves as high as the tallest cell on them, tallest
 * cells first, so a shelf wastes little; a layer that is full starts the next one. `pad` pixels
 * keep every cell apart from its neighbours and the edge. The slots come back in the input order.
 */
export function packShelves(cells: { w: number; h: number }[], size: number, pad = PAD): { slots: Slot[]; layers: number } {
  const slots: Slot[] = new Array(cells.length);
  const order = cells.map((_, i) => i).sort((a, b) => cells[b].h - cells[a].h || cells[b].w - cells[a].w || a - b);
  let layer = 0, x = pad, y = pad, row = 0;
  for (const i of order) {
    const { w, h } = cells[i];
    if (w + 2 * pad > size || h + 2 * pad > size) throw new Error(`piece too large for the atlas: ${w}×${h}px`);
    if (x + w + pad > size) { x = pad; y += row + pad; row = 0; }
    if (y + h + pad > size) { layer++; x = pad; y = pad; row = 0; }
    slots[i] = { layer, x, y };
    x += w + pad; row = Math.max(row, h);
  }
  return { slots, layers: cells.length ? layer + 1 : 0 };
}

/** GPU bytes of a texture array with a full mip chain (a third more than level 0). */
export const textureBytes = (size: number, layers: number) => Math.round(size * size * 4 * layers * 4 / 3);

export class Atlas {
  readonly size: number;
  texture: WebGLTexture | null = null;
  /** The layers of the uploaded texture. */
  layers = 0;
  private gl: WebGL2RenderingContext;
  private items: { rect: AtlasRect; g: Group; ppcm: number; w: number; h: number; lazy: boolean }[] = [];
  private scratch: { canvas: Canvas2D; ctx: Ctx2D } | null = null;
  /** Packed, being painted (`pack` → `paint` → `send`). */
  private job: { slots: Slot[]; layers: number; i: number; big: number; cv: { canvas: Canvas2D; ctx: Ctx2D }[] } | null = null;
  /** Pieces were drawn since the mips were made (`ensure`). */
  private stale = false;
  /** Told about the pixels as they are made (the hit tests' alpha masks). */
  hook: AtlasHook | null = null;

  constructor(gl: WebGL2RenderingContext, size = 2048) { this.gl = gl; this.size = size; }

  /**
   * Rasterise a group at `ppcm` pixels per centimetre. Cells are placed (`pack`) and pixels drawn
   * (`paint`) later; until then the rect holds only its box. A `lazy` piece (a hand shape the pose
   * does not use yet, the back of a figure that faces the viewer) gets its cell then but is drawn
   * when first needed (`ensure`), which keeps a rebuild cheap.
   */
  add(g: Group, ppcm: number, lazy = false): AtlasRect {
    const box = groupBounds(g), { w, h } = cellSize(g, ppcm);
    // the true box of the pixels, so quads map pixel-exact
    const rect: AtlasRect = { layer: 0, u0: 0, v0: 0, u1: 0, v1: 0, box: [box[0], box[1], box[0] + w / ppcm, box[1] + h / ppcm] };
    this.items.push({ rect, g, ppcm, w, h, lazy });
    return rect;
  }

  private draw(ctx: Ctx2D, g: Group, ppcm: number, box: Box, x: number, y: number, w: number, h: number) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.setTransform(ppcm, 0, 0, ppcm, x - box[0] * ppcm, y - box[1] * ppcm);
    drawGroup(ctx, g, ppcm);
    ctx.restore();
  }

  /** Place every cell (a piece too large throws here) and make the layers' canvases: then `paint`, then `send`. */
  pack() {
    const S = this.size, { slots, layers } = packShelves(this.items, S);
    this.job = { slots, layers, i: 0, big: 0, cv: Array.from({ length: layers }, () => { const canvas = makeCanvas(S, S); return { canvas, ctx: ctx2d(canvas) }; }) };
  }

  /** Draw the pieces that are not lazy until `until` (`performance.now()`) is past, so a scene to come is drawn in idle time; whether all are drawn. */
  paint(until = Infinity): boolean {
    const j = this.job!, S = this.size, items = this.items;
    while (j.i < items.length && performance.now() <= until) {
      const it = items[j.i], s = j.slots[j.i++], r = it.rect;
      r.layer = s.layer; r.u0 = s.x / S; r.v0 = s.y / S; r.u1 = (s.x + it.w) / S; r.v1 = (s.y + it.h) / S;
      if (it.lazy) { r.lazy = { g: it.g, ppcm: it.ppcm, x: s.x, y: s.y, w: it.w, h: it.h }; j.big = Math.max(j.big, it.w, it.h); }
      // (a pixel read makes the canvas draw now, not at `send`: the time is spent where it is counted)
      else { const c = j.cv[s.layer].ctx; this.draw(c, it.g, it.ppcm, r.box, s.x, s.y, it.w, it.h); if (until < Infinity) c.getImageData(s.x, s.y, 1, 1); }
    }
    return j.i >= items.length;
  }

  /** Send the painted layers to the GPU. */
  send() {
    const gl = this.gl, S = this.size, { layers, cv, big } = this.job!, n = Math.max(1, layers);
    if (this.texture) gl.deleteTexture(this.texture);
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, t);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.floor(Math.log2(S)) + 1, gl.RGBA8, S, S, n);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    cv.forEach((L, i) => gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, S, S, 1, gl.RGBA, gl.UNSIGNED_BYTE, L.canvas as TexImageSource));
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // a floor seen at a slant (a road ahead, a tiled floor) keeps its marks sharp along it instead of smearing them across
    const an = gl.getExtension("EXT_texture_filter_anisotropic");
    if (an) gl.texParameterf(gl.TEXTURE_2D_ARRAY, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number));
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    this.texture = t; this.layers = n;
    // the pieces still to draw keep their art; the rest is no longer needed once sent
    this.items = []; this.job = null;
    this.hook?.layers(k => cv[k].ctx.getImageData(0, 0, S, S), layers, S);
    if (big) { const canvas = makeCanvas(big, big); this.scratch = { canvas, ctx: ctx2d(canvas) }; }
  }

  /** Draw a lazy piece into its cell now (a no-op for any other). Call before a quad uses the rect; `settle` before drawing. */
  ensure(r: AtlasRect) {
    const z = r.lazy, sc = this.scratch;
    if (!z || !sc || !this.texture) return;
    r.lazy = undefined;
    const gl = this.gl, ctx = sc.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, z.w, z.h);
    this.draw(ctx, z.g, z.ppcm, r.box, 0, 0, z.w, z.h);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, z.x, z.y, r.layer, z.w, z.h, 1, gl.RGBA, gl.UNSIGNED_BYTE, sc.canvas as TexImageSource);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.stale = true;
    this.hook?.piece(r.layer, z.x, z.y, () => ctx.getImageData(0, 0, z.w, z.h));
  }

  /** Make the mips of pieces drawn by `ensure`: once, however many there were. */
  settle() {
    if (!this.stale || !this.texture) return;
    this.stale = false;
    this.gl.bindTexture(this.gl.TEXTURE_2D_ARRAY, this.texture);
    this.gl.generateMipmap(this.gl.TEXTURE_2D_ARRAY);
  }

  /** GPU memory of the uploaded texture, in bytes. */
  get bytes() { return this.texture ? textureBytes(this.size, this.layers) : 0; }

  dispose() { if (this.texture) this.gl.deleteTexture(this.texture); this.texture = null; this.scratch = null; this.items = []; this.job = null; }
}

/** The most faces on stage at once (DESIGN.md §12: up to 12 actors with full rigs). */
export const MAX_FACES = 12;

/** Face slots for a cast of `actors`: one per actor, at least one, at most MAX_FACES (a bigger cast shares them by who is on stage). */
export const faceSlots = (actors: number) => Math.max(1, Math.min(MAX_FACES, Math.floor(actors) || 1));

/** One face texture per actor, in slots of a small texture array. */
export class FaceAtlas {
  readonly slot = 512;
  texture: WebGLTexture;
  private gl: WebGL2RenderingContext;
  private canvas: Canvas2D;
  private ctx: Ctx2D;
  readonly count: number;

  constructor(gl: WebGL2RenderingContext, count = 1) {
    this.gl = gl; this.count = faceSlots(count);
    this.canvas = makeCanvas(this.slot, this.slot);
    this.ctx = ctx2d(this.canvas);
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, Math.log2(this.slot) + 1, gl.RGBA8, this.slot, this.slot, this.count);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /** Redraw one slot: `draw` paints into a context mapped to the region box (cm). */
  update(slot: number, region: Box, draw: (ctx: Ctx2D) => void) {
    const ctx = this.ctx, s = this.slot, w = region[2] - region[0], h = region[3] - region[1];
    const k = s / Math.max(w, h);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s, s);
    ctx.setTransform(k, 0, 0, k, -region[0] * k + (s - w * k) / 2, -region[1] * k + (s - h * k) / 2);
    draw(ctx);
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, slot, s, s, 1, gl.RGBA, gl.UNSIGNED_BYTE, this.canvas as TexImageSource);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    // the mip levels of every slot, on the GPU: a few times cheaper than halving the slot on canvases
    gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  }

  /** The square box (cm) a slot covers for a region, matching update()'s mapping. */
  static squareBox(region: Box): Box {
    const w = region[2] - region[0], h = region[3] - region[1], m = Math.max(w, h);
    const cx = (region[0] + region[2]) / 2, cy = (region[1] + region[3]) / 2;
    return [cx - m / 2, cy - m / 2, cx + m / 2, cy + m / 2];
  }

  /** GPU memory, in bytes. */
  get bytes() { return textureBytes(this.slot, this.count); }

  dispose() { this.gl.deleteTexture(this.texture); }
}
