// What backstage keeps across a restart (Node only), in one SQLite file per content root (`node:sqlite`, nothing native to
// build): the agents' proposals waiting for a person, and (runs/) the runs and their steps. It lives in the person's config
// folder (`<config>/runs/<hash of the content root>.sqlite`), never in the content root: an app such as Kumru commits that,
// and what is pending is one person's. Each value is a JSON row, written as it changes. Two backstages may open one root's
// store; only one runs its tasks (`claim`).

import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT } from "../../../sahne-story/paths.ts";
import { configDir } from "../settings.ts";

/** The store's file for the content root backstage edits. */
export const storeFile = (): string => join(configDir(), "runs", `${createHash("sha256").update(fileURLToPath(CONTENT)).digest("hex").slice(0, 16)}.sqlite`);

export class Store {
  readonly db: DatabaseSync;
  constructor(file: string = storeFile()) {
    if (file !== ":memory:") mkdirSync(join(file, ".."), { recursive: true });
    this.db = new DatabaseSync(file, { timeout: 5000 }); // two backstages on one root wait for each other
    this.db.exec("CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  }
  /** A value kept under `key`, or `fallback`. */
  get<T>(key: string, fallback: T): T {
    const row = this.db.prepare("SELECT value FROM kv WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) as T : fallback;
  }
  set(key: string, value: unknown): void {
    this.db.prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, JSON.stringify(value));
  }
  /**
   * Take `name` for this process (the runs: one backstage on a root runs its tasks, since each keeps them in memory and
   * writes them whole): null when this process has it now, else the pid of the live one that does.
   */
  claim(name: string): number | null {
    this.db.exec("BEGIN IMMEDIATE");
    let held: number | null = null;
    try {
      const owner = this.get<{ pid: number } | null>(`owner:${name}`, null);
      if (owner && owner.pid !== process.pid && alive(owner.pid)) held = owner.pid;
      else this.set(`owner:${name}`, { pid: process.pid, at: Date.now() });
      this.db.exec("COMMIT");
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
    return held;
  }
  close(): void { this.db.close(); }
}

/** Whether a process is there (one of another user's still is: EPERM). */
function alive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch (e) { return (e as NodeJS.ErrnoException).code === "EPERM"; }
}
