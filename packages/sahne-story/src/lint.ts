// The story lints (Kumru's STORIES_STAGE.md §4): staging that contradicts the text it stages. They walk the story as
// the stage would play it, keeping where everyone stands and which props are shown, and read each line with the
// series' story language (src/lang.ts; Turkish's own lints, deixis, var/yok, numbers and clock times, are in
// langs/tr.ts):
//
//   budget    one gesture per speaker and a word that motivates it, one move per character, two reactions, `on` a word of the line
//   via       a phone or video line needs its speaker off stage
//   silent    voice "silent" only on a stand-in line whose text is "…"
//   link      every link key is a word of its line, and every obj: target is a prop on stage
//   standin   no two stand-in lines in a row; the learner's first turn within the first four lines
//   mechanics an act needs `act` among the arc's mechanics
//   props     a story prop stands only in places the story visits, on marks they have, and shadows no place's own prop
//   place     every scene's place exists (a site names one of its places); its `at`, `kerim`, every move's `to` and every
//             `obj go`'s marks are marks there,
//             there in the place's states now; its states (`state`, `env state:`) and time are ones the place has
//   look      a change of clothes (looks.ts) names someone the story has and an outfit they own, clothing only, parts the
//             kit draws on that body, only on the story, a scene, a line or a beat; for the learner only a coat and a hat
//
// A problem can carry a `fix`: the staging that would settle it. `suggest()` returns the fixes plus
// the links a line could have (the `--suggest` of Kumru's STORIES_STAGE.md §4).

import { applyLook, inState, placeState, route, detour, WEATHER, CLOTHING_FIELDS, lookFields, normalize, type AvatarDoc, type AvatarNote, type KitManifest, type Look, type PlaceDoc, type PropRef, type Solid, type Staging, type Target, type Vec3 } from "sahne";
import { langFor, type LineContext, type StoryLang } from "./lang.ts";
import { DEIXIS_GESTURES } from "./langs/tr.ts";
import { placesOf, storyProps } from "./props.ts";
import { canon, dress, forLearner, LEARNER_FIELDS, looksOf } from "./looks.ts";
import { isAct, isBeat, isChoice, isLine, isScene, isSpot, NARRATOR, STANDIN, type BeatStep, type CharacterDoc, type ChoiceOption, type LineStep, type LookRef, type StoryDoc } from "./types.ts";

export type Rule = "deixis" | "var_yok" | "number" | "budget" | "via" | "silent" | "time" | "link" | "standin" | "mechanics" | "props" | "look" | "place" | "route";

export interface Problem {
  rule: Rule;
  level: "error" | "warning";
  /** The story step; `option` and `reply` point inside a choice. */
  step: number;
  option?: number;
  reply?: number;
  message: string;
  /** Staging that would settle it, to merge into the line. */
  fix?: Staging;
}

export interface LintOptions {
  places: Record<string, PlaceDoc>;
  /** The characters, for `look`: who exists, their outfits and avatars; and whether Kerim is on stage (`puppet`). */
  characters?: Record<string, CharacterDoc>;
  /** The kit, for `look`: the parts a change of clothes names exist, fit their slot and the body's build, and fit in 2 KB. */
  kit?: KitManifest;
  /** Each place's solid lines (`placeSolids` from sahne): a walk that goes round one is a warning, one with no way through an error. */
  solids?: Record<string, Solid[]>;
  /** The story language of the series' main language (src/lang.ts); Turkish without one. */
  lang?: StoryLang;
}

export { NEAR, FAR } from "./langs/tr.ts";

type Vec = { x: number; z: number };
interface PropState { shown: boolean; n?: number; params: Record<string, unknown>; at: Vec | null; holder?: string; kit: string; names: string[]; keep?: boolean; /** waiting for another place of this site */ site?: string }
/** `away`: the kept props of places left behind, as last seen (sahne's `enterPlace`). */
interface State { id: string | null; place: PlaceDoc | null; on: Record<string, string | null>; props: Record<string, PropState>; away: Record<string, PropState> }

/** A unit of staging the stage performs: a line, a picked option, a reply line or a beat. */
interface Unit { who?: string; text?: string; st: Staging; at: Pick<Problem, "step" | "option" | "reply">; standin: boolean }


