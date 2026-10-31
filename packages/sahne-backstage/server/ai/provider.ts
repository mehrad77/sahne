// What the assistant (assistant.ts) needs of a model provider (Node only): one streamed turn with tools, and the messages
// a conversation is made of in the provider's own shape. Two providers: Anthropic's Messages API (providers/anthropic.ts)
// and any OpenAI-compatible chat completions server (providers/openai.ts: LM Studio, Ollama, llama.cpp). Plain fetch,
// stubbed by the tests (`setFetch`), and a small Server-Sent Events reader both use.

import type { Usage } from "./budget.ts";

export interface Picture { name: string; mediaType: string; data: string }
export interface ToolDef { name: string; description: string; schema: Record<string, unknown> }
export interface Call { id: string; name: string; input: Record<string, unknown>; bad?: string }
/** A tool's answer: its text, and any pictures (base64 PNG) a provider that can see sends on beside it. */
export interface ToolResult { id: string; name: string; text: string; isError: boolean; images?: { data: string; mimeType: string }[] }

export interface Turn {
  text: string;
  calls: Call[];
  usage: Usage;
  /** end, tools, max_tokens, refusal, or the provider's own word. */
  stop: string;
  /** The assistant's message, to append to the conversation as it came (thinking blocks included). */
  message: unknown;
  model: string;
}

export interface TurnOptions { system: string; messages: unknown[]; tools: ToolDef[]; onText: (t: string) => void; /** The model's thinking as it streams, where the provider gives it. */ onThinking?: (t: string) => void; /** Tools the provider runs itself (Anthropic's web search and fetch), as its API takes them. */ serverTools?: unknown[]; signal?: AbortSignal; maxTokens?: number }

export interface Provider {
  id: "anthropic" | "openai";
  model: string;
  turn(o: TurnOptions): Promise<Turn>;
  /** A plain message of the conversation. */
  message(role: "user" | "assistant", text: string): unknown;
  /** The person's message with pictures they attached (PNG, JPEG, WebP or GIF, base64). */
  withPictures(text: string, pictures: Picture[]): unknown;
  /** The messages that answer a turn's tool calls. */
  results(r: ToolResult[]): unknown[];
}

export class ProviderError extends Error {
  readonly status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

type Fetch = typeof fetch;
let fetcher: Fetch = (...a) => fetch(...a);
/** Tests stub the network. */
export const setFetch = (f: Fetch) => { fetcher = f; };
export const net: Fetch = (...a) => fetcher(...a);

/** A JSON Schema as a provider takes it: no `$schema`. */
export function schemaFor(s: Record<string, unknown>): Record<string, unknown> {
  const { $schema: _drop, ...rest } = s;
  return { type: "object", properties: {}, ...rest };
}

/** Read a Server-Sent Events body: each event's name (or "message") and its data. */
export async function readSse(body: ReadableStream<Uint8Array>, on: (event: string, data: string) => void): Promise<void> {
  const reader = body.getReader(), dec = new TextDecoder();
  let buf = "";
  const flush = (block: string) => {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith(":")) continue;
      const i = line.indexOf(":"), k = i < 0 ? line : line.slice(0, i), v = i < 0 ? "" : line.slice(i + 1).replace(/^ /, "");
      if (k === "event") event = v; else if (k === "data") data.push(v);
    }
    if (data.length) on(event, data.join("\n"));
  };
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
      const m = /\r?\n\r?\n/.exec(buf.slice(i))!;
      flush(buf.slice(0, i));
      buf = buf.slice(i + m[0].length);
    }
  }
  if (buf.trim()) flush(buf);
}

/** About four characters a token: for a server that reports no usage, so the token caps still bind. */
export const estimateTokens = (s: string) => Math.ceil(s.length / 4);
