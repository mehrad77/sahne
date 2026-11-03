// Persian numbers in words ("بیست و یک"): for timing a line, for reading it aloud, and for the story lints that
// read a number out of a line. Digits reach here as ASCII (`lowerFa` folds ۰–۹ and ٠–٩), so "۲۱" is "21".

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه", "ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES: [number, string][] = [[1e9, "میلیارد"], [1e6, "میلیون"], [1e3, "هزار"]];

/** The terms of 1–999, joined by "و" in speech: 125 → صد, بیست, پنج. */
function below1000(n: number): string[] {
  const h = Math.floor(n / 100), r = n % 100;
  return [...(h ? [HUNDREDS[h]] : []), ...(r < 20 ? (r ? [ONES[r]] : []) : [TENS[Math.floor(r / 10)], ...(r % 10 ? [ONES[r % 10]] : [])])];
}

/** Digit by digit: "0532" → "صفر پنج سه دو". */
export const sayDigits = (d: string): string => [...d].filter(c => c >= "0" && c <= "9").map(c => (c === "0" ? "صفر" : ONES[+c])).join(" ");

/** A whole number: 21 → "بیست و یک", 1990 → "هزار و نهصد و نود", 2000 → "دو هزار". */
export function sayNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `منفی ${sayNumber(-n)}`;
  n = Math.floor(n);
  if (n === 0) return "صفر";
  if (n >= 1e21) return "";
  if (n >= 1e12) return sayDigits(BigInt(n).toString());
  const terms: string[] = [];
  let rest = n;
  for (const [v, w] of SCALES) {
    const q = Math.floor(rest / v);
    // a thousand is just "هزار"; a million is "یک میلیون"
    if (q) terms.push(q === 1 && v === 1e3 ? w : `${below1000(q).join(" و ")} ${w}`);
    rest %= v;
  }
  if (rest) terms.push(...below1000(rest));
  return terms.join(" و ");
}

/** The ordinal of the last word of a number in words: یک → اول (یکم inside a longer number), سه → سوم, پنج → پنجم, سی → سیام. */
export function ordinal(words: string): string {
  if (words === "یک") return "اول";
  const parts = words.split(" "), last = parts[parts.length - 1];
  parts[parts.length - 1] = last === "سه" ? "سوم" : last.endsWith("ی") ? `${last}ام` : `${last}م`;
  return parts.join(" ");
}

/** A run of digits as written; leading zeros read one by one ("05" → "صفر پنج"). */
const whole = (d: string): string => (d.length > 1 && d[0] === "0") || d.length > 12 ? sayDigits(d) : sayNumber(+d);

/**
 * A numeral as written in a line: "15", "1,000" (thousands), "3.5" ("سه ممیز پنج"), "10:30" (a clock time,
 * "ده و سی"; "4:00" is "چهار"), "50%" ("پنجاه درصد"); `ord` makes it an ordinal. Persian years read as
 * ordinary numbers (1990 is "هزار و نهصد و نود").
 */
export function sayNumeral(s: string, ord = false): string {
  let post = "";
  if (s.endsWith("%")) { post = " درصد"; s = s.slice(0, -1); }
  let out: string, m: RegExpExecArray | null;
  if ((m = /^(\d{1,2}):(\d{2})$/.exec(s)) && +m[1] <= 24 && +m[2] < 60) out = +m[2] ? `${sayNumber(+m[1])} و ${sayNumber(+m[2])}` : sayNumber(+m[1]);
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) out = sayNumber(+s.replace(/,/g, ""));
  else if ((m = /^(\d+)[./](\d+)$/.exec(s))) out = `${whole(m[1])} ممیز ${sayDigits(m[2])}`;
  else if (/^\d+$/.test(s)) out = whole(s);
  else out = s.replace(/\d+/g, d => ` ${whole(d)} `).replace(/[^\p{L}]+/gu, " ").trim();
  return (ord ? ordinal(out) : out) + post;
}

