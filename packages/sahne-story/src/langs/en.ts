// English as a story language (src/lang.ts), on sahne-en: its words and pauses, noun and verb forms (`match`), the words
// that motivate each gesture, numbers said aloud, the check's dictionary forms (en-words.ts), and the English lints:
//
//   deixis    this/these/that/those + a linked noun needs a deixis gesture at that thing, and they agree: this is near, that is far
//   var_yok   "There is X" / "There isn't X" about a linked prop needs it shown / hidden by then  (the rule is shared with Turkish var/yok)
//   number    a number before a linked prop matches the `n` of the count or of the prop change
//   time      a clock time said aloud matches the linked clock

import type { ObjOp, Staging, Target } from "sahne";
import { clockMinutes, deixis, isNear, lowerEn, match, readClock, readNumber, tokens } from "sahne-en";
import type { LineContext, LineWord, StoryLang } from "../lang.ts";
import { resolver, words as checkWords } from "./en-words.ts";
import { DEIXIS_GESTURES, FAR, NEAR, lintClock } from "./shared.ts";

type Dem = "this" | "these" | "that" | "those";
/** Which deixis gestures each demonstrative takes. `point` for this and that only by distance. */
const AGREE: Record<Dem, string[]> = { this: ["hold_up", "touch", "point"], these: ["hold_up", "touch", "point"], that: ["point_far", "point"], those: ["point_far", "point"] };
const ADVICE: Record<Dem, string> = { this: "hold_up", these: "hold_up", that: "point_far", those: "point_far" };
/** After these, "that" joins two clauses ("I think that bread is good"): it points at nothing. */
const THAT_JOINS = new Set(["think", "thought", "say", "says", "said", "know", "knew", "hope", "believe", "see", "saw", "mean", "means", "so", "glad", "sure$", "sorry", "hear", "heard", "feel", "felt", "guess", "suppose", "wish", "fact", "now", "such", "is", "was"]);

/** Words that motivate a gesture (prefixes of the lower-case word, or a phrase followed by a space). Gestures not listed need none. */
const MOTIVE: Record<string, string[]> = {
  count: [], // a number
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
  phone: ["hello", "phone", "call$", "ring$", "speaking"],
};

const ascii = (s: string) => lowerEn(s).normalize("NFD").replace(/\p{M}/gu, "");
const words = (text: string): LineWord[] => tokens(text).map(t => (t.kind === "word" ? { w: lowerEn(t.text), i: t.i } : { w: t.mark === "comma" ? "," : ".", i: t.i, pause: true, q: t.text === "?" }));

const BE = new Set(["is", "are", "was", "were"]);
const BE_NOT = new Set(["isn't", "aren't", "wasn't", "weren't"]);

