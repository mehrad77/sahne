// Runs (server/runs/run.ts) on a temp copy of the samples, with a scripted model: steps run as sub-agents through the real
// backstage tools, two at once and a third after both; a step that asks waits alone and goes on with the answer, in a new
// process too (its checkpoint in the store); gates hold the run until the person goes on; a step makes only what the plan
// gave it; a stopped step tries again; a spent budget pauses the run; a plan with a cycle or a document made twice is refused.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AIMessageChunk, type BaseMessage } from "@langchain/core/messages";

const SAMPLES = fileURLToPath(new URL("../../sahne-story/samples/", import.meta.url));
const root = mkdtempSync(join(tmpdir(), "backstage-runs-")), config = mkdtempSync(join(tmpdir(), "backstage-runs-config-"));
cpSync(SAMPLES, root, { recursive: true, filter: s => !s.endsWith("/samples/kit") });
process.env.SAHNE_CONTENT = root;
process.env.SAHNE_BACKSTAGE_CONFIG = config;
after(() => { for (const d of [root, config]) rmSync(d, { recursive: true, force: true }); });

const { Runs, planProblems } = await import("../server/runs/run.ts");
const { Store } = await import("../server/runs/store.ts");
const { Events } = await import("../server/events.ts");
const { proposalsOf } = await import("../server/proposals.ts");
const { DEFAULTS } = await import("../server/settings.ts");
type Step = import("../server/runs/run.ts").Step;
type Model = import("../server/ai/models.ts").Model;

type Turn = { text?: string; calls?: { name: string; args: Record<string, unknown> }[] };
/** A model that plays a script per step: each turn by how many it answered before; `wait` holds each turn a little. */
function scripted(scripts: Record<string, Turn[] | ((seen: BaseMessage[]) => Turn)>, o: { wait?: number; usage?: { input: number; output: number }; seen?: Record<string, BaseMessage[][]>; log?: string[]; tools?: Record<string, string[]> } = {}) {
  return (step: Step): Model => ({
    id: "anthropic", model: "claude-sonnet-5-5", pictures: true, tools: defs => { if (o.tools) o.tools[step.id] = defs.map(t => t.name); return defs.map(t => ({ name: t.name })); },
    chat: {
      bindTools: () => ({
        async *stream(messages: BaseMessage[]) {
          (o.seen ??= {})[step.id] = [...(o.seen[step.id] ?? []), messages];
          const n = messages.filter(m => m.getType() === "ai").length;
          o.log?.push(`${step.id}:${n}:start`);
          if (o.wait) await new Promise(r => setTimeout(r, o.wait));
          const s = scripts[step.id], t = typeof s === "function" ? s(messages) : s?.[n] ?? { text: "done" };
          o.log?.push(`${step.id}:${n}:end`);
          yield new AIMessageChunk({
            content: t.text ?? "",
            tool_call_chunks: (t.calls ?? []).map((c, i) => ({ id: `${step.id}_${n}_${i}`, name: c.name, args: JSON.stringify(c.args), index: i, type: "tool_call_chunk" as const })),
            usage_metadata: { input_tokens: o.usage?.input ?? 100, output_tokens: o.usage?.output ?? 10, total_tokens: 110 },
          });
        },
      }),
    } as never,
  });
}
const finish = (summary: string): Turn => ({ calls: [{ name: "finish_step", args: { summary } }] });
const derya = { id: "derya", name: { tr: "Derya" }, role: { en: "a student", fa: "دانشجو" }, bio: { en: "She studies.", fa: "درس می‌خواند." } };
const library = { id: "kutuphane", name: { tr: "Kütüphane", en: "Library", fa: "کتابخانه" }, from: "bakkal" };
const episode = { season: 1, id: "s1e05", releaseDate: "2026-09-17", kind: "episode", week: 0, place: "kutuphane", cast: ["derya", "nima"], words: ["a1-w-ekmek", "a1-w-su", "a1-w-cay", "a1-w-peynir", "a1-w-zeytin"], lessons: ["g_a1_2_var_yok"], title: { tr: "Kitaplar" }, level: "A1" };
const PLAN = {
  brief: "A week at the library: Derya, a new student, and a new library.",
  steps: [
    { id: "cast_derya", kind: "character" as const, title: "Derya", brief: "Make Derya.", owns: [{ kind: "character" as const, id: "derya" }] },
    { id: "place_library", kind: "place" as const, title: "The library", brief: "Make the library.", owns: [{ kind: "place" as const, id: "kutuphane" }] },
    { id: "ep_books", kind: "episode" as const, title: "Books", brief: "Write s1e05.", needs: ["cast_derya", "place_library"], owns: [{ kind: "story" as const, id: "s1e05" }] },
  ],
};
let file = 0;
function runs(model: (s: Step) => Model, events = new Events(), store = new Store(join(config, `t${++file}.sqlite`))) {
  return { r: new Runs({ store, events, write: true, shareCards: false, settings: () => ({ ...DEFAULTS, caps: {} }), model }), events, store };
}

