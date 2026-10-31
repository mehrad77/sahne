import {
  $,
  bar,
  button,
  choice,
  toggle
} from "./chunk-4TGKXDN4.js";
import {
  TIMES,
  WEATHER
} from "./chunk-BLASJ6YA.js";

// src/shell/env.ts
var env = (stage, e) => stage.act({ beat: { env: e } });
function envBar(stage, place, o = {}) {
  const wrap = $("div", "env");
  const q = o.ctx?.route.query, keep = (k, v) => o.ctx?.setQuery({ [k]: v });
  const act = (e) => {
    const st = stage();
    if (st) env(st, e);
  };
  const times = o.times ?? (place.times?.length ? place.times : Object.keys(TIMES));
  let slow = false;
  const timeRow = choice("time", times, q?.get("time") ?? times[0], (t) => {
    act(`time:${t}${slow ? ":6000" : ""}`);
    keep("time", t === times[0] ? null : t);
  });
  if (o.slow !== false) timeRow.append(toggle("slowly", false, (on) => {
    slow = on;
  }, "change over 6 s (env time:<t>:6000), as dusk falls in a story"));
  wrap.append(timeRow);
  if (o.weather !== false || o.lights !== false) {
    const row = bar("sky");
    if (o.weather !== false) {
      const w = choice("", Object.keys(WEATHER), q?.get("weather") ?? "clear", (v) => {
        act(`weather:${v}`);
        keep("weather", v === "clear" ? null : v);
      });
      row.append(...w.childNodes, button("thunder", () => act("thunder"), void 0, "one flash and the sound (none under Still)"));
    }
    if (o.fireworks !== false) row.append(button("fireworks", () => act("fireworks:3"), void 0, "three bursts over the far band"));
    if (o.lights !== false) row.append(toggle("lights off", q?.get("lights") === "off", (on) => {
      act(on ? "lights_off" : "lights_on");
      keep("lights", on ? "off" : null);
    }, "the place's switch: lamps marked switch:false stay lit"));
    wrap.append(row);
  }
  const states = Object.entries(place.states ?? {});
  if (o.states !== false && states.length) {
    const row = bar("state");
    const sync = () => {
      const on = stage()?.world().state ?? [];
      for (const b of row.querySelectorAll("button")) b.setAttribute("aria-pressed", String(on.includes(b.dataset.v)));
      keep("state", on.join(",") || null);
    };
    for (const [s, def] of states) {
      const b = button(def.group ? `${s} (${def.group})` : s, () => {
        const on = stage()?.world().state ?? [];
        const roll = place.pieces?.some((q2) => q2.kit === "shutter" && q2.in?.includes(s));
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
function envFromQuery(q) {
  const out = [];
  if (q.get("time")) out.push(`time:${q.get("time")}`);
  if (q.get("weather")) out.push(`weather:${q.get("weather")}`);
  for (const s of (q.get("state") ?? "").split(",").filter(Boolean)) out.push(`state:${s}`);
  if (q.get("lights") === "off") out.push("lights_off");
  return out;
}

export {
  env,
  envBar,
  envFromQuery
};
//# sourceMappingURL=chunk-T7B2O6CW.js.map
