// What a new version of an episode does to its steps, step by step, in the script's own words: which steps are the same,
// added, removed, moved or changed, and for a changed one its words per language (word by word), its staging as chips
// added and removed, and for a scene, beat, choice, act or spot its words before and after. Steps are matched by who says
// what (an LCS over each step's kind, speaker and main-language words), then a lost step found again elsewhere is moved,
// and a removed and an added step alike enough (same kind and speaker, close words) are one changed step. Pure
// (test/model.test.ts); ui/stepdiff.ts draws it.

import type { StoryDoc } from "sahne-story";
import { diffWords, type Part } from "./diff.ts";
import { equal } from "./path.ts";
import { chipsOf } from "./parenthetical.ts";
import { stagingIn } from "./script.ts";
import { kindOf, type StepKind } from "./steps.ts";

export type Status = "same" | "added" | "removed" | "moved" | "changed";

export interface StepChange {
  status: Status;
  /** The step's index before and after (an added step has no `was`, a removed one no `now`). */
  was?: number;
  now?: number;
  kind: StepKind;
  who?: string;
  narr?: boolean;
  /** A line's words in each language, diffed (the whole text added or removed for an added or removed step). */
  texts: { lang: string; parts: Part[]; changed: boolean }[];
  /** Its staging as chips: kept, added and removed. */
  chips: { kept: string[]; added: string[]; removed: string[] };
  /** A scene, beat, choice, act or spot in a few words, a row each (a choice's options and replies), diffed. */
  words: Part[][];
  /** Other things that changed, by key (`tone`, `if`, `ok`). */
  other: string[];
}

export interface StepDiff {
  steps: StepChange[];
  counts: { added: number; removed: number; changed: number; moved: number; staging: number };
  /** Too much changed to read as a diff: a new episode, or more than half of its steps not the same. */
  preview: boolean;
}

export interface Options { main: string; langs: readonly string[]; name?(id: string): string }

type Obj = Record<string, any>;

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/‌/g, "").toLocaleLowerCase("en").replace(/ı/g, "i")
  .replace(/[\p{P}\p{S}]/gu, " ").replace(/\s+/g, " ").trim();

/** Who does a step (a line's speaker, a beat's actor). */
const whoOf = (s: Obj): string | undefined => s?.who ?? s?.beat?.who;

/** A step's words in the main language, or what it is in a few words. */
function wordsOf(s: Obj, main: string): string[] {
  const t = (x: Obj | undefined) => (typeof x?.[main] === "string" ? x[main] : x?.tr ?? x?.ex ?? "") as string;
  switch (kindOf(s)) {
    case "line": return [t(s)];
    case "scene": return [[s.scene, s.time, s.weather].filter(Boolean).join(" · ")];
    case "spot": return [[s.spot?.lesson, t(s.spot)].filter(Boolean).join(" · ")];
    case "act": return [[s.act?.kind, ...(s.act?.targets ?? []).map((x: string) => x.replace(/^obj:/, ""))].filter(Boolean).join(" ") + (t(s.act?.prompt) ? ` · ${t(s.act?.prompt)}` : "")];
    case "choice": return [`choice ${s.choice?.id ?? ""}${s.choice?.kind ? ` (${s.choice.kind})` : ""}`, ...(s.choice?.options ?? []).flatMap((op: Obj) => [
      `${op.ok ? "✓ " : ""}${t(op)}`, ...(op.reply ?? []).map((r: Obj) => `↳ ${whoOf(r) ?? ""}: ${t(r) || stagingWords(r)}`)])];
    case "beat": return [stagingWords(s)];
    default: return [JSON.stringify(s)];
  }
}
const stagingWords = (s: Obj) => chipsOf(stagingIn(s) as Obj, x => x).map(c => c.label).join(", ");

/** What a step is, for matching: its kind, who, and its words (a choice by its id). */
const identity = (s: Obj, main: string) => {
  const k = kindOf(s);
  return `${k}|${whoOf(s) ?? ""}|${norm(k === "choice" ? String(s.choice?.id ?? "") : k === "beat" ? "" : wordsOf(s, main)[0])}`;
};

/** How alike two texts are, by their words (Dice: 1 the same words, 0 none shared). */
function alike(a: string, b: string): number {
  const x = norm(a).split(" ").filter(Boolean), y = norm(b).split(" ").filter(Boolean);
  if (!x.length && !y.length) return 1;
  const left = [...y];
  let shared = 0;
  for (const w of x) { const i = left.indexOf(w); if (i >= 0) { shared++; left.splice(i, 1); } }
  return (2 * shared) / (x.length + y.length);
}

