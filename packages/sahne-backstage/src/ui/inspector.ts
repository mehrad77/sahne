// The inspector: the form for what is selected in an episode, a step, a choice's option or one of its replies, or the
// episode itself (its titles, summary, quiz and glosses). The words come first (Turkish, English, Persian); staging
// follows (src/ui/staging.ts). Every control edits the document at its path (src/model/path.ts).

import { html } from "htm/preact";
import type { StoryDoc } from "sahne-story";
import { get, set, type Path } from "../model/path.ts";
import { kindOf } from "../model/steps.ts";
import { Check, Select, Text, Tri } from "./fields.ts";
import { Json, SceneFields, Staging, StepTools } from "./staging.ts";
import { AiRewrite } from "./ai.ts";
import { world } from "../store.ts";

export interface InspectorProps {
  story: StoryDoc;
  saved: StoryDoc;
  path: Path | null;
  cast: string[];
  /** Edit the story: `fn` gets the document; `field` names a typed field (one undo step). */
  edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void;
  /** Select another step (after a move, an insert, a delete). */
  select(path: Path | null): void;
}

const TONES = ["polite", "warm", "formal", "casual", "blunt", "rude"];

/** Controls for the value at `path` + `key`. */
export const at = (p: InspectorProps, path: Path) => ({
  value: (key: string) => get(p.story, [...path, key]),
  changed: (key: string) => JSON.stringify(get(p.story, [...path, key])) !== JSON.stringify(get(p.saved, [...path, key])),
  put: (key: string, v: unknown) => p.edit(s => set(s, [...path, key], v), `${path.join(".")}.${key}`),
});

export function Inspector(p: InspectorProps) {
  if (!p.path) return html`<${EpisodeFields} ...${p} />`;
  const v = get(p.story, p.path) as Record<string, any> | undefined;
  if (!v) return html`<p class="note">Nothing here any more.</p>`;
  const where = p.path.join(" › ");
  const isOption = p.path.at(-2) === "options";
  const isReply = p.path.at(-2) === "reply";
  const kind = isOption ? "option" : kindOf(v);
  return html`<div class="fields">
    <div class="note">${kind} · ${where}</div>
    <${StepTools} story=${p.story} path=${p.path} cast=${p.cast} edit=${(fn: (s: StoryDoc) => StoryDoc) => p.edit(fn)} select=${p.select} />
    ${kind === "line" && html`<${LineWords} ...${p} path=${p.path} reply=${isReply} />`}
    ${kind === "option" && html`<${OptionWords} ...${p} path=${p.path} />`}
    ${kind === "spot" && html`<${SpotWords} ...${p} path=${[...p.path, "spot"]} />`}
    ${kind === "choice" && html`<${ChoiceFields} ...${p} path=${[...p.path, "choice"]} />`}
    ${kind === "act" && html`<${Tri} label="Prompt" doc=${v.act?.prompt} saved=${get(p.saved, [...p.path, "act", "prompt"])} onInput=${(k: string, x: string | undefined) => p.edit(s => set(s, [...p.path!, "act", "prompt", k], x), `${where}.prompt.${k}`)} />`}
    ${(kind === "line" || kind === "option") && html`<${AiRewrite} story=${p.story} path=${p.path} edit=${(fn: (s: StoryDoc) => StoryDoc) => p.edit(fn)} />`}
    ${(kind === "line" || kind === "option") && html`<${Staging} ...${p} path=${p.path} />`}
    ${kind === "beat" && html`<${Staging} ...${p} path=${[...p.path, "beat"]} />`}
    ${kind === "scene" && html`<${SceneFields} ...${p} path=${p.path} />`}
    <details><summary>The step as JSON (for what the forms do not cover)</summary>
      <${Json} label=${where} rows=${12} value=${v} onInput=${(x: unknown) => x && typeof x === "object" && p.edit(s => set(s, p.path!, x))} />
    </details>
  </div>`;
}

function LineWords(p: InspectorProps & { path: Path; reply: boolean }) {
  const f = at(p, p.path);
  const narr = f.value("narr") === true;
  return html`<${Select} label="Who speaks" value=${f.value("who")} options=${p.cast} changed=${f.changed("who")} onInput=${(x: string | undefined) => f.put("who", x)} />
    <${Tri} label="Line" multi doc=${get(p.story, p.path) as Record<string, unknown>} saved=${get(p.saved, p.path) as Record<string, unknown>} onInput=${(k: string, x: string | undefined) => f.put(k, x ?? "")} />
    ${f.value("who") === "kerim" && html`<${Check} label="Kerim narrates (to the viewer, no bubble)" value=${narr} onInput=${(x: boolean) => f.put("narr", x || undefined)} />`}
    <details><summary>A note for the learner</summary>
      ${(["en", "fa"] as const).map(k => html`<${Text} label=${k === "en" ? "Note · English" : "Note · Persian"} lang=${k} multi value=${(f.value("note") as Record<string, unknown> | undefined)?.[k]}
        onInput=${(x: string | undefined) => p.edit(s => { const n = { ...((get(s, [...p.path, "note"]) as object) ?? {}), [k]: x }; if (x === undefined) delete (n as Record<string, unknown>)[k]; return set(s, [...p.path, "note"], Object.keys(n).length ? n : undefined); }, `${p.path.join(".")}.note.${k}`)} />`)}
    </details>`;
}

