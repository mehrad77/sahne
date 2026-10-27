// The contract the kit's art files keep (B4): ids by slot, the slot rules a part may state, prints
// and their inks, sides, builds and unlocks, the head's shared geometry, and the face drawn with
// only what the still backend records. Every check holds for any number of parts, so the art files
// can grow in parallel without touching this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compose, normalize, createBuilder, renderSvg, groupBounds, groupSvg, rect, faceFrom, SvgContext, NEUTRAL_FACE, GARMENT_FIELDS, type AvatarDoc, type Build, type Kit, type PartDef, type PartOut, type Path, type Vec2, type ViewName } from "sahne";
import kit, { PART_FILES, PATTERNS, starterOffer } from "../src/index.ts";
import { patternShapes, patternsFor, stripPrint, printScale, inksOf } from "../src/patterns.ts";
import { headPath, headArc, headCrown, earAt, insetHead, head, HEAD_SHAPES, EAR_SHAPES, belowBand } from "../src/draw/head.ts";
import { hairBulk, HAIR_BULK } from "../src/draw/hair.ts";
import { faceStyle, draw as drawFace, earGroup } from "../src/face.ts";
import { restGrip } from "../src/draw/hold.ts";
import { ringAt, handOutline, HAND_SHAPES } from "../src/hands.ts";
import { PALETTES, lensAlpha } from "../src/palette.ts";
import { unlocksOf, PARTS as CURATION, COLORS as CURATED_COLORS, PATTERNS as CURATED_PATTERNS, FEATURES as CURATED_FEATURES } from "../src/curation.ts";
import { readFileSync } from "node:fs";

const BUILDS: Build[] = ["adult", "elder", "child", "toddler"];
const FIELD = new Map(GARMENT_FIELDS.map(g => [g.slot, g.field] as const));

/** The words a part's id may start with, per slot (catalogue: `slots`). */
const PREFIXES: Record<string, string[]> = {
  hair: ["hair"], top: ["top"], bottom: ["bottom"], dress: ["dress"], outer: ["outer"], shoes: ["shoes"],
  head: ["headscarf", "turban", "headwrap", "cap", "bandana"], hat: ["hat", "cap"], hairwear: ["hairclip", "hairbow", "hairflower", "headband"],
  eyes: ["glasses", "sunglasses"], ears: ["ear"], aid: ["ear"], neck: ["neck", "scarf", "tie", "lanyard", "shawl"],
  wrist: ["watch", "bracelet", "bangle", "tesbih", "wrist"], hands: ["glove", "ring", "hand"], waist: ["apron", "belt", "bag"],
  carry: ["bag", "case"], hold: ["bag", "book", "cane", "phone", "umbrella"],
};

const doc = (o: Partial<AvatarDoc> = {}): AvatarDoc => ({ ...structuredClone(kit.defaultDoc), ...o });

test("every slot of the document has an id prefix, and every part's id starts with one of its slot's", () => {
  assert.deepEqual(Object.keys(PREFIXES).sort(), GARMENT_FIELDS.map(g => g.slot).sort());
  for (const [id, p] of Object.entries(kit.parts)) {
    assert.ok(FIELD.has(p.slot), `${id}: slot ${p.slot} is a document field's`);
    assert.ok(PREFIXES[p.slot].some(w => id.startsWith(w + "_")), `${id}: in slot ${p.slot}, so it starts with ${PREFIXES[p.slot].join("_, ")}_`);
  }
  for (const [file, parts] of Object.entries(PART_FILES)) for (const [id, p] of Object.entries(parts)) {
    assert.equal(p.unlock, undefined, `${file}/${id}: unlocks live in curation.ts`);
    for (const t of ["cast", "hidden"]) if (p.tags?.includes(t)) assert.equal(CURATION[id]?.avail, t, `${file}/${id}: tagged ${t}, so curation.ts says ${t}`);
  }
});

