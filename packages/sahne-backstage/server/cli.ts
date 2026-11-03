#!/usr/bin/env node
// node packages/sahne-backstage/server/cli.ts [--content <absolute folder>] [--port 5181] [--write] [--agent-edits proposals|direct] [--share-cards]
//   [--ai-provider anthropic|openai] [--ai-model <model>] [--ai-base-url <url>]   the assistant's provider (over its settings)
// Backstage on the content root (default $SAHNE_CONTENT, or the samples), read-only unless --write.
// node packages/sahne-backstage/server/cli.ts mcp [--content <folder>] [--write] [--agent-edits …] [--share-cards] [--backstage http://localhost:5181/]
// Only the MCP server, on stdin and stdout, for an agent that starts it (claude mcp add); it prints nothing else to stdout.

import { parseArgs } from "node:util";

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    content: { type: "string" }, port: { type: "string", default: process.env.PORT ?? "5181" }, write: { type: "boolean", default: false },
    "agent-edits": { type: "string" }, "share-cards": { type: "boolean", default: false }, backstage: { type: "string" },
    "ai-provider": { type: "string" }, "ai-model": { type: "string" }, "ai-base-url": { type: "string" },
  },
});
// the assistant's provider, over the settings file (server/settings.ts reads these)
if (o["ai-provider"]) process.env.SAHNE_AI_PROVIDER = o["ai-provider"];
if (o["ai-model"]) process.env.SAHNE_AI_MODEL = o["ai-model"];
if (o["ai-base-url"]) process.env.SAHNE_AI_BASE_URL = o["ai-base-url"];
const agentEdits = o["agent-edits"] as "proposals" | "direct" | undefined;

if (positionals[0] === "mcp") {
  const { startMcpStdio } = await import("./index.ts");
  try {
    await startMcpStdio({ content: o.content, write: o.write, agentEdits, shareCards: o["share-cards"], backstage: o.backstage });
  } catch (e) {
    console.error(`sahne-backstage mcp: ${(e as Error).message}`);
    process.exit(1);
  }
  process.exit(0);
} else if (positionals.length) {
  console.error(`sahne-backstage: unknown command ${positionals[0]} (the one command is mcp)`);
  process.exit(2);
} else {
  const { startBackstage } = await import("./index.ts");
  const b = await startBackstage({ content: o.content, port: Number(o.port), write: o.write, log: true, agentEdits, shareCards: o["share-cards"] });
  console.log(`sahne-backstage on ${b.url}${o.write ? "" : " (read-only: --write to save)"}`);
}
