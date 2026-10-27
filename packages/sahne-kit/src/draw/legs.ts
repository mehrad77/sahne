// Bottoms: the pelvis piece and the legs. The pelvis hangs on the hips bone (the pivot at the hip
// joints' height, y down); trouser legs are strips on the leg chains, under the shoes (`trouser`).
// A wide leg that falls over the shoe is a second strip on `trouser_hem` (above `shoe`), cut flat.

import { smooth, rrect, tone, type BodyDims, type Group, type Item, type StripSpec } from "sahne";
import { S, line, type Pt } from "./shapes.ts";

/** The widths of a trouser leg at hip, knee and ankle (cm), `extra` added to each. */
export const trouserWidths = (b: BodyDims, extra = 0): [number, number, number] => [b.legW[0] * 1.14 + 2 + extra, b.legW[1] * 1.12 + 1.8 + extra, b.legW[2] * 1.16 + 1.8 + extra];

/** Two trouser legs from the hip to `to` of the leg (0.97 reaches the shoe), on layer `trouser`. */
export function trouserLegs(b: BodyDims, c: string, to = 0.97, spec: Partial<Pick<StripSpec, "stripes" | "caps" | "color">> & { extra?: number } = {}): Item[] {
  const { extra, ...rest } = spec, w = trouserWidths(b, extra ?? 0);
  return (["leg_l", "leg_r"] as const).map(chain => ({ layer: "trouser", bone: "hips", strip: { chain, widths: w, color: c, from: 0, to, ...rest } }));
}

/**
 * The hem of a wide leg, over the shoe's upper: a short strip from `from` to 1 on `trouser_hem`,
 * cut flat at both ends, `flare` cm wider at the ankle than the leg.
 */
export function trouserHems(b: BodyDims, c: string, from = 0.86, flare = 2): Item[] {
  const w = trouserWidths(b), wide: [number, number, number] = [w[0], w[1] + flare * 0.5, w[2] + flare];
  return (["leg_l", "leg_r"] as const).map(chain => ({ layer: "trouser_hem", bone: "hips", strip: { chain, widths: wide, color: c, from, to: 1 } }));
}

/** The seat and fly of trousers: the piece that joins the legs at the hips (front with a fly, back without). */
export function pelvis(b: BodyDims, c: string, fly = true): Group {
  return { shapes: [S(pelvisOutline(b), c), ...(fly ? [line([[0.8, -3], [0.9, 8.5], [0, 11]], tone(c, "shade"), 0.6, 0.7)] : []), waistband(b, c)] };
}

/** The pelvis piece's outline (the ground for a print on trousers). */
export function pelvisOutline(b: BodyDims): Pt[] {
  const hw = b.hipW / 2 + 1.6, ww = b.waistW / 2 + 1;
  return [[-ww, -6, 0], [ww, -6, 0], [hw, 4], [hw + 0.6, 13, 0], [b.legW[0] * 0.1, 15, 0], [0, 12.5], [-b.legW[0] * 0.1, 15, 0], [-hw - 0.6, 13, 0], [-hw, 4]];
}

/** A waistband's flat shade across the top of a bottom (y -6 … -3.4). */
export const waistband = (b: BodyDims, c: string, h = 2.6) => {
  const ww = b.waistW / 2 + 1;
  return { path: rrect(-ww, -6, ww * 2, h, 0.8), fill: tone(c, "shade"), flat: true, opacity: 0.5 };
};

/** A skirt's outline on the hips bone: from the waist (y -6) flaring to `bottom` (y), `flare` cm past the hips at the hem. */
export function skirtOutline(b: BodyDims, bottom: number, flare = 9): Pt[] {
  const ww = b.waistW / 2 + 1.2, hw = b.hipW / 2 + flare;
  return [[-ww, -6, 0], [ww, -6, 0], [b.hipW / 2 + 2, 8], [hw, bottom - 1, 0], [hw * 0.5, bottom + 0.8], [0, bottom], [-hw * 0.5, bottom + 0.8], [-hw, bottom - 1, 0], [-b.hipW / 2 - 2, 8]];
}

/** A skirt's outline as a path. */
export const skirtPath = (b: BodyDims, bottom: number, flare = 9) => smooth(skirtOutline(b, bottom, flare), true, 1);
