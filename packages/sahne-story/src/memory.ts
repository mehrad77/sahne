// What the stories remember of a learner (Kumru's STORIES_SCHEMA.md §4.5, §4.7, §4.8, §9): flags, warmth, Kerim's album and the avatar
// unlocks. None of it is stored: it is derived from the picks the app keeps per story (`progress.st[id].ch`, choice or act id →
// option index or target) and from the stories themselves, so a rewritten choice re-scores itself. Pure; no engine.
import { isAct, isChoice, isLine, NARRATOR, STANDIN, type Step, type StoryDoc } from "./types.ts";

/** The picks of one reading: choice id → option index, act id → the target picked. */
export type StoryPicks = Record<string, number | string>;
/** The picks per story id (the app's `st[id].ch`). */
export type PicksByStory = Record<string, StoryPicks | undefined>;

/** Every step a learner can answer in: the story's own, then its follow-up. */
const answerable = (s: StoryDoc): Step[] => [...s.steps, ...((s.followUp as Step[] | undefined) ?? [])];

/** The flags set by the learner's picks (`sets` on a picked option). */
export function flagsOf(stories: readonly StoryDoc[], picks: PicksByStory): Set<string> {
  const out = new Set<string>();
  for (const s of stories) {
    const p = picks[s.id];
    if (!p) continue;
    for (const st of answerable(s)) {
      if (!isChoice(st)) continue;
      const i = p[st.choice.id];
      const o = typeof i === "number" ? st.choice.options[i] : undefined;
      if (o?.sets) out.add(o.sets);
    }
  }
  return out;
}

/**
 * The learner's warmth with each character over the stories given (a season's): the sum of the picked options' warmth.
 * By default the `ok` option gives the choice's `to` +1, a blunt or rude one −1, anything else 0; `warm` overrides it.
 * `to` defaults to the speaker of the line before the choice (not the stand-in, not the narrator).
 */
export function warmthOf(stories: readonly StoryDoc[], picks: PicksByStory): Record<string, number> {
  const out: Record<string, number> = {};
  const add = (id: string, n: number) => { if (n) out[id] = (out[id] ?? 0) + n; };
  for (const s of stories) {
    const p = picks[s.id];
    if (!p) continue;
    let speaker = "";
    for (const st of answerable(s)) {
      if (isLine(st)) { if (st.who !== STANDIN && st.who !== NARRATOR && !st.narr) speaker = st.who; continue; }
      if (isChoice(st)) {
        const i = p[st.choice.id];
        const o = typeof i === "number" ? st.choice.options[i] : undefined;
        if (!o) continue;
        if (o.warm) { for (const [id, n] of Object.entries(o.warm)) add(id, n); continue; }
        const to = st.choice.to || speaker;
        if (to) add(to, o.ok ? 1 : o.tone === "blunt" || o.tone === "rude" ? -1 : 0);
      } else if (isAct(st)) {
        const got = p[st.act.id];
        if (got === undefined) continue;
        if (st.act.warm) { for (const [id, n] of Object.entries(st.act.warm)) add(id, n); continue; }
        const to = st.act.to || speaker;
        if (to && st.act.expect !== undefined && got === st.act.expect) add(to, 1);
      }
    }
  }
  return out;
}

/** The album band of a warmth (§4.8): never a score the learner sees. */
export const albumBand = (warmth: number): "met" | "close" | "family" => (warmth >= 3 ? "family" : warmth >= 1 ? "close" : "met");

/** The characters the learner met in at least `min` of the stories they finished (the album's pages), most stories first. */
export function metIn(stories: readonly StoryDoc[], done: (id: string) => boolean, min = 3): string[] {
  const n: Record<string, number> = {};
  for (const s of stories) if (done(s.id)) for (const c of new Set(s.cast)) if (c !== STANDIN && c !== NARRATOR) n[c] = (n[c] ?? 0) + 1;
  return Object.keys(n).filter((c) => n[c] >= min).sort((a, b) => n[b] - n[a] || (a < b ? -1 : 1));
}

/** The avatar unlock tokens the finished stories grant: `story:<id>` for each, and a story's own `unlocks` list. */
export function unlockedOf(stories: readonly StoryDoc[], done: (id: string) => boolean): Set<string> {
  const out = new Set<string>();
  for (const s of stories) {
    if (!done(s.id)) continue;
    out.add("story:" + s.id);
    for (const t of (s.unlocks as string[] | undefined) ?? []) out.add(t);
  }
  return out;
}
