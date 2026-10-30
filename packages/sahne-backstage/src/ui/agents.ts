// Agents (#/agents, and the side panel's Agents tab): how to connect one over MCP (the commands to copy, for Claude
// Code over HTTP or stdio and for any other client), how their edits land (proposals or written, switched here for the
// agents that connect next), who is connected, every proposal waiting across the episodes, what agents did lately
// (each tool call, the assistant's too), and the tools they have. From `GET /api/agents`, read again on each `activity`.

import { html } from "htm/preact";
import { useEffect, useState } from "preact/hooks";
import { api } from "../api.ts";
import { go, say, world } from "../store.ts";
import { accept, activity, agentsTick, proposals, reject, type Call, type Proposal } from "../events.ts";
import { Chip, Icon } from "./kit/index.ts";

type Mode = "proposals" | "direct";
interface Session { id: string; client: string; version?: string; agentEdits: Mode; since: number; lastAt?: number; calls: number }
interface Tool { name: string; title?: string; description: string; readOnly: boolean }
export interface AgentsView {
  mcpUrl: string; cli: string; content: string | null; write: boolean; writable: boolean; agentEdits: Mode; shareCards: boolean;
  sessions: Session[]; editors: number; activity: Call[]; pending: number; tools: Tool[];
}

/** The agents as the server sees them, read again a moment after anything changes among them. */
export function useAgents(): AgentsView | null {
  const [v, setV] = useState<AgentsView | null>(null);
  const tick = agentsTick.value;
  useEffect(() => {
    const t = setTimeout(() => void api.get<AgentsView>("agents").then(r => {
      if (r.status !== 200) return;
      setV(r);
      // the server's list holds calls from before this page opened; the stream adds the rest
      const seen = new Set(activity.value.map(keyOfCall));
      activity.value = [...activity.value, ...r.activity.filter(c => !seen.has(keyOfCall(c)))].sort((a, b) => b.at - a.at).slice(0, 200);
    }), tick ? 300 : 0);
    return () => clearTimeout(t);
  }, [tick]);
  return v;
}
const keyOfCall = (c: Call) => `${c.at}|${c.by}|${c.tool}`;

