// What the place views share: the place documents with the planned sites and the briefs' sub-places,
// each place's standard (lintPlace) and its wide-shot thumbnail.

import { hashString, type PlaceDoc } from "sahne";
import { lintPlace, needsOf, PLACE_RULES, type CardIndex, type Needs, type PlaceProblem, type StoryPlace } from "sahne-story";
import { $, chip } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import type { WorldRow } from "../shell/data.ts";
import { snapshot } from "../shell/thumbs.ts";
import * as BENCHES from "../bench.ts";

export type Doc = PlaceDoc & { placeholder?: string; district?: string };

/** The gallery's own test places (src/bench.ts): sets composed from the kit to try its pieces and the engine, not story places. */
export const BENCH_DOCS: Doc[] = Object.values(BENCHES);

export interface Board { docs: Doc[]; benches: Doc[]; world: WorldRow[]; needs: Needs; cards: CardIndex | null }
export async function board(ctx: Ctx): Promise<Board> {
  const [docs, world, needs, cards] = await Promise.all([ctx.data("places"), ctx.data("world").catch(() => []), ctx.data("needs").catch(() => ({})), ctx.data("cards").catch(() => ({}))]);
  return { docs: docs as Doc[], benches: BENCH_DOCS, world, needs, cards };
}

/** A place's problems against the standard. */
export const problems = (b: Board, doc: Doc, ctx: Ctx): PlaceProblem[] => lintPlace(doc as StoryPlace, { kit: ctx.kit, cards: b.cards, needs: b.needs });

/** One chip per rule: ✓, ! (warnings) or ✗ (errors), with the messages on hover. */
export function ruleChips(ps: PlaceProblem[]) {
  const s = $("span", "rules");
  for (const r of PLACE_RULES) {
    const mine = ps.filter(p => p.rule === r), err = mine.some(p => p.level === "error");
    s.append(chip(`${r} ${err ? "✗" : mine.length ? "!" : "✓"}`, err ? "bad" : mine.length ? "warn" : "ok", mine.map(p => p.message).join("\n")), " ");
  }
  return s;
}

/** The places a site has: the briefs' (needs.json) and the documents', in that order. */
export function placesOfSite(b: Board, site: string): string[] {
  const asked = Object.keys(b.needs[site]?.places ?? {});
  const built = b.docs.filter(d => (d.site ?? d.id) === site).map(d => d.id);
  return [...new Set([...asked, ...built])];
}
export const needsFor = (b: Board, id: string) => needsOf(b.needs, id);

/** A place's wide shot at its first time, drawn once by the stage and kept. */
export function placeThumb(ctx: Ctx, doc: Doc) {
  return snapshot(ctx, `place|${hashString(JSON.stringify(doc))}`, doc.id, () => ({ place: doc, cues: [{ scene: { place: doc.id, time: doc.times?.[0] ?? "day", at: {}, cam: "wide" } }], cast: {} }));
}
