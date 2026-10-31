// The editor's assistant (Node only): an agent loop over a model provider (ai/provider.ts) that reaches backstage only as
// an MCP client of its own server (mcp.ts) over an in-memory transport, so it can do exactly what any agent can, through
// the same tools and checks. Its edits follow the agent-edits mode (the settings', else the server's; proposals by
// default), made `by: "assistant"`. The system prompt is built from the series: its title, its languages, its narrator
// and stand-in, and a summary of the format; nothing in it is any one language's.
//
// `POST /api/assistant` streams what happens as Server-Sent Events, each `data` a JSON object with its `type`:
//   text { text } · thinking { text } (the model's thinking, as it streams, where the provider gives it)
//   tool { id, name, input } · tool_result { id, name, ok, summary, detail, ms } (detail: the result, capped) · proposal { id }
//   ask { question, options?, save?, review? }   a card for the person: buttons that answer, proposals to accept and
//     save at once, or a review status to set; the answer comes as their next message (ask_person, set_review)
//   confirm { estimateUsd, why }   a big ask (drafting or reviewing a season): nothing ran; re-send with confirm: true
//   done { usage: { input, output, usd } } · error { message }
// `fresh: true` is the second reader: a new conversation of the last message alone, never given the drafting history.
// Every model call is checked against the caps first and logged after (ai/budget.ts), with a `usage` event to the editors.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { allLanguages, dirOf, languagesOf, seasonOf, textOf, type SeriesDoc } from "../../sahne-story/src/index.ts";
import { abilities } from "../src/model/abilities.ts";
import { listing } from "./content.ts";
import { createMcp, type AgentEdits, type McpOptions } from "./mcp.ts";
import type { Events } from "./events.ts";
import { readiness, readSettings, type Caps, type Settings } from "./settings.ts";
import { BudgetError, costOf, guard, record, totals, type Usage } from "./ai/budget.ts";
import { ProviderError, type Provider, type ToolDef } from "./ai/provider.ts";
import { anthropic, MODELS } from "./ai/providers/anthropic.ts";
import { openai } from "./ai/providers/openai.ts";

export interface AssistantContext { page: string; kind?: string; id?: string; path?: (string | number)[] }
export interface AssistantRequest { messages: { role: "user" | "assistant"; content: string }[]; context?: AssistantContext; fresh?: boolean; confirm?: boolean; quick?: boolean }
export type AssistantEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; ok: boolean; summary: string; detail: string; ms: number }
  | { type: "proposal"; id: string }
  | { type: "ask"; question: string; options?: string[]; save?: string[]; review?: { id: string; status: string } }
  | { type: "confirm"; estimateUsd: number; why: string }
  | { type: "done"; usage: { input: number; output: number; usd: number } }
  | { type: "error"; message: string };

export interface AssistantOptions {
  write: boolean;
  agentEdits: AgentEdits;
  shareCards: boolean;
  events: Events;
  /** Default: the person's settings (settings.ts). */
  settings?: Settings;
  /** Default: the settings' provider. */
  provider?: Provider;
  signal?: AbortSignal;
  /** Told of every tool call (agents.ts). */
  onCall?: McpOptions["onCall"];
}

/**
 * The assistant's own tools, beside backstage's (they need the conversation, so no other agent has them). ask_person
 * shows the person a card and ends the turn: their click is their next message.
 */
const OWN: ToolDef[] = [
  { name: "ask_person", description: "Ask the person to choose, with buttons, and end your turn: their click comes back as their next message. Use it for a real choice (two titles, which week, whether to go on), not for something you can decide. With save: the ids of your proposals, and the card offers to accept and save them at once.", schema: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" }, maxItems: 6, description: "The answers, as short as a button" }, save: { type: "array", items: { type: "string" }, description: "Proposal ids to offer to accept and save" } }, required: ["question"] } },
];

/** The longest tool loop of one ask. */
const MAX_TURNS = 40;

/** A request from the editor's JSON, checked; a string saying what is wrong otherwise. */
export function requestOf(v: unknown): AssistantRequest | string {
  const b = v as Partial<AssistantRequest>;
  if (!b || !Array.isArray(b.messages) || !b.messages.length) return "expected { messages: [{ role, content }], context?, fresh?, confirm?, quick? }";
  // an answer that was only tools, or stopped before a word, has nothing to send again
  const messages = b.messages.map(m => ({ role: m?.role, content: m?.content })).filter(m => !(m.role === "assistant" && typeof m.content === "string" && !m.content.trim()));
  if (!messages.length) return "expected { messages: [{ role, content }], context?, fresh?, confirm?, quick? }";
  if (messages.some(m => (m.role !== "user" && m.role !== "assistant") || typeof m.content !== "string" || !m.content.trim())) return "each message is { role: \"user\" | \"assistant\", content: text }";
  if (messages.at(-1)!.role !== "user") return "the last message is the person's";
  const c = b.context as Partial<AssistantContext> | undefined;
  const context = c && typeof c.page === "string" ? { page: c.page.slice(0, 200), ...(typeof c.kind === "string" ? { kind: c.kind } : {}), ...(typeof c.id === "string" ? { id: c.id } : {}), ...(Array.isArray(c.path) ? { path: c.path.filter(k => typeof k === "string" || typeof k === "number").slice(0, 20) } : {}) } : undefined;
  return { messages: messages as AssistantRequest["messages"], ...(context ? { context } : {}), fresh: b.fresh === true, confirm: b.confirm === true, quick: b.quick === true };
}

/** The provider the settings name, with the model for this ask. */
export function providerFor(s: Settings, quick = false): Provider {
  if (s.provider === "openai") return openai({ baseUrl: s.baseUrl, model: s.model });
  return anthropic(quick ? MODELS.quick : s.model ?? MODELS.full);
}

/** Today's and this month's spending with the caps: the `usage` event and GET /api/usage. */
export const usageSummary = (caps: Caps) => ({ ...totals(), caps });

const language = (code: string) => { try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; } };

