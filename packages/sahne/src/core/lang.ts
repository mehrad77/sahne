// What a language plugin gives the engine (DESIGN.md §4.1, §7). The engine knows no language:
// mouth timing, and later token matching and speech normalising, come in through a plugin such
// as `sahne-tr`. Without one, `speechFallback` estimates timing from Latin vowels.

/** A mouth shape from `time` (ms) on, until the next key. Ids are the kit's visemes: rest MBP A E I O U FV. */
export interface MouthKey { t: number; v: string }

/** A word of the line and when it is said: `i` is its character index in the text. */
export interface WordSpan { i: number; text: string; t0: number; t1: number }

export interface Speech {
  /** Total length in ms, including the pauses. */
  dur: number;
  /** Sorted, from t = 0, never the same shape twice in a row, ending on `rest` (where a closing pause begins, or at `dur`). */
  keys: MouthKey[];
  words: WordSpan[];
}

export interface SpeechOptions {
  /** 1 is A1 pace (about 200 ms per vowel); 1.3 is quicker, 0.8 slower. */
  rate?: number;
  /** A whisper or mouthing moves the mouth less; the caller scales it, the timing is the same. */
  voice?: "normal" | "whisper" | "mouthing";
}

export interface LangPlugin {
  /** BCP 47, e.g. "tr". */
  id: string;
  /** The writing direction of its text: a bubble's `dir` (default "ltr"). */
  dir?: "ltr" | "rtl";
  speech(text: string, o?: SpeechOptions): Speech;
  /** Whether `word` (as written in a line) is a form of `token` (a `link` key): ekmeği, ekmekler → ekmek. */
  match?(word: string, token: string): boolean;
  /** The speech recogniser's language, BCP 47 with a region: "tr-TR" (say it aloud, `sahne/listen`). */
  locale?: string;
  /** A recogniser's transcript or a written line as plain spoken words: lower case, no punctuation or fillers, numerals in words. */
  normalise?(said: string): string;
  /** Whether what the recogniser heard (one transcript, or its n-best alternatives) is one of the `expected` lines. */
  matchLine?(heard: string | string[], expected: string[], o?: MatchLineOptions): LineMatch;
}

export interface MatchLineOptions {
  /** Words of the expected lines that are names (the learner's own): the recogniser rarely spells them right, so any one word stands for them. */
  names?: string[];
  /** The share of a line's letters that may be wrong (the plugin's default scales with length). */
  tolerance?: number;
}

/** What a heard line matched: the expected line (`best`, −1 for none), the alternative that matched it, and how close (0–1). */
export interface LineMatch { matched: boolean; best: number; heard: string; score: number }

/** Without a plugin: case-insensitive, and a word may add an ending to the token. */
export const matchFallback = (word: string, token: string) => word.toLowerCase().startsWith(token.toLowerCase());

const VOWEL: Record<string, string> = { a: "A", e: "E", i: "I", o: "O", u: "U", y: "I" };

/** A language-blind estimate: one mouth shape per Latin vowel, 200 ms each, pauses at punctuation. */
export function speechFallback(text: string, o: SpeechOptions = {}): Speech {
  const k = 1 / (o.rate ?? 1), keys: MouthKey[] = [], words: WordSpan[] = [];
  let t = 0;
  const re = /[\p{L}\p{N}'’]+|[.,!?;:…]/gu;
  for (const m of text.matchAll(re)) {
    const w = m[0];
    if (/^[.,!?;:…]$/.test(w)) { keys.push({ t, v: "rest" }); t += (w === "," ? 250 : 400) * k; continue; }
    const t0 = t;
    for (const ch of w.toLowerCase().normalize("NFD")) {
      if (/[mbp]/.test(ch)) { keys.push({ t, v: "MBP" }); t += 60 * k; }
      else if (/[fv]/.test(ch)) { keys.push({ t, v: "FV" }); t += 60 * k; }
      else if (VOWEL[ch]) { keys.push({ t, v: VOWEL[ch] }); t += 140 * k; }
    }
    if (t === t0) t += 120 * k;
    words.push({ i: m.index ?? 0, text: w, t0, t1: t });
    t += 40 * k;
  }
  keys.push({ t, v: "rest" });
  return { dur: t, keys, words };
}
