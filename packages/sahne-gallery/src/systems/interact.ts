// The learner acts (DESIGN.md §9): a short bakkal scene with one act cue of each kind (go to the
// counter, tap "ekmek", choose between the bread and the simit, drag the milk to Nima and then out of
// her hand to İsmail), played cue by cue with a story footer. Misses count: the second brings the
// hint (a look and a glow), the third shows the answer and the story goes on. Explore turns taps on
// people and things into `inspect` events (their word below); the accessible list is the act's
// targets as buttons. Every event is printed.

import { interact, type Act, type ActRun, type Cue, type LineCue, type PlaceDoc, type Run } from "sahne";
import { $, bar, button, css, frame, toggle } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { BAKKAL, NIMA, ISMAIL, VOICES, GL_WORDS, GL_PHRASES } from "../bakkal.ts";
import { glossLookup } from "../gloss.ts";

// the bakkal with a spot by the fridge to walk to, and its door's word
const PLACE: PlaceDoc = {
  ...BAKKAL,
  pieces: BAKKAL.pieces.map(p => p.id === "door" ? { ...p, terms: ["a1-w-kapi"] } : p),
  marks: { ...BAKKAL.marks, buzdolabi: { x: -2.3, z: -1.2, facing: "r" } },
};
const NAMES: Record<string, string> = {
  ismail: "İsmail", nima: "Nima", "obj:ekmek": "ekmek", "obj:simit": "simit", "obj:sut": "süt",
  "mark:customer": "tezgâh", "mark:front": "orta", "mark:buzdolabi": "buzdolabı", "piece:door": "kapı",
};
const asks = { who: "nima", by: "ismail" };
const CUES: Cue[] = [
  { scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "door" } } },
  { line: { who: "ismail", text: "Hoş geldiniz! Tezgâha gelin.", to: "nima", do: "welcome", emo: "happy" } },
  { act: { kind: "go", prompt: "Tezgâha git.", targets: ["mark:customer", "mark:front", "mark:buzdolabi"], expect: "mark:customer", ...asks } },
  { line: { who: "ismail", text: "Buyrun. Ne istersiniz?", to: "nima" } },
  { act: { kind: "tap", prompt: "Ekmek hangisi? Ekmeğe dokun.", targets: ["obj:ekmek", "obj:simit", "obj:sut"], expect: "obj:ekmek", ...asks } },
  { line: { who: "ismail", text: "Evet, bu ekmek. Çok taze!", do: "point", at: "obj:ekmek", link: { ekmek: "obj:ekmek" } } },
  { act: { kind: "choose", prompt: "Ekmek mi, simit mi?", targets: ["obj:ekmek", "obj:simit"], ...asks } },
  { line: { who: "ismail", text: "Tamam! Süt de var. Sütü alın.", do: "point", at: "obj:sut", link: { süt: "obj:sut", sütü: "obj:sut" } } },
  { act: { kind: "drag", prompt: "Sütü al.", obj: "sut", targets: ["ch:nima", "ch:ismail"], expect: "ch:nima", ...asks } },
  { line: { who: "ismail", text: "Şimdi sütü bana verin, lütfen.", to: "nima", do: "beckon" } },
  { act: { kind: "drag", prompt: "Sütü İsmail'e ver.", obj: "sut", targets: ["ch:ismail", "ch:nima"], expect: "ch:ismail", ...asks } },
  { line: { who: "ismail", text: "Teşekkürler! Afiyet olsun.", emo: "happy", do: "nod" } },
];

