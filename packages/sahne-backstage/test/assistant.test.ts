// The assistant (server/assistant.ts) with the network stubbed, on a temp copy of the samples and a temp config folder:
// an Anthropic streamed tool_use loop that calls a real backstage tool through MCP, keeps the thinking block for the next
// request, and ends with text; an edit that becomes a proposal; an OpenAI-compatible tool_calls loop; a refusal, API
// errors and a missing key; a big ask that asks first; the second reader's fresh conversation; the budget logging each
// call's cost and refusing at the caps; the settings' round trip. Over HTTP: /api/assistant streams from a local
// OpenAI-compatible server, and /api/world, /api/usage and /api/settings answer.

import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const CLI = fileURLToPath(new URL("../server/cli.ts", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-ai-")), config = mkdtempSync(join(tmpdir(), "backstage-ai-config-")), config2 = mkdtempSync(join(tmpdir(), "backstage-ai-config2-"));
cpSync(SAMPLES, root, { recursive: true });
process.env.SAHNE_CONTENT = root;
process.env.SAHNE_BACKSTAGE_CONFIG = config;
for (const k of ["SAHNE_AI_PROVIDER", "SAHNE_AI_BASE_URL", "SAHNE_AI_MODEL", "OPENAI_API_KEY"]) delete process.env[k];

const { runAssistant, requestOf } = await import("../server/assistant.ts");
const { setFetch } = await import("../server/ai/provider.ts");
const { DEFAULTS, readSettings, writeSettings, readiness, settingsFile, LOCAL_BASE } = await import("../server/settings.ts");
const { costOf, totals, usageFile, PRICES } = await import("../server/ai/budget.ts");
const { Events } = await import("../server/events.ts");
const { proposalsOf } = await import("../server/proposals.ts");
type Ev = { type: string; [k: string]: any };

/** A body that arrives in small pieces, as a network's does. */
const chunked = (text: string, n = 23) => new ReadableStream<Uint8Array>({
  start(c) { const b = new TextEncoder().encode(text); for (let i = 0; i < b.length; i += n) c.enqueue(b.slice(i, i + n)); c.close(); },
});
const anthropicSse = (events: object[]) => new Response(chunked(events.map(e => `event: ${(e as { type: string }).type}\ndata: ${JSON.stringify(e)}\n\n`).join("")), { status: 200, headers: { "content-type": "text/event-stream" } });
const openaiSse = (chunks: object[]) => new Response(chunked([...chunks.map(c => `data: ${JSON.stringify(c)}\n\n`), "data: [DONE]\n\n"].join("")), { status: 200, headers: { "content-type": "text/event-stream" } });

let sent: { url: string; body: any; headers: Record<string, string> }[] = [];
function answers(...rs: (() => Response)[]) {
  sent = [];
  let i = 0;
  setFetch(async (url, init) => {
    sent.push({ url: String(url), body: JSON.parse(String(init!.body)), headers: init!.headers as Record<string, string> });
    const f = rs[i++];
    if (!f) throw new Error("no more stubbed answers");
    return f();
  });
}

const toolTurn = (id: string, name: string, input: object, usage = { in: 1000, out: 200 }) => () => anthropicSse([
  { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: usage.in, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } },
  { type: "content_block_start", index: 0, content_block: { type: "thinking", thinking: "", signature: "" } },
  { type: "content_block_delta", index: 0, delta: { type: "thinking_delta", thinking: "Look at the step." } },
  { type: "content_block_delta", index: 0, delta: { type: "signature_delta", signature: "sig-123" } },
  { type: "content_block_stop", index: 0 },
  { type: "ping" },
  { type: "content_block_start", index: 1, content_block: { type: "tool_use", id, name, input: {} } },
  ...JSON.stringify(input).match(/.{1,9}/g)!.map(part => ({ type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: part } })),
  { type: "content_block_stop", index: 1 },
  { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: usage.out } },
  { type: "message_stop" },
]);
const textTurn = (text: string, usage = { in: 1500, out: 30 }, stop = "end_turn") => () => anthropicSse([
  { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: usage.in, output_tokens: 1 } } },
  { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  ...text.match(/.{1,6}/g)!.map(t => ({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } })),
  { type: "content_block_stop", index: 0 },
  { type: "message_delta", delta: { stop_reason: stop }, usage: { output_tokens: usage.out } },
  { type: "message_stop" },
]);

