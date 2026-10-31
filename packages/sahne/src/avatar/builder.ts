// createBuilder(): the headless model of the character builder (DESIGN.md §10). It holds one
// normalized document and offers, per field, the options that fit (parts of the field's slot, not
// reserved for the cast or hidden), marking what is still locked. A choice applies the slot rules (a dress
// clears top and bottom and a top clears the dress, remembering what it cleared; a headscarf
// keeps the hair). It randomises tastefully and keeps an undo history. No DOM: a UI reads
// `sections`, `fields`, `options` and `colorOptions`, writes with `set` and `setColor` (`preview`
// shows what a `set` would do), and redraws from `subscribe`. A part field may also take a
// pattern (`patternOptions`, `setPattern`, its inks as extra colours) and a side (`setSide`).
// Field ids are the document's paths (`face.eyes`, `outfit.top`, `facialHair`). Every option of a
// field is a value `set` accepts. Parts are offered to the builds they are made for; a part a new
// build cannot wear is taken off and comes back when the build changes back.
// A host may narrow what is offered (`offer`: a learner's starter set) and widen one field again
// (`more`); an author building the cast (`cast`) is offered every part, the cast's own included.

import type { Kit, FeatureField, Names, Odds, PartDef } from "../core/kit.ts";
import type { AvatarDoc, Build, WearSide } from "../core/types.ts";
import { rng, type Rng } from "../core/rng.ts";
import { GARMENT_FIELDS, at, own, isObj, partOf, usesOf, hiddenSlots, applyReplaces, fitsBuild } from "./rules.ts";
import { normalize, serialize } from "./normalize.ts";

/** `choice` one of a list, `multi` several of a list (marks: toggle them one by one), `number` a 0–1 slider (height), `color` a palette colour, `part` a kit part with its colours. */
export type FieldKind = "choice" | "multi" | "number" | "color" | "part";
export type FieldValue = string | number | string[] | null;

export interface Section { id: string; label: string }
export interface FieldInfo {
  id: string;
  section: string;
  kind: FieldKind;
  label: string;
  /** Whether it can be none (an outer layer, glasses, facial hair). */
  optional: boolean;
  /** How many colours the current choice takes (`colorOptions(id, 0 … colors - 1)`). */
  colors: number;
  /** The current choice is not drawn because another part hides it (the hair under a headscarf). */
  hidden: boolean;
  /** `multi` fields: the most values the document holds. */
  max?: number;
  /** A part field whose current part takes patterns (`patternOptions`). */
  patterns?: true;
  /** While a pattern is on: how many inks it prints in. They are colours `colors` … `colors + inks - 1` of the field (`colorOptions`, `getColor`, `setColor`); an ink the learner has not picked is derived from the ground. */
  inks?: number;
  /** A one-sided part: the sides it may be worn on (`setSide`). */
  sides?: WearSide[];
}
export interface Option {
  value: string | null; label: string; locked: boolean; unlock?: string; tags?: string[];
  /** Only with `BuilderOptions.cast`: a part kept for the cast or hidden from learners. */
  reserved?: "cast" | "hidden";
}
/** What an `offer` is asked about: a field's option, a colour of its palette, or a pattern. */
export type OfferKind = "option" | "color" | "pattern";
/** A palette colour; `locked` (with its `unlock`) only for a colour the app has not unlocked yet. */
export interface ColorOption { id: string; hex: string; label: string; locked?: true; unlock?: string }

export interface BuilderOptions {
  /** The unlocked ids (`PartDef.unlock`) or a test for one. Without it nothing is unlocked: such parts are listed, locked. */
  unlocked?: Iterable<string> | ((unlock: string) => boolean);
  /** The builds the learner may pick (default: all of the kit's). */
  builds?: Build[];
  /** Language of the labels (default `en`); settable later. */
  lang?: string;
  /** The starting document may be a cast document: `#RRGGBB` colours and custom parts are kept. */
  trusted?: boolean;
  /**
   * An author building the cast: the parts tagged `cast` and `hidden` are offered too (marked
   * `reserved`). Use it with `trusted`, or `normalize` drops the cast's parts again. The randomiser
   * still leaves them out.
   */
  cast?: boolean;
  /**
   * A narrower set than the kit offers, decided by the host (a learner's starter set): what is not
   * offered is left out of `options`, `colorOptions` and `patternOptions` (not locked: absent), `set`
   * refuses it and `randomize` never picks it. The current value is always listed. `more(field)`
   * lifts it for one field.
   */
  offer?: (field: string, value: string, kind: OfferKind) => boolean;
}

