// Changes of clothes in a story (Kumru's STORIES_SCHEMA.md §5.2, DESIGN.md §5.2): bodies are fixed, clothes
// change. A step's `looks` maps a character to an outfit name of their document (`"default"` the
// avatar itself) or to a look on what they wear now; clothes stay on until changed. The order is
// the avatar → the story's `looks` → each scene's → each line's or beat's.
//
// The learner plays Nima in their own clothes: only a coat (`outfit.outer`) and a hat (`wear.hat`)
// go on or off, and never a hat over their own head covering.

import { applyLook, lookFields, type AvatarDoc, type Look } from "sahne";
import { isBeat, isLine, isScene, STANDIN, type CharacterDoc, type LookRef, type Looks, type Step, type StoryDoc } from "./types.ts";

/** What a look may change on the learner. */
export const LEARNER_FIELDS = ["outfit.outer", "wear.hat"] as const;

/** JSON with sorted keys: two documents dressed by different paths compare equal. */
export const canon = (v: unknown): string =>
  JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x));

/** The part of `look` the learner wears on `now`: a coat and a hat, the hat only over no head covering. */
export function forLearner(look: Look, now: AvatarDoc): Look {
  const { clothing } = lookFields(look), out: Look = {};
  if ("outfit.outer" in clothing) out.outfit = { outer: clothing["outfit.outer"] };
  const hat = clothing["wear.hat"];
  if ("wear.hat" in clothing && !(hat && now.wear?.head)) out.wear = { hat };
  return out;
}

/**
 * `now` after `ref`: an outfit name dresses `avatar` in that outfit ("default" the avatar itself), a
 * look changes only the slots it names on `now`. Null for an outfit the character lacks.
 */
export function dress(ref: LookRef, now: AvatarDoc, avatar: AvatarDoc, outfits: Record<string, Look> | undefined, learner: boolean): AvatarDoc | null {
  if (typeof ref === "string") {
    if (ref === "default") return avatar;
    const fit = outfits && Object.hasOwn(outfits, ref) ? outfits[ref] : undefined;
    return fit ? applyLook(avatar, learner ? forLearner(fit, avatar) : fit) : null;
  }
  return applyLook(now, learner ? forLearner(ref ?? {}, now) : ref);
}

/** The looks a top-level step carries: a scene's, a line's, a beat's. */
export const looksOf = (s: Step): Looks | undefined => (isScene(s) || isLine(s) ? s.looks : isBeat(s) ? s.beat.looks : undefined);

export interface Dressing {
  /** Each actor's document at the story's start, after the story's `looks` (the avatar itself when none applies). */
  base: Record<string, AvatarDoc>;
  /** Actor → wardrobe key → document, for `LoadOptions.wardrobe`: only actors who change. */
  wardrobe: Record<string, Record<string, AvatarDoc>>;
  /** Step index → actor → the wardrobe key they change into ("" back to `base`). */
  changes: Record<number, Record<string, string>>;
}

/**
 * Who wears what, step by step. `avatars` are the cast's documents (Nima's the learner's); `ok` says
 * which steps play. A wardrobe key is the outfit name whose document it is, else `look1`, `look2` …,
 * one per distinct document.
 */
export function dressing(story: StoryDoc, avatars: Record<string, AvatarDoc>, characters: Record<string, CharacterDoc>, ok: (s: Step) => boolean): Dressing {
  const base: Record<string, AvatarDoc> = {}, wardrobe: Record<string, Record<string, AvatarDoc>> = {}, changes: Record<number, Record<string, string>> = {};
  const now: Record<string, AvatarDoc> = { ...avatars };
  const put = (looks: Looks | undefined): Record<string, AvatarDoc> => {
    const out: Record<string, AvatarDoc> = {};
    for (const [id, ref] of Object.entries(looks ?? {})) {
      const avatar = avatars[id];
      if (!avatar) continue;
      const next = dress(ref, now[id], avatar, characters[id]?.outfits, id === STANDIN);
      if (next && canon(next) !== canon(now[id])) out[id] = now[id] = next;
    }
    return out;
  };
  put(story.looks);
  Object.assign(base, now);

  const named = new Map<string, Map<string, string>>(), seen = new Map<string, Map<string, string>>();
  /** The document's key: "" the base, an outfit's name, or a new `lookN`. */
  const key = (id: string, doc: AvatarDoc): string => {
    const c = canon(doc);
    if (c === canon(base[id])) return "";
    const outfits = characters[id]?.outfits ?? {};
    if (!named.has(id)) {
      const m = new Map<string, string>();
      for (const n of ["default", ...Object.keys(outfits)]) { const d = dress(n, avatars[id], avatars[id], outfits, id === STANDIN); if (d && !m.has(canon(d))) m.set(canon(d), n); }
      named.set(id, m);
    }
    const mine = (seen.get(id) ?? seen.set(id, new Map()).get(id))!;
    let k = mine.get(c) ?? named.get(id)!.get(c);
    for (let n = 1; !k; n++) if (!Object.hasOwn(outfits, `look${n}`) && ![...mine.values()].includes(`look${n}`)) k = `look${n}`;
    mine.set(c, k);
    (wardrobe[id] ??= {})[k] = doc;
    return k;
  };

  story.steps.forEach((s, step) => {
    if (!ok(s)) return;
    const changed = put(looksOf(s));
    if (Object.keys(changed).length) changes[step] = Object.fromEntries(Object.entries(changed).map(([id, d]) => [id, key(id, d)]));
  });
  return { base, wardrobe, changes };
}