const settings = (over: object = {}) => ({ ...DEFAULTS, caps: {}, ...over }) as ReturnType<typeof readSettings>;
async function ask(content: string | { role: "user" | "assistant"; content: string }[], o: { settings?: object; agentEdits?: "proposals" | "direct"; fresh?: boolean; confirm?: boolean; quick?: boolean; events?: InstanceType<typeof Events> } = {}) {
  const events: Ev[] = [];
  const req = requestOf({ messages: typeof content === "string" ? [{ role: "user", content }] : content, context: { page: "episode", kind: "story", id: "s1e00", path: ["steps", 4] }, fresh: o.fresh, confirm: o.confirm, quick: o.quick });
  assert.equal(typeof req, "object");
  await runAssistant(req as Exclude<typeof req, string>, e => events.push(e), { write: true, agentEdits: o.agentEdits ?? "proposals", shareCards: false, events: o.events ?? new Events(), settings: settings(o.settings) });
  return events;
}
const text = (evs: Ev[]) => evs.filter(e => e.type === "text").map(e => e.text).join("");

/** End a spawned backstage and let go of its pipes, so nothing it started keeps this test's process alive. */
const stop = (p?: ChildProcess) => new Promise<void>(r => {
  if (!p || p.exitCode !== null || p.signalCode !== null) { p?.stdout?.destroy(); p?.stderr?.destroy(); return r(); }
  p.once("exit", () => r());
  p.kill("SIGKILL");
  p.stdout?.destroy(); p.stderr?.destroy();
});
let web: { url: string; p: ChildProcess } | null = null, off: { url: string; p: ChildProcess } | null = null, fake: http.Server | null = null;
after(async () => { await Promise.all([stop(web?.p), stop(off?.p)]); fake?.closeAllConnections(); fake?.close(); for (const d of [root, config, config2]) rmSync(d, { recursive: true, force: true }); });

