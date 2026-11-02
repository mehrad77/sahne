// The assistant's chat in the browser (src/ui/assistant.ts), the parts that are not drawing: the context it sends with a
// message. Run in Node with the few browser globals the editor's modules read when they load.

import { test } from "node:test";
import assert from "node:assert/strict";

Object.assign(globalThis, { location: { hash: "", href: "http://localhost/", origin: "http://localhost" }, addEventListener: () => {} });
const { contextNow } = await import("../src/ui/assistant.ts");
const { route } = await import("../src/store.ts");
const { selection } = await import("../src/events.ts");

test("a block selected in one episode is not the context of another", () => {
  selection.value = { page: "episode", kind: "story", id: "s1e01", path: ["steps", 3] };
  route.value = ["episode", "s1e02"];
  assert.deepEqual(contextNow(), { page: "episode", kind: "story", id: "s1e02" });
  route.value = ["episode", "s1e01"];
  assert.deepEqual(contextNow(), { page: "episode", kind: "story", id: "s1e01", path: ["steps", 3] });
  route.value = ["cast"];
  assert.deepEqual(contextNow(), { page: "cast" });
});

const { askedBy, historyOf } = await import("../src/ui/assistant.ts");

test("Go ahead sends its own question once, and only from the last answer", () => {
  const q1 = { role: "user" as const, content: "draft the season" }, cost = { role: "assistant" as const, content: "", parts: [] };
  const list = [{ role: "user" as const, content: "hi" }, { role: "assistant" as const, content: "hello" }, q1, cost];
  assert.equal(askedBy(list, cost), q1);
  assert.deepEqual(historyOf(list, { confirm: true }), [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }], "the question is the message, not also before it");
  assert.deepEqual(historyOf(list).map(t => t.content), ["hi", "hello", "draft the season"]);
  const later = [...list, { role: "user" as const, content: "something else" }, { role: "assistant" as const, content: "ok" }];
  assert.equal(askedBy(later, cost), null, "an older cost card answers nothing now");
});
