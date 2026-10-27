// The generic extras: the silent people of the places (a clerk, two çaycıs, the
// baker, the usta, librarians, a kindergarten teacher and her children, stallholders, passengers and a
// passer-by) as character documents with `kind: "extra"`, one per file among the characters
// ($SAHNE_CONTENT/characters/<id>.json, EXTRAS in paths.ts), so a story's `extras` find them like any
// character. Generated here, never edited by hand. The folder is shared with the cast roster: this script
// only ever creates, rewrites or deletes a file whose document is `kind: "extra"`, and refuses to write an
// extra over a character of another kind.
//
//   node packages/sahne-story/cast/extras.ts           writes the extras (and removes any other extra there)
//   node packages/sahne-story/cast/extras.ts --check   exits 1 when an extra is missing, stale or not one of these,
//                                                      or another character holds an extra's file name
//
// Each extra is the builder's `randomize(seed)` with a frozen `offer`: every value the randomiser may
// draw (build, skin, every face value, hair styles and colours, garments and their colours) is listed
// below, so a part or colour the kit gains later is never drawn and the files stay as they are. Patterns
// are never offered. Then the role's fixed fields (an apron, a lanyard, a headscarf, glasses…) are set
// on top, through a second builder that applies the slot rules. The freeze holds against new parts, not
// against a change to a listed part, the kit's odds or the randomiser itself: then --check fails, and
// the extras are regenerated and looked at again (the gallery's #/cast/extras).

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createBuilder, normalize, type AvatarDoc, type OfferKind } from "sahne";
import kit from "../../sahne-kit/src/full.ts";
import { EXTRAS as DIR, repoPath } from "../paths.ts";

/** The bubble colour of every extra: a neutral grey (they are silent; it never meets a speaker's). */
const COLOR = "#8A8580";
/** Extras sort after the cast: `order` starts here. */
export const ORDER_FROM = 101;

type Profile = "man" | "woman" | "elder_man" | "elder_woman" | "boy" | "girl";
/** A fixed field: a value (`null` takes it off), or a part with its colours. */
type Fix = string | null | [string, ...string[]];
interface Spec {
  id: string; profile: Profile; seed: number; skin: string;
  name: string; nameFa: string; role: string; roleFa: string; bio: string; bioFa: string;
  places: string[];
  fix?: Record<string, Fix>;
}

// ---- what the randomiser may draw (the freeze) ----
const FACE: Record<string, string[]> = {
  "body.shape": ["slim", "average", "broad", "round"],
  "face.shape": ["oval", "round", "square", "long", "heart", "diamond", "full"],
  "face.eyes": ["round", "almond", "sleepy", "small", "monolid", "hooded", "upturned"],
  "face.eyeColor": ["eye_brown", "eye_dark", "eye_hazel", "eye_green", "eye_blue", "eye_grey", "eye_amber"],
  "face.brows": ["soft", "thick", "thin", "arched", "straight", "bushy"],
  "face.nose": ["button", "small", "round", "long", "aquiline", "broad", "upturned"],
  "face.mouth": ["wide", "small", "full", "thin", "bowed"],
  "face.ears": ["round", "small", "large"],
};
/** Grown-ups' clothes: quiet colours. */
const MUTED = ["fab_01", "fab_02", "fab_03", "fab_04", "fab_06", "fab_08", "fab_09", "fab_12", "fab_13", "fab_16", "fab_18", "fab_19", "fab_20", "fab_21", "fab_22", "fab_24", "fab_27", "fab_28", "fab_29", "fab_32", "fab_35", "fab_40", "fab_43", "fab_50", "fab_56"];
/** Kindergarten colours. */
const BRIGHT = ["fab_05", "fab_07", "fab_10", "fab_11", "fab_14", "fab_15", "fab_17", "fab_33", "fab_39", "fab_42", "fab_46", "fab_51", "fab_55", "fab_58"];
const HAIR_DARK = ["hair_01", "hair_02", "hair_03", "hair_04", "hair_06", "hair_10", "hair_15"];
const HAIR_GREY = ["hair_08", "hair_09", "hair_18"];
const HAIR_KID = ["hair_01", "hair_02", "hair_03", "hair_04", "hair_06", "hair_07", "hair_11"];
const BEARDS = ["stubble", "moustache", "moustache_thick", "beard_trimmed", "beard_short", "goatee", "beard_full"];

