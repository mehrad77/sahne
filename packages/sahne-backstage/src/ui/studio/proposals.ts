// Agents' proposed edits of this episode (events.ts): each with who proposed it and what it changes, every changed
// place with its words before and after (word by word), the problems it would bring, and Show, Accept and Reject. An
// accepted proposal is an edit like any other: undo takes it back, the check judges it, Save writes it.

import { html } from "htm/preact";
import type { StoryDoc } from "sahne-story";
import { diffWords } from "../../model/diff.ts";
import { get, type Path } from "../../model/path.ts";
import { accept, reject, type Proposal } from "../../events.ts";
import { inLang, useLangs } from "../lang.ts";

/** The words of a place in a document, in a language (a step's text, a title), or its JSON. */
const wordsAt = (doc: unknown, path: Path, lang: string): string => {
  const v = get(doc, path) as Record<string, unknown> | string | undefined;
  if (typeof v === "string") return v;
  if (v && typeof v[lang] === "string") return v[lang] as string;
  return v === undefined ? "" : JSON.stringify(v);
};

export function ProposalsBar(p: { list: Proposal[]; story: StoryDoc; select(path: Path, focus?: boolean): void }) {
  const { main } = useLangs();
  if (!p.list.length) return null;
  return html`<div class="proposals" role="region" aria-label="Proposed edits">
    ${p.list.map(x => {
      const fresh = x.problems.filter(q => q.new && q.level === "error").length;
      return html`<div class="proposal">
        <div class="row"><b class="grow">${x.by === "assistant" ? "The assistant" : x.by} proposes: ${x.summary}</b>
          ${fresh > 0 && html`<span class="chip bad" title=${x.problems.filter(q => q.new).map(q => q.message).join("\n")}>${fresh} new error${fresh > 1 ? "s" : ""}</span>`}</div>
        ${x.paths.slice(0, 6).map(path => {
          const was = wordsAt(p.story, path, main), now = wordsAt(x.next, path, main);
          return html`<div class="diff" ...${inLang(main)}><button class="small" onClick=${() => p.select(path, true)}>${path.filter(k => typeof k === "number").join(".") || path.join(".")}</button>
            ${diffWords(was, now).map(d => (d.op === "=" ? d.text : d.op === "-" ? html`<del>${d.text}</del>` : html`<ins>${d.text}</ins>`))}</div>`;
        })}
        ${x.paths.length > 6 && html`<p class="note">and ${x.paths.length - 6} more places</p>`}
        <div class="row"><span class="grow"></span><button onClick=${() => void reject(x)}>Reject</button><button class="primary" onClick=${() => void accept(x)}>Accept</button></div>
      </div>`;
    })}
  </div>`;
}
