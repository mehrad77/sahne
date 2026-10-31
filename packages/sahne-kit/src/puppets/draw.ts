// The animal puppets' few drawing helpers (copied small from set/draw.ts, which would bring every palette into this bundle).

import { smooth, mix, type Affine, type Item, type Path, type Shape, type Vec2 } from "sahne";

export type Pt = Vec2 | [number, number, number];
/** A shape from a path. */
export const S = (path: Path, fill: string, o: Partial<Shape> = {}): Shape => ({ path, fill, ...o });
/** A closed shape smoothed through points (a third coordinate 0 makes a corner). */
export const P = (pts: Pt[], fill: string, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, true, 1), fill, ...o });
/** A printed line (flat, no rim). */
export const L = (pts: Vec2[], c: string, w = 0.6, op = 0.85): Shape => ({ path: smooth(pts, false, 1), stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op });
/** A paper part as the street cats are cut (set/outdoor.ts): the fur with a shade along its lower right, the light from the upper left, its marks clipped inside it. */
export const part = (q: Path, col: string, marks: Shape[] = []): Shape[] =>
  [S(q, mix(col, "#463C38", 0.22)), S(q.move(-0.45, -0.55), col, { flat: true, clip: q }), ...marks.map(s => ({ ...s, clip: q }))];

/** Shapes through an affine, their clips with them (a clip shared by several shapes stays one path). */
export function tf(sh: Shape[], m: Affine): Shape[] {
  const done = new Map<Path, Path>(), t = (q: Path) => done.get(q) ?? done.set(q, q.transform(m)).get(q)!;
  return sh.map(s => ({ ...s, path: t(s.path), ...(s.stroke ? { stroke: { ...s.stroke, width: s.stroke.width * m[0] } } : {}), ...(s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(t) : t(s.clip) } : {}) }));
}

/**
 * A puppet piece: art drawn in the art's own frame (art units, y down, feet at the origin), moved onto its bone (`at` its pivot)
 * and scaled to cm; `alt` is `key=value` (a trailing `*` makes it the default), `-` always drawn.
 */
export function piece(bone: string, at: Vec2, scale: number, alt: string, shapes: Shape[]): Item {
  const [key, v] = alt.split("="), value = v?.replace("*", "");
  return { layer: bone, bone, ppcm: 8, group: { edge: 0.4, shapes: tf(shapes, [scale, 0, 0, scale, -at[0] * scale, -at[1] * scale]) },
    ...(value ? { alt: { key, value, ...(v.endsWith("*") ? { default: true } : {}) } } : {}) };
}

/** A part's box over its shapes, in the frame they are drawn in. */
export function boxOf(sh: Shape[]): [number, number, number, number] {
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of sh) { const [x0, y0, x1, y1] = s.path.bounds(), r = (s.stroke?.width ?? 0) / 2; b[0] = Math.min(b[0], x0 - r); b[1] = Math.min(b[1], y0 - r); b[2] = Math.max(b[2], x1 + r); b[3] = Math.max(b[3], y1 + r); }
  return b;
}
