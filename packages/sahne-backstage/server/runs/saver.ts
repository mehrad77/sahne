// LangGraph's checkpoints in the store's SQLite file (Node only): a port of @langchain/langgraph-checkpoint-sqlite (MIT)
// onto `node:sqlite`, so nothing native is built. A run's step is a thread (`run:r3:cast_derya`); each checkpoint is the
// step's whole state, its tool pictures included, so only the latest checkpoint of a thread and the one before it are
// kept (nothing goes back in time), with their pending writes.

import type { DatabaseSync, StatementSync } from "node:sqlite";
import type { RunnableConfig } from "@langchain/core/runnables";
import { BaseCheckpointSaver, WRITES_IDX_MAP, compareWritesSortKeys, copyCheckpoint, writesSortKey, type Checkpoint, type CheckpointListOptions, type CheckpointMetadata, type CheckpointTuple, type PendingWrite } from "@langchain/langgraph-checkpoint";

interface Row { thread_id: string; checkpoint_ns: string; checkpoint_id: string; parent_checkpoint_id: string | null; type: string | null; checkpoint: Uint8Array; metadata: Uint8Array; pending_writes: string }
interface WriteRow { task_id: string; channel: string; type: string | null; value: string | null; task_path?: string; idx?: number }

const SELECT = `SELECT thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata,
  (SELECT json_group_array(json_object('task_id', w.task_id, 'channel', w.channel, 'type', w.type, 'value', CAST(w.value AS TEXT), 'task_path', w.task_path, 'idx', w.idx))
     FROM writes AS w WHERE w.thread_id = checkpoints.thread_id AND w.checkpoint_ns = checkpoints.checkpoint_ns AND w.checkpoint_id = checkpoints.checkpoint_id) AS pending_writes
  FROM checkpoints`;

export class NodeSqliteSaver extends BaseCheckpointSaver {
  private readonly db: DatabaseSync;
  private latest?: StatementSync;
  private exact?: StatementSync;

