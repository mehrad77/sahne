// What a story's steps are, for the step list and the inspector: each step's kind, and every row the list shows (a step, a
// choice's options, an option's replies) with its path. Also which edits only change words (the stage re-directs its cues)
// and which change what is drawn (the stage loads again). Pure (test/model.test.ts).

import type { StoryDoc } from "sahne-story";
import { equal, type Path } from "./path.ts";

export type StepKind = "line" | "beat" | "scene" | "spot" | "choice" | "act" | "unknown";
export const STEP_KINDS: StepKind[] = ["line", "beat", "scene", "spot", "choice", "act"];

export function kindOf(s: unknown): StepKind {
  if (!s || typeof s !== "object") return "unknown";
  const o = s as Record<string, unknown>;
  if ("who" in o) return "line";
  if ("beat" in o) return "beat";
  if ("scene" in o) return "scene";
  if ("spot" in o) return "spot";
  if ("choice" in o) return "choice";
  if ("act" in o) return "act";
  return "unknown";
}

export interface Row { path: Path; depth: 0 | 1 | 2; kind: StepKind | "option" | "reply"; n: string; who?: string; text: string; gate?: string }

const gateOf = (s: Record<string, unknown>) => (s.if ? `if ${s.if}` : s.unless ? `unless ${s.unless}` : undefined);

/** Every row of the step list, in order. */
export function rows(story: Pick<StoryDoc, "steps">): Row[] {
  const out: Row[] = [];
  (story.steps ?? []).forEach((s0, i) => {
    const s = s0 as Record<string, any>, kind = kindOf(s);
    const base = { path: ["steps", i] as Path, depth: 0 as const, kind, n: String(i), gate: gateOf(s) };
    if (kind === "line") out.push({ ...base, who: s.who, text: s.tr ?? "" });
    else if (kind === "beat") out.push({ ...base, who: s.beat?.who, text: describe(s.beat) });
    else if (kind === "scene") out.push({ ...base, text: `${s.scene}${s.time ? ` · ${s.time}` : ""}${s.weather ? ` · ${s.weather}` : ""}` });
    else if (kind === "spot") out.push({ ...base, who: "kerim", text: `${s.spot?.lesson ?? ""} · ${s.spot?.tr ?? s.spot?.ex ?? ""}` });
    else if (kind === "act") out.push({ ...base, text: `${s.act?.kind ?? ""} ${(s.act?.targets ?? []).join(" ")}${s.act?.prompt?.tr ? ` · ${s.act.prompt.tr}` : ""}` });
    else if (kind === "choice") {
      out.push({ ...base, text: `choice ${s.choice?.id ?? ""}${s.choice?.kind ? ` (${s.choice.kind})` : ""}` });
      (s.choice?.options ?? []).forEach((op: any, k: number) => {
        out.push({ path: ["steps", i, "choice", "options", k], depth: 1, kind: "option", n: `${i}.${k}`, who: "nima", text: `${op.ok ? "✓ " : ""}${op.tr ?? ""}`, gate: undefined });
        (op.reply ?? []).forEach((r: any, j: number) => out.push({ path: ["steps", i, "choice", "options", k, "reply", j], depth: 2, kind: "reply", n: `${i}.${k}.${j}`, who: r.who ?? r.beat?.who, text: r.tr ?? describe(r.beat), gate: gateOf(r) }));
      });
    } else out.push({ ...base, text: JSON.stringify(s).slice(0, 80) });
  });
  return out;
}

/** A beat's staging in a few words. */
function describe(b: Record<string, any> | undefined): string {
  if (!b) return "";
  const parts: string[] = [];
  if (b.do) parts.push(b.do);
  if (b.emo) parts.push(b.emo);
  if (b.move) parts.push(`move ${[b.move].flat().map((m: any) => `${m.who}→${m.to}`).join(", ")}`);
  if (b.obj) parts.push(`obj ${[b.obj].flat().map((o: any) => `${o.op} ${o.id}`).join(", ")}`);
  if (b.cam) parts.push(`cam ${b.cam}`);
  if (b.sfx) parts.push("sfx");
  if (b.env) parts.push(`env ${[b.env].flat().join(" ")}`);
  if (b.wait) parts.push(`wait ${b.wait}`);
  return parts.join(" · ") || "beat";
}

/** Keys whose values are words a learner reads (never what the stage draws), besides the series' language codes. */
const WORDS = ["note", "title", "titleEn", "titleFa", "summary", "summaryFa", "quiz", "gl", "followUp", "why", "q", "prompt"];
const skeleton = (v: unknown, words: ReadonlySet<string>): unknown => {
  if (Array.isArray(v)) return v.map(x => skeleton(x, words));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).filter(([k]) => !words.has(k)).map(([k, x]) => [k, skeleton(x, words)]));
  return v;
};
/** Whether `next` differs from `prev` only in words, in the series' `langs` (the stage can re-direct its cues, no load). */
export const wordsOnly = (prev: unknown, next: unknown, langs: readonly string[] = ["tr", "en", "fa"]) => {
  const words = new Set([...WORDS, ...langs]);
  return equal(skeleton(prev, words), skeleton(next, words));
};

/** Every flag a story's gates name (`if`, `unless`), for the preview's flag switches. */
export function flagsIn(story: unknown): string[] {
  const out = new Set<string>();
  const walk = (x: unknown) => {
    if (Array.isArray(x)) x.forEach(walk);
    else if (x && typeof x === "object") {
      const g = x as Record<string, unknown>;
      for (const k of ["if", "unless"]) if (typeof g[k] === "string") out.add(g[k] as string);
      Object.values(g).forEach(walk);
    }
  };
  walk((story as StoryDoc)?.steps);
  return [...out].sort();
}
