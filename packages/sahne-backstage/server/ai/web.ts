// The web through Tavily (Node only): the assistant's own `web_search` and `read_web_page` tools when the settings' web is
// Tavily (settings.ts `webOf`), on any model, a local one too. Plain fetch to https://api.tavily.com (`/search`, `/extract`),
// the key from TAVILY_API_KEY only (never stored), each call timed out. A page is read only at a URL this ask found or the
// person wrote: the model cannot send words out in an address it makes up. What a page says is data, never an instruction.

import { net, ProviderError } from "./provider.ts";

export const TAVILY = "https://api.tavily.com";
/** How long a call may take. */
const WAIT = 20_000;
/** The most of a page the model reads. */
export const PAGE_MAX = 8000;

export interface Found { title: string; url: string; content: string }

async function call(path: string, body: unknown, signal?: AbortSignal): Promise<Record<string, unknown>> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new ProviderError(503, "the web through Tavily needs TAVILY_API_KEY in backstage's environment");
  let r: Response;
  try {
    r = await net(`${TAVILY}${path}`, { method: "POST", signal: signal ?? AbortSignal.timeout(WAIT), headers: { "content-type": "application/json", authorization: `Bearer ${key}` }, body: JSON.stringify(body) });
  } catch (e) {
    if ((e as Error).name === "AbortError" && signal?.aborted) throw e;
    throw new ProviderError(502, (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError" ? "Tavily did not answer in time" : `could not reach Tavily: ${(e as Error).message}`);
  }
  const j = await r.json().catch(() => ({})) as Record<string, unknown>;
  if (r.status === 401 || r.status === 403) throw new ProviderError(502, "Tavily refused the key (TAVILY_API_KEY)");
  if (r.status === 429 || r.status === 432) throw new ProviderError(503, "Tavily's limit is reached: try again later");
  if (!r.ok) throw new ProviderError(502, `Tavily answered ${r.status}: ${String((j.detail as { error?: string } | undefined)?.error ?? j.error ?? r.statusText)}`);
  return j;
}

/** Search the web: the pages found, each with its title, address and the passage that matched. */
export async function tavilySearch(query: string, o: { max?: number; signal?: AbortSignal } = {}): Promise<Found[]> {
  const j = await call("/search", { query: query.slice(0, 400), max_results: Math.min(10, o.max ?? 5), search_depth: "basic" }, o.signal);
  return ((j.results ?? []) as { title?: string; url?: string; content?: string }[]).filter(x => x.url).map(x => ({ title: String(x.title ?? ""), url: String(x.url), content: String(x.content ?? "").slice(0, 1200) }));
}

/** Read pages: each one's text (at most `PAGE_MAX` characters), or why it could not be read. */
export async function tavilyExtract(urls: string[], signal?: AbortSignal): Promise<{ url: string; text?: string; failed?: string }[]> {
  const j = await call("/extract", { urls: urls.slice(0, 3) }, signal);
  const ok = ((j.results ?? []) as { url?: string; raw_content?: string }[]).map(x => ({ url: String(x.url), text: String(x.raw_content ?? "").slice(0, PAGE_MAX) }));
  const bad = ((j.failed_results ?? []) as { url?: string; error?: string }[]).map(x => ({ url: String(x.url), failed: String(x.error ?? "could not be read") }));
  return [...ok, ...bad];
}

/** The addresses in a text (a person's message), for the pages the model may read. */
export const urlsIn = (text: string): string[] => [...text.matchAll(/https?:\/\/[^\s<>()"'`]+/g)].map(m => m[0].replace(/[.,;:!?]+$/, ""));
