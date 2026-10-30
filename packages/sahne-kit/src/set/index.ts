// The set kit (`sahne-kit/set`): set pieces and props in families, each its own chunk, loaded when a
// story's places need them (DESIGN.md §12: a family stays within 40 KB). `families.gen.ts`, written by
// `set/build.ts`, says which family each id is in.
//
//   const loaded = await loadSet(places);              // the families these place documents use
//   const stage = mountStage(el, { kit: withSet(kit, loaded) });

import type { Kit, PieceDef } from "sahne";
import type { Family } from "./all.ts";
import { SET_FAMILY, PROP_FAMILY } from "./families.gen.ts";

export type { Family };

/** Each family's chunk. Add a family here and in `all.ts`. */
export const FAMILIES: Record<string, () => Promise<Family>> = {
  base: () => import("./base.ts"),
  airport: () => import("./airport.ts"),
  metro: () => import("./metro.ts"),
  props: () => import("./props.ts"),
  outdoor: () => import("./outdoor.ts"),
  street: () => import("./street.ts"),
  interior: () => import("./interior.ts"),
  furniture: () => import("./furniture.ts"),
  vehicles: () => import("./vehicles.ts"),
  food: () => import("./food.ts"),
  paper: () => import("./paper.ts"),
  misc: () => import("./misc.ts"),
  cookware: () => import("./cookware.ts"),
  meals: () => import("./meals.ts"),
  produce: () => import("./produce.ts"),
  household: () => import("./household.ts"),
  health: () => import("./health.ts"),
  tech: () => import("./tech.ts"),
  stationery: () => import("./stationery.ts"),
  leisure: () => import("./leisure.ts"),
  play: () => import("./play.ts"),
  clothes: () => import("./clothes.ts"),
  animals: () => import("./animals.ts"),
  garden: () => import("./garden.ts"),
  streetlife: () => import("./streetlife.ts"),
  transit: () => import("./transit.ts"),
};

/** What a place document names: its pieces' and props' kit ids. */
export interface PlaceLike { pieces?: { kit: string }[]; props?: Record<string, { kit: string }> }

/** The families these places use (ids not in the set kit are left out: the place lint reports them). */
export function familiesOf(places: Iterable<PlaceLike>): string[] {
  const out = new Set<string>();
  for (const pl of places) {
    for (const p of pl.pieces ?? []) if (Object.hasOwn(SET_FAMILY, p.kit)) out.add(SET_FAMILY[p.kit]);
    for (const p of Object.values(pl.props ?? {})) if (Object.hasOwn(PROP_FAMILY, p.kit)) out.add(PROP_FAMILY[p.kit]);
  }
  return [...out].sort();
}

/** What `loadSet` brings: the loaded families' set pieces and props. */
export interface LoadedSet { families: string[]; set: Record<string, PieceDef>; props: Record<string, PieceDef> }

const cache = new Map<string, Promise<Family>>();

/** Loads the families these places use (or the named families, or `"all"`), each once. */
export async function loadSet(what: Iterable<PlaceLike> | string[] | "all"): Promise<LoadedSet> {
  const list = what === "all" ? Object.keys(FAMILIES) : Array.isArray(what) && what.every(w => typeof w === "string") ? what as string[] : familiesOf(what as Iterable<PlaceLike>);
  const out: LoadedSet = { families: [], set: {}, props: {} };
  for (const name of list) {
    const load = FAMILIES[name];
    if (!load) throw new Error(`no set family ${name}`);
    if (!cache.has(name)) cache.set(name, load());
    const f = await cache.get(name)!;
    Object.assign(out.set, f.set);
    Object.assign(out.props, f.props);
    out.families.push(name);
  }
  return out;
}

/** The kit with these set pieces and props added to what it has. */
export const withSet = (kit: Kit, loaded: Pick<LoadedSet, "set" | "props">): Kit => ({ ...kit, set: { ...kit.set, ...loaded.set }, props: { ...kit.props, ...loaded.props } });

export { SET_FAMILY, PROP_FAMILY };
