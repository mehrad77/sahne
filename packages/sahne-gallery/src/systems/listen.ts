// Say it aloud (DESIGN.md §9): sahne/listen with a pretend microphone (an injected ListenEnv whose
// recogniser plays a script of events), so every state and every ListenError can be seen anywhere;
// the plugin's matching (sahne-tr's matchLine) on a few transcripts; and the real microphone on the
// gallery's reply card where the browser can listen. A line heard is performed by Nima on the stage.

import { canListen, cannotListen, listenFor, micPermission, resetListen, type ListenEnv, type ListenState, type Recognition, type RecognitionCtor, type RecognitionEvent } from "sahne/listen";
import { $, bar, button, chip, choice } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { BAKKAL, ISMAIL, NIMA } from "../bakkal.ts";
import { replyCard } from "../card.ts";
import { bench } from "./bench.ts";

/** One step of a pretend recogniser: an event at `t` ms after start(). */
type Step = { t: number; ev: "start" | "speech" | "end" } | { t: number; interim: string } | { t: number; final: string[] } | { t: number; error: string };
const go = (...words: string[]): Step[] => [{ t: 150, ev: "start" }, { t: 500, ev: "speech" }, ...words.slice(0, -1).map((w, i) => ({ t: 800 + i * 350, interim: w })), { t: 800 + words.length * 350, final: words[words.length - 1].split("|") }, { t: 900 + words.length * 350, ev: "end" }];
const fail = (error: string): Step[] => [{ t: 150, ev: "start" }, { t: 700, error }, { t: 750, ev: "end" }];

/** A recogniser that plays `steps`; stop() ends it at once with what it has, abort() too. */
function fake(steps: Step[]): RecognitionCtor {
  return class implements Recognition {
    lang = ""; interimResults = true; maxAlternatives = 5; continuous = false;
    onstart: (() => void) | null = null; onspeechstart: (() => void) | null = null; onresult: ((e: RecognitionEvent) => void) | null = null;
    onerror: ((e: { error: string }) => void) | null = null; onend: (() => void) | null = null;
    private timers: ReturnType<typeof setTimeout>[] = []; private ended = false;
    private result(alts: string[], isFinal: boolean) { this.onresult?.({ resultIndex: 0, results: [Object.assign(alts.map(transcript => ({ transcript })), { isFinal })] }); }
    start() {
      for (const s of steps) this.timers.push(setTimeout(() => {
        if ("ev" in s) { if (s.ev === "start") this.onstart?.(); else if (s.ev === "speech") this.onspeechstart?.(); else this.end(); }
        else if ("interim" in s) this.result([s.interim], false);
        else if ("final" in s) this.result(s.final, true);
        else this.onerror?.({ error: s.error });
      }, s.t));
    }
    private end() { if (this.ended) return; this.ended = true; for (const t of this.timers) clearTimeout(t); this.onend?.(); }
    stop() { setTimeout(() => this.end(), 60); }
    abort() { this.end(); }
  };
}

const SAY = ["Ekmek var mı? Süt var mı?"], CHOOSE = ["İki ekmek, lütfen.", "İki ekmek ver."];
/** What the pretend learner does: steps, or a whole env (no recogniser, not secure, offline), and options. */
const SCENES: Record<string, { steps?: Step[]; env?: ListenEnv; abortAt?: number; choose?: boolean; note: string }> = {
  "says the line": { steps: go("ekmek", "ekmek var mı", "ekmek var mı süt", "ekmek var mı süt var mı"), note: "interim words arrive; listening stops early once they already are the line" },
  "joins words": { steps: go("ekmek varmı", "ekmek varmı süt varmı|ekmek var mı süt varmı"), note: "a recogniser's joins (varmı) are forgiven" },
  "a word before": { steps: go("evet", "evet ekmek var mı süt var mı"), note: "an extra word before the line is forgiven" },
  "something else": { steps: go("simit", "simit var mı"), note: "a different word never passes: best −1" },
  "the blunt option": { steps: go("iki ekmek", "iki ekmek ver"), choose: true, note: "on a choice, the closest option within its allowance is the pick" },
  "silence": { steps: [{ t: 150, ev: "start" }], note: "nobody speaks: no-speech after the silence limit (here 2.5 s, 6 s by default)" },
  "speaks on and on": { steps: [{ t: 150, ev: "start" }, { t: 400, ev: "speech" }], note: "speech starts but no words come: timeout (here 4 s, 12 s by default)" },
  "mic refused": { steps: fail("not-allowed"), note: "denied: the microphone stays hidden for the page's life, until resetListen()" },
  "network": { steps: fail("network"), note: "Chrome's recogniser is a server" },
  "odd error": { steps: fail("bad-grammar"), note: "an error the module does not know: error" },
  "taps Söyle": { steps: go("ekmek", "ekmek var", "ekmek var mı süt var mı"), abortAt: 1000, note: "the learner tapped instead: the signal aborts, aborted" },
  "no recogniser": { env: { Recognition: null }, note: "Firefox: unsupported" },
  "http": { env: { Recognition: fake([]), secure: false }, note: "not a secure context: insecure" },
  "offline": { env: { Recognition: fake([]), online: false }, note: "offline: Chrome's recogniser needs the network" },
};

