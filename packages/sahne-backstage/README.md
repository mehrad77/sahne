<!-- sahne:brand: written by packages/sahne-gallery/brand/build.mjs, edit that and run it -->
<p><picture><source media="(prefers-color-scheme: dark)" srcset="../../assets/brand/sahne-backstage-header-dark.svg"><img src="../../assets/brand/sahne-backstage-header.svg" alt="sahne BACKSTAGE" height="64"></picture></p>
<!-- /sahne:brand -->

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
- **The top bar.** The series, the search box, whether everything is saved (or why nothing can be: read-only, the samples, a root in the old language shape), and the theme (as the system is, light or dark, kept in this browser).
- **Search and commands** (`⌘ K`, or Ctrl K, or the search box): type a few letters of an episode, a season, a character, an extra or a place to go there, or of a command (a new episode in a season, the theme). Words match anywhere in a name or its keywords, accents ignored (`src/model/search.ts`).
- **The rail:** the board, the cast, the places, the kit, review; at its foot the agents (with how many proposals wait), the guides and settings.
- **The side panel** (`src/ui/side.ts`), beside any page: ✦ in the top bar opens it on the assistant, ? on the guide's part about the page you are on. Its tabs:
  - **Assistant**: the conversation (below).
  - **Agents**: the proposals waiting, with *Open*, *Accept* and *Reject*; how agents' edits land; the command that connects Claude Code; and the latest tool calls.
  - **Docs**: the part of the guides about this page (beside an episode, the episode studio's, with its keys), and a search over both guides.
- **Agents** (`src/ui/agents.ts`), four tabs: **Assistant** (`#/agents`), the assistant's conversation in full view, the same one as the side panel's (the panel's ⤢ opens each of its tabs in full view: the assistant here, its Agents tab on Activity, its Docs on the Docs page); **Tasks** (`#/agents/tasks`, `src/ui/runs.ts`, `src/runs.ts`; an old `#/agents/runs` link lands there): the tasks, newest first, and one task (`#/agents/tasks/<id>`), shown by what it makes. On top, the goal, a progress bar (finished steps solid, steps in progress striped and moving), its cost and its mode, and a line for each working step saying what it does now ("Review s1e01 · Reading s1e01…", `doingNow` in `src/ui/chat/parts.ts`). Then **Needs you**, the one place anything waits for you: the plan in a sentence ("1 new person (zeynep2), 4 places, … About $4"), each step with its plain line for the person (`about`, which the planner writes beside the agent's brief; that brief, and the plan's, are folded), *Start* and a box to change something (it plans again with your words), a step's question with its buttons and your own words, a pause (raise the budget and go on, or try the stopped parts again), the new people and places to look at. Then **what it makes**, as cards grouped into People, Places, Season and Episodes: a portrait, a place's picture, an episode's place, its state (to come, being made, made, waits for you, undone) and *Open*; in Auto mode *Undo*, which says what goes with it, and *Undo all of it* when the run is done; when it checks with you, *Accept and save* (with what it needs, first) and *Reject*. Each card also says why (its step's plain line) and what the step decided. **What it did** lists its writes, newest first (`did`), each to open or undo, with the choices each step made. *Undo*, *Restore*, *Back to before this task* and *Stop the task* ask in place first (`Confirm` in `src/ui/kit/index.ts`: its question, *Yes* and *Cancel* take the button's spot), and a document undone leaves its page for its list. A working chip breathes, what is being made has a light sweeping over it and flashes once as it lands, and only what waits for you pulses; with reduced motion nothing moves. The steps themselves (their status, what they make, their logs read as the chat's parts, their reports, their questions, *Try again*, *Do it again*) are folded under *Show the work*. The top bar says when a task waits for you, the tab's title starts with ●, and the Tasks tab carries a count; **Activity** (`#/agents/activity`): what waits, how agents' edits land, what they did, who is connected; and **Connect** (`#/agents/mcp`): how to connect an agent (the `claude mcp add` command over HTTP, the one that starts its own backstage on stdio with `--backstage` here, and the `mcpServers` entry other clients read, each to copy), how their edits land (switched here, below), who is connected over HTTP (the client's name, since when, how many calls), every proposal waiting across the documents, what agents did lately (each tool call: who, which, whether it worked, how long, its answer's first line; the assistant's too), and the tools, read and edit, with what each does.
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

### Calling a tool from the shell (`server/call.ts`)

An agent without MCP uses the same tools through one command. It embeds the MCP server in its own process (`createMcp` over an in-memory transport), so no tool is reimplemented. Each image answer is saved as a PNG, its path printed first as `image: <path>` for the caller to Read, and the first one copied to `<out>/latest.png`; then the answer's text. An answer with pictures prints its JSON block on one line (`data: {…}`: the text says the same, the problems as lines and what each cell shows, but a saved drawing's document is only there), whole with `--json`; one without pictures prints its JSON as it is, since that is its answer. The exit code is 1 when the tool answered with an error: the text is then on stderr, and the pictures still saved and their paths on stdout (a sheet with one bad item draws the rest).

```bash
node packages/sahne-backstage/server/call.ts kit_search '{"kind":"set","query":"frontage"}' --content <root>
node packages/sahne-backstage/server/call.ts kit_render '{"items":[{"id":"chair"},{"id":"frontage","variant":"firin"}]}' --content <root> --out /tmp/sheets
node packages/sahne-backstage/server/call.ts draft_kit_item @doc.json --content <root>      # the arguments: '{…}', @file.json, or - for stdin
node packages/sahne-backstage/server/call.ts list [<tool>] --content <root>                 # the usage and a line a tool; with <tool>, its description and input schema
node packages/sahne-backstage/server/call.ts read sahne://kit-guide --content <root>        # a resource
```

- **Flags.** `--content <absolute folder>` (default `$SAHNE_CONTENT`, else the samples), `--write` (without it every write tool refuses), `--agent-edits direct|proposals` (default `direct` with `--write`, since a one-shot process has no editor to accept a proposal, and `proposals` without), `--share-cards`, `--out <dir>` (default a new private folder per call, or a stable one per session, both in the session folder below), `--json`, `--timeout <seconds>`. Each PNG's name is unique (`<yyyymmdd-hhmmss-mmm>-<pid>-<n>-<4 hex>-<tool>.png`, in the order made, written so it never replaces a file), so two calls into one `--out` at once keep both.
- **`kit_render` and `draft_kit_item` take lists** (`items`, `docs`, up to 48; an item is an id or `{ id | doc, as?, variant?, params?, vary?, t?, frames?, focus? }`) and answer numbered cells (`cellSheetSvg`), 24 to a picture: each item's default look, or the `variant`/`params` given, by day and night, each zoomed to its own item unless `zoom: "scene"` puts them all at one scale. The text lists what each number shows. A single item still gets all its looks (variants, `n 3`, held), and a prop's one look given by `variant`/`params` also shows it `n 3` and held. `vary` (on the call or an item) draws a cell per value instead of a call each, and `t`/`frames` and `focus` look at motion and detail: *Piece sheets as PNG* below.
- **`--session <name>`** keeps one server process alive across calls. It starts on first use, talks over a unix socket, and ends after 15 idle minutes or with `--session <name> --stop` (`--status` says whether it runs). The kit and resvg load once. Per call, the median of three on an M-series Mac with a warm disk cache (2026-10-31):

  | Call | One-shot | `--session` |
  |---|---|---|
  | `list` | 0.59 s | 0.10 s |
  | `kit_search` `{"query":"cup"}` | 0.60 s | 0.10 s |
  | `kit_read` `{"id":"frontage"}` (16 cells) | 1.06 s | 0.53 s |
  | `kit_render` of 4 items (cup, tea held, flag, frontage) | 1.05 s | 0.46 s |
  | `draft_kit_item` of a small prop (6 cells) | 0.89 s | 0.36 s |

  A session's first call starts it and pays the load, about 0.8 s. **Its setup sticks**: a call that leaves out `--content`, `--write`, `--agent-edits` or `--share-cards` takes the running session's, so after `--session kit --content <root> --write` every call is just `call.ts <tool> '<args>' --session kit` (no flag string to split in zsh). So a session started with `--write` keeps writing for calls without flags; use another session name for a read-only one. A call that gives `--write` (or another mode) to a session started without it is served by the same process, by a second server in it with that setup; one that names another content root (`--content`; `$SAHNE_CONTENT` is only where a new session starts, never a reason to move a running one) restarts the session for it, saying so on stderr, with `--write` only if that call gives it. A restart for a changed source (below) keeps the setup. A session's name is scoped to the checkout, so two worktrees' `--session kit` are two processes, each drawing its own source. A session that does not start answers with the last lines of its log (a generator's error), and where the log is.
- **The session folder is private.** The socket, each session's log and the default `--out` folders live in `$TMPDIR/sahne-call-<uid>/`, made with mode 0700 and checked on every call: a link, a file or another user's folder is refused, and a folder of ours that others can open is closed. When a socket's path there would be too long for a unix socket (about 100 bytes), the folder is `${XDG_CACHE_HOME:-~/.cache}/sahne-call/` instead, with the same checks; never a shared `/tmp`.
- **A call gives up after 120 s** (`--timeout <seconds>`, or `SAHNE_CALL_TIMEOUT_MS`) when its session does not answer, with an error that names the session and says how to wait longer or `--stop` it. A session serves one call at a time, so the time a call waits behind another counts.
- **TypeScript kit sources are never stale.** Before each call the session process compares the newest mtime of the `.ts` of `sahne`, `sahne-kit`, `sahne-story` and `sahne-backstage` with what it loaded, and when something changed it starts a fresh process for that call, so an agent that edits a generator and renders sees its edit. Drawings and every other document of the content root are read fresh on each call. (`SAHNE_CALL_WATCH`, a `:` list of folders, replaces the watched ones, for the test.)
- `test/call.test.ts` runs it: PNGs for `kit_render` and `draft_kit_item` (one and a list), the path first and `latest.png`, `--json`, the short `list`, errors, `--write`, the session's reuse, sticky setup, restart and stop, the private folder (and its fallback for a long temp dir), the timeout, and two calls at once into one `--out`.

**The kit page** (`#/kit/<section>/<shelf>`, `src/ui/kitpage.ts`) lays the kit out as a library:
- **The side.** It lists the sections (props, set pieces, gestures, emotions, sounds) with their icons and counts. The side folds sideways to its icons, and remembers whether it is folded. On a small screen, the sections become a row across the top with the shelves as chips under it, the tags go on one line that scrolls, and the details open as a sheet from the bottom. The open section is split into shelves (`src/model/kitgroups.ts`). Each shelf gathers several of the kit's tags, and an item goes on the first shelf one of its tags belongs to, else on *Other*. Gestures are shelved by what they need, sounds by their bus. A test fails when a prop or set-piece tag is on no shelf. The content root's own kit items (`kit/`, drawn as data, sahne-kit's DRAWING.md) have a shelf of their own, **This series**, first on props and set pieces, whatever their tags, and a small badge on their card; the page reads them from `GET /api/kit` and draws again when one is saved (`src/kitdocs.ts`).
- **The bar.** It has a search of the section, the shelf's commonest tags as filters, and the card size (S, M or L, remembered).
- **The cards.** With no shelf and no search, each shelf shows its first row and *See all*. Otherwise the cards come in pages as the list scrolls.
- **Details.** A click opens a card's details: its id to copy, what it is, its tags, other names and parameters with their defaults. A sound also plays, with a playhead over its waveform and the time into it. A loop's playhead goes round from where the engine started it. The waveform is the recording where one loads, so it matches what plays.
- **Hover.** A gesture or an emotion plays on the stand-in while the pointer rests on its card. One shared stage is laid over the card (`src/live.ts`). With reduced motion, the pictures stay still.

## Piece sheets as PNG (`server/render.ts`)

An agent cannot open a gallery, so a kit item is drawn as a picture it can read. `kitSheetSvg` (`sahne-kit/set-svg`) lays out cells: each look of an item (its default, each variant; for a prop also `n: 3` and held), by day and by night, every cell on a faint grid. `cellSheetSvg` lays out the cells it is given (`SheetCell`: an item, a look, the view, a time, a crop, a number), as the MCP tools do. Under the art (never over it), each cell's caption has two lines: its number, item and look (cut with an ellipsis where too long: the tools' text has them whole), and its view, time and scale (`day · t 600 ms · 1 cm = 6 px · grid 10 cm`). A cell is framed on the art and its glow, with a margin, so a halo or a star on top is not cut. A sheet of three cells or fewer (or of six or fewer cropped ones) is drawn twice as large. `zoom` decides the scale:
- **`auto`** (the default, and what the MCP tools draw unless asked): an item under 60 cm both ways (`SMALL_CM`) fills its cell, at no less than the scene's scale and no more than 40 px per cm, on a 1, 2, 5 or 10 cm grid, with a scale bar of a round length where the adult would stand (beside a 170 cm person an 8 cm cup is a speck). A small held prop has no floor line; a red cross marks its grip, where the hand is (a thing that sits on the palm, a tea glass or a plate, stands a few cm above the cross by design: the prop's lift). A larger item stands beside a 170 cm adult, the cheapest check of puppet scale.
- **`scene`**: one scale for every cell of the sheet, each with the whole adult on one floor line, to compare sizes.
- **`fit`**: every item fills its cell however large (a tall house, a long train), with a scale bar and no adult.

Two more things a cell can show:
- **Mid-motion** (`t`, ms on the place's clock; the tools also take `frames`, that many times over the item's longest motion): each moving flat (`FlatMotion`: sway, path, scroll, blink) is where `moveAt` has it then, a sway turned about the flat's origin as the stage turns it. Without `t` every flat is at the start of its motion and unturned, as the gallery's sketches are. The tools' text lists each item's motions and periods (`motion: flag: sway 2241 ms ±2.9°`).
- **A crop** (`focus`, `[x0, y0, x1, y1]` in the item's cm as its path data has them: the origin at its floor point, up negative): only that box, magnified up to 400 px per cm (`FOCUS_MAX_PX_PER_CM`), with a scale bar, to judge an emblem on a flag or a sign's letters.

A piece stands on its origin (the kit's floor point) when its art reaches it, else on its lowest edge. `pieceSvg` takes `{text, night, t}` options: `text` writes each flat's `TextSpec` as SVG `<text>` so a sign's words can be read, `night` dims the day art and lays the emissive glow over it, `t` the time above. `renderPng(svg)` turns that into a PNG with `@resvg/resvg-js`, at most 1600 px wide, using the stage's Comic Neue from `server/fonts/` (the `.ttf` of the `@fontsource` latin files, which resvg can load where it cannot load WOFF) and the system's fonts for what that lacks.

## The pages

| Route | What |
|---|---|
| `#/` | The home: the series' name, the scene last worked on framed as a paper theatre's stage, *Continue* back into it, the board, and the cast, places, kit and guides. The episode page keeps the episode, the cue on its stage and a picture of that stage in this browser (`src/recent.ts`). Before any, the home shows the next episode's place. *Continue* opens the curtains and grows the scene to fill the page. The episode then opens under it at that cue. With reduced motion, it simply opens. A root with no series or no episode asks for the first |
| `#/board`, `#/season/<id>` | The board of a season (the first, or the one named), described below |
| `#/new/<season>[/<date>]` | A new episode (on that day), described below |
| `#/episode/<id>` | An episode, at the stage of the work it is at, described below |
| `#/episode/<id>/<stage>` | An episode at one stage: `brief`, `script`, `translate` (`/translate/<lang>` opens that language: a translator's link), a plugin's own (`lesson`) or `review` |
| `#/episode/<id>/proposal/<n>` | An agent's proposal of that episode read as a whole, as a new episode's preview is (*Reject*, *Accept*); its step diff links here when most of the episode changes |
| `#/kit/<section>/<shelf>` | The kit as a library: props, set pieces, gestures, emotions, sounds, by shelf |
| `#/cast` | Everyone of the series as a portrait, the extras on their own tab. *New character* (the first card, or the button) asks who they are: a name in the main language (the id is made from it, `Kırlangıç Ana` → `kirlangic_ana`, and can be edited; ids are permanent, and a taken or retired one is refused), a role, and a look to start from (the stand-in, four random ones, or a copy of someone), then opens their page. With a few words about them and the assistant on, they are saved at once and the assistant drafts their role, bio and names there, as a proposal to accept. A right click on a card opens or deletes them; deleting asks first, and is refused for an extra, the stand-in or the narrator, or one an episode names (their page has the same *Delete*) |
| `#/character/<id>` | A character, described below |
| `#/places` | Every place as its wide shot, with how many episodes it opens; *New place* starts one |
| `#/place/<id>` | A place, described below |
| `#/review` | What needs a person's eye, nearest launch first (filters: needs you, has errors, launches this week, changed since approved, AI-written): each season's bar (approved, ready to approve, in progress, changed since) and its next launch, and each episode's stages (`src/model/progress.ts`, as its page's stages bar), the one it is at, its errors, and a link straight there (*Go to Translate*, *Approve*). *Export the notes* writes them as markdown |

**The board** (`src/ui/board.ts`, its dates in `src/model/board.ts`):
- **The seasons are tabs at its top** (*Season 1*, *Season 2*, with each title), and *+ Season* starts the next one. The top bar names only the series.
- A season's weeks are rows and Monday to Saturday the columns: an episode on a weekday, a special on Saturday, no Sunday. The rows run from the season's launch week (or its first episode's) to its last episode's, and one more to plan into. A row's week is the one its episodes' calendar rows (or arcs) name; an empty row between two weeks is a break.
- **Each episode is a card on its release day:** its place's picture, its title in the main language, a special or not, a draft or not, its review status (an edge: to review, reviewed, approved) and its errors and warnings. A click opens it.
- **Dragging a card to another day moves its release:** the season's calendar row and the story's own date and kind change together (a season with no calendar starts one from every episode's date), and to another week the episode takes that week's theme (a week with none takes the episode's). The changes wait in a save bar; a save the check refuses lists the new errors there (a story's `ref` belongs to its week's unit, for one).
- **An empty day** starts a new episode on it (`#/new/<season>/<date>`).
- **A new episode not on disk shows too, on its day:** one an agent proposes is a dashed card marked *proposed* (it opens the preview to accept or reject, and cannot be dragged until accepted; the season's count says how many), and one accepted or started but not saved yet is marked *unsaved* until its Save.
- **Reading it:** a day shows its number, with the month where one begins; a week its span (`14–19 Sept`). Today has a red edge, and past days are quieter. A week with no episode yet is a low row. Saturday's column is marked special. The title is in the main language, with the first translation under it. On a phone (under 720 px) the board is an agenda: each week a block, its days a list with the weekday, an episode a wide card.
- **Each row starts with its week's theme** (its arc), edited in place in the main language; its menu edits it in every language and what the learner does that week (`mechanics`). A theme is written in the season and in every story of the week, saved together.
- Episodes no day shows wait under the board, to be dragged onto a day: those with no date, on a Sunday, or on a day another episode has.
- **A view switch** beside the settings (a calendar or a list, remembered in the browser) shows the season as a list instead: each week with its span and theme, then a row per episode in release order (its day, its place's picture, its title with the first translation, its id, place and cast, and its state), and last the episodes with no date. A row opens the episode.
- *Season settings* and *Series settings* open in a modal over the board (`Modal`, a `<dialog>`: Escape or a click outside closes it), and the series' also from an episode (its *⋯* menu, and Translate's *+ Add a language*). They hold the titles and summaries in every language, the narrator, and the season's launch day. A foot kept in view while the fields scroll says whether there is anything to save, with *Discard* and *Save* (read-only, *Read-only*, which says why). They also hold:
  - **The series' languages:** a list of the one it is written in and its translations. A translation is added from the languages Sahne has a story language for (sahne-story `LANGS`, *+ Add a language…*), or removed with *Remove*, which keeps its texts in the files but stops asking for them. The main language is changed in `series.json`.
  - **How its episodes play:** *Interactive* or *Watch only* (`play`, sahne-story *Watch-only episodes*). An episode's Brief can differ. Under *Interactive*, the stand-in: who the viewer speaks as. The stand-in is core; a plugin may name the viewer (`EditorPlugin.viewer`, `viewerOf`: the lesson plugin's "the learner"), and the editor says it wherever it means the viewer (the new episode's cast, an act's prompt, a week's mechanics). On a root with no `series.json`, the board starts one.

**The episode studio** (`src/ui/studio/`) is built around the stages of the work. It always shows where the episode stands and the one next step.
- **The top** (`episode.ts`):
  - **The title row:** the title, its first translation, the kind, the release day and whether it is watch-only, draft or approved. Beside it, the save state, undo and redo, *Save* while there are unsaved edits, *Ask* and a *⋯* menu: *Changes*, *Revert* and *Series settings*.
  - **The stages bar:** Brief, Script, Translate, a plugin's own stage (the lesson plugin's Lesson) and Review. Each says whether it is done and what it is at, and the next one is marked. Nothing about it is stored: `src/model/progress.ts` works it out from the episode, its review notes, its problems, the suggestions and a task writing it (`test/progress.test.ts`).
  - **The next step:** one sentence and at most two buttons for the stage on the page, such as *Draft it with the assistant*, *Go to the first* line without directions, *Add all 3* suggestions, the next language, *Watch it* or *Approve*.
  - **The task line:** a task writing the episode now, or the one that made it (`MadeByTask`).
- **The stage on the page** fills the left column. The stage on the right plays the line you're on, with the tools to move people on it while you work in Script.
- **Brief** (`brief.ts`): the title and premise in the series' languages and who is in it (`EpisodeHead` in `sections.ts`), where it happens (the opening place from its picture, and the time of day), how it plays (*As the series*, *Interactive* or *Watch only*: the story's `play`), and each plugin's brief fields (the lesson plugin: the target words and lessons). A draft whose lines are still mostly placeholders shows **Start from the brief**:
  - *Draft it with the assistant* (*Check with me*) or *Just do it*, within a budget, starts a one-step task on this episode (`POST /api/runs`, an `episode` step that owns it, its brief from the Brief). The page then shows the task line while it writes, and the task can be undone.
  - *Write it myself* goes to Script.
- **Translate** (`translate.ts`): the main language beside one translation, a row per line (the learner's options, replies and a plugin's step with words too), each with its *Check*. A check holds until its line changes, then shows amber. There is a tab for each of the series' languages, with how far along it is, and *+ Add a language* (the series settings). *Copy the translator's link* copies `#/episode/<id>/translate/<lang>`. The comments left on the episode are under the lines.
- **Review** (`reviewstage.ts`): a read-through, as the audience takes it, with the first translation under each line (a click plays it, 💬 marks a line with comments). Beside the stage:
  - **Ready to approve?** each stage of the work and the open comments, with *Go* to the one not done
  - *Approve* (or *Approve anyway…* with a reason, which becomes a comment), or *Take the approval back*
  - *Watch it*: the stage full width from the opening scene, running on by itself, with the line as a subtitle in the main language and the first translation
  - *AI wrote it*
  - the comments on the episode or the selected line, and *✦ Ask a fresh reader* (the assistant as a second reader who did not write it)

  Per-block review marks (the old ✓ in the gutter and review mode) are no longer written: readiness comes from the stages, here, on the Review page (`#/review`) and in the MCP tools `check_season` and `set_review` (`standingFor` in `server/review.ts`).
- **Play** in the transport runs the episode on by itself (the player's auto, sahne-story `setAuto`), stopping at the viewer's cards. In a watch-only episode it is the main button and nothing stops it. The editor never starts playing by itself.
- **Needs you** (along the bottom, `needs.ts`): one list for everything that wants a person's eye on this episode, each going where it is dealt with. The bar counts them; it opens by itself while a task asks.
  - a task's question about this episode, answered in place
  - an agent's proposals, accepted or rejected in place (`proposals.ts`)
  - the problems and notes in plain words (`src/model/notes.ts`), each to its line, with a fix where one is obvious. The texts a language lacks are one item per language, to Translate.
  - the rules' staging ideas, to Script or *Add all*
  - the open comments, to Review
- **Approving** stores the episode's signature (`episodeSig`, kept in the review notes as `sig`), so a later change shows as *Changed since approved*. The release day and the draft mark are not part of it.
- **The head:** the title and premise in the series' languages, who is in it (the cast and extras as portraits, each with how many lines they speak; *+ someone* adds from a picker; the story check refuses a speaker not in the cast), and what the series' plugins add (the lesson plugin: what it teaches).
- **The script** (`script.ts`, its operations in `src/model/script.ts`): one block per step, typed into like a screenplay.
  - A **scene** heading: the place (a click picks another from its picture), the time of day, and where each of the cast starts.
  - A **line**: the speaker in capitals (a click, or `@` in an empty line, picks another), the words in the main language, the translations as smaller rows under it (a dot where one is missing), and the staging as chips; × on a chip clears it. The narrator's lines to the viewer say so.
  - An **action**: who does what, with no words (a beat).
  - The learner's **choice**: what it is about and whom it is said to, its options indented under it (each with ✓ for the fitting answer and a tone) and their replies under them.
  - An **act** (how the learner acts, on what, and the prompt), and a plugin's own step in its block: the lesson plugin's **grammar spot** (its lesson and the line it points at, the narrator's words in the translations).
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
- **After the script:** what the series' plugins add. The lesson plugin adds the quiz (each question in every language, three options in the main language, the right one, the line its answer quotes) and the glosses (a word the cards do not have, its meaning in each translation).
- **The plugins' parts** (`src/ui/plugins/`): a series turns a story plugin on in `series.json` (sahne-story, *Plugins*), and backstage holds each plugin's two halves. The story half (`src/model/plugins.ts`, `STORY_PLUGINS`) adapts and checks. The editor half (`EditorPlugin`, `EDITOR_PLUGINS`) can add:
  - a row in the head (`Head`)
  - sections after the script (`Sections`)
  - its step kinds' blocks and their entries in the insert menu (`blocks`)
  - a line's own fields in its details (`LineFields`)
  - a step of the new-episode page (`newEpisode`)

  Without the plugin, none of these show, and its step kinds are not offered. The lesson plugin's editor half is `src/ui/plugins/lesson.ts`. The assistant's system prompt adds each plugin's `prompt`.
- **The storyboard strip** over the stage (`strip.ts`): a picture of each beat of the episode as it plays now (each scene, line, reply, action and act, at its end), drawn once and kept, keyed by everything up to it so an edit late in the episode keeps the pictures before it. A click goes there in the script and on the stage; the one playing is marked, and a choice shows as a fork.
- **The stage:** the whole kit, the narrator's round window, the transport (the opening, back, *Next*, *Play*, a scrubber over every cue and one through the cue playing: held props and gestures go wrong mid-cue, so look there), the learner's card (say, a choice's options, an act), and one switch for each flag the episode's callbacks read.
- **Stage directions** are in plain words under each line (`src/model/directions.ts`): "nods · happy · looks at the oranges · says it to İsmail". They are quiet text until the line is selected, when they become chips you can clear, with *+ add a direction* (a parenthetical). Under any selected block (a line, a scene, a choice …), *More about this line ›* (or scene, choice …) opens everything on it in a drawer (`details.ts`): its staging in full, a scene's weather and states, the flags, and its data. *Words only* hides them. A line with none says so, and the Script stage counts it (`isUnstaged`: a gesture, a feeling, a look, whom it is said to, a walk, a prop, a reaction, the camera or a sound counts as a direction). *Show the English* (the first translation) puts each line's translation under it, read-only. The insert row under the selected line adds a line, a stage action, a narration, a scene, a choice, something to do, or a plugin's step; a watch-only episode offers no choice and nothing to do.
- **Staging fills itself in, and can be overridden** (`src/model/autostage.ts`). A selected line's chips are of three kinds:
  - **set** (solid): written in the story; × clears it back to the director's choice.
  - **ghost** (dotted): what the director does by itself and never writes: whom a line is said to and the shot it gets, read from the stage's own performance of each cue, so it is exactly what plays.
  - **suggested** (dashed, "Add?"): what the rules would add: the lints' fixes (a deixis gesture at the thing named, a prop shown or hidden, a count, a link from a word to a prop on stage), a gesture the words motivate (the story language's `motive` words: *merhaba* suggests a wave), a feeling the punctuation does (a question, an exclamation). A click takes one, ⌥ Enter every one of the block, and the Script stage's next step *Add all* every one of the episode. *Taking suggestions as you go* in the settings takes a block's as you leave it.
- **Directing on the stage** (`direct.ts`). With *Direct* on, a click on a person opens a menu of gestures (each a picture of it), feelings (each a face), what they look at, where they walk, and *says it to them*; on a prop: point at it, hold it up, touch it, show it, hide it, give it. What the speaker does goes on the block; what someone else does goes on it as their reaction (`react`). A click on a mark's pin walks the speaker there, and dragging a person onto a pin walks them. The shot bar sets the block's camera (*auto* leaves it to the director).
- **Details** opens the selected block's full staging in a drawer (`details.ts`, the forms in `src/ui/staging.ts`): every field with a picker of what is valid there (the kit's emotions, gestures and sounds; the engine's cameras, moves, prop ops and voices; the place's marks and props; the cast), a scene's time, weather and states, a line's note for the learner, the flags that gate it, and the step as JSON.
- **Notes, the review marks and changes:** the notes are in *Needs you*, and *Changes* opens from the *⋯* menu.
  - **Notes** (`notes.ts`, `src/model/notes.ts`): every problem as a stage manager's note in plain words ("İsmail speaks but isn't in the cast", "The line has no Persian yet"), the ones the last edit brought first, each with *Go* to its block and, where one is obvious, a fix (*Add İsmail*, *Stage it*, *Gloss them*); for the whole episode or only the selected block. The stage lints (`lintStory`, in the series' story language) run as you type, the full story check a moment later on the server. A block with problems has a dot in its gutter.
  - **The review notes' block marks** (`src/model/review.ts`, `blocksOf`, `standingOf`): the per-block marks of before (*reviewed*, each remembering its block as it was, `sig`) are still read and kept, and nothing writes the *reviewed* ones any more. A translation's check (written in Translate) is the mark that counts. `standingFor` (`server/review.ts`) gives the MCP tools the stages' standing in the old shape: *Ready* is every stage before Review done, no errors and no open comments; `done` and `total` count those stages; `missing` names what is left (`translate: EN 0/14 · FA 0/14`). An approval written without a signature (an agent's `set_review`) gets the episode's.
  - **Changes**: the episode's changed fields, and its steps against git's HEAD step by step (the step diff, below), with *Put back as committed* on a changed or removed step. A person commits; backstage never does.
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
- **The picks:** where (a place from its picture, and the time of day), who (the cast from their portraits; the stand-in is always in, the narrator narrates), and each plugin's step. The lesson plugin's is what it teaches: the target words, searched live through `GET /api/cards?q=`, their text never stored (on a root without cards, ids typed in), and one to three lessons (`GET /api/lessons`). Then a title (the main language's at least) and a line of premise in the translations, which the narrator opens with.
- **The rest comes from the day:** the id (the season's next free one), the kind (a Saturday is a special), the week and its theme (a week with none gets one to write). The day can be changed at the top.
- **It opens on its Brief**, where *Start from the brief* drafts the script.
- **Or from an episode:** another episode's place, cast, structure and staging, with every text cleared to `…` (`duplicate`), and the flags it sets renamed for the new story.
- `skeleton` writes a draft the check can read, in any kind of series (`test/skeleton.test.ts`): a scene with the cast on floor marks, the narrator's opening and a few lines; a choice in an interactive episode (a plain line in a watch-only one); and with the lesson plugin, a spot and three quiz items. Every text is a placeholder in each of the series' languages (a Turkish series gets a few real words to start from), marked `draft: true`. It opens in the script, and is saved with its calendar row (and a new week's theme) once the check finds no error (with the lesson plugin, it will want the target words by then).

**Live preview.**
- An edit that changes only words (`src/model/steps.ts` `wordsOnly`) re-directs the cues: `storyPlayer.replace`, with no reload.
- Any other edit adapts the story again and loads the stage.
- Either way, the stage returns to the cue that was showing.
- The stage's language plugin (mouth timing, word matching) follows the series' main language: `sahne-tr` for Turkish, `sahne-en` for English, `sahne-de` for German, `sahne-fa` for Persian, none for another (`PLUGINS` and `langPlugin` in `src/stage.ts`; Turkish when the series names none). The preview, the live card previews, the thumbnails and the place stage all use it (`seriesLang()`).
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
- A series edit that adds a translation does not count the texts missing in that language as new errors (`has no <lang> text`): they are the translation work, shown in Translate. Every other new error still refuses the save.
- A text missing in a language that is another document's is not counted against the document saved: a character's role or bio, a place's name, or the arc a story copies from its season. A story that names them reports them, but its save, a new episode's too, is not refused for them while that document is not in the edit.

**Refused with 403 when read-only.** That is the default, and on the samples a save needs `--write`.

**Thumbnails.** A thumbnail goes stale only when the opening picture changes: the opening scene, place, props, cast or looks (`sahne-gallery/thumbs.mjs`). A fix to a line's words leaves it as it was. `GET /api/thumbs` lists the stale ones, with the command that shoots them.

## The assistant in the editor (`src/ui/assistant.ts`, `src/ui/settings.ts`)

- **A drawer beside any page** (✦ in the top bar, or *Open the assistant* in the palette): a conversation whose context is what is open (the page, the episode, the selected block, from `POST /api/selection`). Its answer streams in and shows its work (`src/ui/chat/parts.ts`): its thinking streams open in a muted block and folds to "Thought for 12s" once the answer moves on; its tool calls are grouped, one group per run, with a line saying what they did ("2 reads · 1 check · 1 edit"), open while they run, then folded. Each call is a row in plain words ("Read episode s1e01", "Edited s1e01 · step 3: tr": `src/model/tools.ts`, which the Agents page's activity log uses too), with its icon, a spinner turning to ✓ or ✕, and its time; opened, it shows what the call was given and what came back. A live line says what it is doing now. **Stop** ends the answer, and nothing more runs after it, not even a tool already asked for; an error has **Try again**, which replaces the failed exchange. Its edits arrive as proposals above the script (or are written, in direct mode), never as hidden changes. A proposed new episode (`create_episode`) opens as a preview of what it would be (titles, place, cast, date, the check's problems, its steps), with Accept, which opens it as a new unsaved episode, and Reject, which drops it with every edit built on it (`ProposedEpisode`). A proposal in the conversation links to where it is answered. Pictures and text files can be pasted or dropped into the composer: a picture goes beside the message (four at most, up to 5 MB, PNG, JPEG, WebP or GIF), a text file into it; a kept conversation keeps their names, not the files. The tools' pictures go back each round as they were sent: Claude signs its thinking against the whole conversation before it, so an earlier message may never be rewritten (and the request's cache needs it unchanged too). **It remembers** what lasts (`server/memory.ts`): its own tools `remember` and `forget` keep short notes in `.backstage/memory.json` (at most 100, never one that looks like a key), every note is in its instructions, the chat says "Remembered: …" with Undo, and Settings lists them to delete. After it read the web in an ask, a note waits for the person's yes on a card, and in direct mode its edits become proposals for the rest of that ask. The assistant can ask you with buttons (`ask_person`, its own tool: two titles, which week), which ends its turn, your click being your next message; the card can also offer its proposals to accept and save at once. Answers are drawn as Markdown (`src/ui/md.ts`).
- **What it can and cannot do** is behind the **?** atop the panel (beside its tabs, on the Assistant tab): a popover with the two lists. The model is picked in the composer, and only there (Claude Opus 5.5 or Sonnet 5.5; or a local server's models, listed by `GET /api/models` from LM Studio's own list, loaded or not, with each one's context and whether it sees pictures, or from `/v1/models`, and any other id typed in; started with `--ai-model`, the menu says the model is set there and keeps it; a pick saves it in the settings, where the provider is chosen; a model of the other provider is dropped when the provider changes), and a new conversation offers its asks as chips. They come from `src/model/abilities.ts`, which the system prompt holds too, so the model and the person read the same lists, for the current mode (read-only, proposals, direct) and the page open: they start with what it can and cannot do there (this episode; this season on the board; this place, whose marks and props it can change but whose set pieces you arrange; this character, whose look you shape).
- **Conversations are kept in this browser** (localStorage, per series; never on the server). The last one opens again after a reload; *New conversation* keeps the one before; *History* lists the newest 30, to open again or delete. What is kept is trimmed (the thinking shortened, tools' results left out), and the oldest go when the browser's storage is full.
- **Asks where you work**, by the page open (`ASKS`), in a new conversation and in the episode's *Ask*:
  - an episode: fill the missing translations, simplify this line, suggest staging for this line, propose choice options, check this scene, draft this episode from its brief, and *Second reader*, which reviews in a fresh conversation that never saw the drafting;
  - the board: what needs work this season, and propose an episode for the next free day;
  - a place: which episodes are set here (and which marks and props none uses), and scene ideas for it; the places: which suits a scene;
  - a character: how they speak, and where they appear; the cast: who suits a scene; review: what to review first.
  The context sent is the page and what it shows (the episode, the board's season, the place, the character), and the selected block only while its page is open.
- **A big ask waits for a yes:** the server says what it would cost (`confirm`), and *Go ahead* sends that message again, once and with its pictures. Only the last answer's card offers it: one left behind by a later message answers nothing.
- **The meter** in the top bar is today's spending against the day's cap (its title: the month's, and the tokens); it follows the `usage` events.
- **Settings** (`#/settings`; its *Raw JSON* switch shows the file as saved, read-only and in colour, `src/ui/kit/json.ts`): Claude (its key from the environment) or a local model by its base URL (LM Studio, Ollama), the caps per day and month in dollars and in tokens, the cost above which an ask waits for a yes, the web (on through Tavily, or off, with which is in effect), and whether the rules' staging suggestions are taken as you leave each line. How agents' edits land is on the Agents page. They are kept in the person's config folder, never in the content root.

## Review notes (`server/review.ts`)

Review state is editors' notes, so it is not part of a story: a story's root takes no extra keys. It lives in a sidecar beside the content, `<root>/.backstage/review.json`, at sahne-story's `paths.ts` `REVIEW`. The assistant's memory is in the same sidecar, `<root>/.backstage/memory.json` (`MEMORY`): shared by everyone who works on the series and committed with it, so it holds lasting decisions, never what one person spends or a secret.

```json
{ "v": 1, "episodes": { "s1e01": { "status": "approved", "sig": "9f8e7d6c", "ai": true, "reviewer": "…",
  "steps": { "4": { "reviewed": true, "checked": ["en", "fa"], "sig": "1a2b3c4d" }, "12.0.1": { "reviewed": true } },
  "comments": [{ "id": "…", "at": "4", "by": "…", "text": "…", "date": "2026-10-29 10:00", "done": true }] } } }
```

- **Status** is `draft`, `reviewed` or `approved`. **`sig`** is the episode as it was approved (`episodeSig`): a later change shows as changed since approved.
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
- **From the shell**, with no MCP set up: `server/call.ts` (below) calls any tool and saves its pictures as files.

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
| `series_overview` | The series: titles, languages, how its episodes play by default (`play`), the story plugins it turns on (`plugins`), narrator, stand-in, seasons with their episodes, and whether and how it can be edited |
| `list_episodes` `{ season? }` | The episodes, with title, kind, date, place, cast and draft |
| `read_episode` `{ id, raw? }` | The episode as a script: one line per step, option and reply, each with its path, speaker, main text, translations and staging; the quiz; the `mtime`. `raw` adds the JSON. In proposals mode it is the episode as the agent would edit it, its own pending proposal included, with a line saying so; `read_step` and `check_episode` read the same |
| `read_step` `{ id, path }` | The JSON at a path |
| `kit_search` `{ kind?, query?, limit?, family?, tag?, as? }` | Characters, places (with marks and props), the kit's props and set pieces (kind `set`; no `kind`: both together; each `{ id, family, as, about, variants, tags }`, filtered by `family` (`series` for this root's own drawings), `tag` and `as`), gestures, emotions and sounds (`sahne-kit` `full`, with this root's kit items) |
| `kit_read` `{ id, as? }` | A set piece or prop: its family, params (in the text a line each: type, values, default), variants, motions (each kind with its period) and where its source is (a TypeScript generator's `file`, the `line` its definition starts on, and `from`..`to`, the lines it spans with its comment above; never the text, so the answer stays short) or its document and `mtime` (a drawing of this series; `<of>.<x_name>` reads a variant document), with its sheet as a picture |
| `kit_render` `{ id \| doc \| items, as?, params?, variant?, vary?, t?, frames?, focus?, views?, seeds?, zoom? }` | Numbered cells on a PNG (24 to a picture, a picture per seed) of a kit item or of a drawing not yet saved (`items`: a list of ids or `{ id \| doc, as?, variant?, params?, vary?, t?, frames?, focus? }`, up to 96 cells), with `checkPiece`'s problems once a generator: default, variants, and for a prop `n 3` and held, by day and night, each cell with its scale under it. `vary` `{ "<param>": [values] \| "all" }` (also `variant`, `n`, `held`) draws a cell per value, every combination of several; `t` (ms, or a list) or `frames` draws moving flats mid-motion; `focus` crops to a box of cm; `zoom` `auto`, `scene` or `fit` (*Piece sheets as PNG*). The text names what each number shows, each item's motions, and as `warning [inert]` a param that drew the same as without it, with the param that makes it show (money's `currency` needs `kind: foreign`). Strict: a key in the wrong place is refused with where it goes (`currency is a param of money: put it under params`), an unknown id names the closest; in a list, an item it cannot draw is a red cell and an error, and the rest are drawn |
| `draft_kit_item` `{ doc \| docs, as?, vary?, t?, frames?, focus?, views?, seeds?, zoom? }` | Check a drawing (`docs`: several, together, on one sheet; the same drawing twice is one) as it would be saved (schema, `x_` id, caps, paths, `$param`s, `checkPiece`) and render its sheet, as `kit_render` draws. Writes nothing. A drawing that cannot be drawn is answered with what to fix: the schema's complaints, each once, and a hint at the usual mistake (a stroke is `{ color, width, cap? }`, a shape with no fill leaves `fill` out, the forms of a colour) |
| `draft_variant` `{ of, name, params, views?, zoom?, t?, frames?, focus? }` | The same for a variant `{ of, name: "x_…", params }`: `paramProblems` and its sheet beside the default |
| `save_kit_item` `{ doc, mtime? }`, `save_variant` `{ of, name, params, mtime? }` | Save the drawing (`kit/pieces/<id>.json`) or the variant (`kit/variants/<of>.<name>.json`) through the same `submit()` as any edit: a proposal in proposals mode, or the file written at once in direct mode (`call.ts --write`), answering its `mtime`; the tool's description says which mode this server is in. Refused on an error, an id without `x_`, an id already saved (unless the `mtime` `kit_read` gave is passed), or a file changed since |
| `promote_kit_item` `{ kitId, id, family, by, contact, consent, story?, pr? }` | Offer a saved drawing to Sahne as official art, credited to its author (sahne-kit's DRAWING.md *Promoting*, `sahne-kit/drawing/promote.ts`): the official checks on the drawing under its new `id` (an unused snake_case id, a family that takes drawn items and stays in budget, shelved tags, a real `about`, words as text with a language, a set piece at 3 px/cm or less), answered with the problems, the review sheet and the family comparison as pictures; nothing is written and nothing is published. `pr: true` is refused in every mode (a pull request grants a licence and is a person's own act): the result prints the `promote.ts` command the person runs, which opens it from a temporary clone (the author's fork when they cannot write) or leaves a `.patch` and the pull request text. The agent must ask its person for `by`, `contact` and `consent` (the person's, never the agent's: it means they release the drawing under CC BY 4.0 as their own work), and the tool's description says so. Refused without consent |
| `search_words` `{ query, limit? }` | With the lesson plugin: card ids and levels, and the word with `--share-cards`. Without it, it says the series has no target words |
| `check_episode` `{ id }` | The story check's problems for the episode |
| `look` `{ kind?: story \| place, id, step?, at? }` | A picture of the stage (PNG): an episode at a step, part way through it (`at`, default 0.4), or a place's wide shot, the agent's own pending proposal included. An open editor in view draws it (`server/look.ts`: a `look` event, the editor's `POST /api/look/<rid>`, once per id; an agent on stdio waits on `GET /api/look/<rid>`); with none, there is no picture |
| `suggest_staging` `{ id }` | The editor's own staging suggestions for an episode, with why (`suggest` from sahne-story, with the series' plugins, and `suggestionsOf`) |
| `search_lines` `{ query, who?, limit? }` | Every script line (as `read_episode` gives it) holding the words, in any language, optionally said by one character |
| `read_guide` `{ name: backstage \| format, section? }` | A guide's headings, or one section of it (`server/guides.ts`, the same guides as #/docs) |
| `check_season` `{ id }` | A season at a glance: each episode's date, review status, stage of the work (`standingFor`) and problems, the weekdays with no episode, the weeks with no theme |
| `find_uses` `{ kind: place \| character \| card, id, part? }` | The episodes that use a place, a character or a word card, with the paths that name it; with `part`, only those naming that mark or prop (`usesOf` in `server/content.ts`) |
| `read_doc` `{ kind: series \| season \| place \| character, id }` | The document as JSON with its mtime; in proposals mode, as the agent would edit it |
| `read_notes` `{ id }` | The episode's review notes |
| `edit_step` `{ id, path, patch, mtime? }` | A merge patch (RFC 7386) on the object at the path; the path `""` is the episode itself (its id never changes) |
| `insert_step` `{ id, at, step, mtime? }`, `delete_step` `{ id, path, mtime? }`, `move_step` `{ id, from, to, mtime? }` | Steps, options and replies in their lists |
| `set_staging` `{ id, path, staging, mtime? }` | Staging keys; refuses a language code (texts go through `set_texts`) |
| `set_texts` `{ id, path, texts, mtime? }` | Texts by language; only the series' languages |
| `create_episode` `{ season, id?, releaseDate, kind, week, place, cast, title, summary?, words?, lessons?, level?, play? }` | A new episode from `src/model/skeleton.ts`, for the kind of series it is (`words`, `lessons` and `level` only with the lesson plugin; `play` when it differs from the series' default), with its calendar row when the season has a calendar. The week must have an arc (`series_overview` lists each season's `arcWeeks`; a refusal names them, and `set_week_theme` gives a week one). In proposals mode the agent goes on reading and editing its proposed episode: each edit is the new episode proposed again, built on the last, with its calendar row. `comment`, `read_notes` and `set_review` reach it once it is accepted; `show` opens its preview |
| `set_calendar` `{ season, story, row: { date, kind, week }, mtime? }` | The season's calendar row and the episode's `releaseDate`, `kind` and arc, together |
| `edit_doc` `{ kind, id, path, patch, mtime? }` | A merge patch at a path of the series, a season, a place or a character (`""` the document itself, `"title"`, `"marks/door"`). Ids never change. A place or character is checked with the episodes that use it, so taking away a mark one stands on is a new error |
| `set_week_theme` `{ season, week, texts, mechanics? }` | A week's theme (its arc) in the season and in every episode of that week, each changed only at `arc` (the board's own rule: `themed` in `src/model/board.ts`) |
| `create_season` `{ n?, title, launch?, weeks? }`, `create_place` `{ id, name, from? }`, `create_character` `{ id, name, role?, bio?, level?, color? }` | A new season (the next number, its first weeks' themes), place (empty, or a copy of `from`) or character (their look starts as the stand-in's). In proposals mode each opens as a preview to accept or reject |
| `read_look` `{ id, section? }`, `set_look` `{ id, set?, colors?, mtime? }` | A character's look through Sahne's own builder (`server/looktools.ts`): `read_look` lists each field (body, face, hair, clothes, extras) with its choice, its options and each colour's palette, and the portrait; `set_look` makes choices from those (`"hair.style": "hair_long"`, or nested `{ hair: { style } }`), all or nothing, and answers with the new portrait; `from: "blank"` starts from the kit's default look instead (a new character's draft does, and chooses every section). A look is always one a person could make on the page. Its proposal shows the portrait before and after, and each field that changed by the builder's labels |
| `comment` `{ id, step?, text }` | A review comment. It is a note, not content, so it is written at once (with `--write`) in both modes |
| `set_review` `{ id, status }` | Direct mode: sets it (`approved` only once the episode is ready: every stage of its work done). Proposals mode: a person decides, so the assistant's call puts a card in the conversation that sets it with one click, and another agent is told to ask the person |
| `list_proposals` | The proposals waiting (the agent's own and others') and the latest 50 answered, each accepted, rejected or withdrawn |
| `withdraw_proposal` `{ id }` | Take back one of the agent's own waiting proposals, with the ones built on it. Agents of one client name share their proposals |
| `show` `{ id, step?, as? }` | The open editors go to the episode and step, or to a set piece or prop's card on the kit page (`show` event `{ id, step }` or `{ id, kit: "set" \| "props" }`) |

**The resources.**
- `sahne://format`: sahne-story's README.
- `sahne://languages`: the series' `languages`.
- `sahne://selection`: what the open editor last posted to `POST /api/selection`.
- `sahne://kit-guide`: sahne-kit's `DRAWING.md` and STYLE.md's *Paper*, *Places* and *Props*, read from the files: the format and the look a drawing must have.

**Drawing kit items** (`server/kittools.ts`). An agent adds a set piece, a prop or a variant to this content root's own kit, and looks at what it drew:
1. read `sahne://kit-guide`, then `kit_search` for what exists (`family`, `tag`, `as`);
2. `kit_read` a neighbour: its params, variants and where its source is (then read those lines of the file);
3. `draft_kit_item` (or `draft_variant`) and look at the sheet;
4. revise until there are no problems (`kit_render` shows any item by id or doc, one look or a cell per value of a param, day or night, mid-motion, cropped to a detail, other seeds);
5. `save_kit_item` (or `save_variant`);
6. use it in a place and run `check_episode`;
7. offer it to Sahne: ask your person for their name, a contact and their consent, then `promote_kit_item` (check and sheets), and hand them the command it prints to open the pull request.

- **Pictures.** A tool's answer is a text line, then any images (`{ type: "image", data, mimeType: "image/png" }`, from `server/render.ts`), then the data as JSON in the last block (`server/result.ts`). The editor's assistant sends them on to the model as image blocks in the tool result (Anthropic; the OpenAI-compatible provider is told that pictures are not shown).
- **TypeScript generators** are read when the process starts, so a render shows the source of the worktree it started from. `kit_read` and `kit_render` say when the kit's source changed after that; a new process sees it (a one-shot client that starts a process per call always does).
- **Kit item saves** go through `submit()`, so `--write`, proposals and direct mode and `--backstage` forwarding behave as for an episode. A proposal's `kind` is `kit_piece` or `kit_variant`.

**Proposals** (`server/proposals.ts`, one queue per backstage process). The server keeps it in the person's store (`server/runs/store.ts`: `node:sqlite`, one file per content root at `<config>/runs/<hash>.sqlite`, never in the content root), so what is pending, what was answered and the next id outlive a restart. The stdio MCP server and the tests keep theirs in memory.
- A proposal is `{ id, kind, doc, next, base?, create?, also?, paths, summary, by, at, problems, after?, step? }`:
  - `next` is the whole proposed document, `base` the mtime it was computed from, and `create` marks a new document;
  - `also` lists the documents that change with it, each `{ kind, doc, next, base?, create?, paths? }` (a season's calendar with its episode). They are saved in the same save. A carried document's `paths` are its own changed places (`["calendar", "s1e04"]`; a story's `releaseDate`, `kind` and `arc`): accepting sets only those, so neither a person's unsaved edits nor an earlier accepted proposal on it are undone;
  - `paths` are the changed places, and `by` is `assistant`, `run:<id>` (a run of the assistant, every step of it) or the MCP client's name (`src/model/who.ts` says it for a person);
  - `problems` is the check of `next` and `also`.
- **A proposal is refused as a save would be**, whatever the check says: an id changed, an extra edited, a new id that is taken (`refuse` in `server/content.ts`).
- **They compose simply.** An agent's proposal is computed from the file plus that agent's own latest pending proposal on the document. `after` names that proposal. So each proposal holds the ones before it:
  - accepting one also resolves those it was built on;
  - rejecting one also drops those built on it.
  A document the agent's pending proposals only carry (the season a new episode's calendar row goes in) is read as the latest of those, so its next proposal builds on it instead of undoing it. Different agents' proposals are independent, each against the file.
- **The same author proposing the same documents again** gets the proposal there is, not a second one (a step of a run that starts over after a restart).
- **An author's pending documents are there for its next edits.** The check takes them as there though they are not on disk (`check(edits, context)` in `server/content.ts`), and `create_episode`, `kit_search` and `suggest_staging` see its pending season, characters and places. So a run's episode can be set in the place the same run proposed.
- **One author's tool calls run one at a time** (`inTurn` in `server/mcp.ts`), whichever server they come through, so two steps of a run editing one season never undo each other's edit. `look`, which waits on an open editor, is left out.
- **The browser applies an accepted proposal itself**, as an edit (Undo, the check, Save). Backstage never saves a proposal. *Accept and save* does both in one click; when the document already has the person's own unsaved edits it asks first, since they are saved too (`acceptAndSave` in `src/events.ts`). An editor with unsaved edits of the same document applies only the proposal's `paths`, so nothing typed is lost.

**In the editor** (`src/events.ts`, `src/ui/studio/proposals.ts`, `src/ui/proposed.ts`). The page listens to `/api/events`:
- **A proposal** shows above its episode's script: who proposed it and what, its steps step by step, its other changed places with their words before and after (word by word), the errors it would bring, and *Accept* or *Reject*. One of a season or the series shows on the board, one of a place on its page, one of a character on theirs (`ProposalsStrip`: each changed place, before and after, in words where it is words). A proposed new place or character opens as a preview, with *Accept and open* and *Reject* (`ProposedDoc`). The top bar counts the proposals waiting and links to the first; links to a proposal (the top bar, the Agents inbox, the assistant's note) go to the page it is answered on (`hrefOf`).
- **The step diff** (`src/model/stepdiff.ts`, drawn by `src/ui/stepdiff.ts`) reads a new version of an episode's steps the way the script does, in the proposals bar, a proposal's card and the *Changes* tab. Steps are matched by an LCS over each one's kind, speaker and main-language words (normalized); a step lost in one place and found in another is *moved*, and a removed and an added step of the same kind and speaker with alike words (or alone, in the same place) are one *changed* step. So inserting a step leaves the rest *same*. A changed step is drawn as the script draws it: its speaker, its line and translations word by word, its staging as chips added and removed, and a scene, beat, choice, act or spot in a few words before and after; *Pictures* draws the stage at the end of the step, before and after (`cueThumb`, lazily). A summary counts what was added, removed, changed, moved and restaged, each a link to its first step; unchanged runs fold to "… 6 steps unchanged". When the episode is new, or more than half of its steps are not the same, it links to the episode's preview instead (`#/episode/<id>/proposal/<n>` reads an existing episode's proposal as a whole there), with *see it step by step* beside it. A proposal is diffed against the episode as it is open, and as accepting it would leave it: with unsaved edits of the person's own, only the proposal's places are taken, so the diff shows only those (`afterAccepting`). The *Changes* tab always draws the steps, never the link: the episode is the one open.
- **A direct write** reloads a document that has no unsaved edits here; one that has them gets a banner instead, to take theirs or keep yours.
- **`show`** opens the episode at the step.
- **`activity`** is an agent's tool call, or null when an agent connects or goes, or the mode changes: the Agents page and the side panel read `GET /api/agents` again.
- **The selection** is posted to `/api/selection` a moment after it settles, for the agents' `sahne://selection`.

**The routes** (localhost only, as the rest of the API):

| Request | Answer |
|---|---|
| `GET /api/events` | `text/event-stream`, a keep-alive comment every 20 s. Events: `proposal` `{ action: "added" \| "resolved", proposal, accepted?, with? }`, `doc` `{ kind, id, mtime, by? }`, `show` `{ id, step }` (a path, or null) or `{ id, kit: "set" \| "props" }`, `usage`, `activity` `{ at, by, tool, ok, ms, summary }` or null |
| `POST /api/look/<rid>` `{ image }` | An editor's picture for an agent's `look` (a PNG data URL), taken once; 404 for an id answered or never asked |
| `GET /api/look/<rid>` | `{ image }` (base64, or null after the wait): what an agent on stdio waits on |
| `GET /api/memory`, `POST /api/memory` `{ text }`, `DELETE /api/memory/<id>` | The assistant's notes; writing needs `--write`, a note that looks like a key is refused (400) |
| `GET /api/proposals` | `{ proposals, resolved }`: the waiting ones, and the latest answered |
| `POST /api/proposals` `{ kind, doc, next, base?, create?, also?, paths, summary, by, after? }` | `{ proposal }`: one queued from another process (`cli.ts mcp --backstage`), checked here; 403 when read-only |
| `POST /api/proposals/<id>` `{ accepted }` or `{ withdraw: <agent> }` | `{ resolved: [ids] }`: the person's answer (the browser applies an accepted one itself), or an agent on stdio taking back its own; 404 for an unknown id |
| `POST /api/selection` `{ page, kind?, id?, path? }`, `GET /api/selection` | The editor's selection, for the `selection` resource |
| `POST /api/events` `{ event: "show" \| "doc" \| "activity", data }` | Another process tells the open editors what it did (`cli.ts mcp --backstage` sends its tool calls as `activity`). A `doc` event also makes this server read the root again |
| `GET /api/agents` | `{ mcpUrl, cli, content, write, writable, agentEdits, shareCards, sessions, editors, activity, pending, tools }`: the Agents page (`server/agents.ts`: the HTTP sessions and the last 200 calls, in memory) |
| `POST /api/agents` `{ agentEdits }` | The mode for agents that connect next, kept in the settings; answers as the GET |
| `/mcp` | The MCP server (Streamable HTTP) |

## The assistant, providers and the budget (`server/assistant.ts`, `server/ai/`, `server/settings.ts`)

**The assistant** is an agent on the server, a LangGraph graph (`server/agent/graph.ts`, `@langchain/langgraph`) over a LangChain chat model. It reaches backstage only as an MCP client of its own MCP server (`createMcp`, over an in-memory transport), so it uses the same tools and checks as any agent.
- Its edits are made `by: "assistant"` and follow the agent-edits mode. That is the settings' `agentEdits`, else the server's `--agent-edits`, so proposals by default.
- Its system prompt is built from the series: the title, the main language and the translations (and which run right to left), the narrator and the stand-in, a summary of the format, and how edits are made. Nothing in it belongs to one language.
- It also holds what the assistant can and cannot do (`src/model/abilities.ts`, the lists the panel shows), and tells it to say plainly when it is asked for something it cannot do, and where the person can do it, rather than write as if it did.
- **The second reader** is `fresh: true`: a new conversation of the person's last message alone. It never sees the drafting history, and it is told to comment rather than change.
- **A big ask** (drafting or reviewing a whole season, or every episode) is estimated first. If it would cost more than `confirmOverUsd`, or use more tokens than are left today, nothing runs: the answer is a `confirm` event, and the editor sends the request again with `confirm: true`.
- **The graph** has three nodes. `model` streams one turn (text and thinking go to the editor as they come). `tools` runs the turn's calls through the MCP client. `ask` puts `ask_person` to the person by itself, so answering never runs an edit twice. A turn is kept exactly as the model sent it, and nothing earlier is rewritten. The rounds are capped at 40 (`MAX_TURNS`).
- When the browser closes the request, the model's request is aborted, so a closed tab stops spending.

**The models** (`server/ai/models.ts`), as LangChain chat models. Every request goes through `net` (`server/ai/provider.ts`), which the tests stub; a stubbed network is never retried, a real one twice.
- **Claude** (`ChatAnthropic`, `@langchain/anthropic`). The key from `ANTHROPIC_API_KEY`, streamed, with adaptive thinking, its summary shown (`display: "summarized"`), and the request cached (one top-level `cache_control`). No `temperature`, `top_p`, `top_k` or forced `tool_choice` is sent.
  - The models live in one place (`MODELS`): `claude-opus-5-5` for an ordinary ask, and `claude-sonnet-5-5` for a quick one (`quick: true`). The settings' `model` replaces the first.
  - A tool loop sends each turn back as it came, thinking blocks and their signatures included.
  - A refusal, an API error or an answer cut off is an `error` event, and no tool of that turn runs.
- **OpenAI-compatible** (`ChatOpenAI`, `@langchain/openai`). Any `/v1/chat/completions` server with `tools` and `tool_calls`: LM Studio (`http://localhost:1234/v1`, the default), Ollama (`http://localhost:11434/v1`), or llama.cpp's server (`http://localhost:8080/v1`).
  - `OPENAI_API_KEY` is sent as a bearer token when the environment has one.
  - Without a `model`, the request names `local`, and LM Studio uses the model it has loaded. Ollama needs one.
  - A reasoning model's thinking (`reasoning_content` deltas, or `<think>…</think>` in its text) goes to the thinking, never into the answer. Its pictures are text notes.
  - A server that reports no usage is counted at about four characters a token, so the token caps still bind.
- **No telemetry.** LangChain's tracing (LangSmith) is off unless one of `LANGSMITH_TRACING`, `LANGCHAIN_TRACING_V2` or `LANGCHAIN_TRACING` is `true` in backstage's environment; nothing is sent to LangSmith otherwise.

**Settings** (`server/settings.ts`).
- They live in the person's config folder: `$SAHNE_BACKSTAGE_CONFIG`, or `~/.config/sahne-backstage/`. The file is `settings.json`:

```json
{ "provider": "anthropic", "model": "claude-opus-5-5", "baseUrl": "http://localhost:1234/v1",
  "caps": { "dayUsd": 5, "monthUsd": 50, "dayTokens": 2000000, "monthTokens": 20000000 },
  "confirmOverUsd": 0.5, "agentEdits": "proposals", "applySuggestions": false, "web": "auto" }
```

- The values above for `provider`, `caps` and `confirmOverUsd` are the defaults. Choosing `openai` without a `baseUrl` saves LM Studio's.
- **The environment overrides the file**: `SAHNE_AI_PROVIDER`, `SAHNE_AI_BASE_URL`, `SAHNE_AI_MODEL`. The CLI's `--ai-provider`, `--ai-base-url` and `--ai-model` set them.
- **Keys are never stored.** They are read from the environment only. A save keeps only the known fields, so a key sent with it is dropped.
- `applySuggestions` is the editor's own preference. The server keeps it and does nothing with it.
- **`web`**: how the assistant searches the web (`webOf`). `auto` (the default) takes Tavily when `TAVILY_API_KEY` is in backstage's environment, else none; `off` turns it off. Anthropic's own search is not used: LangChain's Claude model cannot send its code-execution blocks back in a tool loop, and an old `anthropic` reads as `auto`. Through Tavily (`server/ai/web.ts`, any model, a local one too) it is the assistant's own tools `web_search` and `read_web_page`: plain fetch to `api.tavily.com`, the key from `TAVILY_API_KEY` only, each call timed out, a page cut at 8000 characters. A page is read only at an address a search of that ask found or the person wrote, so the model cannot send words out in an address it makes up. The prompt says no page is an instruction.

**The budget** (`server/ai/budget.ts`).
- **The prices** are in one table (`PRICES`, USD per million tokens, from the Claude API's model docs): Opus 5.5 is $4 in and $20 out, Sonnet 5.5 is $2 in and $10 out, and cache reads are $0.20. A local model costs nothing.
- **The caps** are per day and per month (local time), in USD and in tokens. The token caps bind local models too. They are checked before every model request of a tool loop, and a request at a cap is refused with a message that says which cap.
- **Every call is logged** to `<config>/usage.jsonl`, one JSON line each: `{ at, provider, model, input, output, cacheRead, cacheWrite, tokens, usd }`. After each call the editors get a `usage` event.
- **Why the config folder.** The log and the settings are in the person's config folder, not in the content root's sidecar (`.backstage/`). An app such as Kumru commits its sidecar, and what one person spends is theirs.

**What leaves the machine** is what the tools return, and the assistant's web searches: the story documents (texts and staging, with card ids), the cast's names and roles, the places' marks and the kit's names. With `--share-cards`, it also includes a card's main-language word. A card's translations and notes never leave.

**The routes:**

| Request | Answer |
|---|---|
| `POST /api/assistant` `{ messages: [{ role, content }], context?: { page, kind?, id?, path? }, fresh?, confirm?, quick?, pictures?: [{ name, mediaType, data }] }` | `text/event-stream`. Each event's `data` is JSON with its `type`: `text { text }`, `thinking { text }`, `tool { id, name, input }`, `tool_result { id, name, ok, summary, detail, ms }` (`detail`: the result, at most 4000 characters), `proposal { id }`, `ask { question, options?, save?, review? }` (a card for the person: buttons that answer, proposals to accept and save, a status to set), `confirm { estimateUsd, why }`, `done { usage: { input, output, usd } }`, `error { message }`. 400 for a malformed request |
| `GET /api/settings`, `POST /api/settings` `{ … }` | `{ settings, file, overrides, keys: { anthropic, openai }, ai }`. `keys` says whether each key is set, never the key. A POST merges over the file |
| `GET /api/usage` | `{ today: { usd, tokens }, month: { usd, tokens }, caps }` |
| `GET /api/world` | Also `ai`: `false` when the assistant cannot run, else `{ ready: true, provider, model }`. It is ready with Anthropic when `ANTHROPIC_API_KEY` is set, and with OpenAI-compatible when a base URL is set. The network is never probed for it |

## Tasks: long tasks as steps (`server/runs/`)

A task (called a *run* in the code, the API and the store) is a long piece of work (a week of episodes, with the new cast and places they need) as a plan of steps. Each step is done by a sub-agent with a fresh context: the agent graph (`server/agent/graph.ts`) on a LangGraph thread of its own, checkpointed in the store.
- **A plan** is `{ brief, steps: [{ id, kind, title, brief, needs?, owns?, model? }] }`. `kind` is `plan`, `season`, `character`, `place`, `episode`, `review` or `task`. `needs` names the steps whose reports it reads first. `owns` is the documents it creates or changes (`{ kind, id }`). `planProblems` refuses ids that are not `a-z0-9_` or are there twice, needs that are not steps or make a cycle, and a document two steps would make.
- **Two modes** (`mode`), both writing straight in: every write is saved after the same check as a person's Save and journaled, so any of it can be undone (below). `check` (*Check with me*): the plan waits at its gate, and after that a step asks (`ask_person`) only when the goal leaves a real choice open or it needs the person's reply, never to confirm making something. `auto` (*Just do it*): no gates, and `asks: "never"`: its steps have no `ask_person`, decide a choice themselves and say in their report what they chose. The default is the settings' `runMode` (`check`), which the start card sets to the last choice and Settings shows under *Long tasks*. The server's `--agent-edits` is for its other agents; a task proposes only when created with `agentEdits: "proposals"` (an older task may have), and then its work waits as proposals.
- **A run from its goal alone plans itself.** Its first step is a `plan` step (Opus): it reads the series, the season, the cast and places, may ask the person (names, which season), and ends with `propose_plan { brief, steps }`. A plan that does not hold is refused with why, and it proposes again. Every step it plans needs it, so each reads its report. The plan then waits at the plan gate with its estimate (`estimate`: a rough cost by step kind, on Claude), and the person may change it there (`{ action: "plan", plan }`). The budget is three times the estimate (at least $2) unless the person set one.
- **The assistant offers a task** for a long task (`start_run { goal }`, its own tool): the chat shows a card with the goal, *Check with me* or *Just do it* (the last choice first) and a budget; starting opens the task. The turn ends there. The season board's *Plan a week of episodes* asks for one.
- **One author.** Every step edits as `run:<id>`, so each builds on the run's pending proposals, and each proposal names its `step`. A step creates or changes only what it `owns`; a season, the series and kit drawings are shared, one call at a time (`inTurn`). Anything else is refused with what the step makes.
- **A step starts fresh**: the run's goal and the plan's brief, its own brief, what it makes, and the reports of the steps it needs. It ends with `finish_step { summary, decided? }`, its report for the steps after it, which ends its graph. `decided` is the choices it made that the goal left open, a plain line each ("Named her Defne, not Deniz"): a task that just does it must list them, and the person reads them beside what it made. It may `ask_person`: the step waits for the answer (a LangGraph `interrupt`), and the others go on.
- **The scheduler** (`Runs`, `server/runs/run.ts`) starts every step whose needs are done, up to `concurrency` at once (3 on Claude, 1 on a local model), as soon as it can. It does not wait for a batch.
- **Gates** wait for the person: `plan`, before any step runs, and `castAndPlaces` (off unless asked for), after the season, character and place steps and before the rest. Either can be off (`gates: false`, or one of them). With them off the task goes straight through.
- **Reviewing a proposing task by step.** A step's proposals are answered together in its row (*Reject the step's*, *Accept the step's*, *Accept and save*). Accepting a run's proposal, there or on any card, first accepts the proposals still waiting of the steps it needs, oldest step first (`neededFirst` in `src/events.ts`), so an episode's save never meets a character that is not there; the card says what it takes with it. Turning a step's proposal down marks that step and the finished steps built on it `stale`; a proposal that needs a stale step cannot be accepted until it is done again. *Do it again* (`{ action: "redo", note?, owns? }`) starts a step over from its brief, with the person's note added, building on its proposals still waiting; `owns` changes what it makes (an id that cannot be made, such as a retired one), and the finished steps after it are marked for a redo too.
- **Where the work lands** (`src/model/marks.ts`, `marksOf`: by document, the task and step making it now or that made it). The board's episode cards and rows, and the Cast's and Places' cards, say *being made* (with a breathing dot and a light sweeping over the card) or *✦ by a task*; a person or place being made that has no file yet is a dashed ghost card that leads to the task. An item's page (`src/ui/madeby.ts`) says *A task is writing this now* with what it does, warning when you have unsaved edits there, or *Made by a task* with its step's plain line, what it decided, *Undo* and *See the task*. While a task works and none waits for you, the top bar has a chip, *A task is working · its step*, and the rail's Agents has a breathing dot.
- **Pause, and telling a step something.** *Pause* (`{ action: "pause" }`) starts no step, and a working one waits before its next model call (`Agent.before` throws `Paused`), its tool calls done; *Go on* (`continue`) starts them again from their checkpoints. *Tell it something* beside a working step (`POST …/steps/<step>` `{ action: "tell", text }`) queues a note (`told`); its agent reads it before its next model call as the person's message (`Agent.inbox`, in `server/agent/graph.ts`), and its log shows *You said*.
- **Time left, what changed, and failures in words.** While it works, the progress line says about how long is left (`src/model/eta.ts`: the done steps' average, over the steps left, as many at once as it runs; steps keep `startedAt` and `endedAt`). In *What it did*, a document the task changed but did not create has *What changed* (`src/ui/whatchanged.ts`): an episode as the step diff, anything else field by field, against its text before the task (`GET /api/runs/<id>/before?kind=&id=`, `{ before, now }`, `Journal.before`); the last row, *Before this task*, restores it all, as *Back to before this task* does. A failed or stopped step says why in plain words and what to do, its own error folded under it.
- **What a run writes can be undone** (`server/runs/journal.ts`). Every save a run's step makes in direct mode is journaled in the run store: each document's file text before it (none when it was created) and a hash of the text it left (`save()`'s `before` hook in `server/content.ts`, through `submit`). `{ action: "undo", items? }` works document by document: from the run's newest write of it back through the writes being undone, while the file still holds what the newest left, it gets the text from before the earliest of them (or goes, if the run made it). A document someone changed after the run, or one a step not being undone wrote over, is kept and said; a file only touched (its mtime) is still the run's. With `items` it undoes those documents and everything the steps after theirs wrote (undoing a character undoes the episodes built on her, and their rows in a shared season, which comes back exactly as it was before them); without, the whole run. A step none of whose writes are left is `undone`, and may be done again. `GET /api/runs` gives each run's `made`: the documents it wrote and can still undo, the step that made each, and whether the run created it.
- **Failures stay small.** A step that fails tries once more from its last checkpoint, then waits for *Try again*. A step a budget stopped (the run's, or the day's or month's cap) is marked `budget` and goes on by itself once the budget allows: when the person raises the run's, or the run is looked at again after the cap has room. A stopped step waits too. The run is paused, saying which steps need the person, while nothing else can go on. `maxUsd` (default $10) pauses the run when it is spent, until it is raised.
- **It outlives a closed tab and a restart.** The runs, each step's log (its text, thinking, tool calls and results; `run_log`) and the checkpoints are in the store. When backstage starts, a step that was running goes on from its last checkpoint, and the dedupe of proposals keeps a step that starts over from proposing twice.
- **The checkpoints** (`server/runs/saver.ts`, a port of `@langchain/langgraph-checkpoint-sqlite` onto `node:sqlite`) keep only a thread's latest checkpoint and the one before it, since a checkpoint carries the step's whole conversation, its pictures included. A finished step's thread is deleted.
- **Models**: Opus 5.5 for `plan` and `review` steps, Sonnet 5.5 for the rest (a step's `model` names another), or the local model.
- **The routes** (`server/http.ts`; a POST needs `--write`):

| Request | Answer |
|---|---|
| `GET /api/runs` | `{ runs }` |
| `POST /api/runs` `{ goal, plan?, gates?, maxUsd?, concurrency? }` | `{ run }`, started (without a plan, it plans itself); 400 with the plan's problems |
| `GET /api/runs/<id>` | `{ run }`: `{ id, goal, by, status (running, gate, paused, done, stopped), gate?, why?, gates, passed, maxUsd, usd, concurrency, agentEdits, brief, steps, made, did }`: `made` is each document it wrote and can still undo (`Journal.made`), `did` its writes oldest first, `{ step, kind, id, created, at }` (`Journal.history`); the list's runs carry both too |
| `POST /api/runs/<id>` `{ action: "undo", items?: [{ kind, id }] }` | `{ run, undone: [{ kind, id, removed, mtime? }], kept }`: what came back, and what was kept because it changed after the run |
| `POST /api/runs/<id>` `{ action: "continue" \| "pause" \| "stop" }`, `{ action: "gates", gates }`, `{ action: "budget", maxUsd }`, `{ action: "plan", plan }` | `{ run }`: past a gate or a pause, stopped, its gates, its budget or (at the plan gate) its plan changed |
| `POST /api/runs/<id>/steps/<step>` `{ action: "answer", answer }`, `{ action: "tell", text }`, `{ action: "stop" }`, `{ action: "retry" }`, `{ action: "redo", note?, owns? }` | `{ run }` |
| `GET /api/runs/<id>/before?kind=<kind>&id=<id>` | `{ before, now }`: the document's text before the task first wrote it (null if it created it) and now (null if gone); 404 if the task never wrote it |
| `GET /api/runs/<id>/steps/<step>/log?after=<seq>` | `{ events: [{ seq, event }] }`: the step's log, as the assistant's events |

The editors get each change as a `run` event: `{ run }`, or `{ id, step, seq, event }` for what a step does.

## The API (`server/http.ts`)

Every request must come from this machine: `Host` and `Origin` must be localhost, and a write must be `application/json`.

| Request | Answer |
|---|---|
| `GET /api/world` | `{ series, seasons, episodes, characters, places, days, cards, samples, writable }` |
| `GET /api/doc/<kind>/<id>` | `{ doc, mtime }`. The kind is `series` (id `series`), `season`, `story`, `character`, `place`, `kit_piece` (id `x_…`, a drawn set piece or prop) or `kit_variant` (id `<of>.x_<name>`) |
| `POST /api/check` `{ edits }` | `{ problems }`. An edit is `{ kind, id, doc, mtime?, create? }`, and each problem names its `doc` and whether it is `new` |
| `POST /api/save` `{ edits }` | 200 `{ saved: { "<kind>:<id>": mtime }, problems }`, or 400, 403, 409 or 422 `{ message, problems? }` |
| `GET /api/head/<kind>/<id>` | `{ doc }`: the document at git's HEAD, or null |
| `GET /api/thumbs` | `{ stale, command }` |
| `GET /api/cards?q=` | `{ cards: [{ id, tr, en, level? }] }`: up to 40 word cards matching the search, read live (the word picker) |
| `GET /api/lessons` | `{ lessons: [{ id, ref? }] }`: the grammar lessons, when the root has them |
| `GET /api/kit` | `{ docs, problems }`: the content root's own kit items that are good (the stage adds them with `withDrawings`), and a line for each file that is not |
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
  - `mcp.ts` (the MCP server: its tools and resources), `kittools.ts` (its kit tools: search, read, render, draft and save kit items), `result.ts` (what a tool answers: text, pictures, data), `render.ts` (SVG to PNG), `call.ts` (any tool from the shell, with sessions), `proposals.ts` (agents' edits waiting for a person), `runs/` (`store.ts`: what lasts across a restart; `run.ts`: runs and their scheduler; `saver.ts`: their checkpoints), `events.ts` (the editors' event stream and selection) and `agents.ts` (the connected agents and their calls);
  - `assistant.ts` (the assistant and its system prompt), `agent/graph.ts` (an agent as a LangGraph graph), `agent/tools.ts` (its backstage tools), `settings.ts` (the person's AI settings), and `ai/`: `models.ts` (the LangChain chat models, the local server's models), `provider.ts` (tools, pictures, errors, the network), `web.ts` (Tavily) and `budget.ts` (the prices, the caps and the usage log).
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
