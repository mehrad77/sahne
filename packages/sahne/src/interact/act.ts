// The act state machine (DESIGN.md §9): the learner tries targets until one is accepted. No
// buzzer: a wrong try is only counted. After two misses the answer is hinted (a gaze, a soft
// glow); after the third it is shown and the act completes with it, so an act never blocks.
// Pure: the stage's interaction layer (interact/index.ts) feeds it tries and plays what it says.

import type { Act, ActCue, Target } from "../script/types.ts";
import type { PlaceDoc } from "../core/types.ts";
import type { PropState } from "../script/world.ts";
import { isTarget, parseTarget } from "./hit.ts";

/** Misses before the hint, and before the answer is shown and the act completes. */
export const HINT_AT = 2, SHOW_AT = 3;

export interface ActState {
  misses: number;
  /** The hint has been given. */
  hinted: boolean;
  /** The answer was shown after the last miss (or the act was skipped). */
  shown: boolean;
  /** The accepted target, once there is one. */
  result: Target | null;
  /** Every try in order, the accepted one last. */
  tries: Target[];
}

export type Outcome =
  /** Accepted: the act is done. */
  | "hit"
  /** A wrong target: counted, nothing more (no buzzer). */
  | "miss"
  /** The second miss: hint now. */
  | "hint"
  /** The third miss: show the answer; the act is done with it. */
  | "show"
  /** Not one of the act's targets (a tap on a wall, on someone not asked about): not counted. */
  | "ignore";

export const startAct = (): ActState => ({ misses: 0, hinted: false, shown: false, result: null, tries: [] });

/** The act's own target a hit stands for (`ch:ismail.hand` stands for `ch:ismail`), or null. */
export function targetOf(a: Act, hit: Target): Target | null {
  return a.targets.find(t => isTarget(t, hit)) ?? null;
}

/** Try a target (a hit, or a button of the accessible list). Returns the new state and what to do. */
export function tryAct(a: Act, s: ActState, hit: Target): { s: ActState; out: Outcome } {
  if (s.result) return { s, out: "ignore" };
  const t = targetOf(a, hit);
  if (!t) return { s, out: "ignore" };
  const tries = [...s.tries, t];
  if (!a.expect || t === a.expect) return { s: { ...s, tries, result: t }, out: "hit" };
  const misses = s.misses + 1;
  if (misses >= SHOW_AT) return { s: { ...s, tries, misses, shown: true, result: a.expect }, out: "show" };
  if (misses >= HINT_AT && !s.hinted) return { s: { ...s, tries, misses, hinted: true }, out: "hint" };
  return { s: { ...s, tries, misses }, out: "miss" };
}

/** The app moved on without an answer (or asked for it to be shown): the expected target, or the first. */
export function skipAct(a: Act, s: ActState): ActState {
  return s.result ? s : { ...s, shown: true, result: a.expect ?? a.targets[0] ?? null };
}

/** The cue with the learner's answer written in: `fold` and the director play it from here on. */
export const resolvedCue = (c: ActCue, result: Target | null): ActCue => ({ act: { ...c.act, ...(result ? { result } : {}) } });

/** The prop a drag moves: `obj`, else the first `obj:` target. */
export const dragged = (a: Act): string | undefined => a.obj ?? a.targets.find(t => t.startsWith("obj:"))?.slice(4);

// ---- Names and inspect -----------------------------------------------------------------------

/** What names and terms come from: the app's names (actor ids, or targets such as `obj:sut`) and the cast's terms, the place, its props now. */
export interface SceneInfo { names: Record<string, string>; terms: Record<string, string[]>; place: PlaceDoc | null; props: Record<string, PropState> }

export interface InspectEvent {
  /** What was tapped: `obj:ekmek`, `ch:ismail.hand`, `piece:door`. */
  target: Target;
  kind: "actor" | "prop" | "piece";
  /** The actor, the prop instance or the piece. */
  id: string;
  /** The body part, for an actor. */
  part?: string;
  /** The place's prop the instance came from. */
  of?: string;
  /** The app's ids for it (the prop's `terms`, the cast's `terms`, a piece's `terms`). */
  terms: string[];
  name?: string;
  via: "pointer" | "list";
  /** Where, in CSS pixels inside the stage (pointer only). */
  x?: number; y?: number;
}

/** A prop instance by its id, or the first instance of a place's prop. */
export const propOf = (props: Record<string, PropState>, id: string): PropState | undefined => props[id] ?? Object.values(props).find(p => p.of === id);

/** A target's name: the app's (by target, else by actor id or place prop), else the place prop's `name`, else its id. */
export function nameOf(t: Target, c: SceneInfo): string {
  const n = c.names, { kind, id } = parseTarget(t);
  if (n[t]) return n[t];
  if (kind === "ch") return n[id] ?? id;
  if (kind === "obj") {
    const of = propOf(c.props, id)?.of ?? id.split("#")[0], ref = c.place?.props?.[of];
    return n["obj:" + of] ?? (typeof ref?.name === "string" ? ref.name : of);
  }
  return id;
}

/** What `inspect` reports for a tapped target: a person or a prop, or a set piece that has `terms`; null for anything else. */
export function inspectOf(t: Target, c: SceneInfo, via: "pointer" | "list", x?: number, y?: number): InspectEvent | null {
  const { kind, id, part } = parseTarget(t), at = x === undefined ? {} : { x, y };
  if (kind === "ch") return { target: t, kind: "actor", id, ...(part ? { part } : {}), terms: c.terms[id] ?? [], name: nameOf("ch:" + id, c), via, ...at };
  if (kind === "obj") {
    const of = propOf(c.props, id)?.of ?? id.split("#")[0];
    return { target: t, kind: "prop", id, of, terms: c.place?.props?.[of]?.terms ?? [], name: nameOf(t, c), via, ...at };
  }
  if (kind === "piece" && id) {
    const ref = c.place?.pieces.find(q => q.id === id), terms = Array.isArray(ref?.terms) ? ref.terms as string[] : [];
    return terms.length ? { target: t, kind: "piece", id, terms, name: c.names[t] ?? id, via, ...at } : null;
  }
  return null;
}