  constructor(db: DatabaseSync) {
    super();
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS checkpoints (thread_id TEXT NOT NULL, checkpoint_ns TEXT NOT NULL DEFAULT '', checkpoint_id TEXT NOT NULL, parent_checkpoint_id TEXT, type TEXT, checkpoint BLOB, metadata BLOB, PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id))`);
    db.exec(`CREATE TABLE IF NOT EXISTS writes (thread_id TEXT NOT NULL, checkpoint_ns TEXT NOT NULL DEFAULT '', checkpoint_id TEXT NOT NULL, task_id TEXT NOT NULL, task_path TEXT NOT NULL DEFAULT '', idx INTEGER NOT NULL, channel TEXT NOT NULL, type TEXT, value BLOB, PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx))`);
  }

  private async tuple(row: Row): Promise<CheckpointTuple> {
    const writes = (JSON.parse(row.pending_writes) as WriteRow[])
      .map(w => ({ k: writesSortKey(w.task_path ?? "", w.task_id, w.idx ?? 0), w })).sort((a, b) => compareWritesSortKeys(a.k, b.k)).map(x => x.w);
    const at = (id: string) => ({ configurable: { thread_id: row.thread_id, checkpoint_ns: row.checkpoint_ns, checkpoint_id: id } });
    return {
      config: at(row.checkpoint_id),
      checkpoint: await this.serde.loadsTyped(row.type ?? "json", row.checkpoint) as Checkpoint,
      metadata: await this.serde.loadsTyped(row.type ?? "json", row.metadata) as CheckpointMetadata,
      ...(row.parent_checkpoint_id ? { parentConfig: at(row.parent_checkpoint_id) } : {}),
      pendingWrites: await Promise.all(writes.map(async w => [w.task_id, w.channel, await this.serde.loadsTyped(w.type ?? "json", w.value ?? "")] as [string, string, unknown])),
    };
  }

  async getTuple(config: RunnableConfig): Promise<CheckpointTuple | undefined> {
    const { thread_id, checkpoint_ns = "", checkpoint_id } = (config.configurable ?? {}) as { thread_id?: string; checkpoint_ns?: string; checkpoint_id?: string };
    if (!thread_id) return undefined;
    const row = (checkpoint_id
      ? (this.exact ??= this.db.prepare(`${SELECT} WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id = ?`)).get(thread_id, checkpoint_ns, checkpoint_id)
      : (this.latest ??= this.db.prepare(`${SELECT} WHERE thread_id = ? AND checkpoint_ns = ? ORDER BY checkpoint_id DESC LIMIT 1`)).get(thread_id, checkpoint_ns)) as Row | undefined;
    return row ? this.tuple(row) : undefined;
  }

  async *list(config: RunnableConfig, options?: CheckpointListOptions): AsyncGenerator<CheckpointTuple> {
    const c = (config.configurable ?? {}) as { thread_id?: string; checkpoint_ns?: string };
    const where: string[] = [], args: string[] = [];
    if (c.thread_id) { where.push("thread_id = ?"); args.push(c.thread_id); }
    if (c.checkpoint_ns !== undefined) { where.push("checkpoint_ns = ?"); args.push(c.checkpoint_ns); }
    const before = (options?.before?.configurable as { checkpoint_id?: string } | undefined)?.checkpoint_id;
    if (before) { where.push("checkpoint_id < ?"); args.push(before); }
    const sql = `${SELECT}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY checkpoint_id DESC${options?.limit ? ` LIMIT ${Number(options.limit)}` : ""}`;
    for (const row of this.db.prepare(sql).all(...args) as unknown as Row[]) {
      const t = await this.tuple(row);
      if (options?.filter && Object.entries(options.filter).some(([k, v]) => v !== undefined && JSON.stringify((t.metadata as Record<string, unknown>)?.[k]) !== JSON.stringify(v))) continue;
      yield t;
    }
  }

  async put(config: RunnableConfig, checkpoint: Checkpoint, metadata: CheckpointMetadata): Promise<RunnableConfig> {
    const c = (config.configurable ?? {}) as { thread_id?: string; checkpoint_ns?: string; checkpoint_id?: string };
    if (!c.thread_id) throw new Error(`Missing "thread_id" field in passed "config.configurable".`);
    const ns = c.checkpoint_ns ?? "", parent = c.checkpoint_id ?? null;
    const [[t1, cp], [t2, meta]] = await Promise.all([this.serde.dumpsTyped(copyCheckpoint(checkpoint)), this.serde.dumpsTyped(metadata)]);
    if (t1 !== t2) throw new Error("Failed to serialize checkpoint and metadata to the same type.");
    this.db.exec("BEGIN");
    try {
      this.db.prepare("INSERT OR REPLACE INTO checkpoints (thread_id, checkpoint_ns, checkpoint_id, parent_checkpoint_id, type, checkpoint, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)").run(c.thread_id, ns, checkpoint.id, parent, t1, cp, meta);
      // only this checkpoint and its parent are kept, with their writes
      const keep = [checkpoint.id, parent ?? checkpoint.id];
      this.db.prepare("DELETE FROM checkpoints WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id NOT IN (?, ?)").run(c.thread_id, ns, ...keep);
      this.db.prepare("DELETE FROM writes WHERE thread_id = ? AND checkpoint_ns = ? AND checkpoint_id NOT IN (?, ?)").run(c.thread_id, ns, ...keep);
      this.db.exec("COMMIT");
    } catch (e) { this.db.exec("ROLLBACK"); throw e; }
    return { configurable: { thread_id: c.thread_id, checkpoint_ns: ns, checkpoint_id: checkpoint.id } };
  }

  async putWrites(config: RunnableConfig, writes: PendingWrite[], taskId: string, taskPath?: string): Promise<void> {
    const c = (config.configurable ?? {}) as { thread_id?: string; checkpoint_ns?: string; checkpoint_id?: string };
    if (!c.thread_id || !c.checkpoint_id) throw new Error("Missing thread_id or checkpoint_id field in config.configurable.");
    const special = writes.every(([channel]) => channel in WRITES_IDX_MAP);
    const rows = await Promise.all(writes.map(async ([channel, value], idx) => {
      const [type, data] = await this.serde.dumpsTyped(value);
      return [c.thread_id!, c.checkpoint_ns ?? "", c.checkpoint_id!, taskId, taskPath ?? "", WRITES_IDX_MAP[channel] ?? idx, channel, type, data] as const;
    }));
    const stmt = this.db.prepare(`INSERT ${special ? "OR REPLACE" : "OR IGNORE"} INTO writes (thread_id, checkpoint_ns, checkpoint_id, task_id, task_path, idx, channel, type, value) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    this.db.exec("BEGIN");
    try { for (const r of rows) stmt.run(...r); this.db.exec("COMMIT"); } catch (e) { this.db.exec("ROLLBACK"); throw e; }
  }

  async deleteThread(threadId: string): Promise<void> {
    this.db.prepare("DELETE FROM checkpoints WHERE thread_id = ?").run(threadId);
    this.db.prepare("DELETE FROM writes WHERE thread_id = ?").run(threadId);
  }
}
