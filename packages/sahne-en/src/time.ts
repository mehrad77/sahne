// Clock times said in a line, for the story lint that keeps every clock on stage showing the time that
// is said: "It's ten o'clock." "Half past three." "Quarter to ten." "Twenty five past two." "It's 10:30."
// A bare number is no time ("two loaves"): it needs o'clock, "at" with minutes, or past / to.

import { lowerEn } from "./text.ts";
import { readNumber } from "./numbers.ts";

export interface ClockTime { h: number; m: number }

const HOUR = new Map<string, number>(["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"].map((w, k) => [w, k + 1] as const));

/** The hour at `words[i]`: a word "one"…"twelve", noon (12), midnight (0), or digits 0–24. */
function hourAt(words: string[], i: number): number | null {
  const w = words[i];
  if (HOUR.has(w)) return HOUR.get(w)!;
  if (w === "noon") return 12;
  if (w === "midnight") return 0;
  return /^\d{1,2}$/.test(w ?? "") && +w <= 24 ? +w : null;
}

/** Minutes at `words[i]`: quarter (15), half (30), or a number up to 59 ("twenty five" takes two words). */
function minutesAt(words: string[], i: number): { m: number; len: number } | null {
  if (words[i] === "quarter") return { m: 15, len: 1 };
  if (words[i] === "half") return { m: 30, len: 1 };
  const r = readNumber(words, i);
  return r && r.n > 0 && r.n < 60 ? { m: r.n, len: r.len } : null;
}

/** Every clock time said in `text`, in order. */
export function readClock(text: string): ClockTime[] {
  const out: ClockTime[] = [];
  const low = lowerEn(text).replace(/o'clock/g, "oclock");
  // 10:30 and 10:30pm; 9.45 only with am/pm or after "at" / "it's" ("3.50" and "Version 2.10" are no times, "£5.50" is a price)
  for (const m of low.matchAll(/(?<![\d.:£$€])(\d{1,2})([:.])(\d{2})(?![\d]|[.:]\d)\s*(am|pm)?/g)) {
    if (m[2] === "." && !m[4] && !/\b(?:at|it's|it is)\s*$/.test(low.slice(Math.max(0, m.index - 8), m.index))) continue;
    let h = +m[1];
    if (m[4] === "pm" && h < 12) h += 12;
    if (m[4] === "am" && h === 12) h = 0;
    if (h <= 24 && +m[3] < 60) out.push({ h, m: +m[3] });
  }
  const words = low.replace(/(\d)[:.](\d)/g, "$1_$2").split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    // "half past two", "quarter to ten", "twenty five past nine": a multiple of five, as people say it
    const mm = minutesAt(words, i);
    if (mm && mm.m % 5 === 0) {
      let j = i + mm.len;
      if (words[j] === "minutes" || words[j] === "minute") j++;
      const dir = words[j], past = dir === "past" || dir === "after";
      if (past || ((dir === "to" || dir === "til" || dir === "till" || dir === "before") && mm.m <= 25)) {
        const h = hourAt(words, j + 1);
        if (h !== null && (h >= 1 || words[j + 1] === "midnight")) {
          out.push(past ? { h, m: mm.m } : { h: h === 0 ? 23 : h === 1 ? 12 : h - 1, m: 60 - mm.m });
          i = j + 1;
          continue;
        }
      }
    }
    // "half two" is 2:30 in British English
    if (words[i] === "half" && words[i + 1] !== "past") {
      const h = hourAt(words, i + 1);
      if (h !== null && HOUR.has(words[i + 1])) { out.push({ h, m: 30 }); i++; continue; }
    }
    // "two oclock", "it's ten thirty", "at seven oh five"
    const h = hourAt(words, i);
    if (h === null) continue;
    if (words[i + 1] === "oclock") { out.push({ h, m: 0 }); i++; continue; }
    const p = words[i - 1];
    if (p === "at" || (p === "s" && words[i - 2] === "it") || (p === "is" && words[i - 2] === "it")) {
      let k = i + 1;
      if (words[k] === "oh") k++;
      const mins = words[k] === "quarter" || words[k] === "half" ? null : minutesAt(words, k);
      if (mins) { out.push({ h, m: mins.m }); i = k + mins.len - 1; }
      else if (words[i] === "noon" || words[i] === "midnight") out.push({ h, m: 0 });
    }
  }
  return out;
}

/** A clock's time as written on a prop ("10:10", "3:30") or a ClockTime, as minutes on a 12-hour face. */
export function clockMinutes(t: string | ClockTime): number | null {
  const c = typeof t === "string" ? (/^(\d{1,2})[:.](\d{2})$/.exec(t.trim()) ?? []).slice(1).map(Number) : [t.h, t.m];
  if (c.length !== 2 || c.some(x => !Number.isFinite(x))) return null;
  return (c[0] % 12) * 60 + c[1];
}