test("a plan: unique new ids, needs that are steps and make no cycle, each document made once", () => {
  assert.deepEqual(planProblems(PLAN), []);
  assert.match(planProblems({ brief: "", steps: [{ ...PLAN.steps[0], needs: ["ep_books"] }, { ...PLAN.steps[2], needs: ["cast_derya"] }] }).join(), /needs itself/);
  assert.match(planProblems({ brief: "", steps: [PLAN.steps[0], { ...PLAN.steps[1], owns: PLAN.steps[0].owns }] }).join(), /made by cast_derya and place_library/);
  assert.match(planProblems({ brief: "", steps: [{ ...PLAN.steps[2] }] }).join(), /needs cast_derya, which is not a step/);
});

test("steps run as sub-agents: two at once, the third after both with their reports, all as one author", async () => {
  const log: string[] = [], seen: Record<string, BaseMessage[][]> = {};
  const { r, events } = runs(scripted({
    cast_derya: [{ calls: [{ name: "create_character", args: derya }] }, finish("derya: a student who loves books")],
    place_library: [{ calls: [{ name: "create_place", args: library }] }, finish("kutuphane: a library, copied from bakkal")],
    ep_books: [{ calls: [{ name: "create_episode", args: episode }] }, finish("s1e05 drafted")],
  }, { wait: 20, log, seen }));
  const run = r.create({ goal: "A week at the library", plan: PLAN, gates: false });
  await r.idle();
  assert.equal(run.status, "done", JSON.stringify(run.steps.map(s => [s.id, s.status, s.error])));
  // the cast and the place at once; the episode after both
  assert.ok(log.indexOf("place_library:0:start") < log.indexOf("cast_derya:0:end"), log.join(" "));
  assert.ok(log.indexOf("ep_books:0:start") > Math.max(log.lastIndexOf("cast_derya:1:end"), log.lastIndexOf("place_library:1:end")));
  // each step starts fresh: its own brief, and the reports of the steps it needs
  const first = String(seen.ep_books[0].find(m => m.getType() === "human")!.content);
  assert.match(first, /Write s1e05/);
  assert.match(first, /derya: a student who loves books/);
  assert.doesNotMatch(first, /Make Derya/);
  // the episode is set in the place the run proposed, with the character it proposed: all pending, by the run, tagged by step
  const ps = proposalsOf(events).all();
  assert.deepEqual(ps.map(p => [p.doc, p.by, p.step]), [["derya", "run:r1", "cast_derya"], ["kutuphane", "run:r1", "place_library"], ["s1e05", "run:r1", "ep_books"]]);
  assert.deepEqual(run.steps.map(s => s.summary), ["derya: a student who loves books", "kutuphane: a library, copied from bakkal", "s1e05 drafted"]);
  assert.ok(!existsSync(join(root, "stories", "s1e05.json")), "nothing is saved");
  assert.ok(r.log(run.id, "ep_books").some(e => e.event.type === "proposal"));
  assert.ok(run.usd > 0);
});

