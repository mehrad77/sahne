// Shoes and feet. A foot piece hangs on bone foot_l / foot_r: the pivot at the ankle, +y down, the
// floor at y = footH; side 1 is the wearer's left foot (foot_l, +x), and its inner side (the big
// toe) is towards the body's centre, -x. A closed shoe spans y -1.8 (the opening) to h + 0.6.
// Scale small details with s = footH / 5 (adult 1, child 0.8, toddler 0.7). Tall boots add a shaft:
// up to 0.35 of the shin a group on shin_l / shin_r, from half the shin a strip on layer `shaft`.

import { ellipse, rrect, tone, mix, type BodyDims, type Group, type Item, type Shape } from "sahne";
import { S, line } from "./shapes.ts";
import { trouserWidths } from "./legs.ts";

/** A shoe's half width: the foot's, or wider on a body whose ankles are wider. */
export const shoeHalfWidth = (b: BodyDims): number => Math.max(b.footW / 2 + 0.8, 0.6 * b.legW[2]);

/** The scale of a shoe's small details (laces, straps, eyelets): footH / 5. */
export const footScale = (b: BodyDims): number => b.footH / 5;

/** The first kit's shoe: an upper, a toe highlight, an optional sole and laces. `side` 1 is the left foot. */
export function shoe(b: BodyDims, upper: string, sole: string | null, side: 1 | -1, laces: boolean): Group {
  const w = b.footW / 2 + 0.8, h = b.footH, x = side * 0.8;
  const shapes: Shape[] = [
    S([[x - w * 0.8, -1.8], [x + w * 0.8, -1.8], [x + w, h * 0.55], [x + w * 0.92, h + 0.6, 0], [x - w * 0.92, h + 0.6, 0], [x - w, h * 0.55]], upper),
    { path: ellipse(x - w * 0.25, h * 0.15, w * 0.35, 0.8), fill: tone(upper, "light"), flat: true, opacity: 0.6 },
  ];
  if (sole) shapes.push({ path: rrect(x - w * 0.95, h - 0.9, w * 1.9, 1.7, 0.8), fill: sole });
  if (laces) shapes.push(line([[x - w * 0.35, -0.6], [x + w * 0.35, -0.2]], tone(upper, "deep"), 0.5, 0.7), line([[x - w * 0.35, 0.9], [x + w * 0.35, 1.3]], tone(upper, "deep"), 0.5, 0.7));
  return { shapes };
}

/** A pair of foot pieces from a drawing of one foot (side 1 = the left foot, on foot_l). */
export const feet = (draw: (side: 1 | -1) => Group, layer = "shoe"): Item[] => [{ layer, bone: "foot_l", group: draw(1) }, { layer, bone: "foot_r", group: draw(-1) }];

/**
 * A bare foot, for every shoe that shows skin (sandals, slides, slippers): the foot from the ankle
 * (y -1) to the floor (h + 0.3) with five toes along its front edge, the big toe on the inner side
 * (towards the body's centre), and flat shade lines between them. Draw the straps over it.
 */
export function bareFoot(b: BodyDims, skin: string, side: 1 | -1): Shape[] {
  const w = b.footW / 2 + 0.3, h = b.footH, s = footScale(b), x = side * 0.8, shade = tone(skin, "shade");
  const out: Shape[] = [S([[x - w * 0.62, -1], [x + w * 0.62, -1], [x + w * 0.95, h * 0.55], [x + w * 0.9, h + 0.3, 0], [x - w * 0.9, h + 0.3, 0], [x - w * 0.95, h * 0.55]], skin)];
  // toes from the inner side (-side · x) outwards: the big toe first
  const widths = [2.2, 1.7, 1.5, 1.3, 1.1].map(v => v * s), total = widths.reduce((a, v) => a + v, 0) * 1.04;
  let at = x - side * total / 2;
  widths.forEach((tw, i) => {
    const cx = at + side * tw / 2;
    out.push({ path: ellipse(cx, h - 0.1 * s - (i === 0 ? 0 : 0.15 * i * s), tw / 2, tw * 0.42), fill: skin });
    if (i) out.push(line([[at, h - 0.9 * s], [at, h + 0.1]], shade, 0.3, 0.5));
    at += side * tw * 1.04;
  });
  out.push({ path: ellipse(x - side * w * 0.2, h * 0.2, w * 0.4, 0.9), fill: tone(skin, "light"), flat: true, opacity: 0.35 });
  return out;
}

/**
 * The shaft of a tall boot as strips over the trouser (layer `shaft`, flat ends): from `k` of the
 * shin above the ankle (0.5 mid-calf, 0.8 a rain boot, 0.95 the knee) down to the foot, `extra` cm
 * wider than the trouser leg so it covers it.
 */
export function bootShafts(b: BodyDims, c: string, k: number, extra = 0.8): Item[] {
  const w = trouserWidths(b, extra), from = 1 - 0.5 * Math.min(1, Math.max(0, k));
  return (["leg_l", "leg_r"] as const).map(chain => ({ layer: "shaft", bone: "hips", strip: { chain, widths: w, color: c, from, to: 1 } }));
}

/** A sole colour derived from an upper (the leather shoes' darker sole). */
export const darkSole = (c: string) => mix(c, "#000", 0.5);