interface Pool { build: string; marks: string[]; hair: string[]; hairColor: string[]; facialHair: string[]; fabric: string[]; garments: Record<string, string[]> }
const ADULT_SHOES = ["shoes_sneakers", "shoes_leather", "shoes_derby", "shoes_loafer", "shoes_boots_chelsea", "shoes_canvas"];
const POOLS: Record<Profile, Pool> = {
  man: {
    build: "adult", marks: ["mole", "laugh_lines", "freckles"], hairColor: HAIR_DARK, facialHair: BEARDS, fabric: MUTED,
    hair: ["hair_short", "hair_classic", "hair_buzz", "hair_receding", "hair_slick_back", "hair_fade_mid", "hair_curly_short", "hair_messy_short"],
    garments: { "outfit.top": ["top_tee", "top_shirt", "top_shirt_rolled", "top_sweater", "top_tee_long"], "outfit.bottom": ["bottom_trousers", "bottom_jeans", "bottom_chinos", "bottom_cargo"], "outfit.dress": [], "outfit.outer": ["outer_jacket_bomber", "outer_coat_parka", "outer_blazer"], "outfit.shoes": ADULT_SHOES },
  },
  woman: {
    build: "adult", marks: ["mole", "freckles", "dimples", "laugh_lines"], hairColor: HAIR_DARK, facialHair: ["stubble"], fabric: MUTED,
    hair: ["hair_bob", "hair_long", "hair_bun", "hair_ponytail_low", "hair_shoulder", "hair_wavy_long", "hair_curly", "hair_bun_low"],
    garments: { "outfit.top": ["top_blouse", "top_sweater", "top_tee_long", "top_tunic", "top_blouse_collar"], "outfit.bottom": ["bottom_trousers", "bottom_jeans", "bottom_skirt_midi", "bottom_skirt_long", "bottom_trousers_wide"], "outfit.dress": ["dress_midi", "dress_modest_long"], "outfit.outer": ["outer_cardigan_short", "outer_coat_long", "outer_blazer"], "outfit.shoes": ["shoes_flats", "shoes_sneakers", "shoes_boots_ankle", "shoes_loafer"] },
  },
  elder_man: {
    build: "elder", marks: ["crows_feet", "forehead_lines", "laugh_lines", "wrinkles_deep"], hairColor: HAIR_GREY, facialHair: ["moustache", "moustache_thick", "beard_trimmed", "beard_short"], fabric: MUTED,
    hair: ["hair_classic", "hair_receding", "hair_bald", "hair_set_short"],
    garments: { "outfit.top": ["top_shirt", "top_sweater", "top_sweater_collar"], "outfit.bottom": ["bottom_trousers", "bottom_chinos"], "outfit.dress": [], "outfit.outer": ["outer_cardigan_short", "outer_coat_long", "outer_jacket_suit"], "outfit.shoes": ["shoes_leather", "shoes_derby", "shoes_loafer"] },
  },
  elder_woman: {
    build: "elder", marks: ["crows_feet", "forehead_lines", "laugh_lines", "wrinkles_deep"], hairColor: HAIR_GREY, facialHair: ["stubble"], fabric: MUTED,
    hair: ["hair_set_short", "hair_bun_low", "hair_bun_pinned", "hair_bob"],
    garments: { "outfit.top": ["top_blouse", "top_sweater", "top_blouse_collar", "top_tunic"], "outfit.bottom": ["bottom_skirt_long", "bottom_skirt_midi", "bottom_trousers_wide"], "outfit.dress": ["dress_modest_long"], "outfit.outer": ["outer_cardigan_short", "outer_coat_long"], "outfit.shoes": ["shoes_flats", "shoes_loafer", "shoes_boots_ankle"] },
  },
  boy: {
    build: "child", marks: ["freckles", "dimples"], hairColor: HAIR_KID, facialHair: ["stubble"], fabric: BRIGHT,
    hair: ["hair_short", "hair_messy_short", "hair_buzz", "hair_curly_short", "hair_fade_mid", "hair_twa"],
    garments: { "outfit.top": ["top_tee", "top_hoodie", "top_tee_long", "top_sweater"], "outfit.bottom": ["bottom_joggers", "bottom_jeans", "bottom_trousers"], "outfit.dress": [], "outfit.outer": [], "outfit.shoes": ["shoes_velcro", "shoes_sneakers", "shoes_canvas"] },
  },
  girl: {
    build: "child", marks: ["freckles", "dimples"], hairColor: HAIR_KID, facialHair: ["stubble"], fabric: BRIGHT,
    hair: ["hair_pigtails", "hair_ponytail_high", "hair_bob", "hair_afro_puffs", "hair_braids_double", "hair_long"],
    garments: { "outfit.top": ["top_tee", "top_hoodie", "top_tee_long", "top_sweater"], "outfit.bottom": ["bottom_joggers", "bottom_jeans", "bottom_skirt_a_line"], "outfit.dress": ["dress_kids_play"], "outfit.outer": [], "outfit.shoes": ["shoes_velcro", "shoes_sneakers", "shoes_canvas"] },
  },
};
const WOMEN = new Set<Profile>(["woman", "elder_woman", "girl"]);
const KIDS = new Set<Profile>(["boy", "girl"]);

