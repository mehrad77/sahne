// Props (DESIGN.md §5.5, §6.8): every obj op on a shop counter (show, hide and its dashed outline,
// give splitting a stack, take, add, place, set: a clock's time, a sign's label, a count; own, typed
// but not built), with the words on props laid over the stage as HTML; obj go along marks, seekable
// and tappable as it moves, and set {still} holding a prop's own motion; and kept props, carried from
// place to place while the others start afresh.

import type { Cue, PlaceDoc, PropRef, Run } from "sahne";
import { $, bar, button, slider } from "../shell/dom.ts";
import type { Ctx } from "../shell/ctx.ts";
import { ISMAIL, NIMA } from "../bakkal.ts";
import { bench, BENCH_FLAT, BENCH_ROOM, BENCH_STREET, type Bench } from "./bench.ts";

/** The test room as a shop only (no states), with a counter's props: bread, milk, a cardboard clock, a sign. */
const SHOP: PlaceDoc = {
  ...BENCH_ROOM, id: "props_shop", site: undefined, states: undefined,
  pieces: BENCH_ROOM.pieces.filter(p => !p.in?.includes("waiting")).map(({ in: _, ...p }) => p),
  marks: { door: BENCH_ROOM.marks.door, counter: { x: 0.64, z: -0.8, facing: "l" }, mid: { x: -0.6, z: 0.15, facing: "r" }, sign: { x: -1.3, z: -0.3 }, by_door: { x: -2.1, z: -1.1 } },
  camera: { wide: { x: -0.2, w: 5.6, z: -1.2 } },
  props: {
    ekmek: { kit: "bread", n: 3, at: { x: 0.18, y: 0.9, z: -0.43 }, terms: ["a1-w-ekmek"] },
    sut: { kit: "milk", n: 2, at: { x: 0.95, y: 0.9, z: -0.45 }, terms: ["a1-w-sut"] },
    saat: { kit: "paper", variant: "clock_face", time: "9:10", at: { x: 1.4, y: 0.9, z: -0.42 }, terms: ["a1-w-saat"] },
    tabela: { kit: "sign_board", label: "AÇIK", at: "sign" },
  },
};

