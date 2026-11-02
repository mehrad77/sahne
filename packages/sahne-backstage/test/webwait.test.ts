// Tavily (server/ai/web.ts) times out even when the caller passes its own stop signal, as an agent graph always does; the
// caller's stop still ends a call at once.

import { test } from "node:test";
import assert from "node:assert/strict";
import { setFetch } from "../server/ai/provider.ts";
import { tavilySearch } from "../server/ai/web.ts";

process.env.TAVILY_API_KEY = "tvly-test";
// a server that never answers, but hears the request's signal
setFetch(((_u: unknown, init?: { signal?: AbortSignal }) => new Promise((_res, rej) => { init?.signal?.addEventListener("abort", () => rej(init.signal!.reason)); })) as typeof fetch);

test("a Tavily call times out with the caller's signal as well as without", async () => {
  await assert.rejects(tavilySearch("simit", { wait: 50 }), /Tavily did not answer in time/);
  await assert.rejects(tavilySearch("simit", { wait: 50, signal: new AbortController().signal }), /Tavily did not answer in time/);
});

test("the caller's stop ends a call at once, as a stop", async () => {
  const stop = new AbortController();
  const p = tavilySearch("simit", { wait: 60_000, signal: stop.signal });
  stop.abort();
  await assert.rejects(p, (e: Error) => e.name === "AbortError");
});
