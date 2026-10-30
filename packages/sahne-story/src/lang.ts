// A story language: what the lints and the check know of the series' main language (src/texts.ts). The engine's
// `LangPlugin` (sahne's core/lang.ts) times a mouth and hears a line; this reads a story's text: its words and pauses,
// whether a word is a form of another, the words that motivate a gesture, a number said aloud, and the language's own
// lints (Turkish: bu/şu/o, var/yok, counts, clock times) and the check's dictionary forms. `langs/tr.ts` is Turkish, `langs/en.ts` English, `langs/de.ts` German;
// any other language gets `plainLang`: the lints and checks that need no grammar, and exact words.

import type { Staging, Target } from "sahne";
import { deLang } from "./langs/de.ts";
import { enLang } from "./langs/en.ts";
import { trLang } from "./langs/tr.ts";

/** A word of a line (lower case, `i` its offset), or a pause: "," or "." (`q` for a question mark). */
export interface LineWord { w: string; i: number; pause?: true; q?: boolean }

/** What a prop on stage is like as a line is said. */
export interface PropView { kit: string; shown: boolean; n?: number; params: Record<string, unknown>; holder?: string }

/** A line as the lints read it, after its staging applied: for a language's own lints (`StoryLang.lintLine`). */
export interface LineContext {
  who?: string;
  text: string;
  st: Staging;
  /** The line's words and pauses (`StoryLang.words`) and its words alone. */
  words: LineWord[];
  plain: string[];
  /** The target on stage a word names: its `link`, else a prop it is a form of. */
  linkOf(word: string): Target | null;
  /** A prop on stage. */
  prop(id: string): PropView | undefined;
  /** How far the speaker stands from a target (metres; 0 when they hold it), or null when either has no place. */
  distance(target: Target): number | null;
  /** Whether the speaker holds the prop a target names. */
  holds(target: Target): boolean;
  add(rule: string, message: string, fix?: Staging, level?: "error" | "warning"): void;
}

/** The check's dictionary: a token of a story resolves when it is an entry or one of its forms (or a number, a particle). */
export type Resolver = (token: string) => boolean;

export interface StoryLang {
  /** The language code (`tr`). */
  id: string;
  lower(text: string): string;
  /** A line's words and pauses. */
  words(text: string): LineWord[];
  /** Whether `word` is a form of `entry` (Turkish: fırının of fırın). */
  match(word: string, entry: string): boolean;
  /** A word with its diacritics folded, to meet a card term id written in ASCII (`ogrenci` for öğrenci). */
  fold(word: string): string;
  /** A pointing word (Turkish bu, şu, o and their forms): it points, it never names a prop itself. */
  pointing(word: string): boolean;
  /** A word after which the next noun names the place itself, not a prop (Turkish burası, şurası, orası). */
  namesPlace(word: string): boolean;
  /** Words that motivate a gesture (prefixes of the lower-case words, or a phrase; `"no$"` is the whole word): a gesture not listed needs none. */
  motive: Record<string, string[]>;
  /** A number said from `plain[i]` on: its value and how many words it takes. */
  number?(plain: string[], i: number): { n: number; len: number } | null;
  /** The language's own lints over a line (after its staging). */
  lintLine?(c: LineContext): void;
  /** The check's words of a text (lower case, no punctuation) and a resolver over dictionary forms. */
  checkWords(text: string): string[];
  resolver(entries: Iterable<string>, opts?: { particles?: boolean }): Resolver;
  /** Words a story may use that are no card: tokens the host personalises (Kumru's hometown). */
  names?: string[];
  /** A series' own text warnings, by line (Kumru's: the stand-in names no country or language). */
  hints?(t: { text: string; standin: boolean }, gl: Record<string, unknown>): string[];
  /** Words of a parenthetical that stage a line (`waves` → `{ do: "wave" }`), for an editor. */
  parenthetical?: Record<string, Partial<Staging>>;
}

const PAUSE = /^(\.{2,}|…|[.,;:!?—–]|-)$/;
/** Words and pauses by Unicode letters, for a language with no plugin. */
const plainWords = (lower: (s: string) => string) => (text: string): LineWord[] =>
  [...text.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*|\.{2,}|…|[.,;:!?—–]/gu)].map(m =>
    PAUSE.test(m[0]) ? { w: m[0] === "," ? "," : ".", i: m.index ?? 0, pause: true as const, q: m[0] === "?" } : { w: lower(m[0]), i: m.index ?? 0 });

/** A language with no plugin: exact words, no grammar of its own. */
export function plainLang(id: string): StoryLang {
  const lower = (s: string) => s.toLocaleLowerCase(id);
  const words = plainWords(lower);
  const checkWords = (text: string) => words(text).filter(w => !w.pause && !/^[0-9]+$/.test(w.w)).map(w => w.w.split(/['’]/)[0]);
  return {
    id, lower, words, checkWords,
    match: (word, entry) => lower(word) === lower(entry),
    fold: w => w.normalize("NFD").replace(/\p{M}/gu, ""),
    pointing: () => false,
    namesPlace: () => false,
    motive: {},
    resolver: entries => { const known = new Set([...entries].flatMap(checkWords)); return t => known.has(t) || /^[0-9]+$/.test(t); },
  };
}

/** The story languages Sahne has: Turkish, English and German. */
export const LANGS: Record<string, StoryLang> = { tr: trLang, en: enLang, de: deLang };

/** The story language of a code: its plugin, else `plainLang`. */
export const langFor = (id: string): StoryLang => LANGS[id] ?? plainLang(id);


/**
 * The first entry of a gesture's motive that the line's words (`plain`) satisfy, else undefined.
 * `"hi$"` is a whole word; `"of course"` is a phrase of whole words, at the start, middle or end of the line;
 * any other entry is the start of a word.
 */
export function motivated(entries: readonly string[], plain: readonly string[]): string | undefined {
  const padded = ` ${plain.join(" ")} `;
  return entries.find(m => m.endsWith("$") ? plain.includes(m.slice(0, -1)) : plain.some(w => w.startsWith(m)) || padded.includes(` ${m} `));
}

/** An entry as a person reads it: without the whole-word `$`. */
export const motiveText = (m: string): string => m.replace(/\$$/, "");
