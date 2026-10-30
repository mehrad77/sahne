# sahne-story

A story format for the [Sahne](../sahne/README.md) stage: story documents (the format [Kumru](https://github.com/mehrad77/kumru) plays), the adapter that turns one into a Sahne script, the player, the lints and the story check. Story-specific, so it lives beside the engine, not in it. It depends on `sahne` and `sahne-tr`. The story format itself is described in the Kumru repo (`docs/stories/STORIES_SCHEMA.md`, `STORIES_STAGE.md`); the schemas are here, in `schema/`.

| Export | What it does |
|---|---|
| `adaptStory(story, options)` | A story document (`STORIES_SCHEMA.md`) becomes a Sahne script with its reply cards: the turns, what `Stage.load` needs (cast, with Kerim as the kit's bird puppet when her document has `puppet`, the characters' `terms`, the wardrobe its `looks` need, each place with the story's props that stand there, kept from place to place, the other branches' cues), `perform(picks)` and the default picks (`STORIES_STAGE.md` §3). Translations stay off the stage, in the cue info for the log and the card. Each cue's info names the story step it came from (`step`), and a choice's cues their `option`, and a reply its index in that option's `reply` list (`reply`), so an editor can map a cue back to its place in the document |
| `personalise` (an option of `adaptStory`) | The host's personalising (Kumru's `personalizeStr`): the name and hometown tokens become the learner's, in every text that reaches the stage (lines, link keys, sound words, prop labels, phone screens, an act's prompt, display names) |
| `storyPlayer(stage, adapted, hooks)` | The player's logic without a screen: what the footer offers (`busy`, `devam`, a `turn` card, `end`), `devam`, `say`, `choose(index)` (re-plans from its own cue), `act()` (its answer re-plans what follows), `restart`, `jump(i)` (an editor's scrubber: a cue with a card waits for it, any other plays), `replace(adapted)` (an edited adaptation of the same story, re-directed with the picks kept and no reload), `tick` for a hidden tab, and `run` (the cue playing, an act's with its `result`, for the host's act card). Kumru's reader and the gallery draw on it (`src/player.ts`, `test/player.test.ts`) |
| `flagsOf`, `warmthOf`, `albumBand`, `metIn`, `unlockedOf` | What the stories remember of a learner, derived from the picks the app keeps per story (`st[id].ch`) and never stored: flags (§4.7), warmth and Kerim's album (§4.8), the avatar unlock tokens (`src/memory.ts`) |
| `storyProps(story, place)` | The story's own props that stand in `place` (`at` a point or mark in the opening place, or a map of places), with `at` resolved and `keep` set (`STORIES_SCHEMA.md` §3) |
| `dressing(story, avatars, characters, ok)` | Who wears what, step by step (`src/looks.ts`, `STORIES_SCHEMA.md` §5.2): the cast's starting documents, the wardrobe, and the costume changes per step; the learner wears only a coat and a hat |
| `lintStory(story, options)` | Staging that contradicts the Turkish it stages (`STORIES_STAGE.md` §4): deixis, *var*/*yok*, numbers, the staging budget, phone lines, silent lines, clock times, links and `obj:` targets on stage, stand-in turns, mechanics, where story props stand, changes of clothes (`look`), and that every scene's place, marks, Kerim's perch, moves and time exist (`place`). With the characters, Kerim on stage stands on her perch, so `ch:kerim` has a place. A problem may carry a `fix` |
| `suggest(story, options)` | The fixes, plus the links a line could have |
| `lintPlace(place, {kit, cards, needs})` | A place document against the place standard (`src/lint-place.ts`): `valid`, `needs`, `depth`, `density`, `explore`, `crowd`, `reach`, `light`, `sound`, `budget` (5 KB of JSON, and every flat fits a layer of the atlas). A `placeholder` document only warns |
| The story check (`check/`, `stories.ts`; node only, not exported from `src/index.ts`) | Every story, character and place against the story docs: JSON schemas (`schema/*.json`, ajv), ids, calendar (`days.json`), `ref` and lesson units, cast, counts, flags, quiz, mistakes, unknown words, the known-word ratio and recycling (warnings for now), `lintStory` and `lintPlace`. See *The story check* below |
| `isCard`, `isA1`, `cardProblem` | The app's card index (`src/cards.ts`): which ids a `terms` entry may name (any live card) and which count as A1. `load.ts` builds the index in node from the content root's `cards/` and `cards-extra/` (read only) |
| `needsOf(needs, place)` | A place's entry in the content root's `needs.json`: what the stories' briefs ask of it, keyed by site (`src/needs.ts`) |

## Where the data lives

Every node reader (the story check, the place checker, the extras' generator, the tests, the kit's set build and tests, the gallery's server and scripts) finds the story data through `paths.ts`, never through a path of its own. The data is in a **content root**:

- the folder named by the env var `SAHNE_CONTENT` (an absolute path), for example Kumru's `data/`: `SAHNE_CONTENT=$PWD/data pnpm sahne dev`;
- without it, `samples/` in this package: the sample series, one short sample story (`s1e00`), its characters (Kerim, Nima, İsmail) with the generated extras, and two places (`bakkal`, `metro_m11`).

| In the content root | What | Needed |
|---|---|---|
| `stories/<id>.json` | the stories | yes |
| `characters/<id>.json` | the cast roster and the generic extras together, told apart by `kind` | yes |
| `places/<id>.json` | the place documents | yes |
| `series.json`, `seasons/s<n>.json` | the series and its seasons ([Series, seasons, episodes](#series-seasons-episodes)) | yes: without `series.json` the check gives one warning |
| `cards/`, `cards-extra/` | the word cards a story's `words` and a place's `terms` name; also the gallery's tap-to-translate | no: without them the card rules, unknown words and the known-word ratio do not run |
| `grammar/` | the grammar lessons a story's `lessons` name | no: without it lesson ids are not checked |
| `syllabus/a1.json` | what each unit teaches, for the known-word ratio | no |
| `days.json` | the release calendar, `{ "<story id>": { "date", "week", "kind" } }`, until the seasons carry it (`calendar`); while both exist, the seasons are the source and a `days.json` that differs is a warning to regenerate it | no: without either the calendar rules do not run, and a flag's story is dated by its own `releaseDate` |
| `needs.json` | what the stories' briefs ask of each place, keyed by site | no: without it the place lint's `needs` rule does not run |
| `kit/pieces/<id>.json`, `kit/variants/<of>.<name>.json` | the root's own kit items, drawn as data (`sahne-kit/DRAWING.md`): a set piece or prop `x_<id>`, and named param sets (`x_<name>`) on generators the kit has | no: without them the kit is the kit's own |
| `thumbs/` | the story pictures, written by `sahne-gallery/thumbs.mjs` | no |

Story docs are separate from the data. The optional env var `SAHNE_STORY_DOCS` (an absolute folder) holds `STORIES_WORLD.md`: the stories' sites, as the tables of its §2. The gallery's places board (`/data/world.json`) and `test/needs.test.ts` read it. Without it, the board leaves the sites out and that test skips. Nothing in Sahne reads `STORIES_A1.md`; the calendar is the seasons' `calendar`, or `days.json`.

### The contract, in short

| What | Where | Shape | Absent |
|---|---|---|---|
| `SAHNE_CONTENT` | env, an absolute folder | the content root below | `packages/sahne-story/samples/` |
| `SAHNE_STORY_DOCS` | env, an absolute folder | holds `STORIES_WORLD.md` | no sites on the board; the needs-vs-world test skips |
| stories, characters, places | `<root>/{stories,characters,places}/<id>.json` | `schema/story.json`, `character.json`, `place.json` | required |
| series, seasons | `<root>/series.json`, `<root>/seasons/s<n>.json` | `schema/series.json`, `season.json` | one warning; the series rules skip |
| cards | `<root>/cards/`, `<root>/cards-extra/` | `<id>.json` with the word in each language (`tr`, `en`, `fa`), `level`, `ref`, `retired` | `loadCards()` returns `null` (not `{}`); every card rule skips |
| grammar | `<root>/grammar/<id>.json` | with `ref`, `level` | lesson refs are not checked |
| syllabus | `<root>/syllabus/a1.json` | `{ words, lessons, units }` | the known-word ratio uses the cards alone, or skips |
| calendar | each season's `calendar`, else `<root>/days.json` | `{ "s1e01": { "date": "2026-09-07", "week": 1, "kind": "episode" } }` | the calendar rules skip; a flag's story is dated by its own `releaseDate` |
| needs | `<root>/needs.json` | `src/needs.ts` `Needs`, keyed by site | `loadNeeds()` returns `undefined`; the place lint's `needs` rule and `test/needs.test.ts` skip |
| kit items | `<root>/kit/pieces/<id>.json`, `<root>/kit/variants/<of>.<name>.json` | `schema/kit-piece.json`, `kit-variant.json`; ids `x_…` | `loadContentKit()` returns `{ docs: [], problems: [] }`; the kit is the kit's own |
| extras | written to `<root>/characters/` by `cast/extras.ts` | `kind: "extra"` | `--check` fails: run the generator |
| thumbs | written to `<root>/thumbs/` by `sahne-gallery/thumbs.mjs` | `<id>.webp` and `thumbs.json` | `--check` fails: run the script |

**The root's own kit items.** `loadContentKit({ kit })` (`load.ts`, Node) reads `kit/` through `paths.ts` (`KIT_PIECES`, `KIT_VARIANTS`, `kitPieceFile`, `kitVariantFile`, `kitPieceIds`, `kitVariantIds`): each file must be JSON, pass its schema, be named for what it holds and compile (`compileDrawing`), and with `kit` it must also add cleanly (`withDrawings`: its id free, a variant's generator and params there, a variant's values legal, and the kit's own `checkPiece` errors for a piece). A file that is not good is left out and named in `problems`, so one bad file never keeps the rest from the stage. An app adds them to its kit with one line after `loadSet`: `const kit = withDrawings(withSet(base, loaded), loadContentKit().docs)` (a browser app is served the docs, as backstage's `GET /api/kit` and the gallery's `/data/kit.json` do). Sahne's own stages do this: `stories.ts --check` and `places.ts` (a bad file is an error `kit`), backstage's stage, checks and place lints, and the gallery under `SAHNE_CONTENT`.

A missing optional file is never an error: each rule that needs it skips. The samples have no cards, grammar, syllabus, calendar or needs (their season has arcs but no calendar), and pass `stories.ts --check` with 0 errors and 0 warnings.

The JSON schemas stay in `schema/`. `kit-piece.json` and `kit-variant.json` hold the kit's pieces drawn as data (`sahne-kit/DRAWING.md`); `validateDoc("kit_piece" | "kit_variant", doc)` checks one, and `paramProblems` (exported here) checks a variant's params. Each file is named by its `id`. The gallery's two bundled JSON imports (`sahne-gallery/src/bakkal.ts`, `src/systems/places.ts`) are the only literal paths, and they read the samples.

## Series, seasons, episodes

A content root holds one **series**: its story world. `series.json` names it (`title`, an optional `summary`), its `languages` ([Languages](#languages)) and its `narrator` and `standin` (the stage casts `NARRATOR` and `STANDIN`, `src/types.ts`; another id is an error for now). A series has **seasons**, one `seasons/s<n>.json` each: `id` (`s<n>`, the file name), `n`, the titles and summaries, an optional `launch` date, the weeks' `arcs` by arc id (`s<n>wNN`) and the release `calendar` by story id (`{ date, kind, week }`, the shape of `days.json`). The **episodes** are the story documents: `s<n>eNN` is episode NN of season n (`seasonOf`), ordered by id; a story's `kind` says whether it is a weekday episode or a Saturday special. A series and its seasons have no level: a story's own `level` and `ref` are its own.

`checkSeries` (in `stories.ts --check`): each document against its schema and its file name; the narrator and stand-in have character documents of that kind; every story's season has a document; where a season has a calendar, a row for each of its stories and a story for each row (one not written yet is a warning); each story's `arc` equals its season's `arcs` entry; while `days.json` is still written beside the calendars, a difference is a warning: the seasons are the source, and `days.json` is regenerated from them. A story's own calendar rules read the season's row: its `releaseDate` and `kind`, and its arc id from the week (`arcId`). Types: `SeriesDoc`, `SeasonDoc`, `CalendarRow` (`src/types.ts`); paths: `SERIES`, `SEASONS`, `seasonFile`, `seasonIds` (`paths.ts`).

## Languages

A series names its languages in `series.json`: `"languages": { "main": "tr", "translations": ["en", "fa"] }`. The main language is the one the stage plays and the learner learns; the translations are what the host shows beside it (the card, the log, the glosses). A root without `languages` is Turkish with English and Persian (`DEFAULT_LANGUAGES`, `src/texts.ts`). A code is a 2–3 letter tag with optional subtags (`pt-BR`), and none may be a step's own key (`STEP_KEYS`: `to`, `do`, `at`, `on`, …), because a line holds its texts beside its staging.

**Where the texts live.**

| Text | Shape | In which languages (`check/languages.ts`) |
|---|---|---|
| a line, a choice option, a reply | flat beside the staging: `{ "who": "nima", "tr": "…", "en": "…", "fa": "…", "do": "wave" }` | every one |
| an arc (a story's, a season's `arcs`) | flat: `{ "tr": "…", "en": "…", "fa": "…", "mechanics": […] }` | every one |
| an act's prompt | flat: `{ "tr": "…" }` | the main one |
| a story's, series' or season's `title` | a map: `{ "tr": "…", "en": "…", "fa": "…" }` | every one (a series' summary is optional) |
| a story's `summary` | a map | the translations |
| a quiz item's `q` | a map (its `options` and `why` are the main language's) | every one |
| a gloss, `gl` | the main language's word → a map of its meaning: `"elma": { "fa": "سیب", "en": "apple" }` | the translations |
| a character's `name` | a map | the main one (others optional) |
| a character's `role`, `bio` | maps | the translations |
| a place's `name` | a map | every one (`lintPlace`) |

A missing text is a `schema` error. `textIn(t, lang)` and `textOf(t, …langs)` read a text, and `dirOf(lang)` gives its direction (`fa`, `ar`, `he`, `ur` … run right to left). `adaptStory` takes the series' `languages`: the main language's text reaches the stage, and each cue's `info.text` carries every language (with `tr` as the main language's, `en` and `fa` kept for the hosts that read them).

**The story language.** The lints and the check read the main language through a `StoryLang` (`src/lang.ts`): its words and pauses, whether one word is a form of another, the words that motivate each gesture, a number said aloud, its own lints, the check's dictionary forms, and the words a series may use that are no card. `langs/tr.ts` is Turkish, on `sahne-tr`: noun endings, the verb-form resolver (`langs/tr-words.ts`), the `deixis`, `var_yok`, `number` and `time` lints, and Kumru's series hints (the hometown token "Tahran", the stand-in naming no country or language, Kırlangıç glossed). `langFor(code)` gives a language's plugin (`LANGS`), else `plainLang(code)`: exact words and the lints that need no grammar. `lintStory`, `suggest` and `adaptStory` take a `lang` (Turkish, or the main language's, by default); the check uses the series' (`langOf`).

**The old shape.** Before series named their languages, the texts that are not a line's sat in suffixed fields: `title` (Turkish), `titleEn`, `titleFa`; `summary` (English, in practice), `summaryFa`; a character's `name`, `nameFa`, `role`, `roleFa`, `bio`, `bioFa`; a quiz item's `q`, `en`, `fa`; a gloss as `[fa, en]`. `upgrade(kind, doc)` (`src/upgrade.ts`) turns each into a map by a fixed table, in its field's place. Every loader reads through it (`check/world.ts`), so an old root still checks, with one warning naming its files; `convert/languages.ts` writes the new shape to disk, keeping each number's spelling, the key order and the final newline (`json.ts`):

```bash
node packages/sahne-story/convert/languages.ts           # $SAHNE_CONTENT (or the samples), in place
node packages/sahne-story/convert/languages.ts --check   # exits 1 while a file is in the old shape (in pnpm sahne check)
```

## Places

The place documents are read by the gallery, the stories and the tests from `places/` of the content root. The checker prints every place against the standard:

```bash
node packages/sahne-story/places.ts            # the table and the problems
node packages/sahne-story/places.ts --check    # exits 1 on any error
node packages/sahne-story/places.ts --file <path>.json        # a document elsewhere too
```

The story, character and place types are in `src/types.ts`.

## The cast

`characters/` of the content root is the one home of the characters' documents (`STORIES_SCHEMA.md` §5): `<id>.json`, one per character, the file named by its `id`. The roster is every document there whose `kind` is not `extra` (`loadCast` in `check/world.ts`), the extras the ones with `kind: "extra"` (`loadExtras`). A story has no copies: the story check and the gallery give each story Kerim, Nima and the characters its `cast` and `extras` name, read from there (`charactersOf` in `check/world.ts`). The gallery shows the roster at `#/cast` and the extras at `#/cast/extras`; the studio plays any of them (`#/kit/people?tab=studio&look=<id>` or `look=<id>.<outfit>`).

**The extras.** The silent people of the places (`clerk_goc`, `cayci_ortakoy`, `cayci_vapur`, `baker_firin`, `usta`, `librarian_ibb`, `librarian_bu`, `teacher_kindergarten`, `child_1`…`child_8`, `stallholder_1`, `stallholder_2`, `passerby_1`, `passenger_1`…`passenger_7`) are character documents with `kind: "extra"` in `characters/<id>.json` of the content root, beside the roster, so a story's `extras` find them like any character. `cast/extras.ts` writes them and nobody edits them by hand: `node packages/sahne-story/cast/extras.ts` writes them into `$SAHNE_CONTENT/characters` (or the samples), `--check` (in `pnpm sahne check` and Kumru's `pnpm check`) fails on a missing, stale or unknown extra. It only ever creates, rewrites or deletes a file whose document is `kind: "extra"`, and refuses to write an extra over a character of another kind with the same file name. Each is the builder's `randomize(seed)` with a frozen `offer` (the build, the skin, every face value, the hair styles and colours, the garments and fabric colours it may draw are listed in the script; no patterns), then the role's fixed fields set on top (an apron, a lanyard, a headscarf, glasses), and women and girls get no facial hair. The freeze holds against parts the kit gains; a change to a listed part, the kit's odds or the randomiser makes `--check` fail on purpose: regenerate and look at `#/cast/extras` again. Name and role are the role in Turkish and Persian, `color` one neutral grey, `level` A1, `order` from 101.

The check (`checkCast` in `check/rules.ts`) holds each roster document to its schema, its id to its file name and never a retired id (the old series' `ada can dede deniz ela marti mert selin simit zeynep`), its `order` unique; an avatar, and each outfit applied to it, within `AVATAR_MAX_BYTES` as written (before `normalize`, which trims to fit); composed with the kit, with no part refused, out of its slot, unfit for the build, replaced or dropped for size (hidden and clipped parts are normal); no value `normalize` would change or drop (a colour the palette lacks, a pattern the part does not take, an unknown face value); a `puppet` one the kit or Kerim's module provides. The extras get the same, and an `order` of 100 or more. `test/cast.test.ts` is the clipping check over the roster and the extras.

## The story check

```bash
node packages/sahne-story/stories.ts            # the table of stories × rules, the problems, the season report
node packages/sahne-story/stories.ts s1e00      # one story
node packages/sahne-story/stories.ts --check    # exits 1 on any error (warnings and info pass)
```

Errors: the characters (above), schema, ids, calendar (with `days.json`: release date, kind and arc against it; always: no Sunday, no break week, specials on Saturdays), `ref` and lessons and target words against the week's unit (a card above the story's level, or with no ref, never counts), cast limits (`CAST_ALLOW` holds s1e45's six), counts (target words, choices, spots), flags (each read flag set by the earlier story it names, once that story is written), quiz, `mistake.fix`, words that resolve to no card, gloss or name, missing places and characters, and every `lintStory` error. Warnings and info: line counts, the 95% known-word ratio (known = cards and syllabus words up to the week's unit, names, numbers and particles; glosses do not count), recycling forwards (the target words reappear in two of the next stories within 14 days, once those stories exist) and backwards, albums, the season's choice kinds. The rules that need the cards, the grammar, the syllabus or the calendar run only when the content root has them (see the table above). `pnpm sahne check` and Kumru's `pnpm check` run the check, and `test/drafts.test.ts` finds every story in `stories/` of the content root on its own.

## The sample story

`samples/stories/s1e00.json` is a short original story written for this repo, "Portakal var mı?": Nima rides the M11 home in the evening, then buys oranges at İsmail's bakkal (a tap act, a polite-or-blunt choice, a grammar spot on *var*/*yok*). Its characters are `kerim`, `nima` and `ismail` from `samples/characters/`, its places `metro_m11` and `bakkal` from `samples/places/`. The gallery plays it at `#/stories/s1e00`, and the golden frames (`sahne-gallery/golden.mjs`) shoot five of its cues. A sample has no cards, grammar, syllabus or calendar, so those rules are off for it.