/** The system prompt: the series, its languages, its narrator and stand-in, the format, and how edits are made. */
export function systemPrompt(o: { agentEdits: AgentEdits; writable: boolean; shareCards?: boolean; fresh?: boolean; context?: AssistantContext }): string {
  const w = listing(), series = (w.series ?? null) as SeriesDoc | null, l = languagesOf(series);
  const name = (id?: string) => (id && w.characters[id] ? textOf(w.characters[id].name, l.main) ?? id : id ?? "?");
  const rtl = allLanguages(l).filter(x => dirOf(x) === "rtl");
  const ab = abilities({ writable: o.writable, agentEdits: o.agentEdits, shareCards: o.shareCards, cards: !!w.cards, page: o.context?.page });
  const parts = [
    `You are the assistant in Backstage, the editor of ${series ? `the series "${textOf(series.title, l.main, ...l.translations) ?? series.id}"` : "a series"}: short language-learning scenes played on a paper-theatre stage, read by people who are learning ${language(l.main)} (${l.main}).`,
    `Every line is written in ${language(l.main)}, at the episode's level: short, natural, everyday. Each line also carries its translations, in ${l.translations.map(x => `${language(x)} (${x})`).join(", ") || "no other language"}, which say the same thing as naturally as a person would${rtl.length ? `; ${rtl.join(", ")} ${rtl.length > 1 ? "are" : "is"} written right to left` : ""}.`,
    `The narrator is ${name(series?.narrator)} (id ${series?.narrator ?? "?"}). The stand-in, ${name(series?.standin)} (id ${series?.standin ?? "?"}), is the learner's own character on stage: give them no nationality, language or story the series does not.`,
    `The format: an episode is a story document. Its steps are scenes ({ scene: place, at: { who: mark }, time }), lines ({ who, the texts by language code, and staging: to, emo, do, at, move, obj, cam, sfx … }), choices (the stand-in's options, each a line, with replies), spots (a grammar note on one line), acts (the learner taps or drags something) and beats. An episode's words are word-card ids, its lessons grammar lesson ids. A path names a place in it: steps/3, steps/12/choice/options/0/reply/1, quiz/0, title.`,
    `Work with the tools: read with read_episode and read_step, look names up with kit_search before you stage anything, and check with check_episode. To draw a missing set piece or prop, read the sahne://kit-guide resource, kit_read a neighbour, draft it with draft_kit_item and look at its sheet before you save_kit_item. Keep every id, character id and mark as it is; ids are permanent.`,
    !o.writable ? "Backstage is read-only now: you can read, check and advise, not edit."
      : o.agentEdits === "proposals" ? "Your edits are proposals: each is checked and shown to the person in the editor, who accepts or rejects it, and nothing is saved until they do. Say briefly what you proposed and why."
        : "Your edits are saved at once, each after the same check a person's save passes. Say briefly what you changed.",
    `What you can do:\n${ab.can.map(x => `- ${x}`).join("\n")}\nWhat you cannot do:\n${ab.cannot.map(x => `- ${x}`).join("\n")}\nWhen the person asks for something you cannot do, say so plainly in one sentence and where in the editor they can do it themselves; never write as if you did it, and never promise to do it later. When a tool refuses, say what was refused and why in plain words.`,
    "A new document you propose (an episode, a season, a place, a character) exists only as your proposal until the person accepts it: you can read it and keep editing it, and every edit builds on your proposal. Tell the person to open it to accept or reject it. Pick a new episode's week from the season's arc weeks (series_overview); a week without a theme gets one with set_week_theme. Before you change or take away a place's mark or prop, or a character, see where it is used (find_uses).",
    "An edit that brings a new error is refused with the problems: fix them and try again. Answer briefly, in the language the person writes to you in.",
    "The person sees each tool you call. Before a batch of tools, say in one short sentence what you are about to do; after the last one, give your answer.",
  ];
  if (o.fresh) parts.push("You are a second reader. You did not write this episode and have not seen how it was drafted. Read it fresh, as a careful reviewer would, and report what must be fixed: wrong or unnatural words, words above the level, translations that do not say what the line says, lines that do not fit the scene, quiz answers that do not hold, staging that contradicts the words. Leave a comment on each step that needs one; change nothing unless you are asked to.");
  const c = o.context;
  if (c) parts.push(`The editor shows the page "${c.page}"${c.kind && c.id ? `, ${c.kind} ${c.id}` : ""}${c.path?.length ? `, at ${c.path.join("/")}` : ""}. "This" in the person's words means what is shown.`);
  return parts.join("\n\n");
}

