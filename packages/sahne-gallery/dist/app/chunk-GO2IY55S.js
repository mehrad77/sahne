import {
  Path,
  birdBones,
  birdPose
} from "./chunk-BLASJ6YA.js";

// ../sahne-kit/src/kerim/gestures.ts
var k = (t, pose = {}) => ({ t, ...pose });
var D = Math.PI / 180;
var UP = 16 * D;
var HIGH = 30 * D;
var LOW = 6 * D;
var BIRD_GESTURES = {
  /** şu: the spread wing swings out and its tip points at the target; the head lifts towards it. */
  point: {
    dur: 1300,
    stroke: 350,
    needs: ["target"],
    keys: [
      k(0),
      k(150, { ease: "out", arm: -0.15, head: -0.04, shape: "spread", look: "target" }),
      // draws back
      k(350, { ease: "spring", reach: { to: "target", aim: "dir" }, arm: 2.4, spine: 0.03, head: -0.06, shape: "spread", look: "target" }),
      k(800, { reach: { to: "target", aim: "dir" }, arm: 2.4, spine: 0.03, head: -0.06, shape: "spread", look: "target" }),
      k(1050, { arm: 0.8, head: -0.02, shape: "spread", look: "target" }),
      k(1300, { look: null })
    ]
  },
  /** o: far away: she rises a little and leans back, the wing aimed higher. */
  point_far: {
    dur: 1500,
    stroke: 450,
    needs: ["target"],
    keys: [
      k(0),
      k(200, { ease: "out", arm: -0.2, dy: 0.5, shape: "spread", look: "target" }),
      k(450, { ease: "spring", reach: { to: "target", aim: "dir" }, arm: 2.2, spine: -0.06, head: -0.14, dy: -0.8, shape: "spread", look: "target" }),
      k(1e3, { reach: { to: "target", aim: "dir" }, arm: 2.2, spine: -0.055, head: -0.13, dy: -0.8, shape: "spread", look: "target" }),
      k(1250, { arm: 0.6, head: -0.04, shape: "spread", look: "target" }),
      k(1500, { look: null })
    ]
  },
  /** n wingbeats, one per number: the spread wing up, then down on the count. */
  count: {
    dur: 1250,
    stroke: 550,
    loop: [300, 800],
    keys: [
      k(0),
      k(150, { ease: "out", arm: -0.1, shape: "spread", look: "addressee" }),
      k(300, { arm: 0.5, shape: "spread", look: "addressee" }),
      k(550, { ease: "out", arm: -0.2, head: 0.08, shape: "spread", look: "addressee" }),
      k(800, { arm: 0.5, shape: "spread", look: "addressee" }),
      k(1050, { arm: 0.1, shape: "spread", look: "addressee" }),
      k(1250, { look: null })
    ]
  },
  /** Evet: the head dips twice, beak down. */
  nod: {
    dur: 900,
    stroke: 300,
    keys: [
      k(0),
      k(110, { ease: "out", head: -0.06, headDy: -0.2 }),
      k(300, { head: 0.28, headDy: 0.6 }),
      k(480, { ease: "out", head: 0.02 }),
      k(650, { head: 0.18, headDy: 0.4 }),
      k(900, { ease: "spring" })
    ]
  },
  /** A dove's hop on the spot (the app's k-hop: up 10 units): crouch, up with the wings a little out, land soft. */
  hop: {
    dur: 650,
    stroke: 300,
    keys: [
      k(0),
      k(120, { ease: "out", dy: 0.8, head: 0.06 }),
      k(300, { dy: -5.8, arm: 0.25, arm2: 0.2, head: -0.04 }),
      k(480, { ease: "in", dy: 0.6, head: 0.04 }),
      k(650, { ease: "spring" })
    ]
  },
  /** Wings out and a flutter (the app's k-flutter: 8° up, 18° down); `n` adds beats. */
  flap: {
    dur: 800,
    stroke: 240,
    loop: [100, 380],
    keys: [
      k(0),
      k(100, { ease: "out", arm: 8 * D, arm2: 8 * D, dy: -0.5, shape: "spread" }),
      k(240, { arm: -18 * D, arm2: -18 * D, dy: -1.2, shape: "spread" }),
      k(380, { arm: 8 * D, arm2: 8 * D, dy: -0.5, shape: "spread" }),
      k(520, { arm: -18 * D, arm2: -18 * D, dy: -1.2, shape: "spread" }),
      k(660, { arm: 8 * D, arm2: 8 * D, dy: -0.5, shape: "spread" }),
      k(800)
    ]
  },
  /** Merhaba / Güle güle: the app's greeting wave, the spread wing rocking 16° → 30° → 6° → 30° → 16°; loops while held. */
  wave: {
    dur: 1450,
    stroke: 450,
    loop: [250, 1050],
    keys: [
      k(0),
      k(250, { ease: "spring", arm: UP, head: -5 * D, shape: "spread", look: "addressee" }),
      k(450, { arm: HIGH, head: -5 * D, shape: "spread", look: "addressee" }),
      k(650, { arm: LOW, head: -5 * D, shape: "spread", look: "addressee" }),
      k(850, { arm: HIGH, head: -5 * D, shape: "spread", look: "addressee" }),
      k(1050, { arm: UP, head: -5 * D, shape: "spread", look: "addressee" }),
      k(1300, { arm: 0.1, shape: "spread", look: "addressee" }),
      k(1450, { look: null })
    ]
  },
  /** Hoş geldin: both wings open at the wave's top (30°), settling through 16° and 6°, with a small bow. */
  welcome: {
    dur: 1500,
    stroke: 550,
    hands: 2,
    keys: [
      k(0),
      k(200, { ease: "out", dy: 0.5, head: -0.05 }),
      // gathers in
      k(550, { ease: "spring", arm: HIGH, arm2: HIGH, head: 0.12, headDy: 0.4, dy: 0.4, shape: "spread", look: "addressee" }),
      k(1e3, { arm: UP, arm2: UP, head: 0.08, headDy: 0.3, dy: 0.3, shape: "spread", look: "addressee" }),
      k(1300, { arm: LOW, arm2: LOW, shape: "spread", look: "addressee" }),
      k(1500, { look: null })
    ]
  },
  /** She cocks her head up towards the target; loops as a held look. */
  look: {
    dur: 1500,
    stroke: 250,
    needs: ["target"],
    loop: [250, 1100],
    keys: [
      k(0),
      k(250, { ease: "out", head: -0.14, spine: -0.02, look: "target" }),
      k(700, { head: -0.17, spine: -0.02, look: "target" }),
      k(1100, { head: -0.14, spine: -0.02, look: "target" }),
      k(1500, { look: null })
    ]
  }
};

