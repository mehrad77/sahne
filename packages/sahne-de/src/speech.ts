// Mouth timing from German spelling (DESIGN.md §7). German is nearly phonetic, so rules over the
// letters give the syllables: sch, ch, ck, ph, pf, qu and z are one sound each; ei, au and eu/äu are
// one syllable with two mouth shapes; a vowel doubled or followed by a silent h is one syllable (Boot,
// Bahn, sehr); ie is one (Brief); and an unstressed -e, -en, -er, -el is a short schwa. Then the
// Turkish plugin's layout: about 200 ms a stressed syllable, the lips closing for m b p and touching
// the teeth for f v, and rests between words and at punctuation.

import type { MouthKey, Speech, SpeechOptions, WordSpan } from "sahne";
import { HUM, SHUSH, tokens, lowerDe, type Mark } from "./text.ts";

/** Milliseconds at rate 1 (A1 pace). `rate` divides every one of them. */
export const TIMING = {
  /** A stressed syllable: its onset consonant and its vowel. */
  syllable: 200,
  /** An unstressed schwa (the -e of Katze, -en, -er, -el). */
  schwa: 120,
  /** Lips closed for m b p (and pf), taken from the syllable they start (or added, at the end of one). */
  mbp: 70,
  /** Lower lip on the teeth for f v w. */
  fv: 60,
  /** A short close between two syllables with the same mouth shape (Ba-na-ne), so the mouth does not freeze. */
  dip: 50,
  /** Each extra consonant of a cluster at the start of a word, or in the coda of a syllable (Strand, Herbst, Fenster). */
  cluster: 40,
  /** From the first shape of a diphthong (ei, au, eu) to its second: the share of the vowel before the glide. */
  glide: 0.55,
  /** The shortest a vowel gets when labials eat into its syllable. */
  minVowel: 100,
  /** Between two words. */
  gap: 60,
  comma: 250,
  stop: 450,
  ellipsis: 600,
  /** A line that is only "…" (the silent card). */
  silent: 900,
  /** Per letter of a hum (hmm) or a shush (pst), within 300–600 ms. */
  hum: 120,
} as const;

const PAUSE: Record<Mark, number> = { comma: TIMING.comma, stop: TIMING.stop, ellipsis: TIMING.ellipsis };

/**
 * The kit's mouth shape for each vowel in the sound alphabet below: ä is E (open, front), ö is O and ü is U
 * (rounded like o and u, as in Turkish), the schwa is E. A diphthong is two shapes: ei A→I, au A→U, eu/äu O→I.
 */
export const VISEME: Record<string, string> = { a: "A", e: "E", ə: "E", i: "I", o: "O", u: "U", ä: "E", ö: "O", ü: "U", "ɑ": "A", "ɒ": "A", "ɔ": "O" };
const GLIDE: Record<string, string> = { "ɑ": "I", "ɒ": "U", "ɔ": "I" };
const LIP: Record<string, "MBP" | "FV"> = { m: "MBP", b: "MBP", p: "MBP", "ƥ": "MBP", f: "FV", v: "FV" };
const LIP_MS = { MBP: TIMING.mbp, FV: TIMING.fv };

const FOREIGN: Record<string, string> = { é: "e", è: "e", ê: "e", á: "a", à: "a", â: "a", í: "i", î: "i", ó: "o", ô: "o", ú: "u", û: "u", ç: "s", ñ: "n", å: "o", æ: "ä", œ: "ö", ø: "ö" };

/**
 * The sounds that drive the mouth, as one character each. Vowels: a e i o u ä ö ü, the schwa ə, and the
 * diphthongs ɑ (ei) ɒ (au) ɔ (eu, äu). Consonants: š (sch), x (ch), ŋ (ng), ƥ (pf), c (z, ts), and the letters.
 */
export function phonemes(said: string): string {
  let s = lowerDe(said);
  s = [...s].map(ch => (/[a-zäöüß]/.test(ch) ? ch : FOREIGN[ch] ?? (/\p{L}/u.test(ch) ? ch.normalize("NFD")[0] : ""))).join("").replace(/[^a-zäöüß]/g, "");
  s = s.replace(/x/g, "ks").replace(/tsch/g, "š").replace(/sch/g, "š").replace(/chs/g, "ks").replace(/ch/g, "x").replace(/ck/g, "k")
    .replace(/c(?=[eiäöüy])/g, "z").replace(/c/g, "k").replace(/q(?!u)/g, "k")
    .replace(/ph/g, "f").replace(/th/g, "t").replace(/dt/g, "t").replace(/tz/g, "c").replace(/z/g, "c").replace(/pf/g, "ƥ").replace(/ng/g, "ŋ").replace(/qu/g, "kv")
    .replace(/ß/g, "s").replace(/^s(?=[pt])/, "š").replace(/w/g, "v");
  // an unstressed -e, -en, -er, -el, -es, -em, -est: a schwa (not after another vowel, and not the only vowel)
  s = s.replace(/(?<=[^aeiouäöüy])e(?=[lmnrst]{0,2}$)/g, (m, at: number) => (/[aeiouäöüy]/.test(s.slice(0, at)) ? "ə" : m));
  s = s.replace(/eu|äu/g, "ɔ").replace(/ei|ai|ey|ay/g, "ɑ").replace(/au/g, "ɒ").replace(/ie/g, "i").replace(/aa|ee|oo/g, m => m[0]).replace(/y$/, "i").replace(/y/g, "ü");
  // a h after a vowel only lengthens it (Bahn, sehr, Ruhe)
  s = s.replace(/(?<=[aeiouäöüəɑɒɔ])h/g, "");
  return s.replace(/([bdfgklmnprstvjhxc])\1/g, "$1");
}