test("a step that asks waits alone, and goes on with the answer in a new process, from its checkpoint", async () => {
  const store = new Store(join(config, "ask.sqlite")), events = new Events();
  const scripts = {
    cast_derya: (m: BaseMessage[]): Turn => {
      const n = m.filter(x => x.getType() === "ai").length;
      if (n === 0) return { calls: [{ name: "ask_person", args: { question: "What does she study?", options: ["Maths", "Music"] } }] };
      const answered = m.some(x => x.getType() === "tool" && /Music/.test(String(x.content)));
      return n === 1 ? { calls: [{ name: "create_character", args: { ...derya, bio: { en: answered ? "She studies music." : "?", fa: "موسیقی" } } }] } : finish("derya studies music");
    },
    place_library: [{ calls: [{ name: "create_place", args: library }] }, finish("kutuphane")],
  };
  const plan = { brief: "b", steps: PLAN.steps.slice(0, 2) };
  const one = runs(scripted(scripts), events, store).r;
  const run = one.create({ goal: "g", plan, gates: false });
  await one.idle();
  assert.deepEqual(run.steps.map(s => s.status), ["asking", "done"], "the other step went on");
  assert.deepEqual(run.steps[0].question, { question: "What does she study?", options: ["Maths", "Music"] });
  // a new process: the run and the step's checkpoint are in the store
  const two = runs(scripted(scripts), events, new Store(join(config, "ask.sqlite"))).r;
  const again = two.get(run.id)!;
  assert.equal(again.steps[0].status, "asking");
  await two.step(run.id, "cast_derya", { action: "answer", answer: "Music" });
  await two.idle();
  assert.equal(again.status, "done", JSON.stringify(again.steps.map(s => [s.id, s.status, s.error])));
  const p = proposalsOf(events).all().find(x => x.doc === "derya")!;
  assert.equal((p.next as { bio: { en: string } }).bio.en, "She studies music.");
});

test("gates: the plan, then the cast and places, each waits for the person", async () => {
  const { r } = runs(scripted({
    cast_derya: [{ calls: [{ name: "create_character", args: { ...derya, id: "deniz" } }] }, finish("deniz")],
    place_library: [finish("nothing to make")],
    ep_books: [finish("read it")],
  }));
  const plan = { brief: "b", steps: [{ ...PLAN.steps[0], owns: [{ kind: "character" as const, id: "deniz" }] }, { ...PLAN.steps[1], owns: [] }, { ...PLAN.steps[2], owns: [] }] };
  const run = r.create({ goal: "g", plan });
  assert.deepEqual([run.status, run.gate], ["gate", "plan"]);
  assert.ok(run.steps.every(s => s.status === "waiting"), "nothing runs before the plan is looked at");
  r.act(run.id, { action: "continue" });
  await r.idle();
  assert.deepEqual([run.status, run.gate], ["gate", "castAndPlaces"]);
  assert.deepEqual(run.steps.map(s => s.status), ["done", "done", "waiting"]);
  r.act(run.id, { action: "continue" });
  await r.idle();
  assert.equal(run.status, "done");
});

test("a step makes only what the plan gave it; a stopped step tries again; a spent budget pauses the run", async () => {
  const { r } = runs(scripted({
    cast_derya: (m: BaseMessage[]): Turn => {
      const n = m.filter(x => x.getType() === "ai").length;
      if (n === 0) return { calls: [{ name: "create_place", args: { ...library, id: "not_mine" } }] };
      const refused = m.find(x => x.getType() === "tool");
      return finish(`refused: ${String(refused?.content).slice(0, 200)}`);
    },
  }, { wait: 30 }));
  const run = r.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0]] }, gates: false });
  await r.idle();
  assert.equal(r.log(run.id, "cast_derya").filter(e => e.event.type === "tool" && e.event.name === "finish_step").length, 1, "finish_step ends the step");
  assert.match(run.steps[0].summary!, /not proposed: place not_mine is not this step's to create\. This step makes character derya/);
  // a step stopped while it runs: the run waits for the person, and the step tries again
  const { r: r2 } = runs(scripted({ cast_derya: [finish("made")] }, { wait: 200 }));
  const run2 = r2.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0]] }, gates: false });
  await new Promise(res => setTimeout(res, 50));
  await r2.step(run2.id, "cast_derya", { action: "stop" });
  await r2.idle();
  assert.deepEqual([run2.status, run2.steps[0].status], ["paused", "stopped"]);
  await r2.step(run2.id, "cast_derya", { action: "retry" });
  await r2.idle();
  assert.equal(run2.status, "done");
  // a budget: the first step spends it, and the second does not start
  const { r: r3 } = runs(scripted({ cast_derya: [finish("a")], place_library: [finish("b")] }, { usage: { input: 1_000_000, output: 0 } }));
  const run3 = r3.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0], { ...PLAN.steps[1], needs: ["cast_derya"] }] }, gates: false, maxUsd: 1 });
  await r3.idle();
  assert.equal(run3.status, "paused");
  assert.match(run3.why!, /budget/);
  assert.deepEqual(run3.steps.map(s => s.status), ["done", "waiting"]);
});

