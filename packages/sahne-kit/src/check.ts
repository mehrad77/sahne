// The checks a set piece or prop must pass (`sahne-kit/check`), as functions that return problems, so the kit's
// tests, backstage's MCP tools and `promote.ts` hold every piece to the same rules (STYLE.md *Places*, *Props*):
//
//   meta     a line on what it draws; every param declared with a legal default; no engine param or place field
//   variants each sets only declared params, to legal values
//   reads    every param the drawing reads is declared (drawn through a params object that records what is read,
//            with its defaults, each variant, each enum value, each flag and each number's top, two seeds)
//   flats    finite art that fits an atlas layer at its ppcm (0 < ppcm ≤ 16, glowPpcm ≤ ppcm); lights with a radius
//   motion   paths that rest where they start, blinks at most three times a second, gentle sways
//   text     words inside their art, never empty, with a language tag
//
// An error fails the gate; a warning is advice (a piece rasterised finer than 3 px/cm).
//
// `officialProblems` holds a drawing to be promoted into the kit (`drawing/promote.ts`) to the stricter rules of an official item.

import { Path, cellSize, fitsAtlas, groupBounds, moveAt, rng, tone, type Kit, type PieceDef, type PieceOut, type ParamSpec, type ParamType, type Tone } from "sahne";
import { compileDrawing, KIT_ID, DRAWING_LIMITS, type Credit, type DrawingDoc, type DrawingFill } from "./drawing.ts";
import { FABRIC, HAIR, METAL, SET, SKIN } from "./palette.ts";

/** Which rule a problem breaks (the header above). */
export type Rule = "meta" | "variants" | "reads" | "flats" | "motion" | "text" | "official";
export interface Problem { level: "error" | "warn"; rule: Rule; id: string; msg: string }

/** Params the engine gives every piece or prop, which no generator declares: its named look and whether it is in a hand. */
export const ENGINE_PARAMS = ["variant", "held"];
/** A place's own fields of a piece (PieceRef: where it stands, in metres, its id, seed and states) and of a prop (PropRef): a generator param of the same name would be read as both (a gull's `y` of 300 cm put the flock 300 m up). */
export const PIECE_FIELDS = ["kit", "x", "y", "z", "id", "seed", "in", "switch"], PROP_FIELDS = ["kit", "at", "terms", "shown", "keep", "in"];
/** The seeds every case is drawn with. */
const SEEDS = ["a", "b", "c"];

const types = (spec: ParamSpec): readonly ParamType[] => typeof spec.type === "string" ? [spec.type] : spec.type;
const has = (spec: ParamSpec, t: ParamType) => types(spec).includes(t);

/** The values a param is tried with, beyond its default: each of an enum's, both of a flag's, a number's top. */
function tries(spec: ParamSpec): unknown[] {
  const out: unknown[] = [];
  if (has(spec, "enum")) out.push(...(spec.values ?? []));
  if (has(spec, "bool")) out.push(true, false);
  if ((has(spec, "int") || has(spec, "num")) && spec.max !== undefined) out.push(spec.max);
  return out;
}

/** Whether `v` is a legal value of a param. */
export const legal = (spec: ParamSpec, v: unknown) => types(spec).some(t => okAs(t, spec, v));
function okAs(type: ParamType, spec: ParamSpec, v: unknown): boolean {
  switch (type) {
    case "enum": return typeof v === "string" && (spec.values ?? []).includes(v);
    case "int": return Number.isInteger(v) && (spec.min === undefined || (v as number) >= spec.min) && (spec.max === undefined || (v as number) <= spec.max);
    case "num": return typeof v === "number" && Number.isFinite(v) && (spec.min === undefined || v >= spec.min) && (spec.max === undefined || v <= spec.max);
    case "bool": return typeof v === "boolean";
    case "text": return typeof v === "string" || typeof v === "number" || (Array.isArray(v) && v.every(x => typeof x === "string" || typeof x === "number"));
    case "color": return typeof v === "string";
    case "list": return Array.isArray(v);
    case "object": return typeof v === "object" && v !== null && !Array.isArray(v);
  }
}

/** How a def sits in the kit: its ids, and whether it is a set piece, a prop or both. */
export interface As { ids: string[]; set: boolean; prop: boolean }

