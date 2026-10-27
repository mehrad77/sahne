// #/stories: every story the gallery can play (the bakkal test scene and each story of
// $SAHNE_CONTENT/stories/, from serve.mjs, so a new story shows by itself); #/stories/<id> plays
// one through the story adapter (sahne-story): the reply card with Söyle, a real choice, the "…" card,
// acts on stage, say it aloud where the browser can listen, tap-to-translate on its words, the learner's
// name, log mode (no bubbles: the lines only in the log, as Kumru can show them); beside it the adapter's cues and the story
// lints. Which cue plays next and what the footer offers is sahne-story's storyPlayer, the same logic Kumru's reader runs;
// this view only draws it. window.storyDemo is what shots.mjs and golden.mjs drive.

import { interact, propText, glossInto, browserVoice, placeSolids, type ActRun, type Stage } from "sahne";
import { canListen, cannotListen, listenFor } from "sahne/listen";
import { K_HEAD_VB, K_BUST, K_HEAD } from "sahne-kit/kerim/art";
import { adaptStory, lintStory, storyPlayer, suggest, type StoryPlayer, type CharacterDoc, type CueInfo, type Picks, type StoryPlace, type StoryStage, type Turn } from "sahne-story";
import { $, bar, button, css, frame, link, toggle } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import type { Draft } from "../shell/data.ts";
import { glossLookup, speak, type SceneGloss } from "../gloss.ts";
import { kerimPortrait, kerimOnTalk } from "../kerim.ts";
import { replyCard, type Aloud } from "../card.ts";

declare global { interface Window { storyDemo?: { stage: Stage; adapted: StoryStage; picks: Picks; next: number; heard: { cue: number; best: number; heard: string }[] } } }

const stored = (k: string, d: string) => { try { return localStorage.getItem("sahne:" + k) ?? d; } catch { return d; } };
const store = (k: string, v: string) => { try { localStorage.setItem("sahne:" + k, v); } catch { /* no storage */ } };

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

export async function render(host: HTMLElement, ctx: Ctx) {
  const [drafts, docs, vocab] = await Promise.all([ctx.data("drafts"), ctx.data("places"), ctx.data("vocab").catch(() => [])]);
  const id = ctx.route.path[0];
  const draft = drafts.find(d => d.id === id);
  if (!draft) {
    host.append($("h1", "", "Stories"), $("p", "note", "Each story played through the story adapter, as Kumru will play it: cards, choices, acts on stage, say it aloud, translations. A new story ($SAHNE_CONTENT/stories/<id>.json) shows here after a reload."));
    const cards = $("div", "cards");
    for (const d of drafts) {
      const a = link("", `#/stories/${d.id}`);
      a.className = "card";
      const t = d.story.title as unknown as Record<string, string> | string | undefined;
      a.append($("b", "", `${d.id}${d.fixture ? " · test scene" : ""}`), $("small", "", typeof t === "string" ? t : t?.tr ?? ""), $("small", "", `${d.story.steps?.length ?? 0} steps · ${Object.keys(d.characters).join(", ")}`));
      cards.append(a);
    }
    host.append(cards);
    return;
  }
  play(host, ctx, draft, Object.fromEntries(docs.map(p => [p.id, p])) as unknown as Record<string, StoryPlace>, vocab);
}

