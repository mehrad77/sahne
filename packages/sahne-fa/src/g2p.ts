// Persian script to sounds. Persian writes its long vowels (ا آ و ی) and leaves the short ones out, so a word's
// sounds come from rules: the letters give consonants and long vowels, a few letters need their neighbours
// (و as the vowel u or the consonant v, ی as i or y, a final ه as a vowel or h), and the short vowels between
// consonants are estimated so that no syllable has more than one consonant before its vowel or two after.
//
// The sounds, one character each. Vowels: A (ā) I (i) U (u) O (o, as in تو) are written long; e a o are short
// (written with a mark, or estimated); E is the silent final ه of خانه, a light e. Consonants: b p t s j c(h) x(kh) d
// z r Z(zh) S(sh) f q k g l m n v y h G(gh) and ' (ع, ء, ئ). ZWNJ ends a part of a word (می‌روم is می + روم).
//
// What this cannot know: the short vowels are a guess (کتاب is kitāb, کتب is kotob), an unwritten ezafe is not
// said, and a word that is two words run together is one. Only the syllable count and the lips matter to the mouth.

import { foldLetters, lowerFa, ZWNJ } from "./text.ts";

const VOWELS = "AIUOEaeo";
const isVowel = (c: string | undefined): boolean => c !== undefined && VOWELS.includes(c);

const CONS: Record<string, string> = {
  ب: "b", پ: "p", ت: "t", ث: "s", ج: "j", چ: "c", ح: "h", خ: "x", د: "d", ذ: "z", ر: "r", ز: "z", ژ: "Z", س: "s", ش: "S", ص: "s", ض: "z", ط: "t", ظ: "z",
  ع: "'", غ: "G", ف: "f", ق: "q", ک: "k", گ: "g", ل: "l", م: "m", ن: "n", ه: "h", ء: "'", ئ: "'",
};
export const CONSONANT_LETTERS = Object.keys(CONS).join("");

/** Words whose sounds the rules do not give: the few ones that matter most to the timing. */
const EXCEPTIONS: Record<string, string> = {
  تو: "tO", دو: "dO", رو: "rO", نه: "na", ده: "dah", یک: "yek", خود: "xod", خواهر: "xAhar", خواهش: "xAhaS", چند: "cand",
};

const MARK_SOUND: Record<string, string> = { "َ": "a", "ِ": "e", "ُ": "o", "ً": "an", "ٌ": "on", "ٍ": "en", "ٰ": "A" };
const isMark = (c: string | undefined): boolean => c !== undefined && /[ً-ٰٟ]/.test(c);

/** The sounds the letters give, with the vowels they write; the unwritten short vowels are added by `fill`. */
function raw(w: string): string {
  w = w.replace(/ـ/g, "");
  const n = w.length;
  if (w === "ی") return "ye"; // a lone ی after ZWNJ: the ezafe or the indefinite, said ye
  const next = (i: number) => { let j = i + 1; while (j < n && isMark(w[j])) j++; return j; };
  let last = n - 1;
  while (last >= 0 && isMark(w[last])) last--;
  let out = "";
  for (let i = 0; i < n; i++) {
    const c = w[i], p = out[out.length - 1], nj = next(i), nx = w[nj], marked = isMark(w[i + 1]);
    if (isMark(c)) {
      if (MARK_SOUND[c]) out += MARK_SOUND[c];
      else if (c === "ّ" && p && !isVowel(p)) out += p; // shadda: the consonant twice
      else if (c === "ٔ" && w[i - 1] === "ه") out += "ye"; // ـهٔ: the ezafe on a silent ه
      continue;
    }
    if (c === "ا") {
      if (marked) continue; // the mark gives the vowel (اِ, اً)
      if (i === 0) {
        if (nx === "ی") { out += "I"; i = nj; } // ای, این, ایران
        else if (nx === "و") { out += "O"; i = nj; } // او
        else if ((nx === "ن" || nx === "م") && CONS[w[next(nj)]] !== undefined) out += "e"; // اندازه, امروز
        else out += "a"; // از, اگر
      } else out += "A";
    } else if (c === "آ") out += "A";
    else if (c === "و") {
      if (n === 1) out += "O"; // the word و: "and"
      else if (marked || i === 0 || isVowel(p) || nx === "ا" || nx === "آ") {
        // خواهر: the و after خ before ا is not said
        if (p === "x" && nx === "ا") continue;
        out += "v";
      } else out += "U";
    } else if (c === "ی") {
      if (i === 0) out += nx ? "y" : "I"; // یک, یاد
      else if (isVowel(p)) out += "y"; // پای, روی
      else if (nx === "ا" || nx === "آ") out += "Iy"; // پیاده
      else if (nx === "ه" && nj === last) out += "Iy"; // کیه
      else out += "I";
    } else if (c === "ه") {
      if (i === last && n > 1 && !isVowel(p)) out += "E"; // خانه, بچه, نامه
      else if (i === last && n === 1) out += "E";
      else out += "h"; // شاه, کوه, همه's first ه
    } else if (c === "ع" && "AIUO".includes(p ?? "-") && CONS[nx ?? ""] !== undefined) out += "'a"; // ساعت sā-at
    else if (CONS[c]) out += CONS[c];
  }
  return out;
}

/**
 * Add the short vowels the script leaves out. Before the first vowel, a word that starts with two consonants gets
 * one after the first (کتاب ke-tāb, سلام se-lām); three consonants between vowels with a liquid in the middle get
 * one after it (مدرسه mad-re-se); a run of three at the end gets one before the last (کردم kar-dam), and so does
 * a stop or fricative before a final ر (پدر pe-dar, مادر mā-dar; but فکر stays one syllable, as does شهر).
 */
function fill(r: string): string {
  const vs: string[] = [], runs: string[] = [""];
  for (const c of r) { if (isVowel(c)) { vs.push(c); runs.push(""); } else runs[runs.length - 1] += c; }
  if (!vs.length) {
    if (r.length <= 1) return r + "e";
    runs.splice(0, runs.length, r[0], r.slice(1)); vs.push("a");
  }
  const between = (run: string) => (run.length === 3 && "rl".includes(run[1]) ? `${run[0]}${run[1]}e${run[2]}` : run);
  let out = "";
  const head = runs[0];
  out += head.length >= 2 ? `${head[0]}a${between(head.slice(1))}` : head;
  for (let k = 0; k < vs.length; k++) {
    out += vs[k];
    const run = runs[k + 1];
    if (k < vs.length - 1) out += between(run);
    else if (run.length >= 3) out += `${run[0]}${run[1]}a${run.slice(2)}`;
    else out += run.length === 2 && run[1] === "r" && "bdptfzjs".includes(run[0]) ? `${run[0]}ar` : run; // پدر pe-dar, مادر mā-dar
  }
  return out;
}

/** The sounds of one written word (ZWNJ ends a part of it; each part gets its own short vowels). */
export function respell(word: string): string {
  let out = "";
  for (const part of foldLetters(word).split(ZWNJ)) {
    const bare = lowerFa(part);
    if (bare) out += EXCEPTIONS[bare] ?? fill(raw(part));
  }
  return out;
}
