// What changed in an episode: the rows of its step list whose content differs between two versions (the last commit and
// now), and a word-by-word diff of a text. Pure (test/model.test.ts).

import type { StoryDoc } from "sahne-story";
import { equal, get, type Path } from "./path.ts";
import { rows, type Row } from "./steps.ts";

export interface Part { op: "=" | "-" | "+"; text: string }

/** A word diff of two texts (the longest common run of words kept, the rest removed or added). */
export function diffWords(a: string, b: string): Part[] {
  const x = a.split(/(\s+)/).filter(Boolean), y = b.split(/(\s+)/).filter(Boolean);
  const n = x.length, m = y.length, L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: Part[] = [];
  const push = (op: Part["op"], text: string) => { const last = out[out.length - 1]; if (last?.op === op) last.text += text; else out.push({ op, text }); };
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (x[i] === y[j]) { push("=", x[i]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) push("-", x[i++]);
    else push("+", y[j++]);
  }
  while (i < n) push("-", x[i++]);
  while (j < m) push("+", y[j++]);
  return out;
}

export interface Change { row: Row; was: unknown; now: unknown }

/** The step-list rows whose own content differs (an option's replies are their own rows), plus the episode's fields. */
export function changes(was: StoryDoc | null, now: StoryDoc): { fields: string[]; rows: Change[]; added: number; removed: number } {
  if (!was) return { fields: [], rows: [], added: now.steps.length, removed: 0 };
  const fields = Object.keys({ ...was, ...now }).filter(k => k !== "steps" && !equal((was as Record<string, unknown>)[k], (now as Record<string, unknown>)[k]));
  const own = (v: unknown, path: Path) => {
    // a choice's own fields without its options, an option's without its replies: each is its own row
    if (!v || typeof v !== "object") return v;
    if (path.length === 2 && "choice" in (v as object)) { const { options: _o, ...c } = (v as { choice: Record<string, unknown> }).choice; return c; }
    if (path.at(-2) === "options") { const { reply: _r, ...o } = v as Record<string, unknown>; return o; }
    return v;
  };
  const list = rows(now).filter(r => !equal(own(get(was, r.path), r.path), own(get(now, r.path), r.path))).map(row => ({ row, was: get(was, row.path), now: get(now, row.path) }));
  return { fields, rows: list, added: Math.max(0, now.steps.length - was.steps.length), removed: Math.max(0, was.steps.length - now.steps.length) };
}
