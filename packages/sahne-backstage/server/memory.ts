// What the assistant remembers between conversations (Node only): short notes of lasting decisions and preferences (a
// house style, a name, how a person likes a thing done), in the content root's sidecar beside the review notes
// (.backstage/memory.json), so everyone who works on the series shares them and they are committed with it. Written
// atomically; at most `MAX` notes, the oldest going first. Every note is in the assistant's instructions; a person sees and
// deletes them in Settings. Never a secret: a note that looks like a key is refused.

import { existsSync } from "node:fs";
import { MEMORY } from "../../sahne-story/paths.ts";
import { plain, readFile, textFor, writeAtomic } from "../../sahne-story/json.ts";

export interface Note { id: string; text: string; at: number }
interface Memory { v: 1; notes: Note[] }
/** The most notes kept, and the longest one. */
export const MAX = 100, NOTE_MAX = 500;

export function readMemory(): Note[] {
  if (!existsSync(MEMORY)) return [];
  try { return ((plain(readFile(MEMORY).doc) as Memory).notes ?? []).filter(n => n && typeof n.text === "string"); } catch { return []; }
}

const write = (notes: Note[]) => { writeAtomic(MEMORY, textFor(MEMORY, { v: 1, notes } satisfies Memory)); return notes; };

/** Keep a note; returns it. Refused: an empty one, or one that looks like a key or a password. */
export function remember(text: string): Note {
  const t = text.replace(/\s+/g, " ").trim().slice(0, NOTE_MAX);
  if (!t) throw Object.assign(new Error("a note needs words"), { status: 400 });
  if (/\b(sk-[a-z]{2,}-|tvly-|api[_ -]?key|password|token)\b/i.test(t)) throw Object.assign(new Error("a note never holds a key, a token or a password"), { status: 400 });
  const notes = readMemory();
  const n = Math.max(0, ...notes.map(x => Number(x.id.slice(1)) || 0)) + 1;
  const note: Note = { id: `m${n}`, text: t, at: Date.now() };
  write([...notes, note].slice(-MAX));
  return note;
}

/** Forget a note: false when there is none of that id. */
export function forgetNote(id: string): boolean {
  const notes = readMemory(), next = notes.filter(x => x.id !== id);
  if (next.length === notes.length) return false;
  write(next);
  return true;
}