const WORD = new Map<string, number>();
ONES.forEach((w, i) => { if (w) WORD.set(w, i); });
TENS.forEach((w, i) => { if (w) WORD.set(w, i * 10); });
HUNDREDS.forEach((w, i) => { if (w) WORD.set(w, i * 100); });
// as people say them: یه (یک), شیش (شش), پونزده, شونزده, هیجده, پونصد
for (const [w, n] of [["یه", 1], ["شیش", 6], ["پونزده", 15], ["شونزده", 16], ["هیجده", 18], ["پونصد", 500], ["پونسد", 500]] as const) WORD.set(w, n);
const MULT: Record<string, number> = Object.assign(Object.create(null), { هزار: 1e3, میلیون: 1e6, میلیارد: 1e9 });
/** After a lone نه: it is nine only before these (a classifier, "and" or a scale); a bare نه is "no". */
// (a counted noun or unit cannot follow the interjection: نه عدد نان, نه نفر, نه روز)
const NINE_BEFORE = new Set(["تا", "و", ...Object.keys(MULT), "عدد", "دانه", "بسته", "نفر", "بار", "تومان", "ریال", "روز", "ساعت", "دقیقه", "کیلو"]);

/** One group of 1–999 from `words[j]`: hundreds, tens and ones joined by "و". */
function group(words: string[], j: number): { v: number; end: number } | null {
  let v = 0, k = j, last = 0;
  for (;;) {
    const val = WORD.get(words[k]);
    if (val === undefined) break;
    const tier = val >= 100 ? 3 : val >= 20 ? 2 : 1;
    // hundreds first, then tens (or teens), then ones; "نه" at the start of a group is nine only before تا, و, صد or a scale
    if (!(last === 0 || (last === 3 && tier < 3) || (last === 2 && val < 10))) break;
    if (val === 9 && words[k] === "نه" && k === j && !NINE_BEFORE.has(words[k + 1])) break;
    v += val; last = tier === 1 && val >= 10 ? 1 : tier; k++;
    const nv = words[k] === "و" ? WORD.get(words[k + 1]) : undefined;
    if (nv !== undefined && ((last === 3 && nv < 100) || (last === 2 && nv < 10))) { k++; continue; }
    break;
  }
  return k > j ? { v, end: k } : null;
}

/**
 * A number said from `words[i]` on (lower-case words, or digits as written): its value and how many words it takes.
 * "بیست و یک" → 21, "دو هزار و پانصد" → 2500, "سه" → 3, "دوتا" → 2 (the counter joined on), "3" → 3, "1,000" → 1000.
 * A lone "نه" is "no", not nine, unless a counter, "و" or a scale follows.
 */
export function readNumber(words: string[], i: number): { n: number; len: number } | null {
  const first = words[i];
  if (first === undefined) return null;
  if (/^\d{1,3}(,\d{3})+$|^\d+$/.test(first)) return { n: +first.replace(/,/g, ""), len: 1 };
  if (first === "صفر") return { n: 0, len: 1 };
  if (first.length > 2 && first.endsWith("تا") && WORD.has(first.slice(0, -2))) return { n: WORD.get(first.slice(0, -2))!, len: 1 };
  let total = 0, k = i, scale = Infinity, seen = false;
  for (;;) {
    const g = group(words, k), at = g ? g.end : k, m = MULT[words[at]];
    let v: number, end: number;
    if (g && m && m < scale) { v = g.v * m; end = at + 1; scale = m; }
    else if (!g && m && m < scale) { v = m; end = k + 1; scale = m; }
    else if (g) { v = g.v; end = g.end; scale = 1; }
    else break;
    total += v; k = end; seen = true;
    if (scale === 1) break;
    const nextM = MULT[words[k + 1]];
    if (words[k] === "و" && (group(words, k + 1) || (nextM && nextM < scale))) { k++; continue; }
    break;
  }
  return seen ? { n: total, len: k - i } : null;
}
