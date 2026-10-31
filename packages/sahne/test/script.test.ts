// Tests of the script, the director and the timeline: the pure core that plays a scene.
import { test } from "node:test";
import assert from "node:assert/strict";
import { speechFallback, matchFallback } from "../src/core/lang.ts";
import { directAll, fold, sideOf, type DirectCtx } from "../src/director/direct.ts";
import { evaluate } from "../src/anim/timeline.ts";
import type { GestureDef } from "../src/core/kit.ts";
import type { PlaceDoc } from "../src/core/types.ts";
import type { Cue } from "../src/script/types.ts";
import { propKey } from "../src/script/world.ts";

const g = (dur: number, stroke: number, extra: Partial<GestureDef> = {}): GestureDef => ({ dur, stroke, keys: [{ t: 0 }, { t: stroke, arm: 1 }, { t: dur }], ...extra });
const GESTURES: Record<string, GestureDef> = {
  welcome: g(1000, 400), point: g(1100, 350, { needs: ["target"] }), look: g(900, 300, { needs: ["target"] }),
  shrug: g(900, 400), nod: g(700, 300), take: g(900, 450, { hold: "take" }), give: g(1000, 500, { hold: "give" }), count: g(1000, 400),
};

const SHOP: PlaceDoc = {
  v: 1, id: "shop", size: { w: 8, d: 4 }, pieces: [],
  marks: {
    door: { x: -3.4, z: -1.1, door: "door", out: { x: -3.4, z: -2.9 } },
    customer: { x: -0.4, z: 0.1, facing: "r" }, counter: { x: 0.6, z: -0.95, facing: "l" },
    shelf: { x: 2.3, y: 1.35, z: -1.9 }, clock: { x: -3.5, y: 2.2, z: -2.1 },
  },
  props: {
    ekmek: { kit: "bread", n: 3, at: { x: 0.2, y: 1.02, z: -0.43 } },
    sut: { kit: "milk", at: { x: -2.4, y: 0.97, z: -2.0 } },
  },
};

const ctx: DirectCtx = { places: { shop: SHOP }, gestures: GESTURES, lang: { id: "x", speech: speechFallback, match: matchFallback }, narrator: "kerim" };
const CAST = ["ismail", "nima"];
const CUES: Cue[] = [
  { scene: { place: "shop", at: { ismail: "counter" } } },
  { line: { who: "ismail", text: "Hoş geldiniz! Buyrun.", to: "nima", move: { who: "nima", to: "customer", how: "enter" }, do: "welcome", emo: "happy", sfx: { id: "bell", word: "çın çın" } } },
  { line: { who: "ismail", text: "Ekmek var. Şu ekmek çok taze.", do: "point", at: "obj:ekmek", link: { ekmek: "obj:ekmek" } } },
  { line: { who: "ismail", text: "Ama süt yok.", obj: [{ id: "sut", op: "hide" }], do: "shrug", on: "yok" } },
  { line: { who: "ismail", text: "Buyrun!", obj: [{ id: "ekmek", op: "give", to: "nima", n: 2 }] } },
  { line: { who: "nima", text: "…", voice: "silent", emo: "nervous" } },
  { line: { who: "kerim", text: "Yavaş yavaş…" } },
];

test("fold is deterministic and agrees with playing every cue", () => {
  const a = directAll(CUES, CAST, ctx), b = directAll(CUES, CAST, ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(a.map(p => p.after))), JSON.parse(JSON.stringify(b.map(p => p.after))));
  for (let i = 0; i < CUES.length; i++) assert.deepEqual(fold(CUES, i, CAST, ctx), a[i].after);
});

test("an entrance comes in through the door, and the line waits for it", () => {
  const p = directAll(CUES, CAST, ctx)[1];
  assert.equal(p.before.actors.nima.on, false);
  assert.equal(p.after.actors.nima.on, true);
  assert.deepEqual(p.after.actors.nima.pos, [-0.4, 0, 0.1]);
  const door = p.doors[0];
  assert.ok(door && door.piece === "door");
  assert.ok(evaluate(p, (door.t0 + door.t1) / 2).doors.door > 0.9, "open while she comes through");
  assert.equal(evaluate(p, p.dur).doors.door, 0, "closed at the end");
  const speech = p.tracks.ismail.speech[0];
  assert.ok(speech.t0 > door.t0 + 500, "İsmail greets her once she is inside");
  assert.equal(p.after.shot.kind, "wide", "an entrance keeps the wide shot");
  const end = evaluate(p, p.dur).actors.nima;
  assert.ok(end.yaw > 0.2 && end.yaw < 0.4, "she ends facing İsmail, three-quarters");
  assert.equal(p.bubbles.filter(b => b.kind === "sound").length, 1);
});

test("a point lands on the word that names its target, and the listener's eyes follow", () => {
  const p = directAll(CUES, CAST, ctx)[2];
  const sp = speechFallback("Ekmek var. Şu ekmek çok taze.");
  const second = sp.words.filter(w => w.text.toLowerCase() === "ekmek")[1];
  const gest = p.tracks.ismail.gestures[0], speech = p.tracks.ismail.speech[0];
  assert.equal(gest.id, "point");
  assert.ok(Math.abs(gest.t0 + 350 - (speech.t0 + second.t0)) < 1, "the stroke meets the second ekmek");
  assert.ok(p.tracks.nima.looks.some(l => l.at === "obj:ekmek"), "Nima looks at the bread");
  assert.equal(gest.side, "r", "İsmail points with the arm on the bread's side");
});

