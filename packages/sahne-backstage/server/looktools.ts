// The MCP tools for a character's look: read_look lists what Sahne's builder offers for it (each field, its choice now, its
// options and colours), set_look makes choices through the same builder, so a look an agent shapes is always one a person
// could have made on the character's page (normalized, at most 2 KB, no locked part). Both answer with the character's
// portrait. Like edit_doc, set_look goes through `editDoc`: a proposal to accept, or a write, by the mode.

import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createBuilder, portrait, type AvatarDoc, type Builder } from "sahne";
import { kit as kitOf } from "./content.ts";
import { renderPng } from "./render.ts";
import { fail, ok, Refusal, type Result } from "./result.ts";

export interface LookToolsCtx {
  run<A>(tool: string, fn: (a: A) => Promise<Result> | Result): (a: A) => Promise<Result>;
  /** The character as this agent sees it (its pending proposal included). */
  seen(id: string, kind: "character"): Promise<{ doc: Record<string, unknown>; mtime?: number; note: string }>;
  editDoc(kind: "character", id: string, mtime: number | undefined, summary: string, paths: (string | number)[][], fn: (doc: Record<string, unknown>) => Record<string, unknown>): Promise<Result>;
  writeNote: string;
}

/** The builder on a character's look, as their page opens it (author mode: the cast's own parts too). */
function builderOf(avatar: unknown): Builder {
  return createBuilder(kitOf(), avatar ?? {}, { trusted: true, cast: true });
}

type Value = string | number | string[] | null;
/** `{ body: { build: "adult" } }` read as `{ "body.build": "adult" }`, as an agent may well write it; a list or a value stays. */
function flat(o: Record<string, unknown>, at = ""): Record<string, Value> {
  const out: Record<string, Value> = {};
  for (const [k, v] of Object.entries(o)) {
    const key = at ? `${at}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) Object.assign(out, flat(v as Record<string, unknown>, key));
    else out[key] = v as Value;
  }
  return out;
}

const png = (doc: unknown) => { try { return [renderPng(portrait(doc, kitOf(), { framing: "full", size: 360, trusted: true }), { width: 360 })]; } catch { return []; } };

/** Every field the builder offers now, its choice, its options and the palette of each of its colours, as lines. */
function lookLines(b: Builder, only?: string): string[] {
  const out: string[] = [];
  for (const s of b.sections()) {
    if (only && s.id !== only) continue;
    out.push(`## ${s.label} (${s.id})`);
    for (const f of b.fields(s.id)) {
      const now = b.get(f.id);
      const opts = f.kind === "number" || f.kind === "color" ? [] : b.options(f.id).filter(o => !o.locked);
      out.push(`- ${f.id} (${f.label}, ${f.kind}${f.optional ? ", may be none" : ""}${f.max ? `, up to ${f.max}` : ""}) = ${JSON.stringify(now)}`
        + (opts.length ? `\n  options: ${opts.map(o => `${o.value ?? "none"} "${o.label}"${o.tags?.length ? ` [${o.tags.join(" ")}]` : ""}`).join(", ")}` : ""));
      const colours = f.kind === "color" ? 1 : f.colors;
      for (let i = 0; i < colours; i++) {
        const pal = b.colorOptions(f.id, i).filter(c => !c.locked);
        if (pal.length) out.push(`  colour ${i}: ${pal.map(c => `${c.id} "${c.label}"`).join(", ")}`);
      }
    }
  }
  return out;
}

