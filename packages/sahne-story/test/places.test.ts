// The place lint (src/lint-place.ts) and the story's `place` rule: a place built to the standard
// passes, each rule catches its own break, a placeholder only warns, and every place document in
// places/ has no errors. The made-up places read a small card index of their own (fixtures/cards.json); the place
// documents are checked against the content root's cards when it has them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import full from "../../sahne-kit/src/full.ts";
import { withDrawings } from "../../sahne-kit/src/drawing.ts";
import { placeSolids } from "sahne";
import { loadCards, loadContentKit } from "../load.ts";
import { loadNeeds } from "../load.ts";
import { PLACES } from "../paths.ts";
import { lintPlace, lintStory, type CardIndex, type Needs, type PlaceRule, type StoryDoc, type StoryPlace } from "../src/index.ts";

const kit = full; // the kit as it is; the content root's own drawings are added only where a root's places are read
const cards: CardIndex = JSON.parse(readFileSync(new URL("./fixtures/cards.json", import.meta.url), "utf8"));
const needs: Needs = {
  dukkan: { stories: ["s1e99"], places: { dukkan: { why: "a test shop", stories: ["s1e99"], times: ["day", "night"],
    marks: { door: { stories: ["s1e99"], door: true }, counter: { stories: ["s1e99"] }, ledge: { stories: ["s1e99"], perch: true } },
    props: { ekmek: { kit: "bread", terms: ["a1-w-ekmek"], stories: ["s1e99"] }, clock: { kit: "clock", terms: ["a1-w-saat"], stories: ["s1e99"] } } } } },
};

/** A small shop built to the standard: every rule passes. */
const good = (): StoryPlace => ({
  v: 1, id: "dukkan", name: { tr: "Dükkân", en: "Shop", fa: "مغازه" }, district: "Feriköy", size: { w: 8, d: 4 },
  pieces: [
    { kit: "street", x: 0, z: -9 },
    { kit: "wall", x: 0, z: -2.2, w: 1000, h: 400, openings: [{ x: -300, y: 0, w: 105, h: 220 }] },
    { kit: "floor", x: 0, z: -0.2, w: 1000, d: 450 },
    { kit: "door_shop", id: "door", x: -3, z: -2.19, terms: ["a1-w-kapi"] },
    { kit: "window", x: 0, y: 1.1, z: -2.18 },
    { kit: "shelf", x: 2.3, z: -2.05 },
    { kit: "shelf", x: -1.4, z: -2.05, w: 160 },
    { kit: "counter", x: 0.5, z: -0.35 },
    { kit: "fridge", x: -2.2, z: -2 },
    { kit: "lamp", x: 0.4, y: 2.3, z: -0.95 },
    { kit: "clock", id: "clock", x: -3.5, y: 2.2, z: -2.15, terms: ["a1-w-saat"] },
    { kit: "picture", x: 1, y: 1.6, z: -2.17 },
    { kit: "calendar", x: 1.6, y: 1.5, z: -2.17 },
    { kit: "plant", x: 3.6, z: 0.9 },
  ],
  marks: {
    door: { x: -3, z: -1.2, door: "door", out: { x: -3, z: -3 } },
    counter: { x: 0.6, z: -0.8, facing: "l" },
    ledge: { x: 2.3, y: 2.4, z: -2.05 },
  },
  props: {
    ekmek: { kit: "bread", at: { x: 0.2, y: 0.9, z: -0.4 }, n: 3, terms: ["a1-w-ekmek"] },
    sut: { kit: "milk", at: { x: -2.3, y: 1, z: -2 }, terms: ["a1-w-sut"] },
    telefon: { kit: "phone", at: { x: 0.9, y: 0.9, z: -0.4 }, terms: ["a1-w-telefon"] },
    simit: { kit: "simit_tray", at: { x: 1.2, y: 0.9, z: -0.4 }, decor: true },
  },
  times: ["day", "night"], perch: "ledge", camera: { wide: { x: 0, w: 8, z: -2.1 } },
  ambience: ["street_far", "fridge_hum"], motif: "street", surface: "tile",
});
const lint = (doc: StoryPlace) => lintPlace(doc, { kit, cards, needs });
const rules = (doc: StoryPlace) => [...new Set(lint(doc).filter(p => p.level === "error").map(p => p.rule))].sort();
const broken = (rule: PlaceRule, f: (d: StoryPlace) => void) => { const d = good(); f(d); assert.deepEqual(rules(d), [rule], `${rule}: ${JSON.stringify(lint(d))}`); };

