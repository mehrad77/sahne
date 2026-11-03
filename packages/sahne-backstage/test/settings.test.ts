// The person's settings file (server/settings.ts): what the environment sets over it (the CLI's --ai-* flags) is never
// written into it, whatever the editor posts back.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const config = mkdtempSync(join(tmpdir(), "backstage-settings-"));
process.env.SAHNE_BACKSTAGE_CONFIG = config;
after(() => rmSync(config, { recursive: true, force: true }));
const { readSettings, writeSettings, settingsFile } = await import("../server/settings.ts");

test("a save keeps the file's own provider, server and model under the environment's", () => {
  writeFileSync(settingsFile(), JSON.stringify({ provider: "anthropic" }));
  process.env.SAHNE_AI_PROVIDER = "openai"; process.env.SAHNE_AI_BASE_URL = "http://localhost:9/v1"; process.env.SAHNE_AI_MODEL = "local-one";
  try {
    const s = writeSettings({ ...readSettings(), agentEdits: "direct" });
    assert.equal(s.provider, "openai", "the environment is still in effect");
    assert.deepEqual(JSON.parse(readFileSync(settingsFile(), "utf8")).provider, "anthropic");
    const file = JSON.parse(readFileSync(settingsFile(), "utf8"));
    assert.equal(file.baseUrl, undefined);
    assert.equal(file.model, undefined);
    assert.equal(file.agentEdits, "direct");
  } finally { delete process.env.SAHNE_AI_PROVIDER; delete process.env.SAHNE_AI_BASE_URL; delete process.env.SAHNE_AI_MODEL; }
  assert.equal(readSettings().provider, "anthropic", "without the flags, the person's own provider");
  // with no environment, a save sets them
  writeSettings({ provider: "openai", baseUrl: "http://localhost:1234/v1" });
  assert.equal(readSettings().baseUrl, "http://localhost:1234/v1");
});
