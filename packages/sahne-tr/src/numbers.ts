// Turkish numbers in words: for timing a line, and for reading it aloud.

const ONES = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TENS = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
const SCALES: [number, string][] = [[1e9, "milyar"], [1e6, "milyon"], [1e3, "bin"]];

function hundreds(n: number): string[] {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10, out: string[] = [];
  if (h > 1) out.push(ONES[h]);
  if (h) out.push("yüz");
  if (t) out.push(TENS[t]);
  if (o) out.push(ONES[o]);
  return out;
}

/** Digit by digit: "0532" → "sıfır beş üç iki". */
export const sayDigits = (d: string): string => [...d].filter(c => c >= "0" && c <= "9").map(c => (c === "0" ? "sıfır" : ONES[+c])).join(" ");

/** A whole number: 15 → "on beş", 100 → "yüz", 1990 → "bin dokuz yüz doksan", 2000000 → "iki milyon". */
export function sayNumber(n: number): string {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `eksi ${sayNumber(-n)}`;
  n = Math.floor(n);
  if (n === 0) return "sıfır";
  if (n >= 1e12) return sayDigits(n.toFixed(0));
  const out: string[] = [];
  let rest = n;
  for (const [v, w] of SCALES) {
    const q = Math.floor(rest / v);
    if (q) { if (!(v === 1e3 && q === 1)) out.push(...hundreds(q)); out.push(w); }
    rest %= v;
  }
  out.push(...hundreds(rest));
  return out.join(" ");
}

/** The ordinal of a number in words: "iki" → "ikinci", "dört" → "dördüncü", "on" → "onuncu". */
export function ordinal(words: string): string {
  const v = /([aeıioöuü])[^aeıioöuü]*$/.exec(words)?.[1] ?? "i";
  const I = "aı".includes(v) ? "ı" : "ei".includes(v) ? "i" : "ou".includes(v) ? "u" : "ü";
  const base = words.endsWith("dört") ? `${words.slice(0, -1)}d` : words;
  return /[aeıioöuü]$/.test(base) ? `${base}nc${I}` : `${base}${I}nc${I}`;
}

/** A run of digits as written, leading zeros read one by one ("05" → "sıfır beş"). */
const whole = (d: string): string => (d.length > 1 && d[0] === "0") || d.length > 12 ? sayDigits(d) : sayNumber(+d);

/**
 * A numeral as written in a line: "15", "1990", "1.000" (thousands), "3,5" (decimal comma),
 * "10:30" or "10.30" (a clock time, "on otuz"), "%50" ("yüzde elli"); `ord` makes it an ordinal ("2." → "ikinci").
 */
export function sayNumeral(s: string, ord = false): string {
  let pre = "";
  if (s.startsWith("%")) { pre = "yüzde "; s = s.slice(1); }
  let out: string, m: RegExpExecArray | null;
  if ((m = /^(\d{1,2})[:.](\d{2})$/.exec(s)) && +m[1] <= 24 && +m[2] < 60) out = +m[2] ? `${sayNumber(+m[1])} ${whole(m[2])}` : sayNumber(+m[1]);
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) out = sayNumber(+s.replace(/\./g, ""));
  else if ((m = /^(\d+),(\d+)$/.exec(s))) out = `${whole(m[1])} virgül ${whole(m[2])}`;
  else if (/^\d+$/.test(s)) out = whole(s);
  else out = s.replace(/\d+/g, d => ` ${whole(d)} `).replace(/[^\p{L}]+/gu, " ").trim();
  return pre + (ord ? ordinal(out) : out);
}

const VALUE = new Map<string, number>([...ONES.map((w, v) => [w, v] as const).slice(1), ...TENS.map((w, v) => [w, v * 10] as const).slice(1)]);
const SCALE = new Map<string, number>([["yüz", 100], ["bin", 1e3], ["milyon", 1e6], ["milyar", 1e9]]);

/**
 * The number written or said at `words[i]`, in digits ("2", "1.000") or in words over one or
 * more words ("iki", "on beş", "bin dokuz yüz doksan"), and how many words it takes; null when
 * there is none. `words` are lower case. "bir" is read as 1: the caller decides whether it is the article.
 */
export function readNumber(words: string[], i: number): { n: number; len: number } | null {
  const w0 = words[i];
  if (w0 === undefined) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(w0)) return { n: +w0.replace(/\./g, ""), len: 1 };
  if (/^\d+$/.test(w0)) return { n: +w0, len: 1 };
  let total = 0, cur = 0, len = 0;
  for (let k = i; k < words.length; k++) {
    const w = words[k], v = VALUE.get(w), s = SCALE.get(w);
    if (v !== undefined) cur += v;
    else if (s === 100) cur = (cur || 1) * 100;
    else if (s !== undefined) { total += (cur || 1) * s; cur = 0; }
    else break;
    len++;
  }
  return len ? { n: total + cur, len } : null;
}