/** A big ask (drafting or reviewing a whole season, or every episode) and what it may cost; null for an ordinary one. */
export function estimate(req: AssistantRequest, p: Provider): { usd: number; tokens: number; why: string } | null {
  const text = req.messages.at(-1)!.content;
  if (!/\b(draft|write|review|check|proofread|translate|rewrite|go through)\b/i.test(text)) return null;
  if (!/\b(season|series)\b|\b(all|every|each)\b[^.?!]*\bepisodes?\b|\bepisodes\b/i.test(text)) return null;
  const eps = listing().episodes;
  const m = /\bs(\d+)\b|\bseason\s+(\d+)\b/i.exec(text);
  const ctxSeason = req.context?.kind === "season" && req.context.id ? Number(req.context.id.slice(1)) : req.context?.kind === "story" && req.context.id ? seasonOf(req.context.id) : 0;
  const n = m ? Number(m[1] ?? m[2]) : ctxSeason;
  const count = Math.max(1, (n ? eps.filter(e => seasonOf(e.id) === n) : eps).length);
  const u: Usage = { input: count * 40_000, output: count * 8_000 };
  return { usd: costOf(p.id, p.model, u), tokens: u.input + u.output, why: `${/draft|write/i.test(text) ? "drafting" : "reviewing"} ${count} episode${count > 1 ? "s" : ""}${n ? ` of season ${n}` : ""} reads and writes about ${Math.round((u.input + u.output) / 1000)}k tokens on ${p.model}` };
}

const summaryOf = (texts: string[]) => (texts[0] ?? "").split("\n")[0].slice(0, 240);
/** How much of a tool's result the editor gets, to show when a call is opened. */
const DETAIL = 4000;
const detailOf = (texts: string[]) => { const t = texts.join("\n\n"); return t.length > DETAIL ? `${t.slice(0, DETAIL)}\n…` : t; };

