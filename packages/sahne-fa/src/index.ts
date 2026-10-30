// sahne-fa: the Persian plugin of Sahne (DESIGN.md §4.1, §7, §9). Mouth timing from spelling, whether a
// word of a line is a form of a `link` token, whether a heard line is the expected one (say it aloud),
// and the numbers and clock times the story lints read. It knows nothing of the engine but its types
// and the shared line matcher. Every rule wants a native speaker's check (README).

import type { LangPlugin } from "sahne";
import { speech } from "./speech.ts";
import { match } from "./match.ts";
import { normalise, matchLine } from "./listen.ts";

export { speech, phonemes, syllables, TIMING, VISEME, type Syllable } from "./speech.ts";
export { respell } from "./g2p.ts";
export { match, deixis, placeDeixis, isNear } from "./match.ts";
export { lowerFa, foldLetters, sayWord, tokens, ZWNJ, type Token, type Mark } from "./text.ts";
export { sayNumber, sayNumeral, sayDigits, ordinal, readNumber } from "./numbers.ts";
export { normalise, matchLine, sayWords, letters, allowance } from "./listen.ts";
export { readClock, clockMinutes, type ClockTime } from "./time.ts";

export const fa: LangPlugin = { id: "fa", dir: "rtl", locale: "fa-IR", speech, match, normalise, matchLine };
export default fa;
