// Small maths for the stage: 2D affine transforms for the paper rig (centimetres, y down)
// and 4x4 matrices for the 3D camera (metres, y up, column-major like WebGL).

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];
/** x' = a·x + c·y + e, y' = b·x + d·y + f (the SVG / Canvas convention). */
export type Affine = [number, number, number, number, number, number];
export type Box = [number, number, number, number]; // x0, y0, x1, y1

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** The length of a polyline. */
export const polyLength = (pts: Vec3[]) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2]), 0);
/** The point `k` (0…1) of the way along a polyline, at an even speed. */
export function polyAt(pts: Vec3[], k: number): Vec3 {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1], p[2] - pts[i][2])), total = lens.reduce((a, b) => a + b, 0);
  let d = clamp(k, 0, 1) * total, i = 0;
  while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
  const a = pts[i], b = pts[i + 1] ?? a, f = lens[i] ? d / lens[i] : 0;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];
}
export const smoothstep = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export function mul(m: Affine, n: Affine): Affine {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
export const apply = (m: Affine, x: number, y: number): Vec2 => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
export const translate = (x: number, y: number): Affine => [1, 0, 0, 1, x, y];
export const scale = (sx: number, sy = sx): Affine => [sx, 0, 0, sy, 0, 0];
export const rotate = (r: number): Affine => { const c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };
/** Rotation by r about the point (px, py). */
export const rotateAbout = (r: number, px: number, py: number): Affine => mul(translate(px, py), mul(rotate(r), translate(-px, -py)));

export function boxUnion(a: Box | null, b: Box): Box {
  return a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : [...b] as Box;
}
export const boxPad = (b: Box, p: number): Box => [b[0] - p, b[1] - p, b[2] + p, b[3] + p];

// ---- 3D (column-major 4x4) -------------------------------------------------

export type Mat4 = Float32Array;

export function perspective(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far), m = new Float32Array(16);
  m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
  return m;
}

export function lookAt(eye: Vec3, target: Vec3, up: Vec3 = [0, 1, 0]): Mat4 {
  let zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx;
  l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const m = new Float32Array(16);
  m[0] = xx; m[1] = yx; m[2] = zx;
  m[4] = xy; m[5] = yy; m[6] = zy;
  m[8] = xz; m[9] = yz; m[10] = zz;
  m[12] = -(xx * eye[0] + xy * eye[1] + xz * eye[2]);
  m[13] = -(yx * eye[0] + yy * eye[1] + yz * eye[2]);
  m[14] = -(zx * eye[0] + zy * eye[1] + zz * eye[2]);
  m[15] = 1;
  return m;
}

export function mat4Mul(a: Mat4, b: Mat4): Mat4 {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}

/** Project a world point to normalised device coordinates; w ≤ 0 means behind the camera. */
export function project(m: Mat4, p: Vec3): [number, number, number, number] {
  const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
  const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
  const z = m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14];
  const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
  return [x / w, y / w, z / w, w];
}

// ---- Easing ------------------------------------------------------------------

export const ease = {
  linear: (t: number) => t,
  inOut: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
  /** A damped spring from 0 to 1; zeta < 1 overshoots a little. */
  spring: (t: number, zeta = 0.62, omega = 11) => {
    if (t >= 1) return 1;
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t));
  },
};
