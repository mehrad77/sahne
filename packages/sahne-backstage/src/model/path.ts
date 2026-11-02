// Places in a document, as paths of keys and indexes (["steps", 3, "choice", "options", 1, "reply", 0, "tr"]): reading one,
// writing one without touching the rest (a new object along the path, the same objects elsewhere, and a key keeps its
// place in its object), and the place in a story each cue of the stage comes from (sahne-story's CueInfo: step, option,
// reply), and a three-way merge of two edits of one document (`merge3`: an agent's proposal over the person's own
// edits). Pure: Node-tested (test/model.test.ts, test/merge.test.ts).

import type { CueInfo } from "sahne-story";

export type Key = string | number;
export type Path = readonly Key[];

/** The value at a path, or undefined. */
export function get(doc: unknown, path: Path): unknown {
  let v: unknown = doc;
  for (const k of path) {
    if (v === null || typeof v !== "object") return undefined;
    v = (v as Record<Key, unknown>)[k];
  }
  return v;
}

/** The document with the value at `path` set (undefined removes a key; an index past an array's end appends). */
export function set<T>(doc: T, path: Path, value: unknown): T {
  if (!path.length) return value as T;
  const [k, ...rest] = path;
  if (Array.isArray(doc)) {
    const i = Number(k), out = [...doc];
    if (rest.length || value !== undefined) out[i] = set(doc[i], rest, value);
    else out.splice(i, 1);
    return out as T;
  }
  const o = (doc && typeof doc === "object" ? doc : {}) as Record<string, unknown>;
  const child = set(o[k as string] ?? (typeof rest[0] === "number" ? [] : rest.length ? {} : undefined), rest, value);
  if (child === undefined) { const { [k as string]: _gone, ...keep } = o; return keep as T; }
  return { ...o, [k]: child } as T;
}

/** Insert `value` into the array at `path` before index `i` (at the end when i is past it). */
export function insert<T>(doc: T, path: Path, i: number, value: unknown): T {
  const a = (get(doc, path) as unknown[] | undefined) ?? [];
  return set(doc, path, [...a.slice(0, i), value, ...a.slice(i)]);
}

/** Move the item at `from` of the array at `path` to `to`. */
export function move<T>(doc: T, path: Path, from: number, to: number): T {
  const a = [...((get(doc, path) as unknown[] | undefined) ?? [])];
  if (from < 0 || from >= a.length || to < 0 || to >= a.length || from === to) return doc;
  const [x] = a.splice(from, 1);
  a.splice(to, 0, x);
  return set(doc, path, a);
}

/** Paths are equal. */
export const same = (a: Path | null | undefined, b: Path | null | undefined) => !!a && !!b && a.length === b.length && a.every((k, i) => k === b[i]);
/** `a` starts with `b`. */
export const within = (a: Path, b: Path) => b.length <= a.length && b.every((k, i) => a[i] === k);

/** Where in its story a cue comes from: the step, a choice's option (the stand-in's picked line), or a reply of that option. */
export function cuePath(i: Pick<CueInfo, "step" | "kind" | "option" | "reply">): Path {
  if (i.option !== undefined && i.kind === "reply" && i.reply !== undefined) return ["steps", i.step, "choice", "options", i.option, "reply", i.reply];
  if (i.option !== undefined) return ["steps", i.step, "choice", "options", i.option];
  return ["steps", i.step];
}

/** The first cue a path plays at (the step's, or the option's when that option is picked), or -1. */
export function cueOf(info: readonly CueInfo[], path: Path): number {
  for (let k = 0; k < info.length; k++) if (within(path, cuePath(info[k])) || within(cuePath(info[k]), path)) return k;
  return -1;
}

