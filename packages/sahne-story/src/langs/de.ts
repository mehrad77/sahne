// German as a story language (src/lang.ts), on sahne-de: its words and pauses, noun endings (`match`), the words that
// motivate each gesture, numbers said aloud, the check's dictionary forms (de-words.ts), and the German lints:
//
//   deixis    dieser / jener + a linked noun, or "das Brot hier / da", needs a deixis gesture at that thing, and they agree
//   var_yok   "Es gibt X" / "Es gibt kein X" about a linked prop needs it shown / hidden by then
//   number    a number before a linked prop matches the `n` of the count or of the prop change
//   time      a clock time said aloud matches the linked clock
//
// There are no series hints: Kumru's are Turkish only. A rule's name stays the same across languages (`var_yok`).
// Every motive word and agreement here wants a native speaker's check.

import type { ObjOp, Staging, Target } from "sahne";
import { clockMinutes, deixis, lowerDe, match, readClock, readNumber, tokens } from "sahne-de";
import type { LineContext, LineWord, StoryLang } from "../lang.ts";
import { resolver, words as checkWords } from "./de-words.ts";
import { DEIXIS_GESTURES, FAR, NEAR } from "./tr.ts";

type Dx = "dies" | "jen" | "da";
/** Which deixis gestures each demonstrative takes. dieser is near (hold it up, touch it), jener is far, "da" points. */
const AGREE: Record<Dx, string[]> = { dies: ["hold_up", "touch", "point"], jen: ["point_far", "point"], da: ["point", "point_far"] };
const ADVICE: Record<Dx, string> = { dies: "hold_up", jen: "point_far", da: "point" };

/** Words that motivate a gesture (prefixes of the lower-case word, or a phrase). Gestures not listed need none. */
const MOTIVE: Record<string, string[]> = {
  count: [], // a number
  give: ["bitte", "hier", "nimm", "nehm", "gib", "geb", "bitteschön"],
  take: ["danke", "dankeschön", "vielen dank", "nimm", "nehm"],
  welcome: ["willkommen", "herzlich", "herein", "komm", "bitte"],
  wave: ["hallo", "hi", "servus", "moin", "tschüss", "tschüs", "tschau", "auf wiedersehen", "wiedersehen", "guten tag", "guten morgen", "guten abend", "gute nacht", "grüß", "bis bald", "bis morgen"],
  nod: ["ja", "okay", "ok", "klar", "genau", "gut", "stimmt", "richtig", "natürlich", "gern", "einverstanden", "verstanden", "in ordnung", "alles klar"],
  shake_head: ["nein", "kein", "nicht", "nie", "nee", "nö"],
  cik: ["nein", "nee", "nö", "nicht", "kein"],
  shrug: ["weiß", "weiss", "keine ahnung", "vielleicht", "leider", "aber", "tja", "naja", "hm"],
  hand_heart: ["danke", "dankeschön", "bitte", "gern", "freut", "herzlich", "vielen dank"],
  me: ["ich", "mich", "mir", "mein"],
  you: ["du", "sie", "dich", "dir", "ihr", "euch", "dein"],
  beckon: ["komm", "her", "hierher", "hierhin"],
  stop: ["halt", "stopp", "stop", "warte", "moment", "nein", "genug"],
  thumb_up: ["super", "toll", "prima", "klasse", "gut", "wunderbar", "perfekt", "sehr gut", "bravo", "schön", "ausgezeichnet", "lecker"],
  shush: ["pst", "sch", "leise", "ruhe", "still"],
  bow_head: ["entschuldig", "verzeih", "tut mir leid", "sorry", "pardon"],
  phone: ["hallo", "telefon", "handy", "anruf", "anruf"],
};

