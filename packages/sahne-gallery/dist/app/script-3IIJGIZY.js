import {
  EMOTIONS
} from "./chunk-TYXGNTJ5.js";
import "./chunk-XKJEK365.js";
import {
  BAKKAL,
  ISMAIL,
  NIMA
} from "./chunk-VFMRH5SO.js";
import {
  bench
} from "./chunk-ZRNRQOB7.js";
import {
  BENCH_STREET
} from "./chunk-J3KVAIQI.js";
import {
  $,
  bar,
  button,
  choice,
  select,
  slider
} from "./chunk-4TGKXDN4.js";
import {
  CAM_KINDS,
  CUE_KINDS,
  STAGING_FIELDS
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/script.ts
var OPEN = { scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "customer" } } };
var COAT = { ...NIMA, outfit: { ...NIMA.outfit, outer: { id: "outer_coat_parka", colors: ["fab_07", "fab_02"] } }, wear: { hat: { id: "hat_beanie", colors: ["fab_21"] } } };
var L = (who, text, s = {}) => ({ line: { who, text, ...s } });
var B = (s) => ({ beat: s });
var TYPED = "Typed, not built yet: the engine accepts it and plays the cue without it (README.md, Status).";
var KINDS = {
  scene: [{ scene: { place: "bench_street", time: "golden", at: { nima: "mid" }, cam: "wide" } }, "A scene sets the place and the time and puts actors on marks; \u0130smail, not listed, is off stage. Play the opening again (line) to go back."],
  line: [L("ismail", "Ho\u015F geldiniz! Buyrun.", { to: "nima", do: "welcome", emo: "happy" }), "Someone speaks: the text drives the mouth and the bubble; the director fills in gaze, timing and the shot."],
  beat: [B({ who: "nima", emo: "nervous", wait: 1500 }), "Staging with no speech: who performs emo and do; wait holds the stage (1.5 s)."],
  act: [{ act: { kind: "tap", targets: ["obj:ekmek", "obj:simit", "obj:sut"], expect: "obj:ekmek", prompt: "Ekmek hangisi?", by: "ismail", who: "nima" } }, "The learner acts: tap the bread on the stage. Two wrong taps and \u0130smail's gaze hints (a soft glow too); a third and he points: the answer is shown and the act completes, so an act never blocks. Its Run is only the cut to the wide shot; the act itself waits for the tap."],
  overlay: [{ overlay: { kind: "case_arc", word: "ekme\u011Fi" } }, `A teaching overlay (case arcs, owner tags). ${TYPED} The director ends it at once: its Run lasts 0 ms.`]
};
var FIELDS = {
  to: [L("ismail", "Ho\u015F geldiniz!", { to: "viewer", do: "welcome" }), "to: the addressee. viewer turns \u0130smail to us; to: nima turns him to her, and the shot follows (two)."],
  emo: [L("nima", "S\xFCt yok mu?", { emo: "sad" }), "emo: face and posture; it lasts two cues, then fades to her resting mood. The mouth keeps the sadness while she speaks."],
  do: [B({ who: "ismail", do: "wave" }), "do: one gesture from the kit."],
  at: [B({ who: "nima", do: "point", at: "obj:simit" }), "at: the gesture's and the gaze's target (obj:, ch:, ch:<actor>.head, mark:, viewer). Her arm reaches for the simit tray."],
  n: [L("nima", "\u0130ki ekmek, l\xFCtfen.", { do: "count", n: 2 }), "n: counting. The hand shows two fingers."],
  loop: [B({ who: "ismail", do: "think", loop: true }), "loop: the gesture goes on while the cue is on screen (seek past its end: it still loops)."],
  move: [B({ move: { who: "nima", to: "front", how: "walk" } }), "move: a walk to a mark (walk, run, hop, enter, exit, fly). Her steps bob and she leans into the walk."],
  obj: [L("ismail", "Buyrun!", { obj: [{ id: "ekmek", op: "give", to: "nima", n: 2 }] }), "obj: prop changes. Two of the three loaves go to Nima, handed over on Buyrun."],
  link: [L("nima", "Simit var m\u0131? Simit!", { do: "point", at: "obj:simit", link: { simit: "obj:simit" } }), "link: words that name something on stage. The point lands on the last simit, the word linked to its target."],
  react: [L("ismail", "S\xFCt yok.", { react: { nima: { emo: "sad", do: "shake_head" } } }), "react: listeners react after the line, at most two."],
  cam: [L("nima", "Merhaba!", { cam: "close" }), "cam: a framing override (wide, two, single, close, obj, follow \u2026)."],
  via: [L("nima", "Alo? Ekmek var m\u0131?", { via: "phone" }), `via: phone or video, a speaker not on stage. ${TYPED}`],
  voice: [L("nima", "\xC7ok pahal\u0131\u2026", { voice: "whisper", to: "viewer" }), "voice: normal, whisper (a dashed bubble, a quiet voice), silent (the \u2026 card) or mouthing (lips, no voice)."],
  sfx: [B({ sfx: { id: "doorbell", word: "\xE7\u0131n \xE7\u0131n", at: "mark:door" } }), "sfx: a kit sound; its word is drawn where it comes from (always while sound is off, and with captions on)."],
  env: [B({ env: ["time:dusk:3000", "lights_off"] }), "env: dusk falls over 3 s and the lights go off. Seek back and forth: the light follows."],
  frame: [L("ismail", "Eskiden burada bir f\u0131r\u0131n vard\u0131.", { frame: "past" }), `frame: past (an old-photo look) or past_inset. ${TYPED}`],
  tempo: [L("ismail", "Ba\u015Fka bir \u015Fey?", { tempo: 1.4, do: "explain" }), "tempo: this cue's speed. \u0130smail, quickly: 1.4."],
  on: [L("ismail", "Ekmek var ama s\xFCt yok.", { do: "shrug", on: "yok" }), "on: the word the gesture's stroke meets. The shrug lands on yok."],
  costume: [B({ costume: { nima: "coat" } }), 'costume: a change of clothes from the wardrobe, at once. {nima: ""} puts the cast document back on.']
};
function build(host, ctx) {
  host.append($("p", "note", "Pick a cue kind or a staging field: its preset loads below and plays on the bakkal. Edit the JSON or use the quick controls, then play it again. By default every cue plays from the opening (\u0130smail at the counter, Nima in front of it), so the slider seeks the same performance each time; \u201Cfrom now\u201D plays it from wherever the last one left the world."));
  const lab = bench(host, ctx, {
    places: [BAKKAL, BENCH_STREET],
    cast: { ismail: ISMAIL, nima: NIMA },
    cues: [OPEN],
    interact: true,
    // every preset's art (the street, the props a drag needs) is loaded once; a cue is then swapped in with setCues
    load: { wardrobe: { nima: { coat: COAT } }, extra: [...Object.values(KINDS), ...Object.values(FIELDS)].map((p) => ({ at: 1, cues: [p[0]] })), names: { ismail: "\u0130smail", nima: "Nima" } }
  });
  const stage = lab.stage;
  let run = null, fromNow = false, dragging = false;
  const time = $("output", "", "\u2013");
  const seek = slider("seek", 0, 1e3, 10, 0, (v) => {
    run?.seek(v);
  }, (v) => `${Math.round(v)} ms`);
  const range = seek.querySelector("input"), out = seek.querySelector("output");
  range.style.width = "min(360px, 50vw)";
  range.onpointerdown = () => {
    dragging = true;
  };
  range.onpointerup = () => {
    dragging = false;
  };
  const msg = $("p", "note");
  const tick = setInterval(() => {
    if (!run) return;
    const t = Math.min(run.t, run.dur);
    if (!dragging) {
      range.value = String(t);
      out.textContent = `${Math.round(t)} ms`;
    }
    time.textContent = `cue ${run.cue} \xB7 ${Math.round(t)} / ${Math.round(run.dur)} ms${run.t >= run.dur ? " \xB7 done" : ""}`;
  }, 80);
  ctx.cleanup(() => clearInterval(tick));
  const editor = $("textarea");
  editor.spellcheck = false;
  editor.rows = 9;
  editor.style.cssText = "width:100%;font:12px ui-monospace,monospace;background:var(--chip);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px";
  const read = () => {
    try {
      return JSON.parse(editor.value);
    } catch (e) {
      msg.textContent = `Not JSON: ${e.message}`;
      msg.className = "note bad";
      return null;
    }
  };
  const write = (c) => {
    editor.value = JSON.stringify(c, null, 2);
  };
  const play = () => {
    const c = read();
    if (!c) return;
    try {
      if (fromNow && !("act" in c)) run = stage.act(c);
      else {
        stage.setCues(1, [c]);
        stage.show(0);
        run = stage.play(1);
      }
    } catch (e) {
      msg.textContent = `The engine refused it: ${e.message}`;
      msg.className = "note bad";
      return;
    }
    range.max = String(Math.max(1, Math.round(run.dur)));
    range.value = "0";
  };
  const preset = ([c, about]) => {
    write(c);
    msg.textContent = about;
    msg.className = "note";
    play();
  };
  const kinds = choice("cue", CUE_KINDS, void 0, (k) => {
    fields.set("");
    preset(KINDS[k]);
  });
  const fields = choice("staging", STAGING_FIELDS, void 0, (f) => {
    kinds.set("");
    preset(FIELDS[f]);
  });
  const NONE = "\u2014";
  const patch = (field, v) => {
    const c = read();
    if (!c) return;
    const body = "line" in c ? c.line : "beat" in c ? c.beat : null;
    if (!body) {
      msg.textContent = "The quick controls change a line or a beat: pick one first.";
      msg.className = "note warn";
      return;
    }
    if (v === NONE) delete body[field];
    else body[field] = field === "n" ? Number(v) : v;
    write(c);
    play();
  };
  const targets = [NONE, "obj:ekmek", "obj:simit", "obj:sut", "obj:kasa", "ch:nima", "ch:ismail", "ch:nima.head", "mark:shelf", "mark:door", "viewer"];
  const quick = bar(
    "quick",
    select("who", [NONE, "ismail", "nima"], NONE, (v) => patch("who", v)),
    select("emo", [NONE, ...Object.keys(EMOTIONS)], NONE, (v) => patch("emo", v)),
    select("do", [NONE, ...Object.keys(ctx.kit.gestures).sort()], NONE, (v) => patch("do", v)),
    select("at", targets, NONE, (v) => patch("at", v)),
    select("n", [NONE, "1", "2", "3", "4", "5"], NONE, (v) => patch("n", v)),
    select("cam", [NONE, ...CAM_KINDS], NONE, (v) => patch("cam", v)),
    select("voice", [NONE, "normal", "whisper", "silent", "mouthing"], NONE, (v) => patch("voice", v))
  );
  host.append(
    bar(
      "run",
      button("\u25B6 play", play, void 0, "plays the cue in the editor"),
      button("pause", () => run?.pause()),
      button("resume", () => run?.resume()),
      button("finish", () => run?.finish(), void 0, "jump to the end pose, as Devam does mid-performance"),
      seek,
      time
    ),
    choice("from", ["the opening", "now"], "the opening", (o) => {
      fromNow = o === "now";
    }),
    kinds,
    fields,
    quick,
    msg,
    editor,
    $("p", "note", "A Run is what play() returns: finish() jumps to the end pose, seek(t) goes to any moment (the world at t is worked out from the cue, so seeking back is exact), pause() and resume() hold the clock. While a line is voiced (sound on), the clock follows the voice.")
  );
  host.querySelector("pre.log.cue")?.remove();
  write(KINDS.line[0]);
  msg.textContent = KINDS.line[1];
}
export {
  build
};
//# sourceMappingURL=script-3IIJGIZY.js.map
