// Turkish text helpers: lowercasing, reading a written word aloud, and splitting a line into
// words and pauses with their character indices in the original text.

import { sayNumeral } from "./numbers.ts";

export const VOWELS = "aeıioöuü";
export const isVowel = (c: string | undefined): boolean => c !== undefined && c.length === 1 && VOWELS.includes(c);

/** Lowercase the Turkish way: I → ı and İ → i (plain `toLowerCase` turns İ into i plus a combining dot). */
export function lowerTr(s: string): string {
  return s.normalize("NFC").replace(/I/g, "ı").replace(/İ/g, "i").toLowerCase();
}

/** Unit abbreviations read in full; other words with no vowel are spelled out ("TL" → "te le"). */
const UNITS: Record<string, string> = { km: "kilometre", kg: "kilogram", cm: "santimetre", gr: "gram", ml: "mililitre", dk: "dakika" };
const LETTER: Record<string, string> = { ğ: "yumuşak ge", q: "kü", w: "ve", x: "iks" };
/** Interjections said with the mouth closed (hmm) or the lips pushed out (şşt). */
export const HUM = /^h?m+h?$/, SHUSH = /^p?[şs]+t?$/;

/** A written word as it is said: lowercase, numerals in words, apostrophes dropped. "1990'da" → "bin dokuz yüz doksanda". */
export function sayWord(word: string, ord = false): string {
  const s = lowerTr(word).replace(/['’ʼ‘`]/g, "");
  if (UNITS[s]) return UNITS[s];
  const read = s.replace(/%?\d+(?:[.:,]\d+)*/g, (m: string, at: number) =>
    (at > 0 && /\p{L}/u.test(s[at - 1]) ? " " : "") + sayNumeral(m, ord && at + m.length === s.length));
  const out = read.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const letters = out.replace(/ /g, "");
  if (HUM.test(letters) || SHUSH.test(letters) || !/^[bcçdfgğhjklmnprsştvyzqwx]+$/.test(letters)) return out;
  return [...letters].map(c => LETTER[c] ?? `${c}e`).join(" ");
}

export type Mark = "comma" | "stop" | "ellipsis";
export type Token =
  | { kind: "word"; i: number; text: string; said: string }
  | { kind: "pause"; i: number; text: string; mark: Mark };

// A word: letters and digits, joined by an apostrophe or hyphen (Nima'nın, e-posta, 1990'da) or by
// a separator between digits (10:30, 1.000, 3,5); "%50" too. A pause: … or .. or more dots, . , ; : ! ? — –
// and a hyphen standing alone between spaces.
const TOKEN = /(%?[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:(?:['’ʼ‘-]|(?<=\p{N})[.:,](?=\p{N}))[\p{L}\p{M}\p{N}]+)*)|(\.{2,}|…|[.,;:!?—–]|(?<=^|\s)-(?=\s|$))/gu;

/** The words and pauses of a line, in order. Quotes, brackets and other symbols are skipped. */
export function tokens(text: string): Token[] {
  const out: Token[] = [];
  let skip = -1;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (m[1]) {
      const end = i + m[1].length;
      // "2. kat": a number, a dot and a lowercase word is an ordinal, not the end of a sentence
      const ord = /^\d+$/.test(m[1]) && /^\.\s+\p{Ll}/u.test(text.slice(end, end + 12));
      if (ord) skip = end;
      out.push({ kind: "word", i, text: m[1], said: sayWord(m[1], ord) });
    } else if (i !== skip) {
      const p = m[2];
      out.push({ kind: "pause", i, text: p, mark: p === "…" || p.length > 1 ? "ellipsis" : ".!?".includes(p) ? "stop" : "comma" });
    }
  }
  return out;
}
