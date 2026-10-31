import {
  band,
  birdBones,
  birdPose,
  catBones,
  catPose,
  ellipse,
  mix,
  rrect,
  smooth,
  tone
} from "./chunk-BLASJ6YA.js";

// ../sahne-kit/src/puppets/draw.ts
var S = (path, fill, o = {}) => ({ path, fill, ...o });
var P = (pts, fill, o = {}) => ({ path: smooth(pts, true, 1), fill, ...o });
var L = (pts, c, w = 0.6, op = 0.85) => ({ path: smooth(pts, false, 1), stroke: { color: c, width: w, cap: "round" }, flat: true, opacity: op });
var part = (q, col, marks = []) => [S(q, mix(col, "#463C38", 0.22)), S(q.move(-0.45, -0.55), col, { flat: true, clip: q }), ...marks.map((s) => ({ ...s, clip: q }))];
function tf(sh, m) {
  const done = /* @__PURE__ */ new Map(), t = (q) => done.get(q) ?? done.set(q, q.transform(m)).get(q);
  return sh.map((s) => ({ ...s, path: t(s.path), ...s.stroke ? { stroke: { ...s.stroke, width: s.stroke.width * m[0] } } : {}, ...s.clip ? { clip: Array.isArray(s.clip) ? s.clip.map(t) : t(s.clip) } : {} }));
}
function piece(bone, at, scale, alt, shapes) {
  const [key, v] = alt.split("="), value = v?.replace("*", "");
  return {
    layer: bone,
    bone,
    ppcm: 8,
    group: { edge: 0.4, shapes: tf(shapes, [scale, 0, 0, scale, -at[0] * scale, -at[1] * scale]) },
    ...value ? { alt: { key, value, ...v.endsWith("*") ? { default: true } : {} } } : {}
  };
}
function boxOf(sh) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of sh) {
    const [x0, y0, x1, y1] = s.path.bounds(), r = (s.stroke?.width ?? 0) / 2;
    b[0] = Math.min(b[0], x0 - r);
    b[1] = Math.min(b[1], y0 - r);
    b[2] = Math.max(b[2], x1 + r);
    b[3] = Math.max(b[3], y1 + r);
  }
  return b;
}

