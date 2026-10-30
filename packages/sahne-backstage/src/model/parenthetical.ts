// A screenplay's parenthetical read as staging, pure: `(waves, happy, to İsmail)` → `{ do: "wave", emo: "happy", to:
// "ismail" }`. Each phrase between commas is tried as: a gesture of the kit (by id, or in English: "waves", "points at
// the apple", "shrugs"), an emotion (by id, or an English word for it: "smiling", "angry"), "to <someone>" (who the line is
// said to), "at <someone or something>" (where it is pointed or looked), "walks to <mark>" (a move), a voice ("whispers")
// or a shot ("close", "wide", "two shot"); the series' language may add its own words (`StoryLang.parenthetical`). What it
// does not understand is handed back, never written. Phrases split at , ; and the Arabic ، ؛; ZWNJ is no matter.

import type { Staging } from "sahne";

export interface Vocab {
  gestures: string[];
  emotions: string[];
  /** Who can be named: id and every name. */
  cast: { id: string; names: string[] }[];
  marks: string[];
  props: { id: string; names: string[] }[];
  /** The language's own words (`StoryLang.parenthetical`). */
  words?: Record<string, Partial<Staging>>;
}

/** English words for the kit's gestures, besides their ids. */
const GESTURE_WORDS: Record<string, string> = {
  waves: "wave", waving: "wave", points: "point", pointing: "point", nods: "nod", nodding: "nod", shrugs: "shrug", shrugging: "shrug",
  "shakes head": "shake_head", "shakes his head": "shake_head", "shakes her head": "shake_head", "bows head": "bow_head", claps: "clap", hugs: "hug",
  thinks: "think", explains: "explain", gives: "give", takes: "take", eats: "eat", drinks: "drink", writes: "write", reads: "read", knocks: "knock",
  beckons: "beckon", cheers: "cheer", sits: "sit", "sits down": "sit", stands: "stand", "stands up": "stand", shivers: "shiver", sleeps: "sleep",
  "thumbs up": "thumb_up", "holds up": "hold_up", touches: "touch", counts: "count", welcomes: "welcome", "hand on heart": "hand_heart",
  "on the phone": "phone", types: "type", knits: "knit", "takes a photo": "photo", shushes: "shush", stops: "stop", looks: "look",
};
/** English words for the kit's emotions. */
const EMOTION_WORDS: Record<string, string> = {
  smiling: "happy", smiles: "happy", glad: "happy", cheerful: "happy", laughing: "laugh", laughs: "laugh", sadly: "sad", upset: "sad", crying: "sad",
  surprise: "surprised", amazed: "surprised", shocked: "surprised", puzzled: "confused", unsure: "confused", sorry: "sorry", apologetic: "sorry",
  angry: "annoyed", cross: "annoyed", irritated: "annoyed", grumpy: "annoyed", shyly: "shy", embarrassed: "shy", sleepy: "tired", worried: "nervous",
  anxious: "nervous", nervously: "nervous", pleased: "proud", touched: "moved", curiously: "curious", wondering: "curious", calm: "neutral",
};
const VOICE_WORDS: Record<string, Staging["voice"]> = { whispers: "whisper", whispering: "whisper", whisper: "whisper", silent: "silent", silently: "silent", mouths: "mouthing", mouthing: "mouthing" };
const CAM_WORDS: Record<string, Staging["cam"]> = { close: "close", "close up": "close", "close-up": "close", wide: "wide", "wide shot": "wide", "two shot": "two", "two-shot": "two", single: "single", follow: "follow" };

const norm = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").replace(/\u200c/g, "").toLocaleLowerCase("en").replace(/ı/g, "i").replace(/\s+/g, " ").trim();
const strip = (s: string) => s.replace(/^(the|a|an|his|her|their)\s+/, "");

export interface Parsed { staging: Partial<Staging>; rest: string[] }

