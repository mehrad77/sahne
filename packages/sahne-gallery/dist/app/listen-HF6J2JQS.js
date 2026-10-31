import {
  canListen,
  cannotListen,
  listenFor,
  micPermission,
  replyCard,
  resetListen
} from "./chunk-NPVNJND5.js";
import {
  BAKKAL,
  ISMAIL,
  NIMA
} from "./chunk-VFMRH5SO.js";
import {
  bench
} from "./chunk-ZRNRQOB7.js";
import "./chunk-J3KVAIQI.js";
import {
  $,
  bar,
  button,
  chip,
  choice
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/listen.ts
var go = (...words) => [{ t: 150, ev: "start" }, { t: 500, ev: "speech" }, ...words.slice(0, -1).map((w, i) => ({ t: 800 + i * 350, interim: w })), { t: 800 + words.length * 350, final: words[words.length - 1].split("|") }, { t: 900 + words.length * 350, ev: "end" }];
var fail = (error) => [{ t: 150, ev: "start" }, { t: 700, error }, { t: 750, ev: "end" }];
function fake(steps) {
  return class {
    lang = "";
    interimResults = true;
    maxAlternatives = 5;
    continuous = false;
    onstart = null;
    onspeechstart = null;
    onresult = null;
    onerror = null;
    onend = null;
    timers = [];
    ended = false;
    result(alts, isFinal) {
      this.onresult?.({ resultIndex: 0, results: [Object.assign(alts.map((transcript) => ({ transcript })), { isFinal })] });
    }
    start() {
      for (const s of steps) this.timers.push(setTimeout(() => {
        if ("ev" in s) {
          if (s.ev === "start") this.onstart?.();
          else if (s.ev === "speech") this.onspeechstart?.();
          else this.end();
        } else if ("interim" in s) this.result([s.interim], false);
        else if ("final" in s) this.result(s.final, true);
        else this.onerror?.({ error: s.error });
      }, s.t));
    }
    end() {
      if (this.ended) return;
      this.ended = true;
      for (const t of this.timers) clearTimeout(t);
      this.onend?.();
    }
    stop() {
      setTimeout(() => this.end(), 60);
    }
    abort() {
      this.end();
    }
  };
}
var SAY = ["Ekmek var m\u0131? S\xFCt var m\u0131?"];
var CHOOSE = ["\u0130ki ekmek, l\xFCtfen.", "\u0130ki ekmek ver."];
var SCENES = {
  "says the line": { steps: go("ekmek", "ekmek var m\u0131", "ekmek var m\u0131 s\xFCt", "ekmek var m\u0131 s\xFCt var m\u0131"), note: "interim words arrive; listening stops early once they already are the line" },
  "joins words": { steps: go("ekmek varm\u0131", "ekmek varm\u0131 s\xFCt varm\u0131|ekmek var m\u0131 s\xFCt varm\u0131"), note: "a recogniser's joins (varm\u0131) are forgiven" },
  "a word before": { steps: go("evet", "evet ekmek var m\u0131 s\xFCt var m\u0131"), note: "an extra word before the line is forgiven" },
  "something else": { steps: go("simit", "simit var m\u0131"), note: "a different word never passes: best \u22121" },
  "the blunt option": { steps: go("iki ekmek", "iki ekmek ver"), choose: true, note: "on a choice, the closest option within its allowance is the pick" },
  "silence": { steps: [{ t: 150, ev: "start" }], note: "nobody speaks: no-speech after the silence limit (here 2.5 s, 6 s by default)" },
  "speaks on and on": { steps: [{ t: 150, ev: "start" }, { t: 400, ev: "speech" }], note: "speech starts but no words come: timeout (here 4 s, 12 s by default)" },
  "mic refused": { steps: fail("not-allowed"), note: "denied: the microphone stays hidden for the page's life, until resetListen()" },
  "network": { steps: fail("network"), note: "Chrome's recogniser is a server" },
  "odd error": { steps: fail("bad-grammar"), note: "an error the module does not know: error" },
  "taps S\xF6yle": { steps: go("ekmek", "ekmek var", "ekmek var m\u0131 s\xFCt var m\u0131"), abortAt: 1e3, note: "the learner tapped instead: the signal aborts, aborted" },
  "no recogniser": { env: { Recognition: null }, note: "Firefox: unsupported" },
  "http": { env: { Recognition: fake([]), secure: false }, note: "not a secure context: insecure" },
  "offline": { env: { Recognition: fake([]), online: false }, note: "offline: Chrome's recogniser needs the network" }
};
function build(host, ctx) {
  host.append($("p", "note", "The reply card listens for the learner's line in tr-TR with interim results and five alternatives; the plugin's matchLine decides whether what was heard is the line. It never rejects: every ending resolves, with error saying why nothing was heard, and a tap always works. Where listening is impossible (cannotListen says why) the card hides its microphone."));
  const shop = bench(host, ctx, { places: [BAKKAL], cast: { ismail: ISMAIL, nima: NIMA }, cues: [{ scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "customer" } } }] });
  const perform = (text) => shop.play({ line: { who: "nima", text, to: "ismail" } });
  host.append($("h2", "", "A pretend microphone"), $("p", "note", "Each button is what the learner (and the browser) does; the states light up as listenFor reports them, the interim text shows as it comes, and the result is printed. When the line is heard, Nima says it."));
  let expected = SAY;
  const states = Object.fromEntries(["starting", "listening", "hearing", "done"].map((s) => [s, chip(s)]));
  const interim = $("span", "note"), out = $("pre", "log"), can = $("p", "note");
  const showCan = () => {
    const why = cannotListen();
    can.textContent = `This page: canListen() ${canListen()}${why ? `, cannotListen() "${why}"` : ""}.`;
  };
  let ctl = null;
  ctx.cleanup(() => ctl?.abort());
  const run = async (name) => {
    ctl?.abort();
    const sc = SCENES[name], mine = ctl = new AbortController();
    if (sc.choose) {
      expected = CHOOSE;
      card.set("choose");
    }
    for (const c of Object.values(states)) c.className = "chip";
    interim.textContent = "";
    out.textContent = `${name}: ${sc.note}\u2026`;
    if (sc.abortAt) setTimeout(() => mine.abort(), sc.abortAt);
    const env = sc.env ?? { Recognition: fake(sc.steps ?? []), online: true, secure: true };
    const t0 = performance.now();
    const r = await listenFor(expected, ctx.lang, { env, signal: mine.signal, silence: 2500, timeout: 4e3, onState: (s) => {
      states[s].className = "chip ok";
    }, onInterim: (t) => {
      interim.textContent = `\u201C${t}\u201D`;
    } });
    out.textContent = `${name}: ${sc.note}
after ${Math.round(performance.now() - t0)} ms \u2192 ${JSON.stringify(r, null, 1)}`;
    if (r.matched && r.best >= 0) perform(expected[r.best]);
    showCan();
  };
  const card = choice("card", ["say", "choose"], "say", (c) => {
    expected = c === "say" ? SAY : CHOOSE;
  }, { say: `say: ${SAY[0]}`, choose: `choose: ${CHOOSE.join(" / ")}` });
  host.append(
    card,
    bar("heard", ...Object.keys(SCENES).slice(0, 5).map((n) => button(n, () => void run(n), void 0, SCENES[n].note))),
    bar("not heard", ...Object.keys(SCENES).slice(5).map((n) => button(n, () => void run(n), void 0, SCENES[n].note))),
    bar("states", ...Object.values(states), interim),
    out,
    bar("", button("resetListen()", () => {
      resetListen();
      showCan();
    }, void 0, "forget a refusal (the learner allowed the microphone in the browser's settings)")),
    can
  );
  showCan();
  host.append($("h2", "", "The matching"), $("p", "note", "Both sides become spoken words (Turkish lower case, numerals in words, no punctuation or fillers), then a word-level edit distance weighted by letters. The allowance grows with length: none in a short word, one letter in a short phrase, about one in six beyond."));
  const table = $("table", "t");
  table.append(Object.assign($("tr"), { innerHTML: "<th>heard</th><th>expected</th><th>matched</th><th>best</th><th>score</th>" }));
  const PAIRS = [["ho\u015Fgeldiniz", ["Ho\u015F geldiniz!"]], ["ekmek var mi s\xFCt var mi", SAY], ["\u0131\u0131 ekmek var m\u0131 s\xFCt var m\u0131", SAY], ["iki ekmek l\xFCtfen", CHOOSE], ["iki ekmek ver", CHOOSE], ["2 ekmek l\xFCtfen", CHOOSE], ["benim ad\u0131m nima", ["Benim ad\u0131m Nima."]], ["s\xFCt yok", ["S\xFCt var."]]];
  for (const [heard, exp] of PAIRS) {
    const m = ctx.lang.matchLine(heard, exp), tr = $("tr");
    for (const v of [heard, exp.join(" / "), String(m.matched), String(m.best), m.score.toFixed(2)]) tr.append($("td", "", v));
    table.append(tr);
  }
  host.append(table);
  host.append($("h2", "", "The real microphone"), $("p", "note", "The gallery's reply card with listening on. Chrome and Safari listen (Chrome sends the audio to Google's server); elsewhere the card shows no microphone and the tap is the only way."));
  const perm = $("p", "note");
  void micPermission().then((p) => {
    perm.textContent = `Microphone permission: ${p}.`;
  });
  const reply = replyCard({
    label: "Nima",
    options: [{ tr: SAY[0], en: "Is there bread? Is there milk?" }],
    translate: true,
    text: (el, tr) => {
      el.textContent = tr;
    },
    onPick: (k) => perform(SAY[k]),
    aloud: canListen() ? (exp, onInterim, signal) => listenFor(exp, ctx.lang, { signal, onInterim }) : void 0
  });
  host.append(perm, reply, $("p", "note", canListen() ? "Press \u{1F3A4} and say the line, or tap S\xF6yle." : `No microphone here: cannotListen() is "${cannotListen()}". S\xF6yle still works.`));
}
export {
  build
};
//# sourceMappingURL=listen-HF6J2JQS.js.map
