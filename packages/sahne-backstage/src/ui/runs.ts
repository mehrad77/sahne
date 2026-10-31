// Runs (#/agents/runs, #/agents/runs/<id>): a long task the assistant does in steps (server/runs/run.ts). The list of
// runs; and one run: where it stands (a gate to pass, a pause and why, what it cost), the plan's brief, and each step
// with its status, what it makes, what it needs, its cost, its question when it asks you, and its work as it goes (its
// log read as a conversation: the chat's own parts), and its proposals to accept or turn down as one: accepting a step
// accepts what it needs first (events.ts `neededFirst`), and turning one down marks it and the steps built on it for a redo.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { route, say } from "../store.ts";
import { act, actStep, loadLog, logs, runs, type Run, type RunStep } from "../runs.ts";
import { accept, acceptAndSave, neededFirst, proposals, reject, turnedDown, type Proposal } from "../events.ts";
import { openProposal } from "./proposed.ts";
import { Answer } from "./assistant.ts";
import { ago } from "./agents.ts";
import { Chip, Icon } from "./kit/index.ts";
import { Markdown } from "./md.ts";

const usd = (n: number) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
const RUN_WORD: Record<Run["status"], string> = { running: "running", gate: "waits for you", paused: "paused", done: "done", stopped: "stopped" };
const STEP_WORD: Record<RunStep["status"], string> = { waiting: "waiting", running: "working", asking: "asks you", done: "done", failed: "failed", stopped: "stopped", stale: "needs a redo", skipped: "skipped" };
const STEP_TONE: Record<RunStep["status"], "" | "ok" | "warn" | "bad"> = { waiting: "", running: "ok", asking: "warn", done: "ok", failed: "bad", stopped: "warn", stale: "warn", skipped: "" };
const KIND_WORD: Record<string, string> = { plan: "plan", season: "season", character: "character", place: "place", episode: "episode", review: "review", task: "task" };
const waitsForYou = (r: Run) => r.status === "gate" || r.steps.some(s => s.status === "asking");

/** Runs: every run, newest first; or one run. */
export function RunsTab() {
  const id = route.value[2];
  if (id) return html`<${RunView} id=${id} />`;
  const list = [...runs.value].sort((a, b) => b.at - a.at);
  if (!list.length) return html`<p class="note">No run yet. Ask the assistant for a long task (a week of episodes, a new season with its people and places), and it offers one: a card you start.</p>`;
  return html`<ol class="runs-list">${list.map(r => {
    const done = r.steps.filter(s => s.status === "done").length;
    return html`<li><a class="card run-card" href=${`#/agents/runs/${r.id}`}>
      <span class="row"><b class="grow">${r.goal.length > 140 ? `${r.goal.slice(0, 140)}…` : r.goal}</b><${Chip} tone=${waitsForYou(r) ? "warn" : r.status === "done" ? "ok" : r.status === "paused" ? "bad" : ""}>${waitsForYou(r) ? "waits for you" : RUN_WORD[r.status]}</${Chip}></span>
      <span class="note">${r.id} · ${done} of ${r.steps.length} steps · ${usd(r.usd)} · ${ago(r.at)}</span></a></li>`;
  })}</ol>`;
}

