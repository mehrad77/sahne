# What's new

Each release, newest first. The packages' `package.json` files carry the version.

## Sahne 0.2

**Latest. Backstage: a studio for the whole series.** Also English, German and Persian, story plugins with lessons as the first, and more kit, drawn by more hands.

<iframe src="https://www.youtube-nocookie.com/embed/HlKaonCS_YE?rel=0" title="Meet Sahne Backstage" loading="lazy" allow="encrypted-media; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen style="display:block;width:100%;aspect-ratio:16/9;border:0;border-radius:12px"></iframe>

*Meet Backstage*, a 3½-minute tour, narrated in English, Türkçe, Deutsch and فارسی: pick the audio track and the subtitles under ⚙ in the player, or [watch it on YouTube](https://youtu.be/HlKaonCS_YE).

Until now, Sahne played what someone had written by hand in JSON. **Backstage** is where a series is now made: a studio in the browser for writers, directors and reviewers who don't program. AI can help at every step, and nothing reaches the learner until a person has approved it.

### Why Backstage

An illustrated dialogue scene usually takes a writer, an illustrator, an animator and an editor, and every change goes round all four again. That is why language apps show so few scenes, and why those scenes are rarely fixed or translated. In Sahne the script *is* the scene, so a scene can be changed as easily as its text. Backstage puts that power in the writer's hands:

- **One person can make a scene.** Type the lines, and the stage beside them plays them as you type: who says it, to whom, with what gesture and from which shot.
- **Mistakes are cheap.** Every save passes the same checks as the project's own gate. Undo is always there, and so is the diff against the last commit.
- **AI helps, people decide.** The assistant and outside agents propose, and you accept. Long work runs as a task you can watch, pause, steer and undo, down to *Back to before this task*.

### How Backstage works

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

[Get started with Backstage →](get-started.md#write-and-stage-episodes-in-backstage) · [How agents write stories](writing-with-agents.md) · [The whole studio, page by page](../../sahne-backstage/README.md)

### Every language

- **English, German and Persian** join Turkish as language plugins ([en](../../sahne-en/README.md), [de](../../sahne-de/README.md), [fa](../../sahne-fa/README.md)). Each times the mouths from the spelling, says numbers and times aloud, and hears an answer spoken back. Persian runs right to left. Their rules were written from the grammar and still want a native speaker's check.
- **A series names its languages**: one main language, and the others as translations. Every title, name and line is kept in each of them, and a missing translation is caught by the check.
- **Each story language has its own lints**, such as *this* versus *that* for near and far things, or a time in a line against the clock on the wall.

### Stories that aren't lessons, and lessons as a plugin

- **Story plugins** add their own steps, fields, checks and editor parts to a series that turns them on.
- **Lessons are the first plugin**, [`sahne-lesson`](../../sahne-lesson/README.md): grammar spots, target words, glosses and the quiz. A series without it tells plain stories.
- **Watch-only episodes** play on their own, with no turns for the viewer.

### More kit, drawn by more hands

- **For stories across Europe:** a flag for every European country, boulangeries, bistros and pubs, trams, lamp posts, bistro chairs and pound and franc notes. There are also four new families: houses, transit, a bakery and a festival.
- **Drawing as data.** A story can draw its own items in its content root. Agents draw them through backstage's tools and look at the result as a picture.
- **Promotion with credit.** The best drawings move into the kit for everyone, with the artist's consent and credit ([Drawing kit items](../../sahne-kit/DRAWING.md)).

### Also

- Every package has a logo, from one generator.
- 993 tests, and a review that confirmed and fixed 65 bugs before this release.

## Sahne 0.1

**27 October 2026. The first release:** a paper-theatre stage for illustrated, interactive dialogue scenes, drawn in code. [On GitHub](https://github.com/mehrad77/sahne/releases/tag/v0.1.0).

- **[`sahne`](../../sahne/README.md), the engine.**
  - Cut-paper puppets with faces that talk and blink, 39 gestures, 14 emotions, walks, carries and idle life, all posed by one rig.
  - A director that picks the gaze, the gesture's timing, the listeners' reactions and the camera shot from a small JSON script.
  - Light and weather from dawn to night, rain, thunder and fireworks, with one shader lighting the paper.
  - Sound made in code: a synthesizer and a sequencer, with the browser's voice keeping time with the mouths.
  - Learners tap, drag, choose or say it aloud.
  - An avatar builder, with a few hundred bytes of JSON per person.
  - WebGL2, with an SVG backend for stills. No dependencies.
- **[`sahne-kit`](../../sahne-kit/README.md), the first kit.** People, set pieces, props, animals, sounds and music. Places are built from parametric set pieces, with crowds, birds and traffic that live in them.
- **[`sahne-tr`](../../sahne-tr/README.md), the Turkish plugin.** Mouths timed from the spelling, words matched to objects, answers spoken aloud, and numbers and clock times said.
- **[`sahne-story`](../../sahne-story/README.md), the story format.** Turns, choices and acts, with a player, the story check, lints and a sample story.
- **This gallery.** Every system live, the docs with runnable examples, and *Son Vapur*, a short film in one script.