function OptionWords(p: InspectorProps & { path: Path }) {
  const f = at(p, p.path);
  return html`<${Tri} label="The stand-in's option" multi doc=${get(p.story, p.path) as Record<string, unknown>} saved=${get(p.saved, p.path) as Record<string, unknown>} onInput=${(k: string, x: string | undefined) => f.put(k, x ?? "")} />
    <div class="row">
      <${Check} label="The fitting answer (ok)" value=${f.value("ok")} onInput=${(x: boolean) => f.put("ok", x || undefined)} />
      <div class="grow"><${Select} label="Tone" value=${f.value("tone")} options=${TONES} changed=${f.changed("tone")} onInput=${(x: string | undefined) => f.put("tone", x)} /></div>
    </div>`;
}

function SpotWords(p: InspectorProps & { path: Path }) {
  const f = at(p, p.path);
  return html`<${Text} label="Lesson" value=${f.value("lesson")} changed=${f.changed("lesson")} onInput=${(x: string | undefined) => f.put("lesson", x)} />
    <${Text} label="Example: a line of the story" lang="tr" value=${f.value("ex")} changed=${f.changed("ex")} onInput=${(x: string | undefined) => f.put("ex", x)} />
    <${Tri} label="Kerim's words" multi doc=${get(p.story, p.path) as Record<string, unknown>} saved=${get(p.saved, p.path) as Record<string, unknown>} onInput=${(k: string, x: string | undefined) => f.put(k, x)} />`;
}

function ChoiceFields(p: InspectorProps & { path: Path }) {
  const f = at(p, p.path);
  return html`<${Text} label="Choice id" value=${f.value("id")} changed=${f.changed("id")} onInput=${(x: string | undefined) => f.put("id", x)} />
    <${Select} label="Kind" value=${f.value("kind")} options=${["polite", "meaning", "action"]} changed=${f.changed("kind")} onInput=${(x: string | undefined) => f.put("kind", x)} />
    <${Select} label="Said to" value=${f.value("to")} options=${p.cast} changed=${f.changed("to")} onInput=${(x: string | undefined) => f.put("to", x)} />
    <p class="note">Each option and its replies are rows below the choice in the step list.</p>`;
}