export function build(host: HTMLElement, ctx: Ctx) {
  host.append($("p", "note", "The reply card listens for the learner's line in tr-TR with interim results and five alternatives; the plugin's matchLine decides whether what was heard is the line. It never rejects: every ending resolves, with error saying why nothing was heard, and a tap always works. Where listening is impossible (cannotListen says why) the card hides its microphone."));
  const shop = bench(host, ctx, { places: [BAKKAL], cast: { ismail: ISMAIL, nima: NIMA }, cues: [{ scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "customer" } } }] });
  const perform = (text: string) => shop.play({ line: { who: "nima", text, to: "ismail" } });

  // ---- the pretend microphone ----
  host.append($("h2", "", "A pretend microphone"), $("p", "note", "Each button is what the learner (and the browser) does; the states light up as listenFor reports them, the interim text shows as it comes, and the result is printed. When the line is heard, Nima says it."));
  let expected = SAY;
  const states = Object.fromEntries((["starting", "listening", "hearing", "done"] as ListenState[]).map(s => [s, chip(s)])) as Record<ListenState, HTMLElement>;
  const interim = $("span", "note"), out = $("pre", "log"), can = $("p", "note");
  const showCan = () => { const why = cannotListen(); can.textContent = `This page: canListen() ${canListen()}${why ? `, cannotListen() "${why}"` : ""}.`; };
  let ctl: AbortController | null = null;
  ctx.cleanup(() => ctl?.abort());
  const run = async (name: string) => {
    ctl?.abort();
    const sc = SCENES[name], mine = ctl = new AbortController();
    if (sc.choose) { expected = CHOOSE; card.set("choose"); }
    for (const c of Object.values(states)) c.className = "chip";
    interim.textContent = ""; out.textContent = `${name}: ${sc.note}…`;
    if (sc.abortAt) setTimeout(() => mine.abort(), sc.abortAt);
    const env = sc.env ?? { Recognition: fake(sc.steps ?? []), online: true, secure: true };
    const t0 = performance.now();
    const r = await listenFor(expected, ctx.lang, { env, signal: mine.signal, silence: 2500, timeout: 4000, onState: s => { states[s].className = "chip ok"; }, onInterim: t => { interim.textContent = `“${t}”`; } });
    out.textContent = `${name}: ${sc.note}\nafter ${Math.round(performance.now() - t0)} ms → ${JSON.stringify(r, null, 1)}`;
    if (r.matched && r.best >= 0) perform(expected[r.best]);
    showCan();
  };
  const card = choice("card", ["say", "choose"] as const, "say", c => { expected = c === "say" ? SAY : CHOOSE; }, { say: `say: ${SAY[0]}`, choose: `choose: ${CHOOSE.join(" / ")}` });
  host.append(
    card,
    bar("heard", ...Object.keys(SCENES).slice(0, 5).map(n => button(n, () => void run(n), undefined, SCENES[n].note))),
    bar("not heard", ...Object.keys(SCENES).slice(5).map(n => button(n, () => void run(n), undefined, SCENES[n].note))),
    bar("states", ...Object.values(states), interim),
    out, bar("", button("resetListen()", () => { resetListen(); showCan(); }, undefined, "forget a refusal (the learner allowed the microphone in the browser's settings)")), can,
  );
  showCan();

  // ---- the matching ----
  host.append($("h2", "", "The matching"), $("p", "note", "Both sides become spoken words (Turkish lower case, numerals in words, no punctuation or fillers), then a word-level edit distance weighted by letters. The allowance grows with length: none in a short word, one letter in a short phrase, about one in six beyond."));
  const table = $("table", "t");
  table.append(Object.assign($("tr"), { innerHTML: "<th>heard</th><th>expected</th><th>matched</th><th>best</th><th>score</th>" }));
  const PAIRS: [string, string[]][] = [["hoşgeldiniz", ["Hoş geldiniz!"]], ["ekmek var mi süt var mi", SAY], ["ıı ekmek var mı süt var mı", SAY], ["iki ekmek lütfen", CHOOSE], ["iki ekmek ver", CHOOSE], ["2 ekmek lütfen", CHOOSE], ["benim adım nima", ["Benim adım Nima."]], ["süt yok", ["Süt var."]]];
  for (const [heard, exp] of PAIRS) {
    const m = ctx.lang.matchLine!(heard, exp), tr = $("tr");
    for (const v of [heard, exp.join(" / "), String(m.matched), String(m.best), m.score.toFixed(2)]) tr.append($("td", "", v));
    table.append(tr);
  }
  host.append(table);

  // ---- the real microphone ----
  host.append($("h2", "", "The real microphone"), $("p", "note", "The gallery's reply card with listening on. Chrome and Safari listen (Chrome sends the audio to Google's server); elsewhere the card shows no microphone and the tap is the only way."));
  const perm = $("p", "note");
  void micPermission().then(p => { perm.textContent = `Microphone permission: ${p}.`; });
  const reply = replyCard({
    label: "Nima", options: [{ tr: SAY[0], en: "Is there bread? Is there milk?" }], translate: true,
    text: (el, tr) => { el.textContent = tr; },
    onPick: k => perform(SAY[k]),
    aloud: canListen() ? (exp, onInterim, signal) => listenFor(exp, ctx.lang, { signal, onInterim }) : undefined,
  });
  host.append(perm, reply, $("p", "note", canListen() ? "Press 🎤 and say the line, or tap Söyle." : `No microphone here: cannotListen() is "${cannotListen()}". Söyle still works.`));
}