test("anthropic: a streamed tool_use loop reads a real step through MCP, keeps its thinking, and ends with text", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  answers(toolTurn("toolu_1", "read_step", { id: "s1e00", path: "steps/4" }), textTurn("İsmail welcomes Nima in."));
  const evs = await ask("Who speaks in this step?");
  assert.deepEqual(evs.filter(e => e.type !== "text").map(e => e.type), ["thinking", "tool", "tool_result", "done"]);
  // the thinking streams to the editor; each call and its result carry the call's id, the result its time and detail
  assert.deepEqual(evs[0], { type: "thinking", text: "Look at the step." });
  assert.deepEqual(evs[1], { type: "tool", id: "toolu_1", name: "read_step", input: { id: "s1e00", path: "steps/4" } });
  assert.equal(evs[2].id, "toolu_1");
  assert.equal(evs[2].ok, true);
  assert.match(evs[2].summary, /s1e00 steps\/4/);
  assert.match(evs[2].detail, /"who": "ismail"/);
  assert.equal(typeof evs[2].ms, "number");
  assert.equal(text(evs), "İsmail welcomes Nima in.");
  const usd = (1000 * 4 + 200 * 20 + 1500 * 4 + 30 * 20) / 1e6;
  assert.deepEqual(evs.at(-1)!.usage, { input: 2500, output: 230, usd });
  // the request: the API, the key, streaming, adaptive thinking, the tools without $schema, a system prompt from the series
  const [r1, r2] = sent;
  assert.equal(r1.url, "https://api.anthropic.com/v1/messages");
  assert.equal(r1.headers["x-api-key"], "test-key");
  assert.equal(r1.headers["anthropic-version"], "2023-06-01");
  assert.equal(r1.body.model, "claude-opus-5-5");
  assert.equal(r1.body.stream, true);
  assert.deepEqual(r1.body.thinking, { type: "adaptive", display: "summarized" });
  assert.deepEqual(r1.body.cache_control, { type: "ephemeral" });
  assert.match(r1.body.system, /before a batch of tools/i);
  assert.equal(r1.body.tool_choice, undefined);
  const tool = r1.body.tools.find((t: { name: string }) => t.name === "read_step");
  assert.equal(tool.input_schema.type, "object");
  assert.equal(tool.input_schema.$schema, undefined);
  assert.match(r1.body.system, /learning Turkish \(tr\)/);
  assert.match(r1.body.system, /English \(en\), Persian \(fa\)/);
  assert.match(r1.body.system, /fa is written right to left/);
  assert.match(r1.body.system, /The narrator is Kerim \(id kerim\)/);
  assert.match(r1.body.system, /story s1e00, at steps\/4/);
  assert.match(r1.body.system, /proposals/);
  // the next request carries the turn as it came, thinking and signature included, and the tool's result
  assert.deepEqual(r2.body.messages[1].content[0], { type: "thinking", thinking: "Look at the step.", signature: "sig-123" });
  assert.deepEqual(r2.body.messages[1].content[1], { type: "tool_use", id: "toolu_1", name: "read_step", input: { id: "s1e00", path: "steps/4" } });
  assert.equal(r2.body.messages[2].content[0].tool_use_id, "toolu_1");
  assert.match(r2.body.messages[2].content[0].content, /"who": "ismail"/);
  // each call is logged with its cost
  const log = readFileSync(usageFile(), "utf8").trim().split("\n").map(l => JSON.parse(l));
  assert.equal(log.length, 2);
  assert.equal(log[0].provider, "anthropic");
  assert.equal(log[0].usd, (1000 * 4 + 200 * 20) / 1e6);
  assert.ok(Math.abs(totals().today.usd - usd) < 1e-12);
});

test("stopped: no tool runs after the stop, and an answer with no words drops out of the history", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const stopper = new AbortController();
  answers(toolTurn("toolu_9", "read_step", { id: "s1e00", path: "steps/4" }));
  const events: Ev[] = [];
  const req = requestOf({ messages: [{ role: "user", content: "Read it" }, { role: "assistant", content: "" }, { role: "user", content: "Again" }] });
  assert.equal(typeof req, "object");
  assert.deepEqual((req as { messages: unknown[] }).messages, [{ role: "user", content: "Read it" }, { role: "user", content: "Again" }]);
  // the person stops while the model is answering: its tool call does not run
  await runAssistant(req as Exclude<typeof req, string>, e => { events.push(e); if (e.type === "thinking") stopper.abort(); }, { write: true, agentEdits: "direct", shareCards: false, events: new Events(), settings: settings(), signal: stopper.signal });
  assert.equal(events.filter(e => e.type === "tool").length, 0, JSON.stringify(events));
  assert.equal(sent.length, 1);
});

test("ask_person: a card for the person ends the turn; set_review in proposals mode asks with a card too", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  answers(toolTurn("toolu_a", "ask_person", { question: "Which title?", options: ["Ekmek", "Su"] }));
  const evs = await ask("Name it");
  const card = evs.find(e => e.type === "ask")!;
  assert.deepEqual({ q: card.question, o: card.options }, { q: "Which title?", o: ["Ekmek", "Su"] });
  // the loop stops for the answer: one request, no second turn
  assert.equal(sent.length, 1);
  assert.ok(sent[0].body.tools.some((t: { name: string }) => t.name === "ask_person"));
  answers(toolTurn("toolu_r", "set_review", { id: "s1e00", status: "reviewed" }), textTurn("Asked."));
  const rv = await ask("Mark it reviewed");
  assert.deepEqual(rv.find(e => e.type === "ask")!.review, { id: "s1e00", status: "reviewed" });
});

