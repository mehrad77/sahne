// What backstage keeps across a restart (Node only), in one SQLite file per content root (`node:sqlite`, nothing native to
// build): the agents' proposals waiting for a person, and (runs/) the runs and their steps. It lives in the person's config
// folder (`<config>/runs/<hash of the content root>.sqlite`), never in the content root: an app such as Kumru commits that,
// and what is pending is one person's. Each value is a JSON row, written as it changes.

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
  close(): void { this.db.close(); }
}
