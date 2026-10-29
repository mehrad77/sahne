// Turkish as a story language (src/lang.ts), on sahne-tr: its words and pauses, noun endings (`match`), the words that
// motivate each gesture, numbers said aloud, the check's dictionary forms (tr-words.ts), and the Turkish lints:
//
//   deixis    bu/şu/o + a linked noun needs a deixis gesture at that thing, and they agree: bu is near, o is far
//   var_yok   "X var" / "X yok" about a linked prop needs it shown / hidden by then
//   number    a number before a linked prop matches the `n` of the count or of the prop change
//   time      a clock time said aloud matches the linked clock
//
// and Kumru's series hints, which live here until a series can name its own: the hometown the host personalises
// ("Tahran"), the stand-in never naming a country or a language, and Kırlangıç glossed.

import type { ObjOp, Staging, Target } from "sahne";
import { clockMinutes, deixis, lowerTr, match, readClock, readNumber, tokens } from "sahne-tr";
import type { LineContext, LineWord, StoryLang } from "../lang.ts";
import { resolver, words as checkWords } from "./tr-words.ts";

/** Within reach for *bu* (metres, on the floor plan); beyond `FAR` it is *o*. */
export const NEAR = 1.5, FAR = 3;
export const DEIXIS_GESTURES = new Set(["point", "point_far", "hold_up", "touch"]);
/** Which deixis gestures each demonstrative takes. `point` for *bu* and *o* only by distance. */
const AGREE: Record<"bu" | "şu" | "o", string[]> = { bu: ["hold_up", "touch", "point"], şu: ["point"], o: ["point_far", "point"] };
const ADVICE: Record<"bu" | "şu" | "o", string> = { bu: "hold_up", şu: "point", o: "point_far" };

/** Words that motivate a gesture (prefixes of the lower-case word). Gestures not listed need none. */
const MOTIVE: Record<string, string[]> = {
  count: [], // a number
  give: ["buyr", "al", "ver", "işte"],
  take: ["al", "teşekkür", "sağ ol", "sağol"],
  welcome: ["hoş", "buyr", "gel"],
  wave: ["merhaba", "selam", "hoşça", "güle", "görüşür", "bay", "günaydın", "iyi akşam", "iyi gece"],
  nod: ["evet", "tamam", "tabii", "olur", "peki", "doğru", "elbette", "anladım", "aynen"],
  shake_head: ["hayır", "yok", "değil", "olmaz"],
  cik: ["yok", "hayır", "cık", "değil"],
  shrug: ["yok", "bilmiyor", "bilmem", "belki", "maalesef", "ama", "ne bileyim"],
  hand_heart: ["teşekkür", "sağ", "lütfen", "rica", "memnun", "allah"],
  me: ["ben", "bana", "beni"],
  you: ["sen", "siz", "sana", "size", "seni", "sizi"],
  beckon: ["gel", "buraya"],
  stop: ["dur", "bekle", "hayır", "yeter"],
  thumb_up: ["süper", "harika", "güzel", "tamam", "aferin", "bravo", "çok iyi", "oldu"],
  shush: ["şş", "sus", "sessiz"],
  bow_head: ["özür", "pardon", "kusura", "affedersiniz"],
  phone: ["alo", "telefon"],
};