/** The builder's `offer` for one extra: only what is listed above (every other part field offers nothing, so it stays off). */
function offerOf(pool: Pool, skin: string) {
  const fields: Record<string, string[]> = { ...FACE, "body.build": [pool.build], skin: [skin], "face.marks": pool.marks, facialHair: pool.facialHair, "hair.style": pool.hair, ...pool.garments };
  return (field: string, value: string, kind: OfferKind): boolean => {
    if (kind === "pattern") return false;
    if (kind === "color") {
      if (field === "skin") return value === skin;
      if (field === "face.eyeColor") return FACE["face.eyeColor"].includes(value);
      if (field === "hair.style" || field === "facialHair") return pool.hairColor.includes(value);
      return pool.fabric.includes(value);
    }
    return fields[field]?.includes(value) ?? false;
  };
}

const KG = "park_ferikoy";
const child = (n: number, profile: "boy" | "girl", seed: number, skin: string, fix?: Record<string, Fix>): Spec => ({
  id: `child_${n}`, profile, seed, skin, name: "Çocuk", nameFa: "بچه", role: "A kindergarten child at the park show", roleFa: "بچه‌ی مهدکودک در جشنِ پارک",
  bio: "One of the row of kindergarten children who sing on the park stage.", bioFa: "یکی از بچه‌های مهدکودک که در ردیفِ روی صحنه‌ی پارک آواز می‌خوانند.", places: [KG], ...(fix ? { fix } : {}),
});
const passenger = (n: number, profile: Profile, seed: number, skin: string, fix: Record<string, Fix>): Spec => ({
  id: `passenger_${n}`, profile, seed, skin, name: "Yolcu", nameFa: "مسافر", role: "A passenger on the metro, the bus or the ferry", roleFa: "مسافرِ مترو، اتوبوس یا کشتی",
  bio: "Rides across the city with everyone else; also one of the crowd on the street.", bioFa: "مثلِ بقیه در شهر رفت‌وآمد می‌کند؛ گاهی هم یکی از جمعیتِ خیابان است.",
  places: ["metro_m2", "metro_m11", "bus", "vapur_deck", "vapur_pier", "kadikoy", "istiklal_street"], fix,
});

