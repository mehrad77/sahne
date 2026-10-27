// Voices (DESIGN.md §8.4). A provider speaks a line and reports when it starts, each word it
// reaches and when it ends; the stage's clock follows those reports (audio/clock.ts). Now: the
// browser's own speech, with each character's rate and pitch. Later: neural voices generated at
// build time, which will report exact marks; a character's `neural` field is their id.

/** A character's voice (the story cast's `voice` field). */
export interface VoiceSpec {
  /** 1 is the A1 pace; İsmail is quicker, Maria Teyze slower. */
  rate?: number;
  /** 0 … 2, 1 is the voice's own. */
  pitch?: number;
  /** The neural voice id, once neural voices exist. */
  neural?: string;
}

export interface SpeakOptions {
  /** BCP 47, from the language plugin ("tr"). */
  lang: string;
  /** Who speaks (the script's actor id): a provider of recorded lines finds its clip by it. */
  who?: string;
  spec?: VoiceSpec;
  /** The cue's tempo (İsmail, quickly: 1.4). */
  rate?: number;
  whisper?: boolean;
  /** 0 … 1, the voice bus's volume, for a provider that plays outside Web Audio (the browser's speech). */
  volume?: number;
  /**
   * The voice bus's input (`AudioEngine.voiceOut`), for a provider that plays recordings through Web
   * Audio; its gain is already the voice volume. Null while there is no audio context.
   */
  out?: AudioNode | null;
  onStart?(): void;
  /** The voice reached the word starting at this character of the text. */
  onWord?(charIndex: number): void;
  /** Finished, failed or cancelled. Called once. */
  onEnd?(): void;
}

export interface Speaking { cancel(): void }

export interface VoiceProvider {
  readonly id: string;
  /** Whether a voice for this language exists here (the browser may have none). */
  available(lang: string): boolean;
  /**
   * Speak a line. `null`: this line is not voiced here (no clip, no fallback voice), so the stage
   * keeps its own timing for it, as it does with no voice at all; no callback is called then.
   */
  speak(text: string, o: SpeakOptions): Speaking | null;
  /** Stop everything. */
  cancel(): void;
}

export interface BrowserVoiceOptions {
  /** The browser rate for the A1 pace (default 0.85: a little slower than its natural speech). */
  base?: number;
  /** Voice names to prefer, in order (a voice the owner likes on a given system). */
  prefer?: string[];
}

/** The browser's speech synthesis (`speechSynthesis`). Word marks come where the browser gives them. */
export function browserVoice(o: BrowserVoiceOptions = {}): VoiceProvider {
  const synth = typeof speechSynthesis !== "undefined" ? speechSynthesis : null;
  let voices: SpeechSynthesisVoice[] = synth?.getVoices() ?? [];
  synth?.addEventListener?.("voiceschanged", () => { voices = synth.getVoices(); });
  const pick = (lang: string) => {
    const all = voices.length ? voices : (voices = synth?.getVoices() ?? []);
    const mine = all.filter(v => v.lang.toLowerCase().replace("_", "-").startsWith(lang.toLowerCase()));
    for (const name of o.prefer ?? []) { const v = mine.find(x => x.name === name); if (v) return v; }
    return mine.find(v => v.localService) ?? mine[0] ?? null;
  };
  let current: SpeechSynthesisUtterance | null = null;
  const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

  return {
    id: "browser",
    available: lang => !!synth && !!pick(lang),
    speak(text, so) {
      let done = false;
      const end = () => { if (!done) { done = true; so.onEnd?.(); } };
      const voice = synth ? pick(so.lang) : null;
      // a leading ellipsis (…Buyrun.) is a pause the voice would read out as nothing or "dot dot dot"
      const said = text.replace(/^[\s.…]+/, "");
      if (!synth || !voice || !said) { queueMicrotask(end); return { cancel: end }; }
      const offset = text.length - said.length;
      const u = new SpeechSynthesisUtterance(said);
      u.voice = voice; u.lang = voice.lang;
      u.rate = clamp((o.base ?? 0.85) * (so.spec?.rate ?? 1) * (so.rate ?? 1), 0.5, 1.8);
      u.pitch = clamp(so.spec?.pitch ?? 1, 0, 2);
      u.volume = clamp((so.volume ?? 1) * (so.whisper ? 0.45 : 1), 0, 1);
      u.onstart = () => { if (!done) so.onStart?.(); };
      u.onboundary = e => { if (!done && e.name === "word") so.onWord?.(e.charIndex + offset); };
      u.onend = end;
      u.onerror = end;
      if (current) synth.cancel();
      current = u;
      synth.speak(u);
      return { cancel: () => { if (done) return; end(); if (current === u) { current = null; synth.cancel(); } } };
    },
    cancel() { current = null; synth?.cancel(); },
  };
}