/** A language tag: two or three letters, then subtags (`tr`, `fr`, `pt-BR`). */
const LANG = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** Everything wrong with one generator, as `as` places it in the kit. */
export function checkPiece(def: PieceDef, as: As, kit: Kit): Problem[] {
  const out: Problem[] = [], id = as.ids.join("/");
  let rule: Rule = "meta";
  const err = (msg: string) => out.push({ level: "error", rule, id, msg });
  const meta = def.meta;

  // meta
  if (!meta) err("no meta");
  else {
    if (meta.about.trim().length <= 8) err("meta.about is too short");
    for (const [name, spec] of Object.entries(meta.params)) {
      if (ENGINE_PARAMS.includes(name)) err(`${name}: the engine gives it, don't declare it`);
      if (as.set && PIECE_FIELDS.includes(name)) err(`${name}: a piece's own field in a place (PieceRef); name the param something else`);
      if (as.prop && PROP_FIELDS.includes(name)) err(`${name}: a prop's own field in a place (PropRef); name the param something else`);
      if (has(spec, "enum") && !spec.values?.length) err(`${name}: an enum with no values`);
      if (spec.default !== undefined && !legal(spec, spec.default)) err(`${name}: default ${JSON.stringify(spec.default)} is not a legal ${types(spec).join(" or ")}`);
    }
  }

  // variants
  rule = "variants";
  for (const [v, params] of Object.entries(def.variants ?? {})) for (const [k, val] of Object.entries(params)) {
    const spec = meta?.params[k], tag = `variant ${v}: ${k}`;
    if (!spec) err(`${tag} is not in meta.params`);
    else if (!legal(spec, val)) err(`${tag} = ${JSON.stringify(val)} is not a legal ${types(spec).join(" or ")}${spec.values ? ` (${spec.values.join(" ")})` : ""}`);
  }

  // reads
  rule = "reads";
  if (meta) {
    const read = new Set<string>();
    const watch = (p: Record<string, unknown>) => new Proxy(p, {
      get(t, k) { if (typeof k === "string") read.add(k); return Reflect.get(t, k); },
      has(t, k) { if (typeof k === "string") read.add(k); return Reflect.has(t, k); },
    });
    const cases: Record<string, unknown>[] = [{}, ...Object.values(def.variants ?? {})];
    for (const [name, spec] of Object.entries(meta.params)) for (const v of tries(spec)) cases.push({ [name]: v });
    if (as.prop) cases.push({ n: 3 }, { held: true });
    try {
      for (const p of cases) for (const seed of ["a", "b"]) def.draw(watch({ ...p }), rng(`${as.ids[0]}/${seed}`), kit);
    } catch (e) { err(`throws while drawing: ${(e as Error).message}`); }
    const undeclared = [...read].filter(k => !Object.hasOwn(meta.params, k) && !ENGINE_PARAMS.includes(k));
    if (undeclared.length) err(`reads undeclared params: ${undeclared.join(" ")}`);
  }

  // flats, motion and text, drawn as a place would: a piece with its defaults, a prop also counted and held
  const drawCases: { p: Record<string, unknown>; set: boolean }[] = [];
  if (as.set) drawCases.push({ p: {}, set: true });
  if (as.prop) drawCases.push({ p: {}, set: false }, { p: { n: 3 }, set: false }, { p: { held: true }, set: false });
  for (const { p, set } of drawCases) for (const seed of SEEDS) {
    let o: PieceOut;
    try { o = def.draw({ ...p }, rng(`${as.ids[0]}/${seed}`), kit); } catch (e) { rule = "flats"; err(`${JSON.stringify(p)}: throws: ${(e as Error).message}`); continue; }
    for (const m of drawnProblems(o, set)) out.push({ level: m.level, rule: m.rule, id, msg: `${set ? "set" : "prop"} ${JSON.stringify(p)}: ${m.msg}` });
  }
  // one line per problem: the same one from three seeds is said once
  const seen = new Set<string>();
  return out.filter(q => { const k = `${q.level}|${q.rule}|${q.msg}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

const finiteBox = (b: number[]) => b.every(Number.isFinite) && b[2] > b[0] && b[3] > b[1];

/** Everything wrong with what one draw made. */
export function drawnProblems(out: PieceOut, set: boolean): Omit<Problem, "id">[] {
  const ps: Omit<Problem, "id">[] = [];
  let rule: Rule = "flats";
  const err = (msg: string) => ps.push({ level: "error", rule, msg }), warn = (msg: string) => ps.push({ level: "warn", rule, msg });
  if (!out.flats.length) err("no flats");
  for (const f of out.flats) {
    if (!(finiteBox(groupBounds(f.group)) || f.emissive)) err("a flat with no finite art");
    if (f.emissive && !groupBounds(f.emissive).every(Number.isFinite)) err("emissive art is not finite");
    for (const k of ["x", "y", "z", "ppcm", "lit", "yaw", "pitch"] as const) if (f[k] !== undefined && !Number.isFinite(f[k])) err(`${k} is not finite`);
    // small things raster finely (a phone at 12 px/cm, for its screen); nothing outgrows an atlas layer
    const ppcm = f.ppcm ?? 1.6;
    if (!(ppcm > 0 && ppcm <= 16)) err(`ppcm ${ppcm}: it must be over 0 and at most 16`);
    else if (set && ppcm > 3 && !f.sky) warn(`ppcm ${ppcm}: a set piece is drawn at 3 px/cm or less (STYLE.md)`);
    // the glow is rasterised at its own ppcm (glowPpcm, at most the art's), else the flat's
    if (f.glowPpcm !== undefined && !(f.glowPpcm > 0 && f.glowPpcm <= ppcm)) err(`glowPpcm ${f.glowPpcm}: at most the flat's ppcm`);
    for (const [g, k] of [[f.group, ppcm], [f.emissive, f.glowPpcm ?? ppcm]] as const) {
      if (!g?.shapes.length || !(k > 0)) continue;
      const c = cellSize(g, k);
      if (!fitsAtlas(c.w, c.h)) err(`${c.w} × ${c.h} px, more than an atlas layer: lower its ppcm or split it`);
    }
    // motion
    const m = f.move;
    if (m) {
      rule = "motion";
      if (m.phase !== undefined && !(m.phase >= 0 && m.phase < 1)) err(`motion phase ${m.phase}`);
      if (m.path) {
        if (!(m.path.pts.length >= 2 && m.path.pts.every(q => q.length === 3 && q.every(Number.isFinite)) && m.path.ms >= 500)) err("a path needs 2 or more finite [x, y, z] points and ms ≥ 500");
        // a path shown only in parts of its period (a passenger between stops) may be hidden at rest
        const r0 = moveAt(m, 0);
        if (!m.phase && (r0 || !m.path.show) && JSON.stringify(r0?.at) !== JSON.stringify(m.path.pts[0].map(v => v / 100))) err("a path must rest at its first point");
      }
      if (m.blink && !(m.blink.ms >= 334 && m.blink.on > 0 && m.blink.on < 1)) err("a blink at most three times a second (ms ≥ 334), 0 < on < 1");
      // a big flat sways gently; a small creature may swish its tail or peck (at most 0.3 rad under 60 cm)
      const [bx0, by0, bx1, by1] = groupBounds(f.group), small = Math.max(bx1 - bx0, by1 - by0) <= 60;
      if (m.sway && !(Math.abs(m.sway.rot ?? 0) <= (small ? 0.3 : 0.1) && Math.abs(m.sway.dy ?? 0) <= 5 && m.sway.ms >= 300)) err(`a sway must be gentle: rot ≤ ${small ? 0.3 : 0.1}, dy ≤ 5, ms ≥ 300`);
      if (m.scroll && !(Number.isFinite(m.scroll.dx) && m.scroll.ms > 0)) err("a scroll needs a finite dx and ms > 0");
      for (const t of [0, 1234, 9876, 123456]) { const at = moveAt(m, t); if (at && ![...at.at, at.dx, at.dy, at.rot].every(Number.isFinite)) { err(`motion at ${t} ms is not finite`); break; } }
      rule = "flats";
    }
  }
  // words: a blinking cell carries only a speck of art, its words lie inside its board's (the still flat with words)
  rule = "text";
  const board = out.flats.find(g => g.text?.length && !g.move);
  for (const f of out.flats) for (const t of f.text ?? []) {
    const b = groupBounds(f.move?.blink && board ? board.group : f.group);
    if (!(t.x >= b[0] - 0.5 && t.y >= b[1] - 0.5 && t.x + t.w <= b[2] + 0.5 && t.y + t.h <= b[3] + 0.5)) err(`"${t.text}" lies outside its art`);
    if (!(t.text.trim().length > 0)) err("an empty text");
    if (t.lang !== undefined && !LANG.test(t.lang)) err(`"${t.text}": lang ${JSON.stringify(t.lang)} is not a language tag (tr, fr, pt-BR)`);
  }
  rule = "flats";
  for (const l of out.lights ?? []) if (!([l.x, l.y, l.z, l.radius, l.intensity ?? 1].every(Number.isFinite) && l.radius > 0)) err("a light needs a finite place and a radius");
  return ps;
}

/** Every generator of a kit's set and props, each once with all its ids. */
export function kitDefs(kit: Pick<Kit, "set" | "props">): Map<PieceDef, As> {
  const defs = new Map<PieceDef, As>();
  for (const [kind, map] of [["set", kit.set ?? {}], ["props", kit.props ?? {}]] as const) for (const [id, def] of Object.entries(map)) {
    const e = defs.get(def) ?? { ids: [], set: false, prop: false };
    if (!e.ids.includes(id)) e.ids.push(id);
    if (kind === "set") e.set = true; else e.prop = true;
    defs.set(def, e);
  }
  return defs;
}

/** Everything wrong with every generator of a kit. */
export function checkKit(kit: Kit): Problem[] {
  const out: Problem[] = [];
  for (const [def, as] of kitDefs(kit)) out.push(...checkPiece(def, as, kit));
  return out;
}

/** A problem as one line. */
export const problemLine = (p: Problem) => `${p.level === "warn" ? "warning: " : ""}${p.id}: ${p.msg}`;

// ---- an official item ------------------------------------------------------------------------------------------------------

/** What `officialProblems` needs to know of the kit it joins (the caller reads it; the checks are pure). */
export interface OfficialContext {
  /** The kit as it is, with every family loaded: its set pieces, props, parts and aliases. */
  kit: Pick<Kit, "set" | "props" | "parts" | "aliases" | "color">;
  /** The family it goes into, and the families that exist. */
  family: string; families: readonly string[];
  /** Whether that family's file takes drawn items (it imports `drawn/<family>.gen.ts`). */
  wired: boolean;
  /** The tags on the backstage kit page's shelves (`model/kitgroups.ts`), for props and for set pieces. */
  shelfTags: { props: ReadonlySet<string>; set: ReadonlySet<string> };
  /** The family chunk's size once the item is in, and its budget, both gzip bytes (promote.ts measures them). */
  size?: { gzip: number; budget: number };
}

/** The most a set piece's ppcm may be, and a prop's: the kit's own, which `checkPiece` only warns about for a piece. */
const OFFICIAL_PPCM = { set: 3, prop: 16 };

/** Every colour the kit names, so a hex that is not one of them (or a step of one) can be told. */
function kitColours(): Set<string> {
  const out = new Set<string>();
  for (const pal of [SET, FABRIC, METAL, SKIN, HAIR]) for (const c of Object.values(pal)) for (const t of ["base", "shade", "deep", "light", "edge"] as Tone[]) out.add(tone(c, t).toUpperCase());
  return out;
}

/** Every plain `#hex` a drawing names (a `$param` or palette id is not one; a `{tone}` names its base). */
function hexesOf(doc: DrawingDoc): Set<string> {
  const out = new Set<string>(), add = (f: DrawingFill | undefined) => { const c = typeof f === "object" ? f?.tone : f; if (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c)) out.add(c.toUpperCase()); };
  for (const k of Object.values(doc.kinds ?? {})) for (const f of k.flats ?? []) {
    for (const s of [...(f.shapes ?? []), ...(f.glow ?? [])]) { add(s.fill); add(s.stroke?.color); }
    for (const t of f.text ?? []) add(t.color);
  }
  for (const p of Object.values(doc.params ?? {})) if (p.type === "color" && typeof p.default === "string") add(p.default);
  return out;
}

