// The drawing loop as MCP tools (Node only; registered by mcp.ts): an agent finds a kit item, reads a neighbour, drafts a
// new item or variant and looks at its sheet, revises until nothing is wrong, and saves it. Every check is sahne-kit's own
// (`checkPiece`, `compileDrawing`) and every save goes through mcp.ts's `submit()`, so `--write`, proposals and direct mode and
// `--backstage` forwarding all work as for an episode.
//
// A set piece or prop written in TypeScript is read when the process starts: `kit_render` and `kit_read` say so when its
// source changed since; a client that starts a process per call always sees the current source.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import * as z from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Kit, PieceDef } from "sahne";
import { checkPiece, problemLine, type As } from "../../sahne-kit/src/check.ts";
import { CONTENT_ID, type DrawingDoc, type VariantDoc } from "../../sahne-kit/src/drawing.ts";
import { FAMILY_MODULES } from "../../sahne-kit/src/set/all.ts";
import { kitSheetSvg, type SheetItem } from "../../sahne-kit/src/set-svg.ts";
import { paramProblems } from "../../sahne-story/src/index.ts";
import { exists, kit as kitOf, kitDocs, kitWithEdits, readDoc } from "./content.ts";
import { renderPng } from "./render.ts";
import { fail, ok, Refusal, type Result } from "./result.ts";
import type { ProposalEdit } from "./proposals.ts";

export type KitSlot = "set" | "props";
type Use = "set" | "prop" | "both";

/** What mcp.ts lends the kit tools: its tool wrapper, the one door edits go through, and the mode. */
export interface KitToolsCtx {
  run<A>(tool: string, fn: (a: A) => Promise<Result> | Result): (a: A) => Promise<Result>;
  readOnly(): string | null;
  submit(edits: ProposalEdit[], m: { summary: string; paths: (string | number)[][]; after?: string }): Promise<Result>;
  /** The id of this agent's latest pending proposal on a document (proposals mode), so a second save builds on the first. */
  latest(kind: "kit_piece" | "kit_variant", id: string): Promise<string | undefined>;
  writeNote: string;
}

const SET_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../sahne-kit/src/set");
const KIT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const STARTED = Date.now();

// ---- finding items -------------------------------------------------------------------------------------------------------

/** The family each set piece and prop is in (`set:chair` → "furniture"), by the kit's own family modules. */
const FAMILY = new Map<string, string>();
for (const [name, f] of Object.entries(FAMILY_MODULES)) {
  for (const id of Object.keys(f.set)) FAMILY.set(`set:${id}`, name);
  for (const id of Object.keys(f.props)) FAMILY.set(`props:${id}`, name);
}

export interface Row { id: string; family: string; as: Use; about: string; tags: string[]; variants: string[]; slot: KitSlot; def: PieceDef }

/** Every set piece and prop of the kit with the content root's own items: one row per generator (one id in both maps with one generator is `both`). */
export function pieceRows(kit: Kit = kitOf()): Row[] {
  const own = new Set(kitDocs().docs.filter((d): d is DrawingDoc => !("of" in d)).map(d => d.id));
  const rows: Row[] = [];
  const row = (id: string, slot: KitSlot, as: Use): Row => {
    const def = (slot === "set" ? kit.set : kit.props)[id];
    return { id, family: FAMILY.get(`${slot}:${id}`) ?? (own.has(id) ? "series" : "?"), as, about: def.meta?.about ?? "", tags: def.meta?.tags ?? [], variants: Object.keys(def.variants ?? {}), slot, def };
  };
  for (const id of new Set([...Object.keys(kit.set ?? {}), ...Object.keys(kit.props ?? {})])) {
    const s = kit.set?.[id], p = kit.props?.[id];
    if (s && p && s === p) rows.push(row(id, "set", "both"));
    else { if (s) rows.push(row(id, "set", "set")); if (p) rows.push(row(id, "props", "prop")); }
  }
  return rows;
}

/** The row an id and a wanted use name: `as` picks when the id is in both maps with different generators. */
function rowOf(id: string, as?: "set" | "prop", kit: Kit = kitOf()): Row {
  const rows = pieceRows(kit).filter(r => r.id === id);
  if (!rows.length) throw new Refusal(`there is no set piece or prop ${id} (kit_search finds them)`);
  const pick = as ? rows.find(r => r.as === as || r.as === "both") : rows[0];
  if (!pick) throw new Refusal(`${id} is not a ${as}: it is a ${rows.map(r => r.as).join(" and ")}`);
  return pick;
}

