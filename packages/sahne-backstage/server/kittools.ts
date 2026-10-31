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
import { rng, withVariant, type FlatSpec, type Kit, type PieceDef } from "sahne";
import { checkPiece, problemLine, type As } from "../../sahne-kit/src/check.ts";
import { CONTENT_ID, type DrawingDoc, type VariantDoc } from "../../sahne-kit/src/drawing.ts";
import { FAMILY_MODULES } from "../../sahne-kit/src/set/all.ts";
import { cellSheetSvg, pieceBody, sheetLooks, type CmBox, type SheetCell, type SheetZoom } from "../../sahne-kit/src/set-svg.ts";
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

/** Where a TypeScript generator is written: its family file, the line its definition starts on, and the lines of the comment
 *  above it to its end (`from`..`to`, 1-based), so an agent reads just that part of the file; never the text itself. */
function sourceOf(r: Row): { file: string; line?: number; from?: number; to?: number } | null {
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
    return { file, line: at + 1, from: from + 1, to: to + 1 };
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

/** The schema's complaints about a drawing, each once, then a hint for the mistakes they usually mean (the format is DRAWING.md's). */
export function withHints(messages: string[]): string[] {
  const out = [...new Set(messages)], hints: string[] = [];
  if (out.some(m => /\/shapes\/\d+(\/(fill|stroke)\b| must NOT have additional properties)/.test(m))) hints.push("hint: a shape is { d, fill?, stroke?: { color, width, cap? }, opacity?, flat?, evenodd? }: a stroke's colour and width go inside \"stroke\", and a shape with no fill leaves \"fill\" out (\"none\" is not a colour)");
  if (out.some(m => /\/(fill|color|tone)\b[^ ]* must (match pattern|be object)/.test(m))) hints.push("hint: a colour is \"#RRGGBB\", a palette id like \"fab_12\", \"$param\" (a color param), or { \"tone\": colour, \"step\": \"shade\" | \"deep\" | \"light\" | \"edge\" | \"base\" }");
  return [...out, ...hints];
}

/** A drafted drawing in the kit, or what is wrong with it: the schema, the id rules, the caps, the paths. Writes nothing. */
function draftPiece(doc: unknown): Target {
  if (!isObject(doc) || typeof doc.id !== "string") throw new Refusal("a drawing is an object with an id (x_ then lowercase letters, digits and _)");
  if (!CONTENT_ID.test(doc.id)) throw new Refusal(`id ${JSON.stringify(doc.id)}: a content id starts with x_ (then lowercase letters, digits and _): the kit's own ids are never changed or taken`);
  const { kit, problems } = kitWithEdits([{ kind: "kit_piece", id: doc.id, doc }]);
  if (problems.length) throw new Refusal(`${doc.id} is not a good drawing:\n${withHints(problems.map(p => p.message)).join("\n")}`);
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

const summary = (id: string, c: { errors: number; warnings: number }) => `${id}: ${c.errors} error${c.errors === 1 ? "" : "s"}, ${c.warnings} warning${c.warnings === 1 ? "" : "s"}${c.errors ? ": fix them before saving" : ""}`;

// ---- what a sheet is asked for -----------------------------------------------------------------------------------------------

const VIEWS = z.array(z.enum(["day", "night"])).max(2).describe("[\"day\"] or [\"night\"] for one view only (default both)");
const ZOOM = z.enum(["auto", "scene", "fit"]).describe("auto (default): an item under 60 cm fills its cell on a 1, 2, 5 or 10 cm grid with a scale bar instead of the 170 cm adult, so a cup is readable; larger ones stand beside the adult. scene: one scale for every cell, each beside the adult, to compare sizes. fit: every item fills its cell however large (a tall house, a long train), with a scale bar. Each cell prints its scale under the art (\"1 cm = 6 px\")");
const SEEDS = z.array(z.string().min(1).max(24)).max(3).describe("A picture per seed (the place's seed picks a seeded look: a house's windows, the laundry)");
const BOX = z.tuple([z.number(), z.number(), z.number(), z.number()]).describe("Crop: [x0, y0, x1, y1] in the item's cm as its path data has them (origin at its floor point, x right, up negative: [-30, -200, 30, -150] is the top 50 cm of a 2 m piece, 60 cm wide). Each cell shows only that box, magnified up to 400 px per cm, with a scale bar");
const TIMES = z.union([z.number().min(0), z.array(z.number().min(0)).min(1).max(8)]).describe("Mid-motion: a time in ms on the place's clock (or a list, a cell each). Every moving flat (sway, path, scroll, blink) is drawn where it is then, sways turned about the flat's origin. The answer lists each item's motions with their periods; without t, each is at its start and unturned");
const FRAMES = z.number().int().min(2).max(8).describe("Instead of t: this many times spread evenly over the item's longest motion, a cell each");
const VARY = z.record(z.string(), z.union([z.literal("all"), z.array(z.unknown()).min(1).max(64)])).describe("A cell per value, instead of a call each: { \"<param>\": [values] | \"all\" } (\"all\": an enum's values, a bool's two), also \"variant\" (\"all\": the default and each variant), \"n\" (\"all\": 1 and 3) and \"held\" (\"all\": not held and held). Several keys: every combination. Up to 96 cells, 24 to a picture");
const ITEM_SHAPE = {
  id: z.string().optional().describe("A kit item id"), doc: z.record(z.string(), z.unknown()).optional().describe("A drawing document not yet saved"),
  as: z.enum(["set", "prop"]).optional(), variant: z.string().optional(), params: z.record(z.string(), z.unknown()).optional().describe("The look: params like { \"n\": 3, \"held\": true, \"kind\": \"wall\" } (every param of the item goes here, never beside id)"),
  vary: VARY.optional(), t: TIMES.optional(), frames: FRAMES.optional(), focus: BOX.optional(),
};
const ITEM = z.union([z.string().describe("Just an id"), z.looseObject(ITEM_SHAPE)]);
const ITEM_KEYS = Object.keys(ITEM_SHAPE);

type Times = number | number[];
interface Req { id?: string; doc?: Record<string, unknown>; as?: "set" | "prop"; variant?: string; params?: Record<string, unknown>; vary?: Record<string, "all" | unknown[]>; t?: Times; frames?: number; focus?: CmBox; [k: string]: unknown }
interface SheetOpts { views?: ("day" | "night")[]; seeds?: string[]; zoom?: SheetZoom; vary?: Req["vary"]; t?: Times; frames?: number; focus?: CmBox }

/** Edit distance (two letters swapped count one), for the closest ids and keys to a misspelt one. */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => (i ? (j ? 0 : i) : j)));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
  }
  return d[a.length][b.length];
}
/** The words of `pool` nearest `word` (a part of one, or a few letters off), best first. */
export function closest(word: string, pool: Iterable<string>, n = 3): string[] {
  const w = word.toLowerCase(), parts = w.split(/[_\s]+/).filter(p => p.length > 2);
  return [...new Set(pool)].map(c => {
    const d = distance(w, c.toLowerCase()), sub = c.includes(w) || w.includes(c) || parts.some(p => c.includes(p));
    return { c, score: sub ? Math.min(d, 1 + Math.abs(c.length - w.length) / 10) : d };
  }).filter(x => x.score <= Math.max(2, w.length / 3)).sort((a, b) => a.score - b.score || a.c.localeCompare(b.c))
    .filter((x, _, all) => x.score <= all[0].score + 0.5).slice(0, n).map(x => x.c);
}

