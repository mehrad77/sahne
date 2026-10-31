// An agent's backstage tools (Node only): its own MCP server (mcp.ts) reached as a client over an in-memory transport, so
// the assistant and every step of a run do exactly what any agent can, through the same tools and checks. A call's answer
// becomes what the graph gives the model (agent/graph.ts `Outcome`), with what the editor is told after it: the proposal it
// made, or a card it asks for.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcp, type McpOptions } from "../mcp.ts";
import type { AssistantEvent } from "../assistant.ts";
import type { ToolDef } from "../ai/provider.ts";
import type { Call, Outcome } from "./graph.ts";

export interface Backstage { client: Client; tools: ToolDef[]; readOnly: Set<string>; close(): Promise<void> }

/** A backstage MCP server of these options, connected: its tools as the model gets them, and which only read. */
export async function backstage(o: McpOptions, name = "assistant"): Promise<Backstage> {
  const server = createMcp(o);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name, version: "0.1.0" });
  await Promise.all([server.connect(a), client.connect(b)]);
  const listed = (await client.listTools()).tools;
  return {
    client,
    tools: listed.map(t => ({ name: t.name, description: t.description ?? "", schema: t.inputSchema as Record<string, unknown> })),
    readOnly: new Set(listed.filter(t => t.annotations?.readOnlyHint).map(t => t.name)),
    close: () => client.close().catch(() => {}),
  };
}

/** One call of a backstage tool, as the model reads its answer. */
export async function callTool(client: Client, c: Call): Promise<Outcome> {
  try {
    const out = await client.callTool({ name: c.name, arguments: c.input }) as { content?: { type: string; text?: string; data?: string; mimeType?: string }[]; isError?: boolean };
    const texts = (out.content ?? []).filter(x => x.type === "text").map(x => x.text ?? "");
    const images = (out.content ?? []).filter(x => x.type === "image" && x.data).map(x => ({ data: x.data!, mimeType: x.mimeType ?? "image/png" }));
    const after: AssistantEvent[] = [];
    if (!out.isError) {
      try {
        const j = JSON.parse(texts.at(-1) ?? "");
        if (typeof j.proposal === "string") after.push({ type: "proposal", id: j.proposal });
        if (j.ask && typeof j.ask.question === "string") after.push({ type: "ask", ...j.ask });
      } catch { /* no proposal */ }
    }
    return { text: texts.join("\n\n"), isError: !!out.isError, summary: (texts[0] ?? "").split("\n")[0].slice(0, 240), ...(images.length ? { images } : {}), after };
  } catch (err) { return { text: `the tool failed: ${(err as Error).message}`, isError: true }; }
}
