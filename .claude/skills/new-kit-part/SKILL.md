---
name: new-kit-part
description: Add or change art in sahne-kit - a character part (hair, clothes, face values, accessories), a set piece or a prop - the way the kit expects it. Use whenever a change touches packages/sahne-kit/src (people's parts, src/set/ generators, props), renames or retires an id, or adds a variant.
---

# A new kit part, set piece or prop

The kit is art as code, held together by contracts the tests enforce. Missing one fails the gate late, or worse, slips through. Read `packages/sahne-kit/STYLE.md` before drawing anything, and look at a neighbour of what you are adding: copy its shape, not just its idea.

## Ids are permanent

- A part id is `<kind>_<variant>` (`^[a-z]+_[a-z_]+$`), unique across every part file, and never renamed: documents in the wild name it. Retire or rename through the kit's `aliases` (old id → new id); keep the old one working.
- The same goes for set pieces, props, variants, sounds and gestures that a place or a story may use.

## A character part (hair, clothes, accessories, faces)

1. **Where:** one file per category in `packages/sahne-kit/src/` (`hair.ts`, `tops.ts`, `outer.ts`, `headwear.ts`, …), listed in `PART_FILES` (`src/index.ts`). The slot rules are the engine's (`sahne/src/avatar/rules.ts`, the part contract in `sahne/src/core/kit.ts`): a part goes in the slot it declares.
2. **Draw it** with the category's helpers (`hairPart`, `named`, …), front and back views, every build it supports (`builds`), with `tags` and `odds` like its neighbours. People rules in STYLE.md (*People*, *Colour*): the paper look, the palettes, no outlines that the rim already draws.
3. **Curate it:** every part has exactly one entry in `src/curation.ts`: `open`, `unlock` (with its token), `cast` (reserved: see LICENSE-ART) or `hidden`. Never lock a faith, body-trait, heritage-of-identity or accessibility item, or skin. `starter: true` only for a few per field.
4. **If it was planned**, it is in `catalogue/plan.json`: drawing it moves it from "to come" to drawn.
5. **Regenerate the catalogue:** `node packages/sahne-kit/catalogue/build.ts` (CATALOGUE.md); `--check` must pass.

## A set piece or prop

1. **Where:** `packages/sahne-kit/src/set/<family>.ts`, one file per family, each within 40 KB gzip. Shared helpers come from `src/set/draw.ts` (`S`, `P`, `L`, `num`, `str`, `flip`, `holed`, …); never copy one into a family.
2. **Declare it in `meta`** (`PieceDef.meta`): one line on what it draws, every param it reads with its kind, range or `enum` values and its default, the place states it answers to, its terms and tags. `test/meta.test.ts` holds the meta to what the drawing actually reads.
3. **Draw by STYLE.md** (*Places*, *Props*): puppet scale (a counter about 86 cm), a prop's origin at its bottom centre and, held, at the grip; `ppcm` ≤ 3 for pieces and ≤ 16 for props, no flat over 2040 px; things that glow at night in `emissive`, lit windows by turns; words on signs as `text` overlays, never drawn into the art; landmarks as stylised silhouettes, never traced.
4. **Named looks** go in `variants`, and each variant is permanent too.
5. **Regenerate:** `node packages/sahne-kit/set/build.ts` (SET.md and `src/set/families.gen.ts`); `--check` must pass.

## A story's own item

A set piece or prop a story needs and the kit lacks is a **drawing**: data in the story's content root (`kit/pieces/x_<id>.json`), made and looked at through backstage's MCP tools (`kit_search`, `kit_read` a neighbour, `draft_kit_item`, `save_kit_item`; from the shell `server/call.ts`), the format in `packages/sahne-kit/DRAWING.md`. No kit code changes. When a good one should be official, ask the person for their name, a contact and their consent (CC BY 4.0, their own work), then `promote_kit_item` or `node packages/sahne-kit/drawing/promote.ts` (DRAWING.md *Promoting*): it checks, writes `src/set/drawn/<family>/<id>.json` with the credit, makes the old `x_` id an alias and draws the review sheets. A family takes drawn items only when its file imports `./drawn/<family>.gen.ts` (see `bakery.ts`).

## Check it

1. **Render it after every edit**, from the shell: `node packages/sahne-backstage/server/call.ts kit_render '{"items":[{"id":"<id>"},{"id":"<neighbour>"}]}' --content <root> --session kit` prints the kit's own problems and a PNG path to Read (one sheet, a cell per item, each look by day and night, a 170 cm adult beside it). The session keeps the kit loaded and restarts itself when a generator's TypeScript changed, so you see your edit. A story's own drawing (`x_…`) uses `draft_kit_item` the same way (*DRAWING.md*).
2. **Look at it in the gallery** (use the `visual-check` skill): the part in `#/kit/people` (the studio: `?tab=studio`), the piece in `#/kit/set/<id>` with its params as controls, a family at once with `node packages/sahne-gallery/kit-sheet.ts --family <name> --out <dir>`, and in a real place if it belongs to one.
3. **Sizes:** `node packages/sahne-gallery/size.mjs`; the budgets bind (README, DESIGN.md §12) and a bundle over budget fails the gate.
4. **The gate:** `pnpm check`. A part that changes how existing people or places look changes golden frames: update them only on purpose and say so.
5. **Docs follow the code** in the same commit: STYLE.md if you set a new rule, the generated CATALOGUE.md and SET.md always. Commit as `feat(kit): …`.
