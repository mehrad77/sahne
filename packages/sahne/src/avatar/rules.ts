// What every kit shares (DESIGN.md §5.2): the map from document fields to slots, how a part is
// found without trusting an id, and what parts replace or hide. `normalize`, `compose` and the
// builder all read this one table.

import type { PartMeta } from "../core/kit.ts";
import type { AvatarDoc, Build, Garment, WearSide } from "../core/types.ts";

/** A document field that holds a part: the slot it takes and whether the kit must always fill it. */
export interface GarmentField { field: string; slot: string; req?: boolean }

/**
 * The engine-owned map from document fields to slots, in the order a document lists them and
 * parts are added before the layers sort them (so on a shared layer a hat lies over a covering,
 * and a held thing comes last). A required slot is filled from the kit's default character when
 * the document leaves it out or names a part the kit cannot use. The slot of `wear.hair` is
 * `hairwear`, because `hair` is the hair style's.
 */
export const GARMENT_FIELDS: readonly GarmentField[] = [
  { field: "hair.style", slot: "hair", req: true },
  { field: "outfit.top", slot: "top", req: true },
  { field: "outfit.bottom", slot: "bottom", req: true },
  { field: "outfit.dress", slot: "dress" },
  { field: "outfit.outer", slot: "outer" },
  { field: "outfit.shoes", slot: "shoes", req: true },
  { field: "wear.head", slot: "head" },
  { field: "wear.hat", slot: "hat" },
  { field: "wear.hair", slot: "hairwear" },
  { field: "wear.eyes", slot: "eyes" },
  { field: "wear.ears", slot: "ears" },
  { field: "wear.aid", slot: "aid" },
  { field: "wear.neck", slot: "neck" },
  { field: "wear.wrist", slot: "wrist" },
  { field: "wear.hands", slot: "hands" },
  { field: "wear.waist", slot: "waist" },
  { field: "carry", slot: "carry" },
  { field: "hold", slot: "hold" },
];

/** Whether a part is made for a build (a part without `builds` fits every one). */
export const fitsBuild = (part: Pick<PartMeta, "builds">, build: Build): boolean => !part.builds || part.builds.includes(build);

/** The side a garment of a one-sided part is worn on: the document's when the part allows it, else the part's default; null for a part without sides. */
export function sideOf(part: Pick<PartMeta, "sides">, raw: unknown): WearSide | null {
  const s = part.sides;
  if (!s) return null;
  return typeof raw === "string" && (s.allowed as string[]).includes(raw) ? raw as WearSide : s.default;
}

export const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

/** A property the value has itself, never one it inherits (`constructor`, `__proto__`, `toString`). */
export const own = (o: unknown, k: string): unknown => (isObj(o) && Object.hasOwn(o, k) ? o[k] : undefined);

/** `o.a.b` for the path "a.b", own properties only. */
export const at = (o: unknown, path: string): unknown => path.split(".").reduce(own, o);

/** The part tables of a kit or a kit manifest. */
export interface Parts<P extends PartMeta = PartMeta> { parts: Record<string, P>; aliases?: Record<string, string> }

/** Follows `kit.aliases` (a few hops at most); null for anything that cannot be an id. */
export function unalias(kit: Pick<Parts, "aliases">, id: unknown): string | null {
  if (typeof id !== "string" || id.length > 48) return null;
  let k: string = id;
  for (let i = 0; i < 4 && kit.aliases && Object.hasOwn(kit.aliases, k); i++) k = kit.aliases[k];
  return k;
}

/** The kit's part for an id (after aliases) and its current id, or null. */
export function partOf<P extends PartMeta>(kit: Parts<P>, id: unknown): [string, P] | null {
  const k = unalias(kit, id);
  return k !== null && Object.hasOwn(kit.parts, k) ? [k, kit.parts[k]] : null;
}

/** A part in a document: where it is and what it wears. */
export interface Use<P extends PartMeta = PartMeta> { field: string; id: string; part: P; colors: string[]; pattern: string | null; inks?: string[]; side?: WearSide | null }

/** The parts a document holds, in table order and the custom parts last. Unknown ids are skipped. */
export function usesOf<P extends PartMeta>(doc: AvatarDoc, kit: Parts<P>): Use<P>[] {
  const out: Use<P>[] = [];
  const add = (field: string, raw: unknown) => {
    const g: Garment | null = typeof raw === "string" ? { id: raw } : isObj(raw) ? (raw as unknown as Garment) : null;
    if (!g) return;
    const hit = partOf(kit, g.id);
    if (hit) out.push({
      field, id: hit[0], part: hit[1], colors: Array.isArray(g.colors) ? g.colors : [], pattern: typeof g.pattern === "string" ? g.pattern : null,
      inks: Array.isArray(g.inks) ? g.inks : [], side: sideOf(hit[1], g.side),
    });
  };
  for (const f of GARMENT_FIELDS) add(f.field, at(doc, f.field));
  if (Array.isArray(doc.custom)) doc.custom.forEach((c, i) => add(`custom.${i}`, c));
  return out;
}

/**
 * Applies `replaces`: parts that replace come first (a stable sort), and a part whose slot an
 * earlier kept part replaces is dropped. Returns the dropped parts with their replacer.
 */
export function applyReplaces<T extends { part: PartMeta }>(uses: T[]): { gone: { use: T; by: T }[]; slots: Set<string> } {
  const by = new Map<string, T>(), gone: { use: T; by: T }[] = [];
  for (const u of [...uses].sort((a, b) => (b.part.replaces ? 1 : 0) - (a.part.replaces ? 1 : 0))) {
    const r = by.get(u.part.slot);
    if (r) { gone.push({ use: u, by: r }); continue; }
    for (const s of u.part.replaces ?? []) if (!by.has(s)) by.set(s, u);
  }
  return { gone, slots: new Set(by.keys()) };
}

/** The slots some part hides, each with the id of the part that hides it. A hidden part still hides. */
export function hiddenSlots(uses: Use[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const u of uses) for (const s of u.part.hides ?? []) if (!m.has(s)) m.set(s, u.id);
  return m;
}
