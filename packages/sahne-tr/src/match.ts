// Whether a word of a line is a form of a `link` token (a dictionary form): ekmeği, ekmekler,
// ekmekte → ekmek; kitabı → kitap; suyu → su; İsmail'in → İsmail. The director uses it to time a
// gesture's stroke to the word that names its target.
//
// The heuristic: the word is the token, or a stem of it, followed by a remainder that parses as a
// chain of Turkish noun endings (plural, possessive, case, -ki, copula, person), with the buffer
// letters each ending takes after a vowel or a consonant, in vowel harmony with what precedes it.
// Stems are the token itself, its softened form before a vowel (kitap → kitab-, ekmek → ekmeğ-,
// renk → reng-), the high vowel dropped before a vowel (ağız → ağz-, burun → burn-), a doubled final
// consonant for a few loans (hak → hakk-), and suy- for su. Proper names keep their spelling and take
// the endings after an apostrophe.
//
// Deliberately not forms: derived words, which name a different thing (ekmekçi the baker, kitaplık
// the bookcase, sütlü, şekersiz, çaydanlık, sucuk), and the equative -CA (Türkçe is not Türk).
//
// Harmony is loosened where loans break it: after a stem ending in a back vowel and l (rol → rolü,
// but also okul, so okulü would pass), after a few loans (saat → saati), and after an apostrophe,
// where any harmony goes (foreign names). Known misses: a homograph that is also an inflected form
// matches (ada is ad + a, ata is at + a, kalem is kale + m). Verb tokens are not supported, and the
// plural of a compound token (çay bardakları for "çay bardağı") is missed.

import { isVowel, lowerTr } from "./text.ts";

interface Ending {
  id: string;
  /** Slots keep the order: plural 1, possessive 2, case 3, -ki 4, copula 5, person 6. */
  slot: number;
  forms: string[];
  /** Only after a vowel, or only after a consonant. */
  after?: "V" | "C";
  /** Case endings take n after a third-person possessive (kitabını, kitabında). */
  p3?: "only" | "never";
  /** A third-person possessive. */
  setsP3?: boolean;
  /** A possessive that joins a vowel directly (kapım, kapısı): su takes suy- instead (suyum, suyu). */
  vposs?: boolean;
  /** Only right after one of these endings. */
  prev?: string[];
}

/** Expand a pattern in every vowel harmony: I → ı i u ü and A → a e (in step), D → d t, C → c ç. */
function forms(...pats: string[]): string[] {
  const out = new Set<string>();
  for (const pat of pats) {
    for (const [A, I] of [["a", "ı"], ["e", "i"], ["a", "u"], ["e", "ü"]]) {
      let alts = [""];
      for (const ch of pat) {
        const opts = ch === "A" ? [A] : ch === "I" ? [I] : ch === "D" ? ["d", "t"] : ch === "C" ? ["c", "ç"] : [ch];
        alts = alts.flatMap(s => opts.map(x => s + x));
      }
      for (const s of alts) out.add(s);
    }
  }
  return [...out];
}

const E = (id: string, slot: number, pat: string, o: Partial<Ending> = {}): Ending => ({ id, slot, forms: forms(pat), ...o });

