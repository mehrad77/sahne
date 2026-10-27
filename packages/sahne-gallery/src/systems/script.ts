// The cue lab (DESIGN.md §5.6): write one cue of any kind, with any staging field, and play it on the
// bakkal (İsmail and Nima) as the script would; then seek it, pause it, resume it or finish it, as a
// story's Run allows. One preset per cue kind and per staging field (each one click: it loads and plays),
// a few simple controls that patch the cue, and the cue itself as JSON to edit by hand.

import { CAM_KINDS, CUE_KINDS, STAGING_FIELDS, type AvatarDoc, type Cue, type CueKind, type Run, type Staging } from "sahne";
import { EMOTIONS } from "sahne-kit/full";
import { $, bar, button, choice, select, slider } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { BAKKAL, ISMAIL, NIMA } from "../bakkal.ts";
import { bench, BENCH_STREET } from "./bench.ts";

const OPEN: Cue = { scene: { place: "bakkal", time: "day", at: { ismail: "counter", nima: "customer" } } };
/** Nima's coat and hat, the wardrobe `costume` names. */
const COAT: AvatarDoc = { ...NIMA, outfit: { ...NIMA.outfit, outer: { id: "outer_coat_parka", colors: ["fab_07", "fab_02"] } }, wear: { hat: { id: "hat_beanie", colors: ["fab_21"] } } };

const L = (who: string, text: string, s: Staging = {}): Cue => ({ line: { who, text, ...s } });
const B = (s: Staging & { who?: string; wait?: number }): Cue => ({ beat: s });
const TYPED = "Typed, not built yet: the engine accepts it and plays the cue without it (README.md, Status).";

/** One cue per kind, and what to look at. */
const KINDS: Record<CueKind, [Cue, string]> = {
  scene: [{ scene: { place: "bench_street", time: "golden", at: { nima: "mid" }, cam: "wide" } }, "A scene sets the place and the time and puts actors on marks; İsmail, not listed, is off stage. Play the opening again (line) to go back."],
  line: [L("ismail", "Hoş geldiniz! Buyrun.", { to: "nima", do: "welcome", emo: "happy" }), "Someone speaks: the text drives the mouth and the bubble; the director fills in gaze, timing and the shot."],
  beat: [B({ who: "nima", emo: "nervous", wait: 1500 }), "Staging with no speech: who performs emo and do; wait holds the stage (1.5 s)."],
  act: [{ act: { kind: "tap", targets: ["obj:ekmek", "obj:simit", "obj:sut"], expect: "obj:ekmek", prompt: "Ekmek hangisi?", by: "ismail", who: "nima" } }, "The learner acts: tap the bread on the stage. Two wrong taps and İsmail's gaze hints (a soft glow too); a third and he points: the answer is shown and the act completes, so an act never blocks. Its Run is only the cut to the wide shot; the act itself waits for the tap."],
  overlay: [{ overlay: { kind: "case_arc", word: "ekmeği" } }, `A teaching overlay (case arcs, owner tags). ${TYPED} The director ends it at once: its Run lasts 0 ms.`],
};

