// Persian as a story language (src/lang.ts), on sahne-fa: its words and pauses, noun endings (`match`), the words that
// motivate each gesture, numbers said aloud, the check's dictionary forms (fa-words.ts), and the Persian lints:
//
//   deixis    این/آن (اون) + a linked noun needs a deixis gesture at that thing, and they agree: این is near, آن is far
//   var_yok   "X هست / داریم" and "X نیست / نداریم" about a linked prop needs it shown / hidden by then
//   number    a number before a linked prop matches the `n` of the count or of the prop change
//   time      a clock time said aloud matches the linked clock
//
// Persian puts the subject before the verb (نان هست), like Turkish: the lint looks back from the verb. Every rule here
// wants a native speaker's check.

import type { ObjOp, Staging, Target } from "sahne";
import { clockMinutes, deixis, isNear, lowerFa, match, readClock, readNumber, tokens } from "sahne-fa";
import type { LineContext, LineWord, StoryLang } from "../lang.ts";
import { resolver, words as checkWords } from "./fa-words.ts";
import { DEIXIS_GESTURES, FAR, NEAR, lintClock } from "./shared.ts";

type Dem = "this" | "these" | "that" | "those";
/** Which deixis gestures each demonstrative takes. `point` for این and آن only by distance. */
const AGREE: Record<Dem, string[]> = { this: ["hold_up", "touch", "point"], these: ["hold_up", "touch", "point"], that: ["point_far", "point"], those: ["point_far", "point"] };
const ADVICE: Record<Dem, string> = { this: "hold_up", these: "hold_up", that: "point_far", those: "point_far" };

/** Words that motivate a gesture (prefixes of the folded word, or a phrase; `"من$"` is the whole word). Gestures not listed need none. */
const MOTIVE: Record<string, string[]> = {
  count: [], // a number
  give: ["بفرما", "بگیر", "بیا$", "اینم", "ایناهاش"],
  take: ["ممنون", "مرسی", "متشکر", "تشکر", "سپاس", "دستت"],
  welcome: ["خوش", "بفرما", "بیایید", "بیاید", "بیا$", "سلام"],
  wave: ["سلام", "خداحافظ", "خدانگهدار", "بدرود", "فعلا", "بخیر", "درود", "دیدار", "بای$", "هی$"],
  nod: ["بله", "آره", "اره", "بلی", "باشه", "حتما", "درست", "قطعا", "البته", "اوکی", "اکی", "فهمیدم", "متوجه", "همینه", "دقیقا"],
  shake_head: ["نه$", "نیست", "نیس", "نخیر", "هرگز", "هیچ", "نمی", "ندار", "نبود", "نشد", "متاسف"],
  cik: ["نه$", "نخیر", "نچ", "نیست", "هرگز", "نمی"],
  shrug: ["نمیدان", "نمیدون", "شاید", "متاسف", "ولی$", "اما$", "چمیدون", "نمیدانم"],
  hand_heart: ["ممنون", "مرسی", "متشکر", "تشکر", "لطفا", "خواهش", "سپاس", "خدا", "خوشحال", "قربان", "عزیز", "دستت"],
  me: ["من$", "منم$", "مرا$", "منو$"],
  you: ["تو$", "شما$", "شمارا$", "تورا$", "توام"],
  beckon: ["بیا$", "بیایید", "بیاید", "بیاین", "اینجا"],
  stop: ["صبر", "بایست", "ایست", "نه$", "کافی", "بس$", "وایسا", "وایستا", "توقف", "لحظه"],
  thumb_up: ["عالی", "خوب", "آفرین", "فوق", "ایول", "قشنگ", "زیبا", "محشر", "باشه", "اوکی", "اکی", "درست", "بسیار"],
  shush: ["هیس", "ساکت", "سکوت", "ششش", "هیش"],
  bow_head: ["ببخشید", "ببخشین", "معذرت", "عذر", "متاسف", "پوزش", "شرمنده"],
  phone: ["الو", "تلفن", "زنگ", "گوشی", "تماس"],
};

const words = (text: string): LineWord[] => tokens(text).map(t => (t.kind === "word" ? { w: lowerFa(t.text), i: t.i } : { w: t.mark === "comma" ? "," : ".", i: t.i, pause: true, q: t.text === "?" || t.text === "؟" }));

/** هست and نیست say a thing is or is not there; داریم and نداریم that we have it or do not (the subject comes before). */
const POS = new Set(["هست", "هستش", "هستن", "هستند", "داریم"]);
const NEG = new Set(["نیست", "نیس", "نیستش", "نیستن", "نیستند", "نداریم"]);
/** Between the thing and the verb a quantifier or adverb may stand: "شیر هیچ‌جا نیست", "نان دیگر نداریم". */
const BETWEEN = new Set(["هیچ", "هیچی", "اصلا", "دیگه", "دیگر", "هم", "خیلی", "کمی", "چند", "هنوز", "الان", "اینجا", "آنجا", "اونجا", "همیشه", "فعلا", "امروز"]);
/** A classifier between a number and its noun: دو تا نان, سه عدد نان, یک بسته نان. */
const CLASSIFIER = new Set(["تا", "عدد", "دانه", "بسته"]);

