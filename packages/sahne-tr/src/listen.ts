// Say it aloud (DESIGN.md §9): whether what the browser's recogniser heard is the line on the
// reply card. The recogniser writes numbers as digits (2 ekmek), joins or splits words (hoşgeldiniz,
// varmı), ignores the harmony of mı/mi, mangles names it does not know (Nima → Lima), and keeps the
// learner's ıı and hmm. So both sides become plain spoken words first (`normalise`), and the
// comparison is an edit distance over words, weighted by letters, that forgives joins and splits,
// a dotless-for-dotted letter, and a name, but not a different word: "İki ekmek ver" is never
// "İki ekmek, lütfen", and "Ekmek yok" is never "Ekmek var".

import { lineMatcher } from "sahne";
import { lowerTr, tokens } from "./text.ts";

/** The learner's hesitations, as recognisers write them: ıı, eee, hmm, ımm, aa, öö. */
const FILLER = /^(?:ı+|e{1,}h*|ı+h+ı*|ı*m{2,}|h+m+|aa+h*|ö+|ah+h|eh+)$/;

/** Spellings a recogniser may choose for the same words. */
const VARIANTS: Record<string, string> = { buyurun: "buyrun", buyurunuz: "buyrunuz", hoşgeldin: "hoş geldin", hoşgeldiniz: "hoş geldiniz", hoşbulduk: "hoş bulduk", tamamdır: "tamam" };

/** The same letter but for its dots or its cedilla: a cheap slip (ı/i, ş/s, ç/c, ğ/g, ö/o, ü/u). */
const NEAR: Record<string, string> = { ı: "i", ş: "s", ç: "c", ğ: "g", ö: "o", ü: "u" };

/** A written or heard line as Turkish spoken words: lower case, numerals in words, no punctuation or apostrophes. */
function spoken(said: string): string[] {
  const out: string[] = [];
  for (const t of tokens(said.replace(/[â]/g, "a").replace(/[î]/g, "i").replace(/[û]/g, "u").replace(/[Â]/g, "A").replace(/[Î]/g, "İ").replace(/[Û]/g, "U"))) {
    if (t.kind !== "word") continue;
    for (const w0 of t.said.split(/\s+/)) out.push(lowerTr(w0).replace(/[^\p{L}\p{N}]/gu, ""));
  }
  return out;
}

// A lost or added ğ costs a quarter too (it is barely said).
const m = lineMatcher({ normalise: spoken, near: NEAR, soft: "ğ", fillers: FILLER, spellings: VARIANTS });

/** A written or heard line as spoken words: Turkish lower case, numerals in words, no punctuation, apostrophes or fillers. */
export const sayWords = m.sayWords;
/** `sayWords` as one string: "İki ekmek, lütfen!" → "iki ekmek lütfen"; "ıı 2 ekmek" → "iki ekmek". */
export const normalise = m.normalise;
export const letters = m.letters;
export const allowance = m.allowance;
/**
 * Whether the recogniser's transcript (or any of its n-best alternatives) is one of the `expected`
 * lines, and which: the closest line within its allowance. Names in `o.names` (the learner's own)
 * match any one or two heard words.
 */
export const matchLine = m.matchLine;
