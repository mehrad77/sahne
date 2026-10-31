// Staging that is there without being written, pure: for every block of the script, what the director will do by
// itself (ghosts: who a line is said to and the shot it gets, read from the stage's own performance of each cue, so
// they are exactly what plays) and what the rules would add (suggestions: the lints' fixes and links, a gesture the words
// motivate, a feeling the punctuation does). A ghost is never written; a suggestion is written when it is taken.
// Node-tested (test/model.test.ts).

import type { Staging } from "sahne";
import { motivated, motiveText } from "sahne-story";
import type { CueInfo, StoryDoc, StoryLang, Suggestion } from "sahne-story";
import { cuePath, get, type Path } from "./path.ts";
import { blocks } from "./script.ts";

export interface Ghost { to?: string; cam?: string; camIds?: string[] }
export interface Suggest { fix: Partial<Staging>; why: string; from: "lint" | "words" | "punctuation" }

const keyOf = (p: Path) => p.join("/");
/** Where a lint suggestion's step, option and reply are in the story. */
export const pathOfSuggestion = (s: Pick<Suggestion, "step" | "option" | "reply">): Path =>
  s.option === undefined ? ["steps", s.step] : s.reply === undefined ? ["steps", s.step, "choice", "options", s.option] : ["steps", s.step, "choice", "options", s.option, "reply", s.reply];

/** What the director did on each cue the stage plays, by block: its addressee and its shot. */
export function ghostsOf(info: readonly CueInfo[], perfs: { after: { last?: { who: string; to?: string }; shot?: { kind: string; ids: string[] } } }[]): Record<string, Ghost> {
  const out: Record<string, Ghost> = {};
  info.forEach((c, i) => {
    if (c.kind !== "line" && c.kind !== "say" && c.kind !== "reply") return;
    const a = perfs[i]?.after;
    if (!a) return;
    const k = keyOf(cuePath(c));
    out[k] = { ...(a.last?.to ? { to: a.last.to } : {}), ...(a.shot ? { cam: a.shot.kind, camIds: a.shot.ids } : {}) };
  });
  return out;
}

/** What the rules suggest for each block, keyed by its path. */
export function suggestionsOf(story: StoryDoc, o: { lang: StoryLang; lints: Suggestion[]; gestures: string[]; emotions: string[]; narrator: string; standin: string }): Record<string, Suggest[]> {
  const out: Record<string, Suggest[]> = {};
  const add = (p: Path, s: Suggest) => { const k = keyOf(p); if (!(out[k] ??= []).some(x => JSON.stringify(x.fix) === JSON.stringify(s.fix))) out[k].push(s); };
  for (const s of o.lints) add(pathOfSuggestion(s), { fix: s.fix, why: s.message, from: "lint" });
  const gestures = new Set(o.gestures), emotions = new Set(o.emotions);
  for (const b of blocks(story)) {
    if (b.kind !== "line" && b.kind !== "option") continue;
    const step = get(story, b.path) as Record<string, unknown>;
    const who = b.kind === "option" ? o.standin : String(step.who ?? "");
    if (who === o.narrator) continue;
    const text = String(step[o.lang.id] ?? "").trim();
    if (!text) continue;
    if (!step.do) {
      // the first gesture one of the words motivates (a number's count is the lints')
      const said = o.lang.words(text).filter(w => !w.pause).map(w => w.w);
      for (const [g, words] of Object.entries(o.lang.motive)) {
        if (!gestures.has(g) || !words.length || g === "count" || g === "phone") continue;
        const m = motivated(words, said);
        if (m) { add(b.path, { fix: { do: g }, why: `“${motiveText(m)}…” motivates ${g.replace(/_/g, " ")}`, from: "words" }); break; }
      }
    }
    if (!step.emo) {
      if (/\?\s*$/.test(text) && emotions.has("curious")) add(b.path, { fix: { emo: "curious" }, why: "a question", from: "punctuation" });
      else if (/!\s*$/.test(text) && emotions.has("surprised")) add(b.path, { fix: { emo: "surprised" }, why: "an exclamation", from: "punctuation" });
    }
  }
  return out;
}

/** The staging a suggestion adds to what a block has (a link merges, everything else replaces). */
export function taken(current: Record<string, unknown>, fix: Partial<Staging>): Record<string, unknown> {
  const next = { ...current };
  for (const [k, v] of Object.entries(fix)) {
    if (k === "link" && v && typeof v === "object") next.link = { ...(current.link as object ?? {}), ...v };
    else if (k === "obj" && Array.isArray(v)) next.obj = [...((current.obj as unknown[]) ?? []).filter(x => !v.some(y => (y as { id: string }).id === (x as { id: string }).id)), ...v];
    else next[k] = v;
  }
  return next;
}
