// Tap to translate (DESIGN.md §6.8): the bubbles' words as buttons on a real stage. The engine knows
// no language: the gallery's lookup (the scene's own glosses, then the A1 cards from ctx.data("vocab"),
// with sahne-tr finding the card of an inflected word) decides which words get a dotted underline and
// what the popup says, in English and Persian. The same glossInto fills the app's own log, and an app
// may open its own popup instead of the engine's (`open`).

import { glossInto, type Cue, type Gloss, type GlossOptions, type LineCue } from "sahne";
import { $, bar, css, toggle } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { BAKKAL, ISMAIL, NIMA, OPENING, ENDING, POLITE, GL_WORDS, GL_PHRASES } from "../bakkal.ts";
import { glossLookup, speak } from "../gloss.ts";
import { bench } from "./bench.ts";

const NAMES: Record<string, string> = { ismail: "İsmail", nima: "Nima", kerim: "Kerim" };

export async function build(host: HTMLElement, ctx: Ctx) {
  const vocab = await ctx.data("vocab");
  const lookup = glossLookup(GL_WORDS, GL_PHRASES, vocab);
  // one object the stage keeps: switching `open` on and off below changes which popup opens
  const GLOSS: GlossOptions = { lookup, speak };
  css("sys-gloss", `.gl-log p { margin: 2px 0; font-size: 16px; } .gl-log b { color: var(--mute); margin-right: 6px; }
.gl-own { min-height: 48px; } .gl-own strong { font-size: 18px; margin-right: 8px; } .gl-own [dir=rtl] { margin-left: 8px; }`);

  host.append($("h2", "", "The bubbles' words"), $("p", "note", `Play a line, then tap a dotted word in its bubble: a small popup gives the word in English and Persian (with its dictionary form for an inflected word: ekmeği → ekmek, and a note), and a speak button. A tap elsewhere, the same word again, Escape or the next cue closes it. A fixed chunk wins for every word in it (hoş geldiniz, başka bir şey). Sound words are Turkish too: çın çın is glossable while its bubble shows (sound off, or captions on). ${vocab.length} A1 cards loaded.`));
  const shop = bench(host, ctx, {
    places: [BAKKAL], cast: { ismail: ISMAIL, nima: NIMA }, cues: [OPENING[0]],
    stage: { gloss: GLOSS, glosses: true },
    load: { names: NAMES, narrator: "kerim" },
  });
  const log = $("div", "card gl-log");
  log.append($("small", "", "The app's own log: the same glossInto, so a word taps the same way here."));
  const own = $("div", "card gl-own", "");
  own.hidden = true;
  // each line button plays the cue and writes the line into the log
  const say = (label: string, cue: Cue) => shop.cue(label, () => {
    const l = "line" in cue ? (cue as LineCue).line : null;
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
    bar("lines", ...lines.map((c, i) => say(`${i + 1}. ${(c as LineCue).line.text}`, c))),
    bar("", shop.cue("back to the start", OPENING[0]), say("çın çın (a sound word)", { beat: { sfx: { id: "doorbell", word: "çın çın", at: "mark:door" } } })),
    bar("glosses",
      toggle("on", true, on => { glossesOn = on; shop.stage.setGlosses(on); }, "setGlosses: off, the bubbles are plain text"),
      toggle("the app's own popup", false, on => {
        GLOSS.open = on ? (word: string, g: Gloss) => {
          own.hidden = false;
          own.replaceChildren($("strong", "", g.head ? `${word} → ${g.head}` : word), ...g.lines.map(l => Object.assign($("span", "", l.text), { dir: l.dir ?? "ltr", lang: l.lang ?? "" })), g.note ? $("small", "", ` · ${g.note}`) : "");
        } : undefined;
        own.hidden = !on;
        if (glossesOn) { shop.stage.setGlosses(false); shop.stage.setGlosses(true); }
      }, "GlossOptions.open: the app shows the gloss its own way (here, the card below)"),
    ),
    own, log,
  );

  // ---- the lookup alone ----
  host.append($("h2", "", "The lookup"), $("p", "note", "What the app's lookup answers for a word in a line: the scene's glosses, then a card, then the card an inflected word is a form of (sahne-tr's match). A word without a gloss gets no underline."));
  const input = Object.assign($("input"), { type: "text", value: "ekmeği" }), out = $("pre", "log");
  const test = () => {
    const w = input.value.trim(), g = w ? lookup(w, { text: w, lang: "tr" }) : null;
    out.textContent = g ? JSON.stringify(g) : `${w}: no gloss (no underline)`;
  };
  input.oninput = test;
  host.append(bar("word", input, ...["ekmeği", "sütü", "geldiniz", "buyrun", "taze", "Nima'nın", "acaba"].map(w => Object.assign($("button", "", w), { type: "button", onclick: () => { input.value = w; test(); } }))), out);
  test();
}
