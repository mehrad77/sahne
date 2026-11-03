// Runs (server/runs/run.ts) on a temp copy of the samples, with a scripted model: steps run as sub-agents through the real
// backstage tools, two at once and a third after both; a step that asks waits alone and goes on with the answer, in a new
// process too (its checkpoint in the store); gates hold the run until the person goes on; a step makes only what the plan
// gave it; a stopped step tries again; a spent budget pauses the run; a plan with a cycle or a document made twice is refused.

import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
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
  const run = r.create({ goal: "A week at the library", plan: PLAN, gates: false , agentEdits: "proposals" });
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
  assert.deepEqual(ps.map(p => [p.doc, p.by, p.step]), [["derya", run.by, "cast_derya"], ["kutuphane", run.by, "place_library"], ["s1e05", run.by, "ep_books"]]);
  assert.deepEqual(run.steps.map(s => s.summary), ["derya: a student who loves books", "kutuphane: a library, copied from bakkal", "s1e05 drafted"]);
  assert.ok(!existsSync(join(root, "stories", "s1e05.json")), "nothing is saved");
  assert.ok(r.log(run.id, "ep_books").some(e => e.event.type === "proposal"));
  // its record in the sidecar says what it did, and nothing else (no log, no checkpoint, no step's brief)
  const rec = JSON.parse(readFileSync(join(root, ".backstage", "tasks", `${run.id}.json`), "utf8"));
  assert.deepEqual(Object.keys(rec).sort(), ["brief", "by", "createdAt", "did", "goal", "id", "made", "maxUsd", "mode", "status", "steps", "updatedAt", "usd"].concat(rec.estimateUsd !== undefined ? ["estimateUsd"] : []).sort());
  assert.deepEqual([rec.id, rec.status, rec.goal, rec.by], [run.id, "done", "A week at the library", run.by]);
  assert.deepEqual(rec.steps.map((s: { id: string; status: string; summary?: string }) => [s.id, s.status, s.summary]), run.steps.map(s => [s.id, "done", s.summary]));
  assert.ok(rec.steps.every((s: object) => !("brief" in s) && !("told" in s) && !("proposals" in s)));
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
  const run = one.create({ goal: "g", plan, gates: false , agentEdits: "proposals" });
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
  const run = r.create({ goal: "g", plan, gates: { castAndPlaces: true }, agentEdits: "proposals" });
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
  const run = r.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0]] }, gates: false , agentEdits: "proposals" });
  await r.idle();
  assert.equal(r.log(run.id, "cast_derya").filter(e => e.event.type === "tool" && e.event.name === "finish_step").length, 1, "finish_step ends the step");
  assert.match(run.steps[0].summary!, /not proposed: place not_mine is not this step's to create\. This step makes character derya/);
  // a step stopped while it runs: the run waits for the person, and the step tries again
  const { r: r2 } = runs(scripted({ cast_derya: [finish("made")] }, { wait: 200 }));
  const run2 = r2.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0]] }, gates: false , agentEdits: "proposals" });
  await new Promise(res => setTimeout(res, 50));
  await r2.step(run2.id, "cast_derya", { action: "stop" });
  await r2.idle();
  assert.deepEqual([run2.status, run2.steps[0].status], ["paused", "stopped"]);
  await r2.step(run2.id, "cast_derya", { action: "retry" });
  await r2.idle();
  assert.equal(run2.status, "done");
  // a budget: the first step spends it, and the second does not start
  const { r: r3 } = runs(scripted({ cast_derya: [finish("a")], place_library: [finish("b")] }, { usage: { input: 1_000_000, output: 0 } }));
  const run3 = r3.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0], { ...PLAN.steps[1], needs: ["cast_derya"] }] }, gates: false, maxUsd: 1 , agentEdits: "proposals" });
  await r3.idle();
  assert.equal(run3.status, "paused");
  assert.match(run3.why!, /budget/);
  assert.deepEqual(run3.steps.map(s => s.status), ["done", "waiting"]);
});

test("after a restart, a step that was running goes on", async () => {
  const file = join(config, "restart.sqlite"), events = new Events();
  const one = runs(scripted({ cast_derya: [finish("made")] }), events, new Store(file)).r;
  const run = one.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0]] }, gates: { plan: true } , agentEdits: "proposals" });
  // the process ended while the step ran: so the store says
  const s = new Store(file);
  s.set("runs", { n: 1, runs: [{ ...run, status: "running", passed: ["plan"], steps: run.steps.map(x => ({ ...x, status: "running" })) }] });
  const two = runs(scripted({ cast_derya: [finish("made after the restart")] }), events, s).r;
  two.resume();
  await two.idle();
  assert.deepEqual([two.get(run.id)!.status, two.get(run.id)!.steps[0].summary], ["done", "made after the restart"]);
});