test("slot rules a part states: a covering that hides the hair hides hairwear too; avoid tags and hair bulk are well formed", () => {
  const tags = new Set(Object.values(kit.parts).flatMap(p => p.tags ?? []));
  for (const [id, p] of Object.entries(kit.parts)) {
    if (p.hides?.includes("hair")) assert.ok(p.hides.includes("hairwear"), `${id}: hides the hair, so a band or clip would show in its opening: hides hairwear too`);
    for (const t of p.avoid ?? []) assert.match(t, /^[a-z]+$/, `${id}: avoid ${t}`);
    if (p.bulk !== undefined) assert.ok(p.slot === "hair" && Number.isFinite(p.bulk) && p.bulk >= 0 && p.bulk <= 15, `${id}: bulk is for hair, 0–15 cm`);
  }
  assert.ok(tags.size > 0);
  // hats and coverings read the hair's bulk, scaled to the build; a style without one is low
  const ctx = (style: string, build: Build) => ({ avatar: doc({ hair: { style, color: "hair_02" }, body: { build, height: 0.5, shape: "average" } }), body: kit.body({ build, height: 0.5, shape: "average" }), kit });
  assert.equal(hairBulk(ctx("hair_short", "adult")), HAIR_BULK.low * kit.body({ build: "adult", height: 0.5, shape: "average" }).headH / 50);
  assert.ok(hairBulk(ctx("hair_curly", "adult")) > hairBulk(ctx("hair_short", "adult")) && hairBulk(ctx("hair_curly", "child")) < hairBulk(ctx("hair_curly", "adult")));
  assert.equal(hairBulk(ctx("constructor", "adult")), hairBulk(ctx("hair_short", "adult")));
  // lenses: by id or by hex, and a cast member's own hex by its lightness
  assert.equal(lensAlpha("len_02"), 0.82); assert.equal(lensAlpha(PALETTES.lens.len_02.toLowerCase()), 0.82);
  assert.equal(lensAlpha(PALETTES.lens.len_01), 0.18); assert.equal(lensAlpha("#202020"), 0.8); assert.equal(lensAlpha("#FFFFFF"), 0.18); assert.equal(lensAlpha(undefined), 0.18);
});

test("builds, sides and held parts are well formed", () => {
  for (const [id, p] of Object.entries(kit.parts)) {
    if (p.builds) assert.ok(p.builds.length > 0 && p.builds.every(b => BUILDS.includes(b)) && new Set(p.builds).size === p.builds.length, `${id}: builds`);
    if (p.sides) assert.ok(p.sides.allowed.length > 0 && p.sides.allowed.includes(p.sides.default) && p.sides.allowed.every(s => ["l", "r", "b"].includes(s)), `${id}: sides`);
    // a held part marks its pieces, so a script's prop can take its place
    if (p.slot === "hold") {
      const out = p.draw({ avatar: kit.defaultDoc, body: kit.body(kit.defaultDoc.body), skin: "#DCA27A", hair: "#2E2019", colors: [], pattern: null, inks: [], side: p.sides?.default ?? "r", garment: { id }, kit, clip: null, clipBack: null });
      assert.ok([...(out.front ?? []), ...(out.back ?? [])].every(it => it.hold === "l" || it.hold === "r"), `${id}: every piece is marked held`);
      assert.ok(Object.keys(out.alt ?? {}).length > 0, `${id}: it closes its hand`);
    }
  }
  // the defaults of the default character fit every build
  for (const f of ["outfit.top", "outfit.bottom", "outfit.shoes"] as const) {
    const g = f.split(".")[1] as "top" | "bottom" | "shoes", p = kit.parts[kit.defaultDoc.outfit[g]!.id];
    assert.ok(!p.builds, `${f}: the default part is made for every build`);
  }
  assert.ok(!kit.parts[kit.defaultDoc.hair.style].builds);
});

