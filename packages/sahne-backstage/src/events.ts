// What agents do, as the editor hears it (server/events.ts): their proposed edits waiting for a person, a file written by
// one directly, an episode they point at, and the AI's spending. A proposal is accepted as an edit like any other (Undo,
// the check, Save): what it changes is merged with what the editor has (model/path.ts `merge3`: the person's unsaved
// edits stay, a step it adds, removes or moves lands among theirs), and where both changed the same place differently it
// is not taken, so nothing typed is lost and nothing lands on the wrong step. A direct write reloads a document that has no unsaved edits; one that has them is marked in
// conflict instead of being overwritten. The editor's selection goes back to the server for the agents' `selection`.
// Each agent's tool call (`activity`) is kept for the Agents page, newest first, and runs (`run`) for their view (runs.ts).

import { signal } from "@preact/signals";
import { api, type Kind } from "./api.ts";
import { merge3, type Path } from "./model/path.ts";
import { pathWords } from "./model/tools.ts";
import * as H from "./model/history.ts";
import { change, createDoc, drafts, go, keyOf, loadWorld, openDoc, route, saveDocs, say } from "./store.ts";
import { loadKitDocs } from "./kitdocs.ts";
import { answerLook, type LookAsk } from "./look.ts";
import { heardRun, loadRuns, runs } from "./runs.ts";
import { who } from "./model/who.ts";

export interface ProposalEdit { kind: Kind; doc: string; next: unknown; base?: number; create?: boolean; paths?: Path[]; /** The document it was computed from (server/proposals.ts). */ from?: unknown }
export interface Proposal extends ProposalEdit {
  id: string; also?: ProposalEdit[]; paths: Path[]; summary: string; by: string; at: number;
  problems: { level: string; message: string; new?: boolean; step?: number }[]; after?: string;
  /** The step of a run that made it (runs.ts). */
  step?: string;
}
export interface Usage { today: { usd: number; tokens: number }; month: { usd: number; tokens: number }; caps: { dayUsd?: number; monthUsd?: number; dayTokens?: number; monthTokens?: number } }

export interface Call { at: number; by: string; tool: string; ok: boolean; ms: number; summary: string; label?: string }

export const proposals = signal<Proposal[]>([]);
/** Agents' tool calls heard since the page opened, newest first (the Agents page starts it from the server's). */
export const activity = signal<Call[]>([]);
/** Counts what changed among the agents (a call, a connection, the mode), for the Agents page to read them again. */
export const agentsTick = signal(0);
export const usage = signal<Usage | null>(null);
/** Documents written by an agent while they had unsaved edits here. */
export const conflicts = signal<Set<string>>(new Set());
/** An episode and step an agent pointed at (`show`), with a count so the same one twice is still news. */
export const shown = signal<{ id: string; step: Path | null; n: number } | null>(null);
/** A set piece or prop an agent pointed at (`show`), on its kit section; the kit page opens its card. */
export const shownKit = signal<{ id: string; section: "set" | "props"; n: number } | null>(null);

/** Whether the proposals have been read once (a page that may show a proposed new document waits for it). */
export const proposalsRead = signal(false);
async function refresh() {
  const r = await api.get<{ proposals: Proposal[] }>("proposals");
  if (r.status === 200) proposals.value = r.proposals ?? [];
  proposalsRead.value = true;
}

