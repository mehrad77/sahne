// The torso and the arms of clothes, drawn from the body's measurements so one generator fits every
// build and shape. Torso pieces hang on the spine bone: the pivot at the hips (y = 0), the shoulder
// line at y = -torsoL; hems below the hip are positive y. Sleeves are strips on the arm chains.
//
// Widths, so layers never show through each other: a top's sleeve is `sleeves` (about 1.2 × the
// arm), an outer layer's is `outerSleeves` (about 1.5 cm wider again), a top's torso is
// `torsoOutline` with loose 1–1.8, an outer's with loose ≥ 2.4 and a hem at 8 cm or lower.

import { smooth, tone, type BodyDims, type Item, type Path, type Shape, type StripSpec } from "sahne";
import { S, type Pt } from "./shapes.ts";

export interface TorsoCut {
  /** How deep the front collar dips below the shoulder line (cm); the back's is 1.2. */
  neck: number;
  /** How far the hem's middle drops below its sides (cm). */
  drop: number;
  /** How much wider than the body (cm, each side): tops 1–1.8, outers 2.4 and more. */
  loose: number;
  /** The hem's y on the spine bone (cm below the hip pivot). */
  hem: number;
  /** The back view's outline (no front collar dip). */
  back?: boolean;
}

/** The torso silhouette of a garment, as outline points (pass to `S` or `smooth`). */
export function torsoOutline(b: BodyDims, o: TorsoCut): Pt[] {
  const T = b.torsoL, sw = b.shoulderW / 2, cw = b.chestW / 2 + o.loose, ww = b.waistW / 2 + o.loose * 1.3, hw = b.hipW / 2 + o.loose, nw = b.neckW / 2 + 1.4;
  const neckDip = o.back ? 1.2 : o.neck;
  return [
    [-nw, -T - 0.6, 0], [-(sw - 1.2), -T + 1.4], [-(sw + 0.3), -T + 4.6, 0], [-cw, -T + 14.5], [-ww, -T * 0.32], [-hw, o.hem, 0],
    [0, o.hem + o.drop], [hw, o.hem, 0], [ww, -T * 0.32], [cw, -T + 14.5], [sw + 0.3, -T + 4.6, 0], [sw - 1.2, -T + 1.4], [nw, -T - 0.6, 0],
    [nw * 0.55, -T - 0.6 + neckDip * 0.7], [0, -T - 0.6 + neckDip], [-nw * 0.55, -T - 0.6 + neckDip * 0.7],
  ];
}

/** The torso outline as a path (the ground of a print: `printed(ctx, torsoPath(b, cut), { hem: cut.hem })`). */
export const torsoPath = (b: BodyDims, o: TorsoCut): Path => smooth(torsoOutline(b, o), true, 1);

/**
 * One front panel of an open garment (a cardigan, a blazer): the torso cut down the middle with a
 * gap of `gap` cm at the chest widening to `gapHem` at the hem. Side 1 is the wearer's left (+x).
 * Leave the gap empty, so the top and a necklace show; at most a flat shade strip along the edge.
 */
export function torsoPanel(b: BodyDims, o: TorsoCut & { gap: number; gapHem?: number; lapel?: number }, side: 1 | -1): Pt[] {
  const T = b.torsoL, sw = b.shoulderW / 2, cw = b.chestW / 2 + o.loose, ww = b.waistW / 2 + o.loose * 1.3, hw = b.hipW / 2 + o.loose, nw = b.neckW / 2 + 1.4;
  const g = o.gap / 2, gh = (o.gapHem ?? o.gap) / 2, lap = o.lapel ?? o.neck;
  const pts: Pt[] = [[nw, -T - 0.6, 0], [sw - 1.2, -T + 1.4], [sw + 0.3, -T + 4.6, 0], [cw, -T + 14.5], [ww, -T * 0.32], [hw, o.hem, 0], [gh, o.hem + o.drop * 0.6, 0], [g, -T + lap + 4], [g * 0.6 + nw * 0.4, -T + lap, 0]];
  return pts.map(p => (p.length === 3 ? [side * p[0], p[1], 0] : [side * p[0], p[1]]) as Pt);
}

