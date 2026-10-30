// Any OpenAI-compatible chat completions server (Node only): LM Studio (http://localhost:1234/v1, the default), Ollama
// (http://localhost:11434/v1), llama.cpp's server, or a hosted one. Plain fetch to <base>/chat/completions, streamed, with
// `tools` and `tool_calls`; OPENAI_API_KEY is sent as a bearer token when the environment has one. A local server may
// report no usage: the tokens are then estimated (about four characters a token), so the token caps still bind.

import { estimateTokens, net, ProviderError, readSse, schemaFor, type Provider, type ToolResult, type Turn, type TurnOptions } from "../provider.ts";
import { LOCAL_BASE } from "../../settings.ts";

export function openai(o: { baseUrl?: string; model?: string } = {}): Provider {
  const base = (o.baseUrl ?? LOCAL_BASE).replace(/\/+$/, "");
  const model = o.model ?? "";
  return {
    id: "openai",
    model: model || "local",
    message: (role, text) => ({ role, content: text }),
    results: (r: ToolResult[]) => r.map(x => ({ role: "tool", tool_call_id: x.id, content: `${x.isError ? "Error: " : ""}${x.text}${x.images?.length ? `\n(${x.images.length} picture${x.images.length > 1 ? "s" : ""} not shown: this provider's tool results are text)` : ""}` })),
    async turn(t: TurnOptions): Promise<Turn> {
      const messages = [{ role: "system", content: t.system }, ...t.messages];
      const body = JSON.stringify({
        ...(model ? { model } : {}), stream: true, stream_options: { include_usage: true }, max_tokens: t.maxTokens ?? 8192, messages,
        tools: t.tools.map(x => ({ type: "function", function: { name: x.name, description: x.description, parameters: schemaFor(x.schema) } })),
      });
      const key = process.env.OPENAI_API_KEY;
      let r: Response;
      try {
        r = await net(`${base}/chat/completions`, { method: "POST", signal: t.signal, headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) }, body });
      } catch (e) {
        if ((e as Error).name === "AbortError") throw e;
        throw new ProviderError(502, `could not reach the model server at ${base}: ${(e as Error).message} (is it running?)`);
      }
      if (!r.ok || !r.body) {
        const j = await r.json().catch(() => ({})) as { error?: { message?: string } | string };
        const why = typeof j.error === "string" ? j.error : j.error?.message ?? r.statusText;
        throw new ProviderError(r.status === 429 ? 503 : 502, `the model server answered ${r.status}: ${why}`);
      }
      let text = "", stop = "", served = model || "local", failed: string | null = null;
      let usage: { input: number; output: number } | null = null;
      const calls: { id: string; name: string; args: string }[] = [];
      await readSse(r.body, (_event, data) => {
        if (data.trim() === "[DONE]") return;
        let e: Record<string, any>;
        try { e = JSON.parse(data); } catch { return; }
        if (e.error) { failed = typeof e.error === "string" ? e.error : e.error.message ?? "error"; return; }
        if (typeof e.model === "string" && e.model) served = e.model;
        if (e.usage && typeof e.usage.prompt_tokens === "number") usage = { input: e.usage.prompt_tokens, output: e.usage.completion_tokens ?? 0 };
        const c = e.choices?.[0];
        if (!c) return;
        const d = c.delta ?? {};
        if (typeof d.content === "string" && d.content) { text += d.content; t.onText(d.content); }
        for (const tc of d.tool_calls ?? []) {
          const i = typeof tc.index === "number" ? tc.index : calls.length;
          const cur = (calls[i] ??= { id: "", name: "", args: "" });
          if (tc.id) cur.id = tc.id;
          if (tc.function?.name) cur.name += tc.function.name;
          if (tc.function?.arguments) cur.args += tc.function.arguments;
        }
        if (c.finish_reason) stop = c.finish_reason;
      });
      if (failed) throw new ProviderError(502, `the model server stopped: ${failed}`);
      const list = calls.filter(Boolean).map((c, i) => {
        const id = c.id || `call_${i}`;
        try { return { id, name: c.name, args: c.args, input: (c.args.trim() ? JSON.parse(c.args) : {}) as Record<string, unknown> }; } catch { return { id, name: c.name, args: c.args, input: {}, bad: c.args }; }
      });
      const message = { role: "assistant", content: text || null, ...(list.length ? { tool_calls: list.map(c => ({ id: c.id, type: "function", function: { name: c.name, arguments: c.args || "{}" } })) } : {}) };
      const u = usage ?? { input: estimateTokens(body), output: estimateTokens(text + list.map(c => c.args).join("")) };
      // tool calls are known by their presence (some servers finish them with "stop"), unless the answer was cut off
      const word = stop === "length" ? "max_tokens" : stop === "content_filter" ? "refusal" : list.length ? "tools" : "end";
      return { text, calls: list.map(({ args: _a, ...c }) => c), usage: u, stop: word, message, model: served };
    },
  };
}
