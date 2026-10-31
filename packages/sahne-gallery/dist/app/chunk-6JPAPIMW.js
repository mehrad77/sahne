import {
  clockMinutes,
  deixis,
  lowerTr,
  match,
  readClock,
  readNumber,
  tokens
} from "./chunk-ZT53KTYM.js";
import {
  ATLAS_MAX,
  CLOTHING_FIELDS,
  TIMES,
  TIMETABLE,
  WEATHER,
  applyLook,
  cellSize,
  detour,
  drawPieces,
  fitsAtlas,
  inState,
  lineMatcher,
  lookFields,
  normalize,
  pieceOf,
  placeSolids,
  placeState,
  rng,
  route,
  withVariant
} from "./chunk-BLASJ6YA.js";

// ../sahne-story/src/texts.ts
var DEFAULT_LANGUAGES = { main: "tr", translations: ["en", "fa"] };
var allLanguages = (l) => [l.main, ...l.translations];
function textIn(t, lang, main) {
  if (typeof t === "string") return main === void 0 || lang === main ? t : void 0;
  if (t && typeof t === "object" && !Array.isArray(t)) {
    const v = t[lang];
    return typeof v === "string" ? v : void 0;
  }
  return void 0;
}
function textOf(t, ...langs) {
  if (typeof t === "string") return t;
  for (const l of langs) {
    const v = textIn(t, l);
    if (v) return v;
  }
  if (t && typeof t === "object" && !Array.isArray(t)) return Object.values(t).find((v) => typeof v === "string");
  return void 0;
}

// ../sahne-story/src/types.ts
var isLine = (s) => "who" in s;
var isBeat = (s) => "beat" in s;
var isScene = (s) => "scene" in s;
var isSpot = (s) => "spot" in s;
var isChoice = (s) => "choice" in s;
var isAct = (s) => "act" in s;
var STANDIN = "nima";
var NARRATOR = "kerim";

// ../sahne-story/src/props.ts
var isAt = (at) => typeof at === "string" || typeof at.x === "number";
var placesOf = (story, prop) => isAt(prop.at) ? { [story.place]: prop.at } : prop.at;
function storyProps(story, place) {
  const out = {};
  for (const [id, p] of Object.entries(story.props ?? {})) {
    const at = placesOf(story, p)[place];
    if (at !== void 0) out[id] = { ...p, at, keep: true };
  }
  return out;
}

// ../sahne-de/src/numbers.ts
var ONES = ["null", "ein", "zwei", "drei", "vier", "f\xFCnf", "sechs", "sieben", "acht", "neun"];
var TEENS = ["zehn", "elf", "zw\xF6lf", "dreizehn", "vierzehn", "f\xFCnfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
var TENS = ["", "", "zwanzig", "drei\xDFig", "vierzig", "f\xFCnfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
function two(n, end) {
  if (n < 10) return n === 1 && end ? "eins" : ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10), o = n % 10;
  return o ? `${o === 1 && !end ? "ein" : ONES[o]}und${TENS[t]}` : TENS[t];
}
function three(n, end) {
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? h === 1 ? "hundert" : `${ONES[h]}hundert` : "") + (r ? two(r, end) : "");
}
var sayDigits = (d) => [...d].filter((c) => c >= "0" && c <= "9").map((c) => ONES[+c]).join(" ").replace(/\bein\b/g, "eins");
function sayNumber(n) {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `minus ${sayNumber(-n)}`;
  n = Math.floor(n);
  if (n === 0) return "null";
  if (n >= 1e15) return sayDigits(n.toFixed(0));
  const out = [];
  for (const [v, one, many] of [[1e12, "eine Billion", "Billionen"], [1e9, "eine Milliarde", "Milliarden"], [1e6, "eine Million", "Millionen"]]) {
    const q = Math.floor(n / v);
    if (q) out.push(q === 1 ? one : `${sayNumber(q)} ${many}`);
    n %= v;
  }
  if (n) {
    const th = Math.floor(n / 1e3), r = n % 1e3;
    out.push((th ? th === 1 ? "eintausend" : `${three(th, false)}tausend` : "") + (r ? three(r, true) : ""));
  }
  return out.join(" ");
}
function ordinal(n, ending = "e") {
  const tail = n % 100, words9 = sayNumber(n);
  let out;
  if (tail === 1) out = words9.replace(/eins$/, "erste");
  else if (tail === 3) out = words9.replace(/drei$/, "dritte");
  else if (tail === 7) out = words9.replace(/sieben$/, "siebte");
  else if (tail === 8) out = `${words9}e`;
  else out = `${words9}${tail >= 1 && tail <= 19 ? "te" : "ste"}`;
  return ending === "en" ? `${out}n` : out;
}
function sayEuro(euro, cent) {
  const e = +euro, c = +cent.padEnd(2, "0").slice(0, 2);
  if (!e && c) return `${sayNumber(c)} Cent`;
  return `${sayNumber(e).replace(/^eins$/, "ein")} Euro${c ? ` ${sayNumber(c)}` : ""}`;
}
var whole = (d) => d.length > 1 && d[0] === "0" || d.length > 15 ? sayDigits(d) : sayNumber(+d);
function sayNumeral(s, ord = false) {
  let post = "";
  if (s.endsWith("%")) {
    post = " Prozent";
    s = s.slice(0, -1);
  }
  let out, m4;
  if ((m4 = /^(\d{1,2})[:.](\d{2})$/.exec(s)) && +m4[1] <= 24 && +m4[2] < 60) out = +m4[2] ? `${sayNumber(+m4[1]).replace(/^eins$/, "ein")} Uhr ${whole(m4[2])}` : `${sayNumber(+m4[1]).replace(/^eins$/, "ein")} Uhr`;
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) out = sayNumber(+s.replace(/\./g, ""));
  else if (m4 = /^(\d+),(\d+)$/.exec(s)) out = `${whole(m4[1])} Komma ${sayDigits(m4[2])}`;
  else if (/^\d+$/.test(s)) out = ord && s.length < 10 ? ordinal(+s, ord === "en" ? "en" : "e") : whole(s);
  else out = s.replace(/\d+/g, (d) => ` ${whole(d)} `).replace(/[^\p{L}]+/gu, " ").trim();
  return out + post;
}
var VALUE = /* @__PURE__ */ new Map();
ONES.forEach((w, v) => {
  if (v) VALUE.set(w, v);
});
VALUE.set("eins", 1);
VALUE.set("zwo", 2);
TEENS.forEach((w, k) => VALUE.set(w, 10 + k));
TENS.forEach((w, k) => {
  if (w) VALUE.set(w, k * 10);
});
VALUE.set("dreissig", 30);
var SMALL = [...ONES.slice(1)].join("|");
var TENS_RE = [...TENS.filter(Boolean), "dreissig"].join("|");
var UNDER100 = new RegExp(`^(?:(${SMALL})und)?(${TENS_RE})$`);
function under100(s) {
  const v = VALUE.get(s);
  if (v !== void 0) return v;
  const m4 = UNDER100.exec(s);
  return m4 ? (m4[1] ? VALUE.get(m4[1]) : 0) + VALUE.get(m4[2]) : null;
}
function under1000(s) {
  if (!s) return 0;
  const i = s.indexOf("hundert");
  if (i < 0) return under100(s);
  const h = i === 0 ? 1 : VALUE.get(s.slice(0, i)), r = s.slice(i + 7).replace(/^und/, "");
  const rest = under100(r) ?? (r ? null : 0);
  return h === void 0 || rest === null || h > 9 ? null : h * 100 + rest;
}
function compound(s) {
  if (!s || s === "null") return s === "null" ? 0 : null;
  const i = s.indexOf("tausend");
  if (i < 0) return under1000(s);
  const left = i === 0 ? 1 : under1000(s.slice(0, i)) ?? (s.slice(0, i) === "ein" ? 1 : null), right = under1000(s.slice(i + 7));
  return left === null || right === null || left === 0 ? null : left * 1e3 + right;
}
var LARGE = [[/^billion(?:en)?$/, 1e12], [/^milliarde(?:n)?$/, 1e9], [/^million(?:en)?$/, 1e6]];
function readNumber2(words9, i) {
  const w0 = words9[i];
  if (w0 === void 0) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(w0)) return { n: +w0.replace(/\./g, ""), len: 1 };
  if (/^\d+$/.test(w0)) return { n: +w0, len: 1 };
  const w = w0.replace(/ß/g, "ss").replace(/^(ein)(?:e|en|em|er|es)$/, "$1");
  let n = w === "ein" || w === "eine" ? 1 : compound(w);
  if (n === null) return null;
  let len = 1;
  const big = LARGE.find(([re]) => re.test(words9[i + 1] ?? ""));
  if (big && n > 0) {
    n *= big[1];
    len = 2;
    const rest = compound((words9[i + 2] ?? "").replace(/ß/g, "ss"));
    if (rest) {
      n += rest;
      len = 3;
    }
  }
  return { n, len };
}

