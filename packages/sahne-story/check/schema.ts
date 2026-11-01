// The JSON schemas of schema/ (Kumru's STORIES_SCHEMA.md §3, §5, §6, the series and seasons, and the kit's drawn pieces and variants) run with ajv. Node-only: the app never
// bundles this (src/index.ts does not import it). A story is checked against the core schema with the series' plugins'
// fragments merged in (src/plugin.ts, `storySchema`).

import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";
import { SCHEMA } from "../paths.ts";
import type { StoryPlugin } from "../src/plugin.ts";

export type SchemaKind = "story" | "character" | "place" | "series" | "season" | "kit_piece" | "kit_variant";
export interface SchemaProblem { rule: "schema"; level: "error"; path: string; message: string }

const ajv = new Ajv2020({ allErrors: true, strict: false });
const KINDS = ["story", "character", "place", "series", "season", "kit_piece", "kit_variant"] as const;
const raw = Object.fromEntries(KINDS.map(k => [k, JSON.parse(readFileSync(new URL(`${k.replace("_", "-")}.json`, SCHEMA), "utf8"))])) as Record<SchemaKind, Record<string, any>>;
const validators = new Map<string, ReturnType<typeof ajv.compile>>();

/** The story schema with these plugins' fragments merged in: their step kinds join `step`, their fields the story, line and choice. */
export function storySchema(plugins: readonly StoryPlugin[] = []): Record<string, any> {
  if (!plugins.length) return raw.story;
  const s = structuredClone(raw.story);
  s.$id = String(s.$id ?? "sahne-story/story.json").replace(/\.json$/, `+${plugins.map(p => p.id).join("+")}.json`);
  const choice = (s.$defs.step.oneOf as { required?: string[]; properties?: Record<string, any> }[]).find(b => b.required?.[0] === "choice")!;
  for (const p of plugins) {
    Object.assign(s.properties, p.schema?.story?.properties ?? {});
    s.required = [...new Set([...(s.required ?? []), ...(p.schema?.story?.required ?? [])])];
    Object.assign(s.$defs.line.properties, p.schema?.line ?? {});
    Object.assign(choice.properties!.choice.properties, p.schema?.choice ?? {});
    for (const k of p.steps ?? []) s.$defs.step.oneOf.push(k.schema);
  }
  return s;
}

function validator(kind: SchemaKind, plugins: readonly StoryPlugin[]) {
  const on = kind === "story" ? plugins : [];
  const key = [kind, ...on.map(p => p.id)].join("+");
  let v = validators.get(key);
  if (!v) validators.set(key, (v = ajv.compile(kind === "story" ? storySchema(on) : raw[kind])));
  return v;
}

/** Schema errors of a document, each with its JSON path and a readable message. [] when it is valid. A story is read with `plugins` on. */
export function validateDoc(kind: SchemaKind, doc: unknown, plugins: readonly StoryPlugin[] = []): SchemaProblem[] {
  const v = validator(kind, plugins);
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
