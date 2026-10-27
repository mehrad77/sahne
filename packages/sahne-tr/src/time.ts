// Clock times said in a line, for the story lint that keeps every clock on stage showing the time
// that is said (Kumru's STORIES_STAGE.md §4): "Saat on." "Saat üç buçuk." "Ona çeyrek var." "İkiyi on
// geçiyor." "Saat 10:30." A1 Ünite 5 (Saat kaç?) is the grammar.

import { lowerTr } from "./text.ts";
import { readNumber } from "./numbers.ts";

export interface ClockTime { h: number; m: number }

const HOURS = ["bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz", "on", "on bir", "on iki"];
const BACK = /[aıou][^aeıioöuü]*$/;
/** dört → dörd- before a vowel. */
const soft = (w: string) => (w.endsWith("dört") ? `${w.slice(0, -1)}d` : w);
const vowelEnd = (w: string) => /[aeıioöuü]$/.test(w);
function dative(w: string) { const A = BACK.test(w) ? "a" : "e"; return vowelEnd(w) ? `${w}y${A}` : `${soft(w)}${A}`; }
function accusative(w: string) {
  const v = /([aeıioöuü])[^aeıioöuü]*$/.exec(w)?.[1] ?? "i";
  const I = "aı".includes(v) ? "ı" : "ei".includes(v) ? "i" : "ou".includes(v) ? "u" : "ü";
  return vowelEnd(w) ? `${w}y${I}` : `${soft(w)}${I}`;
}
/** "on bire" → [11, "dat"]: an hour (1–12) in the nominative, dative or accusative, over one or two words. */
const FORMS = new Map<string, [number, "nom" | "dat" | "acc"]>();
HOURS.forEach((w, k) => { FORMS.set(w, [k + 1, "nom"]); FORMS.set(dative(w), [k + 1, "dat"]); FORMS.set(accusative(w), [k + 1, "acc"]); });

/** The hour at `words[i]`: a word form from FORMS, or digits with a suffix after the apostrophe ("3'e", "10'u"). */
function hourAt(words: string[], i: number): { h: number; c: "nom" | "dat" | "acc"; len: number } | null {
  const two = words[i + 1] !== undefined ? FORMS.get(`${words[i]} ${words[i + 1]}`) : undefined;
  if (two) return { h: two[0], c: two[1], len: 2 };
  const one = FORMS.get(words[i]);
  if (one) return { h: one[0], c: one[1], len: 1 };
  const d = /^(\d{1,2})(?:'(.+))?$/.exec(words[i] ?? "");
  if (d && +d[1] >= 0 && +d[1] <= 24) {
    const s = d[2] ?? "";
    return { h: +d[1], c: /^y?[ae]$/.test(s) ? "dat" : /^y?[ıiuü]$/.test(s) ? "acc" : "nom", len: 1 };
  }
  return null;
}

/** Minutes at `words[i]`: çeyrek (15), or a number up to 59. */
function minutesAt(words: string[], i: number): { m: number; len: number } | null {
  if (words[i] === "çeyrek") return { m: 15, len: 1 };
  const r = readNumber(words, i);
  return r && r.n > 0 && r.n < 60 ? { m: r.n, len: r.len } : null;
}

/** Every clock time said in `text`, in order. A bare number counts only after "saat" ("iki ekmek" is no time). */
export function readClock(text: string): ClockTime[] {
  const out: ClockTime[] = [];
  const low = lowerTr(text).replace(/[’ʼ‘]/g, "'");
  for (const m of low.matchAll(/(?<![\d.:])(\d{1,2})[:.](\d{2})(?![\d]|[.:]\d)/g)) if (+m[1] <= 24 && +m[2] < 60) out.push({ h: +m[1], m: +m[2] });
  if (out.length) return out;
  const words = low.replace(/(\d)[:.](\d)/g, "$1_$2").split(/[^\p{L}\p{N}'_]+/u).filter(Boolean).map(w => w.replace(/^'+|'+$/g, ""));
  for (let i = 0; i < words.length; i++) {
    const saat = words[i - 1] === "saat";
    if (words[i] === "yarım" && saat) { out.push({ h: 12, m: 30 }); continue; }
    const h = hourAt(words, i);
    if (!h) continue;
    let j = i + h.len;
    if (h.c === "nom" && words[j] === "buçuk") { out.push({ h: h.h, m: 30 }); i = j; continue; }
    if (h.c !== "nom") {
      const mm = minutesAt(words, j);
      if (mm) {
        const k = j + mm.len, verb = words[k] ?? "";
        if (h.c === "dat" && /^(var|kala|kaldı)/.test(verb)) { out.push({ h: h.h === 1 ? 12 : h.h - 1, m: 60 - mm.m }); i = k; continue; }
        if (h.c === "acc" && /^(geç|geçiyor|geçe)/.test(verb)) { out.push({ h: h.h, m: mm.m }); i = k; continue; }
      }
      continue;
    }
    if (saat) {
      const mm = minutesAt(words, j);
      if (mm) { out.push({ h: h.h, m: mm.m }); j += mm.len; } else out.push({ h: h.h, m: 0 });
      i = j - 1;
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
