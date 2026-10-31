// The JSON schemas of schema/ (Kumru's STORIES_SCHEMA.md §3, §5, §6, the series and seasons, and the kit's drawn pieces and variants) run with ajv. Node-only: the app never
// bundles this (src/index.ts does not import it).

import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { SCHEMA } from "../paths.ts";

export type SchemaKind = "story" | "character" | "place" | "series" | "season" | "kit_piece" | "kit_variant";
export interface SchemaProblem { rule: "schema"; level: "error"; path: string; message: string }

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validators = {} as Record<SchemaKind, ReturnType<typeof ajv.compile>>;
for (const k of ["story", "character", "place", "series", "season", "kit_piece", "kit_variant"] as const) {
  validators[k] = ajv.compile(JSON.parse(readFileSync(new URL(`${k.replace("_", "-")}.json`, SCHEMA), "utf8")));
}

/** Schema errors of a document, each with its JSON path and a readable message. [] when it is valid. */
export function validateDoc(kind: SchemaKind, doc: unknown): SchemaProblem[] {
  const v = validators[kind];
  if (v(doc)) return [];
  const seen = new Set<string>();
  const out: SchemaProblem[] = [];
  for (const e of v.errors ?? []) {
    // `oneOf` reports every branch that failed; the first branch error per path is the useful one
    if (e.keyword === "oneOf" || e.keyword === "if") continue;
    const extra = e.keyword === "additionalProperties" ? ` ${JSON.stringify(e.params.additionalProperty)}` : e.keyword === "enum" ? ` ${JSON.stringify(e.params.allowedValues)}` : "";
    const message = `${e.message}${extra}`;
    const key = `${e.instancePath}|${message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ rule: "schema", level: "error", path: e.instancePath || "/", message });
  }
  return out;
}