export interface Builder {
  /** The current document: normalized, canonical, at most 2 KB, frozen. */
  readonly doc: AvatarDoc;
  /** The language of the labels; setting a new one notifies subscribers, so a UI can relabel. */
  lang: string;
  /** Body, Face, Hair, Clothes, Extras. */
  sections(): Section[];
  /** The section's fields that offer a real choice now. */
  fields(section: string): FieldInfo[];
  field(id: string): FieldInfo | null;
  /** The choices for a field (none first when it is optional); locked ones are listed but cannot be set. */
  options(field: string): Option[];
  /** The palette of a colour field, or of colour `index` of the field's current part (an index past its colours is an ink of its pattern). */
  colorOptions(field: string, index?: number): ColorOption[];
  get(field: string): FieldValue;
  /** The effective colour id of a part field's colour (the default when the document names none; null for an ink left to the kit). */
  getColor(field: string, index?: number): string | null;
  /** The patterns the current part of a field takes, none first; locked ones are listed but cannot be set. */
  patternOptions(field: string): Option[];
  getPattern(field: string): string | null;
  /** Put a pattern on the field's part (null takes it off); refused when the part does not take it or it is locked. */
  setPattern(field: string, id: string | null): boolean;
  /** The side a one-sided part is worn on (null for other parts). */
  getSide(field: string): WearSide | null;
  setSide(field: string, side: WearSide): boolean;
  /**
   * Whether the value was accepted (an unknown, locked or unfitting one is refused and changes
   * nothing). Pass what `options` lists: for a `multi` field one option value toggles it (refused
   * when the list is full); the whole list, or `null` for none, replaces it.
   */
  set(field: string, value: unknown): boolean;
  /** The document `set(field, value)` would make (with its rules for dresses and the rest), or null where `set` would refuse. Changes nothing: for thumbnails of options. */
  preview(field: string, value: unknown): AvatarDoc | null;
  setColor(field: string, index: number, id: string): boolean;
  /** A new tasteful, valid character; `keep` lists fields or sections (`body`, `face`, …) to leave as they are. */
  randomize(seed: number | string, o?: { keep?: string[] }): void;
  undo(): boolean;
  redo(): boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Back to the starting document (undoable). */
  reset(): void;
  /** Whether `offer` holds back some of the field's options, colours or patterns (a UI's "more" button). */
  hasMore(field: string): boolean;
  /** Offer everything of the field from now on (it notifies subscribers). */
  more(field: string): void;
  /** Called with the document after every change, undo, redo, randomize and reset, and when the language changes. Returns the way to stop. */
  subscribe(listener: (doc: AvatarDoc) => void): () => void;
}

const SECTIONS = ["body", "face", "hair", "clothes", "extras"];
const ORDER = ["body.build", "body.height", "body.shape", "skin", "face.shape", "face.eyes", "face.eyeColor", "face.brows", "face.nose", "face.mouth", "face.ears", "face.marks", "facialHair",
  "hair.style", "outfit.top", "outfit.bottom", "outfit.dress", "outfit.outer", "outfit.shoes",
  "wear.head", "wear.hat", "wear.hair", "wear.eyes", "wear.ears", "wear.aid", "wear.neck", "wear.wrist", "wear.hands", "wear.waist", "carry", "hold"];
const KIND: Record<string, FieldKind> = { "body.height": "number", skin: "color", "face.eyeColor": "color", "face.marks": "multi" };
const PALETTE: Record<string, string> = { skin: "skin", "face.eyeColor": "eyes", "hair.style": "hair", facialHair: "hair" };
const KIDS = ["child", "toddler"];
/** The most values of a `multi` field when the kit does not say (`normalize` caps at the same number). */
const MAX_MULTI = 3;
const UNDO = 100;
/** The share of a slot's random picks that go to its modest parts, at least (more when they are more of the parts). */
const MODEST = 0.3;
/** The chance of an optional part in a random character. */
const ODDS: Record<string, number> = {
  "outfit.dress": 0.2, "outfit.outer": 0.25, "wear.head": 0.15, "wear.hat": 0.1, "wear.hair": 0.08, "wear.eyes": 0.22, "wear.ears": 0.12, "wear.aid": 0.03,
  "wear.neck": 0.12, "wear.wrist": 0.12, "wear.hands": 0.05, "wear.waist": 0.08, carry: 0.1, hold: 0.08,
};
/** The chance that a random garment that takes patterns wears one. */
const PATTERN_ODDS = 0.15;
/** The chance of each value of a multiple choice (a mark) at weight 1. */
const MULTI_ODDS = 0.18;

