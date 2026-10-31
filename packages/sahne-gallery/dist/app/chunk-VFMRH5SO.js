// ../sahne-story/samples/places/bakkal.json
var bakkal_default = {
  ambience: [
    "street_far",
    "fridge_hum"
  ],
  camera: {
    wide: {
      w: 8.2,
      x: -0.4,
      z: -2.1
    }
  },
  district: "Taksim, Beyo\u011Flu",
  id: "bakkal",
  marks: {
    air: {
      air: true,
      x: -2.2,
      y: 2.1,
      z: -0.9
    },
    awning: {
      x: -0.4,
      y: 2,
      z: -2.45
    },
    clock: {
      x: -3.5,
      y: 2.2,
      z: -2.15
    },
    counter: {
      facing: "l",
      x: 0.64,
      z: -0.8
    },
    customer: {
      facing: "r",
      x: -0.36,
      z: 0.12
    },
    door: {
      door: "door",
      out: {
        x: -3.45,
        z: -2.95
      },
      x: -3.45,
      z: -1.15
    },
    fridge: {
      x: -2.5,
      y: 1.1,
      z: -2
    },
    front: {
      facing: "r",
      x: -1.05,
      z: 0.35
    },
    ledge: {
      x: 2.35,
      y: 2.42,
      z: -2.05
    },
    over: {
      air: true,
      x: -0.9,
      y: 1.7,
      z: -3.6
    },
    shelf: {
      x: 2.3,
      y: 1.35,
      z: -1.95
    }
  },
  motif: "street",
  name: {
    en: "\u0130smail's corner shop",
    fa: "\u0628\u0642\u0627\u0644\u06CC\u0650 \u0627\u0633\u0645\u0627\u0639\u06CC\u0644",
    tr: "\u0130smail'in bakkal\u0131"
  },
  perch: "ledge",
  pieces: [
    {
      kit: "street",
      variant: "far",
      w: 2400,
      x: 0,
      z: -14
    },
    {
      kit: "street",
      w: 1500,
      x: 0,
      z: -4.6
    },
    {
      a: "#BDB5A8",
      b: "#B1A99B",
      d: 235,
      kit: "floor",
      tile: 55,
      w: 1500,
      x: 0,
      z: -4.55
    },
    {
      d: 1e3,
      kit: "floor",
      w: 1200,
      x: 0,
      z: -2.25
    },
    {
      h: 430,
      kit: "wall",
      openings: [
        {
          h: 220,
          w: 105,
          x: -350,
          y: 0
        },
        {
          h: 115,
          w: 150,
          x: -40,
          y: 105
        }
      ],
      w: 1100,
      x: 0,
      z: -2.2
    },
    {
      id: "door",
      kit: "door_shop",
      x: -3.5,
      z: -2.19
    },
    {
      h: 115,
      kit: "window",
      w: 150,
      x: -0.4,
      y: 1.05,
      z: -2.19
    },
    {
      kit: "clock",
      time: "10:10",
      x: -3.5,
      y: 2.36,
      z: -2.18
    },
    {
      kit: "picture",
      x: 0.8,
      y: 1.45,
      z: -2.18
    },
    {
      kit: "calendar",
      x: 3.75,
      y: 1.42,
      z: -2.18
    },
    {
      clear: [
        {
          shelf: 2,
          w: 34,
          x: 12
        }
      ],
      kit: "fridge",
      x: -2.5,
      z: -2.06
    },
    {
      h: 235,
      kit: "shelf",
      w: 230,
      x: 2.35,
      z: -2.06
    },
    {
      h: 86,
      kit: "counter",
      w: 230,
      x: 0.5,
      z: -0.35
    },
    {
      kit: "lamp",
      x: 0.4,
      y: 2.3,
      z: -0.95
    },
    {
      h: 135,
      id: "shutter",
      in: [
        "closed"
      ],
      kit: "shutter",
      open: 0,
      w: 172,
      x: -0.4,
      y: 0.98,
      z: -2.27
    },
    {
      h: 135,
      in: [
        "open"
      ],
      kit: "shutter",
      open: 1,
      w: 172,
      x: -0.4,
      y: 0.98,
      z: -2.27
    },
    {
      h: 232,
      in: [
        "closed"
      ],
      kit: "shutter",
      open: 0,
      w: 125,
      x: -3.5,
      z: -2.27
    },
    {
      h: 232,
      in: [
        "open"
      ],
      kit: "shutter",
      open: 1,
      w: 125,
      x: -3.5,
      z: -2.27
    },
    {
      drop: 30,
      id: "awning",
      kit: "awning",
      w: 200,
      x: -0.4,
      y: 1.95,
      z: -2.4
    },
    {
      kit: "flowers",
      terms: [
        "a1-w-cicek"
      ],
      variant: "pot",
      x: 3.55,
      z: 0.85
    }
  ],
  props: {
    cay_bardagi: {
      at: {
        x: 0.98,
        y: 0.9,
        z: -0.36
      },
      hot: true,
      kit: "tea",
      terms: [
        "a1-w-bardak",
        "a1-w-cay"
      ],
      variant: "glass"
    },
    cay_paketi: {
      at: {
        x: 2.45,
        y: 1.4,
        z: -1.92
      },
      kit: "food",
      n: 4,
      terms: [
        "a1-w-cay"
      ],
      variant: "tea_packet"
    },
    caydanlik: {
      at: {
        x: 0.84,
        y: 0.9,
        z: -0.56
      },
      hot: true,
      kit: "tea",
      terms: [
        "a1-w-caydanlik"
      ],
      variant: "caydanlik"
    },
    domates: {
      at: {
        x: -1.1,
        y: 0,
        z: -1.6
      },
      crate: true,
      kit: "food",
      terms: [
        "a1-w-domates"
      ],
      variant: "tomatoes"
    },
    ekmek: {
      at: {
        x: 0.22,
        y: 0.9,
        z: -0.43
      },
      kit: "bread",
      n: 3,
      terms: [
        "a1-w-ekmek"
      ]
    },
    gazete: {
      at: {
        x: -1.45,
        y: 0,
        z: -1.75
      },
      kit: "paper",
      terms: [
        "a1-w-gazete"
      ],
      variant: "stack"
    },
    honey: {
      at: {
        x: 2.95,
        y: 0.97,
        z: -1.92
      },
      kit: "food",
      n: 2,
      terms: [
        "a1-w-bal"
      ],
      variant: "honey"
    },
    kart_okuyucu: {
      at: {
        x: 1.42,
        y: 0.9,
        z: -0.3
      },
      kit: "shop_kit",
      terms: [
        "a1-w-kredi-karti"
      ],
      variant: "card_reader"
    },
    kasa: {
      at: {
        x: 1.19,
        y: 0.9,
        z: -0.47
      },
      kit: "device",
      screen: "385 TL",
      terms: [
        "a1-w-fiyat"
      ],
      variant: "till"
    },
    mama: {
      at: {
        x: -2.95,
        y: 0,
        z: -1.1
      },
      decor: true,
      kit: "bowl"
    },
    mercimek: {
      at: {
        x: 3.15,
        y: 0.54,
        z: -1.92
      },
      kit: "pantry",
      terms: [
        "a2-w-mercimek"
      ],
      variant: "lentils"
    },
    meyve_suyu: {
      at: {
        x: 3.2,
        y: 1.4,
        z: -1.92
      },
      kit: "bottle",
      terms: [
        "a1-w-meyve-suyu"
      ],
      variant: "juice_carton"
    },
    patates: {
      at: {
        x: 2.1,
        y: 0.55,
        z: 0.04
      },
      kit: "veg",
      n: 6,
      terms: [
        "a1-w-patates",
        "a1-w-sebze"
      ],
      variant: "potato"
    },
    patates_cuvali: {
      at: {
        x: 2.1,
        y: 0,
        z: 0.02
      },
      decor: true,
      kit: "shop_kit",
      variant: "sack"
    },
    peynir: {
      at: {
        x: 2.4,
        y: 0.54,
        z: -1.92
      },
      kit: "food",
      terms: [
        "a1-w-peynir"
      ],
      variant: "cheese"
    },
    portakal: {
      at: {
        x: 1.45,
        y: 0.22,
        z: 0.06
      },
      kit: "fruit",
      n: 5,
      terms: [
        "a1-w-portakal",
        "a1-w-meyve"
      ],
      variant: "orange"
    },
    portakal_kasasi: {
      at: {
        x: 1.45,
        y: 0,
        z: 0.05
      },
      decor: true,
      kit: "shop_kit",
      variant: "crate"
    },
    recel: {
      at: {
        x: 1.65,
        y: 1.4,
        z: -1.92
      },
      kit: "condiment",
      terms: [
        "a1-w-recel"
      ],
      variant: "jam"
    },
    seker: {
      at: {
        x: 3.3,
        y: 0.97,
        z: -1.92
      },
      kit: "pantry",
      terms: [
        "a1-w-seker"
      ],
      variant: "sugar"
    },
    simit: {
      at: {
        x: 0.58,
        y: 0.9,
        z: -0.45
      },
      kit: "simit_tray",
      n: 6,
      terms: [
        "a2-w-simit"
      ]
    },
    su: {
      at: {
        x: -1.75,
        y: 0,
        z: -1.7
      },
      kit: "food",
      n: 4,
      terms: [
        "seed-w19"
      ],
      variant: "water"
    },
    sut: {
      at: {
        x: -2.38,
        y: 0.97,
        z: -2.035
      },
      kit: "milk",
      n: 3,
      terms: [
        "a1-w-sut"
      ]
    },
    terazi: {
      at: {
        x: -0.58,
        y: 0.9,
        z: -0.4
      },
      decor: true,
      kit: "shop_kit",
      variant: "scale"
    },
    yumurta: {
      at: {
        x: -0.12,
        y: 0.9,
        z: -0.43
      },
      kit: "food",
      terms: [
        "a1-w-yumurta"
      ],
      variant: "eggs"
    },
    zeytin: {
      at: {
        x: 1.75,
        y: 0.97,
        z: -1.92
      },
      kit: "food",
      n: 2,
      terms: [
        "a1-w-zeytin"
      ],
      variant: "olives"
    }
  },
  size: {
    d: 4,
    w: 8
  },
  states: {
    closed: {
      group: "shutter"
    },
    open: {
      default: true,
      group: "shutter"
    }
  },
  surface: "tile",
  times: [
    "dawn",
    "day",
    "golden",
    "dusk",
    "night"
  ],
  v: 1
};

