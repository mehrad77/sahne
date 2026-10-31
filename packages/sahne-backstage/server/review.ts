// The review notes (Node only): where each episode stands (an AI draft, reviewed, approved), which of its steps were
// reviewed and which of their translations were checked (`checked`, by language; `persian` from before languages were
// the series'), who reviewed it, whether AI wrote it, and the comments left on it or on one of
// its steps. They are editors' notes, kept beside the content in a sidecar (sahne-story's paths.ts REVIEW:
// <root>/.backstage/review.json), never in a story (a story's root takes no extra keys) and never read by an app or the
// checks. Card and lesson text never goes in here.

import { existsSync } from "node:fs";
import { REVIEW } from "../../sahne-story/paths.ts";
import { plain, readFile, textFor, writeAtomic } from "../../sahne-story/json.ts";

export type Status = "draft" | "reviewed" | "approved";
export const STATUSES: Status[] = ["draft", "reviewed", "approved"];

export interface Comment { id: string; at?: string; by: string; text: string; date: string; done?: boolean }
export interface StepNote { reviewed?: boolean; /** The translations checked, by language code. */ checked?: string[]; /** Its Persian checked (notes written before `checked`). */ persian?: boolean }
export interface EpisodeReview { status?: Status; ai?: boolean; reviewer?: string; steps?: Record<string, StepNote>; comments?: Comment[] }
export interface Review { v: 1; episodes: Record<string, EpisodeReview> }

const EMPTY: Review = { v: 1, episodes: {} };

export function readReview(): Review {
  if (!existsSync(REVIEW)) return EMPTY;
  try { return plain(readFile(REVIEW).doc) as Review; } catch { return EMPTY; }
}

const isStatus = (s: unknown): s is Status => (STATUSES as unknown[]).includes(s);

/** One episode's notes, checked: unknown keys dropped, comments with an id, a text and a date. */
function clean(e: unknown): EpisodeReview {
  const x = (e && typeof e === "object" ? e : {}) as Record<string, unknown>;
  const out: EpisodeReview = {};
  if (isStatus(x.status)) out.status = x.status;
  if (typeof x.ai === "boolean") out.ai = x.ai;
  if (typeof x.reviewer === "string" && x.reviewer.trim()) out.reviewer = x.reviewer.trim().slice(0, 80);
  if (x.steps && typeof x.steps === "object") {
    const steps: Record<string, StepNote> = {};
    for (const [k, v] of Object.entries(x.steps as Record<string, unknown>)) {
      if (!/^\d+(\.\d+){0,2}$/.test(k) || !v || typeof v !== "object") continue;
      const n = v as StepNote, s: StepNote = {};
      if (n.reviewed) s.reviewed = true;
      if (n.persian) s.persian = true;
      if (Array.isArray(n.checked)) { const c = [...new Set(n.checked.filter((l): l is string => typeof l === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(l)))].sort(); if (c.length) s.checked = c; }
      if (Object.keys(s).length) steps[k] = s;
    }
    if (Object.keys(steps).length) out.steps = steps;
  }
  if (Array.isArray(x.comments)) {
    out.comments = x.comments.filter((c): c is Comment => !!c && typeof c === "object" && typeof (c as Comment).text === "string" && !!(c as Comment).text.trim())
      .map(c => ({ id: String(c.id ?? "").slice(0, 40) || Math.random().toString(36).slice(2, 10), ...(typeof c.at === "string" ? { at: c.at } : {}), by: String(c.by ?? "").slice(0, 80), text: c.text.slice(0, 4000), date: String(c.date ?? "").slice(0, 30), ...(c.done ? { done: true } : {}) }));
    if (!out.comments.length) delete out.comments;
  }
  return out;
}

/** Replace one episode's notes: `{ id, review }`. Returns all the notes. */
export function writeReview(body: unknown): Review {
  const b = body as { id?: unknown; review?: unknown };
  if (typeof b?.id !== "string" || !/^s[1-9][0-9]?e[0-9]{2}$/.test(b.id)) throw Object.assign(new Error("expected { id: <episode id>, review }"), { status: 400 });
  const all = readReview();
  const next = clean(b.review);
  const episodes = { ...all.episodes };
  if (Object.keys(next).length) episodes[b.id] = next; else delete episodes[b.id];
  const doc: Review = { v: 1, episodes: Object.fromEntries(Object.entries(episodes).sort(([a], [c]) => a.localeCompare(c))) };
  writeAtomic(REVIEW, textFor(REVIEW, doc));
  return doc;
}

