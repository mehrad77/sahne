// English numbers in words (British: "one hundred and five"): for timing a line, for reading it
// aloud, and for the story lints that read a number out of a line.

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES: [number, string][] = [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];

/** 1–99 in words. */
function below100(n: number): string[] {
  if (n < 20) return n ? [ONES[n]] : [];
  return [TENS[Math.floor(n / 10)], ...(n % 10 ? [ONES[n % 10]] : [])];
}
function below1000(n: number): string[] {
  const h = Math.floor(n / 100), r = n % 100;
  return [...(h ? [ONES[h], "hundred"] : []), ...(h && r ? ["and"] : []), ...below100(r)];
}

/** Digit by digit: "0532" → "zero five three two" (a leading or inner 0 is "zero"). */
export const sayDigits = (d: string): string => [...d].filter(c => c >= "0" && c <= "9").map(c => (c === "0" ? "zero" : ONES[+c])).join(" ");

/** A whole number: 15 → "fifteen", 105 → "one hundred and five", 1990 → "one thousand nine hundred and ninety". */
export function sayNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `minus ${sayNumber(-n)}`;
  n = Math.floor(n);
  if (n === 0) return "zero";
  if (n >= 1e12) return sayDigits(n.toFixed(0));
  const out: string[] = [];
  let rest = n;
  for (const [v, w] of SCALES) {
    const q = Math.floor(rest / v);
    if (q) out.push(...below1000(q), w);
    rest %= v;
  }
  // "one thousand and one", "two million and five", but "one thousand one hundred"
  if (rest) out.push(...(out.length && rest < 100 ? ["and"] : []), ...below1000(rest));
  return out.join(" ");
}

/** A year said the way English says it: 1990 "nineteen ninety", 1905 "nineteen oh five", 1900 "nineteen hundred", 2024 "twenty twenty four". */
export function sayYear(n: number): string {
  const hi = Math.floor(n / 100), lo = n % 100;
  if (!lo) return `${sayNumber(hi)} hundred`;
  return `${sayNumber(hi)} ${lo < 10 ? `oh ${ONES[lo]}` : sayNumber(lo)}`;
}

const IRREGULAR: Record<string, string> = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
/** The ordinal of the last word of a number in words: "two" → "second", "twenty one" → "twenty first", "forty" → "fortieth". */
export function ordinal(words: string): string {
  const parts = words.split(" "), last = parts[parts.length - 1];
  parts[parts.length - 1] = IRREGULAR[last] ?? (last.endsWith("y") ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return parts.join(" ");
}

/** A run of digits as written; leading zeros read one by one ("05" → "zero five"). */
const whole = (d: string): string => (d.length > 1 && d[0] === "0") || d.length > 12 ? sayDigits(d) : sayNumber(+d);

/**
 * A numeral as written in a line: "15", "1990" (a year), "1,000" (thousands), "3.5" ("three point five"),
 * "10:30" (a clock time, "ten thirty"; "10:05" is "ten oh five"; "4:00" is "four o clock", as `sayWord` says o'clock), "50%" ("fifty percent"); `ord` makes it an ordinal.
 */
export function sayNumeral(s: string, ord = false): string {
  let post = "";
  if (s.endsWith("%")) { post = " percent"; s = s.slice(0, -1); }
  let out: string, m: RegExpExecArray | null;
  if ((m = /^(\d{1,2}):(\d{2})$/.exec(s)) && +m[1] <= 24 && +m[2] < 60) out = +m[2] ? `${sayNumber(+m[1])} ${m[2][0] === "0" ? `oh ${ONES[+m[2]]}` : sayNumber(+m[2])}` : `${sayNumber(+m[1])} o clock`;
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) out = sayNumber(+s.replace(/,/g, ""));
  else if ((m = /^(\d+)\.(\d+)$/.exec(s))) out = `${whole(m[1])} point ${sayDigits(m[2])}`;
  else if (/^\d{4}$/.test(s) && !ord && ((+s >= 1100 && +s <= 1999) || (+s >= 2010 && +s <= 2099))) out = sayYear(+s);
  else if (/^\d+$/.test(s)) out = whole(s);
  else out = s.replace(/\d+/g, d => ` ${whole(d)} `).replace(/[^\p{L}]+/gu, " ").trim();
  return (ord ? ordinal(out) : out) + post;
}

const WORD = new Map<string, number>();
ONES.forEach((w, i) => { if (w) WORD.set(w, i); });
TENS.forEach((w, i) => { if (w) WORD.set(w, i * 10); });
WORD.set("zero", 0); WORD.set("nought", 0);
const MULT: Record<string, number> = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 };

/**
 * A number said from `words[i]` on (lower-case words, or digits as written): its value and how many words it takes.
 * "two" → 2, "twenty five" → 25, "a hundred and five" → 105, "3" → 3, "1,000" → 1000. Years ("nineteen ninety") read as the first number.
 */
export function readNumber(words: string[], i: number): { n: number; len: number } | null {
  const first = words[i];
  if (first === undefined) return null;
  if (/^\d{1,3}(,\d{3})+$|^\d+$/.test(first)) return { n: +first.replace(/,/g, ""), len: 1 };
  let total = 0, cur = 0, len = 0, seen = false, j = i;
  const pieces = (w: string) => w.split("-");
  if (first === "a" && words[i + 1] in MULT) { cur = 1; seen = true; len = 1; j = i + 1; }
  for (; j < words.length; j++) {
    const ps = pieces(words[j]);
    if (!ps.every(p => WORD.has(p) || p in MULT)) {
      // "hundred and five": a lone "and" joins what follows
      if (words[j] === "and" && seen && j + 1 < words.length && pieces(words[j + 1]).every(p => WORD.has(p)) && (cur >= 100 || total >= 1000 || cur === 0 && total)) { len++; continue; }
      break;
    }
    // a number word cannot follow one of its own size ("two three")
    let ok = true, c = cur;
    for (const p of ps) {
      if (p in MULT) {
        const m = MULT[p];
        if (!c && !total) { ok = false; break; }
        if (m === 100) c = (c || 1) * 100; else { total += (c || 1) * m; c = 0; }
      } else {
        const v = WORD.get(p)!, r = c % 100;
        // ones follow a hundred or a tens word, teens and tens follow a hundred; zero stands alone
        if (v === 0 ? seen || ps.length > 1 : v < 10 ? !(r === 0 || (r >= 20 && r % 10 === 0)) : r !== 0) { ok = false; break; }
        c += v;
      }
    }
    if (!ok) break;
    cur = c; seen = true; len++;
  }
  return seen ? { n: total + cur, len } : null;
}
