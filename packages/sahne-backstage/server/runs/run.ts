// Runs (Node only): a long task (a week of episodes, with their new cast and places) as a plan of steps, each step a
// sub-agent with a fresh context (agent/graph.ts on a LangGraph thread of its own, checkpointed in the store: saver.ts).
// Every step of a run edits as one author, `run:<id>`, so each builds on the run's pending proposals (proposals.ts), and
// it may create or change only the documents the plan gave it (`owns`; a season and the series are shared). A small
// scheduler, not one graph, runs the plan: a step starts as soon as the steps it needs are done (up to `concurrency` at
// once), a step that asks the person waits alone (the others go on), and gates (after the plan, after the cast and places)
// wait for the person unless they are off. A run in `auto` mode (just do it) writes as it goes, every write checked and
// journaled (journal.ts) so any of it can be undone, with no gates and no proposals, and, if the person says so, no
// questions either. A run started from its goal alone plans itself first: a `plan` step reads the
// series and proposes the plan (propose_plan), which the person sees at the plan gate. A run outlives a closed tab and a restart: the runs are in the store, and a
// step that was running goes on from its last checkpoint.

import { Command } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import type { Store } from "./store.ts";
import { NodeSqliteSaver } from "./saver.ts";
import { Journal, type Undone, type Written } from "./journal.ts";
import type { Events } from "../events.ts";
import { listing, type Kind } from "../content.ts";
import type { AgentEdits, McpOptions } from "../mcp.ts";
import { systemPrompt, usageSummary, type AssistantEvent } from "../assistant.ts";
import { agentGraph } from "../agent/graph.ts";
import { backstage, callTool } from "../agent/tools.ts";
import { BudgetError, guard, record, type Usage } from "../ai/budget.ts";
import { MODELS, claude, local, type Model } from "../ai/models.ts";
import type { ToolDef } from "../ai/provider.ts";
import { readMemory } from "../memory.ts";
import { readSettings, type Settings } from "../settings.ts";

export type StepKind = "plan" | "season" | "character" | "place" | "episode" | "review" | "task";
/** The steps that come before the cast-and-places gate. */
const FIRST: StepKind[] = ["season", "character", "place"];
export type StepStatus = "waiting" | "running" | "asking" | "done" | "failed" | "stopped" | "stale" | "skipped" | "undone";
export interface Owned { kind: Kind; id: string }
export interface PlanStep { id: string; kind: StepKind; title: string; brief: string; /** One plain sentence for the person: what the step makes, without ids or tools. */ about?: string; needs?: string[]; owns?: Owned[]; model?: string }
export interface Plan { brief: string; steps: PlanStep[] }
export interface Question { question: string; options?: string[]; save?: string[] }
export interface Step {
  id: string; kind: StepKind; title: string; brief: string; about?: string; needs: string[]; owns: Owned[]; model?: string;
  status: StepStatus;
  /** Its report for the steps after it (finish_step), or its last words. */
  summary?: string;
  /** The choices it made that the goal left open, in a line each (finish_step), shown to the person beside what it made. */
  decided?: string[];
  /** When it first started working, and when it was done: how long steps take, for the time left. */
  startedAt?: number; endedAt?: number;
  /** What the person told it while it works, not read yet: its next model call reads it (`tell`). */
  told?: string[];
  /** What it asks the person, while it is `asking`. */
  question?: Question;
  error?: string;
  /** It stopped at a budget (the run's, or the day's cap): it goes on by itself once the budget allows. */
  budget?: boolean;
  usd: number;
  attempts: number;
  /** The proposals it made. */
  proposals: string[];
}
export interface Gates { plan: boolean; castAndPlaces: boolean }
export type Gate = keyof Gates;
export interface Run {
  id: string; goal: string;
  /** `check`: proposals, gates and questions; `auto`: it writes as it goes, and the person undoes what they do not want. */
  mode: "check" | "auto";
  /** `never`: its steps decide for themselves and say what they chose, instead of asking the person. */
  asks: "choices" | "never";
  /** The author of every step's edits. */
  by: string;
  status: "running" | "gate" | "paused" | "done" | "stopped";
  /** The gate it waits at, while `gate`. */
  gate?: Gate;
  /** Why it is paused (the budget, a step that failed). */
  why?: string;
  gates: Gates;
  passed: Gate[];
  maxUsd: number; usd: number; concurrency: number;
  agentEdits: AgentEdits;
  brief: string;
  steps: Step[];
  /** What the plan may cost (USD), from its steps: `estimate`. */
  estimateUsd?: number;
  /** The budget was set by the person (else it follows the estimate). */
  maxSet?: boolean;
  at: number;
}

