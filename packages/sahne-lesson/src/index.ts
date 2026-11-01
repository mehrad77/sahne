// sahne-lesson: the lesson plugin of sahne-story (src/plugin.ts there). A series that teaches a language turns it on
// (`series.json` `"plugins": ["lesson"]`), and a host passes `lesson` in with its other plugins. It adds the grammar spot
// step, the story's level, ref, lessons, target words, glosses and quiz, a line's note and mistake for the learner, the
// "meaning" choice, and the checks of src/check.ts.

import { allLanguages, NARRATOR, type PluginGap, type StoryPlugin } from "sahne-story";
import { checkLesson, checkLessonSeason } from "./check.ts";
import { isSpot, lessonOf, type SpotStep } from "./types.ts";

export * from "./types.ts";
export { checkLesson, checkLessonSeason } from "./check.ts";

/** The overlays a spot may show (the engine's and the host's `overlay` kinds). */
export const SPOT_SHOWS = ["deixis", "var_yok", "case_path", "owner", "compare", "aspect", "clock"] as const;

const text = { $ref: "#/$defs/text" };

/** A missing text, as sahne-story's `storyLanguageGaps` reports one. */
function need(out: PluginGap[], o: unknown, langs: string[], path: string, what: string) {
  const r = o && typeof o === "object" ? (o as Record<string, unknown>) : {};
  for (const l of langs) if (typeof r[l] !== "string" || r[l] === "") out.push({ path, message: `${what} has no ${l} text` });
}

export const lesson: StoryPlugin = {
  id: "lesson",
  steps: [{
    key: "spot",
    schema: { required: ["spot"], properties: { spot: { type: "object", required: ["lesson", "ex"], properties: { lesson: { type: "string" }, ex: { type: "string", minLength: 1 }, show: { enum: [...SPOT_SHOWS] } } }, if: { type: "string" }, unless: { type: "string" } }, additionalProperties: false },
    is: isSpot,
    adapt(step, ctx) {
      const s = step as SpotStep, { lesson: id, ex, show } = s.spot, own = ctx.said(s.spot);
      const shown = ctx.shown({ ...s.spot, [ctx.main]: own || ex });
      ctx.push({ overlay: { kind: show ?? "spot", lesson: id, ex: ctx.p(ex), ...(own ? { tr: ctx.p(own) } : {}), who: NARRATOR, ...ctx.staging(s.spot) } },
        { step: ctx.step, kind: "spot", who: NARRATOR, ...shown });
    },
    staging: step => ({ who: NARRATOR, staging: (step as SpotStep).spot }),
  }],
  schema: {
    story: {
      properties: {
        level: { enum: ["A1", "A2", "B1"] },
        ref: { type: "string", pattern: "^(A1|A2|B1)_[1-6]$" },
        lessons: { type: "array", minItems: 1, maxItems: 3, uniqueItems: true, items: { type: "string", pattern: "^g_(a1|a2|b1)_[0-9]+_[a-z0-9_]+$" } },
        words: { type: "array", minItems: 5, maxItems: 12, uniqueItems: true, items: { type: "string", minLength: 1 } },
        gl: { type: "object", propertyNames: { pattern: "^[^A-ZİÇĞÖŞÜ]+$" }, additionalProperties: text },
        quiz: { type: "array", minItems: 3, maxItems: 3, items: { type: "object", required: ["q", "options", "a", "why", "kind"], properties: { q: text, options: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", minLength: 1 } }, a: { enum: [0, 1, 2] }, why: { type: "string", minLength: 1 }, kind: { enum: ["comp", "word"] } }, additionalProperties: false } },
      },
      required: ["level", "ref", "lessons", "words", "gl", "quiz"],
    },
    line: { mistake: { type: "object", required: ["fix"], properties: { fix: { type: "string", minLength: 1 } } }, note: { type: "object" } },
    choice: { kind: { enum: ["polite", "meaning", "action"] } },
  },
  check: checkLesson,
  season: ctx => checkLessonSeason(ctx),
  languageGaps(story, l) {
    const out: PluginGap[] = [], s = lessonOf(story);
    for (const [w, g] of Object.entries(s.gl ?? {})) need(out, g, l.translations, `/gl/${w}`, `the gloss of ${w}`);
    (s.quiz ?? []).forEach((q, i) => need(out, q.q, allLanguages(l), `/quiz/${i}/q`, `quiz ${i + 1}'s question`));
    return out;
  },
  lineInfo(line, personalise) {
    const n = (line as { note?: Record<string, string> }).note;
    return n ? { note: Object.fromEntries(Object.entries(n).map(([l, v]) => [l, personalise(v, l)])) } : {};
  },
  prompt: "These are language-learning scenes. An episode teaches a few target words (card ids in `words`) and a grammar lesson (`lessons`), with one grammar spot ({ \"spot\": { \"lesson\", \"ex\" } }, Kerim explaining it on a line of the story) and a three-item quiz after it (`quiz/0` …, each answered by a line). Keep every line at the episode's level; gloss a word the learner cannot know in `gl`. A second reader also reports words above the level and quiz answers that do not hold.",
};
