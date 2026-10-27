// The kit's drawing shorthands: a smooth filled shape through points, a flat line, a strand, and a
// part with its names. Every art file uses these instead of its own copies.

import { smooth, type PartDef, type Path, type Shape, type Vec2 } from "sahne";
import { nm } from "../palette.ts";

/** A point of a smooth outline; [x, y, 0] is a corner. */
export type Pt = Vec2 | [number, number, number];

/** A filled shape through points (a smooth closed outline; [x, y, 0] marks a corner). */
export const S = (pts: Pt[], fill: string, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, true, 1), fill, ...o });

/** A filled shape from a path. */
export const P = (path: Path, fill: string, o: Partial<Shape> = {}): Shape => ({ path, fill, ...o });

/** A printed line (a seam, a fold, stitching): flat, a stroke of width `w` cm at opacity `op`. */
export const line = (pts: Vec2[], c: string, w = 0.5, op = 0.6, o: Partial<Shape> = {}): Shape => ({ path: smooth(pts, false, 1), stroke: { color: c, width: w }, flat: true, opacity: op, ...o });

/** A strand of hair: a thin flat line, a little darker or lighter than the hair. */
export const strand = (pts: Vec2[], c: string, w = 0.55, op = 0.5): Shape => line(pts, c, w, op);

/** A flat printed patch (blush, painted shade, a fade): no rim, no shadow. */
export const flat = (path: Path, fill: string, opacity = 1): Shape => ({ path, fill, flat: true, opacity });

/**
 * A part with its English and Turkish names: `named("top", "T-shirt", "tişört", { colors: 1, … draw })`.
 * The slot comes first, and `name` is the English name, as the kit tests expect.
 */
export const named = (slot: string, en: string, tr: string, rest: Omit<PartDef, "slot" | "name" | "names">): PartDef => ({ slot, name: en, names: nm(en, tr), ...rest });

/** The sides a one-sided part draws: 1 (the wearer's left, +x), -1 (the right), or both. */
export const sidesOf = (side: "l" | "r" | "b" | null | undefined, fallback: "l" | "r" | "b" = "r"): (1 | -1)[] => {
  const s = side ?? fallback;
  return s === "b" ? [1, -1] : s === "l" ? [1] : [-1];
};
