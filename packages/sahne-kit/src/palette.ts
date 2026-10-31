// The kit's palettes. Learners and the cast pick colours only from these, so every
// combination stays in the style (DESIGN.md §5.2). Ids are permanent; a palette lists its
// colours in the order the builder shows them (skins light to deep).

import { luma } from "sahne";
import { unlocksOf } from "./curation.ts";

/** A name in English and Turkish, for parts, features, colours and labels. */
export const nm = (en: string, tr: string) => ({ en, tr });

type Named = Record<string, [hex: string, en: string, tr: string]>;
const hexes = (t: Named): Record<string, string> => Object.fromEntries(Object.entries(t).map(([id, [hex]]) => [id, hex]));
const names = (t: Named) => Object.fromEntries(Object.entries(t).map(([id, [, en, tr]]) => [id, nm(en, tr)]));

/** Skins, light to deep, with the rosy, golden, olive and cool undertones beside the warm ramp. Never locked. */
const SKIN_T: Named = {
  skin_13: ["#F7E4DD", "porcelain, rosy", "porselen, pembemsi"],
  skin_01: ["#F7DCC9", "very light, warm", "çok açık, sıcak"],
  skin_17: ["#F5D1AC", "light, golden", "açık, altın"],
  skin_02: ["#F0C7A9", "light, warm", "açık, sıcak"],
  skin_03: ["#E7B48F", "light-medium, warm", "açık-orta, sıcak"],
  skin_20: ["#D5BA97", "light-medium, olive", "açık-orta, zeytin"],
  skin_04: ["#DCA27A", "medium, warm", "orta, sıcak"],
  skin_15: ["#CD9686", "medium-tan, rosy", "orta bronz, pembemsi"],
  skin_05: ["#CC8F65", "medium-tan, warm", "orta bronz, sıcak"],
  skin_21: ["#B4936A", "medium-tan, olive", "orta bronz, zeytin"],
  skin_06: ["#BB7C53", "tan, warm", "bronz, sıcak"],
  skin_07: ["#A86A43", "deep tan, warm", "koyu bronz, sıcak"],
  skin_08: ["#925937", "medium-deep, warm", "orta koyu, sıcak"],
  skin_09: ["#7B492C", "deep, warm", "koyu, sıcak"],
  skin_23: ["#5D3F3D", "rich deep, cool", "daha koyu, soğuk"],
  skin_10: ["#663B24", "rich deep, warm", "daha koyu, sıcak"],
  skin_11: ["#52301D", "very deep, warm", "çok koyu, sıcak"],
  skin_24: ["#452F2D", "very deep, cool", "çok koyu, soğuk"],
  skin_12: ["#402517", "deepest, warm", "en koyu, sıcak"],
};

/** Hair: the natural colours, then the dyed ones (locked until their bundle: `curation.ts`). */
const HAIR_T: Named = {
  hair_01: ["#1C1614", "black", "siyah"], hair_02: ["#2E2019", "very dark brown", "çok koyu kahverengi"], hair_03: ["#4A2F22", "dark brown", "koyu kahverengi"],
  hair_04: ["#6B4128", "brown", "kahverengi"], hair_05: ["#8C3F1E", "auburn", "kızıl kahverengi"], hair_06: ["#B07A44", "light brown", "kumral"],
  hair_07: ["#D8AE68", "blonde", "sarı"], hair_08: ["#8F8A84", "grey", "gri"], hair_09: ["#D8D4CC", "white", "beyaz"], hair_10: ["#2A2E3B", "blue-black", "mavimsi siyah"],
  hair_11: ["#B85A2B", "ginger", "kızıl"], hair_12: ["#D69A62", "strawberry blonde", "çilek sarısı"], hair_14: ["#CDB98A", "ash blonde", "küllü sarı"],
  hair_15: ["#5A4A3F", "ash brown", "küllü kahverengi"], hair_18: ["#BFC6D2", "silver", "gümüş"],
  hair_19: ["#EDE5CB", "platinum", "platin sarısı"], hair_20: ["#6C1F36", "burgundy", "bordo"], hair_21: ["#F0A9C4", "pastel pink", "pastel pembe"], hair_29: ["#7A52B0", "purple", "mor"],
};

/** Dyed hair colours: brows and a default beard stay a natural dark brown, so a pink bob does not give pink brows. */
export const HAIR_BROW: Record<string, string> = { hair_19: "hair_02", hair_20: "hair_02", hair_21: "hair_02", hair_29: "hair_02" };

