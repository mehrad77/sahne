// Say it aloud (DESIGN.md §9): whether what the browser's recogniser heard is the line on the reply
// card. The recogniser writes numbers as digits (2 loaves), writes "I'm" where the card says "I am",
// has the American spelling, and keeps the learner's um and hmm. So both sides become plain spoken words
// first (`normalise`: contractions opened, numerals in words, fillers and punctuation gone), and the
// comparison is the engine's word-level edit distance (`lineMatcher`). English has no near letters,
// so a different letter always costs a whole one; and a line with a "not" never passes for one without
// ("There is bread" is never "There isn't bread"), however few letters differ.

import { lineMatcher } from "sahne";
import type { LineMatch, MatchLineOptions } from "sahne";
import { lowerEn, tokens } from "./text.ts";

/** The learner's hesitations, as recognisers write them: um, uh, er, erm, hmm, mm. */
const FILLER = /^(?:u+m+|u+h+|e+r+m*|e+h+|h+m+|m{2,})$/;

/** Spellings a recogniser may choose for the same words: the American to the British, and the run-together. */
const VARIANTS: Record<string, string> = {
  okay: "ok", alright: "all right", gonna: "going to", wanna: "want to", gotta: "got to", gimme: "give me", lemme: "let me", kinda: "kind of", sorta: "sort of", thankyou: "thank you",
  color: "colour", favorite: "favourite", neighbor: "neighbour", center: "centre", theater: "theatre", gray: "grey", mom: "mum", donut: "doughnut", realize: "realise", organize: "organise",
};

const NOT = new Set(["no", "not", "never", "nobody", "nothing", "none", "neither", "nor", "nowhere", "without"]);

/** Contractions opened, before the text is split into words: "I'm" → "i am", "isn't" → "is not". Currency is read by `sayWord` ("£5.50" → "five pounds fifty"). */
export function expand(text: string): string {
  return lowerEn(text)
    .replace(/\bcan't\b/g, "can not").replace(/\bwon't\b/g, "will not").replace(/\bshan't\b/g, "shall not").replace(/\bain't\b/g, "is not").replace(/\blet's\b/g, "let us").replace(/\bcannot\b/g, "can not")
    .replace(/(\p{L}+)n't\b/gu, "$1 not")
    .replace(/(\p{L})'m\b/gu, "$1 am").replace(/(\p{L})'re\b/gu, "$1 are").replace(/(\p{L})'ve\b/gu, "$1 have").replace(/(\p{L})'ll\b/gu, "$1 will").replace(/(\p{L})'d\b/gu, "$1 would")
    .replace(/\b(it|he|she|that|there|what|who|here|where|how|when)'s\b/g, "$1 is")
    .replace(/(\p{L})'s\b/gu, "$1").replace(/(\p{L}s)'(?!\p{L})/gu, "$1");
}

/** A written or heard line as English spoken words: lower case, contractions opened, numerals in words, no punctuation. */
function spoken(said: string): string[] {
  const out: string[] = [];
  for (const t of tokens(expand(said))) {
    if (t.kind !== "word") continue;
    for (const w0 of t.said.split(/\s+/)) out.push(w0.replace(/[^\p{L}\p{N}]/gu, ""));
  }
  return out;
}

const m = lineMatcher({ normalise: spoken, fillers: FILLER, spellings: VARIANTS });

/** A written or heard line as spoken words: lower case, contractions opened, numerals in words, no punctuation or fillers. */
export const sayWords = m.sayWords;
/** `sayWords` as one string: "I'm OK, thanks!" → "i am ok thanks"; "um 2 loaves" → "two loaves". */
export const normalise = m.normalise;
export const letters = m.letters;
export const allowance = m.allowance;

const negated = (line: string) => m.sayWords(line).some(w => NOT.has(w));

/**
 * Whether the recogniser's transcript (or any of its n-best alternatives) is one of the `expected`
 * lines, and which: the closest line within its allowance, among the lines that agree with it on
 * "not". Names in `o.names` (the learner's own) match any one or two heard words.
 */
export function matchLine(heard: string | string[], expected: string[], o: MatchLineOptions = {}): LineMatch {
  // bounded like the shared matcher: a recogniser gives a few short alternatives, anything more is not a line
  const alts = [heard].flat().filter(h => h && h.trim()).slice(0, 10).map(h => h.slice(0, 2400));
  let best: LineMatch = { matched: false, best: -1, heard: alts[0] ?? "", score: 0 };
  const neg = expected.map(negated);
  for (const h of alts) {
    const same = expected.map((_, k) => k).filter(k => neg[k] === negated(h));
    const r = m.matchLine(h, same.map(k => expected[k]), o);
    const hit: LineMatch = { ...r, best: r.best < 0 ? -1 : same[r.best] };
    if ((hit.matched && !best.matched) || (hit.matched === best.matched && hit.score > best.score)) best = hit;
  }
  return best;
}