const q = (s: string) => (/[\s"'$]/.test(s) ? `'${s.replace(/'/g, `'\\''`)}'` : s);
/** The ways to connect, each a command or a file to copy. */
export function connections(v: AgentsView) {
  const origin = new URL(v.mcpUrl).origin;
  const stdio = `node ${q(v.cli)} mcp${v.content ? ` --content ${q(v.content)}` : ""}${v.write ? " --write" : ""} --backstage ${origin}/`;
  return [
    { id: "http", label: "Claude Code, to this backstage", note: "Over HTTP: the agent talks to this very server, so its proposals and its pointing land here at once.", text: `claude mcp add --transport http sahne-backstage ${v.mcpUrl}` },
    { id: "stdio", label: "Claude Code, started by the agent", note: "On stdio: the agent starts its own backstage on the same root; --backstage sends its proposals here.", text: `claude mcp add sahne-backstage -- ${stdio}` },
    { id: "json", label: "Any MCP client (.mcp.json, Cursor, LM Studio…)", note: "The server's address, in the mcpServers file most clients read.", text: JSON.stringify({ mcpServers: { "sahne-backstage": { type: "http", url: v.mcpUrl } } }, null, 2) },
  ];
}

export async function copy(text: string, what = "copied") {
  try { await navigator.clipboard.writeText(text); say(what); } catch { say("the browser did not let backstage copy: select the text instead", true); }
}

/** A moment, said plainly: "just now", "4 min ago", "at 14:05". */
export function ago(at: number, now = Date.now()) {
  const s = Math.round((now - at) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(at).toLocaleString(undefined, { hour: "2-digit", minute: "2-digit", ...(s > 86400 ? { month: "short", day: "numeric" } : {}) });
}

const who = (by: string) => (by === "assistant" ? "The assistant" : by);

export function Connect(p: { v: AgentsView; compact?: boolean }) {
  const list = connections(p.v);
  return html`<div class="connect">${(p.compact ? list.slice(0, 1) : list).map(c => html`<div class="field">
    <label>${c.label}</label>
    <div class="copyline"><pre>${c.text}</pre><button class="iconbtn" title="Copy" aria-label=${`Copy: ${c.label}`} onClick=${() => void copy(c.text, `copied: ${c.label}`)}><${Icon} name="copy" size=${16} /></button></div>
    ${!p.compact && html`<small class="note">${c.note}</small>`}</div>`)}</div>`;
}

export function ModeSwitch(p: { v: AgentsView; onChange(v: AgentsView): void }) {
  const set = async (agentEdits: Mode) => {
    const r = await api.post<AgentsView>("agents", { agentEdits });
    if (r.status !== 200) { say((r as { message?: string }).message ?? "not changed", true); return; }
    p.onChange(r); say(agentEdits === "proposals" ? "agents' edits are proposals now" : "agents' edits are written now, after the check");
  };
  const stale = p.v.sessions.filter(s => s.agentEdits !== p.v.agentEdits).length;
  return html`<div class="field">
    <div class="segmented" role="group" aria-label="How agents' edits land">
      <button aria-pressed=${p.v.agentEdits === "proposals"} onClick=${() => void set("proposals")}>They propose; I accept</button>
      <button aria-pressed=${p.v.agentEdits === "direct"} onClick=${() => void set("direct")}>They write, checked</button></div>
    <small class="note">${p.v.agentEdits === "proposals" ? "Each edit waits for you, checked, above the script. Nothing is saved until you accept it and save." : "Each edit is saved at once if it passes the same check as your save; an open episode with unsaved edits is never overwritten."}
      ${stale ? ` ${stale} agent${stale > 1 ? "s" : ""} connected before the change keep${stale > 1 ? "" : "s"} the old way until they connect again.` : ""}
      ${!p.v.writable ? " Backstage is read-only now, so no agent can edit either way." : ""}</small></div>`;
}

export function Inbox(p: { limit?: number }) {
  const list = proposals.value;
  if (!list.length) return html`<p class="note">Nothing waits for you.</p>`;
  const shown = p.limit ? list.slice(0, p.limit) : list;
  return html`<div class="inbox">${shown.map((x: Proposal) => {
    const errs = x.problems.filter(q => q.new && q.level === "error").length;
    return html`<div class="inbox-row">
      <div class="grow"><b>${x.doc}</b> <span class="note">${who(x.by)} · ${ago(x.at)}</span><div>${x.summary}</div></div>
      ${errs > 0 && html`<${Chip} tone="bad">${errs} new error${errs > 1 ? "s" : ""}</${Chip}>`}
      <button class="small" onClick=${() => go(x.kind === "story" ? "episode" : x.kind === "character" ? "character" : x.kind === "place" ? "place" : "", x.doc)}>Open</button>
      <button class="small" onClick=${() => void reject(x)}>Reject</button>
      <button class="small primary" onClick=${() => void accept(x)}>Accept</button></div>`;
  })}${p.limit && list.length > p.limit ? html`<p class="note">and ${list.length - p.limit} more on <a href="#/agents">the Agents page</a></p>` : ""}</div>`;
}

export function Activity(p: { limit?: number }) {
  const list = p.limit ? activity.value.slice(0, p.limit) : activity.value;
  if (!list.length) return html`<p class="note">No agent has done anything yet.</p>`;
  return html`<ol class="activity">${list.map(c => html`<li class=${c.ok ? "" : "bad"}>
    <span class="when" title=${new Date(c.at).toLocaleString()}>${ago(c.at)}</span>
    <span class="grow"><b>${who(c.by)}</b> ${c.label ?? html`<code>${c.tool}</code>`}${c.summary ? html` <span class="note">${c.summary}</span>` : ""}</span>
    <span class="note">${c.ms < 1000 ? `${c.ms} ms` : `${(c.ms / 1000).toFixed(1)} s`}</span></li>`)}</ol>`;
}

function Sessions(p: { v: AgentsView }) {
  const v = p.v;
  return html`<p class="note">${v.editors} editor${v.editors === 1 ? "" : "s"} listening (this tab among them). Agents on stdio show only in the activity, and only with <code>--backstage</code>.</p>
    ${v.sessions.length ? html`<table class="grid"><thead><tr><th>Agent</th><th>Edits</th><th>Connected</th><th>Calls</th><th>Last</th></tr></thead>
      <tbody>${v.sessions.map(s => html`<tr><td><b>${s.client}</b>${s.version ? html` <small class="note">${s.version}</small>` : ""}</td><td>${s.agentEdits === "proposals" ? "propose" : "write"}</td><td>${ago(s.since)}</td><td>${s.calls}</td><td>${s.lastAt ? ago(s.lastAt) : "–"}</td></tr>`)}</tbody></table>`
      : html`<p class="note">No agent is connected over HTTP.</p>`}`;
}

function Tools(p: { v: AgentsView }) {
  const [open, setOpen] = useState(false);
  const read = p.v.tools.filter(t => t.readOnly), write = p.v.tools.filter(t => !t.readOnly);
  const row = (t: Tool) => html`<li><code>${t.name}</code>${t.title ? html` <b>${t.title}</b>` : ""}${open ? html`<div class="note">${t.description}</div>` : ""}</li>`;
  return html`<div class="row"><span class="note grow">${read.length} to read, ${write.length} to edit, and the resources <code>sahne://format</code>, <code>sahne://languages</code>, <code>sahne://selection</code>.</span>
      <button class="small" onClick=${() => setOpen(!open)}>${open ? "Hide what each does" : "What each does"}</button></div>
    <div class="tools"><div><h4>Read</h4><ul>${read.map(row)}</ul></div><div><h4>Edit</h4><ul>${write.map(row)}</ul></div></div>`;
}

export function AgentsPage() {
  const v = useView();
  if (!v.now) return html`<p class="note">Asking backstage about its agents…</p>`;
  const w = world.value!;
  return html`<section class="agents">
    <div class="pagehead"><h2 class="grow">Agents</h2><span class="note">Agents work on ${w.samples ? "the samples" : "this content root"} through backstage's MCP server, with the same checks as you. <a href="#/docs/backstage/mcp-server-and-agent-edits-servermcpts-serverproposalsts-servereventsts">How it works</a></span></div>
    <div class="agents-grid">
      <div class="step-card"><h3><${Icon} name="plug" size=${16} /> Connect an agent</h3><${Connect} v=${v.now} /></div>
      <div>
        <div class="step-card"><h3><${Icon} name="check" size=${16} /> How their edits land</h3><${ModeSwitch} v=${v.now} onChange=${v.set} />
          <p class="note">Word cards: ${v.now.shareCards ? "agents see a card's main-language word (--share-cards)" : "agents see only their ids and levels (start with --share-cards to show the word)"}. Never a card's translations or lesson text.</p></div>
        <div class="step-card"><h3><${Icon} name="note" size=${16} /> Waiting for you ${proposals.value.length ? html`<${Chip} tone="warn">${proposals.value.length}</${Chip}>` : ""}</h3><${Inbox} /></div>
      </div>
      <div class="step-card"><h3><${Icon} name="cast" size=${16} /> Connected</h3><${Sessions} v=${v.now} /></div>
      <div class="step-card"><h3><${Icon} name="film" size=${16} /> What they did</h3><${Activity} /></div>
      <div class="step-card wide"><h3><${Icon} name="hand" size=${16} /> Their tools</h3><${Tools} v=${v.now} /></div>
    </div>
  </section>`;
}

/** The view, and a newer one a switch of the mode answered with (until the next read). */
function useView() {
  const read = useAgents(), [answered, setAnswered] = useState<AgentsView | null>(null);
  useEffect(() => { setAnswered(null); }, [read]);
  return { now: answered ?? read, set: setAnswered };
}

/** The side panel's Agents tab: the essentials, and the way to the page. */
export function AgentsPanel() {
  const v = useView();
  if (!v.now) return html`<p class="note">Asking backstage about its agents…</p>`;
  return html`<div class="side-agents">
    <h4>Waiting for you</h4><${Inbox} limit=${4} />
    <h4>How their edits land</h4><${ModeSwitch} v=${v.now} onChange=${v.set} />
    <h4>Connect one</h4>${v.now.sessions.length ? html`<p class="note">${v.now.sessions.map(s => s.client).join(", ")} connected.</p>` : ""}<${Connect} v=${v.now} compact />
    <h4>Lately</h4><${Activity} limit=${6} />
    <p><a href="#/agents">All of it, with the other ways to connect and the tools →</a></p>
  </div>`;
}

