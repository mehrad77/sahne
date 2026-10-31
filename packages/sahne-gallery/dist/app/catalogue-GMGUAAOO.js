import {
  COLORS,
  FEATURES,
  LENS_ALPHA,
  PALETTES,
  PARTS,
  PART_FILES,
  PATTERNS,
  PATTERNS2,
  patternSwatch
} from "./chunk-MK75BOA5.js";
import "./chunk-6IX3XYSS.js";
import {
  css
} from "./chunk-4TGKXDN4.js";
import {
  GARMENT_FIELDS,
  SVG_BASE,
  compose,
  groupSvg,
  renderSvg
} from "./chunk-BLASJ6YA.js";
import "./chunk-PZ5AY32C.js";

// src/kit/people/catalogue.ts
function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}
var esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
var fold = (s) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");
var BUILDS = ["adult", "elder", "child", "toddler"];
var SHAPES = ["slim", "average", "broad", "round"];
var AVAILS = ["open", "unlock", "cast", "hidden"];
var FIELD = new Map(GARMENT_FIELDS.map((g) => [g.slot, g.field]));
var FILE = /* @__PURE__ */ new Map();
for (const [file, parts] of Object.entries(PART_FILES)) for (const id of Object.keys(parts)) FILE.set(id, file);
var PEOPLE = {
  adult: { label: "Adult \xB7 average", build: "adult", shape: "average", height: 0.5 },
  slim: { label: "Adult \xB7 slim, tall", build: "adult", shape: "slim", height: 0.8 },
  broad: { label: "Adult \xB7 broad", build: "adult", shape: "broad", height: 0.5 },
  round: { label: "Adult \xB7 round, short", build: "adult", shape: "round", height: 0.25 },
  elder: { label: "Elder \xB7 round", build: "elder", shape: "round", height: 0.4 },
  child: { label: "Child \xB7 slim", build: "child", shape: "slim", height: 0.5 },
  toddler: { label: "Toddler \xB7 average", build: "toddler", shape: "average", height: 0.5 }
};
async function catalogue(host, ctx) {
  const T_START = performance.now();
  css("people-catalogue", STYLE);
  const kit = ctx.kit;
  const PLAN = await ctx.data("catalogue");
  const PLAN_PART = new Map(PLAN.parts.map((p) => [p.id, p]));
  const labelOf = (key, fallback) => kit.labels?.[key]?.en ?? fallback;
  const q0 = ctx.route.query;
  const list = (k) => (q0.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const SCALE = Math.min(4, Math.max(0.4, Number(q0.get("size")) || 1));
  const SKINS = (() => {
    const ids = Object.keys(kit.palettes.skin ?? {}), pick = [0, 0.2, 0.45, 0.65, 0.85, 1].map((f2) => ids[Math.round(f2 * (ids.length - 1))]);
    if (ids.includes("skin_04") && !pick.includes("skin_04")) pick.splice(1, 0, "skin_04");
    return [...new Set(pick.filter(Boolean))];
  })();
  const S = {
    group: q0.get("group") ?? "",
    q: q0.get("q") ?? "",
    status: ["drawn", "soon"].find((s) => s === q0.get("status")) ?? "all",
    avail: list("avail"),
    build: list("build").filter((b) => BUILDS.includes(b)),
    tags: list("tags"),
    view: q0.get("view") === "back" ? "back" : "front",
    person: PEOPLE[q0.get("person") ?? ""] ? q0.get("person") : "adult",
    skin: kit.palettes.skin?.[q0.get("skin") ?? ""] ? q0.get("skin") : "skin_04",
    d: q0.get("d") === "sheets" ? "sheets" : "grid",
    slot: q0.get("slot") ?? "",
    part: q0.get("part") ?? "",
    ids: list("ids")
  };
  const save = () => {
    const v = (x, dflt = "") => x && x !== dflt ? x : null;
    ctx.setQuery({
      group: v(S.group, "hair"),
      q: v(S.q),
      status: v(S.status, "all"),
      avail: v(S.avail.join(",")),
      build: v(S.build.join(",")),
      tags: v(S.tags.join(",")),
      view: v(S.view, "front"),
      person: v(S.person, "adult"),
      skin: v(S.skin, "skin_04"),
      d: v(S.d, "grid"),
      slot: v(S.slot),
      ids: v(S.ids.join(",")),
      part: v(S.part)
    });
  };
  const availOf = (c) => c && AVAILS.includes(c.avail) ? c.avail : "open";
  const HAIR_CATS = { hair_short: "Short cuts", hair_long: "Long, tied and updos", hair_textured: "Curly, coily, braids and locs" };
  const sectionOf = (id, slot) => {
    if (slot !== "hair") return slot;
    const c = PLAN_PART.get(id)?.cat;
    return c && HAIR_CATS[c] ? c : FILE.get(id) === "hair_textured" ? "hair_textured" : "hair_short";
  };
  const ENTRIES = [];
  for (const [id, p] of Object.entries(kit.parts)) {
    const plan = PLAN_PART.get(id);
    ENTRIES.push({
      kind: "part",
      id,
      key: id,
      section: sectionOf(id, p.slot),
      en: p.names?.en ?? p.name ?? plan?.en ?? id,
      tr: p.names?.tr ?? plan?.tr ?? "",
      drawn: true,
      avail: availOf(PARTS[id]),
      status: "drawn",
      builds: p.builds ?? BUILDS,
      tags: p.tags ?? plan?.tags ?? [],
      colors: p.colors ?? 0,
      patterns: p.patterns ?? [],
      look: plan?.look ?? "",
      cast: plan?.cast ?? [],
      part: p
    });
  }
  for (const p of PLAN.parts) if (!kit.parts[p.id]) ENTRIES.push({
    kind: "part",
    id: p.id,
    key: p.id,
    section: sectionOf(p.id, p.slot),
    en: p.en,
    tr: p.tr,
    drawn: false,
    avail: availOf(PARTS[p.id]),
    status: p.status,
    builds: p.builds.length ? p.builds : BUILDS,
    tags: p.tags,
    colors: p.colors,
    patterns: p.patterns,
    look: p.look,
    cast: p.cast
  });
  const FACE_FIELDS = ["face.shape", "face.eyes", "face.eyeColor", "face.brows", "face.nose", "face.mouth", "face.ears", "face.marks", "facialHair"];
  const planField = new Map(PLAN.features.map((f2) => [f2.field, f2]));
  for (const f2 of FACE_FIELDS) {
    const ch = kit.features[f2], pv = new Map((planField.get(f2)?.values ?? []).map((v) => [v.value, v]));
    for (const v of ch?.values ?? []) {
      const n = ch.names?.[v] ?? kit.colorNames?.[v], plan = pv.get(v);
      ENTRIES.push({
        kind: "face",
        id: v,
        key: `${f2}:${v}`,
        section: f2,
        field: f2,
        value: v,
        en: n?.en ?? plan?.en ?? v,
        tr: n?.tr ?? plan?.tr ?? "",
        drawn: true,
        avail: availOf(FEATURES[`${f2}:${v}`]),
        status: v === ch.default ? "default" : "drawn",
        builds: plan?.builds?.length ? plan.builds : BUILDS,
        tags: plan?.tags ?? [],
        colors: 0,
        patterns: [],
        look: plan?.look ?? "",
        cast: []
      });
    }
  }
  for (const f2 of PLAN.features) {
    const have = new Set(kit.features[f2.field]?.values ?? []);
    for (const v of f2.values) if (!have.has(v.value) && v.status !== "retired") ENTRIES.push({
      kind: "face",
      id: v.value,
      key: `${f2.field}:${v.value}`,
      section: f2.field,
      field: f2.field,
      value: v.value,
      en: v.en,
      tr: v.tr,
      drawn: false,
      avail: availOf(FEATURES[`${f2.field}:${v.value}`]),
      status: v.status,
      builds: v.builds.length ? v.builds : BUILDS,
      tags: v.tags,
      colors: 0,
      patterns: [],
      look: v.look,
      cast: []
    });
  }
  const PAL_NAMES = ["skin", "hair", "eyes", "fabric", "metal", "lens"];
  for (const name of PAL_NAMES) {
    const mine = PALETTES[name] ?? {}, plan = new Map((PLAN.palettes[name] ?? []).map((c) => [c.id, c]));
    for (const [id, hex] of Object.entries(mine)) {
      const n = kit.colorNames?.[id], pc = plan.get(id);
      ENTRIES.push({
        kind: "color",
        id,
        key: `${name}:${id}`,
        section: `pal-${name}`,
        en: n?.en ?? pc?.en ?? "",
        tr: n?.tr ?? pc?.tr ?? "",
        drawn: true,
        hex,
        avail: availOf(COLORS[id]),
        status: "drawn",
        builds: BUILDS,
        tags: [],
        colors: 0,
        patterns: [],
        look: kit.paletteUnlocks?.[id] ?? "",
        cast: []
      });
    }
    for (const c of plan.values()) if (!mine[c.id]) ENTRIES.push({
      kind: "color",
      id: c.id,
      key: `${name}:${c.id}`,
      section: `pal-${name}`,
      en: c.en,
      tr: c.tr,
      drawn: false,
      hex: c.hex,
      avail: availOf(COLORS[c.id]),
      status: "ready",
      builds: BUILDS,
      tags: [],
      colors: 0,
      patterns: [],
      look: "",
      cast: []
    });
  }
  for (const [id, p] of Object.entries(PATTERNS2)) {
    const plan = PLAN.patterns.find((x) => x.id === id);
    ENTRIES.push({
      kind: "pattern",
      id,
      key: `pattern:${id}`,
      section: "patterns",
      en: p.names.en,
      tr: p.names.tr,
      drawn: true,
      avail: availOf(PATTERNS[id]),
      status: "drawn",
      builds: BUILDS,
      tags: plan?.tags ?? [],
      colors: p.inks,
      patterns: [],
      look: plan?.look ?? "",
      cast: []
    });
  }
  for (const p of PLAN.patterns) if (!PATTERNS2[p.id]) ENTRIES.push({
    kind: "pattern",
    id: p.id,
    key: `pattern:${p.id}`,
    section: "patterns",
    en: p.en,
    tr: p.tr,
    drawn: false,
    avail: availOf(PATTERNS[p.id]),
    status: p.status,
    builds: BUILDS,
    tags: p.tags,
    colors: 0,
    patterns: [],
    look: p.look,
    cast: []
  });
  for (const x of PLAN.deferred) ENTRIES.push({
    kind: "later",
    id: x.id,
    key: `later:${x.id}`,
    section: "deferred",
    en: x.en,
    tr: x.tr,
    drawn: false,
    avail: "open",
    status: "deferred",
    builds: BUILDS,
    tags: [],
    colors: 0,
    patterns: [],
    look: x.why,
    cast: []
  });
  const slotSection = (slot) => ({ key: slot, label: labelOf(FIELD.get(slot) ?? slot, slot), sub: FIELD.get(slot) ?? "custom" });
  const FACE_NEW = { "facialHair.grey": "Grey in facial hair", "face.browColor": "Brow colour", "face.teeth": "Teeth", "face.eyePatch": "Eye patch", "face.piercing": "Face piercing", "face.eyeColor2": "Second eye colour" };
  const faceLabel = (f2) => labelOf(f2, FACE_NEW[f2] ?? f2.replace(/^face\./, ""));
  const PAL_LABEL = { skin: "Skin tones", hair: "Hair colours", eyes: "Eye colours", fabric: "Fabric colours", metal: "Metals", lens: "Lens tints" };
  const GROUPS = [
    { key: "hair", label: "Hair", sections: Object.entries(HAIR_CATS).map(([key, label]) => ({ key, label, sub: "hair.style" })) },
    { key: "face", label: "Face", sections: [...FACE_FIELDS, ...PLAN.features.map((f2) => f2.field).filter((f2) => !FACE_FIELDS.includes(f2))].map((f2) => ({ key: f2, label: faceLabel(f2), sub: f2 })) },
    { key: "headwear", label: "Headwear", sections: ["head", "hat", "hairwear"].map(slotSection) },
    { key: "tops", label: "Tops & outer", sections: ["top", "outer"].map(slotSection) },
    { key: "bottoms", label: "Bottoms & dresses", sections: ["bottom", "dress"].map(slotSection) },
    { key: "shoes", label: "Shoes", sections: ["shoes"].map(slotSection) },
    { key: "accessories", label: "Accessories", sections: ["eyes", "ears", "aid", "neck", "wrist", "hands", "waist"].map(slotSection) },
    { key: "carry", label: "Carry & hold", sections: ["carry", "hold"].map(slotSection) },
    { key: "colours", label: "Colours & patterns", sections: [
      ...PAL_NAMES.map((n) => ({ key: `pal-${n}`, label: PAL_LABEL[n], sub: `palette ${n}` })),
      { key: "patterns", label: "Patterns", sub: "garment.pattern" }
    ] },
    { key: "later", label: "Later", sections: [{ key: "deferred", label: "Deferred", sub: "needs an engine feature or a consultation first" }] }
  ];
  const known = new Set(GROUPS.flatMap((g) => g.sections.map((s) => s.key)));
  const stray = [...new Set(ENTRIES.filter((e) => e.kind === "part" && !known.has(e.section)).map((e) => e.section))];
  if (stray.length) GROUPS.find((g) => g.key === "accessories").sections.push(...stray.map((s) => ({ key: s, label: s, sub: "custom" })));
  const GROUP_OF = /* @__PURE__ */ new Map();
  for (const g of GROUPS) for (const s of g.sections) GROUP_OF.set(s.key, g.key);
  const groupOfEntry = (e) => GROUP_OF.get(e.section) ?? "accessories";
  if (S.slot === "face") {
    S.group ||= "face";
    S.slot = "";
  }
  if (S.slot && !S.group) {
    const e = ENTRIES.find((x) => x.kind === "part" && (x.part?.slot === S.slot || PLAN_PART.get(x.id)?.slot === S.slot));
    S.group = GROUP_OF.get(S.slot) ?? (e ? groupOfEntry(e) : "");
    if (S.slot === "hair") S.slot = "";
  }
  if (S.ids.length) {
    const e = ENTRIES.find((x) => S.ids.includes(x.id));
    if (!S.group && e) S.group = groupOfEntry(e);
    if (!q0.has("d")) S.d = "sheets";
  }
  const GROUP_GIVEN = GROUPS.some((g) => g.key === S.group);
  if (!GROUP_GIVEN) S.group = "hair";
  const matches = (e, ignore) => {
    if (S.ids.length && !S.ids.includes(e.id)) return false;
    if (ignore !== "status" && S.status !== "all" && S.status === "drawn" !== e.drawn) return false;
    if (S.avail.length && !S.avail.includes(e.avail)) return false;
    if (S.build.length && !S.build.some((b) => e.builds.includes(b))) return false;
    if (S.tags.length && !S.tags.some((t) => e.tags.includes(t))) return false;
    if (S.q) {
      const n = fold(S.q);
      if (![e.id, e.en, e.tr, e.field ?? ""].some((s) => fold(s).includes(n))) return false;
    }
    return true;
  };
  const filtersOn = () => !!(S.q || S.avail.length || S.build.length || S.tags.length || S.ids.length || S.status !== "all");
  const queues = [[], []];
  let pumping = false, longest = 0, pictures = 0, pictureMs = 0, uid = 0, dead = false;
  const tick = new MessageChannel();
  tick.port1.onmessage = () => pump();
  const later = () => tick.port2.postMessage(0);
  const enqueue = (job, hi = false) => {
    if (dead) return;
    queues[hi ? 0 : 1].push(job);
    if (!pumping) {
      pumping = true;
      later();
    }
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
    else {
      pumping = false;
      idle();
    }
  }
  let idleWaiters = [];
  const idle = () => {
    const w = idleWaiters;
    idleWaiters = [];
    for (const f2 of w) f2();
    stats();
  };
  let longTasks = 0, longTaskMax = 0, po = null;
  try {
    po = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        if (e.startTime < T_START) continue;
        longTasks++;
        longTaskMax = Math.max(longTaskMax, e.duration);
      }
      if (!pumping) stats();
    });
    po.observe({ type: "longtask", buffered: true });
  } catch {
  }
  let errors = 0;
  const svgOf = (doc, framing, view, size, face) => {
    const t = performance.now();
    try {
      return renderSvg(compose(doc(), kit, { trusted: true }), kit, { framing, view, size, detail: Math.max(size ?? 160, 160), face, idPrefix: `c${uid++}_` });
    } catch (e) {
      errors++;
      console.error(e);
      return `<span class="cat-fail">${esc(String(e.message ?? e)).slice(0, 120)}</span>`;
    } finally {
      pictures++;
      pictureMs += performance.now() - t;
    }
  };
  const base = (body, skin = S.skin) => ({
    v: 1,
    kit: kit.id,
    body,
    skin,
    face: {},
    hair: { style: "hair_short", color: "hair_03" },
    outfit: { top: { id: "top_tee", colors: ["fab_18"] }, bottom: { id: "bottom_trousers", colors: ["fab_24"] }, shoes: { id: "shoes_sneakers", colors: ["fab_21", "fab_21"] } }
  });
  const fits = (p, b) => !p.builds || p.builds.includes(b);
  const put = (d, id, part, g = {}) => {
    if (part.slot === "hair") {
      d.hair = { style: id, color: g.colors?.[0] ?? "hair_04" };
      return d;
    }
    const field = FIELD.get(part.slot), garment = { id, ...g };
    if (!field) {
      d.custom = [garment];
      return d;
    }
    const [a, b] = field.split("."), r = d;
    if (b) r[a] = { ...r[a] ?? {}, [b]: garment };
    else r[a] = garment;
    return d;
  };
  const wearing = (id, part, g, body, o = {}) => {
    const d = base(body, o.skin);
    if (["head", "hat", "hairwear"].includes(part.slot)) d.hair = { style: "hair_bob", color: "hair_05" };
    if (o.hair) d.hair = { style: o.hair, color: "hair_05" };
    if (o.face) d.face = { ...o.face };
    return put(d, id, part, g);
  };
  const FRAMING = { hair: "bust", head: "bust", hat: "bust", hairwear: "head", eyes: "head", ears: "head", aid: "head", neck: "bust" };
  const framingOf = (slot) => FRAMING[slot] ?? "full";
  const sizeOf = (f2, small = false) => Math.round((small ? f2 === "full" ? 84 : 64 : f2 === "full" ? 190 : 124) * SCALE);
  const HEAD_SLOTS = ["hair", "head", "hat", "hairwear", "eyes", "ears", "aid"];
  const HEAD_BACK = ["hair", "head", "hat", "hairwear", "aid"];
  const backShows = (slot) => !HEAD_SLOTS.includes(slot) || HEAD_BACK.includes(slot);
  const personFor = (p) => {
    const pp = PEOPLE[S.person];
    const build = fits(p, pp.build) ? pp.build : BUILDS.find((b) => fits(p, b)) ?? "adult";
    return { body: { build, shape: pp.shape, height: pp.height }, note: build !== pp.build ? `on ${build}` : "" };
  };
  const root = el("div", "cat");
  root.innerHTML = `
  <p class="note">Every part, face value, colour and pattern of the kit, drawn by the still backend, beside what the plan (<code>sahne-kit/catalogue/plan.json</code>) still has to draw, dashed as "coming soon". The badge in a card's corner is its availability from <code>sahne-kit/src/curation.ts</code>: open to every learner, earned by an unlock, kept for the cast, or hidden. Hover a card for its back view; open one for its sheet: every body, colour, side, pattern, face shape and build \xD7 shape, to catch clipping. Filters and the open part are in the URL.</p>
  <div class="cat-bar">
    <div class="cat-row1">
      <label class="cat-search"><span class="cat-vh">Search parts by id, English or Turkish name</span>
        <input type="search" aria-label="Search parts by id, English or Turkish name" placeholder="Search id, English or T\xFCrk\xE7e\u2026" autocomplete="off"></label>
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
  const $ = (sel) => root.querySelector(sel);
  const f = (name) => $(`[data-f="${name}"]`);
  const barEl = $(".cat-bar"), tablist = $(".cat-tabs"), panel = $(".cat-panel"), statusEl = $(".cat-status"), filtersEl = $(".cat-filters");
  barEl.style.top = "var(--topbar-h, 0px)";
  const tabBtns = /* @__PURE__ */ new Map();
  for (const g of GROUPS) {
    const b = el("button", "cat-tab");
    b.type = "button";
    b.id = `cat-tab-${g.key}`;
    b.setAttribute("role", "tab");
    b.addEventListener("click", () => {
      if (S.group !== g.key) {
        S.group = g.key;
        S.slot = "";
        paint(true);
      }
    });
    tabBtns.set(g.key, b);
    tablist.append(b);
  }
  tablist.addEventListener("keydown", (ev) => {
    const keys = [...tabBtns.keys()], i = keys.indexOf(S.group);
    const j = ev.key === "ArrowRight" ? i + 1 : ev.key === "ArrowLeft" ? i - 1 : ev.key === "Home" ? 0 : ev.key === "End" ? keys.length - 1 : -1;
    if (j < 0 && ev.key !== "ArrowLeft") return;
    ev.preventDefault();
    const k = keys[(j + keys.length) % keys.length];
    S.group = k;
    S.slot = "";
    paint(true);
    tabBtns.get(k).focus();
  });
  const syncs = [];
  const toggles = (box, values, get, setTo, multi) => {
    for (const o of values) {
      const b = el("button", "cat-tg", o.html ?? esc(o.label));
      b.type = "button";
      b.dataset.v = o.v;
      if (o.title) b.title = o.title;
      if (o.html) b.setAttribute("aria-label", o.label);
      b.addEventListener("click", () => {
        const cur = get();
        setTo(multi ? cur.includes(o.v) ? cur.filter((x) => x !== o.v) : [...cur, o.v] : [o.v]);
        paint(false);
      });
      box.append(b);
    }
    syncs.push(() => {
      for (const b of box.querySelectorAll("button.cat-tg")) b.setAttribute("aria-pressed", String(get().includes(b.dataset.v)));
    });
  };
  toggles(f("status"), [{ v: "all", label: "All" }, { v: "drawn", label: "Drawn" }, { v: "soon", label: "Coming soon" }], () => [S.status], (v) => {
    S.status = v[0];
  }, false);
  toggles(f("view"), [{ v: "front", label: "Front" }, { v: "back", label: "Back" }], () => [S.view], (v) => {
    S.view = v[0];
  }, false);
  toggles(f("density"), [{ v: "grid", label: "Grid" }, { v: "sheets", label: "Sheets" }], () => [S.d], (v) => {
    S.d = v[0];
  }, false);
  toggles(f("avail"), AVAILS.map((a) => ({ v: a, label: a })), () => S.avail, (v) => {
    S.avail = v;
  }, true);
  toggles(f("build"), BUILDS.map((b) => ({ v: b, label: b })), () => S.build, (v) => {
    S.build = v;
  }, true);
  toggles(f("skin"), SKINS.map((s) => ({
    v: s,
    label: `skin ${s}${kit.colorNames?.[s] ? ` (${kit.colorNames[s].en})` : ""}`,
    title: kit.colorNames?.[s]?.en ?? s,
    html: `<span class="cat-dot" style="background:${kit.color(s)}"></span>`
  })), () => [S.skin], (v) => {
    S.skin = v[0];
  }, false);
  {
    const count = /* @__PURE__ */ new Map();
    for (const e of ENTRIES) if (e.kind === "part") for (const t of e.tags) count.set(t, (count.get(t) ?? 0) + 1);
    const PIN = ["modest", "faith", "religious", "work", "school", "kids", "accessibility", "traditional", "formal", "casual", "sport", "elder", "winter", "summer"];
    const all = [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
    const top = [...PIN.filter((t) => count.has(t)), ...all.filter((t) => !PIN.includes(t))].slice(0, 14);
    const rest = all.filter((t) => !top.includes(t)).sort();
    const mk = (ts, box) => toggles(box, ts.map((t) => ({ v: t, label: t, title: `${count.get(t)} parts` })), () => S.tags, (v) => {
      S.tags = v;
    }, true);
    mk(top, f("tags"));
    mk(rest, f("tags-more"));
    f("tags-n").textContent = String(rest.length);
  }
  const personSel = $(".cat-filters select");
  for (const [k, p] of Object.entries(PEOPLE)) personSel.append(Object.assign(el("option"), { value: k, textContent: p.label }));
  personSel.addEventListener("change", () => {
    S.person = personSel.value;
    paint(false);
  });
  const search = $(".cat-search input");
  let searchT = 0;
  search.addEventListener("input", () => {
    clearTimeout(searchT);
    searchT = window.setTimeout(() => {
      S.q = search.value.trim();
      jumpToMatches();
      paint(false);
    }, 140);
  });
  function jumpToMatches() {
    const here = GROUPS.find((g) => g.key === S.group);
    if (!filtersOn() || counts(here).match) return;
    const to = GROUPS.find((g) => counts(g).match);
    if (to) {
      S.group = to.key;
      S.slot = "";
    }
  }
  const resetBtn = $(".cat-freset");
  resetBtn.addEventListener("click", () => {
    Object.assign(S, { q: "", status: "all", avail: [], build: [], tags: [], ids: [], slot: "" });
    search.value = "";
    paint(false);
  });
  const filtersBtn = $(".cat-ftoggle");
  filtersBtn.addEventListener("click", () => {
    const open = filtersBtn.getAttribute("aria-expanded") !== "true";
    filtersBtn.setAttribute("aria-expanded", String(open));
    filtersEl.classList.toggle("open", open);
  });
  const AV_TEXT = { open: "open", unlock: "unlock", cast: "cast only", hidden: "hidden" };
  const badge = (a) => `<span class="cat-badge av-${a}" title="availability: ${AV_TEXT[a]}">${AV_TEXT[a]}</span>`;
  const buildsHtml = (bs) => `<span class="cat-builds" title="builds: ${bs.join(", ")}">${BUILDS.map((b) => `<i class="${bs.includes(b) ? "on" : ""}">${b[0].toUpperCase()}</i>`).join("")}</span>`;
  const swatch = (c) => `<span class="cat-dot" style="background:${kit.color(c)}" title="${esc(c)}"></span>`;
  const statusChip = (e) => e.drawn ? "" : e.status === "deferred" ? `<span class="cat-chip later">later</span>` : `<span class="cat-chip">coming soon</span>${e.status !== "ready" ? `<span class="cat-chip st">${esc(e.status)}</span>` : ""}`;
  const cache = /* @__PURE__ */ new Map();
  const near = /* @__PURE__ */ new Set();
  const painters = /* @__PURE__ */ new WeakMap();
  const io = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver((es) => {
    for (const e of es) {
      if (e.isIntersecting) {
        near.add(e.target);
        painters.get(e.target)?.();
      } else near.delete(e.target);
    }
  }, { rootMargin: "600px 0px" });
  const EAGER = q0.has("eager");
  const watch = (card, fn) => {
    painters.set(card, fn);
    if (!io || EAGER) fn();
  };
  const picKey = (e, view, body) => `${e.key}|${body.build}|${body.shape}|${body.height}|${S.skin}|${view}`;
  const faceDoc = (e, body) => {
    const d = base(body);
    d.hair = { style: e.field === "face.shape" ? "hair_short" : "hair_buzz", color: "hair_03" };
    const fl = e.field, v = e.value;
    if (fl === "facialHair") d.facialHair = { style: v };
    else if (fl === "face.marks") d.face = { marks: [v] };
    else d.face = { [fl.slice(5)]: v };
    return d;
  };
  function partCard(e) {
    const card = el("article", `cat-card${e.drawn ? "" : " soon"} k-${e.kind}`);
    card.dataset.id = e.id;
    const art = el(e.kind === "part" ? "button" : "div", "cat-art");
    if (art instanceof HTMLButtonElement) {
      art.type = "button";
      art.setAttribute("aria-label", `Details of ${e.en} (${e.id})`);
      art.addEventListener("click", () => openDetail(e));
    }
    const front = el("span", "cat-pic one"), other = el("span", "cat-pic two"), onb = el("span", "cat-onb");
    art.append(front, other, onb);
    art.insertAdjacentHTML("beforeend", `${e.kind === "later" ? "" : `<span class="cat-corner">${badge(e.avail)}</span>`}${statusChip(e) ? `<span class="cat-foot">${statusChip(e)}</span>` : ""}`);
    card.append(art);
    const cols = e.part?.defaults?.length ? e.part.defaults.map(swatch).join("") : "";
    const facts2 = [
      e.kind === "part" ? e.colors ? `<span title="colours">${cols || ""} ${e.colors} col.</span>` : e.part?.slot === "hair" || e.section.startsWith("hair") ? `<span>hair colour</span>` : `<span>no colour</span>` : "",
      e.patterns.length ? `<span title="${esc(e.patterns.join(" "))}">${e.patterns.length} pattern${e.patterns.length > 1 ? "s" : ""}</span>` : "",
      e.kind === "part" || e.kind === "face" ? buildsHtml(e.builds) : "",
      e.status === "default" ? `<span>default</span>` : "",
      e.cast.length ? `<span title="cast">\u2605 ${esc(e.cast.join(", "))}</span>` : ""
    ].filter(Boolean).join("");
    card.insertAdjacentHTML("beforeend", `<div class="cat-cap"><div class="cat-nm"><b>${esc(e.en)}</b> <span lang="tr">${esc(e.tr)}</span></div><code class="cat-id">${esc(e.id)}</code>` + (facts2 ? `<div class="cat-facts">${facts2}</div>` : "") + (e.tags.length ? `<div class="cat-tags">${e.tags.slice(0, 5).map(esc).join(" \xB7 ")}${e.tags.length > 5 ? ` +${e.tags.length - 5}` : ""}</div>` : "") + `</div>`);
    if (!e.drawn) {
      front.classList.add("planned");
      front.innerHTML = `<span class="cat-look">${esc(e.look || "planned")}</span>`;
      if (e.kind === "color" && e.hex) {
        front.classList.remove("planned");
        front.innerHTML = `<span class="cat-swatch" style="background:${e.hex}" title="${esc(e.hex)}"></span>`;
      }
      return card;
    }
    if (e.kind === "color") {
      const a = e.section === "pal-lens" ? LENS_ALPHA[e.id] ?? 1 : 1;
      front.innerHTML = `<span class="cat-swatch" style="background:${e.hex};opacity:${a}"></span>`;
      if (e.look) card.querySelector(".cat-cap").insertAdjacentHTML("beforeend", `<div class="cat-tags">\u{1F512} ${esc(e.look)}</div>`);
      return card;
    }
    if (e.kind === "pattern") {
      watch(card, () => {
        if (card.dataset.done) return;
        card.dataset.done = "1";
        enqueue(() => {
          if (!card.isConnected) {
            delete card.dataset.done;
            return;
          }
          const p = PATTERNS2[e.id];
          front.innerHTML = `<span class="cat-pats">${[...p.presets, ["fab_01"], ["fab_04"]].slice(0, 4).map((set) => {
            const g = patternSwatch(e.id, kit.color(set[0]), set.slice(1).map((c) => kit.color(c)), 16, 16);
            return `<svg viewBox="-8 -16 16 16" role="img" aria-label="${esc(set.join(" "))}"><g${SVG_BASE}>${groupSvg(g, { id: `pp${uid++}_`, tiles: /* @__PURE__ */ new Map(), base: true })}</g></svg>`;
          }).join("")}</span>`;
          card.querySelector(".cat-cap").insertAdjacentHTML("beforeend", `<div class="cat-tags">${p.inks} ink${p.inks > 1 ? "s" : ""} \xB7 ${p.layout} \xB7 ${p.slots.length} slots</div>`);
        });
      });
      return card;
    }
    const slot = e.part?.slot ?? "", framing = e.kind === "face" ? e.field === "facialHair" ? "bust" : "head" : framingOf(slot);
    const backOk = e.kind === "part" && backShows(slot);
    const docFor = (body) => () => e.kind === "face" ? faceDoc(e, body) : wearing(e.id, e.part, {}, body);
    const draw = (into, view2) => {
      const { body, note } = e.kind === "face" ? { body: { ...PEOPLE[S.person] }, note: "" } : personFor(e.part);
      const k = picKey(e, view2, body);
      if (into.dataset.k === k) return;
      const done = (svg) => {
        into.innerHTML = svg;
        into.dataset.k = k;
        into.title = [view2, note].filter(Boolean).join(" \xB7 ");
        if (into === front) onb.textContent = note;
      };
      if (cache.has(k)) {
        done(cache.get(k));
        return;
      }
      if (into.dataset.want === k) return;
      into.dataset.want = k;
      enqueue(() => {
        if (!into.isConnected || into.dataset.want !== k) return;
        const svg = svgOf(docFor(body), framing, view2);
        cache.set(k, svg);
        done(svg);
      });
    };
    const view = () => backOk || e.kind !== "part" ? S.view : "front";
    const otherView = () => view() === "front" ? "back" : "front";
    watch(card, () => {
      draw(front, e.kind === "face" ? "front" : view());
      if (other.dataset.k && other.dataset.k !== front.dataset.k?.replace(/\|(front|back)$/, `|${otherView()}`)) {
        other.replaceChildren();
        delete other.dataset.k;
        delete other.dataset.want;
      }
    });
    if (backOk) {
      card.classList.add("flip");
      art.addEventListener("pointerenter", () => draw(other, otherView()));
      art.addEventListener("focus", () => draw(other, otherView()));
    }
    return card;
  }
  const fig = (doc, framing, view, size, caption, hi, face) => {
    const fg = el("figure"), box = el("span", "cat-box");
    box.style.width = box.style.height = `${size}px`;
    fg.append(box);
    if (caption) fg.append(el("figcaption", void 0, caption));
    enqueue(() => {
      if (!fg.isConnected) return;
      const svg = svgOf(doc, framing, view, size, face);
      box.innerHTML = svg;
      box.style.height = "";
      if (svg.startsWith('<span class="cat-fail')) fg.classList.add("bad");
    }, hi);
    return fg;
  };
  const none = (size, text) => {
    const fg = el("figure", "none", text);
    fg.style.width = `${size}px`;
    fg.style.height = `${size}px`;
    return fg;
  };
  const otherColors = (p) => Array.from({ length: p.colors ?? 0 }, (_, i) => {
    const ids = Object.keys(kit.palettes[p.palettes?.[i] ?? "fabric"] ?? {}).filter((c) => !kit.paletteUnlocks?.[c]), d = p.defaults?.[i];
    return ids[((d ? ids.indexOf(d) : 0) + Math.floor(ids.length / 2)) % ids.length];
  });
  const HAIR_TRY = (list("hair").length ? list("hair") : [
    ...Object.entries(kit.parts).filter(([, p]) => p.slot === "hair" && (p.bulk ?? 0) > 0).sort((a, b) => (b[1].bulk ?? 0) - (a[1].bulk ?? 0)).slice(0, 3).map(([id]) => id),
    "hair_long",
    "hair_bun",
    "hair_short"
  ]).filter((id, i, all) => kit.parts[id]?.slot === "hair" && all.indexOf(id) === i).slice(0, 6);
  const CUTTERS = Object.entries(kit.parts).filter(([, p]) => p.clips?.slots.includes("hair")).slice(0, 8);
  const SHEET_BODIES = [
    { build: "adult", shape: "average", height: 0.5 },
    { build: "elder", shape: "round", height: 0.4 },
    { build: "child", shape: "slim", height: 0.5 }
  ];
  function sheet(id, p, into, hi) {
    const framing = framingOf(p.slot), size = sizeOf(framing), rows = el("div", "cat-rows"), views = backShows(p.slot) ? ["front", "back"] : ["front"];
    into.append(rows);
    const row = (label) => {
      const r2 = el("div", "cat-row"), figs = el("div", "cat-figs");
      r2.append(el("div", "cat-lab", label), figs);
      rows.append(r2);
      return figs;
    };
    const on = (g, body, o = {}) => () => wearing(id, p, g, body, o);
    const bodies = SHEET_BODIES.filter((b) => fits(p, b.build));
    if (!bodies.length) {
      const b = BUILDS.find((x) => fits(p, x));
      if (b) bodies.push({ build: b, shape: "average", height: 0.5 });
    }
    const r1 = row("defaults");
    for (const b of bodies) for (const v of views) r1.append(fig(on({}, b), framing, v, size, `${b.build} ${b.shape} \xB7 ${v}`, hi));
    const b0 = bodies[0];
    if (!b0) return;
    const alt = otherColors(p);
    if (alt.length || p.slot === "hair") {
      const r2 = row("other colour"), g = p.slot === "hair" ? { colors: ["hair_07"] } : { colors: alt };
      for (const v of views) r2.append(fig(on(g, b0), framing, v, size, `${(g.colors ?? []).map((c) => swatch(c) + " " + c).join(" ")} \xB7 ${v}`, hi));
    }
    if (p.sides) {
      const r2 = row("sides");
      for (const side of p.sides.allowed) for (const v of views) r2.append(fig(on({ side }, b0), framing, v, size, `side ${side}${side === p.sides.default ? " (default)" : ""} \xB7 ${v}`, hi));
    }
    if (p.patterns?.length) {
      const r2 = row("patterns");
      for (const pat of p.patterns) {
        const def = PATTERNS2[pat], preset = def?.presets[0] ?? ["fab_01"];
        for (const [i, v] of views.entries()) {
          const fg = fig(on({ colors: [preset[0], ...(p.defaults ?? []).slice(1)], pattern: pat, inks: preset.slice(1) }, b0), framing, v, size, `${pat}${def?.unlock ? " \u{1F512}" : ""} \xB7 ${v}`, hi);
          if (i === 0 && def) enqueue(() => {
            const sw = patternSwatch(pat, kit.color(preset[0]), preset.slice(1).map((c) => kit.color(c)), 14, 8);
            fg.insertAdjacentHTML("beforeend", `<svg class="psw" viewBox="-7 -8 14 8" width="56" height="32"><g${SVG_BASE}>${groupSvg(sw, { id: `sw${uid++}_`, tiles: /* @__PURE__ */ new Map(), base: true })}</g></svg>`);
          }, hi);
          r2.append(fg);
        }
      }
    }
    if (HEAD_SLOTS.includes(p.slot)) {
      const small2 = Math.round(size * 0.62), r2 = row("face shapes");
      for (const shape of kit.features["face.shape"].values) for (const v of views) r2.append(fig(on({}, b0, { face: { shape } }), framing === "full" ? "bust" : framing, v, small2, `${shape} \xB7 ${v}`, hi));
      if (["ears", "aid", "eyes", "head", "hat"].includes(p.slot)) {
        const re = row("ears");
        for (const ears of kit.features["face.ears"].values) re.append(fig(on({}, b0, { face: { ears } }), "head", "front", small2, ears, hi));
      }
    }
    if (["head", "hat", "hairwear"].includes(p.slot) && HAIR_TRY.length) {
      const r2 = row("on hair");
      for (const h of HAIR_TRY) for (const v of views) r2.append(fig(on({}, b0, { hair: h }), framing, v, Math.round(size * 0.8), `${h} \xB7 ${v}`, hi));
    }
    if (p.slot === "hair" && CUTTERS.length) {
      const r2 = row("under a hat");
      for (const [cid, c] of CUTTERS) for (const v of views) r2.append(fig(() => put(wearing(id, p, {}, b0), cid, c), framing, v, Math.round(size * 0.8), `${cid} \xB7 ${v}`, hi));
    }
    const wrap = el("div", "cat-shapes-wrap"), grid = el("div", "cat-shapes"), small = sizeOf(framing, true);
    grid.style.gridTemplateColumns = `56px repeat(${SHAPES.length * views.length}, auto)`;
    grid.append(el("div", "cat-lab", "build \xD7 shape"), ...SHAPES.flatMap((s) => views.map((v) => el("div", "cat-lab", `${s} \xB7 ${v}`))));
    for (const build of BUILDS) {
      grid.append(el("div", "cat-lab", build));
      for (const shape of SHAPES) for (const v of views) grid.append(fits(p, build) ? fig(on({}, { build, shape, height: 0.5 }), framing, v, small, "", hi) : none(small, "not made for"));
    }
    wrap.append(grid);
    const r = el("div", "cat-row");
    r.append(el("div", "cat-lab", "build \xD7 shape"), wrap);
    rows.append(r);
  }
  const facts = (e) => {
    const p = e.part, plan = PLAN_PART.get(e.id);
    const cur = e.kind === "part" ? PARTS[e.id] : e.kind === "face" ? FEATURES[e.key] : e.kind === "color" ? COLORS[e.id] : e.kind === "pattern" ? PATTERNS[e.id] : void 0;
    const items = [
      ["slot", `${esc(p?.slot ?? plan?.slot ?? e.section)} \u2192 <code>${esc(FIELD.get(p?.slot ?? plan?.slot ?? "") ?? "custom")}</code>${p ? ` \xB7 <code>${FILE.get(e.id)}.ts</code>` : ""}`],
      ["availability", `${badge(e.avail)}${cur?.unlock ? ` <code>${esc(cur.unlock)}</code>` : ""}${cur?.note ? ` \xB7 ${esc(cur.note)}` : ""} <small>(sahne-kit/src/curation.ts)</small>`],
      ["status", e.drawn ? "drawn" : `${statusChip(e)}`],
      ["colours", p ? p.colors ? Array.from({ length: p.colors }, (_, i) => `${p.palettes?.[i] ?? "fabric"} ${p.defaults?.[i] ? swatch(p.defaults[i]) + " " + p.defaults[i] : "(derived)"}`).join(", ") : p.slot === "hair" ? "hair colour" : "none" : String(e.colors)],
      ["patterns", e.patterns.length ? e.patterns.map((x) => `<code>${esc(x)}</code>`).join(" ") : "none"],
      ["builds", buildsHtml(e.builds)],
      ["tags", e.tags.map(esc).join(" \xB7 ") || "\u2014"],
      ["cast", e.cast.map(esc).join(", ")],
      ["look", esc(e.look)]
    ];
    if (p) items.push(
      ["rules", [
        p.hides ? `hides ${p.hides.join(" ")}` : "",
        p.replaces ? `replaces ${p.replaces.join(" ")}` : "",
        p.clips ? `clips ${p.clips.slots.join(" ")}` : "",
        p.over ? `over ${p.over.join(" ")}` : "",
        p.avoid?.length ? `avoids ${p.avoid.join(" ")}` : "",
        p.sides ? `sides ${p.sides.allowed.join("/")} (${p.sides.default})` : "",
        p.bulk !== void 0 ? `bulk ${p.bulk} cm` : "",
        p.odds !== void 0 ? `odds ${JSON.stringify(p.odds)}` : ""
      ].filter(Boolean).map(esc).join(" \xB7 ")]
    );
    return `<dl class="cat-dl">${items.filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>`;
  };
  function sheetCard(e) {
    const card = el("article", `cat-sheet${e.drawn ? "" : " soon"}`);
    card.dataset.id = e.id;
    card.insertAdjacentHTML("beforeend", `<header><code class="cat-id">${esc(e.id)}</code> <b>${esc(e.en)}</b> <span lang="tr">${esc(e.tr)}</span> ${badge(e.avail)} ${statusChip(e)}</header>`);
    const open = el("button", "cat-linkish", "open details");
    open.type = "button";
    open.addEventListener("click", () => openDetail(e));
    card.querySelector("header").append(open);
    if (!e.drawn || e.kind !== "part") {
      card.insertAdjacentHTML("beforeend", facts(e));
      return card;
    }
    const p = e.part;
    card.insertAdjacentHTML("beforeend", `<div>${facts(e)}</div>`);
    card.style.minHeight = "420px";
    watch(card, () => {
      if (card.dataset.done) return;
      card.dataset.done = "1";
      card.style.minHeight = "";
      sheet(e.id, p, card, false);
    });
    return card;
  }
  const dialog = $(".cat-detail"), dbody = $(".cat-dbody"), dtitle = $(".cat-dhead h2");
  function openDetail(e) {
    S.part = e.id;
    save();
    dbody.replaceChildren();
    dtitle.innerHTML = `${esc(e.en)} <span lang="tr">${esc(e.tr)}</span> <code>${esc(e.id)}</code>`;
    dbody.insertAdjacentHTML("beforeend", facts(e));
    if (e.drawn && e.part) sheet(e.id, e.part, dbody, true);
    else dbody.insertAdjacentHTML("beforeend", `<div class="cat-planned-big">${statusChip(e)}<p>Not drawn yet: the facts above are the plan's (<code>sahne-kit/catalogue/plan.json</code>). Its pictures on every build, shape, colour and pattern appear here once the kit has the part.</p></div>`);
    if (!dialog.open) dialog.showModal();
    dbody.scrollTop = 0;
  }
  dialog.addEventListener("close", () => {
    if (dead) return;
    S.part = "";
    save();
    dbody.replaceChildren();
  });
  $(".cat-dclose").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (ev) => {
    if (ev.target === dialog) dialog.close();
  });
  function counts(g) {
    const mine = ENTRIES.filter((e) => groupOfEntry(e) === g.key);
    return { drawn: mine.filter((e) => e.drawn).length, all: mine.length, match: mine.filter((e) => matches(e)).length };
  }
  let firstPaint = 0, buildMs = 0, setupMs = 0;
  function paint(newTab) {
    const t = performance.now();
    for (const s of syncs) s();
    personSel.value = S.person;
    if (search.value.trim() !== S.q) search.value = S.q;
    const nf = [S.avail.length, S.build.length, S.tags.length, S.status !== "all" ? 1 : 0, S.ids.length ? 1 : 0].reduce((a, b) => a + b, 0);
    filtersBtn.textContent = nf ? `Filters \xB7 ${nf}` : "Filters";
    resetBtn.hidden = !filtersOn() && !S.slot;
    if (S.tags.some((tg) => f("tags-more").querySelector(`[data-v="${CSS.escape(tg)}"]`))) $(".cat-more").open = true;
    for (const g2 of GROUPS) {
      const b = tabBtns.get(g2.key), c = counts(g2), on = g2.key === S.group;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      b.innerHTML = `${esc(g2.label)} <small>${filtersOn() ? `${c.match} match${c.match === 1 ? "" : "es"}` : g2.key === "later" ? c.all : `${c.drawn}/${c.all}`}</small>`;
      b.title = `${c.drawn} drawn of ${c.all} planned`;
      b.classList.toggle("empty", filtersOn() && !c.match);
    }
    panel.setAttribute("aria-labelledby", `cat-tab-${S.group}`);
    if (newTab) tabBtns.get(S.group).scrollIntoView({ block: "nearest", inline: "nearest" });
    io?.disconnect();
    near.clear();
    const g = GROUPS.find((x) => x.key === S.group), frag = document.createDocumentFragment();
    const inTab = ENTRIES.filter((e) => groupOfEntry(e) === g.key);
    const chips = el("div", "cat-slots");
    chips.setAttribute("role", "group");
    chips.setAttribute("aria-label", "Sections");
    const chip = (key, label, n) => {
      const b = el("button", "cat-tg", `${esc(label)} <small>${n}</small>`);
      b.type = "button";
      b.setAttribute("aria-pressed", String(S.slot === key));
      b.addEventListener("click", () => {
        S.slot = S.slot === key ? "" : key;
        paint(false);
      });
      chips.append(b);
    };
    if (g.sections.length > 1) {
      chip("", "All", String(inTab.filter((e) => matches(e)).length));
      for (const s of g.sections) {
        const mine = inTab.filter((e) => e.section === s.key);
        if (mine.length) chip(s.key, s.label, filtersOn() ? String(mine.filter((e) => matches(e)).length) : `${mine.filter((e) => e.drawn).length}/${mine.length}`);
      }
      frag.append(chips);
    }
    let shown = 0;
    for (const s of g.sections) {
      if (S.slot && S.slot !== s.key) continue;
      const all = inTab.filter((e) => e.section === s.key), mine = all.filter((e) => matches(e));
      if (!mine.length) continue;
      shown += mine.length;
      const drawn = mine.filter((e) => e.drawn), soon = mine.filter((e) => !e.drawn);
      const sec = el("section", "cat-sec");
      sec.insertAdjacentHTML("beforeend", `<h2><b>${esc(s.label)}</b> <code>${esc(s.sub)}</code> <span>${drawn.length} drawn${soon.length ? ` \xB7 ${soon.length} ${g.key === "later" ? "deferred" : "coming soon"}` : ""}${mine.length < all.length ? ` \xB7 ${all.length - mine.length} filtered out` : ""}</span></h2>`);
      const sheets = S.d === "sheets" && g.key !== "colours";
      const grid = el("div", sheets ? "cat-sheets" : `cat-grid g-${g.key === "colours" ? s.key === "patterns" ? "pat" : "col" : g.key === "face" ? "face" : "part"}`);
      for (const e of [...drawn, ...soon]) grid.append(sheets && e.kind === "part" ? sheetCard(e) : partCard(e));
      sec.append(grid);
      frag.append(sec);
    }
    if (!shown) {
      const msg = el("div", "cat-nomatch", "Nothing in this tab matches.");
      const elsewhere = GROUPS.filter((x) => x.key !== g.key).map((x) => [x, counts(x).match]).filter(([, n]) => n);
      if (elsewhere.length) {
        msg.append(" Matches in ");
        for (const [x, n] of elsewhere) {
          const b = el("button", "cat-tg", `${esc(x.label)} <small>${n}</small>`);
          b.type = "button";
          b.addEventListener("click", () => {
            S.group = x.key;
            S.slot = "";
            paint(true);
          });
          msg.append(b, " ");
        }
      }
      frag.append(msg);
    }
    if (g.key === "face" && !filtersOn() && !S.slot) {
      const sec = el("section", "cat-sec"), grid = el("div", "cat-grid g-face");
      sec.innerHTML = `<h2><b>Emotions</b> <code>kit.face.emotions</code> <span>${Object.keys(kit.face.emotions).length} \xB7 each live with the gestures in <a href="#/kit/gestures">Gestures and faces</a></span></h2>`;
      for (const emo of Object.keys(kit.face.emotions)) {
        const c = el("article", "cat-card k-face"), art = el("div", "cat-art"), pic = el("span", "cat-pic one");
        art.append(pic);
        c.append(art, el("div", "cat-cap", `<div class="cat-nm"><b>${esc(emo)}</b></div>`));
        watch(c, () => {
          if (c.dataset.done) return;
          c.dataset.done = "1";
          enqueue(() => {
            if (c.isConnected) pic.innerHTML = svgOf(() => ({ ...base({ ...PEOPLE[S.person] }), hair: { style: "hair_buzz", color: "hair_03" } }), "head", "front", void 0, emo);
          });
        });
        grid.append(c);
      }
      sec.append(grid);
      frag.append(sec);
    }
    panel.replaceChildren(frag);
    if (io && !EAGER) {
      const h = window.innerHeight + 600;
      for (const c of panel.querySelectorAll(".cat-card, .cat-sheet")) {
        if (!painters.has(c)) continue;
        io.observe(c);
        const r = c.getBoundingClientRect();
        if (r.bottom > -600 && r.top < h) {
          near.add(c);
          painters.get(c)();
        }
      }
    }
    if (newTab) window.scrollTo({ top: Math.min(window.scrollY, root.offsetTop) });
    save();
    buildMs = performance.now() - t;
    if (!firstPaint) idleWaiters.push(() => {
      if (!firstPaint) {
        firstPaint = performance.now() - T_START;
        stats();
      }
    });
    if (!pumping) idle();
    if (S.part && !dialog.open) {
      const e = ENTRIES.find((x) => x.id === S.part && x.kind === "part");
      if (e) openDetail(e);
    }
  }
  function stats() {
    if (dead) return;
    const parts = ENTRIES.filter((e) => e.kind === "part"), drawn = parts.filter((e) => e.drawn).length;
    const extra = parts.filter((e) => e.drawn && !PLAN_PART.has(e.id)).length;
    statusEl.textContent = `kit ${kit.id} \xB7 ${drawn} parts drawn of ${parts.length} planned${extra ? ` (${extra} not in the plan)` : ""} \xB7 ${Object.keys(PATTERNS2).length}/${PLAN.patterns.length || Object.keys(PATTERNS2).length} patterns \xB7 panel built in ${buildMs.toFixed(0)} ms \xB7 set-up ${setupMs.toFixed(0)} ms` + (firstPaint ? ` \xB7 first screen drawn ${firstPaint.toFixed(0)} ms after the view opened` : "") + ` \xB7 ${pictures} pictures, ${pictures ? (pictureMs / pictures).toFixed(1) : 0} ms each, longest job ${longest.toFixed(0)} ms \xB7 ${longTasks} long task${longTasks === 1 ? "" : "s"}${longTasks ? ` (max ${longTaskMax.toFixed(0)} ms)` : ""}` + (errors ? ` \xB7 ${errors} FAILED (see the console)` : "");
    statusEl.classList.toggle("bad", errors > 0);
  }
  syncs.push(() => queueMicrotask(() => {
    for (const c of near) painters.get(c)?.();
  }));
  ctx.cleanup(() => {
    dead = true;
    queues[0].length = queues[1].length = 0;
    tick.port1.close();
    tick.port2.close();
    io?.disconnect();
    po?.disconnect();
    clearTimeout(searchT);
    if (dialog.open) dialog.close();
  });
  if (!GROUP_GIVEN) jumpToMatches();
  paint(true);
  setupMs = performance.now() - T_START;
  stats();
}
var STYLE = `
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
.cat-search::before { content: "\u2315"; position: absolute; left: 11px; top: 50%; transform: translateY(-52%); color: var(--mute); font-size: 16px; pointer-events: none; }
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

/* sheets: every body, colour, side, pattern and build \xD7 shape of a part */
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
export {
  catalogue
};
//# sourceMappingURL=catalogue-GMGUAAOO.js.map
