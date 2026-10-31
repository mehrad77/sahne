import {
  lineMatcher
} from "./chunk-BLASJ6YA.js";

// ../sahne-tr/src/numbers.ts
var ONES = ["", "bir", "iki", "\xFC\xE7", "d\xF6rt", "be\u015F", "alt\u0131", "yedi", "sekiz", "dokuz"];
var TENS = ["", "on", "yirmi", "otuz", "k\u0131rk", "elli", "altm\u0131\u015F", "yetmi\u015F", "seksen", "doksan"];
var SCALES = [[1e9, "milyar"], [1e6, "milyon"], [1e3, "bin"]];
function hundreds(n) {
  const h = Math.floor(n / 100), t = Math.floor(n / 10) % 10, o = n % 10, out = [];
  if (h > 1) out.push(ONES[h]);
  if (h) out.push("y\xFCz");
  if (t) out.push(TENS[t]);
  if (o) out.push(ONES[o]);
  return out;
}
var sayDigits = (d) => [...d].filter((c) => c >= "0" && c <= "9").map((c) => c === "0" ? "s\u0131f\u0131r" : ONES[+c]).join(" ");
function sayNumber(n) {
  if (!Number.isFinite(n)) return "";
  if (n < 0) return `eksi ${sayNumber(-n)}`;
  n = Math.floor(n);
  if (n === 0) return "s\u0131f\u0131r";
  if (n >= 1e12) return sayDigits(n.toFixed(0));
  const out = [];
  let rest = n;
  for (const [v, w] of SCALES) {
    const q = Math.floor(rest / v);
    if (q) {
      if (!(v === 1e3 && q === 1)) out.push(...hundreds(q));
      out.push(w);
    }
    rest %= v;
  }
  out.push(...hundreds(rest));
  return out.join(" ");
}
function ordinal(words) {
  const v = /([aeıioöuü])[^aeıioöuü]*$/.exec(words)?.[1] ?? "i";
  const I = "a\u0131".includes(v) ? "\u0131" : "ei".includes(v) ? "i" : "ou".includes(v) ? "u" : "\xFC";
  const base = words.endsWith("d\xF6rt") ? `${words.slice(0, -1)}d` : words;
  return /[aeıioöuü]$/.test(base) ? `${base}nc${I}` : `${base}${I}nc${I}`;
}
var whole = (d) => d.length > 1 && d[0] === "0" || d.length > 12 ? sayDigits(d) : sayNumber(+d);
function sayNumeral(s, ord = false) {
  let pre = "";
  if (s.startsWith("%")) {
    pre = "y\xFCzde ";
    s = s.slice(1);
  }
  let out, m2;
  if ((m2 = /^(\d{1,2})[:.](\d{2})$/.exec(s)) && +m2[1] <= 24 && +m2[2] < 60) out = +m2[2] ? `${sayNumber(+m2[1])} ${whole(m2[2])}` : sayNumber(+m2[1]);
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) out = sayNumber(+s.replace(/\./g, ""));
  else if (m2 = /^(\d+),(\d+)$/.exec(s)) out = `${whole(m2[1])} virg\xFCl ${whole(m2[2])}`;
  else if (/^\d+$/.test(s)) out = whole(s);
  else out = s.replace(/\d+/g, (d) => ` ${whole(d)} `).replace(/[^\p{L}]+/gu, " ").trim();
  return pre + (ord ? ordinal(out) : out);
}
var VALUE = new Map([...ONES.map((w, v) => [w, v]).slice(1), ...TENS.map((w, v) => [w, v * 10]).slice(1)]);
var SCALE = /* @__PURE__ */ new Map([["y\xFCz", 100], ["bin", 1e3], ["milyon", 1e6], ["milyar", 1e9]]);
function readNumber(words, i) {
  const w0 = words[i];
  if (w0 === void 0) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(w0)) return { n: +w0.replace(/\./g, ""), len: 1 };
  if (/^\d+$/.test(w0)) return { n: +w0, len: 1 };
  let total = 0, cur = 0, len = 0;
  for (let k = i; k < words.length; k++) {
    const w = words[k], v = VALUE.get(w), s = SCALE.get(w);
    if (v !== void 0) cur += v;
    else if (s === 100) cur = (cur || 1) * 100;
    else if (s !== void 0) {
      total += (cur || 1) * s;
      cur = 0;
    } else break;
    len++;
  }
  return len ? { n: total + cur, len } : null;
}

