// Turkish word resolving for the story check: whether a token of a story's text is a form of a card, a
// name, a particle or a number. sahne-tr's `match` handles noun endings; verb forms are matched here by
// a loose stem-plus-ending test (verb endings in sahne-tr are a backlog item).

import { lowerTr, match } from "sahne-tr";

export const PARTICLES = new Set(["mi", "mı", "mu", "mü", "de", "da", "te", "ta", "ki", "ve", "ile", "ya", "ama", "ne", "hem", "çok", "bir", "bu", "şu", "o", "ben", "sen", "biz", "siz", "onlar", "bana", "sana", "ona", "onu", "onun", "onda", "ondan", "onlara", "onları", "evet", "hayır", "lütfen", "tamam"]);
const NUMBERS = new Set("sıfır bir iki üç dört beş altı yedi sekiz dokuz on yirmi otuz kırk elli altmış yetmiş seksen doksan yüz bin birinci ikinci üçüncü dördüncü beşinci altıncı yedinci sekizinci dokuzuncu onuncu".split(" "));

/** The Turkish words of a text, lower-cased, each name's apostrophe tail cut (Kerim'in → kerim). */
export function words(text: string): string[] {
  return lowerTr(text.replace(/[’‘`´]/g, "'")).split(/[^\p{L}'0-9]+/u).map(w => w.split("'")[0]).filter(w => w && !/^[0-9]+$/.test(w));
}

const VERB_END = /^(mak|mek)$/;
const VOWEL = /[aeıioöuü]/;
/** How a verb's suffixes can begin (a vowel, -mA, -DI, -r, -yor, -sA, -n, -lI, -cAk, -ken), or nothing: alfabe is not al+fabe. */
const SUFFIX_START = /^($|[aeıioöuümdtrysnlcçk])/;
/**
 * A verb in a loose sense: the token is the stem and a short remainder. A stem that ends in a vowel may drop it
 * before -Iyor (bekle → bekliyor); a final t or k may soften before a vowel (git → gidiyor, bırak → bırakıyor,
 * bırağı-), and de and ye become di and yi before -yor. A stem shorter than 3 letters after that never matches, so `gelmek` does not make every "ge…" a word.
 */
function verbForm(lemma: string, token: string): boolean {
  if (!VERB_END.test(lemma.slice(-3))) return false;
  const stem = lemma.slice(0, -3);
  if (stem.length < 2) return false;
  const rest = (s: string) => token.slice(s.length);
  const ok = (s: string, cond: (r: string) => boolean) => s.length >= 2 && token.startsWith(s) && token.length - s.length <= 9 && cond(rest(s));
  if (ok(stem, r => SUFFIX_START.test(r))) return true;
  if (/^(de|ye)$/.test(stem) && ok(stem[0] + "i", r => /^yor/.test(r))) return true; // diyor, yiyor
  if (VOWEL.test(stem.slice(-1)) && stem.length >= 3 && ok(stem.slice(0, -1), r => /^[ıiuü]yor/.test(r))) return true;
  if (/t$/.test(stem) && ok(stem.replace(/t$/, "d"), r => VOWEL.test(r[0] ?? ""))) return true;
  if (/k$/.test(stem) && ok(stem.replace(/k$/, "ğ"), r => VOWEL.test(r[0] ?? ""))) return true;
  return false;
}

export type Resolver = (token: string) => boolean;

/**
 * A resolver for a list of dictionary forms (cards' Turkish, glosses, names), plus numbers and particles. A token
 * resolves when it is an entry, or a form of one: `match(token, entry)`, the word as written first (fırının → fırın).
 */
export function resolver(entries: Iterable<string>, opts: { particles?: boolean } = {}): Resolver {
  const buckets = new Map<string, string[]>();
  const exact = new Set<string>();
  for (const e of entries) for (const w of words(e)) {
    exact.add(w);
    const keys = new Set([w.slice(0, 2)]);
    if (VERB_END.test(w.slice(-3))) {
      const stem = w.slice(0, -3);
      keys.add(stem.replace(/t$/, "d").replace(/k$/, "ğ").slice(0, 2)); // et → ed(iyor)
      if (/^(de|ye)$/.test(stem)) keys.add(stem[0] + "i"); // diyor, yiyor
    }
    for (const k of keys) (buckets.get(k) ?? buckets.set(k, []).get(k)!).push(w);
  }
  return token => {
    if (exact.has(token) || NUMBERS.has(token) || (opts.particles !== false && PARTICLES.has(token))) return true;
    for (const w of buckets.get(token.slice(0, 2)) ?? []) if (verbForm(w, token) || (w.length >= 2 && token.startsWith(w.slice(0, 2)) && match(token, w))) return true;
    return false;
  };
}
