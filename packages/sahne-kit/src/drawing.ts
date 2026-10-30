// Pieces drawn as data (`sahne-kit/drawing`, DRAWING.md): a JSON document of SVG path data, colours and words becomes a set
// piece or a prop. Browser-safe, no Node. `fromDrawing(doc)` is one piece; `withDrawings(kit, docs)` adds a content root's
// pieces to a kit, and its variants (named param sets) to generators the kit already has.
//
//   const kit = withDrawings(withSet(base, loaded), docs);        // docs from the content root's kit/ folder

import { Path, tone, translate, type EmitSpec, type FlatMotion, type FlatSpec, type Kit, type LightSpec, type ParamSpec, type PieceDef, type Shape, type SolidLine, type TextSpec, type Tone } from "sahne";

/** A colour: a `#hex` or palette id, a `$param` (a colour param), or a tone of either. */
export type DrawingFill = string | { tone: string; step: Tone };
export interface DrawingShape {
  d: string; fill?: DrawingFill; stroke?: { color: DrawingFill; width: number; cap?: "butt" | "round" | "square" };
  opacity?: number; flat?: boolean; evenodd?: boolean;
}
export interface DrawingText { text: string; x: number; y: number; w: number; h: number; lang: string; font?: "hand" | "print" | "screen"; size?: number; color?: DrawingFill; align?: "left" | "center" | "right"; weight?: number; lit?: number }
export interface DrawingFlat {
  shapes: DrawingShape[]; text?: DrawingText[]; glow?: DrawingShape[];
  sway?: { rot?: number; dy?: number; ms: number } | null; blink?: { ms: number; on: number; at?: number } | null;
  shadow?: "drop" | "none"; x?: number; y?: number; z?: number; lit?: number; front?: boolean;
}
export interface DrawingKind { size: [number, number]; ppcm?: number; grip?: [number, number]; flats: DrawingFlat[]; lights?: LightSpec[]; emitters?: EmitSpec[] }
export interface DrawingParam { type: "enum" | "int" | "num" | "bool" | "text" | "color"; default?: unknown; values?: string[]; min?: number; max?: number; about?: string }
/** A piece drawn as data. Units are cm from the bottom centre, y up negative, as in the kit. */
export interface DrawingDoc {
  id: string; as: "prop" | "set" | "both"; about: string; tags?: string[]; terms?: string[];
  params?: Record<string, DrawingParam>; kinds: Record<string, DrawingKind>;
  repeat?: { gap?: number }; variants?: Record<string, Record<string, unknown>>; solid?: SolidLine[] | null;
}
/** A named param set added to a generator the kit already has. */
export interface VariantDoc { of: string; name: string; params: Record<string, unknown> }

/** What a document may hold (the schema says the same; these are the numbers). */
export const DRAWING_LIMITS = { bytes: 64 * 1024, shapes: 400, commands: 20000, copies: 12, flats: 12, reach: 1000 };

/** A content id starts with `x_`: no id of the kit ever does, so the kit can never break a story that uses one. */
export const CONTENT_ID = /^x_[a-z0-9_]+$/;

const PARAM_TYPES = ["enum", "int", "num", "bool", "text", "color"];
const TONES = ["base", "shade", "deep", "light", "edge"];
const ref = (s: unknown): string | null => typeof s === "string" && /^\$[A-Za-z_]\w*$/.test(s) ? s.slice(1) : null;

interface CShape { path: Path; src: DrawingShape }
interface CFlat { src: DrawingFlat; shapes: CShape[]; glow: CShape[] }
interface CKind { src: DrawingKind; flats: CFlat[] }

