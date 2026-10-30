// What the story languages share (tr.ts, en.ts): how near a thing is for a demonstrative, the gestures that point, and the
// clock lint, which reads the line's times in the language's own way (`readClock`) and holds them against the linked clock.

import type { LineContext } from "../lang.ts";

/** Within reach for a near demonstrative (bu, this; metres, on the floor plan); beyond `FAR` it is the far one (o, that). */
export const NEAR = 1.5, FAR = 3;
export const DEIXIS_GESTURES = new Set(["point", "point_far", "hold_up", "touch"]);

/** Every clock time said in a line must be the time a linked clock shows. */
export function lintClock(c: LineContext, readClock: (text: string) => { h: number; m: number }[], clockMinutes: (t: string | { h: number; m: number }) => number | null): void {
  const times = readClock(c.text);
  if (!times.length) return;
  const clocks = Object.values(c.st.link ?? {}).filter((t): t is string => t.startsWith("obj:")).map(t => t.slice(4)).filter(id => { const p = c.prop(id); return p && (p.params.time !== undefined || /clock|watch|saat/.test(p.kit)); });
  for (const id of clocks) {
    const shown = c.prop(id)!.params.time;
    const m = typeof shown === "string" ? clockMinutes(shown) : null;
    if (!times.some(t => clockMinutes(t) === m)) {
      const said = `${times[0].h}:${String(times[0].m).padStart(2, "0")}`;
      c.add("time", `the line says ${said}, but obj:${id} shows ${shown ?? "no time"}`, { obj: [{ id, op: "set", set: { time: said } }] });
    }
  }
}
