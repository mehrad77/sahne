# Get started

Sahne turns a script into an illustrated scene that plays in the browser. People made of cut paper speak, gesture and walk through lit places, and the learner can tap, choose or answer aloud. Nothing is a video and nothing is a painted picture. Everything is drawn from code and a few hundred bytes of JSON, so a line can be rewritten, restaged or translated in a minute.

Most people come to Sahne for one of three things.

| You want to… | Start with |
|---|---|
| **Write, stage and review episodes**, without programming | [Backstage](#write-and-stage-episodes-in-backstage), the studio |
| **Put a stage in your app** | [Your first scene](start.md), then [the engine](../../sahne/README.md) |
| **Draw new things for the kit** | [Draw for the kit](#draw-for-the-kit) |

All three need the repository and Node.js. The packages are not on npm yet.

```bash
git clone https://github.com/mehrad77/sahne && cd sahne
corepack enable          # pnpm 11, with Node 24
pnpm install
```

## Write and stage episodes in Backstage

**Why.** A dialogue scene used to mean a writer, an illustrator, an animator and a video editor, and every change went round all four again. In Sahne, the writer's script *is* the scene: the director plays it, the stage draws it, and a change is a change of words. Backstage is where that writing happens. It is made for writers, directors and reviewers who don't program, and AI helps there only under a person's eye.

**Start it** on the samples, which are kept read-only:

```bash
node packages/sahne-backstage/server/cli.ts
```

Then open http://localhost:5181. To work on your own series, give it a content root (an absolute folder) and let it save:

```bash
node packages/sahne-backstage/server/cli.ts --content /path/to/your/data --write
```

**How an episode is made.** The episode page walks you through the stages of the work.

1. **Brief.** Pick the place from its picture and the cast from their portraits, then write a title and a line of premise. The assistant can draft the episode from the brief, as a task you can watch and undo.
2. **Script.** Type it like a screenplay, beside the live stage. Enter starts the next line and alternates the speaker. `(waves, happy, to İsmail)` becomes staging. Grey chips show what the director will do by itself, and dashed chips are suggestions you take with a click. In *Direct* mode you click a person on stage to give them a gesture, or drag them onto a mark.
3. **Translate.** Every text in each of the series' languages, as rows under the main one. Persian runs right to left.
4. **Review.** Read it through one block at a time beside the stage. Enter marks a block right. When everything is reviewed, approve the episode. An episode changed after approval goes back to the queue.

**Needs you**, at the bottom of the page, gathers everything that waits for a person: problems with a fix, missing translations, staging ideas, comments, and agents' proposals.

**The season** is a board of weeks and days. Each episode is a card on its release day: drag it to move the release, or click an empty day to start a new one.

**The assistant** (✦ in the top bar) runs on Claude (set `ANTHROPIC_API_KEY` before you start backstage) or on a model on your own machine (LM Studio or Ollama, set in Settings). It works within a daily and monthly budget. Its edits arrive as proposals that you accept or reject.

**Other agents**, Claude Code among them, connect over MCP. The *Agents* page gives you the command to copy:

```bash
claude mcp add --transport http sahne-backstage http://localhost:5181/mcp
```

The whole studio, page by page: [Backstage](../../sahne-backstage/README.md). The format it writes: [Stories and places](../../sahne-story/README.md).

## Put a stage in your app

**Why.** Your app keeps its own content and UI, and Sahne adds the stage. One `mountStage`, a kit and a language plugin give you a scene that is directed, lip-synced and lit. It weighs a few hundred kilobytes, not a folder of videos.

**How.** [Your first scene](start.md) walks through a short scene that plays as you read. After that:

- [The engine](../../sahne/README.md): mounting, playing, interaction, avatars. Its [design](../../sahne/DESIGN.md) has the formats and the budgets.
- A language plugin times the mouths from the spelling: [Turkish](../../sahne-tr/README.md), [English](../../sahne-en/README.md), [German](../../sahne-de/README.md) or [Persian](../../sahne-fa/README.md).
- [Stories and places](../../sahne-story/README.md): series, seasons, episodes and their checks, if your app plays episodes rather than single scripts. [Lessons](../../sahne-lesson/README.md) add what an episode teaches.

## Draw for the kit

**Why.** Everything on stage comes from the kit, and the kit grows with the stories. A story that needs a bakery's pastries or a Lisbon tram can draw it as data in its own content root, and the best drawings are promoted into the kit for everyone, with credit to whoever drew them.

**How.** Kit items are drawn as data, through backstage's MCP tools (`kit_render` returns a picture of a sheet) or from the shell with `server/call.ts`. Read [Drawing kit items](../../sahne-kit/DRAWING.md) and the [style guide](../../sahne-kit/STYLE.md), then [Contributing](../../../CONTRIBUTING.md) for promotion and credit.

## Look around

The gallery's other pages, under *Explore*, show every part working: each engine system with a live demo, the kit, the places, the stories and the cast. They are made for the people who build Sahne, and anyone curious is welcome to them.
