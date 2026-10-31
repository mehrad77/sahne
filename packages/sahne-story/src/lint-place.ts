// The place lint ("a place with good details"): what can be checked of a place document
// without looking at it. One rule per item of the standard:
//
//   valid    names in three languages, a district, a camera, times the stage has, a perch up high (there in
//            every state, and inside the wide shot's height band), kit ids that exist, params each generator
//            declares with values it takes (its `meta`), marks inside the place, door marks with their door
//            and street side, a site, states that exist (one default per group)
//   needs    every mark (a seat where it says so), prop (or a set piece with its id), state and time its needs.json entry asks for
//   depth    pieces in four depth bands (far, backdrop, the actors' plane, near; a cabin fills the last two); outdoors, a far piece
//   density  at least 12 pieces (a vehicle with a cabin: 6), 3 of them more than walls, floors, windows, doors and the street; props
//            beyond the needs; each state 2 pieces or props of its own
//   explore  at least 5 tappable things with an A1 card; every prop names a card or is `decor`; terms live
//   crowd    crowds keep 0.6 m clear of the marks people stand on, and at most 40 people near the camera
//   reach    people can walk to every mark they stand on from the first door mark (out through its own door too), round the solid lines (no mark stands in one)
//   light    a place with dusk or night has a practical light and something lit
//   sound    an ambience bed, a motif and a surface the kit has
//   budget   at most 5 KB of JSON, and every flat of its pieces and props fits a layer of the atlas
//
// A document with a `placeholder` (a draft whose art stands in) gets warnings only. The camera check
// and the owner's review are the gallery's (#/places/<id>, shots.mjs --camera).

import { allLanguages, DEFAULT_LANGUAGES, type Languages } from "./texts.ts";
import { drawPieces, withVariant, pieceOf, placeSolids, placeState, route, rng, cellSize, fitsAtlas, ATLAS_MAX, TIMES, TIMETABLE, type Kit, type FlatSpec, type Group, type ParamSpec, type PieceDef } from "sahne";
import { cardProblem, isA1, type CardIndex } from "./cards.ts";
import { needsOf, type Needs } from "./needs.ts";
import type { StoryPlace } from "./types.ts";

export type PlaceRule = "valid" | "needs" | "depth" | "density" | "crowd" | "reach" | "explore" | "light" | "sound" | "budget";
export const PLACE_RULES: PlaceRule[] = ["valid", "needs", "depth", "density", "crowd", "reach", "explore", "light", "sound", "budget"];

export interface PlaceProblem { rule: PlaceRule; level: "error" | "warning"; message: string }

/** `cards`: the word cards a place's terms must name; without them (null or left out) the card rules do not run. */
/** `languages`: the series' (src/texts.ts), which a place is named in; without them, Turkish with English and Persian. */
export interface PlaceLintOptions { kit: Kit; cards?: CardIndex | null; needs?: Needs; languages?: Languages }