/** The props on stage that a word names: its `link`, else one whose id or card term it is a form of. */
function linkOf(lang: StoryLang, word: string, st: Staging, props: Record<string, PropState>): Target | null {
  for (const [k, t] of Object.entries(st.link ?? {})) if (lang.match(word, k)) return t;
  const a = lang.fold(word.split("'")[0]);
  for (const [id, p] of Object.entries(props)) for (const n of p.names) if (lang.match(word, n) || a === n || lang.match(a, n)) return `obj:${id}`;
  return null;
}

function startProps(place: PlaceDoc, extra: Record<string, PropRef>, fold: (w: string) => string): Record<string, PropState> {
  const out: Record<string, PropState> = {};
  for (const [id, ref] of Object.entries({ ...(place.props ?? {}), ...extra })) {
    const { kit, at, n, terms, shown, keep, in: _in, ...params } = ref;
    const pos = typeof at === "string" ? place.marks[at] ?? null : at;
    out[id] = { kit, n: typeof n === "number" ? n : undefined, params, shown: shown !== false, at: pos ? { x: pos.x, z: pos.z } : null, names: [id, ...(terms ?? []).map(t => fold(t.split("-").pop() ?? t))], ...(keep ? { keep } : {}) };
  }
  return out;
}

/** The world a scene starts: in the same place the props stay and whoever leaves takes what they hold; a new place follows `enterPlace` (a place of the same site carries every prop). */
function sceneState(story: StoryDoc, s: State, id: string, place: PlaceDoc | null, at: Record<string, string>, fold: (w: string) => string): State {
  const on: Record<string, string | null> = Object.fromEntries(Object.entries(at).filter(([, m]) => !place || place.marks[m]));
  const props = Object.fromEntries(Object.entries(s.props).map(([k, p]) => [k, { ...p, params: { ...p.params } }]));
  if (s.id === id) {
    for (const p of Object.values(props)) if (p.holder && !on[p.holder]) { p.holder = undefined; p.shown = false; }
    return { id, place, on, props, away: s.away };
  }
  if (!place) return { id, place, on, props: {}, away: s.away };
  const site = place.site ?? id, sibling = !!s.place && (s.place.site ?? s.id) === site;
  const next = startProps(place, storyProps(story, id), fold);
  const away = Object.fromEntries(Object.entries(s.away).filter(([, p]) => !p.site || (sibling && p.site === site)));
  for (const [k, p] of Object.entries(props)) {
    if (!p.keep && !sibling) continue;
    if (p.holder && on[p.holder]) next[k] = { ...p, at: null };
    else away[k] = { ...p, holder: undefined, ...(p.keep ? {} : { site }) };
  }
  for (const [k, p] of Object.entries(next)) {
    const was = away[k];
    if (!(p.keep || was?.site) || !was || p.holder) continue;
    next[k] = { ...p, n: was.n, shown: was.shown, params: was.params };
    delete away[k];
  }
  return { id, place, on, props: next, away };
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.z - b.z);

