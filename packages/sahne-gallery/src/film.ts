// The home page's film, "Son Vapur" (the last ferry): a race against the clock in eight places, one
// script. İsmail leaves his shop for the last ferry to Kadıköy, for his daughter's wedding, and forgets
// her childhood photo, his wedding present. Nima has 29 minutes to bring it to him: through the rain in
// Feriköy, a taxi stuck in traffic, the metro with Kerim flying alongside, the market street, the Karaköy
// pier as the ferry casts off, and on board at midnight; the next morning the sun is out on the waterfront.
// Each scene cue carries its chapter's caption, the clock. Everything is the engine's own: the director stages every cue; the light, the rain, the
// traffic, the crowds, the fireworks and the sounds are the places' and the kit's. The film's places are
// the gallery's test places and the sample bakkal with a few marks and props added, and two of its own,
// the pier with the ferry alongside and the ferry's deck (FILM_PLACES); its cast is Nima, İsmail, Kerim, Pisi and the samples'
// extras (FILM_EXTRAS).

import type { Cue, Mark, PlaceDoc, Script } from "sahne";
import { BENCH_CROWD, BENCH_FERIKOY, BENCH_SHORE } from "./bench.ts";
import { BAKKAL } from "./bakkal.ts";

const withMarks = (doc: PlaceDoc, id: string, marks: Record<string, Mark>, o: { drop?: string; props?: PlaceDoc["props"] } = {}): PlaceDoc =>
  ({ ...doc, id, marks: { ...doc.marks, ...marks }, pieces: doc.pieces.filter(p => p.kit !== o.drop), props: { ...doc.props, ...o.props } });

// the waterfront's sky, far shore and sea, for the pier and the deck
const [SKY, SKYLINE, , , SEA] = BENCH_SHORE.pieces;

/** The places: the shop with the photo on the counter and İsmail's suitcase, Feriköy with Pisi on the wall,
 * the market street with a start for Nima, and the two of the film's own. */
export const FILM_PLACES: PlaceDoc[] = [
  withMarks(BAKKAL, "film_bakkal", {}, { props: {
    foto: { kit: "photo", variant: "sepia", at: { x: 0.2, y: 0.92, z: -0.5 }, keep: true },
    bavul: { kit: "bag", variant: "suitcase", at: "ismail", keep: true },
  } }),
  withMarks(BENCH_FERIKOY, "film_street", { mid: { x: 0.6, z: 0.3 }, wall: { x: -1.0, y: 0.78, z: -3.1 }, bakery: { x: 2.6, z: -2.2, facing: "l" } }, { drop: "cat" }),
  // the waterfront in the morning: the sun up over the far shore, the bunting out
  { ...withMarks(BENCH_SHORE, "film_shore", { mid: { x: 0.4, z: 0.3, facing: "l" }, sky: { x: -1.5, y: 3, z: -1.6, air: true } }), times: ["dawn", "day", "golden", "dusk", "night"] },
  withMarks(BENCH_CROWD, "film_crowd", { start: { x: -5.6, z: 0.1, facing: "r" }, stall: { x: 2.2, z: -0.6, facing: "l" } }),
  {
    v: 1, id: "film_pier", name: { tr: "Karaköy iskelesi", en: "Karaköy pier" }, size: { w: 14, d: 6 }, outdoor: true,
    pieces: [
      SKY, SKYLINE, SEA,
      { kit: "ferry", variant: "alongside", x: 2.6, z: -10, len: 2200, name: "KADIKÖY" },
      { kit: "floor", x: 0, z: -3.2, w: 1600, d: 700, tile: 60, a: "#A9A196", b: "#9D958A" },
      { kit: "lamp_post", variant: "street", x: -2.6, z: -2.9 },
      { kit: "crowd", variant: "walk", x: 0, z: -2.2, x0: -700, x1: 700, n: 5 },
    ],
    marks: { left: { x: -4, z: 0.2, facing: "r" }, mid: { x: 0, z: 0.1 }, gangway: { x: 2.4, z: -2.6 }, deck: { x: 3.4, y: 3.2, z: -8, air: true } },
    props: {},
    times: ["dusk", "night"],
    camera: { wide: { x: 0, w: 12, z: -3.2, y1: 5.5 } },
    ambience: ["waves", "crowd"], motif: "sea", surface: "stone",
  },
  {
    v: 1, id: "film_deck", name: { tr: "Vapurun üst güvertesi", en: "The ferry's upper deck" }, size: { w: 12, d: 4 }, outdoor: true,
    pieces: [
      SKY, SKYLINE, SEA,
      { kit: "ferry", variant: "deck", x: 0, z: -1.6, w: 1400, d: 360, benches: 2 },
    ],
    marks: { rail_l: { x: -1.6, z: -0.6, facing: "r" }, rail_r: { x: 1.2, z: -0.6, facing: "l" }, cayci: { x: 3.2, z: -0.2, facing: "l" }, sky: { x: -3.2, y: 2.4, z: -1.6, air: true } },
    props: {},
    times: ["night"],
    camera: { wide: { x: 0, w: 9, z: -1.6, y1: 4.2 } },
    ambience: ["waves", "ferry_engine"], motif: "sea", surface: "wood",
  },
];