test("yok: the milk goes on the shrug and leaves its outline", () => {
  const p = directAll(CUES, CAST, ctx)[3];
  const ev = p.props.find(e => e.id === "sut")!;
  assert.equal(ev.state!.shown, false); assert.equal(ev.state!.ghost, true);
  assert.equal(evaluate(p, ev.t - 1).props.sut.shown, true);
  assert.equal(evaluate(p, ev.t).props.sut.ghost, true);
  assert.ok(p.after.shot.objs.includes("sut"), "the shot includes the fridge");
});

test("give: two of three loaves pass from İsmail's hand to Nima's", () => {
  const p = directAll(CUES, CAST, ctx)[4];
  assert.equal(p.after.props.ekmek.n, 1);
  const held = p.after.props["ekmek#1"];
  assert.equal(held.n, 2);
  assert.equal(held.holder?.actor, "nima");
  assert.equal(p.after.actors.nima.hold[held.holder!.side], "ekmek#1");
  const handover = p.props.filter(e => e.id === "ekmek#1");
  assert.equal(handover[0].state!.holder!.actor, "ismail");
  assert.equal(handover[1].state!.holder!.actor, "nima");
  const give = p.tracks.ismail.gestures.find(x => x.id === "give")!, take = p.tracks.nima.gestures.find(x => x.id === "take")!;
  assert.ok(Math.abs(give.t0 + 500 / give.tempo - (take.t0 + 450 / take.tempo)) < 1, "the two hands meet on one stroke");
  const mid = evaluate(p, handover[1].t - 1), after = evaluate(p, handover[1].t + 1);
  assert.equal(mid.props["ekmek#1"].holder!.actor, "ismail");
  assert.equal(after.props["ekmek#1"].holder!.actor, "nima");
});

test("the … card: no speech, a close-up, and emotions fade two cues later", () => {
  const ps = directAll(CUES, CAST, ctx);
  const p = ps[5];
  assert.equal(p.tracks.nima.speech.length, 0);
  assert.equal(p.bubbles[0].text, "…");
  assert.equal(p.after.shot.kind, "close");
  assert.equal(ps[1].after.actors.ismail.emo, "happy");
  assert.equal(ps[2].after.actors.ismail.emo, "happy");
  assert.equal(ps[3].after.actors.ismail.emo, "neutral", "happy fades at the second cue after");
  assert.equal(ps[6].bubbles[0].kind, "narrator");
});

test("sides follow the paper plane", () => {
  assert.equal(sideOf({ pos: [0, 0, 0], yaw: 0 }, [1, 1, 0]), "l");
  assert.equal(sideOf({ pos: [0, 0, 0], yaw: 0 }, [-1, 1, 0]), "r");
  assert.equal(sideOf({ pos: [0, 0, 0], yaw: Math.PI }, [1, 1, 0]), "r", "from the back the sides swap on screen");
});

// ---- regressions from the 2026-10-09 review ------------------------------------------------

const after = (cues: Cue[]) => directAll([CUES[0], CUES[1], ...cues], CAST, ctx);

test("a beat with a gesture is not a silent line: no bubble, no close-up, no new addressee", () => {
  const ps = after([{ beat: { who: "ismail", do: "nod" } }]), p = ps[2];
  assert.equal(p.bubbles.length, 0);
  assert.equal(p.cams.length, 0, "the camera stays");
  assert.deepEqual(p.after.last, ps[1].after.last);
  assert.ok(p.dur < 1200, `it lasts as long as the nod (${Math.round(p.dur)} ms)`);
});

test("giving what is already in a hand uses that hand and empties it", () => {
  const ps = after([
    { line: { who: "ismail", text: "Buyrun!", obj: [{ id: "ekmek", op: "give", to: "nima", n: 2 }] } },
    { line: { who: "nima", text: "Buyrun!", obj: [{ id: "ekmek", op: "give", to: "ismail" }] } },
  ]);
  const before = ps[2].after.props["ekmek#1"].holder!, p = ps[3];
  const give = p.tracks.nima.gestures.find(g => g.id === "give")!;
  assert.equal(give.side, before.side, "the hand that holds it gives it");
  assert.equal(p.tracks.nima.gestures.filter(g => g.id === "take").length, 0, "no pick-up first");
  assert.deepEqual(p.after.actors.nima.hold, {}, "Nima's hand is empty");
  assert.equal(p.after.props["ekmek#1"].holder!.actor, "ismail");
});