export function lintStory(story: StoryDoc, o: LintOptions): Problem[] {
  const out: Problem[] = [], lang = o.lang ?? langFor("tr");
  /** A step's text in the story language. */
  const said = (t: object) => String((t as Record<string, unknown>)[lang.id] ?? "");
  const add = (u: Pick<Unit, "at">, rule: Rule, message: string, fix?: Staging, level: Problem["level"] = "error") => out.push({ rule, level, ...u.at, message, ...(fix ? { fix } : {}) });
  let state: State = { id: story.place, place: o.places[story.place] ?? null, on: {}, props: o.places[story.place] ? startProps(o.places[story.place], storyProps(story, story.place), lang.fold) : {}, away: {} };

  // ---- props: where the story's own props stand
  const visited = new Set([story.place, ...story.steps.filter(isScene).map(s => s.scene)]);
  for (const [id, p] of Object.entries(story.props ?? {})) for (const [pl, at] of Object.entries(placesOf(story, p))) {
    const place = o.places[pl];
    if (!visited.has(pl)) out.push({ rule: "props", level: "error", step: 0, message: `prop ${id} stands in ${pl}, which the story never visits` });
    else if (place && typeof at === "string" && !place.marks[at]) out.push({ rule: "props", level: "error", step: 0, message: `prop ${id} stands on mark ${at}, which ${pl} lacks` });
    if (place?.props?.[id]) out.push({ rule: "props", level: "error", step: 0, message: `prop ${id} shadows ${pl}'s own ${id}: give the story's prop another id` });
  }

  const markPos = (s: State, id: string): Vec | null => {
    const m = s.on[id];
    const mk = m ? s.place?.marks[m] : undefined;
    return mk ? { x: mk.x, z: mk.z } : null;
  };
  const targetPos = (s: State, t: Target): Vec | null => {
    if (t.startsWith("obj:")) { const p = s.props[t.slice(4)]; return p?.holder ? markPos(s, p.holder) : p?.at ?? null; }
    if (t.startsWith("ch:")) return markPos(s, t.slice(3).split(".")[0]);
    if (t.startsWith("mark:")) { const mk = s.place?.marks[t.slice(5)]; return mk ? { x: mk.x, z: mk.z } : null; }
    return null;
  };

  /** What the line does to the world: moves and prop changes. */
  function apply(s: State, st: Staging, who?: string) {
    for (const mv of [st.move ?? []].flat()) s.on[mv.who] = mv.how === "exit" ? null : mv.to;
    for (const op of st.obj ?? []) {
      const p = s.props[op.id];
      if (!p) continue;
      if (op.op === "show" || op.op === "own" || op.op === "place") p.shown = true;
      if (op.op === "hide") p.shown = false;
      if (op.op === "give") p.holder = op.to;
      if (op.op === "take") p.holder = who;
      if (op.op === "place") p.holder = undefined;
      // put down on a mark, or sent along to one: it stands there now (for the deixis of the lines after)
      const m = (op.op === "place" || op.op === "go") ? (op.at ?? op.to)?.replace(/^mark:/, "") : undefined, mk = m ? s.place?.marks[m] : undefined;
      if (mk && !(op.op === "go" && p.holder)) p.at = { x: mk.x, z: mk.z };
      if (op.op === "add" && op.n !== undefined) p.n = (p.n ?? 0) + op.n;
      if (op.op === "set" && op.set) {
        // `n` is the count, not a parameter
        const { n, ...rest } = op.set;
        if (typeof n === "number") p.n = n;
        p.params = { ...p.params, ...rest };
      }
    }
  }
  const clone = (s: State): State => ({ id: s.id, place: s.place, on: { ...s.on }, props: Object.fromEntries(Object.entries(s.props).map(([k, p]) => [k, { ...p, params: { ...p.params } }])), away: s.away });

  function check(u: Unit, before: State, after: State) {
    const st = u.st;
    // ---- link: what the staging names must be on stage
    const objs = [st.at, ...Object.values(st.link ?? {}), ...(st.obj ?? []).map(op => "obj:" + op.id)].filter((t): t is string => !!t?.startsWith("obj:"));
    for (const t of new Set(objs)) if (!before.props[t.slice(4)] && !after.props[t.slice(4)]) add(u, "link", `${t} is not a prop on stage here`);
    // ---- via: the speaker is elsewhere
    if (st.via && u.who && before.on[u.who]) add(u, "via", `via "${st.via}" needs ${u.who} off stage, but ${u.who} is at ${before.on[u.who]}`);
    // ---- silent: only the stand-in's "…"
    const dots = u.text !== undefined && /^\s*(…|\.\.\.)\s*$/.test(u.text);
    if (st.voice === "silent" && !(u.standin && dots)) add(u, "silent", `voice "silent" goes only on a stand-in line whose text is "…"`);
    if (u.standin && dots && st.voice !== "silent") add(u, "silent", `the stand-in's "…" is the silent card: give it voice "silent"`, { voice: "silent", emo: st.emo ?? "nervous" }, "warning");
    // ---- budget: reactions, moves, the stroke's word
    const reacts = Object.keys(st.react ?? {});
    if (reacts.length > 2) add(u, "budget", `${reacts.length} reactions: at most two listeners react`);
    const movers = [st.move ?? []].flat().map(m => m.who);
    for (const w of new Set(movers)) if (movers.filter(x => x === w).length > 1) add(u, "budget", `${w} moves twice in one line: one move per character`);
    if (u.text === undefined) return;

    const ws = lang.words(u.text), plain = ws.filter(w => !w.pause).map(w => w.w);
    if (st.on && !plain.some(w => lang.match(w, st.on!) || w === lang.lower(st.on!))) add(u, "budget", `on: "${st.on}" is not a word of the line`);
    for (const k of Object.keys(st.link ?? {})) if (!plain.some(w => lang.match(w, k))) add(u, "link", `link "${k}" is not a word of the line`);

    // ---- a gesture needs a word to motivate it
    const motive = st.do ? lang.motive[st.do] : undefined;
    if (st.do && motive) {
      const said = plain.join(" ");
      const ok = st.do === "count" ? !lang.number || plain.some((_, i) => { const r = lang.number!(plain, i); return !!r && (r.n !== 1 || st.n === 1); }) : motive.some(m => (m.endsWith("$") ? plain.includes(m.slice(0, -1)) : said.split(" ").some(w => w.startsWith(m)) || said.includes(m + " ")));
      if (!ok) add(u, "budget", `"${st.do}" has no word in the line to motivate it`, undefined, "warning");
    }
    if (st.do && DEIXIS_GESTURES.has(st.do) && st.at?.startsWith("obj:")) {
      const named = plain.some(w => linkOf(lang, w, st, after.props) === st.at) || plain.some(w => lang.pointing(w));
      if (!named) add(u, "budget", `"${st.do}" at ${st.at}, but no word of the line names it`, undefined, "warning");
    }

    // ---- the language's own lints (Turkish: deixis, var/yok, numbers, clock times)
    if (lang.lintLine) {
      const sp = u.who ? markPos(after, u.who) : null;
      const c: LineContext = {
        who: u.who, text: u.text, st, words: ws, plain,
        linkOf: w => linkOf(lang, w, st, after.props),
        prop: id => after.props[id],
        holds: t => t.startsWith("obj:") && after.props[t.slice(4)]?.holder === u.who,
        distance: t => { if (c.holds(t)) return 0; const tp = targetPos(after, t); return sp && tp ? dist(sp, tp) : null; },
        add: (rule, message, fix, level = "error") => add(u, rule as Rule, message, fix, level),
      };
      lang.lintLine(c);
    }
  }


  /** A walk that goes round a wall or a railing, or finds no way at all (DESIGN.md §7): the same router the stage walks by. */
  function ways(u: Unit, s: State) {
    const lines = s.id ? o.solids?.[s.id] : undefined, place = s.place;
    if (!lines?.length || !place) return;
    const at = (m: string | null | undefined): Vec3 | null => { const mk = m ? place.marks[m] : undefined; return mk ? [mk.x, mk.y ?? 0, mk.z] : null; };
    const states = placeState(place, undefined);
    for (const mv of [u.st.move ?? []].flat()) {
      if (mv.how === "fly") continue;
      const door = mv.how === "enter" || mv.how === "exit" ? (mv.from ?? Object.keys(place.marks).find(k => place.marks[k].door && inState(place.marks[k].in, states))) : undefined;
      const legs = [mv.how === "enter" ? door : s.on[mv.who], ...(mv.via ?? []), mv.how === "exit" ? door : mv.to];
      for (let i = 1; i < legs.length; i++) {
        const a = at(legs[i - 1]), b = at(legs[i]);
        if (!a || !b) continue;
        // the door's own leg (to or from its out side) is the director's; these legs are on the stage side
        const way = route(a, b, lines, { state: states, size: place.size });
        if (!way) add(u, "route", `${mv.who} has no way from ${legs[i - 1]} to ${legs[i]} in ${s.id}: a wall or a closed gate is in the way`);
        else if (way.length) add(u, "route", `${mv.who} walks round from ${legs[i - 1]} to ${legs[i]} in ${s.id} (${detour(a, b, way).toFixed(1)} m longer): check the staging, or move a mark`, undefined, "warning");
      }
    }
  }

  function unit(u: Unit) {
    const before = clone(state);
    ways(u, state);
    apply(state, u.st, u.who);
    check(u, before, state);
  }

  // ---- the stand-in's turns, and the mechanics
  let lines = 0, lastStandin = false, firstTurn = -1;
  const turn = (standin: boolean, step: number, isLineLike: boolean) => {
    if (!isLineLike) return;
    lines++;
    if (standin && lastStandin) out.push({ rule: "standin", level: "error", step, message: "two stand-in lines in a row: each turn is one card" });
    if (standin && firstTurn < 0) firstTurn = lines;
    lastStandin = standin;
  };
  const mech = story.arc?.mechanics;

  story.steps.forEach((s, step) => {
    if (isScene(s)) {
      const place = o.places[s.scene] ?? null;
      state = sceneState(story, state, s.scene, place, s.at ?? {}, lang.fold);
      // Kerim on stage perches on the scene's mark, else the place's (as the director does), so ch:kerim resolves there
      const perch = s.kerim ?? place?.perch;
      if (o.characters?.[NARRATOR]?.puppet && !state.on[NARRATOR] && perch && place?.marks[perch]) state.on[NARRATOR] = perch;
    } else if (isLine(s)) {
      const l = s as LineStep;
      turn(l.who === STANDIN, step, !l.narr);
      unit({ who: l.who, text: said(l), st: l, at: { step }, standin: l.who === STANDIN });
    } else if (isBeat(s)) unit({ who: s.beat.who, st: s.beat, at: { step }, standin: false });
    else if (isSpot(s)) unit({ who: "kerim", st: s.spot, at: { step }, standin: false });
    else if (isChoice(s)) {
      turn(true, step, true);
      const start = clone(state);
      let first: State | null = null;
      s.choice.options.forEach((op: ChoiceOption, option) => {
        state = clone(start);
        unit({ who: STANDIN, text: said(op), st: op, at: { step, option }, standin: true });
        (op.reply ?? []).forEach((r: LineStep | BeatStep, reply) => {
          if (isBeat(r)) unit({ who: r.beat.who, st: r.beat, at: { step, option, reply }, standin: false });
          else unit({ who: r.who, text: said(r), st: r, at: { step, option, reply }, standin: r.who === STANDIN });
        });
        first ??= state;
      });
      // the options rejoin: the story goes on from the first one
      state = first ?? start;
      if (s.choice.options.some(op => op.reply?.some(r => isLine(r)))) lastStandin = false;
    } else if (isAct(s)) {
      if (mech && !mech.includes("act")) out.push({ rule: "mechanics", level: "error", step, message: `an act, but the arc's mechanics (${mech.join(", ")}) do not include act` });
      for (const tg of s.act.targets) if (tg.startsWith("obj:") && !state.props[tg.slice(4)]) out.push({ rule: "link", level: "error", step, message: `act target ${tg} is not a prop on stage` });
    }
  });
  out.push(...lintRefs(story, o));
  out.push(...lintLooks(story, o));
  if (firstTurn < 0 || firstTurn > 4) out.push({ rule: "standin", level: "error", step: 0, message: firstTurn < 0 ? "the learner never has a turn" : `the learner's first turn is line ${firstTurn}: it must come within the first four lines` });
  return out;
}

