// The pure decisions of the builder screen (ui/builder.ts): its own words in English and Turkish,
// how each field and section frames the character, which emotions and gestures the preview
// offers, the tag filters of a long list, the colour slots of a part and where an arrow key moves
// the focus. No DOM, so the tests run in Node.

import type { Framing } from "../render/paper/camera.ts";
import type { FieldInfo, Option } from "../avatar/builder.ts";

/** The screen's own words; the sections, fields and options come from the kit's labels. `{n}` is a number. */
export interface UiWords {
  builder: string; preview: string; wave: string;
  undo: string; redo: string; randomize: string; reset: string; done: string; cancel: string;
  turn: string; front: string; moods: string; changed: string; random: string; undone: string; redone: string; resetDone: string;
  locked: string; lockedHow: string; hiddenBy: string; max: string; more: string; all: string;
  colour: string; colourN: string; ink: string; pattern: string; side: string;
  sides: Record<string, string>; shorter: string; taller: string; cast: string; hidden: string;
  emotions: Record<string, string>;
}

export const WORDS: Record<"en" | "tr", UiWords> = {
  en: {
    builder: "Character builder", preview: "Your character", wave: "Your character: tap to wave",
    undo: "Undo", redo: "Redo", randomize: "Surprise me", reset: "Start over", done: "Done", cancel: "Cancel",
    turn: "Turn around", front: "Turn to the front", moods: "Expressions", changed: "Changed", random: "A new character", undone: "Undone", redone: "Redone", resetDone: "Back to the start",
    locked: "Locked", lockedHow: "Not unlocked yet", hiddenBy: "Covered by another item", max: "At most {n}", more: "More", all: "All",
    colour: "Colour", colourN: "Colour {n}", ink: "Pattern colour {n}", pattern: "Pattern", side: "Side",
    sides: { l: "Left", r: "Right", b: "Both" }, shorter: "Shorter", taller: "Taller", cast: "cast", hidden: "hidden",
    emotions: { neutral: "Calm", happy: "Happy", laugh: "Laughing", surprised: "Surprised", curious: "Curious", shy: "Shy", sad: "Sad", proud: "Proud", tired: "Tired", confused: "Confused" },
  },
  tr: {
    builder: "Karakter oluşturucu", preview: "Karakterin", wave: "Karakterin: dokun, el sallasın",
    undo: "Geri al", redo: "Yinele", randomize: "Şaşırt beni", reset: "Baştan başla", done: "Tamam", cancel: "Vazgeç",
    turn: "Arkasını dön", front: "Önünü dön", moods: "İfadeler", changed: "Değişti", random: "Yeni bir karakter", undone: "Geri alındı", redone: "Yinelendi", resetDone: "Başa dönüldü",
    locked: "Kilitli", lockedHow: "Henüz açılmadı", hiddenBy: "Başka bir parça örtüyor", max: "En çok {n}", more: "Daha fazla", all: "Tümü",
    colour: "Renk", colourN: "Renk {n}", ink: "Desen rengi {n}", pattern: "Desen", side: "Taraf",
    sides: { l: "Sol", r: "Sağ", b: "İki yanda" }, shorter: "Kısa", taller: "Uzun", cast: "kadro", hidden: "gizli",
    emotions: { neutral: "Sakin", happy: "Mutlu", laugh: "Gülüyor", surprised: "Şaşkın", curious: "Meraklı", shy: "Utangaç", sad: "Üzgün", proud: "Gururlu", tired: "Yorgun", confused: "Kafası karışık" },
  },
};

/** The words for a language (English for any other), with the host's own on top. */
export function uiWords(lang: string, over: Partial<UiWords> = {}): UiWords {
  const base = WORDS[lang === "tr" ? "tr" : "en"];
  return { ...base, ...over, sides: { ...base.sides, ...over.sides }, emotions: { ...base.emotions, ...over.emotions } };
}

/** `{n}` filled in. */
export const fill = (s: string, n: number | string) => s.replace("{n}", String(n));

/** The framing that shows a field best: the face and what is worn on the head as a head, the upper body as a bust, the rest whole. */
export function fieldFraming(field: string): Framing {
  if (field.startsWith("face.") || field === "facialHair" || field === "hair.style" || ["wear.head", "wear.hat", "wear.hair", "wear.eyes", "wear.ears", "wear.aid"].includes(field)) return "head";
  if (["outfit.top", "outfit.outer", "wear.neck", "skin"].includes(field)) return "bust";
  return "full";
}

/** The preview's framing for a section: head for the face and hair, the whole figure for the body and clothes, a bust for extras. */
export function sectionFraming(section: string): Framing {
  return section === "face" || section === "hair" ? "head" : section === "extras" ? "bust" : "full";
}

/** The emotions of the strip, in this order, as far as the kit has them. */
export const STRIP = ["neutral", "happy", "laugh", "surprised", "shy", "sad", "proud"];
export const emotionStrip = (have: Iterable<string>, max = 7) => { const s = new Set(have); return STRIP.filter(e => s.has(e)).slice(0, max); };

/** What a tap on the character plays, in turn, as far as the kit has them. */
export const TAPS = ["wave", "nod", "cheer", "hand_heart", "shrug", "think", "welcome"];
export const tapGestures = (have: Iterable<string>) => { const s = new Set(have); return TAPS.filter(g => s.has(g)); };

/** Whether a field's list is long enough to need the tag filter. */
export const LONG = 16;

/**
 * The tags that split a long list usefully: each on at least two options and not on all of them,
 * the most common first (at most `max`). A short list gets none.
 */
export function tagFilters(options: Option[], max = 8): string[] {
  const parts = options.filter(o => o.value !== null);
  if (parts.length < LONG) return [];
  const n = new Map<string, number>();
  for (const o of parts) for (const t of new Set(o.tags ?? [])) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n].filter(([, c]) => c >= 2 && c < parts.length).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, max).map(([t]) => t);
}

/** Whether an option shows under a tag filter (`null`: all). "None" always shows. */
export const passes = (o: Option, tag: string | null) => tag === null || o.value === null || !!o.tags?.includes(tag) || (tag === "cast" && !!o.reserved);

/** The colour slots of a part field: its own colours, then the inks of its pattern. A single colour needs no label. */
export function colourSlots(f: Pick<FieldInfo, "colors" | "inks">, w: Pick<UiWords, "colour" | "colourN" | "ink">): { index: number; label: string }[] {
  const out: { index: number; label: string }[] = [];
  for (let i = 0; i < f.colors; i++) out.push({ index: i, label: f.colors === 1 ? w.colour : fill(w.colourN, i + 1) });
  for (let k = 0; k < (f.inks ?? 0); k++) out.push({ index: f.colors + k, label: fill(w.ink, k + 1) });
  return out;
}

/** The list of marks a thumbnail of `v` shows: the current ones with `v` among them (when it fits under the cap), else `v` alone. */
export function withMark(have: string[], v: string, max: number): string[] {
  if (have.includes(v)) return have;
  return have.length < max ? [...have, v] : [v];
}

/** Where an arrow key moves the focus in a list of `n` (wrapping), or -1 for a key that does not move it. */
export function roving(key: string, i: number, n: number): number {
  if (n <= 0) return -1;
  switch (key) {
    case "ArrowRight": case "ArrowDown": return (i + 1) % n;
    case "ArrowLeft": case "ArrowUp": return (i - 1 + n) % n;
    case "Home": return 0;
    case "End": return n - 1;
    default: return -1;
  }
}
