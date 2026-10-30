// German numbers in words: for timing a line, for reading it aloud, and for reading a number back.
// German writes a number below a million as one word (einundzwanzig, zweitausenddreihundert) and the
// tens after the ones (21 is "one and twenty"); a million and a billion are words of their own.

const ONES = ["null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
const TEENS = ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const TENS = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

/** 1–99 as one word; the last "ein" is "eins" when it stands alone (`end`). */
function two(n: number, end: boolean): string {
  if (n < 10) return n === 1 && end ? "eins" : ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10), o = n % 10;
  return o ? `${o === 1 && !end ? "ein" : ONES[o]}und${TENS[t]}` : TENS[t];
}

/** 1–999 as one word. */
function three(n: number, end: boolean): string {
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? (h === 1 ? "hundert" : `${ONES[h]}hundert`) : "") + (r ? two(r, end) : "");
}

/** Digit by digit: "0532" → "null fünf drei zwei". */
export const sayDigits = (d: string): string => [...d].filter(c => c >= "0" && c <= "9").map(c => ONES[+c]).join(" ").replace(/\bein\b/g, "eins");

/** A whole number: 15 → "fünfzehn", 100 → "hundert", 21 → "einundzwanzig", 1990 → "eintausendneunhundertneunzig", 2000000 → "zwei Millionen". */
export function sayNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `minus ${sayNumber(-n)}`;
  n = Math.floor(n);
  if (n === 0) return "null";
  if (n >= 1e15) return sayDigits(n.toFixed(0));
  const out: string[] = [];
  for (const [v, one, many] of [[1e12, "eine Billion", "Billionen"], [1e9, "eine Milliarde", "Milliarden"], [1e6, "eine Million", "Millionen"]] as const) {
    const q = Math.floor(n / v);
    if (q) out.push(q === 1 ? one : `${sayNumber(q)} ${many}`);
    n %= v;
  }
  if (n) {
    const th = Math.floor(n / 1000), r = n % 1000;
    out.push((th ? (th === 1 ? "eintausend" : `${three(th, false)}tausend`) : "") + (r ? three(r, true) : ""));
  }
  return out.join(" ");
}

/** The ordinal of a number as an adjective in -e: 1 → "erste", 3 → "dritte", 8 → "achte", 21 → "einundzwanzigste". */
export function ordinal(n: number): string {
  const tail = n % 100, words = sayNumber(n);
  if (tail === 1) return words.replace(/eins$/, "erste");
  if (tail === 3) return words.replace(/drei$/, "dritte");
  if (tail === 7) return words.replace(/sieben$/, "siebte");
  if (tail === 8) return `${words}e`;
  return `${words}${tail >= 1 && tail <= 19 ? "te" : "ste"}`;
}

/** A run of digits as written, leading zeros read one by one ("05" → "null fünf"). */
const whole = (d: string): string => (d.length > 1 && d[0] === "0") || d.length > 15 ? sayDigits(d) : sayNumber(+d);

/**
 * A numeral as written in a line: "15", "1990", "1.000" (thousands), "3,5" (decimal comma), "10:30" or "10.30"
 * (a clock time, "zehn Uhr dreißig"), "50%" ("fünfzig Prozent"); `ord` makes it an ordinal ("2." → "zweite").
 */
export function sayNumeral(s: string, ord = false): string {
  let post = "";
  if (s.endsWith("%")) { post = " Prozent"; s = s.slice(0, -1); }
  let out: string, m: RegExpExecArray | null;
  if ((m = /^(\d{1,2})[:.](\d{2})$/.exec(s)) && +m[1] <= 24 && +m[2] < 60) out = +m[2] ? `${sayNumber(+m[1]).replace(/^eins$/, "ein")} Uhr ${whole(m[2])}` : `${sayNumber(+m[1]).replace(/^eins$/, "ein")} Uhr`;
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) out = sayNumber(+s.replace(/\./g, ""));
  else if ((m = /^(\d+),(\d+)$/.exec(s))) out = `${whole(m[1])} Komma ${whole(m[2])}`;
  else if (/^\d+$/.test(s)) out = ord && s.length < 10 ? ordinal(+s) : whole(s);
  else out = s.replace(/\d+/g, d => ` ${whole(d)} `).replace(/[^\p{L}]+/gu, " ").trim();
  return out + post;
}

// ---- reading numbers back

const VALUE = new Map<string, number>();
ONES.forEach((w, v) => { if (v) VALUE.set(w, v); });
VALUE.set("eins", 1); VALUE.set("zwo", 2);
TEENS.forEach((w, k) => VALUE.set(w, 10 + k));
TENS.forEach((w, k) => { if (w) VALUE.set(w, k * 10); });
VALUE.set("dreissig", 30);

const SMALL = [...ONES.slice(1)].join("|"), TENS_RE = [...TENS.filter(Boolean), "dreissig"].join("|");
const UNDER100 = new RegExp(`^(?:(${SMALL})und)?(${TENS_RE})$`);

function under100(s: string): number | null {
  const v = VALUE.get(s);
  if (v !== undefined) return v;
  const m = UNDER100.exec(s);
  return m ? (m[1] ? VALUE.get(m[1])! : 0) + VALUE.get(m[2])! : null;
}

function under1000(s: string): number | null {
  if (!s) return 0;
  const i = s.indexOf("hundert");
  if (i < 0) return under100(s);
  const h = i === 0 ? 1 : VALUE.get(s.slice(0, i)), r = s.slice(i + 7).replace(/^und/, "");
  const rest = under100(r) ?? (r ? null : 0);
  return h === undefined || rest === null || h > 9 ? null : h * 100 + rest;
}

/** One German number word: "einundzwanzig", "zweitausenddreihundert", "hundert"; null when it is none. */
function compound(s: string): number | null {
  if (!s || s === "null") return s === "null" ? 0 : null;
  const i = s.indexOf("tausend");
  if (i < 0) return under1000(s);
  const left = i === 0 ? 1 : under1000(s.slice(0, i)) ?? (s.slice(0, i) === "ein" ? 1 : null), right = under1000(s.slice(i + 7));
  return left === null || right === null || left === 0 ? null : left * 1000 + right;
}

const LARGE: [RegExp, number][] = [[/^billion(?:en)?$/, 1e12], [/^milliarde(?:n)?$/, 1e9], [/^million(?:en)?$/, 1e6]];

/**
 * The number written or said at `words[i]`, in digits ("2", "1.000") or in words ("zwei", "einundzwanzig",
 * "zwei Millionen dreihunderttausend"), and how many words it takes; null when there is none. `words` are lower
 * case. "ein" and "eine" read as 1: the caller decides whether it is the article.
 */
export function readNumber(words: string[], i: number): { n: number; len: number } | null {
  const w0 = words[i];
  if (w0 === undefined) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(w0)) return { n: +w0.replace(/\./g, ""), len: 1 };
  if (/^\d+$/.test(w0)) return { n: +w0, len: 1 };
  const w = w0.replace(/ß/g, "ss").replace(/^(ein)(?:e|en|em|er|es)$/, "$1");
  let n = w === "ein" || w === "eine" ? 1 : compound(w);
  if (n === null) return null;
  let len = 1;
  const big = LARGE.find(([re]) => re.test(words[i + 1] ?? ""));
  if (big && n > 0) {
    n *= big[1]; len = 2;
    const rest = compound((words[i + 2] ?? "").replace(/ß/g, "ss"));
    if (rest) { n += rest; len = 3; }
  }
  return { n, len };
}