/** `place`: what the story names in its places exists there (marks, times), so nothing is dropped on the stage without a word. */
function lintRefs(story: StoryDoc, o: LintOptions): Problem[] {
  const out: Problem[] = [];
  const err = (step: number, message: string, at: Partial<Problem> = {}) => out.push({ rule: "place", level: "error", step, ...at, message });
  let here = story.place, on: string[] = o.places[here] ? placeState(o.places[here], undefined) : [];
  if (!o.places[here]) err(0, `the story starts in ${here}, which is no place`);
  const known = (pl: PlaceDoc, s: string, step: number, at: Partial<Problem> = {}) => {
    const id = s.replace(/^-/, "").split(":")[0];
    if (!pl.states?.[id]) { err(step, `state ${id}: ${here} has ${Object.keys(pl.states ?? {}).join(", ") || "no states"}`, at); return false; }
    return true;
  };
  // a station of a vehicle that stops: the first is where it starts from, so it never stops there
  const station = (pl: PlaceDoc, name: string, step: number, at: Partial<Problem> = {}) => {
    const all = pl.stops?.stations ?? [];
    if (!pl.stops) err(step, `stop at ${name}: ${here} is not a vehicle that stops`, at);
    else if (all.indexOf(name) < 1) err(step, `stop at ${name}: ${here} stops at ${all.slice(1).join(", ")}`, at);
  };
  // a mark that is not there in the place's states now (the exam layout's desks in the full class)
  const there = (pl: PlaceDoc, m: string) => inState(pl.marks[m]?.in, on);
  const moves = (st: Staging | undefined, step: number, at: Partial<Problem> = {}) => {
    const pl = o.places[here];
    if (!pl) return;
    for (const e of [st?.env ?? []].flat()) if (e.startsWith("weather:") && !Object.hasOwn(WEATHER, e.slice(8))) err(step, `weather ${e.slice(8)}: the stage has ${Object.keys(WEATHER).join(", ")}`, at);
    for (const e of [st?.env ?? []].flat()) if (e.startsWith("time:")) {
      const [t, ms] = e.slice(5).split(":");
      if (pl.times?.length && !pl.times.includes(t)) err(step, `time ${t}: ${here} has ${pl.times.join(", ")}`, at);
      if (ms !== undefined && !(Number(ms) >= 0 && Number(ms) <= 60000)) err(step, `time ${t} over ${ms} ms: a change takes 0 to 60000 ms`, at);
    }
    for (const e of [st?.env ?? []].flat()) if (e.startsWith("stop:")) station(pl, e.slice(5), step, at);
    else if ((e === "depart" || e === "stop") && !pl.stops) err(step, `${e}: ${here} is not a vehicle that stops`, at);
    for (const e of [st?.env ?? []].flat()) if (e.startsWith("state:")) { const s = e.slice(6); if (known(pl, s, step, at)) on = placeState(pl, on, s.split(":")[0]); }
    for (const op of st?.obj ?? []) if (op.op === "go") for (const m of [...(op.via ?? []), op.to ?? ""].map(x => x.replace(/^mark:/, ""))) {
      if (!pl.marks[m]) err(step, `obj ${op.id} goes to ${m || "(no mark)"}, which ${here} lacks`, at);
      else if (!there(pl, m)) err(step, `obj ${op.id} goes to ${m}, which is not there in ${here}'s ${on.join(", ") || "default"} state`, at);
    }
    for (const mv of [st?.move ?? []].flat()) {
      for (const v of mv.via ?? []) if (!pl.marks[v]) err(step, `${mv.who} passes ${v}, which ${here} lacks`, at); else if (!there(pl, v)) err(step, `${mv.who} passes ${v}, which is not there in ${here}'s ${on.join(", ") || "default"} state`, at);
      if (mv.to && !pl.marks[mv.to]) err(step, `${mv.who} moves to ${mv.to}, which ${here} lacks`, at);
      else if (mv.to && !there(pl, mv.to)) err(step, `${mv.who} moves to ${mv.to}, which is not there in ${here}'s ${on.join(", ") || "default"} state`, at);
    }
  };
  story.steps.forEach((s, step) => {
    if (isScene(s)) {
      const same = here === s.scene;
      here = s.scene;
      const pl = o.places[here];
      if (!pl) {
        const places = Object.values(o.places).filter(p => p.site === here).map(p => p.id);
        err(step, places.length ? `scene in ${here}, a site: name one of its places (${places.join(", ")})` : `scene in ${here}, which is no place`);
        return;
      }
      // a new place starts in its defaults; the same place keeps its states (as the director does)
      on = placeState(pl, same ? on : undefined, [s.state ?? []].flat().filter(x => known(pl, x, step)));
      for (const [who, m] of Object.entries(s.at ?? {})) if (!pl.marks[m]) err(step, `${who} stands on ${m}, which ${here} lacks`); else if (!there(pl, m)) err(step, `${who} stands on ${m}, which is not there in ${here}'s ${on.join(", ") || "default"} state`);
      if (s.kerim && !pl.marks[s.kerim]) err(step, `Kerim perches on ${s.kerim}, which ${here} lacks`);
      if (s.time && pl.times?.length && !pl.times.includes(s.time)) err(step, `time ${s.time}, but ${here} lists ${pl.times.join(", ")}`);
      if (s.weather && !Object.hasOwn(WEATHER, s.weather)) err(step, `weather ${s.weather}: the stage has ${Object.keys(WEATHER).join(", ")}`);
      if (s.stop) station(pl, s.stop, step);
    } else if (isLine(s)) moves(s as LineStep, step);
    else if (isBeat(s)) moves(s.beat, step);
    else if (isSpot(s)) moves(s.spot, step);
    else if (isChoice(s)) s.choice.options.forEach((op: ChoiceOption, option) => {
      moves(op, step, { option });
      (op.reply ?? []).forEach((r: LineStep | BeatStep, reply) => moves(isBeat(r) ? r.beat : r, step, { option, reply }));
    });
  });
  return out;
}

