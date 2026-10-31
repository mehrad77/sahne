// The stage's clock while a voice speaks (DESIGN.md §7, §8.4). A performance is planned on the
// language plugin's estimate of when each word is said; a real voice is faster or slower, and
// starts late. While a line is voiced, the stage's time follows the voice instead: it waits at the
// line's start until the voice starts, moves at the voice's pace, catches up on each word mark
// the voice reports, and waits at the next word (or the line's end) if the voice is behind. So
// mouths, gestures and everything after the line stay on the words. Pure: times in ms.

import type { WordSpan } from "../core/lang.ts";

export class SpeechClock {
  /** Performance time of the line's start. */
  readonly t0: number;
  readonly words: WordSpan[];
  /** The estimate's length of the line. */
  readonly dur: number;
  private started: number | null = null;
  private aReal = 0;
  private aEst = 0;
  private cap: number;
  private speed = 1;
  private lastMark: { k: number; real: number } | null = null;
  ended = false;

  constructor(t0: number, words: WordSpan[], dur: number) {
    this.t0 = t0; this.words = words; this.dur = dur; this.cap = dur;
  }

  /** Ms into the line's estimate at real time `real`. */
  private est(real: number): number {
    if (this.started === null) return 0;
    if (this.ended) return Math.max(this.aEst, this.dur);
    return Math.min(this.aEst + (real - this.aReal) * this.speed, Math.max(this.cap, this.aEst));
  }

  /** The voice started at `real`. */
  start(real: number) {
    if (this.started !== null) return;
    this.started = real; this.aReal = real; this.aEst = 0;
  }

  /** The voice reached the word at `charIndex` of the text at `real`. */
  word(charIndex: number, real: number) {
    if (this.started === null) this.start(real);
    let k = -1;
    for (let i = 0; i < this.words.length; i++) if (this.words[i].i <= charIndex) k = i;
    if (k < 0) return;
    const now = this.est(real), e = this.words[k].t0;
    // the voice's pace over the last stretch, eased in, so the next words need fewer jumps
    if (this.lastMark && k > this.lastMark.k && real > this.lastMark.real) {
      const pace = (e - this.words[this.lastMark.k].t0) / (real - this.lastMark.real);
      this.speed = Math.min(1.6, Math.max(0.6, this.speed * 0.5 + pace * 0.5));
    }
    this.lastMark = { k, real };
    this.aEst = Math.max(now, e); this.aReal = real;
    this.cap = k + 1 < this.words.length ? this.words[k + 1].t0 : this.dur;
  }

  /** The voice finished (or failed) at `real`. */
  end(real: number) {
    if (this.started === null) this.start(real);
    this.aEst = Math.max(this.est(real), this.dur); this.aReal = real;
    this.ended = true;
  }

  get waiting() { return this.started === null; }

  /** Performance time at real time `real`. */
  at(real: number): number { return this.t0 + this.est(real); }
}
