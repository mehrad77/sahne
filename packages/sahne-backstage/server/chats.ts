// The assistant's conversations (Node only), in the content root's sidecar beside its memory (`.backstage/chats/<id>.json`,
// sahne-story's paths.ts `CHATS`): one file each, written atomically, trimmed as src/model/chats.ts keeps them, at most
// `KEEP_CHATS` per root (the oldest by their own time go first: a checkout resets the files' times). Everyone who works on
// the series shares them, and they are committed with it. Written only by a backstage started with --write.

import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { CHATS, chatFile } from "../../sahne-story/paths.ts";
import { writeAtomic } from "../../sahne-story/json.ts";
import { chatOf, KEEP_CHATS, safeId, summaryOf, type Chat, type ChatSummary } from "../src/model/chats.ts";

const fail = (status: number, message: string) => Object.assign(new Error(message), { status });
const need = (id: string) => { if (!safeId(id)) throw fail(400, `not a conversation id: ${JSON.stringify(id)} (a-z, 0-9 and -)`); return id; };

function readAt(id: string): { chat: Chat; size: number } | null {
  const u = chatFile(id);
  if (!existsSync(u)) return null;
  try {
    const text = readFileSync(u, "utf8"), chat = chatOf(JSON.parse(text), id);
    return chat ? { chat, size: text.length } : null;
  } catch { return null; }
}

const ids = (): string[] => existsSync(CHATS) ? readdirSync(CHATS).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)).filter(safeId) : [];

/** The conversations kept, newest first, without their turns. */
export function listChats(): ChatSummary[] {
  return ids().flatMap(id => { const r = readAt(id); return r ? [summaryOf(r.chat, r.size)] : []; }).sort((a, b) => b.at - a.at);
}

/** One conversation, or null. */
export function readChat(id: string): Chat | null { return readAt(need(id))?.chat ?? null; }

/** Keep a conversation (trimmed), then only the newest `KEEP_CHATS`: what it kept. */
export function writeChat(id: string, v: unknown): ChatSummary {
  const chat = chatOf(v, need(id));
  if (!chat) throw fail(400, "a conversation is { title, at, turns: [{ role, content, parts? }] }");
  const text = JSON.stringify(chat, null, 2) + "\n";
  writeAtomic(chatFile(id), text);
  for (const old of listChats().slice(KEEP_CHATS)) rmSync(chatFile(old.id), { force: true });
  return summaryOf(chat, text.length);
}

/** Delete a conversation: false when there is none of that id. */
export function deleteChat(id: string): boolean {
  const u = chatFile(need(id));
  if (!existsSync(u)) return false;
  rmSync(u);
  return true;
}
