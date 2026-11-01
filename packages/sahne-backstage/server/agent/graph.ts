// One agent as a LangGraph graph (Node only): the editor's assistant runs on it, and so will each step of a run. Three
// nodes: `model` streams one turn of the model (its text and thinking go out as they come, through the graph's writer),
// `tools` runs the turn's tool calls, and `ask` puts ask_person to the person, by itself, so that answering it never runs
// an edit twice. A turn is appended exactly as the model sent it (Claude signs its thinking against everything before it,
// and the request is cached), and nothing earlier is ever rewritten. What the agent does beyond the graph (the caps, the
// cost, its tools, how it asks) is the caller's: `Agent`.

import { Annotation, END, interrupt, MessagesAnnotation, START, StateGraph } from "@langchain/langgraph";
import type { BaseCheckpointSaver, LangGraphRunnableConfig } from "@langchain/langgraph";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type AIMessageChunk, type BaseMessage } from "@langchain/core/messages";
import type { AssistantEvent } from "../assistant.ts";
import type { Usage } from "../ai/budget.ts";
import { thinkSplitter, type Model } from "../ai/models.ts";
import { estimateTokens, ProviderError, type Picture, type ToolDef } from "../ai/provider.ts";

export interface Call { id: string; name: string; input: Record<string, unknown> }
/** What a tool answered: its text, any pictures (base64), and what the editor is told after its result (a proposal, a card). */
export interface Outcome { text: string; isError: boolean; images?: { data: string; mimeType: string }[]; summary?: string; detail?: string; after?: AssistantEvent[]; /** The agent's work is over (a step's finish_step): no more turns. */ end?: boolean }

export interface Agent {
  model: Model;
  system: string;
  tools: ToolDef[];
  /** The most rounds of tools, after which it stops and says so. */
  maxTurns: number;
  /** Before each model call: throws at a cap (budget.ts guard), or when the person paused the work. */
  before(): void;
  /** What the person said while it works, taken before each model call and read as their message (a task's step). */
  inbox?(): string[];
  /** After each: what it used, to log and price. */
  after(u: Usage): void;
  /** One call of any tool but ask_person. */
  run(c: Call, signal?: AbortSignal): Promise<Outcome>;
  /** ask_person: "end" ends the turn on a card, the click being the person's next message (the chat); "wait" waits for the answer (a run). */
  ask: "end" | "wait";
}

export const State = Annotation.Root({
  ...MessagesAnnotation.spec,
  turns: Annotation<number>({ reducer: (_a, b) => b, default: () => 0 }),
  /** Why it stopped before the model was done: a cap of rounds, a refusal, a cut-off answer, a question asked. */
  stopped: Annotation<string | null>({ reducer: (_a, b) => b, default: () => null }),
});
type S = typeof State.State;

const DETAIL = 4000;
const summaryOf = (t: string) => t.split("\n")[0].slice(0, 240);
const detailOf = (t: string) => (t.length > DETAIL ? `${t.slice(0, DETAIL)}\n…` : t);
const strs = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, n) : []);

/** The person's message, with any pictures they attached (as text notes to a model that does not see). */
export function personSays(m: Model, text: string, pictures?: Picture[]): BaseMessage {
  if (!pictures?.length) return new HumanMessage(text);
  if (!m.pictures) return new HumanMessage(`${text}\n\n(${pictures.length} picture${pictures.length > 1 ? "s" : ""} attached, not shown: this model takes text only: ${pictures.map(p => p.name).join(", ")})`);
  return new HumanMessage({ content: [...pictures.map(p => ({ type: "image" as const, mimeType: p.mediaType, data: p.data })), { type: "text" as const, text }] });
}