/** Runs of small, letter-like shapes standing in a row on one baseline: words drawn as shapes (a heuristic: text is `text`, which the page sets in a font). */
function wordLike(doc: DrawingDoc): string[] {
  const out: string[] = [];
  for (const [kn, k] of Object.entries(doc.kinds ?? {})) k.flats?.forEach((f, fi) => {
    const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (const s of f.shapes ?? []) {
      try { const [x0, y0, x1, y1] = Path.fromSvg(s.d).bounds(); if (x1 - x0 <= (y1 - y0) * 1.4 && y1 - y0 >= 0.5) boxes.push({ x0, x1, y0, y1 }); } catch { /* compileDrawing reports the path */ }
    }
    boxes.sort((a, b) => a.x0 - b.x0);
    let run = 1;
    for (let i = 1; i <= boxes.length; i++) {
      const a = boxes[i - 1], b = boxes[i], h = a.y1 - a.y0;
      const next = b && Math.abs((b.y1 - b.y0) - h) <= h * 0.25 && Math.abs(b.y1 - a.y1) <= h * 0.25 && b.x0 - a.x1 >= -0.01 && b.x0 - a.x1 <= h * 0.8;
      if (next) run++; else { if (run >= 5) out.push(`kind ${kn} flat ${fi}: ${run} small letter-like shapes stand in a row (words drawn as shapes?): words are \`text\`, set in the page's font`); run = 1; }
    }
  });
  return out;
}

