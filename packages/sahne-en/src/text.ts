// English text helpers: lowercasing, reading a written word aloud, and splitting a line into
// words and pauses with their character indices in the original text.

import { sayNumeral } from "./numbers.ts";

export const VOWELS = "aeiou";
export const isVowel = (c: string | undefined): boolean => c !== undefined && c.length === 1 && VOWELS.includes(c);

/** Lower case, in NFC, with curly apostrophes straightened. */
export const lowerEn = (s: string): string => s.normalize("NFC").toLowerCase().replace(/[’ʼ‘`´]/g, "'");

/** Abbreviations read in full. */
const ABBR: Record<string, string> = {
  mr: "mister", mrs: "missus", ms: "miz", dr: "doctor", km: "kilometre", kg: "kilogram", cm: "centimetre", ml: "millilitre",
  ok: "okay", vs: "versus", etc: "et cetera",
};
/** Contractions with their apostrophe: said as written, but a few are not spelled the way they sound. */
const CONTRACTION: Record<string, string> = {
  "i'm": "aim", "i'll": "ail", "i've": "aiv", "i'd": "aid", "o'clock": "o clock", "ma'am": "mam", "y'all": "yol",
  "won't": "wont", "can't": "cant", "shan't": "shant", "ain't": "ent", "let's": "lets",
};
const CURRENCY: Record<string, [string, string]> = { "£": ["pound", "pence"], "$": ["dollar", "cent"], "€": ["euro", "cent"] };
/** The names of the letters, for an initialism with no vowel (TV, BBC, PM). A y is a vowel: my, by, why, try, gym are words. */
const LETTER: Record<string, string> = {
  b: "bee", c: "see", d: "dee", f: "ef", g: "gee", h: "aitch", j: "jay", k: "kay", l: "el", m: "em", n: "en", p: "pee", q: "cue", r: "ar", s: "es", t: "tee", v: "vee", w: "double you", x: "ex", y: "why", z: "zed",
};
/** Interjections said with the mouth closed (hmm) or the lips pushed out (shh). */
export const HUM = /^h?m{2,}h?$|^h+m+$/, SHUSH = /^(?:p?s+h+t?|sh+|p?s+t)$/;

/** A written word as it is said: lower case, numerals in words, apostrophes dropped. "£5" → "five pounds", "1st" → "first". */
export function sayWord(word: string): string {
  const s = lowerEn(word);
  if (CONTRACTION[s]) return CONTRACTION[s];
  if (ABBR[s]) return ABBR[s];
  let m: RegExpExecArray | null;
  // £5, $3.50: the amount and the unit
  if ((m = /^([£$€])(\d[\d,]*)(?:\.(\d{2}))?$/.exec(s))) {
    const [unit, minor] = CURRENCY[m[1]], major = +m[2].replace(/,/g, "");
    const out = major || !+(m[3] ?? 0) ? [sayNumeral(String(major)), major === 1 ? unit : `${unit}s`] : [];
    // "five pounds fifty" (the minor unit is left out after a major one), "fifty pence", "one penny"
    if (m[3] && +m[3]) out.push(sayNumeral(String(+m[3])), ...(major ? [] : [+m[3] === 1 ? (minor === "pence" ? "penny" : minor) : minor]));
    return out.join(" ");
  }
  // 1st, 22nd, 3rd, 4th
  if ((m = /^(\d+)(?:st|nd|rd|th)$/.exec(s))) return sayNumeral(m[1], true);
  const read = s.replace(/'/g, "").replace(/\d+(?:[.,:]\d+)*%?/g, (n: string, at: number) =>
    (at > 0 && /\p{L}/u.test(s[at - 1]) ? " " : "") + sayNumeral(n) + " ");
  const out = read.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const letters = out.replace(/ /g, "");
  if (HUM.test(letters) || SHUSH.test(letters) || !/^[a-z]+$/.test(letters) || /[aeiouy]/.test(letters) || letters.length > 5) return out;
  return [...letters].map(c => LETTER[c] ?? c).join(" ");
}

export type Mark = "comma" | "stop" | "ellipsis";
export type Token =
  | { kind: "word"; i: number; text: string; said: string }
  | { kind: "pause"; i: number; text: string; mark: Mark };

// A word: letters and digits, joined by an apostrophe or hyphen (don't, well-known, Nima's) or by a
// separator between digits (10:30, 1,000, 3.5); a currency sign before and % after. A pause: … or .. or
// more dots, . , ; : ! ? — – and a hyphen standing alone between spaces.
const TOKEN = /([£$€]?[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:(?:['’ʼ‘-]|(?<=\p{N})[.:,](?=\p{N}))[\p{L}\p{M}\p{N}]+)*%?)|(\.{2,}|…|[.,;:!?—–]|(?<=^|\s)-(?=\s|$))/gu;

/** The words and pauses of a line, in order. Quotes, brackets and other symbols are skipped. */
export function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (m[1]) out.push({ kind: "word", i, text: m[1], said: sayWord(m[1]) });
    else {
      const p = m[2];
      out.push({ kind: "pause", i, text: p, mark: p === "…" || p.length > 1 ? "ellipsis" : ".!?".includes(p) ? "stop" : "comma" });
    }
  }
  return out;
}
