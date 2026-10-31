// Agents' proposals wherever they land (events.ts keeps the queue): where each one is answered (`hrefOf`), a card for one
// that changes a season, the series, a place or a character (its places, before and after, in words where they are
// words), a strip of those cards on that document's page, and the preview of a proposed new place or character, which is
// not on disk and so cannot open until it is taken. An episode's proposals have their own bar above the script
// (studio/proposals.ts) and a new episode its own preview.

import { html } from "htm/preact";
import { useState } from "preact/hooks";
import { textOf } from "sahne-story";
import { diffWords } from "../model/diff.ts";
import { get, type Path } from "../model/path.ts";
import { pathWords } from "../model/tools.ts";
import { accept, acceptAndSave, proposals, reject, type Proposal } from "../events.ts";
import type { Kind } from "../api.ts";
import { draftOf, go } from "../store.ts";
import { inLang, useLangs } from "./lang.ts";

/** The page a document is answered on, as a route: an episode, a season's board, the board for the series, a place, a character. */
export const routeOf = (kind: string, id: string): [string, string?] =>
  kind === "story" ? ["episode", id] : kind === "season" ? ["season", id] : kind === "series" ? ["board"] : kind === "place" ? ["place", id] : kind === "character" ? ["character", id] : ["agents"];
export const hrefOf = (kind: string, id: string) => `#/${routeOf(kind, id).filter(Boolean).join("/")}`;
export const openProposal = (x: { kind: string; doc: string }) => { const [page, id] = routeOf(x.kind, x.doc); if (id) go(page, id); else go(page); };

/** The proposal a chain starts from: rejecting it rejects every one built on it. */
export const firstOf = (x: Proposal): Proposal => { let a = x; for (let b; a.after && (b = proposals.value.find(y => y.id === a.after)); a = b); return a; };

/** A value as a person reads it: a text in the main language, a list or object as short JSON. */
const words = (v: unknown, lang: string): string => {
  if (v === undefined || v === null) return "";
  if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") return String(v);
  const o = v as Record<string, unknown>;
  if (typeof o[lang] === "string") return o[lang] as string;
  const j = JSON.stringify(v);
  return j.length > 240 ? `${j.slice(0, 240)}…` : j;
};

/** A text in languages: an object of strings only. */
const isTexts = (v: unknown) => !!v && typeof v === "object" && !Array.isArray(v) && Object.values(v).every(x => typeof x === "string");

/** One proposal of a season, the series, a place or a character: what it changes, place by place, with Accept and Reject. */
export function ProposalCard(p: { x: Proposal }) {
  const { main } = useLangs();
  const [busy, setBusy] = useState(false);
  const x = p.x, d = draftOf(x.kind as Kind, x.doc);
  const was = d?.doc;
  const fresh = x.problems.filter(q => q.new && q.level === "error");
  const act = (fn: () => Promise<void>) => { setBusy(true); void fn().finally(() => setBusy(false)); };
  return html`<div class="proposal">
    <div class="row"><b class="grow">${x.by === "assistant" ? "The assistant" : x.by} proposes: ${x.summary}</b>
      ${fresh.length > 0 && html`<span class="chip bad" title=${fresh.map(q => q.message).join("\n")}>${fresh.length} new error${fresh.length > 1 ? "s" : ""}</span>`}</div>
    ${x.paths.slice(0, 8).flatMap(path => {
      const b0 = get(was, path as Path), a0 = get(x.next, path as Path);
      // a text in several languages: each language that changed, on its own line
      const langs = isTexts(b0) || isTexts(a0) ? [...new Set([...Object.keys((b0 ?? {}) as object), ...Object.keys((a0 ?? {}) as object)])].filter(l => (b0 as any)?.[l] !== (a0 as any)?.[l]) : [null];
      return langs.map(l => {
        const before = l ? String((b0 as any)?.[l] ?? "") : words(b0, main), after = l ? String((a0 as any)?.[l] ?? "") : words(a0, main);
        return html`<div class="diff" ...${inLang(l ?? main)}><span class="chip">${pathWords(path)}${l ? ` · ${l}` : ""}</span>
          ${before.length + after.length < 400 ? diffWords(before, after).map(c => (c.op === "=" ? c.text : c.op === "-" ? html`<del>${c.text}</del>` : html`<ins>${c.text}</ins>`)) : html`<del>${before}</del> <ins>${after}</ins>`}</div>`;
      });
    })}
    ${x.paths.length > 8 && html`<p class="note">and ${x.paths.length - 8} more places</p>`}
    ${(x.also ?? []).length > 0 && html`<p class="note">With it: ${x.also!.map(a => `${a.kind} ${a.doc}`).join(", ")}</p>`}
    <div class="row"><span class="grow"></span>
      <button disabled=${busy} onClick=${() => act(() => reject(firstOf(x)))}>Reject</button>
      <button disabled=${busy} onClick=${() => act(() => accept(x))} title="Take it into the editor; you save it">Accept</button>
      <button class="primary" disabled=${busy} onClick=${() => act(async () => { await acceptAndSave(x); })}>Accept and save</button></div>
  </div>`;
}

