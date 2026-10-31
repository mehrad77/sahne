// The selected block's details, in a drawer beside the script: everything the script's chips do not show. Its staging
// in full (ui/staging.ts: the forms for every field, the moves, prop changes, reactions, links, sounds), a scene's time,
// weather and states, a line's note for the learner in the translations, the narrator speaking to the viewer, the flags
// that gate it, and the step as JSON for anything else.

import { html } from "htm/preact";
import type { StoryDoc } from "sahne-story";
import { get, set, type Path } from "../../model/path.ts";
import { kindOf } from "../../model/steps.ts";
import { world } from "../../store.ts";
import { Check, Text } from "../fields.ts";
import { Json, SceneFields, Staging } from "../staging.ts";
import { Texts } from "../lang.ts";

export function Details(p: { story: StoryDoc; saved: StoryDoc; path: Path | null; cast: string[]; edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void }) {
  if (!p.path) return html`<p class="note">Select a block of the script to see all of its staging.</p>`;
  const v = get(p.story, p.path) as Record<string, any> | undefined;
  if (!v) return html`<p class="note">Nothing here any more.</p>`;
  const option = p.path.at(-2) === "options", kind = option ? "option" : kindOf(v);
  const where = p.path.join(".");
  const put = (k: string, x: unknown) => p.edit(s => set(s, [...p.path!, k], x), `${where}.${k}`);
  const narrator = world.value?.series?.narrator ?? "kerim";
  return html`<div class="fields">
    <div class="note">${kind} · ${p.path.slice(1).join(" › ")}</div>
    ${(kind === "line" || kind === "option") && html`<${Staging} ...${p} path=${p.path} />`}
    ${kind === "beat" && html`<${Staging} ...${p} path=${[...p.path, "beat"]} />`}
    ${kind === "scene" && html`<${SceneFields} ...${p} path=${p.path} />`}
    ${kind === "line" && v.who === narrator && html`<${Check} label="The narrator speaks to the viewer (no bubble)" value=${v.narr === true} onInput=${(x: boolean) => put("narr", x || undefined)} />`}
    ${kind === "line" && html`<${Texts} label="A note for the learner" need="translations" multi value=${v.note} onInput=${(l: string, x?: string) => p.edit(s => {
      const n = { ...((get(s, [...p.path!, "note"]) as object) ?? {}), [l]: x } as Record<string, unknown>;
      if (x === undefined) delete n[l];
      return set(s, [...p.path!, "note"], Object.keys(n).length ? n : undefined);
    }, `${where}.note.${l}`)} />`}
    ${(kind === "line" || kind === "beat" || kind === "choice") && html`<div class="row">
      <div class="grow"><${Text} label="Only if an earlier story set the flag (if)" value=${v.if} onInput=${(x?: string) => put("if", x)} /></div>
      <div class="grow"><${Text} label="Only if it did not (unless)" value=${v.unless} onInput=${(x?: string) => put("unless", x)} /></div></div>`}
    <details><summary>The step as JSON</summary>
      <${Json} label=${where} rows=${14} value=${v} onInput=${(x: unknown) => x && typeof x === "object" && p.edit(s => set(s, p.path!, x))} /></details>
  </div>`;
}