export function registerLookTools(server: McpServer, k: LookToolsCtx): void {
  const { run } = k;

  server.registerTool("read_look", {
    title: "Read a character's look",
    description: "What a character looks like and what can change: each field of Sahne's character builder (body: build and age, height, shape, skin; face; hair; clothes; extras) with its choice now, its options (value \"label\" [tags]) and the palette of each of its colours, and their portrait. Read it before set_look, and pass only values it lists. With section, only that section.",
    inputSchema: { id: z.string(), section: z.string().optional().describe("body, face, hair, clothes or extras") },
    annotations: { readOnlyHint: true },
  }, run("read_look", async ({ id, section }) => {
    const c = await k.seen(id, "character");
    const b = builderOf(c.doc.avatar);
    const lines = lookLines(b, section);
    if (!lines.length) return fail(`no section ${section}: ${b.sections().map(s => s.id).join(", ")}`);
    return ok(`${c.note ? `${c.note}\n` : ""}The look of ${id}${section ? ` (${section})` : ""}:\n${lines.join("\n")}`, { avatar: b.doc }, png(b.doc));
  }));

  server.registerTool("set_look", {
    title: "Shape a character's look",
    description: `Change a character's look through Sahne's builder, as a person does on their page: \`set\` maps a field to a value read_look lists (a multi field takes a list, an optional one null for none; "body.build" first, as it changes what fits), \`colors\` a field to its colour ids by index, and the rest stays. With \`from: "blank"\` it starts from the kit's plain default look instead of theirs (for a new character: then choose every section, body, face, hair, clothes and extras, or the defaults stay). Every choice must be one the builder accepts, or nothing changes and the refusals are named. Answers with the new portrait. ${k.writeNote}`,
    inputSchema: {
      id: z.string(),
      set: z.record(z.string(), z.unknown()).optional().describe("field → value, e.g. { \"body.build\": \"adult\", \"hair.style\": \"hair_long\" } (nested { \"body\": { \"build\": \"adult\" } } works too)"),
      colors: z.record(z.string(), z.unknown()).optional().describe("field → its colour ids by index, e.g. { \"hair.style\": [\"hair_05\"] } (one id for a field of one colour)"),
      from: z.enum(["current", "blank"]).optional().describe("current (default): change their look; blank: start from the kit's default look"),
      mtime: z.number().optional(),
    },
  }, run("set_look", async ({ id, set, colors, from, mtime }) => {
    if (!set && !colors) return fail("nothing to change: pass set, colors or both");
    const c = await k.seen(id, "character");
    if (c.doc.kind === "extra") return fail(`${id} is an extra: extras are written by sahne-story/cast/extras.ts`);
    const b = builderOf(from === "blank" ? {} : c.doc.avatar), refused: string[] = [];
    // a part as the document writes it, { id, colors }, is its choice and its colours
    const sets = flat(set ?? {}), cols = flat(colors ?? {});
    for (const k of Object.keys(sets)) {
      const m = /^(.+)\.(id|style|colors|color)$/.exec(k);
      if (!m || b.field(k) || !b.field(m[1])) continue;
      if (m[2] === "colors" || m[2] === "color") cols[m[1]] ??= sets[k]; else sets[m[1]] ??= sets[k];
      delete sets[k];
    }
    // the build first: it decides what the other fields offer
    const entries = Object.entries(sets).sort(([a], [z2]) => Number(z2 === "body.build") - Number(a === "body.build"));
    for (const [f, v] of entries) {
      if (!b.field(f)) refused.push(`${f}: no such field now (read_look lists them)`);
      else if (!b.set(f, v)) refused.push(`${f} = ${JSON.stringify(v)}: not one of its options`);
    }
    for (const [f, ids] of Object.entries(cols)) [ids].flat().forEach((cid, i) => { if (!b.setColor(f, i, String(cid))) refused.push(`${f} colour ${i} = ${cid}: not in its palette`); });
    if (refused.length) throw new Refusal(`nothing changed; refused:\n${refused.map(r => `- ${r}`).join("\n")}`);
    const avatar = b.doc as AvatarDoc;
    const r = await k.editDoc("character", id, mtime ?? c.mtime, `character ${id}: the look`, [["avatar"]], doc => ({ ...doc, avatar }));
    if (r.isError) return r;
    return { ...r, content: [...r.content, ...png(avatar).map(p => ({ type: "image" as const, data: p.toString("base64"), mimeType: "image/png" as const }))] };
  }));
}