/** The proposals waiting on one document (or on any document of some kinds), as cards; nothing when none waits. */
export function ProposalsStrip(p: { kind: Kind | Kind[]; id?: string }) {
  const kinds = Array.isArray(p.kind) ? p.kind : [p.kind];
  const list = proposals.value.filter(x => kinds.includes(x.kind as Kind) && (p.id === undefined || x.doc === p.id) && !x.create);
  if (!list.length) return null;
  return html`<div class="proposals" role="region" aria-label="Proposed edits">${list.map(x => html`<${ProposalCard} key=${x.id} x=${x} />`)}</div>`;
}

/** A proposed new place or character, while it is only proposed: what it would be, the check's problems, Accept and Reject. */
export function ProposedDoc(p: { x: Proposal }) {
  const { main } = useLangs();
  const [busy, setBusy] = useState(false);
  const doc = p.x.next as Record<string, unknown>;
  const what = p.x.kind === "place" ? "place" : "character";
  const errors = p.x.problems.filter(q => q.level === "error"), warnings = p.x.problems.filter(q => q.level === "warning");
  const facts = p.x.kind === "place"
    ? [["Marks", Object.keys((doc.marks ?? {}) as object).join(", ") || "—"], ["Set pieces", String(((doc.set ?? []) as unknown[]).length)], ["Props", Object.keys((doc.props ?? {}) as object).join(", ") || "—"]]
    : [["Role", textOf(doc.role as Record<string, string>, main) ?? "—"], ["Kind", String(doc.kind ?? "character")]];
  return html`<section class="proposed-ep">
    <div class="toolbar row">
      <div class="grow"><h2 style="margin:0"><span class="note">${p.x.doc}</span> <span ...${inLang(main)}>${textOf(doc.name as Record<string, string>, main) ?? p.x.doc}</span></h2>
        <span class="note">A new ${what} ${p.x.by === "assistant" ? "the assistant" : p.x.by} proposes</span></div>
      <button disabled=${busy} onClick=${() => { setBusy(true); void reject(firstOf(p.x)).then(() => history.back()); }}>Reject</button>
      <button class="primary" disabled=${busy} onClick=${() => { setBusy(true); void accept(p.x); }}>Accept and open</button>
    </div>
    <p class="banner">Not written yet: nothing changes until you accept it, and then it is a new, unsaved ${what} you can edit before you save.</p>
    <div class="proposed-facts">${facts.map(([k, v]) => html`<span><b>${k}</b> ${v}</span>`)}</div>
    ${(errors.length > 0 || warnings.length > 0) && html`<div class="panel"><b>The check finds ${errors.length} error${errors.length === 1 ? "" : "s"} and ${warnings.length} warning${warnings.length === 1 ? "" : "s"}</b>
      <ul class="problems">${[...errors, ...warnings].map(q => html`<li class=${q.level}>${q.level}: ${q.message}</li>`)}</ul></div>`}
    <details><summary>The document</summary><pre class="code">${JSON.stringify(doc, null, 2)}</pre></details>
  </section>`;
}

/** The newest proposal that creates this document, if one waits. */
export const proposedNew = (kind: Kind, id: string): Proposal | undefined =>
  [...proposals.value].filter(x => x.kind === kind && x.doc === id && x.create).sort((a, b) => b.at - a.at)[0];
