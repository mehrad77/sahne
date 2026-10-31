// The kit's shared drawing helpers in one import: `import { … } from "./draw/index.ts"`. Art files
// use these and never copy them; a helper only one file needs stays in that file.

export { S, P, line, strand, flat, named, sidesOf, type Pt } from "./shapes.ts";
export { headPath, headHalfWidth, headArc, headCrown, offsetHead, insetHead, eyeAt, earAt, head, headOf, belowBand, outsideBand, crownClip, bandClip, HEAD_SHAPES, EAR_SHAPES, HEAD_Y, type Head, type Ear, type Band } from "./head.ts";
export { hairPart, onHead, onNeck, headToNeck, backCover, shortFront, sheen, hairBulk, HAIR_BULK } from "./hair.ts";
export { torsoOutline, torsoPath, torsoPanel, sideShade, chestPatch, sleeves, cuffs, outerSleeves, outerCuffs, hemAt, floorHem, HEM, type TorsoCut } from "./torso.ts";
export { trouserWidths, trouserLegs, trouserHems, pelvis, pelvisOutline, waistband, skirtOutline, skirtPath } from "./legs.ts";
export { shoe, feet, bareFoot, bootShafts, shoeHalfWidth, footScale, darkSole } from "./feet.ts";
export { gripAt, restGrip, handBone, holdHand, heldOut } from "./hold.ts";
export { ringAt, handOutline, handShape, HAND_SHAPES } from "../hands.ts";
export { printed, stripPrint, patternShapes, patternSwatch, patternsFor, printScale, inksOf, PATTERNS, type PrintOptions } from "../patterns.ts";
export { nm, LENS_ALPHA, lensAlpha } from "../palette.ts";