/** A document compiled: its generator, and what is wrong with it (the generator is only to be used when nothing is). */
export function compileDrawing(doc: DrawingDoc): { def: PieceDef; problems: string[] } {
  const problems: string[] = [], bad = (m: string) => { if (problems.length < 20) problems.push(m); };
  const params = doc && typeof doc.params === "object" && doc.params ? doc.params : {}, kinds: Record<string, CKind> = {};
  let shapes = 0, commands = 0;
  try {
    if (!doc || typeof doc !== "object") throw new Error("a drawing is an object");
    if (!CONTENT_ID.test(doc.id ?? "")) bad(`id ${JSON.stringify(doc.id)}: a content id is x_ then lowercase letters, digits and _`);
    if (!["prop", "set", "both"].includes(doc.as)) bad(`as ${JSON.stringify(doc.as)}: prop, set or both`);
    if (typeof doc.about !== "string" || doc.about.trim().length <= 8) bad("about: a line on what it draws");
    if (JSON.stringify(doc).length > DRAWING_LIMITS.bytes) bad(`over ${DRAWING_LIMITS.bytes / 1024} KB`);
    for (const [k, s] of Object.entries(params)) {
      if (!PARAM_TYPES.includes(s?.type)) bad(`param ${k}: type ${JSON.stringify(s?.type)} is not one of ${PARAM_TYPES.join(", ")}`);
      if (k === "n" || k === "held" || k === "variant") bad(`param ${k}: the engine gives it`);
      if (s?.type === "enum" && !s.values?.length) bad(`param ${k}: an enum with no values`);
    }
    const colour = (f: unknown, where: string) => {
      const r = ref(typeof f === "object" && f ? (f as { tone?: string }).tone : f);
      if (r !== null && params[r]?.type !== "color") bad(`${where}: $${r} is not a colour param`);
      if (typeof f === "object" && f && !TONES.includes((f as { step: string }).step)) bad(`${where}: tone step ${JSON.stringify((f as { step: string }).step)}`);
    };
    const words = (t: string, where: string) => { for (const m of t.matchAll(/\$([A-Za-z_]\w*)/g)) if (!Object.hasOwn(params, m[1])) bad(`${where}: $${m[1]} is not a declared param`); };
    const shape = (s: DrawingShape, where: string): CShape => {
      shapes++;
      let path: Path;
      try { path = Path.fromSvg(s.d); } catch (e) { bad(`${where}: ${(e as Error).message}`); path = new Path().moveTo(0, 0); }
      commands += path.cmds.length;
      if (!path.finite()) bad(`${where}: a coordinate is not finite`);
      else if (path.cmds.some(c => c.some((v, i) => i > 0 && Math.abs(v) > DRAWING_LIMITS.reach))) bad(`${where}: a coordinate is beyond ${DRAWING_LIMITS.reach} cm from the origin`);
      colour(s.fill, `${where} fill`); if (s.stroke) colour(s.stroke.color, `${where} stroke`);
      return { path, src: s };
    };
    if (!doc.kinds || !Object.keys(doc.kinds).length) bad("kinds: at least one");
    for (const [kn, k] of Object.entries(doc.kinds ?? {})) {
      const at = `kind ${kn}`;
      if (!(k.size?.length === 2 && k.size.every(v => v > 0 && v <= DRAWING_LIMITS.reach))) bad(`${at}: size is [width, height] in cm, each over 0 and at most ${DRAWING_LIMITS.reach}`);
      if (k.ppcm !== undefined && !(k.ppcm > 0 && k.ppcm <= 16)) bad(`${at}: ppcm over 0 and at most 16`);
      if (!k.flats?.length) bad(`${at}: no flats`);
      else if (k.flats.length > DRAWING_LIMITS.flats) bad(`${at}: ${k.flats.length} flats: at most ${DRAWING_LIMITS.flats}`);
      kinds[kn] = { src: k, flats: (k.flats ?? []).map((f, i) => {
        for (const t of f.text ?? []) { words(t.text, `${at} flat ${i} text`); colour(t.color, `${at} flat ${i} text color`); if (!t.lang) bad(`${at} flat ${i}: text "${t.text}" has no lang`); }
        return { src: f, shapes: (f.shapes ?? []).map((s, j) => shape(s, `${at} flat ${i} shape ${j}`)), glow: (f.glow ?? []).map((s, j) => shape(s, `${at} flat ${i} glow ${j}`)) };
      }) };
    }
    const kp = params.kind;
    if (kp) { if (kp.type !== "enum" || [...(kp.values ?? [])].sort().join() !== Object.keys(kinds).sort().join()) bad("param kind: an enum whose values are the kinds"); }
    else if (Object.keys(kinds).length > 1) bad("several kinds need an enum param kind that picks one");
    for (const [v, ps] of Object.entries(doc.variants ?? {})) for (const k of Object.keys(ps)) if (!Object.hasOwn(params, k)) bad(`variant ${v}: ${k} is not a declared param`);
    if (shapes > DRAWING_LIMITS.shapes) bad(`${shapes} shapes: at most ${DRAWING_LIMITS.shapes}`);
    if (commands > DRAWING_LIMITS.commands) bad(`${commands} path commands: at most ${DRAWING_LIMITS.commands}`);
  } catch (e) { bad((e as Error).message); }

  const prop = doc?.as !== "set", pnames = Object.keys(params);
  const meta: PieceDef["meta"] = {
    about: String(doc?.about ?? ""),
    params: {
      ...Object.fromEntries(pnames.map(k => [k, { ...params[k], type: params[k].type } as ParamSpec])),
      ...(prop ? { n: { type: "int", min: 1, max: DRAWING_LIMITS.copies, default: 1, about: "how many, side by side" } as ParamSpec } : {}),
    },
    ...(doc?.tags ? { tags: doc.tags } : {}), ...(doc?.terms ? { terms: doc.terms } : {}),
  };
  const def: PieceDef = {
    meta, ...(doc?.variants ? { variants: doc.variants } : {}),
    ...(doc?.solid?.length ? { solid: () => doc.solid as SolidLine[] } : {}),
    draw(given, _rng, kit) {
      const p: Record<string, unknown> = {};
      for (const k of pnames) p[k] = given[k] ?? params[k].default ?? (params[k].type === "enum" ? params[k].values?.[0] : undefined);
      const held = given.held === true, n = prop ? Math.max(1, Math.min(DRAWING_LIMITS.copies, Math.floor(Number(given.n) || 1))) : 1;
      const k = kinds[typeof p.kind === "string" && Object.hasOwn(kinds, p.kind) ? p.kind : Object.keys(kinds)[0]], kind = k.src;
      const colour = (f: DrawingFill | undefined, d: string): string => {
        const r = ref(typeof f === "object" ? f?.tone : f);
        const base = r !== null ? kit.color(String(p[r] ?? ""), d) : typeof f === "object" ? kit.color(f.tone, d) : kit.color(f, d);
        return typeof f === "object" ? tone(base, f.step) : base;
      };
      const [w] = kind.size, gap = doc.repeat?.gap ?? 4, gx = held ? -(kind.grip?.[0] ?? 0) : 0, gy = held ? -(kind.grip?.[1] ?? 0) : 0;
      const at = (i: number) => (i - (n - 1) / 2) * (w + gap) + gx;
      const cut = (list: CShape[]): Shape[] => {
        const out: Shape[] = [];
        for (let i = 0; i < n; i++) for (const { path, src: s } of list) {
          const sh: Shape = { path: at(i) || gy ? path.transform(translate(at(i), gy)) : path };
          if (s.fill !== undefined) sh.fill = colour(s.fill, "#888888");
          if (s.stroke) sh.stroke = { color: colour(s.stroke.color, "#444444"), width: s.stroke.width, ...(s.stroke.cap ? { cap: s.stroke.cap } : {}) };
          if (s.opacity !== undefined) sh.opacity = s.opacity;
          if (s.flat) sh.flat = true;
          if (s.evenodd) sh.evenodd = true;
          out.push(sh);
        }
        return out;
      };
      const flats: FlatSpec[] = (held ? k.flats.slice(0, 1) : k.flats).map(({ src: f, shapes, glow }) => {
        const text: TextSpec[] = [];
        for (let i = 0; i < n; i++) for (const t of f.text ?? []) {
          const o: TextSpec = { ...t, text: t.text.replace(/\$([A-Za-z_]\w*)/g, (m, name) => Object.hasOwn(p, name) ? String(p[name] ?? "") : m), x: t.x + at(i), y: t.y + gy, color: undefined };
          if (t.color) o.color = colour(t.color, "#2B2420"); else delete o.color;
          text.push(o);
        }
        const move: FlatMotion = { ...(f.sway ? { sway: f.sway } : {}), ...(f.blink ? { blink: f.blink } : {}) };
        const out: FlatSpec = { group: { shapes: cut(shapes) }, ppcm: kind.ppcm ?? (doc.as === "set" ? 1.6 : 5), id: doc.id };
        if (!held) out.shadow = f.shadow ?? "drop";
        for (const key of ["x", "y", "z", "lit"] as const) if (f[key] !== undefined) out[key] = f[key];
        if (f.front) out.front = true;
        if (glow.length) out.emissive = { shapes: cut(glow), edge: 0 };
        if (text.length) out.text = text;
        if (Object.keys(move).length) out.move = move;
        return out;
      });
      return { flats, ...(!held && kind.lights?.length ? { lights: kind.lights } : {}), ...(!held && kind.emitters?.length ? { emitters: kind.emitters } : {}) };
    },
  };
  return { def, problems };
}

