# What's new

## Sahne 0.2: Backstage, a studio for the whole series

<video controls preload="none" playsinline poster="assets/whats-new/backstage-poster.jpg" style="width:100%;border-radius:12px"><source src="assets/whats-new/backstage.mp4" type="video/mp4"></video>

Until now, Sahne played what someone had written by hand in JSON. **Backstage** is where a series is now made: a studio in the browser for writers, directors and reviewers who don't program. AI can help at every step, and nothing reaches the learner until a person has approved it.

### Why

An illustrated dialogue scene usually takes a writer, an illustrator, an animator and an editor, and every change goes round all four again. That is why language apps show so few scenes, and why those scenes are rarely fixed or translated. In Sahne the script *is* the scene, so a scene can be changed as easily as its text. Backstage puts that power in the writer's hands:

- **One person can make a scene.** Type the lines, and the stage beside them plays them as you type: who says it, to whom, with what gesture and from which shot.
- **Mistakes are cheap.** Every save passes the same checks as the project's own gate. Undo is always there, and so is the diff against the last commit.
- **AI helps, people decide.** The assistant and outside agents propose, and you accept. Long work runs as a task you can watch, pause, steer and undo, down to *Back to before this task*.

### How it works

- **A season is a board.** Weeks are rows and days are columns, with an episode on its release day. Drag a card to move its release, or click an empty day to start a new episode from three picks: where (a place, by its picture), who (the cast, by their portraits) and what it is about.
- **An episode follows the stages of the work:** Brief, Script, Translate and Review, each with the one next step.
  - **Script** is a screenplay beside a live stage. Enter alternates the speaker, and `(waves, happy, to İsmail)` becomes staging.
  - **Staging fills itself in.** Grey chips show what the director will do on its own. Dashed chips are the rules' suggestions, taken with a click. In *Direct* mode you click a person on stage for a gesture, or drag them onto a mark.
  - **Translate** shows every language of the series, each in its own direction.
  - **Review** goes one block at a time beside the stage, then approves the episode. An approval is signed, so a later change sends the episode back to review.
- **Needs you** gathers what waits for a person, each item dealt with in place: problems with their fixes, missing translations, staging ideas, comments and agents' proposals.
- **The assistant** sits beside every page. It runs on Claude or on a model on your own machine (LM Studio or Ollama), within a daily and monthly budget. It can look at the stage, search the web, and remember lasting decisions for the series.
- **Any agent can join** over MCP, Claude Code among them. Every tool goes through the same checks, and its edits arrive as proposals.
- **Tasks** carry the long work, such as "a new season with its cast, places and episodes". A task plans itself, then each step is done by its own agent. It goes on with the editor closed, and every write can be undone.

[Get started with Backstage →](get-started.md#write-and-stage-episodes-in-backstage) · [The whole studio, page by page](../../sahne-backstage/README.md)

## Every language

- **English, German and Persian** join Turkish as language plugins ([en](../../sahne-en/README.md), [de](../../sahne-de/README.md), [fa](../../sahne-fa/README.md)). Each times the mouths from the spelling, says numbers and times aloud, and hears an answer spoken back. Persian runs right to left. Their rules were written from the grammar and still want a native speaker's check.
- **A series names its languages**: one main language, and the others as translations. Every title, name and line is kept in each of them, and a missing translation is caught by the check.
- **Each story language has its own lints**, such as *this* versus *that* for near and far things, or a time in a line against the clock on the wall.

## Stories that aren't lessons, and lessons as a plugin

- **Story plugins** add their own steps, fields, checks and editor parts to a series that turns them on.
- **Lessons are the first plugin**, [`sahne-lesson`](../../sahne-lesson/README.md): grammar spots, target words, glosses and the quiz. A series without it tells plain stories.
- **Watch-only episodes** play on their own, with no turns for the viewer.

## More kit, drawn by more hands

- **For stories across Europe:** a flag for every European country, boulangeries, bistros and pubs, trams, lamp posts, bistro chairs and pound and franc notes. There are also four new families: houses, transit, a bakery and a festival.
- **Drawing as data.** A story can draw its own items in its content root. Agents draw them through backstage's tools and look at the result as a picture.
- **Promotion with credit.** The best drawings move into the kit for everyone, with the artist's consent and credit ([Drawing kit items](../../sahne-kit/DRAWING.md)).

## Also

- Every package has a logo, from one generator.
- 993 tests, and a review that confirmed and fixed 65 bugs before this release.

## Sahne 0.1

The first release: the engine, the kit, the Turkish plugin, the story format and this gallery. [See it on GitHub](https://github.com/mehrad77/sahne/releases/tag/v0.1.0).
