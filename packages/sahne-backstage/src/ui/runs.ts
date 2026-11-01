// Tasks (#/agents/tasks, #/agents/tasks/<id>; runs in the code): a long task the assistant does in steps (server/runs/run.ts). The list of
// runs; and one run, shown by what it makes rather than how: a line of progress and cost; one place for what needs you
// (the plan to start, a question, a pause, the new people and places to look at); what it made as cards with pictures,
// grouped into people, places and episodes, each to open and to undo (with what was built on it), or, for an older task
// that proposed its work, to accept and save or turn down; and its steps, logs and reports folded under "Show the work".

import { html } from "htm/preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { textOf, type StoryPlace } from "sahne-story";
import { route, say, world } from "../store.ts";
import { act, actStep, loadLog, logs, runs, undo, type Did, type Run, type RunStep } from "../runs.ts";
import { acceptAndSave, neededFirst, proposals, reject, turnedDown, type Proposal } from "../events.ts";
import { hrefOf, openProposal } from "./proposed.ts";
import { Answer } from "./assistant.ts";
import { doingNow } from "./chat/parts.ts";
import { WhatChanged } from "./whatchanged.ts";
import { leftWords, timeLeft } from "../model/eta.ts";
import { ago } from "./agents.ts";
import { Chip, Confirm, Icon } from "./kit/index.ts";
import { Picture } from "./kit/gallery.ts";
import { portraitOf } from "./galleries.ts";
import { placeThumb } from "../thumbs.ts";
import { Markdown } from "./md.ts";
import { useLangs } from "./lang.ts";

const usd = (n: number) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;
const RUN_WORD: Record<Run["status"], string> = { running: "working", gate: "waits for you", paused: "paused", done: "done", stopped: "stopped" };
const STEP_WORD: Record<RunStep["status"], string> = { waiting: "waiting", running: "working", asking: "asks you", done: "done", failed: "failed", stopped: "stopped", stale: "needs a redo", skipped: "skipped", undone: "undone" };
const STEP_TONE: Record<RunStep["status"], "" | "ok" | "warn" | "bad"> = { waiting: "", running: "ok", asking: "warn", done: "ok", failed: "bad", stopped: "warn", stale: "warn", skipped: "", undone: "" };
const KIND_WORD: Record<string, string> = { plan: "plan", season: "season", character: "character", place: "place", episode: "episode", review: "review", task: "task" };
const waitsForYou = (r: Run) => r.status === "gate" || r.steps.some(s => s.status === "asking");
const auto = (r: Run) => r.mode === "auto";
/** The person paused it (server/runs/run.ts PAUSED): working steps finish their turn, then wait for Go on. */
const pausedByYou = (r: Run) => r.status === "paused" && r.why === "you paused it";
/** It wrote straight in (journaled, to undo) rather than as proposals: every task now, but an older one may have proposed. */
const direct = (r: Run) => r.agentEdits === "direct";

/** True for a moment after `now` turns to `to`, not when it is so from the start: a step or card flashes once as it lands. */
function useJust(now: string, to: string): boolean {
  const was = useRef(now), [on, setOn] = useState(false);
  useEffect(() => {
    const turned = was.current !== now && now === to;
    was.current = now;
    if (!turned) return;
    setOn(true);
    const t = setTimeout(() => setOn(false), 1600);
    return () => clearTimeout(t);
  }, [now]);
  return on;
}

/** A document the task makes, as it is now (or nothing yet), and its name in the main language. */
function docOf(kind: string, id: string): unknown {
  const w = world.value!;
  return kind === "character" ? w.characters[id] : kind === "place" ? w.places[id] : kind === "season" ? w.seasons[id] : kind === "story" ? w.episodes.find(e => e.id === id) : undefined;
}
const nameOf = (doc: unknown, id: string, main: string) => { const d = doc as { name?: unknown; title?: unknown } | undefined; return textOf((d?.name ?? d?.title) as never, main) ?? id; };
const KIND_NAME: Record<string, string> = { character: "person", place: "place", season: "season", story: "episode", kit_piece: "set piece", kit_variant: "look" };