test("curation: one entry per drawn or planned part and pattern, applied to the kit", () => {
  const plan = JSON.parse(readFileSync(new URL("../catalogue/plan.json", import.meta.url), "utf8"));
  const planned = new Set<string>(plan.parts.map((p: { id: string }) => p.id));
  const plannedColors = new Set<string>(Object.values(plan.palettes as Record<string, { id: string }[]>).flat().map(c => c.id));
  const isColor = (id: string) => Object.values(PALETTES).some(p => Object.hasOwn(p, id));
  const well = (what: string, c: { avail: string; unlock?: string }) => {
    assert.ok(["open", "unlock", "cast", "hidden"].includes(c.avail), `${what}: avail ${c.avail}`);
    if (c.avail === "unlock") assert.match(c.unlock ?? "", /^[a-z]+:[a-z0-9_]+$/, `${what}: an unlock token`);
    else assert.equal(c.unlock, undefined, `${what}: a token only with unlock`);
  };
  for (const id of Object.keys(kit.parts)) assert.ok(Object.hasOwn(CURATION, id), `${id}: drawn, so curation.ts lists it`);
  for (const id of planned) assert.ok(Object.hasOwn(CURATION, id), `${id}: planned, so curation.ts lists it`);
  for (const [id, c] of Object.entries(CURATION)) {
    well(id, c);
    assert.ok(kit.parts[id] || planned.has(id), `${id}: curated, so drawn or planned`);
    const p = kit.parts[id];
    if (!p) continue;
    assert.equal(p.unlock, c.unlock, `${id}: its unlock comes from curation.ts`);
    for (const t of ["cast", "hidden"] as const) assert.equal(!!p.tags?.includes(t), c.avail === t, `${id}: tag ${t}`);
  }
  for (const [id, c] of Object.entries(CURATED_COLORS)) { well(id, c); assert.ok(isColor(id) || plannedColors.has(id), `${id}: a colour`); assert.ok(c.avail === "unlock", `${id}: colours lock or are open`); }
  for (const id of Object.keys(PATTERNS)) assert.ok(Object.hasOwn(CURATED_PATTERNS, id), `${id}: drawn, so curation.ts lists it`);
  for (const [id, c] of Object.entries(CURATED_PATTERNS)) { well(id, c); assert.ok(c.avail === "open" || c.avail === "unlock", `${id}: patterns lock or are open`); }
  for (const [k, c] of Object.entries(CURATED_FEATURES)) { well(k, c); assert.match(k, /^[a-zA-Z.]+:[a-z0-9_]+$/); }
  // the builder offers neither cast nor hidden parts
  const b = createBuilder(kit, kit.defaultDoc);
  for (const [id, p] of Object.entries(kit.parts)) if (CURATION[id].avail === "cast" || CURATION[id].avail === "hidden") {
    const f = GARMENT_FIELDS.find(g => g.slot === p.slot)!.field;
    assert.ok(!b.options(f).some(o => o.value === id), `${id}: not offered`);
  }
});

test("unlocks: tokens for known colours and patterns, never on accessibility, and a locked id is still a valid document", () => {
  const isColor = (id: string) => Object.values(PALETTES).some(p => Object.hasOwn(p, id));
  for (const [id, t] of Object.entries(unlocksOf("color"))) { if (isColor(id)) assert.equal(kit.paletteUnlocks?.[id], t); assert.match(t, /^[a-z]+:[a-z0-9_]+$/); }
  for (const id of Object.keys(kit.paletteUnlocks ?? {})) assert.ok(isColor(id), `${id}: a colour of the palettes`);
  for (const [id, t] of Object.entries(unlocksOf("pattern"))) { if (PATTERNS[id]) assert.equal(PATTERNS[id].unlock, t, `${id}: a pattern with its token`); assert.match(t, /^[a-z]+:[a-z0-9_]+$/); }
  for (const [id, t] of Object.entries(unlocksOf("part"))) {
    // a part's id may share a palette's prefix (hair_bob, hair_19): the tables keep them apart
    assert.ok(!isColor(id) && !Object.hasOwn(PATTERNS, id) && /^[a-z]+_[a-z_]+$/.test(id), `${id}: a part id`);
    assert.match(t, /^[a-z]+:[a-z0-9_]+$/);
    if (kit.parts[id]) assert.equal(kit.parts[id].unlock, t, `${id}: applied`);
  }
  for (const id of Object.keys(kit.paletteUnlocks ?? {})) assert.ok(!kit.parts[id], `${id}: a colour token never lands on a part`);
  for (const [id, p] of Object.entries(kit.parts)) if (p.tags?.includes("accessibility")) assert.equal(p.unlock, undefined, `${id}: accessibility is never locked`);
  for (const id of Object.keys(PALETTES.skin)) assert.equal(kit.paletteUnlocks?.[id], undefined, "skin is never locked");
  // a friend's document with a locked colour and pattern is drawn as it is
  const d = normalize(doc({ hair: { style: "hair_bob", color: "hair_29" }, outfit: { ...kit.defaultDoc.outfit, top: { id: "top_tee", pattern: "pat_iznik_tulip", inks: ["fab_49", "fab_38"] } } }), kit)!;
  assert.equal(d.hair.color, "hair_29");
  assert.deepEqual(d.outfit.top, { id: "top_tee", pattern: "pat_iznik_tulip", inks: ["fab_49", "fab_38"] });
  const b = createBuilder(kit, d);
  assert.equal(b.patternOptions("outfit.top").find(o => o.value === "pat_iznik_tulip")?.locked, true);
  assert.equal(b.setPattern("outfit.top", "pat_check"), true);
});

