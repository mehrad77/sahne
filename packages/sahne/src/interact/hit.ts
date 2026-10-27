// Hit testing (DESIGN.md §9): a ray from the camera through a point on the canvas, tested against
// the quads the last frame drew, topmost first (the painter's order: what was drawn last is on
// top). A quad with art is checked against a low-resolution alpha mask of the atlas, so a tap on
// a piece's transparent corner passes through to whatever is behind it. Pure: no DOM.

import type { Vec3 } from "../core/math.ts";
import type { Target } from "../script/types.ts";
import type { AtlasHook } from "../render/paper/atlas.ts";

export interface Ray { o: Vec3; d: Vec3 }

/** What a drawn quad belongs to: `obj:<prop>`, `ch:<actor>` (with the `bone` it hangs on) or `piece:<set piece>` (`piece:` alone when it has no id). */
export interface Pick {
  target: Target;
  /** An actor's bone (or limb chain): the hit is `ch:<actor>.<part>` (`partOf`). */
  bone?: string;
  /** Corners in drawing order: the art's top left, top right, bottom right, bottom left (a parallelogram unless `tri`). */
  c: [Vec3, Vec3, Vec3, Vec3];
  /** Where its art is in the atlas, for the alpha mask; none for a solid strip or a face. */
  rect?: MaskRect;
  /** A general quad (a limb strip's segment): tested as two triangles, no mask. */
  tri?: boolean;
  /** A flat that answers a tap (`FlatReact.tap`): the key `Stage.tapFlat` takes. */
  poke?: string;
}

/** The part of an atlas rect a mask needs. */
export interface MaskRect { layer: number; u0: number; v0: number; u1: number; v1: number; lazy?: unknown }

export interface Hit { target: Target; t: number; p: Vec3; /** The tapped flat's `Pick.poke`. */ poke?: string }

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * The ray through a point of the canvas, in normalised device coordinates (x right, y up, −1…1),
 * for a camera at `eye` looking at `target` with a vertical field of view `fov` (the renderer's
 * `perspective` and `lookAt` with y up).
 */
export function rayAt(cam: { eye: Vec3; target: Vec3; fov: number }, aspect: number, nx: number, ny: number): Ray {
  const f = norm(sub(cam.target, cam.eye)), r = norm(cross(f, [0, 1, 0])), u = cross(r, f), k = Math.tan(cam.fov / 2);
  return { o: [...cam.eye] as Vec3, d: norm([f[0] + (r[0] * nx * aspect + u[0] * ny) * k, f[1] + (r[1] * nx * aspect + u[1] * ny) * k, f[2] + (r[2] * nx * aspect + u[2] * ny) * k]) };
}

/** Where a ray meets a parallelogram (corners 0, 1 and 3 span it): the distance and the point's place on it (s along 0→1, v along 0→3, both 0…1), or null. */
export function rayQuad(ray: Ray, c: readonly Vec3[]): { t: number; s: number; v: number } | null {
  const e1 = sub(c[1], c[0]), e2 = sub(c[3], c[0]), n = cross(e1, e2), dn = dot(ray.d, n);
  if (Math.abs(dn) < 1e-12) return null;
  const t = dot(sub(c[0], ray.o), n) / dn;
  if (t <= 0) return null;
  const q = sub([ray.o[0] + ray.d[0] * t, ray.o[1] + ray.d[1] * t, ray.o[2] + ray.d[2] * t], c[0]);
  // solve q = s·e1 + v·e2 in the plane (the axes need not be at right angles)
  const a = dot(e1, e1), b = dot(e1, e2), d = dot(e2, e2), p1 = dot(q, e1), p2 = dot(q, e2), det = a * d - b * b;
  if (Math.abs(det) < 1e-18) return null;
  const s = (p1 * d - p2 * b) / det, v = (p2 * a - p1 * b) / det;
  return s >= 0 && s <= 1 && v >= 0 && v <= 1 ? { t, s, v } : null;
}

/** Where a ray meets a triangle (Möller–Trumbore): the distance, or null. */
export function rayTri(ray: Ray, a: Vec3, b: Vec3, c: Vec3): number | null {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(ray.d, e2), det = dot(e1, p);
  if (Math.abs(det) < 1e-12) return null;
  const inv = 1 / det, s = sub(ray.o, a), u = dot(s, p) * inv;
  if (u < 0 || u > 1) return null;
  const q = cross(s, e1), v = dot(ray.d, q) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = dot(e2, q) * inv;
  return t > 0 ? t : null;
}

