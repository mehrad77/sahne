// #/kit/people (the catalogue tab): every part of the kit drawn by the still backend, beside every part
// the plan (sahne-kit/catalogue/plan.json, /data/catalogue.json) still has to draw, shown as "coming
// soon". Groups (hair, face, headwear, …) as tabs, sections per slot, filters kept in the route's query
// so a view can be shared:
//   group= q= (id, English or Turkish name) status=drawn|soon avail=open,unlock,cast build=adult,…
//   tags=modest,… view=front|back person=adult|broad|slim|round|elder|child|toddler skin=skin_04
//   d=grid|sheets slot= part=<id> (opens its detail) ids=a,b size= hair=a,b eager=1
// A grid card draws one picture as it scrolls near (the other view on hover); a sheet (the detail
// dialog, or d=sheets) draws every body, colour, side, pattern, face shape and build × shape. Every
// picture is one job of a time-sliced queue, so the page never blocks for long.

import { compose, renderSvg, groupSvg, GARMENT_FIELDS, SVG_BASE, type AvatarDoc, type BodyShape, type Build, type FeatureField, type Framing, type Garment, type PartDef, type ViewName } from "sahne";
import { PART_FILES, PATTERNS, PALETTES } from "sahne-kit/full";
import { patternSwatch } from "../../../../sahne-kit/src/patterns.ts";
import { LENS_ALPHA } from "../../../../sahne-kit/src/palette.ts";
import { PARTS as CURATED_PARTS, COLORS as CURATED_COLORS, PATTERNS as CURATED_PATTERNS, FEATURES as CURATED_FEATURES, type Curated } from "../../../../sahne-kit/src/curation.ts";
import { css } from "../../shell/dom.ts";
import type { Ctx } from "../../shell/ctx.ts";

// ---- the plan's shape ----------------------------------------------------------------------------------------

interface PlanPart { id: string; slot: string; field: string; cat: string; en: string; tr: string; colors: number; patterns: string[]; builds: Build[]; tags: string[]; status: string; cast: string[]; look: string }
interface PlanValue { value: string; en: string; tr: string; status: string; builds: Build[]; tags: string[]; look: string }
interface PlanColor { id: string; hex: string; en: string; tr: string }
interface Plan {
  parts: PlanPart[]; features: { field: string; values: PlanValue[] }[];
  patterns: { id: string; en: string; tr: string; status: string; tags: string[]; look: string }[];
  palettes: Record<string, PlanColor[]>; deferred: { id: string; en: string; tr: string; why: string }[];
}

// ---- small helpers ----------------------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, html?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
const esc = (s: string) => String(s).replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);
/** Lower case the Turkish way, without diacritics: "Şapka", "sapka" and "ŞAPKA" all match. */
const fold = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
const BUILDS: Build[] = ["adult", "elder", "child", "toddler"];
const SHAPES: BodyShape[] = ["slim", "average", "broad", "round"];
const AVAILS = ["open", "unlock", "cast", "hidden"] as const;
type Avail = typeof AVAILS[number];
const FIELD = new Map(GARMENT_FIELDS.map(g => [g.slot, g.field] as const));
const FILE = new Map<string, string>();
for (const [file, parts] of Object.entries(PART_FILES)) for (const id of Object.keys(parts)) FILE.set(id, file);

/** The people a part is shown on in the grid and the face tab. */
const PEOPLE: Record<string, { label: string; build: Build; shape: BodyShape; height: number }> = {
  adult: { label: "Adult · average", build: "adult", shape: "average", height: 0.5 },
  slim: { label: "Adult · slim, tall", build: "adult", shape: "slim", height: 0.8 },
  broad: { label: "Adult · broad", build: "adult", shape: "broad", height: 0.5 },
  round: { label: "Adult · round, short", build: "adult", shape: "round", height: 0.25 },
  elder: { label: "Elder · round", build: "elder", shape: "round", height: 0.4 },
  child: { label: "Child · slim", build: "child", shape: "slim", height: 0.5 },
  toddler: { label: "Toddler · average", build: "toddler", shape: "average", height: 0.5 },
};

interface State {
  group: string; q: string; status: "all" | "drawn" | "soon"; avail: string[]; build: Build[]; tags: string[];
  view: ViewName; person: string; skin: string; d: "grid" | "sheets"; slot: string; part: string; ids: string[];
}
interface Entry {
  kind: "part" | "face" | "color" | "pattern" | "later";
  id: string; key: string; section: string; en: string; tr: string; drawn: boolean; avail: Avail; status: string;
  builds: Build[]; tags: string[]; colors: number; patterns: string[]; look: string; cast: string[];
  part?: PartDef; field?: string; value?: string; hex?: string;
}
interface Group { key: string; label: string; sections: { key: string; label: string; sub: string }[] }

