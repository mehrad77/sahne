// German text helpers: lowercasing, reading a written word aloud, and splitting a line into
// words and pauses with their character indices in the original text.

import { sayNumeral } from "./numbers.ts";

/** Lower case, composed (ä as one letter), with the capital ẞ as ß. Nouns are capitalised in German, so case never tells words apart. */
export const lowerDe = (s: string): string => s.normalize("NFC").replace(/ẞ/g, "ß").toLowerCase();

export const VOWELS = "aeiouäöüy";
export const isVowel = (c: string | undefined): boolean => c !== undefined && c.length === 1 && VOWELS.includes(c);

/** Unit abbreviations read in full; other words with no vowel are spelled out ("TV" → "te fau"). */
const UNITS: Record<string, string> = { km: "Kilometer", kg: "Kilogramm", cm: "Zentimeter", ml: "Milliliter", min: "Minute", std: "Stunde", usw: "und so weiter", bzw: "beziehungsweise", ca: "circa" };
const LETTER: Record<string, string> = { b: "be", c: "ze", d: "de", f: "ef", g: "ge", h: "ha", j: "jot", k: "ka", l: "el", m: "em", n: "en", p: "pe", q: "ku", r: "er", s: "es", t: "te", v: "fau", w: "we", x: "iks", z: "zet", ß: "es zet" };
/** Interjections said with the mouth closed (hmm, mhm) or the lips pushed out (pst, sch). */
export const HUM = /^(?:h+m+h*|m+h*m*)$/, SHUSH = /^(?:p?s+c?h*t?|sch+|p+s+t+)$/;

/** A written word as it is said: lower case, numerals in words, apostrophes dropped. "21" → "einundzwanzig". */
export function sayWord(word: string, ord = false): string {
  const s = lowerDe(word).replace(/['’ʼ‘`]/g, "");
  if (UNITS[s]) return UNITS[s].toLowerCase();
  const read = s.replace(/\d+(?:[.:,]\d+)*%?/g, (m: string, at: number) =>
    (at > 0 && /\p{L}/u.test(s[at - 1]) ? " " : "") + sayNumeral(m, ord && at + m.length === s.length));
  const out = read.replace(/-/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const letters = out.replace(/ /g, "");
  if (HUM.test(letters) || SHUSH.test(letters) || !/^[bcdfghjklmnpqrstvwxzß]+$/.test(letters)) return out;
  return [...letters].map(c => LETTER[c] ?? c).join(" ");
}

export type Mark = "comma" | "stop" | "ellipsis";
export type Token =
  | { kind: "word"; i: number; text: string; said: string }
  | { kind: "pause"; i: number; text: string; mark: Mark };

// A word: letters and digits, joined by an apostrophe or hyphen (Nima's, E-Mail, 3-mal) or by a
// separator between digits (10:30, 1.000, 3,5); "50%" too. A pause: … or .. or more dots, . , ; : ! ? — –
// and a hyphen standing alone between spaces.
const TOKEN = /([\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:(?:['’ʼ‘-]|(?<=\p{N})[.:,](?=\p{N}))[\p{L}\p{M}\p{N}]+)*%?)|(\.{2,}|…|[.,;:!?—–]|(?<=^|\s)-(?=\s|$))/gu;

/** The words and pauses of a line, in order. Quotes, brackets and other symbols are skipped. */
export function tokens(text: string): Token[] {
  const out: Token[] = [];
  let skip = -1;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (m[1]) {
      const end = i + m[1].length;
      // "am 2. Mai", "der 3. Stock": a number, a dot and a lower-case word, or a capitalised noun after "der/am/im…", is an ordinal
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
