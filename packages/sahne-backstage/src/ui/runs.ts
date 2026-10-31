// Runs (#/agents/runs, #/agents/runs/<id>): a long task the assistant does in steps (server/runs/run.ts). The list of
// runs; and one run, shown by what it makes rather than how: a line of progress and cost; one place for what needs you
// (the plan to start, a question, a pause, the new people and places to look at); what it made as cards with pictures,
// grouped into people, places and episodes, each to open and, in Auto mode, to undo (with what was built on it), or, when
// it checks with you, to accept and save or turn down; and its steps, logs and reports folded under "Show the work".

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { textOf, type StoryPlace } from "sahne-story";
import { route, say, world } from "../store.ts";
import { act, actStep, loadLog, logs, runs, undo, type Run, type RunStep } from "../runs.ts";
import { acceptAndSave, neededFirst, proposals, reject, turnedDown, type Proposal } from "../events.ts";
import { hrefOf, openProposal } from "./proposed.ts";
import { Answer } from "./assistant.ts";
import { ago } from "./agents.ts";
import { Chip, Icon } from "./kit/index.ts";
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
  if (!list.length) return html`<p class="note">No run yet. Ask the assistant for a long task (a week of episodes, a new season with its people and places), and it offers one: a card you start.</p>`;
  return html`<ol class="runs-list">${list.map(r => {
    const work = r.steps.filter(s => s.kind !== "plan"), done = work.filter(s => s.status === "done").length;
    return html`<li><a class="card run-card" href=${`#/agents/runs/${r.id}`}>
      <span class="row"><b class="grow">${r.goal.length > 140 ? `${r.goal.slice(0, 140)}…` : r.goal}</b><${Chip} tone=${waitsForYou(r) ? "warn" : r.status === "done" ? "ok" : r.status === "paused" ? "bad" : ""}>${waitsForYou(r) ? "waits for you" : RUN_WORD[r.status]}</${Chip}></span>
      <span class="note">${auto(r) ? "Just doing it" : "Checking with you"} · ${done} of ${work.length} done · ${usd(r.usd)} · ${ago(r.at)}</span></a></li>`;
  })}</ol>`;
}