const FABRIC_T: Named = {
  fab_01: ["#F7F3EA", "warm white", "beyaz"], fab_02: ["#F0E2C8", "cream", "krem"], fab_03: ["#4F6E9E", "denim blue", "kot mavisi"], fab_04: ["#2E3A59", "navy", "lacivert"],
  fab_05: ["#8DB8DA", "sky blue", "mavi"], fab_06: ["#2F8C88", "teal", "petrol yeşili"], fab_07: ["#9CD3C0", "mint", "nane yeşili"], fab_08: ["#6F7A45", "olive", "zeytin yeşili"],
  fab_09: ["#4E7A68", "pine green", "çam yeşili"], fab_10: ["#E0A83A", "mustard", "hardal"], fab_11: ["#F2B705", "sunflower yellow", "sarı"], fab_12: ["#C4553A", "terracotta", "kiremit"],
  fab_13: ["#A23F28", "brick red", "tuğla kırmızısı"], fab_14: ["#D9534A", "tomato red", "domates kırmızısı"], fab_15: ["#E58FA0", "rose pink", "pembe"], fab_16: ["#7A3E6E", "plum", "erik"],
  fab_17: ["#B9A6DC", "lavender", "lavanta"], fab_18: ["#D8C3A0", "sand", "kum rengi"], fab_19: ["#B98A57", "camel", "deve tüyü"], fab_20: ["#6B4A35", "brown", "kahverengi"],
  fab_21: ["#9AA0A6", "grey", "gri"], fab_22: ["#26272C", "black", "siyah"], fab_23: ["#B3261E", "red", "kırmızı"], fab_24: ["#3A3D45", "charcoal", "antrasit"],
  fab_27: ["#8A7A6C", "taupe", "vizon"], fab_28: ["#4B3428", "cocoa", "kakao"], fab_29: ["#A39A6B", "khaki", "haki"],
  fab_31: ["#9C5A34", "cinnamon", "tarçın"], fab_32: ["#7A3F2A", "chestnut", "kestane"], fab_55: ["#F3CBD3", "powder pink", "pudra pembesi"],
  fab_33: ["#1F5FC0", "cobalt blue", "çini mavisi"], fab_35: ["#6F8FAF", "steel blue", "çelik mavisi"], fab_38: ["#2BB4B0", "turquoise", "turkuaz"],
  fab_39: ["#1F8F5E", "emerald", "yeşil"], fab_40: ["#2E5237", "forest green", "orman yeşili"], fab_42: ["#A9CC3A", "lime", "limon yeşili"], fab_43: ["#9DA98C", "sage", "adaçayı yeşili"],
  fab_46: ["#D18A1C", "amber", "kehribar"], fab_49: ["#F0745F", "coral", "mercan"], fab_50: ["#6A1E32", "burgundy", "bordo"], fab_51: ["#E4528C", "bright pink", "canlı pembe"],
  fab_53: ["#9A2D62", "berry", "frambuaz"], fab_56: ["#A78BA8", "mauve", "eflatun"], fab_58: ["#7B4FB3", "violet", "mor"],
};

const EYES_T: Named = {
  eye_brown: ["#4A2E1E", "brown", "kahverengi"], eye_dark: ["#2A1A12", "dark brown", "koyu kahverengi"], eye_hazel: ["#6E4E2A", "hazel", "ela"],
  eye_green: ["#4E6B3A", "green", "yeşil"], eye_blue: ["#4D6F9A", "blue", "mavi"], eye_grey: ["#6C7680", "grey", "gri"],
  eye_amber: ["#A8741F", "amber", "kehribar"], eye_light_blue: ["#7FAAD3", "light blue", "açık mavi"],
};

/** Metal for earrings, pendants, a watch, frames and clasps (through the `fabmetal` union). */
const METAL_T: Named = {
  met_silver: ["#C3C8CE", "silver", "gümüş"], met_gold: ["#E0B03C", "gold", "altın"], met_rose_gold: ["#D99B80", "rose gold", "pembe altın"],
  met_gunmetal: ["#4B5058", "gunmetal", "füme"], met_black: ["#2A2B30", "black enamel", "siyah emaye"],
};

/** Lens tints: plain colours, drawn at `LENS_ALPHA`; a dark tint makes any frame sunglasses. */
const LENS_T: Named = {
  len_01: ["#DCEFF5", "clear", "şeffaf"], len_02: ["#3B3F46", "grey", "gri"], len_03: ["#5A4030", "brown", "kahverengi"], len_05: ["#3F5F85", "blue", "mavi"],
};
export const LENS_ALPHA: Record<string, number> = { len_01: 0.18, len_02: 0.82, len_03: 0.8, len_05: 0.75 };

export const SKIN = hexes(SKIN_T);
export const HAIR = hexes(HAIR_T);
export const FABRIC = hexes(FABRIC_T);
export const EYES = hexes(EYES_T);
export const METAL = hexes(METAL_T);
export const LENS = hexes(LENS_T);