export async function build(host: HTMLElement, ctx: Ctx) {
  const lookup = glossLookup(GL_WORDS, GL_PHRASES, await ctx.data("vocab"));
  css("sys-interact", `.ix-foot .card { display: grid; gap: 8px; } .ix-foot .card p { margin: 0; font-size: 18px; } .ix-foot .row { display: flex; gap: 6px; flex-wrap: wrap; }
.ix-word { min-height: 44px; } .ix-word strong { font-size: 18px; margin-right: 8px; } .ix-word span { color: var(--mute); }`);
  host.append($("p", "note", "Play the scene with the footer's button. On an act the stage waits: tap (or click) on stage, or drag the milk. Try a wrong target twice to see the hint (İsmail looks at the answer, it glows), a third time to see it shown. No colour means right or wrong. Tab into the stage for the accessible list (or turn it on). The act cue being played is printed under the stage; the jump buttons start at each kind of act."));

  const box = frame("16 / 10");
  host.append(box);
  const stage = ctx.mount(box);
  // the interaction layer goes on before the scene loads, so the atlas gets its alpha masks
  const ix = interact(stage, { explore: true, list: "auto" });
  stage.load({ v: 1, cues: CUES }, { cast: { ismail: ISMAIL, nima: NIMA }, places: { bakkal: PLACE }, tempo: { ismail: 1.1 }, names: NAMES, voices: VOICES, terms: { ismail: ["a1-w-bakkal"], nima: [] } });

  const panel = $("pre", "log cue"), foot = $("div", "ix-foot"), word = $("div", "card ix-word"), events = $("div", "log"), story = $("div", "card");
  word.textContent = "Tap a person or a thing on stage (explore is on): its word shows here.";
  host.append(panel, foot);

  const read = (kind: string, text: string) => { events.prepend(`${(performance.now() / 1000).toFixed(1).padStart(6)}s  ${kind.padEnd(9)} ${text}\n`); };
  ix.on("inspect", e => {
    const name = e.name ?? e.id, g = lookup(name, { text: name, who: "", lang: "tr" });
    word.replaceChildren($("strong", "", name), $("span", "", [g?.lines.map(l => l.text).join(" · "), e.part ? `(${e.part})` : "", e.terms.length ? `terms: ${e.terms.join(", ")}` : ""].filter(Boolean).join("  ")));
    read("inspect", `${e.target} via ${e.via}${e.terms.length ? " → " + e.terms.join(",") : ""}`);
  });
  ix.on("act", e => {
    const r = e.result;
    read("act " + e.phase, `cue ${e.cue} ${e.act.kind}${e.target ? " " + e.target : ""} misses ${e.misses}` + (r ? ` → ${r.target} (hinted ${r.hinted}, shown ${r.shown}, via ${r.via}, tries ${r.tries.join(" ") || "-"})` : ""));
  });

  // ---- the footer: Devam, the act card, the story so far ----
  let next = 1, run: (Run & { answered?: boolean }) | null = null;
  const actOf = (c: Cue | undefined): Act | null => c && "act" in c ? c.act : null;
  const isAct = (r: Run | null): r is ActRun & { answered?: boolean } => !!r && "result" in r;
  const busy = () => !!run && (isAct(run) ? !run.answered || stage.now() < run.dur : stage.now() < run.dur);
  const say = (who: string, text: string) => { story.append(Object.assign($("p"), { textContent: `${NAMES[who] ?? who}: ${text}` })); };

  function playCue(i: number) {
    const c = stage.script.cues[i];
    if (c && "line" in c) say((c as LineCue).line.who, (c as LineCue).line.text);
    panel.textContent = JSON.stringify(c, null, 1).replace(/\n\s*/g, " ");
    const r = run = stage.play(i);
    next = i + 1;
    if (isAct(r)) r.result.then(res => { r.answered = true; say("nima", `(${res.target ? NAMES[res.target.split("#")[0]] ?? res.target : "—"})`); render(); });
    r.done.then(() => { if (run === r) render(); });
    render();
  }
  function render() {
    foot.replaceChildren();
    foot.dataset.cue = busy() ? "" : String(next);
    const cues = stage.script.cues;
    if (isAct(run) && !run.answered) {
      const a = run, card = $("div", "card");
      card.append($("small", "", `Nima — ${a.act.kind}`), $("p", "", a.act.prompt ?? ""));
      const row = $("div", "row");
      row.append(button("keyboard list", () => ix.focus()), button("skip ▸ (shows the answer)", () => a.skip()));
      card.append(row); foot.append(card);
      return;
    }
    if (run && stage.now() < run.dur) { foot.append(Object.assign(button("Devam ▸", () => { run?.finish(); render(); }), { className: "primary" })); return; }
    if (next >= cues.length) { foot.append(Object.assign(button("Baştan ↺", () => restart(0)), { className: "primary" })); return; }
    foot.append(Object.assign(button(actOf(cues[next]) ? "Your turn ▸" : "Devam ▸", () => playCue(next)), { className: "primary" }));
  }
  /** Back to cue `at` (the scene, or the line before an act), with the answers given so far forgotten. */
  function restart(at: number) {
    stage.setCues(0, CUES);
    story.replaceChildren();
    run = null; next = at + 1;
    stage.show(at);
    render();
  }
  const timer = setInterval(() => { if (foot.dataset.cue !== (busy() ? "" : String(next))) render(); }, 250);
  ctx.cleanup(() => clearInterval(timer));
  restart(0);

  const jump = (kind: string, i: number) => button(kind, () => { restart(i - 1); playCue(i); }, undefined, `start at cue ${i}`);
  host.append(
    bar("jump to", jump("go", 2), jump("tap", 4), jump("choose", 6), jump("drag (take)", 8), jump("drag (give)", 10)),
    bar("explore", toggle("on", true, on => ix.setExplore(on), "a tap on a person or a thing raises inspect with its terms")),
    bar("list", toggle("always shown", false, on => ix.setList(on ? "always" : "auto"), "the buttons for keyboards and screen readers: always, or when Tab reaches them")),
    word, $("h3", "", "The story so far"), story, $("h3", "", "Events"), events,
  );
}