// ---- patterns ---------------------------------------------------------------------------------------

test("every pattern a part takes exists and is allowed on its slot; every slot that may print has a part or waits for one", () => {
  for (const [id, p] of Object.entries(kit.parts)) for (const pat of p.patterns ?? []) {
    assert.ok(Object.hasOwn(PATTERNS, pat), `${id}: pattern ${pat} exists`);
    assert.ok(PATTERNS[pat].slots.includes(p.slot), `${id}: ${pat} is allowed on ${p.slot}`);
    assert.ok((p.colors ?? 0) >= 1, `${id}: a print needs a ground colour`);
  }
  for (const [id, pat] of Object.entries(PATTERNS)) {
    assert.ok(pat.names.en && pat.names.tr && (pat.inks === 1 || pat.inks === 2), id);
    assert.ok(pat.slots.every(s => FIELD.has(s)) && !pat.slots.some(s => ["eyes", "ears", "aid", "wrist", "hands", "hair"].includes(s)), `${id}: slots`);
    for (const set of pat.presets) for (const c of set) assert.ok(Object.hasOwn(PALETTES.fabric, c), `${id}: preset ${c}`);
    assert.ok(patternsFor(pat.slots[0]).includes(id));
  }
});

test("every pattern prints finite, flat shapes inside the outline, smaller on children, with its inks derived when the document gives none", () => {
  const outline = rect(-25, -45, 50, 52);
  for (const id of Object.keys(PATTERNS)) for (const build of BUILDS) for (const inks of [[], ["#D9534A"], ["#D9534A", "#1F5FC0"]]) {
    const shapes = patternShapes(id, outline, { ground: "#F7F3EA", inks, scale: printScale(build), hem: 7 });
    assert.ok(shapes.length > 0, `${id} draws`);
    for (const s of shapes) {
      assert.ok(s.flat, `${id}: printed, not cut`);
      assert.ok(s.clip === outline || s.path === outline, `${id}: inside the outline`);
      assert.ok(s.path.finite() && groupBounds({ shapes: [s] }).every(Number.isFinite), `${id}: finite`);
      if (s.tile) for (const t of s.tile.shapes) assert.match(t.fill!, /^#[0-9a-f]{6}$/i);
      else assert.match(s.fill!, /^#[0-9a-f]{6}$/i);
    }
    const svg = groupSvg({ shapes: [{ path: outline, fill: "#F7F3EA" }, ...shapes] }, { tiles: new Map() });
    assert.ok(svg.length < 12000, `${id} on a torso is ${svg.length} characters of SVG`);
  }
  assert.deepEqual(patternShapes("pat_nope", outline, { ground: "#000000" }), []);
  assert.deepEqual(patternShapes(null, outline, { ground: "#000000" }), []);
  assert.notEqual(inksOf("pat_check", "#F7F3EA")[0], inksOf("pat_check", "#26272C")[0], "an ink contrasts with its ground");
  assert.deepEqual(inksOf("pat_check", "#F7F3EA", ["#112233"])[0], "#112233");
  const body = kit.body({ build: "adult", height: 0.5, shape: "average" }), ctx = { pattern: "pat_stripe_h", inks: [], colors: ["#F7F3EA"], body };
  const sp = stripPrint(ctx), st = sp.stripes!;
  assert.ok(st && st[0] === "#F7F3EA" && st[1] === 2.6 && st[2] > 0.55 && st[2] < 0.6 && sp.color === inksOf("pat_stripe_h", "#F7F3EA")[0], "crosswise stripes reach the sleeves, starting with the ground");
  assert.deepEqual(stripPrint({ ...ctx, pattern: "pat_dots" }), {}, "other prints leave limbs plain");
});

test("a printed garment composes, renders and keeps its pattern through normalize; inks that are not fabrics are dropped", () => {
  for (const [id, p] of Object.entries(kit.parts)) for (const pat of p.patterns ?? []) {
    // on a body the part is made for (a toddler's bodysuit is dropped from the default adult)
    const build = p.builds?.[0] ?? kit.defaultDoc.body.build, body = { ...kit.defaultDoc.body, build };
    const field = FIELD.get(p.slot)!, g = { id, pattern: pat, inks: ["fab_14", "skin_01", "fab_33"] }, d = doc({ body });
    const [a, b] = field.split(".");
    if (b) (d as unknown as Record<string, Record<string, unknown>>)[a] = { ...((d as unknown as Record<string, Record<string, unknown>>)[a] ?? {}), [b]: g }; else (d as unknown as Record<string, unknown>)[a] = g;
    // a cast part is refused in a learner's document, so this one is the app's own (trusted)
    const n = normalize(d, kit, { trusted: !!p.tags?.includes("cast") })!, got = field.split(".").reduce((o: Record<string, unknown>, k) => o?.[k] as Record<string, unknown>, n as unknown as Record<string, unknown>);
    assert.equal(got?.pattern, pat, `${id}: keeps ${pat}`);
    assert.deepEqual(got?.inks, ["fab_14"], `${id}: inks are fabrics, up to the first that is not`);
    // the print is in the picture, front and back (where the part shows its cloth from behind)
    const plain = normalize(doc({ body }), kit)!, without = structuredClone(n), g0 = field.split(".").reduce((o: Record<string, unknown>, k) => o[k] as Record<string, unknown>, without as unknown as Record<string, unknown>);
    delete g0.pattern; delete g0.inks;
    for (const view of ["front", "back"] as const) {
      if (view === "back" && groundOf(draws(p, id, null, "adult"), view, kit.color(p.defaults?.[0])) <= 30) continue;
      const trusted = !!p.tags?.includes("cast");
      const a = renderSvg(compose(n, kit, { trusted }), kit, { framing: "full", size: 200, view }), b = renderSvg(compose(without, kit, { trusted }), kit, { framing: "full", size: 200, view });
      assert.notEqual(a, b, `${id} with ${pat}, ${view}: the print changes the picture`);
    }
    assert.ok(plain);
  }
});

/** A part's own output on a build, in its default colours, with a pattern or none (as `compose` would call it). */
function draws(p: PartDef, id: string, pattern: string | null, build: Build): PartOut {
  const body = kit.body({ build, height: 0.5, shape: "average" }), avatar = doc({ body: { build, height: 0.5, shape: "average" } });
  return p.draw({ avatar, body, skin: "#DCA27A", hair: "#2E2019", colors: (p.defaults ?? []).map(c => kit.color(c)), pattern, inks: [], side: p.sides?.default ?? null, garment: { id, ...(pattern ? { pattern } : {}) }, kit, clip: null, clipBack: null });
}
/** How many printed shapes (tiles, clipped prints) and striped strips a view of a part's output has. */
const printsOf = (out: PartOut, view: ViewName) => (out[view] ?? []).reduce((n, it) => n + (it.strip?.stripes ? 1 : 0) + (it.group?.shapes.filter(s => s.tile || s.clip).length ?? 0), 0);
/** How much cloth of the ground colour a view of a part's output shows (cm², a strip counts as a sleeve). */
const groundOf = (out: PartOut, view: ViewName, ground: string) => (out[view] ?? []).reduce((n, it) => {
  if (it.strip) return n + (it.strip.color === ground ? 100 : 0);
  return n + (it.group?.shapes ?? []).filter(s => s.fill === ground && !s.flat).reduce((m, s) => { const [x0, y0, x1, y1] = s.path.bounds(); return m + (x1 - x0) * (y1 - y0); }, 0);
}, 0);

test("a part that takes a pattern prints it on every piece of its cloth, front and back, on every build", () => {
  for (const [id, p] of Object.entries(kit.parts)) for (const pat of p.patterns ?? []) for (const build of BUILDS) {
    if (p.builds && !p.builds.includes(build)) continue;
    const plain = draws(p, id, null, build), withPat = draws(p, id, pat, build), ground = kit.color(p.defaults?.[0]);
    for (const view of ["front", "back"] as const) {
      // a view that shows the part's cloth (more than a tie or a strap of it) carries the print
      if (groundOf(plain, view, ground) <= 30) continue;
      assert.ok(printsOf(withPat, view) > printsOf(plain, view), `${id} with ${pat} on ${build}, ${view}: printed (add ...printed(ctx, groundPath, { hem }) after each ground shape)`);
    }
    // a print that reaches limbs reaches every sleeve and leg of the part's cloth
    if (PATTERNS[pat].strips === "stripes") for (const view of ["front", "back"] as const) {
      const cloth = (plain[view] ?? []).filter(it => it.strip?.color === ground).length, striped = (withPat[view] ?? []).filter(it => it.strip?.stripes).length;
      assert.ok(striped >= cloth, `${id} with ${pat} on ${build}, ${view}: ${cloth} sleeves or legs, ${striped} striped (spread stripPrint(ctx) into each)`);
    }
  }
});

// ---- the head --------------------------------------------------------------------------------------

/** A path's outline as a dense polygon (its curves sampled), and an even-odd point-in-polygon test. */
function polygon(path: Path): Vec2[] {
  const out: Vec2[] = [];
  let x = 0, y = 0;
  for (const c of path.cmds) {
    if (c[0] === "M" || c[0] === "L") { x = c[1]; y = c[2]; out.push([x, y]); }
    else if (c[0] === "C") {
      for (let i = 1; i <= 16; i++) { const t = i / 16, u = 1 - t; out.push([u * u * u * x + 3 * u * u * t * c[1] + 3 * u * t * t * c[3] + t * t * t * c[5], u * u * u * y + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6]]); }
      x = c[5]; y = c[6];
    }
  }
  return out;
}
function inside(poly: Vec2[], [px, py]: Vec2): boolean {
  let r = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) r = !r;
  }
  return r;
}

