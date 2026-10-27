// Say it aloud (DESIGN.md §9): whether what the browser's recogniser heard is the line on the
// reply card. The recogniser writes numbers as digits (2 ekmek), joins or splits words (hoşgeldiniz,
// varmı), ignores the harmony of mı/mi, mangles names it does not know (Nima → Lima), and keeps the
// learner's ıı and hmm. So both sides become plain spoken words first (`normalise`), and the
// comparison is an edit distance over words, weighted by letters, that forgives joins and splits,
// a dotless-for-dotted letter, and a name, but not a different word: "İki ekmek ver" is never
// "İki ekmek, lütfen", and "Ekmek yok" is never "Ekmek var".

import type { LineMatch, MatchLineOptions } from "sahne";
import { lowerTr, tokens } from "./text.ts";

/** The learner's hesitations, as recognisers write them: ıı, eee, hmm, ımm, aa, öö. */
const FILLER = /^(?:ı+|e{1,}h*|ı+h+ı*|ı*m{2,}|h+m+|aa+h*|ö+|ah+h|eh+)$/;

/** Spellings a recogniser may choose for the same words. */
const VARIANTS: Record<string, string> = { buyurun: "buyrun", buyurunuz: "buyrunuz", hoşgeldin: "hoş geldin", hoşgeldiniz: "hoş geldiniz", hoşbulduk: "hoş bulduk", tamamdır: "tamam" };

/** A written or heard line as spoken words: Turkish lower case, numerals in words, no punctuation, apostrophes or fillers. */
export function sayWords(said: string): string[] {
  const out: string[] = [];
  for (const t of tokens(said.replace(/[â]/g, "a").replace(/[î]/g, "i").replace(/[û]/g, "u").replace(/[Â]/g, "A").replace(/[Î]/g, "İ").replace(/[Û]/g, "U"))) {
    if (t.kind !== "word") continue;
    for (const w0 of t.said.split(/\s+/)) {
      const w = lowerTr(w0).replace(/[^\p{L}\p{N}]/gu, "");
      if (!w || FILLER.test(w)) continue;
      out.push(...(VARIANTS[w] ?? w).split(" "));
    }
  }
  return out;
}

/** `sayWords` as one string: "İki ekmek, lütfen!" → "iki ekmek lütfen"; "ıı 2 ekmek" → "iki ekmek". */
export const normalise = (said: string): string => sayWords(said).join(" ");

/** The same letter but for its dots or its cedilla: a cheap slip (ı/i, ş/s, ç/c, ğ/g, ö/o, ü/u). */
const FOLD: Record<string, string> = { ı: "i", ş: "s", ç: "c", ğ: "g", ö: "o", ü: "u" };
const fold = (c: string) => FOLD[c] ?? c;
const SLIP = 0.25;

/** Letter edits from `a` to `b`, a dot or cedilla counting a quarter, and a lost or added ğ too (it is barely said). */
export function letters(a: string, b: string): number {
  const A = [...a], B = [...b];
  let prev = Array.from({ length: B.length + 1 }, (_, j) => B.slice(0, j).reduce((s, c) => s + (c === "ğ" ? SLIP : 1), 0));
  for (let i = 1; i <= A.length; i++) {
    const cur = [prev[0] + (A[i - 1] === "ğ" ? SLIP : 1)];
    for (let j = 1; j <= B.length; j++) {
      const x = A[i - 1], y = B[j - 1];
      const sub = x === y ? 0 : fold(x) === fold(y) ? SLIP : 1;
      cur[j] = Math.min(prev[j - 1] + sub, prev[j] + (x === "ğ" ? SLIP : 1), cur[j - 1] + (y === "ğ" ? SLIP : 1));
    }
    prev = cur;
  }
  return prev[B.length];
}

const NAME = "\u0000";
/** A word the learner said that is not in the line costs a little less than one left out (an "evet" before the line). */
const EXTRA = 0.5;

/** The cheapest way to say the expected words as the heard ones, in letters. Names (NAME) are free against any one or two words. */
function cost(E: string[], H: string[]): number {
  const n = E.length, m = H.length, INF = 1e9;
  const len = (w: string) => (w === NAME ? 1 : [...w].length);
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(INF));
  d[0][0] = 0;
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
    const here = d[i][j];
    if (here >= INF) continue;
    const set = (a: number, b: number, c: number) => { if (here + c < d[a][b]) d[a][b] = here + c; };
    if (i < n) set(i + 1, j, len(E[i]));                  // an expected word not said
    if (j < m) set(i, j + 1, EXTRA * len(H[j]));            // a word said that is not in the line
    if (i < n && j < m) set(i + 1, j + 1, E[i] === NAME ? 0 : letters(E[i], H[j]));
    // joined or split: "var mı" heard as "varmı", "hoşgeldiniz" written as "hoş geldiniz"
    if (i + 1 < n && j < m && E[i] !== NAME && E[i + 1] !== NAME) set(i + 2, j + 1, letters(E[i] + E[i + 1], H[j]));
    if (i < n && j + 1 < m) set(i + 1, j + 2, E[i] === NAME ? 0 : letters(E[i], H[j] + H[j + 1]));
  }
  return d[n][m];
}

/** How many letters may be off: none in a word of three, one in a short phrase, about one in six beyond. */
export function allowance(chars: number, tolerance?: number): number {
  if (tolerance !== undefined) return chars * tolerance;
  return chars <= 3 ? SLIP * 2 : Math.max(1, chars * 0.17);
}

/**
 * Whether the recogniser's transcript (or any of its n-best alternatives) is one of the `expected`
 * lines, and which: the closest line within its allowance. Names in `o.names` (the learner's own)
 * match any one or two heard words.
 */
export function matchLine(heard: string | string[], expected: string[], o: MatchLineOptions = {}): LineMatch {
  const names = new Set((o.names ?? []).flatMap(sayWords));
  const alts = [heard].flat().filter(h => h && h.trim());
  let best: LineMatch = { matched: false, best: -1, heard: alts[0] ?? "", score: 0 };
  let bestErr = Infinity;
  expected.forEach((line, k) => {
    const E = sayWords(line).map(w => (names.has(w) ? NAME : w));
    const chars = E.reduce((s, w) => s + (w === NAME ? 0 : [...w].length), 0);
    if (!chars) return;
    for (const h of alts) {
      const H = sayWords(h);
      if (!H.length) continue;
      const c = cost(E, H), err = c / chars;
      if (err < bestErr) {
        bestErr = err;
        best = { matched: c <= allowance(chars, o.tolerance) + 1e-9, best: k, heard: h, score: Math.max(0, 1 - err) };
      }
    }
  });
  return best.matched ? best : { ...best, best: -1 };
}