// ../sahne-de/src/text.ts
var lowerDe = (s) => s.normalize("NFC").replace(/ẞ/g, "\xDF").toLowerCase();
var UNITS = { km: "Kilometer", kg: "Kilogramm", cm: "Zentimeter", ml: "Milliliter", min: "Minute", std: "Stunde", usw: "und so weiter", bzw: "beziehungsweise", ca: "circa" };
var LETTER = { b: "be", c: "ze", d: "de", f: "ef", g: "ge", h: "ha", j: "jot", k: "ka", l: "el", m: "em", n: "en", p: "pe", q: "ku", r: "er", s: "es", t: "te", v: "fau", w: "we", x: "iks", z: "zet", \u00DF: "es zet" };
var HUM = /^(?:h+m+h*|m+h*m*)$/;
var SHUSH = /^(?:p?s+c?h*t?|sch+|p+s+t+)$/;
function sayWord(word, ord = false) {
  const s = lowerDe(word).replace(/['’ʼ‘`]/g, "");
  if (UNITS[s]) return UNITS[s].toLowerCase();
  const read = s.replace(/\d+(?:[.:,]\d+)*%?/g, (m4, at) => (at > 0 && /\p{L}/u.test(s[at - 1]) ? " " : "") + sayNumeral(m4, at + m4.length === s.length ? ord : false));
  const out = read.replace(/-/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const letters4 = out.replace(/ /g, "");
  if (HUM.test(letters4) || SHUSH.test(letters4) || !/^[bcdfghjklmnpqrstvwxzß]+$/.test(letters4)) return out;
  return [...letters4].map((c) => LETTER[c] ?? c).join(" ");
}
var TAKES_N = /* @__PURE__ */ new Set(["am", "im", "zum", "vom", "beim", "dem", "den", "des", "zur"]);
var BEFORE_ORD = /* @__PURE__ */ new Set([...TAKES_N, "der", "die", "das", "ein", "eine", "einem", "einen", "mein", "meine", "unser", "unsere"]);
var TOKEN = /([\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:(?:['’ʼ‘-]|(?<=\p{N})[.:,](?=\p{N}))[\p{L}\p{M}\p{N}]+)*%?)|(\.{2,}|…|[.,;:!?—–]|(?<=^|\s)-(?=\s|$))/gu;
function tokens2(text) {
  const out = [];
  let skip = -1, skipWord = -1, prev = "";
  for (const m4 of text.matchAll(TOKEN)) {
    const i = m4.index ?? 0;
    if (m4[1]) {
      if (i === skipWord) continue;
      const end = i + m4[1].length, after = text.slice(end, end + 12);
      const dotted = /^\d+$/.test(m4[1]) && /^\.\s+\p{L}/u.test(after);
      const ord = dotted && (/^\.\s+\p{Ll}/u.test(after) || BEFORE_ORD.has(prev));
      if (ord) skip = end;
      const price = /^(\d+),(\d{2})$/.exec(m4[1]);
      const euro = price ? /^\s*(?:€|(Euro|EUR)(?![\p{L}\p{N}]))/u.exec(text.slice(end)) : null;
      if (euro && price) {
        if (euro[1]) skipWord = end + euro[0].length - euro[1].length;
        out.push({ kind: "word", i, text: m4[1], said: sayEuro(price[1], price[2]) });
      } else out.push({ kind: "word", i, text: m4[1], said: sayWord(m4[1], ord ? TAKES_N.has(prev) ? "en" : true : false) });
      prev = lowerDe(m4[1]);
    } else if (i !== skip) {
      const p = m4[2];
      out.push({ kind: "pause", i, text: p, mark: p === "\u2026" || p.length > 1 ? "ellipsis" : ".!?".includes(p) ? "stop" : "comma" });
    }
  }
  return out;
}

// ../sahne-de/src/speech.ts
var TIMING = {
  /** A stressed syllable: its onset consonant and its vowel. */
  syllable: 200,
  /** An unstressed schwa (the -e of Katze, -en, -er, -el). */
  schwa: 120,
  /** Lips closed for m b p (and pf), taken from the syllable they start (or added, at the end of one). */
  mbp: 70,
  /** Lower lip on the teeth for f v w. */
  fv: 60,
  /** A short close between two syllables with the same mouth shape (Ba-na-ne), so the mouth does not freeze. */
  dip: 50,
  /** Each extra consonant of a cluster at the start of a word, or in the coda of a syllable (Strand, Herbst, Fenster). */
  cluster: 40,
  /** From the first shape of a diphthong (ei, au, eu) to its second: the share of the vowel before the glide. */
  glide: 0.55,
  /** The shortest a vowel gets when labials eat into its syllable. */
  minVowel: 100,
  /** Between two words. */
  gap: 60,
  comma: 250,
  stop: 450,
  ellipsis: 600,
  /** A line that is only "…" (the silent card). */
  silent: 900,
  /** Per letter of a hum (hmm) or a shush (pst), within 300–600 ms. */
  hum: 120
};
var PAUSE = { comma: TIMING.comma, stop: TIMING.stop, ellipsis: TIMING.ellipsis };
var LIP_MS = { MBP: TIMING.mbp, FV: TIMING.fv };

// ../sahne-de/src/match.ts
var PLAIN = ["", "e", "en", "n", "er", "ern", "s", "es", "ns", "ens", "se", "sen", "ses"];
var UMLAUT = ["", "e", "en", "er", "ern", "n"];
var IRREGULAR = {
  museum: ["museen"],
  zentrum: ["zentren"],
  studium: ["studien"],
  datum: ["daten"],
  praktikum: ["praktika"],
  album: ["alben"],
  thema: ["themen"],
  firma: ["firmen"],
  drama: ["dramen"],
  pizza: ["pizzen", "pizzas"],
  konto: ["konten"],
  praxis: ["praxen"],
  kaktus: ["kakteen"],
  virus: ["viren"],
  lexikon: ["lexika"],
  atlas: ["atlanten", "atlasse"],
  junge: ["jungs"],
  herr: ["herren", "herrn"],
  kaufmann: ["kaufleute"],
  bus: ["busse", "bussen"]
};
var UML = { a: "\xE4", o: "\xF6", u: "\xFC" };
var fold = (s) => lowerDe(s).replace(/ß/g, "ss");
var clean = (s) => fold(s).replace(/[’ʼ‘`´]/g, "'").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
function umlauted(t) {
  const i = Math.max(t.lastIndexOf("a"), t.lastIndexOf("o"), t.lastIndexOf("u"));
  if (i < 0) return null;
  const au = t[i] === "u" && t[i - 1] === "a";
  return au ? `${t.slice(0, i - 1)}\xE4u${t.slice(i + 1)}` : t.slice(0, i) + UML[t[i]] + t.slice(i + 1);
}
function match2(word, token) {
  const w = clean(word).replace(/'s$/, "s"), parts = clean(token).split(/\s+/).filter(Boolean);
  if (!w || !parts.length) return false;
  const t = parts[parts.length - 1];
  if (w === t) return true;
  if (IRREGULAR[t]?.includes(w)) return true;
  if (w.length <= t.length - 2) return false;
  const ends2 = /in$/.test(t) ? [...PLAIN, "nen"] : PLAIN;
  for (const e of ends2) if (w.length === t.length + e.length && w === t + e) return true;
  const u = umlauted(t);
  if (u && u !== t) {
    for (const e of UMLAUT) if (w === u + e) return true;
  }
  return false;
}
function deixis2(word, next) {
  const w = clean(word), n = next ? clean(next) : "";
  if (/^dies(?:er|e|es|em|en)?$/.test(w)) return "dies";
  if (/^jen(?:er|e|es|em|en)$/.test(w)) return "jen";
  if (/^(?:der|die|das|dem|den)$/.test(w)) return n === "hier" ? "dies" : n === "da" || n === "dort" ? "da" : null;
  return null;
}

// ../sahne-de/src/listen.ts
var FILLER = /^(?:[äe]+h*m+|[äeöu]+h+m*|h+m+h*|m+h?m*|öh+m*)$/;
var VARIANTS = { zwo: "zwei", gibts: "gibt es", gehts: "geht es", tsch\u00FCs: "tsch\xFCss", tschuess: "tsch\xFCss", okay: "ok", dankesch\u00F6n: "danke sch\xF6n", bittesch\u00F6n: "bitte sch\xF6n", wiedersehen: "wieder sehen" };
var NEAR = { \u00E4: "a", \u00F6: "o", \u00FC: "u", \u00DF: "ss" };
function spoken(said) {
  const out = [];
  for (const t of tokens2(said)) {
    if (t.kind !== "word") continue;
    for (const w0 of t.said.split(/\s+/)) out.push(lowerDe(w0).replace(/[^\p{L}\p{N}]/gu, ""));
  }
  return out;
}
var m = lineMatcher({ normalise: spoken, near: NEAR, fillers: FILLER, spellings: VARIANTS });
var sayWords = m.sayWords;
var normalise = m.normalise;
var letters = m.letters;
var allowance = m.allowance;
var matchLine = m.matchLine;

// ../sahne-de/src/time.ts
var before = (h) => h === 1 ? 12 : h - 1;
function hourAt(words9, i) {
  const r = readNumber2(words9, i);
  return r && r.n >= 1 && r.n <= 24 && r.len === 1 ? { h: r.n, len: 1 } : null;
}
function minutesAt(words9, i) {
  if (words9[i] === "viertel") return { m: 15, len: 1 };
  const r = readNumber2(words9, i);
  return r && r.n > 0 && r.n < 60 && r.len === 1 ? { m: r.n, len: 1 } : null;
}
function readClock2(text) {
  const out = [];
  const low = lowerDe(text).replace(/[’ʼ‘]/g, "'");
  for (const m4 of low.matchAll(/(?<![\d.:])(\d{1,2})(?:(:)|\.(?=\d{2}\s*uhr(?![\p{L}])))(\d{2})(?![\d]|[.:]\d)/gu)) if (+m4[1] <= 24 && +m4[3] < 60) out.push({ h: +m4[1], m: +m4[3] });
  const words9 = low.replace(/(\d)[:.](\d)/g, "$1_$2").split(/[^\p{L}\p{N}'_]+/u).filter(Boolean);
  for (let i = 0; i < words9.length; i++) {
    const w = words9[i];
    const mm = minutesAt(words9, i);
    if (mm && (words9[i + 1] === "vor" || words9[i + 1] === "nach")) {
      const dir = words9[i + 1] === "vor" ? -1 : 1;
      let j = i + 2;
      const half = words9[j] === "halb";
      if (half) j++;
      const h = hourAt(words9, j);
      if (h) {
        const mod = h.h > 12 ? 1440 : 720, total = (((half ? before(h.h) * 60 + 30 : h.h * 60) + dir * mm.m) % mod + mod) % mod;
        out.push({ h: Math.floor(total / 60) || (h.h > 12 ? 0 : 12), m: total % 60 });
        i = j + h.len - 1;
        continue;
      }
    }
    if (w === "halb" || w === "dreiviertel" || w === "viertel") {
      const h = hourAt(words9, i + 1);
      if (h && !["vor", "nach"].includes(words9[i + 2] ?? "")) {
        out.push({ h: before(h.h), m: w === "halb" ? 30 : w === "viertel" ? 15 : 45 });
        i += h.len;
        continue;
      }
    }
    if (words9[i + 1] === "uhr") {
      const h = hourAt(words9, i);
      if (h) {
        const m22 = minutesAt(words9, i + 2);
        out.push({ h: h.h, m: m22 ? m22.m : 0 });
        i += m22 ? 2 + m22.len : 1;
      }
    }
  }
  return out;
}
function clockMinutes2(t) {
  const c = typeof t === "string" ? (/^(\d{1,2})[:.](\d{2})$/.exec(t.trim()) ?? []).slice(1).map(Number) : [t.h, t.m];
  if (c.length !== 2 || c.some((x) => !Number.isFinite(x))) return null;
  return c[0] % 12 * 60 + c[1];
}

// ../sahne-story/src/langs/de-words.ts
var PARTICLES = new Set("der die das dem den des ein eine einen einem einer eines und oder aber auch doch noch nur schon sehr nicht kein keine keinen keinem keiner ich du er sie es wir ihr mich dich ihn uns euch mir dir ihm ihnen mein meine meinen meinem meiner dein deine deinen sein seine seinen ihre ihren unser unsere ist bin bist sind seid war waren habe hast hat haben habt wird werden wurde kann kannst k\xF6nnen k\xF6nnte muss musst m\xFCssen soll sollen will willst wollen mag m\xF6gen m\xF6chte m\xF6chten darf d\xFCrfen wer was wo wie wann warum wieso woher wohin welche welcher welches wieviel wie viel in an auf aus bei mit nach von zu zum zur zur vor f\xFCr \xFCber unter um durch gegen ohne bis seit am im ins ans beim vom hier da dort dies dieser diese dieses diesem diesen jener jene jenes ja nein bitte danke dankesch\xF6n hallo tsch\xFCss tsch\xFCs gut guten morgen tag abend nacht okay ok genau klar gern gerne vielleicht leider mal denn dann wenn weil dass ob als so zu zum heute gestern morgen jetzt immer nie oft manchmal auch noch mehr viel viele wenig alle alles etwas nichts man uns sich".split(/\s+/));
var ORDINALS = Array.from({ length: 31 }, (_, k) => ordinal(k + 1));
function words(text) {
  return lowerDe(text.replace(/[’‘`´]/g, "'")).split(/[^\p{L}'0-9]+/u).map((w) => w.split("'")[0]).filter((w) => w && !/^[0-9]+$/.test(w));
}
var VERB_ENDS = /* @__PURE__ */ new Set(["", "e", "st", "t", "en", "et", "est", "te", "ten", "tet", "test", "end", "n"]);
function verbForm(lemma, token) {
  if (!lemma.endsWith("n")) return false;
  const stem = lemma.replace(/e?n$/, "");
  if (stem.length < 3) return false;
  if (token.startsWith(stem) && VERB_ENDS.has(token.slice(stem.length))) return true;
  return token.startsWith("ge") && token.startsWith(stem, 2) && /^(?:t|et|en)$/.test(token.slice(2 + stem.length));
}
var isNumber = (t) => !!readNumber2([t], 0) || ORDINALS.some((o) => t.startsWith(o) && /^[nrsm]?$/.test(t.slice(o.length)));
function resolver(entries, opts = {}) {
  const buckets = /* @__PURE__ */ new Map();
  const exact = /* @__PURE__ */ new Set();
  for (const e of entries) for (const w of words(e)) {
    exact.add(w);
    (buckets.get(w.slice(0, 2)) ?? buckets.set(w.slice(0, 2), []).get(w.slice(0, 2))).push(w);
    const umlaut = w.replace(/[aou]/, (c) => ({ a: "\xE4", o: "\xF6", u: "\xFC" })[c]).slice(0, 2);
    if (umlaut !== w.slice(0, 2)) (buckets.get(umlaut) ?? buckets.set(umlaut, []).get(umlaut)).push(w);
  }
  return (token) => {
    if (exact.has(token) || isNumber(token) || opts.particles !== false && PARTICLES.has(token)) return true;
    const keys = /* @__PURE__ */ new Set([token.slice(0, 2), token.slice(2, 4)]);
    for (const k of keys) for (const w of buckets.get(k) ?? []) if (verbForm(w, token) || w.length >= 2 && match2(token, w)) return true;
    return false;
  };
}

// ../sahne-story/src/langs/shared.ts
var NEAR2 = 1.5;
var FAR = 3;
var DEIXIS_GESTURES = /* @__PURE__ */ new Set(["point", "point_far", "hold_up", "touch"]);
function lintClock(c, readClock5, clockMinutes5) {
  const times = readClock5(c.text);
  if (!times.length) return;
  const clocks = Object.values(c.st.link ?? {}).filter((t) => t.startsWith("obj:")).map((t) => t.slice(4)).filter((id) => {
    const p = c.prop(id);
    return p && (p.params.time !== void 0 || /clock|watch|saat|uhr/.test(p.kit));
  });
  for (const id of clocks) {
    const shown = c.prop(id).params.time;
    const m4 = typeof shown === "string" ? clockMinutes5(shown) : null;
    if (!times.some((t) => clockMinutes5(t) === m4)) {
      const said = `${times[0].h}:${String(times[0].m).padStart(2, "0")}`;
      c.add("time", `the line says ${said}, but obj:${id} shows ${shown ?? "no time"}`, { obj: [{ id, op: "set", set: { time: said } }] });
    }
  }
}

// ../sahne-story/src/langs/de.ts
var AGREE = { dies: ["hold_up", "touch", "point"], jen: ["point_far", "point"], da: ["point", "point_far"] };
var ADVICE = { dies: "hold_up", jen: "point_far", da: "point" };
var MOTIVE = {
  count: [],
  // a number
  give: ["bitte$", "hier$", "nimm", "nehm", "gib$", "geb$", "bittesch\xF6n"],
  take: ["danke$", "dankesch\xF6n", "vielen dank", "nimm", "nehm"],
  welcome: ["willkommen", "herzlich$", "herein$", "komm", "bitte$"],
  wave: ["hallo$", "hi$", "servus$", "moin$", "tsch\xFCss$", "tsch\xFCs$", "tschau$", "auf wiedersehen", "wiedersehen", "guten tag", "guten morgen", "guten abend", "gute nacht", "gr\xFC\xDF", "bis bald", "bis morgen"],
  nod: ["ja$", "okay$", "ok$", "klar$", "genau$", "gut$", "stimmt$", "richtig$", "nat\xFCrlich$", "gern$", "gerne$", "einverstanden", "verstanden", "in ordnung", "alles klar"],
  shake_head: ["nein$", "kein", "nicht$", "nichts$", "nie$", "nee$", "n\xF6$"],
  cik: ["nein$", "nee$", "n\xF6$", "nicht$", "nichts$", "kein"],
  shrug: ["wei\xDF$", "weiss$", "keine ahnung", "vielleicht$", "leider$", "aber$", "tja$", "naja$", "hm$"],
  hand_heart: ["danke$", "dankesch\xF6n", "bitte$", "gern$", "gerne$", "freut$", "herzlich$", "vielen dank"],
  me: ["ich$", "mich$", "mir$", "mein$", "meine$", "meinen$", "meinem$"],
  you: ["du$", "sie$", "dich$", "dir$", "ihr$", "euch$", "dein$", "deine$", "deinen$", "deinem$"],
  beckon: ["komm", "her$", "hierher", "hierhin"],
  stop: ["halt$", "stopp$", "stop$", "warte$", "moment$", "nein$", "genug$"],
  thumb_up: ["super$", "toll$", "tolle$", "prima$", "klasse$", "gut$", "wunderbar$", "perfekt$", "sehr gut", "bravo$", "sch\xF6n$", "ausgezeichnet", "lecker$"],
  shush: ["pst$", "sch$", "leise$", "ruhe$", "still$"],
  bow_head: ["entschuldig", "verzeih", "tut mir leid", "sorry$", "pardon$"],
  phone: ["hallo$", "telefon$", "handy$", "anruf$"]
};
var ascii = (s) => lowerDe(s).replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
var words2 = (text) => tokens2(text).map((t) => t.kind === "word" ? { w: lowerDe(t.text).replace(/[’']/g, "'"), i: t.i } : { w: t.mark === "comma" ? "," : ".", i: t.i, pause: true, q: t.text === "?" });
var ADVERB = /^(hier|da|dort)$/;
var NEGATION = /^(kein\p{L}*|nichts|nicht)$/u;
var CLAUSE = /^(aber|und|oder|sondern|doch)$/;
function lintLine(c) {
  const { st, words: ws, plain, add } = c;
  const word = (k) => ws[k] && !ws[k].pause ? ws[k] : null;
  ws.forEach((t, i) => {
    if (t.pause) return;
    let d = null, tgt = null, phrase = "";
    const dw = deixis2(t.w);
    if (dw) {
      for (const k of [i + 1, i + 2]) {
        const w = word(k);
        if (!w) break;
        const link = c.linkOf(w.w);
        if (link) {
          d = dw;
          tgt = link;
          phrase = ws.slice(i, k + 1).map((x) => x.w).join(" ");
          break;
        }
      }
    } else if (ADVERB.test(t.w) && i > 0 && word(i - 1) && !deixis2(word(i - 1).w)) {
      const link = c.linkOf(ws[i - 1].w);
      if (link) {
        d = t.w === "hier" ? "dies" : "da";
        tgt = link;
        phrase = `${ws[i - 1].w} ${t.w}`;
      }
    }
    if (d && tgt) {
      if (!st.do || !DEIXIS_GESTURES.has(st.do) || st.at !== tgt) {
        add("deixis", `"${phrase}" needs a deixis gesture at ${tgt} (${ADVICE[d]})`, { do: ADVICE[d], at: tgt });
      } else {
        const held = c.holds(tgt), far = c.distance(tgt);
        if (!AGREE[d].includes(st.do)) add("deixis", `"${phrase}" with ${st.do}: ${d === "dies" ? "dieser" : d === "jen" ? "jener" : "da"} takes ${AGREE[d].join(" or ")}`, { do: ADVICE[d], at: tgt });
        else if (held && d !== "dies") add("deixis", `"${phrase}": ${c.who} holds it, so it is dieser`, void 0, "warning");
        else if (d === "dies" && st.do === "point" && far !== null && far > NEAR2) add("deixis", `"${phrase}": dieser is near, but ${tgt} is ${far.toFixed(1)} m away (jener, or hold it up)`);
        else if (d === "jen" && st.do === "point" && far !== null && far < FAR) add("deixis", `"${phrase}": jener is far, but ${tgt} is ${far.toFixed(1)} m away (dieser)`, { do: "point", at: tgt }, "warning");
        else if (d === "dies" && far !== null && far > NEAR2) add("deixis", `"${phrase}": dieser is near, but ${tgt} is ${far.toFixed(1)} m away`, void 0, "warning");
        else if (d === "jen" && far !== null && far <= NEAR2) add("deixis", `"${phrase}": jener is far, but ${tgt} is within reach (${far.toFixed(1)} m)`, void 0, "warning");
      }
    }
    if (t.w === "gibt" && (ws[i - 1]?.w === "es" || ws[i + 1]?.w === "es")) {
      let from = i, to = i;
      while (from > 0 && !(ws[from - 1].pause && ws[from - 1].w === ".")) from--;
      while (to < ws.length && !(ws[to].pause && ws[to].w === ".")) to++;
      const sentence = ws.slice(from, to + 1), question = sentence.some((w) => w.q) || sentence.find((w) => !w.pause)?.w === "gibt";
      if (question) return;
      const seen = /* @__PURE__ */ new Set();
      let negated = false;
      for (let k = i + 1; k < to && ws[k].w !== "gibt"; k++) {
        const w = ws[k];
        if (w.pause || CLAUSE.test(w.w)) {
          negated = false;
          continue;
        }
        if (NEGATION.test(w.w)) {
          negated = true;
          continue;
        }
        const subj = c.linkOf(w.w), id = subj?.startsWith("obj:") ? subj.slice(4) : null, p = id ? c.prop(id) : null;
        if (!p || seen.has(id)) continue;
        let neg = negated;
        for (let j = k + 1; !neg && j < to && !ws[j].pause && !CLAUSE.test(ws[j].w) && ws[j].w !== "gibt"; j++) if (NEGATION.test(ws[j].w)) neg = true;
        seen.add(id);
        if (!neg && !p.shown) add("var_yok", `"gibt": ${subj} is hidden here; show it on this line or before`, { obj: [{ id, op: "show" }] });
        if (neg && p.shown) add("var_yok", `"gibt \u2026 kein": ${subj} is still shown; hide it (a dashed outline) on this line`, { obj: [{ id, op: "hide" }] });
      }
    }
    const plainIdx = plain.indexOf(t.w, ws.slice(0, i).filter((w) => !w.pause).length);
    const num = plainIdx > 0 && readNumber2(plain, plainIdx - 1) ? null : readNumber2(plain, plainIdx);
    if (num && plainIdx >= 0) {
      const noun = plain[plainIdx + num.len];
      const nt = noun ? c.linkOf(noun) : null;
      const id = nt?.startsWith("obj:") ? nt.slice(4) : null;
      if (id) {
        const ns = [...st.do === "count" && st.n !== void 0 ? [st.n] : [], ...(st.obj ?? []).filter((op) => op.id === id && op.n !== void 0).map((op) => op.n)];
        const assert = plain.includes("gibt") || plain.slice(plainIdx + num.len).some((w) => ADVERB.test(w));
        const have = c.prop(id)?.n;
        if (ns.length && !ns.includes(num.n)) add("number", `"${plain.slice(plainIdx, plainIdx + num.len + 1).join(" ")}" says ${num.n}, but the line's n is ${ns.join(", ")}`, st.do === "count" ? { do: "count", n: num.n } : void 0);
        else if (!ns.length && assert && have !== void 0 && have !== num.n && num.n !== 1) add("number", `"${num.n} ${noun}", but ${nt} shows ${have}`, { obj: [{ id, op: "set", set: { n: num.n } }] });
      }
    }
  });
  lintClock(c, readClock2, clockMinutes2);
}
var PARENTHETICAL = {
  winkt: { do: "wave" },
  zeigt: { do: "point" },
  nickt: { do: "nod" },
  "zuckt mit den schultern": { do: "shrug" },
  schultern: { do: "shrug" },
  l\u00E4chelt: { emo: "happy" },
  lacht: { emo: "laugh" },
  froh: { emo: "happy" },
  gl\u00FCcklich: { emo: "happy" },
  traurig: { emo: "sad" },
  \u00FCberrascht: { emo: "surprised" },
  fl\u00FCstert: { voice: "whisper" }
};
var deLang = {
  id: "de",
  lower: lowerDe,
  words: words2,
  match: match2,
  fold: ascii,
  pointing: (w) => {
    const d = deixis2(w);
    return d === "dies" || d === "jen";
  },
  namesPlace: (w) => /^(hier|dort|drinnen|draußen|draussen)$/.test(w),
  motive: MOTIVE,
  number: readNumber2,
  lintLine,
  checkWords: words,
  resolver,
  parenthetical: PARENTHETICAL
};

// ../sahne-en/src/numbers.ts
var ONES2 = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
var TENS2 = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
var SCALES = [[1e9, "billion"], [1e6, "million"], [1e3, "thousand"]];
function below100(n) {
  if (n < 20) return n ? [ONES2[n]] : [];
  return [TENS2[Math.floor(n / 10)], ...n % 10 ? [ONES2[n % 10]] : []];
}
function below1000(n) {
  const h = Math.floor(n / 100), r = n % 100;
  return [...h ? [ONES2[h], "hundred"] : [], ...h && r ? ["and"] : [], ...below100(r)];
}
var sayDigits2 = (d) => [...d].filter((c) => c >= "0" && c <= "9").map((c) => c === "0" ? "zero" : ONES2[+c]).join(" ");
function sayNumber2(n) {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `minus ${sayNumber2(-n)}`;
  n = Math.floor(n);
  if (n === 0) return "zero";
  if (n >= 1e12) return sayDigits2(n.toFixed(0));
  const out = [];
  let rest = n;
  for (const [v, w] of SCALES) {
    const q = Math.floor(rest / v);
    if (q) out.push(...below1000(q), w);
    rest %= v;
  }
  if (rest) out.push(...out.length && rest < 100 ? ["and"] : [], ...below1000(rest));
  return out.join(" ");
}
function sayYear(n) {
  const hi = Math.floor(n / 100), lo = n % 100;
  if (!lo) return `${sayNumber2(hi)} hundred`;
  return `${sayNumber2(hi)} ${lo < 10 ? `oh ${ONES2[lo]}` : sayNumber2(lo)}`;
}
var IRREGULAR2 = { one: "first", two: "second", three: "third", five: "fifth", eight: "eighth", nine: "ninth", twelve: "twelfth" };
function ordinal2(words9) {
  const parts = words9.split(" "), last = parts[parts.length - 1];
  parts[parts.length - 1] = IRREGULAR2[last] ?? (last.endsWith("y") ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return parts.join(" ");
}
var whole2 = (d) => d.length > 1 && d[0] === "0" || d.length > 12 ? sayDigits2(d) : sayNumber2(+d);
function sayNumeral2(s, ord = false) {
  let post = "";
  if (s.endsWith("%")) {
    post = " percent";
    s = s.slice(0, -1);
  }
  let out, m4;
  if ((m4 = /^(\d{1,2}):(\d{2})$/.exec(s)) && +m4[1] <= 24 && +m4[2] < 60) out = +m4[2] ? `${sayNumber2(+m4[1])} ${m4[2][0] === "0" ? `oh ${ONES2[+m4[2]]}` : sayNumber2(+m4[2])}` : `${sayNumber2(+m4[1])} o clock`;
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) out = sayNumber2(+s.replace(/,/g, ""));
  else if (m4 = /^(\d+)\.(\d+)$/.exec(s)) out = `${whole2(m4[1])} point ${sayDigits2(m4[2])}`;
  else if (/^\d{4}$/.test(s) && !ord && (+s >= 1100 && +s <= 1999 || +s >= 2010 && +s <= 2099)) out = sayYear(+s);
  else if (/^\d+$/.test(s)) out = whole2(s);
  else out = s.replace(/\d+/g, (d) => ` ${whole2(d)} `).replace(/[^\p{L}]+/gu, " ").trim();
  return (ord ? ordinal2(out) : out) + post;
}
var WORD = /* @__PURE__ */ new Map();
ONES2.forEach((w, i) => {
  if (w) WORD.set(w, i);
});
TENS2.forEach((w, i) => {
  if (w) WORD.set(w, i * 10);
});
WORD.set("zero", 0);
WORD.set("nought", 0);
var MULT = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 };
function readNumber3(words9, i) {
  const first = words9[i];
  if (first === void 0) return null;
  if (/^\d{1,3}(,\d{3})+$|^\d+$/.test(first)) return { n: +first.replace(/,/g, ""), len: 1 };
  let total = 0, cur = 0, len = 0, seen = false, j = i;
  const pieces = (w) => w.split("-");
  if (first === "a" && words9[i + 1] in MULT) {
    cur = 1;
    seen = true;
    len = 1;
    j = i + 1;
  }
  for (; j < words9.length; j++) {
    const ps = pieces(words9[j]);
    if (!ps.every((p) => WORD.has(p) || p in MULT)) {
      if (words9[j] === "and" && seen && j + 1 < words9.length && pieces(words9[j + 1]).every((p) => WORD.has(p)) && (cur >= 100 || total >= 1e3 || cur === 0 && total)) {
        len++;
        continue;
      }
      break;
    }
    let ok = true, c = cur;
    for (const p of ps) {
      if (p in MULT) {
        const m4 = MULT[p];
        if (!c && !total) {
          ok = false;
          break;
        }
        if (m4 === 100) c = (c || 1) * 100;
        else {
          total += (c || 1) * m4;
          c = 0;
        }
      } else {
        const v = WORD.get(p), r = c % 100;
        if (v === 0 ? seen || ps.length > 1 : v < 10 ? !(r === 0 || r >= 20 && r % 10 === 0) : r !== 0) {
          ok = false;
          break;
        }
        c += v;
      }
    }
    if (!ok) break;
    cur = c;
    seen = true;
    len++;
  }
  return seen ? { n: total + cur, len } : null;
}

// ../sahne-en/src/text.ts
var lowerEn = (s) => s.normalize("NFC").toLowerCase().replace(/[’ʼ‘`´]/g, "'");
var ABBR = {
  mr: "mister",
  mrs: "missus",
  ms: "miz",
  dr: "doctor",
  km: "kilometre",
  kg: "kilogram",
  cm: "centimetre",
  ml: "millilitre",
  ok: "okay",
  vs: "versus",
  etc: "et cetera"
};
var CONTRACTION = {
  "i'm": "aim",
  "i'll": "ail",
  "i've": "aiv",
  "i'd": "aid",
  "o'clock": "o clock",
  "ma'am": "mam",
  "y'all": "yol",
  "won't": "wont",
  "can't": "cant",
  "shan't": "shant",
  "ain't": "ent",
  "let's": "lets"
};
var CURRENCY = { "\xA3": ["pound", "pence"], "$": ["dollar", "cent"], "\u20AC": ["euro", "cent"] };
var LETTER2 = {
  b: "bee",
  c: "see",
  d: "dee",
  f: "ef",
  g: "gee",
  h: "aitch",
  j: "jay",
  k: "kay",
  l: "el",
  m: "em",
  n: "en",
  p: "pee",
  q: "cue",
  r: "ar",
  s: "es",
  t: "tee",
  v: "vee",
  w: "double you",
  x: "ex",
  y: "why",
  z: "zed"
};
var HUM2 = /^h?m{2,}h?$|^h+m+$/;
var SHUSH2 = /^(?:p?s+h+t?|sh+|p?s+t)$/;
function sayWord2(word) {
  const s = lowerEn(word);
  if (CONTRACTION[s]) return CONTRACTION[s];
  if (ABBR[s]) return ABBR[s];
  let m4;
  if (m4 = /^([£$€])(\d[\d,]*)(?:\.(\d{2}))?$/.exec(s)) {
    const [unit, minor] = CURRENCY[m4[1]], major = +m4[2].replace(/,/g, "");
    const out2 = major || !+(m4[3] ?? 0) ? [sayNumeral2(String(major)), major === 1 ? unit : `${unit}s`] : [];
    if (m4[3] && +m4[3]) out2.push(sayNumeral2(String(+m4[3])), ...major ? [] : [+m4[3] === 1 ? minor === "pence" ? "penny" : minor : minor]);
    return out2.join(" ");
  }
  if (m4 = /^(\d+)(?:st|nd|rd|th)$/.exec(s)) return sayNumeral2(m4[1], true);
  const read = s.replace(/'/g, "").replace(/\d+(?:[.,:]\d+)*%?/g, (n, at) => (at > 0 && /\p{L}/u.test(s[at - 1]) ? " " : "") + sayNumeral2(n) + " ");
  const out = read.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const letters4 = out.replace(/ /g, "");
  if (HUM2.test(letters4) || SHUSH2.test(letters4) || !/^[a-z]+$/.test(letters4) || /[aeiouy]/.test(letters4) || letters4.length > 5) return out;
  return [...letters4].map((c) => LETTER2[c] ?? c).join(" ");
}
var TOKEN2 = /([£$€]?[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:(?:['’ʼ‘-]|(?<=\p{N})[.:,](?=\p{N}))[\p{L}\p{M}\p{N}]+)*%?)|(\.{2,}|…|[.,;:!?—–]|(?<=^|\s)-(?=\s|$))/gu;
function tokens3(text) {
  const out = [];
  for (const m4 of text.matchAll(TOKEN2)) {
    const i = m4.index ?? 0;
    if (m4[1]) out.push({ kind: "word", i, text: m4[1], said: sayWord2(m4[1]) });
    else {
      const p = m4[2];
      out.push({ kind: "pause", i, text: p, mark: p === "\u2026" || p.length > 1 ? "ellipsis" : ".!?".includes(p) ? "stop" : "comma" });
    }
  }
  return out;
}

// ../sahne-en/src/speech.ts
var TIMING2 = {
  /** A syllable: its onset consonant and its vowel. */
  syllable: 200,
  /** An unstressed schwa (the -er of water, the -le of table): a shorter syllable. */
  schwa: 140,
  /** Lips closed for m b p, taken from the syllable they start (or added, at the end of one). */
  mbp: 70,
  /** Lower lip on the teeth for f v. */
  fv: 60,
  /** A short close between two syllables with the same mouth shape, so the mouth does not freeze. */
  dip: 50,
  /** Each extra consonant of a cluster at the start or end of a word (street, next, strengths). */
  cluster: 40,
  /** The shortest a vowel gets when labials eat into its syllable. */
  minVowel: 100,
  /** Where a gliding vowel moves to its second shape, as a share of the vowel. */
  glide: 0.55,
  /** Between two words. */
  gap: 60,
  comma: 250,
  stop: 450,
  ellipsis: 600,
  /** A line that is only "…" (the silent card). */
  silent: 900,
  /** Per letter of a hum (hmm) or a shush (shh), within 300–600 ms. */
  hum: 120
};
var PAUSE2 = { comma: TIMING2.comma, stop: TIMING2.stop, ellipsis: TIMING2.ellipsis };
var LIP_MS2 = { MBP: TIMING2.mbp, FV: TIMING2.fv };

// ../sahne-en/src/match.ts
var IRREGULAR3 = {
  // nouns
  child: "children",
  man: "men",
  woman: "women",
  mouse: "mice",
  foot: "feet",
  tooth: "teeth",
  person: "people",
  goose: "geese",
  ox: "oxen",
  wolf: "wolves",
  knife: "knives",
  leaf: "leaves",
  life: "lives",
  loaf: "loaves",
  shelf: "shelves",
  half: "halves",
  thief: "thieves",
  calf: "calves",
  wife: "wives",
  scarf: "scarves",
  sheep: "sheep",
  fish: "fish fishes",
  deer: "deer",
  series: "series",
  police: "police",
  // verbs
  be: "am is are was were been being",
  have: "has had having",
  do: "does did done doing",
  go: "goes went gone going",
  buy: "bought buys buying",
  bring: "brought",
  take: "took taken taking",
  give: "gave given giving",
  get: "got gotten getting",
  make: "made making",
  eat: "ate eaten eating",
  drink: "drank drunk",
  see: "saw seen seeing",
  come: "came coming",
  say: "said",
  tell: "told",
  sell: "sold",
  pay: "paid",
  leave: "left leaving",
  find: "found",
  know: "knew known",
  think: "thought",
  write: "wrote written writing",
  run: "ran running",
  sit: "sat sitting",
  stand: "stood",
  speak: "spoke spoken",
  wear: "wore worn",
  break: "broke broken",
  choose: "chose chosen choosing",
  drive: "drove driven driving",
  ride: "rode ridden riding",
  sing: "sang sung",
  swim: "swam swum swimming",
  begin: "began begun beginning",
  forget: "forgot forgotten forgetting",
  meet: "met",
  read: "read",
  lose: "lost losing",
  hold: "held",
  keep: "kept",
  sleep: "slept",
  feel: "felt",
  put: "putting",
  cut: "cutting",
  hit: "hitting",
  let: "letting",
  catch: "caught",
  teach: "taught",
  fall: "fell fallen",
  draw: "drew drawn",
  grow: "grew grown",
  throw: "threw thrown",
  fly: "flew flown flying",
  wake: "woke woken waking",
  build: "built",
  send: "sent",
  spend: "spent",
  lend: "lent",
  hang: "hung",
  dig: "dug digging",
  win: "won winning",
  steal: "stole stolen",
  hide: "hid hidden hiding",
  bite: "bit bitten biting",
  lead: "led",
  feed: "fed",
  hear: "heard",
  mean: "meant",
  lie: "lay lying",
  die: "dying",
  tie: "tying",
  bake: "baking",
  ask: "asks asked asking"
};
var IRR = new Map(Object.entries(IRREGULAR3).map(([k, v]) => [k, new Set(v.split(" "))]));
var LEMMAS = /* @__PURE__ */ new Map();
for (const [k, forms2] of IRR) for (const f of forms2) (LEMMAS.get(f) ?? LEMMAS.set(f, []).get(f)).push(k);
var V = "aeiou";
var isV = (c) => c !== void 0 && V.includes(c);
function forms(t) {
  const out = /* @__PURE__ */ new Set([t]);
  const last = t[t.length - 1], pre = t[t.length - 2];
  if (/(?:[sxz]|ch|sh)$/.test(t) || last === "o" && !isV(pre) && t.length > 2) {
    out.add(`${t}es`);
    if (last === "o") out.add(`${t}s`);
  } else if (last === "y" && !isV(pre)) out.add(`${t.slice(0, -1)}ies`);
  else out.add(`${t}s`);
  const stems = [];
  if (last === "e") {
    out.add(`${t}d`);
    stems.push(t.slice(0, -1));
  } else if (last === "y" && !isV(pre)) {
    out.add(`${t.slice(0, -1)}ied`);
    stems.push(t);
  } else stems.push(t);
  if (t.endsWith("ie")) out.add(`${t.slice(0, -2)}ying`);
  for (const s of stems) {
    out.add(`${s}ed`);
    out.add(`${s}ing`);
  }
  if (t.length >= 3 && !isV(last) && !"wxy".includes(last) && isV(pre) && !isV(t[t.length - 3])) {
    out.add(`${t}${last}ed`);
    out.add(`${t}${last}ing`);
  }
  if (t.endsWith("ee")) {
    out.delete(`${t.slice(0, -1)}ing`);
    out.add(`${t}ing`);
  }
  return out;
}
function inflections(t) {
  const out = forms(t);
  for (const f of IRR.get(t) ?? []) out.add(f);
  for (const l of LEMMAS.get(t) ?? []) {
    out.add(l);
    for (const f of forms(l)) out.add(f);
    for (const f of IRR.get(l) ?? []) out.add(f);
  }
  return out;
}
var clean2 = (s) => lowerEn(s).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
var bare = (w) => w.replace(/'s$/, "").replace(/(?<=s)'$/, "");
function match3(word, token) {
  const w = bare(clean2(word)), parts = clean2(token).split(/[\s-]+/).filter(Boolean);
  if (!w || !parts.length) return false;
  const t = parts[parts.length - 1];
  if (matchOne(w, t)) return true;
  const head = parts.slice(0, -1).join("");
  return !!head && w.startsWith(head) && w.length > head.length && matchOne(w.slice(head.length), t);
}
function matchOne(w, t) {
  if (w === t || forms(t).has(w)) return true;
  if (IRR.get(t)?.has(w)) return true;
  for (const l of LEMMAS.get(t) ?? []) if (w === l || forms(l).has(w) || IRR.get(l)?.has(w)) return true;
  return false;
}
function deixis3(word) {
  const w = clean2(word);
  return w === "this" || w === "these" || w === "that" || w === "those" ? w : null;
}
var isNear = (d) => d === "this" || d === "these";

// ../sahne-en/src/listen.ts
var FILLER2 = /^(?:u+m+|u+h+|e+r+m*|e+h+|h+m+|m{2,})$/;
var VARIANTS2 = {
  okay: "ok",
  alright: "all right",
  gonna: "going to",
  wanna: "want to",
  gotta: "got to",
  gimme: "give me",
  lemme: "let me",
  kinda: "kind of",
  sorta: "sort of",
  thankyou: "thank you",
  color: "colour",
  favorite: "favourite",
  neighbor: "neighbour",
  center: "centre",
  theater: "theatre",
  gray: "grey",
  mom: "mum",
  donut: "doughnut",
  realize: "realise",
  organize: "organise"
};
function expand(text) {
  return lowerEn(text).replace(/\bcan't\b/g, "can not").replace(/\bwon't\b/g, "will not").replace(/\bshan't\b/g, "shall not").replace(/\bain't\b/g, "is not").replace(/\blet's\b/g, "let us").replace(/\bcannot\b/g, "can not").replace(/(\p{L}+)n't\b/gu, "$1 not").replace(/(\p{L})'m\b/gu, "$1 am").replace(/(\p{L})'re\b/gu, "$1 are").replace(/(\p{L})'ve\b/gu, "$1 have").replace(/(\p{L})'ll\b/gu, "$1 will").replace(/(\p{L})'d\b/gu, "$1 would").replace(/\b(it|he|she|that|there|what|who|here|where|how|when)'s\b/g, "$1 is").replace(/(\p{L})'s\b/gu, "$1").replace(/(\p{L}s)'(?!\p{L})/gu, "$1");
}
function spoken2(said) {
  const out = [];
  for (const t of tokens3(expand(said))) {
    if (t.kind !== "word") continue;
    for (const w0 of t.said.split(/\s+/)) out.push(w0.replace(/[^\p{L}\p{N}]/gu, ""));
  }
  return out;
}
var m2 = lineMatcher({ normalise: spoken2, fillers: FILLER2, spellings: VARIANTS2 });
var sayWords2 = m2.sayWords;
var normalise2 = m2.normalise;
var letters2 = m2.letters;
var allowance2 = m2.allowance;

// ../sahne-en/src/time.ts
var HOUR = new Map(["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"].map((w, k) => [w, k + 1]));
function hourAt2(words9, i) {
  const w = words9[i];
  if (HOUR.has(w)) return HOUR.get(w);
  if (w === "noon") return 12;
  if (w === "midnight") return 0;
  return /^\d{1,2}$/.test(w ?? "") && +w <= 24 ? +w : null;
}
function minutesAt2(words9, i) {
  if (words9[i] === "quarter") return { m: 15, len: 1 };
  if (words9[i] === "half") return { m: 30, len: 1 };
  const r = readNumber3(words9, i);
  return r && r.n > 0 && r.n < 60 ? { m: r.n, len: r.len } : null;
}
function readClock3(text) {
  const out = [];
  const low = lowerEn(text).replace(/o'clock/g, "oclock");
  for (const m4 of low.matchAll(/(?<![\d.:£$€])(\d{1,2})([:.])(\d{2})(?![\d]|[.:]\d)\s*(am|pm)?/g)) {
    if (m4[2] === "." && !m4[4] && !/\b(?:at|it's|it is)\s*$/.test(low.slice(Math.max(0, m4.index - 8), m4.index))) continue;
    let h = +m4[1];
    if (m4[4] === "pm" && h < 12) h += 12;
    if (m4[4] === "am" && h === 12) h = 0;
    if (h <= 24 && +m4[3] < 60) out.push({ h, m: +m4[3] });
  }
  const words9 = low.replace(/(\d)[:.](\d)/g, "$1_$2").split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  for (let i = 0; i < words9.length; i++) {
    const mm = minutesAt2(words9, i);
    if (mm && mm.m % 5 === 0) {
      let j = i + mm.len;
      if (words9[j] === "minutes" || words9[j] === "minute") j++;
      const dir = words9[j], past = dir === "past" || dir === "after";
      if (past || (dir === "to" || dir === "til" || dir === "till" || dir === "before") && mm.m <= 25) {
        const h2 = hourAt2(words9, j + 1);
        if (h2 !== null && (h2 >= 1 || words9[j + 1] === "midnight")) {
          out.push(past ? { h: h2, m: mm.m } : { h: h2 === 0 ? 23 : h2 === 1 ? 12 : h2 - 1, m: 60 - mm.m });
          i = j + 1;
          continue;
        }
      }
    }
    if (words9[i] === "half" && words9[i + 1] !== "past") {
      const h2 = hourAt2(words9, i + 1);
      if (h2 !== null && HOUR.has(words9[i + 1])) {
        out.push({ h: h2, m: 30 });
        i++;
        continue;
      }
    }
    const h = hourAt2(words9, i);
    if (h === null) continue;
    if (words9[i + 1] === "oclock") {
      out.push({ h, m: 0 });
      i++;
      continue;
    }
    const p = words9[i - 1];
    if (p === "at" || p === "s" && words9[i - 2] === "it" || p === "is" && words9[i - 2] === "it") {
      let k = i + 1;
      if (words9[k] === "oh") k++;
      const mins = words9[k] === "quarter" || words9[k] === "half" ? null : minutesAt2(words9, k);
      if (mins) {
        out.push({ h, m: mins.m });
        i = k + mins.len - 1;
      } else if (words9[i] === "noon" || words9[i] === "midnight") out.push({ h, m: 0 });
    }
  }
  return out;
}
function clockMinutes3(t) {
  const c = typeof t === "string" ? (/^(\d{1,2})[:.](\d{2})$/.exec(t.trim()) ?? []).slice(1).map(Number) : [t.h, t.m];
  if (c.length !== 2 || c.some((x) => !Number.isFinite(x))) return null;
  return c[0] % 12 * 60 + c[1];
}

// ../sahne-story/src/langs/en-words.ts
var PARTICLES2 = new Set("a an the this that these those it its he she we they you i me him her us them my your his our their mine yours hers ours theirs myself yourself himself herself itself ourselves themselves am is are was were be been being do does did done doing have has had having will would shall should can could may might must not no yes yeah yep nope ok okay and or but so because if then than as of to in on at by for with from about into over under up down out off here there where when what who whom whose which why how very too also just only still even all any some many much more most few little lot lots another each every both either neither other such own same please thanks thank sorry hello hi hey goodbye bye welcome pardon excuse oh well now let lets us got get go going gonna wanna s t d ll re ve m".split(" "));
var NUMBERS = new Set("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand million first second third fourth fifth sixth seventh eighth ninth tenth half quarter pound pounds pence penny dollar dollars cent cents euro euros oclock o clock percent point".split(" "));
function words3(text) {
  return tokens3(expand(text)).filter((t) => t.kind === "word" && !/^[£$€]?\d/.test(t.text)).flatMap((t) => t.text.split("-")).map((w) => w.replace(/'/g, "")).filter(Boolean);
}
function resolver2(entries, opts = {}) {
  const known = /* @__PURE__ */ new Set();
  for (const e of entries) for (const w of words3(e)) for (const f of inflections(w)) known.add(f);
  return (token) => known.has(token) || NUMBERS.has(token) || opts.particles !== false && PARTICLES2.has(token);
}

// ../sahne-story/src/langs/en.ts
var AGREE2 = { this: ["hold_up", "touch", "point"], these: ["hold_up", "touch", "point"], that: ["point_far", "point"], those: ["point_far", "point"] };
var ADVICE2 = { this: "hold_up", these: "hold_up", that: "point_far", those: "point_far" };
var THAT_JOINS = /* @__PURE__ */ new Set(["think", "thought", "say", "says", "said", "know", "knew", "hope", "believe", "see", "saw", "mean", "means", "so", "glad", "sure$", "sorry", "hear", "heard", "feel", "felt", "guess", "suppose", "wish", "fact", "now", "such", "is", "was"]);
var MOTIVE2 = {
  count: [],
  // a number
  give: ["here$", "take$", "there you go", "you go"],
  take: ["thank", "thanks", "take$", "cheers", "ta$"],
  welcome: ["welcome", "come in", "come$", "please", "hello"],
  wave: ["hello", "hi$", "hey", "goodbye", "bye", "see you", "good morning", "good afternoon", "good evening", "good night", "cheers", "morning", "evening"],
  nod: ["yes$", "yeah", "yep", "ok$", "okay", "sure$", "right$", "of course", "alright", "all right", "i see", "exactly", "indeed", "certainly", "correct"],
  shake_head: ["no$", "not$", "never$", "nope", "none$", "isn't", "aren't", "don't", "doesn't", "can't", "won't", "wasn't", "haven't", "sorry"],
  cik: ["no$", "nope", "not$", "never$", "tut"],
  shrug: ["don't know", "dunno", "do not know", "maybe", "perhaps", "sorry", "but$", "no idea", "who knows", "unfortunately", "whatever", "not sure"],
  hand_heart: ["thank", "please", "sorry", "pleasure", "welcome", "bless", "glad", "lovely", "kind"],
  me: ["me$", "my$", "mine$", "i'm", "i'd", "i'll", "i've", "i am", "i have", "i would", "i will", "i can", "i need", "i want", "i like", "i don't", "i do"],
  you: ["you$", "your$"],
  beckon: ["come$", "this way", "over here", "follow"],
  stop: ["stop$", "wait$", "hold on", "no$", "enough", "hang on"],
  thumb_up: ["great", "good$", "super", "excellent", "perfect", "nice$", "well done", "brilliant", "lovely", "fine$", "ok$", "okay", "fantastic", "wonderful"],
  shush: ["shh", "sh$", "hush", "quiet", "silence", "shush"],
  bow_head: ["sorry", "pardon", "excuse", "apolog", "forgive"],
  phone: ["hello", "phone", "call$", "ring$", "speaking"]
};
var ascii2 = (s) => lowerEn(s).normalize("NFD").replace(/\p{M}/gu, "");
var words4 = (text) => tokens3(text).map((t) => t.kind === "word" ? { w: lowerEn(t.text), i: t.i } : { w: t.mark === "comma" ? "," : ".", i: t.i, pause: true, q: t.text === "?" });
var BE = /* @__PURE__ */ new Set(["is", "are", "was", "were"]);
var BE_NOT = /* @__PURE__ */ new Set(["isn't", "aren't", "wasn't", "weren't"]);
function lintLine2(c) {
  const { st, words: ws, plain, add } = c;
  ws.forEach((t, i) => {
    if (t.pause) return;
    const prev = ws[i - 1];
    const d = deixis3(t.w);
    const cand = d ? [ws[i + 1], ws[i + 2]].filter((w) => w && !w.pause) : [];
    const noun = cand.find((w) => c.linkOf(w.w)), tgt = noun ? c.linkOf(noun.w) : null;
    if (d && tgt && !(d === "that" && prev && !prev.pause && THAT_JOINS.has(prev.w))) {
      const phrase = `${t.w} ${noun !== cand[0] ? cand[0].w + " " : ""}${noun.w}`;
      const near = isNear(d), far = c.distance(tgt), held = c.holds(tgt);
      if (!st.do || !DEIXIS_GESTURES.has(st.do) || st.at !== tgt) {
        add("deixis", `"${phrase}" needs a deixis gesture at ${tgt} (${ADVICE2[d]})`, { do: ADVICE2[d], at: tgt });
      } else if (!AGREE2[d].includes(st.do)) {
        add("deixis", `"${phrase}" with ${st.do}: ${d} takes ${AGREE2[d].filter((g) => g !== "point").join(" or ")}`, { do: ADVICE2[d], at: tgt });
      } else if (held && !near) add("deixis", `"${phrase}": ${c.who} holds it, so it is this`, void 0, "warning");
      else if (near && st.do === "point" && far !== null && far > NEAR2) add("deixis", `"${phrase}": ${d} is near, but ${tgt} is ${far.toFixed(1)} m away (that, or hold it up)`);
      else if (!near && st.do === "point" && far !== null && far < FAR) add("deixis", `"${phrase}": ${d} is far, but ${tgt} is ${far.toFixed(1)} m away (this)`, { do: "point", at: tgt }, "warning");
      else if (near && far !== null && far > NEAR2) add("deixis", `"${phrase}": ${d} is near, but ${tgt} is ${far.toFixed(1)} m away`, void 0, "warning");
      else if (!near && far !== null && far <= NEAR2) add("deixis", `"${phrase}": ${d} is far, but ${tgt} is within reach (${far.toFixed(1)} m)`, void 0, "warning");
    }
    const next = ws[i + 1];
    const there = t.w === "there's" || t.w === "there" && next && !next.pause && (BE.has(next.w) || BE_NOT.has(next.w));
    if (there && !(prev && !prev.pause && BE.has(prev.w))) {
      const verb = t.w === "there" ? next.w : "is";
      let neg = BE_NOT.has(verb), subj = null;
      for (let k = i + (t.w === "there" ? 2 : 1); k < ws.length && !(ws[k].pause && ws[k].w === "."); k++) {
        const w = ws[k];
        if (w.pause) continue;
        if (w.w === "no" || w.w === "not" || w.w === "none") neg = true;
        else if (subj = c.linkOf(w.w)) break;
      }
      const id = subj?.startsWith("obj:") ? subj.slice(4) : null, p = id ? c.prop(id) : null;
      if (p && !neg && !p.shown) add("var_yok", `"there ${neg ? "isn't" : "is"}": ${subj} is hidden here; show it on this line or before`, { obj: [{ id, op: "show" }] });
      if (p && neg && p.shown) add("var_yok", `"there isn't": ${subj} is still shown; hide it (a dashed outline) on this line`, { obj: [{ id, op: "hide" }] });
    }
    const plainIdx = plain.indexOf(t.w, ws.slice(0, i).filter((w) => !w.pause).length);
    const num = plainIdx > 0 && readNumber3(plain, plainIdx - 1) ? null : readNumber3(plain, plainIdx);
    if (num && plainIdx >= 0) {
      const noun2 = plain[plainIdx + num.len];
      const nt = noun2 ? c.linkOf(noun2) : null;
      const id = nt?.startsWith("obj:") ? nt.slice(4) : null;
      if (id) {
        const ns = [...st.do === "count" && st.n !== void 0 ? [st.n] : [], ...(st.obj ?? []).filter((op) => op.id === id && op.n !== void 0).map((op) => op.n)];
        const assert = plain.slice(0, plainIdx).some((w) => /^(there|there's|have|has|got|i've|we've)$/.test(w));
        const have = c.prop(id)?.n;
        if (ns.length && !ns.includes(num.n)) add("number", `"${plain.slice(plainIdx, plainIdx + num.len + 1).join(" ")}" says ${num.n}, but the line's n is ${ns.join(", ")}`, st.do === "count" ? { do: "count", n: num.n } : void 0);
        else if (!ns.length && assert && have !== void 0 && have !== num.n && num.n !== 1) add("number", `"${num.n} ${noun2}", but ${nt} shows ${have}`, { obj: [{ id, op: "set", set: { n: num.n } }] });
      }
    }
  });
  lintClock(c, readClock3, clockMinutes3);
}
var PARENTHETICAL2 = {
  waves: { do: "wave" },
  points: { do: "point" },
  nods: { do: "nod" },
  shrugs: { do: "shrug" },
  smiles: { emo: "happy" },
  laughs: { emo: "laugh" },
  happy: { emo: "happy" },
  sad: { emo: "sad" },
  surprised: { emo: "surprised" },
  whispers: { voice: "whisper" }
};
var enLang = {
  id: "en",
  lower: lowerEn,
  words: words4,
  match: match3,
  fold: ascii2,
  pointing: (w) => !!deixis3(w),
  namesPlace: () => false,
  motive: MOTIVE2,
  number: readNumber3,
  lintLine: lintLine2,
  checkWords: words3,
  resolver: resolver2,
  parenthetical: PARENTHETICAL2
};

// ../sahne-fa/src/numbers.ts
var ONES3 = ["", "\u06CC\u06A9", "\u062F\u0648", "\u0633\u0647", "\u0686\u0647\u0627\u0631", "\u067E\u0646\u062C", "\u0634\u0634", "\u0647\u0641\u062A", "\u0647\u0634\u062A", "\u0646\u0647", "\u062F\u0647", "\u06CC\u0627\u0632\u062F\u0647", "\u062F\u0648\u0627\u0632\u062F\u0647", "\u0633\u06CC\u0632\u062F\u0647", "\u0686\u0647\u0627\u0631\u062F\u0647", "\u067E\u0627\u0646\u0632\u062F\u0647", "\u0634\u0627\u0646\u0632\u062F\u0647", "\u0647\u0641\u062F\u0647", "\u0647\u062C\u062F\u0647", "\u0646\u0648\u0632\u062F\u0647"];
var TENS3 = ["", "", "\u0628\u06CC\u0633\u062A", "\u0633\u06CC", "\u0686\u0647\u0644", "\u067E\u0646\u062C\u0627\u0647", "\u0634\u0635\u062A", "\u0647\u0641\u062A\u0627\u062F", "\u0647\u0634\u062A\u0627\u062F", "\u0646\u0648\u062F"];
var HUNDREDS = ["", "\u0635\u062F", "\u062F\u0648\u06CC\u0633\u062A", "\u0633\u06CC\u0635\u062F", "\u0686\u0647\u0627\u0631\u0635\u062F", "\u067E\u0627\u0646\u0635\u062F", "\u0634\u0634\u0635\u062F", "\u0647\u0641\u062A\u0635\u062F", "\u0647\u0634\u062A\u0635\u062F", "\u0646\u0647\u0635\u062F"];
var SCALES2 = [[1e9, "\u0645\u06CC\u0644\u06CC\u0627\u0631\u062F"], [1e6, "\u0645\u06CC\u0644\u06CC\u0648\u0646"], [1e3, "\u0647\u0632\u0627\u0631"]];
function below10002(n) {
  const h = Math.floor(n / 100), r = n % 100;
  return [...h ? [HUNDREDS[h]] : [], ...r < 20 ? r ? [ONES3[r]] : [] : [TENS3[Math.floor(r / 10)], ...r % 10 ? [ONES3[r % 10]] : []]];
}
var sayDigits3 = (d) => [...d].filter((c) => c >= "0" && c <= "9").map((c) => c === "0" ? "\u0635\u0641\u0631" : ONES3[+c]).join(" ");
function sayNumber3(n) {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `\u0645\u0646\u0641\u06CC ${sayNumber3(-n)}`;
  n = Math.floor(n);
  if (n === 0) return "\u0635\u0641\u0631";
  if (n >= 1e21) return "";
  if (n >= 1e12) return sayDigits3(BigInt(n).toString());
  const terms = [];
  let rest = n;
  for (const [v, w] of SCALES2) {
    const q = Math.floor(rest / v);
    if (q) terms.push(q === 1 && v === 1e3 ? w : `${below10002(q).join(" \u0648 ")} ${w}`);
    rest %= v;
  }
  if (rest) terms.push(...below10002(rest));
  return terms.join(" \u0648 ");
}
function ordinal3(words9) {
  if (words9 === "\u06CC\u06A9") return "\u0627\u0648\u0644";
  const parts = words9.split(" "), last = parts[parts.length - 1];
  parts[parts.length - 1] = last === "\u0633\u0647" ? "\u0633\u0648\u0645" : last.endsWith("\u06CC") ? `${last}\u0627\u0645` : `${last}\u0645`;
  return parts.join(" ");
}
var whole3 = (d) => d.length > 1 && d[0] === "0" || d.length > 12 ? sayDigits3(d) : sayNumber3(+d);
function sayNumeral3(s, ord = false) {
  let post = "";
  if (s.endsWith("%")) {
    post = " \u062F\u0631\u0635\u062F";
    s = s.slice(0, -1);
  }
  let out, m4;
  if ((m4 = /^(\d{1,2}):(\d{2})$/.exec(s)) && +m4[1] <= 24 && +m4[2] < 60) out = +m4[2] ? `${sayNumber3(+m4[1])} \u0648 ${sayNumber3(+m4[2])}` : sayNumber3(+m4[1]);
  else if (/^\d{1,3}(,\d{3})+$/.test(s)) out = sayNumber3(+s.replace(/,/g, ""));
  else if (m4 = /^(\d+)[./](\d+)$/.exec(s)) out = `${whole3(m4[1])} \u0645\u0645\u06CC\u0632 ${sayDigits3(m4[2])}`;
  else if (/^\d+$/.test(s)) out = whole3(s);
  else out = s.replace(/\d+/g, (d) => ` ${whole3(d)} `).replace(/[^\p{L}]+/gu, " ").trim();
  return (ord ? ordinal3(out) : out) + post;
}
var WORD2 = /* @__PURE__ */ new Map();
ONES3.forEach((w, i) => {
  if (w) WORD2.set(w, i);
});
TENS3.forEach((w, i) => {
  if (w) WORD2.set(w, i * 10);
});
HUNDREDS.forEach((w, i) => {
  if (w) WORD2.set(w, i * 100);
});
for (const [w, n] of [["\u06CC\u0647", 1], ["\u0634\u06CC\u0634", 6], ["\u067E\u0648\u0646\u0632\u062F\u0647", 15], ["\u0634\u0648\u0646\u0632\u062F\u0647", 16], ["\u0647\u06CC\u062C\u062F\u0647", 18], ["\u067E\u0648\u0646\u0635\u062F", 500], ["\u067E\u0648\u0646\u0633\u062F", 500]]) WORD2.set(w, n);
var MULT2 = Object.assign(/* @__PURE__ */ Object.create(null), { \u0647\u0632\u0627\u0631: 1e3, \u0645\u06CC\u0644\u06CC\u0648\u0646: 1e6, \u0645\u06CC\u0644\u06CC\u0627\u0631\u062F: 1e9 });
var NINE_BEFORE = /* @__PURE__ */ new Set(["\u062A\u0627", "\u0648", ...Object.keys(MULT2), "\u0639\u062F\u062F", "\u062F\u0627\u0646\u0647", "\u0628\u0633\u062A\u0647", "\u0646\u0641\u0631", "\u0628\u0627\u0631", "\u062A\u0648\u0645\u0627\u0646", "\u0631\u06CC\u0627\u0644", "\u0631\u0648\u0632", "\u0633\u0627\u0639\u062A", "\u062F\u0642\u06CC\u0642\u0647", "\u06A9\u06CC\u0644\u0648"]);
function group(words9, j) {
  let v = 0, k = j, last = 0;
  for (; ; ) {
    const val = WORD2.get(words9[k]);
    if (val === void 0) break;
    const tier = val >= 100 ? 3 : val >= 20 ? 2 : 1;
    if (!(last === 0 || last === 3 && tier < 3 || last === 2 && val < 10)) break;
    if (val === 9 && words9[k] === "\u0646\u0647" && k === j && !NINE_BEFORE.has(words9[k + 1])) break;
    v += val;
    last = tier === 1 && val >= 10 ? 1 : tier;
    k++;
    const nv = words9[k] === "\u0648" ? WORD2.get(words9[k + 1]) : void 0;
    if (nv !== void 0 && (last === 3 && nv < 100 || last === 2 && nv < 10)) {
      k++;
      continue;
    }
    break;
  }
  return k > j ? { v, end: k } : null;
}
function readNumber4(words9, i) {
  const first = words9[i];
  if (first === void 0) return null;
  if (/^\d{1,3}(,\d{3})+$|^\d+$/.test(first)) return { n: +first.replace(/,/g, ""), len: 1 };
  if (first === "\u0635\u0641\u0631") return { n: 0, len: 1 };
  if (first.length > 2 && first.endsWith("\u062A\u0627") && WORD2.has(first.slice(0, -2))) return { n: WORD2.get(first.slice(0, -2)), len: 1 };
  let total = 0, k = i, scale = Infinity, seen = false;
  for (; ; ) {
    const g = group(words9, k), at = g ? g.end : k, m4 = MULT2[words9[at]];
    let v, end;
    if (g && m4 && m4 < scale) {
      v = g.v * m4;
      end = at + 1;
      scale = m4;
    } else if (!g && m4 && m4 < scale) {
      v = m4;
      end = k + 1;
      scale = m4;
    } else if (g) {
      v = g.v;
      end = g.end;
      scale = 1;
    } else break;
    total += v;
    k = end;
    seen = true;
    if (scale === 1) break;
    const nextM = MULT2[words9[k + 1]];
    if (words9[k] === "\u0648" && (group(words9, k + 1) || nextM && nextM < scale)) {
      k++;
      continue;
    }
    break;
  }
  return seen ? { n: total, len: k - i } : null;
}

// ../sahne-fa/src/text.ts
var FORM = {
  "\u064A": "\u06CC",
  "\u0649": "\u06CC",
  // ي ى → ی
  "\u0643": "\u06A9",
  // ك → ک
  "\u0629": "\u0647",
  "\u06BE": "\u0647",
  "\u06C1": "\u0647",
  "\u06D5": "\u0647",
  // ة ھ ہ ە → ه
  "\u06C0": "\u0647\u0654",
  // ۀ → ه with the hamza above, which is the written ezafe
  "\u0623": "\u0627",
  "\u0625": "\u0627",
  "\u0671": "\u0627",
  // أ إ ٱ → ا
  "\u0624": "\u0648"
  // ؤ → و
};
var FORMS = /[يىكةھہەۀأإٱؤ]/g;
var MARKS = /[ً-ٰٟـ‌‍]/g;
var foldLetters = (s) => s.normalize("NFC").toLowerCase().replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776)).replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632)).replace(/٫/g, ".").replace(/٬/g, ",").replace(/٪/g, "%").replace(FORMS, (c) => FORM[c]);
var lowerFa = (s) => foldLetters(s).replace(MARKS, "");
var ABBR2 = Object.assign(/* @__PURE__ */ Object.create(null), { "ok": "\u0627\u0648\u06A9\u06CC", "tv": "\u062A\u06CC \u0648\u06CC", "pm": "\u067E\u06CC \u0627\u0645" });
function sayWord3(word) {
  const s = foldLetters(word);
  if (ABBR2[s]) return ABBR2[s];
  let m4;
  if (m4 = /^(\d+)(?:ام|م)$/.exec(s)) return sayNumeral3(m4[1], true);
  if (m4 = /^(\d+)(?:ام|م)ین$/.exec(s)) return sayNumeral3(m4[1], true) + "\u06CC\u0646";
  const read = s.replace(/\d+(?:[.,:/]\d+)*%?/g, (n, at) => (at > 0 && /\p{L}/u.test(s[at - 1]) ? " " : "") + sayNumeral3(n) + " ");
  return read.replace(/-/g, " ").replace(/\s+/g, " ").trim();
}
var TOKEN3 = /([\p{L}\p{N}][\p{L}\p{M}\p{N}‌‍]*(?:(?:-|(?<=\p{N})[.:,/٫٬])[\p{L}\p{M}\p{N}‌‍]+)*[%٪]?)|(\.{2,}|…|[.,;:!?،؛؟۔—–]|(?<=^|\s)-(?=\s|$))/gu;
function tokens4(text) {
  const out = [];
  for (const m4 of text.matchAll(TOKEN3)) {
    const i = m4.index ?? 0;
    if (m4[1]) out.push({ kind: "word", i, text: m4[1], said: sayWord3(m4[1]) });
    else {
      const p = m4[2];
      out.push({ kind: "pause", i, text: p, mark: p === "\u2026" || p.length > 1 ? "ellipsis" : ".!?\u061F\u06D4".includes(p) ? "stop" : "comma" });
    }
  }
  return out;
}

// ../sahne-fa/src/g2p.ts
var CONS = {
  \u0628: "b",
  \u067E: "p",
  \u062A: "t",
  \u062B: "s",
  \u062C: "j",
  \u0686: "c",
  \u062D: "h",
  \u062E: "x",
  \u062F: "d",
  \u0630: "z",
  \u0631: "r",
  \u0632: "z",
  \u0698: "Z",
  \u0633: "s",
  \u0634: "S",
  \u0635: "s",
  \u0636: "z",
  \u0637: "t",
  \u0638: "z",
  \u0639: "'",
  \u063A: "G",
  \u0641: "f",
  \u0642: "q",
  \u06A9: "k",
  \u06AF: "g",
  \u0644: "l",
  \u0645: "m",
  \u0646: "n",
  \u0647: "h",
  \u0621: "'",
  \u0626: "'"
};
var CONSONANT_LETTERS = Object.keys(CONS).join("");
var EXCEPTIONS = Object.assign(/* @__PURE__ */ Object.create(null), {
  \u062A\u0648: "tO",
  \u062F\u0648: "dO",
  \u0631\u0648: "rO",
  \u0646\u0647: "na",
  \u062F\u0647: "dah",
  \u06CC\u06A9: "yek",
  \u062E\u0648\u062F: "xod",
  \u062E\u0648\u0627\u0647\u0631: "xAhar",
  \u062E\u0648\u0627\u0647\u0634: "xAhaS",
  \u0686\u0646\u062F: "cand",
  \u0627\u0633\u062A\u06A9\u0627\u0646: "astekAn",
  \u0632\u0646\u062F\u06AF\u06CC: "zendegI",
  \u0628\u062F\u0647\u06CC\u062F: "badehId",
  \u0628\u06CC\u0627\u0648\u0631\u06CC\u062F: "bIyAvarId",
  \u0645\u062A\u0634\u06A9\u0631\u0645: "moteSkeram",
  \u0645\u062A\u0634\u06A9\u0631: "moteSker"
});

// ../sahne-fa/src/speech.ts
var TIMING3 = {
  /** A syllable with a long vowel (ā i u o written): its onset consonant and its vowel. */
  syllable: 200,
  /** A syllable with a short vowel (a e o, written with a mark or estimated). */
  short: 160,
  /** The silent final ه of خانه, a light e. */
  light: 130,
  /** Lips closed for م ب پ, taken from the syllable they start (or added, at the end of one). */
  mbp: 70,
  /** Lower lip on the teeth for ف and the consonant و. */
  fv: 60,
  /** A short close between two syllables with the same mouth shape, so the mouth does not freeze. */
  dip: 50,
  /** Each extra consonant of a cluster at the start or end of a syllable. */
  cluster: 40,
  /** The shortest a vowel gets when labials eat into its syllable. */
  minVowel: 100,
  /** Between two words. */
  gap: 60,
  comma: 250,
  stop: 450,
  ellipsis: 600,
  /** A line that is only "…" (the silent card). */
  silent: 900,
  /** Per letter of a hum (هوم) or a shush (هیس), within 300–600 ms. */
  hum: 120
};
var PAUSE3 = { comma: TIMING3.comma, stop: TIMING3.stop, ellipsis: TIMING3.ellipsis };
var LIP_MS3 = { MBP: TIMING3.mbp, FV: TIMING3.fv };

// ../sahne-fa/src/match.ts
var CHAIN = /^(?:ها|ان|ین|ات|ا)?(?:ای|یی|ی)?(?:[یا]?(?:مان|تان|شان|مون|تون|شون|م|ت|ش))?(?:است|ست|ه|ام|ایم|اید|اند|یم|ید|ند)?(?:رو|و)?$/;
var clean3 = (s) => lowerFa(s).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
function ends(w, t) {
  if (endsAs(w, t)) return true;
  return /ان(?=ه?$)/.test(t) && t.length > 2 && endsAs(w, t.replace(/ان(?=ه?$)/, "\u0648\u0646"));
}
function endsAs(w, t) {
  if (w === t) return true;
  if (w.startsWith(t) && CHAIN.test(w.slice(t.length))) return true;
  if (/[او]$/.test(t) && w.startsWith(`${t}\u06CC\u0627\u0646`) && CHAIN.test(w.slice(t.length + 1))) return true;
  if (/[او]$/.test(t) && w.startsWith(`${t}\u06CC\u0648\u0646`) && CHAIN.test(w.slice(t.length + 3))) return true;
  if (t.endsWith("\u0647")) {
    const stem = t.slice(0, -1);
    if (w.startsWith(`${stem}\u06AF\u0627\u0646`) && CHAIN.test(w.slice(stem.length + 1))) return true;
    if (w.startsWith(`${stem}\u0627\u062A`) && CHAIN.test(w.slice(stem.length + 2))) return true;
  }
  return false;
}
var isEnding = (part) => {
  const p = clean3(part);
  return p.length > 0 && CHAIN.test(p);
};
function match4(word, token) {
  const w = clean3(word), parts = clean3(token).split(/[\s-]+/).filter(Boolean);
  if (!w || !parts.length) return false;
  const t = parts[parts.length - 1];
  if (ends(w, t)) return true;
  const head = parts.slice(0, -1).join("");
  return !!head && w.startsWith(head) && w.length > head.length && ends(w.slice(head.length), t);
}
function deixis4(word) {
  const w = clean3(word);
  if (w === "\u0627\u06CC\u0646" || w === "\u0647\u0645\u06CC\u0646") return "this";
  if (w === "\u0627\u06CC\u0646\u0647\u0627" || w === "\u0627\u06CC\u0646\u0627" || w === "\u0627\u06CC\u0646\u0627\u0646" || w === "\u0647\u0645\u06CC\u0646\u0647\u0627" || w === "\u0647\u0645\u06CC\u0646\u0627") return "these";
  if (w === "\u0622\u0646" || w === "\u0627\u0648\u0646" || w === "\u0647\u0645\u0627\u0646" || w === "\u0647\u0645\u0648\u0646") return "that";
  if (w === "\u0622\u0646\u0647\u0627" || w === "\u0627\u0648\u0646\u0647\u0627" || w === "\u0627\u0648\u0646\u0627" || w === "\u0622\u0646\u0627\u0646" || w === "\u0647\u0645\u0627\u0646\u0647\u0627" || w === "\u0647\u0645\u0648\u0646\u0627") return "those";
  return null;
}
var isNear2 = (d) => d === "this" || d === "these" || d === "here";

// ../sahne-fa/src/listen.ts
var FILLER3 = /^(?:ام+|ا?م{2,}|اوم+|هوم+|ا{2,})$/;
var NEAR3 = Object.assign(/* @__PURE__ */ Object.create(null), {
  "\u0635": "\u0633",
  "\u062B": "\u0633",
  "\u0630": "\u0632",
  "\u0636": "\u0632",
  "\u0638": "\u0632",
  "\u0637": "\u062A",
  "\u062D": "\u0647",
  "\u063A": "\u0642",
  "\u0639": "\u0627",
  "\u0621": "\u0627",
  "\u0622": "\u0627"
});
var VARIANTS3 = Object.assign(/* @__PURE__ */ Object.create(null), {
  \u0646\u0648\u0646: "\u0646\u0627\u0646",
  \u0627\u0648\u0646: "\u0622\u0646",
  \u0627\u0648\u0646\u062C\u0627: "\u0622\u0646\u062C\u0627",
  \u0647\u0645\u0648\u0646: "\u0647\u0645\u0627\u0646",
  \u06CC\u0647: "\u06CC\u06A9",
  \u0627\u0631\u0647: "\u0622\u0631\u0647",
  \u0627\u06A9\u06CC: "\u0627\u0648\u06A9\u06CC",
  ok: "\u0627\u0648\u06A9\u06CC",
  okay: "\u0627\u0648\u06A9\u06CC",
  \u0628\u062F\u06CC\u0646: "\u0628\u062F\u0647\u06CC\u062F",
  \u0628\u062F\u06CC\u062F: "\u0628\u062F\u0647\u06CC\u062F",
  \u0628\u06CC\u0627\u0631\u06CC\u0646: "\u0628\u06CC\u0627\u0648\u0631\u06CC\u062F",
  \u0628\u06CC\u0627\u0631\u06CC\u062F: "\u0628\u06CC\u0627\u0648\u0631\u06CC\u062F",
  \u0645\u06CC\u062E\u0648\u0627\u0645: "\u0645\u06CC\u062E\u0648\u0627\u0647\u0645",
  \u0645\u06CC\u062E\u0648\u0627\u06CC: "\u0645\u06CC\u062E\u0648\u0627\u0647\u06CC",
  \u0645\u06CC\u062E\u0648\u0627\u06CC\u0645: "\u0645\u06CC\u062E\u0648\u0627\u0647\u06CC\u0645",
  \u0646\u0645\u06CC\u062F\u0648\u0646\u0645: "\u0646\u0645\u06CC\u062F\u0627\u0646\u0645",
  \u0645\u06CC\u0634\u0647: "\u0645\u06CC\u0634\u0648\u062F",
  \u0686\u06CC\u0647: "\u0686\u06CC\u0633\u062A",
  \u062E\u0648\u0646\u0647: "\u062E\u0627\u0646\u0647",
  \u0628\u0628\u062E\u0634\u06CC\u0646: "\u0628\u0628\u062E\u0634\u06CC\u062F",
  \u062E\u062F\u0627\u0641\u0638: "\u062E\u062F\u0627\u062D\u0627\u0641\u0638",
  // the contracted copula and the spoken negative progressive (a value of several words is split)
  \u0646\u0645\u06CC\u0634\u0647: "\u0646\u0645\u06CC\u0634\u0648\u062F",
  \u0646\u0645\u06CC\u062A\u0648\u0646\u0645: "\u0646\u0645\u06CC\u062A\u0648\u0627\u0646\u0645",
  \u0646\u0645\u06CC\u062A\u0648\u0646\u06CC: "\u0646\u0645\u06CC\u062A\u0648\u0627\u0646\u06CC",
  \u0646\u0645\u06CC\u062A\u0648\u0646\u0647: "\u0646\u0645\u06CC\u062A\u0648\u0627\u0646\u062F",
  \u0646\u0645\u06CC\u062F\u0645: "\u0646\u0645\u06CC\u062F\u0647\u0645",
  \u0646\u0645\u06CC\u062E\u0648\u0627\u0645: "\u0646\u0645\u06CC\u062E\u0648\u0627\u0647\u0645",
  \u0646\u0645\u06CC\u062E\u0648\u0627\u06CC: "\u0646\u0645\u06CC\u062E\u0648\u0627\u0647\u06CC",
  \u0646\u0645\u06CC\u062F\u0648\u0646\u06CC: "\u0646\u0645\u06CC\u062F\u0627\u0646\u06CC",
  \u062E\u0648\u0628\u0647: "\u062E\u0648\u0628 \u0627\u0633\u062A",
  \u0686\u0646\u062F\u0647: "\u0686\u0646\u062F \u0627\u0633\u062A",
  \u0627\u06CC\u0646\u0647: "\u0627\u06CC\u0646 \u0627\u0633\u062A",
  \u0627\u0648\u0646\u0647: "\u0622\u0646 \u0627\u0633\u062A",
  \u06A9\u062C\u0627\u0633\u062A: "\u06A9\u062C\u0627 \u0627\u0633\u062A",
  \u06A9\u06CC\u0647: "\u06A9\u06CC \u0627\u0633\u062A",
  \u06A9\u062C\u0627\u0633: "\u06A9\u062C\u0627 \u0627\u0633\u062A"
});
var NOT = new RegExp(
  "^(?:\u0646\u0647|\u0646\u062E\u06CC\u0631|\u0646\u06CC\u0633\u062A.*|\u0646\u06CC\u0633|\u0646\u062F\u0627\u0631.*|\u0646\u062F\u0627\u0634\u062A.*|\u0646\u0645\u06CC.+|\u0646\u0628\u0648\u062F.*|\u0646\u0634\u062F.*|\u0646\u06A9\u0646.*|\u0646\u0628\u0627\u06CC\u062F|\u0646\u0628\u0627\u0634.*|\u0647\u06CC\u0686.*|\u0647\u0631\u06AF\u0632|\u0628\u062F\u0648\u0646|\u0628\u06CC|\u0646(?:\u0631\u0641\u062A|\u0631\u0648$|\u0631\u0641|\u062E\u0631\u06CC\u062F|\u062E\u0631[\u0645\u062F\u06CC]|\u062E\u0648\u0631|\u062E\u0648\u0627|\u0634\u0646\u06CC\u062F|\u062F\u06CC\u062F|\u06AF\u0641\u062A|\u06AF\u0648|\u062F\u0647|\u0630\u0627\u0631|\u0630\u0627\u0634\u062A|\u06AF\u0630\u0627\u0631|\u06AF\u0630\u0627\u0634\u062A|\u06CC\u0627\u0648\u0631|\u06CC\u0627\u0645\u062F|\u06CC\u0627[\u0645\u062F\u06CC]|\u0628\u06CC\u0646|\u0634\u0648|\u0634\u062F|\u062A\u0648\u0627\u0646|\u062A\u0648\u0646\u0633\u062A|\u062F\u0627\u0646|\u0641\u0647\u0645\u06CC\u062F|\u0622\u0645\u062F|\u0627\u0648\u0645\u062F|\u0627\u0648\u0645).*)$"
);
function spoken3(said) {
  const out = [];
  for (const t of tokens4(said)) {
    if (t.kind !== "word") continue;
    for (const w0 of lowerFa(t.said).split(/\s+/)) out.push(w0.replace(/[^\p{L}\p{N}]/gu, ""));
  }
  return out;
}
var m3 = lineMatcher({ normalise: spoken3, near: NEAR3, fillers: FILLER3, spellings: VARIANTS3 });
var sayWords3 = m3.sayWords;
var normalise3 = m3.normalise;
var letters3 = m3.letters;
var allowance3 = m3.allowance;

// ../sahne-fa/src/time.ts
var HOUR2 = new Map(["\u06CC\u06A9", "\u062F\u0648", "\u0633\u0647", "\u0686\u0647\u0627\u0631", "\u067E\u0646\u062C", "\u0634\u0634", "\u0647\u0641\u062A", "\u0647\u0634\u062A", "\u0646\u0647", "\u062F\u0647", "\u06CC\u0627\u0632\u062F\u0647", "\u062F\u0648\u0627\u0632\u062F\u0647"].map((w, k) => [w, k + 1]));
HOUR2.set("\u06CC\u0647", 1);
HOUR2.set("\u0634\u06CC\u0634", 6);
var TIME_FOLLOWS = /* @__PURE__ */ new Set(["\u0627\u0633\u062A", "\u0647\u0633\u062A", "\u0628\u0648\u062F", "\u0634\u062F", "\u0645\u06CC\u0634\u0648\u062F", "\u0645\u06CC\u0634\u0647", "\u0635\u0628\u062D", "\u0638\u0647\u0631", "\u0639\u0635\u0631", "\u0634\u0628", "\u0628\u0627\u0645\u062F\u0627\u062F", "\u0628\u0639\u062F\u0627\u0632\u0638\u0647\u0631", "\u0627\u0644\u0627\u0646", "\u0627\u0644\u0622\u0646"]);
var COUNTED = /* @__PURE__ */ new Set(["\u0646\u0641\u0631", "\u062A\u0627", "\u0639\u062F\u062F", "\u062F\u0627\u0646\u0647", "\u0628\u0627\u0631", "\u06A9\u06CC\u0644\u0648", "\u0645\u062A\u0631", "\u06A9\u06CC\u0644\u0648\u06AF\u0631\u0645", "\u0644\u06CC\u062A\u0631", "\u0628\u0633\u062A\u0647", "\u0646\u0641\u0631\u0647"]);
function hourAt3(words9, i) {
  const w = words9[i];
  if (HOUR2.has(w)) return HOUR2.get(w);
  return /^\d{1,2}$/.test(w ?? "") && +w <= 24 ? +w : null;
}
function minutesAt3(words9, i) {
  if (words9[i] === "\u0631\u0628\u0639") return { m: 15, len: 1, word: true };
  if ((words9[i] === "\u06CC\u06A9" || words9[i] === "\u06CC\u0647") && words9[i + 1] === "\u0631\u0628\u0639") return { m: 15, len: 2, word: true };
  if (words9[i] === "\u0646\u06CC\u0645" || words9[i] === "\u0646\u06CC\u0645\u0647") return { m: 30, len: 1, word: true };
  const r = readNumber4(words9, i);
  return r && r.n > 0 && r.n < 60 ? { m: r.n, len: r.len, word: false } : null;
}
var before2 = (h, m4) => ({ h: h === 0 ? 23 : h === 1 ? 12 : h - 1, m: 60 - m4 });
function readClock4(text) {
  const out = [];
  const low = lowerFa(text);
  for (const m4 of low.matchAll(/(?<![\d.:])(\d{1,2})([:.])(\d{2})(?![\d]|[.:]\d)/g)) {
    if (m4[2] === "." && !/ساعت\s*$/.test(low.slice(Math.max(0, m4.index - 8), m4.index))) continue;
    if (+m4[1] <= 24 && +m4[3] < 60) out.push({ h: +m4[1], m: +m4[3] });
  }
  const words9 = low.replace(/(\d)[:.](\d)/g, "$1_$2").split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  for (let i = 0; i < words9.length; i++) {
    if (words9[i] === "\u0631\u0628\u0639" && words9[i + 1] === "\u06A9\u0645") {
      const j = words9[i + 2] === "\u0633\u0627\u0639\u062A" ? i + 3 : i + 2, h2 = hourAt3(words9, j);
      if (h2 !== null) {
        out.push(before2(h2, 15));
        i = j;
        continue;
      }
    }
    const mm = minutesAt3(words9, words9[i] === "\u0633\u0627\u0639\u062A" ? i + 1 : i);
    if (mm) {
      let j = (words9[i] === "\u0633\u0627\u0639\u062A" ? i + 1 : i) + mm.len;
      const dq = words9[j] === "\u062F\u0642\u06CC\u0642\u0647";
      if (dq) j++;
      if (dq || mm.word) {
        let d = j;
        if (words9[d] === "\u0645\u0627\u0646\u062F\u0647" || words9[d] === "\u0645\u0648\u0646\u062F\u0647") d++;
        if (words9[d] === "\u0628\u0647") {
          let hj = d + 1;
          if (words9[hj] === "\u0633\u0627\u0639\u062A") hj++;
          const h2 = hourAt3(words9, hj);
          if (h2 !== null && (h2 >= 1 || words9[hj] === "0") && !COUNTED.has(words9[hj + 1])) {
            out.push(before2(h2, mm.m));
            i = hj;
            continue;
          }
        } else if (words9[d] === "\u0627\u0632") {
          let hj = d + 1;
          if (words9[hj] === "\u0633\u0627\u0639\u062A") hj++;
          const h2 = hourAt3(words9, hj);
          if (h2 !== null && /^(?:گذشته|گذشت|رفته)$/.test(words9[hj + 1] ?? "")) {
            out.push({ h: h2, m: mm.m });
            i = hj + 1;
            continue;
          }
        }
      }
    }
    if (words9[i] === "\u0633\u0627\u0639\u062A") {
      const h2 = hourAt3(words9, i + 1);
      if (h2 === null) continue;
      let k = i + 2, m4 = 0;
      if (words9[k] === "\u0648") {
        const m22 = minutesAt3(words9, k + 1);
        if (m22) {
          const e = k + 1 + m22.len, dq = words9[e] === "\u062F\u0642\u06CC\u0642\u0647";
          if (m22.word || dq || m22.m % 5 === 0) {
            m4 = m22.m;
            k = e + (dq ? 1 : 0);
          }
        }
      }
      out.push({ h: h2, m: m4 });
      i = k - 1;
      continue;
    }
    const h = HOUR2.has(words9[i]) || /^\d{1,2}$/.test(words9[i] ?? "") ? hourAt3(words9, i) : null;
    if (h !== null && words9[i + 1] === "\u0648") {
      const m22 = minutesAt3(words9, i + 2);
      if (m22) {
        const e = i + 2 + m22.len, dq = words9[e] === "\u062F\u0642\u06CC\u0642\u0647", after = words9[dq ? e + 1 : e];
        if (dq && (after === void 0 || TIME_FOLLOWS.has(after)) || m22.word && (after === void 0 || TIME_FOLLOWS.has(after))) {
          out.push({ h, m: m22.m });
          i = e + (dq ? 1 : 0) - 1;
        }
      }
    }
  }
  return out;
}
function clockMinutes4(t) {
  const c = typeof t === "string" ? (/^(\d{1,2})[:.](\d{2})$/.exec(lowerFa(t).trim()) ?? []).slice(1).map(Number) : [t.h, t.m];
  if (c.length !== 2 || c.some((x) => !Number.isFinite(x))) return null;
  return c[0] % 12 * 60 + c[1];
}

// ../sahne-story/src/langs/fa-words.ts
var PARTICLES3 = new Set("\u0648 \u06CC\u0627 \u0627\u0645\u0627 \u0648\u0644\u06CC \u0648\u0644\u06CC\u06A9\u0646 \u0627\u06AF\u0631 \u06A9\u0647 \u0631\u0627 \u0628\u0647 \u0627\u0632 \u062F\u0631 \u0628\u0627 \u0628\u0631\u0627\u06CC \u062A\u0627 \u0628\u0631 \u0647\u0645 \u0646\u06CC\u0632 \u0647\u0645\u06CC\u0646 \u0647\u0645\u0627\u0646 \u0627\u06CC\u0646 \u0622\u0646 \u0627\u0648\u0646 \u0627\u06CC\u0646\u0647\u0627 \u0622\u0646\u0647\u0627 \u0627\u0648\u0646\u0627 \u0627\u06CC\u0646\u062C\u0627 \u0622\u0646\u062C\u0627 \u0627\u0648\u0646\u062C\u0627 \u0627\u06CC\u0646\u06A9\u0647 \u0622\u0646\u06A9\u0647 \u0686\u0648\u0646 \u0632\u06CC\u0631\u0627 \u067E\u0633 \u0633\u067E\u0633 \u0628\u0639\u062F \u0642\u0628\u0644 \u0645\u0646 \u062A\u0648 \u0627\u0648 \u0645\u0627 \u0634\u0645\u0627 \u0627\u06CC\u0634\u0627\u0646 \u0622\u0646\u0627\u0646 \u0627\u06CC\u0646\u0627\u0646 \u0645\u0631\u0627 \u062A\u0631\u0627 \u0634\u0645\u0627\u0631\u0627 \u062E\u0648\u062F\u0645 \u062E\u0648\u062F\u062A \u062E\u0648\u062F\u0634 \u062E\u0648\u062F\u0645\u0627\u0646 \u062E\u0648\u062F\u062A\u0627\u0646 \u062E\u0648\u062F\u0634\u0627\u0646 \u0645\u0646\u0648 \u062A\u0648\u0631\u0648 \u0686\u0647 \u0686\u06CC \u0686\u06CC\u0647 \u0686\u06CC\u0633\u062A \u06A9\u06CC \u06A9\u06CC\u0633\u062A \u06A9\u062C\u0627 \u06A9\u062C\u0627\u0633\u062A \u06A9\u062F\u0627\u0645 \u06A9\u062F\u0648\u0645 \u0686\u0631\u0627 \u0686\u0637\u0648\u0631 \u0686\u06AF\u0648\u0646\u0647 \u0686\u0646\u062F \u0686\u0642\u062F\u0631 \u0686\u0646\u062F\u062A\u0627 \u0622\u06CC\u0627 \u0645\u06AF\u0631 \u0645\u06AF\u0647 \u062E\u06CC\u0644\u06CC \u0628\u0633\u06CC\u0627\u0631 \u06A9\u0645\u06CC \u06A9\u0645 \u0632\u06CC\u0627\u062F \u062E\u0648\u0628 \u0628\u062F \u0647\u0631 \u0647\u0645\u0647 \u0647\u0645\u06CC\u0634\u0647 \u0647\u0631\u06AF\u0632 \u0647\u06CC\u0686 \u0647\u06CC\u0686\u06CC \u0647\u06CC\u0686\u06A9\u0633 \u062F\u06CC\u06AF\u0631 \u062F\u06CC\u06AF\u0647 \u062F\u06CC\u06AF\u0631\u06CC \u0628\u0627\u0632 \u0647\u0646\u0648\u0632 \u0627\u0644\u0627\u0646 \u062D\u0627\u0644\u0627 \u0641\u0642\u0637 \u062A\u0646\u0647\u0627 \u0627\u0635\u0644\u0627 \u0648\u0627\u0642\u0639\u0627 \u062D\u062A\u0645\u0627 \u0634\u0627\u06CC\u062F \u0646\u0647 \u0628\u0644\u0647 \u0622\u0631\u0647 \u0627\u0631\u0647 \u062E\u0628 \u0628\u0627\u0634\u0647 \u0644\u0637\u0641\u0627 \u0645\u0645\u0646\u0648\u0646 \u0645\u0631\u0633\u06CC \u0645\u062A\u0634\u06A9\u0631\u0645 \u0628\u0628\u062E\u0634\u06CC\u062F \u0628\u0641\u0631\u0645\u0627\u06CC\u06CC\u062F \u0628\u0641\u0631\u0645\u0627 \u0633\u0644\u0627\u0645 \u062E\u062F\u0627\u062D\u0627\u0641\u0638 \u0639\u0632\u06CC\u0632 \u0622\u0642\u0627 \u062E\u0627\u0646\u0645 \u0627\u0633\u062A \u0647\u0633\u062A \u0646\u06CC\u0633\u062A \u0628\u0648\u062F \u0634\u062F \u0645\u06CC \u0646\u0645\u06CC \u0628 \u0646 \u0647\u0633\u062A\u0645 \u0647\u0633\u062A\u06CC \u0647\u0633\u062A\u06CC\u0645 \u0647\u0633\u062A\u06CC\u062F \u0647\u0633\u062A\u0646\u062F \u0646\u06CC\u0633\u062A\u0645 \u0646\u06CC\u0633\u062A\u06CC \u0646\u06CC\u0633\u062A\u06CC\u0645 \u0646\u06CC\u0633\u062A\u06CC\u062F \u0646\u06CC\u0633\u062A\u0646\u062F \u062F\u0627\u0634\u062A \u062F\u0627\u0631\u0645 \u062F\u0627\u0631\u06CC \u062F\u0627\u0631\u06CC\u0645 \u062F\u0627\u0631\u06CC\u062F \u062F\u0627\u0631\u0646\u062F \u062F\u0627\u0631\u062F \u0646\u062F\u0627\u0631\u0645 \u0646\u062F\u0627\u0631\u06CC \u0646\u062F\u0627\u0631\u06CC\u0645 \u0646\u062F\u0627\u0631\u06CC\u062F \u0646\u062F\u0627\u0631\u0646\u062F \u0646\u062F\u0627\u0631\u062F \u0627\u0645 \u0627\u06CC \u0627\u06CC\u0645 \u0627\u06CC\u062F \u0627\u0646\u062F \u0627\u062A \u0627\u0634 \u0645\u0627\u0646 \u062A\u0627\u0646 \u0634\u0627\u0646 \u0647\u0627 \u0647\u0627\u06CC \u0627\u0646 \u0627\u062A \u06CC \u0645 \u062A \u0634 \u06CC\u0645 \u06CC\u062F \u0646\u062F \u0647 \u0633\u062A \u0628\u06CC\u0627 \u0628\u06CC\u0627\u06CC\u06CC\u062F \u0628\u0631\u0648 \u0628\u0631\u0648\u06CC\u062F \u0628\u062F\u0647 \u0628\u062F\u0647\u06CC\u062F \u0628\u06AF\u06CC\u0631 \u0628\u06AF\u06CC\u0631\u06CC\u062F \u0628\u06AF\u0648 \u0628\u06AF\u0648\u06CC\u06CC\u062F \u0628\u0628\u06CC\u0646 \u0628\u0628\u06CC\u0646\u06CC\u062F".split(" "));
var NUMBERS2 = new Set("\u0627\u0648\u0644 \u062F\u0648\u0645 \u0633\u0648\u0645 \u0686\u0647\u0627\u0631\u0645 \u067E\u0646\u062C\u0645 \u0634\u0634\u0645 \u0647\u0641\u062A\u0645 \u0647\u0634\u062A\u0645 \u0646\u0647\u0645 \u062F\u0647\u0645 \u0646\u06CC\u0645 \u0646\u06CC\u0645\u0647 \u0631\u0628\u0639 \u062F\u0631\u0635\u062F \u0645\u0645\u06CC\u0632 \u062A\u0648\u0645\u0627\u0646 \u0631\u06CC\u0627\u0644 \u062F\u0644\u0627\u0631 \u06CC\u0648\u0631\u0648 \u062F\u0642\u06CC\u0642\u0647 \u0633\u0627\u0639\u062A \u062B\u0627\u0646\u06CC\u0647 \u0631\u0648\u0632 \u0645\u0627\u0647 \u0633\u0627\u0644 \u0647\u0641\u062A\u0647 \u062A\u0627 \u0639\u062F\u062F \u062F\u0627\u0646\u0647 \u0646\u0641\u0631".split(" "));
function words5(text) {
  return tokens4(text).filter((t) => t.kind === "word" && !/^\d/.test(lowerFa(t.text))).flatMap((t) => t.text.split(/[‌-]/)).map(lowerFa).filter(Boolean);
}
function resolver3(entries, opts = {}) {
  const buckets = /* @__PURE__ */ new Map();
  const exact = /* @__PURE__ */ new Set();
  for (const e of entries) for (const w of words5(e)) {
    exact.add(w);
    (buckets.get(w[0]) ?? buckets.set(w[0], []).get(w[0])).push(w);
  }
  return (token) => {
    if (exact.has(token) || NUMBERS2.has(token) || readNumber4([token], 0) || opts.particles !== false && PARTICLES3.has(token)) return true;
    if (opts.particles !== false && isEnding(token)) return true;
    for (const w of buckets.get(token[0]) ?? []) if (match4(token, w)) return true;
    return false;
  };
}

// ../sahne-story/src/langs/fa.ts
var AGREE3 = { this: ["hold_up", "touch", "point"], these: ["hold_up", "touch", "point"], that: ["point_far", "point"], those: ["point_far", "point"] };
var ADVICE3 = { this: "hold_up", these: "hold_up", that: "point_far", those: "point_far" };
var MOTIVE3 = {
  count: [],
  // a number
  give: ["\u0628\u0641\u0631\u0645\u0627", "\u0628\u06AF\u06CC\u0631", "\u0628\u06CC\u0627$", "\u0627\u06CC\u0646\u0645", "\u0627\u06CC\u0646\u0627\u0647\u0627\u0634"],
  take: ["\u0645\u0645\u0646\u0648\u0646", "\u0645\u0631\u0633\u06CC", "\u0645\u062A\u0634\u06A9\u0631", "\u062A\u0634\u06A9\u0631", "\u0633\u067E\u0627\u0633", "\u062F\u0633\u062A\u062A"],
  welcome: ["\u062E\u0648\u0634", "\u0628\u0641\u0631\u0645\u0627", "\u0628\u06CC\u0627\u06CC\u06CC\u062F", "\u0628\u06CC\u0627\u06CC\u062F", "\u0628\u06CC\u0627$", "\u0633\u0644\u0627\u0645"],
  wave: ["\u0633\u0644\u0627\u0645", "\u062E\u062F\u0627\u062D\u0627\u0641\u0638", "\u062E\u062F\u0627\u0646\u06AF\u0647\u062F\u0627\u0631", "\u0628\u062F\u0631\u0648\u062F", "\u0641\u0639\u0644\u0627", "\u0628\u062E\u06CC\u0631", "\u062F\u0631\u0648\u062F", "\u062F\u06CC\u062F\u0627\u0631", "\u0628\u0627\u06CC$", "\u0647\u06CC$"],
  nod: ["\u0628\u0644\u0647", "\u0622\u0631\u0647", "\u0627\u0631\u0647", "\u0628\u0644\u06CC", "\u0628\u0627\u0634\u0647", "\u062D\u062A\u0645\u0627", "\u062F\u0631\u0633\u062A", "\u0642\u0637\u0639\u0627", "\u0627\u0644\u0628\u062A\u0647", "\u0627\u0648\u06A9\u06CC", "\u0627\u06A9\u06CC", "\u0641\u0647\u0645\u06CC\u062F\u0645", "\u0645\u062A\u0648\u062C\u0647", "\u0647\u0645\u06CC\u0646\u0647", "\u062F\u0642\u06CC\u0642\u0627"],
  shake_head: ["\u0646\u0647$", "\u0646\u06CC\u0633\u062A", "\u0646\u06CC\u0633", "\u0646\u062E\u06CC\u0631", "\u0647\u0631\u06AF\u0632", "\u0647\u06CC\u0686", "\u0646\u0645\u06CC", "\u0646\u062F\u0627\u0631", "\u0646\u0628\u0648\u062F", "\u0646\u0634\u062F", "\u0645\u062A\u0627\u0633\u0641"],
  cik: ["\u0646\u0647$", "\u0646\u062E\u06CC\u0631", "\u0646\u0686", "\u0646\u06CC\u0633\u062A", "\u0647\u0631\u06AF\u0632", "\u0646\u0645\u06CC"],
  shrug: ["\u0646\u0645\u06CC\u062F\u0627\u0646", "\u0646\u0645\u06CC\u062F\u0648\u0646", "\u0634\u0627\u06CC\u062F", "\u0645\u062A\u0627\u0633\u0641", "\u0648\u0644\u06CC$", "\u0627\u0645\u0627$", "\u0686\u0645\u06CC\u062F\u0648\u0646", "\u0646\u0645\u06CC\u062F\u0627\u0646\u0645"],
  hand_heart: ["\u0645\u0645\u0646\u0648\u0646", "\u0645\u0631\u0633\u06CC", "\u0645\u062A\u0634\u06A9\u0631", "\u062A\u0634\u06A9\u0631", "\u0644\u0637\u0641\u0627", "\u062E\u0648\u0627\u0647\u0634", "\u0633\u067E\u0627\u0633", "\u062E\u062F\u0627", "\u062E\u0648\u0634\u062D\u0627\u0644", "\u0642\u0631\u0628\u0627\u0646", "\u0639\u0632\u06CC\u0632", "\u062F\u0633\u062A\u062A"],
  me: ["\u0645\u0646$", "\u0645\u0646\u0645$", "\u0645\u0631\u0627$", "\u0645\u0646\u0648$"],
  you: ["\u062A\u0648$", "\u0634\u0645\u0627$", "\u0634\u0645\u0627\u0631\u0627$", "\u062A\u0648\u0631\u0627$", "\u062A\u0648\u0627\u0645"],
  beckon: ["\u0628\u06CC\u0627$", "\u0628\u06CC\u0627\u06CC\u06CC\u062F", "\u0628\u06CC\u0627\u06CC\u062F", "\u0628\u06CC\u0627\u06CC\u0646", "\u0627\u06CC\u0646\u062C\u0627"],
  stop: ["\u0635\u0628\u0631", "\u0628\u0627\u06CC\u0633\u062A", "\u0627\u06CC\u0633\u062A", "\u0646\u0647$", "\u06A9\u0627\u0641\u06CC", "\u0628\u0633$", "\u0648\u0627\u06CC\u0633\u0627", "\u0648\u0627\u06CC\u0633\u062A\u0627", "\u062A\u0648\u0642\u0641", "\u0644\u062D\u0638\u0647"],
  thumb_up: ["\u0639\u0627\u0644\u06CC", "\u062E\u0648\u0628", "\u0622\u0641\u0631\u06CC\u0646", "\u0641\u0648\u0642", "\u0627\u06CC\u0648\u0644", "\u0642\u0634\u0646\u06AF", "\u0632\u06CC\u0628\u0627", "\u0645\u062D\u0634\u0631", "\u0628\u0627\u0634\u0647", "\u0627\u0648\u06A9\u06CC", "\u0627\u06A9\u06CC", "\u062F\u0631\u0633\u062A", "\u0628\u0633\u06CC\u0627\u0631"],
  shush: ["\u0647\u06CC\u0633", "\u0633\u0627\u06A9\u062A", "\u0633\u06A9\u0648\u062A", "\u0634\u0634\u0634", "\u0647\u06CC\u0634"],
  bow_head: ["\u0628\u0628\u062E\u0634\u06CC\u062F", "\u0628\u0628\u062E\u0634\u06CC\u0646", "\u0645\u0639\u0630\u0631\u062A", "\u0639\u0630\u0631", "\u0645\u062A\u0627\u0633\u0641", "\u067E\u0648\u0632\u0634", "\u0634\u0631\u0645\u0646\u062F\u0647"],
  phone: ["\u0627\u0644\u0648", "\u062A\u0644\u0641\u0646", "\u0632\u0646\u06AF", "\u06AF\u0648\u0634\u06CC", "\u062A\u0645\u0627\u0633"]
};
var words6 = (text) => tokens4(text).map((t) => t.kind === "word" ? { w: lowerFa(t.text), i: t.i } : { w: t.mark === "comma" ? "," : ".", i: t.i, pause: true, q: t.text === "?" || t.text === "\u061F" });
var POS = /* @__PURE__ */ new Set(["\u0647\u0633\u062A", "\u0647\u0633\u062A\u0634", "\u0647\u0633\u062A\u0646", "\u0647\u0633\u062A\u0646\u062F", "\u062F\u0627\u0631\u06CC\u0645", "\u062F\u0627\u0631\u0645", "\u062F\u0627\u0631\u062F", "\u062F\u0627\u0631\u0647", "\u062F\u0627\u0631\u0646", "\u062F\u0627\u0631\u0646\u062F"]);
var NEG = /* @__PURE__ */ new Set(["\u0646\u06CC\u0633\u062A", "\u0646\u06CC\u0633", "\u0646\u06CC\u0633\u062A\u0634", "\u0646\u06CC\u0633\u062A\u0646", "\u0646\u06CC\u0633\u062A\u0646\u062F", "\u0646\u062F\u0627\u0631\u06CC\u0645", "\u0646\u062F\u0627\u0631\u0645", "\u0646\u062F\u0627\u0631\u062F", "\u0646\u062F\u0627\u0631\u0647", "\u0646\u062F\u0627\u0631\u0646", "\u0646\u062F\u0627\u0631\u0646\u062F", "\u0646\u0645\u0648\u0646\u062F\u0647", "\u062A\u0645\u0648\u0645\u0634\u062F", "\u062A\u0645\u0627\u0645\u0634\u062F"]);
var BETWEEN = /* @__PURE__ */ new Set(["\u0647\u06CC\u0686", "\u0647\u06CC\u0686\u06CC", "\u0627\u0635\u0644\u0627", "\u062F\u06CC\u06AF\u0647", "\u062F\u06CC\u06AF\u0631", "\u0647\u0645", "\u062E\u06CC\u0644\u06CC", "\u06A9\u0645\u06CC", "\u0686\u0646\u062F", "\u0647\u0646\u0648\u0632", "\u0627\u0644\u0627\u0646", "\u0627\u06CC\u0646\u062C\u0627", "\u0622\u0646\u062C\u0627", "\u0627\u0648\u0646\u062C\u0627", "\u0647\u0645\u06CC\u0634\u0647", "\u0641\u0639\u0644\u0627", "\u0627\u0645\u0631\u0648\u0632", "\u062F\u06CC\u06AF\u0647\u06CC", "\u0647\u06CC\u0686\u062C\u0627", "\u0647\u06CC\u0686\u0648\u0642\u062A", "\u0647\u06CC\u0686\u06A9\u0633", "\u0647\u06CC\u0686\u06A9\u062C\u0627"]);
var between = (w) => BETWEEN.has(w) || w.startsWith("\u0647\u06CC\u0686");
var CLASSIFIER = /* @__PURE__ */ new Set(["\u062A\u0627", "\u0639\u062F\u062F", "\u062F\u0627\u0646\u0647", "\u0628\u0633\u062A\u0647"]);
function lintLine3(c) {
  const { st, words: ws, plain, add } = c;
  let skipTo = 0;
  ws.forEach((t, i) => {
    if (t.pause) return;
    const d = deixis4(t.w);
    const cand = d ? [ws[i + 1], ws[i + 2]].filter((w) => w && !w.pause) : [];
    const noun = cand.find((w) => c.linkOf(w.w)), tgt = noun ? c.linkOf(noun.w) : null;
    if (d && tgt) {
      const phrase = `${t.w} ${noun !== cand[0] ? cand[0].w + " " : ""}${noun.w}`;
      const near = isNear2(d), far = c.distance(tgt), held = c.holds(tgt);
      if (!st.do || !DEIXIS_GESTURES.has(st.do) || st.at !== tgt) {
        add("deixis", `"${phrase}" needs a deixis gesture at ${tgt} (${ADVICE3[d]})`, { do: ADVICE3[d], at: tgt });
      } else if (!AGREE3[d].includes(st.do)) {
        add("deixis", `"${phrase}" with ${st.do}: ${t.w} takes ${AGREE3[d].filter((g) => g !== "point").join(" or ")}`, { do: ADVICE3[d], at: tgt });
      } else if (held && !near) add("deixis", `"${phrase}": ${c.who} holds it, so it is \u0627\u06CC\u0646`, void 0, "warning");
      else if (near && st.do === "point" && far !== null && far > NEAR2) add("deixis", `"${phrase}": ${t.w} is near, but ${tgt} is ${far.toFixed(1)} m away (\u0622\u0646, or hold it up)`);
      else if (!near && st.do === "point" && far !== null && far < FAR) add("deixis", `"${phrase}": ${t.w} is far, but ${tgt} is ${far.toFixed(1)} m away (\u0627\u06CC\u0646)`, { do: "point", at: tgt }, "warning");
      else if (near && far !== null && far > NEAR2) add("deixis", `"${phrase}": ${t.w} is near, but ${tgt} is ${far.toFixed(1)} m away`, void 0, "warning");
      else if (!near && far !== null && far <= NEAR2) add("deixis", `"${phrase}": ${t.w} is far, but ${tgt} is within reach (${far.toFixed(1)} m)`, void 0, "warning");
    }
    const pos = POS.has(t.w), neg = NEG.has(t.w);
    if (pos || neg) {
      let e = i + 1;
      while (e < ws.length && !(ws[e].pause && ws[e].w === ".")) e++;
      if (ws[e]?.q || ws.slice(0, i).some((w) => w.w === "\u0622\u06CC\u0627" || w.w === "\u0645\u06AF\u0647" || w.w === "\u0645\u06AF\u0631")) return;
      let subj = null;
      for (let k = i - 1; k >= 0 && !ws[k].pause; k--) {
        if (between(ws[k].w)) continue;
        subj = c.linkOf(ws[k].w);
        break;
      }
      const id = subj?.startsWith("obj:") ? subj.slice(4) : null, p = id ? c.prop(id) : null;
      if (p && pos && !p.shown) add("var_yok", `"${t.w}": ${subj} is hidden here; show it on this line or before`, { obj: [{ id, op: "show" }] });
      if (p && neg && p.shown) add("var_yok", `"${t.w}": ${subj} is still shown; hide it (a dashed outline) on this line`, { obj: [{ id, op: "hide" }] });
    }
    const plainIdx = plain.indexOf(t.w, ws.slice(0, i).filter((w) => !w.pause).length);
    const num = plainIdx >= skipTo ? readNumber4(plain, plainIdx) : null;
    if (num && plainIdx >= 0) {
      skipTo = plainIdx + num.len;
      let ni = plainIdx + num.len;
      while (CLASSIFIER.has(plain[ni])) ni++;
      const noun2 = plain[ni];
      const nt = noun2 ? c.linkOf(noun2) : null;
      const id = nt?.startsWith("obj:") ? nt.slice(4) : null;
      if (id) {
        const ns = [...st.do === "count" && st.n !== void 0 ? [st.n] : [], ...(st.obj ?? []).filter((op) => op.id === id && op.n !== void 0).map((op) => op.n)];
        const assert = plain.slice(ni + 1).some((w) => POS.has(w));
        const have = c.prop(id)?.n;
        if (ns.length && !ns.includes(num.n)) add("number", `"${plain.slice(plainIdx, ni + 1).join(" ")}" says ${num.n}, but the line's n is ${ns.join(", ")}`, st.do === "count" ? { do: "count", n: num.n } : void 0);
        else if (!ns.length && assert && have !== void 0 && have !== num.n && num.n !== 1) add("number", `"${num.n} ${noun2} \u0647\u0633\u062A", but ${nt} shows ${have}`, { obj: [{ id, op: "set", set: { n: num.n } }] });
      }
    }
  });
  lintClock(c, readClock4, clockMinutes4);
}
var PARENTHETICAL3 = {
  "\u062F\u0633\u062A \u062A\u06A9\u0627\u0646 \u0645\u06CC\u200C\u062F\u0647\u062F": { do: "wave" },
  "\u0627\u0634\u0627\u0631\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F": { do: "point" },
  "\u0633\u0631 \u062A\u06A9\u0627\u0646 \u0645\u06CC\u200C\u062F\u0647\u062F": { do: "nod" },
  "\u0634\u0627\u0646\u0647 \u0628\u0627\u0644\u0627 \u0645\u06CC\u200C\u0627\u0646\u062F\u0627\u0632\u062F": { do: "shrug" },
  "\u0644\u0628\u062E\u0646\u062F \u0645\u06CC\u200C\u0632\u0646\u062F": { emo: "happy" },
  "\u0645\u06CC\u200C\u062E\u0646\u062F\u062F": { emo: "laugh" },
  "\u0634\u0627\u062F": { emo: "happy" },
  "\u063A\u0645\u06AF\u06CC\u0646": { emo: "sad" },
  "\u0645\u062A\u0639\u062C\u0628": { emo: "surprised" },
  "\u0632\u0645\u0632\u0645\u0647 \u0645\u06CC\u200C\u06A9\u0646\u062F": { voice: "whisper" }
};
var faLang = {
  id: "fa",
  lower: lowerFa,
  words: words6,
  match: match4,
  fold: lowerFa,
  pointing: (w) => !!deixis4(w),
  namesPlace: () => false,
  motive: MOTIVE3,
  number: readNumber4,
  lintLine: lintLine3,
  checkWords: words5,
  resolver: resolver3,
  parenthetical: PARENTHETICAL3
};

// ../sahne-story/src/langs/tr-words.ts
var PARTICLES4 = /* @__PURE__ */ new Set(["mi", "m\u0131", "mu", "m\xFC", "de", "da", "te", "ta", "ki", "ve", "ile", "ya", "ama", "ne", "hem", "\xE7ok", "bir", "bu", "\u015Fu", "o", "ben", "sen", "biz", "siz", "onlar", "bana", "sana", "ona", "onu", "onun", "onda", "ondan", "onlara", "onlar\u0131", "evet", "hay\u0131r", "l\xFCtfen", "tamam"]);
var NUMBERS3 = new Set("s\u0131f\u0131r bir iki \xFC\xE7 d\xF6rt be\u015F alt\u0131 yedi sekiz dokuz on yirmi otuz k\u0131rk elli altm\u0131\u015F yetmi\u015F seksen doksan y\xFCz bin birinci ikinci \xFC\xE7\xFCnc\xFC d\xF6rd\xFCnc\xFC be\u015Finci alt\u0131nc\u0131 yedinci sekizinci dokuzuncu onuncu".split(" "));
function words7(text) {
  return lowerTr(text.replace(/[’‘`´]/g, "'")).split(/[^\p{L}'0-9]+/u).map((w) => w.split("'")[0]).filter((w) => w && !/^[0-9]+$/.test(w));
}
var VERB_END = /^(mak|mek)$/;
var VOWEL = /[aeıioöuü]/;
var SUFFIX_START = /^($|[aeıioöuümdtrysnlcçk])/;
function verbForm2(lemma, token) {
  if (!VERB_END.test(lemma.slice(-3))) return false;
  const stem = lemma.slice(0, -3);
  if (stem.length < 2) return false;
  const rest = (s) => token.slice(s.length);
  const ok = (s, cond) => s.length >= 2 && token.startsWith(s) && token.length - s.length <= 9 && cond(rest(s));
  if (ok(stem, (r) => SUFFIX_START.test(r))) return true;
  if (/^(de|ye)$/.test(stem) && ok(stem[0] + "i", (r) => /^yor/.test(r))) return true;
  if (VOWEL.test(stem.slice(-1)) && stem.length >= 3 && ok(stem.slice(0, -1), (r) => /^[ıiuü]yor/.test(r))) return true;
  if (/t$/.test(stem) && ok(stem.replace(/t$/, "d"), (r) => VOWEL.test(r[0] ?? ""))) return true;
  if (/k$/.test(stem) && ok(stem.replace(/k$/, "\u011F"), (r) => VOWEL.test(r[0] ?? ""))) return true;
  return false;
}
function resolver4(entries, opts = {}) {
  const buckets = /* @__PURE__ */ new Map();
  const exact = /* @__PURE__ */ new Set();
  for (const e of entries) for (const w of words7(e)) {
    exact.add(w);
    const keys = /* @__PURE__ */ new Set([w.slice(0, 2)]);
    if (VERB_END.test(w.slice(-3))) {
      const stem = w.slice(0, -3);
      keys.add(stem.replace(/t$/, "d").replace(/k$/, "\u011F").slice(0, 2));
      if (/^(de|ye)$/.test(stem)) keys.add(stem[0] + "i");
    }
    for (const k of keys) (buckets.get(k) ?? buckets.set(k, []).get(k)).push(w);
  }
  return (token) => {
    if (exact.has(token) || NUMBERS3.has(token) || opts.particles !== false && PARTICLES4.has(token)) return true;
    for (const w of buckets.get(token.slice(0, 2)) ?? []) if (verbForm2(w, token) || w.length >= 2 && token.startsWith(w.slice(0, 2)) && match(token, w)) return true;
    return false;
  };
}

// ../sahne-story/src/langs/tr.ts
var AGREE4 = { bu: ["hold_up", "touch", "point"], \u015Fu: ["point"], o: ["point_far", "point"] };
var ADVICE4 = { bu: "hold_up", \u015Fu: "point", o: "point_far" };
var MOTIVE4 = {
  count: [],
  // a number
  give: ["buyr", "al", "ver", "i\u015Fte"],
  take: ["al", "te\u015Fekk\xFCr", "sa\u011F ol", "sa\u011Fol"],
  welcome: ["ho\u015F", "buyr", "gel"],
  wave: ["merhaba", "selam", "ho\u015F\xE7a", "g\xFCle", "g\xF6r\xFC\u015F\xFCr", "bay", "g\xFCnayd\u0131n", "iyi ak\u015Fam", "iyi gece"],
  nod: ["evet", "tamam", "tabii", "olur", "peki", "do\u011Fru", "elbette", "anlad\u0131m", "aynen"],
  shake_head: ["hay\u0131r", "yok", "de\u011Fil", "olmaz"],
  cik: ["yok", "hay\u0131r", "c\u0131k", "de\u011Fil"],
  shrug: ["yok", "bilmiyor", "bilmem", "belki", "maalesef", "ama", "ne bileyim"],
  hand_heart: ["te\u015Fekk\xFCr", "sa\u011F", "l\xFCtfen", "rica", "memnun", "allah"],
  me: ["ben", "bana", "beni"],
  you: ["sen", "siz", "sana", "size", "seni", "sizi"],
  beckon: ["gel", "buraya"],
  stop: ["dur", "bekle", "hay\u0131r", "yeter"],
  thumb_up: ["s\xFCper", "harika", "g\xFCzel", "tamam", "aferin", "bravo", "\xE7ok iyi", "oldu"],
  shush: ["\u015F\u015F", "sus", "sessiz"],
  bow_head: ["\xF6z\xFCr", "pardon", "kusura", "affedersiniz"],
  phone: ["alo", "telefon"]
};
var ascii3 = (s) => lowerTr(s).replace(/ı/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/ü/g, "u");
var words8 = (text) => tokens(text).map((t) => t.kind === "word" ? { w: lowerTr(t.text).replace(/[’']/g, "'"), i: t.i } : { w: t.mark === "comma" ? "," : ".", i: t.i, pause: true, q: t.text === "?" });
var HOMETOWN = "Tahran";
function lintLine4(c) {
  const { st, words: ws, plain, add } = c;
  ws.forEach((t, i) => {
    if (t.pause) return;
    const next = ws[i + 1];
    const noun = next && !next.pause && /^d[ae]$/.test(next.w) && ws[i + 2] && !ws[i + 2].pause ? ws[i + 2] : next;
    const d = /^(bura|şura|ora)/.test(t.w) ? null : deixis(t.w);
    const tgt = noun && !noun.pause ? c.linkOf(noun.w) : null;
    if (d && tgt) {
      const phrase = `${t.w} ${noun !== next ? next.w + " " : ""}${noun.w}`;
      if (!st.do || !DEIXIS_GESTURES.has(st.do) || st.at !== tgt) {
        add("deixis", `"${phrase}" needs a deixis gesture at ${tgt} (${ADVICE4[d]})`, { do: ADVICE4[d], at: tgt });
      } else {
        const held = c.holds(tgt), far = c.distance(tgt);
        if (!AGREE4[d].includes(st.do)) add("deixis", `"${phrase}" with ${st.do}: ${d} takes ${AGREE4[d].filter((g) => g !== "point" || d === "\u015Fu").join(" or ")}`, { do: ADVICE4[d], at: tgt });
        else if (held && d !== "bu") add("deixis", `"${phrase}": ${c.who} holds it, so it is bu`, void 0, "warning");
        else if (d === "bu" && st.do === "point" && far !== null && far > NEAR2) add("deixis", `"${phrase}": bu is near, but ${tgt} is ${far.toFixed(1)} m away (\u015Fu or o, or hold it up)`);
        else if (d === "o" && st.do === "point" && far !== null && far < FAR) add("deixis", `"${phrase}": o is far, but ${tgt} is ${far.toFixed(1)} m away (bu or \u015Fu)`, { do: "point", at: tgt }, "warning");
        else if (d === "bu" && far !== null && far > NEAR2) add("deixis", `"${phrase}": bu is near, but ${tgt} is ${far.toFixed(1)} m away`, void 0, "warning");
        else if (d === "o" && far !== null && far <= NEAR2) add("deixis", `"${phrase}": o is far, but ${tgt} is within reach (${far.toFixed(1)} m)`, void 0, "warning");
      }
    }
    if (t.w === "var" || t.w === "yok") {
      if (next && !next.pause && /^m[ıiuü]/.test(next.w)) return;
      if (next && next.pause && next.q) return;
      let subj = null;
      for (let k = i - 1; k >= 0 && !(ws[k].pause && ws[k].w === "."); k--) {
        const w = ws[k];
        if (!w.pause && (subj = c.linkOf(w.w))) break;
      }
      const id = subj?.startsWith("obj:") ? subj.slice(4) : null, p = id ? c.prop(id) : null;
      if (p && t.w === "var" && !p.shown) add("var_yok", `"${t.w}": ${subj} is hidden here; show it on this line or before`, { obj: [{ id, op: "show" }] });
      if (p && t.w === "yok" && p.shown) add("var_yok", `"${t.w}": ${subj} is still shown; hide it (a dashed outline) on this line`, { obj: [{ id, op: "hide" }] });
    }
    const plainIdx = plain.indexOf(t.w, ws.slice(0, i).filter((w) => !w.pause).length);
    const num = plainIdx > 0 && readNumber(plain, plainIdx - 1) ? null : readNumber(plain, plainIdx);
    if (num && plainIdx >= 0) {
      const noun2 = plain[plainIdx + num.len];
      const nt = noun2 ? c.linkOf(noun2) : null;
      const id = nt?.startsWith("obj:") ? nt.slice(4) : null;
      if (id) {
        const ns = [...st.do === "count" && st.n !== void 0 ? [st.n] : [], ...(st.obj ?? []).filter((op) => op.id === id && op.n !== void 0).map((op) => op.n)];
        const assert = plain.slice(plainIdx + num.len).includes("var");
        const have = c.prop(id)?.n;
        if (ns.length && !ns.includes(num.n)) add("number", `"${plain.slice(plainIdx, plainIdx + num.len + 1).join(" ")}" says ${num.n}, but the line's n is ${ns.join(", ")}`, st.do === "count" ? { do: "count", n: num.n } : void 0);
        else if (!ns.length && assert && have !== void 0 && have !== num.n && num.n !== 1) add("number", `"${num.n} ${noun2} var", but ${nt} shows ${have}`, { obj: [{ id, op: "set", set: { n: num.n } }] });
      }
    }
  });
  lintClock(c, readClock, clockMinutes);
}
var PARENTHETICAL4 = {
  "el sallar": { do: "wave" },
  "g\xF6sterir": { do: "point" },
  "ba\u015F\u0131n\u0131 sallar": { do: "nod" },
  "omuz silker": { do: "shrug" },
  "g\xFCl\xFCmser": { emo: "happy" },
  "g\xFCler": { emo: "laugh" },
  "mutlu": { emo: "happy" },
  "\xFCzg\xFCn": { emo: "sad" },
  "\u015Fa\u015Fk\u0131n": { emo: "surprised" },
  "f\u0131s\u0131ldar": { voice: "whisper" }
};
var trLang = {
  id: "tr",
  lower: lowerTr,
  words: words8,
  match,
  fold: ascii3,
  pointing: (w) => !!deixis(w),
  namesPlace: (w) => /^(burası|şurası|orası)$/.test(w),
  motive: MOTIVE4,
  number: readNumber,
  lintLine: lintLine4,
  checkWords: words7,
  resolver: resolver4,
  names: [HOMETOWN, `${HOMETOWN}l\u0131`],
  hints: (t, gl) => [
    ...t.standin && /İran|Farsça|[؀-ۿ]/.test(t.text) ? [`a stand-in line names a country or language: \u201C${t.text}\u201D`] : [],
    .../Kırlangıç/.test(t.text) && !gl["k\u0131rlang\u0131\xE7"] ? ["K\u0131rlang\u0131\xE7 is used but not glossed in gl"] : []
  ],
  parenthetical: PARENTHETICAL4
};

// ../sahne-story/src/lang.ts
var PAUSE4 = /^(\.{2,}|…|[.,;:!?—–]|-)$/;
var plainWords = (lower) => (text) => [...text.matchAll(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*|\.{2,}|…|[.,;:!?—–]/gu)].map((m4) => PAUSE4.test(m4[0]) ? { w: m4[0] === "," ? "," : ".", i: m4.index ?? 0, pause: true, q: m4[0] === "?" } : { w: lower(m4[0]), i: m4.index ?? 0 });
function plainLang(id) {
  const lower = (s) => s.toLocaleLowerCase(id);
  const words9 = plainWords(lower);
  const checkWords = (text) => words9(text).filter((w) => !w.pause && !/^[0-9]+$/.test(w.w)).map((w) => w.w.split(/['’]/)[0]);
  return {
    id,
    lower,
    words: words9,
    checkWords,
    match: (word, entry) => lower(word) === lower(entry),
    fold: (w) => w.normalize("NFD").replace(/\p{M}/gu, ""),
    pointing: () => false,
    namesPlace: () => false,
    motive: {},
    resolver: (entries) => {
      const known = new Set([...entries].flatMap(checkWords));
      return (t) => known.has(t) || /^[0-9]+$/.test(t);
    }
  };
}
var LANGS = { tr: trLang, en: enLang, de: deLang, fa: faLang };
var langFor = (id) => LANGS[id] ?? plainLang(id);
function motivated(entries, plain) {
  const padded = ` ${plain.join(" ")} `;
  return entries.find((m4) => m4.endsWith("$") ? plain.includes(m4.slice(0, -1)) : plain.some((w) => w.startsWith(m4)) || padded.includes(` ${m4} `));
}

// ../sahne-story/src/looks.ts
var LEARNER_FIELDS = ["outfit.outer", "wear.hat"];
var canon = (v) => JSON.stringify(v, (_k, x) => x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x);
function forLearner(look, now) {
  const { clothing } = lookFields(look), out = {};
  if ("outfit.outer" in clothing) out.outfit = { outer: clothing["outfit.outer"] };
  const hat = clothing["wear.hat"];
  if ("wear.hat" in clothing && !(hat && now.wear?.head)) out.wear = { hat };
  return out;
}
function dress(ref, now, avatar, outfits, learner) {
  if (typeof ref === "string") {
    if (ref === "default") return avatar;
    const fit = outfits && Object.hasOwn(outfits, ref) ? outfits[ref] : void 0;
    return fit ? applyLook(avatar, learner ? forLearner(fit, avatar) : fit) : null;
  }
  return applyLook(now, learner ? forLearner(ref ?? {}, now) : ref);
}
var looksOf = (s) => isScene(s) || isLine(s) ? s.looks : isBeat(s) ? s.beat.looks : void 0;
function dressing(story, avatars, characters, ok) {
  const base = {}, wardrobe = {}, changes = {};
  const now = { ...avatars };
  const put = (looks) => {
    const out = {};
    for (const [id, ref] of Object.entries(looks ?? {})) {
      const avatar = avatars[id];
      if (!avatar) continue;
      const next = dress(ref, now[id], avatar, characters[id]?.outfits, id === STANDIN);
      if (next && canon(next) !== canon(now[id])) out[id] = now[id] = next;
    }
    return out;
  };
  put(story.looks);
  Object.assign(base, now);
  const named = /* @__PURE__ */ new Map(), seen = /* @__PURE__ */ new Map();
  const key = (id, doc) => {
    const c = canon(doc);
    if (c === canon(base[id])) return "";
    const outfits = characters[id]?.outfits ?? {};
    if (!named.has(id)) {
      const m4 = /* @__PURE__ */ new Map();
      for (const n of ["default", ...Object.keys(outfits)]) {
        const d = dress(n, avatars[id], avatars[id], outfits, id === STANDIN);
        if (d && !m4.has(canon(d))) m4.set(canon(d), n);
      }
      named.set(id, m4);
    }
    const mine = seen.get(id) ?? seen.set(id, /* @__PURE__ */ new Map()).get(id);
    let k = mine.get(c) ?? named.get(id).get(c);
    for (let n = 1; !k; n++) if (!Object.hasOwn(outfits, `look${n}`) && ![...mine.values()].includes(`look${n}`)) k = `look${n}`;
    mine.set(c, k);
    (wardrobe[id] ??= {})[k] = doc;
    return k;
  };
  story.steps.forEach((s, step) => {
    if (!ok(s)) return;
    const changed = put(looksOf(s));
    if (Object.keys(changed).length) changes[step] = Object.fromEntries(Object.entries(changed).map(([id, d]) => [id, key(id, d)]));
  });
  return { base, wardrobe, changes };
}

// ../sahne-story/src/adapt.ts
var STAGING = ["to", "emo", "do", "at", "n", "loop", "move", "obj", "link", "react", "cam", "via", "voice", "sfx", "env", "frame", "tempo", "on", "of"];
var passes = (g, flags) => (!g.if || flags.has(g.if)) && (!g.unless || !flags.has(g.unless));
function deep(v, p) {
  if (typeof v === "string") return p(v);
  if (Array.isArray(v)) return v.map((x) => deep(x, p));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x, p)]));
  return v;
}
function adaptStory(story, o) {
  const P = o.personalise ?? ((s) => s);
  const langs = o.languages ?? DEFAULT_LANGUAGES, main = langs.main, every = allLanguages(langs);
  const p = (s) => P(s, main);
  const said = (t) => String(t[main] ?? "");
  const flags = new Set(o.flags ?? []);
  const lower = (o.lang ?? langFor(main)).lower;
  const word = (k) => {
    const a = lower(p(k));
    return a !== k ? a : lower(p(k[0].toUpperCase() + k.slice(1)));
  };
  function staging(s0) {
    const s = s0, out = {};
    for (const k of STAGING) if (s[k] !== void 0) out[k] = s[k];
    if (s.link) out.link = Object.fromEntries(Object.entries(s.link).map(([k, t]) => [word(k), t]));
    if (s.obj) out.obj = s.obj.map((op) => op.set ? { ...op, set: deep(op.set, p) } : op);
    if (s.sfx) out.sfx = deep(s.sfx, p);
    return out;
  }
  const t3 = (t) => {
    const r = t, text = {};
    for (const l of every) if (typeof r[l] === "string") text[l] = P(r[l], l);
    return { tr: text[main] ?? "", ...text.en !== void 0 ? { en: text.en } : {}, ...text.fa !== void 0 ? { fa: text.fa } : {}, text };
  };
  const noted = (n) => Object.fromEntries(Object.entries(n).map(([l, v]) => [l, P(v, l)]));
  const card = (op) => ({ ...t3(op), ...op.ok ? { ok: true } : {}, ...op.tone ? { tone: op.tone } : {} });
  const defaults = {};
  for (const s of story.steps) {
    if (isChoice(s)) defaults[s.choice.id] = 0;
    if (isAct(s) && s.act.expect) defaults[s.act.id] = s.act.expect;
  }
  function perform(picks = {}) {
    const cues = [], info = [];
    const push = (c, i) => {
      cues.push(c);
      info.push(i);
    };
    const worn = (step) => dressed.changes[step] ? { costume: { ...dressed.changes[step] } } : {};
    const line = (l, step, kind, extra2 = {}, top = false) => {
      const st = { ...staging(l), ...top ? worn(step) : {} };
      const narr = "narr" in l && l.narr === true;
      if (narr && !st.to) st.to = "viewer";
      push({ line: { who: l.who, text: p(said(l)), ...st } }, { step, kind, who: l.who, ...t3(l), ...narr ? { narr } : {}, ..."note" in l && l.note ? { note: noted(l.note) } : {}, ...extra2 });
    };
    const beat = (b, step, kind, extra2 = {}, top = false) => push({ beat: { ...staging(b.beat), ...top ? worn(step) : {}, ...b.beat.who ? { who: b.beat.who } : {}, ...b.beat.wait !== void 0 ? { wait: b.beat.wait } : {} } }, { step, kind, ...b.beat.who ? { who: b.beat.who } : {}, ...extra2 });
    story.steps.forEach((s, step) => {
      if (!passes(s, flags)) return;
      if (isScene(s)) {
        push({ scene: { place: s.scene, at: { ...s.at ?? {} }, ...s.time ? { time: s.time } : {}, ...s.weather ? { weather: s.weather } : {}, ...s.state ? { state: s.state } : {}, ...s.kerim ? { perch: s.kerim } : {}, ...s.stop ? { stop: s.stop } : {}, ...worn(step) } }, { step, kind: "scene" });
      } else if (isLine(s)) {
        if (s.who === STANDIN) {
          const silent = s.voice === "silent";
          line(s, step, "say", { turn: { kind: "say", step, silent, options: [t3(s)] } }, true);
        } else line(s, step, "line", {}, true);
      } else if (isBeat(s)) beat(s, step, "beat", {}, true);
      else if (isSpot(s)) {
        const { lesson, ex, show } = s.spot, own = said(s.spot);
        const shown = t3({ ...s.spot, [main]: own || ex });
        push(
          { overlay: { kind: show ?? "spot", lesson, ex: p(ex), ...own ? { tr: p(own) } : {}, who: NARRATOR, ...staging(s.spot) } },
          { step, kind: "spot", who: NARRATOR, ...shown }
        );
      } else if (isChoice(s)) {
        const c = s.choice, k = Math.min(Math.max(0, Number(picks[c.id] ?? 0) | 0), c.options.length - 1), op = c.options[k];
        const turn = { kind: "choice", step, id: c.id, ...c.to ? { to: c.to } : {}, options: c.options.map(card) };
        line({ ...op, who: STANDIN }, step, "say", { turn, option: k });
        (op.reply ?? []).forEach((r, j) => {
          if (!passes(r, flags)) return;
          if (isBeat(r)) beat(r, step, "reply", { option: k, reply: j });
          else line(r, step, "reply", { option: k, reply: j });
        });
      } else if (isAct(s)) {
        const a = s.act;
        const cue = {
          kind: a.kind,
          targets: [...a.targets],
          ...a.expect ? { expect: a.expect } : {},
          ...a.prompt ? { prompt: p(said(a.prompt)) } : {},
          // the learner's actor does it, the one who asked hints and shows; a drag moves `item`
          who: STANDIN,
          ...a.to ? { by: a.to } : {},
          ...a.item ? { obj: a.item } : {}
        };
        const turn = { kind: "act", step, id: a.id, act: cue, ...a.prompt ? { prompt: t3(a.prompt) } : {}, ...a.to ? { to: a.to } : {} };
        push({ act: cue }, { step, kind: "act", ...a.to ? { who: a.to } : {}, ...a.prompt ? t3(a.prompt) : {}, turn });
        const got = picks[a.id] ?? a.expect;
        const react = !a.expect || got === a.expect ? a.react?.ok : a.react?.other;
        if (react && Object.keys(react).length) push({ beat: { react: { ...react } } }, { step, kind: "react" });
      }
    });
    return { script: { v: 1, cues }, info };
  }
  const ids = /* @__PURE__ */ new Set([...story.cast, ...story.extras ?? []]);
  for (const s of story.steps) if (isScene(s)) for (const id of Object.keys(s.at ?? {})) ids.add(id);
  const avatars = {}, puppets = {}, names = {}, voices = {}, tempo = {}, terms = {};
  for (const id of [...ids, NARRATOR]) {
    const ch = o.characters[id];
    if (ch) {
      names[id] = p(story.names?.[id] ?? textOf(ch.name, main) ?? id);
      if (ch.voice && (ch.voice.rate !== void 0 || ch.voice.pitch !== void 0)) voices[id] = { ...ch.voice.rate !== void 0 ? { rate: ch.voice.rate } : {}, ...ch.voice.pitch !== void 0 ? { pitch: ch.voice.pitch } : {} };
      if (ch.motion?.tempo !== void 0) tempo[id] = ch.motion.tempo;
      if (ch.terms?.length) terms[id] = [...ch.terms];
      if (ch.puppet) {
        puppets[id] = { puppet: ch.puppet };
        continue;
      }
    }
    if (id === NARRATOR) continue;
    const doc = id === STANDIN ? o.learner ?? ch?.avatar : ch?.avatar;
    if (doc) avatars[id] = doc;
  }
  const dressed = dressing(story, avatars, o.characters, (s) => passes(s, flags));
  const cast = { ...avatars, ...dressed.base, ...puppets };
  const places = {};
  for (const id of /* @__PURE__ */ new Set([story.place, ...story.steps.filter(isScene).map((s) => s.scene)])) {
    const pl = o.places[id];
    if (!pl) continue;
    const props = { ...pl.props ?? {}, ...storyProps(story, id) };
    places[id] = { ...pl, props: Object.fromEntries(Object.entries(props).map(([k, ref]) => [k, Object.fromEntries(Object.entries(ref).map(([f, v]) => [f, f === "kit" || f === "terms" || f === "at" || f === "keep" ? v : deep(v, p)]))])) };
  }
  const base = perform(defaults);
  const turns = base.info.flatMap((i) => i.turn ? [i.turn] : []);
  const extra = [];
  base.info.forEach((i, at) => {
    const t = i.turn;
    if (!t || t.kind === "say") return;
    const alts = t.kind === "choice" ? t.options.map((_, k) => k).filter((k) => k !== defaults[t.id]) : t.act.targets.filter((x) => x !== defaults[t.id]).slice(0, 1);
    for (const alt of alts) extra.push({ at, cues: perform({ ...defaults, [t.id]: alt }).script.cues.slice(at) });
  });
  return { story, turns, defaults, perform, load: { cast, wardrobe: dressed.wardrobe, places, extra, narrator: NARRATOR, names, voices, tempo, terms } };
}

// ../sahne-story/src/lint.ts
function linkOf(lang, word, st, props) {
  for (const [k, t] of Object.entries(st.link ?? {})) if (lang.match(word, k)) return t;
  const a = lang.fold(word.split("'")[0]);
  for (const [id, p] of Object.entries(props)) for (const n of p.names) if (lang.match(word, n) || a === n || lang.match(a, n)) return `obj:${id}`;
  return null;
}
function startProps(place, extra, fold2) {
  const out = {};
  for (const [id, ref] of Object.entries({ ...place.props ?? {}, ...extra })) {
    const { kit, at, n, terms, shown, keep, in: _in, ...params } = ref;
    const pos = typeof at === "string" ? place.marks[at] ?? null : at;
    out[id] = { kit, n: typeof n === "number" ? n : void 0, params, shown: shown !== false, at: pos ? { x: pos.x, z: pos.z } : null, names: [id, ...(terms ?? []).map((t) => fold2(t.split("-").pop() ?? t))], ...keep ? { keep } : {} };
  }
  return out;
}
function sceneState(story, s, id, place, at, fold2) {
  const on = Object.fromEntries(Object.entries(at).filter(([, m4]) => !place || place.marks[m4]));
  const props = Object.fromEntries(Object.entries(s.props).map(([k, p]) => [k, { ...p, params: { ...p.params } }]));
  if (s.id === id) {
    for (const p of Object.values(props)) if (p.holder && !on[p.holder]) {
      p.holder = void 0;
      p.shown = false;
    }
    return { id, place, on, props, away: s.away };
  }
  if (!place) return { id, place, on, props: {}, away: s.away };
  const site = place.site ?? id, sibling = !!s.place && (s.place.site ?? s.id) === site;
  const next = startProps(place, storyProps(story, id), fold2);
  const away = Object.fromEntries(Object.entries(s.away).filter(([, p]) => !p.site || sibling && p.site === site));
  for (const [k, p] of Object.entries(props)) {
    if (!p.keep && !sibling) continue;
    if (p.holder && on[p.holder]) next[k] = { ...p, at: null };
    else away[k] = { ...p, holder: void 0, ...p.keep ? {} : { site } };
  }
  for (const [k, p] of Object.entries(next)) {
    const was = away[k];
    if (!(p.keep || was?.site) || !was || p.holder) continue;
    next[k] = { ...p, n: was.n, shown: was.shown, params: was.params };
    delete away[k];
  }
  return { id, place, on, props: next, away };
}
var dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function lintStory(story, o) {
  const out = [], lang = o.lang ?? langFor("tr");
  const said = (t) => String(t[lang.id] ?? "");
  const add = (u, rule, message, fix, level = "error") => out.push({ rule, level, ...u.at, message, ...fix ? { fix } : {} });
  let state = { id: story.place, place: o.places[story.place] ?? null, on: {}, props: o.places[story.place] ? startProps(o.places[story.place], storyProps(story, story.place), lang.fold) : {}, away: {} };
  const visited = /* @__PURE__ */ new Set([story.place, ...story.steps.filter(isScene).map((s) => s.scene)]);
  for (const [id, p] of Object.entries(story.props ?? {})) for (const [pl, at] of Object.entries(placesOf(story, p))) {
    const place = o.places[pl];
    if (!visited.has(pl)) out.push({ rule: "props", level: "error", step: 0, message: `prop ${id} stands in ${pl}, which the story never visits` });
    else if (place && typeof at === "string" && !place.marks[at]) out.push({ rule: "props", level: "error", step: 0, message: `prop ${id} stands on mark ${at}, which ${pl} lacks` });
    if (place?.props?.[id]) out.push({ rule: "props", level: "error", step: 0, message: `prop ${id} shadows ${pl}'s own ${id}: give the story's prop another id` });
  }
  const markPos = (s, id) => {
    const m4 = s.on[id];
    const mk = m4 ? s.place?.marks[m4] : void 0;
    return mk ? { x: mk.x, z: mk.z } : null;
  };
  const targetPos = (s, t) => {
    if (t.startsWith("obj:")) {
      const p = s.props[t.slice(4)];
      return p?.holder ? markPos(s, p.holder) : p?.at ?? null;
    }
    if (t.startsWith("ch:")) return markPos(s, t.slice(3).split(".")[0]);
    if (t.startsWith("mark:")) {
      const mk = s.place?.marks[t.slice(5)];
      return mk ? { x: mk.x, z: mk.z } : null;
    }
    return null;
  };
  function apply(s, st, who) {
    for (const mv of [st.move ?? []].flat()) s.on[mv.who] = mv.how === "exit" ? null : mv.to;
    for (const op of st.obj ?? []) {
      const p = s.props[op.id];
      if (!p) continue;
      if (op.op === "show" || op.op === "own" || op.op === "place") p.shown = true;
      if (op.op === "hide") p.shown = false;
      if (op.op === "give") p.holder = op.to;
      if (op.op === "take") p.holder = who;
      if (op.op === "place") p.holder = void 0;
      const m4 = op.op === "place" || op.op === "go" ? (op.at ?? op.to)?.replace(/^mark:/, "") : void 0, mk = m4 ? s.place?.marks[m4] : void 0;
      if (mk && !(op.op === "go" && p.holder)) p.at = { x: mk.x, z: mk.z };
      if (op.op === "add" && op.n !== void 0) p.n = (p.n ?? 0) + op.n;
      if (op.op === "set" && op.set) {
        const { n, ...rest } = op.set;
        if (typeof n === "number") p.n = n;
        p.params = { ...p.params, ...rest };
      }
    }
  }
  const clone = (s) => ({ id: s.id, place: s.place, on: { ...s.on }, props: Object.fromEntries(Object.entries(s.props).map(([k, p]) => [k, { ...p, params: { ...p.params } }])), away: s.away });
  function check(u, before3, after) {
    const st = u.st;
    const objs = [st.at, ...Object.values(st.link ?? {}), ...(st.obj ?? []).map((op) => "obj:" + op.id)].filter((t) => !!t?.startsWith("obj:"));
    for (const t of new Set(objs)) if (!before3.props[t.slice(4)] && !after.props[t.slice(4)]) add(u, "link", `${t} is not a prop on stage here`);
    if (st.via && u.who && before3.on[u.who]) add(u, "via", `via "${st.via}" needs ${u.who} off stage, but ${u.who} is at ${before3.on[u.who]}`);
    const dots = u.text !== void 0 && /^\s*(…|\.\.\.)\s*$/.test(u.text);
    if (st.voice === "silent" && !(u.standin && dots)) add(u, "silent", `voice "silent" goes only on a stand-in line whose text is "\u2026"`);
    if (u.standin && dots && st.voice !== "silent") add(u, "silent", `the stand-in's "\u2026" is the silent card: give it voice "silent"`, { voice: "silent", emo: st.emo ?? "nervous" }, "warning");
    const reacts = Object.keys(st.react ?? {});
    if (reacts.length > 2) add(u, "budget", `${reacts.length} reactions: at most two listeners react`);
    const movers = [st.move ?? []].flat().map((m4) => m4.who);
    for (const w of new Set(movers)) if (movers.filter((x) => x === w).length > 1) add(u, "budget", `${w} moves twice in one line: one move per character`);
    if (u.text === void 0) return;
    const ws = lang.words(u.text), plain = ws.filter((w) => !w.pause).map((w) => w.w);
    if (st.on && !plain.some((w) => lang.match(w, st.on) || w === lang.lower(st.on))) add(u, "budget", `on: "${st.on}" is not a word of the line`);
    for (const k of Object.keys(st.link ?? {})) if (!plain.some((w) => lang.match(w, k))) add(u, "link", `link "${k}" is not a word of the line`);
    const motive = st.do ? lang.motive[st.do] : void 0;
    if (st.do && motive) {
      const ok = st.do === "count" ? !lang.number || plain.some((_, i) => {
        const r = lang.number(plain, i);
        return !!r && (r.n !== 1 || st.n === 1);
      }) : motivated(motive, plain) !== void 0;
      if (!ok) add(u, "budget", `"${st.do}" has no word in the line to motivate it`, void 0, "warning");
    }
    if (st.do && DEIXIS_GESTURES.has(st.do) && st.at?.startsWith("obj:")) {
      const named = plain.some((w) => linkOf(lang, w, st, after.props) === st.at) || plain.some((w) => lang.pointing(w));
      if (!named) add(u, "budget", `"${st.do}" at ${st.at}, but no word of the line names it`, void 0, "warning");
    }
    if (lang.lintLine) {
      const sp = u.who ? markPos(after, u.who) : null;
      const c = {
        who: u.who,
        text: u.text,
        st,
        words: ws,
        plain,
        linkOf: (w) => linkOf(lang, w, st, after.props),
        prop: (id) => after.props[id],
        holds: (t) => t.startsWith("obj:") && after.props[t.slice(4)]?.holder === u.who,
        distance: (t) => {
          if (c.holds(t)) return 0;
          const tp = targetPos(after, t);
          return sp && tp ? dist(sp, tp) : null;
        },
        add: (rule, message, fix, level = "error") => add(u, rule, message, fix, level)
      };
      lang.lintLine(c);
    }
  }
  function ways(u, s) {
    const lines2 = s.id ? o.solids?.[s.id] : void 0, place = s.place;
    if (!lines2?.length || !place) return;
    const at = (m4) => {
      const mk = m4 ? place.marks[m4] : void 0;
      return mk ? [mk.x, mk.y ?? 0, mk.z] : null;
    };
    const states = placeState(place, void 0);
    for (const mv of [u.st.move ?? []].flat()) {
      if (mv.how === "fly") continue;
      const door = mv.how === "enter" || mv.how === "exit" ? mv.from ?? Object.keys(place.marks).find((k) => place.marks[k].door && inState(place.marks[k].in, states)) : void 0;
      const legs = [mv.how === "enter" ? door : s.on[mv.who], ...mv.via ?? [], mv.how === "exit" ? door : mv.to];
      for (let i = 1; i < legs.length; i++) {
        const a = at(legs[i - 1]), b = at(legs[i]);
        if (!a || !b) continue;
        const way = route(a, b, lines2, { state: states, size: place.size });
        if (!way) add(u, "route", `${mv.who} has no way from ${legs[i - 1]} to ${legs[i]} in ${s.id}: a wall or a closed gate is in the way`);
        else if (way.length) add(u, "route", `${mv.who} walks round from ${legs[i - 1]} to ${legs[i]} in ${s.id} (${detour(a, b, way).toFixed(1)} m longer): check the staging, or move a mark`, void 0, "warning");
      }
    }
  }
  function unit(u) {
    const before3 = clone(state);
    ways(u, state);
    apply(state, u.st, u.who);
    check(u, before3, state);
  }
  let lines = 0, lastStandin = false, firstTurn = -1;
  const turn = (standin, step, isLineLike) => {
    if (!isLineLike) return;
    lines++;
    if (standin && lastStandin) out.push({ rule: "standin", level: "error", step, message: "two stand-in lines in a row: each turn is one card" });
    if (standin && firstTurn < 0) firstTurn = lines;
    lastStandin = standin;
  };
  const mech = story.arc?.mechanics;
  story.steps.forEach((s, step) => {
    if (isScene(s)) {
      const place = o.places[s.scene] ?? null;
      state = sceneState(story, state, s.scene, place, s.at ?? {}, lang.fold);
      const perch = s.kerim ?? place?.perch;
      if (o.characters?.[NARRATOR]?.puppet && !state.on[NARRATOR] && perch && place?.marks[perch]) state.on[NARRATOR] = perch;
    } else if (isLine(s)) {
      const l = s;
      turn(l.who === STANDIN, step, !l.narr);
      unit({ who: l.who, text: said(l), st: l, at: { step }, standin: l.who === STANDIN });
    } else if (isBeat(s)) unit({ who: s.beat.who, st: s.beat, at: { step }, standin: false });
    else if (isSpot(s)) unit({ who: "kerim", st: s.spot, at: { step }, standin: false });
    else if (isChoice(s)) {
      turn(true, step, true);
      const start = clone(state);
      let first = null;
      s.choice.options.forEach((op, option) => {
        state = clone(start);
        unit({ who: STANDIN, text: said(op), st: op, at: { step, option }, standin: true });
        (op.reply ?? []).forEach((r, reply) => {
          if (isBeat(r)) unit({ who: r.beat.who, st: r.beat, at: { step, option, reply }, standin: false });
          else unit({ who: r.who, text: said(r), st: r, at: { step, option, reply }, standin: r.who === STANDIN });
        });
        first ??= state;
      });
      state = first ?? start;
      if (s.choice.options.some((op) => op.reply?.some((r) => isLine(r)))) lastStandin = false;
    } else if (isAct(s)) {
      if (mech && !mech.includes("act")) out.push({ rule: "mechanics", level: "error", step, message: `an act, but the arc's mechanics (${mech.join(", ")}) do not include act` });
      for (const tg of s.act.targets) if (tg.startsWith("obj:") && !state.props[tg.slice(4)]) out.push({ rule: "link", level: "error", step, message: `act target ${tg} is not a prop on stage` });
    }
  });
  out.push(...lintRefs(story, o));
  out.push(...lintLooks(story, o));
  if (firstTurn < 0 || firstTurn > 4) out.push({ rule: "standin", level: "error", step: 0, message: firstTurn < 0 ? "the learner never has a turn" : `the learner's first turn is line ${firstTurn}: it must come within the first four lines` });
  return out;
}
function lintRefs(story, o) {
  const out = [];
  const err = (step, message, at = {}) => out.push({ rule: "place", level: "error", step, ...at, message });
  let here = story.place, on = o.places[here] ? placeState(o.places[here], void 0) : [];
  if (!o.places[here]) err(0, `the story starts in ${here}, which is no place`);
  const known = (pl, s, step, at = {}) => {
    const id = s.replace(/^-/, "").split(":")[0];
    if (!pl.states?.[id]) {
      err(step, `state ${id}: ${here} has ${Object.keys(pl.states ?? {}).join(", ") || "no states"}`, at);
      return false;
    }
    return true;
  };
  const station = (pl, name, step, at = {}) => {
    const all = pl.stops?.stations ?? [];
    if (!pl.stops) err(step, `stop at ${name}: ${here} is not a vehicle that stops`, at);
    else if (all.indexOf(name) < 1) err(step, `stop at ${name}: ${here} stops at ${all.slice(1).join(", ")}`, at);
  };
  const there = (pl, m4) => inState(pl.marks[m4]?.in, on);
  const moves = (st, step, at = {}) => {
    const pl = o.places[here];
    if (!pl) return;
    for (const e of [st?.env ?? []].flat()) if (e.startsWith("weather:") && !Object.hasOwn(WEATHER, e.slice(8))) err(step, `weather ${e.slice(8)}: the stage has ${Object.keys(WEATHER).join(", ")}`, at);
    for (const e of [st?.env ?? []].flat()) if (e.startsWith("time:")) {
      const [t, ms] = e.slice(5).split(":");
      if (pl.times?.length && !pl.times.includes(t)) err(step, `time ${t}: ${here} has ${pl.times.join(", ")}`, at);
      if (ms !== void 0 && !(Number(ms) >= 0 && Number(ms) <= 6e4)) err(step, `time ${t} over ${ms} ms: a change takes 0 to 60000 ms`, at);
    }
    for (const e of [st?.env ?? []].flat()) if (e.startsWith("stop:")) station(pl, e.slice(5), step, at);
    else if ((e === "depart" || e === "stop") && !pl.stops) err(step, `${e}: ${here} is not a vehicle that stops`, at);
    for (const e of [st?.env ?? []].flat()) if (e.startsWith("state:")) {
      const s = e.slice(6);
      if (known(pl, s, step, at)) on = placeState(pl, on, s.split(":")[0]);
    }
    for (const op of st?.obj ?? []) if (op.op === "go") for (const m4 of [...op.via ?? [], op.to ?? ""].map((x) => x.replace(/^mark:/, ""))) {
      if (!pl.marks[m4]) err(step, `obj ${op.id} goes to ${m4 || "(no mark)"}, which ${here} lacks`, at);
      else if (!there(pl, m4)) err(step, `obj ${op.id} goes to ${m4}, which is not there in ${here}'s ${on.join(", ") || "default"} state`, at);
    }
    for (const mv of [st?.move ?? []].flat()) {
      for (const v of mv.via ?? []) if (!pl.marks[v]) err(step, `${mv.who} passes ${v}, which ${here} lacks`, at);
      else if (!there(pl, v)) err(step, `${mv.who} passes ${v}, which is not there in ${here}'s ${on.join(", ") || "default"} state`, at);
      if (mv.to && !pl.marks[mv.to]) err(step, `${mv.who} moves to ${mv.to}, which ${here} lacks`, at);
      else if (mv.to && !there(pl, mv.to)) err(step, `${mv.who} moves to ${mv.to}, which is not there in ${here}'s ${on.join(", ") || "default"} state`, at);
    }
  };
  story.steps.forEach((s, step) => {
    if (isScene(s)) {
      const same = here === s.scene;
      here = s.scene;
      const pl = o.places[here];
      if (!pl) {
        const places = Object.values(o.places).filter((p) => p.site === here).map((p) => p.id);
        err(step, places.length ? `scene in ${here}, a site: name one of its places (${places.join(", ")})` : `scene in ${here}, which is no place`);
        return;
      }
      on = placeState(pl, same ? on : void 0, [s.state ?? []].flat().filter((x) => known(pl, x, step)));
      for (const [who, m4] of Object.entries(s.at ?? {})) if (!pl.marks[m4]) err(step, `${who} stands on ${m4}, which ${here} lacks`);
      else if (!there(pl, m4)) err(step, `${who} stands on ${m4}, which is not there in ${here}'s ${on.join(", ") || "default"} state`);
      if (s.kerim && !pl.marks[s.kerim]) err(step, `Kerim perches on ${s.kerim}, which ${here} lacks`);
      if (s.time && pl.times?.length && !pl.times.includes(s.time)) err(step, `time ${s.time}, but ${here} lists ${pl.times.join(", ")}`);
      if (s.weather && !Object.hasOwn(WEATHER, s.weather)) err(step, `weather ${s.weather}: the stage has ${Object.keys(WEATHER).join(", ")}`);
      if (s.stop) station(pl, s.stop, step);
    } else if (isLine(s)) moves(s, step);
    else if (isBeat(s)) moves(s.beat, step);
    else if (isSpot(s)) moves(s.spot, step);
    else if (isChoice(s)) s.choice.options.forEach((op, option) => {
      moves(op, step, { option });
      (op.reply ?? []).forEach((r, reply) => moves(isBeat(r) ? r.beat : r, step, { option, reply }));
    });
  });
  return out;
}
var REQUIRED = ["outfit.top", "outfit.bottom", "outfit.shoes"];
var KIT_WHY = {
  unknown: (n) => `the kit has no part ${n.id}`,
  slot: (n) => `${n.id} belongs to another slot`,
  build: (n) => `${n.id} is not made for this body's build`,
  size: () => "left out to keep the document within 2 KB"
};
var noteKey = (n) => `${n.field} ${n.id} ${n.why}`;
function lintLooks(story, o) {
  const out = [];
  const add = (at, message, level = "error") => out.push({ rule: "look", level, ...at, message });
  const chars = o.characters;
  const ids = /* @__PURE__ */ new Set([...story.cast, ...story.extras ?? []]);
  for (const s of story.steps) if (isScene(s)) for (const id of Object.keys(s.at ?? {})) ids.add(id);
  const avatars = {};
  for (const id of ids) {
    const a = chars?.[id]?.avatar;
    if (a) avatars[id] = a;
  }
  const now = { ...avatars };
  const fields = (look) => {
    const { clothing, other } = lookFields(look), bad = [];
    if (other.length) bad.push(`not clothing: ${other.join(", ")} (a look changes only outfit.*, wear.*, carry and hold)`);
    for (const f of REQUIRED) if (clothing[f] === null) bad.push(`${f}: null puts the kit's default back; name another part`);
    return bad;
  };
  const kitCheck = (doc, look) => {
    if (!o.kit) return [];
    const before3 = [], after = [];
    normalize(doc, o.kit, { trusted: true, notes: before3 });
    normalize(applyLook(doc, look), o.kit, { trusted: true, notes: after });
    const had = new Set(before3.map(noteKey)), clothing = new Set(CLOTHING_FIELDS);
    return after.filter((n) => clothing.has(n.field) && KIT_WHY[n.why] && !had.has(noteKey(n))).map((n) => `${n.field}: ${KIT_WHY[n.why](n)}`);
  };
  for (const id of ids) {
    const ch = chars?.[id];
    for (const [name, look] of Object.entries(ch?.outfits ?? {})) {
      if (name === "default") add({ step: 0 }, `${id}'s outfit "default": the name is reserved for the avatar itself`);
      for (const m4 of [...fields(look), ...ch.avatar ? kitCheck(ch.avatar, look) : []]) add({ step: 0 }, `${id}'s outfit "${name}": ${m4}`);
    }
  }
  const looks = (at, v) => {
    if (!v || typeof v !== "object" || Array.isArray(v)) {
      add(at, "looks is a map of character \u2192 outfit name or look");
      return;
    }
    for (const [id, ref] of Object.entries(v)) {
      if (id === NARRATOR) {
        add(at, `${id} is the narrator: the inset wears no looks`);
        continue;
      }
      if (!ids.has(id)) {
        add(at, `${id} is not in the story (cast, extras or a scene's at)`);
        continue;
      }
      if (chars && !chars[id]) {
        add(at, `${id} has no character document`);
        continue;
      }
      const outfits = chars?.[id]?.outfits, learner = id === STANDIN;
      let look = ref;
      if (typeof ref === "string") {
        if (ref !== "default" && chars && !(outfits && Object.hasOwn(outfits, ref))) {
          add(at, `${id} has no outfit "${ref}"${outfits ? ` (${["default", ...Object.keys(outfits)].join(", ")})` : ""}`);
          continue;
        }
        look = ref === "default" ? {} : outfits?.[ref];
      } else {
        const bad = fields(ref);
        for (const m4 of bad) add(at, `${id}: ${m4}`);
        if (bad.length) continue;
        if (now[id]) for (const m4 of kitCheck(now[id], ref)) add(at, `${id}: ${m4}`);
      }
      if (learner) {
        const extra = Object.keys(lookFields(look).clothing).filter((f) => !LEARNER_FIELDS.includes(f));
        if (extra.length) add(at, `${id} is the learner, in their own clothes: only ${LEARNER_FIELDS.join(" and ")} apply, not ${extra.join(", ")}`, "warning");
      }
      if (!now[id]) continue;
      const next = dress(ref, now[id], avatars[id], outfits, learner);
      if (!next) continue;
      const kept = learner && typeof ref !== "string" && !Object.keys(lookFields(forLearner(ref, now[id])).clothing).length;
      if (canon(next) === canon(now[id]) && !kept) add(at, `${id}'s look changes nothing: they already wear it`, "warning");
      now[id] = next;
    }
  };
  if (story.looks !== void 0) looks({ step: 0 }, story.looks);
  const misplaced = (at, where) => add(at, `looks inside ${where}: a change of clothes goes on the story, a scene, a line or a beat`);
  story.steps.forEach((s, step) => {
    const v = looksOf(s);
    if (v !== void 0) looks({ step }, v);
    if (isBeat(s) && "looks" in s) add({ step }, "looks on a beat go inside beat");
    if (isChoice(s)) {
      if ("looks" in s || "looks" in s.choice) misplaced({ step }, "a choice");
      s.choice.options.forEach((op, option) => {
        if ("looks" in op) misplaced({ step, option }, "a choice option");
        (op.reply ?? []).forEach((r, reply) => {
          if ("looks" in r || isBeat(r) && "looks" in r.beat) misplaced({ step, option, reply }, "a reply");
        });
      });
    }
    if (isAct(s) && ("looks" in s || "looks" in s.act)) misplaced({ step }, "an act");
    if (isSpot(s) && ("looks" in s || "looks" in s.spot)) misplaced({ step }, "a spot");
  });
  return out;
}
function suggest(story, o) {
  const lang = o.lang ?? langFor("tr"), said = (t) => String(t[lang.id] ?? "");
  const out = lintStory(story, o).flatMap((p) => p.fix ? [{ step: p.step, ...p.option !== void 0 ? { option: p.option } : {}, ...p.reply !== void 0 ? { reply: p.reply } : {}, rule: p.rule, message: p.message, fix: p.fix }] : []);
  let props = o.places[story.place] ? startProps(o.places[story.place], storyProps(story, story.place), lang.fold) : {}, here = story.place;
  const links = (text, st, at) => {
    const add = {};
    let place = false;
    for (const t of lang.words(text)) {
      if (t.pause) {
        place = false;
        continue;
      }
      const w = t.w;
      const after = place;
      place = lang.namesPlace(w);
      if (after) continue;
      if (lang.pointing(w)) continue;
      if (Object.keys(st.link ?? {}).some((k) => lang.match(w, k))) continue;
      const tg = linkOf(lang, w, {}, props);
      if (tg) add[w.split("'")[0]] = tg;
    }
    if (Object.keys(add).length) out.push({ ...at, rule: "link", message: `link ${Object.entries(add).map(([k, v]) => `${k} \u2192 ${v}`).join(", ")}`, fix: { link: { ...st.link ?? {}, ...add } } });
  };
  story.steps.forEach((s, step) => {
    if (isScene(s) && s.scene !== here) {
      const pl = o.places[s.scene];
      here = s.scene;
      props = pl ? startProps(pl, storyProps(story, s.scene), lang.fold) : {};
    } else if (isLine(s)) links(said(s), s, { step });
    else if (isChoice(s)) s.choice.options.forEach((op, option) => {
      links(said(op), op, { step, option });
      (op.reply ?? []).forEach((r, reply) => {
        if (isLine(r)) links(said(r), r, { step, option, reply });
      });
    });
  });
  return out.sort((a, b) => a.step - b.step || (a.option ?? -1) - (b.option ?? -1) || (a.reply ?? -1) - (b.reply ?? -1));
}

// ../sahne-story/src/needs.ts
function needsOf(needs, placeId) {
  for (const [site, s] of Object.entries(needs)) if (Object.hasOwn(s.places, placeId)) return { site, place: s.places[placeId] };
  return null;
}

// ../sahne-story/src/cards.ts
var isCard = (cards, id) => Object.hasOwn(cards, id) && !cards[id].retired;
var isA1 = (cards, id) => isCard(cards, id) && cards[id].level === "A1";
function cardProblem(cards, id) {
  if (!Object.hasOwn(cards, id)) return `${id} is not a card`;
  return cards[id].retired ? `${id} (${cards[id].tr}) is retired` : null;
}

// ../sahne-story/src/lint-place.ts
var PLACE_RULES = ["valid", "needs", "depth", "density", "crowd", "reach", "explore", "light", "sound", "budget"];
var BANDS = [
  { name: "far", test: (z) => z <= -6 },
  { name: "backdrop", test: (z) => z > -6 && z <= -1.5 },
  { name: "actors", test: (z) => z > -1.5 && z <= 0.5 },
  { name: "near", test: (z) => z > 0.5 }
];
var BASIC = /* @__PURE__ */ new Set(["wall", "floor", "window", "door_shop", "street"]);
var SURFACES = /* @__PURE__ */ new Set(["stone", "wood", "tile", "carpet"]);
var MAX_BYTES = 5120;
var MIN_PIECES = 12;
var MIN_SPECIAL = 3;
var MIN_DRESSING = 3;
var MIN_TAPPABLE = 5;
var MIN_VEHICLE_PIECES = 6;
var MAX_PEOPLE = 40;
var MARK_CLEAR = 0.12;
function segDist(p, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dz);
}
var CROWD_CLEAR = 0.6;
var PIECE_FIELDS = ["kit", "variant", "x", "y", "z", "id", "seed", "in", "switch", "terms", "solid"];
var PROP_FIELDS = ["kit", "variant", "at", "n", "terms", "shown", "keep", "in", "decor"];
var kindsOf = (s) => typeof s.type === "string" ? [s.type] : [...s.type];
function takes(s, v) {
  return kindsOf(s).some((k) => {
    switch (k) {
      case "enum":
        return typeof v === "string" && (s.values ?? []).includes(v);
      case "int":
      case "num":
        return typeof v === "number" && Number.isFinite(v) && (k === "num" || Number.isInteger(v)) && (s.min === void 0 || v >= s.min) && (s.max === void 0 || v <= s.max);
      case "bool":
        return typeof v === "boolean";
      case "text":
        return typeof v === "string" || typeof v === "number" || Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number");
      case "color":
        return typeof v === "string";
      case "list":
        return Array.isArray(v);
      case "object":
        return typeof v === "object" && v !== null && !Array.isArray(v);
    }
  });
}
function paramProblems(def, ref, own) {
  const meta = def.meta, out = [];
  if (!meta) return out;
  for (const [k, v] of Object.entries(ref)) {
    if (own.includes(k)) continue;
    const spec = meta.params[k];
    if (!spec) out.push({ level: "warning", message: `param ${k} is not one it reads (${Object.keys(meta.params).join(", ") || "none"})` });
    else if (!takes(spec, v)) out.push({ level: "error", message: `${k}: ${JSON.stringify(v)} is not a ${kindsOf(spec).join(" or ")}${spec.values ? ` (${spec.values.join(", ")})` : ""}${spec.min !== void 0 || spec.max !== void 0 ? ` (${spec.min ?? ""}\u2013${spec.max ?? ""})` : ""}` });
  }
  return out;
}
function lintPlace(doc, o) {
  const out = [];
  const level = doc.placeholder ? "warning" : "error";
  const add = (rule, message, lv = level) => out.push({ rule, level: lv, message });
  for (const l of allLanguages(o.languages ?? DEFAULT_LANGUAGES)) if (!doc.name?.[l]) add("valid", `no name in ${l}`);
  if (!doc.district && doc.life !== "run") add("valid", "no district (only a vehicle goes without one)", "warning");
  const timed = doc.pieces.filter((p) => "stops" in p && p.stops), tt = { ms: TIMETABLE.ms, run: TIMETABLE.run, ease: TIMETABLE.ease, ...doc.stops };
  if (doc.stops) {
    if (!(doc.stops.stations?.length >= 2) || !doc.stops.stations.every((x) => typeof x === "string" && x)) add("valid", "stops: name at least two stations, in the order it goes");
    if (doc.life !== "run") add("valid", 'stops: a vehicle that stops runs (life: "run")', "warning");
    if (!timed.length) add("valid", "stops: no piece keeps the timetable (stops: true)", "warning");
  } else if (timed.length) add("valid", `${timed.map((p) => p.kit).join(", ")} keep a timetable, but the place has no stops: a story cannot hold it at a station`, "warning");
  for (const p of timed) {
    const own = p.stops === true ? TIMETABLE : { ...TIMETABLE, ...p.stops };
    for (const k of ["ms", "run", "ease"]) if (doc.stops && own[k] !== tt[k]) add("valid", `${p.kit}: its timetable's ${k} ${own[k]} is not the place's ${tt[k]}`);
  }
  for (const p of doc.pieces) if (doc.stops && Array.isArray(p.stations) && JSON.stringify(p.stations) !== JSON.stringify(doc.stops.stations)) add("valid", `${p.kit}: its stations are not the place's (${doc.stops.stations.join(", ")})`);
  if (!doc.camera?.wide) add("valid", "no camera.wide");
  if (!doc.times?.length) add("valid", "no times");
  for (const t of doc.times ?? []) if (!Object.hasOwn(TIMES, t)) add("valid", `time ${t} is not one the stage has`);
  const perch = doc.perch ? doc.marks[doc.perch] : void 0;
  if (!doc.perch) add("valid", "no perch for Kerim");
  else if (!perch) add("valid", `perch ${doc.perch} is not a mark`);
  else if (!perch.air && !((perch.y ?? 0) > 0)) add("valid", `perch ${doc.perch} is on the floor: Kerim perches up high`);
  const top = doc.camera?.wide?.y1 ?? 2.45;
  for (const [id, m4] of Object.entries(doc.marks)) if ((id === doc.perch || m4.air) && (m4.y ?? 0) > top + 0.3) add("valid", `${id === doc.perch ? "perch" : "air mark"} ${id} at ${m4.y} m is above the wide shot's height band (camera.wide.y1 ${top}): raise y1`, "warning");
  for (const p of doc.pieces) if (typeof p.x !== "number" || typeof p.z !== "number") add("valid", `set piece ${p.kit}${p.id ? ` #${p.id}` : ""} has no x or z: it is not placed`);
  for (const p of doc.pieces) {
    const def = pieceOf(o.kit, "set", p.kit);
    if (!def) add("valid", `set piece ${p.kit} is not in the kit`);
    else if (p.variant !== void 0 && !Object.hasOwn(def.variants ?? {}, p.variant)) add("valid", `set piece ${p.kit} has no variant ${p.variant}`);
    else for (const m4 of paramProblems(def, p, PIECE_FIELDS)) add("valid", `set piece ${p.kit}${p.id ? ` #${p.id}` : ""}: ${m4.message}`, m4.level === "error" ? level : "warning");
  }
  for (const [id, p] of Object.entries(doc.props ?? {})) {
    const def = pieceOf(o.kit, "props", p.kit);
    if (!def) add("valid", `prop ${id}: ${p.kit} is not in the kit`);
    else if (p.variant !== void 0 && !Object.hasOwn(def.variants ?? {}, p.variant)) add("valid", `prop ${id}: ${p.kit} has no variant ${p.variant}`);
    else for (const m4 of paramProblems(def, p, PROP_FIELDS)) add("valid", `prop ${id}: ${m4.message}`, m4.level === "error" ? level : "warning");
  }
  const { w, d } = doc.size;
  for (const [id, m4] of Object.entries(doc.marks)) {
    if (!m4.air && (Math.abs(m4.x) > w / 2 || m4.z < -d || m4.z > 1)) add("valid", `mark ${id} (${m4.x}, ${m4.z}) is outside the place (${w} \xD7 ${d} m)`);
    if (m4.door !== void 0) {
      if (!doc.pieces.some((p) => p.id === m4.door)) add("valid", `door mark ${id} names door ${m4.door}, which no piece is`);
      if (!m4.out) add("valid", `door mark ${id} has no out (the street side)`);
    }
  }
  const states = doc.states ?? {};
  const named = [...doc.pieces.map((p) => [`piece ${p.id ?? p.kit}`, p.in]), ...Object.entries(doc.marks).map(([id, m4]) => [`mark ${id}`, m4.in]), ...Object.entries(doc.props ?? {}).map(([id, p]) => [`prop ${id}`, p.in])];
  for (const [what, list] of named) for (const s of list ?? []) if (!Object.hasOwn(states, s)) add("valid", `${what} is in state ${s}, which the place does not have`);
  const groups = /* @__PURE__ */ new Map();
  for (const s of Object.values(states)) if (s.default) groups.set(s.group ?? "", (groups.get(s.group ?? "") ?? 0) + (s.group ? 1 : 0));
  for (const [g, n] of groups) if (n > 1) add("valid", `${n} default states in group ${g}: one at most`);
  if (perch?.in) add("valid", `perch ${doc.perch} is only in state ${perch.in.join(", ")}: Kerim needs it in every state`);
  const entry = o.needs ? needsOf(o.needs, doc.id) : null;
  if (o.needs) {
    if (!entry) add("valid", `${doc.id} is no place of needs.json`);
    else if (entry.site !== doc.id && doc.site !== entry.site) add("valid", `${doc.id} is a place of site ${entry.site}: it needs site: "${entry.site}"`);
    else if (doc.site && doc.site !== entry.site) add("valid", `site ${doc.site}, but needs.json has ${doc.id} under ${entry.site}`);
  }
  if (entry) {
    const need = entry.place;
    for (const [m4, nm] of Object.entries(need.marks ?? {})) {
      if (!doc.marks[m4]) add("needs", `no mark ${m4} (${nm.stories.join(" ")})`);
      else if (nm.seat && doc.marks[m4].seat === void 0) add("needs", `mark ${m4} is someone's seat (${nm.stories.join(" ")}): give it a seat height`);
    }
    for (const p of Object.keys(need.props ?? {})) if (!doc.props?.[p] && !doc.pieces.some((q) => q.id === p)) add("needs", `no prop or piece ${p} (${need.props[p].stories.join(" ")})`);
    for (const s of Object.keys(need.states ?? {})) if (!Object.hasOwn(states, s)) add("needs", `no state ${s} (${need.states[s].stories.join(" ")})`);
    for (const t of need.times ?? []) if (!doc.times?.includes(t)) add("needs", `time ${t} is not listed`);
  }
  const cabin = doc.pieces.some((p) => p.kit === "cabin");
  const bands = BANDS.filter((b) => doc.pieces.some((p) => b.test(p.z)) || cabin && (b.name === "actors" || b.name === "near"));
  if (bands.length < BANDS.length) add("depth", `pieces in ${bands.length} of 4 depth bands; missing ${BANDS.filter((b) => !bands.includes(b)).map((b) => b.name).join(", ")}`);
  if (doc.outdoor && !doc.pieces.some((p) => BANDS[0].test(p.z))) add("depth", "outdoors with nothing far (a skyline, the sky or water)");
  const minPieces = cabin ? MIN_VEHICLE_PIECES : MIN_PIECES;
  if (doc.pieces.length < minPieces) add("density", `${doc.pieces.length} pieces; a finished ${cabin ? "vehicle (with a cabin)" : "place"} has at least ${minPieces}`);
  const special = new Set(doc.pieces.map((p) => p.kit).filter((k) => !BASIC.has(k)));
  if (special.size < MIN_SPECIAL) add("density", `${special.size} kinds of piece beyond walls, floors, windows, doors and the street; at least ${MIN_SPECIAL}`);
  for (const s of Object.keys(states)) {
    const own = doc.pieces.filter((p) => p.in?.includes(s)).length + Object.values(doc.props ?? {}).filter((p) => p.in?.includes(s)).length;
    if (own < 2) add("density", `state ${s} has ${own} piece${own === 1 ? "" : "s"} of its own; at least 2`);
  }
  const needed = new Set(Object.keys(entry?.place.props ?? {}));
  const dressing2 = Object.keys(doc.props ?? {}).filter((id) => !needed.has(id)).length;
  if (dressing2 < MIN_DRESSING) add("density", `${dressing2} dressing props beyond what the stories need; at least ${MIN_DRESSING}`);
  let people = 0;
  const crowdDef = o.kit.set.crowd;
  for (const c of doc.pieces) {
    if (c.kit !== "crowd" || !crowdDef) continue;
    const q = withVariant(crowdDef, c), kind = String(q.kind ?? "walk");
    if (kind === "far") continue;
    people += Number(q.n ?? 8);
    const a = c.x + Number(q.x0 ?? -500) / 100, b = c.x + Number(q.x1 ?? 500) / 100;
    for (const [id, m4] of Object.entries(doc.marks)) {
      if (m4.air || (m4.y ?? 0) > 0) continue;
      if (Math.abs(c.z - m4.z) < CROWD_CLEAR && m4.x > Math.min(a, b) - CROWD_CLEAR && m4.x < Math.max(a, b) + CROWD_CLEAR) add("crowd", `the ${kind} crowd at z ${c.z} passes within ${CROWD_CLEAR} m of mark ${id}: move it back`, "warning");
    }
  }
  if (people > MAX_PEOPLE) add("crowd", `${people} crowd people near the camera; at most ${MAX_PEOPLE}`, "warning");
  const solids = placeSolids(doc, o.kit);
  const feet = Object.entries(doc.marks).filter(([id, m4]) => !m4.air && id !== doc.perch && (m4.y ?? 0) < 1);
  const hub = feet.find(([, m4]) => m4.door) ?? feet[0];
  for (const [id, m4] of feet) {
    for (const l of solids) {
      if (m4.door && l.door === m4.door) continue;
      if (segDist([m4.x, m4.z], l.a, l.b) < MARK_CLEAR) add("reach", `mark ${id} stands in a solid line of ${l.piece ? `piece ${l.piece}` : "a piece"}: move it clear`, "warning");
    }
    if (!hub || id === hub[0]) continue;
    const way = route([hub[1].x, hub[1].y ?? 0, hub[1].z], [m4.x, m4.y ?? 0, m4.z], solids, { state: placeState(doc, void 0, m4.in), size: doc.size, door: typeof hub[1].door === "string" ? hub[1].door : void 0 });
    if (!way) add("reach", `mark ${id} cannot be walked to from ${hub[0]}: a wall or a closed gate is in the way`);
  }
  const tappable = [
    ...Object.entries(doc.props ?? {}).map(([id, p]) => ({ id: `prop ${id}`, terms: p.terms ?? [], decor: p.decor })),
    ...doc.pieces.filter((p) => p.id && Array.isArray(p.terms)).map((p) => ({ id: `piece ${p.id}`, terms: p.terms, decor: false }))
  ];
  for (const t of tappable) {
    if (!t.terms.length && !t.decor && t.id.startsWith("prop")) add("explore", `${t.id} names no card (or say decor: true)`);
    if (o.cards) for (const id of t.terms) {
      const why = cardProblem(o.cards, id);
      if (why) add("explore", `${t.id}: ${why}`);
    }
  }
  const cards = o.cards;
  const a1 = cards ? tappable.filter((t) => t.terms.some((id) => isA1(cards, id))).length : MIN_TAPPABLE;
  if (a1 < MIN_TAPPABLE) add("explore", `${a1} tappable things with an A1 card; at least ${MIN_TAPPABLE}`);
  if (doc.times?.some((t) => t === "dusk" || t === "night")) {
    const drawn = drawPieces(doc, o.kit).map((x) => x.out);
    if (!drawn.some((x) => x.lights?.length)) add("light", "dusk or night, but no piece carries a light (a lamp, a ceiling light)");
    if (!drawn.some((x) => x.flats.some((f) => f.emissive))) add("light", "dusk or night, but nothing lit (windows, a sign)");
  }
  if (!doc.ambience?.length) add("sound", "no ambience bed");
  for (const a of doc.ambience ?? []) if (!o.kit.sounds?.[a]) add("sound", `ambience ${a} is not a kit sound`);
  if (!doc.motif) add("sound", "no motif");
  else if (!o.kit.motifs?.[doc.motif]) add("sound", `motif ${doc.motif} is not a kit motif`);
  if (!doc.surface) add("sound", "no surface for the footsteps");
  else if (!SURFACES.has(doc.surface)) add("sound", `surface ${doc.surface} is not one of ${[...SURFACES].join(", ")}`);
  const bytes = JSON.stringify(doc).length;
  if (bytes > MAX_BYTES) add("budget", `${bytes} bytes of JSON; at most ${MAX_BYTES}`);
  const big = (what, f) => {
    const cells = [[f.group, f.ppcm ?? 1.6, ""], ...f.emissive ? [[f.emissive, f.glowPpcm ?? f.ppcm ?? 1.6, "glow "]] : []];
    for (const [g, ppcm, kind] of cells) {
      const { w: w2, h } = cellSize(g, ppcm);
      if (!fitsAtlas(w2, h)) add("budget", `${what}: its ${kind}flat is ${w2}\xD7${h} px at ${+ppcm.toFixed(2)} px/cm, larger than the ${ATLAS_MAX} atlas: make it smaller or split it`);
    }
  };
  for (const { p, out: out2 } of drawPieces(doc, o.kit)) for (const f of out2.flats) big(`piece ${p.id ?? p.kit}`, f);
  for (const [id, p] of Object.entries(doc.props ?? {})) {
    const def = pieceOf(o.kit, "props", p.kit);
    if (!def) continue;
    const params = Object.fromEntries(Object.entries(p).filter(([k]) => !PROP_FIELDS.includes(k) || k === "variant" || k === "n"));
    for (const f of def.draw(withVariant(def, params), rng(id), o.kit).flats) big(`prop ${id}`, f);
  }
  return out;
}

// ../sahne-story/src/player.ts
function storyPlayer(stage, story, hooks = {}) {
  let adapted = story;
  let picks = { ...adapted.defaults }, info = [], next = 1, run = null, last = "";
  const changed = () => hooks.onChange?.();
  const playing = () => !!run && stage.now() < run.dur;
  function load() {
    picks = { ...adapted.defaults };
    const perf = adapted.perform(picks);
    info = perf.info;
    stage.load(perf.script, { ...adapted.load, ...hooks.loadOptions ?? {} });
    stage.show(0);
    run = null;
    next = 1;
  }
  function playCue(i) {
    if (i >= info.length) return;
    hooks.onCue?.(info[i], i);
    const r = stage.play(i);
    run = r;
    next = i + 1;
    void r.done.then(() => {
      if (run === r) changed();
    });
    changed();
  }
  const replan = (from) => {
    const perf = adapted.perform(picks);
    info = perf.info;
    stage.setCues(from, perf.script.cues.slice(from));
  };
  const turnAt = (i) => info[i]?.turn;
  const player = {
    get picks() {
      return picks;
    },
    get info() {
      return info;
    },
    get next() {
      return next;
    },
    get run() {
      return run;
    },
    footer() {
      if (playing()) return { kind: "busy" };
      if (next >= info.length) return { kind: "end" };
      const t = turnAt(next);
      return t ? { kind: "turn", cue: next, turn: t } : { kind: "devam", cue: next };
    },
    devam() {
      if (playing()) {
        run.finish();
        changed();
        return;
      }
      if (next < info.length && !turnAt(next)) playCue(next);
    },
    say() {
      const t = turnAt(next);
      if (t?.kind === "say") playCue(next);
    },
    choose(index) {
      const t = turnAt(next);
      if (t?.kind !== "choice") return;
      const i = next;
      picks = { ...picks, [t.id]: index };
      replan(i);
      playCue(i);
    },
    async act() {
      const t = turnAt(next);
      if (t?.kind !== "act") return void 0;
      const i = next;
      hooks.onCue?.({ ...info[i], kind: "say", tr: t.prompt?.tr ?? "\u2026" }, i);
      const r = stage.play(i);
      run = r;
      next = i + 1;
      void r.done.then(() => {
        if (run === r) changed();
      });
      changed();
      const res = r.result ? await r.result : {};
      const target = res.target ?? t.act.targets[0];
      picks = { ...picks, [t.id]: target };
      replan(i + 1);
      changed();
      return target;
    },
    restart() {
      load();
      changed();
    },
    jump(i) {
      i = Math.max(0, Math.min(i | 0, info.length - 1));
      run = null;
      if (i === 0) {
        stage.show(0);
        next = 1;
        changed();
        return;
      }
      stage.show(i - 1);
      next = i;
      if (turnAt(i)) changed();
      else playCue(i);
    },
    replace(a) {
      adapted = a;
      picks = { ...a.defaults, ...picks };
      replan(0);
      if (next > info.length) next = info.length;
      changed();
    },
    tick() {
      const key = (playing() ? "p" : "s") + next;
      if (key !== last) {
        last = key;
        changed();
      }
    }
  };
  load();
  return player;
}

export {
  textIn,
  textOf,
  adaptStory,
  lintStory,
  suggest,
  needsOf,
  PLACE_RULES,
  lintPlace,
  storyPlayer
};
//# sourceMappingURL=chunk-6JPAPIMW.js.map