// ../sahne-kit/src/kerim/art.gen.ts
var KERIM_PARTS = [
  { "id": "tail", "shapes": [{ "d": [["M", 41, 71], ["L", 11, 81], ["Q", 9, 83, 12, 85], ["Q", 10, 88, 13, 89], ["Q", 13, 92, 16, 91], ["L", 43, 75], ["Z"]], "fill": "#B5A79F", "stroke": "#ddc", "width": 1.6, "under": true }, { "d": [["M", 19, 78], ["L", 15, 79], ["L", 20, 89], ["L", 23, 87], ["Z"]], "fill": "#433" }, { "d": [["M", 15, 79], ["L", 11, 81], ["Q", 9, 83, 12, 85], ["Q", 10, 88, 13, 89], ["Q", 13, 92, 16, 91], ["L", 20, 89], ["Z"]], "fill": "#fff" }] },
  { "id": "wingFar", "shapes": [{ "d": [["M", 64, 50], ["C", 69, 42, 74, 35, 80, 31], ["C", 85, 28, 91, 25, 96, 25], ["Q", 93, 29, 95, 30], ["Q", 90, 32, 92, 34], ["Q", 87, 36, 89, 39], ["Q", 84, 41, 85, 44], ["C", 79, 47, 73, 51, 68, 56], ["Z"]], "fill": "#9a8f92", "stroke": "#ccc", "width": 1.6, "under": true }], "hidden": true },
  { "id": "legs", "shapes": [{ "d": [["M", 61.5, 82.5], ["L", 61.5, 86.6], ["L", 58.6, 88.2], ["M", 61.5, 86.6], ["L", 61.8, 89], ["M", 61.5, 86.6], ["L", 64.4, 88], ["M", 48.5, 83], ["L", 48.5, 87], ["L", 45.4, 88.6], ["M", 48.5, 87], ["L", 48.6, 89.6], ["M", 48.5, 87], ["L", 51.6, 88.6]], "stroke": "#d87", "width": 2.3, "cap": "round" }] },
  { "id": "body", "shapes": [{ "d": [["M", 47, 44], ["C", 41, 49, 35, 57, 35, 66], ["C", 34, 73, 37, 79, 40, 82], ["C", 44, 86, 49, 87, 55, 87], ["C", 63, 86, 71, 82, 74, 73], ["C", 77, 65, 75, 55, 70, 49], ["C", 65, 44, 55, 41, 47, 44], ["Z"]], "fill": "#DEC7C1", "stroke": "#eed", "width": 1.6, "under": true }, { "d": [["M", 75, 61], ["C", 76, 72, 69, 84, 55, 87], ["C", 51, 87, 47, 86, 45, 85], ["C", 52, 85, 60, 83, 65, 79], ["C", 71, 73, 74, 67, 75, 61], ["Z"]], "fill": "#ca9593" }, { "d": [["M", 56, 53], ["C", 62, 50, 69, 52, 72, 58], ["C", 73, 63, 71, 68, 66, 69], ["C", 60, 66, 57, 60, 56, 53], ["Z"]], "fill": "#dcc" }] },
  { "id": "wing.fold", "shapes": [{ "d": [["M", 47, 48], ["C", 53, 50, 55, 58, 53, 67], ["C", 51, 74, 46, 79, 39, 81], ["L", 26, 85], ["C", 28, 79, 32, 71, 35, 62], ["C", 38, 55, 41, 49, 47, 48], ["Z"]], "fill": "#ba9", "stroke": "#ddc", "width": 1.6, "under": true }, { "d": [["M", 45, 71], ["C", 44, 76, 41, 80, 37, 82], ["L", 26, 85], ["C", 29, 80, 33, 76, 37, 72], ["C", 40, 71, 42, 70, 45, 71], ["Z"]], "fill": "#544", "stroke": "#888", "width": 1.6, "under": true }, { "d": [["M", 47, 48], ["C", 51, 50, 54, 55, 54, 61], ["Q", 51, 63, 50, 62], ["Q", 47, 64, 45, 62], ["Q", 43, 65, 41, 63], ["Q", 38, 65, 36, 64], ["C", 38, 56, 42, 49, 47, 48], ["Z"]], "fill": "#CDBDB2", "stroke": "#edd", "width": 1.6, "under": true }, { "d": [["M", 47, 48], ["C", 50, 49, 53, 52, 53, 55], ["C", 50, 54, 46, 54, 43, 56], ["C", 44, 52, 45, 49, 47, 48], ["Z"]], "fill": "#2C56A5" }, { "d": [["M", 45.1, 68.3], ["Q", 41.5, 68.8, 41.1, 71.8], ["Q", 44.5, 71.8, 45.1, 68.3], ["Z"], ["M", 45.1, 68.3], ["Q", 48.4, 67.5, 50.1, 70.2], ["Q", 47.1, 71.3, 45.1, 68.3], ["Z"]], "fill": "#3BA7A1" }, { "d": [["M", 45.2, 68.5], ["C", 42.9, 69.1, 41.7, 67.3, 41.3, 64.2], ["L", 43.1, 65.4], ["L", 43.8, 62.8], ["L", 45.6, 64.8], ["L", 46.6, 62.9], ["C", 47.7, 65.8, 47.4, 68, 45.2, 68.5], ["Z"]], "fill": "#DD5A42" }] },
  { "id": "wing.spread", "shapes": [{ "d": [["M", 47, 52], ["C", 42, 42, 36, 34, 28, 29], ["C", 21, 25, 12, 22, 4, 23], ["Q", 9, 28, 6, 30], ["Q", 12, 33, 9, 36], ["Q", 16, 39, 14, 42], ["Q", 21, 45, 20, 49], ["Q", 26, 51, 26, 55], ["C", 31, 56, 36, 59, 41, 62], ["C", 45, 59, 47, 56, 47, 52], ["Z"]], "fill": "#ba9", "stroke": "#ddc", "width": 1.6, "under": true }, { "d": [["M", 18, 28], ["C", 13, 25, 8, 23, 4, 23], ["Q", 9, 28, 6, 30], ["Q", 12, 33, 9, 36], ["Q", 16, 39, 14, 42], ["Q", 21, 45, 20, 49], ["C", 22, 44, 21, 36, 18, 28], ["Z"]], "fill": "#544", "stroke": "#888", "width": 1.6, "under": true }, { "d": [["M", 47, 52], ["C", 42, 42, 36, 34, 28, 29], ["C", 31, 36, 36, 44, 46, 55], ["Z"]], "fill": "#2C56A5" }, { "d": [["M", 32.6, 42.5], ["Q", 29.9, 44.9, 31.2, 47.6], ["Q", 34.1, 45.7, 32.6, 42.5], ["Z"], ["M", 32.6, 42.5], ["Q", 34.9, 39.9, 37.8, 41.2], ["Q", 36, 43.9, 32.6, 42.5], ["Z"]], "fill": "#3BA7A1" }, { "d": [["M", 32.8, 42.6], ["C", 31.2, 44.3, 29.2, 43.6, 27.2, 41.2], ["L", 29.3, 41.2], ["L", 28.4, 38.7], ["L", 31.1, 39.3], ["L", 30.8, 37.2], ["C", 33.4, 39, 34.3, 40.9, 32.8, 42.6], ["Z"]], "fill": "#DD5A42" }], "hidden": true },
  { "id": "head", "shapes": [{ "d": [["M", 79.5, 33.8], ["C", 79.5, 43.465, 71.307, 51.3, 61.2, 51.3], ["C", 51.093, 51.3, 42.9, 43.465, 42.9, 33.8], ["C", 42.9, 24.135, 51.093, 16.3, 61.2, 16.3], ["C", 71.307, 16.3, 79.5, 24.135, 79.5, 33.8], ["Z"]], "fill": "#432", "opacity": 0.2 }, { "d": [["M", 42, 37], ["C", 41, 45, 45, 52, 54, 54], ["L", 54, 50], ["C", 49, 48, 46, 43, 45, 37], ["Z"]], "fill": "#211", "stroke": "#fff", "width": 1.8, "under": true }, { "d": [["M", 57, 14], ["C", 68, 14, 77, 21, 79, 30], ["C", 81, 39, 74, 49, 63, 50], ["C", 51, 51, 43, 45, 42, 34], ["C", 40, 22, 47, 14, 57, 14], ["Z"]], "fill": "#D3C9C8", "stroke": "#eee", "width": 1.6, "under": true }, { "d": [["M", 79, 30], ["C", 81, 39, 74, 49, 63, 50], ["C", 54, 51, 47, 47, 44, 41], ["C", 49, 46, 56, 47, 63, 46], ["C", 72, 45, 78, 38, 79, 30], ["Z"]], "fill": "#b9a1a2" }] },
  { "id": "head.blush", "shapes": [{ "d": [["M", 58.4, 42.9], ["C", 58.4, 44.115, 56.699, 45.1, 54.6, 45.1], ["C", 52.501, 45.1, 50.8, 44.115, 50.8, 42.9], ["C", 50.8, 41.685, 52.501, 40.7, 54.6, 40.7], ["C", 56.699, 40.7, 58.4, 41.685, 58.4, 42.9], ["Z"]], "fill": "#eaa" }] },
  { "id": "head.eye", "shapes": [{ "d": [["M", 60.4, 33], ["C", 60.4, 35.761, 58.161, 38, 55.4, 38], ["C", 52.639, 38, 50.4, 35.761, 50.4, 33], ["C", 50.4, 30.239, 52.639, 28, 55.4, 28], ["C", 58.161, 28, 60.4, 30.239, 60.4, 33], ["Z"]], "fill": "#a33", "stroke": "#fee", "width": 1.8, "under": true }] },
  { "id": "head.eye.pupil", "shapes": [{ "d": [["M", 59.4, 33.3], ["C", 59.4, 35.399, 57.699, 37.1, 55.6, 37.1], ["C", 53.501, 37.1, 51.8, 35.399, 51.8, 33.3], ["C", 51.8, 31.201, 53.501, 29.5, 55.6, 29.5], ["C", 57.699, 29.5, 59.4, 31.201, 59.4, 33.3], ["Z"]], "fill": "#211" }, { "d": [["M", 55.3, 32.4], ["C", 55.3, 33.173, 54.673, 33.8, 53.9, 33.8], ["C", 53.127, 33.8, 52.5, 33.173, 52.5, 32.4], ["C", 52.5, 31.627, 53.127, 31, 53.9, 31], ["C", 54.673, 31, 55.3, 31.627, 55.3, 32.4], ["Z"]], "fill": "#fff" }, { "d": [["M", 57.7, 35.2], ["C", 57.7, 35.531, 57.431, 35.8, 57.1, 35.8], ["C", 56.769, 35.8, 56.5, 35.531, 56.5, 35.2], ["C", 56.5, 34.869, 56.769, 34.6, 57.1, 34.6], ["C", 57.431, 34.6, 57.7, 34.869, 57.7, 35.2], ["Z"]], "fill": "#fff" }] },
  { "id": "head.eye.wet", "shapes": [{ "d": [["M", 51.5, 35.2], ["Q", 55.4, 38.6, 59.3, 35.2], ["Q", 55.4, 37.4, 51.5, 35.2], ["Z"]], "fill": "#fff" }], "hidden": true },
  { "id": "head.eye.calm", "shapes": [{ "d": [["M", 61, 31], ["Q", 55.4, 26.2, 49.8, 31], ["L", 49.8, 25.2], ["L", 61, 25.2], ["Z"]], "fill": "#D3C9C8", "stroke": "#433", "width": 1.8, "under": true, "dash": [13, 99] }] },
  { "id": "head.eye.lid", "shapes": [{ "d": [["M", 61.8, 35.2], ["C", 61.8, 37.299, 58.935, 39, 55.4, 39], ["C", 51.865, 39, 49, 37.299, 49, 35.2], ["L", 49, 26.4], ["L", 61.8, 26.4], ["Z"]], "fill": "#D3C9C8" }, { "d": [["M", 61.8, 35.2], ["C", 61.8, 37.299, 58.935, 39, 55.4, 39], ["C", 51.865, 39, 49, 37.299, 49, 35.2], ["C", 49, 36.581, 51.865, 37.7, 55.4, 37.7], ["C", 58.935, 37.7, 61.8, 36.581, 61.8, 35.2], ["Z"]], "fill": "#433" }], "hidden": true },
  { "id": "head.eye2", "shapes": [{ "d": [["M", 74.6, 32.2], ["C", 74.6, 34.464, 73.391, 36.3, 71.9, 36.3], ["C", 70.409, 36.3, 69.2, 34.464, 69.2, 32.2], ["C", 69.2, 29.936, 70.409, 28.1, 71.9, 28.1], ["C", 73.391, 28.1, 74.6, 29.936, 74.6, 32.2], ["Z"]], "fill": "#a33", "stroke": "#fee", "width": 1.6, "under": true }] },
  { "id": "head.eye2.pupil", "shapes": [{ "d": [["M", 74.1, 32.5], ["C", 74.1, 34.212, 73.205, 35.6, 72.1, 35.6], ["C", 70.995, 35.6, 70.1, 34.212, 70.1, 32.5], ["C", 70.1, 30.788, 70.995, 29.4, 72.1, 29.4], ["C", 73.205, 29.4, 74.1, 30.788, 74.1, 32.5], ["Z"]], "fill": "#211" }, { "d": [["M", 72.1, 31.7], ["C", 72.1, 32.197, 71.697, 32.6, 71.2, 32.6], ["C", 70.703, 32.6, 70.3, 32.197, 70.3, 31.7], ["C", 70.3, 31.203, 70.703, 30.8, 71.2, 30.8], ["C", 71.697, 30.8, 72.1, 31.203, 72.1, 31.7], ["Z"]], "fill": "#fff" }, { "d": [["M", 73.2, 34.2], ["C", 73.2, 34.421, 73.021, 34.6, 72.8, 34.6], ["C", 72.579, 34.6, 72.4, 34.421, 72.4, 34.2], ["C", 72.4, 33.979, 72.579, 33.8, 72.8, 33.8], ["C", 73.021, 33.8, 73.2, 33.979, 73.2, 34.2], ["Z"]], "fill": "#fff" }] },
  { "id": "head.eye2.wet", "shapes": [{ "d": [["M", 69.9, 34.4], ["Q", 71.9, 37, 73.9, 34.4], ["Q", 71.9, 36, 69.9, 34.4], ["Z"]], "fill": "#fff" }], "hidden": true },
  { "id": "head.eye2.calm", "shapes": [{ "d": [["M", 75.2, 30.4], ["Q", 71.9, 26, 68.6, 30.4], ["L", 68.6, 25], ["L", 75.2, 25], ["Z"]], "fill": "#D3C9C8", "stroke": "#433", "width": 1.8, "under": true, "dash": [8, 99] }] },
  { "id": "head.eye2.lid", "shapes": [{ "d": [["M", 75.8, 34.6], ["C", 75.8, 36.036, 74.054, 37.2, 71.9, 37.2], ["C", 69.746, 37.2, 68, 36.036, 68, 34.6], ["L", 68, 26.4], ["L", 75.8, 26.4], ["Z"]], "fill": "#D3C9C8" }, { "d": [["M", 75.8, 34.6], ["C", 75.8, 36.036, 74.054, 37.2, 71.9, 37.2], ["C", 69.746, 37.2, 68, 36.036, 68, 34.6], ["C", 68, 35.318, 69.746, 35.9, 71.9, 35.9], ["C", 74.054, 35.9, 75.8, 35.318, 75.8, 34.6], ["Z"]], "fill": "#433" }], "hidden": true },
  { "id": "head#2", "shapes": [{ "d": [["M", 66.2, 40.6], ["L", 77.6, 41.2], ["L", 66.8, 42.6], ["Z"]], "fill": "#733" }] },
  { "id": "head.beak-lo", "shapes": [{ "d": [["M", 66.4, 40.6], ["C", 70.4, 41.3, 74, 41.5, 77.4, 41.2], ["C", 74.6, 42.5, 70.6, 43.1, 67, 42.4], ["Z"]], "fill": "#544" }] },
  { "id": "head#3", "shapes": [{ "d": [["M", 65.6, 37.8], ["C", 69.2, 37, 73.6, 38.2, 78.8, 41.1], ["C", 74.6, 41.6, 70.4, 41.4, 66.2, 40.6], ["Z"]], "fill": "#433" }, { "d": [["M", 66, 38.3], ["C", 69.6, 37.7, 73.6, 38.8, 77.6, 40.8], ["C", 73.6, 39.6, 69.8, 39, 66.3, 39.4], ["Z"]], "fill": "#776a6e" }] },
  { "id": "head.smile", "shapes": [{ "d": [["M", 66.4, 40.9], ["C", 65.7, 41.2, 65, 41, 64.6, 40.4], ["C", 65.2, 40.6, 65.8, 40.6, 66.3, 40.4], ["Z"]], "fill": "#7a6466" }] },
  { "id": "head.brow", "shapes": [{ "d": [["M", 51, 25], ["C", 53, 24, 57, 24, 59, 25]], "stroke": "#433", "width": 2, "cap": "round" }], "hidden": true },
  { "id": "head.brow2", "shapes": [{ "d": [["M", 69.8, 25], ["C", 71.2, 24.3, 72.8, 24.3, 74.2, 25]], "stroke": "#433", "width": 2, "cap": "round" }], "hidden": true },
  { "id": "head.joy", "shapes": [{ "d": [["M", 50, 35], ["C", 51.8, 28.6, 59, 28.6, 60.8, 35]], "stroke": "#433", "width": 2.3, "cap": "round" }], "hidden": true },
  { "id": "head.joy2", "shapes": [{ "d": [["M", 69.3, 34], ["C", 70.1, 28.6, 73.7, 28.6, 74.5, 34]], "stroke": "#433", "width": 2.1, "cap": "round" }], "hidden": true },
  { "id": "head.tear", "shapes": [{ "d": [["M", 49.6, 39.4], ["L", 46.6, 46.4], ["C", 46.6, 48.057, 47.943, 49.4, 49.6, 49.4], ["C", 51.257, 49.4, 52.6, 48.057, 52.6, 46.4], ["Z"]], "fill": "#5ae" }], "hidden": true },
  { "id": "tail@fan", "shapes": [{ "d": [["M", 41.015, 69.561], ["L", 9.173, 72.105], ["Q", 7.007, 74.288, 10.092, 78.563], ["Q", 7.892, 82.256, 11.011, 85.022], ["Q", 10.912, 89.552, 14.096, 89.298], ["L", 42.985, 76.439], ["Z"]], "fill": "#B5A79F", "stroke": "#ddc", "width": 1.6, "under": true }, { "d": [["M", 17.675, 70.923], ["L", 13.441, 70.759], ["L", 18.364, 87.952], ["L", 21.581, 86.188], ["Z"]], "fill": "#433" }, { "d": [["M", 13.441, 70.759], ["L", 9.173, 72.105], ["Q", 7.007, 74.288, 10.092, 78.563], ["Q", 7.892, 82.256, 11.011, 85.022], ["Q", 10.912, 89.552, 14.096, 89.298], ["L", 18.364, 87.952], ["Z"]], "fill": "#fff" }], "hidden": true },
  { "id": "head.eye@big", "shapes": [{ "d": [["M", 61.65, 33], ["C", 61.65, 36.451, 58.851, 39.25, 55.4, 39.25], ["C", 51.949, 39.25, 49.15, 36.451, 49.15, 33], ["C", 49.15, 29.549, 51.949, 26.75, 55.4, 26.75], ["C", 58.851, 26.75, 61.65, 29.549, 61.65, 33], ["Z"]], "fill": "#a33", "stroke": "#fee", "width": 1.8, "under": true }], "hidden": true },
  { "id": "head.eye.pupil@big", "shapes": [{ "d": [["M", 60.4, 33.375], ["C", 60.4, 35.999, 58.274, 38.125, 55.65, 38.125], ["C", 53.026, 38.125, 50.9, 35.999, 50.9, 33.375], ["C", 50.9, 30.751, 53.026, 28.625, 55.65, 28.625], ["C", 58.274, 28.625, 60.4, 30.751, 60.4, 33.375], ["Z"]], "fill": "#211" }, { "d": [["M", 55.275, 32.25], ["C", 55.275, 33.216, 54.491, 34, 53.525, 34], ["C", 52.559, 34, 51.775, 33.216, 51.775, 32.25], ["C", 51.775, 31.284, 52.559, 30.5, 53.525, 30.5], ["C", 54.491, 30.5, 55.275, 31.284, 55.275, 32.25], ["Z"]], "fill": "#fff" }, { "d": [["M", 58.275, 35.75], ["C", 58.275, 36.164, 57.939, 36.5, 57.525, 36.5], ["C", 57.111, 36.5, 56.775, 36.164, 56.775, 35.75], ["C", 56.775, 35.336, 57.111, 35, 57.525, 35], ["C", 57.939, 35, 58.275, 35.336, 58.275, 35.75], ["Z"]], "fill": "#fff" }], "hidden": true },
  { "id": "head.eye.wet@big", "shapes": [{ "d": [["M", 50.525, 35.75], ["Q", 55.4, 40, 60.275, 35.75], ["Q", 55.4, 38.5, 50.525, 35.75], ["Z"]], "fill": "#fff" }], "hidden": true },
  { "id": "head.eye.calm@big", "shapes": [{ "d": [["M", 62.4, 30.5], ["Q", 55.4, 24.5, 48.4, 30.5], ["L", 48.4, 23.25], ["L", 62.4, 23.25], ["Z"]], "fill": "#D3C9C8", "stroke": "#433", "width": 1.8, "under": true, "dash": [13, 99] }], "hidden": true },
  { "id": "head.eye.lid@big", "shapes": [{ "d": [["M", 63.4, 35.75], ["C", 63.4, 38.374, 59.819, 40.5, 55.4, 40.5], ["C", 50.981, 40.5, 47.4, 38.374, 47.4, 35.75], ["L", 47.4, 24.75], ["L", 63.4, 24.75], ["Z"]], "fill": "#D3C9C8" }, { "d": [["M", 63.4, 35.75], ["C", 63.4, 38.374, 59.819, 40.5, 55.4, 40.5], ["C", 50.981, 40.5, 47.4, 38.374, 47.4, 35.75], ["C", 47.4, 37.476, 50.981, 38.875, 55.4, 38.875], ["C", 59.819, 38.875, 63.4, 37.476, 63.4, 35.75], ["Z"]], "fill": "#433" }], "hidden": true },
  { "id": "head.eye2@big", "shapes": [{ "d": [["M", 75.275, 32.2], ["C", 75.275, 35.03, 73.764, 37.325, 71.9, 37.325], ["C", 70.036, 37.325, 68.525, 35.03, 68.525, 32.2], ["C", 68.525, 29.37, 70.036, 27.075, 71.9, 27.075], ["C", 73.764, 27.075, 75.275, 29.37, 75.275, 32.2], ["Z"]], "fill": "#a33", "stroke": "#fee", "width": 1.6, "under": true }], "hidden": true },
  { "id": "head.eye2.pupil@big", "shapes": [{ "d": [["M", 74.65, 32.575], ["C", 74.65, 34.715, 73.531, 36.45, 72.15, 36.45], ["C", 70.769, 36.45, 69.65, 34.715, 69.65, 32.575], ["C", 69.65, 30.435, 70.769, 28.7, 72.15, 28.7], ["C", 73.531, 28.7, 74.65, 30.435, 74.65, 32.575], ["Z"]], "fill": "#211" }, { "d": [["M", 72.15, 31.575], ["C", 72.15, 32.196, 71.646, 32.7, 71.025, 32.7], ["C", 70.404, 32.7, 69.9, 32.196, 69.9, 31.575], ["C", 69.9, 30.954, 70.404, 30.45, 71.025, 30.45], ["C", 71.646, 30.45, 72.15, 30.954, 72.15, 31.575], ["Z"]], "fill": "#fff" }, { "d": [["M", 73.525, 34.7], ["C", 73.525, 34.976, 73.301, 35.2, 73.025, 35.2], ["C", 72.749, 35.2, 72.525, 34.976, 72.525, 34.7], ["C", 72.525, 34.424, 72.749, 34.2, 73.025, 34.2], ["C", 73.301, 34.2, 73.525, 34.424, 73.525, 34.7], ["Z"]], "fill": "#fff" }], "hidden": true },
  { "id": "head.eye2.wet@big", "shapes": [{ "d": [["M", 69.4, 34.95], ["Q", 71.9, 38.2, 74.4, 34.95], ["Q", 71.9, 36.95, 69.4, 34.95], ["Z"]], "fill": "#fff" }], "hidden": true },
  { "id": "head.eye2.calm@big", "shapes": [{ "d": [["M", 76.025, 29.95], ["Q", 71.9, 24.45, 67.775, 29.95], ["L", 67.775, 23.2], ["L", 76.025, 23.2], ["Z"]], "fill": "#D3C9C8", "stroke": "#433", "width": 1.8, "under": true, "dash": [8, 99] }], "hidden": true },
  { "id": "head.eye2.lid@big", "shapes": [{ "d": [["M", 76.775, 35.2], ["C", 76.775, 36.995, 74.593, 38.45, 71.9, 38.45], ["C", 69.208, 38.45, 67.025, 36.995, 67.025, 35.2], ["L", 67.025, 24.95], ["L", 76.775, 24.95], ["Z"]], "fill": "#D3C9C8" }, { "d": [["M", 76.775, 35.2], ["C", 76.775, 36.995, 74.593, 38.45, 71.9, 38.45], ["C", 69.208, 38.45, 67.025, 36.995, 67.025, 35.2], ["C", 67.025, 36.098, 69.208, 36.825, 71.9, 36.825], ["C", 74.593, 36.825, 76.775, 36.098, 76.775, 35.2], ["Z"]], "fill": "#433" }], "hidden": true },
  { "id": "head.smile@sad", "shapes": [{ "d": [["M", 66.4, 40.7], ["C", 65.7, 40.4, 65, 40.6, 64.6, 41.2], ["C", 65.2, 41, 65.8, 41, 66.3, 41.2], ["Z"]], "fill": "#7a6466" }], "hidden": true },
  { "id": "head.brow@happy", "shapes": [{ "d": [["M", 51, 22.6], ["C", 53, 21.6, 57, 21.6, 59, 22.6]], "stroke": "#433", "width": 2, "cap": "round" }], "hidden": true },
  { "id": "head.brow2@happy", "shapes": [{ "d": [["M", 69.8, 22.6], ["C", 71.2, 21.9, 72.8, 21.9, 74.2, 22.6]], "stroke": "#433", "width": 2, "cap": "round" }], "hidden": true },
  { "id": "head.brow@sad", "shapes": [{ "d": [["M", 52.079, 26.662], ["C", 53.558, 24.986, 57.267, 23.487, 59.496, 23.665]], "stroke": "#433", "width": 2, "cap": "round" }], "hidden": true },
  { "id": "head.brow2@sad", "shapes": [{ "d": [["M", 69.448, 24.275], ["C", 71.012, 24.205, 72.473, 24.856, 73.467, 26.065]], "stroke": "#433", "width": 2, "cap": "round" }], "hidden": true },
  { "id": "head.brow2@think", "shapes": [{ "d": [["M", 69.849, 23.428], ["C", 71.168, 22.586, 72.759, 22.418, 74.225, 22.968]], "stroke": "#433", "width": 2, "cap": "round" }], "hidden": true }
];
var KERIM_PIVOTS = { "bird": [55, 87], "head": [57, 48], "eye": [55.4, 33], "eye2": [71.9, 32.2], "wing": [47.5, 53], "wingFar": [66, 51], "tail": [42, 73], "body": [55, 86], "legs": [55, 83], "beak-lo": [66.6, 41.5] };
var KERIM_FLIGHT = { "flap": [14, -62], "flapFar": [-14, 62], "flapMs": 460, "glide": { "dy": [-9, -4.5], "rot": [3, 7], "ms": 2200 }, "lift": { "dy": -7, "rot": 5 }, "head": -4 };