test("every face shape is its own outline, and a crown, an inset and a band follow it", () => {
  const W = 44, H = 50, outlines = HEAD_SHAPES.map(s => headPath(s, W, H).toD());
  assert.equal(new Set(outlines).size, HEAD_SHAPES.length);
  assert.deepEqual(kit.features["face.shape"].values, HEAD_SHAPES);
  const cy = -H * 0.6, R = (p: Vec2) => Math.hypot(p[0], p[1] - cy);
  for (const shape of HEAD_SHAPES) {
    const [x0, y0, x1, y1] = headPath(shape, W, H).bounds(), poly = polygon(headPath(shape, W, H));
    for (const v of [0, 0.5, 2.6, 4.2, 9]) {
      const arc = headArc(W, H, v, Math.PI * 0.9, Math.PI * 2.1, 40), crown = headCrown(shape, W, H, v, Math.PI * 0.9, Math.PI * 2.1, 40), m = Math.min(0.3, v);
      for (const [i, p] of crown.entries()) {
        const e = arc[i];
        assert.ok(p.every(Number.isFinite), `${shape}: finite`);
        // the crown ellipse, pushed out along its own ray, never in
        assert.ok(R(p) >= R(e) - 1e-9 && Math.abs(Math.atan2(p[1] - cy, p[0]) - Math.atan2(e[1] - cy, e[0])) < 1e-9, `${shape} v ${v}: on the ellipse's ray, not inside it`);
        // and the head's outline (with its rim) stays under it: a point m - 0.02 cm further in is still outside the head
        const k = (R(p) - (m - 0.02)) / R(p), q: Vec2 = [p[0] * k, cy + (p[1] - cy) * k];
        if (q[1] < -H * 0.42) assert.ok(!inside(poly, q), `${shape} v ${v}: the head's corner shows past the crown at ${p.map(n => n.toFixed(1))}`);
      }
    }
    if (shape !== "long") for (const p of headCrown(shape, W, H, 0)) assert.ok(p[0] >= x0 - 1 && p[0] <= x1 + 1 && p[1] >= y0 - 1 && p[1] <= y1 + 1, `${shape}: a crown of no bulk hugs the head`);
    const [ix0, iy0, ix1] = insetHead(shape, W, H, 2).bounds();
    assert.ok(ix0 > x0 && ix1 < x1 && iy0 > y0, `${shape}: an inset lies inside`);
  }
  // on an oval or a round head a style keeps the shape it was drawn with: the ellipse itself
  assert.deepEqual(headCrown("oval", W, H, 3, Math.PI * 0.92, Math.PI * 2.08, 10), headArc(W, H, 3, Math.PI * 0.92, Math.PI * 2.08, 10));
  assert.deepEqual(headCrown("round", W, H, 3.4, Math.PI * 0.92, Math.PI * 2.08, 10), headArc(W, H, 3.4, Math.PI * 0.92, Math.PI * 2.08, 10));
  const b = kit.body({ build: "adult", height: 0.5, shape: "average" }), band = { centre: 0.72, side: 0.62, back: 0.58 };
  assert.ok(belowBand(b, band, "front").bounds()[1] < belowBand(b, band, "back").bounds()[1], "a cap's band is lower at the back");
  const h = head(b, "diamond", "large");
  assert.equal(h.k, b.headH / 50); assert.deepEqual(h.eye(1), [b.headW * 0.205, -b.headH * 0.43]); assert.equal(h.y("brow"), -b.headH * 0.52);
});

