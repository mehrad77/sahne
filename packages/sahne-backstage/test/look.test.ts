// The look tools (server/looktools.ts) on a temp copy of the samples, in memory: read_look lists the builder's fields,
// options and palettes with a portrait; set_look takes only what the builder offers (a wrong value changes nothing and is
// named), writes in direct mode and queues in proposals mode, and refuses an extra.

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-look-"));
cpSync(SAMPLES, root, { recursive: true, filter: s => !s.endsWith("/samples/kit") });
process.env.SAHNE_CONTENT = root;
process.env.SAHNE_BACKSTAGE_CONFIG = mkdtempSync(join(tmpdir(), "backstage-look-config-"));

const { createMcp } = await import("../server/mcp.ts");
const { Events } = await import("../server/events.ts");

async function connect(agentEdits: "proposals" | "direct") {
  const server = createMcp({ write: true, agentEdits, shareCards: false, events: new Events() });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "look-test", version: "1.0.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}
const call = async (c: Client, name: string, args: Record<string, unknown>) => {
  const r = await c.callTool({ name, arguments: args }) as { content: { type: string; text?: string }[]; isError?: boolean };
  return { text: r.content.filter(x => x.type === "text").map(x => x.text!).join("\n"), images: r.content.filter(x => x.type === "image").length, isError: !!r.isError };
};
const ismail = () => JSON.parse(readFileSync(join(root, "characters", "ismail.json"), "utf8"));

test("read_look: each field with its choice, options and palette, and a portrait", async () => {
  const c = await connect("direct");
  const all = await call(c, "read_look", { id: "ismail" });
  assert.ok(!all.isError, all.text);
  assert.match(all.text, /body\.build \(Age, choice\) = "adult"\n  options: adult "Adult", elder "Elder"/);
  assert.match(all.text, /hair\.style \(Hair style, part\)/);
  assert.equal(all.images, 1);
  const hair = await call(c, "read_look", { id: "ismail", section: "hair" });
  assert.doesNotMatch(hair.text, /body\.build/);
  assert.ok((await call(c, "read_look", { id: "ismail", section: "wings" })).isError);
});

test("set_look: only the builder's own choices, written in direct mode, queued in proposals mode", async () => {
  const direct = await connect("direct"), before = JSON.stringify(ismail());
  const bad = await call(direct, "set_look", { id: "ismail", set: { "hair.style": "hair_nope", "body.build": "adult" } });
  assert.ok(bad.isError);
  assert.match(bad.text, /nothing changed[\s\S]*hair_nope/);
  assert.equal(JSON.stringify(ismail()), before, "a refusal writes nothing");
  const good = await call(direct, "set_look", { id: "ismail", set: { "hair.style": "hair_long" }, colors: { "hair.style": ["hair_05"] } });
  assert.ok(!good.isError, good.text);
  assert.equal(good.images, 1);
  assert.deepEqual(ismail().avatar.hair, { color: "hair_05", style: "hair_long" });
  // the fields nested, as an agent may write them, and one colour as a plain id
  const nested = await call(direct, "set_look", { id: "ismail", set: { body: { build: "adult" }, hair: { style: "hair_bob" } }, colors: { "hair.style": "hair_07" } });
  assert.ok(!nested.isError, nested.text);
  assert.deepEqual(ismail().avatar.hair, { color: "hair_07", style: "hair_bob" });
  // from blank: the kit's default look, with only these choices made
  const blank = await call(direct, "set_look", { id: "ismail", from: "blank", set: { "hair.style": "hair_bun" } });
  assert.ok(!blank.isError, blank.text);
  assert.equal(ismail().avatar.facialHair, undefined, "his moustache is not carried into a blank look");
  assert.equal(ismail().avatar.hair.style, "hair_bun");
  // a part as the document writes it: { id, colors }
  const asDoc = await call(direct, "set_look", { id: "ismail", set: { outfit: { top: { id: "top_blouse", colors: ["fab_04"] } } } });
  assert.ok(!asDoc.isError, asDoc.text);
  assert.deepEqual(ismail().avatar.outfit.top, { id: "top_blouse", colors: ["fab_04"] });

  const proposals = await connect("proposals"), now = JSON.stringify(ismail());
  const queued = await call(proposals, "set_look", { id: "ismail", set: { "body.shape": "slim" } });
  assert.ok(!queued.isError, queued.text);
  assert.equal(JSON.stringify(ismail()), now, "proposals mode writes nothing");

  const extra = readdirSync(join(root, "characters")).map(f => JSON.parse(readFileSync(join(root, "characters", f), "utf8"))).find(d => d.kind === "extra");
  if (extra) assert.match((await call(direct, "set_look", { id: extra.id, set: { "body.shape": "slim" } })).text, /extra/);
});