/** Every extra, in order. Seeds are fixed: a new seed is a new person. */
export const SPECS: Spec[] = [
  {
    id: "clerk_goc", profile: "man", seed: 4101, skin: "skin_20", name: "Memur", nameFa: "مأمور", role: "The clerk behind the glass at Göç İdaresi", roleFa: "کارمندِ پشتِ شیشه در اداره‌ی مهاجرت",
    bio: "Checks the papers, taps the contract and shakes his head; tired, never a villain.", bioFa: "مدارک را بررسی می‌کند، روی قرارداد می‌زند و سر تکان می‌دهد؛ خسته است، اما آدمِ بدی نیست.", places: ["goc_inside"],
    fix: { "outfit.top": ["top_shirt", "fab_05"], "outfit.outer": null, "wear.neck": ["lanyard_badge", "fab_04", "fab_01"], "wear.eyes": ["glasses_rectangle", "met_black"], "outfit.bottom": ["bottom_trousers_suit", "fab_24"], "outfit.shoes": ["shoes_leather", "fab_22"] },
  },
  {
    id: "cayci_ortakoy", profile: "elder_man", seed: 4102, skin: "skin_05", name: "Çaycı", nameFa: "چای‌فروش", role: "The çaycı on the Ortaköy shore", roleFa: "چای‌فروشِ ساحلِ اورتاکوی",
    bio: "Carries tea on a tray along the shore and calls 'Çay, çay!'", bioFa: "چای را در سینی کنارِ ساحل می‌چرخاند و صدا می‌زند «چای، چای!»", places: ["ortakoy"],
    fix: { "outfit.top": ["top_shirt_rolled", "fab_01"], "outfit.outer": null, "wear.waist": ["apron_cafe", "fab_22"], "wear.hat": ["cap_flat", "fab_24"], facialHair: "moustache_thick", "outfit.bottom": ["bottom_trousers", "fab_24"] },
  },
  {
    id: "cayci_vapur", profile: "man", seed: 4103, skin: "skin_04", name: "Çaycı", nameFa: "چای‌فروش", role: "The çaycı on the ferry", roleFa: "چای‌فروشِ کشتی",
    bio: "Comes round the deck with a tray of tea glasses.", bioFa: "با سینیِ استکان‌های چای روی عرشه می‌چرخد.", places: ["vapur_deck"],
    fix: { "outfit.top": ["top_shirt", "fab_01"], "outfit.outer": null, "wear.waist": ["apron_cafe", "fab_04"], facialHair: "moustache", "outfit.bottom": ["bottom_trousers", "fab_22"] },
  },
  {
    id: "baker_firin", profile: "man", seed: 4104, skin: "skin_03", name: "Fırıncı", nameFa: "نانوا", role: "The baker at the corner bakery in Feriköy", roleFa: "نانوای نانواییِ سرِ کوچه در فری‌کؤی",
    bio: "Hands out the warm loaves when the bread comes out at four.", bioFa: "ساعتِ چهار که نان از تنور درمی‌آید، نان‌های گرم را می‌دهد.", places: ["firin", "ferikoy"],
    fix: { "outfit.top": ["top_tee", "fab_01"], "outfit.outer": null, "wear.waist": ["apron_shop", "fab_01"], "outfit.bottom": ["bottom_trousers", "fab_21"], "outfit.shoes": ["shoes_clogs_work"] },
  },
  {
    id: "usta", profile: "man", seed: 4105, skin: "skin_06", name: "Usta", nameFa: "اوستا", role: "The repairman", roleFa: "تعمیرکار",
    bio: "Fixes the heating and the leaks in the building, toolbox in hand.", bioFa: "با جعبه‌ابزارش شوفاژ و چکه‌های ساختمان را درست می‌کند.", places: ["flat_maria", "flat_nima_room"],
    fix: { "outfit.top": ["top_shirt_rolled", "fab_35"], "outfit.outer": null, "outfit.bottom": ["bottom_cargo", "fab_24"], "outfit.shoes": ["shoes_boots_work"], facialHair: "beard_short", "hair.style": "hair_short" },
  },
  {
    id: "librarian_ibb", profile: "woman", seed: 4106, skin: "skin_02", name: "Kütüphaneci", nameFa: "کتابدار", role: "The librarian at the İBB city library", roleFa: "کتابدارِ کتابخانه‌ی شهرداری",
    bio: "Sits at the desk and asks for quiet with one finger.", bioFa: "پشتِ میز می‌نشیند و با یک انگشت می‌گوید ساکت.", places: ["library_ibb"],
    fix: { "wear.head": ["headscarf_pinned", "fab_43"], "outfit.dress": null, "outfit.top": ["top_tee_long", "fab_02"], "outfit.outer": ["outer_cardigan_short", "fab_50"], "outfit.bottom": ["bottom_skirt_long", "fab_24"], "wear.eyes": ["glasses_round", "met_gold"], "wear.neck": ["lanyard_badge", "fab_33", "fab_01"] },
  },
  {
    id: "librarian_bu", profile: "elder_woman", seed: 4107, skin: "skin_17", name: "Kütüphaneci", nameFa: "کتابدار", role: "The librarian at the Beykent University library", roleFa: "کتابدارِ کتابخانه‌ی دانشگاهِ بیکنت",
    bio: "Knows every shelf, and whispers.", bioFa: "همه‌ی قفسه‌ها را می‌شناسد و آهسته حرف می‌زند.", places: ["library_bu"],
    fix: { "hair.style": ["hair_bun_low", "hair_08"], "wear.eyes": ["glasses_reading", "fab_50"], "wear.neck": ["neck_glasses_chain", "met_gold"], "outfit.dress": null, "outfit.top": ["top_blouse_collar", "fab_02"], "outfit.outer": ["outer_cardigan_short", "fab_09"], "outfit.bottom": ["bottom_skirt_midi", "fab_27"] },
  },
  {
    id: "teacher_kindergarten", profile: "woman", seed: 4108, skin: "skin_07", name: "Öğretmen", nameFa: "معلم", role: "The kindergarten teacher at the park show", roleFa: "معلمِ مهدکودک در جشنِ پارک",
    bio: "Stands at the side of the stage and keeps the row of children together.", bioFa: "کنارِ صحنه می‌ایستد و ردیفِ بچه‌ها را کنارِ هم نگه می‌دارد.", places: [KG],
    fix: { "hair.style": ["hair_shoulder", "hair_03"], "wear.ears": ["ear_stud", "met_gold"], "outfit.dress": null, "outfit.top": ["top_tee_long", "fab_10"], "outfit.outer": null, "outfit.bottom": ["bottom_trousers", "fab_04"], "outfit.shoes": ["shoes_sneakers", "fab_01"], "wear.neck": ["lanyard_badge", "fab_14", "fab_01"] },
  },
  child(1, "girl", 4111, "skin_02", { "wear.hair": ["hairbow_ribbon", "fab_51"] }),
  child(2, "boy", 4112, "skin_06"),
  child(3, "girl", 4113, "skin_10", { "hair.style": ["hair_afro_puffs", "hair_01"] }),
  child(4, "boy", 4114, "skin_17", { "wear.hat": null }),
  child(5, "girl", 4115, "skin_04"),
  child(6, "boy", 4116, "skin_08", { "hair.style": ["hair_curly_short", "hair_01"] }),
  child(7, "girl", 4117, "skin_21", { "wear.hair": ["headband_band", "fab_42"] }),
  child(8, "boy", 4118, "skin_13"),
  {
    id: "stallholder_1", profile: "elder_man", seed: 4121, skin: "skin_21", name: "Pazarcı", nameFa: "فروشنده‌ی بازار", role: "A stallholder at the Feriköy Saturday market", roleFa: "فروشنده‌ای در بازارِ شنبه‌های فری‌کؤی",
    bio: "Calls 'Gel abla gel!' over his tomatoes.", bioFa: "پشتِ گوجه‌هایش صدا می‌زند «بیا خواهر، بیا!»", places: ["pazar_ferikoy"],
    fix: { "wear.hat": ["cap_flat", "fab_20"], "wear.waist": ["apron_shop", "fab_09"], "outfit.top": ["top_sweater", "fab_29"], "outfit.outer": null, facialHair: "moustache" },
  },
  {
    id: "stallholder_2", profile: "woman", seed: 4122, skin: "skin_05", name: "Pazarcı", nameFa: "فروشنده‌ی بازار", role: "A stallholder at the Feriköy Saturday market", roleFa: "فروشنده‌ای در بازارِ شنبه‌های فری‌کؤی",
    bio: "Sells village eggs and greens, and weighs everything twice.", bioFa: "تخم‌مرغِ محلی و سبزی می‌فروشد و همه‌چیز را دو بار وزن می‌کند.", places: ["pazar_ferikoy"],
    fix: { "wear.head": ["headscarf_wrap", "fab_12"], "outfit.dress": null, "outfit.top": ["top_sweater", "fab_09"], "outfit.outer": null, "outfit.bottom": ["bottom_salvar", "fab_16"], "wear.waist": ["apron_shop", "fab_18"], "outfit.shoes": ["shoes_flats", "fab_22"] },
  },
  {
    id: "passerby_1", profile: "man", seed: 4131, skin: "skin_15", name: "Yoldan geçen", nameFa: "رهگذر", role: "A passer-by on İstiklal", roleFa: "رهگذری در استقلال",
    bio: "Walking somewhere; asked the way, he points.", bioFa: "دارد جایی می‌رود؛ وقتی راه را می‌پرسند، با دست نشان می‌دهد.", places: ["istiklal_street", "istiklal_taksim", "ferikoy"],
    fix: { "outfit.outer": ["outer_jacket_bomber", "fab_08"], carry: ["bag_shoulder", "fab_20"] },
  },
  passenger(1, "elder_woman", 4141, "skin_03", { "wear.head": ["headscarf_esarp", "fab_56"], "outfit.dress": null, "outfit.top": ["top_blouse", "fab_02"], "outfit.outer": ["outer_coat_long", "fab_27"], "outfit.bottom": ["bottom_skirt_long", "fab_24"], hold: ["bag_trolley", "fab_13"] }),
  passenger(2, "man", 4142, "skin_09", { "outfit.top": ["top_hoodie", "fab_06"], "outfit.outer": null, "outfit.bottom": ["bottom_jeans"], "outfit.shoes": ["shoes_sneakers"], carry: ["bag_backpack", "fab_24"], "wear.ears": ["ear_buds_wireless"] }),
  passenger(3, "woman", 4143, "skin_13", { "hair.style": ["hair_long", "hair_04"], "outfit.outer": ["outer_blazer", "fab_04"], carry: ["bag_shoulder", "fab_19"], hold: ["phone_held"] }),
  passenger(4, "elder_man", 4144, "skin_20", { "hair.style": ["hair_receding", "hair_18"], "wear.eyes": ["glasses_reading", "met_silver"], "outfit.outer": ["outer_coat_long", "fab_20"], "wear.wrist": ["tesbih_wrist", "fab_13"] }),
  passenger(5, "woman", 4145, "skin_11", { "hair.style": ["hair_afro", "hair_01"], "outfit.dress": ["dress_midi", "fab_12"], "outfit.outer": null, carry: ["bag_tote", "fab_18"], "wear.ears": ["ear_hoop_big", "met_gold"] }),
  passenger(6, "woman", 4146, "skin_08", { "wear.head": ["headscarf_sport", "fab_04"], "outfit.dress": null, "outfit.top": ["top_hoodie", "fab_43"], "outfit.outer": null, "outfit.bottom": ["bottom_trousers_wide", "fab_24"], "outfit.shoes": ["shoes_sneakers"], carry: ["bag_backpack", "fab_12"] }),
  passenger(7, "man", 4147, "skin_23", { "outfit.outer": ["outer_coat_parka", "fab_40"], "wear.hat": ["hat_beanie", "fab_24"] }),
];