/** The Persian lints of a line: deixis, هست / نیست, numbers, clock times. */
function lintLine(c: LineContext) {
  const { st, words: ws, plain, add } = c;
  ws.forEach((t, i) => {
    if (t.pause) return;
    // deixis: این/آن + a linked noun, with at most one word (a number) between
    const d = deixis(t.w);
    const cand = d ? [ws[i + 1], ws[i + 2]].filter(w => w && !w.pause) : [];
    const noun = cand.find(w => c.linkOf(w.w)), tgt = noun ? c.linkOf(noun.w) : null;
    if (d && tgt) {
      const phrase = `${t.w} ${noun !== cand[0] ? cand[0].w + " " : ""}${noun!.w}`;
      const near = isNear(d), far = c.distance(tgt), held = c.holds(tgt);
      if (!st.do || !DEIXIS_GESTURES.has(st.do) || st.at !== tgt) {
        add("deixis", `"${phrase}" needs a deixis gesture at ${tgt} (${ADVICE[d]})`, { do: ADVICE[d], at: tgt });
      } else if (!AGREE[d].includes(st.do)) {
        add("deixis", `"${phrase}" with ${st.do}: ${t.w} takes ${AGREE[d].filter(g => g !== "point").join(" or ")}`, { do: ADVICE[d], at: tgt });
      } else if (held && !near) add("deixis", `"${phrase}": ${c.who} holds it, so it is این`, undefined, "warning");
      else if (near && st.do === "point" && far !== null && far > NEAR) add("deixis", `"${phrase}": ${t.w} is near, but ${tgt} is ${far.toFixed(1)} m away (آن, or hold it up)`);
      else if (!near && st.do === "point" && far !== null && far < FAR) add("deixis", `"${phrase}": ${t.w} is far, but ${tgt} is ${far.toFixed(1)} m away (این)`, { do: "point", at: tgt }, "warning");
      else if (near && far !== null && far > NEAR) add("deixis", `"${phrase}": ${t.w} is near, but ${tgt} is ${far.toFixed(1)} m away`, undefined, "warning");
      else if (!near && far !== null && far <= NEAR) add("deixis", `"${phrase}": ${t.w} is far, but ${tgt} is within reach (${far.toFixed(1)} m)`, undefined, "warning");
    }
    // هست / نیست / داریم / نداریم: the assertion, not the question, and the thing stands right before the verb
    const pos = POS.has(t.w), neg = NEG.has(t.w);
    if (pos || neg) {
      let e = i + 1;
      while (e < ws.length && !(ws[e].pause && ws[e].w === ".")) e++;
      if (ws[e]?.q || ws.slice(0, i).some(w => w.w === "آیا" || w.w === "مگه" || w.w === "مگر")) return;
      let subj: Target | null = null;
      for (let k = i - 1; k >= 0 && !ws[k].pause; k--) {
        if (BETWEEN.has(ws[k].w)) continue;
        subj = c.linkOf(ws[k].w);
        break;
      }
      const id = subj?.startsWith("obj:") ? subj.slice(4) : null, p = id ? c.prop(id) : null;
      if (p && pos && !p.shown) add("var_yok", `"${t.w}": ${subj} is hidden here; show it on this line or before`, { obj: [{ id: id!, op: "show" }] });
      if (p && neg && p.shown) add("var_yok", `"${t.w}": ${subj} is still shown; hide it (a dashed outline) on this line`, { obj: [{ id: id!, op: "hide" }] });
    }
    // numbers: دو تا نان → n = 2
    const plainIdx = plain.indexOf(t.w, ws.slice(0, i).filter(w => !w.pause).length);
    const num = plainIdx > 0 && readNumber(plain, plainIdx - 1) ? null : readNumber(plain, plainIdx);
    if (num && plainIdx >= 0) {
      let ni = plainIdx + num.len;
      while (CLASSIFIER.has(plain[ni])) ni++;
      const noun = plain[ni];
      const nt = noun ? c.linkOf(noun) : null;
      const id = nt?.startsWith("obj:") ? nt.slice(4) : null;
      if (id) {
        const ns = [...(st.do === "count" && st.n !== undefined ? [st.n] : []), ...(st.obj ?? []).filter((op: ObjOp) => op.id === id && op.n !== undefined).map(op => op.n!)];
        const assert = plain.slice(ni + 1).some(w => POS.has(w));
        const have = c.prop(id)?.n;
        if (ns.length && !ns.includes(num.n)) add("number", `"${plain.slice(plainIdx, ni + 1).join(" ")}" says ${num.n}, but the line's n is ${ns.join(", ")}`, st.do === "count" ? { do: "count", n: num.n } : undefined);
        else if (!ns.length && assert && have !== undefined && have !== num.n && num.n !== 1) add("number", `"${num.n} ${noun} هست", but ${nt} shows ${have}`, { obj: [{ id, op: "set", set: { n: num.n } }] });
      }
    }
  });
  lintClock(c, readClock, clockMinutes);
}

/** Parenthetical words that stage a line (an editor's `(دست تکان می‌دهد، شاد)`). */
const PARENTHETICAL: Record<string, Partial<Staging>> = {
  "دست تکان می‌دهد": { do: "wave" }, "اشاره می‌کند": { do: "point" }, "سر تکان می‌دهد": { do: "nod" }, "شانه بالا می‌اندازد": { do: "shrug" },
  "لبخند می‌زند": { emo: "happy" }, "می‌خندد": { emo: "laugh" }, "شاد": { emo: "happy" }, "غمگین": { emo: "sad" }, "متعجب": { emo: "surprised" },
  "زمزمه می‌کند": { voice: "whisper" },
};

export const faLang: StoryLang = {
  id: "fa",
  lower: lowerFa,
  words,
  match,
  fold: lowerFa,
  pointing: w => !!deixis(w),
  namesPlace: () => false,
  motive: MOTIVE,
  number: readNumber,
  lintLine,
  checkWords,
  resolver,
  parenthetical: PARENTHETICAL,
};