test("a run from its goal alone plans itself: the planner proposes, the plan waits at its gate with an estimate, and the person may change it", async () => {
  const proposed = { brief: "Derya at the library.", steps: [{ ...PLAN.steps[0], about: "Makes Derya, a new student." }, { ...PLAN.steps[1], needs: [] }, PLAN.steps[2]] };
  const { r } = runs(scripted({
    plan: [{ calls: [{ name: "propose_plan", args: { brief: "x", steps: [{ id: "a", kind: "task", title: "A", brief: "a", needs: ["b"] }] } }] }, { calls: [{ name: "propose_plan", args: proposed }] }],
  }));
  const run = r.create({ goal: "A week at the library" , agentEdits: "proposals" });
  assert.deepEqual(run.steps.map(s => s.kind), ["plan"]);
  await r.idle();
  // the first plan is refused with why; the second is set, each step after the planner
  assert.match(JSON.stringify(r.log(run.id, "plan")), /The plan is not set; fix this and propose it again:\\n- step a needs b, which is not a step/);
  assert.deepEqual([run.status, run.gate], ["gate", "plan"]);
  assert.deepEqual(run.steps.map(s => s.id), ["plan", "cast_derya", "place_library", "ep_books"]);
  assert.ok(run.steps.slice(1).every(s => s.needs.includes("plan")));
  assert.equal(run.brief, "Derya at the library.");
  assert.deepEqual(run.steps.map(s => s.about), [undefined, "Makes Derya, a new student.", undefined, undefined], "each step's plain line for the person");
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
  const run = r.create({ goal: "g", plan, gates: false , agentEdits: "proposals" });
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
  const run = r.create({ goal: "g" , agentEdits: "proposals" });
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
  const run2 = r2.create({ goal: "g", plan: { brief: "b", steps: [{ ...PLAN.steps[0], owns: [] }, { ...PLAN.steps[1], owns: [] }] }, gates: false, maxUsd: 1, concurrency: 1 , agentEdits: "proposals" });
  await r2.idle();
  assert.equal(run2.status, "paused");
  r2.act(run2.id, { action: "budget", maxUsd: 20 });
  await r2.idle();
  assert.equal(run2.status, "done", JSON.stringify(run2.steps.map(s => [s.id, s.status, s.error])));
});

test("checking with the person: the plan waits, then it writes straight in, journaled, and asks only real choices", async () => {
  const tools: Record<string, string[]> = {}, seen: Record<string, BaseMessage[][]> = {};
  const { r, events } = runs(scripted({
    plan: [{ calls: [{ name: "propose_plan", args: { brief: "b", steps: [{ id: "cast_x", kind: "character", title: "Defne", brief: "make her", owns: [{ kind: "character", id: "defne4" }] }] } }] }],
    cast_x: [{ calls: [{ name: "create_character", args: { ...derya, id: "defne4" } }] }, finish("defne4 made")],
  }, { tools, seen }));
  const run = r.create({ goal: "a person", mode: "check" });
  assert.deepEqual([run.mode, run.agentEdits, run.asks, run.gates], ["check", "direct", "choices", { plan: true, castAndPlaces: false }]);
  await r.idle();
  assert.deepEqual([run.status, run.gate], ["gate", "plan"], "the plan waits for a look");
  r.act(run.id, { action: "continue" });
  await r.idle();
  assert.equal(run.status, "done", JSON.stringify(run.steps.map(s => [s.id, s.status, s.error])));
  assert.equal(proposalsOf(events).all().length, 0, "no proposal waits: a new person is no question");
  assert.deepEqual(r.journal.made(run.id).map(m => m.id), ["defne4"]);
  assert.ok(tools.cast_x.includes("ask_person"), "it may still ask a real choice");
  const first = seen.cast_x[0].map(m => String(m.content)).join("\n");
  assert.match(first, /never ask whether to make or change something/);
  r.undo(run.id);
  // just doing it asks nothing, unless told otherwise
  const quiet = r.create({ goal: "g", plan: { brief: "b", steps: [{ ...PLAN.steps[0], owns: [] }] }, mode: "auto" });
  assert.equal(quiet.asks, "never");
  await r.idle();
});

