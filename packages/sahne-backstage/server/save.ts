// Reading and writing content files without changing what an edit did not touch. A file is parsed with each number kept as
// it was written (`1.0` stays `1.0`: JSON.rawJSON, Node 24), its own key order and whether it ends in a newline; an edited
// document that comes back from the browser (where `1.0` became `1`) takes the old spelling back wherever the value is the
// same. A write goes to a temp file beside the target (not named *.json, so no reader lists it) and is renamed over it.

import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

type Json = unknown;
interface RawJson { rawJSON: string }
const J = JSON as unknown as { rawJSON(s: string): RawJson; isRawJSON(v: unknown): v is RawJson };

/** A content file as read: the document (numbers as written), its text, whether it ends in a newline, its mtime. */
export interface Read { doc: Json; text: string; newline: boolean; mtime: number }

/** Parse JSON keeping each number's spelling. */
export const parseKeep = (text: string): Json =>
  JSON.parse(text, (_k, v, ctx?: { source?: string }) => (typeof v === "number" && ctx?.source !== undefined ? J.rawJSON(ctx.source) : v));

/** The document as plain JSON (each kept number back to a number), for the browser and the checks. */
export const plain = (doc: Json): Json => JSON.parse(JSON.stringify(doc));

/** Read a content file. */
export function readFile(u: URL): Read {
  const text = readFileSync(u, "utf8");
  return { doc: parseKeep(text), text, newline: text.endsWith("\n"), mtime: statSync(u).mtimeMs };
}

/** `next` with every number that equals `prev`'s at the same place spelled as `prev` spelled it. */
export function keepNumbers(next: Json, prev: Json): Json {
  if (typeof next === "number" && J.isRawJSON(prev)) return Number(prev.rawJSON) === next ? prev : next;
  if (Array.isArray(next)) return next.map((v, i) => keepNumbers(v, Array.isArray(prev) ? prev[i] : undefined));
  if (next && typeof next === "object") {
    const p = prev && typeof prev === "object" && !Array.isArray(prev) && !J.isRawJSON(prev) ? prev as Record<string, Json> : {};
    return Object.fromEntries(Object.entries(next as Record<string, Json>).map(([k, v]) => [k, keepNumbers(v, p[k])]));
  }
  return next;
}

/** The text of a document, as the content files are written: 2-space indent, raw UTF-8, and a final newline when asked. */
export const format = (doc: Json, newline: boolean): string => JSON.stringify(doc, null, 2) + (newline ? "\n" : "");

/** Write a file atomically: a temp file beside it, then a rename. */
export function writeAtomic(u: URL, text: string): number {
  const path = fileURLToPath(u);
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  writeFileSync(tmp, text);
  renameSync(tmp, path);
  return statSync(u).mtimeMs;
}

/** The text an edit of a file writes: the old numbers' spelling and the file's newline kept; a new file ends in a newline. */
export function textFor(u: URL, doc: Json): string {
  if (!existsSync(u)) return format(doc, true);
  const old = readFile(u);
  return format(keepNumbers(doc, old.doc), old.newline);
}