test("a hand-over waits until the giver has walked over", () => {
  const ps = after([{ line: { who: "ismail", text: "Buyrun!", move: { who: "ismail", to: "customer" }, obj: [{ id: "ekmek", op: "give", to: "nima" }] } }]);
  const p = ps[2], walk = p.tracks.ismail.walks[0], hand = p.props.find(e => e.state?.holder?.actor === "nima")!;
  assert.ok(hand.t > walk.t1, `handed over at ${Math.round(hand.t)} after arriving at ${Math.round(walk.t1)}`);
  const turns = p.tracks.ismail.turns.map(t => t.t);
  assert.deepEqual(turns, [...turns].sort((a, b) => a - b), "turns stay in time order");
});

test("one actor's moves in a cue follow each other", () => {
  const p = directAll([CUES[0], { beat: { move: [{ who: "nima", to: "customer", how: "enter" }, { who: "nima", to: "door" }] } }], CAST, ctx)[1];
  const [a, b] = p.tracks.nima.walks;
  assert.ok(b.t0 >= a.t1 - 1e-6, "the second walk starts when the first ends");
  assert.deepEqual(evaluate(p, 10).actors.nima.pos.map(v => +v.toFixed(2)), [-3.4, 0, -2.9].map(v => +v.toFixed(2)), "she starts outside");
});

test("a new scene in the same place keeps what people hold", () => {
  const ps = after([
    { line: { who: "ismail", text: "Buyrun!", obj: [{ id: "ekmek", op: "give", to: "nima", n: 2 }] } },
    { scene: { place: "shop", time: "dusk", at: { ismail: "counter", nima: "customer" } } },
  ]);
  const w = ps[3].after;
  assert.equal(w.props["ekmek#1"].holder!.actor, "nima");
  assert.equal(Object.values(w.actors.nima.hold)[0], "ekmek#1");
});

test("without a language plugin, a line with no words still hides its prop", () => {
  const bare = { ...ctx, lang: { id: "x", speech: speechFallback } };
  assert.doesNotThrow(() => directAll([CUES[0], { line: { who: "ismail", text: "?!", obj: [{ id: "sut", op: "hide" }] } }], CAST, bare));
});

test("the narrator's line keeps its staging, and loop needs a loop range", () => {
  const p = after([{ line: { who: "kerim", text: "Akşam oldu.", env: "time:dusk" } }])[2];
  assert.equal(p.after.time, "dusk");
  assert.equal(p.bubbles[0].kind, "narrator");
  const q = after([{ beat: { who: "ismail", do: "nod", loop: true } }])[2];
  assert.equal(q.tracks.ismail.gestures[0].loop, false, "nod has no loop range");
});

// ---- Sound (DESIGN.md §8) ------------------------------------------------------------------

test("an entrance sounds: the bell from the door, steps as feet land, the door opening and shutting", () => {
  const p = directAll(CUES, CAST, ctx)[1];
  const bell = p.sounds.find(s => s.id === "bell")!;
  assert.equal(bell.at, "mark:door", "the bell comes from the door");
  assert.ok(!bell.auto);
  const steps = p.sounds.filter(s => s.id === "step");
  const walk = p.tracks.nima.walks[0];
  assert.ok(steps.length >= 3, `${steps.length} steps`);
  assert.ok(steps.every(s => s.auto && s.at === "ch:nima" && s.t > walk.t0 && s.t <= walk.t1));
  const gaps = steps.slice(1).map((s, i) => s.t - steps[i].t);
  assert.ok(Math.min(...gaps) > 250, "steps are spaced like steps");
  const door = p.doors[0], open = p.sounds.find(s => s.id === "door_open")!, shut = p.sounds.find(s => s.id === "door_close")!;
  assert.equal(open.t, door.t0);
  assert.ok(shut.t > door.t1 && shut.t < p.dur + 1);
  assert.ok(p.sounds.every((s, i) => i === 0 || s.t >= p.sounds[i - 1].t), "sorted");
});

test("lines are voiced from their first word; a silent card and mouthing are not", () => {
  const ps = directAll(CUES, CAST, ctx);
  const l = ps[2].lines[0], sp = ps[2].tracks.ismail.speech[0];
  assert.equal(l.who, "ismail");
  assert.equal(l.t0, sp.t0); assert.equal(l.t1, sp.t1);
  assert.equal(l.text, "Ekmek var. Şu ekmek çok taze.");
  assert.ok(l.words.length === 6 && l.words[0].t0 === 0);
  assert.equal(ps[5].lines.length, 0, "Nima's … says nothing");
  const mouth = directAll([CUES[0], { line: { who: "ismail", text: "Ekmek var.", voice: "mouthing" } }], CAST, ctx)[1];
  assert.equal(mouth.lines.length, 0);
  assert.equal(mouth.tracks.ismail.speech.length, 1, "the mouth still moves");
  const wh = directAll([CUES[0], { line: { who: "ismail", text: "Ekmek var.", voice: "whisper" } }], CAST, ctx)[1];
  assert.equal(wh.lines[0].whisper, true);
});

