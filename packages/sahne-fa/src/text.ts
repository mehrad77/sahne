// Persian text helpers: folding the Arabic letter forms to the Persian ones, reading a written word aloud, and
// splitting a line into words and pauses with their character indices in the original text.
//
// Two folds. `foldLetters` keeps what speech needs (the short-vowel marks, the ZWNJ that joins the parts of a
// word, the ezafe hamza): it is the written word with ي ك ة أ إ ؤ made Persian and ۰–۹ ٠–٩ made 0–9. `lowerFa`
// goes on to drop the marks, tatweel and ZWNJ, which is what matching compares ("می‌روم" and "میروم" are one word).

import { sayNumeral } from "./numbers.ts";

/** The zero-width non-joiner: it joins the parts of a word (می‌روم, کتاب‌ها) without joining the letters. */
export const ZWNJ = "‌";

const FORM: Record<string, string> = {
  "ي": "ی", "ى": "ی", // ي ى → ی
  "ك": "ک", // ك → ک
  "ة": "ه", "ھ": "ه", "ہ": "ه", "ە": "ه", // ة ھ ہ ە → ه
  "ۀ": "هٔ", // ۀ → ه with the hamza above, which is the written ezafe
  "أ": "ا", "إ": "ا", "ٱ": "ا", // أ إ ٱ → ا
  "ؤ": "و", // ؤ → و
};
const FORMS = /[يىكةھہەۀأإٱؤ]/g;
const MARKS = /[ً-ٰٟـ‌‍]/g;

/** NFC, lower case, Arabic forms Persian, digits ASCII (۱۲ and ١٢ are 12), ٫ ٬ ٪ as . , %; short-vowel marks and ZWNJ kept. */
export const foldLetters = (s: string): string =>
  s.normalize("NFC").toLowerCase()
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/٫/g, ".").replace(/٬/g, ",").replace(/٪/g, "%")
    .replace(FORMS, c => FORM[c]);

/** `foldLetters` without the short-vowel marks (harakat), tatweel and ZWNJ: the form words are compared in. */
export const lowerFa = (s: string): string => foldLetters(s).replace(MARKS, "");

/** Abbreviations read in full. */
const ABBR: Record<string, string> = { "ok": "اوکی", "tv": "تی وی", "pm": "پی ام" };

/**
 * A written word as it is said: letters folded, numerals in words, hyphens as spaces. "۵ تا" → "پنج تا", "3م" → "سوم".
 * The short-vowel marks and ZWNJ stay (speech reads them); `lowerFa` of the result is the matching form.
 */
export function sayWord(word: string): string {
  const s = foldLetters(word);
  if (ABBR[s]) return ABBR[s];
  let m: RegExpExecArray | null;
  // 3م, 21ام: an ordinal
  if ((m = /^(\d+)(?:ام|م)$/.exec(s))) return sayNumeral(m[1], true);
  const read = s.replace(/\d+(?:[.,:]\d+)*%?/g, (n: string, at: number) =>
    (at > 0 && /\p{L}/u.test(s[at - 1]) ? " " : "") + sayNumeral(n) + " ");
  return read.replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

/** Interjections said with the mouth closed (هوم، ممم، hmm) or the lips pushed out (هیس، shh). Tested on `lowerFa`. */
export const HUM = /^h?m{2,}h?$|^هوم+$|^ا?م{3,}$|^امم$/, SHUSH = /^(?:p?s+h+t?|sh+)$|^هیس+$|^هیش+$|^ش{3,}$/;

export type Mark = "comma" | "stop" | "ellipsis";
export type Token =
  | { kind: "word"; i: number; text: string; said: string }
  | { kind: "pause"; i: number; text: string; mark: Mark };

// A word: letters and digits with their marks and ZWNJ (می‌روم), joined by a hyphen or by a separator between
// digits (10:30, 1,000, 3.5, ۳٫۵); % or ٪ after. A pause: … or .. or more dots, . , ; : ! ? and the Arabic ، ؛ ؟ ۔,
// — – and a hyphen standing alone between spaces. Quotes («»), brackets and other symbols are skipped.
const TOKEN = /([\p{L}\p{N}][\p{L}\p{M}\p{N}‌‍]*(?:(?:-|(?<=\p{N})[.:,٫٬])[\p{L}\p{M}\p{N}‌‍]+)*[%٪]?)|(\.{2,}|…|[.,;:!?،؛؟۔—–]|(?<=^|\s)-(?=\s|$))/gu;

/** The words and pauses of a line, in order, each with its character index in `text`. */
export function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (m[1]) out.push({ kind: "word", i, text: m[1], said: sayWord(m[1]) });
    else {
      const p = m[2];
      out.push({ kind: "pause", i, text: p, mark: p === "…" || p.length > 1 ? "ellipsis" : ".!?؟۔".includes(p) ? "stop" : "comma" });
    }
  }
  return out;
}
