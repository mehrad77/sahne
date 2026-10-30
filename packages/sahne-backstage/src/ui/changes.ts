// What changed in an episode since the last commit (git's HEAD): the episode's fields and each changed step, with its
// words diffed word by word, and a button that puts one step back as it was committed. A person commits; backstage
// never does.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import type { StoryDoc } from "sahne-story";
import { api } from "../api.ts";
import { changes, diffWords } from "../model/diff.ts";
import { get, set, type Path } from "../model/path.ts";
import { inLang, useLangs } from "./lang.ts";

export function ChangesPanel(p: { id: string; story: StoryDoc; savedAt?: number; edit(fn: (s: StoryDoc) => StoryDoc): void; select(path: Path): void }) {
  const [head, setHead] = useState<StoryDoc | null | undefined>(undefined);
  const { main, translations } = useLangs(), langs = [main, ...translations];
  useEffect(() => { void api.head("story", p.id).then(r => setHead(r.status === 200 ? (r.doc as StoryDoc | null) : null)); }, [p.id, p.savedAt]);
  if (head === undefined) return html`<p class="note">Reading the last commit…</p>`;
  if (head === null) return html`<p class="note">This episode is not in a commit yet (or the content root is not a git repository).</p>`;
  const c = changes(head, p.story);
  if (!c.fields.length && !c.rows.length && !c.added && !c.removed) return html`<p class="note">No changes since the last commit.</p>`;
  return html`<div class="fields">
    ${c.fields.length > 0 && html`<p>Episode fields changed: ${c.fields.join(", ")}</p>`}
    ${(c.added > 0 || c.removed > 0) && html`<p class="note">${c.added ? `${c.added} steps more` : ""}${c.removed ? `${c.removed} steps fewer` : ""} than the last commit: the rows below are compared place by place.</p>`}
    ${c.rows.map(({ row, was, now }) => {
      const w = was as Record<string, unknown> | undefined, n = now as Record<string, unknown> | undefined;
      const text = (k: string) => (typeof w?.[k] === "string" || typeof n?.[k] === "string") && w?.[k] !== n?.[k];
      return html`<div class="panel diff">
        <div class="row"><b class="grow" style="cursor:pointer" onClick=${() => p.select(row.path)}>${row.kind} ${row.n}</b>
          <button class="small" onClick=${() => p.edit(s => set(s, row.path, get(head, row.path)))} disabled=${was === undefined}>Put back as committed</button></div>
        ${langs.filter(text).map(k => html`<div ...${inLang(k)}><small class="note">${k} </small>${diffWords(String(w?.[k] ?? ""), String(n?.[k] ?? "")).map(d => (d.op === "=" ? d.text : d.op === "-" ? html`<del>${d.text}</del>` : html`<ins>${d.text}</ins>`))}</div>`)}
        ${!langs.some(text) && html`<p class="note">Staging changed.</p>`}
      </div>`;
    })}
  </div>`;
}
