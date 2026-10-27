# sahne-gallery

The dev gallery of [Sahne](../sahne/README.md): everything the engine and its kit can do, live, for review in the browser and as the reference for what Sahne is. It is not shipped to any app.

```bash
pnpm sahne dev     # from the repo root: the gallery on http://localhost:5180 (preview_start sahne-gallery)
pnpm sahne check   # types, sizes, bundle determinism, every package's tests, the gallery's coverage, golden frames
pnpm sahne golden:update   # rewrite golden/<platform>/ after a deliberate change of look (Playwright's Chromium: `pnpm --dir packages/sahne-gallery exec playwright install chromium`); Linux baselines come from the CI artifact
```

## How it is built

`index.html` is the whole gallery: one page (`src/app.ts`) with a sidebar of sections (`src/registry.ts`: Home, Docs, Systems, Kit, Places, Stories, Cast, For maintainers), a top bar of gallery-wide settings (motion, sound, captions, the stage width 390 or 1100 px, theme) and a view per hash route, `#/<section>/<path…>?<query>`. A view keeps its controls' state in the query, so its address is a link to exactly what it shows: send that link with a step's screenshots. Each section is a lazy chunk (`dist/app/`, git-ignored). The shell (`src/shell/`) gives every view its controls and its own CSS (`dom.ts`), the env bar (`env.ts`: time, weather, thunder, lights, states, fireworks, played as a script's `env`), stages that follow the settings and are freed on a route change (`ctx.ts`; a browser keeps about 16 WebGL contexts, so a view mounting more than 6 is warned about), stage-drawn thumbnails (`thumbs.ts`) and the data files (`data.ts`).

`serve.mjs` bundles with esbuild (rebuilt on save; reload the page) and serves the folder. The data a view shows is made by `data.mjs` and read from disk on every request, at `/data/<name>.json`. The story data comes from the content root (`$SAHNE_CONTENT`, or `sahne-story/samples/`; every path from `sahne-story/paths.ts`): `places` (`places/*.json`), `needs` (`needs.json`, `{}` without it), `cards` (`cards/` and `cards-extra/` through `sahne-story/load.ts`, read only; `null` without them), `vocab` (the A1 cards of `cards/`, for tap-to-translate; `[]` without them), `drafts` (the bakkal test scene and every story of `stories/`), `cast` and `extras` (`characters/`, through the story check's loaders). The rest: `catalogue` (`sahne-kit/catalogue/plan.json`), `world` (the planned sites, the tables of `STORIES_WORLD.md` §2 in `$SAHNE_STORY_DOCS`, so keep their format; `[]` without it), `sizes` (`size.mjs`, kept a minute) and `kerim` (Kerim's art and her CSS from the kit, `sahne-kit/src/kerim/`). A new place or story shows after a reload; only an edit to `serve.mjs` needs a restart (a broken `serve.mjs` makes `preview_start sahne-gallery` fail). To see another app's stories, start it with that content root: `SAHNE_CONTENT=/abs/path/to/data pnpm sahne dev`. The kit's recordings are copied to `dist/sounds/` at start-up, and Comic Neue (the bubbles' hand font, `@fontsource/comic-neue`) to `dist/fonts/`.

**The static site.** `pnpm sahne build` (`build.mjs`) writes the gallery as a static site to `dist/site/`: the page with its social-card head (`index.html`; the card is the repo's `assets/social-preview.jpg`, copied as `og.jpg`), the bundle minified, each `/data/<name>.json` and each doc written once, the sounds, the font, `favicon.svg` and the repo's `assets/`. Every URL in the page is relative to it (`data.ts`: `data/<name>.json` and `SOUNDS_URL`), so the site works at any path. It builds from the samples only and refuses to run with `SAHNE_CONTENT` or `SAHNE_STORY_DOCS` set. `.github/workflows/pages.yml` deploys it to https://sahne.shab.boo after `ci` passes on `main`.

## The sections

**Home** (`#/`, `src/sections/home.ts`): the introduction for someone new. A scene plays on loop (the bench shore, golden hour to night, `src/shell/live.ts`), then what Sahne is, what it does (each with a link to its demo), the few lines that mount a stage, and the gallery's numbers (counted from the kit, the engine and the data).

**Docs** (`#/docs/<slug>`, `src/sections/docs.ts`). The repo's own markdown, rendered: `DOCS` in `data.mjs` lists each doc's slug, title, sidebar group and file, and `doc()` renders one with `marked` (`/data/docs/<slug>.json`). A link between two listed docs stays in the gallery, a link to any other repo file goes to GitHub, and the README's pictures are served from the repo's `assets/`. Headings carry GitHub's anchors; `?at=<anchor>` scrolls to one, and `?at=s12` to a numbered heading (`DESIGN.md §12`). A fenced block in the language `sahne` holding a script plays live (`live.ts`, with the test places, the content root's places, Nima and İsmail) and is plain JSON on GitHub. The guide's own pages are in `guide/` (`start.md`, the first scene). A new doc is a row of `DOCS`; `test/docs.test.ts` checks that every doc renders, that each link between docs lands on a heading, and that each `sahne` block is a script.

**For maintainers** (`#/dev`, `src/sections/dev.ts`): how much of the engine has a demo (`coverage.ts`), and the Changes (`changes.ts`).

**Set and props** (`#/kit/set`, `src/kit/`). Every generator of the set kit (`catalog.ts`: its family, piece or prop, its meta, and what its drawing does: glows, emits, moves, carries words, lights, is built in depth), filtered by family, kind, what it does, and whether a place uses it or a brief asks for it, or searched by id, words or the Turkish of its cards. Tiles are drawn by the stage: `shell/thumbs.ts` stages each piece alone on one hidden stage (`kit/solo.ts`), keeps the frame as an image in IndexedDB (keyed by the drawing's code and params; "re-bake" forgets them) and shows an SVG sketch (`piece-svg.ts`) until then, so a piece built in depth (`road`) looks as it does in a place. `#/kit/set/<id>` is the piece inspector: the piece live beside a 170 cm figure (a thing tagged `hung` on a wall at eye height; a piece built in depth seen as from a seat), its variants and seeds, a control for every param its meta declares (`p.<name>` in the URL), held in the figure's hand for a prop, the env bar, every look at three seeds, its words, the places that use it and what the briefs ask of it. A param its drawing reads but its meta doesn't declare is shown in red (the kit's `test/meta.test.ts` checks the variants).

**The rest of the kit** (`src/kit/`). `#/kit/people`: the catalogue (every part, face value, colour and pattern, drawn or planned, from `sahne-kit/catalogue/plan.json` and `curation.ts`, with its filters in the query; `group` picks its tab), the builder (`mountBuilder` with the host's switches) and the studio (the builder's live preview alone), as tabs (`tab`). `#/kit/gestures`: every gesture of the kit on a stand-in, with its needs, hands, loop and timing, every emotion and viseme as portraits, a line's mouth shapes in time, the hand shapes. `#/kit/sound`: every effect, take, surface, ambience loop and motif as a spectrogram over its waveform, recordings beside their synth fallback, grouped by kit id or by place (`by=place`, from `needs.json`). `#/kit/kerim`: Kerim flown over any place's marks, her moods and gestures on the live rig, her stills, and her art with her CSS (`sahne-kit/kerim.css`) on light and dark, as an app draws her. All of it is enumerated from the kit and the data: a new part, gesture, sound or place shows by itself.

**Cast** (`#/cast`, `src/sections/cast.ts`). The story cast's roster (`characters/*.json` of the content root, of every kind but `extra`, served as `/data/cast.json`) as cards in `order`: name in Turkish and Persian, role, colour, the raw avatar size against the 2 KB cap, and portraits at head, bust and full, with a tab per outfit look (`o.<id>` in the query) and a link to the studio (`#/kit/people?tab=studio&look=<id>` or `<id>.<outfit>`). `#/cast/extras` shows the generated extras (the documents there with `kind: "extra"`, `/data/extras.json`) the same way. The studio's looks are the roster's, then the extras, then any draft character the roster lacks.

**Places** (`#/places`, `src/places/`). The board: every place document of the content root, with the sites and places the briefs ask for when it has a `needs.json`, each with its status, `lintPlace`'s rules as chips and its wide shot (baked like the piece tiles), and the share built. `#/places/<id>` scouts one: the place live with the env bar and its states; its marks drawn over the stage (★ perch, ◌ air, » pace, ⇥ door, ▴ a spot up high, ● a place to stand; a tap walks the figure there or flies Kerim; a door mark tapped again where the figure stands is an exit through its door, and the next tap an entrance back in through it); explore, as a learner taps; the camera; and tabs for the standard item by item, what the briefs ask (each mark, prop, state, time and sound, there or missing), the pieces and props (each linking to the inspector) with the place's cost, and its checks. `#/places/<id>/sheet` is the contact sheet (every time at 1100 and 390 px) and `#/places/<id>/camera` the camera check (`place-check.ts`; the result in `window.cameraCheck`), which `shots.mjs --places [--camera]` photographs.

**Systems** (`#/systems`, `src/systems/`). One live demo per engine system, listed in `src/systems/registry.ts` with the DESIGN.md sections it shows and the engine vocabulary entries it `covers`: the cue lab (any cue kind and staging field, played, sought, paused, finished), the director (its plan drawn as a timeline), camera, light, particles, places (states, sites, a vehicle's clock), props (every `obj` operation), moves (and stairs, Kerim's flights, the seated passengers), the life of a place (flat motions, crowds), actors (gestures, emotions, the mouth, hands, reaching, the flip, costumes), avatar documents, portraits (the still backend and the context-lost fallback), bubbles and the narrator, tap to translate, the learner's acts, say it aloud (with a pretend microphone for every state and error), the sound engine, and performance (the stage's numbers, stress runs, the atlas window, the code budgets). Each stands on `src/systems/bench.ts`: a stage with a test place (`src/bench.ts`) whose buttons are cues, printed as the script would write them. A cue that reaches a place or a prop's look the loaded script never does must be in the script (an `extra` branch): `Stage.act` draws only what was loaded.

**Stories** (`#/stories`, `src/sections/stories.ts`). Every story serve.mjs finds (the bakkal test scene and each story of `stories/` in the content root, with its characters), and `#/stories/<id>` playing one through the adapter: the reply card with Söyle, a real choice, the "…" card, acts on stage, say it aloud where the browser can listen, tap-to-translate, the learner's name and translations, log mode (`setBubbles`: the lines only in the log), beside the adapter's cues and the story lints. What plays next and what the footer offers is `storyPlayer` from sahne-story, the logic Kumru's reader runs too; the view only draws it. `window.storyDemo` is what `shots.mjs --story`, `golden.mjs` and `thumbs.mjs` (the story pictures, written to `$SAHNE_CONTENT/thumbs/`: `node thumbs.mjs`, `--check` fails when one is missing or stale) drive.

## Keeping it whole

**Coverage.** `src/coverage.ts` lists the engine's vocabularies (every cue kind, staging field, camera, move, voice, prop operation, act, env verb, emitter, motion kind, time and weather); each must be in the `covers` of a system demo (`src/systems/registry.ts`), and the demos and views together must name every DESIGN.md section from §5 to §10. `test/coverage.test.ts` (in `pnpm sahne check`) holds the gallery to it; #/dev shows it.

**Changes.** What changed, for review, is `src/changes.ts`, shown on Home: per step, what to look at and links into the views.

How the gallery grows with Sahne, without editing it:
- **A new set piece or prop** needs its `meta` (`PieceDef.meta`, held by `sahne-kit/test/meta.test.ts`); it then shows in Set and props and has an inspector with its params as controls.
- **A new place document** shows on the Places board and can be scouted; **a new draft** plays in Stories; **a new part, gesture, sound or motif** shows in its kit view.
- **A new engine feature** adds its value to one of the engine's vocabularies (`CUE_KINDS`, `STAGING_FIELDS`, `ENV_VERBS` …, DESIGN.md §5.6): the coverage test fails until a system demo shows it and names it in its `covers`. A new system gets a demo file in `src/systems/` and a registry entry (the test checks they match).
- **A new test place** for a demo goes in `src/bench.ts`; it shows on the board under Test benches.

## Screenshots

The browser pane, hidden, pauses animation and draws nothing. `shots.mjs` photographs the gallery from a headless browser with the GPU on, while the gallery runs. A story, cue by cue:

```bash
node packages/sahne-gallery/shots.mjs --out <dir> --story s1e00 --cues 0,5,13 --mid --width 390 --height 667
```

Each cue gives `<story>-<cue>.png` at its end pose; `--mid` plays it from the cue before and adds frames at 15, 40 and 70 % of its length, where held props, gestures and flight go wrong. Console errors and warnings are printed at the end.

`--page` shoots any route as the window shows it; `--click` presses buttons by their label first (the first that matches), one more shot per press:

```bash
node packages/sahne-gallery/shots.mjs --out <dir> --page '#/systems/light' --click "night,dusk falls (16 s)" --wait 2500 --height 1400
```

`--places all` (or `--places bakkal,metro_m11`) photographs each place's contact sheet (`#/places/<id>/sheet`), one picture per time and width; with `--camera` it also runs each camera check, writes `camera.json` and exits 1 when a figure is out of frame:

```bash
node packages/sahne-gallery/shots.mjs --out <dir> --places all --camera
```

`kit-sheet.ts` draws one set family as a contact sheet without the gallery running (`node packages/sahne-gallery/kit-sheet.ts --family <name> --out <dir>`).

## Sizes

`size.mjs` measures the code budgets of `sahne/DESIGN.md` §12: each package bundled and minified on its own, then gzipped. `pnpm sahne check` runs it and fails over budget; `node size.mjs --json` gives the same as JSON. The budgets are in [`packages/README.md`](../README.md#checks); the gallery shows them in `#/systems/perf`.
