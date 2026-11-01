// The story player's logic, without a screen: which cue plays next, what the footer offers (Devam, the reply
// card, an act, the end), and how a pick re-plans the script from that cue on. The gallery's Stories view and Kumru's reader
// both draw on it, so the two cannot drift. Pure over a stage-like object; Node-tested with a fake stage (test/player.test.ts).
//
// Cue 0 is the opening scene, shown at load. `next` is the cue a footer action plays. A say turn plays its cue when the learner
// says the line; a choice re-plans from its cue (`perform(picks)`) and plays it; an act plays on stage, and its answer re-plans
// only what follows (the act cue already holds the question).
//
// Auto: the player runs on by itself, each cue after the one before ends and a short hold for reading (`hold`). A watch-only
// story (src/play.ts) starts in it, so the viewer only watches; any story can be put in it (an editor's Play), and it still
// stops at a card.
import type { Picks, StoryStage, Turn } from "./adapt.ts";
import type { CueInfo } from "./adapt.ts";

/** What the player needs of a Sahne stage (`Stage` is one). */
export interface PlayerStage {
  load(script: ReturnType<StoryStage["perform"]>["script"], o: object): unknown;
  show(cue: number): void;
  play(cue: number): PlayerRun;
  setCues(from: number, cues: ReturnType<StoryStage["perform"]>["script"]["cues"]): void;
  now(): number;
}
export interface PlayerRun { readonly dur: number; readonly done: Promise<void>; finish(): void; readonly result?: Promise<{ target?: string }> }

export interface PlayerHooks {
  /** A cue starts: the host writes it into the log. */
  onCue?(info: CueInfo, cue: number): void;
  /** Something the footer shows changed (a run ended, a pick was made). */
  onChange?(): void;
  /** The load options the host adds to the adapter's (the narrator's window, the coo). */
  loadOptions?: object;
  /** Run on by itself from the start (default: when the story is watch-only). */
  auto?: boolean;
  /** How long to hold after a cue ends before the next, in ms, when running on by itself (default `holdFor`). */
  hold?(info: CueInfo, dur: number): number;
}

/** The default hold after a cue: time to read what it said, beyond what it took to say (a spot's card takes none), else a beat. */
export function holdFor(info: CueInfo, dur: number): number {
  const said = info.tr ?? "";
  if (!said) return 400;
  return Math.min(5000, Math.max(500, 500 + said.length * 50 - dur));
}

/** What the footer offers now. */
export type Footer =
  | { kind: "busy" }                                   // a cue is playing: Devam finishes it
  | { kind: "devam"; cue: number }                     // nothing to answer: Devam plays the next cue
  | { kind: "turn"; cue: number; turn: Turn }          // the learner's card: say, choose, or start an act
  | { kind: "end" };                                   // the story is over

export interface StoryPlayer {
  readonly picks: Picks;
  readonly info: readonly CueInfo[];
  readonly next: number;
  /** The cue playing or last played (null after a restart): an act's run carries its `result`, for the host's act card. */
  readonly run: PlayerRun | null;
  footer(): Footer;
  /** Devam: finish the cue that is playing, or play the next one. */
  devam(): void;
  /** Say the line of a say turn (the reply card's Söyle, or the microphone). */
  say(): void;
  /** Pick option `index` of the choice at `cue`. */
  choose(index: number): void;
  /** Start the act at `cue` on stage; resolves with the target picked. */
  act(): Promise<string | undefined>;
  /** Back to the opening scene, picks reset. */
  restart(): void;
  /** Go to cue `i` with the picks so far (an editor's scrubber): cue 0 shows the opening scene; a cue with a card waits
   * for its card (the footer offers it), any other cue plays from the world after the cue before it. */
  jump(i: number): void;
  /** Swap in a new adaptation of the same story (an editor changed its text or staging), keeping the picks and the
   * art already loaded: the cues are re-directed, not reloaded. Call `jump` after to see the change on stage. */
  replace(adapted: StoryStage): void;
  /** Call on a timer: the footer follows the performance where animation frames are paused (a hidden tab). */
  tick(): void;
  /** Whether the player runs on by itself (see the top of this file). */
  readonly auto: boolean;
  /** Run on by itself from here, or stop after the cue that is playing. */
  setAuto(on: boolean): void;
}