const ascii = (s: string) => lowerTr(s).replace(/ı/g, "i").replace(/ş/g, "s").replace(/ç/g, "c").replace(/ğ/g, "g").replace(/ö/g, "o").replace(/ü/g, "u");
const words = (text: string): LineWord[] => tokens(text).map(t => (t.kind === "word" ? { w: lowerTr(t.text).replace(/[’']/g, "'"), i: t.i } : { w: t.mark === "comma" ? "," : ".", i: t.i, pause: true, q: t.text === "?" }));

/** The learner's hometown in the stories' text, replaced by the host (s1e01: "Tahran"). */
const HOMETOWN = "Tahran";

/** The Turkish lints of a line: deixis, var/yok, numbers, clock times. */
function lintLine(c: LineContext) {
  const { st, words: ws, plain, add } = c;
  ws.forEach((t, i) => {
    if (t.pause) return;
    // "Bu da bavul": the clitic da/de between the demonstrative and its noun is skipped
    const next = ws[i + 1];
    const noun = next && !next.pause && /^d[ae]$/.test(next.w) && ws[i + 2] && !ws[i + 2].pause ? ws[i + 2] : next;
    // deixis: bu/şu/o + a linked noun
    // burası / şurası / orası (and burada …) name the place itself: "Burası metro." is the scene, not a gesture at a prop
    const d = /^(bura|şura|ora)/.test(t.w) ? null : deixis(t.w);
    const tgt = noun && !noun.pause ? c.linkOf(noun.w) : null;
    if (d && tgt) {
      const phrase = `${t.w} ${noun !== next ? next.w + " " : ""}${noun!.w}`;
      if (!st.do || !DEIXIS_GESTURES.has(st.do) || st.at !== tgt) {
        add("deixis", `"${phrase}" needs a deixis gesture at ${tgt} (${ADVICE[d]})`, { do: ADVICE[d], at: tgt });
      } else {
        const held = c.holds(tgt), far = c.distance(tgt);
        if (!AGREE[d].includes(st.do)) add("deixis", `"${phrase}" with ${st.do}: ${d} takes ${AGREE[d].filter(g => g !== "point" || d === "şu").join(" or ")}`, { do: ADVICE[d], at: tgt });
        else if (held && d !== "bu") add("deixis", `"${phrase}": ${c.who} holds it, so it is bu`, undefined, "warning");
        else if (d === "bu" && st.do === "point" && far !== null && far > NEAR) add("deixis", `"${phrase}": bu is near, but ${tgt} is ${far.toFixed(1)} m away (şu or o, or hold it up)`);
        else if (d === "o" && st.do === "point" && far !== null && far < FAR) add("deixis", `"${phrase}": o is far, but ${tgt} is ${far.toFixed(1)} m away (bu or şu)`, { do: "point", at: tgt }, "warning");
        else if (d === "bu" && far !== null && far > NEAR) add("deixis", `"${phrase}": bu is near, but ${tgt} is ${far.toFixed(1)} m away`, undefined, "warning");
        else if (d === "o" && far !== null && far <= NEAR) add("deixis", `"${phrase}": o is far, but ${tgt} is within reach (${far.toFixed(1)} m)`, undefined, "warning");
      }
    }
    // var / yok: the assertion, not the question
    if (t.w === "var" || t.w === "yok") {
      if (next && !next.pause && /^m[ıiuü]/.test(next.w)) return;
      if (next && next.pause && next.q) return;
      let subj: Target | null = null;
      for (let k = i - 1; k >= 0 && !(ws[k].pause && ws[k].w === "."); k--) {
        const w = ws[k];
        if (!w.pause && (subj = c.linkOf(w.w))) break;
      }
      const id = subj?.startsWith("obj:") ? subj.slice(4) : null, p = id ? c.prop(id) : null;
      if (p && t.w === "var" && !p.shown) add("var_yok", `"${t.w}": ${subj} is hidden here; show it on this line or before`, { obj: [{ id: id!, op: "show" }] });
      if (p && t.w === "yok" && p.shown) add("var_yok", `"${t.w}": ${subj} is still shown; hide it (a dashed outline) on this line`, { obj: [{ id: id!, op: "hide" }] });
    }
    // numbers: iki ekmek → n = 2
    const plainIdx = plain.indexOf(t.w, ws.slice(0, i).filter(w => !w.pause).length);
    const num = plainIdx > 0 && readNumber(plain, plainIdx - 1) ? null : readNumber(plain, plainIdx);
    if (num && plainIdx >= 0) {
      const noun = plain[plainIdx + num.len];
      const nt = noun ? c.linkOf(noun) : null;
      const id = nt?.startsWith("obj:") ? nt.slice(4) : null;
      if (id) {
        const ns = [...(st.do === "count" && st.n !== undefined ? [st.n] : []), ...(st.obj ?? []).filter((op: ObjOp) => op.id === id && op.n !== undefined).map(op => op.n!)];
        const assert = plain.slice(plainIdx + num.len).includes("var");
        const have = c.prop(id)?.n;
        if (ns.length && !ns.includes(num.n)) add("number", `"${plain.slice(plainIdx, plainIdx + num.len + 1).join(" ")}" says ${num.n}, but the line's n is ${ns.join(", ")}`, st.do === "count" ? { do: "count", n: num.n } : undefined);
        else if (!ns.length && assert && have !== undefined && have !== num.n && num.n !== 1) add("number", `"${num.n} ${noun} var", but ${nt} shows ${have}`, { obj: [{ id, op: "set", set: { n: num.n } }] });
      }
    }
  });

  // ---- clock times
  const times = readClock(c.text);
  if (times.length) {
    const clocks = Object.values(st.link ?? {}).filter((t): t is string => t.startsWith("obj:")).map(t => t.slice(4)).filter(id => { const p = c.prop(id); return p && (p.params.time !== undefined || /clock|watch|saat/.test(p.kit)); });
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

/** Parenthetical words that stage a line, in Turkish and English (an editor's `(el sallar, mutlu)`). */
const PARENTHETICAL: Record<string, Partial<Staging>> = {
  "el sallar": { do: "wave" }, "gösterir": { do: "point" }, "başını sallar": { do: "nod" }, "omuz silker": { do: "shrug" },
  "gülümser": { emo: "happy" }, "güler": { emo: "laugh" }, "mutlu": { emo: "happy" }, "üzgün": { emo: "sad" }, "şaşkın": { emo: "surprised" },
  "fısıldar": { voice: "whisper" },
};

export const trLang: StoryLang = {
  id: "tr",
  lower: lowerTr,
  words,
  match,
  fold: ascii,
  pointing: w => !!deixis(w),
  namesPlace: w => /^(burası|şurası|orası)$/.test(w),
  motive: MOTIVE,
  number: readNumber,
  lintLine,
  checkWords,
  resolver,
  names: [HOMETOWN, `${HOMETOWN}lı`],
  hints: (t, gl) => [
    ...(t.standin && /İran|Farsça|[؀-ۿ]/.test(t.text) ? [`a stand-in line names a country or language: “${t.text}”`] : []),
    ...(/Kırlangıç/.test(t.text) && !gl["kırlangıç"] ? ["Kırlangıç is used but not glossed in gl"] : []),
  ],
  parenthetical: PARENTHETICAL,
};
