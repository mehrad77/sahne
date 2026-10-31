// The stage manager's notes on an episode (model/notes.ts): every problem of the story check and the stage lints in
// plain words, the ones the last edit brought first, each going to its block in the script, and with a fix button where
// one is obvious. Shown for the selected block, or for the whole episode.

import { html } from "htm/preact";
import { textOf, type StoryDoc } from "sahne-story";
import { notesOf, type ProblemLike } from "../../model/notes.ts";
import { within, type Path } from "../../model/path.ts";
import { world } from "../../store.ts";
import { langName, useLangs } from "../lang.ts";

export function NotesPanel(p: { problems: ProblemLike[]; path: Path | null; select(path: Path, focus?: boolean): void; edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void; onlyHere: boolean }) {
  const w = world.value!, { main } = useLangs();
  const all = notesOf(p.problems, { name: id => textOf(w.characters[id]?.name, main) ?? id, langName, standin: w.series?.standin ?? "nima" });
  const notes = p.onlyHere && p.path ? all.filter(n => !n.path || within(n.path, p.path!.slice(0, 2)) || within(p.path!, n.path)) : all;
  if (!notes.length) return html`<p class="note">${p.onlyHere && p.path ? "Nothing to fix in this block." : "Nothing to fix: the story check and the stage lints pass."}</p>`;
  return html`<ul class="notes">${notes.map(n => html`<li class=${`${n.level}${n.isNew ? " new" : ""}`}>
    <span class="dot" aria-label=${n.level}></span>
    <span class="grow">${n.isNew ? html`<b>New: </b>` : ""}${n.text}</span>
    ${n.path && html`<button class="small" onClick=${() => p.select(n.path!, true)}>Go</button>`}
    ${n.fix && html`<button class="small primary" onClick=${() => p.edit(n.fix!.apply, `fix.${n.rule}`)}>${n.fix.label}</button>`}
  </li>`)}</ul>`;
}
