// The review notes (Node only): where each episode stands (an AI draft, reviewed, approved), which of its steps were
// reviewed and which of their translations were checked (`checked`, by language; `persian` from before languages were
// the series'), who reviewed it, whether AI wrote it, and the comments left on it or on one of
// its steps. They are editors' notes, kept beside the content in a sidecar (sahne-story's paths.ts REVIEW:
// <root>/.backstage/review.json), never in a story (a story's root takes no extra keys) and never read by an app or the
// checks. Card and lesson text never goes in here.

import { existsSync } from "node:fs";
import { REVIEW } from "../../sahne-story/paths.ts";
import { plain, readFile, textFor, writeAtomic } from "../../sahne-story/json.ts";
import { languagesOf, type SeriesDoc, type StoryDoc } from "../../sahne-story/src/index.ts";
import { blocksOf, type Block, type Comment, type EpisodeReview, type Standing, type Status, type StepNote } from "../src/model/review.ts";
import { episodeSig, progressOf } from "../src/model/progress.ts";
import { merge3 } from "../src/model/path.ts";
import { storyPluginsOf } from "../src/model/plugins.ts";
import { exists, readDoc, type Problem } from "./content.ts";

export type { Comment, EpisodeReview, Status, StepNote };
export const STATUSES: Status[] = ["draft", "reviewed", "approved"];
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
  // the episode as it was approved (model/progress.ts episodeSig): a later change shows as changed since
  if (typeof x.sig === "string" && /^[0-9a-f]{8}$/.test(x.sig)) out.sig = x.sig;
  if (x.steps && typeof x.steps === "object") {
    const steps: Record<string, StepNote> = {};
    for (const [k, v] of Object.entries(x.steps as Record<string, unknown>)) {
      if (!/^\d+(\.\d+){0,2}$/.test(k) || !v || typeof v !== "object") continue;
      const n = v as StepNote, s: StepNote = {};
      if (n.reviewed) s.reviewed = true;
      if (n.persian) s.persian = true;
      if (typeof n.sig === "string" && /^[0-9a-f]{8}$/.test(n.sig)) s.sig = n.sig;
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

/**
 * Write one episode's notes: `{ id, review }` replaces them; with `was`, the notes the writer changed into `review`, only
 * that change is merged into the notes as they are now (model/path.ts `merge3`, the writer's side winning a place both
 * changed), so an editor working from notes read earlier never erases what an agent wrote since. Returns all the notes.
 */
export function writeReview(body: unknown): Review {
  const b = body as { id?: unknown; review?: unknown; was?: unknown };
  if (typeof b?.id !== "string" || !/^s[1-9][0-9]?e[0-9]{2}$/.test(b.id)) throw Object.assign(new Error("expected { id: <episode id>, review }"), { status: 400 });
  const all = readReview();
  const next = clean(b.was !== undefined ? merge3(b.was, all.episodes[b.id] ?? {}, b.review, "theirs").doc : b.review);
  // an approval vouches for the episode as it is saved now (model/progress.ts episodeSig), whoever approves it
  if (next.status === "approved" && !next.sig && exists("story", b.id)) next.sig = episodeSig(readDoc("story", b.id).doc as StoryDoc);
  const episodes = { ...all.episodes };
  if (Object.keys(next).length) episodes[b.id] = next; else delete episodes[b.id];
  const doc: Review = { v: 1, episodes: Object.fromEntries(Object.entries(episodes).sort(([a], [c]) => a.localeCompare(c))) };
  writeAtomic(REVIEW, textFor(REVIEW, doc));
  return doc;
}


/** An episode's blocks as saved (the Review page and check_season compare marks with the saved file, so unsaved edits show as changed). */
export function blocksFor(id: string): Block[] {
  const series = exists("series", "series") ? readDoc("series", "series").doc as SeriesDoc : null;
  return blocksOf(readDoc("story", id).doc as StoryDoc, languagesOf(series));
}

/**
 * Where an episode stands, from its saved file, its notes and its problems: the stages of the work, as its page shows them
 * (model/progress.ts), in the shape check_season and set_review read. Ready is every stage before Review done (a plugin's
 * stage done when its check finds no error), no errors and no open comments; `done` and `total` count those stages.
 */
export function standingFor(id: string, problems: Problem[], r: EpisodeReview | undefined = readReview().episodes[id]): Standing {
  const series = exists("series", "series") ? readDoc("series", "series").doc as SeriesDoc : null;
  const story = readDoc("story", id).doc as StoryDoc, langs = languagesOf(series);
  const mine = problems.filter(p => p.doc === `story:${id}`), errors = mine.filter(p => p.level === "error").length;
  const stages = storyPluginsOf(series).map(pl => {
    const n = mine.filter(p => p.plugin === pl.id && p.level === "error").length;
    return { key: pl.id, name: pl.id.charAt(0).toUpperCase() + pl.id.slice(1), done: n === 0, state: n ? `${n} problem${n > 1 ? "s" : ""}` : "All checks pass" };
  });
  const p = progressOf({ story, langs, review: r, errors, suggestions: {}, stages });
  const before = p.stages.filter(x => x.key !== "review"), left = before.filter(x => !x.done);
  const missing = [...left.map(x => `${x.name.toLowerCase()}: ${x.state}`), errors ? `${errors} error${errors === 1 ? "" : "s"}` : "", p.openComments ? `${p.openComments} open comment${p.openComments === 1 ? "" : "s"}` : ""].filter(Boolean);
  const stage: Standing["stage"] = p.approved ? "approved" : p.changedSinceApproved ? "changed" : !missing.length ? "ready" : before.some(x => x.done && x.key !== "brief") || (r?.comments?.length ?? 0) > 0 ? "in-review" : "draft";
  const passes = Object.fromEntries(p.langs.map(l => [l.lang, { done: l.done, total: l.total }]));
  return { stage, total: before.length, done: before.length - left.length, changed: p.changedSinceApproved ? 1 : 0, todo: left.length, passes, errors, openComments: p.openComments, missing, states: {} };
}
