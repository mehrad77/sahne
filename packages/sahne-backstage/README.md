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

## The studio

The page is a studio: a top bar, a rail on the left, and the page.
- **The top bar.** The series, a tab per season (`S1`, `S2`), the search box, whether everything is saved (or why nothing can be: read-only, the samples, a root in the old language shape), and the theme (as the system is, light or dark, kept in this browser).
- **Search and commands** (`⌘ K`, or Ctrl K, or the search box): type a few letters of an episode, a season, a character, an extra or a place to go there, or of a command (a new episode in a season, the theme). Words match anywhere in a name or its keywords, accents ignored (`src/model/search.ts`).
- **The rail:** the board, the cast, the places, the kit, review; at its foot the agents (with how many proposals wait), the guides and settings.
- **The side panel** (`src/ui/side.ts`), beside any page: ✦ in the top bar opens it on the assistant, ? on the guide's part about the page you are on. Its tabs:
  - **Assistant**: the conversation (below).
  - **Agents**: the proposals waiting, with *Open*, *Accept* and *Reject*; how agents' edits land; the command that connects Claude Code; and the latest tool calls.
  - **Docs**: the part of the guides about this page (beside an episode, the episode studio's, with its keys), and a search over both guides.
- **Agents** (`#/agents`, `src/ui/agents.ts`): how to connect an agent (the `claude mcp add` command over HTTP, the one that starts its own backstage on stdio with `--backstage` here, and the `mcpServers` entry other clients read, each to copy), how their edits land (switched here, below), who is connected over HTTP (the client's name, since when, how many calls), every proposal waiting across the documents, what agents did lately (each tool call: who, which, whether it worked, how long, its answer's first line; the assistant's too), and the tools, read and edit, with what each does.
- **The guides** (`#/docs/<guide>[/<anchor>]`, `src/ui/docs.ts`): this README and the story format's (sahne-story's), as they are in the checkout, drawn by `src/model/markdown.ts`. The contents list the headings and the parts this README names in bold; a link to the other guide stays in backstage, a link to any other file opens it on GitHub.
- **Languages.** Every text is edited in the series' languages (`series.json` `languages`, sahne-story's Languages section): the main language as the large field, each translation a smaller row under it with its code, in its own direction (Persian, Arabic, Hebrew, Urdu right to left), and a dot where a translation is missing (`src/ui/lang.ts`, `<Texts>`).
- **Read-only** (backstage started without `--write`, the samples, or a root in the old shape): edits still work, but every page's Save is a *Read-only* button. It and the top bar's state open a dialog with why and the command that starts backstage so it saves (`src/ui/readonly.ts`). Writing is a start flag, not a switch on the page, so no other page in the browser can turn it on.
- **A root in the old language shape** opens read-only, with a banner naming the converter: a root is converted whole, never a file at a time.

## The kit as galleries

Everything a scene is made of is picked from a gallery of pictures, not a list of ids (`src/ui/kit/gallery.ts`, the items in `src/ui/galleries.ts`):
- **Characters** as portraits (`portrait`), the extras on their own tab.
- **Places** as their wide shot.
- **Props and set pieces** as sketches (`pieceSvg`, `sahne-kit/set-svg`).
- **Emotions** as the stand-in's face close up at the end of the emotion, **gestures** as the stand-in caught at the gesture's stroke. Both are frames of the scene the kit page's hover preview plays, so the preview keeps the picture's frame and zoom.
- **Sounds** as their waveform (the patch, drawn when idle) with their word. A click plays one through an `AudioEngine`: the recording where there is one, else the patch. A click on a playing loop stops it.

A gallery has a search box and filters by tag; a picker is a gallery in a popover. A card's picture is asked for only as the card nears the screen. The pictures the stage draws (a place's wide shot, a gesture, a step for the storyboard) come from one hidden stage, one at a time, and are kept in the browser's IndexedDB under a key that changes with what they show, so each is drawn once (`src/thumbs.ts`).

**The kit page** (`#/kit/<section>/<shelf>`, `src/ui/kitpage.ts`) lays the kit out as a library:
- **The side.** It lists the sections (props, set pieces, gestures, emotions, sounds) with their icons and counts. The side folds sideways to its icons, and remembers whether it is folded. On a small screen, the sections become a row across the top with the shelves as chips under it, the tags go on one line that scrolls, and the details open as a sheet from the bottom. The open section is split into shelves (`src/model/kitgroups.ts`). Each shelf gathers several of the kit's tags, and an item goes on the first shelf one of its tags belongs to, else on *Other*. Gestures are shelved by what they need, sounds by their bus. A test fails when a prop or set-piece tag is on no shelf.
- **The bar.** It has a search of the section, the shelf's commonest tags as filters, and the card size (S, M or L, remembered).
- **The cards.** With no shelf and no search, each shelf shows its first row and *See all*. Otherwise the cards come in pages as the list scrolls.
- **Details.** A click opens a card's details: its id to copy, what it is, its tags, other names and parameters with their defaults. A sound also plays, with a playhead over its waveform and the time into it. A loop's playhead goes round from where the engine started it. The waveform is the recording where one loads, so it matches what plays.
- **Hover.** A gesture or an emotion plays on the stand-in while the pointer rests on its card. One shared stage is laid over the card (`src/live.ts`). With reduced motion, the pictures stay still.

