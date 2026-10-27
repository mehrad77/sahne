// Framings computed from where the actors stand (DESIGN.md §6.6).

import { apply, type Vec3 } from "../../core/math.ts";
import { groupBounds } from "../../art/shape.ts";
import { solve, restPose } from "../../rig/skeleton.ts";
import type { Puppet } from "../../avatar/compose.ts";
import type { BodyDims, PlaceDoc } from "../../core/types.ts";

export interface CamState { eye: Vec3; target: Vec3; fov: number }
/** The camera's near and far planes, metres. */
export const NEAR = 0.1, FAR = 600;

/** A world box to keep in frame: x0..x1 across, y0..y1 up, at depth z. */
export interface FrameBox { x0: number; x1: number; y0: number; y1: number; z: number }

export interface FrameOpts {
  aspect: number;
  /** Extra room around the boxes, as a fraction of their size. */
  margin?: number;
  fov?: number;
  /** How far above the target the camera sits, per metre of distance (a slight look down). */
  tilt?: number;
  /** Shift the frame's centre down (+) or up (−), as a fraction of its height (headroom). */
  lift?: number;
  /** Never come closer than this (metres). */
  minDist?: number;
}

/**
 * Place the camera so every corner of every box is inside the frame, in perspective: a box
 * nearer the camera looks bigger, so boxes at different depths are fitted one by one.
 */
/**
 * What a place's wide shot fits: `camera.wide`'s width at its depth, over the height band `y0`…`y1`
 * (default 0.15 to 2.45 m: people standing on the floor). A stairwell or a roof with a water tank
 * raises it. With no place, a 6 m room.
 */
export function wideBox(place: Pick<PlaceDoc, "camera" | "size"> | null | undefined): FrameBox {
  const wide = place?.camera?.wide, w = wide?.w ?? (place ? place.size.w * 0.86 : 6), x = wide?.x ?? 0;
  return { x0: x - w / 2, x1: x + w / 2, y0: wide?.y0 ?? 0.15, y1: wide?.y1 ?? 2.45, z: wide?.z ?? -(place?.size.d ?? 4) / 2 };
}

export function frameBoxes(boxes: FrameBox[], o: FrameOpts): CamState {
  const fov = o.fov ?? 0.52, m = 1 + (o.margin ?? 0.12), tilt = o.tilt ?? 0.1;
  const tanV = Math.tan(fov / 2) / m, tanH = tanV * o.aspect;
  const pts: Vec3[] = boxes.flatMap(b => [[b.x0, b.y0, b.z], [b.x1, b.y0, b.z], [b.x0, b.y1, b.z], [b.x1, b.y1, b.z]] as Vec3[]);
  let tx = (Math.min(...boxes.map(b => b.x0)) + Math.max(...boxes.map(b => b.x1))) / 2;
  let ty = (Math.min(...boxes.map(b => b.y0)) + Math.max(...boxes.map(b => b.y1))) / 2;
  const tz = boxes.reduce((s, b) => s + b.z, 0) / boxes.length;
  // the view direction: back along +z, tilted down by `tilt`
  const fl = Math.hypot(1, tilt), fwd: Vec3 = [0, -tilt / fl, -1 / fl], up: Vec3 = [0, 1 / fl, -tilt / fl];
  const view = (eye: Vec3, p: Vec3) => {
    const d: Vec3 = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]];
    return { x: d[0], y: d[0] * 0 + d[1] * up[1] + d[2] * up[2], z: d[1] * fwd[1] + d[2] * fwd[2] };
  };
  let dist = o.minDist ?? 0.9;
  for (let pass = 0; pass < 3; pass++) {
    const eyeAt = (d: number): Vec3 => [tx - fwd[0] * d, ty - fwd[1] * d, tz - fwd[2] * d];
    const fits = (d: number) => pts.every(p => { const v = view(eyeAt(d), p); return v.z > 0.1 && Math.abs(v.x) <= v.z * tanH && Math.abs(v.y) <= v.z * tanV; });
    let lo = o.minDist ?? 0.9, hi = 60;
    if (fits(lo)) hi = lo; else for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    dist = hi;
    // re-centre on the projected extents, then fit again
    const eye = eyeAt(dist);
    const sx = pts.map(p => { const v = view(eye, p); return v.x / v.z; }), sy = pts.map(p => { const v = view(eye, p); return v.y / v.z; });
    const cx = (Math.min(...sx) + Math.max(...sx)) / 2, cy = (Math.min(...sy) + Math.max(...sy)) / 2;
    const zt = dist;
    tx += cx * zt; ty += cy * zt * up[1] - (o.lift ?? 0) * tanV * zt;
  }
  return { fov, target: [tx, ty, tz], eye: [tx - fwd[0] * dist, ty - fwd[1] * dist, tz - fwd[2] * dist] };
}

export function blendCam(a: CamState, b: CamState, t: number): CamState {
  const l = (p: Vec3, q: Vec3): Vec3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t];
  return { eye: l(a.eye, b.eye), target: l(a.target, b.target), fov: a.fov + (b.fov - a.fov) * t };
}

// ---- A lone figure: the avatar builder's preview ---------------------------------------------

/** How much of a lone figure the preview keeps in view: head to toe, head and shoulders, or the head. */
export type Framing = "full" | "bust" | "head";

/**
 * What a framing reads of a figure, in centimetres: its body (`BodyDims` has the first four, and
 * `armL` is `upperArmL + foreArmL + handL`) and how far its head's art reaches, which the body does
 * not say (`figureDims`). A field left out, or one that is not a number, falls back to a guess from the body.
 */
