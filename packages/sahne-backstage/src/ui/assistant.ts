// The assistant (server/assistant.ts): a conversation in a drawer beside any page, with what is open as its context (the
// page, the episode, the selected block), and one-click asks where you work (`ask`): fill the missing translations,
// simplify a line, suggest staging, propose choice options, check a scene, draft an episode from its brief, and a second
// reader that never saw the drafting. Its answer streams in, with the tools it uses; its edits arrive as proposals (or
// are written, in direct mode), never as hidden changes. A big ask says what it would cost and waits for a yes. It runs
// on Claude or on any OpenAI-compatible server (LM Studio, Ollama), within the budget (#/settings).
//
// Conversations are kept in this browser (localStorage, per series), never on the server: the last one opens again after
// a reload, *New conversation* keeps the one before it, and *History* lists them to open again or delete (the newest 30).

import { html } from "htm/preact";
import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Path } from "../model/path.ts";
import { route, say, world } from "../store.ts";
import { proposals, selection, usage } from "../events.ts";
import { abilities } from "../model/abilities.ts";
import { Icon } from "./kit/index.ts";
import { Markdown } from "./md.ts";

type Part = { type: "text"; text: string } | { type: "tool"; name: string; input?: unknown; ok?: boolean; summary?: string } | { type: "proposal"; id: string } | { type: "confirm"; estimateUsd: number; why: string } | { type: "error"; message: string } | { type: "done"; usd?: number };
interface Turn { role: "user" | "assistant"; content: string; parts?: Part[]; fresh?: boolean }

/** The side panel is open (side.ts), and the tab it shows; an ask turns it to the assistant. */
export const assistantOpen = signal(false);
export type SideTab = "assistant" | "agents" | "docs";
const saved = (() => { try { return localStorage.getItem("backstage:side"); } catch { return null; } })();
export const sideTab = signal<SideTab>(saved === "agents" || saved === "docs" ? saved : "assistant");
const turns = signal<Turn[]>([]);
const busy = signal(false);

// ---- the conversations kept in this browser ----------------------------------------------------------------------------

interface Chat { id: string; title: string; at: number; turns: Turn[] }
const KEEP = 30;
const storeKey = () => `backstage:chats:${world.value?.series?.id ?? "root"}`;
const readChats = (): Chat[] => { try { return JSON.parse(localStorage.getItem(storeKey()) ?? "[]") as Chat[]; } catch { return []; } };
const writeChats = (cs: Chat[]) => { try { localStorage.setItem(storeKey(), JSON.stringify(cs.slice(0, KEEP))); } catch { /* full or blocked: the conversation stays in this tab */ } };
/** The conversations kept, newest first, and the one open. */
export const chats = signal<Chat[]>([]);
const chatId = signal<string>("");
const newId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
let loadedFor = "";
/** Read the kept conversations once per series, and open the newest. */
function loadChats() {
  const k = storeKey();
  if (loadedFor === k) return;
  loadedFor = k;
  chats.value = readChats();
  const last = chats.value[0];
  chatId.value = last?.id ?? newId();
  turns.value = last?.turns ?? [];
}
let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Keep the open conversation (a moment after it changes, so a streaming answer is not written at every word). */
function keep() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    // nothing new: an empty one, or one just opened as it was kept (its time stays)
    if (!turns.value.length || chats.value.find(c => c.id === chatId.value)?.turns === turns.value) return;
    const first = turns.value.find(t => t.role === "user")?.content ?? "A conversation";
    const chat: Chat = { id: chatId.value, title: first.replace(/\s+/g, " ").slice(0, 80), at: Date.now(), turns: turns.value };
    chats.value = [chat, ...chats.value.filter(c => c.id !== chat.id)].slice(0, KEEP);
    writeChats(chats.value);
  }, 400);
}
turns.subscribe(() => { if (loadedFor) keep(); });
/** Start a new conversation (the one open stays in the history). */
export function newChat() { chatId.value = newId(); turns.value = []; }
function openChat(id: string) { const c = chats.value.find(x => x.id === id); if (c && !busy.value) { chatId.value = c.id; turns.value = c.turns; } }
function forgetChat(id: string) {
  chats.value = chats.value.filter(c => c.id !== id);
  writeChats(chats.value);
  if (chatId.value === id) newChat();
}
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 6e4); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : new Date(t).toLocaleDateString(); };