test("the narrator coos as the window opens, then speaks; not again right after", () => {
  const c = { ...ctx, narratorSound: { id: "coo", ms: 900 } };
  const cues: Cue[] = [CUES[0], { line: { who: "kerim", text: "Yavaş yavaş…" } }, { line: { who: "kerim", text: "Bir daha." } }];
  const ps = directAll(cues, CAST, c);
  assert.deepEqual(ps[1].sounds.map(s => [s.id, s.t]), [["coo", 150]]);
  assert.equal(ps[1].lines[0].who, "kerim");
  assert.equal(ps[1].lines[0].t0, 150 + 900 + 80, "he speaks once the coo is over");
  assert.equal(ps[2].sounds.length, 0, "no coo on his second line in a row");
  assert.equal(ps[2].lines[0].t0, 150);
});

test("a sound word comes from the kit unless the script gives one; a scene change plays the new place's motif", () => {
  const c = { ...ctx, soundWord: (id: string) => id === "clock_tick" ? "tik tak" : undefined, places: { shop: SHOP, cafe: { ...SHOP, id: "cafe", motif: "street" } } };
  const cues: Cue[] = [CUES[0], { beat: { sfx: { id: "clock_tick", at: "mark:clock" } } }, { beat: { sfx: { id: "hum" } } }, { scene: { place: "cafe", at: { ismail: "counter" } } }, { scene: { place: "cafe", at: { nima: "customer" } } }];
  const ps = directAll(cues, CAST, c);
  assert.equal(ps[1].bubbles.find(b => b.kind === "sound")?.text, "tik tak");
  assert.equal(ps[1].sounds[0].at, "mark:clock");
  assert.equal(ps[2].bubbles.length, 0, "no word, no bubble; the sound still plays");
  assert.equal(ps[2].sounds[0].id, "hum");
  assert.deepEqual(ps[3].sounds, [{ t: 0, id: "street", music: true }]);
  assert.equal(ps[0].sounds.length, 0, "the first scene has the app's opening theme instead");
  assert.equal(ps[4].sounds.length, 0, "the same place again: no motif");
});

test("turning round past side-on makes the paper flip sound; a small turn does not", () => {
  const ps = directAll(CUES, CAST, ctx);
  for (const p of ps) for (const s of p.sounds.filter(x => x.id === "paper_flip")) {
    const who = s.at!.slice(3), tr = p.tracks[who];
    assert.ok(tr.turns.some(k => Math.sign(Math.cos(k.yaw)) < 0 || Math.sign(Math.cos(p.before.actors[who].yaw)) < 0), "a flip is a turn to or from the back");
  }
  const exit = directAll([CUES[0], { beat: { move: { who: "ismail", to: "door", how: "exit" } } }], CAST, ctx)[1];
  assert.ok(exit.sounds.some(s => s.id === "paper_flip" && s.at === "ch:ismail"), "walking off to the back door shows his back");
});

// ---- kept props: one thing in every place that lists it (DESIGN.md §5.5)

const kept = (at: { x: number; z: number }, extra: Record<string, unknown> = {}) => ({ kit: "suitcase", n: 1, shown: false, keep: true, at: { ...at, y: 0 }, ...extra });
const ROOM = (id: string, props: PlaceDoc["props"]): PlaceDoc => ({ v: 1, id, size: { w: 6, d: 4 }, pieces: [], marks: { a: { x: -1, z: 0 }, b: { x: 1, z: 0 } }, props });
const KEEP: DirectCtx = {
  ...ctx,
  places: {
    ist: ROOM("ist", { bavul: kept({ x: 0, z: 0 }), tabela: { kit: "sign_board", at: { x: 2, y: 0, z: 0 }, label: "Hoş geldin" } }),
    metro: ROOM("metro", { bavul: kept({ x: -2, z: 0 }), tabela: { kit: "sign_board", at: { x: 2, y: 0, z: 0 }, label: "Hoş geldin" } }),
    road: ROOM("road", {}),
    flat: ROOM("flat", { bavul: kept({ x: 2, z: 1 }) }),
  },
};
const at = (ist: string) => ({ scene: { place: ist, at: { ismail: "a", nima: "b" } } });

test("a keep prop takes its count, showing and parameters into the next place; a place's own prop starts afresh", () => {
  const cues: Cue[] = [
    at("ist"),
    { beat: { obj: [{ id: "bavul", op: "show" }, { id: "bavul", op: "add", n: 4 }, { id: "bavul", op: "set", set: { color: "fab_12" } }, { id: "tabela", op: "set", set: { label: "Güle güle" } }] } },
    at("metro"),
  ];
  const w = fold(cues, 2, CAST, KEEP);
  assert.deepEqual([w.props.bavul.n, w.props.bavul.shown, w.props.bavul.params, w.props.bavul.at], [5, true, { color: "fab_12" }, [-2, 0, 0]]);
  assert.equal(w.props.tabela.params.label, "Hoş geldin");
});

test("a keep prop missing from the place between comes back as it was", () => {
  const cues: Cue[] = [at("ist"), { beat: { obj: [{ id: "bavul", op: "add", n: 2 }, { id: "bavul", op: "show" }] } }, at("road"), at("flat")];
  const road = fold(cues, 2, CAST, KEEP);
  assert.equal(road.props.bavul, undefined);
  assert.equal(road.away?.bavul.n, 3);
  const flat = fold(cues, 3, CAST, KEEP);
  assert.deepEqual([flat.props.bavul.n, flat.props.bavul.shown, flat.props.bavul.at], [3, true, [2, 0, 1]]);
  assert.equal(flat.away?.bavul, undefined);
});