/** What undoing a document asks first: it, and what was built on it. */
export function undoAsk(run: Run, id: string, name: string, step: RunStep): string {
  const after = stepsAfter(run, step.id).flatMap(s => s.owns.map(o => o.id)).filter(x => x !== id);
  return `Undo ${name}?${after.length ? ` This also undoes ${after.join(", ")}, built on it.` : ""}`;
}
/** Undo one document a task made, with what was built on it (asked first, by a Confirm). */
export async function undoDoc(run: Run, kind: Kind2, id: string): Promise<void> {
  const r = await undo(run.id, [{ kind, id }]);
  if (typeof r === "string") say(r, true); else say(`undone: ${r.undone.map(u => u.id).join(", ") || "nothing"}${r.kept.length ? `; kept, as it changed after the task: ${r.kept.map(k => k.id).join(", ")}` : ""}`);
}

/** The steps that need `id`, through the steps they need (the browser's copy of the run's own). */
function stepsAfter(run: Run, id: string): RunStep[] {
  const out = new Set<RunStep>();
  let grew = true;
  while (grew) { grew = false; for (const s of run.steps) if (!out.has(s) && s.needs.some(n => n === id || [...out].some(o => o.id === n))) { out.add(s); grew = true; } }
  return [...out];
}

/** Runs: every run, newest first; or one run. */
export function RunsTab() {
  const id = route.value[2];
  if (id) return html`<${RunView} id=${id} />`;
  const list = [...runs.value].sort((a, b) => b.at - a.at);
  if (!list.length) return html`<p class="note">No task yet. Ask the assistant for a long task (a week of episodes, a new season with its people and places), and it offers one: a card you start.</p>`;
  return html`<ol class="runs-list">${list.map(r => {
    const work = r.steps.filter(s => s.kind !== "plan"), done = work.filter(s => s.status === "done").length;
    return html`<li><a class="card run-card" href=${`#/agents/tasks/${r.id}`}>
      <span class="row"><b class="grow">${r.goal.length > 140 ? `${r.goal.slice(0, 140)}…` : r.goal}</b><${Chip} live=${r.status === "running" || waitsForYou(r)} tone=${waitsForYou(r) ? "warn" : r.status === "done" ? "ok" : r.status === "paused" ? "bad" : ""}>${waitsForYou(r) ? "waits for you" : RUN_WORD[r.status]}</${Chip}></span>
      <span class="note">${auto(r) ? "Just doing it" : "Checking with you"} · ${done} of ${work.length} done · ${usd(r.usd)} · ${ago(r.at)}</span></a></li>`;
  })}</ol>`;
}

