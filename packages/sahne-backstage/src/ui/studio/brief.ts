// The Brief stage of an episode: what happens, where and when, who is in it (EpisodeHead: the title, the premise and the
// cast), how it plays (as the series does, or interactive, or watch-only), and what the series' plugins ask of it (the
// lesson plugin: the target words and lessons). A draft fresh from the new-episode page offers to draft its script from
// the brief as a one-step task (server/runs): *Check with me* or *Just do it*, within a budget, written straight in and
// undoable, its progress on the page's task line.

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { allLanguages, playOf, textOf, type StoryDoc, type StoryPlace } from "sahne-story";
import { api } from "../../api.ts";
import { set } from "../../model/path.ts";
import { say, world } from "../../store.ts";
import { loadRuns } from "../../runs.ts";
import { settingsNow } from "../settings.ts";
import { Icon } from "../kit/index.ts";
import { Gallery } from "../kit/gallery.ts";
import { placeItems } from "../galleries.ts";
import { langName, useLangs } from "../lang.ts";
import { editorPluginsOf } from "../plugins/index.ts";
import { storyPluginsOf } from "../../model/plugins.ts";
import { EpisodeHead } from "./sections.ts";

interface Props { story: StoryDoc; saved: StoryDoc; edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void; onWrite(): void }

/** The brief in words, for the task that drafts the script from it. */
function briefText(s: StoryDoc, langs: { main: string; translations: string[] }): string {
  const w = world.value!, name = (id: string) => textOf(w.characters[id]?.name, langs.main) ?? id;
  const first = s.steps.find(x => "scene" in x) as { scene?: string; time?: string } | undefined;
  const plugins = storyPluginsOf(w.series);
  return [
    `Draft the script of episode ${s.id}, "${textOf(s.title, langs.main) ?? ""}", from its brief, in ${allLanguages(langs).map(langName).join(", ")} (the main language first).`,
    `What happens: ${Object.values(s.summary ?? {}).find(Boolean) ?? "(no premise yet)"}`,
    `Where: ${s.place}${first?.time ? `, at ${first.time}` : ""}. Who: ${[...(s.cast ?? []), ...(s.extras ?? [])].map(name).join(", ")}.`,
    playOf(s, w.series) === "watch" ? "It is watch-only: no choices and nothing for the viewer to do; the stand-in has plain lines." : "It is interactive: the stand-in's lines are the viewer's, with a choice.",
    ...plugins.flatMap(pl => (pl.prompt ? [pl.prompt] : [])),
    "Replace the placeholder lines (…) with the real ones, stage each line (who does what, whom it is said to), and check it with check_episode until it has no errors.",
  ].join("\n");
}

/** Draft the script from the brief: a one-step task on this episode. */
function DraftCard(p: Props) {
  const w = world.value!, langs = useLangs();
  const [budget, setBudget] = useState(4), [busy, setBusy] = useState(false);
  const mode0 = settingsNow()?.runMode ?? "check";
  const start = async (mode: "check" | "auto") => {
    setBusy(true);
    const brief = briefText(p.story, langs);
    const r = await api.post<{ run: { id: string } }>("runs", {
      goal: `Draft episode ${p.story.id} from its brief`, mode, maxUsd: budget, gates: { plan: false },
      plan: { brief, steps: [{ id: "draft", kind: "episode", title: `Draft ${p.story.id}`, about: "Writes the episode's script from its brief", brief, owns: [{ kind: "story", id: p.story.id }] }] },
    });
    setBusy(false);
    if (r.status !== 200) { say((r as { message?: string }).message ?? "the task did not start", true); return; }
    void loadRuns();
    p.onWrite();
  };
  return html`<div class="draft-card" role="group" aria-label="Draft the script">
    <b>Start from the brief</b>
    <p class="note">Fill in what happens, where and who. Then the assistant drafts the whole script as a task you can watch, pause and undo. Or write it yourself in Script.</p>
    ${w.ai ? html`<div class="row wrap">
        <button class=${mode0 === "check" ? "primary" : ""} disabled=${busy} onClick=${() => void start("check")}><${Icon} name="spark" size=${15} /> Draft it with the assistant</button>
        <button class=${mode0 === "auto" ? "primary" : ""} disabled=${busy} onClick=${() => void start("auto")} title="No stops: it decides the choices itself and tells you what it chose">Just do it</button>
        <label class="row note">up to $ <input type="number" min="1" step="1" style="max-width:70px" value=${budget} onInput=${(e: Event) => setBudget(Math.max(1, Number((e.target as HTMLInputElement).value) || 1))} /></label>
        <button class="linkish" onClick=${p.onWrite}>Write it myself</button></div>`
      : html`<div class="row"><button class="primary" onClick=${p.onWrite}>Write it in Script</button><span class="note">The assistant is off: backstage was started without <code>ANTHROPIC_API_KEY</code>.</span></div>`}
  </div>`;
}

