// sahne-voice: each character's own voice, recorded ahead of time. A developer casts a voice for each character (backstage's
// Voices page: candidate samples, a pick, a tempo), confirms it, and the generator (build/voices.ts) reads every line of every
// story in that voice with a local speech model; an app plays the clips through `clipVoice`, a VoiceProvider for the stage
// (sahne/src/audio/voice.ts). A line with no clip (a story not generated yet) goes to
// the fallback voice, the device's. The formats are below; the README says how to cast and generate.

import type { LangPlugin, Speaking, SpeakOptions, VoiceProvider } from "sahne";

/** The model the clips are made with: a change of model makes every clip stale. */
export const MODEL = "chatterbox-multilingual";

/** What a character should sound like: the casting brief the candidates are picked by. */
export interface VoiceBrief {
  gender: "female" | "male" | "neutral";
  age: "child" | "young" | "adult" | "elder";
  /** The language of their accent (a FLEURS language: "fa", "ru", …); Turkish speakers have none. */
  accent?: string;
  /** A note for the person casting ("talks too fast", "the learner: neither he nor she"). */
  note?: string;
}

/** A character's chosen voice, once picked. Generation reads only confirmed voices. */
export interface VoiceChoice {
  /** The pool sample it is cloned from (`voices/refs/<who>.wav` holds a copy). */
  ref: string;
  /** How much feeling (Chatterbox's exaggeration, 0.25 … 1; 0.5 is neutral). Lines marked surprised or laughing get a little more. */
  exaggeration: number;
  /** How closely the delivery follows the sample (Chatterbox's cfg_weight; lower is slower and calmer). */
  cfg: number;
  /** The clip's tempo after generation (1 as the model said it; 0.85 is 15 % slower, for A1). Pitch stays. */
  tempo: number;
  confirmed: boolean;
}

/** `voices/cast.json` in the content root. */
export interface VoiceCast {
  model: string;
  /**
   * `unvoiced`: a character whose lines are never recorded and stay silent, never the fallback voice: the learner's
   * stand-in, whose lines are the learner's own to say, and whose look and so voice the series cannot know.
   */
  characters: Record<string, { brief: VoiceBrief; voice?: VoiceChoice; unvoiced?: boolean }>;
}

/** One line's clip in a story's manifest. */
export interface Clip {
  /** The file, in the story's clip folder. */
  f: string;
  /** Its length, ms. */
  ms: number;
  /** What it was made from (model, sample, settings, text): a change makes it stale. */
  sig: string;
  /** The speech check doubted it (what the recogniser heard did not match, or it is far too long or short). */
  doubt?: string;
}

/** `voices/clips/<story>/manifest.json`, beside the clips: who → the line as the stage speaks it → its clip. */
export interface Manifest {
  story: string;
  lines: Record<string, Record<string, Clip>>;
  /** Characters whose lines stay silent (the cast's `unvoiced`): no clip, and no fallback either. */
  unvoiced?: string[];
}

/** A short, stable hash (cyrb53) as 14 hex digits: clip file names and signatures, the same in Node and the browser. */
export function hash(s: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0").slice(2) + (h1 >>> 0).toString(16).padStart(8, "0");
}

/** A line's clip file: the same speaker and text are the same file in every story. */
export const clipFile = (who: string, text: string) => `${hash(`${who}\u0000${text}`)}.m4a`;

export interface ClipVoiceOptions {
  /** The story's clip folder as a URL, ending in "/" (Kumru: `/voices/s1e01/`), with its `manifest.json`. */
  base: string;
  /** The stage's language: its timing gives the word marks inside a clip. */
  lang: LangPlugin;
  /** For lines with no clip: the device's voice (`browserVoice()`). Without one, those lines keep the stage's own timing. */
  fallback?: VoiceProvider;
  /**
   * How the app puts the learner's name into a line (Kumru's `personalizeStr`): the stage speaks the personalised line, and a
   * clip is filed under the line as written, so each clip is found under both. The clip itself never says the name.
   */
  personalise?: (text: string) => string;
  fetch?: typeof fetch;
}

export interface ClipVoice extends VoiceProvider {
  /** How many lines have a clip (0: none generated, every line goes to the fallback). */
  readonly count: number;
}

/**
 * A voice that plays a story's recorded clips, loaded before the story starts (the first line must not race the manifest).
 * Never fails: with no manifest it is the fallback alone.
 */
export async function clipVoice(o: ClipVoiceOptions): Promise<ClipVoice> {
  const get = o.fetch ?? fetch;
  let lines: Manifest["lines"] = {}, unvoiced = new Set<string>();
  try {
    const r = await get(`${o.base}manifest.json`);
    if (r.ok) { const m = (await r.json()) as Manifest; lines = m.lines ?? {}; unvoiced = new Set(m.unvoiced ?? []); }
  } catch { /* offline, or no clips for this story */ }
  const bytes = new Map<string, Promise<ArrayBuffer | null>>();
  const decoded = new Map<string, Promise<AudioBuffer | null>>();
  const fetchClip = (f: string) => {
    let p = bytes.get(f);
    if (!p) { p = get(o.base + f).then(r => (r.ok ? r.arrayBuffer() : null), () => null); bytes.set(f, p); }
    return p;
  };
  // fetch them all now, while the story loads: a few kB each
  for (const per of Object.values(lines)) for (const c of Object.values(per)) void fetchClip(c.f);
  const decode = (ctx: BaseAudioContext, f: string) => {
    let p = decoded.get(f);
    if (!p) { p = fetchClip(f).then(b => (b ? ctx.decodeAudioData(b.slice(0)) : null)).catch(() => null); decoded.set(f, p); }
    return p;
  };
  const count = Object.values(lines).reduce((n, per) => n + Object.keys(per).length, 0);
  if (o.personalise) for (const per of Object.values(lines)) for (const [t, c] of Object.entries(per)) { const p = o.personalise(t); if (p !== t && !per[p]) per[p] = c; }
  let current: (() => void) | null = null;

  return {
    id: "clips",
    count,
    available: lang => count > 0 || !!o.fallback?.available(lang),
    speak(text: string, so: SpeakOptions): Speaking | null {
      if (so.who && unvoiced.has(so.who)) return null;
      const clip = so.who ? lines[so.who]?.[text] : undefined;
      const out = so.out;
      if (!clip || !out) return o.fallback?.available(so.lang) ? o.fallback.speak(text, so) : null;
      const ctx = out.context;
      let done = false, src: AudioBufferSourceNode | null = null;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const end = () => {
        if (done) return;
        done = true;
        timers.forEach(clearTimeout);
        try { src?.stop(); } catch { /* never started */ }
        if (current === end) current = null;
        so.onEnd?.();
      };
      current?.();
      o.fallback?.cancel();
      current = end;
      void decode(ctx, clip.f).then(buf => {
        if (done) return;
        if (!buf) { end(); return; }
        src = ctx.createBufferSource();
        src.buffer = buf;
        let to: AudioNode = out;
        if (so.whisper) { const g = ctx.createGain(); g.gain.value = 0.45; g.connect(out); to = g; }
        src.connect(to);
        src.onended = end;
        src.start();
        so.onStart?.();
        // the word marks: the language's own timing of the line, stretched to the clip
        const t = o.lang.speech(text), ms = buf.duration * 1000, k = t.dur ? ms / t.dur : 0;
        for (const w of t.words) timers.push(setTimeout(() => { if (!done) so.onWord?.(w.i); }, w.t0 * k));
      });
      return { cancel: end };
    },
    cancel() { current?.(); o.fallback?.cancel(); },
  };
}
