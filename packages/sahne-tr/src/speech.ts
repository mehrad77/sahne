// Mouth timing from Turkish spelling (DESIGN.md §7). Turkish is written as it is said, so the
// letters give the syllables: one vowel per syllable, about 200 ms each at A1 pace, with the lips
// closing for m b p, the lower lip on the teeth for f v, and rests between words and at punctuation.

import type { MouthKey, Speech, SpeechOptions, WordSpan } from "sahne";
import { HUM, SHUSH, tokens, type Mark } from "./text.ts";

/** Milliseconds at rate 1 (A1 pace). `rate` divides every one of them. */
export const TIMING = {
  /** A syllable: its onset consonant and its vowel. */
  syllable: 200,
  /** Lips closed for m b p, taken from the syllable they start (or added, at the end of one). */
  mbp: 70,
  /** Lower lip on the teeth for f v. */
  fv: 60,
  /** A short close between two syllables with the same mouth shape (ka-la-cak), so the mouth does not freeze. */
  dip: 50,
  /** Each extra consonant of a cluster at the start or end of a word (tren, Türk, üst). */
  cluster: 40,
  /** ğ after a vowel, before a consonant or at the end, lengthens the vowel (dağ, doğru). */
  lengthen: 60,
  /** The shortest a vowel gets when labials eat into its syllable. */
  minVowel: 100,
  /** Between two words. */
  gap: 60,
  comma: 250,
  stop: 450,
  ellipsis: 600,
  /** A line that is only "…" (the silent card). */
  silent: 900,
  /** Per letter of a hum (hmm) or a shush (şşt), within 300–600 ms. */
  hum: 120,
} as const;

const PAUSE: Record<Mark, number> = { comma: TIMING.comma, stop: TIMING.stop, ellipsis: TIMING.ellipsis };

/**
 * The kit's mouth shape for each vowel. ı takes I, not E: it is a close vowel like i, so the jaw is
 * nearly shut, and E's open jaw would read as a different, mid vowel (kırk, mı). The lip spread that
 * tells ı from i is too small to see on a puppet. ö and ü are rounded like o and u, so they share O and U.
 */
export const VISEME: Record<string, string> = { a: "A", e: "E", ı: "I", i: "I", o: "O", ö: "O", u: "U", ü: "U" };
const LIP: Record<string, "MBP" | "FV"> = { m: "MBP", b: "MBP", p: "MBP", f: "FV", v: "FV" };
const LIP_MS = { MBP: TIMING.mbp, FV: TIMING.fv };

const TR = "abcçdefgğhıijklmnoöprsştuüvyz";
const FOREIGN: Record<string, string> = { â: "a", î: "i", û: "u", ê: "e", ô: "o", w: "v", q: "k", x: "ks" };

/** The letters that drive the mouth: Turkish letters only, circumflexes and foreign letters folded in. */
export function phonemes(said: string): string {
  let out = "";
  for (const ch of said) {
    if (TR.includes(ch)) out += ch;
    else if (FOREIGN[ch]) out += FOREIGN[ch];
    else if (/\p{L}/u.test(ch)) {
      const b = ch.normalize("NFD")[0];
      if (TR.includes(b)) out += b; else if (FOREIGN[b]) out += FOREIGN[b];
    }
  }
  return out;
}

export interface Syllable { onset: string; v: string; coda: string }

/** Turkish syllables: V.CV, VC.CV, VCC.CV. A word-initial cluster (tren, spor) stays in the first onset. */
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
    const { onset, v, coda } = syl[k], last = k === syl.length - 1, shape = VISEME[v];
    let used = 0;
    for (let j = 0; j < onset.length; j++) {
      const c = onset[j], lip = LIP[c], own = j === onset.length - 1;
      if (lip) { add(keys, t, lip); t += LIP_MS[lip]; if (own) used += LIP_MS[lip]; }
      else if (!own) t += T.cluster;
      else if (c !== "ğ" && keys[keys.length - 1]?.v === shape) { add(keys, t, "rest"); t += T.dip; used += T.dip; }
    }
    add(keys, t, shape);
    t += Math.max(T.minVowel, T.syllable - used);
    for (let j = 0; j < coda.length; j++) {
      const c = coda[j], lip = LIP[c];
      if (lip) { add(keys, t, lip); t += LIP_MS[lip]; }
      else if (c === "ğ") t += T.lengthen;
      else if (last && j > 0) t += T.cluster;
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
    const t0 = t, p = phonemes(tok.said.replace(/ /g, ""));
    t = word(p || phonemes(foreign(tok.text)), t, keys);
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