test("the conversation goes back as it was: an earlier tool's picture is not rewritten", async () => {
  // Claude signs its thinking against everything before it, and the request is cached: changing an earlier message breaks both
  answers(toolTurn("toolu_p1", "read_look", { id: "ismail" }), toolTurn("toolu_p2", "read_look", { id: "ismail", section: "hair" }), textTurn("Looked."));
  await ask("Look at İsmail twice");
  const last = sent.at(-1)!.body.messages as { content: unknown }[];
  const images = JSON.stringify(last).split('"type":"image"').length - 1;
  assert.equal(images, 2, "both pictures are still there");
});

test("the web on Claude: Anthropic's search runs on its side; a paused turn goes on; the pages found are shown, and each search is priced", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  delete process.env.TAVILY_API_KEY;
  const searchTurn = (stop: string) => () => anthropicSse([
    { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: 100, output_tokens: 1 } } },
    { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", id: "srvtoolu_1", name: "web_search", input: {} } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{\"query\":\"simit fiyatı\"}" } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "web_search_tool_result", tool_use_id: "srvtoolu_1", content: [{ type: "web_search_result", url: "https://example.com/simit", title: "Simit" }] } },
    { type: "content_block_stop", index: 1 },
    { type: "message_delta", delta: { stop_reason: stop }, usage: { output_tokens: 10, server_tool_use: { web_search_requests: 1 } } },
    { type: "message_stop" },
  ]);
  answers(searchTurn("pause_turn"), textTurn("A simit costs about 20 lira."));
  const evs = await ask("How much is a simit?");
  // the request carries the server tools; a paused turn is sent back as it is, with no extra message
  assert.ok(sent[0].body.tools.some((t: { type?: string }) => t.type === "web_search_20260209"));
  assert.equal(sent.length, 2);
  assert.equal(sent[1].body.messages.at(-1).role, "assistant");
  assert.deepEqual(sent[1].body.messages.at(-1).content[0].input, { query: "simit fiyatı" });
  const tool = evs.find(e => e.type === "tool")!;
  assert.deepEqual({ name: tool.name, input: tool.input }, { name: "web_search", input: { query: "simit fiyatı" } });
  assert.match(evs.find(e => e.type === "tool_result")!.summary, /1 page/);
  assert.deepEqual(evs.find(e => e.type === "sources")!.list, [{ url: "https://example.com/simit", title: "Simit" }]);
  assert.equal(text(evs), "A simit costs about 20 lira.");
  assert.ok(evs.at(-1)!.usage.usd >= 0.01, "a search costs a cent");
  // off: no web tools, and the lists say how to turn it on
  answers(textTurn("No web."));
  await ask("Search it", { settings: { web: "off" } });
  assert.ok(!sent[0].body.tools.some((t: { type?: string }) => t.type === "web_search_20260209"));
  assert.match(sent[0].body.system, /Browse the web: Settings turns it on/);
});

