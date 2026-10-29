// The server's JSON API (server/http.ts), typed for the pages.

import type { CharacterDoc, LangText, SeasonDoc, SeriesDoc, StoryPlace } from "sahne-story";

export type Kind = "series" | "season" | "story" | "character" | "place";

export interface Episode { id: string; season?: number; title: LangText; kind?: "episode" | "special"; releaseDate?: string; draft: boolean; place: string; cast: string[] }
export interface World {
  series: SeriesDoc | null;
  seasons: Record<string, SeasonDoc>;
  episodes: Episode[];
  characters: Record<string, CharacterDoc>;
  places: Record<string, StoryPlace>;
  days: Record<string, { date: string; kind: string; week: number }> | null;
  /** Whether the root has word cards (the known-word ratio, the word picker). */
  cards: boolean;
  samples: boolean;
  writable: boolean;
  /** How many content files are still in the old language shape (then nothing is saved: convert the root first). */
  oldShape?: number;
  /** Whether AI help is on (the server has ANTHROPIC_API_KEY). */
  ai?: boolean | { ready: boolean; provider: string; model?: string };
  /** How agents' edits land: as proposals to accept, or written directly. */
  agentEdits?: "proposals" | "direct";
  /** Whether agents may see a card's main-language word. */
  shareCards?: boolean;
}
export interface Problem { rule: string; level: "error" | "warning" | "info"; story: string; step?: number; option?: number; message: string; doc: string; new?: boolean }
export interface Edit { kind: Kind; id: string; doc: unknown; mtime?: number; create?: boolean }
export interface SaveResult { status: number; saved?: Record<string, number>; problems?: Problem[]; message?: string }

async function call<T>(method: string, path: string, body?: unknown): Promise<T & { status: number }> {
  const r = await fetch(`/api/${path}`, { method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const v = await r.json().catch(() => ({ message: r.statusText }));
  return { ...v, status: r.status };
}

export const api = {
  world: () => call<World>("GET", "world"),
  doc: (kind: Kind, id: string) => call<{ doc: unknown; mtime: number }>("GET", `doc/${kind}/${encodeURIComponent(id)}`),
  head: (kind: Kind, id: string) => call<{ doc: unknown }>("GET", `head/${kind}/${encodeURIComponent(id)}`),
  check: (edits: Edit[]) => call<{ problems: Problem[] }>("POST", "check", { edits }),
  save: (edits: Edit[]) => call<SaveResult>("POST", "save", { edits }),
  thumbs: () => call<{ stale: string[]; command: string }>("GET", "thumbs"),
  reload: () => call<{ ok: boolean }>("POST", "reload", {}),
  post: <T>(path: string, body: unknown) => call<T>("POST", path, body),
  get: <T>(path: string) => call<T>("GET", path),
};