test("a holder in the scene keeps a keep prop into the next place; otherwise it stays behind", () => {
  const take: Cue = { line: { who: "nima", text: "Tamam.", obj: [{ id: "bavul", op: "take" }] } };
  const w = fold([at("ist"), take, at("road")], 2, CAST, KEEP);
  const side = Object.keys(w.actors.nima.hold)[0] as "l" | "r";
  assert.equal(w.actors.nima.hold[side], "bavul");
  assert.deepEqual([w.props.bavul.at, w.props.bavul.holder?.actor], [null, "nima"]);
  // nima is not in the next scene: the suitcase waits, and the flat has it where the flat says
  const left = fold([at("ist"), take, { scene: { place: "flat", at: { ismail: "a" } } }], 2, CAST, KEEP);
  assert.deepEqual([left.props.bavul.holder, left.props.bavul.at], [undefined, [2, 0, 1]]);
  assert.deepEqual(left.actors.nima.hold, {});
});

test("a split-off part left behind rejoins its prop's count", () => {
  const cues: Cue[] = [at("ist"), { beat: { obj: [{ id: "bavul", op: "add", n: 2 }] } }, { line: { who: "ismail", text: "Buyrun!", obj: [{ id: "bavul", op: "give", to: "nima", n: 1 }] } }];
  const before = fold(cues, 2, CAST, KEEP);
  assert.deepEqual([before.props.bavul.n, before.props["bavul#1"].n], [2, 1]);
  const gone = fold([...cues, { scene: { place: "flat", at: { ismail: "a" } } }], 3, CAST, KEEP);
  assert.deepEqual([gone.props.bavul.n, gone.props["bavul#1"]], [3, undefined]);
  // with Nima along, the part stays in the hand and the rest goes ahead as two
  const along = fold([...cues, at("flat")], 3, CAST, KEEP);
  assert.deepEqual([along.props.bavul.n, along.props["bavul#1"].holder?.actor], [2, "nima"]);
});

test("set n changes the count, not a parameter", () => {
  const w = fold([{ scene: { place: "shop", at: {} } }, { beat: { obj: [{ id: "ekmek", op: "set", set: { n: 1, fresh: true } }] } }], 1, CAST, ctx);
  assert.deepEqual([w.props.ekmek.n, w.props.ekmek.params], [1, { fresh: true }]);
});

test("keep never reaches the kit's parameters, and propKey tells two screens apart", () => {
  const w = fold([at("ist")], 0, CAST, KEEP);
  assert.deepEqual([w.props.bavul.keep, w.props.bavul.params], [true, {}]);
  const a = propKey({ kit: "phone", params: { screen: { title: "Ali" } } }), b = propKey({ kit: "phone", params: { screen: { title: "Ayşe" } } });
  assert.notEqual(a, b);
  assert.equal(propKey({ kit: "x", params: { b: 1, a: 2 } }), propKey({ kit: "x", params: { a: 2, b: 1 } }));
});

// ---- costumes: a change of clothes is a key into the stage's wardrobe

test("a costume changes at the cut, or on the line once the walk is done, and carries across scenes", () => {
  const cues: Cue[] = [
    { scene: { place: "shop", at: { ismail: "counter" }, costume: { ismail: "apron" } } },
    { line: { who: "ismail", text: "Hoş geldiniz!", move: { who: "nima", to: "customer", how: "enter" }, costume: { nima: "coat_off", ismail: "apron" } } },
    { scene: { place: "shop", at: { ismail: "counter", nima: "customer" } } },
  ];
  const ps = directAll(cues, CAST, ctx);
  // the scene dresses İsmail before the performance starts: he is never seen in his own clothes
  assert.equal(ps[0].before.actors.ismail.costume, "apron");
  assert.equal(evaluate(ps[0], 0).actors.ismail.costume, "apron");
  // Nima walks in first, then the coat comes off; İsmail already wears the apron, so nothing changes for him
  const [k] = ps[1].tracks.nima.costumes, walk = ps[1].tracks.nima.walks.at(-1)!;
  assert.deepEqual([k.key, k.t], ["coat_off", walk.t1]);
  assert.equal(ps[1].tracks.ismail?.costumes.length ?? 0, 0);
  assert.equal(evaluate(ps[1], k.t - 1).actors.nima.costume, "");
  assert.equal(evaluate(ps[1], k.t + 1).actors.nima.costume, "coat_off");
  assert.equal(fold(cues, 1, CAST, ctx).actors.nima.costume, "coat_off");
  // the next scene keeps both
  assert.deepEqual([ps[2].after.actors.ismail.costume, ps[2].after.actors.nima.costume], ["apron", "coat_off"]);
  // and "" dresses them back in the cast document
  const back = directAll([...cues, { beat: { costume: { nima: "" } } }], CAST, ctx).at(-1)!;
  assert.equal(back.after.actors.nima.costume, "");
});

// ---- a bird: the narrator perches, flies, and speaks from the stage as well as her window