test("memory: a kept note is in every later prompt; forgotten, it goes; never a key; after the web, the person decides", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  const { readMemory, remember: keep } = await import("../server/memory.ts");
  answers(toolTurn("toolu_m", "remember", { text: "Titles are in sentence case." }), textTurn("Noted."));
  const evs = await ask("Always write titles in sentence case.");
  const kept = evs.find(e => e.type === "remembered")!;
  assert.equal(kept.text, "Titles are in sentence case.");
  assert.deepEqual(readMemory().map(n => n.text), ["Titles are in sentence case."]);
  answers(textTurn("Hi."));
  await ask("Hello");
  assert.match(sent[0].body.system, new RegExp(`${kept.id}: Titles are in sentence case\\.`));
  assert.throws(() => keep("the api key is sk-ant-abc"), /never holds a key/);
  answers(toolTurn("toolu_f", "forget", { id: kept.id }), textTurn("Forgotten."));
  await ask("Forget that.");
  assert.deepEqual(readMemory(), []);
  // after a web search in the ask, a note waits for the person, and a direct-mode edit becomes a proposal
  const webTurn = () => anthropicSse([
    { type: "message_start", message: { model: "claude-opus-5-5", usage: { input_tokens: 10, output_tokens: 1 } } },
    { type: "content_block_start", index: 0, content_block: { type: "server_tool_use", id: "srvtoolu_w", name: "web_search", input: {} } },
    { type: "content_block_stop", index: 0 },
    { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_r2", name: "remember", input: {} } },
    { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{\"text\":\"Simit is 20 lira.\"}" } },
    { type: "content_block_stop", index: 1 },
    { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 5 } },
    { type: "message_stop" },
  ]);
  answers(webTurn, toolTurn("toolu_e", "set_texts", { id: "s1e00", path: "steps/4", texts: { en: "Good evening, friend." } }), textTurn("Done."));
  const wv = await ask("Look it up and remember the price, then fix the line.", { agentEdits: "direct" });
  assert.equal(wv.find(e => e.type === "ask")!.remember, "Simit is 20 lira.");
  assert.deepEqual(readMemory(), []);
  assert.ok(wv.some(e => e.type === "proposal"), "the edit after the web is a proposal, not saved");
  assert.doesNotMatch(readFileSync(join(root, "stories", "s1e00.json"), "utf8"), /Good evening, friend/);
});

test("an edit by the assistant is a proposal, by \"assistant\"; a quick ask takes the faster model", async () => {
  const events = new Events();
  answers(toolTurn("toolu_2", "set_texts", { id: "s1e00", path: "steps/4", texts: { en: "Good evening! Come on in." } }), textTurn("I proposed a warmer line."));
  const evs = await ask("Make the English warmer.", { events, quick: true });
  assert.ok(evs.some(e => e.type === "proposal" && /^p\d+$/.test(e.id)), JSON.stringify(evs));
  const [p] = proposalsOf(events).all();
  assert.equal(p.by, "assistant");
  assert.equal((p.next as any).steps[4].en, "Good evening! Come on in.");
  assert.equal(sent[0].body.model, "claude-sonnet-5-5");
});

test("a refusal and API errors are errors to show; without a key the assistant is off", async () => {
  answers(() => anthropicSse([
    { type: "message_start", message: { usage: { input_tokens: 10, output_tokens: 0 } } },
    { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "toolu_4", name: "delete_step", input: {} } },
    { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: "{\"id\":\"s1e" } },
    { type: "message_delta", delta: { stop_reason: "refusal" }, usage: { output_tokens: 3 } },
  ]));
  let evs = await ask("Delete it.");
  assert.deepEqual(evs.map(e => e.type), ["error"]);
  assert.match(evs[0].message, /declined/);
  answers(() => new Response(JSON.stringify({ error: { message: "overloaded" } }), { status: 529 }));
  evs = await ask("Hello");
  assert.match(evs.at(-1)!.message, /busy/);
  answers(() => new Response(JSON.stringify({ error: { message: "bad key" } }), { status: 401 }));
  assert.match((await ask("Hello")).at(-1)!.message, /key was refused/);
  answers(() => anthropicSse([{ type: "message_start", message: { usage: { input_tokens: 1 } } }, { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }]));
  assert.match((await ask("Hello")).at(-1)!.message, /stopped: Overloaded/);
  answers(textTurn("cut", { in: 10, out: 10 }, "max_tokens"));
  assert.match((await ask("Hello")).at(-1)!.message, /cut off/);
  delete process.env.ANTHROPIC_API_KEY;
  answers();
  evs = await ask("Hello");
  assert.match(evs[0].message, /assistant is off: start backstage with ANTHROPIC_API_KEY/);
  assert.equal(sent.length, 0);
  process.env.ANTHROPIC_API_KEY = "test-key";
});