/** `speaker`: who walks when the parenthetical says so. */
export function parseParenthetical(text: string, v: Vocab, speaker = ""): Parsed {
  const staging: Partial<Staging> & Record<string, unknown> = {}, rest: string[] = [];
  const gestures = new Set(v.gestures), emotions = new Set(v.emotions);
  const who = (s: string) => v.cast.find(c => [c.id, ...c.names].some(n => norm(n) === s))?.id;
  const prop = (s: string) => v.props.find(p => [p.id, ...p.names].some(n => norm(n) === s || norm(n.replace(/_/g, " ")) === s))?.id;
  const mark = (s: string) => v.marks.find(m => norm(m) === s || norm(m.replace(/_/g, " ")) === s);
  const target = (s: string) => { const w = who(s); if (w) return `ch:${w}`; const p = prop(s); if (p) return `obj:${p}`; const m = mark(s); if (m) return `mark:${m}`; return s === "camera" || s === "viewer" || s === "us" ? "viewer" : undefined; };
  const own = Object.fromEntries(Object.entries(v.words ?? {}).map(([k, x]) => [norm(k), x]));
  for (const raw of text.replace(/^\(|\)$/g, "").split(/[,;،؛]/)) {
    const ph = norm(raw);
    if (!ph) continue;
    if (own[ph]) { Object.assign(staging, own[ph]); continue; }
    let m: RegExpExecArray | null;
    if ((m = /^(?:to|says to|talking to|tells)\s+(.+)$/.exec(ph)) && who(strip(m[1]))) { staging.to = who(strip(m[1])); continue; }
    if ((m = /^(?:walks|goes|moves|runs|comes)\s+(?:over\s+)?to\s+(.+)$/.exec(ph)) && mark(strip(m[1]))) { staging.move = { who: speaker, to: mark(strip(m[1]))! } as Staging["move"]; continue; }
    if ((m = /^(.+?)\s+at\s+(.+)$/.exec(ph))) {
      const g = GESTURE_WORDS[m[1]] ?? (gestures.has(m[1].replace(/ /g, "_")) ? m[1].replace(/ /g, "_") : undefined), t = target(strip(m[2]));
      if (t && (g || /^(looks?|looking|stares?)$/.test(m[1]))) { if (g && g !== "look") staging.do = g; staging.at = t; continue; }
    }
    if ((m = /^at\s+(.+)$/.exec(ph)) && target(strip(m[1]))) { staging.at = target(strip(m[1])); continue; }
    const id = ph.replace(/ /g, "_");
    if (gestures.has(id)) { staging.do = id; continue; }
    if (GESTURE_WORDS[ph] && gestures.has(GESTURE_WORDS[ph])) { staging.do = GESTURE_WORDS[ph]; continue; }
    if (emotions.has(id)) { staging.emo = id; continue; }
    if (EMOTION_WORDS[ph] && emotions.has(EMOTION_WORDS[ph])) { staging.emo = EMOTION_WORDS[ph]; continue; }
    if (VOICE_WORDS[ph]) { staging.voice = VOICE_WORDS[ph]; continue; }
    if (CAM_WORDS[ph]) { staging.cam = CAM_WORDS[ph]; continue; }
    rest.push(raw.trim());
  }
  return { staging, rest };
}

/** A step's staging as short words for its chips: `wave`, `happy`, `→ İsmail`, `at apple`, `close`. */
export function chipsOf(st: Partial<Staging> & Record<string, unknown>, name: (id: string) => string): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const target = (t: string) => (t.startsWith("ch:") ? name(t.slice(3).split(".")[0]) : t.startsWith("obj:") ? t.slice(4).replace(/_/g, " ") : t.startsWith("mark:") ? t.slice(5) : t);
  if (st.do) out.push({ key: "do", label: String(st.do).replace(/_/g, " ") });
  if (st.emo) out.push({ key: "emo", label: String(st.emo) });
  if (st.to) out.push({ key: "to", label: `→ ${st.to === "viewer" ? "us" : name(String(st.to))}` });
  if (st.at) out.push({ key: "at", label: `at ${target(String(st.at))}` });
  for (const mv of [st.move ?? []].flat() as { who: string; to: string; how?: string }[]) out.push({ key: "move", label: `${mv.how === "enter" ? "enters" : mv.how === "exit" ? "leaves" : "walks"}${mv.to ? ` to ${mv.to}` : ""}${mv.who ? ` (${name(mv.who)})` : ""}` });
  for (const op of (st.obj ?? []) as { id: string; op: string }[]) out.push({ key: "obj", label: `${op.op} ${op.id.replace(/_/g, " ")}` });
  if (st.cam) out.push({ key: "cam", label: `${st.cam} shot` });
  if (st.voice && st.voice !== "normal") out.push({ key: "voice", label: String(st.voice) });
  if (st.sfx) out.push({ key: "sfx", label: `♪ ${[st.sfx].flat().map(x => (typeof x === "string" ? x : (x as { id?: string }).id)).join(", ")}` });
  if (st.react) out.push({ key: "react", label: `reactions: ${Object.keys(st.react as object).map(name).join(", ")}` });
  if (st.link) out.push({ key: "link", label: `links ${Object.keys(st.link as object).length}` });
  if (st.via) out.push({ key: "via", label: `on the ${st.via}` });
  return out;
}