test("a step says what it decided; the task's history lists its writes in order, and an undone one goes", async () => {
  const { r } = runs(scripted({
    plan: [{ calls: [{ name: "propose_plan", args: { brief: "b", steps: [{ id: "cast_x", kind: "character", title: "Defne", brief: "make her", owns: [{ kind: "character", id: "defne5" }] }, { id: "cast_y", kind: "character", title: "Ece", brief: "make her", needs: ["cast_x"], owns: [{ kind: "character", id: "ece5" }] }] } }] }],
    cast_x: [{ calls: [{ name: "create_character", args: { ...derya, id: "defne5" } }] }, { calls: [{ name: "finish_step", args: { summary: "made", decided: ["Named her Defne, not Deniz", " ", 3] } }] }],
    cast_y: [{ calls: [{ name: "create_character", args: { ...derya, id: "ece5" } }] }, finish("made")],
  }));
  const run = r.create({ goal: "two people", mode: "auto" });
  await r.idle();
  assert.equal(run.status, "done", JSON.stringify(run.steps.map(s => [s.id, s.status, s.error])));
  assert.deepEqual(run.steps.find(s => s.id === "cast_x")!.decided, ["Named her Defne, not Deniz"]);
  assert.equal(run.steps.find(s => s.id === "cast_y")!.decided, undefined);
  const did = r.journal.history(run.id);
  assert.deepEqual(did.map(d => [d.step, d.kind, d.id, d.created]), [["cast_x", "character", "defne5", true], ["cast_y", "character", "ece5", true]]);
  assert.ok(did[0].at <= did[1].at);
  r.undo(run.id, [{ kind: "character", id: "ece5" }]);
  assert.deepEqual(r.journal.history(run.id).map(d => d.id), ["defne5"]);
  r.undo(run.id);
});

test("pausing: a working step waits before its next model call and goes on from there; a note told to it is read then", async () => {
  const seen: Record<string, BaseMessage[][]> = {};
  let r!: InstanceType<typeof Runs>, run!: ReturnType<InstanceType<typeof Runs>["create"]>, paused = false;
  const { r: made } = runs(scripted({
    cast_x: (m: BaseMessage[]) => {
      const n = m.filter(x => x.getType() === "ai").length;
      // the person pauses while its first answer comes, and tells it something
      if (n === 0 && !paused) { paused = true; r.act(run.id, { action: "pause" }); void r.step(run.id, "cast_x", { action: "tell", text: "make her a little older" }); return { calls: [{ name: "kit_search", args: { kind: "characters" } }] }; }
      return n >= 1 ? finish("made") : { calls: [{ name: "kit_search", args: { kind: "characters" } }] };
    },
  }, { seen }));
  r = made;
  run = r.create({ goal: "g", plan: { brief: "b", steps: [{ id: "cast_x", kind: "character", title: "X", brief: "make her", owns: [] }] }, gates: false });
  await r.idle();
  assert.deepEqual([run.status, run.steps[0].status], ["paused", "waiting"], "it waits, its tool call done");
  assert.deepEqual(run.steps[0].told, ["make her a little older"], "not read yet");
  r.act(run.id, { action: "continue" });
  await r.idle();
  assert.equal(run.status, "done", JSON.stringify(run.steps.map(s => [s.id, s.status, s.error])));
  const last = seen.cast_x.at(-1)!.map(m => String(typeof m.content === "string" ? m.content : JSON.stringify(m.content))).join("\n");
  assert.match(last, /The person says, while you work: make her a little older/);
  assert.equal(run.steps[0].told, undefined);
  assert.ok(r.log(run.id, "cast_x").some(e => JSON.stringify(e.event).includes("You said")));
  await assert.rejects(r.step(run.id, "cast_x", { action: "tell", text: "x" }), /tell a step while it works/);
});

test("a document's text before the task first wrote it, and now; steps keep when they worked", async () => {
  const { r } = runs(scripted({
    plan: [{ calls: [{ name: "propose_plan", args: { brief: "b", steps: [{ id: "cast_x", kind: "character", title: "Defne", brief: "make her", owns: [{ kind: "character", id: "defne6" }] }] } }] }],
    cast_x: [{ calls: [{ name: "create_character", args: { ...derya, id: "defne6" } }] }, finish("made")],
  }));
  const run = r.create({ goal: "a person", mode: "auto" });
  await r.idle();
  const b = r.journal.before(run.id, "character", "defne6")!;
  assert.equal(b.before, null, "it created her");
  assert.match(b.now!, /defne6/);
  assert.equal(r.journal.before(run.id, "character", "nima"), null, "it never wrote nima");
  const s = run.steps.find(x => x.id === "cast_x")!;
  assert.ok(s.startedAt! <= s.endedAt!, JSON.stringify(s));
  r.undo(run.id);
});