/** Deep equality of JSON values. */
export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a as object), kb = Object.keys(b as object);
  return ka.length === kb.length && ka.every(k => equal((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/** A three-way merge's outcome: the merged document, or the first place both sides changed differently. */
export type Merged = { doc: unknown; conflict?: undefined } | { doc?: undefined; conflict: Path };

const isPlain = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** How alike two values are, 0 to 1: 1 the same; an object by its keys, each counted as alike as its values. */
function alike(a: unknown, b: unknown): number {
  if (equal(a, b)) return 1;
  if (!isPlain(a) || !isPlain(b)) return 0;
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return keys.reduce((n, k) => n + alike(a[k], b[k]), 0) / keys.length;
}

/**
 * How a list became another: for each item of `base`, its index in `side` (undefined: removed), and the items `side`
 * added before each index of `base` (`base.length`: at the end). Items kept as they were are matched first (the longest
 * common run); between two of those, a base item and the side's at the same place, when as many were there and they are
 * alike, are the same item changed. Anything else is a removal and an addition (a move is both); `end` says, for an item
 * removed, before which base index the additions of its stretch went (an item rewritten past `alike` is removed there and
 * added again).
 */
function align(base: readonly unknown[], side: readonly unknown[]): { to: (number | undefined)[]; added: number[][]; end: number[] } {
  const n = base.length, m = side.length, L = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = equal(base[i], side[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const anchors: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (equal(base[i], side[j])) anchors.push([i++, j++]);
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const to: (number | undefined)[] = new Array(n).fill(undefined), added: number[][] = Array.from({ length: n + 1 }, () => []), end: number[] = new Array(n).fill(n);
  const bounds: [number, number][] = [[-1, -1], ...anchors, [n, m]];
  for (let g = 0; g + 1 < bounds.length; g++) {
    const [i0, j0] = bounds[g], [i1, j1] = bounds[g + 1];
    const bs = Array.from({ length: i1 - i0 - 1 }, (_, k) => i0 + 1 + k), ss = Array.from({ length: j1 - j0 - 1 }, (_, k) => j0 + 1 + k);
    const paired = bs.length === ss.length && bs.every((i, k) => alike(base[i], side[ss[k]]) >= 0.5);
    if (paired) bs.forEach((i, k) => { to[i] = ss[k]; });
    else { added[i1].push(...ss); for (const i of bs) end[i] = i1; }
    if (i1 < n) to[i1] = j1;
  }
  return { to, added, end };
}

/**
 * `mine` and `theirs`, two edits of `base`, made one: what only one side changed is taken from it, what both changed the
 * same way once; objects merge key by key, lists item by item (`align`), so an item added, removed or moved on one side
 * lands where it belongs among the other side's. A place both changed differently is a conflict (with `prefer`, that
 * side's value wins there instead).
 */
export function merge3(base: unknown, mine: unknown, theirs: unknown, prefer?: "mine" | "theirs", at: Path = []): Merged {
  if (equal(mine, theirs)) return { doc: mine };
  if (equal(base, mine)) return { doc: theirs };
  if (equal(base, theirs)) return { doc: mine };
  const lose = (): Merged => (prefer ? { doc: prefer === "mine" ? mine : theirs } : { conflict: at });
  if (isPlain(mine) && isPlain(theirs)) {
    const b = isPlain(base) ? base : {}, out: Record<string, unknown> = {};
    for (const k of [...new Set([...Object.keys(mine), ...Object.keys(theirs)])]) {
      const r = merge3(b[k], mine[k], theirs[k], prefer, [...at, k]);
      if (r.conflict) return r;
      if (r.doc !== undefined) out[k] = r.doc;
    }
    return { doc: out };
  }
  if (!Array.isArray(mine) || !Array.isArray(theirs)) return lose();
  const b = Array.isArray(base) ? base : [], A = align(b, mine), B = align(b, theirs), out: unknown[] = [];
  for (let i = 0; i <= b.length; i++) {
    // both sides' additions here, one each of what both added (a side may add the same thing twice)
    const adds = A.added[i].map(j => mine[j]), pool = [...adds];
    for (const j of B.added[i]) { const k = pool.findIndex(x => equal(x, theirs[j])); if (k >= 0) pool.splice(k, 1); else adds.push(theirs[j]); }
    if (i === b.length) { out.push(...adds); break; }
    const a = A.to[i], t = B.to[i];
    out.push(...adds);
    if (a !== undefined && t !== undefined) {
      const r = merge3(b[i], mine[a], theirs[t], prefer, [...at, i]);
      if (r.conflict) return r;
      out.push(r.doc);
    }
    // removed on one side: fine while the other kept it as it was
    else if (a !== undefined && !equal(mine[a], b[i])) { if (prefer === "mine") out.push(mine[a]); else if (!prefer) return { conflict: [...at, i] }; }
    else if (t !== undefined && !equal(theirs[t], b[i])) { if (prefer === "theirs") out.push(theirs[t]); else if (!prefer) return { conflict: [...at, i] }; }
  }
  return { doc: out };
}
