// Where an episode stands in review, worked out from the evidence (pure; the Review page, the episode's review mode and
// the MCP server's check_season and set_review all use it, so they never disagree). An episode is a list of blocks (a
// step, a choice's option, a reply: the script's rows); a block is reviewed with ✓, and each of its translations checked.
// A mark remembers the block as it was (`sig`): when the block changes, the mark shows as changed, not done. Marks from
// before signatures count as reviewed, unverified. Keys are step indexes, so inserting a step shifts the blocks after it,
// and their marks show as changed. Nothing here is about language learning: a series with one language has no translation
// passes, and Ready means every block reviewed, no errors and no open comments.

import type { StoryDoc } from "sahne-story";
import { rows } from "./steps.ts";
import type { Path } from "./path.ts";

export type Status = "draft" | "reviewed" | "approved";
export interface Comment { id: string; at?: string; by: string; text: string; date: string; done?: boolean }
/** A block's review: reviewed, the translations checked, and the block as it was then (`sig`). `persian`: notes from before `checked`. */
export interface StepNote { reviewed?: boolean; checked?: string[]; persian?: boolean; sig?: string }
export interface EpisodeReview { status?: Status; ai?: boolean; reviewer?: string; steps?: Record<string, StepNote>; comments?: Comment[] }

/** One block of an episode, as review sees it. */
export interface Block { key: string; path: Path; step: number; kind: string; who?: string; text: string; sig: string; /** The translations it holds words in, which each need a check. */ langs: string[] }
/** A block's state: not started, partly (reviewed but a translation unchecked, or the reverse), done, done before signatures, changed since. */
export type BlockState = "todo" | "partial" | "done" | "unverified" | "changed";
/** An episode's stage: no marks yet; some; every block done, no errors, no open comments; signed off; signed off but changed since. */
export type Stage = "draft" | "in-review" | "ready" | "approved" | "changed";
export const STAGES: Stage[] = ["draft", "in-review", "ready", "approved"];
export const STAGE_NAME: Record<Stage, string> = { draft: "Draft", "in-review": "In review", ready: "Ready", approved: "Approved", changed: "Changed since approved" };

/** A block's key in the notes: its step, option and reply (`3`, `5.1`, `5.1.0`). */
export const rowKey = (path: Path) => [path[1], path[4], path[6]].filter(x => x !== undefined).join(".");
/** The translations a note says were checked. */
export const checkedOf = (n: StepNote | undefined): string[] => [...new Set([...(n?.checked ?? []), ...(n?.persian ? ["fa"] : [])])];

/** A short, stable hash of a value (FNV-1a over its JSON, keys sorted): 8 hex digits. */
export function hashOf(v: unknown): string {
  const json = JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));
  let h = 0x811c9dc5;
  for (let i = 0; i < (json ?? "").length; i++) { h ^= json.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

const at = (story: Pick<StoryDoc, "steps">, path: Path): Record<string, any> | undefined => {
  let x: any = story;
  for (const k of path) x = x?.[k];
  return x && typeof x === "object" ? x : undefined;
};
/** A block without the blocks inside it (a choice's options, an option's replies): what its mark vouches for. */
const own = (node: Record<string, any> | undefined, kind: string) => {
  if (!node) return null;
  if (kind === "choice" && node.choice) { const { options: _o, ...c } = node.choice; return { ...node, choice: c }; }
  if (kind === "option") { const { reply: _r, ...o } = node; return o; }
  return node;
};
/** The words a block holds in `lang`: its own, a spot's, an act's prompt. */
const wordsIn = (node: Record<string, any> | undefined, lang: string): string | undefined => {
  for (const x of [node, node?.spot, node?.act?.prompt]) if (x && typeof x[lang] === "string" && x[lang].trim()) return x[lang];
  return undefined;
};

/** An episode's blocks, in script order, with the words in the main language and the translations each holds. */
export function blocksOf(story: Pick<StoryDoc, "steps">, langs: { main: string; translations: string[] }): Block[] {
  return rows(story).map(r => {
    const node = at(story, r.path);
    return {
      key: rowKey(r.path), path: r.path, step: Number(r.path[1]), kind: r.kind,
      who: node?.who ?? node?.beat?.who ?? undefined,
      text: wordsIn(node, langs.main) ?? r.text,
      sig: hashOf(own(node, r.kind)),
      langs: langs.translations.filter(l => wordsIn(node, l) !== undefined),
    };
  });
}

/** One block's signature, without listing the episode (a step, a choice's option or a reply, by its path). */
export function sigAt(story: Pick<StoryDoc, "steps">, path: Path): string {
  const node = at(story, path);
  return hashOf(own(node, path.length >= 7 ? "reply" : path.length >= 5 ? "option" : node?.choice ? "choice" : "step"));
}

/** Where a block stands. */
export function stateOf(b: Block, n: StepNote | undefined): BlockState {
  const checked = checkedOf(n);
  if (!n?.reviewed && !checked.length) return "todo";
  if (n?.sig && n.sig !== b.sig) return "changed";
  if (n?.reviewed && b.langs.every(l => checked.includes(l))) return n.sig ? "done" : "unverified";
  return "partial";
}

export interface Standing {
  stage: Stage; total: number; done: number; changed: number; todo: number;
  /** Each translation's checks: how many of the blocks holding it are checked. */
  passes: Record<string, { done: number; total: number }>;
  errors: number; openComments: number;
  /** What keeps it from Ready, in words (empty when it is ready). */
  missing: string[];
  states: Record<string, BlockState>;
}

/** Where an episode stands: its blocks' states, its passes, and its stage. */
export function standingOf(r: EpisodeReview | undefined, blocks: Block[], o: { errors: number; translations: string[] }): Standing {
  const states: Record<string, BlockState> = {};
  for (const b of blocks) states[b.key] = stateOf(b, r?.steps?.[b.key]);
  const vals = Object.values(states);
  const done = vals.filter(s => s === "done" || s === "unverified").length, changed = vals.filter(s => s === "changed").length, todo = vals.filter(s => s === "todo").length;
  const passes: Standing["passes"] = {};
  for (const l of o.translations) {
    const holding = blocks.filter(b => b.langs.includes(l));
    if (holding.length) passes[l] = { total: holding.length, done: holding.filter(b => states[b.key] !== "changed" && checkedOf(r?.steps?.[b.key]).includes(l)).length };
  }
  const openComments = (r?.comments ?? []).filter(c => !c.done).length;
  const missing = [
    blocks.length - done ? `${blocks.length - done} of ${blocks.length} block${blocks.length === 1 ? "" : "s"} to review${changed ? ` (${changed} changed since)` : ""}` : "",
    o.errors ? `${o.errors} error${o.errors === 1 ? "" : "s"}` : "",
    openComments ? `${openComments} open comment${openComments === 1 ? "" : "s"}` : "",
    blocks.length ? "" : "no blocks",
  ].filter(Boolean);
  const ready = !missing.length;
  const marked = vals.some(s => s !== "todo") || !!r?.comments?.length;
  // signed off stays signed off, unless a block it vouched for changed since
  const stage: Stage = r?.status === "approved" ? (changed ? "changed" : "approved") : ready ? "ready" : marked ? "in-review" : "draft";
  return { stage, total: blocks.length, done, changed, todo, passes, errors: o.errors, openComments, missing, states };
}