/** One-click asks, by what is selected. */
export const ASKS: { id: string; label: string; prompt: string; on: "block" | "episode"; fresh?: boolean }[] = [
  { id: "translate", label: "Fill the missing translations", prompt: "Fill in every missing translation in this episode (only the series' languages), natural and at the episode's level. Propose them.", on: "episode" },
  { id: "simplify", label: "Simplify this line", prompt: "Make the selected line simpler and more natural at the episode's level, keeping its meaning and the words it teaches. Update its translations too. Propose it.", on: "block" },
  { id: "stage", label: "Suggest staging for this line", prompt: "Suggest staging for the selected line: a gesture, a feeling, whom it is said to, what it points at, with a one-line reason each. Propose the best one.", on: "block" },
  { id: "options", label: "Propose choice options", prompt: "Propose two or three options for the learner's choice at or after the selected block, one clearly fitting, in every language, with a reply each. Propose them.", on: "block" },
  { id: "scene", label: "Check this scene", prompt: "Read the scene the selected block is in and tell me what does not work: words, translations, staging, who is spoken to. Be brief, and propose fixes only for clear mistakes.", on: "block" },
  { id: "draft", label: "Draft this episode from its brief", prompt: "This episode is a draft. Write its steps and quiz from its title, premise, cast, place, target words and lessons, in the series' languages, using the place's marks. Propose the result.", on: "episode" },
  { id: "second", label: "Second reader", prompt: "Review this episode as a careful second reader who did not write it: the main language, the translations against it, the quiz, the staging. List what must be fixed, most important first. Propose fixes for clear mistakes.", on: "episode", fresh: true },
];

/** The context the assistant gets: the page and what is selected on it. */
const contextNow = () => { const s = selection.value, r = route.value; return { page: r[0] ?? "board", ...(s?.kind ? { kind: s.kind } : {}), ...(s?.id ?? (r[0] === "episode" ? r[1] : undefined) ? { id: s?.id ?? r[1] } : {}), ...(s?.path ? { path: s.path } : {}) }; };

/** Send a message (or an ask), streaming the answer into the conversation. */
export async function send(content: string, o: { fresh?: boolean; confirm?: boolean } = {}) {
  if (busy.value || !content.trim()) return;
  assistantOpen.value = true;
  sideTab.value = "assistant";
  const history = o.fresh ? [] : turns.value.filter(t => !t.fresh || t.role === "user").map(t => ({ role: t.role, content: t.content }));
  if (!o.confirm) turns.value = [...turns.value, { role: "user", content, fresh: o.fresh }];
  const reply: Turn = { role: "assistant", content: "", parts: [], fresh: o.fresh };
  turns.value = [...turns.value, reply];
  const update = (fn: (t: Turn) => void) => { fn(reply); turns.value = [...turns.value.slice(0, -1), { ...reply, parts: [...(reply.parts ?? [])] }]; };
  busy.value = true;
  try {
    const r = await fetch("/api/assistant", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: [...history, { role: "user", content }], context: contextNow(), fresh: !!o.fresh, confirm: !!o.confirm }) });
    if (!r.ok || !r.body) { const b = await r.json().catch(() => ({})) as { message?: string }; update(t => t.parts!.push({ type: "error", message: b.message ?? `the assistant answered ${r.status}` })); return; }
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let i;
      while ((i = buf.indexOf("\n\n")) >= 0) {
        const block = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = block.split("\n").filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart()).join("\n");
        if (!data) continue;
        const e = JSON.parse(data) as Part & { usage?: { usd?: number } };
        update(t => {
          if (e.type === "text") { t.content += e.text; const last = t.parts!.at(-1); if (last?.type === "text") last.text += e.text; else t.parts!.push({ type: "text", text: e.text }); }
          else if (e.type === "tool") t.parts!.push({ type: "tool", name: e.name, input: e.input });
          else if ((e as { type: string }).type === "tool_result") { const x = e as unknown as { name: string; ok: boolean; summary: string }; const tool = [...t.parts!].reverse().find(p => p.type === "tool" && p.name === x.name && p.ok === undefined) as Extract<Part, { type: "tool" }> | undefined; if (tool) { tool.ok = x.ok; tool.summary = x.summary; } }
          else if (e.type === "done") t.parts!.push({ type: "done", usd: e.usage?.usd });
          else t.parts!.push(e);
        });
      }
    }
  } catch (e) { update(t => t.parts!.push({ type: "error", message: (e as Error).message })); }
  finally { busy.value = false; }
}