const ENDINGS: Ending[] = [
  E("pl", 1, "lAr"),
  E("p1s", 2, "Im", { after: "C" }), E("p1s", 2, "m", { after: "V", vposs: true }),
  E("p2s", 2, "In", { after: "C" }), E("p2s", 2, "n", { after: "V", vposs: true }),
  E("p3s", 2, "I", { after: "C", setsP3: true }), E("p3s", 2, "sI", { after: "V", setsP3: true, vposs: true }),
  E("p1p", 2, "ImIz", { after: "C" }), E("p1p", 2, "mIz", { after: "V", vposs: true }),
  E("p2p", 2, "InIz", { after: "C" }), E("p2p", 2, "nIz", { after: "V", vposs: true }),
  E("acc", 3, "I", { after: "C", p3: "never" }), E("acc", 3, "yI", { after: "V", p3: "never" }), E("acc", 3, "nI", { p3: "only" }),
  E("dat", 3, "A", { after: "C", p3: "never" }), E("dat", 3, "yA", { after: "V", p3: "never" }), E("dat", 3, "nA", { p3: "only" }),
  E("loc", 3, "DA", { p3: "never" }), E("loc", 3, "nDA", { p3: "only" }),
  E("abl", 3, "DAn", { p3: "never" }), E("abl", 3, "nDAn", { p3: "only" }),
  E("gen", 3, "In", { after: "C" }), E("gen", 3, "nIn", { after: "V" }),
  E("ins", 3, "lA", { after: "C" }), E("ins", 3, "ylA", { after: "V" }),
  E("ki", 4, "ki", { prev: ["loc", "gen"] }),
  E("cop", 5, "DIr"),
  E("past", 5, "DI", { after: "C" }), E("past", 5, "yDI", { after: "V" }),
  E("evid", 5, "mIş", { after: "C" }), E("evid", 5, "ymIş", { after: "V" }),
  E("cond", 5, "sA", { after: "C" }), E("cond", 5, "ysA", { after: "V" }),
  E("ken", 5, "ken", { after: "C" }), E("ken", 5, "yken", { after: "V" }),
  E("pers", 6, "Im", { after: "C" }), E("pers", 6, "yIm", { after: "V" }), E("pers", 6, "sIn"),
  E("pers", 6, "Iz", { after: "C" }), E("pers", 6, "yIz", { after: "V" }), E("pers", 6, "sInIz"), E("pers", 6, "lAr"),
  { id: "pers", slot: 6, forms: ["m", "n", "k", ...forms("nIz")], after: "V", prev: ["past", "cond"] },
];

/** How far the first ending may stray from the stem's harmony: not at all, to the front vowels, or anywhere. */
type Loose = "" | "front" | "any";
interface State { slot: number; p3: boolean; prev: string; endsV: boolean; ki: boolean; noVPoss: boolean; last: string; loose: Loose }

const BACK = "aıou", ROUND = "oöuü", INVARIANT = new Set(["ki", "ken", "yken"]);
const lastVowel = (s: string) => [...s].reverse().find(isVowel) ?? "";

/** Whether ending `f` follows vowel `prev`: A → a after a back vowel, e after a front one; I → ı i u ü. */
function harmonic(prev: string, f: string, loose: Loose): boolean {
  const v = [...f].find(isVowel);
  if (!prev || !v || loose === "any" || INVARIANT.has(f)) return true;
  const round = ROUND.includes(prev);
  const ok = (back: boolean) => v === ("ae".includes(v) ? (back ? "a" : "e") : back ? (round ? "u" : "ı") : round ? "ü" : "i");
  return ok(BACK.includes(prev)) || (loose === "front" && ok(false));
}

/** Whether `r` is a chain of noun endings, in slot order, each allowed after what comes before it. */
function endings(r: string, pos: number, st: State, depth = 0): boolean {
  if (pos === r.length) return true;
  if (depth > 8) return false;
  for (const e of ENDINGS) {
    if (e.slot <= st.slot || (e.after === "V" && !st.endsV) || (e.after === "C" && st.endsV)) continue;
    if ((e.p3 === "only" && !st.p3) || (e.p3 === "never" && st.p3)) continue;
    if ((e.prev && !e.prev.includes(st.prev)) || (e.id === "ki" && st.ki) || (e.vposs && st.noVPoss)) continue;
    for (const f of e.forms) {
      if (!r.startsWith(f, pos) || !harmonic(st.last, f, st.loose)) continue;
      const ki = e.id === "ki";
      // after -ki, a case ending takes n again (ekmektekini)
      const next: State = { slot: ki ? 2 : e.slot, p3: ki || !!e.setsP3, prev: e.id, endsV: isVowel(f[f.length - 1]), ki: st.ki || ki, noVPoss: false, last: lastVowel(f) || st.last, loose: "" };
      if (endings(r, pos + f.length, next, depth + 1)) return true;
    }
  }
  return false;
}