// ../sahne-kit/src/puppets/cat.ts
var C = "#2F2C2C";
var SH = mix(C, "#463C38", 0.3);
var PINK = "#8A5D5A";
var NOSE = "#4A3A3A";
var EYE = "#C9B23C";
var PUPIL = "#1E1A18";
var LID = "#8A807A";
var limb = (pts, w0, w1) => band(pts, pts.map((_, i) => w0 + (w1 - w0) * i / (pts.length - 1)));
var put = (sh, x, y) => tf(sh, [1, 0, 0, 1, x, y]);
var SKULL = smooth([[-4.4, 3.4], [-5.2, -0.4], [-4.6, -3.7], [-4.3, -8.8, 0], [-1.2, -5.3], [0.6, -5.6], [2.9, -9.6, 0], [4.8, -4.2], [6, -2.2], [6.7, -0.4], [7.3, 0.6], [7, 1.9], [5.2, 3.1], [1.5, 4.1], [-1.8, 4.3]]);
var mark = (q, col) => ({ path: q, fill: col, flat: true });
var HEAD = part(SKULL, C, [
  mark(smooth([[1.3, -5.7], [2.8, -8.3, 0], [4.1, -4.6]]), PINK),
  mark(smooth([[-3.4, -5.2], [-3.9, -7.7, 0], [-1.8, -5.3]]), mix(PINK, "#000000", 0.25)),
  mark(smooth([[6.4, -0.2], [7.4, 0.1], [6.9, 1]]), NOSE)
]);
var EYES = [[2.7, -1.2, 1], [5.6, -1.4, 0.6]];
var OPEN = EYES.flatMap(([x, y, s]) => [P([[x - 0.95 * s, y + 0.1, 0], [x - 0.1, y - 0.7], [x + 0.95 * s, y - 0.35, 0], [x + 0.1, y + 0.55]], EYE, { flat: true }), S(ellipse(x + 0.1, y - 0.05, 0.28 * s, 0.6), PUPIL, { flat: true })]);
var SHUT = EYES.map(([x, y, s]) => L([[x - 0.9 * s, y - 0.1], [x, y + 0.45], [x + 0.9 * s, y - 0.15]], LID, 0.38));
var MOUTH = [P([[4.5, 2, 0], [7.4, 1.4], [7.1, 3.5], [5.4, 4.4, 0]], "#3A2224", { flat: true }), S(ellipse(6.1, 3.5, 0.95, 0.55), "#B76B6E", { flat: true })];
var HC = [2, -2.5];
var TORSO = smooth([[-14.5, -15], [-13.5, -20.5], [-9, -23.2], [0, -22], [8, -23.4], [12.5, -26.5], [15.8, -20], [13.5, -14], [9.5, -12.2], [0, -11.8], [-8, -12.4], [-12.5, -12.8]]);
function leg(hind, near) {
  const col = near ? C : SH, sp = hind ? [[0, 0], [1, 7], [-1.4, 11.4], [-0.6, 14.8]] : near ? [[0, 0], [0, 11.5], [0, 17.8]] : [[0, 0], [0, 8.5], [0, 14.8]];
  const [px, py] = sp[sp.length - 1];
  return [...hind && near ? part(ellipse(0, -1, 5.6, 6), C) : [], ...part(band(sp, hind ? [5, 3.6, 2.8, 2.6] : [near ? 5.4 : 4.4, 3, 2.6]), col), ...part(ellipse(px + 0.7, py + 0.1, 1.9, 1.1), col)];
}
var TAIL_UP = [[0, 0], [-3.4, -4], [-5, -10], [-3.6, -16], [-0.6, -19.2], [2, -18.6]];
var SIT = [
  ...[[7.6, false], [5.2, true]].flatMap(([x, near]) => part(limb([[x, -15], [x + 0.3, -7], [x + 0.5, -1.2]], near ? 4.8 : 4.2, 3.1), near ? C : SH)),
  ...part(smooth([[-2, -27], [-6, -21.5], [-10, -14], [-12.2, -7], [-11.5, -2], [-9, -0.3, 0], [0, -0.3, 0], [1.6, -5], [3.4, -10.6], [6.6, -14.2], [8, -18.5], [4.6, -25]]), C),
  ...part(smooth([[-12, -4.5], [-10.8, -11.5], [-5.6, -15], [-1.2, -11], [-0.8, -4], [-3.2, -0.4, 0], [-10.6, -0.4, 0]]), C),
  ...part(rrect(-3.6, -2.5, 7.4, 2.5, 1.25), C),
  ...part(limb([[-11.5, -2.6], [-7, -1.2], [2, -1.1], [9.5, -1.6]], 3.4, 3), C),
  ...[[7.6, false], [5.2, true]].flatMap(([x, near]) => part(ellipse(x + 1.3, -1.3, 2.3, 1.3), near ? C : SH))
];
var TAIL_TIP = [[0, 0], [2.2, -1.2], [3.4, -3.6], [2.9, -6]];
var LOAF = [
  ...part(smooth([[-15, -1], [-16.2, -8], [-12.5, -15], [-3, -17.6], [6, -16.6], [11, -12.6], [12.2, -4], [10.6, -0.4, 0], [-13.5, -0.4, 0]]), C),
  ...part(smooth([[-14.5, -2], [-15, -9], [-10, -14], [-4.5, -11], [-4, -4], [-7, -1]]), C),
  ...part(ellipse(10.5, -1.6, 2.6, 1.4), C)
];
var TAIL_LOAF = [[0, 0], [4.5, 1.9], [14.5, 2.1], [21.5, 1.8], [25, 0.4]];
var SLEEP = [
  ...part(smooth([[-15.5, -1], [-17, -7.5], [-12, -14], [-3, -16.5], [6, -15], [12, -10.5], [14.5, -4.5], [12.5, -0.4, 0], [-13.5, -0.4, 0]]), C),
  ...part(smooth([[-15, -2], [-15.2, -9], [-9.5, -14], [-3, -11.5], [-2, -5], [-5.5, -1]]), C),
  ...part(ellipse(14, -2.2, 3.4, 1.9), C)
];
var TAIL_SLEEP = [[0, 0], [4.5, 2], [15.5, 2.1], [24.5, 1.7], [29.5, -0.4], [32.1, -3.6]];
var neckFor = (c, a = 0) => [c[0] - (HC[0] * Math.cos(a) - HC[1] * Math.sin(a)), c[1] - (HC[0] * Math.sin(a) + HC[1] * Math.cos(a))];
var SLEEP_TURN = 0.42;
var CAT_RIG = {
  scale: 1,
  pivots: { cat: [0, 0], body: [0, -18], head: neckFor([15.6, -27]), tail: [-13, -20], legNF: [9, -19], legNB: [-9, -16], legFF: [10.5, -16], legFB: [-7.5, -16] },
  postures: {
    stand: { head: neckFor([15.6, -27]), tail: [-13, -20], legs: true, sway: 6, swayMs: 2400 },
    sit: { head: neckFor([4.2, -26.4]), tail: [9.5, -1.6], sway: 9, swayMs: 2700 },
    loaf: { head: neckFor([10.4, -19.2]), tail: [-15.5, -3], shut: true, sway: 1.5, swayMs: 4e3 },
    sleep: { head: neckFor([11.5, -8.6], SLEEP_TURN), headRot: SLEEP_TURN * 57.29577951308232, tail: [-15.5, -3], shut: true }
  }
};
var CAT_MOODS = {
  idle: { posture: "sit" },
  curious: { posture: "sit", head: -14 },
  content: { posture: "loaf" },
  sleepy: { posture: "sleep" },
  alert: { posture: "stand", head: -6, tail: -8 },
  wary: { posture: "stand", head: 8, headDy: 1, tail: 14, dy: 1.5 }
};
var CAT_EMO = {
  neutral: "idle",
  proud: "idle",
  annoyed: "alert",
  surprised: "alert",
  happy: "content",
  laugh: "content",
  moved: "content",
  curious: "curious",
  confused: "curious",
  tired: "sleepy",
  sad: "wary",
  sorry: "wary",
  shy: "wary",
  nervous: "wary"
};
var k = (t, pose = {}) => ({ t, ...pose });
var TARGET = { reach: { to: "target", aim: "dir" }, look: "target" };
var CAT_GESTURES = {
  /** It turns its head to the target and holds it (loops as a held look). */
  look: {
    dur: 1500,
    stroke: 300,
    needs: ["target"],
    loop: [300, 1100],
    keys: [k(0), k(300, { ease: "out", ...TARGET }), k(700, { head: -0.04, ...TARGET }), k(1100, TARGET), k(1500, { look: null })]
  },
  /** Miyav: the head lifts and the mouth opens on the stroke (pair it with the kit's `meow` sound). */
  meow: {
    dur: 1e3,
    stroke: 380,
    keys: [k(0), k(180, { ease: "out", head: 0.05 }), k(380, { ease: "out", head: -0.3, headDy: -0.4, shape: "open" }), k(700, { head: -0.24, shape: "open" }), k(820, { head: -0.1, shape: "shut" }), k(1e3)]
  },
  /** A wide yawn, eyes shut, the head up and back. */
  yawn: {
    dur: 1700,
    stroke: 700,
    keys: [
      k(0),
      k(300, { ease: "out", head: -0.2, shape2: "shut" }),
      k(700, { head: -0.45, headDy: -0.5, spine: -0.03, shape: "open", shape2: "shut" }),
      k(1200, { head: -0.42, headDy: -0.4, shape: "open", shape2: "shut" }),
      k(1450, { head: -0.1, shape: "shut", shape2: "shut" }),
      k(1700, { shape2: "open" })
    ]
  },
  /** Eating from a bowl before its front paws: it stands, the head goes down to it, nibbling (loops). */
  eat: {
    dur: 1800,
    stroke: 400,
    loop: [400, 1200],
    keys: [
      k(0, { shape2: "stand" }),
      k(400, { ease: "out", head: 0.9, headDy: 9, spine: 0.06, shape2: "stand" }),
      k(800, { head: 1, headDy: 9.6, spine: 0.06, shape2: "stand" }),
      k(1200, { head: 0.9, headDy: 9, spine: 0.06, shape2: "stand" }),
      k(1650, { shape2: "stand" }),
      k(1800)
    ]
  },
  /** A paw lifted and put down, as if to tap something. */
  paw: {
    dur: 900,
    stroke: 350,
    keys: [k(0), k(350, { ease: "out", arm: 0.9, head: 0.08 }), k(600, { arm: 0.7, head: 0.08 }), k(900, { ease: "spring" })]
  }
};
var ART = [
  ["leg_fb", "legs=on*", leg(true, false)],
  ["leg_ff", "legs=on*", leg(false, false)],
  ["tail", "tail=stand*", part(limb(TAIL_UP, 3.8, 2.4), C)],
  ["body", "body=stand*", part(TORSO, C)],
  ["body", "body=sit", SIT],
  ["body", "body=loaf", LOAF],
  ["body", "body=sleep", SLEEP],
  ["leg_nb", "legs=on*", leg(true, true)],
  ["leg_nf", "legs=on*", leg(false, true)],
  ["head", "-", HEAD],
  ["head", "eyes=open*", OPEN],
  ["head", "eyes=shut", SHUT],
  ["head", "mouth=open", MOUTH],
  ["tail", "tail=sit", part(limb(TAIL_TIP, 3, 2.3), C)],
  ["tail", "tail=loaf", part(limb(TAIL_LOAF, 3.2, 2.4), C)],
  ["tail", "tail=sleep", part(limb(TAIL_SLEEP, 3.4, 2.4), C)]
];
var FRAME = { body: CAT_RIG.pivots.body };
function items() {
  return ART.map(([bone, alt, sh]) => {
    const shapes = bone === "head" ? put(sh, HC[0], HC[1]) : sh, at = FRAME[bone] ?? [0, 0];
    return piece(bone, at, CAT_RIG.scale, alt, shapes);
  });
}
function cat(_kit, motion) {
  const head = boxOf(HEAD), top = CAT_RIG.pivots.head[1] + HC[1] + head[1], H2 = -top, len = 40;
  const body = {
    build: "adult",
    H: H2,
    headW: head[2] - head[0],
    headH: head[3] - head[1],
    neckL: 0,
    neckW: 7,
    torsoL: H2 - 16,
    shoulderW: len * 0.55,
    chestW: len * 0.55,
    waistW: len * 0.5,
    hipW: len * 0.5,
    upperArmL: 8,
    foreArmL: 8,
    handL: 2,
    armW: [5.4, 3, 2.6],
    thighL: 8,
    shinL: 8,
    footH: 1.2,
    footW: 3.8,
    legW: [5, 3, 2.6],
    legLen: 16
  };
  const front = items();
  return {
    kind: "cat",
    body,
    bones: catBones(CAT_RIG),
    views: { front, back: front },
    gestures: CAT_GESTURES,
    pose: (input) => catPose(input, { rig: CAT_RIG, moods: CAT_MOODS, emo: CAT_EMO, ...motion ? { motion } : {} })
  };
}

