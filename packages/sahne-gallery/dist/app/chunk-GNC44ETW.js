import {
  lowerTr,
  match
} from "./chunk-ZT53KTYM.js";

// src/gloss.ts
function cardsOf(vocab) {
  const cards = /* @__PURE__ */ new Map();
  for (const [tr, en, fa] of vocab) {
    const k = lowerTr(tr).replace(/[.?!…,;:]+$/u, "");
    if (k && !/[\s/]/.test(k) && !cards.has(k)) cards.set(k, { en, fa });
  }
  return { CARDS: cards, STEMS: [...cards.keys()].sort((a, b) => b.length - a.length) };
}
var lines = (en, fa) => [{ text: en, lang: "en" }, { text: fa, lang: "fa", dir: "rtl" }];
function glossLookup(words, phrases, vocab) {
  const { CARDS, STEMS } = cardsOf(vocab);
  return (word, ctx) => {
    const w = lowerTr(word).replace(/’/g, "'"), line = lowerTr(ctx.text);
    for (const [p, g2] of Object.entries(phrases)) {
      const parts = p.split(" ");
      if (parts.includes(w) && line.includes(p)) {
        const own = words[w] ?? CARDS.get(w);
        return { head: p, lines: lines(g2.en, g2.fa), note: g2.note ?? (own ? `${w}: ${own.en}` : void 0) };
      }
    }
    const g = words[w];
    if (g) return { head: g.head, lines: lines(g.en, g.fa), note: g.note };
    const base = w.split("'")[0];
    const card = CARDS.get(w) ?? CARDS.get(base);
    if (card) return { head: card === CARDS.get(w) ? void 0 : base, lines: lines(card.en, card.fa), note: base !== w ? "+ suffix" : void 0 };
    const stem = STEMS.find((s) => w.startsWith(s.slice(0, Math.max(2, s.length - 1))) && match(w, s));
    if (stem) {
      const c = CARDS.get(stem);
      return { head: stem, lines: lines(c.en, c.fa), note: "+ suffix" };
    }
    return null;
  };
}
function speak(word, lang) {
  try {
    const u = new SpeechSynthesisUtterance(word);
    u.lang = lang === "tr" ? "tr-TR" : lang;
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
  }
}

export {
  glossLookup,
  speak
};
//# sourceMappingURL=chunk-GNC44ETW.js.map