function RunView(p: { id: string }) {
  const run = runs.value.find(r => r.id === p.id);
  if (!run) return html`<p class="note">There is no task ${p.id}. <a href="#/agents/tasks">All tasks</a></p>`;
  // undone or skipped steps are over too: a done task's bar is full
  const work = run.steps.filter(s => s.kind !== "plan"), done = work.filter(s => s.status === "done" || s.status === "undone" || s.status === "skipped").length, doing = work.filter(s => s.status === "running").length;
  const share = (n: number) => `width:${work.length ? (n / work.length) * 100 : 0}%`;
  const pause = async () => { const e = await act(run.id, { action: "pause" }); if (e) say(e, true); };
  const goOn = async () => { const e = await act(run.id, { action: "continue" }); if (e) say(e, true); };
  const stop = async () => { const e = await act(run.id, { action: "stop" }); if (e) say(e, true); };
  const [work2, setWork] = useState(false);
  return html`<div class="run">
    <p class="note"><a href="#/agents/tasks">All tasks</a></p>
    <div class="run-head">
      <div class="grow"><h3 class="run-goal" title=${run.goal}>${run.goal}</h3>
        <div class="run-progress"><span class=${`bar${run.status === "running" ? " live" : ""}`}><span style=${share(done)}></span><span class="doing" style=${share(doing)}></span></span>
          <span class="note">${run.status === "done" ? "Done" : run.status === "stopped" ? "Stopped" : `${done} of ${work.length}`} · ${usd(run.usd)}${run.estimateUsd !== undefined ? ` of about ${usd(run.estimateUsd)}` : ""}${(left => (left === null ? "" : ` · ${leftWords(left)}`))(run.status === "running" ? timeLeft(run.steps, run.concurrency, Date.now()) : null)} · ${auto(run) ? "just doing it" : "checking with you"}${pausedByYou(run) ? ` · paused${run.steps.some(s => s.status === "running") ? ": the working steps finish what they are doing, then wait" : ""}` : ""}</span></div></div>
      <div class="row">
        ${run.status === "running" && html`<button class="small" onClick=${() => void pause()} title="Steps finish what they are doing, then wait"><${Icon} name="pause" size=${14} /> Pause</button>`}
        ${pausedByYou(run) && html`<button class="small primary" onClick=${() => void goOn()}><${Icon} name="play" size=${14} /> Go on</button>`}
        ${run.status !== "done" && run.status !== "stopped" && html`<${Confirm} label=${html`<${Icon} name="stop" size=${14} /> Stop the task`} ask=${`Stop this task? Its steps stop where they are${direct(run) ? "; what it made stays, and you can still undo it" : "; what they proposed stays for you to answer"}.`} yes="Yes, stop it" run=${stop} />`}
      </div>
    </div>
    <${NowLines} run=${run} />
    <${NeedsYou} run=${run} />
    ${direct(run) && run.status !== "running" && run.status !== "gate" && ((run.made ?? []).length > 0 || run.status === "done") && html`<${Finished} run=${run} />`}
    <${Results} run=${run} />
    <${History} run=${run} />
    <details class="run-work" open=${work2} onToggle=${(e: Event) => setWork((e.target as HTMLDetailsElement).open)}><summary>Show the work: ${run.steps.length} steps, their reports and logs</summary>
      ${run.brief && html`<details class="run-brief"><summary>The plan's brief</summary><${Markdown} text=${run.brief} /></details>`}
      <ol class="run-steps">${run.steps.map(s => html`<${StepRow} key=${s.id} run=${run} step=${s} />`)}</ol>
    </details>
  </div>`;
}

/** Everything that waits for the person, in one place: the plan, a question, a pause, the new people and places. */
function NeedsYou(p: { run: Run }) {
  const run = p.run, asking = run.steps.filter(s => s.status === "asking" && s.question);
  const stuck = run.steps.filter(s => (s.status === "failed" || s.status === "stopped") && !s.budget);
  const items = [
    run.status === "gate" && html`<${GateCard} run=${run} />`,
    ...asking.map(s => html`<${StepQuestion} run=${run} step=${s} />`),
    run.status === "paused" && !pausedByYou(run) && html`<${PausedCard} run=${run} stuck=${stuck} />`,
  ].filter(Boolean);
  if (!items.length) return null;
  return html`<section class="needs-you" aria-label="Needs you"><h4><${Icon} name="hand" size=${15} /> Needs you</h4>${items}</section>`;
}

/** The plan, in a sentence a person reads: how many of what, by name, and its cost. */
function planWords(run: Run, main: string): string {
  const of = (k: string) => run.steps.filter(s => s.kind === k);
  const names = (k: string) => of(k).flatMap(s => s.owns).map(o => o.id);
  const n = (k: string, one: string, many: string) => { const ids = names(k); return ids.length ? `${ids.length === 1 ? `1 ${one}` : `${ids.length} ${many}`} (${ids.join(", ")})` : ""; };
  return [n("character", "new person", "new people"), n("place", "place", "places"), n("season", "season", "seasons"), n("episode", "episode", "episodes"), of("review").length ? "a check at the end" : ""].filter(Boolean).join(", ");
}

function GateCard(p: { run: Run }) {
  const run = p.run, { main } = useLangs();
  const [change, setChange] = useState(""), [busy, setBusy] = useState(false), [editing, setEditing] = useState(false);
  const go = async () => { const e = await act(run.id, { action: "continue" }); if (e) say(e, true); };
  const redoPlan = async () => { setBusy(true); const e = await actStep(run.id, "plan", { action: "redo", note: change }); setBusy(false); if (e) say(e, true); else { setChange(""); setEditing(false); } };
  if (run.gate === "plan") return html`<div class="ask-card gate-card" role="group" aria-label="The plan waits for you">
    <b>The plan: ${planWords(run, main)}${run.estimateUsd !== undefined ? `. About ${usd(run.estimateUsd)}` : ""}.</b>
    <ol class="plan-steps">${run.steps.filter(s => s.kind !== "plan").map(s => html`<li><b>${s.title}</b>${s.about && html`<span class="plan-about">${s.about}</span>`}
      <details class="plan-agent"><summary>What its agent is told</summary><${Markdown} text=${s.brief} /></details></li>`)}</ol>
    ${run.brief && html`<details class="plan-brief"><summary>What every step reads first: the plan's brief</summary><${Markdown} text=${run.brief} /></details>`}
    <div class="gate-actions">
      ${editing ? html`<form class="gate-change" onSubmit=${(e: Event) => { e.preventDefault(); if (change.trim()) void redoPlan(); }}>
          <input autoFocus placeholder="What should change? It plans again with your words." value=${change} onInput=${(e: Event) => setChange((e.target as HTMLInputElement).value)} onKeyDown=${(e: KeyboardEvent) => { if (e.key === "Escape") setEditing(false); }} />
          <button class="primary" disabled=${busy || !change.trim()}>Plan again</button>
          <button type="button" class="linkish" onClick=${() => { setEditing(false); setChange(""); }}>Cancel</button></form>`
        : html`<button class="linkish" onClick=${() => setEditing(true)}>Change the plan…</button><span class="grow"></span>
          <button class="primary" onClick=${() => void go()}>Start</button>`}
    </div></div>`;
  return html`<div class="ask-card gate-card" role="group" aria-label="The new people and places wait for you">
    <b>The new people and places are made: look at them below.</b>
    <p class="note">The episodes are written next, with them.</p>
    <div class="row wrap"><button class="primary" onClick=${() => void go()}>Write the episodes</button></div></div>`;
}

function PausedCard(p: { run: Run; stuck: RunStep[] }) {
  const run = p.run;
  const [more, setMore] = useState(Math.ceil(Math.max(run.maxUsd * 2, run.usd + 5)));
  const raise = async () => { const e = await act(run.id, { action: "budget", maxUsd: more }); if (e) say(e, true); };
  const retryAll = async () => { for (const s of p.stuck) { const e = await actStep(run.id, s.id, { action: "retry" }); if (e) { say(e, true); return; } } };
  const budget = /budget|cap/.test(run.why ?? "") || run.steps.some(s => s.budget);
  return html`<div class="ask-card gate-card bad" role="group" aria-label="The task is paused">
    ${budget ? html`<b>Paused at its budget.</b><div class="row"><label class="row">Raise it to $ <input type="number" min=${Math.ceil(run.usd)} step="1" style="max-width:90px" value=${more} onInput=${(e: Event) => setMore(Number((e.target as HTMLInputElement).value))} /></label><button class="primary" onClick=${() => void raise()}>Go on</button></div>
      <p class="note">If the day's cap in Settings stopped it, raise that there; the stopped parts go on by themselves once there is room.</p>`
      : p.stuck.length ? html`<b>${p.stuck.length === 1 ? `${p.stuck[0].title} stopped` : `${p.stuck.length} parts stopped`}.</b>${p.stuck.map(s => html`<${FailNote} step=${s} />`)}<div class="row"><button class="primary" onClick=${() => void retryAll()}>Try ${p.stuck.length === 1 ? "it" : "them"} again</button></div>`
      : html`<b>Paused: ${run.why}</b>`}</div>`;
}

/** When an Auto run is done: what it made, to keep or undo. */
/** Why a step could not go on, in plain words, and what to do; its own error stays folded under it. */
function failWords(s: RunStep): string {
  if (s.budget) return `Couldn't finish ${s.title}: the budget or the day's cap was reached. Raise it, or try again later.`;
  if (s.status === "stopped") return `${s.title} was stopped before it was done. Try it again when you want it.`;
  const why = (s.error ?? "").split("\n")[0].replace(/^Error: /, "").slice(0, 160);
  return `Couldn't finish ${s.title}${why ? `: ${why}` : ""}. Try it again, or do it again with a note.`;
}
const FailNote = (p: { step: RunStep }) => html`<div class="fail-note"><p class="note bad">${failWords(p.step)}</p>${p.step.error && html`<details><summary>What it said</summary><pre>${p.step.error}</pre></details>`}</div>`;

