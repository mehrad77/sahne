# Pieces drawn as data

A set piece or a prop can be a JSON document instead of code: SVG path data, colours, words and a few motions. `sahne-kit/drawing` (`src/drawing.ts`, browser-safe, no Node, about 3 KB gzip) turns it into the same `PieceDef` the kit's generators are, so it passes the same checks (`sahne-kit/check`), draws to SVG and to the stage's atlas, and takes a place's `variant`, `n` and `held` like any other. This is the one place the format is described; the schemas are `sahne-story/schema/kit-piece.json` and `kit-variant.json`. The look it must have is [STYLE.md](STYLE.md)'s.

```ts
import { fromDrawing, withDrawings, checkDrawing } from "sahne-kit/drawing";
fromDrawing(doc);            // one PieceDef; throws, saying what is wrong
checkDrawing(doc);           // the problems as a list, [] when good
withDrawings(kit, docs);     // the kit with pieces and variants added (after withSet, so variants can name its generators)
```

A content root keeps its documents in `kit/pieces/<id>.json` and `kit/variants/<of>.<name>.json`; `loadContentKit()` (`sahne-story/load.ts`) reads and checks them, and backstage, the story checks and the gallery add them to their kit (sahne-story's README, *Where the data lives*).

## A drawing

```jsonc
{ "id": "x_cafe_chalkboard", "as": "prop", "about": "A chalkboard menu, on an easel or hung on the wall.",
  "tags": ["cafe"], "terms": [],
  "params": { "color": { "type": "color", "default": "#2F3B35" }, "label": { "type": "text", "default": "Menu" },
              "kind": { "type": "enum", "values": ["easel", "wall"], "default": "easel" } },
  "kinds": { "easel": { "size": [60, 110], "ppcm": 8, "grip": [0, -60],
    "flats": [{ "shapes": [{ "d": "M-30 0L-24 -110H24L30 0Z", "fill": "$color" },
                           { "d": "M-20 -20H20V-90H-20Z", "fill": { "tone": "$color", "step": "shade" }, "flat": true }],
                "text": [{ "text": "$label", "x": -18, "y": -86, "w": 36, "h": 60, "font": "hand", "lang": "fr" }],
                "glow": [], "sway": null, "shadow": "drop" }] } },
  "repeat": { "gap": 6 }, "variants": { "wall": { "kind": "wall" } }, "solid": null }
```

- **`id`** starts with `x_` (`^x_[a-z0-9_]+$`): see *Ids* below. **`as`** is `prop` (in `kit.props`), `set` (in `kit.set`) or `both`. **`about`** says what it draws, as a generator's `meta.about` does; `tags` and `terms` are `meta.tags` and `meta.terms`.
- **Units** are centimetres, the origin at the bottom centre, y up negative: the kit's own, so a drawing is cut like any other (STYLE.md *Paper*, *Props*). Real sizes; a set piece is drawn at `ppcm` ≤ 3 and a prop at ≤ 16 (`ppcm` defaults to 1.6 for a set piece, 5 otherwise).
- **`params`** declare what a place may set: `type` is `enum` (with `values`), `int`, `num` (with `min`, `max`), `bool`, `text` or `color`, with a `default` and an `about`. A param named `kind` is an enum that picks one of `kinds`, and its values are exactly their names; a drawing with one kind needs no `kind` param. `n`, `held` and `variant` are the engine's and may not be declared.
- **`kinds`** are the drawings one param picks between. A kind has `size` `[width, height]` (the width is what `n` steps by), `ppcm`, `grip` (where a hand holds it), `flats`, and optional `lights` and `emitters` (as `LightSpec` and `EmitSpec`, in cm from the origin, y up).
- **A flat** is one paper piece: `shapes` back to front, `text`, `glow`, and `shadow` (`drop` by default, or `none`), `x`, `y`, `z`, `lit`, `front` (as `FlatSpec`). `sway` `{rot, dy, ms}` and `blink` `{ms, on, at}` are `FlatMotion`'s, and `null` is none.
- **A shape** is `d` (SVG path data: M L H V C S Q T A Z, absolute and relative, read by `Path.fromSvg`; arcs become cubics), then `fill`, `stroke` `{color, width, cap}`, `opacity`, `flat` (no rim and no shadow: print, glints) and `evenodd` (holes). A shape needs a fill or a stroke. The paper look (the rim, the layer shadows) comes from the renderer: never draw outlines or grain.
- **A colour** is a `#RRGGBB`, a palette id (`fab_12`), `"$param"` (a `color` param, given as either of those) or `{ "tone": colour, "step": "shade" | "deep" | "light" | "edge" | "base" }`: the tone ramp of STYLE.md *Paper*, so a drawing never hand-picks a darker colour.
- **Text** is a box of words in the flat's cm (`x`, `y`, `w`, `h`), laid out by the page as HTML over the art (DESIGN.md §6.8): `font`, `size`, `color`, `align`, `weight`, `lit` as `TextSpec`. `lang` is required. `$param` anywhere in `text` is replaced by that param's value; a `$name` that no param declares is an error, so a typo is caught. A held prop's words go on its first flat.
- **`repeat.gap`** (default 4 cm) is the space between the copies `n` makes: side by side, centred, each a whole copy of every flat. A set piece has no `n`.
- **Held** (`held: true`): the origin moves to `grip`, the shadow drops, and only the first flat is drawn, as for every prop.
- **`variants`** are named param sets of this piece, as `PieceDef.variants` (`"wall": { "kind": "wall" }`): a place says `variant: "wall"`. They may set only declared params, to legal values.
- **`solid`** is `null` or a list of `{ a: [x, z], b: [x, z], door? }` lines on the floor, in cm (DESIGN.md §7).

**Caps** (`DRAWING_LIMITS`): a document at most 64 KB, 400 shapes (`glow` shapes count) and 20 000 path commands (after arcs), at most 12 flats to a kind and 12 copies.

## A variant of the kit's generator

```jsonc
{ "of": "flag", "name": "x_club_colours", "params": { "kind": "bunting", "w": 400 } }
```

`of` names a generator already in the kit (a set piece, a prop, or a drawing added before it); `name` starts with `x_`; `params` are set as any variant's are. Its params are checked with `paramProblems` (`sahne-story`), against the generator's `meta`. A name the generator already has, or a param it does not declare, is refused.

## Ids

Every id a content root adds starts with `x_`, and `test/drawing.test.ts` asserts no id of the kit (set pieces, props, parts, aliases, variants) ever does. So a new kit part can never take the id a story already uses, and `withDrawings` never overrides a kit id: a drawing whose id is taken is an error.

## Checking

`checkDrawing` reads what a schema cannot: that every path parses, every `$param` is declared (and a colour in a colour place), the kinds match the `kind` param, and the caps hold (including every coordinate and size within 1000 cm). `checkPiece` (`sahne-kit/check`) then holds the compiled generator to the kit's own rules as for any other: the meta, the variants, every param read declared, finite art that fits an atlas layer, motion, and text with a language. Both run on a document before an app loads it.

## The loop, over MCP or from the shell

Backstage's MCP tools (this file is its `sahne://kit-guide` resource) do the plumbing, so the effort goes to the drawing: `kit_search` for what exists, `kit_read` a neighbour, `draft_kit_item` and look at the sheet, revise until there are no problems, then `save_kit_item`. An agent with no MCP set up reaches the very same tools from the shell and reads the PNGs it prints:

```bash
node packages/sahne-backstage/server/call.ts draft_kit_item @doc.json --content <root> --session kit
```

`kit_render` and `draft_kit_item` take a list (`items`, `docs`) and answer ONE sheet with a labelled cell per item, so a batch or a family is judged in one look. Each cell prints its scale (`1 cm = 16 px · grid 1 cm`): a thing under 60 cm fills its cell with a scale bar (a held one with a red cross at its grip), a larger one stands beside a 170 cm adult; pass `"zoom": "scene"` to draw every cell at one scale beside the adult and compare sizes. `--session kit` keeps the server alive between calls (a render in about half the time, a search in a sixth: the numbers are in that README) and restarts it when TypeScript of the kit changed, so a generator you edited draws as edited. The flags and the tool list are in sahne-backstage's README (*Calling a tool from the shell*).