/** One extra's avatar: the frozen randomiser, then the role's fixed fields. */
export function avatarOf(s: Spec): AvatarDoc {
  const pool = POOLS[s.profile], all = () => true;
  const b = createBuilder(kit, kit.defaultDoc, { trusted: true, cast: true, unlocked: all, builds: [pool.build as AvatarDoc["body"]["build"]], offer: offerOf(pool, s.skin) });
  b.randomize(s.seed);
  const f = createBuilder(kit, b.doc, { trusted: true, cast: true, unlocked: all });
  const must = (ok: boolean, what: string) => { if (!ok) throw new Error(`extra ${s.id}: the builder refused ${what}`); };
  // the randomiser has no gender: women and girls never get facial hair
  const fix: Record<string, Fix> = { ...(WOMEN.has(s.profile) && !KIDS.has(s.profile) ? { facialHair: null } : {}), ...s.fix };
  for (const [field, v] of Object.entries(fix)) {
    const [id, ...colors] = Array.isArray(v) ? v : [v];
    must(f.set(field, id), `${field} = ${id}`);
    colors.forEach((c, i) => must(f.setColor(field, i, c), `${field} colour ${i} = ${c}`));
  }
  const doc = normalize(f.doc, kit, { trusted: true });
  if (!doc) throw new Error(`extra ${s.id}: no valid document`);
  return doc;
}

