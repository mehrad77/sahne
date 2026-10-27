// Tap-to-translate for the gallery, the way Kumru's story log does it (40-stories.js
// `glossLookup`): the scene's own glosses first (fixed phrases, verb forms: a story's `gl`), then
// the A1 word cards from $SAHNE_CONTENT/cards (passed in: serve.mjs's /data/vocab.json), where
// sahne-tr's `match` finds a card for an inflected noun (ekmeği → ekmek). English and Persian.

import type { Gloss, GlossContext, GlossOptions } from "sahne";
import { match, lowerTr } from "sahne-tr";

/** A gloss of the scene's own: what a story's `gl` holds, plus a dictionary form and a note. */
export interface SceneGloss { en: string; fa: string; head?: string; note?: string }

/** The A1 cards by lower-case word, and their keys longest first (for the stem search). */
export type Vocab = [string, string, string][];
function cardsOf(vocab: Vocab) {
  const cards = new Map<string, { en: string; fa: string }>();
  for (const [tr, en, fa] of vocab) {
    const k = lowerTr(tr).replace(/[.?!…,;:]+$/u, "");
    if (k && !/[\s/]/.test(k) && !cards.has(k)) cards.set(k, { en, fa });
  }
  return { CARDS: cards, STEMS: [...cards.keys()].sort((a, b) => b.length - a.length) };
}

const lines = (en: string, fa: string): Gloss["lines"] => [{ text: en, lang: "en" }, { text: fa, lang: "fa", dir: "rtl" }];

/**
 * A lookup over the scene's glosses: `words` for single words (by lower-case form), `phrases`
 * for fixed chunks, which win for every word inside them when the line holds the whole chunk.
 */
export function glossLookup(words: Record<string, SceneGloss>, phrases: Record<string, SceneGloss>, vocab: Vocab): GlossOptions["lookup"] {
  const { CARDS, STEMS } = cardsOf(vocab);
  return (word: string, ctx: GlossContext): Gloss | null => {
    const w = lowerTr(word).replace(/’/g, "'"), line = lowerTr(ctx.text);
    for (const [p, g] of Object.entries(phrases)) {
      const parts = p.split(" ");
      if (parts.includes(w) && line.includes(p)) {
        const own = words[w] ?? CARDS.get(w);
        return { head: p, lines: lines(g.en, g.fa), note: g.note ?? (own ? `${w}: ${own.en}` : undefined) };
      }
    }
    const g = words[w];
    if (g) return { head: g.head, lines: lines(g.en, g.fa), note: g.note };
    const base = w.split("'")[0];
    const card = CARDS.get(w) ?? CARDS.get(base);
    if (card) return { head: card === CARDS.get(w) ? undefined : base, lines: lines(card.en, card.fa), note: base !== w ? "+ suffix" : undefined };
    // an inflected noun: the longest card it is a form of
    const stem = STEMS.find(s => w.startsWith(s.slice(0, Math.max(2, s.length - 1))) && match(w, s));
    if (stem) { const c = CARDS.get(stem)!; return { head: stem, lines: lines(c.en, c.fa), note: "+ suffix" }; }
    return null;
  };
}

/** Say a word with the browser's voice (the popup's speak button). */
export function speak(word: string, lang: string) {
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = lang === "tr" ? "tr-TR" : lang; u.rate = 0.85;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch { /* no speech in this browser */ }
}
