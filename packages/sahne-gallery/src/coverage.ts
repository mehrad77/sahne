// What the gallery must show, and what shows it. The engine's vocabularies (every cue kind, staging
// field, camera, move, voice, prop operation, act, env verb, particle and motion kind, time of day and
// weather) are listed from the engine itself; each must be in some system demo's `covers`
// (systems/registry.ts). The kit's views, the places and the stories enumerate their own content
// (every gesture, part, generator, sound, place and draft), so they are covered by construction; they
// and the demos together must name every DESIGN.md section from §5 to §10. test/coverage.test.ts holds
// the gallery to this; #/dev shows it.

import { ACT_KINDS, CAM_KINDS, CUE_KINDS, EMIT_KINDS, ENV_VERBS, MOTION_KINDS, MOVE_HOWS, OBJ_OPS, STAGING_FIELDS, TIMES, VOICES, WEATHER } from "sahne";
import { SYSTEMS } from "./systems/registry.ts";

/** Every engine vocabulary entry, as `<kind>:<value>`. */
export function vocabulary(): string[] {
  const of = (kind: string, values: readonly string[]) => values.map(v => `${kind}:${v}`);
  return [
    ...of("cue", CUE_KINDS), ...of("staging", STAGING_FIELDS), ...of("cam", CAM_KINDS), ...of("move", MOVE_HOWS),
    ...of("voice", VOICES), ...of("obj", OBJ_OPS), ...of("act", ACT_KINDS), ...of("env", ENV_VERBS),
    ...of("emit", EMIT_KINDS), ...of("motion", MOTION_KINDS), ...of("time", Object.keys(TIMES)), ...of("weather", Object.keys(WEATHER)),
  ];
}

/** The views beside the system demos, with the DESIGN.md sections they show. */
export const VIEWS: { hash: string; title: string; design: string[] }[] = [
  { hash: "#/kit/set", title: "Set and props", design: ["§5.5"] },
  { hash: "#/kit/people", title: "People", design: ["§5.2", "§5.3", "§10"] },
  { hash: "#/kit/gestures", title: "Gestures and faces", design: ["§5.6", "§6.3", "§6.4"] },
  { hash: "#/kit/sound", title: "Sounds and music", design: ["§8.2", "§8.3"] },
  { hash: "#/kit/kerim", title: "Kerim", design: ["§5.4"] },
  { hash: "#/kit/animals", title: "Animals", design: ["§5.4", "§6.3"] },
  { hash: "#/cast", title: "Cast", design: ["§10"] },
  { hash: "#/places", title: "Places", design: ["§5.5", "§6.6"] },
  { hash: "#/stories", title: "Stories", design: ["§5.6", "§9"] },
];

/** Which entries some demo covers, and which none does. */
export function coverage() {
  const covered = new Set(SYSTEMS.flatMap(s => s.covers));
  const all = vocabulary();
  return { all, covered: all.filter(v => covered.has(v)), missing: all.filter(v => !covered.has(v)), unknown: [...covered].filter(v => !all.includes(v) && !/^(design|kit|place):/.test(v)) };
}

/** The DESIGN.md sections the gallery names: the demos' and the views'. */
export const designShown = () => new Set([...SYSTEMS.flatMap(s => s.design), ...VIEWS.flatMap(v => v.design)]);