test("after a restart, a step that was running goes on", async () => {
  const file = join(config, "restart.sqlite"), events = new Events();
  const one = runs(scripted({ cast_derya: [finish("made")] }), events, new Store(file)).r;
  const run = one.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0]] }, gates: { plan: true } });
  // the process ended while the step ran: so the store says
  const s = new Store(file);
  s.set("runs", { n: 1, runs: [{ ...run, status: "running", passed: ["plan"], steps: run.steps.map(x => ({ ...x, status: "running" })) }] });
  const two = runs(scripted({ cast_derya: [finish("made after the restart")] }), events, s).r;
  two.resume();
  await two.idle();
  assert.deepEqual([two.get(run.id)!.status, two.get(run.id)!.steps[0].summary], ["done", "made after the restart"]);
});

test("a run from its goal alone plans itself: the planner proposes, the plan waits at its gate with an estimate, and the person may change it", async () => {
  const proposed = { brief: "Derya at the library.", steps: [PLAN.steps[0], { ...PLAN.steps[1], needs: [] }, PLAN.steps[2]] };
  const { r } = runs(scripted({
    plan: [{ calls: [{ name: "propose_plan", args: { brief: "x", steps: [{ id: "a", kind: "task", title: "A", brief: "a", needs: ["b"] }] } }] }, { calls: [{ name: "propose_plan", args: proposed }] }],
  }));
  const run = r.create({ goal: "A week at the library" });
  assert.deepEqual(run.steps.map(s => s.kind), ["plan"]);
  await r.idle();
  // the first plan is refused with why; the second is set, each step after the planner
  assert.match(JSON.stringify(r.log(run.id, "plan")), /The plan is not set; fix this and propose it again:\\n- step a needs b, which is not a step/);
  assert.deepEqual([run.status, run.gate], ["gate", "plan"]);
  assert.deepEqual(run.steps.map(s => s.id), ["plan", "cast_derya", "place_library", "ep_books"]);
  assert.ok(run.steps.slice(1).every(s => s.needs.includes("plan")));
  assert.equal(run.brief, "Derya at the library.");
  assert.equal(run.estimateUsd, 0.25 + 0.3 + 0.8);
  assert.ok(Math.abs(run.maxUsd - (Math.max(2, 1.35 * 3) + run.usd)) < 1e-6, "three times the estimate");
  // at the gate the person drops the episode
  r.act(run.id, { action: "plan", plan: { brief: "Only the cast.", steps: [PLAN.steps[0]] } });
  assert.deepEqual(run.steps.map(s => s.id), ["plan", "cast_derya"]);
  assert.throws(() => r.act(run.id, { action: "plan", plan: { brief: "b", steps: [{ ...PLAN.steps[0], needs: ["ghost"] }] } }), /needs ghost/);
});