/** The character document of one extra (Kumru's STORIES_SCHEMA.md §5, `kind: "extra"`). */
export function extraDoc(s: Spec, order: number): Record<string, unknown> {
  return {
    id: s.id, order, kind: "extra", level: "A1", color: COLOR,
    name: s.name, nameFa: s.nameFa, role: s.role, roleFa: s.roleFa, bio: s.bio, bioFa: s.bioFa, places: s.places, avatar: avatarOf(s),
  };
}

const sortKeys = (x: unknown): unknown =>
  Array.isArray(x) ? x.map(sortKeys) : x && typeof x === "object" ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sortKeys((x as Record<string, unknown>)[k])])) : x;

/** Every extra's file: name → text (sorted keys, two-space indent, a final newline). */
export function buildExtras(): Map<string, string> {
  const out = new Map<string, string>();
  SPECS.forEach((s, i) => {
    if (out.has(`${s.id}.json`)) throw new Error(`extra ${s.id} twice`);
    out.set(`${s.id}.json`, JSON.stringify(sortKeys(extraDoc(s, ORDER_FROM + i)), null, 2) + "\n");
  });
  return out;
}

/** The `kind` of the document in `dir/f`, or undefined when it is not a readable JSON object. */
const kindOf = (dir: URL, f: string): unknown => {
  try { const d = JSON.parse(readFileSync(new URL(f, dir), "utf8")); return d && typeof d === "object" ? d.kind : undefined; } catch { return undefined; }
};

