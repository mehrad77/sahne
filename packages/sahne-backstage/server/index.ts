// sahne-backstage's server, for an app to start (Kumru's scripts/backstage.mjs) or the CLI (cli.ts): one content root per
// process, since sahne-story's paths.ts reads SAHNE_CONTENT once. `content` (an absolute folder) sets it before the content
// modules load; without it the root is $SAHNE_CONTENT or the samples. Nothing is written unless `write` is true.
// `startMcpStdio` runs only the MCP server (mcp.ts) on stdin and stdout, for an agent that starts it itself.

import { isAbsolute, resolve } from "node:path";
import type { Running } from "./http.ts";
import type { AgentEdits } from "./mcp.ts";

export interface BackstageOptions {
  /** The content root, an absolute folder (default: $SAHNE_CONTENT, or sahne-story's samples). */
  content?: string;
  /** The port (default 5181; 0 for any free one). */
  port?: number;
  /** Allow saves (default false: read-only). */
  write?: boolean;
  /** Log esbuild's rebuilds. */
  log?: boolean;
  /** Where agents' edits go: proposals a person accepts (the default), or saved at once. */
  agentEdits?: AgentEdits;
  /** Let agents see a word card's main-language word (default false: ids and levels only). */
  shareCards?: boolean;
}

let root: string | null = null;

/** Set the process's content root, once. */
function useRoot(content: string | undefined) {
  const c = content ?? process.env.SAHNE_CONTENT ?? "";
  if (c && !isAbsolute(c)) throw new Error(`the content root must be an absolute folder, not ${c}`);
  const want = c ? resolve(c) : "";
  if (root !== null && root !== want) throw new Error(`this process serves ${root || "the samples"} already: one content root per process`);
  root = want;
  if (want) process.env.SAHNE_CONTENT = want; else delete process.env.SAHNE_CONTENT;
}

const agentEditsOf = (v: unknown): AgentEdits => {
  if (v === undefined || v === "proposals" || v === "direct") return (v ?? "proposals") as AgentEdits;
  throw new Error(`agentEdits is "proposals" or "direct", not ${String(v)}`);
};

/** Start backstage; resolves when it listens. */
export async function startBackstage(o: BackstageOptions = {}): Promise<Running> {
  useRoot(o.content);
  const { serve } = await import("./http.ts");
  return serve({ port: o.port ?? 5181, write: o.write === true, log: o.log, agentEdits: agentEditsOf(o.agentEdits), shareCards: o.shareCards === true });
}

export interface McpStdioOptions extends Omit<BackstageOptions, "port" | "log"> {
  /** A running backstage (http://localhost:<port>/) to send proposals and `show` to, so its open editors see them. */
  backstage?: string;
}

/**
 * Serve MCP on stdin and stdout until stdin closes. Nothing but MCP frames goes to stdout: console.log is sent to stderr.
 * The content root is read again before each tool call, since a backstage in another process may write the same files.
 */
export async function startMcpStdio(o: McpStdioOptions = {}): Promise<void> {
  console.log = console.error;
  console.info = console.error;
  useRoot(o.content);
  const [{ StdioServerTransport }, { createMcp }, { Events }, { remoteQueue }] = await Promise.all([
    import("@modelcontextprotocol/sdk/server/stdio.js"), import("./mcp.ts"), import("./events.ts"), import("./proposals.ts"),
  ]);
  const events = new Events();
  const remote = o.backstage ? new URL(o.backstage.endsWith("/") ? o.backstage : `${o.backstage}/`) : null;
  const queue = remote ? remoteQueue(remote.href) : undefined;
  if (remote) {
    // the running backstage's editors see what this process does: `show`, and the documents it writes in direct mode
    events.on((name, data) => {
      if (name !== "show" && name !== "doc") return;
      fetch(new URL("api/events", remote), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ event: name, data }) })
        .catch(e => console.error(`sahne-backstage mcp: could not reach ${remote.href}: ${(e as Error).message}`));
    });
  }
  const selection = remote ? async () => {
    try { return ((await (await fetch(new URL("api/selection", remote))).json()) as { selection: null }).selection; } catch { return null; }
  } : undefined;
  const server = createMcp({ write: o.write === true, agentEdits: agentEditsOf(o.agentEdits), shareCards: o.shareCards === true, events, queue, fresh: true, selection });
  const transport = new StdioServerTransport();
  const done = new Promise<void>(r => { transport.onclose = () => r(); process.stdin.on("end", () => r()); });
  await server.connect(transport);
  console.error(`sahne-backstage mcp on stdio${o.write ? "" : " (read-only: --write to edit)"}, agent edits: ${agentEditsOf(o.agentEdits)}${remote ? `, editors at ${remote.href}` : ""}`);
  await done;
}
