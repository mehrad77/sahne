// Whether a word of a line is a form of a `link` token given in its dictionary form: نان, نان‌ها, نانی, نان‌هایم,
// نانم, نانمان, نانه. A Persian noun takes its endings one after the other, in this order, each optional:
//
//   plural        ها  ان  ات  (and the colloquial ا)     the ezafe or indefinite ی (ای, یی after a vowel)
//   possessive    م ت ش مان تان شان  (ام ات اش after a vowel or silent ه)
//   copula        است  ست  ه  ام  ایم  اید  اند  یم  ید  ند
//
// ZWNJ and the spaces a writer leaves out or adds are no matter (`lowerFa` drops ZWNJ; a heard "نان ها" is two
// words, which the line matcher joins). Stems change in a few places: a silent ه becomes گ before ان (بچه → بچگان)
// or goes before ات (کلمه → کلمات), and a vowel takes ی before ان (آقا → آقایان).
//
// Known misses: verbs (می‌خرم is not a form of خریدن), the Arabic broken plurals (کتب of کتاب), the colloquial
// object marker run on to the noun (نونو for نان را), را as a separate word (it is a word, not a form), and
// a token of two words where the first takes the ending (the head noun of an ezafe).

import { lowerFa } from "./text.ts";

/** What may follow a stem, in order. */
const CHAIN = /^(?:ها|ان|ات|ا)?(?:ای|یی|ی)?(?:[یا]?(?:مان|تان|شان|م|ت|ش))?(?:است|ست|ه|ام|ایم|اید|اند|یم|ید|ند)?$/;

const clean = (s: string): string => lowerFa(s).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/** Whether `w` is `t` with endings. */
function ends(w: string, t: string): boolean {
  if (w === t) return true;
  if (w.startsWith(t) && CHAIN.test(w.slice(t.length))) return true;
  // a vowel takes ی before ان: آقا → آقایان
  if (/[او]$/.test(t) && w.startsWith(`${t}یان`) && CHAIN.test(w.slice(t.length + 1))) return true;
  if (t.endsWith("ه")) {
    const stem = t.slice(0, -1);
    // بچه → بچگان, بچگانم; کلمه → کلمات
    if (w.startsWith(`${stem}گان`) && CHAIN.test(w.slice(stem.length + 1))) return true;
    if (w.startsWith(`${stem}ات`) && CHAIN.test(w.slice(stem.length + 2))) return true;
  }
  return false;
}

/**
 * Whether `word`, as written in a line, is a form of `token`: its endings (above), with or without ZWNJ.
 * A token of several words ("نان بربری") is matched on its last word, or run together (نانبربری).
 */
export function match(word: string, token: string): boolean {
  const w = clean(word), parts = clean(token).split(/[\s-]+/).filter(Boolean);
  if (!w || !parts.length) return false;
  const t = parts[parts.length - 1];
  if (ends(w, t)) return true;
  const head = parts.slice(0, -1).join("");
  return !!head && w.startsWith(head) && w.length > head.length && ends(w.slice(head.length), t);
}

/** The demonstrative a word is: این (this), اینها (these), آن / اون (that), آنها / اونا (those); همین and همان point at the same. */
export function deixis(word: string): "this" | "these" | "that" | "those" | null {
  const w = clean(word);
  if (w === "این" || w === "همین") return "this";
  if (w === "اینها" || w === "اینا" || w === "اینان" || w === "همینها" || w === "همینا") return "these";
  if (w === "آن" || w === "اون" || w === "همان" || w === "همون") return "that";
  if (w === "آنها" || w === "اونها" || w === "اونا" || w === "آنان" || w === "همانها" || w === "همونا") return "those";
  return null;
}

/** The place a word points at: اینجا (here), آنجا / اونجا (there); همینجا and همانجا point at the same. */
export function placeDeixis(word: string): "here" | "there" | null {
  const w = clean(word);
  if (w === "اینجا" || w === "همینجا" || w === "اینجاست") return "here";
  if (w === "آنجا" || w === "اونجا" || w === "همانجا" || w === "همونجا" || w === "آنجاست" || w === "اونجاست") return "there";
  return null;
}

/** Whether a demonstrative points at what is near (این, اینجا) or far (آن, اون, آنجا). */
export const isNear = (d: "this" | "these" | "that" | "those" | "here" | "there"): boolean => d === "this" || d === "these" || d === "here";
