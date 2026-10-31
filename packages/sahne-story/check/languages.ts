// What each document must hold in the series' languages (src/texts.ts). The schemas take a text in any language; this
// says which languages it needs, as the schemas said for Turkish, English and Persian before series named their own:
//   in every language  a story's title, its lines, choice options and arc, a quiz question; a series' and a season's
//                      title, and a season's arcs (a place's name: lintPlace)
//   in the translations  a story's summary and its glosses; a character's role and bio
//   in the main one    a character's name
// A language code may not be one of a step's own keys (`STEP_KEYS`): a line holds its texts beside its staging.

import { allLanguages, LANGUAGE_CODE, STEP_KEYS, type Languages } from "../src/texts.ts";
import { isAct, isChoice, isLine, type CharacterDoc, type SeasonDoc, type SeriesDoc, type StoryDoc } from "../src/types.ts";

export interface LanguageGap { path: string; message: string }

type Obj = Record<string, unknown>;
const has = (o: unknown, l: string) => !!o && typeof o === "object" && typeof (o as Obj)[l] === "string" && (o as Obj)[l] !== "";

/** Each of `need` that `o` lacks, as a gap at `path`. */
function need(out: LanguageGap[], o: unknown, langs: string[], path: string, what: string) {
  for (const l of langs) if (!has(o, l)) out.push({ path, message: `${what} has no ${l} text` });
}

/** The problems with the languages a series names: their codes, and none a step's own key. */
export function languageCodeGaps(l: Languages): LanguageGap[] {
  const out: LanguageGap[] = [];
  for (const code of allLanguages(l)) {
    if (!LANGUAGE_CODE.test(code)) out.push({ path: "/languages", message: `${code} is not a language code` });
    if (STEP_KEYS.includes(code)) out.push({ path: "/languages", message: `${code} is a step's own key, so it cannot be a language code` });
  }
  if (l.translations.includes(l.main)) out.push({ path: "/languages", message: `${l.main} is the main language and a translation` });
  return out;
}

export function storyLanguageGaps(s: StoryDoc, l: Languages): LanguageGap[] {
  const out: LanguageGap[] = [], all = allLanguages(l);
  need(out, s.title, all, "/title", "the title");
  if (s.summary !== undefined) need(out, s.summary, l.translations, "/summary", "the summary");
  if (s.arc) need(out, s.arc, all, "/arc", "the arc");
  for (const [w, g] of Object.entries(s.gl ?? {})) need(out, g, l.translations, `/gl/${w}`, `the gloss of ${w}`);
  ((s.quiz as { q?: unknown }[] | undefined) ?? []).forEach((q, i) => need(out, q.q, all, `/quiz/${i}/q`, `quiz ${i + 1}'s question`));
  const steps = (list: unknown[], at: string) => list.forEach((st, i) => {
    const step = st as Parameters<typeof isLine>[0];
    if (isLine(step)) need(out, step, all, `${at}/${i}`, "the line");
    if (isChoice(step)) step.choice.options.forEach((o, k) => {
      need(out, o, all, `${at}/${i}/choice/options/${k}`, "the option");
      steps(o.reply ?? [], `${at}/${i}/choice/options/${k}/reply`);
    });
    if (isAct(step) && step.act.prompt) need(out, step.act.prompt, [l.main], `${at}/${i}/act/prompt`, "the prompt");
  });
  steps(s.steps, "/steps");
  steps((s.followUp as unknown[] | undefined) ?? [], "/followUp");
  return out;
}

export function seriesLanguageGaps(s: SeriesDoc, l: Languages): LanguageGap[] {
  const out: LanguageGap[] = [];
  need(out, s.title, allLanguages(l), "/title", "the title");
  return out;
}

export function seasonLanguageGaps(s: SeasonDoc, l: Languages): LanguageGap[] {
  const out: LanguageGap[] = [];
  need(out, s.title, allLanguages(l), "/title", "the title");
  for (const [id, a] of Object.entries(s.arcs ?? {})) need(out, a, allLanguages(l), `/arcs/${id}`, `arc ${id}`);
  return out;
}

export function characterLanguageGaps(c: CharacterDoc, l: Languages): LanguageGap[] {
  const out: LanguageGap[] = [];
  need(out, c.name, [l.main], "/name", "the name");
  need(out, c.role, l.translations, "/role", "the role");
  need(out, c.bio, l.translations, "/bio", "the bio");
  return out;
}
