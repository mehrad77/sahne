// The env bar: one set of controls for a place on stage, used by every section (DESIGN.md §6.5, §5.5).
// Time of day (with a slow change), weather, thunder, the lights, the place's states and fireworks,
// each played as the script would (`env` on a beat), so what the gallery shows is what a story gets.

import { TIMES, WEATHER, type PlaceDoc, type Stage } from "sahne";
import { $, bar, button, choice, toggle } from "./dom.ts";
import type { Ctx } from "./ctx.ts";

export interface EnvOptions {
  /** The times offered (default: the place's, else every time). */
  times?: string[];
  /** Leave out a control. */
  weather?: boolean; lights?: boolean; states?: boolean; fireworks?: boolean; slow?: boolean;
  /** Keep the choices in the URL (`time`, `weather`, `state`, `lights`) and start from them. */
  ctx?: Ctx;
}

/** Plays one env string on the stage now. */
export const env = (stage: Stage, e: string | string[]) => stage.act({ beat: { env: e } });

export function envBar(stage: () => Stage | undefined, place: PlaceDoc, o: EnvOptions = {}): HTMLElement {
  const wrap = $("div", "env");
  const q = o.ctx?.route.query, keep = (k: string, v: string | null) => o.ctx?.setQuery({ [k]: v });
  const act = (e: string | string[]) => { const st = stage(); if (st) env(st, e); };
  const times = o.times ?? (place.times?.length ? place.times : Object.keys(TIMES));
  let slow = false;
  const timeRow = choice("time", times, q?.get("time") ?? times[0], t => { act(`time:${t}${slow ? ":6000" : ""}`); keep("time", t === times[0] ? null : t); });
  if (o.slow !== false) timeRow.append(toggle("slowly", false, on => { slow = on; }, "change over 6 s (env time:<t>:6000), as dusk falls in a story"));
  wrap.append(timeRow);
  if (o.weather !== false || o.lights !== false) {
    const row = bar("sky");
    if (o.weather !== false) {
      const w = choice("", Object.keys(WEATHER), q?.get("weather") ?? "clear", v => { act(`weather:${v}`); keep("weather", v === "clear" ? null : v); });
      row.append(...w.childNodes, button("thunder", () => act("thunder"), undefined, "one flash and the sound (none under Still)"));
    }
    if (o.fireworks !== false) row.append(button("fireworks", () => act("fireworks:3"), undefined, "three bursts over the far band"));
    if (o.lights !== false) row.append(toggle("lights off", q?.get("lights") === "off", on => { act(on ? "lights_off" : "lights_on"); keep("lights", on ? "off" : null); }, "the place's switch: lamps marked switch:false stay lit"));
    wrap.append(row);
  }
  const states = Object.entries(place.states ?? {});
  if (o.states !== false && states.length) {
    const row = bar("state");
    const sync = () => {
      const on = stage()?.world().state ?? [];
      for (const b of row.querySelectorAll<HTMLButtonElement>("button")) b.setAttribute("aria-pressed", String(on.includes(b.dataset.v!)));
      keep("state", on.join(",") || null);
    };
    for (const [s, def] of states) {
      const b = button(def.group ? `${s} (${def.group})` : s, () => {
        const on = stage()?.world().state ?? [];
        // a group's state turns its others off; a toggle turns off again
        // a roller shutter takes its time
        const roll = place.pieces?.some(q => q.kit === "shutter" && q.in?.includes(s));
        act(`state:${on.includes(s) && !def.group ? "-" : ""}${s}:${roll ? "roll" : "fade"}`);
        sync();
      }, !!def.default);
      b.dataset.v = s;
      row.append(b);
    }
    wrap.append(row);
  }
  return wrap;
}

/** The env strings a route's query asks for (`time`, `weather`, `state`, `lights`), to play once a place is loaded. */
export function envFromQuery(q: URLSearchParams): string[] {
  const out: string[] = [];
  if (q.get("time")) out.push(`time:${q.get("time")}`);
  if (q.get("weather")) out.push(`weather:${q.get("weather")}`);
  for (const s of (q.get("state") ?? "").split(",").filter(Boolean)) out.push(`state:${s}`);
  if (q.get("lights") === "off") out.push("lights_off");
  return out;
}
