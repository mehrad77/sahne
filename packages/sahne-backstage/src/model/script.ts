// An episode as a script (ui/studio/script.ts), pure: its steps as blocks, one block per step, a choice's options and their
// replies under it, and what the script's keys do to them: a new line after a block with the next speaker (screenplay
// alternation: the one before last), a block turned into another kind, moved, duplicated or deleted, and new blocks of
// each kind in the series' languages. Every edit returns the story and where the cursor goes; the page applies it as one
// edit (undo takes it back). Node-tested (test/model.test.ts).

import type { Staging } from "sahne";
import { allLanguages, type Languages, type StoryDoc } from "sahne-story";
import { get, insert, set, type Path } from "./path.ts";
import { kindOf } from "./steps.ts";

export type BlockKind = "scene" | "line" | "action" | "choice" | "option" | "spot" | "act";
export interface Block { path: Path; kind: BlockKind; depth: 0 | 1 | 2; who?: string }

type Obj = Record<string, unknown>;
const at = (s: StoryDoc, p: Path) => get(s, p) as Obj | undefined;

/** Every block of the script, in order. */
export function blocks(story: Pick<StoryDoc, "steps">): Block[] {
  const out: Block[] = [];
  const one = (s: Obj, path: Path, depth: 0 | 2) => {
    const k = kindOf(s);
    if (k === "line") out.push({ path, kind: "line", depth, who: s.who as string });
    else if (k === "beat") out.push({ path, kind: "action", depth, who: (s.beat as Obj)?.who as string | undefined });
    else if (k === "scene" || k === "spot" || k === "act") out.push({ path, kind: k, depth });
    else if (k === "choice") {
      out.push({ path, kind: "choice", depth });
      ((s.choice as Obj)?.options as Obj[] ?? []).forEach((op, i) => {
        out.push({ path: [...path, "choice", "options", i], kind: "option", depth: 1 });
        ((op.reply as Obj[]) ?? []).forEach((r, j) => one(r, [...path, "choice", "options", i, "reply", j], 2));
      });
    }
  };
  (story.steps ?? []).forEach((s, i) => one(s as unknown as Obj, ["steps", i], 0));
  return out;
}

/** The list a block lives in, and its index there. */
export const listOf = (path: Path): { list: Path; i: number } => ({ list: path.slice(0, -1), i: Number(path.at(-1)) });

/** The staging keys of a line, a beat or an option (what turns into a beat, and back). */
export const STAGING_KEYS = ["to", "emo", "do", "at", "n", "loop", "move", "obj", "link", "react", "cam", "via", "voice", "sfx", "env", "frame", "tempo", "on", "looks"];
const stagingOf = (o: Obj) => Object.fromEntries(Object.entries(o).filter(([k]) => STAGING_KEYS.includes(k)));

/** A line with no words yet, in every language. */
export const emptyLine = (who: string, langs: Languages, extra: Obj = {}) => ({ who, ...Object.fromEntries(allLanguages(langs).map(l => [l, ""])), ...extra });

/**
 * Who speaks next after the block at `path`: the speaker before the last one (a conversation alternates), else someone of
 * the cast who has not just spoken (the narrator never, unless the last line was hers and nobody else is there).
 */
export function nextSpeaker(story: StoryDoc, path: Path, o: { standin: string; narrator: string }): string {
  const order = blocks(story);
  const here = order.findIndex(b => b.path.join("/") === path.join("/"));
  const said: string[] = [];
  for (let k = here; k >= 0 && said.length < 2; k--) {
    const b = order[k];
    if (b.kind === "scene") break;
    const who = b.kind === "option" ? o.standin : b.kind === "line" ? b.who : undefined;
    if (who && who !== o.narrator && said.at(-1) !== who) said.push(who);
  }
  if (said.length === 2) return said[1];
  const others = (story.cast ?? []).filter(c => c !== o.narrator && c !== said[0]);
  return others.find(c => c !== o.standin) ?? others[0] ?? said[0] ?? o.standin;
}

export interface Edited { story: StoryDoc; focus: Path | null }