/** Everything back to how it was before the task: the checkpoint its journal holds. */
const beforeAsk = (run: Run) => { const n = (run.made ?? []).length; return `Put ${n} document${n === 1 ? "" : "s"} back as before this task? What changed since is kept.`; };
async function backToBefore(run: Run): Promise<void> {
  const r = await undo(run.id);
  if (typeof r === "string") say(r, true); else say(`back to before the task: ${r.undone.length} undone${r.kept.length ? `; kept, as it changed after the task: ${r.kept.map(k => k.id).join(", ")}` : ""}`);
}

function Finished(p: { run: Run }) {
  const run = p.run, made = run.made ?? [];

  const said = run.status === "done" ? "Done. Here is what it made." : run.status === "stopped" ? "Stopped. Here is what it made so far." : "Paused. Here is what it made so far.";
  return html`<div class="run-finished"><${Icon} name="check" size=${16} /><b class="grow">${said}</b>${made.length > 0 && html`<${Confirm} label=${html`<${Icon} name="history" size=${14} /> Back to before this task`} ask=${beforeAsk(run)} yes="Yes, put it back" run=${() => backToBefore(run)} />`}</div>`;
}

export type Kind2 = "character" | "place" | "season" | "story";
const GROUPS: [Kind2, string][] = [["character", "People"], ["place", "Places"], ["season", "Season"], ["story", "Episodes"]];
/** Each kind of document's icon, as the rail shows it. */
const KIND_ICON: Record<string, string> = { character: "cast", place: "places", season: "calendar", story: "film", kit_piece: "box", kit_variant: "face" };