## The pages

| Route | What |
|---|---|
| `#/` | The home: the series' name, the scene last worked on framed as a paper theatre's stage, *Continue* back into it, the board, and the cast, places, kit and guides. The episode page keeps the episode, the cue on its stage and a picture of that stage in this browser (`src/recent.ts`). Before any, the home shows the next episode's place. *Continue* opens the curtains and grows the scene to fill the page. The episode then opens under it at that cue. With reduced motion, it simply opens. A root with no series or no episode asks for the first |
| `#/board`, `#/season/<id>` | The board of a season (the first, or the one named), described below |
| `#/new/<season>[/<date>]` | A new episode (on that day), described below |
| `#/episode/<id>` | An episode, described below |
| `#/kit/<section>/<shelf>` | The kit as a library: props, set pieces, gestures, emotions, sounds, by shelf |
| `#/cast` | Everyone of the series as a portrait, the extras on their own tab. *New character* starts one with a new id: ids are permanent, and a retired one is refused |
| `#/character/<id>` | A character, described below |
| `#/places` | Every place as its wide shot, with how many episodes it opens; *New place* starts one |
| `#/place/<id>` | A place, described below |
| `#/review` | Where every episode stands: status, blocks reviewed, each translation checked, errors, warnings, the known-word ratio (when the root has cards), open comments; *Export the notes* downloads them as markdown |

