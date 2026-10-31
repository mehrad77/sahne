// normalize(): the security boundary of avatar documents (DESIGN.md §5.2, §10). A learner's
// `char` is data from other people that every viewer draws, so nothing reaches the drawing code
// without passing here. Anything that is not a v:1 document is null; anything else comes out as a
// fresh, canonical document that holds only ids the kit has, palette colours, known feature
// values and numbers — never a string from the input that was not looked up in a table first.
// It never throws.

import type { Kit, KitManifest, PartMeta, FeatureField } from "../core/kit.ts";
import type { AvatarDoc, AvatarNote, Garment, WearSide } from "../core/types.ts";
import { GARMENT_FIELDS, isObj, own, at, unalias, partOf, applyReplaces, fitsBuild } from "./rules.ts";

/** The most bytes of JSON a document may take: it is stored as the learner's `char` and sent to their friends. */
export const AVATAR_MAX_BYTES = 2048;

export interface NormalizeOptions {
  /** Cast documents, written by the authors: `#RRGGBB` colours and `custom` parts are kept, cast-only parts allowed. Default false. */
  trusted?: boolean;
  /** Filled with what was dropped, defaulted or replaced. */
  notes?: AvatarNote[];
  /** A stricter size limit than AVATAR_MAX_BYTES, for a host with less room (it is never raised above it). */
  maxBytes?: number;
}

const HEX = /^#[0-9A-Fa-f]{6}$/;
const FACE_KEYS = ["shape", "eyes", "eyeColor", "brows", "nose", "mouth", "ears"] as const;
/**
 * What goes first when a document is over the limit, least missed first. A head covering, a held
 * cane and a hearing aid say who someone is, and a cast member's custom parts are who they are, so
 * they go last.
 */
const DROP = ["carry", "wear.hands", "wear.wrist", "wear.neck", "wear.ears", "wear.hair", "wear.waist", "outfit.outer", "wear.hat", "face.marks", "wear.eyes", "facialHair", "wear.head", "hold", "wear.aid", "custom"];
const LEGACY = ["skin", "hair", "hairC", "beard", "top", "wear", "acc", "shirt"];
const family = (id: string) => id.split("@")[0];

/** Whether `x` has the shape of a v:1 document (not that its contents are good: `normalize` checks those). */
export function isAvatarDoc(x: unknown): x is AvatarDoc {
  const k = own(x, "kit");
  return own(x, "v") === 1 && typeof k === "string" && k.length <= 40 && isObj(own(x, "body"));
}

/** Kumru's old `char`: up to eight small integers (`skin`, `hair`, `hairC`, `beard`, `top`, `wear`, `acc`, `shirt`) and no `v`. */
export function isLegacyChar(x: unknown): boolean {
  try {
    if (!isObj(x) || Object.hasOwn(x, "v")) return false;
    const ks = Object.keys(x);
    return ks.length > 0 && ks.every(k => LEGACY.includes(k) && Number.isInteger(x[k]));
  } catch { return false; }
}

/** The document as JSON, in the canonical key order `normalize` writes. Pass a normalized document. */
export const serialize = (doc: AvatarDoc): string => JSON.stringify(doc);

const bytes = (s: string) => new TextEncoder().encode(s).length;

