// The assistant's conversations as they are kept (pure, for the editor and the server alike): trimmed (the thinking
// shortened, no tool's result, never a picture), at most `KEEP_CHAT` characters of one (its oldest turns go first), and
// ids that are safe as a file name. The server keeps them in the content root's sidecar (`.backstage/chats/`, through
// server/chats.ts); a read-only backstage leaves them in the browser, and a browser that has some moves them to the
// server once it can write (`toMove`).

/** A part of an answer, as far as keeping it goes. */
export interface KeptPart { type: string; text?: string; detail?: unknown }
export interface KeptTurn { role: "user" | "assistant"; content: string; parts?: KeptPart[] }
export interface Chat<T extends KeptTurn = KeptTurn> { id: string; title: string; at: number; turns: T[] }
/** A conversation in the list: no turns, its size in characters as kept. */
export interface ChatSummary { id: string; title: string; at: number; size: number; messages: number }

/** The longest thinking kept with a conversation, the most of one conversation kept, and the most conversations kept per root. */
export const KEEP_THINKING = 2000, KEEP_CHAT = 200_000, KEEP_CHATS = 100;

/** A conversation's (or a task's) id: lowercase letters, digits and `-`, never a path. */
export const safeId = (id: unknown): id is string => typeof id === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(id);

/** A turn as it is kept: the thinking shortened, no tool's result (it can be long and is not needed to read it again), no pictures. */
export function trimmed<T extends KeptTurn>(t: T): T {
  const { pictures: _p, ...turn } = t as T & { pictures?: unknown };
  if (!turn.parts) return turn as T;
  return { ...turn, parts: turn.parts.map(p => p.type === "thinking" ? { ...p, text: String(p.text ?? "").slice(0, KEEP_THINKING) } : p.type === "tool" ? { ...p, detail: undefined } : p) } as T;
}

/** A conversation as it is kept: its turns trimmed, the oldest dropped until it fits `KEEP_CHAT`. */
export function keptChat<T extends KeptTurn>(c: Chat<T>): Chat<T> {
  const turns = c.turns.map(trimmed);
  let n = 0;
  const of = () => ({ id: c.id, title: String(c.title ?? "").slice(0, 120), at: c.at, turns: turns.slice(n) });
  while (JSON.stringify(of()).length > KEEP_CHAT && n < turns.length - 1) n++;
  return of();
}

/** A conversation sent to be kept, checked: null when it is not one. */
export function chatOf(v: unknown, id: string): Chat | null {
  const c = v as Partial<Chat>;
  if (!c || typeof c !== "object" || !Array.isArray(c.turns) || typeof c.at !== "number" || !Number.isFinite(c.at)) return null;
  const turns = c.turns.filter((t): t is KeptTurn => !!t && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .map(t => (Array.isArray(t.parts) ? { ...t, parts: t.parts.filter(p => p && typeof p.type === "string") } : { ...t, parts: undefined }));
  return keptChat({ id, title: typeof c.title === "string" && c.title.trim() ? c.title : "A conversation", at: c.at, turns });
}

export const summaryOf = (c: Chat, size: number): ChatSummary => ({ id: c.id, title: c.title, at: c.at, size, messages: c.turns.filter(t => t.role === "user").length });

/**
 * The conversations of this browser to move to the server: the ones it does not have, or has an older copy of. The
 * browser clears its own once all of them are written.
 */
export function toMove<T extends Chat>(local: T[], server: Pick<ChatSummary, "id" | "at">[]): T[] {
  const at = new Map(server.map(s => [s.id, s.at]));
  return local.filter(c => safeId(c.id) && Array.isArray(c.turns) && c.turns.length > 0 && !(at.has(c.id) && at.get(c.id)! >= c.at));
}