/** Run one ask, sending what happens. Never throws: a failure is an `error` event. */
export async function runAssistant(req: AssistantRequest, send: (e: AssistantEvent) => void, o: AssistantOptions): Promise<void> {
  const s = o.settings ?? readSettings();
  const total = { input: 0, output: 0, usd: 0 };
  let client: Client | null = null;
  try {
    const ready = readiness(s);
    if (!o.provider && !ready.ready) { send({ type: "error", message: `the assistant is off: ${ready.why}` }); return; }
    const p = o.provider ?? providerFor(s, req.quick);
    if (!req.confirm) {
      const est = estimate(req, p);
      const t = totals(), left = s.caps.dayTokens !== undefined ? s.caps.dayTokens - t.today.tokens : Infinity;
      if (est && (est.usd > (s.confirmOverUsd ?? 0.5) || est.tokens > left)) {
        send({ type: "confirm", estimateUsd: Math.round(est.usd * 100) / 100, why: `${est.why}${est.tokens > left ? `, more than the ${left} tokens left today` : ""}` });
        return;
      }
    }
    guard(s.caps);
    const agentEdits = s.agentEdits ?? o.agentEdits;
    const server = createMcp({ write: o.write, agentEdits, shareCards: o.shareCards, events: o.events, by: "assistant", onCall: o.onCall });
    const [a, b] = InMemoryTransport.createLinkedPair();
    client = new Client({ name: "assistant", version: "0.1.0" });
    await Promise.all([server.connect(a), client.connect(b)]);
    const tools: ToolDef[] = (await client.listTools()).tools.map(t => ({ name: t.name, description: t.description ?? "", schema: t.inputSchema as Record<string, unknown> })).concat(OWN);
    const writable = !!JSON.parse(((await client.callTool({ name: "series_overview", arguments: {} })).content as { text: string }[]).at(-1)!.text).writable;
    const system = systemPrompt({ agentEdits, writable, shareCards: o.shareCards, fresh: req.fresh, context: req.context });
    const history = req.fresh ? [req.messages.at(-1)!] : req.messages;
    const messages: unknown[] = history.map(m => p.message(m.role, m.content));
    for (let turn = 0; ; turn++) {
      if (turn >= MAX_TURNS) { send({ type: "error", message: `stopped after ${MAX_TURNS} rounds of tools: ask for less at a time` }); return; }
      guard(s.caps);
      const r = await p.turn({ system, messages, tools, signal: o.signal, maxTokens: req.quick ? 16000 : 32000, onText: text => send({ type: "text", text }), onThinking: text => send({ type: "thinking", text }) });
      const e = record(p.id, p.model, r.usage);
      total.input += r.usage.input + (r.usage.cacheRead ?? 0) + (r.usage.cacheWrite ?? 0); total.output += r.usage.output; total.usd += e.usd;
      o.events.emit("usage", usageSummary(s.caps));
      if (r.stop === "refusal") { send({ type: "error", message: "the model declined this request" }); return; }
      if (r.stop === "max_tokens") { send({ type: "error", message: r.calls.length ? "the answer was cut off in the middle of a tool call: ask for less at a time" : "the answer was cut off (too long)" }); return; }
      messages.push(r.message);
      if (!r.calls.length) break;
      const results = [];
      let asked = false;
      for (const c of r.calls) {
        // stopped: no further tool runs (in direct mode one would save)
        if (o.signal?.aborted) return;
        send({ type: "tool", id: c.id, name: c.name, input: c.input });
        const t0 = Date.now();
        if (c.bad !== undefined) {
          results.push({ id: c.id, name: c.name, text: JSON.stringify({ INVALID_JSON: c.bad }), isError: true });
          send({ type: "tool_result", id: c.id, name: c.name, ok: false, summary: "the call's input was not valid JSON", detail: c.bad.slice(0, DETAIL), ms: 0 });
          continue;
        }
        if (c.name === "ask_person") {
          const i = c.input as { question?: unknown; options?: unknown; save?: unknown };
          const strs = (v: unknown, n: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, n) : []);
          const options = strs(i.options, 6), save = strs(i.save, 20);
          send({ type: "ask", question: String(i.question ?? "").slice(0, 500), ...(options.length ? { options } : {}), ...(save.length ? { save } : {}) });
          asked = true;
          results.push({ id: c.id, name: c.name, text: "Asked. The person's answer comes as their next message: end your turn now.", isError: false });
          send({ type: "tool_result", id: c.id, name: c.name, ok: true, summary: "asked", detail: "", ms: Date.now() - t0 });
          continue;
        }
        let texts: string[], isError: boolean, images: { data: string; mimeType: string }[] = [];
        try {
          const out = await client.callTool({ name: c.name, arguments: c.input }) as { content?: { type: string; text?: string; data?: string; mimeType?: string }[]; isError?: boolean };
          texts = (out.content ?? []).filter(x => x.type === "text").map(x => x.text ?? "");
          images = (out.content ?? []).filter(x => x.type === "image" && x.data).map(x => ({ data: x.data!, mimeType: x.mimeType ?? "image/png" }));
          isError = !!out.isError;
        } catch (err) { texts = [`the tool failed: ${(err as Error).message}`]; isError = true; }
        send({ type: "tool_result", id: c.id, name: c.name, ok: !isError, summary: summaryOf(texts), detail: detailOf(texts), ms: Date.now() - t0 });
        if (!isError) {
          try {
            const j = JSON.parse(texts.at(-1) ?? "");
            if (typeof j.proposal === "string") send({ type: "proposal", id: j.proposal });
            if (j.ask && typeof j.ask.question === "string") send({ type: "ask", ...j.ask });
          } catch { /* no proposal */ }
        }
        results.push({ id: c.id, name: c.name, text: texts.join("\n\n"), isError, ...(images.length ? { images } : {}) });
      }
      messages.push(...p.results(results));
      // a question for the person ends the turn: their answer is the next message
      if (asked) break;
    }
    send({ type: "done", usage: { input: total.input, output: total.output, usd: Math.round(total.usd * 1e6) / 1e6 } });
  } catch (e) {
    if ((e as Error).name === "AbortError") return;
    send({ type: "error", message: e instanceof BudgetError || e instanceof ProviderError ? e.message : `the assistant failed: ${(e as Error).message}` });
  } finally {
    await client?.close().catch(() => {});
  }
}
