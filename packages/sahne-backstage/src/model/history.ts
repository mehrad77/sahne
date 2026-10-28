// One open document's edits: the saved version, the current one, undo and redo. Typing into one field is one undo step: an
// edit with the same `key` as the last, within a second, replaces it instead of stacking. Pure (test/model.test.ts).

import { equal } from "./path.ts";

export interface Draft<T = unknown> {
  /** As last read from or written to disk. */
  saved: T;
  /** As edited. */
  doc: T;
  past: T[];
  future: T[];
  /** The file's mtime when read or written (a save sends it back). */
  mtime?: number;
  /** A new document, not on disk yet. */
  create?: boolean;
  last?: { key: string; at: number };
}

const LIMIT = 200;

export const open = <T>(doc: T, mtime?: number, create = false): Draft<T> => ({ saved: doc, doc, past: [], future: [], mtime, create });

/** The draft with `next` as its document; `key` names the field typed into (repeated keystrokes coalesce). */
export function edit<T>(d: Draft<T>, next: T, key?: string, now = Date.now()): Draft<T> {
  if (equal(next, d.doc)) return d;
  const coalesce = !!key && d.last?.key === key && now - d.last.at < 1000 && d.past.length > 0;
  const past = coalesce ? d.past : [...d.past, d.doc].slice(-LIMIT);
  return { ...d, doc: next, past, future: [], last: key ? { key, at: now } : undefined };
}

export function undo<T>(d: Draft<T>): Draft<T> {
  if (!d.past.length) return d;
  return { ...d, doc: d.past[d.past.length - 1], past: d.past.slice(0, -1), future: [d.doc, ...d.future], last: undefined };
}

export function redo<T>(d: Draft<T>): Draft<T> {
  if (!d.future.length) return d;
  return { ...d, doc: d.future[0], past: [...d.past, d.doc], future: d.future.slice(1), last: undefined };
}

/** Back to the saved version (one undo step). */
export const revert = <T>(d: Draft<T>): Draft<T> => edit(d, d.saved);

/** Written: what was edited is now the saved version. */
export const saved = <T>(d: Draft<T>, mtime: number): Draft<T> => ({ ...d, saved: d.doc, mtime, create: false });

export const dirty = (d: Draft | undefined) => !!d && (d.create || !equal(d.doc, d.saved));
