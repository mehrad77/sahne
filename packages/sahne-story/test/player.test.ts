// The story player's logic (src/player.ts) on the bakkal test scene, with a fake stage: every story can be played from the
// footer alone, a choice re-plans from its own cue, and restart goes back to the opening scene.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { PlaceDoc } from "sahne";
import { PLACES } from "../paths.ts";
import { adaptStory, storyPlayer, type CharacterDoc, type PlayerRun, type PlayerStage, type StoryDoc } from "../src/index.ts";

const json = <T>(f: string): T => JSON.parse(readFileSync(new URL(`./fixtures/${f}`, import.meta.url), "utf8"));
const STORY = json<StoryDoc>("bakkal.json");
const places: Record<string, PlaceDoc> = { bakkal: JSON.parse(readFileSync(new URL("bakkal.json", PLACES), "utf8")) };
const characters: Record<string, CharacterDoc> = Object.fromEntries(["ismail", "nima", "kerim"].map((id) => [id, json<CharacterDoc>(`characters/${id}.json`)]));

/** A stage whose every cue ends at once; it records what was played and re-planned. */
function fakeStage() {
  const log: string[] = [];
  const run = (): PlayerRun => ({ dur: 0, done: Promise.resolve(), finish() {}, result: Promise.resolve({}) });
  const stage: PlayerStage = {
    load: () => { log.push("load"); },
    show: (i) => { log.push("show " + i); },
    play: (i) => { log.push("play " + i); return run(); },
    setCues: (i) => { log.push("set " + i); },
    now: () => 0,
  };
  return { stage, log };
}

test("the footer alone plays the story to its end", async () => {
  const { stage, log } = fakeStage();
  const p = storyPlayer(stage, adaptStory(STORY, { places, characters }));
  assert.deepEqual(log.slice(0, 2), ["load", "show 0"]);
  let steps = 0, choices = 0;
  for (let f = p.footer(); f.kind !== "end"; f = p.footer()) {
    if (++steps > 500) assert.fail("the story never ends");
    if (f.kind === "devam") p.devam();
    else if (f.kind === "turn" && f.turn.kind === "say") p.say();
    else if (f.kind === "turn" && f.turn.kind === "choice") { choices++; p.choose(f.turn.options.length - 1); }
    else if (f.kind === "turn" && f.turn.kind === "act") await p.act();
  }
  assert.ok(steps > 3);
  assert.ok(log.some((l) => l.startsWith("set ")) === choices > 0, "a choice re-plans the script");
  p.restart();
  assert.equal(p.next, 1);
  assert.deepEqual(log.slice(-2), ["load", "show 0"]);
});

test("a choice keeps the authored index", () => {
  const { stage } = fakeStage();
  const p = storyPlayer(stage, adaptStory(STORY, { places, characters }));
  for (let f = p.footer(); f.kind !== "end"; f = p.footer()) {
    if (f.kind === "turn" && f.turn.kind === "choice") { p.choose(1); assert.equal(p.picks[f.turn.id], 1); return; }
    if (f.kind === "turn" && f.turn.kind === "act") return;
    if (f.kind === "turn") p.say(); else p.devam();
  }
});

test("an act's run is the player's run while it plays, and its answer is the pick", async () => {
  const { stage } = fakeStage();
  const p = storyPlayer(stage, adaptStory(STORY, { places, characters }));
  assert.equal(p.run, null);
  for (let f = p.footer(); f.kind !== "end"; f = p.footer()) {
    if (f.kind === "turn" && f.turn.kind === "act") {
      const target = f.turn.act.targets.at(-1)!;
      let answer!: (r: { target?: string }) => void;
      const actRun: PlayerRun = { dur: 1, done: new Promise(() => {}), finish() {}, result: new Promise((r) => { answer = r; }) };
      stage.play = () => actRun;
      const done = p.act();
      assert.equal(p.run, actRun);
      assert.equal(p.footer().kind, "busy");
      answer({ target });
      assert.equal(await done, target);
      assert.equal(p.picks[f.turn.id], target);
      return;
    }
    if (f.kind === "devam") p.devam();
    else if (f.kind === "turn" && f.turn.kind === "say") p.say();
    else if (f.kind === "turn" && f.turn.kind === "choice") p.choose(0);
  }
  assert.fail("the bakkal scene has no act");
});

test("jump shows the opening, waits at a card, plays any other cue", () => {
  const { stage, log } = fakeStage();
  const p = storyPlayer(stage, adaptStory(STORY, { places, characters }));
  const card = p.info.findIndex((i, k) => k > 0 && i.turn);
  const plain = p.info.findIndex((i, k) => k > 0 && !i.turn);
  assert.ok(card > 0 && plain > 0, "the bakkal scene has a card and a plain cue");
  log.length = 0;
  p.jump(0);
  assert.deepEqual(log, ["show 0"]);
  assert.equal(p.next, 1);
  log.length = 0;
  p.jump(card);
  assert.deepEqual(log, [`show ${card - 1}`]);
  assert.equal(p.next, card);
  assert.equal(p.footer().kind, "turn");
  log.length = 0;
  p.jump(plain);
  assert.deepEqual(log, [`show ${plain - 1}`, `play ${plain}`]);
  assert.equal(p.next, plain + 1);
});

test("replace re-directs an edited story and keeps the picks", () => {
  const { stage, log } = fakeStage();
  const p = storyPlayer(stage, adaptStory(STORY, { places, characters }));
  const choice = p.info.find(i => i.turn?.kind === "choice")?.turn;
  assert.ok(choice && choice.kind === "choice", "the bakkal scene has a choice");
  p.jump(p.info.findIndex(i => i.turn === choice || i.turn?.kind === "choice"));
  p.choose(1);
  const edited: StoryDoc = structuredClone(STORY);
  const line = edited.steps.findIndex(s => "who" in s && s.who !== "nima");
  (edited.steps[line] as { tr: string }).tr = "Yeni bir söz.";
  log.length = 0;
  p.replace(adaptStory(edited, { places, characters }));
  assert.deepEqual(log, ["set 0"], "no reload");
  assert.equal(p.picks[choice.id], 1);
  assert.ok(p.info.some(i => i.step === line && i.tr === "Yeni bir söz."));
});

test("a reply cue names its index in the option's reply list", () => {
  const p = storyPlayer(fakeStage().stage, adaptStory(STORY, { places, characters }));
  const replies = p.info.filter(i => i.kind === "reply");
  for (const r of replies) {
    const s = STORY.steps[r.step] as { choice: { options: { reply?: unknown[] }[] } };
    assert.ok(r.reply !== undefined && s.choice.options[r.option!].reply![r.reply] !== undefined);
  }
});
