// A content file as git's HEAD has it (Node only, read-only): what an edit is compared with ("changed since the last
// commit"). The content root may be any git repo (Kumru's data/ is in Kumru's), or none: then there is no HEAD.

import { execFile } from "node:child_process";
import { dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { fileOf, type Kind } from "./content.ts";

const run = (args: string[], cwd: string) => new Promise<string | null>(res =>
  execFile("git", args, { cwd, maxBuffer: 16 << 20 }, (err, out) => res(err ? null : out)));

/** The document at HEAD, or null (no repo, or not committed yet). */
export async function headOf(kind: Kind, id: string): Promise<unknown> {
  const file = fileURLToPath(fileOf(kind, id)), dir = dirname(file);
  const top = (await run(["rev-parse", "--show-toplevel"], dir))?.trim();
  if (!top) return null;
  const text = await run(["show", `HEAD:${relative(top, file).split("\\").join("/")}`], top);
  try { return text === null ? null : JSON.parse(text); } catch { return null; }
}