const PARK: PlaceDoc = {
  v: 1, id: "park", size: { w: 8, d: 4 }, pieces: [], perch: "ledge",
  marks: {
    ali: { x: -1, z: 0, facing: "r" }, nima: { x: 1, z: 0, facing: "l" },
    ledge: { x: 2.5, y: 1.8, z: -1.5 }, sill: { x: -2.5, y: 1.2, z: -1.5, facing: "r" }, sky: { x: 0.5, y: 2.2, z: -0.5, air: true },
  },
};
const BARE: PlaceDoc = { ...PARK, id: "bare", perch: undefined };
const BIRD: DirectCtx = { ...ctx, places: { park: PARK, bare: BARE }, puppets: { kerim: { kind: "bird", gestures: { flap: g(900, 300) } } } };
const FLOCK = ["ali", "nima", "kerim"];
const fly = (to: string): Cue => ({ beat: { move: { who: "kerim", to, how: "fly" } } });

test("the narrator perches on the scene's mark, else the place's, else is off stage", () => {
  const w = (s: Cue, c = BIRD) => fold([s], 0, FLOCK, c).actors.kerim;
  const own = w({ scene: { place: "park", at: { ali: "ali" }, perch: "sill" } });
  assert.deepEqual([own.on, own.pos, own.yaw], [true, [-2.5, 1.2, -1.5], 0], "on the scene's perch, facing right as the mark says");
  const place = w({ scene: { place: "park", at: { ali: "ali" } } });
  assert.deepEqual([place.on, place.pos, place.yaw], [true, [2.5, 1.8, -1.5], Math.PI], "on the place's perch, mirrored towards the centre");
  assert.equal(w({ scene: { place: "park", at: { kerim: "sky" } } }).air, true, "placed in the air, she hovers");
  assert.equal(w({ scene: { place: "bare", at: { ali: "ali" } } }).on, false, "no perch: only her window");
  assert.equal(w({ scene: { place: "park", at: { ali: "ali" } } }, { ...BIRD, puppets: undefined }).on, false, "only a bird perches");
});

test("fly: 3D length, an arc above the line, no steps, ends at the mark's height", () => {
  const ps = directAll([{ scene: { place: "park", at: { ali: "ali" } } }, fly("sill"), fly("sky"), fly("ledge")], FLOCK, BIRD);
  const p = ps[1], seg = p.tracks.kerim.walks[0], len = Math.hypot(5, 0.6);
  assert.equal(seg.how, "fly");
  assert.ok(Math.abs(seg.t1 - seg.t0 - (len / 2.6 * 1000 + 300)) < 1, "timed over the 3D length");
  assert.ok(Math.abs(seg.lift! - 0.12 * len) < 1e-9 && Math.abs(seg.stride - 2.6 * 0.92) < 1e-9);
  const mid = evaluate(p, (seg.t0 + seg.t1) / 2).actors.kerim, line = 1.8 + (2.5 - mid.pos[0]) / 5 * (1.2 - 1.8);
  assert.ok(mid.pos[1] > line + 0.4, "the arc rises above the straight line");
  assert.equal(mid.walk?.how, "fly");
  assert.equal(p.sounds.filter(s => s.id === "step").length, 0, "a bird in flight makes no steps");
  const end = evaluate(p, p.dur).actors.kerim;
  assert.deepEqual([end.pos, end.air, end.walk], [[-2.5, 1.2, -1.5], false, null], "she lands on the sill");
  assert.deepEqual(p.after.actors.kerim.pos, [-2.5, 1.2, -1.5]);
  // to an air mark she keeps flying there; the next fly to a ledge lands her
  assert.equal(evaluate(ps[2], ps[2].dur).actors.kerim.air, true);
  assert.equal(ps[2].after.actors.kerim.air, true);
  assert.equal(evaluate(ps[3], 1).actors.kerim.air, false);
  assert.deepEqual([evaluate(ps[3], ps[3].dur).actors.kerim.air, ps[3].after.actors.kerim.air], [false, false]);
});

test("a bird faces the way she flies, mirrored going left", () => {
  const ps = directAll([{ scene: { place: "park", at: { ali: "ali" }, perch: "sill" } }, fly("ledge"), fly("sill")], FLOCK, BIRD);
  assert.equal(evaluate(ps[1], ps[1].dur).actors.kerim.yaw, 0, "going right she is side-on, unmirrored");
  const left = evaluate(ps[2], ps[2].dur).actors.kerim.yaw;
  assert.ok(Math.abs(left - Math.PI) < 1e-6 && Math.cos(left) < 0, "going left she turns to π: mirrored");
  assert.equal(ps[2].tracks.kerim.turns.length, 1);
});

test("a fly from off stage enters from outside the frame", () => {
  const p = directAll([{ scene: { place: "bare", at: { ali: "ali" } } }, fly("sky")], FLOCK, BIRD)[1];
  const seg = p.tracks.kerim.walks[0], hw = 8 * 0.86 / 2;
  assert.equal(p.before.actors.kerim.on, false);
  assert.deepEqual(p.tracks.kerim.on, [{ t: 0, on: true }]);
  assert.ok(seg.pts[0][0] > hw, "from the side nearer the mark, outside the wide frame");
  const f = evaluate(p, 1).actors.kerim;
  assert.ok(f.on && f.pos[0] > hw);
  assert.ok(Math.cos(f.yaw) < 0, "flying in leftwards she is mirrored");
  assert.deepEqual([p.after.actors.kerim.on, p.after.actors.kerim.pos, p.after.actors.kerim.air], [true, [0.5, 2.2, -0.5], true]);
});