const asOf = (r: Row, kit: Kit): As => ({ ids: [r.id], set: kit.set?.[r.id] === r.def, prop: kit.props?.[r.id] === r.def });

// ---- a generator's source --------------------------------------------------------------------------------------------------

/** Where a TypeScript generator is written: its family file, and the text of its definition (with the comment above it). */
function sourceOf(r: Row): { file: string; line?: number; text?: string } | null {
  if (!FAMILY.has(`${r.slot}:${r.id}`)) return null;
  const path = join(SET_DIR, `${r.family}.ts`), file = relative(KIT_ROOT, path), src = readFileSync(path, "utf8"), lines = src.split("\n");
  // the registry names the generator's variable: `{ food, tea, plate: plateP }` or `"x": f`
  const reg = new RegExp(`[{,]\\s*["']?${r.id}["']?\\s*(?::\\s*([A-Za-z_$][\\w$]*))?\\s*(?=[,}])`).exec(src);
  const idents = [reg?.[1], r.id].filter((x): x is string => !!x);
  for (const name of idents) {
    const at = lines.findIndex(l => new RegExp(`^(export\\s+)?(const|function)\\s+${name.replace(/\$/g, "\\$")}\\b`).test(l));
    if (at < 0) continue;
    let from = at;
    while (from > 0 && /^\s*(\/\*\*|\*|\/\/)/.test(lines[from - 1])) from--;
    let to = at;
    while (to < lines.length - 1 && to - at < 140 && !/^[}\]];?\s*$/.test(lines[to])) to++;
    return { file, line: at + 1, text: lines.slice(from, to + 1).join("\n") };
  }
  return { file };
}

/** A note when the kit's TypeScript was edited after this process read it, else null. */
function stale(r: Row): string | null {
  if (!FAMILY.has(`${r.slot}:${r.id}`)) return null;
  const newest = readdirSync(SET_DIR).filter(f => f.endsWith(".ts")).map(f => ({ f, t: statSync(join(SET_DIR, f)).mtimeMs })).sort((a, b) => b.t - a.t)[0];
  return newest && newest.t > STARTED ? `note: sahne-kit/src/set/${newest.f} changed after this process started, so this is the code it read then; start a new process to see the current source` : null;
}

// ---- checking and drawing -------------------------------------------------------------------------------------------------

interface Target { kit: Kit; row: Row; slot: KitSlot }

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A drafted drawing in the kit, or what is wrong with it: the schema, the id rules, the caps, the paths. Writes nothing. */
function draftPiece(doc: unknown): Target {
  if (!isObject(doc) || typeof doc.id !== "string") throw new Refusal("a drawing is an object with an id (x_ then lowercase letters, digits and _)");
  if (!CONTENT_ID.test(doc.id)) throw new Refusal(`id ${JSON.stringify(doc.id)}: a content id starts with x_ (then lowercase letters, digits and _): the kit's own ids are never changed or taken`);
  const { kit, problems } = kitWithEdits([{ kind: "kit_piece", id: doc.id, doc }]);
  if (problems.length) throw new Refusal(`${doc.id} is not a good drawing:\n${problems.map(p => p.message).join("\n")}`);
  const row = rowOf(doc.id, undefined, kit);
  return { kit, row, slot: (doc as unknown as DrawingDoc).as === "prop" ? "props" : row.slot };
}

/** A drafted variant in the kit. */
function draftVariant(of: string, name: string, params: Record<string, unknown>): { target: Target; problems: string[] } {
  if (!CONTENT_ID.test(name)) throw new Refusal(`name ${JSON.stringify(name)}: a content variant's name starts with x_ (then lowercase letters, digits and _)`);
  const doc: VariantDoc = { of, name, params };
  const { kit, problems } = kitWithEdits([{ kind: "kit_variant", id: `${of}.${name}`, doc }]);
  if (problems.length) throw new Refusal(`${of}.${name} is not a good variant:\n${problems.map(p => p.message).join("\n")}`);
  const row = rowOf(of, undefined, kit);
  const own = ["variant", "n", "held"];
  const lines = paramProblems(row.def, params, own).filter(p => p.level === "error").map(p => `error: ${p.message}`);
  return { target: { kit, row, slot: row.slot }, problems: lines };
}

