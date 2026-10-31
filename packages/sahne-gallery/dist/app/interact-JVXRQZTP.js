import {
  glossLookup
} from "./chunk-GNC44ETW.js";
import "./chunk-ZT53KTYM.js";
import {
  BAKKAL,
  GL_PHRASES,
  GL_WORDS,
  ISMAIL,
  NIMA,
  VOICES
} from "./chunk-VFMRH5SO.js";
import {
  $,
  bar,
  button,
  css,
  frame,
  toggle
} from "./chunk-4TGKXDN4.js";
import {
  interact
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/interact.ts
var PLACE = {
  ...BAKKAL,
  pieces: BAKKAL.pieces.map((p) => p.id === "door" ? { ...p, terms: ["a1-w-kapi"] } : p),
  marks: { ...BAKKAL.marks, buzdolabi: { x: -2.3, z: -1.2, facing: "r" } }
};
var NAMES = {
  ismail: "\u0130smail",
  nima: "Nima",
  "obj:ekmek": "ekmek",
  "obj:simit": "simit",
  "obj:sut": "s\xFCt",
  "mark:customer": "tezg\xE2h",
  "mark:front": "orta",
  "mark:buzdolabi": "buzdolab\u0131",
  "piece:door": "kap\u0131"
};
var asks = { who: "nima", by: "ismail" };
var CUES = [
  { scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "door" } } },
  { line: { who: "ismail", text: "Ho\u015F geldiniz! Tezg\xE2ha gelin.", to: "nima", do: "welcome", emo: "happy" } },
  { act: { kind: "go", prompt: "Tezg\xE2ha git.", targets: ["mark:customer", "mark:front", "mark:buzdolabi"], expect: "mark:customer", ...asks } },
  { line: { who: "ismail", text: "Buyrun. Ne istersiniz?", to: "nima" } },
  { act: { kind: "tap", prompt: "Ekmek hangisi? Ekme\u011Fe dokun.", targets: ["obj:ekmek", "obj:simit", "obj:sut"], expect: "obj:ekmek", ...asks } },
  { line: { who: "ismail", text: "Evet, bu ekmek. \xC7ok taze!", do: "point", at: "obj:ekmek", link: { ekmek: "obj:ekmek" } } },
  { act: { kind: "choose", prompt: "Ekmek mi, simit mi?", targets: ["obj:ekmek", "obj:simit"], ...asks } },
  { line: { who: "ismail", text: "Tamam! S\xFCt de var. S\xFCt\xFC al\u0131n.", do: "point", at: "obj:sut", link: { s\u00FCt: "obj:sut", s\u00FCt\u00FC: "obj:sut" } } },
  { act: { kind: "drag", prompt: "S\xFCt\xFC al.", obj: "sut", targets: ["ch:nima", "ch:ismail"], expect: "ch:nima", ...asks } },
  { line: { who: "ismail", text: "\u015Eimdi s\xFCt\xFC bana verin, l\xFCtfen.", to: "nima", do: "beckon" } },
  { act: { kind: "drag", prompt: "S\xFCt\xFC \u0130smail'e ver.", obj: "sut", targets: ["ch:ismail", "ch:nima"], expect: "ch:ismail", ...asks } },
  { line: { who: "ismail", text: "Te\u015Fekk\xFCrler! Afiyet olsun.", emo: "happy", do: "nod" } }
];
async function build(host, ctx) {
  const lookup = glossLookup(GL_WORDS, GL_PHRASES, await ctx.data("vocab"));
  css("sys-interact", `.ix-foot .card { display: grid; gap: 8px; } .ix-foot .card p { margin: 0; font-size: 18px; } .ix-foot .row { display: flex; gap: 6px; flex-wrap: wrap; }
.ix-word { min-height: 44px; } .ix-word strong { font-size: 18px; margin-right: 8px; } .ix-word span { color: var(--mute); }`);
  host.append($("p", "note", "Play the scene with the footer's button. On an act the stage waits: tap (or click) on stage, or drag the milk. Try a wrong target twice to see the hint (\u0130smail looks at the answer, it glows), a third time to see it shown. No colour means right or wrong. Tab into the stage for the accessible list (or turn it on). The act cue being played is printed under the stage; the jump buttons start at each kind of act."));
  const box = frame("16 / 10");
  host.append(box);
  const stage = ctx.mount(box);
  const ix = interact(stage, { explore: true, list: "auto" });
  stage.load({ v: 1, cues: CUES }, { cast: { ismail: ISMAIL, nima: NIMA }, places: { bakkal: PLACE }, tempo: { ismail: 1.1 }, names: NAMES, voices: VOICES, terms: { ismail: ["a1-w-bakkal"], nima: [] } });
  const panel = $("pre", "log cue"), foot = $("div", "ix-foot"), word = $("div", "card ix-word"), events = $("div", "log"), story = $("div", "card");
  word.textContent = "Tap a person or a thing on stage (explore is on): its word shows here.";
  host.append(panel, foot);
  const read = (kind, text) => {
    events.prepend(`${(performance.now() / 1e3).toFixed(1).padStart(6)}s  ${kind.padEnd(9)} ${text}
`);
  };
  ix.on("inspect", (e) => {
    const name = e.name ?? e.id, g = lookup(name, { text: name, who: "", lang: "tr" });
    word.replaceChildren($("strong", "", name), $("span", "", [g?.lines.map((l) => l.text).join(" \xB7 "), e.part ? `(${e.part})` : "", e.terms.length ? `terms: ${e.terms.join(", ")}` : ""].filter(Boolean).join("  ")));
    read("inspect", `${e.target} via ${e.via}${e.terms.length ? " \u2192 " + e.terms.join(",") : ""}`);
  });
  ix.on("act", (e) => {
    const r = e.result;
    read("act " + e.phase, `cue ${e.cue} ${e.act.kind}${e.target ? " " + e.target : ""} misses ${e.misses}` + (r ? ` \u2192 ${r.target} (hinted ${r.hinted}, shown ${r.shown}, via ${r.via}, tries ${r.tries.join(" ") || "-"})` : ""));
  });
  let next = 1, run = null;
  const actOf = (c) => c && "act" in c ? c.act : null;
  const isAct = (r) => !!r && "result" in r;
  const busy = () => !!run && (isAct(run) ? !run.answered || stage.now() < run.dur : stage.now() < run.dur);
  const say = (who, text) => {
    story.append(Object.assign($("p"), { textContent: `${NAMES[who] ?? who}: ${text}` }));
  };
  function playCue(i) {
    const c = stage.script.cues[i];
    if (c && "line" in c) say(c.line.who, c.line.text);
    panel.textContent = JSON.stringify(c, null, 1).replace(/\n\s*/g, " ");
    const r = run = stage.play(i);
    next = i + 1;
    if (isAct(r)) r.result.then((res) => {
      r.answered = true;
      say("nima", `(${res.target ? NAMES[res.target.split("#")[0]] ?? res.target : "\u2014"})`);
      render();
    });
    r.done.then(() => {
      if (run === r) render();
    });
    render();
  }
  function render() {
    foot.replaceChildren();
    foot.dataset.cue = busy() ? "" : String(next);
    const cues = stage.script.cues;
    if (isAct(run) && !run.answered) {
      const a = run, card = $("div", "card");
      card.append($("small", "", `Nima \u2014 ${a.act.kind}`), $("p", "", a.act.prompt ?? ""));
      const row = $("div", "row");
      row.append(button("keyboard list", () => ix.focus()), button("skip \u25B8 (shows the answer)", () => a.skip()));
      card.append(row);
      foot.append(card);
      return;
    }
    if (run && stage.now() < run.dur) {
      foot.append(Object.assign(button("Devam \u25B8", () => {
        run?.finish();
        render();
      }), { className: "primary" }));
      return;
    }
    if (next >= cues.length) {
      foot.append(Object.assign(button("Ba\u015Ftan \u21BA", () => restart(0)), { className: "primary" }));
      return;
    }
    foot.append(Object.assign(button(actOf(cues[next]) ? "Your turn \u25B8" : "Devam \u25B8", () => playCue(next)), { className: "primary" }));
  }
  function restart(at) {
    stage.setCues(0, CUES);
    story.replaceChildren();
    run = null;
    next = at + 1;
    stage.show(at);
    render();
  }
  const timer = setInterval(() => {
    if (foot.dataset.cue !== (busy() ? "" : String(next))) render();
  }, 250);
  ctx.cleanup(() => clearInterval(timer));
  restart(0);
  const jump = (kind, i) => button(kind, () => {
    restart(i - 1);
    playCue(i);
  }, void 0, `start at cue ${i}`);
  host.append(
    bar("jump to", jump("go", 2), jump("tap", 4), jump("choose", 6), jump("drag (take)", 8), jump("drag (give)", 10)),
    bar("explore", toggle("on", true, (on) => ix.setExplore(on), "a tap on a person or a thing raises inspect with its terms")),
    bar("list", toggle("always shown", false, (on) => ix.setList(on ? "always" : "auto"), "the buttons for keyboards and screen readers: always, or when Tab reaches them")),
    word,
    $("h3", "", "The story so far"),
    story,
    $("h3", "", "Events"),
    events
  );
}
export {
  build
};
//# sourceMappingURL=interact-JVXRQZTP.js.map