test("a narrator line beaks the bird, but no listener turns and the shot leaves her out", () => {
  const ps = directAll([
    { scene: { place: "park", at: { ali: "ali", nima: "nima" } } },
    { line: { who: "kerim", text: "Çok bavul!" } },
    { line: { who: "kerim", text: "Merhaba!", cam: "two" } },
    { line: { who: "kerim", text: "Ben Kerim.", cam: "close" } },
  ], FLOCK, BIRD);
  const p = ps[1], sp = p.tracks.kerim.speech[0];
  assert.ok(sp && sp.keys.length, "her beak gets the line's mouth keys");
  assert.ok(evaluate(p, sp.t0 + 100).actors.kerim.mouth, "and moves with it");
  assert.ok(p.bubbles.some(b => b.kind === "narrator") && !p.bubbles.some(b => b.kind === "speech"), "the window still has the line");
  assert.equal(p.lines[0].t0, sp.t0, "the window and the stage speak together");
  assert.deepEqual(p.tracks.kerim.looks.map(l => l.at), ["viewer"], "she speaks to the viewer");
  for (const id of ["ali", "nima"]) assert.equal(p.tracks[id], undefined, `${id} neither looks nor turns`);
  assert.deepEqual([p.cams.length, p.after.shot.kind], [0, "wide"], "the auto shot stays wide");
  assert.ok(!ps[2].after.shot.ids.includes("kerim"), "a two-shot leaves her out");
  assert.deepEqual(ps[3].after.shot.ids, ["kerim"], "a close-up frames her");
  // alone on stage with her, a person's line or beat is not spoken to her
  const alone = directAll([{ scene: { place: "park", at: { ali: "ali" } } }, { line: { who: "kerim", text: "Merhaba!" } }, { line: { who: "ali", text: "Evet." } }, { beat: { who: "ali", emo: "happy" } }], FLOCK, BIRD);
  for (const p of alone.slice(2)) assert.deepEqual([(p.tracks.ali?.looks ?? []).map(l => l.at), p.tracks.ali?.turns ?? []], [[], []]);
});

test("a kit puppet's counting gesture lasts its n beats; a person's does not", () => {
  const beat: GestureDef = { dur: 900, stroke: 300, loop: [200, 500], keys: [{ t: 0 }, { t: 300, arm: 1 }, { t: 900 }] };
  const c: DirectCtx = { ...ctx, gestures: { ...GESTURES, count: beat }, puppets: { ismail: { kind: "bird", gestures: { count: beat } } } };
  const cues: Cue[] = [{ scene: { place: "shop", at: { ismail: "counter", nima: "customer" } } }, { beat: { who: "ismail", do: "count", n: 3 } }, { beat: { who: "nima", do: "count", n: 3 } }];
  const ps = directAll(cues, CAST, c);
  assert.equal(ps[1].tracks.ismail.gestures[0].len, 900 + 2 * 300);
  assert.equal(ps[2].tracks.nima.gestures[0].len, 900);
});

// ---- seats, take with a count, hop ----------------------------------------------------------------

const CAFE: PlaceDoc = {
  v: 1, id: "cafe", size: { w: 8, d: 4 }, pieces: [],
  marks: { chair: { x: -1, z: -0.5, seat: 0.45 }, stool: { x: 1, z: -0.5, seat: 0.75 }, door: { x: 3, z: 0 } },
  props: { simit: { kit: "simit", n: 4, at: { x: 0, y: 0.9, z: -0.4 } } },
};
const SEAT: DirectCtx = { ...ctx, places: { cafe: CAFE } };

test("a seat mark seats whoever is put or walks there, through every cue, until they move (getting up first)", () => {
  const perfs = directAll([
    { scene: { place: "cafe", at: { ismail: "chair", nima: "door" } } },
    { line: { who: "ismail", text: "Merhaba." } },
    { line: { who: "nima", text: "Merhaba.", move: { who: "nima", to: "stool" } } },
    { beat: { move: { who: "ismail", to: "door" } } },
  ], CAST, SEAT);
  // put on a seat by the scene: seated from the start, and still on the next line
  assert.equal(perfs[0].after.actors.ismail.seat, 0.45);
  assert.deepEqual(evaluate(perfs[1], 300).actors.ismail.seat, { h: 0.45, k: 1 });
  assert.equal(perfs[0].after.actors.nima.seat, undefined);
  // walking to a seat: standing on the way, seated at the end
  const walk = perfs[2], t1 = walk.tracks.nima.walks[0].t1;
  assert.equal(evaluate(walk, t1 - 200).actors.nima.seat, null);
  assert.deepEqual(evaluate(walk, walk.dur).actors.nima.seat, { h: 0.75, k: 1 });
  assert.equal(walk.after.actors.nima.seat, 0.75);
  // moving away from a seat: up first (the walk starts after it), then standing
  const up = perfs[3], tr = up.tracks.ismail;
  assert.deepEqual(tr.seats[0], { t: 0, h: null });
  assert.ok(tr.walks[0].t0 >= 700, "the walk waits for getting up");
  assert.ok(evaluate(up, 300).actors.ismail.seat!.k < 1 && evaluate(up, 300).actors.ismail.seat!.k > 0, "getting up");
  assert.equal(up.after.actors.ismail.seat, undefined);
  assert.equal(evaluate(up, up.dur).actors.ismail.seat, null);
});

