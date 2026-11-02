// The Changes tab (src/ui/changes.ts): a step removed since the last commit goes back after the step before it, wherever
// that step is now. Run in Node with the few browser globals the editor's modules read when they load.

import { test } from "node:test";
import assert from "node:assert/strict";
import { stepDiff } from "../src/model/stepdiff.ts";
import { insert } from "../src/model/path.ts";

Object.assign(globalThis, { location: { hash: "", href: "http://localhost/", origin: "http://localhost" }, addEventListener: () => {} });
const { putBackAt } = await import("../src/ui/changes.ts");

const line = (who: string, tr: string) => ({ who, tr, en: tr.toUpperCase() });
const words = (s: { steps: unknown[] }) => s.steps.map(x => (x as { tr: string }).tr);

test("a removed step goes back after the step before it, with steps added before both", () => {
  const head = { steps: [line("a", "bir"), line("b", "iki"), line("c", "üç"), line("d", "dört")] };
  const now = { steps: [line("x", "yeni bir"), line("y", "yeni iki"), line("a", "bir"), line("b", "iki"), line("d", "dört")] };
  const d = stepDiff(head, now, { main: "tr", langs: ["tr"] }).steps;
  assert.deepEqual(words(insert(now, ["steps"], putBackAt(d, 2), head.steps[2])), ["yeni bir", "yeni iki", "bir", "iki", "üç", "dört"]);
  const none = { steps: [line("d", "dört")] }, d2 = stepDiff(head, none, { main: "tr", langs: ["tr"] }).steps;
  assert.equal(putBackAt(d2, 0), 0, "the first step goes back first");
});