/** Depth bands by a piece's z (metres; the camera looks down −z). */
export const BANDS = [
  { name: "far", test: (z: number) => z <= -6 },
  { name: "backdrop", test: (z: number) => z > -6 && z <= -1.5 },
  { name: "actors", test: (z: number) => z > -1.5 && z <= 0.5 },
  { name: "near", test: (z: number) => z > 0.5 },
];
/** Pieces that make a room or a street but not a place of its own. */
export const BASIC = new Set(["wall", "floor", "window", "door_shop", "street"]);
export const SURFACES = new Set(["stone", "wood", "tile", "carpet"]);
export const MAX_BYTES = 5120;
const MIN_PIECES = 12, MIN_SPECIAL = 3, MIN_DRESSING = 3, MIN_TAPPABLE = 5;
/** A car's inside (a place with a `cabin` piece: the taxi, the bus) is one piece round the actors, from the near seats to the windows: it fills the actors' plane and the near band, and the place needs this many pieces, not MIN_PIECES (owner, 2026-10-17). */
const MIN_VEHICLE_PIECES = 6;
/** Most crowd people near the camera in one place (the far strips aside): atlas memory, DESIGN.md §12. */
export const MAX_PEOPLE = 40;
/** How near a solid line a mark may stand, metres (a door mark at its own door excepted). */
const MARK_CLEAR = 0.12;
/** The distance from a point to a segment, in the floor plane. */
function segDist(p: [number, number], a: [number, number], b: [number, number]): number {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
/** How far crowds keep from a mark people stand on, metres. */
export const CROWD_CLEAR = 0.6;

/** A piece's own fields in a place (where it stands, its id, seed, states, look) and a prop's: not params of its drawing. */
const PIECE_FIELDS = ["kit", "variant", "x", "y", "z", "id", "seed", "in", "switch", "terms", "solid"];
const PROP_FIELDS = ["kit", "variant", "at", "n", "terms", "shown", "keep", "in", "decor"];

const kindsOf = (s: ParamSpec) => typeof s.type === "string" ? [s.type] : [...s.type];
/** Whether a value is one a param of this spec takes. */
function takes(s: ParamSpec, v: unknown): boolean {
  return kindsOf(s).some(k => {
    switch (k) {
      case "enum": return typeof v === "string" && (s.values ?? []).includes(v);
      case "int": case "num": return typeof v === "number" && Number.isFinite(v) && (k === "num" || Number.isInteger(v)) && (s.min === undefined || v >= s.min) && (s.max === undefined || v <= s.max);
      case "bool": return typeof v === "boolean";
      case "text": return typeof v === "string" || typeof v === "number" || (Array.isArray(v) && v.every(x => typeof x === "string" || typeof x === "number"));
      case "color": return typeof v === "string";
      case "list": return Array.isArray(v);
      case "object": return typeof v === "object" && v !== null && !Array.isArray(v);
    }
  });
}

/**
 * A piece's or prop's params against what its generator declares (`PieceDef.meta`): a value the param
 * doesn't take is an error (a generator falls back silently on an unknown `kind`); a param it doesn't
 * declare is a warning (a typo, or one its drawing never reads).
 */
export function paramProblems(def: PieceDef, ref: Record<string, unknown>, own: string[]): { level: "error" | "warning"; message: string }[] {
  const meta = def.meta, out: { level: "error" | "warning"; message: string }[] = [];
  if (!meta) return out;
  for (const [k, v] of Object.entries(ref)) {
    if (own.includes(k)) continue;
    const spec = meta.params[k];
    if (!spec) out.push({ level: "warning", message: `param ${k} is not one it reads (${Object.keys(meta.params).join(", ") || "none"})` });
    else if (!takes(spec, v)) out.push({ level: "error", message: `${k}: ${JSON.stringify(v)} is not a ${kindsOf(spec).join(" or ")}${spec.values ? ` (${spec.values.join(", ")})` : ""}${spec.min !== undefined || spec.max !== undefined ? ` (${spec.min ?? ""}–${spec.max ?? ""})` : ""}` });
  }
  return out;
}

export function lintPlace(doc: StoryPlace, o: PlaceLintOptions): PlaceProblem[] {
  const out: PlaceProblem[] = [];
  const level = doc.placeholder ? "warning" : "error";
  const add = (rule: PlaceRule, message: string, lv: PlaceProblem["level"] = level) => out.push({ rule, level: lv, message });

  // ---- valid
  for (const l of allLanguages(o.languages ?? DEFAULT_LANGUAGES)) if (!doc.name?.[l]) add("valid", `no name in ${l}`);
  if (!doc.district && doc.life !== "run") add("valid", "no district (only a vehicle goes without one)", "warning");
  // a vehicle that stops: its pieces keep the place's timetable and name its stations, so a story's stop lands where they show it
  const timed = doc.pieces.filter(p => "stops" in p && p.stops), tt = { ms: TIMETABLE.ms, run: TIMETABLE.run, ease: TIMETABLE.ease, ...doc.stops };
  if (doc.stops) {
    if (!(doc.stops.stations?.length >= 2) || !doc.stops.stations.every(x => typeof x === "string" && x)) add("valid", "stops: name at least two stations, in the order it goes");
    if (doc.life !== "run") add("valid", "stops: a vehicle that stops runs (life: \"run\")", "warning");
    if (!timed.length) add("valid", "stops: no piece keeps the timetable (stops: true)", "warning");
  } else if (timed.length) add("valid", `${timed.map(p => p.kit).join(", ")} keep a timetable, but the place has no stops: a story cannot hold it at a station`, "warning");
  for (const p of timed) {
    const own = p.stops === true ? TIMETABLE : { ...TIMETABLE, ...(p.stops as object) };
    for (const k of ["ms", "run", "ease"] as const) if (doc.stops && own[k] !== tt[k]) add("valid", `${p.kit}: its timetable's ${k} ${own[k]} is not the place's ${tt[k]}`);
  }
  for (const p of doc.pieces) if (doc.stops && Array.isArray(p.stations) && JSON.stringify(p.stations) !== JSON.stringify(doc.stops.stations)) add("valid", `${p.kit}: its stations are not the place's (${doc.stops.stations.join(", ")})`);
  if (!doc.camera?.wide) add("valid", "no camera.wide");
  if (!doc.times?.length) add("valid", "no times");
  for (const t of doc.times ?? []) if (!Object.hasOwn(TIMES, t)) add("valid", `time ${t} is not one the stage has`);
  const perch = doc.perch ? doc.marks[doc.perch] : undefined;
  if (!doc.perch) add("valid", "no perch for Kerim");
  else if (!perch) add("valid", `perch ${doc.perch} is not a mark`);
  else if (!perch.air && !((perch.y ?? 0) > 0)) add("valid", `perch ${doc.perch} is on the floor: Kerim perches up high`);
  // Kerim on the perch or an air mark stands within the wide shot's height band: one wholly above it is at the frame's edge at best (the camera check measures it)
  const top = doc.camera?.wide?.y1 ?? 2.45;
  for (const [id, m] of Object.entries(doc.marks)) if ((id === doc.perch || m.air) && (m.y ?? 0) > top + 0.3) add("valid", `${id === doc.perch ? "perch" : "air mark"} ${id} at ${m.y} m is above the wide shot's height band (camera.wide.y1 ${top}): raise y1`, "warning");
  for (const p of doc.pieces) if (typeof p.x !== "number" || typeof p.z !== "number") add("valid", `set piece ${p.kit}${p.id ? ` #${p.id}` : ""} has no x or z: it is not placed`);
  // a kit id after `kit.aliases` (an item promoted from a content root keeps answering to its old x_ id)
  for (const p of doc.pieces) { const def = pieceOf(o.kit, "set", p.kit);
    if (!def) add("valid", `set piece ${p.kit} is not in the kit`);
    else if (p.variant !== undefined && !Object.hasOwn(def.variants ?? {}, p.variant)) add("valid", `set piece ${p.kit} has no variant ${p.variant}`);
    else for (const m of paramProblems(def, p, PIECE_FIELDS)) add("valid", `set piece ${p.kit}${p.id ? ` #${p.id}` : ""}: ${m.message}`, m.level === "error" ? level : "warning");
  }
  for (const [id, p] of Object.entries(doc.props ?? {})) { const def = pieceOf(o.kit, "props", p.kit);
    if (!def) add("valid", `prop ${id}: ${p.kit} is not in the kit`);
    else if (p.variant !== undefined && !Object.hasOwn(def.variants ?? {}, p.variant)) add("valid", `prop ${id}: ${p.kit} has no variant ${p.variant}`);
    else for (const m of paramProblems(def, p, PROP_FIELDS)) add("valid", `prop ${id}: ${m.message}`, m.level === "error" ? level : "warning");
  }
  const { w, d } = doc.size;
  for (const [id, m] of Object.entries(doc.marks)) {
    if (!m.air && (Math.abs(m.x) > w / 2 || m.z < -d || m.z > 1)) add("valid", `mark ${id} (${m.x}, ${m.z}) is outside the place (${w} × ${d} m)`);
    if (m.door !== undefined) {
      if (!doc.pieces.some(p => p.id === m.door)) add("valid", `door mark ${id} names door ${m.door}, which no piece is`);
      if (!m.out) add("valid", `door mark ${id} has no out (the street side)`);
    }
  }
  // states: what `in` names exists, one default per group, Kerim's perch there in every state
  const states = doc.states ?? {};
  const named = [...doc.pieces.map(p => [`piece ${p.id ?? p.kit}`, p.in] as const), ...Object.entries(doc.marks).map(([id, m]) => [`mark ${id}`, m.in] as const), ...Object.entries(doc.props ?? {}).map(([id, p]) => [`prop ${id}`, p.in] as const)];
  for (const [what, list] of named) for (const s of list ?? []) if (!Object.hasOwn(states, s)) add("valid", `${what} is in state ${s}, which the place does not have`);
  const groups = new Map<string, number>();
  for (const s of Object.values(states)) if (s.default) groups.set(s.group ?? "", (groups.get(s.group ?? "") ?? 0) + (s.group ? 1 : 0));
  for (const [g, n] of groups) if (n > 1) add("valid", `${n} default states in group ${g}: one at most`);
  if (perch?.in) add("valid", `perch ${doc.perch} is only in state ${perch.in.join(", ")}: Kerim needs it in every state`);

  const entry = o.needs ? needsOf(o.needs, doc.id) : null;
  if (o.needs) {
    if (!entry) add("valid", `${doc.id} is no place of needs.json`);
    else if (entry.site !== doc.id && doc.site !== entry.site) add("valid", `${doc.id} is a place of site ${entry.site}: it needs site: "${entry.site}"`);
    else if (doc.site && doc.site !== entry.site) add("valid", `site ${doc.site}, but needs.json has ${doc.id} under ${entry.site}`);
  }

  // ---- needs
  if (entry) {
    const need = entry.place;
    for (const [m, nm] of Object.entries(need.marks ?? {})) {
      if (!doc.marks[m]) add("needs", `no mark ${m} (${nm.stories.join(" ")})`);
      else if (nm.seat && doc.marks[m].seat === undefined) add("needs", `mark ${m} is someone's seat (${nm.stories.join(" ")}): give it a seat height`);
    }
    // a fixture the stories need (a shelf, the notice board) may be a set piece with that id instead of a prop
    for (const p of Object.keys(need.props ?? {})) if (!doc.props?.[p] && !doc.pieces.some(q => q.id === p)) add("needs", `no prop or piece ${p} (${need.props![p].stories.join(" ")})`);
    for (const s of Object.keys(need.states ?? {})) if (!Object.hasOwn(states, s)) add("needs", `no state ${s} (${need.states![s].stories.join(" ")})`);
    for (const t of need.times ?? []) if (!doc.times?.includes(t)) add("needs", `time ${t} is not listed`);
  }

  // ---- depth
  const cabin = doc.pieces.some(p => p.kit === "cabin");
  const bands = BANDS.filter(b => doc.pieces.some(p => b.test(p.z)) || (cabin && (b.name === "actors" || b.name === "near")));
  if (bands.length < BANDS.length) add("depth", `pieces in ${bands.length} of 4 depth bands; missing ${BANDS.filter(b => !bands.includes(b)).map(b => b.name).join(", ")}`);
  if (doc.outdoor && !doc.pieces.some(p => BANDS[0].test(p.z))) add("depth", "outdoors with nothing far (a skyline, the sky or water)");

  // ---- density
  const minPieces = cabin ? MIN_VEHICLE_PIECES : MIN_PIECES;
  if (doc.pieces.length < minPieces) add("density", `${doc.pieces.length} pieces; a finished ${cabin ? "vehicle (with a cabin)" : "place"} has at least ${minPieces}`);
  const special = new Set(doc.pieces.map(p => p.kit).filter(k => !BASIC.has(k)));
  if (special.size < MIN_SPECIAL) add("density", `${special.size} kinds of piece beyond walls, floors, windows, doors and the street; at least ${MIN_SPECIAL}`);
  for (const s of Object.keys(states)) {
    const own = doc.pieces.filter(p => p.in?.includes(s)).length + Object.values(doc.props ?? {}).filter(p => p.in?.includes(s)).length;
    if (own < 2) add("density", `state ${s} has ${own} piece${own === 1 ? "" : "s"} of its own; at least 2`);
  }
  const needed = new Set(Object.keys(entry?.place.props ?? {}));
  const dressing = Object.keys(doc.props ?? {}).filter(id => !needed.has(id)).length;
  if (dressing < MIN_DRESSING) add("density", `${dressing} dressing props beyond what the stories need; at least ${MIN_DRESSING}`);

  // ---- crowd
  let people = 0;
  const crowdDef = o.kit.set.crowd;
  for (const c of doc.pieces) {
    if (c.kit !== "crowd" || !crowdDef) continue;
    const q = withVariant(crowdDef, c), kind = String(q.kind ?? "walk");
    if (kind === "far") continue;
    people += Number(q.n ?? 8);
    const a = c.x + Number(q.x0 ?? -500) / 100, b = c.x + Number(q.x1 ?? 500) / 100;
    for (const [id, m] of Object.entries(doc.marks)) {
      if (m.air || (m.y ?? 0) > 0) continue;
      if (Math.abs(c.z - m.z) < CROWD_CLEAR && m.x > Math.min(a, b) - CROWD_CLEAR && m.x < Math.max(a, b) + CROWD_CLEAR) add("crowd", `the ${kind} crowd at z ${c.z} passes within ${CROWD_CLEAR} m of mark ${id}: move it back`, "warning");
    }
  }
  if (people > MAX_PEOPLE) add("crowd", `${people} crowd people near the camera; at most ${MAX_PEOPLE}`, "warning");

  // ---- reach: the marks people stand on (not the air, not up high where only Kerim goes), walked to round the solid lines
  const solids = placeSolids(doc, o.kit);
  const feet = Object.entries(doc.marks).filter(([id, m]) => !m.air && id !== doc.perch && (m.y ?? 0) < 1);
  const hub = feet.find(([, m]) => m.door) ?? feet[0];
  for (const [id, m] of feet) {
    for (const l of solids) {
      if (m.door && l.door === m.door) continue;
      if (segDist([m.x, m.z], l.a, l.b) < MARK_CLEAR) add("reach", `mark ${id} stands in a solid line of ${l.piece ? `piece ${l.piece}` : "a piece"}: move it clear`, "warning");
    }
    if (!hub || id === hub[0]) continue;
    const way = route([hub[1].x, hub[1].y ?? 0, hub[1].z], [m.x, m.y ?? 0, m.z], solids, { state: placeState(doc, undefined, m.in), size: doc.size, door: typeof hub[1].door === "string" ? hub[1].door : undefined });
    if (!way) add("reach", `mark ${id} cannot be walked to from ${hub[0]}: a wall or a closed gate is in the way`);
  }

  // ---- explore
  const tappable = [
    ...Object.entries(doc.props ?? {}).map(([id, p]) => ({ id: `prop ${id}`, terms: p.terms ?? [], decor: p.decor })),
    ...doc.pieces.filter(p => p.id && Array.isArray(p.terms)).map(p => ({ id: `piece ${p.id}`, terms: p.terms as string[], decor: false })),
  ];
  for (const t of tappable) {
    if (!t.terms.length && !t.decor && t.id.startsWith("prop")) add("explore", `${t.id} names no card (or say decor: true)`);
    if (o.cards) for (const id of t.terms) { const why = cardProblem(o.cards, id); if (why) add("explore", `${t.id}: ${why}`); }
  }
  const cards = o.cards;
  const a1 = cards ? tappable.filter(t => t.terms.some(id => isA1(cards, id))).length : MIN_TAPPABLE;
  if (a1 < MIN_TAPPABLE) add("explore", `${a1} tappable things with an A1 card; at least ${MIN_TAPPABLE}`);

  // ---- light
  if (doc.times?.some(t => t === "dusk" || t === "night")) {
    const drawn = drawPieces(doc, o.kit).map(x => x.out);
    if (!drawn.some(x => x.lights?.length)) add("light", "dusk or night, but no piece carries a light (a lamp, a ceiling light)");
    if (!drawn.some(x => x.flats.some(f => f.emissive))) add("light", "dusk or night, but nothing lit (windows, a sign)");
  }

  // ---- sound
  if (!doc.ambience?.length) add("sound", "no ambience bed");
  for (const a of doc.ambience ?? []) if (!o.kit.sounds?.[a]) add("sound", `ambience ${a} is not a kit sound`);
  if (!doc.motif) add("sound", "no motif");
  else if (!o.kit.motifs?.[doc.motif]) add("sound", `motif ${doc.motif} is not a kit motif`);
  if (!doc.surface) add("sound", "no surface for the footsteps");
  else if (!SURFACES.has(doc.surface)) add("sound", `surface ${doc.surface} is not one of ${[...SURFACES].join(", ")}`);

  // ---- budget
  const bytes = JSON.stringify(doc).length;
  if (bytes > MAX_BYTES) add("budget", `${bytes} bytes of JSON; at most ${MAX_BYTES}`);
  // a flat larger than an atlas layer cannot be drawn at all, and the place would not load: as the stage draws it (DESIGN.md §6.2)
  const big = (what: string, f: FlatSpec) => {
    const cells: [Group, number, string][] = [[f.group, f.ppcm ?? 1.6, ""], ...(f.emissive ? [[f.emissive, f.glowPpcm ?? f.ppcm ?? 1.6, "glow "] as [Group, number, string]] : [])];
    for (const [g, ppcm, kind] of cells) {
      const { w, h } = cellSize(g, ppcm);
      if (!fitsAtlas(w, h)) add("budget", `${what}: its ${kind}flat is ${w}×${h} px at ${+ppcm.toFixed(2)} px/cm, larger than the ${ATLAS_MAX} atlas: make it smaller or split it`);
    }
  };
  for (const { p, out } of drawPieces(doc, o.kit)) for (const f of out.flats) big(`piece ${p.id ?? p.kit}`, f);
  for (const [id, p] of Object.entries(doc.props ?? {})) {
    const def = pieceOf(o.kit, "props", p.kit);
    if (!def) continue;
    const params = Object.fromEntries(Object.entries(p).filter(([k]) => !PROP_FIELDS.includes(k) || k === "variant" || k === "n"));
    for (const f of def.draw(withVariant(def, params), rng(id), o.kit).flats) big(`prop ${id}`, f);
  }

  return out;
}
