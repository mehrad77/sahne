// The proposals queue (server/proposals.ts) kept in the person's store (server/runs/store.ts): what is pending, what was
// answered and the next id outlive the process; the same author proposing the same documents again gets the proposal there is.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "backstage-store-"));
process.env.SAHNE_BACKSTAGE_CONFIG = dir;
const { Store } = await import("../server/runs/store.ts");
const { Proposals } = await import("../server/proposals.ts");
const { Events } = await import("../server/events.ts");
after(() => rmSync(dir, { recursive: true, force: true }));

const draft = (doc: string, en: string) => ({ kind: "story" as const, doc, next: { id: doc, title: { en } }, paths: [["title"]], summary: `retitle ${doc}`, by: "run:r1", problems: [] });

test("the queue outlives the process: pending, answered, and the next id", async () => {
  const file = join(dir, "q.sqlite");
  const s1 = new Store(file), q1 = new Proposals(new Events(), undefined, s1);
  const a = await q1.add(draft("s1e00", "One")), b = await q1.add(draft("s1e01", "Two"));
  q1.resolve(a.id, false);
  s1.close();
  const s2 = new Store(file), q2 = new Proposals(new Events(), undefined, s2);
  assert.deepEqual(q2.all().map(p => p.id), [b.id]);
  assert.deepEqual((await q2.resolved()).map(r => [r.id, r.outcome]), [[a.id, "rejected"]]);
  const c = await q2.add(draft("s1e02", "Three"));
  assert.equal(c.id, "p3", "ids go on where they stopped");
  s2.close();
});

test("the same author and documents again: the proposal there is, and no event", async () => {
  const events = new Events(), seen: string[] = [];
  events.on(name => seen.push(name));
  const q = new Proposals(events);
  const a = await q.add(draft("s1e00", "One"));
  assert.equal((await q.add(draft("s1e00", "One"))).id, a.id);
  assert.notEqual((await q.add(draft("s1e00", "Other"))).id, a.id);
  assert.notEqual((await q.add({ ...draft("s1e00", "One"), by: "someone" })).id, a.id, "another author's is its own");
  assert.equal(seen.length, 3);
});