export interface FigureDims { H: number; headH: number; headW: number; shoulderW: number; armL?: number; crown?: number; headHalf?: number }

/** An adult's, for a body whose measurements are not numbers (a damaged document must not blank the stage). */
const FALLBACK: FigureDims = { H: 172, headH: 50, headW: 44, shoulderW: 42 };

/** The measurements of a body (`kit.body`), for `figureBox`. */
export const bodyDims = (b: BodyDims): FigureDims => ({ H: b.H, headH: b.headH, headW: b.headW, shoulderW: b.shoulderW, armL: b.upperArmL + b.foreArmL + b.handL });

/**
 * A puppet's measurements for `figureBox`: its body, and from the art on its head bone at rest (the
 * hair, headwear and ears of both views) the height of the highest point above the ground (`crown`:
 * a bun stands well above the head) and the widest reach sideways (`headHalf`: long hair, a scarf).
 */
export function figureDims(p: Puppet): FigureDims {
  const head = solve(p.bones, restPose()).get("head");
  let crown = 0, headHalf = 0;
  if (head) for (const v of [p.views.front, p.views.back]) for (const it of v) {
    if (it.bone !== "head" || !it.group) continue;
    const [x0, y0, x1, y1] = groupBounds(it.group);
    for (const q of [apply(head, x0, y0), apply(head, x1, y0), apply(head, x1, y1), apply(head, x0, y1)]) { crown = Math.max(crown, -q[1]); headHalf = Math.max(headHalf, Math.abs(q[0])); }
  }
  return { ...bodyDims(p.body), crown, headHalf };
}

/** What a figure's measurements come to: numbers, or a guess from the body for a field that is missing or damaged. */
function measures(d: FigureDims) {
  const fin = (v: number | undefined, def: number) => v !== undefined && Number.isFinite(v) && v > 0 ? v : def;
  const H = fin(d.H, FALLBACK.H), headH = fin(d.headH, FALLBACK.headH), headW = fin(d.headW, FALLBACK.headW), sh = fin(d.shoulderW, FALLBACK.shoulderW);
  return { H, headH, headW, sh, reach: sh / 2 + fin(d.armL, sh * 1.6), up: Math.max(0, fin(d.crown, H + headH * 0.14) - H), hw: Math.max(headW * 0.55, fin(d.headHalf, headW * 0.58)) };
}

/**
 * What a framing keeps in view of a figure standing at the origin facing the viewer, in metres.
 * `full` is head to toe, with the same room above and below (enough for the hair that stands
 * highest), and wide enough for an arm stretched out sideways, a wave or a hug: on a canvas too
 * narrow for that the figure is drawn smaller rather than cut. `ref` is the build's tallest body,
 * which the frame is made for (its height and its reach), so that a height slider shows: the frame
 * stays put while the figure grows in it. `bust` and `head` follow the head's own art, whatever the height.
 */
export function figureBox(f: Framing, d: FigureDims, ref?: FigureDims): FrameBox {
  const b = measures(d), m = (cm: number) => cm / 100, z = 0;
  if (f === "full") {
    const r = ref ? measures(ref) : b, R = Math.max(b.H, r.H), pad = Math.max(R * 0.04, r.headH * 0.2, b.up + 1.5), half = Math.max(r.sh * 1.15, r.headW * 0.9, r.reach);
    return { x0: -m(half), x1: m(half), y0: -m(pad), y1: m(R + pad), z };
  }
  // room above the crown: the builder's tools lie over the top of its preview, and the hair must clear them
  const top = m(b.H + b.up + 1 + b.headH * (f === "head" ? 0.22 : 0.12));
  if (f === "bust") { const half = m(Math.max(b.sh * 0.68, b.hw)); return { x0: -half, x1: half, y0: m(b.H - b.headH * 2.05), y1: top, z }; }
  return { x0: -m(b.hw), x1: m(b.hw), y0: m(b.H - b.headH * 1.2), y1: top, z };
}

/** The camera for a framing and a canvas shape (width over height): a tall phone preview and a wide one. */
export function figureCam(f: Framing, dims: FigureDims, aspect: number, ref?: FigureDims): CamState {
  return frameBoxes([figureBox(f, dims, ref)], { aspect, margin: f === "full" ? 0.03 : f === "bust" ? 0.06 : 0.1, tilt: 0.04, minDist: 1 });
}

export const sameCam = (a: CamState, b: CamState, tol = 1e-5) =>
  Math.abs(a.fov - b.fov) < tol && a.eye.every((v, i) => Math.abs(v - b.eye[i]) < tol) && a.target.every((v, i) => Math.abs(v - b.target[i]) < tol);

/**
 * Ease the camera towards a target that may change at any time (a new framing, a taller build, a
 * slider being dragged). Each step closes a share of the gap that depends only on the time since the
 * last (`dt`, ms), so a target that moves every frame is followed a little behind and never stalls
 * or jumps. `ms` is about how long an arrival takes (to within a pixel); 0 cuts. Returns `target`
 * itself once it has arrived.
 */
export function stepCam(shown: CamState, target: CamState, dt: number, ms: number): CamState {
  if (ms <= 0 || dt >= ms) return target;
  const c = blendCam(shown, target, 1 - Math.exp(-5 * Math.max(0, dt) / ms));
  return sameCam(c, target, 2e-3) ? target : c;
}