let source: EventSource | null = null;
/** Listen to the server's events (once). */
export function connectEvents() {
  if (source || typeof EventSource === "undefined") return;
  source = new EventSource("/api/events");
  void refresh();
  source.addEventListener("proposal", () => void refresh());
  source.addEventListener("doc", e => {
    const d = JSON.parse((e as MessageEvent).data) as { kind: Kind; id: string; by?: string; removed?: boolean };
    const k = keyOf(d.kind, d.id), draft = drafts.value[k];
    // undone, and gone: a clean draft goes, and its page gives way to the list it was on
    if (d.removed) {
      if (draft && H.dirty(draft)) { conflicts.value = new Set([...conflicts.value, k]); say(`${d.by ? who(d.by) : "An agent"} took back ${d.kind} ${d.id}, which you have unsaved edits of`, true); }
      else {
        if (draft) { const { [k]: _gone, ...rest } = drafts.value; drafts.value = rest; }
        const [page, id] = route.value, LIST: Record<string, [string, string]> = { character: ["character", "cast"], place: ["place", "places"], story: ["episode", "board"] };
        if (id === d.id && LIST[d.kind]?.[0] === page) go(LIST[d.kind][1]);
        say(`${d.by ? who(d.by) : "An agent"}: ${d.kind === "story" ? "episode" : d.kind} ${d.id} undone`);
      }
      void loadWorld();
      return;
    }
    if (draft && H.dirty(draft)) { conflicts.value = new Set([...conflicts.value, k]); say(`${d.by ? who(d.by) : "An agent"} wrote ${d.kind} ${d.id} while you have unsaved edits of it`, true); }
    else { if (draft) void openDoc(d.kind, d.id, true); say(`${d.by ? who(d.by) : "An agent"} wrote ${d.kind} ${d.id}`); }
    void loadWorld();
    if (d.kind === "kit_piece" || d.kind === "kit_variant") void loadKitDocs();
  });
  source.addEventListener("show", e => {
    const d = JSON.parse((e as MessageEvent).data) as { id: string; step?: Path | null; kit?: "set" | "props" };
    if (d.kit) { go("kit", d.kit); shownKit.value = { id: d.id, section: d.kit, n: (shownKit.value?.n ?? 0) + 1 }; return; }
    go("episode", d.id);
    shown.value = { id: d.id, step: d.step ?? null, n: (shown.value?.n ?? 0) + 1 };
  });
  // an agent wants a picture of the stage: drawn here if this page is in view (look.ts)
  source.addEventListener("look", e => { void answerLook(JSON.parse((e as MessageEvent).data) as LookAsk); });
  source.addEventListener("activity", e => {
    const c = JSON.parse((e as MessageEvent).data) as Call | null;
    if (c) activity.value = [c, ...activity.value].slice(0, 200);
    agentsTick.value++;
  });
  source.addEventListener("usage", e => { usage.value = JSON.parse((e as MessageEvent).data) as Usage; });
  // runs (runs.ts): read once, then each change and each step's work as it comes
  void loadRuns();
  source.addEventListener("run", e => heardRun(JSON.parse((e as MessageEvent).data)));
}

/**
 * The document a proposal was computed from: as the server kept it (`from`), else nothing for a new one, else the file as
 * read here when it is still that version. Null when it cannot be told: the file changed since.
 */
const baseOf = (e: ProposalEdit, d: H.Draft | undefined): { doc: unknown } | null =>
  "from" in e ? { doc: e.from } : e.create ? { doc: undefined } : d && !d.create && d.mtime === e.base ? { doc: d.saved } : null;

/** A proposed document over the editor's (`doc`, the draft or the file): merged, or why it cannot be. */
export function mergedOnto(e: ProposalEdit, doc: unknown, d: H.Draft | undefined = drafts.value[keyOf(e.kind, e.doc)]): { doc: unknown } | { why: string } {
  const base = baseOf(e, d);
  if (!base) return { why: `${e.kind} ${e.doc} changed since it was proposed: ask for it again` };
  const m = merge3(base.doc, doc, e.next);
  return m.conflict ? { why: `your edits and the proposal both change ${e.kind} ${e.doc} at ${pathWords(m.conflict)}: save or undo yours first` } : { doc: m.doc };
}

/**
 * The documents accepting these edits makes, each merged with the editor's draft (opened when it is not open yet), or
 * why one cannot be taken (then none is). Nothing changes in the editor until `put`.
 */
async function planOf(edits: ProposalEdit[]): Promise<Map<string, { e: ProposalEdit; doc: unknown }> | string> {
  const out = new Map<string, { e: ProposalEdit; doc: unknown }>();
  for (const e of edits) {
    const k = keyOf(e.kind, e.doc);
    const d = e.create && !drafts.value[k] ? undefined : drafts.value[k] ?? await openDoc(e.kind, e.doc) ?? undefined;
    if (!d && !e.create) return `${e.kind} ${e.doc} could not be opened`;
    const r = mergedOnto(e, out.get(k)?.doc ?? d?.doc, d);
    if ("why" in r) return r.why;
    out.set(k, { e, doc: r.doc });
  }
  return out;
}