## Tests

```bash
node --test test/*.test.ts   # here, or pnpm test
pnpm sahne check             # from the repo root: types, sizes and every Sahne package's tests
```

- `test/places.test.ts`: a place built to the standard passes `lintPlace`, each rule catches its own break, a placeholder only warns, the story's `place` rule, and every place document has no errors.
- `test/needs.test.ts`: the content root's `needs.json` (skipped without one) covers every story, uses live cards, and every prop names a kit generator and variant that is drawn or planned (`packages/sahne-kit/set/plan.json`).
- `test/schema.test.ts`, `test/drafts.test.ts`: the schemas accept every document of the content root and refuse a seeded break; every story passes the check with no errors.
- `test/extras.test.ts`: the extras' generator is deterministic, the extras' files are current, every extra passes the cast check, a broken one is caught, and the generator leaves the roster's files in the shared folder alone.
- `test/cast.test.ts`: every roster avatar, each outfit applied, and every extra, composed at rest: the stage's lone-figure framing (`figureBox` from `figureDims`) holds every head piece inside its top and sides at head and bust and every piece at full; the still (`renderSvg`) holds the hair and headwear inside its picture at head and bust (a failure there is hair or a hat beyond the still's clamp, 1.5 head heights up and 0.8 head widths out); and each raw document is within the 2 KB cap.
- `test/languages.test.ts`: the old shape upgraded by its table and in place, once; Turkish as the default story language and another language by plain words, with no Turkish lints; the converter on a copy of the samples (numbers, key order, newline, `--check`); a missing translation and a language code that is a step's key refused.
- `test/json.test.ts`: `json.ts`, the Node helpers that read and write a content file without changing what an edit did not touch (each number's spelling, the key order, the final newline, an atomic write). Backstage saves through them.
- `test/story.test.ts`, `test/places.test.ts`: the adapter and the lints on the bakkal test scene, written as a story (`test/fixtures/`, with a small card index of its own, `fixtures/cards.json`).
- Tests of Kumru's own stories (s1e01, the seeded breaks of each story-check rule on it, the card index) live in the Kumru repo, which runs them on its data.
