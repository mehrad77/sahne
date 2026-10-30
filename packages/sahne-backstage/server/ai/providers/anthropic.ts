// Claude through the Messages API (Node only): plain fetch to https://api.anthropic.com/v1/messages, the key from the
// environment (ANTHROPIC_API_KEY, never stored), streamed (`stream: true`) so text reaches the editor as it is written,
// with tools and adaptive thinking. A turn's content comes back whole, thinking blocks and their signatures included,
// since the next request of a tool loop must carry them as they were. Refusals and errors are the caller's to show:
// `stop: "refusal"`, or a ProviderError.

import { net, ProviderError, readSse, schemaFor, type Provider, type ToolResult, type Turn, type TurnOptions } from "../provider.ts";

export const API = "https://api.anthropic.com/v1/messages";
/** The models: the strongest for drafting and reviewing, a faster one for a quick ask. */
export const MODELS = { full: "claude-opus-5-5", quick: "claude-sonnet-5-5" } as const;

type Block = { type: string; text?: string; thinking?: string; signature?: string; id?: string; name?: string; input?: unknown; data?: string; [k: string]: unknown };

export function anthropic(model: string = MODELS.full): Provider {
  return {
    id: "anthropic",
    model,
    message: (role, text) => ({ role, content: text }),
    results: (r: ToolResult[]) => [{ role: "user", content: r.map(x => ({
      type: "tool_result", tool_use_id: x.id,
      content: x.images?.length ? [{ type: "text", text: x.text }, ...x.images.map(i => ({ type: "image", source: { type: "base64", media_type: i.mimeType, data: i.data } }))] : x.text,
      ...(x.isError ? { is_error: true } : {}),
    })) }],
    async turn(o: TurnOptions): Promise<Turn> {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new ProviderError(503, "the assistant needs ANTHROPIC_API_KEY in backstage's environment, or a local model in its settings");
      let r: Response;
      try {
        r = await net(API, {
          method: "POST", signal: o.signal,
          headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
          body: JSON.stringify({
            model, max_tokens: o.maxTokens ?? 32000, stream: true, thinking: { type: "adaptive" },
            system: o.system, messages: o.messages,
            tools: o.tools.map(t => ({ name: t.name, description: t.description, input_schema: schemaFor(t.schema) })),
          }),
        });
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        throw new ProviderError(502, `could not reach the API: ${(e as Error).message}`);
      }
      if (!r.ok || !r.body) {
        const body = await r.json().catch(() => ({})) as { error?: { message?: string } };
        const why = body.error?.message ?? r.statusText;
        if (r.status === 401) throw new ProviderError(502, "the API key was refused");
        if (r.status === 429 || r.status === 529) throw new ProviderError(503, `the API is busy, try again in a moment (${why})`);
        throw new ProviderError(502, `the API answered ${r.status}: ${why}`);
      }
      const blocks: Block[] = [], json: string[] = [];
      const usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
      let stop = "", served = model, failed: string | null = null;
      const take = (u: Record<string, unknown> | undefined) => {
        if (!u) return;
        if (typeof u.input_tokens === "number") usage.input = u.input_tokens;
        if (typeof u.output_tokens === "number") usage.output = u.output_tokens; // cumulative: the last one counts
        if (typeof u.cache_read_input_tokens === "number") usage.cacheRead = u.cache_read_input_tokens;
        if (typeof u.cache_creation_input_tokens === "number") usage.cacheWrite = u.cache_creation_input_tokens;
      };
      await readSse(r.body, (_event, data) => {
        let e: Record<string, any>;
        try { e = JSON.parse(data); } catch { return; }
        switch (e.type) {
          case "message_start": take(e.message?.usage); if (e.message?.model) served = e.message.model; break;
          case "content_block_start": {
            const b: Block = { ...e.content_block };
            if (b.type === "tool_use") { json[e.index] = ""; b.input = {}; }
            blocks[e.index] = b;
            break;
          }
          case "content_block_delta": {
            const b = blocks[e.index], d = e.delta ?? {};
            if (!b) break;
            if (d.type === "text_delta") { b.text = (b.text ?? "") + d.text; o.onText(d.text); }
            else if (d.type === "thinking_delta") b.thinking = (b.thinking ?? "") + d.thinking;
            else if (d.type === "signature_delta") b.signature = (b.signature ?? "") + d.signature;
            else if (d.type === "input_json_delta") json[e.index] = (json[e.index] ?? "") + (d.partial_json ?? "");
            break;
          }
          case "content_block_stop": {
            const b = blocks[e.index];
            if (b?.type === "tool_use") {
              const raw = json[e.index] ?? "";
              try { b.input = raw.trim() ? JSON.parse(raw) : {}; } catch { b.input = {}; (b as { _bad?: string })._bad = raw; }
            }
            break;
          }
          case "message_delta": if (e.delta?.stop_reason) stop = e.delta.stop_reason; take(e.usage); break;
          case "error": failed = e.error?.message ?? "the API stopped the answer"; break;
        }
      });
      if (failed) throw new ProviderError(/overload/i.test(failed) ? 503 : 502, `the API stopped: ${failed}`);
      const content = blocks.filter(Boolean);
      const calls = content.filter(b => b.type === "tool_use").map(b => ({ id: String(b.id), name: String(b.name), input: (b.input ?? {}) as Record<string, unknown>, ...((b as { _bad?: string })._bad !== undefined ? { bad: (b as { _bad?: string })._bad } : {}) }));
      for (const b of content) delete (b as { _bad?: string })._bad;
      const text = content.filter(b => b.type === "text").map(b => b.text ?? "").join("");
      const word = stop === "end_turn" || stop === "stop_sequence" ? "end" : stop === "tool_use" ? "tools" : stop || "end";
      return { text, calls, usage, stop: word, message: { role: "assistant", content }, model: served };
    },
  };
}