/** Slots normalize would fill with the kit's default again: `null` there is no change of clothes. */
const REQUIRED = ["outfit.top", "outfit.bottom", "outfit.shoes"];
const KIT_WHY: Partial<Record<AvatarNote["why"], (n: AvatarNote) => string>> = {
  unknown: n => `the kit has no part ${n.id}`,
  slot: n => `${n.id} belongs to another slot`,
  build: n => `${n.id} is not made for this body's build`,
  size: () => "left out to keep the document within 2 KB",
};
const noteKey = (n: AvatarNote) => `${n.field} ${n.id} ${n.why}`;

/** The look rule: who changes, into what, and where a story may say so. */
function lintLooks(story: StoryDoc, o: LintOptions): Problem[] {
  const out: Problem[] = [];
  const add = (at: Pick<Problem, "step" | "option" | "reply">, message: string, level: Problem["level"] = "error") => out.push({ rule: "look", level, ...at, message });
  const chars = o.characters;
  const ids = new Set<string>([...story.cast, ...(story.extras ?? [])]);
  for (const s of story.steps) if (isScene(s)) for (const id of Object.keys(s.at ?? {})) ids.add(id);
  const avatars: Record<string, AvatarDoc> = {};
  for (const id of ids) { const a = chars?.[id]?.avatar; if (a) avatars[id] = a; }
  const now: Record<string, AvatarDoc> = { ...avatars };

  /** What is wrong with a look's fields, kit aside. */
  const fields = (look: unknown): string[] => {
    const { clothing, other } = lookFields(look), bad: string[] = [];
    if (other.length) bad.push(`not clothing: ${other.join(", ")} (a look changes only outfit.*, wear.*, carry and hold)`);
    for (const f of REQUIRED) if (clothing[f as keyof typeof clothing] === null) bad.push(`${f}: null puts the kit's default back; name another part`);
    return bad;
  };
  /** What normalize refuses of `look` on `doc` that it did not refuse of `doc` itself. */
  const kitCheck = (doc: AvatarDoc, look: Look): string[] => {
    if (!o.kit) return [];
    const before: AvatarNote[] = [], after: AvatarNote[] = [];
    normalize(doc, o.kit, { trusted: true, notes: before });
    normalize(applyLook(doc, look), o.kit, { trusted: true, notes: after });
    const had = new Set(before.map(noteKey)), clothing = new Set<string>(CLOTHING_FIELDS);
    return after.filter(n => clothing.has(n.field) && KIT_WHY[n.why] && !had.has(noteKey(n))).map(n => `${n.field}: ${KIT_WHY[n.why]!(n)}`);
  };

  // ---- the outfits of the characters the story uses
  for (const id of ids) {
    const ch = chars?.[id];
    for (const [name, look] of Object.entries(ch?.outfits ?? {})) {
      if (name === "default") add({ step: 0 }, `${id}'s outfit "default": the name is reserved for the avatar itself`);
      for (const m of [...fields(look), ...(ch!.avatar ? kitCheck(ch!.avatar, look) : [])]) add({ step: 0 }, `${id}'s outfit "${name}": ${m}`);
    }
  }

  /** A step's `looks`, in order: it names someone, an outfit they have or clothing, and changes something. */
  const looks = (at: Pick<Problem, "step">, v: unknown) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) { add(at, "looks is a map of character → outfit name or look"); return; }
    for (const [id, ref] of Object.entries(v as Record<string, unknown>)) {
      if (id === NARRATOR) { add(at, `${id} is the narrator: the inset wears no looks`); continue; }
      if (!ids.has(id)) { add(at, `${id} is not in the story (cast, extras or a scene's at)`); continue; }
      if (chars && !chars[id]) { add(at, `${id} has no character document`); continue; }
      const outfits = chars?.[id]?.outfits, learner = id === STANDIN;
      let look: unknown = ref;
      if (typeof ref === "string") {
        if (ref !== "default" && chars && !(outfits && Object.hasOwn(outfits, ref))) { add(at, `${id} has no outfit "${ref}"${outfits ? ` (${["default", ...Object.keys(outfits)].join(", ")})` : ""}`); continue; }
        look = ref === "default" ? {} : outfits?.[ref];
      } else {
        const bad = fields(ref);
        for (const m of bad) add(at, `${id}: ${m}`);
        if (bad.length) continue;
        if (now[id]) for (const m of kitCheck(now[id], ref as Look)) add(at, `${id}: ${m}`);
      }
      if (learner) {
        const extra = Object.keys(lookFields(look).clothing).filter(f => !(LEARNER_FIELDS as readonly string[]).includes(f));
        if (extra.length) add(at, `${id} is the learner, in their own clothes: only ${LEARNER_FIELDS.join(" and ")} apply, not ${extra.join(", ")}`, "warning");
      }
      if (!now[id]) continue;
      const next = dress(ref as LookRef, now[id], avatars[id], outfits, learner);
      if (!next) continue;
      const kept = learner && typeof ref !== "string" && !Object.keys(lookFields(forLearner(ref as Look, now[id])).clothing).length;
      if (canon(next) === canon(now[id]) && !kept) add(at, `${id}'s look changes nothing: they already wear it`, "warning");
      now[id] = next;
    }
  };

  if (story.looks !== undefined) looks({ step: 0 }, story.looks);
  const misplaced = (at: Pick<Problem, "step" | "option" | "reply">, where: string) => add(at, `looks inside ${where}: a change of clothes goes on the story, a scene, a line or a beat`);
  story.steps.forEach((s, step) => {
    const v = looksOf(s);
    if (v !== undefined) looks({ step }, v);
    if (isBeat(s) && "looks" in s) add({ step }, "looks on a beat go inside beat");
    if (isChoice(s)) {
      if ("looks" in s || "looks" in s.choice) misplaced({ step }, "a choice");
      s.choice.options.forEach((op, option) => {
        if ("looks" in op) misplaced({ step, option }, "a choice option");
        (op.reply ?? []).forEach((r, reply) => { if ("looks" in r || (isBeat(r) && "looks" in r.beat)) misplaced({ step, option, reply }, "a reply"); });
      });
    }
    if (isAct(s) && ("looks" in s || "looks" in s.act)) misplaced({ step }, "an act");
    if (isSpot(s) && ("looks" in s || "looks" in s.spot)) misplaced({ step }, "a spot");
  });
  return out;
}

