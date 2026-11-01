// Where an episode stands in the work, worked out and never stored (pure; the episode page's stages bar and next step read
// it, Node-tested in test/progress.test.ts). The work goes in stages:
//   Brief      what happens, where and who is in it
//   Script     the words, and under each line what the people do (its stage directions)
//   Translate  every line in every translation the series has, each checked by a person
//   (a plugin's own stage: the lesson plugin's Lesson)
//   Review     a read-through, comments answered, approved; approval stays until the episode changes
// Each stage is done or not, with a short state in plain words, and the next stage is the first that is not done. The next
// step is one sentence and at most two actions for the stage on the page.

import type { Languages, StoryDoc } from "sahne-story";
import { checkedOf, hashOf, rowKey, sigAt, type EpisodeReview } from "./review.ts";
import { blocks } from "./script.ts";
import { get, type Path } from "./path.ts";

export type StageKey = "brief" | "script" | "translate" | "review" | (string & {});
export interface StageState { key: StageKey; name: string; done: boolean; state: string; plugin?: boolean }
/** A plugin's own stage, already worked out by its editor half (ui/plugins): it goes before Review. */
export interface PluginStage { key: string; name: string; done: boolean; state: string }

export interface ProgressInput {
  story: StoryDoc;
  langs: Languages;
  review?: EpisodeReview;
  /** The check's and the lints' errors on the episode. */
  errors: number;
  /** The staging the rules suggest, by block path (model/autostage.ts). */
  suggestions: Record<string, unknown[]>;
  /** A task writing the episode now: the step it is on, of how many. */
  drafting?: { step: number; total: number } | null;
  stages?: PluginStage[];
}

export interface LangProgress { lang: string; done: number; total: number; /** No line has this language yet. */ empty: boolean }

export interface Progress {
  stages: StageState[];
  /** The first stage not done, or null when everything is. */
  next: StageKey | null;
  lines: number;
  /** The lines no stage direction is written on, in script order. */
  unstaged: Path[];
  suggestions: number;
  langs: LangProgress[];
  openComments: number;
  approved: boolean;
  /** Approved, but the episode changed since. */
  changedSinceApproved: boolean;
}

const DOTS = "…";
const filled = (t: unknown) => typeof t === "string" && t.trim() !== "" && t.trim() !== DOTS;
/** The staging that counts as a direction: a gesture, a feeling, a look, whom it is said to, a walk, a prop, a reaction, the camera, a sound. */
const DIRECTING = ["do", "emo", "at", "to", "move", "obj", "react", "link", "cam", "sfx", "env"];

/** The episode as approval vouches for it, a signature to compare with the review's: everything but when it comes out and the draft mark. */
export const episodeSig = (story: StoryDoc) => { const { releaseDate: _d, draft: _x, ...rest } = story; return hashOf(rest); };

/** Whether a line has no stage direction written. The narrator speaking to the viewer needs none. */
export function isUnstaged(step: Record<string, unknown> | undefined): boolean {
  if (!step || step.narr === true) return false;
  return !DIRECTING.some(k => step[k] !== undefined);
}

/** The blocks a translator translates: lines, the learner's options, replies, and a plugin's step with words (a spot). */
function translatable(story: StoryDoc, main: string): { path: Path; node: Record<string, unknown> }[] {
  const out: { path: Path; node: Record<string, unknown> }[] = [];
  for (const b of blocks(story)) {
    if (b.kind === "scene" || b.kind === "action" || b.kind === "choice" || b.kind === "act") continue;
    const node = get(story, b.path) as Record<string, unknown> | undefined;
    // a plugin's step holds its words one level down (`spot: { tr, en, fa }`)
    const words = b.kind === "line" || b.kind === "option" ? node : (node?.[b.kind] as Record<string, unknown> | undefined);
    if (words && filled(words[main])) out.push({ path: b.path, node: words });
  }
  return out;
}

export function progressOf(i: ProgressInput): Progress {
  const { story, langs, review } = i;
  const s = story as StoryDoc & { summary?: Record<string, string> };
  const lineBlocks = blocks(story).filter(b => b.kind === "line" || b.kind === "option");
  const lines = lineBlocks.length;
  const unstaged = lineBlocks.filter(b => isUnstaged(get(story, b.path) as Record<string, unknown>)).map(b => b.path);
  const suggestions = Object.values(i.suggestions).reduce((n, x) => n + x.length, 0);

  // translations: a line counts once its words are there and a person checked them since it last changed
  const tr = translatable(story, langs.main);
  const note = (p: Path) => review?.steps?.[rowKey(p)];
  const langsDone: LangProgress[] = langs.translations.map(lang => ({
    lang, total: tr.length,
    done: tr.filter(t => filled(t.node[lang]) && checkedOf(note(t.path)).includes(lang) && (!note(t.path)?.sig || note(t.path)!.sig === sigAt(story, t.path))).length,
    empty: !tr.some(t => filled(t.node[lang])),
  }));
  const translated = langsDone.every(l => l.done === l.total);

  const openComments = (review?.comments ?? []).filter(c => !c.done).length;
  const approvedAt = review?.status === "approved";
  const changedSinceApproved = approvedAt && !!review?.sig && review.sig !== episodeSig(story);
  const approved = approvedAt && !changedSinceApproved;

  const brief = filled(s.title?.[langs.main]) && Object.values(s.summary ?? {}).some(filled) && !!s.place && (s.cast ?? []).length > 0;
  const stages: StageState[] = [
    { key: "brief", name: "Brief", done: brief, state: brief ? "Set" : "Needs a premise" },
    i.drafting
      ? { key: "script", name: "Script", done: false, state: `Writing… ${i.drafting.step}/${i.drafting.total}` }
      : { key: "script", name: "Script", done: lines > 0 && !unstaged.length, state: !lines ? "Empty" : unstaged.length ? `${lines} lines · ${unstaged.length} without directions` : suggestions ? `${lines} lines · ${suggestions} idea${suggestions > 1 ? "s" : ""}` : `${lines} lines, staged` },
    { key: "translate", name: "Translate", done: lines > 0 && translated, state: langsDone.length ? langsDone.map(l => `${l.lang.toUpperCase()} ${l.done}/${l.total}`).join(" · ") : "No translations" },
    ...(i.stages ?? []).map(x => ({ ...x, plugin: true })),
    { key: "review", name: "Review", done: approved, state: changedSinceApproved ? "Changed since approved" : approved ? "Approved" : openComments ? `${openComments} open comment${openComments > 1 ? "s" : ""}` : "Not approved" },
  ];
  return { stages, next: stages.find(x => !x.done)?.key ?? null, lines, unstaged, suggestions, langs: langsDone, openComments, approved, changedSinceApproved };
}