function RunView(p: { id: string }) {
  const run = runs.value.find(r => r.id === p.id);
  if (!run) return html`<p class="note">There is no run ${p.id}. <a href="#/agents/runs">All runs</a></p>`;
  const work = run.steps.filter(s => s.kind !== "plan"), done = work.filter(s => s.status === "done").length;
  const stop = async () => { if (!confirm(`Stop this run? Its steps stop where they are${auto(run) ? "; what it made stays, and you can still undo it" : "; what they proposed stays for you to answer"}.`)) return; const e = await act(run.id, { action: "stop" }); if (e) say(e, true); };
  const [work2, setWork] = useState(false);
  return html`<div class="run">
    <p class="note"><a href="#/agents/runs">All runs</a></p>
    <div class="run-head">
      <div class="grow"><h3 class="run-goal" title=${run.goal}>${run.goal}</h3>
        <div class="run-progress"><span class="bar"><span style=${`width:${work.length ? Math.round((done / work.length) * 100) : 0}%`}></span></span>
          <span class="note">${run.status === "done" ? "Done" : run.status === "stopped" ? "Stopped" : `${done} of ${work.length}`} · ${usd(run.usd)}${run.estimateUsd !== undefined ? ` of about ${usd(run.estimateUsd)}` : ""} · ${auto(run) ? "just doing it" : "checking with you"}</span></div></div>
      ${run.status !== "done" && run.status !== "stopped" && html`<button class="small" onClick=${() => void stop()}><${Icon} name="stop" size=${14} /> Stop</button>`}
    </div>
    <${NeedsYou} run=${run} />
    ${auto(run) && run.status !== "running" && run.status !== "gate" && ((run.made ?? []).length > 0 || run.status === "done") && html`<${Finished} run=${run} />`}
    <${Results} run=${run} />
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
    run.status === "paused" && html`<${PausedCard} run=${run} stuck=${stuck} />`,
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
  const [change, setChange] = useState(""), [busy, setBusy] = useState(false);
  const go = async () => { const e = await act(run.id, { action: "continue" }); if (e) say(e, true); };
  const redoPlan = async () => { setBusy(true); const e = await actStep(run.id, "plan", { action: "redo", note: change }); setBusy(false); if (e) say(e, true); else setChange(""); };
  if (run.gate === "plan") return html`<div class="ask-card gate-card" role="group" aria-label="The plan waits for you">
    <b>The plan: ${planWords(run, main)}${run.estimateUsd !== undefined ? `. About ${usd(run.estimateUsd)}` : ""}.</b>
    <div class="row wrap"><button class="primary" onClick=${() => void go()}>Start</button></div>
    <form class="row" onSubmit=${(e: Event) => { e.preventDefault(); if (change.trim()) void redoPlan(); }}>
      <input placeholder="Or change something: say what, and it plans again…" value=${change} onInput=${(e: Event) => setChange((e.target as HTMLInputElement).value)} />
      <button disabled=${busy || !change.trim()}>Plan again</button></form></div>`;
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
  return html`<div class="ask-card gate-card bad" role="group" aria-label="The run is paused">
    ${budget ? html`<b>Paused at its budget.</b><div class="row"><label class="row">Raise it to $ <input type="number" min=${Math.ceil(run.usd)} step="1" style="max-width:90px" value=${more} onInput=${(e: Event) => setMore(Number((e.target as HTMLInputElement).value))} /></label><button class="primary" onClick=${() => void raise()}>Go on</button></div>
      <p class="note">If the day's cap in Settings stopped it, raise that there; the stopped parts go on by themselves once there is room.</p>`
      : p.stuck.length ? html`<b>${p.stuck.length === 1 ? `${p.stuck[0].title} stopped` : `${p.stuck.length} parts stopped`}.</b><div class="row"><button class="primary" onClick=${() => void retryAll()}>Try ${p.stuck.length === 1 ? "it" : "them"} again</button></div>`
      : html`<b>Paused: ${run.why}</b>`}</div>`;
}

/** When an Auto run is done: what it made, to keep or undo. */
function Finished(p: { run: Run }) {
  const run = p.run, made = run.made ?? [];
  const all = async () => {
    if (!confirm(`Undo everything this run made (${made.length} document${made.length === 1 ? "" : "s"})? Anything changed since it wrote it is kept.`)) return;
    const r = await undo(run.id);
    if (typeof r === "string") say(r, true); else say(`undone: ${r.undone.length}${r.kept.length ? `; kept, as it changed after the run: ${r.kept.map(k => k.id).join(", ")}` : ""}`);
  };
  const said = run.status === "done" ? "Done. Here is what it made." : run.status === "stopped" ? "Stopped. Here is what it made so far." : "Paused. Here is what it made so far.";
  return html`<div class="run-finished"><b class="grow">${said}</b>${made.length > 0 && html`<button class="small" onClick=${() => void all()}>Undo all of it</button>`}</div>`;
}

type Kind2 = "character" | "place" | "season" | "story";
const GROUPS: [Kind2, string][] = [["character", "People"], ["place", "Places"], ["season", "Season"], ["story", "Episodes"]];

/** What the run makes, as cards: from what its steps make, with what it wrote (Auto) or proposed (check). */
function Results(p: { run: Run }) {
  const run = p.run;
  const owned = run.steps.flatMap(s => s.owns.map(o => ({ ...o, step: s })));
  if (!owned.length) return null;
  return html`<div class="run-results">${GROUPS.map(([kind, label]) => {
    const here = owned.filter(o => o.kind === kind);
    return here.length ? html`<section><h4>${label}</h4><div class="result-cards">${here.map(o => html`<${ResultCard} key=${o.id} run=${run} kind=${kind} id=${o.id} step=${o.step} />`)}</div></section>` : null;
  })}</div>`;
}

function ResultCard(p: { run: Run; kind: Kind2; id: string; step: RunStep }) {
  const { run, kind, id, step } = p, w = world.value!, { main } = useLangs();
  const [busy, setBusy] = useState(false);
  const pending = proposals.value.filter(x => x.by === run.by && x.kind === kind && x.doc === id);
  const held = new Set(pending.map(x => x.after).filter(Boolean)), heads = pending.filter(x => !held.has(x.id));
  const doc = (kind === "character" ? w.characters[id] : kind === "place" ? w.places[id] : kind === "season" ? w.seasons[id] : w.episodes.find(e => e.id === id)) ?? (heads.at(-1)?.next as never);
  const made = (run.made ?? []).find(m => m.kind === kind && m.id === id);
  const name = (() => {
    const d = doc as { name?: unknown; title?: unknown } | undefined;
    return textOf((d?.name ?? d?.title) as never, main) ?? id;
  })();
  const art = kind === "character" ? (doc ? portraitOf(doc as never, 140, "bust") : null)
    : kind === "place" ? (doc ? () => placeThumb(doc as StoryPlace) : null)
    : kind === "story" ? ((pl => (pl ? () => placeThumb(pl) : null))(w.places[(doc as { place?: string } | undefined)?.place ?? ""]))
    : null;
  const state = step.status === "running" ? "being made" : step.status === "asking" ? "asks you" : step.status === "undone" ? "undone"
    : heads.length ? "waits for you" : doc && (made || !auto(run)) ? "made" : step.status === "failed" || step.status === "stopped" ? "stopped" : "to come";
  const after = stepsAfter(run, step.id).flatMap(s => s.owns.map(o => o.id)).filter(x => x !== id);
  const undoIt = async () => {
    if (!confirm(`Undo ${name}?${after.length ? ` This also undoes what was built on it: ${after.join(", ")}.` : ""}`)) return;
    setBusy(true); const r = await undo(run.id, [{ kind, id }]); setBusy(false);
    if (typeof r === "string") say(r, true); else say(`undone: ${r.undone.map(u => u.id).join(", ") || "nothing"}${r.kept.length ? `; kept, as it changed after the run: ${r.kept.map(k => k.id).join(", ")}` : ""}`);
  };
  const redo = async () => { const e = await actStep(run.id, step.id, { action: "redo" }); if (e) say(e, true); };
  const answer = async (fn: (x: Proposal) => Promise<unknown>) => { setBusy(true); try { for (const x of heads) if (proposals.value.some(q => q.id === x.id)) await fn(x); } finally { setBusy(false); } };
  const blocked = heads.flatMap(turnedDown), first = [...new Map(heads.flatMap(neededFirst).map(q => [q.id, q])).values()];
  return html`<div class=${`result-card ${state.replace(/ /g, "-")}`}>
    ${kind !== "season" && html`<${Picture} art=${art} label=${name} />`}
    <div class="result-body">
      <b>${name}</b><span class="note">${state}</span>
      ${first.length > 0 && heads.length > 0 && html`<span class="note">Accepting also saves ${first.map(q => q.doc).join(", ")}.</span>`}
      <div class="row wrap">
        ${doc && !heads.some(h => h.create) && html`<a class="button small" href=${hrefOf(kind, id)}>Open</a>`}
        ${heads.length > 0 && html`<button class="small" disabled=${busy} onClick=${() => openProposal(heads[0])}>Look</button>
          <button class="small primary" disabled=${busy || blocked.length > 0} onClick=${() => void answer(x => acceptAndSave(x))}>Accept and save</button>
          <button class="small" disabled=${busy} onClick=${() => void answer(x => reject(x))}>Reject</button>`}
        ${auto(run) && made && step.status !== "running" && html`<button class="small" disabled=${busy} onClick=${() => void undoIt()}>Undo</button>`}
        ${step.status === "undone" && html`<button class="small" onClick=${() => void redo()}>Make it again</button>`}
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
