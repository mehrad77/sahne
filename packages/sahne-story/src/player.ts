// The story player's logic, without a screen: which cue plays next, what the footer offers (Devam, the reply
// card, an act, the end), and how a pick re-plans the script from that cue on. The gallery's Stories view and Kumru's reader
// both draw on it, so the two cannot drift. Pure over a stage-like object; Node-tested with a fake stage (test/player.test.ts).
//
// Cue 0 is the opening scene, shown at load. `next` is the cue a footer action plays. A say turn plays its cue when the learner
// says the line; a choice re-plans from its cue (`perform(picks)`) and plays it; an act plays on stage, and its answer re-plans
// only what follows (the act cue already holds the question).
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
  /** Call on a timer: the footer follows the performance where animation frames are paused (a hidden tab). */
  tick(): void;
}

export function storyPlayer(stage: PlayerStage, adapted: StoryStage, hooks: PlayerHooks = {}): StoryPlayer {
  let picks: Picks = { ...adapted.defaults }, info: CueInfo[] = [], next = 1, run: PlayerRun | null = null, last = "";
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
    void r.done.then(() => { if (run === r) changed(); });
    changed();
  }
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
      void r.done.then(() => { if (run === r) changed(); });
      changed();
      const res = r.result ? await r.result : {};
      const target = res.target ?? t.act.targets[0];
      picks = { ...picks, [t.id]: target };
      replan(i + 1);
      changed();
      return target;
    },
    restart() { load(); changed(); },
    tick() {
      const key = (playing() ? "p" : "s") + next;
      if (key !== last) { last = key; changed(); }
    },
  };
  load();
  return player;
}