test("a kit id a promoted item replaced (kit.aliases) still stands in a place, as a piece and as a prop", () => {
  const aliased = { ...kit, aliases: { ...kit.aliases, x_old_plant: "plant", x_old_simit: "simit_tray" } };
  const d = good();
  d.pieces = d.pieces.map(p => (p.kit === "plant" ? { ...p, kit: "x_old_plant" } : p));
  d.props!.simit = { ...d.props!.simit, kit: "x_old_simit" };
  assert.deepEqual(lintPlace(d, { kit: aliased, cards, needs }), []);
  assert.ok(lintPlace(d, { kit, cards, needs }).some(p => /x_old_plant is not in the kit/.test(p.message)), "without the alias the id is unknown");
  // the kit's own entry wins over an alias of the same id (a content drawing is used while it is there)
  const own = { ...aliased, props: { ...aliased.props, x_old_simit: aliased.props.bread } };
  assert.deepEqual(lintPlace(d, { kit: own, cards, needs }).filter(p => p.level === "error" && /x_old_simit/.test(p.message)), []);
});

test("a place built to the standard passes every rule", () => {
  assert.deepEqual(lint(good()), []);
});

test("each rule catches its own break", () => {
  broken("valid", d => { delete (d.name as Partial<StoryPlace["name"]>).fa; });
  broken("valid", d => { d.marks.ledge.y = 0; });
  broken("valid", d => { d.marks.door.door = "gate"; });
  broken("valid", d => { d.marks.counter.x = 6; });
  broken("valid", d => { d.pieces.push({ kit: "spaceship", x: 0, z: -1 }); });
  broken("needs", d => { d.marks.till = d.marks.counter; delete (d.marks as Record<string, unknown>).counter; });
  broken("depth", d => { d.pieces = d.pieces.filter(p => p.kit !== "plant"); });
  broken("density", d => { delete d.props!.simit; });
  broken("explore", d => { d.props!.sut.terms = ["a1-w-taksi"]; });
  broken("light", d => { d.pieces = d.pieces.filter(p => p.kit !== "lamp"); });
  broken("sound", d => { d.motif = "opera"; });
  broken("budget", d => { d.name.en = "x".repeat(6000); });
});

test("crowds keep clear of the marks people stand on, and there are not too many of them (warnings)", () => {
  const crowdWarnings = (d: StoryPlace) => lint(d).filter(p => p.rule === "crowd").map(p => `${p.level}: ${p.message}`);
  const d = good();
  d.pieces.push({ kit: "crowd", variant: "walk", x: 0, z: -2.6, x0: -400, x1: 400, n: 6 }, { kit: "crowd", variant: "far", x: 0, z: -8, n: 24 });
  assert.deepEqual(crowdWarnings(d), [], "a lane behind the marks, and a far strip, are fine");
  d.pieces.push({ kit: "crowd", variant: "walk", x: 0, z: -0.6, x0: -400, x1: 400, n: 24 }, { kit: "crowd", variant: "stand", x: 3, z: -2, x0: 0, x1: 200, n: 18 });
  const w = crowdWarnings(d);
  assert.ok(w.some(m => /walk crowd at z -0.6 passes within 0.6 m of mark/.test(m)) && w.some(m => /48 crowd people/.test(m)) && w.every(m => m.startsWith("warning")), w.join("\n"));
});

