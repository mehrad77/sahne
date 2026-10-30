// Whether a word of a line is a form of a `link` token (a dictionary form): Brote, Brotes → Brot; Äpfel →
// Apfel; Kindern → Kind; Lehrerinnen → Lehrerin; Nimas → Nima. The director uses it to time a gesture's
// stroke to the word that names its target.
//
// The heuristic: the word is the token or its umlauted stem (a→ä, o→ö, u→ü, au→äu in the last vowel),
// followed by one of the noun endings that German plural and case take: nothing, -e, -en, -n, -er, -ern, -s,
// -es, -ns, -ens. An umlaut goes only with the plural endings that take one (Apfel → Äpfel, Brot → Brote does
// not, Buch → Bücher, Haus → Häuser, Hand → Hände). A token in -in doubles its n (Lehrerin → Lehrerinnen);
// one in -nis, -us, -is, -as doubles its s (Ergebnis → Ergebnisse); a table holds the foreign plurals (Museum
// → Museen, Thema → Themen). ß and ss are the same letter (Fuß → Füße, Nuss → Nüsse, recognisers write either).
// Names take -s with or without an apostrophe (Nimas, Nima's).
//
// Deliberately not forms: compounds and derived words, which name a different thing (Brotkorb, Brötchen,
// Bäcker, Backwaren). Known misses: adjective endings (the adjective of a token that is one: rote → rot); a
// verb token (gehen → geht). A homograph that is also an ending-form matches (Hause for Haus, a dative
// nobody says; Bad + er is Bader).

import { lowerDe } from "./text.ts";

/** The endings a noun takes in a plural or a case, and which of them come with an umlaut in the stem. */
const PLAIN = ["", "e", "en", "n", "er", "ern", "s", "es", "ns", "ens", "se", "sen", "ses"];
const UMLAUT = ["", "e", "en", "er", "ern", "n"];

/** Foreign plurals that break the endings: the singular, and its plural forms. */
const IRREGULAR: Record<string, string[]> = {
  museum: ["museen"], zentrum: ["zentren"], studium: ["studien"], datum: ["daten"], praktikum: ["praktika"], album: ["alben"], thema: ["themen"], firma: ["firmen"],
  drama: ["dramen"], pizza: ["pizzen", "pizzas"], konto: ["konten"], praxis: ["praxen"], kaktus: ["kakteen"], virus: ["viren"], lexikon: ["lexika"], atlas: ["atlanten", "atlasse"],
  junge: ["jungs"], herr: ["herren", "herrn"], kaufmann: ["kaufleute"], bus: ["busse", "bussen"],
};

const UML: Record<string, string> = { a: "ä", o: "ö", u: "ü" };

/** ß and ss are one letter for the match; ä, ö, ü stay (they tell the plural). */
const fold = (s: string) => lowerDe(s).replace(/ß/g, "ss");

const clean = (s: string) =>
  fold(s).replace(/[’ʼ‘`´]/g, "'").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/** The token with its last a, o or u (or au) umlauted: Apfel → äpfel, Haus → häus, Bruder → brüder; null when it has none. */
function umlauted(t: string): string | null {
  const i = Math.max(t.lastIndexOf("a"), t.lastIndexOf("o"), t.lastIndexOf("u"));
  if (i < 0) return null;
  const au = t[i] === "u" && t[i - 1] === "a";
  return au ? `${t.slice(0, i - 1)}äu${t.slice(i + 1)}` : t.slice(0, i) + UML[t[i]] + t.slice(i + 1);
}

/**
 * Whether `word`, as written in a line, is a form of `token`. Case-insensitive (German capitalises its nouns).
 * A token of several words ("rote Ampel") is matched on its last word, the one that takes the endings.
 */
export function match(word: string, token: string): boolean {
  const w = clean(word).replace(/'s$/, "s"), parts = clean(token).split(/\s+/).filter(Boolean);
  if (!w || !parts.length) return false;
  const t = parts[parts.length - 1];
  if (w === t) return true;
  if (IRREGULAR[t]?.includes(w)) return true;
  if (w.length <= t.length - 2) return false;
  const ends = /in$/.test(t) ? [...PLAIN, "nen"] : PLAIN;
  for (const e of ends) if (w.length === t.length + e.length && w === t + e) return true;
  // the umlaut stem, with the endings that take one
  const u = umlauted(t);
  if (u && u !== t) for (const e of UMLAUT) if (w === u + e) return true;
  return false;
}

/**
 * The demonstrative a word points with: "dies" for dieser, diese, dieses, diesem, diesen (here, near), "jen" for jener
 * and its forms (there, far). Also a definite article stressed with an adverb after it: "das hier" and "die da" are
 * "dies" for hier and "da" for da and dort, so pass the next word as `next` ("der da Hund", "das hier").
 */
export function deixis(word: string, next?: string): "dies" | "jen" | "da" | null {
  const w = clean(word), n = next ? clean(next) : "";
  if (/^dies(?:er|e|es|em|en)?$/.test(w)) return "dies";
  if (/^jen(?:er|e|es|em|en)$/.test(w)) return "jen";
  if (/^(?:der|die|das|dem|den)$/.test(w)) return n === "hier" ? "dies" : n === "da" || n === "dort" ? "da" : null;
  return null;
}