/** What the run makes, as cards: from what its steps make, with what it wrote (Auto) or proposed (check). */
function Results(p: { run: Run }) {
  const run = p.run;
  const owned = run.steps.flatMap(s => s.owns.map(o => ({ ...o, step: s })));
  if (!owned.length) return null;
  return html`<div class="run-results">${GROUPS.map(([kind, label]) => {
    const here = owned.filter(o => o.kind === kind);
    return here.length ? html`<section><h4><${Icon} name=${KIND_ICON[kind]} size=${14} /> ${label}</h4><div class="result-cards">${here.map(o => html`<${ResultCard} key=${o.id} run=${run} kind=${kind} id=${o.id} step=${o.step} />`)}</div></section>` : null;
  })}</div>`;
}

function ResultCard(p: { run: Run; kind: Kind2; id: string; step: RunStep }) {
  const { run, kind, id, step } = p, w = world.value!, { main } = useLangs();
  const [busy, setBusy] = useState(false);
  const pending = proposals.value.filter(x => x.by === run.by && x.kind === kind && x.doc === id);
  const held = new Set(pending.map(x => x.after).filter(Boolean)), heads = pending.filter(x => !held.has(x.id));
  const doc = docOf(kind, id) ?? (heads.at(-1)?.next as never);
  const made = (run.made ?? []).find(m => m.kind === kind && m.id === id);
  const name = nameOf(doc, id, main);
  const art = kind === "character" ? (doc ? portraitOf(doc as never, 140, "bust") : null)
    : kind === "place" ? (doc ? () => placeThumb(doc as StoryPlace) : null)
    : kind === "story" ? ((pl => (pl ? () => placeThumb(pl) : null))(w.places[(doc as { place?: string } | undefined)?.place ?? ""]))
    : null;
  const state = step.status === "running" ? "being made" : step.status === "asking" ? "asks you" : step.status === "undone" ? "undone"
    : heads.length ? "waits for you" : doc && (made || !direct(run)) ? "made" : step.status === "failed" || step.status === "stopped" ? "stopped" : "to come";
  const undoIt = async () => { setBusy(true); try { await undoDoc(run, kind, id); } finally { setBusy(false); } };
  const just = useJust(state, "made");
  const redo = async () => { const e = await actStep(run.id, step.id, { action: "redo" }); if (e) say(e, true); };
  const answer = async (fn: (x: Proposal) => Promise<unknown>) => { setBusy(true); try { for (const x of heads) if (proposals.value.some(q => q.id === x.id)) await fn(x); } finally { setBusy(false); } };
  const blocked = heads.flatMap(turnedDown), first = [...new Map(heads.flatMap(neededFirst).map(q => [q.id, q])).values()];
  return html`<div class=${`result-card ${state.replace(/ /g, "-")}${just ? " just" : ""}`}>
    ${kind !== "season" && (art ? html`<${Picture} art=${art} label=${name} />` : html`<div class="art placeholder" aria-hidden="true"><${Icon} name=${KIND_ICON[kind]} size=${30} /></div>`)}
    <div class="result-body">
      <b>${name}</b><span class="note">${state === "being made" ? html`<${Chip} tone="ok" live>being made</${Chip}>` : state}</span>
      ${state === "stopped" && html`<${FailNote} step=${step} />`}
      ${step.about && run.status !== "gate" && html`<span class="note why">${step.about}</span>`}
      ${step.decided && html`<ul class="decided" aria-label="What it decided">${step.decided.map(d => html`<li>${d}</li>`)}</ul>`}
      ${first.length > 0 && heads.length > 0 && html`<span class="note">Accepting also saves ${first.map(q => q.doc).join(", ")}.</span>`}
      <div class="row wrap">
        ${doc && !heads.some(h => h.create) && html`<a class="button small" href=${hrefOf(kind, id)}>Open</a>`}
        ${heads.length > 0 && html`<button class="small" disabled=${busy} onClick=${() => openProposal(heads[0])}>Look</button>
          <button class="small primary" disabled=${busy || blocked.length > 0} onClick=${() => void answer(x => acceptAndSave(x))}>Accept and save</button>
          <button class="small" disabled=${busy} onClick=${() => void answer(x => reject(x))}>Reject</button>`}
        ${direct(run) && made && step.status !== "running" && html`<${Confirm} disabled=${busy} label=${html`<${Icon} name="undo" size=${14} /> Undo`} ask=${undoAsk(run, id, name, step)} yes="Yes, undo" run=${undoIt} />`}
        ${step.status === "undone" && html`<button class="small" onClick=${() => void redo()}><${Icon} name="redo" size=${14} /> Make it again</button>`}
      </div></div></div>`;
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
  const just = useJust(s.status, "done");
  return html`<li class=${`run-step ${s.status}${just ? " just" : ""}`}>
    <div class="run-step-head" onClick=${() => setOpen(!open)}>
      <${Chip} tone=${STEP_TONE[s.status]} live=${live}>${s.status === "running" && pausedByYou(run) ? "pausing" : STEP_WORD[s.status]}</${Chip}>
      <b class="grow">${s.title}</b>
      <span class="note">${KIND_WORD[s.kind] ?? s.kind}${s.owns.length ? ` · makes ${s.owns.map(o => o.id).join(", ")}` : ""}${needs.length ? ` · after ${needs.join(", ")}` : ""}${s.usd ? ` · ${usd(s.usd)}` : ""}</span>
      <${Icon} name="down" size=${14} />
    </div>
    ${s.status === "asking" && s.question && html`<${StepQuestion} run=${run} step=${s} />`}
    ${open && html`<div class="run-step-body">
      ${s.brief && s.kind !== "plan" && html`<p class="note">${s.brief}</p>`}
      ${(s.status === "failed" || s.status === "stopped") ? html`<${FailNote} step=${s} />` : s.error && html`<div class="chat-error"><span class="grow">${s.error}</span></div>`}
      ${log ? html`<div class="step-log"><${Answer} turn=${log} live=${s.status === "running"} /></div>` : html`<p class="note">Reading its work…</p>`}
      ${s.summary && s.status === "done" && html`<div class="step-summary"><b>Its report</b><${Markdown} text=${s.summary} /></div>`}
      <${StepProposals} run=${run} step=${s} />
      <div class="row wrap">
        ${(s.status === "failed" || s.status === "stopped") && html`<button class="small primary" onClick=${() => void retry()}><${Icon} name="redo" size=${14} /> Try again</button>`}
        ${(s.status === "stale" || s.status === "done") && s.kind !== "plan" && html`<${Redo} run=${run} step=${s} />`}
        ${s.status === "running" && html`<button class="small" onClick=${() => void stop()}><${Icon} name="stop" size=${14} /> Stop this step</button>`}
      </div></div>`}
  </li>`;
}

