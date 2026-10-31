// The set kit's families (src/set/): each id in one family, the generated index current, and an app
// loading only the families its places use.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import kit from "../src/index.ts";
import { FAMILY_MODULES, SET, PROPS } from "../src/set/all.ts";
import { FAMILIES, SET_FAMILY, PROP_FAMILY, familiesOf, loadSet, withSet, type PlaceLike } from "../src/set/index.ts";
import { fresh, plan } from "../set/build.ts";
import { PLACES } from "../../sahne-story/paths.ts";

const place = (id: string): PlaceLike => JSON.parse(readFileSync(new URL(`${id}.json`, PLACES), "utf8"));

test("the family index is current (node packages/sahne-kit/set/build.ts)", () => assert.ok(fresh()));

test("every family is listed in both index.ts and all.ts, and has a file", () => {
  const files = readdirSync(new URL("../src/set/", import.meta.url)).filter(f => f.endsWith(".ts") && !["all.ts", "draw.ts", "index.ts", "families.gen.ts", "people.ts"].includes(f)).map(f => f.slice(0, -3)).sort();
  assert.deepEqual(Object.keys(FAMILIES).sort(), files);
  assert.deepEqual(Object.keys(FAMILY_MODULES).sort(), files);
});

test("each id is in exactly one family, and the index points at it", () => {
  for (const [kind, all, index] of [["set", SET, SET_FAMILY], ["props", PROPS, PROP_FAMILY]] as const) {
    assert.deepEqual(Object.keys(index).sort(), Object.keys(all).sort(), kind);
    for (const [id, fam] of Object.entries(index)) assert.equal(FAMILY_MODULES[fam][kind][id], all[id], `${kind} ${id}`);
  }
});

test("the kit itself carries no set: the families come with loadSet", () => {
  assert.deepEqual(Object.keys(kit.set), []);
  assert.deepEqual(Object.keys(kit.props), []);
});

test("a place loads only the families it uses, once each", async () => {
  const bakkal = ["base", "cookware", "food", "misc", "paper", "produce", "props", "street", "streetlife"];
  assert.deepEqual(familiesOf([place("bakkal")]), bakkal);
  assert.deepEqual(familiesOf([place("metro_m11")]), ["airport", "metro", "outdoor", "stationery", "tech"], "the plane seen from the car is the airport's; the seated passengers are the outdoor family's crowd");
  const a = await loadSet([place("bakkal")]);
  assert.deepEqual(a.families, bakkal);
  const k = withSet(kit, a);
  for (const p of place("bakkal").pieces!) assert.ok(k.set[p.kit], p.kit);
  for (const p of Object.values(place("bakkal").props!)) assert.ok(k.props[p.kit], p.kit);
  assert.equal(k.set.metro_wall, undefined);
  assert.equal((await loadSet(["base"])).set.wall, a.set.wall);
  const all = await loadSet("all");
  assert.deepEqual(Object.keys(all.set).sort(), Object.keys(SET).sort());
  await assert.rejects(loadSet(["nope"]), /no set family nope/);
});

test("an id the set does not have is left to the place lint", () => {
  assert.deepEqual(familiesOf([{ pieces: [{ kit: "no_such_piece" }], props: { x: { kit: "nor_this" } } }]), []);
});

test("the plan: what is planned is not drawn yet, and a built generator's planned variants are still to draw", () => {
  const FAMILIES_PLANNED = ["base", "airport", "metro", "props", "street", "interior", "furniture", "outdoor", "vehicles", "food", "paper", "misc"];
  for (const [id, p] of Object.entries(plan())) {
    assert.ok(FAMILIES_PLANNED.includes(p.family), `${id}: family ${p.family}`);
    assert.match(p.step, /^2[bcd]\.\d+$/, id);
    const def = SET[id] ?? PROPS[id];
    if (p.built) {
      assert.ok(def, `${id} is marked built but is not in the set`);
      for (const v of p.variants) assert.ok(!Object.hasOwn(def.variants ?? {}, v), `${id}.${v} is drawn: take it out of the plan`);
    } else assert.equal(def, undefined, `${id} is drawn: take it out of the plan`);
  }
});

