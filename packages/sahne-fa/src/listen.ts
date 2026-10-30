// Say it aloud (DESIGN.md §9): whether what the browser's recogniser heard is the line on the reply card. The
// recogniser writes numbers as digits (2 تا نان), spells colloquial speech as it is said (نون for نان, اون for
// آن), joins or splits the parts of a word (می روم, میروم) and keeps the learner's اِم and هوم. So both sides
// become plain spoken words first (`normalise`: Arabic letter forms folded, marks and ZWNJ gone, numerals in words,
// fillers and punctuation gone), and the comparison is the engine's word-level edit distance (`lineMatcher`).
//
// Persian is written with letters that sound alike, and recognisers pick between them: س ص ث, ز ذ ض ظ, ت ط, ه ح,
// ق غ, and ا ع ء (and آ) at the start of a word. The matcher's near table folds each letter to one, at a quarter
// of a letter. It cannot see position, so ع and ء are near ا anywhere in a word, not only at the start.
//
// A negated line never passes for one without: "نان داریم" is never "نان نداریم", however few letters differ.

import { lineMatcher } from "sahne";
import type { LineMatch, MatchLineOptions } from "sahne";
import { lowerFa, tokens } from "./text.ts";

/** The learner's hesitations, as recognisers write them: اِم، ام، اممم، اوم، هوم، اا. (خب is a word: see `matchLine`.) */
const FILLER = /^(?:ام+|ا?م{2,}|اوم+|هوم+|ا{2,})$/;

/** Letters that sound alike, each folded to one. */
const NEAR: Record<string, string> = {
  "ص": "س", "ث": "س", "ذ": "ز", "ض": "ز", "ظ": "ز", "ط": "ت", "ح": "ه", "غ": "ق", "ع": "ا", "ء": "ا", "آ": "ا",
};

/** Spellings a recogniser may choose for the same words: the colloquial to the written, and the run-together. */
const VARIANTS: Record<string, string> = {
  نون: "نان", اون: "آن", اونجا: "آنجا", همون: "همان", یه: "یک", اره: "آره", اکی: "اوکی", ok: "اوکی", okay: "اوکی",
  بدین: "بدهید", بدید: "بدهید", بیارین: "بیاورید", بیارید: "بیاورید", میخوام: "میخواهم", میخوای: "میخواهی", میخوایم: "میخواهیم",
  نمیدونم: "نمیدانم", میشه: "میشود", چیه: "چیست", خونه: "خانه", ببخشین: "ببخشید", خدافظ: "خداحافظ",
};

/** Words that make a line negative: نه، نخیر، نیست*، ندار*، نمی*، نبود*، هیچ*، هرگز، بدون. (Not a bare ن: نان starts with it.) */
const NOT = /^(?:نه|نخیر|نیست.*|نیس|ندار.*|نمی.+|نبود.*|نشد.*|نکن.*|نباید|نباش.*|هیچ.*|هرگز|بدون)$/;

/** A written or heard line as Persian spoken words: folded, numerals in words, no punctuation. */
function spoken(said: string): string[] {
  const out: string[] = [];
  for (const t of tokens(said)) {
    if (t.kind !== "word") continue;
    for (const w0 of lowerFa(t.said).split(/\s+/)) out.push(w0.replace(/[^\p{L}\p{N}]/gu, ""));
  }
  return out;
}

const m = lineMatcher({ normalise: spoken, near: NEAR, fillers: FILLER, spellings: VARIANTS });

/** A written or heard line as spoken words: folded, numerals in words, no punctuation or fillers. */
export const sayWords = m.sayWords;
/** `sayWords` as one string: "اِم، ۲ تا نان!" → "دو تا نان". */
export const normalise = m.normalise;
export const letters = m.letters;
export const allowance = m.allowance;

const negated = (line: string) => m.sayWords(line).some(w => NOT.test(w));

/**
 * Whether the recogniser's transcript (or any of its n-best alternatives) is one of the `expected` lines, and
 * which: the closest line within its allowance, among the lines that agree with it on negation. Names in `o.names`
 * (the learner's own) match any one or two heard words. A leading "خب" the learner says before the line is dropped
 * unless an expected line starts with it, since خب is a word that cards use.
 */
export function matchLine(heard: string | string[], expected: string[], o: MatchLineOptions = {}): LineMatch {
  const alts = [heard].flat().filter(h => h && h.trim()).slice(0, 10).map(h => h.slice(0, 2400));
  let best: LineMatch = { matched: false, best: -1, heard: alts[0] ?? "", score: 0 };
  const neg = expected.map(negated), wantsKhob = expected.some(e => m.sayWords(e)[0] === "خب");
  for (const h0 of alts) {
    const h = !wantsKhob && m.sayWords(h0)[0] === "خب" ? m.sayWords(h0).slice(1).join(" ") : h0;
    const same = expected.map((_, k) => k).filter(k => neg[k] === negated(h));
    const r = m.matchLine(h, same.map(k => expected[k]), o);
    const hit: LineMatch = { ...r, best: r.best < 0 ? -1 : same[r.best], heard: h0 };
    if ((hit.matched && !best.matched) || (hit.matched === best.matched && hit.score > best.score)) best = hit;
  }
  return best;
}
