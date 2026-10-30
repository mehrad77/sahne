// What agents do, as the editor hears it (server/events.ts): their proposed edits waiting for a person, a file written by
// one directly, an episode they point at, and the AI's spending. A proposal is accepted as an edit like any other (Undo,
// the check, Save): its whole document where the editor has no unsaved edits of it, else only the places it changes, so
// nothing typed is lost. A direct write reloads a document that has no unsaved edits; one that has them is marked in
// conflict instead of being overwritten. The editor's selection goes back to the server for the agents' `selection`.
// Each agent's tool call (`activity`) is kept for the Agents page, newest first.

import { signal } from "@preact/signals";
import { api, type Kind } from "./api.ts";
import { get, set, type Path } from "./model/path.ts";
import * as H from "./model/history.ts";
import { change, createDoc, drafts, go, keyOf, loadWorld, openDoc, say } from "./store.ts";

export interface ProposalEdit { kind: Kind; doc: string; next: unknown; base?: number; create?: boolean }
export interface Proposal extends ProposalEdit {
  id: string; also?: ProposalEdit[]; paths: Path[]; summary: string; by: string; at: number;
  problems: { level: string; message: string; new?: boolean; step?: number }[]; after?: string;
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
    const d = JSON.parse((e as MessageEvent).data) as { kind: Kind; id: string; by?: string };
    const k = keyOf(d.kind, d.id), draft = drafts.value[k];
    if (draft && H.dirty(draft)) { conflicts.value = new Set([...conflicts.value, k]); say(`${d.by ?? "An agent"} wrote ${d.kind} ${d.id} while you have unsaved edits of it`, true); }
    else { if (draft) void openDoc(d.kind, d.id, true); say(`${d.by ?? "An agent"} wrote ${d.kind} ${d.id}`); }
    void loadWorld();
  });
  source.addEventListener("show", e => {
    const d = JSON.parse((e as MessageEvent).data) as { id: string; step: Path | null };
    go("episode", d.id);
    shown.value = { ...d, n: (shown.value?.n ?? 0) + 1 };
  });
  source.addEventListener("activity", e => {
    const c = JSON.parse((e as MessageEvent).data) as Call | null;
    if (c) activity.value = [c, ...activity.value].slice(0, 200);
    agentsTick.value++;
  });
  source.addEventListener("usage", e => { usage.value = JSON.parse((e as MessageEvent).data) as Usage; });
}

/** Put one proposed document into the editor: whole, or only its changed places over unsaved edits. */
async function applyEdit(e: ProposalEdit, paths: Path[]) {
  const k = keyOf(e.kind, e.doc);
  if (e.create && !drafts.value[k]) { createDoc(e.kind, e.doc, e.next); return; }
  const d = drafts.value[k] ?? await openDoc(e.kind, e.doc);
  if (!d) return;
  if (!H.dirty(d) || !paths.length) change(e.kind, e.doc, () => e.next, `proposal.${k}`);
  else change(e.kind, e.doc, doc => paths.reduce((x, p) => set(x, p, get(e.next, p)), doc), `proposal.${k}`);
}

/** Accept a proposal: applied as an edit (and the ones it was built on, which it holds), then answered. */
export async function accept(p: Proposal) {
  await applyEdit(p, p.paths);
  for (const a of p.also ?? []) await applyEdit(a, []);
  await api.post(`proposals/${p.id}`, { accepted: true });
  await refresh();
  say(`taken: ${p.summary}. Save to write it.`);
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
