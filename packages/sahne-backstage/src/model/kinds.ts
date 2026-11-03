// A set piece's or prop's kinds, pure: the looks a document can name. Each named look (`PieceDef.variants`) is one, and
// so is each value of its `kind` param that no named look draws. The kit page shows them as a deck on the card, a grid in
// the details and hits of their own in the search.

import type { PieceDef } from "sahne";

export interface Look {
  /** What a document names: the variant's name, or the kind's value. */
  name: string;
  /** The params it is drawn with. */
  params: Record<string, unknown>;
  /** A named look (`variant`), or a value of the `kind` param. */
  by: "variant" | "kind";
}

/** The looks of a piece or prop, the named ones first, in their own order; none for one with a single look. */
export function looksOf(def: PieceDef): Look[] {
  const named: Look[] = Object.entries(def.variants ?? {}).map(([name, params]) => ({ name, params: { variant: name }, by: "variant" as const }));
  const drawn = new Set(Object.values(def.variants ?? {}).map(p => p.kind));
  const kind = def.meta?.params?.kind as { values?: readonly string[] } | undefined;
  const plain: Look[] = (kind?.values ?? []).filter(v => !drawn.has(v)).map(v => ({ name: v, params: { kind: v }, by: "kind" as const }));
  const all = [...named, ...plain];
  return all.length > 1 ? all : [];
}

/** How a place or a story names a look: `"kit": "pastry", "variant": "croissant"`. */
export function lookRef(id: string, look?: Look): string {
  return look ? `"kit": "${id}", "${look.by}": "${look.name}"` : `"kit": "${id}"`;
}