test("turning a step's proposal down: it and the finished steps built on it need a redo; done again, the run is done", async () => {
  let made = 0;
  const { r, events } = runs(scripted({
    cast_derya: (m: BaseMessage[]): Turn => (m.filter(x => x.getType() === "ai").length === 0 ? { calls: [{ name: "create_character", args: { ...derya, id: "defne", bio: { en: `Version ${++made}.`, fa: "نسخه" } } }] } : finish(`defne v${made}`)),
    place_library: [finish("no place")],
    ep_books: [finish("read")],
  }));
  const plan = { brief: "b", steps: [{ ...PLAN.steps[0], owns: [{ kind: "character" as const, id: "defne" }] }, { ...PLAN.steps[1], owns: [] }, { ...PLAN.steps[2], owns: [] }] };
  const run = r.create({ goal: "g", plan, gates: false });
  await r.idle();
  assert.equal(run.status, "done");
  const q = proposalsOf(events), p = q.all().find(x => x.doc === "defne")!;
  q.resolve(p.id, false);
  await r.idle();
  assert.deepEqual(run.steps.map(s => s.status), ["stale", "done", "stale"], "the episode was built on her");
  assert.equal(run.status, "paused");
  await r.step(run.id, "cast_derya", { action: "redo", note: "make her older" });
  await r.idle();
  assert.match(run.steps[0].brief, /Done again, because: make her older/);
  assert.equal(run.steps[0].summary, "defne v2");
  assert.equal(run.steps[2].status, "stale", "a step built on it waits for its own redo");
  await r.step(run.id, "ep_books", { action: "redo" });
  await r.idle();
  assert.equal(run.status, "done");
});

test("a plan that would make a retired character id is refused, with why", async () => {
  const { r } = runs(scripted({ plan: [{ calls: [{ name: "propose_plan", args: { brief: "b", steps: [{ id: "cast_z", kind: "character", title: "Zeynep", brief: "z", owns: [{ kind: "character", id: "zeynep" }] }] } }] }, { text: "stuck" }] }));
  const run = r.create({ goal: "g" });
  await r.idle();
  assert.match(JSON.stringify(r.log(run.id, "plan")), /the character id zeynep is retired/);
  assert.deepEqual(run.steps.map(s => s.id), ["plan"]);
});

test("undo: every direct write of a run is journaled; one person, with what was built on her, or the whole run, comes back as it was", async () => {
  const { readdirSync, readFileSync, statSync, utimesSync, writeFileSync } = await import("node:fs");
  const snapshot = () => Object.fromEntries(["characters", "places", "stories", "seasons"].flatMap(d => readdirSync(join(root, d)).map(f => [`${d}/${f}`, readFileSync(join(root, d, f), "utf8")])));
  const before = snapshot();
  const ep = { ...episode, id: "s1e07", cast: ["dilek", "nima"], place: "kutuphane2", releaseDate: "2026-09-18" };
  const { r } = runs(scripted({
    cast_derya: [{ calls: [{ name: "create_character", args: { ...derya, id: "dilek" } }] }, finish("dilek")],
    place_library: [{ calls: [{ name: "create_place", args: { ...library, id: "kutuphane2" } }] }, finish("kutuphane2")],
    // the episode is written three times: created, then changed twice (undo takes all of it back at once)
    ep_books: [{ calls: [{ name: "create_episode", args: ep }] }, { calls: [{ name: "edit_doc", args: { kind: "season", id: "s1", path: "", patch: { summary: { en: "Changed by the run." } } } }] },
      { calls: [{ name: "edit_doc", args: { kind: "story", id: "s1e07", path: "", patch: { summary: { tr: "Bir.", en: "One." } } } }] }, { calls: [{ name: "edit_doc", args: { kind: "story", id: "s1e07", path: "", patch: { summary: { tr: "İki.", en: "Two." } } } }] }, finish("s1e07")],
  }));
  const plan = { brief: "b", steps: [{ ...PLAN.steps[0], owns: [{ kind: "character" as const, id: "dilek" }] }, { ...PLAN.steps[1], owns: [{ kind: "place" as const, id: "kutuphane2" }] }, { ...PLAN.steps[2], owns: [{ kind: "story" as const, id: "s1e07" }] }] };
  const run = r.create({ goal: "g", plan, gates: false, agentEdits: "direct" });
  await r.idle();
  assert.equal(run.status, "done", JSON.stringify(run.steps.map(s => [s.id, s.status, s.error])));
  assert.ok(readFileSync(join(root, "characters", "dilek.json"), "utf8"));
  assert.deepEqual(r.journal.made(run.id).map(m => `${m.kind}:${m.id}${m.created ? "+" : ""}`).sort(), ["character:dilek+", "place:kutuphane2+", "season:s1", "story:s1e07+"]);
  // undo the person: she goes, and the episode built on her, and the season's change the episode's step made; the place stays
  const one = r.undo(run.id, [{ kind: "character", id: "dilek" }]);
  assert.deepEqual(one.undone.map(u => `${u.kind}:${u.id}`).sort(), ["character:dilek", "season:s1", "story:s1e07"]);
  assert.deepEqual(run.steps.map(s => s.status), ["undone", "done", "undone"]);
  const now = snapshot();
  assert.equal(now["seasons/s1.json"], before["seasons/s1.json"], "the season is as it was");
  assert.ok(!now["characters/dilek.json"] && !now["stories/s1e07.json"] && now["places/kutuphane2.json"], "the episode written three times is gone in one undo");
  // a file someone changed after the run is kept; a file only touched (its mtime) is still the run's
  const placeFile = join(root, "places", "kutuphane2.json"), was = readFileSync(placeFile, "utf8"), t = statSync(placeFile).mtime;
  writeFileSync(placeFile, was.replace("}", ', "note": "mine" }'));
  const all = r.undo(run.id);
  assert.deepEqual([all.undone.length, all.kept.map(k => k.id)], [0, ["kutuphane2"]]);
  writeFileSync(placeFile, was);
  utimesSync(placeFile, t, new Date(t.getTime() + 5000));
  assert.deepEqual(r.undo(run.id).undone.map(u => u.id), ["kutuphane2"], "back as the run left it, it is the run's again");
  // the whole run, on a fresh one: the root is as it was
  const { r: r2 } = runs(scripted({ cast_derya: [{ calls: [{ name: "create_character", args: { ...derya, id: "dilara2" } }] }, finish("d")] }));
  const run2 = r2.create({ goal: "g", plan: { brief: "b", steps: [{ ...PLAN.steps[0], owns: [{ kind: "character" as const, id: "dilara2" }] }] }, gates: false, agentEdits: "direct" });
  await r2.idle();
  r2.undo(run2.id);
  assert.deepEqual(snapshot(), before, "the root is as it was, file by file");
});

