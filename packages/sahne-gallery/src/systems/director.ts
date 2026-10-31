// The director (DESIGN.md §5.6, §7): what the engine stages on its own from a bare line. Who is
// addressed (to) and where everyone looks, a gesture's stroke on its word (on, link), reactions after
// the line (react), the speed (tempo), the camera and the sounds, and a glance off the script. Every
// button plays from the same moment of the bakkal scene, and the director's plan for it is drawn as a
// timeline under the stage: words, each actor's gestures (▼ the stroke), looks, feelings and turns, the
// shots and the sounds, with a cursor that follows the Run.

import type { Cue, Perf, Run, Staging } from "sahne";
import { $, bar, button } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { BAKKAL, ISMAIL, NIMA, OPENING, POLITE } from "../bakkal.ts";
import { bench } from "./bench.ts";

const NAMES: Record<string, string> = { ismail: "İsmail", nima: "Nima" };
const L = (who: string, text: string, s: Staging = {}): Cue => ({ line: { who, text, ...s } });
const short = (t: string | null | undefined) => (t ?? "ahead").replace(/^(obj|ch|mark):/, "");

/** The director's plan as a timeline: a row per thing it decided (an actor's row has three lines), the time across. */
function timeline(p: Perf, gestureStroke: (id: string) => number) {
  const W = 1000, dur = Math.max(p.dur, 1), rows: { label: string; h: number; draw: (top: number) => string }[] = [];
  const X = (t: number) => 90 + (Math.min(t, dur) / dur) * (W - 100);
  const txt = (x: number, y: number, s: string, cls = "") => `<text x="${x.toFixed(1)}" y="${y}" class="${cls}">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
  const span = (t0: number, t1: number, y: number, h: number, cls: string) => `<rect x="${X(t0)}" y="${y}" width="${Math.max(3, X(t1) - X(t0))}" height="${h}" class="${cls}"/>`;
  const words = p.lines.flatMap(l => l.words.map(w => ({ t0: l.t0 + w.t0, t1: l.t0 + w.t1, text: w.text })));
  if (words.length) rows.push({ label: "words", h: 24, draw: y => words.map(w => span(w.t0, w.t1, y + 4, 15, "w") + txt(X(w.t0) + 2, y + 15, w.text)).join("") });
  for (const [id, tr] of Object.entries(p.tracks)) {
    const m: string[] = [];
    // line 1: walks, gestures (▼ the stroke) and speech; line 2: where the eyes go; line 3: feelings and turns
    for (const w of tr.walks) m.push(span(w.t0, w.t1, 4, 15, "wk"), txt(X(w.t0) + 3, 15, `${w.how}`));
    for (const g of tr.gestures) {
      const st = g.t0 + gestureStroke(g.id) / g.tempo;
      m.push(span(g.t0, g.t0 + g.len, 4, 15, "g"), txt(X(g.t0) + 3, 15, `${g.id}${g.n ? " ×" + g.n : ""}${g.at ? " → " + short(g.at) : ""}${g.loop ? " ⟳" : ""}`), txt(X(st) - 5, 4, "▼", "st"));
    }
    for (const sp of tr.speech) m.push(span(sp.t0, sp.t1, 19, 3, "sp"));
    for (const l of tr.looks) m.push(txt(X(l.t), 34, `👁 ${short(l.at)}`, "lk"));
    for (const e of tr.emos) m.push(txt(X(e.t), 49, `☺ ${e.emo}`, "em"));
    for (const t of tr.turns) m.push(txt(X(t.t) + 60, 49, `↻ ${(t.yaw * 57.3).toFixed(0)}°`, "lk"));
    if (m.length) rows.push({ label: NAMES[id] ?? id, h: 56, draw: y => `<g transform="translate(0 ${y})">${m.join("")}</g>` });
  }
  if (p.cams.length) rows.push({ label: "camera", h: 22, draw: y => p.cams.map(c => txt(X(c.t), y + 15, `🎥 ${c.shot.kind}${c.shot.ids.length ? " " + c.shot.ids.join("+") : ""}${c.shot.objs.length ? " " + c.shot.objs.join("+") : ""}`)).join("") });
  // sounds alternate between two lines, so ones close together stay readable
  if (p.sounds.length) rows.push({ label: "sound", h: 36, draw: y => p.sounds.map((s, k) => txt(X(s.t), y + 15 + (k % 2) * 15, `♪ ${s.id}`)).join("") });
  let y = 18, body = "";
  for (const r of rows) { body += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="tk"/>` + txt(0, y + 15, r.label, "lb") + r.draw(y); y += r.h; }
  const ticks = Array.from({ length: Math.floor(dur / 500) + 1 }, (_, i) => `<line x1="${X(i * 500)}" x2="${X(i * 500)}" y1="4" y2="${y}" class="tk"/>${txt(X(i * 500) + 2, 12, `${i * 0.5}s`, "lb")}`).join("");
  const box = $("div");
  box.innerHTML = `<svg viewBox="0 0 ${W} ${y + 4}" style="width:100%;font:11px system-ui;display:block"><style>
    text{fill:var(--ink)} .lb{fill:var(--mute)} .w{fill:var(--line)} .g{fill:color-mix(in srgb,var(--accent) 25%,transparent)} .wk{fill:color-mix(in srgb,var(--warn) 20%,transparent)} .sp{fill:var(--accent)}
    .st{fill:var(--bad);font-size:10px} .lk{fill:var(--mute)} .em{fill:var(--warn)} .tk{stroke:var(--line)} .cur{stroke:var(--bad);stroke-width:2}</style>
    ${ticks}${body}<line class="cur" x1="90" x2="90" y1="0" y2="${y}"/></svg>`;
  const cur = box.querySelector<SVGLineElement>(".cur")!;
  return { el: box, at: (t: number) => { cur.setAttribute("x1", String(X(t))); cur.setAttribute("x2", String(X(t))); } };
}

