// A line as a voice reads it (LangPlugin.spoken, for sahne-voice): numerals and clock times in words, the way speech()
// times them ("2. kat" is ikinci kat, 14:30 is on dört otuz), quote marks gone, and no leading pause ("…Buyrun." is
// "Buyrun."). Commas, stops, question and exclamation marks and ellipses stay: they shape how the line is said.

import { tokens } from "./text.ts";

export function spoken(text: string): string {
  let out = "", at = 0;
  for (const t of tokens(text)) {
    if (t.kind !== "word" || !/\d/.test(t.text)) continue;
    out += text.slice(at, t.i) + t.said;
    at = t.i + t.text.length;
    // "2. kat": the ordinal's dot is not a stop
    if (/^\d+$/.test(t.text) && /^\.\s+\p{Ll}/u.test(text.slice(at, at + 12))) at += 1;
  }
  out += text.slice(at);
  return out.replace(/[“”„«»"]/g, "").replace(/^[\s.…]+/, "").replace(/\s+/g, " ").trim();
}
