// German word resolving for the story check: whether a token of a story's text is a form of a card, a
// name, a particle or a number. sahne-de's `match` handles noun endings (Brote, Äpfel); verb forms are
// matched here by a loose stem-plus-ending test (strong verbs and separable prefixes are not covered).

import { lowerDe, match, ordinal, readNumber } from "sahne-de";

export const PARTICLES = new Set((
  "der die das dem den des ein eine einen einem einer eines und oder aber auch doch noch nur schon sehr nicht kein keine keinen keinem keiner " +
  "ich du er sie es wir ihr mich dich ihn uns euch mir dir ihm ihnen mein meine meinen meinem meiner dein deine deinen sein seine seinen ihre ihren unser unsere " +
  "ist bin bist sind seid war waren habe hast hat haben habt wird werden wurde kann kannst können könnte muss musst müssen soll sollen will willst wollen mag mögen möchte möchten darf dürfen " +
  "wer was wo wie wann warum wieso woher wohin welche welcher welches wieviel wie viel " +
  "in an auf aus bei mit nach von zu zum zur zur vor für über unter um durch gegen ohne bis seit am im ins ans beim vom hier da dort dies dieser diese dieses diesem diesen jener jene jenes " +
  "ja nein bitte danke dankeschön hallo tschüss tschüs gut guten morgen tag abend nacht okay ok genau klar gern gerne vielleicht leider mal denn dann wenn weil dass ob als so zu zum " +
  "heute gestern morgen jetzt immer nie oft manchmal auch noch mehr viel viele wenig alle alles etwas nichts man uns sich"
).split(/\s+/));

const ORDINALS = Array.from({ length: 31 }, (_, k) => ordinal(k + 1));

/** The German words of a text, lower-cased, each name's apostrophe tail cut (Nima's → nima). */
export function words(text: string): string[] {
  return lowerDe(text.replace(/[’‘`´]/g, "'")).split(/[^\p{L}'0-9]+/u).map(w => w.split("'")[0]).filter(w => w && !/^[0-9]+$/.test(w));
}

/** How a verb's suffixes can begin: nothing, -e, -st, -t, -en, -et, -est, -te, -ten, -tet, -test, -end. */
const VERB_ENDS = new Set(["", "e", "st", "t", "en", "et", "est", "te", "ten", "tet", "test", "end", "n"]);

/**
 * A verb in a loose sense: the token is the stem and a short ending (geh → gehe, gehst, geht, gehen), or the
 * participle ge + stem + t/et/en (gemacht; gegangen is not covered: a vowel change is another word).
 */
function verbForm(lemma: string, token: string): boolean {
  if (!lemma.endsWith("n")) return false;
  const stem = lemma.replace(/e?n$/, "");
  if (stem.length < 3) return false;
  if (token.startsWith(stem) && VERB_ENDS.has(token.slice(stem.length))) return true;
  return token.startsWith("ge") && token.startsWith(stem, 2) && /^(?:t|et|en)$/.test(token.slice(2 + stem.length));
}

export type Resolver = (token: string) => boolean;

const isNumber = (t: string) => !!readNumber([t], 0) || ORDINALS.some(o => t.startsWith(o) && /^[nrsm]?$/.test(t.slice(o.length)));

/**
 * A resolver for a list of dictionary forms (cards' German, glosses, names), plus numbers and particles. A token
 * resolves when it is an entry, or a form of one: `match(token, entry)`, the word as written first (Äpfel → Apfel).
 */
export function resolver(entries: Iterable<string>, opts: { particles?: boolean } = {}): Resolver {
  const buckets = new Map<string, string[]>();
  const exact = new Set<string>();
  for (const e of entries) for (const w of words(e)) {
    exact.add(w);
    (buckets.get(w.slice(0, 2)) ?? buckets.set(w.slice(0, 2), []).get(w.slice(0, 2))!).push(w);
    // a participle starts with ge-, an umlaut stem with the umlaut: bucket those too
    const umlaut = w.replace(/[aou]/, c => ({ a: "ä", o: "ö", u: "ü" } as Record<string, string>)[c]).slice(0, 2);
    if (umlaut !== w.slice(0, 2)) (buckets.get(umlaut) ?? buckets.set(umlaut, []).get(umlaut)!).push(w);
  }
  return token => {
    if (exact.has(token) || isNumber(token) || (opts.particles !== false && PARTICLES.has(token))) return true;
    const keys = new Set([token.slice(0, 2), token.slice(2, 4)]);
    for (const k of keys) for (const w of buckets.get(k) ?? []) if (verbForm(w, token) || (w.length >= 2 && match(token, w))) return true;
    return false;
  };
}