test("a big ask asks first; the second reader starts fresh", async () => {
  answers();
  let evs = await ask("Please review every episode of season 1.", { settings: { confirmOverUsd: 0 } });
  assert.equal(evs.length, 1);
  assert.equal(evs[0].type, "confirm");
  assert.ok(evs[0].estimateUsd > 0);
  assert.match(evs[0].why, /reviewing 1 episode of season 1/);
  assert.equal(sent.length, 0);
  answers(textTurn("Reviewed."));
  evs = await ask("Please review every episode of season 1.", { settings: { confirmOverUsd: 0 }, confirm: true });
  assert.equal(evs.at(-1)!.type, "done");
  answers(textTurn("Two notes."));
  await ask([{ role: "user", content: "Draft the episode." }, { role: "assistant", content: "Drafted it, with these choices…" }, { role: "user", content: "Now review it." }], { fresh: true });
  assert.deepEqual(sent[0].body.messages, [{ role: "user", content: "Now review it." }]);
  assert.match(sent[0].body.system, /You are a second reader/);
});

test("openai-compatible: reasoning goes to the thinking, never into the answer, a <think> tag cut across chunks too", async () => {
  const { thinkSplitter } = await import("../server/ai/providers/openai.ts");
  let said = "", thought = "";
  const sp = thinkSplitter(x => { said += x; }, x => { thought += x; });
  for (const c of ["Hi <thi", "nk>weigh it", " up</th", "ink> there <", "b>"]) sp.push(c);
  sp.end();
  assert.equal(said, "Hi  there <b>");
  assert.equal(thought, "weigh it up");
  answers(() => openaiSse([
    { choices: [{ delta: { reasoning_content: "Short answer." } }] },
    { choices: [{ delta: { content: "<think>also this</think>Merhaba!" } }] },
    { choices: [{ delta: {}, finish_reason: "stop" }] },
  ]));
  const evs = await ask("Say hi", { settings: { provider: "openai", baseUrl: "http://localhost:1234/v1" } });
  assert.ok(!evs.some(e => e.type === "error"), JSON.stringify(evs));
  assert.equal(text(evs), "Merhaba!");
  assert.equal(evs.filter(e => e.type === "thinking").map(e => e.text).join(""), "Short answer.also this");
});

test("openai-compatible: a streamed tool_calls loop, usage estimated when the server gives none, at no cost", async () => {
  answers(
    () => openaiSse([
      { model: "qwen3", choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "call_1", type: "function", function: { name: "read_step", arguments: "{\"id\":\"s1e00\"," } }] } }] },
      { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: "\"path\":4}" } }] } }] },
      { choices: [{ index: 0, delta: {}, finish_reason: "stop" }] },
    ]),
    () => openaiSse([
      { choices: [{ index: 0, delta: { content: "İsmail " } }] },
      { choices: [{ index: 0, delta: { content: "speaks." }, finish_reason: "stop" }] },
      { choices: [], usage: { prompt_tokens: 900, completion_tokens: 4 } },
    ]),
  );
  const before = totals();
  const evs = await ask("Who speaks?", { settings: { provider: "openai", baseUrl: "http://localhost:1234/v1" } });
  assert.deepEqual(evs.filter(e => e.type !== "text").map(e => e.type), ["tool", "tool_result", "done"]);
  assert.equal(text(evs), "İsmail speaks.");
  assert.equal(sent[0].url, "http://localhost:1234/v1/chat/completions");
  assert.equal(sent[0].body.model, undefined, "no model named: the server's loaded one");
  assert.equal(sent[0].body.messages[0].role, "system");
  assert.equal(sent[0].body.tools[0].type, "function");
  assert.deepEqual(sent[1].body.messages.at(-2).tool_calls, [{ id: "call_1", type: "function", function: { name: "read_step", arguments: "{\"id\":\"s1e00\",\"path\":4}" } }]);
  assert.equal(sent[1].body.messages.at(-1).role, "tool");
  assert.match(sent[1].body.messages.at(-1).content, /"who": "ismail"/);
  const done = evs.at(-1)!.usage;
  assert.equal(done.usd, 0);
  assert.ok(done.input > 900, "the first turn's tokens are estimated");
  assert.equal(totals().today.usd, before.today.usd);
  assert.ok(totals().today.tokens > before.today.tokens + 900);
});