export function Brief(p: Props) {
  const w = world.value!;
  const s = p.story;
  const scene = s.steps.findIndex(x => "scene" in x), first = scene >= 0 ? (s.steps[scene] as { scene: string; time?: string }) : undefined;
  const place = w.places[s.place] as StoryPlace | undefined;
  /** The opening place: the story's, and its first scene's. */
  const setPlace = (id: string) => p.edit(x => { let y = set(x, ["place"], id); if (scene >= 0) y = set(y, ["steps", scene, "scene"], id); return y; }, "place");
  const play = s.play, inherited = playOf({}, w.series);
  // a draft whose lines are still mostly placeholders (the new-episode page's skeleton) is one to draft from the brief
  const main = useLangs().main, said = s.steps.filter(x => "who" in x).map(x => String((x as unknown as Record<string, unknown>)[main] ?? "").trim());
  const fresh = !!s.draft && (!said.length || said.filter(t => !t || t === "…").length * 2 >= said.length);
  return html`<div class="brief">
    ${fresh && html`<${DraftCard} ...${p} />`}
    <${EpisodeHead} story=${s} saved=${p.saved} edit=${p.edit} />
    <div class="field"><label>Where it happens</label>
      <${Gallery} items=${placeItems()} value=${[s.place]} onPick=${setPlace} label="Places" size="s" />
      ${place?.times && place.times.length > 1 && scene >= 0 && html`<div class="row" style="margin-top:6px"><span class="note">Time of day</span>
        <span class="segmented">${place.times.map(t => html`<button class="small" aria-pressed=${(first?.time ?? place.times![0]) === t} onClick=${() => p.edit(x => set(x, ["steps", scene, "time"], t === place.times![0] ? undefined : t), "time")}>${t}</button>`)}</span></div>`}</div>
    <div class="field"><label>How it plays</label>
      <div class="segmented" role="group" aria-label="How it plays">
        <button aria-pressed=${!play} onClick=${() => p.edit(x => set(x, ["play"], undefined), "play")}>As the series (${inherited === "watch" ? "watch only" : "interactive"})</button>
        <button aria-pressed=${play === "interactive"} onClick=${() => p.edit(x => set(x, ["play"], "interactive"), "play")}>Interactive</button>
        <button aria-pressed=${play === "watch"} onClick=${() => p.edit(x => set(x, ["play"], "watch"), "play")}>Watch only</button></div>
      <p class="note">${playOf(s, w.series) === "watch" ? "It plays on time alone: no choices, nothing for the viewer to do, no cards. The check refuses a choice or an act in it." : "The viewer says the stand-in's lines, chooses and acts; the story waits for them."}</p></div>
    ${editorPluginsOf(w.series).map(ep => ep.Brief && html`<div class="plugbox"><span class="tag">${ep.stage?.name ?? ep.id} · plugin</span><${ep.Brief} story=${s} saved=${p.saved} edit=${p.edit} /></div>`)}
  </div>`;
}