/** What each working step does now, in a line: "Review s1e01 · Reading s1e01…". */
function NowLines(p: { run: Run }) {
  const live = p.run.steps.filter(s => s.status === "running");
  useEffect(() => { for (const s of live) void loadLog(p.run.id, s.id); }, [live.map(s => s.id).join()]);
  if (!live.length) return null;
  return html`<ul class="run-now" aria-live="polite">${live.map(s => {
    const log = logs.value[`${p.run.id}:${s.id}`];
    // keyed by step: a note being written stays with its step when another one ends
    return html`<li key=${s.id}><span class="spin" aria-hidden="true"></span><b>${s.title}</b><span class="note grow">${log ? doingNow(log.parts) : "Starting"}…</span><${Tell} run=${p.run} step=${s} /></li>`;
  })}</ul>`;
}

/** Tell a working step something: its agent reads it before its next model call, as the person's message. */
function Tell(p: { run: Run; step: RunStep }) {
  const [open, setOpen] = useState(false), [text, setText] = useState(""), [busy, setBusy] = useState(false);
  const told = p.step.told?.length ?? 0;
  if (!open) return html`<button class="small linkish" onClick=${() => setOpen(true)} title="It reads it before its next step of thought"><${Icon} name="chat" size=${14} /> Tell it something${told ? ` (${told} waiting)` : ""}</button>`;
  const send = async (e: Event) => {
    e.preventDefault();
    setBusy(true); const err = await actStep(p.run.id, p.step.id, { action: "tell", text }); setBusy(false);
    if (err) say(err, true); else { setText(""); setOpen(false); say("told: it reads it before its next model call"); }
  };
  return html`<form class="tell" onSubmit=${send} onKeyDown=${(e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }}>
    <input autoFocus placeholder=${`What ${p.step.title} should know`} value=${text} onInput=${(e: Event) => setText((e.target as HTMLInputElement).value)} />
    <button class="small primary" disabled=${busy || !text.trim()}><${Icon} name="send" size=${14} /> Tell</button>
    <button type="button" class="small" onClick=${() => setOpen(false)}>Cancel</button></form>`;
}