const ascii = (s: string) => lowerDe(s).replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
const words = (text: string): LineWord[] => tokens(text).map(t => (t.kind === "word" ? { w: lowerDe(t.text).replace(/[’']/g, "'"), i: t.i } : { w: t.mark === "comma" ? "," : ".", i: t.i, pause: true, q: t.text === "?" }));

const ADVERB = /^(hier|da|dort)$/;
const NEGATION = /^(kein\p{L}*|nichts|nicht)$/u;

/** The German lints of a line: deixis, es gibt, numbers, clock times. */
function lintLine(c: LineContext) {
  const { st, words: ws, plain, add } = c;
  const word = (k: number) => (ws[k] && !ws[k].pause ? ws[k] : null);
  ws.forEach((t, i) => {
    if (t.pause) return;
    // deixis: dieser / jener + a noun (an adjective may stand between), or a noun + hier / da / dort
    let d: Dx | null = null, tgt: Target | null = null, phrase = "";
    const dw = deixis(t.w);
    if (dw) {
      for (const k of [i + 1, i + 2]) {
        const w = word(k);
        if (!w) break;
        const link = c.linkOf(w.w);
        if (link) { d = dw; tgt = link; phrase = ws.slice(i, k + 1).map(x => x.w).join(" "); break; }
      }
    } else if (ADVERB.test(t.w) && i > 0 && word(i - 1) && !deixis(word(i - 1)!.w)) {
      const link = c.linkOf(ws[i - 1].w);
      if (link) { d = t.w === "hier" ? "dies" : "da"; tgt = link; phrase = `${ws[i - 1].w} ${t.w}`; }
    }
    if (d && tgt) {
      if (!st.do || !DEIXIS_GESTURES.has(st.do) || st.at !== tgt) {
        add("deixis", `"${phrase}" needs a deixis gesture at ${tgt} (${ADVICE[d]})`, { do: ADVICE[d], at: tgt });
      } else {
        const held = c.holds(tgt), far = c.distance(tgt);
        if (!AGREE[d].includes(st.do)) add("deixis", `"${phrase}" with ${st.do}: ${d === "dies" ? "dieser" : d === "jen" ? "jener" : "da"} takes ${AGREE[d].join(" or ")}`, { do: ADVICE[d], at: tgt });
        else if (held && d !== "dies") add("deixis", `"${phrase}": ${c.who} holds it, so it is dieser`, undefined, "warning");
        else if (d === "dies" && st.do === "point" && far !== null && far > NEAR) add("deixis", `"${phrase}": dieser is near, but ${tgt} is ${far.toFixed(1)} m away (jener, or hold it up)`);
        else if (d === "jen" && st.do === "point" && far !== null && far < FAR) add("deixis", `"${phrase}": jener is far, but ${tgt} is ${far.toFixed(1)} m away (dieser)`, { do: "point", at: tgt }, "warning");
        else if (d === "dies" && far !== null && far > NEAR) add("deixis", `"${phrase}": dieser is near, but ${tgt} is ${far.toFixed(1)} m away`, undefined, "warning");
        else if (d === "jen" && far !== null && far <= NEAR) add("deixis", `"${phrase}": jener is far, but ${tgt} is within reach (${far.toFixed(1)} m)`, undefined, "warning");
      }
    }
    // es gibt / es gibt kein: the assertion, not the question ("Gibt es Brot?", "Es gibt Brot?")
    if (t.w === "gibt" && (ws[i - 1]?.w === "es" || ws[i + 1]?.w === "es")) { // "gibt" alone is also "gives"
      let from = i, to = i;
      while (from > 0 && !(ws[from - 1].pause && ws[from - 1].w === ".")) from--;
      while (to < ws.length - 1 && !(ws[to].pause && ws[to].w === ".")) to++;
      const sentence = ws.slice(from, to + 1), question = sentence.some(w => w.q) || sentence.find(w => !w.pause)?.w === "gibt";
      if (question) return;
      const negated = sentence.some(w => !w.pause && NEGATION.test(w.w));
      let subj: Target | null = null;
      for (let k = i + 1; k < to && !subj; k++) if (!ws[k].pause) subj = c.linkOf(ws[k].w);
      const id = subj?.startsWith("obj:") ? subj.slice(4) : null, p = id ? c.prop(id) : null;
      if (p && !negated && !p.shown) add("var_yok", `"gibt": ${subj} is hidden here; show it on this line or before`, { obj: [{ id: id!, op: "show" }] });
      if (p && negated && p.shown) add("var_yok", `"gibt … kein": ${subj} is still shown; hide it (a dashed outline) on this line`, { obj: [{ id: id!, op: "hide" }] });
    }
    // numbers: zwei Brote → n = 2
    const plainIdx = plain.indexOf(t.w, ws.slice(0, i).filter(w => !w.pause).length);
    const num = plainIdx > 0 && readNumber(plain, plainIdx - 1) ? null : readNumber(plain, plainIdx);
    if (num && plainIdx >= 0) {
      const noun = plain[plainIdx + num.len];
      const nt = noun ? c.linkOf(noun) : null;
      const id = nt?.startsWith("obj:") ? nt.slice(4) : null;
      if (id) {
        const ns = [...(st.do === "count" && st.n !== undefined ? [st.n] : []), ...(st.obj ?? []).filter((op: ObjOp) => op.id === id && op.n !== undefined).map(op => op.n!)];
        const assert = plain.includes("gibt") || plain.slice(plainIdx + num.len).some(w => ADVERB.test(w));
        const have = c.prop(id)?.n;
        if (ns.length && !ns.includes(num.n)) add("number", `"${plain.slice(plainIdx, plainIdx + num.len + 1).join(" ")}" says ${num.n}, but the line's n is ${ns.join(", ")}`, st.do === "count" ? { do: "count", n: num.n } : undefined);
        else if (!ns.length && assert && have !== undefined && have !== num.n && num.n !== 1) add("number", `"${num.n} ${noun}", but ${nt} shows ${have}`, { obj: [{ id, op: "set", set: { n: num.n } }] });
      }
    }
  });

  // ---- clock times
  const times = readClock(c.text);
  if (times.length) {
    const clocks = Object.values(st.link ?? {}).filter((t): t is string => t.startsWith("obj:")).map(t => t.slice(4)).filter(id => { const p = c.prop(id); return p && (p.params.time !== undefined || /clock|watch|saat|uhr/.test(p.kit)); });
    for (const id of clocks) {
      const shown = c.prop(id)!.params.time;
      const m = typeof shown === "string" ? clockMinutes(shown) : null;
      if (!times.some(t => clockMinutes(t) === m)) {
        const said = `${times[0].h}:${String(times[0].m).padStart(2, "0")}`;
        add("time", `the line says ${said}, but obj:${id} shows ${shown ?? "no time"}`, { obj: [{ id, op: "set", set: { time: said } }] });
      }
    }
  }
}

/** Parenthetical words that stage a line, in German (an editor's `(winkt, froh)`). */
const PARENTHETICAL: Record<string, Partial<Staging>> = {
  winkt: { do: "wave" }, zeigt: { do: "point" }, nickt: { do: "nod" }, "zuckt mit den schultern": { do: "shrug" }, schultern: { do: "shrug" },
  lächelt: { emo: "happy" }, lacht: { emo: "laugh" }, froh: { emo: "happy" }, glücklich: { emo: "happy" }, traurig: { emo: "sad" }, überrascht: { emo: "surprised" },
  flüstert: { voice: "whisper" },
};

export const deLang: StoryLang = {
  id: "de",
  lower: lowerDe,
  words,
  match,
  fold: ascii,
  pointing: w => { const d = deixis(w); return d === "dies" || d === "jen"; },
  namesPlace: w => /^(hier|dort|drinnen|draußen|draussen)$/.test(w),
  motive: MOTIVE,
  number: readNumber,
  lintLine,
  checkWords,
  resolver,
  parenthetical: PARENTHETICAL,
};