// ---- Alpha masks ---------------------------------------------------------------------------

/** How much smaller than its atlas a mask is, on each side: a 2048 layer has a 512 mask. */
export const MASK_SCALE = 4;
/** The alpha (0–255) a mask cell needs to count as paper: glass (a fridge's door, a window) is seen through, and tapped through. */
export const MASK_MIN = 140;

/**
 * Pool RGBA pixels down `f` times on each side into one alpha byte per cell, keeping each cell's
 * most opaque pixel, so a thin piece (a strap, a finger) stays tappable. `out` (of the pooled size,
 * `ow` wide) receives the cells at (`ox`, `oy`); the pooled width and height are returned.
 */
export function poolAlpha(rgba: Uint8ClampedArray | Uint8Array, w: number, h: number, f: number, out?: Uint8Array, ow?: number, ox = 0, oy = 0): { w: number; h: number; a: Uint8Array } {
  const pw = Math.ceil(w / f), ph = Math.ceil(h / f), W = ow ?? pw;
  const a = out ?? new Uint8Array(pw * ph);
  for (let y = 0; y < h; y++) {
    const row = (oy + ((y / f) | 0)) * W + ox, src = y * w * 4 + 3;
    for (let x = 0; x < w; x++) {
      const v = rgba[src + x * 4], k = row + ((x / f) | 0);
      if (v > a[k]) a[k] = v;
    }
  }
  return { w: pw, h: ph, a };
}

/** Whether a point of a rect (s, v in 0…1 across its art) is paper, by a layer's mask (`size` cells on a side). A rect still to be drawn, or a missing mask, counts as paper. */
export function maskHit(masks: readonly (Uint8Array | null | undefined)[], size: number, r: MaskRect, s: number, v: number, min = MASK_MIN): boolean {
  const m = masks[r.layer];
  if (!m || r.lazy) return true;
  const x = Math.min(size - 1, Math.max(0, Math.floor((r.u0 + (r.u1 - r.u0) * s) * size)));
  const y = Math.min(size - 1, Math.max(0, Math.floor((r.v0 + (r.v1 - r.v0) * v) * size)));
  return m[y * size + x] >= min;
}

type Cells = { layer: number; x: number; y: number; w: number; a: Uint8Array };

/**
 * The alpha masks of a stage's atlas (an `AtlasHook`): each layer pooled MASK_SCALE times smaller
 * once it is uploaded, one layer per task (a few ms each, and a 2048 layer's mask is 256 KB), and
 * each piece drawn later added to its layer's. Until a layer's mask is made it is null, and a hit
 * test counts its pieces as solid.
 */
export class AlphaMasks implements AtlasHook {
  masks: (Uint8Array | null)[] = [];
  /** The side of a layer's mask, in cells. */
  size = 0;
  private reads: ((k: number) => { data: Uint8ClampedArray; width: number; height: number })[] = [];
  private next = 0;
  private later: Cells[] = [];
  private t: ReturnType<typeof setTimeout> | undefined;

  layers(read: (layer: number) => { data: Uint8ClampedArray; width: number; height: number }, n: number, size: number) {
    clearTimeout(this.t);
    this.size = Math.ceil(size / MASK_SCALE); this.masks = new Array(n).fill(null); this.later = [];
    this.reads = [read]; this.next = 0;
    const step = () => { if (this.step()) this.t = setTimeout(step, 0); };
    this.t = setTimeout(step, 0);
  }

  /** Make the next layer's mask; whether there are more. */
  private step(): boolean {
    const read = this.reads[0], k = this.next;
    if (!read || k >= this.masks.length) return false;
    const img = read(k);
    this.masks[k] = poolAlpha(img.data, img.width, img.height, MASK_SCALE).a;
    for (const c of this.later) if (c.layer === k) this.stamp(c);
    this.later = this.later.filter(c => c.layer !== k);
    this.next++;
    if (this.next >= this.masks.length) { this.reads = []; return false; }
    return true;
  }

  /** Make every mask still to come now. */
  flush() { clearTimeout(this.t); while (this.step()); }