export async function catalogue(host: HTMLElement, ctx: Ctx) {
  const T_START = performance.now();
  css("people-catalogue", STYLE);
  const kit = ctx.kit;
  const PLAN = await ctx.data("catalogue") as unknown as Plan;
  const PLAN_PART = new Map(PLAN.parts.map(p => [p.id, p] as const));
  const labelOf = (key: string, fallback: string) => kit.labels?.[key]?.en ?? fallback;

  // ---- the state, in the query --------------------------------------------------------------------------------

  const q0 = ctx.route.query;
  const list = (k: string) => (q0.get(k) ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const SCALE = Math.min(4, Math.max(0.4, Number(q0.get("size")) || 1));
  /** A few skin tones across the palette's range (its ids are listed light to deep), with the kit's default among them. */
  const SKINS = (() => {
    const ids = Object.keys(kit.palettes.skin ?? {}), pick = [0, 0.2, 0.45, 0.65, 0.85, 1].map(f => ids[Math.round(f * (ids.length - 1))]);
    if (ids.includes("skin_04") && !pick.includes("skin_04")) pick.splice(1, 0, "skin_04");
    return [...new Set(pick.filter(Boolean))];
  })();
  const S: State = {
    group: q0.get("group") ?? "", q: q0.get("q") ?? "", status: (["drawn", "soon"] as const).find(s => s === q0.get("status")) ?? "all",
    avail: list("avail"), build: list("build").filter(b => (BUILDS as string[]).includes(b)) as Build[], tags: list("tags"),
    view: q0.get("view") === "back" ? "back" : "front", person: PEOPLE[q0.get("person") ?? ""] ? q0.get("person")! : "adult",
    skin: kit.palettes.skin?.[q0.get("skin") ?? ""] ? q0.get("skin")! : "skin_04", d: q0.get("d") === "sheets" ? "sheets" : "grid",
    slot: q0.get("slot") ?? "", part: q0.get("part") ?? "", ids: list("ids"),
  };
  /** Writes the state back to the route's query (shareable, survives a reload). */
  const save = () => {
    const v = (x: string, dflt = "") => x && x !== dflt ? x : null;
    ctx.setQuery({ group: v(S.group, "hair"), q: v(S.q), status: v(S.status, "all"), avail: v(S.avail.join(",")), build: v(S.build.join(",")),
      tags: v(S.tags.join(",")), view: v(S.view, "front"), person: v(S.person, "adult"), skin: v(S.skin, "skin_04"), d: v(S.d, "grid"),
      slot: v(S.slot), ids: v(S.ids.join(",")), part: v(S.part) });
  };

  // ---- the entries: drawn parts and planned ones ---------------------------------------------------------------

  /** What a learner may do with it, from the curation file (an id it does not list is open). */
  const availOf = (c: Curated | undefined): Avail => c && (AVAILS as readonly string[]).includes(c.avail) ? c.avail as Avail : "open";
  /** The hair styles' sections: the plan's three categories (a drawn style the plan does not list goes by its file). */
  const HAIR_CATS: Record<string, string> = { hair_short: "Short cuts", hair_long: "Long, tied and updos", hair_textured: "Curly, coily, braids and locs" };
  const sectionOf = (id: string, slot: string): string => {
    if (slot !== "hair") return slot;
    const c = PLAN_PART.get(id)?.cat;
    return c && HAIR_CATS[c] ? c : FILE.get(id) === "hair_textured" ? "hair_textured" : "hair_short";
  };

  const ENTRIES: Entry[] = [];
  // the parts: what the kit draws, then what the plan still has
  for (const [id, p] of Object.entries(kit.parts)) {
    const plan = PLAN_PART.get(id);
    ENTRIES.push({
      kind: "part", id, key: id, section: sectionOf(id, p.slot), en: p.names?.en ?? p.name ?? plan?.en ?? id, tr: p.names?.tr ?? plan?.tr ?? "",
      drawn: true, avail: availOf(CURATED_PARTS[id]), status: "drawn", builds: p.builds ?? BUILDS, tags: p.tags ?? plan?.tags ?? [],
      colors: p.colors ?? 0, patterns: p.patterns ?? [], look: plan?.look ?? "", cast: plan?.cast ?? [], part: p,
    });
  }
  for (const p of PLAN.parts) if (!kit.parts[p.id]) ENTRIES.push({
    kind: "part", id: p.id, key: p.id, section: sectionOf(p.id, p.slot), en: p.en, tr: p.tr, drawn: false, avail: availOf(CURATED_PARTS[p.id]), status: p.status,
    builds: p.builds.length ? p.builds : BUILDS, tags: p.tags, colors: p.colors, patterns: p.patterns, look: p.look, cast: p.cast,
  });
  // the face: every value of every face field the kit has, then the plan's other values and fields
  const FACE_FIELDS = ["face.shape", "face.eyes", "face.eyeColor", "face.brows", "face.nose", "face.mouth", "face.ears", "face.marks", "facialHair"] as const;
  const planField = new Map(PLAN.features.map(f => [f.field, f] as const));
  for (const f of FACE_FIELDS) {
    const ch = kit.features[f as FeatureField], pv = new Map((planField.get(f)?.values ?? []).map(v => [v.value, v] as const));
    for (const v of ch?.values ?? []) {
      const n = ch.names?.[v] ?? kit.colorNames?.[v], plan = pv.get(v);
      ENTRIES.push({ kind: "face", id: v, key: `${f}:${v}`, section: f, field: f, value: v, en: n?.en ?? plan?.en ?? v, tr: n?.tr ?? plan?.tr ?? "", drawn: true,
        avail: availOf(CURATED_FEATURES[`${f}:${v}`]), status: v === ch.default ? "default" : "drawn", builds: plan?.builds?.length ? plan.builds : BUILDS, tags: plan?.tags ?? [],
        colors: 0, patterns: [], look: plan?.look ?? "", cast: [] });
    }
  }
  for (const f of PLAN.features) {
    const have = new Set(kit.features[f.field as FeatureField]?.values ?? []);
    for (const v of f.values) if (!have.has(v.value) && v.status !== "retired") ENTRIES.push({
      kind: "face", id: v.value, key: `${f.field}:${v.value}`, section: f.field, field: f.field, value: v.value, en: v.en, tr: v.tr, drawn: false,
      avail: availOf(CURATED_FEATURES[`${f.field}:${v.value}`]), status: v.status, builds: v.builds.length ? v.builds : BUILDS, tags: v.tags, colors: 0, patterns: [], look: v.look, cast: [],
    });
  }
  // colours and patterns
  const PAL_NAMES = ["skin", "hair", "eyes", "fabric", "metal", "lens"] as const;
  for (const name of PAL_NAMES) {
    const mine = (PALETTES as Record<string, Record<string, string>>)[name] ?? {}, plan = new Map((PLAN.palettes[name] ?? []).map(c => [c.id, c] as const));
    for (const [id, hex] of Object.entries(mine)) {
      const n = kit.colorNames?.[id], pc = plan.get(id);
      ENTRIES.push({ kind: "color", id, key: `${name}:${id}`, section: `pal-${name}`, en: n?.en ?? pc?.en ?? "", tr: n?.tr ?? pc?.tr ?? "", drawn: true, hex,
        avail: availOf(CURATED_COLORS[id]), status: "drawn", builds: BUILDS, tags: [], colors: 0, patterns: [], look: kit.paletteUnlocks?.[id] ?? "", cast: [] });
    }
    for (const c of plan.values()) if (!mine[c.id]) ENTRIES.push({ kind: "color", id: c.id, key: `${name}:${c.id}`, section: `pal-${name}`, en: c.en, tr: c.tr, drawn: false, hex: c.hex,
      avail: availOf(CURATED_COLORS[c.id]), status: "ready", builds: BUILDS, tags: [], colors: 0, patterns: [], look: "", cast: [] });
  }
  for (const [id, p] of Object.entries(PATTERNS)) {
    const plan = PLAN.patterns.find(x => x.id === id);
    ENTRIES.push({ kind: "pattern", id, key: `pattern:${id}`, section: "patterns", en: p.names.en, tr: p.names.tr, drawn: true, avail: availOf(CURATED_PATTERNS[id]),
      status: "drawn", builds: BUILDS, tags: plan?.tags ?? [], colors: p.inks, patterns: [], look: plan?.look ?? "", cast: [] });
  }
  for (const p of PLAN.patterns) if (!PATTERNS[p.id]) ENTRIES.push({ kind: "pattern", id: p.id, key: `pattern:${p.id}`, section: "patterns", en: p.en, tr: p.tr, drawn: false,
    avail: availOf(CURATED_PATTERNS[p.id]), status: p.status, builds: BUILDS, tags: p.tags, colors: 0, patterns: [], look: p.look, cast: [] });
  // what the plan leaves for later (an engine feature or a consultation first)
  for (const x of PLAN.deferred) ENTRIES.push({ kind: "later", id: x.id, key: `later:${x.id}`, section: "deferred", en: x.en, tr: x.tr, drawn: false, avail: "open",
    status: "deferred", builds: BUILDS, tags: [], colors: 0, patterns: [], look: x.why, cast: [] });

  // ---- the groups (tabs) and their sections ---------------------------------------------------------------------

  const slotSection = (slot: string) => ({ key: slot, label: labelOf(FIELD.get(slot) ?? slot, slot), sub: FIELD.get(slot) ?? "custom" });
  const FACE_NEW: Record<string, string> = { "facialHair.grey": "Grey in facial hair", "face.browColor": "Brow colour", "face.teeth": "Teeth", "face.eyePatch": "Eye patch", "face.piercing": "Face piercing", "face.eyeColor2": "Second eye colour" };
  const faceLabel = (f: string) => labelOf(f, FACE_NEW[f] ?? f.replace(/^face\./, ""));
  const PAL_LABEL: Record<string, string> = { skin: "Skin tones", hair: "Hair colours", eyes: "Eye colours", fabric: "Fabric colours", metal: "Metals", lens: "Lens tints" };
  const GROUPS: Group[] = [
    { key: "hair", label: "Hair", sections: Object.entries(HAIR_CATS).map(([key, label]) => ({ key, label, sub: "hair.style" })) },
    { key: "face", label: "Face", sections: [...FACE_FIELDS, ...PLAN.features.map(f => f.field).filter(f => !(FACE_FIELDS as readonly string[]).includes(f))]
      .map(f => ({ key: f, label: faceLabel(f), sub: f })) },
    { key: "headwear", label: "Headwear", sections: ["head", "hat", "hairwear"].map(slotSection) },
    { key: "tops", label: "Tops & outer", sections: ["top", "outer"].map(slotSection) },
    { key: "bottoms", label: "Bottoms & dresses", sections: ["bottom", "dress"].map(slotSection) },
    { key: "shoes", label: "Shoes", sections: ["shoes"].map(slotSection) },
    { key: "accessories", label: "Accessories", sections: ["eyes", "ears", "aid", "neck", "wrist", "hands", "waist"].map(slotSection) },
    { key: "carry", label: "Carry & hold", sections: ["carry", "hold"].map(slotSection) },
    { key: "colours", label: "Colours & patterns", sections: [...PAL_NAMES.map(n => ({ key: `pal-${n}`, label: PAL_LABEL[n], sub: `palette ${n}` })),
      { key: "patterns", label: "Patterns", sub: "garment.pattern" }] },
    { key: "later", label: "Later", sections: [{ key: "deferred", label: "Deferred", sub: "needs an engine feature or a consultation first" }] },
  ];
  // a slot only a cast member's document uses (no field) still gets a home
  const known = new Set(GROUPS.flatMap(g => g.sections.map(s => s.key)));
  const stray = [...new Set(ENTRIES.filter(e => e.kind === "part" && !known.has(e.section)).map(e => e.section))];
  if (stray.length) GROUPS.find(g => g.key === "accessories")!.sections.push(...stray.map(s => ({ key: s, label: s, sub: "custom" })));
  const GROUP_OF = new Map<string, string>();
  for (const g of GROUPS) for (const s of g.sections) GROUP_OF.set(s.key, g.key);
  const groupOfEntry = (e: Entry) => GROUP_OF.get(e.section) ?? "accessories";

  // slot= (a slot or "face") picks its group; ids= shows those parts as sheets
  if (S.slot === "face") { S.group ||= "face"; S.slot = ""; }
  if (S.slot && !S.group) {
    const e = ENTRIES.find(x => x.kind === "part" && (x.part?.slot === S.slot || PLAN_PART.get(x.id)?.slot === S.slot));
    S.group = GROUP_OF.get(S.slot) ?? (e ? groupOfEntry(e) : "");
    if (S.slot === "hair") S.slot = "";
  }
  if (S.ids.length) {
    const e = ENTRIES.find(x => S.ids.includes(x.id));
    if (!S.group && e) S.group = groupOfEntry(e);
    if (!q0.has("d")) S.d = "sheets";
  }
  const GROUP_GIVEN = GROUPS.some(g => g.key === S.group);
  if (!GROUP_GIVEN) S.group = "hair";

  // ---- the filters ----------------------------------------------------------------------------------------------

  const matches = (e: Entry, ignore?: "status"): boolean => {
    if (S.ids.length && !S.ids.includes(e.id)) return false;
    if (ignore !== "status" && S.status !== "all" && (S.status === "drawn") !== e.drawn) return false;
    if (S.avail.length && !S.avail.includes(e.avail)) return false;
    if (S.build.length && !S.build.some(b => e.builds.includes(b))) return false;
    if (S.tags.length && !S.tags.some(t => e.tags.includes(t))) return false;
    if (S.q) { const n = fold(S.q); if (![e.id, e.en, e.tr, e.field ?? ""].some(s => fold(s).includes(n))) return false; }
    return true;
  };
  const filtersOn = () => !!(S.q || S.avail.length || S.build.length || S.tags.length || S.ids.length || S.status !== "all");

  // ---- drawing: a time-sliced job queue ---------------------------------------------------------------------------

  /** Jobs run in slices of about 12 ms, the detail dialog's first; each draws one picture. A job whose element left the page is skipped. */
  const queues: (() => void)[][] = [[], []];
  let pumping = false, longest = 0, pictures = 0, pictureMs = 0, uid = 0, dead = false;
  /** The next slice runs as a posted message: no 4 ms timer clamp, and not throttled in a background tab. */
  const tick = new MessageChannel();
  tick.port1.onmessage = () => pump();
  const later = () => tick.port2.postMessage(0);
  const enqueue = (job: () => void, hi = false) => {
    if (dead) return;
    queues[hi ? 0 : 1].push(job);
    if (!pumping) { pumping = true; later(); }
  };
  function pump() {
    if (dead) return;
    const t = performance.now();
    while (performance.now() - t < 12) {
      const job = queues[0].shift() ?? queues[1].shift();
      if (!job) break;
      const t1 = performance.now();
      job();
      longest = Math.max(longest, performance.now() - t1);
    }
    if (queues[0].length || queues[1].length) later();
    else { pumping = false; idle(); }
  }
  let idleWaiters: (() => void)[] = [];
  const idle = () => { const w = idleWaiters; idleWaiters = []; for (const f of w) f(); stats(); };

  /** Long tasks (over 50 ms) the browser saw while this view is open, for the status line. */
  let longTasks = 0, longTaskMax = 0, po: PerformanceObserver | null = null;
  try {
    po = new PerformanceObserver(l => { for (const e of l.getEntries()) { if (e.startTime < T_START) continue; longTasks++; longTaskMax = Math.max(longTaskMax, e.duration); } if (!pumping) stats(); });
    po.observe({ type: "longtask", buffered: true });
  } catch { /* no long-task timing in this browser */ }

  let errors = 0;
  /** One picture of a document as SVG markup, or a red error box (counted, and in the console). */
  const svgOf = (doc: () => AvatarDoc, framing: Framing, view: ViewName, size?: number, face?: string): string => {
    const t = performance.now();
    try {
      return renderSvg(compose(doc(), kit, { trusted: true }), kit, { framing, view, size, detail: Math.max(size ?? 160, 160), face, idPrefix: `c${uid++}_` });
    } catch (e) {
      errors++; console.error(e);
      return `<span class="cat-fail">${esc(String((e as Error).message ?? e)).slice(0, 120)}</span>`;
    } finally { pictures++; pictureMs += performance.now() - t; }
  };

  // ---- documents --------------------------------------------------------------------------------------------------

  /** A plain, quiet character the part is put on: muted clothes, so the part's own colours stand out. */
  const base = (body: AvatarDoc["body"], skin = S.skin): AvatarDoc => ({
    v: 1, kit: kit.id, body, skin, face: {}, hair: { style: "hair_short", color: "hair_03" },
    outfit: { top: { id: "top_tee", colors: ["fab_18"] }, bottom: { id: "bottom_trousers", colors: ["fab_24"] }, shoes: { id: "shoes_sneakers", colors: ["fab_21", "fab_21"] } },
  });
  const fits = (p: { builds?: Build[] }, b: Build) => !p.builds || p.builds.includes(b);

  /** A part put on a document in its field (a hair style is the document's hair; a slot without a field, a custom part). */
  const put = (d: AvatarDoc, id: string, part: PartDef, g: Partial<Garment> = {}): AvatarDoc => {
    if (part.slot === "hair") { d.hair = { style: id, color: g.colors?.[0] ?? "hair_04" }; return d; }
    const field = FIELD.get(part.slot), garment = { id, ...g };
    if (!field) { d.custom = [garment]; return d; }
    const [a, b] = field.split(".") as [string, string | undefined], r = d as unknown as Record<string, Record<string, unknown>>;
    if (b) r[a] = { ...(r[a] ?? {}), [b]: garment }; else (r as Record<string, unknown>)[a] = garment;
    return d;
  };
  /** The base character wearing a part; `face` and `hair` change the character under it. */
  const wearing = (id: string, part: PartDef, g: Partial<Garment>, body: AvatarDoc["body"], o: { face?: AvatarDoc["face"]; hair?: string; skin?: string } = {}): AvatarDoc => {
    const d = base(body, o.skin);
    // hats, scarves and hairwear on a fuller style, so what they cut or cover shows
    if (["head", "hat", "hairwear"].includes(part.slot)) d.hair = { style: "hair_bob", color: "hair_05" };
    if (o.hair) d.hair = { style: o.hair, color: "hair_05" };
    if (o.face) d.face = { ...o.face };
    return put(d, id, part, g);
  };

  /** How much of the figure a slot needs to be seen. */
  const FRAMING: Record<string, Framing> = { hair: "bust", head: "bust", hat: "bust", hairwear: "head", eyes: "head", ears: "head", aid: "head", neck: "bust" };
  const framingOf = (slot: string): Framing => FRAMING[slot] ?? "full";
  const sizeOf = (f: Framing, small = false) => Math.round((small ? (f === "full" ? 84 : 64) : f === "full" ? 190 : 124) * SCALE);
  /** Slots whose parts sit on the head, and of those the ones a back view shows. */
  const HEAD_SLOTS = ["hair", "head", "hat", "hairwear", "eyes", "ears", "aid"];
  const HEAD_BACK = ["hair", "head", "hat", "hairwear", "aid"];
  const backShows = (slot: string) => !HEAD_SLOTS.includes(slot) || HEAD_BACK.includes(slot);
  /** The person a card is drawn on: the chosen one, or the nearest build the part is made for. */
  const personFor = (p: { builds?: Build[] }): { body: AvatarDoc["body"]; note: string } => {
    const pp = PEOPLE[S.person];
    const build = fits(p, pp.build) ? pp.build : BUILDS.find(b => fits(p, b)) ?? "adult";
    return { body: { build, shape: pp.shape, height: pp.height }, note: build !== pp.build ? `on ${build}` : "" };
  };

  // ---- the view's skeleton --------------------------------------------------------------------------------------------

  const root = el("div", "cat");
  root.innerHTML = `
  <p class="note">Every part, face value, colour and pattern of the kit, drawn by the still backend, beside what the plan (<code>sahne-kit/catalogue/plan.json</code>) still has to draw, dashed as "coming soon". The badge in a card's corner is its availability from <code>sahne-kit/src/curation.ts</code>: open to every learner, earned by an unlock, kept for the cast, or hidden. Hover a card for its back view; open one for its sheet: every body, colour, side, pattern, face shape and build × shape, to catch clipping. Filters and the open part are in the URL.</p>
  <div class="cat-bar">
    <div class="cat-row1">
      <label class="cat-search"><span class="cat-vh">Search parts by id, English or Turkish name</span>
        <input type="search" aria-label="Search parts by id, English or Turkish name" placeholder="Search id, English or Türkçe…" autocomplete="off"></label>
      <div class="cat-seg" data-f="status" role="group" aria-label="Status"></div>
      <div class="cat-seg" data-f="view" role="group" aria-label="View"></div>
      <div class="cat-seg" data-f="density" role="group" aria-label="Density"></div>
      <button class="cat-ftoggle" type="button" aria-expanded="false">Filters</button>
      <button class="cat-freset" type="button" hidden>Reset</button>
    </div>
    <div class="cat-filters">
      <div class="cat-fg"><span class="cat-lbl">Shown on</span>
        <select aria-label="Person the parts are shown on"></select>
        <span data-f="skin" role="group" aria-label="Skin tone" class="cat-fg cat-skin"></span></div>
      <div class="cat-fg cat-avail" data-f="avail" role="group" aria-label="Availability"><span class="cat-lbl">Availability</span></div>
      <div class="cat-fg" data-f="build" role="group" aria-label="Made for build"><span class="cat-lbl">Build</span></div>
      <div class="cat-fg" role="group" aria-label="Tags"><span class="cat-lbl">Tags</span><span data-f="tags" class="cat-fg"></span>
        <details class="cat-more"><summary>more tags (<span data-f="tags-n"></span>)</summary><span data-f="tags-more" class="cat-tagsmore"></span></details></div>
    </div>
  </div>
  <div class="cat-tabs" role="tablist" aria-label="Catalogue groups"></div>
  <div class="cat-panel" role="tabpanel" tabindex="0"></div>
  <p class="cat-status" aria-live="polite"></p>
  <dialog class="cat-detail">
    <div class="cat-dhead"><h2></h2><button class="cat-dclose" type="button">Close</button></div>
    <div class="cat-dbody"></div>
  </dialog>`;
  host.append(root);
  const $ = <T extends HTMLElement = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const f = (name: string) => $(`[data-f="${name}"]`);
  const barEl = $(".cat-bar"), tablist = $(".cat-tabs"), panel = $(".cat-panel"), statusEl = $(".cat-status"), filtersEl = $(".cat-filters");
  // the bar sticks under the gallery's top bar
  barEl.style.top = "var(--topbar-h, 0px)";

  const tabBtns = new Map<string, HTMLButtonElement>();
  for (const g of GROUPS) {
    const b = el("button", "cat-tab");
    b.type = "button"; b.id = `cat-tab-${g.key}`; b.setAttribute("role", "tab");
    b.addEventListener("click", () => { if (S.group !== g.key) { S.group = g.key; S.slot = ""; paint(true); } });
    tabBtns.set(g.key, b); tablist.append(b);
  }
  tablist.addEventListener("keydown", ev => {
    const keys = [...tabBtns.keys()], i = keys.indexOf(S.group);
    const j = ev.key === "ArrowRight" ? i + 1 : ev.key === "ArrowLeft" ? i - 1 : ev.key === "Home" ? 0 : ev.key === "End" ? keys.length - 1 : -1;
    if (j < 0 && ev.key !== "ArrowLeft") return;
    ev.preventDefault();
    const k = keys[(j + keys.length) % keys.length];
    S.group = k; S.slot = ""; paint(true); tabBtns.get(k)!.focus();
  });

  const syncs: (() => void)[] = [];
  /** A row of toggle buttons; `multi` toggles each value in a list, otherwise one value is chosen. */
  const toggles = (box: HTMLElement, values: { v: string; label: string; title?: string; html?: string }[], get: () => string[], setTo: (v: string[]) => void, multi: boolean) => {
    for (const o of values) {
      const b = el("button", "cat-tg", o.html ?? esc(o.label));
      b.type = "button"; b.dataset.v = o.v; if (o.title) b.title = o.title;
      if (o.html) b.setAttribute("aria-label", o.label);
      b.addEventListener("click", () => {
        const cur = get();
        setTo(multi ? (cur.includes(o.v) ? cur.filter(x => x !== o.v) : [...cur, o.v]) : [o.v]);
        paint(false);
      });
      box.append(b);
    }
    syncs.push(() => { for (const b of box.querySelectorAll<HTMLButtonElement>("button.cat-tg")) b.setAttribute("aria-pressed", String(get().includes(b.dataset.v!))); });
  };
  toggles(f("status"), [{ v: "all", label: "All" }, { v: "drawn", label: "Drawn" }, { v: "soon", label: "Coming soon" }], () => [S.status], v => { S.status = v[0] as State["status"]; }, false);
  toggles(f("view"), [{ v: "front", label: "Front" }, { v: "back", label: "Back" }], () => [S.view], v => { S.view = v[0] as ViewName; }, false);
  toggles(f("density"), [{ v: "grid", label: "Grid" }, { v: "sheets", label: "Sheets" }], () => [S.d], v => { S.d = v[0] as State["d"]; }, false);
  toggles(f("avail"), AVAILS.map(a => ({ v: a, label: a })), () => S.avail, v => { S.avail = v; }, true);
  toggles(f("build"), BUILDS.map(b => ({ v: b, label: b })), () => S.build, v => { S.build = v as Build[]; }, true);
  toggles(f("skin"), SKINS.map(s => ({ v: s, label: `skin ${s}${kit.colorNames?.[s] ? ` (${kit.colorNames[s].en})` : ""}`, title: kit.colorNames?.[s]?.en ?? s,
    html: `<span class="cat-dot" style="background:${kit.color(s)}"></span>` })), () => [S.skin], v => { S.skin = v[0]; }, false);
  // tags: the most used ones in sight, the rest behind "more"
  {
    const count = new Map<string, number>();
    for (const e of ENTRIES) if (e.kind === "part") for (const t of e.tags) count.set(t, (count.get(t) ?? 0) + 1);
    const PIN = ["modest", "faith", "religious", "work", "school", "kids", "accessibility", "traditional", "formal", "casual", "sport", "elder", "winter", "summer"];
    const all = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const top = [...PIN.filter(t => count.has(t)), ...all.filter(t => !PIN.includes(t))].slice(0, 14);
    const rest = all.filter(t => !top.includes(t)).sort();
    const mk = (ts: string[], box: HTMLElement) => toggles(box, ts.map(t => ({ v: t, label: t, title: `${count.get(t)} parts` })), () => S.tags, v => { S.tags = v; }, true);
    mk(top, f("tags")); mk(rest, f("tags-more"));
    f("tags-n").textContent = String(rest.length);
  }
  const personSel = $<HTMLSelectElement>(".cat-filters select");
  for (const [k, p] of Object.entries(PEOPLE)) personSel.append(Object.assign(el("option"), { value: k, textContent: p.label }));
  personSel.addEventListener("change", () => { S.person = personSel.value; paint(false); });
  const search = $<HTMLInputElement>(".cat-search input");
  let searchT = 0;
  search.addEventListener("input", () => { clearTimeout(searchT); searchT = window.setTimeout(() => { S.q = search.value.trim(); jumpToMatches(); paint(false); }, 140); });
  /** A search that finds nothing in this tab but something in another moves there (the counts on the tabs say where). */
  function jumpToMatches() {
    const here = GROUPS.find(g => g.key === S.group)!;
    if (!filtersOn() || counts(here).match) return;
    const to = GROUPS.find(g => counts(g).match);
    if (to) { S.group = to.key; S.slot = ""; }
  }
  const resetBtn = $<HTMLButtonElement>(".cat-freset");
  resetBtn.addEventListener("click", () => {
    Object.assign(S, { q: "", status: "all", avail: [], build: [], tags: [], ids: [], slot: "" });
    search.value = ""; paint(false);
  });
  const filtersBtn = $<HTMLButtonElement>(".cat-ftoggle");
  filtersBtn.addEventListener("click", () => {
    const open = filtersBtn.getAttribute("aria-expanded") !== "true";
    filtersBtn.setAttribute("aria-expanded", String(open)); filtersEl.classList.toggle("open", open);
  });

  // ---- cards ------------------------------------------------------------------------------------------------------------

  const AV_TEXT: Record<Avail, string> = { open: "open", unlock: "unlock", cast: "cast only", hidden: "hidden" };
  const badge = (a: Avail) => `<span class="cat-badge av-${a}" title="availability: ${AV_TEXT[a]}">${AV_TEXT[a]}</span>`;
  const buildsHtml = (bs: Build[]) => `<span class="cat-builds" title="builds: ${bs.join(", ")}">${BUILDS.map(b => `<i class="${bs.includes(b) ? "on" : ""}">${b[0].toUpperCase()}</i>`).join("")}</span>`;
  const swatch = (c: string) => `<span class="cat-dot" style="background:${kit.color(c)}" title="${esc(c)}"></span>`;
  const statusChip = (e: Entry) => e.drawn ? "" : e.status === "deferred" ? `<span class="cat-chip later">later</span>`
    : `<span class="cat-chip">coming soon</span>${e.status !== "ready" ? `<span class="cat-chip st">${esc(e.status)}</span>` : ""}`;

  /** The SVG cache of grid pictures: tab switches and filter changes never redraw what was already drawn. */
  const cache = new Map<string, string>();
  /** Cards on screen (or near it) and the drawing each one wants for the current person, skin and view. */
  const near = new Set<Element>();
  const painters = new WeakMap<Element, () => void>();
  const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(es => {
    for (const e of es) {
      if (e.isIntersecting) { near.add(e.target); painters.get(e.target)?.(); }
      else near.delete(e.target);
    }
  }, { rootMargin: "600px 0px" });
  const EAGER = q0.has("eager");
  /** A card's drawing, run when it comes near the screen (paint() observes the card once it is in the page). */
  const watch = (card: HTMLElement, fn: () => void) => {
    painters.set(card, fn);
    if (!io || EAGER) fn();
  };

  /** A grid card's picture key: what it shows, on whom, from which side. */
  const picKey = (e: Entry, view: ViewName, body: AvatarDoc["body"]) => `${e.key}|${body.build}|${body.shape}|${body.height}|${S.skin}|${view}`;

  /** The face document: a neutral head with one value set. */
  const faceDoc = (e: Entry, body: AvatarDoc["body"]): AvatarDoc => {
    const d = base(body);
    d.hair = { style: e.field === "face.shape" ? "hair_short" : "hair_buzz", color: "hair_03" };
    const fl = e.field!, v = e.value!;
    if (fl === "facialHair") d.facialHair = { style: v };
    else if (fl === "face.marks") d.face = { marks: [v] };
    else d.face = { [fl.slice(5)]: v };
    return d;
  };

  function partCard(e: Entry): HTMLElement {
    const card = el("article", `cat-card${e.drawn ? "" : " soon"} k-${e.kind}`);
    card.dataset.id = e.id;
    const art = el(e.kind === "part" ? "button" : "div", "cat-art");
    if (art instanceof HTMLButtonElement) { art.type = "button"; art.setAttribute("aria-label", `Details of ${e.en} (${e.id})`); art.addEventListener("click", () => openDetail(e)); }
    const front = el("span", "cat-pic one"), other = el("span", "cat-pic two"), onb = el("span", "cat-onb");
    art.append(front, other, onb);
    art.insertAdjacentHTML("beforeend", `${e.kind === "later" ? "" : `<span class="cat-corner">${badge(e.avail)}</span>`}${statusChip(e) ? `<span class="cat-foot">${statusChip(e)}</span>` : ""}`);
    card.append(art);

    const cols = e.part?.defaults?.length ? e.part.defaults.map(swatch).join("") : "";
    const facts = [
      e.kind === "part" ? (e.colors ? `<span title="colours">${cols || ""} ${e.colors} col.</span>` : e.part?.slot === "hair" || e.section.startsWith("hair") ? `<span>hair colour</span>` : `<span>no colour</span>`) : "",
      e.patterns.length ? `<span title="${esc(e.patterns.join(" "))}">${e.patterns.length} pattern${e.patterns.length > 1 ? "s" : ""}</span>` : "",
      e.kind === "part" || e.kind === "face" ? buildsHtml(e.builds) : "",
      e.status === "default" ? `<span>default</span>` : "",
      e.cast.length ? `<span title="cast">★ ${esc(e.cast.join(", "))}</span>` : "",
    ].filter(Boolean).join("");
    card.insertAdjacentHTML("beforeend", `<div class="cat-cap"><div class="cat-nm"><b>${esc(e.en)}</b> <span lang="tr">${esc(e.tr)}</span></div><code class="cat-id">${esc(e.id)}</code>` +
      (facts ? `<div class="cat-facts">${facts}</div>` : "") + (e.tags.length ? `<div class="cat-tags">${e.tags.slice(0, 5).map(esc).join(" · ")}${e.tags.length > 5 ? ` +${e.tags.length - 5}` : ""}</div>` : "") + `</div>`);

    if (!e.drawn) {
      front.classList.add("planned");
      front.innerHTML = `<span class="cat-look">${esc(e.look || "planned")}</span>`;
      if (e.kind === "color" && e.hex) { front.classList.remove("planned"); front.innerHTML = `<span class="cat-swatch" style="background:${e.hex}" title="${esc(e.hex)}"></span>`; }
      return card;
    }
    if (e.kind === "color") {
      const a = e.section === "pal-lens" ? LENS_ALPHA[e.id] ?? 1 : 1;
      front.innerHTML = `<span class="cat-swatch" style="background:${e.hex};opacity:${a}"></span>`;
      if (e.look) card.querySelector(".cat-cap")!.insertAdjacentHTML("beforeend", `<div class="cat-tags">🔒 ${esc(e.look)}</div>`);
      return card;
    }
    if (e.kind === "pattern") {
      watch(card, () => {
        if (card.dataset.done) return;
        card.dataset.done = "1";
        enqueue(() => {
          if (!card.isConnected) { delete card.dataset.done; return; }
          const p = PATTERNS[e.id];
          front.innerHTML = `<span class="cat-pats">${[...p.presets, ["fab_01"], ["fab_04"]].slice(0, 4).map(set => {
            const g = patternSwatch(e.id, kit.color(set[0]), set.slice(1).map(c => kit.color(c)), 16, 16);
            return `<svg viewBox="-8 -16 16 16" role="img" aria-label="${esc(set.join(" "))}"><g${SVG_BASE}>${groupSvg(g, { id: `pp${uid++}_`, tiles: new Map(), base: true })}</g></svg>`;
          }).join("")}</span>`;
          card.querySelector(".cat-cap")!.insertAdjacentHTML("beforeend", `<div class="cat-tags">${p.inks} ink${p.inks > 1 ? "s" : ""} · ${p.layout} · ${p.slots.length} slots</div>`);
        });
      });
      return card;
    }

    // a part or a face value: the chosen view now, the other one on hover
    const slot = e.part?.slot ?? "", framing: Framing = e.kind === "face" ? (e.field === "facialHair" ? "bust" : "head") : framingOf(slot);
    const backOk = e.kind === "part" && backShows(slot);
    const docFor = (body: AvatarDoc["body"]) => () => e.kind === "face" ? faceDoc(e, body) : wearing(e.id, e.part!, {}, body);
    const draw = (into: HTMLElement, view: ViewName) => {
      const { body, note } = e.kind === "face" ? { body: { ...PEOPLE[S.person] } as AvatarDoc["body"], note: "" } : personFor(e.part!);
      const k = picKey(e, view, body);
      if (into.dataset.k === k) return;
      const done = (svg: string) => {
        into.innerHTML = svg; into.dataset.k = k; into.title = [view, note].filter(Boolean).join(" · ");
        if (into === front) onb.textContent = note;
      };
      if (cache.has(k)) { done(cache.get(k)!); return; }
      if (into.dataset.want === k) return;
      into.dataset.want = k;
      enqueue(() => {
        if (!into.isConnected || into.dataset.want !== k) return;
        const svg = svgOf(docFor(body), framing, view);
        cache.set(k, svg); done(svg);
      });
    };
    const view = () => (backOk || e.kind !== "part" ? S.view : "front");
    const otherView = (): ViewName => view() === "front" ? "back" : "front";
    watch(card, () => {
      draw(front, e.kind === "face" ? "front" : view());
      // the other view was drawn for another person, skin or side: drop it, hovering draws it again
      if (other.dataset.k && other.dataset.k !== front.dataset.k?.replace(/\|(front|back)$/, `|${otherView()}`)) { other.replaceChildren(); delete other.dataset.k; delete other.dataset.want; }
    });
    if (backOk) {
      card.classList.add("flip");
      art.addEventListener("pointerenter", () => draw(other, otherView()));
      art.addEventListener("focus", () => draw(other, otherView()));
    }
    return card;
  }

  // ---- a part's sheet: every body, colour, side, pattern, face shape and build × shape ------------------------------------------

  /** A figure that is drawn by the queue. */
  const fig = (doc: () => AvatarDoc, framing: Framing, view: ViewName, size: number, caption: string, hi: boolean, face?: string): HTMLElement => {
    const fg = el("figure"), box = el("span", "cat-box");
    box.style.width = box.style.height = `${size}px`;
    fg.append(box);
    if (caption) fg.append(el("figcaption", undefined, caption));
    enqueue(() => {
      if (!fg.isConnected) return;
      const svg = svgOf(doc, framing, view, size, face);
      box.innerHTML = svg; box.style.height = "";
      if (svg.startsWith("<span class=\"cat-fail")) fg.classList.add("bad");
    }, hi);
    return fg;
  };
  const none = (size: number, text: string) => { const fg = el("figure", "none", text); fg.style.width = `${size}px`; fg.style.height = `${size}px`; return fg; };

  /** Another colour for each of a part's colours: half-way round its palette from the default, never a locked one. */
  const otherColors = (p: PartDef): string[] => Array.from({ length: p.colors ?? 0 }, (_, i) => {
    const ids = Object.keys(kit.palettes[p.palettes?.[i] ?? "fabric"] ?? {}).filter(c => !kit.paletteUnlocks?.[c]), d = p.defaults?.[i];
    return ids[((d ? ids.indexOf(d) : 0) + Math.floor(ids.length / 2)) % ids.length];
  });
  /** Hair styles a hat, a covering or hairwear is tried on (`hair=a,b`): the bulkiest, a long one, a bun, the short default. */
  const HAIR_TRY = (list("hair").length ? list("hair") : [
    ...Object.entries(kit.parts).filter(([, p]) => p.slot === "hair" && (p.bulk ?? 0) > 0).sort((a, b) => (b[1].bulk ?? 0) - (a[1].bulk ?? 0)).slice(0, 3).map(([id]) => id),
    "hair_long", "hair_bun", "hair_short",
  ]).filter((id, i, all) => kit.parts[id]?.slot === "hair" && all.indexOf(id) === i).slice(0, 6);
  /** Parts that cut the hair (hats, caps, a kippah): a hair style is tried under each. */
  const CUTTERS = Object.entries(kit.parts).filter(([, p]) => p.clips?.slots.includes("hair")).slice(0, 8);
  /** The bodies a sheet shows first (a part not made for one is shown on the next it fits). */
  const SHEET_BODIES: AvatarDoc["body"][] = [
    { build: "adult", shape: "average", height: 0.5 }, { build: "elder", shape: "round", height: 0.4 }, { build: "child", shape: "slim", height: 0.5 },
  ];

  function sheet(id: string, p: PartDef, into: HTMLElement, hi: boolean) {
    const framing = framingOf(p.slot), size = sizeOf(framing), rows = el("div", "cat-rows"), views: ViewName[] = backShows(p.slot) ? ["front", "back"] : ["front"];
    into.append(rows);
    const row = (label: string) => { const r = el("div", "cat-row"), figs = el("div", "cat-figs"); r.append(el("div", "cat-lab", label), figs); rows.append(r); return figs; };
    const on = (g: Partial<Garment>, body: AvatarDoc["body"], o: Parameters<typeof wearing>[4] = {}) => () => wearing(id, p, g, body, o);

    const bodies = SHEET_BODIES.filter(b => fits(p, b.build));
    if (!bodies.length) { const b = BUILDS.find(x => fits(p, x)); if (b) bodies.push({ build: b, shape: "average", height: 0.5 }); }
    const r1 = row("defaults");
    for (const b of bodies) for (const v of views) r1.append(fig(on({}, b), framing, v, size, `${b.build} ${b.shape} · ${v}`, hi));
    const b0 = bodies[0];
    if (!b0) return;

    const alt = otherColors(p);
    if (alt.length || p.slot === "hair") {
      const r = row("other colour"), g = p.slot === "hair" ? { colors: ["hair_07"] } : { colors: alt };
      for (const v of views) r.append(fig(on(g, b0), framing, v, size, `${(g.colors ?? []).map(c => swatch(c) + " " + c).join(" ")} · ${v}`, hi));
    }
    if (p.sides) {
      const r = row("sides");
      for (const side of p.sides.allowed) for (const v of views) r.append(fig(on({ side }, b0), framing, v, size, `side ${side}${side === p.sides.default ? " (default)" : ""} · ${v}`, hi));
    }
    if (p.patterns?.length) {
      const r = row("patterns");
      for (const pat of p.patterns) {
        const def = PATTERNS[pat], preset = def?.presets[0] ?? ["fab_01"];
        for (const [i, v] of views.entries()) {
          const fg = fig(on({ colors: [preset[0], ...(p.defaults ?? []).slice(1)], pattern: pat, inks: preset.slice(1) }, b0), framing, v, size, `${pat}${def?.unlock ? " 🔒" : ""} · ${v}`, hi);
          if (i === 0 && def) enqueue(() => {
            const sw = patternSwatch(pat, kit.color(preset[0]), preset.slice(1).map(c => kit.color(c)), 14, 8);
            fg.insertAdjacentHTML("beforeend", `<svg class="psw" viewBox="-7 -8 14 8" width="56" height="32"><g${SVG_BASE}>${groupSvg(sw, { id: `sw${uid++}_`, tiles: new Map(), base: true })}</g></svg>`);
          }, hi);
          r.append(fg);
        }
      }
    }
    if (HEAD_SLOTS.includes(p.slot)) {
      const small = Math.round(size * 0.62), r = row("face shapes");
      for (const shape of kit.features["face.shape"].values) for (const v of views) r.append(fig(on({}, b0, { face: { shape } }), framing === "full" ? "bust" : framing, v, small, `${shape} · ${v}`, hi));
      if (["ears", "aid", "eyes", "head", "hat"].includes(p.slot)) {
        const re = row("ears");
        for (const ears of kit.features["face.ears"].values) re.append(fig(on({}, b0, { face: { ears } }), "head", "front", small, ears, hi));
      }
    }
    if (["head", "hat", "hairwear"].includes(p.slot) && HAIR_TRY.length) {
      const r = row("on hair");
      for (const h of HAIR_TRY) for (const v of views) r.append(fig(on({}, b0, { hair: h }), framing, v, Math.round(size * 0.8), `${h} · ${v}`, hi));
    }
    if (p.slot === "hair" && CUTTERS.length) {
      const r = row("under a hat");
      for (const [cid, c] of CUTTERS) for (const v of views) r.append(fig(() => put(wearing(id, p, {}, b0), cid, c), framing, v, Math.round(size * 0.8), `${cid} · ${v}`, hi));
    }
    // every body shape and build, small, both views: does it clip anywhere?
    const wrap = el("div", "cat-shapes-wrap"), grid = el("div", "cat-shapes"), small = sizeOf(framing, true);
    grid.style.gridTemplateColumns = `56px repeat(${SHAPES.length * views.length}, auto)`;
    grid.append(el("div", "cat-lab", "build × shape"), ...SHAPES.flatMap(s => views.map(v => el("div", "cat-lab", `${s} · ${v}`))));
    for (const build of BUILDS) {
      grid.append(el("div", "cat-lab", build));
      for (const shape of SHAPES) for (const v of views) grid.append(fits(p, build) ? fig(on({}, { build, shape, height: 0.5 }), framing, v, small, "", hi) : none(small, "not made for"));
    }
    wrap.append(grid);
    const r = el("div", "cat-row"); r.append(el("div", "cat-lab", "build × shape"), wrap); rows.append(r);
  }

  /** What a part is and does, as a definition list (the plan's look and status for a part not drawn yet). */
  const facts = (e: Entry): string => {
    const p = e.part, plan = PLAN_PART.get(e.id);
    const cur = e.kind === "part" ? CURATED_PARTS[e.id] : e.kind === "face" ? CURATED_FEATURES[e.key] : e.kind === "color" ? CURATED_COLORS[e.id] : e.kind === "pattern" ? CURATED_PATTERNS[e.id] : undefined;
    const items: [string, string][] = [
      ["slot", `${esc(p?.slot ?? plan?.slot ?? e.section)} → <code>${esc(FIELD.get(p?.slot ?? plan?.slot ?? "") ?? "custom")}</code>${p ? ` · <code>${FILE.get(e.id)}.ts</code>` : ""}`],
      ["availability", `${badge(e.avail)}${cur?.unlock ? ` <code>${esc(cur.unlock)}</code>` : ""}${cur?.note ? ` · ${esc(cur.note)}` : ""} <small>(sahne-kit/src/curation.ts)</small>`],
      ["status", e.drawn ? "drawn" : `${statusChip(e)}`],
      ["colours", p ? (p.colors ? Array.from({ length: p.colors }, (_, i) => `${p.palettes?.[i] ?? "fabric"} ${p.defaults?.[i] ? swatch(p.defaults[i]) + " " + p.defaults[i] : "(derived)"}`).join(", ") : p.slot === "hair" ? "hair colour" : "none")
        : String(e.colors)],
      ["patterns", e.patterns.length ? e.patterns.map(x => `<code>${esc(x)}</code>`).join(" ") : "none"],
      ["builds", buildsHtml(e.builds)],
      ["tags", e.tags.map(esc).join(" · ") || "—"],
      ["cast", e.cast.map(esc).join(", ")],
      ["look", esc(e.look)],
    ];
    if (p) items.push(
      ["rules", [p.hides ? `hides ${p.hides.join(" ")}` : "", p.replaces ? `replaces ${p.replaces.join(" ")}` : "", p.clips ? `clips ${p.clips.slots.join(" ")}` : "",
        p.over ? `over ${p.over.join(" ")}` : "", p.avoid?.length ? `avoids ${p.avoid.join(" ")}` : "", p.sides ? `sides ${p.sides.allowed.join("/")} (${p.sides.default})` : "",
        p.bulk !== undefined ? `bulk ${p.bulk} cm` : "", p.odds !== undefined ? `odds ${JSON.stringify(p.odds)}` : ""].filter(Boolean).map(esc).join(" · ")],
    );
    return `<dl class="cat-dl">${items.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
  };

  // sheets in the page (d=sheets): a full sheet per part, drawn as it scrolls near
  function sheetCard(e: Entry): HTMLElement {
    const card = el("article", `cat-sheet${e.drawn ? "" : " soon"}`);
    card.dataset.id = e.id;
    card.insertAdjacentHTML("beforeend", `<header><code class="cat-id">${esc(e.id)}</code> <b>${esc(e.en)}</b> <span lang="tr">${esc(e.tr)}</span> ${badge(e.avail)} ${statusChip(e)}</header>`);
    const open = el("button", "cat-linkish", "open details"); open.type = "button"; open.addEventListener("click", () => openDetail(e));
    card.querySelector("header")!.append(open);
    if (!e.drawn || e.kind !== "part") { card.insertAdjacentHTML("beforeend", facts(e)); return card; }
    const p = e.part!;
    card.insertAdjacentHTML("beforeend", `<div>${facts(e)}</div>`);
    card.style.minHeight = "420px";
    watch(card, () => { if (card.dataset.done) return; card.dataset.done = "1"; card.style.minHeight = ""; sheet(e.id, p, card, false); });
    return card;
  }

  // ---- the detail dialog --------------------------------------------------------------------------------------------------

  const dialog = $<HTMLDialogElement>(".cat-detail"), dbody = $(".cat-dbody"), dtitle = $(".cat-dhead h2");
  function openDetail(e: Entry) {
    S.part = e.id; save();
    dbody.replaceChildren();
    dtitle.innerHTML = `${esc(e.en)} <span lang="tr">${esc(e.tr)}</span> <code>${esc(e.id)}</code>`;
    dbody.insertAdjacentHTML("beforeend", facts(e));
    if (e.drawn && e.part) sheet(e.id, e.part, dbody, true);
    else dbody.insertAdjacentHTML("beforeend", `<div class="cat-planned-big">${statusChip(e)}<p>Not drawn yet: the facts above are the plan's (<code>sahne-kit/catalogue/plan.json</code>). Its pictures on every build, shape, colour and pattern appear here once the kit has the part.</p></div>`);
    if (!dialog.open) dialog.showModal();
    dbody.scrollTop = 0;
  }
  dialog.addEventListener("close", () => { if (dead) return; S.part = ""; save(); dbody.replaceChildren(); });
  $(".cat-dclose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", ev => { if (ev.target === dialog) dialog.close(); });

  // ---- the panel ------------------------------------------------------------------------------------------------------------

  function counts(g: Group) {
    const mine = ENTRIES.filter(e => groupOfEntry(e) === g.key);
    return { drawn: mine.filter(e => e.drawn).length, all: mine.length, match: mine.filter(e => matches(e)).length };
  }

  let firstPaint = 0, buildMs = 0, setupMs = 0;
  function paint(newTab: boolean) {
    const t = performance.now();
    for (const s of syncs) s();
    personSel.value = S.person;
    if (search.value.trim() !== S.q) search.value = S.q;
    const nf = [S.avail.length, S.build.length, S.tags.length, S.status !== "all" ? 1 : 0, S.ids.length ? 1 : 0].reduce((a, b) => a + b, 0);
    filtersBtn.textContent = nf ? `Filters · ${nf}` : "Filters";
    resetBtn.hidden = !filtersOn() && !S.slot;
    if (S.tags.some(tg => f("tags-more").querySelector(`[data-v="${CSS.escape(tg)}"]`))) $<HTMLDetailsElement>(".cat-more").open = true;

    // tabs with their counts
    for (const g of GROUPS) {
      const b = tabBtns.get(g.key)!, c = counts(g), on = g.key === S.group;
      b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1;
      b.innerHTML = `${esc(g.label)} <small>${filtersOn() ? `${c.match} match${c.match === 1 ? "" : "es"}` : g.key === "later" ? c.all : `${c.drawn}/${c.all}`}</small>`;
      b.title = `${c.drawn} drawn of ${c.all} planned`;
      b.classList.toggle("empty", filtersOn() && !c.match);
    }
    panel.setAttribute("aria-labelledby", `cat-tab-${S.group}`);
    if (newTab) tabBtns.get(S.group)!.scrollIntoView({ block: "nearest", inline: "nearest" });

    // the panel: slot chips, then a section per slot with its cards (drawn first, then coming soon)
    io?.disconnect(); near.clear();
    const g = GROUPS.find(x => x.key === S.group)!, frag = document.createDocumentFragment();
    const inTab = ENTRIES.filter(e => groupOfEntry(e) === g.key);
    const chips = el("div", "cat-slots"); chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "Sections");
    const chip = (key: string, label: string, n: string) => {
      const b = el("button", "cat-tg", `${esc(label)} <small>${n}</small>`); b.type = "button";
      b.setAttribute("aria-pressed", String(S.slot === key)); b.addEventListener("click", () => { S.slot = S.slot === key ? "" : key; paint(false); });
      chips.append(b);
    };
    if (g.sections.length > 1) {
      chip("", "All", String(inTab.filter(e => matches(e)).length));
      for (const s of g.sections) {
        const mine = inTab.filter(e => e.section === s.key);
        if (mine.length) chip(s.key, s.label, filtersOn() ? String(mine.filter(e => matches(e)).length) : `${mine.filter(e => e.drawn).length}/${mine.length}`);
      }
      frag.append(chips);
    }
    let shown = 0;
    for (const s of g.sections) {
      if (S.slot && S.slot !== s.key) continue;
      const all = inTab.filter(e => e.section === s.key), mine = all.filter(e => matches(e));
      if (!mine.length) continue;
      shown += mine.length;
      const drawn = mine.filter(e => e.drawn), soon = mine.filter(e => !e.drawn);
      const sec = el("section", "cat-sec");
      sec.insertAdjacentHTML("beforeend", `<h2><b>${esc(s.label)}</b> <code>${esc(s.sub)}</code> <span>${drawn.length} drawn${soon.length ? ` · ${soon.length} ${g.key === "later" ? "deferred" : "coming soon"}` : ""}${mine.length < all.length ? ` · ${all.length - mine.length} filtered out` : ""}</span></h2>`);
      const sheets = S.d === "sheets" && g.key !== "colours";
      const grid = el("div", sheets ? "cat-sheets" : `cat-grid g-${g.key === "colours" ? (s.key === "patterns" ? "pat" : "col") : g.key === "face" ? "face" : "part"}`);
      for (const e of [...drawn, ...soon]) grid.append(sheets && e.kind === "part" ? sheetCard(e) : partCard(e));
      sec.append(grid);
      frag.append(sec);
    }
    if (!shown) {
      const msg = el("div", "cat-nomatch", "Nothing in this tab matches.");
      const elsewhere = GROUPS.filter(x => x.key !== g.key).map(x => [x, counts(x).match] as const).filter(([, n]) => n);
      if (elsewhere.length) {
        msg.append(" Matches in ");
        for (const [x, n] of elsewhere) {
          const b = el("button", "cat-tg", `${esc(x.label)} <small>${n}</small>`); b.type = "button";
          b.addEventListener("click", () => { S.group = x.key; S.slot = ""; paint(true); });
          msg.append(b, " ");
        }
      }
      frag.append(msg);
    }
    // the face tab ends with the emotions on the chosen person
    if (g.key === "face" && !filtersOn() && !S.slot) {
      const sec = el("section", "cat-sec"), grid = el("div", "cat-grid g-face");
      sec.innerHTML = `<h2><b>Emotions</b> <code>kit.face.emotions</code> <span>${Object.keys(kit.face.emotions).length} · each live with the gestures in <a href="#/kit/gestures">Gestures and faces</a></span></h2>`;
      for (const emo of Object.keys(kit.face.emotions)) {
        const c = el("article", "cat-card k-face"), art = el("div", "cat-art"), pic = el("span", "cat-pic one");
        art.append(pic); c.append(art, el("div", "cat-cap", `<div class="cat-nm"><b>${esc(emo)}</b></div>`));
        watch(c, () => { if (c.dataset.done) return; c.dataset.done = "1"; enqueue(() => { if (c.isConnected) pic.innerHTML = svgOf(() => ({ ...base({ ...PEOPLE[S.person] }), hair: { style: "hair_buzz", color: "hair_03" } }), "head", "front", undefined, emo); }); });
        grid.append(c);
      }
      sec.append(grid); frag.append(sec);
    }
    panel.replaceChildren(frag);
    // watch only after the cards are in the page, so the observer sees where they are
    // (and draw what is already near the screen now: the observer's first report waits for a frame, which a background tab never gets)
    if (io && !EAGER) {
      const h = window.innerHeight + 600;
      for (const c of panel.querySelectorAll(".cat-card, .cat-sheet")) {
        if (!painters.has(c)) continue;
        io.observe(c);
        const r = c.getBoundingClientRect();
        if (r.bottom > -600 && r.top < h) { near.add(c); painters.get(c)!(); }
      }
    }
    if (newTab) window.scrollTo({ top: Math.min(window.scrollY, root.offsetTop) });
    save();
    buildMs = performance.now() - t;
    if (!firstPaint) idleWaiters.push(() => { if (!firstPaint) { firstPaint = performance.now() - T_START; stats(); } });
    if (!pumping) idle();
    if (S.part && !dialog.open) { const e = ENTRIES.find(x => x.id === S.part && x.kind === "part"); if (e) openDetail(e); }
  }

  function stats() {
    if (dead) return;
    const parts = ENTRIES.filter(e => e.kind === "part"), drawn = parts.filter(e => e.drawn).length;
    const extra = parts.filter(e => e.drawn && !PLAN_PART.has(e.id)).length;
    statusEl.textContent = `kit ${kit.id} · ${drawn} parts drawn of ${parts.length} planned${extra ? ` (${extra} not in the plan)` : ""} · ` +
      `${Object.keys(PATTERNS).length}/${PLAN.patterns.length || Object.keys(PATTERNS).length} patterns · panel built in ${buildMs.toFixed(0)} ms` +
      ` · set-up ${setupMs.toFixed(0)} ms` + (firstPaint ? ` · first screen drawn ${firstPaint.toFixed(0)} ms after the view opened` : "") + ` · ${pictures} pictures, ${pictures ? (pictureMs / pictures).toFixed(1) : 0} ms each, longest job ${longest.toFixed(0)} ms · ${longTasks} long task${longTasks === 1 ? "" : "s"}${longTasks ? ` (max ${longTaskMax.toFixed(0)} ms)` : ""}` +
      (errors ? ` · ${errors} FAILED (see the console)` : "");
    statusEl.classList.toggle("bad", errors > 0);
  }

  // a person, skin or view change redraws only the cards near the screen; the others when they come near
  syncs.push(() => queueMicrotask(() => { for (const c of near) painters.get(c)?.(); }));

  ctx.cleanup(() => {
    dead = true;
    queues[0].length = queues[1].length = 0;
    tick.port1.close(); tick.port2.close();
    io?.disconnect(); po?.disconnect();
    clearTimeout(searchT);
    if (dialog.open) dialog.close();
  });

  if (!GROUP_GIVEN) jumpToMatches();
  paint(true);
  setupMs = performance.now() - T_START;
  stats();
}

