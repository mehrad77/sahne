# sahne-backstage

A local editor for a Sahne content root, in the browser. The people who review a story, who are often not programmers, play the episodes AI wrote, fix their words and staging, and save. A save writes the story files themselves and keeps everything else in them as it was. Each save passes the same story check as `pnpm check`. Backstage runs on the machine that holds the content. A web page from anywhere else cannot reach it, and it writes nothing unless it was started to write.

It edits what [sahne-story](../sahne-story/README.md) defines: the **series** of the content root, its **seasons**, and their **episodes** (the story documents). See [Series, seasons, episodes](../sahne-story/README.md#series-seasons-episodes).

## Running it

In this repo, on the samples (read-only):

```bash
node packages/sahne-backstage/server/cli.ts
```

Then open http://localhost:5181. The flags are:
- `--content <absolute folder>`: another content root. Without it, the server uses `$SAHNE_CONTENT`, or the samples.
- `--write`: allow saves.
- `--port <n>`

`preview_start sahne-backstage` (`.claude/launch.json`) starts it on the samples.

From an app (Kumru's `pnpm backstage`, `scripts/backstage.mjs`):

```js
import { startBackstage } from "sahne-backstage/server";
const b = await startBackstage({ content: new URL("../data/", import.meta.url).pathname, write: true });
console.log(b.url);
```

`startBackstage({ content?, port?, write?, log? })` resolves to `{ url, port, close() }`.
- **One content root per process.** sahne-story's `paths.ts` reads `SAHNE_CONTENT` once, so a second call with another root throws.
- **Its own port.** Backstage is a separate page on its own port (default 5181), not part of the app's dev server. An app's watcher reloads its own page when a content file changes, and that reload must not wipe the editor.

## The pages

| Route | What |
|---|---|
| `#/` | The series: its titles and summary, its narrator and stand-in, its seasons |
| `#/season/<id>` | A season: its episodes in order, each with its title, kind, release date, week, place, and draft or not |
| `#/episode/<id>` | An episode, described below |
| `#/review` | Where every episode stands: status, steps reviewed, Persian checked, errors, warnings, the known-word ratio (when the root has cards), open comments; *Export the notes* downloads them as markdown |

**The episode page:**
- **The stage.** The whole kit, Kerim, the animals, the sounds, and Kerim's round window for the narrator.
- **Transport.**
  - The opening scene, the cue before, and *Devam*.
  - A slider over every cue (`storyPlayer.jump`), and a slider through the cue that is playing (`Run.seek`). Held props and gestures go wrong mid-cue, so look there.
  - The learner's card: *Söyle*, a choice's options (each picks its branch), or an act on stage.
- **Flags.** One switch for each flag the episode's callbacks read (`if`, `unless`). A switch adapts the story again and reloads the stage.
- **Steps.** Every step, with a choice's options and their replies indented under it. Clicking a row selects it and plays it. A row whose option is not picked picks that option. A changed row is marked, and so is a row with problems.
- **The inspector.**
  - For a line, a choice option or a reply: who speaks, the words in Turkish, English and Persian (Persian edits right to left), Kerim's narration, and a note for the learner.
  - For a spot: its lesson, example and words.
  - For a choice: its id, kind and whom it is said to.
  - With nothing selected: the episode's titles, summary, quiz and glosses.
- **Staging** (`src/ui/staging.ts`), under the words of a line, an option, a reply or a beat.
  - The fields come in the order the stories use them most: feeling (`emo`), gesture (`do`), said to (`to`), looking or pointing at (`at`), then camera, voice, tempo and count.
  - Then the props (`obj`), moves (`move`), others' reactions (`react`), words that point at things (`link`) and sounds (`sfx`).
  - The rest sits under *More*: `env`, `via`, `on`, `wait`, `frame` and `looks`.
  - Each field picks from what is valid there:
    - the kit's emotions, gestures and sounds;
    - the engine's cameras, moves, prop ops and voices (`CAM_KINDS`, `MOVE_HOWS`, `OBJ_OPS`, `VOICES`);
    - the marks and props of the place the step plays in;
    - the cast.
  - A scene has its own form: the place, time, weather, the place's states, who stands on which mark, and Kerim's perch.
  - Every step also has a raw JSON drawer for what the forms do not cover. The story check judges it like any other edit.
- **Step tools.**
  - Move a step up or down, duplicate it or delete it.
  - Add a line, a stand-in line, Kerim's narration, a beat, a scene, a spot or a choice after the selected step.
  - On an option: add an option (at most 3) or a reply.
- **On the stage** (`src/ui/pick.ts`).
  - *Show the marks* pins the place's marks over the stage, placed through its camera every frame.
  - *A click sets* turns a click into staging for the selected step: a person or prop it looks or points at (`at`), the person it is said to (`to`), or the mark its speaker moves to (`move`).
  - People and props come from the interaction layer's `inspect`; marks come from the pins.
  - Shot buttons set the step's `cam`.
- **Problems.**
  - The stage lints (`lintStory`, `suggest`) run in the browser as you type.
  - The full story check runs on the server a moment later. A problem the edit brought is marked **new**.
- **Review** (a tab beside *Edit*).
  - Where the episode stands: an AI draft, reviewed or approved, and whether AI wrote it.
  - For the selected step: reviewed, and its Persian checked.
  - Comments on the episode or on a step, each marked done when it is dealt with.
  - The reviewer's name is kept in this browser only.
- **Changes since the last commit** (a tab).
  - The episode's fields and each changed step against git's HEAD, with the words diffed word by word.
  - *Put back as committed* restores one step. A person commits; backstage never does.
- **Undo, redo, revert and save.** Typing into one field is one undo step. Save is refused when the edit brings an error. Problems the file already had do not block it.

**Live preview.**
- An edit that changes only words (`src/model/steps.ts` `wordsOnly`) re-directs the cues: `storyPlayer.replace`, with no reload.
- Any other edit adapts the story again and loads the stage.
- Either way, the stage returns to the cue that was showing.
- A sign's or a phone's text is drawn into the art, so editing it needs a load. A load happens anyway, because that text is not one of the word keys.

## How saving works (`server/save.ts`, `server/content.ts`)

**A save sends a set of documents, checked and written together.** A season's calendar and its stories' dates, for example, go in one save.

**What a save keeps from the file:**
- Each number as it was written: `1.0` stays `1.0`, because the file is parsed with a `JSON.rawJSON` reviver.
- Each file's own key order.
- Whether the file ends in a newline.
- UTF-8 text as it is, with no `\u` escapes.

**How a file is written.** To a temp file beside it, named `<id>.json.tmp-<pid>` (so no reader lists it), then renamed over it.

**Refused with 400:**
- A document whose `id` is not its file's id. Ids are permanent.
- A new id that exists already, or a retired character id.
- An id of the wrong pattern.
- An edit of an extra. Extras are generated by `sahne-story/cast/extras.ts`.

**Refused with 409:** a file that changed on disk since it was opened. Reload it.

**Refused with 422: an edit that brings an error.**
- The edited documents are swapped into the world the story check reads (`check/world.ts`).
- They are checked with the gate's own options: the full kit, each place's solids, the cards and the needs.
- Stories get `checkStory` and `checkSeason`, characters `checkCast`, and places `checkPlaces` and `lintPlace`. A series or season edit gets `checkSeries`.
- The same checks run on the files as they are, and a problem in both is not new.

**Refused with 403 when read-only.** That is the default, and on the samples a save needs `--write`.

**Thumbnails.** A thumbnail goes stale only when the opening picture changes: the opening scene, place, props, cast or looks (`sahne-gallery/thumbs.mjs`). A fix to a line's words leaves it as it was. `GET /api/thumbs` lists the stale ones, with the command that shoots them.

## Review notes (`server/review.ts`)

Review state is editors' notes, so it is not part of a story: a story's root takes no extra keys. It lives in a sidecar beside the content, `<root>/.backstage/review.json`, at sahne-story's `paths.ts` `REVIEW`.

```json
{ "v": 1, "episodes": { "s1e01": { "status": "reviewed", "ai": true, "reviewer": "…",
  "steps": { "4": { "reviewed": true, "persian": true }, "12.0.1": { "reviewed": true } },
  "comments": [{ "id": "…", "at": "4", "by": "…", "text": "…", "date": "2026-10-29 10:00", "done": true }] } } }
```

- **Status** is `draft`, `reviewed` or `approved`.
- **A step key** is the step's number, then the option's, then the reply's (`12.0.1`).
- **The notes are saved at once.** They are written apart from the story's Save, and only when backstage runs with `--write`.
- **What is never in them:** card or lesson text. No app and no check reads the sidecar.
- **Commit it or not.** An app may commit the sidecar, so the review is shared, or git-ignore it.

## The API (`server/http.ts`)

Every request must come from this machine: `Host` and `Origin` must be localhost, and a write must be `application/json`.

| Request | Answer |
|---|---|
| `GET /api/world` | `{ series, seasons, episodes, characters, places, days, cards, samples, writable }` |
| `GET /api/doc/<kind>/<id>` | `{ doc, mtime }`. The kind is `series` (id `series`), `season`, `story`, `character` or `place` |
| `POST /api/check` `{ edits }` | `{ problems }`. An edit is `{ kind, id, doc, mtime?, create? }`, and each problem names its `doc` and whether it is `new` |
| `POST /api/save` `{ edits }` | 200 `{ saved: { "<kind>:<id>": mtime }, problems }`, or 400, 403, 409 or 422 `{ message, problems? }` |
| `GET /api/head/<kind>/<id>` | `{ doc }`: the document at git's HEAD, or null |
| `GET /api/thumbs` | `{ stale, command }` |
| `GET /api/problems` | `{ problems }`: every problem of the content root, as `stories.ts --check` finds them (the review page) |
| `GET /api/review`, `POST /api/review` `{ id, review }` | The review notes; a POST replaces one episode's (cleaned: unknown keys dropped) and answers all of them |
| `POST /api/reload` | The server forgets the world it has read (after a change made elsewhere) |

## Layout

- **`server/`** is Node only, so `packages/tsconfig.json`, which has `"types": []`, does not type-check it. It contains:
  - `index.ts` (`startBackstage`) and `cli.ts`;
  - `http.ts` (routes, guards, the esbuild bundle in `dist/app/` (git-ignored, rebuilt on change), the font and the sounds);
  - `content.ts` (kinds, files, checks, saves);
  - `save.ts`;
  - `git.ts`;
  - `review.ts`.
- The server reads sahne-story's Node-only files (`paths.ts`, `check/`, `load.ts`) by path. The package exports only `"."`.
- **`src/`** is the browser side, built with Preact and htm tagged templates (no JSX, so the source stays erasable TypeScript). It contains:
  - `index.ts`;
  - `store.ts` (signals: the world, the route, each open document's draft, the server's problems);
  - `api.ts`;
  - `stage.ts` (`Preview`: the stage and a story player that follow the document);
  - `model/` (paths into a document, undo and redo, the step list; pure and tested in Node);
  - `ui/` (the pages: `app`, `home`, `season`, `episode`, `inspector`, `staging`, `pick`, `review`, `changes`, `fields`).
- **`index.html`** is the page.
- **`test/`**: `node --test` covers the save round trip, the model, and the server on a temp copy of the samples. `pnpm check` runs it.

The package exports `"."` → `src/index.ts`, like every package, and also `"./server"` → `server/index.ts`. The server is the one Node-only entry. Backstage never ships to learners, so it has no `size.mjs` budget and no `determinism.mjs` entry.
