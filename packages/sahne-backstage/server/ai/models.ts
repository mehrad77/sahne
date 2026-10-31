// The assistant's models (Node only), as LangChain chat models: Claude through `ChatAnthropic` (the key from the
// environment, ANTHROPIC_API_KEY, never stored), or any OpenAI-compatible chat completions server through `ChatOpenAI`
// (LM Studio, the default at http://localhost:1234/v1; Ollama; llama.cpp; OPENAI_API_KEY sent when the environment has
// one). Claude streams with adaptive thinking, its summary shown (`display: "summarized"`, since the current models leave it
// out by default), and the request cached (one top-level `cache_control`). Both go through `net` (provider.ts), so the tests
// stub the network; a stubbed network is never retried. `localModels` lists a local server's models for the editor's picker,
// and `thinkSplitter` takes a local reasoning model's <think>…</think> out of its answer.

import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { net, retries, schemaFor, type ToolDef } from "./provider.ts";
import { LOCAL_BASE, type Settings } from "../settings.ts";

/** The models: the strongest for drafting and reviewing, a faster one for a quick ask. */
export const MODELS = { full: "claude-opus-5-5", quick: "claude-sonnet-5-5" } as const;

export interface Model {
  id: "anthropic" | "openai";
  /** The model's id, as priced and logged ("local" for a local server's loaded one). */
  model: string;
  chat: BaseChatModel;
  /** Whether pictures go to it (Claude); a local model's messages and tool results are text. */
  pictures: boolean;
  /** The tools as this provider's API takes them, for `bindTools`. */
  tools(defs: ToolDef[]): Record<string, unknown>[];
}

export function claude(model: string = MODELS.full, maxTokens = 32000): Model {
  const chat = new ChatAnthropic({
    model, maxTokens, streaming: true, maxRetries: retries(),
    thinking: { type: "adaptive", display: "summarized" } as never,
    invocationKwargs: { cache_control: { type: "ephemeral" } },
    clientOptions: { fetch: net, maxRetries: 0 },
  });
  return { id: "anthropic", model, chat, pictures: true, tools: defs => defs.map(t => ({ name: t.name, description: t.description, input_schema: schemaFor(t.schema) })) };
}

export function local(o: { baseUrl?: string; model?: string } = {}, maxTokens = 8192): Model {
  const baseURL = (o.baseUrl ?? LOCAL_BASE).replace(/\/+$/, "");
  const chat = new ChatOpenAI({
    model: o.model || "local", maxTokens, streaming: true, streamUsage: true, maxRetries: retries(),
    apiKey: process.env.OPENAI_API_KEY || "local",
    configuration: { baseURL, fetch: net, maxRetries: 0 },
  });
  return { id: "openai", model: o.model || "local", chat, pictures: false, tools: defs => defs.map(t => ({ type: "function", function: { name: t.name, description: t.description, parameters: schemaFor(t.schema) } })) };
}

/** The model the settings name, for this ask. */
export function modelFor(s: Settings, quick = false): Model {
  if (s.provider === "openai") return local({ baseUrl: s.baseUrl, model: s.model });
  return claude(quick ? MODELS.quick : s.model ?? MODELS.full, quick ? 16000 : 32000);
}

/** A model the server can run: its id, and on LM Studio whether it is loaded and how long a context it takes. */
export interface LocalModel { id: string; loaded?: boolean; context?: number; kind?: string }

/**
 * The models of the server at `baseUrl` that can chat: LM Studio's own list (every downloaded model, loaded or not, the
 * embedding ones left out) when it answers, else the OpenAI-compatible `/models`. Nothing when the server is down.
 */
export async function localModels(baseUrl: string = LOCAL_BASE): Promise<LocalModel[]> {
  const base = baseUrl.replace(/\/+$/, "");
  const get = async (u: string) => { try { const r = await fetch(u, { signal: AbortSignal.timeout(2500) }); return r.ok ? await r.json() as { data?: Record<string, unknown>[] } : null; } catch { return null; } };
  const lms = await get(`${base.replace(/\/v1$/, "")}/api/v0/models`);
  if (lms?.data) return lms.data.filter(m => m.type !== "embeddings").map(m => ({ id: String(m.id), loaded: m.state === "loaded", ...(typeof m.max_context_length === "number" ? { context: m.max_context_length } : {}), ...(typeof m.type === "string" ? { kind: m.type } : {}) }));
  const plain = await get(`${base}/models`);
  return (plain?.data ?? []).map(m => ({ id: String(m.id) })).filter(m => !/embed/i.test(m.id));
}

/**
 * Text with <think>…</think> in it, split as it streams: the thinking to `thinking`, the rest to `text`. A tag cut across
 * two chunks is held back until the next one says what it is.
 */
export function thinkSplitter(text: (s: string) => void, thinking: (s: string) => void) {
  let inside = false, held = "";
  const emit = (s: string) => { if (s) (inside ? thinking : text)(s); };
  return {
    push(chunk: string) {
      let s = held + chunk;
      held = "";
      for (;;) {
        const tag = inside ? "</think>" : "<think>", i = s.indexOf(tag);
        if (i >= 0) { emit(s.slice(0, i)); s = s.slice(i + tag.length); inside = !inside; continue; }
        // the end may be the start of a tag: keep it for the next chunk
        let keep = 0;
        for (let n = Math.min(tag.length - 1, s.length); n > 0; n--) if (tag.startsWith(s.slice(-n))) { keep = n; break; }
        emit(s.slice(0, s.length - keep));
        held = s.slice(s.length - keep);
        return;
      }
    },
    end() { emit(held); held = ""; },
  };
}