const SENTENCE = /^\p{Lu}.{14,}[.!?]$/u;

/** One line of plain text that can stand in a commit, a table cell and a pull request: no control characters, no `<`/`>`, no markdown (`[ ] ` |`), no leading `@` or `-`. */
const plainLine = (v: unknown, max = 80): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\u0000-\u001f\u007f<>\[\]`|]/.test(v) && !/^[@-]/.test(v.trim());
const CONTACT = /^(github:@?[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})|[^\s@<>|`\[\]-][^\s@<>|`\[\]]*@[^\s@<>|`]+\.[^\s@<>|`]+)$/;
/** Whether `YYYY-MM-DD` is a real calendar date, no later than today (UTC). */
const realDate = (v: unknown): boolean => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && v <= new Date().toISOString().slice(0, 10);
};

/**
 * What is wrong with a credit's own fields (the lines; [] when whole). The text fields end up in a commit, a pull request, a
 * table and a JSON file, so they are one plain line each. `consent` is `true` (the author's, for a person's art) or "project"
 * (the owner's own kit agents' art, which only promote.ts without --pr writes; the owner's merge is the consent).
 */
export function creditProblems(cr: Credit): string[] {
  const out: string[] = [];
  if (!plainLine(cr.by)) out.push("credit.by: the author's name as they want it shown: one plain line of at most 80 characters, no < > [ ] ` | and no leading @ or -");
  if (!(typeof cr.contact === "string" && cr.contact.length <= 80 && CONTACT.test(cr.contact))) out.push("credit.contact: how to reach the author: github:name or an email address");
  if (cr.story !== undefined && !plainLine(cr.story)) out.push("credit.story: one plain line of at most 80 characters, no < > [ ] ` | and no leading @ or -");
  if (cr.consent !== true && cr.consent !== "project") out.push("credit.consent: the author must agree to release the art under CC BY 4.0 (LICENSE-ART) and say it is their own work, not traced or copied");
  if (cr.licence !== "CC-BY-4.0") out.push("credit.licence: CC-BY-4.0");
  if (!realDate(cr.date)) out.push("credit.date: a real date, YYYY-MM-DD, no later than today");
  if (!/^x_[a-z0-9_]+$/.test(cr.from ?? "")) out.push("credit.from: the content id it had (x_…)");
  return out;
}

