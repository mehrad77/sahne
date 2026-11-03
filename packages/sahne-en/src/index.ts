// sahne-en: the English plugin of Sahne (DESIGN.md §4.1, §7, §9). Mouth timing from spelling, whether a
// word of a line is a form of a `link` token, whether a heard line is the expected one (say it aloud),
// and the numbers and clock times the story lints read. It knows nothing of the engine but its types
// and the shared line matcher.

import type { LangPlugin } from "sahne";
import { speech } from "./speech.ts";
import { match } from "./match.ts";
import { normalise, matchLine } from "./listen.ts";

export { speech, phonemes, syllables, TIMING, VISEME, type Syllable } from "./speech.ts";
export { respell } from "./g2p.ts";
export { match, forms, inflections, deixis, isNear } from "./match.ts";
export { lowerEn, sayWord, tokens, type Token, type Mark } from "./text.ts";
export { sayNumber, sayNumeral, sayDigits, ordinal, readNumber } from "./numbers.ts";
export { normalise, matchLine, sayWords, letters, allowance, expand } from "./listen.ts";
export { readClock, clockMinutes, type ClockTime } from "./time.ts";

export const en: LangPlugin = { id: "en", locale: "en-GB", speech, match, normalise, matchLine };
export default en;
