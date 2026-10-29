# Sahne

A paper-theatre stage engine for illustrated, interactive dialogue scenes on the web. The design, the decisions and the milestones are in [DESIGN.md](DESIGN.md).

## Packages

| Package | What |
|---|---|
| `packages/sahne` | The engine: formats, script and world state, director, timeline, rig, face model, avatars and the builder, the WebGL2 paper backend and the SVG still backend, audio, interaction, the overlay. No dependencies |
| `packages/sahne-kit` | The first kit: body, faces, hair, clothes, set pieces, props, sounds and music motifs, all made in code. Its style guide is [STYLE.md](../sahne-kit/STYLE.md), its parts are listed in [CATALOGUE.md](../sahne-kit/CATALOGUE.md) |
| `packages/sahne-tr` | The Turkish plugin: mouth timing from spelling, whether a word of a line is a form of a linked token, say-it-aloud matching ([README](../sahne-tr/README.md)) |
| `packages/sahne-story` | The story format: the adapter (a story document becomes a script), the player, the lints and the story check, `paths.ts` (the content root, `SAHNE_CONTENT` or the samples) and a sample story ([README](../sahne-story/README.md)) |
| `packages/sahne-gallery` | The dev gallery: one page with a live demo of every engine system, the kit (set and props, people, gestures, sounds, Kerim, the animals), every place scouted and every story played through the adapter, from the content root ([README](../sahne-gallery/README.md)) |

[`packages/README.md`](../README.md) has the conventions all of them follow.

Everything is TypeScript with erasable syntax only: Node 24 runs the tests directly, and esbuild bundles for the browser.

## Commands

From the repo root:

```bash
pnpm sahne dev
```

starts the gallery on http://localhost:5180 (`preview_start sahne-gallery` in the Browser pane). It rebuilds on save; reload the page.

```bash
pnpm sahne check
```

type-checks the five packages, measures the bundles against their budgets (`size.mjs`, DESIGN.md §12) and runs the Node tests of the engine, the kit, the Turkish plugin and the story adapter.

## Where things are

| Path | Holds |
|---|---|
| `src/core/` | Maths (2D affines, 4×4 camera matrices, easing), colour tones, seeded random, the formats (`types.ts`), the kit contract with the gesture format (`kit.ts`) and the language-plugin contract (`lang.ts`) |
| `src/script/` | The script's cues (`types.ts`) and the world state after a cue (`world.ts`) |
| `src/director/direct.ts` | The director: one cue and the world before it become a performance; `fold` |
| `src/anim/timeline.ts` | A performance's tracks and `evaluate(perf, t)`, the state of the stage at any moment |
| `src/art/` | `Path` and the shape helpers (`smooth`, `band`, `ellipse`, `rrect`…), groups and their paper drawing (rim and layer shadows) |
| `src/rig/` | The humanoid skeleton and forward kinematics (`skeleton.ts`); `composePose` (`pose.ts`): carry, walk, posture, idle, gestures, IK and the floor, one pure function; the kit puppets' rigs, a bird (`bird.ts`) and a cat (`cat.ts`) |
| `src/face/params.ts` | The face model every backend reads |
| `src/avatar/` | Avatar document + kit → puppet with the slot rules (`compose.ts`, `rules.ts`), checking and trimming an untrusted document (`normalize.ts`), the headless builder model (`builder.ts`), changes of clothes (`look.ts`: `applyLook`) |
| `src/render/paper/` | The WebGL2 backend: atlases, the one shader, light presets, framing |
| `src/render/still/` | The SVG backend: portraits, still frames, the fallback without WebGL2 |
| `src/ui/` | The overlay: speech bubbles (tails aimed at the mouth; their `lang` and `dir` the stage language plugin's), sound words and the narrator's window, as HTML over the canvas (`overlay.ts`, its geometry in `place.ts`); tap-to-translate (`gloss.ts`); text on props (`prop-text.ts`, attached by a page as `propText(stage)`); the builder screen (`builder.ts`, `builder-plan.ts`, `builder-css.ts`); the interaction layer's styles |
| `src/interact/` | Hit tests and alpha masks (`hit.ts`), the act state machine (`act.ts`) and the layer a page attaches to a stage (`index.ts`) |
| `src/listen/` | Say it aloud, imported as `sahne/listen` |
| `src/audio/` | The synthesizer (`dsp.ts`: patches rendered to samples in code), the motif sequencer (`motif.ts`), the speech clock that lets a voice keep the time (`clock.ts`), the Web Audio engine with its four buses (`engine.ts`) and the browser voice (`voice.ts`) |
| `src/stage.ts` | The stage: loads a script with its places and cast, plays cues (`show`, `play`, `act`), poses and draws back to front, and plays each performance's sounds and voiced lines |

## Status

The engine build (B0–B5, DESIGN.md §15) is done. `pnpm sahne check` runs 574 tests: 566 pass on the samples, and 8 that need data the samples lack (a `needs.json`, Kumru's airport) are skipped.

- **The look (B1):** the paper renderer, five light presets (`day`, `golden`, `dusk`, `night`, `overcast`), the framings, the paper flip, the bakkal.
- **Rig and acting (B2):** the script and the director, the timeline, the rig (gestures, IK, walk, carry, idle life), 12 hand shapes, 39 gestures and 14 emotions, lip-sync through `sahne-tr`, faces with gaze and blinks, props that hide, change hands, are placed on a mark and are kept from place to place, costume changes from a wardrobe, text on props (a sign's label, a phone's screen) as HTML on their paper plane, kit puppets (a bird that perches, hops, flies and hovers, `rig/bird.ts`; a cat that sits, loafs, sleeps, strides, looks and miaows, `rig/cat.ts`; Pisi and the gulls in `sahne-kit/puppets`), the `follow` cam, a door that swings, the bubbles and Kerim's narrator window (`bubbles: "log"` and `setBubbles` leave the lines to the app in log mode), tap-to-translate behind a flag.
- **Audio (B3):** the synthesizer and sequencer, 27 kit sounds and 6 motifs, four buses with ducking, sounds planned by the director (the script's `sfx`, footsteps, doors, the paper flip, Kerim's coo, a place's motif and ambience), the browser voice with the clock following its word marks, sound words as captions, and four CC0 recordings (`sahne-kit/sounds/SOURCES.md`) with their patches as the fallback.
- **Avatars (B4):** the kit's first batch (125 parts of a 433-part plan), the headless builder and its screen (`mountBuilder`: starter set, author mode), SVG portraits.
- **Interaction (B5):** `act` cues (tap, drag, go, choose) with hints and the accessible list, explore (`inspect`), hit tests on alpha masks, say it aloud (`sahne/listen`), and the story adapter in `sahne-story`. The sample story s1e00 plays end to end in the gallery, and so do Kumru's stories with `SAHNE_CONTENT` set.

**Typed but not built.** The director accepts these and does nothing, or falls back:

- the cams `ots`, `split` and `photo` (framed as a plain bust);
- `via` (a phone or video call) and `frame` (`past`, `past_inset`);
- the `obj` op `own`;
- the `overlay` cue (the director ends it at once);
- a `cat` skeleton.

**Next:** what Sahne needs next is planned with [Kumru](https://github.com/mehrad77/kumru), its first app; ideas and bugs are welcome as issues and pull requests ([README](../../README.md)).