export interface RunsOptions {
  store: Store;
  events: Events;
  write: boolean;
  shareCards: boolean;
  /** Default: the person's settings. */
  settings?: () => Settings;
  /** A step's model (the tests'); default: Opus for planning and review, Sonnet for the rest, or the local model. */
  model?: (step: Step, run: Run) => Model;
  onCall?: McpOptions["onCall"];
}

/** The most rounds of tools one step takes. */
const STEP_TURNS = 60;

/** Why a task the person paused waits; and what a step meets at its next model call then. */
const PAUSED = "you paused it";
class Paused extends Error { constructor() { super("paused"); this.name = "Paused"; } }
const STEP_ASK: ToolDef = { name: "ask_person", description: "Ask the person a question and wait for the answer: this step waits, the task's other steps go on. Use it only for a real choice the goal leaves open (which of two ideas, a name, a fact only the person knows) or for their reply, never to confirm making or changing something: they can undo it. With options, they answer with a button.", schema: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" }, maxItems: 6 } }, required: ["question"] } };
const PLAN_STEPS = { type: "array", items: { type: "object", properties: {
  id: { type: "string", description: "a-z, 0-9, _: cast_derya, place_library, ep_s2e01, review" },
  kind: { type: "string", enum: ["season", "character", "place", "episode", "review", "task"] },
  title: { type: "string" }, brief: { type: "string", description: "What this step makes, in enough detail for an agent who has read only this and the task's brief" },
  about: { type: "string", description: "The same for the person, in one plain sentence they read at the plan gate: what it makes and why, no ids, tools or staging terms (\"Writes the episode where Nima buys bread from Selma, with a polite or blunt way to ask\")" },
  needs: { type: "array", items: { type: "string" }, description: "The steps it must wait for (an episode: the cast and places it uses, and the season)" },
  owns: { type: "array", items: { type: "object", properties: { kind: { type: "string", enum: ["season", "character", "place", "story", "kit_piece", "kit_variant"] }, id: { type: "string" } }, required: ["kind", "id"] }, description: "The documents it creates or changes, by their new ids" },
}, required: ["id", "kind", "title", "brief", "about"] } };
const PROPOSE_PLAN: ToolDef = { name: "propose_plan", description: "Set this task's plan, once you have read what it needs: a brief every step reads (the story, the people and their names, the places, what each episode teaches and how they connect) and the steps. One step for each new season, character and place, one for each episode (owning its story id, and needing the cast, places and season it uses), and a review step at the end that needs every episode. Ids must be new. The person sees the plan before any step runs, unless they turned that off.", schema: { type: "object", properties: { brief: { type: "string" }, steps: PLAN_STEPS }, required: ["brief", "steps"] } };
/** The planner's own brief. */
const PLANNING = "Plan this task. Read the series first (series_overview), the season it goes in, and the cast and places there are (kit_search characters, places), so the plan reuses what exists and makes only what is missing. Pick the new ids (free ones: a character's from its name, episodes the season's next numbers). Then call propose_plan. If something is a real choice for the person that the goal leaves open (names, which season, what the episodes teach), ask_person before you propose; never ask to confirm the plan, as the person sees it.";

/** What a task of these steps may cost, by kind, on Claude (a local model costs nothing): a rough guide, shown at the plan gate. */
export function estimate(steps: Pick<Step, "kind" | "model">[], provider: string): number {
  if (provider === "openai") return 0;
  const USD: Record<StepKind, number> = { plan: 0.6, season: 0.1, character: 0.25, place: 0.3, episode: 0.8, review: 0.8, task: 0.2 };
  return Math.round(steps.reduce((t, s) => t + USD[s.kind] * (s.model && /opus/.test(s.model) && s.kind !== "plan" && s.kind !== "review" ? 2 : 1), 0) * 100) / 100;
}

const FINISH: ToolDef = { name: "finish_step", description: "End this step once its work is made and checked: a short report for the steps after it (the ids you made, names, marks, what they must know), and the choices you made yourself. Then end your turn.", schema: { type: "object", properties: {
  summary: { type: "string", maxLength: 2000 },
  decided: { type: "array", items: { type: "string", maxLength: 200 }, maxItems: 8, description: "Each choice you made that the goal left open, for the person, in one plain line (\"Chose a quiet library rather than a café\"); none when the goal fixed everything" },
}, required: ["summary"] } };

/** What is wrong with a plan, or nothing: ids new and unique, needs that exist and make no cycle, no document made twice. */
export function planProblems(p: Plan): string[] {
  const out: string[] = [], ids = new Set<string>(), made = new Map<string, string>();
  if (!p || typeof p.brief !== "string" || !Array.isArray(p.steps) || !p.steps.length) return ["a plan is { brief, steps: [{ id, kind, title, brief, needs?, owns? }] }, with at least one step"];
  for (const s of p.steps) {
    if (!/^[a-z][a-z0-9_]*$/.test(s.id ?? "")) out.push(`step id ${JSON.stringify(s.id)}: a-z, 0-9 and _`);
    else if (ids.has(s.id)) out.push(`step ${s.id} is there twice`);
    ids.add(s.id);
    for (const o of s.owns ?? []) {
      const k = `${o.kind}:${o.id}`;
      if (made.has(k)) out.push(`${o.kind} ${o.id} is made by ${made.get(k)} and ${s.id}: one step makes it`);
      made.set(k, s.id);
    }
  }
  for (const s of p.steps) for (const n of s.needs ?? []) if (!ids.has(n)) out.push(`step ${s.id} needs ${n}, which is not a step`);
  // a cycle: a step that needs itself, through others
  const by = new Map(p.steps.map(s => [s.id, s.needs ?? []]));
  const reaches = (from: string, to: string, seen = new Set<string>()): boolean => (by.get(from) ?? []).some(n => n === to || (!seen.has(n) && (seen.add(n), reaches(n, to, seen))));
  for (const s of p.steps) if (reaches(s.id, s.id)) { out.push(`step ${s.id} needs itself, through the steps it needs`); break; }
  return out;
}

/** The first words of a step: the task's goal and brief, its own brief, what it makes, and what the steps before it said. */
function stepPrompt(run: Run, s: Step): string {
  const before = run.steps.filter(x => s.needs.includes(x.id));
  if (s.kind === "plan") return [`The task's goal: ${run.goal}`, run.asks === "never" ? s.brief.replace(/ If something is a real choice[^.]*\./, " Where something is a choice (names, what the episodes teach), decide it yourself and say so in the brief.") : s.brief, "Nothing is made in this step: it ends with propose_plan."].join("\n\n");
  return [
    `The task's goal: ${run.goal}`,
    `The plan's brief, shared by every step:\n${run.brief}`,
    `Your step: ${s.title} (${s.kind}, step ${s.id}).\n${s.brief}`,
    s.owns.length ? `You make: ${s.owns.map(o => `${o.kind} ${o.id}`).join(", ")}. The task's other steps make the rest: read their documents, never change them. A season and the series are shared.` : "You make no document of your own: read, check and report.",
    before.length ? `What the steps before yours did:\n${before.map(x => `- ${x.title}: ${x.summary ?? "(no report)"}`).join("\n")}` : "",
    run.agentEdits === "direct" ? "What you make is saved as you make it, after the check; the person can undo any of it, so never ask whether to make or change something." : "Nothing a step proposes is saved until the person accepts it, but every step of this task sees the task's pending proposals as there.",
    `When your work is made and checked, call finish_step with a short report for the steps after yours.${run.asks === "never" ? " Do not wait for the person: decide what is a choice yourself, and list each choice you made in finish_step's decided, one plain line each." : " If the person must decide something the goal leaves open, ask_person: you wait for the answer, and the other steps go on. Never ask to confirm what you make. A smaller choice you made yourself goes in finish_step's decided, one plain line each."}`,
  ].filter(Boolean).join("\n\n");
}

const stepOf = (p: PlanStep): Step => ({ id: p.id, kind: p.kind, title: p.title, brief: p.brief, ...(typeof p.about === "string" && p.about.trim() ? { about: p.about.trim().slice(0, 400) } : {}), needs: p.needs ?? [], owns: p.owns ?? [], ...(p.model ? { model: p.model } : {}), status: "waiting", usd: 0, attempts: 0, proposals: [] });

export class Runs {
  private readonly o: RunsOptions;
  private readonly saver: NodeSqliteSaver;
  readonly journal: Journal;
  private list: Run[];
  private n: number;
  private readonly live = new Map<string, AbortController>();
  private readonly seqs = new Map<string, { seq: number; type?: string }>();

  constructor(o: RunsOptions) {
    this.o = o;
    this.saver = new NodeSqliteSaver(o.store.db);
    this.journal = new Journal(o.store);
    o.store.db.exec("CREATE TABLE IF NOT EXISTS run_log (run TEXT NOT NULL, step TEXT NOT NULL, seq INTEGER NOT NULL, event TEXT NOT NULL, PRIMARY KEY (run, step, seq))");
    const kept = o.store.get<{ n: number; runs: Run[] }>("runs", { n: 0, runs: [] });
    this.n = kept.n; this.list = kept.runs;
    // a person turning down a step's proposal: that step, and the finished steps built on it, need a redo
    o.events.on((name, data) => {
      const d = data as { action?: string; accepted?: boolean; withdrawn?: boolean; proposal?: { by: string; step?: string } };
      if (name !== "proposal" || d.action !== "resolved" || d.accepted || d.withdrawn || !d.proposal?.step) return;
      const run = this.list.find(r => r.by === d.proposal!.by);
      if (run) this.rejected(run, d.proposal.step);
    });
  }

  /** The steps that need `id`, through the steps they need. */
  private after(run: Run, id: string): Step[] {
    const out = new Set<Step>();
    let grew = true;
    while (grew) {
      grew = false;
      for (const s of run.steps) if (!out.has(s) && s.needs.some(n => n === id || [...out].some(o => o.id === n))) { out.add(s); grew = true; }
    }
    return [...out];
  }

  private rejected(run: Run, stepId: string): void {
    const s = run.steps.find(x => x.id === stepId);
    if (!s || s.status === "stale") return;
    s.status = "stale";
    for (const x of this.after(run, stepId)) if (x.status === "done") x.status = "stale";
    if (run.status === "done") run.status = "running";
    this.changed(run);
    this.tick(run);
  }

  all(): Run[] { return this.list; }
  get(id: string): Run | undefined { return this.list.find(r => r.id === id); }
  private keep() { this.o.store.set("runs", { n: this.n, runs: this.list }); }
  private changed(run: Run) { this.keep(); this.o.events.emit("run", { run }); }
  private settings() { return this.o.settings?.() ?? readSettings(); }

  /** Start a run: of a plan, or from its goal alone, a planning step first. */
  create(v: { goal: string; plan?: Plan; gates?: Partial<Gates> | false; maxUsd?: number; concurrency?: number; agentEdits?: AgentEdits; mode?: "check" | "auto"; asks?: "choices" | "never" }): Run {
    const plan: Plan = v.plan ?? { brief: "", steps: [{ id: "plan", kind: "plan", title: "Plan the task", brief: PLANNING }] };
    const bad = planProblems(plan);
    if (bad.length) throw new Error(`the plan: ${bad.join("; ")}`);
    const s = this.settings(), id = `r${++this.n}`, mode = v.mode ?? s.runMode ?? "check";
    // checking with the person shows the plan first; after that it stops only for a real choice (a new person or place is
    // not one: it can be undone), unless the gates say otherwise
    const gates: Gates = v.gates === false || mode === "auto" ? { plan: false, castAndPlaces: false } : { plan: v.gates?.plan ?? true, castAndPlaces: v.gates?.castAndPlaces ?? false };
    const run: Run = {
      id, goal: v.goal, mode, asks: v.asks ?? (mode === "auto" ? "never" : "choices"), by: `run:${id}`, status: "running", gates, passed: [], usd: 0,
      maxUsd: v.maxUsd ?? 10, ...(v.maxUsd !== undefined ? { maxSet: true } : {}), concurrency: v.concurrency ?? (s.provider === "openai" ? 1 : 3),
      // a task writes straight in, journaled to undo; proposals only when asked for (the server's setting is for its other agents)
      agentEdits: mode === "auto" ? "direct" : v.agentEdits ?? "direct", brief: plan.brief, at: Date.now(),
      steps: plan.steps.map(stepOf),
    };
    if (v.plan) this.estimated(run);
    this.list.push(run);
    this.changed(run);
    this.tick(run);
    return run;
  }

  /** The plan's estimate, and the budget from it when the person set none: three times the estimate, at least $2. */
  private estimated(run: Run): void {
    run.estimateUsd = estimate(run.steps.filter(s => s.kind !== "plan"), this.settings().provider);
    if (!run.maxSet) run.maxUsd = Math.max(2, Math.round(run.estimateUsd * 3 * 100) / 100 + run.usd);
  }

  /** A plan for the steps that have not started (the planner's, or the person's at the plan gate): checked, then set. */
  private setPlan(run: Run, plan: Plan): string[] {
    const kept = run.steps.filter(s => s.kind === "plan" || s.status !== "waiting");
    const planner = kept.find(s => s.kind === "plan");
    const steps = plan.steps.map(p => ({ ...p, needs: [...new Set([...(p.needs ?? []), ...(planner ? [planner.id] : [])])] }));
    const bad = planProblems({ brief: plan.brief, steps: [...kept, ...steps] });
    if (bad.length) return bad;
    run.brief = plan.brief;
    run.steps = [...kept, ...steps.map(stepOf)];
    this.estimated(run);
    return [];
  }

  /** After a restart: every run that was going goes on, its running steps from their last checkpoint. */
  resume(): void {
    for (const run of this.list) {
      if (run.status === "done" || run.status === "stopped") continue;
      for (const s of run.steps) if (s.status === "running") s.status = "waiting";
      this.tick(run);
    }
  }

  /**
   * Undo what a run wrote: everything, newest first, or these documents with what the steps after theirs built on them
   * (undoing a character undoes the episodes that use her). A document someone changed since the run is kept. The steps
   * whose writes are all undone are `undone`, and may be done again.
   */
  undo(id: string, items?: { kind: Kind; id: string }[]): { run: Run; undone: Undone[]; kept: Written[] } {
    const run = this.need(id), all = this.journal.of(run.id);
    if (run.steps.some(s => s.status === "running" || s.status === "asking")) throw new Error("stop the run first: its steps are still working");
    let which = all;
    if (items) {
      // the documents named, and everything the steps after theirs wrote (they built on them)
      const named = (w: Written) => items.some(it => it.kind === w.kind && it.id === w.id), later = new Set<string>();
      for (const it of items) {
        const w = all.find(x => x.kind === it.kind && x.id === it.id);
        if (!w) throw new Error(`run ${id} wrote no ${it.kind} ${it.id} that is still there to undo`);
        for (const x of this.after(run, w.step)) later.add(x.id);
      }
      which = all.filter(w => named(w) || later.has(w.step));
    }
    const r = this.journal.undo(run.id, which);
    for (const u of r.undone) this.o.events.emit("doc", { kind: u.kind, id: u.id, mtime: u.mtime ?? 0, by: run.by, ...(u.removed ? { removed: true } : {}) });
    // a step none of whose writes are left is undone; it may be done again
    const left = this.journal.of(run.id);
    for (const s of run.steps) if (s.status === "done" && which.some(w => w.step === s.id) && !left.some(w => w.step === s.id)) s.status = "undone";
    this.changed(run);
    return { run, ...r };
  }

  /** The person's answer at a gate (go on, or stop), or new gates. */
  act(id: string, a: { action: "continue" } | { action: "pause" } | { action: "stop" } | { action: "gates"; gates: Partial<Gates> } | { action: "budget"; maxUsd: number } | { action: "plan"; plan: Plan }): Run {
    const run = this.need(id);
    if (a.action === "plan") {
      if (run.status !== "gate" || run.gate !== "plan") throw new Error("the plan can change at the plan gate only");
      const bad = this.setPlan(run, a.plan);
      if (bad.length) throw new Error(`the plan: ${bad.join("; ")}`);
      this.changed(run);
      return run;
    }
    if (a.action === "stop") {
      run.status = "stopped";
      for (const s of run.steps) { if (s.status === "running") this.live.get(`${run.id}:${s.id}`)?.abort(); if (s.status === "waiting" || s.status === "asking" || s.status === "running") s.status = "stopped"; }
      this.changed(run);
      return run;
    }
    // paused by the person: no step starts, and a working one waits before its next model call (Paused, in go())
    if (a.action === "pause") {
      if (run.status !== "running") throw new Error(`the task is ${run.status}: only a working task pauses`);
      run.status = "paused"; run.why = PAUSED;
      this.changed(run);
      return run;
    }
    if (a.action === "continue" && run.status === "gate" && run.gate) { run.passed.push(run.gate); delete run.gate; run.status = "running"; }
    if (a.action === "gates") run.gates = { ...run.gates, ...a.gates };
    if (a.action === "budget") { run.maxUsd = a.maxUsd; run.maxSet = true; if (run.status === "paused") { run.status = "running"; delete run.why; } }
    if (a.action === "continue" && run.status === "paused") { run.status = "running"; delete run.why; }
    if (a.action === "budget" || a.action === "continue") this.healBudget(run);
    this.changed(run);
    this.tick(run);
    return run;
  }

  /** The person answers a step's question, stops it, or has it try again. */
  async step(id: string, stepId: string, a: { action: "answer"; answer: string } | { action: "tell"; text: string } | { action: "stop" } | { action: "retry" } | { action: "redo"; note?: string; owns?: Owned[] }): Promise<Run> {
    const run = this.need(id), s = run.steps.find(x => x.id === stepId);
    if (!s) throw new Error(`run ${id} has no step ${stepId}`);
    if (a.action === "stop") { this.live.get(`${run.id}:${s.id}`)?.abort(); s.status = "stopped"; delete s.question; }
    else if (a.action === "tell") {
      // read at its next model call; a step that asks takes an answer instead
      const text = String(a.text ?? "").trim().slice(0, 1000);
      if (!text) throw new Error("say something to tell it");
      if (s.status !== "running" && s.status !== "waiting") throw new Error(`step ${stepId} is ${s.status}: tell a step while it works`);
      (s.told ??= []).push(text);
    }
    else if (a.action === "redo") {
      // from its start again, with what the person said; its proposals still waiting are what it builds on
      if (s.status === "running" || s.status === "asking") throw new Error(`step ${stepId} is ${s.status}: stop it first`);
      await this.saver.deleteThread(`${run.by}:${s.id}`);
      s.status = "waiting"; s.attempts = 0; delete s.error; delete s.summary; delete s.question;
      if (a.note?.trim()) s.brief = `${s.brief}\n\nDone again, because: ${a.note.trim()}`;
      // what it makes, changed by the person (an id that cannot be made): no other step may make the same
      if (a.owns) {
        const taken = a.owns.find(o => run.steps.some(x => x !== s && x.owns.some(y => y.kind === o.kind && y.id === o.id)));
        if (taken) throw new Error(`${taken.kind} ${taken.id} is another step's to make`);
        s.owns = a.owns;
      }
      // the steps after it read its report again: those that have not started wait for it
      for (const x of this.after(run, s.id)) if (x.status === "done") x.status = "stale";
      if (run.status === "paused" || run.status === "done") { run.status = "running"; delete run.why; }
    }
    else if (a.action === "retry") { if (s.status === "failed" || s.status === "stopped") { s.status = "waiting"; s.attempts = 0; delete s.error; if (run.status === "paused") { run.status = "running"; delete run.why; } } }
    else {
      if (s.status !== "asking") throw new Error(`step ${stepId} is not asking`);
      delete s.question;
      this.changed(run);
      void this.go(run, s, new Command({ resume: a.answer }));
      return run;
    }
    this.changed(run);
    this.tick(run);
    return run;
  }

  /** A step's log from `after` on: what it said, thought and did. */
  log(id: string, stepId: string, after = 0): { seq: number; event: AssistantEvent }[] {
    return (this.o.store.db.prepare("SELECT seq, event FROM run_log WHERE run = ? AND step = ? AND seq > ? ORDER BY seq").all(id, stepId, after) as { seq: number; event: string }[]).map(r => ({ seq: r.seq, event: JSON.parse(r.event) as AssistantEvent }));
  }

  /** Wait until no step of any run is running (the tests). */
  async idle(): Promise<void> { while (this.live.size) await new Promise(r => setTimeout(r, 10)); }

  private need(id: string): Run { const r = this.get(id); if (!r) throw new Error(`there is no run ${id}`); return r; }

  /** The steps a budget stopped go on when it allows again: the run's own, and the day's and month's caps. */
  private healBudget(run: Run): boolean {
    const stopped = run.steps.filter(s => s.budget && (s.status === "failed" || s.status === "waiting"));
    if (!stopped.length || run.usd >= run.maxUsd) return false;
    try { guard(this.settings().caps); } catch { return false; }
    for (const s of stopped) { s.status = "waiting"; s.attempts = 0; delete s.error; delete s.budget; }
    return true;
  }

  /** Start what can start; note where the run stands. */
  private tick(run: Run): void {
    if (run.status === "paused" && this.healBudget(run)) { run.status = "running"; delete run.why; }
    if (run.status === "done" || run.status === "stopped" || run.status === "paused") return;
    const steps = run.steps, done = (id: string) => steps.find(s => s.id === id)?.status === "done";
    if (steps.every(s => s.status === "done" || s.status === "skipped" || s.status === "undone")) { run.status = "done"; delete run.gate; this.changed(run); return; }
    // a run that plans itself runs its planner first; then the plan waits at its gate
    const planning = steps.some(s => s.kind === "plan" && s.status !== "done" && s.status !== "skipped");
    if (!planning && run.gates.plan && !run.passed.includes("plan")) { if (run.status !== "gate") { run.status = "gate"; run.gate = "plan"; this.changed(run); } return; }
    if (run.usd >= run.maxUsd) { run.status = "paused"; run.why = `its budget, $${run.maxUsd.toFixed(2)}, is spent: raise it to go on`; this.changed(run); return; }
    const first = steps.filter(s => FIRST.includes(s.kind));
    const castGate = run.gates.castAndPlaces && first.length > 0 && !run.passed.includes("castAndPlaces");
    const ready = steps.filter(s => s.status === "waiting" && s.needs.every(done) && !(castGate && !FIRST.includes(s.kind)) && (!planning || s.kind === "plan"));
    const running = steps.filter(s => s.status === "running").length;
    for (const s of ready.slice(0, Math.max(0, run.concurrency - running))) void this.go(run, s);
    const busy = steps.some(s => s.status === "running" || s.status === "asking");
    if (!busy && !ready.length) {
      // the cast and places are made, and the rest waits for the person's look
      if (castGate && first.every(s => s.status === "done") && steps.some(s => s.status === "waiting")) { run.status = "gate"; run.gate = "castAndPlaces"; this.changed(run); return; }
      const stuck = steps.filter(s => s.status === "failed" || s.status === "stopped" || s.status === "stale");
      if (stuck.length) { run.status = "paused"; run.why = `${stuck.map(s => s.title).join(", ")} ${stuck.length > 1 ? "need" : "needs"} you: try again, or stop the run`; this.changed(run); }
    }
  }

  private write(run: Run, s: Step, e: AssistantEvent): void {
    const key = `${run.id}:${s.id}`;
    let at = this.seqs.get(key);
    if (!at) {
      const row = this.o.store.db.prepare("SELECT MAX(seq) AS seq FROM run_log WHERE run = ? AND step = ?").get(run.id, s.id) as { seq: number | null };
      at = { seq: row.seq ?? 0 }; this.seqs.set(key, at);
    }
    // text and thinking come in small pieces: one row each, grown as they come
    if ((e.type === "text" || e.type === "thinking") && at.type === e.type) {
      const row = this.o.store.db.prepare("SELECT event FROM run_log WHERE run = ? AND step = ? AND seq = ?").get(run.id, s.id, at.seq) as { event: string };
      const grown = JSON.parse(row.event) as { text: string };
      grown.text += e.text;
      this.o.store.db.prepare("UPDATE run_log SET event = ? WHERE run = ? AND step = ? AND seq = ?").run(JSON.stringify(grown), run.id, s.id, at.seq);
    } else {
      at.seq++;
      // each row says when it came, so a log read later shows how long each thought and call took
      this.o.store.db.prepare("INSERT INTO run_log (run, step, seq, event) VALUES (?, ?, ?, ?)").run(run.id, s.id, at.seq, JSON.stringify({ ...e, at: Date.now() }));
    }
    at.type = e.type;
    this.o.events.emit("run", { id: run.id, step: s.id, seq: at.seq, event: { ...e, at: Date.now() } });
  }

  private modelOf(run: Run, s: Step): Model {
    if (this.o.model) return this.o.model(s, run);
    const st = this.settings();
    if (st.provider === "openai") return local({ baseUrl: st.baseUrl, model: s.model ?? st.model });
    return claude(s.model ?? (s.kind === "plan" || s.kind === "review" ? MODELS.full : MODELS.quick), 32000);
  }

  /** Run a step: from its start, from its last checkpoint, or with the person's answer. */
  private async go(run: Run, s: Step, resume?: Command): Promise<void> {
    const key = `${run.id}:${s.id}`, thread = { configurable: { thread_id: `${run.by}:${s.id}` } };
    if (this.live.has(key)) return;
    const stop = new AbortController();
    this.live.set(key, stop);
    s.status = "running"; s.startedAt ??= Date.now(); delete s.endedAt;
    this.changed(run);
    let bs: Awaited<ReturnType<typeof backstage>> | null = null, failed: string | undefined;
    try {
      const st = this.settings(), model = this.modelOf(run, s);
      bs = await backstage({ write: this.o.write, agentEdits: run.agentEdits, shareCards: this.o.shareCards, events: this.o.events, by: run.by, onCall: this.o.onCall, step: { id: s.id, owns: s.owns }, journal: (before, saved) => this.journal.record(run.id, s.id, before, saved) }, run.by);
      const mcp = bs.client;
      const system = `${systemPrompt({ agentEdits: run.agentEdits, writable: this.o.write, shareCards: this.o.shareCards, web: null, notes: readMemory() })}\n\nYou are one step of a task: a long piece of work split into steps, each done by its own agent with a fresh context. Do your step well and only your step; the person reviews the task's work by step.${run.asks === "never" ? " The person asked not to be asked: where something is a choice (a name, a wording), decide it yourself and say in your report what you chose, so they can change it later." : ""}${run.agentEdits === "direct" ? " Your edits are saved as you make them, each after the check, and the person can undo any of them." : ""}`;
      const graph = agentGraph({
        model, system, tools: [...bs.tools, ...(run.asks === "never" ? [] : [STEP_ASK]), s.kind === "plan" ? PROPOSE_PLAN : FINISH], maxTurns: STEP_TURNS, ask: "wait",
        before: () => {
          guard(st.caps);
          if (run.usd >= run.maxUsd) throw new BudgetError(`the task's budget, $${run.maxUsd.toFixed(2)}, is spent`);
          if (run.status === "paused" && run.why === PAUSED) throw new Paused();
        },
        inbox: () => { const t = s.told ?? []; delete s.told; if (t.length) this.keep(); return t; },
        after: (u: Usage) => {
          const e = record(model.id, model.model, u);
          s.usd += e.usd; run.usd += e.usd;
          this.keep();
          this.o.events.emit("usage", usageSummary(st.caps));
        },
        run: async c => {
          if (c.name === "propose_plan" && s.kind === "plan") {
            const v = c.input as { brief?: unknown; steps?: unknown };
            const steps = Array.isArray(v.steps) ? v.steps as PlanStep[] : [];
            // a retired character id is never made again: say so before any step finds out
            const retired = new Set(listing().retired), gone = steps.flatMap(x => x.owns ?? []).filter(o => o.kind === "character" && retired.has(o.id)).map(o => o.id);
            const bad = gone.length ? gone.map(id => `the character id ${id} is retired (a character that was deleted): pick another id, and use it everywhere in the brief`) : this.setPlan(run, { brief: String(v.brief ?? ""), steps });
            if (bad.length) return { text: `The plan is not set; fix this and propose it again:\n${bad.map(b => `- ${b}`).join("\n")}`, isError: true };
            s.summary = `The plan: ${run.steps.filter(x => x.kind !== "plan").map(x => x.title).join("; ")}.`;
            this.changed(run);
            return { text: `The plan is set: ${run.steps.length - 1} steps, about $${run.estimateUsd?.toFixed(2)}. ${run.gates.plan ? "The person sees it before any step runs." : "The steps start now."}`, isError: false, end: true };
          }
          if (c.name === "finish_step") {
            const v = c.input as { summary?: unknown; decided?: unknown };
            s.summary = String(v.summary ?? "").slice(0, 2000);
            const decided = Array.isArray(v.decided) ? v.decided.filter((d): d is string => typeof d === "string" && !!d.trim()).map(d => d.trim().slice(0, 200)).slice(0, 8) : [];
            if (decided.length) s.decided = decided; else delete s.decided;
            this.keep(); return { text: "Noted: your step is done.", isError: false, end: true }; }
          return callTool(mcp, c);
        },
      }, this.saver);
      // from its start, unless it has a checkpoint to go on from: one that waits (a question, a model call a pause or a
      // failure cut short) goes on from there; one whose graph ended without the step being done (an answer cut off, a
      // refusal, its rounds used up) runs the model again, told why, with its rounds counted afresh
      const begun = !!(await this.saver.getTuple(thread)), ended = begun && !resume && !(await graph.getState(thread)).next.length;
      const input = resume ?? (!begun ? { messages: [new HumanMessage(stepPrompt(run, s))] }
        : ended ? { messages: [new HumanMessage(`Your last try stopped before your step was done${s.error ? ` (${s.error})` : ""}. Go on from where you are${s.kind === "plan" ? ", and end with propose_plan" : ", and end with finish_step"}.`)], stopped: null, turns: 0 }
        : null);
      for await (const e of await graph.stream(input, { ...thread, streamMode: "custom", signal: stop.signal, recursionLimit: STEP_TURNS * 3 + 5, durability: "sync" })) {
        const ev = e as AssistantEvent;
        if (ev.type === "proposal" && !s.proposals.includes(ev.id)) s.proposals.push(ev.id);
        if (ev.type === "error") failed = ev.message;
        this.write(run, s, ev);
      }
      if (stop.signal.aborted) throw Object.assign(new Error("stopped"), { name: "AbortError" });
      const state = await graph.getState(thread);
      const asked = state.tasks.flatMap(t => t.interrupts ?? [])[0];
      if (asked) { const { type: _t, ...q } = asked.value as Question & { type?: string }; s.status = "asking"; s.question = q; }
      else if (failed) throw new Error(failed);
      else {
        const last = [...(state.values.messages ?? [])].reverse().find(m => m.getType() === "ai");
        s.summary ??= (last ? String(typeof last.content === "string" ? last.content : (last.content as { type: string; text?: string }[]).filter(b => b.type === "text").map(b => b.text).join("")).slice(0, 2000) : undefined);
        s.status = "done"; s.endedAt = Date.now(); delete s.error;
        await this.saver.deleteThread(thread.configurable.thread_id);
      }
    } catch (e) {
      if (stop.signal.aborted || (e as Error).name === "AbortError") { if (s.status === "running") s.status = "stopped"; }
      // paused: it waits at its checkpoint, from before this model call, and goes on from there with Go on
      else if (e instanceof Paused || (e as Error).name === "Paused") s.status = "waiting";
      else {
        s.attempts++;
        s.error = (e as Error).message;
        this.write(run, s, { type: "error", message: s.error });
        // a budget spent is not tried again; anything else once, from its last checkpoint
        if (e instanceof BudgetError) s.budget = true;
        s.status = e instanceof BudgetError || s.attempts >= 2 ? "failed" : "waiting";
      }
    } finally {
      await bs?.close();
      this.live.delete(key);
      this.changed(run);
      this.tick(run);
    }
  }
}