/** Keys a request does not take, each as a line that says where it belongs. */
export function strayKeys(o: Record<string, unknown>, allowed: readonly string[], where: string, row?: Row): string[] {
  const out: string[] = [], specs = row?.def.meta?.params ?? {};
  for (const k of Object.keys(o)) {
    if (allowed.includes(k) || o[k] === undefined) continue;
    const v = JSON.stringify(o[k]);
    if (k === "seed") out.push(`${where}seed is not a param: the place's seed picks a seeded look; pass "seeds": ["a", "b"] for a picture per seed`);
    else if (k === "n" || k === "held") out.push(`${where}${k} is a look, not a key: put it under params ({"params": {"${k}": ${v}}}), or ask for both with {"vary": {"${k}": "all"}}`);
    else if (Object.hasOwn(specs, k)) out.push(`${where}${k} is a param of ${row!.id}: put it under params ({"params": {"${k}": ${v}}})${k === "kind" && row!.def.variants && Object.hasOwn(row!.def.variants, String(o[k])) ? ` or name its variant ({"variant": ${v}})` : ""}`);
    else if (k === "ids") out.push(`${where}ids: give "items": [{"id": "chair"}, {"id": "lamp", "params": {…}}] (or plain ids: ["chair", "lamp"])`);
    else { const near = closest(k, allowed, 2); out.push(`${where}${k} is not a key this takes${near.length ? ` (did you mean ${near.join(" or ")}?)` : ""}: it takes ${allowed.join(", ")}`); }
  }
  return out;
}

/** The row of an id, or an error that names the closest ids. */
function rowNear(id: string, as: "set" | "prop" | undefined, kit: Kit): Row {
  try { return rowOf(id, as, kit); } catch (e) {
    if (!(e instanceof Refusal) || !/^there is no/.test(e.message)) throw e;
    const near = closest(id, pieceRows(kit).map(r => r.id));
    throw new Refusal(`there is no set piece or prop ${id}${near.length ? ` (closest: ${near.join(", ")})` : ""}; kit_search finds them`);
  }
}

