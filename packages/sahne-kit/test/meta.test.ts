// Every set piece and prop describes itself (`PieceDef.meta`, DESIGN.md §5.5): what it draws and every
// param it reads. SET.md and the gallery's piece inspector are built from it, so it must not drift from
// the drawing: each generator is drawn with its defaults, each variant, each value of each enum and each
// flag, through a params object that records what is read, and every read must be declared.

import { test } from "node:test";
import assert from "node:assert/strict";
import { rng, type PieceDef, type ParamSpec, type ParamType } from "sahne";
import kit from "../src/full.ts";

/** Params the engine gives every piece or prop, which no generator declares: its named look and whether it is in a hand. */
export const ENGINE_PARAMS = ["variant", "held"];
/** A place's own fields of a piece (PieceRef: where it stands, in metres, its id, seed and states) and of a prop (PropRef): a generator param of the same name would be read as both (a gull's `y` of 300 cm put the flock 300 m up). */
const PIECE_FIELDS = ["kit", "x", "y", "z", "id", "seed", "in", "switch"], PROP_FIELDS = ["kit", "at", "terms", "shown", "keep", "in"];

const defs = new Map<PieceDef, { ids: string[]; prop: boolean }>();
for (const [kind, map] of [["set", kit.set], ["props", kit.props]] as const) for (const [id, def] of Object.entries(map)) {
  const e = defs.get(def) ?? { ids: [], prop: false };
  e.ids.push(id); if (kind === "props") e.prop = true;
  defs.set(def, e);
}

const types = (spec: ParamSpec): readonly ParamType[] => typeof spec.type === "string" ? [spec.type] : spec.type;
const has = (spec: ParamSpec, t: ParamType) => types(spec).includes(t);

/** The values a param is tried with, beyond its default: each of an enum's, both of a flag's, a number's top. */
function tries(spec: ParamSpec): unknown[] {
  const out: unknown[] = [];
  if (has(spec, "enum")) out.push(...(spec.values ?? []));
  if (has(spec, "bool")) out.push(true, false);
  if ((has(spec, "int") || has(spec, "num")) && spec.max !== undefined) out.push(spec.max);
  return out;
}

const ok = (spec: ParamSpec, v: unknown) => types(spec).some(t => okAs(t, spec, v));
function okAs(type: ParamType, spec: ParamSpec, v: unknown): boolean {
  switch (type) {
    case "enum": return typeof v === "string" && (spec.values ?? []).includes(v);
    case "int": return Number.isInteger(v) && (spec.min === undefined || (v as number) >= spec.min) && (spec.max === undefined || (v as number) <= spec.max);
    case "num": return typeof v === "number" && Number.isFinite(v) && (spec.min === undefined || v >= spec.min) && (spec.max === undefined || v <= spec.max);
    case "bool": return typeof v === "boolean";
    case "text": return typeof v === "string" || typeof v === "number" || (Array.isArray(v) && v.every(x => typeof x === "string" || typeof x === "number"));
    case "color": return typeof v === "string";
    case "list": return Array.isArray(v);
    case "object": return typeof v === "object" && v !== null && !Array.isArray(v);
  }
}

// Each test lists every problem at once, one line per generator, so a family can be fixed in one go.
const none = (problems: string[]) => assert.equal(problems.length, 0, `\n${problems.join("\n")}\n`);

test("every set piece and prop has a meta: a line on what it is and its params", () => {
  const problems: string[] = [];
  for (const [def, { ids }] of defs) {
    const id = ids.join("/");
    if (!def.meta) { problems.push(`${id}: no meta`); continue; }
    if (def.meta.about.trim().length <= 8) problems.push(`${id}: meta.about is too short`);
    for (const [name, spec] of Object.entries(def.meta.params)) {
      if (ENGINE_PARAMS.includes(name)) problems.push(`${id}.${name}: the engine gives it, don't declare it`);
      if (PIECE_FIELDS.includes(name) && defs.get(def)!.ids.some(i => kit.set[i] === def)) problems.push(`${id}.${name}: a piece's own field in a place (PieceRef); name the param something else`);
      if (PROP_FIELDS.includes(name) && defs.get(def)!.prop) problems.push(`${id}.${name}: a prop's own field in a place (PropRef); name the param something else`);
      if (has(spec, "enum") && !spec.values?.length) problems.push(`${id}.${name}: an enum with no values`);
      if (spec.default !== undefined && !ok(spec, spec.default)) problems.push(`${id}.${name}: default ${JSON.stringify(spec.default)} is not a legal ${types(spec).join(" or ")}`);
    }
  }
  none(problems);
});

test("every variant sets only declared params, to legal values", () => {
  const problems: string[] = [];
  for (const [def, { ids }] of defs) for (const [v, params] of Object.entries(def.variants ?? {})) for (const [k, val] of Object.entries(params)) {
    const spec = def.meta?.params[k], tag = `${ids.join("/")} variant ${v}: ${k}`;
    if (!spec) problems.push(`${tag} is not in meta.params`);
    else if (!ok(spec, val)) problems.push(`${tag} = ${JSON.stringify(val)} is not a legal ${types(spec).join(" or ")}${spec.values ? ` (${spec.values.join(" ")})` : ""}`);
  }
  none(problems);
});

test("every param a drawing reads is declared in its meta", () => {
  const problems: string[] = [];
  for (const [def, { ids, prop }] of defs) {
    const meta = def.meta;
    if (!meta) continue;
    const read = new Set<string>();
    const watch = (p: Record<string, unknown>) => new Proxy(p, {
      get(t, k) { if (typeof k === "string") read.add(k); return Reflect.get(t, k); },
      has(t, k) { if (typeof k === "string") read.add(k); return Reflect.has(t, k); },
    });
    const cases: Record<string, unknown>[] = [{}, ...Object.values(def.variants ?? {})];
    for (const [name, spec] of Object.entries(meta.params)) for (const v of tries(spec)) cases.push({ [name]: v });
    if (prop) cases.push({ n: 3 }, { held: true });
    for (const p of cases) for (const seed of ["a", "b"]) def.draw(watch({ ...p }), rng(`${ids[0]}/${seed}`), kit);
    const undeclared = [...read].filter(k => !Object.hasOwn(meta.params, k) && !ENGINE_PARAMS.includes(k));
    if (undeclared.length) problems.push(`${ids.join("/")} reads undeclared params: ${undeclared.join(" ")}`);
  }
  none(problems);
});
