---
name: new-place
description: Build or change a Sahne place document - the set pieces, marks, perch, times, camera, props and sound of a stage location - and prove it stages well. Use when adding a place to a content root (samples/places), a test bench in the gallery (src/bench.ts), or a place for a scene or film, or when a scene looks wrong because of its place.
---

# A new place

A place is a JSON document (`PlaceDoc`, `packages/sahne/src/core/types.ts`; the format is DESIGN.md §5.5): set pieces at real depths, marks where people stand, the times it may be shown at, its camera, its props, its ambience. Read STYLE.md *Places* and *Props* first, and start from the nearest existing place rather than from nothing.

## Where it lives

| Kind | Where |
|---|---|
| A story place | `places/<id>.json` in the content root (`packages/sahne-story/samples/places/` here; Kumru's in its own repo). Every path comes from `packages/sahne-story/paths.ts`, never built by hand. |
| A test bench for a demo | `packages/sahne-gallery/src/bench.ts` (`BENCH_*`); it shows on the Places board under Test benches. |
| A variant for one script | spread an existing document with new marks or props (see `withMarks` in `packages/sahne-gallery/src/film.ts`) and give it its own id. |

## Build it

- **Pieces:** back to front: sky and far city, street or wall, furniture, the floor. The wall fills the top of the wide framing; the floor reaches the bottom. Generators and their params are in `packages/sahne-kit/SET.md`; a missing piece is a `new-kit-part` job.
- **Marks** (metres, `x` across, `z` towards the camera, `y` up): every spot a scene will use: ground marks for people (`facing: "l" | "r"` to turn them a little), `door` marks with `out` for enter and exit, `seat` marks (seat height) for sitting, `air` marks for birds (`pace` beside something moving), a `perch` for Kerim. A seat facing the camera needs no `facing`; `facing: "back"` turns the person away from it, only for someone the camera sees from behind. Give the animals and extras marks of their own: a scene can only put someone on a mark the place has.
- **Times:** list every time a scene may use (`dawn`, `day`, `golden`, `dusk`, `night`, `overcast`); the light is the engine's, the art is never redrawn per time.
- **Camera:** `camera.wide` frames the place (`x`, `w`, `z`, optional `y0`/`y1`); check it at desktop and phone width.
- **Props:** `props.<id>` with `kit`, `variant`, `at` (a point, a mark or an actor) and `terms`; `keep: true` for one that travels with whoever carries it to the next place; a thing that may go missing gets clear space around it.
- **States** (`flags`, `window_lit`, a shutter, …) for what a story switches; **ambience**, **motif** and **surface** for the sound.
- **Budget:** about 5 KB of JSON, and every flat must fit a layer of the atlas.

## Check it

1. **Lint:** `node packages/sahne-story/places.ts <id>` prints it against the place standard (valid, needs, depth, density, explore, crowd, reach, light, sound, budget); `--check` fails on any error. A draft outside the content root: `--file <path>.json`.
2. **Scout it** in the gallery: `#/places/<id>` (the marks drawn over the stage: tap one to walk there), `#/places/<id>/sheet` (every time × width), `#/places/<id>/camera` (is everyone in frame).
3. **Shoot it** (the `visual-check` skill): `node packages/sahne-gallery/shots.mjs --out <dir> --places <id> --camera`; it exits 1 when a figure is out of frame. Then stage a short script on it (people on each mark, a walk, a door, the times it lists) and look at mid-cue frames.
4. **The gate:** `pnpm check` (the story check lints every place in the content root; a sample place is in the golden frames).
5. Docs follow the code: a new test bench gets its line in the comment above it; a new rule goes in STYLE.md. Commit as `feat(story): …` for a sample place, `feat(gallery): …` for a bench.
