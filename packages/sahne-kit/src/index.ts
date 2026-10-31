// The first Sahne kit: paper cut-outs in a warm Istanbul palette, drawn in code.
//
// This file only assembles the kit. The parts live in one file per category (below), each owned by
// one artist, so the files can grow in parallel; none of them is edited here. Shared drawing
// helpers are in draw/, patterns in patterns.ts, colours in palette.ts, and what a learner may pick
// (open, unlock, cast, hidden) in curation.ts.

import type { AvatarDoc, Kit, PartDef } from "sahne";
import { DRAWN_ALIASES } from "./set/drawn/aliases.gen.ts";
import { PALETTES, FAMILIES, COLOR_NAMES, PALETTE_UNLOCKS, color, nm } from "./palette.ts";
import { body, base, LAYERS, BODY_CHOICES } from "./body.ts";
import { faceStyle, region, draw as drawFace, EMOTIONS, VISEMES, FACE_CHOICES } from "./face.ts";
import { side, regionSide, drawSide } from "./side.ts";
import { HAIR_PARTS } from "./hair.ts";
import { HAIR_TEXTURED } from "./hair_textured.ts";
import { HEADWEAR } from "./headwear.ts";
import { TOPS } from "./tops.ts";
import { OUTER } from "./outer.ts";
import { BOTTOMS } from "./bottoms.ts";
import { DRESSES } from "./dresses.ts";
import { SHOES } from "./shoes.ts";
import { EYEWEAR } from "./eyewear.ts";
import { ACCESSORIES } from "./accessories.ts";
import { CARRY } from "./carry.ts";
import { PATTERNS } from "./patterns.ts";
import { PARTS as CURATION, PATTERNS as CURATED_PATTERNS, FEATURES as CURATED_FEATURES, STARTER_FABRICS } from "./curation.ts";
import { GESTURES } from "./gestures.ts";
import { HAND_SHAPES } from "./hands.ts";
import { SOUNDS } from "./sounds.ts";
import { INSTRUMENTS, MOTIFS } from "./music.ts";

const ID = "sahne-kit@1";

/** The parts by file (the artists' categories), for the tests and the catalogue: ids must be unique across them. */
export const PART_FILES: Record<string, Record<string, PartDef>> = {
  hair: HAIR_PARTS, hair_textured: HAIR_TEXTURED, headwear: HEADWEAR, tops: TOPS, outer: OUTER, bottoms: BOTTOMS, dresses: DRESSES,
  shoes: SHOES, eyewear: EYEWEAR, accessories: ACCESSORIES, carry: CARRY,
};

/**
 * Every part, curated by curation.ts: its `unlock` token, and the `cast` or `hidden` tag (the builder
 * offers neither). The art files' own `cast` and `hidden` tags are replaced, so the file is the one place.
 */
function curate(id: string, p: PartDef): PartDef {
  const c = Object.hasOwn(CURATION, id) ? CURATION[id] : undefined;
  const own = (p.tags ?? []).filter(t => t !== "cast" && t !== "hidden");
  const tags = c?.avail === "cast" || c?.avail === "hidden" ? [...own, c.avail] : own;
  return { ...p, ...(tags.length || p.tags ? { tags } : {}), ...(c?.avail === "unlock" && c.unlock ? { unlock: c.unlock } : {}) };
}
const parts: Record<string, PartDef> = {};
for (const file of Object.values(PART_FILES)) for (const [id, p] of Object.entries(file)) parts[id] = curate(id, p);

/** The kit's default character: the builder's starting point, and what a required slot falls back to. */
const defaultDoc: AvatarDoc = {
  v: 1, kit: ID, body: { build: "adult", height: 0.5, shape: "average" }, skin: "skin_04", face: {},
  hair: { style: "hair_short", color: "hair_02" },
  outfit: { top: { id: "top_tee" }, bottom: { id: "bottom_jeans" }, shoes: { id: "shoes_sneakers" } },
};

/** The randomiser's odds of colours: grey, silver and white hair are rare among adults, common among elders, and not for children. */
const odds = {
  hair_08: { adult: 0.25, elder: 3, child: 0, toddler: 0 },
  hair_09: { adult: 0.15, elder: 3, child: 0, toddler: 0 },
  hair_18: { adult: 0.15, elder: 2, child: 0, toddler: 0 },
};

