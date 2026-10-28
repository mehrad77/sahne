// Places in a document, as paths of keys and indexes (["steps", 3, "choice", "options", 1, "reply", 0, "tr"]): reading one,
// writing one without touching the rest (a new object along the path, the same objects elsewhere, and a key keeps its
// place in its object), and the place in a story each cue of the stage comes from (sahne-story's CueInfo: step, option,
// reply). Pure: Node-tested (test/model.test.ts).

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