test("a placeholder only warns, and a place of a split site needs its site", () => {
  const d = good();
  d.placeholder = "drawn later";
  d.pieces = d.pieces.slice(0, 3);
  assert.ok(lint(d).length > 0 && lint(d).every(p => p.level === "warning"));
  const split: Needs = { metro: { stories: ["s1e01"], places: { metro_m11: { why: "", stories: ["s1e01"] } } } };
  const m = { ...good(), id: "metro_m11" };
  assert.ok(lintPlace(m, { kit, cards, needs: split }).some(p => p.rule === "valid" && /site: "metro"/.test(p.message)));
  assert.ok(!lintPlace({ ...m, site: "metro" }, { kit, cards, needs: split }).some(p => /site/.test(p.message)));
});

test("the story's place rule: unknown places, marks, perches and times are errors", () => {
  const story = { id: "s1e99", title: "t", place: "dukkan", cast: ["nima"], steps: [
    { scene: "dukkan", at: { nima: "till" }, kerim: "roof", time: "dusk" },
    { who: "nima", tr: "Merhaba!", move: { who: "nima", to: "back" } },
    { scene: "nowhere" },
  ] } as unknown as StoryDoc;
  const msgs = lintStory(story, { places: { dukkan: good() } }).filter(p => p.rule === "place").map(p => p.message);
  for (const re of [/stands on till/, /perches on roof/, /time dusk/, /moves to back/, /nowhere, which is no place/]) assert.ok(msgs.some(m => re.test(m)), `${re}: ${msgs}`);
});

test("every place document has no errors", () => {
  const real = loadNeeds(), index = loadCards(), rootKit = withDrawings(full, loadContentKit({ kit: full }).docs); // a place may use the root's own kit items
  for (const f of readdirSync(PLACES).filter(f => f.endsWith(".json") && f !== "needs.json")) {
    const doc: StoryPlace = JSON.parse(readFileSync(new URL(f, PLACES), "utf8"));
    assert.deepEqual(lintPlace(doc, { kit: rootKit, cards: index, needs: real }).filter(p => p.level === "error"), [], f);
  }
});

test("states: the place lint checks what `in` names, one default per group, the perch in every state, two pieces a state", () => {
  const d = good();
  d.states = { open: { group: "shutter", default: true }, closed: { group: "shutter", default: true } };
  d.pieces.push({ kit: "shelf", x: 1, z: -2, in: ["closed"] }, { kit: "shelf", x: -1, z: -2, in: ["gone"] });
  d.marks.ledge.in = ["open"];
  const msgs = lintPlace(d, { kit, cards, needs }).map(p => `${p.rule}: ${p.message}`);
  for (const re of [/valid: .*state gone/, /valid: 2 default states in group shutter/, /valid: perch ledge is only in state open/, /density: state open has 0 pieces/, /density: state closed has 1 piece of/])
    assert.ok(msgs.some(m => re.test(m)), `${re}: ${msgs.join(" | ")}`);
});

