// Needs you: one place, along the bottom of an episode's page, for everything that wants a person's attention there, each
// in the same shape and each going where it is dealt with:
//   a task's question about this episode   answered in place (a task waits for it)
//   an agent's proposals                    accepted or rejected in place (studio/proposals.ts)
//   problems                                the check's and the lints' notes in plain words (model/notes.ts), each to its
//                                           line, with a fix where one is obvious; the texts a language lacks are one item
//                                           per language, to Translate
//   suggestions                             the rules' staging ideas, to Script, or all added at once
//   open comments                           to Review
// The bar counts them; it opens by itself while a task asks.

import { html } from "htm/preact";
import { textOf, type StoryDoc } from "sahne-story";
import { notesOf, type Note } from "../../model/notes.ts";
import type { Path } from "../../model/path.ts";
import type { Problem } from "../../api.ts";
import type { Proposal } from "../../events.ts";
import type { Run, RunStep } from "../../runs.ts";
import { world } from "../../store.ts";
import { langName, useLangs } from "../lang.ts";
import { StepQuestion } from "../runs.ts";
import { ProposalsBar } from "./proposals.ts";

interface Props {
  story: StoryDoc; problems: Problem[]; suggestions: number; comments: number; proposals: Proposal[];
  asks: { run: Run; step: RunStep }[];
  open: boolean; setOpen(on: boolean): void;
  select(path: Path, focus?: boolean): void; edit(fn: (s: StoryDoc) => StoryDoc, field?: string): void;
  goStage(k: string): void; addAll(): void; setLang(l: string): void;
}

const GAP = / has no ([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*) text$/;

export function NeedsYou(p: Props) {
  const w = world.value!, { main } = useLangs();
  // the texts a language lacks, counted per language; the other problems as notes
  const gaps = new Map<string, number>(), rest: Problem[] = [];
  for (const x of p.problems) { const m = GAP.exec(x.message); if (m) gaps.set(m[1], (gaps.get(m[1]) ?? 0) + 1); else rest.push(x); }
  const notes: Note[] = notesOf(rest, { name: id => textOf(w.characters[id]?.name, main) ?? id, langName, standin: w.series?.standin ?? "nima" });
  const errors = notes.filter(n => n.level === "error").length;
  const counts: [string, number, string][] = [
    ["task", p.asks.length, p.asks.length === 1 ? "question from a task" : "questions from tasks"],
    ["proposal", p.proposals.length, p.proposals.length === 1 ? "proposal" : "proposals"],
    ["error", errors, errors === 1 ? "problem" : "problems"],
    ["note", notes.length - errors, notes.length - errors === 1 ? "note" : "notes"],
    ["translation", gaps.size, gaps.size === 1 ? "language to fill" : "languages to fill"],
    ["suggestion", p.suggestions ? 1 : 0, "staging ideas"],
    ["comment", p.comments, p.comments === 1 ? "open comment" : "open comments"],
  ];
  const any = counts.some(([, n]) => n > 0);
  const open = p.open || p.asks.length > 0;
  return html`<div class="needs" role="region" aria-label="Needs you">
    <div class="needs-bar"><b>Needs you</b>
      ${any ? counts.filter(([, n]) => n > 0).map(([k, n, word]) => html`<span class=${`needs-count ${k === "error" ? "bad" : k === "task" || k === "proposal" ? "accent" : k === "note" ? "warn" : ""}`}>${k === "suggestion" ? `${p.suggestions} ${word}` : `${n} ${word}`}</span>`) : html`<span class="note">Nothing waiting.</span>`}
      <span class="grow"></span>${any && html`<button class="small" aria-expanded=${open} onClick=${() => p.setOpen(!open)}>${open ? "Hide" : "Show"}</button>`}</div>
    ${open && any && html`<div class="needs-list">
      ${p.asks.map(a => html`<div class="need"><span class="kind task">task</span><div class="t"><${StepQuestion} run=${a.run} step=${a.step} /></div><a class="button small" href=${`#/agents/tasks/${a.run.id}`}>See the task</a></div>`)}
      ${p.proposals.length > 0 && html`<div class="need"><span class="kind proposal">proposal</span><div class="t"><${ProposalsBar} list=${p.proposals} story=${p.story} select=${p.select} /></div></div>`}
      ${notes.map(n => html`<div class="need"><span class=${`kind ${n.level === "error" ? "error" : "problem"}`}>${n.level === "error" ? "problem" : "note"}</span>
        <span class="t">${n.isNew ? html`<b>New: </b>` : ""}${n.text}</span>
        ${n.fix && html`<button class="small" onClick=${() => p.edit(n.fix!.apply, `fix.${n.rule}`)}>${n.fix.label}</button>`}
        ${n.path && html`<button class="small primary" onClick=${() => p.select(n.path!, true)}>Show it</button>`}</div>`)}
      ${[...gaps].map(([l, n]) => html`<div class="need"><span class="kind">translation</span><span class="t">${n} text${n > 1 ? "s have" : " has"} no ${langName(l)} yet.</span>
        <button class="small primary" onClick=${() => { p.setLang(l); p.goStage("translate"); }}>Translate</button></div>`)}
      ${p.suggestions > 0 && html`<div class="need"><span class="kind">suggestion</span><span class="t">${p.suggestions} staging idea${p.suggestions > 1 ? "s" : ""} from the rules, as Add? chips in Script.</span>
        <button class="small" onClick=${p.addAll}>Add all</button><button class="small primary" onClick=${() => p.goStage("script")}>Look at them</button></div>`}
      ${p.comments > 0 && html`<div class="need"><span class="kind">comment</span><span class="t">${p.comments} open comment${p.comments > 1 ? "s" : ""}.</span>
        <button class="small primary" onClick=${() => p.goStage("review")}>Read them</button></div>`}
    </div>`}
  </div>`;
}
