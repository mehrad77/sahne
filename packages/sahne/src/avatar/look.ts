// Changes of clothes (DESIGN.md §5.2): a body is fixed, its clothes change. A look names only
// clothing fields: every `outfit.*` and `wear.*`, `carry` and `hold`. It is applied on top of a
// document; the result still goes through `normalize` like any other document.
// Not imported by the stage or the builder: stories dress their cast before the stage sees them.

import type { AvatarDoc, Garment, Look } from "../core/types.ts";

/** The clothing fields a look may change: every garment field but the hair. */
export const CLOTHING_FIELDS = [
  "outfit.top", "outfit.bottom", "outfit.dress", "outfit.outer", "outfit.shoes",
  "wear.head", "wear.hat", "wear.hair", "wear.eyes", "wear.ears", "wear.aid", "wear.neck", "wear.wrist", "wear.hands", "wear.waist",
  "carry", "hold",
] as const;
export type ClothingField = (typeof CLOTHING_FIELDS)[number];

const CLOTHING = new Set<string>(CLOTHING_FIELDS);
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** A look's fields, flat (`outfit.outer` → value), split into clothing and anything else (which `applyLook` ignores). */
export function lookFields(look: unknown): { clothing: Partial<Record<ClothingField, Garment | string | null>>; other: string[] } {
  const clothing: Record<string, Garment | string | null> = {}, other: string[] = [];
  if (!isObj(look)) return { clothing, other: look === undefined ? [] : ["look"] };
  for (const [k, v] of Object.entries(look)) {
    if (k === "outfit" || k === "wear") {
      if (!isObj(v)) { other.push(k); continue; }
      for (const [s, g] of Object.entries(v)) (CLOTHING.has(`${k}.${s}`) ? (clothing[`${k}.${s}`] = g as Garment | string | null) : other.push(`${k}.${s}`));
    } else if (CLOTHING.has(k)) clothing[k] = v as Garment | string | null;
    else other.push(k);
  }
  return { clothing, other };
}

/** `doc` wearing `look`: only the slots the look names change; `null` takes one off. An empty look returns `doc` itself. */
export function applyLook(doc: AvatarDoc, look: Look | null | undefined): AvatarDoc {
  const { clothing } = lookFields(look ?? {});
  const fields = Object.entries(clothing);
  if (!fields.length) return doc;
  const out = structuredClone(doc) as AvatarDoc & Record<string, unknown>;
  for (const [f, v] of fields) {
    const g = typeof v === "string" ? { id: v } : v === null ? null : structuredClone(v);
    const [a, b] = f.split(".");
    if (!b) { if (g) out[a] = g; else delete out[a]; continue; }
    const box = ((out[a] as Record<string, unknown> | undefined) ??= {});
    if (g) box[b] = g; else delete box[b];
  }
  if (out.wear && !Object.keys(out.wear).length) delete out.wear;
  return out;
}