interface Def { id: string; section: string; kind: FieldKind; slot?: string; optional: boolean }
const SLOT = new Map(GARMENT_FIELDS.map(g => [g.field, g] as const));
const DEFS: Def[] = ORDER.map(id => {
  const g = SLOT.get(id);
  return {
    id, slot: g?.slot, kind: KIND[id] ?? (g ? "part" : "choice"), optional: id === "facialHair" || (!!g && !g.req),
    section: id.startsWith("body") || id === "skin" ? "body" : id.startsWith("face") || id === "facialHair" ? "face" : id === "hair.style" ? "hair" : id.startsWith("outfit") ? "clothes" : "extras",
  };
});
const DEF = new Map(DEFS.map(d => [d.id, d] as const));

// plain-object helpers for drafts (clones of a normalized document, edited, then normalized again)
type Obj = Record<string, any>;
function put(o: Obj, path: string, v: unknown) {
  const ks = path.split("."), last = ks.pop() as string;
  let c = o;
  for (const k of ks) c = c[k] ??= {};
  if (v == null) delete c[last]; else c[last] = v;
}
const freeze = <T>(x: T): T => { if (x && typeof x === "object") { Object.values(x).forEach(freeze); Object.freeze(x); } return x; };
/** `face.eyeColor` as a last-resort label: "Eye color". */
const humanize = (id: string) => (id.split(".").pop() as string).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, c => c.toUpperCase());
/** A pick by weight (all zero: an even pick). */
const wpick = <T>(r: Rng, vals: T[], w: (v: T) => number): T => {
  const ws = vals.map(w), sum = ws.reduce((a, b) => a + b, 0);
  let t = r() * (sum > 0 ? sum : vals.length);
  for (let i = 0; i < vals.length; i++) if ((t -= sum > 0 ? ws[i] : 1) < 0) return vals[i];
  return vals[vals.length - 1];
};
/** The weight an `Odds` gives a build (1 when it says nothing). */
const oddsOf = (o: Odds | undefined, build: string): number => {
  const n = typeof o === "number" ? o : o && Object.hasOwn(o, build) ? o[build as Build] : 1;
  return typeof n === "number" && n > 0 ? n : 0;
};

