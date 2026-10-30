// German text helpers: lowercasing, reading a written word aloud, and splitting a line into
// words and pauses with their character indices in the original text.

import { sayEuro, sayNumeral } from "./numbers.ts";

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
export function sayWord(word: string, ord: boolean | "en" = false): string {
  const s = lowerDe(word).replace(/['’ʼ‘`]/g, "");
  if (UNITS[s]) return UNITS[s].toLowerCase();
  const read = s.replace(/\d+(?:[.:,]\d+)*%?/g, (m: string, at: number) =>
    (at > 0 && /\p{L}/u.test(s[at - 1]) ? " " : "") + sayNumeral(m, at + m.length === s.length ? ord : false));
  const out = read.replace(/-/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const letters = out.replace(/ /g, "");
  if (HUM.test(letters) || SHUSH.test(letters) || !/^[bcdfghjklmnpqrstvwxzß]+$/.test(letters)) return out;
  return [...letters].map(c => LETTER[c] ?? c).join(" ");
}

/** Words before "3. Mai" that make it an ordinal, and those among them that take the -n ending. */
const TAKES_N = new Set(["am", "im", "zum", "vom", "beim", "dem", "den", "des", "zur"]);
const BEFORE_ORD = new Set([...TAKES_N, "der", "die", "das", "ein", "eine", "einem", "einen", "mein", "meine", "unser", "unsere"]);

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
  let skip = -1, skipWord = -1, prev = "";
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index ?? 0;
    if (m[1]) {
      if (i === skipWord) continue; // the "Euro" a price has already said
      const end = i + m[1].length, after = text.slice(end, end + 12);
      // "am 2. Mai", "der 3. Stock": a number and a dot is an ordinal before a lower-case word, or after an article or
      // preposition before a word of any case; "am", "im", "den"… (dative, accusative) take -n: "am dritten Mai"
      const dotted = /^\d+$/.test(m[1]) && /^\.\s+\p{L}/u.test(after);
      const ord = dotted && (/^\.\s+\p{Ll}/u.test(after) || BEFORE_ORD.has(prev));
      if (ord) skip = end;
      const price = /^(\d+),(\d{2})$/.exec(m[1]);
      const euro = price ? /^\s*(?:€|(Euro|EUR)(?![\p{L}\p{N}]))/u.exec(text.slice(end)) : null;
      if (euro && price) {
        if (euro[1]) skipWord = end + euro[0].length - euro[1].length;
        out.push({ kind: "word", i, text: m[1], said: sayEuro(price[1], price[2]) });
      } else out.push({ kind: "word", i, text: m[1], said: sayWord(m[1], ord ? (TAKES_N.has(prev) ? "en" : true) : false) });
      prev = lowerDe(m[1]);
    } else if (i !== skip) {
      const p = m[2];
      out.push({ kind: "pause", i, text: p, mark: p === "…" || p.length > 1 ? "ellipsis" : ".!?".includes(p) ? "stop" : "comma" });
    }
  }
  return out;
}
