// Node-only loaders for what the lints read from the content root (paths.ts): the card index, the places' needs and the root's
// own kit items. Used by the tests, the gallery's dev server (serve.mjs), the place checker and backstage. Reads only, never
// writes. Card ids are the file names.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import type { Kit } from "sahne";
import { compileDrawing, withDrawings, type DrawingDoc, type VariantDoc } from "../sahne-kit/src/drawing.ts";
import { validateDoc } from "./check/schema.ts";
import type { CardIndex, CardInfo } from "./src/cards.ts";
import type { Needs } from "./src/needs.ts";
import { CARDS, CARDS_EXTRA, KIT_PIECES, KIT_VARIANTS, NEEDS } from "./paths.ts";

/** Every card of `cards/` and `cards-extra/`: id → level, Turkish, English and whether it is retired; null when the content root has no cards. */
export function loadCards(): CardIndex | null {
  if (!existsSync(CARDS)) return null;
  const out: CardIndex = {};
  for (const url of [CARDS, CARDS_EXTRA]) {
    if (!existsSync(url)) continue;
    for (const f of readdirSync(url).filter(f => f.endsWith(".json")).sort()) {
      const c = JSON.parse(readFileSync(new URL(f, url), "utf8"));
      const info: CardInfo = { tr: c.tr ?? "", en: c.en ?? "" };
      if (c.level) info.level = c.level;
      if (c.retired) info.retired = true;
      out[f.slice(0, -5)] = info;
    }
  }
  return out;
}

/** What the briefs ask of each place (`needs.json` of the content root); undefined when it has none, and the needs rules do not run. */
export function loadNeeds(): Needs | undefined {
  return existsSync(NEEDS) ? JSON.parse(readFileSync(NEEDS, "utf8")) : undefined;
}

/** A content root's own kit items, read and checked: the good ones, and a line for each file that is not. */
export interface ContentKit { docs: (DrawingDoc | VariantDoc)[]; problems: string[] }

/**
 * The kit items of a content root's `kit/` folder (`pieces/<id>.json`, `variants/<of>.<name>.json`; `root` is a folder URL, by
 * default the content root). A file is kept when it is JSON, passes its schema, is named for what it holds and compiles
 * (`compileDrawing`); with `kit` (the kit the items are to be added to) it must also add cleanly: its id free, the generator a
 * variant names there. Bad files are left out and named in `problems`, so one of them never keeps the rest from the stage. An
 * app calls `withDrawings(kit, docs)` with the result, one line after `loadSet` (sahne-kit's DRAWING.md). Reads only.
 */
export function loadContentKit(o: { root?: URL; kit?: Kit } = {}): ContentKit {
  const pieces = o.root ? new URL("kit/pieces/", o.root) : KIT_PIECES, variants = o.root ? new URL("kit/variants/", o.root) : KIT_VARIANTS;
  const docs: (DrawingDoc | VariantDoc)[] = [], problems: string[] = [];
  const read = (dir: URL, name: string, kind: "kit_piece" | "kit_variant"): unknown => {
    const where = `kit/${kind === "kit_piece" ? "pieces" : "variants"}/${name}`;
    let doc: unknown;
    try { doc = JSON.parse(readFileSync(new URL(name, dir), "utf8")); } catch (e) { problems.push(`${where}: ${(e as Error).message}`); return null; }
    const bad = validateDoc(kind, doc);
    if (bad.length) { problems.push(...bad.slice(0, 5).map(p => `${where}: ${p.path} ${p.message}`)); return null; }
    return doc;
  };
  const json = (dir: URL) => existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith(".json")).sort() : [];
  const mine: DrawingDoc[] = [];
  for (const f of json(pieces)) {
    const doc = read(pieces, f, "kit_piece") as DrawingDoc | null;
    if (!doc) continue;
    if (doc.id !== f.slice(0, -5)) { problems.push(`kit/pieces/${f}: the file is named for ${f.slice(0, -5)} but holds ${doc.id}`); continue; }
    const bad = compileDrawing(doc).problems;
    if (bad.length) { problems.push(`kit/pieces/${f}: ${bad.join("; ")}`); continue; }
    mine.push(doc);
  }
  const named: VariantDoc[] = [];
  for (const f of json(variants)) {
    const doc = read(variants, f, "kit_variant") as VariantDoc | null;
    if (!doc) continue;
    if (`${doc.of}.${doc.name}` !== f.slice(0, -5)) { problems.push(`kit/variants/${f}: the file is named for ${f.slice(0, -5)} but holds ${doc.of}.${doc.name}`); continue; }
    named.push(doc);
  }
  if (!o.kit) return { docs: [...mine, ...named], problems };
  // against the kit: one at a time, so a clash leaves out only itself (pieces first: a variant may name one)
  let kit = o.kit;
  for (const doc of [...mine, ...named]) {
    try { kit = withDrawings(kit, [doc]); docs.push(doc); }
    catch (e) { problems.push(`kit/${"of" in doc ? `variants/${doc.of}.${doc.name}` : `pieces/${doc.id}`}.json: ${(e as Error).message}`); }
  }
  return { docs, problems };
}