test("a step whose answer was cut off runs again, told why, and is done only when it finishes", async () => {
  let calls = 0;
  const seen: BaseMessage[][] = [];
  const { r } = runs(() => ({
    id: "anthropic", model: "claude-sonnet-5-5", pictures: true, tools: defs => defs.map(t => ({ name: t.name })),
    chat: { bindTools: () => ({ async *stream(messages: BaseMessage[]) {
      seen.push(messages);
      // the first answer is cut off; the second finishes the step
      if (calls++ === 0) { yield new AIMessageChunk({ content: "partial", additional_kwargs: { stop_reason: "max_tokens" }, usage_metadata: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } }); return; }
      yield new AIMessageChunk({ content: "", tool_call_chunks: [{ id: "f1", name: "finish_step", args: JSON.stringify({ summary: "made after the retry" }), index: 0, type: "tool_call_chunk" }], usage_metadata: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } });
    } }) } as never,
  }));
  const run = r.create({ goal: "g", plan: { brief: "b", steps: [{ id: "cast_x", kind: "character", title: "X", brief: "make her", owns: [] }] }, gates: false });
  await r.idle();
  assert.equal(calls, 2, "the retry asked the model again");
  assert.deepEqual([run.status, run.steps[0].status, run.steps[0].summary, run.steps[0].error], ["done", "done", "made after the retry", undefined]);
  assert.match(String(seen[1].at(-1)!.content), /Your last try stopped before your step was done \(the answer was cut off/);
  // cut off every time: it fails, and Try again asks the model again, never done unfinished
  calls = -100;
  const { r: r2 } = runs(() => ({
    id: "anthropic", model: "claude-sonnet-5-5", pictures: true, tools: defs => defs.map(t => ({ name: t.name })),
    chat: { bindTools: () => ({ async *stream() { calls++; yield new AIMessageChunk({ content: "partial", additional_kwargs: { stop_reason: "max_tokens" }, usage_metadata: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } }); } }) } as never,
  }));
  const run2 = r2.create({ goal: "g", plan: { brief: "b", steps: [{ id: "cast_x", kind: "character", title: "X", brief: "make her", owns: [] }] }, gates: false });
  await r2.idle();
  assert.deepEqual([run2.steps[0].status, calls], ["failed", -98]);
  await r2.step(run2.id, "cast_x", { action: "retry" });
  await r2.idle();
  assert.deepEqual([run2.steps[0].status, calls], ["failed", -96]);
});

test("a planner that ends without a plan (it asked in words) leaves the task waiting, not done", async () => {
  for (const mode of ["check", "auto"] as const) {
    let calls = 0;
    const { r } = runs(scripted({ plan: () => { calls++; return { text: "Which season should they go in: s1 or s2?" }; } }));
    const run = r.create({ goal: "A week at the library", mode });
    await r.idle();
    assert.deepEqual([run.status, run.steps[0].status, calls], ["paused", "failed", 1], `${mode}: it waits for the person, not asked again`);
    assert.match(run.steps[0].error!, /ended without a plan.*Which season should they go in/);
  }
});

test("a note told to a step stays until a model turn reads it: a call that fails reads it again", async () => {
  const seen: BaseMessage[][] = [];
  let r!: InstanceType<typeof Runs>, run!: ReturnType<InstanceType<typeof Runs>["create"]>;
  const { r: made } = runs(() => ({
    id: "anthropic", model: "claude-sonnet-5-5", pictures: true, tools: defs => defs.map(t => ({ name: t.name })),
    chat: { bindTools: () => ({ async *stream(messages: BaseMessage[]) {
      seen.push(messages);
      const k = seen.length - 1;
      if (k === 0) void r.step(run.id, "cast_x", { action: "tell", text: "make her older" });
      await new Promise(res => setTimeout(res, 20));
      // the call that first reads the note fails
      if (k === 1) throw new Error("overloaded");
      const calls = k === 0 ? [{ name: "kit_search", args: { kind: "characters" } }] : [{ name: "finish_step", args: { summary: "made" } }];
      yield new AIMessageChunk({ content: "", tool_call_chunks: calls.map((c, i) => ({ id: `t${k}_${i}`, name: c.name, args: JSON.stringify(c.args), index: i, type: "tool_call_chunk" as const })), usage_metadata: { input_tokens: 10, output_tokens: 10, total_tokens: 20 } });
    } }) } as never,
  }));
  r = made;
  run = r.create({ goal: "g", plan: { brief: "b", steps: [{ id: "cast_x", kind: "character", title: "X", brief: "make her", owns: [] }] }, gates: false });
  await r.idle();
  assert.equal(run.steps[0].status, "done", JSON.stringify(run.steps[0]));
  const has = (ms: BaseMessage[]) => ms.some(m => /make her older/.test(String(m.content)));
  assert.deepEqual(seen.map(has), [false, true, true], "the retry reads the note too");
  assert.equal(run.steps[0].told, undefined, "read, it goes");
});

