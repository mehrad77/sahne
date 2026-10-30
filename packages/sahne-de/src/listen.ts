// Say it aloud (DESIGN.md §9): whether what the browser's recogniser heard is the line on the
// reply card. The recogniser writes numbers as digits (2 Brezeln), joins or splits words (dankeschön,
// danke schön), writes ß as ss and drops capitals, mangles names it does not know, and keeps the
// learner's äh and ähm. So both sides become plain spoken words first (`normalise`), and the comparison
// is the engine's edit distance over words, weighted by letters: a join, a split, an umlaut or a ß for ss,
// and a name are forgiven, a different word is not: "Zwei Brezeln, bitte" is never "Zwei Brote, bitte".

import { lineMatcher } from "sahne";
import { lowerDe, tokens } from "./text.ts";

/** The learner's hesitations, as recognisers write them: äh, ähm, öh, eh, ehm, uh, hm, hmm, mhm. */
const FILLER = /^(?:[äe]+h*m+|[äeöu]+h+m*|h+m+h*|m+h?m*|öh+m*)$/;

/** Spellings a recogniser may choose for the same words. */
const VARIANTS: Record<string, string> = { zwo: "zwei", gibts: "gibt es", gehts: "geht es", tschüs: "tschüss", tschuess: "tschüss", okay: "ok", dankeschön: "danke schön", bitteschön: "bitte schön", wiedersehen: "wieder sehen" };

/** The same letter but for its umlaut or its fold: ä/a, ö/o, ü/u, ß/ss (a cheap slip). */
const NEAR: Record<string, string> = { ä: "a", ö: "o", ü: "u", ß: "ss" };

/** A written or heard line as German spoken words: lower case, numerals in words, no punctuation or apostrophes. */
function spoken(said: string): string[] {
  const out: string[] = [];
  for (const t of tokens(said)) {
    if (t.kind !== "word") continue;
    for (const w0 of t.said.split(/\s+/)) out.push(lowerDe(w0).replace(/[^\p{L}\p{N}]/gu, ""));
  }
  return out;
}

const m = lineMatcher({ normalise: spoken, near: NEAR, fillers: FILLER, spellings: VARIANTS });

/** A written or heard line as spoken words: German lower case, numerals in words, no punctuation, apostrophes or fillers. */
export const sayWords = m.sayWords;
/** `sayWords` as one string: "Zwei Brezeln, bitte!" → "zwei brezeln bitte"; "äh 2 Brezeln" → "zwei brezeln". */
export const normalise = m.normalise;
export const letters = m.letters;
export const allowance = m.allowance;
/**
 * Whether the recogniser's transcript (or any of its n-best alternatives) is one of the `expected`
 * lines, and which: the closest line within its allowance. Names in `o.names` (the learner's own)
 * match any one or two heard words.
 */
export const matchLine = m.matchLine;