/** Colours for sets and props (not offered to learners). */
export const SET: Record<string, string> = {
  wall_cream: "#EFE2C6", wall_ochre: "#E3C38E", wall_mint: "#CFE3D3", tile_white: "#F4F1EA", tile_grout: "#D4CCBD",
  wood: "#A8754A", wood_dark: "#7A5034", wood_light: "#C99A68", steel: "#B8BEC4", glass: "#BFDDE6",
  floor_a: "#D9CBB0", floor_b: "#B9A486", ink: "#2B2420", paper: "#FBF7EE",
};

/**
 * Every palette a part's colour may name (`PartDef.palettes`). The unions hold whole palettes, so a
 * stored id stays valid: `fabmetal` is cloth or metal (frames, clasps, hardware), `skinfab` a skin
 * tone or cloth (the shell of a hearing device).
 */
export const PALETTES = {
  skin: SKIN, hair: HAIR, fabric: FABRIC, eyes: EYES, metal: METAL, lens: LENS, set: SET,
  fabmetal: { ...FABRIC, ...METAL }, skinfab: { ...SKIN, ...FABRIC },
};

/** The fabrics seeded crowd art picks its clothes from: a fixed list, so a colour added to the kit doesn't reshuffle the crowds of approved places. */
export const CROWD_FABRIC = ["fab_01", "fab_02", "fab_03", "fab_04", "fab_05", "fab_06", "fab_07", "fab_08", "fab_09", "fab_10", "fab_11", "fab_12", "fab_13", "fab_14", "fab_15", "fab_16", "fab_17", "fab_18", "fab_19", "fab_20", "fab_21", "fab_22", "fab_23", "fab_24", "fab_33", "fab_35", "fab_38", "fab_39", "fab_40", "fab_42", "fab_43", "fab_46", "fab_49", "fab_50", "fab_51", "fab_53", "fab_56", "fab_58"];

/** The colour family of each fabric colour, so a character's top, bottom and coat can be told apart at 48 px (STYLE.md). */
export const FAMILIES: Record<string, string> = {
  fab_01: "white", fab_02: "white", fab_03: "blue", fab_04: "blue", fab_05: "blue", fab_06: "teal", fab_07: "teal", fab_08: "green",
  fab_09: "green", fab_10: "yellow", fab_11: "yellow", fab_12: "orange", fab_13: "orange", fab_14: "red", fab_15: "pink", fab_16: "purple",
  fab_17: "purple", fab_18: "tan", fab_19: "tan", fab_20: "brown", fab_21: "grey", fab_22: "dark", fab_23: "red", fab_24: "dark", fab_27: "brown", fab_28: "brown", fab_29: "tan", fab_31: "brown", fab_32: "brown", fab_55: "pink",
  fab_33: "blue", fab_35: "blue", fab_38: "teal", fab_39: "green", fab_40: "green", fab_42: "green", fab_43: "green", fab_46: "yellow",
  fab_49: "orange", fab_50: "red", fab_51: "pink", fab_53: "pink", fab_56: "purple", fab_58: "purple",
};

/** The builder's names of every learner colour (`kit.colorNames`). */
export const COLOR_NAMES = { ...names(SKIN_T), ...names(HAIR_T), ...names(FABRIC_T), ...names(EYES_T), ...names(METAL_T), ...names(LENS_T) };

/** Colours that wait for an unlock (`kit.paletteUnlocks`, from curation.ts): the dyed hair and the İznik inks the palettes have. */
export const PALETTE_UNLOCKS: Record<string, string> = Object.fromEntries(Object.entries(unlocksOf("color"))
  .filter(([id]) => [SKIN, HAIR, FABRIC, EYES, METAL, LENS].some(p => Object.hasOwn(p, id))));

const ALL: Record<string, string> = { ...SKIN, ...HAIR, ...FABRIC, ...EYES, ...METAL, ...LENS, ...SET };

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** A palette id or a `#RRGGBB` colour, as hex; anything else (a bad hex, `constructor`, a number) is the fallback. */
export function color(id: string | undefined, fallback = "#888888"): string {
  if (typeof id !== "string") return fallback;
  if (id.startsWith("#")) return HEX.test(id) ? id : fallback;
  return Object.hasOwn(ALL, id) ? ALL[id] : fallback;
}

/**
 * How opaque a lens is drawn, from its colour as a part gets it (`ctx.colors[i]`, hex) or its id:
 * a `lens` colour's `LENS_ALPHA`, and any other colour (a cast member's hex) by its lightness, a pale
 * tint clear glass and a dark one sunglasses.
 */
export function lensAlpha(c: string | undefined): number {
  if (typeof c !== "string") return LENS_ALPHA.len_01;
  if (Object.hasOwn(LENS_ALPHA, c)) return LENS_ALPHA[c];
  const id = Object.keys(LENS).find(k => LENS[k].toLowerCase() === c.toLowerCase());
  if (id && Object.hasOwn(LENS_ALPHA, id)) return LENS_ALPHA[id];
  return HEX.test(c) && luma(c) < 0.6 ? 0.8 : LENS_ALPHA.len_01;
}
