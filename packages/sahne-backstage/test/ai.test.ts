// AI help (server/ai.ts) with the network stubbed: what a request sends (the model, the key, the JSON schema, the
// fallbacks, only the story), what an answer becomes, and how a refusal, an API error and a missing key are reported.

import { test } from "node:test";
import assert from "node:assert/strict";
import { ai, aiReady, MODELS, setFetch } from "../server/ai.ts";

const STORY = { id: "s1e01", words: ["a1-w-ekmek"], steps: [{ who: "ismail", tr: "Merhaba!", en: "Hello!", fa: "سلام!" }] };
let sent: { url: string; init: RequestInit }[] = [];
const answer = (body: object, status = 200) => setFetch(async (url, init) => { sent.push({ url: String(url), init: init! }); return new Response(JSON.stringify(body), { status }); });
const text = (v: object) => ({ stop_reason: "end_turn", content: [{ type: "text", text: JSON.stringify(v) }] });

test("without a key, AI help is off", async () => {
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(aiReady(), false);
  await assert.rejects(ai("rewrite", { story: STORY, path: ["steps", 0] }), (e: { status: number }) => e.status === 503);
});

test("a rewrite asks for JSON to a schema, with fallbacks, and returns the suggestion", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";
  sent = [];
  answer(text({ tr: "Merhabalar!", en: "Hello there!", fa: "سلام سلام!", why: "warmer" }));
  const r = await ai("rewrite", { story: STORY, path: ["steps", 0], instruction: "warmer", cast: { ismail: { name: "İsmail" } } }) as { suggestion: { tr: string } };
  assert.equal(r.suggestion.tr, "Merhabalar!");
  const req = sent[0], h = req.init.headers as Record<string, string>, body = JSON.parse(String(req.init.body));
  assert.equal(req.url, "https://api.anthropic.com/v1/messages");
  assert.equal(h["x-api-key"], "test-key");
  assert.equal(h["anthropic-version"], "2023-06-01");
  assert.equal(body.model, MODELS.rewrite);
  assert.equal(body.fallbacks, "default");
  assert.equal(body.output_config.format.type, "json_schema");
  assert.equal(body.tool_choice, undefined, "no forced tool call");
  assert.match(body.messages[0].content, /Merhaba!/);
});

test("a review and a draft come back as findings and as steps", async () => {
  answer(text({ summary: "ok", findings: [{ step: 0, severity: "warning", message: "stiff" }] }));
  const r = await ai("review", { story: STORY }) as { findings: unknown[] };
  assert.equal(r.findings.length, 1);
  answer(text({ steps_json: JSON.stringify([{ scene: "bakkal", at: {} }]), quiz_json: "[]", notes: "n" }));
  const d = await ai("draft", { story: STORY, brief: "a short visit" }) as { steps: unknown[] };
  assert.deepEqual(d.steps, [{ scene: "bakkal", at: {} }]);
});

test("a refusal, an API error and a bad answer are errors to show", async () => {
  answer({ stop_reason: "refusal", stop_details: { explanation: "no" }, content: [] });
  await assert.rejects(ai("review", { story: STORY }), (e: { status: number; message: string }) => e.status === 422 && /declined/.test(e.message));
  answer({ error: { message: "overloaded" } }, 529);
  await assert.rejects(ai("review", { story: STORY }), (e: { status: number }) => e.status === 503);
  answer({ stop_reason: "end_turn", content: [{ type: "text", text: "not json" }] });
  await assert.rejects(ai("review", { story: STORY }), (e: { status: number }) => e.status === 502);
  await assert.rejects(ai("nothing", { story: STORY }), (e: { status: number }) => e.status === 404);
  delete process.env.ANTHROPIC_API_KEY;
});