export function build(host: HTMLElement, ctx: Ctx) {
  // the scene up to the choice: cue 0 İsmail alone, cue 1 Nima has come in (the base of most buttons)
  const cues = [...OPENING, ...POLITE];
  const shop = bench(host, ctx, { places: [BAKKAL], cast: { ismail: ISMAIL, nima: NIMA }, cues, show: 1, load: { names: NAMES } });
  const stage = shop.stage;
  const planBox = $("div", "card");
  planBox.append($("p", "note", "Play something: the director's plan for it shows here."));
  host.append(planBox);

  let run: Run | null = null, plan: ReturnType<typeof timeline> | null = null;
  const tick = setInterval(() => { if (run && plan) plan.at(Math.min(run.t, run.dur)); }, 50);
  ctx.cleanup(() => clearInterval(tick));
  const stroke = (id: string) => ctx.kit.gestures[id]?.stroke ?? 0;
  const show = (p: Perf, r: Run) => {
    run = r; plan = timeline(p, stroke);
    planBox.replaceChildren(plan.el, $("p", "note", `${Math.round(p.dur)} ms in all. ▼ marks each gesture's stroke, the moment it meets its word; 👁 where the eyes go; ↻ a turn (0° faces us).`));
  };
  /** Plays `cue` from the world after script cue `base`, directed afresh, and draws the plan. */
  const from = (base: number, cue: Cue) => {
    stage.show(base);
    const p = stage.direct(cue);
    shop.note(JSON.stringify(cue, null, 1).replace(/\n\s*/g, " "));
    show(p, stage.perform(p));
  };
  const b = (label: string, cue: Cue, base = 1) => button(label, () => from(base, cue));

  host.append(
    $("h2", "", "The bakkal scene, as written"), $("p", "note", "The scene's own cues, each from the cue before it. Most staging here is the director's: the script names only a few fields."),
    bar("cue", ...cues.slice(1).map((c, k) => button(`${k + 1}. ${"line" in c ? c.line.text : "…"}`, () => { stage.show(k); shop.note(JSON.stringify(c, null, 1).replace(/\n\s*/g, " ")); show(stage.perfs[k + 1], stage.play(k + 1)); }))),

    $("h2", "", "Who is spoken to: to"), $("p", "note", "With no to, a line goes to the last one who spoke to the speaker, else the other one on stage. The speaker turns to the addressee (a paper turn of up to 35°) and looks at them; the listener looks at the speaker; the shot is two. to: viewer turns the speaker to us and frames them alone; to: all addresses everyone."),
    bar("to", b("no to", L("ismail", "Hoş geldiniz!", { do: "welcome" })), b("to: nima", L("ismail", "Hoş geldiniz!", { do: "welcome", to: "nima" })),
      b("to: viewer", L("ismail", "Hoş geldiniz!", { do: "welcome", to: "viewer" })), b("to: all", L("ismail", "Hoş geldiniz!", { do: "welcome", to: "all" }))),

    $("h2", "", "The stroke on its word: on and link"), $("p", "note", "A gesture is timed so its stroke meets a word: on names the word; else the last mention of the word linked to its target (Şu ekmek: the second ekmek, not the first); else the first word. Watch the ▼ move along the words row."),
    bar("point",
      b("no link", L("ismail", "Ekmek var. Şu ekmek çok taze.", { do: "point", at: "obj:ekmek" })),
      b("link ekmek", L("ismail", "Ekmek var. Şu ekmek çok taze.", { do: "point", at: "obj:ekmek", link: { ekmek: "obj:ekmek" } })),
      b("on: taze", L("ismail", "Ekmek var. Şu ekmek çok taze.", { do: "point", at: "obj:ekmek", on: "taze" }))),
    bar("shrug", b("shrug, no on", L("ismail", "Ama süt yok.", { do: "shrug" })), b("shrug on: yok", L("ismail", "Ama süt yok.", { do: "shrug", on: "yok" }))),

    $("h2", "", "Reactions after the line: react"), $("p", "note", "A listener's reaction comes after the line ends (at most two listeners): an emotion, a gesture, or both with a target. Following a point with the eyes is the one reaction that comes on the stroke, not after."),
    bar("react", b("none", L("ismail", "Süt yok.")), b("nima: sad", L("ismail", "Süt yok.", { react: { nima: "sad" } })),
      b("nima: nod", L("ismail", "Süt yok.", { react: { nima: "nod" } })),
      b("nima: look at the bread", L("ismail", "Şu ekmek çok taze.", { do: "point", at: "obj:ekmek", link: { ekmek: "obj:ekmek" }, react: { nima: { emo: "curious", do: "look", at: "obj:ekmek" } } }))),

    $("h2", "", "Speed: tempo"), $("p", "note", "tempo scales this cue's speech and gestures (1 is the character's own): İsmail, quickly, is 1.4. The whole plan shrinks or stretches."),
    bar("tempo", ...[0.7, 1, 1.4].map(t => b(`tempo ${t}`, L("ismail", "Başka bir şey?", { do: "explain", emo: "curious", tempo: t })))),

    $("h2", "", "The camera and the sounds"), $("p", "note", "An entrance is framed wide; the door swings and rings (the doorbell from the door), steps sound on the shop's tiles, then a line cuts to two. A silent line (the … card) is framed close. Sounds play only with sound on (top bar); their words show either way."),
    bar("staging", b("Nima comes in", OPENING[1], 0), b("a silent line", L("nima", "…", { voice: "silent", emo: "nervous" })),
      b("a clock ticks", { beat: { sfx: { id: "clock_tick", word: "tik tak", at: "mark:clock" } } })),

    $("h2", "", "A glance (off the script)"), $("p", "note", "Not a cue: stage.glance(ids, target, pointer) is what an act's hint plays. Nima looks at the simit tray; İsmail looks and points at it. Nothing else in the world changes."),
    bar("glance", button("glance at the simit", () => { stage.show(1); run = stage.glance(["nima", "ismail"], "obj:simit", "ismail"); plan = null; shop.note("stage.glance([\"nima\", \"ismail\"], \"obj:simit\", \"ismail\")"); planBox.replaceChildren($("p", "note", "A glance has no cue and no plan to draw.")); })),
  );
}