test("ears: every value is drawn differently by the base, and their anchors move with them", () => {
  const b = kit.body({ build: "adult", height: 0.5, shape: "average" });
  assert.deepEqual(kit.features["face.ears"].values, EAR_SHAPES);
  const drawn = EAR_SHAPES.map(e => JSON.stringify(earGroup(b, "#DCA27A", 1, e).shapes.map(s => s.path.toD())));
  assert.equal(new Set(drawn).size, EAR_SHAPES.length);
  const lobes = EAR_SHAPES.map(e => earAt(b.headW, b.headH, 1, e).lobe[1]);
  assert.ok(new Set(lobes).size >= 3, "the lobe moves with the ear's size");
  for (const e of EAR_SHAPES) for (const side of [1, -1] as const) {
    const a = earAt(b.headW, b.headH, side, e);
    assert.ok([a.c, a.top, a.lobe, a.back].flat().every(Number.isFinite));
    assert.ok(Math.sign(a.back[0]) === side && Math.abs(a.back[0]) > Math.abs(a.c[0]), `${e}: the back of the ear is away from the face`);
    assert.ok(a.lobe[1] > a.top[1], "the lobe is below the top");
  }
  // the base draws the document's ears
  const ears = (e: string) => JSON.stringify(compose(doc({ face: { ears: e } }), kit).views.front.filter(i => i.layer === "ear").map(i => i.group!.shapes[0].path.toD()));
  assert.notEqual(ears("large"), ears("round"));
});

