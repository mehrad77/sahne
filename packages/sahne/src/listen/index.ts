// Say it aloud (DESIGN.md §9): the reply card listens through the browser's speech recognition,
// and the language plugin decides whether what it heard is the line. An optional module, imported
// as "sahne/listen" and never from the engine's index, so an app that never listens does not ship it.
//
// The recogniser is the Web Speech API (SpeechRecognition, webkitSpeechRecognition in Chrome and
// Safari). Chrome sends the audio to a server, so listening is hidden offline; it needs a secure
// context and the microphone permission. Nothing here fails: every outcome resolves, with `error`
// saying why nothing was heard, and the card keeps its tap.

import type { LangPlugin, LineMatch, MatchLineOptions } from "../core/lang.ts";

/** Why listening ended without a transcript. `denied` also hides the microphone for the rest of the page's life. */
export type ListenError = "unsupported" | "offline" | "insecure" | "denied" | "no-speech" | "timeout" | "aborted" | "network" | "error";

/** listening: the microphone is open; hearing: speech has started (interim text arrives); done: the result is in. */
export type ListenState = "starting" | "listening" | "hearing" | "done";

/** The parts of the Web Speech API this module uses (lib.dom has no types for it). */
export interface Recognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  onstart: (() => void) | null;
  onspeechstart: (() => void) | null;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string; confidence?: number }> & { isFinal: boolean }>;
}
export type RecognitionCtor = new () => Recognition;

/** Where the recogniser comes from; tests pass their own. Default: the page (`globalThis`). */
export interface ListenEnv {
  Recognition?: RecognitionCtor | null;
  online?: boolean;
  secure?: boolean;
}

export interface ListenOptions {
  /** BCP 47 with a region ("tr-TR"); default: the plugin's `locale`, else "tr-TR". */
  lang?: string;
  /** Interim transcripts while the learner speaks (default true): `onInterim`, and an early stop when one already matches. */
  interim?: boolean;
  /** n-best alternatives asked of the recogniser (default 5). */
  alternatives?: number;
  /** Give up this long after starting when nobody has spoken (ms, default 6000). */
  silence?: number;
  /** Stop listening this long after starting, whatever is happening (ms, default 12000). */
  timeout?: number;
  onState?(s: ListenState): void;
  onInterim?(text: string): void;
  signal?: AbortSignal;
  env?: ListenEnv;
}

export interface ListenResult {
  /** Alternatives of the final transcript, best first (empty when nothing was heard). */
  alternatives: string[];
  error?: ListenError;
}

export interface Listening {
  result: Promise<ListenResult>;
  /** Finish now with what has been heard so far. */
  stop(): void;
  /** Throw it away (the learner tapped Söyle instead). */
  abort(): void;
}

/** The recognisers whose microphone was refused: the browser's own, or one a test or a demo passes in (`env`), each for itself. */
const denied = new Set<RecognitionCtor>();

function envOf(env?: ListenEnv): Required<ListenEnv> {
  const g = globalThis as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor; isSecureContext?: boolean; navigator?: { onLine?: boolean } };
  return {
    Recognition: env && "Recognition" in env ? env.Recognition ?? null : g.SpeechRecognition ?? g.webkitSpeechRecognition ?? null,
    online: env?.online ?? g.navigator?.onLine !== false,
    secure: env?.secure ?? g.isSecureContext !== false,
  };
}

/** Why listening is not possible here, or null when it is. */
export function cannotListen(env?: ListenEnv): ListenError | null {
  const e = envOf(env);
  if (!e.Recognition) return "unsupported";
  if (!e.secure) return "insecure";
  if (!e.online) return "offline";
  if (denied.has(e.Recognition)) return "denied";
  return null;
}

/** Whether the card may show its microphone: a recogniser, a secure context, online, and no refusal of the microphone yet. */
export const canListen = (env?: ListenEnv): boolean => cannotListen(env) === null;

/** Forget a refusal (the learner allowed the microphone in the browser's settings). */
export function resetListen() { denied.clear(); }

const ERRORS: Record<string, ListenError> = {
  "not-allowed": "denied", "service-not-allowed": "denied", "audio-capture": "denied",
  "no-speech": "no-speech", aborted: "aborted", network: "network", "language-not-supported": "unsupported",
};