/** paramProblems as lines, with what a wrong type usually means (a number for an enum of strings). */
function badParams(row: Row, params: Record<string, unknown>): string[] {
  const specs = row.def.meta?.params ?? {};
  return paramProblems(row.def, params, ["variant", "n", "held"]).map(p => {
    const k = p.message.split(/[: ]/)[p.message.startsWith("param ") ? 1 : 0], spec = specs[k], v = params[k];
    if (spec?.values && typeof v !== "string" && spec.values.includes(String(v))) return `${p.message}: give it as the string ${JSON.stringify(String(v))}`;
    if (k === "seed") return "seed is not a param: the place's seed picks a seeded look; pass \"seeds\": [\"a\", \"b\"]";
    return p.message;
  });
}

const word = (k: string, v: unknown) => (v === true ? k : v === false ? `not ${k}` : `${k} ${typeof v === "string" ? v : JSON.stringify(v)}`);
const lookLabel = (p: Record<string, unknown>) => Object.entries(p).map(([k, v]) => (k === "variant" ? String(v) : word(k, v))).join(", ") || "default";

/** The values `vary` names for one key, or why it cannot. */
function varied(row: Row, key: string, want: "all" | unknown[]): unknown[] {
  if (key === "variant") {
    const names = Object.keys(row.def.variants ?? {});
    const vs = want === "all" ? [null, ...names] : want;
    for (const v of vs) if (v !== null && v !== "default" && !names.includes(String(v))) throw new Refusal(`vary variant: ${row.id} has no variant ${JSON.stringify(v)} (${names.join(", ") || "none"})`);
    return vs.map(v => (v === "default" ? null : v));
  }
  if (key === "n") return want === "all" ? [1, 3] : want;
  if (key === "held") return want === "all" ? [false, true] : want;
  const spec = row.def.meta?.params?.[key];
  if (!spec) throw new Refusal(`vary ${key}: ${row.id} has no param ${key} (${Object.keys(row.def.meta?.params ?? {}).join(", ") || "none"})`);
  const types = [spec.type].flat();
  if (want !== "all") return want;
  if (spec.values?.length) return [...spec.values];
  if (types.includes("bool")) return [false, true];
  throw new Refusal(`vary ${key}: "all" is for an enum or a bool; give ${row.id}'s ${key} a list of values`);
}

/** Every combination of the varied values, over the base look. */
function product(base: Record<string, unknown>, axes: [string, unknown[]][]): Record<string, unknown>[] {
  let out = [{ ...base }];
  for (const [k, vs] of axes) out = out.flatMap(p => vs.map(v => { const q = { ...p }; if (v === null) delete q[k]; else q[k] = v; return q; }));
  return out;
}

