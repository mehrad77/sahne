// What changed in an episode since the last commit (git's HEAD): the episode's fields, and its steps step by step as
// the script reads them (ui/stepdiff.ts), with a button that puts a changed or removed step back as it was committed. A
// person commits; backstage never does.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import type { StoryDoc } from "sahne-story";
import { api } from "../api.ts";
import { changes } from "../model/diff.ts";
import { insert, set, type Path } from "../model/path.ts";
import { stepDiff, type StepChange } from "../model/stepdiff.ts";
import { StepDiff } from "./stepdiff.ts";
import { useLangs } from "./lang.ts";

/**
 * Where a step removed since the commit goes back: after the step that came before it there, wherever that step is now
 * (or first, when none of the steps before it is left).
 */
export function putBackAt(steps: readonly StepChange[], was: number): number {
  const before = steps.filter(e => e.was !== undefined && e.was < was && e.now !== undefined).sort((a, b) => b.was! - a.was!)[0];
  return before ? before.now! + 1 : 0;
}

export function ChangesPanel(p: { id: string; story: StoryDoc; savedAt?: number; edit(fn: (s: StoryDoc) => StoryDoc): void; select(path: Path): void }) {
  const [head, setHead] = useState<StoryDoc | null | undefined>(undefined);
  const { main } = useLangs();
  useEffect(() => { void api.head("story", p.id).then(r => setHead(r.status === 200 ? (r.doc as StoryDoc | null) : null)); }, [p.id, p.savedAt]);
  if (head === undefined) return html`<p class="note">Reading the last commit…</p>`;
  if (head === null) return html`<p class="note">This episode is not in a commit yet (or the content root is not a git repository).</p>`;
  const c = changes(head, p.story);
  if (!c.fields.length && !c.rows.length && !c.added && !c.removed) return html`<p class="note">No changes since the last commit.</p>`;
  // a changed step goes back in its place; a removed one goes back after the step before it
  const putBack = (e: StepChange) => {
    if (e.was === undefined) return null;
    const was = head.steps[e.was];
    const at = (s: StoryDoc) => (e.now !== undefined ? set(s, ["steps", e.now], was) : insert(s, ["steps"], putBackAt(stepDiff(head, s, { main, langs: [main], name: x => x }).steps, e.was!), was));
    return (e.status === "changed" || e.status === "removed") && html`<button class="small" onClick=${() => p.edit(at)}>Put back as committed</button>`;
  };
  return html`<div class="fields">
    ${c.fields.length > 0 && html`<p>Episode fields changed: ${c.fields.join(", ")}</p>`}
    <${StepDiff} was=${head} now=${p.story} actions=${putBack} go=${(at: { now?: number }) => { if (at.now !== undefined) p.select(["steps", at.now]); }} />
  </div>`;
}