/** Listen once: the recogniser's alternatives for one utterance. */
export function listen(o: ListenOptions = {}): Listening {
  const why = cannotListen(o.env);
  if (why) return { result: Promise.resolve({ alternatives: [], error: why }), stop() {}, abort() {} };
  const R = envOf(o.env).Recognition!;
  const rec = new R();
  rec.lang = o.lang ?? "tr-TR";
  rec.interimResults = o.interim !== false;
  rec.maxAlternatives = o.alternatives ?? 5;
  rec.continuous = false;

  let finals: string[] = [], interim = "", error: ListenError | undefined, spoke = false, settled = false;
  let resolve!: (r: ListenResult) => void;
  const result = new Promise<ListenResult>(r => { resolve = r; });
  const timers: ReturnType<typeof setTimeout>[] = [];
  const state = (s: ListenState) => { try { o.onState?.(s); } catch { /* the card's problem */ } };

  const finish = () => {
    if (settled) return;
    settled = true;
    for (const t of timers) clearTimeout(t);
    o.signal?.removeEventListener("abort", onAbort);
    const alternatives = finals.length ? finals : interim ? [interim] : [];
    state("done");
    resolve(alternatives.length ? { alternatives } : { alternatives, error: error ?? (spoke ? "error" : "no-speech") });
  };
  const onAbort = () => { error = "aborted"; finals = []; interim = ""; try { rec.abort(); } catch { /* already ended */ } finish(); };

  rec.onstart = () => state("listening");
  rec.onspeechstart = () => { spoke = true; state("hearing"); };
  rec.onresult = e => {
    let text = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) {
        // n-best alternatives of this final segment, appended to what came before
        const alts = Array.from({ length: r.length }, (_, k) => r[k].transcript.trim()).filter(Boolean);
        finals = finals.length ? finals.flatMap(f => alts.map(a => `${f} ${a}`)).slice(0, rec.maxAlternatives) : alts;
      } else text += r[0]?.transcript ?? "";
    }
    if (!spoke && (text || finals.length)) { spoke = true; state("hearing"); }
    interim = (finals[0] ? `${finals[0]} ` : "") + text.trim();
    if (text.trim()) try { o.onInterim?.(interim.trim()); } catch { /* the card's problem */ }
  };
  rec.onerror = e => {
    error = ERRORS[e.error] ?? "error";
    if (error === "denied") denied.add(R);
  };
  rec.onend = finish;

  if (o.signal?.aborted) { onAbort(); return { result, stop() {}, abort() {} }; }
  o.signal?.addEventListener("abort", onAbort);
  timers.push(setTimeout(() => { if (!spoke) { error = "no-speech"; try { rec.abort(); } catch { /* ended */ } finish(); } }, o.silence ?? 6000));
  timers.push(setTimeout(() => { error ??= "timeout"; try { rec.stop(); } catch { /* ended */ } setTimeout(finish, 800); }, o.timeout ?? 12000));
  state("starting");
  try { rec.start(); } catch { error = "error"; finish(); }
  return {
    result,
    stop() { try { rec.stop(); } catch { finish(); } },
    abort: onAbort,
  };
}

/** What `listenFor` heard: the match (`best` is the expected line's index, −1 for none), or why nothing was heard. */
export interface HeardLine extends LineMatch { alternatives: string[]; error?: ListenError }

/** A crude matcher for plugins without one: the same words, case and punctuation aside. */
function fallbackMatch(heard: string | string[], expected: string[]): LineMatch {
  const n = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  for (const h of [heard].flat()) {
    const best = expected.findIndex(e => n(e) === n(h));
    if (best >= 0) return { matched: true, best, heard: h, score: 1 };
  }
  return { matched: false, best: -1, heard: [heard].flat()[0] ?? "", score: 0 };
}

/**
 * Listen for one of the `expected` lines (one for a say card, two or three for a choice). The
 * plugin's `matchLine` decides; with interim results on, listening stops as soon as what has been
 * said so far already matches. Resolves; never rejects. Abort with `o.signal`.
 */
export async function listenFor(expected: string[], plugin: LangPlugin, o: ListenOptions & { match?: MatchLineOptions } = {}): Promise<HeardLine> {
  const matchLine = (h: string | string[]) => plugin.matchLine ? plugin.matchLine(h, expected, o.match) : fallbackMatch(h, expected);
  let early: LineMatch | null = null;
  // the recogniser's interim text arrives word by word: stop once it is one of the lines
  const run: Listening = listen({
    ...o, lang: o.lang ?? plugin.locale ?? "tr-TR",
    onInterim: text => {
      o.onInterim?.(text);
      if (early) return;
      const m = matchLine(text);
      if (m.matched && m.score >= 0.999) { early = m; run.stop(); }
    },
  });
  const r = await run.result;
  if (!r.alternatives.length) return { matched: false, best: -1, heard: "", score: 0, alternatives: [], error: r.error };
  const m = matchLine(r.alternatives);
  const best = m.matched || !early ? m : early as LineMatch;
  return { ...best, alternatives: r.alternatives, ...(r.error && !best.matched ? { error: r.error } : {}) };
}

/** The microphone permission, where the browser tells (Chrome, Firefox); "unknown" elsewhere (Safari before 16). */
export async function micPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try {
    const p = await (globalThis as unknown as { navigator: { permissions: { query(d: { name: string }): Promise<{ state: string }> } } }).navigator.permissions.query({ name: "microphone" });
    return p.state === "granted" || p.state === "denied" || p.state === "prompt" ? p.state : "unknown";
  } catch { return "unknown"; }
}