// ../sahne-tr/src/text.ts
var VOWELS = "ae\u0131io\xF6u\xFC";
var isVowel = (c) => c !== void 0 && c.length === 1 && VOWELS.includes(c);
function lowerTr(s) {
  return s.normalize("NFC").replace(/I/g, "\u0131").replace(/İ/g, "i").toLowerCase();
}
var UNITS = { km: "kilometre", kg: "kilogram", cm: "santimetre", gr: "gram", ml: "mililitre", dk: "dakika" };
var LETTER = { \u011F: "yumu\u015Fak ge", q: "k\xFC", w: "ve", x: "iks" };
var HUM = /^h?m+h?$/;
var SHUSH = /^p?[şs]+t?$/;
function sayWord(word2, ord = false) {
  const s = lowerTr(word2).replace(/['’ʼ‘`]/g, "");
  if (UNITS[s]) return UNITS[s];
  const read = s.replace(/%?\d+(?:[.:,]\d+)*/g, (m2, at) => (at > 0 && /\p{L}/u.test(s[at - 1]) ? " " : "") + sayNumeral(m2, ord && at + m2.length === s.length));
  const out = read.replace(/-/g, " ").replace(/\s+/g, " ").trim();
  const letters2 = out.replace(/ /g, "");
  if (HUM.test(letters2) || SHUSH.test(letters2) || !/^[bcçdfgğhjklmnprsştvyzqwx]+$/.test(letters2)) return out;
  return [...letters2].map((c) => LETTER[c] ?? `${c}e`).join(" ");
}
var TOKEN = /(%?[\p{L}\p{N}][\p{L}\p{M}\p{N}]*(?:(?:['’ʼ‘-]|(?<=\p{N})[.:,](?=\p{N}))[\p{L}\p{M}\p{N}]+)*)|(\.{2,}|…|[.,;:!?—–]|(?<=^|\s)-(?=\s|$))/gu;
function tokens(text) {
  const out = [];
  let skip = -1;
  for (const m2 of text.matchAll(TOKEN)) {
    const i = m2.index ?? 0;
    if (m2[1]) {
      const end = i + m2[1].length;
      const ord = /^\d+$/.test(m2[1]) && /^\.\s+\p{Ll}/u.test(text.slice(end, end + 12));
      if (ord) skip = end;
      out.push({ kind: "word", i, text: m2[1], said: sayWord(m2[1], ord) });
    } else if (i !== skip) {
      const p = m2[2];
      out.push({ kind: "pause", i, text: p, mark: p === "\u2026" || p.length > 1 ? "ellipsis" : ".!?".includes(p) ? "stop" : "comma" });
    }
  }
  return out;
}

// ../sahne-tr/src/match.ts
function forms(...pats) {
  const out = /* @__PURE__ */ new Set();
  for (const pat of pats) {
    for (const [A, I] of [["a", "\u0131"], ["e", "i"], ["a", "u"], ["e", "\xFC"]]) {
      let alts = [""];
      for (const ch of pat) {
        const opts = ch === "A" ? [A] : ch === "I" ? [I] : ch === "D" ? ["d", "t"] : ch === "C" ? ["c", "\xE7"] : [ch];
        alts = alts.flatMap((s) => opts.map((x) => s + x));
      }
      for (const s of alts) out.add(s);
    }
  }
  return [...out];
}
var E = (id, slot, pat, o = {}) => ({ id, slot, forms: forms(pat), ...o });
var ENDINGS = [
  E("pl", 1, "lAr"),
  E("p1s", 2, "Im", { after: "C" }),
  E("p1s", 2, "m", { after: "V", vposs: true }),
  E("p2s", 2, "In", { after: "C" }),
  E("p2s", 2, "n", { after: "V", vposs: true }),
  E("p3s", 2, "I", { after: "C", setsP3: true }),
  E("p3s", 2, "sI", { after: "V", setsP3: true, vposs: true }),
  E("p1p", 2, "ImIz", { after: "C" }),
  E("p1p", 2, "mIz", { after: "V", vposs: true }),
  E("p2p", 2, "InIz", { after: "C" }),
  E("p2p", 2, "nIz", { after: "V", vposs: true }),
  E("acc", 3, "I", { after: "C", p3: "never" }),
  E("acc", 3, "yI", { after: "V", p3: "never" }),
  E("acc", 3, "nI", { p3: "only" }),
  E("dat", 3, "A", { after: "C", p3: "never" }),
  E("dat", 3, "yA", { after: "V", p3: "never" }),
  E("dat", 3, "nA", { p3: "only" }),
  E("loc", 3, "DA", { p3: "never" }),
  E("loc", 3, "nDA", { p3: "only" }),
  E("abl", 3, "DAn", { p3: "never" }),
  E("abl", 3, "nDAn", { p3: "only" }),
  E("gen", 3, "In", { after: "C" }),
  E("gen", 3, "nIn", { after: "V" }),
  E("ins", 3, "lA", { after: "C" }),
  E("ins", 3, "ylA", { after: "V" }),
  E("ki", 4, "ki", { prev: ["loc", "gen"] }),
  E("cop", 5, "DIr"),
  E("past", 5, "DI", { after: "C" }),
  E("past", 5, "yDI", { after: "V" }),
  E("evid", 5, "mI\u015F", { after: "C" }),
  E("evid", 5, "ymI\u015F", { after: "V" }),
  E("cond", 5, "sA", { after: "C" }),
  E("cond", 5, "ysA", { after: "V" }),
  E("ken", 5, "ken", { after: "C" }),
  E("ken", 5, "yken", { after: "V" }),
  E("pers", 6, "Im", { after: "C" }),
  E("pers", 6, "yIm", { after: "V" }),
  E("pers", 6, "sIn"),
  E("pers", 6, "Iz", { after: "C" }),
  E("pers", 6, "yIz", { after: "V" }),
  E("pers", 6, "sInIz"),
  E("pers", 6, "lAr"),
  { id: "pers", slot: 6, forms: ["m", "n", "k", ...forms("nIz")], after: "V", prev: ["past", "cond"] }
];
var BACK = "a\u0131ou";
var ROUND = "o\xF6u\xFC";
var INVARIANT = /* @__PURE__ */ new Set(["ki", "ken", "yken"]);
var lastVowel = (s) => [...s].reverse().find(isVowel) ?? "";
function harmonic(prev, f, loose) {
  const v = [...f].find(isVowel);
  if (!prev || !v || loose === "any" || INVARIANT.has(f)) return true;
  const round = ROUND.includes(prev);
  const ok = (back) => v === ("ae".includes(v) ? back ? "a" : "e" : back ? round ? "u" : "\u0131" : round ? "\xFC" : "i");
  return ok(BACK.includes(prev)) || loose === "front" && ok(false);
}
function endings(r, pos, st, depth = 0) {
  if (pos === r.length) return true;
  if (depth > 8) return false;
  for (const e of ENDINGS) {
    if (e.slot <= st.slot || e.after === "V" && !st.endsV || e.after === "C" && st.endsV) continue;
    if (e.p3 === "only" && !st.p3 || e.p3 === "never" && st.p3) continue;
    if (e.prev && !e.prev.includes(st.prev) || e.id === "ki" && st.ki || e.vposs && st.noVPoss) continue;
    for (const f of e.forms) {
      if (!r.startsWith(f, pos) || !harmonic(st.last, f, st.loose)) continue;
      const ki = e.id === "ki";
      const next = { slot: ki ? 2 : e.slot, p3: ki || !!e.setsP3, prev: e.id, endsV: isVowel(f[f.length - 1]), ki: st.ki || ki, noVPoss: false, last: lastVowel(f) || st.last, loose: "" };
      if (endings(r, pos + f.length, next, depth + 1)) return true;
    }
  }
  return false;
}
var DOUBLE = /* @__PURE__ */ new Set(["af", "hak", "his", "hat", "had", "ret", "s\u0131r", "t\u0131p", "zan", "z\u0131t", "\xFCs", "\u015F\u0131k"]);
var SOFT = { p: "b", \u00E7: "c", t: "d", k: "\u011F", g: "\u011F" };
var FRONT = /* @__PURE__ */ new Set(["saat", "dikkat", "seyahat", "hakikat", "kalp", "harf", "harp"]);
function stems(t) {
  const out = [{ s: t, vowel: false }], last = t[t.length - 1];
  if (SOFT[last]) out.push({ s: t.slice(0, -1) + SOFT[last], vowel: true });
  if (last === "k" && t[t.length - 2] === "n") out.push({ s: `${t.slice(0, -1)}g`, vowel: true });
  const drop = /^(.*[aeıioöuü].*[^aeıioöuü])[ıiuü]([^aeıioöuü])$/.exec(t);
  if (drop) out.push({ s: drop[1] + drop[2], vowel: true });
  if (DOUBLE.has(t)) out.push({ s: t + last, vowel: true });
  if (t === "su") out.push({ s: "suy", vowel: true });
  return out;
}
var clean = (s) => lowerTr(s).replace(/[’ʼ‘`´]/g, "'").replace(/â/g, "a").replace(/î/g, "i").replace(/û/g, "u").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
var start = (stem, compound, noVPoss, loose) => ({ slot: 0, p3: compound, prev: "", endsV: isVowel(stem[stem.length - 1]), ki: false, noVPoss, last: lastVowel(stem), loose });
function match(word2, token) {
  const w = clean(word2), parts = clean(token).split(/\s+/).filter(Boolean);
  if (!w || !parts.length) return false;
  const t = parts[parts.length - 1], compound = parts.length > 1;
  if (w === t) return true;
  const ap = w.indexOf("'");
  if (ap > 0) {
    const stem = w.slice(0, ap), rest = w.slice(ap + 1).replace(/'/g, "");
    return stem === t && (!rest || endings(rest, 0, start(stem, compound, t === "su", "any")));
  }
  const loose = FRONT.has(t) || /[aıou]l$/.test(t) ? "front" : "";
  for (const { s, vowel } of stems(t)) {
    if (w.length <= s.length || !w.startsWith(s)) continue;
    const rest = w.slice(s.length);
    if (vowel && !isVowel(rest[0])) continue;
    if (endings(rest, 0, start(s, compound && s === t, s === "su", loose))) return true;
  }
  return false;
}
function deixis(word2) {
  const w = clean(word2);
  const m2 = /^(bu|şu|o)(?:n(?:u|a|da|dan|un|lar(?:ı|a|da|dan|ın)?)|ra(?:sı|da|ya|dan)?)?$/.exec(w);
  if (m2) return m2[1];
  return w === "b\xF6yle" ? "bu" : w === "\u015F\xF6yle" ? "\u015Fu" : w === "\xF6yle" ? "o" : null;
}

// ../sahne-tr/src/speech.ts
var TIMING = {
  /** A syllable: its onset consonant and its vowel. */
  syllable: 200,
  /** Lips closed for m b p, taken from the syllable they start (or added, at the end of one). */
  mbp: 70,
  /** Lower lip on the teeth for f v. */
  fv: 60,
  /** A short close between two syllables with the same mouth shape (ka-la-cak), so the mouth does not freeze. */
  dip: 50,
  /** Each extra consonant of a cluster at the start or end of a word (tren, Türk, üst). */
  cluster: 40,
  /** ğ after a vowel, before a consonant or at the end, lengthens the vowel (dağ, doğru). */
  lengthen: 60,
  /** The shortest a vowel gets when labials eat into its syllable. */
  minVowel: 100,
  /** Between two words. */
  gap: 60,
  comma: 250,
  stop: 450,
  ellipsis: 600,
  /** A line that is only "…" (the silent card). */
  silent: 900,
  /** Per letter of a hum (hmm) or a shush (şşt), within 300–600 ms. */
  hum: 120
};
var PAUSE = { comma: TIMING.comma, stop: TIMING.stop, ellipsis: TIMING.ellipsis };
var VISEME = { a: "A", e: "E", \u0131: "I", i: "I", o: "O", \u00F6: "O", u: "U", \u00FC: "U" };
var LIP = { m: "MBP", b: "MBP", p: "MBP", f: "FV", v: "FV" };
var LIP_MS = { MBP: TIMING.mbp, FV: TIMING.fv };
var TR = "abc\xE7defg\u011Fh\u0131ijklmno\xF6prs\u015Ftu\xFCvyz";
var FOREIGN = { \u00E2: "a", \u00EE: "i", \u00FB: "u", \u00EA: "e", \u00F4: "o", w: "v", q: "k", x: "ks" };
function phonemes(said) {
  let out = "";
  for (const ch of said) {
    if (TR.includes(ch)) out += ch;
    else if (FOREIGN[ch]) out += FOREIGN[ch];
    else if (/\p{L}/u.test(ch)) {
      const b = ch.normalize("NFD")[0];
      if (TR.includes(b)) out += b;
      else if (FOREIGN[b]) out += FOREIGN[b];
    }
  }
  return out;
}
function syllables(p) {
  const out = [];
  let cons = "";
  for (const c of p) {
    if (!VISEME[c]) {
      cons += c;
      continue;
    }
    if (!out.length) out.push({ onset: cons, v: c, coda: "" });
    else {
      out[out.length - 1].coda += cons.slice(0, -1);
      out.push({ onset: cons.slice(-1), v: c, coda: "" });
    }
    cons = "";
  }
  if (out.length) out[out.length - 1].coda += cons;
  return out;
}
function add(keys, t, v) {
  while (keys.length && keys[keys.length - 1].t >= t) keys.pop();
  if (keys.length && keys[keys.length - 1].v === v) return;
  keys.push({ t, v });
}
function word(p, t, keys) {
  const T = TIMING, hold = (n) => Math.min(600, Math.max(300, T.hum * n));
  if (HUM.test(p)) {
    add(keys, t, "MBP");
    return t + hold(p.length);
  }
  if (SHUSH.test(p)) {
    add(keys, t, "U");
    return t + hold(p.length);
  }
  const syl = syllables(p);
  if (!syl.length) {
    add(keys, t, "rest");
    return t + T.syllable / 2;
  }
  for (let k = 0; k < syl.length; k++) {
    const { onset, v, coda } = syl[k], last = k === syl.length - 1, shape = VISEME[v];
    let used = 0;
    for (let j = 0; j < onset.length; j++) {
      const c = onset[j], lip = LIP[c], own = j === onset.length - 1;
      if (lip) {
        add(keys, t, lip);
        t += LIP_MS[lip];
        if (own) used += LIP_MS[lip];
      } else if (!own) t += T.cluster;
      else if (c !== "\u011F" && keys[keys.length - 1]?.v === shape) {
        add(keys, t, "rest");
        t += T.dip;
        used += T.dip;
      }
    }
    add(keys, t, shape);
    t += Math.max(T.minVowel, T.syllable - used);
    for (let j = 0; j < coda.length; j++) {
      const c = coda[j], lip = LIP[c];
      if (lip) {
        add(keys, t, lip);
        t += LIP_MS[lip];
      } else if (c === "\u011F") t += T.lengthen;
      else if (last && j > 0) t += T.cluster;
    }
  }
  return t;
}
function foreign(text) {
  const n = Math.max(1, Math.round((text.match(/\p{L}/gu)?.length ?? 1) / 2.5));
  return Array.from({ length: n }, (_, k) => k % 2 ? "de" : "da").join("");
}
function speech(text, o = {}) {
  const rate = o.rate !== void 0 && Number.isFinite(o.rate) && o.rate > 0 ? o.rate : 1;
  const ms = (x) => Math.round(x / rate);
  const keys = [], spans = [];
  let t = 0, pause = 0;
  for (const tok of tokens(text)) {
    if (tok.kind === "pause") {
      pause = Math.max(pause, PAUSE[tok.mark]);
      continue;
    }
    if (spans.length) t += Math.max(TIMING.gap, pause);
    else t += pause;
    pause = 0;
    const t0 = t, p = phonemes(tok.said.replace(/ /g, ""));
    t = word(p || phonemes(foreign(tok.text)), t, keys);
    add(keys, t, "rest");
    spans.push({ i: tok.i, text: tok.text, t0, t1: t });
  }
  if (!spans.length) {
    const s = text.trim();
    if (!s) return { dur: 0, keys: [{ t: 0, v: "rest" }], words: [] };
    const dur = ms(TIMING.silent);
    return { dur, keys: [{ t: 0, v: "rest" }], words: [{ i: text.search(/\S/), text: s, t0: 0, t1: dur }] };
  }
  t += pause;
  const out = [];
  if (keys[0].t > 0) out.push({ t: 0, v: "rest" });
  for (const k of keys) add(out, ms(k.t), k.v);
  return { dur: ms(t), keys: out, words: spans.map((w) => ({ ...w, t0: ms(w.t0), t1: ms(w.t1) })) };
}

// ../sahne-tr/src/listen.ts
var FILLER = /^(?:ı+|e{1,}h*|ı+h+ı*|ı*m{2,}|h+m+|aa+h*|ö+|ah+h|eh+)$/;
var VARIANTS = { buyurun: "buyrun", buyurunuz: "buyrunuz", ho\u015Fgeldin: "ho\u015F geldin", ho\u015Fgeldiniz: "ho\u015F geldiniz", ho\u015Fbulduk: "ho\u015F bulduk", tamamd\u0131r: "tamam" };
var NEAR = { \u0131: "i", \u015F: "s", \u00E7: "c", \u011F: "g", \u00F6: "o", \u00FC: "u" };
function spoken(said) {
  const out = [];
  for (const t of tokens(said.replace(/[â]/g, "a").replace(/[î]/g, "i").replace(/[û]/g, "u").replace(/[Â]/g, "A").replace(/[Î]/g, "\u0130").replace(/[Û]/g, "U"))) {
    if (t.kind !== "word") continue;
    for (const w0 of t.said.split(/\s+/)) out.push(lowerTr(w0).replace(/[^\p{L}\p{N}]/gu, ""));
  }
  return out;
}
var m = lineMatcher({ normalise: spoken, near: NEAR, soft: "\u011F", fillers: FILLER, spellings: VARIANTS });
var sayWords = m.sayWords;
var normalise = m.normalise;
var letters = m.letters;
var allowance = m.allowance;
var matchLine = m.matchLine;

// ../sahne-tr/src/time.ts
var HOURS = ["bir", "iki", "\xFC\xE7", "d\xF6rt", "be\u015F", "alt\u0131", "yedi", "sekiz", "dokuz", "on", "on bir", "on iki"];
var BACK2 = /[aıou][^aeıioöuü]*$/;
var soft = (w) => w.endsWith("d\xF6rt") ? `${w.slice(0, -1)}d` : w;
var vowelEnd = (w) => /[aeıioöuü]$/.test(w);
function dative(w) {
  const A = BACK2.test(w) ? "a" : "e";
  return vowelEnd(w) ? `${w}y${A}` : `${soft(w)}${A}`;
}
function accusative(w) {
  const v = /([aeıioöuü])[^aeıioöuü]*$/.exec(w)?.[1] ?? "i";
  const I = "a\u0131".includes(v) ? "\u0131" : "ei".includes(v) ? "i" : "ou".includes(v) ? "u" : "\xFC";
  return vowelEnd(w) ? `${w}y${I}` : `${soft(w)}${I}`;
}
var FORMS = /* @__PURE__ */ new Map();
HOURS.forEach((w, k) => {
  FORMS.set(w, [k + 1, "nom"]);
  FORMS.set(dative(w), [k + 1, "dat"]);
  FORMS.set(accusative(w), [k + 1, "acc"]);
});
function hourAt(words, i) {
  const two = words[i + 1] !== void 0 ? FORMS.get(`${words[i]} ${words[i + 1]}`) : void 0;
  if (two) return { h: two[0], c: two[1], len: 2 };
  const one = FORMS.get(words[i]);
  if (one) return { h: one[0], c: one[1], len: 1 };
  const d = /^(\d{1,2})(?:'(.+))?$/.exec(words[i] ?? "");
  if (d && +d[1] >= 0 && +d[1] <= 24) {
    const s = d[2] ?? "";
    return { h: +d[1], c: /^y?[ae]$/.test(s) ? "dat" : /^y?[ıiuü]$/.test(s) ? "acc" : "nom", len: 1 };
  }
  return null;
}
function minutesAt(words, i) {
  if (words[i] === "\xE7eyrek") return { m: 15, len: 1 };
  const r = readNumber(words, i);
  return r && r.n > 0 && r.n < 60 ? { m: r.n, len: r.len } : null;
}
function readClock(text) {
  const out = [];
  const low = lowerTr(text).replace(/[’ʼ‘]/g, "'");
  for (const m2 of low.matchAll(/(?<![\d.:])(\d{1,2})[:.](\d{2})(?![\d]|[.:]\d)/g)) if (+m2[1] <= 24 && +m2[2] < 60) out.push({ h: +m2[1], m: +m2[2] });
  if (out.length) return out;
  const words = low.replace(/(\d)[:.](\d)/g, "$1_$2").split(/[^\p{L}\p{N}'_]+/u).filter(Boolean).map((w) => w.replace(/^'+|'+$/g, ""));
  for (let i = 0; i < words.length; i++) {
    const saat = words[i - 1] === "saat";
    if (words[i] === "yar\u0131m" && saat) {
      out.push({ h: 12, m: 30 });
      continue;
    }
    const h = hourAt(words, i);
    if (!h) continue;
    let j = i + h.len;
    if (h.c === "nom" && words[j] === "bu\xE7uk") {
      out.push({ h: h.h, m: 30 });
      i = j;
      continue;
    }
    if (h.c !== "nom") {
      const mm = minutesAt(words, j);
      if (mm) {
        const k = j + mm.len, verb = words[k] ?? "";
        if (h.c === "dat" && /^(var|kala|kaldı)/.test(verb)) {
          out.push({ h: h.h === 1 ? 12 : h.h - 1, m: 60 - mm.m });
          i = k;
          continue;
        }
        if (h.c === "acc" && /^(geç|geçiyor|geçe)/.test(verb)) {
          out.push({ h: h.h, m: mm.m });
          i = k;
          continue;
        }
      }
      continue;
    }
    if (saat) {
      const mm = minutesAt(words, j);
      if (mm) {
        out.push({ h: h.h, m: mm.m });
        j += mm.len;
      } else out.push({ h: h.h, m: 0 });
      i = j - 1;
    }
  }
  return out;
}
function clockMinutes(t) {
  const c = typeof t === "string" ? (/^(\d{1,2})[:.](\d{2})$/.exec(t.trim()) ?? []).slice(1).map(Number) : [t.h, t.m];
  if (c.length !== 2 || c.some((x) => !Number.isFinite(x))) return null;
  return c[0] % 12 * 60 + c[1];
}

// ../sahne-tr/src/index.ts
var tr = { id: "tr", locale: "tr-TR", speech, match, normalise, matchLine };
var src_default = tr;

export {
  readNumber,
  lowerTr,
  tokens,
  match,
  deixis,
  readClock,
  clockMinutes,
  src_default
};
//# sourceMappingURL=chunk-ZT53KTYM.js.map