test("a proposal turned down while its step still works: the step is stale when it ends, and a redo waits for it to end", async () => {
  let events!: InstanceType<typeof Events>, r!: InstanceType<typeof Runs>, run!: ReturnType<InstanceType<typeof Runs>["create"]>, refused = "";
  const made = runs(scripted({
    cast_derya: (m: BaseMessage[]): Turn => {
      const n = m.filter(x => x.getType() === "ai").length;
      if (n === 0) return { calls: [{ name: "create_character", args: { ...derya, id: "defne8" } }] };
      if (n === 1) {
        // the person turns it down while the step still works, and asks for a redo at once
        const q = proposalsOf(events), p = q.all().find(x => x.doc === "defne8")!;
        q.resolve(p.id, false);
        void r.step(run.id, "cast_derya", { action: "redo" }).catch(e => { refused = (e as Error).message; });
        return { calls: [{ name: "kit_search", args: { kind: "characters" } }] };
      }
      return finish("defne8");
    },
  }));
  ({ r, events } = made);
  run = r.create({ goal: "g", plan: { brief: "b", steps: [{ ...PLAN.steps[0], owns: [{ kind: "character" as const, id: "defne8" }] }] }, gates: false, agentEdits: "proposals" });
  await r.idle();
  assert.match(refused, /still working: stop it first/);
  assert.deepEqual([run.steps[0].status, run.status], ["stale", "paused"]);
  assert.match(run.why!, /Derya needs you/);
});

test("a step that waits for an undone one: the task says so, and goes on once that is made again", async () => {
  const { r } = runs(scripted({
    cast: (m: BaseMessage[]): Turn => (m.filter(x => x.getType() === "ai").length === 0 ? { calls: [{ name: "create_character", args: { ...derya, id: "dilek9" } }] } : finish("dilek9")),
    ep: [finish("episode")],
  }));
  const run = r.create({ goal: "g", agentEdits: "direct", gates: { plan: false, castAndPlaces: true }, plan: { brief: "b", steps: [
    { id: "cast", kind: "character", title: "Dilek", brief: "make her", owns: [{ kind: "character", id: "dilek9" }] },
    { id: "ep", kind: "episode", title: "Ep", brief: "write it", needs: ["cast"], owns: [] },
  ] } });
  await r.idle();
  assert.deepEqual([run.status, run.gate], ["gate", "castAndPlaces"]);
  r.undo(run.id, [{ kind: "character", id: "dilek9" }]);
  assert.deepEqual([run.status, run.steps.map(s => s.status)], ["paused", ["undone", "waiting"]]);
  assert.match(run.why!, /Dilek was undone, and the steps after it wait: make it again/);
  await r.step(run.id, "cast", { action: "redo" });
  await r.idle();
  r.act(run.id, { action: "continue" });
  await r.idle();
  assert.deepEqual([run.status, run.steps.map(s => s.status)], ["done", ["done", "done"]], run.why);
  r.undo(run.id);
});

test("a plan's steps are of a known kind with lists where lists go; a budget is a number, and one stored as none is the default", async () => {
  assert.match(planProblems({ brief: "b", steps: [{ id: "a", kind: "cast" as never, title: "A", brief: "a" }] }).join(), /kind "cast" is not one of/);
  assert.match(planProblems({ brief: "b", steps: [{ id: "a", kind: "task", title: "A", brief: "a", needs: "b" as never }] }).join(), /needs is a list/);
  assert.match(planProblems({ brief: "b", steps: [{ id: "a", kind: "task", title: "A", brief: "a", owns: {} as never }] }).join(), /owns is a list/);
  const { r, store } = runs(scripted({}));
  assert.throws(() => r.create({ goal: "g", plan: { brief: "b", steps: [{ id: "a", kind: "cast" as never, title: "A", brief: "a" }] } }), /kind "cast"/);
  const run = r.create({ goal: "g", plan: { brief: "b", steps: [{ id: "a", kind: "task", title: "A", brief: "a" }] }, gates: { plan: true } });
  assert.ok(Number.isFinite(run.estimateUsd) && Number.isFinite(run.maxUsd));
  for (const maxUsd of [undefined, null, NaN, -1, "5"]) assert.throws(() => r.act(run.id, { action: "budget", maxUsd: maxUsd as never }), /a budget is a number of dollars/);
  assert.equal(run.status, "gate", "a refused budget changes nothing");
  // a run an older backstage stored with no budget: a new process starts, with the default
  store.set("runs", { n: 1, runs: [{ ...run, status: "paused", maxUsd: null }] });
  const again = new Runs({ store, events: new Events(), write: true, shareCards: false, settings: () => ({ ...DEFAULTS, caps: {} }), model: scripted({}) });
  again.resume();
  assert.equal(again.get(run.id)!.maxUsd, 10);
});