/** A short stable string for a document (53 bits, base 36), to key caches. Pass a normalized document. */
export function docHash(doc: AvatarDoc): string {
  const s = serialize(doc);
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * A document from outside, made safe and canonical for `kit`, or null when it is not a v:1 document
 * for this kit family (Kumru's old `char`, `{}`, a string). Rules:
 * - Every id is looked up as an own property of the kit's tables, after `kit.aliases`; a part must
 *   exist, belong to the field's slot and (unless trusted) not be reserved for the cast. A required
 *   slot (hair, top, bottom, shoes) with a missing or unusable part gets the kit default's; an
 *   optional one is dropped. A part that another replaces (a dress replaces top and bottom) is dropped.
 * - Colours are ids of the palette the field uses; `#RRGGBB` only when trusted; else the default.
 *   A garment's colours are cut to the part's colour count and a trailing default is left out.
 * - A part the kit makes only for other builds is dropped (a `build` note); a required slot then
 *   gets the default's part. A one-sided part keeps a `side` it allows (not its default), a part
 *   with a pattern keeps the pattern when the part lists it, and up to the pattern's number of inks
 *   (fabric ids). Locked colours, patterns and parts are kept: unlocks are the builder's business.
 * - Unknown feature values become the default; marks are unique, in the kit's order, and capped
 *   (marks the kit calls `free`, identity marks, do not count towards the cap).
 * - Output is a new object in canonical key order without defaults or empty fields, at most 2 KB of
 *   JSON. If it would be more, optional parts are left out, least missed first: the worn bag, the
 *   hands, wrist, neck, ears, hairwear, waist, the outer layer, the hat, marks, glasses, facial
 *   hair, the head covering, the held thing (a cane), the hearing aid and, last, a cast member's custom parts
 *   (a note says `size` for each). Cast-only fields (`motion`, `voice`)
 *   are not part of the avatar and are not kept. Running it on its own output changes nothing.
 * - Notes (`o.notes`) name the parts that were refused, replaced or left out for size; their `id`
 *   is made safe to show (see `AvatarNote`).
 */
export function normalize(input: unknown, kit: KitManifest, o: NormalizeOptions = {}): AvatarDoc | null {
  try { return run(input, kit, !!o.trusted, o.notes ?? [], Math.min(o.maxBytes ?? AVATAR_MAX_BYTES, AVATAR_MAX_BYTES)); } catch { return null; }
}

interface Pk { field: string; id: string; part: PartMeta; garment: Garment }

function run(input: unknown, kit: KitManifest, trusted: boolean, notes: AvatarNote[], max: number): AvatarDoc | null {
  if (!isAvatarDoc(input) || family(own(input, "kit") as string) !== family(kit.id)) return null;
  const F = kit.features, D = kit.defaultDoc;
  // the id of an `unknown` note is the document's own text: cut, and safe to show
  const note = (field: string, id: unknown, why: AvatarNote["why"], by?: string) => { notes.push({ field, id: typeof id === "string" ? id.slice(0, 48).replace(/[^\w.@-]/g, "_") : "", why, ...(by ? { by } : {}) }); };
  const colorOf = (v: unknown, palette: string, def: string | undefined, tr = trusted): string | undefined => {
    const id = unalias(kit, v);
    if (id === null) return def;
    if (own(own(kit.palettes, palette), id) !== undefined) return id;
    return tr && HEX.test(id) ? id.toUpperCase() : def;
  };
  const pick = (v: unknown, key: FeatureField): string => { const c = F[key]; return typeof v === "string" && c.values.includes(v) ? v : (c.default ?? c.values[0]); };

  const bodyIn = own(input, "body"), h = own(bodyIn, "height");
  const body: AvatarDoc["body"] = {
    build: pick(own(bodyIn, "build"), "body.build") as AvatarDoc["body"]["build"],
    height: typeof h === "number" && Number.isFinite(h) ? Math.round(Math.min(1, Math.max(0, h)) * 100) / 100 : D.body.height,
    shape: pick(own(bodyIn, "shape"), "body.shape") as AvatarDoc["body"]["shape"],
  };
  const skin = colorOf(own(input, "skin"), "skin", D.skin) ?? D.skin;

  const faceIn = own(input, "face"), face: AvatarDoc["face"] = {};
  for (const key of FACE_KEYS) {
    const f: FeatureField = `face.${key}`, def = F[f].default ?? undefined;
    const v = key === "eyeColor" ? colorOf(own(faceIn, key), "eyes", def) : pick(own(faceIn, key), f);
    if (v !== undefined && v !== def) face[key] = v;
  }
  const mk = F["face.marks"], rawMarks = own(faceIn, "marks"), seen = new Set<unknown>();
  if (Array.isArray(rawMarks)) for (let i = 0; i < Math.min(rawMarks.length, 12); i++) seen.add(rawMarks[i]);
  const marks = capMarks(mk.values.filter(v => seen.has(v)), mk.max ?? 3, mk.free);
  if (marks.length) face.marks = marks;

  const hairIn = own(input, "hair"), fhIn = own(input, "facialHair"), fhStyle = own(fhIn, "style");
  const hairColor = colorOf(own(hairIn, "color"), "hair", D.hair.color) ?? D.hair.color;
  const fhColor = colorOf(own(fhIn, "color"), "hair", undefined);
  const facialHair = typeof fhStyle === "string" && F.facialHair.values.includes(fhStyle) ? { style: fhStyle, ...(fhColor ? { color: fhColor } : {}) } : null;

  // a part for a field: found, in its slot, made for the build, with colours the part has and palettes allow
  const take = (field: string, raw: unknown, slot: string | null, tr = trusted, anyBuild = false): Pk | null => {
    const id = typeof raw === "string" ? raw : own(raw, "id"), hit = partOf(kit, id);
    if (!hit) { if (id !== undefined && id !== null) note(field, id, "unknown"); return null; }
    const [pid, part] = hit;
    if (!tr && part.tags?.includes("cast")) { note(field, pid, "unknown"); return null; }
    if (slot !== null && part.slot !== slot) { note(field, pid, "slot"); return null; }
    if (!anyBuild && !fitsBuild(part, body.build)) { note(field, pid, "build"); return null; }
    const garment: Garment = { id: pid }, rawC = own(raw, "colors"), cols: string[] = [];
    if (Array.isArray(rawC)) for (let i = 0; i < (part.colors ?? 0); i++) {
      const c = colorOf(rawC[i], part.palettes?.[i] ?? "fabric", part.defaults?.[i], tr);
      if (c === undefined) break;
      cols.push(c);
    }
    while (cols.length && cols[cols.length - 1] === part.defaults?.[cols.length - 1]) cols.pop();
    if (cols.length) garment.colors = cols;
    const pat = own(raw, "pattern");
    if (typeof pat === "string" && part.patterns?.includes(pat) && (!kit.patterns || Object.hasOwn(kit.patterns, pat))) {
      garment.pattern = pat;
      const n = Math.min(2, Number(own(own(kit.patterns, pat), "inks") ?? 2) || 0), rawI = own(raw, "inks"), inks: string[] = [];
      if (Array.isArray(rawI)) for (let i = 0; i < n; i++) { const c = colorOf(rawI[i], "fabric", undefined, tr); if (c === undefined) break; inks.push(c); }
      if (inks.length) garment.inks = inks;
    }
    const side = own(raw, "side"), sides = part.sides;
    if (sides && typeof side === "string" && side !== sides.default && (sides.allowed as string[]).includes(side)) garment.side = side as WearSide;
    return { field, id: pid, part, garment };
  };

  const found: Pk[] = [], custom = own(input, "custom");
  if (trusted && Array.isArray(custom)) for (let i = 0; i < Math.min(custom.length, 2); i++) { const u = take(`custom.${i}`, custom[i], null); if (u) found.push(u); }
  for (const g of GARMENT_FIELDS) { const u = take(g.field, g.field === "hair.style" ? own(hairIn, "style") : at(input, g.field), g.slot); if (u) found.push(u); }

  const { gone, slots } = applyReplaces(found);
  for (const { use, by } of gone) note(use.field, use.id, "replaced", by.id);
  const kept = found.filter(u => !gone.some(x => x.use === u)), have = new Set(kept.map(u => u.field));
  // the default's part fills a required slot even where it is not made for the build: a slot is never empty
  for (const g of GARMENT_FIELDS) if (g.req && !have.has(g.field) && !slots.has(g.slot)) { const u = take(g.field, at(D, g.field), g.slot, true, true); if (u) kept.push(u); }

  const by = new Map(kept.map(u => [u.field, u] as const));
  const group = (name: string) => {
    const r: Record<string, Garment> = {};
    for (const g of GARMENT_FIELDS) { const u = by.get(g.field); if (u && g.field.startsWith(name + ".")) r[g.field.slice(name.length + 1)] = u.garment; }
    return r;
  };
  const wear = group("wear"), carry = by.get("carry"), hold = by.get("hold"), cast = kept.filter(u => u.field.startsWith("custom."));
  const doc: AvatarDoc = {
    v: 1, kit: kit.id, body, skin, face,
    hair: { style: by.get("hair.style")?.id ?? D.hair.style, color: hairColor },
    ...(facialHair ? { facialHair } : {}),
    outfit: group("outfit"),
    ...(Object.keys(wear).length ? { wear } : {}),
    ...(carry ? { carry: carry.garment } : {}),
    ...(hold ? { hold: hold.garment } : {}),
    ...(cast.length ? { custom: cast.map(u => u.garment) } : {}),
  };
  for (const p of DROP) { if (bytes(serialize(doc)) <= max) break; if (drop(doc, p)) note(p, "", "size"); }
  return bytes(serialize(doc)) <= max ? doc : null;
}

/** The marks a document keeps: at most `max` that count, and every free one (identity marks), in the kit's order. */
function capMarks(marks: string[], max: number, free: string[] = []): string[] {
  let n = 0;
  return marks.filter(m => free.includes(m) || n++ < max);
}

/** A kit as plain JSON for `normalize`: ids, palettes, aliases, the vocabularies' values, the default character, each part's metadata and the patterns' ink counts (no drawing, names, weights or clips). */
export function manifestOf(kit: Kit): KitManifest {
  const parts: KitManifest["parts"] = {};
  // of the tags, normalize reads only `cast`: the style tags stay in the kit, out of the Worker's copy
  for (const [id, p] of Object.entries(kit.parts)) parts[id] = { slot: p.slot, colors: p.colors, palettes: p.palettes, defaults: p.defaults, patterns: p.patterns, tags: p.tags?.includes("cast") ? ["cast"] : undefined, hides: p.hides, replaces: p.replaces, builds: p.builds, sides: p.sides };
  const patterns = kit.patterns && Object.fromEntries(Object.entries(kit.patterns).map(([id, p]) => [id, { inks: p.inks }]));
  const features = Object.fromEntries(Object.entries(kit.features).map(([f, c]) => [f, { values: c.values, default: c.default, max: c.max, free: c.free }]));
  return JSON.parse(JSON.stringify({ id: kit.id, palettes: kit.palettes, aliases: kit.aliases, features, defaultDoc: kit.defaultDoc, parts, patterns }));
}

/** Removes the field at `path` from a document; reports whether it was there. */
function drop(doc: AvatarDoc, path: string): boolean {
  const r = doc as unknown as Record<string, Record<string, unknown> | undefined>, [a, b] = path.split(".");
  if (b === undefined) { const had = a in r; delete r[a]; return had; }
  const o = r[a], had = !!o && b in o;
  if (o) { delete o[b]; if (a === "wear" && !Object.keys(o).length) delete r.wear; }
  return had;
}
