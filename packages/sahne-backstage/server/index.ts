// sahne-backstage's server, for an app to start (Kumru's scripts/backstage.mjs) or the CLI (cli.ts): one content root per
// process, since sahne-story's paths.ts reads SAHNE_CONTENT once. `content` (an absolute folder) sets it before the content
// modules load; without it the root is $SAHNE_CONTENT or the samples. Nothing is written unless `write` is true.

import { isAbsolute, resolve } from "node:path";
import type { Running } from "./http.ts";

export interface BackstageOptions {
  /** The content root, an absolute folder (default: $SAHNE_CONTENT, or sahne-story's samples). */
  content?: string;
  /** The port (default 5181; 0 for any free one). */
  port?: number;
  /** Allow saves (default false: read-only). */
  write?: boolean;
  /** Log esbuild's rebuilds. */
  log?: boolean;
}

let root: string | null = null;

/** Start backstage; resolves when it listens. */
export async function startBackstage(o: BackstageOptions = {}): Promise<Running> {
  const content = o.content ?? process.env.SAHNE_CONTENT ?? "";
  if (content && !isAbsolute(content)) throw new Error(`the content root must be an absolute folder, not ${content}`);
  const want = content ? resolve(content) : "";
  if (root !== null && root !== want) throw new Error(`this process serves ${root || "the samples"} already: one content root per process`);
  root = want;
  if (want) process.env.SAHNE_CONTENT = want; else delete process.env.SAHNE_CONTENT;
  const { serve } = await import("./http.ts");
  return serve({ port: o.port ?? 5181, write: o.write === true, log: o.log });
}
