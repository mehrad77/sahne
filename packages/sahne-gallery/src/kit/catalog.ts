// Every set generator as the gallery lists it: its family, whether it is a piece, a prop or both, its
// meta and variants, and what its drawing does (glows, emits, moves, carries words, lights, is built in
// depth), found by drawing its default and each variant once. Which places use it and which briefs ask
// for it come from the data files.

import { rng, withVariant, type PieceDef, type PieceMeta, type PlaceDoc, type FlatSpec } from "sahne";
import { FAMILY_MODULES } from "sahne-kit/set/all";
import type { Needs } from "sahne-story";
import { KIT } from "../shell/kit.ts";
import credits from "../../../sahne-kit/src/set/drawn/CREDITS.json" with { type: "json" };

export type Feature = "glow" | "emits" | "moves" | "words" | "lights" | "depth" | "when";
export const FEATURES: Record<Feature, string> = {
  glow: "glows at night", emits: "steam, smoke or flame", moves: "moves on its own", words: "carries words (HTML text)",
  lights: "lights the place", depth: "built in depth (pitched or turned flats)", when: "shows by weather, time or state",
};

/** Who drew an item promoted from a story (sahne-kit/drawing/promote.ts), from `CREDITS.json`. */
export interface Credit { by: string; contact: string; story?: string; date: string; consent?: true | "project"; from: string }
const CREDITS = new Map((credits as (Credit & { id: string })[]).map(c => [c.id, c]));

export interface Gen {
  id: string;
  /** The author, for an item promoted from a story. */
  credit?: Credit;
  family: string;
  kind: "piece" | "prop" | "both";
  def: PieceDef;
  meta?: PieceMeta;
  variants: string[];
  features: Set<Feature>;
  /** Emitter and motion kinds its drawings use. */
  emit: Set<string>;
  motion: Set<string>;
}

function probe(def: PieceDef, id: string) {
  const features = new Set<Feature>(), emit = new Set<string>(), motion = new Set<string>();
  for (const p of [{}, ...Object.keys(def.variants ?? {}).map(v => ({ variant: v }))]) {
    let out;
    try { out = def.draw(withVariant(def, p), rng(id), KIT); } catch { continue; }
    const zs = out.flats.map((f: FlatSpec) => f.z ?? 0);
    for (const f of out.flats) {
      if (f.emissive) features.add("glow");
      if (f.text?.length) features.add("words");
      if (f.when) features.add("when");
      if (f.pitch || f.yaw) features.add("depth");
      for (const k of ["scroll", "path", "sway", "blink"] as const) if (f.move?.[k]) { motion.add(k); features.add("moves"); }
      if (f.move?.path?.pts.some(q => q[2] !== f.move!.path!.pts[0][2])) features.add("depth");
    }
    if (zs.length && Math.max(...zs) - Math.min(...zs) > 60) features.add("depth");
    for (const e of out.emitters ?? []) { emit.add(e.kind); features.add("emits"); }
    if (out.lights?.length) features.add("lights");
  }
  return { features, emit, motion };
}

let all: Gen[] | null = null;
/** Every generator, once each (a piece that is also a prop is one entry), by family then id. */
export function generators(): Gen[] {
  if (all) return all;
  const out: Gen[] = [];
  for (const [family, mod] of Object.entries(FAMILY_MODULES)) {
    const ids = [...new Set([...Object.keys(mod.set), ...Object.keys(mod.props)])].sort();
    for (const id of ids) {
      const def = (mod.set[id] ?? mod.props[id]) as PieceDef;
      out.push({ id, family, ...(CREDITS.has(id) ? { credit: CREDITS.get(id) } : {}), kind: mod.set[id] && mod.props[id] ? "both" : mod.set[id] ? "piece" : "prop", def, meta: def.meta, variants: Object.keys(def.variants ?? {}), ...probe(def, id) });
    }
  }
  return (all = out);
}
export const generator = (id: string) => generators().find(g => g.id === id);

/** The places that use each kit id, and how (piece, prop). */
export function usage(places: PlaceDoc[]): Map<string, { place: string; as: "piece" | "prop"; variant?: string }[]> {
  const m = new Map<string, { place: string; as: "piece" | "prop"; variant?: string }[]>();
  const add = (id: string, v: { place: string; as: "piece" | "prop"; variant?: string }) => { const l = m.get(id) ?? []; l.push(v); m.set(id, l); };
  for (const p of places) {
    for (const r of p.pieces) add(r.kit, { place: p.id, as: "piece", variant: r.variant });
    for (const r of Object.values(p.props ?? {})) add(r.kit, { place: p.id, as: "prop", variant: r.variant });
  }
  return m;
}

/** What the briefs ask of each kit id (needs.json): the place, the prop's name there, its variant and words. */
export function asked(needs: Needs): Map<string, { place: string; name: string; variant?: string; terms: string[]; story: boolean }[]> {
  const m = new Map<string, { place: string; name: string; variant?: string; terms: string[]; story: boolean }[]>();
  for (const site of Object.values(needs)) for (const [place, n] of Object.entries(site.places)) {
    for (const [story, list] of [[false, n.props], [true, n.storyProps]] as const) for (const [name, p] of Object.entries(list ?? {})) {
      const l = m.get(p.kit) ?? [];
      l.push({ place, name, variant: p.variant, terms: p.terms, story });
      m.set(p.kit, l);
    }
  }
  return m;
}