/** An ask from the list, about what is selected. */
export function ask(id: string) {
  const a = ASKS.find(x => x.id === id);
  if (!a) return;
  if (a.on === "block" && !selection.value?.path) { say("Select a block of the script first", true); return; }
  void send(a.prompt, { fresh: a.fresh });
}

/** The asks as a menu (where you work). */
export function AskMenu(p: { onDone?(): void }) {
  const w = world.value!;
  if (!w.ai) return html`<p class="note">The assistant is off: set it up in <a href="#/settings">Settings</a>.</p>`;
  const hasBlock = !!selection.value?.path;
  return html`<div class="menu">${ASKS.map(a => html`<button disabled=${a.on === "block" && !hasBlock} onClick=${() => { ask(a.id); p.onDone?.(); }}><b>${a.label}</b><small>${a.on === "block" ? "the selected block" : "the whole episode"}${a.fresh ? ", in a new conversation" : ""}</small></button>`)}</div>`;
}

const fmtUsd = (n: number) => `$${n < 0.1 ? n.toFixed(3) : n.toFixed(2)}`;

/** Today's spending against the cap, in the top bar. */
export function Meter() {
  const w = world.value!, u = usage.value;
  useEffect(() => { if (w.ai && !u) void fetch("/api/usage").then(r => r.json()).then(x => { usage.value = x; }).catch(() => {}); }, []);
  if (!w.ai || !u) return null;
  const cap = u.caps.dayUsd, share = cap ? Math.min(1, u.today.usd / cap) : 0;
  return html`<a class="meter" href="#/settings" title=${`Today ${fmtUsd(u.today.usd)} of ${cap ? fmtUsd(cap) : "no cap"} · this month ${fmtUsd(u.month.usd)}${u.caps.monthUsd ? ` of ${fmtUsd(u.caps.monthUsd)}` : ""} · ${u.today.tokens.toLocaleString()} tokens today`}>
    <span class="bar"><span style=${`width:${Math.round(share * 100)}%`} class=${share > 0.85 ? "hot" : ""}></span></span>${fmtUsd(u.today.usd)}</a>`;
}

/** What the assistant can and cannot do here: the same list its instructions hold (model/abilities.ts). */
function Abilities() {
  const w = world.value!;
  const a = abilities({ writable: w.writable, agentEdits: w.agentEdits ?? "proposals", shareCards: w.shareCards, cards: w.cards });
  return html`<div class="abilities">
    <div><b>It can</b><ul>${a.can.map(x => html`<li>${x}</li>`)}</ul></div>
    <div><b>It cannot</b><ul>${a.cannot.map(x => html`<li>${x}</li>`)}</ul></div></div>`;
}

const PAGE: Record<string, string> = { story: "episode", character: "character", place: "place" };
/** A proposal the assistant made, with where to answer it; once answered, only that it was. */
function Proposed(p: { id: string }) {
  const x = proposals.value.find(y => y.id === p.id);
  if (!x) return html`<div class="tool ok">Proposed an edit (${p.id}): answered, no longer waiting.</div>`;
  const href = `#/${PAGE[x.kind] ?? "agents"}/${x.doc}`;
  if (x.create) return html`<div class="tool ok">${x.after ? "Updated the proposed new episode" : "Proposed a new episode,"} <b>${x.doc}</b>. <a href=${href}>Open it</a> to accept or reject it; nothing is saved until you do.</div>`;
  return html`<div class="tool ok">Proposed an edit to <b>${x.doc}</b>: <a href=${href}>accept or reject it</a> above the ${x.kind === "story" ? "script" : "page"}.</div>`;
}

