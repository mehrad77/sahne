// Clock times said in a line, for the story lint that keeps every clock on stage showing the time that is said:
// "ساعت سه است." "سه و نیم." "یه ربع به ده." "ده دقیقه به هفت." "ساعت ۱۰:۳۰." A bare number is no time ("دو تا نان"):
// it needs ساعت, a digital 10:30, or ربع / نیم / دقیقه with به. "سه و نیم" alone is a time only at the end of a
// line or before a part of the day, because "سه و نیم کیلو" is three and a half kilos.

import { lowerFa } from "./text.ts";
import { readNumber } from "./numbers.ts";

export interface ClockTime { h: number; m: number }

const HOUR = new Map<string, number>(["یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده", "یازده", "دوازده"].map((w, k) => [w, k + 1] as const));
HOUR.set("یه", 1); HOUR.set("شیش", 6);
/** After "H و نیم" these make it a time; anything else (a unit, a thing) makes it a quantity. */
const TIME_FOLLOWS = new Set(["است", "هست", "بود", "شد", "میشود", "میشه", "صبح", "ظهر", "عصر", "شب", "بامداد", "بعدازظهر", "الان", "الآن"]);

/** After "X دقیقه به <hour>" these make the hour a count ("ده دقیقه به یک نفر گفتم"), not a clock hour. */
const COUNTED = new Set(["نفر", "تا", "عدد", "دانه", "بار", "کیلو", "متر", "کیلوگرم", "لیتر", "بسته", "نفره"]);

/** The hour at `words[i]`: a word یک…دوازده, or digits 0–24. */
function hourAt(words: string[], i: number): number | null {
  const w = words[i];
  if (HOUR.has(w)) return HOUR.get(w)!;
  return /^\d{1,2}$/.test(w ?? "") && +w <= 24 ? +w : null;
}

interface Minutes { m: number; len: number; word: boolean }
/** Minutes at `words[i]`: ربع (15; "یه ربع"), نیم (30), or a number up to 59 ("بیست و پنج" takes three words). */
function minutesAt(words: string[], i: number): Minutes | null {
  if (words[i] === "ربع") return { m: 15, len: 1, word: true };
  if ((words[i] === "یک" || words[i] === "یه") && words[i + 1] === "ربع") return { m: 15, len: 2, word: true };
  if (words[i] === "نیم" || words[i] === "نیمه") return { m: 30, len: 1, word: true };
  const r = readNumber(words, i);
  return r && r.n > 0 && r.n < 60 ? { m: r.n, len: r.len, word: false } : null;
}

const before = (h: number, m: number): ClockTime => ({ h: h === 0 ? 23 : h === 1 ? 12 : h - 1, m: 60 - m });

/** Every clock time said in `text`, in order. */
export function readClock(text: string): ClockTime[] {
  const out: ClockTime[] = [];
  const low = lowerFa(text);
  // 10:30 (and 10.30 after ساعت): "3.50" and "Version 2.10" are no times
  for (const m of low.matchAll(/(?<![\d.:])(\d{1,2})([:.])(\d{2})(?![\d]|[.:]\d)/g)) {
    if (m[2] === "." && !/ساعت\s*$/.test(low.slice(Math.max(0, m.index - 8), m.index))) continue;
    if (+m[1] <= 24 && +m[3] < 60) out.push({ h: +m[1], m: +m[3] });
  }
  const words = low.replace(/(\d)[:.](\d)/g, "$1_$2").split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    // "ربع کم ده": a quarter to ten
    if (words[i] === "ربع" && words[i + 1] === "کم") {
      const j = words[i + 2] === "ساعت" ? i + 3 : i + 2, h = hourAt(words, j);
      if (h !== null) { out.push(before(h, 15)); i = j; continue; }
    }
    // "ده دقیقه به هفت", "یه ربع به ده", "ده دقیقه از سه گذشته": the minutes come first
    const mm = minutesAt(words, words[i] === "ساعت" ? i + 1 : i);
    if (mm) {
      let j = (words[i] === "ساعت" ? i + 1 : i) + mm.len;
      const dq = words[j] === "دقیقه";
      if (dq) j++;
      if (dq || mm.word) {
        let d = j;
        if (words[d] === "مانده" || words[d] === "مونده") d++;
        if (words[d] === "به") {
          let hj = d + 1;
          if (words[hj] === "ساعت") hj++;
          const h = hourAt(words, hj);
          if (h !== null && (h >= 1 || words[hj] === "0") && !COUNTED.has(words[hj + 1])) { out.push(before(h, mm.m)); i = hj; continue; }
        } else if (words[d] === "از") {
          let hj = d + 1;
          if (words[hj] === "ساعت") hj++;
          const h = hourAt(words, hj);
          if (h !== null && /^(?:گذشته|گذشت|رفته)$/.test(words[hj + 1] ?? "")) { out.push({ h, m: mm.m }); i = hj + 1; continue; }
        }
      }
    }
    // "ساعت سه", "ساعت سه و نیم", "ساعت سه و ده دقیقه", "ساعت ۱۰"
    if (words[i] === "ساعت") {
      const h = hourAt(words, i + 1);
      if (h === null) continue;
      let k = i + 2, m = 0;
      if (words[k] === "و") {
        const m2 = minutesAt(words, k + 1);
        if (m2) {
          const e = k + 1 + m2.len, dq = words[e] === "دقیقه";
          if (m2.word || dq || m2.m % 5 === 0) { m = m2.m; k = e + (dq ? 1 : 0); }
        }
      }
      out.push({ h, m });
      i = k - 1;
      continue;
    }
    // "سه و نیم", "چهار و ربع", "سه و ده دقیقه" without ساعت: only when nothing makes it a quantity
    const h = HOUR.has(words[i]) || /^\d{1,2}$/.test(words[i] ?? "") ? hourAt(words, i) : null;
    if (h !== null && words[i + 1] === "و") {
      const m2 = minutesAt(words, i + 2);
      if (m2) {
        const e = i + 2 + m2.len, dq = words[e] === "دقیقه", after = words[dq ? e + 1 : e];
        if ((dq && (after === undefined || TIME_FOLLOWS.has(after))) || (m2.word && (after === undefined || TIME_FOLLOWS.has(after)))) { out.push({ h, m: m2.m }); i = e + (dq ? 1 : 0) - 1; }
      }
    }
  }
  return out;
}

/** A clock's time as written on a prop ("10:10", "۳:۳۰") or a ClockTime, as minutes on a 12-hour face. */
export function clockMinutes(t: string | ClockTime): number | null {
  const c = typeof t === "string" ? (/^(\d{1,2})[:.](\d{2})$/.exec(lowerFa(t).trim()) ?? []).slice(1).map(Number) : [t.h, t.m];
  if (c.length !== 2 || c.some(x => !Number.isFinite(x))) return null;
  return (c[0] % 12) * 60 + c[1];
}