/** The `.json` files of `dir` ([] when it does not exist yet). */
const jsonFiles = (dir: URL): string[] => { try { return readdirSync(dir).filter(f => f.endsWith(".json")); } catch { return []; } };

/**
 * What --check finds wrong among the extras: [] when every extra is there and current, no other file of
 * `kind: "extra"` is, and no character of another kind holds an extra's file name. The other characters in
 * the folder are not this script's.
 */
export function staleExtras(dir: URL = DIR, want: Map<string, string> = buildExtras()): string[] {
  const have = jsonFiles(dir), out: string[] = [], at = (f: string) => repoPath(new URL(f, dir));
  for (const [f, text] of want) {
    if (!have.includes(f)) out.push(`missing: ${at(f)}`);
    else if (kindOf(dir, f) !== "extra") out.push(`taken: ${at(f)} is a character of kind ${String(kindOf(dir, f))}, not an extra`);
    else if (readFileSync(new URL(f, dir), "utf8") !== text) out.push(`stale: ${at(f)}`);
  }
  for (const f of have) if (!want.has(f) && kindOf(dir, f) === "extra") out.push(`not one of the extras: ${at(f)}`);
  return out;
}

if (import.meta.main) {
  const want = buildExtras();
  if (process.argv.includes("--check")) {
    const bad = staleExtras(DIR, want);
    for (const b of bad) console.error(b);
    if (bad.length) { console.error("run: node packages/sahne-story/cast/extras.ts"); process.exit(1); }
    console.log(`${want.size} extras, up to date`);
  } else {
    mkdirSync(DIR, { recursive: true });
    const taken = [...want.keys()].filter(f => jsonFiles(DIR).includes(f) && kindOf(DIR, f) !== "extra");
    if (taken.length) {
      for (const f of taken) console.error(`not written: ${repoPath(new URL(f, DIR))} is a character of kind ${String(kindOf(DIR, f))}; rename the extra`);
      process.exit(1);
    }
    for (const f of jsonFiles(DIR)) if (!want.has(f) && kindOf(DIR, f) === "extra") rmSync(new URL(f, DIR));
    for (const [f, text] of want) writeFileSync(new URL(f, DIR), text);
    console.log(`wrote ${want.size} extras to ${repoPath(DIR)}/`);
  }
}