/** The samples' extras the film casts: actor → extra id (sahne-story/samples/characters/). */
export const FILM_EXTRAS: Record<string, string> = { baker: "baker_firin", driver: "passenger_3", rider: "passenger_1", seller: "stallholder_1", cayci: "cayci_vapur" };

/** The chapters: a scene cue starts each, with its caption. */
const CHAPTERS: [string, Cue[]][] = [
  ["23:31 · İsmail's shop", [
    { scene: { place: "film_bakkal", time: "night", at: { ismail: "counter", nima: "customer", kerim: "ledge" }, cam: "wide" } },
    { line: { who: "ismail", text: "Kızım yarın evleniyor! Son vapurla Kadıköy'e gidiyorum.", to: "nima", do: "hand_heart", emo: "moved" } },
    { line: { who: "nima", text: "Ne güzel! Tebrikler, İsmail Bey!", do: "clap", emo: "happy", react: { ismail: { do: "nod", emo: "happy" } } } },
    { line: { who: "ismail", text: "Saat on bir buçuk mu?! Geç kaldım!", do: "look", at: "mark:clock", emo: "surprised", sfx: { id: "clock_tick", word: "tik tak", at: "mark:clock" }, cam: "close" } },
    { beat: { move: { who: "ismail", to: "door", how: "exit" }, sfx: { id: "shop_bell", word: "çın çın" }, cam: "wide" } },
    { line: { who: "kerim", text: "Nima! Fotoğraf! Tezgâhta kaldı!", emo: "surprised", cam: "single", sfx: { id: "coo", word: "gu-guu!" } } },
    { line: { who: "nima", text: "Kızının fotoğrafı… Düğün hediyesi bu!", obj: [{ id: "foto", op: "take", to: "nima" }], emo: "surprised", cam: "close" } },
    { line: { who: "nima", text: "Vapur gece yarısı kalkıyor. Koş, Nima!", emo: "proud", do: "stop", cam: "single" } },
    { beat: { move: { who: "nima", to: "door", how: "exit" }, sfx: { id: "shop_bell", word: "çın çın" }, cam: "wide" } },
  ]],
  ["23:36 · Feriköy", [
    { scene: { place: "film_street", time: "night", weather: "rain", state: ["flags"], at: { nima: "left", baker: "bakery", pisi: "wall" }, cam: "wide" } },
    { line: { who: "baker", text: "Nima! Bu saatte nereye?", to: "nima", do: "wave", emo: "curious" } },
    { line: { who: "nima", text: "Karaköy'e! Taksi!", do: "point_far", emo: "nervous", move: { who: "nima", to: "mid", how: "run" }, cam: "follow" } },
    { beat: { who: "pisi", do: "meow", emo: "surprised", sfx: { id: "meow", word: "miyav!" }, env: ["thunder"], cam: "single" } },
  ]],
  ["23:41 · A taxi", [
    { scene: { place: "bench_taxi_back", time: "night", at: { driver: "driver", nima: "back_l", kerim: "outside" }, cam: "wide" } },
    { line: { who: "nima", text: "Karaköy iskelesi, lütfen! Çok acil!", do: "point_far", emo: "nervous", cam: "single" } },
    { line: { who: "driver", text: "Tamam abla, basıyorum!", do: "thumb_up", emo: "proud", cam: "wide" } },
    { beat: { env: ["stop"], sfx: { id: "car_engine", word: "vıııın…" }, wait: 1500 } },
    { line: { who: "driver", text: "Eyvah… trafik. Hiç kımıldamıyor.", do: "shrug", emo: "sorry" } },
    { line: { who: "nima", text: "Olamaz! Metroya!", do: "stop", emo: "annoyed", cam: "close" } },
  ]],
  ["23:47 · The M11", [
    { scene: { place: "metro_m11", time: "night", at: { nima: "stand_l", rider: "stand_r", kerim: "outside" }, cam: "wide" } },
    { line: { who: "rider", text: "Neden bu kadar acele?", to: "nima", emo: "curious" } },
    { line: { who: "nima", text: "Son vapur! On üç dakika kaldı!", do: "count", n: 3, emo: "nervous", cam: "two" } },
    { line: { who: "kerim", text: "Ben buradayım, Nima! Hızlı, hızlı!", emo: "proud", sfx: { id: "wing_flap", word: "pır pır" }, cam: "single" } },
  ]],
  ["23:53 · The market street", [
    { scene: { place: "film_crowd", time: "night", weather: "rain", state: ["flags"], at: { nima: "start", seller: "stall" }, cam: "wide" } },
    { beat: { who: "nima", move: { who: "nima", to: "mid", how: "run" }, sfx: { id: "market_call", word: "taze simit!" }, cam: "follow" } },
    { line: { who: "seller", text: "Dikkat! Yavaş, kızım!", emo: "surprised", do: "stop", cam: "two" } },
    { line: { who: "nima", text: "Pardon! Vapur kaçıyor!", emo: "nervous", move: { who: "nima", to: "right", how: "run" }, cam: "follow" } },
  ]],
  ["23:59 · Karaköy pier", [
    { scene: { place: "film_pier", time: "night", weather: "clear", at: { nima: "left" }, cam: "wide" } },
    { beat: { sfx: { id: "ferry_horn", word: "düüüt!" }, wait: 1400 } },
    { line: { who: "nima", text: "Bekleyin! Bekleyin!", do: "wave", emo: "nervous", move: { who: "nima", to: "gangway", how: "run" }, cam: "follow" } },
    { beat: { move: { who: "kerim", to: "deck", how: "fly" }, sfx: { id: "wing_flap", word: "pır pır" }, cam: "wide", wait: 600 } },
  ]],
  ["00:00 · On board", [
    { scene: { place: "film_deck", time: "night", weather: "clear", at: { ismail: "rail_r", nima: "rail_l", cayci: "cayci", kerim: "sky" }, cam: "wide" } },
    { line: { who: "ismail", text: "Nima?! Sen burada ne arıyorsun?", emo: "surprised", to: "nima", cam: "two" } },
    { line: { who: "nima", text: "Bunu unuttunuz!", obj: [{ id: "foto", op: "give", to: "ismail" }], do: "give", emo: "proud" } },
    { line: { who: "ismail", text: "Kızımın fotoğrafı… Teşekkür ederim, Nima.", do: "hand_heart", emo: "moved", cam: "close" } },
    { line: { who: "cayci", text: "Çaylar benden! Hoş geldiniz!", emo: "happy", do: "welcome", sfx: { id: "tea_glass", word: "şıkır şıkır" }, cam: "wide" } },
    { beat: { env: ["fireworks:6"], sfx: { id: "fireworks", word: "bum! bum!" }, wait: 1400 } },
    { line: { who: "kerim", text: "Gece yarısı! Tam zamanında.", emo: "happy", react: { nima: { do: "cheer", emo: "laugh" }, ismail: { do: "cheer", emo: "laugh" } } } },
    { beat: { env: ["fireworks:6"], wait: 3600 } },
  ]],
  ["09:00 · Kadıköy, the next morning", [
    { scene: { place: "film_shore", time: "dawn", weather: "clear", state: ["flags", "bridge_red_white"], at: { ismail: "right", nima: "mid", kerim: "sky" }, cam: "wide" } },
    { beat: { env: ["time:day:4000"], sfx: { id: "gull", word: "ak ak" }, wait: 2400 } },
    { line: { who: "ismail", text: "Kızım fotoğrafı görünce ağladı. Çok mutluydu!", to: "nima", do: "hand_heart", emo: "moved" } },
    { line: { who: "nima", text: "Ne güzel bir sabah! Güneş de açtı.", do: "look", at: "viewer", emo: "laugh", cam: "two" } },
    { line: { who: "kerim", text: "Son vapur kaçmadı. Yavaş yavaş… ama zamanında!", emo: "happy", sfx: { id: "coo", word: "gu-guu" }, cam: "wide", react: { nima: { do: "wave", emo: "happy" }, ismail: { do: "wave", emo: "happy" } } } },
    { beat: { move: { who: "kerim", to: "sky", how: "fly" }, wait: 3200 } },
  ]],
];

/** The film's script. */
export const FILM: Script = { v: 1, cues: CHAPTERS.flatMap(([, cues]) => cues) };

/** The caption of the chapter a cue starts, by cue index. */
export const FILM_TITLES: Map<number, string> = (() => {
  const m = new Map<number, string>();
  let i = 0;
  for (const [title, cues] of CHAPTERS) { m.set(i, title); i += cues.length; }
  return m;
})();
