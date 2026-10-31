// Agents' proposed edits of this episode (events.ts): each with who proposed it and what it changes, every changed
// place with its words before and after (word by word), the problems it would bring, and Show, Accept and Reject. An
// accepted proposal is an edit like any other: undo takes it back, the check judges it, Save writes it.

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { textOf, type StoryDoc } from "sahne-story";
import { diffWords } from "../../model/diff.ts";
import { get, type Path } from "../../model/path.ts";
import { rows } from "../../model/steps.ts";
import { accept, acceptAndSave, proposals, reject, type Proposal } from "../../events.ts";
import { world } from "../../store.ts";
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
        <div class="row"><span class="grow"></span><button onClick=${() => void reject(x)}>Reject</button><button onClick=${() => void accept(x)} title="Take it into the script; you save it">Accept</button><button class="primary" onClick=${() => void acceptAndSave(x)}>Accept and save</button></div>
      </div>`;
    })}
  </div>`;
}

/** The proposal a chain starts from: rejecting it rejects every one built on it, so the whole new episode goes. */
const firstOf = (x: Proposal): Proposal => { let a = x; for (let b; a.after && (b = proposals.value.find(y => y.id === a.after)); a = b); return a; };

/**
 * A new episode an agent proposes (`create_episode`): it is not on disk, so it cannot open in the studio until it is
 * taken. Its page shows what it would be (its titles, place, cast and date, the problems the check finds, and its steps in
 * the main language with the first translation), with Reject, and Accept, which opens it in the studio as a new,
 * unsaved episode.
 */
export function ProposedEpisode(p: { x: Proposal }) {
  const { main, translations: [gloss] } = useLangs();
  const [busy, setBusy] = useState(false);
  const doc = p.x.next as StoryDoc & Record<string, any>, w = world.value!;
  const name = (id?: string) => (id ? textOf(w.characters[id]?.name, main) ?? id : "");
  const errors = p.x.problems.filter(q => q.level === "error"), warnings = p.x.problems.filter(q => q.level === "warning");
  return html`<section class="proposed-ep">
    <div class="toolbar row">
      <div class="grow"><h2 style="margin:0"><span class="note">${p.x.doc}</span> <span ...${inLang(main)}>${textOf(doc.title, main) ?? p.x.doc}</span></h2>
        <span class="note">A new episode ${p.x.by === "assistant" ? "the assistant" : p.x.by} proposes${gloss && textOf(doc.title, gloss) ? html` · <span ...${inLang(gloss)}>${textOf(doc.title, gloss)}</span>` : ""}</span></div>
      <button disabled=${busy} onClick=${() => { setBusy(true); void reject(firstOf(p.x)).then(() => history.back()); }}>Reject</button>
      <button class="primary" disabled=${busy} onClick=${() => { setBusy(true); void accept(p.x); }}>Accept and open</button>
    </div>
    <p class="banner">Not written yet: nothing changes until you accept it, and then it is a new, unsaved episode you can edit before you save.</p>
    <div class="proposed-facts">
      <span><b>Place</b> ${doc.place ? textOf(w.places[doc.place]?.name, main) ?? doc.place : "—"}</span>
      <span><b>Cast</b> ${(doc.cast ?? []).map(name).join(", ") || "—"}</span>
      <span><b>Date</b> ${doc.releaseDate ?? "—"}${doc.kind === "special" ? " · special" : ""}</span>
      <span><b>Steps</b> ${(doc.steps ?? []).length}</span>
    </div>
    ${(errors.length > 0 || warnings.length > 0) && html`<div class="panel"><b>The check finds ${errors.length} error${errors.length === 1 ? "" : "s"} and ${warnings.length} warning${warnings.length === 1 ? "" : "s"}</b>
      <ul class="problems">${[...errors, ...warnings].map(q => html`<li class=${q.level}>${q.level}${q.step !== undefined ? ` · step ${q.step}` : ""}: ${q.message}</li>`)}</ul></div>`}
    <ol class="proposed-steps">${rows(doc).map(r => {
      const step = (get(doc, r.path) ?? {}) as Record<string, unknown>;
      const said = r.kind === "line" || r.kind === "option" || r.kind === "reply";
      return html`<li class=${`k-${r.kind}`} style=${`margin-left:${r.depth * 18}px`}>
        <span class="who">${said ? name(r.who) : r.kind}</span>
        <span class="what">${said ? html`<span ...${inLang(main)}>${textOf(step, main) ?? r.text}</span>${gloss && typeof step[gloss] === "string" ? html`<small ...${inLang(gloss)}>${step[gloss] as string}</small>` : ""}` : r.text}</span></li>`;
    })}</ol>
  </section>`;
}