/** One cue per staging field, and what to look at. */
const FIELDS: Record<(typeof STAGING_FIELDS)[number], [Cue, string]> = {
  to: [L("ismail", "Hoş geldiniz!", { to: "viewer", do: "welcome" }), "to: the addressee. viewer turns İsmail to us; to: nima turns him to her, and the shot follows (two)."],
  emo: [L("nima", "Süt yok mu?", { emo: "sad" }), "emo: face and posture; it lasts two cues, then fades to her resting mood. The mouth keeps the sadness while she speaks."],
  do: [B({ who: "ismail", do: "wave" }), "do: one gesture from the kit."],
  at: [B({ who: "nima", do: "point", at: "obj:simit" }), "at: the gesture's and the gaze's target (obj:, ch:, ch:<actor>.head, mark:, viewer). Her arm reaches for the simit tray."],
  n: [L("nima", "İki ekmek, lütfen.", { do: "count", n: 2 }), "n: counting. The hand shows two fingers."],
  loop: [B({ who: "ismail", do: "think", loop: true }), "loop: the gesture goes on while the cue is on screen (seek past its end: it still loops)."],
  move: [B({ move: { who: "nima", to: "front", how: "walk" } }), "move: a walk to a mark (walk, run, hop, enter, exit, fly). Her steps bob and she leans into the walk."],
  obj: [L("ismail", "Buyrun!", { obj: [{ id: "ekmek", op: "give", to: "nima", n: 2 }] }), "obj: prop changes. Two of the three loaves go to Nima, handed over on Buyrun."],
  link: [L("nima", "Simit var mı? Simit!", { do: "point", at: "obj:simit", link: { simit: "obj:simit" } }), "link: words that name something on stage. The point lands on the last simit, the word linked to its target."],
  react: [L("ismail", "Süt yok.", { react: { nima: { emo: "sad", do: "shake_head" } } }), "react: listeners react after the line, at most two."],
  cam: [L("nima", "Merhaba!", { cam: "close" }), "cam: a framing override (wide, two, single, close, obj, follow …)."],
  via: [L("nima", "Alo? Ekmek var mı?", { via: "phone" }), `via: phone or video, a speaker not on stage. ${TYPED}`],
  voice: [L("nima", "Çok pahalı…", { voice: "whisper", to: "viewer" }), "voice: normal, whisper (a dashed bubble, a quiet voice), silent (the … card) or mouthing (lips, no voice)."],
  sfx: [B({ sfx: { id: "doorbell", word: "çın çın", at: "mark:door" } }), "sfx: a kit sound; its word is drawn where it comes from (always while sound is off, and with captions on)."],
  env: [B({ env: ["time:dusk:3000", "lights_off"] }), "env: dusk falls over 3 s and the lights go off. Seek back and forth: the light follows."],
  frame: [L("ismail", "Eskiden burada bir fırın vardı.", { frame: "past" }), `frame: past (an old-photo look) or past_inset. ${TYPED}`],
  tempo: [L("ismail", "Başka bir şey?", { tempo: 1.4, do: "explain" }), "tempo: this cue's speed. İsmail, quickly: 1.4."],
  on: [L("ismail", "Ekmek var ama süt yok.", { do: "shrug", on: "yok" }), "on: the word the gesture's stroke meets. The shrug lands on yok."],
  costume: [B({ costume: { nima: "coat" } }), "costume: a change of clothes from the wardrobe, at once. {nima: \"\"} puts the cast document back on."],
};