/** A tool's answer as the model reads it. */
function answer(m: Model, id: string, o: Outcome): ToolMessage {
  const status = o.isError ? "error" as const : "success" as const;
  if (!m.pictures) return new ToolMessage({ tool_call_id: id, status, content: `${o.isError ? "Error: " : ""}${o.text}${o.images?.length ? `\n(${o.images.length} picture${o.images.length > 1 ? "s" : ""} not shown: this model's tool results are text)` : ""}` });
  if (!o.images?.length) return new ToolMessage({ tool_call_id: id, status, content: o.text });
  return new ToolMessage({ tool_call_id: id, status, content: [{ type: "text", text: o.text }, ...o.images.map(i => ({ type: "image" as const, mimeType: i.mimeType, data: i.data }))] });
}

const lastTurn = (s: S) => s.messages.findLast(x => x.getType() === "ai") as AIMessage | undefined;
const asked = (t?: AIMessage) => t?.tool_calls?.find(c => c.name === "ask_person");

export function agentGraph(a: Agent, checkpointer?: BaseCheckpointSaver) {
  const emit = (config: LangGraphRunnableConfig, e: AssistantEvent) => config.writer?.(e);

  async function model(s: S, config: LangGraphRunnableConfig) {
    if (s.turns >= a.maxTurns) {
      emit(config, { type: "error", message: `stopped after ${a.maxTurns} rounds of tools: ask for less at a time` });
      return { stopped: "limit" };
    }
    a.before();
    const told = (a.inbox?.() ?? []).map(t => new HumanMessage(`The person says, while you work: ${t}`));
    for (const m of told) emit(config, { type: "text", text: `\n\n> **You said:** ${String(m.content).replace(/^The person says, while you work: /, "")}\n\n` });
    const bound = a.model.chat.bindTools!(a.model.tools(a.tools));
    const say = (text: string) => emit(config, { type: "text", text }), think = (text: string) => emit(config, { type: "thinking", text });
    // a local reasoning model may write its thinking into the text, between <think> tags
    const split = a.model.id === "openai" ? thinkSplitter(say, think) : null;
    const input = [new SystemMessage(a.system), ...s.messages, ...told];
    let full: AIMessageChunk | undefined;
    for await (const ch of await bound.stream(input, { signal: config.signal })) {
      full = full ? full.concat(ch) : ch;
      const reasoning = ch.additional_kwargs?.reasoning_content;
      if (typeof reasoning === "string" && reasoning) think(reasoning);
      if (typeof ch.content === "string") { if (ch.content) (split ? split.push(ch.content) : say(ch.content)); continue; }
      for (const b of ch.content as { type: string; text?: string; thinking?: string }[]) {
        if (b.type === "text" && b.text) (split ? split.push(b.text) : say(b.text));
        else if (b.type === "thinking" && b.thinking) think(b.thinking);
      }
    }
    split?.end();
    if (!full) throw new ProviderError(502, "the model sent no answer");
    const u = full.usage_metadata, details = u?.input_token_details ?? {};
    const cacheRead = details.cache_read ?? 0, cacheWrite = details.cache_creation ?? 0;
    const text = typeof full.content === "string" ? full.content : full.text;
    a.after(u ? { input: u.input_tokens - cacheRead - cacheWrite, output: u.output_tokens, cacheRead, cacheWrite }
      : { input: estimateTokens(JSON.stringify(input.map(m => m.content))), output: estimateTokens(text + JSON.stringify(full.tool_call_chunks ?? [])) });
    const stop = String(full.additional_kwargs?.stop_reason ?? full.response_metadata?.finish_reason ?? "");
    const calls = (full.tool_calls?.length ?? 0) + (full.invalid_tool_calls?.length ?? 0);
    if (stop === "refusal" || stop === "content_filter") { emit(config, { type: "error", message: "the model declined this request" }); return { stopped: "refusal" }; }
    if (stop === "max_tokens" || stop === "length") {
      emit(config, { type: "error", message: calls ? "the answer was cut off in the middle of a tool call: ask for less at a time" : "the answer was cut off (too long)" });
      return { stopped: "cut" };
    }
    // kept as a whole message, its content as the model sent it
    const turn = new AIMessage({ content: full.content, tool_calls: full.tool_calls, invalid_tool_calls: full.invalid_tool_calls, additional_kwargs: full.additional_kwargs, response_metadata: full.response_metadata, usage_metadata: full.usage_metadata, ...(full.id ? { id: full.id } : {}) });
    return { messages: [...told, turn], turns: s.turns + 1 };
  }

  async function tools(s: S, config: LangGraphRunnableConfig) {
    const t = lastTurn(s)!, out: ToolMessage[] = [];
    let end = false;
    for (const c of t.tool_calls ?? []) {
      if (c.name === "ask_person") continue;
      // stopped: no further tool runs (in direct mode one would save)
      if (config.signal?.aborted) throw Object.assign(new Error("stopped"), { name: "AbortError" });
      const call = { id: c.id!, name: c.name, input: c.args as Record<string, unknown> };
      emit(config, { type: "tool", id: call.id, name: call.name, input: call.input });
      const t0 = Date.now(), o = await a.run(call, config.signal);
      emit(config, { type: "tool_result", id: call.id, name: call.name, ok: !o.isError, summary: o.summary ?? summaryOf(o.text), detail: o.detail ?? detailOf(o.text), ms: Date.now() - t0 });
      for (const e of o.after ?? []) emit(config, e);
      out.push(answer(a.model, call.id, o));
      if (o.end) end = true;
    }
    for (const c of t.invalid_tool_calls ?? []) {
      const id = c.id ?? `bad_${out.length}`, name = c.name ?? "?", raw = String(c.args ?? "");
      emit(config, { type: "tool", id, name, input: {} });
      emit(config, { type: "tool_result", id, name, ok: false, summary: "the call's input was not valid JSON", detail: raw.slice(0, DETAIL), ms: 0 });
      out.push(answer(a.model, id, { text: JSON.stringify({ INVALID_JSON: raw }), isError: true }));
    }
    return end ? { messages: out, stopped: "finished" } : { messages: out };
  }

  async function ask(s: S, config: LangGraphRunnableConfig) {
    const c = asked(lastTurn(s))!, i = c.args as { question?: unknown; options?: unknown; save?: unknown };
    const card = { question: String(i.question ?? "").slice(0, 500), options: strs(i.options, 6), save: strs(i.save, 20) };
    const shown = { type: "ask" as const, question: card.question, ...(card.options.length ? { options: card.options } : {}), ...(card.save.length ? { save: card.save } : {}) };
    if (a.ask === "end") {
      emit(config, { type: "tool", id: c.id!, name: c.name, input: c.args });
      emit(config, shown);
      emit(config, { type: "tool_result", id: c.id!, name: c.name, ok: true, summary: "asked", detail: "", ms: 0 });
      return { messages: [answer(a.model, c.id!, { text: "Asked. The person's answer comes as their next message: end your turn now.", isError: false })], stopped: "asked" };
    }
    // a run: the step waits here for the answer (the node starts again from its top when it comes)
    const reply = interrupt(shown);
    return { messages: [answer(a.model, c.id!, { text: `The person answered: ${String(reply)}`, isError: false })] };
  }

  return new StateGraph(State)
    .addNode("model", model)
    .addNode("tools", tools)
    .addNode("ask", ask)
    .addEdge(START, "model")
    .addConditionalEdges("model", s => (s.stopped || !(lastTurn(s)?.tool_calls?.length || lastTurn(s)?.invalid_tool_calls?.length) ? END : (lastTurn(s)!.tool_calls ?? []).some(c => c.name !== "ask_person") || lastTurn(s)!.invalid_tool_calls?.length ? "tools" : "ask"), ["tools", "ask", END])
    .addConditionalEdges("tools", s => (s.stopped ? END : asked(lastTurn(s)) ? "ask" : "model"), ["ask", "model", END])
    .addConditionalEdges("ask", s => (s.stopped ? END : "model"), ["model", END])
    .compile(checkpointer ? { checkpointer } : {});
}
