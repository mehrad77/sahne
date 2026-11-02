// The script editor's pure edits (src/model/script.ts) that the page's buttons rely on.

import { test } from "node:test";
import assert from "node:assert/strict";
import type { StoryDoc } from "../../sahne-story/src/index.ts";
import { addAfter, blocks, emptyLine, lastStep } from "../src/model/script.ts";

const langs = { main: "tr", translations: ["en"] };

test("script: a block added at the end follows the last step, not a trailing choice's option or reply", () => {
  const story = { id: "s1e01", steps: [
    { who: "ali", tr: "Merhaba", en: "Hi" },
    { choice: { id: "choice1", options: [{ tr: "a", en: "a", ok: true, reply: [{ who: "ali", tr: "b", en: "b" }] }, { tr: "c", en: "c" }] } },
  ] } as unknown as StoryDoc;
  assert.deepEqual(blocks(story).at(-1)?.path, ["steps", 1, "choice", "options", 1], "the last block is an option");
  const r = addAfter(story, lastStep(story), emptyLine("ali", langs));
  assert.equal(r.story.steps.length, 3);
  assert.deepEqual(r.focus, ["steps", 2]);
  assert.equal((r.story.steps[1] as { choice: { options: { reply?: unknown[] }[] } }).choice.options[1].reply, undefined);
  // an empty script: the first step
  const empty = addAfter({ ...story, steps: [] }, lastStep({ steps: [] }), emptyLine("ali", langs));
  assert.deepEqual(empty.focus, ["steps", 0]);
});