/** Index pairs of a longest common subsequence of two lists of keys. */
function lcs(a: string[], b: string[]): [number, number][] {
  const n = a.length, m = b.length, L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: [number, number][] = [];
  for (let i = 0, j = 0; i < n && j < m;) {
    if (a[i] === b[j]) out.push([i++, j++]);
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  return out;
}

const whole = (op: Part["op"], text: string): Part[] => (text ? [{ op, text }] : []);
const diffRows = (a: string[], b: string[]): Part[][] => Array.from({ length: Math.max(a.length, b.length) }, (_, k) => diffWords(a[k] ?? "", b[k] ?? ""));

/** One step, before (`a`) and after (`b`); either may be missing (added, removed). */
function entry(status: Status, a: Obj | undefined, b: Obj | undefined, was: number | undefined, now: number | undefined, o: Options): StepChange {
  const s = (b ?? a)!, kind = kindOf(s), name = o.name ?? ((x: string) => x);
  const out: StepChange = { status, was, now, kind, who: whoOf(s), narr: s.narr === true || undefined, texts: [], chips: { kept: [], added: [], removed: [] }, words: [], other: [] };
  if (kind === "line") {
    for (const l of o.langs) {
      const x = typeof a?.[l] === "string" ? a[l] as string : "", y = typeof b?.[l] === "string" ? b[l] as string : "";
      if (!x && !y) continue;
      out.texts.push({ lang: l, parts: !a ? whole("+", y) : !b ? whole("-", x) : diffWords(x, y), changed: !!a && !!b && x !== y });
    }
  } else if (kind !== "beat") {
    const x = a ? wordsOf(a, o.main) : [], y = b ? wordsOf(b, o.main) : [];
    out.words = !a ? y.map(t => whole("+", t)) : !b ? x.map(t => whole("-", t)) : diffRows(x, y);
  }
  if (kind === "line" || kind === "beat") {
    const ca = a ? chipsOf(stagingIn(a) as Obj, name).map(c => c.label) : [], cb = b ? chipsOf(stagingIn(b) as Obj, name).map(c => c.label) : [];
    out.chips = { kept: cb.filter(c => ca.includes(c)), added: cb.filter(c => !ca.includes(c)), removed: ca.filter(c => !cb.includes(c)) };
    if (!a || !b) out.chips = { kept: [], added: b ? cb : [], removed: a ? ca : [] };
  }
  if (a && b) {
    // what the texts and chips above do not say
    const said = new Set([...o.langs, "who", ...(kind === "line" || kind === "beat" ? ["beat", "to", "emo", "do", "at", "move", "obj", "cam", "voice", "sfx", "react", "link", "via"] : [kind])]);
    out.other = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => !said.has(k) && !equal(a[k], b[k]));
    if (kind === "beat") out.other.push(...[...new Set([...Object.keys(a.beat ?? {}), ...Object.keys(b.beat ?? {})])].filter(k => !["who", "do", "emo", "to", "at", "move", "obj", "cam", "voice", "sfx", "react", "link", "via"].includes(k) && !equal(a.beat?.[k], b.beat?.[k])));
  }
  return out;
}

/** The steps of `now` against `was` (null: a new episode). `main` is the language steps are matched by. */
export function stepDiff(was: Pick<StoryDoc, "steps"> | null | undefined, now: Pick<StoryDoc, "steps">, o: Options): StepDiff {
  const A = (was?.steps ?? []) as Obj[], B = (now.steps ?? []) as Obj[];
  const ka = A.map(s => identity(s, o.main)), kb = B.map(s => identity(s, o.main));
  const toB = new Map<number, number>(), toA = new Map<number, number>(), moved = new Set<number>();
  const pair = (i: number, j: number) => { toB.set(i, j); toA.set(j, i); };
  const anchors = lcs(ka, kb);
  anchors.forEach(([i, j]) => pair(i, j));
  // a step lost here and found there, the same: moved
  B.forEach((_, j) => {
    if (toA.has(j)) return;
    const i = ka.findIndex((k, i) => k === kb[j] && !toB.has(i));
    if (i >= 0) { pair(i, j); moved.add(j); }
  });
  // in each gap between anchors: a removed and an added step of the same kind and speaker, alike enough, are one changed step
  const bounds: [number, number][] = [[-1, -1], ...anchors, [A.length, B.length]];
  for (let g = 0; g + 1 < bounds.length; g++) {
    const [i0, j0] = bounds[g], [i1, j1] = bounds[g + 1];
    const as = Array.from({ length: i1 - i0 - 1 }, (_, k) => i0 + 1 + k).filter(i => !toB.has(i));
    const bs = Array.from({ length: j1 - j0 - 1 }, (_, k) => j0 + 1 + k).filter(j => !toA.has(j));
    let after = -1;
    as.forEach((i, ai) => {
      let best = -1, score = 0;
      bs.forEach((j, bi) => {
        if (j <= after || kindOf(A[i]) !== kindOf(B[j]) || whoOf(A[i]) !== whoOf(B[j])) return;
        // alike words, or (for a beat, or a lone step changed in place) the same place in an even gap
        const sc = kindOf(A[i]) === "beat" ? 1 : Math.max(alike(wordsOf(A[i], o.main).join(" "), wordsOf(B[j], o.main).join(" ")), as.length === bs.length && ai === bi ? 0.5 : 0);
        if (sc >= 0.5 && sc > score) { best = j; score = sc; }
      });
      if (best >= 0) { pair(i, best); after = best; }
    });
  }
  // walk both lists in order: the removed where they were, the rest in the new order
  const steps: StepChange[] = [];
  for (let i = 0, j = 0; i < A.length || j < B.length;) {
    if (i < A.length && (!toB.has(i) || moved.has(toB.get(i)!))) { if (!toB.has(i)) steps.push(entry("removed", A[i], undefined, i, undefined, o)); i++; continue; }
    if (j < B.length && (!toA.has(j) || moved.has(j))) {
      steps.push(toA.has(j) ? entry("moved", A[toA.get(j)!], B[j], toA.get(j), j, o) : entry("added", undefined, B[j], undefined, j, o));
      j++; continue;
    }
    steps.push(entry(equal(A[i], B[j]) ? "same" : "changed", A[i], B[j], i, j, o));
    i++; j++;
  }
  const n = (st: Status) => steps.filter(x => x.status === st).length;
  const counts = { added: n("added"), removed: n("removed"), changed: n("changed"), moved: n("moved"), staging: steps.filter(x => x.status !== "added" && x.status !== "removed" && (x.chips.added.length || x.chips.removed.length)).length };
  // a new (or empty) episode, or more than half of the longer version's steps not the same
  const preview = !was || !A.length || steps.filter(x => x.status !== "same").length / Math.max(A.length, B.length) > 0.5;
  return { steps, counts, preview };
}
