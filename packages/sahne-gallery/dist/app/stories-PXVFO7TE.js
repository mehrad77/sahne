import {
  glossLookup,
  speak
} from "./chunk-GNC44ETW.js";
import {
  canListen,
  cannotListen,
  listenFor,
  replyCard
} from "./chunk-NPVNJND5.js";
import {
  adaptStory,
  lintStory,
  storyPlayer,
  suggest
} from "./chunk-6JPAPIMW.js";
import {
  K_BUST,
  K_HEAD,
  K_HEAD_VB,
  kerimOnTalk,
  kerimPortrait
} from "./chunk-GKR3PCTG.js";
import "./chunk-ZT53KTYM.js";
import {
  $,
  bar,
  button,
  css,
  frame,
  link,
  toggle
} from "./chunk-4TGKXDN4.js";
import {
  browserVoice,
  glossInto,
  interact,
  placeSolids,
  propText
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/sections/stories.ts
var stored = (k, d) => {
  try {
    return localStorage.getItem("sahne:" + k) ?? d;
  } catch {
    return d;
  }
};
var store = (k, v) => {
  try {
    localStorage.setItem("sahne:" + k, v);
  } catch {
  }
};
css("stories", `
.story { display: grid; grid-template-columns: 1fr minmax(260px, 380px); gap: 12px; margin-top: 8px; align-items: end; }
.story .slog { max-height: 170px; overflow: auto; font-size: 16.5px; }
.story .slog p { margin: 2px 0; }
.story .slog b { color: var(--mute); font-weight: 600; margin-right: 4px; }
.story .slog .tl { color: var(--mute); }
.story .foot { display: flex; justify-content: flex-end; }
.story .foot .card { width: 100%; display: grid; gap: 8px; margin: 0; }
.story .foot .card small { color: var(--mute); font-weight: 600; }
.story .foot .card p { margin: 0; font-size: 18px; }
.story .foot .card .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.story .foot .card .heard { color: var(--mute); font-size: 13px; }
.story button.option { border-radius: 10px; text-align: left; font-size: 17px; padding: 8px 12px; }
.readout { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.readout ol, .readout ul { margin: 0; padding-left: 18px; font: 12px/1.5 ui-monospace, monospace; }
.readout ol { list-style: none; padding: 0; }
.readout li.later { color: var(--mute); }
.readout li[aria-current] { background: color-mix(in srgb, var(--accent) 18%, transparent); border-radius: 4px; }
.readout li.error { color: var(--bad); } .readout li.warning { color: var(--warn); } .readout li.ok { color: var(--accent); list-style: none; margin-left: -18px; }
@media (max-width: 720px) { .story, .readout { grid-template-columns: 1fr; } }
`);
async function render(host, ctx) {
  const [drafts, docs, vocab] = await Promise.all([ctx.data("drafts"), ctx.data("places"), ctx.data("vocab").catch(() => [])]);
  const id = ctx.route.path[0];
  const draft = drafts.find((d) => d.id === id);
  if (!draft) {
    host.append($("h1", "", "Stories"), $("p", "note", "Each story played through the story adapter, as Kumru will play it: cards, choices, acts on stage, say it aloud, translations. A new story ($SAHNE_CONTENT/stories/<id>.json) shows here after a reload."));
    const cards = $("div", "cards");
    for (const d of drafts) {
      const a = link("", `#/stories/${d.id}`);
      a.className = "card";
      const t = d.story.title;
      a.append($("b", "", `${d.id}${d.fixture ? " \xB7 test scene" : ""}`), $("small", "", typeof t === "string" ? t : t?.tr ?? ""), $("small", "", `${d.story.steps?.length ?? 0} steps \xB7 ${Object.keys(d.characters).join(", ")}`));
      cards.append(a);
    }
    host.append(cards);
    return;
  }
  play(host, ctx, draft, Object.fromEntries(docs.map((p) => [p.id, p])), vocab);
}
function play(host, ctx, draft, PLACES, vocab) {
  const STORY = draft.story, CHARACTERS = draft.characters;
  const GL = Object.fromEntries(Object.entries(STORY.gl ?? {}).map(([w, g]) => [w, { en: g.en ?? "", fa: g.fa ?? "" }]));
  const GLOSS = { lookup: glossLookup(GL, {}, vocab), speak };
  let name = stored("story-name", "Nima"), translate = stored("story-translate", "1") === "1", aloudOn = stored("story-aloud", "1") === "1";
  const personalise = (t, lang) => name && name !== "Nima" ? t.replace(lang === "fa" ? /نیما/g : /Nima/g, name) : t;
  host.append(link("\u2190 every story", "#/stories"), $("h1", "", `${draft.id}${draft.fixture ? " \xB7 the bakkal test scene" : ""}`));
  const box = frame("16 / 10");
  host.append(box);
  let logMode = stored("story-log", "0") === "1";
  const stage = ctx.mount(box, { gloss: GLOSS, glosses: false, voice: browserVoice(), bubbles: logMode ? "log" : true });
  const ix = interact(stage, { explore: !!STORY.arc?.mechanics.includes("explore") });
  propText(stage);
  const kerim = kerimPortrait({ vb: K_HEAD_VB, bust: K_BUST, head: K_HEAD });
  const sec = $("section", "story"), log = $("div", "slog"), footer = $("div", "foot");
  log.setAttribute("aria-live", "polite");
  sec.append(log, footer);
  const cuesEl = $("ol"), lintsEl = $("ul"), suggestEl = $("div", "note");
  const readout = $("div", "readout"), c1 = $("div"), c2 = $("div");
  c1.append($("h2", "", "Cues (the adapter's script)"), cuesEl);
  c2.append($("h2", "", "Story lints"), lintsEl, suggestEl);
  readout.append(c1, c2);
  let adapted, player;
  const heard = [];
  const NAMES = () => ({ ...adapted.load.names, nima: name || "Nima" });
  const lineText = (target, text) => {
    target.lang = "tr";
    glossInto(target, text, GLOSS, { text, who: "", lang: "tr" });
  };
  function load() {
    adapted = adaptStory(STORY, { places: PLACES, characters: CHARACTERS, personalise });
    const p = storyPlayer(stage, adapted, {
      loadOptions: { narratorEl: kerim, onNarratorTalk: kerimOnTalk(kerim), narratorSound: "coo" },
      onCue: (i) => {
        if (player === p) addLog(i);
      },
      onChange: () => {
        if (player === p) draw();
      }
    });
    player = p;
    showLints();
  }
  function addLog(i) {
    if (!i.tr && i.kind !== "act") return;
    const p = $("p"), b = $("b"), t = $("span", "glossable");
    b.textContent = i.kind === "act" ? "\u25B8" : i.kind === "spot" ? "Kerim \u2726" : NAMES()[i.who ?? ""] ?? i.who ?? "";
    if (i.kind === "act") t.textContent = `${i.tr ?? "Act"} \u2192 ${String(player.picks[i.turn.id]).replace(/^obj:/, "")}`;
    else if (i.tr.trim() === "\u2026") t.textContent = i.tr;
    else lineText(t, i.tr);
    p.append(b, " ", t);
    if (translate && i.en && i.tr?.trim() !== "\u2026") p.append($("small", "tl", ` ${i.en}`));
    log.append(p);
    log.scrollTop = log.scrollHeight;
  }
  const aloudFor = (i) => !aloudOn || !STORY.arc?.mechanics.includes("aloud") || !canListen() ? void 0 : async (expected, onInterim, signal) => {
    const r = await listenFor(expected, ctx.lang, { signal, onInterim, match: { names: [name] } });
    heard.push({ cue: i, best: r.best, heard: r.heard });
    return r;
  };
  function cardFor(i, t) {
    const who = name || "Nima";
    if (t.kind === "say") return replyCard({ label: who, options: t.options, silent: t.silent, translate, text: lineText, onPick: () => player.say(), aloud: t.silent ? void 0 : aloudFor(i) });
    if (t.kind === "choice") return replyCard({ label: `${who} \u2014 choose`, options: t.options, translate, text: lineText, onPick: (k) => player.choose(k), aloud: aloudFor(i) });
    const card = $("div", "card");
    card.dataset.kind = "act";
    const pr = $("p", "", t.prompt?.tr ?? "");
    pr.lang = "tr";
    card.append($("small", "", `${who} \u2014 ${t.act.kind}${translate && t.prompt?.en ? ` \xB7 ${t.prompt.en}` : ""}`), pr, Object.assign(button("Sahnede \u25B8", () => void player.act()), { className: "primary" }));
    return card;
  }
  const primary = (text, fn) => Object.assign(button(text, fn), { className: "primary" });
  function draw() {
    const f = player.footer(), run = player.run;
    footer.replaceChildren();
    footer.dataset.cue = f.kind === "busy" ? "" : String(player.next);
    showCues();
    const act = run && "result" in run ? run : null;
    if (act && ix.active === act) {
      const card = $("div", "card");
      card.dataset.kind = "act";
      card.append($("p", "", act.act.prompt ?? ""), button("Keyboard list", () => ix.focus()), button("Skip \u25B8", () => act.skip()));
      footer.append(card);
      return;
    }
    if (f.kind === "busy" || f.kind === "devam") footer.append(primary("Devam \u25B8", () => player.devam()));
    else if (f.kind === "end") footer.append(primary("Ba\u015Ftan \u21BA", restart));
    else footer.append(cardFor(f.cue, f.turn));
  }
  function restart() {
    log.replaceChildren();
    heard.length = 0;
    load();
    draw();
  }
  function showCues() {
    const next = player.next;
    cuesEl.replaceChildren(...player.info.map((c, k) => {
      const cue = stage.script.cues[k], kind = Object.keys(cue)[0];
      const li = $("li", "", `${k} ${kind}${c.kind !== kind ? ` (${c.kind})` : ""}${c.who ? ` \xB7 ${c.who}` : ""}${"line" in cue ? ` \xB7 ${cue.line.text}` : "act" in cue ? ` \xB7 ${cue.act.kind} ${cue.act.targets.join(" ")}` : "overlay" in cue ? ` \xB7 ${cue.overlay.kind}` : ""}${c.turn ? ` \u25A3 ${c.turn.kind}` : ""}`);
      if (k === next - 1) li.setAttribute("aria-current", "step");
      if (k >= next) li.className = "later";
      return li;
    }));
  }
  function showLints() {
    const ps = lintStory(STORY, { places: PLACES, characters: CHARACTERS, kit: ctx.kit, solids: Object.fromEntries(Object.entries(PLACES).map(([id, p]) => [id, placeSolids(p, ctx.kit)])) }), ss = suggest(STORY, { places: PLACES, characters: CHARACTERS });
    lintsEl.replaceChildren();
    if (!ps.length) lintsEl.append($("li", "ok", "\u2713 no problems: deixis, var/yok, numbers, budget, via, silent, time, link, standin, mechanics, props, look, route"));
    for (const p of ps) lintsEl.append($("li", p.level, `${p.level} ${p.rule} @ step ${p.step}${p.option !== void 0 ? `.${p.option}` : ""}: ${p.message}`));
    suggestEl.textContent = ss.length ? `--suggest: ${ss.map((s) => `step ${s.step}${s.option !== void 0 ? `.${s.option}` : ""}: ${s.message}`).join(" \xB7 ")}` : "--suggest: nothing to add";
  }
  const nameIn = Object.assign($("input"), { type: "text", value: name, size: 10 });
  nameIn.setAttribute("aria-label", "The learner's name");
  nameIn.onchange = () => {
    name = nameIn.value.trim() || "Nima";
    store("story-name", name);
    restart();
  };
  const why = cannotListen();
  host.append(
    bar(
      "learner",
      nameIn,
      toggle("translations", translate, (v) => {
        translate = v;
        store("story-translate", v ? "1" : "0");
        draw();
      }),
      toggle("say it aloud", aloudOn, (v) => {
        aloudOn = v;
        store("story-aloud", v ? "1" : "0");
        draw();
      }),
      toggle("glosses", false, (v) => stage.setGlosses(v), "tap a word of a bubble or the log for its English and Persian"),
      toggle("log mode", logMode, (v) => {
        logMode = v;
        store("story-log", v ? "1" : "0");
        stage.setBubbles(!v);
      }, "lines only in the log below, no bubbles on stage (Kumru's log mode)"),
      $("small", "note", why ? `microphone hidden: ${why}` : "this browser can listen (tr-TR)")
    ),
    sec,
    readout
  );
  restart();
  const timer = setInterval(() => player.tick(), 250);
  ctx.cleanup(() => {
    clearInterval(timer);
    delete window.storyDemo;
  });
  window.storyDemo = { stage, get adapted() {
    return adapted;
  }, get picks() {
    return player.picks;
  }, get next() {
    return player.next;
  }, heard };
}
export {
  render
};
//# sourceMappingURL=stories-PXVFO7TE.js.map