// ../sahne-kit/src/kerim/index.ts
var MOODS = {
  idle: {},
  happy: { head: -6, beak: 16, tail: 6, alt: { eyes: "big", brow: "happy", brow2: "happy" } },
  // as the app: wings out (the spread wing up 8°), ^ ^ eyes; the app's 3 px lift is left out so she keeps her feet
  cheer: { head: -6, beak: 24, wing: 8, alt: { eyes: "joy", wing: "spread", wing_far: "on" } },
  sad: { head: 16, headDy: 1.5, tail: -7, wing: -4, alt: { eyes: "big", wet: "on", tear: "on", brow: "sad", brow2: "sad", smile_sad: "on" } },
  think: { head: -11, alt: { brow2: "think" } },
  sleepy: { head: 10, headDy: 1, alt: { eyes: "shut" } },
  hunch: { head: 8, headDy: 2, wing: -6 }
};
var EMO = {
  neutral: "idle",
  annoyed: "idle",
  happy: "happy",
  proud: "happy",
  surprised: "happy",
  laugh: "cheer",
  sad: "sad",
  sorry: "sad",
  moved: "sad",
  curious: "think",
  confused: "think",
  shy: "think",
  tired: "sleepy",
  nervous: "hunch"
};
var PART = new Map(KERIM_PARTS.map((p) => [p.id, p]));
var part = (id) => {
  const p = PART.get(id);
  if (!p) throw new Error(`sahne-kit: Kerim has no part ${id} (run node packages/sahne-kit/kerim/build.ts)`);
  return p;
};
function boxOf(id) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of part(id).shapes) for (const c of s.d) for (let i = 1, w = (s.width ?? 0) / 2; i < c.length; i += 2) {
    const x = c[i], y = c[i + 1];
    b[0] = Math.min(b[0], x - w);
    b[1] = Math.min(b[1], y - w);
    b[2] = Math.max(b[2], x + w);
    b[3] = Math.max(b[3], y + w);
  }
  return b;
}
var H = 45;
var FLOOR = boxOf("legs")[3];
var TOP = boxOf("head")[1];
var S = H / (FLOOR - TOP);
var RIG = {
  pivots: { ...KERIM_PIVOTS, bird: [KERIM_PIVOTS.bird[0], FLOOR], wingTip: [4, 23], wingFarTip: [96, 25] },
  scale: S,
  flight: KERIM_FLIGHT
};
var PIVOT = { root: "bird", legs: "legs", body: "body", tail: "tail", wing_far: "wingFar", wing: "wing", head: "head", beak: "beak-lo" };
var ITEMS = `tail tail=rest* tail
tail tail=fan tail@fan
wing_far wing_far=on wingFar
legs legs=down* legs
body - body
wing wing=fold* wing.fold
wing wing=spread wing.spread
head - head head.blush
head eyes=calm* head.eye head.eye.pupil head.eye.calm head.eye2 head.eye2.pupil head.eye2.calm
head eyes=big head.eye@big head.eye.pupil@big head.eye2@big head.eye2.pupil@big
head eyes=shut head.eye head.eye.pupil head.eye2 head.eye2.pupil
head wet=on head.eye.wet@big head.eye2.wet@big
head eyes=shut head.eye.lid head.eye2.lid
head - head#2
beak - head.beak-lo
head - head#3
head smile_sad=off* head.smile
head smile_sad=on head.smile@sad
head brow=happy head.brow@happy
head brow2=happy head.brow2@happy
head brow=sad head.brow@sad
head brow2=sad head.brow2@sad
head brow2=think head.brow2@think
head eyes=joy head.joy head.joy2
head tear=on head.tear`;
function shapes(s, m) {
  const path = Object.assign(new Path(), { cmds: s.d }).transform(m), k2 = m[0], op = s.opacity === void 0 ? {} : { opacity: s.opacity };
  const fill = s.fill ? [{ path, fill: s.fill, flat: true, ...op }] : [];
  const line = s.stroke ? [{ path, stroke: { color: s.stroke, width: (s.width ?? 1) * k2, ...s.cap ? { cap: s.cap } : {}, ...s.dash ? { dash: s.dash.map((v) => v * k2) } : {} }, flat: true, ...op }] : [];
  return s.under ? [...line, ...fill] : [...fill, ...line];
}
function items() {
  return ITEMS.split("\n").map((line) => {
    const [bone, sw, ...ids] = line.split(" "), o = RIG.pivots[PIVOT[bone]], m = [S, 0, 0, S, -o[0] * S, -o[1] * S];
    const [key, v] = sw.split("="), value = v?.replace("*", "");
    return {
      layer: bone,
      bone,
      ppcm: 10,
      group: { edge: 0, shapes: ids.flatMap((id) => part(id).shapes.flatMap((s) => shapes(s, m))) },
      ...value ? { alt: { key, value, ...v.endsWith("*") ? { default: true } : {} } } : {}
    };
  });
}
var cm = (u) => u * S;
function kerim(_kit, motion) {
  const head = boxOf("head"), trunk = boxOf("body"), P = RIG.pivots, sh = cm(trunk[2] - trunk[0]);
  const arm = cm(P.bird[0] - P.wingTip[0]) - sh / 2, leg = cm(FLOOR - P.legs[1]);
  const body = {
    build: "adult",
    H,
    headW: cm(head[2] - head[0]),
    headH: cm(head[3] - head[1]),
    neckL: 0,
    neckW: cm(12),
    torsoL: cm(FLOOR - P.head[1]),
    shoulderW: sh,
    chestW: sh,
    waistW: sh,
    hipW: sh * 0.9,
    upperArmL: arm * 0.45,
    foreArmL: arm * 0.45,
    handL: arm * 0.1,
    armW: [cm(10), cm(8), cm(4)],
    thighL: leg / 2,
    shinL: leg / 2,
    footH: cm(2),
    footW: cm(7),
    legW: [cm(2.3), cm(2.3), cm(2.3)],
    legLen: leg
  };
  const front = items();
  return {
    kind: "bird",
    body,
    bones: birdBones(RIG),
    views: { front, back: front },
    gestures: BIRD_GESTURES,
    pose: (input) => birdPose(input, { rig: RIG, moods: MOODS, emo: EMO, ...motion ? { motion } : {} })
  };
}
var puppets = { bird: kerim };

export {
  KERIM_PARTS,
  BIRD_GESTURES,
  MOODS,
  EMO,
  kerim,
  puppets
};
//# sourceMappingURL=chunk-GO2IY55S.js.map