test("two questions in one turn: the first is put to the person, the second is answered 'one at a time', so every call has its answer", async () => {
  const seen: Record<string, BaseMessage[][]> = {};
  const { r } = runs(scripted({
    cast_derya: (m: BaseMessage[]): Turn => (m.filter(x => x.getType() === "ai").length === 0
      ? { calls: [{ name: "ask_person", args: { question: "Her name?" } }, { name: "ask_person", args: { question: "Her age?" } }] }
      : finish("asked")),
  }, { seen }));
  const run = r.create({ goal: "g", plan: { brief: "b", steps: [{ ...PLAN.steps[0], owns: [] }] }, gates: false });
  await r.idle();
  assert.deepEqual([run.steps[0].status, run.steps[0].question?.question], ["asking", "Her name?"]);
  await r.step(run.id, "cast_derya", { action: "answer", answer: "Defne" });
  await r.idle();
  assert.equal(run.steps[0].status, "done");
  const last = seen.cast_derya.at(-1)!, turn = last.find(m => m.getType() === "ai") as unknown as { tool_calls: { id: string }[] };
  const answered = last.filter(m => m.getType() === "tool").map(m => (m as unknown as { tool_call_id: string }).tool_call_id);
  assert.deepEqual(turn.tool_calls.map(c => c.id).sort(), answered.sort(), "each tool call has its result");
  assert.ok(last.some(m => /one question at a time/.test(String(m.content))));
});

test("undo keeps a person's save made between two writes of the task to one document, and says so", async () => {
  const { readFileSync } = await import("node:fs");
  const { save, readDoc, forget } = await import("../server/content.ts");
  const file = join(root, "seasons", "s1.json"), was = readFileSync(file, "utf8");
  const { r } = runs(scripted({
    x: (m: BaseMessage[]): Turn => {
      const n = m.filter(x => x.getType() === "ai").length;
      if (n === 1) {
        // between the task's two writes, the person saves the season's title
        forget();
        const d = readDoc("season", "s1") as { doc: Record<string, unknown>; mtime: number };
        assert.equal(save([{ kind: "season", id: "s1", doc: { ...d.doc, title: { ...(d.doc.title as object), en: "THE PERSON'S TITLE" } }, mtime: d.mtime }], { write: true }).status, 200);
      }
      return n < 2 ? { calls: [{ name: "edit_doc", args: { kind: "season", id: "s1", path: "", patch: { summary: { en: `The task's change ${n + 1}.` } } } }] } : finish("done");
    },
  }));
  const run = r.create({ goal: "g", agentEdits: "direct", gates: false, plan: { brief: "b", steps: [{ id: "x", kind: "task", title: "X", brief: "change the season", owns: [] }] } });
  await r.idle();
  assert.equal(run.status, "done", JSON.stringify(run.steps));
  const u = r.undo(run.id);
  const now = readFileSync(file, "utf8");
  // back to what the person saved (which held the task's first change), not to before the task
  assert.ok(now.includes("THE PERSON'S TITLE") && now.includes("The task's change 1.") && !now.includes("The task's change 2."), "back to what the person saved");
  assert.deepEqual(u.kept.map(k => [k.id, k.why]), [["s1", "someone saved it between the task's writes, and that is kept"]]);
  // put the season back for the other tests
  const { writeFileSync } = await import("node:fs");
  writeFileSync(file, was); forget();
});