test("auto mode: no gates and no proposals, every write journaled; never asking leaves out ask_person; a budget stop goes on by itself", async () => {
  const tools: Record<string, string[]> = {};
  const { r, events } = runs(scripted({
    plan: [{ calls: [{ name: "propose_plan", args: { brief: "b", steps: [{ id: "cast_x", kind: "character", title: "Defne", brief: "make her", owns: [{ kind: "character", id: "defne3" }] }] } }] }],
    cast_x: [{ calls: [{ name: "create_character", args: { ...derya, id: "defne3" } }] }, finish("defne3 made")],
  }, { tools }));
  const run = r.create({ goal: "a person", mode: "auto", asks: "never" });
  assert.deepEqual([run.mode, run.agentEdits, run.gates], ["auto", "direct", { plan: false, castAndPlaces: false }]);
  await r.idle();
  assert.equal(run.status, "done", JSON.stringify(run.steps.map(s => [s.id, s.status, s.error])));
  assert.equal(proposalsOf(events).all().length, 0, "nothing waits");
  assert.deepEqual(r.journal.made(run.id).map(m => m.id), ["defne3"]);
  assert.ok(!tools.cast_x.includes("ask_person") && !tools.plan.includes("ask_person"));
  r.undo(run.id);
  // a step the run's budget stopped waits, and goes on once the budget is raised
  const { r: r2 } = runs(scripted({ cast_derya: [finish("a")], place_library: [finish("b")] }, { usage: { input: 1_000_000, output: 0 } }));
  const run2 = r2.create({ goal: "g", plan: { brief: "b", steps: [{ ...PLAN.steps[0], owns: [] }, { ...PLAN.steps[1], owns: [] }] }, gates: false, maxUsd: 1, concurrency: 1 });
  await r2.idle();
  assert.equal(run2.status, "paused");
  r2.act(run2.id, { action: "budget", maxUsd: 20 });
  await r2.idle();
  assert.equal(run2.status, "done", JSON.stringify(run2.steps.map(s => [s.id, s.status, s.error])));
});
