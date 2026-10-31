// The tools' input schemas as a provider gets them (server/ai/provider.ts schemaFor): every one of backstage's MCP tools
// is JSON Schema 2020-12, as Anthropic's API requires (a tuple as prefixItems, never draft-07's list-form items).

import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

const root = mkdtempSync(join(tmpdir(), "backstage-schema-"));
cpSync(fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url)), root, { recursive: true, filter: s => !s.endsWith("/samples/kit") });
process.env.SAHNE_CONTENT = root;
process.env.SAHNE_BACKSTAGE_CONFIG = mkdtempSync(join(tmpdir(), "backstage-schema-config-"));
const { createMcp } = await import("../server/mcp.ts");
const { Events } = await import("../server/events.ts");
const { schemaFor } = await import("../server/ai/provider.ts");

/** Every place in a schema that is draft-07 only: a list-form `items`, or `additionalItems`. */
const old = (v: unknown, at = "$"): string[] => {
  if (Array.isArray(v)) return v.flatMap((x, i) => old(x, `${at}[${i}]`));
  if (!v || typeof v !== "object") return [];
  const o = v as Record<string, unknown>;
  return [...(Array.isArray(o.items) ? [`${at}.items is a list`] : []), ...("additionalItems" in o ? [`${at}.additionalItems`] : []), ...Object.entries(o).flatMap(([k, x]) => old(x, `${at}.${k}`))];
};

test("a tuple becomes prefixItems", () => {
  const s = schemaFor({ $schema: "x", properties: { box: { type: "array", items: [{ type: "number" }, { type: "number" }], additionalItems: false, minItems: 2 } } });
  assert.deepEqual(s.properties, { box: { type: "array", prefixItems: [{ type: "number" }, { type: "number" }], items: false, minItems: 2 } });
  assert.equal("$schema" in s, false);
});

test("every MCP tool's schema is 2020-12", async () => {
  const server = createMcp({ write: true, agentEdits: "proposals", shareCards: false, events: new Events() });
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "schema-test", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);
  const bad = (await client.listTools()).tools.flatMap(t => old(schemaFor(t.inputSchema as Record<string, unknown>)).map(p => `${t.name}: ${p}`));
  assert.deepEqual(bad, []);
  await client.close();
});
