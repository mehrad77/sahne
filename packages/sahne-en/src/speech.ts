// Mouth timing from English spelling (DESIGN.md §7). English spelling is not phonetic, so the sounds come
// from grapheme rules and a small table of exceptions (g2p.ts); after that it is laid out like any
// language: one syllable per vowel, about 200 ms each, the lips closing for m b p, the lower lip on the
// teeth for f v, and rests between words and at punctuation. Unstressed schwas are shorter, and a gliding
// vowel (eye, cow, boy, say, go) moves the mouth through two shapes within its syllable.

import type { MouthKey, Speech, SpeechOptions, WordSpan } from "sahne";
import { respell } from "./g2p.ts";
import { HUM, SHUSH, tokens, type Mark } from "./text.ts";

/** Milliseconds at rate 1 (A1 pace). `rate` divides every one of them. */
export const TIMING = {
  /** A syllable: its onset consonant and its vowel. */
  syllable: 200,
  /** An unstressed schwa (the -er of water, the -le of table): a shorter syllable. */
  schwa: 140,
  /** Lips closed for m b p, taken from the syllable they start (or added, at the end of one). */
  mbp: 70,
  /** Lower lip on the teeth for f v. */
  fv: 60,
  /** A short close between two syllables with the same mouth shape, so the mouth does not freeze. */
  dip: 50,
  /** Each extra consonant of a cluster at the start or end of a word (street, next, strengths). */
  cluster: 40,
  /** The shortest a vowel gets when labials eat into its syllable. */
  minVowel: 100,
  /** Where a gliding vowel moves to its second shape, as a share of the vowel. */
  glide: 0.55,
  /** Between two words. */
  gap: 60,
  comma: 250,
  stop: 450,
  ellipsis: 600,
  /** A line that is only "…" (the silent card). */
  silent: 900,
  /** Per letter of a hum (hmm) or a shush (shh), within 300–600 ms. */
  hum: 120,
} as const;

const PAUSE: Record<Mark, number> = { comma: TIMING.comma, stop: TIMING.stop, ellipsis: TIMING.ellipsis };

/**
 * The kit's mouth shapes for each vowel sound: one for a pure vowel, two for a glide. The short u of cup is
 * respelled a (an open mouth), the schwa @ is E. Y is eye (A then I), W cow (A then U), J boy (O then I),
 * Q say (E then I), O go (O then U).
 */
export const VISEME: Record<string, string[]> = { a: ["A"], e: ["E"], i: ["I"], o: ["O"], u: ["U"], "@": ["E"], Y: ["A", "I"], W: ["A", "U"], J: ["O", "I"], Q: ["E", "I"], O: ["O", "U"] };
const LIP: Record<string, "MBP" | "FV"> = { m: "MBP", b: "MBP", p: "MBP", f: "FV", v: "FV" };
const LIP_MS = { MBP: TIMING.mbp, FV: TIMING.fv };

/** The sounds of a said text (lower case words, spaces between): the respelling of each word, joined. */
export function phonemes(said: string): string {
  let out = "";
  for (const w of said.toLowerCase().split(/\s+/)) {
    const plain = w.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z]/g, "");
    if (plain) out += respell(plain);
  }
  return out;
}

export interface Syllable { onset: string; v: string; coda: string }

/** English syllables: one per vowel, a single consonant between vowels starting the next, more split V.CV / VC.CV. */
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
  const T = TIMING;
  const syl = syllables(p);
  if (!syl.length) { add(keys, t, "rest"); return t + T.syllable / 2; }
  for (let k = 0; k < syl.length; k++) {
    const { onset, v, coda } = syl[k], last = k === syl.length - 1, shapes = VISEME[v];
    let used = 0;
    for (let j = 0; j < onset.length; j++) {
      const c = onset[j], lip = LIP[c], own = j === onset.length - 1;
      if (lip) { add(keys, t, lip); t += LIP_MS[lip]; if (own) used += LIP_MS[lip]; }
      else if (!own) t += T.cluster;
      else if (keys[keys.length - 1]?.v === shapes[0]) { add(keys, t, "rest"); t += T.dip; used += T.dip; }
    }
    const dur = Math.max(T.minVowel, (v === "@" ? T.schwa : T.syllable) - used);
    add(keys, t, shapes[0]);
    if (shapes[1]) add(keys, t + Math.round(dur * T.glide), shapes[1]);
    t += dur;
    for (let j = 0; j < coda.length; j++) {
      const lip = LIP[coda[j]];
      if (lip) { add(keys, t, lip); t += LIP_MS[lip]; }
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
    const t0 = t, letters = tok.said.replace(/[^a-z]/g, "");
    if (HUM.test(letters)) { add(keys, t, "MBP"); t += Math.min(600, Math.max(300, TIMING.hum * letters.length)); }
    else if (SHUSH.test(letters)) { add(keys, t, "U"); t += Math.min(600, Math.max(300, TIMING.hum * letters.length)); }
    else t = word(phonemes(tok.said) || foreign(tok.text), t, keys);
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