function RunView(p: { id: string }) {
  const run = runs.value.find(r => r.id === p.id);
  if (!run) return html`<p class="note">There is no run ${p.id}. <a href="#/agents/runs">All runs</a></p>`;
  const done = run.steps.filter(s => s.status === "done").length, mine = proposals.value.filter(x => x.by === run.by).length;
  const stop = async () => { if (!confirm("Stop this run? Its steps stop where they are; what they proposed stays for you to answer.")) return; const e = await act(run.id, { action: "stop" }); if (e) say(e, true); };
  return html`<div class="run">
    <p class="note"><a href="#/agents/runs">All runs</a></p>
    <div class="run-head">
      <div class="grow"><h3>${run.goal}</h3>
        <span class="note">${run.id} · ${done} of ${run.steps.length} steps done · ${usd(run.usd)} of ${usd(run.maxUsd)}${run.estimateUsd !== undefined ? ` (about ${usd(run.estimateUsd)} planned)` : ""} · ${run.agentEdits === "direct" ? "its edits are saved as they come" : `its edits are proposals${mine ? `: ${mine} waiting` : ""}`}</span></div>
      <${Chip} tone=${waitsForYou(run) ? "warn" : run.status === "done" ? "ok" : run.status === "paused" ? "bad" : ""}>${waitsForYou(run) && run.status !== "gate" ? "a step asks you" : RUN_WORD[run.status]}</${Chip}>
      ${run.status !== "done" && run.status !== "stopped" && html`<button class="small" onClick=${() => void stop()}><${Icon} name="stop" size=${14} /> Stop</button>`}
    </div>
    <${GateCard} run=${run} />
    ${run.status === "paused" && html`<${PausedCard} run=${run} />`}
    ${run.brief && html`<details class="run-brief" open=${run.status === "gate" && run.gate === "plan"}><summary>The plan's brief</summary><${Markdown} text=${run.brief} /></details>`}
    <ol class="run-steps">${run.steps.map(s => html`<${StepRow} key=${s.id} run=${run} step=${s} />`)}</ol>
  </div>`;
}

/** A gate: the plan to look at before any step runs, or the new cast and places before the episodes. */
function GateCard(p: { run: Run }) {
  const run = p.run;
  if (run.status !== "gate") return null;
  const go = async () => { const e = await act(run.id, { action: "continue" }); if (e) say(e, true); };
  const off = async (gate: "plan" | "castAndPlaces") => { const e = await act(run.id, { action: "gates", gates: { [gate]: false } }); if (e) say(e, true); else await go(); };
  if (run.gate === "plan") {
    const steps = run.steps.filter(s => s.kind !== "plan");
    return html`<div class="ask-card gate-card" role="group" aria-label="The plan waits for you">
      <b>The plan is ready: ${steps.length} step${steps.length === 1 ? "" : "s"}${run.estimateUsd !== undefined ? `, about ${usd(run.estimateUsd)}` : ""}.</b>
      <p class="note">Read the brief and the steps below. Going on starts them: each by its own agent, as many at once as can.${run.gates.castAndPlaces ? " It stops again once the new cast and places are made, for you to look at them." : ""}</p>
      <div class="row wrap"><button class="primary" onClick=${() => void go()}>Start the steps</button>
        ${run.gates.castAndPlaces && html`<button onClick=${() => void off("castAndPlaces")}>Start, and do not stop after the cast</button>`}</div></div>`;
  }
  const made = run.steps.filter(s => ["season", "character", "place"].includes(s.kind));
  return html`<div class="ask-card gate-card" role="group" aria-label="The cast and places wait for you">
    <b>The new cast and places are made.</b>
    <p class="note">Look at them before the episodes are written: ${made.flatMap(s => s.owns).map(o => html`<a href=${`#/${o.kind === "story" ? "episode" : o.kind}/${o.id}`}>${o.id}</a> `)}. ${run.agentEdits === "direct" ? "They are saved." : "They are proposals: accept them now, or leave them waiting; the episodes build on them either way."}</p>
    <div class="row wrap"><button class="primary" onClick=${() => void go()}>Write the episodes</button></div></div>`;
}

function PausedCard(p: { run: Run }) {
  const run = p.run;
  const [more, setMore] = useState(Math.ceil(run.maxUsd * 2));
  const raise = async () => { const e = await act(run.id, { action: "budget", maxUsd: more }); if (e) say(e, true); };
  const budget = /budget/.test(run.why ?? "");
  return html`<div class="ask-card gate-card bad" role="group" aria-label="The run is paused">
    <b>Paused: ${run.why}</b>
    ${budget ? html`<div class="row"><label class="row">Raise it to $ <input type="number" min=${Math.ceil(run.usd)} step="1" style="max-width:90px" value=${more} onInput=${(e: Event) => setMore(Number((e.target as HTMLInputElement).value))} /></label><button class="primary" onClick=${() => void raise()}>Go on</button></div>`
      : html`<p class="note">Try the step again below, or stop the run.</p>`}</div>`;
}

function StepRow(p: { run: Run; step: RunStep }) {
  const { run, step: s } = p;
  const live = s.status === "running" || s.status === "asking";
  const [open, setOpen] = useState(live);
  useEffect(() => { if (live) setOpen(true); }, [live]);
  useEffect(() => { if (open) void loadLog(run.id, s.id); }, [open]);
  const log = logs.value[`${run.id}:${s.id}`];
  const retry = async () => { const e = await actStep(run.id, s.id, { action: "retry" }); if (e) say(e, true); };
  const stop = async () => { const e = await actStep(run.id, s.id, { action: "stop" }); if (e) say(e, true); };
  const needs = s.needs.filter(n => n !== "plan").map(n => run.steps.find(x => x.id === n)?.title ?? n);
  return html`<li class=${`run-step ${s.status}`}>
    <div class="run-step-head" onClick=${() => setOpen(!open)}>
      <${Chip} tone=${STEP_TONE[s.status]}>${STEP_WORD[s.status]}</${Chip}>
      <b class="grow">${s.title}</b>
      <span class="note">${KIND_WORD[s.kind] ?? s.kind}${s.owns.length ? ` · makes ${s.owns.map(o => o.id).join(", ")}` : ""}${needs.length ? ` · after ${needs.join(", ")}` : ""}${s.usd ? ` · ${usd(s.usd)}` : ""}</span>
      <${Icon} name="down" size=${14} />
    </div>
    ${s.status === "asking" && s.question && html`<${StepQuestion} run=${run} step=${s} />`}
    ${open && html`<div class="run-step-body">
      ${s.brief && s.kind !== "plan" && html`<p class="note">${s.brief}</p>`}
      ${s.error && html`<div class="chat-error"><span class="grow">${s.error}</span></div>`}
      ${log ? html`<div class="step-log"><${Answer} turn=${log} live=${s.status === "running"} /></div>` : html`<p class="note">Reading its work…</p>`}
      ${s.summary && s.status === "done" && html`<div class="step-summary"><b>Its report</b><${Markdown} text=${s.summary} /></div>`}
      <${StepProposals} run=${run} step=${s} />
      <div class="row wrap">
        ${(s.status === "failed" || s.status === "stopped") && html`<button class="small primary" onClick=${() => void retry()}>Try again</button>`}
        ${(s.status === "stale" || s.status === "done") && s.kind !== "plan" && html`<${Redo} run=${run} step=${s} />`}
        ${s.status === "running" && html`<button class="small" onClick=${() => void stop()}>Stop this step</button>`}
      </div></div>`}
  </li>`;
}

/** A step's question: its buttons, or the person's own words. */
function StepQuestion(p: { run: Run; step: RunStep }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const q = p.step.question!;
  const answer = async (a: string) => {
    if (!a.trim()) return;
    setBusy(true);
    const e = await actStep(p.run.id, p.step.id, { action: "answer", answer: a });
    setBusy(false);
    if (e) say(e, true); else setText("");
  };
  return html`<div class="ask-card step-question" role="group" aria-label=${`${p.step.title} asks you`}>
    <b>${q.question}</b>
    <div class="row wrap">${(q.options ?? []).map(o => html`<button disabled=${busy} onClick=${() => void answer(o)}>${o}</button>`)}</div>
    <form class="row" onSubmit=${(e: Event) => { e.preventDefault(); void answer(text); }}>
      <input placeholder="Or say it in your own words…" value=${text} onInput=${(e: Event) => setText((e.target as HTMLInputElement).value)} />
      <button class="primary" disabled=${busy || !text.trim()}>Answer</button></form>
  </div>`;
}

/** A step's proposals still waiting, to accept or turn down together; what accepting takes with it. */
function StepProposals(p: { run: Run; step: RunStep }) {
  const [busy, setBusy] = useState(false);
  const mine = proposals.value.filter(x => x.by === p.run.by && x.step === p.step.id);
  if (!mine.length) return null;
  // each document's latest proposal holds the ones before it
  const held = new Set(mine.map(x => x.after).filter(Boolean)), heads = mine.filter(x => !held.has(x.id));
  const no = heads.flatMap(turnedDown), first = [...new Map(heads.flatMap(neededFirst).map(q => [q.id, q])).values()].filter(q => q.step !== p.step.id);
  const all = async (fn: (x: Proposal) => Promise<unknown>) => { setBusy(true); try { for (const x of heads) if (proposals.value.some(q => q.id === x.id)) await fn(x); } finally { setBusy(false); } };
  return html`<div class="step-proposals">
    <b>Its proposals, waiting for you</b>
    <ul>${mine.map(x => html`<li>${x.summary} <span class="note">(${x.kind} ${x.doc})</span> <button class="linkish" onClick=${() => openProposal(x)}>Open</button></li>`)}</ul>
    ${no.length ? html`<p class="note bad">They need ${[...new Set(no)].join(", ")}, which you turned down: do that again first.</p>`
      : first.length > 0 && html`<p class="note">Accepting them also accepts what they need: ${first.map(q => q.summary).join("; ")}.</p>`}
    <div class="row wrap">
      <button class="small" disabled=${busy} onClick=${() => void all(x => reject(x))}>Reject the step's</button>
      <button class="small" disabled=${busy || no.length > 0} onClick=${() => void all(x => accept(x))}>Accept the step's</button>
      <button class="small primary" disabled=${busy || no.length > 0} onClick=${() => void all(x => acceptAndSave(x))}>Accept and save</button></div>
  </div>`;
}

/** Do a step again: from its start, with what the person says it should do differently. */
function Redo(p: { run: Run; step: RunStep }) {
  const [open, setOpen] = useState(p.step.status === "stale"), [note, setNote] = useState("");
  const redo = async () => { const e = await actStep(p.run.id, p.step.id, { action: "redo", note }); if (e) say(e, true); else setNote(""); };
  if (!open) return html`<button class="small" onClick=${() => setOpen(true)}>Do it again…</button>`;
  return html`<form class="row redo" onSubmit=${(e: Event) => { e.preventDefault(); void redo(); }}>
    <input placeholder=${p.step.status === "stale" ? "What it should do differently (you turned its work, or work it built on, down)" : "What it should do differently"} value=${note} onInput=${(e: Event) => setNote((e.target as HTMLInputElement).value)} />
    <button class="primary small">Do it again</button></form>`;
}
