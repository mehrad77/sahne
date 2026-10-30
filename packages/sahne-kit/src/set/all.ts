// Every family of set pieces and props, loaded at once: for the tests, the lints, the catalogue and the
// gallery. An app loads only the families its places use (`index.ts`, `loadSet`).

import type { PieceDef } from "sahne";
import * as base from "./base.ts";
import * as airport from "./airport.ts";
import * as metro from "./metro.ts";
import * as props from "./props.ts";
import * as outdoor from "./outdoor.ts";
import * as street from "./street.ts";
import * as interior from "./interior.ts";
import * as furniture from "./furniture.ts";
import * as vehicles from "./vehicles.ts";
import * as food from "./food.ts";
import * as paper from "./paper.ts";
import * as misc from "./misc.ts";
import * as cookware from "./cookware.ts";
import * as meals from "./meals.ts";
import * as produce from "./produce.ts";
import * as household from "./household.ts";
import * as health from "./health.ts";
import * as tech from "./tech.ts";
import * as stationery from "./stationery.ts";
import * as leisure from "./leisure.ts";
import * as play from "./play.ts";
import * as clothes from "./clothes.ts";
import * as animals from "./animals.ts";
import * as garden from "./garden.ts";
import * as streetlife from "./streetlife.ts";
import * as festival from "./festival.ts";

export interface Family { set: Record<string, PieceDef>; props: Record<string, PieceDef> }

/** The families by name, in the order the catalogue lists them. Add a family here and in `index.ts`'s `FAMILIES`. */
export const FAMILY_MODULES: Record<string, Family> = { base, airport, metro, props, outdoor, street, interior, furniture, vehicles, food, paper, misc, cookware, meals, produce, household, health, tech, stationery, leisure, play, clothes, animals, garden, streetlife, festival };

function merge(kind: "set" | "props") {
  const out: Record<string, PieceDef> = {};
  for (const [name, f] of Object.entries(FAMILY_MODULES)) for (const [id, def] of Object.entries(f[kind])) {
    if (Object.hasOwn(out, id) && out[id] !== def) throw new Error(`${kind} ${id} is in two families (${name})`);
    out[id] = def;
  }
  return out;
}

/** Every set piece and every prop. */
export const SET = merge("set");
export const PROPS = merge("props");