test("undo never takes away a person or place the task made while a document that stays still names it", async () => {
  const { existsSync: has } = await import("node:fs");
  const ep = { ...episode, id: "s1e08", cast: ["dilek10", "nima"], place: "bakkal", releaseDate: "2026-09-22" };
  const { r } = runs(scripted({
    cast: [{ calls: [{ name: "create_character", args: { ...derya, id: "dilek10" } }] }, finish("dilek10")],
    // a step that does not build on hers (no needs), so undoing her alone leaves its episode
    ep: [{ calls: [{ name: "create_episode", args: ep }] }, finish("s1e08")],
  }));
  const run = r.create({ goal: "g", agentEdits: "direct", gates: false, concurrency: 1, plan: { brief: "b", steps: [
    { id: "cast", kind: "character", title: "Dilek", brief: "make her", owns: [{ kind: "character", id: "dilek10" }] },
    { id: "ep", kind: "episode", title: "Ep", brief: "write it", owns: [{ kind: "story", id: "s1e08" }] },
  ] } });
  await r.idle();
  assert.equal(run.status, "done", JSON.stringify(run.steps.map(s => [s.id, s.status, s.error])));
  const one = r.undo(run.id, [{ kind: "character", id: "dilek10" }]);
  assert.deepEqual(one.undone, []);
  assert.deepEqual(one.kept.map(k => [k.id, k.why]), [["dilek10", "s1e08 uses it: take it out of it first"]]);
  assert.ok(has(join(root, "characters", "dilek10.json")));
  // the whole task: the episode goes with her
  const all = r.undo(run.id).undone.map(u => u.id);
  assert.ok(all.includes("dilek10") && all.includes("s1e08"), all.join());
  assert.ok(!has(join(root, "characters", "dilek10.json")) && !has(join(root, "stories", "s1e08.json")));
});

test("a step stopped between two tool calls of a turn and tried again does not make the first one's edit twice", async () => {
  const { readFileSync, writeFileSync } = await import("node:fs");
  const { looksOf } = await import("../server/look.ts");
  const file = join(root, "stories", "s1e00.json"), was = readFileSync(file, "utf8"), count = () => (JSON.parse(readFileSync(file, "utf8")) as { steps: unknown[] }).steps.length, n0 = count();
  const { r, events } = runs(scripted({
    // one turn: an insert (saved at once), then a look that waits for an editor
    x: [{ calls: [{ name: "insert_step", args: { id: "s1e00", at: "steps/1", step: { beat: { who: "nima", wait: 500 } } } }, { name: "look", args: { id: "s1e00" } }] }, finish("done")],
  }));
  const rids: string[] = [];
  events.on((name, d) => { if (name === "look") rids.push((d as { rid: string }).rid); });
  const run = r.create({ goal: "g", agentEdits: "direct", gates: false, plan: { brief: "b", steps: [{ id: "x", kind: "episode", title: "X", brief: "add a beat", owns: [{ kind: "story", id: "s1e00" }] }] } });
  while (!rids.length) await new Promise(res => setTimeout(res, 10));
  await r.step(run.id, "x", { action: "stop" });
  await r.idle();
  assert.equal(count(), n0 + 1);
  assert.throws(() => r.undo(run.id), /still finishing a tool call/, "the look is still at work");
  await r.step(run.id, "x", { action: "retry" });
  // the retry waits for the same look, not a new one; it ends
  await new Promise(res => setTimeout(res, 50));
  assert.equal(rids.length, 1);
  looksOf(events).answer(rids[0], null);
  await r.idle();
  assert.deepEqual([run.steps[0].status, count()], ["done", n0 + 1], "inserted once");
  writeFileSync(file, was);
  (await import("../server/content.ts")).forget();
});

test("two backstages on one root: the one that came second reads the tasks, runs none, and takes them over once the first has gone", async () => {
  const file = join(config, "two.sqlite"), first = runs(scripted({ cast_derya: [finish("made")] }), new Events(), new Store(file)).r;
  const run = first.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0]] }, gates: { plan: true } });
  // another process runs them and said so just now (any pid: what counts is that it says so)
  const s = new Store(file);
  s.set("owner:runs", { pid: process.ppid, at: Date.now() });
  const log: string[] = [];
  const second = runs(scripted({ cast_derya: () => { log.push("ran"); return finish("made twice"); } }), new Events(), s).r;
  second.resume();
  assert.deepEqual(second.all().map(x => x.id), [run.id], "it reads them");
  assert.throws(() => second.create({ goal: "g2" }), /another backstage \(process \d+\) on this content root runs its tasks/);
  assert.throws(() => second.act(run.id, { action: "continue" }), /another backstage/);
  // the other one stopped saying so long ago (its pid may well be a live process now): the second takes over and goes on
  s.set("owner:runs", { pid: process.ppid, at: Date.now() - 60_000 });
  second.act(run.id, { action: "continue" });
  await second.idle();
  assert.deepEqual([second.get(run.id)!.status, log], ["done", ["ran"]]);
});