/** The conversation, in the side panel's Assistant tab. */
export function AssistantChat() {
  const w = world.value!;
  loadChats();
  const [text, setText] = useState("");
  const [past, setPast] = useState(false);
  const [about, setAbout] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns.value]);
  const ai = typeof w.ai === "object" ? w.ai : null;
  const ctx = contextNow();
  const empty = !turns.value.length;
  return html`${ai ? html`<p class="note model">${ai.provider === "anthropic" ? "Claude" : "A local model"} · ${ai.model ?? ""} · <a href="#/settings">change</a>
      ${!empty && html` · <button type="button" class="linkish" aria-expanded=${about} onClick=${() => setAbout(!about)}>What it can do</button>`}</p>` : ""}
    ${w.ai && about && !empty && html`<${Abilities} />`}
    ${!w.ai ? html`<p>The assistant is off. Set up Claude (an API key) or a local model (LM Studio, Ollama) in <a href="#/settings">Settings</a>.</p>` : html`
    <div class="chat">
      ${empty && html`<div class="note">Ask anything about the series, or pick an ask. It sees ${ctx.id ? html`<b>${ctx.id}</b>${(ctx as { path?: Path }).path ? html` at <b>${(ctx as { path: Path }).path.slice(1).join(".")}</b>` : ""}` : `the ${ctx.page}`}.<${Abilities} /><${AskMenu} /></div>`}
      ${turns.value.map(t => html`<div class=${`turn ${t.role}${t.fresh ? " fresh" : ""}`}>
        ${t.role === "user" ? t.content : (t.parts ?? []).map(p => p.type === "text" ? html`<${Markdown} class="said" text=${p.text} />`
          : p.type === "tool" ? html`<div class=${`tool${p.ok === false ? " bad" : ""}`} title=${p.input ? JSON.stringify(p.input) : undefined}><${Icon} name="plug" size=${12} /> ${p.name.replace(/_/g, " ")}${p.summary ? `: ${p.summary}` : p.ok === undefined ? " …" : ""}</div>`
          : p.type === "proposal" ? html`<${Proposed} id=${p.id} />`
          : p.type === "confirm" ? html`<div class="confirm">${p.why} It would cost about ${fmtUsd(p.estimateUsd)}. <button class="small primary" onClick=${() => { const q = [...turns.value].reverse().find(x => x.role === "user"); if (q) void send(q.content, { confirm: true, fresh: q.fresh }); }}>Go ahead</button></div>`
          : p.type === "error" ? html`<div class="tool bad">${p.message}</div>`
          : html`<div class="note">${p.usd !== undefined ? fmtUsd(p.usd) : ""}</div>`)}
      </div>`)}
      ${busy.value && html`<div class="note">Thinking…</div>`}
      <div ref=${end}></div>
    </div>
    <form class="chat-input" onSubmit=${(e: Event) => { e.preventDefault(); void send(text); setText(""); }}>
      <textarea rows=${2} value=${text} placeholder="Ask the assistant…" aria-label="Message" onInput=${(e: Event) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown=${(e: KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); setText(""); } }} />
      <div class="row"><button type="button" class="small" disabled=${busy.value || !turns.value.length} onClick=${() => { newChat(); setPast(false); }}>New conversation</button>
        <button type="button" class="small" aria-expanded=${past} disabled=${!chats.value.length} onClick=${() => setPast(!past)}>History${chats.value.length ? ` (${chats.value.length})` : ""}</button>
        <span class="grow"></span><button class="primary" disabled=${busy.value || !text.trim()}>Send</button></div>
      ${past && html`<div class="chat-history" role="list" aria-label="Past conversations">
        <p class="note">Kept in this browser only, the newest ${KEEP}.</p>
        ${chats.value.map(c => html`<div role="listitem" class=${`chat-past${c.id === chatId.value ? " on" : ""}`}>
          <button type="button" class="open" disabled=${busy.value} onClick=${() => { openChat(c.id); setPast(false); }}><b>${c.title}</b><small>${ago(c.at)} · ${c.turns.filter(t => t.role === "user").length} message${c.turns.filter(t => t.role === "user").length === 1 ? "" : "s"}${c.id === chatId.value ? " · open now" : ""}</small></button>
          <button type="button" class="iconbtn" title="Delete this conversation" aria-label=${`Delete “${c.title}”`} onClick=${() => forgetChat(c.id)}><${Icon} name="trash" size=${14} /></button></div>`)}
      </div>`}
    </form>`}`;
}
