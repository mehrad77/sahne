// Runs (Node only): a long task (a week of episodes, with their new cast and places) as a plan of steps, each step a
// sub-agent with a fresh context (agent/graph.ts on a LangGraph thread of its own, checkpointed in the store: saver.ts).
// Every step of a run edits as one author, `run:<id>`, so each builds on the run's pending proposals (proposals.ts), and
// it may create or change only the documents the plan gave it (`owns`; a season and the series are shared). A small
// scheduler, not one graph, runs the plan: a step starts as soon as the steps it needs are done (up to `concurrency` at
// once), a step that asks the person waits alone (the others go on), and gates (after the plan, after the cast and places)
// wait for the person unless they are off. A run started from its goal alone plans itself first: a `plan` step reads the
// series and proposes the plan (propose_plan), which the person sees at the plan gate. A run outlives a closed tab and a restart: the runs are in the store, and a
// step that was running goes on from its last checkpoint.

import { Command } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import type { Store } from "./store.ts";
import { NodeSqliteSaver } from "./saver.ts";
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
export type StepStatus = "waiting" | "running" | "asking" | "done" | "failed" | "stopped" | "stale" | "skipped";
export interface Owned { kind: Kind; id: string }
export interface PlanStep { id: string; kind: StepKind; title: string; brief: string; needs?: string[]; owns?: Owned[]; model?: string }
export interface Plan { brief: string; steps: PlanStep[] }
export interface Question { question: string; options?: string[]; save?: string[] }
export interface Step {
  id: string; kind: StepKind; title: string; brief: string; needs: string[]; owns: Owned[]; model?: string;
  status: StepStatus;
  /** Its report for the steps after it (finish_step), or its last words. */
  summary?: string;
  /** What it asks the person, while it is `asking`. */
  question?: Question;
  error?: string;
  usd: number;
  attempts: number;
  /** The proposals it made. */
  proposals: string[];
}
export interface Gates { plan: boolean; castAndPlaces: boolean }
export type Gate = keyof Gates;
export interface Run {
  id: string; goal: string;
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

const STEP_ASK: ToolDef = { name: "ask_person", description: "Ask the person a question and wait for the answer: this step waits, the run's other steps go on. Use it for a real choice (a name, what they study, which of two places), not for what you can decide. With options, they answer with a button.", schema: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" }, maxItems: 6 } }, required: ["question"] } };
const PLAN_STEPS = { type: "array", items: { type: "object", properties: {
  id: { type: "string", description: "a-z, 0-9, _: cast_derya, place_library, ep_s2e01, review" },
  kind: { type: "string", enum: ["season", "character", "place", "episode", "review", "task"] },
  title: { type: "string" }, brief: { type: "string", description: "What this step makes, in enough detail for an agent who has read only this and the run's brief" },
  needs: { type: "array", items: { type: "string" }, description: "The steps it must wait for (an episode: the cast and places it uses, and the season)" },
  owns: { type: "array", items: { type: "object", properties: { kind: { type: "string", enum: ["season", "character", "place", "story", "kit_piece", "kit_variant"] }, id: { type: "string" } }, required: ["kind", "id"] }, description: "The documents it creates or changes, by their new ids" },
}, required: ["id", "kind", "title", "brief"] } };
const PROPOSE_PLAN: ToolDef = { name: "propose_plan", description: "Set this run's plan, once you have read what it needs: a brief every step reads (the story, the people and their names, the places, what each episode teaches and how they connect) and the steps. One step for each new season, character and place, one for each episode (owning its story id, and needing the cast, places and season it uses), and a review step at the end that needs every episode. Ids must be new. The person sees the plan before any step runs, unless they turned that off.", schema: { type: "object", properties: { brief: { type: "string" }, steps: PLAN_STEPS }, required: ["brief", "steps"] } };
/** The planner's own brief. */
const PLANNING = "Plan this run. Read the series first (series_overview), the season it goes in, and the cast and places there are (kit_search characters, places), so the plan reuses what exists and makes only what is missing. Pick the new ids (free ones: a character's from its name, episodes the season's next numbers). Then call propose_plan. If something is a real choice for the person (names, which season, what the episodes teach), ask_person before you propose.";

/** What a run of these steps may cost, by kind, on Claude (a local model costs nothing): a rough guide, shown at the plan gate. */
export function estimate(steps: Pick<Step, "kind" | "model">[], provider: string): number {
  if (provider === "openai") return 0;
  const USD: Record<StepKind, number> = { plan: 0.6, season: 0.1, character: 0.25, place: 0.3, episode: 0.8, review: 0.8, task: 0.2 };
  return Math.round(steps.reduce((t, s) => t + USD[s.kind] * (s.model && /opus/.test(s.model) && s.kind !== "plan" && s.kind !== "review" ? 2 : 1), 0) * 100) / 100;
}

const FINISH: ToolDef = { name: "finish_step", description: "End this step once its work is made and checked: a short report for the steps after it (the ids you made, names, marks, what they must know). Then end your turn.", schema: { type: "object", properties: { summary: { type: "string", maxLength: 2000 } }, required: ["summary"] } };

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

/** The first words of a step: the run's goal and brief, its own brief, what it makes, and what the steps before it said. */
function stepPrompt(run: Run, s: Step): string {
  const before = run.steps.filter(x => s.needs.includes(x.id));
  if (s.kind === "plan") return [`The run's goal: ${run.goal}`, s.brief, "Nothing is made in this step: it ends with propose_plan."].join("\n\n");
  return [
    `The run's goal: ${run.goal}`,
    `The plan's brief, shared by every step:\n${run.brief}`,
    `Your step: ${s.title} (${s.kind}, step ${s.id}).\n${s.brief}`,
    s.owns.length ? `You make: ${s.owns.map(o => `${o.kind} ${o.id}`).join(", ")}. The run's other steps make the rest: read their documents, never change them. A season and the series are shared.` : "You make no document of your own: read, check and report.",
    before.length ? `What the steps before yours did:\n${before.map(x => `- ${x.title}: ${x.summary ?? "(no report)"}`).join("\n")}` : "",
    "Nothing a step proposes is saved until the person accepts it, but every step of this run sees the run's pending proposals as there. When your work is made and checked, call finish_step with a short report for the steps after yours. If the person must decide something, ask_person: you wait for the answer, and the other steps go on.",
  ].filter(Boolean).join("\n\n");
}

const stepOf = (p: PlanStep): Step => ({ id: p.id, kind: p.kind, title: p.title, brief: p.brief, needs: p.needs ?? [], owns: p.owns ?? [], ...(p.model ? { model: p.model } : {}), status: "waiting", usd: 0, attempts: 0, proposals: [] });

export class Runs {
  private readonly o: RunsOptions;
  private readonly saver: NodeSqliteSaver;
  private list: Run[];
  private n: number;
  private readonly live = new Map<string, AbortController>();
  private readonly seqs = new Map<string, { seq: number; type?: string }>();

  constructor(o: RunsOptions) {
    this.o = o;
    this.saver = new NodeSqliteSaver(o.store.db);
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
  create(v: { goal: string; plan?: Plan; gates?: Partial<Gates> | false; maxUsd?: number; concurrency?: number; agentEdits?: AgentEdits }): Run {
    const plan: Plan = v.plan ?? { brief: "", steps: [{ id: "plan", kind: "plan", title: "Plan the run", brief: PLANNING }] };
    const bad = planProblems(plan);
    if (bad.length) throw new Error(`the plan: ${bad.join("; ")}`);
    const s = this.settings(), id = `r${++this.n}`;
    const gates: Gates = v.gates === false ? { plan: false, castAndPlaces: false } : { plan: v.gates?.plan ?? true, castAndPlaces: v.gates?.castAndPlaces ?? true };
    const run: Run = {
      id, goal: v.goal, by: `run:${id}`, status: "running", gates, passed: [], usd: 0,
      maxUsd: v.maxUsd ?? 10, ...(v.maxUsd !== undefined ? { maxSet: true } : {}), concurrency: v.concurrency ?? (s.provider === "openai" ? 1 : 3),
      agentEdits: v.agentEdits ?? s.agentEdits ?? "proposals", brief: plan.brief, at: Date.now(),
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

  /** The person's answer at a gate (go on, or stop), or new gates. */
  act(id: string, a: { action: "continue" } | { action: "stop" } | { action: "gates"; gates: Partial<Gates> } | { action: "budget"; maxUsd: number } | { action: "plan"; plan: Plan }): Run {
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
    if (a.action === "continue" && run.status === "gate" && run.gate) { run.passed.push(run.gate); delete run.gate; run.status = "running"; }
    if (a.action === "gates") run.gates = { ...run.gates, ...a.gates };
    if (a.action === "budget") { run.maxUsd = a.maxUsd; run.maxSet = true; if (run.status === "paused") { run.status = "running"; delete run.why; } }
    if (a.action === "continue" && run.status === "paused") { run.status = "running"; delete run.why; }
    this.changed(run);
    this.tick(run);
    return run;
  }

  /** The person answers a step's question, stops it, or has it try again. */
  async step(id: string, stepId: string, a: { action: "answer"; answer: string } | { action: "stop" } | { action: "retry" } | { action: "redo"; note?: string }): Promise<Run> {
    const run = this.need(id), s = run.steps.find(x => x.id === stepId);
    if (!s) throw new Error(`run ${id} has no step ${stepId}`);
    if (a.action === "stop") { this.live.get(`${run.id}:${s.id}`)?.abort(); s.status = "stopped"; delete s.question; }
    else if (a.action === "redo") {
      // from its start again, with what the person said; its proposals still waiting are what it builds on
      if (s.status === "running" || s.status === "asking") throw new Error(`step ${stepId} is ${s.status}: stop it first`);
      await this.saver.deleteThread(`${run.by}:${s.id}`);
      s.status = "waiting"; s.attempts = 0; delete s.error; delete s.summary; delete s.question;
      if (a.note?.trim()) s.brief = `${s.brief}\n\nDone again, because: ${a.note.trim()}`;
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

  /** Start what can start; note where the run stands. */
  private tick(run: Run): void {
    if (run.status === "done" || run.status === "stopped" || run.status === "paused") return;
    const steps = run.steps, done = (id: string) => steps.find(s => s.id === id)?.status === "done";
    if (steps.every(s => s.status === "done" || s.status === "skipped")) { run.status = "done"; delete run.gate; this.changed(run); return; }
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
    s.status = "running";
    this.changed(run);
    let bs: Awaited<ReturnType<typeof backstage>> | null = null, failed: string | undefined;
    try {
      const st = this.settings(), model = this.modelOf(run, s);
      bs = await backstage({ write: this.o.write, agentEdits: run.agentEdits, shareCards: this.o.shareCards, events: this.o.events, by: run.by, onCall: this.o.onCall, step: { id: s.id, owns: s.owns } }, run.by);
      const mcp = bs.client;
      const system = `${systemPrompt({ agentEdits: run.agentEdits, writable: this.o.write, shareCards: this.o.shareCards, web: null, notes: readMemory() })}\n\nYou are one step of a run: a long task split into steps, each done by its own agent with a fresh context. Do your step well and only your step; the person reviews the run's work by step.`;
      const graph = agentGraph({
        model, system, tools: [...bs.tools, STEP_ASK, s.kind === "plan" ? PROPOSE_PLAN : FINISH], maxTurns: STEP_TURNS, ask: "wait",
        before: () => {
          guard(st.caps);
          if (run.usd >= run.maxUsd) throw new BudgetError(`the run's budget, $${run.maxUsd.toFixed(2)}, is spent`);
        },
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
          if (c.name === "finish_step") { s.summary = String((c.input as { summary?: unknown }).summary ?? "").slice(0, 2000); this.keep(); return { text: "Noted: your step is done.", isError: false, end: true }; }
          return callTool(mcp, c);
        },
      }, this.saver);
      // from its start, unless it has a checkpoint to go on from
      const begun = !!(await this.saver.getTuple(thread));
      const input = resume ?? (begun ? null : { messages: [new HumanMessage(stepPrompt(run, s))] });
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
        s.status = "done";
        await this.saver.deleteThread(thread.configurable.thread_id);
      }
    } catch (e) {
      if (stop.signal.aborted || (e as Error).name === "AbortError") { if (s.status === "running") s.status = "stopped"; }
      else {
        s.attempts++;
        s.error = (e as Error).message;
        this.write(run, s, { type: "error", message: s.error });
        // a budget spent is not tried again; anything else once, from its last checkpoint
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