/**
 * Everything wrong with a drawing about to join the kit under its new id, with its `credit` (the document `promote.ts` would
 * write): the content rules (`compileDrawing`, `checkPiece`) and the official ones. The id is unused, not `x_`, snake_case and
 * not a past alias; the family exists, takes drawn items and stays in budget; every tag is on a shelf; `about` is a sentence;
 * text has a `lang`; a piece is drawn at 3 px/cm or less; colours are the kit's or the tone ramp's (a stray hex is a warning);
 * no words drawn as shapes (a warning); the caps; and the credit is whole, with consent.
 */
export function officialProblems(doc: DrawingDoc, c: OfficialContext): Problem[] {
  const out: Problem[] = [], id = doc?.id ?? "?";
  const err = (msg: string) => out.push({ level: "error", rule: "official", id, msg }), warn = (msg: string) => out.push({ level: "warn", rule: "official", id, msg });
  const taken = (m?: Record<string, unknown>) => !!m && Object.hasOwn(m, id);
  // the id
  if (!KIT_ID.test(id)) err(`id ${JSON.stringify(id)}: a kit id is lowercase letters and digits in snake_case, and never starts with x_`);
  else {
    if (taken(c.kit.set) || taken(c.kit.props) || taken(c.kit.parts)) err(`id ${id} is taken by a set piece, prop or part of the kit: ids are permanent, pick another`);
    if (c.kit.aliases && (Object.hasOwn(c.kit.aliases, id) || Object.values(c.kit.aliases).includes(id))) err(`id ${id} is a past alias or what one leads to: pick another`);
  }
  // the family
  if (!c.families.includes(c.family)) err(`family ${JSON.stringify(c.family)} does not exist (${c.families.join(", ")})`);
  else if (!c.wired) err(`family ${c.family} does not take drawn items yet: its file (src/set/${c.family}.ts) imports \`DRAWN\` from "./drawn/${c.family}.gen.ts", runs it through \`drawnFamily\` (sahne-kit/drawing) and spreads the result into its set and props (see bakery.ts)`);
  if (c.size && c.size.gzip > c.size.budget) err(`family ${c.family} would be ${(c.size.gzip / 1024).toFixed(1)} KB gzip, over its ${(c.size.budget / 1024).toFixed(0)} KB budget`);
  // the content rules, with the new id
  const { def, problems } = compileDrawing(doc, true);
  for (const m of problems) err(m);
  // tags, about, lang, ppcm, caps
  const shelves = doc.as === "prop" ? [c.shelfTags.props] : doc.as === "set" ? [c.shelfTags.set] : [c.shelfTags.props, c.shelfTags.set];
  if (!doc.tags?.length) err("tags: at least one, from the kit page's shelves (model/kitgroups.ts), so the item can be found");
  for (const t of doc.tags ?? []) if (!shelves.every(s => s.has(t))) err(`tag ${JSON.stringify(t)} is on no shelf of the kit page (${doc.as === "set" ? "set piece" : doc.as === "prop" ? "prop" : "prop and set piece"} shelves in model/kitgroups.ts): use one that is, or add the shelf`);
  if (!SENTENCE.test((doc.about ?? "").trim())) err("about: say what it draws in a sentence (a capital letter, a full stop, at least 15 characters)");
  for (const [kn, k] of Object.entries(doc.kinds ?? {})) {
    for (const [fi, f] of (k.flats ?? []).entries()) for (const t of f.text ?? []) if (!t.lang) err(`kind ${kn} flat ${fi}: text "${t.text}" has no lang`);
    const ppcm = k.ppcm ?? (doc.as === "set" ? 1.6 : 5);
    if (doc.as !== "prop" && ppcm > OFFICIAL_PPCM.set) err(`kind ${kn}: ppcm ${ppcm}: a set piece is drawn at ${OFFICIAL_PPCM.set} px/cm or less`);
    if (ppcm > OFFICIAL_PPCM.prop) err(`kind ${kn}: ppcm ${ppcm}: at most ${OFFICIAL_PPCM.prop}`);
  }
  if (JSON.stringify({ ...doc, credit: undefined }).length > DRAWING_LIMITS.bytes) err(`over ${DRAWING_LIMITS.bytes / 1024} KB`);
  // colours
  const known = kitColours(), stray = [...hexesOf(doc)].filter(h => !known.has(h));
  if (stray.length) warn(`${stray.length} colour${stray.length === 1 ? "" : "s"} outside the kit's (SET and the palettes, or a tone of one): ${stray.slice(0, 6).join(" ")}${stray.length > 6 ? " …" : ""}; a material of its own is fine, a near miss of a kit colour is not`);
  for (const m of wordLike(doc)) warn(m);
  // the credit
  const cr = doc.credit;
  if (!cr) err("credit: who drew it, how to reach them, and their consent");
  else {
    for (const m of creditProblems(cr)) err(m);
    if (/^x_[a-z0-9_]+$/.test(cr.from ?? "") && c.kit.aliases && Object.hasOwn(c.kit.aliases, cr.from)) err(`credit.from ${cr.from} is already an alias (of ${c.kit.aliases[cr.from]}): two stories may use one x_ id, but only one item can be its successor`);
  }
  // the compiled generator, as a place would draw it
  if (!problems.length) {
    const prop = doc.as !== "set", set = doc.as !== "prop", kit = { ...c.kit, set: { ...c.kit.set, ...(set ? { [id]: def } : {}) }, props: { ...c.kit.props, ...(prop ? { [id]: def } : {}) } } as Kit;
    for (const q of checkPiece(def, { ids: [id], set, prop }, kit)) out.push(q);
  }
  return out;
}