test("take with a count less than the stack splits it: the rest stays, the hand holds its own (simit#1)", () => {
  const p = directAll([
    { scene: { place: "cafe", at: { ismail: "door", nima: "stool" } } },
    { beat: { who: "nima", obj: [{ id: "simit", op: "take", n: 1 }] } },
  ], CAST, SEAT)[1];
  assert.equal(p.after.props.simit.n, 3);
  assert.equal(p.after.props.simit.holder, undefined);
  const held = p.after.props["simit#1"];
  assert.equal(held.n, 1);
  assert.equal(held.holder!.actor, "nima");
  assert.equal(p.after.actors.nima.hold[held.holder!.side], "simit#1");
});

test("a hop is slower than a walk, with shorter steps", () => {
  const go = (how: "walk" | "hop") => directAll([{ scene: { place: "cafe", at: { ismail: "door" } } }, { beat: { move: { who: "ismail", to: "chair", how } } }], CAST, SEAT)[1].tracks.ismail.walks[0];
  const w = go("walk"), h = go("hop");
  assert.ok(h.t1 - h.t0 > w.t1 - w.t0 && h.stride < w.stride && h.how === "hop");
});

test("a mark facing back shows the back; seated so, talking turns over the shoulder, still from behind", () => {
  const CAR: PlaceDoc = { v: 1, id: "car", size: { w: 4, d: 3 }, pieces: [], marks: { driver: { x: 0.9, z: 0.4, seat: 0.55, facing: "back" }, back: { x: -0.5, z: -0.9, seat: 0.55 } } };
  const perfs = directAll([
    { scene: { place: "car", at: { ismail: "driver", nima: "back" } } },
    { line: { who: "ismail", text: "Nereye?", to: "nima" } },
  ], CAST, { ...ctx, places: { car: CAR } });
  assert.equal(perfs[0].after.actors.ismail.yaw, Math.PI);
  const yaw = perfs[1].after.actors.ismail.yaw;
  assert.ok(Math.abs(yaw) > Math.PI / 2 && Math.abs(Math.abs(yaw) - Math.PI) <= 0.4, `still from behind: ${yaw}`);
});

test("a walk onto a seat, or a mark with a facing, ends turned that way (front when the seat does not say)", () => {
  const yard: PlaceDoc = { v: 1, id: "yard", size: { w: 8, d: 4 }, pieces: [], marks: { street: { x: 0, z: 0.3 }, step: { x: 0, z: -2.5, seat: 0.32 }, side: { x: 2, z: -2.5, facing: "r" }, plain: { x: -2, z: -2.5 } } };
  const c: DirectCtx = { ...ctx, places: { yard } };
  const end = (to: string) => { const p = directAll([{ scene: { place: "yard", at: { a: "street" } } }, { beat: { move: { who: "a", to } } }], ["a"], c)[1]; return evaluate(p, p.dur).actors.a.yaw; };
  assert.ok(Math.abs(end("step")) < 0.05, "seated, facing us, not the wall behind");
  assert.ok(Math.abs(end("side") - 0.32) < 0.05, "turned a little to screen right");
  assert.ok(Math.abs(end("plain")) > 1, "a plain mark keeps the way of travel");
});

test("an entrance or an exit through a door up a stair keeps the landing's height", () => {
  const stairs: PlaceDoc = {
    v: 1, id: "stairs", size: { w: 8, d: 4 }, pieces: [],
    marks: { foot: { x: -3, z: 0 }, landing: { x: 2, y: 2.88, z: 0 }, flat: { x: 2, y: 2.88, z: -0.4, door: "d", out: { x: 2, z: -1.2 } } },
  };
  const c: DirectCtx = { ...ctx, places: { stairs } };
  const [, p] = directAll([{ scene: { place: "stairs", at: {} } }, { beat: { move: { who: "nima", to: "landing", how: "enter", from: "flat" } } }], CAST, c);
  assert.deepEqual(evaluate(p, 1).actors.nima.pos.map(v => +v.toFixed(2)), [2, 2.88, -1.2], "she comes out of the flat on the landing, not at the street's height");
  const [, q] = directAll([{ scene: { place: "stairs", at: { nima: "landing" } } }, { beat: { move: { who: "nima", to: "flat", how: "exit", from: "flat" } } }], CAST, c);
  const end = q.tracks.nima.walks.at(-1)!.t1;
  assert.equal(+evaluate(q, end - 1).actors.nima.pos[1].toFixed(2), 2.88, "and goes in at the landing's height");
});
