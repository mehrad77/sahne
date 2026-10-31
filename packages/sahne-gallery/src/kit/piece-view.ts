// #/kit/set/<id>: one generator live on a stage, beside a 170 cm figure, with every param its meta
// declares as a control, its variants and seeds, the env bar (time, weather, lights, its states), held
// in a hand for a prop, and what it is to the places: who uses it, what the briefs ask of it, its words.
// Explore is on, so an animal answers a tap as a learner's (FlatReact.tap). Everything chosen is in the URL.

import { interact, rng, withVariant, type ParamSpec, type ParamType, type Stage } from "sahne";
import { $, bar, button, chip, choice, facts, frame, head, link, select, toggle } from "../shell/dom.ts";
import { envBar, envFromQuery, env } from "../shell/env.ts";
import type { Ctx } from "../shell/ctx.ts";
import { thumb } from "../shell/thumbs.ts";
import { pieceSvg } from "sahne-kit/set-svg";
import { generator, usage, asked, FEATURES } from "./catalog.ts";
import { solo } from "./solo.ts";

const kinds = (s: ParamSpec): readonly ParamType[] => typeof s.type === "string" ? [s.type] : s.type;

/** A param's text as the value a place would write: true/false, a number, JSON for a list or record, else the text. */
export function parseParam(raw: string): unknown {
  const t = raw.trim();
  if (t === "true" || t === "false") return t === "true";
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  if (/^[[{]/.test(t)) { try { return JSON.parse(t); } catch { return t; } }
  return raw;
}
const showParam = (v: unknown) => typeof v === "string" ? v : JSON.stringify(v);

export async function render(host: HTMLElement, ctx: Ctx, id: string) {
  const g = generator(id);
  if (!g) { host.append($("h1", "", id), $("p", "note bad", "No such set piece or prop."), link("← every piece", "#/kit/set")); return; }
  const q = ctx.route.query, meta = g.meta;
  const [places, needs, cards, sizes] = await Promise.all([ctx.data("places").catch(() => []), ctx.data("needs").catch(() => ({})), ctx.data("cards").catch(() => ({})), ctx.data("sizes").catch(() => [])]);
  const word = (c: string) => (cards as Record<string, { tr: string; level?: string }> | null)?.[c];

  // ---- the state, from the URL ----
  const own: Record<string, unknown> = {};
  for (const [k, v] of q) if (k.startsWith("p.")) own[k.slice(2)] = parseParam(v);
  const st = {
    variant: q.get("variant") ?? "", seed: q.get("seed") ?? "a",
    as: (q.get("as") ?? (g.kind === "prop" ? "prop" : "piece")) as "piece" | "prop",
    figure: q.get("figure") === null ? undefined : q.get("figure") === "1", held: q.get("held") === "1",
    ground: (q.get("ground") ?? "floor") as "floor" | "room" | "none",
  };
  const params = () => ({ ...(st.variant ? { variant: st.variant } : {}), ...own });

  const title = $("div", "");
  const h = head(g.id, meta?.about ?? "(no meta: SET.md and the controls need one)");
  h.querySelector("h2")!.append(" ", chip(g.family), " ", chip(g.kind === "both" ? "piece and prop" : g.kind));
  title.append(link("← every piece", "#/kit/set"), h);
  // an item promoted from a story is credited to its author (SET.md's Credits, CREDITS.json)
  if (g.credit) title.append($("p", "note", `Drawn by ${g.credit.by} (${g.credit.contact}), ${g.credit.date}${g.credit.story ? `, for ${g.credit.story}` : ""}. CC BY 4.0. A story's old id ${g.credit.from} still leads here.`));
  host.append(title);

  // ---- the stage ----
  const cols = $("div", "cols"), left = $("div"), right = $("div");
  cols.append(left, right);
  host.append(cols);
  const box = frame("16 / 10");
  left.append(box);
  let stage: Stage | null = ctx.mount(box, { bubbles: false });
  // explore, before the scene loads (the atlas's alpha masks): a tapped dog looks up and barks, a pigeon flutters
  interact(stage, { explore: true });
  const warn = $("p", "note");
  const load = () => {
    if (!stage) return;
    const { place, cues, cast } = solo(g, { as: st.as, params: params(), seed: st.seed, figure: st.figure, held: st.held && st.as === "prop", ground: st.ground });
    stage.load({ v: 1, cues }, { cast, places: { solo: place } });
    stage.show(cues.length - 1);
    const e = envFromQuery(ctx.route.query);
    if (e.length) env(stage, e);
    // what the drawing read that its meta doesn't declare (test/meta.test.ts checks the kit's own variants)
    const read = new Set<string>();
    const watch = new Proxy(withVariant(g.def, params()), { get(t, k) { if (typeof k === "string") read.add(k); return Reflect.get(t, k); } });
    try { g.def.draw(watch, rng(st.seed), ctx.kit); } catch (err) { warn.textContent = `draw failed: ${(err as Error).message}`; return; }
    const odd = [...read].filter(k => !["variant", "held"].includes(k) && !Object.hasOwn(meta?.params ?? {}, k));
    warn.textContent = odd.length ? `reads params its meta does not declare: ${odd.join(", ")}` : "";
    warn.className = odd.length ? "note bad" : "note";
  };
  const save = () => ctx.setQuery({ variant: st.variant || null, seed: st.seed === "a" ? null : st.seed, as: st.as === (g.kind === "prop" ? "prop" : "piece") ? null : st.as,
    figure: st.figure === undefined ? null : st.figure ? "1" : "0", held: st.held ? "1" : null, ground: st.ground === "floor" ? null : st.ground });

  // ---- the controls ----
  const looks = ["", ...g.variants];
  left.append(
    choice("look", looks, st.variant, v => { st.variant = v; save(); load(); syncControls(); }, Object.fromEntries([["", "default"]])),
    bar("seed", ...["a", "b", "c", "d"].map(s => button(s, () => { st.seed = s; save(); load(); for (const b of seedRow.querySelectorAll<HTMLButtonElement>("button")) b.setAttribute("aria-pressed", String(b.textContent === s)); }, s === st.seed))),
  );
  const seedRow = left.lastElementChild as HTMLElement;
  const view = bar("view",
    toggle("figure", st.figure ?? true, on => { st.figure = on; save(); load(); }, "the 170 cm figure beside it, for scale"),
    select("", [["floor", "on a floor"], ["room", "a floor and a wall"], ["none", "nothing behind"]], st.ground, v => { st.ground = v as typeof st.ground; save(); load(); }),
  );
  if (g.kind === "both") view.append(choice("", ["piece", "prop"], st.as, v => { st.as = v; save(); load(); }, { piece: "as a piece", prop: "as a prop" }));
  if (g.kind !== "piece") view.append(toggle("in a hand", st.held, on => { st.held = on; if (on) st.as = "prop"; save(); load(); }, "held: the prop's grip in the figure's hand"));
  left.append(view);
  left.append(envBar(() => stage ?? undefined, { id: "solo", name: { tr: "", en: "" }, size: { w: 6, d: 6 }, pieces: [], marks: {}, times: ["day", "golden", "dusk", "night"], states: Object.fromEntries((meta?.states ?? []).map(s => [s, {}])) } as never, { ctx, times: ["day", "golden", "dusk", "night", "dawn", "overcast"] }), warn);

  // the params, from the meta
  const form = $("div", "params");
  const controls = new Map<string, (v: unknown) => void>();
  const setOwn = (name: string, v: unknown) => {
    if (v === undefined) delete own[name]; else own[name] = v;
    ctx.setQuery({ [`p.${name}`]: v === undefined ? null : showParam(v) });
    load();
  };
  for (const [name, spec] of Object.entries(meta?.params ?? {}).sort(([a], [b]) => a < b ? -1 : 1)) {
    const ks = kinds(spec), row = $("label", "param");
    const tip = [ks.join(" or "), spec.values ? `: ${spec.values.join(", ")}` : "", spec.min !== undefined || spec.max !== undefined ? ` ${spec.min ?? ""}–${spec.max ?? ""}` : "", spec.default !== undefined ? ` (default ${showParam(spec.default)})` : "", spec.about ? ` · ${spec.about}` : ""].join("");
    row.title = tip;
    row.append($("code", "", name));
    let input: HTMLInputElement | HTMLSelectElement;
    if (ks.length === 1 && ks[0] === "enum") {
      input = $("select");
      input.append(Object.assign($("option", "", spec.default !== undefined ? `– (${spec.default})` : "–"), { value: "" }), ...(spec.values ?? []).map(v => Object.assign($("option", "", v), { value: v })));
      input.onchange = () => setOwn(name, (input as HTMLSelectElement).value || undefined);
    } else if (ks.length === 1 && ks[0] === "bool") {
      input = $("select");
      input.append(...[["", spec.default !== undefined ? `– (${spec.default ? "on" : "off"})` : "–"], ["true", "on"], ["false", "off"]].map(([v, l]) => Object.assign($("option", "", l), { value: v })));
      input.onchange = () => { const v = (input as HTMLSelectElement).value; setOwn(name, v ? v === "true" : undefined); };
    } else {
      input = Object.assign($("input"), { type: "text", placeholder: spec.default !== undefined ? showParam(spec.default) : ks.join("/") });
      if (ks.includes("color")) { input.setAttribute("list", "palette-ids"); }
      input.onchange = () => { const v = (input as HTMLInputElement).value; setOwn(name, v === "" ? undefined : parseParam(v)); };
      if (ks.length === 1 && (ks[0] === "int" || ks[0] === "num") && spec.min !== undefined && spec.max !== undefined) {
        const range = Object.assign($("input"), { type: "range", min: String(spec.min), max: String(spec.max), step: ks[0] === "int" ? "1" : String((spec.max - spec.min) / 100) });
        range.oninput = () => { (input as HTMLInputElement).value = range.value; setOwn(name, Number(range.value)); };
        row.append(range);
      }
    }
    controls.set(name, v => { input.value = v === undefined ? "" : showParam(v); });
    row.append(input);
    if (spec.about) row.append($("small", "", spec.about));
    form.append(row);
  }
  const syncControls = () => { const p = withVariant(g.def, params()); for (const [n, c] of controls) c(Object.hasOwn(own, n) ? own[n] : st.variant ? p[n] : undefined); };
  syncControls();
  const datalist = $("datalist");
  datalist.id = "palette-ids";
  for (const id of [...Object.keys(ctx.kit.palettes.fabric ?? {}), ...Object.keys(ctx.kit.palettes.set ?? {})]) datalist.append(Object.assign($("option"), { value: id }));
  right.append($("h3", "", `Params · ${Object.keys(meta?.params ?? {}).length}`), $("p", "note", "Blank is the default (or the look's). Lists and records are JSON. Hover a name for its kind and values."), form, datalist,
    button("reset params", () => { for (const k of Object.keys(own)) { delete own[k]; ctx.setQuery({ [`p.${k}`]: null }); } syncControls(); load(); }));
  load();
  ctx.cleanup(() => { stage = null; });

  // ---- the looks side by side: each variant at three seeds ----
  const strip = $("div", "grid");
  for (const v of looks) for (const seed of ["a", "b", "c"]) {
    const t = $("a", "tile"), art = $("div", "art");
    t.href = `#/kit/set/${g.id}?${new URLSearchParams({ ...(v ? { variant: v } : {}), ...(seed !== "a" ? { seed } : {}) })}`;
    t.onclick = e => { e.preventDefault(); st.variant = v; st.seed = seed; for (const k of Object.keys(own)) delete own[k]; ctx.setQuery(Object.fromEntries([...ctx.route.query.keys()].filter(k => k.startsWith("p.")).map(k => [k, null]))); save(); load(); syncControls(); window.scrollTo({ top: 0, behavior: "smooth" }); };
    try { art.innerHTML = pieceSvg(ctx.kit, g.def, v ? { variant: v } : {}, `${g.id}/${seed}`, 120) || "<i>none</i>"; } catch { /* the stage's thumbnail follows */ }
    thumb(ctx, g, { as: g.kind === "prop" ? "prop" : "piece", params: v ? { variant: v } : {}, seed, figure: false, ground: "floor" }).then(url => { if (url) art.replaceChildren(Object.assign($("img"), { src: url, alt: "" })); });
    t.append(art, $("div", "cap", `${v || "default"} · ${seed}`));
    strip.append(t);
  }
  host.append($("h2", "", `Every look, three seeds · ${looks.length * 3}`), $("p", "note", "A piece's seed comes from its place and id (pieceSeed), so the same piece looks the same across a site; a prop's from its id in the place."), strip);

  // ---- what it is to the places ----
  const uses = usage(places).get(g.id) ?? [], asks = asked(needs).get(g.id) ?? [];
  const size = sizes.find(s => s.name === `set family ${g.family}`);
  const termList = (ids: string[]) => {
    const s = $("span");
    for (const c of ids) { const w = word(c); s.append(chip(w ? `${w.tr}${w.level ? ` · ${w.level}` : ""}` : `${c}?`, w ? (w.level === "A1" ? "ok" : "") : "bad", c), " "); }
    return s;
  };
  const used = $("span");
  for (const u of uses) used.append(link(u.place, `#/places/${u.place}`), ` (${u.as}${u.variant ? ` ${u.variant}` : ""}) `);
  const askedEl = $("span");
  for (const a of asks) { askedEl.append(link(a.place, `#/places/${a.place}`), ` ${a.name}${a.variant ? ` (${a.variant})` : ""}${a.story ? ", for a story" : ""} `, termList(a.terms), $("br")); }
  host.append($("h2", "", "In the places"), facts([
    ["family", `${g.family}${size ? ` · its chunk ${(size.gzip / 1024).toFixed(1)} KB of ${size.budget ? (size.budget / 1024).toFixed(0) : "–"} KB` : ""}`],
    ["does", [...g.features].map(f => FEATURES[f]).join(" · ") + (g.emit.size ? ` (${[...g.emit].join(", ")})` : "") + (g.motion.size ? ` (${[...g.motion].join(", ")})` : "")],
    ["states", meta?.states?.join(", ")],
    ["its words", meta?.terms?.length ? termList(meta.terms) : null],
    ["tags", meta?.tags?.join(", ")],
    ["used in", uses.length ? used : "no place yet"],
    ["asked for", asks.length ? askedEl : null],
  ]));
}