/** A piece's motions in a look: a line naming each kind with its period, and the longest period (ms), or null when nothing moves. */
function motionOf(row: Row, kit: Kit, params: Record<string, unknown>): { line: string; period: number } | null {
  let flats: FlatSpec[] = [];
  try { flats = row.def.draw(withVariant(row.def, params), rng(`${row.id}/a`), kit).flats; } catch { return null; }
  const seen = new Map<string, number>();
  let period = 0;
  for (const f of flats) {
    const m = f.move;
    if (!m) continue;
    const parts: string[] = [];
    if (m.sway) parts.push(`sway ${Math.round(m.sway.ms)} ms${m.sway.rot ? ` ±${+(m.sway.rot * 180 / Math.PI).toFixed(1)}°` : ""}${m.sway.dy ? ` ±${m.sway.dy} cm` : ""}`);
    if (m.path) parts.push(`path ${Math.round(m.path.ms)} ms${m.path.wait ? ` + wait ${Math.round(m.path.wait)}` : ""}`);
    if (m.scroll) parts.push(`scroll ${Math.round(m.scroll.ms)} ms`);
    if (m.blink) parts.push(`blink ${Math.round(m.blink.ms)} ms`);
    if (m.stops) parts.push(`stops every ${Math.round(m.stops.ms)} ms`);
    const own = m.stops ? m.stops.ms : Math.max(m.sway?.ms ?? 0, m.path ? m.path.ms + (m.path.wait ?? 0) : 0, m.scroll?.ms ?? 0, m.blink?.ms ?? 0);
    period = Math.max(period, own);
    const key = parts.join(" + ");
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  if (!seen.size) return null;
  return { line: [...seen].map(([k, n]) => `${k}${n > 1 ? ` (${n} flats)` : ""}`).join("; "), period: Math.round(period) };
}

/** A param that draws the same as without it, in this look, and what other param makes it show (money's currency needs kind: foreign). */
function inert(row: Row, kit: Kit, params: Record<string, unknown>): string[] {
  const memo = new Map<string, string>();
  const draw = (p: Record<string, unknown>) => {
    const key = JSON.stringify(p);
    if (!memo.has(key)) { let b = "!"; try { b = pieceBody(kit, row.def, p, `${row.id}/a`, "q", { text: true })?.body ?? ""; } catch {} memo.set(key, b); }
    return memo.get(key)!;
  };
  const specs = row.def.meta?.params ?? {}, out: string[] = [], base = draw(params);
  for (const [k, v] of Object.entries(params)) {
    if (["variant", "n", "held"].includes(k) || !specs[k] || JSON.stringify(v) === JSON.stringify(specs[k].default)) continue;
    const without = { ...params };
    delete without[k];
    if (draw(without) !== base) continue;
    let need = "";
    for (const [p, s] of Object.entries(specs)) {
      if (p === k) continue;
      const now = params[p] ?? s.default, types = [s.type].flat();
      const tries = s.values?.length ? s.values.filter(x => x !== now).slice(0, 12) : types.includes("bool") ? [!now] : [];
      for (const x of tries) if (draw({ ...params, [p]: x }) !== draw({ ...without, [p]: x })) { need = word(p, x); break; }
      if (need) break;
    }
    if (!need) for (const vn of Object.keys(row.def.variants ?? {})) if (draw({ ...params, variant: vn }) !== draw({ ...without, variant: vn })) { need = `variant ${vn}`; break; }
    out.push(`warning [inert] ${row.id}: ${word(k, v)} draws the same as without it${need ? `; it shows with ${need}` : " in this look"}`);
  }
  return out;
}

const CELLS_MAX = 96, PAGE = 24;
/** A cell that stands for an item it could not draw. */
const NOTHING: PieceDef = { draw: () => ({ flats: [] }) } as unknown as PieceDef;

/**
 * The sheets of one or more items, numbered cells on as few pictures as fit (24 cells to one), with the kit's checks, the
 * looks each param could not change, each item's motion, and what each number shows. `whole` (one id or doc): every look of
 * the item unless a look is given. An item that cannot be drawn (an unknown id, a wrong param) is a red cell and an error,
 * and the rest are still drawn; a key in the wrong place refuses the call, saying where it goes.
 */
function render(reqs: Req[], o: SheetOpts & { kit?: Kit; whole?: boolean; list?: boolean; extra?: string[]; head?: (c: { errors: number; warnings: number }) => string }): Result {
  // drafted documents: each id once (the same document twice is one), checked together
  const docs = new Map<string, Record<string, unknown>>();
  for (const r of reqs) {
    if (r.doc === undefined) continue;
    const d = r.doc;
    if (!isObject(d) || typeof d.id !== "string" || !CONTENT_ID.test(d.id)) throw new Refusal(`a drawing needs an id that starts with x_ (then lowercase letters, digits and _), not ${JSON.stringify(isObject(d) ? d.id : d)}`);
    if (docs.has(d.id) && JSON.stringify(docs.get(d.id)) !== JSON.stringify(d)) throw new Refusal(`two different drawings share the id ${d.id}: give each its own id (the same drawing twice, with other params, is fine)`);
    docs.set(d.id, d);
  }
  let kit = o.kit ?? kitOf();
  if (docs.size) {
    const r = kitWithEdits([...docs].map(([id, doc]) => ({ kind: "kit_piece" as const, id, doc })));
    if (r.problems.length) {
      const one = o.whole && docs.size === 1 ? `${[...docs.keys()][0]} is not a good drawing` : "not drawable";
      throw new Refusal(`${one}:\n${withHints(r.problems.map(p => p.message)).join("\n")}`);
    }
    kit = r.kit;
  }
  const inertAt = new Map<string, number[]>(), still = new Set<string>(), stray: string[] = [], bad: string[] = [], cells: SheetCell[] = [], lists: string[] = [], warn: string[] = [], motion: string[] = [];
  const targets = new Map<string, Target>(), items: { id: string; errors: number; warnings: number; problems: string[]; error?: string }[] = [];
  const views = o.views?.length ? o.views : (["day", "night"] as const);
  reqs.forEach((r, i) => {
    const where = o.list ? `item ${i + 1}: ` : "", id = r.id ?? (r.doc?.id as string);
    let row: Row | undefined;
    try {
      row = rowNear(id, r.doc ? undefined : r.as, kit);
      if (o.list) stray.push(...strayKeys(r, ITEM_KEYS, where, row));
      if (r.variant !== undefined && !Object.hasOwn(row.def.variants ?? {}, r.variant)) throw new Refusal(`${row.id} has no variant ${r.variant} (${Object.keys(row.def.variants ?? {}).join(", ") || "none"})`);
      const base: Record<string, unknown> = { ...(r.variant !== undefined ? { variant: r.variant } : {}), ...r.params };
      const vary = { ...o.vary, ...r.vary }, axes = Object.entries(vary).map(([k, w]) => [k, varied(row!, k, w)] as [string, unknown[]]);
      let looks: [string, Record<string, unknown>][];
      const slot: KitSlot = r.as ? (r.as === "prop" ? "props" : "set") : r.doc && (r.doc as unknown as DrawingDoc).as === "prop" ? "props" : row.slot;
      if (axes.length) looks = product(base, axes).map(p => [lookLabel(p), p]);
      else if (o.whole && !Object.keys(base).length) looks = sheetLooks({ id: row.id, def: row.def, kind: slot });
      else if (o.whole && slot === "props" && base.n === undefined && base.held === undefined) looks = [[lookLabel(base), base], [lookLabel({ ...base, n: 3 }), { ...base, n: 3 }], [lookLabel({ ...base, held: true }), { ...base, held: true }]];
      else looks = [[lookLabel(base), base]];
      const wrong = [...new Set(looks.flatMap(([, p]) => badParams(row!, p)))];
      if (wrong.length) throw new Refusal(`${row.id} params: ${wrong.join("; ")}`);
      // the looks, each at its times, each by day and night
      const t = r.t ?? o.t, frames = r.frames ?? o.frames, focus = r.focus ?? o.focus;
      const mo = motionOf(row, kit, base);
      if (mo) motion.push(`motion: ${row.id}: ${mo.line}${t === undefined && !frames ? " (t or frames draws it mid-motion)" : ""}`);
      else if (t !== undefined || frames) still.add(row.id);
      const times: (number | undefined)[] = frames && mo ? Array.from({ length: frames }, (_, j) => Math.round(j * mo.period / frames)) : t === undefined ? [undefined] : [t].flat();
      const item = { id: row.id, def: row.def, kind: slot };
      for (const [label, params] of looks) {
        const from = cells.length + 1;
        for (const at of times) for (const v of views) cells.push({ item, label, params, night: v === "night", ...(at !== undefined ? { t: at } : {}), ...(focus ? { focus } : {}), num: cells.length + 1 });
        lists.push(`${from === cells.length ? from : `${from}-${cells.length}`}  ${row.id} · ${label}${times[0] !== undefined ? ` · t ${times.join(", ")} ms` : ""}`);
        if (Object.keys(params).some(k => !["variant", "n", "held"].includes(k))) for (const w of inert(row, kit, params)) inertAt.set(w, [...(inertAt.get(w) ?? []), from]);
      }
      const key = `${row.slot}:${row.id}:${slot}`;
      if (!targets.has(key)) targets.set(key, { kit, row, slot });
      items.push({ id: row.id, errors: 0, warnings: 0, problems: [] });
    } catch (e) {
      if (!(e instanceof Refusal)) throw e;
      bad.push(`error: ${where}${e.message}`);
      cells.push({ item: { id: row?.id ?? id ?? "?", def: NOTHING, kind: "set" }, label: "cannot draw", params: {}, error: e.message, num: cells.length + 1 });
      lists.push(`${cells.length}  ${id} · cannot draw`);
      items.push({ id, errors: 1, warnings: 0, problems: [e.message], error: e.message });
    }
  });
  if (stray.length) throw new Refusal(stray.join("\n"));
  if (!targets.size) throw new Refusal(bad.map(l => l.replace(/^error: /, "")).join("\n"));
  if (cells.length > CELLS_MAX) throw new Refusal(`${cells.length} cells is more than ${CELLS_MAX}: ask for fewer (views: ["day"], fewer values in vary, fewer times) or split the call`);
  // the kit's checks, once a generator
  const lines: string[] = [], notes = new Set<string>();
  let errors = bad.length, warnings = 0, first = true;
  for (const t of targets.values()) {
    const c = checks(t, first ? o.extra ?? [] : []), note = stale(t.row);
    first = false;
    if (note) notes.add(note);
    errors += c.errors; warnings += c.warnings;
    for (const it of items) if (it.id === t.row.id && !it.error) Object.assign(it, { errors: c.errors, warnings: c.warnings, problems: c.lines });
    if (c.lines.length) lines.push(...(o.whole ? c.lines.map(l => `  ${l}`) : [summary(t.row.id, c), ...c.lines.map(l => `  ${l}`)]));
  }
  // a param that changed nothing, with the cells it is in when not all of them
  for (const [w, at] of inertAt) warn.push(at.length === lists.length ? w : w.replace(" draws the same", ` (cell${at.length > 1 ? "s" : ""} ${at.join(", ")}) draws the same`));
  const uniq = [...new Set(warn)];
  warnings += uniq.filter(l => l.startsWith("warning")).length;
  // the pictures: 24 cells to one, a picture per seed; few cells (or a crop) drawn twice as large
  const pages: SheetCell[][] = [];
  for (let i = 0; i < cells.length; i += PAGE) pages.push(cells.slice(i, i + PAGE));
  const scale = cells.length <= 3 || (cells.some(c => c.focus) && cells.length <= 6) ? 2 : 1;
  const seeds = o.seeds?.length ? o.seeds : ["a"];
  const pngs = seeds.flatMap(seed => pages.map(p => renderPng(cellSheetSvg(kit, p, { seed, zoom: o.zoom ?? "auto", scale }))));
  const where = pngs.length === 1 ? "one sheet" : `${pngs.length} sheets${seeds.length > 1 ? ` (${pages.length} a seed: ${seeds.join(", ")})` : ` (${PAGE} cells each)`}`;
  const tally = { errors, warnings };
  const head = o.head ? o.head(tally) : `${reqs.length} item${reqs.length === 1 ? "" : "s"}, ${cells.length} cells on ${where}: ${errors} error${errors === 1 ? "" : "s"}, ${warnings} warning${warnings === 1 ? "" : "s"}`;
  if (still.size) motion.push(`still: ${[...still].join(", ")} ${still.size === 1 ? "has" : "have"} no moving flat, so t and frames change nothing there`);
  const text = [head, ...bad, ...lines, ...uniq, ...notes, ...new Set(motion), `cells (each ${views.join(" and ")}):${lists.length > 1 || o.list ? "" : ` ${lists[0]}`}`, ...(lists.length > 1 || o.list ? lists.map(l => `  ${l}`) : [])].join("\n");
  const one = !o.list && items.length === 1 ? items[0] : null, t0 = [...targets.values()][0];
  const data = { ...(one ? { id: t0.row.id, family: t0.row.family, as: t0.row.as, problems: one.problems, errors: one.errors } : { items }), cells: cells.map(c => ({ n: c.num, id: c.item.id, look: c.params, view: c.night ? "night" : "day", ...(c.t !== undefined ? { t: c.t } : {}), ...(c.error ? { error: c.error } : {}) })), sheets: pngs.length };
  const res = ok(text, data, pngs);
  return bad.length ? { ...res, isError: true } : res;
}

/** A list item as a request: a plain id is `{ id }`. */
const reqOf = (r: string | Record<string, unknown>): Req => (typeof r === "string" ? { id: r } : (r as Req));

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
const LOOK = { vary: VARY.optional(), t: TIMES.optional(), frames: FRAMES.optional(), focus: BOX.optional() };

/** A generator's params in a line each: type, values (the first few), default. */
function paramsLine(def: PieceDef): string[] {
  return Object.entries(def.meta?.params ?? {}).map(([k, p]) => {
    const vs = p.values ? ` ${p.values.slice(0, 10).join("|")}${p.values.length > 10 ? `|… (${p.values.length})` : ""}` : p.min !== undefined || p.max !== undefined ? ` ${p.min ?? ""}..${p.max ?? ""}` : "";
    return `  ${k}: ${[p.type].flat().join("|")}${vs}${p.default !== undefined ? ` = ${JSON.stringify(p.default)}` : ""}`;
  });
}

export function registerKitTools(server: McpServer, k: KitToolsCtx): void {
  const { run } = k;
  /** The keys a tool's call does not take, refused with where each belongs (the schemas let them through so this can say so). */
  const strict = (a: Record<string, unknown>, allowed: readonly string[], id?: unknown, as?: "set" | "prop") => {
    let row: Row | undefined;
    if (typeof id === "string") try { row = rowOf(id, as); } catch {}
    const lines = strayKeys(a, allowed, "", row);
    if (lines.length) throw new Refusal(lines.join("\n"));
  };

  server.registerResource("kit-guide", "sahne://kit-guide", { title: "How to draw a kit item", description: "sahne-kit's DRAWING.md (the format and the loop) and STYLE.md's Paper, Places and Props: the look a piece must have.", mimeType: "text/markdown" },
    uri => ({ contents: [{ uri: uri.href, mimeType: "text/markdown", text: guide() }] }));

  const READ = { id: z.string().describe("A set piece or prop id, like chair or x_cafe_chalkboard; <generator>.<x_name> for a variant document"), as: z.enum(["set", "prop"]).optional().describe("Which one when the id is both a set piece and a different prop") };
  server.registerTool("kit_read", {
    title: "Read a set piece or prop",
    description: "A set piece or prop to study before drawing a neighbour: what it is, its family, its params (a line each: type, values, default), its variants, its motions, and where its source is (a TypeScript generator's file, the line its definition starts on and the lines `from`..`to` it spans with its comment, to read just those) or its document (a drawing of this series, with the mtime to pass to save_kit_item), with its sheet as a picture. Give a content variant as <generator>.<x_name> to read its document.",
    inputSchema: z.looseObject(READ),
    annotations: { readOnlyHint: true },
  }, run("kit_read", (a: { id: string; as?: "set" | "prop" } & Record<string, unknown>) => {
    const { id, as } = a;
    strict(a, Object.keys(READ), id, as);
    if (id.includes(".")) {
      if (!exists("kit_variant", id)) throw new Refusal(`there is no variant document ${id} in this content root`);
      const d = readDoc("kit_variant", id);
      return ok(`${id} (mtime ${d.mtime})`, { doc: d.doc, mtime: d.mtime });
    }
    const r = rowNear(id, as, kitOf()), kit = kitOf(), meta = r.def.meta;
    const own = exists("kit_piece", id) ? readDoc("kit_piece", id) : null;
    const note = stale(r), src = own ? null : sourceOf(r);
    const data = {
      id, family: r.family, as: r.as, about: r.about, tags: r.tags, terms: meta?.terms ?? [], states: meta?.states ?? [],
      params: meta?.params ?? {}, variants: r.def.variants ?? {}, solid: !!r.def.solid,
      ...(own ? { doc: own.doc, mtime: own.mtime } : { source: src }),
    };
    const where = src ? `\nsource: ${src.file}${src.line ? `:${src.line} (lines ${src.from}-${src.to})` : ""}` : "";
    const ps = paramsLine(r.def), vs = Object.keys(r.def.variants ?? {}), mo = motionOf(r, kit, {});
    const text = `${id}: ${r.family} ${r.as} — ${r.about}${own ? ` (mtime ${own.mtime})` : ""}${where}${note ? `\n${note}` : ""}`
      + `${ps.length ? `\nparams:\n${ps.join("\n")}` : "\nparams: none"}${vs.length ? `\nvariants: ${vs.join(", ")}` : ""}${mo ? `\nmotion: ${mo.line}` : ""}`;
    const sheet = render([{ id, ...(as ? { as } : {}) }], { whole: true });
    return ok(text, data, sheet.content.filter(c => c.type === "image").map(c => Buffer.from((c as { data: string }).data, "base64")));
  }));

  const RENDER = {
    id: z.string().optional().describe("A kit item id"), doc: DOC.optional().describe("A drawing document to render without saving it"), as: z.enum(["set", "prop"]).optional(),
    items: z.array(ITEM).min(1).max(48).optional().describe("Instead of id/doc: a list of items, each an id or { id | doc, as?, variant?, params?, vary?, t?, frames?, focus? } (the item's params go under params, never beside id), drawn as numbered cells on one sheet (24 cells to a picture): each its default look, or the variant/params given, or a cell per vary value; by day and night. For comparing a family or checking a batch in one look"),
    params: z.record(z.string(), z.unknown()).optional().describe("One look: the params to draw it with, like { \"n\": 3, \"label\": \"Menu\" }; a prop also shows that look n 3 and held"), variant: z.string().optional(), views: VIEWS.optional(), seeds: SEEDS.optional(), zoom: ZOOM.optional(),
    ...LOOK,
  };
  server.registerTool("kit_render", {
    title: "Render a set piece or prop",
    description: "A sheet of numbered cells as a PNG, with the kit's checks on it (the same ones the gate runs). Give an `id` (a kit item or one of this series), a `doc` (a drawing not yet saved) or `items` (several on one sheet). One item shows its default, each variant, and for a prop three of it and held; `variant` or `params` picks one look; `vary` draws a cell per value of a param (\"all\" for every value: `{\"vary\": {\"country\": \"all\"}}`, also variant, n, held), applying to every item. Each look is drawn by day and night (`views` for one), at rest or mid-motion (`t` in ms, or `frames`), whole or cropped to a box of cm (`focus`), and zoomed by `zoom` (auto, scene, fit). The answer's text says what each cell number shows, each item's motions with their periods, and its problems as lines, including a param that changed nothing in that look and the param it needs. An unknown id or a bad param is a red cell and an error, the rest still drawn; a key in the wrong place is refused with where it belongs. `seeds` (up to 3): a picture per seed. A TypeScript generator is drawn from the source the process read at its start (call.ts --session restarts its server when the source changes).",
    inputSchema: z.looseObject(RENDER),
    annotations: { readOnlyHint: true },
  }, run("kit_render", (a: { id?: string; doc?: Record<string, unknown>; as?: "set" | "prop"; items?: (string | Record<string, unknown>)[]; params?: Record<string, unknown>; variant?: string; views?: ("day" | "night")[]; seeds?: string[]; zoom?: SheetZoom; vary?: Req["vary"]; t?: Times; frames?: number; focus?: CmBox } & Record<string, unknown>) => {
    const { id, doc, as, params, variant, views, seeds, items, zoom, vary, t, frames, focus } = a;
    const o: SheetOpts = { views, seeds, zoom, vary, t, frames, focus };
    if (items) {
      if (id !== undefined || doc !== undefined) throw new Refusal("give items, or an id or a doc, not both");
      if (params !== undefined || variant !== undefined) throw new Refusal("with items, each item's params and variant go in the item ({\"id\": …, \"params\": {…}}); vary applies to every item");
      strict(a, Object.keys(RENDER));
      return render(items.map(reqOf), { ...o, list: true });
    }
    strict(a, Object.keys(RENDER), id, as);
    if ((id === undefined) === (doc === undefined)) throw new Refusal("give an id, a doc or items (a list: [{\"id\": \"chair\"}, {\"id\": \"lamp\", \"params\": {…}}]), one of them");
    const t0 = doc !== undefined ? draftPiece(doc) : null;
    return render([{ ...(id !== undefined ? { id } : { doc }), ...(as ? { as } : {}), ...(variant !== undefined ? { variant } : {}), ...(params ? { params } : {}) }], {
      ...o, whole: true, head: c => `${summary(t0?.row.id ?? rowNear(id!, as, kitOf()).id, c)}`,
    });
  }));

  const DRAFT = { doc: DOC.optional().describe("The drawing: { id: \"x_…\", as, about, params?, kinds, … }"), docs: z.array(DOC).min(2).max(48).optional().describe("Instead of doc: several drawings, checked together and drawn on ONE sheet, a numbered cell each"), as: z.enum(["set", "prop"]).optional().describe("For a drawing that is `both`: which look to render"), views: VIEWS.optional(), seeds: SEEDS.optional(), zoom: ZOOM.optional(), ...LOOK };
  server.registerTool("draft_kit_item", {
    title: "Draft a drawing",
    description: "Check a drawing document (`sahne-kit/drawing`, the kit-guide resource has the format) as it would be saved, and render its sheet: nothing is written. It checks the schema, the id (x_…), the caps, every path and `$param`, and the kit's own checks on the piece. A document that cannot be drawn is answered with what to fix; a drawn one with its sheet and the problems that remain (errors fail a save; warnings are advice). `vary`, `t`/`frames`, `focus`, `views` and `zoom` work as for kit_render. Revise and draft again until there are none, then save_kit_item.",
    inputSchema: z.looseObject(DRAFT),
    annotations: { readOnlyHint: true },
  }, run("draft_kit_item", (a: { doc?: Record<string, unknown>; docs?: Record<string, unknown>[]; as?: "set" | "prop"; views?: ("day" | "night")[]; seeds?: string[]; zoom?: SheetZoom; vary?: Req["vary"]; t?: Times; frames?: number; focus?: CmBox } & Record<string, unknown>) => {
    const { doc, docs, as, views, seeds, zoom, vary, t, frames, focus } = a;
    strict(a, Object.keys(DRAFT));
    const o: SheetOpts = { views, seeds, zoom, vary, t, frames, focus };
    if (docs) {
      if (doc !== undefined) throw new Refusal("give doc or docs, not both");
      return render(docs.map(d => ({ doc: d, ...(as ? { as } : {}) })), { ...o, list: true });
    }
    if (doc === undefined) throw new Refusal("give a doc (or docs)");
    const t0 = draftPiece(doc);
    return render([{ doc, ...(as ? { as } : {}) }], { ...o, whole: true, head: c => `${summary(t0.row.id, c)}${exists("kit_piece", t0.row.id) ? " (it revises the saved one)" : ""}` });
  }));

  const VARIANT = { of: z.string().describe("The generator's id"), name: z.string().describe("x_ then lowercase letters, digits and _"), params: z.record(z.string(), z.unknown()), views: VIEWS.optional(), zoom: ZOOM.optional(), t: TIMES.optional(), frames: FRAMES.optional(), focus: BOX.optional() };
  server.registerTool("draft_variant", {
    title: "Draft a variant",
    description: "Check a named look of a generator the kit already has (`of`: a set piece or prop, a TypeScript one or a drawing) as a variant document `{ of, name: \"x_…\", params }` would be saved, and render it beside the default: nothing is written. Its params must be ones the generator declares (kit_read lists them), with legal values; a param that changes nothing in that look is a warning.",
    inputSchema: z.looseObject(VARIANT),
    annotations: { readOnlyHint: true },
  }, run("draft_variant", (a: { of: string; name: string; params: Record<string, unknown>; views?: ("day" | "night")[]; zoom?: SheetZoom; t?: Times; frames?: number; focus?: CmBox } & Record<string, unknown>) => {
    const { of, name, params, views, zoom, t, frames, focus } = a;
    strict(a, Object.keys(VARIANT), of);
    const { target, problems } = draftVariant(of, name, params), id = `${of}.${name}`;
    // drawn from the kit with the variant in it: the default, then the variant
    return render([{ id: of }, { id: of, variant: name }], { kit: target.kit, views, zoom, t, frames, focus, extra: problems, head: c => summary(id, c) });
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
    description: `Save a drawing into this content root's kit (kit/pieces/<id>.json), after the checks draft_kit_item runs: errors, an id that does not start with x_, and an id already saved (unless you pass the mtime kit_read gave) are refused. ${k.writeNote} (In proposals mode a person accepts it in the editor; in direct mode, as with call.ts --write, the file is written at once and its mtime answered.)`,
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
    description: `Save a named look of an existing generator into this content root's kit (kit/variants/<of>.<name>.json), after the checks draft_variant runs. ${k.writeNote} (In proposals mode a person accepts it in the editor; in direct mode, as with call.ts --write, the file is written at once.)`,
    inputSchema: { of: z.string(), name: z.string(), params: z.record(z.string(), z.unknown()), mtime: z.number().optional().describe("The mtime kit_read gave, to replace a saved variant") },
    annotations: { destructiveHint: false },
  }, run("save_variant", ({ of, name, params, mtime }) => {
    const why = k.readOnly();
    if (why) return fail(why);
    const { target: t, problems } = draftVariant(of, name, params);
    return save("kit_variant", `${of}.${name}`, { of, name, params }, mtime, () => checks(t, problems), "variant");
  }));
}