/** The shade down the side away from the light: light comes from the picture's upper left, so the +x side (the viewer's right in front) is in shade. */
export function sideShade(b: BodyDims, c: string, loose: number, hem: number): Shape {
  const T = b.torsoL, cw = b.chestW / 2 + loose, ww = b.waistW / 2 + loose * 1.3, hw = b.hipW / 2 + loose;
  return S([[cw - 3.2, -T + 15], [cw, -T + 14.5], [ww, -T * 0.32], [hw, hem], [hw - 3, hem], [ww - 3.2, -T * 0.32]], tone(c, "shade"), { flat: true, opacity: 0.55 });
}

/**
 * Skin under a deep neckline (a V, a wrap, an open cardigan over nothing): the base body draws a
 * neck but no chest, so a garment whose opening goes deeper than 5 cm below the shoulder line puts
 * this patch first. `depth` is how far below the shoulder line, `width` the opening at the top.
 */
export function chestPatch(b: BodyDims, skin: string, depth: number, width = b.neckW + 6): Shape {
  const T = b.torsoL, w = width / 2;
  return S([[-w, -T - 0.8, 0], [w, -T - 0.8, 0], [w * 0.8, -T + depth * 0.4], [0, -T + depth + 1, 0], [-w * 0.8, -T + depth * 0.4]], skin);
}

/** Extra spec for every strip of a pair (a print's stripes and colour, the caps). */
type StripExtra = Partial<Pick<StripSpec, "stripes" | "caps" | "color">>;

/** A top's sleeves: two strips from the shoulder to `to` (0.42 short, 0.97 long) on layer `sleeve`. */
export function sleeves(b: BodyDims, c: string, to: number, extra = 1.6, layer = "sleeve", spec: StripExtra = {}): Item[] {
  const w: [number, number, number] = [b.armW[0] * 1.18 + extra, b.armW[1] * 1.16 + extra, b.armW[2] * 1.12 + extra];
  return (["arm_l", "arm_r"] as const).map(chain => ({ layer, bone: "spine", strip: { chain, widths: w, color: c, from: 0, to, ...spec } }));
}

/** Cuffs: a short wider band at `at` … `at + 0.07` of the arm (flat ends). */
export function cuffs(b: BodyDims, c: string, at: number, extra = 1.8, layer = "sleeve"): Item[] {
  const w: [number, number, number] = [b.armW[0] * 1.2 + extra, b.armW[1] * 1.18 + extra, b.armW[2] * 1.14 + extra];
  return (["arm_l", "arm_r"] as const).map(chain => ({ layer, bone: "spine", strip: { chain, widths: w, color: c, from: at, to: Math.min(1, at + 0.07) } }));
}

/** An outer layer's sleeves: about 1.5 cm wider than any top's at every joint, on layer `outer_sleeve`, round at the shoulder and cut flat at the cuff. */
export function outerSleeves(b: BodyDims, c: string, to = 0.97, spec: StripExtra = {}): Item[] {
  const w: [number, number, number] = [b.armW[0] * 1.28 + 3.6, b.armW[1] * 1.26 + 3.4, b.armW[2] * 1.22 + 3.2];
  return (["arm_l", "arm_r"] as const).map(chain => ({ layer: "outer_sleeve", bone: "spine", strip: { chain, widths: w, color: c, from: 0, to, ...spec } }));
}

/** An outer layer's cuffs or rib: a second short strip on `outer_sleeve`, from `at` to `to`. */
export function outerCuffs(b: BodyDims, c: string, at = 0.9, to = 0.98): Item[] {
  const w: [number, number, number] = [b.armW[0] * 1.3 + 4, b.armW[1] * 1.28 + 3.8, b.armW[2] * 1.24 + 3.6];
  return (["arm_l", "arm_r"] as const).map(chain => ({ layer: "outer_sleeve", bone: "spine", strip: { chain, widths: w, color: c, from: at, to } }));
}

/** Hem heights below the hip, as fractions of the thigh: upper thigh, knee, mid-calf (spine and hips bones). */
export const HEM = { thigh: 0.4, knee: 1, calf: 1.3 } as const;

/** The y of a hem on the spine or hips bone: `hemAt(b, "knee")`, or a fraction of the thigh. */
export const hemAt = (b: BodyDims, at: keyof typeof HEM | number): number => b.thighL * (typeof at === "number" ? at : HEM[at]);

/** A floor-length hem that still shows the shoes, on the spine or hips bone. */
export const floorHem = (b: BodyDims): number => b.legLen - b.footH - 3;