/** A step after the block at `path`: in its own list (an option gets it as its first reply). */
export function addAfter(story: StoryDoc, path: Path, step: unknown): Edited {
  if (path.at(-2) === "options") {
    const list = [...path, "reply"];
    return { story: insert(story, list, 0, step), focus: [...list, 0] };
  }
  const { list, i } = listOf(path);
  return { story: insert(story, list, i + 1, step), focus: [...list, i + 1] };
}

/** The block at `path` deleted; the cursor goes to the block before it. An option is never deleted below two. */
export function remove(story: StoryDoc, path: Path): Edited {
  const { list, i } = listOf(path);
  const arr = (get(story, list) as unknown[]) ?? [];
  if (path.at(-2) === "options" && arr.length <= 2) return { story, focus: path };
  const order = blocks(story), here = order.findIndex(b => b.path.join("/") === path.join("/"));
  const prev = order[here - 1]?.path ?? null;
  return { story: set(story, list, arr.filter((_, k) => k !== i)), focus: prev && prev.join("/").startsWith(path.join("/")) ? null : prev };
}

/** The block moved one place up (-1) or down (+1) in its list. */
export function moveBy(story: StoryDoc, path: Path, d: -1 | 1): Edited {
  const { list, i } = listOf(path);
  const arr = [...((get(story, list) as unknown[]) ?? [])], j = i + d;
  if (j < 0 || j >= arr.length) return { story, focus: path };
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return { story: set(story, list, arr), focus: [...list, j] };
}

/** A copy of the block after it. */
export const duplicateAt = (story: StoryDoc, path: Path): Edited => {
  const { list, i } = listOf(path);
  return { story: insert(story, list, i + 1, structuredClone(get(story, path))), focus: [...list, i + 1] };
};

/** A line turned into an action (a beat: who does what, with no words) or back; its staging is kept. */
export function convert(story: StoryDoc, path: Path, to: "line" | "action", langs: Languages): StoryDoc {
  const s = at(story, path);
  if (!s) return story;
  if (to === "action" && "who" in s) return set(story, path, { beat: { who: s.who, ...stagingOf(s) } });
  if (to === "line" && "beat" in s) { const b = s.beat as Obj; return set(story, path, emptyLine((b.who as string) ?? "", langs, stagingOf(b))); }
  return story;
}

/** The blocks the `/` menu inserts, each in the series' languages. */
export const INSERTS = ["line", "action", "narration", "scene", "choice", "spot", "act"] as const;
export type Insert = (typeof INSERTS)[number];

export function template(kind: Insert, o: { story: StoryDoc; langs: Languages; who: string; standin: string; narrator: string; place: string }): unknown {
  const texts = () => Object.fromEntries(allLanguages(o.langs).map(l => [l, ""]));
  const other = (o.story.cast ?? []).find(c => c !== o.standin && c !== o.narrator) ?? o.who;
  switch (kind) {
    case "line": return emptyLine(o.who, o.langs);
    case "action": return { beat: { who: o.who, wait: 600 } };
    case "narration": return emptyLine(o.narrator, o.langs, { narr: true });
    case "scene": return { scene: o.place, at: {} };
    case "choice": {
      const ids = new Set(o.story.steps.flatMap(s => ("choice" in s ? [(s as { choice: { id: string } }).choice.id] : [])));
      let n = 1; while (ids.has(`choice${n}`)) n++;
      return { choice: { id: `choice${n}`, kind: "polite", to: other, options: [{ ...texts(), ok: true }, texts()] } };
    }
    case "spot": return { spot: { lesson: (o.story.lessons ?? [])[0] ?? "", ex: "", ...Object.fromEntries(o.langs.translations.map(l => [l, ""])) } };
    case "act": {
      const ids = new Set(o.story.steps.flatMap(s => ("act" in s ? [(s as { act: { id: string } }).act.id] : [])));
      let n = 1; while (ids.has(`act${n}`)) n++;
      return { act: { id: `act${n}`, kind: "tap", targets: [], to: other, prompt: { [o.langs.main]: "" } } };
    }
  }
}

/** A step's staging as it is written (what the chips show as set). */
export const stagingIn = (step: unknown): Partial<Staging> => {
  const s = step as Obj | undefined;
  if (!s) return {};
  return stagingOf("beat" in s ? (s.beat as Obj) : s) as Partial<Staging>;
};
