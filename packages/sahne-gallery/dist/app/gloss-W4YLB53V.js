import {
  glossLookup,
  speak
} from "./chunk-GNC44ETW.js";
import "./chunk-ZT53KTYM.js";
import {
  BAKKAL,
  ENDING,
  GL_PHRASES,
  GL_WORDS,
  ISMAIL,
  NIMA,
  OPENING,
  POLITE
} from "./chunk-VFMRH5SO.js";
import {
  bench
} from "./chunk-ZRNRQOB7.js";
import "./chunk-J3KVAIQI.js";
import {
  $,
  bar,
  css,
  toggle
} from "./chunk-4TGKXDN4.js";
import {
  glossInto
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/gloss.ts
var NAMES = { ismail: "\u0130smail", nima: "Nima", kerim: "Kerim" };
async function build(host, ctx) {
  const vocab = await ctx.data("vocab");
  const lookup = glossLookup(GL_WORDS, GL_PHRASES, vocab);
  const GLOSS = { lookup, speak };
  css("sys-gloss", `.gl-log p { margin: 2px 0; font-size: 16px; } .gl-log b { color: var(--mute); margin-right: 6px; }
.gl-own { min-height: 48px; } .gl-own strong { font-size: 18px; margin-right: 8px; } .gl-own [dir=rtl] { margin-left: 8px; }`);
  host.append($("h2", "", "The bubbles' words"), $("p", "note", `Play a line, then tap a dotted word in its bubble: a small popup gives the word in English and Persian (with its dictionary form for an inflected word: ekme\u011Fi \u2192 ekmek, and a note), and a speak button. A tap elsewhere, the same word again, Escape or the next cue closes it. A fixed chunk wins for every word in it (ho\u015F geldiniz, ba\u015Fka bir \u015Fey). Sound words are Turkish too: \xE7\u0131n \xE7\u0131n is glossable while its bubble shows (sound off, or captions on). ${vocab.length} A1 cards loaded.`));
  const shop = bench(host, ctx, {
    places: [BAKKAL],
    cast: { ismail: ISMAIL, nima: NIMA },
    cues: [OPENING[0]],
    stage: { gloss: GLOSS, glosses: true },
    load: { names: NAMES, narrator: "kerim" }
  });
  const log = $("div", "card gl-log");
  log.append($("small", "", "The app's own log: the same glossInto, so a word taps the same way here."));
  const own = $("div", "card gl-own", "");
  own.hidden = true;
  const say = (label, cue) => shop.cue(label, () => {
    const l = "line" in cue ? cue.line : null;
    if (l && l.voice !== "silent") {
      const p = $("p"), t = $("span");
      t.lang = "tr";
      glossInto(t, l.text, glossesOn ? GLOSS : null, { text: l.text, who: l.who, lang: "tr" });
      p.append($("b", "", NAMES[l.who] ?? l.who), t);
      log.append(p);
    }
    return cue;
  });
  let glossesOn = true;
  const lines = [...OPENING.slice(1), ...POLITE, ...ENDING];
  host.append(
    bar("lines", ...lines.map((c, i) => say(`${i + 1}. ${c.line.text}`, c))),
    bar("", shop.cue("back to the start", OPENING[0]), say("\xE7\u0131n \xE7\u0131n (a sound word)", { beat: { sfx: { id: "doorbell", word: "\xE7\u0131n \xE7\u0131n", at: "mark:door" } } })),
    bar(
      "glosses",
      toggle("on", true, (on) => {
        glossesOn = on;
        shop.stage.setGlosses(on);
      }, "setGlosses: off, the bubbles are plain text"),
      toggle("the app's own popup", false, (on) => {
        GLOSS.open = on ? (word, g) => {
          own.hidden = false;
          own.replaceChildren($("strong", "", g.head ? `${word} \u2192 ${g.head}` : word), ...g.lines.map((l) => Object.assign($("span", "", l.text), { dir: l.dir ?? "ltr", lang: l.lang ?? "" })), g.note ? $("small", "", ` \xB7 ${g.note}`) : "");
        } : void 0;
        own.hidden = !on;
        if (glossesOn) {
          shop.stage.setGlosses(false);
          shop.stage.setGlosses(true);
        }
      }, "GlossOptions.open: the app shows the gloss its own way (here, the card below)")
    ),
    own,
    log
  );
  host.append($("h2", "", "The lookup"), $("p", "note", "What the app's lookup answers for a word in a line: the scene's glosses, then a card, then the card an inflected word is a form of (sahne-tr's match). A word without a gloss gets no underline."));
  const input = Object.assign($("input"), { type: "text", value: "ekme\u011Fi" }), out = $("pre", "log");
  const test = () => {
    const w = input.value.trim(), g = w ? lookup(w, { text: w, lang: "tr" }) : null;
    out.textContent = g ? JSON.stringify(g) : `${w}: no gloss (no underline)`;
  };
  input.oninput = test;
  host.append(bar("word", input, ...["ekme\u011Fi", "s\xFCt\xFC", "geldiniz", "buyrun", "taze", "Nima'n\u0131n", "acaba"].map((w) => Object.assign($("button", "", w), { type: "button", onclick: () => {
    input.value = w;
    test();
  } }))), out);
  test();
}
export {
  build
};
//# sourceMappingURL=gloss-W4YLB53V.js.map
