// Who is working on the content root besides the people (Node only): the MCP clients connected over HTTP, and what
// every agent did lately (each tool call: who, which tool, whether it worked, how long it took, its answer's first
// line). The assistant's calls are here too, and a stdio agent's when it runs with --backstage (it posts them to
// `POST /api/events`). Kept in memory for the editor's Agents page (`GET /api/agents`); nothing is written.

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Events } from "./events.ts";
import type { AgentEdits } from "./mcp.ts";

/** One tool call by an agent. */
export interface Call { at: number; by: string; tool: string; ok: boolean; ms: number; summary: string }
/** An MCP client connected over HTTP. */
export interface Session { id: string; client: string; version?: string; agentEdits: AgentEdits; since: number; lastAt?: number; calls: number }
/** A tool as an agent sees it. */
export interface ToolInfo { name: string; title?: string; description: string; readOnly: boolean }

/** How many calls are kept. */
const KEEP = 200;

/** A call as an editor or a forwarder sends it, checked; null when it is not one. */
export function callOf(v: unknown): Call | null {
  const c = v as Partial<Call>;
  if (!c || typeof c.tool !== "string" || typeof c.by !== "string") return null;
  return { at: typeof c.at === "number" ? c.at : Date.now(), by: c.by.slice(0, 80), tool: c.tool.slice(0, 80), ok: c.ok !== false, ms: typeof c.ms === "number" ? Math.max(0, Math.round(c.ms)) : 0, summary: String(c.summary ?? "").slice(0, 300) };
}

export class Agents {
  private calls: Call[] = [];
  private live = new Map<string, { server: McpServer; agentEdits: AgentEdits; since: number; lastAt?: number; calls: number }>();
  private tools: ToolInfo[] | null = null;
  private readonly events: Events;
  constructor(events: Events) { this.events = events; }

  /** Note a tool call, and tell the editors (`activity`). */
  record(c: Call, session?: string): void {
    this.calls.push(c);
    if (this.calls.length > KEEP) this.calls.splice(0, this.calls.length - KEEP);
    const s = session ? this.live.get(session) : undefined;
    if (s) { s.calls++; s.lastAt = c.at; }
    this.events.emit("activity", c);
  }

  open(id: string, server: McpServer, agentEdits: AgentEdits): void { this.live.set(id, { server, agentEdits, since: Date.now(), calls: 0 }); this.events.emit("activity", null); }
  close(id: string): void { if (this.live.delete(id)) this.events.emit("activity", null); }

  sessions(): Session[] {
    return [...this.live].map(([id, s]) => {
      const v = s.server.server.getClientVersion();
      return { id, client: v?.name ?? "an MCP client", ...(v?.version ? { version: v.version } : {}), agentEdits: s.agentEdits, since: s.since, ...(s.lastAt ? { lastAt: s.lastAt } : {}), calls: s.calls };
    });
  }

  /** The latest calls, newest first. */
  recent(n = 50): Call[] { return this.calls.slice(-n).reverse(); }

  /** The tools, as an MCP client lists them from a server made by `make` (once). */
  async catalog(make: () => McpServer): Promise<ToolInfo[]> {
    if (this.tools) return this.tools;
    const server = make(), [a, b] = InMemoryTransport.createLinkedPair(), client = new Client({ name: "backstage-catalog", version: "0.1.0" });
    await Promise.all([server.connect(a), client.connect(b)]);
    try {
      this.tools = (await client.listTools()).tools.map(t => ({ name: t.name, ...(t.title ? { title: t.title } : {}), description: t.description ?? "", readOnly: t.annotations?.readOnlyHint === true }));
    } finally { await client.close().catch(() => {}); }
    return this.tools;
  }
}