export function createBuilder(kit: Kit, start: unknown, o: BuilderOptions = {}): Builder {
  const norm = (d: unknown) => normalize(d, kit, { trusted: !!o.trusted });
  const initial = norm(start) ?? normalize(kit.defaultDoc, kit, { trusted: true }) ?? kit.defaultDoc;
  const ids = new Set(typeof o.unlocked === "function" ? undefined : o.unlocked);
  const open = (id: string) => (typeof o.unlocked === "function" ? o.unlocked(id) : ids.has(id));
  let lang = o.lang ?? "en", cur = freeze(initial);
  /** A document with its memory, one step of the history. */
  type Step = { doc: AvatarDoc; mem: Obj };
  const past: Step[] = [], future: Step[] = [], subs = new Set<(d: AvatarDoc) => void>();
  /** Garments removed because another part replaced them (or the build cannot wear them), put back when that changes. It belongs to the current document and goes with it through undo and redo. */
  let mem: Obj = {};

  const text = (names: Names | undefined, fb: string) => names?.[lang] ?? names?.en ?? fb;
  const word = (k: string, fb: string) => text(kit.labels?.[k], fb);
  const clone = (): Obj => JSON.parse(serialize(cur));
  const pal = (name: string): Record<string, string> => (isObj(own(kit.palettes, name)) ? kit.palettes[name] : {});
  const inPal = (name: string, id: unknown) => typeof id === "string" && Object.hasOwn(pal(name), id);
  const kid = () => KIDS.includes(cur.body.build);
  const nameOf = (p: PartDef, id: string) => text(p.names, p.name ?? id);
  /** The unlock a colour or pattern is still waiting for, or null when it is free to pick. */
  const colorLock = (id: unknown): string | null => { const t = typeof id === "string" ? own(kit.paletteUnlocks, id) : undefined; return typeof t === "string" && !open(t) ? t : null; };
  const patternLock = (id: string): string | null => { const t = own(own(kit.patterns, id), "unlock"); return typeof t === "string" && !open(t) ? t : null; };
  const patternsOf = (p: PartDef | undefined): string[] => (p?.patterns ?? []).filter(id => !kit.patterns || Object.hasOwn(kit.patterns, id));
  const inksOf = (pat: unknown): number => (typeof pat === "string" ? Math.min(2, Number(own(own(kit.patterns, pat), "inks") ?? 2) || 0) : 0);

  const emit = () => subs.forEach(f => f(cur));
  const commit = (next: AvatarDoc | null, nextMem: Obj) => {
    if (!next || serialize(next) === serialize(cur)) return;
    past.push({ doc: cur, mem });
    if (past.length > UNDO) past.shift();
    future.length = 0;
    cur = freeze(next); mem = nextMem;
    emit();
  };
  const jump = (from: Step[], to: Step[]) => {
    const s = from.pop();
    if (!s) return false;
    to.push({ doc: cur, mem });
    cur = s.doc; mem = s.mem;
    emit();
    return true;
  };

  /** The options of a field for a build (a part field lists the parts made for it). */
  /** Fields whose `offer` was lifted by `more`. */
  const wide = new Set<string>();
  /** Whether the host offers this value of the field (or it is the current one, which always shows). */
  const offered = (field: string, value: string | null, kind: OfferKind, current?: unknown): boolean =>
    !o.offer || value === null || wide.has(field) || value === current || (Array.isArray(current) && current.includes(value)) || o.offer(field, value, kind);
  const reserved = (p: PartDef): Option["reserved"] => (p.tags?.includes("cast") ? "cast" : p.tags?.includes("hidden") ? "hidden" : undefined);
  /** Every option of a field for a build, before the host's `offer`. */
  const allFor = (field: string, build: Build): Option[] => {
    const d = DEF.get(field);
    if (!d || d.kind === "number" || d.kind === "color") return [];
    const none: Option[] = d.optional ? [{ value: null, label: word("none", "None"), locked: false }] : [];
    if (d.kind === "part") {
      return [...none, ...Object.entries(kit.parts).filter(([, p]) => p.slot === d.slot && (o.cast || !reserved(p)) && fitsBuild(p, build)).map(([id, p]): Option => {
        const rs = reserved(p);
        return {
          value: id, label: nameOf(p, id), locked: !!p.unlock && !open(p.unlock),
          ...(p.unlock ? { unlock: p.unlock } : {}), ...(p.tags ? { tags: [...p.tags] } : {}), ...(rs ? { reserved: rs } : {}),
        };
      })];
    }
    const c = kit.features[field as FeatureField];
    const values = field === "body.build" && o.builds ? c.values.filter(v => o.builds?.includes(v as Build)) : c.values;
    return [...none, ...values.map((v): Option => ({ value: v, label: text(c.names?.[v], v), locked: false }))];
  };
  /** The options a field offers for a build: the host's `offer` applied. */
  const optionsFor = (field: string, build: Build): Option[] => {
    const all = allFor(field, build), now = get(field);
    return o.offer ? all.filter(x => offered(field, x.value, "option", now)) : all;
  };
  const options = (field: string) => optionsFor(field, cur.body.build);

  const get = (field: string): FieldValue => {
    const d = DEF.get(field), v = at(cur, field);
    if (!d) return null;
    if (d.kind === "number") return typeof v === "number" ? v : kit.defaultDoc.body.height;
    if (d.kind === "multi") return Array.isArray(v) ? [...v] : [];
    if (d.kind === "part") return typeof v === "string" ? v : isObj(v) ? (v.id as string) : null;
    if (field === "facialHair") return cur.facialHair?.style ?? null;
    return typeof v === "string" ? v : kit.features[field as FeatureField].default;
  };
  const partAt = (doc: unknown, field: string): PartDef | undefined => {
    const v = at(doc, field), hit = partOf(kit, typeof v === "string" ? v : own(v, "id"));
    return hit?.[1];
  };
  const palOf = (field: string, index: number): string | null => {
    const d = DEF.get(field);
    if (d?.kind === "color" || field === "hair.style" || field === "facialHair") return index === 0 ? PALETTE[field] : null;
    const p = d?.kind === "part" ? partAt(cur, field) : undefined, n = p?.colors ?? 0;
    if (!p || !(index >= 0)) return null;
    // past the part's own colours: the inks of its pattern, from the fabrics
    return index < n ? p.palettes?.[index] ?? "fabric" : index < n + inksOf(own(at(cur, field), "pattern")) ? "fabric" : null;
  };
  const getColor = (field: string, index = 0): string | null => {
    const d = DEF.get(field);
    if (d?.kind === "color") return index === 0 ? get(field) as string : null;
    if (field === "hair.style") return index === 0 ? cur.hair.color : null;
    if (field === "facialHair") return index === 0 && cur.facialHair ? cur.facialHair.color ?? cur.hair.color : null;
    const g = at(cur, field), p = partAt(cur, field), c = own(g, "colors"), inks = own(g, "inks"), n = p?.colors ?? 0;
    if (!p || !palOf(field, index)) return null;
    if (index >= n) return (Array.isArray(inks) ? inks[index - n] : undefined) ?? null;
    return (Array.isArray(c) ? c[index] : undefined) ?? p.defaults?.[index] ?? null;
  };

  const info = (d: Def): FieldInfo => {
    const p = d.kind === "part" ? partAt(cur, d.id) : undefined;
    const colors = d.id === "hair.style" ? 1 : d.id === "facialHair" ? (cur.facialHair ? 1 : 0) : p?.colors ?? 0;
    const inks = p ? inksOf(own(at(cur, d.id), "pattern")) : 0;
    return {
      id: d.id, section: d.section, kind: d.kind, label: text(kit.labels?.[d.id], humanize(d.id)), optional: d.optional, colors, hidden: !!p && hiddenSlots(usesOf(cur, kit)).has(p.slot),
      ...(d.kind === "multi" ? { max: kit.features[d.id as FeatureField].max ?? MAX_MULTI } : {}),
      ...(patternsOf(p).length ? { patterns: true as const } : {}), ...(inks ? { inks } : {}), ...(p?.sides ? { sides: [...p.sides.allowed] } : {}),
    };
  };
  const visible = (d: Def) => (d.id === "facialHair" && kid() ? false : d.kind === "number" || d.kind === "color" || d.kind === "multi" ? true : options(d.id).length >= 2);

  /** Put back what a replacement or a build removed (`m`: the memory being edited), once nothing replaces it, it replaces nothing that is worn and the build can wear it. */
  const restore = (draft: Obj, m: Obj) => {
    const uses = usesOf(draft as AvatarDoc, kit), gone = applyReplaces(uses).slots, worn = new Set(uses.map(u => u.part.slot));
    for (const f of Object.keys(m)) {
      const p = partOf(kit, typeof m[f] === "string" ? m[f] : own(m[f], "id"))?.[1];
      if (at(draft, f) != null) delete m[f];
      else if (!gone.has(SLOT.get(f)?.slot ?? "") && !p?.replaces?.some(s => worn.has(s)) && (!p || fitsBuild(p, draft.body?.build))) { put(draft, f, m[f]); delete m[f]; }
    }
  };
  /** Colours a part keeps from the garment it follows in the same field, where the palettes agree. */
  const carry = (old: unknown, np: PartDef): string[] | undefined => {
    const op = partOf(kit, own(old, "id"))?.[1], oc = own(old, "colors"), r: string[] = [];
    if (!op || !Array.isArray(oc)) return undefined;
    for (let i = 0; i < Math.min(oc.length, np.colors ?? 0) && (op.palettes?.[i] ?? "fabric") === (np.palettes?.[i] ?? "fabric"); i++) r.push(oc[i]);
    return r.length ? r : undefined;
  };

  /** What `set` would make of the document and of the memory, or null where it refuses. */
  const plan = (field: string, value: unknown): { doc: AvatarDoc | null; mem: Obj } | null => {
    const d = DEF.get(field);
    if (!d) return null;
    const draft = clone(), m: Obj = { ...mem };
    if (d.kind === "number") {
      if (typeof value !== "number" || !Number.isFinite(value)) return null;
      draft.body.height = value;
    } else if (d.kind === "color") {
      if (!inPal(PALETTE[field], value) || colorLock(value) || !offered(field, value as string, "color", get(field))) return null;
      put(draft, field, value);
    } else if (d.kind === "multi") {
      const c = kit.features[field as FeatureField], have = get(field) as string[];
      // one value toggles it, a list replaces the list, null empties it
      const next = typeof value === "string" ? (have.includes(value) ? have.filter(x => x !== value) : [...have, value]) : value === null ? [] : value;
      // free values (identity marks) do not count towards the cap
      if (!Array.isArray(next) || !next.every(v => c.values.includes(v) && offered(field, v, "option", have)) || new Set(next.filter(v => !c.free?.includes(v))).size > (c.max ?? MAX_MULTI)) return null;
      put(draft, field, next.length ? next : null);
    } else {
      const op = options(field).find(x => x.value === value);
      if (!op || op.locked || (field === "facialHair" && kid())) return null;
      if (field === "facialHair") put(draft, field, value && { style: value, ...(cur.facialHair?.color ? { color: cur.facialHair.color } : {}) });
      else if (d.kind === "choice") {
        put(draft, field, value);
        if (field === "body.build") {
          if (KIDS.includes(value as string)) delete draft.facialHair;
          // parts the new build cannot wear come off, and come back with a build that can
          for (const u of usesOf(draft as AvatarDoc, kit)) if (!u.field.startsWith("custom") && !fitsBuild(u.part, value as Build)) { m[u.field] = at(draft, u.field); put(draft, u.field, null); }
          restore(draft, m);
        }
      } else if (field === "hair.style") put(draft, field, value);
      else {
        const part = typeof value === "string" ? kit.parts[value] : undefined, slot = d.slot as string, old = at(draft, field);
        const colors = part && carry(old, part), pat = own(old, "pattern"), inks = own(old, "inks"), side = own(old, "side");
        // the pattern goes along when the new part takes it too, and a side when it allows it (normalize checks)
        const keepPat = typeof pat === "string" && patternsOf(part).includes(pat);
        delete m[field];
        put(draft, field, part && { id: value, ...(colors ? { colors } : {}), ...(keepPat ? { pattern: pat, ...(Array.isArray(inks) ? { inks } : {}) } : {}), ...(typeof side === "string" ? { side } : {}) });
        // a part that replaces another, or one that another replaces, pushes it out
        for (const u of usesOf(draft as AvatarDoc, kit)) {
          if (u.field !== field && !u.field.startsWith("custom") && (u.part.replaces?.includes(slot) || part?.replaces?.includes(u.part.slot))) { m[u.field] = at(draft, u.field); put(draft, u.field, null); }
        }
        restore(draft, m);
      }
    }
    return { doc: norm(draft), mem: m };
  };
  const set = (field: string, value: unknown): boolean => {
    const p = plan(field, value);
    if (!p?.doc) return false;
    commit(p.doc, p.mem);
    return true;
  };

  const setColor = (field: string, index: number, id: string): boolean => {
    const name = palOf(field, index), d = DEF.get(field);
    if (!d || name === null || !inPal(name, id) || colorLock(id) || !offered(field, id, "color", getColor(field, index))) return false;
    if (d.kind === "color") return set(field, id);
    const draft = clone();
    if (field === "hair.style") draft.hair.color = id;
    else if (field === "facialHair") { if (!draft.facialHair) return false; draft.facialHair.color = id; }
    else {
      const g = at(draft, field), p = partAt(draft, field), n = p?.colors ?? 0;
      if (!isObj(g) || !p) return false;
      if (index >= n) {
        // an ink of the pattern: one before it must be there (inks have no defaults to write out)
        const inks: string[] = Array.isArray(g.inks) ? [...g.inks] : [];
        if (index - n > inks.length) return false;
        inks[index - n] = id;
        g.inks = inks;
      } else {
        const cols: string[] = Array.isArray(g.colors) ? [...g.colors] : [];
        // earlier colours the document leaves to the part's defaults are written out
        for (let i = cols.length; i < index; i++) { const def = p.defaults?.[i]; if (def === undefined) return false; cols[i] = def; }
        cols[index] = id;
        g.colors = cols;
      }
    }
    commit(norm(draft), mem);
    return true;
  };

  const patternOptions = (field: string): Option[] => {
    const now = getPattern(field), ids = patternsOf(DEF.get(field)?.kind === "part" ? partAt(cur, field) : undefined).filter(id => offered(field, id, "pattern", now));
    if (!ids.length) return [];
    return [{ value: null, label: word("none", "None"), locked: false }, ...ids.map((id): Option => {
      const lock = patternLock(id), unlock = own(own(kit.patterns, id), "unlock");
      return { value: id, label: text(own(kit.patterns, id) ? kit.patterns![id].names : undefined, id), locked: !!lock, ...(typeof unlock === "string" ? { unlock } : {}) };
    })];
  };
  const getPattern = (field: string): string | null => { const p = own(at(cur, field), "pattern"); return typeof p === "string" ? p : null; };
  const setPattern = (field: string, id: string | null): boolean => {
    const draft = clone(), g = at(draft, field);
    if (!isObj(g) || !patternOptions(field).some(x => x.value === id && !x.locked)) return false;
    if (id === null) { delete g.pattern; delete g.inks; } else g.pattern = id;
    commit(norm(draft), mem);
    return true;
  };
  const getSide = (field: string): WearSide | null => { const p = partAt(cur, field), s = own(at(cur, field), "side"); return p?.sides ? (typeof s === "string" ? s as WearSide : p.sides.default) : null; };
  const setSide = (field: string, side: WearSide): boolean => {
    const draft = clone(), g = at(draft, field), p = partAt(draft, field);
    if (!isObj(g) || !p?.sides || !(p.sides.allowed as string[]).includes(side)) return false;
    g.side = side;
    commit(norm(draft), mem);
    return true;
  };

  const randomize = (seed: number | string, ro: { keep?: string[] } = {}) => {
    const r = rng(seed), F = kit.features, keep = new Set<string>(), fam = (id: string) => kit.families?.[id] ?? id;
    for (const k of ro.keep ?? []) for (const d of DEFS) if (d.id === k || d.section === k) keep.add(d.id);
    // the host's `offer` (a starter set) narrows every pick; without one, nothing changes
    const may = (field: string, v: string, kind: OfferKind = "option") => !o.offer || wide.has(field) || o.offer(field, v, kind);
    const builds = F["body.build"].values.filter(v => (!o.builds || o.builds.includes(v as Build)) && may("body.build", v));
    const build = keep.has("body.build") ? cur.body.build : wpick(r, builds.length ? builds : F["body.build"].values, v => oddsOf(own(F["body.build"].weights, v) as Odds | undefined, ""));
    const pickColor = (name: string, field: string, avoid?: Set<string>) => {
      const every = Object.keys(pal(name)), mine = every.filter(i => may(field, i, "color")), all = mine.length ? mine : every, free = all.filter(i => !colorLock(i)), ids = free.length ? free : all, ok = avoid ? ids.filter(i => !avoid.has(fam(i))) : ids;
      return wpick(r, ok.length ? ok : ids, id => oddsOf(own(kit.odds, id) as Odds | undefined, build));
    };
    const weight = (key: FeatureField, v: string) => oddsOf(own(F[key].weights, v) as Odds | undefined, build);
    const choose = (key: FeatureField) => { const vs = F[key].values.filter(v => may(key, v, KIND[key] === "color" ? "color" : "option")); return wpick(r, vs.length ? vs : F[key].values, v => weight(key, v)); };
    // the colours of the dominant garments keep apart (and apart from any the learner kept)
    const avoid = new Set<string>();
    for (const f of ["outfit.dress", "outfit.top", "outfit.bottom", "outfit.outer"]) { const c = keep.has(f) && at(cur, f) ? getColor(f, 0) : null; if (c) avoid.add(fam(c)); }
    // the parts picked so far (and the kept ones): a part whose `avoid` names a tag of another, either way round, is not picked with it
    const chosen: PartDef[] = [];
    for (const f of keep) { const v = at(cur, f), p = DEF.get(f)?.kind === "part" ? partOf(kit, typeof v === "string" ? v : own(v, "id"))?.[1] : undefined; if (p) chosen.push(p); }
    const clash = (p: PartDef) => chosen.some(q => !!p.avoid?.some(t => q.tags?.includes(t)) || !!q.avoid?.some(t => p.tags?.includes(t)));
    const garment = (field: string, dominant: boolean) => {
      const all = optionsFor(field, build as Build).filter(x => x.value !== null && !x.locked && !x.reserved && !clash(kit.parts[x.value as string]) && may(field, x.value as string));
      if (!all.length) return null;
      const w = (x: Option) => oddsOf(kit.parts[x.value as string].odds, build), sum = (xs: Option[]) => xs.reduce((n, x) => n + w(x), 0);
      const modest = all.filter(x => x.tags?.includes("modest")), rest = all.filter(x => !x.tags?.includes("modest"));
      // modest parts (scarves, long sleeves and skirts) get at least MODEST of the picks, or their natural share when that is more
      const pool = modest.length && (!rest.length || r.chance(Math.max(sum(modest) / (sum(all) || 1), MODEST))) ? modest : rest;
      const id = wpick(r, pool, w).value as string, part = kit.parts[id], colors: string[] = [];
      chosen.push(part);
      for (let i = 0; i < (part.colors ?? 0); i++) {
        const name = part.palettes?.[i] ?? "fabric", def = part.defaults?.[i];
        if (i === 0 || def === undefined || r.chance(0.25)) colors[i] = pickColor(name, field, i === 0 && dominant ? avoid : undefined);
        else colors[i] = def;
      }
      if (dominant && colors[0]) avoid.add(fam(colors[0]));
      // now and then a print, in the colours it derives from the ground
      const pats = patternsOf(part).filter(p => !patternLock(p) && may(field, p, "pattern")), pattern = pats.length && r.chance(PATTERN_ODDS) ? r.pick(pats) : null;
      return { id, ...(colors.length ? { colors } : {}), ...(pattern ? { pattern } : {}) };
    };

    const doc: Obj = { v: 1, kit: kit.id, body: { build, height: Math.round(r() * 100) / 100, shape: choose("body.shape") }, skin: pickColor("skin", "skin"), face: {}, hair: {}, outfit: {} };
    for (const k of ["shape", "eyes", "brows", "nose", "mouth", "ears"] as const) doc.face[k] = choose(`face.${k}`);
    doc.face.eyeColor = choose("face.eyeColor");
    doc.face.marks = F["face.marks"].values.filter(v => may("face.marks", v) && r.chance(Math.min(1, MULTI_ODDS * weight("face.marks", v))));
    doc.hair = { style: garment("hair.style", false)?.id ?? cur.hair.style, color: pickColor("hair", "hair.style") };
    if (!KIDS.includes(build) && r.chance(0.22)) doc.facialHair = { style: choose("facialHair"), ...(r.chance(0.25) ? { color: pickColor("hair", "facialHair") } : {}) };
    const dress = !["outfit.top", "outfit.bottom", "outfit.dress"].some(f => keep.has(f)) && r.chance(ODDS["outfit.dress"]) ? garment("outfit.dress", true) : null;
    if (dress) doc.outfit.dress = dress;
    else { doc.outfit.top = garment("outfit.top", true); doc.outfit.bottom = garment("outfit.bottom", true); }
    for (const f of ["outfit.outer", "wear.head", "wear.eyes", "wear.ears", "wear.neck", "wear.wrist", "wear.waist", "carry", "wear.hat", "wear.hair", "wear.aid", "wear.hands", "hold"]) if (r.chance(ODDS[f])) put(doc, f, garment(f, f === "outfit.outer"));
    doc.outfit.shoes = garment("outfit.shoes", false);

    for (const f of keep) {
      // a kept part the new build cannot wear is not kept (normalize would drop it anyway)
      const v = at(cur, f), p = DEF.get(f)?.kind === "part" ? partOf(kit, typeof v === "string" ? v : own(v, "id"))?.[1] : undefined;
      if (p && !fitsBuild(p, doc.body.build)) continue;
      put(doc, f, v);
      if (f === "hair.style") doc.hair.color = cur.hair.color;
    }
    if (KIDS.includes(doc.body.build)) delete doc.facialHair;
    commit(norm(doc), {});
  };

  const colorOptions = (field: string, index = 0): ColorOption[] => {
    const name = palOf(field, index);
    const now = name === null ? null : getColor(field, index);
    return name === null ? [] : Object.entries(pal(name)).map(([id, hex], i): ColorOption | null => {
      if (!offered(field, id, "color", now)) return null;
      const lock = colorLock(id);
      return { id, hex, label: text(own(kit.colorNames, id) ? kit.colorNames![id] : undefined, `${word("colour", "Colour")} ${i + 1}`), ...(lock ? { locked: true as const, unlock: lock } : {}) };
    }).filter((c): c is ColorOption => c !== null);
  };

  return {
    get doc() { return cur; },
    get lang() { return lang; },
    set lang(v: string) { if (v !== lang) { lang = v; emit(); } },
    sections: () => SECTIONS.map(id => ({ id, label: word(id, id[0].toUpperCase() + id.slice(1)) })),
    fields: section => DEFS.filter(d => d.section === section && visible(d)).map(info),
    field: id => { const d = DEF.get(id); return d ? info(d) : null; },
    options, colorOptions, get, getColor, set, setColor, randomize, patternOptions, getPattern, setPattern, getSide, setSide,
    preview: (field, value) => plan(field, value)?.doc ?? null,
    hasMore(field) {
      if (!o.offer || wide.has(field) || !DEF.has(field)) return false;
      const d = DEF.get(field)!, n = (xs: unknown[], all: unknown[]) => xs.length < all.length;
      if (d.kind !== "number" && d.kind !== "color" && n(options(field), allFor(field, cur.body.build))) return true;
      const f = info(d), pats = patternsOf(partAt(cur, field));
      for (let i = 0; i < Math.max(1, f.colors + (f.inks ?? 0)); i++) { const name = palOf(field, i); if (name && n(colorOptions(field, i), Object.keys(pal(name)))) return true; }
      return pats.length > 0 && patternOptions(field).length < pats.length + 1;
    },
    more(field) { if (o.offer && !wide.has(field)) { wide.add(field); emit(); } },
    undo: () => jump(past, future),
    redo: () => jump(future, past),
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
    reset() { commit(initial, {}); },
    subscribe(fn) { subs.add(fn); return () => { subs.delete(fn); }; },
  };
}