test("the budget refuses at the caps, before any request", async () => {
  const spent = totals();
  answers();
  let evs = await ask("Hello", { settings: { caps: { dayUsd: spent.today.usd } } });
  assert.match(evs[0].message, /daily spending cap is reached/);
  evs = await ask("Hello", { settings: { caps: { monthTokens: spent.month.tokens } } });
  assert.match(evs[0].message, /monthly token cap is reached/);
  evs = await ask("Hello", { settings: { provider: "openai", baseUrl: LOCAL_BASE, caps: { dayTokens: 1 } } });
  assert.match(evs[0].message, /daily token cap/, "local models too");
  assert.equal(sent.length, 0);
  // the cap is checked before every request of a loop: the first turn spends past it, and the second is refused
  answers(toolTurn("toolu_9", "read_step", { id: "s1e00", path: 4 }, { in: 10_000, out: 1000 }), textTurn("never"));
  evs = await ask("Who?", { settings: { caps: { dayUsd: spent.today.usd + 0.01 } } });
  assert.equal(sent.length, 1);
  assert.match(evs.at(-1)!.message, /daily spending cap/);
  assert.equal(costOf("anthropic", "claude-opus-5-5", { input: 1e6, output: 1e6 }), PRICES["claude-opus-5-5"].input + PRICES["claude-opus-5-5"].output);
  assert.equal(costOf("openai", "anything", { input: 1e6, output: 1e6 }), 0);
});

test("settings: a round trip in the config folder, no keys kept, the environment over the file", () => {
  const f = settingsFile();
  assert.equal(f, join(config, "settings.json"));
  assert.ok(!existsSync(f), "a read never writes");
  assert.equal(readSettings().provider, "anthropic");
  const s = writeSettings({ provider: "openai", model: "qwen3", caps: { dayUsd: 1, monthTokens: 1000 }, apiKey: "sk-secret", key: "x", confirmOverUsd: 2, agentEdits: "direct", applySuggestions: true, baseUrl: "javascript:alert(1)" });
  const raw = readFileSync(f, "utf8");
  assert.doesNotMatch(raw, /sk-secret|apiKey|"key"|javascript/);
  assert.equal(s.provider, "openai");
  assert.equal(s.baseUrl, LOCAL_BASE, "a local server by default");
  assert.deepEqual(s.caps, { ...DEFAULTS.caps, dayUsd: 1, monthTokens: 1000 });
  assert.equal(s.agentEdits, "direct");
  assert.equal(s.applySuggestions, true);
  assert.deepEqual(readiness(s), { ready: true, provider: "openai", model: "qwen3" });
  process.env.SAHNE_AI_MODEL = "llama";
  process.env.SAHNE_AI_PROVIDER = "anthropic";
  assert.equal(readSettings().model, "llama");
  assert.equal(readSettings().provider, "anthropic");
  delete process.env.SAHNE_AI_MODEL; delete process.env.SAHNE_AI_PROVIDER;
  assert.equal(writeSettings({ model: "qwen3.5" }).provider, "openai", "a save merges over the file");
  assert.equal(writeSettings({ provider: "anthropic" }).model, undefined, "a local model goes when the provider becomes Claude");
  assert.equal(writeSettings({ model: "claude-sonnet-5-5" }).model, "claude-sonnet-5-5");
  assert.equal(writeSettings({ provider: "openai" }).model, undefined, "a Claude model goes when the provider becomes local");
});