export function build(host: HTMLElement, ctx: Ctx) {
  host.append($("p", "note", "Pick a cue kind or a staging field: its preset loads below and plays on the bakkal. Edit the JSON or use the quick controls, then play it again. By default every cue plays from the opening (İsmail at the counter, Nima in front of it), so the slider seeks the same performance each time; “from now” plays it from wherever the last one left the world."));
  const lab = bench(host, ctx, {
    places: [BAKKAL, BENCH_STREET], cast: { ismail: ISMAIL, nima: NIMA }, cues: [OPEN], interact: true,
    // every preset's art (the street, the props a drag needs) is loaded once; a cue is then swapped in with setCues
    load: { wardrobe: { nima: { coat: COAT } }, extra: [...Object.values(KINDS), ...Object.values(FIELDS)].map(p => ({ at: 1, cues: [p[0]] })), names: { ismail: "İsmail", nima: "Nima" } },
  });
  const stage = lab.stage;

  // ---- the transport: play, pause, resume, finish, and a slider to seek ----
  let run: Run | null = null, fromNow = false, dragging = false;
  const time = $("output", "", "–");
  const seek = slider("seek", 0, 1000, 10, 0, v => { run?.seek(v); }, v => `${Math.round(v)} ms`);
  const range = seek.querySelector("input")!, out = seek.querySelector("output")!;
  range.style.width = "min(360px, 50vw)";
  range.onpointerdown = () => { dragging = true; };
  range.onpointerup = () => { dragging = false; };
  const msg = $("p", "note");
  const tick = setInterval(() => {
    if (!run) return;
    const t = Math.min(run.t, run.dur);
    if (!dragging) { range.value = String(t); out.textContent = `${Math.round(t)} ms`; }
    time.textContent = `cue ${run.cue} · ${Math.round(t)} / ${Math.round(run.dur)} ms${run.t >= run.dur ? " · done" : ""}`;
  }, 80);
  ctx.cleanup(() => clearInterval(tick));

  const editor = $("textarea");
  editor.spellcheck = false;
  editor.rows = 9;
  editor.style.cssText = "width:100%;font:12px ui-monospace,monospace;background:var(--chip);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:8px";
  const read = (): Cue | null => {
    try { return JSON.parse(editor.value) as Cue; } catch (e) { msg.textContent = `Not JSON: ${(e as Error).message}`; msg.className = "note bad"; return null; }
  };
  const write = (c: Cue) => { editor.value = JSON.stringify(c, null, 2); };

  const play = () => {
    const c = read();
    if (!c) return;
    try {
      // an act waits for the learner only from the script (the interaction layer plays it), so it always starts from the opening
      if (fromNow && !("act" in c)) run = stage.act(c);
      else { stage.setCues(1, [c]); stage.show(0); run = stage.play(1); }
    } catch (e) { msg.textContent = `The engine refused it: ${(e as Error).message}`; msg.className = "note bad"; return; }
    range.max = String(Math.max(1, Math.round(run.dur)));
    range.value = "0";
  };
  const preset = ([c, about]: [Cue, string]) => { write(c); msg.textContent = about; msg.className = "note"; play(); };

  const kinds = choice("cue", CUE_KINDS, undefined, k => { fields.set("" as never); preset(KINDS[k]); });
  const fields = choice("staging", STAGING_FIELDS, undefined, f => { kinds.set("" as never); preset(FIELDS[f]); });

  // ---- quick controls: each patches the line or beat in the editor, then plays it ----
  const NONE = "—";
  const patch = (field: keyof Staging | "who", v: string) => {
    const c = read();
    if (!c) return;
    const body = ("line" in c ? c.line : "beat" in c ? c.beat : null) as Record<string, unknown> | null;
    if (!body) { msg.textContent = "The quick controls change a line or a beat: pick one first."; msg.className = "note warn"; return; }
    if (v === NONE) delete body[field]; else body[field] = field === "n" ? Number(v) : v;
    write(c);
    play();
  };
  const targets = [NONE, "obj:ekmek", "obj:simit", "obj:sut", "obj:kasa", "ch:nima", "ch:ismail", "ch:nima.head", "mark:shelf", "mark:door", "viewer"];
  const quick = bar("quick",
    select("who", [NONE, "ismail", "nima"], NONE, v => patch("who", v)),
    select("emo", [NONE, ...Object.keys(EMOTIONS)], NONE, v => patch("emo", v)),
    select("do", [NONE, ...Object.keys(ctx.kit.gestures).sort()], NONE, v => patch("do", v)),
    select("at", targets, NONE, v => patch("at", v)),
    select("n", [NONE, "1", "2", "3", "4", "5"], NONE, v => patch("n", v)),
    select("cam", [NONE, ...CAM_KINDS], NONE, v => patch("cam", v)),
    select("voice", [NONE, "normal", "whisper", "silent", "mouthing"], NONE, v => patch("voice", v)),
  );

  host.append(
    bar("run", button("▶ play", play, undefined, "plays the cue in the editor"), button("pause", () => run?.pause()), button("resume", () => run?.resume()),
      button("finish", () => run?.finish(), undefined, "jump to the end pose, as Devam does mid-performance"), seek, time),
    choice("from", ["the opening", "now"], "the opening", o => { fromNow = o === "now"; }),
    kinds, fields, quick, msg, editor,
    $("p", "note", "A Run is what play() returns: finish() jumps to the end pose, seek(t) goes to any moment (the world at t is worked out from the cue, so seeking back is exact), pause() and resume() hold the clock. While a line is voiced (sound on), the clock follows the voice."),
  );
  // the editor shows the cue, so the bench's own cue panel goes
  host.querySelector("pre.log.cue")?.remove();
  write(KINDS.line[0]);
  msg.textContent = KINDS.line[1];
}