/** The kit's own checks on a generator as lines (`error:`/`warning:` first), and how many are errors. */
function checks(t: Target, extra: string[] = []): { lines: string[]; errors: number; warnings: number } {
  const ps = checkPiece(t.row.def, asOf(t.row, t.kit), t.kit);
  const lines = [...extra, ...ps.map(p => `${p.level} [${p.rule}] ${problemLine(p).replace(/^warning: /, "")}`)];
  const errors = extra.length + ps.filter(p => p.level === "error").length;
  return { lines, errors, warnings: ps.length - ps.filter(p => p.level === "error").length };
}

const VIEWS = z.array(z.enum(["day", "night"])).max(2);

/** PNG sheets of an item, one per seed. */
function sheets(t: Target, o: { looks?: [string, Record<string, unknown>][]; views?: ("day" | "night")[]; seeds?: string[] }): Buffer[] {
  const item: SheetItem = { id: t.row.id, def: t.row.def, kind: t.slot, ...(o.looks ? { looks: o.looks } : {}) };
  return (o.seeds?.length ? o.seeds : ["a"]).map(seed => renderPng(kitSheetSvg(t.kit, [item], { seed, ...(o.views?.length ? { views: o.views } : {}) })));
}

// ---- a list of items on one sheet -----------------------------------------------------------------------------------------

const MANY_MAX = 16;
const ITEM = z.object({
  id: z.string().optional().describe("A kit item id"), doc: z.record(z.string(), z.unknown()).optional().describe("A drawing document not yet saved"),
  as: z.enum(["set", "prop"]).optional(), params: z.record(z.string(), z.unknown()).optional().describe("The look to draw: params like { \"n\": 3 }"), variant: z.string().optional(),
});
type Req = z.infer<typeof ITEM>;

/** Several items on ONE sheet: a labelled cell per item (its default, or the `variant`/`params` look given), by day and night. Drafted docs are checked together. */
function many(reqs: Req[], o: { views?: ("day" | "night")[]; seeds?: string[] }): { text: string; data: unknown; pngs: Buffer[] } {
  if (reqs.some(r => (r.id === undefined) === (r.doc === undefined))) throw new Refusal("each item is an id or a doc, one of them");
  const docs = reqs.filter(r => r.doc !== undefined).map(r => r.doc!);
  for (const d of docs) if (!isObject(d) || typeof d.id !== "string" || !CONTENT_ID.test(d.id)) throw new Refusal(`a drawing needs an id that starts with x_ (then lowercase letters, digits and _), not ${JSON.stringify(isObject(d) ? d.id : d)}`);
  let kit = kitOf();
  if (docs.length) {
    const r = kitWithEdits(docs.map(d => ({ kind: "kit_piece" as const, id: (d as { id: string }).id, doc: d })));
    if (r.problems.length) throw new Refusal(`not drawable:\n${r.problems.map(p => p.message).join("\n")}`);
    kit = r.kit;
  }
  const items: SheetItem[] = [], lines: string[] = [], rows: { id: string; problems: string[]; errors: number }[] = [];
  for (const r of reqs) {
    const row = rowOf(r.id ?? (r.doc as { id: string }).id, r.as, kit), slot: KitSlot = r.as ? (r.as === "prop" ? "props" : "set") : row.slot;
    if (r.variant !== undefined && !Object.hasOwn(row.def.variants ?? {}, r.variant)) throw new Refusal(`${row.id} has no variant ${r.variant} (${Object.keys(row.def.variants ?? {}).join(", ") || "none"})`);
    const bad = r.params ? paramProblems(row.def, r.params, ["variant", "n", "held"]) : [];
    if (bad.length) throw new Refusal(`${row.id} params: ${bad.map(p => p.message).join("; ")}`);
    const word = (k: string, v: unknown) => (v === true ? k : `${k} ${typeof v === "string" ? v : JSON.stringify(v)}`);
    const look: [string, Record<string, unknown>] = r.params || r.variant !== undefined ? [r.variant ?? Object.entries(r.params ?? {}).map(([k, v]) => word(k, v)).join(", ").slice(0, 40), { ...(r.variant !== undefined ? { variant: r.variant } : {}), ...r.params }] : ["default", {}];
    items.push({ id: row.id, def: row.def, kind: slot, looks: [look] });
    const c = checks({ kit, row, slot });
    lines.push(summary(row.id, c), ...c.lines.map(l => `  ${l}`));
    rows.push({ id: row.id, problems: c.lines, errors: c.errors });
  }
  const pngs = (o.seeds?.length ? o.seeds : ["a"]).map(seed => renderPng(kitSheetSvg(kit, items, { seed, flow: true, ...(o.views?.length ? { views: o.views } : {}) })));
  return { text: `${items.length} items on ${pngs.length === 1 ? "one sheet" : `${pngs.length} sheets (one per seed)`}\n${lines.join("\n")}`, data: { items: rows, sheets: pngs.length }, pngs };
}

