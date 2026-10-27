// The stories' test scene: İsmail's bakkal, İsmail, Nima,
// and Kerim in the narrator inset.

import type { AvatarDoc, Cue, PlaceDoc } from "sahne";
// a bundled JSON import needs a literal path: the sample in sahne-story/samples/places/
import bakkalJson from "../../sahne-story/samples/places/bakkal.json" with { type: "json" };

/** İsmail's bakkal: the sample place document (sahne-story/samples/places/). */
export const BAKKAL = bakkalJson as unknown as PlaceDoc;

/** The characters' browser voices (the cast's `voice` field): İsmail lower and a little quick, Kerim slow and high. */
export const VOICES = { ismail: { rate: 1.05, pitch: 0.78 }, nima: { rate: 1, pitch: 1.05 }, kerim: { rate: 0.9, pitch: 1.3 } };

export const NIMA: AvatarDoc = {
  v: 1, kit: "sahne-kit@1",
  body: { build: "adult", height: 0.45, shape: "average" },
  skin: "skin_04",
  face: { shape: "oval", eyes: "round", brows: "soft", nose: "button", mouth: "wide" },
  hair: { style: "hair_short", color: "hair_02" },
  outfit: { top: { id: "top_shirt", colors: ["fab_05"] }, bottom: { id: "bottom_jeans", colors: ["fab_03"] }, shoes: { id: "shoes_sneakers", colors: ["fab_01", "fab_01"] } },
};

export const ISMAIL: AvatarDoc = {
  v: 1, kit: "sahne-kit@1",
  body: { build: "adult", height: 0.38, shape: "round" },
  skin: "skin_05",
  face: { shape: "round", eyes: "round", brows: "thick", nose: "round", mouth: "wide" },
  hair: { style: "hair_classic", color: "hair_08" },
  facialHair: { style: "moustache_thick", color: "#4A4440" },
  outfit: { top: { id: "top_shirt_rolled", colors: ["fab_02"] }, bottom: { id: "bottom_trousers", colors: ["fab_24"] }, shoes: { id: "shoes_leather", colors: ["fab_20"] } },
  wear: { waist: { id: "apron_shop", colors: ["fab_04"] } },
};

const give = { id: "ekmek", op: "give" as const, to: "nima", n: 2 };

/** Cues 0–4: the scene, the welcome, the question, *şu ekmek*, *süt yok*. */
export const OPENING: Cue[] = [
  { scene: { place: "bakkal", time: "day", at: { ismail: "counter" } } },
  { line: { who: "ismail", text: "Hoş geldiniz! Buyrun.", to: "nima", move: { who: "nima", to: "customer", how: "enter" }, do: "welcome", emo: "happy", sfx: { id: "doorbell", word: "çın çın" } } },
  { line: { who: "nima", text: "Ekmek var mı? Süt var mı?", emo: "curious", do: "look", at: "mark:shelf", link: { ekmek: "obj:ekmek", süt: "obj:sut" } } },
  { line: { who: "ismail", text: "Ekmek var. Şu ekmek çok taze.", do: "point", at: "obj:ekmek", react: { nima: { do: "look", at: "obj:ekmek" } }, link: { ekmek: "obj:ekmek" } } },
  { line: { who: "ismail", text: "Ama süt yok.", obj: [{ id: "sut", op: "hide" }], do: "shrug", on: "yok", emo: "sorry", link: { süt: "obj:sut" } } },
];

/** The choice (cue 5): polite or blunt; both end with two loaves in Nima's hands. */
export const POLITE: Cue[] = [
  { line: { who: "nima", text: "İki ekmek, lütfen.", do: "count", n: 2, react: { ismail: { emo: "happy", do: "nod" } } } },
  { line: { who: "ismail", text: "Buyrun!", obj: [give], emo: "happy" } },
];
export const BLUNT: Cue[] = [
  { line: { who: "nima", text: "İki ekmek ver.", do: "count", n: 2, react: { ismail: { emo: "confused" } } } },
  { beat: { wait: 900 } },
  { line: { who: "ismail", text: "…Buyrun.", obj: [give] } },
];

/** After the choice: İsmail, quickly; Nima freezes; the clock ticks; Kerim, kindly. */
export const ENDING: Cue[] = [
  { line: { who: "ismail", text: "Başka bir şey?", tempo: 1.4, do: "explain", emo: "curious" } },
  { line: { who: "nima", text: "…", voice: "silent", emo: "nervous", sfx: { id: "clock_tick", word: "tik tak", at: "mark:clock" } } },
  { line: { who: "kerim", text: "Yavaş yavaş…" } },
];

export const CHOICE_AT = OPENING.length;

/** The scene's own glosses (a story's `gl`): words no A1 card reaches, and fixed chunks. */
export const GL_WORDS: Record<string, { en: string; fa: string; head?: string; note?: string }> = {
  hoş: { en: "pleasant, nice", fa: "خوش" },
  geldiniz: { en: "you came", fa: "آمدید", head: "gelmek", note: "gel- + -di + -niz (you, polite)" },
  buyrun: { en: "here you are; please, go ahead", fa: "بفرمایید" },
  mı: { en: "(yes/no question)", fa: "آیا", note: "mı / mi / mu / mü follows the vowel before it" },
  ver: { en: "give!", fa: "بده", head: "vermek", note: "the plain command, to a friend: a little blunt in a shop" },
  başka: { en: "other; else", fa: "دیگر" },
};
export const GL_PHRASES: Record<string, { en: string; fa: string; note?: string }> = {
  "hoş geldiniz": { en: "welcome", fa: "خوش آمدید", note: "the answer is Hoş bulduk" },
  "başka bir şey": { en: "anything else", fa: "چیز دیگری" },
  "yavaş yavaş": { en: "slowly, little by little", fa: "آهسته آهسته" },
  // sound words are Turkish too (Kumru's STORIES_STAGE.md §2)
  "çın çın": { en: "ding-a-ling (a bell)", fa: "دینگ دینگ" },
  "tik tak": { en: "tick-tock (a clock)", fa: "تیک تاک" },
};
