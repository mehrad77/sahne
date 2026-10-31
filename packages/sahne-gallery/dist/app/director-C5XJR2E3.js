import {
  BAKKAL,
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
  button
} from "./chunk-4TGKXDN4.js";
import "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/systems/director.ts
var NAMES = { ismail: "\u0130smail", nima: "Nima" };
var L = (who, text, s = {}) => ({ line: { who, text, ...s } });
var short = (t) => (t ?? "ahead").replace(/^(obj|ch|mark):/, "");
function timeline(p, gestureStroke) {
  const W = 1e3, dur = Math.max(p.dur, 1), rows = [];
  const X = (t) => 90 + Math.min(t, dur) / dur * (W - 100);
  const txt = (x, y2, s, cls = "") => `<text x="${x.toFixed(1)}" y="${y2}" class="${cls}">${s.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`;
  const span = (t0, t1, y2, h, cls) => `<rect x="${X(t0)}" y="${y2}" width="${Math.max(3, X(t1) - X(t0))}" height="${h}" class="${cls}"/>`;
  const words = p.lines.flatMap((l) => l.words.map((w) => ({ t0: l.t0 + w.t0, t1: l.t0 + w.t1, text: w.text })));
  if (words.length) rows.push({ label: "words", h: 24, draw: (y2) => words.map((w) => span(w.t0, w.t1, y2 + 4, 15, "w") + txt(X(w.t0) + 2, y2 + 15, w.text)).join("") });
  for (const [id, tr] of Object.entries(p.tracks)) {
    const m = [];
    for (const w of tr.walks) m.push(span(w.t0, w.t1, 4, 15, "wk"), txt(X(w.t0) + 3, 15, `${w.how}`));
    for (const g of tr.gestures) {
      const st = g.t0 + gestureStroke(g.id) / g.tempo;
      m.push(span(g.t0, g.t0 + g.len, 4, 15, "g"), txt(X(g.t0) + 3, 15, `${g.id}${g.n ? " \xD7" + g.n : ""}${g.at ? " \u2192 " + short(g.at) : ""}${g.loop ? " \u27F3" : ""}`), txt(X(st) - 5, 4, "\u25BC", "st"));
    }
    for (const sp of tr.speech) m.push(span(sp.t0, sp.t1, 19, 3, "sp"));
    for (const l of tr.looks) m.push(txt(X(l.t), 34, `\u{1F441} ${short(l.at)}`, "lk"));
    for (const e of tr.emos) m.push(txt(X(e.t), 49, `\u263A ${e.emo}`, "em"));
    for (const t of tr.turns) m.push(txt(X(t.t) + 60, 49, `\u21BB ${(t.yaw * 57.3).toFixed(0)}\xB0`, "lk"));
    if (m.length) rows.push({ label: NAMES[id] ?? id, h: 56, draw: (y2) => `<g transform="translate(0 ${y2})">${m.join("")}</g>` });
  }
  if (p.cams.length) rows.push({ label: "camera", h: 22, draw: (y2) => p.cams.map((c) => txt(X(c.t), y2 + 15, `\u{1F3A5} ${c.shot.kind}${c.shot.ids.length ? " " + c.shot.ids.join("+") : ""}${c.shot.objs.length ? " " + c.shot.objs.join("+") : ""}`)).join("") });
  if (p.sounds.length) rows.push({ label: "sound", h: 36, draw: (y2) => p.sounds.map((s, k) => txt(X(s.t), y2 + 15 + k % 2 * 15, `\u266A ${s.id}`)).join("") });
  let y = 18, body = "";
  for (const r of rows) {
    body += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" class="tk"/>` + txt(0, y + 15, r.label, "lb") + r.draw(y);
    y += r.h;
  }
  const ticks = Array.from({ length: Math.floor(dur / 500) + 1 }, (_, i) => `<line x1="${X(i * 500)}" x2="${X(i * 500)}" y1="4" y2="${y}" class="tk"/>${txt(X(i * 500) + 2, 12, `${i * 0.5}s`, "lb")}`).join("");
  const box = $("div");
  box.innerHTML = `<svg viewBox="0 0 ${W} ${y + 4}" style="width:100%;font:11px system-ui;display:block"><style>
    text{fill:var(--ink)} .lb{fill:var(--mute)} .w{fill:var(--line)} .g{fill:color-mix(in srgb,var(--accent) 25%,transparent)} .wk{fill:color-mix(in srgb,var(--warn) 20%,transparent)} .sp{fill:var(--accent)}
    .st{fill:var(--bad);font-size:10px} .lk{fill:var(--mute)} .em{fill:var(--warn)} .tk{stroke:var(--line)} .cur{stroke:var(--bad);stroke-width:2}</style>
    ${ticks}${body}<line class="cur" x1="90" x2="90" y1="0" y2="${y}"/></svg>`;
  const cur = box.querySelector(".cur");
  return { el: box, at: (t) => {
    cur.setAttribute("x1", String(X(t)));
    cur.setAttribute("x2", String(X(t)));
  } };
}
function build(host, ctx) {
  const cues = [...OPENING, ...POLITE];
  const shop = bench(host, ctx, { places: [BAKKAL], cast: { ismail: ISMAIL, nima: NIMA }, cues, show: 1, load: { names: NAMES } });
  const stage = shop.stage;
  const planBox = $("div", "card");
  planBox.append($("p", "note", "Play something: the director's plan for it shows here."));
  host.append(planBox);
  let run = null, plan = null;
  const tick = setInterval(() => {
    if (run && plan) plan.at(Math.min(run.t, run.dur));
  }, 50);
  ctx.cleanup(() => clearInterval(tick));
  const stroke = (id) => ctx.kit.gestures[id]?.stroke ?? 0;
  const show = (p, r) => {
    run = r;
    plan = timeline(p, stroke);
    planBox.replaceChildren(plan.el, $("p", "note", `${Math.round(p.dur)} ms in all. \u25BC marks each gesture's stroke, the moment it meets its word; \u{1F441} where the eyes go; \u21BB a turn (0\xB0 faces us).`));
  };
  const from = (base, cue) => {
    stage.show(base);
    const p = stage.direct(cue);
    shop.note(JSON.stringify(cue, null, 1).replace(/\n\s*/g, " "));
    show(p, stage.perform(p));
  };
  const b = (label, cue, base = 1) => button(label, () => from(base, cue));
  host.append(
    $("h2", "", "The bakkal scene, as written"),
    $("p", "note", "The scene's own cues, each from the cue before it. Most staging here is the director's: the script names only a few fields."),
    bar("cue", ...cues.slice(1).map((c, k) => button(`${k + 1}. ${"line" in c ? c.line.text : "\u2026"}`, () => {
      stage.show(k);
      shop.note(JSON.stringify(c, null, 1).replace(/\n\s*/g, " "));
      show(stage.perfs[k + 1], stage.play(k + 1));
    }))),
    $("h2", "", "Who is spoken to: to"),
    $("p", "note", "With no to, a line goes to the last one who spoke to the speaker, else the other one on stage. The speaker turns to the addressee (a paper turn of up to 35\xB0) and looks at them; the listener looks at the speaker; the shot is two. to: viewer turns the speaker to us and frames them alone; to: all addresses everyone."),
    bar(
      "to",
      b("no to", L("ismail", "Ho\u015F geldiniz!", { do: "welcome" })),
      b("to: nima", L("ismail", "Ho\u015F geldiniz!", { do: "welcome", to: "nima" })),
      b("to: viewer", L("ismail", "Ho\u015F geldiniz!", { do: "welcome", to: "viewer" })),
      b("to: all", L("ismail", "Ho\u015F geldiniz!", { do: "welcome", to: "all" }))
    ),
    $("h2", "", "The stroke on its word: on and link"),
    $("p", "note", "A gesture is timed so its stroke meets a word: on names the word; else the last mention of the word linked to its target (\u015Eu ekmek: the second ekmek, not the first); else the first word. Watch the \u25BC move along the words row."),
    bar(
      "point",
      b("no link", L("ismail", "Ekmek var. \u015Eu ekmek \xE7ok taze.", { do: "point", at: "obj:ekmek" })),
      b("link ekmek", L("ismail", "Ekmek var. \u015Eu ekmek \xE7ok taze.", { do: "point", at: "obj:ekmek", link: { ekmek: "obj:ekmek" } })),
      b("on: taze", L("ismail", "Ekmek var. \u015Eu ekmek \xE7ok taze.", { do: "point", at: "obj:ekmek", on: "taze" }))
    ),
    bar("shrug", b("shrug, no on", L("ismail", "Ama s\xFCt yok.", { do: "shrug" })), b("shrug on: yok", L("ismail", "Ama s\xFCt yok.", { do: "shrug", on: "yok" }))),
    $("h2", "", "Reactions after the line: react"),
    $("p", "note", "A listener's reaction comes after the line ends (at most two listeners): an emotion, a gesture, or both with a target. Following a point with the eyes is the one reaction that comes on the stroke, not after."),
    bar(
      "react",
      b("none", L("ismail", "S\xFCt yok.")),
      b("nima: sad", L("ismail", "S\xFCt yok.", { react: { nima: "sad" } })),
      b("nima: nod", L("ismail", "S\xFCt yok.", { react: { nima: "nod" } })),
      b("nima: look at the bread", L("ismail", "\u015Eu ekmek \xE7ok taze.", { do: "point", at: "obj:ekmek", link: { ekmek: "obj:ekmek" }, react: { nima: { emo: "curious", do: "look", at: "obj:ekmek" } } }))
    ),
    $("h2", "", "Speed: tempo"),
    $("p", "note", "tempo scales this cue's speech and gestures (1 is the character's own): \u0130smail, quickly, is 1.4. The whole plan shrinks or stretches."),
    bar("tempo", ...[0.7, 1, 1.4].map((t) => b(`tempo ${t}`, L("ismail", "Ba\u015Fka bir \u015Fey?", { do: "explain", emo: "curious", tempo: t })))),
    $("h2", "", "The camera and the sounds"),
    $("p", "note", "An entrance is framed wide; the door swings and rings (the doorbell from the door), steps sound on the shop's tiles, then a line cuts to two. A silent line (the \u2026 card) is framed close. Sounds play only with sound on (top bar); their words show either way."),
    bar(
      "staging",
      b("Nima comes in", OPENING[1], 0),
      b("a silent line", L("nima", "\u2026", { voice: "silent", emo: "nervous" })),
      b("a clock ticks", { beat: { sfx: { id: "clock_tick", word: "tik tak", at: "mark:clock" } } })
    ),
    $("h2", "", "A glance (off the script)"),
    $("p", "note", "Not a cue: stage.glance(ids, target, pointer) is what an act's hint plays. Nima looks at the simit tray; \u0130smail looks and points at it. Nothing else in the world changes."),
    bar("glance", button("glance at the simit", () => {
      stage.show(1);
      run = stage.glance(["nima", "ismail"], "obj:simit", "ismail");
      plan = null;
      shop.note('stage.glance(["nima", "ismail"], "obj:simit", "ismail")');
      planBox.replaceChildren($("p", "note", "A glance has no cue and no plan to draw."));
    }))
  );
}
export {
  build
};
//# sourceMappingURL=director-C5XJR2E3.js.map
