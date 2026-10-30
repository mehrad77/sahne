// The language-blind line matcher (DESIGN.md §9, say it aloud). A language plugin hands over how
// its text becomes spoken words (`normalise`), which letters are nearly the same (`near`), its
// hesitations (`fillers`) and the spellings a recogniser may choose (`spellings`); this does the
// rest: a word-level edit distance weighted by letters that forgives joins and splits, a slipped
// letter, and a name, but not a different word. Turkish, English and German share it.

import type { LineMatch, MatchLineOptions } from "./lang.ts";

export interface LineMatcherLang {
  /** A written or heard line as spoken words, before fillers and spellings: lower case, numerals in words, no punctuation. */
  normalise(said: string): string[];
  /**
   * Letters that are nearly the same, each mapped to the one it folds to: `{ı: "i", ş: "s"}`.
   * A multi-letter target is allowed (`ß: "ss"`, `ä: "a"`); a slip between a letter and its fold costs a quarter.
   * Omit or leave empty for none (English).
   */
  near?: Record<string, string>;
  /** Letters that are barely said, so adding or losing one costs a quarter (Turkish ğ). Default none. */
  soft?: string;
  /** The learner's hesitations, as a recogniser writes them, tested on one word after `normalise`. */
  fillers?: RegExp;
  /** Spellings a recogniser may choose for the same words: a heard word to its usual form, which may be several words ("hoşgeldin" → "hoş geldin"). */
  spellings?: Record<string, string>;
}

export interface LineMatcher {
  /** `normalise` with fillers dropped and spellings unified, as words. */
  sayWords(said: string): string[];
  /** `sayWords` as one string. */
  normalise(said: string): string;
  /** Letter edits from `a` to `b`: a slip between near letters, or a soft letter, counts a quarter. */
  letters(a: string, b: string): number;
  /** How many letters may be off: none in a word of three, one in a short phrase, about one in six beyond (or `chars * tolerance`). */
  allowance(chars: number, tolerance?: number): number;
  /** Whether the transcript (or any n-best alternative) is one of the `expected` lines, and which: the closest within its allowance. */
  matchLine(heard: string | string[], expected: string[], o?: MatchLineOptions): LineMatch;
}

const SLIP = 0.25;
const NAME = "\u0000";
/** A word the learner said that is not in the line costs a little less than one left out (an "evet" before the line). */
const EXTRA = 0.5;
/** The most words of a line, heard or expected, that are compared (a card's line is short; a longer transcript is no match), the most letters of a heard line, and the most alternatives. */
const MAX_WORDS = 40, MAX_CHARS = 600, MAX_ALTS = 10;

export function lineMatcher(lang: LineMatcherLang): LineMatcher {
  const near = lang.near ?? {}, soft = new Set([...(lang.soft ?? "")]);
  const fold = (c: string) => near[c] ?? c;
  const cheap = (c: string) => (soft.has(c) ? SLIP : 1);

  function sayWords(said: string): string[] {
    const out: string[] = [];
    for (const w of lang.normalise(said)) {
      if (!w || lang.fillers?.test(w)) continue;
      out.push(...(lang.spellings?.[w] ?? w).split(" "));
    }
    return out;
  }

  function letters(a: string, b: string): number {
    const A = [...a], B = [...b];
    let prev = Array.from({ length: B.length + 1 }, (_, j) => B.slice(0, j).reduce((s, c) => s + cheap(c), 0));
    const rows = [prev];
    for (let i = 1; i <= A.length; i++) {
      const cur = [prev[0] + cheap(A[i - 1])];
      for (let j = 1; j <= B.length; j++) {
        const x = A[i - 1], y = B[j - 1];
        const sub = x === y ? 0 : fold(x) === fold(y) ? SLIP : 1;
        cur[j] = Math.min(prev[j - 1] + sub, prev[j] + cheap(x), cur[j - 1] + cheap(y));
      }
      rows.push(cur);
      // a letter that folds to several (ß → ss) against those letters in the other word
      for (let j = 0; j <= B.length; j++) {
        const x = A[i - 1], fx = [...fold(x)];
        if (fx.length > 1 && j >= fx.length && fx.every((c, k) => B[j - fx.length + k] === c)) {
          const from = rows[i - 1][j - fx.length] + SLIP;
          if (from < cur[j]) cur[j] = from;
        }
        const y = B[j - 1], fy = y === undefined ? [] : [...fold(y)];
        if (fy.length > 1 && i >= fy.length && fy.every((c, k) => A[i - fy.length + k] === c)) {
          const from = rows[i - fy.length][j - 1] + SLIP;
          if (from < cur[j]) cur[j] = from;
        }
      }
      prev = cur;
    }
    return prev[B.length];
  }

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

  function allowance(chars: number, tolerance?: number): number {
    if (tolerance !== undefined) return chars * tolerance;
    return chars <= 3 ? SLIP * 2 : Math.max(1, chars * 0.17);
  }

  function matchLine(heard: string | string[], expected: string[], o: MatchLineOptions = {}): LineMatch {
    const names = new Set((o.names ?? []).flatMap(sayWords));
    const alts = [heard].flat().filter(h => h && h.trim()).map(h => h.slice(0, 4 * MAX_CHARS)).slice(0, MAX_ALTS);
    let best: LineMatch = { matched: false, best: -1, heard: alts[0] ?? "", score: 0 };
    let bestErr = Infinity;
    expected.forEach((line, k) => {
      const E = sayWords(line).map(w => (names.has(w) ? NAME : w));
      const chars = E.reduce((s, w) => s + (w === NAME ? 0 : [...w].length), 0);
      if (!chars || E.length > MAX_WORDS) return;
      for (const h of alts) {
        const H = sayWords(h);
        if (!H.length || H.length > MAX_WORDS || H.reduce((n, w) => n + w.length, 0) > MAX_CHARS) continue;
        const c = cost(E, H), err = c / chars;
        if (err < bestErr) {
          bestErr = err;
          best = { matched: c <= allowance(chars, o.tolerance) + 1e-9, best: k, heard: h, score: Math.max(0, 1 - err) };
        }
      }
    });
    return best.matched ? best : { ...best, best: -1 };
  }

  return { sayWords, normalise: said => sayWords(said).join(" "), letters, allowance, matchLine };
}