/** The builder's words: sections, fields and a few UI words, in English and Turkish. */
const labels = {
  body: nm("Body", "Vücut"), face: nm("Face", "Yüz"), hair: nm("Hair", "Saç"), clothes: nm("Clothes", "Giysiler"), extras: nm("Extras", "Aksesuar"),
  none: nm("None", "yok"), colour: nm("Colour", "Renk"), pattern: nm("Pattern", "Desen"), side: nm("Side", "Taraf"),
  "body.build": nm("Age", "Yaş"), "body.height": nm("Height", "Boy"), "body.shape": nm("Build", "Vücut tipi"), skin: nm("Skin", "Ten"),
  "face.shape": nm("Face shape", "Yüz şekli"), "face.eyes": nm("Eyes", "Gözler"), "face.eyeColor": nm("Eye colour", "Göz rengi"), "face.brows": nm("Eyebrows", "Kaşlar"),
  "face.nose": nm("Nose", "Burun"), "face.mouth": nm("Mouth", "Ağız"), "face.ears": nm("Ears", "Kulaklar"), "face.marks": nm("Face marks", "Yüz işaretleri"),
  facialHair: nm("Facial hair", "Sakal ve bıyık"),
  "hair.style": nm("Hair style", "Saç"),
  "outfit.top": nm("Top", "Üst"), "outfit.bottom": nm("Bottom", "Alt"), "outfit.dress": nm("Dress", "Elbise"), "outfit.outer": nm("Jacket", "Ceket"), "outfit.shoes": nm("Shoes", "Ayakkabı"),
  "wear.head": nm("Head", "Baş"), "wear.hat": nm("Hat", "Şapka"), "wear.hair": nm("Hair accessory", "Saç aksesuarı"), "wear.eyes": nm("Glasses", "Gözlük"), "wear.ears": nm("Ears", "Kulak"),
  "wear.aid": nm("Hearing aid", "İşitme cihazı"), "wear.neck": nm("Neck", "Boyun"), "wear.wrist": nm("Wrist", "Bilek"), "wear.hands": nm("Hands", "Eller"), "wear.waist": nm("Waist", "Bel"),
  carry: nm("Bag", "Çanta"), hold: nm("In hand", "Elde"),
};

export const kit: Kit = {
  id: ID,
  palettes: PALETTES,
  color,
  body,
  base,
  parts,
  aliases: { ...DRAWN_ALIASES },
  features: { ...BODY_CHOICES, ...FACE_CHOICES },
  labels,
  families: FAMILIES,
  colorNames: COLOR_NAMES,
  paletteUnlocks: PALETTE_UNLOCKS,
  patterns: PATTERNS,
  odds,
  defaultDoc,
  layers: LAYERS,
  face: { style: faceStyle, region, draw: drawFace, regionSide, drawSide, emotions: EMOTIONS, visemes: VISEMES },
  side,
  // set pieces and props come in families from `sahne-kit/set` (`loadSet`, `withSet`), or all at once from `sahne-kit/full`
  set: {},
  props: {},
  gestures: GESTURES,
  sounds: SOUNDS,
  instruments: INSTRUMENTS,
  motifs: MOTIFS,
};

/**
 * The starter set as a builder's `offer` (curation.ts, `starter`): what a new learner sees at first.
 * Parts and face values marked `starter` where their field has any, everything where it has none;
 * the starter fabrics, and every skin, hair and eye colour; the starter patterns.
 */
const STARTER_SLOTS = new Set(Object.entries(parts).filter(([id]) => CURATION[id]?.starter).map(([, p]) => p.slot));
const STARTER_FIELDS = new Set(Object.entries(CURATED_FEATURES).filter(([, c]) => c.starter).map(([k]) => k.split(":")[0]));
const FABRIC_STARTERS = new Set(STARTER_FABRICS);
export function starterOffer(field: string, value: string, kind: "option" | "color" | "pattern"): boolean {
  if (kind === "color") return !Object.hasOwn(PALETTES.fabric, value) || FABRIC_STARTERS.has(value);
  if (kind === "pattern") return !!CURATED_PATTERNS[value]?.starter;
  const p = Object.hasOwn(parts, value) ? parts[value] : undefined;
  if (p) return !STARTER_SLOTS.has(p.slot) || !!CURATION[value]?.starter;
  return !STARTER_FIELDS.has(field) || !!CURATED_FEATURES[`${field}:${value}`]?.starter;
}

export { PALETTES, FAMILIES, EMOTIONS, VISEMES, GESTURES, HAND_SHAPES, SOUNDS, INSTRUMENTS, MOTIFS, PATTERNS };
export default kit;
