// Things in a hand (the `hold` slot: a cane, an umbrella, a phone) and on the wrist. A held part
// either hangs on the hand bone, so it swings with the arm (its handle at `gripAt`), or stands on
// the root bone with its handle where the hanging hand is (`restGrip`: a suitcase, a cane on the
// floor). Its pieces carry `hold: side`, so the stage leaves them out while the script puts a prop
// in that hand, and the part closes the hand with `alt: { hand_r: "hold" }` in its output.

import { apply, humanoid, restPose, solve, type BodyDims, type Group, type Item, type PartOut, type Vec2 } from "sahne";

/** The grip in the hand bone's frame: the middle of the closed hand. */
export const gripAt = (b: BodyDims): Vec2 => [0, b.handL * 0.45];

/**
 * Where the hanging hand grips, in the root bone's frame (paper space at rest: x across, y up is
 * negative, the floor at y = 0). Measured: an adult's is about 50 cm above the floor and 19–22 cm
 * from the centre line, an elder's 43–46, a child's 30–32, a toddler's 22–24. `l` is the wearer's left (+x).
 */
export function restGrip(b: BodyDims, side: "l" | "r"): Vec2 {
  const hand = solve(humanoid(b), restPose()).get(`hand_${side}`)!;
  return apply(hand, 0, b.handL * 0.45);
}

/** The hand bone of a side. */
export const handBone = (side: "l" | "r") => `hand_${side}`;

/** The hand (`l`, `r`) a held part is in: the wearer's right unless its side says left (`b` is not a hand; the right). */
export const holdHand = (side: "l" | "r" | "b" | null | undefined): "l" | "r" => (side === "l" ? "l" : "r");

/**
 * The output of a held part from its pieces per view: each piece on the hand bone (or the root bone
 * when `onRoot`), marked as held in that hand, and the hand closed round it.
 */
export function heldOut(hand: "l" | "r", front: Group[], back: Group[], o: { layer?: string; onRoot?: boolean; shape?: string } = {}): PartOut {
  const bone = o.onRoot ? "root" : handBone(hand), layer = o.layer ?? "over_sleeve";
  const items = (gs: Group[]): Item[] => gs.map(group => ({ layer, bone, group, hold: hand }));
  return { front: items(front), back: items(back), alt: { [`hand_${hand}`]: o.shape ?? "hold" } };
}
