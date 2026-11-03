<!-- sahne:brand: written by packages/sahne-gallery/brand/build.mjs, edit that and run it -->
<p><picture><source media="(prefers-color-scheme: dark)" srcset="../../assets/brand/sahne-lesson-header-dark.svg"><img src="../../assets/brand/sahne-lesson-header.svg" alt="sahne LESSON" height="64"></picture></p>
<!-- /sahne:brand -->

# sahne-lesson

The lesson plugin of [sahne-story](../sahne-story/README.md#plugins). A series that teaches a language turns it on in `series.json` (`"plugins": ["lesson"]`), and a host passes `lesson` in with its other story plugins. A story that teaches nothing needs none of it: without the plugin, the story format has no level, no target words and no quiz.

| Export | What it does |
|---|---|
| `lesson` | The `StoryPlugin` (`src/index.ts`) |
| `SpotStep`, `isSpot`, `SPOT_SHOWS` | The grammar spot: `{ "spot": { "lesson", "ex", "show"? } }`. Kerim explains a lesson on an example line of the story, as an overlay (`show` is one of `SPOT_SHOWS`, else `spot`), with her own staging |
| `LessonFields`, `LessonStory`, `lessonOf(story)` | A story's lesson fields, read through `lessonOf` (the core `StoryDoc` has none of them) |
| `LessonLine`, `QuizItem` | A line's `note` (for the learner, in the translations) and `mistake` (`{ fix }`); a quiz item |
| `checkLesson`, `checkLessonSeason` | The checks (`src/check.ts`), which the story check runs through the plugin (`check`, and `season` across a season) |
| `LEVELS`, `unitOfWeek`, `unitOfRef` | The course: a week's unit, and where a ref sits in it |

## What it adds

- **The step:** the spot. The core adapter skips a step it does not know, so the spot plays only with the plugin. The staging lints read its Kerim as a beat (`staging`).
- **The story fields**, all of them required while the plugin is on:
  - `level` (A1, A2, B1) and `ref` (the course unit, `A1_3`)
  - `lessons` (1–3 grammar lesson ids, `g_a1_2_var_yok`)
  - `words` (5–12 target words, as card ids)
  - `gl` (glosses: a lower-case word of the main language → its meaning in each translation)
  - `quiz` (three items, each with a question, three options, the answer `a`, a `why` and a `kind`, `comp` or `word`)
- **Line and choice fields:** a line's `note` and `mistake`; the choice kind `meaning`, beside the core's `polite` and `action`.
- **The texts it needs:** each gloss in every translation, and each quiz question in every language.
- **A line's note on its cue** (`info.note`, through `lineInfo`), personalised, for the host's log.
- **A prompt word** for the assistant: what an episode teaches, and the spot and quiz paths.

A watch-only episode ([sahne-story](../sahne-story/README.md#watch-only-episodes)) is held to the same fields and checks as any other: its spot plays as Kerim's overlay on time alone, and the plugin reads the mode (`play`) without changing what it adds.

## The checks

These are errors:
- the `ref` and the lessons against the week's unit
- the target words: each a card, at the story's level and unit
- a character above the story's level
- 5–8 target words in an episode (10–12 in a special), and one spot (1–2 in a special)
- a spot's lesson among the story's, and its example a line of the story
- the quiz: a comp and a word item, and a line each `why` quotes that is not a line of the story
- a `mistake.fix` used within the next three lines
- words that resolve to no card, gloss or name

These are warnings and info:
- a quiz item whose `why` quotes no line
- the line counts by level
- the 95% known-word ratio
- recycling across the season: a story's target words come back in two of the next stories within 14 days, and what it reuses of the stories before

The rules that need the cards, the grammar, the syllabus or the calendar run only when the content root has them.

The place-level word rules are not the plugin's: a prop's `terms` and `decor` and the `explore` rule are `lintPlace`'s ([sahne-story](../sahne-story/README.md#places)), and run for every series.

## Tests

`test/lesson.test.ts`: the samples with the plugin on and off, a story with no lesson parts passing the core check, the schema's fields and step, a seeded break for each rule, the spot's cue and a note on its cue, and the season's recycling report. `test/languages.test.ts`: the checks in a series whose main language is not Turkish (a mistake's fix is looked for in the main language's lines).

```bash
node --test packages/sahne-lesson/test/*.test.ts
```