// ../sahne-kit/src/puppets/gull.ts
var WHITE = "#F4F3EF";
var GREY = "#B4BCC4";
var INK = "#2B2F33";
var BEAK = "#E7B53A";
var SPOT = "#D2462F";
var LEGS = "#D9B23A";
var EYE2 = "#E8D27A";
var LEG = [
  L([[3.4, -12], [3.6, -6], [3.4, -0.7]], tone(LEGS, "shade"), 1.3, 1),
  L([[-1.2, -12], [-1.5, -6], [-1.9, -0.7]], LEGS, 1.4, 1),
  P([[0.6, 0, 0], [3.4, -1.3, 0], [6.4, 0, 0]], tone(LEGS, "shade"), { flat: true }),
  P([[-4.8, 0, 0], [-1.9, -1.4, 0], [1.2, 0, 0]], LEGS, { flat: true })
];
var TAIL = P([[-13, -21, 0], [-27, -19.6], [-27.6, -16.6, 0], [-13, -16, 0]], WHITE);
var TAIL_FAN = P([[-13, -21, 0], [-23, -22.6], [-26.6, -19.8], [-26.6, -16.2], [-23, -14.4], [-13, -16, 0]], WHITE);
var BODY = P([[-16, -17], [-8, -23.5], [2, -27], [9, -27.5], [13.5, -23.5], [12.5, -16], [6, -12], [-4, -11.4], [-12, -13.6]], WHITE);
var BELLY = S(ellipse(0, -12.6, 11, 2.4), tone(WHITE, "shade"), { flat: true, opacity: 0.5, clip: BODY.path });
var FOLD = (() => {
  const m = P([[9, -25], [2, -27.6, 0], [-10, -25.6], [-22, -21.6], [-33, -18.6, 0], [-22, -16.2], [-8, -15.8], [3, -18], [8.5, -21]], GREY);
  return [
    m,
    P([[-19, -21.2], [-33, -18.6, 0], [-19, -16.4]], INK, { flat: true, clip: m.path }),
    S(ellipse(-28.6, -18.6, 0.9, 0.55), WHITE, { flat: true }),
    L([[-3, -16.3], [-16, -17]], WHITE, 0.7, 0.9)
  ];
})();
var spread = (c) => {
  const w = P([[7, -25, 0], [6.5, -34], [3.5, -42], [0.5, -47, 0], [-14, -61, 0], [-12, -53.5], [-8.5, -46], [-6, -38], [-4, -30], [-3, -24, 0]], c);
  return [
    w,
    P([[-4.6, -50.5], [-14, -61, 0], [-10.6, -48.5]], INK, { flat: true, clip: w.path }),
    S(ellipse(-11.2, -55.4, 0.9, 0.6), WHITE, { flat: true }),
    L([[-5.5, -30], [-8, -45]], WHITE, 0.6, 0.6)
  ];
};
var HEAD2 = [
  P([[7, -23.5], [8.6, -30.5], [11.8, -35.4], [15.8, -35.8], [18.8, -33.2], [19.6, -30], [17.4, -27.2], [13.4, -25.2], [10.6, -22]], WHITE),
  P([[18.6, -32.2, 0], [25.5, -31.3], [26.4, -30.1, 0], [24.8, -30.4], [18.8, -30.2, 0]], BEAK, { flat: true })
];
var BEAK_LO = [P([[19, -30.3, 0], [25, -30.2], [25.6, -29.3, 0], [24, -28.8], [19.2, -29.5, 0]], BEAK, { flat: true }), S(ellipse(24.2, -29.6, 0.6), SPOT, { flat: true })];
var eye = (r) => [S(ellipse(15.9, -32.4, r), EYE2, { flat: true }), S(ellipse(16.1, -32.4, r * 0.5), INK, { flat: true }), S(ellipse(15.7, -32.8, r * 0.18), WHITE, { flat: true })];
var SHUT2 = [L([[14.8, -32.6], [16, -31.9], [17.2, -32.5]], INK, 0.4, 0.9)];
var H = 40;
var SC = H / -boxOf(HEAD2)[1];
var GULL_RIG = {
  pivots: { bird: [0, 0], legs: [1, -12], body: [0, -12], tail: [-13, -18.5], wing: [5, -24], wingFar: [8, -25], head: [10, -26], "beak-lo": [19.2, -30.2], wingTip: [-14, -61], wingFarTip: [-11, -62] },
  scale: SC,
  flight: { flap: [18, -84], flapFar: [14, -80], flapMs: 380, glide: { dy: [-10, -5], rot: [2, 6], ms: 2600 }, lift: { dy: -8, rot: 4 }, head: -3 }
};
var GULL_MOODS = {
  idle: {},
  happy: { head: -5, alt: { eyes: "big" } },
  alarm: { head: -4, wing: 6, alt: { eyes: "big" } },
  sad: { head: 12, headDy: 1, tail: -5, wing: -3 },
  think: { head: -10 },
  sleepy: { head: 8, headDy: 1, alt: { eyes: "shut" } }
};
var GULL_EMO = {
  neutral: "idle",
  annoyed: "idle",
  happy: "happy",
  proud: "happy",
  laugh: "happy",
  surprised: "alarm",
  nervous: "alarm",
  sad: "sad",
  sorry: "sad",
  moved: "sad",
  curious: "think",
  confused: "think",
  shy: "think",
  tired: "sleepy"
};
var k2 = (t, pose = {}) => ({ t, ...pose });
var D = Math.PI / 180;
var GULL_GESTURES = {
  look: {
    dur: 1500,
    stroke: 250,
    needs: ["target"],
    loop: [250, 1100],
    keys: [k2(0), k2(250, { ease: "out", head: -0.14, spine: -0.02, look: "target" }), k2(700, { head: -0.17, spine: -0.02, look: "target" }), k2(1100, { head: -0.14, spine: -0.02, look: "target" }), k2(1500, { look: null })]
  },
  flap: {
    dur: 900,
    stroke: 260,
    loop: [120, 440],
    keys: [
      k2(0),
      k2(120, { ease: "out", arm: 10 * D, arm2: 10 * D, dy: -0.6, shape: "spread" }),
      k2(280, { arm: -40 * D, arm2: -40 * D, dy: -1.6, shape: "spread" }),
      k2(440, { arm: 10 * D, arm2: 10 * D, dy: -0.6, shape: "spread" }),
      k2(600, { arm: -40 * D, arm2: -40 * D, dy: -1.6, shape: "spread" }),
      k2(760, { arm: 6 * D, arm2: 6 * D, shape: "spread" }),
      k2(900)
    ]
  }
};
var PV = GULL_RIG.pivots;
var ART2 = [
  ["wing_far", "wing_far=on", spread(tone(GREY, "shade"))],
  ["tail", "tail=rest*", [TAIL]],
  ["tail", "tail=fan", [TAIL_FAN]],
  ["legs", "legs=down*", LEG],
  ["body", "-", [BODY, BELLY]],
  ["wing", "wing=fold*", FOLD],
  ["wing", "wing=spread", spread(GREY)],
  ["beak", "-", BEAK_LO],
  ["head", "-", HEAD2],
  ["head", "eyes=calm*", eye(0.95)],
  ["head", "eyes=big", eye(1.3)],
  ["head", "eyes=shut", SHUT2]
];
var PIVOT = { root: "bird", legs: "legs", body: "body", tail: "tail", wing_far: "wingFar", wing: "wing", head: "head", beak: "beak-lo" };
function items2() {
  return ART2.map(([bone, alt, sh]) => piece(bone, PV[PIVOT[bone]], SC, alt, sh));
}
function gull(_kit, motion) {
  const head = boxOf(HEAD2), trunk = boxOf([BODY]), cm = (u) => u * SC, sh = cm(trunk[2] - trunk[0]) * 0.6;
  const arm = cm(PV.wing[1] - PV.wingTip[1]) - sh / 2, leg2 = cm(-PV.legs[1]);
  const body = {
    build: "adult",
    H,
    headW: cm(9.5),
    headH: cm(head[3] - head[1]) * 0.75,
    neckL: 0,
    neckW: cm(6),
    torsoL: cm(-PV.head[1]),
    shoulderW: sh,
    chestW: sh,
    waistW: sh,
    hipW: sh * 0.9,
    upperArmL: arm * 0.45,
    foreArmL: arm * 0.45,
    handL: arm * 0.1,
    armW: [cm(8), cm(6), cm(3)],
    thighL: leg2 / 2,
    shinL: leg2 / 2,
    footH: cm(1.4),
    footW: cm(6),
    legW: [cm(1.4), cm(1.4), cm(1.4)],
    legLen: leg2
  };
  const front = items2();
  return {
    kind: "bird",
    body,
    bones: birdBones(GULL_RIG),
    views: { front, back: front },
    gestures: GULL_GESTURES,
    pose: (input) => birdPose(input, { rig: GULL_RIG, moods: GULL_MOODS, emo: GULL_EMO, ...motion ? { motion } : {} })
  };
}

// ../sahne-kit/src/puppets/index.ts
var puppets = { cat, gull };

export {
  CAT_MOODS,
  CAT_EMO,
  CAT_GESTURES,
  cat,
  GULL_MOODS,
  GULL_EMO,
  GULL_GESTURES,
  gull,
  puppets
};
//# sourceMappingURL=chunk-3BCF3C4G.js.map