test("the face draws only what the still backend records, for every value of every face field", () => {
  const F = kit.features, base: AvatarDoc = { ...kit.defaultDoc };
  const docs: AvatarDoc[] = [];
  for (const f of ["face.shape", "face.eyes", "face.eyeColor", "face.brows", "face.nose", "face.mouth", "face.ears"] as const) for (const v of F[f].values) docs.push({ ...base, face: { [f.slice(5)]: v } });
  for (const m of F["face.marks"].values) docs.push({ ...base, face: { marks: [m] } });
  for (const s of F.facialHair.values) docs.push({ ...base, facialHair: { style: s } });
  for (const d of docs) for (const emo of [undefined, "laugh", "sad"]) {
    const ctx = new SvgContext("t");
    drawFace(ctx as unknown as CanvasRenderingContext2D, faceStyle(d, kit), emo ? faceFrom(kit.face.emotions[emo]) : NEUTRAL_FACE, [-30, -45, 30, 3]);
    assert.ok(ctx.done().length > 200);
  }
  // marks: up to four count, identity marks (free) do not
  assert.equal(F["face.marks"].max, 4);
  // dyed hair keeps natural brows
  const dyed = faceStyle({ ...base, hair: { style: "hair_bob", color: "hair_21" } }, kit), natural = faceStyle({ ...base, hair: { style: "hair_bob", color: "hair_02" } }, kit);
  assert.equal(dyed.browColor, natural.browColor);
  // a long beard hangs below the chin, in front only
  const p = compose(doc({ facialHair: { style: "beard_long" } }), kit);
  assert.equal(p.views.front.filter(i => i.layer === "hair_front" && i.bone === "head").length, 2, "the hair and the beard");
  assert.equal(p.views.back.filter(i => i.layer === "hair_front" && i.bone === "head").length, 0, "nor from behind");
});

// ---- hands and holding ---------------------------------------------------------------------------------

