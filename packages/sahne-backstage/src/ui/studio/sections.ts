// The episode's head, above its script: the title and premise in the series' languages, the cast and the extras as
// portraits to add or take away, and what the series' plugins add (ui/plugins: what the lesson plugin's episode teaches).

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { textOf, type StoryDoc } from "sahne-story";
import { set } from "../../model/path.ts";
import { world } from "../../store.ts";
import { portraitOf, Picker } from "../galleries.ts";
import { Icon } from "../kit/index.ts";
import { Texts, useLangs } from "../lang.ts";
import { editorPluginsOf } from "../plugins/index.ts";

interface Props { story: StoryDoc; saved: StoryDoc; edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void }

export function EpisodeHead(p: Props) {
  const w = world.value!, langs = useLangs();
  const narrator = w.series?.narrator ?? "kerim", standin = w.series?.standin ?? "nima";
  const [pick, setPick] = useState<{ x: number; y: number } | null>(null);
  const cast = p.story.cast ?? [], extras = p.story.extras ?? [];
  const lines = new Map<string, number>();
  JSON.stringify(p.story.steps, (k, v) => { if (k === "who" && typeof v === "string") lines.set(v, (lines.get(v) ?? 0) + 1); return v; });
  const toggle = (id: string) => {
    const extra = w.characters[id]?.kind === "extra", key = extra ? "extras" : "cast", list = extra ? extras : cast;
    p.edit(s => set(s, [key], list.includes(id) ? list.filter(x => x !== id) : [...list, id]));
  };
  const person = (id: string) => {
    const c = w.characters[id], n = lines.get(id) ?? 0;
    return html`<span class="person" title=${`${textOf(c?.name, langs.main) ?? id}${n ? `: ${n} lines` : ""}`}>
      <span class="face" dangerouslySetInnerHTML=${{ __html: portraitOf(c, 40, "head") }}></span>
      <span>${textOf(c?.name, langs.main) ?? id}${n ? html`<small>${n}</small>` : ""}</span>
      ${id !== standin && html`<button aria-label=${`Take ${id} out`} onClick=${() => toggle(id)}>×</button>`}</span>`;
  };
  return html`<div class="ep-head">
    <${Texts} label="Title" value=${p.story.title} saved=${p.saved.title} onInput=${(l: string, v?: string) => p.edit(s => set(s, ["title", l], v ?? ""), `title.${l}`)} />
    <${Texts} label="Premise" need="translations" multi value=${p.story.summary} saved=${p.saved.summary} onInput=${(l: string, v?: string) => p.edit(s => set(s, ["summary", l], v ?? ""), `summary.${l}`)} />
    <div class="field"><label>Who is in it (the cast, 2 to 6; ${textOf(w.characters[narrator]?.name, langs.main) ?? narrator} narrates every episode)</label>
      <div class="people">${cast.map(person)}${extras.map(person)}
        <button class="schip add" onClick=${(e: MouseEvent) => setPick({ x: e.clientX, y: e.clientY })}><${Icon} name="plus" size=${12} /> someone</button></div></div>
    ${editorPluginsOf(w.series).map(ep => ep.Head && !ep.Brief && html`<${ep.Head} story=${p.story} saved=${p.saved} edit=${p.edit} />`)}
    ${pick && html`<${Picker} kind="character" multi x=${pick.x} y=${pick.y} value=${[...cast, ...extras]} ids=${Object.keys(w.characters).filter(id => id !== narrator && id !== standin)} onPick=${toggle} onClose=${() => setPick(null)} />`}
  </div>`;
}