/** Arabic loans that double their last consonant before a vowel (hakkı, sırrı). */
const DOUBLE = new Set(["af", "hak", "his", "hat", "had", "ret", "sır", "tıp", "zan", "zıt", "üs", "şık"]);
const SOFT: Record<string, string> = { p: "b", ç: "c", t: "d", k: "ğ", g: "ğ" };
/** Loans whose endings take front vowels after a back one (saati, kalbi, harfi). */
const FRONT = new Set(["saat", "dikkat", "seyahat", "hakikat", "kalp", "harf", "harp"]);

/** The stems a token's endings attach to; `vowel` stems only appear before a vowel. */
export function stems(t: string): { s: string; vowel: boolean }[] {
  const out = [{ s: t, vowel: false }], last = t[t.length - 1];
  if (SOFT[last]) out.push({ s: t.slice(0, -1) + SOFT[last], vowel: true });
  if (last === "k" && t[t.length - 2] === "n") out.push({ s: `${t.slice(0, -1)}g`, vowel: true });
  const drop = /^(.*[aeıioöuü].*[^aeıioöuü])[ıiuü]([^aeıioöuü])$/.exec(t);
  if (drop) out.push({ s: drop[1] + drop[2], vowel: true });
  if (DOUBLE.has(t)) out.push({ s: t + last, vowel: true });
  if (t === "su") out.push({ s: "suy", vowel: true });
  return out;
}

const clean = (s: string) =>
  lowerTr(s).replace(/[’ʼ‘`´]/g, "'").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

const start = (stem: string, compound: boolean, noVPoss: boolean, loose: Loose): State =>
  ({ slot: 0, p3: compound, prev: "", endsV: isVowel(stem[stem.length - 1]), ki: false, noVPoss, last: lastVowel(stem), loose });

/**
 * Whether `word`, as written in a line, is a form of `token`. Case-insensitive the Turkish way.
 * A token of several words ("çay bardağı") is matched on its last word, the one that takes the endings.
 */
export function match(word: string, token: string): boolean {
  const w = clean(word), parts = clean(token).split(/\s+/).filter(Boolean);
  if (!w || !parts.length) return false;
  const t = parts[parts.length - 1], compound = parts.length > 1;
  if (w === t) return true;
  const ap = w.indexOf("'");
  if (ap > 0) {
    const stem = w.slice(0, ap), rest = w.slice(ap + 1).replace(/'/g, "");
    return stem === t && (!rest || endings(rest, 0, start(stem, compound, t === "su", "any")));
  }
  const loose: Loose = FRONT.has(t) || /[aıou]l$/.test(t) ? "front" : "";
  for (const { s, vowel } of stems(t)) {
    if (w.length <= s.length || !w.startsWith(s)) continue;
    const rest = w.slice(s.length);
    if (vowel && !isVowel(rest[0])) continue;
    if (endings(rest, 0, start(s, compound && s === t, s === "su", loose))) return true;
  }
  return false;
}

/** The demonstrative a word is a form of, if any: bu (here), şu (there, pointing), o (over there). */
export function deixis(word: string): "bu" | "şu" | "o" | null {
  const w = clean(word);
  const m = /^(bu|şu|o)(?:n(?:u|a|da|dan|un|lar(?:ı|a|da|dan|ın)?)|ra(?:sı|da|ya|dan)?)?$/.exec(w);
  if (m) return m[1] as "bu" | "şu" | "o";
  return w === "böyle" ? "bu" : w === "şöyle" ? "şu" : w === "öyle" ? "o" : null;
}