test("a ring has a place on every hand shape it shows on, and a hand's outline is closed", () => {
  for (const build of BUILDS) {
    const b = kit.body({ build, height: 0.5, shape: "average" });
    for (const shape of HAND_SHAPES) for (const side of [1, -1] as const) {
      const r = ringAt(b, side, shape);
      if (r) { assert.ok([...r.c, r.dir, r.r].every(Number.isFinite)); assert.ok(Math.abs(r.c[0]) < b.armW[2] * 1.2 && r.c[1] > 0 && r.c[1] < b.handL * 1.2, `${shape}: on the hand`); }
      assert.ok(handOutline(b, side, shape).finite() && handOutline(b, side, shape).cmds.length > 4);
    }
    assert.equal(ringAt(b, 1, "fist"), null, "a fist hides the ring finger");
    // the hanging hand: about half a metre up for adults, lower for children
    const g = restGrip(b, "l");
    assert.ok(g[0] > 5 && g[1] < 0 && -g[1] < b.H * 0.4, `${build}: the grip ${g.map(n => n.toFixed(1))}`);
  }
});

test("compose: a part that holds something closes its hand, and a hat over a covering lies over it", () => {
  const k: Kit = {
    ...kit, parts: {
      ...kit.parts,
      cane_test: { slot: "hold", names: { en: "Cane", tr: "baston" }, sides: { allowed: ["l", "r"], default: "r" }, draw: ctx => {
        const hand = ctx.side === "l" ? "l" : "r", g = { shapes: [{ path: rect(-1, 0, 2, 60), fill: "#26272C" }] };
        return { front: [{ layer: "over_sleeve", bone: `hand_${hand}`, group: g, hold: hand }], back: [{ layer: "over_sleeve", bone: `hand_${hand}`, group: g, hold: hand }], alt: { [`hand_${hand}`]: "hold" } };
      } },
      cap_test: { slot: "hat", names: { en: "Cap", tr: "kep" }, draw: () => ({ front: [{ layer: "headwear", bone: "head", group: { shapes: [{ path: rect(-5, -60, 10, 5), fill: "#112233" }] } }], back: [] }) },
    },
  };
  const p = compose(doc({ hold: { id: "cane_test", side: "l" }, wear: { head: { id: "headscarf_wrap" }, hat: { id: "cap_test" } } }), k);
  const def = (key: string) => p.views.front.filter(i => i.alt?.key === key && i.alt.default).map(i => i.alt!.value);
  assert.deepEqual(def("hand_l"), ["hold"]); assert.deepEqual(def("hand_r"), ["relaxed"]);
  const wear = p.views.front.filter(i => i.layer === "headwear").map(i => i.group!.shapes[0].fill);
  assert.deepEqual(wear.slice(-1), ["#112233"], "the hat is drawn after the scarf");
  assert.equal(p.avatar.hold?.side, "l");
});

test("CATALOGUE.md is current (node packages/sahne-kit/catalogue/build.ts)", async () => {
  const { check } = await import("../catalogue/build.ts");
  assert.deepEqual(check(), []);
});

test("the starter set: a few per field, identity whole, faith and access always in it, only from the curation file", () => {
  const b = createBuilder(kit, kit.defaultDoc, { offer: starterOffer });
  for (const g of GARMENT_FIELDS) {
    const all = Object.entries(kit.parts).filter(([, p]) => p.slot === g.slot).map(([id]) => id), offered = all.filter(id => starterOffer(g.field, id, "option"));
    if (all.some(id => CURATION[id]?.starter)) assert.ok(offered.length >= 1 && offered.length <= 7, `${g.field}: ${offered.length} at first`);
    for (const id of offered) assert.ok(kit.parts[id].tags?.includes("cast") !== true, `${id}: never a cast part`);
  }
  for (const id of ["headscarf_wrap", "cap_kippah", "cap_taqiyah", "turban_dastar", "cane_white", "bottom_skirt_long", "dress_modest_long"]) assert.ok(starterOffer(GARMENT_FIELDS.find(g => g.slot === kit.parts[id].slot)!.field, id, "option"), `${id}: in the starter set`);
  for (const name of ["skin", "hair", "eyes"] as const) for (const id of Object.keys(PALETTES[name])) assert.ok(starterOffer("skin", id, "color"), `${id}: identity colours are whole`);
  assert.ok(Object.keys(PALETTES.fabric).filter(id => starterOffer("outfit.top", id, "color")).length >= 8);
  assert.ok(b.options("hair.style").length < Object.values(kit.parts).filter(p => p.slot === "hair").length, "fewer hair styles at first");
  assert.equal(b.options("face.shape").length, kit.features["face.shape"].values.length, "a field with no starter entry offers everything");
});