// ---- the catalogue's own CSS (every class starts with cat-, so the shell's .card, .grid and .chip do not reach in) ----

const STYLE = `
.cat { --open: #2F8C88; --unlock: #A8641A; --cast: #7B4FA6; --hidden: #7A6E64; --soon: #9A8E82; --cell: #EFE8DC; --fail: #B3261E; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) .cat { --cell: #24201D; --open: #4FB3AE; --unlock: #E0A050; --cast: #B58BDB; --hidden: #A89C90; --soon: #8A7F75; --fail: #F2827A; } }
:root[data-theme="dark"] .cat { --cell: #24201D; --open: #4FB3AE; --unlock: #E0A050; --cast: #B58BDB; --hidden: #A89C90; --soon: #8A7F75; --fail: #F2827A; }
.cat code { font: 12px ui-monospace, monospace; }
.cat button { line-height: 1.3; }
.cat :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.cat-vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

/* the toolbar: search and the main switches, then the filters (behind a button on a phone) */
.cat-bar { position: sticky; top: 0; z-index: 4; background: var(--bg); padding: 8px 0 6px; border-bottom: 1px solid var(--line); }
.cat-row1 { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cat-search { flex: 1 1 220px; min-width: 0; position: relative; }
.cat-search input { width: 100%; border-radius: 999px; padding: 6px 12px 6px 30px; }
.cat-search::before { content: "⌕"; position: absolute; left: 11px; top: 50%; transform: translateY(-52%); color: var(--mute); font-size: 16px; pointer-events: none; }
.cat-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 999px; overflow: hidden; background: var(--chip); }
.cat-seg .cat-tg { border: 0; border-radius: 0; background: none; padding: 5px 11px; }
.cat-seg .cat-tg + .cat-tg { border-left: 1px solid var(--line); }
.cat-seg .cat-tg[aria-pressed="true"] { background: var(--accent); }
.cat-tg { background: var(--chip); border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; font-size: 13px; }
.cat-tg[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
.cat-tg small { opacity: .75; font-size: 11px; }
.cat-ftoggle { display: none; }
.cat-ftoggle[aria-expanded="true"] { border-color: var(--accent); }
.cat .cat-freset { background: none; border: 0; color: var(--accent); text-decoration: underline; padding: 4px 6px; }
.cat-filters { display: flex; flex-wrap: wrap; gap: 6px 18px; align-items: center; margin-top: 8px; }
.cat-fg { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; min-width: 0; }
.cat-lbl { color: var(--mute); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; margin-right: 2px; }
.cat-fg select { font-size: 13px; border-radius: 999px; padding: 3px 8px; }
.cat-dot { display: inline-block; width: 12px; height: 12px; border-radius: 50%; border: 1px solid color-mix(in srgb, var(--ink) 25%, transparent); vertical-align: -2px; }
.cat-skin .cat-tg { padding: 3px 5px; }
.cat-skin .cat-dot { width: 16px; height: 16px; }
.cat-avail .cat-tg[data-v="open"][aria-pressed="true"] { background: var(--open); border-color: var(--open); }
.cat-avail .cat-tg[data-v="unlock"][aria-pressed="true"] { background: var(--unlock); border-color: var(--unlock); }
.cat-avail .cat-tg[data-v="cast"][aria-pressed="true"] { background: var(--cast); border-color: var(--cast); }
.cat-avail .cat-tg[data-v="hidden"][aria-pressed="true"] { background: var(--hidden); border-color: var(--hidden); }
details.cat-more { display: inline; }
details.cat-more summary { cursor: pointer; color: var(--accent); font-size: 13px; list-style: none; padding: 3px 6px; }
details.cat-more summary::-webkit-details-marker { display: none; }
details.cat-more[open] { display: contents; }
details.cat-more[open] summary { order: 99; }
.cat-tagsmore { display: contents; }

/* the groups */
.cat-tabs { display: flex; gap: 2px; overflow-x: auto; scrollbar-width: none; border-bottom: 1px solid var(--line); margin: 10px 0 0; }
.cat-tabs::-webkit-scrollbar { display: none; }
.cat .cat-tab { flex: none; background: none; border: 0; border-radius: 0; border-bottom: 3px solid transparent; padding: 8px 12px 6px; color: var(--mute); font-weight: 600; white-space: nowrap; }
.cat-tab small { font-weight: 400; font-size: 11px; font-variant-numeric: tabular-nums; }
.cat .cat-tab:hover { color: var(--ink); }
.cat .cat-tab[aria-selected="true"] { color: var(--ink); border-bottom-color: var(--accent); }
.cat-tab.empty { opacity: .45; }

.cat-slots { display: flex; flex-wrap: wrap; gap: 4px; margin: 12px 0 0; }
.cat-sec h2 { font-size: 13px; font-weight: 500; color: var(--mute); margin: 22px 0 10px; display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
.cat-sec h2 b { color: var(--ink); font-size: 15px; font-weight: 650; }
.cat-nomatch { color: var(--mute); margin: 24px 0; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.cat-status { color: var(--mute); font: 12px ui-monospace, monospace; margin: 18px 0 0; overflow-wrap: anywhere; }
.cat-status.bad { color: var(--fail); }

/* cards */
.cat-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(168px, 1fr)); }
.cat-grid.g-face { grid-template-columns: repeat(auto-fill, minmax(136px, 1fr)); }
.cat-grid.g-col { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); }
.cat-card { background: var(--chip); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; min-width: 0; }
.cat .cat-art { position: relative; display: block; width: 100%; height: 210px; padding: 6px; border: 0; border-radius: 0; background: var(--cell); border-bottom: 1px solid var(--line); text-align: left; }
.k-face .cat-art { height: 132px; }
.k-color .cat-art { height: 76px; }
.k-pattern .cat-art { height: 120px; }
.k-later .cat-art { height: 120px; }
.cat button.cat-art:hover { background: color-mix(in srgb, var(--cell) 80%, var(--accent)); }
.cat-pic { position: absolute; inset: 6px; display: flex; align-items: center; justify-content: center; }
.cat-pic svg { width: 100%; height: 100%; display: block; }
.cat-pic.two { display: none; }
.cat-card.flip .cat-art:hover .cat-pic.two:not(:empty), .cat-card.flip .cat-art:focus-visible .cat-pic.two:not(:empty) { display: flex; }
.cat-card.flip .cat-art:hover:has(.two:not(:empty)) .cat-pic.one, .cat-card.flip .cat-art:focus-visible:has(.two:not(:empty)) .cat-pic.one { visibility: hidden; }
.cat-fail { color: var(--fail); font-size: 11px; padding: 6px; }
.cat-onb { position: absolute; left: 6px; bottom: 5px; font-size: 10.5px; color: var(--mute); }
.cat-onb:empty { display: none; }
.cat-corner { position: absolute; top: 6px; right: 6px; }
.cat-foot { position: absolute; left: 6px; bottom: 6px; display: flex; gap: 4px; }
.cat-badge { display: inline-block; font-size: 10.5px; font-weight: 650; letter-spacing: .02em; border-radius: 999px; padding: 1px 7px; color: #fff; background: var(--open); }
.cat-badge.av-unlock { background: var(--unlock); }
.cat-badge.av-cast { background: var(--cast); }
.cat-badge.av-hidden { background: var(--hidden); }
.cat-chip { display: inline-block; font-size: 10.5px; font-weight: 600; border-radius: 999px; padding: 0 7px; border: 1px dashed var(--soon); color: var(--mute); background: var(--chip); }
.cat-chip.st { border-style: solid; }
.cat-chip.later { border-style: dotted; }
.cat-card.soon { border-style: dashed; border-color: var(--soon); background: transparent; }
.cat-card.soon .cat-art { background: repeating-linear-gradient(135deg, transparent 0 8px, color-mix(in srgb, var(--cell) 70%, transparent) 8px 16px); }
.cat-card.soon .cat-badge { opacity: .75; }
.cat-pic.planned { inset: 6px 6px 26px; flex-direction: column; gap: 6px; padding: 18px 4px 0; }
.cat-look { color: var(--mute); font-size: 11.5px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
.cat-swatch { display: block; width: 100%; height: 100%; border-radius: 8px; border: 1px solid var(--line); }
.soon .cat-swatch { opacity: .6; border: 2px dashed var(--soon); }
.cat-pats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; width: 100%; }
.cat-pats svg { width: 100%; height: auto; border-radius: 6px; }
.cat-cap { padding: 7px 9px 9px; display: grid; gap: 2px; min-width: 0; }
.cat-nm { overflow-wrap: anywhere; line-height: 1.25; }
.cat-nm b { font-weight: 650; }
.cat-nm span { color: var(--mute); font-size: 12.5px; }
.cat-id { color: var(--mute); font-size: 11px; overflow-wrap: anywhere; }
.cat-facts { display: flex; flex-wrap: wrap; gap: 2px 8px; color: var(--mute); font-size: 11.5px; align-items: center; }
.cat-facts .cat-dot { width: 10px; height: 10px; margin-right: 1px; }
.cat-builds { display: inline-flex; gap: 1px; }
.cat-builds i { font-style: normal; font: 600 10px ui-monospace, monospace; width: 14px; text-align: center; border-radius: 3px; color: var(--line); }
.cat-builds i.on { color: var(--ink); background: var(--cell); }
.cat-tags { color: var(--mute); font-size: 11px; overflow-wrap: anywhere; }

/* sheets: every body, colour, side, pattern and build × shape of a part */
.cat-sheets { display: grid; gap: 12px; }
.cat-sheet { background: var(--chip); border: 1px solid var(--line); border-radius: 12px; padding: 10px 12px; min-width: 0; }
.cat-sheet.soon { border-style: dashed; border-color: var(--soon); background: transparent; }
.cat-sheet header { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; margin-bottom: 6px; }
.cat-sheet header .cat-id { font: 600 14px ui-monospace, monospace; color: var(--ink); }
.cat-sheet header span[lang] { color: var(--mute); }
.cat .cat-linkish { background: none; border: 0; color: var(--accent); text-decoration: underline; padding: 0; font-size: 12.5px; margin-left: auto; }
.cat-dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 3px 12px; margin: 4px 0 10px; font-size: 12.5px; }
.cat-dl dt { color: var(--mute); }
.cat-dl dd { margin: 0; overflow-wrap: anywhere; }
.cat-rows { display: flex; flex-direction: column; gap: 10px; }
.cat-row { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 8px; align-items: start; }
.cat-row > .cat-lab { color: var(--mute); font-size: 11px; line-height: 1.2; padding-top: 6px; }
.cat-figs { display: flex; flex-wrap: wrap; gap: 6px; align-items: flex-end; min-width: 0; }
.cat figure { margin: 0; display: flex; flex-direction: column; align-items: center; gap: 2px; background: var(--cell); border-radius: 8px; padding: 4px; }
.cat-box { display: block; }
.cat-box svg { display: block; }
.cat figcaption { color: var(--mute); font-size: 10px; line-height: 1.2; text-align: center; max-width: 150px; }
.cat figure.none { justify-content: center; color: var(--mute); font-size: 10px; text-align: center; }
.cat figure.bad { outline: 2px solid var(--fail); }
.cat-shapes-wrap { overflow-x: auto; min-width: 0; }
.cat-shapes { display: grid; gap: 2px 4px; align-items: end; justify-content: start; }
.cat-shapes .cat-lab { color: var(--mute); font-size: 10px; align-self: center; }
.cat-shapes figure { padding: 2px; }
.cat-planned-big { border: 1px dashed var(--soon); border-radius: 12px; padding: 16px; color: var(--mute); }

/* the detail dialog */
dialog.cat-detail { width: min(1200px, calc(100vw - 32px)); max-height: calc(100vh - 32px); padding: 0; border: 1px solid var(--line); border-radius: 14px; background: var(--bg); color: var(--ink); }
dialog.cat-detail::backdrop { background: rgba(20, 16, 12, .5); }
.cat-dhead { position: sticky; top: 0; z-index: 1; display: flex; gap: 10px; align-items: center; padding: 10px 14px; background: var(--chip); border-bottom: 1px solid var(--line); }
.cat-dhead h2 { margin: 0; font-size: 16px; flex: 1; min-width: 0; overflow-wrap: anywhere; }
.cat-dhead h2 span, .cat-dhead h2 code { color: var(--mute); font-weight: 400; }
.cat-dbody { padding: 12px 14px 18px; }

@media (max-width: 720px) {
  .cat-bar { position: static; }
  .cat-ftoggle { display: inline-block; }
  .cat-filters { display: none; }
  .cat-filters.open { display: flex; }
  .cat-seg .cat-tg { padding: 5px 9px; }
  .cat-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; }
  .cat .cat-art { height: 168px; }
  .cat-grid.g-face { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
  .k-face .cat-art { height: 110px; }
  .cat-row { grid-template-columns: 1fr; gap: 2px; }
  .cat-row > .cat-lab { padding-top: 0; }
  dialog.cat-detail { width: 100vw; max-width: 100vw; height: 100dvh; max-height: 100dvh; margin: 0; border-radius: 0; border: 0; }
  .cat-dl { grid-template-columns: 1fr; gap: 0; }
  .cat-dl dd { margin-bottom: 4px; }
}
`;