**The board** (`src/ui/board.ts`, its dates in `src/model/board.ts`):
- A season's weeks are rows and Monday to Saturday the columns: an episode on a weekday, a special on Saturday, no Sunday. The rows run from the season's launch week (or its first episode's) to its last episode's, and one more to plan into. A row's week is the one its episodes' calendar rows (or arcs) name; an empty row between two weeks is a break.
- **Each episode is a card on its release day:** its place's picture, its title in the main language, a special or not, a draft or not, its review status (an edge: to review, reviewed, approved) and its errors and warnings. A click opens it.
- **Dragging a card to another day moves its release:** the season's calendar row and the story's own date and kind change together (a season with no calendar starts one from every episode's date), and to another week the episode takes that week's theme (a week with none takes the episode's). The changes wait in a save bar; a save the check refuses lists the new errors there (a story's `ref` belongs to its week's unit, for one).
- **An empty day** starts a new episode on it (`#/new/<season>/<date>`).
- **Reading it:** a day shows its number, with the month where one begins; a week its span (`14–19 Sept`). Today has a red edge, and past days are quieter. A week with no episode yet is a low row. Saturday's column is marked special. The title is in the main language, with the first translation under it. On a phone (under 720 px) the board is an agenda: each week a block, its days a list with the weekday, an episode a wide card.
- **Each row starts with its week's theme** (its arc), edited in place in the main language; its menu edits it in every language and what the learner does that week (`mechanics`). A theme is written in the season and in every story of the week, saved together.
- Episodes with no date wait under the board, to be dragged onto a day.
- *Season settings* and *Series settings* open in a modal over the board (`Modal`, a `<dialog>`: Escape or a click outside closes it): titles and summaries in every language, the series' languages, narrator and stand-in, the season's launch day. On a root with no `series.json`, the board starts one.

**The episode studio** (`src/ui/studio/`): the script on the left, the stage on the right.
- **The head:** the title and premise in the series' languages, who is in it (the cast and extras as portraits, each with how many lines they speak; *+ someone* adds from a picker; the story check refuses a speaker not in the cast), and what it teaches.
- **The script** (`script.ts`, its operations in `src/model/script.ts`): one block per step, typed into like a screenplay.
  - A **scene** heading: the place (a click picks another from its picture), the time of day, and where each of the cast starts.
  - A **line**: the speaker in capitals (a click, or `@` in an empty line, picks another), the words in the main language, the translations as smaller rows under it (a dot where one is missing), and the staging as chips; × on a chip clears it. The narrator's lines to the viewer say so.
  - An **action**: who does what, with no words (a beat).
  - The learner's **choice**: what it is about and whom it is said to, its options indented under it (each with ✓ for the fitting answer and a tone) and their replies under them.
  - A **grammar spot** (its lesson and the line it points at, the narrator's words in the translations) and an **act** (how the learner acts, on what, and the prompt).
  - **The keys:**

    | Key | What |
    |---|---|
    | Enter | a new line after this one, said by the one before last (a conversation alternates) |
    | Tab | an empty line becomes an action, an action a line |
    | `@` in an empty line | pick the speaker |
    | `/` in an empty line | insert a block: line, action, narration, scene, choice, spot, act |
    | `(` | type how it is said: `(waves, happy, to İsmail)` |
    | Backspace in an empty line | delete it |
    | ⌘↑ ⌘↓ | move it |
    | ⌘D | duplicate it |
    | ⌘Z, ⇧⌘Z | undo, redo |
    | ⌘S | save |
    | ↑ ↓ at the start or end of the words | the block before or after |

  - **A parenthetical** (`src/model/parenthetical.ts`) is read phrase by phrase: a gesture of the kit (`waves`, `points at the apple`), a feeling (`happy`, `angry`), whom it is said to (`to İsmail`), where it points (`at the door`), a walk (`walks to counter`), a voice (`whispers`) or a shot (`close`). What it does not understand is named, never written.
  - Focusing a block selects it and the stage plays that moment; an option not picked is picked. The block playing is marked, and so are a changed block and one with problems.
- **After the script:** the quiz (each question in every language, three options in the main language, the right one, the line its answer quotes) and the glosses (a word the cards do not have, its meaning in each translation).
- **The storyboard strip** over the stage (`strip.ts`): a picture of each beat of the episode as it plays now (each scene, line, reply, action and act, at its end), drawn once and kept, keyed by everything up to it so an edit late in the episode keeps the pictures before it. A click goes there in the script and on the stage; the one playing is marked, and a choice shows as a fork.
- **The stage:** the whole kit, the narrator's round window, the transport (the opening, back, *Next*, a scrubber over every cue and one through the cue playing: held props and gestures go wrong mid-cue, so look there), the learner's card (say, a choice's options, an act), and one switch for each flag the episode's callbacks read.
- **Staging fills itself in, and can be overridden** (`src/model/autostage.ts`). A block's chips are of three kinds:
  - **set** (solid): written in the story; × clears it back to the director's choice.
  - **ghost** (dotted): what the director does by itself and never writes: whom a line is said to and the shot it gets, read from the stage's own performance of each cue, so it is exactly what plays.
  - **suggested** (dashed): what the rules would add: the lints' fixes (a deixis gesture at the thing named, a prop shown or hidden, a count, a link from a word to a prop on stage), a gesture the words motivate (the story language's `motive` words: *merhaba* suggests a wave), a feeling the punctuation does (a question, an exclamation). A click takes one, ⌥ Enter every one of the block, *n suggested stagings…* in the toolbar opens them all for review first (`studio/suggestions.ts`): each under its line, in plain words (a gesture, a feeling, who it is said to), why the rules suggest it, and what it replaces where the line has staging of that kind already; the ticked ones are added as one edit, and undo takes them back.
- **Directing on the stage** (`direct.ts`). With *Direct* on, a click on a person opens a menu of gestures (each a picture of it), feelings (each a face), what they look at, where they walk, and *says it to them*; on a prop: point at it, hold it up, touch it, show it, hide it, give it. What the speaker does goes on the block; what someone else does goes on it as their reaction (`react`). A click on a mark's pin walks the speaker there, and dragging a person onto a pin walks them. The shot bar sets the block's camera (*auto* leaves it to the director).
- **Details** opens the selected block's full staging in a drawer (`details.ts`, the forms in `src/ui/staging.ts`): every field with a picker of what is valid there (the kit's emotions, gestures and sounds; the engine's cameras, moves, prop ops and voices; the place's marks and props; the cast), a scene's time, weather and states, a line's note for the learner, the flags that gate it, and the step as JSON.
- **Notes, review and changes** are tabs under the stage.
  - **Notes** (`notes.ts`, `src/model/notes.ts`): every problem as a stage manager's note in plain words ("İsmail speaks but isn't in the cast", "The line has no Persian yet"), the ones the last edit brought first, each with *Go* to its block and, where one is obvious, a fix (*Add İsmail*, *Stage it*, *Gloss them*); for the whole episode or only the selected block. The stage lints (`lintStory`, in the series' story language) run as you type, the full story check a moment later on the server. A block with problems has a dot in its gutter.
  - **Review** is in the script itself: ✓ in a block's gutter marks it reviewed, ✓ beside a translation marks that language checked, 💬 opens its comments. The Review tab holds the episode's status (to review, reviewed, approved), whether AI wrote it, how much is reviewed and checked per language, and the comments on the episode or the selected block.
  - **Changes**: each changed step against git's HEAD, with *Put back as committed*. A person commits; backstage never does.
- **Undo, redo, revert and save.** Typing into one field is one undo step. Save is refused when the edit brings an error; problems the file already had do not block it.

**A character's page** (`src/ui/cast.ts`).
- Their look, in Sahne's builder in `author` mode: every part, the cast's own included. The size of the look is shown against `AVATAR_MAX_BYTES`.
- Their outfits, each previewed on them (`applyLook`) and edited as a look (clothes only).
- Name, role and bio in the series' languages, colour, order, level, voice.
- How they address each of the others (`sen` or `siz`), and the places they belong to.
- The whole document as JSON, for the album and the rest.
- Saving runs the cast check.
- An extra is shown, never edited. Extras are written by `sahne-story/cast/extras.ts`.

**A place's page** (`src/ui/places.ts`, its parts in `src/ui/place/`, its pure model in `src/model/place.ts`). Two tabs: *Stage*, where the place is edited by looking at it, and *Source*, every field as it is stored.
- **The stage** (`place/stage.ts`) shows the place at the time and in the states picked under it.
  - A click selects the piece or prop under it, with its outline, using the interaction layer's hit test. The stage draws a copy whose unnamed pieces are named `@<index>`, with their seeds pinned, so each hit names its piece (`shownDoc`).
  - A drag moves the selection across at its own depth. Only a thing on the floor drags in depth too, because the stage's camera is low and a few pixels up or down are a metre. The plan and the arrow keys set the depth of a raised thing.
  - Each mark is a spike pin with its facing arrow, and the perch has a dove. Drag a pin to move its mark.
  - Keys: Esc lets go, Delete removes, the arrows nudge by 5 cm (Shift: 25 cm), ⌘D copies and ⌘Z undoes.
- **Under it** (`place/mood.ts`):
  - The times it is seen at. A click shows one, × drops it, + adds one.
  - Its states as switches, one per group at a time.
  - Its ambience as a sound board: a chip turns a sound on, ▶ plays it.
- **The ground plan** (`place/plan.ts`) is the place from above, with across as x and depth as z toward the audience.
  - Pieces are boxes; the floor, the walls and the street are lines. Props are dots, and marks are crosses with their facing.
  - The wide shot is a red bracket at the depth it fits. What stands behind the room is drawn on a strip at the top.
  - Drag anything to move it in x and z.
- **The inspector** (`place/inspector.ts`) shows what is selected, in plain words.
  - **Nothing selected:** the place, with its name in each of the series' languages (the main one first; `lintPlace` and the server's check ask for those, not Turkish, English and Persian), size, Kerim's perch, the floor's sound and what the wide shot spans.
  - **A piece:** its sketch and look (variant), a control for each param its generator declares (`PieceDef.meta`), the states it is in, and its id.
  - **A prop:**
    - what it sits on: a mark, or free;
    - its height, from the heights things sit at in this place, each named after its piece (`0.9 · counter`, `heights`);
    - how many, whether it shows, and its JSON.
  - **A mark:** its facing as six buttons, a seat and its height, in the air, the perch, and its states. A mark not yet saved can be renamed; a saved one keeps its id.
- **Adding.** *+ Add* opens the catalogue (`place/catalogue.ts`): the kit's props and set pieces as sketches, and a new mark.
  - A pick, then a click on the stage or the plan, puts it there.
  - A prop dropped on a piece sits where it was hit, at the height things usually sit at on that kind of piece (`heightOn`). Dropped on a prop, it sits beside that prop.
- A piece's art comes from its seed: its `seed`, else the site with its `id`, else the site with its kit and position (`pieceSeed`). Naming an unnamed piece, or moving or copying one, would change its art, so the editor pins the seed it had first.
- **Checks.**
  - The 5 KB budget (`MAX_BYTES`) as a bar, and each of `PLACE_RULES` as ✓, ! or ✗, with `lintPlace`'s problems.
  - Saving runs the place check. The gallery's camera check (`#/places/<id>`) stays in the gallery.
- *New place* starts from an empty room or a copy of another place.

**A new episode** (`src/ui/new.ts`, `src/model/skeleton.ts`), from an empty day on the board or *New episode*:
- **Three picks:** where (a place from its picture, and the time of day), who (the cast from their portraits; the stand-in is always in, the narrator narrates), and what it teaches (the target words, searched live through `GET /api/cards?q=`, their text never stored; on a root without cards, ids typed in; and one to three lessons, `GET /api/lessons`). Then a title (the main language's at least) and a line of premise in the translations, which the narrator opens with.
- **The rest comes from the day:** the id (the season's next free one), the kind (a Saturday is a special), the week and its theme (a week with none gets one to write). The day can be changed at the top.
- **Or from an episode:** another episode's place, cast, structure and staging, with every text cleared to `…` (`duplicate`), and the flags it sets renamed for the new story.
- `skeleton` writes a draft the check can read (a scene with the cast on floor marks, the narrator's opening, a few lines, a choice, a spot, three quiz items), every text a placeholder in each of the series' languages (a Turkish series gets a few real words to start from), marked `draft: true`. It opens in the script, and is saved with its calendar row (and a new week's theme) once the check finds no error: it will want the target words by then.

**Live preview.**
- An edit that changes only words (`src/model/steps.ts` `wordsOnly`) re-directs the cues: `storyPlayer.replace`, with no reload.
- Any other edit adapts the story again and loads the stage.
- Either way, the stage returns to the cue that was showing.
- A sign's or a phone's text is drawn into the art, so editing it needs a load. A load happens anyway, because that text is not one of the word keys.

## How saving works (`server/content.ts`, with `sahne-story/json.ts`)

**A save sends a set of documents, checked and written together.** A season's calendar and its stories' dates, for example, go in one save.

**What a save keeps from the file:**
- Each number as it was written: `1.0` stays `1.0`, because the file is parsed with a `JSON.rawJSON` reviver.
- Each file's own key order. A file whose keys are all sorted stays sorted. Otherwise each object keeps its keys' order and a new key goes last, so the builder or a form writing an object in its own order changes only what changed.
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
- The rules across documents run over every document, not only the edited ones: the season's dates and arcs, and the cast's order. An edit that breaks another document is caught (two episodes on one date).
- The same checks run on the files as they are, and a problem in both is not new.

**Refused with 403 when read-only.** That is the default, and on the samples a save needs `--write`.

**Thumbnails.** A thumbnail goes stale only when the opening picture changes: the opening scene, place, props, cast or looks (`sahne-gallery/thumbs.mjs`). A fix to a line's words leaves it as it was. `GET /api/thumbs` lists the stale ones, with the command that shoots them.

## The assistant in the editor (`src/ui/assistant.ts`, `src/ui/settings.ts`)

- **A drawer beside any page** (✦ in the top bar, or *Open the assistant* in the palette): a conversation whose context is what is open (the page, the episode, the selected block, from `POST /api/selection`). Its answer streams in, with each tool it uses and what came of it. Its edits arrive as proposals above the script (or are written, in direct mode), never as hidden changes. *New conversation* starts again.
- **Asks where you work** (*Ask* in the episode's toolbar): fill the missing translations, simplify this line, suggest staging for this line, propose choice options, check this scene, draft this episode from its brief, and *Second reader*, which reviews in a fresh conversation that never saw the drafting.
- **A big ask waits for a yes:** the server says what it would cost (`confirm`), and *Go ahead* sends it again.
- **The meter** in the top bar is today's spending against the day's cap (its title: the month's, and the tokens); it follows the `usage` events.
- **Settings** (`#/settings`): Claude (its key from the environment) or a local model by its base URL (LM Studio, Ollama), the model, the caps per day and month in dollars and in tokens, the cost above which an ask waits for a yes, and whether the rules' staging suggestions are taken as you leave each line. How agents' edits land is on the Agents page. They are kept in the person's config folder, never in the content root.

## Review notes (`server/review.ts`)

Review state is editors' notes, so it is not part of a story: a story's root takes no extra keys. It lives in a sidecar beside the content, `<root>/.backstage/review.json`, at sahne-story's `paths.ts` `REVIEW`.

```json
{ "v": 1, "episodes": { "s1e01": { "status": "reviewed", "ai": true, "reviewer": "…",
  "steps": { "4": { "reviewed": true, "checked": ["en", "fa"] }, "12.0.1": { "reviewed": true } },
  "comments": [{ "id": "…", "at": "4", "by": "…", "text": "…", "date": "2026-10-29 10:00", "done": true }] } } }
```

- **Status** is `draft`, `reviewed` or `approved`.
- **A step key** is the step's number, then the option's, then the reply's (`12.0.1`).
- **`checked`** lists the translations checked, by language code. Notes written before it say `persian: true`, read as `fa` checked.
- **The notes are saved at once.** They are written apart from the story's Save, and only when backstage runs with `--write`.
- **What is never in them:** card or lesson text. No app and no check reads the sidecar.
- **Commit it or not.** An app may commit the sidecar, so the review is shared, or git-ignore it.

## MCP server and agent edits (`server/mcp.ts`, `server/proposals.ts`, `server/events.ts`)

Backstage is also an MCP server, so an agent (Claude Code, the editor's own assistant, any MCP client) can read and edit the content root. Every tool goes through `server/content.ts`, so an agent's edit passes the same check as a person's save.

**Where it is served.**
- **Streamable HTTP** at `http://localhost:5181/mcp`, inside the normal server, behind the same localhost `Host` and `Origin` guard. Each client gets a session (`mcp-session-id`), opened by its `initialize` request. This is the way to work beside the editor: proposals land in the editor that is open.

```bash
claude mcp add --transport http sahne-backstage http://localhost:5181/mcp
```

- **stdio**, for an agent that starts the server itself. It prints nothing to stdout but MCP frames, and reads the content root again before each call, since a backstage in another process may write the same files. With `--backstage`, its proposals go to the running backstage's queue, and `show` and direct writes reach its open editors; without it, proposals stay in the stdio server's own queue, where no editor sees them:

```bash
claude mcp add sahne-backstage -- node packages/sahne-backstage/server/cli.ts mcp --content <root> --write --backstage http://localhost:5181/
```

  The flags are those of the server (below), plus `--backstage`.
- **In memory**, to the editor's assistant (`server/assistant.ts`).

**The flags** (of `cli.ts` and `cli.ts mcp`; `startBackstage()` takes them as `agentEdits` and `shareCards`; `GET /api/world` answers both):
- `--write`: without it every write tool refuses, and so it does on a root in the old language shape. The refusal says why.
- `--agent-edits proposals|direct` (default: the person's settings, else `proposals`). The Agents page switches it while backstage runs, and keeps the choice in the settings: an agent that connects after the switch gets the new mode, one already connected keeps its own until it connects again (what it was told it does stays true).
  - **proposals.** A write tool computes the whole new document, checks it, and queues it. A person accepts or rejects it in the editor. Nothing is written.
  - **direct.** A write tool saves (`save()`: 403, 400, 409 and 422 are the agent's answer) and sends a `doc` event to the open editors.
  - In both modes, an edit that brings a new error is refused, with the problems, so the agent can fix it. A write tool takes the `mtime` that `read_episode` gave: an edit of a file changed since is refused.
- `--share-cards`: `search_words` also gives a card's main-language word.

**The card rule.** Agents get a card's id and level, and with `--share-cards` its main-language word. Never its translations, notes or lesson text.

**The tools.** A path names a place in a document: `steps/3`, `steps/12/choice/options/0/reply/1`, `quiz/0`, `title`. A bare number is a step.

| Tool | What |
|---|---|
| `series_overview` | The series: titles, languages, narrator, stand-in, seasons with their episodes, and whether and how it can be edited |
| `list_episodes` `{ season? }` | The episodes, with title, kind, date, place, cast and draft |
| `read_episode` `{ id, raw? }` | The episode as a script: one line per step, option and reply, each with its path, speaker, main text, translations and staging; the quiz; the `mtime`. `raw` adds the JSON |
| `read_step` `{ id, path }` | The JSON at a path |
| `kit_search` `{ kind, query?, limit? }` | Characters, places (with marks and props), the kit's props, gestures, emotions and sounds (`sahne-kit` `full`) |
| `search_words` `{ query, limit? }` | Card ids and levels, and the word with `--share-cards` |
| `check_episode` `{ id }` | The story check's problems for the episode |
| `read_notes` `{ id }` | The episode's review notes |
| `edit_step` `{ id, path, patch, mtime? }` | A merge patch (RFC 7386) on the object at the path; the path `""` is the episode itself (its id never changes) |
| `insert_step` `{ id, at, step, mtime? }`, `delete_step` `{ id, path, mtime? }`, `move_step` `{ id, from, to, mtime? }` | Steps, options and replies in their lists |
| `set_staging` `{ id, path, staging, mtime? }` | Staging keys; refuses a language code (texts go through `set_texts`) |
| `set_texts` `{ id, path, texts, mtime? }` | Texts by language; only the series' languages |
| `create_episode` `{ season, id?, releaseDate, kind, week, place, cast, words, lessons, title, summary?, level? }` | A new episode from `src/model/skeleton.ts`, with its calendar row when the season has a calendar |
| `set_calendar` `{ season, story, row: { date, kind, week }, mtime? }` | The season's calendar row and the episode's `releaseDate`, `kind` and arc, together |
| `comment` `{ id, step?, text }` | A review comment. It is a note, not content, so it is written at once (with `--write`) in both modes |
| `set_review` `{ id, status }` | Direct mode only. In proposals mode a person decides where an episode stands |
| `show` `{ id, step? }` | The open editors go to the episode and step (`show` event) |

**The resources.**
- `sahne://format`: sahne-story's README.
- `sahne://languages`: the series' `languages`.
- `sahne://selection`: what the open editor last posted to `POST /api/selection`.

**Proposals** (`server/proposals.ts`, in memory, one queue per backstage process, never on disk).
- A proposal is `{ id, kind, doc, next, base?, create?, also?, paths, summary, by, at, problems, after? }`:
  - `next` is the whole proposed document, `base` the mtime it was computed from, and `create` marks a new document;
  - `also` lists the documents that change with it, each `{ kind, doc, next, base?, create? }` (a season's calendar with its episode). They are saved in the same save;
  - `paths` are the changed places, and `by` is `assistant` or the MCP client's name;
  - `problems` is the check of `next` and `also`.
- **They compose simply.** An agent's proposal is computed from the file plus that agent's own latest pending proposal on the document. `after` names that proposal. So each proposal holds the ones before it:
  - accepting one also resolves those it was built on;
  - rejecting one also drops those built on it.
  Different agents' proposals are independent, each against the file.
- **The browser applies an accepted proposal itself**, as an edit (Undo, the check, Save). Backstage never saves a proposal. An editor with unsaved edits of the same document applies only the proposal's `paths`, so nothing typed is lost.

**In the editor** (`src/events.ts`, `src/ui/studio/proposals.ts`). The page listens to `/api/events`:
- **A proposal** shows above its episode's script: who proposed it and what, each changed place with its words before and after (word by word), the errors it would bring, and *Accept* or *Reject*. The top bar counts the proposals waiting and links to the first.
- **A direct write** reloads a document that has no unsaved edits here; one that has them gets a banner instead, to take theirs or keep yours.
- **`show`** opens the episode at the step.
- **`activity`** is an agent's tool call, or null when an agent connects or goes, or the mode changes: the Agents page and the side panel read `GET /api/agents` again.
- **The selection** is posted to `/api/selection` a moment after it settles, for the agents' `sahne://selection`.

**The routes** (localhost only, as the rest of the API):

| Request | Answer |
|---|---|
| `GET /api/events` | `text/event-stream`, a keep-alive comment every 20 s. Events: `proposal` `{ action: "added" \| "resolved", proposal, accepted?, with? }`, `doc` `{ kind, id, mtime, by? }`, `show` `{ id, step }` (a path, or null), `usage`, `activity` `{ at, by, tool, ok, ms, summary }` or null |
| `GET /api/proposals` | `{ proposals }` |
| `POST /api/proposals` `{ kind, doc, next, base?, create?, also?, paths, summary, by, after? }` | `{ proposal }`: one queued from another process (`cli.ts mcp --backstage`), checked here; 403 when read-only |
| `POST /api/proposals/<id>` `{ accepted }` | `{ resolved: [ids] }`: the person's answer (the browser applies an accepted one itself); 404 for an unknown id |
| `POST /api/selection` `{ page, kind?, id?, path? }`, `GET /api/selection` | The editor's selection, for the `selection` resource |
| `POST /api/events` `{ event: "show" \| "doc" \| "activity", data }` | Another process tells the open editors what it did (`cli.ts mcp --backstage` sends its tool calls as `activity`). A `doc` event also makes this server read the root again |
| `GET /api/agents` | `{ mcpUrl, cli, content, write, writable, agentEdits, shareCards, sessions, editors, activity, pending, tools }`: the Agents page (`server/agents.ts`: the HTTP sessions and the last 200 calls, in memory) |
| `POST /api/agents` `{ agentEdits }` | The mode for agents that connect next, kept in the settings; answers as the GET |
| `/mcp` | The MCP server (Streamable HTTP) |

## The assistant, providers and the budget (`server/assistant.ts`, `server/ai/`, `server/settings.ts`)

**The assistant** is an agent loop on the server. It reaches backstage only as an MCP client of its own MCP server (`createMcp`, over an in-memory transport), so it uses the same tools and checks as any agent.
- Its edits are made `by: "assistant"` and follow the agent-edits mode. That is the settings' `agentEdits`, else the server's `--agent-edits`, so proposals by default.
- Its system prompt is built from the series: the title, the main language and the translations (and which run right to left), the narrator and the stand-in, a summary of the format, and how edits are made. Nothing in it belongs to one language.
- **The second reader** is `fresh: true`: a new conversation of the person's last message alone. It never sees the drafting history, and it is told to comment rather than change.
- **A big ask** (drafting or reviewing a whole season, or every episode) is estimated first. If it would cost more than `confirmOverUsd`, or use more tokens than are left today, nothing runs: the answer is a `confirm` event, and the editor sends the request again with `confirm: true`.
- When the browser closes the request, the model's request is aborted, so a closed tab stops spending.

**The providers** (`server/ai/provider.ts`). Both use plain `fetch`, streamed, with tools.
- **Anthropic** (`ai/providers/anthropic.ts`). The Messages API with the key from `ANTHROPIC_API_KEY`, `anthropic-version: 2023-06-01` and adaptive thinking.
  - The models live in one place (`MODELS`): `claude-opus-5-5` for an ordinary ask, and `claude-sonnet-5-5` for a quick one (`quick: true`). The settings' `model` replaces the first.
  - A tool loop sends each turn back as it came, thinking blocks and their signatures included.
  - A refusal, an API error or an answer cut off is an `error` event, and no tool of that turn runs.
- **OpenAI-compatible** (`ai/providers/openai.ts`). Any `/v1/chat/completions` server with `tools` and `tool_calls`: LM Studio (`http://localhost:1234/v1`, the default), Ollama (`http://localhost:11434/v1`), or llama.cpp's server (`http://localhost:8080/v1`).
  - `OPENAI_API_KEY` is sent as a bearer token when the environment has one.
  - Without a `model`, the request names none, and the server uses the model it has loaded. Ollama needs one.
  - A server that reports no usage is counted at about four characters a token, so the token caps still bind.

**Settings** (`server/settings.ts`).
- They live in the person's config folder: `$SAHNE_BACKSTAGE_CONFIG`, or `~/.config/sahne-backstage/`. The file is `settings.json`:

```json
{ "provider": "anthropic", "model": "claude-opus-5-5", "baseUrl": "http://localhost:1234/v1",
  "caps": { "dayUsd": 5, "monthUsd": 50, "dayTokens": 2000000, "monthTokens": 20000000 },
  "confirmOverUsd": 0.5, "agentEdits": "proposals", "applySuggestions": false }
```

- The values above for `provider`, `caps` and `confirmOverUsd` are the defaults. Choosing `openai` without a `baseUrl` saves LM Studio's.
- **The environment overrides the file**: `SAHNE_AI_PROVIDER`, `SAHNE_AI_BASE_URL`, `SAHNE_AI_MODEL`. The CLI's `--ai-provider`, `--ai-base-url` and `--ai-model` set them.
- **Keys are never stored.** They are read from the environment only. A save keeps only the known fields, so a key sent with it is dropped.
- `applySuggestions` is the editor's own preference. The server keeps it and does nothing with it.

**The budget** (`server/ai/budget.ts`).
- **The prices** are in one table (`PRICES`, USD per million tokens, from the Claude API's model docs): Opus 5.5 is $4 in and $20 out, Sonnet 5.5 is $2 in and $10 out, and cache reads are $0.20. A local model costs nothing.
- **The caps** are per day and per month (local time), in USD and in tokens. The token caps bind local models too. They are checked before every model request of a tool loop, and a request at a cap is refused with a message that says which cap.
- **Every call is logged** to `<config>/usage.jsonl`, one JSON line each: `{ at, provider, model, input, output, cacheRead, cacheWrite, tokens, usd }`. After each call the editors get a `usage` event.
- **Why the config folder.** The log and the settings are in the person's config folder, not in the content root's sidecar (`.backstage/`). An app such as Kumru commits its sidecar, and what one person spends is theirs.

**What leaves the machine** is what the tools return: the story documents (texts and staging, with card ids), the cast's names and roles, the places' marks and the kit's names. With `--share-cards`, it also includes a card's main-language word. A card's translations and notes never leave.

**The routes:**

| Request | Answer |
|---|---|
| `POST /api/assistant` `{ messages: [{ role, content }], context?: { page, kind?, id?, path? }, fresh?, confirm?, quick? }` | `text/event-stream`. Each event's `data` is JSON with its `type`: `text { text }`, `tool { name, input }`, `tool_result { name, ok, summary }`, `proposal { id }`, `confirm { estimateUsd, why }`, `done { usage: { input, output, usd } }`, `error { message }`. 400 for a malformed request |
| `GET /api/settings`, `POST /api/settings` `{ … }` | `{ settings, file, overrides, keys: { anthropic, openai }, ai }`. `keys` says whether each key is set, never the key. A POST merges over the file |
| `GET /api/usage` | `{ today: { usd, tokens }, month: { usd, tokens }, caps }` |
| `GET /api/world` | Also `ai`: `false` when the assistant cannot run, else `{ ready: true, provider, model }`. It is ready with Anthropic when `ANTHROPIC_API_KEY` is set, and with OpenAI-compatible when a base URL is set. The network is never probed for it |


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
| `GET /api/cards?q=` | `{ cards: [{ id, tr, en, level? }] }`: up to 40 word cards matching the search, read live (the word picker) |
| `GET /api/lessons` | `{ lessons: [{ id, ref? }] }`: the grammar lessons, when the root has them |
| `GET /api/problems` | `{ problems }`: every problem of the content root, as `stories.ts --check` finds them (the review page) |
| `GET /api/review`, `POST /api/review` `{ id, review }` | The review notes; a POST replaces one episode's (cleaned: unknown keys dropped) and answers all of them |
| `POST /api/reload` | The server forgets the world it has read (after a change made elsewhere) |
| `GET /api/docs`, `GET /api/docs/<id>` | The guides: `{ docs: [{ id, title, path }] }`, then one as `{ id, title, path, markdown }`. Only `backstage` and `format`; any other id is 404 |

## Layout

- **`server/`** is Node only, so `packages/tsconfig.json`, which has `"types": []`, does not type-check it. It contains:
  - `index.ts` (`startBackstage`) and `cli.ts`;
  - `http.ts` (routes, guards, the esbuild bundle in `dist/app/` (git-ignored, rebuilt on change), the font and the sounds);
  - `content.ts` (kinds, files, checks, saves);
  - `git.ts`;
  - `review.ts`;
  - `mcp.ts` (the MCP server: its tools and resources), `proposals.ts` (agents' edits waiting for a person), `events.ts` (the editors' event stream and selection) and `agents.ts` (the connected agents and their calls);
  - `assistant.ts` (the assistant's loop and its system prompt), `settings.ts` (the person's AI settings), and `ai/`: `provider.ts` (what a provider does, and the stream reader), `providers/anthropic.ts`, `providers/openai.ts` and `budget.ts` (the prices, the caps and the usage log).
- The server reads sahne-story's Node-only files (`paths.ts`, `check/`, `load.ts`) by path. The package exports only `"."`.
- **`src/`** is the browser side (the studio's shared parts in `src/ui/kit/`: icons, chips, drawers, popovers, the palette; the theme in `src/ui/theme.ts`), built with Preact and htm tagged templates (no JSX, so the source stays erasable TypeScript). It contains:
  - `index.ts`;
  - `store.ts` (signals: the world, the route, each open document's draft, the server's problems);
  - `api.ts`;
  - `stage.ts` (`Preview`: the stage and a story player that follow the document);
  - `events.ts` (the server's events: proposals, direct writes, `show`, usage; the selection);
  - `thumbs.ts` (pictures the stage draws once and keeps); `live.ts` (the kit page's hover previews on one shared stage);
  - `model/` (paths into a document, undo and redo, the step list, what changed, the board's weeks, the script's blocks and keys, parentheticals, ghosts and suggestions, notes, a new episode's skeleton, the palette's search, the kit page's shelves, the guides' Markdown; pure and tested in Node);
  - `ui/` (the pages: `app` (the shell), `board`, `new`, `studio/` (the episode: `episode`, `script`, `sections`, `details`, `direct`, `strip`, `notes`), `cast`, `places`, `kitpage`, `review`, `seasons` (settings), `settings` (the assistant and the budget), `agents`, `docs`; and their parts: `side` (the side panel), `assistant`, `galleries`, `lang`, `staging`, `changes`, `fields`, `theme`, `kit/`).
- **`index.html`** is the page.
- **`test/`**: `node --test` covers the save round trip, the model, the server on a temp copy of the samples, and the rest of the API. `mcp.test.ts` covers the MCP server in memory, over HTTP and over stdio. `assistant.test.ts` covers the assistant's loops, the budget and the settings with the network stubbed, in a temp config folder. `pnpm check` runs it.

The package exports `"."` → `src/index.ts`, like every package, and also `"./server"` → `server/index.ts`. The server is the one Node-only entry. Backstage never ships to learners, so it has no `size.mjs` budget and no `determinism.mjs` entry.