/** A link a line could have: a word that names a prop on stage but is not in `link`. */
export interface Suggestion { step: number; option?: number; reply?: number; rule: Rule | "link"; message: string; fix: Staging }

/**
 * Staging the lints would add (Kumru's STORIES_STAGE.md §4 `--suggest`): every problem's fix, plus `link`
 * for words that name a prop on stage (ekmek → obj:ekmek), so staging stays quick to write.
 */
export function suggest(story: StoryDoc, o: LintOptions): Suggestion[] {
  const lang = o.lang ?? langFor("tr"), said = (t: object) => String((t as Record<string, unknown>)[lang.id] ?? "");
  const out: Suggestion[] = lintStory(story, o).flatMap(p => (p.fix ? [{ step: p.step, ...(p.option !== undefined ? { option: p.option } : {}), ...(p.reply !== undefined ? { reply: p.reply } : {}), rule: p.rule, message: p.message, fix: p.fix }] : []));
  let props: Record<string, PropState> = o.places[story.place] ? startProps(o.places[story.place], storyProps(story, story.place), lang.fold) : {}, here = story.place;
  const links = (text: string, st: Staging, at: Pick<Suggestion, "step" | "option" | "reply">) => {
    const add: Record<string, Target> = {};
    let place = false;
    for (const t of lang.words(text)) {
      if (t.pause) { place = false; continue; }
      const w = t.w;
      // "Burası metro.": the noun after burası / şurası / orası names the place, not a prop on stage
      const after = place;
      place = lang.namesPlace(w);
      if (after) continue;
      // a pointing word (bu, şu, o and their forms) never names a prop: "şu" is not the water (su)
      if (lang.pointing(w)) continue;
      if (Object.keys(st.link ?? {}).some(k => lang.match(w, k))) continue;
      const tg = linkOf(lang, w, {}, props);
      if (tg) add[w.split("'")[0]] = tg;
    }
    if (Object.keys(add).length) out.push({ ...at, rule: "link", message: `link ${Object.entries(add).map(([k, v]) => `${k} → ${v}`).join(", ")}`, fix: { link: { ...(st.link ?? {}), ...add } } });
  };
  story.steps.forEach((s, step) => {
    if (isScene(s) && s.scene !== here) { const pl = o.places[s.scene]; here = s.scene; props = pl ? startProps(pl, storyProps(story, s.scene), lang.fold) : {}; }
    else if (isLine(s)) links(said(s), s, { step });
    else if (isChoice(s)) s.choice.options.forEach((op, option) => {
      links(said(op), op, { step, option });
      (op.reply ?? []).forEach((r, reply) => { if (isLine(r)) links(said(r), r, { step, option, reply }); });
    });
  });
  return out.sort((a, b) => a.step - b.step || (a.option ?? -1) - (b.option ?? -1) || (a.reply ?? -1) - (b.reply ?? -1));
}