export function storyPlayer(stage: PlayerStage, story: StoryStage, hooks: PlayerHooks = {}): StoryPlayer {
  let adapted = story;
  let picks: Picks = { ...adapted.defaults }, info: CueInfo[] = [], next = 1, run: PlayerRun | null = null, last = "";
  let auto = hooks.auto ?? adapted.play === "watch", timer: ReturnType<typeof setTimeout> | undefined, held: PlayerRun | null = null;
  const hold = hooks.hold ?? holdFor;
  const halt = () => { clearTimeout(timer); timer = undefined; };
  /** Running on by itself: play the next cue after `wait` ms, unless it waits for a card or the story is over. */
  const onward = (wait: number) => {
    halt();
    if (!auto) return;
    timer = setTimeout(() => { timer = undefined; if (auto && !playing() && next < info.length && !turnAt(next)) playCue(next); }, wait);
  };
  const changed = () => hooks.onChange?.();
  const playing = () => !!run && stage.now() < run.dur;

  function load() {
    picks = { ...adapted.defaults };
    const perf = adapted.perform(picks);
    info = perf.info;
    stage.load(perf.script, { ...adapted.load, ...(hooks.loadOptions ?? {}) });
    stage.show(0);
    run = null; next = 1;
  }
  function playCue(i: number) {
    if (i >= info.length) return;
    hooks.onCue?.(info[i], i);
    const r = stage.play(i);
    run = r; next = i + 1;
    void r.done.then(() => { if (run === r) { changed(); after(r, i); } });
    changed();
  }
  /** A run ended (its `done`, or the timer's `tick` where frames are paused): hold, then on, once per run. */
  const after = (r: PlayerRun, i: number) => { if (held === r) return; held = r; onward(hold(info[i], r.dur)); };
  const replan = (from: number) => {
    const perf = adapted.perform(picks);
    info = perf.info;
    stage.setCues(from, perf.script.cues.slice(from));
  };
  const turnAt = (i: number): Turn | undefined => info[i]?.turn;

  const player: StoryPlayer = {
    get picks() { return picks; },
    get info() { return info; },
    get next() { return next; },
    get run() { return run; },
    footer() {
      if (playing()) return { kind: "busy" };
      if (next >= info.length) return { kind: "end" };
      const t = turnAt(next);
      return t ? { kind: "turn", cue: next, turn: t } : { kind: "devam", cue: next };
    },
    devam() {
      if (playing()) { run!.finish(); changed(); return; }
      if (next < info.length && !turnAt(next)) playCue(next);
    },
    say() {
      const t = turnAt(next);
      if (t?.kind === "say") playCue(next);
    },
    choose(index) {
      const t = turnAt(next);
      if (t?.kind !== "choice") return;
      const i = next;
      picks = { ...picks, [t.id]: index };
      replan(i);
      playCue(i);
    },
    async act() {
      const t = turnAt(next);
      if (t?.kind !== "act") return undefined;
      const i = next;
      hooks.onCue?.({ ...info[i], kind: "say", tr: t.prompt?.tr ?? "…" }, i);
      const r = stage.play(i);
      run = r; next = i + 1;
      void r.done.then(() => { if (run === r) { changed(); after(r, i); } });
      changed();
      const res = r.result ? await r.result : {};
      const target = res.target ?? t.act.targets[0];
      picks = { ...picks, [t.id]: target };
      replan(i + 1);
      changed();
      return target;
    },
    get auto() { return auto; },
    setAuto(on) { auto = on; if (on && !playing()) onward(0); else if (!on) halt(); },
    restart() { halt(); load(); changed(); onward(hold(info[0], 0)); },
    jump(i) {
      i = Math.max(0, Math.min(i | 0, info.length - 1));
      halt();
      run = null;
      if (i === 0) { stage.show(0); next = 1; changed(); onward(hold(info[0], 0)); return; }
      stage.show(i - 1);
      next = i;
      if (turnAt(i)) changed(); else playCue(i);
    },
    replace(a) {
      adapted = a;
      picks = { ...a.defaults, ...picks };
      replan(0);
      if (next > info.length) next = info.length;
      changed();
    },
    tick() {
      const key = (playing() ? "p" : "s") + next;
      if (key !== last) { last = key; changed(); }
      if (auto && run && !playing()) after(run, next - 1);
    },
  };
  load();
  // a story that runs on by itself starts after a moment on its opening scene
  onward(hold(info[0], 0));
  return player;
}