/** One line of the world's props: count, shown or missing, where or in whose hand. */
const propsLine = (b: Bench) => {
  const w = b.stage.world();
  return Object.values(w.props).map(p => `${p.id}${p.n !== undefined ? ` ×${p.n}` : ""} ${p.holder ? `in ${p.holder.actor}'s hand` : p.ghost ? "missing (outline)" : p.shown ? "out" : "hidden"}`).join(" · ")
    + (Object.keys(w.away ?? {}).length ? ` · away: ${Object.keys(w.away!).join(", ")}` : "");
};

/** Buttons that play a cue and then print the props. */
const cues = (b: Bench, log: HTMLElement) => {
  const say = () => { log.textContent = propsLine(b); };
  setTimeout(say, 300);
  return { say, cue: (label: string, c: Cue | (() => Cue)) => button(label, () => { b.play(typeof c === "function" ? c() : c).done.then(say); }) };
};

export function build(host: HTMLElement, ctx: Ctx) {
  // ---- every op on a counter ----
  host.append($("h2", "", "At the counter: every obj op"), $("p", "note",
    "obj on a line or a beat changes props. hide leaves a dashed outline where the thing was (yok), show brings it back (var). give hands a prop over; with n it splits a stack (two of three loaves go, ekmek#1 in Nima's hand, one stays). take puts it in the actor's hand (with n, some of a stack: one loaf of three, ekmek#1); place puts it down on a mark; add adds to the count. " +
    "set changes a parameter: the cardboard clock's time (art: its hands), the sign's label (words on a prop: HTML on its paper plane, real text, crisp at any size), or n. own is typed but not built: the engine warns and the cue does nothing. A cue's prop looks are drawn when it plays (a clock at 3:45, a sign saying KAPALI), even when the loaded script never shows them."));
  // each cue keeps the wide shot, so every prop stays in view (a line would cut to the speakers)
  const W = (c: Cue): Cue => "line" in c ? { line: { ...c.line, cam: "wide" } } : "beat" in c ? { beat: { ...c.beat, cam: "wide" } } : c;
  const C = {
    hide: W({ line: { who: "ismail", text: "Süt yok.", obj: [{ id: "sut", op: "hide" }], do: "shrug", on: "yok" } }),
    show: W({ line: { who: "ismail", text: "Süt var!", obj: [{ id: "sut", op: "show" }] } }),
    give: W({ line: { who: "ismail", text: "Buyrun!", obj: [{ id: "ekmek", op: "give", to: "nima", n: 2 }] } }),
    add: W({ beat: { obj: [{ id: "ekmek", op: "add", n: 1 }] } }),
    take: W({ beat: { who: "nima", obj: [{ id: "tabela", op: "take" }] } }),
    takeOne: W({ beat: { who: "nima", obj: [{ id: "ekmek", op: "take", n: 1 }] } }),
    place: W({ beat: { who: "nima", obj: [{ id: "tabela", op: "place", at: "by_door" }] } }),
    clock: W({ beat: { obj: [{ id: "saat", op: "set", set: { time: "3:45" } }] } }),
    shut: W({ beat: { obj: [{ id: "tabela", op: "set", set: { label: "KAPALI" } }] } }),
    open: W({ beat: { obj: [{ id: "tabela", op: "set", set: { label: "AÇIK" } }] } }),
    one: W({ beat: { obj: [{ id: "sut", op: "set", set: { n: 1 } }] } }),
  };
  const SCENE: Cue[] = [{ scene: { place: SHOP.id, time: "day", at: { ismail: "counter", nima: "mid" } } }];
  const shop = bench(host, ctx, { places: [SHOP], cast: { ismail: ISMAIL, nima: NIMA }, cues: SCENE });
  const log1 = $("p", "note"), c1 = cues(shop, log1);
  host.append(log1,
    bar("show", c1.cue("hide the milk", C.hide), c1.cue("show it", C.show)),
    bar("hands", c1.cue("give two loaves", C.give), c1.cue("add a loaf", C.add), c1.cue("Nima takes one loaf", C.takeOne), c1.cue("Nima takes the sign", C.take), c1.cue("puts it by the door", C.place)),
    bar("set", c1.cue("clock to 3:45", C.clock), c1.cue("label KAPALI", C.shut), c1.cue("label AÇIK", C.open), c1.cue("one bottle (n: 1)", C.one)),
    bar("not built", c1.cue("own (Nima's bread)", W({ beat: { obj: [{ id: "ekmek", op: "own", to: "nima" }] } })), button("start again", () => { shop.load(SCENE); c1.say(); })),
  );

  // ---- go, seek, still ----
  host.append($("h2", "", "Props the script moves: go, and still"), $("p", "note",
    "obj go sends a prop along via marks to a mark, easing in and out, in ms (here 3 s) or at 0.9 m/s. The timeline moves it, so seeking is exact (drag the slider, forwards or back), and taps, gaze and framing find it where it is: tap the milk while it goes (explore is on; the word shows below). A held prop does not go. " +
    "set {still: true} holds a prop's own motion where its loop starts (the train passing behind), with no new look; {still: false} lets it run."));
  const street: PlaceDoc = { ...BENCH_STREET, id: "props_street", site: undefined, marks: { ...BENCH_STREET.marks, left: { x: -3, z: -0.4 }, plant: { x: -1.5, z: -1.2 } },
    props: { sut: { kit: "milk", n: 2, at: "left", terms: ["a1-w-sut"] }, tren: { kit: "metro_alongside", at: { x: 0, y: 0.3, z: -3 }, terms: ["a1-w-metro"] } } };
  const GO: Cue = { beat: { obj: [{ id: "sut", op: "go", via: ["plant"], to: "far", ms: 3000 }] } };
  const road = bench(host, ctx, { places: [street], cues: [{ scene: { place: street.id, at: {} } }], interact: true });
  const tapped = $("p", "note", "Tap the milk or the train.");
  road.ix!.setExplore(true);
  road.ix!.on("inspect", e => { tapped.textContent = `tapped ${e.target}${e.terms.length ? ` · ${e.terms.join(" ")}` : ""}`; });
  let run: Run | null = null;
  const fresh = () => { road.stage.show(0); return GO; };
  host.append(tapped, bar("go",
    button("send it", () => { run = road.play(fresh()); }),
    button("back", () => { run = null; road.stage.show(0); }),
    slider("seek", 0, 3500, 50, 0, v => { if (!run) { run = road.play(fresh()); run.pause(); } run.seek(v); }, v => `${v} ms`),
    road.cue("hold the train still", { beat: { obj: [{ id: "tren", op: "set", set: { still: true } }] } }),
    road.cue("let it go", { beat: { obj: [{ id: "tren", op: "set", set: { still: false } }] } }),
  ));

  // ---- kept props ----
  host.append($("h2", "", "Kept props"), $("p", "note",
    "A prop with keep is the same thing in every place that lists it (a story's suitcase, from the street to the flat). Moving on, it gives its count, showing and parameters to the new place's prop of the same id (not its position), and one in the hand stays in the hand. The other props start afresh: hide the milk, go to the flat and back, and the milk is there again. " +
    "These two places are different sites; inside one site every prop is carried (see Places)."));
  const bag = (at: PropRef["at"]): PropRef => ({ kit: "bag", variant: "suitcase", keep: true, at });
  const out: PlaceDoc = { ...BENCH_STREET, id: "keep_street", site: undefined, props: { bavul: bag({ x: 1.3, y: 0, z: -0.5 }), sut: { kit: "milk", n: 2, at: { x: -2.2, y: 0, z: -0.8 } } } };
  const flat: PlaceDoc = { ...BENCH_FLAT, props: { bavul: bag({ x: -1.8, y: 0, z: -1.2 }) } };
  const K = {
    hide: { beat: { obj: [{ id: "sut", op: "hide" }] } }, more: { beat: { obj: [{ id: "bavul", op: "add", n: 1 }] } }, take: { beat: { who: "a", obj: [{ id: "bavul", op: "take" }] } },
    flat: { scene: { place: flat.id, at: { a: "mid" } } }, down: { beat: { who: "a", obj: [{ id: "bavul", op: "place", at: "balcony" }] } }, back: { scene: { place: out.id, at: { a: "mid" } } },
  } satisfies Record<string, Cue>;
  const keep = bench(host, ctx, { places: [out, flat], cast: { a: ctx.kit.defaultDoc }, cues: [K.back], load: { extra: [{ at: 1, cues: Object.values(K) }, { at: 1, cues: [K.flat] }] } });
  const log3 = $("p", "note"), c3 = cues(keep, log3);
  host.append(log3,
    bar("street", c3.cue("hide the milk", K.hide), c3.cue("one more suitcase", K.more), c3.cue("she takes them", K.take)),
    bar("move", c3.cue("to the flat", K.flat), c3.cue("puts them down", K.down), c3.cue("back to the street", K.back), button("start again", () => { keep.load([K.back]); c3.say(); })),
  );
}