  piece(layer: number, x: number, y: number, read: () => { data: Uint8ClampedArray; width: number; height: number }) {
    const img = read(), m = poolAlpha(img.data, img.width, img.height, MASK_SCALE);
    const c = { layer, x: Math.floor(x / MASK_SCALE), y: Math.floor(y / MASK_SCALE), w: m.w, a: m.a };
    if (this.masks[layer]) this.stamp(c); else this.later.push(c);
  }

  /** Copy a piece's cells into its layer's mask, keeping the more opaque of the two. */
  private stamp(c: Cells) {
    const m = this.masks[c.layer], M = this.size, h = c.a.length / c.w;
    if (!m) return;
    for (let j = 0; j < h && c.y + j < M; j++) for (let i = 0; i < c.w && c.x + i < M; i++) {
      const v = c.a[j * c.w + i], k = (c.y + j) * M + c.x + i;
      if (v > m[k]) m[k] = v;
    }
  }

  /** Whether a point of a rect is paper (`maskHit`). */
  paper(r: MaskRect, s: number, v: number) { return maskHit(this.masks, this.size, r, s, v); }

  dispose() { clearTimeout(this.t); this.masks = []; this.reads = []; this.later = []; }
}

/**
 * The topmost quad under a ray: the last drawn whose art is paper where the ray meets it. `paper`
 * checks a quad's mask (default: every quad is solid). `skip` leaves quads out (the thing being
 * dragged). Returns the hit, or null.
 */
export function pickTop(picks: readonly Pick[], ray: Ray, paper: (p: Pick, s: number, v: number) => boolean = () => true, skip?: (p: Pick) => boolean): Hit | null {
  for (let i = picks.length - 1; i >= 0; i--) {
    const p = picks[i];
    if (skip?.(p)) continue;
    const target = p.bone ? p.target + "." + partOf(p.bone) : p.target;
    if (p.tri) {
      const t = rayTri(ray, p.c[0], p.c[1], p.c[2]) ?? rayTri(ray, p.c[0], p.c[2], p.c[3]);
      if (t !== null) return { target, t, p: at(ray, t), ...(p.poke ? { poke: p.poke } : {}) };
      continue;
    }
    const h = rayQuad(ray, p.c);
    if (h && (!p.rect || paper(p, h.s, h.v))) return { target, t: h.t, p: at(ray, h.t), ...(p.poke ? { poke: p.poke } : {}) };
  }
  return null;
}

const at = (r: Ray, t: number): Vec3 => [r.o[0] + r.d[0] * t, r.o[1] + r.d[1] * t, r.o[2] + r.d[2] * t];

/** Where a ray meets the plane z = `z` (facing the camera), or null. */
export function rayZ(ray: Ray, z: number): Vec3 | null {
  if (Math.abs(ray.d[2]) < 1e-9) return null;
  const t = (z - ray.o[2]) / ray.d[2];
  return t > 0 ? at(ray, t) : null;
}

// ---- Targets -------------------------------------------------------------------------------

/** The body part a bone belongs to, for `ch:<actor>.<part>`: head, hand, arm, leg, foot or body. */
export function partOf(bone: string): string {
  if (/^(head|neck|face|hair|ear|eye|brow|nose|mouth)/.test(bone)) return "head";
  if (/^hand_/.test(bone)) return "hand";
  if (/^(arm|forearm|shoulder)_/.test(bone)) return "arm";
  if (/^(thigh|shin|leg)_/.test(bone)) return "leg";
  if (/^foot_/.test(bone)) return "foot";
  return "body";
}

/**
 * Whether a hit is the target asked for: `ch:ismail.hand` is `ch:ismail`; `obj:ekmek#1` (two
 * loaves split off) is `obj:ekmek`; `ch:ismail.head` asks for the head only.
 */
export function isTarget(asked: Target, hit: Target): boolean {
  if (asked === hit) return true;
  if (asked.startsWith("ch:") && !asked.includes(".")) return hit.startsWith(asked + ".");
  if (asked.startsWith("obj:")) return hit.startsWith(asked + "#");
  return false;
}

/** What a hit is: its kind and id (`obj:ekmek#1` is the prop `ekmek#1`), and the body part for an actor. */
export function parseTarget(t: Target): { kind: string; id: string; part?: string } {
  const i = t.indexOf(":"), kind = i < 0 ? t : t.slice(0, i), rest = i < 0 ? "" : t.slice(i + 1);
  if (kind === "ch") { const [id, part] = rest.split("."); return { kind, id, part }; }
  return { kind, id: rest };
}
