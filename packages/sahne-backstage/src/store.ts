// The editor's state, as signals: the world the server lists, the route (the hash), and every open document's draft (its
// saved and edited versions, undo and redo, src/model/history.ts) with the server's problems for it. A page reads what it
// needs; an edit goes through `change`, a save through `saveDocs`, which sends the documents together.

import { batch, computed, signal } from "@preact/signals";
import { api, type Edit, type Kind, type Problem, type World } from "./api.ts";
import * as H from "./model/history.ts";

export const world = signal<World | null>(null);
export const route = signal<string[]>(parseHash());
export const drafts = signal<Record<string, H.Draft>>({});
export const checked = signal<Record<string, Problem[]>>({});
export const notice = signal<{ text: string; bad?: boolean } | null>(null);

export const keyOf = (kind: Kind, id: string) => `${kind}:${id}`;
export const dirtyKeys = computed(() => Object.entries(drafts.value).filter(([, d]) => H.dirty(d)).map(([k]) => k));

function parseHash(): string[] { return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent); }
addEventListener("hashchange", () => { route.value = parseHash(); });
addEventListener("beforeunload", e => { if (dirtyKeys.value.length) e.preventDefault(); });
export const go = (...parts: string[]) => { location.hash = "#/" + parts.map(encodeURIComponent).join("/"); };

export function say(text: string, bad = false) {
  notice.value = { text, bad };
  setTimeout(() => { if (notice.value?.text === text) notice.value = null; }, bad ? 9000 : 3500);
}

export async function loadWorld() {
  const w = await api.world();
  world.value = w;
}

/** Open a document (from the server, once; again with `fresh`). */
export async function openDoc(kind: Kind, id: string, fresh = false): Promise<H.Draft | null> {
  const k = keyOf(kind, id);
  if (drafts.value[k] && !fresh) return drafts.value[k];
  const r = await api.doc(kind, id);
  if (r.status !== 200) { say(`${kind} ${id}: ${(r as { message?: string }).message ?? r.status}`, true); return null; }
  const d = H.open(r.doc, r.mtime);
  drafts.value = { ...drafts.value, [k]: d };
  return d;
}

/** Start a new document, not on disk until saved. */
export function createDoc(kind: Kind, id: string, doc: unknown) {
  drafts.value = { ...drafts.value, [keyOf(kind, id)]: H.open(doc, undefined, true) };
}

export const draftOf = (kind: Kind, id: string) => drafts.value[keyOf(kind, id)];

/** Edit a document: `fn` gets the current one and returns the next; `field` names what is typed into (one undo step). */
export function change<T>(kind: Kind, id: string, fn: (doc: T) => T, field?: string) {
  const k = keyOf(kind, id), d = drafts.value[k];
  if (!d) return;
  drafts.value = { ...drafts.value, [k]: H.edit(d, fn(d.doc as T), field) };
}

export function history(kind: Kind, id: string, what: "undo" | "redo" | "revert") {
  const k = keyOf(kind, id), d = drafts.value[k];
  if (d) drafts.value = { ...drafts.value, [k]: H[what](d) };
}

const editOf = (k: string): Edit => {
  const d = drafts.value[k], [kind, id] = k.split(/:(.*)/s) as [Kind, string];
  return { kind, id, doc: d.doc, mtime: d.create ? undefined : d.mtime, create: d.create };
};

let checking = 0;
/** Ask the server to check documents as edited; the problems land in `checked`. */
export async function checkDocs(keys: string[]) {
  const n = ++checking;
  const r = await api.check(keys.filter(k => drafts.value[k]).map(editOf));
  if (n !== checking || r.status !== 200) return;
  const by: Record<string, Problem[]> = Object.fromEntries(keys.map(k => [k, []]));
  for (const p of r.problems) (by[p.doc] ??= []).push(p);
  checked.value = { ...checked.value, ...by };
}

/** Save documents together. Resolves true when written. */
export async function saveDocs(keys: string[]): Promise<boolean> {
  const list = keys.filter(k => H.dirty(drafts.value[k]));
  if (!list.length) { say("nothing changed"); return true; }
  const r = await api.save(list.map(editOf));
  if (r.problems) {
    const by: Record<string, Problem[]> = Object.fromEntries(list.map(k => [k, []]));
    for (const p of r.problems) (by[p.doc] ??= []).push(p);
    checked.value = { ...checked.value, ...by };
  }
  if (r.status !== 200 || !r.saved) { say(r.message ?? `not saved (${r.status})`, true); return false; }
  batch(() => {
    const next = { ...drafts.value };
    for (const [k, mtime] of Object.entries(r.saved!)) if (next[k]) next[k] = H.saved(next[k], mtime);
    drafts.value = next;
  });
  say(`saved ${list.map(k => k.replace(":", " ")).join(", ")}`);
  allProblems.value = null;
  await loadWorld();
  return true;
}

// ---- review notes (server/review.ts) -------------------------------------------------------------------------------

export type Status = "draft" | "reviewed" | "approved";
export interface Comment { id: string; at?: string; by: string; text: string; date: string; done?: boolean }
/** A step's review: reviewed, and which translations were checked (`persian`: notes from before `checked`). */
export interface StepNote { reviewed?: boolean; checked?: string[]; persian?: boolean }
export interface EpisodeReview { status?: Status; ai?: boolean; reviewer?: string; steps?: Record<string, StepNote>; comments?: Comment[] }

export const review = signal<Record<string, EpisodeReview>>({});
export const allProblems = signal<Problem[] | null>(null);

export async function loadReview() {
  const r = await api.get<{ episodes: Record<string, EpisodeReview> }>("review");
  if (r.status === 200) review.value = r.episodes;
}

/** Change one episode's notes and write them (the notes are saved at once, apart from the story). */
export async function setReview(id: string, fn: (r: EpisodeReview) => EpisodeReview) {
  const next = fn(review.value[id] ?? {});
  review.value = { ...review.value, [id]: next };
  if (!world.value?.writable) { say("read-only: the notes are not written (start backstage with --write)", true); return; }
  const r = await api.post<{ episodes: Record<string, EpisodeReview> }>("review", { id, review: next });
  if (r.status === 200) review.value = r.episodes; else say(`notes not saved: ${(r as { message?: string }).message ?? r.status}`, true);
}

/** Every problem of the content root (the review dashboard), from the server. */
export async function loadAllProblems() {
  const r = await api.get<{ problems: Problem[] }>("problems");
  if (r.status === 200) allProblems.value = r.problems;
}

/** The reviewer's name, kept in this browser only. */
export const reviewer = signal<string>((() => { try { return localStorage.getItem("backstage:reviewer") ?? ""; } catch { return ""; } })());
export function setReviewer(name: string) {
  reviewer.value = name;
  try { localStorage.setItem("backstage:reviewer", name); } catch { /* no storage */ }
}