/** What is wrong with a document: its schema is `kit-piece.json`; this holds what a schema cannot (the caps, the colour and text references, the parsed path data). [] when it is good. */
export const checkDrawing = (doc: DrawingDoc): string[] => compileDrawing(doc).problems;

/** One piece from its document. Throws, saying what is wrong, when the document is not good. */
export function fromDrawing(doc: DrawingDoc): PieceDef {
  const { def, problems } = compileDrawing(doc);
  if (problems.length) throw new Error(`drawing ${doc?.id}: ${problems.join("; ")}`);
  return def;
}

/**
 * The kit with these documents added: each drawing as a set piece, a prop or both (`as`), then each variant doc as a named
 * param set on the generator it names (in the set, the props, or both). Throws, listing everything wrong, when a document is
 * not good, takes a kit id, or names a generator or a param the kit does not have.
 */
export function withDrawings(kit: Kit, docs: readonly (DrawingDoc | VariantDoc)[]): Kit {
  const set = { ...kit.set }, props = { ...kit.props }, errors: string[] = [];
  const drawn = docs.filter((d): d is DrawingDoc => !("of" in d)), variants = docs.filter((d): d is VariantDoc => "of" in d);
  for (const doc of drawn) {
    const { def, problems } = compileDrawing(doc);
    if (problems.length) { errors.push(`drawing ${doc.id}: ${problems.join("; ")}`); continue; }
    if (Object.hasOwn(set, doc.id) || Object.hasOwn(props, doc.id)) { errors.push(`drawing ${doc.id}: the id is taken`); continue; }
    if (doc.as !== "prop") set[doc.id] = def;
    if (doc.as !== "set") props[doc.id] = def;
  }
  for (const v of variants) {
    const where = `variant ${v.of}.${v.name}`, homes = [set, props].filter(m => Object.hasOwn(m, v.of));
    if (!CONTENT_ID.test(v.name ?? "")) errors.push(`${where}: a content variant's name is x_ then lowercase letters, digits and _`);
    else if (!homes.length) errors.push(`${where}: the kit has no set piece or prop ${v.of}`);
    else for (const m of homes) {
      const def = m[v.of], declared = def.meta?.params ?? {};
      if (def.variants && Object.hasOwn(def.variants, v.name)) { errors.push(`${where}: the name is taken`); continue; }
      const stray = Object.keys(v.params ?? {}).filter(k => !Object.hasOwn(declared, k));
      if (stray.length) { errors.push(`${where}: ${stray.join(", ")} not declared by ${v.of}`); continue; }
      m[v.of] = { ...def, variants: { ...def.variants, [v.name]: v.params } };
    }
  }
  if (errors.length) throw new Error([...new Set(errors)].join("\n"));
  return { ...kit, set, props };
}