function play(host: HTMLElement, ctx: Ctx, draft: Draft, PLACES: Record<string, StoryPlace>, vocab: [string, string, string][]) {
  const STORY = draft.story, CHARACTERS = draft.characters as Record<string, CharacterDoc>;
  // the story's own glosses (`gl`: word → [fa, en]) over the A1 cards
  const GL: Record<string, SceneGloss> = Object.fromEntries(Object.entries(STORY.gl ?? {}).map(([w, [fa, en]]) => [w, { en, fa }]));
  const GLOSS = { lookup: glossLookup(GL, {}, vocab), speak };
  let name = stored("story-name", "Nima"), translate = stored("story-translate", "1") === "1", aloudOn = stored("story-aloud", "1") === "1";
  /** Kumru's personalizeStr, in small: the name token becomes the learner's name. */
  const personalise = (t: string, lang?: "tr" | "en" | "fa") => (name && name !== "Nima" ? t.replace(lang === "fa" ? /نیما/g : /Nima/g, name) : t);

  host.append(link("← every story", "#/stories"), $("h1", "", `${draft.id}${draft.fixture ? " · the bakkal test scene" : ""}`));
  const box = frame("16 / 10");
  host.append(box);
  let logMode = stored("story-log", "0") === "1";
  // bubbles on (theatre mode) so that "log mode" can switch them off and on (setBubbles)
  const stage = ctx.mount(box, { gloss: GLOSS, glosses: false, voice: browserVoice(), bubbles: logMode ? "log" : true });
  // the interaction layer goes on before the story loads (the atlas's alpha masks); explore when the week has it
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

  // the player (sahne-story's storyPlayer) keeps which cue is next and the picks; this view draws its footer and log
  let adapted!: StoryStage, player!: StoryPlayer;
  const heard: { cue: number; best: number; heard: string }[] = [];
  const NAMES = (): Record<string, string> => ({ ...adapted.load.names, nima: name || "Nima" });
  const lineText = (target: HTMLElement, text: string) => { target.lang = "tr"; glossInto(target, text, GLOSS, { text, who: "", lang: "tr" }); };

  /** A new adaptation (the learner's name is in it) and a player over it, at the opening scene. */
  function load() {
    adapted = adaptStory(STORY, { places: PLACES, characters: CHARACTERS, personalise });
    const p: StoryPlayer = storyPlayer(stage, adapted, {
      loadOptions: { narratorEl: kerim, onNarratorTalk: kerimOnTalk(kerim), narratorSound: "coo" },
      onCue: i => { if (player === p) addLog(i); },
      onChange: () => { if (player === p) draw(); },
    });
    player = p;
    showLints();
  }
  function addLog(i: CueInfo) {
    if (!i.tr && i.kind !== "act") return;
    const p = $("p"), b = $("b"), t = $("span", "glossable");
    b.textContent = i.kind === "act" ? "▸" : i.kind === "spot" ? "Kerim ✦" : NAMES()[i.who ?? ""] ?? i.who ?? "";
    if (i.kind === "act") t.textContent = `${i.tr ?? "Act"} → ${String(player.picks[(i.turn as Extract<Turn, { kind: "act" }>).id]).replace(/^obj:/, "")}`;
    else if (i.tr!.trim() === "…") t.textContent = i.tr!; else lineText(t, i.tr!);
    p.append(b, " ", t);
    if (translate && i.en && i.tr?.trim() !== "…") p.append($("small", "tl", ` ${i.en}`));
    log.append(p);
    log.scrollTop = log.scrollHeight;
  }
  /** The microphone, when the week turns `aloud` on, the learner did, and the browser can listen. */
  const aloudFor = (i: number) => !aloudOn || !STORY.arc?.mechanics.includes("aloud") || !canListen() ? undefined
    : async (expected: string[], onInterim: (t: string) => void, signal: AbortSignal): Promise<Aloud> => {
      const r = await listenFor(expected, ctx.lang, { signal, onInterim, match: { names: [name] } });
      heard.push({ cue: i, best: r.best, heard: r.heard });
      return r;
    };
  function cardFor(i: number, t: Turn): HTMLElement {
    const who = name || "Nima";
    if (t.kind === "say") return replyCard({ label: who, options: t.options, silent: t.silent, translate, text: lineText, onPick: () => player.say(), aloud: t.silent ? undefined : aloudFor(i) });
    if (t.kind === "choice") return replyCard({ label: `${who} — choose`, options: t.options, translate, text: lineText, onPick: k => player.choose(k), aloud: aloudFor(i) });
    // an act: played on stage (its answer goes back like a pick, and the script after it follows); this card only starts it
    const card = $("div", "card");
    card.dataset.kind = "act";
    const pr = $("p", "", t.prompt?.tr ?? "");
    pr.lang = "tr";
    card.append($("small", "", `${who} — ${t.act.kind}${translate && t.prompt?.en ? ` · ${t.prompt.en}` : ""}`), pr, Object.assign(button("Sahnede ▸", () => void player.act()), { className: "primary" }));
    return card;
  }
  const primary = (text: string, fn: () => void) => Object.assign(button(text, fn), { className: "primary" });
  function draw() {
    const f = player.footer(), run = player.run;
    footer.replaceChildren();
    footer.dataset.cue = f.kind === "busy" ? "" : String(player.next);
    showCues();
    // an act the learner is answering on stage: its own card (the keyboard list, skip)
    const act = run && "result" in run ? run as unknown as ActRun : null;
    if (act && ix.active === act) {
      const card = $("div", "card");
      card.dataset.kind = "act";
      card.append($("p", "", act.act.prompt ?? ""), button("Keyboard list", () => ix.focus()), button("Skip ▸", () => act.skip()));
      footer.append(card);
      return;
    }
    if (f.kind === "busy" || f.kind === "devam") footer.append(primary("Devam ▸", () => player.devam()));
    else if (f.kind === "end") footer.append(primary("Baştan ↺", restart));
    else footer.append(cardFor(f.cue, f.turn));
  }
  /** Back to the opening scene: adapted again (the learner's name may have changed), log and heard cleared. */
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
      const li = $("li", "", `${k} ${kind}${c.kind !== kind ? ` (${c.kind})` : ""}${c.who ? ` · ${c.who}` : ""}${"line" in cue ? ` · ${cue.line.text}` : "act" in cue ? ` · ${cue.act.kind} ${cue.act.targets.join(" ")}` : "overlay" in cue ? ` · ${cue.overlay.kind}` : ""}${c.turn ? ` ▣ ${c.turn.kind}` : ""}`);
      if (k === next - 1) li.setAttribute("aria-current", "step");
      if (k >= next) li.className = "later";
      return li;
    }));
  }
  function showLints() {
    const ps = lintStory(STORY, { places: PLACES, characters: CHARACTERS, kit: ctx.kit, solids: Object.fromEntries(Object.entries(PLACES).map(([id, p]) => [id, placeSolids(p, ctx.kit)])) }), ss = suggest(STORY, { places: PLACES, characters: CHARACTERS });
    lintsEl.replaceChildren();
    if (!ps.length) lintsEl.append($("li", "ok", "✓ no problems: deixis, var/yok, numbers, budget, via, silent, time, link, standin, mechanics, props, look, route"));
    for (const p of ps) lintsEl.append($("li", p.level, `${p.level} ${p.rule} @ step ${p.step}${p.option !== undefined ? `.${p.option}` : ""}: ${p.message}`));
    suggestEl.textContent = ss.length ? `--suggest: ${ss.map(s => `step ${s.step}${s.option !== undefined ? `.${s.option}` : ""}: ${s.message}`).join(" · ")}` : "--suggest: nothing to add";
  }

  // ---- the learner's settings ----
  const nameIn = Object.assign($("input"), { type: "text", value: name, size: 10 });
  nameIn.setAttribute("aria-label", "The learner's name");
  nameIn.onchange = () => { name = nameIn.value.trim() || "Nima"; store("story-name", name); restart(); };
  const why = cannotListen();
  host.append(
    bar("learner", nameIn,
      toggle("translations", translate, v => { translate = v; store("story-translate", v ? "1" : "0"); draw(); }),
      toggle("say it aloud", aloudOn, v => { aloudOn = v; store("story-aloud", v ? "1" : "0"); draw(); }),
      toggle("glosses", false, v => stage.setGlosses(v), "tap a word of a bubble or the log for its English and Persian"),
      toggle("log mode", logMode, v => { logMode = v; store("story-log", v ? "1" : "0"); stage.setBubbles(!v); }, "lines only in the log below, no bubbles on stage (Kumru's log mode)"),
      $("small", "note", why ? `microphone hidden: ${why}` : "this browser can listen (tr-TR)")),
    sec, readout,
  );
  restart();
  // the footer follows the performance even where animation frames are paused (a hidden tab)
  const timer = setInterval(() => player.tick(), 250);
  ctx.cleanup(() => { clearInterval(timer); delete window.storyDemo; });
  window.storyDemo = { stage, get adapted() { return adapted; }, get picks() { return player.picks; }, get next() { return player.next; }, heard };
}