test("a read-only backstage never takes the tasks from one that writes", () => {
  const file = join(config, "readonly.sqlite");
  const quiet = new Runs({ store: new Store(file), events: new Events(), write: false, shareCards: false, settings: () => ({ ...DEFAULTS, caps: {} }), model: scripted({}) });
  assert.throws(() => quiet.create({ goal: "g" }), /read-only/);
  assert.equal(new Store(file).get("owner:runs", null), null, "it claimed nothing");
  const writer = runs(scripted({}), new Events(), new Store(file)).r;
  assert.ok(writer.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0]] }, gates: { plan: true } }));
});

test("a proposal turned down in the backstage that does not run the tasks reaches the one that does", async () => {
  const file = join(config, "relay.sqlite"), events = new Events();
  const { r: holder } = runs(scripted({ cast_derya: [finish("made")] }), events, new Store(file));
  const run = holder.create({ goal: "g", plan: { brief: "b", steps: [PLAN.steps[0]] }, gates: false });
  await holder.idle();
  assert.equal(run.steps[0].status, "done");
  // the second backstage (another process: its holder said so just now) hears the person turn a proposal down
  const s = new Store(file), other = new Events();
  s.set("owner:runs", { pid: process.ppid, at: Date.now() });
  new Runs({ store: s, events: other, write: true, shareCards: false, settings: () => ({ ...DEFAULTS, caps: {} }), model: scripted({}) });
  other.emit("proposal", { action: "resolved", accepted: false, proposal: { by: run.by, step: "cast_derya" } });
  // the one that runs them reads it at its next beat (claimed again by this process: it is the holder)
  s.set("owner:runs", { pid: process.pid, at: Date.now() });
  const fast = new Runs({ store: new Store(file), events, write: true, shareCards: false, settings: () => ({ ...DEFAULTS, caps: {} }), model: scripted({}), beatMs: 10 });
  await new Promise(res => setTimeout(res, 50));
  assert.equal(fast.get(run.id)!.steps[0].status, "stale");
});

test("a step stopped mid-turn whose writes are undone starts over when tried again, never told of edits that are gone", async () => {
  const { existsSync: has } = await import("node:fs");
  const { looksOf } = await import("../server/look.ts");
  const seen: Record<string, BaseMessage[][]> = {};
  const { r, events } = runs(scripted({
    x: (m: BaseMessage[]): Turn => {
      const n = m.filter(y => y.getType() === "ai").length;
      // its first turn makes her, then looks (and waits for an editor); after a fresh start it only finishes
      return n === 0 && !m.some(y => /Your last try/.test(String(y.content))) && seen.x.length === 1 ? { calls: [{ name: "create_character", args: { ...derya, id: "dilek11" } }, { name: "look", args: { id: "s1e00" } }] } : finish("done");
    },
  }, { seen }));
  const rids: string[] = [];
  events.on((name, d) => { if (name === "look") rids.push((d as { rid: string }).rid); });
  const run = r.create({ goal: "g", agentEdits: "direct", gates: false, plan: { brief: "b", steps: [{ id: "x", kind: "character", title: "X", brief: "make her", owns: [{ kind: "character", id: "dilek11" }] }] } });
  while (!rids.length) await new Promise(res => setTimeout(res, 10));
  await r.step(run.id, "x", { action: "stop" });
  await r.idle();
  looksOf(events).answer(rids[0], null);
  await new Promise(res => setTimeout(res, 50));
  r.undo(run.id);
  assert.ok(!has(join(root, "characters", "dilek11.json")));
  await r.step(run.id, "x", { action: "retry" });
  await r.idle();
  const last = seen.x.at(-1)!;
  assert.equal(last.filter(y => y.getType() === "ai").length, 0, "a fresh start: no turn of the old try");
  assert.ok(!last.some(y => /saved: add the character dilek11/.test(String(y.content))));
});

test("task ids: unique on the root, numbered after its records, though each backstage has a store of its own", () => {
  const a = runs(scripted({})).r, b = runs(scripted({})).r;
  const one = a.create({ goal: "one", plan: PLAN }), two = b.create({ goal: "two", plan: PLAN });
  const n = (id: string) => Number(/^r(\d+)-[a-z0-9]{3}$/.exec(id)?.[1]);
  assert.ok(n(one.id) > 0 && n(two.id) === n(one.id) + 1, `${one.id} then ${two.id}`);
  for (const x of [one, two]) {
    const rec = JSON.parse(readFileSync(join(root, ".backstage", "tasks", `${x.id}.json`), "utf8"));
    assert.deepEqual([rec.status, rec.goal, rec.steps.length], ["gate", x.goal, PLAN.steps.length]);
  }
  a.act(one.id, { action: "stop" });
  assert.equal(JSON.parse(readFileSync(join(root, ".backstage", "tasks", `${one.id}.json`), "utf8")).status, "stopped", "written again as it changes");
});