const summary = (id: string, c: { errors: number; warnings: number }) => `${id}: ${c.errors} error${c.errors === 1 ? "" : "s"}, ${c.warnings} warning${c.warnings === 1 ? "" : "s"}${c.errors ? ": fix them before saving" : ""}`;

// ---- the guide ----------------------------------------------------------------------------------------------------------

const KIT_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../sahne-kit");
/** A `## heading` of a Markdown file with its text, up to the next `## `. */
function section(md: string, heading: string): string {
  const at = md.search(new RegExp(`^## ${heading}\\s*$`, "m"));
  if (at < 0) return "";
  const rest = md.slice(at), next = rest.slice(3).search(/^## /m);
  return (next < 0 ? rest : rest.slice(0, next + 3)).trimEnd();
}
const guide = () => {
  const style = readFileSync(join(KIT_DIR, "STYLE.md"), "utf8");
  return [readFileSync(join(KIT_DIR, "DRAWING.md"), "utf8").trimEnd(), "# From STYLE.md", ...["Paper", "Places", "Props"].map(h => section(style, h))].join("\n\n");
};

// ---- the tools -----------------------------------------------------------------------------------------------------------

const DOC = z.record(z.string(), z.unknown());
const SEEDS = z.array(z.string().min(1).max(24)).max(3);

export function registerKitTools(server: McpServer, k: KitToolsCtx): void {
  const { run } = k;

  server.registerResource("kit-guide", "sahne://kit-guide", { title: "How to draw a kit item", description: "sahne-kit's DRAWING.md (the format and the loop) and STYLE.md's Paper, Places and Props: the look a piece must have.", mimeType: "text/markdown" },
    uri => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: guide() }] }));

  server.registerTool("kit_read", {
    title: "Read a set piece or prop",
    description: "A set piece or prop to study before drawing a neighbour: what it is, its family, its params (type, default, values), its variants and what they set, and its source (a TypeScript generator's definition and file) or its document (a drawing of this series, with the mtime to pass to save_kit_item), with its sheet as a picture. Give a content variant as <generator>.<x_name> to read its document.",
    inputSchema: { id: z.string().describe("A set piece or prop id, like chair or x_cafe_chalkboard; <generator>.<x_name> for a variant document"), as: z.enum(["set", "prop"]).optional().describe("Which one when the id is both a set piece and a different prop") },
    annotations: { readOnlyHint: true },
  }, run("kit_read", ({ id, as }) => {
    if (id.includes(".")) {
      if (!exists("kit_variant", id)) throw new Refusal(`there is no variant document ${id} in this content root`);
      const d = readDoc("kit_variant", id);
      return ok(`${id} (mtime ${d.mtime})`, { doc: d.doc, mtime: d.mtime });
    }
    const r = rowOf(id, as), kit = kitOf(), meta = r.def.meta;
    const own = exists("kit_piece", id) ? readDoc("kit_piece", id) : null;
    const note = stale(r);
    const data = {
      id, family: r.family, as: r.as, about: r.about, tags: r.tags, terms: meta?.terms ?? [], states: meta?.states ?? [],
      params: meta?.params ?? {}, variants: r.def.variants ?? {}, solid: !!r.def.solid,
      ...(own ? { doc: own.doc, mtime: own.mtime } : { source: sourceOf(r) }),
    };
    return ok(`${id}: ${r.family} ${r.as} — ${r.about}${own ? ` (mtime ${own.mtime})` : ""}${note ? `\n${note}` : ""}`, data, sheets({ kit, row: r, slot: r.slot }, {}));
  }));

  server.registerTool("kit_render", {
    title: "Render a set piece or prop",
    description: "A sheet of an item as a PNG, with the kit's checks on it (the same ones the gate runs). Give an `id` (a kit item or one of this series) or a `doc` (a drawing not yet saved). The sheet shows its default, each variant, and for a prop three of it and held, by day and by night, each on a 10 cm grid beside a 170 cm adult; give `variant` or `params` for one look, `views` for day or night only, `seeds` (up to 3) for a picture per seed. `as` picks the set piece or the prop look (a prop also shows n 3 and held). A TypeScript generator is drawn from the source the process read at its start (call.ts --session restarts its server when the source changes).",
    inputSchema: {
      id: z.string().optional().describe("A kit item id"), doc: DOC.optional().describe("A drawing document to render without saving it"), as: z.enum(["set", "prop"]).optional(),
      items: z.array(ITEM).min(1).max(MANY_MAX).optional().describe("Instead of id/doc: a list of items (each { id | doc, as?, variant?, params? }) drawn on ONE sheet, a labelled cell per item (its default look, or the variant/params given), by day and night. For comparing a family or checking a batch in one look"),
      params: z.record(z.string(), z.unknown()).optional().describe("One look: the params to draw it with, like { \"n\": 3, \"label\": \"Menu\" }"), variant: z.string().optional(), views: VIEWS.optional(), seeds: SEEDS.optional(),
    },
    annotations: { readOnlyHint: true },
  }, run("kit_render", ({ id, doc, as, params, variant, views, seeds, items }) => {
    if (items) {
      if (id !== undefined || doc !== undefined) throw new Refusal("give items, or an id or a doc, not both");
      const m = many(items, { views, seeds });
      return ok(m.text, m.data, m.pngs);
    }
    if ((id === undefined) === (doc === undefined)) throw new Refusal("give an id or a doc, one of them");
    const t = doc !== undefined ? draftPiece(doc) : (() => { const r = rowOf(id!, as); return { kit: kitOf(), row: r, slot: r.slot } as Target; })();
    if (as) t.slot = as === "prop" ? "props" : "set";
    if (variant !== undefined && !Object.hasOwn(t.row.def.variants ?? {}, variant)) throw new Refusal(`${t.row.id} has no variant ${variant} (${Object.keys(t.row.def.variants ?? {}).join(", ") || "none"})`);
    const bad = params ? paramProblems(t.row.def, params, ["variant", "n", "held"]) : [];
    if (bad.length) throw new Refusal(`params: ${bad.map(p => p.message).join("; ")}`);
    const looks: [string, Record<string, unknown>][] | undefined = params || variant !== undefined
      ? [[variant ?? "params", { ...(variant !== undefined ? { variant } : {}), ...params }]] : undefined;
    const c = checks(t), note = stale(t.row);
    const pngs = sheets(t, { looks, views, seeds });
    return ok(`${summary(t.row.id, c)}${note ? `\n${note}` : ""}`, { id: t.row.id, family: t.row.family, as: t.row.as, problems: c.lines, sheets: pngs.length }, pngs);
  }));

  server.registerTool("draft_kit_item", {
    title: "Draft a drawing",
    description: "Check a drawing document (`sahne-kit/drawing`, the kit-guide resource has the format) as it would be saved, and render its sheet: nothing is written. It checks the schema, the id (x_…), the caps, every path and `$param`, and the kit's own checks on the piece. A document that cannot be drawn is answered with what to fix; a drawn one with its sheet and the problems that remain (errors fail a save; warnings are advice). Revise and draft again until there are none, then save_kit_item.",
    inputSchema: { doc: DOC.optional().describe("The drawing: { id: \"x_…\", as, about, params?, kinds, … }"), docs: z.array(DOC).min(2).max(MANY_MAX).optional().describe("Instead of doc: several drawings, checked together and drawn on ONE sheet, a labelled cell each"), as: z.enum(["set", "prop"]).optional().describe("For a drawing that is `both`: which look to render"), views: VIEWS.optional(), seeds: SEEDS.optional() },
    annotations: { readOnlyHint: true },
  }, run("draft_kit_item", ({ doc, docs, as, views, seeds }) => {
    if (docs) {
      if (doc !== undefined) throw new Refusal("give doc or docs, not both");
      const m = many(docs.map(d => ({ doc: d, ...(as ? { as } : {}) })), { views, seeds });
      return ok(m.text, m.data, m.pngs);
    }
    if (doc === undefined) throw new Refusal("give a doc (or docs)");
    const t = draftPiece(doc);
    if (as) t.slot = as === "prop" ? "props" : "set";
    const c = checks(t), pngs = sheets(t, { views, seeds });
    return ok(`${summary(t.row.id, c)}${exists("kit_piece", t.row.id) ? " (it revises the saved one)" : ""}`, { id: t.row.id, problems: c.lines, errors: c.errors }, pngs);
  }));

  server.registerTool("draft_variant", {
    title: "Draft a variant",
    description: "Check a named look of a generator the kit already has (`of`: a set piece or prop, a TypeScript one or a drawing) as a variant document `{ of, name: \"x_…\", params }` would be saved, and render it beside the default: nothing is written. Its params must be ones the generator declares (kit_read lists them), with legal values.",
    inputSchema: { of: z.string().describe("The generator's id"), name: z.string().describe("x_ then lowercase letters, digits and _"), params: z.record(z.string(), z.unknown()), views: VIEWS.optional() },
    annotations: { readOnlyHint: true },
  }, run("draft_variant", ({ of, name, params, views }) => {
    const { target: t, problems } = draftVariant(of, name, params);
    const c = checks(t, problems), id = `${of}.${name}`;
    const pngs = sheets(t, { looks: [["default", {}], [name, { variant: name }]], views });
    return ok(summary(id, c), { id, problems: c.lines, errors: c.errors }, pngs);
  }));

  /** The shared body of both saves: refuse on errors, a missing x_, an id already on disk without its mtime, or a file changed since. */
  async function save(kind: "kit_piece" | "kit_variant", id: string, next: unknown, mtime: number | undefined, errors: () => { lines: string[]; errors: number; warnings: number }, what: string): Promise<Result> {
    const why = k.readOnly();
    if (why) return fail(why);
    const c = errors();
    if (c.errors) return fail(`not saved: ${summary(id, c)}\n${c.lines.join("\n")}`);
    const has = exists(kind, id), disk = has ? readDoc(kind, id).mtime : undefined;
    if (has && mtime === undefined) return fail(`${what} ${id} exists already: ids are permanent. To replace it, read it (kit_read gives its mtime) and pass the mtime`);
    if (has && mtime !== disk) return fail(`${what} ${id} changed on disk since you read it (mtime ${mtime}, now ${disk}): read it again`);
    const after = await k.latest(kind, id);
    return k.submit([{ kind, doc: id, next, ...(has ? { base: disk } : { create: true }) }], { summary: `${has ? "change" : "add"} the ${what} ${id}`, paths: [], after });
  }

  server.registerTool("save_kit_item", {
    title: "Save a drawing",
    description: `Save a drawing into this content root's kit (kit/pieces/<id>.json), after the checks draft_kit_item runs: errors, an id that does not start with x_, and an id already saved (unless you pass the mtime kit_read gave) are refused. ${k.writeNote}`,
    inputSchema: { doc: DOC, mtime: z.number().optional().describe("The mtime kit_read gave, to replace a saved drawing") },
    annotations: { destructiveHint: false },
  }, run("save_kit_item", ({ doc, mtime }) => {
    const why = k.readOnly();
    if (why) return fail(why);
    const t = draftPiece(doc);
    return save("kit_piece", t.row.id, doc, mtime, () => checks(t), "drawing");
  }));

  server.registerTool("save_variant", {
    title: "Save a variant",
    description: `Save a named look of an existing generator into this content root's kit (kit/variants/<of>.<name>.json), after the checks draft_variant runs. ${k.writeNote}`,
    inputSchema: { of: z.string(), name: z.string(), params: z.record(z.string(), z.unknown()), mtime: z.number().optional().describe("The mtime kit_read gave, to replace a saved variant") },
    annotations: { destructiveHint: false },
  }, run("save_variant", ({ of, name, params, mtime }) => {
    const why = k.readOnly();
    if (why) return fail(why);
    const { target: t, problems } = draftVariant(of, name, params);
    return save("kit_variant", `${of}.${name}`, { of, name, params }, mtime, () => checks(t, problems), "variant");
  }));
}
