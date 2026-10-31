// Problems as a stage manager's notes, pure: each problem of the story check and the stage lints said in plain words,
// with where it is in the script and, where one is obvious, a fix to apply with one click ("İsmail speaks but isn't in
// the cast. Add him", "“bu elma” needs a gesture at the apple. Hold it up"). A rule without words of its own keeps the
// check's message. Node-tested (test/model.test.ts).

import type { Staging } from "sahne";
import type { StoryDoc } from "sahne-story";
import { get, set, type Path } from "./path.ts";
import { pathOfSuggestion, taken } from "./autostage.ts";

export interface ProblemLike { rule: string; level: "error" | "warning" | "info"; message: string; step?: number; option?: number; reply?: number; new?: boolean; fix?: Partial<Staging> }
export interface Note { text: string; level: ProblemLike["level"]; isNew: boolean; path?: Path; fix?: { label: string; apply(s: StoryDoc): StoryDoc }; rule: string }

export interface NoteContext { name(id: string): string; langName(code: string): string; standin: string }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One problem as a note. */
export function noteOf(p: ProblemLike, c: NoteContext): Note {
  const base = { level: p.level, isNew: !!p.new, rule: p.rule, ...(p.step !== undefined ? { path: pathOfSuggestion({ step: p.step, option: p.option, reply: p.reply }) } : {}) };
  const m = p.message;
  let r: RegExpExecArray | null;
  // a text missing in a language (check/languages.ts)
  if ((r = /^\/(.+?): (.+) has no (\S+) text$/.exec(m))) {
    const where = r[1].split("/").map(x => (/^\d+$/.test(x) ? Number(x) : x));
    const path = where[0] === "steps" ? where : undefined;
    return { ...base, ...(path ? { path } : {}), text: `${cap(r[2])} has no ${c.langName(r[3])} yet.` };
  }
  if (/^\/cast: must NOT have (fewer|more) than (\d+) items$/.test(m)) return { ...base, text: "The cast needs 2 to 6 people, the learner among them." };
  if (p.rule === "cast" && (r = /^(\S+) speaks but is not in cast$/.exec(m))) {
    const who = r[1];
    return { ...base, text: `${c.name(who)} speaks but isn't in the cast.`, fix: { label: `Add ${c.name(who)}`, apply: s => set(s, ["cast"], [...(s.cast ?? []), who]) } };
  }
  if (p.rule === "cast" && /^narr is only for/.test(m) && base.path) {
    const path = base.path;
    return { ...base, text: "Only the narrator speaks to the viewer.", fix: { label: "Make it a line", apply: s => set(s, [...path, "narr"], undefined) } };
  }
  if (p.rule === "counts" && (r = /^(\d+) target words; a(?:n)? ?(special|episode)? ?has (\d+)-(\d+)$/.exec(m))) return { ...base, text: `It teaches ${r[1]} target words; ${r[2] === "special" ? "a special" : "an episode"} needs ${r[3]}–${r[4]}.` };
  if (p.rule === "quiz" && /needs at least one comp and one word/.test(m)) return { ...base, text: "The quiz needs a question about what happened and one about a word." };
  if (p.rule === "quiz" && (r = /^quiz item (\d+): “(.+)” is not a line of the story$/.exec(m))) return { ...base, text: `Quiz question ${r[1]} quotes “${r[2]}”, which no line says.` };
  if (p.rule === "ref" && (r = /^spot example “(.*)” is not a line of the story$/.exec(m))) return { ...base, text: `The grammar spot points at “${r[1]}”, which no line says.` };
  if (p.rule === "text" && (r = /^(\d+) words resolve to no card, gloss or name: (.+)$/.exec(m))) {
    const words = r[2].split(", ").map(w => w.replace(/×\d+$/, ""));
    return { ...base, text: `${r[1]} words are on no card, gloss or name: ${r[2]}.`, fix: { label: "Gloss them", apply: s => words.reduce((x, w) => (get(x, ["gl", w]) ? x : set(x, ["gl", w], {})), s) } };
  }
  if (p.rule === "standin" && /two stand-in lines in a row/.test(m)) return { ...base, text: `${c.name(c.standin)} has two lines in a row: each turn is one card.` };
  if (p.rule === "standin" && /first turn is line/.test(m)) return { ...base, text: `${cap(m.replace(/^the learner's/, `${c.name(c.standin)}'s`))}.` };
  // a lint with the staging that settles it
  if (p.fix && base.path) {
    const path = base.path, fix = p.fix;
    return { ...base, text: `${cap(m)}.`, fix: { label: "Stage it", apply: s => { const at = "beat" in ((get(s, path) ?? {}) as object) ? [...path, "beat"] : path; return set(s, at, taken((get(s, at) ?? {}) as Record<string, unknown>, fix)); } } };
  }
  return { ...base, text: `${cap(m)}${/[.!?”]$/.test(m) ? "" : "."}` };
}

/** Every problem as a note, the ones an edit brought first, then errors, warnings and the rest; suggestions are chips, not notes. */
export function notesOf(ps: ProblemLike[], c: NoteContext): Note[] {
  const rank = (l: string) => (l === "error" ? 0 : l === "warning" ? 1 : 2);
  return ps.filter(p => p.rule !== "suggest").map(p => noteOf(p, c)).sort((a, b) => Number(b.isNew) - Number(a.isNew) || rank(a.level) - rank(b.level));
}