/** What the task wrote, newest first: each document to open, or to undo while it can be; under a step's newest row, the choices it made. */
function History(p: { run: Run }) {
  const run = p.run, { main } = useLangs(), [diff, setDiff] = useState<{ kind: string; id: string; name: string } | null>(null);
  // a document a step wrote several times is one row, at its last write: made, if the first of them created it
  const by = new Map<string, Did>();
  for (const d of run.did ?? []) { const k = `${d.step}:${d.kind}:${d.id}`, was = by.get(k); by.delete(k); by.set(k, { ...d, created: d.created || !!was?.created }); }
  const rows = [...by.values()].reverse();
  if (!rows.length) return null;
  const told = new Set<string>(), clock = (at: number) => new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return html`<details class="run-did" open><summary><${Icon} name="history" size=${14} /> What it did</summary><ol>${rows.map(d => {
    const step = run.steps.find(s => s.id === d.step), name = nameOf(docOf(d.kind, d.id), d.id, main), first = !told.has(d.step);
    told.add(d.step);
    const made = (run.made ?? []).some(m => m.kind === d.kind && m.id === d.id);
    return html`<li><time>${clock(d.at)}</time><${Icon} name=${KIND_ICON[d.kind] ?? "note"} size=${15} /><span class="grow">${d.created ? "Made" : "Changed"} ${KIND_NAME[d.kind] ?? d.kind} <b>${name}</b>${step && html` <span class="note">· ${step.title}</span>`}</span>
      ${made && !d.created && html`<button class="small" onClick=${() => setDiff({ kind: d.kind, id: d.id, name })}><${Icon} name="list" size=${14} /> What changed</button>`}
      ${made && html`<a class="button small" href=${hrefOf(d.kind, d.id)}>Open</a>`}
      ${made && step && direct(run) && step.status !== "running" && (d.kind === "character" || d.kind === "place" || d.kind === "season" || d.kind === "story") && html`<${Confirm} label=${html`<${Icon} name="undo" size=${14} /> Undo`} ask=${undoAsk(run, d.id, name, step)} yes="Yes, undo" run=${() => undoDoc(run, d.kind as Kind2, d.id)} />`}
      ${first && step?.decided && html`<ul class="decided" aria-label="What it decided">${step.decided.map(x => html`<li>${x}</li>`)}</ul>`}</li>`;
  })}
    <li class="checkpoint"><${Icon} name="history" size=${15} /><span class="grow">Before this task</span>${direct(run) && (run.made ?? []).length > 0 && run.status !== "running" && html`<${Confirm} label=${html`<${Icon} name="undo" size=${14} /> Restore`} ask=${beforeAsk(run)} yes="Yes, put it back" run=${() => backToBefore(run)} />`}</li></ol>
    ${diff && html`<${WhatChanged} task=${run.id} kind=${diff.kind} id=${diff.id} name=${diff.name} onClose=${() => setDiff(null)} />`}</details>`;
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