test("animals answer people (FlatReact): pigeons rest and fly off each way, a sitting cat turns its head and slinks off, mirrored with it", async () => {
  const { rng } = await import("sahne");
  const draw = (id: string, p: Record<string, unknown>) => SET[id].draw(p, rng("t"), kit).flats;
  const pigeons = draw("birds", { kind: "pigeons", n: 2 });
  assert.equal(pigeons.filter(f => f.react?.show === "rest").length, 2);
  assert.deepEqual(pigeons.filter(f => f.react?.show === "away").map(f => f.react?.face).sort(), [-1, -1, -1, -1, 1, 1, 1, 1], "two wingbeats each way, per pigeon");
  assert.ok(pigeons.every(f => f.react?.flee && f.react.flee.lift! > 0));
  const cat = draw("cat", { pose: "sit" }), head = cat.find(f => f.react?.look);
  assert.ok(head && head.react!.show === "rest" && head.react!.look!.turn < 0, "its head turns up, at rest");
  assert.ok(cat.some(f => f.react?.show === "away" && f.react.face === 1) && cat.some(f => f.react?.show === "away" && f.react.face === -1));
  const left = draw("cat", { pose: "sit", dir: -1 }).find(f => f.react?.look)!;
  assert.deepEqual([left.react!.look!.turn, left.react!.look!.pivot[0]], [-head.react!.look!.turn, -head.react!.look!.pivot[0]], "facing left, the turn and pivot mirror");
  assert.ok(!draw("cat", { pose: "sit", react: false }).some(f => f.react) && !draw("cat", { pose: "sleep" }).some(f => f.react), "react: false, or asleep: none");
  // one animal's flats share its home and its tap: a pigeon flutters ("pır pır"), the cat looks up and miaows
  const homes = (fl: typeof cat) => new Set(fl.filter(f => f.react).map(f => JSON.stringify(f.react!.home)));
  assert.equal(homes(cat).size, 1);
  assert.equal(homes(pigeons).size, 2);
  assert.ok(pigeons.every(f => f.react?.tap?.do === "hop" && f.react.tap.sound === "wing_flap" && f.pick !== false), "pigeons answer taps");
  assert.ok(cat.filter(f => f.react).every(f => f.react!.tap?.do === "look" && f.react!.tap.sound === "meow"));
  assert.ok(SET.cat.draw({}, rng("t"), kit).flats.length > 0 && kit.sounds?.wing_flap && kit.sounds?.meow, "the sounds are the kit's");
});

test("a resting dog answers a tap, all of it: it looks up and barks; asleep, it wakes (eyes shut while down, open while up)", async () => {
  const { rng } = await import("sahne");
  const draw = (p: Record<string, unknown>) => SET.dog.draw(p, rng("t"), kit).flats;
  for (const pose of ["sit", "stand", "lie", "sleep"]) {
    const fl = draw({ pose });
    assert.ok(fl.every(f => f.react?.tap?.do === "look" && f.react.tap.sound === "bark"), `${pose}: every flat looks up and barks`);
    assert.equal(new Set(fl.map(f => JSON.stringify(f.react!.home))).size, 1, `${pose}: one home`);
  }
  for (const pose of ["sit", "stand", "lie"]) assert.equal(draw({ pose }).filter(f => f.react?.look && f.react.look.r > 0).length, 1, `${pose}: one head turns to a passer-by`);
  const heads = draw({ pose: "sleep" }).filter(f => f.react?.look);
  assert.deepEqual(heads.map(f => f.react!.show).sort(), ["asleep", "awake"]);
  assert.ok(heads.every(f => f.react!.look!.r === 0 && f.react!.look!.turn < 0), "only a tap lifts a sleeper's head");
  const right = heads.find(f => f.react!.show === "awake")!, left = draw({ pose: "sleep", dir: -1 }).find(f => f.react?.show === "awake")!;
  assert.deepEqual([left.react!.look!.turn, left.react!.look!.pivot[0]], [-right.react!.look!.turn, -right.react!.look!.pivot[0]], "facing left, the turn and pivot mirror");
  for (const p of [{ pose: "walk" }, { pose: "sit", react: false }, { pose: "sleep", react: false }, { held: true }]) assert.ok(!draw(p).some(f => f.react), `${JSON.stringify(p)}: no reaction`);
  assert.ok(kit.sounds?.bark, "the bark is the kit's");
});

test("desks and tables are solid along their front and sides, open behind where the chair goes; a held table is not", () => {
  const { desk, table } = SET;
  assert.deepEqual(desk.solid!({ kind: "office", w: 160 }), [
    { a: [-80, -37.5], b: [-80, 0] }, { a: [-80, 0], b: [80, 0] }, { a: [80, 0], b: [80, -37.5] },
  ]);
  const two = table.solid!({ kind: "cafe", n: 2, gap: 100 });
  assert.equal(two.length, 6);
  assert.deepEqual(two[1], { a: [-81, 0], b: [-19, 0] });
  assert.ok(two.every(l => l.a[1] > -31.1 && l.b[1] > -31.1), "no line along the back");
  assert.deepEqual(table.solid!({ held: true }), []);
  assert.equal(desk.solid!({ kind: "school", n: 3, gap: 130 }).length, 9, "a row of desks: a footprint each");
});

test("the simit cart: a case that fills with simits, words only when asked, inside the atlas", async () => {
  const { rng, cellSize, fitsAtlas } = await import("sahne");
  const cart = SET.simit_cart, draw = (p: Record<string, unknown>) => cart.draw(p, rng("cart"), kit).flats[0];
  assert.ok(draw({ fill: 1 }).group.shapes.length > draw({ fill: 0 }).group.shapes.length + 20);
  assert.equal(draw({}).text, undefined);
  assert.equal(draw({ label: "SİMİT" }).text?.[0].text, "SİMİT");
  const f = draw({ w: 200 }), { w, h } = cellSize(f.group, f.ppcm!);
  assert.ok(fitsAtlas(w, h), `${w}×${h}`);
});
