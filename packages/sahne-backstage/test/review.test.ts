// The review notes as written (server/review.ts `writeReview`) on a temp copy of the samples: an editor that read the
// notes earlier changes only what it changed, so an agent's comment written meanwhile stays; and an approval is signed
// with the episode as it is now, never with the signature an earlier approval left.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-review-"));
cpSync(SAMPLES, root, { recursive: true, filter: s => !s.endsWith("/samples/kit") });
process.env.SAHNE_CONTENT = root;
after(() => rmSync(root, { recursive: true, force: true }));

const { readReview, writeReview } = await import("../server/review.ts");
const { episodeSig } = await import("../src/model/progress.ts");
const { readDoc } = await import("../server/content.ts");

test("a change made from notes read earlier keeps an agent's comment written since", () => {
  const seen = readReview().episodes.s1e00 ?? {};
  // the agent comments (mcp.ts `comment` reads the file and writes it whole)
  writeReview({ id: "s1e00", review: { ...seen, comments: [{ id: "c1", by: "assistant", text: "Check step 2", date: "2026-11-02" }] } });
  // the person, from the notes as they read them, marks a block reviewed
  const mine = { ...seen, steps: { "1": { reviewed: true } } };
  const out = writeReview({ id: "s1e00", review: mine, was: seen }).episodes.s1e00;
  assert.deepEqual(out.comments?.map(c => c.id), ["c1"]);
  assert.deepEqual(out.steps, { "1": { reviewed: true } });
  // resolving the comment from the fresh notes, and taking a mark back from stale ones
  const now = readReview().episodes.s1e00;
  const done = writeReview({ id: "s1e00", review: { ...now, comments: now.comments!.map(c => ({ ...c, done: true })) }, was: now }).episodes.s1e00;
  assert.equal(done.comments?.[0].done, true);
  assert.deepEqual(writeReview({ id: "s1e00", review: { ...mine, steps: {} }, was: mine }).episodes.s1e00.comments?.[0].done, true);
});

test("approved again, the episode is signed as it is now", () => {
  const now = episodeSig(readDoc("story", "s1e00").doc as never);
  // approved once (signed then), taken back with the signature carried along, approved again as set_review does
  writeReview({ id: "s1e00", review: { status: "approved", sig: "0badc0de" } });
  const back = writeReview({ id: "s1e00", review: { ...readReview().episodes.s1e00, status: "draft", sig: "0badc0de" } }).episodes.s1e00;
  assert.equal(back.sig, undefined, "notes not approved keep no signature");
  assert.equal(writeReview({ id: "s1e00", review: { ...back, status: "approved" } }).episodes.s1e00.sig, now);
  assert.equal(writeReview({ id: "s1e00", review: { status: "approved", sig: "12345678" } }).episodes.s1e00.sig, "12345678", "the editor's own signature (the draft it approved) is kept");
});