/** What an action of the next step does (the page carries it out). */
export type StepAction = "draft" | `go:${string}` | "first-unstaged" | "add-all" | "first-untranslated" | "next-language" | "draft-language" | "settings" | "watch" | "approve";
export interface NextStep { what: string; act?: { label: string; action: StepAction }; alt?: { label: string; action: StepAction } }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const LANG_NAMES = (code: string) => { try { return new Intl.DisplayNames(["en"], { type: "language" }).of(code) ?? code; } catch { return code; } };

/** The one next step for the stage on the page. `lang` is the translation open in Translate; `translator` hides the writer's steps. */
export function nextStepOf(p: Progress, stage: StageKey, o: { lang?: string; translator?: boolean; drafting?: boolean } = {}): NextStep {
  const after = (k: StageKey) => { const order = p.stages.map(x => x.key), i = order.indexOf(k); return p.stages[i + 1]; };
  const goNext = (k: StageKey): NextStep["act"] => { const n = after(k); return n ? { label: `${n.name} next`, action: `go:${n.key}` } : undefined; };
  if (o.drafting) return { what: "A task is drafting this episode from the brief. Lines appear as it writes them." };
  switch (stage) {
    case "brief": {
      const done = p.stages.find(x => x.key === "brief")!.done;
      return done && p.lines ? { what: "The brief is set. The script follows from it.", act: { label: "Go to the script", action: "go:script" } }
        : { what: "Say what happens, where and who is in it. The assistant drafts the script from this.", act: { label: "Draft it with the assistant", action: "draft" } };
    }
    case "script": {
      if (!p.lines) return { what: "No script yet.", act: { label: "Draft it with the assistant", action: "draft" } };
      if (p.unstaged.length) return { what: `${plural(p.unstaged.length, "line has", "lines have")} no stage directions, and ${plural(p.suggestions, "suggestion waits", "suggestions wait")}.`, act: { label: "Go to the first", action: "first-unstaged" }, ...(p.suggestions ? { alt: { label: `Add all ${p.suggestions}`, action: "add-all" } } : {}) };
      if (p.suggestions) return { what: `Every line is staged. ${plural(p.suggestions, "more idea")} from the rules, if you want them.`, act: { label: `Add all ${p.suggestions}`, action: "add-all" }, ...(goNext("script") ? { alt: goNext("script") } : {}) };
      return { what: `${plural(p.lines, "line")}, every one staged. Read it through once more; the stage plays the line you're on.`, act: goNext("script") };
    }
    case "translate": {
      if (!p.langs.length) return { what: "The series has no translations. Add a language in the series settings.", act: { label: "Series settings", action: "settings" } };
      const l = p.langs.find(x => x.lang === o.lang) ?? p.langs[0], name = LANG_NAMES(l.lang), left = l.total - l.done;
      if (l.empty && l.total) return { what: `No ${name} yet: ${plural(l.total, "line")} to translate.`, act: { label: "Start at the first", action: "first-untranslated" }, ...(o.translator ? {} : { alt: { label: `Draft the ${name} with the assistant`, action: "draft-language" } }) };
      if (left) return { what: `${plural(left, `${name} line`)} to check.`, act: { label: "Go to the first", action: "first-untranslated" } };
      if (o.translator) return { what: `${name} is done. Thank you.` };
      const other = p.langs.find(x => x.done < x.total);
      return other ? { what: `${name} is done.`, act: { label: `${LANG_NAMES(other.lang)} next`, action: "next-language" } } : { what: "Every translation is checked.", act: goNext("translate") };
    }
    case "review": {
      if (p.approved) return { what: "Approved. Any later change marks it changed since approval." };
      const not = p.stages.filter(x => x.key !== "review" && !x.done).map(x => x.name.toLowerCase());
      const open = p.openComments ? plural(p.openComments, "open comment") : "";
      const why = [...not, open].filter(Boolean);
      return why.length ? { what: `${p.changedSinceApproved ? "Changed since it was approved. " : ""}Not ready: ${why.join(", ")}. Watch it through anyway, then approve.`, act: { label: "Watch it", action: "watch" }, alt: { label: "Approve anyway…", action: "approve" } }
        : { what: `${p.changedSinceApproved ? "Changed since it was approved. " : ""}Everything is done. Watch it once, then approve.`, act: { label: "Approve", action: "approve" }, alt: { label: "Watch it", action: "watch" } };
    }
  }
  // a plugin's stage: its own state, and on to the next
  const st = p.stages.find(x => x.key === stage);
  return { what: st?.done ? `${st.name}: ${st.state}.` : `${st?.name ?? stage}: ${st?.state ?? ""}.`, act: st?.done ? goNext(stage) : undefined };
}