/** The English lints of a line: deixis, there is / isn't, numbers, clock times. */
function lintLine(c: LineContext) {
  const { st, words: ws, plain, add } = c;
  ws.forEach((t, i) => {
    if (t.pause) return;
    const prev = ws[i - 1];
    // deixis: this/these/that/those + a linked noun, with at most one word (an adjective) between
    const d = deixis(t.w);
    const cand = d ? [ws[i + 1], ws[i + 2]].filter(w => w && !w.pause) : [];
    const noun = cand.find(w => c.linkOf(w.w)), tgt = noun ? c.linkOf(noun.w) : null;
    if (d && tgt && !(d === "that" && prev && !prev.pause && THAT_JOINS.has(prev.w))) {
      const phrase = `${t.w} ${noun !== cand[0] ? cand[0].w + " " : ""}${noun!.w}`;
      const near = isNear(d), far = c.distance(tgt), held = c.holds(tgt);
      if (!st.do || !DEIXIS_GESTURES.has(st.do) || st.at !== tgt) {
        add("deixis", `"${phrase}" needs a deixis gesture at ${tgt} (${ADVICE[d]})`, { do: ADVICE[d], at: tgt });
      } else if (!AGREE[d].includes(st.do)) {
        add("deixis", `"${phrase}" with ${st.do}: ${d} takes ${AGREE[d].filter(g => g !== "point").join(" or ")}`, { do: ADVICE[d], at: tgt });
      } else if (held && !near) add("deixis", `"${phrase}": ${c.who} holds it, so it is this`, undefined, "warning");
      else if (near && st.do === "point" && far !== null && far > NEAR) add("deixis", `"${phrase}": ${d} is near, but ${tgt} is ${far.toFixed(1)} m away (that, or hold it up)`);
      else if (!near && st.do === "point" && far !== null && far < FAR) add("deixis", `"${phrase}": ${d} is far, but ${tgt} is ${far.toFixed(1)} m away (this)`, { do: "point", at: tgt }, "warning");
      else if (near && far !== null && far > NEAR) add("deixis", `"${phrase}": ${d} is near, but ${tgt} is ${far.toFixed(1)} m away`, undefined, "warning");
      else if (!near && far !== null && far <= NEAR) add("deixis", `"${phrase}": ${d} is far, but ${tgt} is within reach (${far.toFixed(1)} m)`, undefined, "warning");
    }
    // there is / there isn't: the assertion, not the question ("Is there bread?")
    const next = ws[i + 1];
    const there = t.w === "there's" || (t.w === "there" && next && !next.pause && (BE.has(next.w) || BE_NOT.has(next.w)));
    if (there && !(prev && !prev.pause && BE.has(prev.w))) {
      const verb = t.w === "there" ? next.w : "is";
      let neg = BE_NOT.has(verb), subj: Target | null = null;
      for (let k = i + (t.w === "there" ? 2 : 1); k < ws.length && !(ws[k].pause && ws[k].w === "."); k++) {
        const w = ws[k];
        if (w.pause) continue;
        if (w.w === "no" || w.w === "not" || w.w === "none") neg = true;
        else if ((subj = c.linkOf(w.w))) break;
      }
      const id = subj?.startsWith("obj:") ? subj.slice(4) : null, p = id ? c.prop(id) : null;
      if (p && !neg && !p.shown) add("var_yok", `"there ${neg ? "isn't" : "is"}": ${subj} is hidden here; show it on this line or before`, { obj: [{ id: id!, op: "show" }] });
      if (p && neg && p.shown) add("var_yok", `"there isn't": ${subj} is still shown; hide it (a dashed outline) on this line`, { obj: [{ id: id!, op: "hide" }] });
    }
    // numbers: two loaves → n = 2
    const plainIdx = plain.indexOf(t.w, ws.slice(0, i).filter(w => !w.pause).length);
    const num = plainIdx > 0 && readNumber(plain, plainIdx - 1) ? null : readNumber(plain, plainIdx);
    if (num && plainIdx >= 0) {
      const noun = plain[plainIdx + num.len];
      const nt = noun ? c.linkOf(noun) : null;
      const id = nt?.startsWith("obj:") ? nt.slice(4) : null;
      if (id) {
        const ns = [...(st.do === "count" && st.n !== undefined ? [st.n] : []), ...(st.obj ?? []).filter((op: ObjOp) => op.id === id && op.n !== undefined).map(op => op.n!)];
        const assert = plain.slice(0, plainIdx).some(w => /^(there|there's|have|has|got|i've|we've)$/.test(w));
        const have = c.prop(id)?.n;
        if (ns.length && !ns.includes(num.n)) add("number", `"${plain.slice(plainIdx, plainIdx + num.len + 1).join(" ")}" says ${num.n}, but the line's n is ${ns.join(", ")}`, st.do === "count" ? { do: "count", n: num.n } : undefined);
        else if (!ns.length && assert && have !== undefined && have !== num.n && num.n !== 1) add("number", `"${num.n} ${noun}", but ${nt} shows ${have}`, { obj: [{ id, op: "set", set: { n: num.n } }] });
      }
    }
  });
  lintClock(c, readClock, clockMinutes);
}

/** Parenthetical words that stage a line (an editor's `(waves, happy)`). */
const PARENTHETICAL: Record<string, Partial<Staging>> = {
  waves: { do: "wave" }, points: { do: "point" }, nods: { do: "nod" }, shrugs: { do: "shrug" },
  smiles: { emo: "happy" }, laughs: { emo: "laugh" }, happy: { emo: "happy" }, sad: { emo: "sad" }, surprised: { emo: "surprised" },
  whispers: { voice: "whisper" },
};

export const enLang: StoryLang = {
  id: "en",
  lower: lowerEn,
  words,
  match,
  fold: ascii,
  pointing: w => !!deixis(w),
  namesPlace: () => false,
  motive: MOTIVE,
  number: readNumber,
  lintLine,
  checkWords,
  resolver,
  parenthetical: PARENTHETICAL,
};