export interface Syllable { onset: string; v: string; coda: string }

/** German syllables: V.CV, VC.CV, VCC.CV (the last consonant goes to the next syllable). A word-initial cluster stays in the first onset. */
export function syllables(p: string): Syllable[] {
  const out: Syllable[] = [];
  let cons = "";
  for (const c of p) {
    if (!VISEME[c]) { cons += c; continue; }
    if (!out.length) out.push({ onset: cons, v: c, coda: "" });
    else { out[out.length - 1].coda += cons.slice(0, -1); out.push({ onset: cons.slice(-1), v: c, coda: "" }); }
    cons = "";
  }
  if (out.length) out[out.length - 1].coda += cons;
  return out;
}

/** Add a key: a later key at the same time replaces the earlier one, and a repeated shape is dropped. */
function add(keys: MouthKey[], t: number, v: string) {
  while (keys.length && keys[keys.length - 1].t >= t) keys.pop();
  if (keys.length && keys[keys.length - 1].v === v) return;
  keys.push({ t, v });
}

/** Lay out one spoken word from `t`; returns when it ends. */
function word(p: string, t: number, keys: MouthKey[]): number {
  const T = TIMING, hold = (n: number) => Math.min(600, Math.max(300, T.hum * n));
  if (HUM.test(p)) { add(keys, t, "MBP"); return t + hold(p.length); }
  if (SHUSH.test(p)) { add(keys, t, "U"); return t + hold(p.length); }
  const syl = syllables(p);
  if (!syl.length) { add(keys, t, "rest"); return t + T.syllable / 2; }
  for (let k = 0; k < syl.length; k++) {
    const { onset, v, coda } = syl[k], shape = VISEME[v], base = v === "ə" ? T.schwa : T.syllable;
    let used = 0;
    for (let j = 0; j < onset.length; j++) {
      const c = onset[j], lip = LIP[c], own = j === onset.length - 1;
      if (lip) { add(keys, t, lip); t += LIP_MS[lip]; if (own) used += LIP_MS[lip]; }
      else if (!own) t += T.cluster;
      else if (keys[keys.length - 1]?.v === shape) { add(keys, t, "rest"); t += T.dip; used += T.dip; }
    }
    add(keys, t, shape);
    const vowel = Math.max(T.minVowel, base - used);
    if (GLIDE[v]) { add(keys, t + Math.round(vowel * T.glide), GLIDE[v]); }
    t += vowel;
    for (let j = 0; j < coda.length; j++) {
      const c = coda[j], lip = LIP[c];
      if (lip) { add(keys, t, lip); t += LIP_MS[lip]; }
      else if (j > 0) t += T.cluster;
    }
  }
  return t;
}

/** A word in another script: about one syllable per two or three letters, alternating open shapes. */
function foreign(text: string): string {
  const n = Math.max(1, Math.round((text.match(/\p{L}/gu)?.length ?? 1) / 2.5));
  return Array.from({ length: n }, (_, k) => (k % 2 ? "de" : "da")).join("");
}

/**
 * When the mouth makes which shape, and when each word is said. Times are whole milliseconds.
 * Keys are sorted, start at 0, never repeat a shape twice in a row, and end on `rest`: at `dur` when
 * the line ends on a word, or where the closing pause begins when it ends on punctuation (the mouth
 * holds `rest` to `dur`). A line with no words ("…") is the silent card: 900 ms of rest, one span.
 */
export function speech(text: string, o: SpeechOptions = {}): Speech {
  const rate = o.rate !== undefined && Number.isFinite(o.rate) && o.rate > 0 ? o.rate : 1;
  const ms = (x: number) => Math.round(x / rate);
  const keys: MouthKey[] = [], spans: WordSpan[] = [];
  let t = 0, pause = 0;
  for (const tok of tokens(text)) {
    if (tok.kind === "pause") { pause = Math.max(pause, PAUSE[tok.mark]); continue; }
    if (spans.length) t += Math.max(TIMING.gap, pause); else t += pause;
    pause = 0;
    const t0 = t, said = tok.said.replace(/ /g, ""), p = phonemes(said);
    t = word(HUM.test(said) || SHUSH.test(said) ? said : p || phonemes(foreign(tok.text)), t, keys);
    add(keys, t, "rest");
    spans.push({ i: tok.i, text: tok.text, t0, t1: t });
  }
  if (!spans.length) {
    const s = text.trim();
    if (!s) return { dur: 0, keys: [{ t: 0, v: "rest" }], words: [] };
    const dur = ms(TIMING.silent);
    return { dur, keys: [{ t: 0, v: "rest" }], words: [{ i: text.search(/\S/), text: s, t0: 0, t1: dur }] };
  }
  t += pause;
  const out: MouthKey[] = [];
  if (keys[0].t > 0) out.push({ t: 0, v: "rest" });
  for (const k of keys) add(out, ms(k.t), k.v);
  return { dur: ms(t), keys: out, words: spans.map(w => ({ ...w, t0: ms(w.t0), t1: ms(w.t1) })) };
}