// src/bakkal.ts
var BAKKAL = bakkal_default;
var VOICES = { ismail: { rate: 1.05, pitch: 0.78 }, nima: { rate: 1, pitch: 1.05 }, kerim: { rate: 0.9, pitch: 1.3 } };
var NIMA = {
  v: 1,
  kit: "sahne-kit@1",
  body: { build: "adult", height: 0.45, shape: "average" },
  skin: "skin_04",
  face: { shape: "oval", eyes: "round", brows: "soft", nose: "button", mouth: "wide" },
  hair: { style: "hair_short", color: "hair_02" },
  outfit: { top: { id: "top_shirt", colors: ["fab_05"] }, bottom: { id: "bottom_jeans", colors: ["fab_03"] }, shoes: { id: "shoes_sneakers", colors: ["fab_01", "fab_01"] } }
};
var ISMAIL = {
  v: 1,
  kit: "sahne-kit@1",
  body: { build: "adult", height: 0.38, shape: "round" },
  skin: "skin_05",
  face: { shape: "round", eyes: "round", brows: "thick", nose: "round", mouth: "wide" },
  hair: { style: "hair_classic", color: "hair_08" },
  facialHair: { style: "moustache_thick", color: "#4A4440" },
  outfit: { top: { id: "top_shirt_rolled", colors: ["fab_02"] }, bottom: { id: "bottom_trousers", colors: ["fab_24"] }, shoes: { id: "shoes_leather", colors: ["fab_20"] } },
  wear: { waist: { id: "apron_shop", colors: ["fab_04"] } }
};
var give = { id: "ekmek", op: "give", to: "nima", n: 2 };
var OPENING = [
  { scene: { place: "bakkal", time: "day", at: { ismail: "counter" } } },
  { line: { who: "ismail", text: "Ho\u015F geldiniz! Buyrun.", to: "nima", move: { who: "nima", to: "customer", how: "enter" }, do: "welcome", emo: "happy", sfx: { id: "doorbell", word: "\xE7\u0131n \xE7\u0131n" } } },
  { line: { who: "nima", text: "Ekmek var m\u0131? S\xFCt var m\u0131?", emo: "curious", do: "look", at: "mark:shelf", link: { ekmek: "obj:ekmek", s\u00FCt: "obj:sut" } } },
  { line: { who: "ismail", text: "Ekmek var. \u015Eu ekmek \xE7ok taze.", do: "point", at: "obj:ekmek", react: { nima: { do: "look", at: "obj:ekmek" } }, link: { ekmek: "obj:ekmek" } } },
  { line: { who: "ismail", text: "Ama s\xFCt yok.", obj: [{ id: "sut", op: "hide" }], do: "shrug", on: "yok", emo: "sorry", link: { s\u00FCt: "obj:sut" } } }
];
var POLITE = [
  { line: { who: "nima", text: "\u0130ki ekmek, l\xFCtfen.", do: "count", n: 2, react: { ismail: { emo: "happy", do: "nod" } } } },
  { line: { who: "ismail", text: "Buyrun!", obj: [give], emo: "happy" } }
];
var ENDING = [
  { line: { who: "ismail", text: "Ba\u015Fka bir \u015Fey?", tempo: 1.4, do: "explain", emo: "curious" } },
  { line: { who: "nima", text: "\u2026", voice: "silent", emo: "nervous", sfx: { id: "clock_tick", word: "tik tak", at: "mark:clock" } } },
  { line: { who: "kerim", text: "Yava\u015F yava\u015F\u2026" } }
];
var CHOICE_AT = OPENING.length;
var GL_WORDS = {
  ho\u015F: { en: "pleasant, nice", fa: "\u062E\u0648\u0634" },
  geldiniz: { en: "you came", fa: "\u0622\u0645\u062F\u06CC\u062F", head: "gelmek", note: "gel- + -di + -niz (you, polite)" },
  buyrun: { en: "here you are; please, go ahead", fa: "\u0628\u0641\u0631\u0645\u0627\u06CC\u06CC\u062F" },
  m\u0131: { en: "(yes/no question)", fa: "\u0622\u06CC\u0627", note: "m\u0131 / mi / mu / m\xFC follows the vowel before it" },
  ver: { en: "give!", fa: "\u0628\u062F\u0647", head: "vermek", note: "the plain command, to a friend: a little blunt in a shop" },
  ba\u015Fka: { en: "other; else", fa: "\u062F\u06CC\u06AF\u0631" }
};
var GL_PHRASES = {
  "ho\u015F geldiniz": { en: "welcome", fa: "\u062E\u0648\u0634 \u0622\u0645\u062F\u06CC\u062F", note: "the answer is Ho\u015F bulduk" },
  "ba\u015Fka bir \u015Fey": { en: "anything else", fa: "\u0686\u06CC\u0632 \u062F\u06CC\u06AF\u0631\u06CC" },
  "yava\u015F yava\u015F": { en: "slowly, little by little", fa: "\u0622\u0647\u0633\u062A\u0647 \u0622\u0647\u0633\u062A\u0647" },
  // sound words are Turkish too (Kumru's STORIES_STAGE.md §2)
  "\xE7\u0131n \xE7\u0131n": { en: "ding-a-ling (a bell)", fa: "\u062F\u06CC\u0646\u06AF \u062F\u06CC\u0646\u06AF" },
  "tik tak": { en: "tick-tock (a clock)", fa: "\u062A\u06CC\u06A9 \u062A\u0627\u06A9" }
};

export {
  BAKKAL,
  VOICES,
  NIMA,
  ISMAIL,
  OPENING,
  POLITE,
  ENDING,
  GL_WORDS,
  GL_PHRASES
};
//# sourceMappingURL=chunk-VFMRH5SO.js.map
