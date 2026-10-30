// Clock times said in a line, for the story lint that keeps every clock on stage showing the time that is
// said: "Es ist zehn Uhr." "Halb drei." "Viertel vor zehn." "Fünf nach halb drei." "Es ist 10:30 Uhr."
//
// German counts toward the next hour: "halb drei" is 2:30, "Viertel vor zehn" is 9:45, "fünf nach halb drei"
// is 2:35 and "fünf vor halb drei" is 2:25. "Viertel drei" is 2:15 in the east and "dreiviertel drei" 2:45.

import { lowerDe } from "./text.ts";
import { readNumber } from "./numbers.ts";

export interface ClockTime { h: number; m: number }

/** The hour before `h` on a 12-hour face: drei → 2, eins → 12. */
const before = (h: number) => (h === 1 ? 12 : h - 1);

/** The hour at `words[i]`: a number 1–24, as digits or in words. */
function hourAt(words: string[], i: number): { h: number; len: number } | null {
  const r = readNumber(words, i);
  return r && r.n >= 1 && r.n <= 24 && r.len === 1 ? { h: r.n, len: 1 } : null;
}

/** Minutes at `words[i]`: viertel (15), or a number up to 29 ("fünf", "zwanzig"). */
function minutesAt(words: string[], i: number): { m: number; len: number } | null {
  if (words[i] === "viertel") return { m: 15, len: 1 };
  const r = readNumber(words, i);
  return r && r.n > 0 && r.n < 60 && r.len === 1 ? { m: r.n, len: 1 } : null;
}

/** Every clock time said in `text`, in order. A bare number counts only before "Uhr" ("zwei Brezeln" is no time). */
export function readClock(text: string): ClockTime[] {
  const out: ClockTime[] = [];
  const low = lowerDe(text).replace(/[’ʼ‘]/g, "'");
  for (const m of low.matchAll(/(?<![\d.:])(\d{1,2})[:.](\d{2})(?![\d]|[.:]\d)/g)) if (+m[1] <= 24 && +m[2] < 60) out.push({ h: +m[1], m: +m[2] });
  if (out.length) return out;
  const words = low.replace(/(\d)[:.](\d)/g, "$1_$2").split(/[^\p{L}\p{N}'_]+/u).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    // "fünf nach halb drei", "Viertel vor zehn", "zehn nach drei"
    const mm = minutesAt(words, i);
    if (mm && (words[i + 1] === "vor" || words[i + 1] === "nach")) {
      const dir = words[i + 1] === "vor" ? -1 : 1;
      let j = i + 2;
      const half = words[j] === "halb";
      if (half) j++;
      const h = hourAt(words, j);
      if (h) {
        // "vor halb drei" is 2:30 − m; "nach halb drei" 2:30 + m; "vor drei" is 3:00 − m; "nach drei" 3:00 + m
        const mod = h.h > 12 ? 1440 : 720, total = (((half ? before(h.h) * 60 + 30 : h.h * 60) + dir * mm.m) % mod + mod) % mod;
        out.push({ h: Math.floor(total / 60) || (h.h > 12 ? 0 : 12), m: total % 60 });
        i = j + h.len - 1;
        continue;
      }
    }
    if (w === "halb" || w === "dreiviertel" || w === "viertel") {
      const h = hourAt(words, i + 1);
      if (h && !["vor", "nach"].includes(words[i + 2] ?? "")) { out.push({ h: before(h.h), m: w === "halb" ? 30 : w === "viertel" ? 15 : 45 }); i += h.len; continue; }
    }
    // "zehn Uhr", "zehn Uhr dreißig", "10 Uhr 30"
    if (words[i + 1] === "uhr") {
      const h = hourAt(words, i);
      if (h) {
        const m2 = minutesAt(words, i + 2);
        out.push({ h: h.h, m: m2 ? m2.m : 0 });
        i += m2 ? 2 + m2.len : 1;
      }
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