test("states and sites in the story's place rule: unknown states, marks not there in the state, a scene naming a site", () => {
  const shop = { ...good(), states: { open: { group: "shutter", default: true as const }, closed: { group: "shutter" } } };
  shop.marks.till = { x: 0.5, z: -0.6, in: ["open"] };
  const street = { ...good(), id: "dukkan_street", site: "dukkan" };
  const story = { id: "s1e99", title: "t", place: "dukkan", cast: ["nima"], steps: [
    { scene: "dukkan", at: { nima: "till" }, state: "closed" },
    { beat: { env: "state:dusty" } },
    { scene: "dukkan", at: { nima: "door" } },
    { beat: { who: "nima", env: "state:open", move: { who: "nima", to: "till" } } },
    { scene: "dukkan_site" },
  ] } as unknown as StoryDoc;
  const places = { dukkan: shop, dukkan_street: street, dukkan_site2: { ...street, id: "x" } } as unknown as Record<string, StoryPlace>;
  const msgs = lintStory(story, { places }).filter(p => p.rule === "place").map(p => `${p.step}: ${p.message}`);
  assert.ok(msgs.some(m => /^0: nima stands on till, which is not there in dukkan's closed state/.test(m)), msgs.join(" | "));
  assert.ok(msgs.some(m => /^1: state dusty/.test(m)), msgs.join(" | "));
  assert.ok(!msgs.some(m => /^3:/.test(m)), "after state:open the till is there");
  const site = lintStory({ ...story, steps: [{ scene: "dukkan" } as never, { scene: "nima" } as never] }, { places: { dukkan: shop, nima_a: { ...street, id: "nima_a", site: "nima" } } as unknown as Record<string, StoryPlace> });
  assert.ok(site.some(p => /nima, a site: name one of its places \(nima_a\)/.test(p.message)));
});

test("obj go in the story's place rule: its marks must be there", () => {
  const story = { id: "s1e99", title: "t", place: "dukkan", cast: ["nima"], steps: [
    { scene: "dukkan", at: { nima: "door" } },
    { beat: { obj: [{ id: "ekmek", op: "go", via: ["counter"], to: "roof" }] } },
  ] } as unknown as StoryDoc;
  const msgs = lintStory(story, { places: { dukkan: good() } }).filter(p => p.rule === "place").map(p => p.message);
  assert.deepEqual(msgs, ["obj ekmek goes to roof, which dukkan lacks"]);
});

test("a piece's or prop's params are checked against its generator's meta: a value it doesn't take is an error, a param it doesn't read a warning", () => {
  const d = good();
  d.pieces.push({ kit: "chair", x: 1, z: -1, kind: "throne" });
  assert.deepEqual(rules(d), ["valid"]);
  assert.match(lint(d).find(p => p.level === "error")!.message, /chair: kind: "throne" is not a enum \(.*school/);
  const e = good();
  e.pieces.push({ kit: "chair", x: 1, z: -1, colour: "fab_03" });
  e.props!.sut.hot = "yes";
  const ps = lint(e);
  assert.deepEqual(rules(e), [], JSON.stringify(ps));
  assert.ok(ps.some(p => p.level === "warning" && /chair: param colour is not one it reads/.test(p.message)));
  assert.ok(ps.some(p => p.level === "warning" && /prop sut: param hot is not one it reads/.test(p.message)));
});

test("Kerim's perch and air marks lie within the wide shot's height band (a warning)", () => {
  const d = good();
  d.marks.ledge = { x: 2.3, y: 3.2, z: -2.05 };
  assert.ok(lint(d).some(p => p.rule === "valid" && p.level === "warning" && /perch ledge at 3.2 m is above/.test(p.message)));
  d.camera = { wide: { ...d.camera!.wide!, y1: 3.4 } };
  assert.ok(!lint(d).some(p => /is above the wide shot/.test(p.message)));
});

test("budget: a flat larger than the atlas is an error, glow and all", () => {
  broken("budget", d => { (d.pieces.find(p => p.kit === "floor") as { w?: number }).w = 3000; });
  const d = good();
  (d.pieces.find(p => p.kit === "floor") as { w?: number }).w = 3000;
  assert.ok(lint(d).some(p => p.rule === "budget" && p.level === "error" && /piece floor: its flat is \d+×\d+ px at 0.7 px\/cm, larger than the 2048 atlas/.test(p.message)));
});

test("reach: people walk to every mark round the solid lines; a mark standing in one is a warning", () => {
  const front = (d: StoryPlace) => { d.marks.customer = { x: 0.4, z: 0.3 }; return d; };
  assert.deepEqual(lint(front(good())), [], "round the counter's end to the front of it");
  broken("reach", d => { front(d); d.pieces.push({ kit: "wall", x: 0, z: -0.1, w: 1200, h: 100 }); });
  const out = good();
  out.marks.pavement = { x: -1, z: -3 };
  assert.deepEqual(lint(out), [], "out through the first door mark's own door to the pavement");
  const d = good();
  d.marks.counter.z = -0.35;
  assert.ok(lint(d).some(p => p.rule === "reach" && p.level === "warning" && /counter stands in a solid line/.test(p.message)));
});

test("the story's route rule: a walk round the counter is a warning, a walk with no way through an error", () => {
  const story = (place: StoryPlace) => lintStory({ id: "s1e99", title: "t", place: "dukkan", cast: ["nima"], steps: [
    { scene: "dukkan", at: { nima: "door" } },
    { who: "nima", tr: "Merhaba!", move: { who: "nima", to: "customer" } },
  ] } as unknown as StoryDoc, { places: { dukkan: { ...place, marks: { ...place.marks, customer: { x: 1, z: 0.3 } } } }, solids: { dukkan: placeSolids(place, kit) } }).filter(p => p.rule === "route");
  const round = story(good());
  assert.ok(round.length === 1 && round[0].level === "warning" && /nima walks round from door to customer/.test(round[0].message), JSON.stringify(round));
  const shut = good();
  (shut.pieces.find(p => p.kit === "counter") as { w?: number }).w = 1200;
  assert.ok(story(shut).some(p => p.level === "error" && /no way from door to customer/.test(p.message)));
});

test("stops: a story stops a vehicle only at its stations after the first, and departs only from a vehicle; the place keeps its pieces' timetable and stations", () => {
  const car = { ...good(), id: "car", life: "run" as const, stops: { stations: ["A", "B", "C"] } };
  const story = { id: "s1e99", title: "t", place: "car", cast: ["nima"], steps: [
    { scene: "car", at: { nima: "till" }, stop: "Z" },
    { beat: { env: "stop:A" } },
    { beat: { env: "stop:C" } },
    { scene: "dukkan", at: { nima: "till" }, stop: "B" },
    { beat: { env: "depart" } },
  ] } as unknown as StoryDoc;
  const msgs = lintStory(story, { places: { car, dukkan: good() } }).filter(p => p.rule === "place").map(p => p.message);
  for (const re of [/stop at Z: car stops at B, C/, /stop at A: car stops at B, C/, /stop at B: dukkan is not a vehicle/, /depart: dukkan is not a vehicle/]) assert.ok(msgs.some(m => re.test(m)), `${re}: ${msgs}`);
  assert.ok(!msgs.some(m => /stop at C/.test(m)), msgs.join(" | "));
  const d = { ...car, pieces: [...car.pieces, { kit: "metro_display", x: 0, z: -1, stations: ["A", "C"], stops: true }, { kit: "metro_wall", x: 0, z: -1.6, stops: { ms: 9000 } }] };
  const pm = lintPlace(d as StoryPlace, { kit, cards, needs }).map(p => `${p.rule}: ${p.message}`);
  for (const re of [/valid: metro_display: its stations are not the place's/, /valid: metro_wall: its timetable's ms 9000 is not the place's 18000/]) assert.ok(pm.some(m => re.test(m)), `${re}: ${pm.join(" | ")}`);
  const loose = lintPlace({ ...d, stops: undefined } as StoryPlace, { kit, cards, needs }).map(p => p.message);
  assert.ok(loose.some(m => /keep a timetable, but the place has no stops/.test(m)), loose.join(" | "));
});

test("a vehicle seen from inside (a cabin piece) fills the actors' and near bands with it and needs 6 pieces, not 12", () => {
  const car = { ...good(), id: "car", pieces: [{ kit: "skyline", variant: "sisli", x: 0, z: -170 }, { kit: "road", variant: "back", x: 0, z: -1.2 }, { kit: "cabin", variant: "taxi_back", x: 0, z: -1.2 }] };
  const msgs = lintPlace(car as StoryPlace, { kit, cards, needs }).map(p => `${p.rule}: ${p.message}`);
  assert.ok(msgs.some(m => /density: 3 pieces; a finished vehicle \(with a cabin\) has at least 6/.test(m)), msgs.join(" | "));
  assert.ok(msgs.some(m => /depth: .*missing backdrop$/.test(m)) && !msgs.some(m => /missing.*(actors|near)/.test(m)), msgs.join(" | "));
});