function start(args: string[], env: Record<string, string>): Promise<{ url: string; p: ChildProcess }> {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, [CLI, "--port", "0", ...args], { stdio: ["ignore", "pipe", "pipe"], env });
    let out = "";
    const onData = (d: Buffer) => { out += d; const m = /sahne-backstage on (http:\/\/localhost:\d+\/)/.exec(out); if (m) res({ url: m[1], p }); };
    p.stdout!.on("data", onData); p.stderr!.on("data", onData);
    p.on("exit", c => rej(new Error(`exited ${c}: ${out}`)));
    // a server that never says where it listens fails the file in a minute, rather than hanging the gate
    setTimeout(() => { p.kill(); rej(new Error(`no "sahne-backstage on" line in 60 s: ${out}`)); }, 60_000).unref();
  });
}

before(async () => {
  fake = http.createServer((req, res) => {
    req.resume();
    req.on("end", () => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      for (const c of [{ choices: [{ index: 0, delta: { content: "Merhaba!" } }] }, { choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: { prompt_tokens: 400, completion_tokens: 3 } }]) res.write(`data: ${JSON.stringify(c)}\n\n`);
      res.end("data: [DONE]\n\n");
    });
  });
  await new Promise<void>(r => fake!.listen(0, "127.0.0.1", r));
  const port = (fake.address() as { port: number }).port;
  const env = { ...process.env } as Record<string, string>;
  for (const k of ["ANTHROPIC_API_KEY", "SAHNE_CONTENT", "SAHNE_AI_MODEL", "SAHNE_AI_PROVIDER"]) delete env[k];
  [web, off] = await Promise.all([
    start(["--content", root, "--ai-provider", "openai", "--ai-base-url", `http://127.0.0.1:${port}/v1`], { ...env, SAHNE_BACKSTAGE_CONFIG: config2 }),
    start(["--content", root], { ...env, SAHNE_BACKSTAGE_CONFIG: config2 }),
  ]);
});

test("over HTTP: the assistant streams, and the world, the usage and the settings answer", async () => {
  const api = async (base: string, method: string, path: string, body?: unknown) => {
    const r = await fetch(base + "api/" + path, { method, headers: body === undefined ? {} : { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: r.status, type: r.headers.get("content-type"), text: await r.text() };
  };
  assert.equal(JSON.parse((await api(off!.url, "GET", "world")).text).ai, false, "no key: falsy");
  assert.deepEqual(JSON.parse((await api(web!.url, "GET", "world")).text).ai, { ready: true, provider: "openai", model: "local", web: null });
  const r = await api(web!.url, "POST", "assistant", { messages: [{ role: "user", content: "Say hello." }], context: { page: "home" } });
  assert.equal(r.status, 200);
  assert.equal(r.type, "text/event-stream; charset=utf-8");
  assert.match(r.text, /event: text\ndata: \{"type":"text","text":"Merhaba!"\}/);
  assert.match(r.text, /event: done\ndata: \{"type":"done","usage":\{"input":400,"output":3,"usd":0\}\}/);
  assert.equal((await api(web!.url, "POST", "assistant", { messages: [] })).status, 400);
  const u = JSON.parse((await api(web!.url, "GET", "usage")).text);
  assert.equal(u.today.tokens, 403);
  assert.equal(u.caps.dayUsd, DEFAULTS.caps.dayUsd);
  assert.ok(existsSync(join(config2, "usage.jsonl")), "the usage log is in the config folder");
  assert.ok(!existsSync(join(root, ".backstage", "usage.jsonl")), "never in the content root");
  const s = JSON.parse((await api(web!.url, "POST", "settings", { caps: { dayUsd: 3 }, anthropicKey: "sk-ant-x" })).text);
  assert.equal(s.settings.caps.dayUsd, 3);
  assert.equal(s.overrides.provider, "SAHNE_AI_PROVIDER");
  assert.deepEqual(s.keys, { anthropic: false, openai: false, tavily: false });
  assert.doesNotMatch(readFileSync(join(config2, "settings.json"), "utf8"), /sk-ant/);
});