/** The episode's own fields: titles, summary, the quiz, the glosses. */
function EpisodeFields(p: InspectorProps) {
  const top = (key: string) => ({ value: (p.story as Record<string, unknown>)[key], put: (v: unknown) => p.edit(s => set(s, [key], v), key) });
  const quiz = (p.story.quiz ?? []) as Record<string, any>[];
  const gl = Object.entries(p.story.gl ?? {});
  return html`<div class="fields">
    <div class="note">The episode · ${p.story.id}</div>
    <${Tri} label="Title" keys=${["title", "titleEn", "titleFa"]} doc=${p.story as Record<string, unknown>} saved=${p.saved as Record<string, unknown>} onInput=${(k: string, x: string | undefined) => top(k).put(x ?? "")} />
    <${Text} label="Summary · English" multi value=${top("summary").value} onInput=${(x: string | undefined) => top("summary").put(x ?? "")} />
    <${Text} label="Summary · Persian" lang="fa" multi value=${top("summaryFa").value} onInput=${(x: string | undefined) => top("summaryFa").put(x ?? "")} />
    <${CastPicker} ...${p} />
    <h3>Quiz</h3>
    ${quiz.map((q, i) => html`<div class="panel fields">
      <${Text} label=${`Question ${i + 1} · Turkish`} lang="tr" value=${q.q} onInput=${(x: string | undefined) => p.edit(s => set(s, ["quiz", i, "q"], x ?? ""), `quiz.${i}.q`)} />
      <${Text} label="English" value=${q.en} onInput=${(x: string | undefined) => p.edit(s => set(s, ["quiz", i, "en"], x ?? ""), `quiz.${i}.en`)} />
      <${Text} label="Persian" lang="fa" value=${q.fa} onInput=${(x: string | undefined) => p.edit(s => set(s, ["quiz", i, "fa"], x ?? ""), `quiz.${i}.fa`)} />
      ${(q.options ?? []).map((o: string, k: number) => html`<div class="row"><input type="radio" style="width:auto" name=${`q${i}`} checked=${q.a === k} onChange=${() => p.edit(s => set(s, ["quiz", i, "a"], k))} title="The right answer" />
        <div class="grow"><${Text} label=${`Option ${k + 1}${q.a === k ? " (right)" : ""}`} lang="tr" value=${o} onInput=${(x: string | undefined) => p.edit(s => set(s, ["quiz", i, "options", k], x ?? ""), `quiz.${i}.o${k}`)} /></div></div>`)}
      <${Text} label="Why (quote the line in “ ”)" multi value=${q.why} onInput=${(x: string | undefined) => p.edit(s => set(s, ["quiz", i, "why"], x ?? ""), `quiz.${i}.why`)} />
      <${Select} label="Kind" value=${q.kind} options=${["comp", "word"]} onInput=${(x: string | undefined) => p.edit(s => set(s, ["quiz", i, "kind"], x))} />
    </div>`)}
    <h3>Glosses (a word the cards do not have: Persian, English)</h3>
    <table class="grid"><tbody>
      ${gl.map(([w, [fa, en]]) => html`<tr><td lang="tr">${w}</td>
        <td><input dir="rtl" lang="fa" value=${fa} onInput=${(e: Event) => p.edit(s => set(s, ["gl", w], [(e.target as HTMLInputElement).value, en]), `gl.${w}.fa`)} /></td>
        <td><input value=${en} onInput=${(e: Event) => p.edit(s => set(s, ["gl", w], [fa, (e.target as HTMLInputElement).value]), `gl.${w}.en`)} /></td>
        <td><button class="small danger" onClick=${() => p.edit(s => set(s, ["gl", w], undefined))}>remove</button></td></tr>`)}
    </tbody></table>
    <${AddGloss} onAdd=${(w: string) => p.edit(s => set(s, ["gl", w.toLocaleLowerCase("tr")], ["", ""]))} />
  </div>`;
}

/** Who is in the episode: its `cast` (the roster, 2 to 6, the stand-in among them) and its `extras` (the silent people). */
function CastPicker(p: InspectorProps) {
  const w = world.value!;
  const narrator = w.series?.narrator ?? "kerim";
  const cast = p.story.cast ?? [], extras = p.story.extras ?? [];
  const lines = new Map<string, number>();
  JSON.stringify(p.story.steps, (k, v) => { if (k === "who" && typeof v === "string") lines.set(v, (lines.get(v) ?? 0) + 1); return v; });
  const people = Object.values(w.characters).filter(c => c.id !== narrator).sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0) || a.id.localeCompare(b.id));
  const toggle = (key: "cast" | "extras", list: string[], id: string, on: boolean) => p.edit(s => set(s, [key], on ? [...list, id] : list.filter(x => x !== id)));
  const box = (key: "cast" | "extras", list: string[], c: (typeof people)[number]) => {
    const n = lines.get(c.id) ?? 0;
    return html`<label class="row" title=${n ? `${n} lines in this episode` : ""}><input type="checkbox" style="width:auto" checked=${list.includes(c.id)}
      onChange=${(e: Event) => toggle(key, list, c.id, (e.target as HTMLInputElement).checked)} /> ${c.name ?? c.id}${n ? html` <small class="note">${n} lines</small>` : ""}${key === "extras" ? html` <small class="note">${c.id}</small>` : ""}</label>`;
  };
  const changed = (key: "cast" | "extras") => JSON.stringify(p.story[key] ?? []) !== JSON.stringify(p.saved[key] ?? []);
  return html`<div class="field"><label>Cast (${cast.length}; 2 to 6, the stand-in among them; ${w.characters[narrator]?.name ?? narrator} narrates in every episode)${changed("cast") ? " · changed" : ""}</label>
      <div class="row">${people.filter(c => c.kind !== "extra").map(c => box("cast", cast, c))}</div></div>
    <details open=${extras.length > 0}><summary>Extras (${extras.length}): the silent people of the place${changed("extras") ? " · changed" : ""}</summary>
      <div class="row">${people.filter(c => c.kind === "extra").map(c => box("extras", extras, c))}</div></details>`;
}

function AddGloss(p: { onAdd(w: string): void }) {
  return html`<form class="row" onSubmit=${(e: Event) => { e.preventDefault(); const i = (e.target as HTMLFormElement).elements.namedItem("w") as HTMLInputElement; if (i.value.trim()) { p.onAdd(i.value.trim()); i.value = ""; } }}>
    <input name="w" lang="tr" placeholder="a word (lower case)" style="max-width:220px" /><button>Add a gloss</button></form>`;
}