/** Put planned documents into the editor, each as one edit (Undo takes it back). */
function put(plan: Map<string, { e: ProposalEdit; doc: unknown }>) {
  for (const [k, { e, doc }] of plan) {
    if (!drafts.value[k]) createDoc(e.kind, e.doc, doc);
    else change(e.kind, e.doc, () => doc, `proposal.${k}`);
  }
}

/** The steps a run's step needs, through the steps they need. */
function stepsBefore(p: Proposal): { needs: Set<string>; order: string[]; turnedDown: string[] } | null {
  if (!p.step || !p.by.startsWith("run:")) return null;
  const run = runs.value.find(r => r.by === p.by);
  if (!run) return null;
  const needs = new Set<string>();
  const add = (id: string) => { for (const n of run.steps.find(s => s.id === id)?.needs ?? []) if (!needs.has(n)) { needs.add(n); add(n); } };
  add(p.step);
  return { needs, order: run.steps.map(s => s.id), turnedDown: run.steps.filter(s => needs.has(s.id) && s.status === "stale").map(s => s.title) };
}

/**
 * A run's proposal needs what the steps before it made (an episode, its new character and place): those of them still
 * waiting are accepted first, oldest step first, so its save never meets a character that is not there. Each document's
 * latest proposal holds the ones before it, so only that one is taken.
 */
export function neededFirst(p: Proposal): Proposal[] {
  const b = stepsBefore(p);
  if (!b) return [];
  const mine = proposals.value.filter(q => q.id !== p.id && q.by === p.by && q.step && b.needs.has(q.step));
  const held = new Set(mine.map(q => q.after).filter(Boolean));
  return mine.filter(q => !held.has(q.id)).sort((x, y) => b.order.indexOf(x.step!) - b.order.indexOf(y.step!) || x.at - y.at);
}
/** The steps it needs whose work was turned down: it cannot be accepted until they are done again. */
export const turnedDown = (p: Proposal): string[] => stepsBefore(p)?.turnedDown ?? [];

/** Accept a proposal: merged into the editor as an edit, then answered; first what it needs. */
export async function accept(p: Proposal): Promise<void> { await take(p); }

/** `accept`, saying whether it was taken. */
async function take(p: Proposal): Promise<boolean> {
  const no = turnedDown(p);
  if (no.length) { say(`not taken: it needs ${no.join(", ")}, which you turned down. Do ${no.length > 1 ? "those steps" : "that step"} again first.`, true); return false; }
  const first = neededFirst(p), all = [...first, p];
  const plan = await planOf(all.flatMap(q => [q, ...(q.also ?? [])]));
  if (typeof plan === "string") { say(`not taken: ${plan}.`, true); return false; }
  put(plan);
  for (const q of all) await api.post(`proposals/${q.id}`, { accepted: true });
  await refresh();
  say(`taken: ${p.summary}${first.length ? `, with ${first.length} it needs (${first.map(q => q.doc).join(", ")})` : ""}. Save to write ${first.length ? "them" : "it"}.`);
  return true;
}

/**
 * Accept a proposal and save what it changes, in one click. A document that already had the person's own unsaved edits is
 * saved with them, so that is asked first; no, and nothing happens.
 */
export async function acceptAndSave(p: Proposal): Promise<boolean> {
  const keys = [...neededFirst(p), p].flatMap(q => [q, ...(q.also ?? [])]).map(e => keyOf(e.kind, e.doc));
  const theirs = keys.filter(k => drafts.value[k] && H.dirty(drafts.value[k]));
  if (theirs.length && !confirm(`This also saves your own unsaved edits to ${theirs.map(k => k.replace(":", " ")).join(", ")}. Go on?`)) return false;
  if (!await take(p)) return false;
  return saveDocs([...new Set(keys)]);
}

export async function reject(p: Proposal) {
  await api.post(`proposals/${p.id}`, { accepted: false });
  await refresh();
}

/** What the editor has selected: the assistant's context, and the agents' (`sahne://selection`). */
export const selection = signal<{ page: string; kind?: Kind; id?: string; path?: Path | null } | null>(null);
let selTimer = 0;
/** The editor's selection, kept and sent to the server a moment after it settles. */
export function postSelection(sel: { page: string; kind?: Kind; id?: string; path?: Path | null }) {
  selection.value = sel;
  clearTimeout(selTimer);
  selTimer = setTimeout(() => void api.post("selection", { ...sel, path: sel.path ?? undefined }), 400) as unknown as number;
}
